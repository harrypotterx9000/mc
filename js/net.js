'use strict';
// ---------------------------------------------------------------------------
// Playing on a vanilla Java server through the proxy (multiplayer/proxy, a WebSocket <-> Java protocol bridge).
// The server's terrain, block changes and light, the other players and the mobs (with what they hold), dropped
// items, day time, rain and chat. This player walks, flies, digs, places, attacks and uses items: each action is
// shown at once and sent to the server, whose answer (block changes, inventory, health) always wins.
// While connected the world is "remote": nothing is generated, ticked or saved here.
// Inventory numbering: the server's player window has 0 result, 1-4 crafting, 5-8 armour, 9-35 main, 36-44 hotbar,
// 45 offhand; this game's inventory 0-8 hotbar, 9-35 main, 36-39 armour (helmet first).
// Windows (the inventory, chests, furnaces, crafting tables, villagers ...): the server's. A click is worked out
// here at once, like vanilla's client does, and sent with the slots it changed; the server checks it and sends
// back whatever came out differently.
// ---------------------------------------------------------------------------
// vanilla entity types this game can draw
const NET_MOBS = new Set(['pig', 'cow', 'sheep', 'chicken', 'zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'blaze', 'ghast',
  'zombified_piglin', 'magma_cube', 'villager', 'zombie_villager', 'iron_golem', 'cat', 'piglin', 'hoglin', 'strider']);
const NET_PLAYER_T = { cn: '玩家', hp: 20, w: 0.6, h: 1.8, speed: 0, model: 'steve', tex: 'steve', scale: 0.9375, drops: [] };
const R2D = 180 / Math.PI;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
// vanilla yaw (degrees, 0 = facing +Z) <-> this game's (radians, 0 = facing -Z); vanilla pitch is positive looking down
const toYaw = (deg) => Math.PI - deg / R2D, fromYaw = (rad) => 180 - rad * R2D;
// this game's face order (-x +x -y +y -z +z) -> vanilla's Direction (down up north south west east)
const NET_FACE = [4, 5, 0, 1, 2, 3];
const oursToWin = (i) => i === 40 ? 45 : i < 9 ? 36 + i : i < 36 ? i : 5 + i - 36; // 40: the offhand (window slot 45)
// set_player_inventory numbering: 0-8 hotbar, 9-35 main, 36-39 armour from the feet up
const pinvToOurs = (s) => s < 36 ? s : s <= 39 ? 36 + 39 - s : -1;
// two stacks of the same item that may merge (same components; unknown items by their name)
const sameItem = (a, b) => a.id === b.id && (a.x || '') === (b.x || '') && (a.unk || '') === (b.unk || '');
const sameStack = (a, b) => (!a && !b) || (!!a && !!b && sameItem(a, b) && a.count === b.count && (a.dmg || 0) === (b.dmg || 0));
// a stack as the proxy takes it: the item's name, the count, the components' signature
// a stack as the proxy takes it: the item's name, the count, the components' signature (the server's own stack);
// a stack made here (the creative inventory) carries its data so the proxy can build the components
const netStack = (s) => {
  if (!s) return null;
  const o = { n: s.unk || ITEMS[s.id].key, c: s.count, x: s.x };
  if (!s.x) {
    if (s.dmg) o.d = s.dmg; if (s.name) o.name = s.name; if (s.e && s.e.length) o.e = s.e; if (s.pot) o.pot = s.pot; if (s.color != null) o.color = s.color;
    if (s.pv) o.pv = s.pv; if (s.instrument) o.ins = s.instrument; if (s.patterns) o.pat = s.patterns; if (s.base) o.base = s.base;
    if (s.flight) { o.flight = s.flight; o.ex = s.explosions || []; } if (s.fw) o.fw = s.fw;
  }
  return o;
};

// another player: the player model, moved by the server
class NetPlayer extends Mob {
  constructor(game, x, y, z, name) {
    super(game, 'zombie', x, y, z);
    this.type = 'player'; this.T = NET_PLAYER_T; this.w = 0.6; this.h = 1.8; this.name = name || '?';
  }
  pose(a) {
    const swing = lerp(this.limbSwing - this.limbAmt, this.limbSwing, a) * 0.6662, amt = this.limbAmt;
    const l = Math.cos(swing) * 1.4 * amt, r = -l;
    const t = this.swingT > 0 ? clamp((6 - this.swingT + a) / 6, 0, 1) : 0, sw = Math.sin(t * Math.PI);
    const P = { head: { ry: this.headYaw, rx: this.pitch }, rarm: { rx: r * 0.7 + sw * 1.5 }, larm: { rx: l * 0.7 }, rleg: { rx: l }, lleg: { rx: r } };
    if (this.sneaking) { P.body = { rx: -0.5, t: [0, -1.73 / 16, 5.75 / 16] }; P.head.t = [0, -4.2 / 16, 0]; }
    if (this.vehicleRef) { P.rleg = { rx: 1.4137167, ry: -0.31415927 }; P.lleg = { rx: 1.4137167, ry: 0.31415927 }; } // sitting in a boat or minecart
    else if (this.netSwim) return swimLimbs(P, lerp(this.limbSwing - this.limbAmt, this.limbSwing, a), this.swimming);
    return P;
  }
  // the server's swimming / crawling pose: eased in and out like the local player's (0.09 a tick); lying along the
  // view only in water (vanilla setupRotations)
  swimTick() {
    this.prevSwimAmt = this.swimAmt || 0; this.swimAmt = clamp(this.prevSwimAmt + (this.netSwim ? 0.09 : -0.09), 0, 1);
    this.swimming = !!this.netSwim && this.world.waterAt(Math.floor(this.pos[0]), Math.floor(this.pos[1] + 0.3), Math.floor(this.pos[2]));
  }
}
// what a server-driven entity does each tick: glide to where the server put it (vanilla spreads a move over 3
// ticks), turn toward its rotation, animate its legs from the movement
// the dragon on a server: its wing beats (faster the slower it flies, slow while sitting), the trail of places the
// neck and tail follow, and the nearest crystal beaming at it - like vanilla's client works them out itself
EnderDragon.prototype.netAnimTick = function () {
  this.prevFlap = this.flap;
  this.hist.unshift([this.pos[0], this.pos[1], this.pos[2], this.yaw]);
  if (this.hist.length > 64) this.hist.length = 64;
  this.vel = [this.pos[0] - this.prev[0], this.pos[1] - this.prev[1], this.pos[2] - this.prev[2]];
  if (this.deathTime > 0) { this.flap += 0.02; return; }
  this.flap += this.flapSpeed();
  if (Math.floor(this.flap) !== Math.floor(this.prevFlap)) Sound.ev('entity.ender_dragon.flap', this.pos, 5, 0.8 + Math.random() * 0.3);
  if (this.age % 10 === 0) {
    this.healer = null; let bd = 32;
    for (const e of this.game.entities) if (e instanceof EndCrystal && !e.dead) { const d = e.distTo(this); if (d < bd) { bd = d; this.healer = e; } }
  }
};
// a dropped item: glides like the rest, spins and bobs (drawEntities uses its age)
function netVehicleTick() {
  const p = this.game.player;
  if (this instanceof Boat && this.rider === p) { Boat.prototype.tick.call(this); return; }
  this.savePrev(); this.age++;
  if (this.lerpN > 0) { const k = 1 / this.lerpN; for (let i = 0; i < 3; i++) this.pos[i] += (this.netPos[i] - this.pos[i]) * k; this.lerpN--; }
  if (this.netYaw !== undefined) this.yaw += angDiff(this.netYaw + (this.netYawOff || 0), this.yaw) * 0.5;
  if (this.hurtT > 0) this.hurtT--;
  if (this.rider) { if (this.rider === p) p.followVehicle(this); else { const s = this.seat(); this.rider.pos = s; this.rider.netPos = s.slice(); this.rider.lerpN = 0; } }
}
function netItemTick() {
  this.savePrev(); this.age++;
  if (this.lerpN > 0) { const k = 1 / this.lerpN; for (let i = 0; i < 3; i++) this.pos[i] += (this.netPos[i] - this.pos[i]) * k; this.lerpN--; }
}
function netEntityTick() {
  this.savePrev();
  this.age++;
  if (this.lerpN > 0) {
    const k = 1 / this.lerpN;
    for (let i = 0; i < 3; i++) this.pos[i] += (this.netPos[i] - this.pos[i]) * k;
    this.lerpN--;
  }
  this.yaw += angDiff(this.netYaw, this.yaw) * 0.5;
  const head = this.netHead ?? this.netYaw;
  // the body follows the head once it turns too far, or while moving (vanilla's body rotation, simplified)
  const moving = Math.hypot(this.pos[0] - this.prev[0], this.pos[2] - this.prev[2]) > 0.01;
  const v = this.vehicleRef && this.vehicleRef.rider === this && this.vehicleRef.bodyYaw !== undefined ? this.vehicleRef : null;
  if (v) this.bodyYaw = v.bodyYaw; // a passenger faces the way its mount (a mob) does
  else if (moving || Math.abs(angDiff(head, this.bodyYaw)) > 0.9) this.bodyYaw += angDiff(moving ? this.yaw : head, this.bodyYaw) * 0.3;
  this.headYaw = clamp(angDiff(head, this.bodyYaw), -1.3, 1.3);
  this.pitch = this.netPitch || 0;
  if (this.swimTick) this.swimTick();
  this.animate();
  // what the drawing asks that the mob's own tick would have worked out: in water (fish swim instead of flopping,
  // squids, dolphins ...), and per kind (the dragon's wing beats and neck / tail trail)
  if (!(this instanceof EnderDragon)) this.updateFluids();
  if (this.netAnimTick) this.netAnimTick();
  if (this.hurtTime > 0) this.hurtTime--;
  if (this.swingT > 0) this.swingT--;
  if (this.deathTime > 0 && ++this.deathTime > 20) this.dead = true;
}

