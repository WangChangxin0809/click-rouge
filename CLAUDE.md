# Click Rouge（点击肉鸽）— Project Configuration

## Core Rules（所有 Agent 必须遵守）

1. **写代码必须用子 agent，不在主对话写。** 每个 agent 独立分支→PR。
2. **PR 创建后自动发动审查，不通过自动修复。** 直到 PASS 才 merge。
3. **不读 agent 产出的代码。** 主对话只记 PR 编号和 verdict。
4. **独立任务并行发 agent。** 不串行等。
5. **Prompt 写清楚文件路径+需求+约束，末尾加"不要询问"。**
6. **不用 agent 做搜索/读文件/单行改动。** 直接用 Read/Grep/Edit。

完整流程、Agent 映射表、反模式 → @.claude/docs/ai-game-dev-workflow.md

## 文档索引

@.claude/docs/INDEX.md

## Technology Stack
- **Engine**: Web (HTML5 Canvas)
- **Language**: JavaScript (ES Modules)
- **Target**: Single-page web game (独立 HTML+CSS+JS)

## Project Structure

@.claude/docs/directory-structure.md

## Technical Preferences

@.claude/docs/technical-preferences.md

## Agent Delegation Rules

@.claude/docs/agent-delegation-rules.md

## Handoff

@HANDOFF.md — 项目交接文档，给新 AI 或开发者接手用的完整参考。

## Architecture Decisions Log

- [No ADRs yet — use /architecture-decision to create one]

## Known Issues Summary
- 攻速(`atkSpeedMult`)、吸血(`lifesteal`)、反伤(`thorns`) 属性计算了但未被战斗系统消费
- 精灵图裁剪后蝙蝠/龙为单帧（依赖程序化呼吸动画）
- `assets/textures/` 目录为废文件，应清理
- localStorage 中金币有 10000 最低值兜底（测试用，上线前改回 0）
