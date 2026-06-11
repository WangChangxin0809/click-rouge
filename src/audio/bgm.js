/**
 * BGM — Background music using CC0 audio files.
 *
 * Two tracks:
 *   - Menu/ambient: "The Budding of Consciousness" by Yoiyami (CC0)
 *   - Battle/dark:   "Hazy Darkness" (CC0)
 *
 * Uses HTML5 Audio for native looping support.
 * Handles browser autoplay policy: defers playback until first user gesture.
 */

let _menuAudio = null;
let _battleAudio = null;
let _current = null;
let _pending = null; // track blocked by autoplay: 'menu' | 'battle' | null
let _firstInteraction = false;

const MENU_SRC = 'assets/audio/menu_bgm.mp3';
const BATTLE_SRC = 'assets/audio/battle_bgm.ogg';
const VOLUME = 0.25;
const FADE_MS = 500;

function _getAudio(src) {
    const a = new Audio(src);
    a.loop = true;
    a.volume = 0;
    a.preload = 'auto';
    return a;
}

function _fadeIn(audio) {
    audio.volume = 0;
    const p = audio.play();
    if (p) {
        p.catch(() => {
            // Autoplay blocked — will retry on first user gesture
        });
    }
    const step = VOLUME / (FADE_MS / 50);
    const iv = setInterval(() => {
        audio.volume = Math.min(VOLUME, audio.volume + step);
        if (audio.volume >= VOLUME) clearInterval(iv);
    }, 50);
}

function _fadeOut(audio, cb) {
    const step = audio.volume / (FADE_MS / 50);
    const iv = setInterval(() => {
        audio.volume = Math.max(0, audio.volume - step);
        if (audio.volume <= 0) { clearInterval(iv); audio.pause(); if (cb) cb(); }
    }, 50);
}

function _retryPlay(audio) {
    audio.play().catch(() => {});
    if (audio.volume < VOLUME) {
        _fadeIn(audio);
    }
}

export function startMenuBGM() {
    if (_current === 'menu') return;
    if (!_menuAudio) _menuAudio = _getAudio(MENU_SRC);
    if (!_firstInteraction) {
        _pending = 'menu';
        _current = 'menu';
        return;
    }
    if (_battleAudio && _current === 'battle') {
        _fadeOut(_battleAudio, () => { _retryPlay(_menuAudio); });
    } else {
        _retryPlay(_menuAudio);
    }
    _current = 'menu';
}

export function startBattleBGM() {
    if (_current === 'battle') return;
    if (!_battleAudio) _battleAudio = _getAudio(BATTLE_SRC);
    if (!_firstInteraction) {
        _pending = 'battle';
        _current = 'battle';
        return;
    }
    if (_menuAudio && _current === 'menu') {
        _fadeOut(_menuAudio, () => { _retryPlay(_battleAudio); });
    } else {
        _retryPlay(_battleAudio);
    }
    _current = 'battle';
}

export function stopBGM() {
    _current = null;
    _pending = null;
    if (_menuAudio) { _menuAudio.pause(); _menuAudio.volume = 0; }
    if (_battleAudio) { _battleAudio.pause(); _battleAudio.volume = 0; }
}

export function handleFirstInteraction() {
    if (_firstInteraction) return;
    _firstInteraction = true;
    if (_pending === 'menu') {
        startMenuBGM();
    } else if (_pending === 'battle') {
        startBattleBGM();
    }
}

export function resumeBGM() {
    handleFirstInteraction();
}
