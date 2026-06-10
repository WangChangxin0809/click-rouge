/**
 * Follower Definitions — Pure data table for all follower types in Click Rouge.
 *
 * Each entry defines the base parameters for a follower type. These values are
 * consumed by the follower entity functions (src/entities/follower.js).
 *
 * This module imports nothing — it is a pure data file suitable for hot-reload
 * or being replaced by a JSON payload.
 *
 * Usage:
 *   import { FOLLOWER_DEFINITIONS } from '../data/follower-definitions.js';
 *   const def = FOLLOWER_DEFINITIONS['knight'];
 */

/**
 * @typedef {Object} FollowerDef
 * @property {string}   label            - Display name
 * @property {string}   color            - CSS fill color for rendering
 * @property {number}   size             - Draw size in logical pixels
 * @property {number}   [attackInterval] - Seconds between attacks (knight, archer)
 * @property {number}   [damage]         - Damage per attack (knight, archer)
 * @property {number}   [range]          - Attack range in logical pixels (knight, archer)
 * @property {number}   [projectileSpeed] - Projectile speed in px/s (archer)
 * @property {number}   [healInterval]   - Seconds between heals (healer_fairy)
 * @property {number}   [healAmount]     - HP restored per heal (healer_fairy)
 * @property {number}   [pickupRangeBonus] - Bonus gold pickup range (gold_magnet)
 */

/** @type {Object<string, FollowerDef>} */
export const FOLLOWER_DEFINITIONS = {
    knight: {
        label: '骑士',
        color: '#cc4444',
        size: 18,
        attackInterval: 1.5,
        damage: 15,
        range: 300,
    },

    archer: {
        label: '弓箭手',
        color: '#44cc44',
        size: 16,
        attackInterval: 2.0,
        damage: 10,
        range: 600,
        projectileSpeed: 400,
    },

    healer_fairy: {
        label: '治愈精灵',
        color: '#ff88cc',
        size: 14,
        healInterval: 1.0,
        healAmount: 3,
    },

    gold_magnet: {
        label: '金币磁铁',
        color: '#ffdd44',
        size: 16,
        pickupRangeBonus: 100,
    },
};
