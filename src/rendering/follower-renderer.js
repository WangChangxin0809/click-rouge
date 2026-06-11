/**
 * Follower Renderer — Rich visual rendering for follower companions.
 *
 * Each follower type has a distinct visual style built with Canvas 2D:
 *   - Knight:       shield + sword, metallic armor with radial gradient
 *   - Archer:       small figure + bow, green hood
 *   - Healer Fairy: wings + halo + orbiting sparkles, semi-transparent
 *   - Gold Magnet:  U-shaped magnet + orbiting gold coins
 *
 * All followers float gently via sin-wave animation and use radial
 * gradients for a 3D appearance. Visual size is scaled up from the
 * definition size to the 35–45 px range for richer detail.
 *
 * Usage:
 *   import { renderFollowers } from './rendering/follower-renderer.js';
 *   renderFollowers(ctx, STATE.player.activeFollowers);
 */

import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../core/constants.js';
import { STATE } from '../core/game-state.js';

/** Vertical position for the follower row (from bottom of screen) */
const FOLLOWER_ROW_Y = DESIGN_HEIGHT - 140;

/** Horizontal spacing between followers */
const FOLLOWER_SPACING = 90;

/** Multiplier to scale definition sizes (14–18) up to visual sizes (35–45) */
const VISUAL_SIZE_MULT = 2.5;

/** Float animation amplitude in logical pixels */
const FLOAT_AMP = 3.5;

/** Float animation speed in rad/s */
const FLOAT_SPEED = 2.5;

/**
 * Render all followers to the canvas.
 *
 * @param {CanvasRenderingContext2D} ctx — 2D context (already scaled to design resolution)
 * @param {Object[]} followers — Array of follower entities from STATE.player.activeFollowers
 */
export function renderFollowers(ctx, followers) {
    if (!followers || followers.length === 0) return;

    const count = followers.length;
    const totalWidth = (count - 1) * FOLLOWER_SPACING;
    const startX = (DESIGN_WIDTH - totalWidth) / 2;
    const now = STATE.elapsedTime;

    for (let i = 0; i < count; i++) {
        const f = followers[i];
        const fx = startX + i * FOLLOWER_SPACING;

        // Float animation: sin-wave vertical offset, per-follower phase
        const floatY = Math.sin(now * FLOAT_SPEED + f.id * 0.7) * FLOAT_AMP;
        const fy = FOLLOWER_ROW_Y + floatY;

        // Update follower position for targeting purposes
        f.x = fx;
        f.y = fy;
        f.slotIndex = i;
        f.totalSlots = count;

        // Visual size (scaled up from definition size for richer art)
        const visualSize = f.size * VISUAL_SIZE_MULT;

        // Draw the follower
        _drawFollower(ctx, f, fx, fy, visualSize, now);

        // Draw label below
        _drawLabel(ctx, f, fx, fy, visualSize);
    }
}

// ---------------------------------------------------------------------------
// Internal: type dispatch
// ---------------------------------------------------------------------------

/**
 * Draw a follower's shape based on its typeId.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} follower
 * @param {number} x — Center X
 * @param {number} y — Center Y
 * @param {number} size — Visual size in logical pixels (35–45)
 * @param {number} now — STATE.elapsedTime (for animations)
 */
function _drawFollower(ctx, follower, x, y, size, now) {
    const color = follower.color;

    switch (follower.typeId) {
        case 'knight':
            _drawKnight(ctx, x, y, size, color);
            break;
        case 'archer':
            _drawArcher(ctx, x, y, size, color);
            break;
        case 'healer_fairy':
            _drawHealerFairy(ctx, x, y, size, color, now);
            break;
        case 'gold_magnet':
            _drawGoldMagnet(ctx, x, y, size, color, now);
            break;
        default:
            _drawDefault(ctx, x, y, size, color);
            break;
    }
}

// ---------------------------------------------------------------------------
// Knight — Shield + Sword warrior
// ---------------------------------------------------------------------------

