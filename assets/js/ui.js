/**
 * ui.js
 * Reusable render helpers shared by every page: cards, rows, skeletons,
 * toasts, empty states, and the persistent mini-player / full-screen player.
 * Keeping these here means pages stay thin and nothing is duplicated.
 */

function formatDuration(seconds) {
  if (!seconds || !isFinite(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return mb < 1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(1)} MB`;
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/* ---------------- Toasts ---------------- */

function toast(message, type = 'default') {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 250);
  }, 2800);
}

/* ---------------- Empty / error / loading states ---------------- */

function emptyStateHtml({ icon = '🎵', title, message, actionLabel, actionRoute }) {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">${icon}</div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      ${actionLabel ? `<button class="btn btn--primary" data-route="${actionRoute}">${escapeHtml(actionLabel)}</button>` : ''}
    </div>`;
}

function skeletonRow(count = 6, variant = 'card') {
  return `<div class="skeleton-row skeleton-row--${variant}">${Array.from({ length: count })
    .map(() => `<div class="skeleton skeleton--${variant}"></div>`)
    .join('')}</div>`;
}

function errorStateHtml(err) {
  const offline = err?.isOffline || !navigator.onLine;
  return emptyStateHtml({
    icon: offline ? '📡' : '⚠️',
    title: offline ? "You're offline" : 'Could not load this',
    message: offline ? 'Reconnect to stream new music — downloads still work offline.' : (err?.message || 'The backend did not respond. Please try again.'),
  });
}

/* ---------------- Cards & rows ---------------- */

function songCard(song) {
  return `
    <button class="card card--song" data-song-card="${song.id}" aria-label="Play ${escapeHtml(song.title)}">
      <div class="card__art">
        <img src="${song.artwork}" alt="" loading="lazy" onerror="this.src='assets/images/placeholder-art.svg'">
        <span class="card__play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
      </div>
      <div class="card__title">${escapeHtml(song.title)}</div>
      <div class="card__subtitle">${escapeHtml(song.artist)}</div>
    </button>`;
}

function albumCard(album) {
  return `
    <a class="card card--album" href="/album/${album.id}" data-route="/album/${album.id}">
      <div class="card__art card__art--square">
        <img src="${album.artwork}" alt="" loading="lazy" onerror="this.src='assets/images/placeholder-art.svg'">
      </div>
      <div class="card__title">${escapeHtml(album.name)}</div>
      <div class="card__subtitle">${escapeHtml(album.artist)}${album.year ? ' · ' + album.year : ''}</div>
    </a>`;
}

function artistCard(artist) {
  return `
    <a class="card card--artist" href="/artist/${artist.id}" data-route="/artist/${artist.id}">
      <div class="card__art card__art--round">
        <img src="${artist.image}" alt="" loading="lazy" onerror="this.src='assets/images/placeholder-art.svg'">
      </div>
      <div class="card__title">${escapeHtml(artist.name)}</div>
      <div class="card__subtitle">Artist</div>
    </a>`;
}

function playlistCard(playlist) {
  return `
    <a class="card card--playlist" href="/playlist/${playlist.id}" data-route="/playlist/${playlist.id}">
      <div class="card__art card__art--square">
        <img src="${playlist.artwork}" alt="" loading="lazy" onerror="this.src='assets/images/placeholder-art.svg'">
      </div>
      <div class="card__title">${escapeHtml(playlist.name)}</div>
      <div class="card__subtitle">${playlist.songCount || playlist.songs?.length || 0} tracks</div>
    </a>`;
}

function songRow(song, { index, showAlbum = false, showRemove = false } = {}) {
  const isFav = CT_Storage.Favorites.has(song.id);
  return `
    <div class="song-row" data-song-row="${song.id}">
      <button class="song-row__play" data-play-row="${song.id}" aria-label="Play ${escapeHtml(song.title)}">
        ${index !== undefined ? `<span class="song-row__index">${index + 1}</span>` : ''}
        <img class="song-row__art" src="${song.artwork}" alt="" loading="lazy" onerror="this.src='assets/images/placeholder-art.svg'">
        <svg class="song-row__play-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <div class="song-row__meta" data-play-row="${song.id}">
        <div class="song-row__title">${escapeHtml(song.title)}</div>
        <div class="song-row__subtitle">${escapeHtml(song.artist)}${showAlbum && song.album ? ' · ' + escapeHtml(song.album) : ''}</div>
      </div>
      <div class="song-row__duration">${formatDuration(song.duration)}</div>
      <button class="icon-btn song-row__fav ${isFav ? 'is-active' : ''}" data-fav-toggle="${song.id}" aria-label="Toggle favorite">
        <svg viewBox="0 0 24 24"><path d="M12 21s-6.7-4.35-9.3-8.1C1 10.1 1.6 6.7 4.4 5.3c2.3-1.15 4.6-.2 5.9 1.6 1.3-1.8 3.6-2.75 5.9-1.6 2.8 1.4 3.4 4.8 1.7 7.6C18.7 16.65 12 21 12 21z"/></svg>
      </button>
      <button class="icon-btn song-row__more" data-song-menu="${song.id}" aria-label="More options">
        <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
      </button>
      ${showRemove ? `<button class="icon-btn song-row__remove" data-row-remove="${song.id}" aria-label="Remove"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>` : ''}
    </div>`;
}

function section(title, innerHtml, { seeAllRoute = null, id = '' } = {}) {
  return `
    <section class="section" ${id ? `id="${id}"` : ''}>
      <div class="section__head">
        <h2>${escapeHtml(title)}</h2>
        ${seeAllRoute ? `<a class="section__see-all" data-route="${seeAllRoute}">See all</a>` : ''}
      </div>
      <div class="section__scroller">${innerHtml}</div>
    </section>`;
}

/* ---------------- Song context menu (add to playlist / queue / download) ---------------- */

function openSongMenu(song, anchorSong) {
  const modal = document.getElementById('modal-host');
  const playlists = CT_Storage.Playlists.all();
  modal.innerHTML = `
    <div class="sheet-backdrop" data-close-sheet>
      <div class="sheet" role="dialog" aria-label="Song options">
        <div class="sheet__handle"></div>
        <div class="sheet__song">
          <img src="${song.artwork}" alt="" onerror="this.src='assets/images/placeholder-art.svg'">
          <div>
            <div class="sheet__song-title">${escapeHtml(song.title)}</div>
            <div class="sheet__song-artist">${escapeHtml(song.artist)}</div>
          </div>
        </div>
        <button class="sheet__action" data-action="play-next">▶ Play next</button>
        <button class="sheet__action" data-action="play-end">＋ Add to queue</button>
        <button class="sheet__action" data-action="download">⬇ ${CT_Storage.Downloads.has(song.id) ? 'Remove download' : 'Download'}</button>
        <div class="sheet__divider"></div>
        <div class="sheet__label">Add to playlist</div>
        <button class="sheet__action" data-action="new-playlist">＋ New playlist</button>
        ${playlists.map((p) => `<button class="sheet__action" data-action="add-playlist" data-playlist-id="${p.id}">${escapeHtml(p.name)}</button>`).join('')}
        ${song.hasLyrics ? '<div class="sheet__divider"></div><button class="sheet__action" data-action="lyrics">🎤 View lyrics</button>' : ''}
      </div>
    </div>`;

  modal.querySelector('[data-close-sheet]').addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-close-sheet')) closeModal();
  });

  modal.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'play-next') CT_Player.enqueueNext(song);
      if (action === 'play-end') CT_Player.enqueueEnd(song);
      if (action === 'download') window.CT_Pages?.downloadToggle?.(song);
      if (action === 'new-playlist') return openCreatePlaylistPrompt(song);
      if (action === 'add-playlist') {
        CT_Storage.Playlists.addSong(btn.dataset.playlistId, song);
        toast('Added to playlist');
      }
      if (action === 'lyrics') window.CT_Pages?.showLyrics?.(song);
      closeModal();
    });
  });
}

