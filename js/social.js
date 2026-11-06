'use strict';
// ---------------------------------------------------------------------------
// The platform around the game (Toy SDK, account.js): the name a new account plays under, Bilibili's content check
// on what players type for others (chat, room names, reports), the invite card (share, QR code), and the
// page closing (leave the room, last statistics).
// ---------------------------------------------------------------------------

// (a new account plays under its Bilibili name - the room service makes the game name from the nickname, and it
// follows a rename there; no name to pick)

// ---- Bilibili's content check on what others will read ----
async function textOk(g, text, scene) {
  const r = await Toy.checkText(text, scene);
  if (!r.passed) return false;
  return true;
}
(() => {
  // chat in a room (commands are the server's own business)
  const chat = NetClient.prototype.chat;
  NetClient.prototype.chat = async function (text) {
    if (!String(text).startsWith('/') && !(await textOk(this.g, text, 'chat'))) { this.g.ui.message('这条消息包含不合适的内容，没有发出', '#FF5555'); return; }
    return chat.call(this, text);
  };
  // a room's name (shown to everyone in the public list)
  const cr = CreateRoomScreen.prototype.submit;
  CreateRoomScreen.prototype.submit = async function () {
    if (this.busy) return;
    if (!(await textOk(this.game, this.roomName, 'room_name'))) { this.say('房间名包含不合适的内容，换一个吧', true); return; }
    return cr.call(this);
  };
  const sub = ReportScreen.prototype.submit;
  ReportScreen.prototype.submit = async function () {
    if (this.text && String(this.text).trim() && !(await textOk(this.game, this.text, 'report'))) { this.note = '内容包含不合适的词，请修改后再发送'; this.noteColor = '#FF5555'; if (this.say) this.say(this.note, true); return; }
    return sub.call(this);
  };
})();

