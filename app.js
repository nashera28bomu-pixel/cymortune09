/**
 * CYMOR TUNE — Frontend Logic
 * Developer: Legendary Smiley Cymor
 * Idea by: Joyce, my best friend
 *
 * Architecture:
 * - Search: Cymor Tune backend /api/search
 * - Media resolving: Keith API
 * - Audio/video playback: direct resolved media URL
 * - Library/download history: localStorage
 */

'use strict';

/* ============================================================================
   CONFIGURATION
============================================================================ */

const CONFIG = {
  /*
   Your Cymor Tune backend.
   This backend should provide /api/search.

   Keep the Keith API behind your backend if possible.
  */
  BACKEND_URL: 'https://cymortune.onrender.com',

  /*
   Keith API.
   The API returns a JSON object containing:
   {
      status: true,
      creator: "KeithKeizzah",
      result: "https://....mp3"
   }
  */
  KEITH_API: 'https://apiskeith2-production-3020.up.railway.app',

  SEARCH_TIMEOUT: 20000,
  MEDIA_TIMEOUT: 30000
};

const api = (path) => `${CONFIG.BACKEND_URL}${path}`;


/* ============================================================================
   STORAGE
============================================================================ */

const KEYS = {
  LIBRARY: 'cymorTune.library',
  DOWNLOADS: 'cymorTune.downloads',
  SETTINGS: 'cymorTune.settings',
  THEME: 'cymorTune.theme'
};

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn('[Cymor Tune] Storage error:', err);
    }
  }
};

let library = store.get(KEYS.LIBRARY, []);
let downloads = store.get(KEYS.DOWNLOADS, []);

let settings = store.get(KEYS.SETTINGS, {
  theme: store.get(KEYS.THEME, 'dark')
});


/* ============================================================================
   GLOBAL STATE
============================================================================ */

let currentTrack = null;
let currentMediaUrl = null;
let searchController = null;
let mediaController = null;
let landingFinished = false;


/* ============================================================================
   HELPERS
============================================================================ */

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function sanitizeFilename(name) {
  return String(name || 'cymor-tune-track')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'cymor-tune-track';
}

function isYoutubeUrl(value) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/i.test(
    String(value || '').trim()
  );
}

function isDirectMediaUrl(url) {
  if (!url) return false;

  return /^https?:\/\//i.test(url);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function showToast(message) {
  const toast = document.getElementById('toast');

  if (!toast) {
    console.log('[Cymor Tune]', message);
    return;
  }

  toast.textContent = message;
  toast.classList.remove('hidden');

  clearTimeout(showToast._timer);

  showToast._timer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2800);
}


/* ============================================================================
   OVERLAY
============================================================================ */

function showOverlay(text = 'Working…') {
  const overlay = document.getElementById('overlay');
  const eq = document.getElementById('miniEq');
  const label = document.getElementById('overlayText');

  if (!overlay) return;

  if (eq) {
    eq.innerHTML = '';

    for (let i = 0; i < 7; i++) {
      const bar = document.createElement('span');
      eq.appendChild(bar);
    }
  }

  if (label) {
    label.textContent = text;
  }

  overlay.classList.remove('hidden');
}

function hideOverlay() {
  const overlay = document.getElementById('overlay');

  if (overlay) {
    overlay.classList.add('hidden');
  }
}


/* ============================================================================
   LANDING SCREEN
============================================================================ */

function spawnFallingNotes() {
  const field = document.getElementById('notesField');

  if (!field) return;

  field.innerHTML = '';

  const glyphs = ['♪', '♫', '♬', '♩'];

  for (let i = 0; i < 26; i++) {
    const note = document.createElement('span');

    note.className = 'falling-note';
    note.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];

    const size = 12 + Math.random() * 22;

    note.style.fontSize = `${size}px`;
    note.style.left = `${Math.random() * 100}%`;

    note.style.setProperty(
      '--drift',
      `${(Math.random() * 80 - 40).toFixed(0)}px`
    );

    note.style.animationDuration = `${6 + Math.random() * 8}s`;
    note.style.animationDelay = `${Math.random() * 6}s`;

    field.appendChild(note);
  }
}

