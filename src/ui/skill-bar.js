/**
 * Skill Bar — Manages the bottom skill bar HUD element.
 *
 * Displays 4 skill slots with icons, names, and cooldown progress overlays.
 * Reads from STATE.player.activeSkills and tracks cooldown timers internally.
 *
 * Uses unified level system: displays `level` field from skill objects
 * (replaces old `stack` field).
 *
 * Usage:
 *   import { updateSkillBar, setSkillSlots } from './ui/skill-bar.js';
 *   setSkillSlots(STATE.player.activeSkills);
 *   updateSkillBar();
 */

import { STATE } from '../core/game-state.js';
import { events } from '../core/event-bus.js';

// ---------------------------------------------------------------------------
// Internal state (closure)
// ---------------------------------------------------------------------------

/** @type {Array<{id: string, name: string, cooldown: number, icon: string, level: number}>} */
let _skillSlots = [];

/** @type {Array<HTMLElement>} Cached slot DOM elements */
let _slotEls = null;

/** Maximum number of skill slots */
const MAX_SLOTS = 4;

// ---------------------------------------------------------------------------
// Icon mapping (based on skill typeId)
// ---------------------------------------------------------------------------

/** @type {Object<string, string>} */
const SKILL_ICONS = {
  'thunder_strike': '⚡',
  'freeze': '❄',
  'berserk': '🔥',
  'heal': '💚',
  'poison_blade': '☠',
  'gold_rush': '💰',
};

/**
 * Pick an icon for a given skill typeId.
 * @param {string} typeId
 * @returns {string}
 */
