/**
 * CYMOR TUNE
 * Frontend Application Logic
 *
 * Developer: Legendary Smiley Cymor
 * Idea by Joyce
 * Built by Cymor Tech Services
 */

'use strict';


// ============================================================================
// CONFIG
// ============================================================================

const CONFIG = {
  BACKEND_URL: 'https://cymortune.onrender.com'
};

const api = (path) => `${CONFIG.BACKEND_URL}${path}`;


// ============================================================================
// STORAGE
// ============================================================================

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
    } catch {
      // Storage may be unavailable or full.
    }
  }

};


const KEYS = {
  LIBRARY: 'cymorTune.library',
  DOWNLOADS: 'cymorTune.downloads',
  SETTINGS: 'cymorTune.settings'
};


let library = store.get(KEYS.LIBRARY, []);
let downloads = store.get(KEYS.DOWNLOADS, []);

let settings = store.get(
  KEYS.SETTINGS,
  {
    theme: 'dark'
  }
);


// ============================================================================
// THEME
// ============================================================================

function applyTheme(theme) {

  if (theme !== 'light' && theme !== 'dark') {
    theme = 'dark';
  }

  settings.theme = theme;

  document.documentElement.setAttribute(
    'data-theme',
    theme
  );

  updateThemeButtons();

  store.set(
    KEYS.SETTINGS,
    settings
  );

  updateThemeColor(theme);
}


function updateThemeButtons() {

  document
    .querySelectorAll('.theme-option')
    .forEach((button) => {

      const active =
        button.dataset.theme === settings.theme;

      button.classList.toggle(
        'active',
        active
      );

      button.setAttribute(
        'aria-pressed',
        String(active)
      );

    });

}


function updateThemeColor(theme) {

  const meta =
    document.querySelector(
      'meta[name="theme-color"]'
    );

  if (!meta) return;

  meta.setAttribute(
    'content',
    theme === 'light'
      ? '#f7f5fb'
      : '#0a0910'
  );
}


function initTheme() {

  const savedTheme =
    settings.theme === 'light'
      ? 'light'
      : 'dark';

  applyTheme(savedTheme);

  document
    .querySelectorAll('.theme-option')
    .forEach((button) => {

      button.addEventListener(
        'click',
        () => {

          const theme =
            button.dataset.theme;

          applyTheme(theme);

          showToast(
            theme === 'light'
              ? 'Light mode enabled.'
              : 'Dark mode enabled.'
          );

        }
      );

    });

}


// ============================================================================
// LANDING / LOADER
// ============================================================================

function spawnFallingNotes() {

  const field =
    document.getElementById('notesField');

  if (!field) return;

  const glyphs = [
    '♪',
    '♫',
    '♬',
    '♩'
  ];

  const count = 26;

  for (let i = 0; i < count; i++) {

    const el =
      document.createElement('span');

    el.className =
      'falling-note';

    el.textContent =
      glyphs[
        Math.floor(
          Math.random() * glyphs.length
        )
      ];

    const size =
      12 + Math.random() * 22;

    el.style.fontSize =
      `${size}px`;

    el.style.left =
      `${Math.random() * 100}%`;

    el.style.setProperty(
      '--drift',
      `${(
        Math.random() * 80 - 40
      ).toFixed(0)}px`
    );

    const duration =
      6 + Math.random() * 8;

    el.style.animationDuration =
      `${duration}s`;

    el.style.animationDelay =
      `${Math.random() * 6}s`;

    field.appendChild(el);
  }
}


const KEY_COUNT = 22;


function buildKeyLoader() {

  const row =
    document.getElementById('keysRow');

  if (!row) return;

  for (
    let i = 0;
    i < KEY_COUNT;
    i++
  ) {

    const key =
      document.createElement('div');

    key.className =
      'key bounce';

    const base =
      14 + Math.random() * 10;

    const peak =
      40 + Math.random() * 45;

    key.style.setProperty(
      '--base-h',
      `${base}%`
    );

    key.style.setProperty(
      '--peak-h',
      `${peak}%`
    );

    key.style.animationDelay =
      `${(i * 0.06).toFixed(2)}s`;

    row.appendChild(key);
  }
}


