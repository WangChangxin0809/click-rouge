/**
 * Skill Data — Unified registry of all active skill types.
 *
 * Each skill type has:
 *   - label / description: display text
 *   - cooldown / duration: timing constants
 *   - effectType: combat system hook
 *   - base:   stat values at level 1
 *   - perLevel: additional stats per level beyond 1
 *
 * Effective stats are computed by scaleStats(base, perLevel, level).
 *
 * Merged from: skill-data.js + skill-definitions.js
 * Deleted:     skill-definitions.js
 *
 * Design Doc: Unified Level System — Skill Data
 *
 * Usage:
 *   import { SKILLS } from '../data/skill-data.js';
 *   const def = SKILLS['thunder_strike'];
 */

/**
 * @typedef {Object} SkillDef
 * @property {string} label - Display name
 * @property {string} description - Short description
 * @property {number} cooldown - Cooldown in seconds
 * @property {number} [duration] - Active duration in seconds (0 = instant)
 * @property {'aoe'|'freeze'|'berserk'|'heal'|'poison'|'gold_rush'} effectType
 * @property {Object<string, number>} base - Stats at level 1
 * @property {Object<string, number>} perLevel - Stat increment per level
 */

/** @type {Object<string, SkillDef>} */
export const SKILLS = {
  thunder_strike: {
    label: '雷霆一击',
    description: '对所有敌人造成AOE伤害',
    cooldown: 5,
    duration: 0,
    effectType: 'aoe',
    base: { aoeDamage: 20 },
    perLevel: { aoeDamage: 10 },
  },

  freeze: {
    label: '冰冻',
    description: '冻结所有敌人',
    cooldown: 8,
    duration: 0,
    effectType: 'freeze',
    base: { freezeDuration: 2 },
    perLevel: { freezeDuration: 0.5 },
  },

  berserk: {
    label: '狂暴',
    description: '攻击速度提升',
    cooldown: 12,
    duration: 5,
    effectType: 'berserk',
    base: { speedBonus: 0.3 },
    perLevel: { speedBonus: 0.1 },
  },

  heal: {
    label: '治疗',
    description: '恢复生命值',
    cooldown: 10,
    duration: 0,
    effectType: 'heal',
    base: { healPercent: 0.2 },
    perLevel: { healPercent: 0.05 },
  },

  poison_blade: {
    label: '淬毒之刃',
    description: '下次点击造成额外伤害',
    cooldown: 3,
    duration: 0,
    effectType: 'poison',
    base: { extraDamage: 15 },
    perLevel: { extraDamage: 10 },
  },

  gold_rush: {
    label: '黄金狂热',
    description: '金币获取提升',
    cooldown: 15,
    duration: 10,
    effectType: 'gold_rush',
    base: { goldMultiplier: 1.5 },
    perLevel: { goldMultiplier: 0.3 },
  },
};
