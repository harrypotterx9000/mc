// OpusMC self-hosted server entry point.
//   node server/index.mjs
// One process serves the game's static files, the room/WebSocket service and
// the JSON room store. No npm dependencies, no game rendering.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { createLogger } from './log.mjs';
import { ensureDataDirs, RoomStore } from './storage.mjs';
import { createHttpServer } from './http.mjs';
import { RoomManager } from './rooms.mjs';
import { WSServer } from './ws.mjs';
import { loadBlockIds } from './blockids.mjs';
import { LIMITS } from './protocol.mjs';

const VERSION = '0.5.0';
const cfg = loadConfig();

let logger = null;
let store = null;
let manager = null;
let httpServer = null;
let wsServer = null;
let shuttingDown = false;

function isLoopback(ip) { const s = String(ip || '').replace(/^::ffff:/, ''); return s === '127.0.0.1' || s === '::1'; }

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
  const shownHost = cfg.host === '0.0.0.0' ? '127.0.0.1' : cfg.host;
  logger.info('server_listening', { host: addr.address, port: addr.port, url: `http://${shownHost}:${addr.port}/` });
  console.log('');
  console.log('  OpusMC 自建服务器已启动');
  console.log(`  游戏地址：http://${shownHost}:${addr.port}/`);
  if (cfg.host === '0.0.0.0') console.log('  局域网：其他设备用本机 IP 访问（Windows 防火墙需放行该端口）');
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