class NetClient {
  constructor(game, url, name, opts = {}) {
    this.g = game; this.url = url; this.name = name; this.opts = opts; this.room = null;
    this.stateMap = null; this.bookStates = new Set(); this.lecternBooks = new Set(); this.biomes = []; this.minY = -64; this.ents = new Map(); this.players = new Map();
    this.unknown = new Map(); this.missing = new Map(); this.stats = { chunks: 0, msgs: 0 };
    this.inv = new Array(40).fill(null); this.w0x = new Array(5).fill(null); this.off = null; this.win = null; this.sentSel = -1; this.unknownItems = new Set(); this.eid = 0; this.pendingItems = new Map();
    const ws = this.ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name, version: 1, proto: 1, room: opts.room, key: opts.key }));
    ws.onmessage = (e) => { this.stats.msgs++; try { if (typeof e.data === 'string') this.onMessage(JSON.parse(e.data)); else this.onBinary(e.data); } catch (err) { console.error('net', err); } };
    ws.onerror = () => { if (!this.closed) this.fail(opts.room ? '连不上联机服务器，请稍后再试' : '无法连接到联机中转 ' + url + '（中转程序没有启动？）'); };
    ws.onclose = () => { if (!this.closed) this.fail('与服务器的连接已断开'); };
  }
  send(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  close() { this.closed = true; try { this.ws.close(); } catch (e) { } }
  fail(reason) {
    if (this.closed) return;
    this.closed = true;
    const g = this.g;
    try { GuestSession.disconnected(); } catch (e) { }
    g.leaveServer(true);
    g.ui.open(new ConfirmScreen(g, '连接已断开', reason, '返回标题画面', () => g.ui.open(new TitleScreen(g))));
  }

  // ---- JSON messages ----
  onMessage(m) {
    const g = this.g, w = g.world, p = g.player;
    switch (m.t) {
      case 'states': {
        // the server's block state ids -> this game's blocks (id << 8 | meta); blocks it lacks get the closest one
        // (mapVanillaStateNear), or air
        const map = this.stateMap = new Uint32Array(m.list.length);
        this.subst = new Set(); this.bookStates = new Set();
        const wls = this.wlStates = new Uint8Array(m.list.length); // waterlogged=true states of blocks that hold water here
        m.list.forEach((s, i) => {
          if (/lectern\[[^\]]*has_book=true/.test(s)) this.bookStates.add(i); // (this game's lectern keeps only its facing)
          let r = null;
          try { r = mapVanillaStateNear(s); } catch (e) { }
          const n = s.split('[')[0];
          if (!r) { this.missing.set(n, (this.missing.get(n) || 0) + 1); r = [0, 0]; } else if (r[2]) this.subst.add(n);
          if (s.includes('waterlogged=true')) { if (!r[0]) r = [WATER, 0]; else if (canWaterlog(r[0], r[1])) wls[i] = 1; }
          map[i] = (r[0] << 8) | r[1];
        });
        break;
      }
      case 'biomes': this.biomes = m.list.map((n) => Math.max(VB_BASE, vbiomeIndex(n))); break;
      case 'login': this.eid = m.eid; try { GuestSession.connected(String(m.eid)); } catch (e) { } this.enterWorld(m, true); break;
      case 'respawn': this.enterWorld(m, false); break;
      case 'pos': {
        const r = m.rel || {};
        p.pos[0] = r.x ? p.pos[0] + m.x : m.x;
        p.pos[1] = r.y ? p.pos[1] + m.y : m.y - this.minY;
        p.pos[2] = r.z ? p.pos[2] + m.z : m.z;
        p.yaw = r.yaw ? p.yaw - m.yaw / R2D : toYaw(m.yaw);
        p.pitch = r.pitch ? p.pitch - m.pitch / R2D : -m.pitch / R2D;
        p.prev = [...p.pos]; p.vel = [0, 0, 0]; p.fallDist = 0;
        this.send({ t: 'tpok', id: m.id });
        break;
      }
      case 'abilities': p.flying = !!(m.flags & 2); p.canFly = !!(m.flags & 4); break;
      case 'mode': g.setMode(m.mode === 'adventure' ? 'survival' : m.mode, true); break;
      case 'time': g.worldTime = m.day; g.timeRate = m.rate ?? 1; if (w) w.time = m.day; break;
      case 'rain': if (m.on !== undefined) g.rainTarget = m.on ? 1 : 0; if (m.level !== undefined) { g.rainTarget = m.level; g.weather = m.level; } break;
      // (a message of several lines - a command's error and where it is - is several chat lines, in its colour)
      case 'chat': if (m.bar) g.ui.actionBar = { text: m.text, t: performance.now(), color: m.color }; else for (const l of String(m.text).split('\n')) g.ui.message(l, m.color); break;
      case 'unload': this.unload(m.cx, m.cz); break;
      // sign texts (blockents.js draws them)
      case 'signs': for (const [x, y, z, t] of m.list) g.signs.set(x + ',' + (y - this.minY) + ',' + z, t); break;
      case 'block': this.setBlock(m.x, m.y, m.z, m.s); break;
      case 'blocks': for (let i = 0; i < m.list.length; i += 4) this.setBlock(m.list[i], m.list[i + 1], m.list[i + 2], m.list[i + 3]); break;
      case 'players': this.players = new Map(m.list.map((o) => [o.uuid, o.name])); break;
      case 'spawn': this.spawn(m); break;
      case 'move': {
        const e = this.ents.get(m.id) || this.pendingItems.get(m.id); if (!e) break;
        if (m.x !== undefined) { e.netPos = [m.x, m.y - this.minY, m.z]; e.lerpN = m.tp ? 1 : 3; }
        if (m.yaw !== undefined) { e.netYaw = toYaw(m.yaw); e.netPitch = -m.pitch / R2D; }
        break;
      }
      case 'head': { const e = this.ents.get(m.id); if (e) e.netHead = toYaw(m.yaw); break; }
      case 'pass': {
        const v = this.ents.get(m.id); if (!v || !(v.isVehicle || v.seat)) break;
        const riders = m.list.map(id => id === this.eid ? p : this.ents.get(id)).filter(Boolean);
        if (v.rider && !riders.includes(v.rider)) { if (v.rider === p) { p.vehicle = null; p.rideInput = null; } else v.rider.vehicleRef = null; v.rider = null; }
        const r = riders[0];
        if (r === p) { if (p.vehicle !== v) { p.vehicle = v; v.rider = p; p.followVehicle(v); p.savePrev(); } }
        else if (r) { v.rider = r; r.vehicleRef = v; }
        break;
      }
      case 'vmove': { const v = p.vehicle; if (v) { v.pos = [m.x, m.y - this.minY, m.z]; v.yaw = toYaw(m.yaw); v.vel = [0, 0, 0]; } break; }
      case 'remove': for (const id of m.ids) { const e = this.ents.get(id); if (e) { e.dead = true; this.ents.delete(id); } this.pendingItems.delete(id); } break;
      case 'anim': { const e = this.ents.get(m.id); if (e && m.a === 0) e.swingT = 6; break; }
      case 'hurt': {
        if (m.id === this.eid) { p.hurtTime = 10; Sound.ev('entity.player.hurt', p.pos, 1, 1); break; }
        const e = this.ents.get(m.id); if (e) e.hurtTime = 10; break;
      }
      // ---- this player ----
      // ---- windows (see "windows" below) ----
      case 'open': {
        // a new window replaces whatever was open (the server has closed that one)
        const sc = g.ui.screen; if (sc && sc.net === this) sc.serverClosed = true;
        this.win = { id: m.id, kind: m.kind, title: m.title, slots: [], props: [], trades: null };
        break;
      }
      case 'win': {
        const id = m.id, w = this.win, mine = !!w && w.id === id;
        if (id !== 0 && !mine) break;
        if (mine && w.n === undefined) w.n = w.kind === 'lectern' ? m.items.length : w.kind === 'crafter_3x3' ? 9 : Math.max(0, m.items.length - 36);
        m.items.forEach((o, v) => this.slotSet(id, v, this.stackIn(o)));
        if (this.screenFor(id)) g.ui.cursor = this.stackIn(m.carried);
        this.applyInv();
        if (mine && !w.screen) this.openWindow(w); // the contents follow the opening: now it can be shown
        break;
      }
      case 'wslot': if (m.id === 0 || (this.win && this.win.id === m.id)) { this.slotSet(m.id, m.i, this.stackIn(m.item)); this.applyInv(); } break;
      case 'cursor': if (g.ui.screen && g.ui.screen.net === this) g.ui.cursor = this.stackIn(m.item); break;
      case 'wclose': {
        const sc = this.screenFor(m.id);
        if (sc) { sc.serverClosed = true; g.ui.close(); }
        if (this.win && this.win.id === m.id) this.win = null;
        break;
      }
      case 'prop': if (this.win && this.win.id === m.id) { this.win.props[m.k] = m.v; if (m.name !== undefined) (this.win.pnames || (this.win.pnames = {}))[m.k] = m.name; } break;
      case 'trades': if (this.win && this.win.id === m.id) Object.assign(this.win, { trades: m.list, level: m.level, xp: m.xp, regular: m.regular, offers: null }); break;
      case 'pinv': {
        const s = this.stackIn(m.item);
        if (m.i === 40) this.off = s; else { const i = pinvToOurs(m.i); if (i >= 0) this.inv[i] = s; }
        this.applyInv(); break;
      }
      case 'held': p.inv.sel = this.sentSel = m.slot; break;
      // status effects: the server's (effects.js counts them down and applies what moving and seeing need)
      case 'effect': if (m.e) { (p.effects || (p.effects = new Map())).set(m.e, { amp: m.amp, dur: m.dur, ambient: !!(m.f & 1), hidden: !(m.f & 4), max: m.dur }); } break;
      case 'uneffect': if (p.effects) p.effects.delete(m.e); break;
      case 'health':
        p.health = m.hp; p.food = m.food; p.saturation = m.sat;
        if (m.hp <= 0 && p.deathTime === 0) {
          p.deathTime = 1; g.deathMsg = this.deathMsg || '你死了'; p.usingItem = null;
          // joined while dead: the server sends no world until the respawn, so the death screen comes at once
          if (g.state === 'loading') { g.state = 'play'; g.ui.open(new DeathScreen(g)); }
          else setTimeout(() => { if (g.net === this && g.state === 'play') g.ui.open(new DeathScreen(g)); }, 1000);
        } else if (m.hp > 0 && p.deathTime > 0) { p.deathTime = 0; if (g.ui.screen instanceof DeathScreen) g.ui.close(); }
        break;
      // the level and the bar (the total isn't kept up by vanilla's "xp add ... levels")
      case 'xp': p.xp = g.xpTotalFor(m.level) + Math.round(m.bar * g.xpNeeded(m.level)); break;
      case 'death': this.deathMsg = m.msg; g.ui.message(m.msg); break;
      // ---- what entities hold and look like ----
      case 'equip': { const e = this.ents.get(m.id); if (e) { const s = this.stackIn(m.item); e.heldId = s && !s.unk ? s.id : null; } break; }
      case 'meta': {
        const e = this.ents.get(m.id) || this.pendingItems.get(m.id);
        if (!e) break;
        if (m.pose !== undefined) { e.sneaking = m.pose === 'crouching' || m.pose === 5; e.netSwim = m.pose === 'swimming' || m.pose === 3; }
        if (m.item !== undefined && e instanceof ItemEntity) {
          const s = this.stackIn(m.item);
          if (s && !s.unk) { e.stack = s; if (this.pendingItems.delete(m.id)) { g.entities.push(e); this.ents.set(m.id, e); } }
        }
        break;
      }
      case 'collect': { const e = this.ents.get(m.id); if (e) { e.dead = true; this.ents.delete(m.id); if (m.by === this.eid) Sound.pop && Sound.pop(p.pos); } break; }
      case 'status': { const e = this.ents.get(m.id); if (e && m.s === 3) e.deathTime = 1; break; }
      case 'kick': this.fail(m.reason || '被服务器断开'); break;
      // the room service: waiting for the room's server, then which room this is
      case 'notice': if (g.ui.screen instanceof LoadingScreen) { g.ui.screen.text = m.text; g.ui.screen.setQueue(null); } else g.ui.message(m.text, '#AAAAAA'); break;
      // the server's rooms are full: this room waits its turn (rooms.js queue)
      case 'queue': if (g.ui.screen instanceof LoadingScreen) g.ui.screen.setQueue(m); break;
      case 'room':
        this.room = m; g.ui.message('已进入房间「' + m.name + '」，邀请码 ' + m.code + '（暂停菜单 → 房间：邀请朋友、看玩家' + (m.isOwner ? '、管理' : '、举报') + '）', '#FFFF55');
        // the sponsor line (its text and how long it stays put come from the room service's config)
        if (m.sponsorText) { const q = { text: String(m.sponsorText).slice(0, 80), ms: clamp(+m.sponsorSeconds || 30, 0, 300) * 1000 }; if (g.state === 'play') g.ui.pinMessage(q.text, q.ms); else g.pendingPin = q; }
        break;
      case 'error': console.warn('proxy:', m.msg); break;
    }
  }
  // a new dimension (or the first): a fresh remote world
  enterWorld(m, first) {
    const g = this.g;
    if (g.world) g.unloadAll();
    setWorldFormat(2);
    if (!NetClient.biomesReady) { initVanillaBiomes(g.renderer.grassMap, g.renderer.foliageMap); NetClient.biomesReady = true; }
    const dim = m.dim;
    const w = new World(0, dim);
    w.gen2 = true; w.remote = true; w.minY = m.minY; w.seedStr = '0'; w.structures = false;
    w.grassMap = g.renderer.grassMap; w.foliageMap = g.renderer.foliageMap; w.listener = g;
    w.useCW = !!(g.chunkWorker && g.chunkWorker.ready && !g.chunkWorker.failed);
    this.minY = m.minY;
    g.world = w; g.dim = dim; g.dimData = null;
    g.entities = []; g.blockEntities = new Map(); g.signs = new Map(); g.particles.list = []; g.genQueue = []; g.meshQueue = [];
    g.genEpoch = (g.genEpoch || 0) + 1; g._lastCC = null; g.meshResQ = [];
    this.ents.clear();
    if (first) {
      const p = g.player = new Player(g, 0.5, 100, 0.5);
      p.hurt = () => false; // health is the server's (stage 3)
      g.worldMeta = null; g.hardcore = false; g.difficulty = 2; g.cheats = false; g.tutorial = -1; g.tutStat = { moved: 0 };
      g.adv = {}; g.stats = { kills: 0, placed: 0, mined: 0 }; g.welcome = false; g.iconAt = 0; g.sleeping = null; g.portalOverlay = 0;
    } else g.player.world = w;
    g.mode = m.mode === 'adventure' ? 'survival' : (m.mode || 'survival');
    g.state = 'loading'; g.loadStart = performance.now();
    if (g.ui.screen && g.ui.screen.net === this) g.ui.screen.serverClosed = true; // the server closes windows itself
    this.win = null;
    g.ui.open(new LoadingScreen(g, first ? '正在加入服务器…' : '正在进入' + (DIM_CN[dim] || dim) + '…'));
  }

  // ---- blocks ----
  setBlock(x, y, z, s) {
    const w = this.g.world; if (!w) return;
    const v = this.stateMap[s] || 0, yy = y - this.minY;
    // the cell's water comes with the server's state (taken off first: world.setBlock would leave it as water)
    const ch = w.getChunk(x >> 4, z >> 4), i = (yy << 8) | ((z & 15) << 4) | (x & 15), was = !!(ch && ch.wl && ch.wl.delete(i));
    w.setBlock(x, yy, z, v >> 8, v & 255, 0);
    if (ch && this.wlStates[s]) (ch.wl || (ch.wl = new Set())).add(i);
    if (ch && was !== !!this.wlStates[s]) w.markBlock(ch, x & 15, yy, z & 15);
    const k = x + ',' + yy + ',' + z;
    if (this.bookStates.has(s)) this.lecternBooks.add(k); else this.lecternBooks.delete(k);
  }
  unload(cx, cz) {
    const g = this.g, w = g.world, k = ckey(cx, cz);
    if (!w || !w.chunks.has(k)) return;
    g.renderer.dropChunk(cx, cz);
    w.chunks.delete(k);
    for (const sk of g.signs.keys()) { const [x, , z] = sk.split(','); if ((x >> 4) === cx && (z >> 4) === cz) g.signs.delete(sk); }
    this.dropBooks(cx, cz);
    if (g.meshVer) for (let sy = 0; sy < SECTIONS; sy++) g.meshVer.delete(k * 32 + sy);
  }
  // forgets the books on a chunk's lecterns (it is unloaded, or sent again)
  dropBooks(cx, cz) { for (const k of this.lecternBooks) { const [x, , z] = k.split(','); if ((x >> 4) === cx && (z >> 4) === cz) this.lecternBooks.delete(k); } }
  // ---- binary: chunks (type 1) and light updates (type 2), layout in multiplayer/proxy/src/chunk.js ----
  onBinary(buf) {
    const g = this.g, w = g.world; if (!w || !this.stateMap) return;
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    let p = 0;
    const type = dv.getUint8(p), cx = dv.getInt32(p + 1, true), cz = dv.getInt32(p + 5, true), n = dv.getUint8(p + 9); p += 10;
    const k = ckey(cx, cz);
    let ch = w.chunks.get(k);
    if (type === 1) { ch = new Chunk(cx, cz); this.stats.chunks++; }
    else if (!ch) return;
    const L = new Uint8Array(4096), map = this.stateMap, bs = this.bookStates, wls = this.wlStates;
    let topSky = -1; const noSky = [];
    if (type === 1) this.dropBooks(cx, cz);
    for (let s = 0; s < n; s++) {
      const len = dv.getUint16(p, true); p += 2;
      const pal = new Array(len);
      let books = null, wet = null; // palette entries that are lecterns with a book / waterlogged
      for (let i = 0; i < len; i++, p += 2) {
        const raw = dv.getUint16(p, true); pal[i] = map[raw] || 0;
        if (bs.size && bs.has(raw)) (books || (books = new Set())).add(i);
        if (wls && wls[raw]) (wet || (wet = new Set())).add(i);
      }
      let idx = null;
      if (len > 1) { if (len <= 256) { idx = u8.subarray(p, p + 4096); p += 4096; } else { idx = new Uint16Array(buf.slice(p, p + 8192)); p += 8192; } }
      if (wet && type === 1 && s < SECTIONS) for (let j = 0; j < 4096; j++) if (wet.has(idx ? idx[j] : 0)) (ch.wl || (ch.wl = new Set())).add((s << 12) | j);
      if (books && type === 1 && s < SECTIONS) for (let j = 0; j < 4096; j++) if (books.has(idx ? idx[j] : 0)) this.lecternBooks.add((cx * 16 + (j & 15)) + ',' + (s * 16 + (j >> 8)) + ',' + (cz * 16 + ((j >> 4) & 15)));
      if (type === 1 && s < SECTIONS) this.putSection(ch, s, pal, idx);
      const f = u8[p++], sky = f & 1 ? u8.subarray(p, p + 2048) : null; if (sky) p += 2048;
      const bl = f & 2 ? u8.subarray(p, p + 2048) : null; if (bl) p += 2048;
      if (type === 1 && s < SECTIONS) { if (sky) topSky = s; else noSky.push(s); }
      if (s >= SECTIONS || (!sky && !bl && type === 2)) continue;
      // light: sky << 4 | block, a nibble array each; a half that isn't sent keeps its value (updates) or is 0
      for (let j = 0; j < 4096; j++) {
        const sh = (j & 1) << 2, old = type === 2 ? ch.getL((s << 12) | j) : 0;
        L[j] = ((sky ? (sky[j >> 1] >> sh) & 15 : old >> 4) << 4) | (bl ? (bl[j >> 1] >> sh) & 15 : old & 15);
      }
      const v = L[0]; let uni = true; for (let j = 1; j < 4096; j++) if (L[j] !== v) { uni = false; break; }
      if (uni) { ch.ls[s] = null; ch.lu[s] = v; } else ch.ls[s] = L.slice();
      if (type === 2) this.markSection(cx, cz, s);
    }
    if (type !== 1) return;
    // vanilla sends no sky light for the air above the highest lit section: there it is full daylight
    for (const s of noSky) if (s > topSky) { if (ch.ls[s]) { const a = ch.ls[s]; for (let j = 0; j < 4096; j++) a[j] |= 0xF0; } else ch.lu[s] = 0xF0 | (ch.lu[s] & 15); }
    for (let c = 0; c < 256; c++) ch.biome[c] = this.biomes[u8[p + c]] || VB_BASE;
    ch.lit = true; ch.final = true;
    ch.recount();
    w.chunks.set(k, ch);
    g.chunkTints(ch);
    ch.dirty = ALL_SECTIONS;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const nb = w.getChunk(cx + a, cz + b); if (nb && nb !== ch) nb.dirty |= ALL_SECTIONS; }
  }
  // one section: the palette of (id << 8 | meta) and the cells' palette indices -> this game's sections
  putSection(ch, s, pal, idx) {
    const ids = [], pos = new Map();
    let anyMeta = false, solid = false;
    const local = pal.map((v) => { const id = v >> 8; if (v & 255) anyMeta = true; if (id) solid = true; let i = pos.get(id); if (i === undefined) { i = ids.length; pos.set(id, i); ids.push(id); } return i; });
    if (!solid) return;
    const d = new Uint8Array(4096), mt = anyMeta ? new Uint8Array(4096) : null;
    if (ids.length > 256) { // more kinds than one byte holds: plain ids
      const raw = new Uint16Array(4096);
      for (let j = 0; j < 4096; j++) { const v = pal[idx ? idx[j] : 0]; raw[j] = v >> 8; if (mt) mt[j] = v & 255; }
      ch.bs[s] = { p: SEC_IDENT, n: -1, d: raw };
    } else {
      const P = new Uint16Array(256); P.set(ids);
      for (let j = 0; j < 4096; j++) { const i = idx ? idx[j] : 0; d[j] = local[i]; if (mt) mt[j] = pal[i] & 255; }
      ch.bs[s] = { p: P, n: ids.length, d };
    }
    ch.ms[s] = mt;
  }
  markSection(cx, cz, s) {
    const w = this.g.world;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const c = w.getChunk(cx + a, cz + b); if (c) c.dirty |= (1 << s) | (s > 0 ? 1 << (s - 1) : 0) | (1 << (s + 1)); }
  }

  // ---- entities ----
  spawn(m) {
    const g = this.g;
    if (this.ents.has(m.id)) return;
    let e;
    const y = m.y - this.minY;
    if (m.type === 'item') {
      // shown once the server says which item it is (entity data follows the spawn)
      const it = new ItemEntity(g, m.x, y, m.z, { id: ITEM_KEY.stone, count: 1 }, [0, 0, 0]);
      it.netId = m.id; it.remote = true; it.tick = netItemTick; it.netPos = [m.x, y, m.z]; it.lerpN = 0; it.pickup = 1e9;
      this.pendingItems.set(m.id, it);
      return;
    }
    if (m.type === 'player') e = new NetPlayer(g, m.x, y, m.z, m.name || this.players.get(m.uuid));
    else if (NET_MOBS.has(m.type)) e = createMob(g, m.type, m.x, y, m.z);
    else if (/_(chest_)?(boat|raft)$/.test(m.type) || /(^|_)minecart$/.test(m.type)) {
      // boats and minecarts: drawn by vehicles.js, moved by the server (or by this client while it steers a boat)
      const bm = /^(\w+?)_(chest_)?(boat|raft)$/.exec(m.type);
      e = bm ? new Boat(g, m.x, y, m.z, bm[1], !!bm[2]) : new Minecart(g, m.x, y, m.z, m.type === 'minecart' ? '' : m.type.replace(/_minecart$/, ''));
      e.netId = m.id; e.remote = true; e.alwaysTick = true; e.tick = netVehicleTick; e.hurt = () => false;
      e.netPos = [m.x, y, m.z]; e.lerpN = 0; e.netYaw = e.yaw = toYaw(m.yaw) + (bm ? 0 : Math.PI / 2);
      if (!bm) e.netYawOff = Math.PI / 2;
      g.entities.push(e); this.ents.set(m.id, e);
      return;
    }
    else { this.unknown.set(m.type, (this.unknown.get(m.type) || 0) + 1); return; }
    e.netId = m.id; e.remote = true; e.persistent = true; e.alwaysTick = true;
    e.tick = netEntityTick;
    e.netPos = [m.x, y, m.z]; e.lerpN = 0;
    e.netYaw = e.yaw = e.bodyYaw = e.prevBodyYaw = toYaw(m.yaw); e.netPitch = -m.pitch / R2D;
    e.hurt = () => false;
    g.entities.push(e); this.ents.set(m.id, e);
  }

  // ---- inventory ----
  // the proxy's stack -> this game's; an item this game lacks stays in its slot as "unknown" (drawn as a missing
  // texture), so moving it around still works
  stackIn(o) {
    if (!o) return null;
    const id = ITEM_KEY[o.n], s = { id, count: o.c, dmg: o.d || 0 };
    if (id === undefined) { this.unknownItems.add(o.n); s.id = ITEM_KEY.stone; s.unk = o.n; }
    if (o.x) s.x = o.x;
    if (o.name) s.name = o.name;
    if (o.e) s.e = o.e;
    if (o.pot) s.pot = o.pot;
    if (o.g !== undefined) s.g = o.g;
    if (o.ch) s.charged = o.ch.map(c => this.stackIn(c));
    return s;
  }
  applyInv() { const s = this.g.player.inv.slots; for (let i = 0; i < 40; i++) s[i] = this.inv[i] ? { ...this.inv[i] } : null; s[40] = this.off ? { ...this.off } : null; }

  // ---- windows ----
  // a slot by the server's numbering: window 0 is this player's (0 crafting result, 1-4 the 2x2 grid, 5-8 armour,
  // 9-35 main, 36-44 hotbar, 45 offhand); an open container's has its own n slots, then the main inventory and
  // the hotbar
  slotGet(id, v) {
    if (id === 0) return v < 5 ? this.w0x[v] : v < 9 ? this.inv[36 + v - 5] : v < 36 ? this.inv[v] : v < 45 ? this.inv[v - 36] : v === 45 ? this.off : null;
    const w = this.win; if (!w || w.id !== id || v < 0) return null;
    if (v < w.n) return w.slots[v];
    const j = v - w.n;
    return j < 27 ? this.inv[9 + j] : j < 36 ? this.inv[j - 27] : null;
  }
  slotSet(id, v, s) {
    if (id === 0) {
      if (v < 5) this.w0x[v] = s; else if (v < 9) this.inv[36 + v - 5] = s; else if (v < 36) this.inv[v] = s; else if (v < 45) this.inv[v - 36] = s; else if (v === 45) this.off = s;
      return;
    }
    const w = this.win; if (!w || w.id !== id || v < 0) return;
    if (v < w.n) { w.slots[v] = s; return; }
    const j = v - w.n;
    if (j < 27) this.inv[9 + j] = s; else if (j < 36) this.inv[j - 27] = s;
  }
  screenFor(id) { const sc = this.g.ui.screen; return sc && sc.net === this && sc.netWin === id ? sc : null; }
  // the survival inventory (E): window 0 in this game's inventory screen, with the offhand slot
  inventoryScreen() {
    const sc = new CraftingScreen(this.g, 2);
    this.netify(sc, 0, [1, 2, 3, 4, 0, 5, 6, 7, 8], 9);
    sc.slots.push(this.netSlot(sc, { x: 77, y: 62 }, 45));
    return sc;
  }
  // a container the server opened, in this game's screen for it; the kinds without one show their slots in rows
  openWindow(w) {
    const g = this.g, k = w.kind, n = w.n;
    let sc, pre;
    if (k === 'lectern') { sc = this.lecternScreen(w); w.screen = sc; g.ui.open(sc); return; }
    if (k === 'crafting') { sc = new CraftingScreen(g, 3); pre = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]; }
    else if (k === 'furnace' || k === 'blast_furnace' || k === 'smoker') {
      // the window's properties: 0 burn time left, 1 the fuel's burn time, 2 cooking progress, 3 cooking time
      const P = w.props, be = { get burn() { return P[0] || 0; }, get burnMax() { return P[1] || 200; }, get cook() { return P[3] ? (P[2] || 0) / P[3] * 200 : 0; } };
      sc = new FurnaceScreen(g, be); sc.title = w.title; pre = [0, 1, 2];
    } else if (k === 'merchant') {
      sc = new MerchantScreen(g, this.merchantView(w)); pre = [0, 1, 2];
      Object.defineProperty(sc, 'title2', { get: () => w.title + (w.regular && w.level ? ' - ' + LEVEL_CN[w.level - 1] : '') });
      // choosing a trade: the server moves the payment into the slots
      sc.pick = (i) => { sc.sel = i; this.send({ t: 'trade', i }); };
      sc.update = () => { };
    } else if (NET_STATION[k]) {
      sc = NET_STATION[k](this, w); pre = [...Array(n).keys()];
    } else {
      const rows = /^generic_9x\d$/.test(k) ? +k.slice(-1) : k === 'shulker_box' ? 3 : Math.max(1, Math.ceil(n / 9));
      const full = /^generic_|^shulker_box$|^hopper$|^crafter_3x3$/.test(k);
      sc = new ContainerScreen(g, 'generic_54', 176, 114 + rows * 18, w.title + (full ? '' : '（暂不完整支持）'));
      sc.rows = rows; sc.drawBase = ChestScreen.prototype.drawBase;
      // the background's slots past the window's own: covered with the panel colour
      sc.drawExtra = (ui) => { ui.ctx.fillStyle = '#C6C6C6'; for (let i = n; i < rows * 9; i++) ui.ctx.fillRect(sc.x + 7 + (i % 9) * 18, sc.y + 17 + Math.floor(i / 9) * 18, 18, 18); };
      for (let i = 0; i < n; i++) sc.slots.push({ x: 8 + (i % 9) * 18, y: 18 + Math.floor(i / 9) * 18, output: NET_OUTPUT[k] === i });
      if (k !== 'lectern') sc.addPlayerSlots(31 + rows * 18, 89 + rows * 18);
      pre = [...Array(n).keys()];
    }
    this.netify(sc, w.id, pre, n);
    if (sc.onNetClose) { const c = sc.close; sc.close = function () { c.call(this); this.onNetClose(); }; }
    w.screen = sc;
    g.ui.open(sc);
  }
  // a lectern: its book (window slot 0) in the book screen, property 0 the page; turning pages and taking the book
  // are window buttons like vanilla's LecternScreen (1 back, 2 forward, 3 take, 100 + n page n)
  lecternScreen(w) {
    const n = this, P = w.props;
    const sc = new BookScreen(this.g, { pages: [] }, false, { pos: null, get page() { return P[0] || 0; }, set page(v) { n.send({ t: 'button', id: w.id, b: 100 + v }); } });
    Object.defineProperty(sc, 'pages', { get: () => { const b = w.slots[0]; return b && b.pages && b.pages.length ? b.pages : ['']; }, set: () => { } });
    Object.defineProperty(sc, 'page', { get: () => clamp(P[0] || 0, 0, sc.pages.length - 1), set: (v) => { P[0] = v; } });
    const md = sc.mouseDown, cl = sc.close;
    sc.mouseDown = function (ui, mx, my) {
      const take = this.btns().find((b) => b.act === 'take');
      if (take && ui.hit(take, mx, my)) { Sound.click && Sound.click(); n.send({ t: 'button', id: w.id, b: 3 }); ui.close(); return; }
      md.call(this, ui, mx, my);
    };
    sc.net = this; sc.netWin = w.id;
    sc.close = function () { cl.call(this); if (!this.serverClosed) n.send({ t: 'wclose', id: w.id }); if (n.win && n.win.id === w.id) n.win = null; };
    return sc;
  }
  // a villager's trades as MerchantScreen shows them (the first price adjusted like vanilla's getCostA)
  merchantView(w) {
    return {
      restock() { }, pos: this.g.player.pos,
      get vlevel() { return w.regular ? w.level || 1 : 5; }, get vxp() { return w.xp || 0; },
      offers: () => w.offers || (w.offers = (w.trades || []).map((o) => {
        const a = this.stackIn(o.a), b = o.b && this.stackIn(o.b), r = this.stackIn(o.r);
        if (!a || !r) return null;
        const an = clamp(a.count + Math.max(0, Math.floor(a.count * o.dem * o.mul)) + o.sp, 1, maxStack(a.id));
        return { a: a.id, an, b: b ? b.id : null, bn: b ? b.count : 0, r: r.id, rn: r.count, used: o.off ? o.max : o.used, uses: o.max };
      }).filter(Boolean)),
    };
  }
  // a screen made for this game's own containers, turned into one of the server's windows: its slots read and
  // write the window (pre: the window slots of the screen's own slots in order, then the inventory from first)
  netify(sc, id, pre, first) {
    sc.net = this; sc.netWin = id;
    sc.slots = sc.slots.map((s, i) => this.netSlot(sc, s, i < pre.length ? pre[i] : first + i - pre.length));
    Object.assign(sc, NET_SCREEN);
    // (a crafting screen's recipe book shows the server's recipes: netRecipes at the end of this file)
  }
  netSlot(sc, s, v) {
    const k = this.win && sc.netWin === this.win.id ? this.win.kind : 'player';
    let accept = null;
    if (sc.netWin === 0 && v >= 5 && v <= 8) accept = (st) => !!ITEMS[st.id].armor && !st.unk && ITEMS[st.id].armor.slot === v - 5;
    else if (/furnace|smoker/.test(k) && v === 1) accept = (st) => fuelValue(st.id) > 0 || st.id === ITEM_KEY.bucket;
    const output = !!s.output || (v === 0 && (sc.netWin === 0 || k === 'crafting')) || (v === 2 && /furnace|smoker|merchant/.test(k));
    if (!accept && s.accept && sc.netWin !== 0) accept = s.accept; // what the screen's own slots take (a loom's banner, dye ...)
    return { x: s.x, y: s.y, v, output, accept, max: sc.netWin === 0 && v >= 5 && v <= 8 ? 1 : s.max || 0, emptyIcon: s.emptyIcon, group: s.group,
      get: () => this.slotGet(sc.netWin, v), set: (st) => this.slotSet(sc.netWin, v, st) };
  }
  // a click: worked out here (predict), then sent with the slots that changed and what the cursor holds now.
  // mode / button as vanilla's: 0 pick up (left / right), 1 quick move (shift), 2 swap with a hotbar slot (0-8,
  // 40 offhand), 3 clone (creative), 4 throw (one / all), 5 drag (start / add / end), 6 gather (double click)
  click(sc, v, button, mode, predict = () => this.predict(sc, v, button, mode)) {
    const ui = this.g.ui, before = new Map(sc.slots.map((s) => [s.v, s.get()]));
    if (predict) try { predict(); } catch (e) { console.warn('net predict', e); }
    const changed = [];
    for (const s of sc.slots) { const a = before.get(s.v), b = s.get(); if (a !== b && !sameStack(a, b)) changed.push([s.v, netStack(b)]); }
    this.send({ t: 'click', id: sc.netWin, slot: v, button, mode, changed, carried: netStack(ui.cursor) });
    this.applyInv();
  }
  // a drag over several slots: start, each slot, end (the items are spread at the end)
  drag(sc, list, b) {
    const t = b === 0 ? 0 : 4;
    this.click(sc, -999, t, 5, null);
    for (const s of list) this.click(sc, s.v, t + 1, 5, null);
    this.click(sc, -999, t + 2, 5, () => {
      const ui = this.g.ui, C = ui.cursor; if (!C) return;
      const per = b === 0 ? Math.floor(C.count / list.length) : 1;
      if (per < 1) return;
      let left = C.count;
      for (const s of list) {
        const S = s.get();
        if ((S && !sameItem(S, C)) || !netMayPlace(s, C)) continue;
        const have = S ? S.count : 0, k = Math.min(per, netMax(s, C) - have, left);
        if (k <= 0) continue;
        s.set({ ...(S || C), count: have + k }); left -= k;
      }
      ui.cursor = left > 0 ? { ...C, count: left } : null;
    });
  }
  // vanilla's click rules (AbstractContainerMenu.doClick), for what this game can tell; stacks are replaced, never
  // changed in place, so the slots that changed can be found afterwards. Results (crafting, furnace, trades) are
  // left to the server.
  predict(sc, v, b, mode) {
    const ui = this.g.ui, C = ui.cursor, slot = v >= 0 ? sc.slots.find((s) => s.v === v) : null, S = slot && slot.get();
    const cp = (st, c) => c > 0 ? { ...st, count: c } : null;
    if (mode === 0 && v === -999) { if (C) ui.cursor = b === 0 ? null : cp(C, C.count - 1); return; }
    // a trade's result taken: one more use of it (the server doesn't send the trades again)
    const mw = this.win;
    if (slot && slot.output && S && mode === 0 && mw && mw.kind === 'merchant' && mw.trades && mw.trades[sc.sel] && (!C || (sameItem(C, S) && C.count + S.count <= netMax({}, S)))) { mw.trades[sc.sel].used++; mw.offers = null; }
    if (!slot || slot.output) return;
    if (mode === 0) {
      if (b === 0) {
        if (!S) { if (C && netMayPlace(slot, C)) { const k = Math.min(C.count, netMax(slot, C)); slot.set(cp(C, k)); ui.cursor = cp(C, C.count - k); } }
        else if (!C) { ui.cursor = S; slot.set(null); }
        else if (sameItem(S, C)) { if (netMayPlace(slot, C)) { const k = Math.max(0, Math.min(C.count, netMax(slot, S) - S.count)); slot.set(cp(S, S.count + k)); ui.cursor = cp(C, C.count - k); } }
        else if (netMayPlace(slot, C) && C.count <= netMax(slot, C)) { slot.set(C); ui.cursor = S; }
      } else if (b === 1) {
        if (!C) { if (S) { const k = Math.ceil(S.count / 2); ui.cursor = cp(S, k); slot.set(cp(S, S.count - k)); } }
        else if (!S) { if (netMayPlace(slot, C)) { slot.set(cp(C, 1)); ui.cursor = cp(C, C.count - 1); } }
        else if (sameItem(S, C)) { if (netMayPlace(slot, C) && S.count < netMax(slot, S)) { slot.set(cp(S, S.count + 1)); ui.cursor = cp(C, C.count - 1); } }
        else if (netMayPlace(slot, C) && C.count <= netMax(slot, C)) { slot.set(C); ui.cursor = S; }
      }
    } else if (mode === 1) this.predictQuickMove(sc, slot);
    else if (mode === 2) {
      // the hotbar slot (or the offhand) in this window
      const w = sc.netWin === 0 ? null : this.win;
      const hv = b === 40 ? (w ? null : 45) : (w ? w.n + 27 + b : 36 + b);
      if (hv === v) return;
      const H = hv === null ? this.off : this.slotGet(sc.netWin, hv), hset = (st) => { if (hv === null) this.off = st; else this.slotSet(sc.netWin, hv, st); };
      if (!H) { if (S) { hset(S); slot.set(null); } }
      else if (!S) { if (netMayPlace(slot, H)) { const k = Math.min(H.count, netMax(slot, H)); slot.set(cp(H, k)); hset(cp(H, H.count - k)); } }
      else if (netMayPlace(slot, H) && H.count <= netMax(slot, H)) { slot.set(H); hset(S); }
    } else if (mode === 3) { if (this.g.mode === 'creative' && S && !C) ui.cursor = cp(S, netMax({}, S)); }
    else if (mode === 4) { if (S && !C) slot.set(b === 0 ? cp(S, S.count - 1) : null); }
    else if (mode === 6 && C) {
      // gather: from the slots in order, stacks that aren't full first
      let c = C;
      const list = [...sc.slots].sort((a, d) => a.v - d.v);
      for (let pass = 0; pass < 2; pass++) for (const s of list) {
        if (c.count >= netMax({}, c)) break;
        const T = s.get();
        if (!T || s.output || !sameItem(T, c) || (pass === 0 && T.count >= netMax({}, T))) continue;
        const k = Math.min(T.count, netMax({}, c) - c.count);
        c = cp(c, c.count + k); s.set(cp(T, T.count - k));
      }
      ui.cursor = c;
    }
  }
  // shift-click (quickMoveStack) for the inventory and the plain containers; other windows wait for the server
  predictQuickMove(sc, slot) {
    const id = sc.netWin, S = slot.get(), v = slot.v;
    if (!S) return;
    const move = (from, to, rev) => netMoveTo(sc, slot, from, to, rev);
    if (id === 0) {
      const a = ITEMS[S.id].armor;
      if (v >= 1 && v <= 8) move(9, 45, false);
      else if (a && !S.unk && !this.slotGet(0, 5 + a.slot)) { this.slotSet(0, 5 + a.slot, { ...S, count: 1 }); slot.set(S.count > 1 ? { ...S, count: S.count - 1 } : null); }
      else if (v >= 9 && v < 36) move(36, 45, false);
      else if (v >= 36 && v < 45) move(9, 36, false);
      else if (v === 45) move(9, 45, false);
      return;
    }
    const w = this.win;
    if (!w || !/^generic_|^shulker_box$|^hopper$/.test(w.kind)) return;
    if (v < w.n) move(w.n, w.n + 36, true); else move(0, w.n, false);
  }
  // ---- each game tick: this player's position, keys, held slot and (creative) inventory for the server ----
  tick() {
    const g = this.g, p = g.player;
    if (!p || g.state !== 'play') return;
    if (p.inv.sel !== this.sentSel) { this.sentSel = p.inv.sel; this.send({ t: 'held', slot: p.inv.sel }); }
    if (g.mode === 'creative') {
      // creative mode sets slots itself (the creative inventory, picking a block)
      for (let i = 0; i <= 40; i++) {
        const s = p.inv.slots[i], had = i === 40 ? this.off : this.inv[i];
        if (sameStack(s, had)) continue;
        if (i === 40) this.off = s ? { ...s } : null; else this.inv[i] = s ? { ...s } : null;
        this.send({ t: 'creative', slot: oursToWin(i), item: netStack(s) });
      }
    } else if (!(g.ui.screen instanceof ContainerScreen)) {
      // survival: the inventory is the server's (moved around through windows)
      for (let i = 0; i < 40; i++) if (!sameStack(p.inv.slots[i], this.inv[i])) { this.applyInv(); break; }
    }
    const input = g.ui.screen ? null : g.readInput();
    const keys = input && { f: input.fwd > 0, b: input.fwd < 0, l: input.strafe < 0, r: input.strafe > 0, j: input.jump, s: input.sneak, sp: !!p.sprinting };
    const v = p.vehicle;
    if (v) {
      // riding: the look and keys; a boat is moved here and its place and paddles sent (vehicle_move / steer_boat)
      const boat = v instanceof Boat;
      this.send({ t: 'tick', look: [fromYaw(p.yaw), -p.pitch * R2D], keys,
        // (only for what this client steers, like vanilla: a minecart is the server's - sending its place back pinned it)
        vmove: boat || (v.vm && v.ridden) ? [v.pos[0], v.pos[1] + this.minY, v.pos[2], fromYaw(v.yaw), 0, v.onGround] : null,
        paddles: boat && input ? [input.fwd > 0 || input.strafe > 0, input.fwd > 0 || input.strafe < 0] : null });
      return;
    }
    this.send({ t: 'tick', pos: [p.pos[0], p.pos[1] + this.minY, p.pos[2], fromYaw(p.yaw), -p.pitch * R2D, p.onGround, p.collidedH], keys });
  }
  // drop the held item (or the whole stack): like vanilla's client, take it out at once - the server doesn't
  // send the slot back
  drop(all) {
    const p = this.g.player, i = p.inv.sel, s = p.inv.slots[i];
    if (!s) return;
    this.send({ t: 'drop', all });
    const left = all ? 0 : s.count - 1;
    p.inv.slots[i] = left > 0 ? { ...s, count: left } : null;
    this.inv[i] = p.inv.slots[i] ? { ...p.inv.slots[i] } : null;
  }
  // a block action: dig (0 start, 1 abort, 2 finish) at a target
  dig(status, t) {
    this.send({ t: 'dig', status, x: t.pos[0], y: t.pos[1] + this.minY, z: t.pos[2], face: NET_FACE[t.face] ?? 1 });
    this.digging = status === 0 ? { key: t.pos.join(','), t } : null;
  }
  chat(text) { this.send({ t: 'chat', text }); }
  // name tags over the other players, in the world like vanilla's: a fixed size over the head (they were drawn on the
  // interface canvas, the same size at every distance - growing and shrinking against the player, 2026-10-31), seen
  // faintly through walls; one sneaking: dimmed, hidden by walls; none for the invisible
  drawNames(a) {
    const g = this.g;
    for (const e of g.entities) {
      if (!(e instanceof NetPlayer) || e.dead || e.invisible) continue;
      const h = e.netSwim || e.gliding ? 0.6 : e.sneaking ? 1.5 : e.h;
      g.drawNameTag(e, e.ipos(a), e.name, { color: (this.colors && this.colors.get(e.name)) || '#FFFFFF', max: 64, h, through: !e.sneaking, faded: e.sneaking });
    }
  }
}

