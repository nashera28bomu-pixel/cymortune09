/**
 * CYMOR TUNE — Frontend Application
 * Developer: Legendary Smiley Cymor
 * Idea by: Joyce
 *
 * Architecture:
 *
 * FRONTEND
 *    ↓
 * CYMOR TUNE BACKEND
 *    ↓
 * KEITH API
 *    ↓
 * MEDIA CDN
 *
 * The browser NEVER talks directly to Keith.
 */

'use strict';

/* ============================================================================
   CONFIGURATION
============================================================================ */

const CONFIG = {
  /*
   * IMPORTANT:
   * This must match your deployed backend.
   *
   * Your backend server.js provides:
   *
   * /health
   * /api/search
   * /api/resolve
   * /api/stream
   * /api/download
   */

  BACKEND_URL: 'https://cymortuneapi.onrender.com',

  SEARCH_TIMEOUT: 15000,
  RESOLVE_TIMEOUT: 30000,

  MAX_LIBRARY_ITEMS: 200,
  MAX_DOWNLOAD_ITEMS: 100
};

const api = (path) => {
  return `${CONFIG.BACKEND_URL}${path}`;
};


/* ============================================================================
   STORAGE
============================================================================ */

const STORAGE_KEYS = {
  LIBRARY: 'cymorTune.library',
  DOWNLOADS: 'cymorTune.downloads',
  SETTINGS: 'cymorTune.settings',
  THEME: 'cymorTune.theme'
};

const store = {

  get(key, fallback) {

    try {

      const value = localStorage.getItem(key);

      if (!value) {
        return fallback;
      }

      return JSON.parse(value);

    } catch (error) {

      console.warn(
        '[Cymor Tune] Storage read error:',
        error
      );

      return fallback;
    }
  },

  set(key, value) {

    try {

      localStorage.setItem(
        key,
        JSON.stringify(value)
      );

    } catch (error) {

      console.warn(
        '[Cymor Tune] Storage write error:',
        error
      );
    }
  }

};


let library =
  store.get(
    STORAGE_KEYS.LIBRARY,
    []
  );

let downloads =
  store.get(
    STORAGE_KEYS.DOWNLOADS,
    []
  );

let settings =
  store.get(
    STORAGE_KEYS.SETTINGS,
    {
      theme:
        store.get(
          STORAGE_KEYS.THEME,
          'dark'
        )
    }
  );


/* ============================================================================
   GLOBAL STATE
============================================================================ */

const state = {

  currentTrack: null,

  currentType: null,

  currentMediaUrl: null,

  currentIndex: -1,

  searchController: null,

  mediaController: null,

  searchResults: [],

  audioLoading: false,

  videoLoading: false,

  landingFinished: false

};


/* ============================================================================
   DOM HELPERS
============================================================================ */

const $ = (selector, root = document) => {
  return root.querySelector(selector);
};


const $$ = (selector, root = document) => {
  return Array.from(
    root.querySelectorAll(selector)
  );
};


/* ============================================================================
   GENERAL HELPERS
============================================================================ */

function escapeHtml(value) {

  const div =
    document.createElement('div');

  div.textContent =
    value ?? '';

  return div.innerHTML;
}


function sanitizeFilename(name) {

  return String(
    name ||
    'cymor-tune-track'
  )

    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      ''
    )

    .replace(
      /\s+/g,
      ' '
    )

    .trim()

    .slice(
      0,
      120
    )

    ||
    'cymor-tune-track';
}


function isYoutubeUrl(value) {

  return /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/i
    .test(
      String(value || '').trim()
    );
}


function normalizeYoutubeUrl(value) {

  const input =
    String(value || '').trim();

  if (!input) {
    return '';
  }

  if (/^youtu\.be\//i.test(input)) {
    return `https://${input}`;
  }

  if (/^youtube\.com\//i.test(input)) {
    return `https://www.${input}`;
  }

  return input;
}


function formatTime(seconds) {

  if (
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return '0:00';
  }

  const mins =
    Math.floor(
      seconds / 60
    );

  const secs =
    Math.floor(
      seconds % 60
    );

  return `${mins}:${String(
    secs
  ).padStart(2, '0')}`;
}


function formatDate(timestamp) {

  if (!timestamp) {
    return '';
  }

  try {

    return new Date(
      timestamp
    ).toLocaleDateString(
      undefined,
      {
        month: 'short',
        day: 'numeric'
      }
    );

  } catch {

    return '';
  }
}


function isValidHttpUrl(url) {

  return /^https?:\/\//i.test(
    String(url || '')
  );
}


/* ============================================================================
   TOAST
============================================================================ */

function showToast(message) {

  const toast =
    $('#toast');

  if (!toast) {

    console.log(
      '[Cymor Tune]',
      message
    );

    return;
  }

  toast.textContent =
    message;

  toast.classList.remove(
    'hidden'
  );

  clearTimeout(
    showToast.timer
  );

  showToast.timer =
    setTimeout(
      () => {

        toast.classList.add(
          'hidden'
        );

      },
      2800
    );
}


/* ============================================================================
   LOADING OVERLAY
============================================================================ */

