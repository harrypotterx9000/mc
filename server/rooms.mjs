// Rooms, temporary identities, permissions, validation and synchronization.
//
// The server is authoritative for the shared world overlay (block deltas),
// block entities, player entity state, dropped items, world time, membership
// and room lifecycle. Terrain is generated client-side from the server's seed;
// the server stores the seed plus the changes made on top of it.
import { randomBytes, randomInt, createHash, timingSafeEqual } from 'node:crypto';
import { PROTO, LIMITS, cleanName, cleanRoomName, cleanChat, isObj, isInt, isNum, inInt, validCode, validPid, validToken, validPos, validLook, validState, validStack, validBlockEntry, validBlockEntityKey, validBlockEntityData, validPstate } from './protocol.mjs';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TICK_MS = 50;
const TPS = 1000 / TICK_MS;
const DAY = 24000;
const ITEM_TTL = 5 * 60 * 1000;
const ITEM_PICKUP_DELAY = 900;

class Bucket {
  constructor(rate, burst) { this.rate = rate; this.burst = burst; this.tokens = burst; this.t = Date.now(); }
  take(n = 1) {
    const now = Date.now();
    if (now > this.t) { this.tokens = Math.min(this.burst, this.tokens + (now - this.t) / 1000 * this.rate); this.t = now; }
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }
}

const hashToken = (t) => createHash('sha256').update(String(t)).digest('hex');
const sameHash = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== 64 || b.length !== 64) return false;
  try { return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')); } catch (e) { return false; }
};
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const pidOf = () => 'p_' + randomBytes(8).toString('hex');
const tokenOf = () => randomBytes(32).toString('base64url');
const normIp = (ip) => String(ip || '').replace(/^::ffff:/, '');

class Room {
  constructor(mgr, record) {
    this.mgr = mgr;
    this.cfg = mgr.cfg;
    this.log = mgr.log;
    this.code = record.code;
    this.dir = record.dir || ('room-' + record.code);
    this.name = record.name;
    this.maxPlayers = Math.min(this.cfg.maxPlayersPerRoom, Math.max(2, record.maxPlayers | 0));
    this.gamemode = ['survival', 'creative', 'adventure', 'spectator'].includes(record.gamemode) ? record.gamemode : 'survival';
    this.difficulty = Number.isInteger(record.difficulty) ? Math.max(0, Math.min(3, record.difficulty)) : 2;
    this.createdAt = Number(record.createdAt) || Date.now();
    this.updatedAt = Number(record.updatedAt) || this.createdAt;
    this.ownerPid = validPid(record.ownerPid) ? record.ownerPid : null;
    this.closed = !!record.closed;
    const w = record.world || {};
    this.world = {
      seed: Number.isInteger(w.seed) ? w.seed : 0,
      gen: 2,
      name: cleanRoomName(w.name || this.name + ' 的世界') || '世界',
      spawn: validPos(w.spawn) ? w.spawn.map((n) => Math.floor(n)) : [0, 100, 0],
      time: inInt(w.time, 0, DAY - 1) ? w.time : 6000,
      weather: isNum(w.weather) ? Math.max(0, Math.min(1, w.weather)) : 0,
      rain: isNum(w.rain) ? Math.max(0, Math.min(1, w.rain)) : 0,
      difficulty: inInt(w.difficulty, 0, 3) ? w.difficulty : this.difficulty,
    };
    this.deltas = new Map();
    this.blockCount = 0;
    this.blockEntities = new Map();
    for (const e of Array.isArray(record.blocks) ? record.blocks : []) {
      const b = validBlockEntry(e);
      if (b && (!this.mgr.blockIds || this.mgr.blockIds.has(b[3]))) this._putDelta(b);
    }
    for (const row of Array.isArray(record.blockEntities) ? record.blockEntities : []) {
      if (!Array.isArray(row) || row.length !== 2) continue;
      const [k, data] = row;
      const d = validBlockEntityData(data);
      if (validBlockEntityKey(k) && d) this.blockEntities.set(k, d);
    }
    this.players = new Map();
    for (const p of Array.isArray(record.players) ? record.players : []) this._restorePlayer(p);
    this.items = new Map();
    this.nextItem = 1;
    this.conns = new Map(); // conn -> player (online only)
    this.rev = 0;
    this.dirty = false;
    this.lastSave = Date.now();
    this.tickCount = 0;
    this.snapEvery = Math.max(1, Math.round(TPS / this.cfg.snapshotHz));
    this._removed = false;
  }

  // ---- persistence ------------------------------------------------------------
  _restorePlayer(p) {
    if (!isObj(p) || !validPid(p.pid)) return;
    const name = cleanName(p.name);
    if (!name) return;
    const state = p.state && isObj(p.state) && JSON.stringify(p.state).length <= LIMITS.maxPstateBytes * 2 ? p.state : null;
    this.players.set(p.pid, {
      pid: p.pid, name, tokenHash: /^[a-f0-9]{64}$/.test(p.tokenHash || '') ? p.tokenHash : '',
      joinedAt: Number(p.joinedAt) || Date.now(), lastSeen: Number(p.lastSeen) || 0,
      pstate: state, look: validLook(p.look) || null,
      pos: state && validPos(state.pos) ? state.pos.map(Number) : this.world.spawn.slice(),
      yaw: isNum(state && state.yaw) ? state.yaw : 0, pitch: isNum(state && state.pitch) ? state.pitch : 0,
      health: isNum(state && state.health) ? state.health : 20,
      mode: ['survival', 'creative', 'adventure', 'spectator'].includes(state && state.mode) ? state.mode : this.gamemode,
      held: null, armor: [null, null, null, null], sneak: false, swing: false, swim: false, dead: false, flying: false,
      conn: null, online: false, disconnectedAt: Number(p.lastSeen) || 0,
      lastStateAt: 0, lastCorrect: 0, violations: 0, joinedStateAt: Date.now(),
      buckets: null,
    });
  }

