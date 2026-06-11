# ADR-005: Reward Generation and Application

## Status: Accepted

## Date: 2026-06-11

## Summary

Rewards are generated as option cards (2 for kill-trigger mini rewards, 3-4 for boss rewards) and applied to the player via `applyReward()`. Generation always produces Lv.1 for new entity types or `currentLevel + 1` for already-owned types. Equipment replacement overwrites the old item in the slot. Skills, followers, and buffs have independent slot limits enforced by `BALANCE` constants.

## Context

### Problem Statement

The reward system needs a deterministic, fair algorithm for generating upgrade options that:
- Offers meaningful choices (not just duplicates of owned max-level items)
- Respects per-type slot limits
- Scales reward quality with boss tier
- Handles the case where all slots are full

### Constraints

- Rewards must be generated synchronously (no async required for data lookup)
- Must use `rng` for deterministic randomness (seedable for testing)
- 30% equipment / 25% skill / 25% follower / 20% buff distribution
- Tier-based unlock pools for equipment, skill, and follower types

### Requirements

- Boss rewards: 3 choices at tier 1, 4 choices at tier 2+
- Mini rewards: 2 choices for kill-trigger events
- No reward should be a "downgrade" (lower level than current)
- Full slot detection: if all skills/followers are owned and slots are full, offer upgrades

## Decision

### Reward Type Distribution

Reward types are chosen with fixed weights:
- equipment: 30%
- skill: 25%
- follower: 25%
- buff: 20%

Weights are enforced via cumulative probability roll using `rng.next()`.

### Level Determination

For each reward candidate:
1. Check if player already owns an entity with the same `typeId`
2. If **not owned**: level = 1 (new acquisition)
3. If **owned** (same typeId): level = currentLevel + 1 (upgrade)
4. If **slot occupied by different typeId** (equipment only): level = 1 (sidegrade — replaces old)

### Equipment Generation

- Tier-based unlock: T1 unlocks first 2 items per slot, T2 unlocks 3, T3+ unlocks all 4
- Preference order: fill empty slots > upgrade existing (same typeId) > sidegrade (different typeId)
- Effective stats computed via `scaleStats(EQUIPMENT[typeId].base, EQUIPMENT[typeId].perLevel, level)`

### Skill Generation

- Tier-based unlock: T1 offers first 3 skills, T2+ offers all 6
- Preference: unowned skills first; if all owned, upgrade random owned
- Skill slot limit: `BALANCE.MAX_SKILL_SLOTS` (4)
- New skills added to `STATE.player.activeSkills` with cooldown tracking

### Follower Generation

- Tier-based unlock: T1 offers knight + healer_fairy, T2 adds archer, T3+ adds gold_magnet
- Preference: unowned first; if all owned, upgrade random owned
- Follower slot limit: `BALANCE.MAX_FOLLOWERS` (10)
- Uses `createFollower(typeId, FOLLOWERS, slotIndex, totalSlots, 1)` for instantiation

### Buff Generation

- Always available; picks random from `BUFF_IDS`
- Level = 1 if new, currentLevel + 1 if owned
- Stored in `STATE.player.passiveBuffs[]`
- Stats recomputed via `scaleStats()` at each application

### Apply Reward

`applyReward(reward)` mutates `STATE.player` directly, then calls `recalculateStats()`:
- Equipment: writes to `STATE.player.equipSlots[reward.slot]`
- Skill: pushes to `activeSkills[]` or increments existing entry's `level`
- Follower: pushes to `activeFollowers[]` or increments existing entry's `level` + recomputes stats
- Buff: pushes to `passiveBuffs[]` or increments existing entry's `level` + recomputes stats

### Key Interfaces

