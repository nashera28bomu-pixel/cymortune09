/**
 * CYMOR TUNE — Frontend logic
 * Developer: Legendary Smiley Cymor · Idea by Joyce
 */

// ---------------------------------------------------------------------------
// CONFIG — point this at your deployed backend (Render URL) before shipping.
// ---------------------------------------------------------------------------
const CONFIG = {
  BACKEND_URL: 'https://cymortuneapi.onrender.com' // <-- replace with your Render backend URL
};

const api = (path) => `${CONFIG.BACKEND_URL}${path}`;

// ---------------------------------------------------------------------------
// STORAGE HELPERS (localStorage — this is a real deployed PWA, not a
// sandboxed artifact, so localStorage is safe and appropriate here)
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

const KEYS = {
  LIBRARY: 'cymorTune.library',
  DOWNLOADS: 'cymorTune.downloads',
  RECENTS: 'cymorTune.recents',
  THEME: 'cymorTune.theme'
};

let library = store.get(KEYS.LIBRARY, []);
let downloads = store.get(KEYS.DOWNLOADS, []);
let recents = store.get(KEYS.RECENTS, []);
let theme = store.get(KEYS.THEME, 'dark');

// =============================================================================
// CURATED DATA — smart search suggestions & home categories
// =============================================================================
const CURATED_SUGGESTIONS = [
  'Sauti Sol', 'Bien', 'Sol Generation', 'Nyashinski', 'Otile Brown',
  'Khaligraph Jones', 'Willy Paul', 'Bensoul', 'Nadia Mukami', 'Guardian Angel',
  'H_art the Band', 'Size 8', 'Ruth Matete', 'Diamond Platnumz', 'Harmonize',
  'Burna Boy', 'Wizkid', 'Davido', 'Rema', 'Asake', 'Black Coffee',
  'Brenda Fassie', 'Bongo Flava', 'Amapiano mix', 'Gospel worship',
  'Beyoncé', 'Billie Eilish', 'Bruno Mars', 'Coldplay', 'Ed Sheeran',
  'Drake', 'Rihanna', 'Adele', 'Justin Bieber', 'The Weeknd', 'Taylor Swift'
];

const CATEGORIES = [
  { label: 'Gospel', query: 'Kenyan gospel worship songs' },
  { label: 'Afrobeat', query: 'Afrobeat hits 2026' },
  { label: 'Bongo', query: 'Bongo Flava hits' },
  { label: 'Amapiano', query: 'Amapiano mix 2026' },
  { label: 'Hip Hop', query: 'Hip hop hits' },
  { label: 'R&B', query: 'R&B love songs' },
  { label: 'Reggae', query: 'Reggae classics' },
  { label: 'Pop', query: 'Pop hits 2026' }
];

// =============================================================================
// LANDING: falling notes + piano-key equalizer loader (5s)
// =============================================================================
function spawnFallingNotes() {
  const field = document.getElementById('notesField');
  const glyphs = ['♪', '♫', '♬', '♩'];
  const count = 22;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'falling-note';
    el.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
    const size = 12 + Math.random() * 22;
    el.style.fontSize = `${size}px`;
    el.style.left = `${Math.random() * 100}%`;
    el.style.setProperty('--drift', `${(Math.random() * 80 - 40).toFixed(0)}px`);
    const duration = 3 + Math.random() * 3;
    el.style.animationDuration = `${duration}s`;
    el.style.animationDelay = `${Math.random() * 2}s`;
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
    key.style.animationDelay = `${(i * 0.03).toFixed(2)}s`;
    row.appendChild(key);
  }
}

const LOAD_DURATION_MS = 5000;
const LOAD_LABELS = ['warming up the strings', 'tuning the frequencies', 'pressing the keys', 'almost there'];

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
  landing.style.transition = 'opacity 0.4s ease';
  landing.style.opacity = '0';
  setTimeout(() => {
    landing.classList.add('hidden');
    app.classList.remove('hidden');
  }, 400);
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
  showToast._t = setTimeout(() => toast.classList.add('hidden'), 2600);
}

// =============================================================================
// SMART SEARCH SUGGESTIONS
// =============================================================================
function initSuggestions() {
  const input = document.getElementById('searchInput');
  const box = document.getElementById('suggestBox');

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (!q) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    renderSuggestions(q);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim()) renderSuggestions(input.value.trim());
  });

  document.addEventListener('click', (e) => {
    if (!box.contains(e.target) && e.target !== input) {
      box.classList.add('hidden');
    }
  });
}

