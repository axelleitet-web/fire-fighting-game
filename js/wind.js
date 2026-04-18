// ============================================================
// WIND SYSTEM
// ============================================================

function windCreate(dir, str) {
  const changeIn = WIND_CHG_MIN + Math.random() * (WIND_CHG_MAX - WIND_CHG_MIN);
  return {
    dir,         // 0-7
    str,         // 1-3
    changeIn,    // ms until next change
    changeTotal: changeIn,
    changing: false,
    changeFlash: 0,
  };
}

function windUpdate(wind, dt) {
  wind.changeIn -= dt;
  if (wind.changeIn <= 0) {
    // Change wind
    wind.changing = true;
    wind.changeFlash = 120; // flash frames

    // Shift direction by ±1 or ±2, or sometimes bigger jump
    const roll = Math.random();
    let shift;
    if (roll < 0.45)      shift = 1;
    else if (roll < 0.80) shift = -1;
    else if (roll < 0.92) shift = 2;
    else                   shift = -2;

    wind.dir = ((wind.dir + shift) + 8) % 8;

    // Possibly change strength
    const strRoll = Math.random();
    if (strRoll < 0.3) {
      wind.str = Math.max(1, Math.min(3, wind.str + (Math.random() < 0.5 ? 1 : -1)));
    }

    const next = WIND_CHG_MIN + Math.random() * (WIND_CHG_MAX - WIND_CHG_MIN);
    wind.changeIn = next;
    wind.changeTotal = next;
  }

  if (wind.changeFlash > 0) wind.changeFlash--;
}

// Returns the direction vector [dx, dy] for the current wind
function windVec(wind) { return W_VEC[wind.dir]; }

// Returns fraction [0,1] of progress until next wind change
function windChangePct(wind) { return 1 - wind.changeIn / wind.changeTotal; }
