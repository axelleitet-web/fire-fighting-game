// ============================================================
// MAP GENERATION
// ============================================================

function makeLCG(seed) {
  let s = seed >>> 0;
  return function () {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function mapGenerate(contract) {
  const cfg = contract.mapConfig;
  const rng = makeLCG(contract.mapSeed);
  const tiles = [];

  // Fill base tiles
  for (let y = 0; y < GRID; y++) {
    tiles[y] = [];
    for (let x = 0; x < GRID; x++) {
      const r = rng();
      let type;
      if      (r < cfg.forestRatio)                          type = T.FOREST;
      else if (r < cfg.forestRatio + cfg.grassRatio)         type = T.GRASS;
      else if (r < cfg.forestRatio + cfg.grassRatio + cfg.rockRatio) type = T.ROCK;
      else                                                   type = T.GRASS;

      tiles[y][x] = makeTile(type);
    }
  }

  // Add water bodies (use copies to avoid mutating the contract definition)
  for (const wbOrig of cfg.waterBodies) {
    const wb = Object.assign({}, wbOrig);
    if (wb.type === 'river') {
      if (wb.axis === 'y') {
        // Vertical river at column `pos`
        for (let y = 0; y < GRID; y++) {
          for (let dx = 0; dx < wb.width; dx++) {
            const x = wb.pos + dx;
            if (x >= 0 && x < GRID) tiles[y][x] = makeTile(T.WATER);
          }
          // Meander a bit
          if (rng() < 0.2) wb.pos += rng() < 0.5 ? 1 : -1;
          wb.pos = Math.max(1, Math.min(GRID - wb.width - 1, wb.pos));
        }
      } else {
        // Horizontal river at row `pos`
        for (let x = 0; x < GRID; x++) {
          for (let dy = 0; dy < wb.width; dy++) {
            const y = wb.pos + dy;
            if (y >= 0 && y < GRID) tiles[y][x] = makeTile(T.WATER);
          }
          if (rng() < 0.2) wb.pos += rng() < 0.5 ? 1 : -1;
          wb.pos = Math.max(1, Math.min(GRID - wb.width - 1, wb.pos));
        }
      }
    } else if (wb.type === 'lake') {
      const { cx, cy, r } = wb;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) {
            const nx = cx + dx, ny = cy + dy;
            if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID) {
              tiles[ny][nx] = makeTile(T.WATER);
            }
          }
        }
      }
    }
  }

  // Place initial fires
  for (const [fx, fy] of cfg.fireStarts) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = fx + dx, ny = fy + dy;
        if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
        const tile = tiles[ny][nx];
        if (tile.type !== T.WATER && tile.type !== T.ROCK) {
          tile.fireIntensity = 3;
          tile.burnTime = 0;
        }
      }
    }
  }

  return tiles;
}

function makeTile(type) {
  return { type, fireIntensity: 0, burnTime: 0, burned: false, firebreak: false };
}

function tileAt(map, x, y) {
  if (x < 0 || x >= GRID || y < 0 || y >= GRID) return null;
  return map[y][x];
}

// Count all flammable tiles (non-water, non-rock)
function countFlammable(map) {
  let n = 0;
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const t = map[y][x].type;
      if (t !== T.WATER && t !== T.ROCK) n++;
    }
  return n;
}

// Count burned (charred) tiles
function countBurned(map) {
  let n = 0;
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++)
      if (map[y][x].burned) n++;
  return n;
}

// Count tiles with active fire
function countFire(map) {
  let n = 0;
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++)
      if (map[y][x].fireIntensity > 0) n++;
  return n;
}
