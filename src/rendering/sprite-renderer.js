/**
 * sprite-renderer.js — Sprite-based enemy rendering for Click Rouge.
 *
 * Replaces the procedural enemy-renderer with sprite-sheet-based rendering.
 * Regular enemies are drawn using pre-loaded PNG sprite images with frame
 * animation. Boss entities also use sprite rendering for their body but
 * delegate visual effects (halo, trail, entrance animation) to boss-renderer.js.
 *
 * Preserved effects from the original enemy-renderer:
 *   - Hit flash (white tint via globalCompositeOperation "source-atop")
 *   - Float animation (sin-wave vertical offset)
 *   - Health bar below the sprite
 *   - Boss entrance flash overlay
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
import { lightenColor, darkenColor, easeOutBack } from './enemy-renderer.js';
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
    slime:         { key: 'slime',         frameW: 74,  frameH: 86,  frames: 4, fps: 4, layout: 'horizontal' },
    bat:           { key: 'bat',           frameW: 95,  frameH: 138, frames: 4, fps: 6, layout: 'horizontal' },
    ghost:         { key: 'ghost',         frameW: 75,  frameH: 138, frames: 2, fps: 3, layout: 'horizontal' },
    golem:         { key: 'golem',         frameW: 32,  frameH: 32,  frames: 1, fps: 1 },
    fire_skull:    { key: 'fire_skull',    frameW: 128, frameH: 128, frames: 1, fps: 1 },
    // Boss sprites
    giant_slime:   { key: 'giant_slime',   frameW: 74,  frameH: 86,  frames: 4, fps: 4, layout: 'horizontal', scale: 2.5 },
    skeleton_king: { key: 'skeleton_king', frameW: 138, frameH: 138, frames: 4, fps: 4, layout: 'horizontal' },
    fire_dragon:   { key: 'fire_dragon',   frameW: 428, frameH: 377, frames: 1, fps: 1 },
};

// ---------------------------------------------------------------------------
// Animation constants
// ---------------------------------------------------------------------------

const HIT_FLASH_DURATION = 0.15;
const PUNCH_DURATION = 0.08;
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

    // ---- Bosses (body via sprite-renderer, effects via boss-renderer) ----
    if (bosses.length > 0) {
        // boss-renderer computes entrance animation state and draws halo/trail,
        // then stores _renderX/_renderY/_renderScale/_renderAlpha/_entranceFlash
        // on each boss object for _renderSpriteEnemy to use.
        renderBosses(ctx, bosses, now);

        // Draw boss bodies with sprites (using entrance-adjusted positions)
        for (let i = 0, len = bosses.length; i < len; i++) {
            _renderSpriteEnemy(ctx, bosses[i], now);
        }
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

    // Scale-punch detection
    const isPunching = (lastHit != null) && ((now - lastHit) < PUNCH_DURATION);

    // Float animation
    const phase = (e.id * 0.7) % (Math.PI * 2);
    const floatY = Math.sin(now * FLOAT_SPEED + phase) * FLOAT_AMPLITUDE;

    // Boss entrance animation: adjusted position / scale / alpha (set by boss-renderer)
    const renderX = (e._renderX != null) ? e._renderX : e.x;
    const renderY = (e._renderY != null) ? e._renderY : e.y;
    const entranceScale = (e._renderScale != null) ? e._renderScale : 1;
    const entranceAlpha = (e._renderAlpha != null) ? e._renderAlpha : 1;
    const entranceFlash = e._entranceFlash || 0;

    // Compute draw dimensions: scale sprite so its height = 2 * radius
    // Apply manifest scale (e.g. giant_slime = 2.5x) and entrance animation scale
    const manifestScale = spriteDef.scale || 1;
    const targetH = r * 2 * manifestScale;
    const spriteScale = targetH / spriteDef.frameH;
    const drawW = spriteDef.frameW * spriteScale * entranceScale;
    const drawH = targetH * entranceScale;

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

    // Translate to enemy center (enables centered scale-punch and glow)
    // Boss entrance animation uses adjusted renderX/renderY
    ctx.translate(renderX, renderY + floatY);

    // Boss entrance alpha (1.0 for regular enemies)
    if (entranceAlpha < 1) {
        ctx.globalAlpha = entranceAlpha;
    }

    // Scale punch: quick shrink-then-bounce on hit
    if (isPunching) {
        const punchT = (now - lastHit) / PUNCH_DURATION;
        const punchS = 0.85 + easeOutBack(punchT) * 0.15;
        ctx.scale(punchS, punchS);
    }

    // Red outer glow on hit (fades out during flash)
    if (isFlashing) {
        const flashProgress = (now - lastHit) / HIT_FLASH_DURATION;
        ctx.shadowColor = 'rgba(255, 30, 30, 0.5)';
        ctx.shadowBlur = 6 * (1 - flashProgress);
    }

    // Entrance white flash overlay (boss entrance animation, first 0.3s)
    if (entranceFlash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${entranceFlash * 0.7})`;
        ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
    }

    // Draw the sprite centered at origin
    if (isFlashing) {
        // Draw sprite normally
        ctx.drawImage(
            img,
            frame.sx, frame.sy, frame.sw, frame.sh,
            -drawW / 2, -drawH / 2, drawW, drawH,
        );

        // White tint overlay using source-atop
        const flashProgress = (now - lastHit) / HIT_FLASH_DURATION;
        const flashAlpha = 0.7 * (1 - flashProgress);
        if (flashAlpha > 0) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
            ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
            ctx.globalCompositeOperation = 'source-over';
        }
    } else {
        // Normal draw
        ctx.drawImage(
            img,
            frame.sx, frame.sy, frame.sw, frame.sh,
            -drawW / 2, -drawH / 2, drawW, drawH,
        );
    }

    // Reset glow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.restore();

    // ---- Health bar (below sprite) ----
    _drawSpriteHealthBar(ctx, e, r, drawW, renderY + floatY + drawH / 2);
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
    const drawW = r * 2.2;
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
    // If barTop is not explicitly passed (old signature), compute from r
    if (barTop === undefined) {
        barTop = e.y + r + 6;
        barW = r * 2.2;
    }

    // Delayed HP display: smoothly lerp visual HP toward actual HP
    if (e._displayHp === undefined || e._displayHp > e.maxHp) {
        e._displayHp = e.hp;
    }
    e._displayHp += (e.hp - e._displayHp) * 0.12;
    if (Math.abs(e.hp - e._displayHp) < 0.05) {
        e._displayHp = e.hp;
    }

    const hpRatio = e.maxHp > 0
        ? Math.max(0, Math.min(1, e._displayHp / e.maxHp))
        : 0;

    const barH = 6;
    const borderW = 1;
    const barX = e.x - barW / 2;
    const barY = barTop;

    ctx.save();

    // Background
    ctx.fillStyle = 'rgba(15, 5, 5, 0.75)';
    ctx.fillRect(barX, barY, barW, barH);

    // Dark border
    ctx.strokeStyle = 'rgba(10, 0, 0, 0.9)';
    ctx.lineWidth = borderW;
    ctx.strokeRect(barX, barY, barW, barH);

    // Foreground with 4-segment colour: green > 60%, yellow 30-60%, orange 15-30%, red < 15%
    if (hpRatio > 0) {
        let fillColor;
        if (hpRatio > 0.6) {
            fillColor = '#44cc44';
        } else if (hpRatio > 0.3) {
            fillColor = '#cccc44';
        } else if (hpRatio > 0.15) {
            fillColor = '#ff8844';
        } else {
            fillColor = '#ff2222';
        }
        ctx.fillStyle = fillColor;
        ctx.fillRect(barX + borderW, barY + borderW,
            (barW - borderW * 2) * hpRatio, barH - borderW * 2);

        // Shine on top edge
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(barX + borderW, barY + borderW,
            (barW - borderW * 2) * hpRatio, 1);
    }

    ctx.restore();
}
