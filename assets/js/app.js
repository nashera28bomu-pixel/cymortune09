/**
 * app.js
 * Boots the app shell (landing → home handoff, mini player, sidebar,
 * bottom nav, PWA install, offline banner) and defines every page
 * controller under window.CT_Pages, called by router.js after each
 * template swap.
 */

// Guards against a duplicate <script src="app.js"> tag causing this whole
// file to execute twice (which previously crashed with "Identifier 'toast'
// has already been declared", since a second run redeclares top-level
// const/let bindings in the same script scope).
if (window.__CT_APP_LOADED__) {
  console.warn('[app.js] loaded more than once — skipping duplicate execution. Check index.html for a repeated <script src="/assets/js/app.js"> tag.');
} else {
  window.__CT_APP_LOADED__ = true;

  (function () {
    const { toast, songCard, albumCard, artistCard, playlistCard, songRow, section, skeletonRow, errorStateHtml, emptyStateHtml, bindGlobalSongInteractions, formatDuration, escapeHtml } = CT_UI;

    let router;

    document.addEventListener('DOMContentLoaded', () => {
      const boot = [
        ['router', () => { router = new Router('#app-view'); }],
        ['landing', initLanding],
        ['shell chrome', initShellChrome],
        ['mini player', initMiniPlayer],
        ['full player', initFullPlayer],
        ['service worker', initServiceWorker],
    ['install prompt', initInstallPrompt],
    ['offline banner', initOfflineBanner],
    ['keyboard shortcuts', initKeyboardShortcuts],
  ];
  for (const [label, fn] of boot) {
    try {
      fn();
    } catch (err) {
      console.error(`[boot] ${label} failed:`, err);
      window.CT_reportError?.(`Boot step "${label}" failed: ${err.message}`);
    }
  }
});

/* ================= Landing → App handoff ================= */

function initLanding() {
  const landing = document.getElementById('landing');
  const shell = document.getElementById('app-shell');
  const enterApp = (path) => {
    landing.hidden = true;
    shell.hidden = false;
    router.navigate(path);
  };

  document.getElementById('cta-start')?.addEventListener('click', () => enterApp('/home'));
  document.querySelectorAll('[data-nav-explore]').forEach((btn) => btn.addEventListener('click', () => enterApp('/search')));

  // Skip landing automatically if the visitor already has data on this device
  let hasHistory = false;
  try {
    hasHistory = CT_Storage.History.recentlyPlayed().length > 0;
  } catch (err) {
    console.error('[landing] history check failed:', err);
  }
  if (hasHistory && !location.hash.includes('landing')) {
    landing.hidden = true;
    shell.hidden = false;
    router.start();
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
    if (location.pathname === '/search') {
      window.CT_Pages.search();
    } else {
      router.navigate('/search');
    }
  });

  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('app-shell').classList.toggle('sidebar-open');
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
    if (!song) {
      mini.hidden = true;
      return;
    }
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
    art: document.getElementById('full-art'),
    title: document.getElementById('full-title'),
    artist: document.getElementById('full-artist'),
    current: document.getElementById('full-time-current'),
    duration: document.getElementById('full-time-duration'),
    seek: document.getElementById('full-seek'),
    play: document.getElementById('full-play'),
    shuffle: document.getElementById('full-shuffle'),
    repeat: document.getElementById('full-repeat'),
    fav: document.getElementById('full-fav'),
    download: document.getElementById('full-download'),
    speed: document.getElementById('full-speed'),
    volume: document.getElementById('full-volume'),
  };

  function render(song) {
    if (!song) return;
    els.art.src = song.artwork;
    els.title.textContent = song.title;
    els.artist.textContent = song.artist;
    els.fav.classList.toggle('is-active', CT_Storage.Favorites.has(song.id));
    els.download.classList.toggle('is-active', CT_Storage.Downloads.has(song.id));
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
    els.repeat.classList.toggle('is-active', CT_Player.repeatMode !== 'off');
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
    const song = CT_Player.current();
    if (!song) return;
    const nowFav = CT_Storage.Favorites.toggle(song);
    els.fav.classList.toggle('is-active', nowFav);
  });
  els.download.addEventListener('click', async () => {
    const song = CT_Player.current();
    if (!song) return;
    await CT_Pages.downloadToggle(song);
    els.download.classList.toggle('is-active', CT_Storage.Downloads.has(song.id));
  });
  document.getElementById('full-close')?.addEventListener('click', () => full.classList.remove('is-open'));
  document.getElementById('mini-expand')?.addEventListener('click', () => full.classList.add('is-open'));
  document.getElementById('full-queue-btn')?.addEventListener('click', () => renderQueueSheet());
}

