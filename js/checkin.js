'use strict';
// 签到：开服签到活动的界面和入口（game/COMMUNITY_PLAN.md）
// ---------------------------------------------------------------------------
// The sign-in event (community.js on the room service): 7 days, cumulative, one a Beijing day, each giving the next
// decoration of event.rewards (read from the service - the rewards may change there, so nothing here hardcodes
// their order). The service's clock decides: the device's is only corrected by it for the countdowns.
// Ways in: the title screen (under the news sign, a red dot while today can be signed), the pause menu, and the
// news panel (news.js opens CheckinScreen). All of them go away after the event ends; CheckinScreen still works.
// ---------------------------------------------------------------------------
const Checkin = (() => {
  const BJ = 8 * 3600e3, DAY = 86400e3;
  const dayKey = (t) => new Date(t + BJ).toISOString().slice(0, 10); // (the service's: a day in Beijing time)
  const bj = (t) => new Date(t + BJ); // read with getUTC*: Beijing time whatever the device's zone is
  const p2 = (n) => String(n).padStart(2, '0');
  const tc = (k) => { if (typeof Telemetry !== 'undefined' && Telemetry.count) Telemetry.count(k); };
  // (the names when cosmetics.js has none: what the service gives today)
  const NAMES = { 'hat:straw': '草帽', 'cape:penguin': '企鹅披风', 'hat:tophat': '礼帽', 'pet:snowman': '小雪人', 'cape:penguinwalk': '企鹅动态披风', 'hat:crown': '皇冠', 'pre:potato': '土豆名字前缀' };
  const KINDS = { hat: '帽子', cape: '披风', pet: '宠物', pre: '名字前缀' };
  const C = {
    st: null, skew: 0, err: '', busy: null, busyWho: null, busyLoud: false, game: null, tried: -1e9, triedWho: null, wait: 60000,
    seq: 0, claimAt: 0, claiming: 0, // (reads are numbered: one sent before a claim answered is older than the claim's)
    dayKey,
    now() { return Date.now() + this.skew; },
    who() { return Account.loggedIn && Account.data ? String(Account.data.id || Account.data.name || '?') : ''; },
    // the status read for the player as they are now (another account's, or a guest's after logging in, is not)
    cur() { return this.st && this.st.who === this.who() ? this.st : null; },
    phase(st = this.st) { if (!st) return ''; const t = this.now(); return t < st.event.start ? 'before' : t >= st.event.end ? 'ended' : 'open'; },
    count(st = this.st) { return (st && st.event.rewards && st.event.rewards.length) || 7; },
    // signed today: as read, until Beijing midnight passes (then the next day may be signed without a reload)
    today(st = this.st) { return !!(st && st.today && dayKey(this.now()) === st.dayAt); },
    canSign(st = this.cur()) { return !!(st && st.logged && this.phase(st) === 'open' && st.days < this.count(st) && !this.today(st)); },
    // the red dot: today can be signed (logged out: while the event is open - signing needs the login)
    dot() { const st = this.cur(); if (!st || this.phase(st) !== 'open') return false; return st.logged ? this.canSign(st) : true; },
    // the ways in: only while the event is on - not before it starts, for the super administrators neither (the user,
    // 2026-11-02: 周五再开放); they appear by themselves at the start (the server's time), no update needed
    shown() { const t = this.now(); return !!this.st && t >= this.st.event.start && t < this.st.event.end; },
    name(id) {
      if (typeof Cosmetics !== 'undefined' && Cosmetics.name) { try { const n = Cosmetics.name(id); if (n) return n; } catch (e) { } }
      return NAMES[id] || '装饰';
    },
    kind(id) { return String(id || '').split(':')[0]; },
    kindName(id) { return KINDS[this.kind(id)] || '装饰'; },
    // '11月6日', '18:30' in Beijing time
    day(t) { const d = bj(t); return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`; },
    time(t) { const d = bj(t); return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`; },
    // '11月6日 18:30 – 12月15日': the end is the midnight after the last day
    dates(e) {
      const end = this.time(e.end) === '00:00' ? this.day(e.end - 1) : this.day(e.end) + ' ' + this.time(e.end);
      return `${this.day(e.start)} ${this.time(e.start)} – ${end}`;
    },
    span(ms) {
      const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
      return (d ? d + ' 天 ' : '') + `${p2(h)}:${p2(m)}:${p2(s % 60)}`;
    },
    untilMidnight() { return DAY - ((this.now() + BJ) % DAY); },
    // the status from the service. Forced (the check-in screen): by Account.api. Not forced (the title screen and the
    // pause menu ask each time they lay out): quietly, at most once a minute, every 10 minutes after the network failed,
    // never offline - Account.api sends each failed request to the statistics as net_fail, and an offline player or a
    // phone that can't reach the service (the IDC's SNI whitelist) would bury the login failures read from there
    load(g, force) {
      if (g) this.game = g;
      const who = this.who();
      // (one in flight is shared - unless it reads another player (logged in meanwhile), or it is quiet and this is
      // forced: then this one goes after it)
      if (this.busy) return this.busyWho === who && (!force || this.busyLoud) ? this.busy : this.busy.then(() => this.load(g, force));
      // (a failed read waits its minute too: every answer lays the title out again, which asks again)
      if (!force && ((this.triedWho === who && performance.now() - this.tried < this.wait) || navigator.onLine === false)) return Promise.resolve(this.cur());
      this.tried = performance.now(); this.triedWho = who; this.wait = 60000;
      if (typeof RoomService === 'undefined' || !RoomService.base()) { this.err = '还没有配置游戏服务器地址'; return Promise.resolve(null); }
      this.busyWho = who; this.busyLoud = !!force;
      this.busy = (force ? this.fetch() : this.quiet()).catch((e) => { this.err = e.message || String(e); }).then(() => { this.busy = null; this.notify(); return this.st; });
      return this.busy;
    },
    async fetch() {
      const t0 = Date.now(), s = ++this.seq;
      let r = null, who = this.who();
      if (who) {
        try { r = await Account.api('/api/account/checkin', {}); }
        catch (e) { if (Account.loggedIn) throw e; } // (401: the token was dropped - read as a guest)
      }
      if (!r) { who = ''; r = await Account.api('/api/event'); }
      this.took(r, t0, Date.now(), who, s);
    },
    // the same by one plain fetch, nothing reported; a 401 goes the loud way (the network is up then, and Account.api is
    // what drops a dead token)
    async quiet() {
      const t0 = Date.now(), s = ++this.seq, base = RoomService.base(), who = this.who();
      const get = async (path, body) => {
        let f;
        try { f = await fetch(base + path, body ? { method: 'POST', body: JSON.stringify(body) } : undefined); }
        catch (e) { this.wait = 600000; throw new Error('连不上游戏服务器'); }
        if (f.status === 401) return null;
        let j; try { j = await f.json(); } catch (e) { j = { error: '服务器没有回应（HTTP ' + f.status + '）' }; }
        if (!f.ok || j.error) throw new Error(j.error || 'HTTP ' + f.status);
        return j;
      };
      if (who) { const r = await get('/api/account/checkin', { _t: Account.token }); return r ? this.took(r, t0, Date.now(), who, s) : this.fetch(); }
      this.took(await get('/api/event'), t0, Date.now(), '', s);
    },
    // a status answer (also the claim's); the service's now corrects the device clock
    took(r, t0, t1, who = this.who(), s) {
      // (a read sent before the last claim answered, or answered while one is out, may be from before it: dropped - else
      // the card and the red dot went back to "not signed today")
      if (s !== undefined && (this.claiming > 0 || s < this.claimAt)) return;
      if (!r || !r.event) { this.err = '现在没有签到活动'; return; }
      const now = r.now || t1;
      if (r.now) this.skew = r.now - (t0 + t1) / 2;
      this.st = { event: { ...r.event, rewards: r.event.rewards || [] }, now, days: r.days | 0, today: !!r.today, dayAt: dayKey(now), who, logged: !!who };
      this.err = '';
      try { localStorage.setItem('mcjs-checkin', JSON.stringify({ st: this.st, skew: this.skew })); } catch (e) { }
    },
    // the screens that show it lay out again (an entry appears, a dot, the card)
    notify() {
      const g = this.game, s = g && g.ui && g.ui.screen;
      if (!s || !s.layout) return;
      if ((typeof TitleScreen !== 'undefined' && s instanceof TitleScreen) || (typeof PauseScreen !== 'undefined' && s instanceof PauseScreen) || s instanceof CheckinScreen) s.layout();
    },
    // where the title screen's button goes: under the news sign (news.js), else where the sign would be
    titleRect(u) {
      if (typeof NewsBoard !== 'undefined' && NewsBoard.signRect) {
        try { const s = NewsBoard.signRect(u); if (s) return { x: s.x, y: s.y + s.h + 4, w: s.w, h: 16 }; } catch (e) { }
      }
      // (narrow: the logo reaches the right edge - under it, right of the menu buttons)
      if (u.w / 2 + 128 > u.w - 62) return { x: u.w - 60, y: 84, w: 54, h: 16 };
      return { x: u.w - 60, y: 66, w: 54, h: 16 };
    },
    drawDot(c, x, y) {
      const k = 0.75 + 0.25 * Math.sin(performance.now() / 260);
      c.fillStyle = '#3A0000'; c.fillRect(x - 1, y - 1, 7, 7);
      c.fillStyle = `rgba(255,${Math.round(40 + 30 * k)},${Math.round(40 + 30 * k)},1)`; c.fillRect(x, y, 5, 5);
      c.fillStyle = '#FFB0B0'; c.fillRect(x + 1, y + 1, 1, 1);
    },
    // a decoration's icon (cosmetics.js); without it: the cape's outside, the potato item, or a question mark
    drawReward(ui, id, x, y, size, locked) {
      const c = ui.ctx;
      if (typeof Cosmetics !== 'undefined' && Cosmetics.drawIcon) { try { Cosmetics.drawIcon(c, id, x, y, size, locked); return; } catch (e) { } }
      const k = this.kind(id), v = String(id || '').split(':')[1];
      if (k === 'cape' && typeof Capes !== 'undefined' && Capes.get && Capes.get(v)) {
        const s = Math.max(1, Math.floor(size / 16)); Capes.drawFlat(c, v, Math.round(x + (size - 10 * s) / 2), Math.round(y + (size - 16 * s) / 2), s, locked); return;
      }
      if (k === 'pre' && v === 'potato' && typeof ITEM_KEY !== 'undefined' && ITEM_KEY.potato !== undefined) {
        c.save(); c.translate(x, y); c.scale(size / 16, size / 16); ui.drawItem({ id: ITEM_KEY.potato, count: 1 }, 0, 0); c.restore();
      } else {
        c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x + 2, y + 2, size - 4, size - 4);
        Font.center(c, '?', x + size / 2, y + size / 2 - 4, '#FFFFFF');
      }
      if (locked) { c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x, y, size, size); }
    },
    tc,
  };
  // the last status, so the ways in show before the service answers (read again as soon as the title opens)
  try { const s = JSON.parse(localStorage.getItem('mcjs-checkin') || 'null'); if (s && s.st && s.st.event) { C.st = s.st; C.skew = +s.skew || 0; } } catch (e) { }
  return C;
})();

