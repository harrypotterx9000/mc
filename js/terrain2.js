'use strict';
// ---------------------------------------------------------------------------
// Vanilla-terrain worlds ("gen 2"): biome tables from the bundled biome JSON, the worldgen worker
// pool, and the chunk pipeline
//   worker: noise + aquifers + surface  ->  proto chunk (stage 1)
//   main:   features, once the 8 neighbours are proto chunks  ->  decorated (stage 2)
//   main:   a decorated chunk whose 8 neighbours are decorated is final: lit, meshed, playable
// (features write into neighbouring chunks, so this mirrors vanilla's FEATURES -> LIGHT -> FULL).
// ---------------------------------------------------------------------------
const VB_BASE = 32;            // biome ids of gen-2 chunks: VB_BASE + index in WG_DATA.biome_order
const VBIOME = [];
function hexRGB(h) { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
function initVanillaBiomes(grassMap, foliageMap) {
  if (VBIOME.length) return;
  const D = self.WG_DATA;
  D.biome_order.forEach((name, i) => {
    const id = VB_BASE + i, b = D.biome[name], e = b.effects || {}, at = b.attributes || {};
    // GrassColor / FoliageColor: colormap at (1 - temperature, 1 - downfall * temperature)
    const col = (map, override) => {
      if (override) return hexRGB(override);
      const t = clamp(b.temperature, 0, 1), d = clamp(b.downfall, 0, 1) * t;
      const k = ((((1 - d) * 255) | 0) * 256 + (((1 - t) * 255) | 0)) * 4;
      return [map[k], map[k + 1], map[k + 2]];
    };
    let grass = col(grassMap, e.grass_color);
    if (e.grass_color_modifier === 'dark_forest') {
      const v = ((((grass[0] << 16) | (grass[1] << 8) | grass[2]) & 0xFEFEFE) + 0x28340A) >> 1;
      grass = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    }
    const sky = at['minecraft:visual/sky_color'], fog = at['minecraft:visual/fog_color'];
    const music = at['minecraft:audio/background_music'];
    VBIOME[id] = {
      name, def: b, cn: D.biome_cn[name] || name, precip: !!b.has_precipitation,
      sky: sky ? hexRGB(sky) : null, fog: fog ? hexRGB(fog) : null,
      grass, foliage: col(foliageMap, e.foliage_color), swamp: e.grass_color_modifier === 'swamp',
      water: hexRGB(e.water_color || '#3f76e4'),
      music: music && music.default ? music.default.sound.replace('minecraft:', '') : null,
      amb: at['minecraft:audio/ambient_sounds'] || null, // (loop / mood / additions: audio.js ambientSounds)
    };
    BIOMES[id] = VBIOME[id].cn; BIOME_TEMP[id] = b.temperature; BIOME_WATER[id] = VBIOME[id].water;
  });
}
const vbiomeIndex = (name) => self.WG_DATA.biome_order.indexOf(name) + VB_BASE;
// vanilla parses numeric seeds as longs and hashes anything else with String.hashCode
function parseSeed(str) {
  str = (str || '').trim();
  if (!str) { const r = () => BigInt(Math.floor(Math.random() * 4294967296)); return BigInt.asIntN(64, (r() << 32n) | r()).toString(); }
  if (/^[-+]?\d+$/.test(str)) { const v = BigInt(str); if (v >= -(2n ** 63n) && v < 2n ** 63n) return v.toString(); }
  let h = 0; for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return String(h);
}
const seed32 = (s) => typeof s === 'number' ? s | 0 : Number(BigInt.asIntN(32, BigInt(s)));

// ---- worker pool ---------------------------------------------------------------------------------
// vanilla block-state strings of the structure templates -> [id, meta] in this game (id -1: not placed)
const STATE_ALIAS = { cave_air: 'air', void_air: 'air', wall_torch: 'torch', suspicious_gravel: 'gravel', suspicious_sand: 'sand', lit_furnace: 'furnace',
  bubble_column: 'water', end_gateway: 'end_portal' };
const FACE_META = { west: 0, east: 1, north: 4, south: 5 };
function mapVanillaState(str) {
  const k = str.indexOf('['), name = k < 0 ? str : str.slice(0, k), props = {};
  if (k >= 0) for (const kv of str.slice(k + 1, -1).split(',')) { const [a, v] = kv.split('='); props[a] = v; }
  const key = BID[name] !== undefined ? name : STATE_ALIAS[name];
  if (key === 'air' || name === 'air') return [0, 0];
  const id = BID[key];
  if (id === undefined) return null;
  // water and lava: level 0 a source, 1-7 flowing, 8-15 falling (this game's metas 0, 1-7, 8); every flowing
  // fluid came in as a source before - imported worlds flooded, and a server's streams were drawn full
  if ((id === WATER || id === LAVA) && props.level !== undefined) { const l = +props.level || 0; return [id, l >= 8 ? 8 : l]; }
  const b = BLOCKS[id];
  if (key === 'redstone_wire' && +props.power > 0 && typeof WIRE_ID !== 'undefined') { const r = Features.stateOf({ Name: key, Properties: props }) || [id, 0]; return [WIRE_ID[+props.power], r[1]]; }
  if (b.states) return Features.stateOf({ Name: key, Properties: props }) || [id, 0];
  if (b.facing && props.facing) {
    let m = FACE_META[props.facing] ?? 0;
    if (b.chestLike) { if (props.type === 'left') m |= 16; else if (props.type === 'right') m |= 32; }
    return [id, m];
  }
  if (b.axis && props.axis) return [id, { y: 0, x: 1, z: 2 }[props.axis]];
  if (k < 0) return [id, 0];
  // compact-meta blocks: the meta whose vanilla state matches best
  let best = 0, bestScore = -1e9;
  for (let m = 0; m < 64; m++) {
    const vs = vanillaState(b, m, null);
    if (vs.key !== name && !(name === 'wall_torch' && vs.key === 'wall_torch')) continue;
    let sc = 0;
    for (const a in props) if (vs.p[a] !== undefined) sc += String(vs.p[a]) === props[a] ? 1 : -10;
    if (sc > bestScore) { bestScore = sc; best = m; }
  }
  return [id, best];
}
// A vanilla block this game doesn't have, shown as the closest one it does (same properties: facing, half, ...):
// without its variant prefix (stripped_, waxed_, oxidised copper, potted_, dead coral), in oak instead of another
// wood, in another colour, or as the plain block of its shape (stairs -> stone stairs ...). Banners, heads and
// such stay air. Returns [id, meta, true] for a substitute; null when nothing fits.
const NEAR_WOODS = ['spruce', 'birch', 'jungle', 'acacia', 'cherry', 'dark_oak', 'pale_oak', 'mangrove', 'bamboo', 'crimson', 'warped'];
const NEAR_COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const NEAR_SHAPES = [
  ['_wall_hanging_sign', 'oak_wall_sign'], ['_hanging_sign', 'oak_sign'], ['_wall_sign', 'oak_wall_sign'], ['_sign', 'oak_sign'],
  ['_fence_gate', 'oak_fence_gate'], ['_pressure_plate', 'stone_pressure_plate', 'oak_pressure_plate'], ['_trapdoor', 'oak_trapdoor'], ['_door', 'oak_door'],
  ['_stairs', 'stone_stairs', 'cobblestone_stairs', 'oak_stairs'], ['_slab', 'stone_slab', 'smooth_stone_slab', 'cobblestone_slab', 'oak_slab'],
  ['_wall', 'cobblestone_wall'], ['_fence', 'oak_fence'], ['_button', 'stone_button', 'oak_button'], ['_planks', 'oak_planks'], ['_log', 'oak_log'],
  ['_wood', 'oak_log'], ['_hyphae', 'oak_log'], ['_stem', 'oak_log'], ['_leaves', 'oak_leaves'], ['_sapling', 'oak_sapling'],
  ['_bricks', 'stone_bricks', 'bricks'], ['_tiles', 'stone_bricks'], ['_pillar', 'quartz_block', 'stone'], ['_ore', 'stone'], ['_rail', 'rail'],
  ['shulker_box', 'chest'], ['_carpet', 'white_carpet'], ['_candle', 'candle'], ['_wall_torch', 'wall_torch'], ['_torch', 'torch'],
  ['_lantern', 'lantern'], ['_bars', 'iron_bars'], ['_chain', 'chain', 'iron_chain'], ['_grate', 'glass'], ['_bulb', 'redstone_lamp'],
  ['_froglight', 'glowstone'], ['_coral_block', 'stone'], ['_concrete_powder', 'sand'], ['_block', 'stone'],
];
function nearNames(n) {
  const out = [], add = (x) => { if (x && x !== n && !out.includes(x)) out.push(x); };
  const b = n.replace(/^(waxed_|stripped_|infested_|potted_|dead_)+/, '').replace(/^(exposed_|weathered_|oxidized_)/, '');
  add(b);
  for (const wd of NEAR_WOODS) if (b.startsWith(wd + '_')) add('oak_' + b.slice(wd.length + 1));
  for (const c of NEAR_COLORS) if (b.startsWith(c + '_')) { const rest = b.slice(c.length + 1); for (const c2 of NEAR_COLORS) add(c2 + '_' + rest); add(rest); }
  add(b.replace(/_concrete_powder$/, '_concrete')); add(b.replace(/_glazed_terracotta$/, '_terracotta'));
  if (/glass_pane$/.test(b)) add('glass_pane'); else if (/glass$/.test(b)) add('glass');
  if (b.includes('copper_')) { add(b.replace('copper_', 'iron_')); add(b.replace('copper_', '')); }
  if (b.startsWith('soul_')) add(b.slice(5));
  if (b.endsWith('candle_cake')) add('cake');
  for (const [suf, ...to] of NEAR_SHAPES) if (b.endsWith(suf)) { for (const t of to) add(t); break; }
  return out;
}
const nearCache = new Map();
function mapVanillaStateNear(str) {
  const exact = mapVanillaState(str);
  if (exact) return exact;
  let r = nearCache.get(str);
  if (r !== undefined) return r;
  r = null;
  const k = str.indexOf('['), name = k < 0 ? str : str.slice(0, k), props = k < 0 ? '' : str.slice(k);
  for (const cand of nearNames(name)) {
    let m = null;
    try { m = mapVanillaState(cand + props); } catch (e) { }
    if (m && m[0]) { r = [m[0], m[1], true]; break; }
  }
  nearCache.set(str, r);
  return r;
}
function structStateMap() {
  if (structStateMap.cache) return structStateMap.cache;
  const S = self.STRUCT_DATA;
  if (!S || typeof Features === 'undefined') return null;
  const out = new Int32Array(S.states.length * 2), missing = new Set();
  // per state: 2 = the block can hold water, 1 = the template has it waterlogged (structStateMap.wl)
  const wl = structStateMap.wl = new Uint8Array(S.states.length);
  S.states.forEach((str, i) => {
    // the template's own markers are not placed
    let r = null;
    const name = str.split('[')[0];
    if (!['structure_void', 'structure_block', 'jigsaw'].includes(name)) try { r = mapVanillaState(str); } catch (e) { r = null; }
    if (!r) { out[i * 2] = -1; const n = str.split('[')[0]; if (!['structure_void', 'structure_block', 'jigsaw'].includes(n)) missing.add(n); }
    else {
      out[i * 2] = r[0]; out[i * 2 + 1] = r[1];
      if (r[0] > 0 && canWaterlog(r[0], r[1])) wl[i] = 2 | (str.includes('waterlogged=true') ? 1 : 0);
    }
  });
  if (missing.size) console.info('structure blocks the game does not have:', [...missing].join(' '));
  return (structStateMap.cache = out);
}

// the generator inside the page, for when workers cannot be started (pages opened from file://):
// one message at a time between frames, and at most one chunk a frame (InlineGenWorker.frame is counted up
// by the game's frame loop) - a chunk takes 30 ms or more, and generating them back to back left 4 frames a
// second
class InlineGenWorker {
  constructor() { this.core = self.makeGenCore(); this.q = []; this.running = false; this.onmessage = null; this.inline = true; this.genFrame = -1; }
  postMessage(m) { this.q.push(m); this.kick(); }
  kick() { if (!this.running && !this.dead) { this.running = true; setTimeout(() => this.step(), 0); } }
  async step() {
    if (this.q.length && this.q[0].type === 'gen') {
      if (this.genFrame === InlineGenWorker.frame) { this.running = false; setTimeout(() => this.kick(), 4); return; }
      this.genFrame = InlineGenWorker.frame;
    }
    const m = this.q.shift();
    if (m && !this.dead) await this.core(m, (msg) => { if (!this.dead && this.onmessage) this.onmessage({ data: msg }); });
    this.running = false;
    if (this.q.length) this.kick();
  }
  terminate() { this.dead = true; this.q = []; }
}
InlineGenWorker.frame = 0;
const newGenWorker = () => {
  if (!GenPool.inline) { try { return new Worker('js/gen_worker.js'); } catch (e) { GenPool.inline = true; console.info('worldgen: workers unavailable (' + e.name + '), generating in the page'); } }
  return new InlineGenWorker();
};

class GenPool {
  constructor(seed) {
    this.seed = String(seed);
    if (location.protocol === 'file:') GenPool.inline = true;
    const n = GenPool.inline ? 1 : genWorkerCount();
    const palette = { air: 0 };
    for (const k in BID) palette[k] = BID[k];
    this.workers = []; this.queue = []; this.wait = new Map(); this.nextId = 1; this.dead = false;
    this.init = { type: 'init', seed: this.seed, palette, smap: structStateMap(), swl: structStateMap.wl };
    this.ready = Promise.all(Array.from({ length: n }, () => new Promise((res) => this.spawn(res, 0))));
  }
  // a worker that fails (its scripts didn't load, it crashed) is replaced and its jobs go back in the queue;
  // before, its jobs never answered and chunk generation stalled
  spawn(res, tries) {
    const w = newGenWorker();
    w.busy = 0; w.jobs = new Map();
    w.onmessage = (e) => { w.jobT = performance.now(); this.onMessage(w, e.data, res); }; // (any answer: it is alive)
    w.onerror = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      console.warn('worldgen: worker failed (' + (e && e.message || 'error') + '), restarting');
      this.workers = this.workers.filter(x => x !== w);
      try { w.terminate(); } catch (err) { }
      for (const m of w.jobs.values()) this.queue.unshift(m);
      if (this.dead) return;
      if (tries < 5) setTimeout(() => { if (!this.dead) this.spawn(res, tries + 1); }, 250 * (tries + 1));
      else if (!this.workers.length) { GenPool.inline = true; this.spawn(res, 0); }
      else res();
      this.pump();
    };
    w.postMessage(this.init);
    this.workers.push(w);
    this.pump();
  }
  onMessage(w, m, readyRes) {
    if (m.type === 'ready') { readyRes(); return; }
    if (m.type === 'error') console.error('worldgen:', m.message);
    w.jobs.delete(m.id);
    w.busy = Math.max(0, w.busy - 1);
    const cb = this.wait.get(m.id);
    this.wait.delete(m.id);
    if (cb && !this.dead) cb(m);
    this.pump();
  }
  request(msg, cb) { msg.id = this.nextId++; this.wait.set(msg.id, cb); this.queue.push(msg); this.pump(); }
  pump() {
    for (const w of this.workers) {
      while (w.busy < 2 && this.queue.length) { const m = this.queue.shift(); if (!w.busy) w.jobT = performance.now(); w.busy++; w.jobs.set(m.id, m); w.postMessage(m); }
    }
  }
  // a worker that hasn't answered any job for 30 s (a chunk takes milliseconds) is stuck: it is replaced and
  // its jobs go back in the queue, like a crashed one
  check() {
    if (GenPool.inline || this.dead) return;
    const now = performance.now();
    if (now - (this.checkT || 0) < 2000) return;
    this.checkT = now;
    for (const w of [...this.workers]) {
      if (!w.busy) { w.jobT = 0; w.suspect = 0; continue; }
      if (now - w.jobT < 30000) { w.suspect = 0; continue; }
      // (still silent at the next check, 2 s on: not an answer held up by a long pause of this page)
      if (!w.suspect) { w.suspect = now; continue; }
      console.warn('worldgen: a worker stopped answering, restarting it');
      if (window.game && game.reportError) game.reportError('地形生成线程无响应（已重启）', new Error('worker timeout'), true);
      w.onerror({ message: 'timeout' });
    }
  }
  inflight() { return this.wait.size; }
  terminate() { this.dead = true; for (const w of this.workers) w.terminate(); this.workers = []; }
}

