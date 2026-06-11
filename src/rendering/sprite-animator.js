/**
 * sprite-animator.js — Sprite-sheet frame animation for Click Rouge.
 *
 * Computes the current source rectangle (sx, sy, sw, sh) from a sprite-sheet
 * given time, frame count, FPS, and layout.
 *
 * Two layouts are supported:
 *   - "horizontal": frames arranged in a single row, left to right.
 *     sx = frameIndex * frameW,  sy = 0
 *   - "grid": frames arranged in a grid, row-major order.
 *     col = frameIndex % gridCols,  row = Math.floor(frameIndex / gridCols)
 *     sx = col * frameW,  sy = row * frameH
 *
 * Each animator is a lightweight object created once per sprite type, not per
 * enemy instance. The frame is derived from elapsed time, so all entities
 * sharing the same animator will show the same animation frame (synchronised).
 *
 * Usage:
 *   import { createAnimator } from './rendering/sprite-animator.js';
 *
 *   const slimeAnim = createAnimator({ frameW: 74, frameH: 86, frames: 4, fps: 4, layout: 'horizontal' });
 *
 *   // Each frame in the render loop:
 *   const frame = slimeAnim.getCurrentFrame(STATE.elapsedTime + entityId * 0.7);
 *   // frame = { sx, sy, sw, sh }
 *
 * The optional `phaseOffset` parameter (passed to getCurrentFrame) allows
 * different entities of the same type to have de-synchronised animation cycles.
 */

/**
 * @typedef {Object} AnimatorConfig
 * @property {number} frameW  — Width of a single frame in pixels
 * @property {number} frameH  — Height of a single frame in pixels
 * @property {number} frames  — Total number of frames
 * @property {number} fps     — Frames per second for playback
 * @property {'horizontal'|'grid'} [layout='horizontal'] — Sprite-sheet layout
 * @property {number} [gridCols] — Number of columns (required for grid layout)
 * @property {number} [gridRows] — Number of rows (optional, computed if grid layout)
 */

/**
 * @typedef {Object} Animator
 * @property {(time: number) => { sx: number, sy: number, sw: number, sh: number }} getCurrentFrame
 * @property {() => void} reset
 */

/**
 * Create a frame animator for a sprite-sheet.
 *
 * @param {AnimatorConfig} config — Frame dimensions, count, FPS, and layout
 * @returns {Animator} Animator object with getCurrentFrame() and reset()
 */
export function createAnimator(config) {
    const frameW = config.frameW;
    const frameH = config.frameH;
    const frameCount = config.frames;
    const fps = config.fps;
    const layout = config.layout || 'horizontal';
    const gridCols = config.gridCols || frameCount;

    // For single-frame sprites, always return frame 0
    if (frameCount <= 1) {
        return {
            getCurrentFrame(_time) {
                return { sx: 0, sy: 0, sw: frameW, sh: frameH };
            },
            reset() { /* no-op */ },
        };
    }

    /**
     * Get the source rectangle for the current animation frame.
     *
     * @param {number} time — Elapsed time in seconds (typically STATE.elapsedTime + per-entity offset)
     * @returns {{ sx: number, sy: number, sw: number, sh: number }}
     */
    function getCurrentFrame(time) {
        const frameIndex = Math.floor((time * fps) % frameCount);

        if (layout === 'grid') {
            const col = frameIndex % gridCols;
            const row = Math.floor(frameIndex / gridCols);
            return {
                sx: col * frameW,
                sy: row * frameH,
                sw: frameW,
                sh: frameH,
            };
        }

        // horizontal layout (default)
        return {
            sx: frameIndex * frameW,
            sy: 0,
            sw: frameW,
            sh: frameH,
        };
    }

    /**
     * Reset the animator state (no-op for time-based animators).
     */
    function reset() {
        // Time-based animators have no mutable state to reset.
        // The frame is purely a function of time.
    }

    return { getCurrentFrame, reset };
}
