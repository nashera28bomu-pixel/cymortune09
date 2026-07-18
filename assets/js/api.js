/**
 * api.js
 * Client for the Cymor Tune backend at https://cymortuneapi.onrender.com,
 * which runs the "sumitkolhe/jiosaavn-api" wrapper (confirmed from a live
 * response sample). Endpoints and field names below are matched to that
 * project's actual contract:
 *
 *   GET /api/search?query=                    quick multi-type search
 *   GET /api/search/songs?query=&page=&limit=  full song objects (has downloadUrl)
 *   GET /api/search/albums?query=
 *   GET /api/search/artists?query=
 *   GET /api/search/playlists?query=
 *   GET /api/songs/:id                         song detail (has downloadUrl)
 *   GET /api/songs/:id/lyrics
 *   GET /api/songs/:id/suggestions              "related songs"
 *   GET /api/albums?id=:id
 *   GET /api/artists/:id
 *   GET /api/artists/:id/songs
 *   GET /api/artists/:id/albums
 *   GET /api/playlists?id=:id
 *
 * IMPORTANT: this API has no "trending" / "charts" / "new releases" /
 * "featured playlists" endpoint of any kind — it's search + lookup-by-id
 * only. There is nothing to discover without a query, so the Home page
 * (app.js) does not call anything like that; it leans on a curated list of
 * seed searches instead. Don't add trending/charts calls here — they don't
 * exist on this backend.
 *
 * All song objects returned by *this file* are normalized to one shape
 * regardless of which endpoint they came from (see normalizeSong). Quick
 * multi-type search results are lighter (no downloadUrl, no duration) than
 * /api/search/songs or /api/songs/:id results — CT_Player lazily re-fetches
 * full song data by id the moment something without a streamUrl is played.
 */

const BASE_URL = 'https://cymortuneapi.onrender.com';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const CACHE_TTL_MS = 5 * 60 * 1000;

const memoryCache = new Map();

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

async function request(path, { retries = MAX_RETRIES, useCache = true } = {}) {
  const url = `${BASE_URL}${path}`;

  if (!navigator.onLine) throw new ApiError('You are offline', null, false, true);

  if (useCache) {
    const cached = memoryCache.get(url);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
  }

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const fetchPromise = fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      const res = await withTimeout(fetchPromise, REQUEST_TIMEOUT_MS).catch((err) => {
        controller.abort();
        throw err;
      });

      if (res.status === 404) throw new ApiError('Not found', 404);
      if (res.status >= 500) throw new ApiError('Server error, retrying…', res.status);
      if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);

      const json = await res.json();
      if (json && json.success === false) {
        throw new ApiError(json.message || 'The backend rejected this request', 400);
      }
      if (useCache) memoryCache.set(url, { at: Date.now(), data: json });
      return json;
    } catch (err) {
      lastErr = err instanceof ApiError ? err : new ApiError(err.message, null, err.name === 'AbortError' || err.isTimeout);
      if (lastErr.status === 404 || lastErr.status === 400) break;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastErr;
}

/* ---------------- Normalizers ---------------- */
// Every image field on this API is an array of { quality, url }.
function bestImage(imageField) {
  if (!imageField) return '/assets/images/placeholder-art.svg';
  if (typeof imageField === 'string') return imageField;
  if (Array.isArray(imageField)) {
    const last = imageField[imageField.length - 1];
    return last?.url || last?.link || '/assets/images/placeholder-art.svg';
  }
  return imageField.url || imageField.link || '/assets/images/placeholder-art.svg';
}

// downloadUrl is an array of { quality, url }, e.g. 12kbps..320kbps. Take the highest.
function bestStreamUrl(downloadUrlField) {
  if (!downloadUrlField) return null;
  if (typeof downloadUrlField === 'string') return downloadUrlField;
  if (Array.isArray(downloadUrlField) && downloadUrlField.length) {
    return downloadUrlField[downloadUrlField.length - 1]?.url || null;
  }
  return null;
}

function artistNames(raw) {
  // Full-shape songs have artists.primary[]; quick-search songs have a flat primaryArtists string.
  if (raw.artists?.primary?.length) return raw.artists.primary.map((a) => a.name).join(', ');
  if (raw.primaryArtists) return raw.primaryArtists;
  if (raw.singers) return raw.singers;
  if (raw.subtitle) return raw.subtitle;
  return 'Unknown artist';
}

