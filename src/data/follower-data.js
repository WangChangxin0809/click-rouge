/**
 * Follower Data — Unified registry of all follower types.
 *
 * Each follower type has:
 *   - label / color / size: display properties
 *   - attackInterval / range / projectileSpeed / healInterval: constants
 *   - base:   stat values at level 1
 *   - perLevel: additional stats per level beyond 1
 *
 * Effective stats are computed by scaleStats(base, perLevel, level).
 *
 * Merged from: follower-data.js + follower-definitions.js
 * Deleted:     follower-definitions.js
 *
 * Design Doc: Unified Level System — Follower Data
 *
 * Usage:
 *   import { FOLLOWERS } from '../data/follower-data.js';
 *   const def = FOLLOWERS['knight'];
 */

/**
 * @typedef {Object} FollowerDef
 * @property {string} label - Display name
 * @property {string} color - CSS fill color for rendering
 * @property {number} size - Draw size in logical pixels
 * @property {number} [attackInterval] - Seconds between attacks (combat types)
 * @property {number} [range] - Attack range in logical pixels (combat types)
 * @property {number} [projectileSpeed] - Projectile speed in px/s (archer)
 * @property {number} [healInterval] - Seconds between heals (healer_fairy)
 * @property {number} [pickupRangeBonus] - Pickup range bonus (gold_magnet) — scaled
 * @property {Object<string, number>} base - Stats at level 1
 * @property {Object<string, number>} perLevel - Stat increment per level
 */

/** @type {Object<string, FollowerDef>} */
export const FOLLOWERS = {
  knight: {
    label: '骑士',
    color: '#cc4444',
    size: 18,
    attackInterval: 1.5,
    range: 300,
    base: { damage: 10 },
    perLevel: { damage: 5 },
  },

  archer: {
    label: '弓箭手',
    color: '#44cc44',
    size: 16,
    attackInterval: 2.0,
    range: 600,
    projectileSpeed: 400,
    base: { damage: 6 },
    perLevel: { damage: 4 },
  },

  healer_fairy: {
    label: '治愈精灵',
    color: '#ff88cc',
    size: 14,
    healInterval: 1.0,
    base: { healAmount: 2 },
    perLevel: { healAmount: 1 },
  },

  gold_magnet: {
    label: '金币磁铁',
    color: '#ffdd44',
    size: 16,
    base: { pickupRangeBonus: 60 },
    perLevel: { pickupRangeBonus: 40 },
  },
};

/** @type {string[]} All follower type IDs */
export const FOLLOWER_IDS = ['knight', 'archer', 'healer_fairy', 'gold_magnet'];