function showOverlay(
  text = 'Working…'
) {

  const overlay =
    $('#overlay');

  const eq =
    $('#miniEq');

  const label =
    $('#overlayText');

  if (!overlay) {
    return;
  }

  if (eq) {

    eq.innerHTML = '';

    for (
      let i = 0;
      i < 7;
      i++
    ) {

      const bar =
        document.createElement(
          'span'
        );

      eq.appendChild(
        bar
      );
    }
  }

  if (label) {
    label.textContent =
      text;
  }

  overlay.classList.remove(
    'hidden'
  );
}


function hideOverlay() {

  const overlay =
    $('#overlay');

  overlay?.classList.add(
    'hidden'
  );
}


/* ============================================================================
   LANDING SCREEN
============================================================================ */

function spawnFallingNotes() {

  const field =
    $('#notesField');

  if (!field) {
    return;
  }

  field.innerHTML = '';

  const glyphs = [
    '♪',
    '♫',
    '♬',
    '♩'
  ];

  for (
    let i = 0;
    i < 26;
    i++
  ) {

    const note =
      document.createElement(
        'span'
      );

    note.className =
      'falling-note';

    note.textContent =
      glyphs[
        Math.floor(
          Math.random() *
          glyphs.length
        )
      ];

    note.style.fontSize =
      `${12 + Math.random() * 22}px`;

    note.style.left =
      `${Math.random() * 100}%`;

    note.style.setProperty(
      '--drift',
      `${Math.round(
        Math.random() * 80 - 40
      )}px`
    );

    note.style.animationDuration =
      `${6 + Math.random() * 8}s`;

    note.style.animationDelay =
      `${Math.random() * 6}s`;

    field.appendChild(
      note
    );
  }
}


function buildKeyLoader() {

  const row =
    $('#keysRow');

  if (!row) {
    return;
  }

  row.innerHTML = '';

  for (
    let i = 0;
    i < 22;
    i++
  ) {

    const key =
      document.createElement(
        'div'
      );

    key.className =
      'key bounce';

    key.style.setProperty(
      '--base-h',
      `${14 + Math.random() * 10}%`
    );

    key.style.setProperty(
      '--peak-h',
      `${40 + Math.random() * 45}%`
    );

    key.style.animationDelay =
      `${i * 0.06}s`;

    row.appendChild(
      key
    );
  }
}


const LOAD_DURATION_MS =
  1400;


const LOAD_LABELS = [
  'warming up the strings',
  'tuning the frequencies',
  'pressing the keys',
  'mixing the tracks',
  'ready to play'
];


function runLandingSequence() {

  const landing =
    $('#landing');

  if (!landing) {

    state.landingFinished =
      true;

    return;
  }

  spawnFallingNotes();

  buildKeyLoader();

  const percent =
    $('#loaderPercent');

  const label =
    $('#loaderLabel');

  const loader =
    $('#keyLoader');

  const keys =
    $$('.key');

  const started =
    performance.now();

  function tick(now) {

    if (
      state.landingFinished
    ) {
      return;
    }

    const elapsed =
      now - started;

    const progress =
      Math.min(
        100,
        Math.floor(
          elapsed /
          LOAD_DURATION_MS *
          100
        )
      );

    if (percent) {

      percent.textContent =
        `${String(
          progress
        ).padStart(
          2,
          '0'
        )}%`;
    }

    if (loader) {

      loader.setAttribute(
        'aria-valuenow',
        String(progress)
      );
    }

    if (label) {

      const index =
        Math.min(
          LOAD_LABELS.length - 1,
          Math.floor(
            progress /
            100 *
            LOAD_LABELS.length
          )
        );

      label.textContent =
        LOAD_LABELS[index];
    }

    const filled =
      Math.round(
        progress /
        100 *
        keys.length
      );

    keys.forEach(
      (key, index) => {

        if (
          index <
          filled
        ) {

          key.classList.add(
            'filled'
          );

          key.classList.remove(
            'bounce'
          );
        }
      }
    );

    if (
      progress >= 100
    ) {

      finishLanding();

      return;
    }

    requestAnimationFrame(
      tick
    );
  }

  requestAnimationFrame(
    tick
  );

  $('#skipLoader')
    ?.addEventListener(
      'click',
      finishLanding,
      {
        once: true
      }
    );
}


function finishLanding() {

  if (
    state.landingFinished
  ) {
    return;
  }

  state.landingFinished =
    true;

  const landing =
    $('#landing');

  const app =
    $('#app');

  if (!landing || !app) {
    return;
  }

  landing.style.transition =
    'opacity .35s ease';

  landing.style.opacity =
    '0';

  setTimeout(
    () => {

      landing.classList.add(
        'hidden'
      );

      app.classList.remove(
        'hidden'
      );

    },
    350
  );
}


/* ============================================================================
   NAVIGATION
============================================================================ */

function initNavigation() {

  $$('.nav-btn')
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            const view =
              button.dataset.view;

            if (view) {
              switchView(view);
            }
          }
        );
      }
    );
}


function switchView(view) {

  $$('.view')
    .forEach(
      section => {

        section.classList.remove(
          'active-view'
        );
      }
    );

  const target =
    $(`#view-${view}`);

  target?.classList.add(
    'active-view'
  );

  $$('.nav-btn')
    .forEach(
      button => {

        button.classList.toggle(
          'active',
          button.dataset.view === view
        );
      }
    );

  if (
    view === 'downloads'
  ) {

    renderDownloads();
  }

  if (
    view === 'library'
  ) {

    renderLibrary();
  }
}


