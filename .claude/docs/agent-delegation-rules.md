# Agent Delegation Rules

## 核心原则

**任何非平凡任务必须通过子 Agent 完成，不要在主对话里直接做。**

子 Agent 的优势：
- 独立上下文窗口，不污染主对话
- 可并行执行多个独立任务
- 每个 Agent 专注一个领域，质量更高

## 何时必须用 Agent

| 场景 | 用哪种 Agent | 不用 Agent 的后果 |
|------|-------------|------------------|
| 写 GDScript 代码 | `godot-gdscript-specialist` | 类型错误、API 版本不匹配 |
| 写 Shader | `godot-shader-specialist` | 渲染管线不兼容 |
| 设计游戏机制 | `game-designer` / `systems-designer` | 数值失衡 |
| 设计关卡 | `level-designer` | 难度曲线崩坏 |
| 代码审查 | `lead-programmer` 或 `/code-review` | 低质量代码合入 |
| 找/下载资源 | `asset-hunter` | 占位符永远是占位符 |
| 性能分析 | `performance-analyst` | 热点路径漏检 |
| 安全审查 | `security-engineer` | 存档篡改、作弊漏洞 |
| 无障碍审查 | `accessibility-specialist` | 色盲玩家不可玩 |
| 测试用例 | `qa-tester` | 边界条件无覆盖 |
| 写 UI | `godot-specialist` 或 `ui-programmer` | 信号解耦违规 |
| 技术架构决策 | `technical-director` | 架构债务累积 |

## 何时不用 Agent

- 读一个已知路径的文件 → 直接用 `Read`
- 改一行文字 → 直接用 `Edit`
- 搜索一个明确的符号 → 直接用 `Grep`
- 跑一个简单命令 → 直接用 `Bash`

**原则：如果任务是单步操作，自己做。如果是多步骤、需要专业判断的，交给 Agent。**

## 如何写好 Agent Prompt

### 好的 Prompt（Agent 能独立完成）

```
为 Player 添加冲刺技能：
- 文件：src/gameplay/player/player.gd
- 双击方向键触发，冷却 3 秒
- 冲刺速度 1200px/s，持续 0.2 秒
- 冲刺期间无敌
- 使用 @export 暴露所有参数
- 遵循项目命名规范（snake_case, static typing）
- 直接写文件，不要询问
```

### 差的 Prompt（Agent 会来回问）

```
给玩家加个冲刺
```

### Prompt 必须包含的要素

1. **具体文件路径** — 不要让 Agent 猜文件在哪
2. **具体需求** — 数值、行为、边界条件
3. **约束条件** — 命名规范、禁止模式、使用的 API
4. **产出格式** — 写文件还是只做研究
5. **"不要询问"** — 防止 Agent 来回确认

## Agent 类型速查

### 产代码的（会写文件）

| Agent | 产出 | 何时用 |
|-------|------|--------|
| `godot-gdscript-specialist` | `.gd` 文件 | 所有 GDScript 代码 |
| `godot-shader-specialist` | `.gdshader` 文件 | 着色器/材质 |
| `godot-specialist` | `.tscn`, `.tres` | 场景/资源文件 |
| `ui-programmer` | UI 代码 | HUD、菜单、弹窗 |
| `ai-programmer` | AI 代码 | 行为树、状态机、寻路 |
| `gameplay-programmer` | 玩法代码 | 战斗、技能、交互 |
| `tools-programmer` | 工具代码 | 编辑器插件、调试工具 |

### 产设计的（会写设计文档）

| Agent | 产出 | 何时用 |
|-------|------|--------|
| `game-designer` | GDD、机制设计 | 新玩法、系统设计 |
| `level-designer` | 关卡布局 | 地图、波次配置 |
| `systems-designer` | 数值公式 | 伤害计算、成长曲线 |
| `economy-designer` | 经济模型 | 货币、掉落、商店 |
| `ux-designer` | UX 流程 | 屏幕转换、输入方案 |
| `narrative-director` | 叙事、对话 | 剧情、角色 |
| `world-builder` | 世界观 | 设定、派系、历史 |