Game.prototype.genSetup = function (seed) {
  if (this.genPool && this.genPool.seed === String(seed)) return this.genPool.ready;
  if (this.genPool) this.genPool.terminate();
  if (!this.chunkWorker) this.chunkWorker = new ChunkWorker(this);
  initVanillaBiomes(this.renderer.grassMap, this.renderer.foliageMap);
  this.genPool = new GenPool(seed);
  this.genPending = new Set();
  return this.genPool.ready;
};
// ---- chunk worker (chunk_worker.js): decoration, finishing and meshing off the main thread -------------
// The world it works on is the one last reset into it; its protos are counted in w.protoKeys.
class ChunkWorker {
  constructor(game) {
    this.game = game; this.ready = false; this.failed = false; this.epoch = 0; this.world = null;
    this.meshCb = new Map(); this.nextId = 1;
    if (location.protocol === 'file:' || typeof Worker === 'undefined') { this.failed = true; return; }
    try { this.w = new Worker('js/chunk_worker.js'); } catch (e) { this.failed = true; return; }
    this.w.onmessage = (e) => { this.lastMsg = performance.now(); this.onMessage(e.data); };
    this.w.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); this.fail(e && e.message); };
  }
  fail(why) {
    if (this.failed) return;
    console.warn('chunk worker unavailable (' + why + '), staying on the main thread');
    this.failed = true; this.ready = false;
    try { this.w.terminate(); } catch (e) { }
    // whatever it held is lost: its world regenerates on the main thread
    if (this.world) { this.world.protoKeys = null; this.world.useCW = false; }
    for (const cb of this.meshCb.values()) cb(null);
    this.meshCb.clear();
  }
  // every 5 s: a ping it must answer. One that answers nothing for 20 s is stuck (a loop in a chunk's
  // generation): the page stops waiting for it and goes on on the main thread
  check() {
    if (this.failed || !this.ready) return;
    const now = performance.now(), waiting = this.pingT && !(this.lastMsg >= this.pingT);
    if (waiting) {
      // (still silent 3 s after it was first noticed: an answer held up by a long pause of this page is
      // handled in between)
      if (now - this.pingT > 20000) {
        if (!this.suspect) this.suspect = now;
        else if (now - this.suspect > 3000) { this.game.reportError('区块线程无响应（改在主线程生成）', new Error('chunk worker timeout'), true); this.fail('no answer for 20 s'); }
      }
      return;
    }
    this.suspect = 0;
    if (now - (this.pingT || 0) > 5000) { this.pingT = now; this.post({ type: 'ping' }); }
  }
  post(m, tr) { this.w.postMessage(m, tr || []); }
  reset(w) {
    this.epoch++; this.world = w; w.protoKeys = new Set(); this.sent = null; this.game.finalQ = [];
    this.post({ type: 'reset', epoch: this.epoch, seed: w.seedStr, dim: w.dim, minY: w.minY || 0, structures: w.structures !== false });
    this.opts();
  }
  // meshing options (图形品质)
  opts() { if (!this.failed) this.post({ type: 'opts', fastLeaves: FAST_LEAVES }); }
  center(cx, cz, R) {
    const s = cx + ',' + cz + ',' + R;
    if (s === this.sent) return;
    this.sent = s;
    this.post({ type: 'center', epoch: this.epoch, cx, cz, R });
  }
  mesh(snap, cb) {
    const id = this.nextId++;
    this.meshCb.set(id, cb);
    snap.type = 'mesh'; snap.id = id;
    this.post(snap, [snap.ids.buffer, snap.metas.buffer, snap.lights.buffer, snap.tints.buffer, snap.biomes.buffer]);
  }
  onMessage(m) {
    const g = this.game, w = this.world;
    switch (m.type) {
      case 'ready': this.ready = true; break;
      case 'mesh': { this.lastMesh = performance.now(); const cb = this.meshCb.get(m.id); this.meshCb.delete(m.id); if (cb) cb(m.error ? null : m); break; }
      case 'final':
        if (m.epoch !== this.epoch || !w) break;
        w.protoKeys.delete(ckey(m.cx, m.cz));
        (g.finalQ || (g.finalQ = [])).push(m);
        break;
      case 'dropped': if (m.epoch === this.epoch && w) for (const k of m.keys) w.protoKeys.delete(k); break;
      case 'stats': this.stats = m; break;
      case 'pong': break;
      case 'error': { const e = new Error(m.msg); e.stack = m.stack; g.reportError('区块线程 ' + m.where, e, true); break; }
    }
  }
  inflightMeshes() { return this.meshCb.size; }
}
// a chunk the worker finished: saved edits, structure loot and mobs, tints, light (like finaliseChunk)
Game.prototype.finishFromWorker = function (m) {
  const w = this.world, k = ckey(m.cx, m.cz), cw = this.chunkWorker;
  if (w.chunks.has(k) || !cw || cw.world !== w || m.epoch !== cw.epoch) return;
  // a chunk that can't be built is replaced by an empty one (it comes back generated next time the world
  // loads): a missing chunk keeps its neighbours from ever being drawn, and the world stops loading there
  if (m.broken) { this.reportError('chunk ' + m.cx + ',' + m.cz, new Error(m.broken), true); this.finishChunk(new Chunk(m.cx, m.cz), false); return; }
  try { this.finishFromWorkerIn(m, w, k); }
  catch (e) {
    this.reportError('chunk ' + m.cx + ',' + m.cz, e, true);
    if (!w.chunks.has(k)) { try { this.finishChunk(new Chunk(m.cx, m.cz), false); } catch (e2) { w.chunks.set(k, new Chunk(m.cx, m.cz)); } }
  }
};
Game.prototype.finishFromWorkerIn = function (m, w, k) {
  const ch = Chunk.fromWire(m.cx, m.cz, m.sec); // sections, already lit inside
  ch.biome.set(m.biome);
  ch.final = true; ch.sx = m.sx; ch.nb = m.nb;
  if (m.sx && m.sx.wl) ch.wl = new Set(m.sx.wl);
  const saved = w.savedChunks && w.savedChunks.get(k);
  if (saved) decodeChunk(saved, ch);
  if (ch.sx) this.structureExtras(ch, !!saved);
  this.chunkTints(ch);
  ch.nb = null;
  this.finishChunk(ch, !!saved);
};

