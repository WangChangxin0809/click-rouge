# progression-system.js API

## Overview

Stat aggregation and recalculation. Reads `STATE.player`'s base values, equipment, passive buffs, and computes effective (actual) stats used by combat and other systems. Call `recalculateStats()` after any reward is applied or at game initialization.

**File**: `src/systems/progression-system.js`

## Imports (依赖)

| Module | Usage |
|--------|-------|
| `../core/game-state.js` | `STATE` — reads player inventory, writes effective stats |
| `../data/balance-config.js` | `BALANCE` — base stat constants (PLAYER_INITIAL_ATK, PLAYER_INITIAL_HP, PLAYER_INITIAL_CRIT_CHANCE, etc.) |

## Exports (导出的函数/类)

### recalculateStats()

- **Purpose**: Recalculate all effective player stats from base values + equipment + passive buffs + active effects.
- **Parameters**: None (reads from `STATE.player`).
- **Returns**: `void`
- **Side Effects**: Mutates `STATE.player` in-place:
  - `atk` = baseAtk + sum(equip.atk, buff.atk) + round(baseAtk * sum(atkPercent))
  - `maxHp` = BALANCE.PLAYER_INITIAL_HP + sum(equip.maxHp, buff.maxHp) + round(base * sum(maxHpPercent))
  - `critChance` = min(BALANCE.PLAYER_INITIAL_CRIT_CHANCE + sum(all critChance), 1.0)
  - `critMult` = max(BALANCE.PLAYER_INITIAL_CRIT_MULT + sum(all critMult), 1.0)
  - `goldMultiplier` = max(BALANCE.GOLD_MULTIPLIER_BASE + sum(all goldMultiplier), 0)
  - `atkSpeedMult` = max(BALANCE.PLAYER_INITIAL_ATK_SPEED_MULT + sum(all atkSpeedMult), 0.1)
  - `thorns` = sum(all thorns)
  - `lifesteal` = sum(all lifesteal)
  - `clickAtk` = atk (synced)
  - If `hp > maxHp`, clamps `hp = maxHp`
- **Events Emitted**: None.

### Stat Contributor Sources

The function gathers stats from:
1. `STATE.player.equipSlots[weapon|armor|accessory].stats` — if slot is occupied
2. `STATE.player.passiveBuffs[].stats` — all acquired buffs

Note: Active skill effects (berserk, gold_rush) modify `STATE.player` directly as deltas and are NOT included in this recalculation. They are applied/reverted in `skill-system.js`.

### Stat Categories

| Category | Keys | How Aggregated |
|----------|------|----------------|
| Flat additive | atk, critChance, critMult, goldMultiplier, atkSpeedMult, thorns, lifesteal | Summed with BALANCE base value |
| Percentage | atkPercent, maxHpPercent | Summed, then multiplied against base stat |
| HP | maxHp | Summed with BALANCE base value |

### Usage Example

```js
import { recalculateStats } from './systems/progression-system.js';

// After applying a reward:
applyReward(reward);        // reward-system calls recalculateStats() internally
// Or manually:
recalculateStats();
```

### Edge Cases

- Empty equipSlots (all null): no stat contribution from equipment
- No passiveBuffs: no stat contribution from buffs
- Repeated calls: idempotent — always reinitializes from BALANCE constants, never accumulates
- `hp > maxHp` after recalculation: `hp` is clamped down to `maxHp`

## State Schema (读写 STATE 字段)

**Reads**:
- `STATE.player.baseAtk` — base attack power
- `STATE.player.equipSlots[slot].stats` — per-slot stat contributions
- `STATE.player.passiveBuffs[].stats` — per-buff stat contributions

**Writes**:
- `STATE.player.atk`, `.maxHp`, `.hp` (clamped), `.critChance`, `.critMult`, `.goldMultiplier`, `.atkSpeedMult`, `.thorns`, `.lifesteal`, `.clickAtk`

## Events (订阅/发射的事件)

Does not subscribe to or emit any events.
