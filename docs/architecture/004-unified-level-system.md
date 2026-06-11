# ADR-004: Unified Level System

## Status: Accepted

## Date: 2026-06-11

## Summary

All reward entities (equipment, skills, followers, buffs) use a single `level` field (integer, starting from 1, no upper bound). This replaces the three separate systems previously in use: `tier` for equipment, `stack` for skills, and implicit count for followers/buffs. The effective stat scaling formula is additive:

```
effectiveStat = base[key] + perLevel[key] * (level - 1)
```

All data tables follow the `base` + `perLevel` structure, and `level-scaling.js` provides a single `scaleStats(base, perLevel, level)` function used by all systems.

## Context

### Problem Statement

Before this ADR, the codebase used three different level/rank concepts:

| Concept | Used By | Field | Semantics |
|---------|---------|-------|-----------|
| tier | Equipment | `item.tier` | Quality tier (1-4) |
| stack | Skills | `skill.stack` | Number of duplicates acquired |
| implicit | Followers/Buffs | (none) | Level inferred from acquisition count |

This caused several problems:
- **UI bugs**: Reward cards showed incorrect "upgrade" text because `reward-panel.js` read `tier` on equipment but `stack` on skills, while `recalculateStats()` expected `level` on both.
- **Data inconsistency**: Equipment data used `tier`-based scaling, skills used `stack`-based, and followers used no scaling at all.
- **Maintenance burden**: Every system that touched these fields had to handle all three naming conventions.

### Constraints

- No external libraries (vanilla JS only)
- Must be backward-compatible with existing save data (or provide migration)
- No hard level cap (session duration provides implicit cap)
- Must work for all 4 reward types: equipment, skills, followers, buffs

### Requirements

- Single `level` field on all entities
- Single scaling function used everywhere
- Additive scaling (linear growth) for predictable balance
- Percentage stats add as percentage points (not multiplicative)

## Decision

### Unified `level` Field

All reward entities carry an integer `level` field starting at 1. Level is the **sole** indicator of power for that entity. There is no upper bound on level — the maximum level is implicitly limited by session duration and wave count.

### Data Table Structure

All data definitions (equipment, skills, followers, buffs) use:

```js
{
  base: { statName: valueAtLv1, ... },
  perLevel: { statName: incrementPerLevel, ... }
}
```

### Scaling Function

A single `scaleStats(base, perLevel, level)` function in `src/data/level-scaling.js` computes effective stats:

```js
export function scaleStats(base, perLevel, level) {
  const result = {};
  const levels = Math.max(0, (level || 1) - 1);
  for (const key of Object.keys(base)) {
    result[key] = base[key] + (perLevel[key] || 0) * levels;
  }
  return result;
}
```

