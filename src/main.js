/**
 * main.js — Click Rouge game bootstrap.
 *
 * Initializes and wires together the core modules:
 *   GameLoop, GameState, EventBus, CanvasRenderer.
 * Binds input events and UI button handlers.
 */

import { GameLoop } from './core/game-loop.js';
import { STATE } from './core/game-state.js';
import { events } from './core/event-bus.js';
import { CanvasRenderer, DESIGN_WIDTH, DESIGN_HEIGHT } from './rendering/canvas-renderer.js';
import { preloadSprites } from './rendering/sprite-loader.js';
import { initSpawnSystem, updateSpawnSystem } from './systems/spawn-system.js';
import { updateDifficulty } from './systems/difficulty-system.js';
import { updateCombatSystem } from './systems/combat-system.js';
import { initEconomySystem, updateEconomySystem } from './systems/economy-system.js';
import { updateParticles, burstHit, burstDeath, burstCrit, burstThunder, burstFreeze, burstHeal, burstPoison, triggerScreenFlash, updateScreenFlash, triggerLightningStrike, triggerBerserkVignette, burstGoldRain, updateSkillVFX } from './rendering/fx-renderer.js';
import { updateShake, triggerShake } from './rendering/screen-shake.js';
import { initAudio, playHit, playCrit, playDeath } from './audio/audio-manager.js';
import { startMenuBGM, startBattleBGM, stopBGM, resumeBGM } from './audio/bgm.js';
import { showDamageNumber, showGoldNumber, showMissText } from './ui/damage-numbers.js';
import { generateRewards, generateMiniRewards, applyReward } from './systems/reward-system.js';
import { showRewardPanel, hideRewardPanel } from './ui/reward-panel.js';
import { updateSkillBar, setSkillSlots } from './ui/skill-bar.js';
import { updateEquipmentPanel } from './ui/equipment-panel.js';
import { initSkillSystem, updateSkillSystem, activateSkill, updateAutoCast } from './systems/skill-system.js';
import { updateAllFollowers } from './entities/follower.js';
import { updateProjectiles, clearProjectiles } from './entities/projectile.js';
import { addNotification, updateNotificationLog } from './ui/notification-log.js';
import { ENEMY_TYPES } from './data/enemy-definitions.js';
import { BOSS_TYPES } from './data/boss-definitions.js';
import { initMainMenu, showMainMenu } from './ui/main-menu.js';
import { initLevelSelect, showLevelSelect } from './ui/level-select.js';
import { initShopPanel, showShopPanel } from './ui/shop-panel.js';
import { initLoadoutPanel, showLoadoutPanel } from './ui/loadout-panel.js';
import { initSettlementPanel, showSettlement, cacheRunConfig } from './ui/settlement-panel.js';
import { loadMeta, recordRunComplete, getItemLevel, unlockLevel } from './systems/meta-progression.js';
import { LEVELS } from './data/level-config.js';
import { SKILLS } from './data/skill-data.js';
import { scaleStats } from './data/level-scaling.js';
import { createFollower } from './entities/follower.js';
import { FOLLOWERS } from './data/follower-data.js';
import { EQUIPMENT } from './data/equipment-data.js';
import { recalculateStats } from './systems/progression-system.js';

// ---------------------------------------------------------------------------
// DOM element references
// ---------------------------------------------------------------------------

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game-canvas'));
const startScreen = document.getElementById('start-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const btnStart = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');

// HUD elements
const hpBarFill = document.getElementById('hp-bar-fill');
const hpText = document.getElementById('hp-text');
const goldValue = document.getElementById('gold-value');
const waveValue = document.getElementById('wave-value');
const timeValue = document.getElementById('time-value');

// Pause overlay
const pauseOverlay = document.getElementById('pause-overlay');
const btnPause = document.getElementById('btn-pause');
const btnPauseResume = document.getElementById('btn-pause-resume');
const btnPauseQuit = document.getElementById('btn-pause-quit');

btnPause.addEventListener('click', togglePause);

// Game-over stat elements
const statTime = document.getElementById('stat-time');
const statWave = document.getElementById('stat-wave');
const statKills = document.getElementById('stat-kills');
const statGold = document.getElementById('stat-gold');

// ---------------------------------------------------------------------------
// Click queue — stores click coordinates for gameplay systems to consume
// ---------------------------------------------------------------------------

