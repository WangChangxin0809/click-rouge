/**
 * Skill System — Manages skill cooldowns, activation, and effect lifecycles.
 *
 * Skills are activated via keyboard hotkeys (1-4) which map to slots in
 * STATE.player.activeSkills[]. Each skill has a type-dependent effect and
 * a cooldown period during which it cannot be re-activated.
 *
 * Time-limited effects (berserk, gold_rush, freeze) are tracked in
 * STATE.activeEffects[] and automatically reverted when their duration expires.
 * Instant effects (thunder_strike, heal, poison_blade) apply immediately.
 *
 * Implements: Click Rouge GDD — active skill system.
 *
 * Usage:
 *   import { updateSkillSystem, activateSkill, initSkillSystem } from './systems/skill-system.js';
 *   initSkillSystem();
 *   // In main game loop:
 *   updateSkillSystem(dt);
 *   // On keypress:
 *   activateSkill(slotIndex);
 */

import { STATE } from '../core/game-state.js';
import { events } from '../core/event-bus.js';
import { SKILL_DEFINITIONS } from '../data/skill-definitions.js';
import { damageEnemy } from '../entities/enemy.js';
import { awardGold } from './combat-system.js';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/**
 * Initialize the skill system for a new game run.
 * Resets all cooldowns and clears effect tracking.
 * Must be called after STATE.reset().
 */
export function initSkillSystem() {
    STATE.activeEffects = [];
    STATE.player.goldMultiplier = 1.0;
    STATE.player.poisonBladeDamage = 0;

    // Reset cooldown timers on all skills
    const skills = STATE.player.activeSkills;
    for (let i = 0; i < skills.length; i++) {
        skills[i]._cooldownRemaining = 0;
        skills[i]._cooldownTotal = 0;
    }
}

// ---------------------------------------------------------------------------
// Per-frame update
// ---------------------------------------------------------------------------

/**
 * Advance skill cooldowns and manage active effects.
 *
 * Must be called once per frame during the 'playing' phase.
 *
 * @param {number} dt - Delta time in seconds
 */
export function updateSkillSystem(dt) {
    // --- Decrement cooldowns on all skills ---
    const skills = STATE.player.activeSkills;
    for (let i = 0; i < skills.length; i++) {
        const skill = skills[i];
        if (skill._cooldownRemaining > 0) {
            skill._cooldownRemaining = Math.max(0, skill._cooldownRemaining - dt);
        }
        // Reset auto-cast frame guard
        skill._autoCastGuard = false;
    }

    // --- Manage active effects ---
    const effects = STATE.activeEffects;
    if (!effects || effects.length === 0) return;

    for (let i = effects.length - 1; i >= 0; i--) {
        const fx = effects[i];
        fx.timer -= dt;

        if (fx.timer <= 0) {
            // Effect expired — revert
            _revertEffect(fx);
            effects.splice(i, 1);
        }
    }

    // --- Freeze countdown on individual enemies ---
    _updateFreezeCountdown(dt);
}

// ---------------------------------------------------------------------------
// Skill activation
// ---------------------------------------------------------------------------

/**
 * Activate the skill in the given hotkey slot (1-4).
 *
 * Checks that the slot index is valid, a skill exists in that slot, and the
 * cooldown has elapsed. On success, applies the skill effect and starts its
 * cooldown.
 *
 * @param {number} slotIndex - Hotkey slot number (1 = first skill, 2 = second, etc.)
 */
export function activateSkill(slotIndex) {
    // Convert to 0-based index
    const idx = slotIndex - 1;

    const skills = STATE.player.activeSkills;
    if (idx < 0 || idx >= skills.length) return;

    const skill = skills[idx];
    if (!skill) return;

    // Check cooldown — use || 0 guard because reward-added skills may lack the field
    if ((skill._cooldownRemaining || 0) > 0) return;

    // Look up skill definition
    const def = SKILL_DEFINITIONS[skill.typeId];
    if (!def) {
        console.warn(`[SkillSystem] Unknown skill type: ${skill.typeId}`);
        return;
    }

    // Apply the effect based on skill type
    switch (skill.typeId) {
        case 'thunder_strike':
            _activateThunderStrike(def);
            break;
        case 'freeze':
            _activateFreeze(def);
            break;
        case 'berserk':
            _activateBerserk(def);
            break;
        case 'heal':
            _activateHeal(def);
            break;
        case 'poison_blade':
            _activatePoisonBlade(def);
            break;
        case 'gold_rush':
            _activateGoldRush(def);
            break;
        default:
            console.warn(`[SkillSystem] No handler for skill type: ${skill.typeId}`);
            return;
    }

    // Start cooldown
    skill._cooldownRemaining = def.cooldown;
    skill._cooldownTotal = def.cooldown;

    events.emit('skill:activated', { slot: slotIndex, typeId: skill.typeId, name: def.name });
}

// ---------------------------------------------------------------------------
// Auto-cast system
// ---------------------------------------------------------------------------

/**
 * Auto-cast ready skills on each frame.
 *
 * Iterates through skill slots 1-4 in order. If a slot has an equipped skill
 * and its cooldown is complete, it is automatically activated.
 *
 * Manual keypress (1-4) still works independently and can preempt auto-cast.
 *
 * Must be called once per frame after updateSkillSystem(dt).
 *
 * @param {number} dt - Delta time in seconds (unused; passed for consistency)
 */
