# AI Game Dev Workflow — 引擎无关核心流程

**这是所有 AI 辅助游戏开发对话的最高优先级参考。任何引擎、任何项目类型都必须遵循。**

---

## 0. 项目发现阶段（每次新对话开始）

在写任何代码之前，必须先搞清楚：

1. **这是什么项目？** — 游戏类型、核心玩法、目标平台
2. **用什么技术？** — 引擎、语言、框架、版本
3. **项目处于什么阶段？** — 全新/原型/制作中/维护
4. **有什么已有约束？** — 已定的架构、规范、命名约定

如果 CLAUDE.md 或已有文档回答了这些问题，直接引用。没有的话，**先问用户确认再动手**。

---

## 1. 技术栈适配

### 引擎检测

根据项目文件自动判断引擎：
- `project.godot` → Godot 4.x + GDScript
- `Assets/` + `ProjectSettings/` → Unity + C#
- `*.uproject` → Unreal + C++/Blueprint
- `package.json` + `next.config` → Web (Next.js/React)
- `Cargo.toml` → Rust
- `go.mod` → Go
- 无上述 → 纯代码项目，看文件后缀

### Agent 映射

| 引擎 | 主 Specialist | 语言/代码 Specialist | 场景/资源 |
|------|-------------|---------------------|----------|
| Godot | `godot-specialist` | `godot-gdscript-specialist` | `godot-specialist` |
| Unity | `unity-specialist` | — | `unity-specialist` |
| Unreal | `unreal-specialist` | `ue-blueprint-specialist` | `unreal-specialist` |
| Web/React | `ui-programmer` | `typescript-expert` | — |
| 通用 | `lead-programmer` | 按语言选 | — |

**原则：根据实际技术栈选 agent，不要默认用 Godot。**

---

## 2. 通用开发阶段（任何项目适用）

### Phase 0 — Plan（任何项目的第一步）

**先按模板填空，再写代码。** 模板：`.claude/docs/templates/project-plan-template.md`

```
输入：用户的想法
输出：填好的 project-plan-template（所有 Phase 0/A/B 部分）
Agent：game-designer（A1-A5）+ lead-programmer（B1-B5）
```

A4 和 A5 是**强制项**——不填完不能进入实现。明确列出需要什么资源、怎么获取。

### Phase A — 设计

```
输入：Plan 模板
输出：GDD 文档
Agent：game-designer / systems-designer / level-designer
```

如果用户说"做个XXX游戏"但没给细节 → 先填 Plan 模板，再出 GDD。

### Phase A-Art — 美术资源获取（强制，不可跳过）

**Phase A 完成后，立刻根据 A4 清单获取资源。不许用占位符。**

```
输入：Plan 模板的 A4 美术需求清单
输出：PNG/OGG 文件放入 assets/
Agent：asset-hunter
```

**asset-hunter 工作流**：
1. 读 A4 清单
2. WebSearch 搜索免费资源
3. Playwright 下载
4. 解压 → 验证 → 复制到 `assets/`
5. 更新 `.tscn` 引用

**严禁**：自己手写 SVG、用 icon.svg 占位、跳过美术直接写代码。
**美术没到位不许进 Phase B。**

### Phase B — 架构

```
输入：设计文档
输出：ADR 或技术方案文档
Agent：lead-programmer（代码架构）/ technical-director（重大决策）
```

- 确定项目结构、核心模式、数据流
- **不改代码**，只出文档
- ADR 写入 `docs/adr/`，项目 CLAUDE.md 同步更新引用

### Phase C — 实现 → 审查 → 修复 → 合并（自动闭环）

**核心原则：主对话不接触代码。只做协调。agent 之间通过 PR 通信。**

```
主对话                          实现 Agent               审查 Agent
──────                          ──────────               ──────────
1. 分配任务 ──────────────→    2. 开分支写代码
                               3. git push + PR
                               4. 报告 PR 编号
5. 发动审查 ──────────────────────────────────────────→ 6. gh pr diff
                                                          7. 审查代码
                                                          8. 贴 review
                               ←── 9a. 需要修改 ──────
10. 发动修复 ──────────────→   11. 读 review 评论
                               12. 改代码 push
                               13. 报告"已修复"
14. 重新审查 ────────────────────────────────────────→ 15. gh pr diff
                                                          16. approved ✓
17. gh pr merge ✓
```

**步骤 1-4：分配任务 + 创建 PR**

