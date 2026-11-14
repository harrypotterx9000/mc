'use strict';
// ---------------------------------------------------------------------------
// The platform around the game: the invite card (copy the link or the code),
// and leaving the room when the page goes away. The Bilibili Toy SDK - its
// content check, share sheet, QR code and page-close bridge - was removed
// together with the account system in phase-03; the game now runs in a plain
// browser. Content checks belong to the self-hosted server (phase-05).// ---------------------------------------------------------------------------

// ---- 邀请卡片: the room's name and code, copy the link or the code ----
class InviteCardScreen extends MenuScreen {
  constructor(game, parent) {
    super(game, '邀请朋友'); this.parent = parent; this.pauses = false; this.titleY = 8; this.note = '';
  }
  get R() { return this.game.net && this.game.net.room; }
  layout() {
    const u = this.game.ui, cx = u.w / 2, R = this.R, y = u.h - 52;
    this.widgets = [];
    if (R) this.widgets.push(
      { x: cx - 152, y, w: 98, h: 20, gold: true, label: '复制链接', onClick: async () => { this.note = (await copyText(RoomService.link(R.code))) ? '链接已复制，发给朋友吧' : '复制失败，请抄下邀请码'; } },
      { x: cx - 50, y, w: 98, h: 20, label: '复制邀请码', onClick: async () => { this.note = (await copyText(R.code)) ? '邀请码已复制' : '复制失败，请抄下邀请码'; } },
      { x: cx + 52, y, w: 100, h: 20, label: '完成', onClick: () => this.game.ui.open(this.parent) },
    );
    else this.widgets.push({ x: cx - 100, y, w: 200, h: 20, label: '完成', onClick: () => this.game.ui.open(this.parent) });
  }
  drawExtra(ui) {
    const c = ui.ctx, cx = ui.w / 2, R = this.R;
    if (!R) { Font.center(c, '不在房间里', cx, 60, '#A0A0A0'); return; }
    const w = 230, h = ui.h - 92, x = Math.floor(cx - w / 2), y = 22;
    drawCard(c, x, y, w, h, true);
    Font.center(c, fitText(R.name, w - 16), cx, y + 8, '#FFFFFF');
    Font.center(c, '房主 ' + R.owner, cx, y + 20, '#A0A0A0');
    c.save(); c.translate(cx, y + 58); c.scale(2, 2); Font.center(c, R.code, 0, 0, '#FFD24A'); c.restore();
    Font.center(c, '把邀请码或链接发给朋友', cx, y + 86, '#FFFFFF');
    Font.center(c, '他们在「多人游戏」里输入就能加入', cx, y + 100, '#A0A0A0');
    if (this.note) Font.center(c, fitText(this.note, w - 12), cx, y + 122, '#80FF80');
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

// ---- the page going away: leave the room cleanly and keep the short reconnect hint ----
window.addEventListener('pagehide', () => {
  const g = typeof game !== 'undefined' && game;
  try { if (g && g.net) g.net.close && g.net.close(); } catch (e) { }
  try { GuestSession.suspend(); } catch (e) { }
});

// ---- announcements from the administrators (the room service's announce): in the chat in gold and over the hotbar,
// for everyone playing - in a room they come at once, otherwise the page asks once a minute; each shown once (the
// last one seen kept in this browser), and on a page just opened only those of the last 10 minutes ----
function showAnnounce(g, a) {
  const seen = +Platform.storage.local.get('mcjs-announce') || 0;
  if (!a || a.id <= seen) return;
  Platform.storage.local.set('mcjs-announce', String(a.id));
  g.ui.message('[公告] ' + a.text, '#FFAA00');
  g.ui.actionBar = { text: '公告：' + a.text, t: performance.now(), color: '#FFAA00' };
  Sound.ev && Sound.ev('block.note_block.bell', null, 0.6, 1.2);
}
(() => {
  const opened = Date.now();
  // phase-04: off by default. The original room service is a third-party platform; a standalone single-player
  // session does not ask it for announcements every minute. phase-05's own server turns this back on.
  if (!window.NET_CONFIG || NET_CONFIG.announce !== true) return;
  setInterval(async () => {
    const g = typeof game !== 'undefined' && game;
    if (!g || g.state !== 'play' || g.net || typeof RoomService === 'undefined' || !RoomService.base()) return;
    const seen = +Platform.storage.local.get('mcjs-announce') || 0;
    try {
      const r = await RoomService.api('/api/announce?after=' + Math.max(seen, opened - 10 * 60e3));
      for (const a of r.list || []) showAnnounce(g, a);
    } catch (e) { }
  }, 60e3);
})();
