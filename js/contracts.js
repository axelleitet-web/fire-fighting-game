// ============================================================
// CONTRACT / MISSION DEFINITIONS
// ============================================================

const CONTRACTS = [
  {
    id: 0,
    name: 'Ranch Fire',
    subtitle: 'Light winds, manageable blaze',
    description: 'A fire has broken out in the Thornridge Ranch. Grass and sparse forest. Wind is light but picking up.',
    difficulty: 'EASY',
    requiredDone: 0,
    baseReward: 1800,
    timeLimitSec: 240,
    startWind: { dir: 2, str: 1 }, // E, Light
    waterSupply: 700,
    startBudget: 1200,
    startFF: 3,
    startHeli: 1,
    startPlane: 0,
    mapSeed: 42,
    mapConfig: {
      forestRatio: 0.45,
      grassRatio:  0.40,
      rockRatio:   0.05,
      waterBodies: [{ type:'river', axis:'y', pos:22, width:2 }],
      fireStarts: [[5, 5], [6, 7]],
    },
  },
  {
    id: 1,
    name: 'Mountain Ridge Blaze',
    subtitle: 'Moderate winds, rocky terrain',
    description: 'A wildfire is racing up the Creston Ridge. Dense forest, rock outcrops. Moderate SE winds fan the flames.',
    difficulty: 'MEDIUM',
    requiredDone: 1,
    baseReward: 3000,
    timeLimitSec: 300,
    startWind: { dir: 3, str: 2 }, // SE, Moderate
    waterSupply: 850,
    startBudget: 1600,
    startFF: 4,
    startHeli: 1,
    startPlane: 1,
    mapSeed: 137,
    mapConfig: {
      forestRatio: 0.55,
      grassRatio:  0.25,
      rockRatio:   0.12,
      waterBodies: [{ type:'lake', cx:22, cy:22, r:3 }],
      fireStarts: [[6, 3], [8, 5], [4, 7]],
    },
  },
  {
    id: 2,
    name: 'Valley Inferno',
    subtitle: 'Strong winds, multi-point fire',
    description: 'Two simultaneous ignitions in Ashvale Valley. Strong SW winds. Dense forest. This is your toughest test yet.',
    difficulty: 'HARD',
    requiredDone: 2,
    baseReward: 4800,
    timeLimitSec: 360,
    startWind: { dir: 5, str: 3 }, // SW, Strong
    waterSupply: 1100,
    startBudget: 2200,
    startFF: 5,
    startHeli: 2,
    startPlane: 1,
    mapSeed: 999,
    mapConfig: {
      forestRatio: 0.65,
      grassRatio:  0.22,
      rockRatio:   0.06,
      waterBodies: [
        { type:'river', axis:'x', pos:14, width:2 },
      ],
      fireStarts: [[4, 4], [5, 5], [24, 6], [25, 7], [25, 5]],
    },
  },
];

function getContract(id) {
  return CONTRACTS.find(c => c.id === id);
}
