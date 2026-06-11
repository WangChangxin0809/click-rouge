# event-bus.js API

## Overview

Central publish/subscribe event system. All game modules communicate exclusively through the EventBus. UI code must never directly reference gameplay objects, and vice versa.

**File**: `src/core/event-bus.js`

## Imports (依赖)

This module has no dependencies.

## Exports (导出的函数/类)

### events

- **Type**: `EventBus` (singleton instance)
- **Purpose**: The single event bus for all inter-module communication.

## EventBus API

### events.on(event, callback)

- **Purpose**: Subscribe to an event.
- **Parameters**:
  - `event` (`string`) — Event name (e.g., `'player:damaged'`).
  - `callback` (`Function`) — Handler function, receives the payload from `emit()`.
- **Returns**: `Function` — An unsubscribe function for convenience. Calling it is equivalent to `events.off(event, callback)`.
- **Side Effects**: Adds the callback to the listener set for this event.

### events.off(event, callback)

- **Purpose**: Unsubscribe from an event. Safe to call with a callback that was never subscribed (no error).
- **Parameters**:
  - `event` (`string`) — Event name.
  - `callback` (`Function`) — The handler function to remove.
- **Returns**: `void`
- **Side Effects**: Removes the callback. If no listeners remain, cleans up the empty set.

### events.emit(event, payload)

- **Purpose**: Emit an event, calling all registered handlers synchronously in subscription order. If a handler throws, the error is logged but subsequent handlers still run.
- **Parameters**:
  - `event` (`string`) — Event name.
  - `payload` (`*`, optional) — Data to pass to handlers.
- **Returns**: `void`
- **Side Effects**: Invokes all subscribed callbacks.

### events.clear(event)

- **Purpose**: Remove all listeners for a specific event, or all events if no name given.
- **Parameters**:
  - `event` (`string`, optional) — Event name to clear. Omit to clear all events.
- **Returns**: `void`
- **Side Effects**: Deletes listener sets.

### events.listenerCount(event)

- **Purpose**: Return the number of listeners for an event (useful for debugging).
- **Parameters**:
  - `event` (`string`) — Event name.
- **Returns**: `number` — Listener count. Returns 0 for unregistered events.

## Complete Event Catalog

### Game State Events

| Event | Payload | Emitted By | When |
|-------|---------|------------|------|
| `'game:statusChanged'` | `{ status: string }` | main.js | Game phase transitions |

### Enemy Events

| Event | Payload | Emitted By | When |
|-------|---------|------------|------|
| `'enemy:spawned'` | `enemy: Object` | spawn-system.js | New enemy created |
| `'enemy:hit'` | `{ enemy, damage, isCrit, overkill, position }` | combat-system.js, skill-system.js, follower.js | Enemy takes non-lethal damage |
| `'enemy:died'` | `{ enemy, damage, isCrit, overkill, position }` | combat-system.js, skill-system.js, follower.js | Enemy killed |

### Boss Events

| Event | Payload | Emitted By | When |
|-------|---------|------------|------|
| `'boss:spawned'` | `boss: Object` | spawn-system.js | Boss created |
| `'boss:died'` | `enemy: Object` | spawn-system.js | Boss killed or timed out |
| `'boss:summon'` | `{ x, y }` | boss entity (updateBoss) | Summon-type boss spawns minions |

### Wave Events

| Event | Payload | Emitted By | When |
|-------|---------|------------|------|
| `'wave:start'` | `{ wave: number }` | spawn-system.js | New wave begins |

### Player Events

| Event | Payload | Emitted By | When |
|-------|---------|------------|------|
| `'player:damaged'` | `{ damage, source, enemy }` | spawn-system.js | Enemy reaches base or boss timeout |
| `'player:healed'` | `{ amount, source }` | skill-system.js, follower.js | Heal applied (source: 'skill_heal' or 'healer_fairy') |

### Click Events

| Event | Payload | Emitted By | When |
|-------|---------|------------|------|
| `'click:miss'` | `{ x, y }` | combat-system.js | Click didn't hit any enemy |

### Reward Events

| Event | Payload | Emitted By | When |
|-------|---------|------------|------|
| `'reward:trigger'` | `{ tier: number }` | spawn-system.js | Kill milestone reached (no active boss) |
| `'reward:panelShown'` | `{ count: number }` | reward-panel.js | Reward selection UI displayed |
| `'reward:selected'` | `reward: Object` | reward-panel.js | Player picked a reward card |

### Skill Events

| Event | Payload | Emitted By | When |
|-------|---------|------------|------|
| `'skill:activated'` | `{ slot, typeId, name }` | skill-system.js | Any skill activated (manual or auto) |
| `'skill:thunder'` | `{ hitCount }` | skill-system.js | Thunder Strike effect resolved |
| `'skill:freeze'` | `{ frozenCount, duration }` | skill-system.js | Freeze effect applied |
| `'skill:freeze_end'` | `null` | skill-system.js | Freeze effect expired |
| `'skill:berserk'` | `{ duration }` | skill-system.js | Berserk effect started |
| `'skill:berserk_end'` | `null` | skill-system.js | Berserk effect expired |
| `'skill:gold_rush'` | `{ duration }` | skill-system.js | Gold Rush effect started |
| `'skill:gold_rush_end'` | `null` | skill-system.js | Gold Rush effect expired |
| `'skill:poison_blade'` | `{ extraDamage }` | skill-system.js | Poison Blade applied |

## Event Naming Convention

```
[namespace]:[action]
```

- `enemy:spawned`, `enemy:hit`, `enemy:died`
- `player:damaged`, `player:healed`
- `skill:activated`, `skill:freeze_end`
- `reward:trigger`, `reward:selected`
- `game:statusChanged`

## Usage Example

```js
import { events } from './core/event-bus.js';

// Subscribe (and get unsubscribe function)
const unsub = events.on('enemy:died', (payload) => {
  console.log(`Enemy died! Damage: ${payload.damage}`);
});

// Emit
events.emit('enemy:died', { enemy: someEnemy, damage: 42, isCrit: true });

// Unsubscribe
unsub();
// or: events.off('enemy:died', myHandler);

// Debug: check listener count
console.log(events.listenerCount('enemy:died'));

// Clean slate
events.clear(); // removes all listeners
```
