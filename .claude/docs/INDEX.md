# .claude/docs 索引

## 自动注入（CLAUDE.md 通过 @ 引用 → Agent 上下文自动加载）

这些文档每次对话、每个子 Agent 都能看到。**修改后需要重新开对话才生效。**

| 文件 | 作用 |
|------|------|
| [ai-game-dev-workflow.md](ai-game-dev-workflow.md) | 引擎无关通用开发流程。Phase 0-6，Agent 映射表，自动闭环规则 |
| [agent-delegation-rules.md](agent-delegation-rules.md) | 何时用/不用 Agent，Prompt 写法，反模式清单 |
| [directory-structure.md](directory-structure.md) | 项目目录结构规范 |
| [technical-preferences.md](technical-preferences.md) | 命名规范、性能预算、禁止模式、引擎 specialist 路由 |
| [INDEX.md](INDEX.md) | 本文档 |

## 手动按需（Agent 需要时主动 Read）

| 文件 | 作用 | 什么时候读 |
|------|------|-----------|
| [agent-pr-workflow.md](agent-pr-workflow.md) | Git 分支→PR→review→merge 具体命令和格式 | 实现 Agent 准备提交时 |
| [agent-coordination-map.md](agent-coordination-map.md) | Agent 层级关系图，谁可以委派给谁 | 多 Agent 协调时 |
| [agent-roster.md](agent-roster.md) | 所有 Agent 速查表（50个） | 不确定用哪个 Agent 时 |
| [art-asset-acquisition.md](art-asset-acquisition.md) | Playwright 下载免费素材的 7 步流程 | 需要美术/音效资源时 |
| [coordination-rules.md](coordination-rules.md) | Agent 协作规则、冲突升级路径 | 多 Agent 并行时 |
| [new-project-checklist.md](new-project-checklist.md) | 从零搭建项目的 7 步清单 | 开新项目时 |
| [coding-standards.md](coding-standards.md) | 编码标准详情 | 不确定代码风格时 |
| [context-management.md](context-management.md) | 上下文管理策略 | 长对话避免爆上下文时 |
| [hooks-reference.md](hooks-reference.md) | Git hooks 使用说明 | 配置 hooks 时 |
| [director-gates.md](director-gates.md) | Director 审批门 | 需要创意/技术审批时 |
| [quick-start.md](quick-start.md) | 快速开始指南 | 新人上手时 |
| [review-workflow.md](review-workflow.md) | 代码审查流程 | 审查 Agent 准备 review 时 |
| [rules-reference.md](rules-reference.md) | 各代码规则索引 | 需要查具体规则时 |
| [setup-requirements.md](setup-requirements.md) | Godot/GUT 安装配置 | 搭建开发环境时 |
| [skills-reference.md](skills-reference.md) | Skill 索引（76个） | 不确定用哪个 Skill 时 |
| [CLAUDE-local-template.md](CLAUDE-local-template.md) | 个人 CLAUDE.md 模板 | 定制个人配置时 |
| [settings-local-template.md](settings-local-template.md) | 个人 settings.local.json 模板 | 定制个人权限时 |
| [workflow-catalog.yaml](workflow-catalog.yaml) | 工作流目录 | 查找预设工作流时 |

## 模板目录（Agent 按需读取）

| 目录 | 内容 |
|------|------|
| [templates/](templates/) | GDD、ADR、关卡设计、经济模型、UX、音效等全套文档模板 |
| [hooks-reference/](hooks-reference/) | 各 Git hook 的详细输入输出 schema |

## 其他关键文件（不在 .claude/docs/ 内）

| 文件 | 作用 |
|------|------|
| `../agents/*.md` | 50 个 Agent 定义文件 |
| `../skills/*/SKILL.md` | 76 个 Skill 定义文件 |
| `../rules/*.md` | 11 条代码规则（GDScript、引擎、UI、测试等） |
| `../hooks/*.sh` | 12 个 Git hook 脚本 |
| `../settings.json` | 项目级权限配置 |
| `../settings.local.json` | 个人权限配置（gitignore，不提交） |
| `../../.github/workflows/validate.yml` | CI：PR 时自动跑 godot --check-only |