### 产审查的（会写审查报告）

| Agent | 产出 | 何时用 |
|-------|------|--------|
| `lead-programmer` | 代码审查报告 | PR review、架构审查 |
| `technical-director` | 技术决策 ADR | 架构选型、技术方向 |
| `creative-director` | 创意审查 | 设计一致性、跨文档冲突 |
| `performance-analyst` | 性能报告 | 帧预算、内存泄漏 |
| `security-engineer` | 安全报告 | 作弊、存档篡改 |
| `accessibility-specialist` | A11y 报告 | 色盲、光敏、输入适配 |
| `qa-lead` / `qa-tester` | 测试用例、bug 报告 | 测试覆盖、回归检查 |

### 产资源的（会下载/生成文件）

| Agent | 产出 | 何时用 |
|-------|------|--------|
| `asset-hunter` | PNG/OGG 素材 | 找免费游戏资源 |
| `art-director` | 美术规范 | 色彩方案、风格定义 |
| `audio-director` | 音频规范 | 音效列表、混音策略 |
| `sound-designer` | SFX 规格 | 具体音效参数 |
| `writer` | 文本内容 | 游戏内文本、对话 |

### 协调用的

| Agent | 产出 | 何时用 |
|-------|------|--------|
| `producer` | 计划、追踪 | 多 Agent 协调、里程碑 |
| `release-manager` | 发布清单 | 版本发布 |
| `devops-engineer` | CI/CD、构建 | 自动化流水线 |
| `community-manager` | 公告、补丁说明 | 对外沟通 |

## 常见反模式（禁止）

### ❌ 反模式 1：把 Agent 当搜索工具

```
# 错误 — Agent 不是搜索引擎
Agent({ subagent_type: "game-designer", prompt: "什么是 EventBus？" })
```

应该直接 `Grep` 或 `Read`。

### ❌ 反模式 2：Prompt 太模糊

```
# 错误 — Agent 不知道从哪开始
Agent({ subagent_type: "godot-gdscript-specialist", prompt: "修一下代码" })
```

应该指定文件、问题、预期行为。

### ❌ 反模式 3：用 Agent 做简单编辑

```
# 错误 — 一行改动不需要 Agent
Agent({ subagent_type: "godot-gdscript-specialist", prompt: "把 player.gd 第 42 行 speed 改成 500" })
```

应该直接 `Edit`。

### ❌ 反模式 4：串行等结果

```
# 错误 — 三个独立任务应该并行
Agent(...)  # 等结果
Agent(...)  # 等结果
Agent(...)  # 等结果
```

应该在一条消息里发三个 `Agent()` 调用。

### ❌ 反模式 5：不验证 Agent 产出

```
# 错误 — Agent 可能写错文件
Agent({ ..., prompt: "写 player.gd" })
# 直接告诉用户做好了
```

应该至少 `Read` 关键文件确认，然后 `godot --check-only` 验证。

### ❌ 反模式 6：Agent 来回对话

Agent 开始问"要不要这样做？"、"确认一下这个参数"——说明 Prompt 没写清楚。

**Prompt 末尾永远加一句："不要询问任何问题，直接执行。"**

## 实际工作流

### 写新功能

```
1. game-designer（设计）  ──→  GDD 文档
        ↓
2. lead-programmer（架构）──→  技术方案
        ↓
3. godot-gdscript-specialist（实现）──→  代码文件
        ↓
4. godot --check-only（验证）──→  确认无报错
        ↓
5. git commit + push + PR
        ↓
6. lead-programmer（审查）──→  Review 评论
        ↓
7. gh pr merge（合并）
```

### 找资源

```
1. asset-hunter（搜索+下载）──→  PNG/OGG 文件
        ↓
2. 手动更新 .tscn 引用路径
        ↓
3. godot --check-only（验证）
```

### 修 Bug

```
1. qa-tester（写测试用例复现）
        ↓
2. godot-gdscript-specialist（修代码）
        ↓
3. godot --check-only（验证）
        ↓
4. git commit + PR + merge
```
