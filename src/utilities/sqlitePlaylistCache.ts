/* eslint-disable max-classes-per-file -- The store, channel adapter, and validation error form one cache module. */
import sqlite3 from "sqlite3";
import {mkdir, readFile} from "fs/promises";
import {dirname, join} from "path";
import {randomUUID} from "crypto";
import type {individualPlaylist} from "../.types";
import type {PlaylistCacheState} from "../shared/playlistCatalog";
import {isPlaylistCacheFresh} from "../shared/playlistCachePolicy";
import {uniquePlaylistEntries} from "../shared/uniquePlaylists";

export const REFRESH_LEASE_MS = 60_000;
export type CachedPlaylists = {lastUpdate?: number; [name: string]: individualPlaylist | number | undefined;};
export type PlaylistSnapshot = CachedPlaylists & {lastUpdate: number;};

export class InvalidPlaylistQuery extends Error {
    readonly status = 400;
}

export function validateChannelId(channelId: string): void {
    if (typeof channelId !== "string" || !/^[A-Za-z0-9_-]+$/.test(channelId)) {
        throw new InvalidPlaylistQuery("Invalid YouTube channel ID");
    }
}

function snapshotEntries(snapshot: PlaylistSnapshot): [string, individualPlaylist][] {
    if (!snapshot || !Number.isSafeInteger(snapshot.lastUpdate) || snapshot.lastUpdate < 0) {
        throw new Error("Invalid playlist cache timestamp");
    }
    const entries = Object.entries(snapshot).filter(([name]) => name !== "lastUpdate").map<[string, individualPlaylist]>(([name, value]) => {
        if (!value || typeof value !== "object" || typeof value.id !== "string" || typeof value.link !== "string" ||
            !Number.isSafeInteger(value.count) || value.count < 0) {
            throw new Error("Invalid cached playlist");
        }
        return [name, value];
    });
    return uniquePlaylistEntries(entries);
}

function run(db: sqlite3.Database, sql: string, params: any[] = []): Promise<number> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (error) {
            if (error) reject(error);
            else resolve(this.changes);
        });
    });
}

function all<T>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
        db.all<T>(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
    });
}

/** Operations on one connection are queued so async transactions cannot interleave. */
export class SqlitePlaylistStore {
    private database?: Promise<sqlite3.Database>;
    private metadataReader?: Promise<sqlite3.Database>;
    private metadataRequests = new Set<Promise<any>>();
    private pending: Promise<any> = Promise.resolve();
    private closed = false;

    constructor(readonly filePath: string) {}

    private async open(): Promise<sqlite3.Database> {
        await mkdir(dirname(this.filePath), {recursive: true});
        const db = await new Promise<sqlite3.Database>((resolve, reject) => {
            const connection = new sqlite3.Database(this.filePath, (error) => error ? reject(error) : resolve(connection));
        });
        db.configure("busyTimeout", 5000);
        try {
            await run(db, "PRAGMA journal_mode = WAL");
            await run(db, "PRAGMA synchronous = FULL");
            await run(db, "PRAGMA foreign_keys = ON");
            await new Promise<void>((resolve, reject) => db.exec(`
                CREATE TABLE IF NOT EXISTS cache_channels (
                    channel_id TEXT PRIMARY KEY,
                    last_update INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS cached_playlists (
                    channel_id TEXT NOT NULL REFERENCES cache_channels(channel_id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    id TEXT NOT NULL,
                    link TEXT NOT NULL,
                    video_count INTEGER NOT NULL CHECK(video_count >= 0),
                    PRIMARY KEY (channel_id, name)
                );
                CREATE INDEX IF NOT EXISTS cached_playlist_id ON cached_playlists(channel_id, id);
                CREATE TABLE IF NOT EXISTS refresh_leases (
                    channel_id TEXT PRIMARY KEY,
                    token TEXT NOT NULL,
                    expires_at INTEGER NOT NULL
                );
            `, (error) => error ? reject(error) : resolve()));
            return db;
        } catch (error) {
            await new Promise<void>((resolve) => db.close(() => resolve()));
            throw error;
        }
    }

