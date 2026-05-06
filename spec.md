# Cozy Top-Down Roguelite Prototype


Build a self-contained top-down action roguelite. Single project, runnable locally via VS Code.


## Project Layout (strict)
```
project_root/
├── src/
│   └── server.py
├── static/
│   ├── index.html
│   ├── style.css
│   └── js/
│       ├── main.js          (game loop, root state)
│       ├── world.js         (procedural generation, tiles)
│       ├── player.js        (player state, movement, combat)
│       ├── enemies.js       (enemy AI, traits, spawning)
│       ├── items.js         (item generation, affixes, drops, swap UI)
│       ├── ui.js            (HUD, tooltips, game over overlay)
│       ├── render.js        (camera, draw helpers)
│       └── input.js         (keyboard + mouse handling)
└── requirements.txt         (fastapi, uvicorn)
```


## Server (`src/server.py`)
- 
**FastAPI**
 + 
**uvicorn**
, started directly via `python src/server.py`
- Uses `argparse` with:
  - `--port` (int, default `8000`)
  - `--host` (str, default `127.0.0.1`)
- Locates the static folder via `Path(__file__).resolve().parent.parent / "static"` so it works regardless of `cwd`
- `GET /` returns `static/index.html`
- `GET /static/...` serves all assets via `StaticFiles` mount
- Calls `uvicorn.run(app, host=args.host, port=args.port)` at the bottom of the file
- Compatible with the following VS Code launch config (which passes `--port 8088`):
```json
  {
    "name": "server",
    "type": "python",
    "request": "launch",
    "program": "${workspaceFolder}/src/server.py",
    "console": "integratedTerminal",
    "cwd": "${workspaceFolder}",
    "args": ["--port", "8088"]
  }
```
- `requirements.txt`: `fastapi` and `uvicorn[standard]`


## Frontend Tech (strict)
- 
**Vanilla HTML5 Canvas + ES modules + CSS**
. No frameworks, no bundler, no build step, no external runtime libraries
- All visuals drawn via Canvas 2D API. 
**No external image, font, or audio assets.**
 Audio is out of scope
- No globals beyond a single `game` state object exported from `main.js`


## Viewport & Camera
- Canvas fills the entire browser viewport: no margins, no padding, no scrollbars, no borders. CSS resets `body { margin: 0; overflow: hidden; }`
- Listens to `resize` and updates canvas resolution via `devicePixelRatio` for crisp rendering
- Camera follows the player smoothly (lerp factor `0.12` per frame at 60 FPS)
- 
**Camera clamps to world bounds**
 so the player never sees void outside the map
- Game pauses when `document.visibilityState !== "visible"` and resumes on return
- Game loop uses `requestAnimationFrame` with a deltaTime 
**clamped to 50ms max**
 to survive tab switches and breakpoints


## World Generation
- Tile-based grid, 
**120 × 90 tiles, 32 px per tile**
- Generated fresh on every run using 
**simplex/perlin noise OR cellular automata**
 (pick one, document choice)
- Tile types:
  - `grass` (walkable)
  - `path` / `clearing` (walkable, lighter tone — forms organic open areas)
  - `flower` / `decoration` (walkable, visual only, scattered procedurally)
  - `tree` / `rock` (blocks movement and sword hitboxes)
  - `water` (blocks movement, does not block hitboxes)
- 
**World perimeter is solid**
 (trees/rocks form a natural border) — player can never leave the map
- Player 
**spawn point**
: a clearing near map center, with a guaranteed 6-tile-radius open area and 
**no enemy within 12 tiles**
- Spawn 
**8–15 enemies**
 scattered across the map, biased away from the spawn area
- Place 
**3–5 starting item drops**
 as ground pickups around the map


## Player
- Starts every run with:
  - 
**3 hearts (= 6 half-hearts of HP)**
, max HP fixed at 6 half-hearts
  - 
**Default sword**
: damage `1.0`, range `40`, attack cooldown `350ms`, pushback `100`, crit `0%`, lifesteal `0%`
  - 
**Default shield**
: block arc `90°`, max stamina `100`, stamina regen `25/s`, no on-block effect, post-break cooldown `2.5s`
- Player has 
**exactly one sword slot and one shield slot**
. No inventory beyond that. Equipment cannot be lost, only swapped
- Base movement speed: `200 px/s`. Player collision radius: `12 px`
- Damage taken from any source quantizes to 
**0.5-heart increments**
 (round to nearest 0.5)
- After taking damage: 
**800ms i-frames**
 (no further damage), brief red sprite tint, small knockback (`80` impulse) away from damage source
- Player cannot be knocked into solid tiles (position clamps against collision)


## Controls
| Input | Action |
|---|---|
| `WASD` | 8-directional movement |
| Mouse position | aim direction — player faces cursor; sword and shield orient toward cursor |
| Left Mouse Button | sword attack — hitbox extends in 
**aim direction**
 (mouse), respects sword `range` and arc (~90° in front), cooldown = sword's `attack speed` |