// ---- 开服签到「冬日足迹」(the user, 2026-11-03: rewritten with more design) ----
// A winter night in one panel: stars, a moon and a slow aurora over far mountains, snow falling, and a snowy slope
// rising to the right with the 7 days' gift boxes along it (the 7th, the biggest, gold, on the top with a flag).
// Footprints join them - walked ones darker. A penguin in a red scarf stands where the player has got to: signing,
// it hops to today's box, the box shakes and bursts open in snow and sparks, and the reward flies down to the bar
// at the bottom, which tells about the box tapped or hovered (else the next one) and holds the buttons.
// Box states: 'got' opened, its reward over it with a tick; 'today' glowing with a bouncing arrow; 'later' wrapped,
// its reward faint above it.
const CHK_PENGUIN = ['..kkkk..', '.kkkkkk.', '.kWkkWk.', '.kkookk.', 'kkrrrrkk', 'kkWWWWrk', '.kWWWWk.', '.kWWWWk.', '..kkkk..'];
const CHK_PAL = { k: '#1E1E26', W: '#F7F7F2', o: '#F29A2E', r: '#E8262B' };
// each day's paper and ribbon (the 7th: gold)
const CHK_BOX = [['#E8473F', '#FFE27A'], ['#4AA3E8', '#FFFFFF'], ['#5DBB63', '#E8262B'], ['#B06AE0', '#FFE27A'], ['#F28C38', '#FFFFFF'], ['#E85D9A', '#FFFFFF'], ['#F2C230', '#C8261E']];
const chkRnd = (i, s) => { const h = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return h - Math.floor(h); };
class CheckinScreen extends MenuScreen {
  // again: the same visit coming back (logged in from here) - not counted as another opening
  constructor(game, parent, again) {
    super(game, null); this.parent = parent; this.pauses = game.state === 'play' && !game.net; this.bgDim = 0.6;
    this.note = ''; this.noteBad = false; this.sel = null; this.got = null; this.busy = false; this.key = '';
    this.t0 = performance.now();
    if (!again) Checkin.tc('checkin_open');
    this.asked = performance.now();
    Checkin.load(game, true);
  }
  say(t, bad) { this.note = t; this.noteBad = !!bad; this.noteT = performance.now(); }
  back() { this.game.ui.open(this.parent || new TitleScreen(this.game)); }
  onEsc() { this.back(); }
  // what the bar shows
  state() {
    const st = Checkin.cur();
    if (!st) {
      // (nothing for this player and nothing on the way - an answer dropped, the account changed: ask again, not stuck
      // on 正在读取 for good)
      if (!Checkin.busy && !Checkin.err && performance.now() - this.asked > 3000) { this.asked = performance.now(); Checkin.load(this.game, true); }
      return Checkin.busy || !Checkin.err ? 'loading' : 'error';
    }
    if (this.got) return 'got';
    const ph = Checkin.phase(st);
    if (ph === 'ended') return 'ended';
    if (!st.logged) return 'login';
    if (ph === 'before') return 'before';
    if (st.days >= Checkin.count(st)) return 'all';
    return Checkin.today(st) ? 'today' : 'sign';
  }
  // the panel, its header, the scene, the bar; the slope's height at x; each day's stop on it
  geo() {
    const u = this.game.ui, n = Checkin.count(Checkin.st);
    const W = Math.min(u.w - 8, 440), H = Math.min(u.h - 8, 270), x = Math.floor((u.w - W) / 2), y = Math.floor((u.h - H) / 2);
    const P = { x, y, w: W, h: H };
    const bar = { x: x + 4, y: y + H - 50, w: W - 8, h: 46 };
    const scene = { x: x + 4, y: y + 34, w: W - 8, h: bar.y - (y + 34) };
    const rise = Math.min(34, scene.h * 0.3);
    const ground = (gx) => Math.round(scene.y + scene.h - 14 - ((gx - scene.x) / scene.w) * rise - 3 * Math.sin((gx - scene.x) * 0.05));
    const left = scene.x + 34, step = (scene.w - 34 - 30) / Math.max(1, n - 1), stops = [];
    for (let i = 0; i < n; i++) { const sx = Math.round(left + i * step), gy = ground(sx); stops.push({ i, x: sx, gy, big: i === n - 1, hit: { x: sx - 15, y: gy - 50, w: 30, h: 58 } }); }
    return { u, n, P, bar, scene, ground, stops, step, icon: { x: bar.x + 6, y: bar.y + 5, w: 36, h: 36 } };
  }
  layout() {
    const g = this.game, G = this.geo(), st = Checkin.cur(), s = this.state(), B = G.bar;
    this.key = s + (this.got && this.got.done ? '+' : '');
    this.widgets = [{ x: G.P.x + G.P.w - 20, y: G.P.y + 5, w: 15, h: 15, pad: 5, label: '×', onClick: () => this.back() }];
    const bw = 76, bh = 22, by = B.y + Math.round((B.h - bh) / 2);
    let bx = B.x + B.w - 6 - bw;
    const add = (w) => { this.widgets.push({ x: bx, y: by, w: bw, h: bh, ...w }); bx -= bw + 4; };
    if (s === 'sign') add({ gold: true, glow: true, label: () => (this.busy ? '正在签到…' : '签到'), enabled: !this.busy, onClick: () => this.claim() });
    if (s === 'login') add({ gold: true, label: '登录', onClick: () => { if (typeof LoginScreen !== 'undefined') g.ui.open(new LoginScreen(g, () => g.ui.open(new CheckinScreen(g, this.parent, true)), () => g.ui.open(this))); } });
    if (s === 'error') add({ label: '重试', onClick: () => { Checkin.err = ''; Checkin.load(g, true); this.layout(); } });
    // 去穿戴: once something was signed for (right after a claim: when the reward has landed)
    const wear = st && st.logged && st.days > 0 && (!this.got || this.got.done) && s !== 'sign' && (typeof Cosmetics !== 'undefined' || typeof WardrobeScreen !== 'undefined');
    if (wear) add({ gold: !!this.got, label: '去穿戴', onClick: () => this.wear(this.got ? Checkin.kind(this.got.id) : undefined) });
  }
  wear(kind) {
    const g = this.game;
    if (typeof Cosmetics !== 'undefined' && Cosmetics.openWardrobe) return Cosmetics.openWardrobe(g, this, kind);
    if (typeof WardrobeScreen !== 'undefined') g.ui.open(new WardrobeScreen(g, this));
  }
  async claim() {
    if (this.busy) return;
    this.busy = true; this.say(''); this.layout();
    const t0 = Date.now(), from = Checkin.cur() ? Checkin.cur().days - 1 : -1;
    // (reads still out when it answers - the one this screen opened with - are older than the claim: took drops them)
    let r = null, err = null;
    Checkin.claiming++;
    try { r = await Account.api('/api/account/checkin/claim', {}); } catch (e) { err = e; }
    Checkin.claiming--;
    if (r) Checkin.claimAt = ++Checkin.seq;
    try {
      if (err) throw err;
      // (the new decoration is owned at once: the wardrobe reads the account)
      if (r.account) { Account.data = r.account; Account.save(); }
      Checkin.took(r, t0, Date.now());
      const n = Checkin.count(), idx = Math.max(0, Math.min(n - 1, (r.days | 0) - 1));
      const sparks = [];
      for (let i = 0; i < 36; i++) sparks.push({ a: Math.random() * Math.PI * 2, v: 25 + Math.random() * 70, c: ['#FFD24A', '#FFF2B0', '#FFFFFF', '#9FD8FF'][i % 4], s: i % 3 ? 2 : 3 });
      this.got = { id: r.reward || Checkin.st.event.rewards[idx], idx, from: Math.min(from, idx - 1), t0: performance.now(), sparks, opened: false, landed: false, done: false, last: (r.days | 0) >= n };
      this.sel = null;
      Checkin.tc('checkin_claim');
    } catch (e) {
      this.say(e.message, true);
      Checkin.load(this.game, true); // (already signed elsewhere, the event over: the card as it really is)
    }
    this.busy = false;
    if (this.game.ui.screen === this) this.layout();
  }
  mouseDown(ui, mx, my, button) {
    if (button === 0) for (const s of this.geo().stops) if (ui.hit(s.hit, mx, my)) { this.sel = s.i; Sound.click(); return; }
    for (const w of this.widgets) if (w.pad && w.enabled !== false && ui.hit({ x: w.x - w.pad, y: w.y - w.pad, w: w.w + 2 * w.pad, h: w.h + 2 * w.pad }, mx, my)) { Sound.click(); w.onClick(); return; }
    super.mouseDown(ui, mx, my, button);
  }
  // the day the bar tells about: hovered, else tapped, else the next to sign for (the last signed when all are)
  focus(G) {
    const h = G.stops.find((s) => G.u.hit(s.hit));
    if (h) return h.i;
    if (this.got) return this.got.idx;
    if (this.sel !== null && this.sel < G.n) return this.sel;
    const st = Checkin.cur();
    return st ? Math.min(G.n - 1, st.days) : 0;
  }
  // a day's box: 'got' signed, 'today' the one signing now gives, 'later'
  slotState(i, st) {
    if (!st) return 'later';
    if (i < st.days) return 'got';
    return i === st.days && Checkin.canSign(st) ? 'today' : 'later';
  }
  // where the penguin stands: by the last box signed (left of the first before any), hopping to the new one while a
  // claim plays; its feet on the snow
  penguinAt(G, now) {
    const st = Checkin.cur(), spot = (i) => (i < 0 ? { x: G.stops[0].x - 22, y: G.ground(G.stops[0].x - 22) } : { x: G.stops[i].x - (G.stops[i].big ? 22 : 18), y: G.stops[i].gy });
    if (this.got) {
      const t = (now - this.got.t0) / 1000, a = spot(this.got.from), b = spot(this.got.idx);
      if (t < 0.45) { const k = t / 0.45, e = k * k * (3 - 2 * k); return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e - Math.sin(k * Math.PI) * 16, hop: true }; }
      return b;
    }
    return spot(st ? Math.min(G.n, st.days) - 1 : -1);
  }
  drawExtra(ui) {
    const c = ui.ctx, G = this.geo(), st = Checkin.cur(), any = Checkin.st, s = this.state(), now = performance.now(), T = (now - this.t0) / 1000;
    // (the countdown reached the start, midnight passed, the reward landed: other buttons)
    if (s + (this.got && this.got.done ? '+' : '') !== this.key) this.layout();
    const P = G.P, S = G.scene;
    // ---- the panel: cut corners, a dark edge and a frosty line inside ----
    const rect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    rect(P.x + 2, P.y, P.w - 4, P.h, '#060B1A'); rect(P.x, P.y + 2, P.w, P.h - 4, '#060B1A'); rect(P.x + 1, P.y + 1, P.w - 2, P.h - 2, '#060B1A');
    rect(P.x + 2, P.y + 2, P.w - 4, P.h - 4, '#101C3C');
    c.strokeStyle = 'rgba(190,225,255,0.55)'; c.lineWidth = 1; c.strokeRect(P.x + 2.5, P.y + 2.5, P.w - 5, P.h - 5);
    // ---- the header: the name, the dates and the rule; the progress as 7 snowflakes ----
    Font.draw(c, (any && any.event.name) || '开服签到', P.x + 10, P.y + 8, '#FFFFFF');
    const tw = Font.width((any && any.event.name) || '开服签到');
    Font.draw(c, '· 冬日足迹', P.x + 14 + tw, P.y + 8, '#9FD8FF');
    const n = G.n, done = st ? Math.min(n, st.days) : 0;
    const pipX = P.x + P.w - 30 - n * 10;
    for (let i = 0; i < n; i++) this.flake(c, pipX + i * 10, P.y + 9, i < done ? '#FFD24A' : 'rgba(160,190,230,0.35)', i < done && this.got && i === this.got.idx ? 1 + 0.4 * Math.max(0, 1 - Math.abs((now - this.got.t0) / 1000 - 1.3) * 3) : 1);
    if (any) Font.draw(c, fitText(Checkin.dates(any.event) + ' · 累计签满 ' + n + ' 天就行，不用连续', P.w - 20), P.x + 10, P.y + 20, '#7F93BF');
    // ---- the scene ----
    c.save(); c.beginPath(); c.rect(S.x, S.y, S.w, S.h); c.clip();
    this.drawSky(c, S, T);
    this.drawSlope(c, G, T);
    const rewards = any ? any.event.rewards : [], fs = this.focus(G);
    // footprints between the stops (walked: darker), then the boxes, then the penguin in front
    for (let i = 0; i + 1 < G.n; i++) this.steps(c, G, G.stops[i], G.stops[i + 1], st && i + 1 < st.days, i);
    if (G.n) this.steps(c, G, { x: G.stops[0].x - 22, gy: G.ground(G.stops[0].x - 22) }, G.stops[0], st && st.days > 0, -1);
    for (const sp of G.stops) this.drawStop(ui, G, sp, rewards[sp.i], this.slotState(sp.i, st), sp.i === fs, now);
    const pg = this.penguinAt(G, now);
    this.drawPenguin(c, pg.x, pg.y, T, !!pg.hop);
    this.drawSnow(c, S, T);
    c.restore();
    // ---- the bar ----
    this.drawBar(ui, G, rewards, fs, s, st, now);
  }
  // a little 5 x 5 snowflake (the header's progress)
  flake(c, x, y, col, k = 1) {
    c.save(); c.translate(x + 2.5, y + 2.5); c.scale(k, k); c.fillStyle = col;
    c.fillRect(-0.5, -2.5, 1, 5); c.fillRect(-2.5, -0.5, 5, 1); c.fillRect(-1.5, -1.5, 1, 1); c.fillRect(0.5, -1.5, 1, 1); c.fillRect(-1.5, 0.5, 1, 1); c.fillRect(0.5, 0.5, 1, 1);
    c.restore();
  }
  // night sky, stars, a crescent moon, the aurora drifting, far mountains
  drawSky(c, S, T) {
    const gr = c.createLinearGradient(0, S.y, 0, S.y + S.h);
    gr.addColorStop(0, '#081230'); gr.addColorStop(0.55, '#1C3266'); gr.addColorStop(1, '#3F5E9C');
    c.fillStyle = gr; c.fillRect(S.x, S.y, S.w, S.h);
    for (let i = 0; i < 46; i++) {
      const x = S.x + Math.floor(chkRnd(i, 1) * S.w), y = S.y + Math.floor(chkRnd(i, 2) * S.h * 0.55), tw = 0.35 + 0.65 * Math.max(0, Math.sin(T * (1 + chkRnd(i, 3) * 2) + i));
      c.fillStyle = `rgba(255,255,255,${(tw * (0.4 + 0.6 * chkRnd(i, 4))).toFixed(2)})`; c.fillRect(x, y, 1, 1);
    }
    const mx = S.x + S.w - 34, my = S.y + 10;
    c.fillStyle = 'rgba(255,248,214,0.12)'; c.fillRect(mx - 4, my - 4, 18, 18);
    c.fillStyle = '#FFF4C8'; c.fillRect(mx, my + 2, 10, 6); c.fillRect(mx + 2, my, 6, 10); c.fillRect(mx + 1, my + 1, 8, 8);
    c.fillStyle = '#16295A'; c.fillRect(mx + 4, my, 6, 7); c.fillRect(mx + 5, my - 1, 6, 8); // (the shadow that makes the crescent)
    for (let x = 0; x < S.w; x += 2) {
      const u = x / S.w;
      for (const [k, col, ph, yy] of [[1, '90,255,190', 0, 0.16], [0.7, '120,200,255', 2.1, 0.26]]) {
        const y = S.y + S.h * yy + Math.sin(u * 7 + T * 0.35 + ph) * 7 + Math.sin(u * 17 - T * 0.2 + ph) * 3;
        const a = k * 0.16 * (0.55 + 0.45 * Math.sin(u * 5 - T * 0.5 + ph));
        c.fillStyle = `rgba(${col},${a.toFixed(3)})`; c.fillRect(S.x + x, Math.round(y), 2, 12);
        c.fillStyle = `rgba(${col},${(a * 0.5).toFixed(3)})`; c.fillRect(S.x + x, Math.round(y) + 12, 2, 8);
      }
    }
    // far mountains: stepped, snow on the peaks
    const mh = (u) => S.h * (0.16 + 0.16 * Math.abs(Math.sin(u * 4.3 + 0.6)) + 0.05 * Math.sin(u * 13)), base = S.y + S.h * 0.8;
    let peak = 0; for (let x = 0; x < S.w; x += 2) peak = Math.max(peak, mh(x / S.w));
    const mg = c.createLinearGradient(0, base - peak, 0, base); mg.addColorStop(0, '#3A5694'); mg.addColorStop(1, '#22386C');
    for (let x = 0; x < S.w; x += 2) {
      const h = mh(x / S.w), top = Math.round(base - h);
      c.fillStyle = mg; c.fillRect(S.x + x, top, 2, S.y + S.h - top);
      c.fillStyle = '#6F8CC6'; c.fillRect(S.x + x, top, 2, 1);
      const snow = Math.min(4, Math.round((h - peak * 0.86) * 0.5)); // (snow caps: only near the peaks)
      if (snow > 0) { c.fillStyle = '#DCE8F8'; c.fillRect(S.x + x, top, 2, snow); c.fillStyle = '#AFC3E4'; c.fillRect(S.x + x, top + snow, 2, 1); }
    }
  }
  // the snowy slope the boxes stand on
  drawSlope(c, G, T) {
    const S = G.scene;
    for (let x = 0; x < S.w; x += 2) {
      const gx = S.x + x, gy = G.ground(gx);
      c.fillStyle = '#E3EFFA'; c.fillRect(gx, gy, 2, S.y + S.h - gy);
      c.fillStyle = '#F7FBFF'; c.fillRect(gx, gy, 2, 2);
      c.fillStyle = '#C9DCEF'; c.fillRect(gx, gy + 7 + ((x >> 1) % 5 === 0 ? 1 : 0), 2, 1);
    }
    for (let i = 0; i < 14; i++) { // (glints in the snow)
      const gx = S.x + Math.floor(chkRnd(i, 9) * S.w), gy = G.ground(gx) + 3 + Math.floor(chkRnd(i, 10) * 8);
      if (Math.sin(T * 2 + i * 1.7) > 0.7) { c.fillStyle = '#FFFFFF'; c.fillRect(gx, gy, 1, 1); }
    }
  }
  steps(c, G, a, b, walked, i) {
    const n = Math.max(2, Math.floor((b.x - a.x) / 6));
    for (let k = 1; k < n; k++) {
      const x = Math.round(a.x + 6 + (b.x - 12 - a.x) * k / n), y = G.ground(x) + 3 + (k % 2 ? 0 : 2);
      c.fillStyle = walked ? '#8EA7C6' : 'rgba(150,175,205,0.35)'; c.fillRect(x, y, 2, 1);
    }
  }
  drawSnow(c, S, T) {
    for (let i = 0; i < 70; i++) {
      const sp = 8 + chkRnd(i, 5) * 14, x = S.x + ((chkRnd(i, 6) * S.w + Math.sin(T * 0.8 + i) * 6) % S.w + S.w) % S.w;
      const y = S.y + ((chkRnd(i, 7) * S.h + T * sp) % S.h);
      c.fillStyle = i % 5 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.95)'; c.fillRect(Math.round(x), Math.round(y), i % 7 ? 1 : 2, i % 7 ? 1 : 2);
    }
  }
  // one day: its box on the snow (wrapped, glowing today, opened once signed), its reward over it, the day under it
  drawStop(ui, G, sp, id, ss, focused, now) {
    const c = ui.ctx, k = sp.big ? 1.5 : 1, bw = Math.round(16 * k), bh = Math.round(13 * k), x = sp.x - bw / 2, y = sp.gy - bh + 1;
    const [paper, ribbon] = CHK_BOX[sp.i % CHK_BOX.length], hot = ui.hit(sp.hit);
    const claiming = this.got && this.got.idx === sp.i, t = claiming ? (now - this.got.t0) / 1000 : 9;
    const opened = ss === 'got' && !(claiming && t < 0.55);
    if (ss === 'today' || (claiming && t < 0.7)) {
      const p = 0.5 + 0.5 * Math.sin(now / 260);
      c.fillStyle = `rgba(255,214,90,${(0.16 + 0.16 * p).toFixed(3)})`; c.fillRect(x - 6, y - 26, bw + 12, bh + 32);
      c.fillStyle = `rgba(255,236,160,${(0.2 + 0.2 * p).toFixed(3)})`; c.fillRect(x - 3, y - 3, bw + 6, bh + 6);
    }
    if (focused) { c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(sp.hit.x, sp.hit.y, sp.hit.w, sp.hit.h); }
    if (sp.big) { // (the last day's flag on the top)
      const fx = x + bw + 2, fy = y - 16;
      c.fillStyle = '#6B4A2A'; c.fillRect(fx, fy, 1, 16 + bh - 1);
      const wv = Math.round(Math.sin(now / 300));
      c.fillStyle = '#E8262B'; c.fillRect(fx + 1, fy, 7, 2); c.fillRect(fx + 1, fy + 2, 6 + wv, 2); c.fillRect(fx + 1, fy + 4, 5, 1);
    }
    // the box: shaking while it bursts open
    const sh = claiming && t >= 0.45 && t < 0.6 ? Math.round(Math.sin(t * 90) * 1.5) : 0;
    c.save(); c.translate(sh, 0);
    c.fillStyle = 'rgba(30,50,90,0.25)'; c.fillRect(x + 1, sp.gy, bw, 2); // (its shadow)
    const rw = Math.round(2 * k);
    const lidY = y, lidH = Math.round(4 * k);
    c.fillStyle = paper; c.fillRect(x, y + lidH - 1, bw, bh - lidH + 1);
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x, y + bh - 2, bw, 2); c.fillRect(x + bw - 2, y + lidH, 2, bh - lidH);
    c.fillStyle = ribbon; c.fillRect(x + Math.floor(bw / 2) - 1, y + lidH - 1, rw, bh - lidH + 1);
    if (opened) { c.fillStyle = 'rgba(255,240,180,0.55)'; c.fillRect(x + 1, y + lidH - 1, bw - 2, 2); } // (light from inside)
    // the lid (tipped up and back once opened) and the bow
    c.save();
    if (opened) { c.translate(x + bw + 1, sp.gy + 1); c.rotate(-1.15); c.translate(-(x - 1), -lidY); }
    c.fillStyle = paper; c.fillRect(x - 1, lidY, bw + 2, lidH);
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x - 1, lidY, bw + 2, 1);
    c.fillStyle = ribbon; c.fillRect(x + Math.floor(bw / 2) - 1, lidY, rw, lidH);
    if (!opened) { const bx = x + Math.floor(bw / 2); c.fillRect(bx - 4, lidY - 2, 3, 2); c.fillRect(bx + 1, lidY - 2, 3, 2); c.fillRect(bx - 1, lidY - 1, 2, 1); }
    c.restore();
    if (ss === 'later') { c.fillStyle = 'rgba(16,28,60,0.28)'; c.fillRect(x - 1, y - 2, bw + 2, bh + 2); }
    c.restore();
    // the reward over it (hidden while it flies off)
    const flying = claiming && t < 1.25, iy = y - 25 - (sp.big ? 2 : 0) + (ss === 'today' ? Math.round(Math.sin(now / 300) * 1.5) : 0);
    if (id && !flying) {
      c.save(); if (ss === 'later') c.globalAlpha = 0.45;
      Checkin.drawReward(ui, id, sp.x - 10, iy, 20, false);
      c.restore();
      if (ss === 'got') { drawIcon(c, 'check', sp.x + 5, iy + 13, 1, '#103010'); drawIcon(c, 'check', sp.x + 4, iy + 12, 1, '#55FF55'); }
    }
    if (ss === 'today') { const ay = iy - 9 + Math.round(Math.abs(Math.sin(now / 220)) * -3); c.fillStyle = '#FFD24A'; c.fillRect(sp.x - 3, ay, 7, 1); c.fillRect(sp.x - 2, ay + 1, 5, 1); c.fillRect(sp.x - 1, ay + 2, 3, 1); c.fillRect(sp.x, ay + 3, 1, 1); }
    // the day under it, on the snow
    const lbl = G.step >= 44 ? '第' + (sp.i + 1) + '天' : String(sp.i + 1);
    Font.center(c, lbl, sp.x, sp.gy + 4, ss === 'got' ? '#2E7D32' : ss === 'today' ? '#B5650A' : '#5B7397', false);
    if (hot) { c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1; c.strokeRect(sp.hit.x + 0.5, sp.hit.y + 0.5, sp.hit.w - 1, sp.hit.h - 1); }
  }
  // the penguin (2 px a pixel), feet at (x, y): a waddle, a blink now and then; a hop leans it forward
  drawPenguin(c, x, y, T, hop) {
    const lean = hop ? 0.25 : Math.sin(T * 3) * 0.06, blink = (T % 3.3) < 0.12, s = 2, w = 8 * s, h = CHK_PENGUIN.length * s;
    c.save(); c.translate(Math.round(x), Math.round(y)); c.rotate(lean);
    c.fillStyle = 'rgba(30,50,90,0.25)'; c.fillRect(-w / 2 + 2, 0, w - 4, 2);
    CHK_PENGUIN.forEach((row, j) => { for (let i = 0; i < 8; i++) { let ch = row[i]; if (ch === '.') continue; if (blink && j === 2 && ch === 'W') ch = 'k'; c.fillStyle = CHK_PAL[ch]; c.fillRect(-w / 2 + i * s, -h - 2 + j * s, s, s); } });
    const step = hop ? 0 : Math.floor(T * 3) % 2; // (the feet)
    c.fillStyle = CHK_PAL.o; c.fillRect(-w / 2 + 2, -2 - (step ? 1 : 0), 4, 2); c.fillRect(w / 2 - 6, -2 - (step ? 0 : 1), 4, 2);
    c.restore();
  }
  // the bar: the focused day's reward in a frame, its name and what it takes; a note over it; the buttons (widgets)
  drawBar(ui, G, rewards, fs, s, st, now) {
    const c = ui.ctx, B = G.bar, I = G.icon;
    c.fillStyle = 'rgba(4,10,28,0.88)'; c.fillRect(B.x, B.y, B.w, B.h);
    c.fillStyle = 'rgba(190,225,255,0.35)'; c.fillRect(B.x, B.y, B.w, 1);
    c.fillStyle = '#1B2A50'; c.fillRect(I.x, I.y, I.w, I.h);
    c.strokeStyle = 'rgba(190,225,255,0.5)'; c.lineWidth = 1; c.strokeRect(I.x + 0.5, I.y + 0.5, I.w - 1, I.h - 1);
    const id = this.got ? this.got.id : rewards[fs], ss = this.got ? 'got' : this.slotState(fs, st), tx = I.x + I.w + 8;
    const btnL = Math.min(...this.widgets.filter((w) => w.y >= B.y).map((w) => w.x), B.x + B.w - 4), room = btnL - 6 - tx;
    if (id && !(this.got && !this.got.landed)) Checkin.drawReward(ui, id, I.x + 4, I.y + 4, 28, ss === 'later');
    const line = (t, i, col) => Font.draw(c, fitText(t, room), tx, B.y + 10 + i * 13, col);
    const n = Checkin.count(st), ev = Checkin.st && Checkin.st.event;
    if (s === 'loading') { line('正在读取…', 0.5, '#A0A0A0'); return; }
    if (s === 'error') { line(Checkin.err, 0.5, '#FF6060'); return; }
    if (this.got) {
      if (!this.got.landed) return;
      const k = Math.min(1, (now - this.got.t0 - 1250) / 300);
      c.save(); c.globalAlpha = Math.max(0, k);
      line('获得：' + Checkin.name(this.got.id), 0, '#FFD24A');
      line(this.got.last ? `${n} 天全部签满！所有奖励都是你的了` : `已签 ${st ? st.days : 0}/${n} 天 · 明天再来`, 1, '#C8D6F0');
      c.restore();
      return;
    }
    if (id) {
      const e = Font.draw(c, fitText(`第${fs + 1}天 · ${Checkin.name(id)}`, room - 40), tx, B.y + 10, '#FFFF55');
      if (e + 6 + Font.width(Checkin.kindName(id)) <= tx + room) Font.draw(c, Checkin.kindName(id), e + 6, B.y + 10, '#7F93BF');
    }
    let sub = '', col = '#C8D6F0';
    const left = st ? fs + 1 - st.days : fs + 1;
    if (s === 'ended') sub = st.logged && st.days ? `活动已结束 · 你领到了 ${st.days} 件装饰，永久保留` : '活动已结束';
    else if (s === 'login') sub = '登录后签到，换设备也在';
    else if (s === 'before') { sub = `${Checkin.day(ev.start)} ${Checkin.time(ev.start)} 开始 · 还有 ${Checkin.span(ev.start - Checkin.now())}`; col = '#FFD24A'; }
    else if (ss === 'got') { sub = '已领取'; col = '#55FF55'; }
    else if (ss === 'today') { sub = '今天签到就能领'; col = '#FFD24A'; }
    else if (s === 'all') { sub = '奖励已全部领取'; col = '#55FF55'; }
    else if (s === 'today' && left === 1) { sub = `明天就能领 · 还有 ${Checkin.span(Checkin.untilMidnight())}`; col = '#FFD24A'; }
    else sub = `再签 ${left} 天就能领`;
    line(sub, 1, col);
    if (this.note && now - this.noteT < 5000) {
      c.fillStyle = 'rgba(0,0,0,0.8)'; c.fillRect(B.x, B.y - 13, B.w, 12);
      Font.center(c, fitText(this.note, B.w - 8), B.x + B.w / 2, B.y - 11, this.noteBad ? '#FF6060' : '#FFFFFF');
    }
  }
  draw(ui) {
    super.draw(ui);
    const G = this.geo(), st = Checkin.st, c = ui.ctx;
    // the sign button breathes
    const sb = this.widgets.find((w) => w.glow);
    if (sb && sb.enabled !== false) { const p = 0.5 + 0.5 * Math.sin(performance.now() / 260); c.strokeStyle = `rgba(255,230,140,${(0.35 + 0.45 * p).toFixed(2)})`; c.lineWidth = 1; c.strokeRect(sb.x - 1.5, sb.y - 1.5, sb.w + 3, sb.h + 3); }
    if (this.got) this.drawClaim(ui, G);
    // the reward's name over a hovered box
    const h = G.stops.find((s) => ui.hit(s.hit));
    if (h && st && st.event.rewards[h.i]) {
      const id = st.event.rewards[h.i];
      ui.tooltip([{ text: Checkin.name(id), color: '#FFFF55' }, { text: Checkin.kindName(id) + ' · 第' + (h.i + 1) + '天奖励', color: '#AAAAAA' }], ui.mouse.x, ui.mouse.y);
    }
  }
  // the claim, after the penguin's hop (0.45 s): the box shakes and bursts open in a flash, snow and sparks (0.45-0.7);
  // the reward rises and flies down to the bar's frame (0.65-1.25), lands with the level-up sound and a burst there
  drawClaim(ui, G) {
    const c = ui.ctx, g = this.got, t = (performance.now() - g.t0) / 1000, sp = G.stops[g.idx];
    if (!sp) return;
    const I = G.icon, bx = sp.x, by = sp.gy - (sp.big ? 20 : 13);
    if (t >= 0.45 && !g.opened) { g.opened = true; if (typeof Sound !== 'undefined' && Sound.ev) Sound.ev('entity.item.pickup', null, 0.8, 0.9); }
    if (t >= 1.25 && !g.landed) {
      g.landed = true;
      if (typeof Sound !== 'undefined' && Sound.ev) { Sound.ev('entity.player.levelup', null, 0.8, 1); if (g.last) Sound.ev('ui.toast.challenge_complete', null, 0.7, 1); }
    }
    if (t >= 1.5 && !g.done) { g.done = true; this.layout(); }
    if (t >= 0.55 && t < 0.9) { // (the flash and a ring)
      const k = (t - 0.55) / 0.35;
      c.fillStyle = `rgba(255,250,220,${(0.7 * (1 - k)).toFixed(2)})`; c.fillRect(bx - 12 - k * 10, by - 12 - k * 10, 24 + k * 20, 24 + k * 20);
      c.strokeStyle = `rgba(255,214,90,${(1 - k).toFixed(2)})`; c.lineWidth = 2; c.beginPath(); c.arc(bx, by, 6 + k * 26, 0, Math.PI * 2); c.stroke();
    }
    const burst = (cx, cy, k, list) => { c.save(); c.globalAlpha = Math.max(0, 1 - k / 0.8); for (const q of list) { const r = q.v * k; c.fillStyle = q.c; c.fillRect(Math.round(cx + Math.cos(q.a) * r), Math.round(cy + Math.sin(q.a) * r + 30 * k * k), q.s, q.s); } c.restore(); };
    if (t >= 0.55 && t < 1.35) burst(bx, by, t - 0.55, g.sparks.slice(0, 18));
    if (t >= 0.65 && t < 1.25) {
      const k = (t - 0.65) / 0.6, e = k * k * (3 - 2 * k), m = 1 - e;
      const x0 = bx, y0 = by - 18, x2 = I.x + I.w / 2, y2 = I.y + I.h / 2, x1 = (x0 + x2) / 2, y1 = Math.min(y0, y2) - 50;
      const x = m * m * x0 + 2 * m * e * x1 + e * e * x2, y = m * m * y0 + 2 * m * e * y1 + e * e * y2, size = Math.round(20 + 12 * e + 10 * Math.sin(k * Math.PI));
      c.save(); c.fillStyle = 'rgba(255,220,90,0.35)'; c.fillRect(Math.round(x - size / 2 - 3), Math.round(y - size / 2 - 3), size + 6, size + 6);
      c.translate(Math.round(x), Math.round(y)); c.rotate(Math.sin(k * Math.PI) * 0.4);
      Checkin.drawReward(ui, g.id, -Math.round(size / 2), -Math.round(size / 2), size, false);
      c.restore();
    }
    if (t >= 1.25 && t < 2.05) burst(I.x + I.w / 2, I.y + I.h / 2, t - 1.25, g.sparks.slice(18));
  }
}

