/**
 * BossRenderer — Dramatic visual effects for boss enemies in Click Rouge.
 *
 * Each boss gets:
 *   - A larger, gradient-filled body with radial glow (shadowBlur)
 *   - A rotating halo ring around the body
 *   - A particle trail that follows the boss's movement
 *   - Entrance animation: flash + fly-in from off-screen
 *   - Hit-shake: body jitter when damaged
 *   - A wide, centered HP bar at the top of the screen
 *
 * Performance note: shadowBlur is GPU-intensive. We apply it only to the
 * boss body (at most one boss on screen), never to regular enemies.
 *
 * Usage (from enemy-renderer.js):
 *   import { renderBosses, renderBossHpBar } from './boss-renderer.js';
 *   renderBosses(ctx, bosses, elapsedTime);
 *   renderBossHpBar(ctx, enemies, elapsedTime);
 */

import { DESIGN_WIDTH } from '../core/constants.js';

// ---------------------------------------------------------------------------
// Animation state tracking (per-boss, keyed by boss.id)
// ---------------------------------------------------------------------------

/**
 * @type {Map<number, { entranceStart: number, trail: Array<{x:number,y:number}>, lastHitTime: number }>}
 */
const _bossStates = new Map();

const ENTRANCE_DURATION = 1.2;     // seconds for entrance fly-in
const TRAIL_LENGTH = 20;           // max trail positions stored
const TRAIL_INTERVAL = 0.03;       // seconds between trail samples
const HALO_ROTATION_SPEED = 2.0;   // rad/s for the halo ring

// ---------------------------------------------------------------------------
// Public API — boss body rendering
// ---------------------------------------------------------------------------

/**
 * Render all boss bodies with halo, trail, and effects.
 * Called from renderEnemies() after regular enemies are drawn.
 *
 * @param {CanvasRenderingContext2D} ctx — 2D context (already scaled)
 * @param {Object[]} bosses — Array of boss enemy objects (isBoss === true)
 * @param {number} now — STATE.elapsedTime
 */
export function renderBosses(ctx, bosses, now) {
    for (let i = 0, len = bosses.length; i < len; i++) {
        _renderBoss(ctx, bosses[i], now);
    }

    // Clean up stale boss states (boss no longer in array)
    _cleanupStates(bosses);
}

/**
 * Render the top-center boss HP bar.
 * Should be called after all entities are drawn but before the screen flash
 * overlay, so the bar floats above all game objects.
 *
 * Only draws if there is at least one alive boss.
 *
 * @param {CanvasRenderingContext2D} ctx — 2D context (already scaled)
 * @param {Object[]} enemies — Full STATE.enemies array
 * @param {number} now — STATE.elapsedTime
 */
export function renderBossHpBar(ctx, enemies, now) {
    if (!enemies || enemies.length === 0) return;

    // Find the first alive boss
    let boss = null;
    for (let i = 0; i < enemies.length; i++) {
        if (enemies[i].isBoss && enemies[i].hp > 0) {
            boss = enemies[i];
            break;
        }
    }
    if (!boss) return;

    const hpRatio = boss.maxHp > 0
        ? Math.max(0, Math.min(1, boss.hp / boss.maxHp))
        : 0;

    const barW = 768;
    const barH = 26;
    const barX = (DESIGN_WIDTH - barW) / 2;
    const barY = 70;

    ctx.save();

    // Outer glow (subtle)
    ctx.shadowColor = 'rgba(255, 50, 50, 0.4)';
    ctx.shadowBlur = 8;

    // Background plate
    ctx.fillStyle = 'rgba(10, 5, 10, 0.8)';
    const radii = 8;
    _roundRect(ctx, barX - 4, barY - 4, barW + 8, barH + 8, radii + 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Border
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.6)';
    ctx.lineWidth = 1.5;
    _roundRect(ctx, barX - 4, barY - 4, barW + 8, barH + 8, radii + 2);
    ctx.stroke();

    // HP bar background
    ctx.fillStyle = 'rgba(40, 10, 10, 0.9)';
    _roundRect(ctx, barX, barY, barW, barH, radii);
    ctx.fill();

    // HP fill with gradient
    if (hpRatio > 0) {
        const hpGrad = ctx.createLinearGradient(barX, 0, barX + barW * hpRatio, 0);
        if (hpRatio > 0.5) {
            hpGrad.addColorStop(0, '#ff4444');
            hpGrad.addColorStop(0.5, '#ff8844');
            hpGrad.addColorStop(1, '#ffaa22');
        } else if (hpRatio > 0.25) {
            hpGrad.addColorStop(0, '#ff2222');
            hpGrad.addColorStop(1, '#ff6622');
        } else {
            hpGrad.addColorStop(0, '#cc1111');
            hpGrad.addColorStop(1, '#ff3333');
        }

        ctx.fillStyle = hpGrad;
        _roundRect(ctx, barX, barY, barW * hpRatio, barH, radii);
        ctx.fill();

        // Shine line on top of filled portion
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(barX, barY, barW * hpRatio, 3);
    }

    // Boss name label
    const name = boss.typeId ? boss.typeId.replace(/_/g, ' ').toUpperCase() : 'BOSS';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(name, DESIGN_WIDTH / 2, barY - 6);

    // HP numbers
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#dddddd';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
        `${Math.ceil(boss.hp)} / ${boss.maxHp}`,
        DESIGN_WIDTH / 2,
        barY + barH / 2
    );

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Internal — single boss rendering
// ---------------------------------------------------------------------------

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} boss
 * @param {number} now
 */
