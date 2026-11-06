'use strict';
// ---------------------------------------------------------------------------
// The first time the game opens (game/UX_IDEAS.md「第一次进入的引导」): picture quality and shaders on big cards
// over the live title world (the device detected, a few seconds measured, the best fit recommended), which device
// (a phone goes on to the touch layout editor), logging in, and the "what is different here" overview. Phase 1
// removed the first-run user agreement and the player-kind choice; new worlds start without the tutorial.
// ---------------------------------------------------------------------------
// ---- step 2: quality and shaders, on the live title world ----
const QUALITY_CARDS = [
  { id: 'low', name: '流畅', sub: '近处清楚、远处少', cost: 0.45 },
  { id: 'medium', name: '均衡', sub: '大多数设备', cost: 0.65 },
  { id: 'high', name: '高', sub: '看得更远', cost: 1 },
  { id: 'ultra', name: '极致', sub: '最远视距', cost: 1.6 },
];
const SHADER_CARDS = [
  { lv: 0, name: '关闭', sub: '原版画面', cost: 1 },
  { lv: 1, name: '柔和', sub: '轻微阴影和雾', cost: 1.25 },
  { lv: 2, name: '原版光影', sub: '阴影、水面反射', cost: 1.6 },
  { lv: 3, name: '增强', sub: '更强的光影效果', cost: 2.2 },
  { lv: 4, name: '极限', sub: '体积光，最吃显卡', cost: 3 },
];
class QualityScreen extends MenuScreen {
  constructor(game, next) {
    super(game, null); this.next = next; this.pauses = false; this.blurBg = false; this.bgDim = 0;
    this.phase = 'detect'; this.t0 = performance.now(); this.rec = null;
    const g = game, gl = g.renderer.gl;
    this.hw = { gpu: PerfMon.gpuName(gl) || '未知显卡', cores: navigator.hardwareConcurrency || 0, mem: navigator.deviceMemory || 0, phone: TouchDevice.kind === 'phone' || TouchDevice.kind === 'tablet' };
    this.q = g.settings.preset && QUALITY_CARDS.some((c) => c.id === g.settings.preset) ? g.settings.preset : detectPreset(gl);
    // (a level the cards don't have - an older setting - becomes the nearest one)
    this.sh = Math.max(0, Math.min(SHADER_CARDS.length - 1, Math.round(g.settings.shaders) || 0));
    applyPreset(g, this.q); g.applySettings();
    this.fxOk = !!(g.renderer.fx && g.renderer.fx.ok);
    this.startBench();
  }
  get hz() { const p = this.game.pacer; return p && p.refresh ? Math.round(1000 / p.refresh) : 60; }
  // the measurement: how long the device really works on a frame of the live world, for each shader level in
  // turn. Not the time between frames - with VSync that is only the display's rate, whatever the card could do;
  // reading a pixel back after the frame waits until the graphics card has finished it
  startBench() {
    const g = this.game, gl = g.renderer.gl, px = new Uint8Array(4), self = this;
    this.levels = this.fxOk && !this.hw.phone ? SHADER_CARDS.map((c) => c.lv) : [0];
    this.li = 0; this.got = []; this.skip = 6; this.ms = {}; this.lt0 = performance.now();
    this.setLevel(this.levels[0]);
    const own = Object.prototype.hasOwnProperty.call(g, 'render') ? g.render : null, orig = g.render;
    g.render = function (...a) {
      const t = performance.now(), r = orig.apply(this, a);
      if (self.phase === 'detect' && !document.hidden) { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); self.sample(performance.now() - t); }
      return r;
    };
    this.unhook = () => { if (own) g.render = own; else delete g.render; this.unhook = null; };
  }
  setLevel(lv) { const g = this.game; g.settings.shaders = lv; g.applySettings(); }
  sample(ms) {
    // (the first frames after a change build the shaders; a stall says nothing about the device)
    if (this.skip > 0) { this.skip--; return; }
    if (ms < 250) this.got.push(ms);
    if (this.got.length < 24 && performance.now() - this.lt0 < 1200) return;
    const v = this.got.sort((a, b) => a - b);
    if (v.length >= 5) this.ms[this.levels[this.li]] = v[Math.floor(v.length / 2)];
    if (++this.li < this.levels.length) { this.got = []; this.skip = 6; this.lt0 = performance.now(); this.setLevel(this.levels[this.li]); }
    else this.finish();
  }
  tick() {
    // (a page in the background draws nothing: after 12 s it goes on with what it has)
    if (this.phase === 'detect' && performance.now() - this.t0 > 12000) this.finish();
  }
  finish() {
    if (this.phase !== 'detect') return;
    this.unhook && this.unhook();
    const s = this.game.settings;
    // a level that could not be measured: from the measured ones by the cards' rough cost (nothing measured: a guess
    // from the hardware)
    const m0 = this.ms[0] || (this.q === 'low' ? 12 : this.q === 'medium' ? 8 : 5);
    for (const c of SHADER_CARDS) if (!this.ms[c.lv]) this.ms[c.lv] = m0 * c.cost;
    this.base = { ms: this.ms, rd: s.renderDist || 8, res: s.resScale || 1 };
    // recommended: the best pair still at least ~55 fps (or the display's rate if lower), shaders only on capable devices
    const goal = Math.min(55, this.hz * 0.9);
    let best = { q: 'low', sh: 0 };
    for (const qc of QUALITY_CARDS) for (const sc of SHADER_CARDS) {
      if (sc.lv && (!this.fxOk || this.hw.phone)) continue;
      if (this.estimate(qc, sc) >= goal && qc.cost * sc.cost >= QUALITY_CARDS.find((x) => x.id === best.q).cost * SHADER_CARDS[best.sh].cost) best = { q: qc.id, sh: sc.lv };
    }
    this.rec = best; this.q = best.q; this.sh = best.sh; this.apply();
    this.phase = 'pick';
    if (this.game.ui.screen === this) this.layout();
  }
  // a pair's frame rate from the measured times: the world without shaders grows with the chunks in view (the
  // render distance squared) and the pixels; what the shaders add grows with the pixels and, for the shadows, the
  // chunks. In a game the world's own work comes on top (a margin and a millisecond); never above the display's rate
  estimate(qc, sc) {
    const b = this.base; if (!b) return 0;
    const p = PRESETS[qc.id] || {}, rdR = ((p.renderDist || b.rd) / b.rd) ** 2, pxR = ((p.resScale || 1) / b.res) ** 2;
    const m0 = b.ms[0], extra = Math.max(0, (b.ms[sc.lv] || m0 * sc.cost) - m0);
    const ms = m0 * (0.6 * rdR + 0.4 * pxR) + extra * (0.5 * rdR + 0.5 * pxR);
    return Math.min(this.hz, Math.round(1000 / (ms * 1.15 + 1)));
  }
  apply() {
    const g = this.game, s = g.settings;
    applyPreset(g, this.q); s.shaders = this.fxOk ? this.sh : 0;
    g.applySettings(); g.saveSettings();
  }
  cardRects() {
    // (both rows as wide as the longer one; each row centred)
    const u = this.game.ui, n = Math.max(QUALITY_CARDS.length, SHADER_CARDS.length), w = Math.min(90, Math.floor((u.w - 20) / n) - 4), h = 36;
    const x0 = (k) => Math.floor(u.w / 2 - (k * w + (k - 1) * 4) / 2);
    const y1 = u.h - 2 * h - 54, y2 = y1 + h + 14;
    return {
      q: QUALITY_CARDS.map((c, i) => ({ ...c, x: x0(QUALITY_CARDS.length) + i * (w + 4), y: y1, w, h })),
      s: SHADER_CARDS.map((c, i) => ({ ...c, x: x0(SHADER_CARDS.length) + i * (w + 4), y: y2, w, h })),
    };
  }
  layout() {
    const u = this.game.ui, cx = u.w / 2, R = this.cardRects();
    this.widgets = [];
    if (this.phase !== 'pick') return;
    for (const c of R.q) this.widgets.push({ x: c.x, y: c.y, w: c.w, h: c.h, label: '', card: c, kind: 'q', onClick: () => { this.q = c.id; this.apply(); } });
    for (const c of R.s) this.widgets.push({ x: c.x, y: c.y, w: c.w, h: c.h, label: '', card: c, kind: 's', enabled: this.fxOk || c.lv === 0, onClick: () => { this.sh = c.lv; this.apply(); } });
    const rates = [60, 90, 120].filter((r) => r <= this.hz + 5);
    if (this.hw.phone && rates.length > 1) this.widgets.push({ x: cx - 152, y: u.h - 24, w: 98, h: 20, label: () => '帧率：' + (this.game.settings.maxFps || this.hz), tip: ['越高越流畅，但更耗电、手机更热'], onClick: () => { const s = this.game.settings, i = rates.indexOf(s.maxFps || this.hz); s.maxFps = rates[(i + 1) % rates.length]; this.game.saveSettings(); } });
    this.widgets.push({ x: cx + 54, y: u.h - 24, w: 98, h: 20, gold: true, label: '就这样', onClick: () => { const n = this.next; this.next = null; n && n(); } });
  }
  draw(ui) {
    this.tick();
    const c = ui.ctx, cx = ui.w / 2, R = this.cardRects();
    // the top: what was found
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, 0, ui.w, 42);
    Font.center(c, '选择画质和光影（上面就是实时画面）', cx, 4, '#FFFFFF');
    const hw = this.hw, info = `${hw.gpu.replace(/^ANGLE \(|\)$/g, '').slice(0, 48)}${hw.cores ? ' · ' + hw.cores + ' 线程' : ''}${hw.mem ? ' · ' + hw.mem + ' GB 内存' : ''}`;
    if (this.phase === 'detect') {
      const lv = this.levels[this.li], what = this.levels.length > 1 && lv !== undefined ? `（光影「${SHADER_CARDS[lv].name}」）` : '';
      Font.center(c, fitText('正在测试你的设备' + what + '… ' + info, ui.w - 8), cx, 18, '#A0A0A0');
      const f = Math.min(1, (this.li + Math.min(1, this.got.length / 24)) / this.levels.length);
      c.fillStyle = '#555555'; c.fillRect(cx - 80, 29, 160, 2); c.fillStyle = '#80FF80'; c.fillRect(cx - 80, 29, Math.round(160 * f), 2);
    } else {
      Font.center(c, fitText('检测到：' + info, ui.w - 8), cx, 16, '#A0A0A0');
      Font.center(c, `推荐：${QUALITY_CARDS.find((q) => q.id === this.rec.q).name}画质 + ${SHADER_CARDS[this.rec.sh].name}光影（已经帮你选好）`, cx, 28, '#80FF80');
    }
    // the bottom: the cards
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, R.q[0].y - 14, ui.w, ui.h - R.q[0].y + 14);
    if (this.phase === 'pick') {
      Font.draw(c, '画质', R.q[0].x, R.q[0].y - 11, '#FFFFFF'); Font.draw(c, '光影', R.s[0].x, R.s[0].y - 11, '#FFFFFF');
      for (const w of this.widgets) {
        if (!w.card) continue;
        const k = w.card, sel = w.kind === 'q' ? this.q === k.id : this.sh === k.lv, rec = w.kind === 'q' ? this.rec.q === k.id : this.rec.sh === k.lv, off = w.enabled === false;
        c.fillStyle = sel ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.5)'; c.fillRect(k.x, k.y, k.w, k.h);
        c.strokeStyle = sel ? '#FFFFFF' : ui.hit(w) ? '#A0A0A0' : '#555555'; c.lineWidth = sel ? 2 : 1; c.strokeRect(k.x + 0.5, k.y + 0.5, k.w - 1, k.h - 1);
        Font.draw(c, k.name, k.x + 4, k.y + 4, off ? '#707070' : '#FFFFFF');
        Font.draw(c, fitText(off ? '设备不支持' : k.sub, k.w - 8), k.x + 4, k.y + 15, '#A0A0A0');
        if (!off) { const e = w.kind === 'q' ? this.estimate(k, SHADER_CARDS[this.sh]) : this.estimate(QUALITY_CARDS.find((q) => q.id === this.q), k); Font.draw(c, `预计 ${e} 帧`, k.x + 4, k.y + 26, e >= 55 ? '#80FF80' : e >= 30 ? '#FFFF55' : '#FF8080'); }
        if (rec) { c.fillStyle = '#E8B830'; c.fillRect(k.x + k.w - 26, k.y, 26, 10); Font.draw(c, '推荐', k.x + k.w - 25, k.y + 1, '#3A2A00'); }
      }
      Font.center(c, fitText('之后可以在 选项 → 视频设置 里改；帧率太低时会自动降低分辨率', ui.w - 8), cx, ui.h - 40, '#808080');
    } else Font.center(c, '马上就好…', cx, R.q[0].y + 20, '#A0A0A0');
    for (const w of this.widgets) if (!w.card) ui.button(w);
    for (const w of this.widgets) if (w.tip && ui.hit(w)) ui.tooltip(w.tip.map((t) => ({ text: t })), ui.mouse.x, ui.mouse.y);
  }
  onEsc() { }
}