Game.prototype.genSpawn = function () {
  return this.genPool.ready.then(() => new Promise((res) => this.genPool.request({ type: 'spawn' }, (m) => res([m.x, m.z]))));
};

// one streaming step for a gen-2 world: request, decorate, finalise, forget far proto chunks
Game.prototype.genStep = function (pcx, pcz, R, t0, budget) {
  const w = this.world, pool = this.genPool;
  if (!pool) return;
  pool.check();
  if (this.chunkWorker) this.chunkWorker.check();
  const proto = w.proto || (w.proto = new Map()), pending = this.genPending;
  // with the chunk worker ready when a world starts streaming, its decoration / finishing happen there
  const cw = this.chunkWorker;
  if (w.useCW === undefined) w.useCW = !!(cw && cw.ready && !proto.size);
  if (w.useCW && (!cw || cw.failed)) w.useCW = false;
  const useCW = w.useCW;
  if (useCW && cw.world !== w) cw.reset(w);
  const has = useCW ? (cx, cz) => w.chunks.has(ckey(cx, cz)) || w.protoKeys.has(ckey(cx, cz))
    : (cx, cz) => w.chunks.has(ckey(cx, cz)) || proto.has(ckey(cx, cz));
  // 1) request proto chunks: finalising out to R + 1.5 needs decorated neighbours (up to sqrt 2 further on the
  // diagonals), which need proto neighbours again: R + 1.5 + 2 * 1.42 -> R + 4.5
  const GR = R + 4;
  if (pool.inflight() < pool.workers.length * 3) {
    const want = [];
    for (let dx = -GR; dx <= GR; dx++) for (let dz = -GR; dz <= GR; dz++) {
      const d2 = dx * dx + dz * dz;
      if (d2 > (R + 4.5) * (R + 4.5)) continue;
      const cx = pcx + dx, cz = pcz + dz, k = ckey(cx, cz);
      if (pending.has(k) || has(cx, cz)) continue;
      want.push([cx, cz, d2]);
    }
    want.sort((a, b) => a[2] - b[2]);
    const epoch = this.genEpoch;
    for (const [cx, cz] of want.slice(0, pool.workers.length * 3 - pool.inflight())) {
      const k = ckey(cx, cz);
      pending.add(k);
      this.savedReady(w, k); // start reading its saved data, if any, while it generates
      pool.request({ type: 'gen', cx, cz, dim: w.dim, height: HEIGHT, structures: w.structures !== false }, (m) => { pending.delete(k); if (this.genEpoch === epoch && this.world === w) this.genReceive(m); });
    }
  }
  if (useCW) {
    cw.center(pcx, pcz, R);
    // finished chunks from the worker: light and add them, nearest first, within the frame's budget
    const q = this.finalQ;
    if (q && q.length) {
      q.sort((a, b) => ((b.cx - pcx) ** 2 + (b.cz - pcz) ** 2) - ((a.cx - pcx) ** 2 + (a.cz - pcz) ** 2));
      const later = [];
      while (q.length && this.workFits(t0, budget * 0.8, 'finalise')) {
        const m = q.pop();
        if (!this.savedReady(w, ckey(m.cx, m.cz))) { later.push(m); continue; } // its saved data is still being read
        this.timedWork('finalise', () => this.finishFromWorker(m));
      }
      for (const m of later) q.push(m);
    }
    return;
  }
  // 2) decorate / 3) finalise, nearest first, within the time budget
  const cand = [];
  for (const ch of proto.values()) {
    const dx = ch.cx - pcx, dz = ch.cz - pcz, d2 = dx * dx + dz * dz;
    if (d2 > (R + 3) * (R + 3)) continue;
    cand.push([ch, d2]);
  }
  cand.sort((a, b) => a[1] - b[1]);
  const around = (ch, ok) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { if (!a && !b) continue; const n = proto.get(ckey(ch.cx + a, ch.cz + b)); if (!n || !ok(n)) { if (!n && w.chunks.has(ckey(ch.cx + a, ch.cz + b))) continue; return false; } } return true; };
  for (const [ch, d2] of cand) {
    if (!this.workFits(t0, budget * 0.6, 'decorate')) break;
    // (a chunk whose decoration fails goes on without it; one that can't be finished becomes empty - either
    // way the nearest chunk isn't stuck failing every frame with everything behind it waiting)
    if (ch.stage === 1 && around(ch, () => true)) { this.timedWork('decorate', () => this.guard('decorate ' + ch.cx + ',' + ch.cz, () => this.decorateChunk(ch))); ch.stage = 2; }
  }
  for (const [ch, d2] of cand) {
    if (!this.workFits(t0, budget * 0.8, 'finalise')) break;
    if (ch.stage === 2 && d2 <= (R + 1.5) * (R + 1.5) && around(ch, (n) => n.stage === 2) && this.savedReady(w, ckey(ch.cx, ch.cz))) this.timedWork('finalise', () => {
      try { this.finaliseChunk(ch); }
      catch (e) {
        this.reportError('chunk ' + ch.cx + ',' + ch.cz, e, true);
        const k = ckey(ch.cx, ch.cz);
        proto.delete(k);
        if (!w.chunks.has(k)) this.finishChunk(new Chunk(ch.cx, ch.cz), false);
      }
    });
  }
  // 4) forget proto chunks that drifted far away
  if (this.tickCount % 40 === 0) for (const ch of [...proto.values()]) {
    const dx = ch.cx - pcx, dz = ch.cz - pcz;
    if (dx * dx + dz * dz > (R + 5.5) * (R + 5.5)) proto.delete(ckey(ch.cx, ch.cz)); // requested out to R + 4.5
  }
};
Game.prototype.genReceive = function (m) {
  const w = this.world, k = ckey(m.cx, m.cz);
  if (w.useCW && this.chunkWorker && !this.chunkWorker.failed) {
    if (w.chunks.has(k) || w.protoKeys.has(k)) return;
    if (m.sx) { const refs = w.structRefs || (w.structRefs = new Map()); for (const [name, box, f] of m.sx.refs) refs.set(name + ':' + box[0] + ',' + box[2], { name, box, f }); }
    const msg = { type: 'proto', epoch: this.chunkWorker.epoch, cx: m.cx, cz: m.cz, blocks: m.blocks, qb: m.qb, hm: m.hm, sb: m.sb, meta: m.meta, sx: m.sx };
    const tr = [m.blocks.buffer]; if (m.meta) tr.push(m.meta.buffer);
    try { this.chunkWorker.post(msg, tr); w.protoKeys.add(k); } catch (e) { this.reportError('chunk ' + m.cx + ',' + m.cz, e, true); } // (not sent: asked for again)
    return;
  }
  if (w.chunks.has(k) || w.proto.has(k)) return;
  const ch = Chunk.from(m.cx, m.cz, m.blocks, m.sx ? m.meta : null);
  ch.qb = m.qb; ch.hm = m.hm;
  if (m.sx) {
    ch.sx = m.sx;
    if (m.sx.wl && m.sx.wl.length) ch.wl = new Set(m.sx.wl); // structure blocks holding water
    const refs = w.structRefs || (w.structRefs = new Map());
    for (const [name, box, f] of m.sx.refs) refs.set(name + ':' + box[0] + ',' + box[2], { name, box, f });
  }
  for (let i = 0; i < 256; i++) ch.biome[i] = VB_BASE + m.sb[i];
  ch.stage = 1;
  w.proto.set(k, ch);
};
// stage 2: vanilla features (placed in worldfeatures.js); writes may reach the 8 neighbours
Game.prototype.decorateChunk = function (ch) {
  // strongholds (needed to reach the End) still come from the original structure builder
  const w = this.world;
  if (w.structures !== false) for (const sb of w.structuresFor(ch.cx, ch.cz)) sb.apply(ch);
  if (typeof Features !== 'undefined') Features.decorate(this, w, ch);
};
Game.prototype.finaliseChunk = function (ch) {
  const w = this.world, k = ckey(ch.cx, ch.cz);
  w.proto.delete(k);
  ch.final = true; // decoration of a (re)generated neighbour must not write into it any more
  const saved = w.savedChunks && w.savedChunks.get(k);
  if (saved) decodeChunk(saved, ch);
  if (ch.sx) { this.structureExtras(ch, !!saved); }
  this.chunkTints(ch);
  ch.recount();
  this.finishChunk(ch, !!saved);
};
// grass / foliage colours per column, blended over a 5x5 area like the default biome blend
Game.prototype.chunkTints = function (ch) {
  const w = this.world, x0 = ch.cx * 16, z0 = ch.cz * 16;
  const nb = ch.nb; // from the chunk worker: biomes of the 3x3 chunks
  const biomeAt = nb ? (x, z) => nb[((((z >> 4) - ch.cz + 1) * 3 + (x >> 4) - ch.cx + 1) << 8) | ((z & 15) << 4) | (x & 15)] : (x, z) => {
    const c = (x >> 4) === ch.cx && (z >> 4) === ch.cz ? ch : (w.chunks.get(ckey(x >> 4, z >> 4)) || (w.proto && w.proto.get(ckey(x >> 4, z >> 4))));
    return c ? c.biome[((z & 15) << 4) | (x & 15)] : ch.biome[((z & 15) << 4) | (x & 15)];
  };
  const swamp = (x, z) => (WG.infoNoise().get(x * 0.0225, z * 0.0225) < -0.1 ? [76, 118, 60] : [106, 112, 57]);
  for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
    let gr = 0, gg = 0, gb = 0, fr = 0, fg = 0, fb = 0;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const x = x0 + lx + dx, z = z0 + lz + dz, v = VBIOME[biomeAt(x, z)];
      if (!v) continue;
      const g = v.swamp ? swamp(x, z) : v.grass;
      gr += g[0]; gg += g[1]; gb += g[2]; fr += v.foliage[0]; fg += v.foliage[1]; fb += v.foliage[2];
    }
    const o = (lz * 16 + lx) * 3;
    ch.grass[o] = gr / 25; ch.grass[o + 1] = gg / 25; ch.grass[o + 2] = gb / 25;
    ch.foliage[o] = fr / 25; ch.foliage[o + 1] = fg / 25; ch.foliage[o + 2] = fb / 25;
  }
};
// biome of a column in a gen-2 world, and vanilla precipitation rules
Game.prototype.vbiomeAt = function (x, z) {
  const ch = this.world.getChunk(x >> 4, z >> 4);
  return ch ? VBIOME[ch.biome[((z & 15) << 4) | (x & 15)]] : null;
};
Game.prototype.snowsAt = function (x, y, z) {
  const v = this.vbiomeAt(x, z);
  return !!v && v.precip && WG.coldEnoughToSnow(v.def, x, y + MIN_Y, z, 63);
};

