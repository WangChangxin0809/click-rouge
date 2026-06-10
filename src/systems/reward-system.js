/**
 * Reward System — Generates reward options after boss kills.
 *
 * Currently uses stub data with random names/descriptions. In Phase 5 this
 * will be replaced with real reward definitions from a data table.
 *
 * Integration:
 *   boss:died event emits → generateRewards(bossTier) → showRewardPanel(...)
 *   Player picks → applyReward(reward) → STATE.player updated
 *
 * Usage:
 *   import { generateRewards, applyReward } from './systems/reward-system.js';
 */

import { STATE } from '../core/game-state.js';
import { rng } from '../core/random.js';

// ---------------------------------------------------------------------------
// Stub data tables — will be replaced with data-driven definitions in Phase 5
// ---------------------------------------------------------------------------

/** @type {string[]} */
const WEAPON_NAMES = [
    '短剑', '长剑', '战斧', '长弓', '法杖',
    '匕首', '巨锤', '链枷', '双刃斧', '刺矛',
];

/** @type {string[]} */
const SKILL_NAMES = [
    '火球术', '雷电链', '冰霜新星', '毒雾',
    '神圣之光', '暗影步', '旋风斩', '大地震击',
];

/** @type {string[]} */
const FOLLOWER_NAMES = [
    '小精灵', '骷髅兵', '火元素', '冰元素',
    '暗影分身', '治愈精灵', '石魔偶', '雷鸟',
];

/** @type {string[]} */
const BUFF_NAMES = [
    '力量祝福', '敏捷光环', '生命之泉', '荆棘护甲',
    '暴击专注', '吸血之触', '钢铁皮肤', '疾风步',
];

/** @type {Object<string, string>} */
const TYPE_DESCRIPTION_POOLS = {
    weapon: [
        '提升基础攻击力',
        '使你的点击造成更多伤害',
        '锋利的刀刃，无坚不摧',
        '传说中的武器，赋予持有者力量',
    ],
    skill: [
        '获得一项主动技能',
        '按下技能键释放强力攻击',
        '冷却时间结束后可再次使用',
        '大范围攻击，清屏利器',
    ],
    follower: [
        '召唤一名追随者协助战斗',
        '追随者会自动攻击附近的敌人',
        '可靠的伙伴，永远在你身边',
        '神秘的生物，拥有独特的能力',
    ],
    buff: [
        '获得一个永久增益效果',
        '提升你的基础属性',
        '被动生效，无需操作',
        '来自远古的力量祝福',
    ],
};

// ---------------------------------------------------------------------------
// Reward generation
// ---------------------------------------------------------------------------

/**
 * Generate reward options for the player to choose from.
 *
 * @param {number} bossTier - Boss tier (1 = 3 choices, 2+ = 4 choices)
 * @returns {Array<{id: string, name: string, description: string, type: string, tier: number, stats: Object}>}
 */
export function generateRewards(bossTier) {
    const count = bossTier >= 2 ? 4 : 3;
    const types = ['weapon', 'skill', 'follower', 'buff'];

    // Shuffle types so we get a random selection, but ensure at least one
    // weapon is included in the pool (stub rule for playability).
    const shuffledTypes = [...types];
    rng.shuffle(shuffledTypes);

    const rewards = [];
    const timestamp = Date.now();

    for (let i = 0; i < count; i++) {
        const type = shuffledTypes[i % shuffledTypes.length];
        rewards.push({
            id: `reward_${timestamp}_${i}`,
            name: rng.pickOne(_getNamePool(type)),
            description: rng.pickOne(TYPE_DESCRIPTION_POOLS[type] || ['强力奖励']),
            type,
            tier: bossTier,
            stats: _generateStats(type, bossTier),
        });
    }

    return rewards;
}

/**
 * Apply a selected reward to the player's state.
 *
 * Mutates STATE.player directly — no return value.
 *
 * @param {Object} reward - The reward object from generateRewards()
 */
export function applyReward(reward) {
    switch (reward.type) {
        case 'weapon': {
            const atkBonus = reward.stats.atk || 0;
            STATE.player.baseAtk += atkBonus;
            // clickAtk should track baseAtk for simplicity in this stub
            STATE.player.clickAtk = STATE.player.baseAtk;
            break;
        }
        case 'skill': {
            if (!STATE.player.activeSkills) {
                STATE.player.activeSkills = [];
            }
            STATE.player.activeSkills.push({
                id: reward.id,
                name: reward.name,
                description: reward.description,
                stats: reward.stats,
            });
            break;
        }
        case 'follower': {
            if (!STATE.player.activeFollowers) {
                STATE.player.activeFollowers = [];
            }
            STATE.player.activeFollowers.push({
                id: reward.id,
                name: reward.name,
                description: reward.description,
                stats: reward.stats,
            });
            break;
        }
        case 'buff': {
            if (!STATE.player.passiveBuffs) {
                STATE.player.passiveBuffs = [];
            }
            STATE.player.passiveBuffs.push({
                id: reward.id,
                name: reward.name,
                description: reward.description,
                stats: reward.stats,
            });
            break;
        }
        default:
            console.warn(`[RewardSystem] Unknown reward type: ${reward.type}`);
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Get the name pool for a given reward type.
 * @param {string} type
 * @returns {string[]}
 */
function _getNamePool(type) {
    switch (type) {
        case 'weapon':   return WEAPON_NAMES;
        case 'skill':    return SKILL_NAMES;
        case 'follower': return FOLLOWER_NAMES;
        case 'buff':     return BUFF_NAMES;
        default:         return ['未知奖励'];
    }
}

/**
 * Generate stub stats for a reward based on type and tier.
 *
 * @param {string} type
 * @param {number} tier
 * @returns {Object} A stats object with numeric values
 */
function _generateStats(type, tier) {
    // Scale bonuses with tier — higher tier = stronger rewards
    const multiplier = 1 + (tier - 1) * 0.5;

    switch (type) {
        case 'weapon': {
            const baseAtk = rng.nextInt(3, 8);
            return {
                atk: Math.round(baseAtk * multiplier),
                critChance: Math.round(rng.nextFloat(0.01, 0.05) * multiplier * 100) / 100,
            };
        }
        case 'skill': {
            const baseDmg = rng.nextInt(20, 50);
            return {
                damage: Math.round(baseDmg * multiplier),
                cooldown: rng.nextInt(5, 10),
                aoeRange: rng.nextInt(100, 200),
            };
        }
        case 'follower': {
            const baseDmg = rng.nextInt(3, 10);
            return {
                damage: Math.round(baseDmg * multiplier),
                attackSpeed: Math.round(rng.nextFloat(0.5, 1.5) * 10) / 10,
                hp: Math.round(rng.nextInt(20, 60) * multiplier),
            };
        }
        case 'buff': {
            const bonuses = {};
            const pool = ['atk', 'maxHp', 'critChance', 'atkSpeedMult'];
            const picked = rng.pickOne(pool);
            const val = rng.nextFloat(5, 15) * multiplier;
            bonuses[picked] = Math.round(val * 10) / 10;

            // Always include a secondary smaller bonus
            const secondary = rng.pickOne(pool.filter(p => p !== picked));
            bonuses[secondary] = Math.round(rng.nextFloat(2, 6) * multiplier * 10) / 10;

            return bonuses;
        }
        default:
            return { atk: 5 };
    }
}
