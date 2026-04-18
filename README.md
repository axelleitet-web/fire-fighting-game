# Wildfire Incident Commander

A top-down wildfire management strategy game with realistic wind physics and contract-based progression.

## How to Run

Open `index.html` directly in any modern web browser — no server required.

```
open index.html
# or
firefox index.html
# or
google-chrome index.html
```

## How to Play

### Goal
Contain the wildfire before it burns 50% of flammable land, or the time limit expires.

### Controls
- **Click map tile** — Execute selected action / select/move firefighter
- **Action buttons (sidebar)** — Choose what to do next
- **Pause** — Space bar or Pause button
- **Escape** — Cancel current action / deselect

### Actions
| Action | Description | Cost |
|--------|-------------|------|
| Move Firefighter | Select FF then click destination | Free |
| Deploy Firefighter | Click empty tile to place a new unit | $350 |
| Create Firebreak | Select FF, click adjacent tile to clear it | Time (6s) |
| Helicopter Drop | Drenches target tile + neighbors | 65 water |
| Plane Water Run | Drops a line of water perpendicular to wind | 200 water |

### Wind System
- Wind **direction and strength** change every 20–40 seconds
- Wind dramatically amplifies fire spread **downwind**
- Firefighters **downwind of active fire** are at risk of injury/death
- The wind change progress bar in the top bar shows time until next change
- **Red flashing units** = firefighter in immediate danger — move them!

### Winning
- All fires extinguished → **Victory**
- Score based on: land saved, units lost, water efficiency, time taken

### Progression
- Earn money from contracts → buy **upgrades** between missions
- Three contracts of increasing difficulty unlock sequentially

## File Structure

```
index.html          Entry point
css/style.css       All styling
js/config.js        Game constants
js/contracts.js     Mission definitions (3 contracts)
js/wind.js          Wind system (direction, strength, timing)
js/map.js           Map generation (terrain, water bodies, fire starts)
js/fire.js          Fire spreading, suppression, danger zones
js/units.js         Firefighter & aerial unit logic
js/upgrades.js      Upgrade definitions and calculations
js/renderer.js      Canvas rendering + HTML sidebar updates
js/game.js          Main game loop, state machine, input handling
```

## Tips
- Watch the wind arrow — strong wind can turn a manageable fire into a crisis in seconds
- Create firebreaks **ahead** of the fire's path, not behind it
- Helicopter drops are precise; plane runs cover a wide line perpendicular to wind
- Pull firefighters back when wind shifts toward them
- Water efficiency bonus rewards conservative play
