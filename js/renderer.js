// ============================================================
// RENDERER
// ============================================================

const canvas   = document.getElementById('game-canvas');
const ctx      = canvas.getContext('2d');
const windCvs  = document.getElementById('wind-canvas');
const windCtx  = windCvs.getContext('2d');

canvas.width  = GRID * TILE_PX;
canvas.height = GRID * TILE_PX;

let _renderTick = 0; // for flicker animation

// -----------------------------------------------------------
// Main render call
// -----------------------------------------------------------
function render(G) {
  _renderTick++;
  if (!G) return;

  const { map, wind, firefighters, aerials, selectedFF, actionMode, hoverX, hoverY } = G;
  const dangerZones = getDangerZones(map, wind);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Draw tiles
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      drawTile(x, y, map[y][x], dangerZones.has(y * GRID + x));
    }
  }

  // 2. Draw fire overlays
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const fi = map[y][x].fireIntensity;
      if (fi > 0) drawFire(x, y, fi);
    }
  }

  // 3. Hover preview
  if (hoverX >= 0 && hoverY >= 0 && hoverX < GRID && hoverY < GRID) {
    drawHover(hoverX, hoverY, actionMode, G);
  }

  // 4. Units
  for (const ff of firefighters) drawFF(ff, ff.id === (selectedFF && selectedFF.id));

  // 5. Grid lines (subtle)
  drawGridLines();

  // 6. Danger zone markers (on top of everything)
  for (const ff of firefighters) {
    if (ff.inDanger) drawDangerMarker(ff.x, ff.y);
  }

  // Update HUD panels
  renderWindArrow(wind);
  renderHUD(G);
  renderSidebar(G, dangerZones);
}

// -----------------------------------------------------------
// Tile rendering
// -----------------------------------------------------------
function drawTile(x, y, tile, isDanger) {
  const px = x * TILE_PX, py = y * TILE_PX;

  if (tile.burned) {
    ctx.fillStyle = '#1a0d00';
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
    // Ash speckle
    ctx.fillStyle = '#2a1a08';
    if ((x + y) % 3 === 0) ctx.fillRect(px + 6, py + 6, 3, 3);
    return;
  }

  ctx.fillStyle = T_COLOR[tile.type];
  ctx.fillRect(px, py, TILE_PX, TILE_PX);

  // Firebreak pattern
  if (tile.firebreak) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < TILE_PX; i += 4) {
      ctx.fillRect(px + i, py, 2, TILE_PX);
    }
  }

  // Danger zone overlay
  if (isDanger && tile.fireIntensity === 0) {
    const alpha = 0.18 + 0.12 * Math.sin(_renderTick * 0.15);
    ctx.fillStyle = `rgba(255, 50, 0, ${alpha})`;
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
  }
}

function drawFire(x, y, intensity) {
  const px = x * TILE_PX, py = y * TILE_PX;
  const flicker = 0.85 + 0.15 * Math.sin(_renderTick * 0.22 + x * 0.7 + y * 0.5);

  const alphaMap = { 1: 0.45, 2: 0.60, 3: 0.72, 4: 0.85, 5: 0.95 };
  const alpha = (alphaMap[intensity] || 0.5) * flicker;

  // Base orange glow
  const grad = ctx.createRadialGradient(
    px + TILE_PX / 2, py + TILE_PX / 2, 0,
    px + TILE_PX / 2, py + TILE_PX / 2, TILE_PX * 0.7
  );
  grad.addColorStop(0, `rgba(255, 200, 50, ${alpha})`);
  grad.addColorStop(0.5, `rgba(255, 80, 10, ${alpha})`);
  grad.addColorStop(1, `rgba(180, 10, 0, ${alpha * 0.6})`);
  ctx.fillStyle = grad;
  ctx.fillRect(px, py, TILE_PX, TILE_PX);

  // Flame tip flicker at high intensity
  if (intensity >= 3) {
    const fx = px + 4 + ((_renderTick + x) % 5) * 2;
    ctx.fillStyle = `rgba(255, 255, 100, ${0.6 * flicker})`;
    ctx.fillRect(fx, py + 1, 3, 4);
  }
}

function drawDangerMarker(x, y) {
  const px = x * TILE_PX, py = y * TILE_PX;
  const flash = Math.sin(_renderTick * 0.3) > 0;
  if (flash) {
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, TILE_PX - 2, TILE_PX - 2);
  }
}

function drawGridLines() {
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= GRID; x++) {
    ctx.beginPath(); ctx.moveTo(x * TILE_PX, 0); ctx.lineTo(x * TILE_PX, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= GRID; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * TILE_PX); ctx.lineTo(canvas.width, y * TILE_PX); ctx.stroke();
  }
}

