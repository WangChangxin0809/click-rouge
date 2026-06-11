/**
 * Skill System — Manages skill cooldowns, activation, and effect lifecycles.
 *
 * Skills are activated via keyboard hotkeys (1-4) which map to slots in
 * STATE.player.activeSkills[]. Each skill has a typeId, level, cooldown,
 * and effect values computed from SKILLS data via scaleStats().
 *
 * Time-limited effects (berserk, gold_rush, freeze) are tracked in
 * STATE.activeEffects[] and automatically reverted when their duration expires.
 * Instant effects (thunder_strike, heal, poison_blade) apply immediately.
 *
 * Implements: Unified Level System — Skill Activation
 *
 * Usage:
 *   import { updateSkillSystem, activateSkill, initSkillSystem } from './systems/skill-system.js';
 *   initSkillSystem();
 *   updateSkillSystem(dt);
 *   activateSkill(slotIndex);
 */

import { STATE } from '../core/game-state.js';
import { events } from '../core/event-bus.js';
import { SKILLS } from '../data/skill-data.js';
import { scaleStats } from '../data/level-scaling.js';
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
    if ((skill._cooldownRemaining || 0) > 0) {
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
 * Uses scaleStats(skill.level) to compute effective values from the skill's
 * data definition (base + perLevel). The skill object in STATE carries its
 * own `level` field set by reward-system.js.
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

  // Check cooldown
  if ((skill._cooldownRemaining || 0) > 0) return;

  // Look up skill data definition
  const def = SKILLS[skill.typeId];
  if (!def) {
    console.warn(`[SkillSystem] Unknown skill type: ${skill.typeId}`);
    return;
  }

  // Compute effective stats for current level
  const lv = skill.level || 1;
  const scaled = scaleStats(def.base, def.perLevel, lv);

  // Apply the effect based on skill type
  switch (skill.typeId) {
    case 'thunder_strike':
      _activateThunderStrike(scaled);
      break;
    case 'freeze':
      _activateFreeze(scaled);
      break;
    case 'berserk':
      _activateBerserk(scaled, def);
      break;
    case 'heal':
      _activateHeal(scaled);
      break;
    case 'poison_blade':
      _activatePoisonBlade(scaled);
      break;
    case 'gold_rush':
      _activateGoldRush(scaled, def);
      break;
    default:
      console.warn(`[SkillSystem] No handler for skill type: ${skill.typeId}`);
      return;
  }

  // Start cooldown
  skill._cooldownRemaining = def.cooldown;
  skill._cooldownTotal = def.cooldown;

  events.emit('skill:activated', { slot: slotIndex, typeId: skill.typeId, name: def.label });
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
 * Must be called once per frame after updateSkillSystem(dt).
 *
 * @param {number} dt - Delta time in seconds
 */
export function updateAutoCast(dt) {
  const skills = STATE.player.activeSkills;
  if (!skills || skills.length === 0) return;

  for (let i = 0; i < skills.length && i < 4; i++) {
    const skill = skills[i];
    if (!skill) continue;
    if ((skill._cooldownRemaining || 0) <= 0) {
      if (skill._autoCastGuard) continue;
      skill._autoCastGuard = true;
      activateSkill(i + 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Internal: skill effect activators
// ---------------------------------------------------------------------------

/**
 * Thunder Strike — AOE damage to all alive enemies.
 * @param {Object} scaled - Effective stats from scaleStats (contains aoeDamage)
 */
function _activateThunderStrike(scaled) {
  const enemies = STATE.enemies;
  let hitCount = 0;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e.alive || e.hp <= 0) continue;

    const result = damageEnemy(e, scaled.aoeDamage);
    e.lastHitTime = STATE.elapsedTime;

    const payload = {
      enemy: e,
      damage: scaled.aoeDamage,
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
 * @param {Object} scaled - Effective stats (contains freezeDuration)
 */
function _activateFreeze(scaled) {
  const enemies = STATE.enemies;
  let frozenCount = 0;

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive || e.hp <= 0) continue;

    if (!e._originalSpeed) {
      e._originalSpeed = e.speed;
    }
    e.speed = 0;
    e.frozen = true;
    e.frozenTimer = scaled.freezeDuration;
    frozenCount++;
  }

  STATE.activeEffects.push({
    type: 'freeze',
    timer: scaled.freezeDuration,
    frozenCount,
  });

  events.emit('skill:freeze', { frozenCount, duration: scaled.freezeDuration });
}

/**
 * Berserk — Increase attack speed multiplier for duration seconds.
 * @param {Object} scaled - Effective stats (contains speedBonus)
 * @param {Object} def - Skill definition (contains duration)
 */
function _activateBerserk(scaled, def) {
  STATE.player.atkSpeedMult += scaled.speedBonus;

  STATE.activeEffects.push({
    type: 'berserk',
    timer: def.duration,
    speedBonus: scaled.speedBonus,
  });

  events.emit('skill:berserk', { duration: def.duration });
}

/**
 * Heal — Restore a percentage of max HP.
 * @param {Object} scaled - Effective stats (contains healPercent)
 */
function _activateHeal(scaled) {
  const player = STATE.player;
  const healAmount = player.maxHp * scaled.healPercent;
  const actualHeal = Math.min(healAmount, player.maxHp - player.hp);

  player.hp = Math.min(player.maxHp, player.hp + healAmount);
  events.emit('player:healed', { amount: actualHeal, source: 'skill_heal' });
}

/**
 * Poison Blade — Grant extra damage on the next click.
 * @param {Object} scaled - Effective stats (contains extraDamage)
 */
function _activatePoisonBlade(scaled) {
  STATE.player.poisonBladeDamage = (STATE.player.poisonBladeDamage || 0) + scaled.extraDamage;

  events.emit('skill:poison_blade', { extraDamage: scaled.extraDamage });
}

/**
 * Gold Rush — Multiply gold earnings for duration seconds.
 * @param {Object} scaled - Effective stats (contains goldMultiplier)
 * @param {Object} def - Skill definition (contains duration)
 */
function _activateGoldRush(scaled, def) {
  STATE.player.goldMultiplier = (STATE.player.goldMultiplier || 1.0) * scaled.goldMultiplier;

  STATE.activeEffects.push({
    type: 'gold_rush',
    timer: def.duration,
    goldMultiplier: scaled.goldMultiplier,
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
      events.emit('skill:freeze_end', null);
      break;
  }
}

/**
 * Tick down frozenTimer on each frozen enemy.
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
      if (e._originalSpeed !== undefined) {
        e.speed = e._originalSpeed;
        e._originalSpeed = undefined;
      }
    }
  }
}
