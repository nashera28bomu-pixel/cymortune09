/**
 * app.js
 * Fixed: Router init order + window.CT_Pages export + safe routing checks
 */

const { toast, songCard, albumCard, artistCard, playlistCard, songRow, section, skeletonRow, errorStateHtml, emptyStateHtml, bindGlobalSongInteractions, formatDuration, escapeHtml } = CT_UI;

let router;

document.addEventListener('DOMContentLoaded', () => {
  // 1. CREATE ROUTER FIRST
  router = new Router('#app-view'); // make sure this selector exists in HTML

  initLanding();
  initShellChrome();
  initMiniPlayer();
  initFullPlayer();
  initServiceWorker();
  initInstallPrompt();
  initOfflineBanner();
  initKeyboardShortcuts();
});

/* ================= Landing -> App handoff ================= */

function initLanding() {
  const landing = document.getElementById('landing');
  const shell = document.getElementById('app-shell');

  const enterApp = (path) => {
    landing.hidden = true;
    shell.hidden = false;
    try { router.navigate(path); } catch(e){ console.error('router.navigate failed:', e); }
  };

  document.getElementById('cta-start')?.addEventListener('click', () => enterApp('/home'));
  document.querySelectorAll('[data-nav-explore]').forEach((btn) => btn.addEventListener('click', () => enterApp('/search')));

  const hasHistory = CT_Storage.History.recentlyPlayed().length > 0;
  if (hasHistory &&!location.hash.includes('landing')) {
    landing.hidden = true;
    shell.hidden = false;
    enterApp('/home'); // always navigate when skipping landing
  }

  animateHeroStats();
}

function animateHeroStats() {
  document.querySelectorAll('[data-count-to]').forEach((el) => {
    const target = Number(el.dataset.countTo);
    const duration = 1400;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased).toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
    }
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        requestAnimationFrame(tick);
        io.disconnect();
      }
    });
    io.observe(el);
  });
}

/* ================= Shell chrome: sidebar, bottom nav, top search ================= */

function initShellChrome() {
  const globalSearchForm = document.getElementById('global-search-form');
  globalSearchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('global-search-input').value.trim();
    if (!q) return;
    CT_Storage.SearchHistory.add(q);
    sessionStorage.setItem('ct_pending_query', q);

    // FIX: don't assume router.currentPath exists
    const onSearch = location.hash.includes('/search') || location.pathname === '/search';
    if (onSearch) {
      window.CT_Pages.search();
    } else {
      router.navigate('/search');
    }
  });

  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('app-shell').classList.toggle('sidebar-open');
  });

  // Auto-bind [data-route] for bottom nav + cards
  document.body.addEventListener('click', (e) => {
    const el = e.target.closest('[data-route]');
    if (!el) return;
    e.preventDefault();
    router.navigate(el.dataset.route);
  });
}

/* ================= Mini player ================= */

function initMiniPlayer() {
  const mini = document.getElementById('mini-player');
  const art = document.getElementById('mini-art');
  const title = document.getElementById('mini-title');
  const artist = document.getElementById('mini-artist');
  const playBtn = document.getElementById('mini-play');
  const progress = document.getElementById('mini-progress-bar');
  const nextBtn = document.getElementById('mini-next');
  const prevBtn = document.getElementById('mini-prev');

  function render(song) {
    if (!song) { mini.hidden = true; return; }
    mini.hidden = false;
    art.src = song.artwork;
    title.textContent = song.title;
    artist.textContent = song.artist;
  }

  render(CT_Player.current());
  CT_Player.addEventListener('song-changed', (e) => render(e.detail.song));
  CT_Player.addEventListener('play-state', (e) => {
    playBtn.innerHTML = e.detail.playing
     ? '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    document.body.classList.toggle('is-playing', e.detail.playing);
  });
  CT_Player.addEventListener('time-update', (e) => {
    const { currentTime, duration } = e.detail;
    if (duration) progress.style.width = `${(currentTime / duration) * 100}%`;
  });
  CT_Player.addEventListener('error', (e) => toast(e.detail.message, 'error'));

  playBtn.addEventListener('click', () => CT_Player.toggle());
  nextBtn.addEventListener('click', () => CT_Player.next());
  prevBtn.addEventListener('click', () => CT_Player.previous());
  document.getElementById('mini-expand')?.addEventListener('click', () => {
    const song = CT_Player.current();
    if (song) router.navigate(`/song/${song.id}`);
  });
  document.getElementById('mini-progress-track')?.addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    CT_Player.seekByRatio((e.clientX - rect.left) / rect.width);
  });
}

