# Meta-Progression 系统 — 详细实现架构

> 配合 [meta-progression-plan.md](meta-progression-plan.md) 阅读
> 状态：待实施
> 日期：2026-06-11

---

## 一、整体数据流

```
┌─────────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────┐
│ 局内战斗     │───→│ 死亡结算  │───→│ localStorage │───→│ 主菜单    │
│ STATE.gold  │    │ 15%转换   │    │ 永久金币+仓库 │    │ 显示余额  │
└─────────────┘    └──────────┘    └──────────────┘    └──────────┘
                                                              │
                         ┌────────────────────────────────────┘
                         ↓
                  ┌──────────┐    ┌──────────┐    ┌──────────┐
                  │   商店   │    │ 装备配置  │    │ 关卡选择  │
                  │ 消费金币  │    │ 仓库选配  │    │ 选关进入  │
                  └──────────┘    └──────────┘    └──────────┘
                                                          │
                                                          ↓
                                                  ┌──────────────┐
                                                  │ 局内战斗      │
                                                  │ 加载选配+升级 │
                                                  └──────────────┘
```

---

## 二、文件职责详述

### 2.1 `src/systems/meta-progression.js` — 核心持久化模块

**职责**：所有 localStorage 操作唯一的入口。其他模块不得直接操作 localStorage。

**导出函数**：

| 函数 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `loadMeta()` | — | meta 对象 | 从 localStorage 加载，首次返回默认值，schema 迁移在此处理 |
| `saveMeta()` | — | void | 将当前内存中的 meta 写回 localStorage |
| `getPermanentGold()` | — | number | |
| `addPermanentGold(amount)` | amount | void | 加金币并 save |
| `spendPermanentGold(amount)` | amount | boolean | 扣金币并 save，余额不足返回 false |
| `getStatLevel(statKey)` | 'atk'\|'hp'\|... | number | 属性升级等级 |
| `purchaseStatUpgrade(statKey)` | statKey | number | 升级并返回新等级，自动扣费+save |
| `getItemLevel(type, typeId)` | 'skill'\|'follower'\|'equip', typeId | number | 仓库物品等级，未拥有返回 0 |
| `purchaseShopItem(type, typeId)` | type, typeId | number | 购买升级并返回新等级（1=新获得） |
| `getAllOwned(type)` | 'skill'\|'follower'\|'equip' | `{[typeId]: level}` | 仓库中该类型所有物品 |
| `isLevelUnlocked(levelId)` | number | boolean | |
| `unlockLevel(levelId)` | number | void | 解锁关卡 |
| `recordRunComplete(stats)` | { gold, wave, kills, time, levelId } | number | 记录结算数据，返回永久金币量 |
| `applyMetaToPlayer(playerState)` | STATE.player | void | 应用永久属性加成到 PlayerState |
| `getEquipName(slot, level)` | 'weapon'\|..., number | string | 根据等级返回对应的 displayName |

**内部实现要点**：
- 内存中维护一个 `_meta` 对象，loadMeta 时填充，修改后 saveMeta 写回
- `DEFAULT_META` 常量定义初始值
- schema version 检查 + 迁移（目前 v1）
- localStorage 不可用时降级到纯内存模式（警告但不崩溃）
- 所有 `spend*` 操作先检查余额

### 2.2 `src/data/level-config.js` — 关卡配置（纯数据）

每个关卡包含：

```js
{
  id, name, description,        // 显示用
  recommendedAtk,               // 推荐攻击力（UI提示）
  clearReward,                  // { type: 'unlock_level', levelId: N } | null
  enemyPool: [],                // 可用敌人 typeId 列表
  bossPool: [],                 // 可用 Boss typeId 列表
  difficultyMult,               // 难度倍率（乘在基础难度上）
  goldMult,                     // 金币倍率
  firstBossTime,                // 首个 Boss 出现时间（秒）
  bossInterval,                 // Boss 间隔
  waveSize,                     // 每波击杀数
  spawnIntervalInitial,          // 初始生成间隔
  spawnIntervalDecay,            // 生成间隔衰减率
}
```

### 2.3 `src/ui/main-menu.js` — 主菜单

**DOM 容器**：`#main-menu`（在 index.html 中定义）