// ---- step 2b (after the quality): which device - the detected one chosen already, the player may pick the other.
// A phone goes on to the button layout editor; the setup goes on once the layout is saved (the user, 2026-11-01) ----
class DeviceScreen extends MenuScreen {
  constructor(game, next) {
    super(game, '你用什么设备玩？'); this.next = next; this.pauses = false; this.titleY = 14;
    this.detected = TouchDevice.defaultOn ? 'phone' : 'pc'; this.pick = this.detected;
  }
  cards() {
    const u = this.game.ui, w = Math.min(150, Math.floor((u.w - 30) / 2)), h = Math.min(100, u.h - 110), y = Math.floor(u.h / 2 - h / 2) - 4;
    return [
      { id: 'pc', title: '用电脑玩', sub: '键盘 + 鼠标', icon: 'comparator' },
      { id: 'phone', title: '用手机玩', sub: '触屏操作（平板也选这个）', icon: 'compass' },
    ].map((k, i) => ({ ...k, x: Math.floor(u.w / 2 - (2 * w + 8) / 2) + i * (w + 8), y, w, h }));
  }
  layout() {
    const u = this.game.ui, cx = u.w / 2;
    this.widgets = this.cards().map((k) => ({ x: k.x, y: k.y, w: k.w, h: k.h, label: '', card: k, onClick: () => { this.pick = k.id; } }));
    this.widgets.push({ x: cx - 100, y: u.h - 34, w: 200, h: 20, gold: true, label: () => this.pick === 'phone' ? '继续：设置触控按钮' : '继续', onClick: () => this.go() });
  }
  go() {
    const g = this.game, s = g.settings, phone = this.pick === 'phone';
    // phone: the buttons on (the option). PC: no buttons to start with, but not switched off - a finger on the screen
    // still brings them (a phone chosen as PC by mistake, feedback 2026-11-01), the mouse takes them away again
    if (phone) s.touch = true; else delete s.touch;
    s.touchPick = this.pick; g.touchAuto = undefined; g.saveSettings(); g.applySettings && g.applySettings();
    const n = this.next; this.next = null;
    if (phone) g.ui.open(new TouchLayoutScreen(g, this, () => n && n()));
    else n && n();
  }
  draw(ui) {
    super.draw(ui);
    const c = ui.ctx;
    for (const w of this.widgets) {
      const k = w.card; if (!k) { ui.button(w); continue; }
      drawCard(c, k.x, k.y, k.w, k.h, ui.hit(w) || this.pick === k.id);
      if (this.pick === k.id) { c.strokeStyle = '#FFD24A'; c.lineWidth = 2; c.strokeRect(k.x + 1, k.y + 1, k.w - 2, k.h - 2); c.lineWidth = 1; }
      ui.drawItem && ui.drawItem(makeStack(k.icon, 1), Math.floor(k.x + k.w / 2 - 8), k.y + 12);
      Font.center(c, k.title, k.x + k.w / 2, k.y + 40, '#FFFFFF');
      Font.center(c, fitText(k.sub, k.w - 8), k.x + k.w / 2, k.y + 54, '#A0A0A0');
      if (this.detected === k.id) Font.center(c, '检测到的设备', k.x + k.w / 2, k.y + k.h - 14, '#E8B830');
    }
    Font.center(c, fitText(this.pick === 'pc' ? '选错了也没关系：用手指点屏幕会自动出现触控按钮' : '之后可以在 选项 → 控制 → 触屏操作 里改', ui.w - 8), ui.w / 2, ui.h - 46, '#808080');
  }
  onEsc() { }
}

