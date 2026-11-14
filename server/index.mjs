// OpusMC self-hosted server entry point.
//   node server/index.mjs
// One process serves the game's static files, the room/WebSocket service and
// the JSON room store. No npm dependencies, no game rendering.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { createLogger } from './log.mjs';
import { ensureDataDirs, RoomStore } from './storage.mjs';
import { createHttpServer } from './http.mjs';
import { RoomManager } from './rooms.mjs';
import { WSServer } from './ws.mjs';
import { loadBlockIds } from './blockids.mjs';
import { LIMITS } from './protocol.mjs';
import { isLoopback } from './netutil.mjs';

const VERSION = '0.8.0';
const cfg = loadConfig();

let logger = null;
let store = null;
let manager = null;
let httpServer = null;
let wsServer = null;
let shuttingDown = false;

// A private (RFC 1918) IPv4 is the normal home/office LAN address. Prefer one
// as the primary address; fall back to any other non-internal IPv4 only when
// the machine has no private address at all.
function isPrivateIPv4(address) {
  const p = String(address).split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168);
}

// Every usable non-internal IPv4 address this PC can be reached on from the
// same network. The first entry is the primary address shown as the game
// address; 127.0.0.1 is never used as a LAN address.
function lanInfo(port) {
  const all = [];
  const seen = new Set();
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family !== 'IPv4' || net.internal || !net.address) continue;
      if (net.address === '0.0.0.0' || net.address.startsWith('169.254.')) continue;
      if (seen.has(net.address)) continue;
      seen.add(net.address);
      all.push({ address: net.address, url: `http://${net.address}:${port}/`, private: isPrivateIPv4(net.address) });
    }
  }
  const primary = all.find((x) => x.private) || all[0] || null;
  if (primary) {
    all.sort((a, b) => (a === primary ? -1 : b === primary ? 1 : 0));
  }
  return { list: all, primary };
}

function originCheck(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients
  try {
    const o = new URL(String(origin));
    if (o.host === req.headers.host) return true;
    if (cfg.allowedOrigins.includes(String(origin))) return true;
    // the same host on another port (the game page and a development static
    // server), and loopback pages served by another local tool
    try { const h = new URL('http://' + String(req.headers.host || 'localhost')); if (o.hostname === h.hostname) return true; } catch (e) { }
    if ((o.hostname === '127.0.0.1' || o.hostname === 'localhost') && isLoopback(req.socket.remoteAddress)) return true;
    return false;
  } catch (e) { return false; }
}

function stalePid() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(cfg.dataDir, 'server.pid'), 'utf8'));
    if (!raw || !Number.isInteger(raw.pid)) return null;
    try { process.kill(raw.pid, 0); return raw; } catch (e) { return null; } // not running: stale
  } catch (e) { return null; }
}

async function shutdown(reason = 'signal', code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  const t0 = Date.now();
  logger.info('shutdown_start', { reason });
  const force = setTimeout(() => { logger.error('shutdown_forced', { reason }); process.exit(code || 1); }, 8000);
  force.unref();
  try { if (wsServer) wsServer.closeAll(1001, '服务器正在关闭'); } catch (e) { }
  // Stop accepting new requests, but do not wait for HTTP keep-alive sockets
  // before saving: a stuck admin/client connection must never delay room data.
  let httpClosing = null;
  try {
    if (httpServer) {
      httpClosing = new Promise((res) => httpServer.close(() => res()));
      if (httpServer.closeIdleConnections) httpServer.closeIdleConnections();
    }
  } catch (e) { }
  try { if (manager) await manager.stop(); } catch (e) { logger.error('shutdown_save_failed', { error: e.message }); }
  try {
    if (httpServer) {
      if (httpServer.closeIdleConnections) httpServer.closeIdleConnections();
      if (httpServer.closeAllConnections) httpServer.closeAllConnections();
    }
  } catch (e) { }
  try { if (httpClosing) await Promise.race([httpClosing, new Promise((res) => setTimeout(res, 1500))]); } catch (e) { }
  try { if (store) store.clearPid(); } catch (e) { }
  logger.info('shutdown_done', { ms: Date.now() - t0 });
  logger.close();
  clearTimeout(force);
  process.exit(code);
}

