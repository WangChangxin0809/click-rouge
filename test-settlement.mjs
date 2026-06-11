import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';

async function run() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const results = [];
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 导航到 loadout 面板并开始游戏
    await page.click('#btn-adventure');
    await page.waitForTimeout(500);
    const enterBtn = await page.$('.btn-enter-level');
    if (!enterBtn) { console.log('没有进入按钮'); await browser.close(); return; }
    await enterBtn.click();
    await page.waitForTimeout(500);

    // 选第一个技能（如果存在）
    const skillCard = await page.$('.loadout-card');
    if (skillCard) await skillCard.click();
    await page.waitForTimeout(200);

    // 开始战斗
    const startBtn = await page.$('.loadout-start-btn');
    if (!startBtn) { console.log('没有开始战斗按钮'); await browser.close(); return; }
    await startBtn.click();
    await page.waitForTimeout(2000);

    // 手动触发游戏结束（让结算面板显示）
    await page.evaluate(async () => {
      const { events } = await import('/src/core/event-bus.js');
      events.emit('game:triggerGameOver');
    });
    await page.waitForTimeout(1000);

    // 检查结算面板
    const settlement = await page.$('#settlement-panel.active');
    results.push({ test: '结算面板可见', pass: settlement !== null });
    console.log('结算面板:', settlement !== null);

    if (settlement) {
      await page.screenshot({ path: 'd:/0_Study/rep/click-rouge/test-screenshots/settlement-01.png' });

      // 检查"返回大厅"按钮
      const btnLobby = await page.$('#btn-settlement-lobby');
      results.push({ test: '返回大厅按钮存在', pass: btnLobby !== null });
      console.log('返回大厅按钮:', btnLobby !== null);

      // 检查"再来一局"按钮
      const btnReplay = await page.$('#btn-settlement-replay');
      results.push({ test: '再来一局按钮存在', pass: btnReplay !== null });
      console.log('再来一局按钮:', btnReplay !== null);

      // 点击"返回大厅"
      if (btnLobby) {
        await btnLobby.click();
        await page.waitForTimeout(500);
        const mainMenu = await page.$('#main-menu.active');
        results.push({ test: '返回大厅→主菜单', pass: mainMenu !== null });
        console.log('返回大厅→主菜单:', mainMenu !== null);
      }

      // 重新走一遍流程到结算，然后测试"再来一局"
      await page.click('#btn-adventure');
      await page.waitForTimeout(500);
      const enterBtn2 = await page.$('.btn-enter-level');
      if (enterBtn2) await enterBtn2.click();
      await page.waitForTimeout(500);
      const startBtn2 = await page.$('.loadout-start-btn');
      if (startBtn2) await startBtn2.click();
      await page.waitForTimeout(2000);
      await page.evaluate(async () => {
        const { events } = await import('/src/core/event-bus.js');
        events.emit('game:triggerGameOver');
      });
      await page.waitForTimeout(1000);

      // 点击"再来一局"
      const btnReplay2 = await page.$('#btn-settlement-replay');
      if (btnReplay2) {
        await btnReplay2.click();
        await page.waitForTimeout(1000);
        // 检查 HUD（战斗应该开始了）
        const hud = await page.$('#hud-overlay');
        const goldVal = await page.$('#gold-value');
        results.push({ test: '再来一局→战斗开始', pass: hud !== null && goldVal !== null });
        console.log('再来一局→战斗开始:', hud !== null);
      }
    }

  } catch (err) {
    console.error('异常:', err.message);
  }

  if (errors.length > 0) {
    console.log('\n控制台错误:', errors);
    results.push({ test: '无JS错误', pass: false });
  } else {
    results.push({ test: '无JS错误', pass: true });
  }

  console.log('\n=== 结算测试汇总 ===');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass);
  console.log(`通过: ${passed}/${results.length}`);
  failed.forEach(f => console.log(`  ❌ ${f.test}`));

  await browser.close();
  if (failed.length > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
