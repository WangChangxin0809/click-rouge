/**
 * Buff Data — Passive buff definitions.
 *
 * All buffs are stackable (player can acquire the same buff multiple times).
 * Each buff provides permanent stat bonuses. Buffs are stored in
 * STATE.player.passiveBuffs and contribute to recalculateStats().
 *
 * Usage:
 *   import { BUFFS } from '../data/buff-data.js';
 */

/**
 * @typedef {Object} BuffDef
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} description - Tooltip text
 * @property {Object} stats - Stat bonuses applied per stack
 * @property {boolean} stackable - Always true for buffs
 */

/** @type {BuffDef[]} */
export const BUFFS = [
    {
        id: 'atk_boost',
        name: '力量强化',
        description: '攻击力 +15%',
        stats: { atkPercent: 0.15 },
        stackable: true,
    },
    {
        id: 'crit_boost',
        name: '暴击专注',
        description: '暴击率 +8%',
        stats: { critChance: 0.08 },
        stackable: true,
    },
    {
        id: 'hp_boost',
        name: '生命之泉',
        description: '最大生命 +20%',
        stats: { maxHpPercent: 0.20 },
        stackable: true,
    },
    {
        id: 'gold_boost',
        name: '淘金术',
        description: '金币获取 +25%',
        stats: { goldMultiplier: 0.25 },
        stackable: true,
    },
    {
        id: 'lifesteal',
        name: '吸血之触',
        description: '获得 5% 吸血',
        stats: { lifesteal: 0.05 },
        stackable: true,
    },
    {
        id: 'thorns',
        name: '荆棘护甲',
        description: '反伤 +5',
        stats: { thorns: 5 },
        stackable: true,
    },
];
