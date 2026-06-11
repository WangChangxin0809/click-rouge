/**
 * BGM — Procedural ambient background music using Web Audio API.
 * Dark fantasy atmosphere: low drone + slow pulse + occasional chime.
 *
 * No external audio files required. All sound is synthesised at runtime.
 *
 * Usage:
 *   import { initBGM, startBGM, stopBGM, resumeBGM } from './audio/bgm.js';
 *
 *   // At game start, after user interaction:
 *   initBGM();
 *   startBGM();
 *
 *   // On pause:
 *   stopBGM();
 *
 *   // On resume:
 *   startBGM();
 *
 *   // On click (triggers AudioContext resume for autoplay policy):
 *   resumeBGM();
 */

let _ctx = null;
let _gainNode = null;
let _playing = false;
let _oscillators = [];

/**
 * Initialise the Web Audio context and master gain node.
 * Must be called after a user gesture (click / keypress) to satisfy
 * browser autoplay policies. Idempotent — safe to call multiple times.
 */
export function initBGM() {
    if (_ctx) return;
    try {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
        _gainNode = _ctx.createGain();
        _gainNode.gain.value = 0.08; // very quiet ambient — sits under gameplay SFX
        _gainNode.connect(_ctx.destination);
    } catch (e) {
        console.warn('[BGM] Web Audio not available:', e.message);
    }
}

/**
 * Start the ambient drone. Idempotent — does nothing if already playing.
 */
export function startBGM() {
    if (!_ctx || _playing) return;
    _playing = true;
    _createDrone();
}

/**
 * Stop all oscillators immediately and clear the drone state.
 */
export function stopBGM() {
    if (!_ctx) return;
    _playing = false;
    for (const osc of _oscillators) {
        try { osc.stop(); } catch (_) { /* oscillator may already be stopped */ }
    }
    _oscillators = [];
}

/**
 * Resume a suspended AudioContext. Call on any user interaction
 * (click, keypress) to satisfy browser autoplay restrictions.
 */
export function resumeBGM() {
    if (_ctx && _ctx.state === 'suspended') {
        _ctx.resume().catch(function () { /* best-effort */ });
    }
}

// ---------------------------------------------------------------------------
// Internal: drone oscillator graph
// ---------------------------------------------------------------------------

function _createDrone() {
    if (!_playing) return;

    // Root drone — A1 (55 Hz), deep foundation
    const osc1 = _ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 55; // A1
    const g1 = _ctx.createGain();
    g1.gain.value = 0.3;
    osc1.connect(g1);
    g1.connect(_gainNode);
    osc1.start();
    _oscillators.push(osc1);

    // Fifth above — E2 (82.4 Hz), adds harmonic depth
    const osc2 = _ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 82.4; // E2 (perfect fifth)
    const g2 = _ctx.createGain();
    g2.gain.value = 0.15;
    osc2.connect(g2);
    g2.connect(_gainNode);
    osc2.start();
    _oscillators.push(osc2);

    // LFO for slow volume pulse (~8 second cycle)
    const lfo = _ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12; // very slow — ~8.3 s per cycle
    const lfoGain = _ctx.createGain();
    lfoGain.gain.value = 0.1;
    lfo.connect(lfoGain);
    lfoGain.connect(g1.gain); // modulate the root drone volume
    lfo.start();
    _oscillators.push(lfo);
}