function _renderBoss(ctx, boss, now) {
    const r = boss.size || 50;

    // Get or create animation state
    let state = _bossStates.get(boss.id);
    if (!state) {
        state = {
            entranceStart: now,
            trail: [],
            lastHitTime: 0,
            lastTrailTime: 0,
        };
        _bossStates.set(boss.id, state);
    }

    // Entrance progress (0..1)
    const entranceElapsed = now - state.entranceStart;
    const entranceProgress = Math.min(1, entranceElapsed / ENTRANCE_DURATION);

    // Update trail
    if (now - state.lastTrailTime >= TRAIL_INTERVAL) {
        state.lastTrailTime = now;
        state.trail.push({ x: boss.x, y: boss.y });
        if (state.trail.length > TRAIL_LENGTH) {
            state.trail.shift();
        }
    }

    // Hit detection for shake
    const isHitRecently = (boss.lastHitTime != null) && ((now - boss.lastHitTime) < 0.12);
    let shakeX = 0, shakeY = 0;
    if (isHitRecently) {
        const hitElapsed = now - boss.lastHitTime;
        const mag = (1 - hitElapsed / 0.12) * 4;
        shakeX = Math.sin(now * 60) * mag;
        shakeY = Math.cos(now * 55) * mag;
    }

    // Entrance animation: fly from off-screen
    const renderX = boss.x + shakeX + (1 - _easeOutCubic(entranceProgress)) * (boss.dirX * -200);
    const renderY = boss.y + shakeY + (1 - _easeOutCubic(entranceProgress)) * (boss.dirY * -200);
    const entranceAlpha = _easeOutCubic(Math.min(1, entranceElapsed / 0.6));
    const scale = 0.5 + _easeOutCubic(entranceProgress) * 0.5;
    // Entrance flash: first 0.3s the boss is pure white
    const entranceFlash = entranceElapsed < 0.3 ? (1 - entranceElapsed / 0.3) : 0;

    ctx.save();
    ctx.globalAlpha = entranceAlpha;

    // ---- Particle trail ----
    _drawBossTrail(ctx, state.trail, r, boss.color || '#ff4444');

    // ---- Rotating halo (behind body) ----
    _drawBossHalo(ctx, renderX, renderY, r * 1.25, now);

    // ---- Body with glow ----
    ctx.save();
    ctx.translate(renderX, renderY);
    ctx.scale(scale, scale);

    // Glow effect (shadowBlur — GPU intensive, only for the boss)
    ctx.shadowColor = boss.color || '#ff4444';
    ctx.shadowBlur = entranceElapsed < 0.5 ? 20 + (1 - entranceElapsed / 0.5) * 30 : 20;

    // Body gradient
    const bodyGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    const col = boss.color || '#ff4444';
    if (entranceFlash > 0) {
        bodyGrad.addColorStop(0, '#ffffff');
        bodyGrad.addColorStop(0.4, _interpolateColor('#ffffff', col, 1 - entranceFlash * 0.5));
        bodyGrad.addColorStop(1, col);
    } else {
        bodyGrad.addColorStop(0, _lightenColor(col, 0.45));
        bodyGrad.addColorStop(0.3, _lightenColor(col, 0.2));
        bodyGrad.addColorStop(0.7, col);
        bodyGrad.addColorStop(1, _darkenColor(col, 0.4));
    }

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();

    // Body shape varies by type — same style as regular enemies but larger
    switch (boss.typeId) {
        case 'giant_slime':
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            break;
        case 'skeleton_king':
            // Angular skull-like shape
            _drawAngularBody(ctx, r, 6);
            break;
        case 'fire_dragon':
            // Wider, more intimidating shape
            _drawAngularBody(ctx, r * 0.9, 8);
            break;
        default:
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            break;
    }
    ctx.fill();

    // Rim stroke
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.strokeStyle = entranceFlash > 0 ? '#ffffff' : _lightenColor(col, 0.3);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eyes (large, menacing)
    const eyeR = r * 0.15;
    ctx.fillStyle = entranceFlash > 0 ? '#ffffff' : '#ffcc00';
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.15, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.35, -r * 0.15, eyeR, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.15, eyeR * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.35, -r * 0.15, eyeR * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // body translate+scale
    ctx.restore(); // outer save
}

