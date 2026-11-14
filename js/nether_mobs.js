'use strict';
// ---------------------------------------------------------------------------
// Mobs of the vanilla (gen-2) Nether: piglins (with bartering), hoglins and striders, golden armour,
// and biome-driven Nether spawning from the biome JSON "spawners".
// ---------------------------------------------------------------------------
Object.assign(MOB_TYPES, {
  piglin: { cn: '猪灵', hp: 16, w: 0.6, h: 1.95, speed: 0.35, model: 'zombified_piglin', tex: 'piglin', hostile: true, neutral: true, attack: 5, drops: [], scale: 0.9375 },
  hoglin: { cn: '疣猪兽', hp: 40, w: 1.3965, h: 1.4, speed: 0.3, model: 'hoglin', hostile: true, attack: 6, drops: [['porkchop', 2, 4, 'cooked_porkchop'], ['leather', 0, 1]], scale: 1 },
  strider: { cn: '炽足兽', hp: 20, w: 0.9, h: 1.7, speed: 0.175, model: 'strider', passive: true, fireproof: true, drops: [['string', 2, 5]], scale: 1 },
});
(() => {
  const prev = createMob;
  createMob = function (game, type, x, y, z) {
    if (type === 'piglin') return new Piglin(game, x, y, z);
    if (type === 'hoglin') return new Hoglin(game, x, y, z);
    if (type === 'strider') return new Strider(game, x, y, z);
    return prev(game, type, x, y, z);
  };
})();

const wearsGold = (p) => p.inv.slots.slice(36, 40).some(s => s && ITEMS[s.id].key.startsWith('golden_'));

// ---- Piglin ---------------------------------------------------------------------------------
// neutral while the player wears any golden armour; takes gold ingots (thrown or handed over),
// admires them for 6 s and throws back a bartering item
const BARTER = [['iron_boots', 8, 1, 1], ['ender_pearl', 10, 2, 4], ['string', 20, 3, 9], ['quartz', 20, 5, 12], ['obsidian', 40, 1, 1],
  ['crying_obsidian', 40, 1, 3], ['fire_charge', 40, 1, 1], ['leather', 40, 2, 4], ['soul_sand', 40, 2, 8], ['nether_brick', 40, 2, 8],
  ['arrow', 40, 6, 12], ['gravel', 40, 8, 16], ['blackstone', 40, 8, 16], ['iron_nugget', 10, 10, 36]];
