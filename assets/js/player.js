/**
 * player.js
 * Owns the single <audio> element, the play queue, shuffle/repeat state,
 * Media Session integration (lock-screen controls, background playback),
 * and emits events the UI layer subscribes to.
 */

const REPEAT = { OFF: 'off', ONE: 'one', ALL: 'all' };

class CymorPlayer extends EventTarget {
  constructor() {
    super();
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.queue = [];
    this.index = -1;
    this.shuffleOn = false;
    this.repeatMode = REPEAT.OFF;
    this.shuffleOrder = [];
    this._bindAudioEvents();
    this._restore();
    this._setupMediaSession();
  }

  /* ---------- persistence ---------- */

  _restore() {
    const { queue, index } = CT_Storage.QueueStore.load();
    if (queue && queue.length) {
      this.queue = queue;
      this.index = index;
      const song = this.current();
      if (song) {
        this._loadSource(song, { autoplay: false });
        const saved = CT_Storage.QueueStore.currentSong();
        if (saved && saved.resumeAt) {
          this.audio.addEventListener(
            'loadedmetadata',
            () => {
              this.audio.currentTime = Math.min(saved.resumeAt, this.audio.duration - 1 || 0);
            },
            { once: true }
          );
        }
      }
    }
  }

  _persist() {
    CT_Storage.QueueStore.save(this.queue, this.index);
    const song = this.current();
    if (song) CT_Storage.QueueStore.saveCurrentSong(song);
  }

  /* ---------- core queue controls ---------- */

  current() {
    return this.queue[this.index] || null;
  }

  async playSong(song, contextQueue = null) {
    song = await this._ensurePlayable(song);
    if (contextQueue && contextQueue.length) {
      this.queue = contextQueue;
      this.index = contextQueue.findIndex((s) => s.id === song.id);
      if (this.index === -1) {
        this.queue = [song, ...contextQueue];
        this.index = 0;
      } else {
        this.queue[this.index] = song;
      }
    } else {
      this.queue = [song];
      this.index = 0;
    }
    this._rebuildShuffleOrder();
    this._loadSource(song, { autoplay: true });
    this._persist();
    this._recordHistory(song);
  }

  async playQueue(songs, startIndex = 0) {
    if (!songs || !songs.length) return;
    this.queue = songs;
    this.index = startIndex;
    const resolved = await this._ensurePlayable(this.queue[this.index]);
    this.queue[this.index] = resolved;
    this._rebuildShuffleOrder();
    this._loadSource(resolved, { autoplay: true });
    this._persist();
    this._recordHistory(resolved);
  }

  /** Fetches full song details if a track came from a lighter-weight endpoint without a streamUrl. */
  async _ensurePlayable(song) {
    if (song.streamUrl) return song;
    try {
      const full = await CT_Api.getSong(song.id);
      return full && full.streamUrl ? { ...song, ...full } : song;
    } catch {
      return song;
    }
  }

  enqueueNext(song) {
    if (this.index === -1) return this.playSong(song);
    this.queue.splice(this.index + 1, 0, song);
    this._persist();
    this._emit('queue-changed');
  }

  enqueueEnd(song) {
    if (this.index === -1) return this.playSong(song);
    this.queue.push(song);
    this._persist();
    this._emit('queue-changed');
  }

  removeFromQueue(idx) {
    if (idx === this.index) return;
    this.queue.splice(idx, 1);
    if (idx < this.index) this.index -= 1;
    this._persist();
    this._emit('queue-changed');
  }

  _loadSource(song, { autoplay }) {
    if (!song || !song.streamUrl) {
      this._emit('error', { message: 'This track has no playable source.' });
      return;
    }
    this.audio.src = song.streamUrl;
    this.audio.load();
    if (autoplay) {
      this.audio.play().catch((err) => this._emit('error', { message: 'Playback blocked: ' + err.message }));
    }
    this._updateMediaSessionMetadata(song);
    this._emit('song-changed', { song });
  }

  play() {
    this.audio.play().catch((err) => this._emit('error', { message: err.message }));
  }

  pause() {
    this.audio.pause();
  }

  toggle() {
    if (this.audio.paused) this.play();
    else this.pause();
  }

  seek(seconds) {
    if (isFinite(seconds)) this.audio.currentTime = seconds;
  }