function _drawKnight(ctx, x, y, size, color) {
    const bodyW = size * 0.56;
    const bodyH = size * 0.64;
    const headR = size * 0.18;
    const shieldW = size * 0.2;

    ctx.save();
    ctx.translate(x, y);

    // ---- Sword (behind body, right side) ----
    ctx.fillStyle = '#b0b0b0';
    ctx.fillRect(bodyW * 0.38, -size * 0.55, 2.5, size * 0.7);
    // Guard
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(bodyW * 0.3, -size * 0.12, 6, 2);
    // Handle
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(bodyW * 0.37, -size * 0.05, 3, 2.5);
    // Pommel
    ctx.beginPath();
    ctx.arc(bodyW * 0.385, size * 0.15, 2, 0, Math.PI * 2);
    ctx.fill();

    // ---- Body armor (rounded rectangle with radial gradient) ----
    const bodyGrad = ctx.createRadialGradient(
        -bodyW * 0.1, -bodyH * 0.15, bodyW * 0.08,
        0, 0, bodyW * 0.7
    );
    bodyGrad.addColorStop(0, '#f0ece4');
    bodyGrad.addColorStop(0.3, _blendHex(color, '#c0c0c0', 0.4));
    bodyGrad.addColorStop(0.7, color);
    bodyGrad.addColorStop(1, _darkenHex(color, 0.45));

    ctx.fillStyle = bodyGrad;
    _roundRectPath(ctx, -bodyW / 2, -bodyH / 2, bodyW, bodyH, 4);
    ctx.fill();

    ctx.strokeStyle = _darkenHex(color, 0.55);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Armor cross-detail line
    ctx.strokeStyle = _darkenHex(color, 0.35);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -bodyH * 0.35);
    ctx.lineTo(0, bodyH * 0.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.3, 0);
    ctx.lineTo(bodyW * 0.3, 0);
    ctx.stroke();

    // ---- Head ----
    ctx.fillStyle = '#f5d5b0';
    ctx.beginPath();
    ctx.arc(0, -bodyH / 2 - headR * 0.4, headR, 0, Math.PI * 2);
    ctx.fill();

    // Helmet dome
    ctx.fillStyle = '#9a9a9a';
    ctx.beginPath();
    ctx.arc(0, -bodyH / 2 - headR * 0.15, headR + 1.5, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#707070';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Helmet pointed top crest
    ctx.beginPath();
    ctx.moveTo(-headR * 0.7, -bodyH / 2 - headR * 0.1);
    ctx.lineTo(0, -bodyH / 2 - headR * 1.5);
    ctx.lineTo(headR * 0.7, -bodyH / 2 - headR * 0.1);
    ctx.closePath();
    ctx.fill();

    // ---- Shield (front-left) ----
    ctx.save();
    ctx.translate(-bodyW * 0.25, 0);
    const shH = size * 0.32;
    const shGrad = ctx.createLinearGradient(-shieldW / 2, -shH / 2, shieldW / 2, shH / 2);
    shGrad.addColorStop(0, _lightenHex(color, 0.3));
    shGrad.addColorStop(0.5, color);
    shGrad.addColorStop(1, _darkenHex(color, 0.25));

    ctx.fillStyle = shGrad;
    ctx.beginPath();
    // Shield shape: rounded hexagon
    const shTop = -shH * 0.6;
    const shBot = shH * 0.5;
    ctx.moveTo(0, shTop);
    ctx.lineTo(shieldW * 0.6, shTop + shH * 0.25);
    ctx.lineTo(shieldW * 0.7, shBot * 0.7);
    ctx.lineTo(0, shBot);
    ctx.lineTo(-shieldW * 0.7, shBot * 0.7);
    ctx.lineTo(-shieldW * 0.6, shTop + shH * 0.25);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = _darkenHex(color, 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Shield cross emblem
    ctx.strokeStyle = _lightenHex(color, 0.5);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, shTop + shH * 0.1);
    ctx.lineTo(0, shBot - shH * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-shieldW * 0.25, -shH * 0.05);
    ctx.lineTo(shieldW * 0.25, -shH * 0.05);
    ctx.stroke();

    ctx.restore(); // shield translate

    ctx.restore(); // main knight
}

// ---------------------------------------------------------------------------
// Archer — Small figure + bow
// ---------------------------------------------------------------------------

