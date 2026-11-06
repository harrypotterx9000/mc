// Minimal static file server for local OpusMC development.
// No dependencies. Binds loopback only. Serves the project root.
//
//   node scripts/serve.mjs            # http://127.0.0.1:8080/
//   PORT=9000 node scripts/serve.mjs
//   node scripts/serve.mjs --root ..  # serve another directory

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const rootArg = args.includes('--root') ? args[args.indexOf('--root') + 1] : path.join(here, '..');
const root = path.resolve(rootArg);
const host = '127.0.0.1';
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
  '.ogg': 'audio/ogg',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
};

function resolveSafe(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const rel = clean === '/' ? '/index.html' : clean;
  const abs = path.resolve(root, '.' + rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

const server = http.createServer((req, res) => {
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' });
    res.end('method not allowed');
    return;
  }
  let file = resolveSafe(req.url || '/');
  if (!file) { res.writeHead(403); res.end('forbidden'); return; }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) file = path.join(file, 'index.html');
    fs.stat(file, (err2, st2) => {
      if (err2 || !st2.isFile()) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('404 ' + (req.url || ''));
        return;
      }
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, {
        'content-type': type,
        'content-length': st2.size,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      });
      if (method === 'HEAD') { res.end(); return; }
      fs.createReadStream(file).pipe(res);
    });
  });
});

server.listen(port, host, () => {
  console.log(`OpusMC dev server: http://${host}:${port}/`);
  console.log(`root: ${root}`);
  console.log('press Ctrl+C to stop');
});
