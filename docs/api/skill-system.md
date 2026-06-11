# skill-system.js API

## Overview

Manages skill cooldowns, activation, and effect lifecycles. Skills are activated via hotkeys (1-4) or auto-cast. Each skill has a `typeId`, `level`, `cooldown`, and effect values computed from `SKILLS` data via `scaleStats()`. Time-limited effects are tracked in `STATE.activeEffects[]` and reverted on expiration.

**File**: `src/systems/skill-system.js`

## Imports (依赖)

| Module | Usage |
|--------|-------|
| `../core/game-state.js` | `STATE` — player state, activeEffects, enemies |
| `../core/event-bus.js` | `events` — emit skill activation and effect events |
| `../data/skill-data.js` | `SKILLS` — skill definitions (base + perLevel) |
| `../data/level-scaling.js` | `scaleStats` — compute effective stats from level |
| `../entities/enemy.js` | `damageEnemy` — apply damage to enemies (Thunder Strike) |
| `./combat-system.js` | `awardGold` — gold rewards from kills |

## Exports (导出的函数/类)

### initSkillSystem()

- **Purpose**: Initialize the skill system for a new game run. Resets all cooldowns and clears effect tracking. Must be called after `STATE.reset()`.
- **Parameters**: None
- **Returns**: `void`
- **Side Effects**:
  - Sets `STATE.activeEffects = []`
  - Sets `STATE.player.goldMultiplier = 1.0`
  - Sets `STATE.player.poisonBladeDamage = 0`
  - Resets `_cooldownRemaining` and `_cooldownTotal` on all skills in `STATE.player.activeSkills`
- **Events Emitted**: None.

### updateSkillSystem(dt)

- **Purpose**: Advance skill cooldowns and manage active effects. Must be called once per frame during the 'playing' phase.
- **Parameters**:
  - `dt` (`number`) — Delta time in seconds.
- **Returns**: `void`
- **Side Effects**:
  - Decrements `_cooldownRemaining` on each skill
  - Resets `_autoCastGuard` on each skill
  - Decrements `timer` on each active effect; reverts expired effects
  - Updates freeze countdown on individual frozen enemies
- **Events Emitted**: `'skill:berserk_end'`, `'skill:gold_rush_end'`, `'skill:freeze_end'` — emitted when effects expire.

### activateSkill(slotIndex)

- **Purpose**: Activate the skill in the given hotkey slot (1-4). Uses `scaleStats(skill.level)` to compute effective values.
- **Parameters**:
  - `slotIndex` (`number`) — Hotkey slot number (1 = first skill, 2 = second, etc.).
- **Returns**: `void`
- **Side Effects**:
  - Applies skill effect (damage, freeze, berserk, heal, poison, gold rush)
  - Starts cooldown timer (`_cooldownRemaining = def.cooldown`)
  - May modify `STATE.player` stats (berserk: atkSpeedMult, gold_rush: goldMultiplier, heal: hp, poison_blade: poisonBladeDamage)
  - May modify `STATE.enemies` (thunder_strike: damage, freeze: speed = 0)
  - May push to `STATE.activeEffects` (for time-limited effects)
- **Events Emitted**: `'skill:activated'`, plus per-type events (`'skill:thunder'`, `'skill:freeze'`, `'skill:berserk'`, `'player:healed'`, `'skill:poison_blade'`, `'skill:gold_rush'`).

### updateAutoCast(dt)

- **Purpose**: Auto-cast ready skills on each frame. Iterates skill slots 1-4; if a slot's cooldown is complete, activates it.
- **Parameters**:
  - `dt` (`number`) — Delta time in seconds (currently unused, reserved for future use).
- **Returns**: `void`
- **Side Effects**: Calls `activateSkill()` for each ready skill.
- **Events Emitted**: Indirectly, via `activateSkill()`.

## Skill Types and Effects

| Skill | Effect Type | What It Does | Scaling Keys |
|-------|-------------|--------------|--------------|
| thunder_strike | instant AOE | Damages all alive enemies | aoeDamage |
| freeze | timed effect | Sets all enemy speed to 0 for duration | freezeDuration |
| berserk | timed effect | Increases atkSpeedMult for duration | speedBonus |
| heal | instant | Restores `maxHp * healPercent` HP | healPercent |
| poison_blade | instant buff | Adds extra damage to next click | extraDamage |
| gold_rush | timed effect | Multiplies gold earnings for duration | goldMultiplier |

## State Schema (读写 STATE 字段)

**Reads**:
- `STATE.player.activeSkills[]` — skill list with typeId, level, cooldown state
- `STATE.player.atkSpeedMult` — modified by berserk
- `STATE.player.goldMultiplier` — modified by gold_rush
- `STATE.player.maxHp`, `.hp` — used by heal
- `STATE.player.poisonBladeDamage` — accumulated poison damage
- `STATE.enemies[]` — targeted by thunder_strike and freeze

**Writes**:
- `STATE.activeEffects[]` — pushed/removed as effects start/expire
- `STATE.player.hp` — increased by heal
- `STATE.player.atkSpeedMult` — modified by berserk (start/end)
- `STATE.player.goldMultiplier` — modified by gold_rush (start/end)
- `STATE.player.poisonBladeDamage` — accumulated by poison_blade, consumed by combat-system
- `STATE.enemies[].hp` — reduced by thunder_strike
- `STATE.enemies[].speed`, `.frozen`, `.frozenTimer`, `._originalSpeed` — modified by freeze

## Events (订阅/发射的事件)

**Emits**:
- `'skill:activated'` — payload: `{ slot, typeId, name }`
- `'skill:thunder'` — payload: `{ hitCount }`
- `'skill:freeze'` — payload: `{ frozenCount, duration }`
- `'skill:freeze_end'` — payload: `null`
- `'skill:berserk'` — payload: `{ duration }`
- `'skill:berserk_end'` — payload: `null`
- `'skill:gold_rush'` — payload: `{ duration }`
- `'skill:gold_rush_end'` — payload: `null`
- `'skill:poison_blade'` — payload: `{ extraDamage }`
- `'player:healed'` — payload: `{ amount, source }` (source = 'skill_heal')
- `'enemy:died'` — payload: `{ enemy, damage, isCrit: false, overkill, position }` (via thunder_strike kills)
- `'enemy:hit'` — payload: `{ enemy, damage, isCrit: false, overkill, position }` (via thunder_strike hits)

**Subscribes**: Does not subscribe to any events.
