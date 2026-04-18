// ============================================================
// MAIN GAME LOGIC & LOOP
// ============================================================

// Player persistent state
const PLAYER = {
  budget: 5000,
  done: {},      // contractId -> rating string
  upgrades: {},
};

// Active game state (null when not playing)
let G = null;

// Screens
const screens = {
  contract: document.getElementById('screen-contract'),
  game:     document.getElementById('screen-game'),
  result:   document.getElementById('screen-result'),
};

function showScreen(name) {
  for (const [k, el] of Object.entries(screens)) el.classList.toggle('active', k === name);
}

// ============================================================
// INIT
// ============================================================
window.addEventListener('load', () => {
  document.getElementById('btn-pause').addEventListener('click', gamePause);
  document.getElementById('btn-quit').addEventListener('click', () => { stopLoop(); showScreen('contract'); });
  document.getElementById('btn-resume').addEventListener('click', gameResume);
  document.getElementById('btn-restart').addEventListener('click', () => {
    document.getElementById('overlay-pause').classList.add('hidden');
    gameStartContract(G.contract.id);
  });
  document.getElementById('btn-menu').addEventListener('click', () => {
    document.getElementById('overlay-pause').classList.add('hidden');
    stopLoop();
    showScreen('contract');
    renderContractScreen(PLAYER);
  });
  document.getElementById('btn-continue').addEventListener('click', () => {
    showScreen('contract');
    renderContractScreen(PLAYER);
  });

  canvas.addEventListener('mousemove', onCanvasMouseMove);
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('mouseleave', () => { if (G) { G.hoverX = -1; G.hoverY = -1; } });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); G ? gamePause() : null; }
    if (e.code === 'Escape') { if (G) { G.actionMode = null; G.selectedFF = null; } }
  });

  showScreen('contract');
  renderContractScreen(PLAYER);
  requestAnimationFrame(loop);
});

// ============================================================
// GAME LOOP
// ============================================================
let lastTs    = 0;
let running   = false;
let accMs     = 0;

function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(ts - lastTs, 100); // cap at 100ms to avoid spiral
  lastTs = ts;

  if (running && G && G.phase === 'playing') {
    accMs += dt;
    while (accMs >= TICK_MS) {
      tick();
      accMs -= TICK_MS;
    }
  }

  if (G) render(G);
}

function stopLoop()  { running = false; }
function startLoop() { running = true; accMs = 0; }

// ============================================================
// START CONTRACT
// ============================================================
window.gameStartContract = function (id) {
  const contract = getContract(id);
  if (!contract) return;
  const done = Object.keys(PLAYER.done).length;
  if (done < contract.requiredDone) return;

  // Build game state
  const firefighters = [];
  for (let i = 0; i < contract.startFF; i++) {
    // Spawn at bottom-center staging area
    const sx = Math.floor(GRID / 2) - Math.floor(contract.startFF / 2) + i;
    firefighters.push(ffCreate(sx, GRID - 2));
  }

  const aerials = [];
  if (contract.startHeli > 0) {
    const a = aerialCreate('helicopter', contract.startHeli);
    a.waterCost = getHeliWaterCost(PLAYER);
    a.maxCooldownMs = getHeliCooldown(PLAYER);
    aerials.push(a);
  }
  if (contract.startPlane > 0) {
    aerials.push(aerialCreate('plane', contract.startPlane));
  }

  G = {
    contract,
    map:          mapGenerate(contract),
    wind:         windCreate(contract.startWind.dir, contract.startWind.str),
    firefighters,
    aerials,
    water:        contract.waterSupply,
    budget:       contract.startBudget,
    elapsed:      0,
    tick:         0,
    waterUsed:    0,
    unitsLost:    0,
    initFFCount:  contract.startFF,
    // UI state
    selectedFF:   null,
    actionMode:   null, // 'move','heli_drop','plane_run','deploy_ff','firebreak'
    hoverX:       -1,
    hoverY:       -1,
    player:       PLAYER,
    phase:        'playing', // 'playing','won','lost'
  };

  document.getElementById('disp-mission-name').textContent = contract.name;
  buildActionButtons();
  showScreen('game');
  startLoop();
};

