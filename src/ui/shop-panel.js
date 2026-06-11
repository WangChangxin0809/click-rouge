/**
 * Shop Panel — Meta-progression store for permanent upgrades.
 *
 * Four tabs: 属性强化 / 技能升级 / 随从升级 / 装备升级
 * Purchases spend permanentGold from meta-progression (localStorage backed).
 *
 * Usage:
 *   import { initShopPanel, showShopPanel } from './ui/shop-panel.js';
 *   initShopPanel();                            // once at bootstrap
 *   showShopPanel();                            // open the shop screen
 *
 * Events emitted:
 *   'meta:coinChanged' — after any purchase, so other UI can refresh
 */

import { events } from '../core/event-bus.js';
import {
    getPermanentGold, purchaseStatUpgrade, purchaseShopItem,
    getStatLevel, getItemLevel, getStatCost, getItemCost,
} from '../systems/meta-progression.js';
import { EQUIPMENT } from '../data/equipment-data.js';
import { SKILLS } from '../data/skill-data.js';
import { FOLLOWERS } from '../data/follower-data.js';

// ---------------------------------------------------------------------------
// Constants — stat display configuration
// ---------------------------------------------------------------------------

/** @type {Array<{key: string, label: string, nextLabel: string}>} */
const STAT_ROWS = [
    { key: 'atk',         label: '攻击力',   nextLabel: '+3 ATK' },
    { key: 'hp',          label: '生命值',   nextLabel: '+10 HP' },
    { key: 'critChance',  label: '暴击率',   nextLabel: '+2% 暴击率' },
    { key: 'critMult',    label: '暴击倍率', nextLabel: '+0.1x 暴击倍率' },
    { key: 'goldMult',    label: '金币倍率', nextLabel: '+5% 金币倍率' },
    { key: 'atkSpeed',    label: '攻击速度', nextLabel: '+3% 攻击速度' },
];

/** Skill IDs in display order */
const SKILL_IDS = ['thunder_strike', 'freeze', 'berserk', 'heal', 'poison_blade', 'gold_rush'];

/** Follower IDs in display order */
const FOLLOWER_IDS = ['knight', 'archer', 'healer_fairy', 'gold_magnet'];

/** Equipment slots in display order */
const EQUIP_SLOTS = ['weapon', 'armor', 'accessory'];

// ---------------------------------------------------------------------------
// Internal state (closure)
// ---------------------------------------------------------------------------

/** @type {HTMLElement|null} Reference to #shop-panel */
let _panel = null;

/** @type {string} Currently active tab ('stat'|'skill'|'follower'|'equip') */
let _activeTab = 'stat';

/** @type {boolean} Whether initShopPanel has been called */
let _initialized = false;

// ---------------------------------------------------------------------------
// CSS injection (shop-specific styles)
// ---------------------------------------------------------------------------

/**
 * Inject shop-panel CSS into the document head (idempotent).
 */