  toRecord() {
    const blocks = [];
    for (const m of this.deltas.values()) for (const e of m.values()) blocks.push(e);
    blocks.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
    const blockEntities = [...this.blockEntities.entries()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    const players = [...this.players.values()].sort((a, b) => a.pid < b.pid ? -1 : 1).map((p) => ({
      pid: p.pid, name: p.name, tokenHash: p.tokenHash || '', joinedAt: p.joinedAt,
      lastSeen: p.online ? Date.now() : p.disconnectedAt || p.lastSeen || 0,
      look: p.look || null, state: p.pstate || null,
    }));
    return {
      v: 1, code: this.code, dir: this.dir, name: this.name, maxPlayers: this.maxPlayers,
      gamemode: this.gamemode, difficulty: this.difficulty, createdAt: this.createdAt, updatedAt: Date.now(),
      ownerPid: this.ownerPid, closed: this.closed,
      world: { ...this.world },
      blocks, blockEntities, players,
    };
  }

  _putDelta(e) {
    const [x, y, z] = e;
    const ck = (x >> 4) + ',' + (z >> 4), pk = x + ',' + y + ',' + z;
    let m = this.deltas.get(ck);
    if (!m) { m = new Map(); this.deltas.set(ck, m); }
    if (!m.has(pk)) this.blockCount++;
    m.set(pk, e);
  }

  // ---- helpers ----------------------------------------------------------------
  get onlinePlayers() { return [...this.conns.values()]; }
  get onlineCount() { return this.conns.size; }

  summary() {
    return { code: this.code, name: this.name, maxPlayers: this.maxPlayers, players: this.onlineCount, gamemode: this.gamemode, difficulty: this.difficulty, owner: this.ownerName(), createdAt: this.createdAt };
  }

  ownerName() { const p = this.ownerPid && this.players.get(this.ownerPid); return p ? p.name : ''; }

  playerList() {
    return this.onlinePlayers.map((p) => ({ pid: p.pid, name: p.name, owner: p.pid === this.ownerPid, mode: p.mode, look: p.look || null }));
  }

  broadcast(obj, exceptConn = null) {
    // Snapshot messages go to every player: encode once, not once per connection. The old per-connection
    // JSON.stringify was the largest CPU cost of a 10-player room (measured in the phase-07 load test).
    let text = obj;
    if (typeof obj !== 'string') {
      try { text = JSON.stringify(obj); } catch (e) { return; }
    }
    for (const [conn, p] of this.conns) { if (conn !== exceptConn) conn.sendText ? conn.sendText(text) : conn.send(text); }
  }

  sendTo(pid, obj) { const p = this.players.get(pid); if (p && p.conn) p.conn.send(obj); }

  system(text) { this.broadcast({ t: 'chat', sys: true, text: cleanChat(text) }); }

  uniqueName(base) {
    const n = cleanName(base) || '玩家';
    const used = new Set(this.onlinePlayers.map((p) => p.name.toLowerCase()));
    if (!used.has(n.toLowerCase())) return n;
    for (let i = 2; i < 100; i++) {
      const suffix = String(i), cand = n.slice(0, LIMITS.maxName - suffix.length) + suffix;
      if (!used.has(cand.toLowerCase())) return cand;
    }
    return ('玩家' + randomInt(100, 999)).slice(0, LIMITS.maxName);
  }

  ensureOwner() {
    const current = this.ownerPid && this.players.get(this.ownerPid);
    // a transient disconnect keeps ownership for the resume window; only an
    // explicit leave, a kick or an expired session transfers it
    const resumable = current && !current.online && current.tokenHash &&
      Date.now() - (current.disconnectedAt || 0) <= this.cfg.resumeSeconds * 1000;
    if (current && (current.online || resumable)) return this.ownerPid;
    const next = this.onlinePlayers.sort((a, b) => (a.joinedAt - b.joinedAt) || (a.pid < b.pid ? -1 : 1))[0];
    const before = this.ownerPid;
    this.ownerPid = next ? next.pid : null;
    this.dirty = true;
    if (next && before !== next.pid) {
      this.broadcastPlayers();
      this.system(next.name + ' 成为了房主');
      this.log.info('owner_transferred', { room: this.code, to: next.pid });
    }
    return this.ownerPid;
  }

  broadcastPlayers() { this.broadcast({ t: 'players', list: this.playerList() }); }

  // ---- joining / leaving ------------------------------------------------------
  sendWelcome(conn, p, resumed) {
    conn.send({
      t: 'welcome', v: PROTO, resumed: !!resumed,
      you: { pid: p.pid, name: p.name, token: p.plainToken || null, owner: p.pid === this.ownerPid, state: p.pstate || null },
      room: { code: this.code, name: this.name, maxPlayers: this.maxPlayers, gamemode: this.gamemode, difficulty: this.difficulty, createdAt: this.createdAt, ownerPid: this.ownerPid, players: this.onlineCount },
      world: { ...this.world },
      players: this.playerList(),
      limits: { maxPlayers: this.maxPlayers, snapshotHz: this.cfg.snapshotHz },
    });
    // the shared delta world, in bounded messages
    const all = [];
    for (const m of this.deltas.values()) for (const e of m.values()) all.push(e);
    all.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
    for (let i = 0; i < all.length; i += 1000) {
      conn.send({ t: 'blocks', list: all.slice(i, i + 1000), more: i + 1000 < all.length });
    }
    const bes = [...this.blockEntities.entries()];
    for (let i = 0; i < bes.length; i += 500) conn.send({ t: 'blockEntities', list: bes.slice(i, i + 500) });
    conn.send({ t: 'items', list: [...this.items.values()].map((it) => [it.id, it.stack, it.pos[0], it.pos[1], it.pos[2]]) });
    conn.send({ t: 'ready' });
    p.plainToken = null;
    this.log.info('welcome_sent', { room: this.code, pid: p.pid, resumed: !!resumed, blocks: all.length, entities: bes.length });
  }

  join(ctx, name, resumed = false) {
    let p = resumed && ctx.resumePid ? this.players.get(ctx.resumePid) : null;
    if (p && p.online && p.conn) {
      // the same session resumed on a new socket: the old one is replaced
      const old = p.conn;
      const octx = old.ctxRef;
      if (octx) { octx.player = null; octx.room = null; octx.state = 'lobby'; }
      p.conn = null;
      this.conns.delete(old);
      try { old.close(4001, '这个会话在别的窗口重新连接了'); } catch (e) { }
    }
    if (!p) {
      p = {
        pid: pidOf(), name: this.uniqueName(name), tokenHash: '', joinedAt: Date.now(), lastSeen: Date.now(),
        pstate: null, look: ctx.look || null, pos: this.world.spawn.slice(),
        yaw: 0, pitch: 0, health: 20, mode: this.gamemode, held: null, armor: [null, null, null, null],
        sneak: false, swing: false, swim: false, dead: false, flying: false, conn: null, online: false,
        disconnectedAt: 0, lastStateAt: 0, lastCorrect: 0, violations: 0, joinedStateAt: Date.now(),
        buckets: { state: new Bucket(25, 40), block: new Bucket(30, 60), chat: new Bucket(1, 3), be: new Bucket(5, 10), drop: new Bucket(4, 8) },
      };
      this.players.set(p.pid, p);
    }
    p.plainToken = tokenOf();
    p.tokenHash = hashToken(p.plainToken);
    p.online = true; p.conn = ctx.conn; p.disconnectedAt = 0; p.lastSeen = Date.now();
    if (!p.buckets) p.buckets = { state: new Bucket(25, 40), block: new Bucket(30, 60), chat: new Bucket(1, 3), be: new Bucket(5, 10), drop: new Bucket(4, 8) };
    ctx.player = p; ctx.room = this;
    this.conns.set(ctx.conn, p);
    // a room restored from disk may name an owner who is gone; an offline
    // owner who can still resume keeps the room until the resume window ends
    if (!this.ownerPid || !this.players.get(this.ownerPid)) this.ownerPid = p.pid;
    this.dirty = true;
    this.sendWelcome(ctx.conn, p, resumed);
    this.broadcastPlayers();
    if (!resumed) {
      this.system(p.name + ' 加入了游戏');
      this.log.info('room_joined', { room: this.code, pid: p.pid, name: p.name, players: this.onlineCount });
    } else {
      this.system(p.name + ' 重新连接了');
      this.log.info('room_resumed', { room: this.code, pid: p.pid, players: this.onlineCount });
    }
    return p;
  }

  kickPlayer(pid, byName) {
    const p = this.players.get(pid);
    if (!p || !p.online) return false;
    p.tokenHash = '';
    if (p.conn) {
      const conn = p.conn;
      conn.send({ t: 'kicked', reason: '房主请你离开了房间' });
      setTimeout(() => { try { conn.close(4003, 'kicked'); } catch (e) { } }, 150);
    }
    this.removeOnline(p, '被房主请出了房间', true);
    this.log.info('player_kicked', { room: this.code, pid, by: byName });
    return true;
  }

  removeOnline(p, reason, forget) {
    if (!p) return;
    this.conns.forEach((q, conn) => { if (q === p) this.conns.delete(conn); });
    p.conn = null; p.online = false; p.disconnectedAt = Date.now(); p.lastSeen = Date.now();
    this.dirty = true;
    this.broadcast({ t: 'leave', pid: p.pid, name: p.name, reason: cleanChat(reason || '离开了') });
    this.system(p.name + ' ' + (reason || '离开了'));
    if (forget) { p.tokenHash = ''; this.players.delete(p.pid); }
    if (this.ownerPid === p.pid) this.ensureOwner();
    this.broadcastPlayers();
  }

  // explicit leave: the player is gone for good (no resume token)
  leave(p, reason = '离开了房间') {
    if (!p) return;
    const conn = p.conn;
    p.tokenHash = '';
    this.removeOnline(p, reason, true);
    if (conn) { try { conn.send({ t: 'left' }); conn.close(1000, 'left'); } catch (e) { } }
  }

  disconnect(ctx) {
    const p = ctx.player;
    if (!p) return;
    this.removeOnline(p, '断线了', false);
    this.log.info('room_disconnected', { room: this.code, pid: p.pid });
  }

  // ---- messages ---------------------------------------------------------------
  handle(ctx, m) {
    const p = ctx.player;
    if (!p || !p.online) return;
    switch (m.t) {
      case 'state': {
        if (!p.buckets.state.take()) return this.rate(ctx, 'state');
        const st = validState(m);
        if (!st) return this.bad(ctx, 'state 格式不正确');
        const now = Date.now();
        if (p.lastStateAt && now - p.lastStateAt < 5000) {
          const dt = Math.max(0.02, Math.min(2, (now - p.lastStateAt) / 1000));
          const dh = Math.hypot(st.pos[0] - p.pos[0], st.pos[2] - p.pos[2]);
          const dv = Math.abs(st.pos[1] - p.pos[1]);
          const fly = st.mode === 'creative' && st.flying;
          const maxH = fly ? 30 : 24, maxV = 45;
          if (dh > maxH * dt + 3 || dv > maxV * dt + 4) {
            p.violations++;
            if (now - p.lastCorrect > 500) {
              p.lastCorrect = now;
              p.conn.send({ t: 'correct', pos: p.pos, reason: '移动过快' });
            }
            this.log.warn('move_rejected', { room: this.code, pid: p.pid, dh: +dh.toFixed(2), dv: +dv.toFixed(2), dt: +dt.toFixed(2) });
            return;
          }
        }
        p.pos = st.pos; p.yaw = st.yaw; p.pitch = st.pitch; p.armor = st.armor; p.mode = st.mode;
        p.health = st.health; p.held = st.held; p.sneak = st.sneak; p.swing = st.swing; p.dead = st.dead;
        p.flying = st.flying; p.swim = st.swim;
        if (st.look !== undefined) p.look = st.look;
        p.lastStateAt = now; p.lastSeen = now;
        return;
      }
      case 'pstate': {
        if (!p.buckets.state.take()) return this.rate(ctx, 'pstate');
        const d = validPstate(m.data);
        if (!d) return this.bad(ctx, 'pstate 过大或格式不正确');
        p.pstate = d; p.lastSeen = Date.now(); this.dirty = true;
        return;
      }
      case 'b': return this.applyBlocks(ctx, m.list);
      case 'be': {
        if (!p.buckets.be.take()) return this.rate(ctx, 'be');
        if (!validBlockEntityKey(m.k)) return this.bad(ctx, '方块实体坐标不正确');
        const d = validBlockEntityData(m.data);
        if (!d) return this.bad(ctx, '方块实体数据过大或格式不正确');
        if (!this.blockEntities.has(m.k) && this.blockEntities.size >= this.cfg.maxBlockEntitiesPerRoom) {
          return ctx.conn.send({ t: 'reject', reason: '房间的方块实体已满' });
        }
        this.blockEntities.set(m.k, d); this.dirty = true;
        this.broadcast({ t: 'be', k: m.k, data: d });
        return;
      }
      case 'chat': {
        if (!p.buckets.chat.take()) return this.rate(ctx, 'chat');
        const text = cleanChat(m.text);
        if (!text) return;
        this.broadcast({ t: 'chat', name: p.name, text }, ctx.conn);
        this.log.debug('chat', { room: this.code, pid: p.pid, len: text.length });
        return;
      }
      case 'drop': {
        if (!p.buckets.drop.take()) return this.rate(ctx, 'drop');
        const st = validStack(m.stack);
        const pos = validPos(m.pos);
        if (!st || !pos) return this.bad(ctx, '掉落物格式不正确');
        if (dist3(pos, p.pos) > 6) return ctx.conn.send({ t: 'reject', reason: '掉落物距离太远' });
        if (this.items.size >= this.cfg.maxItemsPerRoom) return ctx.conn.send({ t: 'reject', reason: '房间的掉落物太多了' });
        const item = { id: 'i' + (this.nextItem++), stack: st, pos, owner: p.pid, pickupAt: Date.now() + ITEM_PICKUP_DELAY, expiresAt: Date.now() + ITEM_TTL };
        this.items.set(item.id, item); this.dirty = true;
        this.broadcast({ t: 'itemAdd', item: [item.id, st, pos[0], pos[1], pos[2]] });
        return;
      }
      case 'pickup': {
        if (!p.buckets.drop.take()) return this.rate(ctx, 'pickup');
        const item = this.items.get(String(m.id || ''));
        if (!item) return;
        if (Date.now() < item.pickupAt) return;
        if (dist3(item.pos, p.pos) > 3.5) return;
        this.items.delete(item.id); this.dirty = true;
        p.conn.send({ t: 'give', stack: item.stack });
        this.broadcast({ t: 'itemRemove', id: item.id });
        return;
      }
      case 'respawn': {
        const pos = validPos(m.pos);
        if (!pos) return this.bad(ctx, '重生位置不正确');
        p.pos = pos; p.lastStateAt = 0; p.lastCorrect = 0; p.dead = false;
        this.dirty = true;
        return;
      }
      case 'leave': return this.leave(p, '离开了房间');
      case 'kick': {
        if (p.pid !== this.ownerPid) return this.deny(ctx, '只有房主可以踢人');
        const target = this.players.get(String(m.pid || ''));
        if (!target || !target.online) return ctx.conn.send({ t: 'error', reason: '这名玩家不在了' });
        if (target.pid === p.pid) return ctx.conn.send({ t: 'error', reason: '不能踢自己' });
        this.kickPlayer(target.pid, p.name);
        return;
      }
      case 'transfer': {
        if (p.pid !== this.ownerPid) return this.deny(ctx, '只有房主可以转让房间');
        const target = this.players.get(String(m.pid || ''));
        if (!target || !target.online) return ctx.conn.send({ t: 'error', reason: '这名玩家不在了' });
        this.ownerPid = target.pid; this.dirty = true;
        this.broadcastPlayers(); this.system(target.name + ' 成为了房主');
        return;
      }
      case 'close': {
        if (p.pid !== this.ownerPid) return this.deny(ctx, '只有房主可以关闭房间');
        this.mgr.closeRoom(this, '房主关闭了房间');
        return;
      }
      default: return this.bad(ctx, '未知的消息类型 ' + String(m.t).slice(0, 16));
    }
  }

  applyBlocks(ctx, list) {
    const p = ctx.player;
    if (!p.buckets.block.take()) return this.rate(ctx, 'block');
    if (!Array.isArray(list) || !list.length || list.length > LIMITS.maxBlockBatch) return this.bad(ctx, '方块消息数量不正确');
    const accepted = [], rejected = [];
    const invalid = [];
    const creative = p.mode === 'creative';
    const reach = (creative ? 10 : 7) + 3;
    const now = Date.now();
    const checkReach = now - p.joinedStateAt > 2000 && p.pos;
    for (const raw of list) {
      const e = validBlockEntry(raw);
      if (!e) { ctx.errors++; continue; }
      const [x, y, z, id] = e;
      if (this.mgr.blockIds && !this.mgr.blockIds.has(id)) { invalid.push([x, y, z]); ctx.errors++; continue; }
      if (checkReach) {
        const d = dist3([x + 0.5, y + 0.5, z + 0.5], p.pos);
        if (d > reach) { rejected.push([x, y, z]); this.log.debug('block_rejected', { room: this.code, pid: p.pid, d: +d.toFixed(2) }); continue; }
      }
      const ck = (x >> 4) + ',' + (z >> 4), pk = x + ',' + y + ',' + z;
      const existing = this.deltas.get(ck) && this.deltas.get(ck).get(pk);
      if (!existing && this.blockCount >= this.cfg.maxBlocksPerRoom) {
        ctx.conn.send({ t: 'reject', reason: '房间的方块改动已满，不能再修改' });
        break;
      }
      this._putDelta(e);
      accepted.push(e);
    }
    if (accepted.length) {
      this.dirty = true; this.rev++;
      this.broadcast({ t: 'b', list: accepted });
      // a block that carried a chest/sign/furnace no longer does
      for (const [x, y, z] of accepted) {
        const k = x + ',' + y + ',' + z;
        if (this.blockEntities.delete(k)) this.broadcast({ t: 'be', k, data: null });
      }
    }
    if (rejected.length) ctx.conn.send({ t: 'reject', list: rejected, reason: '方块距离太远' });
    if (invalid.length) ctx.conn.send({ t: 'reject', list: invalid, reason: '方块 ID 无效' });
    if (ctx.errors >= 8) ctx.conn.close(1008, 'too many bad messages');
  }

  // ---- tick / snapshots -------------------------------------------------------
  tick() {
    this.tickCount++;
    if (this.onlineCount) {
      this.world.time = (this.world.time + 1) % DAY;
      if (this.tickCount % this.snapEvery === 0) this.broadcast({ t: 'E', players: this.snapshotPlayers(), items: this.snapshotItems() });
      if (this.tickCount % 40 === 0) this.broadcast({ t: 'env', time: this.world.time, weather: this.world.weather, rain: this.world.rain, difficulty: this.world.difficulty });
    }
    if (this.tickCount % 20 === 0) this.expire(Date.now());
  }

  snapshotPlayers() {
    const out = [];
    for (const p of this.onlinePlayers) {
      out.push([p.pid, +p.pos[0].toFixed(2), +p.pos[1].toFixed(2), +p.pos[2].toFixed(2), +p.yaw.toFixed(3), +p.pitch.toFixed(3),
        p.held, p.armor, p.sneak ? 1 : 0, p.swing ? 1 : 0, p.swim ? 1 : 0, p.health, p.mode, p.look || null]);
    }
    return out;
  }

  snapshotItems() {
    return [...this.items.values()].map((it) => [it.id, it.stack, +it.pos[0].toFixed(2), +it.pos[1].toFixed(2), +it.pos[2].toFixed(2)]);
  }

  expire(now) {
    let changed = false, ownerGone = false;
    for (const [id, it] of [...this.items]) if (now > it.expiresAt) { this.items.delete(id); changed = true; this.broadcast({ t: 'itemRemove', id }); }
    for (const [pid, p] of [...this.players]) {
      if (p.online) continue;
      if (!p.tokenHash) { this.players.delete(pid); changed = true; if (pid === this.ownerPid) ownerGone = true; continue; }
      if (now - (p.disconnectedAt || 0) > this.cfg.resumeSeconds * 1000) {
        this.players.delete(pid);
        changed = true;
        if (pid === this.ownerPid) ownerGone = true;
        this.log.info('resume_expired', { room: this.code, pid });
      }
    }
    if (ownerGone) this.ensureOwner();
    if (changed) this.dirty = true;
  }

  // ---- error helpers ----------------------------------------------------------
  bad(ctx, reason) {
    ctx.errors = (ctx.errors || 0) + 1;
    ctx.conn.send({ t: 'error', reason });
    if (ctx.errors >= 8) ctx.conn.close(1008, 'too many bad messages');
  }
  deny(ctx, reason) { ctx.conn.send({ t: 'error', reason }); this.log.warn('permission_denied', { room: this.code, pid: ctx.player && ctx.player.pid, reason }); }
  rate(ctx, what) {
    ctx.rateHits = (ctx.rateHits || 0) + 1;
    if (ctx.rateHits % 20 === 1) this.log.warn('rate_limited', { room: this.code, pid: ctx.player && ctx.player.pid, what });
    if (ctx.rateHits % 50 === 0) ctx.conn.send({ t: 'error', reason: '操作太快了' });
  }
}

export class RoomManager {
  constructor({ cfg, log, store, blockIds = null }) {
    this.cfg = cfg;
    this.log = log;
    this.store = store;
    this.blockIds = blockIds;
    this.rooms = new Map(); // code -> Room (open only)
    this.usedCodes = new Set();
    this.ctx = new Map(); // conn -> context
    this.ipBuckets = new Map(); // ip -> {join, create, last}
    this.startedAt = Date.now();
    this.timer = null;
    this.stats = { connections: 0, joins: 0, created: 0, messages: 0, protocolErrors: 0, rejected: 0, saves: 0 };
    // phase-07 server performance: what the browser / the operator can read (admin status; public status drops
    // the CPU/memory figures). TPS is measured over a rolling 5 s window, not assumed from setInterval.
    this.perf = {
      lastTickAt: 0, lastTickMs: 0, tickAvgMs: 0, tickMaxMs: 0, lateTicks: 0, ticks: 0,
      windowStart: performance.now(), windowTicks: 0, tps: null,
    };
    this.cpu0 = process.cpuUsage();
    this.wall0 = Date.now();
  }