const LOAD_DURATION_MS = 40000;

const LOAD_LABELS = [
  'warming up the strings',
  'tuning the frequencies',
  'pressing the keys',
  'mixing the tracks',
  'almost there'
];


let landingFinished = false;


function runLandingSequence() {

  spawnFallingNotes();
  buildKeyLoader();

  const percentEl =
    document.getElementById(
      'loaderPercent'
    );

  const labelEl =
    document.getElementById(
      'loaderLabel'
    );

  const loader =
    document.getElementById(
      'keyLoader'
    );

  const keys =
    Array.from(
      document.querySelectorAll('.key')
    );

  const startTime =
    performance.now();


  function tick(now) {

    if (landingFinished) return;

    const elapsed =
      now - startTime;

    const pct =
      Math.min(
        100,
        Math.floor(
          (elapsed / LOAD_DURATION_MS) *
          100
        )
      );

    percentEl.textContent =
      `${String(pct).padStart(2, '0')}%`;

    loader.setAttribute(
      'aria-valuenow',
      String(pct)
    );


    const labelIndex =
      Math.min(
        LOAD_LABELS.length - 1,
        Math.floor(
          (pct / 100) *
          LOAD_LABELS.length
        )
      );

    labelEl.textContent =
      LOAD_LABELS[labelIndex];


    const filledCount =
      Math.round(
        (pct / 100) *
        keys.length
      );


    keys.forEach((key, index) => {

      if (index < filledCount) {

        key.classList.add(
          'filled'
        );

        key.classList.remove(
          'bounce'
        );

      }

    });


    if (pct >= 100) {

      finishLanding();
      return;

    }

    requestAnimationFrame(tick);

  }


  requestAnimationFrame(tick);


  document
    .getElementById('skipLoader')
    ?.addEventListener(
      'click',
      finishLanding
    );

}


function finishLanding() {

  if (landingFinished) return;

  landingFinished = true;

  const landing =
    document.getElementById(
      'landing'
    );

  const app =
    document.getElementById(
      'app'
    );

  if (!landing || !app) return;

  landing.style.transition =
    'opacity 0.5s ease';

  landing.style.opacity =
    '0';

  setTimeout(() => {

    landing.classList.add(
      'hidden'
    );

    app.classList.remove(
      'hidden'
    );

  }, 500);

}


// ============================================================================
// NAVIGATION
// ============================================================================

function initNav() {

  document
    .querySelectorAll('.nav-btn')
    .forEach((button) => {

      button.addEventListener(
        'click',
        () => {

          switchView(
            button.dataset.view
          );

        }
      );

    });

}


