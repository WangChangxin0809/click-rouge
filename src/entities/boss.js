/**
 * Boss Entity — Pure functions for creating and updating boss enemies.
 *
 * Bosses are extended enemy objects with an `isBoss` flag, a `behavior`
 * field controlling their AI pattern, and special phase tracking.
 *
 * Three behavior types:
 *   - charge:  Rush toward center at 2x speed for 3s, then emit boss:charge and shake.
 *   - summon:  Drift toward center, emit boss:summon every 3s to spawn minions.
 *   - zigzag:  Sine-wave horizontal movement, slow vertical descent (shmup-style).
 *
 * All functions are stateless — callers wire return values into the global STATE.
 *
 * @implements Click Rouge GDD — Boss system (see design docs)
 *
 * Usage:
 *   import { createBoss, updateBoss } from '../entities/boss.js';
 *   const boss = createBoss('giant_slime');
 *   STATE.enemies.push(boss);
 *
 *   const result = updateBoss(boss, dt);
 *   if (result) { STATE.player.hp -= result.damage; }
 */

import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../core/constants.js';
import { rng } from '../core/random.js';
import { events } from '../core/event-bus.js';
import { BOSS_TYPES } from '../data/boss-definitions.js';

// ---------------------------------------------------------------------------
// Auto-incrementing boss ID
// ---------------------------------------------------------------------------

/** @type {number} Monotonically increasing ID counter — never reset */
let _nextBossId = 1;

// ---------------------------------------------------------------------------
// createBoss
// ---------------------------------------------------------------------------

/**
 * Spawn a new boss of the given type at a random position just outside the
 * screen, drifting toward the center.
 *
 * Uses the same edge-spawning logic as createEnemy (random edge, placed just
 * outside the visible area) but with a larger margin (size + 30) so the boss's
 * larger body is fully off-screen at spawn.
 *
 * @param {string} typeId - Key into BOSS_TYPES (e.g. 'giant_slime')
 * @returns {Object}
 *   { id, typeId, hp, maxHp, speed, damage, gold, size, color, lifetime,
 *     x, y, dirX, dirY, alive: true, timer: 0,
 *     isBoss: true, behavior, tier, summonTimer: 0, phase: 'entering',
 *     _chargeTimer: 0 }
 */
export function createBoss(typeId) {
    const def = BOSS_TYPES[typeId];
    if (!def) {
        throw new Error(`createBoss: unknown boss type "${typeId}"`);
    }

    const id = _nextBossId++;

    // -- Pick a random edge (zigzag restricted to top only) ------------------
    // zigzag bosses descend slowly and would leave the screen if spawned from
    // the bottom or sides — restrict to top edge (0) only.
    const edge = def.behavior === 'zigzag' ? 0 : rng.nextInt(0, 3); // 0=top, 1=right, 2=bottom, 3=left
    const margin = def.size + 30;   // Larger margin than regular enemies for dramatic entrance

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

    // -- Direction toward screen center ---------------------------------------
    const cx = DESIGN_WIDTH / 2;
    const cy = DESIGN_HEIGHT / 2;
    const dx = cx - x;
    const dy = cy - y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
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
        // Boss-specific fields
        isBoss: true,
        behavior: def.behavior,
        tier: def.tier,
        summonTimer: 0,
        phase: 'entering',
        _chargeTimer: 0,
    };
}

// ---------------------------------------------------------------------------
// updateBoss
// ---------------------------------------------------------------------------

/**
 * Advance boss state by `dt` seconds, executing the boss's behavior pattern.
 *
 * Behavior modes:
 *
 *   charge — First 3 seconds: rush toward center at 2x speed (phase 'entering').
 *            After 3s: emit 'boss:charge' once, then shake in place with slow drift.
 *
 *   summon — Straight-line drift toward center. Every 3 seconds emit 'boss:summon'
 *            with the boss's current position (spawn-system listens and creates minions).
 *
 *   zigzag — Horizontal sine-wave oscillation (frequency = 4 rad/s) combined with
 *            slow vertical descent (0.3x speed). No center-seeking — behaves like a
 *            shmup boss drifting downward.
 *
 * Does NOT check or modify `alive` — callers should read the return value
 * and handle removal.
 *
 * @param {Object} boss - Boss entity as returned by createBoss()
 * @param {number} dt - Delta time in seconds
 * @returns {Object|null}
 *   - `null` if the boss is still alive and within its lifetime.
 *   - `{ timedOut: true, damage: number }` if the boss has exceeded its lifetime.
 */
export function updateBoss(boss, dt) {
    // Advance lifetime timer (shared across all behaviors)
    boss.timer += dt;

    switch (boss.behavior) {

        // -----------------------------------------------------------------------
        // charge — Rush the center, then shake
        // -----------------------------------------------------------------------
        case 'charge': {
            boss._chargeTimer += dt;

            if (boss._chargeTimer <= 3) {
                // Entering phase: charge toward center at 2x speed
                boss.x += boss.speed * 2 * boss.dirX * dt;
                boss.y += boss.speed * 2 * boss.dirY * dt;
            } else {
                // Post-charge: emit 'boss:charge' exactly once on transition
                if (boss.phase === 'entering') {
                    boss.phase = 'active';
                    events.emit('boss:charge', { x: boss.x, y: boss.y });
                }
                // Shake: small random displacement each frame
                boss.x += rng.nextFloat(-1, 1) * 2;
                // Slow residual drift toward center
                boss.x += boss.speed * 0.3 * boss.dirX * dt;
                boss.y += boss.speed * 0.3 * boss.dirY * dt;
            }
            break;
        }

        // -----------------------------------------------------------------------
        // summon — Drift and spawn minions periodically
        // -----------------------------------------------------------------------
        case 'summon': {
            // Straight-line drift toward center
            boss.x += boss.speed * boss.dirX * dt;
            boss.y += boss.speed * boss.dirY * dt;

            // Summon minions every 3 seconds
            boss.summonTimer += dt;
            if (boss.summonTimer >= 3) {
                boss.summonTimer -= 3;
                events.emit('boss:summon', { x: boss.x, y: boss.y });
            }
            break;
        }

        // -----------------------------------------------------------------------
        // zigzag — Sine-wave horizontal + slow vertical descent
        // -----------------------------------------------------------------------
        case 'zigzag': {
            // Initialize base X on first frame for smooth oscillation around
            // the spawn position
            if (boss._zigzagBaseX === undefined) {
                boss._zigzagBaseX = boss.x;
            }

            // Horizontal: sine wave around base X with configurable amplitude
            const amplitude = boss.amplitude || 120;
            boss.x = boss._zigzagBaseX + Math.sin(boss.timer * 4) * amplitude;

            // Vertical: slow descent (0.3x speed, ignores dirY)
            boss.y += boss.speed * 0.3 * dt;
            break;
        }

        // -----------------------------------------------------------------------
        // Fallback — treat as regular straight-line enemy movement
        // -----------------------------------------------------------------------
        default: {
            boss.x += boss.speed * boss.dirX * dt;
            boss.y += boss.speed * boss.dirY * dt;
            break;
        }
    }

    // Lifetime timeout — boss "escaped"
    if (boss.timer >= boss.lifetime) {
        return { timedOut: true, damage: boss.damage };
    }

    return null;
}