// ============================================================
// TICK (game logic update)
// ============================================================
function tick() {
  if (!G || G.phase !== 'playing') return;

  G.elapsed += TICK_MS;
  G.tick++;

  // Update wind
  windUpdate(G.wind, TICK_MS);

  // Update fire every FIRE_EVERY ticks
  if (G.tick % FIRE_EVERY === 0) {
    fireUpdate(G.map, G.wind);
  }

  // Update firefighters
  const suppRate = getFFSuppRate(PLAYER);
  const moveTicks = getFFMoveTicks(PLAYER);
  const riskDmg  = getFFRiskDamage(PLAYER);

  for (let i = G.firefighters.length - 1; i >= 0; i--) {
    const ff = G.firefighters[i];

    // Movement
    ffUpdateMovement(ff);

    // Firebreak construction
    ffUpdateFirebreak(ff, G.map);

    // Passive suppression on current tile
    if (!ff.moving) {
      const tile = tileAt(G.map, ff.x, ff.y);
      if (tile && tile.fireIntensity > 0) {
        tile.fireIntensity = Math.max(0, tile.fireIntensity - suppRate);
        if (tile.fireIntensity === 0) tile.burnTime = 0;
        ff.status = 'Suppressing';
      } else if (!ff.makingBreak) {
        ff.status = 'Idle';
      }
    }

    // Risk check: updates ff.inDanger; damage applied here with upgrade values
    ffCheckDanger(ff, G.map, G.wind, G.tick);
    if (ff.inDanger && G.tick % RISK_EVERY === 0) {
      if (Math.random() < RISK_CHANCE[G.wind.str]) {
        ff.hp -= riskDmg;
      }
    }

    // Death
    if (ff.hp <= 0) {
      G.unitsLost++;
      G.firefighters.splice(i, 1);
      if (G.selectedFF && G.selectedFF.id === ff.id) G.selectedFF = null;
    }
  }

  // Update aerial cooldowns
  for (const a of G.aerials) {
    aerialUpdate(a, TICK_MS);
  }

  // Check win/lose
  checkConditions();
}

// ============================================================
// WIN/LOSE CONDITIONS
// ============================================================
function checkConditions() {
  if (G.phase !== 'playing') return;

  const flammable = countFlammable(G.map);
  const burned    = countBurned(G.map);
  const active    = countFire(G.map);
  const sec       = Math.floor(G.elapsed / 1000);

  // Lose: too much burned
  if (flammable > 0 && burned / flammable >= BURN_LOSE_PCT) {
    endGame(false, 'Too much land destroyed');
    return;
  }

  // Lose: time limit
  if (sec >= G.contract.timeLimitSec) {
    endGame(active === 0, active === 0 ? '' : 'Time ran out');
    return;
  }

  // Win: fire fully contained
  if (active === 0 && sec > 5) {
    endGame(true, '');
  }
}

// ============================================================
// END GAME
// ============================================================
function endGame(won, reason) {
  G.phase = won ? 'won' : 'lost';
  stopLoop();

  const flammable = countFlammable(G.map);
  const burned    = countBurned(G.map);
  const savedPct  = flammable ? Math.round((flammable - burned) / flammable * 100) : 100;
  const timeSec   = Math.floor(G.elapsed / 1000);
  const waterEff  = G.contract.waterSupply > 0
    ? Math.round((1 - G.waterUsed / G.contract.waterSupply) * 100) : 100;

  // Payment calculation
  let earned = 0;
  let rating  = 'FAIL';
  if (won) {
    earned += G.contract.baseReward;
    earned += savedPct >= 90 ? 1200 : savedPct >= 75 ? 600 : savedPct >= 50 ? 200 : 0;
    earned -= G.unitsLost * 400;
    earned += Math.max(0, waterEff) * 3;
    const timeBonus = timeSec < G.contract.timeLimitSec * 0.60 ? 500 : 0;
    earned += timeBonus;
    earned  = Math.max(0, earned);

    const ratio = earned / G.contract.baseReward;
    rating = ratio >= 1.8 ? 'S' : ratio >= 1.3 ? 'A' : ratio >= 0.85 ? 'B' : 'C';
  }

  PLAYER.budget += earned;
  if (won) PLAYER.done[G.contract.id] = rating;

  const statsRows = [
    { label: 'Land Saved',       val: `${savedPct}%`,      cls: savedPct >= 75 ? 'good' : 'bad' },
    { label: 'Firefighters Lost',val: G.unitsLost,          cls: G.unitsLost === 0 ? 'good' : 'bad' },
    { label: 'Water Efficiency', val: `${waterEff}%`,       cls: waterEff >= 50 ? 'good' : '' },
    { label: 'Time Taken',       val: fmtTime(timeSec),     cls: '' },
    { label: 'Base Reward',      val: `$${G.contract.baseReward}`, cls: '' },
  ];
  if (!won && reason) statsRows.push({ label: 'Reason', val: reason, cls: 'bad' });

  renderResultScreen({ won, rating, earned, statsRows });
  showScreen('result');
}