function renderQueueSheet() {
  const modal = document.getElementById('modal-host');
  const queue = CT_Player.queue;
  modal.innerHTML = `
    <div class="sheet-backdrop" data-close-sheet>
      <div class="sheet sheet--queue" role="dialog" aria-label="Queue">
        <div class="sheet__handle"></div>
        <h3>Up next</h3>
        <div class="sheet__queue-list">
          ${queue.map((s, i) => `
            <div class="queue-item ${i === CT_Player.index ? 'is-current' : ''}" data-queue-idx="${i}">
              <img src="${s.artwork}" alt="" onerror="this.src='/assets/images/placeholder-art.svg'">
              <div class="queue-item__meta"><div>${escapeHtml(s.title)}</div><small>${escapeHtml(s.artist)}</small></div>
              ${i !== CT_Player.index ? `<button class="icon-btn" data-remove-queue="${i}">✕</button>` : ''}
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

/* ================= PWA: service worker, install prompt, offline banner ================= */

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
    e.preventDefault();
    deferredInstallPrompt = e;
    document.getElementById('install-banner')?.removeAttribute('hidden');
  });
  document.getElementById('install-accept')?.addEventListener('click', async () => {
    document.getElementById('install-banner')?.setAttribute('hidden', '');
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
    }
  });
  document.getElementById('install-dismiss')?.addEventListener('click', () => {
    document.getElementById('install-banner')?.setAttribute('hidden', '');
  });
}

function initOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  const update = () => banner?.toggleAttribute('hidden', navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      CT_Player.toggle();
    }
    if (e.code === 'ArrowRight' && e.shiftKey) CT_Player.next();
    if (e.code === 'ArrowLeft' && e.shiftKey) CT_Player.previous();
    if (e.key === 'Escape') {
      document.getElementById('full-player')?.classList.remove('is-open');
      CT_UI.closeModal();
    }
  });
}

/* ================= Page controllers (CT_Pages) ================= */

const CT_Pages = {};

// This backend has no discovery/trending/charts endpoint — only search and
// lookup-by-id. These seed queries stand in for a "what's popular" feed by
// running real searches behind the scenes. Swap/add terms any time.
const HOME_SEED_QUERIES = ['Diamond Platnumz', 'Sauti Sol', 'Arijit Singh', 'Imagine Dragons', 'Burna Boy', 'Nyashinski', 'Bollywood love songs', 'Afrobeats hits'];

