/**
 * damage-numbers.js — Floating damage number system for Click Rouge.
 *
 * Renders damage numbers, gold popups, and miss text as DOM elements
 * with CSS animations. All numbers are injected into a dedicated
 * #damage-layer container that sits above the canvas but below the HUD.
 *
 * Coordinates are converted from design resolution (1920x1080) to
 * viewport coordinates using the canvas display rect for accuracy.
 *
 * Usage:
 *   import { showDamageNumber, showGoldNumber, showMissText }
 *     from './ui/damage-numbers.js';
 *   showDamageNumber(960, 540, 42, true);
 *   showGoldNumber(500, 300, 15);
 *   showMissText(800, 400);
 */

import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../core/constants.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Number of active damage number elements. Tracked so we can throttle
 * if too many accumulate (e.g. extremely rapid clicking).
 */
let activeCount = 0;

/** Maximum concurrent floating numbers — prevents DOM spam. */
const MAX_ACTIVE = 60;

/**
 * Convert design-resolution coordinates to viewport-relative pixel
 * coordinates. Uses the game-canvas's current display rectangle as
 * the reference frame.
 *
 * @param {number} designX — X in design resolution (0..1920)
 * @param {number} designY — Y in design resolution (0..1080)
 * @returns {{ x: number, y: number }} Viewport coordinates
 */
function designToViewport(designX, designY) {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        // Fallback: assume viewport == design resolution
        return { x: designX, y: designY };
    }

    const rect = canvas.getBoundingClientRect();
    const viewportX = rect.left + (designX / DESIGN_WIDTH) * rect.width;
    const viewportY = rect.top + (designY / DESIGN_HEIGHT) * rect.height;

    return { x: viewportX, y: viewportY };
}

/**
 * Ensure the #damage-layer container exists inside the DOM.
 * Creates it lazily on first use so that damage-numbers.js can be
 * imported before the DOM is fully ready.
 *
 * @returns {HTMLElement}
 */
function ensureDamageLayer() {
    let layer = document.getElementById('damage-layer');
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'damage-layer';
        // Append to body so it sits between canvas (z=0) and hud-overlay (z=10).
        // The CSS stylesheet defines its position/fixed + z-index + pointer-events.
        document.body.appendChild(layer);
    }
    return layer;
}

/**
 * Create a styled floating-number element, append it to the damage layer,
 * and schedule its removal when the CSS animation ends.
 *
 * @param {number} viewportX — Viewport X position
 * @param {number} viewportY — Viewport Y position
 * @param {string} text — Text content to display
 * @param {string} cssClass — CSS class name(s) for styling
 */
function createFloatingElement(viewportX, viewportY, text, cssClass) {
    // Throttle if we already have too many active elements
    if (activeCount >= MAX_ACTIVE) return;

    const el = document.createElement('div');
    el.className = 'dmg-float ' + cssClass;
    el.textContent = text;

    // Position from centre — the CSS animation moves it upward via translateY.
    // We use transform: translate(-50%, -50%) on the base element so that
    // the provided (x, y) marks the element's centre point.
    el.style.left = viewportX + 'px';
    el.style.top = viewportY + 'px';

    const layer = ensureDamageLayer();
    layer.appendChild(el);

    activeCount++;

    // Force a reflow so the browser registers the element before we apply
    // the active class that triggers the animation (prevents first-frame snap).
    el.offsetHeight;
    el.classList.add('active');

    // Remove after the animation has finished (0.8s + small buffer).
    const durationMs = 850;
    el.addEventListener('animationend', () => {
        el.remove();
        activeCount--;
    });

    // Safety timeout in case animationend never fires.
    setTimeout(() => {
        if (el.parentNode) {
            el.remove();
            activeCount--;
        }
    }, durationMs + 100);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Show a damage number at the given design-space position.
 *
 * @param {number} x — Design-space X coordinate
 * @param {number} y — Design-space Y coordinate
 * @param {number} amount — Damage amount to display
 * @param {boolean} [isCrit=false] — Whether this is a critical hit
 */
export function showDamageNumber(x, y, amount, isCrit = false) {
    const { x: vx, y: vy } = designToViewport(x, y);

    // Round damage to nearest integer for display
    const displayAmount = Math.round(amount);
    const cssClass = isCrit
        ? 'dmg-number dmg-crit'
        : 'dmg-number dmg-normal';
    const text = String(displayAmount);

    createFloatingElement(vx, vy, text, cssClass);
}

/**
 * Show a gold popup at the given design-space position.
 *
 * @param {number} x — Design-space X coordinate
 * @param {number} y — Design-space Y coordinate
 * @param {number} amount — Gold amount to display
 */
export function showGoldNumber(x, y, amount) {
    const { x: vx, y: vy } = designToViewport(x, y);

    const displayAmount = Math.round(amount);
    // Prepend a coin emoji for visual flavour
    const text = '\u{1FA99} +' + displayAmount;

    createFloatingElement(vx, vy, text, 'dmg-number dmg-gold');
}

/**
 * Show a "miss" text at the given design-space position.
 *
 * @param {number} x — Design-space X coordinate
 * @param {number} y — Design-space Y coordinate
 */
export function showMissText(x, y) {
    const { x: vx, y: vy } = designToViewport(x, y);

    createFloatingElement(vx, vy, 'MISS', 'dmg-number dmg-miss');
}