async function main() {
  ensureDataDirs(cfg);
  logger = createLogger({ dataDir: cfg.dataDir, level: 'info', retentionDays: cfg.logRetentionDays });
  logger.info('server_start', {
    version: VERSION, node: process.version, host: cfg.host, port: cfg.port,
    dataDir: cfg.dataDir, staticRoot: cfg.staticRoot, config: cfg.configPath,
    maxRooms: cfg.maxRooms, maxPlayersPerRoom: cfg.maxPlayersPerRoom,
  });

  const running = stalePid();
  if (running) {
    logger.error('already_running', { pid: running.pid, startedAt: running.startedAt });
    console.error(`服务器已经在运行（pid ${running.pid}）。先运行 server\\stop-server.bat，或结束这个进程。`);
    process.exit(1);
  }

  store = new RoomStore({ cfg, log: logger });
  cfg.adminToken = store.adminToken();
  const blockIds = loadBlockIds(cfg.projectRoot, logger);
  manager = new RoomManager({ cfg, log: logger, store, blockIds });
  const records = await store.loadAll();
  manager.load(records);
  if (records.length) logger.info('rooms_restored', { files: records.length, open: manager.rooms.size });

  httpServer = createHttpServer({
    cfg, log: logger, manager,
    onAdminStatus: () => manager.adminStatus(),
    onShutdown: (why) => shutdown(why, 0),
  });

  wsServer = new WSServer({
    server: httpServer,
    path: '/ws',
    maxConnections: cfg.maxConnections,
    maxMessageBytes: Math.max(LIMITS.maxTextBytes, 128 * 1024),
    maxBufferedBytes: 8 << 20,
    pingMs: 30000,
    idleMs: 90000,
    originCheck,
    onConnection: (conn) => manager.onConnection(conn),
    onMessage: (conn, text) => manager.onMessage(conn, text),
    onBinary: (conn) => manager.onBinary(conn),
    onClose: (conn) => manager.onClose(conn),
    onError: (conn, e) => logger.error('ws_error', { ip: conn && conn.ip, error: e && e.message }),
  });

  httpServer.on('error', async (e) => {
    if (shuttingDown) return;
    if (e && e.code === 'EADDRINUSE') {
      logger.error('port_in_use', { host: cfg.host, port: cfg.port });
      console.error(`端口 ${cfg.port} 已被占用。可以在 server/config.json 里改 port，或先停止占用它的程序。`);
    } else {
      logger.error('http_server_error', { error: e.message });
      console.error('服务器运行出错：' + e.message);
    }
    await shutdown('http_error', 1);
  });

  await new Promise((resolve, reject) => {
    httpServer.once('listening', resolve);
    httpServer.once('error', reject);
    httpServer.listen(cfg.port, cfg.host);
  });
  const addr = httpServer.address();
  const lanMode = cfg.host === '0.0.0.0' || cfg.host === '::';
  const lan = lanMode ? lanInfo(addr.port) : { list: [], primary: null };
  const localHost = cfg.host === '0.0.0.0' ? '127.0.0.1' : cfg.host === '::' ? '[::1]' : cfg.host;
  const localUrl = `http://${localHost}:${addr.port}/`;
  const primaryUrl = lan.primary ? lan.primary.url : localUrl;
  logger.info('server_listening', {
    host: addr.address, port: addr.port, url: primaryUrl, localUrl, lanMode,
    lanUrls: lan.list.map((x) => x.url),
  });
  console.log('');
  console.log('  OpusMC 自建服务器已启动');
  if (lan.primary) {
    console.log(`  游戏地址（局域网）：${lan.primary.url}`);
    console.log(`  仅本机访问（服务器电脑）：${localUrl}`);
    if (lan.list.length > 1) {
      console.log('  其他可用的局域网地址（首选地址不通时再换）：');
      for (const item of lan.list) if (item !== lan.primary) console.log('    ' + item.url);
    }
    console.log('  Windows 防火墙需放行该端口（专用网络）；详见 docs\\deployment\\LAN.md');
  } else if (lanMode) {
    console.log('  未发现有效的局域网 IPv4 地址：请检查电脑是否连接 Wi-Fi 或网线');
    console.log(`  仅本机访问（服务器电脑）：${localUrl}`);
  } else {
    console.log(`  游戏地址：${localUrl}`);
  }
  console.log(`  数据目录：${cfg.dataDir}`);
  console.log(`  管理令牌：${store.adminTokenPath}（只在本机使用，勿分享）`);
  console.log('  正常关闭：stop-server.bat 或 Ctrl+C');
  console.log('');

  manager.start();
  store.writePid({ pid: process.pid, startedAt: new Date().toISOString(), port: cfg.port, host: cfg.host, version: VERSION });
}

process.on('SIGINT', () => shutdown('SIGINT', 0));
process.on('SIGTERM', () => shutdown('SIGTERM', 0));
process.on('SIGBREAK', () => shutdown('SIGBREAK', 0));
process.on('uncaughtException', (e) => {
  try { logger && logger.error('uncaught_exception', { error: e && e.message, stack: String(e && e.stack || '').split('\n').slice(0, 5).join(' | ') }); } catch (e2) { }
  console.error('未捕获异常：', e);
  shutdown('uncaught_exception', 1);
});
process.on('unhandledRejection', (e) => {
  try { logger && logger.error('unhandled_rejection', { error: e && e.message }); } catch (e2) { }
});

main().catch(async (e) => {
  try { logger && logger.error('startup_failed', { error: e.message, stack: String(e.stack || '').split('\n').slice(0, 5).join(' | ') }); } catch (e2) { }
  console.error('服务器启动失败：' + e.message);
  if (logger) logger.close();
  process.exit(1);
});