  load(records) {
    for (const { record, recovered } of records) {
      this.usedCodes.add(record.code);
      if (record.closed) { this.log.info('room_closed_on_disk', { code: record.code, dir: record.dir }); continue; }
      if (this.rooms.has(record.code)) continue;
      try {
        const room = new Room(this, record);
        this.rooms.set(room.code, room);
        this.log.info('room_loaded', { code: room.code, name: room.name, players: room.players.size, blocks: room.blockCount, recovered: recovered || undefined });
      } catch (e) {
        this.log.error('room_restore_failed', { code: record.code, error: e.message });
      }
    }
  }

  start() {
    if (this.timer) return;
    // Windows' Node timers are quantised to ~15.6 ms: a 50 ms setInterval only fires about every 62.5 ms, so the
    // old server actually ran at ~16 TPS (measured in the phase-07 load test). Wake up more often and run every
    // 50 ms slot that is due, with a small catch-up limit so one long stop cannot replay a burst of ticks.
    this._tickAt = performance.now();
    this.timer = setInterval(() => this.tickScheduler(), 10);
    this.log.info('rooms_started', { rooms: this.rooms.size, tickMs: TICK_MS, timerMs: 10 });
  }
  tickScheduler() {
    const now = performance.now();
    if (now - this._tickAt < TICK_MS - 0.5) return;
    let n = 0;
    while (now - this._tickAt >= TICK_MS - 0.5 && n < 3) {
      this._tickAt += TICK_MS;
      this.tick();
      n++;
    }
    if (n >= 3) this._tickAt = now; // a debugger pause, a huge save: continue from here, do not spiral
  }

