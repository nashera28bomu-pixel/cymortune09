/**
 * router.js
 * Lightweight SPA router. No page reloads — swaps the #app-view content
 * by fetching HTML partials from /pages and calling that page's init
 * function (defined on window.CT_Pages by ui.js / app.js).
 */

const routes = [
  { pattern: /^\/$|^\/home$/, template: '/pages/home.html', init: 'home', title: 'Home' },
  { pattern: /^\/search$/, template: '/pages/search.html', init: 'search', title: 'Search' },
  { pattern: /^\/song\/([^/]+)$/, template: '/pages/song.html', init: 'song', title: 'Now Playing' },
  { pattern: /^\/album\/([^/]+)$/, template: '/pages/album.html', init: 'album', title: 'Album' },
  { pattern: /^\/artist\/([^/]+)$/, template: '/pages/artist.html', init: 'artist', title: 'Artist' },
  { pattern: /^\/playlist\/([^/]+)$/, template: '/pages/playlist.html', init: 'playlist', title: 'Playlist' },
  { pattern: /^\/playlists$/, template: '/pages/playlist.html', init: 'playlistsIndex', title: 'Your Playlists' },
  { pattern: /^\/favorites$/, template: '/pages/favorites.html', init: 'favorites', title: 'Favorites' },
  { pattern: /^\/history$/, template: '/pages/history.html', init: 'history', title: 'History' },
  { pattern: /^\/downloads$/, template: '/pages/downloads.html', init: 'downloads', title: 'Downloads' },
  { pattern: /^\/settings$/, template: '/pages/settings.html', init: 'settings', title: 'Settings' },
];

const templateCache = new Map();

class Router {
  constructor(outletSelector) {
    this.outlet = document.querySelector(outletSelector);
    window.addEventListener('popstate', () => this._render(location.pathname, false));
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-route]');
      if (link) {
        e.preventDefault();
        this.navigate(link.getAttribute('data-route'));
      }
    });
  }

  start() {
    let path = location.pathname;
    if (path === '/' || path === '' || path.endsWith('index.html')) {
      path = CT_Storage.LastPage.get() || '/home';
      history.replaceState({}, '', path);
    }
    this._render(path, true);
  }

  navigate(path, { replace = false } = {}) {
    if (location.pathname === path) {
      this._render(path, false);
      return;
    }
    if (replace) history.replaceState({}, '', path);
    else history.pushState({}, '', path);
    this._render(path, true);
  }

  async _render(path, scrollTop) {
    const match = routes.find((r) => r.pattern.test(path));
    document.dispatchEvent(new CustomEvent('ct:navigate-start', { detail: { path } }));

    if (!match) {
      await this._renderNotFound();
      return;
    }

    const params = match.pattern.exec(path)?.slice(1) || [];

    try {
      const html = await this._loadTemplate(match.template);
      this.outlet.innerHTML = html;
      document.title = `${match.title} · Cymor Tune`;
      CT_Storage.LastPage.set(path);
      this._setActiveNav(path);
      if (scrollTop) this.outlet.scrollTo({ top: 0 });

      const initFn = window.CT_Pages && window.CT_Pages[match.init];
      if (typeof initFn === 'function') {
        await initFn(...params);
      }
    } catch (err) {
      console.error('[router] failed to render', path, err);
      this._renderErrorState(err);
    }

    document.dispatchEvent(new CustomEvent('ct:navigate-end', { detail: { path } }));
  }

  async _loadTemplate(template) {
    if (templateCache.has(template)) return templateCache.get(template);
    const res = await fetch(template);
    if (!res.ok) throw new Error(`Could not load ${template}`);
    const html = await res.text();
    templateCache.set(template, html);
    return html;
  }

  async _renderNotFound() {
    this.outlet.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🎧</div>
        <h2>We couldn't find that page</h2>
        <p>It may have moved, or the link was mistyped.</p>
        <button class="btn btn--primary" data-route="/home">Back to Home</button>
      </div>`;
  }

  _renderErrorState(err) {
    const offline = !navigator.onLine;
    this.outlet.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">${offline ? '📡' : '⚠️'}</div>
        <h2>${offline ? "You're offline" : 'Something went wrong'}</h2>
        <p>${offline ? 'Check your connection — anything you downloaded is still playable.' : 'That page could not load.'}</p>
        ${!offline && err?.message ? `<p class="muted" style="font-family:ui-monospace,monospace;font-size:11.5px;word-break:break-word;">${String(err.message).replace(/</g, '&lt;')}</p>` : ''}
        <button class="btn btn--primary" id="retry-render">Retry</button>
      </div>`;
    document.getElementById('retry-render')?.addEventListener('click', () => this._render(location.pathname, false));
  }

  _setActiveNav(path) {
    document.querySelectorAll('[data-nav-link]').forEach((el) => {
      const target = el.getAttribute('data-route');
      el.classList.toggle('is-active', target === path || (target !== '/home' && path.startsWith(target)));
    });
  }
}

window.CT_Router = Router;
