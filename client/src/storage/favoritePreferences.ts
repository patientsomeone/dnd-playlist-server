/** Favorites are UI data, keyed by stable playlist ID and channel scope, never catalog titles. */
export class FavoriteStorage {
    private opening?: Promise<IDBDatabase>;
    private pending: Promise<void> = Promise.resolve();
    private factory?: IDBFactory;

    constructor() { try { this.factory = globalThis.indexedDB; } catch { /* Memory-only favorites remain usable. */ } }

    private open(): Promise<IDBDatabase> {
        if (this.opening) return this.opening;
        const opening = new Promise<IDBDatabase>((resolve, reject) => {
            if (!this.factory) return reject(new Error("Favorites unavailable"));
            const request = this.factory.open("playlist-organizer-favorites", 1);
            let settled = false;
            const timer = setTimeout(() => { settled = true; reject(new Error("Favorites unavailable")); }, 1500);
            const fail = () => { settled = true; clearTimeout(timer); reject(new Error("Favorites unavailable")); };
            request.onupgradeneeded = () => {
                const store = request.result.createObjectStore("favorites", {keyPath: ["scope", "id"]});
                store.createIndex("scope", "scope");
            };
            request.onerror = request.onblocked = fail;
            request.onsuccess = () => {
                clearTimeout(timer);
                if (settled) return request.result.close();
                settled = true;
                request.result.onversionchange = () => { request.result.close(); this.opening = undefined; };
                resolve(request.result);
            };
        });
        this.opening = opening.catch((error: unknown) => { this.opening = undefined; throw error; });
        return this.opening;
    }

    private async transaction(scope: string, change?: {id: string; favorite: boolean;}): Promise<string[]> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction("favorites", change ? "readwrite" : "readonly");
            const store = transaction.objectStore("favorites");
            let ids: string[] = [];
            if (change) {
                if (change.favorite) store.put({scope, id: change.id});
                else store.delete([scope, change.id]);
            } else {
                const request = store.index("scope").getAll(scope);
                request.onsuccess = () => {
                    const records: unknown = request.result;
                    ids = Array.isArray(records) ? records.flatMap((record: unknown) =>
                        record && typeof record === "object" && "id" in record && typeof record.id === "string" ? [record.id] : []) : [];
                };
            }
            const timer = setTimeout(() => transaction.abort(), 1500);
            transaction.oncomplete = () => { clearTimeout(timer); resolve(ids); };
            transaction.onerror = transaction.onabort = () => { clearTimeout(timer); reject(new Error("Favorites unavailable")); };
        });
    }

    load(scope: string): Promise<string[]> { return this.transaction(scope); }
    save(scope: string, id: string, favorite: boolean): Promise<void> {
        this.pending = this.pending.catch(() => undefined).then(async () => { await this.transaction(scope, {id, favorite}); });
        return this.pending;
    }
    close(): void { this.pending.catch(() => undefined).then(() => this.opening?.then((db) => db.close())).catch(() => undefined); }
}