function fmtTime(sec) {
  return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
}

// ============================================================
// PAUSE
// ============================================================
function gamePause() {
  if (!G || G.phase !== 'playing') return;
  running = false;
  document.getElementById('overlay-pause').classList.remove('hidden');
}
function gameResume() {
  document.getElementById('overlay-pause').classList.add('hidden');
  if (G && G.phase === 'playing') startLoop();
}

// ============================================================
// CANVAS INPUT
// ============================================================
function onCanvasMouseMove(e) {
  if (!G) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  G.hoverX = Math.floor((e.clientX - rect.left) * scaleX / TILE_PX);
  G.hoverY = Math.floor((e.clientY - rect.top)  * scaleY / TILE_PX);
}

function onCanvasClick(e) {
  if (!G || G.phase !== 'playing') return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const tx = Math.floor((e.clientX - rect.left) * scaleX / TILE_PX);
  const ty = Math.floor((e.clientY - rect.top)  * scaleY / TILE_PX);
  if (tx < 0 || tx >= GRID || ty < 0 || ty >= GRID) return;

  handleTileClick(tx, ty);
}

function handleTileClick(tx, ty) {
  const mode = G.actionMode;

  // --- MOVE mode: first click selects, second click is destination ---
  if (mode === 'move') {
    // Click on a firefighter to select it
    const clickedFF = G.firefighters.find(f => f.x === tx && f.y === ty);
    if (clickedFF) {
      G.selectedFF = clickedFF;
      return;
    }
    // If FF already selected, move to tile
    if (G.selectedFF) {
      ffMoveTo(G.selectedFF, tx, ty, getFFMoveTicks(PLAYER));
      G.selectedFF = null;
      G.actionMode = null;
      buildActionButtons();
      return;
    }
  }

  // --- FIREBREAK mode ---
  if (mode === 'firebreak') {
    if (!G.selectedFF) {
      const clickedFF = G.firefighters.find(f => f.x === tx && f.y === ty);
      if (clickedFF) { G.selectedFF = clickedFF; return; }
    } else {
      ffStartFirebreak(G.selectedFF, G.map, tx, ty);
      G.selectedFF = null;
      G.actionMode = null;
      buildActionButtons();
      return;
    }
  }

  // --- DEPLOY FF ---
  if (mode === 'deploy_ff') {
    const tile = tileAt(G.map, tx, ty);
    if (!tile || tile.type === T.WATER || tile.type === T.ROCK) return;
    if (G.budget < COST_FF) { showMsg('Not enough budget!'); return; }
    G.firefighters.push(ffCreate(tx, ty));
    G.budget -= COST_FF;
    G.actionMode = null;
    buildActionButtons();
    return;
  }

  // --- HELI DROP ---
  if (mode === 'heli_drop') {
    const heli = G.aerials.find(a => a.type === 'helicopter');
    if (!heli) return;
    if (!heli.ready) { showMsg('Helicopter on cooldown!'); return; }
    if (G.water < heli.waterCost) { showMsg('Not enough water!'); return; }
    if (aerialDeploy(heli, G.water)) {
      G.water -= heli.waterCost;
      G.waterUsed += heli.waterCost;
      fireHeliDrop(G.map, tx, ty, HELI_INTENSITY_REDUCE);
      G.actionMode = null;
      buildActionButtons();
    }
    return;
  }

  // --- PLANE RUN ---
  if (mode === 'plane_run') {
    const plane = G.aerials.find(a => a.type === 'plane');
    if (!plane) return;
    if (!plane.ready) { showMsg('Plane on cooldown!'); return; }
    if (G.water < plane.waterCost) { showMsg('Not enough water!'); return; }
    if (aerialDeploy(plane, G.water)) {
      G.water -= plane.waterCost;
      G.waterUsed += plane.waterCost;
      firePlaneRun(G.map, tx, ty, G.wind, getPlaneLine(PLAYER));
      G.actionMode = null;
      buildActionButtons();
    }
    return;
  }

  // --- Default: click on firefighter to select / deselect ---
  const clickedFF = G.firefighters.find(f => f.x === tx && f.y === ty);
  if (clickedFF) {
    G.selectedFF = G.selectedFF && G.selectedFF.id === clickedFF.id ? null : clickedFF;
  } else {
    // If a FF is selected with no mode, move it
    if (G.selectedFF) {
      ffMoveTo(G.selectedFF, tx, ty, getFFMoveTicks(PLAYER));
      G.selectedFF = null;
    }
  }
}

