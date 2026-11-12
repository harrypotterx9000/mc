// Minimal static file server for OpusMC. No dependencies.
//
//   node scripts/serve.mjs                 # http://127.0.0.1:8080/
//   PORT=9000 node scripts/serve.mjs
//   HOST=0.0.0.0 node scripts/serve.mjs    # LAN, for testing on a phone
//   node scripts/serve.mjs --root ..       # serve another directory
//
// Only the game's own static files are served: the page, js/, sounds/sfx/ and the favicon. Project docs,
// server code, scripts, Git metadata, dotfiles and anything else under the project root are not exposed.
// Audio gets a long browser cache; scripts and the page revalidate with an ETag (304, not a re-download).
//
// Serving over http(s) is required: Web Workers and fetch are blocked on file://, which would make world
// generation fall back to the main thread.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const rootArg = args.includes('--root') ? args[args.indexOf('--root') + 1] : path.join(here, '..');
const root = path.resolve(rootArg);
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// what a standalone OpusMC deployment consists of; everything else is refused even if it exists under root
const ALLOWED = [
  /^\/index\.html$/,
  /^\/favicon\.svg$/,
  /^\/js\/[A-Za-z0-9_.-]+\.(js|webp)$/,
  /^\/sounds\/sfx\/[A-Za-z0-9_./-]+\.(m4a|ogg|wav)$/,
];

function cachePolicy(rel) {
  if (/\.(m4a|ogg|wav)$/.test(rel)) return 'public, max-age=2592000'; // the 43 MB sound pack: one month
  if (/\.(webp|svg|png|jpg|jpeg|ico)$/.test(rel)) return 'public, max-age=604800';
  return 'no-cache'; // HTML/JS/data: an ETag makes the revalidation a 304
}

function resolveSafe(urlPath) {
  let clean;
  try { clean = decodeURIComponent(String(urlPath || '/').split('?')[0].split('#')[0]); }
  catch (e) { return null; }
  if (!clean.startsWith('/') || clean.includes('\0') || clean.includes('\\')) return null;
  // normalize before the allow-list: /js/../docs/x.js must not pass as a js file
  clean = path.posix.normalize(clean);
  if (clean === '/') clean = '/index.html';
  if (!ALLOWED.some((re) => re.test(clean))) return null;
  const abs = path.resolve(root, '.' + clean);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return { abs, rel: clean };
}

function send304(res, headers) {
  res.writeHead(304, headers);
  res.end();
}

function notFound(res, what) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end('404 ' + what);
}

const server = http.createServer((req, res) => {
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' });
    res.end('method not allowed');
    return;
  }
  const target = resolveSafe(req.url || '/');
  if (!target) { res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }); res.end('forbidden'); return; }
  fs.stat(target.abs, (err, st) => {
    if (err || !st.isFile()) { notFound(res, target.rel); return; }
    // resolve symlinks and refuse anything that lands outside the project root
    fs.realpath(target.abs, (rerr, real) => {
      if (rerr || (real !== root && !real.startsWith(root + path.sep))) {
        res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('forbidden');
        return;
      }
      const type = MIME[path.extname(target.abs).toLowerCase()] || 'application/octet-stream';
      const etag = 'W/"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"';
      const lastModified = st.mtime.toUTCString();
      const headers = {
        'content-type': type,
        'cache-control': cachePolicy(target.rel),
        'etag': etag,
        'last-modified': lastModified,
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'same-origin',
      };
      const inm = req.headers['if-none-match'];
      const ims = req.headers['if-modified-since'];
      if (inm) {
        if (String(inm).split(',').map((s) => s.trim()).includes(etag)) { send304(res, headers); return; }
      } else if (ims) {
        const t = Date.parse(ims);
        if (!Number.isNaN(t) && Math.floor(st.mtimeMs / 1000) <= Math.floor(t / 1000)) { send304(res, headers); return; }
      }
      headers['content-length'] = String(st.size);
      res.writeHead(200, headers);
      if (method === 'HEAD') { res.end(); return; }
      const stream = fs.createReadStream(target.abs);
      stream.on('error', () => { try { res.destroy(); } catch (e) { } });
      stream.pipe(res);
    });
  });
});

server.on('clientError', (err, socket) => {
  try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch (e) { }
});

server.listen(port, host, () => {
  console.log(`OpusMC server: http://${host}:${port}/`);
  console.log(`root: ${root}`);
  if (host === '0.0.0.0' || host === '::') {
    for (const list of Object.values(os.networkInterfaces())) for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) console.log(`LAN:  http://${ni.address}:${port}/  (phone on the same network)`);
    }
  }
  console.log('press Ctrl+C to stop');
});
