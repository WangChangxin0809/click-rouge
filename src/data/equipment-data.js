/**
 * Equipment Data — All equippable item definitions.
 *
 * Organized by slot (weapon / armor / accessory), each slot has 4 tiers.
 * Equipment is placed into STATE.player.equipSlots when selected as a reward.
 * Higher-tier equipment replaces lower-tier in the same slot.
 *
 * Usage:
 *   import { EQUIPMENT } from '../data/equipment-data.js';
 */

/**
 * @typedef {Object} EquipmentDef
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {number} tier - 1-4, higher = stronger
 * @property {'weapon'|'armor'|'accessory'} slot - Which equip slot it occupies
 * @property {Object} stats - Stat bonuses (any subset of atk, maxHp, critChance,
 *   critMult, goldMultiplier, atkSpeedMult, thorns, lifesteal)
 */

/** @type {Object<string, Object<string, EquipmentDef[]>>} */
export const EQUIPMENT = {
    weapon: [
        {
            id: 'rusty_sword',
            name: '生锈短剑',
            tier: 1,
            slot: 'weapon',
            stats: { atk: 5 },
        },
        {
            id: 'iron_blade',
            name: '铁制长剑',
            tier: 2,
            slot: 'weapon',
            stats: { atk: 12, critChance: 0.05 },
        },
        {
            id: 'enchanted_blade',
            name: '附魔利刃',
            tier: 3,
            slot: 'weapon',
            stats: { atk: 20, critChance: 0.08 },
        },
        {
            id: 'legendary_blade',
            name: '传说之刃',
            tier: 4,
            slot: 'weapon',
            stats: { atk: 35, critChance: 0.12, critMult: 0.3 },
        },
    ],

    armor: [
        {
            id: 'leather_vest',
            name: '皮背心',
            tier: 1,
            slot: 'armor',
            stats: { maxHp: 15 },
        },
        {
            id: 'chainmail',
            name: '锁子甲',
            tier: 2,
            slot: 'armor',
            stats: { maxHp: 30, thorns: 2 },
        },
        {
            id: 'plate_armor',
            name: '板甲',
            tier: 3,
            slot: 'armor',
            stats: { maxHp: 50, thorns: 5 },
        },
        {
            id: 'dragon_scale',
            name: '龙鳞甲',
            tier: 4,
            slot: 'armor',
            stats: { maxHp: 80, thorns: 10, maxHpPercent: 0.10 },
        },
    ],

    accessory: [
        {
            id: 'copper_ring',
            name: '铜戒指',
            tier: 1,
            slot: 'accessory',
            stats: { goldMultiplier: 0.10 },
        },
        {
            id: 'silver_amulet',
            name: '银护符',
            tier: 2,
            slot: 'accessory',
            stats: { goldMultiplier: 0.15, atkSpeedMult: 0.05 },
        },
        {
            id: 'ruby_pendant',
            name: '红宝石坠饰',
            tier: 3,
            slot: 'accessory',
            stats: { goldMultiplier: 0.20, atkSpeedMult: 0.10, critChance: 0.05 },
        },
        {
            id: 'phoenix_feather',
            name: '凤凰之羽',
            tier: 4,
            slot: 'accessory',
            stats: { goldMultiplier: 0.30, atkSpeedMult: 0.15, critChance: 0.10, lifesteal: 0.05 },
        },
    ],
};
