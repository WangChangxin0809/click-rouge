# Technical Preferences

## Engine & Language
- **Engine**: Web (HTML5 Canvas + DOM)
- **Language**: JavaScript (ES Modules, no TypeScript to avoid build step)
- **Rendering**: Canvas 2D API for game world, CSS/DOM overlay for UI panels
- **Audio**: Web Audio API (procedural sound effects, no audio files required)
- **Entry Point**: Single `index.html` with `<script type="module">`

## Input & Platform
- **Target Platforms**: Web browser (Chrome, Firefox, Edge, Safari)
- **Input Methods**: Mouse click/touch tap (primary), Keyboard (skill hotkeys 1-4)
- **Primary Input**: Click/tap anywhere on canvas
- **Touch Support**: Full (click events work on mobile)
- **Platform Notes**: No build step required. Open index.html directly in browser.

## Naming Conventions (JavaScript)
- **Classes**: PascalCase (`class GameLoop`)
- **Functions**: camelCase (`function calculateDamage()`)
- **Variables**: camelCase (`let currentHealth`)
- **Constants**: UPPER_SNAKE_CASE (`const MAX_SPEED = 500`)
- **Events**: colon-separated, lowercase with namespace (`'enemy:died'`, `'player:damaged'`)
- **Files**: kebab-case (`game-loop.js`, `combat-system.js`)
- **Private members**: `_underscore` prefix or `#` private fields

## Performance Budgets
- **Target Framerate**: 60 FPS
- **Frame Budget**: 16.6ms
- **Max Active Enemies**: 50 (hard cap in spawn system)
- **Max Active Particles**: 500 (object pool, oldest recycled when exhausted)
- **Max Active Followers**: 10
- **Memory Ceiling**: < 256 MB
- **Canvas Draws**: < 200 per frame (batch similar entities)

## Testing
- **Framework**: Browser-based plain JS assertion tests
- **Test Runner**: Load `tests/run-all.html` in browser, see PASS/FAIL in console
- **Minimum Coverage**: Core gameplay systems (combat, spawn, reward, progression, economy)
- **No external test framework** — self-contained assertion functions

## Forbidden Patterns
- No external libraries or frameworks (pure vanilla JS)
- No `eval()`, `new Function()`, or dynamic code execution
- No allocations in hot loops (pre-allocate arrays, use object pools)
- No direct DOM manipulation from game systems (use EventBus → UI layer)
- No hardcoded gameplay values (use `balance-config.js`)
- No circular imports between modules
- No deep class inheritance (prefer composition)

## Allowed Libraries / Addons
- None. Pure vanilla JS. No npm, no bundler, no framework.

## Engine Specialists
- **Primary**: ui-programmer (Web UI architecture, Canvas + DOM integration)
- **Language/Code Specialist**: typescript-expert (covers JavaScript, even without TS)
- **Gameplay**: gameplay-programmer (game mechanics, combat, skills)
- **Renderer**: technical-artist (Canvas 2D rendering, particles, VFX)
- **Audio**: sound-designer (Web Audio API procedural SFX)
- **Design**: game-designer, systems-designer, economy-designer
- **Testing**: qa-tester, qa-lead
- **Review**: lead-programmer (code review, architecture compliance)

### File Extension Routing

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (.js files in src/systems/, src/entities/) | gameplay-programmer |
| Core engine (.js files in src/core/) | engine-programmer |
| Rendering (.js files in src/rendering/) | technical-artist |
| UI (.js files in src/ui/, .css, .html) | ui-programmer |
| Audio (.js files in src/audio/) | sound-designer |
| Data (.js files in src/data/) | systems-designer |
| Design docs (.md files in design/) | game-designer |
| Tests (.js files in tests/) | qa-tester |
| General architecture review | lead-programmer |

## Architecture Decisions Log
- [No ADRs yet — use /architecture-decision to create one]