function _injectStyles() {
    if (document.getElementById('shop-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'shop-panel-styles';
    style.textContent = `
        /* === Shop Panel Container === */
        .shop-panel-wrap {
            display: flex;
            flex-direction: column;
            width: 100%;
            max-width: 700px;
            max-height: 85vh;
            background: rgba(18, 18, 36, 0.94);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.10);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 8px 48px rgba(0, 0, 0, 0.55);
        }

        /* === Top Bar === */
        .shop-top-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 20px;
            background: rgba(0, 0, 0, 0.3);
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            flex-shrink: 0;
        }

        .shop-back-btn {
            font-size: 14px;
            font-family: inherit;
            color: #b0b0c0;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 8px;
            padding: 6px 14px;
            cursor: pointer;
            transition: background 0.15s, color 0.15s;
            white-space: nowrap;
        }

        .shop-back-btn:hover {
            background: rgba(255, 255, 255, 0.16);
            color: #e0e0e0;
        }

        .shop-back-btn:focus-visible {
            outline: 2px solid #f0c040;
            outline-offset: 2px;
        }

        .shop-title {
            font-size: 22px;
            color: #f0c040;
            letter-spacing: 2px;
            margin: 0;
            white-space: nowrap;
        }

        .shop-coin {
            font-size: 15px;
            color: #ffd700;
            font-weight: bold;
            white-space: nowrap;
            background: rgba(255, 215, 0, 0.08);
            padding: 4px 12px;
            border-radius: 8px;
        }

        /* === Tab Bar === */
        .shop-tabs {
            display: flex;
            gap: 0;
            background: rgba(0, 0, 0, 0.2);
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            flex-shrink: 0;
        }

        .shop-tab {
            flex: 1;
            font-size: 14px;
            font-family: inherit;
            color: #8888a0;
            background: transparent;
            border: none;
            border-bottom: 2px solid transparent;
            padding: 12px 8px;
            cursor: pointer;
            transition: color 0.15s, border-color 0.15s, background 0.15s;
            white-space: nowrap;
        }

        .shop-tab:hover {
            color: #b0b0c0;
            background: rgba(255, 255, 255, 0.04);
        }

        .shop-tab.active {
            color: #f0c040;
            border-bottom-color: #f0c040;
        }

        .shop-tab:focus-visible {
            outline: 2px solid #f0c040;
            outline-offset: -2px;
        }

        /* === Content Area === */
        .shop-content-area {
            flex: 1;
            overflow-y: auto;
            padding: 8px 0;
            /* Scrollbar styling */
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
        }

        .shop-content-area::-webkit-scrollbar {
            width: 6px;
        }
        .shop-content-area::-webkit-scrollbar-track {
            background: transparent;
        }
        .shop-content-area::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.12);
            border-radius: 3px;
        }

        .shop-content {
            display: none;
        }

        .shop-content.active {
            display: block;
        }

        /* === Row === */
        .shop-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            font-size: 14px;
            transition: background 0.15s;
        }

        .shop-row:hover {
            background: rgba(255, 255, 255, 0.03);
        }

        .shop-row-name {
            flex: 0 0 100px;
            color: #e0e0e0;
            font-weight: bold;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .shop-row-level {
            flex: 0 0 44px;
            font-size: 12px;
            color: #b0b0c0;
            white-space: nowrap;
            text-align: center;
        }

        .shop-row-effect {
            flex: 1;
            font-size: 12px;
            color: #4ecca3;
            white-space: nowrap;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .shop-row-cost {
            flex: 0 0 60px;
            font-size: 13px;
            color: #ffd700;
            font-weight: bold;
            white-space: nowrap;
            text-align: right;
        }

        .shop-buy-btn {
            flex: 0 0 52px;
            font-size: 12px;
            font-family: inherit;
            font-weight: bold;
            color: #fff;
            background: linear-gradient(135deg, #4ecca3, #3aa882);
            border: none;
            border-radius: 6px;
            padding: 6px 0;
            cursor: pointer;
            transition: transform 0.1s, opacity 0.15s;
            white-space: nowrap;
        }

        .shop-buy-btn:hover:not(:disabled) {
            transform: scale(1.06);
        }

        .shop-buy-btn:active:not(:disabled) {
            transform: scale(0.96);
        }

        .shop-buy-btn:disabled {
            background: rgba(255, 255, 255, 0.08);
            color: rgba(255, 255, 255, 0.25);
            cursor: not-allowed;
            transform: none;
        }

        .shop-buy-btn:focus-visible {
            outline: 2px solid #f0c040;
            outline-offset: 2px;
        }

        /* === Empty state === */
        .shop-empty {
            text-align: center;
            color: #666680;
            padding: 40px 20px;
            font-size: 14px;
        }

        /* === Responsive === */
        @media (max-width: 480px) {
            .shop-panel-wrap {
                max-width: 98vw;
                border-radius: 10px;
            }
            .shop-top-bar {
                padding: 10px 12px;
            }
            .shop-title {
                font-size: 18px;
            }
            .shop-coin {
                font-size: 12px;
                padding: 3px 8px;
            }
            .shop-tab {
                font-size: 11px;
                padding: 10px 4px;
            }
            .shop-row {
                padding: 8px 12px;
                gap: 6px;
                font-size: 12px;
            }
            .shop-row-name {
                flex: 0 0 70px;
                font-size: 12px;
            }
            .shop-row-level {
                flex: 0 0 34px;
                font-size: 10px;
            }
            .shop-row-effect {
                font-size: 10px;
            }
            .shop-row-cost {
                flex: 0 0 46px;
                font-size: 11px;
            }
            .shop-buy-btn {
                flex: 0 0 42px;
                font-size: 10px;
            }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
            .shop-buy-btn {
                transition: none;
            }
            .shop-tab {
                transition: none;
            }
        }
    `;
    document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the shop panel — build DOM structure inside #shop-panel.
 * Must be called once at bootstrap. Idempotent (safe to call multiple times).
 */
export function initShopPanel() {
    if (_initialized) return;

    _injectStyles();

    _panel = document.getElementById('shop-panel');
    if (!_panel) {
        console.error('[ShopPanel] #shop-panel not found in DOM');
        return;
    }

    _buildPanelStructure();
    _bindEventDelegation();

    // Listen for external coin changes (e.g., after a run completes)
    events.on('meta:coinChanged', () => {
        _updateCoinDisplay();
    });

    _initialized = true;
}

/**
 * Show the shop panel as an active screen overlay.
 * Refreshes all data displays and defaults to the 属性强化 tab.
 */
export function showShopPanel() {
    if (!_panel) {
        console.error('[ShopPanel] Not initialized — call initShopPanel first');
        return;
    }

    // Switch to default tab
    _switchTab('stat');

    // Refresh all data
    _refreshAll();

    // Show the panel
    _panel.classList.add('active');

    // Emit event
    events.emit('shop:opened', null);
}

/**
 * Hide the shop panel.
 */
export function hideShopPanel() {
    if (!_panel) return;
    _panel.classList.remove('active');
}

// ---------------------------------------------------------------------------
// Internal: panel structure builder
// ---------------------------------------------------------------------------

/**
 * Build the full DOM structure inside #shop-panel.
 */
function _buildPanelStructure() {
    _panel.innerHTML = '';

    // Wrap
    const wrap = document.createElement('div');
    wrap.className = 'shop-panel-wrap';

    // -- Top bar --
    const topBar = document.createElement('div');
    topBar.className = 'shop-top-bar';

    const backBtn = document.createElement('button');
    backBtn.className = 'shop-back-btn';
    backBtn.textContent = '← 返回'; // ← 返回
    backBtn.setAttribute('data-action', 'back');
    topBar.appendChild(backBtn);

    const title = document.createElement('h2');
    title.className = 'shop-title';
    title.textContent = '商店'; // 商店
    topBar.appendChild(title);

    const coin = document.createElement('span');
    coin.className = 'shop-coin';
    coin.id = 'shop-coin-display';
    coin.textContent = '永久金币: 0'; // 永久金币: 0
    topBar.appendChild(coin);

    wrap.appendChild(topBar);

    // -- Tab bar --
    const tabBar = document.createElement('div');
    tabBar.className = 'shop-tabs';

    const tabs = [
        { id: 'stat',     label: '属性强化' }, // 属性强化
        { id: 'skill',    label: '技能升级' }, // 技能升级
        { id: 'follower', label: '随从升级' }, // 随从升级
        { id: 'equip',    label: '装备升级' }, // 装备升级
    ];

    for (const tab of tabs) {
        const btn = document.createElement('button');
        btn.className = 'shop-tab';
        btn.setAttribute('data-tab', tab.id);
        btn.textContent = tab.label;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', 'false');
        tabBar.appendChild(btn);
    }

    wrap.appendChild(tabBar);

    // -- Content area --
    const contentArea = document.createElement('div');
    contentArea.className = 'shop-content-area';

    // Content panels for each tab
    for (const tabId of ['stat', 'skill', 'follower', 'equip']) {
        const content = document.createElement('div');
        content.className = 'shop-content';
        content.setAttribute('data-content', tabId);
        content.setAttribute('role', 'tabpanel');
        contentArea.appendChild(content);
    }

    wrap.appendChild(contentArea);

    _panel.appendChild(wrap);
}

// ---------------------------------------------------------------------------
// Internal: event delegation
// ---------------------------------------------------------------------------

/**
 * Bind event delegation on the shop panel for all interactive elements.
 * Single listener pattern — avoids per-button bindings.
 */
function _bindEventDelegation() {
    _panel.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);

        // Back button
        if (target.closest('[data-action="back"]')) {
            hideShopPanel();
            return;
        }

        // Tab button
        const tabBtn = target.closest('[data-tab]');
        if (tabBtn) {
            const tabId = tabBtn.getAttribute('data-tab');
            _switchTab(tabId);
            return;
        }

        // Buy button
        const buyBtn = target.closest('[data-buy]');
        if (buyBtn) {
            const type = buyBtn.getAttribute('data-buy');
            const id   = buyBtn.getAttribute('data-buy-id');
            _handlePurchase(type, id);
            return;
        }
    });
}