    private ready(): Promise<sqlite3.Database> {
        this.database ||= this.open().catch((error) => {
            this.database = undefined;
            throw error;
        });
        return this.database;
    }

    private enqueue<T>(operation: (db: sqlite3.Database) => Promise<T>): Promise<T> {
        if (this.closed) return Promise.reject(new Error("Playlist cache is closed"));
        const result = this.pending.then(() => this.ready().then(operation));
        this.pending = result.catch(() => undefined);
        return result;
    }

    read(channelId: string): Promise<CachedPlaylists> {
        validateChannelId(channelId);
        return this.enqueue(async (db) => {
            // One SELECT gives the metadata and playlists the same read snapshot.
            const rows = await all<{last_update: number; name: string | null; id: string; link: string; video_count: number;}>(db, `
                SELECT c.last_update, p.name, p.id, p.link, p.video_count
                FROM cache_channels c LEFT JOIN cached_playlists p ON c.channel_id = p.channel_id
                WHERE c.channel_id = ? ORDER BY p.name
            `, [channelId]);
            if (!rows.length) return {};
            return Object.fromEntries([
                ...uniquePlaylistEntries(rows.filter((row) => row.name !== null).map<[string, individualPlaylist]>((row) => [row.name || "", {
                    id: row.id, link: row.link, count: row.video_count
                }])),
                ["lastUpdate", rows[0].last_update]
            ]);
        });
    }

    state(channelId: string): Promise<PlaylistCacheState> {
        validateChannelId(channelId);
        if (this.closed) return Promise.reject(new Error("Playlist cache is closed"));
        // A separate read-only WAL connection keeps metadata checks off the write queue.
        const request = this.ready().then(async () => {
            this.metadataReader ||= new Promise<sqlite3.Database>((resolve, reject) => {
                const reader = new sqlite3.Database(this.filePath, sqlite3.OPEN_READONLY, (error) => {
                    if (error) reject(error);
                    else { reader.configure("busyTimeout", 5000); resolve(reader); }
                });
            }).catch((error) => { this.metadataReader = undefined; throw error; });
            const db = await this.metadataReader;
            const now = Date.now();
            const [row] = await all<{last_update: number | null; locked: number;}>(db, `SELECT
                (SELECT last_update FROM cache_channels WHERE channel_id = ?) AS last_update,
                EXISTS(SELECT 1 FROM refresh_leases WHERE channel_id = ? AND expires_at > ?) AS locked`,
            [channelId, channelId, now]);
            return {
                channelId, lastUpdate: row.last_update, hasCache: row.last_update !== null,
                locked: !!row.locked, fresh: isPlaylistCacheFresh(row.last_update, now), serverTime: now
            };
        });
        this.metadataRequests.add(request);
        request.then(() => this.metadataRequests.delete(request), () => this.metadataRequests.delete(request));
        return request;
    }

    replace(channelId: string, snapshot: PlaylistSnapshot, token?: string, onlyIfMissing = false): Promise<void> {
        validateChannelId(channelId);
        const entries = snapshotEntries(snapshot);
        return this.enqueue(async (db) => {
            await run(db, "BEGIN IMMEDIATE");
            try {
                if (onlyIfMissing && (await all(db, "SELECT 1 FROM cache_channels WHERE channel_id = ?", [channelId])).length) {
                    await run(db, "COMMIT");
                    return;
                }
                const checkOwner = async () => {
                    if (token && !(await all(db, `SELECT 1 FROM refresh_leases
                        WHERE channel_id = ? AND token = ? AND expires_at > ?`, [channelId, token, Date.now()])).length) {
                        throw new Error("Playlist refresh lease was lost");
                    }
                };
                await checkOwner();
                await run(db, `INSERT INTO cache_channels(channel_id, last_update) VALUES (?, ?)
                    ON CONFLICT(channel_id) DO UPDATE SET last_update = excluded.last_update`, [channelId, snapshot.lastUpdate]);
                await run(db, "DELETE FROM cached_playlists WHERE channel_id = ?", [channelId]);
                // Keep statement parameter counts bounded even for very large channels.
                for (let offset = 0; offset < entries.length; offset += 100) {
                    const batch = entries.slice(offset, offset + 100);
                    await run(db, `INSERT INTO cached_playlists(channel_id, name, id, link, video_count)
                        VALUES ${batch.map(() => "(?, ?, ?, ?, ?)").join(",")}`,
                    batch.flatMap(([name, playlist]) => [channelId, name, playlist.id, playlist.link, playlist.count]));
                }
                await checkOwner();
                await run(db, "COMMIT");
            } catch (error) {
                await run(db, "ROLLBACK");
                throw error;
            }
        });
    }

