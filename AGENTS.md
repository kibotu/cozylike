# AGENTS.md

## Run

```bash
./run.sh --port 8000        # idempotent: creates .venv, installs deps, starts server
uv run src/server.py --port 8000  # same, but assumes .venv already exists
```

Server serves `static/` at `http://127.0.0.1:8000/`. No build step, no test framework.

## Architecture

FastAPI server serves a vanilla JS game (no bundler, no framework) via ES modules. The browser handles ESM imports directly.

## File structure

```
src/server.py          — FastAPI app; serves index.html at /, static/ at /static/
static/index.html      — single <canvas> + `<script type="module" src="/static/js/main.js">`
static/style.css       — full-screen canvas reset
static/js/main.js      — game loop, root state, module wiring
static/js/input.js     — WASD, mouse, Shift/Space tracking
static/js/world.js     — cellular automata generation, tile helpers
static/js/player.js    — movement, combat, shield, dash
static/js/enemies.js   — enemy AI, traits, spawning
static/js/items.js     — ground pickups, swap, affix generation
static/js/render.js    — camera, tile/enemy/player/item rendering
static/js/ui.js        — HUD, tooltips, game over
```

## Module wiring

- `main.js` owns a single shared `game` state object. All modules receive references — **never** access globals.
- `world.js` exports `getGrid()`. The grid is set once via `setGrid(grid)` after generation.
- `enemies.js` exports `rollSword()` / `rollShield()` which `items.js` re-exports via `rollSwordItem` / `rollShieldItem`.
- `ui.js` imports `getItemComparisonStats` from `items.js`. No other cross-module imports.
- **No other cross-module imports exist.** If you add one, verify it doesn't create circular dependencies.

## Game loop

- `requestAnimationFrame` in `main.js` with fixed 60 FPS timestep via accumulator (`MAX_DT = 50` ms caps frame delta).
- DPR-aware canvas: `canvas.width = window.innerWidth * devicePixelRatio`, context scaled via `ctx.scale(dpr, dpr)`.
- `visibilitychange` resets `lastTime` and `accumulator` to prevent dt spiral on tab-switch.

## Live gotchas

### `blocksHitbox()` reads module-scoped `grid` directly (world.js:315)

```js
const tile = grid[ty * WORLD_W + tx];  // should be: getGrid()[ty * WORLD_W + tx]
```

All other world accessors use `getGrid()`. This will fail if called before `setGrid()` or if the module-scoped `grid` is replaced.

### `isWalkable()` returns `true` on out-of-bounds (world.js:302)

```js
if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return true;
```

Should return `false`. Currently harmless because the perimeter is hardcoded to `TREE` tiles.

### `blocksHitbox()` vs `isSolid()` duplicate

They do the same thing. `isSolid()` is the only exported function used externally. `blocksHitbox()` is dead code.

### `applyEffectToEnemy()` in main.js duplicates `applyShieldEffect()` in enemies.js

`main.js:237` mutates `game.player` directly; `enemies.js:368` is not imported anywhere. One should be removed.

### `TILE_SIZE` is hardcoded 3 times in `player.js`

Lines 38, 213, 273 declare `const TILE_SIZE = 32` inside functions, shadowing the imported value from `world.js`. Remove the local declarations and use the import.

## Server quirks

- The `/` route **must** use `HTMLResponse(content=f.read())` — returning a raw string makes FastAPI serve `application/json`, preventing HTML/JS execution.
- Server is invoked via `uvicorn.run()` inside `main()` (argparse-driven), not CLI. Entry point: `server:app`.

## Debugging

- Game state exposed as `window.game` in browser console.
- No error boundaries — a JS error crashes the game loop. Check browser console.
- All rendering goes through `render.js`. If something isn't visible, check camera position and canvas dimensions.
