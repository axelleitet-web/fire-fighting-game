// ============================================================
// FIRE SYSTEM
// ============================================================

// 8-neighbor offsets
const NEIGHBORS = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];

function fireUpdate(map, wind) {
  // Use a change list so we don't double-process within one tick
  const changes = []; // { x, y, deltaIntensity, setBurned }

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const tile = map[y][x];
      if (tile.fireIntensity <= 0 || tile.burned) continue;

      // Grow intensity
      if (tile.fireIntensity < FIRE_MAX && Math.random() < FIRE_GROW * wind.str) {
        changes.push({ x, y, deltaIntensity: 1 });
      }

      // Advance burn time; extinguish when exhausted
      tile.burnTime++;
      if (tile.burnTime >= BURN_OUT) {
        changes.push({ x, y, setBurned: true });
        continue;
      }

      // Spread to neighbors
      const wv = W_VEC[wind.dir];
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
        const neighbor = map[ny][nx];
        if (neighbor.fireIntensity > 0 || neighbor.burned || neighbor.firebreak) continue;
        if (T_FLAM[neighbor.type] === 0) continue;

        // Dot product of spread vector with wind vector (both unit-ish)
        const dot = dx * wv[0] + dy * wv[1];
        // dot ranges from -2 (diagonal against) to 2 (diagonal with)
        const norm = Math.sqrt(dx*dx + dy*dy);
        const alignment = dot / norm; // -1.4 to +1.4 for diagonals

        let chance = FIRE_BASE * T_FLAM[neighbor.type] * (tile.fireIntensity / FIRE_MAX);

        if (alignment > 0) {
          // Downwind: wind greatly amplifies
          chance *= 1 + alignment * W_SPREAD_MULT[wind.str];
        } else {
          // Upwind: wind suppresses
          chance *= Math.max(0.05, 1 + alignment * 0.6);
        }

        if (Math.random() < chance) {
          changes.push({ x: nx, y: ny, deltaIntensity: 1 });
        }
      }
    }
  }

  // Apply changes (deduplicate: only first change per tile)
  const seen = new Set();
  for (const ch of changes) {
    const key = ch.y * GRID + ch.x;
    if (seen.has(key)) continue;
    seen.add(key);
    const tile = map[ch.y][ch.x];
    if (ch.setBurned) {
      tile.burned = true;
      tile.fireIntensity = 0;
      tile.burnTime = 0;
    } else if (ch.deltaIntensity) {
      tile.fireIntensity = Math.min(FIRE_MAX, tile.fireIntensity + ch.deltaIntensity);
    }
  }
}

// Suppress fire at tile (x,y) by `amount` intensity
function fireSuppressAt(map, x, y, amount) {
  const tile = tileAt(map, x, y);
  if (!tile || tile.burned) return;
  tile.fireIntensity = Math.max(0, tile.fireIntensity - amount);
  if (tile.fireIntensity === 0) tile.burnTime = 0;
}

// Water drop: helicopter drops on center + reduces neighbors slightly
function fireHeliDrop(map, x, y, intensityReduction) {
  fireSuppressAt(map, x, y, intensityReduction);
  for (const [dx, dy] of NEIGHBORS) {
    fireSuppressAt(map, x + dx, y + dy, intensityReduction * 0.45);
  }
}

// Plane run: drops a water line perpendicular to wind at (startX,startY).
// planeLine: number of tiles to cover (pass upgrade-adjusted value)
function firePlaneRun(map, startX, startY, wind, planeLine) {
  planeLine = planeLine || PLANE_LINE;
  const wv = W_VEC[wind.dir];
  const perpDx = -wv[1], perpDy = wv[0]; // 90° rotation = perpendicular
  const half = Math.floor(planeLine / 2);
  for (let i = -half; i <= half; i++) {
    const tx = Math.round(startX + perpDx * i);
    const ty = Math.round(startY + perpDy * i);
    fireSuppressAt(map, tx, ty, 4);
    fireSuppressAt(map, tx + wv[0], ty + wv[1], 2);
  }
}

// Compute danger zones: tiles downwind of active fires (3-tile reach)
function getDangerZones(map, wind) {
  const zones = new Set();
  const wv = W_VEC[wind.dir];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (map[y][x].fireIntensity < 2) continue;
      for (let dist = 1; dist <= 3; dist++) {
        const nx = Math.round(x + wv[0] * dist);
        const ny = Math.round(y + wv[1] * dist);
        if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID) {
          zones.add(ny * GRID + nx);
        }
      }
    }
  }
  return zones;
}