class Piglin extends Mob {
  constructor(g, x, y, z) { super(g, 'piglin', x, y, z); this.angry = 0; this.admire = 0; this.persistent = false; }
  hurt(a, src) {
    const r = super.hurt(a, src);
    if (r && src && src.attacker) {
      for (const e of this.game.entities) if (e instanceof Piglin && e.distTo(this) < 16) { e.angry = 600; e.target = src.attacker; e.admire = 0; }
      Sound.ev('entity.piglin.angry', this.pos, 1, 1);
    }
    return r;
  }
  give(stack) { // a gold ingot handed over or picked up
    if (this.admire > 0 || this.angry > 0) return false;
    this.admire = 120; this.target = null; this.holding = item('gold_ingot');
    Sound.ev('entity.piglin.admiring_item', this.pos, 1, 1);
    return true;
  }
  barter() {
    const L = BARTER.filter(b => ITEM_KEY[b[0]] !== undefined), tot = L.reduce((a, b) => a + b[1], 0);
    let r = Math.random() * tot;
    for (const [k, w, a, b] of L) {
      if ((r -= w) >= 0) continue;
      const g = this.game, dir = Math.atan2(g.player.pos[0] - this.pos[0], g.player.pos[2] - this.pos[2]);
      g.dropItem(this.pos[0], this.pos[1] + 1.2, this.pos[2], makeStack(k, a + Math.floor(Math.random() * (b - a + 1))), [Math.sin(dir) * 0.2, 0.25, Math.cos(dir) * 0.2]);
      return;
    }
  }
  tick() {
    const g = this.game, p = g.player;
    if (this.admire > 0) {
      this.savePrev(); this.baseTick();
      if (this.deathTick()) return;
      if (--this.admire === 0) { this.holding = null; this.barter(); }
      this.headYaw *= 0.8; this.pitch = 0.5;
      this.travel(0, 0, 0, false); this.animate();
      return;
    }
    // pick up gold ingots lying nearby
    if (this.age % 10 === 0) for (const e of g.entities) {
      if (!(e instanceof ItemEntity) || e.dead || e.stack.id !== ITEM_KEY.gold_ingot || e.distTo(this) > 8) continue;
      if (e.distTo(this) < 1.5) { if (this.give(e.stack)) { if (--e.stack.count <= 0) e.dead = true; } }
      else this.wander = [e.pos[0], e.pos[1], e.pos[2]], this.wanderT = 40;
      break;
    }
    // hostile unless the player shows gold (or after being provoked)
    const calm = wearsGold(p) && this.angry <= 0;
    if (this.angry > 0) this.angry--;
    this.T = calm ? PIGLIN_CALM : MOB_TYPES.piglin;
    if (calm && this.target === p) this.target = null;
    super.tick();
    this.T = MOB_TYPES.piglin;
  }
  pose(a) {
    const P = super.pose(a);
    const swing = lerp(this.limbSwing - this.limbAmt, this.limbSwing, a) * 0.6662, amt = this.limbAmt;
    P.rarm = { rx: Math.cos(swing + Math.PI) * 1.4 * amt * 0.5 + (this.swingT > 0 ? Math.sin(this.swingT / 6 * Math.PI) : 0) };
    P.larm = { rx: this.admire > 0 ? 1.2 : Math.cos(swing) * 1.4 * amt * 0.5 };
    P.rleg = { rx: Math.cos(swing) * 1.4 * amt }; P.lleg = { rx: Math.cos(swing + Math.PI) * 1.4 * amt };
    return P;
  }
}
const PIGLIN_CALM = Object.assign({}, MOB_TYPES.piglin, { hostile: false });

// ---- Hoglin ---------------------------------------------------------------------------------
class Hoglin extends Mob {
  constructor(g, x, y, z) { super(g, 'hoglin', x, y, z); this.persistent = false; }
  tick() {
    const g = this.game, before = this.attackCd;
    // hoglins avoid warped fungus
    if (this.age % 20 === 0) {
      const bx = Math.floor(this.pos[0]), by = Math.floor(this.pos[1]), bz = Math.floor(this.pos[2]);
      for (let dx = -6; dx <= 6 && !this.fleeing; dx += 2) for (let dz = -6; dz <= 6; dz += 2) if (this.world.getBlock(bx + dx, by, bz + dz) === BID.warped_fungus) { this.panic = 60; this.target = null; this.fleeing = true; break; }
      this.fleeing = false;
    }
    super.tick();
    // vanilla hoglin attack: random 3..8 damage (from the base attack) and a strong upward knockback
    if (this.attackCd === 20 && before !== 20 && this.target) {
      const t = this.target, dx = t.pos[0] - this.pos[0], dz = t.pos[2] - this.pos[2], d = Math.hypot(dx, dz) || 1;
      t.vel[0] += dx / d * 0.6; t.vel[2] += dz / d * 0.6; t.vel[1] = Math.max(t.vel[1], 0.55);
      Sound.ev('entity.hoglin.attack', this.pos, 1, 1);
    }
  }
  pose(a) {
    const swing = lerp(this.limbSwing - this.limbAmt, this.limbSwing, a) * 0.6662, amt = this.limbAmt;
    const l = Math.cos(swing) * 1.2 * amt, r = Math.cos(swing + Math.PI) * 1.2 * amt;
    const attack = this.swingT > 0 ? Math.sin(this.swingT / 6 * Math.PI) * 0.6 : 0;
    return { head: { ry: this.headYaw, rx: -attack }, leg0: { rx: l }, leg1: { rx: r }, leg2: { rx: r }, leg3: { rx: l } };
  }
}