// ---- windows: slot rules and the screen methods that send clicks ----
// the result slot of the kinds shown as plain rows
const NET_OUTPUT = { anvil: 2, grindstone: 2, smithing: 3, cartography_table: 2, stonecutter: 1, loom: 3 };
// the processing blocks' windows in workstations.js's screens: their own slots are the window's first ones, in
// order; what the server works out (the offers, the cost, the chosen recipe, the brewing) comes as window properties
const NET_STATION = {
  // properties: 0-2 the levels of the offers, 3 the seed of the words, 4-6 the hinted enchantments, 7-9 their levels
  enchantment(n, w) {
    const P = w.props, sc = new EnchantingScreen(n.g, null, w.title);
    sc.changed = () => { };
    Object.defineProperty(sc, 'offers', { get: () => [0, 1, 2].map(i => P[i] > 0 ? { cost: P[i], clue: P[4 + i] >= 0 && w.pnames && w.pnames[4 + i] ? [w.pnames[4 + i], P[7 + i]] : null } : null) });
    Object.defineProperty(sc, 'seed', { get: () => P[3] || 0 });
    sc.pick = (i) => { if (sc.usable(i)) n.send({ t: 'button', id: w.id, b: i }); };
    return sc;
  },
  // 0: the cost; the name typed goes to the server as it changes
  anvil(n, w) {
    const P = w.props, sc = new AnvilScreen(n.g, null, w.title);
    sc.changed = () => { };
    Object.defineProperty(sc, 'res', { get: () => P[0] > 0 ? { cost: P[0], tooExpensive: P[0] >= 40 && !n.g.player.creative, stack: sc.S(2) } : null });
    sc.netLeft = (L) => {
      const k = L ? L.id + '|' + (L.name || '') : '';
      if (k === sc.leftKey) return;
      sc.leftKey = k; sc.name = L ? L.name || ITEMS[L.id].cn : '';
      const inp = n.g.ui.input; if (inp) inp.value = sc.name;
    };
    sc.onName = (v) => n.send({ t: 'rename', name: v });
    sc.onNetClose = () => n.g.ui.hideInput();
    return sc;
  },
  grindstone: (n, w) => new GrindstoneScreen(n.g, null, w.title),
  // 0: the chosen recipe; choosing one is a button click with its place in the list
  stonecutter(n, w) {
    const P = w.props, sc = new StonecutterScreen(n.g, null, w.title);
    sc.changed = () => { };
    Object.defineProperty(sc, 'sel', { get: () => P[0] ?? -1, set: () => { } });
    sc.pick = (i) => { n.send({ t: 'button', id: w.id, b: i }); Sound.ev('ui.stonecutter.select_recipe', null, 1, 1); };
    return sc;
  },
  smithing: (n, w) => new SmithingScreen(n.g, null, w.title),
  // 0: the chosen pattern (its place in the list the loom offers); choosing one is a button click
  loom(n, w) {
    const P = w.props, sc = new LoomScreen(n.g, null, w.title);
    sc.changed = () => { };
    Object.defineProperty(sc, 'sel', { get: () => P[0] ?? -1, set: () => { } });
    sc.pick = (i) => n.send({ t: 'button', id: w.id, b: i });
    return sc;
  },
  // the server works out the copy / zoom / lock in the result slot
  // (what it would do is still worked out here, for the lock icon)
  cartography_table(n, w) { const sc = new CartographyScreen(n.g, null, w.title), dm = sc.drawMore; sc.drawMore = function (ui) { this.changed(); dm.call(this, ui); }; return sc; },
  // 0: brewing time left, 1: fuel left
  brewing_stand(n, w) {
    const P = w.props, be = { get brewTime() { return P[0] || 0; }, get fuelLeft() { return P[1] || 0; }, bottles: [], ingredient: null, fuel: null };
    return new BrewingScreen(n.g, be, w.title);
  },
};
const netMayPlace = (s, st) => !s.output && (!s.accept || s.accept(st));
const netMax = (s, st) => Math.min(s.max || 99, st.unk ? 64 : maxStack(st.id));
// moveItemStackTo: onto stacks of the same item first, then into the first empty slot that takes it
function netMoveTo(sc, src, from, to, rev) {
  let S = src.get();
  const list = sc.slots.filter((s) => s.v >= from && s.v < to && s !== src).sort((a, b) => rev ? b.v - a.v : a.v - b.v);
  if (netMax({}, S) > 1) for (const t of list) {
    const T = t.get();
    if (!T || !sameItem(T, S) || T.count >= netMax(t, T)) continue;
    const k = Math.min(S.count, netMax(t, T) - T.count);
    t.set({ ...T, count: T.count + k }); S = S.count - k > 0 ? { ...S, count: S.count - k } : null;
    if (!S) break;
  }
  if (S) for (const t of list) {
    if (t.get() || !netMayPlace(t, S)) continue;
    const k = Math.min(S.count, netMax(t, S));
    t.set({ ...S, count: k }); S = S.count - k > 0 ? { ...S, count: S.count - k } : null;
    break;
  }
  src.set(S);
}
// mixed into a window's screen (NetClient.netify): mouse and keys become vanilla clicks
const NET_SCREEN = {
  mouseDown(ui, mx, my, button, shift) {
    const n = this.net, b = button === 2 ? 1 : button === 1 ? 2 : 0; // vanilla numbers the buttons left, right, middle
    Sound.init();
    if (this.offerAt) { const i = this.offerAt(mx, my); if (i >= 0) { this.pick(i); return; } }
    const s = this.slotAt(mx, my);
    if (!s) { if (ui.cursor && b < 2 && this.outside(mx, my)) n.click(this, -999, b, 0); return; }
    if (b === 2) { if (this.game.mode === 'creative' && !ui.cursor && s.get()) n.click(this, s.v, 2, 3); return; }
    const now = performance.now(), last = this.lastClick;
    this.lastClick = { t: now, v: s.v, b };
    if (b === 0 && !shift && ui.cursor && last && last.v === s.v && last.b === 0 && now - last.t < 250) { this.lastClick = null; n.click(this, s.v, 0, 6); return; }
    if (shift) { n.click(this, s.v, b, 1); return; }
    // holding something over a slot it fits: maybe a drag (decided when the button goes up)
    if (ui.cursor && !s.output && (!s.get() || sameItem(s.get(), ui.cursor))) { this.dragSlots = new Set([s]); this.dragButton = b; return; }
    n.click(this, s.v, b, 0);
  },
  mouseMove(ui, mx, my) {
    if (!this.dragSlots || !ui.mouse.down || !ui.cursor) return;
    const s = this.slotAt(mx, my), C = ui.cursor;
    if (s && !s.output && (!s.get() || sameItem(s.get(), C)) && netMayPlace(s, C) && this.dragSlots.size < C.count) this.dragSlots.add(s);
  },
  mouseUp(ui) {
    if (!this.dragSlots) return;
    const list = [...this.dragSlots], b = this.dragButton;
    this.dragSlots = null;
    if (list.length === 1) this.net.click(this, list[0].v, b, 0); else if (ui.cursor) this.net.drag(this, list, b);
  },
  key(ui, ev) {
    const k = ev.key, s = this.slotAt(ui.mouse.x, ui.mouse.y), n = this.net;
    if (k >= '1' && k <= '9') { if (s && !ui.cursor) n.click(this, s.v, +k - 1, 2); return true; }
    if (k === 'f' || k === 'F') { if (s && !ui.cursor) n.click(this, s.v, 40, 2); return true; }
    if (k === 'q' || k === 'Q') { if (s && !ui.cursor && s.get()) n.click(this, s.v, ev.ctrlKey ? 1 : 0, 4); return true; }
    return false;
  },
  // closing: the server puts the cursor's and the crafting grid's items back (and says so)
  close() {
    const n = this.net;
    this.game.ui.cursor = null;
    if (!this.serverClosed) n.send({ t: 'wclose', id: this.netWin });
    if (this.netWin && n.win && n.win.id === this.netWin) n.win = null;
  },
  quickMove(s) { this.net.click(this, s.v, 0, 1); }, // touch controls' quick move
};