if (!STATE.clickQueue) {
    STATE.clickQueue = [];
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

const renderer = new CanvasRenderer(canvas);

// ---------------------------------------------------------------------------
// Game loop — update + render
// ---------------------------------------------------------------------------

/**
 * Per-frame update callback.
 * @param {number} dt - Delta time in seconds
 */
function update(dt) {
    if (STATE.gameStatus !== 'playing') return;

    STATE.elapsedTime += dt;

    // Update difficulty before systems that consume it (spawn, etc.)
    updateDifficulty(dt);

    updateSpawnSystem(dt);

    // Player death detection — check after spawn/combat may deal damage
    if (STATE.player.hp <= 0) {
        STATE.player.hp = 0;
        STATE.gameStatus = 'gameOver';
        gameLoop.stop();
        events.emit('game:triggerGameOver');
        return;
    }

    updateCombatSystem();
    updateSkillSystem(dt);
    updateAutoCast(dt);
    updateAllFollowers(dt, STATE.enemies);
    updateProjectiles(dt);
    updateEconomySystem(dt);
    updateParticles(dt);
    updateShake(dt);
    updateScreenFlash(dt);
    updateSkillVFX(dt);
    updateNotificationLog(dt);
}

/**
 * Per-frame render callback.
 */
function render() {
    renderer.clear();
    renderer.render(STATE);
    updateHudDom();
}

const gameLoop = new GameLoop(update, render);

// ---------------------------------------------------------------------------
// Screen navigation
// ---------------------------------------------------------------------------

/**
 * Show a named screen, hiding all others.
 * Delegates content refresh to the corresponding show function.
 * @param {string} name — screen element ID (e.g. 'main-menu', 'level-select')
 */
function showScreen(name) {
    // Skip if already showing this screen
    const current = document.querySelector('.screen.active');
    if (current && current.id === name) return;

    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // Show the target screen
    const el = document.getElementById(name);
    if (el) el.classList.add('active');

    // Switch to menu BGM when showing non-combat screens
    if (name !== 'loadout-panel' || (STATE._loadoutMode === 'config')) {
        startMenuBGM();
    }

    // Delegate content refresh to the appropriate show function
    if (name === 'main-menu') showMainMenu();
    if (name === 'level-select') showLevelSelect();
    if (name === 'shop-panel') showShopPanel();
    if (name === 'loadout-panel') showLoadoutPanel(STATE._selectedLevelId, STATE._loadoutMode || 'battle');
    if (name === 'settlement-panel') { /* shown by endGame → showSettlement */ }
}

// ---------------------------------------------------------------------------
// HUD DOM update
// ---------------------------------------------------------------------------

/**
 * Sync HUD DOM elements with current STATE values.
 * Called each frame during render.
 */
function updateHudDom() {
    const p = STATE.player;

    // HP bar
    const hpPercent = Math.max(0, (p.hp / p.maxHp) * 100);
    hpBarFill.style.width = hpPercent + '%';
    hpText.textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;

    // Gold
    goldValue.textContent = String(p.gold);

    // Wave
    waveValue.textContent = String(STATE.wave);

    // Elapsed time (mm:ss format)
    const totalSec = Math.floor(STATE.elapsedTime);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    timeValue.textContent = `${min}:${String(sec).padStart(2, '0')}`;

    // Skill bar cooldowns
    updateSkillBar();

    // Equipment panel
    updateEquipmentPanel();
}

// ---------------------------------------------------------------------------
// Input binding
// ---------------------------------------------------------------------------

/**
 * Handle canvas click — record coordinates for gameplay systems.
 * @param {MouseEvent} e
 */
function handleCanvasClick(e) {
    resumeBGM();
    if (STATE.gameStatus !== 'playing') return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = DESIGN_WIDTH / rect.width;
    const scaleY = DESIGN_HEIGHT / rect.height;

    STATE.clickQueue.push({
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        time: STATE.elapsedTime,
    });

    // Emit event for gameplay systems
    events.emit('input:click', {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
    });
}

/**
 * Handle keyboard input for skill shortcuts (keys 1-4).
 * @param {KeyboardEvent} e
 */
function handleKeyDown(e) {
    // Ignore if user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (STATE.gameStatus !== 'playing') {
        // Allow Enter/Space to start the game when on start screen
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (STATE.gameStatus === 'start' || STATE.gameStatus === 'gameOver') {
                startGame();
            }
        }
        return;
    }

    // Skill hotkeys 1-4
    if (e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        events.emit('skill:activate', { slot: parseInt(e.key, 10) });
        return;
    }

    // Escape to toggle pause
    if (e.key === 'Escape') {
        e.preventDefault();
        togglePause();
    }
}

