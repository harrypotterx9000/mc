'use strict';
// ---------------------------------------------------------------------------
// Self-hosted server rooms (phase-05).
//
// The client renders and predicts locally; the server owns the room, the
// temporary player id, the authoritative block overlay, block entities, the
// player/item state it broadcasts, the world clock and the saved world.
// Terrain is generated locally from the server's seed, so only changes travel.
//
// This file is loaded after p2p.js: it adds a separate "srv~" world store and
// leaves NetClient (the old Java-proxy client) and LocalHost/LocalGuest alone.
// ---------------------------------------------------------------------------
const MPServer = (() => {
  const SERVER_KEY = 'mcjs-mp-server';
  const SESSION_KEY = 'mcjs-mp-session';
  const SESSION_TTL = 10 * 60 * 1000;

  function normBase(v) {
    let s = String(v || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
    try {
      const u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      return u.origin;
    } catch (e) { return ''; }
  }
  const pageBase = () => (location.protocol === 'http:' || location.protocol === 'https:') ? location.origin : '';
  function base() {
    const saved = normBase(Platform.storage.local.get(SERVER_KEY));
    if (saved) return saved;
    const cfg = normBase(typeof NET_CONFIG !== 'undefined' && NET_CONFIG.server);
    return cfg || pageBase();
  }
  function setBase(v) {
    const b = normBase(v);
    if (b) Platform.storage.local.set(SERVER_KEY, b); else Platform.storage.local.remove(SERVER_KEY);
    return b;
  }
  function ws() { const b = base(); return b ? b.replace(/^http/, 'ws') + '/ws' : ''; }

  let statusCache = null, statusAt = 0;
  async function status(force) {
    const b = base();
    if (!b) return { ok: false, error: '没有服务器地址', base: '' };
    if (!force && statusCache && Date.now() - statusAt < 2000) return statusCache;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2500);
    try {
      const r = await fetch(b + '/healthz', { signal: ctl.signal, cache: 'no-store' });
      const j = await r.json();
      statusCache = { ...j, ok: r.ok && j.ok !== false, base: b };
    } catch (e) {
      statusCache = { ok: false, error: e && e.name === 'AbortError' ? '连接超时' : '无法连接服务器', base: b };
    } finally { clearTimeout(timer); statusAt = Date.now(); }
    return statusCache;
  }

  function newSeed() {
    try { const a = new Int32Array(1); crypto.getRandomValues(a); return a[0] || 1; } catch (e) { return (Math.random() * 0x7fffffff) | 0; }
  }
  // a safe dry-land spawn for the seed, computed with the same generator the
  // world will use (the server stores it as the room's spawn)
  function suggestSpawn(seed) {
    try {
      const w = new World(seed32(seed));
      w.gen2 = true; w.minY = MIN_Y; w.seedStr = String(seed);
      for (let r = 0; r < 400; r += 8) {
        for (let a = 0; a < 16; a++) {
          const x = Math.round(Math.cos(a / 16 * Math.PI * 2) * r);
          const z = Math.round(Math.sin(a / 16 * Math.PI * 2) * r);
          const c = w.column(x, z), b = w.biomeOf(c);
          if (c.h > SEA + 1 && c.h < 100 && b !== BI.OCEAN && b !== BI.RIVER && b !== BI.BEACH) return [x, c.h + 1, z];
          if (r === 0) break;
        }
      }
    } catch (e) { }
    return [0, 80, 0];
  }

  function fromUrl() {
    try {
      const q = new URLSearchParams(location.search);
      const c = String(q.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
      const s = q.get('server');
      if (s) setBase(s);
      return c;
    } catch (e) { return ''; }
  }
  function inviteLink(code) {
    const b = base();
    if (!b) return '';
    return b + '/?room=' + encodeURIComponent(code) + '&server=1';
  }

  function saveSession(rec) {
    if (!rec || !rec.code || !rec.pid || !rec.token) return;
    try { Platform.storage.session.setJSON(SESSION_KEY, { ...rec, base: base(), at: Date.now() }); } catch (e) { }
  }
  function readSession() {
    try {
      const r = Platform.storage.session.getJSON(SESSION_KEY, null);
      if (!r || !r.code || !r.pid || !r.token || !r.at) return null;
      if (Date.now() - r.at > SESSION_TTL) { clearSession(); return null; }
      return r;
    } catch (e) { return null; }
  }
  function clearSession() { try { Platform.storage.session.remove(SESSION_KEY); } catch (e) { } }

  return { SERVER_KEY, base, setBase, ws, status, newSeed, suggestSpawn, fromUrl, inviteLink, saveSession, readSession, clearSession };
})();

// another player on our server: drawn like a player, moved by snapshots
class MPPlayer extends NetPlayer {
  constructor(game, x, y, z, name) {
    super(game, x, y, z, name);
    this.remote = true; this.alwaysTick = true; this.persistent = false; this.p2pMirror = true;
    this.tick = netEntityTick;
    this.netPos = [x, y, z]; this.lerpN = 0;
    this.netYaw = 0; this.netHead = 0; this.netPitch = 0;
  }
  eye() { return this.sneaking ? 1.27 : 1.62; }
  isSavedEntity() { return false; }
}

class MPClient {
  constructor(game) {
    this.g = game;
    this.name = GuestSession.name || (game.settings && game.settings.netName) || '玩家';
    this.state = 'idle';          // idle | connecting | joining | joined | reconnecting | left
    this.kind = '';               // create | join | resume
    this.opts = {};
    this.ws = null;
    this.hello = null;
    this.code = ''; this.room = null; this.you = null; this.token = '';
    this.worldId = ''; this.meta = null; this.world = null; this.worldData = null;
    this.worldLoaded = false; this.serverReady = false; this.finished = false;
    this.playersData = [];
    this.mirrors = new Map();     // pid -> MPPlayer
    this.itemMirrors = new Map(); // server item id -> ItemEntity
    this.itemData = new Map();    // server item id -> [id, stack, x, y, z]
    this.deltaChunks = new Map(); // chunk key -> Map(pos key -> delta)
    this.deltaCount = 0;
    this.beMap = new Map();
    this.beSnap = new Map();      // local block-entity JSON we have sent/received
    this.beQueue = new Map();     // changed block entities waiting for a be message
    this.lastBE = 0;
    this.outBlocks = new Map();   // block edits made by this player, awaiting a batch
    this.actionUntil = 0;         // set by the break/place/item-use wrappers below
    this.applying = false;
    this.lastState = 0; this.lastPstate = 0; this.lastPickup = new Map();
    this.time = 6000; this.weather = 0; this.rain = 0; this.spawn = [0, 80, 0];
    this.reconnectTries = 0;
    this.left = false; this.ending = false; this.metaLoaded = false;
    this.pendingChat = [];
  }

  // ---- connection ------------------------------------------------------------
  get inRoom() { return this.state === 'joined' && !!this.room; }

  connect(kind, opts = {}) {
    this.kind = kind;
    this.opts = opts;
    this.state = 'connecting';
    this.left = false; this.ending = false;
    this.g.mpClient = this;
    const text = kind === 'create' ? '正在创建房间…' : kind === 'resume' ? '正在恢复房间…' : '正在连接房间…';
    try { this.g.ui.open(new LoadingScreen(this.g, text)); } catch (e) { }
    this.openSocket();
  }

  openSocket() {
    const url = MPServer.ws();
    if (!url) return this.fail('没有服务器地址：请先运行 start-server.bat，或填写服务器地址');
    let ws;
    try { ws = new WebSocket(url); } catch (e) { return this.fail('无法连接服务器：' + e.message); }
    this.ws = ws;
    try {
      ws.onopen = () => {
        if (this.ws !== ws) return;
        const look = (() => { try { return Skins.mine(this.g); } catch (e) { return null; } })();
        this.send({ t: 'hello', v: 1, name: this.name, look });
      };
      ws.onmessage = (e) => {
        if (this.ws !== ws) return;
        let m; try { m = JSON.parse(e.data); } catch (err) { return; }
        try { this.onMessage(m); } catch (err) { console.warn('mp message', err); }
      };
      ws.onerror = () => {
        if (this.ws !== ws) return;
        if (this.state === 'connecting') this.fail('连不上游戏服务器：请确认已运行 node server\\index.mjs（或 start-server.bat）');
      };
      ws.onclose = () => this.onClose(ws);
    } catch (e) {
      return this.fail('无法连接服务器：' + e.message);
    }
  }

  send(o) {
    if (!this.ws || this.ws.readyState !== 1) return false;
    try { this.ws.send(JSON.stringify(o)); return true; } catch (e) { return false; }
  }

  afterHello() {
    if (this.kind === 'create') {
      this.send({ t: 'create', room: this.opts.room || {}, world: this.opts.world || {} });
    } else if (this.kind === 'resume') {
      const s = this.opts;
      this.send({ t: 'resume', code: s.code, pid: s.pid, token: s.token });
    } else {
      this.send({ t: 'join', code: String(this.opts.code || '') });
    }
  }

  onMessage(m) {
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'hello':
        if (!m.ok) return this.fail(m.reason || '服务器拒绝了连接');
        this.hello = m;
        return this.afterHello();
      case 'welcome': return this.onWelcome(m);
      case 'blocks':
        for (const e of Array.isArray(m.list) ? m.list : []) {
          this.addDelta(e);
          if (this.worldLoaded) this.applyServerBlocks([e]);
        }
        return;
      case 'blockEntities':
        for (const row of Array.isArray(m.list) ? m.list : []) if (Array.isArray(row) && row.length === 2) {
          this.beMap.set(row[0], row[1]);
          if (this.worldLoaded) this.applyServerBE(row[0], row[1]);
        }
        return;
      case 'items':
        this.itemData.clear();
        for (const row of Array.isArray(m.list) ? m.list : []) if (Array.isArray(row) && row.length >= 5) this.itemData.set(row[0], row);
        if (this.worldLoaded) this.syncItems();
        return;
      case 'ready':
        this.serverReady = true;
        if (!this.worldLoaded) return this.startWorld();
        return this.maybeFinish();
      case 'players':
        this.playersData = Array.isArray(m.list) ? m.list : [];
        if (this.room) this.room.players = this.playersData.length;
        if (this.worldLoaded) this.syncPlayerMirrors();
        return;
      case 'join':
        if (m.player && m.player.name) this.g.ui.message(`${m.player.name} 加入了游戏`, '#FFFF55');
        return;
      case 'leave':
        if (m.name) this.g.ui.message(`${m.name} ${m.reason || '离开了'}`, '#FFFF55');
        return;
      case 'E': return this.onSnapshot(m);
      case 'b': return this.applyServerBlocks(m.list);
      case 'be':
        if (typeof m.k === 'string') {
          if (m.data == null) this.beMap.delete(m.k); else this.beMap.set(m.k, m.data);
          if (this.worldLoaded) this.applyServerBE(m.k, m.data);
        }
        return;
      case 'env':
        this.time = +m.time || 0; this.weather = +m.weather || 0; this.rain = +m.rain || 0;
        this.applyEnv();
        return;
      case 'chat':
        if (m.sys) this.g.ui.message(String(m.text || '').slice(0, 256), '#FFFF55');
        else if (m.name !== (this.you && this.you.name)) this.g.ui.message(`<${String(m.name || '?').slice(0, 16)}> ${String(m.text || '').slice(0, 256)}`);
        return;
      case 'correct':
        if (Array.isArray(m.pos) && this.g.player) {
          const p = this.g.player;
          p.pos = m.pos.slice(0, 3); p.prev = p.pos.slice(); p.vel = [0, 0, 0];
          this.g.ui.message('位置已由服务器校正', '#FFAA00');
        }
        return;
      case 'reject':
        if (Array.isArray(m.list)) this.revertChunks(m.list);
        if (m.reason) this.g.ui.message(String(m.reason), '#FF8080');
        return;
      case 'kicked':
      case 'closed':
        return this.end(m.reason || (m.t === 'kicked' ? '房主请你离开了房间' : '房间已关闭'));
      case 'error':
        this.g.ui.message(String(m.reason || '服务器错误'), '#FF8080');
        if (this.state === 'connecting' || this.state === 'reconnecting') this.fail(m.reason || '服务器拒绝了请求');
        return;
      case 'give': {
        if (!m.stack || !this.g.player) return;
        const st = fixSavedStack({ ...m.stack });
        const left = this.g.player.inv.add(st);
        if (left && left.count) this.send({ t: 'drop', stack: left, pos: this.g.player.pos.slice(0, 3) });
        return;
      }
      case 'itemAdd':
        if (Array.isArray(m.item) && m.item.length >= 5) {
          this.itemData.set(m.item[0], m.item);
          if (this.worldLoaded) this.syncItems();
        }
        return;
      case 'itemRemove':
        this.itemData.delete(m.id);
        this.lastPickup.delete(m.id);
        if (this.worldLoaded) this.syncItems();
        return;
      case 'left': return;
      case 'pong': return;
      default: return;
    }
  }

  onWelcome(m) {
    if (this.ending || this.left) return;
    const resumed = !!m.resumed;
    const sameWorld = resumed && this.worldLoaded && this.worldId === 'srv~' + (m.room && m.room.code);
    this.room = m.room || null;
    this.code = this.room ? this.room.code : '';
    this.you = m.you || null;
    this.token = this.you && this.you.token ? this.you.token : '';
    this.worldData = m.world || null;
    this.playersData = Array.isArray(m.players) ? m.players : [];
    this.spawn = this.worldData && Array.isArray(this.worldData.spawn) ? this.worldData.spawn : [0, 80, 0];
    this.time = this.worldData ? +this.worldData.time || 0 : 6000;
    this.weather = this.worldData ? +this.worldData.weather || 0 : 0;
    this.rain = this.worldData ? +this.worldData.rain || 0 : 0;
    this.serverReady = false;
    this.beQueue.clear();
    if (!sameWorld) this.beSnap.clear();
    this.lastBE = 0;
    this.state = 'joining';
    if (this.token) MPServer.saveSession({ code: this.code, pid: this.you.pid, token: this.token });
    try { GuestSession.beginConnect(this.code); GuestSession.connected(this.you.pid); } catch (e) { }
    if (sameWorld) {
      this.beSnap.clear();
      if (this.g.blockEntities) this.g.blockEntities.clear();
    }
    if (resumed && sameWorld) {
      this.state = 'joined';
      this.reconnectTries = 0;
      this.g.ui.message('已重新连接到房间', '#55FF55');
      this.syncPlayerMirrors();
      this.applyEnv();
      return;
    }
    this.worldId = 'srv~' + this.code;
    // wait for `ready` (it follows the whole block/entity/item snapshot) so the
    // room's block entities are in the world before it is loaded
  }

  startWorld() {
    if (this.ending || this.left || this.worldLoaded || this.loadingWorld) return;
    this.loadingWorld = true;
    this.meta = this.buildMeta();
    this.loading = true;
    this.loadWorld().catch((e) => this.end('进入房间失败：' + e.message));
  }

  buildMeta() {
    const room = this.room || {}, w = this.worldData || {};
    const be = {};
    for (const [k, v] of this.beMap) be[k] = v;
    let player = null;
    const s = this.you && this.you.state;
    if (s && Array.isArray(s.pos) && Array.isArray(s.inv)) {
      player = {
        pos: s.pos.slice(0, 3), yaw: +s.yaw || 0, pitch: +s.pitch || 0,
        health: +s.health || 20, food: +s.food || 20, sat: +s.sat || 5, xp: +s.xp || 0,
        inv: s.inv, sel: s.sel | 0, flying: !!s.flying, effects: [], absorption: 0,
      };
    }
    return {
      id: this.worldId, name: (room.name || '服务器房间') + '（服务器）', seed: w.seed, gen: 2, mode: room.gamemode || 'survival',
      flat: false, difficulty: w.difficulty ?? 2, hardcore: false, cheats: room.gamemode === 'creative',
      time: w.time || 6000, weather: w.weather || 0, rainTarget: w.rain || 0, spawn: this.spawn,
      tutorial: -1, created: room.createdAt || Date.now(), lastPlayed: Date.now(),
      dims: { overworld: { blockEntities: be, mobs: [] } }, player,
    };
  }

  async loadWorld() {
    await this.g.loadWorld(this.worldId);
    if (this.ending || this.left) return;
    if (!this.g.worldMeta || this.g.worldMeta.id !== this.worldId) throw new Error('世界没有载入');
    this.worldLoaded = true;
    this.world = this.g.world;
    for (const ch of this.g.world.chunks.values()) this.applyChunkDeltas(ch);
    this.snapshotBE();
    this.syncPlayerMirrors();
    this.syncItems();
    this.applyEnv();
    this.maybeFinish();
  }

  maybeFinish() {
    if (this.ending || this.left) return;
    if (this.finished || !this.worldLoaded || !this.serverReady) return;
    if (this.g.state !== 'play') return;
    this.finished = true;
    this.loading = false;
    this.state = 'joined';
    try { this.g.ui.close(); } catch (e) { }
    this.g.ui.message(`已进入「${this.room.name}」（邀请码 ${this.code}）`, '#55FF55');
    this.sendState();
    this.sendPstate();
  }

  // ---- leaving / reconnecting ------------------------------------------------
  onClose(ws) {
    if (!this.ws) return;
    if (ws && ws !== this.ws) return; // a late close from a replaced socket must not clear the new one
    this.ws = null;
    if (this.left || this.ending) return;
    if (this.state === 'joined') { this.tryReconnect(); return; }
    if (this.state === 'connecting' || this.state === 'joining' || this.state === 'reconnecting') {
      if (this.state === 'reconnecting') this.tryReconnect(); else this.fail('与服务器的连接断开了');
    }
  }

  tryReconnect() {
    if (this.left || this.ending) return;
    if (this.reconnectTries >= 3) return this.end('与服务器的连接断开，自动重连失败');
    this.reconnectTries++;
    this.state = 'reconnecting';
    this.g.ui.message(`连接断开，正在重连（${this.reconnectTries}/3）…`, '#FFAA00');
    setTimeout(() => {
      if (this.left || this.ending) return;
      this.kind = 'resume';
      this.opts = { code: this.code, pid: this.you && this.you.pid, token: this.token };
      this.openSocket();
    }, 700 * this.reconnectTries);
  }

  fail(reason) {
    if (this.ending) return;
    this.ending = true;
    try { this.ws && this.ws.close(); } catch (e) { }
    this.cleanup();
    MPServer.clearSession();
    try { GuestSession.leaveRoom(); } catch (e) { }
    const g = this.g;
    if (g.state !== 'title') g.startTitle();
    setTimeout(() => {
      try { g.ui.open(new ConfirmScreen(g, '无法进入房间', reason || '连接失败', '返回标题画面', () => g.ui.open(new TitleScreen(g)))); } catch (e) { }
    }, 200);
  }

  end(reason) {
    if (this.ending) return;
    this.ending = true;
    this.left = true;
    try { this.ws && this.ws.close(); } catch (e) { }
    this.cleanup();
    MPServer.clearSession();
    try { GuestSession.leaveRoom(); } catch (e) { }
    const g = this.g;
    if (g.state !== 'title') g.startTitle();
    setTimeout(() => {
      try { g.ui.open(new ConfirmScreen(g, '离开了房间', reason || '连接已断开', '返回标题画面', () => g.ui.open(new TitleScreen(g)))); } catch (e) { }
    }, 250);
  }

  leave(reason) {
    if (this.left) return;
    this.left = true; this.ending = true;
    this.send({ t: 'leave' });
    try { this.ws && this.ws.close(); } catch (e) { }
    this.cleanup();
    MPServer.clearSession();
    try { GuestSession.leaveRoom(); } catch (e) { }
    const g = this.g;
    g.worldMeta = null;
    g.startTitle();
  }

  cleanup() {
    const g = this.g;
    for (const e of this.mirrors.values()) { e.dead = true; }
    for (const e of this.itemMirrors.values()) { e.dead = true; }
    this.mirrors.clear(); this.itemMirrors.clear();
    this.lastPickup.clear();
    this.outBlocks.clear();
    this.beQueue.clear();
    this.beSnap.clear();
    if (g.entities) g.entities = g.entities.filter((e) => !e.dead);
    this.world = null; this.worldLoaded = false;
    this.ws = null;
    if (g.mpClient === this) g.mpClient = null;
    this.state = 'left';
  }

  // ---- world delta overlay ---------------------------------------------------
  addDelta(e) {
    if (!Array.isArray(e) || e.length < 5) return;
    const [x, y, z] = e;
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) return;
    const ck = ckey(x >> 4, z >> 4), pk = x + ',' + y + ',' + z;
    let m = this.deltaChunks.get(ck);
    if (!m) { m = new Map(); this.deltaChunks.set(ck, m); }
    m.set(pk, e);
    if (this.worldLoaded && this.world) {
      const ch = this.world.chunks.get(ck);
      if (ch) this.applyDelta(e);
    }
  }

  applyDelta(e) {
    const w = this.world || this.g.world;
    if (!w) return;
    this.applying = true;
    try {
      const [x, y, z, id, meta, wl] = e;
      w.setBlock(x, y, z, id, meta, 1);
      if (wl !== undefined) w.setWaterlogged(x, y, z, !!wl);
    } finally { this.applying = false; }
  }

  applyServerBlocks(list) {
    if (!Array.isArray(list)) return;
    const w = this.world || this.g.world;
    for (const e of list) {
      if (!Array.isArray(e) || e.length < 5) continue;
      this.addDelta(e);
      if (this.worldLoaded && w && w.chunks.has(ckey(e[0] >> 4, e[2] >> 4))) this.applyDelta(e);
    }
  }

  applyChunkDeltas(ch) {
    if (!this.worldLoaded || !this.world || this.g.world !== this.world) return;
    const m = this.deltaChunks.get(ckey(ch.cx, ch.cz));
    if (!m || !m.size) return;
    for (const e of m.values()) this.applyDelta(e);
  }

  applyServerBE(k, data) {
    const g = this.g;
    if (!g.blockEntities) return;
    if (data == null) { g.blockEntities.delete(k); this.beSnap.delete(k); return; }
    const be = g.blockEntities.get(k);
    if (be && typeof be === 'object') { for (const key of Object.keys(be)) delete be[key]; Object.assign(be, data); }
    else g.blockEntities.set(k, data);
    this.beSnap.set(k, this.beJson(data));
  }

  // Block entities (chests, furnaces, signs...) are part of the shared world
  // state.  The server relays them but cannot see the client's objects, so the
  // client diffs the loaded map and sends only real changes, excluding the
  // purely local open/lid/viewer animation fields.
  beJson(be) {
    try {
      return JSON.stringify(be, (k, v) => (k === 'open' || k === 'lid' || k === 'viewers' ? undefined : v));
    } catch (e) { return ''; }
  }

  snapshotBE() {
    this.beSnap.clear();
    const m = this.g.blockEntities;
    if (!m || typeof m.forEach !== 'function') return;
    for (const [k, be] of m) this.beSnap.set(k, this.beJson(be));
  }

  syncBlockEntities(now) {
    if (now - this.lastBE < 500) return;
    this.lastBE = now;
    const m = this.g.blockEntities;
    if (!m) return;
    for (const k of [...this.beSnap.keys()]) if (!m.has(k)) this.beSnap.delete(k);
    for (const [k, be] of m) {
      const j = this.beJson(be);
      if (j && this.beSnap.get(k) !== j) this.beQueue.set(k, j);
    }
    if (!this.beQueue.size) return;
    let sent = 0;
    for (const [k, j] of this.beQueue) {
      if (sent >= 2) break; // server bucket is 5/s; 2 per 500 ms stays under it
      if (j.length > 3900) { this.beSnap.set(k, j); this.beQueue.delete(k); continue; }
      if (this.send({ t: 'be', k, data: JSON.parse(j) })) {
        this.beSnap.set(k, j); this.beQueue.delete(k); sent++;
      } else break;
    }
  }

  // a rejected local change: drop the chunk so deterministic terrain (plus the
  // server's recorded deltas) comes back next frame
  revertChunks(list) {
    const w = this.world || this.g.world;
    if (!w) return;
    const done = new Set();
    for (const p of list) {
      if (!Array.isArray(p) || p.length < 3) continue;
      const cx = p[0] >> 4, cz = p[2] >> 4, k = ckey(cx, cz);
      if (done.has(k)) continue;
      done.add(k);
      const ch = w.chunks.get(k);
      if (ch) { try { this.g.renderer.dropChunk(cx, cz); } catch (e) { } w.chunks.delete(k); }
    }
  }

  onLocalBlock(x, y, z) {
    const w = this.world;
    if (!w || this.g.world !== w) return;
    if (performance.now() > this.actionUntil) return; // generated/random-tick changes stay local
    const p = this.g.player;
    if (!p) return;
    const reach = this.g.mode === 'creative' ? 12 : 8;
    if (Math.hypot(x + 0.5 - p.pos[0], y + 0.5 - p.pos[1], z + 0.5 - p.pos[2]) > reach) return;
    const id = w.getBlock(x, y, z), meta = w.getMeta(x, y, z), wl = w.isWaterlogged(x, y, z) ? 1 : 0;
    const k = x + ',' + y + ',' + z;
    this.outBlocks.set(k, [x, y, z, id, meta, wl]);
    if (this.outBlocks.size > 64) this.outBlocks.delete(this.outBlocks.keys().next().value);
  }

  // ---- players and items -----------------------------------------------------
  syncPlayerMirrors() {
    if (!this.worldLoaded) return;
    const g = this.g;
    const online = new Map();
    for (const p of this.playersData) if (p && p.pid && p.pid !== this.you.pid) online.set(p.pid, p);
    for (const [pid, e] of this.mirrors) {
      if (!online.has(pid)) { e.dead = true; this.mirrors.delete(pid); }
    }
    for (const [pid, p] of online) {
      let e = this.mirrors.get(pid);
      if (!e) {
        const pos = this.you && this.you.state && Array.isArray(this.you.state.pos) ? this.you.state.pos : this.spawn;
        e = new MPPlayer(g, pos[0] + 0.5, pos[1], pos[2] + 0.5, p.name);
        e.pid = pid; e.mode = p.mode || 'survival';
        e.netPos = [e.pos[0], e.pos[1], e.pos[2]];
        g.entities.push(e);
        this.mirrors.set(pid, e);
      }
      e.name = String(p.name || '玩家').slice(0, 16);
      e.look = p.look || null;
      e.mode = p.mode || e.mode || 'survival';
      e.creative = e.mode === 'creative';
      e.spectator = e.mode === 'spectator';
    }
    // keep a stable order for the room screen
    this.playersData = this.playersData.slice();
  }

  onSnapshot(m) {
    if (!this.worldLoaded || !this.g.player) return;
    const seen = new Set();
    for (const r of Array.isArray(m.players) ? m.players : []) {
      if (!Array.isArray(r) || r.length < 14) continue;
      const [pid, x, y, z, yaw, pitch, held, armor, sneak, swing, swim, health, mode, look] = r;
      if (pid === this.you.pid) continue;
      let e = this.mirrors.get(pid);
      if (!e) {
        const p = this.playersData.find((q) => q.pid === pid);
        if (!p) continue;
        e = new MPPlayer(this.g, x, y, z, p.name);
        e.pid = pid;
        this.g.entities.push(e);
        this.mirrors.set(pid, e);
      }
      seen.add(pid);
      e.netPos = [x, y, z]; e.lerpN = 3;
      e.netYaw = yaw; e.netHead = yaw; e.netPitch = pitch;
      e.heldId = held == null ? null : held;
      e.armorItems = (Array.isArray(armor) ? armor : []).map((id) => (id == null ? null : { id, count: 1 }));
      e.sneaking = !!sneak;
      if (swing && !(e.swingT > 0)) e.swingT = 6;
      e.netSwim = !!swim;
      e.health = health;
      e.mode = mode;
      e.creative = mode === 'creative'; e.spectator = mode === 'spectator';
      e.look = look || null;
      if (this.room) {
        const p = this.playersData.find((q) => q.pid === pid);
        if (p && p.name) e.name = p.name;
      }
    }
    for (const [pid, e] of this.mirrors) if (!seen.has(pid)) { e.dead = true; this.mirrors.delete(pid); }
    // dropped items
    const items = Array.isArray(m.items) ? m.items : [];
    const itemSeen = new Set();
    for (const r of items) {
      if (!Array.isArray(r) || r.length < 5) continue;
      const [id, stack, x, y, z] = r;
      itemSeen.add(id);
      let e = this.itemMirrors.get(id);
      if (!e) {
        e = new ItemEntity(this.g, x, y, z, { ...stack }, [0, 0, 0]);
        e.tick = netItemTick; e.pickup = 1e9; e.p2pMirror = true; e.remote = true; e.mpItem = id;
        e.netPos = [x, y, z]; e.lerpN = 0;
        this.g.entities.push(e);
        this.itemMirrors.set(id, e);
      }
      e.stack = { ...stack };
      e.netPos = [x, y, z]; e.lerpN = 3;
    }
    for (const [id, e] of this.itemMirrors) if (!itemSeen.has(id)) { e.dead = true; this.itemMirrors.delete(id); }
  }

  syncItems() {
    if (!this.worldLoaded) return;
    for (const [id, e] of this.itemMirrors) { e.dead = true; this.itemMirrors.delete(id); }
    for (const row of this.itemData.values()) {
      if (!Array.isArray(row) || row.length < 5) continue;
      const [id, stack, x, y, z] = row;
      const e = new ItemEntity(this.g, x, y, z, { ...stack }, [0, 0, 0]);
      e.tick = netItemTick; e.pickup = 1e9; e.p2pMirror = true; e.remote = true; e.mpItem = id;
      e.netPos = [x, y, z]; e.lerpN = 0;
      this.g.entities.push(e);
      this.itemMirrors.set(id, e);
    }
  }

  pickupNearby() {
    const p = this.g.player;
    if (!p || p.deathTime > 0) return;
    const now = performance.now();
    for (const [id, e] of this.itemMirrors) {
      if (Math.hypot(e.pos[0] - p.pos[0], e.pos[1] + 0.2 - (p.pos[1] + 0.9), e.pos[2] - p.pos[2]) > 1.7) continue;
      const t = this.lastPickup.get(id) || 0;
      if (now - t < 600) continue;
      this.lastPickup.set(id, now);
      this.send({ t: 'pickup', id });
    }
  }

  // ---- per-tick ---------------------------------------------------------------
  tick() {
    if (this.state === 'joined' || this.state === 'joining' || this.state === 'reconnecting') this.maybeFinish();
    if (this.g.state !== 'play' || !this.worldLoaded) return;
    if (this.state !== 'joined') return;
    const now = performance.now();
    if (now - this.lastState >= 100) { this.lastState = now; this.sendState(); }
    if (now - this.lastPstate >= 10000) { this.lastPstate = now; this.sendPstate(); }
    if (this.outBlocks.size) {
      const list = [];
      for (const [k, v] of this.outBlocks) { list.push(v); this.outBlocks.delete(k); if (list.length >= 8) break; }
      this.send({ t: 'b', list });
    }
    this.applyEnv();
    this.pickupNearby();
    this.syncBlockEntities(now);
  }

  sendState() {
    const p = this.g.player;
    if (!p) return;
    this.send({
      t: 'state', pos: p.pos.map((v) => +v.toFixed(2)), yaw: +p.yaw.toFixed(3), pitch: +p.pitch.toFixed(3),
      sneak: !!p.sneaking, swing: p.swingT > 0, held: p.inv.held ? p.inv.held.id : null,
      armor: p.inv.slots.slice(36, 40).map((s) => (s ? s.id : null)),
      mode: this.g.mode, dead: p.deathTime > 0, flying: !!p.flying, swim: !!p.swimming, health: p.health,
      look: (() => { try { return Skins.mine(this.g); } catch (e) { return null; } })(),
    });
  }

  sendPstate() {
    const p = this.g.player;
    if (!p) return;
    this.send({
      t: 'pstate', data: {
        pos: [...p.pos], yaw: p.yaw, pitch: p.pitch, health: p.health, food: p.food, sat: p.saturation, xp: p.xp,
        inv: p.inv.slots, sel: p.inv.sel, mode: this.g.mode, look: (() => { try { return Skins.mine(this.g); } catch (e) { return null; } })(),
      },
    });
  }

  chat(text) { this.send({ t: 'chat', text: String(text).slice(0, 256) }); }

  applyEnv() {
    const g = this.g;
    if (!g.player) return;
    if (typeof g.worldTime === 'number' && Math.abs(g.worldTime - this.time) > 300) g.worldTime = this.time;
    g.weather = this.weather; g.rainTarget = this.rain;
  }
}