// ---- Strider ---------------------------------------------------------------------------------
// walks on lava (it stands on the surface like on a floor) and shivers on land
class Strider extends Mob {
  constructor(g, x, y, z) { super(g, 'strider', x, y, z); this.warm = true; this.persistent = true; }
  lavaBelow() { return this.world.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1] - 0.1), Math.floor(this.pos[2])) === LAVA || this.world.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1]), Math.floor(this.pos[2])) === LAVA; }
  tick() {
    const w = this.world, x = Math.floor(this.pos[0]), z = Math.floor(this.pos[2]);
    // float up to the lava surface and stand on it
    let iy = Math.floor(this.pos[1]);
    if (w.getBlock(x, iy, z) === LAVA) {
      while (w.getBlock(x, iy + 1, z) === LAVA) iy++;
      if (this.pos[1] < iy + 1) { this.vel[1] = Math.min(0.15, iy + 1 - this.pos[1]); this.fallDist = 0; }
    }
    const onLava = w.getBlock(x, Math.floor(this.pos[1] - 0.05), z) === LAVA && w.getBlock(x, Math.floor(this.pos[1] + 0.2), z) !== LAVA;
    if (onLava) { this.pos[1] = Math.floor(this.pos[1] - 0.05) + 1; this.vel[1] = Math.max(0, this.vel[1]); this.onGround = true; this.fallDist = 0; }
    this.warm = this.lavaBelow() || onLava;
    super.tick();
    this.fire = 0;
    if (onLava && this.vel[1] < 0) this.vel[1] = 0;
  }
  pose(a) {
    const swing = lerp(this.limbSwing - this.limbAmt, this.limbSwing, a) * 1.5, amt = Math.min(1, this.limbAmt * 2);
    const t = this.age + a, shiver = this.warm ? 0 : Math.sin(t * 2) * 0.05;
    const P = { rleg: { rx: Math.sin(swing) * 2 * amt }, lleg: { rx: Math.sin(swing + Math.PI) * 2 * amt }, body: { rz: shiver, t: [0, Math.abs(Math.sin(swing)) * 0.1 * amt, 0] } };
    const wave = Math.sin(t * 0.25) * 0.1;
    P.rb0 = { rz: wave }; P.rb1 = { rz: wave * 0.8 }; P.rb2 = { rz: wave * 0.6 }; P.lb0 = { rz: -wave }; P.lb1 = { rz: -wave * 0.8 }; P.lb2 = { rz: -wave * 0.6 };
    return P;
  }
}