// ---- item components: names, enchantments, potions (the tooltip and the glint) ----
const NET_ENCH_CN = {
  protection: '保护', fire_protection: '火焰保护', feather_falling: '摔落缓冲', blast_protection: '爆炸保护', projectile_protection: '弹射物保护',
  respiration: '水下呼吸', aqua_affinity: '水下速掘', thorns: '荆棘', depth_strider: '深海探索者', frost_walker: '冰霜行者', binding_curse: '绑定诅咒',
  soul_speed: '灵魂疾行', swift_sneak: '迅捷潜行', sharpness: '锋利', smite: '亡灵杀手', bane_of_arthropods: '节肢杀手', knockback: '击退',
  fire_aspect: '火焰附加', looting: '抢夺', sweeping_edge: '横扫之刃', efficiency: '效率', silk_touch: '精准采集', unbreaking: '耐久', fortune: '时运',
  power: '力量', punch: '冲击', flame: '火矢', infinity: '无限', luck_of_the_sea: '海之眷顾', lure: '饵钓', loyalty: '忠诚', impaling: '穿刺',
  riptide: '激流', channeling: '引雷', multishot: '多重射击', quick_charge: '快速装填', piercing: '穿透', density: '致密', breach: '破甲',
  wind_burst: '风爆', mending: '经验修补', vanishing_curse: '消失诅咒', lunge: '突进',
};
// enchantments with a single level (vanilla shows no number for them)
const NET_ENCH_ONE = new Set(['aqua_affinity', 'binding_curse', 'channeling', 'flame', 'infinity', 'mending', 'multishot', 'silk_touch', 'vanishing_curse']);
const NET_POTION_CN = {
  night_vision: '夜视', invisibility: '隐身', leaping: '跳跃提升', fire_resistance: '抗火', swiftness: '迅捷', slowness: '缓慢', turtle_master: '神龟',
  water_breathing: '水肺', healing: '治疗', harming: '伤害', poison: '剧毒', regeneration: '再生', strength: '力量', weakness: '虚弱', luck: '幸运',
  slow_falling: '缓降', wind_charged: '蓄风', weaving: '盘丝', oozing: '渗浆', infested: '寄生',
};
const NET_POTION_PLAIN = { water: '水瓶', mundane: '平凡的药水', thick: '浑浊的药水', awkward: '粗制的药水' };
const romanNum = (n) => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);
// the tooltip of a server's stack: its name, its enchantments under it, what potion it is
function netItemLines(stack, lines) {
  if (stack.pot) {
    const base = stack.pot.replace(/^(long|strong)_/, ''), eff = NET_POTION_CN[base], key = stack.unk || ITEMS[stack.id].key;
    const pre = key === 'splash_potion' ? '喷溅型' : key === 'lingering_potion' ? '滞留型' : '';
    lines[0].text = NET_POTION_PLAIN[base] ? pre + NET_POTION_PLAIN[base] : eff ? (key === 'tipped_arrow' ? eff + '之箭' : pre + eff + '药水') : lines[0].text;
    if (eff) lines.splice(1, 0, { text: eff + (stack.pot.startsWith('strong_') ? ' II' : '') + (stack.pot.startsWith('long_') ? '（延长）' : ''), color: '#5555FF' });
    else lines.splice(1, 0, { text: '无效果', color: '#AAAAAA' });
  }
  if (stack.e && stack.e.length) {
    if (lines[0].color === '#FFFFFF') lines[0].color = '#55FFFF'; // enchanted: the "rare" colour
    lines.splice(1, 0, ...stack.e.map(([k, l]) => ({ text: (NET_ENCH_CN[k] || k) + (NET_ENCH_ONE.has(k) && l === 1 ? '' : ' ' + romanNum(l)), color: /curse/.test(k) ? '#FF5555' : '#AAAAAA' })));
  }
  if (stack.name) lines[0].text = stack.name;
  return lines;
}

// ---- Game hooks ----
// interaction on a server: like handleInteraction (same mining time, cracks, swings), but the effects are the
// server's - a mined block disappears at once and comes back if the server says no
Game.prototype.netInteraction = function () {
  const p = this.player, n = this.net;
  if (this.useCd > 0) this.useCd--;
  if (this.attackCd > 0) this.attackCd--;
  // eating / drawing a bow: the server times it; letting go of the button tells it
  if (p.usingItem) {
    const held = p.useHand === 'off' ? p.inv.slots[40] : p.inv.held;
    if (!this.mouseBtn[2] || !held || held.id !== p.usingItem) { n.send({ t: 'release' }); p.usingItem = null; p.useT = 0; p.useHand = null; }
    else {
      p.useT++;
      const def = ITEMS[held.id];
      if (def.food && p.useT % 4 === 0 && p.useT > 6) { Sound.eat(p.pos); this.foodParticles(held.id); }
      // (done when the server says so - entity event 9; asking again before it had finished started the same food over,
      // so a second one never got eaten. A second's grace if that never comes)
      if (def.food && p.useT >= 52) { p.usingItem = null; p.useT = 0; }
    }
  }
  if (this.mouseBtn[0]) {
    if (this.targetEntity) {
      const e = this.targetEntity;
      if (this.mouseClicked0 && this.attackCd <= 0 && e.netId != null) { n.send({ t: 'attack', id: e.netId }); n.send({ t: 'swing' }); p.swing(); p.attackT = 0; this.attackCd = 4; }
      this.breaking = null;
    } else if (this.target) {
      const t = this.target, key = t.pos.join(','), b = BLOCKS[t.id];
      if (this.mode === 'creative') {
        if (this.attackCd <= 0) {
          const held = p.inv.held;
          if (!(held && ITEMS[held.id].tool && ITEMS[held.id].tool.type === 'sword')) { n.dig(0, t); n.digging = null; this.netBreak(t.pos); }
          this.attackCd = 5; p.swing(); n.send({ t: 'swing' });
        }
      } else {
        if (!this.breaking || this.breaking.key !== key) { this.breaking = { key, pos: t.pos, progress: 0, id: t.id }; n.dig(0, t); }
        if (b.hardness >= 0 && this.attackCd <= 0) {
          this.breaking.progress += this.breakSpeed(t.id);
          p.swing();
          if (this.tickCount % 4 === 0) { n.send({ t: 'swing' }); Sound.block('hit', b.sound, [t.pos[0] + 0.5, t.pos[1] + 0.5, t.pos[2] + 0.5]); this.particles.blockHit(...t.pos, t.face, t.id, this.world.getMeta(...t.pos)); }
          if (this.breaking.progress >= 1) { n.dig(2, t); this.netBreak(t.pos); this.breaking = null; this.attackCd = 5; }
        }
      }
    } else { this.breaking = null; if (this.mouseClicked0) { p.swing(); n.send({ t: 'swing' }); } }
  } else this.breaking = null;
  // a block given up half-mined
  if (n.digging && (!this.breaking || this.breaking.key !== n.digging.key)) { n.dig(1, n.digging.t); n.digging = null; }
  this.mouseClicked0 = false;
  if (this.mouseBtn[2] && this.useCd <= 0 && !p.usingItem) this.netUse();
};
// items with no use on a block (Item.useOn passes), so a right click at a block uses them in the air too
const NET_USE_ON_PASS = /^(snowball|egg|blue_egg|brown_egg|ender_pearl|splash_potion|lingering_potion|experience_bottle|ender_eye|wind_charge|fishing_rod|bucket|water_bucket|lava_bucket|(cod|salmon|pufferfish|tropical_fish|axolotl|tadpole)_bucket|map|bundle|\w+_bundle|elytra|crossbow|knowledge_book|turtle_helmet|\w+_(helmet|chestplate|leggings|boots))$/;
// right click on a server: an entity (trade, ride, shear ...), a block (place, open, press), or the item itself
Game.prototype.netUse = function () {
  const p = this.player, n = this.net, held = p.inv.held, def = held && ITEMS[held.id], t = this.target;
  this.useCd = 4;
  if (this.targetEntity && this.targetEntity.netId != null) {
    n.send({ t: 'interact', id: this.targetEntity.netId, x: 0, y: this.targetEntity.h / 2, z: 0, sneak: p.sneaking });
    p.swing(); n.send({ t: 'swing' }); return;
  }
  // held to use (the server times it; letting go says so): food, drinks, bows, crossbows, shields, tridents, spears
  const usable = !!def && !!(def.food || /^(bow|potion|milk_bucket|honey_bottle|shield|trident|crossbow|spyglass|goat_horn|brush)$|_spear$/.test(def.key)) && !(def.key === 'crossbow' && held.charged);
  // books open their screen here (like vanilla's client); the pages go back with edit_book
  if (def && /^(writable_book|written_book)$/.test(def.key) && !(t && BLOCKS[t.id].key === 'lectern')) { this.ui.open(new BookScreen(this, held, def.key === 'writable_book')); return; }
  // boats are put down by using the item (on water too), not on a block
  const itemUse = !!def && /_(boat|raft)$/.test(def.key);
  // an offhand shield goes up when the main hand has nothing to do
  const off = p.inv.slots[40];
  // (not at a block with a use of its own - doors, trapdoors, gates and beds too: the shield went up and the door
  // stayed shut, 10-31 feedback)
  const tb = t && BLOCKS[t.id], blockUse = !!(tb && (tb.onUse || tb.door || tb.trapdoor || tb.gate || tb.bed));
  if (off && ITEMS[off.id].key === 'shield' && !this.mainHandBusy(held, def) && !(blockUse && !p.sneaking)) {
    n.send({ t: 'use', hand: 'off', yaw: fromYaw(p.yaw), pitch: -p.pitch * R2D });
    p.usingItem = off.id; p.useHand = 'off'; p.useT = 0; return;
  }
  if (t && !itemUse && (!usable || (BLOCKS[t.id].onUse && !p.sneaking))) {
    const pt = t.point || [t.pos[0] + 0.5, t.pos[1] + 0.5, t.pos[2] + 0.5];
    n.send({ t: 'place', x: t.pos[0], y: t.pos[1] + n.minY, z: t.pos[2], face: NET_FACE[t.face] ?? 1,
      cx: clamp(pt[0] - t.pos[0], 0, 1), cy: clamp(pt[1] - t.pos[1], 0, 1), cz: clamp(pt[2] - t.pos[2], 0, 1) });
    // like vanilla's client: when neither the block nor the item does anything there (PASS), the item is used
    // as well - throwables, buckets, armour, a loaded crossbow, an eye of ender away from a portal frame ...
    const pass = def && NET_USE_ON_PASS.test(def.key) && !(BLOCKS[t.id].onUse && !p.sneaking) && !(def.key === 'ender_eye' && BLOCKS[t.id].key === 'end_portal_frame');
    if (pass) { n.send({ t: 'use', yaw: fromYaw(p.yaw), pitch: -p.pitch * R2D }); p.swing(); n.send({ t: 'swing' }); return; }
    // the other hand's block or torch when the main hand has nothing to do there (vanilla's client tries the other
    // hand after the main one passes; only the main hand went, 10-31 feedback)
    const od = off && ITEMS[off.id], idle = !this.mainHandBusy(held, def) && (!def || !def.tool || /^(sword|pickaxe)$/.test(def.tool.type));
    if (od && (od.block !== undefined || od.places) && !od.armor && idle && !(blockUse && !p.sneaking)) {
      n.send({ t: 'place', hand: 'off', x: t.pos[0], y: t.pos[1] + n.minY, z: t.pos[2], face: NET_FACE[t.face] ?? 1,
        cx: clamp(pt[0] - t.pos[0], 0, 1), cy: clamp(pt[1] - t.pos[1], 0, 1), cz: clamp(pt[2] - t.pos[2], 0, 1) });
    }
    if (held) p.swing(); n.send({ t: 'swing' });
    return;
  }
  if (!def) return;
  n.send({ t: 'use', yaw: fromYaw(p.yaw), pitch: -p.pitch * R2D });
  if (usable && (!def.food || p.food < 20 || this.mode === 'creative' || def.key === 'golden_apple')) { p.usingItem = held.id; p.useHand = 'main'; p.useT = 0; }
  else p.swing();
};
// a mined block goes at once (the server's block change follows, or puts it back)
Game.prototype.netBreak = function (pos) {
  const w = this.world, [x, y, z] = pos, id = w.getBlock(x, y, z);
  if (!id || IS_FLUID[id]) return;
  const b = BLOCKS[id];
  Sound.block('break', b.sound, [x + 0.5, y + 0.5, z + 0.5]);
  this.particles.blockBreak(x, y, z, id, w.getMeta(x, y, z));
  w.setBlock(x, y, z, WLOG[id] ? WATER : 0, 0, 0);
  this.flushMesh();
};
Game.prototype.joinServer = function (url, name) {
  if (this.world) { this.unloadAll(); this.world = null; }
  try { GuestSession.beginConnect(''); } catch (e) { }
  this.net = new NetClient(this, url, name);
  this.ui.open(new LoadingScreen(this, '正在连接…'));
};
// keepGuest: the socket dropped on its own - keep the short reconnect hint; an explicit leave clears it
Game.prototype.leaveServer = function (keepGuest) {
  const n = this.net; if (!n) return;
  this.net = null; n.close();
  if (!keepGuest) { try { GuestSession.leaveRoom(); } catch (e) { } }
  this.startTitle();
};
// the server's world: the player moves (the server checks it), everything else comes from the server
Game.prototype.netTick = function () {
  const p = this.player;
  for (const e of this.entities) if (!e.dead) this.tickEntity(e);
  this.entities = this.entities.filter(e => !e.dead);
  this.guard('particles', () => this.particles.tick());
  const eyeY = p.pos[1] + p.eye(), eb = this.world.getBlock(Math.floor(p.pos[0]), Math.floor(eyeY), Math.floor(p.pos[2]));
  this.headInWater = this.world.waterAt(Math.floor(p.pos[0]), Math.floor(eyeY), Math.floor(p.pos[2])); this.headInLava = eb === LAVA;
  this.guard('ambient sounds', () => this.ambientSounds());
  this.weather += clamp(this.rainTarget - this.weather, -0.01, 0.01);
  this.net.tick();
  Sound.listener = { x: p.pos[0], y: p.pos[1] + 1.6, z: p.pos[2], yaw: p.yaw };
};

// 多人游戏: rooms on the room service (multiplayer/rooms). Anyone creates a room (a server of its own on the service's
// machine, 4-10 players, public: in the list for anyone); friends also join with its invite code or link (?room=CODE). The service's address comes from
// js/netconfig.js (NET_CONFIG.rooms), or ?rooms=<address> in the page's address for testing.
const RoomService = {
  base() {
    const q = new URLSearchParams(location.search).get('rooms');
    return String(q || (window.NET_CONFIG && NET_CONFIG.rooms) || '').replace(/\/+$/, '');
  },
  ws() { return this.base().replace(/^http/, 'ws') + '/ws'; },
  // this browser's own key: rooms it made and names it took belong to it
  key() {
    const make = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    try { let k = localStorage.getItem('mcjs-room-key'); if (!k) { k = make(); localStorage.setItem('mcjs-room-key', k); } return k; }
    catch (e) { return this._k || (this._k = make()); }
  },
  // bytes sent as they are (a save for a room), with the upload's progress (0-1)
  upload(path, bytes, progress) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('POST', this.base() + path);
      x.setRequestHeader('Content-Type', 'text/plain'); // (the bytes as they are; text/plain so no preflight)
      x.upload.onprogress = (e) => { if (e.lengthComputable && progress) progress(e.loaded / e.total); };
      x.onload = () => { let j = null; try { j = JSON.parse(x.responseText); } catch (e) { } if (x.status === 200 && j && !j.error) resolve(j); else reject(new Error((j && j.error) || 'HTTP ' + x.status)); };
      x.onerror = () => reject(new Error('连不上联机服务器'));
      x.send(bytes);
    });
  },
  async api(path, body) {
    let r;
    // (sent as plain text: no preflight - the old game's app web views; the server may replace this in phase-05)
    try { r = await fetch(this.base() + path, body ? { method: 'POST', body: JSON.stringify(body) } : {}); }
    catch (e) { throw new Error('连不上联机服务器'); }
    const j = await r.json().catch(() => ({ error: '联机服务器没有回应' }));
    if (!r.ok || (j && j.error)) throw new Error((j && j.error) || 'HTTP ' + r.status);
    return j;
  },
  link(code) {
    const share = window.NET_CONFIG && NET_CONFIG.share, base = share || (location.origin + location.pathname);
    return base + (base.includes('?') ? '&' : '?') + 'room=' + code;
  },
  fromUrl() { const c = new URLSearchParams(location.search).get('room'); return c ? c.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) : ''; },
};
Game.prototype.joinRoom = function (code, name) {
  if (this.world) { this.unloadAll(); this.world = null; }
  try { GuestSession.beginConnect(code); } catch (e) { }
  this.net = new NetClient(this, RoomService.ws(), name, { room: code, key: RoomService.key() });
  this.ui.open(new LoadingScreen(this, '正在连接房间 ' + code + '…'));
};
// an invite link opens the join screen once the title screen is up
(() => {
  const st = Game.prototype.startTitle;
  Game.prototype.startTitle = function (...a) {
    const r = st.apply(this, a);
    if (!this.roomLinkUsed && RoomService.fromUrl()) { this.roomLinkUsed = true; setTimeout(() => { if (this.state === 'title') this.ui.open(new MultiplayerScreen(this, null)); }, 400); }
    return r;
  };
})();

// text fields drawn like the game's, typed into through the page's input box
class FormScreen extends MenuScreen {
  constructor(game, title, parent) { super(game, title); this.parent = parent; this.titleY = 20; this.fields = {}; this.field = null; this.note = ''; this.noteColor = '#A0A0A0'; }
  addField(k, x, y, w, label, max, filter) { this.fields[k] = { x, y, w, h: 20, label, max, filter }; }
  focus(k) {
    const u = this.game.ui, b = this.fields[k]; if (!b) return;
    this.field = k;
    u.showInput(b.x + 4, b.y + 6, b.w - 8, 10, this[k], () => this.submit(), { onInput: (v) => { this[k] = b.filter ? b.filter(v) : v; }, onEsc: () => this.onEsc(), max: b.max });
  }
  submit() { }
  mouseDown(ui, mx, my, b) {
    for (const k in this.fields) { const r = this.fields[k]; if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) { this.focus(k); return; } }
    super.mouseDown(ui, mx, my, b);
  }
  drawFields(ui) {
    const c = ui.ctx;
    for (const k in this.fields) {
      const r = this.fields[k];
      Font.draw(c, r.label, r.x, r.y - 11, '#A0A0A0');
      ui.nine(this.field === k ? 'text_field_hl' : 'text_field', r.x, r.y, r.w, r.h, 1);
      if (this.field !== k) Font.draw(c, String(this[k] || ''), r.x + 4, r.y + 6, '#E0E0E0');
    }
    if (this.note) Font.center(c, this.note, ui.w / 2, ui.h - 52, this.noteColor);
  }
  say(text, bad) { this.note = text; this.noteColor = bad ? '#FF6060' : '#A0A0A0'; }
  back() { this.game.ui.hideInput(); this.game.ui.open(this.parent || new TitleScreen(this.game)); }
  onEsc() { this.back(); }
}
const nameOnly = (v) => v.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
const codeOnly = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

