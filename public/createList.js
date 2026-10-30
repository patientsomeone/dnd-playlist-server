// src/shared/playlistCachePolicy.ts
var PLAYLIST_CACHE_TTL_MS = 12 * 60 * 60 * 1e3;
var isPlaylistCacheFresh = (lastUpdate, now = Date.now(), inclusiveExpiry = false) => {
  if (typeof lastUpdate !== "number" || !Number.isFinite(lastUpdate) || lastUpdate <= 0) {
    return false;
  }
  const expiresAt = lastUpdate + PLAYLIST_CACHE_TTL_MS;
  return inclusiveExpiry ? now <= expiresAt : now < expiresAt;
};

// src/shared/uniquePlaylists.ts
function uniquePlaylistEntries(entries) {
  const byId = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const previous = byId.get(entry[1].id);
    if (!previous || entry[0] < previous[0]) byId.set(entry[1].id, entry);
  }
  return [...byId.values()];
}

// src/shared/playlistCatalog.ts
function parsePlaylistCatalog(data, channelId2) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid playlist catalog");
  if (data.lastUpdate === void 0 && Object.keys(data).length === 0) return void 0;
  if (!Number.isSafeInteger(data.lastUpdate) || data.lastUpdate < 0) throw new Error("Invalid playlist timestamp");
  const entries = Object.entries(data).filter(([name]) => name !== "lastUpdate").map(([name, value]) => {
    const playlist = value;
    if (!playlist || typeof playlist.id !== "string" || !playlist.id || typeof playlist.link !== "string" || !Number.isSafeInteger(playlist.count) || playlist.count < 0) throw new Error("Invalid playlist entry");
    return [name, { id: playlist.id, link: playlist.link, count: playlist.count }];
  });
  return { channelId: channelId2, lastUpdate: data.lastUpdate, playlists: Object.fromEntries(uniquePlaylistEntries(entries)) };
}
function parsePlaylistCacheState(data) {
  if (!data || typeof data.channelId !== "string" || !/^[A-Za-z0-9_-]+$/.test(data.channelId) || !(data.lastUpdate === null || Number.isSafeInteger(data.lastUpdate) && data.lastUpdate >= 0) || typeof data.hasCache !== "boolean" || typeof data.locked !== "boolean" || typeof data.fresh !== "boolean" || !Number.isFinite(data.serverTime) || data.hasCache !== (data.lastUpdate !== null) || data.fresh && !data.hasCache) {
    throw new Error("Invalid playlist cache state");
  }
  return data;
}

