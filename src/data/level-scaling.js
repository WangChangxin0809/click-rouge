/**
 * Level Scaling — Unified additive stat scaling for all reward types.
 *
 * All rewards (equipment, skills, followers, buffs) use a `level` field
 * (integer, starting from 1, no upper bound) and produce effective stats
 * via the formula:
 *
 *   effectiveStat = base[key] + perLevel[key] * (level - 1)
 *
 * Design Doc: Unified Level System — Additive Scaling
 *
 * Usage:
 *   import { scaleStats } from '../data/level-scaling.js';
 *   const effective = scaleStats(def.base, def.perLevel, 3);
 */

/**
 * Compute effective stats for a given level using additive scaling.
 *
 * For each key in `base`, the effective value is:
 *   base[key] + (perLevel[key] || 0) * (level - 1)
 *
 * Keys present only in perLevel (not in base) are ignored — base defines
 * the canonical stat set.
 *
 * @param {Object<string, number>} base - Base stats at level 1
 * @param {Object<string, number>} perLevel - Per-level increment for each stat
 * @param {number} level - Current level (integer, >= 1)
 * @returns {Object<string, number>} Effective stats at the given level
 */
export function scaleStats(base, perLevel, level) {
  const result = {};
  const levels = Math.max(0, (level || 1) - 1);
  for (const key of Object.keys(base)) {
    result[key] = base[key] + (perLevel[key] || 0) * levels;
  }
  return result;
}
