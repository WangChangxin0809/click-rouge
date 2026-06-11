/**
 * EnemyRenderer — Rich visual rendering for all enemy types in Click Rouge.
 *
 * Each enemy type has a distinct visual style built with Canvas 2D:
 *   - Slime:      green radial gradient blob, bouncy squash-stretch
 *   - Bat:        dark purple body + bezier-curve wings that flap
 *   - Golem:      grey angular body with rock-crack strokes
 *   - Ghost:      white semi-transparent teardrop, wavy bottom edge
 *   - Fire Skull: orange-red gradient + orbiting flame dots
 *
 * Boss entities (isBoss === true) are delegated to boss-renderer.js.
 *
 * All draw calls use the design-resolution coordinate system (1920x1080).
 * The caller must apply the scale transform before invoking renderEnemies().
 *
 * Usage (inside CanvasRenderer.render):
 *   import { renderEnemies } from './rendering/enemy-renderer.js';
 *   renderEnemies(ctx, STATE.enemies);
 */

import { STATE } from '../core/game-state.js';
import { renderBosses } from './boss-renderer.js';

// ---------------------------------------------------------------------------
// Animation constants
// ---------------------------------------------------------------------------

const HIT_FLASH_DURATION = 0.1;

/** How many pixels the float animation lifts the enemy */
const FLOAT_AMPLITUDE = 3;

/** Speed of the float sine-wave (rad/s) */
const FLOAT_SPEED = 3.0;

/** How much horizontal squish to apply during float bounce (0..0.06) */
const SQUISH_AMOUNT = 0.04;

/** Default radius fallback when an enemy's size is missing */
const DEFAULT_RADIUS = 20;