  async stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    const rooms = [...this.rooms.values()];
    for (const room of rooms) {
      try { await this.saveRoom(room, { backup: true, forceBackup: true, reason: 'shutdown' }); } catch (e) { this.log.error('shutdown_save_failed', { code: room.code, error: e.message }); }
    }
    this.rooms.clear();
  }

  newCode() {
    const len = this.cfg.inviteCodeLength;
    for (let tries = 0; tries < 64; tries++) {
      let s = '';
      for (let i = 0; i < len; i++) s += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
      if (!this.usedCodes.has(s)) return s;
    }
    throw new Error('无法生成唯一邀请码');
  }

  ipBucket(ip) {
    let b = this.ipBuckets.get(ip);
    if (!b) { b = { join: new Bucket(this.cfg.joinPerMinute / 60, this.cfg.joinBurst), create: new Bucket(this.cfg.createPerMinute / 60, this.cfg.createBurst), last: Date.now() }; this.ipBuckets.set(ip, b); }
    b.last = Date.now();
    return b;
  }

  // ---- connection lifecycle ---------------------------------------------------
  onConnection(conn) {
    const ctx = {
      conn, ip: normIp(conn.ip), state: 'hello', name: '', look: null, errors: 0, rateHits: 0,
      player: null, room: null, createdAt: Date.now(), replaced: false,
      buckets: { msg: new Bucket(60, 120) },
    };
    conn.ctxRef = ctx;
    this.ctx.set(conn, ctx);
    this.stats.connections++;
    this.log.info('ws_open', { ip: ctx.ip, clients: this.ctx.size });
  }