// ============================ resource hooks =================================
(() => {
  // a server room's world lives on the server: reading/writing the local
  // IndexedDB for "srv~..." ids would mix it with single-player saves
  const isSrv = (id) => typeof id === 'string' && id.startsWith('srv~');
  const gw = DB.getWorld.bind(DB), pw = DB.putWorld.bind(DB), pc = DB.putChunks.bind(DB), gc = DB.getChunk.bind(DB), ck = DB.chunkKeys.bind(DB);
  DB.getWorld = (id) => {
    const g = typeof game !== 'undefined' ? game : null;
    if (isSrv(id)) return Promise.resolve(g && g.mpClient && g.mpClient.worldId === id ? g.mpClient.meta : undefined);
    return gw(id);
  };
  DB.putWorld = (w) => (isSrv(w && w.id) ? Promise.resolve() : pw(w));
  DB.putChunks = (id, list) => (isSrv(id) ? Promise.resolve() : pc(id, list));
  DB.getChunk = (id, cx, cz) => (isSrv(id) ? Promise.resolve(undefined) : gc(id, cx, cz));
  DB.chunkKeys = (id) => (isSrv(id) ? Promise.resolve(new Set()) : ck(id));

  // a finished chunk gets the server's deltas for that chunk before it is lit
  const fc = Game.prototype.finishChunk;
  Game.prototype.finishChunk = function (ch, saved) {
    const r = fc.call(this, ch, saved);
    const c = this.mpClient;
    if (c && c.worldLoaded && this.world === c.world) c.applyChunkDeltas(ch);
    return r;
  };

  // local block changes go to the server unless they came from it
  const sb = World.prototype.setBlock, sm = World.prototype.setMeta, swl = World.prototype.setWaterlogged;
  const relay = (w, x, y, z) => {
    const g = typeof game !== 'undefined' ? game : null;
    const c = g && g.mpClient;
    if (!c || c.applying || g.world !== w || c.world !== w) return;
    c.onLocalBlock(x, y, z);
  };
  World.prototype.setBlock = function (x, y, z, ...a) { const r = sb.call(this, x, y, z, ...a); if (r !== false) relay(this, x, y, z); return r; };
  World.prototype.setMeta = function (x, y, z, meta) { const before = this.getMeta(x, y, z); const r = sm.call(this, x, y, z, meta); if (before !== meta) relay(this, x, y, z); return r; };
  World.prototype.setWaterlogged = function (x, y, z, v) { const r = swl.call(this, x, y, z, v); relay(this, x, y, z); return r; };

  // player block edits: only what happens around a break/place/item-use is
  // sent; the client's own random ticks, fluids and redstone stay local
  const markAction = (g) => { const c = g && g.mpClient; if (c) c.actionUntil = performance.now() + 200; };
  const bb = Game.prototype.breakBlock;
  Game.prototype.breakBlock = function (...a) { markAction(this); return bb.apply(this, a); };
  const pa = Game.prototype.placeAt;
  Game.prototype.placeAt = function (...a) { markAction(this); return pa.apply(this, a); };
  if (Game.prototype.useOnBlockItem) {
    const ub = Game.prototype.useOnBlockItem;
    Game.prototype.useOnBlockItem = function (...a) { markAction(this); return ub.apply(this, a); };
  }

  // dropped items land in the server world and are picked up from there
  const di = Game.prototype.dropItem;
  Game.prototype.dropItem = function (x, y, z, stack, vel) {
    const c = this.mpClient;
    if (c && c.state === 'joined' && stack && stack.count > 0) {
      const p = this.player;
      // server accepts <=6 from its last known position; leave a margin so a
      // moving/lagging player never has a drop rejected and silently lost
      if (p && Math.hypot(x - p.pos[0], y - p.pos[1], z - p.pos[2]) <= 4.5) {
        c.send({ t: 'drop', stack: { ...stack }, pos: [x, y, z] });
        return null;
      }
    }
    return di.call(this, x, y, z, stack, vel);
  };

  // chat / commands
  const rc = runCommand;
  runCommand = function (g, text) {
    const c = g.mpClient;
    if (c && (c.state === 'joined' || c.state === 'reconnecting')) {
      if (text.startsWith('/')) { g.ui.message('自建服务器房间里不能用命令', '#FF5555'); return; }
      const n = (c.you && c.you.name) || GuestSession.name || '玩家';
      g.ui.message(`<${n}> ${text}`);
      c.chat(text);
      return;
    }
    return rc(g, text);
  };

  // the room's world keeps running on the server; the client only advances its
  // own simulation and sends state while a screen is open too
  const tick = Game.prototype.tick;
  Game.prototype.tick = function () {
    const c = this.mpClient;
    if (c && c.state === 'joined') {
      const rt = this.rainTarget;
      tick.call(this);
      this.rainTarget = rt;
      c.tick();
      return;
    }
    tick.call(this);
    if (c) c.tick();
  };

  // saving a server world does nothing locally: the server stores it
  const sw = Game.prototype.saveWorld;
  Game.prototype.saveWorld = async function (quiet) {
    const c = this.mpClient;
    if (c) { c.sendPstate(); return; }
    return sw.call(this, quiet);
  };

  const q = Game.prototype.quitToTitle;
  Game.prototype.quitToTitle = async function () {
    const c = this.mpClient;
    if (c) { c.leave('离开了房间'); return; }
    return q.call(this);
  };

  const rs = Game.prototype.respawn;
  Game.prototype.respawn = function (...a) {
    const r = rs.apply(this, a);
    const c = this.mpClient;
    if (c && this.player) c.send({ t: 'respawn', pos: this.player.pos.map((v) => +v.toFixed(2)) });
    return r;
  };

  const cd = Game.prototype.changeDimension;
  Game.prototype.changeDimension = function (...a) {
    if (this.mpClient) { this.ui.pinMessage('自建服务器房间暂时不支持其他维度', 3000, '#FF8080'); return; }
    return cd.apply(this, a);
  };

  // an invite link with &server=1 opens the self-hosted screen once the title is up
  const st = Game.prototype.startTitle;
  Game.prototype.startTitle = function (...a) {
    const r = st.apply(this, a);
    if (!this.mpLinkUsed) {
      let server = false, room = '';
      try { const q2 = new URLSearchParams(location.search); server = q2.get('server') === '1'; room = String(q2.get('room') || ''); } catch (e) { }
      if (server && room) {
        this.mpLinkUsed = true;
        setTimeout(() => { if (this.state === 'title') this.ui.open(new MPServerScreen(this, null, GuestSession.name)); }, 650);
      }
    }
    return r;
  };
})();

