# ADR-002: EventBus Architecture

## Status

Accepted

## Date

2026-06-10

## Last Verified

2026-06-10

## Decision Makers

ChangxinWang, Claude (lead-programmer)

## Summary

所有模块间通信通过单一 EventBus 单例完成。系统之间不直接引用，只通过 game-state 共享数据和 EventBus 触发副作用（音效、VFX、UI 更新）。事件命名规范：`namespace:verb`（如 `enemy:died`）。

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web (JavaScript) |
| **Domain** | Core / Architecture |
| **Knowledge Risk** | LOW |
| **References Consulted** | MDN CustomEvent, Observer pattern |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | None |
| **Enables** | ADR-003 (Game State Schema), ADR-004 (UI Architecture) |
| **Blocks** | Phase 1: 基础框架 |
| **Ordering Note** | 先于所有系统实现 |

## Context

### Problem Statement

游戏包含 10+ 个系统（生成、战斗、技能、奖励、经济、渲染、音频、UI...），需要一种低耦合的通信方式。系统间直接引用会导致循环依赖和无法独立测试。

### Requirements

- 系统可以向其他系统广播事件而不需要知道对方是谁
- UI 可以订阅游戏事件更新而不修改游戏逻辑
- 音频/VFX 是纯副作用，不应该阻塞游戏逻辑
- 支持取消订阅防止内存泄漏

## Decision

使用发布/订阅 EventBus 单例。所有模块 import `{ events } from './core/event-bus.js'`。

### Architecture

```
System A ──emit('enemy:died')──→ EventBus ──→ UI (更新击杀计数)
  (combat)                        │
                                  ├─→ Audio (播放击杀音效)
                                  ├─→ VFX (播放死亡粒子)
                                  ├─→ Economy (增加金币)
                                  └─→ System B (检查任务进度)
```

### Key Interfaces

```js
// 已实现: src/core/event-bus.js
events.on('enemy:died', (payload) => { ... });    // 订阅
events.off('enemy:died', callback);               // 取消
events.emit('enemy:died', { enemyId, gold, x, y }); // 触发
```

### Event Naming Convention

```
domain:action
enemy:spawned    enemy:hit     enemy:died
boss:spawned     boss:died     boss:phaseChange
player:damaged   player:healed player:died
gold:changed     skill:activated
reward:show      reward:picked
game:start       game:over     wave:start
```

## Alternatives Considered

### Alternative 1: 直接函数调用

- **Pros**: 简单，类型安全，易调试
- **Cons**: 系统间紧密耦合，循环依赖，无法独立测试
- **Rejection Reason**: 10+ 个系统互相调用会导致依赖图不可维护

### Alternative 2: CustomEvent / DOM 事件

- **Pros**: 浏览器原生，devtools 支持
- **Cons**: 依赖 DOM 元素，序列化限制，性能低于直接调用
- **Rejection Reason**: 游戏循环高频事件不适合走 DOM 事件系统

## Consequences

### Positive

- 系统完全解耦，可独立开发测试
- 新增系统不影响已有系统
- 事件命名规范强制统一

### Negative

- 事件链难以追踪（emit 不知道谁在 listen）
- 无编译时类型检查（JS 天然限制）
- 如果滥用可能变成"事件汤"

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| 事件风暴（每帧大量 emit） | Low | Medium | 高频数据走 game-state 直接读取，事件只用于关键时刻 |
| 忘记取消订阅导致内存泄漏 | Medium | Low | `on()` 返回 unsubscribe 函数；UI 销毁时清理 |

## Validation Criteria

- [x] EventBus 单例正确实现（已验证）
- [ ] 所有事件命名符合 `namespace:verb` 规范
- [ ] 热路径（每帧）无事件 emit，只读 game-state

## Related

- `src/core/event-bus.js` (已实现)
- ADR-003: Game State Schema
