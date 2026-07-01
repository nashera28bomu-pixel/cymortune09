/**
 * storage.js
 * Single source of truth for everything Cymor Tune keeps in LocalStorage.
 * No login, no server-side user state — every list below lives on-device.
 */

const KEYS = {
  FAVORITES: 'ct_favorites',
  HISTORY: 'ct_history',
  DOWNLOADS: 'ct_downloads',
  PLAYLISTS: 'ct_playlists',
  SETTINGS: 'ct_settings',
  THEME: 'ct_theme',
  QUEUE: 'ct_queue',
  CURRENT_SONG: 'ct_current_song',
  SEARCH_HISTORY: 'ct_search_history',
  LAST_PAGE: 'ct_last_page',
};

const DEFAULT_SETTINGS = {
  theme: 'dark',
  autoplay: true,
  streamQuality: 'auto',
  cacheImages: true,
};

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function read(key, fallback) {
  try {
    return safeParse(localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error('[storage] write failed for', key, err);
    return false;
  }
}

/* ---------------- Favorites ---------------- */

const Favorites = {
  all() {
    return read(KEYS.FAVORITES, []);
  },
  has(id) {
    return Favorites.all().some((s) => s.id === id);
  },
  toggle(song) {
    const list = Favorites.all();
    const idx = list.findIndex((s) => s.id === song.id);
    if (idx >= 0) {
      list.splice(idx, 1);
      write(KEYS.FAVORITES, list);
      return false;
    }
    list.unshift({ ...song, savedAt: Date.now() });
    write(KEYS.FAVORITES, list);
    return true;
  },
  remove(id) {
    write(KEYS.FAVORITES, Favorites.all().filter((s) => s.id !== id));
  },
  clear() {
    write(KEYS.FAVORITES, []);
  },
};

/* ---------------- History (recently played + viewed) ---------------- */

const History = {
  MAX_SONGS: 100,
  recentlyPlayed() {
    return read(KEYS.HISTORY, { songs: [], albums: [], artists: [], playlists: [] }).songs || [];
  },
  raw() {
    return read(KEYS.HISTORY, { songs: [], albums: [], artists: [], playlists: [] });
  },
  addSong(song) {
    const h = History.raw();
    h.songs = [{ ...song, playedAt: Date.now() }, ...h.songs.filter((s) => s.id !== song.id)];
    if (h.songs.length > History.MAX_SONGS) h.songs.length = History.MAX_SONGS;
    write(KEYS.HISTORY, h);
  },
  addViewed(type, item) {
    // type: 'albums' | 'artists' | 'playlists'
    const h = History.raw();
    if (!h[type]) h[type] = [];
    h[type] = [{ ...item, viewedAt: Date.now() }, ...h[type].filter((s) => s.id !== item.id)];
    if (h[type].length > 50) h[type].length = 50;
    write(KEYS.HISTORY, h);
  },
  clear() {
    write(KEYS.HISTORY, { songs: [], albums: [], artists: [], playlists: [] });
  },
};

/* ---------------- Downloads (metadata only; blobs via Cache Storage) ---------------- */

const Downloads = {
  all() {
    return read(KEYS.DOWNLOADS, []);
  },
  has(id) {
    return Downloads.all().some((s) => s.id === id);
  },
  add(song) {
    const list = Downloads.all();
    if (list.some((s) => s.id === song.id)) return;
    list.unshift({ ...song, downloadedAt: Date.now() });
    write(KEYS.DOWNLOADS, list);
  },
  remove(id) {
    write(KEYS.DOWNLOADS, Downloads.all().filter((s) => s.id !== id));
    if ('caches' in window) {
      caches.open('cymor-tune-audio').then((c) => c.delete(`/__audio__/${id}`));
    }
  },
  clear() {
    write(KEYS.DOWNLOADS, []);
    if ('caches' in window) caches.delete('cymor-tune-audio');
  },
  totalSize() {
    return Downloads.all().reduce((sum, s) => sum + (s.sizeBytes || 0), 0);
  },
};

/* ---------------- Playlists ---------------- */

const Playlists = {
  all() {
    return read(KEYS.PLAYLISTS, []);
  },
  get(id) {
    return Playlists.all().find((p) => p.id === id) || null;
  },
  create(name) {
    const list = Playlists.all();
    const playlist = {
      id: 'pl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name.trim() || 'Untitled Playlist',
      songs: [],
      createdAt: Date.now(),
    };
    list.unshift(playlist);
    write(KEYS.PLAYLISTS, list);
    return playlist;
  },
  rename(id, name) {
    const list = Playlists.all();
    const p = list.find((p) => p.id === id);
    if (p) p.name = name.trim() || p.name;
    write(KEYS.PLAYLISTS, list);
  },
  delete(id) {
    write(KEYS.PLAYLISTS, Playlists.all().filter((p) => p.id !== id));
  },
  addSong(id, song) {
    const list = Playlists.all();
    const p = list.find((p) => p.id === id);
    if (p && !p.songs.some((s) => s.id === song.id)) {
      p.songs.push(song);
      write(KEYS.PLAYLISTS, list);
    }
  },
  removeSong(id, songId) {
    const list = Playlists.all();
    const p = list.find((p) => p.id === id);
    if (p) {
      p.songs = p.songs.filter((s) => s.id !== songId);
      write(KEYS.PLAYLISTS, list);
    }
  },
  reorder(id, fromIdx, toIdx) {
    const list = Playlists.all();
    const p = list.find((p) => p.id === id);
    if (p) {
      const [moved] = p.songs.splice(fromIdx, 1);
      p.songs.splice(toIdx, 0, moved);
      write(KEYS.PLAYLISTS, list);
    }
  },
};

/* ---------------- Settings & Theme ---------------- */

const Settings = {
  get() {
    return { ...DEFAULT_SETTINGS, ...read(KEYS.SETTINGS, {}) };
  },
  update(patch) {
    const merged = { ...Settings.get(), ...patch };
    write(KEYS.SETTINGS, merged);
    return merged;
  },
};

/* ---------------- Queue / Now Playing (survives refresh) ---------------- */

const QueueStore = {
  save(queue, index) {
    write(KEYS.QUEUE, { queue, index, savedAt: Date.now() });
  },
  load() {
    return read(KEYS.QUEUE, { queue: [], index: -1 });
  },
  saveCurrentTime(seconds) {
    const song = read(KEYS.CURRENT_SONG, null);
    if (song) {
      song.resumeAt = seconds;
      write(KEYS.CURRENT_SONG, song);
    }
  },
  saveCurrentSong(song) {
    write(KEYS.CURRENT_SONG, song);
  },
  currentSong() {
    return read(KEYS.CURRENT_SONG, null);
  },
};

/* ---------------- Search history ---------------- */

const SearchHistory = {
  MAX: 15,
  all() {
    return read(KEYS.SEARCH_HISTORY, []);
  },
  add(term) {
    const t = term.trim();
    if (!t) return;
    let list = SearchHistory.all().filter((q) => q.toLowerCase() !== t.toLowerCase());
    list.unshift(t);
    if (list.length > SearchHistory.MAX) list.length = SearchHistory.MAX;
    write(KEYS.SEARCH_HISTORY, list);
  },
  remove(term) {
    write(KEYS.SEARCH_HISTORY, SearchHistory.all().filter((q) => q !== term));
  },
  clear() {
    write(KEYS.SEARCH_HISTORY, []);
  },
};

/* ---------------- Last opened page (for SPA restore) ---------------- */

const LastPage = {
  get() {
    return read(KEYS.LAST_PAGE, '/home');
  },
  set(path) {
    write(KEYS.LAST_PAGE, path);
  },
};

/* ---------------- Cache footprint (approx, for Settings > Cache size) ---------------- */

function estimateLocalStorageBytes() {
  let total = 0;
  for (const k of Object.values(KEYS)) {
    const v = localStorage.getItem(k);
    if (v) total += v.length * 2; // UTF-16 approx
  }
  return total;
}

async function estimateCacheStorageBytes() {
  if (!('storage' in navigator) || !navigator.storage.estimate) return 0;
  try {
    const { usage } = await navigator.storage.estimate();
    return usage || 0;
  } catch {
    return 0;
  }
}

function clearEverything() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  if ('caches' in window) {
    caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
  }
}

window.CT_Storage = {
  KEYS,
  Favorites,
  History,
  Downloads,
  Playlists,
  Settings,
  QueueStore,
  SearchHistory,
  LastPage,
  estimateLocalStorageBytes,
  estimateCacheStorageBytes,
  clearEverything,
};