// ---- the ways in: the title screen (under the news sign) and the pause menu, each with the red dot ----
(() => {
  const tl = TitleScreen.prototype.layout;
  TitleScreen.prototype.layout = function () {
    tl.call(this);
    const g = this.game;
    Checkin.load(g); // (each time the title opens, at most once a minute)
    if (!Checkin.shown()) return;
    const r = Checkin.titleRect(g.ui);
    this.widgets.push({ ...r, label: '签到', checkin: true, tip: ['开服签到：累计签 ' + Checkin.count() + ' 天，领原创装饰'], onClick: () => g.ui.open(new CheckinScreen(g, this)) });
  };
  const pl = PauseScreen.prototype.layout;
  PauseScreen.prototype.layout = function () {
    pl.call(this);
    const g = this.game;
    Checkin.load(g);
    if (!Checkin.shown()) return;
    // (the top left: the menu's own rows change with rooms, the AI companion and local rooms; the top right is where the
    // touch HUD's pause button is - a second tap there to get back to the game opened this)
    this.widgets.push({ x: 4, y: 4, w: 54, h: 16, label: '签到', checkin: true, onClick: () => g.ui.open(new CheckinScreen(g, this)) });
  };
  for (const K of [TitleScreen, PauseScreen]) {
    const d = K.prototype.draw;
    K.prototype.draw = function (ui) {
      d.call(this, ui);
      if (!Checkin.dot()) return;
      const b = this.widgets.find((w) => w.checkin);
      if (b) Checkin.drawDot(ui.ctx, b.x + b.w - 4, b.y - 2);
    };
  }
})();