function openCreatePlaylistPrompt(songToAdd = null) {
  const modal = document.getElementById('modal-host');
  modal.innerHTML = `
    <div class="sheet-backdrop" data-close-sheet>
      <div class="sheet sheet--form" role="dialog" aria-label="Create playlist">
        <div class="sheet__handle"></div>
        <h3>New playlist</h3>
        <input type="text" id="new-playlist-name" class="input" placeholder="Playlist name" maxlength="60" autofocus>
        <button class="btn btn--primary btn--block" id="create-playlist-confirm">Create</button>
      </div>
    </div>`;
  modal.querySelector('[data-close-sheet]').addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-close-sheet')) closeModal();
  });
  const confirm = () => {
    const name = document.getElementById('new-playlist-name').value.trim();
    if (!name) return toast('Give it a name first');
    const playlist = CT_Storage.Playlists.create(name);
    if (songToAdd) CT_Storage.Playlists.addSong(playlist.id, songToAdd);
    toast(`Created "${playlist.name}"`);
    closeModal();
  };
  modal.querySelector('#create-playlist-confirm').addEventListener('click', confirm);
  modal.querySelector('#new-playlist-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirm();
  });
}

function closeModal() {
  document.getElementById('modal-host').innerHTML = '';
}

/* ---------------- Global song-row / card click delegation ---------------- */

function bindGlobalSongInteractions(root, contextSongs) {
  root.querySelectorAll('[data-song-card]').forEach((el) => {
    el.addEventListener('click', () => {
      const song = contextSongs.find((s) => s.id === el.dataset.songCard);
      if (song) CT_Player.playSong(song, contextSongs);
    });
  });
  root.querySelectorAll('[data-play-row]').forEach((el) => {
    el.addEventListener('click', () => {
      const song = contextSongs.find((s) => s.id === el.dataset.playRow);
      if (song) CT_Player.playSong(song, contextSongs);
    });
  });
  root.querySelectorAll('[data-fav-toggle]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const song = contextSongs.find((s) => s.id === el.dataset.favToggle);
      if (!song) return;
      const nowFav = CT_Storage.Favorites.toggle(song);
      el.classList.toggle('is-active', nowFav);
      toast(nowFav ? 'Added to favorites' : 'Removed from favorites');
    });
  });
  root.querySelectorAll('[data-song-menu]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const song = contextSongs.find((s) => s.id === el.dataset.songMenu);
      if (song) openSongMenu(song);
    });
  });
}

window.CT_UI = {
  formatDuration,
  formatBytes,
  timeAgo,
  escapeHtml,
  toast,
  emptyStateHtml,
  errorStateHtml,
  skeletonRow,
  songCard,
  albumCard,
  artistCard,
  playlistCard,
  songRow,
  section,
  openSongMenu,
  openCreatePlaylistPrompt,
  closeModal,
  bindGlobalSongInteractions,
};