    acquire(channelId: string): Promise<string | null> {
        validateChannelId(channelId);
        return this.enqueue(async (db) => {
            const token = randomUUID();
            const now = Date.now();
            const changed = await run(db, `INSERT INTO refresh_leases(channel_id, token, expires_at) VALUES (?, ?, ?)
                ON CONFLICT(channel_id) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at
                WHERE refresh_leases.expires_at <= ?`, [channelId, token, now + REFRESH_LEASE_MS, now]);
            return changed ? token : null;
        });
    }

    renew(channelId: string, token: string): Promise<boolean> {
        validateChannelId(channelId);
        return this.enqueue(async (db) => {
            const now = Date.now();
            return !!await run(db, `UPDATE refresh_leases SET expires_at = ?
                WHERE channel_id = ? AND token = ? AND expires_at > ?`, [now + REFRESH_LEASE_MS, channelId, token, now]);
        });
    }

    release(channelId: string, token: string): Promise<void> {
        validateChannelId(channelId);
        return this.enqueue(async (db) => {
            await run(db, "DELETE FROM refresh_leases WHERE channel_id = ? AND token = ?", [channelId, token]);
        });
    }

    isRefreshing(channelId: string): Promise<boolean> {
        validateChannelId(channelId);
        return this.enqueue(async (db) => !!(await all(db,
            "SELECT 1 FROM refresh_leases WHERE channel_id = ? AND expires_at > ?", [channelId, Date.now()])).length);
    }

    close(): Promise<void> {
        if (this.closed) return this.pending.then(() => undefined);
        this.closed = true;
        const closing = this.pending.then(async () => {
            await Promise.allSettled([...this.metadataRequests]);
            if (this.metadataReader !== undefined) {
                const reader = await this.metadataReader;
                await new Promise<void>((resolve, reject) => reader.close((error) => error ? reject(error) : resolve()));
            }
            if (this.database === undefined) return;
            const db = await this.database;
            await new Promise<void>((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));
        });
        this.pending = closing.catch(() => undefined);
        return closing;
    }
}

export class ChannelPlaylistCache {
    constructor(private store: SqlitePlaylistStore, readonly channelId: string, private legacyDirectory?: string) {
        validateChannelId(channelId);
    }

    async read(): Promise<CachedPlaylists> {
        const cached = await this.store.read(this.channelId);
        if (cached.lastUpdate !== undefined || !this.legacyDirectory) return cached;
        let snapshot: PlaylistSnapshot;
        try {
            snapshot = JSON.parse(await readFile(join(this.legacyDirectory, `${this.channelId}.json`), "utf8"));
            snapshotEntries(snapshot);
        } catch (error) {
            if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) console.warn(`Ignoring invalid legacy playlist cache for ${this.channelId}`);
            return cached;
        }
        // A concurrent refresh/import must never be overwritten by an older JSON file.
        await this.store.replace(this.channelId, snapshot, undefined, true);
        return this.store.read(this.channelId);
    }

    replace(snapshot: PlaylistSnapshot, token: string): Promise<void> { return this.store.replace(this.channelId, snapshot, token); }
    acquire(): Promise<string | null> { return this.store.acquire(this.channelId); }
    renew(token: string): Promise<boolean> { return this.store.renew(this.channelId, token); }
    release(token: string): Promise<void> { return this.store.release(this.channelId, token); }
    isRefreshing(): Promise<boolean> { return this.store.isRefreshing(this.channelId); }
    state(): Promise<PlaylistCacheState> { return this.store.state(this.channelId); }
}
