/**
 * items.js — Item generation, ground pickups, comparison tooltip, and swap UI.
 */

import { rollSword as rollSwordItem, rollShield as rollShieldItem, rollDrop as rollDropEnemy } from "./enemies.js";

const TILE_SIZE = 32;
const PICKUP_RADIUS = 20; // auto-collect heart radius
const SWAP_RADIUS = 50;  // hover prompt radius

const ADJ_POOL = ["Mossy", "Sunlit", "Dappled", "Warden's", "Hearthstone", "Thorn", "Ember", "Frost", "Oak", "Mist"];
const SWORD_NOUNS = ["Shortblade", "Bough", "Sword", "Blade", "Thorn", "Scythe"];
const SHIELD_NOUNS = ["Bulwark", "Ward", "Aegis", "Bastion", "Wall", "Hearth"];

/**
 * Creates a ground item object.
 */
export function createGroundItem(item, x, y) {
  return {
    ...item,
    x, y,
    collected: false,
    bobOffset: 0, // sine wave bobbing
  };
}

/**
 * Generates starting items (3-5) around the map.
 * @param {number} count — 3-5
 * @param {object[]} enemySpawnArea — pre-computed spawn positions (avoiding spawn area)
 * @returns {object[]}
 */
export function generateStartingItems(count, enemySpawnArea) {
  const items = [];
  const shuffled = [...enemySpawnArea].sort(() => Math.random() - 0.5);

  for (let i = 0; i < count && i < shuffled.length; i++) {
    const pos = shuffled[i];
    const px = pos.x * TILE_SIZE + TILE_SIZE / 2;
    const py = pos.y * TILE_SIZE + TILE_SIZE / 2;

    // Randomly decide: heart or equipment
    const roll = Math.random();
    if (roll < 0.3) {
      items.push({ type: "heart", x: px, y: py, collected: false, bobOffset: 0 });
    } else if (roll < 0.65) {
      const data = rollSwordItem();
      items.push({ type: "sword", data, x: px, y: py, collected: false, bobOffset: 0 });
    } else {
      const data = rollShieldItem();
      items.push({ type: "shield", data, x: px, y: py, collected: false, bobOffset: 0 });
    }
  }

  return items;
}

/**
 * Generates a drop from enemy death.
 * @param {object} player — for equipment comparison
 * @param {number} x — pixel X position
 * @param {number} y — pixel Y position
 * @returns {object|null}
 */
export function generateDrop(player, x, y) {
  const { type, data } = rollDropEnemy();
  if (type === null) return null;

  if (type === "heart") {
    return { type: "heart", x, y, collected: false, bobOffset: 0 };
  }

  // Generate random equipment
  const item = type === "sword" ? rollSwordItem() : rollShieldItem();
  return { type, data: item, x, y, collected: false, bobOffset: 0 };
}

/**
 * Checks if a ground item is within pickup range of the player.
 * Auto-collects hearts.
 * @returns {object|null} — collected item, or null
 */
export function checkPickup(player, groundItems) {
  for (const item of groundItems) {
    if (item.collected) continue;
    const dx = player.x - item.x;
    const dy = player.y - item.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < PICKUP_RADIUS) {
      item.collected = true;
      if (item.type === "heart") {
        player.hp = Math.min(player.maxHp, player.hp + 0.5);
      }
      return item;
    }
  }
  return null;
}

/**
 * Finds the ground item the player is hovering near.
 * Returns { item, dist, screenX, screenY } or null.
 */
export function getHoveredItem(player, groundItems, camera, mouseX, mouseY) {
  // Get screen position of each item
  let best = null;
  let bestDist = Infinity;

  for (const item of groundItems) {
    if (item.collected) continue;

    // Item screen position (world pos minus camera offset)
    const itemScreenX = item.x - camera.x;
    const itemScreenY = item.y - camera.y + Math.sin(Date.now() / 600) * 2; // include bob animation

    const dx = mouseX - itemScreenX;
    const dy = mouseY - itemScreenY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 30 && dist < bestDist) {
      best = { item, dist, screenX: itemScreenX, screenY: itemScreenY };
      bestDist = dist;
    }
  }

  return best;
}

/**
 * Swaps equipped item with ground item.
 * Drops the old equipped item at the ground item's position.
 * @returns {object} the dropped item (for re-displaying tooltip)
 */