  onClose(conn) {
    const ctx = this.ctx.get(conn);
    if (!ctx) return;
    this.ctx.delete(conn);
    if (ctx.room && ctx.player && ctx.player.conn === conn) {
      const room = ctx.room;
      room.disconnect(ctx);
      this.scheduleSave(room, 0);
    }
    this.log.info('ws_close', { ip: ctx.ip, clients: this.ctx.size, code: conn.closeCode || 0 });
  }

  onMessage(conn, text) {
    const ctx = this.ctx.get(conn);
    if (!ctx) return;
    this.stats.messages++;
    if (typeof text !== 'string' || Buffer.byteLength(text) > LIMITS.maxTextBytes) {
      this.stats.protocolErrors++; return conn.close(1009, 'message too large');
    }
    if (!ctx.buckets.msg.take()) {
      ctx.rateHits++;
      if (ctx.rateHits % 25 === 1) this.log.warn('rate_limited', { ip: ctx.ip, what: 'message' });
      if (ctx.rateHits > 100) conn.close(1008, 'too fast');
      return;
    }
    let m;
    try { m = JSON.parse(text); } catch (e) { return this.protocolError(ctx, '不是有效 JSON'); }
    if (!isObj(m) || typeof m.t !== 'string' || m.t.length > 24) return this.protocolError(ctx, '消息缺少类型');
    try { return this.dispatch(ctx, m); } catch (e) {
      this.log.error('message_failed', { ip: ctx.ip, t: m.t, error: e.message, stack: String(e.stack || '').split('\n').slice(0, 3).join(' | ') });
      return this.protocolError(ctx, '服务器处理消息失败');
    }
  }

