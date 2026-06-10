/**
 * Follower Renderer — Draws follower entities at the bottom of the screen.
 *
 * Followers are rendered as simple geometric shapes (triangles/diamonds)
 * with distinct colors per type. They are arranged in a horizontal row
 * at the bottom of the screen, evenly spaced.
 *
 * This module is called from CanvasRenderer.render() after particles are drawn.
 * The rendering context must already have the design-resolution scale transform applied.
 *
 * Usage:
 *   import { renderFollowers } from './rendering/follower-renderer.js';
 *   renderFollowers(ctx, STATE.player.activeFollowers);
 */

import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../core/constants.js';

/** Vertical position for the follower row (from bottom of screen) */
const FOLLOWER_ROW_Y = DESIGN_HEIGHT - 60;

/** Horizontal spacing between followers */
const FOLLOWER_SPACING = 80;

/** Visual size multiplier for follower shapes */
const SHAPE_SCALE = 1.0;

/**
 * Render all followers to the canvas.
 *
 * @param {CanvasRenderingContext2D} ctx - 2D context (already scaled to design resolution)
 * @param {Object[]} followers - Array of follower entities from STATE.player.activeFollowers
 */
export function renderFollowers(ctx, followers) {
    if (!followers || followers.length === 0) return;

    const count = followers.length;
    // Center the row horizontally
    const totalWidth = (count - 1) * FOLLOWER_SPACING;
    const startX = (DESIGN_WIDTH - totalWidth) / 2;

    for (let i = 0; i < count; i++) {
        const f = followers[i];
        const fx = startX + i * FOLLOWER_SPACING;
        const fy = FOLLOWER_ROW_Y;

        // Update follower position for targeting purposes
        f.x = fx;
        f.y = fy;
        f.slotIndex = i;
        f.totalSlots = count;

        // Draw the follower shape
        _drawFollower(ctx, f, fx, fy);

        // Draw label below the shape
        _drawLabel(ctx, f, fx, fy);
    }
}

// ---------------------------------------------------------------------------
// Internal: drawing helpers
// ---------------------------------------------------------------------------

/**
 * Draw a follower's geometric shape based on its type.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} follower
 * @param {number} x - Center X
 * @param {number} y - Center Y
 */
function _drawFollower(ctx, follower, x, y) {
    const size = follower.size * SHAPE_SCALE;
    const color = follower.color;

    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    switch (follower.typeId) {
        case 'knight':
            // Shield shape: a hexagon-like shape
            _drawHexagon(ctx, x, y, size);
            break;

        case 'archer':
            // Arrowhead: upward-pointing triangle
            _drawTriangle(ctx, x, y, size, 'up');
            break;

        case 'healer_fairy':
            // Diamond / star-like cross
            _drawDiamond(ctx, x, y, size);
            break;

        case 'gold_magnet':
            // Magnet shape: a wide rectangle with rounded top
            _drawMagnet(ctx, x, y, size);
            break;

        default:
            // Generic circle fallback
            ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
            break;
    }

    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

/**
 * Draw a label below the follower.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} follower
 * @param {number} x
 * @param {number} y
 */
function _drawLabel(ctx, follower, x, y) {
    const labelY = y + follower.size * 1.5;

    ctx.save();
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Use typeId as the label (can be replaced with localized names later)
    const label = follower.typeId.replace('_', ' ');
    ctx.fillText(label, x, labelY);
    ctx.restore();
}

// ---------------------------------------------------------------------------
// Internal: primitive shape drawing
// ---------------------------------------------------------------------------

/**
 * Draw an upward-pointing triangle.
 */
function _drawTriangle(ctx, x, y, size, _direction) {
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.7, y + size * 0.5);
    ctx.lineTo(x - size * 0.7, y + size * 0.5);
    ctx.closePath();
}

/**
 * Draw a diamond shape.
 */
function _drawDiamond(ctx, x, y, size) {
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.6, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size * 0.6, y);
    ctx.closePath();
}

/**
 * Draw a hexagon (shield-like) shape.
 */
function _drawHexagon(ctx, x, y, size) {
    const s = size * 0.8;
    const h = s * 0.5;
    ctx.moveTo(x, y - s);            // top
    ctx.lineTo(x + h, y - h);        // top-right
    ctx.lineTo(x + h, y + h);        // bottom-right
    ctx.lineTo(x, y + s);            // bottom
    ctx.lineTo(x - h, y + h);        // bottom-left
    ctx.lineTo(x - h, y - h);        // top-left
    ctx.closePath();
}

/**
 * Draw a magnet shape (wide rectangle, rounded top).
 */
function _drawMagnet(ctx, x, y, size) {
    const w = size * 0.7;
    const h = size * 0.8;
    // Horseshoe shape: two prongs facing up
    const prongW = w * 0.3;
    ctx.moveTo(x - w, y - h * 0.4);
    ctx.lineTo(x - w, y + h);
    ctx.lineTo(x - prongW, y + h);
    ctx.lineTo(x - prongW, y - h * 0.6);
    ctx.lineTo(x + prongW, y - h * 0.6);
    ctx.lineTo(x + prongW, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y - h * 0.4);
    ctx.closePath();
}