// 多人游戏: the public rooms (every room on the service is public: anyone may come in), joining one by its
// invite code, making one, the rooms this browser made
const GM_CN = { survival: '生存', creative: '创造', adventure: '冒险', spectator: '旁观' };
// text cut to a width (with an ellipsis), for the lists on narrow screens
const fitText = (t, w) => { t = String(t); if (Font.width(t) <= w) return t; while (t.length && Font.width(t + '…') > w) t = t.slice(0, -1); return t + '…'; };
const roomAge = (t) => { if (!t) return ''; const m = Math.floor((Date.now() - t) / 60000); return m < 60 ? `${m} 分钟` : `${Math.floor(m / 60)} 小时 ${m % 60} 分`; };
class MultiplayerScreen extends FormScreen {
  constructor(game, parent) {
    super(game, '多人游戏', parent);
    const s = game.settings;
    this.name = GuestSession.name || s.netName || ('Steve' + Math.floor(Math.random() * 900 + 100));
    this.code = RoomService.fromUrl() || '';
    this.list = null; this.page = 0; this.cap = null;
    if (!RoomService.base()) this.say(location.protocol === 'http:' ? '没有配置房间服务（js/netconfig.js）：可以用下面的“直接连接”' : '还没有配置联机服务器地址（js/netconfig.js）', true);
    this.field = this.code ? 'name' : null;
    this.load();
  }
  async load() {
    if (!RoomService.base()) return;
    this.loading = true;
    try { const r = await RoomService.api('/api/public'); this.list = r.rooms || []; this.cap = r.capacity || null; this.maint = r.maintenance || null; }
    catch (e) { this.list = []; this.say(e.message, true); }
    this.loading = false;
    if (this.game.ui.screen === this) this.layout();
  }
  rows() { return Math.max(2, Math.floor((this.game.ui.h - 82 - 62) / 24)); }
  layout() {
    const u = this.game.ui, cx = u.w / 2, n = this.rows(), list = this.list || [];
    this.fields = {};
    // a nickname chosen here; no account or login (the server issues the temporary id for the room)
    this.addField('name', cx - 152, 42, 148, '昵称（1–16 个字符）', 16, GuestSession.cleanName);
    this.addField('code', cx + 4, 42, 98, '邀请码', 8, codeOnly);
    const pages = Math.max(1, Math.ceil(list.length / n));
    this.page = clamp(this.page, 0, pages - 1);
    this.widgets = [
      { x: cx + 106, y: 42, w: 46, h: 20, label: '加入', onClick: () => this.submit() },
      { x: cx + 106, y: 66, w: 22, h: 14, label: '<', enabled: this.page > 0, onClick: () => { this.page--; this.layout(); } },
      { x: cx + 130, y: 66, w: 22, h: 14, label: '>', enabled: this.page < pages - 1, onClick: () => { this.page++; this.layout(); } },
    ];
    list.slice(this.page * n, this.page * n + n).forEach((r, i) => {
      // (the owner's own room: its button blue - the old account checks are gone; names are just nicknames now)
      const full = r.players >= r.max;
      const mine = !!GuestSession.name && String(r.owner || '').toLowerCase() === GuestSession.name.toLowerCase();
      this.widgets.push({ x: cx + 106, y: 84 + i * 24, w: 46, h: 20, label: full && !mine ? '已满' : '进入', enabled: !full || mine, blue: mine,
        tip: [r.name, `房主 ${r.owner}，${r.players}/${r.max} 人，${GM_CN[r.gamemode] || ''}`].concat(mine ? ['你的房间：满员了也能进'] : []), onClick: () => this.join(r.code) });
    });
    this.widgets.push(
      { x: cx - 152, y: u.h - 52, w: 98, h: 20, label: '创建房间', onClick: () => this.go(CreateRoomScreen) },
      { x: cx - 50, y: u.h - 52, w: 98, h: 20, label: '我的房间', onClick: () => this.go(MyRoomsScreen) },
      { x: cx + 52, y: u.h - 52, w: 100, h: 20, label: this.loading ? '正在刷新…' : '刷新列表', onClick: () => { this.list = null; this.layout(); this.load(); } },
      { x: cx - 152, y: u.h - 28, w: 150, h: 20, label: '返回', onClick: () => this.back() },
    );
    if (location.protocol === 'http:') this.widgets.push({ x: cx + 2, y: u.h - 28, w: 150, h: 20, label: '直接连接（局域网）', onClick: () => { this.game.ui.hideInput(); this.game.ui.open(new DirectConnectScreen(this.game, this)); } });
    if (this.field) this.focus(this.field);
  }
  okName() {
    const n = GuestSession.setName(GuestSession.cleanName(this.name));
    this.name = n;
    if (n.length < 1) { this.say('先输入昵称', true); this.focus('name'); return null; }
    const g = this.game; g.settings.netName = n; g.saveSettings();
    return n;
  }
  go(Cls) { const n = this.okName(); if (!n) return; this.game.ui.hideInput(); this.game.ui.open(new Cls(this.game, this, n)); }
  join(code) { const n = this.okName(); if (!n || !RoomService.base()) return; this.game.ui.hideInput(); this.game.joinRoom(code, n); }
  submit() {
    const code = codeOnly(this.code);
    if (code.length < 4) { this.say('输入朋友给你的邀请码，或者从下面的公开房间里选一个', true); this.focus('code'); return; }
    this.join(code);
  }
  drawExtra(ui) {
    const c = ui.ctx, cx = ui.w / 2, n = this.rows(), list = this.list || [];
    const nt = this.note; this.note = ''; this.drawFields(ui); this.note = nt; // (the note goes above the buttons, below)
    Font.draw(c, '公开房间' + (list.length ? `（${list.length}）` : ''), cx - 152, 69, '#FFFFFF');
    if (this.maint) Font.draw(c, this.maint, cx - 80, 69, '#FF5555');
    if (!this.list) Font.center(c, '正在读取公开房间…', cx, 100, '#A0A0A0');
    else if (!list.length) Font.center(c, '现在还没有公开房间，创建一个吧', cx, 100, '#A0A0A0');
    list.slice(this.page * n, this.page * n + n).forEach((r, i) => {
      const y = 84 + i * 24, run = r.state !== 'stopped';
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(cx - 152, y, 254, 20);
      Font.draw(c, fitText(r.name, 248), cx - 149, y + 2, '#FFFFFF');
      const st = run ? `${r.players}/${r.max} 人 · ${GM_CN[r.gamemode] || ''} · ${roomAge(r.started)}` : `休息中 · 最多 ${r.max} 人 · ${GM_CN[r.gamemode] || ''}`;
      Font.draw(c, fitText(`房主 ${r.owner} · ${st}`, 248), cx - 149, y + 11, run ? '#90C890' : '#909090');
    });
    if (this.note) Font.center(c, fitText(this.note, ui.w - 8), cx, ui.h - 62, this.noteColor);
  }
}

class CreateRoomScreen extends FormScreen {
  constructor(game, parent, name) {
    super(game, '创建新房间', parent);
    this.owner = name; this.roomName = name + ' 的世界'; this.seed = ''; this.save = null; // a single-player save as the world
    this.gamemode = 'survival'; this.difficulty = 'normal'; this.pvp = true; this.busy = false;
    this.size = 4; this.cap = null; this.loadCap();
  }
  async loadCap() {
    try { this.cap = await RoomService.api('/api/capacity'); if (this.cap && !this.cap.sizes[this.size] && this.cap.max) this.size = this.cap.max; }
    catch (e) { this.cap = null; }
    if (this.game.ui.screen === this) this.layout();
  }
  sizes() { return this.cap ? Object.keys(this.cap.sizes).map(Number) : [4, 6, 8, 10]; }
  layout() {
    const u = this.game.ui, cx = u.w / 2;
    this.fields = {};
    if (!this.save) this.addField('seed', cx + 2, 166, 98, '种子（留空：随机）', 32, (v) => v.slice(0, 32));
    const GM = { survival: '生存', creative: '创造', adventure: '冒险' }, DF = { peaceful: '和平', easy: '简单', normal: '普通', hard: '困难' };
    const next = (o, k) => { const ks = Object.keys(o); return ks[(ks.indexOf(k) + 1) % ks.length]; };
    const ok = (n) => !this.cap || this.cap.sizes[n];
    this.widgets = [
      // (the room is named after its owner - the service decides it - 2026-10-31)
      { x: cx - 100, y: 52, w: 200, h: 20, label: () => fitText('房间名：' + this.roomName, 192), enabled: false, tip: ['房间名就是「你的名字 的世界」，不能自己起名', '每个人只能建一个房间，不要了可以在「我的房间」里删掉'] },
      { x: cx - 100, y: 80, w: 98, h: 20, label: () => '模式：' + GM[this.gamemode], onClick: () => { this.gamemode = next(GM, this.gamemode); } },
      { x: cx + 2, y: 80, w: 98, h: 20, label: () => '难度：' + DF[this.difficulty], onClick: () => { this.difficulty = next(DF, this.difficulty); } },
      { x: cx - 100, y: 104, w: 98, h: 20, label: () => 'PVP：' + (this.pvp ? '开' : '关'), tip: ['玩家能不能互相伤害'], onClick: () => { this.pvp = !this.pvp; } },
      { x: cx + 2, y: 104, w: 98, h: 20, label: () => `人数：${this.size}${ok(this.size) ? '' : '（要排队）'}`, tip: ['房间最多几个人（包括你）', '人越多服务器给的内存越多，资源紧张时要排队等别的房间关掉'],
        onClick: () => { const s = this.sizes(); this.size = s[(s.indexOf(this.size) + 1) % s.length]; } },
      { x: cx - 100, y: 166, w: this.save ? 200 : 98, h: 20, label: () => (this.save ? '存档：' + this.save.name : '世界：新世界'), tip: ['可以用你的单人存档（新版地形）开房间，大小不超过 100 MB'],
        enabled: !this.busy, onClick: () => this.game.ui.open(new SavePickScreen(this.game, this)) },
      { x: cx - 100, y: 196, w: 200, h: 20, label: () => (this.busy ? '正在创建…' : ok(this.size) ? '创建并进入' : '创建并排队'), enabled: !this.busy, onClick: () => this.submit() },
      { x: cx - 100, y: u.h - 30, w: 200, h: 20, label: '返回', onClick: () => this.back() },
    ];
    if (this.field) this.focus(this.field);
  }
  async submit() {
    if (this.busy) return;
    this.busy = true; this.say('正在创建房间…'); this.layout();
    let code = null;
    try {
      // a save: turned into a vanilla world here (export.js) first, so nothing is made when it can't be
      let pack = null;
      if (this.save) {
        const meta = await DB.getWorld(this.save.id);
        if (!meta) throw new Error('找不到这个存档');
        const ex = await RoomExport.build(meta, (f) => { this.say(`正在转换存档… ${Math.round(f * 100)}%`); });
        pack = RoomExport.packFiles(ex.files);
        this.seed = ex.info.seed;
      }
      const r = await RoomService.api('/api/rooms', { name: this.roomName, owner: this.owner, key: RoomService.key(), gamemode: this.gamemode, difficulty: this.difficulty, pvp: this.pvp, seed: this.seed, size: this.size });
      code = r.code;
      if (pack) {
        const mb = (pack.length / 1048576).toFixed(1);
        await RoomService.upload('/api/rooms/' + code + '/world?key=' + RoomService.key(), pack, (f) => { this.say(`正在上传存档… ${Math.round(f * 100)}%（${mb} MB）`); });
      }
      this.game.ui.hideInput();
      this.game.joinRoom(code, this.owner);
    } catch (e) {
      // (a room whose save didn't arrive is not kept)
      if (code) RoomService.api('/api/rooms/' + code + '/delete', { key: RoomService.key() }).catch(() => { });
      this.busy = false; this.say(e.message, true); this.loadCap(); this.layout();
    }
  }
  drawExtra(ui) {
    const c = ui.ctx, cx = ui.w / 2;
    const nt = this.note; this.note = ''; this.drawFields(ui); this.note = nt;
    const cap = this.cap;
    const line = !cap ? '' : cap.max ? `现在能开：最多 ${cap.max} 人的房间` : `现在开不了新房间：${cap.reason || '服务器满了'}`;
    Font.center(c, fitText(line, ui.w - 8), cx, 130, cap && !cap.max ? '#FF8080' : '#80FF80');
    Font.center(c, fitText(cap && !cap.max ? '可以先加入一个正在玩的公开房间' : '房间公开，所有人都能进；你是房主，能踢人、封禁、禁言', ui.w - 8), cx, 142, '#808080');
    if (this.note) Font.center(c, this.note, cx, 222, this.noteColor);
  }
}

// picking the world of a new room: a new one, or a single-player save (new terrain only: the room's server generates
// the rest of the world the same way)
class SavePickScreen extends MenuScreen {
  constructor(game, parent) { super(game, '房间的世界'); this.parent = parent; this.pauses = false; this.titleY = 8; this.worlds = null; this.page = 0; this.load(); }
  async load() {
    try { this.worlds = (await DB.listWorlds()).filter((w) => w.gen === 2 && !w.flat); } catch (e) { this.worlds = []; }
    if (this.game.ui.screen === this) this.layout();
  }
  rows() { return Math.max(2, Math.floor((this.game.ui.h - 68 - 60) / 24)); }
  layout() {
    const u = this.game.ui, cx = u.w / 2, W = this.worlds || [], n = this.rows(), pages = Math.max(1, Math.ceil(W.length / n));
    this.page = clamp(this.page, 0, pages - 1);
    const pick = (w) => {
      const P = this.parent;
      P.save = w ? { id: w.id, name: w.name } : null;
      this.game.ui.open(P);
    };
    this.widgets = [{ x: cx - 100, y: 38, w: 200, h: 20, label: '新世界', onClick: () => pick(null) }];
    W.slice(this.page * n, this.page * n + n).forEach((w, i) => this.widgets.push({ x: cx - 100, y: 68 + i * 24, w: 200, h: 20, label: fitText(w.name, 190), onClick: () => pick(w) }));
    if (pages > 1) this.widgets.push(
      { x: cx - 100, y: u.h - 54, w: 98, h: 20, label: '上一页', enabled: this.page > 0, onClick: () => { this.page--; this.layout(); } },
      { x: cx + 2, y: u.h - 54, w: 98, h: 20, label: '下一页', enabled: this.page < pages - 1, onClick: () => { this.page++; this.layout(); } },
    );
    this.widgets.push({ x: cx - 100, y: u.h - 30, w: 200, h: 20, label: '返回', onClick: () => this.game.ui.open(this.parent) });
  }
  drawExtra(ui) {
    if (this.worlds && !this.worlds.length) Font.center(ui.ctx, '没有能用的存档（只能用新版地形的单人存档）', ui.w / 2, 70, '#A0A0A0');
    else Font.center(ui.ctx, fitText('只能用新版地形的单人存档，最大 100 MB；房间里的进度不会回到单人存档', ui.w - 8), ui.w / 2, 22, '#909090');
  }
  onEsc() { this.game.ui.open(this.parent); }
}

class MyRoomsScreen extends FormScreen {
  constructor(game, parent, name) { super(game, '我的房间', parent); this.name = name; this.rooms = null; this.confirm = null; this.load(); }
  async load() {
    try { this.rooms = await RoomService.api('/api/rooms?key=' + RoomService.key()); this.say(this.rooms.length ? '' : '你还没有建过房间'); }
    catch (e) { this.rooms = []; this.say(e.message, true); }
    if (this.game.ui.screen === this) this.layout();
  }
  layout() {
    const u = this.game.ui, cx = u.w / 2;
    this.widgets = [{ x: cx - 100, y: u.h - 30, w: 200, h: 20, label: '返回', onClick: () => this.back() }];
    (this.rooms || []).slice(0, 5).forEach((r, i) => {
      const y = 44 + i * 30;
      this.widgets.push({ x: cx + 64, y, w: 50, h: 20, label: '进入', blue: true, tip: ['你的房间：满员了也能进'], onClick: () => { this.game.ui.hideInput(); this.game.joinRoom(r.code, this.name); } });
      this.widgets.push({ x: cx + 118, y, w: 50, h: 20, label: () => (this.confirm === r.code ? '确定？' : '删除'), onClick: () => this.del(r) });
    });
  }
  async del(r) {
    if (this.confirm !== r.code) { this.confirm = r.code; return; }
    this.confirm = null;
    try { await RoomService.api('/api/rooms/' + r.code + '/delete', { key: RoomService.key() }); this.say('已删除 ' + r.name); this.load(); }
    catch (e) { this.say(e.message, true); }
  }
  drawExtra(ui) {
    const c = ui.ctx, cx = ui.w / 2;
    if (!this.rooms) Font.center(c, '正在读取…', cx, 60, '#A0A0A0');
    (this.rooms || []).slice(0, 5).forEach((r, i) => {
      const y = 44 + i * 30;
      Font.draw(c, r.name, cx - 170, y + 2, '#FFFFFF');
      Font.draw(c, `${r.code}  ${r.state === 'running' ? '运行中 ' + r.players.length + '/' + r.max : '休息中'}`, cx - 170, y + 12, '#909090');
    });
    if (this.note) Font.center(c, this.note, cx, ui.h - 52, this.noteColor);
  }
}

// 直接连接: a proxy's address (multiplayer/proxy on this computer, the LAN or Radmin: 开服给朋友.bat), not the room service.
// Only on pages opened over http (local / LAN); the published (https) game has rooms only.
class DirectConnectScreen extends MenuScreen {
  constructor(game, parent) {
    super(game, '直接连接'); this.parent = parent; this.titleY = 20;
    const s = game.settings;
    this.url = s.netUrl || ('ws://' + (location.hostname || 'localhost') + ':8780');
    this.name = s.netName || ('Web' + Math.floor(Math.random() * 9000 + 1000));
    this.field = 'name';
  }
  layout() {
    const u = this.game.ui, cx = u.w / 2;
    this.boxes = { name: { x: cx - 100, y: 60, w: 200, h: 20 }, url: { x: cx - 100, y: 106, w: 200, h: 20 } };
    this.widgets = [
      { x: cx - 100, y: 140, w: 200, h: 20, label: '加入服务器', onClick: () => this.join() },
      { x: cx - 100, y: u.h - 30, w: 200, h: 20, label: '返回', onClick: () => this.onEsc() },
    ];
    this.focus(this.field);
  }
  focus(f) {
    const u = this.game.ui, b = this.boxes[f];
    this.field = f;
    u.showInput(b.x + 4, b.y + 6, b.w - 8, 10, this[f], () => this.join(), { onInput: (v) => { this[f] = v; }, onEsc: () => this.onEsc(), max: f === 'name' ? 16 : 120 });
  }
  join() {
    const g = this.game, name = this.name.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
    if (!name) return;
    GuestSession.setName(name);
    g.settings.netUrl = this.url.trim(); g.settings.netName = name; g.saveSettings();
    g.ui.hideInput();
    g.joinServer(this.url.trim(), name);
  }
  mouseDown(ui, mx, my, b) {
    for (const f of ['name', 'url']) { const r = this.boxes[f]; if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) { this.focus(f); return; } }
    super.mouseDown(ui, mx, my, b);
  }
  drawExtra(ui) {
    const c = ui.ctx, cx = ui.w / 2;
    Font.draw(c, '玩家名（英文字母、数字、下划线）', this.boxes.name.x, this.boxes.name.y - 11, '#A0A0A0');
    Font.draw(c, '联机中转地址（multiplayer/proxy）', this.boxes.url.x, this.boxes.url.y - 11, '#A0A0A0');
    for (const f of ['name', 'url']) {
      const r = this.boxes[f];
      ui.nine(this.field === f ? 'text_field_hl' : 'text_field', r.x, r.y, r.w, r.h, 1);
      if (this.field !== f) Font.draw(c, this[f], r.x + 4, r.y + 6, '#E0E0E0');
    }
    Font.center(c, '先启动 multiplayer/proxy 的联机中转（node src/proxy.js），它会连到 Minecraft 服务器', cx, 170, '#808080');
    Font.center(c, '目前可以：走动、挖掘、放置、战斗、聊天，用箱子、工作台、熔炉，和村民交易', cx, 182, '#808080');
  }
  onEsc() { this.game.ui.hideInput(); this.game.ui.open(this.parent || new TitleScreen(this.game)); }
}

