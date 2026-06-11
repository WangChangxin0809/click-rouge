/**
 * Reward System — Generates reward options after boss kills and kill triggers.
 *
 * Uses unified level system: all rewards carry a `level` field (integer,
 * starting at 1). New acquisitions start at Lv.1; duplicates upgrade to
 * currentLevel + 1. Effective stats are computed via scaleStats().
 *
 * Distribution: 30% equipment / 25% skills / 25% followers / 20% buffs.
 *
 * Integration:
 *   boss:died event emits → generateRewards(bossTier) → showRewardPanel(...)
 *   Player picks → applyReward(reward) → recalculateStats() → STATE updated
 *
 * Design Doc: Unified Level System — Reward Generation
 *
 * Usage:
 *   import { generateRewards, applyReward } from './systems/reward-system.js';
 */

import { STATE } from '../core/game-state.js';
import { rng } from '../core/random.js';
import { EQUIPMENT, EQUIPMENT_SLOTS, EQUIPMENT_SLOT_KEYS } from '../data/equipment-data.js';
import { SKILLS } from '../data/skill-data.js';
import { FOLLOWERS, FOLLOWER_IDS } from '../data/follower-data.js';
import { BUFFS, BUFF_IDS } from '../data/buff-data.js';
import { scaleStats } from '../data/level-scaling.js';
import { createFollower } from '../entities/follower.js';
import { BALANCE } from '../data/balance-config.js';
import { recalculateStats } from './progression-system.js';

// ---------------------------------------------------------------------------
// Reward type distribution (must sum to 1.0)
// ---------------------------------------------------------------------------

const TYPE_WEIGHTS = {
  equipment: 0.30,
  skill: 0.25,
  follower: 0.25,
  buff: 0.20,
};

// ---------------------------------------------------------------------------
// Reward generation
// ---------------------------------------------------------------------------

/**
 * Generate mini reward options for kill-based triggers (2 choices, pick 1).
 *
 * Unlike boss rewards, mini rewards are smaller in scope — 2 options instead of
 * 3-4.
 *
 * @param {number} tier - Reward tier based on wave number
 * @returns {Array<Object>}
 */
export function generateMiniRewards(tier) {
  const count = 2;
  const rewards = [];
  const timestamp = Date.now();

  for (let i = 0; i < count; i++) {
    let reward = null;
    for (let attempt = 0; attempt < 5 && !reward; attempt++) {
      const type = _pickRewardType();
      switch (type) {
        case 'equipment':
          reward = _generateEquipment(tier, timestamp, i);
          break;
        case 'skill':
          reward = _generateSkill(tier, timestamp, i);
          break;
        case 'follower':
          reward = _generateFollower(tier, timestamp, i);
          break;
        case 'buff':
          reward = _generateBuff(timestamp, i);
          break;
        default:
          reward = _generateEquipment(tier, timestamp, i);
      }
    }
    if (!reward) {
      reward = _generateEquipment(tier, timestamp, i);
    }
    rewards.push(reward);
  }

  return rewards;
}

/**
 * Generate reward options for the player to choose from (boss reward).
 *
 * @param {number} bossTier - Boss tier (1 = 3 choices, 2+ = 4 choices)
 * @returns {Array<Object>}
 */
export function generateRewards(bossTier) {
  const count = bossTier >= 2 ? 4 : 3;
  const rewards = [];
  const timestamp = Date.now();

  for (let i = 0; i < count; i++) {
    let reward = null;
    for (let attempt = 0; attempt < 5 && !reward; attempt++) {
      const type = _pickRewardType();
      switch (type) {
        case 'equipment':
          reward = _generateEquipment(bossTier, timestamp, i);
          break;
        case 'skill':
          reward = _generateSkill(bossTier, timestamp, i);
          break;
        case 'follower':
          reward = _generateFollower(bossTier, timestamp, i);
          break;
        case 'buff':
          reward = _generateBuff(timestamp, i);
          break;
        default:
          reward = _generateEquipment(bossTier, timestamp, i);
      }
    }
    if (!reward) {
      reward = _generateEquipment(bossTier, timestamp, i);
    }
    rewards.push(reward);
  }

  return rewards;
}

/**
 * Apply a selected reward to the player's state.
 *
 * Mutates STATE.player directly, then calls recalculateStats().
 *
 * @param {Object} reward - The reward object from generateRewards()
 */
