# spawn-system.js API

## Overview

Controls enemy wave-based spawning and base defense mechanics. Spawns enemies from random screen edges at intervals that decrease over time. Wave progression is driven by kill count. Includes boss spawn scheduling, boss minion summoning, kill-based mini reward triggers, and base defense (enemies reaching the center deal damage).

**File**: `src/systems/spawn-system.js`

## Imports (依赖)

| Module | Usage |
|--------|-------|
| `../core/constants.js` | `DESIGN_WIDTH`, `DESIGN_HEIGHT`, `BASE_DAMAGE_RADIUS` — screen dimensions and base defense radius |
| `../core/game-state.js` | `STATE` — enemies array, player state, wave/boss tracking |
| `../core/event-bus.js` | `events` — emit spawn/wave/boss/reward events and subscribe to boss:summon |
| `../core/random.js` | `rng` — random enemy type selection, spawn positions |
| `../data/enemy-definitions.js` | `ENEMY_TYPES` — enemy type definitions |
| `../data/boss-definitions.js` | `BOSS_TIERS` — boss type pools by tier |
| `../entities/enemy.js` | `createEnemy`, `updateEnemy` — enemy lifecycle |
| `../entities/boss.js` | `createBoss`, `updateBoss` — boss lifecycle |
| `./difficulty-system.js` | `getDifficulty` — difficulty multipliers for enemy stats |

## Exports (导出的函数/类)

### initSpawnSystem()

- **Purpose**: Initialize (or reset) the spawn system. Resets spawn timer, wave tracking, and reward kill tracking to initial values. Call once at game start after `STATE.reset()`.
- **Parameters**: None
- **Returns**: `void`
- **Side Effects**: Resets internal module-level variables: `_spawnTimer = 0`, `_lastWave = STATE.wave`, `_lastRewardKill = 0`.
- **Events Emitted**: None.

### updateSpawnSystem(dt)

- **Purpose**: Per-frame update. Performs five operations in order:
  1. Update and clean up existing enemies (movement, base defense check, dead removal)
  2. Check for kill-based mini reward triggers
  3. Check and advance wave based on kill count
  4. Attempt to spawn a new enemy if the spawn timer has elapsed
  5. Decrement boss timer and spawn a boss when it reaches zero
- **Parameters**:
  - `dt` (`number`) — Delta time in seconds since last frame.
- **Returns**: `void`
- **Side Effects**:
  - Mutates `STATE.enemies` (spawn, remove on death/base-reach)
  - Mutates `STATE.player.hp` (base defense damage, boss timeout damage)
  - Mutates `STATE.wave`, `STATE.maxWaveReached`
  - Mutates `STATE.bossTimer`
  - Increases difficulty over time via spawn interval decay
- **Events Emitted**: `'enemy:spawned'`, `'boss:spawned'`, `'boss:died'`, `'wave:start'`, `'reward:trigger'`, `'player:damaged'`.

## Tuning Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `SPAWN_INTERVAL_INITIAL` | 2.0s | Starting interval between enemy spawns |
| `SPAWN_INTERVAL_MIN` | 0.3s | Fastest possible spawn rate |
| `SPAWN_INTERVAL_DECAY` | 0.04 | Interval reduction per second of elapsed time |
| `MAX_ENEMIES` | 50 | Hard cap on active enemies |
| `KILLS_PER_WAVE` | 10 | Kills required to advance to next wave |
| `BOSS_TIMER_MIN` | 30s | Minimum time between boss spawns |
| `BOSS_TIMER_MAX` | 50s | Maximum time between boss spawns |
| `KILLS_PER_REWARD` | 15 | Kills between mini reward triggers |
| `BASE_DAMAGE_RADIUS` | (from constants) | Distance from center at which enemies deal damage |

## Wave Type Pools

| Wave | Enemy Types |
|------|-------------|
| 1 | slime only |
| 2 | slime, bat |
| 3 | slime, bat, golem |
| 4 | slime, bat, golem, ghost |
| 5+ | slime, bat, golem, ghost, fire_skull |

Earlier types in a pool have higher spawn weight (e.g., wave 3: slime 50%, bat 33%, golem 17%).

## Base Defense Mechanic

Regular enemies that move within `BASE_DAMAGE_RADIUS` pixels of the screen center deal their `damage` value to the player and are removed. This replaces the old lifetime-timeout mechanic. Bosses keep timeout-based damage since they are too large to realistically reach this range.

## Event Subscription

`spawn-system.js` subscribes to `'boss:summon'` — when a summon-type boss emits this event, 2-3 slime minions are spawned near the boss position with difficulty-scaled stats.

## State Schema (读写 STATE 字段)

**Reads**:
- `STATE.enemies[]` — current enemies, boss flags
- `STATE.player.hp` — checked indirectly (damage events handled by main loop)
- `STATE.wave` — current wave for spawn pool selection
- `STATE.killCount` — wave progression and reward triggers
- `STATE.elapsedTime` — spawn interval decay and boss tier selection
- `STATE.bossTimer` — boss spawn scheduling

**Writes**:
- `STATE.enemies[]` — pushes new enemies/bosses, splices dead/expired
- `STATE.player.hp` — reduced on base defense hits and boss timeout
- `STATE.wave` — advanced on kill milestones
- `STATE.maxWaveReached` — updated when wave exceeds previous max
- `STATE.bossTimer` — reset after boss spawns

## Events (订阅/发射的事件)

**Subscribes**:
- `'boss:summon'` — payload: `{ x, y }` — spawns minion slimes near boss position

**Emits**:
- `'enemy:spawned'` — payload: `enemy` (the spawned enemy object)
- `'boss:spawned'` — payload: `boss` (the spawned boss object)
- `'boss:died'` — payload: `enemy` (the boss that died)
- `'wave:start'` — payload: `{ wave: number }` (the new wave number)
- `'reward:trigger'` — payload: `{ tier: number }` (reward tier based on current wave)
- `'player:damaged'` — payload: `{ damage, source, enemy }` (source: 'enemy_reached_base' or 'boss_timeout')