  onBinary(conn) {
    const ctx = this.ctx.get(conn);
    if (!ctx) return;
    this.stats.protocolErrors++;
    ctx.conn.send({ t: 'error', reason: '自建服务器协议只接受 JSON 文本消息' });
    conn.close(1003, 'binary not supported');
  }

  protocolError(ctx, reason) {
    this.stats.protocolErrors++;
    ctx.errors++;
    ctx.conn.send({ t: 'error', reason });
    if (ctx.errors >= 8) ctx.conn.close(1008, 'too many bad messages');
  }

  dispatch(ctx, m) {
    if (ctx.state === 'hello') {
      if (m.t !== 'hello') return this.protocolError(ctx, '先发送 hello');
      return this.hello(ctx, m);
    }
    if (m.t === 'ping') return ctx.conn.send({ t: 'pong', t0: isNum(m.t0) ? m.t0 : 0 });
    if (ctx.state === 'lobby') {
      if (m.t === 'create') return this.create(ctx, m);
      if (m.t === 'join') return this.join(ctx, m);
      if (m.t === 'resume') return this.resume(ctx, m);
      return this.protocolError(ctx, '先加入或创建房间');
    }
    if (ctx.state === 'room' && ctx.room) {
      if (m.t === 'join' || m.t === 'create' || m.t === 'resume') return this.protocolError(ctx, '已经在房间里');
      return ctx.room.handle(ctx, m);
    }
    return this.protocolError(ctx, '连接状态不正确');
  }