/* ================= Full-screen player ================= */
function initFullPlayer() {
  const full = document.getElementById('full-player');
  const els = {
    art: document.getElementById('full-art'), title: document.getElementById('full-title'),
    artist: document.getElementById('full-artist'), current: document.getElementById('full-time-current'),
    duration: document.getElementById('full-time-duration'), seek: document.getElementById('full-seek'),
    play: document.getElementById('full-play'), shuffle: document.getElementById('full-shuffle'),
    repeat: document.getElementById('full-repeat'), fav: document.getElementById('full-fav'),
    speed: document.getElementById('full-speed'), volume: document.getElementById('full-volume'),
  };

  function render(song) {
    if (!song) return;
    els.art.src = song.artwork;
    els.title.textContent = song.title;
    els.artist.textContent = song.artist;
    els.fav.classList.toggle('is-active', CT_Storage.Favorites.has(song.id));
  }

  CT_Player.addEventListener('song-changed', (e) => render(e.detail.song));
  CT_Player.addEventListener('play-state', (e) => {
    els.play.innerHTML = e.detail.playing
     ? '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    els.art.classList.toggle('is-spinning', e.detail.playing);
  });
  CT_Player.addEventListener('time-update', (e) => {
    const { currentTime, duration } = e.detail;
    els.current.textContent = formatDuration(currentTime);
    els.duration.textContent = formatDuration(duration);
    if (duration) els.seek.value = (currentTime / duration) * 100;
  });
  CT_Player.addEventListener('state-changed', () => {
    els.shuffle.classList.toggle('is-active', CT_Player.shuffleOn);
    els.repeat.classList.toggle('is-active', CT_Player.repeatMode!== 'off');
    els.repeat.dataset.mode = CT_Player.repeatMode;
  });

  els.play.addEventListener('click', () => CT_Player.toggle());
  document.getElementById('full-next')?.addEventListener('click', () => CT_Player.next());
  document.getElementById('full-prev')?.addEventListener('click', () => CT_Player.previous());
  els.shuffle.addEventListener('click', () => CT_Player.toggleShuffle());
  els.repeat.addEventListener('click', () => CT_Player.cycleRepeat());
  els.seek.addEventListener('input', () => CT_Player.seekByRatio(els.seek.value / 100));
  els.speed?.addEventListener('change', () => CT_Player.setSpeed(Number(els.speed.value)));
  els.volume?.addEventListener('input', () => CT_Player.setVolume(els.volume.value / 100));
  els.fav.addEventListener('click', () => {
    const song = CT_Player.current(); if (!song) return;
    const nowFav = CT_Storage.Favorites.toggle(song);
    els.fav.classList.toggle('is-active', nowFav);
  });
  document.getElementById('full-close')?.addEventListener('click', () => full.classList.remove('is-open'));
  document.getElementById('mini-expand')?.addEventListener('click', () => full.classList.add('is-open'));
  document.getElementById('full-queue-btn')?.addEventListener('click', () => renderQueueSheet());
}

