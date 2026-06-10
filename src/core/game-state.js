/**
 * GameState — Central, singleton game state object.
 *
 * All gameplay systems read from and write to this shared state.
 * This is NOT reactive — systems must read it each frame (or each event).
 * The state is deliberately plain data; no methods other than reset().
 *
 * Usage:
 *   import { STATE } from './core/game-state.js';
 *   STATE.player.hp -= damage;
 *   if (STATE.player.hp <= 0) { ... }
 */

/**
 * @typedef {Object} PlayerState
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} baseAtk
 * @property {number} gold
 * @property {number} clickAtk    — Damage per click (before multipliers)
 * @property {number} autoAtk     — Passive damage per second
 * @property {number} critChance  — Critical hit chance (0..1)
 * @property {number} critMult    — Critical hit damage multiplier
 * @property {number} atkSpeedMult — Attack speed multiplier (1.0 = normal)
 */

/**
 * @typedef {'start'|'playing'|'rewardPicking'|'gameOver'} GameStatus
 */

// Initial state values — used by reset()
const INITIAL_STATE = {
    /** @type {PlayerState} */
    player: {
        hp: 100,
        maxHp: 100,
        baseAtk: 10,
        gold: 0,
        clickAtk: 10,
        autoAtk: 0,
        critChance: 0.05,
        critMult: 1.5,
        atkSpeedMult: 1.0,

        /** @type {Object[]} Acquired active skills */
        activeSkills: [],

        /** @type {Object[]} Acquired followers */
        activeFollowers: [],

        /** @type {Object[]} Acquired passive buffs */
        passiveBuffs: [],
    },

    /** @type {Object[]} Active enemy entities on the field */
    enemies: [],

    /** @type {Object[]} Active particle/effect entities */
    particles: [],

    /** @type {GameStatus} Current phase of the game */
    gameStatus: 'start',

    /** Time elapsed this run, in seconds */
    elapsedTime: 0,

    /** Current wave number (1-based) */
    wave: 1,

    /** Timer in seconds until the next boss spawn (0 = boss is on field or not yet started) */
    bossTimer: 60,

    /** Total enemies killed this run */
    killCount: 0,

    /** Max wave reached this run (for game-over display) */
    maxWaveReached: 1,
};

/**
 * Deep-clone a simple object tree (JSON-safe only — no functions, no cycles).
 * @param {Object} obj
 * @returns {Object}
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Build the mutable state from the initial template
const _state = deepClone(INITIAL_STATE);

/**
 * Reset the entire game state to initial values.
 * Called at the start of a new run or after game-over restart.
 */
function reset() {
    const fresh = deepClone(INITIAL_STATE);
    Object.assign(_state, fresh);
    // Restore array references
    _state.player = Object.assign(_state.player, fresh.player);
    _state.enemies = [];
    _state.particles = [];
}

// Freeze INITIAL_STATE so no code accidentally mutates the template
Object.freeze(INITIAL_STATE);
Object.freeze(INITIAL_STATE.player);

/**
 * The singleton game state.
 * Mutate directly: `STATE.player.gold += 10;`
 * Reset for new run: `STATE.reset();`
 */
export const STATE = Object.assign(_state, { reset });
