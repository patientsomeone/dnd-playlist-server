export type SearchPreferences = {open: boolean; query: string;};

/** UI preferences are separate from the catalog database and its freshness/version. */
export class SearchPreferenceStorage {
    private opening?: Promise<IDBDatabase>;
    private pending: Promise<void> = Promise.resolve();
    private factory?: IDBFactory;

    constructor() {
        try { this.factory = globalThis.indexedDB; } catch { /* In-memory controls still work. */ }
    }

    private open(): Promise<IDBDatabase> {
        if (this.opening) return this.opening;
        this.opening = new Promise((resolve, reject) => {
            if (!this.factory) return reject(new Error("Preferences unavailable"));
            const request = this.factory.open("playlist-organizer-ui", 1);
            let settled = false;
            const timer = setTimeout(fail, 1500);
            function fail() { settled = true; clearTimeout(timer); reject(new Error("Preferences unavailable")); }
            request.onupgradeneeded = () => request.result.createObjectStore("search", {keyPath: "scope"});
            request.onerror = request.onblocked = fail;
            request.onsuccess = () => {
                clearTimeout(timer);
                if (settled) return request.result.close();
                settled = true;
                request.result.onversionchange = () => { request.result.close(); this.opening = undefined; };
                resolve(request.result);
            };
        });
        return this.opening;
    }

    private async transaction(scope: string, incoming?: SearchPreferences): Promise<SearchPreferences | undefined> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction("search", incoming ? "readwrite" : "readonly");
            const store = transaction.objectStore("search");
            const request = incoming ? store.put({scope, ...incoming}) : store.get(scope);
            let result: SearchPreferences | undefined;
            const timer = setTimeout(() => transaction.abort(), 1500);
            request.onsuccess = () => {
                const record: any = request.result;
                if (!incoming && typeof record?.open === "boolean" && typeof record.query === "string") result = {open: record.open, query: record.query};
            };
            transaction.oncomplete = () => { clearTimeout(timer); resolve(result); };
            transaction.onerror = transaction.onabort = () => { clearTimeout(timer); reject(new Error("Preferences unavailable")); };
        });
    }

    load(scope: string): Promise<SearchPreferences | undefined> { return this.transaction(scope); }
    save(scope: string, preferences: SearchPreferences): Promise<void> {
        this.pending = this.pending.catch(() => undefined).then(async () => { await this.transaction(scope, preferences); });
        return this.pending;
    }
    close(): void {
        this.pending.catch(() => undefined).then(() => this.opening?.then((db) => db.close())).catch(() => undefined);
    }
}