function normalizeSong(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    title: cleanText(raw.name || raw.title || 'Unknown title'),
    artist: cleanText(artistNames(raw)),
    album: cleanText(raw.album?.name || raw.album || ''),
    albumId: raw.album?.id || null,
    artwork: bestImage(raw.image),
    duration: Number(raw.duration) || 0,
    language: raw.language || '',
    streamUrl: bestStreamUrl(raw.downloadUrl),
    lyrics: null,
    hasLyrics: Boolean(raw.hasLyrics),
    lyricsId: raw.lyricsId || raw.id,
    year: raw.year || raw.releaseDate || '',
    jiosaavnUrl: raw.url || null,
  };
}

function normalizeAlbum(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    name: cleanText(raw.name || raw.title || 'Unknown album'),
    artist: cleanText(raw.artists?.primary?.map((a) => a.name).join(', ') || raw.artist || ''),
    artwork: bestImage(raw.image),
    year: raw.year || '',
    songCount: raw.songCount || raw.songs?.length || 0,
    songs: Array.isArray(raw.songs) ? raw.songs.map(normalizeSong) : [],
  };
}

function normalizeArtist(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    name: cleanText(raw.name || raw.title || 'Unknown artist'),
    image: bestImage(raw.image),
    bio: raw.bio && Array.isArray(raw.bio) ? raw.bio.map((b) => b.text).join('\n\n') : raw.bio || '',
    topSongs: Array.isArray(raw.topSongs) ? raw.topSongs.map(normalizeSong) : [],
    albums: Array.isArray(raw.topAlbums) ? raw.topAlbums.map(normalizeAlbum) : Array.isArray(raw.albums) ? raw.albums.map(normalizeAlbum) : [],
  };
}

