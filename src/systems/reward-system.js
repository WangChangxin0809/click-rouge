/**
 * Reward System — Generates reward options after boss kills.
 *
 * Uses real data tables (equipment, skills, followers, buffs) to generate
 * meaningful choices. Distribution: 30% equipment / 25% skills / 25% followers
 * / 20% passive buffs. Tier affects equipment quality and available options.
 *
 * Integration:
 *   boss:died event emits → generateRewards(bossTier) → showRewardPanel(...)
 *   Player picks → applyReward(reward) → recalculateStats() → STATE updated
 *
 * Design Doc: Reward System Phase 5 — Data-Driven Rewards
 *
 * Usage:
 *   import { generateRewards, applyReward } from './systems/reward-system.js';
 */

import { STATE } from '../core/game-state.js';
import { rng } from '../core/random.js';
import { EQUIPMENT } from '../data/equipment-data.js';
import { SKILLS } from '../data/skill-data.js';
import { FOLLOWERS } from '../data/follower-data.js';
import { FOLLOWER_DEFINITIONS } from '../data/follower-definitions.js';
import { BUFFS } from '../data/buff-data.js';
import { createFollower } from '../entities/follower.js';
import { BALANCE } from '../data/balance-config.js';
import { recalculateStats } from './progression-system.js';

// ---------------------------------------------------------------------------
// Reward type distribution (must sum to 1.0)
// ---------------------------------------------------------------------------

const TYPE_WEIGHTS = {
    equipment: 0.30,
    skill: 0.25,
    follower: 0.25,
    buff: 0.20,
};

// ---------------------------------------------------------------------------
// Reward generation
// ---------------------------------------------------------------------------

/**
 * Generate mini reward options for kill-based triggers (2 choices, pick 1).
 *
 * Unlike boss rewards, mini rewards are smaller in scope — 2 options instead of
 * 3-4. The tier caps at the provided value (1-4).
 *
 * @param {number} tier - Reward tier based on wave number (capped at 4)
 * @returns {Array<{id: string, name: string, description: string, type: string, tier: number, stats: Object, slot?: string}>}
 */
export function generateMiniRewards(tier) {
    const count = 2;
    const rewards = [];
    const timestamp = Date.now();

    for (let i = 0; i < count; i++) {
        const type = _pickRewardType();
        let reward;

        switch (type) {
            case 'equipment':
                reward = _generateEquipment(tier, timestamp, i);
                break;
            case 'skill':
                reward = _generateSkill(tier, timestamp, i);
                break;
            case 'follower':
                reward = _generateFollower(tier, timestamp, i);
                break;
            case 'buff':
                reward = _generateBuff(timestamp, i);
                break;
            default:
                reward = _generateEquipment(tier, timestamp, i);
        }

        rewards.push(reward);
    }

    return rewards;
}

/**
 * Generate reward options for the player to choose from (boss reward).
 *
 * @param {number} bossTier - Boss tier (1 = 3 choices, 2+ = 4 choices)
 * @returns {Array<{id: string, name: string, description: string, type: string, tier: number, stats: Object, slot?: string}>}
 */
export function generateRewards(bossTier) {
    const count = bossTier >= 2 ? 4 : 3;
    const rewards = [];
    const timestamp = Date.now();

    for (let i = 0; i < count; i++) {
        const type = _pickRewardType();
        let reward;

        switch (type) {
            case 'equipment':
                reward = _generateEquipment(bossTier, timestamp, i);
                break;
            case 'skill':
                reward = _generateSkill(bossTier, timestamp, i);
                break;
            case 'follower':
                reward = _generateFollower(bossTier, timestamp, i);
                break;
            case 'buff':
                reward = _generateBuff(timestamp, i);
                break;
            default:
                // Fallback
                reward = _generateEquipment(bossTier, timestamp, i);
        }

        rewards.push(reward);
    }

    return rewards;
}

/**
 * Apply a selected reward to the player's state.
 *
 * Mutates STATE.player directly, then calls recalculateStats().
 *
 * @param {Object} reward - The reward object from generateRewards()
 */
