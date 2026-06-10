/**
 * ScreenShake — Camera-shake effect for impact feedback.
 *
 * Provides a global shake that the CanvasRenderer reads each frame via
 * getShakeOffset() and applies to its view transform (pushShake/popShake).
 *
 * The shake uses a decaying sine-wave: the magnitude decreases linearly
 * from `intensity` to 0 over the specified `duration`, and the instantaneous
 * offset oscillates with a high-frequency sine to create a jittery feel.
 *
 * Max offset is clamped to +/- 15 logical pixels regardless of intensity,
 * preventing disorienting screen jumps.
 *
 * Usage:
 *   import { triggerShake, updateShake, getShakeOffset } from './rendering/screen-shake.js';
 *
 *   // In update loop:
 *   updateShake(dt);
 *
 *   // In render loop (before drawing):
 *   const offset = getShakeOffset();
 *   renderer.setShake(offset.x, offset.y);
 *   renderer.pushShake();
 *   // ... draw calls ...
 *   renderer.popShake();
 *
 *   // Trigger anywhere:
 *   triggerShake(8, 0.15);  // intensity=8, duration=0.15s
 */

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** Current shake intensity (peak offset magnitude in logical pixels). */
let _intensity = 0;

/** Total shake duration in seconds. */
let _duration = 0;

/** Elapsed time since shake started, in seconds. */
let _elapsed = 0;

/** Whether a shake is currently active. */
let _active = false;

/** Maximum allowed offset per axis (logical pixels). */
const MAX_OFFSET = 15;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start (or override) a screen shake.
 *
 * If a shake is already in progress it is replaced by the new one.
 * Pass intensity=0 or duration=0 to immediately cancel.
 *
 * @param {number} intensity — Peak offset magnitude in logical pixels.
 *   Clamped to [0, MAX_OFFSET] internally.
 * @param {number} duration — How long the shake lasts in seconds. Minimum 0.
 */
export function triggerShake(intensity, duration) {
    _intensity = Math.max(0, Math.min(intensity, MAX_OFFSET));
    _duration  = Math.max(0, duration);
    _elapsed   = 0;
    _active    = _intensity > 0 && _duration > 0;
}

/**
 * Advance the shake state by dt seconds.
 *
 * Should be called once per frame from the game-update path.  When
 * _elapsed reaches _duration the shake auto-disables.
 *
 * @param {number} dt — Delta time in seconds
 */
export function updateShake(dt) {
    if (!_active) return;

    _elapsed += dt;
    if (_elapsed >= _duration) {
        _active    = false;
        _intensity = 0;
    }
}

/**
 * Return the current { x, y } offset for this frame.
 *
 * Call once per render frame, before pushShake().
 *
 * The offset formula:  offset = intensity * sin(time * freq) * decay
 * where decay = 1 - (elapsed / duration).
 * X and Y axes use slightly different frequencies to avoid a repetitive
 * circular pattern.
 *
 * @returns {{ x: number, y: number }}
 */
export function getShakeOffset() {
    if (!_active || _intensity <= 0) {
        return { x: 0, y: 0 };
    }

    const decay     = 1 - (_elapsed / _duration);
    const magnitude = _intensity * decay;

    // Different sine frequencies per axis for a natural, chaotic shake.
    const x = magnitude * Math.sin(_elapsed * 50);
    const y = magnitude * Math.cos(_elapsed * 53);

    return { x, y };
}
