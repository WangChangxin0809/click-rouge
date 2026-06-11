/**
 * Meta-Progression System — localStorage persistence for cross-run upgrades.
 *
 * All permanent progression data (gold, stat upgrades, unlocked levels,
 * owned items) is stored in localStorage under a single key.
 * An in-memory cache (_meta) avoids repeated JSON.parse on every read.
 *
 * Usage:
 *   import { loadMeta, saveMeta, addPermanentGold, spendPermanentGold,
 *            purchaseStatUpgrade, recordRunComplete, applyMetaToPlayer,
 *            getEquipName, getAllOwned } from '../systems/meta-progression.js';
 *
 *   // At game init:
 *   loadMeta();
 *
 *   // After a run ends:
 *   recordRunComplete({ gold: 200, wave: 12, killCount: 45, bossKills: 2, time: 300 });
 *
 *   // Before a new run starts:
 *   applyMetaToPlayer(STATE.player);
 */

import { EQUIPMENT } from '../data/equipment-data.js';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** @type {Object|null} In-memory cache of the meta-progression data */
let _meta = null;

/** localStorage key */
const STORAGE_KEY = 'click_rouge_meta';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base gold cost per stat upgrade level */
const STAT_COSTS = {
    atk: 100,
    hp: 100,
    critChance: 150,
    critMult: 200,
    goldMult: 150,
    atkSpeed: 150,
};

/** Base gold cost for shop items (skill / follower / equip) */
const ITEM_COSTS = {
    skill: 300,
    follower: 300,
    equip: 200,
};

/** Stat amounts applied per purchase level */
const STAT_AMOUNTS = {
    atk: 3,
    hp: 10,
    critChance: 0.02,
    critMult: 0.1,
    goldMult: 0.05,
    atkSpeed: 0.03,
};

// ---------------------------------------------------------------------------
// Default meta object
// ---------------------------------------------------------------------------

const DEFAULT_META = {
    version: 1,
    permanentGold: 0,
    unlockedLevels: [1],
    completedLevels: [],
    statUpgrades: {
        atk: 0,
        hp: 0,
        critChance: 0,
        critMult: 0,
        goldMult: 0,
        atkSpeed: 0,
    },
    ownedSkills: {},
    ownedFollowers: {},
    ownedEquip: {},
    totalRuns: 0,
    totalKills: 0,
    bestWave: 0,
    bestTime: 0,
    levelBests: {},
};

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Load meta-progression data from localStorage.
 * On first run (no stored data), initialises with DEFAULT_META and persists it.
 * Handles JSON parse errors and version mismatches gracefully.
 *
 * @returns {Object} The loaded (or default) meta object.
 */
export function loadMeta() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            _meta = deepCloneMeta(DEFAULT_META);
            saveMeta();
            return _meta;
        }
        const parsed = JSON.parse(raw);
        // Version check — if stored version is behind, merge defaults (non-destructive)
        if (!parsed.version || parsed.version < DEFAULT_META.version) {
            _meta = deepCloneMeta(DEFAULT_META);
            // Preserve existing permanentGold and unlocked content
            if (parsed.permanentGold != null) _meta.permanentGold = parsed.permanentGold;
            if (parsed.unlockedLevels) _meta.unlockedLevels = [...parsed.unlockedLevels];
            if (parsed.completedLevels) _meta.completedLevels = [...parsed.completedLevels];
            if (parsed.statUpgrades) _meta.statUpgrades = deepCloneMeta(parsed.statUpgrades);
            if (parsed.ownedSkills) _meta.ownedSkills = deepCloneMeta(parsed.ownedSkills);
            if (parsed.ownedFollowers) _meta.ownedFollowers = deepCloneMeta(parsed.ownedFollowers);
            if (parsed.ownedEquip) _meta.ownedEquip = deepCloneMeta(parsed.ownedEquip);
            if (parsed.totalRuns != null) _meta.totalRuns = parsed.totalRuns;
            if (parsed.totalKills != null) _meta.totalKills = parsed.totalKills;
            if (parsed.bestWave != null) _meta.bestWave = parsed.bestWave;
            if (parsed.bestTime != null) _meta.bestTime = parsed.bestTime;
            if (parsed.levelBests) _meta.levelBests = deepCloneMeta(parsed.levelBests);
            _meta.version = DEFAULT_META.version;
            saveMeta();
            return _meta;
        }
        _meta = parsed;
        return _meta;
    } catch (_err) {
        // Corrupted data — reset to defaults
        _meta = deepCloneMeta(DEFAULT_META);
        saveMeta();
        return _meta;
    }
}

