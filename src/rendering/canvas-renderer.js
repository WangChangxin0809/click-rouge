/**
 * CanvasRenderer — Main Canvas 2D rendering module for Click Rouge.
 *
 * Renders game entities (enemies, particles, projectiles) onto a <canvas> element.
 * Uses a fixed design resolution (1920x1080) and automatically scales to fit the
 * actual canvas size, with devicePixelRatio awareness for sharp rendering on
 * high-DPI displays.
 *
 * All draw coordinates are in logical (design-resolution) space. The renderer
 * applies the appropriate scale transform internally via render().
 *
 * The individual draw methods (drawRect, drawCircle, etc.) can also be called
 * standalone — they draw at the coordinates given, assuming the caller has
 * already configured any required canvas transform.
 *
 * Screen shake is supported via setShake() / pushShake() / popShake():
 *   renderer.setShake(5, 0);
 *   renderer.pushShake();
 *   renderer.drawCircle(x, y, r, 'red');   // offset by shake
 *   renderer.popShake();
 *
 * Usage:
 *   // No import needed here — this is the module itself
 *   const canvas = document.getElementById('game-canvas');
 *   const renderer = new CanvasRenderer(canvas);
 *   renderer.clear();
 *   renderer.render(STATE);
 */

import { renderEnemies } from './sprite-renderer.js';
import { renderParticles, getScreenFlash } from './fx-renderer.js';
import { renderFollowers } from './follower-renderer.js';
import { renderProjectiles } from '../entities/projectile.js';
import { renderBossHpBar } from './boss-renderer.js';
import { renderBackground } from './background-renderer.js';
import { renderBase } from './base-renderer.js';
import { getShakeOffset } from './screen-shake.js';

// ---------------------------------------------------------------------------
// Design resolution constants (re-exported from core/constants.js)
// ---------------------------------------------------------------------------

import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../core/constants.js';
export { DESIGN_WIDTH, DESIGN_HEIGHT };

// ---------------------------------------------------------------------------
// CanvasRenderer
// ---------------------------------------------------------------------------

export class CanvasRenderer {
    /**
     * Create a CanvasRenderer bound to a <canvas> element.
     *
     * Automatically handles devicePixelRatio scaling and window resize.
     * The canvas internal resolution is set to display-size * DPR so that
     * drawing at design-resolution coordinates maps sharply to physical pixels.
     *
     * @param {HTMLCanvasElement} canvas — The canvas element to render into.
     */
    constructor(canvas) {
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new TypeError('CanvasRenderer: constructor expects an HTMLCanvasElement');
        }

        /** @type {HTMLCanvasElement} */
        this._canvas = canvas;

        /** @type {CanvasRenderingContext2D} */
        this._ctx = canvas.getContext('2d');

        // Disable bilinear filtering for crisp pixel art
        this._ctx.imageSmoothingEnabled = false;

        /** @type {number} Current device pixel ratio */
        this._dpr = window.devicePixelRatio || 1;

        /** @type {number} Screen shake X offset in logical pixels */
        this._shakeX = 0;

        /** @type {number} Screen shake Y offset in logical pixels */
        this._shakeY = 0;

        // Bind the resize handler so we can add/remove it cleanly.
        this._onResize = this._handleResize.bind(this);
        window.addEventListener('resize', this._onResize);

        // Perform initial sizing.
        this._handleResize();
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /**
     * Recompute canvas dimensions based on current viewport size and DPR.
     * Called on construction and on every window resize event.
     *
     * Sets canvas.style.width/height to fill the viewport, and
     * canvas.width/height to display-size * DPR for sharp rendering.
     */
    _handleResize() {
        const dpr = window.devicePixelRatio || 1;
        this._dpr = dpr;

        const displayW = window.innerWidth;
        const displayH = window.innerHeight;

        this._canvas.style.width = displayW + 'px';
        this._canvas.style.height = displayH + 'px';

        this._canvas.width = displayW * dpr;
        this._canvas.height = displayH * dpr;
    }

