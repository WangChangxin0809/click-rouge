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
import { initSpawnSystem, updateSpawnSystem } from './systems/spawn-system.js';
import { updateDifficulty } from './systems/difficulty-system.js';
import { updateCombatSystem } from './systems/combat-system.js';
import { initEconomySystem, updateEconomySystem } from './systems/economy-system.js';
import { updateParticles, burstHit, burstDeath, burstCrit, burstThunder, burstHeal, triggerScreenFlash, updateScreenFlash } from './rendering/fx-renderer.js';
import { updateShake, triggerShake } from './rendering/screen-shake.js';
import { initAudio, playHit, playCrit, playDeath } from './audio/audio-manager.js';
import { showDamageNumber, showGoldNumber, showMissText } from './ui/damage-numbers.js';
import { generateRewards, applyReward } from './systems/reward-system.js';
import { showRewardPanel, hideRewardPanel } from './ui/reward-panel.js';
import { updateSkillBar, setSkillSlots } from './ui/skill-bar.js';
import { updateEquipmentPanel } from './ui/equipment-panel.js';
import { initSkillSystem, updateSkillSystem, activateSkill } from './systems/skill-system.js';
import { updateAllFollowers } from './entities/follower.js';
import { updateProjectiles, clearProjectiles } from './entities/projectile.js';

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
    updateAllFollowers(dt, STATE.enemies);
    updateProjectiles(dt);
    updateEconomySystem(dt);
    updateParticles(dt);
    updateShake(dt);
    updateScreenFlash(dt);
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
function startGame() {
    // Clean up any lingering reward panel from a previous run
    hideRewardPanel();

    STATE.reset();
    STATE.gameStatus = 'playing';
    STATE.clickQueue = [];

    initSpawnSystem();
    initEconomySystem();
    initSkillSystem();
    clearProjectiles();
    initAudio();

    // Swap screens
    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');

    // Start the game loop
    gameLoop.start();

    events.emit('game:started', null);
}

/**
 * End the current game run and show the game-over screen.
 */
function endGame() {
    gameLoop.stop();
    STATE.gameStatus = 'gameOver';

    // Populate game-over stats
    const totalSec = Math.floor(STATE.elapsedTime);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    statTime.textContent = `${min}:${String(sec).padStart(2, '0')}`;
    statWave.textContent = String(STATE.maxWaveReached);
    statKills.textContent = String(STATE.killCount);
    statGold.textContent = String(STATE.player.gold);

    // Show game-over card
    startScreen.classList.add('hidden');
    gameoverScreen.classList.remove('hidden');

    events.emit('game:ended', {
        elapsedTime: STATE.elapsedTime,
        wave: STATE.maxWaveReached,
        kills: STATE.killCount,
        gold: STATE.player.gold,
    });
    console.log('[ClickRouge] Game over.');
}

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

// Skill VFX — thunder strike: lightning burst + yellow flash
events.on('skill:thunder', (_payload) => {
    // Burst from the centre of the design-resolution screen
    burstThunder(960, 540);
    triggerScreenFlash('#ffff00', 0.25, 0.15);
});

// Boss spawn — screen flash red + big shake for dramatic entrance
events.on('boss:spawned', (_payload) => {
    triggerScreenFlash('#ff2222', 0.35, 0.25);
    triggerShake(12, 0.3);
});

// Player healed — green rising particles + soft green flash
events.on('player:healed', (_payload) => {
    burstHeal(960, 540);
    triggerScreenFlash('#44ff88', 0.15, 0.3);
});

// Skill activation from keyboard hotkeys
events.on('skill:activate', (payload) => {
    activateSkill(payload.slot);
});

// Listen for game-over trigger from gameplay systems
events.on('game:triggerGameOver', () => {
    endGame();
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

    const rewards = generateRewards(payload.tier);
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
// Initial state
// ---------------------------------------------------------------------------

// Ensure start screen is visible, game-over is hidden
startScreen.classList.remove('hidden');
gameoverScreen.classList.add('hidden');

// Render initial idle frame
renderer.clear();
renderer.render(STATE);

console.log('[ClickRouge] Bootstrap complete. Waiting for player to start.');