// ---- 邀请卡片: the room's name and code, a QR code to scan, share it on Bilibili ----
class InviteCardScreen extends MenuScreen {
  constructor(game, parent) {
    super(game, '邀请朋友'); this.parent = parent; this.pauses = false; this.titleY = 8; this.qr = null; this.note = ''; this.inToy = null;
    const R = this.R;
    Toy.ready().then((v) => {
      this.inToy = v;
      if (v && R) Toy.qrCode('index.html?room=' + R.code, 240).then((q) => { if (q && q.base64) { const im = new Image(); im.onload = () => { this.qr = im; }; im.src = q.base64.startsWith('data:') ? q.base64 : 'data:image/png;base64,' + q.base64; } }).catch(() => { });
      if (this.game.ui.screen === this) this.layout();
    });
  }
  get R() { return this.game.net && this.game.net.room; }
  layout() {
    const u = this.game.ui, cx = u.w / 2, R = this.R, y = u.h - 52;
    this.widgets = [];
    if (R) this.widgets.push(
      { x: cx - 152, y, w: 98, h: 20, gold: true, label: '分享给朋友', enabled: this.inToy === true, tip: this.inToy ? ['发到 B站 私信、动态'] : ['在 B站 App 或网页里才能分享'], onClick: () => this.share() },
      { x: cx - 50, y, w: 98, h: 20, label: '复制链接', onClick: async () => { this.note = (await copyText(RoomService.link(R.code))) ? '链接已复制' : '复制失败'; } },
      { x: cx + 52, y, w: 100, h: 20, label: '复制邀请码', onClick: async () => { this.note = (await copyText(R.code)) ? '邀请码已复制' : '复制失败'; } },
    );
    this.widgets.push({ x: cx - 100, y: u.h - 28, w: 200, h: 20, label: '完成', onClick: () => this.game.ui.open(this.parent) });
  }
  async share() {
    try { await Toy.share('index.html?room=' + this.R.code); this.note = '已打开分享'; }
    catch (e) { this.note = Toy.explain(e); }
  }
  drawExtra(ui) {
    const c = ui.ctx, cx = ui.w / 2, R = this.R;
    if (!R) { Font.center(c, '不在房间里', cx, 60, '#A0A0A0'); return; }
    const w = 230, h = ui.h - 92, x = Math.floor(cx - w / 2), y = 22;
    drawCard(c, x, y, w, h, true);
    Font.center(c, fitText(R.name, w - 16), cx, y + 8, '#FFFFFF');
    Font.center(c, '房主 ' + R.owner, cx, y + 20, '#A0A0A0');
    const qs = Math.min(h - 70, 90);
    if (this.qr) { c.fillStyle = '#FFFFFF'; c.fillRect(cx - qs / 2 - 3, y + 32, qs + 6, qs + 6); c.drawImage(this.qr, cx - qs / 2, y + 35, qs, qs); }
    else { c.strokeStyle = '#555555'; c.strokeRect(cx - qs / 2 + 0.5, y + 35.5, qs, qs); Font.center(c, this.inToy === false ? '用邀请码加入' : '二维码…', cx, y + 30 + qs / 2, '#808080'); }
    c.save(); c.translate(cx, y + qs + 44); c.scale(2, 2); Font.center(c, R.code, 0, 0, '#FFD24A'); c.restore();
    Font.center(c, fitText('扫码或在「多人游戏」里输入邀请码加入', w - 12), cx, y + qs + 66, '#A0A0A0');
    if (this.note) Font.center(c, this.note, cx, ui.h - 64, '#80FF80');
  }
  onEsc() { this.game.ui.open(this.parent); }
}
(() => {
  // the room screen's invite buttons: a gold one opening the card
  const lay = RoomScreen.prototype.layout;
  RoomScreen.prototype.layout = function () {
    lay.call(this);
    const R = this.R; if (!R) return;
    const i = this.widgets.findIndex((w) => w.label === '复制邀请码'), j = this.widgets.findIndex((w) => w.label === '复制链接');
    if (i >= 0 && j >= 0) {
      const a = this.widgets[i], b = this.widgets[j];
      this.widgets.splice(Math.max(i, j), 1); this.widgets.splice(Math.min(i, j), 1);
      this.widgets.push({ x: a.x, y: a.y, w: b.x + b.w - a.x, h: a.h, gold: true, label: '邀请朋友…', onClick: () => this.game.ui.open(new InviteCardScreen(this.game, this)) });
    }
  };
})();

// ---- the page closing inside Toy: leave the room cleanly, send the last statistics ----
Toy.onPageClose(() => {
  const g = typeof game !== 'undefined' && game;
  try { if (g && g.net) g.net.close && g.net.close(); } catch (e) { }
}).catch(() => { });

// ---- announcements from the administrators (rooms/server.js announce): in the chat in gold and over the hotbar, for
// everyone playing - in a room they come at once, otherwise the page asks once a minute; each shown once (the last
// one seen kept in this browser), and on a page just opened only those of the last 10 minutes ----
function showAnnounce(g, a) {
  let seen = 0; try { seen = +localStorage.getItem('mcjs-announce') || 0; } catch (e) { }
  if (!a || a.id <= seen) return;
  try { localStorage.setItem('mcjs-announce', String(a.id)); } catch (e) { }
  g.ui.message('[公告] ' + a.text, '#FFAA00');
  g.ui.actionBar = { text: '公告：' + a.text, t: performance.now(), color: '#FFAA00' };
  Sound.ev && Sound.ev('block.note_block.bell', null, 0.6, 1.2);
}
(() => {
  const opened = Date.now();
  setInterval(async () => {
    const g = typeof game !== 'undefined' && game;
    if (!g || g.state !== 'play' || g.net || typeof RoomService === 'undefined' || !RoomService.base()) return;
    let seen = 0; try { seen = +localStorage.getItem('mcjs-announce') || 0; } catch (e) { }
    try {
      const r = await RoomService.api('/api/announce?after=' + Math.max(seen, opened - 10 * 60e3));
      for (const a of r.list || []) showAnnounce(g, a);
    } catch (e) { }
  }, 60e3);
})();
