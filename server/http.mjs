// HTTP: the game's static files (same whitelist as scripts/serve.mjs),
// public health/status, and loopback+token admin endpoints. Data directories
// are never in the whitelist.
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { timingSafeEqual, createHash } from 'node:crypto';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'SAMEORIGIN',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function etagOf(st) { return '"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"'; }
function isLoopback(ip) { const s = String(ip || '').replace(/^::ffff:/, ''); return s === '127.0.0.1' || s === '::1' || s === 'localhost'; }
function sameToken(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const ha = createHash('sha256').update(a).digest(), hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
function sendJson(res, status, obj, extra = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...extra });
  res.end(body);
}
function sendText(res, status, text, extra = {}) {
  const body = text + '\n';
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength(body), ...SECURITY_HEADERS, ...extra });
  res.end(body);
}

// Only the game's own files. Returns a path (inside staticRoot) or null.
function resolveStatic(root, pathname) {
  if (pathname === '/' || pathname === '/index.html') return path.join(root, 'index.html');
  if (pathname === '/favicon.svg') return path.join(root, 'favicon.svg');
  let m = /^\/js\/([A-Za-z0-9_.-]+\.(?:js|webp))$/.exec(pathname);
  if (m && !m[1].includes('..')) return path.join(root, 'js', m[1]);
  m = /^\/sounds\/sfx\/(.+\.(?:m4a|ogg|wav))$/.exec(pathname);
  if (m) {
    const rel = m[1];
    if (!rel.split('/').every((s) => s && s !== '.' && s !== '..' && /^[A-Za-z0-9_. ()+-]+$/.test(s))) return null;
    return path.join(root, 'sounds', 'sfx', ...rel.split('/'));
  }
  return null;
}

function cacheFor(file) {
  if (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.mjs')) return 'no-cache';
  if (file.endsWith('.m4a') || file.endsWith('.ogg') || file.endsWith('.wav')) return 'public, max-age=2592000';
  return 'public, max-age=604800';
}

async function serveStatic(req, res, cfg, pathname, log) {
  const file = resolveStatic(cfg.staticRoot, pathname);
  if (!file) return sendText(res, 404, 'Not Found');
  const resolved = path.resolve(file);
  if (resolved !== cfg.staticRoot && !resolved.startsWith(cfg.staticRoot + path.sep)) return sendText(res, 404, 'Not Found');
  // defense in depth: never serve the runtime data directory, even if a future
  // whitelist entry is added by mistake
  const data = path.resolve(cfg.dataDir);
  if (resolved === data || resolved.startsWith(data + path.sep)) return sendText(res, 404, 'Not Found');
  let st;
  try { st = await fsp.stat(resolved); } catch (e) { return sendText(res, 404, 'Not Found'); }
  if (!st.isFile()) return sendText(res, 404, 'Not Found');
  const ext = path.extname(resolved).toLowerCase();
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': st.size,
    'Cache-Control': cacheFor(resolved),
    'ETag': etagOf(st),
    'Last-Modified': st.mtime.toUTCString(),
    ...SECURITY_HEADERS,
  };
  const inm = req.headers['if-none-match'];
  if (inm && inm.split(',').map((s) => s.trim()).includes(headers['ETag'])) {
    delete headers['Content-Length'];
    res.writeHead(304, headers);
    return res.end();
  }
  if (req.method === 'HEAD') { res.writeHead(200, headers); return res.end(); }
  res.writeHead(200, headers);
  const stream = fs.createReadStream(resolved);
  stream.on('error', () => { try { res.destroy(); } catch (e) { } });
  stream.pipe(res);
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(new Error('body too large')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function createHttpServer({ cfg, log, manager, onShutdown, onAdminStatus }) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'));
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); }
      catch (e) { return sendText(res, 400, 'Bad Request'); }
      if (pathname.includes('\u0000') || pathname.includes('\\') || pathname.includes('..')) return sendText(res, 400, 'Bad Request');

      // public health/status: used by the game's server screen and by ops
      if (pathname === '/healthz' || pathname === '/api/status') {
        if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }
        if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method Not Allowed');
        const s = manager.status();
        // public endpoints keep the room/player counts; CPU, memory and tick diagnostics stay admin-only
        delete s.stats; delete s.perf;
        return sendJson(res, 200, s, { 'Access-Control-Allow-Origin': '*' });
      }

      if (pathname.startsWith('/api/admin/')) {
        const remote = req.socket.remoteAddress;
        if (cfg.adminLocalhostOnly && !isLoopback(remote)) return sendJson(res, 403, { ok: false, error: 'forbidden' });
        const token = String(req.headers['x-admin-token'] || (String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')));
        if (!sameToken(token, cfg.adminToken)) return sendJson(res, 401, { ok: false, error: 'unauthorized' });
        if (pathname === '/api/admin/status' && req.method === 'GET') return sendJson(res, 200, onAdminStatus());
        if (pathname === '/api/admin/shutdown' && req.method === 'POST') {
          await readBody(req).catch(() => { });
          sendJson(res, 200, { ok: true, message: 'shutting down' }, { Connection: 'close' });
          setTimeout(() => { Promise.resolve(onShutdown('admin')).catch((e) => log.error('shutdown_failed', { error: e.message })); }, 50).unref();
          return;
        }
        if (pathname === '/api/admin/save' && req.method === 'POST') {
          await readBody(req).catch(() => { });
          await manager.saveAll('admin');
          return sendJson(res, 200, { ok: true, rooms: manager.rooms.size });
        }
        return sendJson(res, 404, { ok: false, error: 'not found' });
      }

      if (pathname.startsWith('/api/')) return sendJson(res, 404, { ok: false, error: 'not found' });

      if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method Not Allowed');
      return await serveStatic(req, res, cfg, pathname, log);
    } catch (e) {
      log.error('http_failed', { url: req.url, error: e.message });
      if (!res.headersSent) sendText(res, 500, 'Internal Server Error'); else { try { res.destroy(); } catch (e2) { } }
    }
  });
  server.on('clientError', (err, socket) => {
    try { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); } catch (e) { }
  });
  return server;
}