// ============================== the screens ==================================
class MPServerScreen extends FormScreen {
  constructor(game, parent, name) {
    super(game, '自建服务器房间', parent);
    this.pauses = false;
    this.titleY = 8;
    this.name = name || GuestSession.name || '';
    this.code = MPServer.fromUrl() || '';
    this.server = MPServer.base();
    this.status = null;
    this.loading = false;
    this.busy = false;
    this.session = MPServer.readSession();
    this.check();
  }

  async check(force) {
    if (this.loading) return;
    this.loading = true;
    this.layout();
    this.status = await MPServer.status(force);
    this.loading = false;
    if (this.game.ui.screen === this) this.layout();
  }

  applyServer() {
    const b = MPServer.setBase(this.server);
    this.server = b || this.server;
    return !!b;
  }

  layout() {
    const u = this.game.ui, cx = u.w / 2;
    this.fields = {};
    this.addField('server', cx - 170, 42, 340, '服务器地址（同源可留空；局域网填对方 IP:端口）', 80, (v) => v.slice(0, 80));
    this.addField('code', cx - 170, 80, 150, '房间邀请码（6–12 位）', 12, (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12));
    this.widgets = [
      { x: cx - 10, y: 80, w: 80, h: 20, label: this.busy ? '连接中…' : '加入', enabled: !this.busy, onClick: () => this.join() },
      { x: cx + 76, y: 80, w: 94, h: 20, label: '创建房间', enabled: !this.busy, gold: true, onClick: () => this.create() },
      { x: cx - 170, y: 112, w: 120, h: 20, label: this.loading ? '正在检查…' : '检查服务器', onClick: () => this.check(true) },
      this.session ? { x: cx - 44, y: 112, w: 214, h: 20, label: '继续上次的房间', onClick: () => this.resume() } : null,
      { x: cx - 100, y: u.h - 30, w: 200, h: 20, label: '返回', onClick: () => this.back() },
    ].filter(Boolean);
    if (this.field) this.focus(this.field);
  }

