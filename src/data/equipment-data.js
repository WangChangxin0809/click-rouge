/**
 * Equipment Data — Simplified registry: one item per slot, scales with level.
 *
 * Each equipment type has:
 *   - base:     stats at level 1
 *   - perLevel: additional stats per level beyond 1
 *   - names:    display name thresholds (cosmetic only)
 *
 * Effective stats = scaleStats(base, perLevel, level).
 *
 * Slots: weapon (1), armor (1), accessory (1) = 3 total.
 *
 * Usage:
 *   import { EQUIPMENT } from '../data/equipment-data.js';
 *   const def = EQUIPMENT['weapon'];
 */

/** @type {Object<string, Object>} */
export const EQUIPMENT = {
  weapon: {
    name: '短剑',
    slot: 'weapon',
    base:     { atk: 5 },
    perLevel: { atk: 5 },
    names: [
      { minLevel: 1,  name: '短剑' },
      { minLevel: 5,  name: '铁剑' },
      { minLevel: 10, name: '附魔利刃' },
      { minLevel: 15, name: '传说之刃' },
    ],
  },
  armor: {
    name: '皮背心',
    slot: 'armor',
    base:     { maxHp: 15 },
    perLevel: { maxHp: 10 },
    names: [
      { minLevel: 1,  name: '皮背心' },
      { minLevel: 5,  name: '锁子甲' },
      { minLevel: 10, name: '板甲' },
      { minLevel: 15, name: '龙鳞甲' },
    ],
  },
  accessory: {
    name: '铜戒指',
    slot: 'accessory',
    base:     { goldMultiplier: 0.10 },
    perLevel: { goldMultiplier: 0.05 },
    names: [
      { minLevel: 1,  name: '铜戒指' },
      { minLevel: 5,  name: '银护符' },
      { minLevel: 10, name: '红宝石坠饰' },
      { minLevel: 15, name: '凤凰之羽' },
    ],
  },
};
