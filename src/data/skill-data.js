/**
 * Skill Data — Active skill definitions.
 *
 * Each skill has an id, name, description, cooldown, optional duration,
 * and an effectType used by the combat system to determine behavior.
 *
 * Usage:
 *   import { SKILLS } from '../data/skill-data.js';
 */

/**
 * @typedef {Object} SkillDef
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} description - Tooltip text
 * @property {number} cooldown - Cooldown in seconds
 * @property {number} [duration] - Active duration in seconds (if applicable)
 * @property {'aoe'|'freeze'|'berserk'|'heal'|'poison'|'gold_rush'} effectType - Combat system hook
 */

/** @type {SkillDef[]} */
export const SKILLS = [
    {
        id: 'thunder_strike',
        name: '雷霆一击',
        description: '对所有敌人造成 player.baseAtk * 2 的伤害',
        cooldown: 12,
        duration: 0,
        effectType: 'aoe',
    },
    {
        id: 'freeze',
        name: '冰冻',
        description: '所有敌人停止移动 3 秒',
        cooldown: 15,
        duration: 3,
        effectType: 'freeze',
    },
    {
        id: 'berserk',
        name: '狂暴',
        description: '攻击速度 +50% 持续 5 秒',
        cooldown: 20,
        duration: 5,
        effectType: 'berserk',
    },
    {
        id: 'heal',
        name: '治疗',
        description: '恢复 30% 最大生命值',
        cooldown: 25,
        duration: 0,
        effectType: 'heal',
    },
    {
        id: 'poison_blade',
        name: '毒刃',
        description: '下次点击附加 50% 中毒伤害，持续 3 秒',
        cooldown: 8,
        duration: 3,
        effectType: 'poison',
    },
    {
        id: 'gold_rush',
        name: '淘金热',
        description: '10 秒内金币掉落翻倍',
        cooldown: 30,
        duration: 10,
        effectType: 'gold_rush',
    },
];