function pickSeeds(count) {
  const shuffled = [...HOME_SEED_QUERIES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

CT_Pages.home = async function () {
  const root = document.querySelector('[data-page="home"]');
  const [seedA, seedB, seedC] = pickSeeds(3);
  root.innerHTML = [
    'recently-played',
    'favorites',
    `songs-a::${seedA}`,
    'artists',
    `songs-b::${seedB}`,
    'albums',
    `songs-c::${seedC}`,
    'popular-searches',
  ]
    .map((slot) => `<div id="home-${slot.split('::')[0]}" data-seed="${slot.split('::')[1] || ''}"></div>`)
    .join('');

  renderHomeLocalSections();
  renderPopularSearchChips();

  // Three independent song rows, each seeded with a different query, so the
  // page has real variety rather than one thin list.
  document.querySelectorAll('[id^="home-songs-"]').forEach((host) => {
    const seed = host.dataset.seed;
    loadSongRow(host, seed);
  });

  const artistsHost = document.getElementById('home-artists');
  artistsHost.innerHTML = section('Artists to explore', skeletonRow(6));
  try {
    const results = await Promise.all(pickSeeds(6).map((q) => CT_Api.searchArtists(q, 1).then((r) => r[0]).catch(() => null)));
    const artists = results.filter(Boolean);
    artistsHost.innerHTML = artists.length ? section('Artists to explore', artists.map(artistCard).join('')) : '';
  } catch {
    artistsHost.innerHTML = '';
  }

  const albumsHost = document.getElementById('home-albums');
  albumsHost.innerHTML = section('Albums to explore', skeletonRow(6));
  try {
    const results = await Promise.all(pickSeeds(4).map((q) => CT_Api.searchAlbums(q, 2).catch(() => [])));
    const albums = results.flat();
    albumsHost.innerHTML = albums.length ? section('Albums to explore', albums.map(albumCard).join('')) : '';
  } catch {
    albumsHost.innerHTML = '';
  }
};

async function loadSongRow(host, seed) {
  const title = `Songs for "${seed}"`;
  host.innerHTML = section(title, skeletonRow(6));
  try {
    const songs = await CT_Api.searchSongs(seed, 10);
    host.innerHTML = songs.length ? section(title, songs.map(songCard).join('')) : '';
    bindGlobalSongInteractions(host, songs);
  } catch (err) {
    host.innerHTML = section(title, `<div class="inline-error">${errorStateHtml(err)}</div>`);
  }
}

function renderPopularSearchChips() {
  const host = document.getElementById('home-popular-searches');
  host.innerHTML = `
    <div class="section">
      <div class="section__head"><h2>Popular searches</h2></div>
      <div class="chip-row">
        ${HOME_SEED_QUERIES.map((q) => `<button class="chip" data-seed-query="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join('')}
      </div>
    </div>`;
  host.querySelectorAll('[data-seed-query]').forEach((chip) => {
    chip.addEventListener('click', () => {
      sessionStorage.setItem('ct_pending_query', chip.dataset.seedQuery);
      router.navigate('/search');
    });
  });
}

function renderHomeLocalSections() {
  const recent = CT_Storage.History.recentlyPlayed().slice(0, 10);
  const favs = CT_Storage.Favorites.all().slice(0, 10);

  const recentHost = document.getElementById('home-recently-played');
  if (recent.length) {
    recentHost.innerHTML = section('Continue Listening', recent.map(songCard).join(''));
    bindGlobalSongInteractions(recentHost, recent);
  }

  const favHost = document.getElementById('home-favorites');
  if (favs.length) {
    favHost.innerHTML = section('Your Favorites', favs.map(songCard).join(''), { seeAllRoute: '/favorites' });
    bindGlobalSongInteractions(favHost, favs);
  }
}

CT_Pages.search = async function () {
  const root = document.querySelector('[data-page="search"]');
  const input = document.getElementById('search-input');
  const resultsHost = document.getElementById('search-results');
  const pending = sessionStorage.getItem('ct_pending_query');
  if (pending) {
    input.value = pending;
    sessionStorage.removeItem('ct_pending_query');
  }

  renderSearchLanding();

  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    document.getElementById('search-clear').hidden = !q;
    if (!q) return renderSearchLanding();
    debounceTimer = setTimeout(() => runSearch(q), 350);
  });
  document.getElementById('search-clear').addEventListener('click', () => {
    input.value = '';
    document.getElementById('search-clear').hidden = true;
    renderSearchLanding();
    input.focus();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      CT_Storage.SearchHistory.add(input.value.trim());
      runSearch(input.value.trim());
    }
  });

  if (pending) runSearch(pending);
  input.focus();

  function renderSearchLanding() {
    const recent = CT_Storage.SearchHistory.all();
    resultsHost.innerHTML = `
      ${recent.length ? `
        <div class="search-recent">
          <div class="section__head"><h2>Recent searches</h2>
            <button class="section__see-all" id="clear-recent-search">Clear</button></div>
          <div class="chip-row">
            ${recent.map((q) => `<button class="chip" data-recent-query="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join('')}
          </div>
        </div>` : ''}
      ${emptyStateHtml({ icon: '🔎', title: 'Find your sound', message: 'Search any song, artist, album, or playlist.' })}`;
    document.getElementById('clear-recent-search')?.addEventListener('click', () => {
      CT_Storage.SearchHistory.clear();
      renderSearchLanding();
    });
    resultsHost.querySelectorAll('[data-recent-query]').forEach((chip) => {
      chip.addEventListener('click', () => {
        input.value = chip.dataset.recentQuery;
        runSearch(input.value);
      });
    });
  }

  async function runSearch(q) {
    resultsHost.innerHTML = skeletonRow(8, 'row');
    try {
      const { songs, albums, artists, playlists } = await CT_Api.search(q);
      if (!songs.length && !albums.length && !artists.length && !playlists.length) {
        resultsHost.innerHTML = emptyStateHtml({ icon: '🙈', title: 'No results', message: `Nothing matched "${q}". Try a different spelling or artist name.` });
        return;
      }
      resultsHost.innerHTML = `
        ${songs.length ? section('Songs', songs.slice(0, 8).map((s, i) => songRow(s, { index: i })).join(''), {}) : ''}
        ${artists.length ? section('Artists', artists.map(artistCard).join('')) : ''}
        ${albums.length ? section('Albums', albums.map(albumCard).join('')) : ''}
        ${playlists.length ? section('Playlists', playlists.map(playlistCard).join('')) : ''}
      `;
      bindGlobalSongInteractions(resultsHost, songs);
    } catch (err) {
      resultsHost.innerHTML = errorStateHtml(err);
    }
  }
};

CT_Pages.song = async function (id) {
  const root = document.querySelector('[data-page="song"]');
  root.innerHTML = skeletonRow(1, 'hero');
  try {
    const song = await CT_Api.getSong(id);
    CT_Storage.History.addSong(song);
    const isFav = CT_Storage.Favorites.has(song.id);
    root.innerHTML = `
      <div class="song-detail">
        <img class="song-detail__art" src="${song.artwork}" alt="" onerror="this.src='/assets/images/placeholder-art.svg'">
        <h1>${escapeHtml(song.title)}</h1>
        <p class="song-detail__artist">${escapeHtml(song.artist)}${song.album ? ' · ' + escapeHtml(song.album) : ''}</p>
        <p class="song-detail__meta">${formatDuration(song.duration)}${song.language ? ' · ' + escapeHtml(song.language) : ''}</p>
        <div class="song-detail__actions">
          <button class="btn btn--primary" id="song-play">▶ Play</button>
          <button class="icon-btn ${isFav ? 'is-active' : ''}" id="song-fav">♥</button>
          <button class="icon-btn" id="song-download">⬇</button>
          <button class="icon-btn" id="song-share">↗</button>
          ${song.hasLyrics ? '<button class="icon-btn" id="song-lyrics">🎤</button>' : ''}
        </div>
        <div id="song-related"></div>
      </div>`;
    document.getElementById('song-play').addEventListener('click', () => CT_Player.playSong(song));
    document.getElementById('song-fav').addEventListener('click', (e) => {
      const nowFav = CT_Storage.Favorites.toggle(song);
      e.currentTarget.classList.toggle('is-active', nowFav);
    });
    document.getElementById('song-download').addEventListener('click', () => CT_Pages.downloadToggle(song));
    document.getElementById('song-share').addEventListener('click', () => sharePayload(song.title + ' — ' + song.artist, location.href));
    document.getElementById('song-lyrics')?.addEventListener('click', () => CT_Pages.showLyrics(song));

    const relatedHost = document.getElementById('song-related');
    relatedHost.innerHTML = section('Related Songs', skeletonRow(4, 'row'));
    try {
      const related = await CT_Api.recommendations(id);
      relatedHost.innerHTML = related.length ? section('Related Songs', related.map((s, i) => songRow(s, { index: i })).join('')) : '';
      bindGlobalSongInteractions(relatedHost, related);
    } catch {
      relatedHost.innerHTML = '';
    }
  } catch (err) {
    root.innerHTML = errorStateHtml(err);
  }
};

CT_Pages.showLyrics = async function (song) {
  const modal = document.getElementById('modal-host');
  modal.innerHTML = `
    <div class="sheet-backdrop" data-close-sheet>
      <div class="sheet sheet--lyrics">
        <div class="sheet__handle"></div>
        <h3>${escapeHtml(song.title)}</h3>
        <div class="lyrics-body" id="lyrics-body">${skeletonRow(3, 'row')}</div>
      </div>
    </div>`;
  modal.querySelector('[data-close-sheet]').addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-close-sheet')) CT_UI.closeModal();
  });
  const body = document.getElementById('lyrics-body');
  try {
    const lyrics = await CT_Api.getSongLyrics(song.lyricsId || song.id);
    body.innerHTML = lyrics ? escapeHtml(lyrics).replace(/\n/g, '<br>') : 'Lyrics unavailable for this track.';
  } catch {
    body.innerHTML = 'Lyrics unavailable for this track.';
  }
};