export function updateAutoCast(dt) {
    const skills = STATE.player.activeSkills;
    if (!skills || skills.length === 0) return;

    for (let i = 0; i < skills.length && i < 4; i++) {
        const skill = skills[i];
        if (!skill) continue;
        if ((skill._cooldownRemaining || 0) <= 0) {
            // Prevent same-frame double-activation (guard clears at top of updateSkillSystem)
            if (skill._autoCastGuard) continue;
            skill._autoCastGuard = true;
            activateSkill(i + 1); // convert 0-based index to 1-based slot
        }
    }
}

// ---------------------------------------------------------------------------
// Internal: skill effect activators
// ---------------------------------------------------------------------------

/**
 * Thunder Strike — AOE damage to all alive enemies.
 */
function _activateThunderStrike(def) {
    const enemies = STATE.enemies;
    let hitCount = 0;

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (!e.alive || e.hp <= 0) continue;

        const result = damageEnemy(e, def.aoeDamage);
        e.lastHitTime = STATE.elapsedTime;

        const payload = {
            enemy: e,
            damage: def.aoeDamage,
            isCrit: false,
            overkill: result.overkill,
            position: { x: e.x, y: e.y },
        };

        if (result.killed) {
            STATE.player.gold += e.gold;
            STATE.killCount++;
            events.emit('enemy:died', payload);
        } else {
            events.emit('enemy:hit', payload);
        }

        hitCount++;
    }

    events.emit('skill:thunder', { hitCount });
}

/**
 * Freeze — Freeze all alive enemies for freezeDuration seconds.
 * Enemies with speed=0 don't move; frozen timer counts down in updateSkillSystem.
 */
function _activateFreeze(def) {
    const enemies = STATE.enemies;
    let frozenCount = 0;

    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.alive || e.hp <= 0) continue;

        // Save original speed for restoration on unfreeze
        if (!e._originalSpeed) {
            e._originalSpeed = e.speed;
        }
        e.speed = 0;
        e.frozen = true;
        e.frozenTimer = def.freezeDuration;
        frozenCount++;
    }

    // Track the effect so we can emit events
    STATE.activeEffects.push({
        type: 'freeze',
        timer: def.freezeDuration,
        frozenCount,
    });

    events.emit('skill:freeze', { frozenCount, duration: def.freezeDuration });
}

/**
 * Berserk — Increase attack speed multiplier for duration seconds.
 */
function _activateBerserk(def) {
    STATE.player.atkSpeedMult += def.speedBonus;

    STATE.activeEffects.push({
        type: 'berserk',
        timer: def.duration,
        speedBonus: def.speedBonus,
    });

    events.emit('skill:berserk', { duration: def.duration });
}

/**
 * Heal — Restore a percentage of max HP.
 */
function _activateHeal(def) {
    const player = STATE.player;
    const healAmount = player.maxHp * def.healPercent;
    const actualHeal = Math.min(healAmount, player.maxHp - player.hp);

    player.hp = Math.min(player.maxHp, player.hp + healAmount);
    events.emit('player:healed', { amount: actualHeal, source: 'skill_heal' });
}

/**
 * Poison Blade — Grant extra damage on the next click.
 * Consumed by the combat system.
 */
function _activatePoisonBlade(def) {
    STATE.player.poisonBladeDamage = (STATE.player.poisonBladeDamage || 0) + def.extraDamage;

    events.emit('skill:poison_blade', { extraDamage: def.extraDamage });
}

/**
 * Gold Rush — Multiply gold earnings for duration seconds.
 */
function _activateGoldRush(def) {
    STATE.player.goldMultiplier = (STATE.player.goldMultiplier || 1.0) * def.goldMultiplier;

    STATE.activeEffects.push({
        type: 'gold_rush',
        timer: def.duration,
        goldMultiplier: def.goldMultiplier,
    });

    events.emit('skill:gold_rush', { duration: def.duration });
}

// ---------------------------------------------------------------------------
// Internal: effect reversal and cleanup
// ---------------------------------------------------------------------------

/**
 * Revert a time-limited effect when its duration expires.
 * @param {Object} fx - Effect object from STATE.activeEffects
 */
function _revertEffect(fx) {
    switch (fx.type) {
        case 'berserk':
            STATE.player.atkSpeedMult -= fx.speedBonus;
            if (STATE.player.atkSpeedMult < 0.1) STATE.player.atkSpeedMult = 0.1;
            events.emit('skill:berserk_end', null);
            break;

        case 'gold_rush':
            STATE.player.goldMultiplier /= fx.goldMultiplier;
            if (STATE.player.goldMultiplier < 1.0) STATE.player.goldMultiplier = 1.0;
            events.emit('skill:gold_rush_end', null);
            break;

        case 'freeze':
            // Individual enemies are unfrozen by _updateFreezeCountdown
            events.emit('skill:freeze_end', null);
            break;
    }
}

/**
 * Tick down frozenTimer on each frozen enemy. When timer expires, restore
 * original speed and clear the frozen flag.
 * @param {number} dt - Delta time in seconds
 */
function _updateFreezeCountdown(dt) {
    const enemies = STATE.enemies;
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.frozen) continue;

        e.frozenTimer -= dt;
        if (e.frozenTimer <= 0) {
            e.frozen = false;
            e.frozenTimer = 0;
            // Restore original speed
            if (e._originalSpeed !== undefined) {
                e.speed = e._originalSpeed;
                e._originalSpeed = undefined;
            }
        }
    }
}
