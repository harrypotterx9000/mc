'use strict';
// ---------------------------------------------------------------------------
// The player's account (game/ACCOUNT_PLAN.md): log in with Bilibili inside Toy, or with the personal identity code
// anywhere, or play offline (single player only). The room service keeps the accounts (multiplayer/rooms/accounts.js);
// the browser keeps the login token. What an account unlocks (the rules the user set):
//   三连 on the Toy's video  -> the static capes + custom skins
//   following the UP         -> the animated capes
//   both                     -> playing online
// (until the video is out - no video in the service's gate config - following alone unlocks what 三连 would)
// ---------------------------------------------------------------------------
// a request by XMLHttpRequest (a string body goes as text/plain: no preflight), as {status, ok, text}
function xhr(method, url, body) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(method, url); x.timeout = 15000;
    x.onload = () => resolve({ status: x.status, ok: x.status >= 200 && x.status < 300, text: x.responseText });
    x.onerror = () => reject(new Error('XHR 出错'));
    x.ontimeout = () => reject(new Error('XHR 超时'));
    x.send(body === undefined ? null : body);
  });
}
const Account = {
  // bili: the Bilibili openId this device logged in with ('' = by identity code, undefined = logged in before it was kept)
  token: '', data: null, offline: false, gate: null, checking: false, lastCheck: 0, codeShown: null, bili: undefined,
  load() {
    try { const s = JSON.parse(localStorage.getItem('mcjs-account') || '{}'); this.token = s.token || ''; this.data = s.account || null; this.offline = !!s.offline; this.bili = s.bili; } catch (e) { }
  },
  save() { try { localStorage.setItem('mcjs-account', JSON.stringify({ token: this.token, account: this.data, offline: this.offline, bili: this.bili })); } catch (e) { } },
  get loggedIn() { return !!(this.token && this.data); },
  get name() { return this.data ? this.data.name : ''; },
  device() { const u = navigator.userAgent; return (/Android/.test(u) ? 'Android' : /iPhone|iPad/.test(u) ? 'iOS' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : '其他') + ' · ' + (/BiliApp/i.test(u) ? 'B站App' : /Edg\//.test(u) ? 'Edge' : /Chrome/.test(u) ? 'Chrome' : /Safari/.test(u) ? 'Safari' : /Firefox/.test(u) ? 'Firefox' : '浏览器'); },
  async api(path, body) {
    if (!RoomService.base()) throw new Error('还没有配置游戏服务器地址');
    let r;
    // (plain text, the token in the body, no headers: some phone app web views drop every request the browser must
    // ask the server about first - a JSON content type or an Authorization header - so logging in never got there)
    const send = body || this.token ? JSON.stringify(this.token ? { ...(body || {}), _t: this.token } : body) : undefined;
    const url = RoomService.base() + path, method = send ? 'POST' : 'GET';
    // a request that never comes back is tried once more with XMLHttpRequest (some app web views fail one and not the
    // other); if that fails too, what the browser said is shown and sent with the statistics (the phones that can't
    // log in never reach the service, so this is the only way to see why)
    try { const f = await fetch(url, { method, body: send }); r = { status: f.status, ok: f.ok, text: await f.text() }; }
    catch (e1) {
      try { r = await xhr(method, url, send); }
      catch (e2) {
        const why = `${(e1 && e1.message) || e1} / ${(e2 && e2.message) || e2}${navigator.onLine === false ? ' / 离线' : ''}`.slice(0, 80);
        throw new Error('连不上游戏服务器（' + why + '）');
      }
    }
    let j; try { j = JSON.parse(r.text); } catch (e) { j = { error: '服务器没有回应（HTTP ' + r.status + '）' }; }
    if (r.status === 401 && this.token) { this.token = ''; this.data = null; this.save(); }
    if (!r.ok || j.error) throw Object.assign(new Error(j.error || 'HTTP ' + r.status), { status: r.status, body: j });
    return j;
  },
  took(j) { if (j.token) this.token = j.token; if (j.account) this.data = j.account; this.offline = false; this.save(); this.applySettings(); return j; },
  // Bilibili inside Toy: the profile, then the service's account for it (new: with the identity code to show once)
  async loginBili() {
    // ("not logged in" once more after a moment: a page opened from another app may get Bilibili's login late)
    let p;
    try { p = await Toy.profile(); } catch (e) {
      if (!(e instanceof ToyError && e.type === 'not_logged_in')) throw e;
      await new Promise((r) => setTimeout(r, 1500));
      p = await Toy.profile();
    }
    if (!p.toyOpenId) throw new Error('B站没有给出身份信息，请再试一次');
    const j = this.took(await this.api('/api/account/bili', { openId: p.toyOpenId, nickname: p.nickname, avatar: p.avatar, device: this.device() }));
    this.bili = p.toyOpenId; this.save();
    this.checkUnlocks(true).catch(() => { });
    return j;
  },
  async loginCode(code) {
    const j = this.took(await this.api('/api/account/code', { code, device: this.device() }));
    this.bili = ''; this.save();
    return j;
  },
  async refresh() { if (!this.token) return null; try { this.took(await this.api('/api/account/me')); } catch (e) { } return this.data; },
  async update(fields) { this.took(await this.api('/api/account/update', fields)); return this.data; },
  async logout() { try { await this.api('/api/account/logout', {}); } catch (e) { } this.token = ''; this.data = null; this.bili = undefined; this.save(); },
  async resetCode() { const p = await Toy.profile(); const j = await this.api('/api/account/reset-code', { openId: p.toyOpenId }); return j.code; },
  async remove(confirmName) { let openId = ''; try { openId = (await Toy.profile()).toyOpenId; } catch (e) { } await this.api('/api/account/delete', { openId, confirm: confirmName }); this.token = ''; this.data = null; this.save(); },
  chooseOffline() { this.offline = true; this.save(); },
  async loadGate(force) {
    if (this.gate && !force) return this.gate;
    try { this.gate = await this.api('/api/gate'); } catch (e) { this.gate = this.gate || { follow: true, triple: false, videos: [], requireAccount: true }; }
    return this.gate;
  },
  // what is unlocked (anything needs an account)
  get unlocks() { return (this.data && this.data.unlocks) || { follow: false, triple: false }; },
  tripleOk() { const g = this.gate; return this.loggedIn && (this.unlocks.triple || (!!g && !g.triple && this.unlocks.follow)); },
  has(what) {
    if (!this.loggedIn) return false;
    const u = this.unlocks;
    // (a super administrator wears every cape and skin without 三连 / following - the user, 2026-11-02)
    if ((what === 'anim' || what === 'static' || what === 'skin') && this.data && this.data.super) return true;
    if (what === 'anim') return !!u.follow;
    if (what === 'static' || what === 'skin') return this.tripleOk();
    return false;
  },
  // 三连 / follow as Bilibili says now (only inside Toy); what changed is returned, the account keeps what was seen
  async checkUnlocks(quiet) {
    if (!this.loggedIn || this.checking) return null;
    this.checking = true;
    try {
      const g = await this.loadGate();
      if (!(await Toy.ready())) return { inToy: false };
      const before = { follow: this.unlocks.follow, stat: this.has('static') };
      let follow = null, triple = null, err = null;
      try { follow = await Toy.following(); } catch (e) { err = e; }
      if (g.videos && g.videos.length) {
        try { const t = await Toy.triple(g.videos); triple = t ? t.all : null; this.tripleParts = t; } catch (e) { err = err || e; this.tripleParts = null; }
      }
      // 三连 on the AI companion's video (companion.js) - its own unlock
      let ai = null;
      if (g.aiVideos && g.aiVideos.length) { try { const t = await Toy.triple(g.aiVideos); ai = t ? t.all : null; } catch (e) { } }
      this.lastCheck = Date.now();
      // only the account's own Bilibili user can take an unlock back: logged in by identity code on a computer whose
      // Bilibili page has nobody (or someone else) logged in, "not following" came back and wiped the follow the
      // account had (feedback 2026-11-01/02: "关注了，换设备用识别码登录显示没关注"). A yes still counts from anyone.
      const own = await this.ownBili();
      if (!own) { if (follow !== true) follow = null; if (triple !== true) triple = null; if (ai !== true) ai = null; }
      if (follow !== null || triple !== null || ai !== null) this.took(await this.api('/api/account/unlocks', { follow, triple, ai }));
      // taken back (unfollowed, 三连 undone): locked again; the others in a room see the cape go
      const lost = (before.follow && !this.unlocks.follow) || (before.stat && !this.has('static'));
      if (lost && typeof game !== 'undefined' && game.net && game.net.sendLook) game.net.sendLook();
      return { inToy: true, follow, triple, lost, error: err, own };
    } finally { this.checking = false; }
  },
  // the Bilibili user on this page is the account's own (logged in from here; before that was kept: the same nickname)
  async ownBili() {
    let p = null; try { p = await Toy.profile(); } catch (e) { return false; }
    if (!p || !p.toyOpenId) return false;
    if (this.bili === undefined && this.data && this.data.nick && p.nickname === this.data.nick) { this.bili = p.toyOpenId; this.save(); }
    return !!this.bili && p.toyOpenId === this.bili;
  },
  // settings follow the account (changed ones go up a few seconds later)
  applySettings() {
    const s = this.data && this.data.settings;
    if (!s || typeof game === 'undefined' || !game.settings || this.appliedFor === this.data.id) return;
    this.appliedFor = this.data.id;
    for (const k of ACCOUNT_SETTINGS) if (s[k] !== undefined) game.settings[k] = s[k];
    game.saveSettings();
  },
  settingsChanged() {
    if (!this.loggedIn || typeof game === 'undefined') return;
    clearTimeout(this.setT);
    this.setT = setTimeout(() => { const s = {}; for (const k of ACCOUNT_SETTINGS) if (game.settings[k] !== undefined) s[k] = game.settings[k]; this.update({ settings: s }).catch(() => { }); }, 4000);
  },
};
// the settings that follow the account to other devices (not the ones about this device's screen or speed)
// (not the touch buttons' layout: kept in screen pixels of one device, a tablet's put a phone's off the screen -
// feedback 11-01; each device keeps its own)
const ACCOUNT_SETTINGS = ['fov', 'sens', 'volume', 'gamma', 'bobbing', 'advTooltips', 'keys', 'autoJump', 'invertY', 'subtitles', 'chatOpacity', 'tutorialOff', 'minimap', 'deathMarker', 'recipeHints', 'vibrate', 'quickChat'];
Account.load();
// (each visit: follow / 三连 checked again once the page is up, quietly - unless it was a moment ago)
setTimeout(() => { if (Account.loggedIn && Date.now() - Account.lastCheck > 5000) Account.checkUnlocks(true).catch(() => { }); }, 3000);
// the rooms: this account's room key and token instead of the browser's own key
(() => {
  const key = RoomService.key.bind(RoomService);
  RoomService.key = () => (Account.loggedIn && Account.data.roomKey ? Account.data.roomKey : key());
  const api = RoomService.api.bind(RoomService);
  RoomService.api = async function (path, body) {
    if (!Account.token || !body) return api(path, body); // (what is only looked at needs no token)
    let r;
    try { r = await fetch(this.base() + path, { method: 'POST', body: JSON.stringify({ ...body, _t: Account.token }) }); }
    catch (e) { throw new Error('连不上联机服务器'); }
    const j = await r.json().catch(() => ({ error: '联机服务器没有回应' }));
    if (!r.ok || (j && j.error)) throw Object.assign(new Error((j && j.error) || 'HTTP ' + r.status), { gate: !!(j && j.gate) });
    return j;
  };
  const save = Game.prototype.saveSettings;
  Game.prototype.saveSettings = function () { save.call(this); Account.settingsChanged(); };
})();

// ---- drawing helpers for the account screens ----
// a rounded dark card with a gold or grey edge
function drawCard(c, x, y, w, h, gold) {
  c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(x, y, w, h);
  c.strokeStyle = gold ? '#E8B830' : '#555555'; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (gold) { c.fillStyle = 'rgba(232,184,48,0.10)'; c.fillRect(x + 1, y + 1, w - 2, h - 2); }
}
// little pixel icons: thumb up, coin, star (三连), heart-plus (follow), check, lock
const ICON_PIX = {
  check: ['.......#', '......##', '.....##.', '#...##..', '##.##...', '.###....', '..#.....', '........'],
  lock: ['..####..', '.#....#.', '.#....#.', '########', '###..###', '###..###', '########', '########'],
};
function drawIcon(c, name, x, y, s, col) {
  const p = ICON_PIX[name]; if (!p) return;
  c.fillStyle = col;
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if (p[j][i] === '#') c.fillRect(x + i * s, y + j * s, s, s);
}
// ---- 登录: Bilibili (gold, recommended) / identity code / offline ----
// offline: where 离线游玩 goes when it is not next - from the way into multiplayer, back where the player came from
// (next would ask for the login again, and the same screen came back as if the button did nothing)
class LoginScreen extends MenuScreen {
  constructor(game, next, offline) {
    super(game, '登录'); this.next = next; this.offline = offline; this.pauses = false; this.titleY = 22; this.note = ''; this.noteColor = '#A0A0A0'; this.busy = false; this.inToy = null;
    Toy.ready().then((v) => { this.inToy = v; if (this.game.ui.screen === this) this.layout(); });
    this.mobileOutside = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) && !/BiliApp/i.test(navigator.userAgent);
  }
  say(t, bad) { this.note = t; this.noteColor = bad ? '#FF6060' : '#A0A0A0'; }
  done() { const n = this.next; this.next = null; if (n) n(); else this.game.ui.open(new TitleScreen(this.game)); }
  layout() {
    const u = this.game.ui, cx = u.w / 2, y = Math.max(70, Math.floor(u.h / 2 - 40));
    const bili = this.inToy !== false;
    this.widgets = [];
    if (bili) this.widgets.push({ x: cx - 110, y, w: 220, h: 24, gold: true, label: () => (this.busy ? '正在登录…' : this.inToy === null ? '正在连接 B站…' : 'B站一键登录（推荐）'), enabled: !this.busy && this.inToy === true, onClick: () => this.bili() });
    this.widgets.push(
      { x: cx - 110, y: y + (bili ? 30 : 0), w: 220, h: 20, label: '用识别码登录', enabled: !this.busy, tip: ['第一次用 B站登录时会给你一个识别码', '在别的设备、别的浏览器里用它登录同一个账号'], onClick: () => this.game.ui.open(new CodeLoginScreen(this.game, this)) },
      { x: cx - 60, y: y + (bili ? 62 : 32), w: 120, h: 16, label: '离线游玩', enabled: !this.busy, tip: ['只能玩单人游戏，存档只在这台设备上', '之后随时可以在 选项 → 账号 里登录'], onClick: () => { Account.chooseOffline(); if (this.offline) { this.next = null; this.offline(); } else this.done(); } },
    );
  }
  async bili() {
    this.busy = true; this.say('正在向 B站 请求授权…'); this.layout();
    try {
      const j = await Account.loginBili();
      if (j.code) { this.game.ui.open(new CodeShowScreen(this.game, j.code, () => this.done(), true)); return; }
      this.done();
      this.game.ui.message && this.game.ui.message('欢迎回来，' + Account.name, '#55FF55');
    } catch (e) {
      this.busy = false; this.say(e instanceof ToyError ? Toy.explain(e) : e.message, true); this.layout();
    }
  }
  drawExtra(ui) {
    const c = ui.ctx, cx = ui.w / 2, y = Math.max(70, Math.floor(ui.h / 2 - 40));
    const lines = ['登录后可以：和朋友联机、存档同步到云端、换皮肤和披风', '账号和存档换设备也在'];
    lines.forEach((t, i) => Font.center(c, fitText(t, ui.w - 8), cx, y - 34 + i * 11, i ? '#A0A0A0' : '#FFFFFF'));
    if (this.inToy === false) Font.center(c, fitText(this.mobileOutside ? '手机浏览器里不能用 B站登录：可以用识别码，或者在 B站 App 里打开' : '不在 B站 Toy 页面里：可以用识别码登录', ui.w - 8), cx, y - 12, '#FFD24A');
    if (this.note) Font.center(c, fitText(this.note, ui.w - 8), cx, y + 96, this.noteColor);
    if (typeof GAME_BUILD !== 'undefined') Font.center(c, '版本 ' + GAME_BUILD, cx, ui.h - 12, '#707070'); // (which build a screenshot is from)
  }
  onEsc() { }
}
// the identity code, the one time it is shown
class CodeShowScreen extends MenuScreen {
  constructor(game, code, next, fresh) { super(game, fresh ? '这是你的个人识别码' : '新的个人识别码'); this.code = code; this.next = next; this.pauses = false; this.t0 = performance.now(); this.copied = null; }
  base() { return Math.max(0, Math.floor((this.game.ui.h - 150) / 2)); }
  layout() {
    const u = this.game.ui, cx = u.w / 2, y = this.base() + 110;
    this.titleY = this.base() + 10;
    this.widgets = [
      { x: cx - 110, y, w: 108, h: 20, label: () => (this.copied ? '已复制' : this.copied === false ? '复制不了，请抄下来' : '复制识别码'), onClick: async () => { this.copied = await copyText(this.code); } },
      { x: cx + 2, y, w: 108, h: 20, label: () => { const s = Math.ceil(3 - (performance.now() - this.t0) / 1000); return s > 0 ? `我记下了（${s}）` : '我记下了'; }, enabled: true,
        onClick: () => { if (performance.now() - this.t0 < 3000) return; const n = this.next; this.next = null; n && n(); } },
    ];
  }
  drawExtra(ui) {
    const c = ui.ctx, cx = ui.w / 2, y = this.base() + 76;
    const w = Font.width(this.code) * 2 + 24;
    drawCard(c, Math.floor(cx - w / 2), y - 8, w, 30, true);
    c.save(); c.translate(cx, y); c.scale(2, 2); Font.center(c, this.code, 0, 0, '#FFD24A'); c.restore();
    const lines = [['只显示这一次，请抄下来或复制保存', '#FFFFFF'], ['用它可以在任何设备上登录你的账号：请保密，别发给别人', '#FF8080'], ['忘了可以在 B站 里登录后，到 选项 → 账号 重新生成', '#A0A0A0']];
    lines.forEach(([t, col], i) => Font.center(c, fitText(t, ui.w - 8), cx, this.base() + 26 + i * 11, col));
  }
  onEsc() { }
}
class CodeLoginScreen extends FormScreen {
  constructor(game, parent) { super(game, '用识别码登录', parent); this.code = ''; this.busy = false; }
  layout() {
    const u = this.game.ui, cx = u.w / 2;
    this.fields = {};
    this.addField('code', cx - 110, 80, 220, '个人识别码（XXXX-XXXX-XXXX-XXXX）', 19, (v) => { const s = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16); return s.replace(/(.{4})(?=.)/g, '$1-'); });
    this.widgets = [
      { x: cx - 110, y: 110, w: 108, h: 20, label: () => (this.busy ? '正在登录…' : '登录'), enabled: !this.busy, onClick: () => this.submit() },
      { x: cx + 2, y: 110, w: 108, h: 20, label: '返回', onClick: () => this.back() },
    ];
    this.focus('code');
  }
  async submit() {
    if (this.busy) return;
    if (this.code.replace(/-/g, '').length !== 16) { this.say('识别码是 16 位（4 组，每组 4 位）', true); return; }
    this.busy = true; this.say('正在登录…'); this.layout();
    try {
      await Account.loginCode(this.code);
      this.game.ui.hideInput();
      this.game.ui.message && this.game.ui.message('已登录：' + Account.name, '#55FF55');
      const p = this.parent;
      if (p instanceof LoginScreen) p.done(); else this.game.ui.open(new AccountScreen(this.game, new OptionsScreen(this.game, new TitleScreen(this.game))));
    } catch (e) { this.busy = false; this.say(e.message, true); this.layout(); }
  }
  drawExtra(ui) { this.drawFields(ui); Font.center(ui.ctx, fitText('第一次用 B站登录时，游戏给过你识别码', ui.w - 8), ui.w / 2, 140, '#808080'); }
}

