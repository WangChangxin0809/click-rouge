/**
 * Follower Entity — Pure functions for creating and updating follower companions.
 *
 * Followers stand at the bottom of the screen in a row and perform periodic
 * actions: knights attack nearby enemies, archers fire projectiles, healer
 * fairies restore HP, and gold magnets increase the gold pickup range.
 *
 * Usage:
 *   import { createFollower, updateFollower, updateAllFollowers } from '../entities/follower.js';
 *   const follower = createFollower('knight', FOLLOWER_DEFINITIONS, 0, 4);
 *   STATE.player.activeFollowers.push(follower);
 *   // In main loop:
 *   updateAllFollowers(dt, STATE.enemies);
 */

import { events } from '../core/event-bus.js';
import { STATE } from '../core/game-state.js';
import { damageEnemy } from './enemy.js';
import { createProjectile } from './projectile.js';
import { awardGold } from '../systems/combat-system.js';

// ---------------------------------------------------------------------------
// Auto-incrementing ID
// ---------------------------------------------------------------------------

/** @type {number} */
let _nextId = 1;

// ---------------------------------------------------------------------------
// createFollower
// ---------------------------------------------------------------------------

/**
 * Create a new follower entity.
 *
 * @param {string} typeId - Key into the follower definitions (e.g. 'knight')
 * @param {Object<string, import('../data/follower-definitions.js').FollowerDef>} definitions
 *   The full follower definitions map (FOLLOWER_DEFINITIONS).
 * @param {number} slotIndex - Position index (0-based) among active followers
 * @param {number} totalSlots - Total number of active followers (for horizontal spacing)
 * @returns {Object} Follower entity
 */
export function createFollower(typeId, definitions, slotIndex, totalSlots) {
    const def = definitions[typeId];
    if (!def) {
        throw new Error(`createFollower: unknown follower type "${typeId}"`);
    }

    const id = _nextId++;

    return {
        id,
        typeId,
        color: def.color,
        size: def.size,
        attackInterval: def.attackInterval || 0,
        damage: def.damage || 0,
        range: def.range || 0,
        projectileSpeed: def.projectileSpeed || 0,
        healInterval: def.healInterval || 0,
        healAmount: def.healAmount || 0,
        pickupRangeBonus: def.pickupRangeBonus || 0,
        // Position managed externally by the renderer/layout system
        x: 0,
        y: 0,
        slotIndex,
        totalSlots,
        // Internal timer for attack/heal cooldown
        actionTimer: 0,
    };
}

// ---------------------------------------------------------------------------
// updateFollower
// ---------------------------------------------------------------------------

/**
 * Advance a single follower's state by dt seconds.
 *
 * Handles follower-type-specific behavior:
 *   - knight: attacks nearest enemy within range every attackInterval
 *   - archer: fires projectile at random enemy every attackInterval
 *   - healer_fairy: heals player every healInterval
 *   - gold_magnet: passive (range bonus consumed by economy system)
 *
 * @param {Object} follower - Follower entity as returned by createFollower()
 * @param {number} dt - Delta time in seconds
 * @param {Object[]} enemies - Current enemy array (STATE.enemies)
 */
export function updateFollower(follower, dt, enemies) {
    follower.actionTimer += dt;

    switch (follower.typeId) {
        case 'knight':
            _updateKnight(follower, enemies);
            break;
        case 'archer':
            _updateArcher(follower, enemies);
            break;
        case 'healer_fairy':
            _updateHealerFairy(follower);
            break;
        case 'gold_magnet':
            // Passive — no per-frame action needed
            break;
    }
}

// ---------------------------------------------------------------------------
// updateAllFollowers — convenience for main loop
// ---------------------------------------------------------------------------

/**
 * Update all active followers in STATE.player.activeFollowers.
 *
 * @param {number} dt - Delta time in seconds
 * @param {Object[]} enemies - Current enemy array (STATE.enemies)
 */
export function updateAllFollowers(dt, enemies) {
    const followers = STATE.player.activeFollowers;
    if (!followers || followers.length === 0) return;

    for (let i = 0; i < followers.length; i++) {
        updateFollower(followers[i], dt, enemies);
    }
}

// ---------------------------------------------------------------------------
// Internal: per-type behavior
// ---------------------------------------------------------------------------

/**
 * Knight: attack nearest alive enemy within range.
 * @param {Object} follower
 * @param {Object[]} enemies
 */
function _updateKnight(follower, enemies) {
    if (follower.actionTimer < follower.attackInterval) return;
    follower.actionTimer -= follower.attackInterval;

    // Find nearest alive enemy within range
    let nearest = null;
    let nearestDist = Infinity;
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.alive || e.hp <= 0) continue;

        const dx = e.x - follower.x;
        const dy = e.y - follower.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist && dist <= follower.range) {
            nearestDist = dist;
            nearest = e;
        }
    }

    if (!nearest) return;

    // Apply damage
    const result = damageEnemy(nearest, follower.damage);
    nearest.lastHitTime = STATE.elapsedTime;

    const payload = {
        enemy: nearest,
        damage: follower.damage,
        isCrit: false,
        overkill: result.overkill,
        position: { x: nearest.x, y: nearest.y },
    };

    if (result.killed) {
        STATE.player.gold += nearest.gold;
        STATE.killCount++;
        events.emit('enemy:died', payload);
    } else {
        events.emit('enemy:hit', payload);
    }
}

/**
 * Archer: fire projectile at a random alive enemy.
 * @param {Object} follower
 * @param {Object[]} enemies
 */
function _updateArcher(follower, enemies) {
    if (follower.actionTimer < follower.attackInterval) return;
    follower.actionTimer -= follower.attackInterval;

    // Collect alive enemies
    const alive = [];
    for (let i = 0; i < enemies.length; i++) {
        if (enemies[i].alive && enemies[i].hp > 0) {
            alive.push(enemies[i]);
        }
    }

    if (alive.length === 0) return;

    // Pick a random target
    const target = alive[Math.floor(Math.random() * alive.length)];

    createProjectile(
        follower.x,
        follower.y,
        target,
        follower.damage,
        follower.projectileSpeed,
    );
}

/**
 * Healer Fairy: restore player HP every healInterval.
 * @param {Object} follower
 */
function _updateHealerFairy(follower) {
    if (follower.actionTimer < follower.healInterval) return;
    follower.actionTimer -= follower.healInterval;

    const player = STATE.player;
    if (player.hp >= player.maxHp) return;

    const healed = Math.min(follower.healAmount, player.maxHp - player.hp);
    player.hp += healed;
    events.emit('player:healed', { amount: healed, source: 'healer_fairy' });
}
