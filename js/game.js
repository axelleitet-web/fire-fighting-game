// ============================================================
// GAME LOGIC — v2 (grace period, micro-rewards, briefing,
//               audio, close-call bonus, smooth loop)
// ============================================================

const PLAYER = { budget: 5000, done: {}, upgrades: {} };
let G = null;
let _currentContractId = null;

// ---- Screen management ----
function _showScreen(name) {
  ['contract','briefing','game','result'].forEach(id => {
    const el = document.getElementById('screen-'+id);
    if (el) el.classList.toggle('active', id === name);
  });
}

// ============================================================
// INIT
// ============================================================
window.addEventListener('load', () => {
  try { initRenderer(); } catch(e) { console.error('Renderer init failed:', e); return; }

  // Top bar / overlay buttons
  document.getElementById('btn-pause').addEventListener('click', gamePause);
  document.getElementById('btn-quit').addEventListener('click', () => { stopLoop(); _showScreen('contract'); renderContractScreen(PLAYER); });
  document.getElementById('btn-resume').addEventListener('click', gameResume);
  document.getElementById('btn-restart').addEventListener('click', () => {
    document.getElementById('overlay-pause').classList.add('hidden');
    if (_currentContractId != null) gameStartContract(_currentContractId);
  });
  document.getElementById('btn-menu').addEventListener('click', () => {
    document.getElementById('overlay-pause').classList.add('hidden');
    stopLoop(); _showScreen('contract'); renderContractScreen(PLAYER);
  });

  // Briefing buttons
  document.getElementById('btn-start-mission').addEventListener('click', () => {
    if (_currentContractId != null) gameStartContract(_currentContractId);
  });
  document.getElementById('btn-back-brief').addEventListener('click', () => {
    _showScreen('contract'); renderContractScreen(PLAYER);
  });

  // Canvas
  canvas.addEventListener('mousemove', _onMouseMove);
  canvas.addEventListener('click', _onCanvasClick);
  canvas.addEventListener('mouseleave', () => { if (G) { G.hoverX=-1; G.hoverY=-1; } });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.code==='Space'&&G) { e.preventDefault(); gamePause(); }
    if (e.code==='Escape'&&G) { G.actionMode=null; G.selectedFF=null; }
    if (e.code==='KeyR'&&G) { SFX.click(); if(_currentContractId!=null) gameStartContract(_currentContractId); }
  });

  // Unlock audio on any click
  document.addEventListener('click', () => SFX.unlock(), {once:true});

  _showScreen('contract');
  renderContractScreen(PLAYER);
  requestAnimationFrame(_loop);
});

// ============================================================
// GAME LOOP
// ============================================================
let _lastTs=0, _running=false, _acc=0;

function _loop(ts) {
  requestAnimationFrame(_loop);
  const dt = Math.min(ts - _lastTs, 100);
  _lastTs = ts;
  SFX.tick();
  if (_running && G && G.phase==='playing') {
    _acc += dt;
    while (_acc >= TICK_MS) { _tick(); _acc -= TICK_MS; }
  }
  if (G) render(G);
}

function stopLoop()  { _running=false; }
function startLoop() { _running=true; _acc=0; }

// ============================================================
// SHOW BRIEFING
// ============================================================
window.gameShowBriefing = function(id) {
  const contract = getContract(id);
  if (!contract) return;
  const done = Object.keys(PLAYER.done).length;
  if (done < contract.requiredDone) return;
  _currentContractId = id;
  renderBriefingScreen(contract);
  _showScreen('briefing');
  SFX.click();
};

// ============================================================
// START CONTRACT
// ============================================================
window.gameStartContract = function(id) {
  _ffIdSeq = 0; // reset ID counter
  const contract = getContract(id);
  if (!contract) return;
  _currentContractId = id;

  const firefighters = [];
  const spread = Math.floor(contract.startFF/2);
  for (let i=0;i<contract.startFF;i++) {
    firefighters.push(ffCreate(Math.floor(GRID/2)-spread+i, GRID-2));
  }

  const aerials = [];
  if (contract.startHeli>0) {
    const a=aerialCreate('helicopter', contract.startHeli);
    a.waterCost=getHeliWaterCost(PLAYER);
    a.maxCooldownMs=getHeliCooldown(PLAYER);
    aerials.push(a);
  }
  if (contract.startPlane>0) aerials.push(aerialCreate('plane', contract.startPlane));

  G = {
    contract, map: mapGenerate(contract),
    wind: windCreate(contract.startWind.dir, contract.startWind.str),
    firefighters, aerials,
    water: contract.waterSupply, budget: contract.startBudget,
    elapsed: 0, tick: 0,
    graceRemaining: GRACE_MS,
    waterUsed: 0, unitsLost: 0, initFFCount: contract.startFF,
    earned: 0, // cumulative micro-rewards earned during mission
    selectedFF: null, actionMode: null,
    hoverX: -1, hoverY: -1,
    player: PLAYER, phase: 'playing',
    _prevFireTiles: new Set(), // for extinguish detection
  };

  // Snapshot initial fire tile set
  for (let y=0;y<GRID;y++) for (let x=0;x<GRID;x++)
    if (G.map[y][x].fireIntensity>0) G._prevFireTiles.add(y*GRID+x);

  document.getElementById('disp-mission-name').textContent=contract.name;
  _showScreen('game');
  startLoop();
};