// -----------------------------------------------------------
// Firefighter rendering
// -----------------------------------------------------------
function drawFF(ff, selected) {
  const px = ff.x * TILE_PX + TILE_PX / 2;
  const py = ff.y * TILE_PX + TILE_PX / 2;
  const r = 5;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(px + 1, py + 2, r, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const hpFrac = ff.hp / ff.maxHp;
  const bodyColor = ff.inDanger
    ? (Math.sin(_renderTick * 0.4) > 0 ? '#ff4040' : '#ffff00')
    : (hpFrac > 0.6 ? '#fbbf24' : hpFrac > 0.3 ? '#f97316' : '#ef4444');

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();

  // Helmet
  ctx.fillStyle = '#1e40af';
  ctx.beginPath();
  ctx.ellipse(px, py - 3, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Selection ring
  if (selected) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, r + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Movement target line
  if (ff.moving) {
    const tx = ff.targetX * TILE_PX + TILE_PX / 2;
    const ty = ff.targetY * TILE_PX + TILE_PX / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(tx - 2, ty - 2, 4, 4);
  }

  // Firebreak progress arc
  if (ff.makingBreak) {
    const prog = 1 - ff.breakProgress / FF_BREAK_TICKS;
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, r + 4, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
    ctx.stroke();
  }
}

// -----------------------------------------------------------
// Hover preview
// -----------------------------------------------------------
function drawHover(hx, hy, mode, G) {
  const px = hx * TILE_PX, py = hy * TILE_PX;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, TILE_PX - 2, TILE_PX - 2);

  if (mode === 'heli_drop') {
    // Show splash radius
    ctx.fillStyle = 'rgba(100, 200, 255, 0.20)';
    for (const [dx, dy] of NEIGHBORS) {
      const nx = hx + dx, ny = hy + dy;
      if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID) {
        ctx.fillRect(nx * TILE_PX, ny * TILE_PX, TILE_PX, TILE_PX);
      }
    }
    ctx.fillStyle = 'rgba(100, 200, 255, 0.45)';
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
  } else if (mode === 'plane_run') {
    // Show the drop line (perpendicular to wind)
    const wv = W_VEC[G.wind.dir];
    const perpDx = -wv[1], perpDy = wv[0];
    const planeLine = getPlaneLine(G.player);
    const half = Math.floor(planeLine / 2);
    ctx.fillStyle = 'rgba(100, 200, 255, 0.35)';
    for (let i = -half; i <= half; i++) {
      const tx = Math.round(hx + perpDx * i);
      const ty = Math.round(hy + perpDy * i);
      if (tx >= 0 && tx < GRID && ty >= 0 && ty < GRID) {
        ctx.fillRect(tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX);
        // Also show direction of run
        const ax = Math.round(tx + wv[0]), ay = Math.round(ty + wv[1]);
        if (ax >= 0 && ax < GRID && ay >= 0 && ay < GRID) {
          ctx.fillStyle = 'rgba(100, 200, 255, 0.18)';
          ctx.fillRect(ax * TILE_PX, ay * TILE_PX, TILE_PX, TILE_PX);
          ctx.fillStyle = 'rgba(100, 200, 255, 0.35)';
        }
      }
    }
  } else if (mode === 'firebreak') {
    ctx.fillStyle = 'rgba(139, 115, 85, 0.5)';
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
  } else if (mode === 'deploy_ff') {
    ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
  }
}

// -----------------------------------------------------------
// Wind arrow canvas
// -----------------------------------------------------------
function renderWindArrow(wind) {
  const W = windCvs.width, H = windCvs.height;
  windCtx.clearRect(0, 0, W, H);

  // Background
  windCtx.fillStyle = '#1f2937';
  windCtx.beginPath();
  windCtx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
  windCtx.fill();

  // Cardinal labels
  windCtx.font = 'bold 8px Courier New';
  windCtx.fillStyle = '#4b5563';
  windCtx.textAlign = 'center';
  windCtx.textBaseline = 'middle';
  windCtx.fillText('N', W / 2, 6);
  windCtx.fillText('S', W / 2, H - 6);
  windCtx.fillText('W', 6, H / 2);
  windCtx.fillText('E', W - 6, H / 2);

  // Wind direction arrow
  const vec = W_VEC[wind.dir];
  const cx = W / 2, cy = H / 2;
  const len = 16;
  const angle = Math.atan2(vec[1], vec[0]);

  const strColors = { 1: '#86efac', 2: '#fbbf24', 3: '#f87171' };
  windCtx.strokeStyle = strColors[wind.str];
  windCtx.fillStyle   = strColors[wind.str];
  windCtx.lineWidth = 2.5;

  // Shaft
  windCtx.beginPath();
  windCtx.moveTo(cx - vec[0] * len * 0.5, cy - vec[1] * len * 0.5);
  windCtx.lineTo(cx + vec[0] * len * 0.6, cy + vec[1] * len * 0.6);
  windCtx.stroke();

  // Arrowhead
  const ax = cx + vec[0] * len;
  const ay = cy + vec[1] * len;
  windCtx.beginPath();
  windCtx.moveTo(ax, ay);
  windCtx.lineTo(ax - Math.cos(angle - 0.5) * 8, ay - Math.sin(angle - 0.5) * 8);
  windCtx.lineTo(ax - Math.cos(angle + 0.5) * 8, ay - Math.sin(angle + 0.5) * 8);
  windCtx.closePath();
  windCtx.fill();

  // Changing indicator
  if (wind.changeFlash > 0) {
    windCtx.strokeStyle = `rgba(255,255,100,${wind.changeFlash / 120})`;
    windCtx.lineWidth = 3;
    windCtx.beginPath();
    windCtx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    windCtx.stroke();
  }
}

