# Agent PR Workflow

Agent 代码修改的标准 Git 工作流。每个改动独立分支 → PR → Code Review → 合并。

## 完整流程

```
  Agent A（写代码）                    Agent B（审查）
  ──────────────                      ──────────────
  1. git checkout -b feat/xxx
  2. 写代码、修改文件
  3. git add + git commit
  4. git push -u origin feat/xxx
  5. gh pr create --title "..."      6. Agent 被调用做 code review
     --body "..."                        → 读取 PR diff
                                         → 审查代码质量
  7. 根据 review 修改代码               → gh pr review <num> --approve
     git commit --amend / new commit     或 --request-changes
  8. gh pr merge --squash
  9. git checkout main && git pull
```

## 分支命名规范

```
feat/<描述>      — 新功能
fix/<描述>       — Bug 修复
refactor/<描述>  — 重构
art/<描述>       — 美术资源
docs/<描述>      — 文档
```

## Commit 格式

```
<type>: <简短描述>

<body — 可选，多行详细说明>

Agent: <agent-name>
```

示例：
```
feat: 实现武器升级系统

- 添加 WeaponUpgrade Resource 类
- Player 现在可以通过拾取道具升级武器
- 激光在 level 4 解锁

Agent: godot-gdscript-specialist
```

## PR 创建

```bash
gh pr create \
  --title "feat: 武器升级系统" \
  --body "$(cat <<'EOF'
## 变更内容
- 新增 UpgradeData Resource
- Player weapon_component 支持 apply_upgrade()
- 3 种升级路径

## 测试
- GUT 单元测试通过
- Godot --check-only 零错误

## Agent
godot-gdscript-specialist
EOF
  )"
```

## Code Review 流程

### 启动审查

```bash
# 获取 PR 列表
gh pr list

# 审查特定 PR
gh pr checkout <number>
# 或用 Agent 工具读取 PR diff
gh pr diff <number>
gh pr view <number> --comments
```

### 审查维度

| 维度 | 检查内容 |
|------|---------|
| 正确性 | 逻辑是否对？边界条件？null 检查？ |
| 安全 | 输入验证？碰撞检测绕过？ |
| 性能 | _process 中有分配？对象池使用正确？ |
| 风格 | snake_case？类型注解？@onready 缓存？ |
| 架构 | 遵循 ADR-0001？EventBus 解耦？组合模式？ |
| 测试 | 有关联测试？GUT 能跑？ |

### 审查结果

```bash
# 通过
gh pr review <num> --approve --body "LGTM. 架构合规，性能无问题。"

# 需要修改
gh pr review <num> --request-changes --body "## 需要修改
1. weapon_component.gd:62 — 缺少 null 检查
2. player.gd:103 — 每帧分配 PhysicsRayQueryParameters2D
3. 请补充 HealthComponent 的单元测试"
```

## 调用 Agent 做 Review

```
Agent({
  subagent_type: "lead-programmer",
  description: "Review PR #3",
  prompt: "Review PR #3 on neon-strikers repo. 
    Run: gh pr diff 3 | head -500
    Focus on: architecture compliance, performance, type safety.
    Output: structured review with approve/changes recommendation."
})
```

## 注意事项

1. **一个 PR 一个关注点** — 别把 bug fix 和新功能混在一起
2. **PR 前先跑验证** — `godot --headless --check-only` 必须通过
3. **Review 必须通过才能合并** — 不许跳过审查
4. **Agent 名字记入 commit** — 方便追踪谁改了什么
5. **Squash merge** — 保持 main 分支干净