// ---- 账号 (选项): the game name, the identity code, logging out, deleting ----
class AccountScreen extends FormScreen {
  constructor(game, parent) { super(game, '账号', parent); this.newName = Account.name; this.confirm = null; Account.refresh().then(() => { this.newName = Account.name; if (this.game.ui.screen === this) this.layout(); }); Account.loadGate(); }
  layout() {
    const u = this.game.ui, cx = u.w / 2, g = this.game;
    this.fields = {}; this.widgets = [];
    if (!Account.loggedIn) {
      this.widgets.push(
        { x: cx - 100, y: 60, w: 200, h: 24, gold: true, label: '登录', onClick: () => g.ui.open(new LoginScreen(g, () => g.ui.open(new AccountScreen(g, this.parent)))) },
        { x: cx - 100, y: u.h - 30, w: 200, h: 20, label: '完成', onClick: () => this.back() },
      );
      return;
    }
    // (the game name is the Bilibili name: shown, not changed here - drawExtra)
    const confirmDel = this.confirm === 'del';
    this.widgets.push(
      { x: cx - 150, y: 112, w: 148, h: 20, label: '重新生成识别码', tip: ['旧的识别码马上失效', '要在 B站 里登录同一个账号才能用'], onClick: () => this.reset() },
      { x: cx + 2, y: 112, w: 148, h: 20, label: '皮肤和装饰…', gold: true, onClick: () => g.ui.open(new WardrobeScreen(g, this)) },
      { x: cx - 150, y: 136, w: 148, h: 20, label: '退出登录', onClick: async () => { await Account.logout(); this.say('已退出登录'); this.layout(); } },
      { x: cx + 2, y: 136, w: 148, h: 20, label: confirmDel ? '再点一次：永久删除' : '删除账号', color: confirmDel ? '#FF6060' : undefined, tip: ['删除账号、云存档、解锁记录，不能恢复', '这台设备上的存档不受影响'], onClick: () => this.del() },
      ...(!Companion.shown ? [] : [{ x: cx - 150, y: 184, w: 300, h: 20, label: 'AI 伙伴…', tip: ['会聊天、懂你在游戏里做什么的 AI 小伙伴（用你自己的 DeepSeek 密钥）'], onClick: () => g.ui.open(new CompanionScreen(g, this)) }]),
      { x: cx - 150, y: 160, w: 148, h: 20, label: '诊断', tip: ['显示 B站 返回的原始数据（排查问题用）'], onClick: () => g.ui.open(new ToyDiagScreen(g, this)) },
      ...(Account.data.super ? [{ x: cx + 2, y: 160, w: 148, h: 20, gold: true, label: '管理员…', tip: ['临时昵称、全服公告、昵称颜色、管理员披风'], onClick: () => g.ui.open(new AdminScreen(g, this)) }] : []),
      { x: cx - 100, y: u.h - 30, w: 200, h: 20, label: '完成', onClick: () => this.back() },
    );
  }
  async reset() {
    try { const code = await Account.resetCode(); this.game.ui.hideInput(); this.game.ui.open(new CodeShowScreen(this.game, code, () => this.game.ui.open(this), false)); }
    catch (e) { this.say(e instanceof ToyError ? Toy.explain(e) : e.message, true); }
  }
  async del() {
    if (this.confirm !== 'del') { this.confirm = 'del'; this.layout(); return; }
    try { await Account.remove(Account.name); this.say('账号已删除'); } catch (e) { this.say(e.message, true); }
    this.confirm = null; this.layout();
  }
  drawExtra(ui) {
    const c = ui.ctx, cx = ui.w / 2;
    if (!Account.loggedIn) { Font.center(c, Account.offline ? '现在是离线游玩：只能玩单人游戏' : '还没有登录', cx, 40, '#A0A0A0'); return; }
    this.drawFields(ui);
    const d = Account.data, u = Account.unlocks;
    Font.draw(c, '游戏名：' + Account.name, cx - 150, 52, '#FFFFFF');
    Font.draw(c, '就是 B站名，B站改名后会跟着变', cx - 150, 64, '#808080');
    Font.draw(c, `B站：${d.nick || '（识别码登录）'}　　注册于 ${new Date(d.created).toLocaleDateString()}`, cx - 150, 80, '#A0A0A0');
    const st = (ok, t) => (ok ? '✓ ' : '✗ ') + t;
    Font.draw(c, [st(Account.tripleOk(), '三连'), st(u.follow, '关注')].join('　'), cx - 150, 94, '#E0E0E0');
  }
}
// ---- 管理员 (the highest permissions, rooms/accounts.js): a temporary nickname to play under online, an announcement
// to everyone playing, the colour of the name, the administrators' cape ----
const ADMIN_COLORS = ['', '#FFAA00', '#FFFF55', '#55FF55', '#55FFFF', '#5555FF', '#FF55FF', '#FF5555', '#AA00AA', '#00AAAA', '#AAAAAA', '#E8B830', '#FF7EB6', '#7FD4FF'];
// 冻结名单 (administrators): the accounts the service froze for a severe word (moderation.js) - who, when, where, the
// words - each with 解冻 (the account, its address and its network let back in)
class FrozenScreen extends MenuScreen {
  constructor(game, parent) { super(game, '冻结名单'); this.parent = parent; this.pauses = false; this.titleY = 12; this.list = null; this.page = 0; this.note = ''; this.noteColor = '#80FF80'; this.load(); }
  async load() {
    try { const j = await Account.api('/api/account/admin/frozen', {}); this.list = j.list || []; this.hours = j.hours; } catch (e) { this.list = []; this.say(e.message, true); }
    if (this.game.ui.screen === this) this.layout();
  }
  say(t, bad) { this.note = t; this.noteColor = bad ? '#FF6060' : '#80FF80'; }
  rows() { return Math.max(2, Math.floor((this.game.ui.h - 90) / 30)); }
  layout() {
    const u = this.game.ui, cx = u.w / 2, L = this.list || [], n = this.rows(), pages = Math.max(1, Math.ceil(L.length / n));
    this.page = clamp(this.page, 0, pages - 1);
    this.widgets = L.slice(this.page * n, this.page * n + n).map((f, i) => ({ x: cx + 116, y: 34 + i * 30, w: 44, h: 18, label: '解冻', onClick: () => this.unfreeze(f) }));
    if (pages > 1) this.widgets.push(
      { x: cx - 160, y: u.h - 30, w: 50, h: 20, label: '<', enabled: this.page > 0, onClick: () => { this.page--; this.layout(); } },
      { x: cx + 110, y: u.h - 30, w: 50, h: 20, label: '>', enabled: this.page < pages - 1, onClick: () => { this.page++; this.layout(); } },
    );
    this.widgets.push({ x: cx - 100, y: u.h - 30, w: 200, h: 20, label: '完成', onClick: () => this.game.ui.open(this.parent) });
  }
  async unfreeze(f) {
    try { const j = await Account.api('/api/account/admin/unfreeze', { id: f.id }); this.list = j.list || []; this.say('已解冻 ' + f.name + '（账号和 IP 都放开了）'); }
    catch (e) { this.say(e.message, true); }
    this.layout();
  }
  drawExtra(ui) {
    const c = ui.ctx, cx = ui.w / 2, L = this.list, n = this.rows();
    if (!L) { Font.center(c, '正在读取…', cx, 60, '#A0A0A0'); return; }
    if (!L.length) Font.center(c, '没有被冻结的账号', cx, 60, '#A0A0A0');
    const t2 = (ms) => { const d = new Date(ms); return `${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    L.slice(this.page * n, this.page * n + n).forEach((f, i) => {
      const y = 34 + i * 30;
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(cx - 160, y - 2, 320, 28);
      Font.draw(c, fitText(f.name || f.id, 140), cx - 157, y + 1, '#FFFFFF');
      Font.draw(c, fitText(`${t2(f.at)} · ${f.why}${f.banned ? ' · IP 封禁中' : ''}`, 270), cx - 157, y + 12, '#A0A0A0');
      if (f.text) Font.draw(c, fitText('原话：' + f.text, 270), cx - 157, y + 21, '#FF8080');
    });
    if (this.note) Font.center(c, fitText(this.note, ui.w - 8), cx, ui.h - 42, this.noteColor);
  }
  onEsc() { this.game.ui.open(this.parent); }
}
class AdminScreen extends FormScreen {
  constructor(game, parent) { super(game, '管理员', parent); this.nick = Account.data.tempNick || ''; this.notice = ''; this.busy = null; }
  layout() {
    const u = this.game.ui, cx = u.w / 2, g = this.game;
    this.fields = {}; this.widgets = [];
    this.addField('nick', cx - 150, 52, 196, '临时昵称（联机时用这个名字；留空：用 B站名）', 16, (v) => v.replace(/[\s"'\\§]/g, '').slice(0, 16));
    this.widgets.push({ x: cx + 50, y: 52, w: 48, h: 20, gold: true, label: () => (this.busy === 'nick' ? '…' : '使用'), enabled: !this.busy, onClick: () => this.setNick(this.nick) });
    this.widgets.push({ x: cx + 102, y: 52, w: 48, h: 20, label: '清除', enabled: !this.busy && !!Account.data.tempNick, onClick: () => this.setNick('') });
    this.addField('notice', cx - 150, 96, 248, '全服公告（单人和联机的所有人都会在聊天框看到）', 100, (v) => v.slice(0, 100));
    this.widgets.push({ x: cx + 102, y: 96, w: 48, h: 20, gold: true, label: () => (this.busy === 'notice' ? '…' : '发布'), enabled: !this.busy, onClick: () => this.announce() });
    // the name's colour: a row of swatches (the first: none)
    this.swatches = ADMIN_COLORS.map((col, i) => ({ x: cx - 150 + i * 21, y: 136, w: 19, h: 19, label: '', col, tip: [col ? '昵称颜色 ' + col : '不用颜色（白色）'], enabled: !this.busy, onClick: () => this.setColor(col) }));
    this.widgets.push(...this.swatches);
    this.widgets.push({ x: cx - 150, y: 166, w: 300, h: 20, gold: true, label: '管理员披风（动态）…', tip: ['在 皮肤和装饰 里选「管理员」'], onClick: () => g.ui.open(new WardrobeScreen(g, this)) });
    this.widgets.push({ x: cx - 150, y: 190, w: 300, h: 20, label: '冻结名单…', tip: ['写了严重违规内容被自动冻结的账号', '可以看原话和时间，误伤了可以解冻'], onClick: () => g.ui.open(new FrozenScreen(g, this)) });
    this.widgets.push({ x: cx - 100, y: u.h - 30, w: 200, h: 20, label: '完成', onClick: () => this.back() });
  }
  async run(k, f, ok) {
    this.busy = k; this.layout();
    try { await f(); this.say(ok); } catch (e) { this.say(e.message, true); }
    this.busy = null; this.layout();
  }
  setNick(n) {
    return this.run('nick', async () => { await Account.update({ tempNick: n }); this.nick = Account.data.tempNick || ''; },
      n ? `之后进联机房间时叫「${n}」（已经在房间里的话，重新进入后生效）` : '已改回 B站名（重新进入房间后生效）');
  }
  setColor(c) { return this.run('color', () => Account.update({ nameColor: c }), c ? '昵称颜色已设置，房间里的人马上能看到' : '已取消昵称颜色'); }
  announce() {
    const text = this.notice.trim();
    if (!text) { this.say('先写公告内容', true); return; }
    return this.run('notice', async () => {
      if (typeof textOk === 'function' && !(await textOk(this.game, text, 'chat'))) throw new Error('这段文字没有通过 B站 的内容检查');
      await Account.api('/api/account/announce', { text });
      this.notice = '';
    }, '公告已发布');
  }
  drawExtra(ui) {
    this.drawFields(ui);
    const c = ui.ctx, cx = ui.w / 2, cur = Account.data.nameColor || '';
    Font.draw(c, '昵称颜色', cx - 150, 125, '#A0A0A0');
    Font.draw(c, '现在：' + (Account.data.tempNick || Account.name), cx + 50, 125, cur || '#FFFFFF');
  }
  draw(ui) {
    super.draw(ui);
    const c = ui.ctx, cur = Account.data.nameColor || '';
    for (const s of this.swatches || []) {
      c.fillStyle = s.col || '#FFFFFF'; c.fillRect(s.x + 3, s.y + 3, s.w - 6, s.h - 6);
      if (!s.col) { c.strokeStyle = '#FF5555'; c.beginPath(); c.moveTo(s.x + 4, s.y + s.h - 4); c.lineTo(s.x + s.w - 4, s.y + 4); c.stroke(); }
      if (s.col === cur) { c.strokeStyle = '#FFFFFF'; c.lineWidth = 1; c.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1); }
    }
  }
}
const g_netName = (g) => { if (Account.loggedIn) { g.settings.netName = Account.name; g.saveSettings(); } };

// ---- 诊断: the raw answers Bilibili gave (the field names of follow / 三连 are not documented) ----
class ToyDiagScreen extends MenuScreen {
  constructor(game, parent) { super(game, 'B站 接口诊断'); this.parent = parent; this.pauses = false; this.titleY = 12; this.lines = ['正在读取…']; this.run(); }
  async run() {
    const L = [], j = (v) => { try { return JSON.stringify(v); } catch (e) { return String(v); } };
    L.push('在 Toy 里：' + (await Toy.ready()) + (Toy.mock ? '（模拟）' : ''));
    const g = await Account.loadGate(true); L.push('联机门槛：' + j(g));
    try { const p = await Toy.profile(); L.push('用户：' + p.nickname + (p.toyOpenId ? '（有 toyOpenId）' : '（没有 toyOpenId）')); } catch (e) { L.push('用户：' + e.type + ' ' + e.message); }
    try { L.push('关注 → ' + (await Toy.following())); L.push('  原始：' + j(Toy.last.relation)); } catch (e) { L.push('关注：' + e.type + ' ' + e.message); }
    if (g.videos && g.videos.length) { try { L.push('三连 → ' + j(await Toy.triple(g.videos))); L.push('  原始：' + j(Toy.last.videoActions)); } catch (e) { L.push('三连：' + e.type + ' ' + e.message); } }
    try { L.push('能力：' + j(await Toy.abilities())); } catch (e) { L.push('能力：' + e.type); }
    this.lines = L; if (this.game.ui.screen === this) this.layout();
  }
  layout() { const u = this.game.ui; this.widgets = [{ x: u.w / 2 - 100, y: u.h - 28, w: 200, h: 20, label: '完成', onClick: () => this.game.ui.open(this.parent) }]; }
  drawExtra(ui) {
    let y = 30;
    for (const t of this.lines) for (let s = String(t); s.length && y < ui.h - 36; y += 10) { let n = s.length; while (n > 1 && Font.width(s.slice(0, n)) > ui.w - 16) n--; Font.draw(ui.ctx, s.slice(0, n), 8, y, '#E0E0E0'); s = s.slice(n); }
  }
  onEsc() { this.game.ui.open(this.parent); }
}

// ---- the way into multiplayer: an account, then the unlock (the service checks it again when joining) ----
// single player (the user, 2026-10-31): following the UP first, asked of Bilibili inside Toy each time. Only Bilibili's
// "not following" (or not logged in there) stops it - where it can't be asked (a phone's own browser, outside Toy) or
// the asking fails, the game opens as before, so a broken answer never locks everyone out
const SINGLE_OPEN = true;
async function singleGate(g, then, parent) {
  // single player is open to everyone, following or not (the user, 2026-11-03); the follow check below is kept for
  // if it ever comes back - multiplayer still asks for the account and its unlock
  if (SINGLE_OPEN) return then();
  // a super administrator (pinned by account id on the server, super.json) never waits here: the UP can't follow
  // themselves, and was kept out of single player (2026-11-01)
  if (Account.loggedIn && Account.data && Account.data.super) return then();
  // an account that has followed already (seen by the service): in by its identity code on another device, or with
  // another Bilibili user on this page, Bilibili said "not following" - multiplayer let it in, single player didn't
  // (feedback 2026-11-03)
  if (Account.loggedIn && Account.unlocks.follow) return then();
  if (!(await Promise.race([Toy.ready(), new Promise((r) => setTimeout(() => r(false), 2500))]))) return then();
  let f = null, err = null;
  try { f = await Toy.following(); } catch (e) { err = e; }
  // only one Bilibili says isn't following is asked; not logged in (a guest account, a browser not logged in to
  // Bilibili) the follow can't be seen at all - following changed nothing, a dead end (players' feedback 2026-10-31)
  if (f !== false || err) return then();
  g.ui.open(new FollowGateScreen(g, parent, then));
}
class FollowGateScreen extends MenuScreen {
  constructor(game, parent, then) {
    super(game, '关注 UP 主'); this.parent = parent; this.then = then; this.note = ''; this.noteColor = '#A0A0A0'; this.titleY = 40;
    // back from the UP's page: look again (a new follow can take a few seconds to show)
    this.onBack = () => { if (document.visibilityState === 'visible' && this.went && this.game.ui.screen === this) { this.went = false; this.retries = 3; setTimeout(() => this.check(true), 600); } };
    document.addEventListener('visibilitychange', this.onBack); window.addEventListener('focus', this.onBack);
  }
  close() { document.removeEventListener('visibilitychange', this.onBack); window.removeEventListener('focus', this.onBack); }
  back() { this.game.ui.open(this.parent || new TitleScreen(this.game)); }
  onEsc() { this.back(); }
  layout() {
    const u = this.game.ui, cx = u.w / 2, y = Math.floor(u.h / 2) + 10;
    this.widgets = [
      { x: cx - 100, y, w: 200, h: 20, gold: true, label: '去关注', onClick: () => this.go() },
      { x: cx - 100, y: y + 24, w: 98, h: 20, label: () => (this.checking ? '正在检查…' : '我关注了，检查'), enabled: !this.checking, onClick: () => this.check(false) },
      { x: cx + 2, y: y + 24, w: 98, h: 20, label: '返回', onClick: () => this.back() },
    ];
  }
  async go() {
    this.went = true;
    try { await Toy.openAuthor(); this.note = '关注后回到这里，会自动检查'; this.noteColor = '#A0A0A0'; }
    catch (e) { this.went = false; this.note = Toy.explain(e); this.noteColor = '#FF6060'; }
    setTimeout(() => { if (this.went && this.game.ui.screen === this) { this.went = false; this.retries = 3; this.check(true); } }, 8000);
  }
  async check(quiet) {
    if (this.checking) return;
    this.checking = true;
    let f = null, err = null;
    try { f = await Toy.following(); } catch (e) { err = e; }
    this.checking = false;
    if (this.game.ui.screen !== this) return;
    if (f === true || (f === null && !err)) { const t = this.then; this.then = null; if (t) t(); return; }
    if (this.retries > 0) { this.retries--; setTimeout(() => { if (this.game.ui.screen === this) this.check(true); }, 4000); }
    if (!quiet || !this.retries) { this.note = err ? Toy.explain(err) : '还没查到关注（刚关注完可能要等几秒，再点一次检查）'; this.noteColor = '#FF6060'; }
  }
  drawExtra(ui) {
    const c = ui.ctx, cx = ui.w / 2, y = Math.floor(ui.h / 2) - 40;
    Font.center(c, fitText('关注 UP 主「土豆味小哲」后就能玩单人游戏', ui.w - 8), cx, y, '#FFD24A');
    Font.center(c, fitText('在 B站 里关注完回到这里，会自动检查', ui.w - 8), cx, y + 14, '#E0E0E0');
    if (this.note) Font.center(c, fitText(this.note, ui.w - 8), cx, y + 30, this.noteColor);
  }
}

// phase-1 (1-A): multiplayer no longer asks for an account or an unlock; the room service still checks joins
function onlineGate(g, then) { return then(); }
