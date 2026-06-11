# Click Rouge — Meta-Progression 系统架构设计

> 状态：待审批
> 日期：2026-06-11

---

## 概述

当前游戏只有局内循环（开始→战斗→死亡→重开），金币在死亡后清零。需要加入局外成长系统，让金币有长期价值。

**核心改动**：金币从"局内货币"升级为"局内+局外双货币体系"。30% 局内收入转为永久金币，在局外商店购买永久升级。

---

## 金币流动

```
局内击杀 → awardGold() → STATE.player.gold (局内)
                              ↓
                         死亡结算
                              ↓
        永久金币 = 局内金币 × 15% + 波次 × 2 + Boss击杀 × 10
                              ↓
                    localStorage 持久化存储
                              ↓
              商店消费 → 购买永久升级 → 下局 reset() 时生效
```

---

## 新增 5 个界面

### 1. 主菜单（Lobby）
替换当前单一"开始游戏"按钮。

```
┌──────────────────────────────────────┐
│                        [金币: 999]    │
│          CLICK ROUGE                 │
│          点击肉鸽                    │
│                                      │
│        [ 开始冒险 ]   → 关卡选择      │
│        [ 商    店 ]   → 商店面板      │
│        [ 装备配置 ]   → 战前配置      │
│                                      │
│   总游玩: 42 | 最高波次: 15          │
└──────────────────────────────────────┘
```

### 2. 关卡选择（Level Select）
5 关，难度递增。通关解锁下一关。

| 关卡 | 名称 | 推荐 ATK | 敌人 | Boss | 难度倍率 |
|------|------|---------|------|------|---------|
| 1 | 翠绿草原 | 10 | slime | giant_slime | 1.0x |
| 2 | 幽暗墓地 | 25 | slime/bat/ghost | giant_slime/skeleton_king | 1.3x |
| 3 | 烈焰火山 | 45 | slime/bat/golem/fire_skull | skeleton_king/fire_dragon | 1.6x |
| 4 | 极寒冰原 | 70 | bat/golem/ghost/fire_skull | skeleton_king/fire_dragon | 2.0x |
| 5 | 深渊裂隙 | 100 | golem/ghost/fire_skull | skeleton_king/fire_dragon | 2.5x |

每关有独立的敌人池、Boss 池、生成间隔、Boss 出现时间、难度倍率。

### 3. 商店（Shop）

用永久金币购买技能、随从、装备、属性强化。购买后进入"仓库"，永久保留。

**属性强化**（永久加成，可多次购买，价格递增）

| 项目 | 效果/级 | 基础价格 | 备注 |
|------|---------|---------|------|
| 攻击力 | +3 ATK | 100G | 无上限 |
| 生命值 | +10 HP | 100G | 无上限 |
| 暴击率 | +2% | 150G | 无上限 |
| 暴击倍率 | +0.1x | 200G | 无上限 |
| 金币倍率 | +5% | 150G | 无上限 |
| 攻速 | +3% | 150G | 无上限 |

价格公式：`baseCost × (1 + currentLevel × 0.5)`

**技能/随从/装备升级**（可重复购买，每次提升一级）

| 类别 | 项目 | 基础价格 | 效果 |
|------|------|---------|------|
| 技能 | 雷霆一击 / 冰冻 / 狂暴 / 治疗 / 毒刃 / 淘金热 | 各 300G | 每级提升技能效果（伤害/持续/冷却） |
| 随从 | 骑士 / 弓箭手 / 治疗精灵 / 金币磁铁 | 各 300G | 每级提升随从属性（伤害/治疗量） |
| 装备 | 3 件（武器/护甲/饰品各一，靠升级变强） | 200G | 每级提升装备属性 |

首次购买获得 Lv.1，后续购买逐级升级。购买后自动进入仓库。

### 4. 装备配置（Loadout）
战前从**仓库**（已购买的所有物品）中选择本局携带的。

```
┌──────────────────────────────────────────────┐
│  [←返回]          装备配置          [开始战斗]  │
│                                              │
│  仓库 — 已拥有 (点击选中，再次点击取消)         │
│                                              │
│  技能 (已选 3/4)                              │
│  ┌────────┬────────┬────────┬────────┬────────┐
│  │✓雷霆 Lv3│✓冰冻 Lv1│✓治疗 Lv2│ 狂暴 Lv1│ 毒刃 Lv1│
│  └────────┴────────┴────────┴────────┴────────┘
│                                              │
│  随从 (已选 2/4)                              │
│  ┌────────┬────────┬────────┬────────┐       │
│  │✓骑士 Lv3│✓精灵 Lv1│ 弓箭手  │ 磁铁   │       │
│  └────────┴────────┴────────┴────────┘       │
│                                              │
│  装备                                         │
│  武器: [生锈短剑 Lv5]  护甲: [皮背心 Lv2]  饰品: [铜戒 Lv1]│
└──────────────────────────────────────────────┘
```

