/**
 * Loadout Panel — Pre-battle equipment/skills/followers configuration screen.
 *
 * Player selects which skills (up to 4), followers (up to 4), and equipment
 * (one per slot) to bring into the next battle. All selections come from the
 * meta-progression inventory (what the player has purchased in the shop).
 *
 * DOM strategy:
 *   Populates the existing #loadout-panel container in index.html.
 *   Selections are held in module-level closure state until confirmed.
 *
 * Usage:
 *   import { initLoadoutPanel, showLoadoutPanel } from './ui/loadout-panel.js';
 *   initLoadoutPanel();
 *   showLoadoutPanel(levelId);
 */

import { events } from '../core/event-bus.js';
import { getAllOwned, getItemLevel, getEquipName } from '../systems/meta-progression.js';
import { SKILLS } from '../data/skill-data.js';
import { FOLLOWERS } from '../data/follower-data.js';
import { EQUIPMENT } from '../data/equipment-data.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of skills the player can bring into battle */
const MAX_SKILLS = 4;

/** Maximum number of followers the player can bring into battle */
const MAX_FOLLOWERS = 4;

/** All three equipment slot keys in display order */
const EQUIP_SLOTS = ['weapon', 'armor', 'accessory'];

/** Display labels for equipment slots */
const EQUIP_SLOT_LABELS = {
    weapon: '武器',
    armor: '护甲',
    accessory: '饰品',
};

// ---------------------------------------------------------------------------
// Internal state (closure)
// ---------------------------------------------------------------------------

/** @type {string[]} Selected skill typeIds (ordered by selection) */
let _selectedSkills = [];

/** @type {string[]} Selected follower typeIds */
let _selectedFollowers = [];

/** @type {Object<string, string|null>} slot -> typeId (null = none selected) */
let _selectedEquip = { weapon: null, armor: null, accessory: null };

/** @type {number|null} The levelId passed to showLoadoutPanel */
let _levelId = null;

/** @type {HTMLElement|null} Reference to the #loadout-panel container */
let _panelEl = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Bind event listeners for the loadout panel.
 * Safe to call multiple times (idempotent via _panelEl check).
 */
export function initLoadoutPanel() {
    if (_panelEl) return;

    _panelEl = document.getElementById('loadout-panel');
    if (!_panelEl) {
        console.error('[LoadoutPanel] #loadout-panel element not found');
        return;
    }
}

/**
 * Show the loadout configuration panel.
 *
 * Reads the player's meta-progression inventory and renders interactive
 * selection cards for skills, followers, and equipment.
 *
 * @param {number} levelId - The level the player is about to enter
 */
export function showLoadoutPanel(levelId) {
    if (!_panelEl) {
        initLoadoutPanel();
    }
    if (!_panelEl) return;

    _levelId = levelId;

    // Reset selections to empty
    _selectedSkills = [];
    _selectedFollowers = [];
    _selectedEquip = { weapon: null, armor: null, accessory: null };

    _buildPanel();
    _panelEl.classList.add('active');

    events.emit('loadout:panelShown', { levelId });
}

/**
 * Hide the loadout panel and clear its contents.
 */
function _hideLoadoutPanel() {
    if (!_panelEl) return;
    _panelEl.classList.remove('active');
    _panelEl.innerHTML = '';
}

// ---------------------------------------------------------------------------
// Panel builder
// ---------------------------------------------------------------------------

/**
 * Full panel rebuild — header + skills + followers + equipment.
 */
function _buildPanel() {
    _panelEl.innerHTML = '';

    // -- Top bar -----------------------------------------------------------
    const topBar = document.createElement('div');
    topBar.className = 'loadout-top-bar';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-secondary loadout-back-btn';
    backBtn.textContent = '← 返回';
    backBtn.addEventListener('click', () => {
        _hideLoadoutPanel();
        events.emit('loadout:cancelled', null);
    });

    const title = document.createElement('h2');
    title.className = 'loadout-title';
    title.textContent = '装备配置';

    const startBtn = document.createElement('button');
    startBtn.className = 'btn loadout-start-btn';
    startBtn.textContent = '开始战斗';
    startBtn.addEventListener('click', _handleConfirm);

    topBar.appendChild(backBtn);
    topBar.appendChild(title);
    topBar.appendChild(startBtn);

    _panelEl.appendChild(topBar);

    // -- Content wrapper ---------------------------------------------------
    const content = document.createElement('div');
    content.className = 'loadout-content';

    // -- Skills section ----------------------------------------------------
    content.appendChild(_buildSkillsSection());

    // -- Followers section -------------------------------------------------
    content.appendChild(_buildFollowersSection());

    // -- Equipment section -------------------------------------------------
    content.appendChild(_buildEquipmentSection());

    _panelEl.appendChild(content);
}

