# ADR-001: Canvas 2D Rendering

## Status

Accepted

## Date

2026-06-10

## Last Verified

2026-06-10

## Decision Makers

ChangxinWang, Claude (lead-programmer + technical-director)

## Summary

游戏世界渲染使用 HTML5 Canvas 2D API。Canvas 负责所有游戏内实体（敌人、粒子、随从），HTML/CSS DOM 层负责所有 UI（HUD、面板、弹窗）。选择 Canvas 2D 而非 WebGL 以保持零依赖、实现简单、调试方便。

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web (HTML5 Canvas) |
| **Domain** | Rendering |
| **Knowledge Risk** | LOW — Canvas 2D API 稳定且广泛支持 |
| **References Consulted** | MDN Canvas API, HTML Living Standard |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | 在 Chrome/Firefox/Edge/Safari 测试 60fps |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | None |
| **Enables** | ADR-004 (UI Architecture) |
| **Blocks** | Phase 1: 基础框架 |
| **Ordering Note** | 必须最先确定，所有渲染代码依赖此决策 |

## Context

### Problem Statement

需要选择游戏世界的渲染方案。游戏中有 50 个以内敌人 + 500 个以内粒子的渲染需求，目标 60fps。方案必须零外部依赖。

### Constraints

- 无外部库/框架
- 单页 index.html 直接打开
- 60fps，<16.6ms 帧预算
- 必须跨浏览器兼容（Chrome/Firefox/Edge/Safari）
- 手机端触摸操作必须支持

### Requirements

- 渲染最多 50 个敌人 + 10 个随从 + 500 个粒子
- 支持屏幕震动效果（Canvas transform offset）
- 支持半透明、颜色混合

## Decision

使用 Canvas 2D API 渲染游戏世界，DOM 层渲染 UI。

### Architecture

```
┌──────────────────────────────┐
│  <canvas id="game-canvas">   │  z-index: 0
│  - 敌人 (enemy-renderer)     │
│  - 粒子 (fx-renderer)        │
│  - 随从 (follower-renderer)  │
│  - 屏幕震动 (transform)      │
├──────────────────────────────┤
│  DOM Overlay                 │  z-index: 10
│  - HUD (HP/金币/波次)        │  pointer-events: none
│  - 技能栏                    │
├──────────────────────────────┤
│  DOM Modal                   │  z-index: 100
│  - 奖励面板                  │  pointer-events: auto
│  - 开始/结束界面             │
└──────────────────────────────┘
```

### Key Interfaces

```js
// canvas-renderer.js
export class CanvasRenderer {
  constructor(canvas);
  clear();
  drawRect(x, y, w, h, color, alpha);
  drawCircle(x, y, r, color, alpha);
  drawText(x, y, text, color, size);
  setShake(offsetX, offsetY); // 屏幕震动偏移
  render(state);              // 主渲染入口
}
```

### Implementation Guidelines

- 每帧 clear + 重绘全部实体（不需要脏矩形优化，50 个实体内足够）
- 使用 `ctx.save()` / `ctx.restore()` 包裹屏幕震动偏移
- 粒子使用对象池，避免每帧 GC
- 不在 Canvas 上渲染文字 UI（用 DOM 保证清晰度）

## Alternatives Considered

### Alternative 1: WebGL

- **Description**: 使用 WebGL API 进行 GPU 加速渲染
- **Pros**: 性能上限高，shader 效果丰富
- **Cons**: 学习曲线陡，代码量大，调试困难，移动端兼容性问题多
- **Rejection Reason**: 项目实体数少（<50），Canvas 2D 完全够用。WebGL 的复杂度不值得

### Alternative 2: 纯 DOM 渲染

- **Description**: 所有实体都用绝对定位的 DOM 元素
- **Pros**: CSS 动画流畅，文本渲染清晰
- **Cons**: 大量 DOM 元素时性能差（50 个敌人 = 至少 50 个 div），样式冲突风险
- **Rejection Reason**: 50+ 实体时 DOM 重排/重绘开销太大，不适合游戏场景

## Consequences

### Positive

- 零依赖，index.html 直接打开即可运行
- 调试简单（Canvas 2D 是同步 API，状态可预测）
- 与 DOM UI 分层清晰

### Negative

- 设备像素比（DPR）需要手动处理，否则高清屏模糊
- 粒子数量有上限（CPU 绑定，不是 GPU）

### Neutral

- Canvas 2D 文本渲染不如 DOM 清晰 → 但 UI 用 DOM 层已解决

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| 高分辨率屏幕模糊 | Medium | Medium | 检测 devicePixelRatio，Canvas 尺寸 × DPR |
| 粒子过多掉帧 | Low | Medium | 粒子池硬上限 500，超出回收最旧粒子 |

## Validation Criteria

- [x] 60fps 稳定运行（Chrome DevTools FPS meter）
- [ ] 50 个敌人同时渲染不卡顿
- [ ] 500 个粒子同时渲染不卡顿
- [ ] 手机触摸操作正常

## Related

- ADR-004: UI Architecture (Canvas + DOM 分层)
- `src/rendering/canvas-renderer.js` (待实现)
