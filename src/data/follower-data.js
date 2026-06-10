/**
 * Follower Data — Follower/pet definitions.
 *
 * Followers provide either combat assistance (auto-attack enemies) or
 * support effects (healing, gold collection). Followers are stored in
 * STATE.player.activeFollowers and can stack (same type increments count).
 *
 * Usage:
 *   import { FOLLOWERS } from '../data/follower-data.js';
 */

/**
 * @typedef {Object} FollowerDef
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} description - Tooltip text
 * @property {'combat'|'support'} type - Combat or support role
 * @property {Object} stats - Follower-specific stats
 */

/** @type {FollowerDef[]} */
export const FOLLOWERS = [
    {
        id: 'knight',
        name: '骑士',
        description: '近战攻击最近敌人',
        type: 'combat',
        stats: {
            damage: 5,
            attackInterval: 1.5,
        },
    },
    {
        id: 'archer',
        name: '弓箭手',
        description: '远程攻击随机敌人',
        type: 'combat',
        stats: {
            damage: 8,
            attackInterval: 2.0,
        },
    },
    {
        id: 'healer_fairy',
        name: '治疗精灵',
        description: '每秒回复 2 HP',
        type: 'support',
        stats: {
            healPerSecond: 2,
        },
    },
    {
        id: 'gold_magnet',
        name: '金币磁铁',
        description: '自动收集金币范围 +50%',
        type: 'support',
        stats: {
            collectionRangeBonus: 0.50,
        },
    },
];