function renderSuggestions(query) {
  const box = document.getElementById('suggestBox');
  const q = query.toLowerCase();

  const recentMatches = recents.filter((r) => r.toLowerCase().includes(q));
  const curatedMatches = CURATED_SUGGESTIONS.filter(
    (c) => c.toLowerCase().includes(q) && !recentMatches.some((r) => r.toLowerCase() === c.toLowerCase())
  );
  const combined = [
    ...recentMatches.map((r) => ({ text: r, isRecent: true })),
    ...curatedMatches.map((c) => ({ text: c, isRecent: false }))
  ].slice(0, 6);

  if (!combined.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }

  box.innerHTML = '';
  combined.forEach(({ text, isRecent }) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'suggest-item';
    const icon = isRecent
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
    item.innerHTML = `${icon}<span>${highlightMatch(text, query)}</span>`;
    item.addEventListener('click', () => {
      document.getElementById('searchInput').value = text;
      box.classList.add('hidden');
      runSearch(text);
    });
    box.appendChild(item);
  });
  box.classList.remove('hidden');
}

function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escapeHtml(text);
  const before = escapeHtml(text.slice(0, idx));
  const match = escapeHtml(text.slice(idx, idx + query.length));
  const after = escapeHtml(text.slice(idx + query.length));
  return `${before}<mark>${match}</mark>${after}`;
}

// =============================================================================
// RECENTS & CATEGORIES (home "lively" content)
// =============================================================================
function pushRecent(query) {
  const trimmed = query.trim();
  if (!trimmed) return;
  recents = [trimmed, ...recents.filter((r) => r.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
  store.set(KEYS.RECENTS, recents);
  renderRecents();
}

function renderRecents() {
  const row = document.getElementById('recentsRow');
  const section = row.closest('.chip-section');
  row.innerHTML = '';

  if (!recents.length) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  recents.forEach((q) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip recent';
    chip.innerHTML = `<span>${escapeHtml(q)}</span><span class="chip-remove" data-remove>&times;</span>`;
    chip.querySelector('span:first-child').addEventListener('click', () => runSearch(q));
    chip.querySelector('[data-remove]').addEventListener('click', (e) => {
      e.stopPropagation();
      recents = recents.filter((r) => r !== q);
      store.set(KEYS.RECENTS, recents);
      renderRecents();
    });
    row.appendChild(chip);
  });
}

function renderCategories() {
  const row = document.getElementById('categoriesRow');
  row.innerHTML = '';
  CATEGORIES.forEach((cat) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip category';
    chip.textContent = cat.label;
    chip.addEventListener('click', () => {
      document.getElementById('searchInput').value = cat.label;
      runSearch(cat.query);
    });
    row.appendChild(chip);
  });
}

// =============================================================================
// SEARCH
// =============================================================================
function initSearch() {
  document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = document.getElementById('searchInput').value.trim();
    if (!q) return;
    document.getElementById('suggestBox').classList.add('hidden');
    await runSearch(q);
  });

  document.getElementById('clearRecentsInline').addEventListener('click', () => {
    recents = [];
    store.set(KEYS.RECENTS, recents);
    renderRecents();
  });
}