CT_Pages.album = async function (id) {
  const root = document.querySelector('[data-page="album"]');
  root.innerHTML = skeletonRow(1, 'hero');
  try {
    const album = await CT_Api.getAlbum(id);
    CT_Storage.History.addViewed('albums', { id: album.id, name: album.name, artwork: album.artwork, artist: album.artist });
    root.innerHTML = `
      <div class="collection-header">
        <img src="${album.artwork}" alt="" onerror="this.src='/assets/images/placeholder-art.svg'">
        <div>
          <span class="eyebrow">Album</span>
          <h1>${escapeHtml(album.name)}</h1>
          <p>${escapeHtml(album.artist)}${album.year ? ' · ' + album.year : ''} · ${album.songs.length} songs</p>
          <div class="collection-header__actions">
            <button class="btn btn--primary" id="album-play-all">▶ Play All</button>
            <button class="btn btn--ghost" id="album-shuffle">🔀 Shuffle</button>
            <button class="icon-btn" id="album-download">⬇</button>
            <button class="icon-btn" id="album-fav">♥</button>
            <button class="icon-btn" id="album-share">↗</button>
          </div>
        </div>
      </div>
      <div class="song-list">${album.songs.map((s, i) => songRow(s, { index: i })).join('') || emptyStateHtml({ title: 'No tracks listed', message: 'This album has no playable songs yet.' })}</div>`;

    bindGlobalSongInteractions(root, album.songs);
    document.getElementById('album-play-all').addEventListener('click', () => CT_Player.playQueue(album.songs, 0));
    document.getElementById('album-shuffle').addEventListener('click', () => {
      CT_Player.playQueue(album.songs, 0);
      if (!CT_Player.shuffleOn) CT_Player.toggleShuffle();
    });
    document.getElementById('album-download').addEventListener('click', () => album.songs.forEach((s) => CT_Pages.downloadToggle(s, true)));
    document.getElementById('album-fav').addEventListener('click', () => toast('Album saved to favorites list per-song'));
    document.getElementById('album-share').addEventListener('click', () => sharePayload(album.name, location.href));
  } catch (err) {
    root.innerHTML = errorStateHtml(err);
  }
};