  join() {
    if (!this.name) { this.say('先在多人游戏界面输入昵称', true); return; }
    if (!this.applyServer()) { this.say('服务器地址无效', true); return; }
    const code = String(this.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 6) { this.say('输入朋友给你的邀请码', true); this.focus('code'); return; }
    this.busy = true;
    this.layout();
    this.game.ui.hideInput();
    new MPClient(this.game).connect('join', { code });
  }

  create() {
    if (!this.name) { this.say('先在多人游戏界面输入昵称', true); return; }
    if (!this.applyServer()) { this.say('服务器地址无效', true); return; }
    this.game.ui.hideInput();
    this.game.ui.open(new MPCreateScreen(this.game, this, this.name));
  }

  resume() {
    const s = this.session;
    if (!s) { this.say('没有可恢复的房间', true); return; }
    MPServer.setBase(s.base || this.server);
    this.busy = true; this.layout(); this.game.ui.hideInput();
    new MPClient(this.game).connect('resume', { code: s.code, pid: s.pid, token: s.token });
  }

  drawExtra(ui) {
    const c = ui.ctx, cx = ui.w / 2;
    const nt = this.note; this.note = ''; this.drawFields(ui); this.note = nt;
    const s = this.status;
    let line, color;
    if (this.loading) { line = '正在检查服务器…'; color = '#A0A0A0'; }
    else if (!s || !s.ok) { line = '服务器未连接：' + ((s && s.error) || '未知错误'); color = '#FF8080'; }
    else { line = `已连接：${s.name} · ${s.version} · 房间 ${s.rooms}/${s.maxRooms} · 玩家 ${s.players}`; color = '#80FF80'; }
    Font.center(c, fitText(line, ui.w - 8), cx, 146, color);
    Font.center(c, `地址：${MPServer.base() || '（空）'}`, cx, 160, '#909090');
    if (!s || !s.ok) {
      Font.center(c, '在本机项目目录运行 start-server.bat；然后刷新本页', cx, 178, '#C0C0C0');
      Font.center(c, '服务器只在你电脑开机时运行；关机/休眠后不可用', cx, 192, '#909090');
    } else {
      Font.center(c, '邀请码由服务器生成；房主离开会自动转让房主', cx, 178, '#909090');
    }
    if (this.session) Font.center(c, `上次：${this.session.code}（${Math.max(0, Math.round((Date.now() - this.session.at) / 1000))} 秒前）`, cx, 208, '#A0A0A0');
    if (this.note) Font.center(c, fitText(this.note, ui.w - 8), cx, ui.h - 58, this.noteColor);
  }