- 仓库中所有已购物品以卡片展示，选中高亮（✓）
- 技能最多选 4 个，随从最多选 4 个，装备 3 个槽位各选 1 个
- 可留空（不选满也能开始）
- 选中的物品在局内以当前等级加载，战斗中 N 选 1 可继续升级

### 5. 结算面板（Settlement）
替代当前简陋的 game-over 屏幕。

```
┌──────────────────────────────────────┐
│          本次冒险结束                 │
│                                      │
│  存活: 5:23 | 波次: 12               │
│  击杀: 87   | 金币: 342              │
│                                      │
│  ─── 永久金币 ───                     │
│  局内 342 × 15% = 51                 │
│  波次 12  × 2   = 24                 │
│  Boss 3   × 10  = 30                 │
│  ─────────────────                   │
│  +105 永久金币                       │
│                                      │
│  [返回大厅]    [再来一局]             │
└──────────────────────────────────────┘
```

---

## 数据持久化

### localStorage 结构（key: `click_rouge_meta`）

```json
{
  "version": 1,
  "permanentGold": 0,
  "unlockedLevels": [1],
  "completedLevels": [],
  "statUpgrades": { "atk": 0, "hp": 0, "critChance": 0, "critMult": 0, "goldMult": 0, "atkSpeed": 0 },
  "ownedSkills": { "thunder_strike": 1 },
  "ownedFollowers": { "knight": 1 },
  "ownedEquip": { "rusty_sword": 3, "leather_vest": 1 },
  "totalRuns": 0, "totalKills": 0, "bestWave": 0, "bestTime": 0,
  "levelBests": {}
}
```
每个购买的技能/随从/装备以 typeId 存入对应数组。局内升级后的等级也持久化到仓库中。

---

## 文件清单

### 新增文件（8 个）

| 文件 | 职责 |
|------|------|
| `src/systems/meta-progression.js` | localStorage 读写、永久金币管理、升级状态 |
| `src/data/level-config.js` | 5 个关卡配置数据 |
| `src/ui/main-menu.js` | 主菜单/大厅界面 |
| `src/ui/level-select.js` | 关卡选择界面 |
| `src/ui/shop-panel.js` | 商店界面（仅属性强化） |
| `src/ui/loadout-panel.js` | 战前装备配置界面 |
| `src/ui/settlement-panel.js` | 死亡结算界面 |

### 修改文件（5 个）

| 文件 | 变更 |
|------|------|
| `src/main.js` | 替换 start-screen 流程为主菜单流程；level-aware startGame()；结算流程 |
| `src/core/game-state.js` | 降低初始槽位；reset() 中调用 applyMetaToPlayer() |
| `src/systems/spawn-system.js` | 支持关卡配置驱动敌人/Boss 池和生成参数 |
| `src/systems/difficulty-system.js` | 乘以关卡难度倍率 |
| `src/systems/economy-system.js` | 应用关卡金币倍率 |
| `index.html` | 新增所有 DOM 容器 |

---

## 实现 Phase

### Phase 1: Meta 数据层
- meta-progression.js + game-state.js 修改
- localStorage 读写 + applyMetaToPlayer()
- 金币转换逻辑

### Phase 2: 主菜单 + 关卡选择
- main-menu.js + level-select.js + level-config.js
- 替换旧 start-screen
- 关卡驱动生成参数

### Phase 3: 商店
- shop-panel.js + shop-items.js
- 购买流程 + 价格递增

### Phase 4: 装备配置 + 结算
- loadout-panel.js + settlement-panel.js
- 战前 skill/follower/equip 选择
- 死亡结算 + 金币转换明细

---

## 关键设计原则

1. **meta 状态与 game 状态分离** — meta 存 localStorage 跨局持久（仓库/属性/金币），STATE 每局 reset
2. **仓库模式** — 商店购买 → 进入仓库（永久存储）→ 战前从仓库选配 → 局内升级后回写仓库
3. **局内 N 选 1 可升级仓库物品** — 如果选中的技能/随从/装备已在仓库中，局内升级会持久化回仓库
4. **UI 通过 EventBus 通信** — 不直接改 STATE
5. **关卡配置是纯数据** — 无逻辑，无导入
6. **向下兼容** — 没有关卡配置时 spawn-system 回退到默认行为
7. **localStorage 不可用时降级** — 内存态运行，console.warn 提示