CT_Pages.artist = async function (id) {
  const root = document.querySelector('[data-page="artist"]');
  root.innerHTML = skeletonRow(1, 'hero');
  try {
    const artist = await CT_Api.getArtist(id);
    CT_Storage.History.addViewed('artists', { id: artist.id, name: artist.name, artwork: artist.image });
    root.innerHTML = `
      <div class="collection-header collection-header--artist">
        <img class="collection-header__round" src="${artist.image}" alt="" onerror="this.src='/assets/images/placeholder-art.svg'">
        <div>
          <span class="eyebrow">Artist</span>
          <h1>${escapeHtml(artist.name)}</h1>
          <div class="collection-header__actions">
            <button class="btn btn--primary" id="artist-play-all">▶ Play All</button>
            <button class="btn btn--ghost" id="artist-follow">＋ Follow</button>
          </div>
        </div>
      </div>
      ${artist.bio ? `<p class="artist-bio">${escapeHtml(artist.bio)}</p>` : ''}
      <div id="artist-top-songs"></div>
      <div id="artist-albums"></div>`;

    const topHost = document.getElementById('artist-top-songs');
    if (artist.topSongs.length) {
      topHost.innerHTML = section('Top Songs', artist.topSongs.map((s, i) => songRow(s, { index: i })).join(''));
      bindGlobalSongInteractions(topHost, artist.topSongs);
    }
    const albumHost = document.getElementById('artist-albums');
    if (artist.albums.length) albumHost.innerHTML = section('Albums', artist.albums.map(albumCard).join(''));

    document.getElementById('artist-play-all').addEventListener('click', () => {
      if (artist.topSongs.length) CT_Player.playQueue(artist.topSongs, 0);
      else toast('No playable songs for this artist yet');
    });
    document.getElementById('artist-follow').addEventListener('click', (e) => {
      const key = 'ct_followed_artists';
      const followed = JSON.parse(localStorage.getItem(key) || '[]');
      if (!followed.includes(artist.id)) {
        followed.push(artist.id);
        localStorage.setItem(key, JSON.stringify(followed));
        e.target.textContent = '✓ Following';
        toast('Following ' + artist.name);
      }
    });
  } catch (err) {
    root.innerHTML = errorStateHtml(err);
  }
};