canvas.addEventListener('click', handleCanvasClick);
window.addEventListener('keydown', handleKeyDown);

// ---------------------------------------------------------------------------
// Game flow — start / end
// ---------------------------------------------------------------------------

/**
 * Start (or restart) a new game run.
 */
let _lastStartConfig = null;

function startGame(config = {}) {
    hideRewardPanel();
    _lastStartConfig = config;
    cacheRunConfig(config);
    STATE.reset();
    STATE.gameStatus = 'playing';
    STATE.clickQueue = [];
    STATE._bossKills = 0;
    STATE._levelBossKills = 0;
    if (config.levelId) {
        STATE._selectedLevelId = config.levelId;
        STATE.levelConfig = LEVELS[config.levelId] || null;
    }
    if (config.skills && config.skills.length > 0) {
        STATE.player.activeSkills = [];
        for (const typeId of config.skills) {
            const def = SKILLS[typeId];
            if (!def) continue;
            const level = getItemLevel('skill', typeId) || 1;
            const scaled = scaleStats(def.base, def.perLevel, level);
            STATE.player.activeSkills.push({
                id: 'skill_' + typeId, typeId, name: def.label,
                description: def.description + ' (Lv.' + level + ')',
                cooldown: scaled.cooldown || def.cooldown, level,
                _cooldownRemaining: 0, _cooldownTotal: 0,
            });
        }
        setSkillSlots(STATE.player.activeSkills);
    }
    if (config.followers && config.followers.length > 0) {
        STATE.player.activeFollowers = [];
        for (const typeId of config.followers) {
            const f = createFollower(typeId, FOLLOWERS, STATE.player.activeFollowers.length, config.followers.length);
            if (f) STATE.player.activeFollowers.push(f);
        }
    }
    if (config.equipment) {
        const e = config.equipment;
        if (e.weapon) {
            const def = EQUIPMENT.weapon;
            const lv = getItemLevel('equip', e.weapon) || 1;
            STATE.player.equipSlots.weapon = {
                typeId: e.weapon, level: lv, slot: 'weapon',
                name: def ? def.name : '武器',
                stats: def ? scaleStats(def.base, def.perLevel, lv) : {},
            };
        }
        if (e.armor) {
            const def = EQUIPMENT.armor;
            const lv = getItemLevel('equip', e.armor) || 1;
            STATE.player.equipSlots.armor = {
                typeId: e.armor, level: lv, slot: 'armor',
                name: def ? def.name : '护甲',
                stats: def ? scaleStats(def.base, def.perLevel, lv) : {},
            };
        }
        if (e.accessory) {
            const def = EQUIPMENT.accessory;
            const lv = getItemLevel('equip', e.accessory) || 1;
            STATE.player.equipSlots.accessory = {
                typeId: e.accessory, level: lv, slot: 'accessory',
                name: def ? def.name : '饰品',
                stats: def ? scaleStats(def.base, def.perLevel, lv) : {},
            };
        }
    }
    initSpawnSystem(); initEconomySystem(); initSkillSystem(); clearProjectiles(); initAudio(); startBattleBGM();
    recalculateStats();
    document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
    startScreen.classList.add('hidden'); gameoverScreen.classList.add('hidden');
    gameLoop.start();
    events.emit('game:started', null);
}

function endGame() {
    stopBGM();
    gameLoop.stop();
    STATE.gameStatus = 'gameOver';
    var s = { gold: STATE.player.gold, wave: STATE.maxWaveReached, kills: STATE.killCount, bossKills: STATE._bossKills || 0, elapsedTime: STATE.elapsedTime, levelId: STATE._selectedLevelId || 1 };
    recordRunComplete(s);
    showSettlement(s, _lastStartConfig || {});
    startScreen.classList.add('hidden'); gameoverScreen.classList.add('hidden');
}

function togglePause() {
    if (STATE.gameStatus === 'paused') {
        STATE.gameStatus = 'playing';
        startBattleBGM();
        pauseOverlay.classList.add('hidden');
        gameLoop.start();
    } else if (STATE.gameStatus === 'playing') {
        STATE.gameStatus = 'paused';
        stopBGM();
        gameLoop.stop();
        pauseOverlay.classList.remove('hidden');
    }
}

btnPauseResume.addEventListener('click', togglePause);
btnPauseQuit.addEventListener('click', () => {
    pauseOverlay.classList.add('hidden');
    endGame();
});

