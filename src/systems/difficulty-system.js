/**
 * Difficulty System — Progressive difficulty scaling based on elapsed time.
 *
 * Provides a continuous difficulty curve that ramps up over the course of a
 * run. All gameplay systems (spawn rate, enemy stats) read the current
 * difficulty multipliers via getDifficulty() and apply them at entity-creation
 * time.
 *
 * Difficulty curve (elapsed time -> base scale):
 *   0–120s:  1.0x (extended warmup — more time to build)
 *   120–300s: linear 1.0x → 1.8x
 *   300–600s: linear 1.8x → 2.5x (cap)
 *   600s+:   2.5x (hard cap, difficulty plateaus)
 *
 * Enemy damage multiplier only grows at 60% of the scale increase, so the
 * player can survive longer without feeling unfairly one-shot:
 *   enemyDamageMultiplier = 1 + (scale - 1) * 0.6
 *
 * Implements: Click Rouge difficulty scaling design (v2 — lowered curve).
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
 * Piecewise-linear curve (v2 — gentler ramp, lower cap):
 *   [0, 120]    → 1.0
 *   [120, 300]  → lerp(1.0, 1.8)
 *   [300, 600]  → lerp(1.8, 2.5)
 *   [600, +inf) → 2.5
 *
 * @param {number} elapsed - Total elapsed run time in seconds
 * @returns {number} Base difficulty scale (>= 1.0)
 */
function _computeScale(elapsed) {
    if (elapsed <= 120) {
        return 1.0;
    }
    if (elapsed <= 300) {
        // 1.0 → 1.8 over 180 seconds
        return 1.0 + (elapsed - 120) / 180 * 0.8;
    }
    if (elapsed <= 600) {
        // 1.8 → 2.5 over 300 seconds
        return 1.8 + (elapsed - 300) / 300 * 0.7;
    }
    // Hard cap at 2.5
    return 2.5;
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
    // Enemy damage grows slower than other stats — only 60% of the scale delta
    _difficulty.enemyDamageMultiplier = 1 + (scale - 1) * 0.6;
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
