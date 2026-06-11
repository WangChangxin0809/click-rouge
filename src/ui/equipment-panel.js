/**
 * Equipment Panel — Small equipment display area in the HUD.
 *
 * Shows 3 slots (weapon, armor, accessory) with icon, name, and brief stats.
 * Reads from STATE.player.equipSlots each frame via updateEquipmentPanel().
 *
 * The panel element (#equipment-panel) must exist in the DOM (index.html).
 * Items are pushed into equipSlots by the reward system (skill, weapon etc.
 * are placed into appropriate slots based on reward type).
 *
 * Usage:
 *   import { updateEquipmentPanel } from './ui/equipment-panel.js';
 *   updateEquipmentPanel(); // call each frame
 */

import { STATE } from '../core/game-state.js';

// ---------------------------------------------------------------------------
// Slot configuration
// ---------------------------------------------------------------------------

/** @type {Array<{key: string, label: string, emptyIcon: string}>} */
const SLOT_CONFIG = [
    { key: 'weapon',    label: '武器', emptyIcon: '--' },
    { key: 'armor',     label: '防具', emptyIcon: '--' },
    { key: 'accessory', label: '饰品', emptyIcon: '--' },
];

/**
 * Pick an icon for an item based on its type and name.
 * @param {Object|null} item
 * @returns {string}
 */
function _iconForItem(item) {
    if (!item) return '--';
    // If the item has its own icon field, use it
    if (item.icon) return item.icon;
    // Default icons by item type
    switch (item.type) {
        case 'weapon': return '⚔️'; // swords
        case 'armor':  return '\u{1F6E1}️'; // shield
        case 'accessory': return '\u{1F48D}'; // ring
        default: return '?';
    }
}

/**
 * Format stats into a short string suitable for the equipment panel.
 * @param {Object} stats
 * @returns {string}
 */
function _formatBriefStats(stats) {
    if (!stats || Object.keys(stats).length === 0) return '';
    const parts = [];
    if (stats.atk !== undefined) parts.push(`ATK +${stats.atk}`);
    if (stats.damage !== undefined) parts.push(`DMG +${stats.damage}`);
    if (stats.maxHp !== undefined) parts.push(`HP +${stats.maxHp}`);
    if (stats.critChance !== undefined) parts.push(`暴击 +${Math.round(stats.critChance * 100)}%`);
    if (stats.cooldown !== undefined) parts.push(`CD ${stats.cooldown}s`);
    return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Update the equipment panel DOM to reflect current STATE.player.equipSlots.
 * Call each frame from updateHudDom().
 */
export function updateEquipmentPanel() {
    const panel = document.getElementById('equipment-panel');
    if (!panel) return;

    const equipSlots = STATE.player.equipSlots;
    if (!equipSlots) return;

    // Find or create rows
    let rows = panel.querySelectorAll('.equip-row');
    if (rows.length !== SLOT_CONFIG.length) {
        // Rebuild if row count doesn't match
        _buildPanelStructure(panel);
        rows = panel.querySelectorAll('.equip-row');
    }

    for (let i = 0; i < SLOT_CONFIG.length; i++) {
        const config = SLOT_CONFIG[i];
        const item = equipSlots[config.key] || null;
        const row = rows[i];
        if (!row) continue;

        const iconEl = row.querySelector('.equip-icon');
        const nameEl = row.querySelector('.equip-name');
        const statsEl = row.querySelector('.equip-stats');
        const levelEl = row.querySelector('.equip-level');

        if (item) {
            row.classList.add('equip-row-filled');
            row.classList.remove('equip-row-empty');
            if (iconEl) iconEl.textContent = _iconForItem(item);
            if (nameEl) nameEl.textContent = item.name || config.label;
            if (statsEl) statsEl.textContent = _formatBriefStats(item.stats);
            // Level badge — show Lv.N based on item tier
            const lv = item.tier || 1;
            const lvClamped = Math.min(lv, 4);
            if (levelEl) {
                levelEl.textContent = `Lv.${lv}`;
                levelEl.className = `equip-level equip-level-${lvClamped}`;
                levelEl.style.display = '';
            }
        } else {
            row.classList.add('equip-row-empty');
            row.classList.remove('equip-row-filled');
            if (iconEl) iconEl.textContent = config.emptyIcon;
            if (nameEl) nameEl.textContent = '空';
            if (statsEl) statsEl.textContent = '';
            if (levelEl) {
                levelEl.textContent = '';
                levelEl.style.display = 'none';
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internal: panel structure builder
// ---------------------------------------------------------------------------

/**
 * Build the DOM structure for the equipment panel.
 * Only called once if the panel needs initialization.
 *
 * @param {HTMLElement} panel - The #equipment-panel element
 */
function _buildPanelStructure(panel) {
    // Clear existing content
    panel.innerHTML = '';

    for (const config of SLOT_CONFIG) {
        const row = document.createElement('div');
        row.className = 'equip-row equip-row-empty';

        const icon = document.createElement('span');
        icon.className = 'equip-icon';
        icon.textContent = config.emptyIcon;
        row.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'equip-name';
        name.textContent = '空';
        row.appendChild(name);

        const stats = document.createElement('span');
        stats.className = 'equip-stats';
        row.appendChild(stats);

        const level = document.createElement('span');
        level.className = 'equip-level';
        row.appendChild(level);

        panel.appendChild(row);
    }
}
