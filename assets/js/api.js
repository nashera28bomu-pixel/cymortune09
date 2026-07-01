/**
 * api.js
 * Single reusable client for the Cymor Tune backend.
 *
 * Base URL is fixed per spec: https://cymortuneapi.onrender.com
 * All music data comes from here — nothing is ever hardcoded.
 *
 * NOTE ON RESPONSE SHAPES:
 * The backend wraps a JioSaavn-style catalog. Different deployments of this
 * kind of API nest results differently (root array vs `data` vs `results` vs
 * `data.results`, and song objects vary between `image`/`image[n].link` etc).
 * normalizeSong/Album/Artist/Playlist below defensively read multiple known
 * shapes so the UI never has to care. If the live backend changes its
 * contract, only this file needs to change.
 */

const BASE_URL = 'https://cymortuneapi.onrender.com';
const REQUEST_TIMEOUT_MS = 12000;
const MAX_RETRIES = 2;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min in-memory cache for repeat navigation

const memoryCache = new Map(); // url -> { at, data }

class ApiError extends Error {
  constructor(message, status, isTimeout = false, isOffline = false) {
    super(message);
    this.status = status;
    this.isTimeout = isTimeout;
    this.isOffline = isOffline;
  }
}

function withTimeout(promise, ms) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new ApiError('Request timed out', null, true)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function request(path, { method = 'GET', retries = MAX_RETRIES, useCache = true } = {}) {
  const url = `${BASE_URL}${path}`;

  if (!navigator.onLine) {
    throw new ApiError('You are offline', null, false, true);
  }

  if (useCache && method === 'GET') {
    const cached = memoryCache.get(url);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const fetchPromise = fetch(url, { method, signal: controller.signal, headers: { Accept: 'application/json' } });
      const res = await withTimeout(fetchPromise, REQUEST_TIMEOUT_MS).catch((err) => {
        controller.abort();
        throw err;
      });

      if (res.status === 404) {
        throw new ApiError('Not found', 404);
      }
      if (res.status >= 500) {
        throw new ApiError('Server error, retrying…', res.status);
      }
      if (!res.ok) {
        throw new ApiError(`Request failed (${res.status})`, res.status);
      }

      const json = await res.json();
      if (useCache && method === 'GET') {
        memoryCache.set(url, { at: Date.now(), data: json });
      }
      return json;
    } catch (err) {
      lastErr = err instanceof ApiError ? err : new ApiError(err.message, null, err.name === 'AbortError' || err.isTimeout);
      // Don't retry 404s
      if (lastErr.status === 404) break;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastErr;
}

/* ---------------- Normalizers ---------------- */

function bestImage(imageField) {
  if (!imageField) return 'assets/images/placeholder-art.svg';
  if (typeof imageField === 'string') return imageField;
  if (Array.isArray(imageField)) {
    // JioSaavn-style: [{quality:'50x50', link/url}, ...] — take the last (highest quality)
    const last = imageField[imageField.length - 1];
    return last?.link || last?.url || last?.src || 'assets/images/placeholder-art.svg';
  }
  return imageField.link || imageField.url || 'assets/images/placeholder-art.svg';
}

function bestStreamUrl(downloadField) {
  if (!downloadField) return null;
  if (typeof downloadField === 'string') return downloadField;
  if (Array.isArray(downloadField)) {
    const last = downloadField[downloadField.length - 1];
    return last?.link || last?.url || null;
  }
  return downloadField.link || downloadField.url || null;
}

function normalizeSong(raw) {
  if (!raw) return null;
  return {
    id: raw.id || raw.songId || raw._id || String(raw.title || '') + Math.random(),
    title: cleanText(raw.title || raw.name || raw.song || 'Unknown title'),
    artist: cleanText(
      raw.artist ||
        raw.subtitle ||
        raw.primaryArtists ||
        (Array.isArray(raw.artists?.primary) ? raw.artists.primary.map((a) => a.name).join(', ') : '') ||
        'Unknown artist'
    ),
    album: cleanText(raw.album?.name || raw.album || ''),
    artwork: bestImage(raw.image || raw.artwork || raw.thumbnail),
    duration: Number(raw.duration) || 0,
    language: raw.language || '',
    streamUrl: bestStreamUrl(raw.downloadUrl || raw.media_url || raw.stream || raw.url),
    lyrics: raw.lyrics || null,
    hasLyrics: Boolean(raw.hasLyrics || raw.lyrics),
    year: raw.year || raw.releaseDate || '',
    raw,
  };
}

function normalizeAlbum(raw) {
  if (!raw) return null;
  return {
    id: raw.id || raw.albumId || raw._id,
    name: cleanText(raw.name || raw.title || 'Unknown album'),
    artist: cleanText(raw.artist || raw.subtitle || raw.primaryArtists || ''),
    artwork: bestImage(raw.image || raw.artwork),
    year: raw.year || raw.releaseDate || '',
    songCount: raw.songCount || raw.songs?.length || 0,
    songs: Array.isArray(raw.songs) ? raw.songs.map(normalizeSong) : [],
    raw,
  };
}

function normalizeArtist(raw) {
  if (!raw) return null;
  return {
    id: raw.id || raw.artistId || raw._id,
    name: cleanText(raw.name || raw.title || 'Unknown artist'),
    image: bestImage(raw.image || raw.artwork),
    bio: raw.bio || raw.dob ? raw.bio : '',
    topSongs: Array.isArray(raw.topSongs) ? raw.topSongs.map(normalizeSong) : [],
    albums: Array.isArray(raw.albums) ? raw.albums.map(normalizeAlbum) : [],
    raw,
  };
}

function normalizePlaylist(raw) {
  if (!raw) return null;
  return {
    id: raw.id || raw.playlistId || raw._id,
    name: cleanText(raw.name || raw.title || 'Untitled playlist'),
    description: cleanText(raw.description || ''),
    artwork: bestImage(raw.image || raw.artwork),
    songCount: raw.songCount || raw.songs?.length || 0,
    songs: Array.isArray(raw.songs) ? raw.songs.map(normalizeSong) : [],
    raw,
  };
}

function cleanText(str) {
  if (!str) return '';
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

function pickArray(json, ...keys) {
  for (const k of keys) {
    const val = k.split('.').reduce((o, key) => (o ? o[key] : undefined), json);
    if (Array.isArray(val)) return val;
  }
  return Array.isArray(json) ? json : [];
}

/* ---------------- Public API ---------------- */

const Api = {
  async search(query, { limit = 20 } = {}) {
    if (!query || !query.trim()) return { songs: [], albums: [], artists: [], playlists: [] };
    const json = await request(`/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return {
      songs: pickArray(json, 'songs', 'data.songs', 'results.songs', 'data.results').map(normalizeSong),
      albums: pickArray(json, 'albums', 'data.albums', 'results.albums').map(normalizeAlbum),
      artists: pickArray(json, 'artists', 'data.artists', 'results.artists').map(normalizeArtist),
      playlists: pickArray(json, 'playlists', 'data.playlists', 'results.playlists').map(normalizePlaylist),
    };
  },

  async searchSongs(query, limit = 20) {
    const json = await request(`/api/v1/search/songs?q=${encodeURIComponent(query)}&limit=${limit}`);
    return pickArray(json, 'songs', 'data.songs', 'data.results', 'results').map(normalizeSong);
  },

  async getSong(id) {
    const json = await request(`/api/v1/songs/${encodeURIComponent(id)}`);
    const raw = json.data || json.song || json;
    return normalizeSong(Array.isArray(raw) ? raw[0] : raw);
  },

  async getAlbum(id) {
    const json = await request(`/api/v1/albums/${encodeURIComponent(id)}`);
    return normalizeAlbum(json.data || json.album || json);
  },

  async getArtist(id) {
    const json = await request(`/api/v1/artists/${encodeURIComponent(id)}`);
    return normalizeArtist(json.data || json.artist || json);
  },

  async getPlaylist(id) {
    const json = await request(`/api/v1/playlists/${encodeURIComponent(id)}`);
    return normalizePlaylist(json.data || json.playlist || json);
  },

  async trending({ type = 'songs', limit = 20 } = {}) {
    const json = await request(`/api/v1/trending?type=${type}&limit=${limit}`, { retries: 1 });
    const arr = pickArray(json, 'data', 'trending', 'results', 'songs');
    return type === 'songs' ? arr.map(normalizeSong) : type === 'albums' ? arr.map(normalizeAlbum) : arr.map(normalizeArtist);
  },

  async charts(limit = 20) {
    const json = await request(`/api/v1/charts?limit=${limit}`, { retries: 1 });
    return pickArray(json, 'data', 'charts', 'results').map(normalizePlaylist);
  },

  async newReleases(limit = 20) {
    const json = await request(`/api/v1/albums/new?limit=${limit}`, { retries: 1 });
    return pickArray(json, 'data', 'results', 'albums').map(normalizeAlbum);
  },

  async recommendations(songId, limit = 12) {
    const json = await request(`/api/v1/songs/${encodeURIComponent(songId)}/recommendations?limit=${limit}`, { retries: 1 });
    return pickArray(json, 'data', 'results', 'songs').map(normalizeSong);
  },

  async featuredPlaylists(limit = 10) {
    const json = await request(`/api/v1/playlists/featured?limit=${limit}`, { retries: 1 });
    return pickArray(json, 'data', 'results', 'playlists').map(normalizePlaylist);
  },
};

window.CT_Api = Api;
window.CT_ApiError = ApiError;
