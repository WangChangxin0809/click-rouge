# Sprite Asset Licenses

All sprites in this directory are free to use in commercial and non-commercial projects.
See specific license and attribution requirements below.

---

## CC0 (Public Domain) -- No Attribution Required

| File | Source | Author |
|------|--------|--------|
| `slime/plat_slime_spritesheet.png` | [2D Platformer Enemies](https://opengameart.org/content/2d-platformer-enemies) | ashuuya |
| `bat/plat_bat_spritesheet.png` | [2D Platformer Enemies](https://opengameart.org/content/2d-platformer-enemies) | ashuuya |
| `ghost/plat_ghost_spritesheet.png` | [2D Platformer Enemies](https://opengameart.org/content/2d-platformer-enemies) | ashuuya |
| `boss/skeleton_king_spritesheet.png` | [2D Platformer Enemies](https://opengameart.org/content/2d-platformer-enemies) | ashuuya |
| `slime/slime_bounce.png` | [Slime Bounce](https://opengameart.org/content/slime-bounce) | Zutar |
| `golem/golem_rock.png` | [Golems](https://opengameart.org/content/golems) | Zwonky / Ragewortt |
| `golem/fire_golem.png` | [Fire Golem](https://opengameart.org/content/fire-golem) | teasloth |
| `_extra_oga/platformer_baddies_CC0.png` | [Platformer Baddies](https://opengameart.org/content/platformer-baddies) | GrafxKid |
| `_builder_kit/kenney_monster/*` | [Kenney Monster Builder Pack](https://kenney.nl/assets/monster-builder-pack) | Kenney Vleugels |

## CC-BY 3.0 -- Attribution Required

| File | Source | Attribution |
|------|--------|-------------|
| `boss/dragons_spritesheet.png` | [RPG Enemies: 11 Dragons](https://opengameart.org/content/rpg-enemies-11-dragons) | Stephen "Redshrike" Challener, MrBeast, Surt, Blarumyrran, Sharm, Zabin |
| `boss/andromalius_boss.png` | [Bosses and Monsters (Ars Notoria)](https://opengameart.org/content/bosses-and-monsters-spritesheets-ars-notoria) | Stephen Challener (Redshrike), link to OpenGameArt.org |
| `boss/tentacles_boss.png` | [Bosses and Monsters (Ars Notoria)](https://opengameart.org/content/bosses-and-monsters-spritesheets-ars-notoria) | Stephen Challener (Redshrike), link to OpenGameArt.org |
| `fireskull/flameball.png` | [Bosses and Monsters (Ars Notoria)](https://opengameart.org/content/bosses-and-monsters-spritesheets-ars-notoria) | Stephen Challener (Redshrike), link to OpenGameArt.org |
| `fireskull/shadow-80x70.png` | [Bosses and Monsters (Ars Notoria)](https://opengameart.org/content/bosses-and-monsters-spritesheets-ars-notoria) | Stephen Challener (Redshrike), link to OpenGameArt.org |
| `_extra_oga/*` (acid2, minion, gnu, disciple, mage-*) | [Bosses and Monsters (Ars Notoria)](https://opengameart.org/content/bosses-and-monsters-spritesheets-ars-notoria) | Stephen Challener (Redshrike), link to OpenGameArt.org |
| `fireskull/mon2_sprite_base.png` | [Skull Monster Sprite Sheet](https://opengameart.org/content/skull-monster-sprite-sheet) | dogchicken |

## CC-BY 4.0 -- Attribution Required

| File | Source | Attribution |
|------|--------|-------------|
| `golem/golem_animations/*` | [Golem Animations](https://opengameart.org/content/golem-animations) | Cartoon-style golem by licensed artist |
| `golem/earth_golem_NES.png` | [Monsters Pack NES Palette Recolor](https://opengameart.org/content/monsters-pack-nes-palette-recolor) | ImogiaGames, based on Emerald's collection |

---

## Enemy-to-Sprite Mapping

| Game Enemy | Sprite File(s) | License |
|------------|---------------|---------|
| Slime (green blob) | `slime/plat_slime_spritesheet.png` | CC0 |
| Bat (purple flying) | `bat/plat_bat_spritesheet.png` | CC0 |
| Golem (rock giant) | `golem/golem_rock.png` (CC0), `golem/golem_animations/` (CC-BY 4.0) | CC0 / CC-BY |
| Ghost (white translucent) | `ghost/plat_ghost_spritesheet.png` | CC0 |
| Fire Skull (red/orange) | `fireskull/mon2_sprite_base.png`, `fireskull/flameball.png` | CC-BY 3.0 |
| Boss: Giant Slime | Scale up `slime/plat_slime_spritesheet.png` | CC0 |
| Boss: Skeleton King | `boss/skeleton_king_spritesheet.png` | CC0 |
| Boss: Fire Dragon | `boss/dragons_spritesheet.png` | CC-BY 3.0 |

## Missing / Programmatically Generated

The following enemy types do not have dedicated CC0 sprites found:
- **Fire Skull** -- No CC0 fire skull sprite found. Use `fireskull/mon2_sprite_base.png` (CC-BY 3.0 skull monster) and recolor in Canvas with red/orange tint, or draw programmatically. The `flameball.png` provides fire VFX.
- **Giant Slime Boss** -- No dedicated giant slime boss sprite found. Scale up `slime/plat_slime_spritesheet.png` (CC0) by 2-3x. The spritesheet has 4 animation frames.

All sprites can be tinted/recolored at runtime using Canvas 2D `globalCompositeOperation` or per-pixel manipulation.
