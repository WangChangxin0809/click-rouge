/**
 * BackgroundRenderer — Dynamic deep-space background for Click Rouge.
 *
 * Draws a layered background behind all game entities to replace the
 * static CSS dark colour. Three layers (back to front):
 *   1. Deep radial gradient (dark blue → near-black)
 *   2. Distant twinkling stars (slow parallax drift)
 *   3. Subtle grid lines (dark, creates spatial depth)
 *
 * All drawing is in design-resolution space (1920x1080). The caller
 * must apply the scale transform before calling renderBackground().
 *
 * Performance: stars are pre-allocated once; grid lines are computed
 * once and cached. No allocations per frame.
 *
 * Usage (inside CanvasRenderer.render):
 *   import { renderBackground } from './rendering/background-renderer.js';
 *   renderBackground(ctx, STATE.elapsedTime);
 */

import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../core/constants.js';

// ---------------------------------------------------------------------------
// Star field (initialized lazily on first frame)
// ---------------------------------------------------------------------------

/** @type {Array<{x:number, y:number, size:number, speed:number, alpha:number, twinklePhase:number, twinkleSpeed:number}>} */
let _stars = null;

const STAR_COUNT = 90;

function _ensureStars() {
    if (_stars) return;
    _stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
        _stars.push({
            x: Math.random() * DESIGN_WIDTH,
            y: Math.random() * DESIGN_HEIGHT,
            size: Math.random() * 1.8 + 0.4,
            speed: Math.random() * 12 + 4,       // px/s upward drift
            alpha: Math.random() * 0.5 + 0.2,     // base alpha
            twinklePhase: Math.random() * Math.PI * 2,
            twinkleSpeed: Math.random() * 1.5 + 0.5,
        });
    }
}

// ---------------------------------------------------------------------------
// Grid lines (computed once)
// ---------------------------------------------------------------------------

/** @type {{ horizontal: number[], vertical: number[] }} */
let _gridLines = null;
const GRID_SPACING = 160; // logical pixels between grid lines

function _ensureGridLines() {
    if (_gridLines) return;
    const h = [];
    const v = [];
    for (let y = 0; y <= DESIGN_HEIGHT; y += GRID_SPACING) h.push(y);
    for (let x = 0; x <= DESIGN_WIDTH; x += GRID_SPACING) v.push(x);
    _gridLines = { horizontal: h, vertical: v };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render the full dynamic background.
 *
 * Must be called after the design-resolution scale transform is applied,
 * before any game entities are drawn.
 *
 * @param {CanvasRenderingContext2D} ctx — 2D context (already scaled)
 * @param {number} elapsedTime — Total elapsed time in seconds (from STATE)
 */
export function renderBackground(ctx, elapsedTime) {
    _drawGradient(ctx);
    _drawStars(ctx, elapsedTime);
    _drawGrid(ctx);
}

// ---------------------------------------------------------------------------
// Layer 1 — deep radial gradient
// ---------------------------------------------------------------------------

function _drawGradient(ctx) {
    // Linear gradient: top dark → bottom slightly lighter
    // Creates depth while keeping the scene readable
    const grad = ctx.createLinearGradient(0, 0, 0, DESIGN_HEIGHT);
    grad.addColorStop(0, '#0a0c18');    // deep near-black at top
    grad.addColorStop(0.35, '#101428'); // dark indigo
    grad.addColorStop(0.7, '#181f35');  // mid-blue with warmth
    grad.addColorStop(1, '#141c2e');    // bottom slightly lighter than top

    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    ctx.restore();
}

// ---------------------------------------------------------------------------
// Layer 2 — twinkling stars
// ---------------------------------------------------------------------------

function _drawStars(ctx, elapsedTime) {
    _ensureStars();

    ctx.save();

    for (let i = 0; i < STAR_COUNT; i++) {
        const s = _stars[i];

        // Move star horizontally for parallax depth, wrap around
        s.x -= s.speed * 0.016; // approx per-frame at 60fps
        if (s.x < -10) {
            s.x = DESIGN_WIDTH + 10;
            s.y = Math.random() * DESIGN_HEIGHT;
        }

        // Twinkle: alpha oscillates
        const twinkle = s.alpha * (0.5 + 0.5 * Math.sin(elapsedTime * s.twinkleSpeed + s.twinklePhase));

        // Draw star as a very small circle
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();

        // Slightly larger glow for brighter stars (size > 1.4)
        if (s.size > 1.4 && twinkle > s.alpha * 0.7) {
            ctx.globalAlpha = twinkle * 0.3;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size * 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Layer 3 — dark grid lines (spatial depth)
// ---------------------------------------------------------------------------

function _drawGrid(ctx) {
    _ensureGridLines();

    ctx.save();
    ctx.strokeStyle = 'rgba(40, 50, 80, 0.08)';
    ctx.lineWidth = 1;

    const hLines = _gridLines.horizontal;
    const vLines = _gridLines.vertical;

    // Horizontal lines
    for (let i = 0; i < hLines.length; i++) {
        ctx.beginPath();
        ctx.moveTo(0, hLines[i]);
        ctx.lineTo(DESIGN_WIDTH, hLines[i]);
        ctx.stroke();
    }

    // Vertical lines
    for (let i = 0; i < vLines.length; i++) {
        ctx.beginPath();
        ctx.moveTo(vLines[i], 0);
        ctx.lineTo(vLines[i], DESIGN_HEIGHT);
        ctx.stroke();
    }

    // Slightly brighter center cross (focuses attention on center)
    ctx.strokeStyle = 'rgba(60, 75, 110, 0.06)';
    ctx.beginPath();
    ctx.moveTo(DESIGN_WIDTH / 2, 0);
    ctx.lineTo(DESIGN_WIDTH / 2, DESIGN_HEIGHT);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, DESIGN_HEIGHT / 2);
    ctx.lineTo(DESIGN_WIDTH, DESIGN_HEIGHT / 2);
    ctx.stroke();

    ctx.restore();
}