function buildKeyLoader() {
  const row = document.getElementById('keysRow');

  if (!row) return;

  row.innerHTML = '';

  for (let i = 0; i < 22; i++) {
    const key = document.createElement('div');

    key.className = 'key bounce';

    key.style.setProperty(
      '--base-h',
      `${14 + Math.random() * 10}%`
    );

    key.style.setProperty(
      '--peak-h',
      `${40 + Math.random() * 45}%`
    );

    key.style.animationDelay = `${(i * 0.06).toFixed(2)}s`;

    row.appendChild(key);
  }
}


/*
   The old loader took 40 seconds.

   That is far too long for a real music application.

   Keep the premium animation but make it short.
*/

const LOAD_DURATION_MS = 2600;

const LOAD_LABELS = [
  'warming up the strings',
  'tuning the frequencies',
  'pressing the keys',
  'mixing the tracks',
  'ready to play'
];

function runLandingSequence() {
  const landing = document.getElementById('landing');

  if (!landing) {
    landingFinished = true;
    return;
  }

  spawnFallingNotes();
  buildKeyLoader();

  const percentEl = document.getElementById('loaderPercent');
  const labelEl = document.getElementById('loaderLabel');
  const loader = document.getElementById('keyLoader');

  const keys = Array.from(document.querySelectorAll('.key'));

  const startTime = performance.now();

  function tick(now) {
    if (landingFinished) return;

    const elapsed = now - startTime;

    const pct = Math.min(
      100,
      Math.floor((elapsed / LOAD_DURATION_MS) * 100)
    );

    if (percentEl) {
      percentEl.textContent =
        `${String(pct).padStart(2, '0')}%`;
    }

    if (loader) {
      loader.setAttribute(
        'aria-valuenow',
        String(pct)
      );
    }

    if (labelEl) {
      const index = Math.min(
        LOAD_LABELS.length - 1,
        Math.floor((pct / 100) * LOAD_LABELS.length)
      );

      labelEl.textContent = LOAD_LABELS[index];
    }

    const filledCount = Math.round(
      (pct / 100) * keys.length
    );

    keys.forEach((key, index) => {
      if (index < filledCount) {
        key.classList.add('filled');
        key.classList.remove('bounce');
      }
    });

    if (pct >= 100) {
      finishLanding();
      return;
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  const skip = document.getElementById('skipLoader');

  skip?.addEventListener('click', finishLanding, {
    once: true
  });
}

function finishLanding() {
  if (landingFinished) return;

  landingFinished = true;

  const landing = document.getElementById('landing');
  const app = document.getElementById('app');

  if (!landing || !app) return;

  landing.style.transition = 'opacity 0.45s ease';
  landing.style.opacity = '0';

  setTimeout(() => {
    landing.classList.add('hidden');
    app.classList.remove('hidden');
  }, 450);
}


/* ============================================================================
   NAVIGATION
============================================================================ */

function initNav() {
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.view;

      if (view) {
        switchView(view);
      }
    });
  });
}

function switchView(view) {
  document.querySelectorAll('.view').forEach((section) => {
    section.classList.remove('active-view');
  });

  const target = document.getElementById(`view-${view}`);

  if (target) {
    target.classList.add('active-view');
  }

  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.classList.toggle(
      'active',
      button.dataset.view === view
    );
  });

  if (view === 'downloads') {
    renderDownloads();
  }

  if (view === 'library') {
    renderLibrary();
  }
}


/* ============================================================================
   SEARCH
============================================================================ */

function initSearch() {
  const form = document.getElementById('searchForm');
  const input = document.getElementById('searchInput');

  if (!form || !input) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const query = input.value.trim();

    if (!query) return;

    await runSearch(query);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      input.blur();
    }
  });
}