// ---------------------------------------------------------------------------
// Skills section
// ---------------------------------------------------------------------------

/**
 * Build the skills selection section.
 * @returns {HTMLElement}
 */
function _buildSkillsSection() {
    const section = document.createElement('div');
    section.className = 'loadout-section';

    const header = document.createElement('h3');
    header.className = 'loadout-section-header';
    section.appendChild(header);

    const owned = getAllOwned('skills');
    const ownedIds = Object.keys(owned);

    // Update header with count
    const _updateSkillHeader = () => {
        header.textContent = `技能 (已选 ${_selectedSkills.length}/${MAX_SKILLS})`;
    };
    _updateSkillHeader();

    // No skills owned — show empty state
    if (ownedIds.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'loadout-empty-msg';
        emptyMsg.textContent = '尚未拥有技能，请先到商店购买';
        section.appendChild(emptyMsg);
        return section;
    }

    const grid = document.createElement('div');
    grid.className = 'loadout-card-grid';

    // Build a card for each owned skill
    for (const typeId of Object.keys(SKILLS)) {
        const level = owned[typeId];
        if (!level || level <= 0) continue;

        const isSelected = _selectedSkills.includes(typeId);
        const card = _buildSelectionCard({
            typeId,
            label: SKILLS[typeId].label,
            level,
            isSelected,
            onClick: () => _toggleSkill(typeId),
        });
        grid.appendChild(card);
    }

    section.appendChild(grid);
    return section;
}

/**
 * Toggle a skill selection on/off.
 * @param {string} typeId
 */
function _toggleSkill(typeId) {
    const idx = _selectedSkills.indexOf(typeId);

    if (idx >= 0) {
        // Deselect
        _selectedSkills.splice(idx, 1);
    } else {
        // Select — enforce max
        if (_selectedSkills.length >= MAX_SKILLS) return;
        _selectedSkills.push(typeId);
    }

    // Rebuild section to reflect changes
    _rebuildSection('loadout-section', 0);
}

// ---------------------------------------------------------------------------
// Followers section
// ---------------------------------------------------------------------------

/**
 * Build the followers selection section.
 * @returns {HTMLElement}
 */
function _buildFollowersSection() {
    const section = document.createElement('div');
    section.className = 'loadout-section';

    const header = document.createElement('h3');
    header.className = 'loadout-section-header';
    header.textContent = `随从 (已选 ${_selectedFollowers.length}/${MAX_FOLLOWERS})`;
    section.appendChild(header);

    const owned = getAllOwned('followers');
    const ownedIds = Object.keys(owned);

    if (ownedIds.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'loadout-empty-msg';
        emptyMsg.textContent = '尚未拥有随从，请先到商店购买';
        section.appendChild(emptyMsg);
        return section;
    }

    const grid = document.createElement('div');
    grid.className = 'loadout-card-grid';

    for (const typeId of Object.keys(FOLLOWERS)) {
        const level = owned[typeId];
        if (!level || level <= 0) continue;

        const isSelected = _selectedFollowers.includes(typeId);
        const card = _buildSelectionCard({
            typeId,
            label: FOLLOWERS[typeId].label,
            level,
            isSelected,
            onClick: () => _toggleFollower(typeId),
        });
        grid.appendChild(card);
    }

    section.appendChild(grid);
    return section;
}

/**
 * Toggle a follower selection on/off.
 * @param {string} typeId
 */
function _toggleFollower(typeId) {
    const idx = _selectedFollowers.indexOf(typeId);

    if (idx >= 0) {
        _selectedFollowers.splice(idx, 1);
    } else {
        if (_selectedFollowers.length >= MAX_FOLLOWERS) return;
        _selectedFollowers.push(typeId);
    }

    _rebuildSection('loadout-section', 1);
}

// ---------------------------------------------------------------------------
// Equipment section
// ---------------------------------------------------------------------------

/**
 * Build the equipment selection section (one slot per equipment type).
 * @returns {HTMLElement}
 */
