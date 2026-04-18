// ============================================================
// UPGRADE SYSTEM
// ============================================================

const UPGRADE_DEFS = [
  {
    id: 'heli_capacity',
    name: 'Heli Water Tank',
    desc: 'Reduces helicopter water cost by 15 per drop.',
    category: 'helicopter',
    maxLevel: 3,
    costs: [600, 1000, 1600],
    apply: function (player) {
      // Applied in game.js when computing water costs
    },
  },
  {
    id: 'heli_cooldown',
    name: 'Heli Response',
    desc: 'Reduces helicopter cooldown by 3 seconds per level.',
    category: 'helicopter',
    maxLevel: 2,
    costs: [700, 1200],
  },
  {
    id: 'plane_area',
    name: 'Bomber Load',
    desc: 'Increases plane drop line by 2 tiles per level.',
    category: 'plane',
    maxLevel: 2,
    costs: [900, 1500],
  },
  {
    id: 'ff_armor',
    name: 'FF Protective Gear',
    desc: 'Reduces firefighter risk damage by 8 per level.',
    category: 'firefighter',
    maxLevel: 3,
    costs: [500, 900, 1400],
  },
  {
    id: 'ff_speed',
    name: 'FF Mobility',
    desc: 'Increases firefighter movement speed by 25% per level.',
    category: 'firefighter',
    maxLevel: 2,
    costs: [400, 800],
  },
  {
    id: 'ff_suppression',
    name: 'FF Equipment',
    desc: 'Increases firefighter suppression rate by 30% per level.',
    category: 'firefighter',
    maxLevel: 2,
    costs: [500, 950],
  },
];

function getUpgradeDefs() { return UPGRADE_DEFS; }

function getUpgradeLevel(player, id) {
  return (player.upgrades && player.upgrades[id]) || 0;
}

function canUpgrade(player, id) {
  const def = UPGRADE_DEFS.find(u => u.id === id);
  if (!def) return false;
  const level = getUpgradeLevel(player, id);
  if (level >= def.maxLevel) return false;
  return player.budget >= def.costs[level];
}

function purchaseUpgrade(player, id) {
  if (!canUpgrade(player, id)) return false;
  const def = UPGRADE_DEFS.find(u => u.id === id);
  const level = getUpgradeLevel(player, id);
  player.budget -= def.costs[level];
  if (!player.upgrades) player.upgrades = {};
  player.upgrades[id] = level + 1;
  return true;
}

// Compute effective values based on upgrades
function getHeliWaterCost(player) {
  const lvl = getUpgradeLevel(player, 'heli_capacity');
  return Math.max(20, HELI_WATER_COST - lvl * 15);
}

function getHeliCooldown(player) {
  const lvl = getUpgradeLevel(player, 'heli_cooldown');
  return HELI_COOLDOWN_MS - lvl * 3000;
}

function getPlaneLine(player) {
  const lvl = getUpgradeLevel(player, 'plane_area');
  return PLANE_LINE + lvl * 2;
}

function getFFRiskDamage(player) {
  const lvl = getUpgradeLevel(player, 'ff_armor');
  return Math.max(5, RISK_DMG - lvl * 8);
}

function getFFMoveTicks(player) {
  const lvl = getUpgradeLevel(player, 'ff_speed');
  return Math.round(FF_MOVE_TICKS / (1 + lvl * 0.25));
}

function getFFSuppRate(player) {
  const lvl = getUpgradeLevel(player, 'ff_suppression');
  return FF_SUPP_RATE * (1 + lvl * 0.30);
}
