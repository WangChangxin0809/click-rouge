# follower-system.js (follower.js) API

## Overview

Follower entity creation and per-frame behavior. Followers stand at the bottom of the screen in a row and perform periodic actions: knights attack nearby enemies, archers fire projectiles, healer fairies restore HP, and gold magnets increase pickup range (passive). Uses unified level system with `scaleStats()` for stat computation.

**File**: `src/entities/follower.js`

## Imports (依赖)

| Module | Usage |
|--------|-------|
| `../core/event-bus.js` | `events` — emit hit/died/healed events |
| `../core/game-state.js` | `STATE` — read elapsedTime, player state, enemies; write gold, killCount |
| `../data/level-scaling.js` | `scaleStats` — compute effective stats from level |
| `./enemy.js` | `damageEnemy` — apply damage to enemies |
| `./projectile.js` | `createProjectile` — spawn archer projectiles |
| `../systems/combat-system.js` | `awardGold` — gold rewards from follower kills |

## Exports (导出的函数/类)

### createFollower(typeId, definitions, slotIndex, totalSlots, level)

- **Purpose**: Create a new follower entity with stats scaled to the given level.
- **Parameters**:
  - `typeId` (`string`) — Key into `FOLLOWERS` (e.g., 'knight', 'archer', 'healer_fairy', 'gold_magnet').
  - `definitions` (`Object<string, FollowerDef>`) — The `FOLLOWERS` data map (passed in for dependency injection).
  - `slotIndex` (`number`) — Position index (0-based) among active followers. Used by the renderer for layout.
  - `totalSlots` (`number`) — Total number of active followers. Used by the renderer for layout.
  - `level` (`number`, optional, default `1`) — Current level for stat scaling via `scaleStats()`.
- **Returns**: `Object` — Follower entity with shape:
  ```js
  {
    id: number,              // auto-incremented unique ID
    typeId: string,
    level: number,
    color: string,           // CSS color from definition
    size: number,            // draw size from definition
    attackInterval: number,  // seconds (0 for non-attack types)
    damage: number,          // scaled effective damage
    range: number,           // attack range in px (0 for non-attack types)
    projectileSpeed: number, // archer projectile speed (0 for non-archer)
    healInterval: number,    // seconds (0 for non-healer types)
    healAmount: number,      // scaled effective heal amount
    pickupRangeBonus: number,// scaled effective pickup range bonus
    x: number,               // position (managed by renderer)
    y: number,               // position (managed by renderer)
    slotIndex: number,
    totalSlots: number,
    actionTimer: number,     // internal cooldown accumulator, starts at 0
  }
  ```
- **Side Effects**: Increments internal `_nextId` counter. No STATE mutation.
- **Events Emitted**: None.

### updateFollower(follower, dt, enemies)

- **Purpose**: Advance a single follower's state by `dt` seconds. Routes to type-specific behavior.
- **Parameters**:
  - `follower` (`Object`) — Follower entity as returned by `createFollower()`.
  - `dt` (`number`) — Delta time in seconds.
  - `enemies` (`Object[]`) — Current enemy array (`STATE.enemies`).
- **Returns**: `void`
- **Side Effects**:
  - Increments `follower.actionTimer`
  - May call `damageEnemy()` (knight), `createProjectile()` (archer), or heal player (healer_fairy)
  - May mutate `STATE.player.gold` and `STATE.killCount` via knight kills
  - May mutate `STATE.player.hp` via healer_fairy
- **Events Emitted**: `'enemy:died'`, `'enemy:hit'` (knight kills/hits), `'player:healed'` (healer_fairy).

### updateAllFollowers(dt, enemies)

- **Purpose**: Update all active followers in `STATE.player.activeFollowers`. Convenience wrapper for the main game loop.
- **Parameters**:
  - `dt` (`number`) — Delta time in seconds.
  - `enemies` (`Object[]`) — Current enemy array (`STATE.enemies`).
- **Returns**: `void`
- **Side Effects**: Calls `updateFollower()` for each follower in the array. Safe no-op if followers array is empty.
- **Events Emitted**: Indirectly, via `updateFollower()`.

## Follower Type Behaviors

| Type | Action | Trigger | Target | Effect |
|------|--------|---------|--------|--------|
| knight | Melee attack | Every `attackInterval` | Nearest enemy in `range` | Deals `damage` to enemy |
| archer | Ranged projectile | Every `attackInterval` | Random alive enemy | Fires projectile dealing `damage` |
| healer_fairy | Heal | Every `healInterval` | Player | Restores `healAmount` HP (capped at maxHp) |
| gold_magnet | Passive | None | N/A | `pickupRangeBonus` increases gold pickup radius (handled by gold system) |

## State Schema (读写 STATE 字段)

**Reads**:
- `STATE.player.activeFollowers[]` — iterated by `updateAllFollowers()`
- `STATE.elapsedTime` — recorded on enemy hit for flash effect timing
- `STATE.player.hp`, `.maxHp` — checked by healer_fairy
- `STATE.enemies[]` — queried for targets

**Writes**:
- `STATE.player.gold` — incremented on knight kills (via `awardGold()`)
- `STATE.killCount` — incremented on knight kills
- `STATE.player.hp` — increased by healer_fairy heals

## Events (订阅/发射的事件)

**Emits**:
- `'enemy:died'` — payload: `{ enemy, damage, isCrit: false, overkill, position }` (knight kills)
- `'enemy:hit'` — payload: `{ enemy, damage, isCrit: false, overkill, position }` (knight hits)
- `'player:healed'` — payload: `{ amount, source: 'healer_fairy' }` (healer_fairy)

**Subscribes**: Does not subscribe to any events.
