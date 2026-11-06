'use strict';
// 公告：主界面的吊牌、掉下来的公告板、超级管理员的编辑（game/COMMUNITY_PLAN.md）
// ---------------------------------------------------------------------------
// The news board: a hanging sign beside the logo on the title screen that swings a little more, glows and shows a
// red count while there is news the player hasn't read. Tapped, its chains snap, it falls to the middle of the
// screen, bounces twice and opens into the board. The list comes from the room service (GET /api/news) and is kept
// in this browser for offline. Super administrators write, publish and delete from the board itself.
// (the sign's place is shared with the check-in button under it, checkin.js: NewsBoard.signRect / checkinRect)
// ---------------------------------------------------------------------------
const NewsBoard = {
  list: null, adminList: null, ver: 0, lastFetch: 0, loading: false, pending: null, err: '', wood: null, seenV: null, autoId: '',
  load() {
    try { const s = JSON.parse(localStorage.getItem('mcjs-news') || 'null'); if (s && Array.isArray(s.list)) this.list = s.list; } catch (e) { }
  },
  isSuper() { return typeof Account !== 'undefined' && Account.loggedIn && !!(Account.data && Account.data.super); },
  // the newest publication time the player has seen (kept in memory too: read every frame for the sign)
  seen() {
    if (this.seenV === null) { try { this.seenV = +localStorage.getItem('mcjs-news-seen') || 0; } catch (e) { this.seenV = 0; } }
    return this.seenV;
  },
  markSeen() {
    const n = Math.max(0, ...(this.list || []).filter((x) => !x.draft).map((x) => x.at || 0));
    if (n <= this.seen()) return;
    this.seenV = n;
    try { localStorage.setItem('mcjs-news-seen', String(n)); } catch (e) { }
  },
  unread() { const s = this.seen(); return (this.list || []).filter((x) => !x.draft && (x.at || 0) > s); },
  // the published list (anyone; logged in or not); force: once more after a fetch already on the way (after a save).
  // quiet: the title screen's own refreshes go by one plain fetch, nothing reported - Account.api sends net_fail with
  // the statistics, and a device that can't reach the service would add one every title open and every 5 minutes
  // (as checkin.js quiet())
  fetch(force, quiet) {
    if (this.pending) return force ? this.pending.then(() => this.fetch()) : this.pending;
    if (typeof RoomService === 'undefined' || !RoomService.base() || typeof Account === 'undefined') return Promise.resolve();
    this.loading = true; this.lastFetch = performance.now();
    const get = async () => {
      if (!quiet) return Account.api('/api/news');
      let f;
      try { f = await fetch(RoomService.base() + '/api/news'); } catch (e) { throw new Error('连不上游戏服务器'); }
      let j; try { j = await f.json(); } catch (e) { j = { error: '服务器没有回应（HTTP ' + f.status + '）' }; }
      if (!f.ok || j.error) throw new Error(j.error || 'HTTP ' + f.status);
      return j;
    };
    return (this.pending = (async () => {
      try {
        const r = await get();
        this.list = (r.list || []).filter((x) => !x.draft); this.err = ''; this.ver++;
        try { localStorage.setItem('mcjs-news', JSON.stringify({ list: this.list, at: Date.now() })); } catch (e) { }
      } catch (e) { this.err = e.message; }
      this.loading = false; this.pending = null;
    })());
  },
  // drafts included (super administrators)
  async fetchAdmin() {
    if (!this.isSuper()) return;
    try { const r = await Account.api('/api/account/news/list'); this.adminList = r.list || []; this.ver++; } catch (e) { this.err = e.message; }
  },
  // a paragraph with **bold** in it, wrapped to w: lines of runs [{ t, b }] (an unpaired ** stays as it is)
  rich(para, w) {
    const runs = [], parts = String(para).split('**');
    if (parts.length % 2 === 0) parts[parts.length - 2] += '**' + parts.pop();
    parts.forEach((t, i) => { if (t) runs.push({ t, b: i % 2 === 1 }); });
    const lines = []; let line = [], lw = 0;
    for (const r of runs) for (const ch of r.t) {
      const cw = Font.width(ch);
      if (lw + cw > w && line.length) { lines.push(line); line = []; lw = 0; }
      const last = line[line.length - 1];
      if (last && last.b === r.b) last.t += ch; else line.push({ t: ch, b: r.b });
      lw += cw;
    }
    if (line.length) lines.push(line);
    return lines;
  },
  plain(t) { return String(t || '').replace(/\*\*/g, ''); },
  sorted(l) { return (l || []).slice().sort((a, b) => (!!b.pin - !!a.pin) || ((b.at || 0) - (a.at || 0))); },
  // Beijing time: 11月06日 18:30 (the year only when it isn't this one)
  date(at) {
    const p = (n) => String(n).padStart(2, '0'), d = new Date((at || 0) + 8 * 3600e3), y = new Date(Date.now() + 8 * 3600e3).getUTCFullYear();
    return (d.getUTCFullYear() !== y ? d.getUTCFullYear() + '年' : '') + `${p(d.getUTCMonth() + 1)}月${p(d.getUTCDate())}日 ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  },
  // an important announcement the player hasn't seen drops by itself, once
  autoItem() {
    const l = (this.list || []).filter((x) => !x.draft);
    if (!l.length) return null;
    const n = l.reduce((a, b) => ((b.at || 0) > (a.at || 0) ? b : a));
    if (!n.imp || (n.at || 0) <= this.seen() || this.autoId === String(n.id)) return null;
    let done = ''; try { done = localStorage.getItem('mcjs-news-auto') || ''; } catch (e) { }
    return done === String(n.id) ? null : n;
  },
  autoDone(n) { this.autoId = String(n.id); try { localStorage.setItem('mcjs-news-auto', String(n.id)); } catch (e) { } },
  // no falling board: the low preset, or the player asks the browser for less motion
  noAnim(g) {
    const s = (g && g.settings) || {};
    if (s.newsAnim === false || (s.preset === 'auto' ? s.autoPreset : s.preset) === 'low') return true;
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  },
  open(g, parent, auto) {
    if (typeof Telemetry !== 'undefined' && Telemetry.count) Telemetry.count(auto ? 'news_auto' : 'news_open');
    g.ui.open(new NewsScreen(g, parent, { auto }));
  },

  // ---- the sign on the title screen ----
  // top right, under the unlock button (chains from its bottom) or hanging from the top edge; on narrow screens the
  // logo takes the whole top, so under the logo, right of the menu buttons. top = where the chains start
  // (in between, 380-503 wide - 1280x720 / 1366x768 windows: the splash text, w/2+123 at -20 degrees, reaches about
  // w/2+190 at y 40-68 and was hidden behind the sign: under it then, on short chains like the narrow one - long ones
  // from the top would cross the splash)
  signRect(ui) {
    const unlock = typeof Account !== 'undefined' && Account.loggedIn && Account.allUnlocked && !Account.allUnlocked();
    if (ui.w / 2 + 190 <= ui.w - 62) return { x: ui.w - 60, y: 26, w: 54, h: 36, top: unlock ? 22 : 0 };
    if (ui.w / 2 + 128 <= ui.w - 62) return { x: ui.w - 60, y: 72, w: 54, h: 36, top: 66 };
    // (as wide as the room right of the menu buttons allows - they end at w/2+100 - not just right of the logo: at
    // 320 wide that was a 30 x 20 sign, too small to notice)
    const w = Math.max(30, Math.min(54, Math.floor(ui.w / 2 - 112))), h = Math.round(w * 2 / 3);
    return { x: ui.w - 6 - w, y: 88, w, h, top: 82 };
  },
  // the check-in button's place, right under the sign (for checkin.js)
  checkinRect(ui) { const r = this.signRect(ui); return { x: r.x, y: r.y + r.h + 4, w: r.w, h: 16 }; },
  // the chains count too; a little wider for fingers (never down onto the check-in button)
  hitRect(ui, g) {
    const r = this.signRect(ui), touch = (typeof touchOn === 'function' && g && touchOn(g)) || navigator.maxTouchPoints > 0, m = touch ? 8 : 2;
    return { x: r.x - m, y: r.top, w: r.w + m * 2, h: r.y + r.h - r.top + 3 };
  },
  // where the board is now: it swings about the chains' top (more while there's news)
  pose(ui, now) {
    const r = this.signRect(ui), hot = this.unread().length > 0, t = now / 1000;
    const ang = Math.sin(t * Math.PI * 2 / 3.4) * (hot ? 0.06 : 0.022) + (hot ? Math.sin(t * Math.PI * 2 / 1.3) * 0.01 : 0);
    const px = r.x + r.w / 2, py = r.top, d = r.y + r.h / 2 - r.top;
    return { cx: px - Math.sin(ang) * d, cy: py + Math.cos(ang) * d, w: r.w, h: r.h, ang, chain: r.y - r.top, px, py };
  },
  drawSign(ui, g, now) {
    const p = this.pose(ui, now), n = this.unread().length;
    this.drawBoard(ui, g, { ...p, k: 1, hover: ui.hit(this.hitRect(ui, g)), glow: n ? 0.55 + 0.45 * Math.sin(now / 1000 * Math.PI * 2 / 1.4) : 0, badge: n });
  },
  // dark oak planks, tiled once into a canvas big enough for the open board (copied from, never pattern-filled on
  // the screen: see UI.tiled)
  woodTex(g) {
    if (this.wood) return this.wood;
    const r = g && g.renderer;
    if (!r || !r.stripCanvas || typeof T !== 'function') return null;
    const t = document.createElement('canvas'); t.width = 16; t.height = 16;
    t.getContext('2d').drawImage(r.stripCanvas, ...r.tileXY(T('dark_oak_planks')), 16, 16, 0, 0, 16, 16);
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 480;
    const x = cv.getContext('2d'); x.fillStyle = x.createPattern(t, 'repeat'); x.fillRect(0, 0, 640, 480);
    return (this.wood = cv);
  },
  // a hanging chain, drawn up from the board (y1) to y0: links facing us (rings) and edge-on in turn
  chain(c, x, y0, y1) {
    for (let y = y1 - 4, i = 0; y + 4 > y0; y -= 4, i++) {
      const top = Math.max(y, y0), hh = y + 4 - top;
      if (i % 2 === 0) {
        c.fillStyle = '#9AA2B3'; c.fillRect(x - 1, top, 1, hh);
        c.fillStyle = '#4B505C'; c.fillRect(x + 1, top, 1, hh);
        c.fillStyle = '#6F7786'; if (y >= y0) c.fillRect(x, y, 1, 1); c.fillRect(x, y + 3, 1, 1);
      } else { c.fillStyle = '#5E6574'; c.fillRect(x, top, 1, hh); c.fillStyle = '#A9B1C1'; c.fillRect(x, top + (hh > 2 ? 1 : 0), 1, 1); }
    }
  },
  // the board centred on (cx, cy), turned by ang, scaled by k: chains above it, glow, planks, border, 「公告」, badge
  drawBoard(ui, g, o) {
    const c = ui.ctx, w = o.w, h = o.h, x = -w / 2, y = -h / 2, wood = this.woodTex(g), a0 = c.globalAlpha;
    c.save(); c.translate(o.cx, o.cy); c.rotate(o.ang || 0); c.scale(o.k || 1, o.k || 1);
    if (o.chain > 0) { c.globalAlpha = a0 * (o.chainA ?? 1); this.chain(c, x + 8, y - o.chain, y); this.chain(c, x + w - 9, y - o.chain, y); c.globalAlpha = a0; }
    if (o.glow > 0) {
      c.lineWidth = 1;
      for (let i = 5; i >= 1; i--) { c.strokeStyle = `rgba(255,196,64,${(o.glow * 0.55 * (6 - i) / 5).toFixed(3)})`; c.strokeRect(x - i + 0.5, y - i + 0.5, w + 2 * i - 1, h + 2 * i - 1); }
    }
    if (wood) c.drawImage(wood, 0, 0, w, h, x, y, w, h); else { c.fillStyle = '#3B2614'; c.fillRect(x, y, w, h); }
    c.lineWidth = 1;
    c.strokeStyle = '#140A04'; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    c.strokeStyle = 'rgba(0,0,0,0.32)'; c.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(x + 2, y + 2, w - 4, 1);
    c.fillStyle = '#2A2D34'; c.fillRect(x + 7, y + 1, 3, 2); c.fillRect(x + w - 10, y + 1, 3, 2); // where the chains hold
    if (o.glow > 0) { c.fillStyle = `rgba(255,210,100,${(o.glow * 0.22).toFixed(3)})`; c.fillRect(x + 1, y + 1, w - 2, h - 2); }
    if (o.hover) { c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(x + 1, y + 1, w - 2, h - 2); }
    if (o.label !== false) {
      const ts = w >= 44 && h >= 26 ? 2 : 1;
      c.save(); c.scale(ts, ts); Font.center(c, '公告', 0, -4, o.hover ? '#FFFFFF' : '#FFF0C8'); c.restore();
    }
    if (o.badge) {
      // (an exclamation mark, not a count: "有新公告" is all it has to say - the user, 2026-11-02)
      const s = '!', bw = Math.max(10, Font.width(s) + 4), bx = Math.round(x + w - bw + 4), by = Math.round(y - 5);
      c.fillStyle = '#6E0000'; c.fillRect(bx, by + 1, bw, 9); c.fillRect(bx + 1, by, bw - 2, 11);
      c.fillStyle = '#E8262B'; c.fillRect(bx + 1, by + 1, bw - 2, 9);
      Font.draw(c, s, bx + Math.round((bw - Font.width(s)) / 2), by + 2, '#FFFFFF', false);
    }
    c.restore();
  },
};
NewsBoard.load();

// the title screen: refresh when it opens and every 5 minutes, the sign, a tap on it, the important one dropping
(() => {
  const lay = TitleScreen.prototype.layout, dx = TitleScreen.prototype.drawExtra, md = TitleScreen.prototype.mouseDown;
  TitleScreen.prototype.layout = function (...a) {
    const r = lay.apply(this, a);
    if (!this.newsT) {
      this.newsT = performance.now();
      if (!NewsBoard.lastFetch || this.newsT - NewsBoard.lastFetch > 20e3) NewsBoard.fetch(false, true);
    }
    return r;
  };
  TitleScreen.prototype.drawExtra = function (ui) {
    dx.call(this, ui);
    const now = performance.now(), g = this.game, ns = ui.screen;
    if (ns === this) {
      if (NewsBoard.lastFetch && now - NewsBoard.lastFetch > 300e3) NewsBoard.fetch(false, true);
      const a = !this.newsAuto && now - (this.newsT || now) > 1000 && NewsBoard.autoItem();
      if (a) { this.newsAuto = true; NewsBoard.autoDone(a); setTimeout(() => { if (g.ui.screen === this) NewsBoard.open(g, this, true); }, 0); }
    }
    // (the board is down: the news screen draws it)
    if (typeof NewsScreen !== 'undefined' && ns instanceof NewsScreen && ns.parent === this && ns.from) return;
    NewsBoard.drawSign(ui, g, now);
  };
  TitleScreen.prototype.mouseDown = function (ui, mx, my, b) {
    if (b === 0 && ui.hit(NewsBoard.hitRect(ui, this.game), mx, my)) { Sound.init && Sound.init(); NewsBoard.open(this.game, this, false); return; }
    return md.call(this, ui, mx, my, b);
  };
})();

// ---- the board, open ----
// fall 0.34 s, two bounces (0.17 s, 0.10 s), then it grows into the panel (0.22 s); closing: shrink, fly back up
const NEWS_T = { fall: 340, b1: 170, b2: 100, grow: 220, shrink: 120, fly: 260 };
NEWS_T.drop = NEWS_T.fall + NEWS_T.b1 + NEWS_T.b2;
const newsEase = (u) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
const newsEaseIO = (u) => { u = Math.min(1, Math.max(0, u)); return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; };
class NewsScreen extends MenuScreen {
  constructor(game, parent, opts = {}) {
    super(game, null); this.parent = parent || null; this.blurBg = false; this.bgDim = 0; this.auto = !!opts.auto;
    this.scroll = 0; this.rows = []; this.btns = []; this.contentH = 0; this.ver = -1; this.drag = null; this.del = null;
    this.msg = ''; this.msgT = 0; this.busy = false;
    const now = performance.now();
    this.t0 = now; this.phase = 'open'; this.openT = now; this.from = null; this.bits = [];
    if (typeof TitleScreen !== 'undefined' && parent instanceof TitleScreen && !NewsBoard.noAnim(game)) {
      const F = this.from = NewsBoard.pose(game.ui, now);
      this.phase = 'drop'; this.snd = 0;
      Sound.ev && Sound.ev('block.chain.break', null, 0.9, 1);
      // bits of chain flying off where the links broke
      for (const lx of [-F.w / 2 + 8, F.w / 2 - 9]) {
        const ly = F.chain / 2, X = F.px + lx * Math.cos(F.ang) - ly * Math.sin(F.ang), Y = F.py + lx * Math.sin(F.ang) + ly * Math.cos(F.ang);
        for (let i = 0; i < 4; i++) this.bits.push({ x: X, y: Y, vx: (Math.random() - 0.5) * 70 + Math.sign(lx) * 12, vy: -20 - Math.random() * 50 });
      }
    }
    // (seen from now on; the ones that were new keep their NEW mark while the board is open)
    this.seen0 = NewsBoard.seen(); NewsBoard.markSeen();
    if (NewsBoard.isSuper()) NewsBoard.fetchAdmin();
    if (!NewsBoard.lastFetch || now - NewsBoard.lastFetch > 20e3) NewsBoard.fetch();
  }
  panel() { const u = this.game.ui, w = Math.min(u.w - 12, 320), h = Math.min(u.h - 12, 400); return { x: Math.floor((u.w - w) / 2), y: Math.floor((u.h - h) / 2), w, h }; }
  area() { const p = this.panel(); return { x: p.x + 8, y: p.y + 28, w: p.w - 16, h: p.h - 36 }; }
  // how big the falling board gets
  boardK() { const F = this.from; return F ? Math.max(1, Math.min(2, this.panel().w * 0.4 / F.w)) : 1; }
  layout() {
    if (this.parent && this.parent.layout) this.parent.layout();
    const g = this.game, p = this.panel();
    // (×: hit 5 px round it - phones have no Esc, and a full-width panel leaves little to tap outside)
    this.widgets = [{ x: p.x + p.w - 22, y: p.y + 6, w: 16, h: 16, pad: 5, label: '×', onClick: () => this.back() }];
    let bx = p.x + 6;
    if (typeof CheckinScreen !== 'undefined' && typeof Checkin !== 'undefined' && Checkin.shown()) { this.widgets.push({ x: bx, y: p.y + 6, w: 56, h: 16, gold: true, label: '签到活动', onClick: () => g.ui.open(new CheckinScreen(g, this)) }); bx += 60; }
    if (NewsBoard.isSuper()) this.widgets.push({ x: bx, y: p.y + 6, w: 36, h: 16, label: '新建', onClick: () => g.ui.open(new NewsEditScreen(g, this, null)) });
    this.ver = -1; // (laid out again for the new width)
  }
  items() { return NewsBoard.sorted(NewsBoard.isSuper() && NewsBoard.adminList ? NewsBoard.adminList : NewsBoard.list); }
  // each announcement: title row, date row, the body wrapped to the width (its own line breaks kept)
  build() {
    this.ver = NewsBoard.ver; NewsBoard.markSeen();
    const W = this.area().w - 10;
    let y = 2; this.rows = [];
    for (const it of this.items()) {
      const lines = [];
      for (const para of String(it.body || '').split('\n')) { if (!para.trim()) lines.push(null); else lines.push(...NewsBoard.rich(para, W)); }
      const gh = it.gift && typeof Cosmetics !== 'undefined' && Cosmetics.info(it.gift) ? 32 : 0; // (the gift's row)
      const r = { it, y, lines, gh, h: 23 + gh + lines.length * 10 + 2 };
      this.rows.push(r); y += r.h + 8;
    }
    this.contentH = y;
    this.scroll = clamp(this.scroll, 0, this.maxScroll());
  }
  maxScroll() { return Math.max(0, this.contentH - this.area().h); }
  say(t, bad) { this.msg = t; this.msgBad = !!bad; this.msgT = performance.now(); }
  draw(ui) {
    const g = this.game, c = ui.ctx, now = performance.now(), N = NEWS_T;
    if (this.ver !== NewsBoard.ver) this.build();
    // the title screen behind, without hover on its buttons
    if (this.parent) {
      const mx = ui.mouse.x, my = ui.mouse.y; ui.mouse.x = -1000; ui.mouse.y = -1000;
      this.parent.draw(ui);
      ui.mouse.x = mx; ui.mouse.y = my;
      if (ui.screen === this.parent) ui.screen = this; // (the title's scene thumbnail swaps ui.screen while it renders)
    } else ui.dim(0.5);
    const p = this.panel(), F = this.from, K = this.boardK(), cx = ui.w / 2, cy = ui.h / 2;
    if (this.phase === 'drop') {
      const t = now - this.t0;
      if (t >= N.drop + N.grow) { this.phase = 'open'; this.openT = now; }
      else {
        ui.dim(0.5 * Math.min(1, t / N.drop));
        if (t < N.drop) {
          let x = cx, y = cy, ang = 0, k = K;
          if (t < N.fall) {
            const u = t / N.fall;
            x = F.cx + (cx - F.cx) * (1 - (1 - u) * (1 - u)); y = F.cy + (cy - F.cy) * u * u; k = 1 + (K - 1) * u; ang = F.ang + (0.16 - F.ang) * u;
          } else if (t < N.fall + N.b1) {
            const u = (t - N.fall) / N.b1, H = Math.min(26, Math.max(0, cy - F.cy) * 0.22);
            y = cy - H * 4 * u * (1 - u); ang = 0.16 - 0.22 * u;
            if (this.snd < 1) { this.snd = 1; Sound.ev && Sound.ev('block.wood.fall', null, 1, 1); }
          } else {
            const u = (t - N.fall - N.b1) / N.b2, H = Math.min(8, Math.max(0, cy - F.cy) * 0.07);
            y = cy - H * 4 * u * (1 - u); ang = -0.06 * (1 - u);
            if (this.snd < 2) { this.snd = 2; Sound.ev && Sound.ev('block.wood.fall', null, 0.5, 1.15); }
          }
          // the broken chains: what stays up there fades, a piece falls with the board, bits fly off
          if (F.chain > 3 && t < 400) {
            c.save(); c.globalAlpha = 1 - t / 400; c.translate(F.px, F.py); c.rotate(F.ang);
            NewsBoard.chain(c, -F.w / 2 + 8, 0, F.chain / 2); NewsBoard.chain(c, F.w / 2 - 9, 0, F.chain / 2);
            c.restore();
          }
          if (t < 500) {
            const s = t / 1000; c.globalAlpha = 1 - t / 500; c.fillStyle = '#A9B1C1';
            for (const b of this.bits) c.fillRect(b.x + b.vx * s, b.y + b.vy * s + 200 * s * s, 1, 1);
            c.globalAlpha = 1;
          }
          NewsBoard.drawBoard(ui, g, { cx: x, cy: y, w: F.w, h: F.h, ang, k, chain: F.chain > 3 ? Math.min(8, F.chain / 2) : 0, chainA: Math.max(0, 1 - t / N.fall) });
        } else {
          // growing into the panel
          const u = newsEase((t - N.drop) / N.grow), bw = F.w * K, bh = F.h * K;
          const r = { x: cx - bw / 2 + (p.x - (cx - bw / 2)) * u, y: cy - bh / 2 + (p.y - (cy - bh / 2)) * u, w: bw + (p.w - bw) * u, h: bh + (p.h - bh) * u };
          this.drawPanel(ui, r, K + (1 - K) * u);
          const ts = F.w >= 44 && F.h >= 26 ? 2 : 1; // (as drawBoard: the narrow board's label is drawn at 1)
          c.save(); c.globalAlpha = 1 - u; c.translate(r.x + r.w / 2, r.y + r.h / 2); c.scale(ts * K, ts * K); Font.center(c, '公告', 0, -4, '#FFF0C8'); c.restore();
        }
        return;
      }
    }
    if (this.phase === 'close') {
      const t = now - this.tc, P = NewsBoard.pose(ui, now), bw = F.w * K, bh = F.h * K;
      if (t >= N.shrink + N.fly) { Sound.ev && Sound.ev('block.chain.place', null, 0.7, 1); this.finish(); return; }
      if (t < N.shrink) {
        const u = newsEase(t / N.shrink);
        ui.dim(0.5);
        const r = { x: p.x + (cx - bw / 2 - p.x) * u, y: p.y + (cy - bh / 2 - p.y) * u, w: p.w + (bw - p.w) * u, h: p.h + (bh - p.h) * u };
        this.drawPanel(ui, r, 1 + (K - 1) * u);
      } else {
        const u = newsEaseIO((t - N.shrink) / N.fly);
        ui.dim(0.5 * (1 - u));
        NewsBoard.drawBoard(ui, g, { cx: cx + (P.cx - cx) * u, cy: cy + (P.cy - cy) * u, w: F.w, h: F.h, ang: P.ang * u, k: K + (1 - K) * u, chain: u > 0.6 ? P.chain : 0, chainA: (u - 0.6) / 0.4 });
      }
      return;
    }
    // open
    ui.dim(0.5);
    this.drawPanel(ui, p, 1);
    const ca = Math.min(1, (now - this.openT) / 150);
    c.save(); c.globalAlpha = ca;
    Font.center(c, '公告', p.x + p.w / 2, p.y + 10, '#FFF0C8');
    this.drawList(ui, ca >= 1);
    for (const w of this.widgets) ui.button(w);
    c.restore();
    if (ca >= 1) for (const w of this.widgets) if (w.tip && ui.hit(w)) ui.tooltip(w.tip.map((t) => ({ text: t })), ui.mouse.x, ui.mouse.y);
  }
  // the board's planks at rect r (ts: how big the planks are drawn), dark border
  drawPanel(ui, r, ts = 1) {
    const c = ui.ctx, wood = NewsBoard.woodTex(this.game);
    if (wood) c.drawImage(wood, 0, 0, Math.min(640, r.w / ts), Math.min(480, r.h / ts), r.x, r.y, r.w, r.h); else { c.fillStyle = '#3B2614'; c.fillRect(r.x, r.y, r.w, r.h); }
    c.strokeStyle = '#140A04'; c.lineWidth = 2; c.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    c.strokeStyle = 'rgba(0,0,0,0.32)'; c.lineWidth = 1; c.strokeRect(r.x + 2.5, r.y + 2.5, r.w - 5, r.h - 5);
    c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(r.x + 3, r.y + 3, r.w - 6, 1);
  }
  drawList(ui, live) {
    const c = ui.ctx, a = this.area(), sup = NewsBoard.isSuper(), now = performance.now();
    this.btns = [];
    c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(a.x, a.y, a.w, a.h);
    c.save(); c.beginPath(); c.rect(a.x, a.y, a.w, a.h); c.clip();
    const x0 = a.x + 4, W = a.w - 10;
    if (!this.rows.length) {
      Font.center(c, NewsBoard.loading ? '正在读取公告…' : '还没有公告', a.x + a.w / 2, a.y + a.h / 2 - 8, '#A0A0A0');
      if (!NewsBoard.loading && NewsBoard.err && !NewsBoard.list) Font.center(c, fitText(NewsBoard.err, a.w - 8), a.x + a.w / 2, a.y + a.h / 2 + 6, '#FF8080');
    }
    for (const r of this.rows) {
      const y = Math.round(a.y + r.y - this.scroll), it = r.it;
      if (y > a.y + a.h || y + r.h + 4 < a.y) continue;
      const isNew = !it.draft && (it.at || 0) > this.seen0, tag = it.draft ? '草稿' : isNew ? 'NEW' : '';
      const right = x0 + W, tw = tag ? Font.width(tag) + 6 : 0;
      let x = x0;
      if (it.pin) x = Font.draw(c, '[置顶]', x, y, '#FFAA00') + 3;
      if (it.imp) x = Font.draw(c, '[重要]', x, y, '#FF5555') + 3;
      Font.draw(c, fitText(it.title || '', Math.max(12, right - tw - x)), x, y, '#FFFF55');
      if (tag) Font.draw(c, tag, right - Font.width(tag), y, it.draft ? '#A0A0A0' : '#55FF55');
      Font.draw(c, NewsBoard.date(it.at) + (it.draft ? '（未发布）' : ''), x0, y + 11, '#A0A0A0');
      // super administrators: publish / edit / delete on the date row (delete asks once more)
      if (sup && live) {
        let bx = x0 + W;
        const add = (label, act) => { const w = Font.width(label) + 10; bx -= w; const b = { x: bx, y: y + 9, w, h: 12, label, act, enabled: !this.busy }; ui.button(b); this.btns.push(b); bx -= 3; };
        const asking = this.del && this.del.id === it.id && now - this.del.t < 4000;
        add(asking ? '确定删除？' : '删除', () => this.remove(it));
        add('编辑', () => this.game.ui.open(new NewsEditScreen(this.game, this, it)));
        if (it.draft) add('发布', () => this.publish(it));
      }
      if (r.gh) this.drawGift(ui, it, x0, y + 22, W, live);
      let ly = y + 23 + r.gh;
      // (bold: gold, drawn twice half a pixel apart)
      for (const l of r.lines) {
        let lx = x0;
        if (l) for (const run of l) { if (run.b) Font.draw(c, run.t, lx + 0.5, ly, '#FFD24A'); lx = Font.draw(c, run.t, lx, ly, run.b ? '#FFD24A' : '#E8E8E8'); }
        ly += 10;
      }
      const sy = y + r.h + 3;
      c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x0, sy, W, 1); c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(x0, sy + 1, W, 1);
    }
    c.restore();
    const max = this.maxScroll();
    if (max > 0) {
      const th = Math.max(10, Math.floor(a.h * a.h / this.contentH)), ty = a.y + Math.round((a.h - th) * this.scroll / max);
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(a.x + a.w - 3, a.y, 2, a.h);
      c.fillStyle = '#C0B090'; c.fillRect(a.x + a.w - 3, ty, 2, th);
    }
    if (this.msg && now - this.msgT < 4000) {
      c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(a.x, a.y + a.h - 12, a.w, 12);
      Font.center(c, fitText(this.msg, a.w - 8), a.x + a.w / 2, a.y + a.h - 10, this.msgBad ? '#FF6060' : '#FFFFFF');
    }
  }
  // an announcement's gift, a row of its own under the date: the decoration large in a slot, its name, a button. Not
  // taken yet: the slot glows and has a red ! (the user, 2026-11-02) and the button takes it with one tap; taken: to
  // the wardrobe
  drawGift(ui, it, x, y, W, live) {
    const c = ui.ctx, own = Cosmetics.has(it.gift), can = !own && !it.draft, S = 28;
    const pulse = can ? 0.55 + 0.45 * Math.sin(performance.now() / 1000 * Math.PI * 2 / 1.4) : 0;
    if (can) { c.lineWidth = 1; for (let i = 3; i >= 1; i--) { c.strokeStyle = `rgba(255,196,64,${(pulse * 0.6 * (4 - i) / 3).toFixed(3)})`; c.strokeRect(x - i + 0.5, y - i + 0.5, S + 2 * i - 1, S + 2 * i - 1); } }
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x, y, S, S);
    if (can) { c.fillStyle = `rgba(255,210,100,${(0.12 + pulse * 0.16).toFixed(3)})`; c.fillRect(x, y, S, S); }
    c.strokeStyle = can ? '#E8B830' : '#555555'; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, S - 1, S - 1);
    Cosmetics.drawIcon(c, it.gift, x + 2, y + 2, S - 4, false);
    if (can) {
      const bx = x + S - 6, by = y - 4;
      c.fillStyle = '#6E0000'; c.fillRect(bx, by + 1, 10, 9); c.fillRect(bx + 1, by, 8, 11);
      c.fillStyle = '#E8262B'; c.fillRect(bx + 1, by + 1, 8, 9);
      Font.draw(c, '!', bx + Math.round((10 - Font.width('!')) / 2), by + 2, '#FFFFFF', false);
    }
    const label = this.busy === it.id ? '领取中…' : own ? '去穿戴' : '领取', w = Math.max(48, Font.width(label) + 16), tw = W - S - 8 - w - 6;
    Font.draw(c, fitText('礼物：' + Cosmetics.name(it.gift), tw), x + S + 8, y + 4, '#FFD24A');
    Font.draw(c, fitText(it.draft ? '发布以后玩家才能领取' : own ? '已领取，在「皮肤和装饰」里穿上' : '点「领取」马上到账，永久保留', tw), x + S + 8, y + 16, '#A0A0A0');
    const b = { x: x + W - w, y: y + 5, w, h: 18, label, gold: !own, enabled: live && !this.busy, act: () => this.takeGift(it) };
    if (live) { ui.button(b); this.btns.push(b); }
  }
  mouseDown(ui, mx, my, b) {
    if (b !== 0) return;
    // a tap while it falls: straight to the open board
    if (this.phase === 'drop') { this.t0 = performance.now() - NEWS_T.drop - NEWS_T.grow; this.snd = 2; return; }
    if (this.phase !== 'open') return;
    for (const w of this.widgets) {
      const m = w.pad || 0;
      if (w.enabled !== false && ui.hit(m ? { x: w.x - m, y: w.y - m, w: w.w + 2 * m, h: w.h + 2 * m } : w, mx, my)) { Sound.init && Sound.init(); Sound.click(); w.onClick(); return; }
    }
    const a = this.area();
    if (ui.hit(a, mx, my)) {
      for (const bt of this.btns) if (bt.enabled !== false && ui.hit(bt, mx, my)) { Sound.click(); bt.act(); return; }
      this.drag = { y: my, s: this.scroll }; // (a mouse drags the list; a finger scrolls it through wheel(), touch.js)
      return;
    }
    if (!ui.hit(this.panel(), mx, my)) this.back();
  }
  mouseMove(ui, mx, my) { if (this.drag && ui.mouse.down) this.scroll = clamp(this.drag.s - (my - this.drag.y), 0, this.maxScroll()); }
  mouseUp() { this.drag = null; }
  wheel(ui, dy) { if (this.phase === 'open') this.scroll = clamp(this.scroll + Math.sign(dy) * 20, 0, this.maxScroll()); }
  onEsc() { this.back(); }
  // closing: the board flies back up and hangs on its chains again (straight away while it is still falling)
  back() {
    if (this.phase === 'close') return;
    if (this.from && this.phase === 'open') { this.phase = 'close'; this.tc = performance.now(); this.drag = null; return; }
    this.finish();
  }
  finish() {
    const g = this.game;
    if (this.parent) g.ui.open(this.parent); else if (g.state === 'play') g.ui.close(); else g.ui.open(new TitleScreen(g));
  }
  // an announcement's gift: logged out - log in first, then back here; taken - to the wardrobe on its tab
  async takeGift(it) {
    const g = this.game;
    if (it.draft) { this.say('发布以后玩家才能领取'); return; }
    if (Cosmetics.has(it.gift)) { Cosmetics.openWardrobe(g, this, it.gift); return; }
    if (!Account.loggedIn) {
      if (typeof LoginScreen !== 'undefined') g.ui.open(new LoginScreen(g, () => { g.ui.open(this); this.takeGift(it); }, () => g.ui.open(this)));
      return;
    }
    if (this.busy) return;
    this.busy = it.id;
    try {
      const r = await Account.api('/api/account/gift', { id: it.id });
      if (r.account) Account.took({ account: r.account });
      Sound.ev && Sound.ev('entity.player.levelup', null, 0.8, 1);
      if (typeof Telemetry !== 'undefined' && Telemetry.count) Telemetry.count('news_gift');
      this.say(`领到了${Cosmetics.name(r.gift) || '礼物'}！点「去穿戴」穿上`);
    } catch (e) { this.say(e.message, true); }
    this.busy = false;
  }
  async publish(it) {
    if (this.busy) return;
    this.busy = true; this.say('正在发布…');
    try {
      const r = await Account.api('/api/account/news/save', { id: it.id, title: it.title, body: it.body, pin: !!it.pin, imp: !!it.imp, publish: true });
      if (r.list) NewsBoard.adminList = r.list;
      NewsBoard.ver++;
      if (typeof Telemetry !== 'undefined' && Telemetry.count) Telemetry.count('news_publish');
      this.say('已发布');
      NewsBoard.fetch(true);
    } catch (e) { this.say(e.message, true); }
    this.busy = false;
  }
  async remove(it) {
    const now = performance.now();
    if (!this.del || this.del.id !== it.id || now - this.del.t > 4000) { this.del = { id: it.id, t: now }; return; }
    this.del = null;
    if (this.busy) return;
    this.busy = true; this.say('正在删除…');
    try {
      const r = await Account.api('/api/account/news/delete', { id: it.id });
      NewsBoard.adminList = r.list || []; NewsBoard.ver++;
      this.say('已删除');
      NewsBoard.fetch(true);
    } catch (e) { this.say(e.message, true); }
    this.busy = false;
  }
}

// ---- writing one (super administrators) ----
// pasting into the body: main.js's window capture handlers take the right-click / long-press menu away from all but
// its own field (and send the presses to the screen), so the text box's events stop here first - this file loads
// before window.onload binds those
for (const t of ['contextmenu', 'mousedown']) window.addEventListener(t, (e) => { if (e.target && e.target.classList && e.target.classList.contains('news-ta')) e.stopImmediatePropagation(); }, true);
// the title in the game's own text field; the body in a real multi-line text box laid over the canvas (the game's
// field is one line), removed when the screen closes
class NewsEditScreen extends FormScreen {
  constructor(game, parent, item) {
    super(game, item ? '编辑公告' : '新建公告', parent);
    this.titleY = 8; this.item = item || null;
    this.ttl = item ? item.title || '' : ''; this.body = item ? item.body || '' : '';
    this.pin = !!(item && item.pin); this.imp = !!(item && item.imp); this.gift = (item && item.gift) || null;
    this.busy = false; this.msg = ''; this.msgBad = false; this.ta = null; this.checks = []; this.first = true;
  }
  live() { return !!(this.item && !this.item.draft); }
  layout() {
    const u = this.game.ui, cx = u.w / 2, fw = Math.min(u.w - 16, 320), fx = Math.floor(cx - fw / 2);
    this.fields = {}; this.addField('ttl', fx, 30, fw, '标题（30 字以内）', 30);
    const ay = 66, ah = Math.max(36, u.h - ay - 60);
    this.box = { x: fx, y: ay, w: fw, h: ah };
    this.checks = [{ x: fx, y: ay + ah + 5, w: 50, h: 12, k: 'pin', label: '置顶' }, { x: fx + 58, y: ay + ah + 5, w: 50, h: 12, k: 'imp', label: '重要' }];
    // a published one: saved as it is (no one is told again), or published again as new
    const by = u.h - 24, bw = Math.floor((fw - 8) / 3), live = this.live();
    // the gift (cosmetics.js): none, or one of the decorations - each tap the next
    const gifts = [null, ...(typeof Cosmetics !== 'undefined' ? Cosmetics.LIST.map((d) => d.id) : [])];
    this.giftBtn = { x: fx + fw - 120, y: ay + ah + 4, w: 120, h: 14, label: () => '礼物：' + (this.gift ? Cosmetics.name(this.gift) : '无'),
      tip: ['玩家在这条公告右上角点「领取」就拿到', '再点一下换下一件'], onClick: () => { this.gift = gifts[(gifts.indexOf(this.gift) + 1) % gifts.length]; } };
    this.widgets = [
      this.giftBtn,
      { x: fx, y: by, w: bw, h: 20, label: live ? '保存修改' : '保存草稿', enabled: !this.busy, tip: live ? ['改了以后照样显示，不算新公告'] : ['只有超级管理员看得到'], onClick: () => this.save(live ? {} : { draft: true }) },
      { x: fx + bw + 4, y: by, w: bw, h: 20, gold: true, label: live ? '重新发布' : '发布', enabled: !this.busy, tip: ['所有玩家都看得到，时间算现在，没看过的玩家牌子上会有提醒'], onClick: () => this.save({ publish: true }) },
      { x: fx + 2 * (bw + 4), y: by, w: fw - 2 * (bw + 4), h: 20, label: '取消', onClick: () => this.back() },
    ];
    this.place();
    // (resized - the phone's keyboard coming up: the title field moves along, without taking the focus back)
    if (this.field && u.inputBox) {
      const b = this.fields[this.field], s = u.scale / u.dpr, el = u.input;
      u.inputBox.x = b.x + 4; u.inputBox.y = b.y + 6;
      el.style.left = ((b.x + 4) * s) + 'px'; el.style.top = ((b.y + 6) * s) + 'px'; el.style.width = ((b.w - 8) * s) + 'px';
    }
    if (this.first) { this.first = false; if (!this.item) this.focus('ttl'); }
  }
  place() {
    const u = this.game.ui, b = this.box, s = u.scale / u.dpr;
    let ta = this.ta;
    if (!ta) {
      const touch = navigator.maxTouchPoints > 0;
      ta = this.ta = document.createElement('textarea');
      ta.maxLength = 1000; ta.value = this.body; ta.placeholder = '正文（换行就是分段）'; ta.spellcheck = false; ta.setAttribute('autocomplete', 'off');
      // (16px on touch screens: iPhones zoom the page in on a smaller field; the page itself turns selection and
      // touch scrolling off, the box turns them back on)
      Object.assign(ta.style, {
        position: 'absolute', zIndex: '6', boxSizing: 'border-box', margin: '0', padding: '6px 8px', resize: 'none',
        background: 'rgba(0,0,0,0.85)', color: '#F0F0F0', border: '2px solid #A0A0A0', borderRadius: '0', outline: 'none',
        font: (touch ? 16 : 14) + 'px/1.45 "Microsoft YaHei", "PingFang SC", sans-serif', userSelect: 'text', webkitUserSelect: 'text',
        touchAction: 'auto', overflowY: 'auto', whiteSpace: 'pre-wrap', webkitTouchCallout: 'default',
      });
      ta.className = 'news-ta'; // (main.js's menu blocker lets it be: below)
      // the game's own handlers stay out of it (touch.js would swallow the taps, main.js the keys)
      const stop = (e) => e.stopPropagation();
      for (const ev of ['mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel', 'keyup']) ta.addEventListener(ev, stop, { passive: true });
      ta.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); ta.blur(); } });
      ta.addEventListener('input', () => { this.body = ta.value; });
      ta.addEventListener('focus', () => { ta.style.borderColor = '#FFFFFF'; const gu = this.game.ui; if (gu.inputBox) { this.field = null; gu.hideInput(); } });
      ta.addEventListener('blur', () => { ta.style.borderColor = '#A0A0A0'; });
      document.body.appendChild(ta);
    }
    Object.assign(ta.style, { left: (b.x * s) + 'px', top: (b.y * s) + 'px', width: (b.w * s) + 'px', height: (b.h * s) + 'px' });
  }
  close() { if (this.ta) { this.ta.remove(); this.ta = null; } }
  submit() { if (this.ta) this.ta.focus(); } // (Enter in the title: on to the body)
  drawExtra(ui) {
    const c = ui.ctx, b = this.box, body = this.ta ? this.ta.value : this.body;
    this.drawFields(ui);
    Font.draw(c, fitText(`正文（可以分段，**两边加两个星号**是加粗，${body.length}/1000）`, b.w), b.x, b.y - 11, '#A0A0A0');
    c.fillStyle = '#000'; c.fillRect(b.x, b.y, b.w, b.h); // (behind the text box)
    for (const k of this.checks) {
      const hov = ui.hit(k);
      c.fillStyle = '#000'; c.fillRect(k.x, k.y, 12, 12);
      c.strokeStyle = hov ? '#FFFFFF' : '#A0A0A0'; c.lineWidth = 1; c.strokeRect(k.x + 0.5, k.y + 0.5, 11, 11);
      if (this[k.k]) { if (typeof drawIcon === 'function') drawIcon(c, 'check', k.x + 2, k.y + 2, 1, '#55FF55'); else Font.draw(c, '✓', k.x + 3, k.y + 2, '#55FF55'); }
      Font.draw(c, k.label, k.x + 16, k.y + 2, '#FFFFFF');
    }
    const k1 = this.checks[1], hx = k1.x + k1.w + 6;
    if (this.giftBtn.x - 4 - hx > 40) Font.draw(c, fitText('重要：玩家第一次看到时自动掉下来', this.giftBtn.x - 4 - hx), hx, k1.y + 2, '#808080');
    // a line of how it will look in the list, or what the last save said
    const py = this.checks[0].y + 16;
    if (this.msg) { Font.draw(c, fitText(this.msg, b.w), b.x, py, this.msgBad ? '#FF6060' : '#A0A0A0'); return; }
    let x = Font.draw(c, '预览：', b.x, py, '#A0A0A0');
    if (this.pin) x = Font.draw(c, '[置顶]', x, py, '#FFAA00') + 3;
    if (this.imp) x = Font.draw(c, '[重要]', x, py, '#FF5555') + 3;
    x = Font.draw(c, fitText(String(this.ttl || '').trim() || '（还没有标题）', Math.max(20, (b.x + b.w - x) * 0.5)), x, py, '#FFFF55') + 6;
    const first = NewsBoard.plain(body.split('\n').find((l) => l.trim()) || '');
    if (first && b.x + b.w - x > 20) Font.draw(c, fitText(first.trim(), b.x + b.w - x), x, py, '#E0E0E0');
  }
  mouseDown(ui, mx, my, b) {
    if (b === 0) for (const k of this.checks) if (ui.hit({ x: k.x - 2, y: k.y - 4, w: k.w + 4, h: k.h + 8 }, mx, my)) { Sound.click(); this[k.k] = !this[k.k]; return; }
    super.mouseDown(ui, mx, my, b);
  }
  say(t, bad) { this.msg = t; this.msgBad = !!bad; }
  async save(opt) {
    if (this.busy) return;
    const body = this.ta ? this.ta.value : this.body, title = String(this.ttl || '').trim();
    if (!title) { this.say('标题是空的', true); return; }
    if (!body.trim()) { this.say('正文是空的', true); return; }
    this.busy = true; this.say(opt.publish ? '正在发布…' : '正在保存…'); this.layout();
    try {
      const r = await Account.api('/api/account/news/save', { id: this.item ? this.item.id : undefined, title, body, pin: this.pin, imp: this.imp, gift: this.gift, ...opt });
      if (r.list) NewsBoard.adminList = r.list;
      NewsBoard.ver++;
      if (opt.publish && typeof Telemetry !== 'undefined' && Telemetry.count) Telemetry.count('news_publish');
      NewsBoard.fetch(true);
      if (this.parent instanceof NewsScreen) this.parent.say(opt.publish ? '已发布' : '已保存');
      this.busy = false;
      if (this.game.ui.screen === this) this.back();
      return;
    } catch (e) { this.say(e.message, true); }
    this.busy = false;
    if (this.game.ui.screen === this) this.layout();
  }
}