  hello(ctx, m) {
    if (m.v !== PROTO) {
      ctx.conn.send({ t: 'hello', ok: false, reason: '协议版本不一致：请刷新页面' });
      return ctx.conn.close(1002, 'protocol version');
    }
    const name = cleanName(m.name);
    if (!name) { ctx.conn.send({ t: 'hello', ok: false, reason: '先输入昵称（1–16 个字符）' }); return; }
    ctx.name = name;
    ctx.look = validLook(m.look) || null;
    ctx.state = 'lobby';
    ctx.conn.send({
      t: 'hello', ok: true, v: PROTO,
      server: { name: this.cfg.serverName, version: 'phase-07' },
      limits: { maxPlayersPerRoom: this.cfg.maxPlayersPerRoom, maxRooms: this.cfg.maxRooms, inviteCodeLength: this.cfg.inviteCodeLength, snapshotHz: this.cfg.snapshotHz },
    });
  }

  create(ctx, m) {
    const b = this.ipBucket(ctx.ip);
    if (!b.create.take()) { this.stats.rejected++; return ctx.conn.send({ t: 'error', reason: '创建房间太频繁，请稍后再试' }); }
    if (this.rooms.size >= this.cfg.maxRooms) return ctx.conn.send({ t: 'error', reason: '服务器房间数量已达上限，请稍后再试' });
    const roomIn = isObj(m.room) ? m.room : {};
    const worldIn = isObj(m.world) ? m.world : {};
    const name = cleanRoomName(roomIn.name) || (ctx.name + ' 的房间');
    const maxPlayers = inInt(roomIn.maxPlayers, 2, this.cfg.maxPlayersPerRoom) ? roomIn.maxPlayers : Math.min(4, this.cfg.maxPlayersPerRoom);
    const gamemode = ['survival', 'creative', 'adventure', 'spectator'].includes(roomIn.gamemode) ? roomIn.gamemode : 'survival';
    const difficulty = inInt(roomIn.difficulty, 0, 3) ? roomIn.difficulty : 2;
    const seed = isInt(worldIn.seed) ? (worldIn.seed | 0) : randomInt(-2147483648, 2147483647);
    const spawn = validPos(worldIn.spawn) ? worldIn.spawn.map((n) => Math.floor(n)) : null;
    const worldName = cleanRoomName(worldIn.name) || (name + ' 的世界');
    let code;
    try { code = this.newCode(); } catch (e) { return ctx.conn.send({ t: 'error', reason: '服务器无法生成邀请码' }); }
    const record = {
      v: 1, code, dir: 'room-' + code, name, maxPlayers, gamemode, difficulty, createdAt: Date.now(), updatedAt: Date.now(),
      ownerPid: null, closed: false,
      world: { seed, gen: 2, name: worldName, spawn: spawn || [0, 100, 0], time: 6000, weather: 0, rain: 0, difficulty },
      blocks: [], blockEntities: [], players: [],
    };
    this.usedCodes.add(code);
    const room = new Room(this, record);
    this.rooms.set(code, room);
    this.stats.created++;
    ctx.state = 'room';
    room.join(ctx, ctx.name, false);
    room.ownerPid = ctx.player.pid;
    room.broadcastPlayers();
    room.system(ctx.player.name + ' 创建了房间');
    this.log.info('room_created', { room: code, name, maxPlayers, gamemode, seed, ip: ctx.ip });
    this.scheduleSave(room, 0);
  }

  join(ctx, m) {
    const b = this.ipBucket(ctx.ip);
    if (!b.join.take()) { this.stats.rejected++; return ctx.conn.send({ t: 'error', reason: '尝试加入太频繁，请稍后再试' }); }
    const code = String(m.code || '').toUpperCase();
    if (!validCode(code)) return ctx.conn.send({ t: 'error', reason: '邀请码格式不正确' });
    const room = this.rooms.get(code);
    if (!room || room.closed) return ctx.conn.send({ t: 'error', reason: '邀请码无效，或房间已关闭' });
    if (room.onlineCount >= room.maxPlayers) return ctx.conn.send({ t: 'error', reason: '房间已满' });
    ctx.state = 'room';
    this.stats.joins++;
    room.join(ctx, ctx.name, false);
    this.scheduleSave(room, 1000);
  }

  resume(ctx, m) {
    const b = this.ipBucket(ctx.ip);
    if (!b.join.take()) return ctx.conn.send({ t: 'error', reason: '尝试恢复太频繁，请稍后再试' });
    const code = String(m.code || '').toUpperCase();
    const pid = String(m.pid || ''), token = String(m.token || '');
    if (!validCode(code) || !validPid(pid) || !validToken(token)) return ctx.conn.send({ t: 'error', reason: '恢复信息无效' });
    const room = this.rooms.get(code);
    if (!room || room.closed) return ctx.conn.send({ t: 'error', reason: '房间已关闭，无法恢复' });
    const p = room.players.get(pid);
    if (!p || !p.tokenHash || !sameHash(hashToken(token), p.tokenHash)) return ctx.conn.send({ t: 'error', reason: '恢复信息已过期，请重新加入' });
    if (!p.online && p.disconnectedAt && Date.now() - p.disconnectedAt > this.cfg.resumeSeconds * 1000) return ctx.conn.send({ t: 'error', reason: '恢复信息已过期，请重新加入' });
    if (!p.online && room.onlineCount >= room.maxPlayers) return ctx.conn.send({ t: 'error', reason: '房间已满' });
    ctx.resumePid = pid;
    ctx.state = 'room';
    room.join(ctx, p.name, true);
    this.scheduleSave(room, 1000);
  }

  // ---- saving / closing -------------------------------------------------------
  scheduleSave(room, delay = 0) {
    if (!room || room._removed) return;
    if (delay <= 0) { this.saveRoom(room, { backup: true }).catch(() => { }); return; }
    setTimeout(() => { if (!room._removed) this.saveRoom(room, { backup: true }).catch(() => { }); }, delay).unref();
  }

  async saveRoom(room, { backup = true, forceBackup = false, reason = 'autosave' } = {}) {
    if (!room || room._removed) return;
    // Windows rename cannot replace a file another save is renaming at the
    // same time: serialise writes per room.
    const prev = room._saveChain || Promise.resolve();
    const run = prev.catch(() => { }).then(() => this._saveRoom(room, { backup, forceBackup, reason }));
    room._saveChain = run.catch(() => { });
    return run;
  }