// ============================================================
// GAME TICK
// ============================================================
function _tick() {
  if (!G||G.phase!=='playing') return;
  G.elapsed += TICK_MS;
  G.tick++;
  if (G.graceRemaining>0) G.graceRemaining-=TICK_MS;

  // Wind
  const prevDir=G.wind.dir;
  windUpdate(G.wind, TICK_MS);
  if (G.wind.dir!==prevDir) { SFX.windShift(); _showWindToast(); }

  // Fire (suppressed during grace period)
  if (G.graceRemaining<=0 && G.tick%FIRE_EVERY===0) {
    fireUpdate(G.map, G.wind);
    _checkExtinguished();
  }

  // Firefighters
  const suppRate  = getFFSuppRate(PLAYER);
  const moveTicks = getFFMoveTicks(PLAYER);
  const riskDmg   = getFFRiskDamage(PLAYER);

  for (let i=G.firefighters.length-1;i>=0;i--) {
    const ff=G.firefighters[i];
    ffUpdateMovement(ff);
    ffUpdateFirebreak(ff, G.map);

    if (!ff.moving) {
      const tile=tileAt(G.map, ff.x, ff.y);
      if (tile&&tile.fireIntensity>0) {
        const prev=Math.ceil(tile.fireIntensity);
        tile.fireIntensity=Math.max(0,tile.fireIntensity-suppRate);
        if (tile.fireIntensity===0) { tile.burnTime=0; SFX.extinguish(); _grantReward(ff.x,ff.y,REWARD_TILE); }
        ff.status='Suppressing';
      } else if (!ff.makingBreak) {
        ff.status='Idle';
      }
    }

    // Danger check
    const newDanger=ffCheckDanger(ff, G.map, G.wind, G.tick);
    if (newDanger) SFX.danger();

    // Damage — only at WARN_CRITICAL and on risk-check ticks
    if (ff.warnLevel>=3 && G.tick%RISK_EVERY===0) {
      if (Math.random()<RISK_CHANCE[G.wind.str]) ff.hp-=riskDmg;
    }

    // Close-call bonus when FF escapes danger
    if (ff.closeCallPending && !ff.inDanger && ff.hp>0) {
      ff.closeCallPending=false;
      G.budget+=REWARD_CLOSE; G.earned+=REWARD_CLOSE;
      addFloatText(ff.x, ff.y, `Close Call! +$${REWARD_CLOSE}`, '#86efac');
      SFX.closeCall();
    }

    if (ff.hp<=0) {
      G.unitsLost++;
      triggerShake(4);
      addFloatText(ff.x,ff.y,'FF Lost!','#ef4444');
      G.firefighters.splice(i,1);
      if (G.selectedFF&&G.selectedFF.id===ff.id) G.selectedFF=null;
    }
  }

  // Aerial cooldowns
  G.aerials.forEach(a=>aerialUpdate(a,TICK_MS));

  _checkConditions();
}

// ---- Extinguish detection for micro-rewards ----
function _checkExtinguished() {
  for (let y=0;y<GRID;y++) for (let x=0;x<GRID;x++) {
    const key=y*GRID+x;
    const fi=G.map[y][x].fireIntensity;
    if (G._prevFireTiles.has(key) && fi===0 && !G.map[y][x].burned) {
      // Fire was on this tile last fire-update, now it's out (from aerial/FF)
      G._prevFireTiles.delete(key);
    } else if (fi>0) {
      G._prevFireTiles.add(key);
    }
  }
}

function _grantReward(x,y,amount) {
  G.budget+=amount; G.earned+=amount;
  addFloatText(x,y,`+$${amount}`,'#fbbf24');
}

// ---- Wind shift toast ----
function _showWindToast() {
  const el=document.getElementById('wind-shift-toast');
  if (!el) return;
  el.textContent=`WIND SHIFT → ${W_NAME[G.wind.dir]} ${W_STR_NAME[G.wind.str]}`;
  el.style.opacity='1';
  clearTimeout(el._t);
  el._t=setTimeout(()=>{ el.style.opacity='0'; },2200);
}