function _buildEquipmentSection() {
    const section = document.createElement('div');
    section.className = 'loadout-section';

    const header = document.createElement('h3');
    header.className = 'loadout-section-header';
    header.textContent = '装备';
    section.appendChild(header);

    const owned = getAllOwned('equip');

    const equipRow = document.createElement('div');
    equipRow.className = 'loadout-equip-row';

    for (const slot of EQUIP_SLOTS) {
        const slotGroup = document.createElement('div');
        slotGroup.className = 'loadout-equip-slot';

        const slotLabel = document.createElement('span');
        slotLabel.className = 'loadout-equip-slot-label';
        slotLabel.textContent = EQUIP_SLOT_LABELS[slot] + ':';
        slotGroup.appendChild(slotLabel);

        const level = owned[slot] || 0;
        const currentSelection = _selectedEquip[slot];

        if (level <= 0) {
            // Not owned
            const noneSpan = document.createElement('span');
            noneSpan.className = 'loadout-equip-none';
            noneSpan.textContent = '无';
            slotGroup.appendChild(noneSpan);
        } else {
            const displayName = getEquipName(slot, level);
            const isSelected = currentSelection === slot;

            const card = _buildSelectionCard({
                typeId: slot,
                label: displayName,
                level,
                isSelected,
                onClick: () => _toggleEquip(slot),
            });
            card.classList.add('loadout-equip-card');
            slotGroup.appendChild(card);
        }

        equipRow.appendChild(slotGroup);
    }

    section.appendChild(equipRow);
    return section;
}

/**
 * Toggle equipment selection for a slot.
 * Only one equipment per slot exists, so this simply selects/deselects it.
 * @param {string} slot
 */
function _toggleEquip(slot) {
    if (_selectedEquip[slot] === slot) {
        _selectedEquip[slot] = null;
    } else {
        _selectedEquip[slot] = slot;
    }

    _rebuildSection('loadout-section', 2);
}

// ---------------------------------------------------------------------------
// Reusable card builder
// ---------------------------------------------------------------------------

/**
 * Build a clickable selection card.
 *
 * @param {Object} opts
 * @param {string} opts.typeId
 * @param {string} opts.label - Display name
 * @param {number} opts.level - Current level
 * @param {boolean} opts.isSelected - Whether currently selected
 * @param {Function} opts.onClick - Click handler
 * @returns {HTMLElement}
 */
function _buildSelectionCard({ typeId, label, level, isSelected, onClick }) {
    const card = document.createElement('div');
    card.className = 'loadout-card';
    if (isSelected) {
        card.classList.add('loadout-card-selected');
    }
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'checkbox');
    card.setAttribute('aria-checked', String(isSelected));
    card.setAttribute('aria-label', `${label} Lv.${level}${isSelected ? ' (已选)' : ''}`);

    // Checkmark indicator for selected state
    if (isSelected) {
        const checkmark = document.createElement('span');
        checkmark.className = 'loadout-card-checkmark';
        checkmark.textContent = '✓';
        card.appendChild(checkmark);
    }

    // Name
    const nameEl = document.createElement('span');
    nameEl.className = 'loadout-card-name';
    nameEl.textContent = label;
    card.appendChild(nameEl);

    // Level badge
    const levelClamped = Math.min(level, 4);
    const levelEl = document.createElement('span');
    levelEl.className = `loadout-card-level loadout-card-level-${levelClamped}`;
    levelEl.textContent = `Lv.${level}`;
    card.appendChild(levelEl);

    // Click and keyboard handlers
    card.addEventListener('click', onClick);
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
        }
    });

    return card;
}

// ---------------------------------------------------------------------------
// Section rebuild helper
// ---------------------------------------------------------------------------

/**
 * Rebuild a specific section in-place to reflect updated selections.
 *
 * @param {string} sectionClass - The class of the section element to replace
 * @param {number} index - Index among sibling .loadout-section elements (0-based)
 */
function _rebuildSection(sectionClass, index) {
    const content = _panelEl.querySelector('.loadout-content');
    if (!content) return;

    const sections = content.querySelectorAll('.' + sectionClass);
    if (index >= sections.length) return;

    const oldSection = sections[index];
    let newSection;

    if (index === 0) {
        newSection = _buildSkillsSection();
    } else if (index === 1) {
        newSection = _buildFollowersSection();
    } else if (index === 2) {
        newSection = _buildEquipmentSection();
    }

    if (newSection) {
        oldSection.replaceWith(newSection);
    }
}

// ---------------------------------------------------------------------------
// Confirm handler
// ---------------------------------------------------------------------------

/**
 * Handle the "开始战斗" button click.
 * Gathers all selections and emits the loadout:confirmed event.
 */
function _handleConfirm() {
    // Build equipment map — only include slots that have a selection
    const equipment = {};
    for (const slot of EQUIP_SLOTS) {
        equipment[slot] = _selectedEquip[slot] || null;
    }

    const payload = {
        levelId: _levelId,
        skills: [..._selectedSkills],
        followers: [..._selectedFollowers],
        equipment,
    };

    _hideLoadoutPanel();
    events.emit('loadout:confirmed', payload);
}
