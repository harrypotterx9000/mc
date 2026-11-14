// JSONL file log + readable console lines. Tokens and other secrets are
// redacted by key before anything is written.
import fs from 'node:fs';
import path from 'node:path';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const REDACT = /token|secret|authorization|password|cookie/i;

function clean(fields) {
  if (!fields || typeof fields !== 'object') return fields;
  if (Array.isArray(fields)) return fields.map(clean);
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (REDACT.test(k)) { out[k] = '[redacted]'; continue; }
    if (v && typeof v === 'object') out[k] = Array.isArray(v) ? v.slice(0, 32).map(clean) : clean(v);
    else out[k] = v;
  }
  return out;
}

export function createLogger({ dataDir, level = 'info', retentionDays = 14 }) {
  const dir = path.join(dataDir, 'logs');
  fs.mkdirSync(dir, { recursive: true });
  const min = LEVELS[level] || LEVELS.info;
  let day = '', stream = null;

  function openDay(d) {
    if (d === day && stream) return;
    if (stream) { try { stream.end(); } catch (e) { } }
    day = d;
    stream = fs.createWriteStream(path.join(dir, `server-${d}.log`), { flags: 'a' });
    stream.on('error', () => { stream = null; });
  }
  function rotate() {
    const d = new Date().toISOString().slice(0, 10);
    openDay(d);
    // keep the log directory bounded; failures are not fatal
    try {
      const files = fs.readdirSync(dir).filter((f) => /^server-\d{4}-\d{2}-\d{2}\.log$/.test(f)).sort();
      const cutoff = Date.now() - retentionDays * 86400000;
      for (const f of files) {
        const t = Date.parse(f.slice(7, 17));
        if (Number.isFinite(t) && t < cutoff) fs.rmSync(path.join(dir, f), { force: true });
      }
    } catch (e) { }
  }
  rotate();
  const timer = setInterval(rotate, 3600000); timer.unref();

  function write(lvl, event, fields) {
    if ((LEVELS[lvl] || 20) < min) return;
    const ts = new Date().toISOString();
    const body = clean(fields || {});
    let line;
    try { line = JSON.stringify({ ts, level: lvl, event, ...body }); }
    catch (e) { line = JSON.stringify({ ts, level: lvl, event, note: 'unserializable fields' }); }
    if (stream) { try { stream.write(line + '\n'); } catch (e) { } }
    const extra = Object.keys(body).length ? ' ' + JSON.stringify(body) : '';
    const out = `${ts} ${lvl.toUpperCase().padEnd(5)} ${event}${extra}`;
    if (lvl === 'error') console.error(out); else if (lvl === 'warn') console.warn(out); else console.log(out);
  }

  const log = {
    debug: (event, fields) => write('debug', event, fields),
    info: (event, fields) => write('info', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    error: (event, fields) => write('error', event, fields),
    child: (base) => ({
      debug: (e, f) => write('debug', e, { ...base, ...f }),
      info: (e, f) => write('info', e, { ...base, ...f }),
      warn: (e, f) => write('warn', e, { ...base, ...f }),
      error: (e, f) => write('error', e, { ...base, ...f }),
    }),
    close: () => {
      clearInterval(timer);
      if (stream) { try { stream.end(); } catch (e) { } stream = null; }
    },
    dir,
  };
  return log;
}
