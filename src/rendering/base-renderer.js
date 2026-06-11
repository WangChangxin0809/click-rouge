/**
 * BaseRenderer — Draws the player's base / castle at the screen center.
 *
 * Renders a stylized castle with a circular stone base, a central tower with
 * crenellations, two flanking turrets, and a waving flag on top. A pulsing
 * glow effect (breathing animation) radiates outward from the base, giving the
 * structure a sense of life and importance.
 *
 * The castle represents the player's stronghold — enemies reaching the center
 * damage it (via distance-based collision in spawn-system.js).
 *
 * Implements: Click Rouge base defense design.
 *
 * Usage:
 *   import { renderBase } from './rendering/base-renderer.js';
 *   // In canvas-renderer.js render():
 *   renderBase(ctx, state.elapsedTime);
 */

// ---------------------------------------------------------------------------
// Design constants (tunable)
// ---------------------------------------------------------------------------

/** Center position in design coordinates */
const CX = 1920 / 2;   // 960
const CY = 1080 / 2;   // 540

/** Base platform radius */
const BASE_RADIUS = 80;

/** Main tower width and height */
const TOWER_W = 48;
const TOWER_H = 90;

/** Turret dimensions */
const TURRET_W = 24;
const TURRET_H = 50;

/** Flag pole height above main tower */
const FLAG_POLE_H = 40;

/** Flag cloth width */
const FLAG_W = 22;

/** Pulse glow max additional radius */
const GLOW_EXTRA = 18;

/** Pulse period in seconds (full breath cycle) */
const PULSE_PERIOD = 2.5;

/** Collision / threat radius — enemies within this distance damage the base */
export const BASE_DAMAGE_RADIUS = 80;

// ---------------------------------------------------------------------------
// Internal drawing helpers
// ---------------------------------------------------------------------------

/**
 * Draw the circular stone base platform.
 * @param {CanvasRenderingContext2D} ctx
 */
function _drawPlatform(ctx) {
    // Outer ring
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.arc(CX, CY, BASE_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Inner platform (slightly lighter)
    ctx.fillStyle = '#4d4d4d';
    ctx.beginPath();
    ctx.arc(CX, CY, BASE_RADIUS - 10, 0, Math.PI * 2);
    ctx.fill();

    // Center stone detail
    ctx.fillStyle = '#555555';
    ctx.beginPath();
    ctx.arc(CX, CY, BASE_RADIUS - 25, 0, Math.PI * 2);
    ctx.fill();

    // Crack lines on platform for texture
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(CX + Math.cos(angle) * (BASE_RADIUS - 5), CY + Math.sin(angle) * (BASE_RADIUS - 5));
        ctx.stroke();
    }
}

/**
 * Draw a tower / turret shape at the given position.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Center X of tower base
 * @param {number} y - Top of tower (Y decreases upward on canvas)
 * @param {number} w - Tower width
 * @param {number} h - Tower height
 * @param {string} bodyColor - Fill color for tower body
 */
function _drawTower(ctx, x, y, w, h, bodyColor) {
    // Tower body
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x - w / 2, y - h, w, h);

    // Crenellations (battlements) on top
    ctx.fillStyle = '#5a5a5a';
    const crenW = w / 3;
    const crenH = 10;
    for (let i = 0; i < 3; i++) {
        const cx = x - w / 2 + crenW * i + crenW / 2;
        ctx.fillRect(cx - crenW / 2 + 1, y - h - crenH, crenW - 2, crenH);
    }

    // Window slit
    ctx.fillStyle = '#88ccff';
    ctx.fillRect(x - 3, y - h * 0.55, 6, 10);
}

/**
 * Draw the flag on a pole atop the main tower.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} elapsedTime - For wind animation
 */
function _drawFlag(ctx, elapsedTime) {
    const poleX = CX;
    const poleTop = CY - TOWER_H - FLAG_POLE_H;

    // Flag pole
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(poleX, CY - TOWER_H);
    ctx.lineTo(poleX, poleTop);
    ctx.stroke();

    // Pole top sphere
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(poleX, poleTop, 5, 0, Math.PI * 2);
    ctx.fill();

    // Flag cloth — wave animation
    const waveOffset = Math.sin(elapsedTime * 3.0) * 4;
    const flagRight = poleX + FLAG_W;

    ctx.save();
    ctx.fillStyle = '#cc2222';
    ctx.beginPath();
    ctx.moveTo(poleX + 2, poleTop + 2);
    ctx.lineTo(flagRight + waveOffset, poleTop + 2 + FLAG_W / 3);
    ctx.lineTo(flagRight + waveOffset * 0.5, poleTop + 2 + FLAG_W * 2 / 3);
    ctx.lineTo(poleX + 2, poleTop + 2 + FLAG_W);
    ctx.closePath();
    ctx.fill();

    // Flag emblem (simple star)
    ctx.fillStyle = '#ffdd44';
    const starX = poleX + FLAG_W / 2 + waveOffset * 0.3;
    const starY = poleTop + 2 + FLAG_W / 2;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 8 : 4;
        if (i === 0) ctx.moveTo(starX + Math.cos(a) * r, starY + Math.sin(a) * r);
        else ctx.lineTo(starX + Math.cos(a) * r, starY + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render the player's base / castle at the screen center.
 *
 * Draws the full castle assembly: platform, turrets, main tower, flag, and
 * a breathing glow effect.
 *
 * @param {CanvasRenderingContext2D} ctx - The 2D rendering context
 * @param {number} elapsedTime - Total elapsed run time in seconds (used for
 *   pulse and flag animations)
 */
export function renderBase(ctx, elapsedTime) {
    ctx.save();

    // --- Breathing glow (pulse) ---
    const pulse = (Math.sin(elapsedTime * Math.PI * 2 / PULSE_PERIOD) + 1) / 2; // 0..1
    const glowAlpha = 0.15 + pulse * 0.2; // 0.15 .. 0.35
    const glowRadius = BASE_RADIUS + GLOW_EXTRA + pulse * 8;

    // Outer glow ring
    const gradient = ctx.createRadialGradient(CX, CY, BASE_RADIUS * 0.6, CX, CY, glowRadius);
    gradient.addColorStop(0, `rgba(255, 200, 60, ${glowAlpha * 0.8})`);
    gradient.addColorStop(0.5, `rgba(255, 160, 30, ${glowAlpha * 0.4})`);
    gradient.addColorStop(1, 'rgba(255, 120, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(CX, CY, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // --- Draw the castle structure ---

    // Stone base platform
    _drawPlatform(ctx);

    // Left turret
    _drawTower(ctx, CX - BASE_RADIUS + TURRET_W, CY, TURRET_W, TURRET_H, '#606060');

    // Right turret
    _drawTower(ctx, CX + BASE_RADIUS - TURRET_W, CY, TURRET_W, TURRET_H, '#606060');

    // Main central tower
    _drawTower(ctx, CX, CY, TOWER_W, TOWER_H, '#707070');

    // Flag
    _drawFlag(ctx, elapsedTime);

    ctx.restore();
}
