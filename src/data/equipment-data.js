/**
 * Equipment Data — Flat registry of all equippable item types.
 *
 * Each equipment type has:
 *   - base:   stats at level 1
 *   - perLevel: additional stats per level beyond 1
 *
 * Effective stats are computed by scaleStats(base, perLevel, level).
 *
 * Slots: weapon (4 types), armor (4 types), accessory (4 types) = 12 total.
 *
 * Design Doc: Unified Level System — Equipment Data
 *
 * Usage:
 *   import { EQUIPMENT } from '../data/equipment-data.js';
 *   const def = EQUIPMENT['rusty_sword'];
 */

/**
 * @typedef {Object} EquipmentDef
 * @property {string} name - Display name
 * @property {'weapon'|'armor'|'accessory'} slot - Equip slot
 * @property {Object<string, number>} base - Stats at level 1
 * @property {Object<string, number>} perLevel - Stat increment per level
 */

/** @type {Object<string, EquipmentDef>} */
export const EQUIPMENT = {
  // ---------------------------------------------------------------------------
  // Weapons (4 types)
  // ---------------------------------------------------------------------------
  rusty_sword: {
    name: '生锈短剑',
    slot: 'weapon',
    base: { atk: 5 },
    perLevel: { atk: 5 },
  },
  iron_blade: {
    name: '铁制长剑',
    slot: 'weapon',
    base: { atk: 8, critChance: 0.03 },
    perLevel: { atk: 4, critChance: 0.02 },
  },
  enchanted_blade: {
    name: '附魔利刃',
    slot: 'weapon',
    base: { atk: 12, critChance: 0.05 },
    perLevel: { atk: 6, critChance: 0.03 },
  },
  legendary_blade: {
    name: '传说之刃',
    slot: 'weapon',
    base: { atk: 20, critChance: 0.08, critMult: 0.15 },
    perLevel: { atk: 8, critChance: 0.03, critMult: 0.10 },
  },

  // ---------------------------------------------------------------------------
  // Armor (4 types)
  // ---------------------------------------------------------------------------
  leather_vest: {
    name: '皮背心',
    slot: 'armor',
    base: { maxHp: 15 },
    perLevel: { maxHp: 10 },
  },
  chainmail: {
    name: '锁子甲',
    slot: 'armor',
    base: { maxHp: 20, thorns: 2 },
    perLevel: { maxHp: 10, thorns: 2 },
  },
  plate_armor: {
    name: '板甲',
    slot: 'armor',
    base: { maxHp: 30, thorns: 4 },
    perLevel: { maxHp: 15, thorns: 3 },
  },
  dragon_scale: {
    name: '龙鳞甲',
    slot: 'armor',
    base: { maxHp: 50, thorns: 6, maxHpPercent: 0.05 },
    perLevel: { maxHp: 20, thorns: 4, maxHpPercent: 0.03 },
  },

  // ---------------------------------------------------------------------------
  // Accessories (4 types)
  // ---------------------------------------------------------------------------
  copper_ring: {
    name: '铜戒指',
    slot: 'accessory',
    base: { goldMultiplier: 0.10 },
    perLevel: { goldMultiplier: 0.05 },
  },
  silver_amulet: {
    name: '银护符',
    slot: 'accessory',
    base: { goldMultiplier: 0.10, atkSpeedMult: 0.05 },
    perLevel: { goldMultiplier: 0.05, atkSpeedMult: 0.03 },
  },
  ruby_pendant: {
    name: '红宝石坠饰',
    slot: 'accessory',
    base: { goldMultiplier: 0.15, atkSpeedMult: 0.05, critChance: 0.03 },
    perLevel: { goldMultiplier: 0.05, atkSpeedMult: 0.05, critChance: 0.02 },
  },
  phoenix_feather: {
    name: '凤凰之羽',
    slot: 'accessory',
    base: { goldMultiplier: 0.20, atkSpeedMult: 0.10, critChance: 0.05, lifesteal: 0.03 },
    perLevel: { goldMultiplier: 0.05, atkSpeedMult: 0.05, critChance: 0.03, lifesteal: 0.02 },
  },
};

/**
 * Convenience: list of equipment typeIds grouped by slot.
 * @type {Object<string, string[]>}
 */
export const EQUIPMENT_SLOTS = {
  weapon: ['rusty_sword', 'iron_blade', 'enchanted_blade', 'legendary_blade'],
  armor: ['leather_vest', 'chainmail', 'plate_armor', 'dragon_scale'],
  accessory: ['copper_ring', 'silver_amulet', 'ruby_pendant', 'phoenix_feather'],
};

/** @type {string[]} All equipment slots */
export const EQUIPMENT_SLOT_KEYS = ['weapon', 'armor', 'accessory'];