// ============================================================
// ACTION BUTTON BUILDING
// ============================================================
function buildActionButtons() {
  const el = document.getElementById('action-btns');
  const heli  = G && G.aerials.find(a => a.type === 'helicopter');
  const plane = G && G.aerials.find(a => a.type === 'plane');

  const actions = [
    {
      id: 'move',
      label: 'Move Firefighter',
      hint: 'Select FF → click destination',
      cost: 'Free',
      enabled: G && G.firefighters.length > 0,
    },
    {
      id: 'deploy_ff',
      label: 'Deploy Firefighter',
      hint: 'Click tile to deploy',
      cost: `$${COST_FF}`,
      enabled: G && G.budget >= COST_FF,
    },
    {
      id: 'firebreak',
      label: 'Create Firebreak',
      hint: 'Select FF → click target tile',
      cost: 'Time',
      enabled: G && G.firefighters.length > 0,
    },
    {
      id: 'heli_drop',
      label: 'Helicopter Drop',
      hint: 'Click target tile',
      cost: heli ? `${heli.waterCost} water` : 'N/A',
      enabled: heli && heli.ready && G.water >= heli.waterCost,
    },
    {
      id: 'plane_run',
      label: 'Plane Water Run',
      hint: 'Click center of run line',
      cost: plane ? `${plane.waterCost} water` : 'N/A',
      enabled: plane && plane.ready && G.water >= plane.waterCost,
    },
  ];

  let html = '';
  for (const a of actions) {
    if (a.id === 'heli_drop' && (!heli || !heli.count)) continue;
    if (a.id === 'plane_run' && (!plane || !plane.count)) continue;
    const active  = G && G.actionMode === a.id;
    const disabled = !a.enabled;
    html += `<button class="act-btn${active ? ' active' : ''}${disabled ? ' disabled' : ''}"
                     onclick="gameSetAction('${a.id}')">
      <span>${a.label}</span>
      <span class="act-cost">${a.cost}</span>
      <span class="act-hint">${a.hint}</span>
    </button>`;
  }
  el.innerHTML = html;
}

window.gameSetAction = function (id) {
  if (!G || G.phase !== 'playing') return;
  G.actionMode = G.actionMode === id ? null : id;
  G.selectedFF = null;
  buildActionButtons();
};

window.gameSelectFF = function (id) {
  if (!G) return;
  const ff = G.firefighters.find(f => f.id === id);
  G.selectedFF = ff || null;
};

window.gameBuyUpgrade = function (id) {
  if (purchaseUpgrade(PLAYER, id)) {
    renderContractScreen(PLAYER);
  }
};

// ============================================================
// SMALL NOTIFICATION
// ============================================================
function showMsg(msg) {
  const el = document.getElementById('danger-warn');
  const prev = el.textContent;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => {
    el.textContent = prev;
    if (!G || !G.firefighters.some(f => f.inDanger)) el.classList.add('hidden');
  }, 1800);
}
