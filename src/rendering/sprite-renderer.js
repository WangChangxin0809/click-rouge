/**
 * sprite-renderer.js — Sprite-based enemy rendering for Click Rouge.
 *
 * Replaces the procedural enemy-renderer with sprite-sheet-based rendering.
 * Regular enemies are drawn using pre-loaded PNG sprite images with frame
 * animation. Boss entities are still delegated to boss-renderer.js for their
 * complex visual effects (halo, trail, entrance animation).
 *
 * Preserved effects from the original enemy-renderer:
 *   - Hit flash (white tint via globalCompositeOperation "source-atop")
 *   - Float animation (sin-wave vertical offset)
 *   - Health bar below the sprite
 *   - Eyes rendering (for sprites without built-in eyes)
 *
 * Drop-in replacement: the exported renderEnemies() has the same signature
 * as the original enemy-renderer.js function.
 *
 * Usage (from canvas-renderer.js):
 *   import { renderEnemies } from './sprite-renderer.js';
 *   renderEnemies(ctx, state.enemies);
 */

import { STATE } from '../core/game-state.js';
import { getSprite, hasSprite } from './sprite-loader.js';
import { createAnimator } from './sprite-animator.js';
import { renderBosses } from './boss-renderer.js';

// ---------------------------------------------------------------------------
// Sprite manifest — frame layout config (mirrors assets/sprites/manifest.json)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SpriteDef
 * @property {string} key    — Cache key in sprite-loader
 * @property {number} frameW — Frame width in pixels
 * @property {number} frameH — Frame height in pixels
 * @property {number} frames — Total frame count
 * @property {number} fps    — Frames per second
 * @property {'horizontal'|'grid'} [layout]
 * @property {number} [gridCols]
 */

/** @type {Object<string, SpriteDef>} */
const SPRITE_DEFS = {
    slime:      { key: 'slime',      frameW: 74,  frameH: 86,  frames: 4, fps: 4, layout: 'horizontal' },
    bat:        { key: 'bat',        frameW: 95,  frameH: 138, frames: 4, fps: 6, layout: 'horizontal' },
    ghost:      { key: 'ghost',      frameW: 75,  frameH: 138, frames: 2, fps: 3, layout: 'horizontal' },
    golem:      { key: 'golem',      frameW: 32,  frameH: 32,  frames: 1, fps: 1 },
    fire_skull: { key: 'fire_skull', frameW: 128, frameH: 128, frames: 4, fps: 6, layout: 'grid', gridCols: 2 },
};

// ---------------------------------------------------------------------------
// Animation constants
// ---------------------------------------------------------------------------

const HIT_FLASH_DURATION = 0.1;
const FLOAT_AMPLITUDE = 3;
const FLOAT_SPEED = 3.0;

/** Default radius when an enemy's size is missing */
const DEFAULT_RADIUS = 20;

// ---------------------------------------------------------------------------
// Per-sprite-type animator cache
// ---------------------------------------------------------------------------

/** @type {Object<string, ReturnType<typeof createAnimator>>} */
const _animators = {};

/**
 * Get (or create) the animator for a given sprite definition key.
 * @param {string} spriteKey
 * @returns {ReturnType<typeof createAnimator>}
 */
function _getAnimator(spriteKey) {
    if (!_animators[spriteKey]) {
        const def = SPRITE_DEFS[spriteKey];
        if (!def) return null;
        _animators[spriteKey] = createAnimator({
            frameW: def.frameW,
            frameH: def.frameH,
            frames: def.frames,
            fps: def.fps,
            layout: def.layout || 'horizontal',
            gridCols: def.gridCols,
        });
    }
    return _animators[spriteKey];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render all active enemies using sprite-sheet images.
 *
 * Regular enemies are drawn with sprites. Boss entities are delegated to
 * boss-renderer.js for complex visual effects.
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

    // ---- Regular enemies (sprite-based) ----
    for (let i = 0, len = regulars.length; i < len; i++) {
        _renderSpriteEnemy(ctx, regulars[i], now);
    }

    // ---- Bosses (delegated to boss-renderer) ----
    if (bosses.length > 0) {
        renderBosses(ctx, bosses, now);
    }
}

// ---------------------------------------------------------------------------
// Per-enemy sprite rendering
// ---------------------------------------------------------------------------

/**
 * Render a single regular enemy using its sprite-sheet.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} e — Enemy state object
 * @param {number} now — STATE.elapsedTime
 */