export function swapItem(player, groundItem) {
  let dropped = null;

  if (groundItem.type === "sword") {
    dropped = createGroundItem(player.sword, groundItem.x, groundItem.y);
    player.sword = { ...groundItem.data };
  } else if (groundItem.type === "shield") {
    dropped = createGroundItem(player.shield, groundItem.x, groundItem.y);
    player.shield = { ...groundItem.data };
  }

  groundItem.collected = true;
  return dropped;
}

/**
 * Stat comparison: returns -1 (worse), 0 (equal), 1 (better)
 * Higher is better for damage, range, crit, lifesteal, pushback, blockArc, maxStamina, staminaRegen, procChance
 * Lower is better for cooldown, postBreakCooldown
 */
export function compareStat(stat, groundValue, equippedValue) {
  const lowerIsBetter = ["cooldown", "postBreakCooldown"].includes(stat);
  let diff = groundValue - equippedValue;
  if (lowerIsBetter) diff = equippedValue - groundValue;
  return diff > 0.1 ? 1 : diff < -0.1 ? -1 : 0;
}

/**
 * Returns stat labels for display.
 */
export function getStatLabel(stat) {
  const labels = {
    damage: "Damage",
    range: "Range",
    cooldown: "Cooldown",
    pushback: "Pushback",
    critChance: "Crit %",
    lifesteal: "Lifesteal %",
    blockArc: "Block Arc",
    maxStamina: "Max Stamina",
    staminaRegen: "Stamina Regen",
    procChance: "Proc Chance",
    postBreakCooldown: "Break Cooldown",
  };
  return labels[stat] || stat;
}

/**
 * Returns the list of stats for an item (including defaults for unrolled affixes).
 */
export function getItemStats(item) {
  if (item.type === "sword") {
    return {
      damage: item.data.damage,
      range: item.data.range,
      cooldown: item.data.cooldown,
      pushback: item.data.pushback,
      critChance: item.data.critChance,
      lifesteal: item.data.lifesteal,
    };
  }
  return {
    blockArc: item.data.blockArc,
    maxStamina: item.data.maxStamina,
    staminaRegen: item.data.staminaRegen,
    procChance: item.data.procChance,
    postBreakCooldown: item.data.postBreakCooldown,
    onBlockEffect: item.data.onBlockEffect,
  };
}

/**
 * Gets stat comparison data for a ground item vs equipped item.
 * Used by ui.js for the tooltip.
 */
export function getItemComparisonStats(item, player) {
  if (item.type === "sword") {
    const ground = item.data;
    const equipped = player.sword;
    return [
      { label: "DMG", ground: ground.damage, equipped: equipped.damage, diff: compareStat("damage", ground.damage, equipped.damage) },
      { label: "Range", ground: ground.range, equipped: equipped.range, diff: compareStat("range", ground.range, equipped.range) },
      { label: "Cooldown", ground: ground.cooldown, equipped: equipped.cooldown, diff: compareStat("cooldown", ground.cooldown, equipped.cooldown) },
      { label: "Pushback", ground: ground.pushback, equipped: equipped.pushback, diff: compareStat("pushback", ground.pushback, equipped.pushback) },
      { label: "Crit%", ground: ground.critChance, equipped: equipped.critChance, diff: compareStat("critChance", ground.critChance, equipped.critChance) },
      { label: "Lifesteal%", ground: ground.lifesteal, equipped: equipped.lifesteal, diff: compareStat("lifesteal", ground.lifesteal, equipped.lifesteal) },
    ];
  } else if (item.type === "shield") {
    const ground = item.data;
    const equipped = player.shield;
    return [
      { label: "Block Arc", ground: ground.blockArc, equipped: equipped.blockArc, diff: compareStat("blockArc", ground.blockArc, equipped.blockArc) },
      { label: "Stamina", ground: ground.maxStamina, equipped: equipped.maxStamina, diff: compareStat("maxStamina", ground.maxStamina, equipped.maxStamina) },
      { label: "Regen", ground: ground.staminaRegen, equipped: equipped.staminaRegen, diff: compareStat("staminaRegen", ground.staminaRegen, equipped.staminaRegen) },
      { label: "Proc%", ground: ground.procChance, equipped: equipped.procChance, diff: compareStat("procChance", ground.procChance, equipped.procChance) },
      { label: "Break CD", ground: ground.postBreakCooldown, equipped: equipped.postBreakCooldown, diff: compareStat("postBreakCooldown", ground.postBreakCooldown, equipped.postBreakCooldown) },
    ];
  }
  return [];
}