function _drawArcher(ctx, x, y, size, color) {
    const bodyW = size * 0.4;
    const bodyH = size * 0.55;
    const headR = size * 0.16;

    ctx.save();
    ctx.translate(x, y);

    // ---- Bow (left side, behind body) ----
    ctx.strokeStyle = _darkenHex(color, 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    const bowCX = -bodyW * 0.55;
    const bowCY = -bodyH * 0.1;
    const bowR = size * 0.35;
    ctx.arc(bowCX, bowCY, bowR, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();

    // Bowstring
    ctx.strokeStyle = '#ddd0b0';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    const bowTopX = bowCX + Math.cos(-Math.PI * 0.45) * bowR;
    const bowTopY = bowCY + Math.sin(-Math.PI * 0.45) * bowR;
    const bowBotX = bowCX + Math.cos(Math.PI * 0.45) * bowR;
    const bowBotY = bowCY + Math.sin(Math.PI * 0.45) * bowR;
    ctx.moveTo(bowTopX, bowTopY);
    ctx.lineTo(bowBotX, bowBotY);
    ctx.stroke();

    // Arrow nocked
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(bowCX, bowCY - 0.6, bodyW * 1.1, 1.2);
    // Arrowhead
    ctx.fillStyle = '#cccccc';
    ctx.beginPath();
    ctx.moveTo(bowCX + bodyW * 1.1, bowCY);
    ctx.lineTo(bowCX + bodyW * 1.1 + 3.5, bowCY - 2.5);
    ctx.lineTo(bowCX + bodyW * 1.1 + 3.5, bowCY + 2.5);
    ctx.closePath();
    ctx.fill();

    // Fletching
    ctx.fillStyle = '#cc4444';
    ctx.beginPath();
    ctx.moveTo(bowCX - 0.3, bowCY);
    ctx.lineTo(bowCX - bodyW * 0.3, bowCY - 3);
    ctx.lineTo(bowCX - bodyW * 0.3, bowCY + 3);
    ctx.closePath();
    ctx.fill();

    // ---- Body (tunic) ----
    const bodyGrad = ctx.createRadialGradient(
        0, -bodyH * 0.1, bodyW * 0.05,
        0, 0, bodyW * 0.65
    );
    bodyGrad.addColorStop(0, _lightenHex(color, 0.35));
    bodyGrad.addColorStop(0.5, color);
    bodyGrad.addColorStop(1, _darkenHex(color, 0.35));

    ctx.fillStyle = bodyGrad;
    _roundRectPath(ctx, -bodyW / 2, -bodyH / 2, bodyW, bodyH, 3);
    ctx.fill();

    ctx.strokeStyle = _darkenHex(color, 0.4);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Belt
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(-bodyW / 2, bodyH * 0.1, bodyW, 2.5);

    // ---- Quiver (right side, behind body) ----
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(bodyW * 0.35, -bodyH * 0.15, size * 0.1, bodyH * 0.7);
    ctx.strokeStyle = '#5a2d0c';
    ctx.lineWidth = 0.6;
    ctx.strokeRect(bodyW * 0.35, -bodyH * 0.15, size * 0.1, bodyH * 0.7);

    // Arrow shafts in quiver
    ctx.fillStyle = '#d4c4a0';
    for (let ai = 0; ai < 3; ai++) {
        ctx.fillRect(bodyW * 0.37 + ai * 1.5, -bodyH * 0.3, 0.8, bodyH * 0.45);
    }

    // ---- Head ----
    ctx.fillStyle = '#f5d5b0';
    ctx.beginPath();
    ctx.arc(0, -bodyH / 2 - headR * 0.2, headR, 0, Math.PI * 2);
    ctx.fill();

    // Green hood/cap
    ctx.fillStyle = _darkenHex(color, 0.2);
    ctx.beginPath();
    ctx.arc(0, -bodyH / 2 - headR * 0.1, headR + 1.5, Math.PI, 0);
    ctx.fill();
    // Hood point
    ctx.beginPath();
    ctx.moveTo(-headR * 0.5, -bodyH / 2 - headR * 0.8);
    ctx.lineTo(-headR * 0.2, -bodyH / 2 - headR * 1.6);
    ctx.lineTo(headR * 0.1, -bodyH / 2 - headR * 0.8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Healer Fairy — Wings + Halo + Sparkles
// ---------------------------------------------------------------------------

function _drawHealerFairy(ctx, x, y, size, color, now) {
    const bodyR = size * 0.28;
    const haloR = size * 0.55;
    const wingSpan = size * 0.65;

    ctx.save();
    ctx.translate(x, y);

    // ---- Halo (behind body, semi-transparent) ----
    const haloGrad = ctx.createRadialGradient(0, -bodyR * 0.3, haloR * 0.3, 0, -bodyR * 0.2, haloR);
    haloGrad.addColorStop(0, _withAlpha(color, 0.4));
    haloGrad.addColorStop(0.5, _withAlpha(_lightenHex(color, 0.5), 0.2));
    haloGrad.addColorStop(1, _withAlpha(color, 0.02));

    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(0, -bodyR * 0.2, haloR, 0, Math.PI * 2);
    ctx.fill();

    // Halo ring
    ctx.strokeStyle = _withAlpha(_lightenHex(color, 0.4), 0.45);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -bodyR * 0.2, haloR, 0, Math.PI * 2);
    ctx.stroke();

    // ---- Wings (two pairs, butterfly-like) ----
    // Upper wings
    for (let side = -1; side <= 1; side += 2) {
        const wingGrad = ctx.createLinearGradient(
            side * bodyR * 0.3, -bodyR * 0.5,
            side * wingSpan * 0.8, -bodyR * 1.1
        );
        wingGrad.addColorStop(0, _withAlpha(_lightenHex(color, 0.5), 0.8));
        wingGrad.addColorStop(0.6, _withAlpha(color, 0.5));
        wingGrad.addColorStop(1, _withAlpha(_lightenHex(color, 0.6), 0.15));

        ctx.fillStyle = wingGrad;
        ctx.beginPath();
        ctx.ellipse(
            side * wingSpan * 0.38, -bodyR * 0.8,
            wingSpan * 0.42, bodyR * 0.55,
            side * 0.5, 0, Math.PI * 2
        );
        ctx.fill();

        // Wing vein lines
        ctx.strokeStyle = _withAlpha(_lightenHex(color, 0.7), 0.35);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(side * bodyR * 0.25, -bodyR * 0.35);
        ctx.quadraticCurveTo(
            side * wingSpan * 0.35, -bodyR * 0.85,
            side * wingSpan * 0.7, -bodyR * 0.6
        );
        ctx.stroke();
    }

    // Lower wings (smaller)
    for (let side = -1; side <= 1; side += 2) {
        const wingGrad = ctx.createLinearGradient(
            side * bodyR * 0.2, bodyR * 0.1,
            side * wingSpan * 0.6, bodyR * 0.6
        );
        wingGrad.addColorStop(0, _withAlpha(_lightenHex(color, 0.5), 0.7));
        wingGrad.addColorStop(1, _withAlpha(color, 0.12));

        ctx.fillStyle = wingGrad;
        ctx.beginPath();
        ctx.ellipse(
            side * wingSpan * 0.3, bodyR * 0.3,
            wingSpan * 0.3, bodyR * 0.4,
            side * -0.4, 0, Math.PI * 2
        );
        ctx.fill();
    }

    // ---- Body (small glowing teardrop) ----
    const bodyGrad = ctx.createRadialGradient(
        -bodyR * 0.15, -bodyR * 0.2, bodyR * 0.05,
        0, 0, bodyR
    );
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.3, _lightenHex(color, 0.5));
    bodyGrad.addColorStop(0.7, color);
    bodyGrad.addColorStop(1, _darkenHex(color, 0.2));

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, bodyR, 0, Math.PI * 2);
    ctx.fill();

    // Body rim
    ctx.strokeStyle = _withAlpha('#ffffff', 0.5);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // ---- Tiny eyes ----
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-bodyR * 0.3, -bodyR * 0.1, bodyR * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bodyR * 0.3, -bodyR * 0.1, bodyR * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#442244';
    ctx.beginPath();
    ctx.arc(-bodyR * 0.3, -bodyR * 0.08, bodyR * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bodyR * 0.3, -bodyR * 0.08, bodyR * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // ---- Orbiting sparkle particles ----
    const sparkleCount = 5;
    for (let i = 0; i < sparkleCount; i++) {
        const angle = (Math.PI * 2 / sparkleCount) * i + now * 1.8;
        const dist = haloR * 0.85;
        const sx = Math.cos(angle) * dist;
        const sy = Math.sin(angle) * dist - bodyR * 0.2;
        const sparkleSize = 1.5 + Math.sin(now * 4 + i) * 0.6;

        const sGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sparkleSize);
        sGrad.addColorStop(0, _withAlpha('#ffffff', 0.9));
        sGrad.addColorStop(0.5, _withAlpha(_lightenHex(color, 0.6), 0.6));
        sGrad.addColorStop(1, _withAlpha(color, 0));

        ctx.fillStyle = sGrad;
        ctx.beginPath();
        ctx.arc(sx, sy, sparkleSize, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Gold Magnet — U-shaped magnet + orbiting coin particles
// ---------------------------------------------------------------------------

function _drawGoldMagnet(ctx, x, y, size, color, now) {
    const magnetW = size * 0.55;
    const magnetH = size * 0.7;
    const prongW = magnetW * 0.22;
    const gapW = magnetW * 0.35;

    ctx.save();
    ctx.translate(x, y);

    // ---- Magnet body (U-shape) ----
    // Bottom connecting bar
    const bodyGrad = ctx.createLinearGradient(0, -magnetH * 0.15, 0, magnetH * 0.4);
    bodyGrad.addColorStop(0, _lightenHex(color, 0.3));
    bodyGrad.addColorStop(0.4, color);
    bodyGrad.addColorStop(0.8, _darkenHex(color, 0.15));
    bodyGrad.addColorStop(1, _darkenHex(color, 0.35));

    ctx.fillStyle = bodyGrad;

    // Left prong
    _roundRectPath(ctx, -magnetW / 2, -magnetH * 0.1, prongW, magnetH, 3);
    ctx.fill();
    // Right prong
    _roundRectPath(ctx, magnetW / 2 - prongW, -magnetH * 0.1, prongW, magnetH, 3);
    ctx.fill();
    // Bottom bar connecting prongs
    _roundRectPath(ctx, -magnetW / 2, magnetH * 0.5, magnetW, magnetH * 0.25, 3);
    ctx.fill();

    // Magnet highlight stripe
    ctx.fillStyle = _withAlpha('#ffffff', 0.25);
    ctx.fillRect(-magnetW / 2 + 2, magnetH * 0.6, magnetW - 4, 2);

    // ---- Pole tips (N = red on left, S = blue on right) ----
    // Left pole (North - red)
    ctx.fillStyle = '#e04040';
    _roundRectPath(ctx, -magnetW / 2 + 2, -magnetH * 0.1 + 1, prongW - 4, magnetH * 0.18, 2);
    ctx.fill();
    // Right pole (South - blue)
    ctx.fillStyle = '#4060e0';
    _roundRectPath(ctx, magnetW / 2 - prongW + 2, -magnetH * 0.1 + 1, prongW - 4, magnetH * 0.18, 2);
    ctx.fill();

    // Magnet outline
    ctx.strokeStyle = _darkenHex(color, 0.4);
    ctx.lineWidth = 1.2;
    // Outline: left prong + bottom + right prong
    ctx.beginPath();
    ctx.moveTo(-magnetW / 2, magnetH * 0.65);
    ctx.lineTo(-magnetW / 2, -magnetH * 0.1);
    ctx.quadraticCurveTo(-magnetW / 2, -magnetH * 0.15, -magnetW / 2 + 3, -magnetH * 0.15);
    ctx.lineTo(-magnetW / 2 + prongW, -magnetH * 0.15);
    ctx.quadraticCurveTo(-magnetW / 2 + prongW + 3, -magnetH * 0.15, -magnetW / 2 + prongW + 3, -magnetH * 0.1);
    ctx.lineTo(-magnetW / 2 + prongW + 3, magnetH * 0.65);
    ctx.quadraticCurveTo(-magnetW / 2 + prongW + 3, magnetH * 0.75, -magnetW / 2 + prongW, magnetH * 0.75);
    ctx.lineTo(magnetW / 2 - prongW, magnetH * 0.75);
    ctx.quadraticCurveTo(magnetW / 2 - prongW - 3, magnetH * 0.75, magnetW / 2 - prongW - 3, magnetH * 0.65);
    ctx.lineTo(magnetW / 2 - prongW - 3, -magnetH * 0.1);
    ctx.quadraticCurveTo(magnetW / 2 - prongW - 3, -magnetH * 0.15, magnetW / 2 - prongW, -magnetH * 0.15);
    ctx.lineTo(magnetW / 2, -magnetH * 0.15);
    ctx.quadraticCurveTo(magnetW / 2 + 3, -magnetH * 0.15, magnetW / 2 + 3, -magnetH * 0.1);
    ctx.lineTo(magnetW / 2 + 3, magnetH * 0.65);
    ctx.stroke();

    // ---- Orbiting coin particles ----
    const coinCount = 3;
    for (let i = 0; i < coinCount; i++) {
        const angle = (Math.PI * 2 / coinCount) * i + now * 2.2;
        const orbitR = size * 0.55;
        const coinX = Math.cos(angle) * orbitR;
        const coinY = Math.sin(angle) * orbitR * 0.7;
        const coinR = 3.5 + Math.sin(now * 3 + i) * 0.8;

        // Coin glow
        const glowGrad = ctx.createRadialGradient(coinX, coinY, coinR * 0.2, coinX, coinY, coinR * 1.6);
        glowGrad.addColorStop(0, _withAlpha('#ffffaa', 0.8));
        glowGrad.addColorStop(0.5, _withAlpha(color, 0.5));
        glowGrad.addColorStop(1, _withAlpha(color, 0));

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(coinX, coinY, coinR * 1.6, 0, Math.PI * 2);
        ctx.fill();

        // Coin body
        const coinGrad = ctx.createRadialGradient(coinX - coinR * 0.3, coinY - coinR * 0.3, 0, coinX, coinY, coinR);
        coinGrad.addColorStop(0, '#fffde0');
        coinGrad.addColorStop(0.5, color);
        coinGrad.addColorStop(1, _darkenHex(color, 0.3));

        ctx.fillStyle = coinGrad;
        ctx.beginPath();
        ctx.arc(coinX, coinY, coinR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = _darkenHex(color, 0.4);
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // Dollar sign on coin
        ctx.fillStyle = _darkenHex(color, 0.5);
        ctx.font = `${Math.max(4, coinR * 1.2)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', coinX, coinY + 0.3);
    }

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Default fallback
// ---------------------------------------------------------------------------

function _drawDefault(ctx, x, y, size, color) {
    const grad = ctx.createRadialGradient(
        x - size * 0.15, y - size * 0.2, size * 0.05,
        x, y, size * 0.55
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, _lightenHex(color, 0.3));
    grad.addColorStop(1, _darkenHex(color, 0.4));

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = _lightenHex(color, 0.5);
    ctx.lineWidth = 1.2;
    ctx.stroke();
}

// ---------------------------------------------------------------------------
// Label
// ---------------------------------------------------------------------------

/**
 * Draw a label below the follower.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} follower
 * @param {number} x
 * @param {number} y
 * @param {number} visualSize
 */
function _drawLabel(ctx, follower, x, y, visualSize) {
    const labelY = y + visualSize * 0.65;

    ctx.save();
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const label = follower.typeId.replace('_', ' ');
    ctx.fillText(label, x, labelY);
    ctx.restore();
}

// ---------------------------------------------------------------------------
// Color utility helpers
// ---------------------------------------------------------------------------

/**
 * Lighten a hex color by a factor (0..1).
 * 0 = no change, 1 = pure white.
 */
function _lightenHex(hex, factor) {
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
 * 0 = no change, 1 = pure black.
 */
function _darkenHex(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const dr = Math.max(0, Math.round(r * (1 - factor)));
    const dg = Math.max(0, Math.round(g * (1 - factor)));
    const db = Math.max(0, Math.round(b * (1 - factor)));
    return `rgb(${dr},${dg},${db})`;
}

/**
 * Mix a hex color with grey by a blend factor.
 */
function _blendHex(hex, greyHex, factor) {
    const r1 = parseInt(hex.slice(1, 3), 16);
    const g1 = parseInt(hex.slice(3, 5), 16);
    const b1 = parseInt(hex.slice(5, 7), 16);
    const r2 = parseInt(greyHex.slice(1, 3), 16);
    const g2 = parseInt(greyHex.slice(3, 5), 16);
    const b2 = parseInt(greyHex.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);
    return `rgb(${r},${g},${b})`;
}

/**
 * Set alpha on an rgb() string.
 */
function _withAlpha(rgb, alpha) {
    return rgb.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
}

/**
 * Draw a rounded-rectangle path.
 */
function _roundRectPath(ctx, x, y, w, h, r) {
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
