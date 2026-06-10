/**
 * Enemy Entity — Pure functions for creating, updating, and damaging enemies.
 *
 * All functions are stateless (aside from a module-level auto-incrementing
 * ID counter). None of them directly mutate the global STATE — callers
 * are responsible for wiring return values into the game state.
 *
 * Implements the design spec: enemies spawn at a random screen edge,
 * drift toward the center, deal damage on lifetime timeout, and return
 * structured damage/kill results for the caller to process.
 *
 * Usage:
 *   import { ENEMY_TYPES } from '../data/enemy-definitions.js';
 *   import { createEnemy, updateEnemy, damageEnemy } from '../entities/enemy.js';
 *   const e = createEnemy('slime', ENEMY_TYPES);
 *   STATE.enemies.push(e);
 *
 *   const timeout = updateEnemy(e, dt);
 *   if (timeout) { STATE.player.hp -= timeout.damage; e.alive = false; }
 *
 *   const result = damageEnemy(e, 12);
 *   if (result.killed) { STATE.player.gold += e.gold; e.alive = false; }
 */

import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../rendering/canvas-renderer.js';
import { rng } from '../core/random.js';

// ---------------------------------------------------------------------------
// Auto-incrementing enemy ID
// ---------------------------------------------------------------------------

/** @type {number} Monotonically increasing ID counter — never reset */
let _nextId = 1;

// ---------------------------------------------------------------------------
// createEnemy
// ---------------------------------------------------------------------------

/**
 * Spawn a new enemy of the given type at a random position just outside the
 * screen, drifting toward the center.
 *
 * The spawning edge (top / bottom / left / right) is chosen randomly.
 * The enemy is placed slightly outside the visible area so the player
 * sees it entering rather than popping in.
 *
 * @param {string} typeId - Key into the definitions map (e.g. 'slime')
 * @param {Object<string, import('../data/enemy-definitions.js').EnemyTypeDef>} definitions
 *   The full enemy definitions map (ENEMY_TYPES).
 * @returns {Object}
 *   { id, typeId, hp, maxHp, speed, damage, gold, size, color, lifetime,
 *     x, y, dirX, dirY, alive: true, timer: 0 }
 *   - dirX/dirY are the normalized direction toward the center (precomputed once).
 */
export function createEnemy(typeId, definitions) {
    const def = definitions[typeId];
    if (!def) {
        throw new Error(`createEnemy: unknown enemy type "${typeId}"`);
    }

    const id = _nextId++;

    // -- Pick a random edge -------------------------------------------------
    const edge = rng.nextInt(0, 3); // 0=top, 1=right, 2=bottom, 3=left
    const margin = def.size + 10;   // Place far enough outside that the circle is not visible

    let x, y;
    switch (edge) {
        case 0: // top
            x = rng.nextFloat(0, DESIGN_WIDTH);
            y = -margin;
            break;
        case 1: // right
            x = DESIGN_WIDTH + margin;
            y = rng.nextFloat(0, DESIGN_HEIGHT);
            break;
        case 2: // bottom
            x = rng.nextFloat(0, DESIGN_WIDTH);
            y = DESIGN_HEIGHT + margin;
            break;
        case 3: // left
        default:
            x = -margin;
            y = rng.nextFloat(0, DESIGN_HEIGHT);
            break;
    }

    // -- Direction toward screen center -------------------------------------
    const cx = DESIGN_WIDTH / 2;
    const cy = DESIGN_HEIGHT / 2;
    const dx = cx - x;
    const dy = cy - y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1; // avoid div-by-zero if spawned at center
    const dirX = dx / len;
    const dirY = dy / len;

    return {
        id,
        typeId,
        hp: def.hp,
        maxHp: def.hp,
        speed: def.speed,
        damage: def.damage,
        gold: def.gold,
        size: def.size,
        color: def.color,
        lifetime: def.lifetime,
        x,
        y,
        dirX,
        dirY,
        alive: true,
        timer: 0,
    };
}

// ---------------------------------------------------------------------------
// updateEnemy
// ---------------------------------------------------------------------------

/**
 * Advance enemy state by `dt` seconds.
 *
 * Moves the enemy toward the screen center at `enemy.speed * dt` pixels
 * per frame (precomputed direction, straight line). Increments the internal
 * lifetime timer.
 *
 * Does NOT check or modify `alive` — callers should read the return value
 * and handle removal.
 *
 * @param {Object} enemy - Enemy entity as returned by createEnemy()
 * @param {number} dt - Delta time in seconds
 * @returns {Object|null}
 *   - `null` if the enemy is still alive and within its lifetime.
 *   - `{ timedOut: true, damage: number }` if the enemy has exceeded its
 *     lifetime. The caller should damage STATE.player by `damage` and
 *     remove this enemy from the field.
 */
export function updateEnemy(enemy, dt) {
    // Movement toward center (straight-line drift, direction fixed at spawn)
    enemy.x += enemy.speed * enemy.dirX * dt;
    enemy.y += enemy.speed * enemy.dirY * dt;

    // Advance lifetime timer
    enemy.timer += dt;

    // Lifetime timeout — enemy "escaped" through the center
    if (enemy.timer >= enemy.lifetime) {
        return { timedOut: true, damage: enemy.damage };
    }

    return null;
}

// ---------------------------------------------------------------------------
// damageEnemy
// ---------------------------------------------------------------------------

/**
 * Apply damage to an enemy.
 *
 * Reduces `enemy.hp` by `damage` and returns a structured result indicating
 * whether the enemy was killed and by how much the final blow exceeded its
 * remaining HP (useful for damage-number displays).
 *
 * Does NOT modify `enemy.alive` — callers should check `result.killed` and
 * handle gold, score, and removal.
 *
 * @param {Object} enemy - Enemy entity with a numeric `hp` field
 * @param {number} damage - Raw damage amount (non-negative)
 * @returns {{ killed: boolean, overkill: number }}
 *   - `killed` — true if HP dropped to 0 or below
 *   - `overkill` — excess damage beyond what was needed (0 if still alive)
 */
export function damageEnemy(enemy, damage) {
    enemy.hp -= damage;

    if (enemy.hp <= 0) {
        const overkill = Math.abs(enemy.hp);
        enemy.hp = 0;
        return { killed: true, overkill };
    }

    return { killed: false, overkill: 0 };
}