**导出函数**：

| 函数 | 说明 |
|------|------|
| `showMainMenu()` | 显示主菜单，更新金币余额、统计信息 |
| `initMainMenu()` | 页面加载时调用一次，绑定按钮事件 |

**按钮行为**：

| 按钮 | 触发 |
|------|------|
| 开始冒险 | 发射 `menu:navigate` → `levelSelect` |
| 商店 | 发射 `menu:navigate` → `shop` |
| 装备配置 | 发射 `menu:navigate` → `loadout` |

**显示内容**：标题、三个按钮、右下角"永久金币: 999"、底部"总游玩: N | 最高波次: N"

**CSS**：复用 `.modal-card` 风格，币标绝对定位右上角

### 2.4 `src/ui/level-select.js` — 关卡选择

**DOM 容器**：`#level-select`

**导出函数**：

| 函数 | 说明 |
|------|------|
| `showLevelSelect()` | 渲染关卡卡片，更新锁定/解锁状态 |
| `initLevelSelect()` | 绑定事件 |

**关卡卡片渲染**：
- 读取 `LEVELS` 配置 + `meta-progression` 解锁状态
- 解锁的：显示名称、推荐ATK、ATK对比条、敌人预览、进入按钮
- 锁定的：灰色、🔒图标、???
- 点击进入 → 存储选中的 levelId → 跳转到 loadout

**ATK 对比条**：`当前ATK / 推荐ATK`，绿色≥1.0，黄色0.5-1.0，红色<0.5

### 2.5 `src/ui/shop-panel.js` — 商店

**DOM 容器**：`#shop-panel`

**导出函数**：

| 函数 | 说明 |
|------|------|
| `showShopPanel()` | 显示商店，刷新余额和所有物品状态 |
| `initShopPanel()` | 绑定事件 |

**标签页切换**：
- 三个标签：[属性强化] [技能升级] [随从升级] [装备升级]
- 点击切换显示对应物品列表

**物品行渲染**（每行）：
```
[名称]  Lv.N  [+X ATK]  [价格 100G]  [购买]  ← 余额不足时按钮灰色
```
- 调用 `meta-progression.getXxxLevel()` 获取当前等级
- 计算当前价格：`baseCost × (1 + level × 0.5)`
- 显示下一级效果预览
- 点击购买：`meta-progression.spendPermanentGold()` → 扣款 → 刷新 UI
- 购买后发射 `meta:coinChanged` 事件

### 2.6 `src/ui/loadout-panel.js` — 装备配置

**DOM 容器**：`#loadout-panel`

**导出函数**：

| 函数 | 说明 |
|------|------|
| `showLoadoutPanel()` | 显示配置面板，从仓库读取已拥有物品 |
| `initLoadoutPanel()` | 绑定事件 |

**UI 结构**：
- 三行：技能行 / 随从行 / 装备行
- 每行显示仓库中所有该类型物品的卡片
- 卡片内容：名称 + Lv.N + 选中状态（高亮边框+✓标记）
- 已选计数显示：`技能 (已选 2/4)`
- 顶部 [开始战斗] 按钮 → 收集选中项 → `events.emit('loadout:confirmed', { skills, followers, equipment })`

**选中逻辑**：
- 点击未选中卡片 → 如果未达上限 → 选中（加高亮）
- 点击已选中卡片 → 取消选中
- 上限：技能 4、随从 4、装备 3（每槽 1 个）
- 可留空，不需要选满

**数据来源**：
- 仓库物品从 `meta-progression.getAllOwned(type)` 获取
- 物品名称和属性从 `equipment-data.js`/`skill-data.js`/`follower-data.js` 查询
- 等级从仓库读取

### 2.7 `src/ui/settlement-panel.js` — 结算面板

**DOM 容器**：`#settlement-panel`

**导出函数**：

| 函数 | 说明 |
|------|------|
| `showSettlement(runStats)` | 显示结算面板 |
| `initSettlementPanel()` | 绑定按钮 |

**`runStats` 参数**：
```js
{ gold, wave, kills, bossKills, elapsedTime, levelId }
```

**显示内容**：
- 存活时间、波次、击杀数、获得金币
- 永久金币转换明细（分行显示计算过程）
- [返回大厅] → 发射 `menu:navigate` → lobby
- [再来一局] → 用相同 loadout + level 重开

