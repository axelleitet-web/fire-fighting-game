// ============================================================
// RENDERER — v2 (particles, floating text, screen shake,
//               smooth FF movement, improved fire visuals)
// ============================================================

let canvas, ctx, windCvs, windCtx;

function initRenderer() {
  canvas  = document.getElementById('game-canvas');
  ctx     = canvas.getContext('2d');
  windCvs = document.getElementById('wind-canvas');
  windCtx = windCvs.getContext('2d');
  canvas.width  = GRID * TILE_PX;
  canvas.height = GRID * TILE_PX;
}

// ---- Animation clock ----
let _rt = 0; // render tick

// ---- Screen shake ----
let _shake = 0;
function triggerShake(amt) { _shake = Math.max(_shake, amt); }

// ---- Particle system ----
const _particles = [];
function addParticles(worldX, worldY, type) {
  const cx = worldX * TILE_PX + TILE_PX/2;
  const cy = worldY * TILE_PX + TILE_PX/2;
  const count = type === 'water' ? 10 : 6;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = type === 'water' ? 1.5 + Math.random()*3 : 0.3 + Math.random()*1.2;
    _particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd - (type==='water'?1:0.5),
      life: type === 'water' ? 22+Math.random()*14 : 30+Math.random()*20,
      maxLife: type === 'water' ? 36 : 50,
      r: type === 'water' ? 2+Math.random()*2 : 1.5+Math.random()*2,
      color: type === 'water' ? '#60a5fa' : `hsl(${20+Math.random()*20},10%,${40+Math.random()*20}%)`,
      type,
    });
  }
}

function _updateParticles() {
  for (let i = _particles.length-1; i >= 0; i--) {
    const p = _particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += p.type === 'water' ? 0.18 : -0.06; // water falls, smoke rises
    p.vx *= 0.96;
    p.life--;
    if (p.life <= 0) _particles.splice(i, 1);
  }
}

