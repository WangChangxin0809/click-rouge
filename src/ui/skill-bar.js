/**
 * Skill Bar — Manages the bottom skill bar HUD element.
 *
 * Displays 4 skill slots with icons, names, and cooldown progress overlays.
 * Reads from STATE.player.activeSkills and tracks cooldown timers internally.
 *
 * Cooldown state is tracked per slot index (1-4) rather than per skill,
 * because the mapping of skills to slots can change. When setSkillSlots()
 * is called, old timer state is cleared.
 *
 * Usage:
 *   import { updateSkillBar, setSkillSlots } from './ui/skill-bar.js';
 *   setSkillSlots(STATE.player.activeSkills);
 *   updateSkillBar(); // call each frame
 */

import { STATE } from '../core/game-state.js';
import { events } from '../core/event-bus.js';

// ---------------------------------------------------------------------------
// Internal state (closure)
// ---------------------------------------------------------------------------

/** @type {Array<{id: string, name: string, cooldown: number, icon: string}>} */
let _skillSlots = [];

/** @type {Object<number, number>} Map of slot index (1-4) → last use timestamp (STATE.elapsedTime) */
const _cooldownTimers = {};

/** @type {Array<HTMLElement>} Cached slot DOM elements */
let _slotEls = null;

/** Maximum number of skill slots */
const MAX_SLOTS = 4;

// ---------------------------------------------------------------------------
// Icon mapping (based on skill name)
// ---------------------------------------------------------------------------

/** @type {Object<string, string>} */
const SKILL_ICONS = {
    '火球术': '\u{1F525}',      // fire
    '雷电链': '⚡',        // high voltage
    '冰霜新星': '❄️', // snowflake
    '毒雾': '\u{1F342}',       // mushroom (poison vibe)
    '神圣之光': '✨',      // sparkles
    '暗影步': '\u{1F300}',     // cyclone
    '旋风斩': '\u{1F32A}',     // tornado
    '大地震击': '\u{1F4A5}',    // explosion
};

/**
 * Pick an icon for a given skill name.
 * Falls back to the first character of the name if no mapping exists.
 *
 * @param {string} name
 * @returns {string}
 */
function _iconForSkill(name) {
    if (SKILL_ICONS[name]) return SKILL_ICONS[name];
    // Fallback: use first character as icon text
    return name ? name.charAt(0) : '?';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Set the skills displayed in the bar. Called when skills are added or removed.
 *
 * Each skill object from the reward system has:
 *   { id, name, description, stats: { damage, cooldown, aoeRange } }
 *
 * @param {Array<Object>} skills - Array of skill objects from STATE.player.activeSkills
 */
export function setSkillSlots(skills) {
    // Reset cooldown timers when skills change
    for (let i = 1; i <= MAX_SLOTS; i++) {
        delete _cooldownTimers[i];
    }

    _skillSlots = skills.slice(0, MAX_SLOTS).map((skill) => ({
        id: skill.id,
        name: skill.name,
        cooldown: (skill.stats && skill.stats.cooldown) ? skill.stats.cooldown : 5,
        icon: _iconForSkill(skill.name),
    }));

    _renderSlots();
}

/**
 * Update the skill bar cooldown overlays — call each frame from updateHudDom().
 *
 * Reads STATE.elapsedTime to calculate cooldown progress for each slot.
 */
export function updateSkillBar() {
    if (!_slotEls) {
        _cacheSlotElements();
    }
    if (!_slotEls) return;

    const now = STATE.elapsedTime;

    for (let i = 0; i < MAX_SLOTS; i++) {
        const slotIndex = i + 1;
        const slotEl = _slotEls[i];
        if (!slotEl) continue;

        const lastUsed = _cooldownTimers[slotIndex] || 0;
        const skill = _skillSlots[i] || null;

        let cooldownFraction = 0;
        let onCooldown = false;

        if (skill && skill.cooldown > 0 && lastUsed > 0) {
            const elapsed = now - lastUsed;
            if (elapsed < skill.cooldown) {
                onCooldown = true;
                cooldownFraction = 1 - (elapsed / skill.cooldown);
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
        if (onCooldown) {
            slotEl.setAttribute('aria-label',
                `${skill.name} - 冷却中 ${Math.ceil(cooldownFraction * skill.cooldown)}秒`);
        } else if (skill) {
            slotEl.setAttribute('aria-label', `${skill.name} - 就绪`);
        } else {
            slotEl.setAttribute('aria-label', '空技能槽');
        }
    }
}

// ---------------------------------------------------------------------------
// Internal: DOM rendering
// ---------------------------------------------------------------------------

/**
 * Render skill slot content based on current _skillSlots array.
 */
function _renderSlots() {
    _cacheSlotElements();
    if (!_slotEls) return;

    for (let i = 0; i < MAX_SLOTS; i++) {
        const slotEl = _slotEls[i];
        if (!slotEl) continue;

        const skill = _skillSlots[i] || null;

        // Clear existing content (keep cooldown overlay and key hint)
        const existingIcon = slotEl.querySelector('.skill-icon');
        const existingName = slotEl.querySelector('.skill-name');

        if (skill) {
            slotEl.classList.add('skill-slot-filled');

            // Update or create icon
            if (existingIcon) {
                existingIcon.textContent = skill.icon;
            } else {
                const iconEl = document.createElement('span');
                iconEl.className = 'skill-icon';
                iconEl.textContent = skill.icon;
                slotEl.appendChild(iconEl);
            }

            // Update or create name
            if (existingName) {
                existingName.textContent = skill.name;
            } else {
                const nameEl = document.createElement('span');
                nameEl.className = 'skill-name';
                nameEl.textContent = skill.name;
                slotEl.appendChild(nameEl);
            }
        } else {
            slotEl.classList.remove('skill-slot-filled');

            // Remove skill content
            if (existingIcon) existingIcon.remove();
            if (existingName) existingName.remove();

            slotEl.classList.add('skill-slot-empty');
        }
    }
}

/**
 * Cache references to the 4 skill slot DOM elements.
 */
function _cacheSlotElements() {
    if (_slotEls) return;
    const bar = document.querySelector('.skill-bar');
    if (!bar) return;
    _slotEls = Array.from(bar.querySelectorAll('.skill-slot'));
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

/**
 * Listen for skill activation to record cooldown timer.
 */
events.on('skill:activate', (payload) => {
    const slotIndex = payload.slot;
    if (slotIndex < 1 || slotIndex > MAX_SLOTS) return;

    const skill = _skillSlots[slotIndex - 1];
    if (!skill) return;

    // Check if on cooldown
    const lastUsed = _cooldownTimers[slotIndex] || 0;
    const now = STATE.elapsedTime;
    if (now - lastUsed < skill.cooldown) return; // still on cooldown, ignore

    // Record activation time
    _cooldownTimers[slotIndex] = STATE.elapsedTime;
});

/**
 * Delegate click handling for the skill bar. Each .skill-slot has data-key="1..4".
 * When clicked, emits skill:activate just like the keyboard shortcut.
 */
function _initClickHandlers() {
    const bar = document.querySelector('.skill-bar');
    if (!bar) return;

    // Use event delegation on the skill-bar so clicks work even after slot re-render
    bar.addEventListener('click', (e) => {
        // Walk up from the click target to find the nearest .skill-slot
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

    // Keyboard accessibility — Enter/Space on focused skill slot
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

// Initialize click handlers on module load (deferred via rAF to ensure DOM is ready)
requestAnimationFrame(() => {
    _initClickHandlers();
});
