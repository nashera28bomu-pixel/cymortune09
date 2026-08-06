/**
 * CYMOR TUNE — Frontend logic
 * Developer: Legendary Smiley Cymor · Idea by Joyce
 */

// ---------------------------------------------------------------------------
// CONFIG — point this at your deployed backend (Render URL) before shipping.
// Left as '/api' assumes the frontend is served from the same origin as the
// backend, or that a reverse proxy forwards /api/* to it.
// ---------------------------------------------------------------------------
const CONFIG = {
  BACKEND_URL: 'https://cymortune.onrender.com' // <-- replace with your Render backend URL
};

const api = (path) => `${CONFIG.BACKEND_URL}${path}`;

// ---------------------------------------------------------------------------
// STORAGE HELPERS (localStorage — this is a real deployed PWA, not a sandboxed
// artifact, so localStorage is safe and appropriate here)
// ---------------------------------------------------------------------------
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
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full/unavailable */ }
  }
};

const KEYS = { LIBRARY: 'cymorTune.library', DOWNLOADS: 'cymorTune.downloads', SETTINGS: 'cymorTune.settings' };

let library = store.get(KEYS.LIBRARY, []);
let downloads = store.get(KEYS.DOWNLOADS, []);
let settings = store.get(KEYS.SETTINGS, { audioQuality: '128', videoQuality: '720' });

// =============================================================================
// LANDING: falling notes + piano-key equalizer loader (40s)
// =============================================================================
function spawnFallingNotes() {
  const field = document.getElementById('notesField');
  const glyphs = ['♪', '♫', '♬', '♩'];
  const count = 26;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'falling-note';
    el.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
    const size = 12 + Math.random() * 22;
    el.style.fontSize = `${size}px`;
    el.style.left = `${Math.random() * 100}%`;
    el.style.setProperty('--drift', `${(Math.random() * 80 - 40).toFixed(0)}px`);
    const duration = 6 + Math.random() * 8;
    el.style.animationDuration = `${duration}s`;
    el.style.animationDelay = `${Math.random() * 6}s`;
    field.appendChild(el);
  }
}

const KEY_COUNT = 22;
function buildKeyLoader() {
  const row = document.getElementById('keysRow');
  for (let i = 0; i < KEY_COUNT; i++) {
    const key = document.createElement('div');
    key.className = 'key bounce';
    const base = 14 + Math.random() * 10;
    const peak = 40 + Math.random() * 45;
    key.style.setProperty('--base-h', `${base}%`);
    key.style.setProperty('--peak-h', `${peak}%`);
    key.style.animationDelay = `${(i * 0.06).toFixed(2)}s`;
    row.appendChild(key);
  }
}

const LOAD_DURATION_MS = 10000;
const LOAD_LABELS = [
  'warming up the strings',
  'tuning the frequencies',
  'pressing the keys',
  'mixing the tracks',
  'almost there'
];

function runLandingSequence() {
  spawnFallingNotes();
  buildKeyLoader();

  const percentEl = document.getElementById('loaderPercent');
  const labelEl = document.getElementById('loaderLabel');
  const loader = document.getElementById('keyLoader');
  const keys = Array.from(document.querySelectorAll('.key'));
  const startTime = performance.now();
  let finished = false;

  function tick(now) {
    if (finished) return;
    const elapsed = now - startTime;
    const pct = Math.min(100, Math.floor((elapsed / LOAD_DURATION_MS) * 100));

    percentEl.textContent = `${String(pct).padStart(2, '0')}%`;
    loader.setAttribute('aria-valuenow', String(pct));

    const labelIndex = Math.min(LOAD_LABELS.length - 1, Math.floor((pct / 100) * LOAD_LABELS.length));
    labelEl.textContent = LOAD_LABELS[labelIndex];

    const filledCount = Math.round((pct / 100) * keys.length);
    keys.forEach((k, i) => {
      if (i < filledCount) {
        k.classList.add('filled');
        k.classList.remove('bounce');
      }
    });

    if (pct >= 100) {
      finishLanding();
      return;
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
  document.getElementById('skipLoader').addEventListener('click', finishLanding);
}

function finishLanding() {
  const landing = document.getElementById('landing');
  const app = document.getElementById('app');
  if (landing.dataset.done) return;
  landing.dataset.done = 'true';
  landing.style.transition = 'opacity 0.5s ease';
  landing.style.opacity = '0';
  setTimeout(() => {
    landing.classList.add('hidden');
    app.classList.remove('hidden');
  }, 500);
}

// =============================================================================
// NAVIGATION
// =============================================================================
function initNav() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

function switchView(view) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active-view'));
  document.getElementById(`view-${view}`).classList.add('active-view');
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'downloads') renderDownloads();
  if (view === 'library') renderLibrary();
}