// in a room: the code and the link to send, copied with one click; the owner can lock the room
// 房间 (pause menu, in a room): the invite code and link; the players - for the owner kick / ban / mute / member,
// for the others a report; the owner's setting (guests only look) and the banned list. (No locking: a room is open
// to anyone until it is full; the owner keeps someone out by banning.)
class RoomScreen extends MenuScreen {
  constructor(game, parent) {
    super(game, '房间'); this.parent = parent; this.pauses = false; this.titleY = 12; this.note = ''; this.noteColor = '#80FF80';
    this.info = null; this.page = 0; this.confirm = null; this.load();
  }
  get R() { return this.game.net && this.game.net.room; }
  get me() { return (this.game.net && this.game.net.name) || ''; }
  async load() {
    const R = this.R; if (!R) return;
    try { this.info = await RoomService.api('/api/rooms/' + R.code + (R.isOwner ? '?key=' + RoomService.key() : '')); R.guestMode = this.info.guestMode; R.players = this.info.players; }
    catch (e) { this.say(e.message, true); }
    if (this.game.ui.screen === this) this.layout();
  }
  say(t, bad) { this.note = t; this.noteColor = bad ? '#FF6060' : '#80FF80'; }
  rows() { return Math.max(2, Math.floor((this.game.ui.h - 108 - 56) / 22)); }
  // the owner's action on a player (or a setting): the service does it and answers with the room as it is now
  async act(action, name, value) {
    const R = this.R;
    try { this.info = await RoomService.api('/api/rooms/' + R.code + '/manage', { key: RoomService.key(), action, name, value }); R.guestMode = this.info.guestMode; R.max = this.info.max; this.say('已完成'); }
    catch (e) { this.say(e.message, true); }
    this.confirm = null; this.layout();
  }
  layout() {
    const u = this.game.ui, cx = u.w / 2, R = this.R, I = this.info, owner = !!(R && R.isOwner);
    this.widgets = [];
    if (!R) { this.widgets.push({ x: cx - 100, y: u.h - 30, w: 200, h: 20, label: '完成', onClick: () => this.game.ui.open(this.parent) }); return; }
    this.widgets.push(
      { x: cx - 160, y: 48, w: 78, h: 20, label: '复制邀请码', onClick: () => this.copy(R.code, '邀请码已复制') },
      { x: cx - 78, y: 48, w: 78, h: 20, label: '复制链接', onClick: () => this.copy(RoomService.link(R.code), '链接已复制，发给朋友打开就能加入') },
    );
    if (owner) this.widgets.push(
      { x: cx + 4, y: 48, w: 96, h: 20, label: () => '访客：' + ((I && I.guestMode) === 'view' ? '只能看' : '能建造'), tip: ['只能看：不是成员的人进来是冒险模式，不能破坏和放置方块', '能建造：所有人都能建造'],
        onClick: () => this.act('guestMode', '', (I && I.guestMode) === 'view' ? 'build' : 'view') },
      // the room's size: the next one up, round to the smallest that still holds everyone in it
      { x: cx + 104, y: 48, w: 56, h: 20, label: () => '人数 ' + ((I && I.max) || R.max), tip: ['点一下换下一档人数上限', '不能少于房间里现在的人数'],
        enabled: !!(I && I.sizes), onClick: () => {
          const S = I.sizes, cur = I.max, n = (I.players || []).length, ok = S.filter((s) => s >= n);
          this.act('size', '', ok.find((s) => s > cur) || ok[0]);
        } },
    );
    const players = (I && I.players) || R.players || [], n = this.rows(), pages = Math.max(1, Math.ceil(players.length / n));
    this.page = clamp(this.page, 0, pages - 1);
    players.slice(this.page * n, this.page * n + n).forEach((p, i) => {
      const y = 96 + i * 22, isOwner = I && p.toLowerCase() === I.owner.toLowerCase(), lo = p.toLowerCase();
      if (owner && !isOwner) {
        const muted = I && (I.mutes || []).includes(lo), member = I && (I.members || []).includes(lo);
        this.widgets.push(
          { x: cx - 20, y, w: 42, h: 18, label: () => (this.confirm === 'kick:' + p ? '确定？' : '踢出'), onClick: () => this.twice('kick:' + p, () => this.act('kick', p)) },
          { x: cx + 24, y, w: 42, h: 18, label: () => (this.confirm === 'ban:' + p ? '确定？' : '封禁'), tip: ['踢出并且以后不让他进这个房间'], onClick: () => this.twice('ban:' + p, () => this.act('ban', p)) },
          { x: cx + 68, y, w: 44, h: 18, label: muted ? '解除禁言' : '禁言', onClick: () => this.act(muted ? 'unmute' : 'mute', p) },
          { x: cx + 114, y, w: 46, h: 18, label: member ? '取消成员' : '设为成员', tip: ['成员和房主有一样的游戏内权限：切换生存 / 创造、用命令', '但不能管理房间（踢人、封禁、设成员只有房主能做）'], onClick: () => this.act('member', p, !member) },
        );
      } else if (!owner && p !== this.me) this.widgets.push({ x: cx + 114, y, w: 46, h: 18, label: '举报', onClick: () => this.game.ui.open(new ReportScreen(this.game, this, p)) });
    });
    if (pages > 1) this.widgets.push(
      { x: cx + 114, y: 80, w: 22, h: 14, label: '<', enabled: this.page > 0, onClick: () => { this.page--; this.layout(); } },
      { x: cx + 138, y: 80, w: 22, h: 14, label: '>', enabled: this.page < pages - 1, onClick: () => { this.page++; this.layout(); } },
    );
    if (owner && I && (I.bans || []).length) this.widgets.push({ x: cx - 160, y: u.h - 52, w: 150, h: 20, label: `封禁名单（${I.bans.length}）…`, onClick: () => this.game.ui.open(new BanListScreen(this.game, this)) });
    this.widgets.push({ x: cx - 100 + (owner && I && (I.bans || []).length ? 110 : 0), y: u.h - 30, w: 200 - (owner && I && (I.bans || []).length ? 110 : 0), h: 20, label: '完成', onClick: () => this.game.ui.open(this.parent) });
  }
  twice(k, f) { if (this.confirm === k) f(); else { this.confirm = k; this.layout(); } }
  async copy(s, msg) { this.say((await copyText(s)) ? msg : '复制失败：' + s, false); }
  drawExtra(ui) {
    const c = ui.ctx, cx = ui.w / 2, R = this.R, I = this.info;
    if (!R) { Font.center(c, '不在房间里', cx, 60, '#A0A0A0'); return; }
    Font.center(c, fitText(`${R.name}　邀请码 ${R.code}　房主 ${R.owner}`, ui.w - 8), cx, 28, '#FFFF55');
    Font.center(c, R.isOwner ? '房间公开，所有人都能在列表里看到并进入' : '有人捣乱可以举报，房主也能踢人和封禁', cx, 38, '#909090');
    const players = (I && I.players) || R.players || [], n = this.rows();
    Font.draw(c, `玩家（${players.length}/${(I && I.max) || R.max}）`, cx - 160, 82, '#FFFFFF');
    players.slice(this.page * n, this.page * n + n).forEach((p, i) => {
      const y = 96 + i * 22, lo = p.toLowerCase(), tags = [];
      if (I && lo === I.owner.toLowerCase()) tags.push('房主');
      else if (I && (I.members || []).includes(lo)) tags.push('成员');
      if (I && (I.mutes || []).includes(lo)) tags.push('禁言');
      if (p === this.me) tags.push('你');
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(cx - 160, y, 320, 18);
      const pn = typeof Cosmetics !== 'undefined' ? Cosmetics.preName(this.game, p) : p; // (a name prefix's icon, cosmetics.js)
      Font.draw(c, pn, cx - 157, y + 5, '#FFFFFF');
      if (tags.length) Font.draw(c, tags.join(' '), cx - 157 + Font.width(pn) + 6, y + 5, '#A0A0A0');
    });
    if (this.note) Font.center(c, this.note, cx, ui.h - 62, this.noteColor);
  }
  onEsc() { this.game.ui.open(this.parent); }
}
// the owner's banned list: unban
class BanListScreen extends MenuScreen {
  constructor(game, parent) { super(game, '封禁名单'); this.parent = parent; this.pauses = false; this.titleY = 20; }
  layout() {
    const u = this.game.ui, cx = u.w / 2, bans = (this.parent.info && this.parent.info.bans) || [];
    this.widgets = bans.slice(0, 8).map((b, i) => ({ x: cx + 40, y: 44 + i * 22, w: 60, h: 18, label: '解除封禁', onClick: async () => { await this.parent.act('unban', b); this.layout(); } }));
    this.widgets.push({ x: cx - 100, y: u.h - 30, w: 200, h: 20, label: '完成', onClick: () => this.game.ui.open(this.parent) });
  }
  drawExtra(ui) {
    const bans = (this.parent.info && this.parent.info.bans) || [];
    if (!bans.length) Font.center(ui.ctx, '没有封禁的人', ui.w / 2, 60, '#A0A0A0');
    bans.slice(0, 8).forEach((b, i) => Font.draw(ui.ctx, b, ui.w / 2 - 100, 49 + i * 22, '#FFFFFF'));
  }
  onEsc() { this.game.ui.open(this.parent); }
}
// reporting a player: why, a few words; it goes to the service (and to us)
const REPORT_REASONS = [['cheat', '作弊'], ['abuse', '说脏话 / 刷屏'], ['grief', '破坏别人的建筑'], ['other', '其他']];
class ReportScreen extends FormScreen {
  constructor(game, parent, target) { super(game, '举报 ' + target, parent); this.target = target; this.reason = 0; this.text = ''; this.busy = false; }
  layout() {
    const u = this.game.ui, cx = u.w / 2;
    this.fields = {};
    this.addField('text', cx - 120, 90, 240, '说明（可以不写，最多 300 字）', 300);
    this.widgets = [
      { x: cx - 120, y: 50, w: 240, h: 20, label: () => '原因：' + REPORT_REASONS[this.reason][1], onClick: () => { this.reason = (this.reason + 1) % REPORT_REASONS.length; } },
      { x: cx - 120, y: 124, w: 118, h: 20, label: () => (this.busy ? '发送中…' : '举报'), enabled: !this.busy && !this.sent, onClick: () => this.submit() },
      { x: cx + 2, y: 124, w: 118, h: 20, label: '返回', onClick: () => this.back() },
    ];
    this.focus('text');
  }
  async submit() {
    const g = this.game, R = g.net && g.net.room; if (!R) return;
    this.busy = true; this.layout();
    try { await RoomService.api('/api/rooms/' + R.code + '/report', { key: RoomService.key(), from: g.net.name, target: this.target, reason: REPORT_REASONS[this.reason][0], text: this.text }); this.sent = true; this.say('已举报，谢谢！我们会查看'); }
    catch (e) { this.say(e.message, true); }
    this.busy = false; this.layout();
  }
  drawExtra(ui) { this.drawFields(ui); Font.center(ui.ctx, '举报会连同房间和在场的玩家一起发给我们', ui.w / 2, 154, '#909090'); }
}
const InviteScreen = RoomScreen; // (the old name)

// ---------------------------------------------------------------------------
// The server's entities beyond the first mobs: every mob drawn with the vanilla models (vmobs.js), item frames,
// paintings, armor stands, lead knots, projectiles, experience orbs, primed TNT, falling blocks, fishing
// bobbers, evoker fangs; their entity data (the proxy names the fields: variants, colours, tamed / sitting,
// saddles and armour from the equipment) applied to what the single player code draws.
// ---------------------------------------------------------------------------
const NET_DIR = [2, 3, 4, 5, 0, 1]; // vanilla Direction (down up north south west east) -> DIRS index
const NET_SPRITE = { snowball: 'snowball', egg: 'egg', blue_egg: 'blue_egg', brown_egg: 'brown_egg', ender_pearl: 'ender_pearl', eye_of_ender: 'ender_eye', splash_potion: 'splash_potion',
  lingering_potion: 'lingering_potion', potion: 'splash_potion', experience_bottle: 'experience_bottle', fireball: 'fire_charge', small_fireball: 'fire_charge', dragon_fireball: 'fire_charge',
  wind_charge: 'wind_charge', breeze_wind_charge: 'wind_charge', firework_rocket: 'firework_rocket', llama_spit: null, ominous_item_spawner: null };