export function applyReward(reward) {
  switch (reward.type) {
    case 'weapon':
    case 'armor':
    case 'accessory': {
      if (!STATE.player.equipSlots) {
        STATE.player.equipSlots = { weapon: null, armor: null, accessory: null };
      }
      // Compute effective stats from the equipment definition and level
      const def = EQUIPMENT[reward.typeId];
      const effectiveStats = def
        ? scaleStats(def.base, def.perLevel, reward.level)
        : { ...reward.stats };
      STATE.player.equipSlots[reward.slot] = {
        typeId: reward.typeId,
        name: reward.name,
        level: reward.level,
        slot: reward.slot,
        stats: effectiveStats,
      };
      break;
    }
    case 'skill': {
      if (!STATE.player.activeSkills) {
        STATE.player.activeSkills = [];
      }
      const existingIdx = STATE.player.activeSkills.findIndex(
        s => s.typeId === reward.typeId
      );
      if (existingIdx >= 0) {
        // Upgrade: increment level and update description
        const existing = STATE.player.activeSkills[existingIdx];
        existing.level = (existing.level || 1) + 1;
        existing.description = `${reward.description} (Lv.${existing.level})`;
      } else {
        // New skill
        if (STATE.player.activeSkills.length < BALANCE.MAX_SKILL_SLOTS) {
          STATE.player.activeSkills.push({
            id: `skill_${reward.typeId}`,
            typeId: reward.typeId,
            name: reward.name,
            description: `${reward.description} (Lv.1)`,
            effectType: reward.effectType,
            cooldown: reward.cooldown,
            duration: reward.duration,
            level: 1,
            _cooldownRemaining: 0,
            _cooldownTotal: 0,
          });
        } else {
          console.warn('[RewardSystem] Skill slots full, cannot add:', reward.name);
        }
      }
      break;
    }
    case 'follower': {
      if (!STATE.player.activeFollowers) {
        STATE.player.activeFollowers = [];
      }
      const existingIdx = STATE.player.activeFollowers.findIndex(
        f => f.typeId === reward.typeId
      );
      if (existingIdx >= 0) {
        // Upgrade: increment level, recalculate stats
        const existing = STATE.player.activeFollowers[existingIdx];
        existing.level = (existing.level || 1) + 1;
        const def = FOLLOWERS[existing.typeId];
        if (def) {
          const scaled = scaleStats(def.base, def.perLevel, existing.level);
          if (scaled.damage !== undefined) existing.damage = scaled.damage;
          if (scaled.healAmount !== undefined) existing.healAmount = scaled.healAmount;
          if (scaled.pickupRangeBonus !== undefined) existing.pickupRangeBonus = scaled.pickupRangeBonus;
        }
      } else {
        if (STATE.player.activeFollowers.length < BALANCE.MAX_FOLLOWERS) {
          const follower = createFollower(
            reward.typeId,
            FOLLOWERS,
            STATE.player.activeFollowers.length,
            BALANCE.MAX_FOLLOWERS,
            1 // level 1
          );
          follower.name = reward.name;
          STATE.player.activeFollowers.push(follower);
        } else {
          console.warn('[RewardSystem] Follower slots full, cannot add:', reward.name);
        }
      }
      break;
    }
    case 'buff': {
      if (!STATE.player.passiveBuffs) {
        STATE.player.passiveBuffs = [];
      }
      const existingIdx = STATE.player.passiveBuffs.findIndex(
        b => b.id === reward.typeId
      );
      const def = BUFFS[reward.typeId];
      if (existingIdx >= 0) {
        // Upgrade: increment level, recalculate stats
        const existing = STATE.player.passiveBuffs[existingIdx];
        existing.level = (existing.level || 1) + 1;
        if (def) {
          existing.stats = scaleStats(def.base, def.perLevel, existing.level);
        }
      } else {
        // New buff at level 1
        const stats = def
          ? scaleStats(def.base, def.perLevel, 1)
          : { ...reward.stats };
        STATE.player.passiveBuffs.push({
          id: reward.typeId,
          name: reward.name,
          description: reward.description,
          stats,
          level: 1,
        });
      }
      break;
    }
    default:
      console.warn(`[RewardSystem] Unknown reward type: ${reward.type}`);
  }

  // Recalculate effective stats after applying the reward
  recalculateStats();
}

// ---------------------------------------------------------------------------
// Internal: type selection
// ---------------------------------------------------------------------------

/**
 * Pick a reward type based on configured weights.
 * @returns {'equipment'|'skill'|'follower'|'buff'}
 */
function _pickRewardType() {
  const roll = rng.next();
  let cumulative = 0;
  for (const [type, weight] of Object.entries(TYPE_WEIGHTS)) {
    cumulative += weight;
    if (roll < cumulative) {
      return type;
    }
  }
  return 'equipment';
}

// ---------------------------------------------------------------------------
// Internal: specific reward generators
// ---------------------------------------------------------------------------