// ---------------------------------------------------------------------------
// Internal — Halo ring
// ---------------------------------------------------------------------------

/**
 * Draw a rotating glowing ring around the boss.
 * Uses two arc segments with partially transparent strokes for a
 * dynamic "energy ring" look.
 */
function _drawBossHalo(ctx, x, y, radius, now) {
    ctx.save();

    const rotation = now * HALO_ROTATION_SPEED;

    // Draw two partial arcs that rotate together
    for (let seg = 0; seg < 2; seg++) {
        const startAngle = rotation + seg * Math.PI;
        const endAngle = startAngle + Math.PI * 0.6;

        ctx.beginPath();
        ctx.arc(x, y, radius, startAngle, endAngle);
        ctx.strokeStyle = seg === 0
            ? 'rgba(255, 200, 50, 0.7)'
            : 'rgba(255, 120, 30, 0.5)';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // Faint full circle as "echo"
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 150, 50, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Internal — Trail
// ---------------------------------------------------------------------------

/**
 * Draw the boss's movement trail as fading circles connected by lines.
 */
function _drawBossTrail(ctx, trail, r, color) {
    if (trail.length < 2) return;

    ctx.save();

    const len = trail.length;
    for (let i = 0; i < len - 1; i++) {
        const t = i / len; // 0 (oldest) -> ~1 (newest)
        const alpha = t * 0.3; // trail is subtle

        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(trail[i].x, trail[i].y, r * t * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Internal — Helpers
// ---------------------------------------------------------------------------

/**
 * Draw a rounded-angular body (polygon with curved vertices).
 */
function _drawAngularBody(ctx, r, sides) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        const angle = (Math.PI * 2 / sides) * i - Math.PI / 2;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

/**
 * Rounded rectangle helper for the boss HP bar.
 */
function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

/**
 * Ease-out cubic for entrance animation smoothing.
 */
function _easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * Clean up boss states for bosses no longer in the array.
 */
function _cleanupStates(bosses) {
    const activeIds = new Set();
    for (let i = 0; i < bosses.length; i++) {
        activeIds.add(bosses[i].id);
    }
    for (const id of _bossStates.keys()) {
        if (!activeIds.has(id)) {
            _bossStates.delete(id);
        }
    }
}

// ---------------------------------------------------------------------------
// Color utilities (local copies to avoid cross-module coupling)
// ---------------------------------------------------------------------------

function _lightenColor(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lr = Math.min(255, Math.round(r + (255 - r) * factor));
    const lg = Math.min(255, Math.round(g + (255 - g) * factor));
    const lb = Math.min(255, Math.round(b + (255 - b) * factor));
    return `rgb(${lr},${lg},${lb})`;
}

function _darkenColor(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const dr = Math.max(0, Math.round(r * (1 - factor)));
    const dg = Math.max(0, Math.round(g * (1 - factor)));
    const db = Math.max(0, Math.round(b * (1 - factor)));
    return `rgb(${dr},${dg},${db})`;
}

function _interpolateColor(hex1, hex2, t) {
    const r1 = parseInt(hex1.slice(1, 3), 16);
    const g1 = parseInt(hex1.slice(3, 5), 16);
    const b1 = parseInt(hex1.slice(5, 7), 16);
    const r2 = parseInt(hex2.slice(1, 3), 16);
    const g2 = parseInt(hex2.slice(3, 5), 16);
    const b2 = parseInt(hex2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${b})`;
}
