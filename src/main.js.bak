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
import { updateParticles, burstHit, burstDeath, burstCrit, burstThunder, burstHeal, triggerScreenFlash, updateScreenFlash } from './rendering/fx-renderer.js';
import { updateShake, triggerShake } from './rendering/screen-shake.js';
import { initAudio, playHit, playCrit, playDeath } from './audio/audio-manager.js';
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
import { loadMeta, recordRunComplete, getItemLevel } from './systems/meta-progression.js';
import { LEVELS } from './data/level-config.js';
import { SKILLS } from './data/skill-data.js';
import { scaleStats } from './data/level-scaling.js';
import { createFollower } from './entities/follower.js';

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

    // Delegate content refresh to the appropriate show function
    if (name === 'main-menu') showMainMenu();
    if (name === 'level-select') showLevelSelect();
    if (name === 'shop-panel') showShopPanel();
    if (name === 'loadout-panel') { /* TODO: loadout UI */ }
    if (name === 'settlement-panel') { /* TODO: settlement UI */ }
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

    // Escape to pause / show menu (placeholder)
    if (e.key === 'Escape') {
        e.preventDefault();
        events.emit('menu:togglePause', null);
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
    if (config.levelId) {
        STATE._selectedLevelId = config.levelId;
        STATE.levelConfig = LEVELS[config.levelId] || null;
    }
    initSpawnSystem();
    initEconomySystem();
    initSkillSystem();
    clearProjectiles();
    initAudio();
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    gameLoop.start();
    events.emit('game:started', null);
}

function endGame() {
    gameLoop.stop();
    STATE.gameStatus = 'gameOver';
    const stats = {
        gold: STATE.player.gold, wave: STATE.maxWaveReached,
        kills: STATE.killCount, bossKills: STATE._bossKills || 0,
        elapsedTime: STATE.elapsedTime, levelId: STATE._selectedLevelId || 1,
    };
    recordRunComplete(stats);
    showSettlement(stats, _lastStartConfig || {});
    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
}

// Meta event listeners
events.on('loadout:confirmed', (config) => startGame(config));
events.on('settlement:replay', (config) => startGame(config));


