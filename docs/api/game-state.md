# game-state.js API

## Overview

Central, singleton game state object. All gameplay systems read from and write to this shared state. The state is deliberately plain data with no methods other than `reset()`. Systems must read it each frame (or each event).

**File**: `src/core/game-state.js`

## Imports (依赖)

This module has no dependencies. It is the root state container.

## Exports (导出的函数/类)

### STATE

- **Type**: `Object` (mutable singleton)
- **Purpose**: The single source of truth for all game state. Mutate directly: `STATE.player.gold += 10`.

#### STATE.reset()

- **Purpose**: Reset the entire game state to initial values. Called at the start of a new run or after game-over restart.
- **Returns**: `void`
- **Side Effects**: Deep-clones `INITIAL_STATE` into `STATE`, clearing all progress.

## State Schema

### STATE.player — PlayerState

| Field | Type | Initial | Description |
|-------|------|---------|-------------|
| `hp` | number | 100 | Current hit points |
| `maxHp` | number | 100 | Maximum hit points |
| `baseAtk` | number | 10 | Base attack power (before bonuses) |
| `atk` | number | 10 | Effective attack (baseAtk + equipment + buffs) |
| `gold` | number | 0 | Current gold balance |
| `clickAtk` | number | 10 | Damage per click (synced to atk) |
| `autoAtk` | number | 0 | Passive damage per second |
| `critChance` | number | 0.05 | Critical hit chance (0..1) |
| `critMult` | number | 1.5 | Critical hit damage multiplier |
| `atkSpeedMult` | number | 1.0 | Attack speed multiplier (1.0 = normal) |
| `goldMultiplier` | number | 1.0 | Gold gain multiplier (1.0 = normal) |
| `thorns` | number | 0 | Damage reflected to attacker per hit |
| `lifesteal` | number | 0 | Fraction of damage converted to HP |
| `activeSkills` | Object[] | [] | Equipped active skills (max: BALANCE.MAX_SKILL_SLOTS) |
| `activeFollowers` | Object[] | [] | Active followers (max: BALANCE.MAX_FOLLOWERS) |
| `passiveBuffs` | Object[] | [] | Acquired passive buffs (stackable, no limit) |
| `equipSlots` | Object | `{weapon:null, armor:null, accessory:null}` | Equipped items by slot |
| `poisonBladeDamage` | number | 0 | Extra damage on next click (consumed by combat) |

#### Equipment Slot Item Shape

```js
{
  typeId: string,    // key into EQUIPMENT data table
  name: string,      // display name
  level: number,     // integer >= 1
  slot: string,      // 'weapon' | 'armor' | 'accessory'
  stats: Object,     // pre-computed effective stats from scaleStats()
}
```

#### Active Skill Shape

```js
{
  id: string,               // "skill_{typeId}"
  typeId: string,           // key into SKILLS data table
  name: string,             // display name
  description: string,      // e.g., "雷霆一击 (Lv.3)"
  effectType: string,       // 'aoe'|'freeze'|'berserk'|'heal'|'poison'|'gold_rush'
  cooldown: number,         // cooldown in seconds
  duration: number,          // effect duration in seconds (0 = instant)
  level: number,            // integer >= 1
  _cooldownRemaining: number, // internal — seconds until ready
  _cooldownTotal: number,   // internal — total cooldown for UI bar
  _autoCastGuard: boolean,  // internal — prevents double auto-cast
}
```

#### Active Follower Shape

```js
{
  id: number,               // auto-incremented unique ID
  typeId: string,           // key into FOLLOWERS data table
  level: number,            // integer >= 1
  color: string,            // CSS color
  size: number,             // draw size
  attackInterval: number,   // seconds (0 for non-combat)
  damage: number,           // scaled effective damage
  range: number,            // attack range in px
  projectileSpeed: number,  // archer projectile speed
  healInterval: number,     // seconds (0 for non-healer)
  healAmount: number,       // scaled effective heal
  pickupRangeBonus: number, // scaled pickup range bonus
  x: number,                // position (renderer-managed)
  y: number,                // position (renderer-managed)
  slotIndex: number,        // position index
  totalSlots: number,       // total follower count
  actionTimer: number,      // internal cooldown accumulator
}
```

#### Passive Buff Shape

```js
{
  id: string,         // key into BUFFS data table
  name: string,       // display name
  description: string,// human-readable description
  stats: Object,      // pre-computed effective stats from scaleStats()
  level: number,      // integer >= 1
}
```

### STATE — Top-Level Fields

| Field | Type | Initial | Description |
|-------|------|---------|-------------|
| `activeEffects` | Object[] | [] | Timed skill effects (berserk, freeze, gold_rush) |
| `enemies` | Object[] | [] | Active enemy entities on the field |
| `particles` | Object[] | [] | Active particle/effect entities |
| `gameStatus` | string | 'start' | Current phase: 'start' \| 'playing' \| 'rewardPicking' \| 'gameOver' |
| `elapsedTime` | number | 0 | Time elapsed this run, in seconds |
| `wave` | number | 1 | Current wave number (1-based) |
| `bossTimer` | number | 20 | Seconds until next boss spawn (first at 20s) |
| `killCount` | number | 0 | Total enemies killed this run |
| `maxWaveReached` | number | 1 | Max wave reached (for game-over display) |
| `clickQueue` | Object[] | (set externally) | Queue of pending click positions `{ x, y }` |

#### Active Effect Shape

```js
{
  type: string,          // 'berserk' | 'freeze' | 'gold_rush'
  timer: number,         // remaining duration in seconds
  // type-specific fields:
  speedBonus?: number,   // berserk: added to atkSpeedMult
  goldMultiplier?: number,// gold_rush: multiplied to goldMultiplier
  frozenCount?: number,  // freeze: number of enemies frozen
}
```

## Events (订阅/发射的事件)

The STATE object does not subscribe to or emit events directly. Systems read/write STATE and emit events through the EventBus.

## Usage Example

```js
import { STATE } from './core/game-state.js';

// Read
if (STATE.player.hp <= 0) { /* game over */ }

// Write
STATE.player.gold += 100;
STATE.enemies.push(newEnemy);

// Reset for new run
STATE.reset();
```