function _renderSpriteEnemy(ctx, e, now) {
    const spriteKey = e.typeId;
    const spriteDef = SPRITE_DEFS[spriteKey];

    // Fall back to procedural drawing if no sprite definition exists
    if (!spriteDef || !hasSprite(spriteDef.key)) {
        _renderFallbackProcedural(ctx, e, now);
        return;
    }

    const img = getSprite(spriteDef.key);
    if (!img) {
        _renderFallbackProcedural(ctx, e, now);
        return;
    }

    const r = e.size != null ? e.size : DEFAULT_RADIUS;

    // Hit-flash detection
    const lastHit = e.lastHitTime;
    const isFlashing = (lastHit != null) && ((now - lastHit) < HIT_FLASH_DURATION);

    // Float animation
    const phase = (e.id * 0.7) % (Math.PI * 2);
    const floatY = Math.sin(now * FLOAT_SPEED + phase) * FLOAT_AMPLITUDE;

    // Compute draw dimensions: scale sprite so its height = 2 * radius
    const targetH = r * 2;
    const spriteScale = targetH / spriteDef.frameH;
    const drawW = spriteDef.frameW * spriteScale;
    const drawH = targetH;

    // Compute draw position (centered on enemy x/y)
    const dx = e.x - drawW / 2;
    const dy = e.y + floatY - drawH / 2;

    // Get current animation frame
    const animator = _getAnimator(spriteKey);
    let frame;
    if (animator) {
        // Offset time per-entity for de-synchronised animation
        const animTime = now + e.id * 0.7;
        frame = animator.getCurrentFrame(animTime);
    } else {
        frame = { sx: 0, sy: 0, sw: spriteDef.frameW, sh: spriteDef.frameH };
    }

    ctx.save();

    // Draw the sprite
    if (isFlashing) {
        // Hit flash: draw sprite normally, then overlay white tint
        ctx.drawImage(
            img,
            frame.sx, frame.sy, frame.sw, frame.sh,
            dx, dy, drawW, drawH,
        );

        // White tint overlay using source-atop
        const flashProgress = (now - lastHit) / HIT_FLASH_DURATION;
        const flashAlpha = 0.7 * (1 - flashProgress);
        if (flashAlpha > 0) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
            ctx.fillRect(dx, dy, drawW, drawH);
            ctx.globalCompositeOperation = 'source-over';
        }
    } else {
        // Normal draw
        ctx.drawImage(
            img,
            frame.sx, frame.sy, frame.sw, frame.sh,
            dx, dy, drawW, drawH,
        );
    }

    ctx.restore();

    // ---- Health bar (below sprite) ----
    _drawSpriteHealthBar(ctx, e, r, drawW, dy + drawH);
}

// ---------------------------------------------------------------------------
// Fallback procedural rendering (for enemies without sprites)
// ---------------------------------------------------------------------------

/**
 * Render an enemy using the original procedural style when no sprite is available.
 * This preserves the rich visual style for any enemy type not yet covered by sprites.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} e — Enemy state object
 * @param {number} now — STATE.elapsedTime
 */
function _renderFallbackProcedural(ctx, e, now) {
    const r = e.size != null ? e.size : DEFAULT_RADIUS;
    const col = e.color || '#ff4444';

    const lastHit = e.lastHitTime;
    const isFlashing = (lastHit != null) && ((now - lastHit) < HIT_FLASH_DURATION);

    // Float animation
    const phase = (e.id * 0.7) % (Math.PI * 2);
    const floatY = Math.sin(now * FLOAT_SPEED + phase) * FLOAT_AMPLITUDE;

    ctx.save();
    ctx.translate(e.x, e.y + floatY);

    // Simple radial gradient body
    if (isFlashing) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
    } else {
        const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
        grad.addColorStop(0, lightenColor(col, 0.35));
        grad.addColorStop(0.5, col);
        grad.addColorStop(1, darkenColor(col, 0.3));

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // Eyes
    const eyeR = r * 0.13;
    if (eyeR > 0) {
        ctx.fillStyle = isFlashing ? '#dddddd' : '#ffffff';
        ctx.beginPath();
        ctx.arc(-r * 0.35, -r * 0.15, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(r * 0.35, -r * 0.15, eyeR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isFlashing ? '#444444' : '#111111';
        ctx.beginPath();
        ctx.arc(-r * 0.35, -r * 0.15, eyeR * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(r * 0.35, -r * 0.15, eyeR * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();

    // Health bar
    const drawW = r * 2;
    _drawSpriteHealthBar(ctx, e, r, drawW, e.y + floatY + r + 6);
}

// ---------------------------------------------------------------------------
// Health bar
// ---------------------------------------------------------------------------

/**
 * Draw a floating health bar below an enemy sprite.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} e — Enemy state object
 * @param {number} r — Enemy radius
 * @param {number} barW — Bar width in logical pixels
 * @param {number} barTop — Top Y of the bar in logical pixels
 */
function _drawSpriteHealthBar(ctx, e, r, barW, barTop) {
    const hpRatio = e.maxHp > 0
        ? Math.max(0, Math.min(1, e.hp / e.maxHp))
        : 0;

    // If barTop is not explicitly passed (old signature), compute from r
    if (barTop === undefined) {
        barTop = e.y + r + 6;
        barW = r * 2;
    }

    const barH = 3.5;
    const barX = e.x - barW / 2;
    const barY = barTop;

    ctx.save();

    // Background
    ctx.fillStyle = 'rgba(30, 5, 5, 0.7)';
    ctx.fillRect(barX, barY, barW, barH);

    // Border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barW, barH);

    // Foreground
    if (hpRatio > 0) {
        if (hpRatio > 0.5) {
            ctx.fillStyle = '#44cc44';
        } else if (hpRatio > 0.25) {
            ctx.fillStyle = '#cccc44';
        } else {
            ctx.fillStyle = '#cc4444';
        }
        ctx.fillRect(barX, barY, barW * hpRatio, barH);

        // Shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(barX, barY, barW * hpRatio, 1);
    }

    ctx.restore();
}