// -----------------------------------------------------------
// HUD top-bar text updates
// -----------------------------------------------------------
function renderHUD(G) {
  const { contract, wind, water, budget, elapsed, firefighters, map } = G;

  // Timer
  const sec = Math.floor(elapsed / 1000);
  const remaining = Math.max(0, contract.timeLimitSec - sec);
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  document.getElementById('disp-timer').textContent = `${mm}:${ss}`;

  // Wind
  document.getElementById('disp-wind-dir').textContent = W_NAME[wind.dir];
  const strEl = document.getElementById('disp-wind-str');
  strEl.textContent = W_STR_NAME[wind.str];
  strEl.className = wind.str === 1 ? 'str-light' : wind.str === 2 ? 'str-moderate' : 'str-strong';

  // Wind change bar
  const pct = windChangePct(wind) * 100;
  document.getElementById('wind-change-fill').style.width = `${100 - pct}%`;

  // Resources
  document.getElementById('disp-water').textContent = Math.floor(water);
  document.getElementById('disp-money').textContent = budget;

  // Danger warning
  const inDanger = firefighters.some(f => f.inDanger);
  document.getElementById('danger-warn').classList.toggle('hidden', !inDanger);
}

// -----------------------------------------------------------
// Sidebar updates (throttled via G.sidebarDirty)
// -----------------------------------------------------------
function renderSidebar(G, dangerZones) {
  renderFFList(G, dangerZones);
  renderAerialList(G);
  renderFireStatus(G);
  renderSelectedInfo(G);
}

function renderFFList(G, dangerZones) {
  const el = document.getElementById('ff-list');
  let html = '';
  for (const ff of G.firefighters) {
    const hpPct = (ff.hp / ff.maxHp) * 100;
    const hpClass = hpPct > 60 ? '' : hpPct > 30 ? 'mid' : 'low';
    const danger  = ff.inDanger;
    const sel     = G.selectedFF && G.selectedFF.id === ff.id;
    html += `<div class="ff-item${danger ? ' danger' : ''}${sel ? ' selected' : ''}"
                  data-ffid="${ff.id}" onclick="gameSelectFF(${ff.id})">
      <div class="ff-name">FF #${ff.id + 1}</div>
      <div class="ff-hp">
        <div class="hp-bar"><div class="hp-fill ${hpClass}" style="width:${hpPct}%"></div></div>
        ${ff.hp}/${ff.maxHp} HP
      </div>
      <div class="ff-status">${ff.status}${danger ? ' ⚠' : ''}</div>
    </div>`;
  }
  if (!G.firefighters.length) html = '<div style="color:#6b7280;font-size:0.78em">None deployed</div>';
  el.innerHTML = html;
}

function renderAerialList(G) {
  const el = document.getElementById('aerial-list');
  let html = '';
  for (const a of G.aerials) {
    if (!a.count) continue;
    const cdSec  = Math.ceil(a.cooldownMs / 1000);
    const pct    = a.ready ? 100 : (1 - a.cooldownMs / a.maxCooldownMs) * 100;
    const rdyStr = a.ready ? 'READY' : `${cdSec}s`;
    const rdyCls = a.ready ? 'ready' : '';
    html += `<div class="aerial-item">
      <div class="aerial-name">${a.label} x${a.count}</div>
      <div class="cd-bar"><div class="cd-fill ${rdyCls}" style="width:${pct}%"></div></div>
      <div class="aerial-cd ${rdyCls}">${rdyStr} | ${a.waterCost} water</div>
    </div>`;
  }
  if (!html) html = '<div style="color:#6b7280;font-size:0.78em">None available</div>';
  el.innerHTML = html;
}

