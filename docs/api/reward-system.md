# reward-system.js API

## Overview

Generates reward options after boss kills and kill-trigger events. Applies selected rewards to the player's state. Uses the unified level system: all rewards carry a `level` field (integer, starting at 1). Distribution: 30% equipment / 25% skills / 25% followers / 20% buffs.

**File**: `src/systems/reward-system.js`

## Imports (依赖)

| Module | Usage |
|--------|-------|
| `../core/game-state.js` | `STATE` — reads player inventory, mutates on apply |
| `../core/random.js` | `rng` — weighted random selection |
| `../data/equipment-data.js` | `EQUIPMENT`, `EQUIPMENT_SLOTS`, `EQUIPMENT_SLOT_KEYS` — equipment pool |
| `../data/skill-data.js` | `SKILLS` — skill definitions |
| `../data/follower-data.js` | `FOLLOWERS`, `FOLLOWER_IDS` — follower definitions and ID list |
| `../data/buff-data.js` | `BUFFS`, `BUFF_IDS` — buff definitions and ID list |
| `../data/level-scaling.js` | `scaleStats` — compute effective stats from level |
| `../entities/follower.js` | `createFollower` — instantiate new follower entity |
| `../data/balance-config.js` | `BALANCE` — slot limits (MAX_SKILL_SLOTS, MAX_FOLLOWERS) |
| `./progression-system.js` | `recalculateStats` — called after applying reward |

## Exports (导出的函数/类)

### generateRewards(bossTier)

- **Purpose**: Generate reward options for boss kill reward screen.
- **Parameters**:
  - `bossTier` (`number`) — Boss tier. Tier 1 = 3 choices, tier 2+ = 4 choices. Also gates which entity types are unlocked.
- **Returns**: `Array<RewardObject>` — 3 or 4 reward objects.
- **Side Effects**: Reads `STATE.player.equipSlots`, `activeSkills`, `activeFollowers`, `passiveBuffs` to determine levels. Does NOT mutate STATE.
- **Events Emitted**: None.

### generateMiniRewards(tier)

- **Purpose**: Generate mini reward options for kill-based triggers (2 choices, pick 1).
- **Parameters**:
  - `tier` (`number`) — Reward tier based on wave number.
- **Returns**: `Array<RewardObject>` — 2 reward objects.
- **Side Effects**: Reads `STATE.player` for level determination. Does NOT mutate STATE.
- **Events Emitted**: None.

### applyReward(reward)

- **Purpose**: Apply a selected reward to the player's state. Mutates `STATE.player` directly, then calls `recalculateStats()`.
- **Parameters**:
  - `reward` (`RewardObject`) — The reward object returned by `generateRewards()` or `generateMiniRewards()`.
- **Returns**: `void`
- **Side Effects**:
  - Mutates `STATE.player.equipSlots`, `.activeSkills`, `.activeFollowers`, or `.passiveBuffs`
  - Calls `recalculateStats()` which updates all effective stats
- **Events Emitted**: None (caller should emit `'reward:selected'` before calling)

### RewardObject Shape

```js
{
  id: string,           // "reward_{timestamp}_{index}"
  typeId: string,       // key into data table (e.g., 'thunder_strike', 'knight')
  name: string,         // display name (from data table `label`)
  description: string,  // human-readable description
  type: string,         // 'weapon'|'armor'|'accessory'|'skill'|'follower'|'buff'
  slot?: string,        // equipment slot (only for weapon/armor/accessory)
  level: number,        // integer >= 1
  stats: Object,        // pre-computed effective stats from scaleStats()
  cooldown?: number,    // skill cooldown in seconds (skills only)
  duration?: number,    // skill effect duration in seconds (skills only)
  effectType?: string,  // skill effect type (skills only)
}
```

## State Schema (读写 STATE 字段)

**Reads**:
- `STATE.player.equipSlots[weapon|armor|accessory]` — to check slot occupancy and current level
- `STATE.player.activeSkills[]` — to check owned skills and current level
- `STATE.player.activeFollowers[]` — to check owned followers and current level
- `STATE.player.passiveBuffs[]` — to check owned buffs and current level

**Writes** (via `applyReward`):
- `STATE.player.equipSlots[slot]` — sets `{ typeId, name, level, slot, stats }` on equipment reward
- `STATE.player.activeSkills[]` — pushes new skill or increments `.level` on existing
- `STATE.player.activeFollowers[]` — pushes new follower or increments `.level`, recalculates stats on existing
- `STATE.player.passiveBuffs[]` — pushes new buff or increments `.level`, recalculates stats on existing

## Events (订阅/发射的事件)

Does not subscribe to or emit any events directly. The caller (main.js or spawn-system.js) is responsible for emitting `'reward:trigger'`, `'reward:selected'`, etc.
