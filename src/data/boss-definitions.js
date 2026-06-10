/**
 * Boss Definitions — Pure data table for all boss types in Click Rouge.
 *
 * Each entry defines the base stats and behavior of a boss type. These values
 * are consumed by the boss entity functions (src/entities/boss.js).
 *
 * BOSS_TIERS maps tier numbers to arrays of type IDs, gating which bosses can
 * appear at different stages of a run:
 *   - Tier 1: first 2 minutes (elapsed < 120s)
 *   - Tier 2: after 2 minutes (elapsed >= 120s)
 *
 * Usage:
 *   import { BOSS_TYPES, BOSS_TIERS } from '../data/boss-definitions.js';
 *   const tier = STATE.elapsedTime < 120 ? 1 : 2;
 *   const typeId = rng.pickOne(BOSS_TIERS[tier]);
 *   const boss = createBoss(typeId);
 */

/**
 * @typedef {Object} BossTypeDef
 * @property {string}   name     - Display name (Chinese)
 * @property {number}   hp       - Base hit points
 * @property {number}   speed    - Movement speed in logical pixels/second
 * @property {number}   damage   - Damage dealt to player on contact/timeout
 * @property {number}   gold     - Gold reward on kill
 * @property {number}   size     - Draw radius in logical pixels
 * @property {string}   color    - CSS fill color
 * @property {number}   lifetime - Max alive time in seconds (timeout = damage)
 * @property {'charge'|'summon'|'zigzag'} behavior - AI behavior pattern
 * @property {number}   tier     - Which tier this boss belongs to (1 or 2)
 */

/** @type {Object<string, BossTypeDef>} */
export const BOSS_TYPES = {
    /* Tier 1 — Charge boss: rushes the center on entry */
    giant_slime: {
        name: '巨型史莱姆',
        hp: 300,
        speed: 15,
        damage: 25,
        gold: 50,
        size: 60,
        color: '#ff6b6b',
        lifetime: 20,
        behavior: 'charge',
        tier: 1,
    },

    /* Tier 2 — Summon boss: periodically spawns slime minions */
    skeleton_king: {
        name: '骷髅王',
        hp: 500,
        speed: 25,
        damage: 30,
        gold: 80,
        size: 50,
        color: '#c0c0c0',
        lifetime: 25,
        behavior: 'summon',
        tier: 2,
    },

    /* Tier 2 — Zigzag boss: sine-wave horizontal, slow vertical descent */
    fire_dragon: {
        name: '火焰龙',
        hp: 400,
        speed: 35,
        damage: 20,
        gold: 100,
        size: 70,
        color: '#ff4500',
        lifetime: 18,
        behavior: 'zigzag',
        tier: 2,
        amplitude: 120,
    },
};

/**
 * Boss availability by tier.
 *
 * Tier 1: first 2 minutes — only giant_slime
 * Tier 2: after 2 minutes — skeleton_king + fire_dragon
 *
 * @type {Object<number, string[]>}
 */
export const BOSS_TIERS = {
    1: ['giant_slime'],
    2: ['skeleton_king', 'fire_dragon'],
};