```js
// Generation
generateRewards(bossTier: number) → Array<RewardObject>
generateMiniRewards(tier: number) → Array<RewardObject>

// Application
applyReward(reward: RewardObject) → void

// RewardObject shape
{
  id: string,           // unique ID (timestamp + index)
  typeId: string,       // key into data table
  name: string,         // display name
  description: string,  // human-readable description
  type: string,         // 'weapon'|'armor'|'accessory'|'skill'|'follower'|'buff'
  slot?: string,        // equipment slot (weapon/armor/accessory)
  level: number,        // integer >= 1
  stats: Object,        // pre-computed effective stats from scaleStats()
  cooldown?: number,    // skill cooldown in seconds
  duration?: number,    // skill effect duration
  effectType?: string,  // skill effect type
}
```

## Alternatives Considered

### Alternative 1: Pure Random (no preference weighting)

- **Description**: Pick typeId uniformly at random; let duplicates just be duplicates.
- **Pros**: Simplest implementation.
- **Cons**: Player can get 3 copies of the same item in one reward screen; feels bad.
- **Rejection Reason**: Preference weighting (unowned > upgrade > sidegrade) gives better player experience.

### Alternative 2: Player Chooses Type

- **Description**: Let player first choose "I want an equipment/skill/follower/buff" then roll within that category.
- **Pros**: More player agency.
- **Cons**: Adds an extra selection step; disrupts flow; complicates UI.
- **Rejection Reason**: Single-step selection keeps flow fast. Distribution weights provide variety.

### Alternative 3: Level Based on Wave Number

- **Description**: Reward level = current wave number (or some function of it).
- **Pros**: Directly ties progression to difficulty.
- **Cons**: Ignores player's build choices; a player who invested in knights shouldn't get random high-level archers.
- **Rejection Reason**: Level should reflect investment in a specific entity, not global progress.

## Consequences

### Positive

- Predictable upgrade path: new entity = Lv.1, duplicate = +1 level
- No "wasted" rewards from hitting a level cap (no cap exists)
- Preference weighting ensures rewards feel relevant to player's build
- Tier-based unlock pools gate higher-tier content behind progression

### Negative

- Sidegrades (replacing a Lv.5 weapon with a Lv.1 weapon of different type) reset power — may feel punishing
- No "sell" or "discard" mechanic for unwanted rewards (player must pick something)
- Buff rewards always available; may crowd out equipment/skill/follower options over long sessions

### Risks

- **Risk**: Slot limits cause "no valid reward" state
  - **Mitigation**: Fallback always generates an equipment reward if the primary generation fails after 5 attempts
- **Risk**: Generated reward count mismatches card display expectations
  - **Mitigation**: `showRewardPanel()` handles any array length (2, 3, or 4 cards)

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| reward-system | Boss kills grant reward choices | `generateRewards(bossTier)` returns 3-4 options |
| reward-system | Kill milestones grant mini rewards | `generateMiniRewards(tier)` returns 2 options |
| balance-config | Type distribution: 30/25/25/20 | `TYPE_WEIGHTS` enforces fixed distribution |
| balance-config | Slot limits per entity type | `BALANCE.MAX_SKILL_SLOTS` / `BALANCE.MAX_FOLLOWERS` enforced at apply time |

## Performance Implications

- **CPU**: `generateRewards()` does 3-4 iterations with at most 5 retry attempts each. Trivial. `applyReward()` calls `scaleStats()` once per reward + `recalculateStats()` once. Both are O(N) with small N.
- **Memory**: Each reward object is ~10 keys. Generated arrays have 2-4 entries. Negligible.
- **Load Time**: No impact.

## Migration Plan

No migration needed — this is the initial design of the reward system. Existing code that called reward functions before this ADR should use the new unified `level` field per ADR-004.

## Validation Criteria

- All generated rewards have valid `level` >= 1
- Duplicate typeIds get `level = currentLevel + 1`
- First-time typeIds get `level = 1`
- Equipment sidegrades get `level = 1`
- Slot limits are enforced (no more than MAX_SKILL_SLOTS skills, etc.)
- `recalculateStats()` is called exactly once per `applyReward()`

## Related Decisions

- ADR-004: Unified Level System (defines the `level` field and `scaleStats()`)
- ADR-006: Stat Aggregation Formula (defines `recalculateStats()`)
- ADR-007: Data Table Design (defines data format for type definitions)
