/**
 * world.js — Procedural world generation using cellular automata.
 *
 * Strategy: Generate a noise-based initial map, then apply 4 rounds of
 * cellular automata smoothing to create organic cave-like structures.
 * This produces natural-looking terrain with clear paths, clearings,
 * and solid barriers (trees/rocks).
 *
 * Tile types:
 *   grass  — walkable, base terrain
 *   path   — walkable, lighter tone, forms open areas
 *   flower — walkable, visual only
 *   tree   — blocks movement and sword hitboxes
 *   rock   — blocks movement and sword hitboxes
 *   water  — blocks movement, does not block hitboxes
 */

export const TILE_SIZE = 32;
export const WORLD_W = 120;
export const WORLD_H = 90;

// Tile type constants
export const TILE = {
  GRASS: "grass",
  PATH: "path",
  FLOWER: "flower",
  TREE: "tree",
  ROCK: "rock",
  WATER: "water",
};

// Walkable tile types
const WALKABLE = new Set([TILE.GRASS, TILE.PATH, TILE.FLOWER]);

// Tile colors (cozy palette)
const TILE_COLORS = {
  [TILE.GRASS]: "#5a7a4a",
  [TILE.PATH]: "#8a9a6a",
  [TILE.FLOWER]: "#5a7a4a",
  [TILE.TREE]: "#3a5a2a",
  [TILE.ROCK]: "#6a6a6a",
  [TILE.WATER]: "#4a6a8a",
};

/**
 * Simple value noise — fast, good enough for this purpose.
 * Uses a hash grid with bilinear interpolation.
 */
class ValueNoise {
  constructor(seed) {
    this.seed = seed;
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates shuffle with seed
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 5) % 2147483647;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  _hash(x, y) {
    const n = this.perm[(this.perm[(x & 255) + (y & 255)] + ((y >> 8) & 255)) & 255];
    return (n * 257 + 11) / 258; // [0, 1)
  }

  _lerp(a, b, t) {
    const st = t * (2 - 2 * t); // smoothstep
    return a + (b - a) * st;
  }

  sample(x, y) {
    const ix = x | 0, iy = y | 0;
    const fx = x - ix, fy = y - iy;
    const v00 = this._hash(ix, iy);
    const v10 = this._hash(ix + 1, iy);
    const v01 = this._hash(ix, iy + 1);
    const v11 = this._hash(ix + 1, iy + 1);
    return this._lerp(this._lerp(v00, v10, fx), this._lerp(v01, v11, fx), fy);
  }

  // Octave noise for more natural variation
  fbm(x, y, octaves) {
    let val = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      val += this.sample(x * freq, y * freq) * amp;
      max += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return val / max;
  }
}

/**
 * Returns the world dimensions.
 */
export function getWorldSize() {
  return { w: WORLD_W, h: WORLD_H };
}

/**
 * Returns tile size in pixels.
 */
export function getTileSize() {
  return TILE_SIZE;
}

/**
 * Generates a fresh world grid and places spawn point, enemies, and items.
 *
 * @returns {{ grid: string[], spawnX: number, spawnY: number }}
 *   grid — flat array of tile type strings (w * h)
 *   spawnX, spawnY — tile coordinates for player spawn
 */
