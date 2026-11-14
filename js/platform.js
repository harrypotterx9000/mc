'use strict';
// ---------------------------------------------------------------------------
// Platform: the one place that talks to the browser's own capabilities.
//
// The game is a plain browser application: Canvas 2D for the interface, WebGL2 for the world, Keyboard /
// Mouse / Pointer / Touch events for input, Web Audio for sound, IndexedDB + localStorage for saves, Web
// Workers for world generation and fetch/XHR/WebSocket for the network. This module detects what the current
// browser actually offers, isolates the few vendor differences (fullscreen, pointer lock, audio context,
// safe-area insets), resolves local resource URLs against the page (never a platform container), and shows a
// readable compatibility screen when something essential is missing.
//
// It deliberately does NOT abstract game logic or rename browser APIs everywhere: call sites keep using the
// platform they need and go through here only where a capability check, fallback or a real browser quirk is
// involved.
// ---------------------------------------------------------------------------
const Platform = (() => {
  const ua = navigator.userAgent || '';
  const touchPoints = navigator.maxTouchPoints || 0;
  const iPadOS = /Macintosh/.test(ua) && touchPoints > 1;
  const iOS = /iPhone|iPad|iPod/.test(ua) || iPadOS;
  const android = /Android/i.test(ua);
  const mobile = !!(navigator.userAgentData && navigator.userAgentData.mobile) || iOS || android || /Mobile|HarmonyOS|OpenHarmony/i.test(ua);
  const touch = touchPoints > 0 || 'ontouchstart' in window;
  const chromium = /(Chrome|Chromium)\//.test(ua) && !/Edg\//.test(ua);
  const edge = /Edg\//.test(ua);
  const firefox = /Firefox\//.test(ua);
  const safari = /Safari\//.test(ua) && !chromium && !edge && !firefox && !/Android/.test(ua);
  const windows = /Windows NT/i.test(ua);
  const macOS = /Macintosh/i.test(ua) && !iPadOS;
  const linux = /Linux/i.test(ua) && !android;
  const platformName = iOS ? (iPadOS ? 'iPadOS' : 'iOS') : android ? 'Android' : windows ? 'Windows' : macOS ? 'macOS' : linux ? 'Linux' : '未知平台';
  const versionOf = (re) => { const m = re.exec(ua); return m ? m[1] : ''; };
  const browserName = edge ? 'Edge' : chromium ? 'Chrome' : firefox ? 'Firefox' : safari ? 'Safari' : iOS ? 'iOS WebKit' : '未知浏览器';
  const browserVersion = versionOf(/Edg\/([\d.]+)/) || versionOf(/Chrome\/([\d.]+)/) || versionOf(/Firefox\/([\d.]+)/) || versionOf(/Version\/([\d.]+).*Safari/) || '';

  const protocol = location.protocol || '';
  const fileProtocol = protocol === 'file:';

  // ---- capability probes ---------------------------------------------------------------------------
  const canvas2d = (() => { try { const c = document.createElement('canvas'); return !!c.getContext('2d'); } catch (e) { return false; } })();
  const webgl2 = (() => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2');
      if (!gl) return false;
      // release the probe context at once; the renderer makes its own
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return true;
    } catch (e) { return false; }
  })();
  const storageProbe = (name) => {
    try {
      const s = window[name];
      if (!s) return false;
      const k = '__opusmc_probe__';
      s.setItem(k, '1');
      const ok = s.getItem(k) === '1';
      s.removeItem(k);
      return ok;
    } catch (e) { return false; }
  };
  const caps = {
    canvas2d,
    webgl2,
    workers: typeof Worker === 'function',
    indexedDB: !!window.indexedDB,
    localStorage: storageProbe('localStorage'),
    sessionStorage: storageProbe('sessionStorage'),
    webAudio: !!(window.AudioContext || window.webkitAudioContext),
    audioDecode: !!(window.AudioContext || window.webkitAudioContext),
    pointerEvents: typeof PointerEvent !== 'undefined',
    touch,
    keyboard: typeof KeyboardEvent !== 'undefined',
    pointerLock: typeof document.documentElement.requestPointerLock === 'function' || typeof Element !== 'undefined' && typeof Element.prototype.requestPointerLock === 'function',
    fullscreen: typeof document.documentElement.requestFullscreen === 'function' || typeof document.documentElement.webkitRequestFullscreen === 'function',
    vibrate: typeof navigator.vibrate === 'function',
    deviceMotion: typeof DeviceMotionEvent !== 'undefined',
    orientation: !!(screen.orientation && typeof screen.orientation.lock === 'function') || typeof window.orientation !== 'undefined',
    visualViewport: !!window.visualViewport,
    fetch: typeof fetch === 'function',
    websocket: typeof WebSocket === 'function',
    fileAPI: !!(window.File && window.FileList && window.FileReader && window.Blob && window.URL && URL.createObjectURL),
    directoryPick: false,
    online: navigator.onLine !== false,
  };
  try { caps.directoryPick = 'webkitdirectory' in document.createElement('input'); } catch (e) { }

  const errors = [];
  const record = (where, e) => {
    const text = String(e && e.stack || e && e.message || e || '未知错误');
    errors.push({ where, text, at: Date.now() });
    if (errors.length > 40) errors.shift();
  };

  // ---- local storage ----------------------------------------------------------------------------
  // A thin safe wrapper: Safari's private mode and a full quota throw from setItem, a sandboxed iframe can
  // throw from just reading. A failed write stays in a per-page shadow so the current session still works;
  // an unavailable backend falls back to the same shadow.
  function storage(kind) {
    const memory = new Map();
    const store = (() => { try { return window[kind === 'session' ? 'sessionStorage' : 'localStorage'] || null; } catch (e) { return null; } })();
    // the probe above already wrote and removed a key; a store that threw there is used through the memory shadow
    let working = !!store && !!(kind === 'session' ? caps.sessionStorage : caps.localStorage);
    return {
      get available() { return working; },
      backend() { return working && store ? 'browser' : 'memory'; },
      get(key) {
        if (memory.has(key)) return memory.get(key);
        if (!store) return null;
        try { return store.getItem(key); } catch (e) { working = false; return null; }
      },
      set(key, value) {
        const text = String(value);
        if (store) {
          try { store.setItem(key, text); working = true; memory.delete(key); return true; }
          catch (e) { working = false; }
        }
        memory.set(key, text);
        return false;
      },
      remove(key) {
        memory.delete(key);
        if (!store) return;
        try { store.removeItem(key); } catch (e) { working = false; }
      },
      keys(prefix) {
        const out = new Set(memory.keys());
        if (store) {
          try { for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && k.startsWith(prefix)) out.add(k); } }
          catch (e) { working = false; }
        }
        return [...out].filter((k) => k.startsWith(prefix));
      },
      getJSON(key, fallback = null) {
        const raw = this.get(key);
        if (raw == null) return fallback;
        try { return JSON.parse(raw); } catch (e) { return fallback; }
      },
      setJSON(key, value) { return this.set(key, JSON.stringify(value)); },
    };
  }
  const local = storage('local');
  const session = storage('session');

  // ---- display: safe area, viewport, fullscreen, orientation --------------------------------------
  let safeProbe = null;
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const safeArea = () => {
    try {
      if (!safeProbe || !safeProbe.isConnected) {
        safeProbe = document.createElement('div');
        safeProbe.id = 'platform-safe-probe';
        safeProbe.setAttribute('aria-hidden', 'true');
        safeProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
        (document.body || document.documentElement).appendChild(safeProbe);
      }
      const cs = getComputedStyle(safeProbe);
      return { top: num(cs.paddingTop), right: num(cs.paddingRight), bottom: num(cs.paddingBottom), left: num(cs.paddingLeft) };
    } catch (e) { return { top: 0, right: 0, bottom: 0, left: 0 }; }
  };
  const viewport = () => {
    try {
      const vv = window.visualViewport;
      return {
        w: Math.max(1, Math.round(vv && vv.width ? vv.width : innerWidth)),
        h: Math.max(1, Math.round(vv && vv.height ? vv.height : innerHeight)),
        dpr: Math.max(1, Math.min(window.devicePixelRatio || 1, 3)),
        top: vv ? Math.round(vv.offsetTop || 0) : 0,
        left: vv ? Math.round(vv.offsetLeft || 0) : 0,
      };
    } catch (e) { return { w: Math.max(1, innerWidth), h: Math.max(1, innerHeight), dpr: 1, top: 0, left: 0 }; }
  };
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
  const fullscreen = {
    supported: caps.fullscreen,
    element: fsElement,
    isFullscreen() { return !!fsElement(); },
    request(el = document.documentElement, opts) {
      try {
        if (el.requestFullscreen) return Promise.resolve(el.requestFullscreen(opts)).then(() => true, () => false);
        if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); return Promise.resolve(true); }
      } catch (e) { record('fullscreen', e); }
      return Promise.resolve(false);
    },
    exit() {
      try {
        if (document.exitFullscreen) return Promise.resolve(document.exitFullscreen()).then(() => true, () => false);
        if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); return Promise.resolve(true); }
      } catch (e) { record('fullscreen', e); }
      return Promise.resolve(false);
    },
    async toggle() { return fsElement() ? this.exit() : this.request(document.documentElement); },
    async lockLandscape() {
      try {
        if (screen.orientation && screen.orientation.lock) { await screen.orientation.lock('landscape'); return true; }
      } catch (e) { record('orientation', e); }
      return false;
    },
    lockKeys(keys) {
      try {
        if (navigator.keyboard && navigator.keyboard.lock) return Promise.resolve(navigator.keyboard.lock(keys)).then(() => true, () => false);
      } catch (e) { record('keyboard', e); }
      return Promise.resolve(false);
    },
    angle() {
      try {
        if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
        return Number(window.orientation) || 0;
      } catch (e) { return 0; }
    },
  };

  // ---- input: pointer lock ----------------------------------------------------------------------
  const pointerLock = {
    supported: caps.pointerLock,
    isLocked(el) { return !!el && document.pointerLockElement === el; },
    request(el, opts = {}) {
      if (!el || typeof el.requestPointerLock !== 'function') return Promise.resolve(false);
      const plain = () => {
        try {
          const r = el.requestPointerLock();
          return r && typeof r.then === 'function' ? Promise.resolve(r).then(() => true, () => false) : Promise.resolve(true);
        } catch (e) { record('pointerlock', e); return Promise.resolve(false); }
      };
      if (!opts.unadjustedMovement) return plain();
      try {
        const r = el.requestPointerLock({ unadjustedMovement: true });
        return (r && typeof r.then === 'function' ? Promise.resolve(r).then(() => true, () => false) : Promise.resolve(true))
          .then((ok) => ok || plain());
      } catch (e) { return plain(); }
    },
    exit() {
      try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { record('pointerlock', e); }
    },
    vibrate(ms) {
      if (!caps.vibrate) return;
      try { navigator.vibrate(ms); } catch (e) { }
    },
  };

  // ---- audio ------------------------------------------------------------------------------------
  const audio = {
    supported: caps.webAudio,
    create() {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { return new C(); } catch (e) { record('audio', e); return null; }
    },
    resume(ctx) {
      if (!ctx) return Promise.resolve(false);
      if (ctx.state !== 'suspended' && ctx.state !== 'interrupted') return Promise.resolve(true);
      try { return Promise.resolve(ctx.resume()).then(() => true, () => false); } catch (e) { return Promise.resolve(false); }
    },
  };

  // ---- resources and workers --------------------------------------------------------------------
  const resource = (path) => {
    try { return new URL(String(path), document.baseURI).href; } catch (e) { return String(path); }
  };
  const workers = {
    supported: caps.workers,
    create(path) {
      if (!caps.workers) return null;
      try { return new Worker(resource(path)); }
      catch (e) { record('worker', e); return null; }
    },
  };

  // ---- local files ------------------------------------------------------------------------------
  const files = {
    supported: caps.fileAPI,
    directoryPick: caps.directoryPick,
    pick({ directory = false, multiple = false, accept = '' } = {}) {
      if (!caps.fileAPI) return Promise.resolve(null);
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = !!multiple;
        input.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
        if (directory) input.webkitdirectory = true;
        if (accept) input.accept = accept;
        let done = false, timer = 0;
        const finish = (value) => {
          if (done) return;
          done = true; clearTimeout(timer);
          input.remove();
          resolve(value);
        };
        input.addEventListener('change', () => finish(input.files && input.files.length ? input.files : null), { once: true });
        input.addEventListener('cancel', () => finish(null), { once: true });
        document.body.appendChild(input);
        timer = setTimeout(() => finish(null), 120000);
        try { input.click(); } catch (e) { record('files', e); finish(null); }
      });
    },
    downloadURL(url, filename) {
      if (!caps.fileAPI) return false;
      try {
        const a = document.createElement('a');
        a.href = url; a.download = filename || 'OpusMC';
        a.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(a); a.click(); a.remove();
        return true;
      } catch (e) { record('files', e); return false; }
    },
    downloadBlob(blob, filename) {
      if (!caps.fileAPI) return false;
      const url = URL.createObjectURL(blob);
      const ok = this.downloadURL(url, filename);
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { } }, 60000);
      return ok;
    },
    downloadDataURL(dataUrl, filename) { return this.downloadURL(dataUrl, filename); },
  };

  // ---- graphics ---------------------------------------------------------------------------------
  const graphics = {
    canvas2d(canvas) {
      try { return canvas && canvas.getContext('2d'); } catch (e) { record('canvas2d', e); return null; }
    },
    webgl2(canvas) {
      if (!canvas) return null;
      try {
        const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
        if (gl) this.watchContext(canvas);
        return gl || null;
      } catch (e) { record('webgl2', e); return null; }
    },
    // A lost context is not recoverable in place for this renderer (all buffers and programs are gone):
    // pause on a readable screen and let the player reload, instead of drawing a black canvas for ever.
    watchContext(canvas) {
      if (!canvas || canvas.__opusmcContextWatch) return;
      canvas.__opusmcContextWatch = true;
      canvas.addEventListener('webglcontextlost', (e) => {
        if (e && e.preventDefault) e.preventDefault();
        record('webglcontextlost', new Error('图形上下文丢失'));
        showCompat({
          title: '图形上下文已丢失',
          summary: '浏览器回收了 WebGL2 图形上下文（常见于显卡驱动重置、显存不足或页面长时间在后台）。游戏已停止渲染，重新加载即可继续。',
          retryLabel: '重新加载',
          items: [{ ok: false, label: 'WebGL2 图形上下文', hint: '已丢失' }],
        });
      }, false);
      canvas.addEventListener('webglcontextrestored', () => { /* the reload screen stays: a partial restore is not safe */ }, false);
    },
  };

  // ---- compatibility ----------------------------------------------------------------------------
  const required = () => {
    const out = [];
    if (fileProtocol) out.push({ id: 'http', ok: false, label: '通过 http(s) 访问', hint: '当前是 file:// 地址。不能直接双击 index.html：浏览器会禁止 Worker 和资源读取。请运行 node scripts/serve.mjs，再打开 http://127.0.0.1:8080/' });
    if (!caps.canvas2d) out.push({ id: 'canvas2d', ok: false, label: 'Canvas 2D 界面', hint: '浏览器没有可用的 Canvas 2D 上下文，无法绘制界面。' });
    if (!caps.webgl2) out.push({ id: 'webgl2', ok: false, label: 'WebGL2 渲染', hint: '浏览器没有可用的 WebGL2。请使用最新版 Chrome / Edge / Firefox / Safari，并在浏览器设置中开启硬件加速。' });
    return out;
  };
  const warnings = () => {
    const out = [];
    const add = (id, label, hint, notify = true) => out.push({ id, label, hint, notify });
    if (!caps.workers) add('workers', '后台线程', 'Web Worker 不可用，地形生成会退回主线程，世界加载可能明显变慢。');
    if (!caps.indexedDB) add('indexeddb', 'IndexedDB 存档', 'IndexedDB 不可用，单人世界会改用 localStorage，容量更小。');
    if (!caps.localStorage) add('localstorage', '本地存储', 'localStorage 不可用，设置、外观和局部存档只能保留到本次页面关闭。');
    if (!caps.sessionStorage) add('sessionstorage', '会话存储', 'sessionStorage 不可用，短期重连提示只能保留在内存中。');
    if (!caps.webAudio) add('webaudio', 'Web Audio 音频', 'Web Audio 不可用，游戏将没有声音（画面和其他功能不受影响）。');
    if (!caps.pointerLock) add('pointerlock', '鼠标锁定', touch ? '触屏设备不需要锁定鼠标；如果连接了鼠标，将使用自由鼠标模式。' : '此浏览器不允许锁定鼠标，将使用自由鼠标模式：移动鼠标转视角，点击画面继续。', !touch);
    if (!caps.fullscreen) add('fullscreen', '网页全屏', '此浏览器不支持网页全屏。iPhone / iPad 可把游戏“添加到主屏幕”后全屏打开。', false);
    if (!caps.fileAPI) add('fileapi', '本地文件导入/导出', '浏览器文件 API 不可用，导入原版存档和保存截图会受影响。', false);
    return out;
  };
  const report = () => ({
    product: 'OpusMC',
    platform: platformName,
    browser: browserName,
    browserVersion,
    mobile,
    touch,
    protocol,
    userAgent: ua,
    viewport: viewport(),
    safeArea: safeArea(),
    capabilities: { ...caps },
    warnings: warnings(),
  });
  const reportText = () => {
    const r = report(), c = r.capabilities;
    const yn = (v) => v ? 'yes' : 'no';
    return [
      'OpusMC 浏览器兼容性报告',
      '平台: ' + r.platform + ' / ' + r.browser + (r.browserVersion ? ' ' + r.browserVersion : ''),
      '协议: ' + r.protocol + (r.mobile ? ' / 移动设备' : '') + ' / 触屏 ' + yn(r.touch),
      '视口: ' + r.viewport.w + '×' + r.viewport.h + ' @' + r.viewport.dpr,
      '安全区: 上 ' + r.safeArea.top + ' 右 ' + r.safeArea.right + ' 下 ' + r.safeArea.bottom + ' 左 ' + r.safeArea.left,
      '能力: WebGL2 ' + yn(c.webgl2) + ', Canvas2D ' + yn(c.canvas2d) + ', Worker ' + yn(c.workers) + ', IndexedDB ' + yn(c.indexedDB) + ', localStorage ' + yn(c.localStorage) + ', WebAudio ' + yn(c.webAudio) + ', PointerLock ' + yn(c.pointerLock) + ', Fullscreen ' + yn(c.fullscreen) + ', 文件 API ' + yn(c.fileAPI) + ', WebSocket ' + yn(c.websocket),
      '警告: ' + (r.warnings.length ? r.warnings.map((w) => w.label).join('、') : '无'),
      'User-Agent: ' + r.userAgent,
    ].join('\n');
  };

  let overlayShown = false;
  function showCompat(opts = {}) {
    overlayShown = true;
    const overlay = document.getElementById('compat');
    if (!overlay) {
      // the page was stripped of its overlay: keep the boot screen up and log, never leave a black page
      console.error('[OpusMC]', opts.summary || '浏览器不兼容', reportText());
      return;
    }
    const boot = document.getElementById('boot');
    if (boot) boot.style.display = 'none';
    const bad = opts.items || required();
    const title = document.getElementById('compat-title');
    const summary = document.getElementById('compat-summary');
    const list = document.getElementById('compat-list');
    const detail = document.getElementById('compat-detail');
    const retry = document.getElementById('compat-retry');
    const hint = document.getElementById('compat-hint');
    if (title) title.textContent = opts.title || (fileProtocol ? '请通过本地服务器打开 OpusMC' : '无法启动 OpusMC');
    if (summary) summary.textContent = opts.summary || (fileProtocol
      ? '直接双击 index.html 不能运行这个游戏：浏览器会禁止 Web Worker 读取脚本，世界生成会卡住。请用下面的命令启动项目自带的静态服务器，再从 http://127.0.0.1:8080/ 打开。'
      : '这个浏览器缺少运行游戏所需的能力。请按下面的提示更新浏览器或开启相应功能后重试。');
    if (list) {
      list.textContent = '';
      for (const item of bad) {
        const li = document.createElement('li');
        const strong = document.createElement('b');
        strong.textContent = (item.ok === false ? '✗ ' : '• ') + (item.label || item.id || '');
        li.appendChild(strong);
        if (item.hint) { li.appendChild(document.createTextNode(' — ' + item.hint)); }
        list.appendChild(li);
      }
      if (!bad.length) { const li = document.createElement('li'); li.textContent = '没有检测到缺失的必要能力。'; list.appendChild(li); }
    }
    if (detail) {
      const extra = opts.error ? '\n\n启动错误: ' + String(opts.error && opts.error.stack || opts.error) : '';
      detail.textContent = reportText() + (opts.contextLost ? '' : extra);
    }
    if (hint) {
      hint.textContent = fileProtocol
        ? '在项目文件夹运行：  node scripts/serve.mjs    然后用浏览器打开 http://127.0.0.1:8080/'
        : '建议使用最新版 Windows Chrome / Edge，Android Chrome，或 iOS Safari 15 及以上。';
    }
    if (retry) {
      retry.textContent = opts.retryLabel || '重新检测';
      retry.onclick = () => location.reload();
    }
    overlay.hidden = false;
    overlay.style.display = 'flex';
    console.error('[OpusMC] ' + (opts.title || '浏览器兼容性检查失败') + '\n' + (opts.summary || '') + '\n' + reportText());
  }
  function hideCompat() {
    const overlay = document.getElementById('compat');
    if (overlay) { overlay.hidden = true; overlay.style.display = 'none'; }
    overlayShown = false;
  }

  let warned = false;
  const afterBoot = (game) => {
    const list = warnings().filter((w) => w.notify);
    if (!list.length) return;
    let tries = 0;
    const show = () => {
      if (warned || overlayShown) return;
      if (!(game && game.ui && game.state === 'title') && ++tries < 20) { setTimeout(show, 500); return; }
      warned = true;
      console.info('[OpusMC platform]\n' + reportText());
      if (game && game.ui && game.state === 'title') {
        game.ui.message('兼容性提示：' + list.map((w) => w.label).join('；') + '（详见控制台）', '#FFAA00');
      }
    };
    setTimeout(show, 1400);
  };

  // record uncaught errors for the compatibility report; gameplay errors are already handled by Game.guard
  try {
    window.addEventListener('error', (e) => {
      if (e && e.target && e.target.tagName === 'SCRIPT') record('script', new Error('脚本加载失败：' + (e.target.src || '')));
      else if (e && e.error) record('uncaught', e.error);
    }, true);
    window.addEventListener('unhandledrejection', (e) => { if (e && e.reason) record('unhandledrejection', e.reason); });
  } catch (e) { }

  const api = {
    version: '1.0',
    platform: platformName,
    browser: browserName,
    browserVersion,
    mobile,
    touch,
    protocol,
    fileProtocol,
    caps,
    errors,
    storage: { local, session },
    display: { safeArea, viewport, ...fullscreen },
    input: pointerLock,
    audio,
    workers,
    files,
    graphics,
    resource,
    compat: { required, warnings, report, reportText, show: showCompat, hide: hideCompat },
    fatal: required,
    warnings,
    webgl2: () => caps.webgl2,
    afterBoot,
    record,
  };
  window.Platform = api;
  return api;
})();
