import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';

async function run() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const results = [];

  try {
    // 1. 打开页面
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000); // 等 JS 模块加载

    // 2. 检查主菜单可见
    const mainMenu = await page.$('#main-menu.active');
    results.push({ test: '主菜单可见', pass: mainMenu !== null });
    console.log('主菜单可见:', mainMenu !== null);

    // 3. 点击"开始冒险"按钮 → 关卡选择
    const btnAdventure = await page.$('#btn-adventure');
    if (btnAdventure) {
      await btnAdventure.click();
      await page.waitForTimeout(500);
      const levelSelect = await page.$('#level-select.active');
      results.push({ test: '关卡选择可见', pass: levelSelect !== null });
      console.log('关卡选择可见:', levelSelect !== null);

      // 截图关卡选择
      await page.screenshot({ path: 'd:/0_Study/rep/click-rouge/test-screenshots/02-level-select.png' });

      // 4. 点击第一关"进入"按钮
      const enterBtn = await page.$('.btn-enter-level');
      if (enterBtn) {
        await enterBtn.click();
        await page.waitForTimeout(500);
        const loadoutPanel = await page.$('#loadout-panel.active');
        results.push({ test: '装备配置可见', pass: loadoutPanel !== null });
        console.log('装备配置可见:', loadoutPanel !== null);

        await page.screenshot({ path: 'd:/0_Study/rep/click-rouge/test-screenshots/03-loadout.png' });

        // 5. 点击装备配置中的返回按钮 → 关卡选择
        const loadoutBack = await page.$('.loadout-back-btn');
        if (loadoutBack) {
          await loadoutBack.click();
          await page.waitForTimeout(500);
          const backToLevel = await page.$('#level-select.active');
          results.push({ test: '装备返回→关卡选择', pass: backToLevel !== null });
          console.log('装备返回→关卡选择:', backToLevel !== null);
        }

        // 6. 关卡选择返回 → 主菜单
        const levelBack = await page.$('#btn-level-back');
        if (levelBack) {
          await levelBack.click();
          await page.waitForTimeout(500);
          const backToMain = await page.$('#main-menu.active');
          results.push({ test: '关卡返回→主菜单', pass: backToMain !== null });
          console.log('关卡返回→主菜单:', backToMain !== null);
        }
      }
    }

    // 7. 从主菜单点击"商店"
    // 需要重新获取按钮因为 DOM 可能刷新了
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const btnShop = await page.$('#btn-shop');
    if (btnShop) {
      await btnShop.click();
      await page.waitForTimeout(500);
      const shopPanel = await page.$('#shop-panel.active');
      results.push({ test: '商店面板可见', pass: shopPanel !== null });
      console.log('商店面板可见:', shopPanel !== null);

      if (shopPanel) {
        await page.screenshot({ path: 'd:/0_Study/rep/click-rouge/test-screenshots/04-shop.png' });

        // 8. 点击属性强化标签中的购买按钮
        const buyBtn = await page.$('[data-buy="stat"]');
        if (buyBtn && !await buyBtn.isDisabled()) {
          await buyBtn.click();
          await page.waitForTimeout(300);
          console.log('商店购买按钮已点击');
        }

        // 9. 切换到技能标签
        const skillTab = await page.$('[data-tab="skill"]');
        if (skillTab) {
          await skillTab.click();
          await page.waitForTimeout(300);
          console.log('已切换到技能标签');
        }

        // 10. 商店返回主菜单
        const shopBack = await page.$('[data-action="back"]');
        if (shopBack) {
          await shopBack.click();
          await page.waitForTimeout(500);
          const backToMain2 = await page.$('#main-menu.active');
          results.push({ test: '商店返回→主菜单', pass: backToMain2 !== null });
          console.log('商店返回→主菜单:', backToMain2 !== null);
        }
      }
    }

  } catch (err) {
    console.error('测试出错:', err.message);
  }

  // 打印汇总
  console.log('\n=== 测试汇总 ===');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass);
  console.log(`通过: ${passed}/${results.length}`);
  if (failed.length > 0) {
    console.log('失败:');
    failed.forEach(f => console.log(`  ❌ ${f.test}`));
  }

  await browser.close();

  // 如果有失败则以非零退出
  if (failed.length > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
