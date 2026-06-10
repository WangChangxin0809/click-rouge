# Technical Preferences

## Engine & Language
- **Engine**: Godot 4.6.2
- **Language**: GDScript
- **Rendering**: gl_compatibility (2D rendering)
- **Physics**: GodotPhysics2D (default)

## Input & Platform
- **Target Platforms**: PC (Win/Linux/Mac), Web, Mobile
- **Input Methods**: Keyboard/Mouse, Gamepad, Touch
- **Primary Input**: Keyboard/Mouse
- **Gamepad Support**: Full
- **Touch Support**: Full
- **Platform Notes**: Touch controls as virtual joystick + buttons overlay

## Naming Conventions (GDScript)
- **Classes**: PascalCase (`PlayerController`)
- **Functions**: snake_case (`func calculate_damage()`)
- **Variables**: snake_case (`var current_health: float`)
- **Constants**: UPPER_SNAKE_CASE (`const MAX_SPEED: float = 500.0`)
- **Signals**: snake_case, past tense (`signal health_changed`, `signal died`)
- **Enums**: PascalCase name, UPPER_SNAKE_CASE values (`enum DamageType { PHYSICAL, MAGICAL }`)
- **Files**: snake_case matching class (`player_controller.gd`)
- **Scenes**: PascalCase matching root node (`PlayerController.tscn`)
- **Private members**: `_underscore` prefix (`var _internal_state: int`)

## Performance Budgets
- **Target Framerate**: 60 FPS
- **Frame Budget**: 16.6ms
- **Draw Calls**: < 200
- **Memory Ceiling**: < 256 MB
- **Max Active Bullets**: 200
- **Max Active Enemies**: 50

## Testing
- **Framework**: GUT (Godot Unit Testing)
- **Minimum Coverage**: Core gameplay systems
- **Required Tests**: Collision, damage calculation, scoring, upgrade application

## Forbidden Patterns
- No `get_node()` or `$` in `_process`/`_physics_process` (cache with `@onready`)
- No inheritance deeper than 3 levels
- No dictionaries for structured data (use typed Resources)
- No hardcoded gameplay values (use `@export` or Resources)
- No direct references between gameplay and UI code (use EventBus)
- No string-based node paths (use `@onready`)

## Allowed Libraries / Addons
- [None configured yet — add as dependencies are approved]

## Engine Specialists
- **Primary**: godot-specialist
- **Language/Code Specialist**: godot-gdscript-specialist (all .gd files)
- **Shader Specialist**: godot-shader-specialist (.gdshader files, VisualShader resources)
- **UI Specialist**: godot-specialist (no dedicated UI specialist — primary covers all UI)
- **Additional Specialists**: godot-gdextension-specialist (GDExtension / native C++ bindings only)
- **Routing Notes**: Invoke primary for architecture decisions, ADR validation, and cross-cutting code review. Invoke GDScript specialist for code quality, signal architecture, static typing enforcement, and GDScript idioms. Invoke shader specialist for material design and shader code. Invoke GDExtension specialist only when native extensions are involved.

### File Extension Routing

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (.gd files) | godot-gdscript-specialist |
| Shader / material files (.gdshader, VisualShader) | godot-shader-specialist |
| UI / screen files (Control nodes, CanvasLayer) | godot-specialist |
| Scene / prefab / level files (.tscn, .tres) | godot-specialist |
| Native extension / plugin files (.gdextension, C++) | godot-gdextension-specialist |
| General architecture review | godot-specialist |

## Architecture Decisions Log
- [No ADRs yet — use /architecture-decision to create one]