// ---- the whole first run ----
const Onboarding = {
  start(g) {
    if (g.settings.onboarded) return;
    const login = () => {
      const after = () => this.afterLogin(g);
      if (Account.loggedIn || !RoomService.base()) return after();
      g.ui.open(new LoginScreen(g, after));
    };
    const device = () => g.ui.open(new DeviceScreen(g, login));
    g.ui.open(new QualityScreen(g, device));
  },
  afterLogin(g) {
    const s = g.settings;
    s.onboarded = true; s.seenBuild = GAME_BUILD; g.saveSettings();
    g.ui.open(new DifferencesScreen(g, () => g.ui.open(new TitleScreen(g))));
  },
};
// on the title: the first run, or what changed since the last visit (players of this version)
(() => {
  const st = Game.prototype.startTitle;
  Game.prototype.startTitle = function (...a) {
    const r = st.apply(this, a);
    const s = this.settings;
    if (!this.onboardChecked) {
      this.onboardChecked = true;
      // (an invite link goes straight to the room; the first-run setup waits until the title world has its chunks,
      // so its benchmark never starts on a still-building scene)
      if (!s.onboarded) {
        const t0 = performance.now();
        const start = () => {
          if (!this.titleWorldReady || !this.titleWorldReady()) {
            if (performance.now() - t0 < 8000) return setTimeout(start, 250);
          }
          Onboarding.start(this);
        };
        setTimeout(start, 300);
      }
      else if (s.seenBuild !== GAME_BUILD && WHATS_NEW[GAME_BUILD]) setTimeout(() => this.ui.open(new WhatsNewScreen(this, () => this.ui.open(new TitleScreen(this)))), 50);
    }
    return r;
  };
})();

