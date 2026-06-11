# Click Rouge 开发计划

> 最后更新：2026-06-11
> 状态：Phase 7 完成，准备 Phase 8

---

## 前置修复
- [x] technical-preferences.md → Web/Canvas/JS 规范
- [x] .github/workflows/validate.yml → JS 语法检查
- [ ] CLAUDE.md → 更新 agent 路由表

## 架构文档
- [x] ADR-001: Canvas 2D Rendering
- [x] ADR-002: EventBus Architecture
- [x] ADR-003: Game State Schema
- [ ] ADR-004-007: 待补充

---

## Phase 1-4: 核心游戏循环 ✅
- [x] Phase 1: 核心引擎（game-loop, event-bus, game-state, canvas-renderer, random, object-pool）
- [x] Phase 2: 敌人与战斗（enemy, spawn, combat, economy, renderers, audio）
- [x] Phase 3: 玩家受伤 + HUD + 难度曲线 + 伤害数字
- [x] Phase 4: Boss 系统 + 奖励面板 + 真实数据替换

## Phase 5+6: 奖励数据 + 技能/随从系统 ✅
- [x] 数据表：12 件装备、6 种技能、4 种随从、6 种被动、平衡常量
- [x] progression-system：属性聚合
- [x] skill-system：6 种技能（雷霆/冰冻/狂暴/治疗/毒刃/淘金）+ 冷却管理
- [x] follower：4 种随从 AI（骑士/弓箭手/治疗精灵/金币磁铁）+ 投射物
- [x] equipment-panel + skill-bar UI
- [x] 审查修复：awardGold、stat compounding、layout 解耦、error fix

## Phase 7: 表现力打磨 ✅
- [x] VFX：雷霆/冰冻/治疗/中毒粒子、屏幕闪白 — PR #10
- [x] notification-log：战斗通知日志 — PR #11
- [x] canvas-renderer：背景渐变、屏幕闪白覆盖层

---

## Phase 8: 平衡 + 测试 + 试玩

- [ ] 试玩验证：完整游戏循环（开始→击杀→Boss→奖励→成长→死亡→重开）
- [ ] 数值平衡调优（balance-config.js）
- [ ] 难度曲线验证
- [ ] `tests/unit/combat-system.test.js`
- [ ] `tests/unit/spawn-system.test.js`
- [ ] `tests/unit/reward-system.test.js`
- [ ] `tests/unit/progression-system.test.js`
- [ ] 性能分析：30 分钟 < 256MB，60fps 稳定

---

## 资源获取（AI 生成）
- [x] 音效 — Web Audio API 程序化生成（hit/crit/death/gold/boss/thunder/freeze/heal/UI）
- [x] 视觉效果 — 纯色几何体 + 粒子系统
- [ ] 字体 — 系统默认字体栈

## 待定 / 可扩展
- [ ] 存档系统（localStorage）
- [ ] 成就系统
- [ ] 排行榜
- [ ] 更多 Boss/敌人类型
- [ ] 更多奖励类型

## PR 总览
| # | 内容 | 状态 |
|---|------|------|
| 1 | RNG + ObjectPool | MERGED |
| 2 | entry page | CLOSED |
| 3 | enemy entity | MERGED |
| 4 | difficulty + damage numbers | MERGED |
| 5 | reward system | CLOSED |
| 6 | boss system | CLOSED |
| 7 | reward data + progression | MERGED |
| 8 | skill + follower | MERGED |
| 9 | equipment + skill bar UI | MERGED |
| 10 | VFX polish | MERGED |
| 11 | notification log | CLOSED |