The function:
- Treats `base` as the canonical key set (keys only in `perLevel` are ignored)
- Clamps level to minimum 1 (level - 1 can't be negative)
- Returns a new object each call (no mutation)

### Percentage Stat Handling

Percentage stats (critChance, atkSpeedMult, goldMultiplier, lifesteal, etc.) use **additive** scaling — each level adds a flat percentage point. For example, if `base.critChance = 0.05` (5%) and `perLevel.critChance = 0.01`, then at level 3 the crit chance is `0.05 + 0.01 * 2 = 0.07` (7%).

Percentage stat contributions from all entities are summed in `recalculateStats()`, then clamped where appropriate (e.g., `critChance` capped at 1.0).

### Level Determination

- **New entity** (player doesn't own this type): level = 1
- **Existing entity** (player already owns this typeId): level = currentLevel + 1
- Equipment replacement (slot occupied by different typeId): level = 1 (sidegrade)
- Equipment upgrade (slot occupied by same typeId): level = currentLevel + 1

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   level-scaling.js                       │
│              scaleStats(base, perLevel, level)           │
└──────┬──────────────────────────────────────────────────┘
       │ imports
       ▼
┌─────────────────────────────────────────────────────────┐
│  Data Tables (skill-data, follower-data,                │
│  equipment-data, buff-data)                             │
│  Each: { base: {...}, perLevel: {...} }                 │
└─────────────────────────────────────────────────────────┘
       │ read by
       ▼
┌─────────────────────────────────────────────────────────┐
│  reward-system.js                                       │
│  determineLevel() → scaleStats() → reward.stats         │
└──────┬──────────────────────────────────────────────────┘
       │ applies to STATE.player
       ▼
┌─────────────────────────────────────────────────────────┐
│  progression-system.js                                  │
│  recalculateStats() — sums all contributions            │
└──────┬──────────────────────────────────────────────────┘
       │ reads
       ▼
┌─────────────────────────────────────────────────────────┐
│  STATE.player                                           │
│  .equipSlots[slot].level, .activeSkills[].level,        │
│  .activeFollowers[].level, .passiveBuffs[].level        │
└─────────────────────────────────────────────────────────┘
```

## Alternatives Considered

### Alternative 1: Keep Three Separate Systems

- **Description**: Maintain `tier` for equipment, `stack` for skills, and separate tracking for followers/buffs.
- **Pros**: No migration needed; each system can have different scaling curves.
- **Cons**: Triple the code paths in UI and stat aggregation; field-name bugs are inevitable; harder to reason about balance.
- **Rejection Reason**: The maintenance burden and bug surface area outweigh any flexibility gained from separate systems.

### Alternative 2: Multiplicative Scaling (geometric growth)

- **Description**: `effectiveStat = base * multiplier ^ (level - 1)` for exponential power scaling.
- **Pros**: More dramatic power fantasy; small level differences feel significant.
- **Cons**: Balance becomes extremely difficult past level 10-15; hard to predict session outcomes; percentage-based stats explode.
- **Rejection Reason**: Additive scaling provides predictable, linear growth that's easier to balance and doesn't require a level cap.

### Alternative 3: Capped Levels (max level per tier/rarity)

- **Description**: Level capped at 4, with tier gating which levels are available.
- **Pros**: Clear upgrade ceiling; well-defined power budget.
- **Cons**: Arbitrary ceiling feels bad for players in long sessions; requires a different mechanic for "what happens after max level."
- **Rejection Reason**: Session length provides a natural implicit cap. No need for an artificial ceiling.

## Consequences

### Positive

- Single `level` field eliminates the field-name confusion that caused UI bugs
- `scaleStats()` is the **only** place where stat scaling math lives — easy to change scaling formula globally
- Data tables are self-documenting: `base` is the Lv.1 value, `perLevel` is the increment
- All systems (equipment, skills, followers, buffs) use identical data shape and scaling

### Negative

- Migration required: all code that reads `tier`, `stack`, or implicit levels must be updated
- Additive scaling may feel underwhelming at very high levels (diminishing relative return)
- No per-type scaling curve differences (all use the same linear formula)

### Risks

- **Risk**: Field name confusion persists if migration is incomplete
  - **Mitigation**: This ADR documents all field renames; grep for `tier`, `stack` to find stragglers
- **Risk**: Recalculated stats diverge from expected values if `recalculateStats()` reads wrong fields
  - **Mitigation**: `recalculateStats()` already reads `.stats` from entities (pre-computed), not raw `level` — the stat objects are produced by `scaleStats()` at reward application time
- **Risk**: Data table format mismatch (old tables without `base`/`perLevel`)
  - **Mitigation**: ADR-007 mandates unified data table format; all data tables have been migrated

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| reward-system | Rewards must scale with player progress | `level` provides monotonic power growth via additive scaling |
| progression-system | Stats must aggregate from all sources | Unified `level` + `stats` on all entities simplifies summation |
| skill-system | Skill effects must scale with investment | `activateSkill()` uses `scaleStats(skill.level)` for all effect values |
| follower-system | Followers must grow stronger over time | `createFollower()` computes effective stats from level at creation |

## Performance Implications

- **CPU**: `scaleStats()` is O(N) where N is the number of stat keys in `base` (typically 1-5 keys). Negligible — called once per reward generation/application, not per frame.
- **Memory**: Each entity stores a `stats` object alongside `level`. These are small (1-5 keys). Within budget.
- **Load Time**: No impact — scaling is computed at runtime, not precomputed.

## Migration Plan

1. Rename all `tier` and `stack` references to `level` in:
   - `src/ui/reward-panel.js` (lines 186, 285, 307, 308)
   - `src/ui/equipment-panel.js` (line 104)
   - `src/ui/skill-panel.js` (already using `level`)
2. Migrate data tables to `base` + `perLevel` format (done in ADR-007)
3. Verify `recalculateStats()` only reads `.stats` from entities (not raw `level`)
4. Run full game loop and verify reward card level badges display correctly

## Validation Criteria

- All reward card level badges show correct `Lv.N` values
- "Upgrade" text on reward cards correctly shows `Lv.X -> Lv.Y` where Y = X + 1
- Stats scale linearly: a Lv.3 entity has exactly 2x `perLevel` bonus over Lv.1
- No runtime errors referencing `tier` or `stack` fields in UI or system code

## Related Decisions

- ADR-005: Reward Generation and Application
- ADR-006: Stat Aggregation Formula
- ADR-007: Data Table Design
- ADR-003: Game State Schema