events.on('loadout:confirmed', function(c) { startGame(c); });
events.on('settlement:replay', function(c) { startGame(c); });



// ---------------------------------------------------------------------------
// Button bindings
// ---------------------------------------------------------------------------

btnStart.addEventListener('click', startGame);
btnRestart.addEventListener('click', startGame);

// ---------------------------------------------------------------------------
// EventBus listeners (game-level)
// ---------------------------------------------------------------------------

// Combat → particles + audio + screen shake + damage numbers
events.on('enemy:hit', (payload) => {
    burstHit(payload.position.x, payload.position.y);
    showDamageNumber(payload.position.x, payload.position.y, payload.damage, payload.isCrit);
    if (payload.isCrit) {
        burstCrit(payload.position.x, payload.position.y);
        playCrit();
        triggerShake(4, 0.1);
    } else {
        playHit();
        triggerShake(2, 0.05);
    }
});

events.on('enemy:died', (payload) => {
    burstDeath(payload.enemy.x, payload.enemy.y, payload.enemy.color);
    showGoldNumber(payload.enemy.x, payload.enemy.y, payload.enemy.gold);
    playDeath();
    triggerShake(8, 0.2);
});

// Click miss feedback — when player clicks on empty space
events.on('click:miss', (payload) => {
    showMissText(payload.x, payload.y);
});

// Player damage feedback — screen shake on hit
events.on('player:damaged', (_payload) => {
    triggerShake(6, 0.15);
});

// Notification log events
events.on('game:started', () => addNotification('游戏开始', 'system'));
events.on('wave:start', (p) => addNotification(`第 ${p.wave} 波`, 'system'));
events.on('enemy:spawned', (e) => { if (e.isBoss) addNotification(`${(ENEMY_TYPES[e.typeId]?.name) || e.typeId || '敌人'} 出现了！`, 'boss'); });
events.on('boss:died', (boss) => addNotification(`${(BOSS_TYPES[boss.typeId]?.name) || boss.typeId || 'Boss'} 被击败！`, 'reward'));
events.on('skill:activated', (p) => addNotification(`${p.name}！`, 'skill'));

