// ============================================================
// GAME CONSTANTS — v2 (Balanced)
// ============================================================
const GRID    = 30;
const TILE_PX = 20;

const T       = { FOREST: 0, GRASS: 1, WATER: 2, ROCK: 3, BREAK: 4 };
const T_COLOR = { 0:'#1e5c16', 1:'#4d8f2b', 2:'#1756a3', 3:'#6b6b72', 4:'#857052' };
const T_NAME  = { 0:'Forest', 1:'Grass', 2:'Water', 3:'Rock', 4:'Firebreak' };
const T_FLAM  = { 0:1.6, 1:1.0, 2:0, 3:0, 4:0.05 };

const W_NAME        = ['N','NE','E','SE','S','SW','W','NW'];
const W_VEC         = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
const W_STR_NAME    = { 1:'Light', 2:'Moderate', 3:'Strong' };
const W_SPREAD_MULT = { 1:1.4, 2:2.5, 3:4.0 }; // was 2/3.8/6.5

const FIRE_MAX   = 5;
const FIRE_EVERY = 5;       // was 4
const FIRE_BASE  = 0.0026;  // was 0.0045
const FIRE_GROW  = 0.005;   // was 0.007
const BURN_OUT   = 540;

const TICK_MS      = 50;
const WIND_CHG_MIN = 25000;
const WIND_CHG_MAX = 48000;
const GRACE_MS     = 9000;  // fire won't spread for first 9 s

const RISK_EVERY  = 42;
const RISK_CHANCE = { 1:0.05, 2:0.12, 3:0.26 }; // was 0.10/0.22/0.45
const RISK_DMG    = 18;  // was 30
const FF_HP_MAX   = 100;

// Warning ticks accumulate while FF is in danger; damage only at CRITICAL
const WARN_CAUTION  = 24;
const WARN_MEDIUM   = 58;
const WARN_CRITICAL = 100;

const FF_SUPP_RATE   = 0.085; // was 0.045
const FF_MOVE_TICKS  = 9;     // was 16
const FF_BREAK_TICKS = 100;

const HELI_COOLDOWN_MS      = 12000;
const HELI_WATER_COST       = 55;
const HELI_INTENSITY_REDUCE = 5;
const PLANE_COOLDOWN_MS     = 28000;
const PLANE_WATER_COST      = 160;
const PLANE_LINE            = 6;

const COST_FF       = 280;
const BURN_LOSE_PCT = 0.50;

const REWARD_TILE  = 8;   // $ per fire tile extinguished
const REWARD_CLOSE = 200; // $ close-call bonus