function renderQueueSheet() { /* same as yours, unchanged */
  const modal = document.getElementById('modal-host');
  const queue = CT_Player.queue;
  modal.innerHTML = `
    <div class="sheet-backdrop" data-close-sheet>
      <div class="sheet sheet--queue" role="dialog" aria-label="Queue">
        <div class="sheet__handle"></div><h3>Up next</h3>
        <div class="sheet__queue-list">
          ${queue.map((s, i) => `
            <div class="queue-item ${i === CT_Player.index? 'is-current' : ''}" data-queue-idx="${i}">
              <img src="${s.artwork}" alt="" onerror="this.src='assets/images/placeholder-art.svg'">
              <div class="queue-item__meta"><div>${escapeHtml(s.title)}</div><small>${escapeHtml(s.artist)}</small></div>
              ${i!== CT_Player.index? `<button class="icon-btn" data-remove-queue="${i}">✕</button>` : ''}
            </div>`).join('') || '<p class="muted">Queue is empty.</p>'}
        </div>
      </div>
    </div>`;
  modal.querySelector('[data-close-sheet]').addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-close-sheet')) CT_UI.closeModal();
  });
  modal.querySelectorAll('[data-queue-idx]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-remove-queue]')) return;
      CT_Player.index = Number(el.dataset.queueIdx);
      CT_Player._loadSource(CT_Player.current(), { autoplay: true });
      CT_UI.closeModal();
    });
  });
  modal.querySelectorAll('[data-remove-queue]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      CT_Player.removeFromQueue(Number(el.dataset.removeQueue));
      renderQueueSheet();
    });
  });
}

/* ================= PWA + Utils ================= */
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch((err) => console.error('[sw] register failed', err));
    });
  }
}
let deferredInstallPrompt = null;
function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredInstallPrompt = e;
    document.getElementById('install-banner')?.removeAttribute('hidden');
  });
  document.getElementById('install-accept')?.addEventListener('click', async () => {
    document.getElementById('install-banner')?.setAttribute('hidden', '');
    if (deferredInstallPrompt) { deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; }
  });
  document.getElementById('install-dismiss')?.addEventListener('click', () => {
    document.getElementById('install-banner')?.setAttribute('hidden', '');
  });
}
function initOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  const update = () => banner?.toggleAttribute('hidden', navigator.onLine);
  window.addEventListener('online', update); window.addEventListener('offline', update); update();
}
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); CT_Player.toggle(); }
    if (e.code === 'ArrowRight' && e.shiftKey) CT_Player.next();
    if (e.code === 'ArrowLeft' && e.shiftKey) CT_Player.previous();
    if (e.key === 'Escape') {
      document.getElementById('full-player')?.classList.remove('is-open');
      CT_UI.closeModal();
    }
  });
}

/* ================= Page controllers ================= */
const CT_Pages = {};

CT_Pages.home = async function () { /*... same as your version... */
  const root = document.querySelector('[data-page="home"]');
  root.innerHTML = ['trending-songs','trending-albums','trending-artists','featured-playlists','recently-played','favorites','new-releases']
   .map((id) => `<div id="home-${id}"></div>`).join('');
  renderHomeLocalSections();
  const slots = [
    { id: 'home-trending-songs', title: 'Trending Songs', fn: () => CT_Api.trending({ type: 'songs' }), render: (items) => items.map(songCard).join(''), type: 'songs' },
    { id: 'home-trending-albums', title: 'Trending Albums', fn: () => CT_Api.trending({ type: 'albums' }), render: (items) => items.map(albumCard).join(''), type: 'albums' },
    { id: 'home-trending-artists', title: 'Trending Artists', fn: () => CT_Api.trending({ type: 'artists' }), render: (items) => items.map(artistCard).join(''), type: 'artists' },
    { id: 'home-featured-playlists', title: 'Featured Playlists', fn: () => CT_Api.featuredPlaylists(), render: (items) => items.map(playlistCard).join(''), type: 'playlists' },
    { id: 'home-new-releases', title: 'New Releases', fn: () => CT_Api.newReleases(), render: (items) => items.map(albumCard).join(''), type: 'albums' },
  ];
  for (const slot of slots) {
    const host = document.getElementById(slot.id);
    host.innerHTML = section(slot.title, skeletonRow(6));
    try {
      const items = await slot.fn();
      if (!items ||!items.length) { host.innerHTML = ''; continue; }
      host.innerHTML = section(slot.title, slot.render(items));
      if (slot.type === 'songs') bindGlobalSongInteractions(host, items);
    } catch (err) {
      host.innerHTML = section(slot.title, `<div class="inline-error">${errorStateHtml(err)}</div>`);
    }
  }
};

