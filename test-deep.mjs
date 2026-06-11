import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';

async function run() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const results = [];
  const errors = [];

  // Collect JS errors (filter out favicon.ico 404s and pageerror duplicates)
  page.on('pageerror', err => {
    // pageerror typically fires for uncaught exceptions; network 404s appear as
    // 'console' errors in Chromium. Only record if it looks like a real JS error.
    if (err.message && !err.message.includes('favicon') && !err.message.includes('404')) {
      errors.push('[pageerror] ' + err.message);
    }
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      // Filter browser network 404s (favicon, apple-touch-icon, etc.) — harmless
      if (txt.includes('404 (Not Found)')) return;
      errors.push(txt);
    }
  });

  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 1. Main menu visible
    const mainMenu = await page.$('#main-menu.active');
    results.push({ test: '1. 主菜单可见', pass: mainMenu !== null });
    if (!mainMenu) throw new Error('主菜单不可见');

    // 2. Click "开始冒险" -> level select
    await page.click('#btn-adventure');
    await page.waitForTimeout(500);
    const levelSelect = await page.$('#level-select.active');
    results.push({ test: '2. 关卡选择可见', pass: levelSelect !== null });

    // 3. Click first level's "进入" -> loadout/equipment config
    const enterBtn = await page.$('.btn-enter-level');
    if (enterBtn) {
      await enterBtn.click();
      await page.waitForTimeout(500);
      const loadout = await page.$('#loadout-panel.active');
      results.push({ test: '3. 装备配置可见', pass: loadout !== null });

      if (loadout) {
        await page.screenshot({ path: 'd:/0_Study/rep/click-rouge/test-screenshots/deep-01-loadout.png' });

        // 4. Select a skill if available
        const skillCards = await page.$$('.loadout-card');
        if (skillCards.length > 0) {
          await skillCards[0].click();
          await page.waitForTimeout(200);
          console.log('已选择技能');
        }

        // 5. Click "开始战斗"
        const startBtn = await page.$('.loadout-start-btn');
        if (startBtn) {
          await startBtn.click();
          await page.waitForTimeout(1500);

          // Verify HUD is visible (battle started)
          const hud = await page.$('#hud-overlay');
          results.push({ test: '4. 战斗已开始(HUD可见)', pass: hud !== null });

          await page.screenshot({ path: 'd:/0_Study/rep/click-rouge/test-screenshots/deep-02-battle.png' });

          if (hud) {
            // Battle is live — simulate clicks on canvas to engage with enemies
            const canvas = await page.$('#game-canvas');
            if (canvas) {
              const box = await canvas.boundingBox();
              const cx = box.x + box.width / 2;
              const cy = box.y + box.height / 2;

              // 10 quick clicks to engage combat
              for (let i = 0; i < 10; i++) {
                await page.mouse.click(cx + (Math.random() - 0.5) * 400, cy + (Math.random() - 0.5) * 300);
                await page.waitForTimeout(80);
              }
              console.log('已执行 10 次点击攻击');
            }

            // Wait a bit for some combat to happen
            await page.waitForTimeout(5000);
            await page.screenshot({ path: 'd:/0_Study/rep/click-rouge/test-screenshots/deep-03-mid-battle.png' });

            // Force game-over via dynamic import of the EventBus
            console.log('通过 EventBus 注入触发游戏结束...');
            try {
              await page.evaluate(async () => {
                const { events } = await import('/src/core/event-bus.js');
                // First emit player:damaged to register combat, then trigger game over
                events.emit('game:triggerGameOver');
              });
              console.log('game:triggerGameOver 事件已触发');
            } catch (injectErr) {
              console.error('EventBus 注入失败:', injectErr.message);
              // Fallback: try alternate import path
              try {
                await page.evaluate(async () => {
                  const mod = await import('./src/core/event-bus.js');
                  mod.events.emit('game:triggerGameOver');
                });
                console.log('备用路径注入成功');
              } catch (fallbackErr) {
                console.error('备用注入也失败:', fallbackErr.message);
              }
            }

            // Wait for settlement panel to appear
            await page.waitForTimeout(2000);
          }
        }
      }
    }
  } catch (err) {
    console.error('测试异常:', err.message);
  }

  // Check settlement/gameover panel
  const settlement = await page.$('#settlement-panel.active');
  const gameover = await page.$('#gameover-screen:not(.hidden)');
  results.push({ test: '5. 游戏结束面板', pass: settlement !== null || gameover !== null });
  console.log('结算面板:', settlement !== null, '旧结束屏:', gameover !== null);

  await page.screenshot({ path: 'd:/0_Study/rep/click-rouge/test-screenshots/deep-05-final.png' });

  // Report JS errors
  if (errors.length > 0) {
    console.log('\n=== 控制台错误 ===');
    errors.forEach(e => console.log('  ', e));
    results.push({ test: '6. 无JS错误', pass: false });
  } else {
    results.push({ test: '6. 无JS错误', pass: true });
  }

  // Summary
  console.log('\n=== 深度测试汇总 ===');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass);
  console.log(`通过: ${passed}/${results.length}`);
  if (failed.length > 0) {
    console.log('失败:');
    failed.forEach(f => console.log(`  ❌ ${f.test}`));
  }

  await browser.close();
  if (failed.length > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