CT_Pages.playlist = async function (id) {
  const root = document.querySelector('[data-page="playlist"]');
  const local = CT_Storage.Playlists.get(id);
  if (local) return renderLocalPlaylist(root, local);

  root.innerHTML = skeletonRow(1, 'hero');
  try {
    const playlist = await CT_Api.getPlaylist(id);
    CT_Storage.History.addViewed('playlists', { id: playlist.id, name: playlist.name, artwork: playlist.artwork });
    root.innerHTML = `
      <div class="collection-header">
        <img src="${playlist.artwork}" alt="" onerror="this.src='/assets/images/placeholder-art.svg'">
        <div>
          <span class="eyebrow">Playlist</span>
          <h1>${escapeHtml(playlist.name)}</h1>
          <p>${escapeHtml(playlist.description || '')}</p>
          <div class="collection-header__actions">
            <button class="btn btn--primary" id="pl-play-all">▶ Play All</button>
            <button class="btn btn--ghost" id="pl-shuffle">🔀 Shuffle</button>
            <button class="icon-btn" id="pl-fav">♥</button>
          </div>
        </div>
      </div>
      <div class="song-list">${playlist.songs.map((s, i) => songRow(s, { index: i })).join('') || emptyStateHtml({ title: 'Empty playlist', message: 'No songs here yet.' })}</div>`;
    bindGlobalSongInteractions(root, playlist.songs);
    document.getElementById('pl-play-all').addEventListener('click', () => CT_Player.playQueue(playlist.songs, 0));
    document.getElementById('pl-shuffle').addEventListener('click', () => {
      CT_Player.playQueue(playlist.songs, 0);
      if (!CT_Player.shuffleOn) CT_Player.toggleShuffle();
    });
  } catch (err) {
    root.innerHTML = errorStateHtml(err);
  }
};

function renderLocalPlaylist(root, playlist) {
  root.innerHTML = `
    <div class="collection-header">
      <div class="collection-header__local-art">🎼</div>
      <div>
        <span class="eyebrow">Your Playlist</span>
        <h1 id="pl-name-display">${escapeHtml(playlist.name)}</h1>
        <p>${playlist.songs.length} songs</p>
        <div class="collection-header__actions">
          <button class="btn btn--primary" id="pl-play-all" ${!playlist.songs.length ? 'disabled' : ''}>▶ Play All</button>
          <button class="btn btn--ghost" id="pl-shuffle" ${!playlist.songs.length ? 'disabled' : ''}>🔀 Shuffle</button>
          <button class="icon-btn" id="pl-rename">✎</button>
          <button class="icon-btn" id="pl-delete">🗑</button>
        </div>
      </div>
    </div>
    <div class="song-list">${playlist.songs.map((s, i) => songRow(s, { index: i, showRemove: true })).join('') || emptyStateHtml({ icon: '🎼', title: 'No songs yet', message: 'Add songs from any song menu using "Add to playlist".', actionLabel: 'Find music', actionRoute: '/search' })}</div>`;

  bindGlobalSongInteractions(root, playlist.songs);
  document.getElementById('pl-play-all')?.addEventListener('click', () => CT_Player.playQueue(playlist.songs, 0));
  document.getElementById('pl-shuffle')?.addEventListener('click', () => {
    CT_Player.playQueue(playlist.songs, 0);
    if (!CT_Player.shuffleOn) CT_Player.toggleShuffle();
  });
  document.getElementById('pl-rename').addEventListener('click', () => {
    const name = prompt('Rename playlist', playlist.name);
    if (name && name.trim()) {
      CT_Storage.Playlists.rename(playlist.id, name.trim());
      document.getElementById('pl-name-display').textContent = name.trim();
    }
  });
  document.getElementById('pl-delete').addEventListener('click', () => {
    if (confirm(`Delete "${playlist.name}"? This can't be undone.`)) {
      CT_Storage.Playlists.delete(playlist.id);
      router.navigate('/playlists');
    }
  });
  root.querySelectorAll('[data-row-remove]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      CT_Storage.Playlists.removeSong(playlist.id, btn.dataset.rowRemove);
      renderLocalPlaylist(root, CT_Storage.Playlists.get(playlist.id));
    });
  });
}

CT_Pages.playlistsIndex = function () {
  const root = document.querySelector('[data-page="playlist"]');
  const playlists = CT_Storage.Playlists.all();
  root.innerHTML = `
    <div class="section__head"><h1>Your Playlists</h1>
      <button class="btn btn--primary" id="new-playlist-btn">＋ New Playlist</button></div>
    <div class="card-grid">
      ${playlists.map((p) => `
        <a class="card card--playlist" data-route="/playlist/${p.id}">
          <div class="card__art card__art--square card__art--local">🎼</div>
          <div class="card__title">${escapeHtml(p.name)}</div>
          <div class="card__subtitle">${p.songs.length} tracks</div>
        </a>`).join('') || emptyStateHtml({ icon: '🎼', title: 'No playlists yet', message: 'Create your first playlist to organize your favorite tracks.' })}
    </div>`;
  document.getElementById('new-playlist-btn').addEventListener('click', () => CT_UI.openCreatePlaylistPrompt());
};