/** Default type-colour fallback when an enemy has no color property */
const DEFAULT_COLORS = {
    slime:      '#4ecca3',
    bat:        '#8b5cf6',
    golem:      '#78716c',
    ghost:      '#c8c0f0',
    fire_skull: '#f97316',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render all active enemies to the canvas.
 *
 * Separates regular enemies from bosses and delegates appropriately.
 * Boss bodies are drawn by boss-renderer; regular enemies use type-specific
 * drawing functions below.
 *
 * @param {CanvasRenderingContext2D} ctx — 2D context, already scaled to design resolution
 * @param {Object[]} enemies — Array of enemy state objects from STATE.enemies
 */
export function renderEnemies(ctx, enemies) {
    if (!enemies || enemies.length === 0) return;

    const now = STATE.elapsedTime;
    const bosses = [];
    const regulars = [];

    for (let i = 0, len = enemies.length; i < len; i++) {
        const e = enemies[i];
        if (!e || e.hp <= 0) continue;
        if (e.isBoss) {
            bosses.push(e);
        } else {
            regulars.push(e);
        }
    }

    // ---- Regular enemies ----
    for (let i = 0, len = regulars.length; i < len; i++) {
        _renderEnemy(ctx, regulars[i], now);
    }

    // ---- Bosses ----
    if (bosses.length > 0) {
        renderBosses(ctx, bosses, now);
    }
}

// ---------------------------------------------------------------------------
// Per-enemy dispatch
// ---------------------------------------------------------------------------

/**
 * Render a single regular enemy with float animation, hit-flash, eyes, and HP bar.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} e — Enemy state object
 * @param {number} now — STATE.elapsedTime
 */
function _renderEnemy(ctx, e, now) {
    const r = e.size != null ? e.size : DEFAULT_RADIUS;

    // Hit-flash detection
    const lastHit = e.lastHitTime;
    const isFlashing = (lastHit != null) && ((now - lastHit) < HIT_FLASH_DURATION);
    const flashProgress = isFlashing ? (now - lastHit) / HIT_FLASH_DURATION : 1;

    // Float animation: sin-wave vertical offset + slight horizontal squish
    const phase = (e.id * 0.7) % (Math.PI * 2);
    const floatY = Math.sin(now * FLOAT_SPEED + phase) * FLOAT_AMPLITUDE;
    const squish = 1 + Math.sin(now * 4 + phase) * SQUISH_AMOUNT;

    ctx.save();
    ctx.translate(e.x, e.y + floatY);

    // Squish effect: scale X inversely to simulate bouncy compression
    ctx.scale(squish, 2 - squish);

    // Hit flash: add scale jitter that oscillates rapidly then settles
    if (isFlashing) {
        const jitterMag = (1 - flashProgress) * 0.06;
        const jitter = Math.sin(now * 50) * jitterMag;
        ctx.scale(1 + jitter, 1 + jitter);
    }

    // ---- Outer glow (shadowBlur) ----
    if (!isFlashing) {
        const baseColor = e.color || DEFAULT_COLORS[e.typeId] || '#ff4444';
        ctx.shadowColor = _lightenColor(baseColor, 0.6);
        ctx.shadowBlur = r * 0.65;
    }

    // ---- Body (type-specific) ----
    switch (e.typeId) {
        case 'slime':      _drawSlime(ctx, e, r, now, isFlashing); break;
        case 'bat':        _drawBat(ctx, e, r, now, isFlashing); break;
        case 'golem':      _drawGolem(ctx, e, r, now, isFlashing); break;
        case 'ghost':      _drawGhost(ctx, e, r, now, isFlashing); break;
        case 'fire_skull': _drawFireSkull(ctx, e, r, now, isFlashing); break;
        default:           _drawDefault(ctx, e, r, isFlashing); break;
    }

    // Reset shadow so it doesn't affect eyes / health bar
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // ---- Eyes (cartoon style, skipped for ghost which has its own) ----
    if (e.typeId !== 'ghost') {
        _drawEye(ctx, -r * 0.35, -r * 0.15, r * 0.13, isFlashing);
        _drawEye(ctx,  r * 0.35, -r * 0.15, r * 0.13, isFlashing);
    }

    // ---- Health bar (below body) ----
    _drawHealthBar(ctx, e, r);

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Type-specific body drawing
// ---------------------------------------------------------------------------

/**
 * Slime — green bouncy blob with radial gradient.
 * The body is a slightly squished circle with a bright highlight spot
 * and a dark rim for depth. The squish from the caller scale() gives it
 * the classic Q弹 (bouncy jelly) feel.
 */
function _drawSlime(ctx, e, r, now, isFlashing) {
    const col = e.color || '#4ecca3';

    ctx.save();

    if (isFlashing) {
        // Solid white silhouette for flash
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Radial gradient: highlight at upper-left, dark rim
        const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.15, 0, 0, r);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.25, _lightenColor(col, 0.4));
        grad.addColorStop(0.65, col);
        grad.addColorStop(1, _darkenColor(col, 0.35));

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Subtle rim light
        ctx.strokeStyle = _lightenColor(col, 0.2);
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    ctx.restore();
}

/**
 * Bat — dark purple body with two flapping bezier-curve wings.
 * The body is a small ellipse; each wing is a triangular membrane
 * attached to the body side, flapping via sin-wave angle oscillation.
 */
function _drawBat(ctx, e, r, now, isFlashing) {
    const col = e.color || '#8b5cf6';

    ctx.save();

    // Body: horizontal ellipse (bat body is wider than tall)
    if (isFlashing) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.8, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        // Flash wings too — white silhouette
        const wingPhase = now * 8 + (e.id * 1.1);
        const wingAngle = Math.sin(wingPhase) * 0.55;
        _drawWings(ctx, r, wingAngle, '#ffffff');
    } else {
        // Body radial gradient
        const bodyGrad = ctx.createRadialGradient(-r * 0.1, -r * 0.15, r * 0.05, 0, 0, r * 0.7);
        bodyGrad.addColorStop(0, _lightenColor(col, 0.35));
        bodyGrad.addColorStop(0.6, col);
        bodyGrad.addColorStop(1, _darkenColor(col, 0.3));

        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.8, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wings
        const wingPhase = now * 8 + (e.id * 1.1);
        const wingAngle = Math.sin(wingPhase) * 0.55;
        _drawWings(ctx, r, wingAngle, col);
    }

    // Small pointed ears on top
    ctx.fillStyle = isFlashing ? '#ffffff' : _darkenColor(col, 0.2);
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.4);
    ctx.lineTo(-r * 0.05, -r * 0.75);
    ctx.lineTo(r * 0.15, -r * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.3, -r * 0.4);
    ctx.lineTo(r * 0.05, -r * 0.75);
    ctx.lineTo(-r * 0.15, -r * 0.3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

/**
 * Draw both bat wings as bezier-curve membranes.
 * @param {number} r — radius (for scaling)
 * @param {number} wingAngle — current flap angle in radians
 * @param {string} color — fill colour
 */
function _drawWings(ctx, r, wingAngle, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;

    // Each wing: a curved triangle from the body side outward and upward
    // Left wing
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.1);
    const leftTipX = -r * 1.7 - Math.cos(wingAngle) * r * 0.4;
    const leftTipY = -Math.sin(wingAngle) * r * 1.3;
    ctx.quadraticCurveTo(-r * 1.1, -r * 0.9, leftTipX, leftTipY);
    ctx.quadraticCurveTo(-r * 0.9, r * 0.15, -r * 0.55, r * 0.25);
    ctx.closePath();
    ctx.fill();

    // Right wing (mirrored)
    ctx.beginPath();
    ctx.moveTo(r * 0.55, -r * 0.1);
    const rightTipX = r * 1.7 + Math.cos(wingAngle) * r * 0.4;
    const rightTipY = -Math.sin(wingAngle) * r * 1.3;
    ctx.quadraticCurveTo(r * 1.1, -r * 0.9, rightTipX, rightTipY);
    ctx.quadraticCurveTo(r * 0.9, r * 0.15, r * 0.55, r * 0.25);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

/**
 * Golem — angular stone body with rock-crack lines.
 * Drawn as a rounded octagon with radial gradient for stone texture
 * and several stroke lines as surface cracks.
 */
function _drawGolem(ctx, e, r, now, isFlashing) {
    const col = e.color || '#78716c';

    ctx.save();

    if (isFlashing) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ffffff';
    } else {
        const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.1, 0, 0, r);
        grad.addColorStop(0, _lightenColor(col, 0.25));
        grad.addColorStop(0.5, col);
        grad.addColorStop(1, _darkenColor(col, 0.4));

        ctx.fillStyle = grad;
        ctx.strokeStyle = _darkenColor(col, 0.3);
    }

    // Octagon body
    const sides = 8;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        const angle = (Math.PI * 2 / sides) * i - Math.PI / 2;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Rock-crack lines
    if (!isFlashing) {
        ctx.strokeStyle = _darkenColor(col, 0.5);
        ctx.lineWidth = 1;
        const phase = e.id * 0.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.15);
        ctx.lineTo(r * 0.2,  r * 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.3, -r * 0.5);
        ctx.lineTo(r * 0.5, -r * 0.1);
        ctx.lineTo(r * 0.1,  r * 0.3);
        ctx.stroke();
    }

    ctx.restore();
}

