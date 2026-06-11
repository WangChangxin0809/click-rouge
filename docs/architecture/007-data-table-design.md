# ADR-007: Data Table Design

## Status: Accepted

## Date: 2026-06-11

## Summary

All game entity data (skills, followers, equipment, buffs, enemies, bosses) is stored in plain JavaScript objects exported as constants. The unified format for stat-bearing entities is `{ base: {...}, perLevel: {...} }` plus entity-specific metadata. Redundant definition files that separately listed IDs and definitions have been merged into single files.

## Context

### Problem Statement

Before this ADR, the codebase had fragmented data files:
- `skill-data.js` listed skill IDs and basic metadata
- `skill-definitions.js` separately defined skill stat curves
- `follower-data.js` and `follower-definitions.js` had the same split
- Equipment data had no clear base/perLevel separation

This caused:
- **Out-of-sync risk**: Adding a new skill required editing two files
- **Mental overhead**: Developers had to know which file held which data
- **Import bloat**: Systems imported from multiple data files for one entity type

### Constraints

- Pure vanilla JS (no TypeScript, no JSON schema validation)
- Data must be importable as ES modules
- No runtime data transformation (data format = usage format)
- Must support tree-shaking (named exports)

### Requirements

- One file per entity category
- Unified `base` + `perLevel` format for all stat-bearing entities
- All IDs and definitions in the same file
- JSDoc type definitions for IDE support

## Decision

### File Consolidation

| Before (8 files) | After (4 files) |
|------------------|-----------------|
| `skill-data.js` + `skill-definitions.js` | `skill-data.js` |
| `follower-data.js` + `follower-definitions.js` | `follower-data.js` |
| `equipment-data.js` | `equipment-data.js` (reformatted) |
| `buff-data.js` | `buff-data.js` (reformatted) |
| `enemy-definitions.js` | `enemy-definitions.js` (unchanged) |
| `boss-definitions.js` | `boss-definitions.js` (unchanged) |

### Unified Data Format

Every stat-bearing entity definition follows this structure:

```js
export const SKILLS = {
  thunder_strike: {
    label: '雷霆一击',
    description: '对所有敌人造成AOE伤害',
    cooldown: 5,            // entity-specific metadata
    duration: 0,
    effectType: 'aoe',
    base: { aoeDamage: 20 },   // stats at level 1
    perLevel: { aoeDamage: 10 }, // increment per level beyond 1
  },
  // ...
};

// ID list for random selection
export const FOLLOWER_IDS = ['knight', 'archer', 'healer_fairy', 'gold_magnet'];
```

### Key Design Choices

1. **`base` must define the canonical key set**: All stat keys that exist on this entity type are in `base`. Keys in `perLevel` but not in `base` are ignored by `scaleStats()`.
2. **`perLevel` entries default to 0**: If a perLevel key is missing, `scaleStats()` treats it as 0 (no scaling).
3. **No level field in data tables**: Level is runtime state stored in `STATE.player`, not in the data definition.
4. **ID arrays for random selection**: Separate exported arrays (`FOLLOWER_IDS`, `BUFF_IDS`) allow `rng.pickOne()` without iterating `Object.keys()`.
5. **JSDoc typedefs**: Each file exports a `@typedef` for its entity shape, enabling IDE autocomplete.

### Non-Stat Data Files

Enemy and boss definitions (`enemy-definitions.js`, `boss-definitions.js`) do not use `base`/`perLevel` because enemies scale by difficulty multiplier (`getDifficulty()`), not by individual level. These files remain in their existing format.

## Alternatives Considered

### Alternative 1: JSON Data Files

- **Description**: Store all game data as `.json` files, loaded via `fetch()`.
- **Pros**: Editable without touching JS; could be hot-reloaded.
- **Cons**: Async loading; no tree-shaking; no JSDoc; harder to validate at dev time.
- **Rejection Reason**: ES module imports provide synchronous access, tree-shaking, and IDE support out of the box.

### Alternative 2: Class-Based Data Objects

- **Description**: Each entity type is a class with computed getters for scaled stats.
- **Pros**: Type safety; methods can encapsulate scaling logic.
- **Cons**: Every entity instance becomes a class instance (more memory); `scaleStats()` would need to be a method on each class; plain-object pass-through harder.
- **Rejection Reason**: Plain objects are simpler, lighter, and work naturally with `JSON.parse(JSON.stringify())` for state reset.

### Alternative 3: Single Monolithic Data File

- **Description**: All game data in one `game-data.js`.
- **Pros**: Single import; guaranteed consistency.
- **Cons**: Large file; poor separation of concerns; tree-shaking can't eliminate unused entity types.
- **Rejection Reason**: Per-category files allow systems to import only what they need.

## Consequences

### Positive

- Single source of truth per entity type — no split-brain between ID lists and definitions
- Unified `base`/`perLevel` format makes all stat-bearing entities interchangeable
- JSDoc typedefs provide IDE autocomplete without TypeScript
- Named exports enable tree-shaking

### Negative

- Merged files are longer (skill-data.js went from ~20 lines to ~96 lines)
- If a new stat key is added to `perLevel` but not `base`, it's silently ignored — no error
- No runtime schema validation (e.g., missing required fields silently produce NaN/undefined)

### Risks

- **Risk**: Adding a new entity type ID but forgetting to add it to the ID array
  - **Mitigation**: ID arrays are exported alongside definitions; review checklist item
- **Risk**: `base` and `perLevel` key mismatch (different keys in each)
  - **Mitigation**: `scaleStats()` only iterates `base` keys — extra `perLevel` keys are harmlessly ignored, but missing `perLevel` keys default to 0
- **Risk**: Data table gets too large for a single file
  - **Mitigation**: Current data sizes (6 skills, 4 followers, 12 equipment, ~5 buffs) are well within reason. Split if any file exceeds 300 lines.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| All systems | Data-driven design; no hardcoded values | All gameplay values in data files, not in system code |
| balance-config | Designer-adjustable numbers | Plain JS objects are trivially editable |

## Performance Implications

- **CPU**: Data files are imported once at module load. No runtime cost.
- **Memory**: Static data objects (~6 skills * ~8 keys + 4 followers * ~10 keys + ...). Negligible, under 10KB.
- **Load Time**: ES module imports are resolved at parse time. No async fetch needed.

## Migration Plan

1. Copy all stat data from `skill-definitions.js` into `skill-data.js` under `base`/`perLevel` keys
2. Copy all stat data from `follower-definitions.js` into `follower-data.js` under `base`/`perLevel` keys
3. Reformat `equipment-data.js` and `buff-data.js` to use `base`/`perLevel`
4. Delete the old `*-definitions.js` files
5. Update all imports across systems to point to the consolidated files
6. Verify `scaleStats()` produces correct effective stats for each entity type at levels 1, 2, 5, 10

## Validation Criteria

- No imports reference deleted `*-definitions.js` files
- All data files export both the entity map and its ID array
- `scaleStats()` returns correct values for all entity types at multiple levels
- JSDoc typedefs are present in all data files

## Related Decisions

- ADR-004: Unified Level System (defines the `base`/`perLevel` format and `scaleStats()`)
- ADR-005: Reward Generation and Application (reads data tables to generate rewards)
- ADR-006: Stat Aggregation Formula (reads entity `.stats` produced from data tables)