CT_Pages.favorites = function () {
  const root = document.querySelector('[data-page="favorites"]');
  const favs = CT_Storage.Favorites.all();
  root.innerHTML = `
    <div class="section__head"><h1>Favorites</h1>
      ${favs.length ? '<button class="btn btn--primary" id="fav-play-all">▶ Play All</button>' : ''}</div>
    <div class="song-list">${favs.map((s, i) => songRow(s, { index: i })).join('') || emptyStateHtml({ icon: '♥', title: 'No favorites yet', message: 'Tap the heart on any song to save it here.', actionLabel: 'Discover music', actionRoute: '/search' })}</div>`;
  bindGlobalSongInteractions(root, favs);
  document.getElementById('fav-play-all')?.addEventListener('click', () => CT_Player.playQueue(favs, 0));
};

CT_Pages.history = function () {
  const root = document.querySelector('[data-page="history"]');
  const h = CT_Storage.History.raw();
  root.innerHTML = `
    <div class="section__head"><h1>History</h1>
      ${h.songs.length ? '<button class="btn btn--ghost" id="clear-history">Clear</button>' : ''}</div>
    ${h.songs.length ? section('Recently Played', h.songs.map((s, i) => songRow(s, { index: i })).join('')) : ''}
    ${h.albums?.length ? section('Recently Viewed Albums', h.albums.map(albumCard).join('')) : ''}
    ${h.artists?.length ? section('Recently Viewed Artists', h.artists.map(artistCard).join('')) : ''}
    ${h.playlists?.length ? section('Recently Viewed Playlists', h.playlists.map(playlistCard).join('')) : ''}
    ${!h.songs.length && !h.albums?.length && !h.artists?.length ? emptyStateHtml({ icon: '🕓', title: 'Nothing here yet', message: 'Songs, albums, and artists you open will show up here.' }) : ''}
  `;
  bindGlobalSongInteractions(root, h.songs);
  document.getElementById('clear-history')?.addEventListener('click', () => {
    if (confirm('Clear your entire listening history?')) {
      CT_Storage.History.clear();
      CT_Pages.history();
    }
  });
};

CT_Pages.downloads = function () {
  const root = document.querySelector('[data-page="downloads"]');
  renderDownloadsList(root, CT_Storage.Downloads.all());
};

function renderDownloadsList(root, list) {
  root.innerHTML = `
    <div class="section__head"><h1>Downloads</h1></div>
    <input type="text" id="downloads-search" class="input" placeholder="Search downloads">
    <div class="song-list" id="downloads-list">${list.map((s, i) => songRow(s, { index: i, showRemove: true })).join('') || emptyStateHtml({ icon: '⬇', title: 'No downloads', message: 'Download songs to play them without a connection.', actionLabel: 'Find music', actionRoute: '/search' })}</div>`;
  bindGlobalSongInteractions(root, list);
  root.querySelectorAll('[data-row-remove]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      CT_Storage.Downloads.remove(btn.dataset.rowRemove);
      toast('Removed download');
      renderDownloadsList(root, CT_Storage.Downloads.all());
    });
  });
  document.getElementById('downloads-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = CT_Storage.Downloads.all().filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
    const listHost = document.getElementById('downloads-list');
    listHost.innerHTML = filtered.map((s, i) => songRow(s, { index: i, showRemove: true })).join('') || emptyStateHtml({ icon: '🔎', title: 'No matches', message: 'Try a different search.' });
    bindGlobalSongInteractions(listHost, filtered);
    listHost.querySelectorAll('[data-row-remove]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        CT_Storage.Downloads.remove(btn.dataset.rowRemove);
        renderDownloadsList(root, CT_Storage.Downloads.all());
      });
    });
  });
}

CT_Pages.downloadToggle = async function (song, silent = false) {
  if (CT_Storage.Downloads.has(song.id)) {
    CT_Storage.Downloads.remove(song.id);
    if (!silent) toast('Download removed');
    return;
  }
  if (!song.streamUrl) return toast('This track has no downloadable source', 'error');
  if (!silent) toast('Downloading…');
  try {
    if ('caches' in window) {
      const cache = await caches.open('cymor-tune-audio');
      await cache.add(song.streamUrl);
    }
    CT_Storage.Downloads.add({ ...song, sizeBytes: 0 });
    if (!silent) toast('Downloaded for offline play');
  } catch (err) {
    if (!silent) toast('Download failed — try again when online', 'error');
  }
};