### 2.8 `index.html` 新增 DOM 结构

在主 body 中添加（在 `#modal-overlay` 内或之后）：

```html
<!-- Meta-Progression Screens -->
<div id="main-menu" class="screen hidden">...</div>
<div id="level-select" class="screen hidden">...</div>
<div id="shop-panel" class="screen hidden">...</div>
<div id="loadout-panel" class="screen hidden">...</div>
<div id="settlement-panel" class="screen hidden">...</div>
```

CSS 规则：`.screen { display: none; } .screen.active { display: flex; }`

当前 `#start-screen` 和 `#gameover-screen` 保留，在迁移期间并存。

---

## 三、现有文件修改详述

### 3.1 `src/main.js`

**删除**：
- 旧的 startScreen 直接跳 game 逻辑
- 旧 gameover-screen 直接显示逻辑

**新增**：
- 导入所有新 UI 模块
- `initMainMenu()`, `initLevelSelect()`, `initShopPanel()`, `initLoadoutPanel()`, `initSettlementPanel()`
- `startGame(config)` 改为接收配置对象：
  ```js
  function startGame({ levelId, skills, followers, equipment }) {
    STATE.reset();
    applyMetaToPlayer(STATE.player);  // 应用永久属性
    STATE.levelConfig = LEVELS[levelId];
    // 加载选中的技能/随从/装备
    for (const s of skills) STATE.player.activeSkills.push({...});
    for (const f of followers) STATE.player.activeFollowers.push(createFollower(f, ...));
    for (const e of equipment) STATE.player.equipSlots[e.slot] = {...};
    // ... 其余初始化 ...
  }
  ```
- `endGame()` 改为调用 `showSettlement()` 而非直接显示 gameover
- `events.on('loadout:confirmed', (config) => startGame(config))`
- `events.on('menu:navigate', (screen) => showScreen(screen))`
- 主屏管理函数 `showScreen(name)` 控制哪个 `.screen` 显示

### 3.2 `src/core/game-state.js`

**修改 INITIAL_STATE**：
- 删除 player 下的 equipSlots（改为 {} 空对象）
- 删除 player 下的 activeSkills / activeFollowers / passiveBuffs（改为 []）
- MAX_SKILL_SLOTS 改为 4（固定）
- MAX_FOLLOWERS 改为 5（固定）

**修改 reset()**：
- 在 deepClone 之后调用 `applyMetaToPlayer(STATE.player)`

### 3.3 `src/systems/spawn-system.js`

**修改**：
- `initSpawnSystem()` 接受可选 `config` 参数（来自 STATE.levelConfig）
- 如果 config 存在：
  - 用 `config.enemyPool` 替代 `WAVE_TYPE_POOL`
  - 用 `config.bossPool` 替代 `BOSS_TIERS`
  - 用 `config.firstBossTime` 设置初始 bossTimer
  - 用 `config.bossInterval` 设置后续间隔
- 如果 config 不存在，回退到默认行为（向下兼容）

### 3.4 `src/systems/difficulty-system.js`

**修改**：`_computeScale()` 返回值乘以 `STATE.levelConfig?.difficultyMult || 1`

### 3.5 `src/systems/economy-system.js`

**修改**：`awardGold()` 中乘以 `STATE.levelConfig?.goldMult || 1`

---

## 四、事件定义

| 事件名 | 发出者 | Payload | 监听者 |
|--------|--------|---------|--------|
| `menu:navigate` | 各 UI 模块 | `{ screen: string }` | main.js → showScreen() |
| `meta:coinChanged` | shop-panel | `{ amount }` | main-menu（更新币标） |
| `loadout:confirmed` | loadout-panel | `{ levelId, skills, followers, equipment }` | main.js → startGame() |
| `level:selected` | level-select | `{ levelId }` | main.js → 跳转 loadout |
| `settlement:returnLobby` | settlement-panel | — | main.js → showScreen('lobby') |
| `settlement:replay` | settlement-panel | — | main.js → 重开同关 |

---

## 五、实现 Phase 划分

