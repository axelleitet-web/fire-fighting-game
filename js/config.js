// ============================================================
// GAME CONSTANTS
// ============================================================

const GRID = 30;
const TILE_PX = 20; // pixels per tile

// Tile types
const T = { FOREST: 0, GRASS: 1, WATER: 2, ROCK: 3, BREAK: 4 };
const T_COLOR  = { 0: '#2a5e1e', 1: '#5a9e35', 2: '#1a5f8e', 3: '#787878', 4: '#8b7355' };
const T_NAME   = { 0: 'Forest', 1: 'Grass', 2: 'Water', 3: 'Rock', 4: 'Firebreak' };
// How quickly fire spreads through each tile type (0 = fireproof)
const T_FLAM   = { 0: 1.6, 1: 1.0, 2: 0, 3: 0, 4: 0.05 };

// Wind directions: index = direction, value = [dx, dy]
// 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW
const W_NAME  = ['N','NE','E','SE','S','SW','W','NW'];
const W_VEC   = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
const W_STR_NAME = { 1:'Light', 2:'Moderate', 3:'Strong' };

// How much wind multiplies fire spread in the downwind direction
const W_SPREAD_MULT = { 1: 2.0, 2: 3.8, 3: 6.5 };

// Fire
const FIRE_MAX   = 5;
const FIRE_EVERY = 4;            // update fire every N ticks
const FIRE_BASE  = 0.0045;       // base spread chance per fire-update
const FIRE_GROW  = 0.007;        // chance per tick that burning tile gains +1 intensity
const BURN_OUT   = 480;          // ticks before a burning tile becomes fully charred

// Game tick
const TICK_MS = 50; // ms per tick (20 ticks/sec)

// Wind change timing (ms)
const WIND_CHG_MIN = 22000;
const WIND_CHG_MAX = 42000;

// Firefighter risk (checked every N ticks)
const RISK_EVERY  = 38;
const RISK_CHANCE = { 1: 0.10, 2: 0.22, 3: 0.45 };
const RISK_DMG    = 30;
const FF_HP_MAX   = 100;

// Firefighter suppression (per tick standing on burning tile)
const FF_SUPP_RATE   = 0.045; // intensity units reduced per tick
const FF_MOVE_TICKS  = 16;    // ticks to traverse one tile
const FF_BREAK_TICKS = 110;   // ticks to create a firebreak

// Aerial units
const HELI_COOLDOWN_MS = 15000;
const HELI_WATER_COST  = 65;
const HELI_INTENSITY_REDUCE = 5; // fully extinguishes center + reduces neighbors

const PLANE_COOLDOWN_MS = 35000;
const PLANE_WATER_COST  = 200;
const PLANE_LINE        = 6; // tiles dropped in a line

// Deploy costs (budget)
const COST_FF   = 350;
const COST_HELI = 0; // already assigned per contract; extra helis cost more

// Win/lose thresholds
const BURN_LOSE_PCT = 0.50; // fraction of flammable tiles that triggers loss
