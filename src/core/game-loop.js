/**
 * GameLoop — requestAnimationFrame-based main game loop.
 *
 * Provides a fixed-timestep-friendly loop with delta-time capping
 * to prevent spiral-of-death when the browser tab loses focus.
 *
 * Usage:
 *   import { GameLoop } from './core/game-loop.js';
 *   const loop = new GameLoop(update, render);
 *   loop.start();
 *   // ... later
 *   loop.stop();
 */

const MAX_DELTA = 0.033; // 33ms cap — roughly 30 FPS minimum, prevents tab-away jumps

export class GameLoop {
    /**
     * @param {function(number): void} updateFn - Called each frame with deltaTime in seconds
     * @param {function(): void} renderFn - Called after each update to draw the frame
     */
    constructor(updateFn, renderFn) {
        this._update = updateFn;
        this._render = renderFn;

        /** @type {number|null} requestAnimationFrame ID */
        this._rafId = null;

        /** @type {boolean} */
        this._running = false;

        /** Timestamp of the previous frame (DOMHighResTimeStamp, ms) */
        this._lastTime = 0;

        // FPS tracking
        this._frameCount = 0;
        this._fpsAccumulator = 0;
        this._currentFps = 0;
    }

    /**
     * Start the game loop. No-op if already running.
     */
    start() {
        if (this._running) return;
        this._running = true;
        this._lastTime = performance.now();
        this._frameCount = 0;
        this._fpsAccumulator = 0;
        this._currentFps = 0;
        this._rafId = requestAnimationFrame(this._tick);
    }

    /**
     * Stop the game loop. No-op if not running.
     */
    stop() {
        if (!this._running) return;
        this._running = false;
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    /**
     * Whether the loop is currently running.
     * @returns {boolean}
     */
    get isRunning() {
        return this._running;
    }

    /**
     * Current frames-per-second, updated once per second.
     * Returns 0 until the first full second of runtime.
     * @returns {number}
     */
    get fps() {
        return this._currentFps;
    }

    /**
     * Internal tick function bound as the rAF callback.
     * Arrow function binds `this` lexically so it can be passed directly to rAF.
     */
    _tick = (now) => {
        if (!this._running) return;

        // Calculate raw delta in seconds
        let dt = (now - this._lastTime) / 1000;
        this._lastTime = now;

        // Clamp delta to prevent spiral-of-death on tab-away
        if (dt > MAX_DELTA) {
            dt = MAX_DELTA;
        }

        // Guard against negative or zero delta (e.g., clock skew)
        if (dt <= 0) {
            dt = 0.001; // 1ms minimum, prevents division-by-zero downstream
        }

        // FPS tracking: count frames, update once per second
        this._frameCount++;
        this._fpsAccumulator += dt;
        if (this._fpsAccumulator >= 1.0) {
            this._currentFps = Math.round(this._frameCount / this._fpsAccumulator);
            this._frameCount = 0;
            this._fpsAccumulator = 0;
        }

        // Update then render
        this._update(dt);
        this._render();

        // Schedule next frame
        this._rafId = requestAnimationFrame(this._tick);
    };
}
