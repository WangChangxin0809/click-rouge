/**
 * Difficulty System — Progressive difficulty scaling based on elapsed time.
 *
 * Provides a continuous difficulty curve that ramps up over the course of a
 * run. All gameplay systems (spawn rate, enemy stats) read the current
 * difficulty multipliers via getDifficulty() and apply them at entity-creation
 * time.
 *
 * Difficulty curve (elapsed time -> base scale):
 *   0–60s:   1.0x (warmup — player gets settled)
 *   60–180s: linear 1.0x → 2.0x
 *   180–300s: linear 2.0x → 3.5x
 *   300–420s: linear 3.5x → 5.0x (cap)
 *   420s+:   5.0x (hard cap, difficulty plateaus)
 *
 * Each multiplier field can be tuned independently by the designer.
 * For the initial implementation all four fields track the base scale,
 * but individual override functions (e.g. setEnemyHpCurve) can be added
 * later without changing any consuming code.
 *
 * Implements: Click Rouge difficulty scaling design.
 *
 * Usage:
 *   import { updateDifficulty, getDifficulty } from './systems/difficulty-system.js';
 *   // In main game loop:
 *   updateDifficulty(dt);
 *   // In spawn system or anywhere that needs scaling:
 *   const diff = getDifficulty();
 *   enemy.hp *= diff.enemyHpMultiplier;
 */

import { STATE } from '../core/game-state.js';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/**
 * Internal cached difficulty object.
 * Updated once per frame by updateDifficulty().
 * @type {{ enemyHpMultiplier: number, enemySpeedMultiplier: number, spawnRateMultiplier: number, enemyDamageMultiplier: number, scale: number }}
 */
const _difficulty = {
    enemyHpMultiplier: 1.0,
    enemySpeedMultiplier: 1.0,
    spawnRateMultiplier: 1.0,
    enemyDamageMultiplier: 1.0,
    /** The raw base difficulty scale (before per-field tweaks). Exposed for debug/HUD. */
    scale: 1.0,
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Compute the base difficulty scale from elapsed time.
 *
 * Piecewise-linear curve:
 *   [0, 60]     → 1.0
 *   [60, 180]   → lerp(1.0, 2.0)
 *   [180, 300]  → lerp(2.0, 3.5)
 *   [300, 420]  → lerp(3.5, 5.0)
 *   [420, +inf) → 5.0
 *
 * @param {number} elapsed - Total elapsed run time in seconds
 * @returns {number} Base difficulty scale (>= 1.0)
 */
function _computeScale(elapsed) {
    if (elapsed <= 60) {
        return 1.0;
    }
    if (elapsed <= 180) {
        // 1.0 → 2.0 over 120 seconds
        return 1.0 + (elapsed - 60) / 120 * 1.0;
    }
    if (elapsed <= 300) {
        // 2.0 → 3.5 over 120 seconds
        return 2.0 + (elapsed - 180) / 120 * 1.5;
    }
    if (elapsed <= 420) {
        // 3.5 → 5.0 over 120 seconds
        return 3.5 + (elapsed - 300) / 120 * 1.5;
    }
    // Hard cap at 5.0
    return 5.0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Update the difficulty multipliers for the current frame.
 *
 * Should be called once per frame from the main game loop, before any
 * system that reads difficulty (spawn, combat, etc.).
 *
 * @param {number} dt - Delta time in seconds (unused currently; reserved for
 *   future per-frame difficulty events like spike phases).
 */
export function updateDifficulty(dt) {
    const scale = _computeScale(STATE.elapsedTime);
    _difficulty.scale = scale;
    _difficulty.enemyHpMultiplier = scale;
    _difficulty.enemySpeedMultiplier = scale;
    _difficulty.spawnRateMultiplier = scale;
    _difficulty.enemyDamageMultiplier = scale;
}

/**
 * Return a reference to the current difficulty object.
 *
 * CAUTION: The returned object is the live internal cache — do not mutate it.
 * Read multipliers each frame (or at entity-creation time) and apply locally.
 *
 * @returns {{ enemyHpMultiplier: number, enemySpeedMultiplier: number, spawnRateMultiplier: number, enemyDamageMultiplier: number, scale: number }}
 */
export function getDifficulty() {
    return _difficulty;
}
