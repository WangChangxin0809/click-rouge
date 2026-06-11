/**
 * auto-play.mjs — Playwright automated gameplay test for Click Rouge.
 *
 * Opens the game in a headless browser, clicks the canvas to simulate a player,
 * selects rewards when the reward panel appears, reports status periodically,
 * captures a screenshot on game-over, and logs all console errors.
 *
 * Usage:
 *   node tests/auto-play.mjs
 *
 * Prerequisites:
 *   - A local HTTP server serving the project root on port 8080
 *     (e.g. npx http-server . -p 8080, or python -m http.server 8080)
 *   - playwright installed (npm install)
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------

const GAME_URL = 'http://localhost:8080/';
const CLICK_INTERVAL_MS = 500;
const STATUS_INTERVAL_MS = 5000;
const MAX_DURATION_MS = 5 * 60 * 1000; // 5 minute timeout
const SCREENSHOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'screenshots');

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/**
 * Get a random integer in [min, max].
 */
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

(async () => {
    // Ensure screenshot directory exists
    mkdirSync(SCREENSHOT_DIR, { recursive: true });

    const consoleErrors = [];

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    // Capture console errors
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const text = msg.text();
            consoleErrors.push(`[${new Date().toISOString()}] ${text}`);
            console.error(`  CONSOLE ERROR: ${text}`);
        }
    });

    try {
        // Step 1: Open the game
        console.log('[auto-play] Opening game at', GAME_URL);
        await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
        // Wait for the module script to load and the canvas to appear
        await page.waitForSelector('#game-canvas', { timeout: 10000 });
        await sleep(1000); // let the game initialise

        // Step 2: Click "开始游戏"
        console.log('[auto-play] Clicking start button...');
        const startBtn = await page.$('#btn-start');
        if (startBtn && await startBtn.isVisible()) {
            await startBtn.click();
        } else {
            console.log('[auto-play] Start button not visible — game may already be running, or in a different state');
        }
        await sleep(500);

        // Get a reference to the canvas for click coordinates
        const canvas = await page.$('#game-canvas');
        if (!canvas) {
            throw new Error('Canvas element not found');
        }
        const canvasBox = await canvas.boundingBox();

        const startTime = Date.now();
        let lastStatusTime = startTime;
        let lastClickTime = startTime;

        // Main loop
        console.log('[auto-play] Starting auto-play loop...');
        while (true) {
            const now = Date.now();
            const elapsed = now - startTime;

            // Timeout check
            if (elapsed > MAX_DURATION_MS) {
                console.log('[auto-play] Max duration reached, stopping.');
                break;
            }

            // Check for game-over screen
            const gameOverVisible = await page.evaluate(() => {
                const el = document.getElementById('gameover-screen');
                return el && !el.classList.contains('hidden');
            });

            if (gameOverVisible) {
                console.log('[auto-play] GAME OVER detected!');
                // Read final stats
                const stats = await page.evaluate(() => {
                    const statTime = document.getElementById('stat-time');
                    const statWave = document.getElementById('stat-wave');
                    const statKills = document.getElementById('stat-kills');
                    const statGold = document.getElementById('stat-gold');
                    return {
                        time: statTime ? statTime.textContent : '?',
                        wave: statWave ? statWave.textContent : '?',
                        kills: statKills ? statKills.textContent : '?',
                        gold: statGold ? statGold.textContent : '?',
                    };
                });
                console.log('[auto-play] Final stats:', JSON.stringify(stats));

                // Screenshot
                const screenshotPath = join(SCREENSHOT_DIR, `gameover-${Date.now()}.png`);
                await page.screenshot({ path: screenshotPath, fullPage: false });
                console.log(`[auto-play] Screenshot saved: ${screenshotPath}`);
                break;
            }

            // Check for reward panel and select a random reward
            const rewardCards = await page.$$('.reward-card');
            const visibleRewards = [];
            for (const card of rewardCards) {
                const visible = await card.isVisible();
                if (visible) visibleRewards.push(card);
            }

            if (visibleRewards.length > 0) {
                console.log(`[auto-play] Reward panel visible with ${visibleRewards.length} options, selecting...`);
                // Pick a random reward
                const chosen = visibleRewards[randInt(0, visibleRewards.length - 1)];
                await chosen.click();
                console.log('[auto-play] Reward selected.');
                await sleep(300); // brief pause after selection
                continue; // skip click this cycle
            }

            // Step 3: Click at a random position on the canvas every 0.5s
            if (now - lastClickTime >= CLICK_INTERVAL_MS) {
                const box = await canvas.boundingBox();
                // If canvas has been scrolled/resized, re-measure
                if (box) {
                    const clickX = box.x + randInt(20, Math.max(21, Math.floor(box.width) - 20));
                    const clickY = box.y + randInt(20, Math.max(21, Math.floor(box.height) - 20));
                    await page.mouse.click(clickX, clickY);
                }
                lastClickTime = now;
            }

            // Step 5: Report status every 5 seconds
            if (now - lastStatusTime >= STATUS_INTERVAL_MS) {
                const status = await page.evaluate(() => {
                    const hpEl = document.getElementById('hp-text');
                    const goldEl = document.getElementById('gold-value');
                    const waveEl = document.getElementById('wave-value');
                    const timeEl = document.getElementById('time-value');

                    // Count filled skill slots
                    const filledSkills = document.querySelectorAll('.skill-slot-filled').length;

                    // Count equipment rows that are filled
                    const equipFilled = document.querySelectorAll('.equip-row-filled').length;

                    return {
                        hp: hpEl ? hpEl.textContent : '?',
                        gold: goldEl ? goldEl.textContent : '?',
                        wave: waveEl ? waveEl.textContent : '?',
                        time: timeEl ? timeEl.textContent : '?',
                        skills: filledSkills,
                        equipCount: equipFilled,
                    };
                });
                console.log(
                    `[auto-play] [${(elapsed / 1000).toFixed(0)}s] ` +
                    `HP=${status.hp} Gold=${status.gold} Wave=${status.wave} ` +
                    `Skills=${status.skills} Equip=${status.equipCount} Time=${status.time}`
                );
                lastStatusTime = now;
            }

            await sleep(100); // loop tick rate
        }
    } catch (err) {
        console.error('[auto-play] Error:', err.message);
        // Take an error screenshot
        const errPath = join(SCREENSHOT_DIR, `error-${Date.now()}.png`);
        try {
            await page.screenshot({ path: errPath, fullPage: false });
            console.log(`[auto-play] Error screenshot saved: ${errPath}`);
        } catch (_) { /* ignore */ }
    } finally {
        // Step 7: Report all console errors
        if (consoleErrors.length > 0) {
            console.log(`\n[auto-play] === CONSOLE ERRORS (${consoleErrors.length}) ===`);
            for (const err of consoleErrors) {
                console.log(`  ${err}`);
            }
        } else {
            console.log('\n[auto-play] No console errors captured.');
        }

        await browser.close();
        console.log('[auto-play] Browser closed. Done.');
    }
})();