export function generateWorld() {
  const seed = Math.floor(Math.random() * 100000);
  const noise = new ValueNoise(seed);

  // Generate raw map values
  const raw = new Float64Array(WORLD_W * WORLD_H);
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      // Base noise at multiple frequencies
      let v = noise.fbm(x / 20, y / 20, 4);
      // Add some fine detail
      v += noise.fbm(x / 8, y / 8, 2) * 0.3;
      raw[y * WORLD_W + x] = v;
    }
  }

  // Cellular automata smoothing (4 passes)
  let map = new Float64Array(raw);
  for (let pass = 0; pass < 4; pass++) {
    const next = new Float64Array(map);
    for (let y = 1; y < WORLD_H - 1; y++) {
      for (let x = 1; x < WORLD_W - 1; x++) {
        // Count solid neighbors (tree/rock/water)
        let solidCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const idx = (y + dy) * WORLD_W + (x + dx);
            const v = map[idx];
            if (v < 0.35) solidCount++; // solid threshold
          }
        }
        if (solidCount >= 5) {
          next[y * WORLD_W + x] = 0.2; // become solid
        } else if (solidCount <= 3) {
          next[y * WORLD_W + x] = 0.8; // become open
        }
        // Preserve edge
        if (x === 1 || y === 1 || x === WORLD_W - 2 || y === WORLD_H - 2) {
          next[y * WORLD_W + x] = 0.1;
        }
      }
    }
    map = next;
  }

  // Convert to tile types
  const grid = new Array(WORLD_W * WORLD_H);
  for (let i = 0; i < grid.length; i++) {
    const v = map[i];
    if (v < 0.35) {
      grid[i] = Math.random() < 0.6 ? TILE.TREE : TILE.ROCK;
    } else if (v < 0.45) {
      grid[i] = TILE.WATER;
    } else if (v < 0.6) {
      grid[i] = TILE.PATH;
    } else {
      grid[i] = TILE.GRASS;
    }
  }

  // Ensure perimeter is solid
  for (let x = 0; x < WORLD_W; x++) {
    grid[x] = TILE.TREE;
    grid[(WORLD_H - 1) * WORLD_W + x] = TILE.TREE;
  }
  for (let y = 0; y < WORLD_H; y++) {
    grid[y * WORLD_W] = TILE.TREE;
    grid[y * WORLD_W + WORLD_W - 1] = TILE.TREE;
  }

  // Find a good spawn area near center
  const cx = Math.floor(WORLD_W / 2);
  const cy = Math.floor(WORLD_H / 2);
  let spawnX = cx, spawnY = cy;
  let bestScore = -Infinity;

  for (let dy = -15; dy <= 15; dy++) {
    for (let dx = -15; dx <= 15; dx++) {
      const sx = cx + dx, sy = cy + dy;
      if (sx < 5 || sx >= WORLD_W - 5 || sy < 5 || sy >= WORLD_H - 5) continue;

      // Count walkable tiles in 6-tile radius
      let openCount = 0;
      for (let r = 0; r <= 6; r++) {
        for (let a = 0; a < Math.PI * 2; a += 0.3) {
          const px = Math.round(sx + Math.cos(a) * r);
          const py = Math.round(sy + Math.sin(a) * r);
          if (px < 0 || px >= WORLD_W || py < 0 || py >= WORLD_H) continue;
          if (WALKABLE.has(grid[py * WORLD_W + px])) openCount++;
        }
      }

      // Score: prefer open areas, penalize being too close to existing clearings
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      const score = openCount - distFromCenter * 0.5;
      if (score > bestScore) {
        bestScore = score;
        spawnX = sx;
        spawnY = sy;
      }
    }
  }

  // Create spawn clearing (6-tile radius)
  for (let r = 0; r <= 6; r++) {
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      const px = Math.round(spawnX + Math.cos(a) * r);
      const py = Math.round(spawnY + Math.sin(a) * r);
      if (px < 0 || px >= WORLD_W || py < 0 || py >= WORLD_H) continue;
      const idx = py * WORLD_W + px;
      if (grid[idx] === TILE.TREE || grid[idx] === TILE.ROCK || grid[idx] === TILE.WATER) {
        grid[idx] = TILE.PATH;
      }
    }
  }

  // Scatter flowers/decorations on grass tiles
  for (let y = 1; y < WORLD_H - 1; y++) {
    for (let x = 1; x < WORLD_W - 1; x++) {
      const idx = y * WORLD_W + x;
      if (grid[idx] === TILE.GRASS) {
        if (Math.random() < 0.15) {
          grid[idx] = TILE.FLOWER;
        }
      }
    }
  }

  // Ensure no enemies within 12 tiles of spawn
  const enemySpawnArea = [];
  for (let y = 10; y < WORLD_H - 10; y++) {
    for (let x = 10; x < WORLD_W - 10; x++) {
      const dist = Math.sqrt((x - spawnX) ** 2 + (y - spawnY) ** 2);
      if (dist >= 12 && WALKABLE.has(grid[y * WORLD_W + x])) {
        enemySpawnArea.push({ x, y });
      }
    }
  }

  // Sort by distance from spawn, preferring mid-range
  enemySpawnArea.sort((a, b) => {
    const da = Math.sqrt((a.x - spawnX) ** 2 + (a.y - spawnY) ** 2);
    const db = Math.sqrt((b.x - spawnX) ** 2 + (b.y - spawnY) ** 2);
    // Prefer 30-50 tile distance
    const sa = 1 / (1 + Math.abs(da - 40));
    const sb = 1 / (1 + Math.abs(db - 40));
    return sb - sa;
  });

  return { grid, spawnX, spawnY, enemySpawnArea };
}

/**
 * Returns the world pixel dimensions.
 */
export function getWorldPixelSize() {
  return {
    w: WORLD_W * TILE_SIZE,
    h: WORLD_H * TILE_SIZE,
  };
}

/**
 * Checks if a tile at pixel coordinates is solid.
 */
export function isSolid(px, py) {
  const tx = Math.floor(px / TILE_SIZE);
  const ty = Math.floor(py / TILE_SIZE);
  if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return true;
  const grid = getGrid();
  const tile = grid[ty * WORLD_W + tx];
  return tile === TILE.TREE || tile === TILE.ROCK;
}

/**
 * Checks if a tile is walkable (player can move onto it).
 */
export function isWalkable(px, py) {
  const tx = Math.floor(px / TILE_SIZE);
  const ty = Math.floor(py / TILE_SIZE);
  if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return true;
  const grid = getGrid();
  const tile = grid[ty * WORLD_W + tx];
  return WALKABLE.has(tile);
}

/**
 * Checks if a tile blocks sword hitboxes (trees and rocks only).
 */
export function blocksHitbox(px, py) {
  const tx = Math.floor(px / TILE_SIZE);
  const ty = Math.floor(py / TILE_SIZE);
  if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return true;
  const tile = grid[ty * WORLD_W + tx];
  return tile === TILE.TREE || tile === TILE.ROCK;
}

// Reference to the generated grid (set by main.js after generation)
let grid = null;

/**
 * Sets the world grid reference.
 */
export function setGrid(g) {
  grid = g;
}

/**
 * Returns the world tile grid.
 */
export function getGrid() {
  return grid;
}

/**
 * Returns tile type at pixel coordinates.
 */
export function getTileAt(px, py) {
  const tx = Math.floor(px / TILE_SIZE);
  const ty = Math.floor(py / TILE_SIZE);
  if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return TILE.TREE;
  const grid = getGrid();
  return grid[ty * WORLD_W + tx];
}
