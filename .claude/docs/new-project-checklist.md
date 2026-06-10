# New Project Bootstrap Checklist

从零开始搭建一个带完整 Agent 工作流的 Godot 项目。

## 前置条件

- [x] Godot 4.6.2 已安装 (`d:/Godot_v4.6.2-stable_win64.exe`)
- [x] Git 已安装
- [x] GitHub CLI 已安装并登录 (`gh auth status`)
- [x] `playwright-cli` 已安装（用于 asset-hunter）

## 步骤 1：创建项目目录

```bash
mkdir my-new-game
cd my-new-game
git init
```

## 步骤 2：复制 .claude 配置

从模板项目（neon-strikers）复制核心配置：

```bash
# 必须复制
cp -r ../neon-strikers/.claude/agents .
cp -r ../neon-strikers/.claude/docs .
cp -r ../neon-strikers/.claude/rules .
cp -r ../neon-strikers/.claude/skills .
cp -r ../neon-strikers/.claude/hooks .
cp ../neon-strikers/.claude/settings.json .

# 创建本地设置（不要提交到 git）
cp ../neon-strikers/.claude/settings.local.json .
```

## 步骤 3：创建最小项目骨架

### project.godot（最小版）
```
config_version=5
[application]
config/name="My Game"
[autoload]
EventBus="*res://src/core/event_bus.gd"
[display]
window/size/viewport_width=480
window/size/viewport_height=720
[rendering]
renderer/rendering_method="gl_compatibility"
```

### CLAUDE.md（最小版）
```markdown
# My Game — Project Configuration

## Technology Stack
- Engine: Godot 4.6.2
- Language: GDScript

## Agent Delegation Rules
@.claude/docs/agent-delegation-rules.md

## Architecture Decisions Log
- [No ADRs yet]
```

### .gitignore
```
.godot/
*.import
Thumbs.db
.DS_Store
.playwright-cli/
.claude/settings.local.json
```

### 目录结构
```bash
mkdir -p src/core
mkdir -p src/gameplay
mkdir -p src/ui
mkdir -p src/systems
mkdir -p assets/art/sprites
mkdir -p assets/art/vfx
mkdir -p design/gdd
mkdir -p docs/adr
mkdir -p docs/engine-reference/godot
mkdir -p tools
```

## 步骤 4：配置引擎参考

从 neon-strikers 复制引擎参考文档：
```bash
cp ../neon-strikers/docs/engine-reference/godot/*.md docs/engine-reference/godot/
```

## 步骤 5：Git + GitHub 设置

```bash
git add -A
git commit -m "chore: project scaffold with agent workflow"
gh repo create my-new-game --private --source=. --remote=origin --push
```

## 步骤 6：安装 Git Hooks

```bash
# 让 validate-commit.sh 在每次提交前运行
cp .claude/hooks/validate-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## 步骤 7：验证

```bash
# 语法检查
godot --headless --path . --check-only

# 确认 git 工作
git status

# 确认 GitHub 连接
gh repo view
```

## 完成

现在你可以：
1. 用 Claude Code 打开项目
2. 说"设计一个XXX游戏"自动触发 game-designer agent
3. Agent 写代码 → 自动分支 → PR → review → merge
