/**
 * Reward Panel — UI overlay for the post-boss reward selection screen.
 *
 * Displays 3-4 reward cards horizontally. Player clicks one to select it,
 * which triggers the onPick callback and hides the panel.
 *
 * DOM strategy:
 *   Creates a <div class="reward-panel"> inside #modal-overlay.
 *   On selection, removes it from the DOM and calls onPick(reward).
 *
 * Animation:
 *   Panel fades in from below. Cards have a staggered slide-up entrance
 *   and scale up on hover. Respects prefers-reduced-motion.
 *
 * Usage:
 *   import { showRewardPanel, hideRewardPanel } from './ui/reward-panel.js';
 *   showRewardPanel(rewards, (reward) => { applyReward(reward); });
 *   hideRewardPanel(); // manual close (e.g., on game reset)
 */

import { events } from '../core/event-bus.js';
import { STATE } from '../core/game-state.js';

// ---------------------------------------------------------------------------
// Internal state (closure)
// ---------------------------------------------------------------------------

/** @type {HTMLElement|null} */
let _panelEl = null;

/** @type {Function|null} */
let _onPickCallback = null;

/** @type {boolean} */
let _selectionLocked = false;

/** @type {number|null} */
let _selectionTimerId = null;

// ---------------------------------------------------------------------------
// Type icon mapping
// ---------------------------------------------------------------------------

/** @type {Object<string, string>} */
const TYPE_ICONS = {
    weapon: '⚔️',    // crossed swords
    skill: '✨',           // sparkles
    follower: '◆',        // diamond
    buff: '\u{1F6E1}️',  // shield
};