// ============================================================
// WIN / LOSE
// ============================================================
function _checkConditions() {
  if (G.phase!=='playing') return;
  const flam=countFlammable(G.map), burned=countBurned(G.map), active=countFire(G.map);
  const sec=Math.floor(G.elapsed/1000);
  if (flam&&burned/flam>=BURN_LOSE_PCT) { _endGame(false,'Too much land burned'); return; }
  if (sec>=G.contract.timeLimitSec) { _endGame(active===0,'Time ran out'); return; }
  if (active===0&&sec>5) { _endGame(true,''); }
}

function _endGame(won, reason) {
  G.phase=won?'won':'lost';
  stopLoop();
  if (won) SFX.success();

  const flam=countFlammable(G.map), burned=countBurned(G.map);
  const savedPct=flam?Math.round((flam-burned)/flam*100):100;
  const timeSec=Math.floor(G.elapsed/1000);
  const waterEff=G.contract.waterSupply>0?Math.round((1-G.waterUsed/G.contract.waterSupply)*100):100;

  let earned=0, rating='FAIL';
  if (won) {
    earned+=G.contract.baseReward;
    earned+= savedPct>=90?1200:savedPct>=75?600:savedPct>=50?200:0;
    earned-= G.unitsLost*400;
    earned+= Math.max(0,waterEff)*3;
    earned+= timeSec<G.contract.timeLimitSec*0.60?500:0;
    earned+= G.earned; // in-mission micro-rewards already added to budget
    earned=Math.max(0,earned);
    const r=earned/G.contract.baseReward;
    rating=r>=1.8?'S':r>=1.3?'A':r>=0.85?'B':'C';
  }

  PLAYER.budget+=earned;
  if (won) PLAYER.done[G.contract.id]=rating;

  // Find next unlocked contract
  const nextId=won?CONTRACTS.findIndex(c=>c.id===G.contract.id+1&&PLAYER.done[G.contract.id]):null;

  renderResultScreen({
    won, rating, earned,
    nextContractId: nextId!=null&&nextId>=0?CONTRACTS[nextId].id:null,
    statsRows:[
      {label:'Land Saved',        val:`${savedPct}%`,    cls:savedPct>=75?'rs-good':'rs-bad'},
      {label:'Firefighters Lost', val:G.unitsLost,        cls:G.unitsLost===0?'rs-good':'rs-bad'},
      {label:'Water Efficiency',  val:`${waterEff}%`,    cls:waterEff>=50?'rs-good':'rs-neutral'},
      {label:'Time',              val:_fmtTime(timeSec), cls:'rs-neutral'},
      {label:'Rewards Earned',    val:`$${G.earned}`,    cls:'rs-neutral'},
      {label:'Contract Bonus',    val:`$${G.contract.baseReward}`,cls:'rs-neutral'},
      ...((!won&&reason)?[{label:'Reason',val:reason,cls:'rs-bad'}]:[]),
    ],
  });
  _showScreen('result');
}