// ---------------------------------------------------------------------------
// Internal: tab switching
// ---------------------------------------------------------------------------

/**
 * Switch the active tab.
 * @param {string} tabId — 'stat', 'skill', 'follower', or 'equip'
 */
function _switchTab(tabId) {
    _activeTab = tabId;

    // Update tab button active states
    const tabBtns = _panel.querySelectorAll('.shop-tab');
    for (const btn of tabBtns) {
        const isActive = btn.getAttribute('data-tab') === tabId;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', String(isActive));
    }

    // Update content panel visibility
    const contents = _panel.querySelectorAll('.shop-content');
    for (const content of contents) {
        const isActive = content.getAttribute('data-content') === tabId;
        content.classList.toggle('active', isActive);
    }

    // Refresh the newly active content
    _refreshContent(tabId);
}

// ---------------------------------------------------------------------------
// Internal: refresh all data
// ---------------------------------------------------------------------------

/**
 * Refresh all displays.
 */
function _refreshAll() {
    _updateCoinDisplay();
    _refreshContent('stat');
    _refreshContent('skill');
    _refreshContent('follower');
    _refreshContent('equip');
}

/**
 * Update the coin display element.
 */
function _updateCoinDisplay() {
    const el = document.getElementById('shop-coin-display');
    if (el) {
        el.textContent = `永久金币: ${getPermanentGold()}`; // 永久金币: N
    }
}