// ---- "this version is different": a few pages (players new to it) ----
const DIFF_PAGES = [
  ['网页里的操作', '电脑：和原版一样（WASD、鼠标、E 背包、T 聊天）；点一下画面锁定鼠标，Esc 释放', '手机：左下摇杆走路，右边滑动转视角；屏幕中间是准星，右下的攻击按钮挖掘 / 攻击、使用按钮放置 / 使用'],
  ['和朋友联机', '多人游戏 → 创建房间，把邀请码或邀请卡片发给朋友；也可以进公开房间', '房主能踢人、禁言、设成员；也可以用自己的单人存档开房间'],
  ['存档和账号', '登录后存档会同步到云端，换设备接着玩；7 天没玩的云端存档会自动删除（设备上的不动）', '识别码能在任何设备上登录你的账号，请保密'],
  ['皮肤、披风、帮助', '标题界面「皮肤和装饰」：预设皮肤、正版玩家皮肤、原创披风，签到活动的帽子、宠物和前缀', '按 F1 或 暂停 → 游戏说明 查看操作；物品图鉴（背包里的书本按钮）查合成方法'],
];
class DifferencesScreen extends MenuScreen {
  constructor(game, next) { super(game, '这个版本有什么不一样'); this.next = next; this.pauses = false; this.page = 0; this.titleY = 16; }
  layout() {
    const u = this.game.ui, cx = u.w / 2, last = this.page >= DIFF_PAGES.length - 1;
    this.widgets = [
      { x: cx - 152, y: u.h - 30, w: 98, h: 20, label: '跳过', onClick: () => this.done() },
      { x: cx - 50, y: u.h - 30, w: 98, h: 20, label: '上一页', enabled: this.page > 0, onClick: () => { this.page--; this.layout(); } },
      { x: cx + 52, y: u.h - 30, w: 100, h: 20, gold: last, label: last ? '开始玩' : '下一页', onClick: () => { if (last) this.done(); else { this.page++; this.layout(); } } },
    ];
  }
  done() { const n = this.next; this.next = null; n && n(); }
  drawExtra(ui) {
    const c = ui.ctx, cx = ui.w / 2, [t, ...lines] = DIFF_PAGES[this.page], w = Math.min(320, ui.w - 20), x = Math.floor(cx - w / 2), y = 36;
    drawCard(c, x, y, w, ui.h - y - 44, false);
    Font.center(c, `${this.page + 1} / ${DIFF_PAGES.length}　${t}`, cx, y + 8, '#FFD24A');
    let yy = y + 26;
    for (const l of lines) { let s = l; while (s.length) { let n = s.length; while (n > 1 && Font.width(s.slice(0, n)) > w - 16) n--; Font.draw(c, s.slice(0, n), x + 8, yy, '#E0E0E0'); s = s.slice(n); yy += 11; } yy += 6; }
  }
  onEsc() { this.done(); }
}
// ---- what changed (players of this version, once per update) ----
const WHATS_NEW = {
  '2026.10.30': ['B站 账号登录、个人识别码、云存档（换设备接着玩）', '原创披风 7 款（三连 / 关注解锁）、正版玩家皮肤', '手机：摇杆、准星 + 攻击 / 使用按钮、横屏', '新手引导、小地图、死亡点、物品图鉴、整理背包', '用单人存档开联机房间、邀请卡片、本地房间'],
};
class WhatsNewScreen extends MenuScreen {
  constructor(game, next) { super(game, '更新内容'); this.next = next; this.pauses = false; this.titleY = 16; }
  layout() { const u = this.game.ui; this.widgets = [{ x: u.w / 2 - 100, y: u.h - 30, w: 200, h: 20, label: '知道了', onClick: () => this.done() }]; }
  done() { this.game.settings.seenBuild = GAME_BUILD; this.game.saveSettings(); const n = this.next; this.next = null; n && n(); }
  drawExtra(ui) { (WHATS_NEW[GAME_BUILD] || []).forEach((t, i) => Font.center(ui.ctx, fitText('· ' + t, ui.w - 16), ui.w / 2, 40 + i * 14, '#E0E0E0')); }
  onEsc() { this.done(); }
}

