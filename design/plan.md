# Click Rouge 开发计划

> 最后更新：2026-06-10
> 状态：Phase 4 进行中（Boss 已合入，奖励系统审查中）

---

## 前置修复

- [x] technical-preferences.md → Web/Canvas/JS 规范
- [x] .github/workflows/validate.yml → JS 语法检查
- [ ] CLAUDE.md → 更新 agent 路由表（等所有 specialist 确定后）

---

## 架构文档

- [x] ADR-001: Canvas 2D Rendering
- [x] ADR-002: EventBus Architecture
- [x] ADR-003: Game State Schema
- [ ] ADR-004: UI Architecture (Canvas + DOM overlay)
- [ ] ADR-005: Module Loading (ES Modules, no bundler)
- [ ] ADR-006: Procedural Audio (Web Audio API)
- [ ] ADR-007: Test Strategy (browser-based assertion tests)

---

## Phase 1: 基础框架 ✅

**目标**: Canvas 渲染 + 游戏循环 + 状态管理 + 输入处理

- [x] `src/core/event-bus.js` — 发布订阅 EventBus
- [x] `src/core/game-loop.js` — rAF 游戏循环 + FPS
- [x] `src/core/game-state.js` — 中央状态对象 + reset
- [x] `src/core/random.js` — 种子随机数（Mulberry32）
- [x] `src/core/object-pool.js` — 通用对象池
- [x] `src/rendering/canvas-renderer.js` — Canvas 2D 封装（1920x1080 设计分辨率）
- [x] `index.html` — 入口页面（canvas + DOM 层）
- [x] `src/main.js` — 启动引导
- [ ] 验证：浏览器打开 index.html，渲染测试方块，FPS 显示正常

---

## Phase 2: 敌人与战斗 ✅

- [x] `src/entities/enemy.js` — 敌人实体逻辑（创建/更新/伤害，纯函数）
- [x] `src/data/enemy-definitions.js` — 5 种敌人类型数据表
- [x] `src/systems/spawn-system.js` — 敌人生成 + 波次管理（加权随机，波次门槛）
- [x] `src/systems/combat-system.js` — 点击伤害计算（最近目标，暴击判定）
- [x] `src/systems/economy-system.js` — 金币变化检测
- [x] `src/rendering/enemy-renderer.js` — 敌人绘制（身体/眼睛/血条/受击闪烁）
- [x] `src/rendering/fx-renderer.js` — 粒子系统（击打/死亡/暴击爆发，对象池）
- [x] `src/rendering/screen-shake.js` — 屏幕震动（衰减正弦波）
- [x] `src/audio/audio-manager.js` — Web Audio 程序化音效
- [ ] 验证：浏览器打开 index.html，点击击杀敌人，查看特效和音效

---

## Phase 3: 玩家受伤 + HUD ✅

- [x] `src/systems/difficulty-system.js` — 分段线性难度曲线（1.0x→5.0x，7 分钟封顶）
- [x] `src/ui/damage-numbers.js` — CSS 动画浮动伤害数字（普通/暴击/金币/Miss）
- [x] `main.js` 玩家死亡检测 — HP≤0 触发 game over + 屏幕震动
- [x] HUD（HP/金币/波次/计时）已在 index.html + main.js 中实现
- [ ] 验证：浏览器试玩，验证难度曲线和死亡流程

---

## Phase 4: Boss 系统

- [x] `src/entities/boss.js` — 3 种 Boss 行为模式（charge/summon/zigzag）
- [x] `src/data/boss-definitions.js` — 3 种 Boss 类型 + tier 分级
- [x] spawn-system 集成 — Boss 定时生成，难度缩放，事件路由
- [ ] `src/ui/reward-panel.js` — N 选 1 奖励面板（PR #5 审查中）
- [ ] `src/systems/reward-system.js` — 奖励生成逻辑（PR #5 审查中）
- [ ] 验证：Boss 出现→击杀→选奖励→继续游戏

---

## Phase 5: 完整奖励 + 成长

**目标**: 装备/技能/随从/被动 全部可用

- [ ] `src/data/equipment-data.js` — 装备数据表（4 层 x 3 槽位）
- [ ] `src/data/skill-data.js` — 技能数据表
- [ ] `src/data/follower-data.js` — 随从数据表
- [ ] `src/data/buff-data.js` — 被动增益数据表
- [ ] `src/data/balance-config.js` — 数值平衡常量
- [ ] `src/systems/progression-system.js` — 属性聚合
- [ ] `src/ui/equipment-panel.js` — 装备面板
- [ ] `src/ui/skill-bar.js` — 技能栏
- [ ] 验证：选装备→攻击力变高；选技能→技能栏出现；选随从→随从出现

---

## Phase 6: 技能 + 随从 AI

**目标**: 技能激活效果 → 随从自动攻击

- [ ] `src/systems/skill-system.js` — 技能冷却 + 激活
- [ ] `src/entities/follower.js` — 随从实体逻辑
- [ ] `src/entities/projectile.js` — 投射物（弓箭等）
- [ ] `src/rendering/follower-renderer.js` — 随从绘制
- [ ] 验证：按技能键→效果触发；随从自动索敌攻击

---

## Phase 7: 表现力打磨

**目标**: 完整 VFX + 音效 + 动画

- [ ] `src/rendering/fx-renderer.js` 完善 — 多种粒子效果
- [ ] `src/audio/sfx-hits.js` — 击中音效
- [ ] `src/audio/sfx-death.js` — 死亡音效
- [ ] `src/audio/sfx-boss.js` — Boss 音效
- [ ] `src/audio/sfx-ui.js` — UI 音效
- [ ] `src/ui/damage-numbers.js` 完善 — CSS 动画
- [ ] `src/ui/notification-log.js` — 战斗日志
- [ ] 验证：所有操作都有视听反馈，60fps 稳定

---

## Phase 8: 平衡 + 测试

**目标**: 难度平滑 → 数值平衡 → 单元测试 → 性能达标

- [ ] `tests/unit/combat-system.test.js`
- [ ] `tests/unit/spawn-system.test.js`
- [ ] `tests/unit/reward-system.test.js`
- [ ] `tests/unit/progression-system.test.js`
- [ ] `tests/unit/economy-system.test.js`
- [ ] 难度曲线调优（`balance-config.js`）
- [ ] 性能分析：30 分钟游戏 < 256MB，60fps 稳定
- [ ] 验证：所有测试通过，试玩 15 分钟无 bug

---

## 资源获取（AI 生成）

- [ ] 美术素材 — AI 生成精灵图 / 或纯色几何体 + 粒子
- [ ] 音效 — Web Audio API 程序化生成
- [ ] 字体 — 系统默认字体或 Google Fonts

---

## 待定 / 可扩展

- [ ] 存档系统（localStorage）
- [ ] 成就系统
- [ ] 排行榜
- [ ] 关卡/地图变化
- [ ] 更多 Boss 类型
- [ ] 更多奖励类型