// src/client/indexedCatalog.ts
var CATALOG_DATABASE = "dnd-playlist-cache";
var CATALOG_STORE = "catalogs";
function openError() {
  const error = new Error("Browser storage unavailable");
  error.name = "CatalogStorageOpenError";
  return error;
}
function readRecord(record) {
  if (!record || typeof record.channelId !== "string" || !record.playlists) return void 0;
  try {
    return parsePlaylistCatalog({ ...record.playlists, lastUpdate: record.lastUpdate }, record.channelId);
  } catch {
    return void 0;
  }
}
var IndexedCatalogStorage = class {
  constructor(factory) {
    try {
      this.factory = factory || globalThis.indexedDB;
    } catch {
      this.factory = void 0;
    }
  }
  open() {
    if (this.opening !== void 0) return this.opening;
    const opening = new Promise((resolve, reject) => {
      if (!this.factory) return reject(openError());
      let request;
      try {
        request = this.factory.open(CATALOG_DATABASE, 1);
      } catch {
        return reject(openError());
      }
      let settled = false;
      const fail = () => {
        settled = true;
        reject(openError());
      };
      const timer = setTimeout(fail, 1500);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(CATALOG_STORE)) request.result.createObjectStore(CATALOG_STORE, { keyPath: "scope" });
      };
      request.onerror = request.onblocked = () => {
        clearTimeout(timer);
        fail();
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        if (settled) return request.result.close();
        settled = true;
        request.result.onversionchange = () => {
          request.result.close();
          this.opening = void 0;
        };
        resolve(request.result);
      };
    });
    this.opening = opening;
    void opening.catch(() => {
      if (this.opening === opening) this.opening = void 0;
    });
    return opening;
  }
  async transaction(scope, incoming) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CATALOG_STORE, incoming ? "readwrite" : "readonly");
      const store = transaction.objectStore(CATALOG_STORE);
      const request = store.get(scope);
      let result;
      const timer = setTimeout(() => transaction.abort(), 1500);
      request.onsuccess = () => {
        result = readRecord(request.result);
        if (incoming && (!result || incoming.channelId !== result.channelId || incoming.lastUpdate >= result.lastUpdate)) {
          result = incoming;
          store.put({ scope, ...incoming });
        }
      };
      transaction.oncomplete = () => {
        clearTimeout(timer);
        resolve(result);
      };
      transaction.onerror = transaction.onabort = () => {
        clearTimeout(timer);
        reject(new Error("Browser storage transaction failed"));
      };
    });
  }
  load(scope) {
    return this.transaction(scope);
  }
  async save(scope, catalog) {
    try {
      return await this.transaction(scope, catalog) || catalog;
    } catch (error) {
      if (!this.factory || !(error instanceof Error) || error.name !== "CatalogStorageOpenError") throw error;
      return await this.transaction(scope, catalog) || catalog;
    }
  }
  close() {
    const opening = this.opening;
    this.opening = void 0;
    opening?.then((db) => db.close()).catch(() => void 0);
  }
};

