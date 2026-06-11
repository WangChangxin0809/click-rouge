# level-scaling.js API

## Overview

Unified additive stat scaling for all reward types (equipment, skills, followers, buffs). Provides a single `scaleStats()` function that computes effective stats at a given level from `base` and `perLevel` definitions.

**File**: `src/data/level-scaling.js`

## Imports (依赖)

This module has no dependencies. It is a pure function with no side effects.

## Exports (导出的函数/类)

### scaleStats(base, perLevel, level)

- **Purpose**: Compute effective stats for a given level using the additive formula: `effective = base[key] + perLevel[key] * (level - 1)`.
- **Parameters**:
  - `base` (`Object<string, number>`) — Stat values at level 1. Defines the canonical key set.
  - `perLevel` (`Object<string, number>`) — Per-level increment for each stat. Keys not in `base` are silently ignored.
  - `level` (`number`) — Current level (integer, >= 1). Values < 1 are clamped to 1 internally.
- **Returns**: `Object<string, number>` — A new object with effective stats for each key in `base`.
- **Side Effects**: None. Pure function — no mutation, no events, no STATE access.
- **Events Emitted**: None.

### Usage Example

```js
import { scaleStats } from '../data/level-scaling.js';

const def = { base: { damage: 10 }, perLevel: { damage: 5 } };
const lv1Stats = scaleStats(def.base, def.perLevel, 1);  // { damage: 10 }
const lv3Stats = scaleStats(def.base, def.perLevel, 3);  // { damage: 20 }
```

### Edge Cases

- `level` is undefined or null: treated as 1 (returns base values)
- `level` is 0 or negative: clamped to 1
- `perLevel` is missing a key present in `base`: treated as 0 for that key
- `base` has no keys: returns empty object `{}`
- `perLevel` has keys not in `base`: those keys are ignored (not included in result)

## State Schema (读写 STATE 字段)

Does not read or write STATE.

## Events (订阅/发射的事件)

Does not subscribe to or emit any events.