// ---- models (converted from the vanilla Java models: y up, x mirrored) ------------------------------------
(() => {
  const proto = Renderer.prototype.initModels2;
  Renderer.prototype.initModels2 = function () {
    proto.call(this);
    const M = this.models;
    const P = (tw, th, parts) => { for (const p of parts) p.mesh = this.makeModelPart(p.boxes, tw, th); return { parts }; };
    M.hoglin = P(128, 64, [
      { name: 'body', pivot: [0, 17, 0], boxes: [[1, 1, -8, -7, -13, 16, 14, 26]] },
      { name: 'mane', parent: 'body', pivot: [0, 14, -7], boxes: [[90, 33, 0, -10, -9, 0, 10, 19, 0.001]] },
      { name: 'head', pivot: [0, 22, -12], rotX: -0.87266463, boxes: [[61, 1, -7, -3, -19, 14, 6, 19]] },
      { name: 'rear', parent: 'head', pivot: [6, 2, -3], rotZ: -0.6981317, boxes: [[1, 1, 0, 0, -2, 6, 1, 4]] },
      { name: 'lear', parent: 'head', pivot: [-6, 2, -3], rotZ: 0.6981317, boxes: [[1, 6, -6, 0, -2, 6, 1, 4]] },
      { name: 'rhorn', parent: 'head', pivot: [7, -2, -12], boxes: [[10, 13, -1, 0, -1, 2, 11, 2]] },
      { name: 'lhorn', parent: 'head', pivot: [-7, -2, -12], boxes: [[1, 13, -1, 0, -1, 2, 11, 2]] },
      { name: 'leg0', pivot: [4, 14, -8.5], boxes: [[66, 42, -3, -14, -3, 6, 14, 6]] },
      { name: 'leg1', pivot: [-4, 14, -8.5], boxes: [[41, 42, -3, -14, -3, 6, 14, 6]] },
      { name: 'leg2', pivot: [5, 11, 10], boxes: [[21, 45, -2.5, -11, -2.5, 5, 11, 5]] },
      { name: 'leg3', pivot: [-5, 11, 10], boxes: [[0, 45, -2.5, -11, -2.5, 5, 11, 5]] },
    ]);
    M.strider = P(64, 128, [
      { name: 'rleg', pivot: [4, 16, 0], boxes: [[0, 32, -2, -16, -2, 4, 16, 4]] },
      { name: 'lleg', pivot: [-4, 16, 0], boxes: [[0, 55, -2, -16, -2, 4, 16, 4]] },
      { name: 'body', pivot: [0, 23, 0], boxes: [[0, 0, -8, -8, -8, 16, 14, 16]] },
      { name: 'rb0', parent: 'body', pivot: [8, -4, -8], rotZ: -1.2217305, boxes: [[16, 65, 0, 0, 0, 12, 0, 16, 0, true]] },
      { name: 'rb1', parent: 'body', pivot: [8, 1, -8], rotZ: -1.134464, boxes: [[16, 49, 0, 0, 0, 12, 0, 16, 0, true]] },
      { name: 'rb2', parent: 'body', pivot: [8, 5, -8], rotZ: -0.87266463, boxes: [[16, 33, 0, 0, 0, 12, 0, 16, 0, true]] },
      { name: 'lb2', parent: 'body', pivot: [-8, 6, -8], rotZ: 0.87266463, boxes: [[16, 33, -12, 0, 0, 12, 0, 16]] },
      { name: 'lb1', parent: 'body', pivot: [-8, 2, -8], rotZ: 1.134464, boxes: [[16, 49, -12, 0, 0, 12, 0, 16]] },
      { name: 'lb0', parent: 'body', pivot: [-8, -3, -8], rotZ: 1.2217305, boxes: [[16, 65, -12, 0, 0, 12, 0, 16]] },
    ]);
  };
})();

// ---- golden armour ------------------------------------------------------------------------------------
['helmet', 'chestplate', 'leggings', 'boots'].forEach((p, i) => {
  // (mat: what draws it - without it golden armour was worn but never shown, on anyone)
  defItem('golden_' + p, '金' + ['头盔', '胸甲', '护腿', '靴子'][i], { stack: 1, durability: [77, 112, 105, 91][i], armor: { slot: i, points: [2, 5, 3, 1][i], tough: 0, mat: 'golden' } });
});
shaped('golden_helmet', 1, ['XXX', 'X X'], { X: 'gold_ingot' });
shaped('golden_chestplate', 1, ['X X', 'XXX', 'XXX'], { X: 'gold_ingot' });
shaped('golden_leggings', 1, ['XXX', 'X X', 'X X'], { X: 'gold_ingot' });
shaped('golden_boots', 1, ['X X', 'X X'], { X: 'gold_ingot' });
for (const [m, cn] of [['piglin', '猪灵'], ['hoglin', '疣猪兽'], ['strider', '炽足兽']]) defItem(m + '_spawn_egg', cn + '刷怪蛋', { spawnEgg: m });

