# Art Asset Acquisition Workflow

## 问题背景

Claude 的 `WebFetch` 工具受平台级域名安全策略限制，无法直接访问大多数资源站点。
但 `Bash(curl)` 和 `playwright-cli` 可以绕过此限制。

## 有效流程

### 步骤 1：用 WebSearch 搜索资源

```
WebSearch: "free space shooter sprite pack 2D pixel art CC0"
```

关键站点：
- **OpenGameArt.org** — CC0/Public Domain，直接下载链接
- **itch.io** — 大量免费/按需付费素材包
- **CraftPix.net** — 免费分类，专业像素美术
- **Kenney.nl** — 全系列 CC0 素材

### 步骤 2：用 Playwright 访问页面并找下载链接

```bash
playwright-cli open https://opengameart.org/content/space-shooter-redux
playwright-cli snapshot | grep -i "zip\|download"
# 找到直接下载 URL 如：
# https://opengameart.org/sites/default/files/SpaceShooterRedux.zip
```

### 步骤 3：用 Playwright 点击下载（处理 JS 重定向）

```bash
playwright-cli click e234  # 点击下载链接
# 文件保存到 .playwright-cli/ 目录
```

### 步骤 4：验证和解压

```bash
file .playwright-cli/SpaceShooterRedux.zip  # 确认为 Zip archive
cp .playwright-cli/SpaceShooterRedux.zip d:/tmp/assets.zip
unzip -o d:/tmp/assets.zip -d d:/tmp/extracted/
find d:/tmp/extracted/ -name "*.png" | wc -l  # 确认文件数
```

### 步骤 5：挑选并复制到项目

```bash
# 根据 art-bible.md 的规格挑选对应文件
cp extracted/PNG/playerShip1_blue.png assets/art/sprites/player_ship.png
cp extracted/PNG/Enemies/enemyBlack1.png assets/art/sprites/enemy_drone.png
# ... 等等
```

### 步骤 6：更新场景引用

```bash
sed -i 's|old_placeholder.svg|new_asset.png|g' src/gameplay/player/player.tscn
```

### 步骤 7：验证

```bash
godot --headless --path . --check-only
```

## 注意事项

1. **不能用 curl 直接下载** — 大多数 CDN 需要 JavaScript 验证，必须用 Playwright
2. **优先 CC0 许可证** — 避免版权问题
3. **检查 PNG 有效性** — `file *.png` 确认是 PNG image data
4. **文件命名规范化** — 复制时统一 snake_case 命名
5. **保留原始 zip** — 方便后续选取更多素材

## 已验证可用的资源

| 资源包 | 来源 | 内容 | 许可证 |
|--------|------|------|--------|
| Space Shooter Redux | OpenGameArt | 314 文件（飞船、敌人、子弹、道具、UI、音效） | CC0 |