### Phase A: 基础设施（串行）
1. `meta-progression.js` + `equipment-data.js` 精简
2. `game-state.js` INITIAL_STATE + reset() 修改
3. `level-config.js` 创建
4. `index.html` DOM 容器 + CSS

**验证**：console 中 `loadMeta()` 返回默认对象，`addPermanentGold(100)` 后 `getPermanentGold()===100`

### Phase B: 主菜单 + 关卡选择（可并行开发）
1. `main-menu.js` — 三个按钮 + 币标 + 统计
2. `level-select.js` — 5 关卡片 + ATK 对比条
3. `main.js` — showScreen() 导航 + 替换旧流程

**验证**：启动游戏看到主菜单而非旧开始按钮，能导航到关卡选择

### Phase C: 商店（独立开发）
1. `shop-panel.js` — 标签页 + 物品列表 + 购买按钮
2. 集成 meta-progression 的购买函数

**验证**：商店显示当前金币，点击购买扣款+刷新，关闭重进数据保持

### Phase D: 装备配置（独立开发）
1. `loadout-panel.js` — 仓库展示 + 选中/取消 + 上限限制
2. main.js startGame 改造为接收 config

**验证**：从仓库选配 → 开始战斗 → 装备生效

### Phase E: 结算 + 关卡集成（收尾）
1. `settlement-panel.js` — 统计 + 金币转换 + 返回/重开
2. `endGame()` 改造
3. spawn-system/difficulty/economy 关卡参数集成
4. 局内升级回写仓库

**验证**：完整游戏循环（主菜单→选关→选配→战斗→结算→返回）

---

## 六、关键实现细节

### 6.1 仓库物品 level 持久化
局内 N选1 升级时，`applyReward()` 除了更新 STATE，还需调用 `meta-progression` 更新仓库中对应物品的 level：
```js
// 在 applyReward 中添加
import { updateOwnedItemLevel } from '../systems/meta-progression.js';
// 升级成功时
updateOwnedItemLevel('skill', typeId, newLevel);
```

### 6.2 关卡完成判定
Boss 死亡时检查：如果 `STATE.levelConfig` 存在且 boss 是关卡最终 Boss，调用 `unlockLevel(nextLevelId)`。

### 6.3 属性加成应用
`applyMetaToPlayer()` 在 STATE.reset() 的 deepClone 之后执行：
```js
function applyMetaToPlayer(player) {
  const meta = loadMeta();
  player.baseAtk += getStatLevel('atk') * 3;
  player.maxHp  += getStatLevel('hp') * 10;
  player.critChance += getStatLevel('critChance') * 0.02;
  player.critMult   += getStatLevel('critMult') * 0.1;
  player.goldMultiplier += getStatLevel('goldMult') * 0.05;
  player.atkSpeedMult   += getStatLevel('atkSpeed') * 0.03;
}
```

### 6.4 向下兼容
- main.js 保留 `showScreen('quickStart')` → 直接用默认配置进入游戏（无选关/选配）
- 这用于调试和快速测试

### 6.5 旧代码清理
- `src/ui/start-screen` 相关代码在 Phase E 后删除
- `src/ui/game-over-screen` 相关代码在 Phase E 后删除
- index.html 中旧的 `#start-screen` `#gameover-screen` DOM 移除

---

## 七、Agent 并行分工

Phase B-E 可以部分并行：

```
Phase A (串行，必须最先)
  │
  ├── Phase B: 主菜单 + 关卡选择 (Agent B)
  │     └── main-menu.js + level-select.js + main.js 导航
  │
  ├── Phase C: 商店 (Agent C，依赖 Phase A，可和 B 并行)
  │     └── shop-panel.js + 集成 meta-progression
  │
  ├── Phase D: 装备配置 (Agent D，依赖 Phase A，可和 B/C 并行)
  │     └── loadout-panel.js + startGame 改造
  │
  └── Phase E: 结算 + 集成 (Agent E，依赖 B/C/D)
        └── settlement-panel.js + endGame + 关卡参数
```

每个 Agent 的 Prompt 应包含：
- 完整接口定义（要 import 什么，要 export 什么）
- DOM 容器 ID 和 CSS 类名（确保不冲突）
- 事件名和 payload 格式
- 依赖的 meta-progression 函数签名
