/**
 * Main Menu — Click Rouge title screen with navigation to adventure, shop, loadout.
 *
 * Displays permanent gold balance and lifetime stats from meta-progression.
 * All navigation is done via EventBus events, never direct screen manipulation.
 *
 * Usage:
 *   import { initMainMenu, showMainMenu } from './ui/main-menu.js';
 *
 *   // At bootstrap:
 *   initMainMenu();
 *   showMainMenu();
 */

import { events } from '../core/event-bus.js';
import { getPermanentGold } from '../systems/meta-progression.js';

// ---------------------------------------------------------------------------
// DOM references (populated on first call to showMainMenu)
// ---------------------------------------------------------------------------

/** @type {HTMLElement|null} */
let _menuEl = null;

/** @type {HTMLElement|null} */
let _permCoinSpan = null;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Render the main menu HTML content into #main-menu.
 * Idempotent — subsequent calls re-render in-place.
 */
function _render() {
    if (!_menuEl) {
        _menuEl = document.getElementById('main-menu');
    }
    if (!_menuEl) {
        console.warn('[MainMenu] #main-menu element not found in DOM');
        return;
    }

    const coin = getPermanentGold();

    _menuEl.innerHTML = `
        <div class="modal-card">
            <h1>Click Rouge</h1>
            <p class="subtitle">点击肉鸽</p>
            <button id="btn-adventure" class="btn">开始冒险</button>
            <button id="btn-shop" class="btn btn-secondary">商店</button>
            <button id="btn-loadout" class="btn btn-secondary">装备配置</button>
            <div class="menu-stats" style="margin-top:20px;font-size:14px;color:#b0b0c0;">
                永久金币: <span id="perm-coin" style="color:#ffd700;font-weight:bold;">${coin}</span>
            </div>
            <div class="menu-footer" id="menu-footer" style="margin-top:8px;font-size:12px;color:#666680;">
                总游玩: 0 | 最高波次: 0
            </div>
        </div>
    `;

    _permCoinSpan = _menuEl.querySelector('#perm-coin');
}

/**
 * Refresh the permanent gold display and stats footer.
 * Called on meta:coinChanged event and after showMainMenu.
 */
function _refreshStats() {
    if (_permCoinSpan) {
        _permCoinSpan.textContent = String(getPermanentGold());
    }

    // Update stats footer if available
    const footer = _menuEl ? _menuEl.querySelector('#menu-footer') : null;
    if (footer) {
        // Read stats from localStorage directly (avoid circular dependency with loadMeta)
        try {
            const raw = localStorage.getItem('click_rouge_meta');
            if (raw) {
                const meta = JSON.parse(raw);
                const totalRuns = meta.totalRuns || 0;
                const bestWave = meta.bestWave || 0;
                footer.textContent = `总游玩: ${totalRuns} | 最高波次: ${bestWave}`;
            }
        } catch (_e) {
            // Stats unavailable — leave default text
        }
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the main menu: re-render content and bind button event handlers.
 * Safe to call multiple times — duplicates are removed first.
 */
export function initMainMenu() {
    _render();

    // Remove stale listeners by cloning (avoids duplicate bindings)
    const btnAdventure = document.getElementById('btn-adventure');
    const btnShop = document.getElementById('btn-shop');
    const btnLoadout = document.getElementById('btn-loadout');

    if (btnAdventure) {
        const clone = btnAdventure.cloneNode(true);
        btnAdventure.replaceWith(clone);
        clone.addEventListener('click', () => {
            events.emit('menu:navigate', { screen: 'levelSelect' });
        });
    }

    if (btnShop) {
        const clone = btnShop.cloneNode(true);
        btnShop.replaceWith(clone);
        clone.addEventListener('click', () => {
            events.emit('menu:navigate', { screen: 'shop' });
        });
    }

    if (btnLoadout) {
        const clone = btnLoadout.cloneNode(true);
        btnLoadout.replaceWith(clone);
        clone.addEventListener('click', () => {
            events.emit('menu:navigate', { screen: 'loadout' });
        });
    }

    // Listen for coin changes to refresh the display
    events.on('meta:coinChanged', () => {
        _refreshStats();
    });
}

/**
 * Show the main menu screen.
 * Re-renders content (to pick up latest stats), shows #main-menu,
 * hides other .screen elements.
 */
export function showMainMenu() {
    _refreshStats();
}