  back() { this.game.ui.hideInput(); this.game.ui.open(this.parent || new TitleScreen(this.game)); }
  onEsc() { this.back(); }
}

class MPCreateScreen extends FormScreen {
  constructor(game, parent, name) {
    super(game, '创建自建房间', parent);
    this.pauses = false;
    this.titleY = 8;
    this.name = name || GuestSession.name || '玩家';
    this.roomName = this.name + ' 的房间';
    this.seed = '';
    this.maxPlayers = 4;
    this.gamemode = 'survival';
    this.difficulty = 2;
    this.busy = false;
    this.sizes = [2, 4, 6, 8, 10];
  }

  layout() {
    const u = this.game.ui, cx = u.w / 2;
    this.fields = {};
    this.addField('roomName', cx - 170, 48, 340, '房间名', 24, (v) => v.slice(0, 24));
    this.addField('seed', cx - 170, 86, 150, '种子（留空：随机）', 32, (v) => v.slice(0, 32));
    const GM = { survival: '生存', creative: '创造' };
    const DF = ['和平', '简单', '普通', '困难'];
    this.widgets = [
      { x: cx - 10, y: 86, w: 80, h: 20, label: () => `人数：${this.maxPlayers}`, onClick: () => { const i = this.sizes.indexOf(this.maxPlayers); this.maxPlayers = this.sizes[(i + 1) % this.sizes.length]; } },
      { x: cx + 76, y: 86, w: 94, h: 20, label: () => '模式：' + GM[this.gamemode], onClick: () => { this.gamemode = this.gamemode === 'survival' ? 'creative' : 'survival'; } },
      { x: cx - 170, y: 124, w: 150, h: 20, label: () => '难度：' + DF[this.difficulty], onClick: () => { this.difficulty = (this.difficulty + 1) % 4; } },
      { x: cx - 100, y: 162, w: 200, h: 20, label: this.busy ? '正在创建…' : '创建并进入', gold: true, enabled: !this.busy, onClick: () => this.submit() },
      { x: cx - 100, y: u.h - 30, w: 200, h: 20, label: '返回', onClick: () => this.back() },
    ];
    if (this.field) this.focus(this.field);
  }