const NET_QUIET = new Set(['marker', 'interaction', 'area_effect_cloud', 'item_display', 'block_display', 'text_display', 'lightning_bolt']);
// a projectile the server moves: flies on between updates the way vanilla's client does
function netShotTick() {
  this.savePrev(); this.age++;
  if (this.lerpN > 0) { const k = 1 / this.lerpN; for (let i = 0; i < 3; i++) this.pos[i] += (this.netPos[i] - this.pos[i]) * k; this.lerpN--; }
  else if (this.netVel && !this.inGround) { for (let i = 0; i < 3; i++) this.pos[i] += this.netVel[i]; this.netVel[1] -= this.netGrav || 0; for (let i = 0; i < 3; i++) this.netVel[i] *= 0.99; }
  if (this.updateRot && this.netVel && !this.inGround) { const v = this.netVel; if (Math.hypot(v[0], v[1], v[2]) > 1e-3) { this.vel = [...v]; this.updateRot(); } }
}
(() => {
  const _spawn = NetClient.prototype.spawn;
  NetClient.prototype.spawn = function (m) {
    const g = this.g, y = m.y - this.minY, t = m.type;
    if (this.ents.has(m.id)) return;
    let e = null, kind = 'mob';
    if (NET_QUIET.has(t)) { if (t === 'lightning_bolt') { Sound.ev('entity.lightning_bolt.thunder', null, 1, 1); g.lightningFlash = 4; } return; }
    if (!NET_MOBS.has(t) && (VMOB[t] || t === 'ender_dragon')) e = createMob(g, t, m.x, y, m.z);
    else if (t === 'item_frame' || t === 'glow_item_frame' || t === 'painting') {
      // vanilla sends a hanging entity's own block position (HangingEntity.getPos), not where it is drawn
      const face = NET_DIR[m.data | 0] ?? 4;
      const bx = Math.floor(m.x), by = Math.floor(y), bz = Math.floor(m.z);
      e = t === 'painting' ? new Painting(g, bx, by, bz, face, PAINTINGS[0]) : new ItemFrame(g, bx, by, bz, face, t === 'glow_item_frame');
      e.hurt = () => false; e.interact = null; kind = 'still';
    } else if (t === 'armor_stand') { e = new ArmorStand(g, m.x, y, m.z); e.yaw = toYaw(m.yaw); e.hurt = () => false; e.interact = null; kind = 'still'; }
    else if (t === 'leash_knot') { e = new LeashKnot(g, Math.floor(m.x), Math.floor(y), Math.floor(m.z)); kind = 'still'; }
    else if (t === 'arrow' || t === 'spectral_arrow' || t === 'trident') {
      e = t === 'trident' ? new ThrownTrident(g, m.x, y, m.z, [0, 0, 0], null, makeStack('trident', 1)) : new Arrow(g, m.x, y, m.z, [0, 0, 0], null); if (t === 'spectral_arrow') e.tip = makeStack('spectral_arrow', 1);
      e.netGrav = t === 'trident' ? 0.05 : 0.05; kind = 'shot';
    } else if (t in NET_SPRITE || t === 'wither_skull' || t === 'shulker_bullet') {
      if (t === 'wither_skull') { e = new WitherSkull(g, m.x, y, m.z, [0, 0, 0], null, false); }
      else if (t === 'shulker_bullet') { e = new ShulkerBullet(g, m.x, y, m.z, null, null); }
      else if (t === 'llama_spit') { e = new MobShot(g, m.x, y, m.z, [0, 0, 0], null, { sprite: 'p_generic_2' }); }
      else { e = new Entity(g, m.x, y, m.z, 0.25, 0.25); const k = NET_SPRITE[t]; e.spriteLayer = k && ITEM_KEY[k] !== undefined ? ITEMS[ITEM_KEY[k]].tex : T('p_generic_0'); }
      e.netGrav = /fireball|wind_charge|wither_skull|shulker|firework/.test(t) ? 0 : 0.03; kind = 'shot';
    } else if (t === 'experience_orb') { e = new ExperienceOrb(g, m.x, y, m.z, 1); e.pickup = 1e9; kind = 'shot'; e.netGrav = 0.03; }
    else if (t === 'tnt') { e = new PrimedTNT(g, m.x, y, m.z, 80); kind = 'shot'; e.netGrav = 0.04; }
    else if (t === 'end_crystal') { e = new EndCrystal(g, m.x, y, m.z); e.hurt = () => false; kind = 'still'; }
    else if (t === 'falling_block') {
      // the block (a state number) is the spawn's data
      const v = (this.stateMap && this.stateMap[m.data]) || 256, id = v >> 8, meta = v & 255;
      e = new FallingBlock(g, m.x - 0.5, y, m.z - 0.5, id, meta); kind = 'shot'; e.netGrav = 0.04;
    } else if (t === 'fishing_bobber') {
      const owner = m.data === this.eid ? g.player : this.ents.get(m.data);
      e = new FishingHook(g, owner || g.player, makeStack('fishing_rod', 1)); e.pos = [m.x, y, m.z]; e.savePrev(); e.netOwner = m.data; kind = 'shot'; e.netGrav = 0.03;
      e.tick = netShotTick;
    } else if (t === 'evoker_fangs') { e = new EvokerFangs(g, m.x, y, m.z, 0, null); kind = 'fangs'; }
    if (!e) { const r = _spawn.call(this, m), e2 = this.ents.get(m.id); if (e2) netMetaDefaults(this, e2); return r; }
    netMetaDefaults(this, e);
    e.netId = m.id; e.remote = true; e.alwaysTick = true; e.persistent = true; e.keepSaved = false;
    e.netPos = [m.x, y, m.z]; e.lerpN = 0;
    if (kind === 'mob') {
      e.tick = netEntityTick; e.anims = {};
      if (e instanceof Warden) { e.st = 'idle'; e.anims = {}; }
      e.netYaw = e.yaw = e.bodyYaw = e.prevBodyYaw = toYaw(m.yaw); e.netPitch = -m.pitch / R2D;
      e.hurt = () => false;
    } else if (kind === 'shot') {
      e.tick = netShotTick; e.yaw = toYaw(m.yaw);
      if (m.v) { e.netVel = m.v.slice(); if (e.vel) e.vel = m.v.slice(); if (e.updateRot) e.updateRot(); } // (the spawn's own velocity)
    }
    else if (kind === 'still') { const tk = e.tick; e.tick = function () { this.savePrev(); this.age++; if (this.wobble > 0) this.wobble--; }; }
    g.entities.push(e); this.ents.set(m.id, e);
  };
  const _om = NetClient.prototype.onMessage;
  NetClient.prototype.onMessage = function (m) {
    const r = _om.call(this, m);
    const e = m.id !== undefined ? this.ents.get(m.id) : null;
    switch (m.t) {
      case 'meta': if (m.m) { if (m.id === this.eid) netSelfMeta(this, m.m); else if (e) netApplyMeta(this, e, m.m); } break;
      case 'equip': if (e && m.slots) netApplyEquip(this, e, m.slots); break;
      case 'vel': if (e) { e.netVel = m.v.slice(); if (e.vel && !(e instanceof Living)) e.vel = m.v.slice(); } break;
      case 'map': netMapData(this, m); break;
      case 'be': for (const [x, y, z, b] of m.list) { const k = x + ',' + (y - this.minY) + ',' + z, be = this.g.blockEntities.get(k) || { type: 'net', pos: [x, y - this.minY, z] }; Object.assign(be, b); this.g.blockEntities.set(k, be); } break;
      case 'status': if (e) netStatus(this, e, m.s); break;
      // sounds from the server (at a position, or at an entity)
      case 'sound': {
        let pos = m.x != null ? [m.x, m.y - this.minY, m.z] : null;
        if (m.id !== undefined && e) pos = [e.pos[0], e.pos[1] + e.h * 0.5, e.pos[2]];
        Sound.ev(m.n, pos, m.v, m.p);
        break;
      }
      // level events: 2001 a block broken (particles, sound), 1010 / 1011 a jukebox's song starting / stopping
      case 'wev': {
        const g = this.g, x = m.x, y = m.y - this.minY, z = m.z;
        if (m.e === 2001) { const v = this.stateMap[m.d] || 0, id = v >> 8; if (id && BLOCKS[id]) { g.particles.blockBreak(x, y, z, id, v & 255); Sound.block('break', BLOCKS[id].sound, [x + 0.5, y + 0.5, z + 0.5]); } }
        else if (m.e === 1010 && m.song && g.jukeboxPlay) g.jukeboxPlay([x, y, z], makeStack('music_disc_' + m.song, 1));
        else if (m.e === 1011 && g.jukeboxStop) g.jukeboxStop([x, y, z]);
        else if (m.e === 2000) for (let i = 0; i < 10; i++) g.particles.spawn('smoke', x + 0.5, y + 0.5, z + 0.5, (Math.random() - 0.5) * 0.1, 0.05, (Math.random() - 0.5) * 0.1);
        break;
      }
      // the server opens the sign editor: the text goes back as update_sign
      case 'signedit': {
        const g = this.g, x = m.x, y = m.y - this.minY, z = m.z, k = x + ',' + y + ',' + z;
        const t = g.signs.get(k) || { f: { l: ['', '', '', ''], c: 'black', g: false }, b: { l: ['', '', '', ''], c: 'black', g: false } };
        g.signs.set(k, t);
        const side = m.front === false ? t.b : t.f;
        if (!side.l) side.l = ['', '', '', ''];
        const sc = new SignScreen(g, [x, y, z], side);
        sc.onDone = () => this.send({ t: 'sign', x, y: m.y, z, front: m.front !== false, lines: side.l.slice(0, 4) });
        g.ui.open(sc);
        break;
      }
      // the server's attributes: a mount's speed and jump, an entity's scale
      case 'attr': {
        const t = m.id === this.eid ? this.g.player : e; if (!t) break;
        if (m.a.movement_speed !== undefined && t instanceof Horse && !(t instanceof Camel) && !(t instanceof Llama)) t.spd = m.a.movement_speed;
        if (m.a.jump_strength !== undefined) t.jumpStr = m.a.jump_strength;
        if (m.a.scale !== undefined) t.attrScale = m.a.scale;
        if (m.a.max_health !== undefined && t.maxHealth !== undefined && t !== this.g.player) t.maxHealth = m.a.max_health;
        break;
      }
    }
    return r;
  };
  // the extra item data the proxy sends (items.js): kept in this game's stack fields
  const _si = NetClient.prototype.stackIn;
  NetClient.prototype.stackIn = function (o) {
    const s = _si.call(this, o); if (!s || !o) return s;
    if (o.map !== undefined) s.mapId = 'n' + o.map;
    if (o.color !== undefined) s.color = o.color;
    if (o.base) s.base = o.base;
    if (o.pat) s.patterns = o.pat;
    if (o.fw) s.fw = o.fw;
    if (o.flight !== undefined) { s.flight = o.flight; s.explosions = o.ex || []; }
    if (o.bundle) s.bundle = o.bundle.map((x) => this.stackIn(x));
    if (o.pages) s.pages = o.pages;
    if (o.title !== undefined) { s.title = o.title; s.author = o.author; s.gen = o.gen; }
    if (o.ins) s.instrument = o.ins;
    if (o.pv) s.pv = o.pv;
    if (o.sherds) s.sherds = o.sherds;
    if (o.trim && o.trim.material) s.trim = o.trim;
    return s;
  };
})();
const flag = (v, b) => !!((v | 0) & b);
// this player's own data (the parrots on its shoulders)
function netSelfMeta(net, m) {
  const p = net.g.player, g = net.g;
  // asleep in a bed (the server's pose and bed): lying in it with the camera, like single player - before, the pose
  // was dropped and the player stayed standing by the bed (players' feedback 2026-10-31「睡觉不躺床上」)
  if ('sleeping_pos' in m) net.sleepPos = m.sleeping_pos;
  if ('pose' in m) net.selfPose = m.pose;
  if ('pose' in m || 'sleeping_pos' in m) {
    const bp = net.sleepPos;
    if ((net.selfPose === 'sleeping' || net.selfPose === 2) && bp && !g.sleeping) {
      const meta = g.world ? g.world.getMeta(bp[0], bp[1], bp[2]) : 0;
      g.sleeping = { x: bp[0] + 0.5, y: bp[1] + 0.5625, z: bp[2] + 0.5, t: 0, rot: meta & 3, net: true };
      p.vel = [0, 0, 0];
      g.ui.message('正在睡觉…（' + (touchOn(g) ? '点击潜行按钮' : '按 Shift ') + '起床）', '#AAAAAA');
    } else if (net.selfPose !== 'sleeping' && net.selfPose !== 2 && g.sleeping && g.sleeping.net) {
      const s = g.sleeping; g.sleeping = null;
      p.pos = [s.x, s.y + 0.5, s.z]; p.prev = [...p.pos];
      while (p.collides(p.box()) && p.pos[1] < HEIGHT) p.pos[1] += 1;
      p.prev = [...p.pos];
    }
  }
  for (const side of ['shoulder_parrot_left', 'shoulder_parrot_right']) if (side in m) {
    const v = m[side];
    if (side === 'shoulder_parrot_right' || !p.shoulder) p.shoulder = v && v.id ? { variant: v.Variant | 0 } : (side === 'shoulder_parrot_right' ? null : p.shoulder);
  }
}
// the server only sends the data that differs from vanilla's defaults, so a new mob starts from those - not from the
// random size or colour this game gave it (a size 1 slime came out as big as a size 4)
const NET_META_DEFAULTS = {
  slime: { size: 1 }, magma_cube: { size: 1 }, rabbit: { type: 0 }, fox: { type: 0 }, mooshroom: { type: 0 }, panda: { main_gene: 0, hidden_gene: 0 },
  salmon: { type: 1 }, pufferfish: { puff_state: 0 }, horse: { type_variant: 0 }, tropical_fish: { type_variant: 0 },
  goat: { is_screaming_goat: false, has_left_horn: true, has_right_horn: true },
};
function netMetaDefaults(net, e) { const d = NET_META_DEFAULTS[e.type]; if (d) netApplyMeta(net, e, d); }
function netApplyMeta(net, e, m) {
  const has = (k) => k in m;
  // every entity: flags, name, pose, age
  if (has('shared_flags')) { const f = m.shared_flags | 0; e.netFire = !!(f & 1); e.fire = f & 1 ? 2 : 0; e.sneaking = !!(f & 2); e.invisible = !!(f & 32); e.glowing = !!(f & 64); e.gliding = !!(f & 128); }
  if (has('custom_name')) e.customName = m.custom_name || null;
  if (has('baby') && e.makeBaby) { if (m.baby && !e.baby) e.makeBaby(); else if (!m.baby && e.baby) { e.baby = false; e.w = e.T.w; e.h = e.T.h; } }
  const pose = m.pose;
  const k = e.type;
  // a mob drawn with the vanilla models: the fields its drawing uses
  if (has('variant')) {
    const v = m.variant;
    if (k === 'wolf') e.variant = String(v);
    else if (k === 'frog') e.variant = String(v);
    else if (k === 'cat' && typeof CAT_VARIANTS !== 'undefined') e.variant = CAT_VARIANTS.includes(String(v)) ? String(v) : e.variant;
    else if (k === 'pig' || k === 'cow' || k === 'chicken') e.cvar = /warm|cold|temperate/.test(String(v)) ? String(v) : e.cvar;
    else if (k === 'zombie_nautilus') e.coral = /warm|coral/.test(String(v));
    else if (typeof v === 'number') e.variant = v;
  }
  if (has('flags') && typeof m.flags === 'number') {
    const f = m.flags;
    if (e instanceof Horse) { e.tame = flag(f, 2); e.eatT = flag(f, 16) ? 30 : 0; e.rearT = flag(f, 32) ? 15 : 0; e.mouthT = flag(f, 64) ? 5 : 0; }
    else if (k === 'wolf' || k === 'parrot' || k === 'cat' || k === 'nautilus' || k === 'zombie_nautilus') { e.sitting = flag(f, 1); e.owner = flag(f, 4) ? (e.owner || true) : null; }
    else if (k === 'fox') { e.sleeping = flag(f, 32); e.crouch = flag(f, 4) ? 5 : 0; e.sitting = flag(f, 1); }
    else if (k === 'panda') { e.sneezeT = flag(f, 2) ? 10 : 0; e.rollT = flag(f, 4) ? 16 : 0; e.sit = flag(f, 8) ? 20 : 0; }
    else if (k === 'bee') { e.stung = flag(f, 4); e.nectar = flag(f, 8); }
    else if (k === 'bat') e.resting = flag(f, 1);
    else if (k === 'vex') e.chargeT = flag(f, 1) ? 20 : 0;
  }
  if (has('anger_end_time')) e.anger = Number(m.anger_end_time) > 0 ? 400 : 0;
  if (k === 'wolf') { if (has('collar_color')) e.collar = DYES[m.collar_color | 0] || 'red'; e.target = e.anger > 0 ? net.g.player : null; }
  if (k === 'bee') e.target = e.anger > 0 ? net.g.player : null;
  if (k === 'horse' && has('type_variant')) { const tv = m.type_variant | 0; e.variant = (tv & 255) + ((tv >> 8) & 255) * 8; }
  if (has('chest')) { e.chest = !!m.chest; if (e.chest && !e.chestInv) e.chestInv = []; }
  if (has('strength')) e.strength = m.strength;
  if (k === 'camel' || k === 'camel_husk') { if (has('last_pose_change_tick')) { const sit = Number(m.last_pose_change_tick) < 0; if (sit !== !!e.sit) { e.sit = sit; e.sitT = 0; e.anims = {}; } } if (m.dash) e.anims.CAMEL_DASH = e.age; }
  if (k === 'fox' && has('type')) e.variant = m.type === 1 ? 'snow' : 'red';
  if (k === 'panda') { const G = ['normal', 'lazy', 'worried', 'playful', 'brown', 'weak', 'aggressive']; if (has('main_gene')) e.main = G[m.main_gene | 0] || 'normal'; if (has('hidden_gene')) e.hidden = G[m.hidden_gene | 0] || 'normal'; }
  if (k === 'rabbit' && has('type')) e.variant = { 0: 'brown', 1: 'white', 2: 'black', 3: 'white_splotched', 4: 'gold', 5: 'salt', 99: 'evil' }[m.type] || 'brown';
  if (k === 'axolotl' && has('playing_dead')) e.deadT = m.playing_dead ? 20 : 0;
  if (k === 'tropical_fish' && has('type_variant')) { const v = m.type_variant | 0; e.shape = v & 255 ? 1 : 0; e.pattern = (v >> 8) & 255; e.base = (v >> 16) & 255; e.pcol = (v >> 24) & 255; }
  if (k === 'pufferfish' && has('puff_state')) e.puff = clamp(m.puff_state | 0, 0, 2);
  if (k === 'salmon' && has('type')) e.size = ['small', 'medium', 'large'][m.type | 0] || 'medium';
  if (k === 'mooshroom' && has('type')) e.variant = m.type === 1 ? 'brown' : 'red';
  if (k === 'goat') { if (has('is_screaming_goat')) e.screaming = !!m.is_screaming_goat; if (has('has_left_horn')) e.horns[0] = !!m.has_left_horn; if (has('has_right_horn')) e.horns[1] = !!m.has_right_horn; }
  if ((k === 'slime' || k === 'magma_cube') && has('size') && e.setSize) e.setSize(Math.max(1, m.size | 0));
  if (k === 'shulker') {
    if (has('peek')) e.peek = (m.peek | 0) / 100; if (has('color')) e.color = m.color >= 0 && m.color < 16 ? DYES[m.color] : null;
    // (the face it clings to: down, up, north, south, west, east - drawn turned onto it, ShulkerRenderer)
    if (has('attach_face')) { const F = ['down', 'up', 'north', 'south', 'west', 'east'], v = m.attach_face; e.attachFace = typeof v === 'number' ? F[v] : String(v || 'down').toLowerCase(); }
  }
  if (k === 'snow_golem' && has('pumpkin')) e.pumpkin = !!((m.pumpkin | 0) & 16);
  if (k === 'armadillo' && has('armadillo_state')) { const st = m.armadillo_state; if (st !== e.st) { e.st = st; e.stT = st === 'scared' ? 100 : 0; e.anims = { [st]: e.age }; } }
  if (k === 'sniffer' && has('state')) { const st = m.state; e.st = st === 'digging' ? 'dig' : st === 'searching' || st === 'sniffing' ? 'sniff' : 'idle'; e.stT = 0; if (st === 'scenting') e.anims.SNIFFSNIFF = e.age; }
  if (k === 'creaking' && has('can_move')) e.frozen = !m.can_move;
  if (k === 'copper_golem') { if (has('weather_state')) e.ox = ['unaffected', 'exposed', 'weathered', 'oxidized'].indexOf(m.weather_state); if (e.ox < 0) e.ox = 0; if (has('copper_golem_state')) { const C = { getting_item: 'CHEST_INTERACTION_NOITEM_GET', getting_no_item: 'CHEST_INTERACTION_NOITEM_NOGET', dropping_item: 'CHEST_INTERACTION_ITEM_DROP', dropping_no_item: 'CHEST_INTERACTION_ITEM_NODROP' }[m.copper_golem_state]; if (C) e.anims = { [C]: e.age }; } }
  if (k === 'item_frame' || k === 'glow_item_frame') { if (has('item')) e.item = m.item ? net.stackIn(m.item) : null; if (has('rotation')) e.rot = m.rotation | 0; }
  if (k === 'painting' && has('painting_variant')) { const v = PAINTINGS.find((q) => q.key === String(m.painting_variant)); if (v) { e.v = v; e.resize(); } }
  if (k === 'ender_dragon' && has('phase')) e.phase = [5, 6, 7].includes(m.phase | 0) ? 'perch' : 'fly'; // (the sitting phases flap slowly)
  if (k === 'end_crystal') { if (has('show_bottom')) e.showBase = !!m.show_bottom; if (has('beam_target')) e.beamTarget = m.beam_target ? [m.beam_target[0], m.beam_target[1] - net.minY, m.beam_target[2]] : null; }
  if (k === 'armor_stand' && has('client_flags')) { e.small = flag(m.client_flags, 1); e.arms = flag(m.client_flags, 4); }
  if ((k === 'villager' || k === 'zombie_villager') && m.villager_data) { e.vtype = m.villager_data.type; e.profession = m.villager_data.profession; }
  if (k === 'turtle' && has('has_egg')) e.hasEgg = !!m.has_egg;
  if (k === 'wither' && has('inv')) e.invulT = m.inv | 0;
  // the two side heads look at what the server says they target (entity ids, 0 = none)
  if (k === 'wither') [['target_b', 0], ['target_c', 1]].forEach(([f, i]) => { if (has(f)) e.headTargets[i] = !m[f] ? null : m[f] === net.eid ? net.g.player : net.ents.get(m[f]) || null; });
  if (k === 'guardian' || k === 'elder_guardian') { if (has('attack_target')) { const t = m.attack_target ? (m.attack_target === net.eid ? net.g.player : net.ents.get(m.attack_target)) : null; e.target = t || null; e.beamT = t ? Math.max(0, e.beamT || 0) : -1; } }
  if (k === 'evoker' && has('spell_casting')) e.spellT = m.spell_casting ? 20 : 0;
  if (k === 'pillager' && has('is_charging_crossbow')) e.charging = !!m.is_charging_crossbow;
  if (k === 'witch' && has('using_item')) e.drinkT = m.using_item ? 10 : 0;
  if (k === 'ghast' && has('is_charging')) e.charge = m.is_charging ? 20 : 0;
  if (k === 'creeper' && has('swell_dir')) { if (m.swell_dir > 0 && e.fuse < 0) e.fuse = 0; if (m.swell_dir < 0) e.fuse = -1; }
  if (k === 'polar_bear' && has('standing')) e.stand = m.standing ? 20 : 0;
  if (k === 'ocelot' && has('trusting')) e.trusting = !!m.trusting;
  if (k === 'allay' && has('dancing')) e.dance = !!m.dancing;
  if (k === 'strider' && has('suffocating')) e.warm = !m.suffocating;
  if (k === 'sheep' && has('wool')) { e.woolColor = m.wool & 15; e.sheared = !!(m.wool & 16); }
  if (k === 'tnt' && has('fuse')) e.fuse = m.fuse | 0;
  if (k === 'fishing_bobber' && has('hooked_entity')) e.hooked = m.hooked_entity ? net.ents.get(m.hooked_entity - 1) || null : null;
  if (k === 'arrow' || k === 'spectral_arrow' || k === 'trident') { if (has('in_ground')) e.inGround = e.stuck = !!m.in_ground; }
  // poses: one-shot animations of the mobs that have them
  if (pose) {
    if (e instanceof Warden) { const A = { emerging: 'EMERGE', digging: 'DIG', roaring: 'ROAR', sniffing: 'SNIFF' }[pose]; if (A && !(A in e.anims)) e.anims = { [A]: e.age }; }
    else if (e instanceof Breeze) { const A = { shooting: 'SHOOT', inhaling: 'INHALE', sliding: 'SLIDE', long_jumping: 'JUMP' }[pose]; if (A) e.anims = { [A]: e.age }; else if (pose === 'standing') e.anims = {}; }
    else if (e instanceof Frog) { const A = { croaking: 'CROAK', using_tongue: 'TONGUE', long_jumping: 'JUMP' }[pose]; if (A) e.anims = { [A]: e.age }; }
    else if (e instanceof Camel) { const sit = pose === 'sitting'; if (sit !== !!e.sit) { e.sit = sit; e.sitT = 0; e.anims = {}; } }
  }
}
// equipment: what mobs hold and wear, saddles, body armour (horse / wolf / nautilus armour, carpets, harnesses)
function netApplyEquip(net, e, slots) {
  const st = (i) => slots[i] !== undefined ? (slots[i] ? net.stackIn(slots[i]) : null) : undefined;
  const main = st(0), off = st(1), body = st(6), sad = st(7);
  if (main !== undefined) { e.hand = main; e.heldId = main && !main.unk ? main.id : null; }
  if (off !== undefined) e.offhand = off;
  if (e.armorItems || e.gear || e instanceof Mob) {
    const arm = [st(5), st(4), st(3), st(2)]; // head, chest, legs, feet
    if (e.gear) { // armor stands: [feet, legs, chest, head, main, off]
      const map = [[2, 0], [3, 1], [4, 2], [5, 3]];
      for (const [s, i] of map) { const v = st(s); if (v !== undefined) e.gear[i] = v; }
      if (main !== undefined) e.gear[4] = main; if (off !== undefined) e.gear[5] = off;
    } else {
      if (!e.armorItems) e.armorItems = [];
      arm.forEach((v, i) => { if (v !== undefined) e.armorItems[i] = v; });
    }
  }
  if (sad !== undefined) e.saddled = !!sad;
  if (body !== undefined) {
    const bk = body && ITEMS[body.id] ? ITEMS[body.id].key : '';
    if (e instanceof Llama) e.carpet = /_carpet$/.test(bk) ? body : null;
    else if (e instanceof Horse) e.armorItem = body;
    else if (e instanceof Wolf) e.armor = body;
    else if (e instanceof HappyGhast) e.harness = body;
    else if (e instanceof Nautilus) e.armorItem = body;
  }
}
// entity status bytes vanilla's client turns into animations
function netStatus(net, e, s) {
  if (e instanceof Warden && s === 4) e.anims.ATTACK = e.age;
  if (e instanceof Warden && s === 62) e.anims.SONIC_BOOM = e.age;
  if (e instanceof Ravager && s === 4) e.atkT = 10;
  if (e instanceof Ravager && s === 39) e.stunT = 40;
  if (e instanceof Goat && s === 58) e.ramT = 40;
  if ((e instanceof Wolf || e instanceof Ocelot || e instanceof Parrot) && (s === 6 || s === 7)) for (let i = 0; i < 7; i++) net.g.particles.spawn(s === 7 ? 'heart' : 'smoke', e.pos[0] + (Math.random() - 0.5), e.pos[1] + e.h, e.pos[2] + (Math.random() - 0.5), 0, 0.02, 0);
  if (s === 18) for (let i = 0; i < 7; i++) net.g.particles.spawn('heart', e.pos[0] + (Math.random() - 0.5), e.pos[1] + e.h, e.pos[2] + (Math.random() - 0.5), 0, 0.02, 0);
  if (e instanceof Creaking && s === 66) e.anims.INVULNERABLE = e.age;
}
// maps from the server: kept by number with a 'n' in front (so they don't mix with this game's own maps)
function netMapData(net, m) {
  const g = net.g, id = 'n' + m.id;
  const M = g.netMaps || (g.netMaps = {});
  const md = M[id] || (M[id] = { px: new Uint8Array(16384), scale: 0, locked: false, cx: 0, cz: 0, dim: g.dim, net: true });
  md.scale = m.scale; md.locked = m.locked; md.icons = m.icons || md.icons;
  if (m.rect && m.data) {
    const [x0, y0, w, h] = m.rect, b = atob(m.data);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = (y0 + j) * 128 + x0 + i; if (k < 16384) md.px[k] = b.charCodeAt(j * w + i); }
  }
  md.dirty = true;
}
(() => {
  const _md = Game.prototype.mapData;
  Game.prototype.mapData = function (id) { if (typeof id === 'string' && id[0] === 'n') return (this.netMaps && this.netMaps[id]) || null; return _md.call(this, id); };
  // on a server, maps are the server's: no drawing them here
  const _um = Game.prototype.updateMap;
  Game.prototype.updateMap = function (m) { if (m && m.net) return; return _um.call(this, m); };
})();

