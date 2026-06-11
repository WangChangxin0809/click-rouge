# Click Rouge 交接文档 — 给下一个 AI / 开发者

> 最后更新：2026-06-11
> 项目状态：可玩，核心循环完整，需要打磨

## 一、这是什么项目

HTML5 Canvas 点击肉鸽游戏。玩家点击屏幕攻击敌人，击败 Boss 通关。局内拿奖励构筑，局外用永久金币升级。5 个关卡递增难度。

**一句话**：纯 Web 单页、无框架、ES Modules、Canvas 渲染 + DOM UI。

## 二、怎么跑起来

```bash
cd d:/0_Study/rep/click-rouge

# 本地服务器（ES Modules 不能 file:// 打开）
npx http-server -p 8082
# 浏览器访问 http://localhost:8082

# E2E 测试（需要 Edge 浏览器 + Playwright）
node test.mjs
```

## 三、当前完整状态

### 已完成 ✅
- 完整游戏循环：点击战斗→Boss→奖励→通关/战败→结算
- 6 个技能（雷霆/冰冻/狂暴/治疗/毒刃/淘金），含自动释放
- 4 个随从（骑士/弓箭手/治疗精灵/金币磁铁）
- 3 件装备（武器/护甲/饰品）+ 6 种被动 Buff
- 局外成长：商店买属性/技能/随从/装备升级，永久金币持久化
- 5 关递增难度，每关 Boss 击败数达标后通关，自动解锁下一关
- 双模式装备配置面板（主菜单→纯浏览，关卡选择→战前准备）
- 暂停/退出（Esc 或 HUD ⏸ 按钮）
- 精灵图渲染 + 抗锯齿已关闭
- 5 个 UI 面板各有独立 CSS 背景

### 未完成 ❌ / 已知问题
- **攻速系统未实现**：`atkSpeedMult` 被计算但没有任何系统消费（无自动点击间隔）
- **吸血/反伤未实现**：`lifesteal` 和 `thorns` 属性计算了但战斗系统不读取
- **精灵图无动画**：蝙蝠和龙裁剪为单帧后依赖程序化呼吸动画（够用但不如真动画）
- **没有音效资源**：全部用 Web Audio API 程序化生成（有点粗糙）
- **没有加载/进度提示**：精灵预加载安静失败
- **备份文件混乱**：`assets/sprites/_backup/` 有大量原始精灵图需要清理
- **`assets/textures/` 全是废文件**：找到的纹理不适合做背景，直接删掉
- **`src/main.js.bak` 残留**
- **未跟踪文件太多**：`.agents/`、`skills-lock.json`、`test-screenshots/` 等

## 四、核心架构速查

### 数据流
```
用户点击 Canvas
  → main.js handleCanvasClick() 记录到 STATE.clickQueue
  → combat-system.js updateCombatSystem() 每帧消费一个点击
     → 读 STATE.player.atk (有效攻击力 = base + 装备 + 被动)
     → 计算暴击 → damageEnemy()
     → 敌人死亡 → awardGold() → enemy:died 事件
  → spawn-system 波次/Boss 管理
  → reward-system 生成 3 选 1 → applyReward → recalculateStats
```

### STATE 关键字段
```javascript
STATE.player.atk          // 有效攻击力（recalculateStats 计算）
STATE.player.baseAtk      // 基础攻击力（meta 升级直接加这个）
STATE.player.critChance   // 暴击率
STATE.player.critMult     // 暴击倍率
STATE.player.goldMultiplier // 金币倍率
STATE.player.atkSpeedMult // 攻速（算了但没用！）
STATE.player.lifesteal    // 吸血（算了但没用！）
STATE.player.thorns       // 反伤（算了但没用！）
STATE.player.activeSkills // [{ typeId, level, cooldown, ... }]
STATE.player.activeFollowers // [follower entities]
STATE.player.equipSlots   // { weapon, armor, accessory }
STATE.player.passiveBuffs // [{ id, stats, level }]

STATE.levelConfig         // 当前关卡配置（LEVELS[id]）
STATE._selectedLevelId    // 玩家选的关卡
STATE._levelBossKills     // 本局击败 Boss 数
STATE.gameStatus          // 'playing' | 'paused' | 'rewardPicking' | 'gameOver'
```

### 事件总线（关键事件）
| 事件 | 触发者 | 含义 |
|------|--------|------|
| `enemy:hit` / `enemy:died` | combat-system | 战斗反馈 |
| `boss:died` | spawn-system | Boss 死亡 → 奖励面板 + 通关检查 |
| `game:triggerGameOver` | main.js (玩家死亡) | 战败结算 |
| `game:levelComplete` | main.js (Boss 达标) | 通关胜利结算 |
| `menu:navigate` | UI 面板 | 屏幕跳转 |
| `loadout:confirmed` | loadout-panel | 选好装备开始战斗 |
| `level:selected` | level-select | 选了关卡 → 跳 loadout |

### 缩放公式
```javascript
// level-scaling.js
scaleStats(base, perLevel, level) → effective = base + perLevel × (level - 1)
// 例：装备 Lv.3, base.atk=5, perLevel.atk=3
// effective.atk = 5 + 3 × (3-1) = 11
```

### CSS 注入模式
每个 UI 面板通过 `_injectStyles()` 动态注入 `<style>` 到 `<head>`：
```javascript
function _injectStyles() {
    if (document.getElementById('my-panel-styles')) return; // 幂等
    const style = document.createElement('style');
    style.id = 'my-panel-styles';
    style.textContent = `/* CSS here */`;
    document.head.appendChild(style);
}
```

## 五、开发注意事项

### 修改数值系统时
- 战斗伤害走 `STATE.player.atk`（不要用 `baseAtk`）
- 属性聚合必须走 `recalculateStats()`（`progression-system.js`）
- 装备/被动加新属性时，需要在 `recalculateStats()` 中添加对应的求和逻辑
- 永久升级直接改 `baseAtk`/`maxHp`（`applyMetaToPlayer()`）
- **不要**在 `recalculateStats()` 运行时修改 `baseAtk`

### 修改 UI 时
- 所有 `.screen` div 在 `index.html` 中定义，CSS 类在各自的 `_injectStyles()` 中注入
- 屏幕跳转统一走 `events.emit('menu:navigate', { screen: '...' })`
- 按钮 ID 前缀要注意全局唯一
- 不要用 `display: none !important` 覆盖 `.screen.active` 的 flex

### 添加精灵图时
1. 放 PNG 到 `assets/sprites/<name>/`
2. 在 `manifest.json` 注册：frameW、frameH、frames、layout
3. 在 `sprite-renderer.js` 的 `SPRITE_DEFS` 中添加
4. 精灵图必须是水平排列的 spritesheet
5. Canvas 渲染已禁用抗锯齿（`imageSmoothingEnabled = false`）

## 六、下一阶段建议

### P0 — 必须做
1. 清理仓库：删除 `assets/textures/`、`src/main.js.bak`、`assets/sprites/_backup/`（或加 .gitignore）
2. 精灵图恢复多帧动画（蝙蝠和龙目前是单帧）
3. 游戏平衡性调整（目前用 10000 金币测试，上线前要改回 0）

### P1 — 应该做
4. 实现攻速系统（自动点击间隔 = 1/atkSpeedMult）
5. 实现吸血（onHit 回血）和反伤（敌人碰基地时反弹伤害）
6. 添加音效资源文件（替代程序化生成）
7. 局内奖励时暂停所有敌人移动

### P2 — 可以做的
8. 新手引导 / 教程
9. 成就系统
10. 更多关卡 / 敌人 / Boss
11. 保存/加载游戏进度