| Right Mouse Button (hold) | raise shield — drains stamina (`30/s` while raised), blocks damage from a frontal arc centered on aim direction |
| `Shift` | dash — `120 px` over `180ms` with full i-frames, cooldown `600ms`. 
**Direction**
: WASD direction if any movement key is held, otherwise aim direction. Dash is independent of stamina |


- Mouse cursor is 
**hidden over the canvas**
; a soft circular reticle is drawn at the mouse position instead


## Shield Mechanics
- Stamina drains while RMB held; regenerates only when RMB is released
- If stamina hits `0`, shield 
**breaks**
: it cannot be raised for `post-break cooldown` seconds, indicated by the stamina bar going gray and the shield icon shaking briefly
- A blocked hit triggers the shield's 
**on-block effect**
 (if any) at the rolled `proc chance`
- Damage outside the block arc applies normally even while RMB is held


## Combat Feel
- Enemy hit by sword: `120ms` hitstun (no movement, no attack), pushback applied based on sword's `pushback` stat, brief white flash
- Enemy pushback clamps against solid tiles (no clipping)
- Crit hits: visible enlarged damage feedback (e.g., bigger hit-particle puff), 2× damage
- Lifesteal: on proc, brief green sparkle on player, +0.5 heart healed (capped at max HP)
- Slow effect: target tinted blue, speed × 0.5 for duration. Re-applying refreshes duration, does not stack
- Paralyze effect: target frozen in place, tinted pale yellow, cannot attack or move
- Reflect effect: portion of incoming damage applied to attacker, quantized to 0.5 hearts (minimum 0.5 if reflect would round to 0)


## Enemies — Procedural Variance
Each enemy is generated with randomized stats and traits at spawn:


| Trait | Range / Options |
|---|---|
| Speed | `40–140 px/s` |
| Contact damage | `0.5 – 1.5` hearts (quantized to 0.5) |
| HP | `1 – 4` (integer) |
| Aggression radius | `80 – 280 px` (distance-based, no line-of-sight check) |
| Leap-attack chance | `0 – 80%` per attack opportunity. Telegraphed: `300ms` windup with visible pose shift, then dash `+200% speed` toward player's current position for `200ms`, then `600ms` recovery |
| Shield reaction | `cautious` (stops attacking, circles at distance) / `aggressive` (attacks regardless) / `flanker` (tries to reach player from outside block arc) |
| Low-HP behavior (`<30%` HP) | `flee` (runs from player) / `kamikaze` (charges, +50% speed, double contact damage, glowing red tint) / `stand` (no change) |


- 
**Engagement state**
: an enemy enters "engaged" when player enters its aggression radius. It stays engaged until the player has been 
**outside the radius for 4 seconds**
, then returns to idle wandering
- Render enemies with 
**distinct shapes/colors that hint at traits**
:
  - Fast (>110 px/s) → elongated/streamlined silhouette
  - High damage (>1.0) → bulkier silhouette, warmer accent color
  - Cautious shield reaction → hunched posture
  - Kamikaze low-HP behavior → reveals red glow once triggered
- Show a small HP bar above an enemy only 
**once it has been hit at least once**
- Enemies cannot damage each other and don't collide with each other (avoids gridlock)


## Drops on Enemy Death
On every enemy death, roll 
**one**
 drop from this table:


| Roll | Drop |
|---|---|
| 12% | half-heart pickup |
| 35% | item (50% sword / 50% shield, with rolled affixes) |
| 53% | nothing |


- 
**Half-heart pickups**
 are auto-collected when the player walks within `20 px`. They heal `0.5` heart, capped at max HP. If at full HP, the pickup still vanishes (no excess healing)
- 
**Item drops**
 require hover + click (see swap UI below) and never auto-collect
- All ground items (hearts, swords, shields) gently bob via sine wave (~`2px` amplitude, `1.2s` period)


## Item Affixes


**Swords**
 roll 
**2–3**
 affixes from this table:
| Affix | Range |
|---|---|
| Damage | `0.5 – 2.5` hearts (0.5 steps) |
| Range | `24 – 72 px` |
| Attack speed | cooldown `200 – 600 ms` |
| Pushback | `0 – 400` impulse |
| Crit chance | `0 – 25%` (deals 2× damage) |
| Lifesteal | `0 – 15%` chance to heal 0.5 heart on hit |


**Shields**
 roll 
**2–3**
 affixes from this table:
| Affix | Range |
|---|---|
| Block arc | `60° – 180°` |
| Max stamina | `60 – 150` |
| Stamina regen | `15 – 45 / s` |
| On-block effect | one of: `paralyze 0.8s` / `slow 50% for 2s` / `reflect 25% damage` / `knockback 200` / `+20% player speed for 1.5s` |
| Effect proc chance | `25 – 100%` |
| Post-break cooldown | `1.5 – 4 s` |


