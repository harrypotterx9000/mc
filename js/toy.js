'use strict';
// ---------------------------------------------------------------------------
// The Toy SDK (Bilibili Toy pages): the game runs in an iframe of www.bilibilitoy.com inside bilibili.com/toy/<slug>/,
// and asks the host page for the user's profile, whether they follow the UP, their 三连 on the bound video, content
// checks, sharing, the container mode (landscape / immersive) and the page-close event. The host's protocol (read
// from toy-host.js, see game/TOY_SDK.md): {ns:'toy-sdk-rpc', type:'ready'} -> 'hello'; {type:'request', id, payload:
// {kind, ...}} -> {type:'response', id, payload:{ok, data} | {ok:false, error, errorType, code}}; events
// {type:'event', payload:{event:'containerChange' | 'pageClose', state}}.
// Outside Toy (plain browser, localhost) every call fails with type 'unsupported'. ?toymock=1 (or localStorage
// 'toymock') pretends to be inside Toy with a small panel to switch login / follow / 三连 / environment, for testing
// (localhost and Toy preview pages only).
// ---------------------------------------------------------------------------
class ToyError extends Error {
  constructor(type, message, code) { super(message || type); this.type = type; this.code = code; }
}
const Toy = (() => {
  const NS = 'toy-sdk-rpc';
  // the UP (Toy author) and the video whose 三连 counts; the room service's gate config can replace the video
  const AUTHOR_MID = 1987439458;
  let inIframe = false;
  try { inIframe = window.parent && window.parent !== window; } catch (e) { inIframe = true; }
  let nextId = 1, hello = null, meta = null;
  const wait = new Map(), listeners = { containerChange: [], pageClose: [] };
  const last = {}; // the raw answers, for the diagnostics screen

  // ---- mock (testing outside Toy) ----
  let mock = null;
  const newMockId = () => 'mock-' + Math.random().toString(36).slice(2, 12);
  // only on this machine and on Toy preview pages: the published page never pretends (the server can't check what
  // the page reports anyway, but there is no need to hand out the switch)
  const mockable = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.pathname.includes('/toy/preview/');
  try {
    if (!mockable) { if (localStorage.getItem('toymock') !== null) localStorage.removeItem('toymock'); throw 0; }
    const q = new URLSearchParams(location.search).get('toymock');
    if (q !== null) localStorage.setItem('toymock', q === '0' ? '' : (localStorage.getItem('toymock') || '{}'));
    const s = localStorage.getItem('toymock');
    if (s) mock = Object.assign({ env: 'app', login: true, follow: false, triple: false, deny: false, nickname: '测试玩家' }, JSON.parse(s));
    // (each browser is its own Bilibili user: one shared id would make every tester the same account, unlocks and all)
    if (mock && (!mock.openId || mock.openId === 'mock-open-id-0001')) { mock.openId = newMockId(); localStorage.setItem('toymock', JSON.stringify(mock)); }
  } catch (e) { mock = null; }
  const saveMock = () => { try { localStorage.setItem('toymock', JSON.stringify(mock)); } catch (e) { } };

  function onMessage(e) {
    const d = e.data;
    if (!d || typeof d !== 'object' || d.ns !== NS || e.source !== window.parent) return;
    if (d.type === 'hello') { meta = d.meta || {}; if (hello) hello.res(true); return; }
    if (d.type === 'response') {
      const w = wait.get(d.id); if (!w) return;
      wait.delete(d.id); clearTimeout(w.t);
      const p = d.payload || {};
      if (p.ok) w.res(p.data); else w.rej(new ToyError(p.errorType || 'unknown', p.error, p.code));
      return;
    }
    if (d.type === 'event' && d.payload) for (const f of listeners[d.payload.event] || []) { try { f(d.payload.state); } catch (err) { console.warn('toy event', err); } }
  }
  if (inIframe && !mock) window.addEventListener('message', onMessage);

  // in Toy? (the host answers the hello within a second or two; a plain page never does)
  function ready() {
    if (mock) return Promise.resolve(mock.env !== 'none');
    if (!inIframe) return Promise.resolve(false);
    if (!hello) {
      let res;
      const p = new Promise((r) => { res = r; });
      hello = { p, res };
      const send = () => { try { window.parent.postMessage({ ns: NS, type: 'ready' }, '*'); } catch (e) { } };
      send(); setTimeout(send, 500); setTimeout(send, 1500);
      setTimeout(() => res(false), 4000);
    }
    return hello.p;
  }
  async function call(kind, payload = {}, timeout = 15000) {
    if (mock) return mockCall(kind, payload);
    if (!(await ready())) throw new ToyError('unsupported', '不在 B站 Toy 页面里');
    const id = 'g' + nextId++;
    return new Promise((res, rej) => {
      const t = setTimeout(() => { wait.delete(id); rej(new ToyError('timeout', '宿主没有回应')); }, timeout);
      wait.set(id, { res, rej, t });
      window.parent.postMessage({ ns: NS, type: 'request', id, payload: { kind, ...payload } }, '*');
    });
  }
  const jsb = (method, params) => call('jsb', { method, params: params || {} });
  // 307044: the shared rate limit - wait and try again (doubling), a few times
  async function withBackoff(f) {
    let d = 1000;
    for (let i = 0; ; i++) {
      try { return await f(); } catch (e) {
        if (!(e && e.code === 307044) || i >= 3) throw e;
        await new Promise((r) => setTimeout(r, d + Math.random() * 500)); d *= 2;
      }
    }
  }

  // ---- reading the answers (the field names of relation / video actions aren't in the host code: several spellings) ----
  const yes = (v) => v === true || v === 1 || v === '1' || v === 'true' || (typeof v === 'number' && v > 0);
  function pick(o, keys) {
    if (!o || typeof o !== 'object') return undefined;
    for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
    // (not "stat": a video's own totals - its like count is not this user's like)
    for (const k of ['data', 'relation', 'result', 'actions', 'action', 'user_action', 'userAction', 'status_info']) if (o[k] && typeof o[k] === 'object') { const v = pick(o[k], keys); if (v !== undefined) return v; }
    return undefined;
  }
  function followingOf(d) {
    if (!d || d.status === 'unsupported') return null;
    const v = pick(d, ['following', 'is_following', 'isFollowing', 'followed', 'is_followed', 'is_follow', 'isFollow', 'follow', 'subscribed', 'attention']);
    if (v !== undefined) return yes(v) || v === 'following' || v === 'followed';
    const a = pick(d, ['attribute', 'relation_type', 'relationType']); // bilibili's relation codes: 2 following, 6 both
    if (a !== undefined) return a === 2 || a === 6 || a === '2' || a === '6';
    if (typeof d.status === 'string' && /^(following|followed|mutual)$/.test(d.status)) return true;
    if (typeof d.relation === 'string') return /follow|mutual/.test(d.relation);
    return false;
  }
  // BV -> av (Bilibili's published scheme: base 58 in a fixed alphabet, two pairs of places swapped, a xor mask)
  const BV_T = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf';
  function bvToAv(bv) {
    try {
      const s = [...String(bv)]; if (s.length !== 12) return null;
      [s[3], s[9]] = [s[9], s[3]]; [s[4], s[7]] = [s[7], s[4]];
      let r = 0n; for (const c of s.slice(3)) { const i = BV_T.indexOf(c); if (i < 0) return null; r = r * 58n + BigInt(i); }
      return Number((r & 2251799813685247n) ^ 23442827791579n);
    } catch (e) { return null; }
  }
  const LIKE = ['like', 'liked', 'is_like', 'isLike', 'is_liked', 'isLiked', 'has_like', 'hasLike', 'thumb_up', 'thumbUp'];
  // (Bilibili's answer, 2026-10-31: {liked, coinCount, favorited} - the coins this user put in)
  const COIN = ['coinCount', 'coin_count', 'coin', 'coined', 'coins', 'is_coin', 'isCoin', 'is_coined', 'isCoined', 'has_coin', 'hasCoin', 'coin_number', 'coinNumber', 'multiply'];
  const FAV = ['favorite', 'favorited', 'favourite', 'fav', 'favored', 'favoured', 'is_fav', 'isFav', 'is_favorite', 'isFavorite', 'has_fav', 'hasFav', 'collect', 'collected', 'is_collect'];
  // done or not: the known field names first, then any field whose name says it (a video's own totals - "stat" and
  // "*count*" - left out); a value that is an object is looked into (status / value / count / number / done)
  const yesVal = (v) => (v && typeof v === 'object' ? ['status', 'value', 'count', 'number', 'num', 'done', 'state', 'is', 'has'].some((k) => v[k] !== undefined && yes(v[k])) : yes(v));
  function yesOf(it, keys, re, depth = 0) {
    const v = pick(it, keys);
    if (v !== undefined && yesVal(v)) return true;
    if (!it || typeof it !== 'object' || depth > 2) return false;
    for (const [k, x] of Object.entries(it)) {
      if (/^(stat|stats)$/i.test(k) || /count|total/i.test(k)) continue;
      if (re.test(k) && yesVal(x)) return true;
      if (x && typeof x === 'object' && yesOf(x, keys, re, depth + 1)) return true;
    }
    return false;
  }
  // the per-video records in Bilibili's answer, whatever its shape: an array (at the top or a level or two down), an
  // object keyed by video (BV… / an av number)
  function itemsOf(d, depth = 0) {
    if (Array.isArray(d)) return d.filter((x) => x && typeof x === 'object');
    if (!d || typeof d !== 'object' || depth > 2) return [];
    const ks = Object.keys(d);
    if (ks.length && ks.every((k) => /^(BV\w+|\d+)$/i.test(k))) return ks.map((k) => d[k]).filter((x) => x && typeof x === 'object');
    for (const k of ['items', 'list', 'videos', 'data', 'result', 'actions']) if (d[k] && typeof d[k] === 'object') { const r = itemsOf(d[k], depth + 1); if (r.length) return r; }
    return [];
  }
  function tripleOf(d) {
    if (!d || d.status === 'unsupported') return null;
    let items = itemsOf(d);
    if (!items.length && (pick(d, LIKE) !== undefined || pick(d, COIN) !== undefined || pick(d, FAV) !== undefined)) items = [d]; // (one video, at the top)
    // (nothing readable is "don't know", not "none of the three": the page says so instead of "all done")
    if (!items.length) return null;
    const one = (it) => ({ like: yesOf(it, LIKE, /like|thumb/i), coin: yesOf(it, COIN, /coin|multiply/i), fav: yesOf(it, FAV, /fav|collect/i) });
    const all = items.map(one);
    return { like: all.every((a) => a.like), coin: all.every((a) => a.coin), fav: all.every((a) => a.fav), all: all.every((a) => a.like && a.coin && a.fav) };
  }

  const api = {
    ToyError, AUTHOR_MID, last,
    get mock() { return mock; },
    ready,
    async inToy() { return ready(); },
    // {nickname, avatar, toyOpenId}
    async profile() {
      // (30 s: the first call waits on Bilibili's data-consent window)
      const d = await call('getUserProfile', {}, 30000);
      last.profile = d;
      return { nickname: d.uname || d.nickname || '', avatar: d.face || d.avatar || '', toyOpenId: d.toyOpenId || d.toy_open_id || '' };
    },
    // true / false, or null where it can't be known (an external mobile browser)
    async following() {
      const d = await withBackoff(() => call('authorRelation'));
      last.relation = d;
      return followingOf(d);
    },
    // {like, coin, fav, all} on all the videos, or null where it can't be known
    async triple(videos) {
      if (!videos || !videos.length) return null;
      const bv = videos.filter((v) => /^BV/i.test(v)), av = videos.filter((v) => /^\d+$/.test(String(v))).map(Number).concat(bv.map(bvToAv).filter(Boolean));
      // (the host's call answered -400 to {videos: [BV…]} on 2026-10-31: the av numbers next, then the app's own call;
      // the first answer that can be read is used, and which way it came goes to the statistics)
      const tries = [];
      if (bv.length) tries.push(['bv', () => call('videoUserActions', { videos: bv })]);
      if (av.length) tries.push(['av', () => call('videoUserActions', { aids: av })]);
      if (bv.length) tries.push(['app-bv', () => jsb('toy.getVideoUserActions', { videos: bv })]);
      if (av.length) tries.push(['app-av', () => jsb('toy.getVideoUserActions', { aids: av })]);
      let err = null;
      for (const [how, f] of tries) {
        try {
          let d = await withBackoff(f);
          if (d && d.code === 0 && d.data) d = d.data; // (the app's own call: the HTTP answer as it came)
          last.videoActions = d; last.videoActionsHow = how;
          const t = tripleOf(d);
          if (t !== null) {
            return t;
          }
        } catch (e) { err = err || e; last.videoActionsErrs = (last.videoActionsErrs || []).concat([`${how}: ${e.code || ''} ${e.message}`]).slice(-8); }
      }
      if (err) throw err;
      return null;
    },
    // the platform's content check: {passed, status}; outside Toy (or when its check is unavailable) passed is true
    async checkText(text, scene) {
      try { const d = await call('inputSafety', { text: String(text).slice(0, 500), scene }); return { passed: d.status === 'unavailable' ? true : !!d.passed, status: d.status }; }
      catch (e) { return { passed: true, status: 'unavailable' }; }
    },
    navigate(type, id) { return call('navigate', { req: { type, id: String(id) } }); },
    // inside the Bilibili app its own pages (bilibili://video/<av>, bilibili://space/<mid>) - the host's navigate opens
    // the web page in a separate window there; if the page isn't left within a moment (the app didn't take it), the
    // web page after all
    async openNative(url, type, id) {
      if (/BiliApp|BiliHarmony/i.test(navigator.userAgent)) {
        // (the app's navigate: the SDK's own form first, then a bilibili:// address; each given a moment to take the
        // page away - hidden, or the window losing focus)
        const left = () => new Promise((res) => {
          if (document.hidden) return res(true);
          let done = false; const end = (v) => { if (done) return; done = true; document.removeEventListener('visibilitychange', vis); window.removeEventListener('blur', end1); res(v); };
          const vis = () => { if (document.hidden) end(true); }, end1 = () => end(true);
          document.addEventListener('visibilitychange', vis); window.addEventListener('blur', end1);
          setTimeout(() => end(document.hidden), 1500);
        });
        for (const p of [{ type, id: String(id) }, { url }]) {
          try { await jsb('toy.navigate', p); if (await left()) return; } catch (e) { }
        }
      }
      return this.navigate(type, id);
    },
    openVideo(bv) { const av = /^BV/i.test(bv) ? bvToAv(bv) : Number(bv); return av ? this.openNative('bilibili://video/' + av, 'video', bv) : this.navigate('video', bv); },
    openAuthor() { return this.openNative('bilibili://space/' + AUTHOR_MID, 'space', AUTHOR_MID); },
    share(path) { return call('share', { req: { path: path || '/' } }); },
    qrCode(path, size) { return call('qrCode', { req: { path: path || '/', size: size || 240 } }); },
    sharePicture(params) { return jsb('toy.sharePicture', params); },
    saveImage(params) { return jsb('toy.saveImageToAlbum', params); },
    setContainerMode(params) { return jsb('toy.setContainerMode', params); },
    containerState() { return jsb('toy.getContainerState'); },
    abilities() { return jsb('toy.getAbilities'); },
    closeBrowser() { return jsb('toy.closeBrowser'); },
    report(action, extra) { return jsb('toy.reportAction', { action, ...(extra || {}) }).catch(() => { }); },
    async onContainerChange(f) { listeners.containerChange.push(f); try { await call('containerSubscribe', { op: 'add' }); } catch (e) { } },
    async onPageClose(f) { listeners.pageClose.push(f); try { await call('playerSubscribe', { op: 'add', channel: 'pageClose' }); } catch (e) { } },
    // a short Chinese line for an error, for the screens
    explain(e) {
      const t = e && e.type;
      return t === 'not_logged_in' ? 'B站说你还没登录：在 B站 App 里登录后重新打开，或者用识别码登录'
        : t === 'user_denied' ? '你拒绝了授权，可以再试一次'
          : t === 'unsupported' ? '这里用不了：请在 B站 App 或电脑网页上打开'
            // (the host page not answering is not the player's network - 3115 times on 2026-11-02, players with full
            // Wi-Fi told "网络不太好"; and "unauthorized" is a Bilibili page nobody is logged in on)
            : t === 'timeout' ? 'B站页面没回应（不是网络问题）：请点同意授权，或重开游戏、用识别码登录'
              : t === 'network_error' ? '连 B站 时网络出错，请稍后再试'
                : /unauthori[sz]ed/i.test((e && e.message) || '') ? '这个页面没登录 B站：先登录 B站 再打开游戏，或者用识别码登录'
              : e && e.code === 307044 ? '请求太频繁，请稍后再试'
                : '出错了：' + ((e && e.message) || '未知错误');
    },
  };

  // ---- the mock: the same answers the host gives, from the panel's switches ----
  async function mockCall(kind, p) {
    await new Promise((r) => setTimeout(r, 250));
    const unsup = mock.env === 'mobileweb' || mock.env === 'none';
    if (mock.env === 'none') throw new ToyError('unsupported', 'mock: 不在 Toy');
    switch (kind) {
      case 'getUserProfile':
        if (unsup) throw new ToyError('unsupported', 'mock: 外部浏览器');
        if (!mock.login) throw new ToyError('not_logged_in', 'mock: 未登录');
        if (mock.deny) throw new ToyError('user_denied', 'mock: 拒绝授权');
        return { face: '', uname: mock.nickname, toyOpenId: mock.openId };
      case 'authorRelation':
        if (unsup) return { status: 'unsupported' };
        if (!mock.login) throw new ToyError('not_logged_in', 'mock: 未登录');
        return { following: !!mock.follow };
      case 'videoUserActions':
        if (unsup) return { status: 'unsupported', items: [] };
        if (!mock.login) throw new ToyError('not_logged_in', 'mock: 未登录');
        return { items: (p.videos || p.aids || []).map((v) => ({ bvid: v, like: !!mock.triple, coin: mock.triple ? 1 : 0, favorite: !!mock.triple })) };
      case 'inputSafety': return { status: /违规|测试违禁/.test(p.text) ? 'risky' : 'ok', passed: !/违规|测试违禁/.test(p.text) };
      case 'navigate':
        // the user goes and does it: the next check sees it
        if (p.req.type === 'video') mock.pendingTriple = true;
        if (p.req.type === 'space') mock.pendingFollow = true;
        setTimeout(() => { if (mock.pendingTriple) mock.triple = true; if (mock.pendingFollow) mock.follow = true; mock.pendingTriple = mock.pendingFollow = false; saveMock(); panel(); }, 1500);
        return null;
      case 'share': return null;
      case 'qrCode': return { base64: '', url: location.href };
      case 'jsb':
        if (p.method === 'toy.getContainerState') return { deviceType: 'phone', orientation: 'landscape', immersive: true, safeArea: { top: 0, right: 0, bottom: 0, left: 0 }, viewport: { width: innerWidth, height: innerHeight } };
        if (p.method === 'toy.getAbilities') return { abilities: unsup ? [] : ['getUserProfile', 'getAuthorRelation', 'getVideoUserActions', 'setContainerMode', 'sharePicture'] };
        return null;
      case 'containerSubscribe': case 'playerSubscribe': return null;
    }
    throw new ToyError('unsupported', 'mock: ' + kind);
  }
  // the panel (top right): environment, logged in, refuse, following, 三连
  function panel() {
    if (!mock) return;
    let el = document.getElementById('toymock');
    if (!el) {
      el = document.createElement('div'); el.id = 'toymock';
      el.style.cssText = 'position:fixed;top:4px;right:4px;z-index:99;background:rgba(0,0,0,.75);color:#fff;font:12px sans-serif;padding:6px;border:1px solid #fb7299;border-radius:4px';
      document.body.appendChild(el);
      el.addEventListener('change', (e) => { const t = e.target; mock[t.name] = t.type === 'checkbox' ? t.checked : t.value; saveMock(); });
      // a brand-new Bilibili user: nothing followed, the game's account logged out, then the page again
      // or a whole new player: also this browser's settings, first run, room key, skin choices and statistics id
      // forgotten (the worlds on this device stay)
      el.addEventListener('click', async (e) => {
        const n = e.target.name;
        if (n !== 'fresh' && n !== 'newbie') return;
        const g = typeof game !== 'undefined' ? game : null;
        if (n === 'newbie' && g && g.state === 'play') { e.target.textContent = '请先退回标题界面'; return; }
        Object.assign(mock, { openId: newMockId(), login: true, follow: false, triple: false, deny: false }); saveMock();
        try { if (typeof Account !== 'undefined') await Account.logout(); } catch (err) { }
        if (n === 'newbie') {
          // (nothing may write them back while the page goes)
          if (g) g.saveSettings = () => { };
          if (typeof Account !== 'undefined') Account.save = () => { };
          for (const k of Object.keys(localStorage)) if (/^mcjs-(settings|account|room-key|tid|skin-)/.test(k)) localStorage.removeItem(k);
        }
        location.reload();
      });
    }
    const cb = (k, t) => `<label style="display:block"><input type="checkbox" name="${k}" ${mock[k] ? 'checked' : ''}> ${t}</label>`;
    el.innerHTML = '<b style="color:#fb7299">Toy 模拟</b>'
      + `<select name="env" style="display:block;margin:3px 0">${[['app', 'B站 App'], ['web', '电脑网页'], ['mobileweb', '手机外部浏览器'], ['none', '不在 Toy']].map(([v, t]) => `<option value="${v}" ${mock.env === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`
      + cb('login', '已登录 B站') + cb('deny', '拒绝授权') + cb('follow', '已关注') + cb('triple', '已三连')
      + '<button name="fresh" style="display:block;width:100%;margin-top:4px;font:12px sans-serif" title="换一个从没玩过的 B站 用户（退出游戏账号并刷新；设置不变）">换新 B站 用户</button>'
      + '<button name="newbie" style="display:block;width:100%;margin-top:3px;font:12px sans-serif" title="模拟第一次打开游戏的新玩家：新 B站 用户、清空设置和首次进入记录（这台设备上的世界保留）">新玩家进入</button>';
  }
  if (mock) { if (document.body) panel(); else addEventListener('DOMContentLoaded', panel); }
  api.panel = panel;
  return api;
})();