// ---- spawning in the vanilla Nether: biome "spawners" lists ---------------------------------------
// the fortress (from the generator's structure references) whose box holds this column, or null
Game.prototype.fortressAt = function (x, z) {
  const refs = this.world.structRefs;
  if (!refs) return null;
  for (const s of refs.values()) if (s.name === 'fortress' && x >= s.box[0] && x <= s.box[3] && z >= s.box[2] && z <= s.box[5]) return s;
  return null;
};
// one group from the fortress's spawn list, on a nether-brick floor of this column with room above; false if there is none
Game.prototype.spawnFortressGroup = function (fort, x, z) {
  const w = this.world, def = self.STRUCT_DATA && STRUCT_DATA.structure.fortress, list = def && def.spawn_overrides && def.spawn_overrides.monster;
  if (!list) return false;
  const spawns = list.spawns.filter(s => MOB_TYPES[s.type.replace('minecraft:', '')]);
  for (let y = Math.max(1, fort.box[1]); y <= fort.box[4]; y++) {
    if (w.getBlock(x, y - 1, z) !== BID.nether_bricks || w.getBlock(x, y, z) !== 0 || w.getBlock(x, y + 1, z) !== 0) continue;
    if ((w.getLight(x, y, z) & 15) > 11) continue;
    let r = Math.random() * spawns.reduce((t, s) => t + s.weight, 0), pick = spawns[0];
    for (const s of spawns) { if ((r -= s.weight) < 0) { pick = s; break; } }
    const type = pick.type.replace('minecraft:', ''), n = pick.minCount + Math.floor(Math.random() * (pick.maxCount - pick.minCount + 1));
    // wither skeletons are 2.4 tall: a third block of room
    if (type === 'wither_skeleton' && w.getBlock(x, y + 2, z) !== 0) continue;
    for (let i = 0; i < n; i++) {
      const m = createMob(this, type, x + 0.5 + (Math.random() - 0.5) * 2, y, z + 0.5 + (Math.random() - 0.5) * 2);
      if (!m.collides(m.box())) this.entities.push(m);
    }
    return true;
  }
  return false;
};
Game.prototype.spawnNetherV = function () {
  const p = this.player, w = this.world;
  if (this.difficulty === 0) return;
  const counts = {}; for (const e of this.entities) if (e instanceof Mob) counts[e.T.passive ? 'creature' : 'monster'] = (counts[e.T.passive ? 'creature' : 'monster'] || 0) + 1;
  for (let attempt = 0; attempt < 3; attempt++) {
    const a = Math.random() * Math.PI * 2, d = 24 + Math.random() * 40;
    const x = Math.floor(p.pos[0] + Math.sin(a) * d), z = Math.floor(p.pos[2] + Math.cos(a) * d);
    if (!w.isLoaded(x, z)) continue;
    const v = this.vbiomeAt(x, z);
    if (!v || !v.def.spawners) continue;
    // inside a nether fortress, standing on its nether-brick floors, the fortress's own list replaces the biome's
    // (vanilla spawn_overrides, bounding box "piece"): blazes, wither skeletons, skeletons, magma cubes, piglins
    const fort = (counts.monster || 0) < 30 && this.fortressAt(x, z);
    if (fort && this.spawnFortressGroup(fort, x, z)) return;
    const cat = Math.random() < 0.1 ? 'creature' : 'monster';
    if ((counts[cat] || 0) >= (cat === 'monster' ? 30 : 8)) continue;
    const list = (v.def.spawners[cat] || []).filter(s => MOB_TYPES[s.type.replace('minecraft:', '')]);
    if (!list.length) continue;
    const tot = list.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * tot, pick = list[0];
    for (const e of list) { if ((r -= e.weight) < 0) { pick = e; break; } }
    const type = pick.type.replace('minecraft:', '');
    // a random y with floor below and room for the mob (striders: on the lava surface)
    for (let k = 0; k < 8; k++) {
      const y = 8 + Math.floor(Math.random() * 110);
      const below = w.getBlock(x, y - 1, z), here = w.getBlock(x, y, z);
      const ok = type === 'strider' ? below === LAVA && here === 0 : (BLOCKS[below] && BLOCKS[below].solid && here === 0 && w.getBlock(x, y + 1, z) === 0);
      if (!ok || (w.getLight(x, y, z) & 15) > 11 && type !== 'strider' && type !== 'ghast') continue;
      const n = pick.minCount + Math.floor(Math.random() * (pick.maxCount - pick.minCount + 1));
      for (let i = 0; i < n; i++) {
        const m = createMob(this, type, x + 0.5 + (Math.random() - 0.5) * 2, y, z + 0.5 + (Math.random() - 0.5) * 2);
        if (type === 'ghast') m.pos[1] += 4;
        if (!m.collides(m.box())) this.entities.push(m);
      }
      return;
    }
  }
};