- Affixes not rolled use the 
**default-equipment baseline value**
 for that stat
- Affix values are sampled uniformly within the range, rounded to sensible precision (1 decimal for hearts, integers for px/ms/percent)
- Each item is given a generated descriptor name from a cozy word pool (e.g., adjectives: "Mossy", "Sunlit", "Dappled", "Warden's", "Hearthstone"; nouns: "Shortblade", "Bough", "Bulwark", "Ward", "Thorn"). Format: `<adjective> <noun>`


## Item Comparison & Swap UI
- Walking within `~50 px` of a ground item shows a soft floating prompt: 
*"hover to compare"*
- 
**Hovering a ground item with the mouse**
 opens a side-by-side tooltip near the cursor:
  - Header: item type icon + generated name
  - Two columns: 
**left = ground item**
, 
**right = currently equipped item of the same type**
  - For each stat, a comparison indicator: green ▲ (ground better), red ▼ (ground worse), gray — (equal)
  - "Better" depends on stat type: higher is better for damage, range, crit, etc.; lower is better for cooldowns and post-break duration
- 
**Click while hovering**
 swaps: the previously equipped item drops at the pickup's position, the ground item becomes equipped. The same hover-compare workflow then applies to the newly dropped item
- Tooltip closes when the mouse leaves the item or the item is picked up
- 
**Player always has both a sword and a shield equipped**
 — the swap is a 1-for-1 exchange of the same type. There is no "empty slot" state


## HUD
- 
**Top-left**
: hearts row (full / half / empty pixel-style sprites drawn on canvas)
- 
**Below hearts**
: stamina bar (~120px wide), grays out during shield-broken cooldown
- 
**Bottom-left, subtle**
: equipped sword name + equipped shield name in small text
- 
**Bottom-right, subtle**
: enemy kill counter for current run
- All HUD text uses a 
**consistent in-game font**
 (single CSS-defined font-family, e.g. `system-ui` rounded sans-serif, font-size 14–16px)


## Game Over & Restart
- When player HP reaches 0:
  - Player sprite fades over `600ms`
  - Soft full-screen overlay fades in with the text 
*"you fell asleep…"*
 in serif italic
  - After `400ms` minimum delay (prevents accidental click-through), any key or mouse click triggers restart
- 
**Restart resets fully**
: new procedural world, fresh enemy spawns, fresh ground items, player back to 3 hearts, equipment back to default sword + default shield, kill counter to 0


## Art Direction: Cozy
- 
**Palette**
: warm, muted, low-contrast. Soft greens, dusty pinks, cream, warm browns, gentle blues. 
**No pure black, no harsh contrast, no saturated red except for danger cues**
 (low-HP kamikaze glow, damage flash)
- 
**Shape language**
: rounded silhouettes throughout. Either committed pixel-art (rounded edges) or clean rounded vector shapes. 
**Pick one approach and apply it consistently**
 to player, enemies, items, and tiles
- Subtle elliptical drop-shadow under player and enemies (semi-transparent dark blur)
- Idle "breathing" bob on player and stationary enemies (sine wave, ~1px amplitude, ~1.5s period)
- Tile variation: small per-tile color jitter; flowers/grass tufts/pebbles drawn procedurally on grass tiles for warmth
- Hit effects: small puff of leaves, petals, or sparkles — 
**never blood**
- Ambient touches encouraged: drifting clouds (translucent shapes overhead), swaying grass, the occasional firefly
- Reticle: soft pale circle, ~10px radius, semi-transparent


## Code Quality Requirements
- Modular ES modules, one concern per file as outlined above
- Single shared `game` state object owned by `main.js`; modules receive references, not globals
- Game loop at `requestAnimationFrame` with 
**fixed-timestep update at 60 FPS**
 (accumulator pattern) and interpolated render
- Comment non-obvious logic: noise generation, enemy trait rolls, affix tables, knockback math
- No `console.error` or uncaught exceptions during normal play
- No use of `eval`, `with`, or `innerHTML` for dynamic content (use DOM APIs)


## Definition of Done
1. `pip install -r requirements.txt` works
2. VS Code "server" launch config starts the server on port `8088` with no errors
3. `python src/server.py` (no args) starts on port `8000`
4. Visiting `http://localhost:<port>` immediately drops the player into a fresh procedural world — no menu, no loading screen
5. All controls work: WASD movement, mouse aim, LMB attack, RMB shield with stamina, Shift dash with i-frames
6. Enemies show 
**at least 3 visibly distinct behavioral "feels"**
 that emerge from random trait rolls
7. Drops table works: hearts auto-collect, items hover-compare and click-swap correctly
8. Cozy aesthetic is unmistakable on first glance — palette, shapes, particles all coherent
9. Tab-switch / window-blur pauses the game cleanly
10. Death → overlay → restart cycle works and fully resets state
11. Smooth 60 FPS on a modern laptop with 15 enemies on screen, no console errors


Build the entire thing now.