function normalizePlaylist(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    name: cleanText(raw.name || raw.title || 'Untitled playlist'),
    description: cleanText(raw.description || ''),
    artwork: bestImage(raw.image),
    songCount: raw.songCount || raw.songs?.length || 0,
    songs: Array.isArray(raw.songs) ? raw.songs.map(normalizeSong) : [],
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

function resultsOf(json) {
  // Handles both { data: { results: [...] } } (typed search) and a raw array fallback.
  if (Array.isArray(json?.data?.results)) return json.data.results;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

// JioSaavn's catalog is full of "ZZang KARAOKE"-style instrumental/tribute
// covers that match an artist's name in their title without being an
// actual track by that artist (e.g. "Doja (By Central Cee) (Melody
// Karaoke Version)" by "ZZang KARAOKE"). These are real matches by JioSaavn's
// own search relevance, but they're noise for anyone just trying to hear
// the song, so filter them out by default rather than showing them.
const JUNK_SONG_PATTERN = /karaoke|instrumental version|originally (perfomed|performed)|tribute to|in the style of|made famous by|backing track|cover version/i;

function isLikelyJunkSong(song) {
  return JUNK_SONG_PATTERN.test(song.title || '') || JUNK_SONG_PATTERN.test(song.album || '') || JUNK_SONG_PATTERN.test(song.artist || '');
}

/** Drops obvious karaoke/tribute noise, but never returns an empty list if that's all there was. */
function preferAuthentic(songs) {
  const clean = songs.filter((s) => !isLikelyJunkSong(s));
  return clean.length ? clean : songs;
}

/* ---------------- Public API ---------------- */

/** Tries each candidate path in order, returning the first that doesn't 404/error.
 *  Used for endpoints whose exact convention (path param vs ?id=) isn't confirmed. */
async function requestFirstSuccess(paths) {
  let lastErr;
  for (const path of paths) {
    try {
      return await request(path, { retries: 0, useCache: true });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

const Api = {
  /** Combined search across all four types, each with full field data. */
  async search(query, { limit = 15 } = {}) {
    if (!query || !query.trim()) return { songs: [], albums: [], artists: [], playlists: [] };
    const q = encodeURIComponent(query.trim());
    const [songs, albums, artists, playlists] = await Promise.all([
      Api.searchSongs(query, limit).catch(() => []),
      request(`/api/search/albums?query=${q}&limit=${limit}`).then(resultsOf).catch(() => []),
      request(`/api/search/artists?query=${q}&limit=${limit}`).then(resultsOf).catch(() => []),
      request(`/api/search/playlists?query=${q}&limit=${limit}`).then(resultsOf).catch(() => []),
    ]);
    return {
      songs,
      albums: albums.map(normalizeAlbum),
      artists: artists.map(normalizeArtist),
      playlists: playlists.map(normalizePlaylist),
    };
  },

  async searchSongs(query, limit = 20) {
    // Fetch a deeper pool than requested: on artists with a thin catalog on
    // this backend, the first ~12 results can be almost entirely karaoke/
    // tribute covers, which used to starve the filter below and trigger its
    // "don't return empty" fallback — showing 100% junk. Fetching more first
    // gives real tracks buried further down a chance to surface.
    const fetchLimit = Math.max(limit * 3, 30);
    const json = await request(`/api/search/songs?query=${encodeURIComponent(query)}&limit=${fetchLimit}`);
    const all = resultsOf(json).map(normalizeSong);
    return preferAuthentic(all).slice(0, limit);
  },

  async searchAlbums(query, limit = 10) {
    const json = await request(`/api/search/albums?query=${encodeURIComponent(query)}&limit=${limit}`);
    return resultsOf(json).map(normalizeAlbum);
  },

  async searchArtists(query, limit = 10) {
    const json = await request(`/api/search/artists?query=${encodeURIComponent(query)}&limit=${limit}`);
    return resultsOf(json).map(normalizeArtist);
  },

  async getSong(id) {
    const json = await request(`/api/songs/${encodeURIComponent(id)}`);
    const raw = Array.isArray(json.data) ? json.data[0] : json.data;
    return normalizeSong(raw);
  },

  async getSongLyrics(id) {
    try {
      const json = await request(`/api/songs/${encodeURIComponent(id)}/lyrics`, { retries: 0 });
      return json.data?.lyrics || null;
    } catch {
      return null;
    }
  },

  async recommendations(songId, limit = 12) {
    try {
      const json = await request(`/api/songs/${encodeURIComponent(songId)}/suggestions?limit=${limit}`, { retries: 1 });
      const arr = Array.isArray(json.data) ? json.data : [];
      return preferAuthentic(arr.map(normalizeSong));
    } catch {
      return [];
    }
  },

  async getAlbum(id) {
    const json = await requestFirstSuccess([
      `/api/albums?id=${encodeURIComponent(id)}`,
      `/api/albums/${encodeURIComponent(id)}`,
    ]);
    return normalizeAlbum(Array.isArray(json.data) ? json.data[0] : json.data);
  },

  async getArtist(id) {
    const json = await requestFirstSuccess([
      `/api/artists/${encodeURIComponent(id)}`,
      `/api/artists?id=${encodeURIComponent(id)}`,
    ]);
    const artist = normalizeArtist(Array.isArray(json.data) ? json.data[0] : json.data);
    // This API sometimes embeds topSongs/topAlbums directly, sometimes not —
    // fall back to the dedicated endpoints if they came back empty.
    if (!artist.topSongs.length) {
      try {
        const songsJson = await requestFirstSuccess([
          `/api/artists/${encodeURIComponent(id)}/songs?limit=12`,
          `/api/artists/songs?id=${encodeURIComponent(id)}&limit=12`,
        ]);
        artist.topSongs = preferAuthentic(resultsOf(songsJson).map(normalizeSong));
      } catch { /* leave empty */ }
    }
    // Last resort: the dedicated artist-songs endpoint convention on this
    // deployment is unconfirmed and may never succeed — search by the
    // artist's own name instead, since /api/search/songs is confirmed working.
    if (!artist.topSongs.length && artist.name) {
      try {
        artist.topSongs = await Api.searchSongs(artist.name, 12);
      } catch { /* leave empty */ }
    }
    if (!artist.albums.length) {
      try {
        const albumsJson = await requestFirstSuccess([
          `/api/artists/${encodeURIComponent(id)}/albums?limit=12`,
          `/api/artists/albums?id=${encodeURIComponent(id)}&limit=12`,
        ]);
        artist.albums = resultsOf(albumsJson).map(normalizeAlbum);
      } catch { /* leave empty */ }
    }
    if (!artist.albums.length && artist.name) {
      try {
        artist.albums = await Api.searchAlbums(artist.name, 12);
      } catch { /* leave empty */ }
    }
    return artist;
  },

  async getPlaylist(id) {
    const json = await requestFirstSuccess([
      `/api/playlists?id=${encodeURIComponent(id)}`,
      `/api/playlists/${encodeURIComponent(id)}`,
    ]);
    return normalizePlaylist(Array.isArray(json.data) ? json.data[0] : json.data);
  },
};

window.CT_Api = Api;
window.CT_ApiError = ApiError;