// =============================================================================
// OVERLAY
// =============================================================================
function showOverlay(text) {
  const overlay = document.getElementById('overlay');
  const eq = document.getElementById('miniEq');
  eq.innerHTML = '';
  for (let i = 0; i < 5; i++) eq.appendChild(document.createElement('span'));
  document.getElementById('overlayText').textContent = text;
  overlay.classList.remove('hidden');
}
function hideOverlay() {
  document.getElementById('overlay').classList.add('hidden');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add('hidden'), 2400);
}

// =============================================================================
// SEARCH
// =============================================================================
function initSearch() {
  document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = document.getElementById('searchInput').value.trim();
    if (!q) return;
    await runSearch(q);
  });
}

async function runSearch(query) {
  showOverlay('Searching the airwaves…');
  try {
    const res = await fetch(api(`/api/search?q=${encodeURIComponent(query)}`));
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Search failed');
    renderResults(data.results || []);
  } catch (err) {
    console.error(err);
    showToast('Search failed. Check your connection and try again.');
    renderResults([]);
  } finally {
    hideOverlay();
  }
}

function renderResults(results) {
  const container = document.getElementById('homeContent');
  container.innerHTML = '';

  if (!results.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-glyph">♫</span>
        <p>No tracks found. Try a different search or paste a direct YouTube link.</p>
      </div>`;
    return;
  }

  results.forEach((track) => container.appendChild(buildTrackCard(track)));
}

// =============================================================================
// TRACK CARD (search result / library / downloads item)
// =============================================================================
function buildTrackCard(track) {
  const card = document.createElement('div');
  card.className = 'track-card';

  const isSaved = library.some((t) => t.url === track.url);

  card.innerHTML = `
    <img class="track-thumb" src="${track.thumbnail || ''}" alt="" onerror="this.style.visibility='hidden'" />
    <div class="track-body">
      <p class="track-title">${escapeHtml(track.title)}</p>
      <p class="track-sub">${escapeHtml(track.channel || '')}${track.duration ? ' · ' + escapeHtml(String(track.duration)) : ''}</p>
      <div class="track-actions">
        <button class="pill-btn primary" data-action="stream-audio">▶ Play</button>
        <div class="quality-menu">
          <button class="pill-btn" data-action="toggle-mp3">MP3 ⌄</button>
        </div>
        <div class="quality-menu">
          <button class="pill-btn" data-action="toggle-mp4">MP4 ⌄</button>
        </div>
        <button class="pill-btn heart ${isSaved ? 'active' : ''}" data-action="save">♥</button>
      </div>
    </div>
  `;

  card.querySelector('[data-action="stream-audio"]').addEventListener('click', () => playAudio(track));
  card.querySelector('[data-action="save"]').addEventListener('click', (e) => toggleSave(track, e.currentTarget));

  card.querySelector('[data-action="toggle-mp3"]').addEventListener('click', (e) =>
    openQualityMenu(e.currentTarget, ['128', '320'], 'audio', track)
  );
  card.querySelector('[data-action="toggle-mp4"]').addEventListener('click', (e) =>
    openQualityMenu(e.currentTarget, ['360', '720', '1080'], 'video', track)
  );

  return card;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function openQualityMenu(anchorBtn, qualities, type, track) {
  document.querySelectorAll('.quality-dropdown').forEach((d) => d.remove());

  const dropdown = document.createElement('div');
  dropdown.className = 'quality-dropdown';
  qualities.forEach((q) => {
    const btn = document.createElement('button');
    btn.textContent = type === 'audio' ? `${q} kbps` : `${q}p`;
    btn.addEventListener('click', () => {
      dropdown.remove();
      downloadTrack(track, type, q);
    });
    dropdown.appendChild(btn);
  });
  anchorBtn.parentElement.appendChild(dropdown);

  const closeOnOutside = (ev) => {
    if (!dropdown.contains(ev.target) && ev.target !== anchorBtn) {
      dropdown.remove();
      document.removeEventListener('click', closeOnOutside);
    }
  };
  setTimeout(() => document.addEventListener('click', closeOnOutside), 0);
}

// =============================================================================
// PLAYBACK (stream)
// =============================================================================
function playAudio(track) {
  const sheet = document.getElementById('playerSheet');
  const audioEl = document.getElementById('audioEl');
  const quality = settings.audioQuality;

  document.getElementById('playerThumb').src = track.thumbnail || '';
  document.getElementById('playerTitle').textContent = track.title;
  document.getElementById('playerChannel').textContent = track.channel || '';

  audioEl.src = api(`/api/stream?type=audio&url=${encodeURIComponent(track.url)}&quality=${quality}`);
  sheet.classList.remove('hidden');
  audioEl.play().catch(() => showToast('Tap play to start audio.'));
}

document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('playerClose');
  closeBtn?.addEventListener('click', () => {
    const audioEl = document.getElementById('audioEl');
    audioEl.pause();
    document.getElementById('playerSheet').classList.add('hidden');
  });
});

// =============================================================================
// DOWNLOAD
// =============================================================================
async function downloadTrack(track, type, quality) {
  showOverlay(`Preparing your ${type === 'audio' ? 'MP3' : 'MP4'} (${type === 'audio' ? quality + ' kbps' : quality + 'p'})…`);
  try {
    const downloadUrl = api(`/api/stream?type=${type}&url=${encodeURIComponent(track.url)}&quality=${quality}&download=true`);

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${track.title || 'cymor-tune-track'}.${type === 'audio' ? 'mp3' : 'mp4'}`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    const entry = {
      ...track,
      type,
      quality,
      downloadedAt: Date.now()
    };
    downloads.unshift(entry);
    store.set(KEYS.DOWNLOADS, downloads);
    showToast('Download started.');
  } catch (err) {
    console.error(err);
    showToast('Download failed. Please try again.');
  } finally {
    hideOverlay();
  }
}

