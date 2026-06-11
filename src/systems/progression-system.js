/**
 * Progression System — Stat aggregation and recalculation.
 *
 * Reads STATE.player's base values, equipment, active skills, followers,
 * and passive buffs, then computes the effective (actual) stats used by
 * the rest of the game. Call recalculateStats() after any reward is applied.
 *
 * Design Doc: Reward System Phase 5 — Progression Aggregation
 *
 * Usage:
 *   import { recalculateStats } from './systems/progression-system.js';
 *   recalculateStats();
 */

import { STATE } from '../core/game-state.js';
import { BALANCE } from '../data/balance-config.js';

/**
 * Attribute keys that can exist on equipment/skill/follower/buff stat objects.
 * Used to validate and filter stat contributions.
 *
 * @type {Array<'atk'|'atkPercent'|'maxHp'|'maxHpPercent'|'critChance'|'critMult'|
 *   'goldMultiplier'|'atkSpeedMult'|'thorns'|'lifesteal'>}
 */
const FLAT_STAT_KEYS = [
    'atk', 'critChance', 'critMult', 'goldMultiplier',
    'atkSpeedMult', 'thorns', 'lifesteal',
];

const PERCENT_STAT_KEYS = [
    'atkPercent', 'maxHpPercent',
];

const HP_STAT_KEYS = ['maxHp'];

/**
 * Recalculate all effective stats from base values + equipment + buffs + followers.
 *
 * Mutates STATE.player in-place:
 *   - atk = baseAtk + sum(equip.atk) + baseAtk * sum(atkPercent)
 *   - maxHp = SUM(base) + sum(equip.maxHp) + base * sum(maxHpPercent)
 *   - critChance, critMult, goldMultiplier, atkSpeedMult, thorns, lifesteal
 *     are all sum of base + all contributors.
 *   - clickAtk is synced to atk.
 *
 * Note: baseAtk itself is NOT mutated — only the derived stats.
 *
 * @returns {void}
 */
export function recalculateStats() {
    const p = STATE.player;

    // Snapshot runtime skill effect deltas so recalculation doesn't wipe them
    let berserkDelta = 0;
    let goldRushMultiplier = 1.0;
    if (STATE.activeEffects) {
        for (const fx of STATE.activeEffects) {
            if (fx.type === 'berserk' && fx.speedBonus) {
                berserkDelta += fx.speedBonus;
            }
            if (fx.type === 'gold_rush' && fx.goldMultiplier) {
                goldRushMultiplier *= fx.goldMultiplier;
            }
        }
    }

    // --- Gather all contributors ---

    /** @type {Object[]} */
    const allStats = [];

    // Equipment in slots
    if (p.equipSlots) {
        for (const slot of Object.values(p.equipSlots)) {
            if (slot && slot.stats) {
                allStats.push(slot.stats);
            }
        }
    }

    // Passive buffs (multiple stacks possible)
    if (p.passiveBuffs) {
        for (const buff of p.passiveBuffs) {
            if (buff.stats) {
                allStats.push(buff.stats);
            }
        }
    }

    // --- Sum flat and percent bonuses ---

    // Flat sums — always init from BALANCE constants to prevent re-recalc stacking
    let atkFlat = 0;
    let maxHpFlat = 0;
    let critChanceSum = BALANCE.PLAYER_INITIAL_CRIT_CHANCE;
    let critMultSum = BALANCE.PLAYER_INITIAL_CRIT_MULT;
    let goldMultSum = BALANCE.GOLD_MULTIPLIER_BASE;
    let atkSpeedSum = BALANCE.PLAYER_INITIAL_ATK_SPEED_MULT;
    let thornsSum = 0;
    let lifestealSum = 0;

    // Percent sums (multiplied against base)
    let atkPercentSum = 0;
    let maxHpPercentSum = 0;

    for (const stats of allStats) {
        for (const key of FLAT_STAT_KEYS) {
            if (stats[key] !== undefined) {
                switch (key) {
                    case 'atk':
                        atkFlat += stats[key];
                        break;
                    case 'critChance':
                        critChanceSum += stats[key];
                        break;
                    case 'critMult':
                        critMultSum += stats[key];
                        break;
                    case 'goldMultiplier':
                        goldMultSum += stats[key];
                        break;
                    case 'atkSpeedMult':
                        atkSpeedSum += stats[key];
                        break;
                    case 'thorns':
                        thornsSum += stats[key];
                        break;
                    case 'lifesteal':
                        lifestealSum += stats[key];
                        break;
                }
            }
        }
        for (const key of PERCENT_STAT_KEYS) {
            if (stats[key] !== undefined) {
                switch (key) {
                    case 'atkPercent':
                        atkPercentSum += stats[key];
                        break;
                    case 'maxHpPercent':
                        maxHpPercentSum += stats[key];
                        break;
                }
            }
        }
        for (const key of HP_STAT_KEYS) {
            if (stats[key] !== undefined) {
                maxHpFlat += stats[key];
            }
        }
    }

    // --- Compute effective stats ---

    // Ensure base stats exist (game-state initializes them)
    const baseAtk = p.baseAtk || BALANCE.PLAYER_INITIAL_ATK;
    const baseMaxHp = BALANCE.PLAYER_INITIAL_HP; // maxHp base is always the initial value

    p.atk = baseAtk + atkFlat + Math.round(baseAtk * atkPercentSum);
    p.maxHp = baseMaxHp + maxHpFlat + Math.round(baseMaxHp * maxHpPercentSum);

    // Clamp HP to maxHp if current exceeds new max
    if (p.hp > p.maxHp) {
        p.hp = p.maxHp;
    }

    p.critChance = Math.min(critChanceSum, 1.0);   // Cap at 100%
    p.critMult = Math.max(critMultSum, 1.0);        // Minimum 1.0x
    p.goldMultiplier = Math.max(goldMultSum, 0);
    p.atkSpeedMult = Math.max(atkSpeedSum, 0.1);    // Minimum 0.1x (never freeze)
    p.thorns = thornsSum;
    p.lifesteal = lifestealSum;

    // Sync clickAtk to effective atk
    p.clickAtk = p.atk;

    // Re-apply runtime skill effect deltas that were snapshotted above
    p.atkSpeedMult += berserkDelta;
    p.goldMultiplier *= goldRushMultiplier;
}
