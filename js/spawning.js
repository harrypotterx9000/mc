'use strict';
// ---------------------------------------------------------------------------
// Natural spawning in the overworld from each vanilla biome's spawn lists (worldgen data "spawners"): mob
// categories with their caps (monster, creature, ambient, water creature, water ambient, underground water
// creature, axolotls), vanilla's light rules, pack sizes; plus the wandering trader, phantoms and patrols.
// ---------------------------------------------------------------------------
const SPAWN_CAPS = { monster: 70, creature: 10, ambient: 15, water_creature: 5, water_ambient: 20, underground_water_creature: 5, axolotls: 5 };
const SPAWN_GROUND = {
  mooshroom: /^mycelium$/, polar_bear: /snow|ice/, goat: /stone|snow|gravel|calcite|packed_ice/, rabbit: /grass_block|snow|sand/, turtle: /sand$/,
  frog: /mud|grass_block|mangrove_roots/, armadillo: /grass_block|red_sand|coarse_dirt|terracotta/, camel: /sand$/, parrot: /grass_block|leaves|log/, ocelot: /grass_block|leaves/,
  fox: /grass_block|snow|podzol|coarse_dirt/, wolf: /grass_block|snow|podzol|coarse_dirt/, panda: /grass_block|podzol|bamboo/, llama: /grass_block|stone|snow/, sniffer: /grass_block/,
};
function spawnCatOf(e) { return e.T ? (e.T.cat || (e.T.hostile ? 'monster' : 'creature')) : null; }
// vanilla leaves only the mobs that must be kept (named, leashed, ridden, from a bucket) out of the counts;
// animals never despawn but still fill their category's cap (`persistent` here only means "never despawns")
function spawnMustKeep(e) { return !!(e.customName || e.leashHolder || e.rider || e.fromBucket || e.remote); }
const _oldSpawnMobs = Game.prototype.spawnMobs;
Game.prototype.spawnMobs = function () {
  const p = this.player, w = this.world;
  // worlds from the older generator have no vanilla biome data: their own spawning
  const v0 = this.vbiomeAt && this.vbiomeAt(Math.floor(p.pos[0]), Math.floor(p.pos[2]));
  if (!v0 || !v0.def || !v0.def.spawners) return _oldSpawnMobs.call(this);
  // occasional ones
  if (this.tickCount % 24000 === 1200 && this.trySpawnTrader) this.trySpawnTrader();
  if (this.tickCount % 1200 === 0 && this.trySpawnPhantoms) this.trySpawnPhantoms();
  const counts = {};
  for (const e of this.entities) { if (!(e instanceof Mob) || e.dead || spawnMustKeep(e)) continue; if (Math.hypot(e.pos[0] - p.pos[0], e.pos[2] - p.pos[2]) > 128) continue; const c = spawnCatOf(e); counts[c] = (counts[c] || 0) + 1; }
  const day = this.daylight();
  // vanilla scales each cap by the chunks loaded around the players (cap * chunks / 289, a 17x17 square): a phone's
  // short view distance kept the whole 70 monsters in a far smaller area - "怪太多了", feedback 2026-11-01/02
  const rd = Math.max(2, Math.min(16, (this.settings && this.settings.renderDist) || 8)), area = Math.min(1, (2 * rd + 1) * (2 * rd + 1) / 289);
  for (const cat in SPAWN_CAPS) {
    if ((counts[cat] || 0) >= Math.max(cat === 'monster' ? 15 : 3, Math.round(SPAWN_CAPS[cat] * area))) continue;
    if (cat === 'monster' && this.difficulty === 0) continue;
    // animals spawn rarely (vanilla: mostly with new chunks, then every 400 ticks)
    if (cat === 'creature' && Math.random() > 0.05) continue;
    for (let attempt = 0; attempt < (cat === 'monster' ? 3 : 1); attempt++) {
      const a = Math.random() * Math.PI * 2, d = 24 + Math.random() * 56;
      const x = Math.floor(p.pos[0] + Math.sin(a) * d), z = Math.floor(p.pos[2] + Math.cos(a) * d);
      if (!w.isLoaded(x, z)) continue;
      const v = this.vbiomeAt(x, z);
      const list = v && v.def && v.def.spawners && v.def.spawners[cat];
      if (!list || !list.length) continue;
      const ok = list.filter(s => MOB_TYPES[s.type.replace('minecraft:', '')]);
      if (!ok.length) continue;
      let tot = 0; for (const s of ok) tot += s.weight;
      let r = Math.random() * tot, pick = ok[0];
      for (const s of ok) { if ((r -= s.weight) < 0) { pick = s; break; } }
      const type = pick.type.replace('minecraft:', '');
      const y = this.spawnY(cat, type, x, z, day);
      if (y == null) continue;
      const n = pick.minCount + Math.floor(Math.random() * (pick.maxCount - pick.minCount + 1));
      for (let i = 0; i < n; i++) {
        const sx = x + (i ? randInt(-3, 3) : 0), sz = z + (i ? randInt(-3, 3) : 0), sy = i ? this.spawnY(cat, type, sx, sz, day, y) : y;
        if (sy == null) continue;
        const m = createMob(this, type, sx + 0.5, sy, sz + 0.5);
        if (cat !== 'creature') m.persistent = false;
        if (cat === 'creature' && Math.random() < 0.1 && m.makeBaby && !m.T.hostile) m.makeBaby();
        if (!m.collides(m.box())) this.entities.push(m);
      }
      break;
    }
  }
};
// a y to spawn at in this column for a category, or null (the light and block rules)
Game.prototype.spawnY = function (cat, type, x, z, day, near) {
  const w = this.world, surf = w.surfaceY(x, z);
  // (not a cell with water: kelp and seagrass are neither solid nor a fluid, so monsters spawned on the dark sea floor
  // among them and swam up - "白天海上刷怪", feedback 2026-11-01/02)
  const air = (y) => { const id = w.getBlock(x, y, z); return id === 0 || (!BLOCKS[id].solid && !IS_FLUID[id] && !WLOG[id] && !w.isWaterlogged(x, y, z)); };
  const water = (y) => { const id = w.getBlock(x, y, z); return id === WATER || !!WLOG[id]; };
  const ys = near != null ? [near, near + 1, near - 1, near + 2, near - 2] : null;
  if (cat === 'water_creature' || cat === 'water_ambient' || cat === 'underground_water_creature' || cat === 'axolotls') {
    const deep = cat === 'underground_water_creature' || cat === 'axolotls';
    const py = Math.floor(this.player.pos[1]), cand = ys || (deep ? [randInt(Math.max(-60, py - 48), Math.min(30, py + 24))] : [surf - randInt(0, 8), surf + 1 - randInt(1, 4)]);
    for (const y of cand) if (water(y) && water(y + 1) && (!deep || (w.getLight(x, y, z) >> 4) === 0)) return y;
    return null;
  }
  if (cat === 'ambient') {
    const py = Math.floor(this.player.pos[1]), y = ys ? ys[0] : randInt(Math.max(-60, py - 48), Math.min(62, surf - 4, py + 24));
    if (!air(y) || !air(y + 1) || w.getLight(x, y, z) & 15 || (w.getLight(x, y, z) >> 4) > 3) return null;
    return y;
  }
  // monsters and creatures: on a solid block with room above
  const cand = ys || (cat === 'creature' || Math.random() < 0.4 ? [surf + 1] : [randInt(Math.max(-60, Math.floor(this.player.pos[1]) - 48), surf)]);
  for (const y0 of cand) {
    let y = y0;
    if (near == null && cat === 'monster' && !air(y)) { for (let k = 0; k < 12 && !air(y); k++) y++; }
    const below = w.getBlock(x, y - 1, z);
    if (!SOLIDCUBE[below] || !air(y) || !air(y + 1)) continue;
    const bk = BLOCKS[below].key;
    if (bk === 'bedrock' || bk === 'barrier' || bk === 'magma_block' && !MOB_TYPES[type].fireproof) continue;
    const l = w.getLight(x, y, z), sky = Math.round((l >> 4) * day), blk = l & 15;
    if (cat === 'monster') {
      // vanilla: no block light at all, sky light below a random 0..7 (slimes and drowned have rules of their own)
      if (blk > 0 || sky > Math.floor(Math.random() * 8)) continue;
      if (type === 'drowned' && !water(y)) continue;
      if (type === 'slime' && y > 40 && !/swamp/.test(biomeName(this, x, z))) continue;
    } else {
      if ((l >> 4) < 9 && blk < 9) continue;
      const g2 = SPAWN_GROUND[type];
      if (g2 ? !g2.test(bk) : bk !== 'grass_block') continue;
    }
    return y;
  }
  return null;
};
// the spawn lists know about the mobs of 26.2; the old hostile list stays as the fallback without biome data
// Worlds saved before the counts above were fixed can hold hundreds of plain animals spawned while idling.
// Once per dimension: in each 128x128 area keep at most 40 of them (named, owned, tamed, saddled or bucket
// mobs are always kept).
const SPAWN_CLEAN_MAX = 40;
const _loadDimDataSpawn = Game.prototype.loadDimData;
Game.prototype.loadDimData = async function (dim) {
  const had = !!this.dimData[dim], d = await _loadDimDataSpawn.call(this, dim);
  const md = this.worldMeta && this.worldMeta.dims && this.worldMeta.dims[dim];
  const fixed = this.worldMeta && (this.worldMeta.capFix || (this.worldMeta.capFix = {}));
  if (had || !md || !fixed || fixed[dim]) return d;
  fixed[dim] = 1;
  const cells = new Map(), drop = new Set();
  for (const m of d.pendingMobs) {
    const T = MOB_TYPES[m.type], x = m.x || {};
    if (!T || T.cat !== 'creature' || x.name || x.own || x.tame || x.trust || x.fb || x.sad || x.sit) continue;
    const k = Math.floor(m.pos[0] / 128) + ',' + Math.floor(m.pos[2] / 128);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(m);
  }
  for (const list of cells.values()) {
    if (list.length <= SPAWN_CLEAN_MAX) continue;
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    for (let i = SPAWN_CLEAN_MAX; i < list.length; i++) drop.add(list[i]);
  }
  if (drop.size) { d.pendingMobs = d.pendingMobs.filter(m => !drop.has(m)); console.log('[spawning] removed ' + drop.size + ' extra animals from the save (' + dim + ')'); }
  return d;
};