// src/client/catalogSync.ts
var CatalogSync = class {
  constructor(options) {
    this.options = options;
    this.currentPhase = "loading";
    this.polls = 0;
    this.retryAfter = 0;
    this.disposed = false;
    this.requests = /* @__PURE__ */ new Set();
    this.channelId = options.channelId;
    this.scope = options.channelId ? "channel:" + options.channelId : "default";
    this.fetcher = options.fetcher || globalThis.fetch.bind(globalThis);
  }
  phase(phase2) {
    this.currentPhase = phase2;
    if (!this.disposed) this.options.onPhase(phase2);
  }
  async start() {
    this.phase("loading");
    const loading = this.loadSaved();
    this.loading = loading;
    void this.check();
    await loading;
    if (this.loading === loading) this.loading = void 0;
  }
  async loadSaved() {
    const saved = await this.options.storage.load(this.scope).catch(() => void 0);
    if (this.disposed) return;
    if (saved && (!this.channelId || saved.channelId === this.channelId) && (!this.catalog || saved.lastUpdate > this.catalog.lastUpdate)) {
      this.catalog = saved;
      this.options.onCatalog(saved);
      if (this.currentPhase === "error") this.phase("offline");
    }
  }
  async waitForSaved() {
    if (!this.loading) return;
    let timer;
    try {
      await Promise.race([this.loading, new Promise((resolve) => {
        timer = setTimeout(resolve, 100);
      })]);
    } finally {
      clearTimeout(timer);
    }
  }
  endpoint(path, channelId2 = this.channelId) {
    return channelId2 ? path + "?channelId=" + encodeURIComponent(channelId2) : path;
  }
  async json(path, timeout = 5e3) {
    const controller = new AbortController();
    this.requests.add(controller);
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await this.fetcher(path, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Playlist request failed");
      return await response.json();
    } finally {
      clearTimeout(timer);
      this.requests.delete(controller);
    }
  }
  adopt(catalog) {
    if (this.disposed || catalog.channelId !== this.channelId) return;
    if (this.catalog?.channelId === catalog.channelId && this.catalog.lastUpdate >= catalog.lastUpdate) return;
    this.catalog = catalog;
    this.options.onCatalog(catalog);
    this.options.storage.save(this.scope, catalog).then((saved) => {
      if (this.disposed || saved.channelId !== this.channelId) return;
      if (saved.lastUpdate > (this.catalog?.lastUpdate ?? -1)) {
        this.catalog = saved;
        this.options.onCatalog(saved);
      }
      this.options.notify?.(saved.channelId);
    }).catch(() => void 0);
  }
  fail() {
    this.retryAfter = Date.now() + 3e4;
    this.phase(this.catalog ? "offline" : "error");
  }
  poll() {
    if (this.disposed || this.pollTimer !== void 0) return;
    if (this.polls >= 40) return this.fail();
    this.pollTimer = setTimeout(() => {
      this.pollTimer = void 0;
      this.polls += 1;
      void this.check();
    }, 3e3);
  }
  refresh(channelId2) {
    if (this.refreshing !== void 0) return this.poll();
    if (Date.now() < this.retryAfter) return;
    this.phase("refreshing");
    this.refreshing = this.json(this.endpoint("/refreshPlaylists", channelId2), 3e4).then((data) => {
      if (this.disposed || this.channelId !== channelId2) return;
      if (data?.status === "processing") return this.poll();
      const catalog = parsePlaylistCatalog(data, channelId2);
      if (!catalog) throw new Error("No refreshed catalog");
      this.adopt(catalog);
      this.polls = 0;
      this.phase("ready");
    }).catch(() => {
      if (!this.disposed) {
        this.fail();
        this.poll();
      }
    }).finally(() => {
      this.refreshing = void 0;
    });
  }
  async checkServer() {
    this.phase(this.refreshing !== void 0 ? "refreshing" : "checking");
    const stateEndpoint = this.options.channelId ? this.endpoint("/cacheState", this.options.channelId) : "/cacheState";
    const state = parsePlaylistCacheState(await this.json(stateEndpoint));
    if (this.disposed) return;
    if (this.options.channelId && state.channelId !== this.options.channelId) throw new Error("Unexpected playlist channel");
    this.channelId = state.channelId;
    await this.waitForSaved();
    if (this.disposed) return;
    if (this.catalog && this.catalog.channelId !== state.channelId) {
      this.catalog = void 0;
      this.options.onCatalog(void 0);
    }
    if (state.hasCache && state.lastUpdate !== null && (!this.catalog || state.lastUpdate > this.catalog.lastUpdate)) {
      const catalog = parsePlaylistCatalog(await this.json(this.endpoint("/listCount")), state.channelId);
      if (!catalog || catalog.lastUpdate < state.lastUpdate) throw new Error("Catalog does not match its server state");
      this.adopt(catalog);
    }
    if (state.locked) {
      this.phase("refreshing");
      this.poll();
    } else if (!state.fresh) {
      if (Date.now() < this.retryAfter) this.phase(this.catalog ? "offline" : "error");
      else this.refresh(state.channelId);
    } else {
      this.polls = 0;
      if (this.pollTimer !== void 0) clearTimeout(this.pollTimer);
      this.pollTimer = void 0;
      this.phase(this.catalog ? "ready" : "error");
    }
  }
  check() {
    if (this.disposed) return Promise.resolve();
    if (this.checking !== void 0) return this.checking;
    this.checking = this.checkServer().catch(() => this.fail()).finally(() => {
      this.checking = void 0;
    });
    return this.checking;
  }
  async beforeSelection() {
    let timer;
    try {
      await Promise.race([this.check(), new Promise((resolve) => {
        timer = setTimeout(resolve, 1500);
      })]);
    } finally {
      clearTimeout(timer);
    }
  }
  retry() {
    this.polls = 0;
    this.retryAfter = 0;
    return this.check();
  }
  find(id) {
    const entry = Object.entries(this.catalog?.playlists || {}).find(([, playlist]) => playlist.id === id);
    return entry && { name: entry[0], id: entry[1].id, count: entry[1].count };
  }
  dispose() {
    this.disposed = true;
    if (this.pollTimer !== void 0) clearTimeout(this.pollTimer);
    for (const request of this.requests) request.abort();
    this.options.storage.close();
  }
};