/**
 * Ghost — semi-transparent white teardrop shape with wavy bottom.
 * The body fades from opaque white at the top to fully transparent
 * at the wavy trailing edge.
 */
function _drawGhost(ctx, e, r, now, isFlashing) {
    ctx.save();

    // Ghost wobble: slight horizontal oscillation
    const wobble = Math.sin(now * 2.5 + e.id * 0.9) * r * 0.1;
    ctx.translate(wobble, 0);

    if (isFlashing) {
        // Solid white for flash
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 1;
        _ghostPath(ctx, 0, 0, r, now);
        ctx.fill();
    } else {
        // Radial gradient for body: bright center, fading to transparent at bottom
        const grad = ctx.createRadialGradient(0, -r * 0.3, r * 0.1, 0, r * 0.5, r * 1.2);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        grad.addColorStop(0.4, 'rgba(220, 210, 255, 0.8)');
        grad.addColorStop(0.7, 'rgba(180, 170, 220, 0.4)');
        grad.addColorStop(1, 'rgba(140, 130, 200, 0.05)');

        ctx.fillStyle = grad;
        _ghostPath(ctx, 0, 0, r, now);
        ctx.fill();

        // Ghostly eyes: hollow white ovals
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = 'rgba(80, 70, 130, 0.6)';
        ctx.lineWidth = 1;
        const eyeR = r * 0.15;
        ctx.beginPath();
        ctx.ellipse(-r * 0.3, -r * 0.15, eyeR, eyeR * 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(r * 0.3, -r * 0.15, eyeR, eyeR * 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pupils
        ctx.fillStyle = 'rgba(40, 30, 80, 0.8)';
        ctx.beginPath();
        ctx.arc(-r * 0.3, -r * 0.12, eyeR * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(r * 0.3, -r * 0.12, eyeR * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * Build the ghost's teardrop path with wavy bottom edge.
 */
function _ghostPath(ctx, cx, cy, r, now) {
    ctx.beginPath();
    // Top arc: semicircle
    ctx.arc(cx, cy - r * 0.1, r, Math.PI, 0);
    // Right side down
    ctx.lineTo(cx + r, cy + r * 0.4);
    // Wavy bottom: series of bezier bumps from right to left
    const waveSegments = 4;
    const segW = (r * 2) / waveSegments;
    const waveAmp = r * 0.35;
    const waveFreq = 3;
    for (let i = waveSegments - 1; i >= 0; i--) {
        const startX = cx + r - (i + 1) * segW;
        const endX = cx + r - i * segW;
        const midX = (startX + endX) / 2;
        const waveY = cy + r * 0.4 + Math.sin(now * 3 + i * 0.8) * waveAmp;
        ctx.quadraticCurveTo(midX, waveY, endX, cy + r * 0.4);
    }
    // Back to left side top
    ctx.closePath();
}

/**
 * Fire Skull — orange-red skull shape with radial gradient and orbiting
 * flame particles drawn procedurally.
 */
function _drawFireSkull(ctx, e, r, now, isFlashing) {
    ctx.save();

    const col = '#f97316';
    const flameCount = 8;

    if (isFlashing) {
        // White silhouette
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Body: radial gradient from bright yellow-orange core to dark red rim
        const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r * 0.95);
        grad.addColorStop(0, '#ffdd00');
        grad.addColorStop(0.3, '#ff8800');
        grad.addColorStop(0.7, '#e04500');
        grad.addColorStop(1, '#6b1a00');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
        ctx.fill();

        // Dark eye sockets (skull look)
        ctx.fillStyle = '#1a0500';
        ctx.beginPath();
        ctx.ellipse(-r * 0.3, -r * 0.15, r * 0.15, r * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(r * 0.3, -r * 0.15, r * 0.15, r * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Glowing pupils inside sockets
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(-r * 0.3, -r * 0.13, r * 0.06, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(r * 0.3, -r * 0.13, r * 0.06, 0, Math.PI * 2);
        ctx.fill();

        // Jaw line (horizontal slit)
        ctx.strokeStyle = '#2b0a00';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.35, r * 0.3);
        ctx.lineTo(r * 0.35, r * 0.3);
        ctx.stroke();
        // Vertical jaw lines
        ctx.beginPath();
        ctx.moveTo(-r * 0.35, r * 0.3);
        ctx.lineTo(-r * 0.3, r * 0.55);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.35, r * 0.3);
        ctx.lineTo(r * 0.3, r * 0.55);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.05, r * 0.3);
        ctx.lineTo(0, r * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.05, r * 0.3);
        ctx.lineTo(0, r * 0.5);
        ctx.stroke();
    }

    // Orbiting flame particles (drawn procedurally, not managed by particle system)
    if (!isFlashing) {
        for (let i = 0; i < flameCount; i++) {
            const flameAngle = (Math.PI * 2 / flameCount) * i + now * 1.5;
            const flameDist = r * 1.05;
            const fx = Math.cos(flameAngle) * flameDist;
            const fy = Math.sin(flameAngle) * flameDist;
            const flameSize = r * (0.12 + Math.sin(now * 6 + i) * 0.04);

            const flameGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, flameSize);
            flameGrad.addColorStop(0, 'rgba(255, 200, 30, 0.9)');
            flameGrad.addColorStop(0.5, 'rgba(255, 100, 0, 0.6)');
            flameGrad.addColorStop(1, 'rgba(255, 30, 0, 0)');

            ctx.fillStyle = flameGrad;
            ctx.beginPath();
            ctx.arc(fx, fy, flameSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

/**
 * Default generic enemy — radial gradient circle.
 * Used for any typeId not handled by a specific drawing function.
 */
function _drawDefault(ctx, e, r, isFlashing) {
    const col = e.color || '#ff4444';

    ctx.save();

    if (isFlashing) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
    } else {
        const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
        grad.addColorStop(0, _lightenColor(col, 0.35));
        grad.addColorStop(0.5, col);
        grad.addColorStop(1, _darkenColor(col, 0.3));

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Draw a single cartoon eye (white sclera + black pupil).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx — center X (relative to enemy center)
 * @param {number} cy — center Y (relative to enemy center)
 * @param {number} radius — sclera radius
 * @param {boolean} isFlashing — when true, eyes are drawn in flash-white
 */
function _drawEye(ctx, cx, cy, radius, isFlashing) {
    if (radius <= 0) return;
    const pupilR = radius * 0.5;

    ctx.save();
    ctx.fillStyle = isFlashing ? '#dddddd' : '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isFlashing ? '#444444' : '#111111';
    ctx.beginPath();
    ctx.arc(cx, cy, pupilR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

/**
 * Draw a floating health bar below the enemy body.
 * Position is relative to the enemy's local origin (0,0).
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} e — enemy state
 * @param {number} r — enemy radius
 */
function _drawHealthBar(ctx, e, r) {
    const hpRatio = e.maxHp > 0
        ? Math.max(0, Math.min(1, e.hp / e.maxHp))
        : 0;

    const barW = r * 2;
    const barH = 3.5;
    const barX = -barW / 2;
    const barY = r + 6;

    ctx.save();

    // Background (dark red)
    ctx.fillStyle = 'rgba(30, 5, 5, 0.7)';
    ctx.fillRect(barX, barY, barW, barH);

    // Border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barW, barH);

    // Foreground with colour gradient based on HP ratio
    if (hpRatio > 0) {
        if (hpRatio > 0.5) {
            ctx.fillStyle = '#44cc44';
        } else if (hpRatio > 0.25) {
            ctx.fillStyle = '#cccc44';
        } else {
            ctx.fillStyle = '#cc4444';
        }
        ctx.fillRect(barX, barY, barW * hpRatio, barH);

        // Small shine on top edge of the filled portion
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(barX, barY, barW * hpRatio, 1);
    }

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Color utility helpers
// ---------------------------------------------------------------------------

/**
 * Lighten a hex color by a factor (0..1).
 * @param {string} hex — CSS hex colour, e.g. '#4ecca3'
 * @param {number} factor — 0 = no change, 1 = white
 * @returns {string} CSS colour
 */
function _lightenColor(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lr = Math.min(255, Math.round(r + (255 - r) * factor));
    const lg = Math.min(255, Math.round(g + (255 - g) * factor));
    const lb = Math.min(255, Math.round(b + (255 - b) * factor));
    return `rgb(${lr},${lg},${lb})`;
}

/**
 * Darken a hex color by a factor (0..1).
 * @param {string} hex — CSS hex colour
 * @param {number} factor — 0 = no change, 1 = black
 * @returns {string} CSS colour
 */
function _darkenColor(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const dr = Math.max(0, Math.round(r * (1 - factor)));
    const dg = Math.max(0, Math.round(g * (1 - factor)));
    const db = Math.max(0, Math.round(b * (1 - factor)));
    return `rgb(${dr},${dg},${db})`;
}

// ---------------------------------------------------------------------------
// Public colour-utility exports
// ---------------------------------------------------------------------------

/**
 * Lighten a hex color by a factor (0..1).
 * 0 = no change, 1 = pure white.
 * @param {string} hex — CSS hex colour, e.g. '#4ecca3'
 * @param {number} factor — blend amount toward white
 * @returns {string} CSS rgb() colour
 */
export function lightenColor(hex, factor) {
    return _lightenColor(hex, factor);
}

/**
 * Darken a hex color by a factor (0..1).
 * 0 = no change, 1 = pure black.
 * @param {string} hex — CSS hex colour
 * @param {number} factor — blend amount toward black
 * @returns {string} CSS rgb() colour
 */
export function darkenColor(hex, factor) {
    return _darkenColor(hex, factor);
}
