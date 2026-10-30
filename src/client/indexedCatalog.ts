import {parsePlaylistCatalog, type PlaylistCatalog} from "../shared/playlistCatalog";

export interface CatalogStorage {
    load(scope: string): Promise<PlaylistCatalog | undefined>;
    save(scope: string, catalog: PlaylistCatalog): Promise<PlaylistCatalog>;
    close(): void;
}

export const CATALOG_DATABASE = "dnd-playlist-cache";
export const CATALOG_STORE = "catalogs";

function openError(): Error {
    const error = new Error("Browser storage unavailable");
    error.name = "CatalogStorageOpenError";
    return error;
}

function readRecord(record: any): PlaylistCatalog | undefined {
    if (!record || typeof record.channelId !== "string" || !record.playlists) return undefined;
    try {
        return parsePlaylistCatalog({...record.playlists, lastUpdate: record.lastUpdate}, record.channelId);
    } catch {
        return undefined;
    }
}

export class IndexedCatalogStorage implements CatalogStorage {
    private opening?: Promise<IDBDatabase>;
    private factory?: IDBFactory;

    constructor(factory?: IDBFactory) {
        try { this.factory = factory || globalThis.indexedDB; } catch { this.factory = undefined; }
    }

    private open(): Promise<IDBDatabase> {
        if (this.opening !== undefined) return this.opening;
        const opening = new Promise<IDBDatabase>((resolve, reject) => {
            if (!this.factory) return reject(openError());
            let request: IDBOpenDBRequest;
            try { request = this.factory.open(CATALOG_DATABASE, 1); }
            catch { return reject(openError()); }
            let settled = false;
            const fail = () => {
                settled = true;
                reject(openError());
            };
            const timer = setTimeout(fail, 1500);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(CATALOG_STORE)) request.result.createObjectStore(CATALOG_STORE, {keyPath: "scope"});
            };
            request.onerror = request.onblocked = () => { clearTimeout(timer); fail(); };
            request.onsuccess = () => {
                clearTimeout(timer);
                if (settled) return request.result.close();
                settled = true;
                request.result.onversionchange = () => {
                    request.result.close();
                    this.opening = undefined;
                };
                resolve(request.result);
            };
        });
        this.opening = opening;
        void opening.catch(() => { if (this.opening === opening) this.opening = undefined; });
        return opening;
    }

    private async transaction(scope: string, incoming?: PlaylistCatalog): Promise<PlaylistCatalog | undefined> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(CATALOG_STORE, incoming ? "readwrite" : "readonly");
            const store = transaction.objectStore(CATALOG_STORE);
            const request = store.get(scope);
            let result: PlaylistCatalog | undefined;
            const timer = setTimeout(() => transaction.abort(), 1500);
            request.onsuccess = () => {
                result = readRecord(request.result);
                if (incoming && (!result || incoming.channelId !== result.channelId || incoming.lastUpdate >= result.lastUpdate)) {
                    result = incoming;
                    store.put({scope, ...incoming});
                }
            };
            transaction.oncomplete = () => { clearTimeout(timer); resolve(result); };
            transaction.onerror = transaction.onabort = () => {
                clearTimeout(timer);
                reject(new Error("Browser storage transaction failed"));
            };
        });
    }

    load(scope: string): Promise<PlaylistCatalog | undefined> { return this.transaction(scope); }
    async save(scope: string, catalog: PlaylistCatalog): Promise<PlaylistCatalog> {
        try {
            return await this.transaction(scope, catalog) || catalog;
        } catch (error) {
            // A transient failure during startup must not disable persistence for the whole page.
            if (!this.factory || !(error instanceof Error) || error.name !== "CatalogStorageOpenError") throw error;
            return await this.transaction(scope, catalog) || catalog;
        }
    }
    close(): void {
        const opening = this.opening;
        this.opening = undefined;
        opening?.then((db) => db.close()).catch(() => undefined);
    }
}