  seekByRatio(ratio) {
    if (this.audio.duration) this.audio.currentTime = ratio * this.audio.duration;
  }

  setVolume(v) {
    this.audio.volume = Math.max(0, Math.min(1, v));
  }

  setSpeed(rate) {
    this.audio.playbackRate = rate;
  }

  async next(userInitiated = true) {
    if (!this.queue.length) return;
    if (this.repeatMode === REPEAT.ONE && !userInitiated) {
      this.audio.currentTime = 0;
      this.play();
      return;
    }
    const nextIdx = this._nextIndex();
    if (nextIdx === null) {
      this._emit('queue-ended');
      return;
    }
    this.index = nextIdx;
    const resolved = await this._ensurePlayable(this.current());
    this.queue[this.index] = resolved;
    this._loadSource(resolved, { autoplay: true });
    this._persist();
    this._recordHistory(resolved);
  }

  async previous() {
    if (!this.queue.length) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    const prevIdx = this._prevIndex();
    if (prevIdx === null) return;
    this.index = prevIdx;
    const resolved = await this._ensurePlayable(this.current());
    this.queue[this.index] = resolved;
    this._loadSource(resolved, { autoplay: true });
    this._persist();
  }

  _nextIndex() {
    if (this.shuffleOn) {
      const posInShuffle = this.shuffleOrder.indexOf(this.index);
      if (posInShuffle < this.shuffleOrder.length - 1) return this.shuffleOrder[posInShuffle + 1];
      return this.repeatMode === REPEAT.ALL ? this.shuffleOrder[0] : null;
    }
    if (this.index < this.queue.length - 1) return this.index + 1;
    return this.repeatMode === REPEAT.ALL ? 0 : null;
  }

  _prevIndex() {
    if (this.shuffleOn) {
      const posInShuffle = this.shuffleOrder.indexOf(this.index);
      if (posInShuffle > 0) return this.shuffleOrder[posInShuffle - 1];
      return null;
    }
    return this.index > 0 ? this.index - 1 : null;
  }

  toggleShuffle() {
    this.shuffleOn = !this.shuffleOn;
    this._rebuildShuffleOrder();
    this._emit('state-changed');
  }

  cycleRepeat() {
    const order = [REPEAT.OFF, REPEAT.ALL, REPEAT.ONE];
    this.repeatMode = order[(order.indexOf(this.repeatMode) + 1) % order.length];
    this._emit('state-changed');
  }

  _rebuildShuffleOrder() {
    const indices = this.queue.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    // keep current song first in shuffle order so "next" flows forward naturally
    const curPos = indices.indexOf(this.index);
    if (curPos > -1) {
      indices.splice(curPos, 1);
      indices.unshift(this.index);
    }
    this.shuffleOrder = indices;
  }

  _recordHistory(song) {
    if (song) CT_Storage.History.addSong(song);
  }

  /* ---------- audio element wiring ---------- */

  _bindAudioEvents() {
    this.audio.addEventListener('timeupdate', () => {
      this._emit('time-update', { currentTime: this.audio.currentTime, duration: this.audio.duration });
      if (Math.floor(this.audio.currentTime) % 5 === 0) {
        CT_Storage.QueueStore.saveCurrentTime(this.audio.currentTime);
      }
    });
    this.audio.addEventListener('play', () => this._emit('play-state', { playing: true }));
    this.audio.addEventListener('pause', () => this._emit('play-state', { playing: false }));
    this.audio.addEventListener('ended', () => this.next(false));
    this.audio.addEventListener('waiting', () => this._emit('buffering', { buffering: true }));
    this.audio.addEventListener('playing', () => this._emit('buffering', { buffering: false }));
    this.audio.addEventListener('error', () => this._emit('error', { message: 'This track failed to load.' }));
  }

  /* ---------- Media Session (lock screen / notification controls) ---------- */

  _setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => this.play());
    navigator.mediaSession.setActionHandler('pause', () => this.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => this.previous());
    navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) this.seek(details.seekTime);
    });
  }

  _updateMediaSessionMetadata(song) {
    if (!('mediaSession' in navigator) || !song) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      album: song.album,
      artwork: [{ src: song.artwork, sizes: '500x500', type: 'image/jpeg' }],
    });
  }

  _emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

window.CT_REPEAT = REPEAT;
window.CT_Player = new CymorPlayer();
