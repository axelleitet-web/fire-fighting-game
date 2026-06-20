// ============================================================
// UNITS SYSTEM — v2 (smooth movement, warning levels)
// ============================================================
let _ffIdSeq = 0;

function ffCreate(x, y) {
  const rx = x * TILE_PX + TILE_PX / 2;
  const ry = y * TILE_PX + TILE_PX / 2;
  return {
    id: _ffIdSeq++,
    x, y,
    hp: FF_HP_MAX, maxHp: FF_HP_MAX,
    renderX: rx, renderY: ry,         // smooth pixel position
    startPixX: rx, startPixY: ry,
    totalMoveTicks: 1, moveProg: 0,
    moving: false, targetX: x, targetY: y,
    walkCycle: 0,
    makingBreak: false, breakProgress: 0, breakX: -1, breakY: -1,
    inDanger: false, dangerTicks: 0, warnLevel: 0,
    closeCallPending: false,
    status: 'Idle',
  };
}

function aerialCreate(type, count) {
  const isHeli = type === 'helicopter';
  return {
    type, count,
    label: isHeli ? 'Helicopter' : 'Plane',
    cooldownMs: 0,
    maxCooldownMs: isHeli ? HELI_COOLDOWN_MS : PLANE_COOLDOWN_MS,
    waterCost: isHeli ? HELI_WATER_COST : PLANE_WATER_COST,
    ready: true,
  };
}

function _ease(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }

function ffMoveTo(ff, tx, ty, moveTicks) {
  if (ff.x === tx && ff.y === ty) return;
  moveTicks = moveTicks || FF_MOVE_TICKS;
  ff.startPixX = ff.renderX; ff.startPixY = ff.renderY;
  ff.targetX = tx; ff.targetY = ty;
  const dist = Math.max(Math.abs(tx - ff.x), Math.abs(ty - ff.y));
  ff.totalMoveTicks = Math.max(1, dist * moveTicks);
  ff.moveProg = ff.totalMoveTicks;
  ff.moving = true; ff.makingBreak = false; ff.status = 'Moving';
}

function ffUpdateMovement(ff) {
  if (!ff.moving) {
    ff.renderX = ff.x * TILE_PX + TILE_PX / 2;
    ff.renderY = ff.y * TILE_PX + TILE_PX / 2;
    return;
  }
  ff.moveProg--;
  ff.walkCycle = (ff.walkCycle + 1) % 16;
  const p = _ease(1 - ff.moveProg / ff.totalMoveTicks);
  ff.renderX = ff.startPixX + (ff.targetX * TILE_PX + TILE_PX/2 - ff.startPixX) * p;
  ff.renderY = ff.startPixY + (ff.targetY * TILE_PX + TILE_PX/2 - ff.startPixY) * p;
  if (ff.moveProg <= 0) {
    ff.x = ff.targetX; ff.y = ff.targetY;
    ff.renderX = ff.x * TILE_PX + TILE_PX/2;
    ff.renderY = ff.y * TILE_PX + TILE_PX/2;
    ff.moving = false; ff.status = 'Idle';
  }
}

function ffStartFirebreak(ff, map, tx, ty) {
  const tile = tileAt(map, tx, ty);
  if (!tile || tile.fireIntensity > 0 || tile.type === T.WATER || tile.type === T.ROCK) return false;
  if (tile.firebreak || tile.burned) return false;
  ff.makingBreak = true; ff.breakProgress = FF_BREAK_TICKS;
  ff.breakX = tx; ff.breakY = ty; ff.status = 'Firebreak';
  return true;
}

function ffUpdateFirebreak(ff, map) {
  if (!ff.makingBreak) return;
  ff.breakProgress--;
  if (ff.breakProgress <= 0) {
    const tile = tileAt(map, ff.breakX, ff.breakY);
    if (tile) { tile.type = T.BREAK; tile.firebreak = true; tile.fireIntensity = 0; }
    ff.makingBreak = false; ff.status = 'Idle';
  }
}

// Returns true when FF first enters danger (so caller can play alarm once)
function ffCheckDanger(ff, map, wind, tick) {
  const wv = W_VEC[wind.dir];
  let threat = false;
  const cur = tileAt(map, ff.x, ff.y);
  if (cur && cur.fireIntensity >= 2) threat = true;
  if (!threat) {
    for (let d = 1; d <= 2; d++) {
      const t = tileAt(map, Math.round(ff.x - wv[0]*d), Math.round(ff.y - wv[1]*d));
      if (t && t.fireIntensity >= 2) { threat = true; break; }
    }
  }
  const wasInDanger = ff.inDanger;
  ff.inDanger = threat;
  if (threat) {
    ff.dangerTicks++;
    const prev = ff.warnLevel;
    ff.warnLevel = ff.dangerTicks < WARN_CAUTION ? 0
                 : ff.dangerTicks < WARN_MEDIUM  ? 1
                 : ff.dangerTicks < WARN_CRITICAL ? 2 : 3;
    if (ff.warnLevel >= 2) ff.closeCallPending = true;
  } else {
    ff.dangerTicks = Math.max(0, ff.dangerTicks - 3);
    ff.warnLevel   = ff.dangerTicks < WARN_CAUTION ? 0 : 1;
    if (ff.dangerTicks === 0) ff.inDanger = false;
  }
  return !wasInDanger && threat; // true = newly dangerous
}

function aerialUpdate(aerial, dt) {
  if (aerial.cooldownMs > 0) aerial.cooldownMs = Math.max(0, aerial.cooldownMs - dt);
  aerial.ready = aerial.cooldownMs === 0;
}

function aerialDeploy(aerial, water) {
  if (!aerial.ready || aerial.count <= 0 || water < aerial.waterCost) return false;
  aerial.cooldownMs = aerial.maxCooldownMs;
  aerial.ready = false;
  return true;
}
