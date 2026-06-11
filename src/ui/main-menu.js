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
// Injected CSS styles
// ---------------------------------------------------------------------------

function _injectStyles() {
    if (document.getElementById('main-menu-styles')) return;
    const style = document.createElement('style');
    style.id = 'main-menu-styles';
    style.textContent = `
        .main-menu-card {
            background: rgba(22, 22, 38, 0.95);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.10);
            border-radius: 20px;
            padding: 48px 56px;
            text-align: center;
            min-width: 400px;
            max-width: 500px;
            box-shadow: 0 8px 48px rgba(0, 0, 0, 0.6), 0 0 80px rgba(233, 69, 96, 0.08);
        }
        .main-menu-title {
            font-size: 52px;
            color: #e94560;
            letter-spacing: 3px;
            margin-bottom: 4px;
            animation: titleGlow 2.5s ease-in-out infinite;
            line-height: 1.1;
        }
        .main-menu-sub {
            font-size: 16px;
            color: #8888a0;
            margin-bottom: 32px;
            letter-spacing: 4px;
        }
        .main-menu-btns {
            display: flex; flex-direction: column; gap: 14px; align-items: center;
            margin-bottom: 24px;
        }
        .main-menu-btn {
            display: block; width: 280px; padding: 14px 0;
            font-size: 18px; font-family: inherit; font-weight: bold;
            color: #fff; border: none; border-radius: 10px;
            cursor: pointer; letter-spacing: 2px;
            transition: transform 0.15s, box-shadow 0.15s;
        }
        .main-menu-btn:hover {
            transform: scale(1.05);
        }
        .main-menu-btn:active {
            transform: scale(0.97);
        }
        .main-menu-btn-primary {
            background: linear-gradient(135deg, #e94560, #c23152);
            box-shadow: 0 4px 20px rgba(233, 69, 96, 0.35);
        }
        .main-menu-btn-primary:hover {
            box-shadow: 0 6px 28px rgba(233, 69, 96, 0.55);
        }
        .main-menu-btn-secondary {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
        }
        .main-menu-btn-secondary:hover {
            background: rgba(255, 255, 255, 0.14);
            box-shadow: 0 4px 16px rgba(255, 255, 255, 0.08);
        }
        .main-menu-divider {
            width: 200px; height: 1px;
            background: linear-gradient(90deg, transparent, rgba(240, 192, 64, 0.3), transparent);
            margin: 4px 0;
        }
        .main-menu-coin {
            font-size: 18px; color: #ffd700; font-weight: bold;
            animation: coinPulse 3s ease-in-out infinite;
            background: rgba(255, 215, 0, 0.06);
            padding: 6px 16px; border-radius: 8px;
            display: inline-block; margin-bottom: 8px;
        }
        .main-menu-footer {
            font-size: 12px; color: #555568;
        }
        @media (max-width: 480px) {
            .main-menu-card { min-width: auto; padding: 32px 24px; margin: 0 16px; }
            .main-menu-title { font-size: 36px; }
            .main-menu-btn { width: 220px; font-size: 16px; padding: 12px 0; }
        }
    `;
    document.head.appendChild(style);
}

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
    _injectStyles();
    if (!_menuEl) { _menuEl = document.getElementById('main-menu'); }
    if (!_menuEl) { console.warn('[MainMenu] #main-menu element not found in DOM'); return; }

    const coin = getPermanentGold();

    _menuEl.innerHTML = `
        <div class="main-menu-card">
            <h1 class="main-menu-title">Click Rouge</h1>
            <p class="main-menu-sub">点 击 肉 鸽</p>
            <div class="main-menu-btns">
                <button id="btn-adventure" class="main-menu-btn main-menu-btn-primary">&#9876;&#65039; 开始冒险</button>
                <div class="main-menu-divider"></div>
                <button id="btn-shop" class="main-menu-btn main-menu-btn-secondary">&#128722; 商店</button>
                <button id="btn-loadout" class="main-menu-btn main-menu-btn-secondary">&#128736;&#65039; 装备配置</button>
            </div>
            <div class="main-menu-coin">&#129689; 永久金币: <span id="perm-coin">${coin}</span></div>
            <div class="main-menu-footer" id="menu-footer">总游玩: 0 | 最高波次: 0</div>
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