  submit() {
    if (this.busy) return;
    const seedText = String(this.seed || '').trim();
    const seed = seedText ? (seed32(parseSeed(seedText)) | 0) : MPServer.newSeed();
    const spawn = MPServer.suggestSpawn(seed);
    const roomName = String(this.roomName || '').trim().slice(0, 24) || (this.name + ' 的房间');
    this.busy = true; this.layout();
    this.game.ui.hideInput();
    new MPClient(this.game).connect('create', {
      room: { name: roomName, maxPlayers: this.maxPlayers, gamemode: this.gamemode, difficulty: this.difficulty },
      world: { seed, spawn, name: roomName + ' 的世界' },
    });
  }

  drawExtra(ui) {
    const c = ui.ctx, cx = ui.w / 2;
    const nt = this.note; this.note = ''; this.drawFields(ui); this.note = nt;
    Font.center(c, '世界由服务器保存；地形由相同种子在每台电脑上生成', cx, 198, '#909090');
    Font.center(c, '人数上限以服务器配置为准；邀请码创建后生成', cx, 212, '#909090');
    if (this.note) Font.center(c, fitText(this.note, ui.w - 8), cx, ui.h - 58, this.noteColor);
  }

  back() { this.game.ui.hideInput(); this.game.ui.open(this.parent || new TitleScreen(this.game)); }
  onEsc() { this.back(); }
}

