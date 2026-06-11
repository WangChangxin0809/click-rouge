# Click Rouge — 点击肉鸽

> **AI 全流程驱动的 Web 游戏作品**
>
> 本作品展示：单人 + AI 编程工具在数小时内从零产出可玩、有深度的完整游戏原型。
> 全程约 50 个 PR、~8000 行 JS/CSS/HTML，AI 担当架构师、程序员、QA、美术多重角色。
>
> 相关文档：[作品说明](SUBMISSION.md) · [交接文档](HANDOFF.md) · [对话日志](CONVERSATION_LOG.md)

## 在线体验

```bash
git clone https://github.com/WangChangxin0809/click-rouge.git
cd click-rouge
npx http-server -p 8082
# 浏览器打开 http://localhost:8082
```

## 玩法

- 点击屏幕攻击敌人，击败 Boss 通关关卡
- Boss 击败后 3 选 1 奖励（装备/技能/随从/被动）
- 局外成长：赚取永久金币，在商店购买永久升级
- 5 个关卡递增难度，通关解锁下一关
- 4 个技能槽 + 4 个随从槽 + 3 件装备

## 快速开始

```bash
# 方式1：直接打开
open index.html

# 方式2：本地服务器（推荐，避免 ES Module CORS 问题）
npx http-server -p 8082
# 然后访问 http://localhost:8082
```

## 技术栈

| 层 | 技术 |
|----|------|
| 渲染 | HTML5 Canvas 2D（1920×1080 设计分辨率） |
| 语言 | Vanilla JavaScript ES Modules |
| UI | CSS/DOM 叠加层 |
| 音效 | Web Audio API 程序化生成 |
| 持久化 | localStorage |
| 测试 | Playwright E2E |

## 项目结构

```
src/
├── main.js                 # 入口：启动、导航、事件绑定
├── core/                   # 引擎核心
│   ├── game-loop.js        # rAF 游戏循环
│   ├── game-state.js       # 中央 STATE 对象
│   ├── event-bus.js        # 发布订阅
│   ├── constants.js        # 常量
│   └── random.js           # 种子随机数
├── data/                   # 纯数据配置
│   ├── balance-config.js   # 平衡常量
│   ├── level-config.js     # 5 关配置（敌人池/Boss/难度）
│   ├── equipment-data.js   # 3 件装备定义
│   ├── skill-data.js       # 6 个技能定义
│   ├── follower-data.js    # 4 个随从定义
│   └── level-scaling.js    # 统一等级缩放公式
├── systems/                # 游戏系统
│   ├── combat-system.js    # 点击→伤害→暴击
│   ├── spawn-system.js     # 敌人生成/波次/Boss
│   ├── reward-system.js    # N 选 1 奖励生成/应用
│   ├── skill-system.js     # 技能冷却/激活/自动释放
│   ├── progression-system.js # 属性聚合 recalculateStats()
│   ├── difficulty-system.js  # 时间→难度曲线
│   ├── economy-system.js   # 金币掉落
│   └── meta-progression.js # localStorage 局外成长
├── rendering/              # Canvas 渲染
│   ├── canvas-renderer.js  # 主渲染器（DPR/缩放/绘制原语）
│   ├── sprite-renderer.js  # 精灵图渲染（水平 spritesheet）
│   ├── enemy-renderer.js   # 敌人过程式绘制（精灵图后备）
│   ├── boss-renderer.js    # Boss 光环/拖尾/入场动画
│   ├── follower-renderer.js # 随从绘制
│   ├── background-renderer.js # 星空背景
│   ├── base-renderer.js    # 城堡基地
│   └── fx-renderer.js      # 粒子特效/屏幕闪光
├── ui/                     # DOM UI 面板
│   ├── main-menu.js        # 主菜单
│   ├── level-select.js     # 关卡选择
│   ├── shop-panel.js       # 商店
│   ├── loadout-panel.js    # 装备配置（双模式：配置/战斗）
│   ├── settlement-panel.js # 结算（支持战败/通关）
│   ├── reward-panel.js     # 奖励选择
│   ├── skill-bar.js        # 底部技能栏
│   ├── equipment-panel.js  # 右侧装备面板
│   ├── damage-numbers.js   # 伤害浮动数字
│   └── notification-log.js # 左侧战斗通知
└── entities/               # 实体
    ├── enemy.js            # 敌人
    ├── boss.js             # Boss 行为
    ├── follower.js         # 随从
    └── projectile.js       # 弹幕

assets/
└── sprites/                # 精灵图资源（PNG spritesheet）
    ├── manifest.json       # 精灵定义（尺寸/帧数/布局）
    ├── slime/ bat/ ghost/ golem/ fireskull/
    └── boss/               # skeleton_king, fire_dragon
```

## 核心架构决策

- **STATE 单例**：`game-state.js` 导出一个可变 STATE 对象，所有系统直接读写
- **EventBus**：`event-bus.js` 发布订阅解耦模块间通信
- **recalculateStats()**：所有属性聚合走统一入口（`progression-system.js`）
- **CSS 注入模式**：每个 UI 面板通过 `_injectStyles()` 动态注入独立 CSS
- **缩放公式**：`scaleStats(base, perLevel, level)` → `effective = base + perLevel × (level - 1)`

## 运行测试

```bash
# 启动服务器
npx http-server -p 8082

# 运行 E2E 测试（需要 Edge 浏览器）
node test.mjs              # 导航流程 (7 项)
node test-settlement.mjs   # 结算面板 (6 项)
node test-deep.mjs         # 完整游戏循环 (6 项)
```
