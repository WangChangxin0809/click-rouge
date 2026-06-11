# combat-system.js API

## Overview

Processes click attacks from the click queue. Each frame, consumes one click from `STATE.clickQueue` and resolves it against the nearest alive enemy within 200px range. Handles critical hit rolls, damage application (including poison_blade bonus), enemy death, and gold/score rewards.

**File**: `src/systems/combat-system.js`

## Imports (依赖)

| Module | Usage |
|--------|-------|
| `../core/game-state.js` | `STATE` — click queue, player stats, enemies, elapsedTime |
| `../core/event-bus.js` | `events` — emit hit/miss/died events |
| `../core/random.js` | `rng` — critical hit roll |
| `../entities/enemy.js` | `damageEnemy` — apply damage to enemy |

## Exports (导出的函数/类)

### updateCombatSystem()

- **Purpose**: Per-frame update. Drains one click from the front of `STATE.clickQueue` and resolves combat. Safe to call every frame even with an empty queue (no-op).
- **Parameters**: None (reads from STATE).
- **Returns**: `void`
- **Side Effects**:
  - Shifts one entry from `STATE.clickQueue`
  - May call `damageEnemy()` on the nearest alive enemy
  - May award gold and increment `STATE.killCount`
  - May consume `STATE.player.poisonBladeDamage`
- **Events Emitted**: `'click:miss'`, `'enemy:hit'`, `'enemy:died'`.

### awardGold(amount)

- **Purpose**: Award gold to the player, applying the current gold multiplier. All gameplay systems that grant gold MUST use this function so that gold_rush and other gold-multiplier effects work correctly.
- **Parameters**:
  - `amount` (`number`) — Base gold amount before multiplier.
- **Returns**: `void`
- **Side Effects**: Mutates `STATE.player.gold` by adding `amount * STATE.player.goldMultiplier`.
- **Events Emitted**: None.

### Combat Flow

1. If `STATE.clickQueue` is empty → no-op
2. Shift one click from the queue
3. Find all alive enemies on the field
4. If no alive enemies → emit `'click:miss'`
5. Find nearest enemy to click point (brute-force, max 50 enemies)
6. If distance > 200px → emit `'click:miss'`
7. Roll for critical hit: `rng.nextFloat(0, 1) < STATE.player.critChance`
8. Calculate damage: `baseAtk * (isCrit ? critMult : 1.0)`
9. If `poisonBladeDamage > 0`, apply bonus damage and reset to 0
10. Call `damageEnemy(nearest, totalDamage)`
11. If enemy killed → `awardGold(enemy.gold)`, `STATE.killCount++`, emit `'enemy:died'`
12. If enemy survived → emit `'enemy:hit'`

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `CLICK_RANGE` | 200 | Maximum pixel distance for a valid hit |

### Usage Example

```js
import { updateCombatSystem, awardGold } from './systems/combat-system.js';

// In main game loop:
updateCombatSystem();

// From other systems (skill kills, follower kills):
awardGold(someAmount);
```

## State Schema (读写 STATE 字段)

**Reads**:
- `STATE.clickQueue[]` — array of `{ x, y }` click positions
- `STATE.enemies[]` — enemy positions and alive status
- `STATE.player.baseAtk`, `.critChance`, `.critMult`, `.poisonBladeDamage`, `.goldMultiplier`
- `STATE.elapsedTime` — recorded as `lastHitTime` on hit enemies

**Writes**:
- `STATE.clickQueue` — mutated via `.shift()`
- `STATE.enemies[].hp`, `.alive` — via `damageEnemy()`
- `STATE.enemies[].lastHitTime` — set to `STATE.elapsedTime`
- `STATE.player.gold` — via `awardGold()`
- `STATE.player.poisonBladeDamage` — consumed (set to 0) when applied
- `STATE.killCount` — incremented on enemy kills

## Events (订阅/发射的事件)

**Emits**:
- `'click:miss'` — payload: `{ x, y }` (the click position that missed)
- `'enemy:hit'` — payload: `{ enemy, damage, isCrit, overkill, poisonBonus, position }`
- `'enemy:died'` — payload: `{ enemy, damage, isCrit, overkill, poisonBonus, position }`

**Subscribes**: Does not subscribe to any events.