class MPRoomScreen extends MenuScreen {
  constructor(game, parent) {
    super(game, '房间');
    this.parent = parent;
    this.pauses = true;
    this.titleY = 10;
    this.note = '';
    this.confirmKick = null;
    this.confirmClose = false;
  }

  get C() { return this.game.mpClient; }

  rows() { return Math.max(2, Math.floor((this.game.ui.h - 150) / 22)); }

  layout() {
    const u = this.game.ui, cx = u.w / 2, C = this.C;
    this.widgets = [];
    if (!C || !C.room) {
      this.widgets.push({ x: cx - 100, y: u.h - 30, w: 200, h: 20, label: '返回', onClick: () => this.game.ui.open(this.parent) });
      return;
    }
    this.widgets.push(
      { x: cx - 170, y: u.h - 58, w: 150, h: 20, label: '复制邀请链接', onClick: () => this.copy() },
      { x: cx + 20, y: u.h - 58, w: 150, h: 20, label: '返回游戏', onClick: () => this.game.ui.open(this.parent) },
      { x: cx - 170, y: u.h - 32, w: 150, h: 20, label: '离开房间', onClick: () => this.game.quitToTitle() },
    );
    if (C.you && C.you.owner) {
      this.widgets.push({ x: cx + 20, y: u.h - 32, w: 150, h: 20, label: this.confirmClose ? '确定关闭房间？' : '关闭房间', gold: this.confirmClose, onClick: () => this.closeRoom() });
    }
    const me = C.you ? C.you.pid : '';
    const list = C.playersData.filter((p) => p.pid !== me);
    list.slice(0, this.rows()).forEach((p, i) => {
      const y = 92 + i * 22;
      if (C.you && C.you.owner) this.widgets.push({ x: cx + 96, y: y - 3, w: 56, h: 18, label: this.confirmKick === p.pid ? '确定？' : '移出', onClick: () => this.kick(p) });
    });
  }