// src/agents/createList.ts
var parent = document.querySelector("#listParent");
var heading = document.createElement("h1");
heading.textContent = "Dip's Organized Playlists";
var status = document.createElement("p");
status.id = "catalogStatus";
status.hidden = true;
status.setAttribute("aria-live", "polite");
var retry = document.createElement("button");
retry.textContent = "Retry";
retry.hidden = true;
var list = document.createElement("dl");
var updated = document.createElement("sub");
updated.id = "lastUpdated";
parent?.append(heading, status, retry, list, updated);
var phase = "loading";
var selectionMessage;
var playerReady = false;
var queued;
var selectionRequest = 0;
window.noShuffle = false;
var channelId = new URL(location.href).searchParams.get("channelId") || void 0;
var broadcasts;
try {
  if (typeof BroadcastChannel !== "undefined") broadcasts = new BroadcastChannel("dnd-playlist-catalog");
} catch {
}
var sync = new CatalogSync({
  storage: new IndexedCatalogStorage(),
  channelId,
  onCatalog: renderCatalog,
  onPhase: (next) => {
    phase = next;
    renderStatus();
  },
  notify: (channel) => broadcasts?.postMessage({ channelId: channel })
});
function renderStatus() {
  const messages = {
    loading: "Loading playlists...",
    checking: "Checking for playlist updates...",
    refreshing: sync.catalog ? "Updating playlists in the background..." : "Loading playlists from the server...",
    ready: "",
    offline: "Using saved playlists; updates are unavailable.",
    error: "Unable to load playlists. Please retry."
  };
  status.textContent = selectionMessage || (sync.catalog ? "" : messages[phase]);
  status.hidden = !status.textContent;
  status.setAttribute("role", phase === "error" && !sync.catalog ? "alert" : "status");
  retry.hidden = !!sync.catalog || phase !== "error" && phase !== "offline";
}
function renderCatalog(catalog) {
  const focused = document.activeElement;
  const focusedId = focused instanceof HTMLAnchorElement && list.contains(focused) ? focused.dataset.playlistId : void 0;
  const fragment = document.createDocumentFragment();
  const playlists = catalog?.playlists || {};
  const entries = uniquePlaylistEntries(Object.entries(playlists)).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  for (const [name, playlist] of entries) {
    const element = document.createElement("dt");
    const anchor = document.createElement("a");
    anchor.textContent = name;
    anchor.href = "https://www.youtube.com/playlist?list=" + encodeURIComponent(playlist.id);
    anchor.id = playlist.id;
    anchor.dataset.playlistId = playlist.id;
    anchor.setAttribute("count", String(playlist.count));
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      try {
        window.gtag?.("event", "click", { event_category: "button", event_label: name });
      } catch {
      }
      const request = ++selectionRequest;
      selectionMessage = void 0;
      renderStatus();
      selectPlaylist(playlist.id, request).catch(() => {
        if (request === selectionRequest) {
          selectionMessage = "Unable to select that playlist. Please try again.";
          renderStatus();
        }
      });
    });
    element.append(anchor);
    fragment.append(element);
  }
  list.replaceChildren(fragment);
  if (focusedId) {
    Array.from(list.querySelectorAll("a")).find((anchor) => anchor.dataset.playlistId === focusedId)?.focus({ preventScroll: true });
  }
  updated.className = catalog && isPlaylistCacheFresh(catalog.lastUpdate) ? "fresh" : "expired";
  updated.replaceChildren(document.createTextNode(catalog ? "Last Updated: " + new Date(catalog.lastUpdate).toLocaleString() : "No saved playlists yet."), document.createElement("br"), document.createTextNode("Author: Joshua Robinson"));
  renderStatus();
}
function setHeaderState(state) {
  const header = document.querySelector("#frameParent h2");
  if (!header) return;
  const parts = header.textContent.split(":");
  const name = parts.length > 1 ? parts.slice(1).join(":").trim() : header.textContent;
  header.textContent = state.slice(0, 1).toUpperCase() + state.slice(1) + ": " + name;
  header.classList.remove("paused", "playing", "buffering");
  header.classList.add(state);
}
function playerStateChange(event) {
  void sync.check();
  const states = window.YT?.PlayerState;
  if (!states) return;
  if (event.data === states.PLAYING) {
    if (window.frameUpdated) {
      window.frameUpdated = false;
      if (!window.noShuffle) {
        try {
          window.player?.setShuffle(true);
        } catch {
        }
      }
      try {
        window.player?.setLoop(true);
      } catch {
      }
    }
    return setHeaderState("playing");
  }
  setHeaderState(event.data === states.PAUSED ? "paused" : "buffering");
}
window.onPlayerReady = () => {
  void sync.check();
};
window.onYouTubeIframeAPIReady = () => {
  const api = window.YT;
  if (window.player || !api) return;
  window.player = new api.Player("shufflerFrame", {
    playerVars: { autoplay: 1, loop: 1, enablejsapi: 1 },
    events: {
      onReady: () => {
        playerReady = true;
        if (queued) {
          const selection = queued;
          selectPlaylist(selection.id, selection.request).catch(() => {
            if (selection.request === selectionRequest) {
              selectionMessage = "Unable to select that playlist. Please try again.";
              renderStatus();
            }
          });
        }
      },
      onStateChange: playerStateChange,
      onPlaybackRateChange: () => {
        void sync.check();
      },
      onError: () => {
        void sync.check();
        try {
          window.player?.nextVideo();
        } catch {
        }
      }
    }
  });
};
function injectApi() {
  if (document.querySelector("#youTubeApi")) return;
  const script = document.createElement("script");
  script.id = "youTubeApi";
  script.src = "https://www.youtube.com/iframe_api";
  script.onerror = () => {
    script.remove();
    selectionMessage = "The video player could not load. Select a playlist to retry.";
    renderStatus();
  };
  document.head.append(script);
}
async function selectPlaylist(id, request) {
  await sync.beforeSelection();
  if (request !== selectionRequest) return;
  const config = sync.find(id);
  if (!config) {
    queued = void 0;
    selectionMessage = "That playlist is no longer available. Please choose another.";
    renderStatus();
    return;
  }
  if (!playerReady) {
    queued = { id, request };
    injectApi();
    return;
  }
  queued = void 0;
  selectionMessage = void 0;
  renderStatus();
  updateFrame(config);
}
function updateFrame(config) {
  const player = window.player;
  if (!player) return;
  window.frameUpdated = true;
  const title = document.querySelector("#frameParent h2");
  try {
    player.stopVideo();
  } catch {
  }
  if (title) title.textContent = "Buffering: " + config.name;
  window.noShuffle = config.name.toLowerCase().includes("boss");
  try {
    player.loadPlaylist({
      listType: "playlist",
      suggestedQuality: "hd720",
      list: config.id,
      index: window.noShuffle ? 0 : Math.floor(Math.random() * config.count)
    });
  } catch {
    console.warn("Unable to load the selected playlist into the player");
  }
}
retry.addEventListener("click", () => {
  selectionMessage = void 0;
  void sync.retry();
});
broadcasts?.addEventListener("message", (event) => {
  if (event.data?.channelId === sync.catalog?.channelId) void sync.check();
});
window.addEventListener("online", () => {
  void sync.retry();
});
window.addEventListener("focus", () => {
  void sync.check();
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) void sync.check();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void sync.check();
});
for (const event of ["pointerdown", "keydown"]) {
  document.querySelector("#frameParent")?.addEventListener(event, () => {
    void sync.check();
  });
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    sync.dispose();
    broadcasts?.close();
  }
});
sync.start().catch(() => {
  phase = "error";
  renderStatus();
});
//# sourceMappingURL=createList.js.map