主对话发动实现 agent：
```
Agent({
  subagent_type: "godot-gdscript-specialist",
  description: "Create PR: player dash ability",
  prompt: "为 Player 添加冲刺技能。

任务：
1. git checkout -b feat/player-dash
2. 修改 src/gameplay/player/player.gd：
   - 双击方向键触发冲刺
   - 冷却 3 秒，冲刺速度 1200px/s，持续 0.2 秒
   - 冲刺期间无敌
3. git commit + git push -u origin feat/player-dash
4. gh pr create --title 'feat: player dash' --body '...'
5. 报告 PR 编号

不要询问任何问题，直接执行。"
})
```

**步骤 5-9：自动审查**

实现 agent 返回 PR 编号后，主对话**立刻**发动审查 agent（不等用户确认）：
```
Agent({
  subagent_type: "lead-programmer",
  description: "Review PR #N",
  prompt: "审查 PR #N:
  1. gh pr diff N 获取改动
  2. 检查：架构合规、GDScript 类型安全、性能（_process 分配）、命名规范
  3. 用 gh pr review N --approve 通过
     或 gh pr review N --request-changes --body '...具体问题...'
  4. 报告 verdict: PASS 或 NEEDS_FIX + 问题列表

不要询问任何问题。"
})
```

**步骤 10-13：自动修复（如果审查不通过）**

审查 agent 返回 NEEDS_FIX 时，主对话**立刻**发动修复（原 agent 或新 agent）：
```
Agent({
  subagent_type: "godot-gdscript-specialist",
  description: "Fix PR #N review issues",
  prompt: "修复 PR #N 的审查问题：
  1. gh pr view N --comments 读取审查意见
  2. 逐条修复
  3. git add + git commit -m 'fix: address review comments'
  4. git push
  5. 报告"已修复"

不要询问任何问题。"
})
```

修复后回到步骤 5 重新审查，直到 PASS。

**步骤 17：合并**

审查通过后，主对话**立刻**合并：
```bash
gh pr merge N --squash --delete-branch
git checkout main && git pull
```

### 主对话的职责边界

| 可以做 | 禁止做 |
|--------|--------|
| 分配任务给 agent，给定文件路径+需求+约束 | 读 agent 产出的代码文件 |
| 记录 PR 编号 | 在主对话里做 code review |
| 按 verdict 自动发动下一个 agent | 手动逐行看 diff 后提意见 |
| 并行发动多个 feature agent | 跳过审查直接 merge |

### Agent 的职责边界

| 实现 Agent | 审查 Agent |
|-----------|-----------|
| 开分支、写代码、commit、push、创建 PR | 读 PR diff |
| 收到审查意见后修复、push | 检查架构/性能/风格/安全 |
| 报告 PR 编号 或 "已修复" | 输出 PASS / NEEDS_FIX + 具体问题 |
| **不对自己的代码做审查** | **不修改代码，只评论** |

---

## 3. 资源获取（引擎无关）

需要美术/音效/字体等资源时：
- 调用 `asset-hunter` agent
- 流程：WebSearch → playwright 访问 → 下载 → 解压 → 验证 → 复制到项目
- 详见 `.claude/docs/art-asset-acquisition.md`

---

## 4. 对话规则（每次都要遵守）

### 必须做的

- 写/改代码 → 用子 agent
- 独立任务 → 并行发 agent，不串行等
- Agent prompt → 写清楚文件路径、需求、约束、加"不要询问"
- 代码产出后 → 验证（语法检查/编译）

### 禁止的

- 主对话里直接写多行代码
- Agent prompt 只写一句话
- 用 agent 做搜索/读文件（直接用 Read/Grep）
- 不验证就告诉用户"做好了"
- 默认假设项目是 Godot

### 反模式速查

| 反模式 | 正确做法 |
|--------|---------|
| 用户说"加个功能" → 直接写代码 | 先确认技术栈 → 选正确 agent → agent 写 |
| Agent 来回问"要不要" | Prompt 写清楚，加"不要询问" |
| 3个独立 agent 串行调用 | 一条消息并行发 |
| 不读文件就说"做好了" | `godot --check-only` / `tsc --noEmit` 验证 |

---

## 5. 不同引擎的最小验证命令

| 引擎 | 验证命令 |
|------|---------|
| Godot | `godot --headless --path . --check-only` |
| Unity | `unity -batchmode -quit -nographics -executeMethod BuildScript.Verify` |
| TypeScript/Web | `npx tsc --noEmit` |
| Rust | `cargo check` |
| Go | `go build ./...` |
| Python | `python -m py_compile <files>` |
| 通用 | 查找项目的 linter/build 命令 |

---

## 6. 与 CLAUDE.md 的关系

CLAUDE.md 定义「这个特定项目」的配置（引擎版本、命名规范、已定架构）。
本文档定义「任何项目」的通用流程。

两者同时加载，本文档优先级更高。当两者冲突时，以本文档为准。