function renderFireStatus(G) {
  const flammable = countFlammable(G.map);
  const burned    = countBurned(G.map);
  const active    = countFire(G.map);
  const burnPct   = flammable ? Math.round(burned / flammable * 100) : 0;
  const losePct   = Math.round(BURN_LOSE_PCT * 100);

  document.getElementById('fire-status-info').innerHTML =
    `<div>Active fires: <b>${active}</b></div>
     <div>Burned: <b>${burnPct}%</b> (lose at ${losePct}%)</div>
     <div class="burn-bar"><div class="burn-fill" style="width:${burnPct}%"></div></div>`;
}

function renderSelectedInfo(G) {
  const el = document.getElementById('selected-info');
  if (G.selectedFF) {
    const ff = G.selectedFF;
    el.innerHTML = `<b>Firefighter #${ff.id + 1}</b><br>
      HP: ${ff.hp}/${ff.maxHp}<br>
      Pos: (${ff.x}, ${ff.y})<br>
      Status: ${ff.status}`;
  } else if (G.actionMode) {
    const labels = {
      heli_drop: 'Click map to drop water (helicopter)',
      plane_run: 'Click map to set bomb run line',
      deploy_ff: 'Click tile to deploy firefighter',
      move: 'Click firefighter, then destination',
      firebreak: 'Select firefighter, click target tile',
    };
    el.textContent = labels[G.actionMode] || G.actionMode;
  } else {
    el.textContent = 'Nothing selected';
  }
}

// -----------------------------------------------------------
// Contract screen rendering
// -----------------------------------------------------------
function renderContractScreen(player) {
  document.getElementById('disp-budget').textContent = player.budget;
  document.getElementById('disp-done').textContent = Object.keys(player.done).length;

  const done = Object.keys(player.done).length;
  let html = '';
  for (const c of CONTRACTS) {
    const locked    = done < c.requiredDone;
    const completed = player.done[c.id];
    const diffColor = c.difficulty === 'EASY' ? '#4ade80' : c.difficulty === 'MEDIUM' ? '#fbbf24' : '#f87171';
    html += `<div class="contract-card${locked ? ' locked' : ''}${completed ? ' completed' : ''}"
               onclick="gameStartContract(${c.id})">
      <h3>${c.name}</h3>
      <div class="c-desc">${c.description}</div>
      <div class="c-row"><span class="c-label">Difficulty</span><span class="c-val" style="color:${diffColor}">${c.difficulty}</span></div>
      <div class="c-row"><span class="c-label">Time Limit</span><span class="c-val">${c.timeLimitSec / 60} min</span></div>
      <div class="c-row"><span class="c-label">Firefighters</span><span class="c-val">${c.startFF}</span></div>
      <div class="c-row"><span class="c-label">Helicopter</span><span class="c-val">${c.startHeli}</span></div>
      <div class="c-row"><span class="c-label">Plane</span><span class="c-val">${c.startPlane}</span></div>
      <div class="c-reward">Base reward: $${c.baseReward}</div>
      ${completed ? `<div class="c-completed">Completed: ${completed}</div>` : ''}
      ${locked ? '<div style="color:#6b7280;font-size:0.8em;margin-top:4px">Complete previous missions first</div>' : ''}
    </div>`;
  }
  document.getElementById('contract-cards').innerHTML = html;

  // Upgrades
  let uhtml = '';
  for (const def of UPGRADE_DEFS) {
    const level = getUpgradeLevel(player, def.id);
    const maxed = level >= def.maxLevel;
    const cost  = maxed ? '—' : `$${def.costs[level]}`;
    const able  = canUpgrade(player, def.id);
    uhtml += `<div class="upgrade-card">
      <h4>${def.name}</h4>
      <div class="up-desc">${def.desc}</div>
      <div class="up-level">Level: ${level}/${def.maxLevel}</div>
      <button onclick="gameBuyUpgrade('${def.id}')" ${able ? '' : 'disabled'}>
        ${maxed ? 'MAXED' : `Upgrade (${cost})`}
      </button>
    </div>`;
  }
  document.getElementById('upgrade-cards').innerHTML = uhtml;
}

// -----------------------------------------------------------
// Result screen
// -----------------------------------------------------------
function renderResultScreen(result) {
  const ratingColors = { S: 'rating-S', A: 'rating-A', B: 'rating-B', C: 'rating-C', FAIL: 'rating-FAIL' };
  document.getElementById('result-rating-badge').textContent = result.rating;
  document.getElementById('result-rating-badge').className   = ratingColors[result.rating] || '';
  document.getElementById('result-title').textContent = result.won ? 'Mission Complete' : 'Mission Failed';

  let statsHtml = '';
  for (const row of result.statsRows) {
    statsHtml += `<div class="rs-row">
      <span class="rs-label">${row.label}</span>
      <span class="rs-val ${row.cls || ''}">${row.val}</span>
    </div>`;
  }
  document.getElementById('result-stats-list').innerHTML = statsHtml;
  document.getElementById('result-payout').textContent = `Earned: $${result.earned}`;
}