// (the tutorial itself is the game's own: game.js TUTORIAL, shown as toasts; only first-time players get it)
const obHas = (g, re) => g.player && g.player.inv.slots.some((s) => s && re.test(ITEMS[s.id].key));
(() => {
  const tick = Game.prototype.tick;
  Game.prototype.tick = function (...a) { const r = tick.apply(this, a); if (this.state === 'play') { try { Tips.tick(this); } catch (e) { } } return r; };
})();

// ---- situational tips (first-time players; any player can turn them on) ----
const Tips = {
  shown: new Set(),
  tick(g) {
    if (!g.settings.tips || g.net || g.tickCount % 20) return;
    const p = g.player, t = ((g.worldTime % 24000) + 24000) % 24000, seen = g.settings.tipsSeen || (g.settings.tipsSeen = {});
    const tip = (id, text) => { if (seen[id] || this.shown.has(id)) return; this.shown.add(id); seen[id] = 1; g.saveSettings(); g.ui.pinMessage(text, 7000, '#FFFF80'); };
    if (g.mode === 'survival') {
      if (t > 11000 && t < 13000) tip('dusk', '天快黑了：怪物晚上会出现，找个地方躲起来或者造个房子');
      if (p.food <= 6) tip('hungry', '饿了：吃点东西（选中食物，按住右键 / 按住屏幕）。饥饿值太低不能疾跑、不能回血');
      if (p.health <= 6) tip('lowhp', '血量很低：先躲开怪物，吃饱了会慢慢回血');
      if (obHas(g, /^cobblestone$/)) tip('stone', '有了圆石：可以在工作台上做石镐、石剑，比木头的更好用');
      if (obHas(g, /^raw_iron$/)) tip('iron', '挖到了铁：用熔炉把粗铁烧成铁锭，可以做铁工具和盔甲');
    }
  },
};
(() => {
  // the first death
  const dd = Game.prototype.onPlayerDeath;
  Game.prototype.onPlayerDeath = function (src) {
    const r = dd.call(this, src);
    if (this.settings.tips && !(this.settings.tipsSeen || {}).death) { (this.settings.tipsSeen || (this.settings.tipsSeen = {})).death = 1; this.saveSettings(); setTimeout(() => this.ui.pinMessage('死亡后东西会掉在原地：重生后屏幕上的标记会带你回去捡（5 分钟内）', 9000, '#FFFF80'), 1500); }
    return r;
  };
})();

