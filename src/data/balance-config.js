/**
 * Balance Config — All tunable numeric constants for the game.
 *
 * Designers can tweak these values without touching any gameplay code.
 * Every gameplay system should import from here rather than hardcoding
 * magic numbers.
 *
 * Usage:
 *   import { BALANCE } from '../data/balance-config.js';
 */

/** @type {Object<string, number>} */
export const BALANCE = {
    /** Player initial HP */
    PLAYER_INITIAL_HP: 100,

    /** Player initial base attack */
    PLAYER_INITIAL_ATK: 10,

    /** Player initial crit chance (0.05 = 5%) */
    PLAYER_INITIAL_CRIT_CHANCE: 0.05,

    /** Player initial crit damage multiplier */
    PLAYER_INITIAL_CRIT_MULT: 1.5,

    /** Player initial attack speed multiplier (1.0 = normal) */
    PLAYER_INITIAL_ATK_SPEED_MULT: 1.0,

    /** Maximum number of simultaneous enemies on screen */
    MAX_ENEMIES: 50,

    /** Maximum number of simultaneous particles */
    MAX_PARTICLES: 500,

    /** Maximum number of equipped active skills */
    MAX_SKILL_SLOTS: 4,

    /** Maximum number of active followers */
    MAX_FOLLOWERS: 5,

    /** Base interval in seconds between boss spawns */
    BOSS_INTERVAL_BASE: 60,

    /** Random offset range in seconds added to boss interval */
    BOSS_INTERVAL_RANDOM: 30,

    /** Base lifetime in seconds for normal enemies */
    ENEMY_LIFETIME_BASE: 12,

    /** Base gold multiplier (1.0 = normal) */
    GOLD_MULTIPLIER_BASE: 1.0,

    /** Maximum difficulty scaling multiplier */
    DIFFICULTY_CAP: 5.0,

    /** Time in seconds to reach maximum difficulty */
    DIFFICULTY_RAMP_TIME: 420,
};