function renderDownloads() {
  const container = document.getElementById('downloadsList');
  container.innerHTML = '';

  if (!downloads.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-glyph">⬇</span>
        <p>Nothing downloaded yet. Tracks you save will show up here.</p>
      </div>`;
    return;
  }

  downloads.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'track-card';
    card.innerHTML = `
      <img class="track-thumb" src="${item.thumbnail || ''}" alt="" onerror="this.style.visibility='hidden'" />
      <div class="track-body">
        <p class="track-title">${escapeHtml(item.title)}</p>
        <p class="track-sub">${item.type === 'audio' ? item.quality + ' kbps · MP3' : item.quality + 'p · MP4'}</p>
      </div>
    `;
    container.appendChild(card);
  });
}

// =============================================================================
// LIBRARY (saved tracks)
// =============================================================================
function toggleSave(track, btn) {
  const idx = library.findIndex((t) => t.url === track.url);
  if (idx >= 0) {
    library.splice(idx, 1);
    btn.classList.remove('active');
    showToast('Removed from library.');
  } else {
    library.unshift(track);
    btn.classList.add('active');
    showToast('Saved to library.');
  }
  store.set(KEYS.LIBRARY, library);
}

function renderLibrary() {
  const container = document.getElementById('libraryList');
  container.innerHTML = '';

  if (!library.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-glyph">♥</span>
        <p>Your library is empty. Tap the heart on any track to save it here.</p>
      </div>`;
    return;
  }

  library.forEach((track) => container.appendChild(buildTrackCard(track)));
}

// =============================================================================
// SETTINGS
// =============================================================================
function initSettings() {
  const audioSel = document.getElementById('defaultAudioQuality');
  const videoSel = document.getElementById('defaultVideoQuality');
  audioSel.value = settings.audioQuality;
  videoSel.value = settings.videoQuality;

  audioSel.addEventListener('change', () => {
    settings.audioQuality = audioSel.value;
    store.set(KEYS.SETTINGS, settings);
  });
  videoSel.addEventListener('change', () => {
    settings.videoQuality = videoSel.value;
    store.set(KEYS.SETTINGS, settings);
  });
}

// =============================================================================
// PWA SERVICE WORKER
// =============================================================================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW registration failed', err));
  }
}

// =============================================================================
// INIT
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  runLandingSequence();
  initNav();
  initSearch();
  initSettings();
  registerServiceWorker();
});