  kick(p) {
    const C = this.C;
    if (!C || !C.you || !C.you.owner) return;
    if (this.confirmKick !== p.pid) { this.confirmKick = p.pid; this.layout(); return; }
    this.confirmKick = null;
    C.send({ t: 'kick', pid: p.pid });
    this.note = '已请求移出 ' + p.name;
    this.layout();
  }

  closeRoom() {
    const C = this.C;
    if (!C || !C.you || !C.you.owner) return;
    if (!this.confirmClose) { this.confirmClose = true; this.note = '再点一次会关闭房间，所有人都会离开'; this.layout(); return; }
    this.confirmClose = false;
    C.send({ t: 'close' });
  }

  copy() {
    const C = this.C;
    if (!C) return;
    const link = MPServer.inviteLink(C.code);
    const done = () => { this.note = '邀请码：' + C.code; this.layout(); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link || C.code).then(done, done);
      else done();
    } catch (e) { done(); }
  }

  drawExtra(ui) {
    const c = ui.ctx, cx = ui.w / 2, C = this.C;
    if (!C || !C.room) { Font.center(c, '房间已断开', cx, 60, '#FF8080'); return; }
    const room = C.room;
    const me = C.you || {};
    const owner = C.playersData.find((p) => p.owner) || {};
    Font.draw(c, `房间：${room.name}`, cx - 170, 36, '#FFFFFF');
    Font.draw(c, `邀请码：${C.code}`, cx - 170, 50, '#FFFF55');
    Font.draw(c, `房主：${me.owner ? '你' : (owner.name || '—')}`, cx - 170, 64, '#A0A0A0');
    Font.draw(c, `人数：${C.playersData.length}/${room.maxPlayers}`, cx + 30, 64, '#A0A0A0');
    Font.draw(c, `模式：${room.gamemode === 'creative' ? '创造' : '生存'}`, cx + 130, 64, '#A0A0A0');
    Font.draw(c, '玩家', cx - 170, 82, '#FFFFFF');
    const list = C.playersData.slice(0, this.rows());
    list.forEach((p, i) => {
      const y = 94 + i * 22;
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(cx - 170, y, 340, 20);
      const tag = p.pid === me.pid ? '（你）' : p.owner ? '（房主）' : '';
      Font.draw(c, fitText(`${p.name}${tag}`, 200), cx - 166, y + 5, p.owner ? '#FFFF55' : '#FFFFFF');
      Font.draw(c, p.mode === 'creative' ? '创造' : p.mode === 'spectator' ? '旁观' : '生存', cx - 20, y + 5, '#A0A0A0');
    });
    if (this.note) Font.center(c, fitText(this.note, ui.w - 8), cx, ui.h - 76, '#FFFF55');
  }

  onEsc() { this.game.ui.open(this.parent); }
}