async function runSearch(query) {
  showOverlay(`Finding matches for "${query}"…`);
  try {
    const res = await fetch(api(`/api/search?q=${encodeURIComponent(query)}`));
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Search failed');
    pushRecent(query);
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
    <div class="track-top">
      <img class="track-thumb" src="${track.thumbnail || ''}" alt="" onerror="this.style.visibility='hidden'" />
      <div class="track-body">
        <p class="track-title">${escapeHtml(track.title)}</p>
        <p class="track-sub">${escapeHtml(track.channel || '')}${track.duration ? ' · ' + escapeHtml(String(track.duration)) : ''}</p>
      </div>
      <button class="heart-btn ${isSaved ? 'active' : ''}" data-action="save">♥</button>
    </div>
    <div class="track-actions">
      <div class="play-menu-wrap">
        <button class="action-btn primary" data-action="play-toggle">▶ Play ⌄</button>
      </div>
      <button class="action-btn" data-action="download-audio">⬇ MP3</button>
      <button class="action-btn" data-action="download-video">⬇ MP4</button>
    </div>
  `;

  card.querySelector('[data-action="save"]').addEventListener('click', (e) => toggleSave(track, e.currentTarget));
  card.querySelector('[data-action="download-audio"]').addEventListener('click', () => downloadTrack(track, 'audio'));
  card.querySelector('[data-action="download-video"]').addEventListener('click', () => downloadTrack(track, 'video'));

  const playBtn = card.querySelector('[data-action="play-toggle"]');
  playBtn.addEventListener('click', (e) => openPlayMenu(e.currentTarget, track));

  return card;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function openPlayMenu(anchorBtn, track) {
  document.querySelectorAll('.action-dropdown').forEach((d) => d.remove());

  const dropdown = document.createElement('div');
  dropdown.className = 'action-dropdown';
  dropdown.innerHTML = `
    <button data-choice="audio">🎧 Play as MP3</button>
    <button data-choice="video">🎬 Play as MP4</button>
  `;
  dropdown.querySelector('[data-choice="audio"]').addEventListener('click', () => {
    dropdown.remove();
    playAudio(track);
  });
  dropdown.querySelector('[data-choice="video"]').addEventListener('click', () => {
    dropdown.remove();
    playVideo(track);
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
// AUDIO PLAYER (Spotify-style)
// =============================================================================
const audioEl = () => document.getElementById('audioEl');

function playAudio(track) {
  const streamUrl = api(`/api/stream?type=audio&url=${encodeURIComponent(track.url)}`);
  const player = document.getElementById('audioPlayer');
  const el = audioEl();

  document.getElementById('audioPlayerArt').src = track.thumbnail || '';
  document.getElementById('audioPlayerBackdrop').style.backgroundImage = track.thumbnail ? `url(${track.thumbnail})` : 'none';
  document.getElementById('audioPlayerTitle').textContent = track.title;
  document.getElementById('audioPlayerChannel').textContent = track.channel || '';
  document.getElementById('audioDownloadBtn').onclick = () => downloadTrack(track, 'audio');

  el.src = streamUrl;
  player.classList.remove('hidden');
  el.play().catch(() => showToast('Tap play to start audio.'));
  setPlayIcon(true);

  el.onerror = async () => {
    try {
      const res = await fetch(streamUrl);
      const data = await res.json().catch(() => null);
      showToast(data?.error || 'Playback failed. The provider did not return an audio file.');
      if (data?.details) console.error('[Cymor Tune] Provider details:', data.details);
    } catch {
      showToast('Playback failed. Check your connection and try again.');
    }
    player.classList.add('hidden');
  };
}

function setPlayIcon(isPlaying) {
  document.getElementById('playIcon').classList.toggle('hidden', isPlaying);
  document.getElementById('pauseIcon').classList.toggle('hidden', !isPlaying);
}

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function initAudioPlayerControls() {
  const el = audioEl();
  const seek = document.getElementById('audioSeek');

  document.getElementById('audioPlayPause').addEventListener('click', () => {
    if (el.paused) { el.play(); setPlayIcon(true); } else { el.pause(); setPlayIcon(false); }
  });
  document.getElementById('audioSkipBack').addEventListener('click', () => { el.currentTime = Math.max(0, el.currentTime - 10); });
  document.getElementById('audioSkipFwd').addEventListener('click', () => { el.currentTime = Math.min(el.duration || 0, el.currentTime + 10); });

  el.addEventListener('timeupdate', () => {
    if (!el.duration) return;
    const pct = (el.currentTime / el.duration) * 100;
    seek.value = pct;
    seek.style.setProperty('--seek-pct', `${pct}%`);
    document.getElementById('audioCurrentTime').textContent = formatTime(el.currentTime);
  });
  el.addEventListener('loadedmetadata', () => {
    document.getElementById('audioDuration').textContent = formatTime(el.duration);
  });
  el.addEventListener('play', () => setPlayIcon(true));
  el.addEventListener('pause', () => setPlayIcon(false));
  el.addEventListener('ended', () => setPlayIcon(false));

  seek.addEventListener('input', () => {
    if (!el.duration) return;
    el.currentTime = (seek.value / 100) * el.duration;
  });

  document.getElementById('audioPlayerClose').addEventListener('click', () => {
    el.pause();
    document.getElementById('audioPlayer').classList.add('hidden');
  });
}

// =============================================================================
// VIDEO PLAYER (YouTube-style)
// =============================================================================
function playVideo(track) {
  const streamUrl = api(`/api/stream?type=video&url=${encodeURIComponent(track.url)}`);
  const player = document.getElementById('videoPlayer');
  const el = document.getElementById('videoEl');

  document.getElementById('videoPlayerTitle').textContent = track.title;
  document.getElementById('videoDownloadBtn').onclick = () => downloadTrack(track, 'video');

  el.src = streamUrl;
  player.classList.remove('hidden');
  el.play().catch(() => showToast('Tap play to start video.'));

  el.onerror = async () => {
    try {
      const res = await fetch(streamUrl);
      const data = await res.json().catch(() => null);
      showToast(data?.error || 'Playback failed. The provider did not return a video file.');
      if (data?.details) console.error('[Cymor Tune] Provider details:', data.details);
    } catch {
      showToast('Playback failed. Check your connection and try again.');
    }
    player.classList.add('hidden');
  };
}

function initVideoPlayerControls() {
  const el = document.getElementById('videoEl');
  document.getElementById('videoPlayerClose').addEventListener('click', () => {
    el.pause();
    el.src = '';
    document.getElementById('videoPlayer').classList.add('hidden');
  });
  document.getElementById('videoFullscreenBtn').addEventListener('click', () => {
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen();
  });
}

// =============================================================================
// DOWNLOAD (saved to device with the track's name)
// =============================================================================
function sanitizeFilename(name) {
  return (name || 'cymor-tune-track')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'cymor-tune-track';
}

async function downloadTrack(track, type) {
  showOverlay(`Preparing your ${type === 'audio' ? 'MP3' : 'MP4'}…`);
  try {
    const downloadUrl = api(`/api/stream?type=${type}&url=${encodeURIComponent(track.url)}&download=true`);
    const res = await fetch(downloadUrl);
    const contentType = res.headers.get('content-type') || '';

    if (!res.ok || contentType.includes('application/json')) {
      const data = await res.json().catch(() => null);
      showToast(data?.error || 'Download failed. The provider did not return a file.');
      if (data?.details) console.error('[Cymor Tune] Provider details:', data.details);
      return;
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const filename = `${sanitizeFilename(track.title)}.${type === 'audio' ? 'mp3' : 'mp4'}`;

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);

    const entry = { ...track, type, filename, downloadedAt: Date.now() };
    downloads.unshift(entry);
    store.set(KEYS.DOWNLOADS, downloads);
    showToast(`Saved as "${filename}"`);
  } catch (err) {
    console.error(err);
    showToast('Download failed. Check your connection and try again.');
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
      <div class="track-top">
        <img class="track-thumb" src="${item.thumbnail || ''}" alt="" onerror="this.style.visibility='hidden'" />
        <div class="track-body">
          <p class="track-title">${escapeHtml(item.title)}</p>
          <p class="track-sub">${item.type === 'audio' ? 'MP3' : 'MP4'} · ${escapeHtml(item.filename || '')}</p>
        </div>
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
function applyTheme(t) {
  theme = t;
  document.documentElement.setAttribute('data-theme', t);
  document.querySelectorAll('.theme-opt').forEach((btn) => btn.classList.toggle('active', btn.dataset.theme === t));
  store.set(KEYS.THEME, t);
}

function initSettings() {
  applyTheme(theme);

  document.querySelectorAll('.theme-opt').forEach((btn) => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
  });

  document.getElementById('clearLibraryBtn').addEventListener('click', () => {
    if (!confirm('Clear your entire library? This cannot be undone.')) return;
    library = [];
    store.set(KEYS.LIBRARY, library);
    renderLibrary();
    showToast('Library cleared.');
  });

  document.getElementById('clearDownloadsBtn').addEventListener('click', () => {
    if (!confirm('Clear your downloads history? Files already saved to your device will stay.')) return;
    downloads = [];
    store.set(KEYS.DOWNLOADS, downloads);
    renderDownloads();
    showToast('Downloads history cleared.');
  });

  document.getElementById('clearRecentsBtn').addEventListener('click', () => {
    if (!confirm('Clear your recent searches?')) return;
    recents = [];
    store.set(KEYS.RECENTS, recents);
    renderRecents();
    showToast('Recent searches cleared.');
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
  initSuggestions();
  initSearch();
  initSettings();
  initAudioPlayerControls();
  initVideoPlayerControls();
  renderRecents();
  renderCategories();
  registerServiceWorker();
});
