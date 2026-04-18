// ============================================================
// UNITS SYSTEM
// ============================================================

let _ffIdSeq = 0;

function ffCreate(x, y) {
  return {
    id: _ffIdSeq++,
    x, y,
    hp: FF_HP_MAX,
    maxHp: FF_HP_MAX,
    // Movement
    moving: false,
    targetX: x, targetY: y,
    moveProg: 0,   // ticks remaining to reach target
    // Firebreak
    makingBreak: false,
    breakProgress: 0,
    breakX: -1, breakY: -1,
    // Risk
    inDanger: false,
    riskTick: 0,
    // Status label
    status: 'Idle',
  };
}

// Create aerial unit descriptor
function aerialCreate(type, count) {
  const isHeli = type === 'helicopter';
  return {
    type,
    label: isHeli ? 'Helicopter' : 'Plane',
    count,
    cooldownMs: 0,
    maxCooldownMs: isHeli ? HELI_COOLDOWN_MS : PLANE_COOLDOWN_MS,
    waterCost: isHeli ? HELI_WATER_COST : PLANE_WATER_COST,
    ready: true,
  };
}

// Move a firefighter toward its target (call each tick)
function ffUpdateMovement(ff) {
  if (!ff.moving) return;
  ff.moveProg--;
  if (ff.moveProg <= 0) {
    ff.x = ff.targetX;
    ff.y = ff.targetY;
    ff.moving = false;
    ff.status = 'Idle';
  }
}

// Order a firefighter to move to (tx, ty).
// moveTicks: ticks per tile (pass upgrade-adjusted value from game.js)
function ffMoveTo(ff, tx, ty, moveTicks) {
  if (ff.x === tx && ff.y === ty) return;
  moveTicks = moveTicks || FF_MOVE_TICKS;
  ff.targetX = tx;
  ff.targetY = ty;
  const dist = Math.max(Math.abs(tx - ff.x), Math.abs(ty - ff.y));
  ff.moving = true;
  ff.moveProg = dist * moveTicks;
  ff.makingBreak = false;
  ff.status = 'Moving';
}

// Order a firefighter to create firebreak at (tx, ty)
function ffStartFirebreak(ff, map, tx, ty) {
  const tile = tileAt(map, tx, ty);
  if (!tile || tile.fireIntensity > 0 || tile.type === T.WATER || tile.type === T.ROCK) return false;
  if (tile.firebreak || tile.burned) return false;
  ff.makingBreak = true;
  ff.breakProgress = FF_BREAK_TICKS;
  ff.breakX = tx;
  ff.breakY = ty;
  ff.status = 'Firebreak';
  return true;
}

// Tick firefighter firebreak construction
function ffUpdateFirebreak(ff, map) {
  if (!ff.makingBreak) return;
  ff.breakProgress--;
  if (ff.breakProgress <= 0) {
    const tile = tileAt(map, ff.breakX, ff.breakY);
    if (tile) {
      tile.type = T.BREAK;
      tile.firebreak = true;
      tile.fireIntensity = 0;
    }
    ff.makingBreak = false;
    ff.status = 'Idle';
  }
}

// Passive suppression: reduce fire intensity on current tile
function ffSuppressTile(ff, map) {
  const tile = tileAt(map, ff.x, ff.y);
  if (!tile || tile.fireIntensity <= 0) return;
  tile.fireIntensity = Math.max(0, tile.fireIntensity - FF_SUPP_RATE);
  if (tile.fireIntensity === 0) tile.burnTime = 0;
  ff.status = 'Suppressing';
}

// Check if firefighter is in danger; updates ff.inDanger.
// Damage is applied by the caller using upgrade-adjusted values.
function ffCheckDanger(ff, map, wind, tick) {
  if (tick % RISK_EVERY !== 0) return;

  const wv = W_VEC[wind.dir];
  let fireThreat = false;

  // Standing on burning tile
  const cur = tileAt(map, ff.x, ff.y);
  if (cur && cur.fireIntensity >= 2) fireThreat = true;

  if (!fireThreat) {
    // Fire is upwind and heading toward this firefighter
    for (let dist = 1; dist <= 2; dist++) {
      const ux = Math.round(ff.x - wv[0] * dist);
      const uy = Math.round(ff.y - wv[1] * dist);
      const upwindTile = tileAt(map, ux, uy);
      if (upwindTile && upwindTile.fireIntensity >= 2) {
        fireThreat = true;
        break;
      }
    }
  }

  ff.inDanger = fireThreat;
}

// Update aerial cooldowns
function aerialUpdate(aerial, dt) {
  if (aerial.cooldownMs > 0) {
    aerial.cooldownMs = Math.max(0, aerial.cooldownMs - dt);
  }
  aerial.ready = aerial.cooldownMs === 0;
}

// Deploy aerial unit; returns true if successful
function aerialDeploy(aerial, water) {
  if (!aerial.ready || aerial.count <= 0) return false;
  if (water < aerial.waterCost) return false;
  aerial.cooldownMs = aerial.maxCooldownMs;
  aerial.ready = false;
  return true;
}
