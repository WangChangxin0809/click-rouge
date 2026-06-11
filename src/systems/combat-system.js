/**
 * Combat System — Processes click attacks from the click queue.
 *
 * Each frame, consumes one click from STATE.clickQueue and resolves it
 * against the nearest alive enemy within range (200px). Handles critical
 * hit rolls, damage application, enemy death, and gold/score rewards.
 *
 * Edge cases handled:
 *   - No enemies on field → emits 'click:miss'
 *   - Click too far from any enemy → emits 'click:miss'
 *   - Empty click queue → no-op
 *   - Enemy died this hit → awards gold, increments killCount
 *
 * Implements: Click Rouge GDD — click-to-attack combat.
 *
 * Usage:
 *   import { updateCombatSystem } from './systems/combat-system.js';
 *   // In main game loop:
 *   updateCombatSystem();
 */

import { STATE } from '../core/game-state.js';
import { events } from '../core/event-bus.js';
import { rng } from '../core/random.js';
import { damageEnemy } from '../entities/enemy.js';

// ---------------------------------------------------------------------------
// Gold award — centralised to apply goldMultiplier
// ---------------------------------------------------------------------------

/**
 * Award gold to the player, applying the current gold multiplier.
 *
 * All gameplay systems that grant gold (combat kills, skill effects,
 * follower kills, projectile kills) MUST use this function so that
 * gold_rush and other gold-multiplier effects work correctly.
 *
 * @param {number} amount - Base gold amount before multiplier
 */
export function awardGold(amount) {
    const multiplier = STATE.player.goldMultiplier || 1.0;
    STATE.player.gold += amount * multiplier;
}

/** Maximum pixel distance from click point to enemy center for a valid hit */
const CLICK_RANGE = 200;

/**
 * Per-frame update.
 *
 * Drains one click from the front of STATE.clickQueue and resolves combat.
 * Safe to call every frame even with an empty queue (no-op).
 */
export function updateCombatSystem() {
    // Nothing to process
    if (STATE.clickQueue.length === 0) return;

    // Consume one click per frame
    const click = STATE.clickQueue.shift();

    // Find alive enemies on the field
    const active = [];
    for (let i = 0; i < STATE.enemies.length; i++) {
        if (STATE.enemies[i].alive) {
            active.push(STATE.enemies[i]);
        }
    }

    // No enemies to hit
    if (active.length === 0) {
        events.emit('click:miss', click);
        return;
    }

    // Find nearest enemy to click point (brute-force — max 50 enemies)
    let nearest = null;
    let nearestDist = Infinity;
    for (let i = 0; i < active.length; i++) {
        const enemy = active[i];
        const dx = enemy.x - click.x;
        const dy = enemy.y - click.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = enemy;
        }
    }

    // Click is too far from any enemy → miss
    if (!nearest || nearestDist > CLICK_RANGE) {
        events.emit('click:miss', click);
        return;
    }

    // --- Hit confirmed: calculate damage ---
    const isCrit = rng.nextFloat(0, 1) < STATE.player.critChance;
    const rawDamage = STATE.player.atk;
    const damage = rawDamage * (isCrit ? STATE.player.critMult : 1.0);

    // Record hit time for flash effect
    nearest.lastHitTime = STATE.elapsedTime;

    // Apply damage to the enemy
    const result = damageEnemy(nearest, damage);

    // Build the payload once for both hit/died events
    // Apply poison_blade extra damage if active
    let bonusDamage = 0;
    if (STATE.player.poisonBladeDamage > 0) {
        bonusDamage = STATE.player.poisonBladeDamage;
        STATE.player.poisonBladeDamage = 0;
        const bonusResult = damageEnemy(nearest, bonusDamage);
        // Merge overkill from bonus damage
        if (bonusResult.killed && !result.killed) {
            result.killed = true;
            result.overkill = bonusResult.overkill;
        } else if (bonusResult.killed) {
            result.overkill += bonusResult.overkill;
        }
    }

    const payload = {
        enemy: nearest,
        damage: damage + bonusDamage,
        isCrit,
        overkill: result.overkill,
        poisonBonus: bonusDamage,
        position: { x: click.x, y: click.y },
    };

    if (result.killed) {
        // Award gold and increment kill count
        awardGold(nearest.gold);
        STATE.killCount++;
        events.emit('enemy:died', payload);
    } else {
        events.emit('enemy:hit', payload);
    }
}
