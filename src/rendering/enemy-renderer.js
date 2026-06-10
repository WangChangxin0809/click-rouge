/**
 * EnemyRenderer — Draws all active enemy entities during the render phase.
 *
 * Called from inside CanvasRenderer.render() after the design-resolution scale
 * transform has been applied to the 2D context. All coordinates here are in
 * logical (1920x1080 design-resolution) space.
 *
 * Each enemy is drawn as:
 *   - A filled circle (body) in the enemy's colour
 *   - A thin health bar floating above the body
 *   - Two small "eyes" (white circles with black pupils) for character
 *   - A brief white flash-override if the enemy was hit within the last 0.1 s
 *
 * Usage (inside renderer.render):
 *   import { renderEnemies } from './rendering/enemy-renderer.js';
 *   renderEnemies(ctx, STATE.enemies);
 */

import { STATE } from '../core/game-state.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Flash duration in seconds after being damaged. */
const HIT_FLASH_DURATION = 0.1;

/** Default radius when an enemy does not provide one. */
const DEFAULT_RADIUS = 20;

/** Default body colour when an enemy does not provide one. */
const DEFAULT_COLOR = '#ff4444';

/**
 * Draw every active enemy onto the canvas context.
 *
 * The context MUST already have the design-resolution scale transform applied
 * (i.e. this function must be called between ctx.save/restore that sets up
 * the scale, as done inside CanvasRenderer.render).
 *
 * @param {CanvasRenderingContext2D} ctx — 2D context, already scaled to design resolution
 * @param {Object[]} enemies — Array of enemy state objects from STATE.enemies
 */
export function renderEnemies(ctx, enemies) {
    if (!enemies || enemies.length === 0) return;

    const now = STATE.elapsedTime;

    for (let i = 0, len = enemies.length; i < len; i++) {
        const e = enemies[i];
        if (!e) continue;

        const x = e.x;
        const y = e.y;
        const r  = e.size != null ? e.size : DEFAULT_RADIUS;

        // Skip enemies that are fully dead (no HP remaining).
        // Guardians (bosses, etc.) may have hp <= 0 and still want to be drawn
        // for a death animation — the caller can change this guard.
        if (e.hp <= 0) continue;

        // ---- body ----
        const lastHit = e.lastHitTime;
        const isFlashing = (lastHit != null) && ((now - lastHit) < HIT_FLASH_DURATION);
        const bodyColor = isFlashing ? '#ffffff' : (e.color || DEFAULT_COLOR);

        ctx.save();
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Thin outline for definition against similar-coloured backgrounds.
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // ---- eyes ----
        _drawEye(ctx, x - r * 0.35, y - r * 0.2, r * 0.12);
        _drawEye(ctx, x + r * 0.35, y - r * 0.2, r * 0.12);

        // ---- health bar ----
        const hpRatio = e.maxHp > 0
            ? Math.max(0, Math.min(1, e.hp / e.maxHp))
            : 0;

        const barW = r * 2;
        const barH = 4;
        const barX = x - barW / 2;
        const barY = y - r - 8;

        ctx.save();
        // Background (red)
        ctx.fillStyle = '#cc2222';
        ctx.fillRect(barX, barY, barW, barH);
        // Foreground (green → yellow → red gradient approximation)
        if (hpRatio > 0) {
            if (hpRatio > 0.5) {
                ctx.fillStyle = '#44cc44';
            } else if (hpRatio > 0.25) {
                ctx.fillStyle = '#cccc44';
            } else {
                ctx.fillStyle = '#cc4444';
            }
            ctx.fillRect(barX, barY, barW * hpRatio, barH);
        }
        ctx.restore();
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Draw a single cartoon eye: white sclera plus black pupil.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx — Center X of the eye
 * @param {number} cy — Center Y of the eye
 * @param {number} radius — Radius of the sclera
 */
function _drawEye(ctx, cx, cy, radius) {
    const r = Math.max(1.5, radius);
    const pupilR = r * 0.5;

    ctx.save();

    // Sclera
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(cx, cy, pupilR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}
