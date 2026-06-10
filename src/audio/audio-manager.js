/**
 * AudioManager — Procedural sound effects via the Web Audio API.
 *
 * All sounds are synthesised at runtime — no external audio files needed.
 * Uses OscillatorNode for tonal sounds and AudioBuffer noise for atonal hits.
 *
 * IMPORTANT: Browsers block AudioContext until a user gesture (click / keypress).
 * Call initAudio() from a click handler, game-start button, or similar.
 * The manager transparently calls ctx.resume() before every play, so even
 * if the context was auto-suspended it will work on the next gesture.
 *
 * Volume is controlled globally via setVolume(v) where v is in [0, 1].
 *
 * Usage:
 *   import { initAudio, playHit, playCrit, playDeath, playGoldCollect, setVolume }
 *     from './audio/audio-manager.js';
 *
 *   // On first user interaction (e.g. "Start Game" button click):
 *   initAudio();
 *
 *   // During gameplay:
 *   playHit();
 *   playCrit();
 *   playDeath();
 *   playGoldCollect();
 *   setVolume(0.7);
 */

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** @type {AudioContext|null} */
let _ctx = null;

/** @type {GainNode|null} Master gain node for global volume control. */
let _masterGain = null;

/** Current volume level (0…1). */
let _volume = 0.5;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the Web Audio graph.
 *
 * Safe to call multiple times — subsequent calls are no-ops.
 * Must be called from a user-gesture context (click, keydown, etc.) or the
 * AudioContext will be created in "suspended" state.  Each play*() function
 * calls ctx.resume() automatically, so the context will activate on the next
 * user gesture even if initAudio() was called speculatively.
 */
export function initAudio() {
    if (_ctx) return; // already initialised

    try {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        _ctx = new AudioCtor();
        _masterGain = _ctx.createGain();
        _masterGain.gain.value = _volume;
        _masterGain.connect(_ctx.destination);
    } catch (err) {
        console.warn('[AudioManager] Web Audio API is not available in this browser:', err);
        _ctx = null;
        _masterGain = null;
    }
}

/**
 * Set the master volume.
 *
 * @param {number} v — Volume level, clamped to [0, 1]
 */
export function setVolume(v) {
    _volume = Math.max(0, Math.min(1, v));
    if (_masterGain) {
        _masterGain.gain.value = _volume;
    }
}

// ---------------------------------------------------------------------------
// Sound effect players
// ---------------------------------------------------------------------------

/**
 * Play a short noise burst for a normal hit.
 *
 * White noise, 50 ms, sharp decay — sounds like a quick "tssh" impact.
 */
export function playHit() {
    _playNoise(0.05, (gain, duration) => {
        const now = _ctx.currentTime;
        gain.gain.setValueAtTime(0.25 * _volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    });
}

/**
 * Play a brighter, longer tone for critical hits.
 *
 * 800 Hz sine wave, 100 ms, with a 1200 Hz harmonic for a "ping" / bell-like
 * quality that signals "this hit was special."
 */
export function playCrit() {
    if (!_ensureContext()) return;

    const now      = _ctx.currentTime;
    const duration = 0.1;

    // Primary tone — 800 Hz sine
    const osc1 = _ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(800, now);

    const gain1 = _ctx.createGain();
    gain1.gain.setValueAtTime(0.35 * _volume, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc1.connect(gain1);
    gain1.connect(_masterGain);

    // Secondary harmonic for the "ding" character
    const osc2 = _ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1200, now);

    const gain2 = _ctx.createGain();
    gain2.gain.setValueAtTime(0.18 * _volume, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.7);

    osc2.connect(gain2);
    gain2.connect(_masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
}

/**
 * Play a low descending sweep for enemy death.
 *
 * 200 Hz → 50 Hz sawtooth sweep over 150 ms — gives a "thud / collapse" feel.
 */
export function playDeath() {
    if (!_ensureContext()) return;

    const now      = _ctx.currentTime;
    const duration = 0.15;

    const osc = _ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + duration);

    const gain = _ctx.createGain();
    gain.gain.setValueAtTime(0.22 * _volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(_masterGain);

    osc.start(now);
    osc.stop(now + duration);
}

/**
 * Play a quick ascending chime for gold collection.
 *
 * 800 Hz → 1200 Hz sine sweep over 80 ms — high, light, and rewarding.
 */
export function playGoldCollect() {
    if (!_ensureContext()) return;

    const now      = _ctx.currentTime;
    const duration = 0.08;

    const osc = _ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + duration);

    const gain = _ctx.createGain();
    gain.gain.setValueAtTime(0.18 * _volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(_masterGain);

    osc.start(now);
    osc.stop(now + duration);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Verify the AudioContext is ready, resuming if suspended.
 *
 * @returns {boolean} true if the context is usable, false otherwise
 */
function _ensureContext() {
    if (!_ctx) {
        console.warn('[AudioManager] Audio not initialised. Call initAudio() after a user gesture.');
        return false;
    }
    if (_ctx.state === 'suspended') {
        _ctx.resume();
    }
    return true;
}

/**
 * Generate and play a buffer of white noise with a user-defined gain envelope.
 *
 * Creates an AudioBuffer filled with random samples, wraps it in a
 * BufferSourceNode, and routes it through a GainNode into the master gain.
 * The caller provides a function that configures the GainNode's envelope
 * (e.g. sharp attack + exponential decay).
 *
 * @param {number} duration — Sound duration in seconds
 * @param {function(GainNode, number): void} gainCurve — Receives (gainNode, duration);
 *   should schedule gain automation on `gain.gain`
 */
function _playNoise(duration, gainCurve) {
    if (!_ensureContext()) return;

    const sampleRate = _ctx.sampleRate;
    const frameCount = Math.ceil(sampleRate * duration);
    const buffer     = _ctx.createBuffer(1, frameCount, sampleRate);
    const data       = buffer.getChannelData(0);

    // Fill with white noise
    for (let i = 0; i < frameCount; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const source = _ctx.createBufferSource();
    source.buffer = buffer;

    const gain = _ctx.createGain();
    gainCurve(gain, duration);

    source.connect(gain);
    gain.connect(_masterGain);

    source.start(_ctx.currentTime);
    source.stop(_ctx.currentTime + duration);
}
