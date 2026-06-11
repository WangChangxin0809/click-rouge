/**
 * Level Select — 5-level selection grid with meta-progression integration.
 *
 * Reads LEVELS from level-config.js and checks isLevelUnlocked() from
 * meta-progression.js to render locked/unlocked state for each level card.
 * Compares player ATK (from permanent stat upgrades) against recommended ATK
 * to give a difficulty indicator.
 *
 * Usage:
 *   import { initLevelSelect, showLevelSelect } from './ui/level-select.js';
 *
 *   // At bootstrap:
 *   initLevelSelect();
 *
 *   // When navigating here:
 *   showLevelSelect();
 */

import { events } from '../core/event-bus.js';
import { LEVELS } from '../data/level-config.js';
import { isLevelUnlocked, getStatLevel } from '../systems/meta-progression.js';

// ---------------------------------------------------------------------------
// DOM references (populated lazily)
// ---------------------------------------------------------------------------

/** @type {HTMLElement|null} */
let _containerEl = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate player's current ATK including permanent stat upgrades.
 * Base ATK is 10 (from game-state default).
 * @returns {number}
 */
function _getCurrentAtk() {
    const baseAtk = 10;
    const atkLevel = getStatLevel('atk');
    // STAT_AMOUNTS.atk = 3 per level (mirrors meta-progression.js)
    return baseAtk + atkLevel * 3;
}

/**
 * Return a short ATK comparison string (Chinese, compact).
 * @param {number} currentAtk
 * @param {number} recommendedAtk
 * @returns {string}
 */
function _atkComparison(currentAtk, recommendedAtk) {
    if (currentAtk >= recommendedAtk) {
        return 'ATK 充足';
    }
    const ratio = Math.floor((currentAtk / recommendedAtk) * 100);
    if (ratio >= 80) {
        return 'ATK 接近';
    }
    return `ATK ${ratio}%`;
}

/**
 * Get boss preview text from the boss pool array.
 * @param {string[]} bossPool
 * @returns {string}
 */
function _bossPreview(bossPool) {
    // Simple mapping of boss typeIds to Chinese names (fallback)
    const _BOSS_NAMES = {
        giant_slime: '巨型史莱姆',
        skeleton_king: '骷髅王',
        fire_dragon: '火龙',
    };
    const names = bossPool
        .map(id => _BOSS_NAMES[id] || id)
        .slice(0, 2); // max 2 boss names
    return names.join('/');
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/**
 * Render the level select screen content.
 */
function _render() {
    if (!_containerEl) {
        _containerEl = document.getElementById('level-select');
    }
    if (!_containerEl) {
        console.warn('[LevelSelect] #level-select element not found in DOM');
        return;
    }

    const currentAtk = _getCurrentAtk();
    const levelIds = [1, 2, 3, 4, 5];
    let cardsHtml = '';

    for (const id of levelIds) {
        const level = LEVELS[id];
        if (!level) continue;

        const unlocked = isLevelUnlocked(id);

        if (unlocked) {
            const atkStr = _atkComparison(currentAtk, level.recommendedAtk);
            const bossStr = _bossPreview(level.bossPool);
            cardsHtml += `
                <div class="level-card" data-level-id="${id}"
                     style="
                         background: rgba(22, 22, 38, 0.92);
                         backdrop-filter: blur(8px);
                         border: 1px solid rgba(255, 255, 255, 0.12);
                         border-radius: 14px;
                         padding: 20px 16px;
                         width: 220px;
                         min-height: 220px;
                         display: flex;
                         flex-direction: column;
                         align-items: center;
                         justify-content: space-between;
                         gap: 10px;
                         text-align: center;
                     ">
                    <div style="font-size:18px;font-weight:bold;color:#ffffff;letter-spacing:1px;">${level.name}</div>
                    <div style="font-size:12px;color:#8888a0;line-height:1.5;">${level.description}</div>
                    <div style="font-size:12px;color:#b0b0c0;line-height:1.6;">
                        推荐ATK: <span style="color:#f0c040;font-weight:bold;">${level.recommendedAtk}</span><br>
                        Boss: <span style="color:#e94560;">${bossStr}</span><br>
                        <span style="color:#4ecca3;">${atkStr}</span>
                    </div>
                    <button class="btn btn-enter-level" data-level-id="${id}" style="width:100%;padding:8px;font-size:14px;">
                        进入
                    </button>
                </div>`;
        } else {
            cardsHtml += `
                <div class="level-card level-card-locked" data-level-id="${id}"
                     style="
                         background: rgba(22, 22, 38, 0.6);
                         border: 2px dashed rgba(255, 255, 255, 0.08);
                         border-radius: 14px;
                         padding: 20px 16px;
                         width: 220px;
                         min-height: 220px;
                         display: flex;
                         flex-direction: column;
                         align-items: center;
                         justify-content: center;
                         gap: 10px;
                         text-align: center;
                         filter: grayscale(0.6);
                         opacity: 0.55;
                     ">
                    <div style="font-size:40px;">&#x1F512;</div>
                    <div style="font-size:14px;color:#666680;">???</div>
                    <div style="font-size:12px;color:#555568;">通关前一关解锁</div>
                </div>`;
        }
    }

    _containerEl.innerHTML = `
        <button class="btn btn-secondary" id="btn-level-back" style="position:absolute;top:20px;left:20px;">&larr; 返回</button>
        <div class="level-select-title" style="font-size:28px;color:#e0e0e0;letter-spacing:2px;margin-bottom:8px;text-align:center;width:100%;">选择关卡</div>
        <div class="level-cards-wrapper" style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;max-width:1200px;width:100%;padding:0 20px;">
            ${cardsHtml}
        </div>
    `;
}

/**
 * Bind event listeners after render.
 */
function _bindEvents() {
    if (!_containerEl) return;

    // Back button
    const btnBack = _containerEl.querySelector('#btn-level-back');
    if (btnBack) {
        const clone = btnBack.cloneNode(true);
        btnBack.replaceWith(clone);
        clone.addEventListener('click', () => {
            events.emit('menu:navigate', { screen: 'lobby' });
        });
    }

    // Enter buttons (unlocked cards)
    const enterBtns = _containerEl.querySelectorAll('.btn-enter-level');
    for (const btn of enterBtns) {
        const clone = btn.cloneNode(true);
        btn.replaceWith(clone);
        const levelId = parseInt(clone.getAttribute('data-level-id'), 10);
        clone.addEventListener('click', () => {
            events.emit('level:selected', { levelId });
        });
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the level select UI.
 * Call once at bootstrap to set up the container.
 */
export function initLevelSelect() {
    // No persistent listeners needed until showLevelSelect is called.
    // The container is referenced lazily.
}

/**
 * Show the level select screen.
 * Re-renders cards with latest meta-progression data.
 */
export function showLevelSelect() {
    _render();
    _bindEvents();
}
