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
// Inject stylesheet
// ---------------------------------------------------------------------------

function _injectStyles() {
    if (document.getElementById('level-select-styles')) return;
    const style = document.createElement('style');
    style.id = 'level-select-styles';
    style.textContent = `
        .level-select-title {
            font-size: 30px; color: #f0c040; letter-spacing: 3px;
            text-align: center; width: 100%;
            padding-bottom: 12px; margin-bottom: 24px;
            border-bottom: 2px solid rgba(240, 192, 64, 0.3);
        }
        .level-cards-wrapper {
            display: flex; gap: 16px; flex-wrap: wrap; justify-content: center;
            max-width: 1200px; width: 100%; padding: 0 20px;
        }
        .level-card {
            position: relative;
            background: rgba(22, 22, 38, 0.92);
            backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 14px;
            padding: 20px 16px; width: 220px; min-height: 240px;
            display: flex; flex-direction: column; align-items: center;
            gap: 10px; text-align: center;
            transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
        }
        .level-card:hover {
            transform: translateY(-4px);
            border-color: rgba(240, 192, 64, 0.4);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }
        .level-card-locked {
            background: rgba(22, 22, 38, 0.5);
            border: 2px dashed rgba(255, 255, 255, 0.06);
            filter: grayscale(0.7); opacity: 0.55; cursor: default;
        }
        .level-card-locked:hover {
            transform: none; border-color: rgba(255, 255, 255, 0.06);
            box-shadow: none;
        }
        .level-card-locked::after {
            content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%);
            border-radius: 14px; pointer-events: none;
        }
        .level-card-num {
            font-size: 42px; font-weight: bold; color: rgba(240, 192, 64, 0.15);
            position: absolute; top: 10px; left: 14px; line-height: 1; pointer-events: none;
        }
        .level-card-name {
            font-size: 18px; font-weight: bold; color: #ffffff;
            letter-spacing: 1px; margin-top: 8px;
        }
        .level-card-desc {
            font-size: 12px; color: #8888a0; line-height: 1.4;
        }
        .level-card-info {
            font-size: 12px; color: #b0b0c0; line-height: 1.6; width: 100%;
        }
        .level-card-atk-bar-outer {
            width: 100%; height: 6px; background: rgba(255,255,255,0.08);
            border-radius: 3px; overflow: hidden;
        }
        .level-card-atk-bar-inner {
            height: 100%; border-radius: 3px; transition: width 0.3s ease;
        }
        .level-card-boss {
            font-size: 24px; letter-spacing: 4px;
        }
        .btn-enter-level {
            width: 100%; padding: 8px; font-size: 14px; margin-top: auto;
        }
        .btn-level-back {
            position: absolute; top: 20px; left: 20px;
        }
    `;
    document.head.appendChild(style);
}

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

    const BOSS_EMOJI = { giant_slime: '\u{1F9EA}', skeleton_king: '\u{1F480}', fire_dragon: '\u{1F432}' };
    const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

    const currentAtk = _getCurrentAtk();
    const levelIds = [1, 2, 3, 4, 5];
    let cardsHtml = '';

    for (const id of levelIds) {
        const level = LEVELS[id];
        if (!level) continue;

        const unlocked = isLevelUnlocked(id);

        if (unlocked) {
            const atkRatio = Math.min(100, Math.round((currentAtk / level.recommendedAtk) * 100));
            const atkColor = atkRatio >= 100 ? '#4ecca3' : atkRatio >= 70 ? '#f0c040' : '#e94560';
            const bossEmoji = (level.bossPool || []).map(pid => BOSS_EMOJI[pid] || '\u{1F47E}').join(' ');
            cardsHtml += `<div class="level-card" data-level-id="${id}">
                <div class="level-card-num">${ROMAN[id]}</div>
                <div class="level-card-name">${level.name}</div>
                <div class="level-card-desc">${level.description}</div>
                <div class="level-card-info">推荐 ATK: <span style="color:#f0c040;font-weight:bold;">${level.recommendedAtk}</span></div>
                <div class="level-card-atk-bar-outer"><div class="level-card-atk-bar-inner" style="width:${atkRatio}%;background:${atkColor};"></div></div>
                <div class="level-card-boss">${bossEmoji}</div>
                <button class="btn btn-enter-level">进入</button>
            </div>`;
        } else {
            cardsHtml += `<div class="level-card level-card-locked" data-level-id="${id}">
                <div class="level-card-num">${ROMAN[id]}</div>
                <div style="font-size:40px;">&#x1F512;</div>
                <div style="font-size:14px;color:#666680;">???</div>
                <div style="font-size:12px;color:#555568;">通关前一关解锁</div>
            </div>`;
        }
    }

    _containerEl.innerHTML = `
        <button class="btn btn-secondary btn-level-back" id="btn-level-back">&larr; 返回</button>
        <div class="level-select-title">选择关卡</div>
        <div class="level-cards-wrapper">
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

    // Enter buttons (unlocked cards) — data-level-id is on the parent .level-card
    const enterBtns = _containerEl.querySelectorAll('.btn-enter-level');
    for (const btn of enterBtns) {
        const clone = btn.cloneNode(true);
        btn.replaceWith(clone);
        const card = clone.closest('.level-card');
        const levelId = card ? parseInt(card.getAttribute('data-level-id'), 10) : 0;
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
    _injectStyles();
    _render();
    _bindEvents();
}
