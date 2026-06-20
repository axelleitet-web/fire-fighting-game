// ============================================================
// AUDIO SYSTEM — synthetic Web Audio API sounds
// ============================================================
const SFX = (function () {
  let _ctx = null, _master = null, _dangerCD = 0;

  function _init() {
    if (_ctx) return true;
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
      _master = _ctx.createGain(); _master.gain.value = 0.65;
      _master.connect(_ctx.destination); return true;
    } catch(e) { return false; }
  }

  function unlock() { _init(); if (_ctx && _ctx.state === 'suspended') _ctx.resume(); }

  function _osc(type, freq, dur, vol, delay) {
    if (!_init()) return;
    const t0 = _ctx.currentTime + (delay||0);
    const o = _ctx.createOscillator(), g = _ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(_master);
    o.start(t0); o.stop(t0 + dur + 0.01);
  }

  function _noise(dur, filterHz, filterType, vol, delay) {
    if (!_init()) return;
    const t0 = _ctx.currentTime + (delay||0);
    const sr = _ctx.sampleRate;
    const buf = _ctx.createBuffer(1, Math.ceil(sr*dur), sr);
    const d = buf.getChannelData(0);
    for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    const src = _ctx.createBufferSource(); src.buffer = buf;
    const f = _ctx.createBiquadFilter(); f.type = filterType||'bandpass'; f.frequency.value = filterHz; f.Q.value=1.5;
    const g = _ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0+dur);
    src.connect(f); f.connect(g); g.connect(_master);
    src.start(t0); src.stop(t0+dur+0.01);
  }

  function click()     { _osc('sine', 680, 0.07, 0.15); }
  function extinguish(){ _noise(0.16, 2200, 'highpass', 0.18); }

  function waterDrop(isPlane) {
    if (!_init()) return;
    const t0=_ctx.currentTime, dur=isPlane?0.5:0.3, f0=isPlane?300:500;
    const o=_ctx.createOscillator(), g=_ctx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(f0,t0); o.frequency.exponentialRampToValueAtTime(80,t0+dur);
    g.gain.setValueAtTime(isPlane?0.4:0.32,t0); g.gain.exponentialRampToValueAtTime(0.001,t0+dur);
    o.connect(g); g.connect(_master); o.start(t0); o.stop(t0+dur+0.01);
    _noise(0.15, 1600, 'highpass', isPlane?0.28:0.18);
  }

  function danger() {
    if (_dangerCD>0) return; _dangerCD=55;
    _osc('square',880,0.12,0.13,0.00);
    _osc('square',660,0.12,0.13,0.15);
  }

  function windShift() {
    if (!_init()) return;
    const t0=_ctx.currentTime, dur=0.6;
    const sr=_ctx.sampleRate, buf=_ctx.createBuffer(1,Math.ceil(sr*dur),sr);
    const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    const src=_ctx.createBufferSource(); src.buffer=buf;
    const f=_ctx.createBiquadFilter(); f.type='bandpass'; f.Q.value=2;
    f.frequency.setValueAtTime(150,t0); f.frequency.linearRampToValueAtTime(900,t0+0.25); f.frequency.linearRampToValueAtTime(200,t0+dur);
    const g=_ctx.createGain(); g.gain.setValueAtTime(0.001,t0); g.gain.linearRampToValueAtTime(0.3,t0+0.1); g.gain.exponentialRampToValueAtTime(0.001,t0+dur);
    src.connect(f); f.connect(g); g.connect(_master); src.start(t0); src.stop(t0+dur+0.01);
  }

  function success() {
    [523,659,784,1047].forEach((f,i)=>_osc('sine',f,0.35,0.2,i*0.1));
  }

  function closeCall() {
    if (!_init()) return;
    const t0=_ctx.currentTime;
    const o=_ctx.createOscillator(), g=_ctx.createGain();
    o.type='triangle'; o.frequency.setValueAtTime(580,t0); o.frequency.exponentialRampToValueAtTime(290,t0+0.3);
    g.gain.setValueAtTime(0.22,t0); g.gain.exponentialRampToValueAtTime(0.001,t0+0.3);
    o.connect(g); g.connect(_master); o.start(t0); o.stop(t0+0.35);
  }

  function tick() { if (_dangerCD>0) _dangerCD--; }

  return { unlock, click, waterDrop, danger, windShift, extinguish, success, closeCall, tick };
})();