/* ============================================================================
   SEARCH
============================================================================ */

function initSearch() {

  const form =
    $('#searchForm');

  const input =
    $('#searchInput');

  if (!form || !input) {
    return;
  }

  form.addEventListener(
    'submit',
    async event => {

      event.preventDefault();

      const query =
        input.value.trim();

      if (!query) {
        return;
      }

      await runSearch(
        query
      );
    }
  );


  input.addEventListener(
    'keydown',
    event => {

      if (
        event.key === 'Escape'
      ) {

        input.value = '';

        input.blur();
      }
    }
  );
}


async function runSearch(query) {

  if (
    state.searchController
  ) {

    state.searchController.abort();
  }

  const controller =
    new AbortController();

  state.searchController =
    controller;

  const timeout =
    setTimeout(
      () => controller.abort(),
      CONFIG.SEARCH_TIMEOUT
    );


  const normalized =
    normalizeYoutubeUrl(
      query
    );


  /*
   * Direct YouTube link.
   *
   * Do NOT send it to search.
   * The backend already knows how to resolve it.
   */

  if (
    isYoutubeUrl(normalized)
  ) {

    clearTimeout(timeout);

    const track = {
      id: extractYoutubeId(
        normalized
      ),

      title:
        'YouTube video',

      url:
        normalized,

      thumbnail:
        youtubeThumbnail(
          normalized
        ),

      duration:
        '',

      channel:
        'YouTube',

      type:
        'video'
    };

    state.searchResults =
      [track];

    renderResults(
      [track]
    );

    return;
  }


  showOverlay(
    'Searching…'
  );


  try {

    const response =
      await fetch(
        api(
          `/api/search?q=${encodeURIComponent(
            query
          )}`
        ),
        {
          method: 'GET',

          signal:
            controller.signal,

          headers: {
            Accept:
              'application/json'
          },

          cache:
            'no-store'
        }
      );


    if (!response.ok) {

      throw new Error(
        `Search failed with HTTP ${response.status}`
      );
    }


    const data =
      await response.json();


    if (
      !data.success
    ) {

      throw new Error(
        data.error ||
        'Search failed.'
      );
    }


    const results =
      Array.isArray(
        data.results
      )
        ? data.results
        : [];


    state.searchResults =
      results;


    renderResults(
      results
    );


  } catch (error) {

    if (
      error.name ===
      'AbortError'
    ) {
      return;
    }

    console.error(
      '[SEARCH ERROR]',
      error
    );

    showToast(
      'Search failed. Try again.'
    );

    renderResults(
      []
    );

  } finally {

    clearTimeout(
      timeout
    );

    if (
      state.searchController ===
      controller
    ) {

      state.searchController =
        null;
    }

    hideOverlay();
  }
}


/* ============================================================================
   YOUTUBE HELPERS
============================================================================ */

