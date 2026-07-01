# Cymor Tune

A premium, offline-capable music streaming web app. No sign-up, no login —
favorites, playlists, history and downloads all live on the listener's own
device. Vanilla HTML/CSS/JS, SPA-routed, installable as a PWA.

## Stack

- Vanilla HTML + CSS + JavaScript (ES modules-free, no build step)
- SPA routing via the History API (`assets/js/router.js`)
- LocalStorage for all user data (`assets/js/storage.js`)
- Service Worker + Cache Storage for offline/PWA support
- Backend: `https://cymortuneapi.onrender.com`

## Project structure

```
cymor-tune/
├── index.html              # landing page + app shell (sidebar, player, nav)
├── assets/css/style.css    # entire design system + all component styles
├── assets/js/
│   ├── storage.js          # LocalStorage read/write for every feature
│   ├── api.js               # backend client + response normalizers
│   ├── player.js            # audio engine, queue, Media Session API
│   ├── ui.js                # shared render helpers (cards, rows, sheets)
│   ├── router.js             # SPA router (History API)
│   └── app.js                 # page controllers + shell wiring
├── pages/*.html             # route templates injected into #app-view
├── manifest.json, service-worker.js, robots.txt, sitemap.xml
```

## Running locally

This is a static site — any static file server works, e.g.:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Open `index.html` through that server (not via `file://`) so the Service
Worker and `fetch()` calls to `pages/*.html` work correctly.

## Deploying

Ready to push as-is to GitHub Pages, Netlify, Vercel, or Cloudflare Pages.
No environment variables or build step needed. Just make sure the host
serves `index.html` for unknown paths (SPA fallback) so routes like
`/song/123` work on hard refresh — e.g. on Netlify add a `_redirects` file:

```
/*  /index.html  200
```

## ⚠️ One thing to verify against your live backend

`assets/js/api.js` calls these endpoints, matching the brief:

- `GET /api/v1/search?q=`
- `GET /api/v1/songs/:id`, `/api/v1/albums/:id`, `/api/v1/artists/:id`, `/api/v1/playlists/:id`
- `GET /api/v1/trending`, `/api/v1/charts`, `/api/v1/albums/new`
- `GET /api/v1/playlists/featured`, `/api/v1/songs/:id/recommendations`

I could not reach `cymortuneapi.onrender.com` directly to confirm the exact
JSON shape it returns (robots.txt on the live host blocks automated
fetching), so `normalizeSong`/`normalizeAlbum`/`normalizeArtist`/
`normalizePlaylist` in `api.js` defensively read several common field names
(`image` as string, array, or `{link}`; `songs` under `data`, `results`, or
root, etc. — typical of JioSaavn-style wrappers). **Open the app, hit
Search, and check the browser console/network tab** — if a section comes
back empty even though the request succeeded, the fastest fix is almost
always adjusting the field names inside the matching `normalize*` function
or the `pickArray(...)` key list in `api.js`. Everything else in the app is
independent of that shape and won't need touching.

## Feature map

- **Home** — trending songs/albums/artists, featured playlists, new
  releases (from backend) + continue listening / favorites (local)
- **Search** — debounced live search, recent searches, skeleton + empty states
- **Song / Album / Artist / Playlist pages** — full detail views, play all,
  shuffle, related songs, lyrics sheet
- **Player** — mini player + full-screen player, queue sheet, shuffle,
  repeat (off/all/one), speed, volume, Media Session (lock-screen controls)
- **Favorites, History, Downloads, Playlists** — entirely LocalStorage-backed
- **Settings** — theme, autoplay, stream quality, cache size, clear data
- **PWA** — installable, offline shell caching, offline banner, background
  playback via Media Session

Made with ❤️ by Cymor.