CT_Pages.settings = function () {
  const root = document.querySelector('[data-page="settings"]');
  const settings = CT_Storage.Settings.get();
  const lsBytes = CT_Storage.estimateLocalStorageBytes();

  root.innerHTML = `
    <div class="section__head"><h1>Settings</h1></div>
    <div class="settings-group">
      <div class="settings-row">
        <div><strong>Theme</strong><p>Cymor Tune is designed for dark mode</p></div>
        <select id="setting-theme" class="input input--select">
          <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
          <option value="midnight" ${settings.theme === 'midnight' ? 'selected' : ''}>Midnight (AMOLED)</option>
        </select>
      </div>
      <div class="settings-row">
        <div><strong>Autoplay</strong><p>Continue playing similar songs when queue ends</p></div>
        <label class="switch"><input type="checkbox" id="setting-autoplay" ${settings.autoplay ? 'checked' : ''}><span></span></label>
      </div>
      <div class="settings-row">
        <div><strong>Stream quality</strong><p>Higher quality uses more data</p></div>
        <select id="setting-quality" class="input input--select">
          <option value="auto" ${settings.streamQuality === 'auto' ? 'selected' : ''}>Auto</option>
          <option value="high" ${settings.streamQuality === 'high' ? 'selected' : ''}>High</option>
          <option value="data-saver" ${settings.streamQuality === 'data-saver' ? 'selected' : ''}>Data saver</option>
        </select>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-row"><div><strong>Storage used</strong><p id="cache-size-label">Calculating…</p></div>
        <button class="btn btn--ghost" id="clear-cache">Clear cache</button></div>
      <div class="settings-row"><div><strong>Clear history</strong><p>${CT_Storage.History.recentlyPlayed().length} songs played</p></div>
        <button class="btn btn--ghost" id="clear-history-setting">Clear</button></div>
      <div class="settings-row"><div><strong>Clear favorites</strong><p>${CT_Storage.Favorites.all().length} saved songs</p></div>
        <button class="btn btn--ghost" id="clear-favorites-setting">Clear</button></div>
      <div class="settings-row"><div><strong>Clear downloads</strong><p>${CT_Storage.Downloads.all().length} downloaded songs</p></div>
        <button class="btn btn--ghost" id="clear-downloads-setting">Clear</button></div>
    </div>

    <div class="settings-group">
      <div class="settings-row"><div><strong>About Cymor Tune</strong><p>Version 1.0.0 · Built by Cymor Tech Services</p></div></div>
      <div class="settings-row"><div><strong>Source</strong><p>View this project on GitHub</p></div>
        <a class="btn btn--ghost" href="https://github.com" target="_blank" rel="noopener">GitHub</a></div>
    </div>`;

  CT_Storage.estimateCacheStorageBytes().then((bytes) => {
    document.getElementById('cache-size-label').textContent = `${CT_UI.formatBytes(lsBytes + bytes)} used on this device`;
  });

  document.getElementById('setting-theme').addEventListener('change', (e) => {
    CT_Storage.Settings.update({ theme: e.target.value });
    document.documentElement.dataset.theme = e.target.value;
  });
  document.getElementById('setting-autoplay').addEventListener('change', (e) => CT_Storage.Settings.update({ autoplay: e.target.checked }));
  document.getElementById('setting-quality').addEventListener('change', (e) => CT_Storage.Settings.update({ streamQuality: e.target.value }));
  document.getElementById('clear-cache').addEventListener('click', async () => {
    if ('caches' in window) await caches.delete('cymor-tune-runtime');
    toast('Cache cleared');
    CT_Pages.settings();
  });
  document.getElementById('clear-history-setting').addEventListener('click', () => {
    if (confirm('Clear listening history?')) {
      CT_Storage.History.clear();
      CT_Pages.settings();
    }
  });
  document.getElementById('clear-favorites-setting').addEventListener('click', () => {
    if (confirm('Clear all favorites?')) {
      CT_Storage.Favorites.clear();
      CT_Pages.settings();
    }
  });
  document.getElementById('clear-downloads-setting').addEventListener('click', () => {
    if (confirm('Remove all downloads?')) {
      CT_Storage.Downloads.clear();
      CT_Pages.settings();
    }
  });
};

function sharePayload(title, url) {
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(url);
    toast('Link copied to clipboard');
  }
}

window.CT_Pages = CT_Pages;
  })();
}
