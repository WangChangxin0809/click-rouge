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
 * Bosses spawn independently: first boss at 20s, subsequent at 30-50s. Boss entities
 * coexist in STATE.enemies and are distinguished by their `isBoss` flag.
 * In the update loop, bosses are routed through updateBoss() (which handles
 * special behavior modes) while regular enemies use updateEnemy().
 *
 * Implements: Click Rouge GDD — enemy wave spawning + boss system.
 *
 * Usage:
 *   import { initSpawnSystem, updateSpawnSystem } from './systems/spawn-system.js';
 *   initSpawnSystem();
 *   // In main game loop:
 *   updateSpawnSystem(dt);
 */

import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../core/constants.js';
import { STATE } from '../core/game-state.js';
import { events } from '../core/event-bus.js';
import { rng } from '../core/random.js';
import { ENEMY_TYPES } from '../data/enemy-definitions.js';
import { BOSS_TIERS } from '../data/boss-definitions.js';
import { createEnemy, updateEnemy } from '../entities/enemy.js';
import { createBoss, updateBoss } from '../entities/boss.js';
import { getDifficulty } from './difficulty-system.js';

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

/** Minimum boss spawn interval in seconds (subsequent spawns) */
const BOSS_TIMER_MIN = 30;

/** Maximum boss spawn interval in seconds (subsequent spawns) */
const BOSS_TIMER_MAX = 50;

/** Min number of minions spawned per 'boss:summon' event */
const BOSS_SUMMON_MINION_COUNT_MIN = 2;

/** Max number of minions spawned per 'boss:summon' event */
const BOSS_SUMMON_MINION_COUNT_MAX = 3;

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
// Module-level: listen for boss summon events
// ---------------------------------------------------------------------------

/**
 * When a summon-type boss emits 'boss:summon', spawn 2-3 slime minions
 * near the boss's current position. Minions respect the active-enemy cap.
 */
events.on('boss:summon', ({ x, y }) => {
    const diff = getDifficulty();
    const count = rng.nextInt(BOSS_SUMMON_MINION_COUNT_MIN, BOSS_SUMMON_MINION_COUNT_MAX);
    for (let i = 0; i < count; i++) {
        if (STATE.enemies.length >= MAX_ENEMIES) break;

        const minion = createEnemy('slime', ENEMY_TYPES);
        // Apply difficulty scaling so summoned minions match concurrent enemies
        minion.hp *= diff.enemyHpMultiplier;
        minion.maxHp = minion.hp;
        minion.speed *= diff.enemySpeedMultiplier;
        minion.damage *= diff.enemyDamageMultiplier;

        // Position near the boss with slight scatter
        minion.x = x + rng.nextFloat(-50, 50);
        minion.y = y + rng.nextFloat(-50, 50);

        // Recompute direction toward center from the minion's new position
        const cx = DESIGN_WIDTH / 2;
        const cy = DESIGN_HEIGHT / 2;
        const ddx = cx - minion.x;
        const ddy = cy - minion.y;
        const len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        minion.dirX = ddx / len;
        minion.dirY = ddy / len;

        STATE.enemies.push(minion);
        events.emit('enemy:spawned', minion);
    }
});

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
 * Performs four operations in order:
 *   1. Update and clean up existing enemies (movement + dead removal).
 *      Bosses are routed through updateBoss(); regular enemies through updateEnemy().
 *   2. Check and advance wave based on kill count.
 *   3. Attempt to spawn a new enemy if the spawn timer has elapsed.
 *   4. Decrement boss timer and spawn a boss when it reaches zero.
 *
 * @param {number} dt - Delta time in seconds since last frame
 */
export function updateSpawnSystem(dt) {
    // --- Step 1: Update enemies and remove dead/expired ones ---
    // Bosses use updateBoss (handles special behaviors); regular enemies use updateEnemy.
    for (let i = STATE.enemies.length - 1; i >= 0; i--) {
        const enemy = STATE.enemies[i];
        const result = enemy.isBoss
            ? updateBoss(enemy, dt)
            : updateEnemy(enemy, dt);

        if (result !== null) {
            // Enemy/boss lifetime expired — deal timeout damage
            events.emit('player:damaged', { damage: result.damage, source: 'enemy_timeout', enemy });
            STATE.player.hp -= result.damage;
            if (enemy.isBoss) {
                events.emit('boss:died', enemy);
            }
            STATE.enemies.splice(i, 1);
            continue;
        }
        // Remove enemies killed by combat system (hp <= 0) or otherwise marked dead
        if (!enemy.alive || enemy.hp <= 0) {
            if (enemy.isBoss) {
                events.emit('boss:died', enemy);
            }
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
    const diff = getDifficulty();
    const interval = Math.max(
        SPAWN_INTERVAL_MIN,
        (SPAWN_INTERVAL_INITIAL - STATE.elapsedTime * SPAWN_INTERVAL_DECAY) / diff.spawnRateMultiplier,
    );

    _spawnTimer += dt;
    if (_spawnTimer >= interval) {
        // Reset timer, carrying over any excess to avoid drift
        _spawnTimer -= interval;

        // Hard cap — skip spawn if the field is full
        if (STATE.enemies.length < MAX_ENEMIES) {
            // Select enemy type for the current wave
            const typeId = _pickEnemyType(STATE.wave);
            if (typeId) {
                // Create and register the enemy
                const enemy = createEnemy(typeId, ENEMY_TYPES);
                enemy.hp *= diff.enemyHpMultiplier;
                enemy.maxHp = enemy.hp;
                enemy.speed *= diff.enemySpeedMultiplier;
                enemy.damage *= diff.enemyDamageMultiplier;
                STATE.enemies.push(enemy);
                events.emit('enemy:spawned', enemy);
            }
        }
    }

    // --- Step 4: Boss spawn timer (runs every frame, independent of enemy spawn timer) ---
    STATE.bossTimer -= dt;
    if (STATE.bossTimer <= 0) {
        // Only spawn if no boss is currently on the field and the cap isn't reached
        const hasActiveBoss = STATE.enemies.some(e => e.isBoss === true);
        if (!hasActiveBoss && STATE.enemies.length < MAX_ENEMIES) {
            // Select boss tier based on elapsed time: tier 1 before 2 min, tier 2 after
            const tier = STATE.elapsedTime < 120 ? 1 : 2;
            const tierPool = BOSS_TIERS[tier] || [];
            const bossTypeId = rng.pickOne(tierPool);
            if (bossTypeId) {
                const boss = createBoss(bossTypeId);

                // Apply difficulty multipliers (same as regular enemies)
                boss.hp *= diff.enemyHpMultiplier;
                boss.maxHp = boss.hp;
                boss.speed *= diff.enemySpeedMultiplier;
                boss.damage *= diff.enemyDamageMultiplier;

                STATE.enemies.push(boss);
                events.emit('boss:spawned', boss);
            }
        }

        // Reset boss timer to a random interval between 30 and 50 seconds
        STATE.bossTimer = rng.nextFloat(BOSS_TIMER_MIN, BOSS_TIMER_MAX);
    }
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