function extractYoutubeId(url) {

  const value =
    String(url || '');

  const patterns = [

    /[?&]v=([^&#]+)/i,

    /youtu\.be\/([^?&#/]+)/i,

    /youtube\.com\/shorts\/([^?&#/]+)/i

  ];

  for (
    const pattern of patterns
  ) {

    const match =
      value.match(
        pattern
      );

    if (
      match?.[1]
    ) {

      return match[1];
    }
  }

  return '';
}


function youtubeThumbnail(url) {

  const id =
    extractYoutubeId(
      url
    );

  if (!id) {
    return '';
  }

  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}


/* ============================================================================
   SEARCH RESULT RENDERING
============================================================================ */

function renderResults(results) {

  const container =
    $('#homeContent');

  if (!container) {
    return;
  }

  container.innerHTML =
    '';


  if (
    !results.length
  ) {

    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-glyph">♫</span>

        <p>
          No tracks found.
          Try another song, artist, or YouTube link.
        </p>
      </div>
    `;

    return;
  }


  const fragment =
    document.createDocumentFragment();


  results.forEach(
    (track, index) => {

      fragment.appendChild(
        buildTrackCard(
          track,
          index
        )
      );
    }
  );


  container.appendChild(
    fragment
  );
}


/* ============================================================================
   TRACK CARD
============================================================================ */

function buildTrackCard(
  track,
  index = -1
) {

  const card =
    document.createElement(
      'article'
    );

  card.className =
    'track-card';


  const saved =
    library.some(
      item =>
        item.url ===
        track.url
    );


  const title =
    track.title ||
    'Unknown title';


  const channel =
    track.channel ||
    'Unknown artist';


  const duration =
    track.duration ||
    '';


  card.innerHTML = `

    <img
      class="track-thumb"
      src="${escapeHtml(
        track.thumbnail || ''
      )}"
      alt=""
      loading="lazy"
      onerror="this.style.visibility='hidden'"
    >

    <div class="track-body">

      <p class="track-title">
        ${escapeHtml(title)}
      </p>

      <p class="track-sub">
        ${escapeHtml(channel)}
        ${duration
          ? ` · ${escapeHtml(
              String(duration)
            )}`
          : ''
        }
      </p>

      <div class="track-actions">

        <button
          class="pill-btn primary"
          data-action="audio"
          type="button"
        >
          ▶ MP3
        </button>

        <button
          class="pill-btn"
          data-action="video"
          type="button"
        >
          ▶ MP4
        </button>

        <button
          class="pill-btn"
          data-action="download-audio"
          type="button"
        >
          ↓ MP3
        </button>

        <button
          class="pill-btn"
          data-action="download-video"
          type="button"
        >
          ↓ MP4
        </button>

        <button
          class="pill-btn heart ${
            saved ? 'active' : ''
          }"
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
    .querySelector(
      '[data-action="audio"]'
    )
    ?.addEventListener(
      'click',
      () => {

        playAudio(
          track,
          index
        );
      }
    );


  card
    .querySelector(
      '[data-action="video"]'
    )
    ?.addEventListener(
      'click',
      () => {

        playVideo(
          track
        );
      }
    );


  card
    .querySelector(
      '[data-action="download-audio"]'
    )
    ?.addEventListener(
      'click',
      () => {

        downloadTrack(
          track,
          'audio'
        );
      }
    );


  card
    .querySelector(
      '[data-action="download-video"]'
    )
    ?.addEventListener(
      'click',
      () => {

        downloadTrack(
          track,
          'video'
        );
      }
    );


  card
    .querySelector(
      '[data-action="save"]'
    )
    ?.addEventListener(
      'click',
      event => {

        toggleSave(
          track,
          event.currentTarget
        );
      }
    );


  return card;
}


/* ============================================================================
   BACKEND MEDIA RESOLUTION
============================================================================ */

/*
 * IMPORTANT:
 *
 * The frontend does NOT call:
 *
 * https://apiskeith2-production-3020.up.railway.app
 *
 * anymore.
 *
 * It calls:
 *
 * /api/resolve
 *
 * on Cymor Tune.
 */

async function resolveMedia(
  type,
  youtubeUrl,
  signal = null
) {

  if (
    !['audio', 'video'].includes(
      type
    )
  ) {

    throw new Error(
      'Invalid media type.'
    );
  }


  if (
    !isYoutubeUrl(
      youtubeUrl
    )
  ) {

    throw new Error(
      'A valid YouTube URL is required.'
    );
  }


  const controller =
    signal
      ? null
      : new AbortController();


  const requestSignal =
    signal ||
    controller.signal;


  const timeout =
    controller
      ? setTimeout(
          () =>
            controller.abort(),
          CONFIG.RESOLVE_TIMEOUT
        )
      : null;


  try {

    const endpoint =
      api(
        `/api/resolve?type=${encodeURIComponent(
          type
        )}&url=${encodeURIComponent(
          youtubeUrl
        )}`
      );


    const response =
      await fetch(
        endpoint,
        {
          method: 'GET',

          signal:
            requestSignal,

          headers: {
            Accept:
              'application/json'
          },

          cache:
            'no-store'
        }
      );


    if (!response.ok) {

      let details = '';

      try {

        const body =
          await response.json();

        details =
          body.details ||
          body.error ||
          '';

      } catch {}

      throw new Error(
        details ||
        `Media resolution failed with HTTP ${response.status}`
      );
    }


    const data =
      await response.json();


    if (
      !data.success ||
      !data.url
    ) {

      throw new Error(
        data.error ||
        'Backend did not return a media URL.'
      );
    }


    return data.url;

  } finally {

    if (timeout) {
      clearTimeout(timeout);
    }
  }
}


/* ============================================================================
   BACKEND STREAM URL
============================================================================ */

function getStreamUrl(
  type,
  track
) {

  return api(
    `/api/stream?type=${encodeURIComponent(
      type
    )}&url=${encodeURIComponent(
      track.url
    )}`
  );
}


function getDownloadUrl(
  type,
  track
) {

  return api(
    `/api/download?type=${encodeURIComponent(
      type
    )}&url=${encodeURIComponent(
      track.url
    )}`
  );
}


/* ============================================================================
   AUDIO PLAYER
============================================================================ */

function getAudioElements() {

  return {
    sheet:
      $('#playerSheet'),

    audio:
      $('#audioEl'),

    title:
      $('#playerTitle'),

    channel:
      $('#playerChannel'),

    thumb:
      $('#playerThumb')
  };
}


async function playAudio(
  track,
  index = -1
) {

  const {
    sheet,
    audio,
    title,
    channel,
    thumb
  } =
    getAudioElements();


  if (
    !sheet ||
    !audio
  ) {

    showToast(
      'Audio player is unavailable.'
    );

    return;
  }


  stopVideo();


  if (
    state.mediaController
  ) {

    state.mediaController.abort();
  }


  state.mediaController =
    new AbortController();


  state.currentTrack =
    track;

  state.currentType =
    'audio';

  state.currentIndex =
    index;


  if (title) {

    title.textContent =
      track.title ||
      'Unknown title';
  }


  if (channel) {

    channel.textContent =
      track.channel ||
      'Cymor Tune';
  }


  if (thumb) {

    thumb.src =
      track.thumbnail ||
      '';

    thumb.style.visibility =
      track.thumbnail
        ? 'visible'
        : 'hidden';
  }


  sheet.classList.remove(
    'hidden'
  );


  setAudioLoading(
    true
  );


  /*
   * IMPORTANT:
   *
   * The audio element receives the Cymor backend stream.
   *
   * It does NOT wait for the frontend to download
   * the complete MP3 first.
   *
   * Browser:
   *
   * audio.src → backend /api/stream
   *
   * Backend:
   *
   * resolve Keith → CDN → stream to browser
   */

  const streamUrl =
    getStreamUrl(
      'audio',
      track
    );


  audio.pause();

  audio.removeAttribute(
    'src'
  );

  audio.load();


  audio.src =
    streamUrl;


  try {

    await audio.play();

  } catch (error) {

    console.log(
      '[AUDIO AUTOPLAY]',
      error.message
    );

    showToast(
      'Track ready — tap play.'
    );
  }
}


function setAudioLoading(
  loading
) {

  state.audioLoading =
    loading;

  $('#playerSheet')
    ?.classList.toggle(
      'player-loading',
      loading
    );
}


function stopAudio() {

  const audio =
    $('#audioEl');

  if (!audio) {
    return;
  }

  audio.pause();

  audio.removeAttribute(
    'src'
  );

  audio.load();

  setAudioLoading(
    false
  );
}


function closeAudioPlayer() {

  stopAudio();

  $('#playerSheet')
    ?.classList.add(
      'hidden'
    );

  state.currentMediaUrl =
    null;

  state.currentTrack =
    null;

  state.currentType =
    null;
}


/* ============================================================================
   AUDIO PLAYER ENHANCEMENTS
============================================================================ */

function initAudioPlayer() {

  const audio =
    $('#audioEl');

  if (!audio) {
    return;
  }


  $('#playerClose')
    ?.addEventListener(
      'click',
      closeAudioPlayer
    );


  audio.addEventListener(
    'loadstart',
    () => {

      setAudioLoading(
        true
      );
    }
  );


  audio.addEventListener(
    'waiting',
    () => {

      setAudioLoading(
        true
      );
    }
  );


  audio.addEventListener(
    'canplay',
    () => {

      setAudioLoading(
        false
      );
    }
  );


  audio.addEventListener(
    'playing',
    () => {

      setAudioLoading(
        false
      );

      updateAudioPlayerState(
        true
      );
    }
  );


  audio.addEventListener(
    'pause',
    () => {

      updateAudioPlayerState(
        false
      );
    }
  );


  audio.addEventListener(
    'ended',
    () => {

      updateAudioPlayerState(
        false
      );

      playNextAudio();
    }
  );


  audio.addEventListener(
    'error',
    () => {

      setAudioLoading(
        false
      );

      console.error(
        '[AUDIO ERROR]',
        audio.error
      );

      showToast(
        'Playback failed. Try the track again.'
      );
    }
  );


  /*
   * If the redesigned HTML contains these controls,
   * wire them automatically.
   */

  $('#audioPlayPause')
    ?.addEventListener(
      'click',
      toggleAudioPlayback
    );


  $('#audioProgress')
    ?.addEventListener(
      'input',
      event => {

        if (
          !audio.duration
        ) {
          return;
        }

        audio.currentTime =
          (
            Number(
              event.target.value
            ) /
            100
          ) *
          audio.duration;
      }
    );


  $('#audioVolume')
    ?.addEventListener(
      'input',
      event => {

        audio.volume =
          Number(
            event.target.value
          );
      }
    );


  $('#audioDownload')
    ?.addEventListener(
      'click',
      () => {

        if (
          state.currentTrack
        ) {

          downloadTrack(
            state.currentTrack,
            'audio'
          );
        }
      }
    );


  $('#audioNext')
    ?.addEventListener(
      'click',
      playNextAudio
    );


  $('#audioPrevious')
    ?.addEventListener(
      'click',
      playPreviousAudio
    );


  audio.addEventListener(
    'timeupdate',
    updateAudioProgress
  );


  audio.addEventListener(
    'loadedmetadata',
    updateAudioProgress
  );
}


function toggleAudioPlayback() {

  const audio =
    $('#audioEl');

  if (!audio) {
    return;
  }

  if (
    audio.paused
  ) {

    audio.play()
      .catch(
        () => {}
      );

  } else {

    audio.pause();
  }
}


function updateAudioProgress() {

  const audio =
    $('#audioEl');

  if (!audio) {
    return;
  }


  const progress =
    $('#audioProgress');

  const current =
    $('#audioCurrentTime');

  const duration =
    $('#audioDuration');


  if (
    progress &&
    Number.isFinite(
      audio.duration
    ) &&
    audio.duration > 0
  ) {

    progress.value =
      (
        audio.currentTime /
        audio.duration
      ) *
      100;
  }


  if (current) {

    current.textContent =
      formatTime(
        audio.currentTime
      );
  }


  if (duration) {

    duration.textContent =
      formatTime(
        audio.duration
      );
  }
}


function updateAudioPlayerState(
  playing
) {

  const button =
    $('#audioPlayPause');

  if (!button) {
    return;
  }

  button.classList.toggle(
    'playing',
    playing
  );


  const playIcon =
    button.querySelector(
      '[data-play-icon]'
    );

  const pauseIcon =
    button.querySelector(
      '[data-pause-icon]'
    );


  if (
    playIcon
  ) {

    playIcon.classList.toggle(
      'hidden',
      playing
    );
  }


  if (
    pauseIcon
  ) {

    pauseIcon.classList.toggle(
      'hidden',
      !playing
    );
  }


  if (
    !playIcon &&
    !pauseIcon
  ) {

    button.textContent =
      playing
        ? '❚❚'
        : '▶';
  }
}


/* ============================================================================
   AUDIO NEXT / PREVIOUS
============================================================================ */

function playNextAudio() {

  const results =
    state.searchResults;


  if (
    !results.length
  ) {
    return;
  }


  let next =
    state.currentIndex + 1;


  if (
    next >= results.length
  ) {

    next = 0;
  }


  state.currentIndex =
    next;


  playAudio(
    results[next],
    next
  );
}


function playPreviousAudio() {

  const results =
    state.searchResults;


  if (
    !results.length
  ) {
    return;
  }


  /*
   * If the current song has played for
   * more than 3 seconds, restart it.
   */

  const audio =
    $('#audioEl');


  if (
    audio &&
    audio.currentTime > 3
  ) {

    audio.currentTime =
      0;

    return;
  }


  let previous =
    state.currentIndex - 1;


  if (
    previous < 0
  ) {

    previous =
      results.length - 1;
  }


  state.currentIndex =
    previous;


  playAudio(
    results[previous],
    previous
  );
}


/* ============================================================================
   VIDEO PLAYER
============================================================================ */

function createVideoPlayer() {

  let sheet =
    $('#videoPlayerSheet');


  if (sheet) {
    return sheet;
  }


  /*
   * If the new index.html already contains
   * the YouTube-style player, use it.
   */

  sheet =
    document.createElement(
      'div'
    );

  sheet.id =
    'videoPlayerSheet';

  sheet.className =
    'video-player-sheet hidden';


  sheet.innerHTML = `

    <div
      class="video-player-backdrop"
      data-video-close
    ></div>

    <div class="video-player-card">

      <div class="video-player-header">

        <div>

          <p
            id="videoPlayerTitle"
            class="video-player-title"
          >
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
        >
          ×
        </button>

      </div>


      <div class="video-stage">

        <video
          id="videoEl"
          playsinline
          preload="metadata"
          controls
        ></video>

        <div
          class="video-loading"
          id="videoLoading"
        >
          <div class="video-spinner"></div>
          <span>Preparing video…</span>
        </div>

      </div>


      <div class="video-player-meta">

        <img
          id="videoPlayerThumb"
          alt=""
        >

        <div>

          <p
            class="video-meta-title"
            id="videoMetaTitle"
          >
            Loading…
          </p>

          <p class="video-meta-sub">
            Cymor Tune
          </p>

        </div>

        <button
          id="videoDownload"
          class="video-download-btn"
          type="button"
        >
          ↓
        </button>

      </div>

    </div>
  `;


  document.body.appendChild(
    sheet
  );


  $('#videoPlayerClose')
    ?.addEventListener(
      'click',
      closeVideoPlayer
    );


  $('[data-video-close]')
    ?.addEventListener(
      'click',
      closeVideoPlayer
    );


  $('#videoDownload')
    ?.addEventListener(
      'click',
      () => {

        if (
          state.currentTrack
        ) {

          downloadTrack(
            state.currentTrack,
            'video'
          );
        }
      }
    );


  initVideoElement();


  return sheet;
}


function initVideoElement() {

  const video =
    $('#videoEl');

  if (!video) {
    return;
  }


  video.addEventListener(
    'waiting',
    () => {

      setVideoLoading(
        true
      );
    }
  );


  video.addEventListener(
    'canplay',
    () => {

      setVideoLoading(
        false
      );
    }
  );


  video.addEventListener(
    'playing',
    () => {

      setVideoLoading(
        false
      );
    }
  );


  video.addEventListener(
    'error',
    () => {

      setVideoLoading(
        false
      );

      console.error(
        '[VIDEO ERROR]',
        video.error
      );

      showToast(
        'Video playback failed.'
      );
    }
  );
}


function setVideoLoading(
  loading
) {

  state.videoLoading =
    loading;


  $('#videoPlayerSheet')
    ?.classList.toggle(
      'loading',
      loading
    );


  $('#videoLoading')
    ?.classList.toggle(
      'hidden',
      !loading
    );
}


async function playVideo(
  track
) {

  const sheet =
    createVideoPlayer();

  const video =
    $('#videoEl');


  if (!video) {
    return;
  }


  stopAudio();


  state.currentTrack =
    track;

  state.currentType =
    'video';


  $('#videoPlayerTitle')
    ?.replaceChildren(
      document.createTextNode(
        track.title ||
        'Unknown title'
      )
    );


  $('#videoMetaTitle')
    ?.replaceChildren(
      document.createTextNode(
        track.title ||
        'Unknown title'
      )
    );


  $('#videoPlayerChannel')
    ?.replaceChildren(
      document.createTextNode(
        track.channel ||
        'Now streaming'
      )
    );


  const thumb =
    $('#videoPlayerThumb');


  if (thumb) {

    thumb.src =
      track.thumbnail ||
      '';

    thumb.style.visibility =
      track.thumbnail
        ? 'visible'
        : 'hidden';
  }


  sheet.classList.remove(
    'hidden'
  );


  video.pause();

  video.removeAttribute(
    'src'
  );

  video.load();


  setVideoLoading(
    true
  );


  /*
   * Directly use the backend stream.
   *
   * No frontend resolve request is needed.
   *
   * This is faster:
   *
   * video → /api/stream
   *
   * instead of:
   *
   * frontend → /api/resolve
   * frontend → CDN
   */

  const streamUrl =
    getStreamUrl(
      'video',
      track
    );


  video.src =
    streamUrl;


  try {

    await video.play();

  } catch {

    showToast(
      'Video ready — tap play.'
    );
  }
}


function stopVideo() {

  const video =
    $('#videoEl');

  if (!video) {
    return;
  }

  video.pause();

  video.removeAttribute(
    'src'
  );

  video.load();
}


function closeVideoPlayer() {

  stopVideo();

  $('#videoPlayerSheet')
    ?.classList.add(
      'hidden'
    );

  if (
    state.currentType ===
    'video'
  ) {

    state.currentTrack =
      null;

    state.currentType =
      null;
  }
}


/* ============================================================================
   DOWNLOADS
============================================================================ */

/*
 * Downloads are intentionally handled by the backend.
 *
 * This avoids:
 *
 * - browser CORS problems
 * - loading entire MP4 files into memory
 * - Blob conversion delays
 * - direct Keith exposure
 *
 * Backend:
 *
 * /api/download?type=audio&url=...
 *
 * /api/download?type=video&url=...
 */

async function downloadTrack(
  track,
  type
) {

  if (
    !['audio', 'video'].includes(
      type
    )
  ) {

    return;
  }


  const label =
    type === 'audio'
      ? 'MP3'
      : 'MP4';


  if (
    !track ||
    !isYoutubeUrl(
      track.url
    )
  ) {

    showToast(
      'Invalid YouTube track.'
    );

    return;
  }


  showOverlay(
    `Preparing ${label}…`
  );


  try {

    /*
     * First ask the backend to resolve.
     *
     * This verifies that Keith can actually
     * produce the requested media before
     * opening the download.
     */

    await resolveMedia(
      type,
      track.url
    );


    const filename =
      `${sanitizeFilename(
        track.title
      )}.${type === 'audio'
        ? 'mp3'
        : 'mp4'
      }`;


    /*
     * Store download history before
     * navigating away.
     */

    const entry = {

      id:
        track.id ||
        extractYoutubeId(
          track.url
        ),

      title:
        track.title ||
        'Unknown title',

      url:
        track.url,

      thumbnail:
        track.thumbnail ||
        '',

      duration:
        track.duration ||
        '',

      channel:
        track.channel ||
        '',

      type,

      filename,

      downloadedAt:
        Date.now()
    };


    downloads =
      [
        entry,
        ...downloads.filter(
          item =>
            !(
              item.url ===
              entry.url &&
              item.type ===
              entry.type
            )
        )
      ]
      .slice(
        0,
        CONFIG.MAX_DOWNLOAD_ITEMS
      );


    store.set(
      STORAGE_KEYS.DOWNLOADS,
      downloads
    );


    /*
     * Open backend download endpoint.
     *
     * The backend performs:
     *
     * Keith → CDN → browser
     */

    const url =
      getDownloadUrl(
        type,
        track
      );


    const link =
      document.createElement(
        'a'
      );

    link.href =
      url;

    link.target =
      '_blank';

    link.rel =
      'noopener';

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();


    showToast(
      `${label} download started.`
    );


  } catch (error) {

    console.error(
      '[DOWNLOAD ERROR]',
      error
    );

    showToast(
      `Unable to prepare ${label}.`
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
    $('#downloadsList');

  if (!container) {
    return;
  }

  container.innerHTML =
    '';


  if (
    !downloads.length
  ) {

    container.innerHTML = `
      <div class="empty-state">

        <span class="empty-glyph">
          ⬇
        </span>

        <p>
          Nothing downloaded yet.
          Tracks you save will appear here.
        </p>

      </div>
    `;

    return;
  }


  const fragment =
    document.createDocumentFragment();


  downloads.forEach(
    item => {

      const card =
        document.createElement(
          'article'
        );

      card.className =
        'track-card';


      const type =
        item.type === 'audio'
          ? 'MP3'
          : 'MP4';


      card.innerHTML = `

        <img
          class="track-thumb"
          src="${escapeHtml(
            item.thumbnail || ''
          )}"
          alt=""
          loading="lazy"
          onerror="this.style.visibility='hidden'"
        >

        <div class="track-body">

          <p class="track-title">
            ${escapeHtml(
              item.title ||
              'Unknown title'
            )}
          </p>

          <p class="track-sub">
            ${escapeHtml(
              item.channel ||
              'Unknown artist'
            )}
            · ${type}
            ${
              item.downloadedAt
                ? ` · ${formatDate(
                    item.downloadedAt
                  )}`
                : ''
            }
          </p>

          <div class="track-actions">

            <button
              class="pill-btn primary"
              data-play-history
              type="button"
            >
              ▶ Play
            </button>

            <button
              class="pill-btn"
              data-download-history
              type="button"
            >
              ↓ Again
            </button>

          </div>

        </div>
      `;


      card
        .querySelector(
          '[data-play-history]'
        )
        ?.addEventListener(
          'click',
          () => {

            if (
              item.type ===
              'audio'
            ) {

              playAudio(
                item
              );

            } else {

              playVideo(
                item
              );
            }
          }
        );


      card
        .querySelector(
          '[data-download-history]'
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


      fragment.appendChild(
        card
      );
    }
  );


  container.appendChild(
    fragment
  );
}


/* ============================================================================
   LIBRARY
============================================================================ */

function toggleSave(
  track,
  button
) {

  const index =
    library.findIndex(
      item =>
        item.url ===
        track.url
    );


  if (
    index >= 0
  ) {

    library.splice(
      index,
      1
    );

    button?.classList.remove(
      'active'
    );

    showToast(
      'Removed from your library.'
    );

  } else {

    library.unshift(
      track
    );

    library =
      library.slice(
        0,
        CONFIG.MAX_LIBRARY_ITEMS
      );

    button?.classList.add(
      'active'
    );

    showToast(
      'Added to your library.'
    );
  }


  store.set(
    STORAGE_KEYS.LIBRARY,
    library
  );
}


function renderLibrary() {

  const container =
    $('#libraryList');

  if (!container) {
    return;
  }

  container.innerHTML =
    '';


  if (
    !library.length
  ) {

    container.innerHTML = `
      <div class="empty-state">

        <span class="empty-glyph">
          ♥
        </span>

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


  library.forEach(
    track => {

      fragment.appendChild(
        buildTrackCard(
          track
        )
      );
    }
  );


  container.appendChild(
    fragment
  );
}


/* ============================================================================
   THEME
============================================================================ */

function applyTheme(
  theme
) {

  if (
    !['dark', 'light', 'system']
      .includes(theme)
  ) {

    theme =
      'dark';
  }


  settings.theme =
    theme;


  store.set(
    STORAGE_KEYS.SETTINGS,
    settings
  );


  store.set(
    STORAGE_KEYS.THEME,
    theme
  );


  const root =
    document.documentElement;


  if (
    theme ===
    'system'
  ) {

    root.removeAttribute(
      'data-theme'
    );

  } else {

    root.setAttribute(
      'data-theme',
      theme
    );
  }


  $$
    ('[data-theme]')
    .forEach(
      button => {

        button.classList.toggle(
          'active',
          button.dataset.theme ===
          theme
        );
      }
    );


  const meta =
    document.querySelector(
      'meta[name="theme-color"]'
    );


  if (meta) {

    meta.setAttribute(
      'content',
      theme ===
      'light'
        ? '#f7f5fb'
        : '#0a0910'
    );
  }
}


function initTheme() {

  const saved =
    store.get(
      STORAGE_KEYS.THEME,
      settings.theme ||
      'dark'
    );


  applyTheme(
    saved
  );


  $$
    ('[data-theme]')
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            applyTheme(
              button.dataset.theme
            );
          }
        );
      }
    );
}


/* ============================================================================
   GLOBAL KEYBOARD
============================================================================ */

function initKeyboard() {

  document.addEventListener(
    'keydown',
    event => {

      if (
        event.key !==
        'Escape'
      ) {
        return;
      }


      closeAudioPlayer();

      closeVideoPlayer();
    }
  );
}


/* ============================================================================
   SERVICE WORKER
============================================================================ */

function registerServiceWorker() {

  if (
    !('serviceWorker' in navigator)
  ) {

    return;
  }


  navigator.serviceWorker
    .register(
      'sw.js'
    )
    .then(
      registration => {

        console.log(
          '[Cymor Tune] Service worker registered:',
          registration.scope
        );
      }
    )
    .catch(
      error => {

        console.warn(
          '[Cymor Tune] Service worker registration failed:',
          error
        );
      }
    );
}


/* ============================================================================
   BACKEND CHECK
============================================================================ */

/*
 * This is intentionally NOT called during initial page loading.
 *
 * Your Render backend may be sleeping.
 *
 * Calling /health immediately when the page opens can wake the
 * backend and create another delay before the user even searches.
 *
 * The real search request will naturally wake it when necessary.
 */

async function checkBackend() {

  try {

    const response =
      await fetch(
        api('/health'),
        {
          method:
            'GET',

          cache:
            'no-store',

          signal:
            AbortSignal.timeout
              ? AbortSignal.timeout(7000)
              : undefined
        }
      );


    if (
      response.ok
    ) {

      console.log(
        '[Cymor Tune] Backend online.'
      );

      return true;
    }


  } catch (error) {

    console.warn(
      '[Cymor Tune] Backend unavailable:',
      error.message
    );
  }


  return false;
}


/* ============================================================================
   PRELOAD / INITIALIZATION
============================================================================ */

function initializeApp() {

  /*
   * Theme first.
   */

  initTheme();


  /*
   * Premium landing.
   */

  runLandingSequence();


  /*
   * Navigation.
   */

  initNavigation();


  /*
   * Search.
   */

  initSearch();


  /*
   * Audio player.
   */

  initAudioPlayer();


  /*
   * Keyboard.
   */

  initKeyboard();


  /*
   * Render cached local data.
   */

  renderDownloads();

  renderLibrary();


  /*
   * PWA.
   */

  registerServiceWorker();


  /*
   * IMPORTANT:
   *
   * We don't block the app on backend health.
   *
   * This runs in the background after initialization.
   */

  setTimeout(
    checkBackend,
    3000
  );


  console.log(
    '%cCymor Tune',
    'font-size:20px;font-weight:800'
  );

  console.log(
    'Cymor Tech Services'
  );

  console.log(
    'Developer: Legendary Smiley Cymor'
  );

  console.log(
    'Idea by: Joyce'
  );
}


/* ============================================================================
   START
============================================================================ */

if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    initializeApp,
    {
      once: true
    }
  );

} else {

  initializeApp();
    }
