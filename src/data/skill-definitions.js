/**
 * Skill Definitions — Pure data table for all active skills in Click Rouge.
 *
 * Each entry defines the base parameters for a skill type. These values are
 * consumed by the skill system (src/systems/skill-system.js) at activation time.
 *
 * This module imports nothing — it is a pure data file suitable for hot-reload
 * or being replaced by a JSON payload.
 *
 * Usage:
 *   import { SKILL_DEFINITIONS } from '../data/skill-definitions.js';
 *   const def = SKILL_DEFINITIONS['thunder_strike'];
 */

/**
 * @typedef {Object} SkillDef
 * @property {string}   label       - Display name
 * @property {string}   description - Short description text
 * @property {number}   cooldown    - Cooldown duration in seconds
 * @property {number}   [aoeDamage] - AOE damage per enemy (thunder_strike)
 * @property {number}   [freezeDuration] - Freeze duration in seconds (freeze)
 * @property {number}   [speedBonus] - Attack speed multiplier bonus (berserk)
 * @property {number}   [duration]  - Effect duration in seconds (berserk, gold_rush)
 * @property {number}   [healPercent] - Fraction of maxHp healed (heal)
 * @property {number}   [extraDamage] - Extra damage on next click (poison_blade)
 * @property {number}   [goldMultiplier] - Gold multiplier value (gold_rush)
 */

/** @type {Object<string, SkillDef>} */
export const SKILL_DEFINITIONS = {
    thunder_strike: {
        label: '雷霆一击',
        description: '对所有敌人造成AOE伤害',
        cooldown: 5,
        aoeDamage: 30,
    },

    freeze: {
        label: '冰冻',
        description: '冻结所有敌人3秒',
        cooldown: 8,
        freezeDuration: 3,
    },

    berserk: {
        label: '狂暴',
        description: '攻击速度提升50%，持续5秒',
        cooldown: 12,
        speedBonus: 0.5,
        duration: 5,
    },

    heal: {
        label: '治疗',
        description: '恢复最大生命值的30%',
        cooldown: 10,
        healPercent: 0.3,
    },

    poison_blade: {
        label: '淬毒之刃',
        description: '下次点击造成额外伤害',
        cooldown: 3,
        extraDamage: 25,
    },

    gold_rush: {
        label: '黄金狂热',
        description: '金币获取翻倍，持续10秒',
        cooldown: 15,
        goldMultiplier: 2,
        duration: 10,
    },
};
