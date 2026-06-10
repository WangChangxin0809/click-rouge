# Setup Requirements -- Neon Strikers

> Step-by-step guide for setting up the Neon Strikers development environment.
> Engine: Godot 4.6.2 | Last Updated: 2026-06-10

---

## 1. Prerequisites

### 1.1 Required Tools

| Tool | Version | Purpose | Install |
|------|---------|---------|---------|
| **Git** | 2.40+ | Version control | [git-scm.com](https://git-scm.com/) |
| **Godot Engine** | **4.6.2** | Game engine | [godotengine.org](https://godotengine.org/download) |
| **Claude Code** | Latest | AI agent CLI | `npm install -g @anthropic-ai/claude-code` |

### 1.2 Recommended Tools

| Tool | Used By | Purpose | Install |
|------|---------|---------|---------|
| **jq** | Hooks (7 of 12) | JSON parsing in commit/push/asset/agent hooks | See Section 1.3 |
| **Python 3** | Hooks (2 of 12) | JSON validation for data files | [python.org](https://www.python.org/) |
| **Bash** | All hooks | Shell script execution | Included with Git for Windows |
| **GUT** | Testing | Godot Unit Testing framework | See Section 4 |

### 1.3 Installing jq

**Windows** (any of these):
```
winget install jqlang.jq
choco install jq
scoop install jq
```

**macOS**:
```
brew install jq
```

**Linux**:
```
sudo apt install jq     # Debian/Ubuntu
sudo dnf install jq     # Fedora
sudo pacman -S jq       # Arch
```

---

## 2. Godot 4.6.2 Installation

### 2.1 Download

Download the correct build for your platform from the official Godot download page:

- **Windows**: `Godot_v4.6.2-stable_win64.exe` (or the `.NET` variant if using C# -- not required for Neon Strikers)
- **macOS**: `Godot_v4.6.2-stable_macos.universal.zip`
- **Linux**: `Godot_v4.6.2-stable_linux.x86_64`

The project uses the **standard** build (GDScript only). No .NET/C# runtime is needed.

### 2.2 Platform-Specific Setup

#### Windows

1. Download the 64-bit standard executable.
2. Place it in a permanent location (e.g., `C:\Tools\Godot\Godot_v4.6.2-stable_win64.exe`).
3. Optionally add the directory to your `PATH` for CLI access:
   ```
   setx PATH "%PATH%;C:\Tools\Godot"
   ```
4. Godot stores editor settings and imported assets in `%APPDATA%\Godot\`. The project cache is in the project's `.godot/` directory.

#### macOS

1. Download the universal `.zip`, extract, and move `Godot.app` to `/Applications`.
2. On first launch, right-click and select "Open" to bypass Gatekeeper (unsigned app).
3. Godot stores editor settings in `~/Library/Application Support/Godot/`.

#### Linux

1. Download the 64-bit binary, mark it executable:
   ```
   chmod +x Godot_v4.6.2-stable_linux.x86_64
   ```
2. Move to a permanent location, e.g., `/usr/local/bin/godot`:
   ```
   sudo mv Godot_v4.6.2-stable_linux.x86_64 /usr/local/bin/godot
   ```
3. Godot stores editor settings in `~/.local/share/godot/`.

### 2.3 Verify Installation

Run Godot from the command line to verify:

```bash
# Windows
C:\Tools\Godot\Godot_v4.6.2-stable_win64.exe --version

# macOS
/Applications/Godot.app/Contents/MacOS/Godot --version

# Linux
godot --version
```

Expected output:
```
4.6.2.stable.official.<commit_hash>
```

---

## 3. Project Setup

### 3.1 Clone the Repository

```bash
git clone <repository-url> neon-strikers
cd neon-strikers
```

### 3.2 Project Structure

After cloning, verify the top-level directory matches the structure in `.claude/docs/directory-structure.md`:

```
neon-strikers/
  CLAUDE.md
  .claude/          # Agent definitions, skills, hooks, rules, docs
  src/              # Game source code
  assets/           # Game assets (art, audio, vfx, shaders, data)
  design/           # Game design documents
  docs/             # Technical documentation
  tests/            # Test suites
  tools/            # Build and pipeline tools
  prototypes/       # Throwaway prototypes
  production/       # Production management
```

### 3.3 Import the Project into Godot

1. Launch Godot 4.6.2.
2. In the Project Manager, click **Import**.
3. Navigate to the cloned repository directory.
4. Select the `project.godot` file.
5. Click **Import & Edit**.

**If no `project.godot` exists yet** (fresh project):

1. Launch Godot 4.6.2.
2. Click **Create** > **New Project**.
3. Set **Project Name**: `Neon Strikers`
4. Set **Project Path**: the cloned repository directory
5. Set **Renderer**: `gl_compatibility` (2D rendering -- the project does not use Vulkan)
6. Click **Create & Edit**.

### 3.4 Configure Project Settings (Fresh Project)

If setting up from scratch, apply these Project Settings:

#### General

| Setting | Value |
|---------|-------|
| `application/config/name` | `Neon Strikers` |
| `application/config/version` | `0.1.0` |
| `application/run/main_scene` | (set after main scene is created) |

#### Display

| Setting | Value |
|---------|-------|
| `display/window/size/viewport_width` | `480` |
| `display/window/size/viewport_height` | `720` |
| `display/window/size/mode` | `windowed` |
| `display/window/stretch/mode` | `canvas_items` |
| `display/window/stretch/aspect` | `keep` |

#### Rendering

| Setting | Value |
|---------|-------|
| `rendering/renderer/rendering_method` | `gl_compatibility` |
| `rendering/2d/snap/snap_2d_transforms_to_pixel` | `On` |
| `rendering/2d/snap/snap_2d_vertices_to_pixel` | `On` |

#### Input Map

Define these actions in `Input Map` tab (see `design/ux-flow.md` Section 3.3 for full mapping):

```
move_up, move_down, move_left, move_right
shoot, laser, special
pause
ui_accept, ui_cancel, ui_up, ui_down, ui_left, ui_right
```

#### Physics

| Setting | Value |
|---------|-------|
| `physics/common/physics_ticks_per_second` | `60` |
| `physics/2d/physics_engine` | `GodotPhysics2D` |

---

## 4. GUT Test Framework Setup

### 4.1 Installation

GUT (Godot Unit Testing) is the project's test framework. Install it via the Godot Asset Library:

1. In Godot, open the **AssetLib** tab.
2. Search for **"GUT"** (Godot Unit Testing).
3. Select the GUT plugin by **bitwes**.
4. Click **Download**.
5. After download, click **Install** and select all files.
6. Enable the plugin: **Project > Project Settings > Plugins > GUT > Enable**.

**Alternative (manual install)**:
```bash
# Clone GUT into the project's addons directory
cd addons/
git clone https://github.com/bitwes/Gut.git gut
```

### 4.2 GUT Configuration

Create or verify `.gutconfig.json` in the project root:

```json
{
  "dirs": ["res://tests/"],
  "should_exit": true,
  "ignore_pause": true,
  "log_level": 1,
  "disable_colors": false,
  "prefix": "test_",
  "suffix": ".gd"
}
```

### 4.3 Running Tests

**From the Godot Editor**:
1. Open the GUT panel (bottom dock, after enabling the plugin).
2. Click **Run All**.

**From the Command Line** (CI-compatible):
```bash
# Windows
C:\Tools\Godot\Godot_v4.6.2-stable_win64.exe --headless -s addons/gut/gut_cmdln.gd -gconfig=.gutconfig.json

# macOS
/Applications/Godot.app/Contents/MacOS/Godot --headless -s addons/gut/gut_cmdln.gd -gconfig=.gutconfig.json

# Linux
godot --headless -s addons/gut/gut_cmdln.gd -gconfig=.gutconfig.json
```

### 4.4 Required Test Coverage

Per the technical preferences, GUT must cover at minimum:

- Collision detection
- Damage calculation
- Scoring
- Upgrade application
- Combo counter logic
- Weapon state transitions
- Boss phase management

---

## 5. Editor Setup

### 5.1 Godot Editor Configuration

Recommended editor settings for Neon Strikers development:

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Editor > Text Editor > Behavior > Indent Type** | Tabs | GDScript standard |
| **Editor > Text Editor > Behavior > Indent Size** | 4 | GDScript standard |
| **Editor > Text Editor > Appearance > Show Line Numbers** | On | Ease of code review |
| **Editor > Text Editor > Completion > Use Thread** | On | Responsive autocomplete |
| **Editor > FileSystem > Directories > Autoscan Project Path** | On | Automatic file system updates |
| **Debug > Auto Switch to Remote Scene Tree** | On | Convenient for runtime debugging |

### 5.2 External Editor (Optional)

If you prefer VS Code:
1. Install the [godot-tools](https://marketplace.visualstudio.com/items?itemName=geequlim.godot-tools) extension.
2. In Godot: **Editor > Editor Settings > Text Editor > External > Use External Editor > On**.
3. Set **Exec Path** to your VS Code executable.
4. Set **Exec Flags** to `--goto {file}:{line}`.

### 5.3 Asset Import Settings

All sprite assets must use these import defaults (per the Art Bible, Section 10.1):

| Setting | Value |
|---------|-------|
| Filter | Off (nearest-neighbor) |
| Mipmaps | Off |
| Compress | VRAM Compressed (> 64x64 px) |
| sRGB | On |

---

## 6. First Run Checklist

After completing setup, verify everything works:

### 6.1 Editor Launch

- [ ] Godot 4.6.2 opens without errors.
- [ ] The Neon Strikers project appears in the Project Manager.
- [ ] The project opens to the main editor view.
- [ ] The **gl_compatibility** renderer is active (check top-right corner of editor).
- [ ] FileSystem dock shows the correct directory structure.

### 6.2 Project Settings

- [ ] Viewport is 480x720.
- [ ] Input Map contains all required actions (Section 3.4).
- [ ] GUT plugin is enabled (check Project Settings > Plugins).

### 6.3 Test Suite

- [ ] GUT panel is visible in the editor.
- [ ] Running `Run All` executes tests (even if there are no tests yet -- it should not error).
- [ ] Command-line test invocation works: `godot --headless -s addons/gut/gut_cmdln.gd`

### 6.4 Git Hooks

- [ ] `git --version` returns 2.40+.
- [ ] `jq --version` returns a version number (if installed).
- [ ] `python3 --version` or `python --version` returns Python 3.x (if installed).
- [ ] Commit hooks fire on `git commit` (verify by making a test commit to a feature branch).

### 6.5 Claude Code

- [ ] `claude --version` returns a version number.
- [ ] From the project root, `claude` starts in the correct context.
- [ ] Slash commands are available (try `/help`).

---

## 7. Common Issues & Troubleshooting

### Godot won't start / crashes on launch

- **Windows**: Ensure your GPU drivers are up to date. If using an older integrated GPU, try adding `--rendering-driver opengl3` to force OpenGL.
- **macOS**: First launch requires right-click > Open to bypass Gatekeeper.
- **Linux**: Ensure `libstdc++6`, `libc6`, and graphics drivers are installed.

### Project fails to import

- Delete the `.godot/` directory in the project root and re-open the project. This forces a fresh import.
- Check that `project.godot` exists and is valid JSON.

### GUT not showing in the editor

- Verify GUT files are in `res://addons/gut/`.
- Check **Project > Project Settings > Plugins** -- GUT must be **Enabled**.
- Restart the Godot editor after enabling the plugin.

### Renderer mismatch warnings

- The project uses `gl_compatibility`. Do NOT switch to `forward_plus` or `mobile`.
- If you see Vulkan-related errors, verify `rendering/renderer/rendering_method` is `gl_compatibility`.

### What Happens Without Optional Tools

| Missing Tool | Effect |
|--------------|--------|
| **jq** | Commit validation, push protection, asset validation, and agent audit hooks silently skip their checks. Commits and pushes still work. |
| **Python 3** | JSON data file validation in commit and asset hooks is skipped. Invalid JSON can be committed without warning. |
| **Both** | All hooks still execute without error (exit 0) but provide no validation. You are flying without safety nets. |

---

## 8. Quick Reference

### Useful Godot CLI Commands

```bash
# Run the project (editor must not be open)
godot --path /path/to/project

# Run headless (no window -- for CI/server)
godot --headless --path /path/to/project

# Run a specific scene
godot --path /path/to/project res://src/ui/title_screen.tscn

# Run the editor
godot --editor --path /path/to/project

# Run GUT tests
godot --headless -s addons/gut/gut_cmdln.gd -gconfig=.gutconfig.json --path /path/to/project

# Export a build
godot --headless --export-release "Windows Desktop" /path/to/output.exe --path /path/to/project
```

### Useful Git Commands

```bash
# Create a feature branch
git checkout -b feature/my-feature develop

# Run hooks manually
bash .claude/hooks/commit-msg.sh

# Verify hook configuration
cat .claude/settings.json
```