// Skill VFX — thunder strike: lightning burst + bolts to all enemies + yellow flash
events.on('skill:thunder', (_payload) => {
    burstThunder(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
    triggerScreenFlash('#ffff00', 0.3, 0.2);
    // Lightning bolts from screen center to every living enemy
    const enemies = STATE.enemies || [];
    for (const e of enemies) {
        if (e.hp > 0) {
            triggerLightningStrike(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, e.x, e.y);
        }
    }
});

// Freeze — blue screen flash + ice burst from center
events.on('skill:freeze', (payload) => {
    burstFreeze(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
    triggerScreenFlash('#4488ff', 0.3, 0.2);
});

// Poison — purple screen tint + burst
events.on('skill:poison_blade', (_payload) => {
    burstPoison(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
    triggerScreenFlash('#8844cc', 0.15, 0.15);
});

// Berserk — red screen flash + vignette + shake (rage effect)
events.on('skill:berserk', (_payload) => {
    triggerScreenFlash('#ff4422', 0.3, 0.25);
    triggerShake(6, 0.1);
    triggerBerserkVignette();
});

// Gold rush — gold sparkle flash + coin rain from top of screen
events.on('skill:gold_rush', (_payload) => {
    triggerScreenFlash('#ffd700', 0.2, 0.15);
    burstGoldRain(DESIGN_WIDTH / 2, 100);
});

// Boss spawn — screen flash red + big shake for dramatic entrance
events.on('boss:spawned', (_payload) => {
    triggerScreenFlash('#ff2222', 0.35, 0.25);
    triggerShake(12, 0.3);
});

// Player healed — green rising particles (no screen flash for subtle feedback)
events.on('player:healed', (_payload) => {
    burstHeal(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
});

// Skill activation from keyboard hotkeys
events.on('skill:activate', (payload) => {
    activateSkill(payload.slot);
});

// Listen for game-over trigger from gameplay systems
events.on('game:triggerGameOver', () => {
    endGame();
});

events.on('game:levelComplete', (stats) => {
    gameLoop.stop();
    // Unlock next level if clearReward specifies it
    const lvlCfg = STATE.levelConfig;
    if (lvlCfg && lvlCfg.clearReward && lvlCfg.clearReward.type === 'unlock_level') {
        unlockLevel(lvlCfg.clearReward.levelId);
    }
    recordRunComplete(stats);
    showSettlement(stats, _lastStartConfig || {}, true);
});

// ---------------------------------------------------------------------------
// Meta / Navigation event listeners
// ---------------------------------------------------------------------------

// Screen navigation (main menu -> level select -> etc.)
events.on('menu:navigate', (payload) => {
    if (!payload || !payload.screen) return;
    const screenMap = {
        lobby: 'main-menu',
        levelSelect: 'level-select',
        shop: 'shop-panel',
        loadout: 'loadout-panel',
        settlement: 'settlement-panel',
    };
    const screenId = screenMap[payload.screen] || payload.screen;
    if (payload.screen === 'loadout') STATE._loadoutMode = 'config';
    showScreen(screenId);
});

// Level selected — store levelId and navigate to loadout (battle prep)
events.on('level:selected', (payload) => {
    if (!payload || payload.levelId == null) return;
    STATE._selectedLevelId = payload.levelId;
    STATE._loadoutMode = 'battle';
    showScreen('loadout-panel');
});

// ---------------------------------------------------------------------------
// Reward system wiring — real boss defeated → reward selection
// ---------------------------------------------------------------------------

/**
 * Boss defeated → pause gameplay and show reward selection panel.
 * Triggered by boss:died event from spawn-system (real boss death).
 */
events.on('boss:died', (payload) => {
    // Guard: only trigger reward picking during active gameplay
    if (STATE.gameStatus !== 'playing') return;

    STATE.gameStatus = 'rewardPicking';
    STATE._bossKills = (STATE._bossKills || 0) + 1;
    STATE._levelBossKills = (STATE._levelBossKills || 0) + 1;

    const rewards = generateRewards(payload.tier);
    const lvlCfg = STATE.levelConfig;
    const bossesCleared = STATE._levelBossKills;
    const targetBosses = lvlCfg ? (lvlCfg.bossesToClear || 999) : 999;

    showRewardPanel(rewards, (reward) => {
        applyReward(reward);

        // Refresh skill bar if a skill reward was picked
        if (STATE.player.activeSkills && STATE.player.activeSkills.length > 0) {
            setSkillSlots(STATE.player.activeSkills);
        }

        // Check level completion
        if (bossesCleared >= targetBosses) {
            STATE.gameStatus = 'gameOver';
            gameLoop.stop();
            events.emit('game:levelComplete', {
                levelId: STATE._selectedLevelId,
                gold: STATE.player.gold,
                wave: STATE.maxWaveReached,
                kills: STATE.killCount,
                bossKills: bossesCleared,
                elapsedTime: STATE.elapsedTime,
            });
        } else {
            STATE.gameStatus = 'playing';
        }
    });
});

// Kill-based mini reward — 2-choose-1 upgrade during combat
events.on('reward:trigger', (payload) => {
    if (STATE.gameStatus !== 'playing') return;
    STATE.gameStatus = 'rewardPicking';
    const rewards = generateMiniRewards(payload.tier);
    showRewardPanel(rewards, (reward) => {
        applyReward(reward);

        // Refresh skill bar if a skill reward was picked
        if (STATE.player.activeSkills && STATE.player.activeSkills.length > 0) {
            setSkillSlots(STATE.player.activeSkills);
        }

        STATE.gameStatus = 'playing';
    });
});

// ---------------------------------------------------------------------------
// Initial state — Meta Phase B: main menu + level select
// ---------------------------------------------------------------------------

// Load meta-progression data (must run before UI init so stats are available)
loadMeta();

// Initialise navigation UI
initMainMenu();
initLevelSelect();
initShopPanel();
initLoadoutPanel();
initSettlementPanel();

// Hide the old start screen (preserved for backwards compat during transition)
startScreen.classList.add('hidden');
gameoverScreen.classList.add('hidden');

// Show the main menu as the first screen
showScreen('main-menu');

// Render initial idle frame (canvas stays in background)
renderer.clear();
renderer.render(STATE);

// Preload sprites in background while main menu is showing
(async () => {
    try {
        const resp = await fetch('assets/sprites/manifest.json');
        if (resp.ok) {
            const manifest = await resp.json();
            await preloadSprites(manifest);
            console.log('[ClickRouge] Sprites preloaded');
        }
    } catch (e) {
        console.warn('[ClickRouge] Sprite preload failed, using procedural fallback:', e.message);
    }
})();

console.log('[ClickRouge] Bootstrap complete. Main menu shown.');