function _drawParticles() {
  for (const p of _particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---- Floating text system ----
const _floats = [];
function addFloatText(worldX, worldY, text, color) {
  _floats.push({
    x: worldX * TILE_PX + TILE_PX/2,
    y: worldY * TILE_PX,
    text, color: color||'#fbbf24',
    life: 55, maxLife: 55,
  });
}

function _updateFloats() {
  for (let i = _floats.length-1; i >= 0; i--) {
    _floats[i].life--;
    if (_floats[i].life <= 0) _floats.splice(i, 1);
  }
}

function _drawFloats() {
  ctx.textAlign = 'center';
  for (const f of _floats) {
    const t = f.life / f.maxLife;
    const dy = (1-t) * -26;
    ctx.globalAlpha = Math.min(1, t * 2);
    ctx.font = `bold ${11 + Math.round(3*Math.min(1,t*3))}px Courier New`;
    ctx.fillStyle = '#000';
    ctx.fillText(f.text, f.x+1, f.y+dy+1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y+dy);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}

// ============================================================
// MAIN RENDER
// ============================================================
function render(G) {
  if (!G || !ctx) return;
  _rt++;
  _updateParticles();
  _updateFloats();

  const dangerZones = getDangerZones(G.map, G.wind);
  const shake = _shake > 0;

  ctx.save();
  if (shake) {
    const sx = (Math.random()-0.5)*_shake*2, sy = (Math.random()-0.5)*_shake*2;
    ctx.translate(sx, sy);
    _shake = Math.max(0, _shake - 0.6);
  }

  ctx.clearRect(-4, -4, canvas.width+8, canvas.height+8);

  // 1. Tiles
  for (let y=0;y<GRID;y++) for (let x=0;x<GRID;x++)
    _drawTile(x, y, G.map[y][x], dangerZones.has(y*GRID+x));

  // 2. Fire overlays
  for (let y=0;y<GRID;y++) for (let x=0;x<GRID;x++)
    if (G.map[y][x].fireIntensity > 0) _drawFire(x, y, G.map[y][x].fireIntensity);

  // 3. Hover preview
  if (G.hoverX >= 0 && G.hoverX < GRID && G.hoverY >= 0 && G.hoverY < GRID)
    _drawHover(G.hoverX, G.hoverY, G.actionMode, G);

  // 4. Firefighter path lines (when move mode selected)
  if (G.actionMode === 'move' && G.selectedFF)
    _drawMovePath(G.selectedFF, G.hoverX, G.hoverY);

  // 5. Particles
  _drawParticles();

  // 6. Firefighters
  for (const ff of G.firefighters) _drawFF(ff, G.selectedFF && G.selectedFF.id === ff.id);

  // 7. Grid lines
  _drawGrid();

  // 8. Floating text
  _drawFloats();

  ctx.restore();

  // HTML-based HUD updates
  _renderHUD(G);
  _renderRightPanel(G, dangerZones);
  _renderBottomBar(G);
  _renderWindArrow(G.wind);
}

// ============================================================
// TILE DRAWING
// ============================================================
function _drawTile(x, y, tile, isDanger) {
  const px=x*TILE_PX, py=y*TILE_PX;
  if (tile.burned) {
    ctx.fillStyle = '#120800';
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
    if ((x+y)%4===0) { ctx.fillStyle='#1e1006'; ctx.fillRect(px+5,py+5,4,4); }
    return;
  }
  ctx.fillStyle = T_COLOR[tile.type];
  ctx.fillRect(px, py, TILE_PX, TILE_PX);

  // Forest texture dots
  if (tile.type === T.FOREST) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    if ((x*3+y*7)%5===0) ctx.fillRect(px+4,py+3,3,4);
    if ((x*7+y*3)%5===0) ctx.fillRect(px+12,py+10,3,4);
  }

  // Firebreak hatching
  if (tile.firebreak) {
    ctx.fillStyle='rgba(0,0,0,0.22)';
    for (let i=0;i<TILE_PX;i+=5) ctx.fillRect(px+i,py,2,TILE_PX);
  }

  // Danger zone tint
  if (isDanger && tile.fireIntensity===0) {
    const a = 0.14 + 0.10*Math.sin(_rt*0.14);
    ctx.fillStyle = `rgba(255,50,0,${a})`;
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
  }
}

// ============================================================
// FIRE DRAWING — multi-layer glow with color gradient by intensity
// ============================================================
const _FIRE_INNER = ['','#ffe066','#ffaa00','#ff6600','#ff2200','#cc0000'];
const _FIRE_OUTER = ['','rgba(255,200,50,0.4)','rgba(255,120,0,0.5)','rgba(255,80,0,0.6)','rgba(220,20,0,0.65)','rgba(160,0,0,0.7)'];

function _drawFire(x, y, intensity) {
  const px=x*TILE_PX, py=y*TILE_PX;
  const cx=px+TILE_PX/2, cy=py+TILE_PX/2;
  const flicker = 0.82 + 0.18*Math.sin(_rt*0.21 + x*0.8 + y*0.6);

  // Outer glow
  const grad = ctx.createRadialGradient(cx,cy,0,cx,cy,TILE_PX*0.85);
  grad.addColorStop(0, _FIRE_INNER[intensity]);
  grad.addColorStop(1, _FIRE_OUTER[intensity]);
  ctx.globalAlpha = flicker;
  ctx.fillStyle = grad;
  ctx.fillRect(px,py,TILE_PX,TILE_PX);
  ctx.globalAlpha = 1;

  // Bright core at high intensity
  if (intensity >= 4) {
    ctx.globalAlpha = 0.7 * flicker;
    ctx.fillStyle = '#fff8cc';
    ctx.fillRect(cx-2,cy-2,4,4);
    ctx.globalAlpha = 1;
  }

  // Flickering tip spark
  if (intensity >= 3) {
    const sx = px+3+((_rt+x*3)%6)*2, sy = py+1;
    ctx.globalAlpha = 0.55*flicker;
    ctx.fillStyle = '#ffffc0';
    ctx.fillRect(sx, sy, 2, 3);
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// HOVER PREVIEW
// ============================================================
function _drawHover(hx, hy, mode, G) {
  const px=hx*TILE_PX, py=hy*TILE_PX;
  ctx.strokeStyle='rgba(255,255,255,0.75)';
  ctx.lineWidth=2;
  ctx.strokeRect(px+1,py+1,TILE_PX-2,TILE_PX-2);

  if (mode==='heli_drop') {
    ctx.fillStyle='rgba(96,165,250,0.35)';
    ctx.fillRect(px,py,TILE_PX,TILE_PX);
    ctx.fillStyle='rgba(96,165,250,0.18)';
    for (const [dx,dy] of NEIGHBORS) {
      const nx=hx+dx,ny=hy+dy;
      if (nx>=0&&nx<GRID&&ny>=0&&ny<GRID) ctx.fillRect(nx*TILE_PX,ny*TILE_PX,TILE_PX,TILE_PX);
    }
  } else if (mode==='plane_run') {
    const wv=W_VEC[G.wind.dir], pd=-wv[1], pe=wv[0];
    const pl=getPlaneLine(G.player), half=Math.floor(pl/2);
    ctx.fillStyle='rgba(96,165,250,0.32)';
    for (let i=-half;i<=half;i++) {
      const tx=Math.round(hx+pd*i),ty=Math.round(hy+pe*i);
      if (tx>=0&&tx<GRID&&ty>=0&&ty<GRID) ctx.fillRect(tx*TILE_PX,ty*TILE_PX,TILE_PX,TILE_PX);
    }
  } else if (mode==='firebreak') {
    ctx.fillStyle='rgba(133,112,82,0.45)'; ctx.fillRect(px,py,TILE_PX,TILE_PX);
  } else if (mode==='deploy_ff') {
    ctx.fillStyle='rgba(251,191,36,0.28)'; ctx.fillRect(px,py,TILE_PX,TILE_PX);
  }
}

function _drawMovePath(ff, hx, hy) {
  if (hx<0||hy<0||hx>=GRID||hy>=GRID) return;
  ctx.strokeStyle='rgba(255,255,255,0.45)';
  ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
  ctx.beginPath();
  ctx.moveTo(ff.renderX, ff.renderY);
  ctx.lineTo(hx*TILE_PX+TILE_PX/2, hy*TILE_PX+TILE_PX/2);
  ctx.stroke(); ctx.setLineDash([]);
  // Target dot
  ctx.fillStyle='rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(hx*TILE_PX+TILE_PX/2,hy*TILE_PX+TILE_PX/2,3,0,Math.PI*2); ctx.fill();
}

// ============================================================
// FIREFIGHTER DRAWING
// ============================================================
function _drawFF(ff, selected) {
  const px=ff.renderX, py=ff.renderY;
  const r=5;

  // Warning level glow
  if (ff.warnLevel >= 1) {
    const wColors=['','rgba(251,191,36,0.35)','rgba(249,115,22,0.45)','rgba(239,68,68,0.55)'];
    const pulsed = ff.warnLevel===3 ? (Math.sin(_rt*0.35)>0?1:0.4) : 1;
    ctx.globalAlpha = pulsed;
    ctx.fillStyle = wColors[ff.warnLevel];
    ctx.beginPath(); ctx.arc(px,py,r+5,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }

  // Shadow
  ctx.fillStyle='rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(px+1,py+3,r,r*0.4,0,0,Math.PI*2); ctx.fill();

  // Body color based on HP
  const hpFrac = ff.hp/ff.maxHp;
  let bodyColor = hpFrac>0.6?'#fbbf24':hpFrac>0.3?'#f97316':'#ef4444';
  if (ff.warnLevel===3 && _rt%10<5) bodyColor='#ff4444';

  ctx.fillStyle = bodyColor;
  ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.fill();

  // Walking bob
  if (ff.moving) {
    const bob = Math.sin(ff.walkCycle/16*Math.PI*2)*2;
    ctx.fillStyle='#1e40af';
    ctx.beginPath(); ctx.ellipse(px,py-3+bob,3.5,2.5,0,0,Math.PI*2); ctx.fill();
  } else {
    ctx.fillStyle='#1e40af';
    ctx.beginPath(); ctx.ellipse(px,py-3,3.5,2.5,0,0,Math.PI*2); ctx.fill();
  }

  // Suppression animation: radiating arc
  if (ff.status==='Suppressing') {
    const prog = (_rt%20)/20;
    ctx.strokeStyle=`rgba(96,165,250,${0.8-prog*0.6})`;
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(px,py,r+2+prog*5,0,Math.PI*2); ctx.stroke();
  }

  // Firebreak progress ring
  if (ff.makingBreak) {
    const frac=1-ff.breakProgress/FF_BREAK_TICKS;
    ctx.strokeStyle='#86efac'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(px,py,r+4,-Math.PI/2,-Math.PI/2+frac*Math.PI*2); ctx.stroke();
  }

  // Selection ring
  if (selected) {
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(px,py,r+4,0,Math.PI*2); ctx.stroke();
  }

  // Warning icon above FF
  if (ff.warnLevel>=2) {
    ctx.font='bold 9px sans-serif'; ctx.textAlign='center';
    ctx.fillStyle = ff.warnLevel===3 && _rt%10<5 ? '#ff4444' : '#fbbf24';
    ctx.fillText('!', px, py-r-3);
    ctx.textAlign='left';
  }
}

function _drawGrid() {
  ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.lineWidth=0.5;
  for (let x=0;x<=GRID;x++) { ctx.beginPath();ctx.moveTo(x*TILE_PX,0);ctx.lineTo(x*TILE_PX,canvas.height);ctx.stroke(); }
  for (let y=0;y<=GRID;y++) { ctx.beginPath();ctx.moveTo(0,y*TILE_PX);ctx.lineTo(canvas.width,y*TILE_PX);ctx.stroke(); }
}

// ============================================================
// WIND ARROW CANVAS
// ============================================================
function _renderWindArrow(wind) {
  const W=windCvs.width, H=windCvs.height;
  windCtx.clearRect(0,0,W,H);
  windCtx.fillStyle='#1f2937';
  windCtx.beginPath(); windCtx.arc(W/2,H/2,W/2-1,0,Math.PI*2); windCtx.fill();

  windCtx.font='bold 8px Courier New'; windCtx.fillStyle='#374151'; windCtx.textAlign='center'; windCtx.textBaseline='middle';
  windCtx.fillText('N',W/2,6); windCtx.fillText('S',W/2,H-6);
  windCtx.fillText('W',6,H/2); windCtx.fillText('E',W-6,H/2);

  const v=W_VEC[wind.dir], cx=W/2, cy=H/2, len=17;
  const strC={1:'#86efac',2:'#fbbf24',3:'#f87171'};
  const ang=Math.atan2(v[1],v[0]);
  windCtx.strokeStyle=strC[wind.str]; windCtx.fillStyle=strC[wind.str]; windCtx.lineWidth=2.5;
  windCtx.beginPath();
  windCtx.moveTo(cx-v[0]*len*0.45, cy-v[1]*len*0.45);
  windCtx.lineTo(cx+v[0]*len*0.55, cy+v[1]*len*0.55);
  windCtx.stroke();
  // Arrowhead
  const ax=cx+v[0]*len, ay=cy+v[1]*len;
  windCtx.beginPath();
  windCtx.moveTo(ax,ay);
  windCtx.lineTo(ax-Math.cos(ang-0.5)*8,ay-Math.sin(ang-0.5)*8);
  windCtx.lineTo(ax-Math.cos(ang+0.5)*8,ay-Math.sin(ang+0.5)*8);
  windCtx.closePath(); windCtx.fill();

  // Wind-change flash
  if (wind.changeFlash>0) {
    windCtx.strokeStyle=`rgba(255,255,100,${wind.changeFlash/120})`;
    windCtx.lineWidth=3;
    windCtx.beginPath(); windCtx.arc(W/2,H/2,W/2-1,0,Math.PI*2); windCtx.stroke();
  }
}

// ============================================================
// HUD — top bar
// ============================================================
function _renderHUD(G) {
  const sec=Math.floor(G.elapsed/1000);
  const rem=Math.max(0,G.contract.timeLimitSec-sec);
  const mm=String(Math.floor(rem/60)).padStart(2,'0'), ss=String(rem%60).padStart(2,'0');
  const timerEl=document.getElementById('disp-timer');
  timerEl.textContent=`${mm}:${ss}`;
  timerEl.className=rem<=30?'urgent':'';

  const strEl=document.getElementById('disp-wind-str');
  document.getElementById('disp-wind-dir').textContent=W_NAME[G.wind.dir];
  strEl.textContent=W_STR_NAME[G.wind.str];
  strEl.className=`str-${['','light','moderate','strong'][G.wind.str]}`;
  document.getElementById('wind-change-fill').style.width=`${(1-windChangePct(G.wind))*100}%`;

  document.getElementById('disp-water').textContent=Math.floor(G.water);
  document.getElementById('disp-money').textContent=G.budget;

  const anyDanger=G.firefighters.some(f=>f.warnLevel>=2);
  document.getElementById('danger-warn').classList.toggle('hidden',!anyDanger);

  // Grace period overlay
  const graceEl=document.getElementById('grace-overlay');
  if (graceEl) {
    if (G.graceRemaining>0) {
      graceEl.classList.remove('hidden');
      const gm=document.getElementById('grace-msg');
      if (gm) gm.textContent=`SETUP PHASE — ${Math.ceil(G.graceRemaining/1000)}s`;
    } else graceEl.classList.add('hidden');
  }
}

// ============================================================
// RIGHT PANEL
// ============================================================
function _renderRightPanel(G, dangerZones) {
  _renderFFList(G);
  _renderAerialList(G);
  _renderFireStatus(G);
  _renderSelectedInfo(G);
}

function _renderFFList(G) {
  const el=document.getElementById('ff-list'); if(!el)return;
  if (!G.firefighters.length) { el.innerHTML='<div style="color:#6b7280;font-size:0.78em">None deployed</div>'; return; }
  let h='';
  for (const ff of G.firefighters) {
    const pct=ff.hp/ff.maxHp*100;
    const hpCls=pct>60?'hp-hi':pct>30?'hp-mid':'hp-lo';
    const wCls=ff.warnLevel>=3?'warn-3':ff.warnLevel>=2?'warn-2':ff.warnLevel>=1?'warn-1':'';
    const sel=G.selectedFF&&G.selectedFF.id===ff.id?' selected':'';
    const stLbl=ff.warnLevel>=2?'danger':ff.status==='Suppressing'?'suppressing':ff.status==='Moving'?'moving':ff.status==='Firebreak'?'break':'';
    const stTxt=ff.warnLevel>=2?'DANGER!':ff.status;
    h+=`<div class="ff-item ${wCls}${sel}" onclick="gameSelectFF(${ff.id})">
      <div class="ff-row1"><span class="ff-name">FF #${ff.id+1}</span><span class="ff-status-label ${stLbl}">${stTxt}</span></div>
      <div class="hp-bar"><div class="hp-fill ${hpCls}" style="width:${pct}%"></div></div>
    </div>`;
  }
  el.innerHTML=h;
}

function _renderAerialList(G) {
  const el=document.getElementById('aerial-list'); if(!el)return;
  let h='';
  for (const a of G.aerials) {
    if (!a.count) continue;
    const pct=a.ready?100:(1-a.cooldownMs/a.maxCooldownMs)*100;
    const cdSec=Math.ceil(a.cooldownMs/1000);
    h+=`<div class="aerial-item">
      <div class="aerial-name">${a.label} ×${a.count}</div>
      <div class="aerial-cost">${a.waterCost} water</div>
      <div class="cd-bar"><div class="cd-fill${a.ready?' ready':''}" style="width:${pct}%"></div></div>
      <div class="aerial-status${a.ready?' ready':''}">${a.ready?'READY':`${cdSec}s cooldown`}</div>
    </div>`;
  }
  if (!h) h='<div style="color:#6b7280;font-size:0.78em">No air support</div>';
  el.innerHTML=h;
}

function _renderFireStatus(G) {
  const el=document.getElementById('fire-status-info'); if(!el)return;
  const flam=countFlammable(G.map), burned=countBurned(G.map), active=countFire(G.map);
  const pct=flam?Math.round(burned/flam*100):0;
  const losePct=Math.round(BURN_LOSE_PCT*100);
  el.innerHTML=`<div class="fs-row"><span>Active fires</span><span class="fs-val">${active}</span></div>
    <div class="fs-row"><span>Burned</span><span class="fs-val">${pct}%</span></div>
    <div class="burn-bar"><div class="burn-fill" style="width:${Math.min(100,pct/losePct*100)}%"></div></div>
    <div style="color:#6b7280;font-size:0.72em;margin-top:4px">Lose at ${losePct}%</div>`;
}

function _renderSelectedInfo(G) {
  const el=document.getElementById('selected-info'); if(!el)return;
  if (G.selectedFF) {
    const ff=G.selectedFF;
    el.innerHTML=`<strong>FF #${ff.id+1}</strong><br>HP: ${ff.hp}/${ff.maxHp}<br>Status: ${ff.status}${ff.warnLevel>=2?'<br><span style="color:#ef4444;font-weight:bold">⚠ IN DANGER — MOVE NOW</span>':''}`;
  } else if (G.actionMode) {
    const hints={move:'Click FF then click destination',heli_drop:'Click target tile',plane_run:'Click center of drop line',deploy_ff:'Click empty tile',firebreak:'Click FF then target tile'};
    el.innerHTML=`<span style="color:#60a5fa">${hints[G.actionMode]||G.actionMode}</span>`;
  } else {
    el.textContent='Click a unit or choose an action';
  }
}

// ============================================================
// BOTTOM ACTION BAR
// ============================================================
function _renderBottomBar(G) {
  const el=document.getElementById('action-btns'); if(!el)return;
  const heli=G.aerials.find(a=>a.type==='helicopter');
  const plane=G.aerials.find(a=>a.type==='plane');
  const actions=[
    {id:'move',       icon:'🚶', label:'Move FF',       cost:'Free',         hint:'',       enabled:G.firefighters.length>0, aerial:null},
    {id:'deploy_ff',  icon:'🚒', label:'Deploy FF',     cost:`$${COST_FF}`,  hint:'',       enabled:G.budget>=COST_FF, aerial:null},
    {id:'firebreak',  icon:'⛏',  label:'Firebreak',     cost:'Time',         hint:'',       enabled:G.firefighters.length>0, aerial:null},
    {id:'heli_drop',  icon:'🚁', label:'Heli Drop',     cost:heli?`${heli.waterCost}💧`:'N/A', hint:'', enabled:heli&&heli.ready&&G.water>=heli?.waterCost, aerial:heli},
    {id:'plane_run',  icon:'✈',  label:'Plane Run',     cost:plane?`${plane.waterCost}💧`:'N/A', hint:'', enabled:plane&&plane.ready&&G.water>=plane?.waterCost, aerial:plane},
  ];
  let h='';
  for (const a of actions) {
    if ((a.id==='heli_drop'&&(!heli||!heli.count))||(a.id==='plane_run'&&(!plane||!plane.count))) continue;
    const active=G.actionMode===a.id;
    const dis=!a.enabled;
    let cdBar='';
    if (a.aerial&&!a.aerial.ready) {
      const pct=(1-a.aerial.cooldownMs/a.aerial.maxCooldownMs)*100;
      cdBar=`<div class="act-btn-cdbar" style="width:${pct}%"></div>`;
    }
    if (a.aerial&&a.aerial.ready) cdBar=`<div class="act-btn-cdbar ready" style="width:100%"></div>`;
    h+=`<button class="act-btn${active?' active':''}${dis?' disabled':''}" onclick="gameSetAction('${a.id}')">
      <span class="ab-icon">${a.icon}</span>
      <span class="ab-label">${a.label}</span>
      <span class="ab-cost">${a.cost}</span>
      ${cdBar}
    </button>`;
  }
  el.innerHTML=h;
}

// ============================================================
// CONTRACT SCREEN
// ============================================================
function renderContractScreen(player) {
  document.getElementById('disp-budget').textContent=player.budget;
  document.getElementById('disp-done').textContent=Object.keys(player.done).length;
  const done=Object.keys(player.done).length;
  let h='';
  for (const c of CONTRACTS) {
    const locked=done<c.requiredDone, comp=player.done[c.id];
    const dCls=c.difficulty==='EASY'?'diff-easy':c.difficulty==='MEDIUM'?'diff-medium':'diff-hard';
    h+=`<div class="contract-card${locked?' locked':''}${comp?' completed':''}" onclick="gameShowBriefing(${c.id})">
      <h3>${c.name}</h3>
      <div class="c-desc">${c.description}</div>
      <div class="c-row"><span class="c-label">Difficulty</span><span class="c-val ${dCls}">${c.difficulty}</span></div>
      <div class="c-row"><span class="c-label">Time Limit</span><span class="c-val">${c.timeLimitSec/60} min</span></div>
      <div class="c-row"><span class="c-label">Base Reward</span><span class="c-val">$${c.baseReward}</span></div>
      ${comp?`<div class="c-done">Completed: ${comp}</div>`:''}
      ${locked?`<div class="c-lock">Complete previous missions first</div>`:''}
    </div>`;
  }
  document.getElementById('contract-cards').innerHTML=h;

  let uh='';
  for (const def of UPGRADE_DEFS) {
    const lvl=getUpgradeLevel(player,def.id), maxed=lvl>=def.maxLevel;
    const cost=maxed?'—':`$${def.costs[lvl]}`, able=canUpgrade(player,def.id);
    let pips='';
    for (let i=0;i<def.maxLevel;i++) pips+=`<div class="up-pip${i<lvl?' filled':''}"></div>`;
    uh+=`<div class="upgrade-card">
      <h4>${def.name}</h4>
      <div class="up-desc">${def.desc}</div>
      <div class="up-level-bar">${pips}</div>
      <button onclick="gameBuyUpgrade('${def.id}')" ${able?'':'disabled'}>${maxed?'MAXED':`Upgrade (${cost})`}</button>
    </div>`;
  }
  document.getElementById('upgrade-cards').innerHTML=uh;
}

// ============================================================
// BRIEFING SCREEN
// ============================================================
function renderBriefingScreen(contract) {
  document.getElementById('briefing-box').querySelector('h2').textContent=contract.name;
  document.getElementById('brief-subtitle').textContent=`Difficulty: ${contract.difficulty}`;
  document.getElementById('brief-desc').textContent=contract.description;
  const stats=[
    {label:'Time Limit', val:`${contract.timeLimitSec/60} min`},
    {label:'Firefighters', val:contract.startFF},
    {label:'Helicopter', val:contract.startHeli},
    {label:'Plane', val:contract.startPlane||0},
    {label:'Water', val:contract.waterSupply},
    {label:'Budget', val:`$${contract.startBudget}`},
    {label:'Base Reward', val:`$${contract.baseReward}`},
  ];
  document.getElementById('brief-stats').innerHTML=stats.map(s=>
    `<div class="brief-stat"><div class="bs-label">${s.label}</div><div class="bs-val">${s.val}</div></div>`
  ).join('');
}

// ============================================================
// RESULT SCREEN
// ============================================================
function renderResultScreen(result) {
  const rMap={S:'rating-S',A:'rating-A',B:'rating-B',C:'rating-C',FAIL:'rating-FAIL'};
  const badge=document.getElementById('result-rating-badge');
  badge.textContent=result.rating; badge.className=`rating-badge ${rMap[result.rating]||''}`;
  document.getElementById('result-title').textContent=result.won?'Mission Complete':'Mission Failed';
  document.getElementById('result-stats-list').innerHTML=result.statsRows.map(r=>
    `<div class="rs-row"><span class="rs-label">${r.label}</span><span class="rs-val ${r.cls||''}">${r.val}</span></div>`
  ).join('');
  document.getElementById('result-payout').textContent=`Earned: $${result.earned}`;

  // Buttons: retry + optional next
  const nextId=result.won?result.nextContractId:null;
  const nextContract=nextId!=null?getContract(nextId):null;
  let btns=`<button class="result-btn secondary" onclick="gameRetry()">Retry</button>
    <button class="result-btn primary" onclick="gameBackToMenu()">Menu</button>`;
  if (nextContract) btns=`<button class="result-btn secondary" onclick="gameRetry()">Retry</button>
    <button class="result-btn primary" onclick="gameShowBriefing(${nextId})">Next: ${nextContract.name} →</button>`;
  document.getElementById('result-btns').innerHTML=btns;
}