  async _saveRoom(room, { backup = true, forceBackup = false, reason = 'autosave' }) {
    if (!room || room._removed) return;
    const rev = room.rev;
    try {
      const rec = room.toRecord();
      await this.store.save(rec, { backup, forceBackup, reason });
      this.stats.saves++;
      if (room.rev === rev) { room.dirty = false; room.lastSave = Date.now(); }
      room.updatedAt = Date.now();
    } catch (e) {
      this.log.error('save_failed', { room: room.code, error: e.message, reason });
    }
  }

  async saveAll(reason = 'manual') {
    const rooms = [...this.rooms.values()];
    for (const room of rooms) await this.saveRoom(room, { backup: true, reason });
    return rooms.length;
  }

  async closeRoom(room, reason = '房间已关闭') {
    if (!room || room._removed) return;
    room.closed = true;
    room.dirty = true;
    this.broadcastToRoom(room, { t: 'closed', reason });
    // no one may resume a closed room: drop the sessions before saving
    for (const p of room.players.values()) { p.tokenHash = ''; p.online = false; p.conn = null; }
    const conns = [...room.conns.keys()];
    room.conns.clear();
    for (const conn of conns) setTimeout(() => { try { conn.close(4002, 'room closed'); } catch (e) { } }, 120);
    try { await this.saveRoom(room, { backup: true, forceBackup: true, reason: 'closed' }); }
    catch (e) { this.log.error('close_save_failed', { room: room.code, error: e.message }); }
    room._removed = true;
    this.rooms.delete(room.code);
    this.log.info('room_closed', { room: room.code, reason, players: conns.length });
  }

  broadcastToRoom(room, obj) {
    let text = obj;
    if (typeof obj !== 'string') { try { text = JSON.stringify(obj); } catch (e) { return; } }
    for (const [conn] of room.conns) conn.sendText ? conn.sendText(text) : conn.send(text);
  }

  tick() {
    const now = Date.now(), t0 = performance.now(), pf = this.perf;
    if (pf.lastTickAt) {
      // a 50 ms slot served by a 15.6 ms Windows timer can legitimately be 62 ms apart; two missed slots (>100 ms)
      // is the useful "late" signal.
      if (now - pf.lastTickAt > TICK_MS * 2) pf.lateTicks++;
    }
    pf.lastTickAt = now;
    for (const room of this.rooms.values()) {
      try { room.tick(); } catch (e) { this.log.error('room_tick_failed', { room: room.code, error: e.message }); }
      if (now - room.lastSave >= this.cfg.autosaveSeconds * 1000 && (room.dirty || room.onlineCount)) {
        this.saveRoom(room, { backup: true, reason: 'autosave' }).catch(() => { });
      }
    }
    if (!this._lastIpClean || now - this._lastIpClean > 120000) {
      this._lastIpClean = now;
      for (const [ip, b] of this.ipBuckets) if (now - b.last > 600000) this.ipBuckets.delete(ip);
    }
    const dur = performance.now() - t0;
    pf.lastTickMs = dur;
    pf.tickAvgMs = pf.tickAvgMs ? pf.tickAvgMs * 0.9 + dur * 0.1 : dur;
    if (dur > pf.tickMaxMs) pf.tickMaxMs = dur;
    pf.ticks++;
    pf.windowTicks++;
    const span = performance.now() - pf.windowStart;
    if (span >= 5000) {
      pf.tps = +(pf.windowTicks * 1000 / span).toFixed(2);
      pf.windowTicks = 0; pf.windowStart = performance.now();
    }
  }

  // ---- status -----------------------------------------------------------------
  perfStatus() {
    const pf = this.perf, cpu = process.cpuUsage(this.cpu0), wallUs = Math.max(1, (Date.now() - this.wall0) * 1000);
    // rolling interval: the next status call reports the CPU used since this one (the load tests poll once a
    // second), instead of an all-time average diluted by idle time
    this.cpu0 = process.cpuUsage(); this.wall0 = Date.now();
    const mem = process.memoryUsage();
    return {
      tps: pf.tps, tickAvgMs: +pf.tickAvgMs.toFixed(2), tickMaxMs: +pf.tickMaxMs.toFixed(2),
      lastTickMs: +pf.lastTickMs.toFixed(2), lateTicks: pf.lateTicks, ticks: pf.ticks,
      cpuPct: +(((cpu.user + cpu.system) / wallUs) * 100).toFixed(1),
      rssMB: +(mem.rss / 1048576).toFixed(1), heapUsedMB: +(mem.heapUsed / 1048576).toFixed(1),
    };
  }
  status() {
    let players = 0;
    for (const r of this.rooms.values()) players += r.onlineCount;
    return {
      ok: true, name: this.cfg.serverName, version: 'phase-07', uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      rooms: this.rooms.size, players, maxRooms: this.cfg.maxRooms, maxPlayersPerRoom: this.cfg.maxPlayersPerRoom,
      connections: this.ctx.size, stats: { ...this.stats }, perf: this.perfStatus(),
    };
  }

  adminStatus() {
    return {
      ...this.status(),
      config: { host: this.cfg.host, port: this.cfg.port, dataDir: this.cfg.dataDir, staticRoot: this.cfg.staticRoot, maxConnections: this.cfg.maxConnections },
      roomsList: [...this.rooms.values()].map((r) => ({
        code: r.code, name: r.name, owner: r.ownerName(), maxPlayers: r.maxPlayers, online: r.onlineCount,
        blocks: r.blockCount, blockEntities: r.blockEntities.size, items: r.items.size, createdAt: r.createdAt, updatedAt: r.updatedAt,
        players: r.onlinePlayers.map((p) => ({ pid: p.pid, name: p.name, owner: p.pid === r.ownerPid, mode: p.mode })),
      })),
    };
  }
}
