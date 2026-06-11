/**
 * Level Configuration — Static data for the 5 game levels.
 *
 * Each level defines:
 *   - Metadata (name, description, recommendedAtk)
 *   - Clear reward (currently: unlock next level; level 5 has no reward)
 *   - Enemy / boss pools (type IDs referencing enemy-definitions.js / boss-definitions.js)
 *   - Difficulty tuning (multipliers, spawn intervals, boss timing)
 *
 * Usage:
 *   import { LEVELS } from '../data/level-config.js';
 *   const config = LEVELS[selectedLevelId];
 *   spawnSystem.configureEnemyPool(config.enemyPool, config.bossPool);
 */

/** @type {Object<number, Object>} */
export const LEVELS = {
    1: {
        id: 1,
        name: '翠绿草原',
        description: '史莱姆成群出没的平和草原',
        recommendedAtk: 10,
        clearReward: { type: 'unlock_level', levelId: 2 },
        bossesToClear: 1,
        enemyPool: ['slime'],
        bossPool: ['giant_slime'],
        difficultyMult: 1.0,
        goldMult: 1.0,
        firstBossTime: 20,
        bossInterval: 30,
        waveSize: 10,
        spawnIntervalInitial: 2.0,
        spawnIntervalDecay: 0.04,
    },
    2: {
        id: 2,
        name: '幽暗墓地',
        description: '骷髅与幽灵徘徊的墓地',
        recommendedAtk: 25,
        clearReward: { type: 'unlock_level', levelId: 3 },
        bossesToClear: 2,
        enemyPool: ['slime', 'bat', 'ghost'],
        bossPool: ['giant_slime', 'skeleton_king'],
        difficultyMult: 1.3,
        goldMult: 1.2,
        firstBossTime: 18,
        bossInterval: 25,
        waveSize: 10,
        spawnIntervalInitial: 1.8,
        spawnIntervalDecay: 0.04,
    },
    3: {
        id: 3,
        name: '烈焰火山',
        description: '火焰生物盘踞的灼热之地',
        recommendedAtk: 45,
        clearReward: { type: 'unlock_level', levelId: 4 },
        bossesToClear: 2,
        enemyPool: ['slime', 'bat', 'golem', 'fire_skull'],
        bossPool: ['skeleton_king', 'fire_dragon'],
        difficultyMult: 1.6,
        goldMult: 1.4,
        firstBossTime: 15,
        bossInterval: 22,
        waveSize: 12,
        spawnIntervalInitial: 1.6,
        spawnIntervalDecay: 0.04,
    },
    4: {
        id: 4,
        name: '极寒冰原',
        description: '刺骨寒风中的最终试炼',
        recommendedAtk: 70,
        clearReward: { type: 'unlock_level', levelId: 5 },
        bossesToClear: 3,
        enemyPool: ['bat', 'golem', 'ghost', 'fire_skull'],
        bossPool: ['skeleton_king', 'fire_dragon'],
        difficultyMult: 2.0,
        goldMult: 1.6,
        firstBossTime: 12,
        bossInterval: 20,
        waveSize: 15,
        spawnIntervalInitial: 1.4,
        spawnIntervalDecay: 0.04,
    },
    5: {
        id: 5,
        name: '深渊裂隙',
        description: '无尽黑暗中潜伏的古老存在',
        recommendedAtk: 100,
        clearReward: null,
        bossesToClear: 3,
        enemyPool: ['golem', 'ghost', 'fire_skull'],
        bossPool: ['skeleton_king', 'fire_dragon'],
        difficultyMult: 2.5,
        goldMult: 2.0,
        firstBossTime: 10,
        bossInterval: 18,
        waveSize: 20,
        spawnIntervalInitial: 1.2,
        spawnIntervalDecay: 0.04,
    },
};