    // -----------------------------------------------------------------------
    // Public drawing methods
    // -----------------------------------------------------------------------

    /**
     * Clear the entire canvas to transparent.
     *
     * Resets the transform to identity internally so it always clears
     * the full device-pixel area regardless of any active scale/shake state.
     */
    clear() {
        const ctx = this._ctx;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        ctx.restore();
    }

    /**
     * Draw a filled rectangle.
     *
     * @param {number} x — Left edge, logical coordinates
     * @param {number} y — Top edge, logical coordinates
     * @param {number} w — Width in logical pixels
     * @param {number} h — Height in logical pixels
     * @param {string} color — CSS color string (e.g. '#ff0000', 'rgba(255,0,0,0.5)')
     * @param {number} [alpha=1.0] — Global alpha multiplier (0..1)
     */
    drawRect(x, y, w, h, color, alpha = 1.0) {
        const ctx = this._ctx;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        ctx.restore();
    }

    /**
     * Draw a filled circle.
     *
     * @param {number} x — Center X, logical coordinates
     * @param {number} y — Center Y, logical coordinates
     * @param {number} radius — Radius in logical pixels. Zero or negative is a no-op.
     * @param {string} color — CSS color string
     * @param {number} [alpha=1.0] — Global alpha multiplier (0..1)
     */
    drawCircle(x, y, radius, color, alpha = 1.0) {
        if (radius <= 0) return;

        const ctx = this._ctx;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /**
     * Draw text with a given font size, color, and horizontal alignment.
     *
     * @param {number} x — X position (interpreted per `align`)
     * @param {number} y — Y position (vertical center of the text)
     * @param {string} text — The text string to render
     * @param {number} size — Font size in logical pixels
     * @param {string} color — CSS color string
     * @param {CanvasTextAlign} [align='center'] — Horizontal alignment:
     *   'left' | 'center' | 'right' | 'start' | 'end'
     */
    drawText(x, y, text, size, color, align = 'center') {
        const ctx = this._ctx;
        ctx.save();
        ctx.font = `${size}px sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    /**
     * Draw a two-color health bar.
     *
     * Draws a background rectangle (backColor) overlaid with a foreground
     * rectangle (frontColor) whose width is `ratio * w`. `ratio` is clamped
     * to [0, 1] internally.
     *
     * @param {number} x — Left edge, logical coordinates
     * @param {number} y — Top edge, logical coordinates
     * @param {number} w — Full bar width in logical pixels
     * @param {number} h — Bar height in logical pixels
     * @param {number} ratio — Fill fraction, clamped to [0..1]
     * @param {string} frontColor — Foreground CSS color (health remaining)
     * @param {string} backColor — Background CSS color (health missing)
     */
    drawHealthBar(x, y, w, h, ratio, frontColor, backColor) {
        const clamped = Math.max(0, Math.min(1, ratio));
        const ctx = this._ctx;
        ctx.save();

        // Background
        ctx.fillStyle = backColor;
        ctx.fillRect(x, y, w, h);

        // Foreground (only draw if there is something to show)
        if (clamped > 0) {
            ctx.fillStyle = frontColor;
            ctx.fillRect(x, y, w * clamped, h);
        }

        ctx.restore();
    }

    // -----------------------------------------------------------------------
    // Screen shake
    // -----------------------------------------------------------------------

    /**
     * Set the screen-shake offset to apply on the next pushShake() call.
     * Values are in logical pixels. Set both to 0 to disable shaking.
     *
     * @param {number} offsetX — Horizontal offset in logical pixels
     * @param {number} offsetY — Vertical offset in logical pixels
     */
    setShake(offsetX, offsetY) {
        this._shakeX = offsetX;
        this._shakeY = offsetY;
    }

    /**
     * Save the current canvas state and apply the configured shake offset
     * as a translation. Must be paired with popShake().
     *
     * Typical usage:
     *   renderer.setShake(5, 0);
     *   renderer.pushShake();
     *   // ... draw calls offset by (5, 0) ...
     *   renderer.popShake();
     */
    pushShake() {
        this._ctx.save();
        if (this._shakeX !== 0 || this._shakeY !== 0) {
            this._ctx.translate(this._shakeX, this._shakeY);
        }
    }

    /**
     * Restore the canvas state saved by pushShake(). Must be called exactly
     * once for each pushShake() call.
     */
    popShake() {
        this._ctx.restore();
    }

    // -----------------------------------------------------------------------
    // Main render entry point
    // -----------------------------------------------------------------------

    /**
     * Render the game state to the canvas.
     *
     * Applies the design-resolution scale transform so that subsequent draw
     * calls in logical (1920x1080) coordinates map correctly to the actual
     * canvas dimensions, then draws entities from the state object.
     *
     * Note: does NOT call clear() — the caller is responsible for clearing
     * the canvas before calling render() (typically: clear() then render()).
     *
     * Currently a placeholder — entity rendering will be implemented in later
     * phases. The scale transform is correctly configured so that drawing at
     * design-resolution coordinates works immediately.
     *
     * @param {Object} state — The game state object (from game-state.js).
     *   Expected shape: { enemies: Array, particles: Array, player: {...}, ... }
     */
    render(state) {
        const canvasWidth = this._canvas.width;
        const canvasHeight = this._canvas.height;

        // Nothing to render if the canvas has no area.
        if (canvasWidth === 0 || canvasHeight === 0) return;

        const ctx = this._ctx;

        // Scale from design resolution to canvas device-pixel size.
        // After this, drawing at (DESIGN_WIDTH, DESIGN_HEIGHT) maps to the
        // full canvas, and drawing at any other logical coordinate scales
        // proportionally.
        const scaleX = canvasWidth / DESIGN_WIDTH;
        const scaleY = canvasHeight / DESIGN_HEIGHT;

        ctx.save();
        ctx.scale(scaleX, scaleY);

        // --- Dynamic background (stars, grid, gradient) ---
        renderBackground(ctx, state.elapsedTime);

        // --- Player base / castle (center of screen) ---
        renderBase(ctx, state.elapsedTime);

        // Apply screen shake
        const shake = getShakeOffset();
        ctx.save();
        if (shake.x !== 0 || shake.y !== 0) {
            ctx.translate(shake.x, shake.y);
        }

        // Render game entities
        renderEnemies(ctx, state.enemies);
        renderParticles(ctx, state.particles);
        renderFollowers(ctx, state.player?.activeFollowers || []);
        renderProjectiles(ctx);

        ctx.restore(); // shake

        // --- Boss HP bar (after entities, before screen flash) ---
        renderBossHpBar(ctx, state.enemies, state.elapsedTime);

        // --- Screen flash overlay ---
        // Drawn after all entities so it tints the entire scene.
        const flash = getScreenFlash();
        if (flash.color && flash.alpha > 0) {
            ctx.save();
            ctx.globalAlpha = flash.alpha;
            ctx.fillStyle = flash.color;
            ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
            ctx.restore();
        }

        ctx.restore(); // scale
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    /**
     * Remove the window resize listener. Call this when the renderer is no
     * longer needed (e.g., scene teardown) to prevent memory leaks.
     */
    destroy() {
        window.removeEventListener('resize', this._onResize);
    }

    // -----------------------------------------------------------------------
    // Convenience read-only accessors
    // -----------------------------------------------------------------------

    /** @returns {HTMLCanvasElement} The managed canvas element. */
    get canvas() {
        return this._canvas;
    }

    /** @returns {CanvasRenderingContext2D} The 2D rendering context. */
    get ctx() {
        return this._ctx;
    }

    /** @returns {number} Current device pixel ratio. */
    get dpr() {
        return this._dpr;
    }
}
