/**
 * Enemy Definitions — Pure data table for all enemy types in Click Rouge.
 *
 * Each entry defines the base stats of an enemy type. These values are consumed
 * by the enemy entity functions (src/entities/enemy.js) and can be overridden
 * per-instance by the wave/spawner system.
 *
 * This module imports nothing — it is a pure data file suitable for hot-reload
 * or being replaced by a JSON/REST payload in the future.
 *
 * Usage:
 *   import { ENEMY_TYPES } from '../data/enemy-definitions.js';
 *   const def = ENEMY_TYPES['slime'];
 *   const enemy = createEnemy('slime', ENEMY_TYPES);
 */

/**
 * @typedef {Object} EnemyTypeDef
 * @property {string}   name     - Display name (Chinese)
 * @property {number}   hp       - Base hit points
 * @property {number}   speed    - Movement speed in logical pixels/second
 * @property {number}   damage   - Damage dealt to player on contact/timeout
 * @property {number}   gold     - Gold reward on kill
 * @property {number}   size     - Draw radius in logical pixels
 * @property {string}   color    - CSS fill color
 * @property {number}   lifetime - Max alive time in seconds (timeout = damage)
 */

/** @type {Object<string, EnemyTypeDef>} */
export const ENEMY_TYPES = {
    /* Slow, low-threat starter enemy */
    slime: {
        name: '史莱姆',
        hp: 30,
        speed: 40,
        damage: 10,
        gold: 5,
        size: 25,
        color: '#4ecca3',
        lifetime: 12,
    },

    /* Fast, fragile flanker — zips across the screen quickly */
    bat: {
        name: '蝙蝠',
        hp: 20,
        speed: 80,
        damage: 8,
        gold: 8,
        size: 20,
        color: '#8b5cf6',
        lifetime: 8,
    },

    /* Tanky bruiser — high HP, high damage, very slow */
    golem: {
        name: '石魔像',
        hp: 80,
        speed: 20,
        damage: 20,
        gold: 15,
        size: 40,
        color: '#78716c',
        lifetime: 15,
    },

    /* Speed-demon glass cannon — lowest HP, highest speed, short lifetime */
    ghost: {
        name: '幽灵',
        hp: 15,
        speed: 100,
        damage: 6,
        gold: 10,
        size: 18,
        color: '#c4b5fd',
        lifetime: 6,
    },

    /* Balanced mid-tier — moderate everything */
    fire_skull: {
        name: '火焰骷髅',
        hp: 45,
        speed: 50,
        damage: 15,
        gold: 12,
        size: 22,
        color: '#f97316',
        lifetime: 10,
    },
};