function _iconForSkill(typeId) {
  if (SKILL_ICONS[typeId]) return SKILL_ICONS[typeId];
  return typeId ? typeId.charAt(0).toUpperCase() : '?';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Set the skills displayed in the bar. Called when skills are added or removed.
 *
 * @param {Array<Object>} skills - Array of skill objects from STATE.player.activeSkills
 */
export function setSkillSlots(skills) {
  _skillSlots = skills.slice(0, MAX_SLOTS).map((skill) => ({
    id: skill.id,
    name: skill.name,
    icon: _iconForSkill(skill.typeId),
    level: skill.level || 1,
  }));

  _renderSlots();
}

/**
 * Update the skill bar cooldown overlays — call each frame from updateHudDom().
 */
export function updateSkillBar() {
  if (!_slotEls) {
    _cacheSlotElements();
  }
  if (!_slotEls) return;

  const skills = STATE.player.activeSkills;

  for (let i = 0; i < MAX_SLOTS; i++) {
    const slotEl = _slotEls[i];
    if (!slotEl) continue;

    const stateSkill = (skills && skills[i]) || null;
    const uiSkill = _skillSlots[i] || null;

    let cooldownFraction = 0;
    let onCooldown = false;
    let cooldownRemaining = 0;
    let cooldownTotal = 0;

    if (stateSkill && (stateSkill._cooldownRemaining || 0) > 0) {
      cooldownRemaining = stateSkill._cooldownRemaining;
      cooldownTotal = stateSkill._cooldownTotal || 0;
      if (cooldownTotal > 0) {
        onCooldown = true;
        cooldownFraction = cooldownRemaining / cooldownTotal;
      }
    }

    // Update cooldown overlay
    const overlay = slotEl.querySelector('.skill-cooldown-overlay');
    if (overlay) {
      overlay.style.height = onCooldown
        ? (cooldownFraction * 100) + '%'
        : '0%';
      overlay.style.display = onCooldown ? 'block' : 'none';
    }

    // Update aria for accessibility
    if (onCooldown && uiSkill) {
      slotEl.setAttribute('aria-label',
        `${uiSkill.name} - 冷却中 ${Math.ceil(cooldownRemaining)}秒`);
    } else if (uiSkill) {
      slotEl.setAttribute('aria-label', `${uiSkill.name} - 就绪`);
    } else {
      slotEl.setAttribute('aria-label', '空技能槽');
    }

    // Update level badge if stateSkill level changed
    if (stateSkill && uiSkill) {
      const newLevel = stateSkill.level || 1;
      if (uiSkill.level !== newLevel) {
        uiSkill.level = newLevel;
        _refreshSlotBadge(i, newLevel);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Internal: DOM rendering
// ---------------------------------------------------------------------------

function _renderSlots() {
  _cacheSlotElements();
  if (!_slotEls) return;

  for (let i = 0; i < MAX_SLOTS; i++) {
    const slotEl = _slotEls[i];
    if (!slotEl) continue;

    const skill = _skillSlots[i] || null;

    const existingIcon = slotEl.querySelector('.skill-icon');
    const existingName = slotEl.querySelector('.skill-name');

    if (skill) {
      slotEl.classList.add('skill-slot-filled');
      slotEl.classList.remove('skill-slot-empty');

      if (existingIcon) {
        existingIcon.textContent = skill.icon;
      } else {
        const iconEl = document.createElement('span');
        iconEl.className = 'skill-icon';
        iconEl.textContent = skill.icon;
        slotEl.appendChild(iconEl);
      }

      if (existingName) {
        existingName.textContent = skill.name;
      } else {
        const nameEl = document.createElement('span');
        nameEl.className = 'skill-name';
        nameEl.textContent = skill.name;
        slotEl.appendChild(nameEl);
      }

      // Level badge
      _refreshSlotBadge(i, skill.level);
    } else {
      slotEl.classList.add('skill-slot-empty');
      slotEl.classList.remove('skill-slot-filled');

      if (existingIcon) existingIcon.remove();
      if (existingName) existingName.remove();
      const existingBadge = slotEl.querySelector('.skill-level-badge');
      if (existingBadge) existingBadge.remove();
    }
  }
}

/**
 * Refresh the level badge for a specific slot.
 * @param {number} i - Slot index (0-based)
 * @param {number} level - Current level
 */
function _refreshSlotBadge(i, level) {
  const slotEl = _slotEls[i];
  if (!slotEl) return;

  const existingBadge = slotEl.querySelector('.skill-level-badge');
  const levelClamped = Math.min(level, 4);
  const levelClass = `skill-level-badge skill-level-${levelClamped}`;

  if (existingBadge) {
    existingBadge.textContent = `Lv.${level}`;
    existingBadge.className = levelClass;
  } else {
    const badgeEl = document.createElement('span');
    badgeEl.className = levelClass;
    badgeEl.textContent = `Lv.${level}`;
    slotEl.appendChild(badgeEl);
  }
}

function _cacheSlotElements() {
  if (_slotEls) return;
  const bar = document.querySelector('.skill-bar');
  if (!bar) return;
  _slotEls = Array.from(bar.querySelectorAll('.skill-slot'));
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

function _initClickHandlers() {
  const bar = document.querySelector('.skill-bar');
  if (!bar) return;

  bar.addEventListener('click', (e) => {
    let target = e.target;
    while (target && target !== bar) {
      if (target.classList.contains('skill-slot')) {
        const key = target.getAttribute('data-key');
        if (key) {
          const slotIndex = parseInt(key, 10);
          if (slotIndex >= 1 && slotIndex <= MAX_SLOTS) {
            events.emit('skill:activate', { slot: slotIndex });
          }
        }
        return;
      }
      target = target.parentElement;
    }
  });

  bar.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.classList.contains('skill-slot')) {
      e.preventDefault();
      const key = e.target.getAttribute('data-key');
      if (key) {
        const slotIndex = parseInt(key, 10);
        if (slotIndex >= 1 && slotIndex <= MAX_SLOTS) {
          events.emit('skill:activate', { slot: slotIndex });
        }
      }
    }
  });
}

requestAnimationFrame(() => {
  _initClickHandlers();
});
