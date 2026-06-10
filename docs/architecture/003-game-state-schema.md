# ADR-003: Game State Schema

## Status

Accepted

## Date

2026-06-10

## Last Verified

2026-06-10

## Decision Makers

ChangxinWang, Claude (lead-programmer + systems-designer)

## Summary

游戏状态使用单一可变 JS 对象，所有系统直接读写。不使用 Redux 式不可变更新。状态包含 player、enemies、particles、wave/timer 等字段。通过 `STATE.reset()` 恢复初始值。

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web (JavaScript) |
| **Domain** | Core / Architecture |
| **Knowledge Risk** | LOW |
| **References Consulted** | None |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-002 (EventBus) |
| **Enables** | All gameplay systems |
| **Blocks** | Phase 1: 基础框架 |
| **Ordering Note** | 与 EventBus 同时确定，先于所有系统 |

## Context

### Problem Statement

需要统一的游戏状态存储方式。10+ 个系统需要读写共享数据（玩家 HP、敌人列表、金币数等）。需要支持快速重置（新一局）。

### Requirements

- 单线程游戏，不需要并发安全
- 状态结构必须一眼看清全貌
- 支持 `reset()` 快速恢复
- 避免深层嵌套（方便遍历/序列化）

## Decision

单一可变 JS 对象 `STATE`，位于 `src/core/game-state.js`。纯数据，无 class 方法（`reset()` 除外）。

### State Schema

```js
STATE = {
  player: {
    hp, maxHp, baseAtk,
    gold, clickAtk, autoAtk,
    critChance, critMult, atkSpeedMult,
  },
  enemies: [],        // { id, typeId, hp, maxHp, x, y, size, color, aliveTimer, ... }
  particles: [],      // { x, y, vx, vy, life, maxLife, color, size }
  followers: [],      // { typeId, x, y, atkTimer, atkCooldown, targetId, damage }
  projectiles: [],    // { x, y, vx, vy, damage, ttl }

  gameStatus: 'start' | 'playing' | 'rewardPicking' | 'gameOver',
  elapsedTime: 0,
  wave: 1,
  bossTimer: 60,
  killCount: 0,

  clickQueue: [],     // 本帧待处理的点击坐标

  reset()             // 恢复到 INITIAL_STATE
}
```

### Key Rules

- **系统写 state，渲染器读 state，UI 读 state**
- **高频变化（每帧）：enemies、particles、elapsedTime → 直接读 state**
- **低频事件（击杀、受伤、Boss 死）：通过 EventBus 通知 UI/音频/VFX**
- **reset() 用 JSON deep clone 从冻结的 INITIAL_STATE 模板恢复**

## Alternatives Considered

### Alternative 1: 不可变状态（Redux 式）

- **Pros**: 时间旅行调试，变更可追溯
- **Cons**: 每帧创建新对象 → GC 压力；代码啰嗦
- **Rejection Reason**: 单线程游戏不需要不可变开销

### Alternative 2: 分散状态（每个系统管理自己数据）

- **Pros**: 封装好，系统独立
- **Cons**: 跨系统查询困难（渲染需要遍历所有敌人，敌人归 spawn 还是 combat？）
- **Rejection Reason**: 渲染和 UI 需要全局视图

## Consequences

### Positive

- 状态全貌一目了然
- 渲染/UI 可以遍历任意状态
- 序列化简单（存档功能的基础）

### Negative

- 任何系统可能误改其他系统的数据
- 无访问控制，靠约定保证安全

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| 系统 A 误改系统 B 的字段 | Low | Medium | 命名规范 + code review |
| 状态膨胀（后期字段太多） | Low | Low | 按 domain 分组（player/enemies 已是顶层 key） |

## Validation Criteria

- [x] STATE 单例正确实现（已验证）
- [x] reset() 正确恢复初始状态
- [ ] 所有系统只修改自己的命名空间
- [ ] 无系统在热路径中调用 JSON.stringify（序列化只在存档时）

## Related

- `src/core/game-state.js` (已实现)
- ADR-002: EventBus Architecture