function _fmtTime(sec) { return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`; }

// ============================================================
// PAUSE
// ============================================================
function gamePause() {
  if (!G||G.phase!=='playing') return;
  _running=false;
  document.getElementById('overlay-pause').classList.remove('hidden');
}
function gameResume() {
  document.getElementById('overlay-pause').classList.add('hidden');
  if (G&&G.phase==='playing') startLoop();
}

// ============================================================
// RESULT SCREEN HELPERS
// ============================================================
window.gameRetry    = function() { if(_currentContractId!=null) gameStartContract(_currentContractId); SFX.click(); };
window.gameBackToMenu = function() { stopLoop(); _showScreen('contract'); renderContractScreen(PLAYER); SFX.click(); };

// ============================================================
// INPUT
// ============================================================
function _onMouseMove(e) {
  if (!G) return;
  const r=canvas.getBoundingClientRect();
  G.hoverX=Math.floor((e.clientX-r.left)/(r.width/canvas.width)/TILE_PX);
  G.hoverY=Math.floor((e.clientY-r.top)/(r.height/canvas.height)/TILE_PX);
}

function _onCanvasClick(e) {
  if (!G||G.phase!=='playing') return;
  SFX.click();
  const r=canvas.getBoundingClientRect();
  const tx=Math.floor((e.clientX-r.left)/(r.width/canvas.width)/TILE_PX);
  const ty=Math.floor((e.clientY-r.top)/(r.height/canvas.height)/TILE_PX);
  if (tx<0||tx>=GRID||ty<0||ty>=GRID) return;
  _handleTileClick(tx,ty);
}

function _handleTileClick(tx,ty) {
  const mode=G.actionMode;

  if (mode==='move') {
    const clicked=G.firefighters.find(f=>f.x===tx&&f.y===ty);
    if (clicked) { G.selectedFF=clicked; return; }
    if (G.selectedFF) { ffMoveTo(G.selectedFF,tx,ty,getFFMoveTicks(PLAYER)); G.selectedFF=null; G.actionMode=null; return; }
  }

  if (mode==='firebreak') {
    if (!G.selectedFF) { const c=G.firefighters.find(f=>f.x===tx&&f.y===ty); if(c) G.selectedFF=c; return; }
    ffStartFirebreak(G.selectedFF,G.map,tx,ty); G.selectedFF=null; G.actionMode=null; return;
  }

  if (mode==='deploy_ff') {
    const tile=tileAt(G.map,tx,ty);
    if (!tile||tile.type===T.WATER||tile.type===T.ROCK) return;
    if (G.budget<COST_FF) { _showMsg('Not enough budget!'); return; }
    G.firefighters.push(ffCreate(tx,ty)); G.budget-=COST_FF; G.actionMode=null; return;
  }

  if (mode==='heli_drop') {
    const heli=G.aerials.find(a=>a.type==='helicopter');
    if (!heli||!heli.ready||G.water<heli.waterCost) { _showMsg('Helicopter not ready!'); return; }
    if (aerialDeploy(heli,G.water)) {
      G.water-=heli.waterCost; G.waterUsed+=heli.waterCost;
      const before=_countFireAt(G.map,tx,ty);
      fireHeliDrop(G.map,tx,ty,HELI_INTENSITY_REDUCE);
      addParticles(tx,ty,'water'); SFX.waterDrop(false);
      triggerShake(2);
      const saved=before-_countFireAt(G.map,tx,ty);
      if (saved>0) { _grantReward(tx,ty,saved*REWARD_TILE); SFX.extinguish(); }
      G.actionMode=null;
    }
    return;
  }

  if (mode==='plane_run') {
    const plane=G.aerials.find(a=>a.type==='plane');
    if (!plane||!plane.ready||G.water<plane.waterCost) { _showMsg('Plane not ready!'); return; }
    if (aerialDeploy(plane,G.water)) {
      G.water-=plane.waterCost; G.waterUsed+=plane.waterCost;
      const pl=getPlaneLine(PLAYER), wv=W_VEC[G.wind.dir], pd=-wv[1],pe=wv[0];
      const half=Math.floor(pl/2);
      let saved=0;
      for (let i=-half;i<=half;i++) {
        const bx=Math.round(tx+pd*i), by=Math.round(ty+pe*i);
        saved+=_countFireAt(G.map,bx,by);
        addParticles(bx,by,'water');
      }
      firePlaneRun(G.map,tx,ty,G.wind,pl);
      for (let i=-half;i<=half;i++) saved-=_countFireAt(G.map,Math.round(tx+pd*i),Math.round(ty+pe*i));
      SFX.waterDrop(true); triggerShake(3);
      if (saved>0) _grantReward(tx,ty,saved*REWARD_TILE);
      G.actionMode=null;
    }
    return;
  }

  // Default: select/deselect FF or move selected FF
  const clicked=G.firefighters.find(f=>f.x===tx&&f.y===ty);
  if (clicked) {
    G.selectedFF=(G.selectedFF&&G.selectedFF.id===clicked.id)?null:clicked;
  } else if (G.selectedFF) {
    ffMoveTo(G.selectedFF,tx,ty,getFFMoveTicks(PLAYER));
    G.selectedFF=null;
  }
}

function _countFireAt(map,x,y) {
  let n=0;
  if (tileAt(map,x,y)?.fireIntensity>0) n++;
  for (const [dx,dy] of NEIGHBORS) if (tileAt(map,x+dx,y+dy)?.fireIntensity>0) n++;
  return n;
}

// ============================================================
// GLOBAL CALLBACKS (called from HTML)
// ============================================================
window.gameSelectFF = function(id) {
  if (!G) return;
  const ff=G.firefighters.find(f=>f.id===id);
  G.selectedFF=ff||null;
};

window.gameSetAction = function(id) {
  if (!G||G.phase!=='playing') return;
  G.actionMode=G.actionMode===id?null:id;
  G.selectedFF=null;
  SFX.click();
};

window.gameBuyUpgrade = function(id) {
  if (purchaseUpgrade(PLAYER,id)) { renderContractScreen(PLAYER); SFX.success(); }
};

function _showMsg(txt) {
  const el=document.getElementById('danger-warn');
  const prev=el.textContent;
  el.textContent=txt; el.classList.remove('hidden');
  clearTimeout(el._msgT);
  el._msgT=setTimeout(()=>{
    el.textContent=prev;
    if (!G||!G.firefighters.some(f=>f.warnLevel>=2)) el.classList.add('hidden');
  },1800);
}
