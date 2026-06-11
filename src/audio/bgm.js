/**
 * BGM — Background music using CC0 audio files.
 *
 * Two tracks:
 *   - Menu/ambient: "The Budding of Consciousness" by Yoiyami (CC0)
 *   - Battle/dark:   "Hazy Darkness" (CC0)
 *
 * Uses HTML5 Audio for native looping support.
 * Crossfades between tracks on switch.
 *
 * Usage:
 *   import { startMenuBGM, startBattleBGM, stopBGM, resumeBGM } from './audio/bgm.js';
 */

let _menuAudio = null;
let _battleAudio = null;
let _current = null; // 'menu' | 'battle' | null
let _fadeTimer = null;

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

function _fadeIn(audio, cb) {
    audio.volume = 0;
    audio.play().catch(() => {});
    const step = VOLUME / (FADE_MS / 50);
    const iv = setInterval(() => {
        audio.volume = Math.min(VOLUME, audio.volume + step);
        if (audio.volume >= VOLUME) { clearInterval(iv); if (cb) cb(); }
    }, 50);
}

function _fadeOut(audio, cb) {
    const step = audio.volume / (FADE_MS / 50);
    const iv = setInterval(() => {
        audio.volume = Math.max(0, audio.volume - step);
        if (audio.volume <= 0) { clearInterval(iv); audio.pause(); if (cb) cb(); }
    }, 50);
}

export function startMenuBGM() {
    if (_current === 'menu') return;
    if (!_menuAudio) _menuAudio = _getAudio(MENU_SRC);
    if (_battleAudio && _current === 'battle') {
        _fadeOut(_battleAudio, () => { _fadeIn(_menuAudio); });
    } else {
        _fadeIn(_menuAudio);
    }
    _current = 'menu';
}

export function startBattleBGM() {
    if (_current === 'battle') return;
    if (!_battleAudio) _battleAudio = _getAudio(BATTLE_SRC);
    if (_menuAudio && _current === 'menu') {
        _fadeOut(_menuAudio, () => { _fadeIn(_battleAudio); });
    } else {
        _fadeIn(_battleAudio);
    }
    _current = 'battle';
}

export function stopBGM() {
    _current = null;
    if (_fadeTimer) { clearTimeout(_fadeTimer); _fadeTimer = null; }
    if (_menuAudio) { _menuAudio.pause(); _menuAudio.volume = 0; }
    if (_battleAudio) { _battleAudio.pause(); _battleAudio.volume = 0; }
}

export function resumeBGM() {
    // Resume after browser autoplay block — restart the current track
    if (_current === 'menu') startMenuBGM();
    else if (_current === 'battle') startBattleBGM();
}
