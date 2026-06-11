# ADR-006: Stat Aggregation Formula

## Status: Accepted

## Date: 2026-06-11

## Summary

All stat contributions from equipment, passive buffs, active effects, and base values are summed in a single `recalculateStats()` function. Each entity's stats are pre-computed via `scaleStats()` at reward application time — `recalculateStats()` only reads the `.stats` object on each entity, never raw `level` values. Percentage attributes use additive stacking (percentage point addition), and all computed stats are clamped to valid ranges.

## Context

### Problem Statement

The player's effective combat stats (`atk`, `maxHp`, `critChance`, `critMult`, `goldMultiplier`, `atkSpeedMult`, `thorns`, `lifesteal`) are derived from multiple independent sources:
- Base stats from `BALANCE` constants
- Equipment in 3 slots (weapon, armor, accessory)
- Passive buffs (unlimited stacking)
- Active skill effects (berserk, gold_rush — temporary)

Without a centralized recalculation, stats could drift (e.g., re-applying the same buff twice) or fail to account for new sources.

### Constraints

- Must be callable from any system (not tied to a specific lifecycle)
- Must never accumulate on itself (repeating recalculateStats() without a game reset must produce the same result)
- Must handle missing/incomplete stat objects gracefully (null slots, undefined buffs)
- Must clamp percentage stats to valid ranges

### Requirements

- Single entry point for all stat aggregation
- Flat and percentage stats handled distinctly
- Base stats initialized from `BALANCE` constants each call (not from current `STATE.player` values — to prevent accumulation)
- HP clamping: current HP must never exceed new maxHp

## Decision

### Single Recalculation Function

`progression-system.js` exports `recalculateStats()`, which is called after every `applyReward()` and at game initialization. It is the **only** function that writes to `STATE.player`'s effective stat fields.

### Stat Categories

Stats are divided into three categories based on how they aggregate:

| Category | Keys | Aggregation | Clamp |
|----------|------|-------------|-------|
| Flat additive | atk, critChance, critMult, goldMultiplier, atkSpeedMult, thorns, lifesteal | Sum all contributors + BALANCE base | per-key |
| Percentage | atkPercent, maxHpPercent | Sum all, then `baseAtk * (1 + sum)` | none |
| HP | maxHp | Sum all contributors + BALANCE base | none |

### Initialization from Constants

To prevent accumulation bugs, every call to `recalculateStats()` re-initializes sum accumulators from `BALANCE` constants:

```js
let critChanceSum = BALANCE.PLAYER_INITIAL_CRIT_CHANCE;   // not STATE.player.critChance
let critMultSum = BALANCE.PLAYER_INITIAL_CRIT_MULT;
let goldMultSum = BALANCE.GOLD_MULTIPLIER_BASE;
let atkSpeedSum = BALANCE.PLAYER_INITIAL_ATK_SPEED_MULT;
```

Flat stats (`atk`, `maxHp`, `thorns`, `lifesteal`) start at 0 and accumulate from contributors.

### Contributor Gathering

`recalculateStats()` iterates over all stat-bearing entities:
1. `STATE.player.equipSlots` — each slot's `.stats` object
2. `STATE.player.passiveBuffs` — each buff's `.stats` object

Note: Active skill effects (berserk, gold_rush) modify `STATE.player` directly (e.g., `atkSpeedMult += bonus`) in `skill-system.js` and revert on expiration. They do not go through `recalculateStats()` — they are additive deltas applied outside the aggregation cycle.

### HP Overflow Protection

After computing `maxHp`, if `STATE.player.hp > STATE.player.maxHp`, clamp down:

```js
if (p.hp > p.maxHp) {
  p.hp = p.maxHp;
}
```

### Stat Clamping

| Stat | Minimum | Maximum | Reason |
|------|---------|---------|--------|
| critChance | 0 | 1.0 | Probability must be 0-100% |
| critMult | 1.0 | none | Minimum 1.0x damage |
| goldMultiplier | 0 | none | No negative gold |
| atkSpeedMult | 0.1 | none | Never freeze (0.1x minimum) |
| thorns | 0 | none | No negative reflection |
| lifesteal | 0 | none | No HP loss on hit |