/**
 * Generate an equipment reward using the unified level system.
 *
 * Picks an equipment type. The level is:
 *   - Lv.1 if the slot is empty or occupied by a different typeId
 *   - currentLevel + 1 if the slot holds the same typeId
 *
 * Higher boss tiers unlock more equipment types in the pool.
 *
 * @param {number} bossTier
 * @param {number} timestamp
 * @param {number} index
 * @returns {Object|null}
 */
function _generateEquipment(bossTier, timestamp, index) {
  const equipSlots = STATE.player.equipSlots || { weapon: null, armor: null, accessory: null };

  // Build pool of eligible equipment typeIds
  // Tier 1: unlock first 2 of each slot; Tier 2: first 3; Tier 3+: all 4
  const maxIndex = Math.min(bossTier + 1, 4); // bossTier 1→2, 2→3, 3+→4

  /** @type {Array<{typeId: string, slot: string}>} */
  const pool = [];
  for (const slot of EQUIPMENT_SLOT_KEYS) {
    const ids = (EQUIPMENT_SLOTS[slot] || []).slice(0, maxIndex);
    for (const typeId of ids) {
      pool.push({ typeId, slot });
    }
  }

  if (pool.length === 0) return null;

  // Prefer filling empty slots or upgrading existing
  const emptySlotItems = pool.filter(p => !equipSlots[p.slot]);
  const upgradeItems = pool.filter(p => {
    const current = equipSlots[p.slot];
    return current && current.typeId === p.typeId;
  });
  const sidegradeItems = pool.filter(p => {
    const current = equipSlots[p.slot];
    return current && current.typeId !== p.typeId;
  });

  let chosen;
  if (emptySlotItems.length > 0) {
    chosen = rng.pickOne(emptySlotItems);
  } else if (upgradeItems.length > 0) {
    chosen = rng.pickOne(upgradeItems);
  } else if (sidegradeItems.length > 0) {
    chosen = rng.pickOne(sidegradeItems);
  } else {
    chosen = rng.pickOne(pool);
  }

  const def = EQUIPMENT[chosen.typeId];
  if (!def) return null;

  // Determine level
  const currentEquip = equipSlots[chosen.slot];
  let level = 1;
  if (currentEquip && currentEquip.typeId === chosen.typeId) {
    level = (currentEquip.level || 1) + 1;
  }

  const effectiveStats = scaleStats(def.base, def.perLevel, level);

  return {
    id: `reward_${timestamp}_${index}`,
    typeId: chosen.typeId,
    name: def.name,
    description: _equipDescriptionFromStats(effectiveStats),
    type: chosen.slot,
    slot: chosen.slot,
    level,
    stats: effectiveStats,
  };
}

/**
 * Generate a skill reward using the unified level system.
 *
 * Only offers skills the player does not already have (at Lv.1) or
 * upgrades for existing skills (at currentLevel + 1).
 *
 * @param {number} bossTier
 * @param {number} timestamp
 * @param {number} index
 * @returns {Object|null}
 */
function _generateSkill(bossTier, timestamp, index) {
  const activeSkills = STATE.player.activeSkills || [];
  const ownedIds = activeSkills.map(s => s.typeId);
  const allSkillIds = Object.keys(SKILLS);

  // Tier-based unlock: T1 has first 3, T2+ has all 6
  const unlockedIds = bossTier >= 2
    ? allSkillIds
    : allSkillIds.slice(0, 3);

  // If all slots are full and all unlocked skills are already owned
  if (activeSkills.length >= BALANCE.MAX_SKILL_SLOTS) {
    const hasNew = unlockedIds.some(id => !ownedIds.includes(id));
    if (!hasNew) {
      // All skills owned and slots full — offer upgrade for any owned
    }
  }

  // Prefer unowned skills
  const unowned = unlockedIds.filter(id => !ownedIds.includes(id));
  let chosenId;
  if (unowned.length > 0) {
    chosenId = rng.pickOne(unowned);
  } else {
    // All unlocked skills owned — offer upgrade for a random owned one
    const owned = unlockedIds.filter(id => ownedIds.includes(id));
    chosenId = owned.length > 0 ? rng.pickOne(owned) : rng.pickOne(allSkillIds);
  }

  const def = SKILLS[chosenId];
  if (!def) return null;

  // Determine level
  const existing = activeSkills.find(s => s.typeId === chosenId);
  const level = existing ? (existing.level || 1) + 1 : 1;

  return {
    id: `reward_${timestamp}_${index}`,
    typeId: chosenId,
    name: def.label,
    description: def.description,
    type: 'skill',
    level,
    cooldown: def.cooldown,
    duration: def.duration,
    effectType: def.effectType,
    stats: {},
  };
}