/** @type {Object<string, string>} */
const TYPE_LABELS = {
    weapon: '武器',
    skill: '技能',
    follower: '随从',
    buff: '增益',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Show the reward selection panel.
 *
 * Creates card elements inside #modal-overlay. If a panel is already showing,
 * it is removed first (re-entrant safe).
 *
 * @param {Array<Object>} rewards - Array of reward objects from generateRewards()
 * @param {Function} onPick - Callback invoked with the selected reward object
 */
export function showRewardPanel(rewards, onPick) {
    // Re-entrant safety: remove existing panel first
    if (_panelEl) {
        hideRewardPanel();
    }

    if (!rewards || rewards.length === 0) {
        console.warn('[RewardPanel] No rewards to display');
        return;
    }

    _onPickCallback = onPick;
    _selectionLocked = false;

    // Determine if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const overlay = document.getElementById('modal-overlay');
    if (!overlay) {
        console.error('[RewardPanel] #modal-overlay not found');
        return;
    }

    // Build panel container
    _panelEl = document.createElement('div');
    _panelEl.className = 'reward-panel';
    if (!prefersReducedMotion) {
        _panelEl.classList.add('reward-panel-enter');
    }

    // Title
    const title = document.createElement('h2');
    title.className = 'reward-panel-title';
    title.textContent = '选择一个奖励';
    _panelEl.appendChild(title);

    // Cards wrapper
    const cardsWrapper = document.createElement('div');
    cardsWrapper.className = 'reward-cards-wrapper';

    // Create individual cards with staggered animation
    for (let i = 0; i < rewards.length; i++) {
        const reward = rewards[i];
        const card = _buildCard(reward, i, prefersReducedMotion);
        cardsWrapper.appendChild(card);
    }

    _panelEl.appendChild(cardsWrapper);

    // Append to overlay
    overlay.appendChild(_panelEl);

    // Emit event
    events.emit('reward:panelShown', { count: rewards.length });
}

/**
 * Hide and remove the reward panel from the DOM.
 *
 * Safe to call even when no panel is showing (no-op).
 */
export function hideRewardPanel() {
    if (_selectionTimerId !== null) {
        clearTimeout(_selectionTimerId);
        _selectionTimerId = null;
    }
    if (_panelEl) {
        _panelEl.remove();
        _panelEl = null;
    }
    _onPickCallback = null;
    _selectionLocked = false;
}

// ---------------------------------------------------------------------------
// Internal: card builder
// ---------------------------------------------------------------------------

/**
 * Build a single reward card element.
 *
 * @param {Object} reward
 * @param {number} index - Card index (for staggered animation)
 * @param {boolean} prefersReducedMotion
 * @returns {HTMLElement}
 */
function _buildCard(reward, index, prefersReducedMotion) {
    const card = document.createElement('div');
    card.className = 'reward-card';
    if (!prefersReducedMotion) {
        card.style.animationDelay = `${index * 0.1}s`;
        card.classList.add('reward-card-enter');
    }

    // Type icon
    const icon = document.createElement('div');
    icon.className = 'reward-card-icon';
    icon.textContent = TYPE_ICONS[reward.type] || '?';
    card.appendChild(icon);

    // Name
    const name = document.createElement('div');
    name.className = 'reward-card-name';
    name.textContent = reward.name;
    card.appendChild(name);

    // Type label
    const typeLabel = document.createElement('div');
    typeLabel.className = 'reward-card-type';
    typeLabel.textContent = TYPE_LABELS[reward.type] || reward.type;
    card.appendChild(typeLabel);

    // Unified level badge — Lv.1 white, Lv.2 blue, Lv.3 purple, Lv.4+ gold
    const level = reward.level || 1;
    const levelClamped = Math.min(level, 4);
    const levelLabel = document.createElement('div');
    levelLabel.className = `reward-card-level reward-card-level-${levelClamped}`;
    levelLabel.textContent = `Lv.${level}`;
    card.appendChild(levelLabel);

    // Upgrade info — if this skill/follower is already owned, show "升级 Lv.X -> Lv.X+1"
    const upgradeText = _buildUpgradeText(reward);
    if (upgradeText) {
        const upgradeEl = document.createElement('div');
        upgradeEl.className = 'reward-card-upgrade';
        upgradeEl.textContent = upgradeText;
        card.appendChild(upgradeEl);
    }

    // Description
    const desc = document.createElement('div');
    desc.className = 'reward-card-desc';
    desc.textContent = reward.description;
    card.appendChild(desc);

    // Stats
    if (reward.stats && Object.keys(reward.stats).length > 0) {
        const statsEl = document.createElement('div');
        statsEl.className = 'reward-card-stats';
        statsEl.textContent = _formatStats(reward.stats);
        card.appendChild(statsEl);
    }

    // Click handler
    card.addEventListener('click', () => _handleSelection(reward, card));

    // Keyboard accessibility
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${reward.name} - ${reward.description}`);
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            _handleSelection(reward, card);
        }
    });

    return card;
}

// ---------------------------------------------------------------------------
// Internal: selection handler
// ---------------------------------------------------------------------------

/**
 * Handle when a player clicks a reward card.
 *
 * @param {Object} reward
 * @param {HTMLElement} cardEl
 */
function _handleSelection(reward, cardEl) {
    // Prevent double-selection (debounce)
    if (_selectionLocked) return;
    _selectionLocked = true;

    // Visual feedback — highlight the selected card
    cardEl.classList.add('reward-card-selected');

    // Save callback reference before hideRewardPanel clears it
    const onPick = _onPickCallback;

    hideRewardPanel();

    // Fire events
    events.emit('reward:selected', reward);

    // Invoke the callback — caller (main.js) manages game state transitions
    if (onPick) {
        onPick(reward);
    }
}

// ---------------------------------------------------------------------------
// Internal: upgrade text builder
// ---------------------------------------------------------------------------

/**
 * Build upgrade text if this reward would upgrade an already-owned entity.
 *
 * Checks STATE.player for existing skills/followers/equipment matching
 * the reward's typeId or slot. Returns null for new entities or buffs.
 *
 * @param {Object} reward
 * @returns {string|null}
 */
function _buildUpgradeText(reward) {
    // Skill upgrade — check if player already owns this skill id
    if (reward.type === 'skill') {
        const existing = (STATE.player.activeSkills || []).find(
            s => s.id === reward.typeId
        );
        if (existing) {
            const currentLv = existing.level || 1;
            const nextLv = currentLv + 1;
            return `升级 Lv.${currentLv}→Lv.${nextLv}`;
        }
    }

    // Follower upgrade — check if player already owns this follower typeId
    if (reward.type === 'follower') {
        const existing = (STATE.player.activeFollowers || []).find(
            f => f.typeId === reward.typeId
        );
        if (existing) {
            const currentLv = existing.level || 1;
            const nextLv = currentLv + 1;
            return `升级 Lv.${currentLv}→Lv.${nextLv}`;
        }
    }

    // Equipment upgrade — check if player has an item in the same slot
    if (reward.type === 'weapon' || reward.type === 'armor' || reward.type === 'accessory') {
        const currentEquip = STATE.player.equipSlots?.[reward.slot] || null;
        if (currentEquip) {
            const currentLv = currentEquip.level || 1;
            const nextLv = reward.level || 1;
            return `升级 Lv.${currentLv}→Lv.${nextLv}`;
        }
    }

    // No upgrade text for buffs or brand-new entities
    return null;
}

// ---------------------------------------------------------------------------
// Internal: stats formatter
// ---------------------------------------------------------------------------

/**
 * Format a stats object into a human-readable string.
 *
 * @param {Object} stats
 * @returns {string}
 */
function _formatStats(stats) {
    const statLabels = {
        atk: '攻击',
        maxHp: '最大生命',
        critChance: '暴击率',
        atkSpeedMult: '攻速',
        damage: '伤害',
        cooldown: '冷却',
        aoeRange: '范围',
        attackSpeed: '攻击速度',
        hp: '生命',
    };

    const parts = [];
    for (const [key, value] of Object.entries(stats)) {
        const label = statLabels[key] || key;

        // Format based on value type and key
        if (key === 'critChance') {
            parts.push(`${label} +${Math.round(value * 100)}%`);
        } else if (key === 'cooldown') {
            parts.push(`${label} ${value}秒`);
        } else if (key === 'aoeRange') {
            parts.push(`${label} ${value}px`);
        } else if (typeof value === 'number') {
            const prefix = value >= 0 ? '+' : '';
            parts.push(`${label} ${prefix}${value}`);
        } else {
            parts.push(`${label} ${value}`);
        }
    }

    return parts.join('  |  ');
}