export function applyReward(reward) {
    switch (reward.type) {
        case 'weapon':
        case 'armor':
        case 'accessory': {
            // Place into equip slot, replace existing
            if (!STATE.player.equipSlots) {
                STATE.player.equipSlots = { weapon: null, armor: null, accessory: null };
            }
            STATE.player.equipSlots[reward.slot] = reward;
            break;
        }
        case 'skill': {
            if (!STATE.player.activeSkills) {
                STATE.player.activeSkills = [];
            }
            // Check for existing skill of the same id — offer upgrade (stack)
            const existingIdx = STATE.player.activeSkills.findIndex(
                s => s.id === reward.id
            );
            if (existingIdx >= 0) {
                // Upgrade: increment stack count
                const existing = STATE.player.activeSkills[existingIdx];
                existing.stack = (existing.stack || 1) + 1;
                existing.description = `${reward.description} (等级 ${existing.stack})`;
            } else {
                // New skill
                if (STATE.player.activeSkills.length < BALANCE.MAX_SKILL_SLOTS) {
                    STATE.player.activeSkills.push({
                        id: reward.id,
                        name: reward.name,
                        description: reward.description,
                        effectType: reward.effectType,
                        typeId: reward.typeId,
                        cooldown: reward.cooldown,
                        duration: reward.duration,
                        stack: 1,
                    });
                } else {
                    console.warn('[RewardSystem] Skill slots full, cannot add:', reward.name);
                }
            }
            break;
        }
        case 'follower': {
            if (!STATE.player.activeFollowers) {
                STATE.player.activeFollowers = [];
            }
            // Check for existing follower of the same typeId (key into FOLLOWER_DEFINITIONS)
            const existingIdx = STATE.player.activeFollowers.findIndex(
                f => f.typeId === reward.typeId
            );
            if (existingIdx >= 0) {
                // Upgrade: increment level and scale damage/heal
                const existing = STATE.player.activeFollowers[existingIdx];
                existing.level = (existing.level || 1) + 1;
                if (existing.damage) {
                    existing.damage = Math.round(existing.damage * 1.2);
                }
                if (existing.healAmount) {
                    existing.healAmount = Math.round(existing.healAmount * 1.2);
                }
            } else {
                if (STATE.player.activeFollowers.length < BALANCE.MAX_FOLLOWERS) {
                    const follower = createFollower(
                        reward.typeId,
                        FOLLOWER_DEFINITIONS,
                        STATE.player.activeFollowers.length,
                        BALANCE.MAX_FOLLOWERS
                    );
                    // Augment with level tracking for upgrade system
                    follower.level = 1;
                    STATE.player.activeFollowers.push(follower);
                } else {
                    console.warn('[RewardSystem] Follower slots full, cannot add:', reward.name);
                }
            }
            break;
        }
        case 'buff': {
            if (!STATE.player.passiveBuffs) {
                STATE.player.passiveBuffs = [];
            }
            // Buffs are always stackable — push a new instance
            STATE.player.passiveBuffs.push({
                id: reward.id,
                name: reward.name,
                description: reward.description,
                stats: { ...reward.stats },
                stackable: true,
            });
            break;
        }
        default:
            console.warn(`[RewardSystem] Unknown reward type: ${reward.type}`);
    }

    // Recalculate effective stats after applying the reward
    recalculateStats();
}

// ---------------------------------------------------------------------------
// Internal: type selection
// ---------------------------------------------------------------------------

/**
 * Pick a reward type based on configured weights.
 * @returns {'equipment'|'skill'|'follower'|'buff'}
 */
function _pickRewardType() {
    const roll = rng.next();
    let cumulative = 0;
    for (const [type, weight] of Object.entries(TYPE_WEIGHTS)) {
        cumulative += weight;
        if (roll < cumulative) {
            return type;
        }
    }
    return 'equipment'; // fallback
}

// ---------------------------------------------------------------------------
// Internal: specific reward generators
// ---------------------------------------------------------------------------

/**
 * Generate an equipment reward.
 *
 * Tier determines maximum equipment quality:
 *   tier 1 → can see tier 1-2 weapons/armor/accessories
 *   tier 2 → can see tier 1-3
 *   tier 3+ → can see tier 1-4
 *
 * Prefers filling empty slots or upgrading lower-tier equipment.
 *
 * @param {number} bossTier
 * @param {number} timestamp
 * @param {number} index
 * @returns {Object}
 */
function _generateEquipment(bossTier, timestamp, index) {
    // Determine available slots and their current tier
    const slots = ['weapon', 'armor', 'accessory'];
    const availableTiers = [];
    const slotInfo = [];

    for (const slot of slots) {
        const currentEquip = STATE.player.equipSlots?.[slot] || null;
        const currentTier = currentEquip ? currentEquip.tier : 0;
        slotInfo.push({ slot, currentTier, currentEquip });
    }

    // Determine max tier based on boss tier
    const maxEquipmentTier = Math.min(bossTier + 1, 4);

    // Build pool of eligible items: higher tier than current in the same slot
    /** @type {Array<{slot: string, item: Object}>} */
    const eligibleItems = [];

    for (const info of slotInfo) {
        const items = EQUIPMENT[info.slot] || [];
        for (const item of items) {
            if (item.tier <= maxEquipmentTier && item.tier > info.currentTier) {
                eligibleItems.push({ slot: info.slot, item });
            }
        }
    }

    // If no upgrades available, pick a random equipment from the current tier range
    if (eligibleItems.length === 0) {
        const slot = rng.pickOne(slots);
        const items = EQUIPMENT[slot] || [];
        // Pick an item at or below max tier
        const tierFiltered = items.filter(it => it.tier <= maxEquipmentTier);
        const item = tierFiltered.length > 0 ? rng.pickOne(tierFiltered) : items[0];
        return {
            id: `reward_${timestamp}_${index}`,
            name: item.name,
            description: _equipDescription(item),
            type: item.slot,
            tier: item.tier,
            slot: item.slot,
            stats: { ...item.stats },
        };
    }

    // Prefer empty slots or largest upgrade
    const emptySlotItems = eligibleItems.filter(
        e => !STATE.player.equipSlots?.[e.slot]
    );
    const chosen = emptySlotItems.length > 0
        ? rng.pickOne(emptySlotItems)
        : rng.pickOne(eligibleItems);

    return {
        id: `reward_${timestamp}_${index}`,
        name: chosen.item.name,
        description: _equipDescription(chosen.item),
        type: chosen.item.slot,
        tier: chosen.item.tier,
        slot: chosen.item.slot,
        stats: { ...chosen.item.stats },
    };
}