async function runSearch(query) {
  if (searchController) {
    searchController.abort();
  }

  searchController = new AbortController();

  /*
     Direct YouTube URL:
     We don't need to search YouTube again.
  */

  if (isYoutubeUrl(query)) {
    const track = {
      title: 'YouTube video',
      url: query,
      thumbnail: '',
      duration: '',
      channel: 'YouTube'
    };

    renderResults([track]);

    return;
  }

  showOverlay('Searching the airwaves…');

  try {
    const timeout = setTimeout(
      () => searchController.abort(),
      CONFIG.SEARCH_TIMEOUT
    );

    const response = await fetch(
      api(`/api/search?q=${encodeURIComponent(query)}`),
      {
        signal: searchController.signal,
        headers: {
          Accept: 'application/json'
        }
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(
        `Search request failed with ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(
        data.error || 'Search failed.'
      );
    }

    renderResults(data.results || []);

  } catch (error) {
    if (error.name === 'AbortError') {
      return;
    }

    console.error('[SEARCH ERROR]', error);

    showToast(
      'Search failed. Please try again.'
    );

    renderResults([]);

  } finally {
    hideOverlay();
  }
}


/* ============================================================================
   SEARCH RESULTS
============================================================================ */

function renderResults(results) {
  const container =
    document.getElementById('homeContent');

  if (!container) return;

  container.innerHTML = '';

  if (!results.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-glyph">♫</span>
        <p>No tracks found. Try another song, artist, or YouTube link.</p>
      </div>
    `;

    return;
  }

  const fragment = document.createDocumentFragment();

  results.forEach((track) => {
    fragment.appendChild(
      buildTrackCard(track)
    );
  });

  container.appendChild(fragment);
}


/* ============================================================================
   TRACK CARD
============================================================================ */

function buildTrackCard(track) {
  const card = document.createElement('article');

  card.className = 'track-card';

  const isSaved = library.some(
    (item) => item.url === track.url
  );

  const safeThumbnail =
    track.thumbnail || '';

  card.innerHTML = `
    <img
      class="track-thumb"
      src="${escapeHtml(safeThumbnail)}"
      alt=""
      loading="lazy"
      onerror="this.style.visibility='hidden'"
    />

    <div class="track-body">

      <p class="track-title">
        ${escapeHtml(track.title || 'Unknown title')}
      </p>

      <p class="track-sub">
        ${escapeHtml(track.channel || 'Unknown artist')}
        ${
          track.duration
            ? ` · ${escapeHtml(String(track.duration))}`
            : ''
        }
      </p>

      <div class="track-actions">

        <button
          class="pill-btn primary"
          data-action="play-audio"
          type="button"
        >
          ▶ Play
        </button>

        <button
          class="pill-btn"
          data-action="download-mp3"
          type="button"
        >
          ↓ MP3
        </button>

        <button
          class="pill-btn"
          data-action="download-mp4"
          type="button"
        >
          ↓ MP4
        </button>

        <button
          class="pill-btn heart ${isSaved ? 'active' : ''}"
          data-action="save"
          type="button"
          aria-label="Save track"
        >
          ♥
        </button>

      </div>
    </div>
  `;

  card
    .querySelector('[data-action="play-audio"]')
    ?.addEventListener('click', () => {
      playAudio(track);
    });

  card
    .querySelector('[data-action="download-mp3"]')
    ?.addEventListener('click', () => {
      downloadTrack(track, 'audio');
    });

  card
    .querySelector('[data-action="download-mp4"]')
    ?.addEventListener('click', () => {
      downloadTrack(track, 'video');
    });

  card
    .querySelector('[data-action="save"]')
    ?.addEventListener('click', (event) => {
      toggleSave(track, event.currentTarget);
    });

  return card;
}


/* ============================================================================
   KEITH API
============================================================================ */

/*
   Resolve an MP3 or MP4.

   Keith API endpoints:

   /download/audio?url=YOUTUBE_URL
   /download/video?url=YOUTUBE_URL
*/

async function resolveMedia(type, youtubeUrl) {
  const endpoint =
    type === 'audio'
      ? '/download/audio'
      : '/download/video';

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    CONFIG.MEDIA_TIMEOUT
  );

  try {
    const response = await fetch(
      `${CONFIG.KEITH_API}${endpoint}?url=${encodeURIComponent(youtubeUrl)}`,
      {
        signal: controller.signal,
        headers: {
          Accept: 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Keith API returned ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.status || !data.result) {
      throw new Error(
        data.message ||
        'Keith API did not return a media URL.'
      );
    }

    return data.result;

  } finally {
    clearTimeout(timeout);
  }
}


/* ============================================================================
   AUDIO PLAYER
============================================================================ */

async function playAudio(track) {
  const sheet =
    document.getElementById('playerSheet');

  const audio =
    document.getElementById('audioEl');

  if (!sheet || !audio) return;

  /*
     Stop previous request.
  */

  if (mediaController) {
    mediaController.abort();
  }

  mediaController = new AbortController();

  currentTrack = track;

  const playerThumb =
    document.getElementById('playerThumb');

  const playerTitle =
    document.getElementById('playerTitle');

  const playerChannel =
    document.getElementById('playerChannel');

  if (playerThumb) {
    playerThumb.src =
      track.thumbnail || '';
  }

  if (playerTitle) {
    playerTitle.textContent =
      track.title || 'Unknown title';
  }

  if (playerChannel) {
    playerChannel.textContent =
      track.channel || 'Cymor Tune';
  }

  /*
     Show player immediately.

     This is intentionally NOT using the giant loading overlay.
     The player can display while Keith resolves the media.
  */

  sheet.classList.remove('hidden');

  audio.pause();
  audio.removeAttribute('src');
  audio.load();

  showPlayerLoadingState(true);

  try {
    const mediaUrl =
      await resolveMedia(
        'audio',
        track.url
      );

    currentMediaUrl = mediaUrl;

    audio.src = mediaUrl;

    audio.load();

    showPlayerLoadingState(false);

    try {
      await audio.play();
    } catch {
      showToast(
        'Tap play to start playback.'
      );
    }

  } catch (error) {
    console.error(
      '[AUDIO RESOLVE ERROR]',
      error
    );

    showPlayerLoadingState(false);

    showToast(
      'Unable to prepare this track.'
    );

    closeAudioPlayer();
  }
}

function showPlayerLoadingState(isLoading) {
  const sheet =
    document.getElementById('playerSheet');

  if (!sheet) return;

  sheet.classList.toggle(
    'player-loading',
    isLoading
  );
}


/* ============================================================================
   VIDEO PLAYER
============================================================================ */

/*
   The original index only contained an <audio> player.

   We create a premium video player dynamically when MP4 streaming
   is requested.
*/

function createVideoPlayer() {
  let videoSheet =
    document.getElementById('videoPlayerSheet');

  if (videoSheet) {
    return videoSheet;
  }

  videoSheet =
    document.createElement('div');

  videoSheet.id =
    'videoPlayerSheet';

  videoSheet.className =
    'video-player-sheet hidden';

  videoSheet.innerHTML = `
    <div class="video-player-backdrop"></div>

    <div class="video-player-card">

      <div class="video-player-header">
        <div>
          <p class="video-player-title">
            Cymor Tune
          </p>
          <p
            id="videoPlayerChannel"
            class="video-player-channel"
          >
            Now streaming
          </p>
        </div>

        <button
          id="videoPlayerClose"
          class="video-player-close"
          type="button"
          aria-label="Close video"
        >
          ×
        </button>
      </div>

      <video
        id="videoEl"
        controls
        playsinline
        preload="metadata"
      ></video>

      <div class="video-player-meta">
        <img
          id="videoPlayerThumb"
          alt=""
        />

        <div>
          <p
            id="videoPlayerTitle"
            class="video-meta-title"
          >
            Loading…
          </p>

          <p class="video-meta-sub">
            Cymor Tune
          </p>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(videoSheet);

  videoSheet
    .querySelector('#videoPlayerClose')
    ?.addEventListener('click', closeVideoPlayer);

  videoSheet
    .querySelector('.video-player-backdrop')
    ?.addEventListener('click', closeVideoPlayer);

  return videoSheet;
}

async function playVideo(track) {
  const sheet =
    createVideoPlayer();

  const video =
    document.getElementById('videoEl');

  if (!video) return;

  currentTrack = track;

  document.getElementById(
    'videoPlayerTitle'
  ).textContent =
    track.title || 'Unknown title';

  document.getElementById(
    'videoPlayerChannel'
  ).textContent =
    track.channel || 'Now streaming';

  const thumb =
    document.getElementById(
      'videoPlayerThumb'
    );

  if (thumb) {
    thumb.src =
      track.thumbnail || '';
  }

  sheet.classList.remove('hidden');

  video.pause();
  video.removeAttribute('src');
  video.load();

  /*
     Small local loading indicator rather than the
     full-screen search/download overlay.
  */

  sheet.classList.add('loading');

  try {
    const mediaUrl =
      await resolveMedia(
        'video',
        track.url
      );

    currentMediaUrl = mediaUrl;

    video.src = mediaUrl;
    video.load();

    sheet.classList.remove('loading');

    try {
      await video.play();
    } catch {
      showToast(
        'Video ready. Tap play to start.'
      );
    }

  } catch (error) {
    console.error(
      '[VIDEO RESOLVE ERROR]',
      error
    );

    sheet.classList.remove('loading');

    showToast(
      'Unable to prepare the video.'
    );

    closeVideoPlayer();
  }
}

function closeVideoPlayer() {
  const sheet =
    document.getElementById(
      'videoPlayerSheet'
    );

  const video =
    document.getElementById('videoEl');

  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }

  sheet?.classList.add('hidden');
}


/* ============================================================================
   DOWNLOADS
============================================================================ */

async function downloadTrack(track, type) {
  const label =
    type === 'audio'
      ? 'MP3'
      : 'MP4';

  showOverlay(
    `Preparing ${label}…`
  );

  try {
    const mediaUrl =
      await resolveMedia(
        type,
        track.url
      );

    if (!isDirectMediaUrl(mediaUrl)) {
      throw new Error(
        'Invalid media URL returned by provider.'
      );
    }

    /*
       IMPORTANT:

       Keith returns a CDN URL.

       Fetching the entire file through the browser as a Blob
       can be slow for large MP4 files and can fail if the CDN
       does not allow browser CORS.

       We therefore use a direct download navigation first.
    */

    const filename =
      `${sanitizeFilename(track.title)}.${type === 'audio' ? 'mp3' : 'mp4'}`;

    const downloadLink =
      document.createElement('a');

    downloadLink.href = mediaUrl;
    downloadLink.download = filename;
    downloadLink.target = '_blank';
    downloadLink.rel = 'noopener';

    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();

    /*
       Store download history.

       This does NOT store the actual media file.
       It stores the track information for the Downloads page.
    */

    const entry = {
      ...track,
      type,
      mediaUrl,
      filename,
      downloadedAt: Date.now()
    };

    downloads.unshift(entry);

    /*
       Avoid unlimited localStorage growth.
    */

    downloads =
      downloads.slice(0, 100);

    store.set(
      KEYS.DOWNLOADS,
      downloads
    );

    showToast(
      `${label} download started.`
    );

  } catch (error) {
    console.error(
      '[DOWNLOAD ERROR]',
      error
    );

    showToast(
      `Could not prepare ${label}. Try again.`
    );

  } finally {
    hideOverlay();
  }
}


/* ============================================================================
   DOWNLOAD HISTORY
============================================================================ */

function renderDownloads() {
  const container =
    document.getElementById(
      'downloadsList'
    );

  if (!container) return;

  container.innerHTML = '';

  if (!downloads.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-glyph">⬇</span>

        <p>
          Nothing downloaded yet.
          Your downloaded tracks will appear here.
        </p>
      </div>
    `;

    return;
  }

  const fragment =
    document.createDocumentFragment();

  downloads.forEach((item) => {
    const card =
      document.createElement('article');

    card.className =
      'track-card';

    const typeLabel =
      item.type === 'audio'
        ? 'MP3'
        : 'MP4';

    card.innerHTML = `
      <img
        class="track-thumb"
        src="${escapeHtml(item.thumbnail || '')}"
        alt=""
        loading="lazy"
        onerror="this.style.visibility='hidden'"
      />

      <div class="track-body">

        <p class="track-title">
          ${escapeHtml(item.title || 'Unknown title')}
        </p>

        <p class="track-sub">
          ${escapeHtml(item.channel || 'Unknown artist')}
          · ${typeLabel}
        </p>

        <div class="track-actions">

          <button
            class="pill-btn primary"
            data-action="history-play"
            type="button"
          >
            ▶ Play
          </button>

          <button
            class="pill-btn"
            data-action="history-download"
            type="button"
          >
            ↓ Again
          </button>

        </div>

      </div>
    `;

    card
      .querySelector(
        '[data-action="history-play"]'
      )
      ?.addEventListener(
        'click',
        () => {
          if (item.type === 'audio') {
            playAudio(item);
          } else {
            playVideo(item);
          }
        }
      );

    card
      .querySelector(
        '[data-action="history-download"]'
      )
      ?.addEventListener(
        'click',
        () => {
          downloadTrack(
            item,
            item.type
          );
        }
      );

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}


/* ============================================================================
   LIBRARY
============================================================================ */

function toggleSave(track, button) {
  const index =
    library.findIndex(
      (item) => item.url === track.url
    );

  if (index >= 0) {
    library.splice(index, 1);

    button.classList.remove(
      'active'
    );

    showToast(
      'Removed from your library.'
    );

  } else {
    library.unshift(track);

    library =
      library.slice(0, 200);

    button.classList.add(
      'active'
    );

    showToast(
      'Added to your library.'
    );
  }

  store.set(
    KEYS.LIBRARY,
    library
  );
}

function renderLibrary() {
  const container =
    document.getElementById(
      'libraryList'
    );

  if (!container) return;

  container.innerHTML = '';

  if (!library.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-glyph">♥</span>

        <p>
          Your library is empty.
          Save songs you love and they'll appear here.
        </p>
      </div>
    `;

    return;
  }

  const fragment =
    document.createDocumentFragment();

  library.forEach((track) => {
    fragment.appendChild(
      buildTrackCard(track)
    );
  });

  container.appendChild(fragment);
}


/* ============================================================================
   THEME SYSTEM
============================================================================ */

/*
   Supports:

   - dark
   - light
   - system

   The new Settings page can expose buttons/selects using:

   data-theme="dark"
   data-theme="light"
   data-theme="system"

   This makes the JS flexible with your new index.html.
*/

function getPreferredTheme() {
  const saved =
    store.get(
      KEYS.THEME,
      settings.theme || 'dark'
    );

  return saved || 'dark';
}

function applyTheme(theme) {
  if (!['dark', 'light', 'system'].includes(theme)) {
    theme = 'dark';
  }

  settings.theme = theme;

  store.set(
    KEYS.SETTINGS,
    settings
  );

  store.set(
    KEYS.THEME,
    theme
  );

  const root =
    document.documentElement;

  if (theme === 'system') {
    root.removeAttribute(
      'data-theme'
    );
  } else {
    root.setAttribute(
      'data-theme',
      theme
    );
  }

  /*
     Update browser theme color.
  */

  const meta =
    document.querySelector(
      'meta[name="theme-color"]'
    );

  if (meta) {
    meta.setAttribute(
      'content',
      theme === 'light'
        ? '#F7F7FA'
        : '#0A0910'
    );
  }

  /*
     Update active theme buttons.
  */

  document
    .querySelectorAll('[data-theme]')
    .forEach((button) => {
      button.classList.toggle(
        'active',
        button.dataset.theme === theme
      );
    });
}

function initTheme() {
  const currentTheme =
    getPreferredTheme();

  applyTheme(currentTheme);

  document
    .querySelectorAll('[data-theme]')
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          applyTheme(
            button.dataset.theme
          );
        }
      );
    });
}


/* ============================================================================
   AUDIO PLAYER CONTROLS
============================================================================ */

function closeAudioPlayer() {
  const audio =
    document.getElementById('audioEl');

  const sheet =
    document.getElementById(
      'playerSheet'
    );

  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }

  currentMediaUrl = null;

  sheet?.classList.add('hidden');
}

function initAudioPlayer() {
  const audio =
    document.getElementById('audioEl');

  const close =
    document.getElementById(
      'playerClose'
    );

  if (!audio) return;

  close?.addEventListener(
    'click',
    closeAudioPlayer
  );

  audio.addEventListener(
    'error',
    () => {
      console.error(
        '[PLAYER ERROR]',
        audio.error
      );

      showToast(
        'Playback failed. Please try again.'
      );
    }
  );

  audio.addEventListener(
    'playing',
    () => {
      showPlayerLoadingState(false);
    }
  );

  audio.addEventListener(
    'waiting',
    () => {
      showPlayerLoadingState(true);
    }
  );

  audio.addEventListener(
    'canplay',
    () => {
      showPlayerLoadingState(false);
    }
  );
}


/* ============================================================================
   KEYBOARD / ESCAPE
============================================================================ */

function initGlobalKeyboard() {
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return;

      closeAudioPlayer();
      closeVideoPlayer();

      document
        .querySelectorAll(
          '.quality-dropdown'
        )
        .forEach(
          (element) => element.remove()
        );
    }
  );
}


/* ============================================================================
   SERVICE WORKER
============================================================================ */

function registerServiceWorker() {
  if (
    'serviceWorker' in navigator
  ) {
    navigator.serviceWorker
      .register('sw.js')
      .catch((error) => {
        console.warn(
          '[Cymor Tune] Service worker registration failed:',
          error
        );
      });
  }
}


/* ============================================================================
   CONNECTION CHECK
============================================================================ */

async function checkBackend() {
  try {
    const response =
      await fetch(
        api('/health'),
        {
          method: 'GET',
          cache: 'no-store'
        }
      );

    if (!response.ok) {
      throw new Error(
        `Backend returned ${response.status}`
      );
    }

    console.log(
      '[Cymor Tune] Backend online.'
    );

  } catch (error) {
    console.warn(
      '[Cymor Tune] Backend health check failed:',
      error.message
    );
  }
}


/* ============================================================================
   INITIALIZATION
============================================================================ */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    /*
       Apply theme immediately so the UI doesn't flash
       the wrong theme.
    */

    initTheme();

    /*
       Premium landing screen.
    */

    runLandingSequence();

    /*
       Navigation.
    */

    initNav();

    /*
       Search.
    */

    initSearch();

    /*
       Audio player.
    */

    initAudioPlayer();

    /*
       Keyboard shortcuts.
    */

    initGlobalKeyboard();

    /*
       PWA.
    */

    registerServiceWorker();

    /*
       Backend availability check.
       Doesn't block the application.
    */

    checkBackend();

    /*
       Initial views.
    */

    renderDownloads();
    renderLibrary();

    console.log(
      '%cCymor Tune',
      'font-size:20px;font-weight:bold'
    );

    console.log(
      'Powered by Cymor Tech Services.'
    );

    console.log(
      'Developer: Legendary Smiley Cymor'
    );

    console.log(
      'Idea by: Joyce, my best friend'
    );
  }
);