// all log / leaf ids (vanilla tags) for leaf decay
const LOG_IDS = new Set(), LEAF_IDS = new Set();
for (const k of (self.BLOCK_TAGS && self.BLOCK_TAGS.logs) || []) if (BID[k] !== undefined) LOG_IDS.add(BID[k]);
for (const k of (self.BLOCK_TAGS && self.BLOCK_TAGS.leaves) || []) if (BID[k] !== undefined) LEAF_IDS.add(BID[k]);

// a live-world view with the Region API, so vanilla features can run on finished chunks (sapling growth)
class LiveRegion {
  constructor(world) { this.w = world; this.minY = world.minY || 0; this.maxY = this.minY + HEIGHT; }
  id(x, y, z) { return this.w.getBlock(x, y - this.minY, z); }
  meta(x, y, z) { return this.w.getMeta(x, y - this.minY, z); }
  canWrite(x, y, z) { return y >= this.minY && y < this.maxY && this.w.isLoaded(x, z); }
  set(x, y, z, id, meta = 0) { if (!this.canWrite(x, y, z)) return false; this.w.setBlock(x, y - this.minY, z, id, meta); return true; }
  setState(x, y, z, s) { return s ? this.set(x, y, z, s[0], s[1]) : false; }
  isAir(x, y, z) { return this.id(x, y, z) === 0; }
  chunk(x, z) { return this.w.getChunk(x >> 4, z >> 4); }
  height(type, x, z) { for (let y = this.maxY - 1; y >= this.minY; y--) { const id = this.id(x, y, z); if (id && (type.startsWith('WORLD_SURFACE') || (BLOCKS[id].solid || IS_FLUID[id]))) return y + 1; } return this.minY; }
}
// SaplingBlock.advanceTree with the vanilla tree growers (2x2 variants where they exist)
const TREE_GROWERS = {
  oak_sapling: { one: [['oak', 0.9], ['fancy_oak', 0.1]] }, birch_sapling: { one: [['birch', 1]] },
  spruce_sapling: { one: [['spruce', 1]], mega: [['mega_spruce', 0.5], ['mega_pine', 0.5]] },
  jungle_sapling: { one: [['jungle_tree_no_vine', 1]], mega: [['mega_jungle_tree', 1]] },
  acacia_sapling: { one: [['acacia', 1]] }, cherry_sapling: { one: [['cherry', 1]] },
  dark_oak_sapling: { mega: [['dark_oak', 1]] }, pale_oak_sapling: { mega: [['pale_oak_bonemeal', 1]] },
  mangrove_propagule: { one: [['mangrove', 0.85], ['tall_mangrove', 0.15]] },
};
Game.prototype.growTreeV = function (x, y, z, id) {
  const b = BLOCKS[id], G = TREE_GROWERS[b.key], w = this.world;
  if (!G || typeof Features === 'undefined') return false;
  const R = new LiveRegion(w), r = new Features.WRand();
  r.setSeed(BigInt(Math.floor(Math.random() * 2 ** 52)));
  const pick = (list) => { let t = Math.random(); for (const [n, p] of list) { if ((t -= p) < 0) return n; } return list[0][0]; };
  const vy = y + R.minY;
  const ctx = { R, top: null, seed: w.seedStr || '0', biomeAt: () => 'plains', biomeHas: () => true };
  if (G.mega) for (const [ox, oz] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
    const ax = x + ox, az = z + oz;
    if ([[0, 0], [1, 0], [0, 1], [1, 1]].every(([a, c]) => w.getBlock(ax + a, y, az + c) === id)) {
      for (const [a, c] of [[0, 0], [1, 0], [0, 1], [1, 1]]) w.setBlock(ax + a, y, az + c, 0, 0);
      if (Features.placeCF(ctx, pick(G.mega), r, [ax, vy, az])) return true;
      for (const [a, c] of [[0, 0], [1, 0], [0, 1], [1, 1]]) w.setBlock(ax + a, y, az + c, id, 0);
      return false;
    }
  }
  if (!G.one) return false;
  w.setBlock(x, y, z, 0, 0);
  if (Features.placeCF(ctx, pick(G.one), r, [x, vy, z])) return true;
  w.setBlock(x, y, z, id, 0);
  return false;
};