function renderHomeLocalSections() { /*... same... */
  const recent = CT_Storage.History.recentlyPlayed().slice(0, 10);
  const favs = CT_Storage.Favorites.all().slice(0, 10);
  const recentHost = document.getElementById('home-recently-played');
  if (recent.length) { recentHost.innerHTML = section('Continue Listening', recent.map(songCard).join('')); bindGlobalSongInteractions(recentHost, recent); }
  const favHost = document.getElementById('home-favorites');
  if (favs.length) { favHost.innerHTML = section('Your Favorites', favs.map(songCard).join(''), { seeAllRoute: '/favorites' }); bindGlobalSongInteractions(favHost, favs); }
}

CT_Pages.search = async function () { /*... same as your version... */
  const root = document.querySelector('[data-page="search"]');
  const input = document.getElementById('search-input');
  const resultsHost = document.getElementById('search-results');
  const pending = sessionStorage.getItem('ct_pending_query');
  if (pending) { input.value = pending; sessionStorage.removeItem('ct_pending_query'); }
  renderSearchLanding();
  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    document.getElementById('search-clear').hidden =!q;
    if (!q) return renderSearchLanding();
    debounceTimer = setTimeout(() => runSearch(q), 350);
  });
  document.getElementById('search-clear').addEventListener('click', () => {
    input.value = ''; document.getElementById('search-clear').hidden = true; renderSearchLanding(); input.focus();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      CT_Storage.SearchHistory.add(input.value.trim()); runSearch(input.value.trim());
    }
  });
  if (pending) runSearch(pending); input.focus();
  function renderSearchLanding() {
    const recent = CT_Storage.SearchHistory.all();
    resultsHost.innerHTML = `
      ${recent.length? `<div class="search-recent"><div class="section__head"><h2>Recent searches</h2>
        <button class="section__see-all" id="clear-recent-search">Clear</button></div>
        <div class="chip-row">${recent.map((q) => `<button class="chip" data-recent-query="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join('')}</div></div>` : ''}
      ${emptyStateHtml({ icon: '🔎', title: 'Find your sound', message: 'Search any song, artist, album, or playlist.' })}`;
    document.getElementById('clear-recent-search')?.addEventListener('click', () => { CT_Storage.SearchHistory.clear(); renderSearchLanding(); });
    resultsHost.querySelectorAll('[data-recent-query]').forEach((chip) => {
      chip.addEventListener('click', () => { input.value = chip.dataset.recentQuery; runSearch(input.value); });
    });
  }
  async function runSearch(q) {
    resultsHost.innerHTML = skeletonRow(8, 'row');
    try {
      const { songs, albums, artists, playlists } = await CT_Api.search(q);
      if (!songs.length &&!albums.length &&!artists.length &&!playlists.length) {
        resultsHost.innerHTML = emptyStateHtml({ icon: '🙈', title: 'No results', message: `Nothing matched "${q}".` }); return;
      }
      resultsHost.innerHTML = `
        ${songs.length? section('Songs', songs.slice(0, 8).map((s, i) => songRow(s, { index: i })).join(''), {}) : ''}
        ${artists.length? section('Artists', artists.map(artistCard).join('')) : ''}
        ${albums.length? section('Albums', albums.map(albumCard).join('')) : ''}
        ${playlists.length? section('Playlists', playlists.map(playlistCard).join('')) : ''}`;
      bindGlobalSongInteractions(resultsHost, songs);
    } catch (err) { resultsHost.innerHTML = errorStateHtml(err); }
  }
};

CT_Pages.song = async function (id) { /*... same... */
  const root = document.querySelector('[data-page="song"]'); root.innerHTML = skeletonRow(1, 'hero');
  try {
    const song = await CT_Api.getSong(id); CT_Storage.History.addSong(song);
    const isFav = CT_Storage.Favorites.has(song.id);
    root.innerHTML = `<div class="song-detail"><img class="song-detail__art" src="${song.artwork}" alt="" onerror="this.src='assets/images/placeholder-art.svg'">
      <h1>${escapeHtml(song.title)}</h1><p class="song-detail__artist">${escapeHtml(song.artist)}${song.album? ' · ' + escapeHtml(song.album) : ''}</p>
      <p class="song-detail__meta">${formatDuration(song.duration)}${song.language? ' · ' + escapeHtml(song.language) : ''}</p>
      <div class="song-detail__actions"><button class="btn btn--primary" id="song-play">▶ Play</button>
      <button class="icon-btn ${isFav? 'is-active' : ''}" id="song-fav">♥</button>
      <button class="icon-btn" id="song-download">⬇</button><button class="icon-btn" id="song-share">↗</button>
      ${song.hasLyrics? '<button class="icon-btn" id="song-lyrics">🎤</button>' : ''}</div><div id="song-related"></div></div>`;
    document.getElementById('song-play').addEventListener('click', () => CT_Player.playSong(song));
    document.getElementById('song-fav').addEventListener('click', (e) => { const nowFav = CT_Storage.Favorites.toggle(song); e.currentTarget.classList.toggle('is-active', nowFav); });
    document.getElementById('song-download').addEventListener('click', () => CT_Pages.downloadToggle(song));
    document.getElementById('song-share').addEventListener('click', () => sharePayload(song.title + ' — ' + song.artist, location.href));
    document.getElementById('song-lyrics')?.addEventListener('click', () => CT_Pages.showLyrics(song));
    const relatedHost = document.getElementById('song-related'); relatedHost.innerHTML = section('Related Songs', skeletonRow(4, 'row'));
    try { const related = await CT_Api.recommendations(id); relatedHost.innerHTML = related.length? section('Related Songs', related.map((s, i) => songRow(s, { index: i })).join('')) : ''; bindGlobalSongInteractions(relatedHost, related); } catch { relatedHost.innerHTML = ''; }
  } catch (err) { root.innerHTML = errorStateHtml(err); }
};

CT_Pages.showLyrics = function (song) { /*... same... */
  const modal = document.getElementById('modal-host');
  modal.innerHTML = `<div class="sheet-backdrop" data-close-sheet><div class="sheet sheet--lyrics"><div class="sheet__handle"></div>
    <h3>${escapeHtml(song.title)}</h3><div class="lyrics-body">${song.lyrics? escapeHtml(song.lyrics).replace(/\n/g, '<br>') : 'Lyrics unavailable.'}</div></div></div>`;
  modal.querySelector('[data-close-sheet]').addEventListener('click', (e) => { if (e.target.hasAttribute('data-close-sheet')) CT_UI.closeModal(); });
};

CT_Pages.album = async function (id) { /*... same... */ }
CT_Pages.artist = async function (id) { /*... same... */ }
CT_Pages.playlist = async function (id) { /*... same... */ }
function renderLocalPlaylist(root, playlist) { /*... same... */ }
CT_Pages.playlistsIndex = function () { /*... same... */ }
CT_Pages.favorites = function () { /*... same... */ }
CT_Pages.history = function () { /*... same... */ }
CT_Pages.downloads = function () { /*... same... */ }
function renderDownloadsList(root, list) { /*... same... */ }
CT_Pages.downloadToggle = async function (song, silent = false) { /*... same... */ }
CT_Pages.settings = function () { /*... same... */ }
function sharePayload(title, url) {
  if (navigator.share) { navigator.share({ title, url }).catch(() => {}); }
  else { navigator.clipboard?.writeText(url); toast('Link copied'); }
}

// CRITICAL FIX: expose it globally for router.js
window.CT_Pages = CT_Pages;