// ---------------------------------------------------------------------------
// Internal: content refresh per tab
// ---------------------------------------------------------------------------

/**
 * Refresh the content DOM for a specific tab.
 * @param {string} tabId
 */
function _refreshContent(tabId) {
    const contentEl = _panel.querySelector(`.shop-content[data-content="${tabId}"]`);
    if (!contentEl) return;

    switch (tabId) {
        case 'stat':     _renderStatContent(contentEl);     break;
        case 'skill':    _renderItemContent(contentEl, 'skill',  SKILL_IDS,    SKILLS);    break;
        case 'follower': _renderItemContent(contentEl, 'follower', FOLLOWER_IDS, FOLLOWERS); break;
        case 'equip':    _renderEquipContent(contentEl);    break;
    }
}

// ---------------------------------------------------------------------------
// Internal: stat content renderer
// ---------------------------------------------------------------------------

/**
 * Render the 属性强化 tab content.
 * @param {HTMLElement} container
 */
function _renderStatContent(container) {
    const gold = getPermanentGold();

    let html = '';
    for (const row of STAT_ROWS) {
        const level = getStatLevel(row.key);
        const cost  = getStatCost(row.key);
        const canAfford = gold >= cost;

        html += `<div class="shop-row">
            <span class="shop-row-name">${row.label}</span>
            <span class="shop-row-level">Lv.${level}</span>
            <span class="shop-row-effect">${row.nextLabel}</span>
            <span class="shop-row-cost">${cost}G</span>
            <button class="shop-buy-btn"
                data-buy="stat"
                data-buy-id="${row.key}"
                ${canAfford ? '' : 'disabled'}
            >购买</button>
        </div>`;
    }

    container.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Internal: item content renderer (shared by skill / follower)
// ---------------------------------------------------------------------------

/**
 * Render content for skill or follower upgrade tabs.
 * @param {HTMLElement} container
 * @param {'skill'|'follower'} type
 * @param {string[]} ids
 * @param {Object<string, {label: string, perLevel?: Object}>} dataMap
 */
function _renderItemContent(container, type, ids, dataMap) {
    const gold = getPermanentGold();

    let html = '';

    for (const id of ids) {
        const def = dataMap[id];
        if (!def) continue;

        const level = getItemLevel(type, id);
        const cost  = getItemCost(type, id);
        const canAfford = gold >= cost;

        // Build "下一级" effect text
        const nextEffect = _buildNextEffectText(def, level + 1);

        // Purchase label
        const buyLabel = level === 0
            ? '获得'  // 获得
            : '购买'; // 购买

        html += `<div class="shop-row">
            <span class="shop-row-name">${def.label}</span>
            <span class="shop-row-level">Lv.${level}</span>
            <span class="shop-row-effect">下一级: ${nextEffect}</span>
            <span class="shop-row-cost">${cost}G</span>
            <button class="shop-buy-btn"
                data-buy="${type}"
                data-buy-id="${id}"
                ${canAfford ? '' : 'disabled'}
            >${buyLabel}</button>
        </div>`;
    }

    if (html === '') {
        html = '<div class="shop-empty">暂无可用项目</div>'; // 暂无可用项目
    }

    container.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Internal: equipment content renderer
// ---------------------------------------------------------------------------

/**
 * Render the 装备升级 tab content.
 * @param {HTMLElement} container
 */
function _renderEquipContent(container) {
    const gold = getPermanentGold();

    let html = '';

    for (const slot of EQUIP_SLOTS) {
        const def = EQUIPMENT[slot];
        if (!def) continue;

        const level = getItemLevel('equip', slot);
        const cost  = getItemCost('equip', slot);
        const canAfford = gold >= cost;

        // Equipment name from data
        const equipName = def.name || slot;

        // Next level effect from perLevel stats
        const nextEffect = _buildEquipNextEffect(def);

        const buyLabel = level === 0
            ? '获得'  // 获得
            : '购买'; // 购买

        html += `<div class="shop-row">
            <span class="shop-row-name">${equipName}</span>
            <span class="shop-row-level">Lv.${level}</span>
            <span class="shop-row-effect">下一级: ${nextEffect}</span>
            <span class="shop-row-cost">${cost}G</span>
            <button class="shop-buy-btn"
                data-buy="equip"
                data-buy-id="${slot}"
                ${canAfford ? '' : 'disabled'}
            >${buyLabel}</button>
        </div>`;
    }

    if (html === '') {
        html = '<div class="shop-empty">暂无可用项目</div>';
    }

    container.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Internal: purchase handler
// ---------------------------------------------------------------------------

/**
 * Handle a purchase click (via event delegation).
 * @param {string} type — 'stat', 'skill', 'follower', or 'equip'
 * @param {string} id   — stat key, skill/follower/equip typeId
 */
function _handlePurchase(type, id) {
    let success = false;

    if (type === 'stat') {
        success = purchaseStatUpgrade(id);
    } else {
        success = purchaseShopItem(type, id);
    }

    if (success) {
        // Refresh all displays (coin + affected tab)
        _updateCoinDisplay();
        _refreshContent(_activeTab);

        // Notify other systems
        events.emit('meta:coinChanged', null);
    }
}

// ---------------------------------------------------------------------------
// Internal: next-level effect text builders
// ---------------------------------------------------------------------------

/**
 * Build "下一级: XXX" text for a skill or follower definition.
 * @param {Object} def — SkillDef or FollowerDef with perLevel stats
 * @param {number} nextLevel — The level being purchased (currentLevel + 1)
 * @returns {string}
 */
function _buildNextEffectText(def, nextLevel) {
    const perLevel = def.perLevel;
    if (!perLevel || Object.keys(perLevel).length === 0) {
        return '无变化'; // 无变化
    }

    const parts = [];
    for (const [key, value] of Object.entries(perLevel)) {
        parts.push(_formatStatEffect(key, value));
    }
    return parts.join('，') || '无变化';
}

/**
 * Build "下一级: XXX" text for an equipment definition.
 * @param {Object} def — Equipment definition with perLevel stats
 * @returns {string}
 */
function _buildEquipNextEffect(def) {
    const perLevel = def.perLevel;
    if (!perLevel || Object.keys(perLevel).length === 0) {
        return '无变化';
    }

    const parts = [];
    for (const [key, value] of Object.entries(perLevel)) {
        parts.push(_formatStatEffect(key, value));
    }
    return parts.join('，') || '无变化';
}

/**
 * Format a single stat effect for human-readable display.
 * @param {string} key — stat key (e.g., 'aoeDamage', 'cooldown', 'damage')
 * @param {number} value — per-level increment
 * @returns {string}
 */
function _formatStatEffect(key, value) {
    const isNegative = value < 0;
    const absVal = Math.abs(value);

    switch (key) {
        case 'critChance':
            return `暴击率 ${isNegative ? '-' : '+'}${Math.round(absVal * 100)}%`;
        case 'healPercent':
            return `治疗 ${isNegative ? '-' : '+'}${Math.round(absVal * 100)}%`;
        case 'speedBonus':
            return `攻速 ${isNegative ? '-' : '+'}${Math.round(absVal * 100)}%`;
        case 'goldMultiplier':
        case 'goldMult':
            return `金币倍率 ${isNegative ? '-' : '+'}${absVal}`;
        case 'cooldown':
            return `冷却 ${isNegative ? '-' : '+'}${absVal}秒`;
        case 'freezeDuration':
            return `冻结 ${isNegative ? '-' : '+'}${absVal}秒`;
        case 'aoeDamage':
        case 'extraDamage':
        case 'damage':
            return `伤害 ${isNegative ? '-' : '+'}${absVal}`;
        case 'atk':
            return `ATK ${isNegative ? '-' : '+'}${absVal}`;
        case 'maxHp':
            return `HP ${isNegative ? '-' : '+'}${absVal}`;
        case 'healAmount':
            return `治疗 ${isNegative ? '-' : '+'}${absVal}`;
        case 'pickupRangeBonus':
            return `拾取范围 ${isNegative ? '-' : '+'}${absVal}`;
        default:
            return `${key} ${isNegative ? '-' : '+'}${absVal}`;
    }
}