### Formula

```
effectiveAtk    = baseAtk + sum(equip.atk) + sum(buff.atk) + round(baseAtk * sum(atkPercent))
effectiveMaxHp  = BALANCE.PLAYER_INITIAL_HP + sum(equip.maxHp) + sum(buff.maxHp) + round(base * sum(maxHpPercent))
effectiveCrit   = min(BALANCE.PLAYER_INITIAL_CRIT_CHANCE + sum(all critChance), 1.0)
effectiveCritMult = max(BALANCE.PLAYER_INITIAL_CRIT_MULT + sum(all critMult), 1.0)
clickAtk         = effectiveAtk (synced each call)
```

## Alternatives Considered

### Alternative 1: Event-Driven Incremental Updates

- **Description**: Each stat source emits events when changed; a listener updates only the affected stat.
- **Pros**: No full recalculation; potentially faster.
- **Cons**: Event ordering bugs; easy to miss a contributor; hard to audit "what is my total crit chance."
- **Rejection Reason**: Full recalculation is simple, auditable, and fast enough (called infrequently). Incremental updates add complexity without measurable benefit.

### Alternative 2: Stats Computed Lazily on Read

- **Description**: No stored effective stats; every system that needs `atk` computes it on-the-fly from contributors.
- **Pros**: Never stale; no recalculate calls needed.
- **Cons**: Every attack roll would iterate all equipment + buffs; hot-path performance hit; harder to display in UI.
- **Rejection Reason**: Pre-computing once per reward application is far more efficient than computing on every damage calculation.

### Alternative 3: Multiplicative Stacking for Percentages

- **Description**: `critChance = 1 - (1 - base) * prod(1 - bonus)` for diminishing returns.
- **Pros**: Prevents 100% crit chance from being too easy to reach.
- **Cons**: Harder for players to reason about; harder to balance.
- **Rejection Reason**: Additive with cap is simpler and the cap handles the 100% problem.

## Consequences

### Positive

- Single function to audit all stat math
- Reset-safe: always reinitializes from BALANCE constants
- Handles empty/incomplete state gracefully (all loops check for null/undefined)
- `clickAtk` synced to `atk` ensures click damage always matches attack power

### Negative

- Full recalculation means every stat is recomputed even if only one changed
- Active skill effects bypass the aggregation (applied as direct deltas) — two different stat-modification paths exist
- No per-contributor audit trail ("where did my +50 ATK come from?") — only total is stored

### Risks

- **Risk**: A new stat source is added but not included in `recalculateStats()`
  - **Mitigation**: Any system that adds entities to STATE.player must call `recalculateStats()` after; the function iterates all known collections
- **Risk**: Balance constant changes mid-session break stat math
  - **Mitigation**: `recalculateStats()` uses `BALANCE` values each call; no persisted offsets

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| progression-system | Stats must reflect all equipment and buffs | `recalculateStats()` sums all sources |
| balance-config | Base stats defined in BALANCE | Constants used as initial values and bases |
| combat-system | Effective atk and crit drive damage | Pre-computed stats read by combat each frame |

## Performance Implications

- **CPU**: `recalculateStats()` iterates 3 equipSlots + N passiveBuffs. With 10 buffs, ~13 iterations with ~10 stat keys each = ~130 operations. Negligible. Called only on reward application and game init.
- **Memory**: No additional allocations beyond the returned values written to STATE.
- **Load Time**: No impact.

## Migration Plan

No migration needed. Existing `recalculateStats()` already implements this design.

## Validation Criteria

- Calling `recalculateStats()` twice in a row produces identical STATE.player stats
- Adding a Lv.1 weapon with `atk: 5` increases `STATE.player.atk` by exactly 5
- `clickAtk` always equals `atk` after recalculation
- Crit chance never exceeds 1.0 (100%) regardless of stacked bonuses
- `atkSpeedMult` never goes below 0.1

## Related Decisions

- ADR-004: Unified Level System (defines `scaleStats()` used to precompute entity stats)
- ADR-005: Reward Generation and Application (calls `recalculateStats()` after applying rewards)
- ADR-007: Data Table Design (defines data format for stat-bearing entities)
