/**
 * Buff Data — Registry of passive buff types.
 *
 * Each buff type has:
 *   - name / description: display text
 *   - base:   stat values at level 1
 *   - perLevel: additional stats per level beyond 1
 *
 * Buffs are upgraded in-place: picking the same buff again increments its
 * level and recalculates its effective stats via scaleStats(). Previously,
 * buffs were always stackable (multiple entries per type); the level system
 * replaces stacking with level progression.
 *
 * Design Doc: Unified Level System — Buff Data
 *
 * Usage:
 *   import { BUFFS } from '../data/buff-data.js';
 *   const def = BUFFS['atk_boost'];
 */

/**
 * @typedef {Object} BuffDef
 * @property {string} name - Display name
 * @property {string} description - Tooltip text
 * @property {Object<string, number>} base - Stats at level 1
 * @property {Object<string, number>} perLevel - Stat increment per level
 */

/** @type {Object<string, BuffDef>} */
export const BUFFS = {
  atk_boost: {
    name: '力量强化',
    description: '攻击力提升',
    base: { atkPercent: 0.10 },
    perLevel: { atkPercent: 0.05 },
  },

  crit_boost: {
    name: '暴击专注',
    description: '暴击率提升',
    base: { critChance: 0.05 },
    perLevel: { critChance: 0.03 },
  },

  hp_boost: {
    name: '生命之泉',
    description: '最大生命提升',
    base: { maxHpPercent: 0.10 },
    perLevel: { maxHpPercent: 0.05 },
  },

  gold_boost: {
    name: '淘金术',
    description: '金币获取提升',
    base: { goldMultiplier: 0.15 },
    perLevel: { goldMultiplier: 0.10 },
  },

  lifesteal: {
    name: '吸血之触',
    description: '获得吸血',
    base: { lifesteal: 0.03 },
    perLevel: { lifesteal: 0.02 },
  },

  thorns: {
    name: '荆棘护甲',
    description: '反伤提升',
    base: { thorns: 3 },
    perLevel: { thorns: 2 },
  },
};

/** @type {string[]} All buff type IDs */
export const BUFF_IDS = ['atk_boost', 'crit_boost', 'hp_boost', 'gold_boost', 'lifesteal', 'thorns'];
