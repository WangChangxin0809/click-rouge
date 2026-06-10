/**
 * Projectile Entity — Pure functions for creating and updating projectiles
 * fired by archer followers.
 *
 * Projectiles fly in a straight line toward their target enemy. When close
 * enough, they apply damage and are removed. If the target dies before
 * arrival, the projectile is removed harmlessly.
 *
 * All projectiles are stored in a module-level array. The update function
 * iterates backwards for safe removal.
 *
 * Usage:
 *   import { createProjectile, updateProjectiles, renderProjectiles } from '../entities/projectile.js';
 *   createProjectile(fromX, fromY, targetEnemy, damage);
 *   // In main loop:
 *   updateProjectiles(dt);
 *   // In render:
 *   renderProjectiles(ctx);
 */

import { damageEnemy } from './enemy.js';
import { events } from '../core/event-bus.js';
import { STATE } from '../core/game-state.js';

// ---------------------------------------------------------------------------
// Auto-incrementing ID
// ---------------------------------------------------------------------------

/** @type {number} */
let _nextId = 1;

// ---------------------------------------------------------------------------
// Module-level projectile storage
// ---------------------------------------------------------------------------

/** @type {Object[]} Active projectiles */
const _projectiles = [];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a projectile flying from (fromX, fromY) toward targetEnemy.
 *
 * @param {number} fromX - Spawn X position (logical pixels)
 * @param {number} fromY - Spawn Y position (logical pixels)
 * @param {Object} targetEnemy - The enemy entity this projectile is aimed at
 * @param {number} damage - Damage to apply on hit
 * @param {number} speed - Travel speed in px/s
 * @returns {Object} The projectile entity
 */
export function createProjectile(fromX, fromY, targetEnemy, damage, speed) {
    const proj = {
        id: _nextId++,
        x: fromX,
        y: fromY,
        targetEnemy,
        damage,
        speed,
        alive: true,
    };
    _projectiles.push(proj);
    return proj;
}

/**
 * Advance all projectiles by dt seconds.
 *
 * Each projectile moves toward its target's current position. When close
 * enough (within 10px), damage is applied and the projectile is removed.
 * If the target is no longer alive, the projectile is removed harmlessly.
 *
 * Must be called once per frame from the game-update path.
 *
 * @param {number} dt - Delta time in seconds
 */
export function updateProjectiles(dt) {
    for (let i = _projectiles.length - 1; i >= 0; i--) {
        const p = _projectiles[i];

        // Target died or became invalid — remove projectile
        if (!p.targetEnemy || !p.targetEnemy.alive || p.targetEnemy.hp <= 0) {
            _projectiles.splice(i, 1);
            continue;
        }

        // Move toward target
        const dx = p.targetEnemy.x - p.x;
        const dy = p.targetEnemy.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= 10) {
            // Hit the target
            const result = damageEnemy(p.targetEnemy, p.damage);
            p.targetEnemy.lastHitTime = STATE.elapsedTime;

            const payload = {
                enemy: p.targetEnemy,
                damage: p.damage,
                isCrit: false,
                overkill: result.overkill,
                position: { x: p.x, y: p.y },
            };

            if (result.killed) {
                STATE.player.gold += p.targetEnemy.gold;
                STATE.killCount++;
                events.emit('enemy:died', payload);
            } else {
                events.emit('enemy:hit', payload);
            }

            _projectiles.splice(i, 1);
        } else {
            // Continue flying toward target
            const nx = dx / dist;
            const ny = dy / dist;
            p.x += nx * p.speed * dt;
            p.y += ny * p.speed * dt;
        }
    }
}

/**
 * Draw all active projectiles to the canvas.
 *
 * Projectiles are rendered as small colored circles. The context MUST already
 * have the design-resolution scale transform applied.
 *
 * @param {CanvasRenderingContext2D} ctx - 2D context (already scaled)
 */
export function renderProjectiles(ctx) {
    if (_projectiles.length === 0) return;

    for (let i = 0; i < _projectiles.length; i++) {
        const p = _projectiles[i];
        ctx.save();
        ctx.fillStyle = '#ffdd44';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

/**
 * Clear all projectiles. Called on game reset / new run.
 */
export function clearProjectiles() {
    _projectiles.length = 0;
}