/**
 * Generate a follower reward using the unified level system.
 *
 * Only offers followers the player does not already have (at Lv.1) or
 * upgrades for existing followers (at currentLevel + 1).
 *
 * @param {number} bossTier
 * @param {number} timestamp
 * @param {number} index
 * @returns {Object|null}
 */
function _generateFollower(bossTier, timestamp, index) {
  const activeFollowers = STATE.player.activeFollowers || [];
  const ownedIds = activeFollowers.map(f => f.typeId);

  // Tier-based unlock: T1 has knight + healer_fairy, T2+ adds archer, T3+ adds gold_magnet
  let unlockedIds;
  if (bossTier < 2) {
    unlockedIds = ['knight', 'healer_fairy'];
  } else if (bossTier < 3) {
    unlockedIds = ['knight', 'archer', 'healer_fairy'];
  } else {
    unlockedIds = FOLLOWER_IDS;
  }

  // If follower slots are full and all unlocked are already owned
  if (activeFollowers.length >= BALANCE.MAX_FOLLOWERS) {
    const hasNew = unlockedIds.some(id => !ownedIds.includes(id));
    if (!hasNew) {
      // All owned — offer upgrade
    }
  }

  // Prefer unowned
  const unowned = unlockedIds.filter(id => !ownedIds.includes(id));
  let chosenId;
  if (unowned.length > 0) {
    chosenId = rng.pickOne(unowned);
  } else {
    const owned = unlockedIds.filter(id => ownedIds.includes(id));
    chosenId = owned.length > 0 ? rng.pickOne(owned) : rng.pickOne(FOLLOWER_IDS);
  }

  const def = FOLLOWERS[chosenId];
  if (!def) return null;

  // Determine level
  const existing = activeFollowers.find(f => f.typeId === chosenId);
  const level = existing ? (existing.level || 1) + 1 : 1;

  return {
    id: `reward_${timestamp}_${index}`,
    typeId: chosenId,
    name: def.label,
    description: _followerDescription(def),
    type: 'follower',
    level,
    stats: {},
  };
}

/**
 * Generate a buff reward using the unified level system.
 *
 * Buffs always upgrade (Lv.1 if new, currentLevel + 1 if owned).
 *
 * @param {number} timestamp
 * @param {number} index
 * @returns {Object}
 */
function _generateBuff(timestamp, index) {
  const chosenId = rng.pickOne(BUFF_IDS);
  const def = BUFFS[chosenId];

  // Determine level
  const passiveBuffs = STATE.player.passiveBuffs || [];
  const existing = passiveBuffs.find(b => b.id === chosenId);
  const level = existing ? (existing.level || 1) + 1 : 1;

  return {
    id: `reward_${timestamp}_${index}`,
    typeId: chosenId,
    name: def.name,
    description: def.description,
    type: 'buff',
    level,
    stats: {},
  };
}

// ---------------------------------------------------------------------------
// Internal: description helpers
// ---------------------------------------------------------------------------

/**
 * Build a human-readable stat description from effective stats.
 * @param {Object<string, number>} stats
 * @returns {string}
 */
function _equipDescriptionFromStats(stats) {
  const parts = [];
  const s = stats || {};

  if (s.atk) parts.push(`+${s.atk} 攻击`);
  if (s.maxHp) parts.push(`+${s.maxHp} 生命`);
  if (s.maxHpPercent) parts.push(`+${Math.round(s.maxHpPercent * 100)}% 生命`);
  if (s.critChance) parts.push(`+${Math.round(s.critChance * 100)}% 暴击率`);
  if (s.critMult) parts.push(`+${s.critMult.toFixed(1)} 暴击倍率`);
  if (s.goldMultiplier) parts.push(`+${Math.round(s.goldMultiplier * 100)}% 金币`);
  if (s.atkSpeedMult) parts.push(`+${Math.round(s.atkSpeedMult * 100)}% 攻速`);
  if (s.thorns) parts.push(`+${s.thorns} 反伤`);
  if (s.lifesteal) parts.push(`+${Math.round(s.lifesteal * 100)}% 吸血`);

  return parts.join('，') || '无特殊属性';
}

/**
 * Build a description string for a follower type.
 * @param {Object} def - Follower definition from FOLLOWERS
 * @returns {string}
 */
function _followerDescription(def) {
  if (def.attackInterval) {
    return `自动攻击敌人`;
  }
  if (def.healInterval) {
    return `定期回复生命`;
  }
  if (def.base && def.base.pickupRangeBonus !== undefined) {
    return `扩大金币收集范围`;
  }
  return '';
}