// riding a server's horse, camel, pig ...: like vanilla, this client moves the mount it controls and sends where
// it went (vehicle_move); a mount someone else rides carries them along
(() => {
  const _net = netEntityTick;
  netEntityTick = function () {
    const p = this.game.player;
    if (this.rider === p && p.rideInput) {
      if (this.vm && this.ridden) {
        this.savePrev(); this.age++; this.updateFluids();
        const c = this.ctl; c.fwd = 0; c.strafe = 0; c.jump = false; c.mod = 1; c.goal = null; c.look = null; c.up = 0; c.face = null;
        this.ridden(c, p.rideInput); this.moveBy(c); this.animate();
        if (this.hurtTime > 0) this.hurtTime--;
        p.followVehicle(this); return;
      }
      if (typeof STICK_FOR !== 'undefined' && STICK_FOR[this.type]) { Mob.prototype.tick.call(this); return; }
    }
    _net.call(this);
    if (this.rider) { if (this.rider === p) p.followVehicle(this); else if (this.seat) { const s = this.seat(); this.rider.pos = s; this.rider.netPos = s.slice(); this.rider.lerpN = 0; } }
  };
})();

// ---- smooth movement for the server's entities: snapshot interpolation ----------------------------------------
// the server sends moves every tick or two and they arrive unevenly; each entity is shown a little in the past
// (NET_DELAY), between the two positions received around that time, so it moves at an even pace
const NET_DELAY = 110;
(() => {
  const _om = NetClient.prototype.onMessage;
  NetClient.prototype.onMessage = function (m) {
    const r = _om.call(this, m);
    if (m.t === 'move' && m.x !== undefined) {
      const e = this.ents.get(m.id) || this.pendingItems.get(m.id);
      if (e && !(e.netVel && e.tick === netShotTick)) {
        const now = performance.now(), s = e.snaps || (e.snaps = []);
        // a position sync (minecarts send nothing else, every 3 ticks) moves on smoothly like the rest; only a real
        // jump starts afresh
        const q = s[s.length - 1];
        if (m.tp && q && Math.hypot(e.netPos[0] - q[1], e.netPos[1] - q[2], e.netPos[2] - q[3]) > 8) s.length = 0;
        // how often this one's moves come (minecarts every 3 ticks, most mobs every tick or two)
        const gap = s.length ? now - s[s.length - 1][0] : 1e9;
        if (gap < 400) e.snapGap = (e.snapGap || 50) * 0.8 + gap * 0.2; // (a longer one: it was standing still)
        s.push([now, e.netPos[0], e.netPos[1], e.netPos[2]]);
        if (s.length > 8) s.shift();
      }
    }
    if (m.t === 'remove') for (const id of m.ids) { const e = this.ents.get(id); if (e) e.snaps = null; }
    return r;
  };
  // the position at (now - NET_DELAY): between two snapshots, or the newest one when nothing newer has come. An
  // entity whose moves come further apart is shown further back (1.5 of its gap), or it would reach the newest
  // snapshot, stop and jump on when the next came (a minecart ridden: the whole view stuttered)
  const snapPos = (e) => {
    const s = e.snaps; if (!s || !s.length) return null;
    const t = performance.now() - Math.max(NET_DELAY, (e.snapGap || 0) * 1.5);
    if (s[0][0] >= t) return [s[0][1], s[0][2], s[0][3]];
    const q = s[s.length - 1]; if (q[0] <= t) return [q[1], q[2], q[3]];
    let i = s.length - 1; while (i > 0 && s[i - 1][0] > t) i--;
    const a = s[i - 1], b = s[i], k = (t - a[0]) / Math.max(1, b[0] - a[0]);
    return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
  };
  // the target goes in as a one-step move, so the tick's own bookkeeping (previous position, legs) sees it
  const wrap = (fn) => function () {
    const p = this.game.player;
    // a passenger goes where its mount's seat is (the server sends no moves for it meanwhile)
    const v = this.vehicleRef;
    if (v && v.rider === this && !v.dead) { this.snaps = null; if (v.seat) { const s = v.seat(); this.pos = s; this.netPos = s.slice(); this.lerpN = 0; } }
    else if (!(this.rider === p && (this instanceof Boat || (this.vm && this.ridden)))) { const t = snapPos(this); if (t) { this.netPos = t; this.lerpN = 1; } } // (what this client steers moves here)
    return fn.call(this);
  };
  netEntityTick = wrap(netEntityTick);
  netItemTick = wrap(netItemTick);
  netVehicleTick = wrap(netVehicleTick);
})();

// ---- chunk data spread over frames ------------------------------------------------------------------------
// the server sends chunks in batches; decoding a batch at once would stall a frame. Chunks and what depends on
// them (block changes, unloads, signs, block entities) wait in one queue, in order, and are worked off with a
// time budget each frame; everything else (entities, chat, the player) is handled as it comes.
const NET_CHUNK_MSG = new Set(['block', 'blocks', 'unload', 'signs', 'be']);
(() => {
  const _ob = NetClient.prototype.onBinary, _om = NetClient.prototype.onMessage;
  NetClient.prototype.onBinary = function (buf) { (this.cq || (this.cq = [])).push([0, buf]); };
  NetClient.prototype.onMessage = function (m) {
    if (NET_CHUNK_MSG.has(m.t)) { (this.cq || (this.cq = [])).push([1, m]); return; }
    if (m.t === 'respawn' || m.t === 'login') this.cq = [];
    return _om.call(this, m);
  };
  NetClient.prototype.drainChunks = function (budget) {
    const q = this.cq; if (!q || !q.length) return;
    const t0 = performance.now(), lim = q.length > 300 ? budget * 3 : budget;
    let i = 0;
    while (i < q.length && (i === 0 || performance.now() - t0 < lim)) {
      const [k, v] = q[i++];
      try { if (k === 0) _ob.call(this, v); else _om.call(this, v); } catch (e) { console.error('net', e); }
    }
    q.splice(0, i);
  };
  const _fr = Game.prototype.frame;
  Game.prototype.frame = function (...a) { if (this.net) this.net.drainChunks(6); return _fr.apply(this, a); };
})();

// ---- the recipe book on a server (1.21.2+): the recipes the player has unlocked come from the server, each with
// its slots; clicking one asks the server to place it (craft_recipe_request) - it moves the items, or answers
// with the recipe to show as a ghost when they aren't there ----------------------------------------------------
const NET_RB_TAB = { crafting_equipment: 1, crafting_building_blocks: 2, crafting_misc: 3, crafting_redstone: 4 };
// the proxy's recipe (item names per slot) -> the shape the book and planRecipe use (RECIPES)
function netRecipe(o) {
  const ids = (names) => (names || []).map((n) => ITEM_KEY[n]).filter((v) => v !== undefined);
  const result = ITEM_KEY[o.result];
  if (result === undefined) return null;
  const r = { netId: o.id, result, count: o.count || 1, cat: NET_RB_TAB[o.cat] || 3 };
  if (o.shaped) {
    r.type = 'shaped'; r.w = o.w; r.h = o.h; r.keys = {}; r.pattern = [];
    for (let y = 0; y < o.h; y++) {
      let row = '';
      for (let x = 0; x < o.w; x++) {
        const opts = ids(o.ing[y * o.w + x]);
        if (!opts.length) { row += ' '; continue; }
        const ch = String.fromCharCode(65 + y * o.w + x); r.keys[ch] = opts; row += ch;
      }
      r.pattern.push(row);
    }
  } else { r.type = 'shapeless'; r.ing = o.ing.map(ids).filter((a) => a.length); }
  return r;
}
(() => {
  const _om = NetClient.prototype.onMessage;
  NetClient.prototype.onMessage = function (m) {
    if (m.t === 'recipes') {
      if (m.replace || !this.recipes) this.recipes = new Map();
      for (const o of m.add || []) { const r = netRecipe(o); if (r) this.recipes.set(o.id, r); }
      for (const id of m.remove || []) this.recipes.delete(id);
      return;
    }
    if (m.t === 'ghost') {
      const sc = this.g.ui.screen, r = netRecipe(m);
      if (r && sc instanceof CraftingScreen && sc.netWin === m.win) sc.showGhost(r);
      return;
    }
    return _om.call(this, m);
  };
  // what the book lists: the server's recipes in place of this game's, the inventory and the grid as they are
  const _br = CraftingScreen.prototype.bookRecipes;
  CraftingScreen.prototype.bookRecipes = function () {
    if (!this.net) return _br.call(this);
    const n = this.size * this.size, inv = this.game.player.inv, avail = new Map();
    const add = (s) => { if (s && !s.unk) avail.set(s.id, (avail.get(s.id) || 0) + s.count); };
    for (let i = 0; i < 36; i++) add(inv.slots[i]);
    for (const s of this.slots) if (s.group === 'craft') add(s.get());
    const q = this.search.trim().toLowerCase(), byResult = new Map();
    for (const r of (this.net.recipes || new Map()).values()) {
      if (r.type === 'shaped' ? (r.w > this.size || r.h > this.size) : r.ing.length > n) continue;
      if (this.tab > 0 && r.cat !== this.tab) continue;
      if (q && !ITEMS[r.result].cn.toLowerCase().includes(q) && !ITEMS[r.result].key.includes(q)) continue;
      const plan = planRecipe(r, avail, this.size);
      let e = byResult.get(r.result);
      if (!e) byResult.set(r.result, e = { r, plan, many: false });
      else { e.many = true; if (!e.plan && plan) { e.r = r; e.plan = plan; } }
    }
    let list = [...byResult.values()];
    if (this.onlyCraftable) list = list.filter((e) => e.plan);
    list.sort((a, b) => (b.plan ? 1 : 0) - (a.plan ? 1 : 0));
    return list;
  };
  const _fr = CraftingScreen.prototype.fillRecipe;
  CraftingScreen.prototype.fillRecipe = function (entry, max) {
    if (!this.net) return _fr.call(this, entry, max);
    this.ghost = null;
    this.net.send({ t: 'craft', win: this.netWin, id: entry.r.netId, all: !!max });
    Sound.click();
  };
  // the red ghost of a recipe that can't be placed (the server's answer)
  CraftingScreen.prototype.showGhost = function (r) {
    const g = new Array(this.size * this.size).fill(null);
    if (r.type === 'shaped') { for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const ch = r.pattern[y][x]; if (ch && ch !== ' ') g[y * this.size + x] = r.keys[ch]; } }
    else r.ing.forEach((opts, i) => { g[i] = opts; });
    this.ghost = { slots: g, result: r.result, t: performance.now() };
  };
  const _dg = CraftingScreen.prototype.drawGhost;
  CraftingScreen.prototype.drawGhost = function (ui) {
    if (this.net && this.ghost && this.slots.some((s) => s.group === 'craft' && s.get())) this.ghost = null;
    return _dg.call(this, ui);
  };
})();

// ---- a firework rocket boosting this player's elytra flight on a server: the server's rocket entity names the player
// it is attached to (attached_to_target: the entity id + 1, 0 none); like vanilla's client, this player's own flight
// is pushed here while that rocket lives (the server only checks the moves). 60 ticks at most if its removal is missed
(() => {
  const _om = NetClient.prototype.onMessage;
  NetClient.prototype.onMessage = function (m) {
    const r = _om.call(this, m), p = this.g.player;
    if (m.t === 'meta' && m.m && typeof m.m.attached_to_target === 'number' && m.m.attached_to_target - 1 === this.eid && p) {
      this.rocket = m.id; p.boostT = 60;
    } else if (m.t === 'remove' && this.rocket != null && m.ids.includes(this.rocket)) {
      this.rocket = null; if (p) p.boostT = 0;
    }
    return r;
  };
})();

// ---- players' names: a room's server may map a display name that isn't a Minecraft name to a stand-in; the room
// service says whose is whose ('names'), and everything shown here - names over heads, the player list, chat, joins,
// deaths - has the real name, while a command typed with a real name goes to the server with the stand-in
(() => {
  const sub = (s, from, to) => { s = String(s); return s.includes(from) ? s.split(from).join(to) : s; };
  const _om = NetClient.prototype.onMessage;
  NetClient.prototype.onMessage = function (m) {
    if (m.t === 'names') {
      const A = this.alias || (this.alias = new Map()); for (const [a, d] of Object.entries(m.map || {})) if (a !== d) A.set(a, d);
      // (administrators' name colours: over their heads and in chat)
      const C = this.colors || (this.colors = new Map()); for (const [n, c] of Object.entries(m.colors || {})) { if (c) C.set(n, c); else C.delete(n); }
      return;
    }
    if (m.t === 'announce') { showAnnounce(this.g, m); return; }
    const A = this.alias;
    if (A && A.size) {
      if (m.t === 'chat' && m.text) for (const [a, d] of A) m.text = sub(m.text, a, d);
      else if (m.t === 'players' && m.list) m.list = m.list.map((o) => ({ ...o, name: A.get(o.name) || o.name }));
      else if (m.t === 'spawn' && m.name) m.name = A.get(m.name) || m.name;
    }
    const r = _om.call(this, m);
    // a chat line "<name> ..." from a player whose name has a colour: the name in it
    const C = this.colors, last = this.g.ui.chat[this.g.ui.chat.length - 1];
    if (m.t === 'chat' && C && C.size && last && !last.parts) {
      const mm = /^<([^>]+)> /.exec(last.text), col = mm && C.get(mm[1]);
      if (col) last.parts = [['<', last.color], [mm[1], col], [last.text.slice(mm[1].length + 1), last.color]];
    }
    return r;
  };
  const _chat = NetClient.prototype.chat;
  NetClient.prototype.chat = function (text) {
    const A = this.alias;
    if (A && A.size && String(text).startsWith('/')) for (const [a, d] of A) text = sub(text, d, a);
    return _chat.call(this, text);
  };
})();
// a name prefix (cosmetics.js: the sign-in event's potato) before the name in a chat line "<name> ...", coloured
// name or not (once a line: an action-bar message adds no line)
(() => {
  const _om = NetClient.prototype.onMessage;
  NetClient.prototype.onMessage = function (m) {
    const r = _om.call(this, m), last = this.g.ui.chat[this.g.ui.chat.length - 1];
    if (m && m.t === 'chat' && typeof Cosmetics !== 'undefined' && last && !last.pre) {
      last.pre = true;
      const mm = /^<([^>]+)> /.exec(last.text), shown = mm && Cosmetics.preName(this.g, mm[1]);
      if (shown && shown !== mm[1]) {
        last.text = '<' + shown + last.text.slice(mm[1].length + 1);
        if (last.parts && last.parts[1]) last.parts[1] = [shown, last.parts[1][1]];
      }
    }
    return r;
  };
})();

// ---- what the server does to this player and asks of it (2026-10-30 fixes) ----
// knockback: the server's velocity for this player (hit by a mob or a player) and an explosion's push (TNT, a wind
// charge's burst) - this client moves its own player, so they are applied here; the explosion shown and heard;
// "finished using" (entity event 9) ends eating / drinking; the stand-in names in a death message; a player inside
// blocks (an ender pearl landing against a wall) pushed out to the nearest free place, like vanilla's client
(() => {
  const _om = NetClient.prototype.onMessage;
  NetClient.prototype.onMessage = function (m) {
    const g = this.g, p = g.player;
    if (m.t === 'vel' && m.id === this.eid && p && Array.isArray(m.v)) { p.vel = m.v.slice(); p.onGround = false; return; }
    if (m.t === 'boom') {
      const y = m.y - this.minY, wind = /wind/.test(m.snd || '');
      if (m.snd) Sound.ev(m.snd, [m.x, y, m.z], 4, 1); else Sound.ev('entity.generic.explode', [m.x, y, m.z], 4, 1);
      g.particles.spawn(wind ? 'poof' : 'explosion', m.x, y, m.z, 0, 0, 0);
      if (wind) for (let i = 0; i < 8; i++) g.particles.spawn('poof', m.x + (Math.random() - 0.5), y + Math.random(), m.z + (Math.random() - 0.5), (Math.random() - 0.5) * 0.2, 0.05, (Math.random() - 0.5) * 0.2);
      if (m.kb && p) { p.vel[0] += m.kb[0]; p.vel[1] += m.kb[1]; p.vel[2] += m.kb[2]; if (m.kb[1] > 0) p.onGround = false; }
      return;
    }
    if (m.t === 'status' && m.id === this.eid && m.s === 9 && p) { p.usingItem = null; p.useT = 0; p.useHand = null; }
    if (m.t === 'death' && m.msg && this.alias) for (const [a, d] of this.alias) m.msg = String(m.msg).split(a).join(d);
    if (m.t === 'pos' && p) this.unstick = 40; // (watch for being stuck for 2 seconds after a teleport)
    return _om.call(this, m);
  };
  // inside blocks: out along x / z (or up) by the shortest way, a bit a tick (LocalPlayer.moveTowardsClosestSpace)
  const _nt = Game.prototype.netTick;
  Game.prototype.netTick = function () {
    const r = _nt.apply(this, arguments), p = this.player, n = this.net;
    if (!n || !p || p.noClip || this.mode === 'spectator' || !(n.unstick > 0)) return r;
    n.unstick--;
    if (!p.collides(p.box())) return r;
    let best = null;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) {
      for (let d = 0.1; d <= 1.6; d += 0.1) {
        const b = p.box(), o = [dx * d, dy * d, dz * d];
        if (!p.collides([b[0] + o[0], b[1] + o[1], b[2] + o[2], b[3] + o[0], b[4] + o[1], b[5] + o[2]])) { if (!best || d < best.d) best = { o, d }; break; }
      }
    }
    if (best) { for (let i = 0; i < 3; i++) p.pos[i] += best.o[i]; p.prev = [...p.pos]; }
    return r;
  };
})();
// the game mode on a server: an operator's switch (F3 + F4 / F3 + N, the pause menu) asks the server (/gamemode)
Game.prototype.requestMode = function (m) {
  if (!this.net) { this.setMode(m); return; }
  if ((this.net.opLevel | 0) < 2) { this.ui.message('[调试]：无法切换游戏模式；没有权限', '#FF5555'); return; }
  this.net.chat('/gamemode ' + m);
};
// the shulker clinging to a wall or a ceiling: turned about its block's middle so its base is on that face
(() => {
  const R = { up: (m) => M4.rotX(m, Math.PI), north: (m) => M4.rotX(m, Math.PI / 2), south: (m) => M4.rotX(m, -Math.PI / 2), west: (m) => M4.rotZ(m, -Math.PI / 2), east: (m) => M4.rotZ(m, Math.PI / 2) };
  const pd = Shulker.prototype.preDraw;
  Shulker.prototype.preDraw = function (m, a) {
    const f = this.attachFace && R[this.attachFace];
    if (f) {
      const ip = this.ipos ? this.ipos(a) : this.pos, nm = M4.create();
      M4.translate(nm, ip[0], ip[1] + 0.5, ip[2]); f(nm); M4.translate(nm, 0, -0.5, 0);
      m.set(nm);
    }
    if (pd) return pd.call(this, m, a);
  };
})();