function switchView(view) {

  document
    .querySelectorAll('.view')
    .forEach((element) => {

      element.classList.remove(
        'active-view'
      );

    });


  const target =
    document.getElementById(
      `view-${view}`
    );

  if (!target) return;

  target.classList.add(
    'active-view'
  );


  document
    .querySelectorAll('.nav-btn')
    .forEach((button) => {

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


// ============================================================================
// OVERLAY / TOAST
// ============================================================================

function showOverlay(text) {

  const overlay =
    document.getElementById(
      'overlay'
    );

  const eq =
    document.getElementById(
      'miniEq'
    );

  eq.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    eq.appendChild(
      document.createElement('span')
    );
  }

  document.getElementById(
    'overlayText'
  ).textContent = text;

  overlay.classList.remove(
    'hidden'
  );

}


function hideOverlay() {

  document
    .getElementById('overlay')
    .classList.add('hidden');

}


function showToast(message) {

  const toast =
    document.getElementById(
      'toast'
    );

  toast.textContent =
    message;

  toast.classList.remove(
    'hidden'
  );

  clearTimeout(
    showToast._timer
  );

  showToast._timer =
    setTimeout(() => {

      toast.classList.add(
        'hidden'
      );

    }, 2400);

}


// ============================================================================
// SEARCH
// ============================================================================

function initSearch() {

  const form =
    document.getElementById(
      'searchForm'
    );

  if (!form) return;

  form.addEventListener(
    'submit',
    async (event) => {

      event.preventDefault();

      const input =
        document.getElementById(
          'searchInput'
        );

      const query =
        input.value.trim();

      if (!query) return;

      await runSearch(query);

    }
  );

}


async function runSearch(query) {

  showOverlay(
    'Searching the airwaves…'
  );

  try {

    const response =
      await fetch(
        api(
          `/api/search?q=${encodeURIComponent(query)}`
        )
      );

    const data =
      await response.json();

    if (!data.success) {
      throw new Error(
        data.error ||
        'Search failed'
      );
    }

    renderResults(
      data.results || []
    );

  } catch (error) {

    console.error(
      '[Cymor Tune] Search error:',
      error
    );

    showToast(
      'Search failed. Check your connection and try again.'
    );

    renderResults([]);

  } finally {

    hideOverlay();

  }

}


// ============================================================================
// RESULTS
// ============================================================================

function renderResults(results) {

  const container =
    document.getElementById(
      'homeContent'
    );

  container.innerHTML = '';

  if (!results.length) {

    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-glyph">♫</span>
        <p>
          No tracks found. Try a different search
          or paste a direct YouTube link.
        </p>
      </div>
    `;

    return;
  }


  results.forEach((track) => {

    container.appendChild(
      buildTrackCard(track)
    );

  });

}


// ============================================================================
// TRACK CARD
// ============================================================================

function buildTrackCard(track) {

  const card =
    document.createElement('div');

  card.className =
    'track-card';


  const isSaved =
    library.some(
      (item) =>
        item.url === track.url
    );


  card.innerHTML = `

    <img
      class="track-thumb"
      src="${escapeAttribute(track.thumbnail || '')}"
      alt=""
      onerror="this.style.visibility='hidden'"
    />

    <div class="track-body">

      <p class="track-title">
        ${escapeHtml(track.title)}
      </p>

      <p class="track-sub">
        ${escapeHtml(track.channel || '')}
        ${
          track.duration
            ? ` · ${escapeHtml(String(track.duration))}`
            : ''
        }
      </p>

      <div class="track-actions">

        <button
          class="pill-btn primary"
          data-action="stream-audio"
          type="button">
          ▶ Play
        </button>

        <div class="quality-menu">

          <button
            class="pill-btn"
            data-action="toggle-mp3"
            type="button">
            MP3 ⌄
          </button>

        </div>

        <div class="quality-menu">

          <button
            class="pill-btn"
            data-action="toggle-mp4"
            type="button">
            MP4 ⌄
          </button>

        </div>

        <button
          class="pill-btn heart ${isSaved ? 'active' : ''}"
          data-action="save"
          type="button"
          aria-label="Save track">
          ♥
        </button>

      </div>

    </div>
  `;


  card
    .querySelector(
      '[data-action="stream-audio"]'
    )
    .addEventListener(
      'click',
      () => playAudio(track)
    );


  card
    .querySelector(
      '[data-action="save"]'
    )
    .addEventListener(
      'click',
      (event) =>
        toggleSave(
          track,
          event.currentTarget
        )
    );


  card
    .querySelector(
      '[data-action="toggle-mp3"]'
    )
    .addEventListener(
      'click',
      (event) => {

        openQualityMenu(
          event.currentTarget,
          ['128', '320'],
          'audio',
          track
        );

      }
    );


  card
    .querySelector(
      '[data-action="toggle-mp4"]'
    )
    .addEventListener(
      'click',
      (event) => {

        openQualityMenu(
          event.currentTarget,
          ['360', '720', '1080'],
          'video',
          track
        );

      }
    );


  return card;

}


// ============================================================================
// SECURITY HELPERS
// ============================================================================

function escapeHtml(value) {

  const div =
    document.createElement('div');

  div.textContent =
    value ?? '';

  return div.innerHTML;

}


function escapeAttribute(value) {

  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

}


// ============================================================================
// QUALITY MENU
// ============================================================================

function openQualityMenu(
  anchorButton,
  qualities,
  type,
  track
) {

  document
    .querySelectorAll('.quality-dropdown')
    .forEach(
      (menu) => menu.remove()
    );


  const dropdown =
    document.createElement('div');

  dropdown.className =
    'quality-dropdown';


  qualities.forEach((quality) => {

    const button =
      document.createElement('button');

    button.type =
      'button';

    button.textContent =
      type === 'audio'
        ? `${quality} kbps`
        : `${quality}p`;


    button.addEventListener(
      'click',
      () => {

        dropdown.remove();

        downloadTrack(
          track,
          type,
          quality
        );

      }
    );


    dropdown.appendChild(
      button
    );

  });


  anchorButton
    .parentElement
    .appendChild(dropdown);


  const closeOnOutside =
    (event) => {

      if (
        !dropdown.contains(event.target) &&
        event.target !== anchorButton
      ) {

        dropdown.remove();

        document.removeEventListener(
          'click',
          closeOnOutside
        );

      }

    };


  setTimeout(() => {

    document.addEventListener(
      'click',
      closeOnOutside
    );

  }, 0);

}


// ============================================================================
// AUDIO PLAYER
// ============================================================================

function playAudio(track) {

  const sheet =
    document.getElementById(
      'playerSheet'
    );

  const audio =
    document.getElementById(
      'audioEl'
    );


  const streamUrl =
    api(
      `/api/stream?type=audio&url=${encodeURIComponent(track.url)}`
    );


  document.getElementById(
    'playerThumb'
  ).src =
    track.thumbnail || '';


  document.getElementById(
    'playerTitle'
  ).textContent =
    track.title || 'Unknown track';


  document.getElementById(
    'playerChannel'
  ).textContent =
    track.channel || '';


  audio.onerror = async () => {

    try {

      const response =
        await fetch(streamUrl);

      const data =
        await response
          .json()
          .catch(() => null);

      showToast(
        data?.error ||
        'Playback failed. The provider did not return an audio file.'
      );

      if (data?.provider_response) {

        console.error(
          '[Cymor Tune] Provider response:',
          data.provider_response
        );

      }

    } catch {

      showToast(
        'Playback failed. Check your connection and try again.'
      );

    }

    sheet.classList.add(
      'hidden'
    );

  };


  audio.src =
    streamUrl;

  sheet.classList.remove(
    'hidden'
  );


  audio.play()
    .catch(() => {

      showToast(
        'Tap play to start audio.'
      );

    });

}


// ============================================================================
// PLAYER CLOSE
// ============================================================================

function initPlayer() {

  const closeButton =
    document.getElementById(
      'playerClose'
    );

  closeButton?.addEventListener(
    'click',
    () => {

      const audio =
        document.getElementById(
          'audioEl'
        );

      audio.pause();

      audio.removeAttribute(
        'src'
      );

      audio.load();

      document
        .getElementById(
          'playerSheet'
        )
        .classList.add(
          'hidden'
        );

    }
  );

}


// ============================================================================
// DOWNLOAD
// ============================================================================

async function downloadTrack(
  track,
  type,
  quality
) {

  const format =
    type === 'audio'
      ? 'MP3'
      : 'MP4';

  const qualityText =
    type === 'audio'
      ? `${quality} kbps`
      : `${quality}p`;


  showOverlay(
    `Preparing your ${format} (${qualityText})…`
  );


  try {

    const downloadUrl =
      api(
        `/api/stream?type=${type}&url=${encodeURIComponent(track.url)}&quality=${quality}&download=true`
      );


    const response =
      await fetch(
        downloadUrl
      );


    const contentType =
      response.headers.get(
        'content-type'
      ) || '';


    if (
      !response.ok ||
      contentType.includes(
        'application/json'
      )
    ) {

      const data =
        await response
          .json()
          .catch(() => null);

      showToast(
        data?.error ||
        'Download failed. The provider did not return a file.'
      );


      if (data?.provider_response) {

        console.error(
          '[Cymor Tune] Provider response:',
          data.provider_response
        );

      }

      return;

    }


    const blob =
      await response.blob();


    const objectUrl =
      URL.createObjectURL(
        blob
      );


    const link =
      document.createElement('a');

    link.href =
      objectUrl;

    link.download =
      `${sanitizeFilename(track.title || 'cymor-tune-track')}.${type === 'audio' ? 'mp3' : 'mp4'}`;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();


    setTimeout(
      () => URL.revokeObjectURL(objectUrl),
      1000
    );


    const entry = {
      ...track,
      type,
      quality,
      downloadedAt: Date.now()
    };


    downloads.unshift(
      entry
    );


    store.set(
      KEYS.DOWNLOADS,
      downloads
    );


    showToast(
      'Download complete.'
    );

  } catch (error) {

    console.error(
      '[Cymor Tune] Download error:',
      error
    );

    showToast(
      'Download failed. Check your connection and try again.'
    );

  } finally {

    hideOverlay();

  }

}


function sanitizeFilename(filename) {

  return String(filename)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150) ||
    'cymor-tune-track';

}


// ============================================================================
// DOWNLOADS
// ============================================================================

function renderDownloads() {

  const container =
    document.getElementById(
      'downloadsList'
    );

  container.innerHTML = '';


  if (!downloads.length) {

    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-glyph">⬇</span>
        <p>
          Nothing downloaded yet.
          Tracks you save will show up here.
        </p>
      </div>
    `;

    return;

  }


  downloads.forEach((item) => {

    const card =
      document.createElement('div');

    card.className =
      'track-card';


    card.innerHTML = `

      <img
        class="track-thumb"
        src="${escapeAttribute(item.thumbnail || '')}"
        alt=""
        onerror="this.style.visibility='hidden'"
      />

      <div class="track-body">

        <p class="track-title">
          ${escapeHtml(item.title)}
        </p>

        <p class="track-sub">
          ${
            item.type === 'audio'
              ? `${item.quality} kbps · MP3`
              : `${item.quality}p · MP4`
          }
        </p>

      </div>

    `;


    container.appendChild(
      card
    );

  });

}


// ============================================================================
// LIBRARY
// ============================================================================

function toggleSave(
  track,
  button
) {

  const index =
    library.findIndex(
      (item) =>
        item.url === track.url
    );


  if (index >= 0) {

    library.splice(
      index,
      1
    );

    button.classList.remove(
      'active'
    );

    showToast(
      'Removed from library.'
    );

  } else {

    library.unshift(
      track
    );

    button.classList.add(
      'active'
    );

    showToast(
      'Saved to library.'
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

  container.innerHTML = '';


  if (!library.length) {

    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-glyph">♥</span>
        <p>
          Your library is empty.
          Tap the heart on any track to save it here.
        </p>
      </div>
    `;

    return;

  }


  library.forEach((track) => {

    container.appendChild(
      buildTrackCard(track)
    );

  });

}


// ============================================================================
// SERVICE WORKER
// ============================================================================

function registerServiceWorker() {

  if (
    'serviceWorker' in navigator
  ) {

    navigator.serviceWorker
      .register('sw.js')
      .catch(
        (error) =>
          console.warn(
            '[Cymor Tune] Service worker registration failed:',
            error
          )
      );

  }

}


// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener(
  'DOMContentLoaded',
  () => {

    initTheme();

    runLandingSequence();

    initNav();

    initSearch();

    initPlayer();

    registerServiceWorker();

  }
);
