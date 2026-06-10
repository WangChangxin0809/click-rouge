/**
 * Spawn System — Controls enemy wave-based spawning.
 *
 * Spawns enemies from random screen edges at intervals that decrease over
 * time (starting at 2.0s, decaying to a floor of 0.3s). Wave progression
 * is driven by kill count (every 10 kills = new wave). Early waves are
 * slime-only; later waves mix in bat, golem, ghost, and fire_skull.
 *
 * Hard cap: never exceeds 50 active enemies on the field.
 *
 * Enemy movement, timeout damage, and cleanup of dead/expired entities are
 * handled here so the main game loop only needs to call updateSpawnSystem(dt).
 *
 * Implements: Click Rouge GDD — enemy wave spawning.
 *
 * Usage:
 *   import { initSpawnSystem, updateSpawnSystem } from './systems/spawn-system.js';
 *   initSpawnSystem();
 *   // In main game loop:
 *   updateSpawnSystem(dt);
 */

import { STATE } from '../core/game-state.js';
import { events } from '../core/event-bus.js';
import { rng } from '../core/random.js';
import { ENEMY_TYPES } from '../data/enemy-definitions.js';
import { createEnemy, updateEnemy } from '../entities/enemy.js';

// ---------------------------------------------------------------------------
// Tuning constants — all numeric values exposed for designer adjustment
// ---------------------------------------------------------------------------

/** Initial spawn interval in seconds */
const SPAWN_INTERVAL_INITIAL = 2.0;

/** Minimum spawn interval (fastest spawn rate, never goes below this) */
const SPAWN_INTERVAL_MIN = 0.3;

/** How much the spawn interval shrinks per second of elapsed time */
const SPAWN_INTERVAL_DECAY = 0.04;

/** Hard cap on active enemies — spawns are skipped if already at this count */
const MAX_ENEMIES = 50;

/** Number of kills required to advance to the next wave */
const KILLS_PER_WAVE = 10;

/**
 * Enemy type pools by wave (1-based index).
 * Later waves include all earlier types plus harder ones.
 * @type {Array<string[]|null>}
 */
const WAVE_TYPE_POOL = [
    null,                                       // index 0 — unused (waves are 1-based)
    ['slime'],                                  // wave 1  — slime only
    ['slime', 'bat'],                           // wave 2  — slime + bat
    ['slime', 'bat', 'golem'],                  // wave 3  — + golem
    ['slime', 'bat', 'golem', 'ghost'],         // wave 4  — + ghost
    ['slime', 'bat', 'golem', 'ghost', 'fire_skull'],  // wave 5+ — full roster
];

// ---------------------------------------------------------------------------
// Internal state (closure — not stored on STATE for cleanliness)
// ---------------------------------------------------------------------------

/** Accumulated spawn timer in seconds */
let _spawnTimer = 0;

/** Last recorded wave number, used to detect wave transitions */
let _lastWave = 1;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize (or reset) the spawn system.
 *
 * Resets the spawn timer and wave tracking to their initial values.
 * Call once at game start (e.g., after STATE.reset()).
 */
export function initSpawnSystem() {
    _spawnTimer = 0;
    _lastWave = STATE.wave;
}

/**
 * Per-frame update.
 *
 * Performs three operations in order:
 *   1. Update and clean up existing enemies (movement + dead removal).
 *   2. Check and advance wave based on kill count.
 *   3. Attempt to spawn a new enemy if the spawn timer has elapsed.
 *
 * @param {number} dt - Delta time in seconds since last frame
 */
export function updateSpawnSystem(dt) {
    // --- Step 1: Update enemies and remove dead/expired ones ---
    for (let i = STATE.enemies.length - 1; i >= 0; i--) {
        const result = updateEnemy(STATE.enemies[i], dt);
        if (result !== null) {
            // Enemy lifetime expired — deal timeout damage to player
            STATE.player.hp -= result.damage;
            STATE.enemies.splice(i, 1);
        }
    }

    // --- Step 2: Wave progression ---
    const expectedWave = Math.floor(STATE.killCount / KILLS_PER_WAVE) + 1;
    if (expectedWave > _lastWave) {
        _lastWave = expectedWave;
        STATE.wave = expectedWave;
        if (STATE.wave > STATE.maxWaveReached) {
            STATE.maxWaveReached = STATE.wave;
        }
        events.emit('wave:start', { wave: STATE.wave });
    }

    // --- Step 3: Spawn timer ---
    const interval = Math.max(
        SPAWN_INTERVAL_MIN,
        SPAWN_INTERVAL_INITIAL - STATE.elapsedTime * SPAWN_INTERVAL_DECAY
    );

    _spawnTimer += dt;
    if (_spawnTimer < interval) return;

    // Reset timer, carrying over any excess to avoid drift
    _spawnTimer -= interval;

    // Hard cap — skip spawn if the field is full
    if (STATE.enemies.length >= MAX_ENEMIES) return;

    // Select enemy type for the current wave
    const typeId = _pickEnemyType(STATE.wave);
    if (!typeId) return;

    // Create and register the enemy
    const enemy = createEnemy(typeId, ENEMY_TYPES);
    STATE.enemies.push(enemy);
    events.emit('enemy:spawned', enemy);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Pick a random enemy type weighted by the current wave.
 *
 * The first type in a wave's pool is most common, the last is rarest.
 * For example, wave 3 pool is ['slime', 'bat', 'golem']:
 *   slime: weight 3, bat: weight 2, golem: weight 1
 *   → slime ~50%, bat ~33%, golem ~17%
 *
 * @param {number} wave - Current wave number (1-based)
 * @returns {string|null} A type ID, or null if no types are available
 */
function _pickEnemyType(wave) {
    // Clamp wave to the last defined pool entry (wave 3+ uses pool[3])
    const poolIndex = Math.min(wave, WAVE_TYPE_POOL.length - 1);
    const pool = WAVE_TYPE_POOL[poolIndex];
    if (!pool || pool.length === 0) return null;

    // Build a weighted array where earlier entries in the pool repeat more
    const weighted = [];
    for (let i = 0; i < pool.length; i++) {
        const weight = pool.length - i;  // more weight for earlier types
        for (let w = 0; w < weight; w++) {
            weighted.push(pool[i]);
        }
    }

    return rng.pickOne(weighted);
}