// ---- in the options: the tips, the first run again ----
(() => {
  const lay = OptionsScreen.prototype.layout;
  OptionsScreen.prototype.layout = function () {
    lay.call(this);
    const u = this.game.ui, g = this.game, s = g.settings;
    // the skin and account entries (vanilla's skin customisation slot; the resource packs slot, not supported here)
    for (const w of this.widgets) {
      if (w.label === '皮肤自定义…') Object.assign(w, { enabled: true, gold: true, label: '皮肤和披风…', tip: null, onClick: () => g.ui.open(new WardrobeScreen(g, this)) });
      if (w.label === '资源包…') Object.assign(w, { enabled: true, label: '账号…', tip: ['登录、游戏名、识别码'], onClick: () => g.ui.open(new AccountScreen(g, this)) });
    }
    const y = Math.max(...this.widgets.filter((w) => w.y < u.h - 40).map((w) => w.y)) + 24;
    if (y < u.h - 50) this.widgets.push(
      { x: u.w / 2 - 155, y, w: 150, h: 20, label: () => '游戏提示：' + (s.tips ? '开' : '关'), tip: ['情景提示：天黑、饥饿、血量低、第一次死亡……'], onClick: () => { s.tips = !s.tips; g.saveSettings(); } },
    );
  };
})();