/**
 * Persist the current _meta object to localStorage.
 * Wrapped in try/catch to survive quota errors or private-browsing restrictions.
 */
export function saveMeta() {
    if (!_meta) return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_meta));
    } catch (_err) {
        // Silently fail — the game should still be playable without persistence.
        // Common causes: localStorage quota exceeded, private browsing denying write.
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safe deep-clone for meta objects (no functions, no cycles). */
function deepCloneMeta(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// ---------------------------------------------------------------------------
// Permanent Gold
// ---------------------------------------------------------------------------

/**
 * @returns {number} Current permanent gold balance.
 */
export function getPermanentGold() {
    return _meta ? _meta.permanentGold : 0;
}

/**
 * Add permanent gold (e.g. from run earnings).
 * @param {number} amount
 */
export function addPermanentGold(amount) {
    if (!_meta) return;
    _meta.permanentGold += amount;
    saveMeta();
}

/**
 * Spend permanent gold. Returns true if the transaction succeeded.
 * @param {number} amount
 * @returns {boolean}
 */
export function spendPermanentGold(amount) {
    if (!_meta) return false;
    if (_meta.permanentGold < amount) return false;
    _meta.permanentGold -= amount;
    saveMeta();
    return true;
}

// ---------------------------------------------------------------------------
// Stat Upgrades
// ---------------------------------------------------------------------------

/**
 * Get the current upgrade level for a stat key.
 * @param {string} key — 'atk', 'hp', 'critChance', 'critMult', 'goldMult', 'atkSpeed'
 * @returns {number}
 */
export function getStatLevel(key) {
    if (!_meta || !_meta.statUpgrades) return 0;
    return _meta.statUpgrades[key] || 0;
}

/**
 * Get the gold cost to purchase the next level of a stat.
 * Formula: baseCost * (1 + level * 0.5)
 * @param {string} key
 * @returns {number}
 */
export function getStatCost(key) {
    const base = STAT_COSTS[key] || 100;
    const level = getStatLevel(key);
    return Math.floor(base * (1 + level * 0.5));
}

/**
 * Attempt to purchase one level of a stat upgrade.
 * Deducts permanent gold, increments the stat level, and persists.
 * @param {string} key
 * @returns {boolean} true if purchased, false if insufficient gold.
 */
export function purchaseStatUpgrade(key) {
    if (!_meta) return false;
    const cost = getStatCost(key);
    if (!spendPermanentGold(cost)) return false;
    _meta.statUpgrades[key] = (_meta.statUpgrades[key] || 0) + 1;
    saveMeta();
    return true;
}

// ---------------------------------------------------------------------------
// Shop Items (Skills / Followers / Equip)
// ---------------------------------------------------------------------------

/**
 * Get the owned level for a shop item (skill / follower / equip).
 * @param {'skill'|'follower'|'equip'} type
 * @param {string} typeId — the item identifier (e.g. 'fireball', 'dagger')
 * @returns {number} Current owned level, 0 if not owned.
 */
export function getItemLevel(type, typeId) {
    if (!_meta) return 0;
    const repos = { skill: 'ownedSkills', follower: 'ownedFollowers', equip: 'ownedEquip' };
    const key = repos[type];
    if (!key || !_meta[key]) return 0;
    return _meta[key][typeId] || 0;
}

/**
 * Get the gold cost to purchase/upgrade a shop item.
 * Formula: baseCost * (1 + currentLevel * 0.5)
 * @param {'skill'|'follower'|'equip'} type
 * @param {string} typeId
 * @returns {number}
 */
export function getItemCost(type, typeId) {
    const base = ITEM_COSTS[type] || 300;
    const level = getItemLevel(type, typeId);
    return Math.floor(base * (1 + level * 0.5));
}

/**
 * Attempt to purchase or upgrade a shop item.
 * Increments the owned level by 1 (or sets to 1 on first purchase).
 * @param {'skill'|'follower'|'equip'} type
 * @param {string} typeId
 * @returns {boolean} true if purchased, false if insufficient gold.
 */
export function purchaseShopItem(type, typeId) {
    if (!_meta) return false;
    const cost = getItemCost(type, typeId);
    if (!spendPermanentGold(cost)) return false;
    const repos = { skill: 'ownedSkills', follower: 'ownedFollowers', equip: 'ownedEquip' };
    const key = repos[type];
    if (!key || !_meta[key]) return false;
    _meta[key][typeId] = (_meta[key][typeId] || 0) + 1;
    saveMeta();
    return true;
}

/**
 * Get the full owned item map for a given type.
 * @param {'skill'|'follower'|'equip'} type
 * @returns {Object} e.g. { fireball: 3, ice_spike: 2 }
 */
export function getAllOwned(type) {
    if (!_meta) return {};
    const repos = { skill: 'ownedSkills', follower: 'ownedFollowers', equip: 'ownedEquip' };
    const key = repos[type];
    return _meta[key] ? { ..._meta[key] } : {};
}

// ---------------------------------------------------------------------------
// Level Unlock / Completion
// ---------------------------------------------------------------------------

/**
 * Check whether a level is unlocked.
 * @param {number} levelId
 * @returns {boolean}
 */
export function isLevelUnlocked(levelId) {
    if (!_meta || !_meta.unlockedLevels) return levelId === 1;
    return _meta.unlockedLevels.includes(levelId);
}

/**
 * Unlock a level (no-op if already unlocked).
 * @param {number} levelId
 */
export function unlockLevel(levelId) {
    if (!_meta) return;
    if (!_meta.unlockedLevels.includes(levelId)) {
        _meta.unlockedLevels.push(levelId);
        saveMeta();
    }
}

/**
 * Mark a level as completed.
 * @param {number} levelId
 */
export function completeLevel(levelId) {
    if (!_meta) return;
    if (!_meta.completedLevels.includes(levelId)) {
        _meta.completedLevels.push(levelId);
    }
    // Track best for this level
    if (!_meta.levelBests) _meta.levelBests = {};
    saveMeta();
}

// ---------------------------------------------------------------------------
// Run Completion / Settlement
// ---------------------------------------------------------------------------

/**
 * Record the results of a completed run.
 * Computes permanent gold earnings and updates run statistics.
 *
 * Permanent gold formula: floor(gold * 0.15) + wave * 2 + bossKills * 10
 *
 * @param {Object} stats
 * @param {number} stats.gold      — Gold earned this run
 * @param {number} stats.wave      — Wave reached
 * @param {number} stats.killCount — Enemies killed
 * @param {number} stats.bossKills — Bosses killed (default 0)
 * @param {number} stats.time      — Run duration in seconds
 * @param {number} [stats.levelId] — Which level was played (for levelBests)
 * @returns {number} Amount of permanent gold earned from this run.
 */
export function recordRunComplete(stats) {
    if (!_meta) return 0;

    const goldEarned = Math.floor(stats.gold * 0.15) + stats.wave * 2 + (stats.bossKills || 0) * 10;

    _meta.permanentGold += goldEarned;
    _meta.totalRuns += 1;
    _meta.totalKills += stats.killCount || 0;

    if (stats.wave > _meta.bestWave) _meta.bestWave = stats.wave;
    if (stats.time > _meta.bestTime) _meta.bestTime = stats.time;

    // Track level best
    if (stats.levelId != null) {
        if (!_meta.levelBests) _meta.levelBests = {};
        const prev = _meta.levelBests[stats.levelId];
        if (!prev || stats.wave > prev.wave || (stats.wave === prev.wave && stats.gold > prev.gold)) {
            _meta.levelBests[stats.levelId] = {
                wave: stats.wave,
                time: stats.time || 0,
                gold: stats.gold || 0,
                kills: stats.killCount || 0,
            };
        }
    }

    saveMeta();
    return goldEarned;
}

// ---------------------------------------------------------------------------
// Apply Meta to Player State
// ---------------------------------------------------------------------------

/**
 * Apply permanent stat upgrades to a player state object.
 * Called before a new run starts (typically in game-state reset).
 *
 * Modifies playerState in-place:
 *   - baseAtk += atkLevel * STAT_AMOUNTS.atk
 *   - maxHp  += hpLevel * STAT_AMOUNTS.hp
 *   - critChance += critChanceLevel * STAT_AMOUNTS.critChance
 *   - critMult   += critMultLevel * STAT_AMOUNTS.critMult
 *   - goldMultiplier += goldMultLevel * STAT_AMOUNTS.goldMult
 *   - atkSpeedMult += atkSpeedLevel * STAT_AMOUNTS.atkSpeed
 *
 * @param {Object} playerState — STATE.player (mutated in-place)
 */
export function applyMetaToPlayer(playerState) {
    if (!_meta || !_meta.statUpgrades) return;

    const su = _meta.statUpgrades;
    playerState.baseAtk   += (su.atk        || 0) * STAT_AMOUNTS.atk;
    playerState.maxHp     += (su.hp         || 0) * STAT_AMOUNTS.hp;
    playerState.critChance    += (su.critChance || 0) * STAT_AMOUNTS.critChance;
    playerState.critMult      += (su.critMult   || 0) * STAT_AMOUNTS.critMult;
    playerState.goldMultiplier += (su.goldMult   || 0) * STAT_AMOUNTS.goldMult;
    playerState.atkSpeedMult  += (su.atkSpeed   || 0) * STAT_AMOUNTS.atkSpeed;

    // Sync derived fields
    playerState.atk      = playerState.baseAtk;
    playerState.clickAtk = playerState.baseAtk;
    playerState.hp       = playerState.maxHp;
}

// ---------------------------------------------------------------------------
// Owned Item Level Update (for loadout persistence)
// ---------------------------------------------------------------------------

/**
 * Directly set the owned level of an item (e.g. after a loadout change).
 * @param {'skill'|'follower'|'equip'} type
 * @param {string} typeId
 * @param {number} newLevel
 */
export function updateOwnedItemLevel(type, typeId, newLevel) {
    if (!_meta) return;
    const repos = { skill: 'ownedSkills', follower: 'ownedFollowers', equip: 'ownedEquip' };
    const key = repos[type];
    if (!key || !_meta[key]) return;
    if (newLevel <= 0) {
        delete _meta[key][typeId];
    } else {
        _meta[key][typeId] = newLevel;
    }
    saveMeta();
}

// ---------------------------------------------------------------------------
// Equipment Name Lookup
// ---------------------------------------------------------------------------

/**
 * Get the display name of an equipment piece based on its slot and level.
 * Reads the "names" thresholds from equipment-data.js to determine which
 * name tier applies.
 *
 * @param {'weapon'|'armor'|'accessory'} slot
 * @param {number} level
 * @returns {string} The display name for this level (e.g. '铁剑' for weapon Lv.5).
 */
export function getEquipName(slot, level) {
    const names = (EQUIPMENT && EQUIPMENT[slot] && EQUIPMENT[slot].names) || [];

    let bestName = names[0] ? names[0].name : '未知装备';
    for (const tier of names) {
        if (level >= tier.minLevel) {
            bestName = tier.name;
        }
    }
    return bestName;
}