/**
 * Generate a skill reward.
 *
 * Only offers skills the player does not already have (or offers upgrade
 * for existing skills if all are owned).
 *
 * @param {number} bossTier
 * @param {number} timestamp
 * @param {number} index
 * @returns {Object}
 */
function _generateSkill(bossTier, timestamp, index) {
    const ownedIds = (STATE.player.activeSkills || []).map(s => s.id);

    // Skills unavailable until certain tiers
    const tierUnlock = bossTier >= 2
        ? SKILLS
        : SKILLS.filter(s => ['thunder_strike', 'heal', 'poison_blade'].includes(s.id));

    // Prefer unowned skills
    const unowned = tierUnlock.filter(s => !ownedIds.includes(s.id));

    let chosen;
    if (unowned.length > 0) {
        chosen = rng.pickOne(unowned);
    } else {
        // Player has all skills — offer upgrade for a random owned one
        const owned = tierUnlock.filter(s => ownedIds.includes(s.id));
        chosen = owned.length > 0 ? rng.pickOne(owned) : rng.pickOne(SKILLS);
    }

    return {
        id: `reward_${timestamp}_${index}`,
        name: chosen.name,
        description: chosen.description,
        type: 'skill',
        tier: bossTier,
        cooldown: chosen.cooldown,
        duration: chosen.duration,
        effectType: chosen.effectType,
        typeId: chosen.id,
        stats: {},
    };
}

/**
 * Generate a follower reward.
 *
 * @param {number} bossTier
 * @param {number} timestamp
 * @param {number} index
 * @returns {Object}
 */
function _generateFollower(bossTier, timestamp, index) {
    const ownedIds = (STATE.player.activeFollowers || []).map(f => f.id);

    // T2+ unlocks combat followers, T3+ unlocks support
    let available = FOLLOWERS;
    if (bossTier < 2) {
        available = FOLLOWERS.filter(f => f.id === 'knight' || f.id === 'healer_fairy');
    }
    if (bossTier < 3) {
        available = available.filter(f => f.type === 'combat');
    }

    // Prefer unowned
    const unowned = available.filter(f => !ownedIds.includes(f.id));

    let chosen;
    if (unowned.length > 0) {
        chosen = rng.pickOne(unowned);
    } else {
        // Offer upgrade for existing
        const owned = available.filter(f => ownedIds.includes(f.id));
        chosen = owned.length > 0 ? rng.pickOne(owned) : rng.pickOne(FOLLOWERS);
    }

    return {
        id: `reward_${timestamp}_${index}`,
        name: chosen.name,
        description: chosen.description,
        type: 'follower',
        tier: bossTier,
        typeId: chosen.id,
        stats: { ...chosen.stats },
    };
}

/**
 * Generate a passive buff reward.
 * All buffs are stackable and always available.
 *
 * @param {number} timestamp
 * @param {number} index
 * @returns {Object}
 */
function _generateBuff(timestamp, index) {
    // Pick any buff — all are stackable
    const chosen = rng.pickOne(BUFFS);

    return {
        id: `reward_${timestamp}_${index}`,
        name: chosen.name,
        description: chosen.description,
        type: 'buff',
        tier: 1,
        stats: { ...chosen.stats },
        stackable: true,
    };
}

// ---------------------------------------------------------------------------
// Internal: description helpers
// ---------------------------------------------------------------------------

/**
 * Build a human-readable stat description for an equipment item.
 * @param {Object} item
 * @returns {string}
 */
function _equipDescription(item) {
    const parts = [];
    const s = item.stats || {};

    if (s.atk) parts.push(`+${s.atk} 攻击`);
    if (s.maxHp) parts.push(`+${s.maxHp} 生命`);
    if (s.maxHpPercent) parts.push(`+${Math.round(s.maxHpPercent * 100)}% 生命`);
    if (s.critChance) parts.push(`+${Math.round(s.critChance * 100)}% 暴击率`);
    if (s.critMult) parts.push(`+${s.critMult} 暴击倍率`);
    if (s.goldMultiplier) parts.push(`+${Math.round(s.goldMultiplier * 100)}% 金币`);
    if (s.atkSpeedMult) parts.push(`+${Math.round(s.atkSpeedMult * 100)}% 攻速`);
    if (s.thorns) parts.push(`+${s.thorns} 反伤`);
    if (s.lifesteal) parts.push(`+${Math.round(s.lifesteal * 100)}% 吸血`);

    return parts.join('，') || '无特殊属性';
}
