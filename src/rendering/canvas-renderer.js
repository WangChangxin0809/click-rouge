/**
 * CanvasRenderer — Main canvas rendering module.
 *
 * Handles clearing the canvas and drawing game state each frame.
 * Design dimensions define a logical coordinate space; the renderer
 * scales to the actual canvas pixel size automatically.
 *
 * Usage:
 *   import { CanvasRenderer, DESIGN_WIDTH, DESIGN_HEIGHT } from './rendering/canvas-renderer.js';
 *   const renderer = new CanvasRenderer(canvasElement);
 *   renderer.clear();
 *   renderer.render(STATE);
 */

/** Logical design width in pixels */
export const DESIGN_WIDTH = 1280;

/** Logical design height in pixels */
export const DESIGN_HEIGHT = 720;

export class CanvasRenderer {
    /**
     * @param {HTMLCanvasElement} canvas - The game canvas element
     */
    constructor(canvas) {
        /** @type {HTMLCanvasElement} */
        this.canvas = canvas;

        /** @type {CanvasRenderingContext2D} */
        this.ctx = canvas.getContext('2d');

        /** Current scale factors from design to actual pixels */
        this.scaleX = 1;
        this.scaleY = 1;

        this._resize();
    }

    /**
     * Clear the entire canvas to the background color.
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // Fill with the game background color
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Render the current game state to the canvas.
     * This is a stub — subsequent phases will expand to draw enemies, particles, etc.
     * @param {Object} state - The game STATE object
     */
    render(state) {
        const ctx = this.ctx;
        const cx = DESIGN_WIDTH / 2;
        const cy = DESIGN_HEIGHT / 2;

        // Ensure canvas size matches window (lazy resize each frame)
        this._resize();

        // --- Title text (shown on start screen / when not playing) ---
        if (state.gameStatus !== 'playing') {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Game title
            ctx.font = 'bold 48px "Microsoft YaHei", "PingFang SC", sans-serif';
            ctx.fillStyle = '#e94560';
            ctx.fillText('Click Rouge', cx, cy - 40);

            // Subtitle
            ctx.font = '18px "Microsoft YaHei", "PingFang SC", sans-serif';
            ctx.fillStyle = '#a0a0b0';
            if (state.gameStatus === 'start') {
                ctx.fillText('点击开始游戏', cx, cy + 20);
            } else if (state.gameStatus === 'gameOver') {
                ctx.fillText('游戏结束', cx, cy + 20);
            }

            ctx.restore();
            return;
        }

        // --- In-game rendering (placeholder) ---
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = '14px "Microsoft YaHei", "PingFang SC", sans-serif';
        ctx.fillStyle = '#a0a0b0';
        ctx.fillText(`Wave ${state.wave} | Time: ${state.elapsedTime.toFixed(1)}s`, 10, 10);
        ctx.restore();
    }

    /**
     * Resize the canvas to match the viewport size, computing scale factors.
     * Called automatically by render() — safe to call at any time.
     */
    _resize() {
        const dpr = window.devicePixelRatio || 1;
        const w = window.innerWidth;
        const h = window.innerHeight;

        // Only resize if dimensions actually changed
        if (this.canvas.width === w * dpr && this.canvas.height === h * dpr) {
            return;
        }

        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';

        this.scaleX = this.canvas.width / DESIGN_WIDTH;
        this.scaleY = this.canvas.height / DESIGN_HEIGHT;

        // Scale the context so drawing uses design coordinates
        this.ctx.setTransform(this.scaleX, 0, 0, this.scaleY, 0, 0);
    }
}
