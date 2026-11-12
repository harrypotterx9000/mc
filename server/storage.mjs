// Room persistence: one JSON file per room, atomic writes, rotating backups and
// recovery from the newest readable backup. Everything here stays under
// dataDir, which the static handler never serves.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const DIR_RE = /^room-[A-Z2-9]{6,12}$/;

export function ensureDataDirs(cfg) {
  for (const d of ['', 'worlds', 'backups', 'logs']) fs.mkdirSync(path.join(cfg.dataDir, d), { recursive: true });
}

async function atomicWriteJson(file, obj) {
  const data = JSON.stringify(obj);
  const tmp = file + '.tmp-' + process.pid + '-' + randomBytes(4).toString('hex');
  const fh = await fsp.open(tmp, 'w');
  try {
    await fh.writeFile(data, 'utf8');
    await fh.sync();
  } finally {
    await fh.close();
  }
  try { await fsp.rename(tmp, file); }
  catch (e) {
    // Windows can refuse to replace an existing file; the backup copy from
    // before this save is the recovery path if the next step is interrupted.
    await fsp.rm(file, { force: true });
    await fsp.rename(tmp, file);
  }
}

function stamp(d = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${p(d.getMilliseconds(), 3)}`;
}

export class RoomStore {
  constructor({ cfg, log }) {
    this.cfg = cfg;
    this.log = log;
    this.worlds = path.join(cfg.dataDir, 'worlds');
    this.backups = path.join(cfg.dataDir, 'backups');
    this.adminTokenPath = path.join(cfg.dataDir, 'admin-token.txt');
    this.pidPath = path.join(cfg.dataDir, 'server.pid');
  }

  dirFor(record) {
    const dir = String(record.dir || '');
    if (!DIR_RE.test(dir)) throw new Error('非法房间目录名: ' + dir);
    return path.join(this.worlds, dir);
  }

  fileFor(record) { return path.join(this.dirFor(record), 'world.json'); }

  async loadAll() {
    let names = [];
    try { names = await fsp.readdir(this.worlds); } catch (e) { return []; }
    const out = [];
    for (const name of names) {
      if (!DIR_RE.test(name)) continue;
      const dir = path.join(this.worlds, name);
      const file = path.join(dir, 'world.json');
      let rec = null, recovered = '';
      try { rec = JSON.parse(await fsp.readFile(file, 'utf8')); }
      catch (e) { this.log.warn('world_load_failed', { dir: name, error: e.message }); }
      // A file that parses but is not a usable record is just as broken as one
      // that does not parse: both fall back to the newest readable backup.
      if (rec && !this._validRecord(rec)) this.log.error('world_record_invalid', { dir: name });
      if (!this._validRecord(rec)) {
        const backup = await this._latestBackupRecord(name);
        if (backup) { rec = backup; recovered = 'backup'; }
      }
      if (!this._validRecord(rec)) { this.log.error('world_skipped', { dir: name }); continue; }
      // the record must stay in its own room directory: a copied/garbled file
      // must not be loaded as another room's world
      if (rec.dir !== name) { this.log.error('world_dir_mismatch', { dir: name, recordDir: rec.dir }); continue; }
      if (recovered) {
        // write the recovered copy back so the next start reads a valid file
        // (the damaged original never becomes a backup of itself)
        try {
          await this.save(rec, { backup: false, reason: 'recovered' });
          this.log.info('world_recovered_written', { dir: name });
        } catch (e) {
          this.log.warn('world_recovery_write_failed', { dir: name, error: e.message });
        }
      }
      out.push({ record: rec, recovered });
    }
    return out;
  }

  _validRecord(r) {
    return !!r && r.v === 1 && typeof r.code === 'string' && /^[A-Z2-9]{6,12}$/.test(r.code)
      && typeof r.dir === 'string' && DIR_RE.test(r.dir)
      && r.world && typeof r.world === 'object' && Number.isFinite(r.world.seed)
      && Array.isArray(r.blocks) && Array.isArray(r.blockEntities) && Array.isArray(r.players);
  }

  async _backupFiles(dirName) {
    const dir = path.join(this.backups, dirName);
    try { return (await fsp.readdir(dir)).filter((f) => /^\d{8}-\d{6}-\d{3}\.json$/.test(f)).sort().reverse(); }
    catch (e) { return []; }
  }

  async _latestBackupRecord(dirName) {
    for (const f of await this._backupFiles(dirName)) {
      try {
        const rec = JSON.parse(await fsp.readFile(path.join(this.backups, dirName, f), 'utf8'));
        if (this._validRecord(rec)) {
          this.log.warn('world_recovered_from_backup', { dir: dirName, backup: f });
          return rec;
        }
      } catch (e) { }
    }
    return null;
  }

  async save(record, { backup = false, forceBackup = false, reason = 'save' } = {}) {
    const dir = this.dirFor(record);
    const file = path.join(dir, 'world.json');
    await fsp.mkdir(dir, { recursive: true });
    const dirName = path.basename(dir);
    let backupPath = '';
    if (backup) {
      const latest = (await this._backupFiles(dirName))[0];
      let due = forceBackup;
      if (!due) {
        if (!latest) due = true;
        else {
          const t = Date.parse(latest.slice(0, 4) + '-' + latest.slice(4, 6) + '-' + latest.slice(6, 8) + 'T' +
            latest.slice(9, 11) + ':' + latest.slice(11, 13) + ':' + latest.slice(13, 15));
          due = !Number.isFinite(t) || Date.now() - t >= this.cfg.backupEveryMinutes * 60000;
        }
      }
      if (due && fs.existsSync(file)) {
        const bdir = path.join(this.backups, dirName);
        await fsp.mkdir(bdir, { recursive: true });
        const dest = path.join(bdir, stamp() + '.json');
        try { await fsp.copyFile(file, dest); backupPath = dest; }
        catch (e) { this.log.warn('backup_failed', { dir: dirName, error: e.message }); }
      }
    }
    await atomicWriteJson(file, record);
    await this._pruneBackups(dirName);
    this.log.debug('world_saved', { dir: dirName, reason, bytes: Buffer.byteLength(JSON.stringify(record)), backup: backupPath || undefined });
    return { backupPath };
  }

  async _pruneBackups(dirName) {
    const files = await this._backupFiles(dirName);
    const keep = Math.max(1, this.cfg.backupKeep);
    for (const f of files.slice(keep)) {
      try { await fsp.rm(path.join(this.backups, dirName, f), { force: true }); } catch (e) { }
    }
  }

  adminToken() {
    try {
      const t = fs.readFileSync(this.adminTokenPath, 'utf8').trim();
      if (/^[a-f0-9]{64}$/.test(t)) return t;
    } catch (e) { }
    const t = randomBytes(32).toString('hex');
    fs.writeFileSync(this.adminTokenPath, t + '\n', { mode: 0o600 });
    try { fs.chmodSync(this.adminTokenPath, 0o600); } catch (e) { }
    return t;
  }

  writePid(info) {
    try { fs.writeFileSync(this.pidPath, JSON.stringify(info) + '\n'); } catch (e) { }
  }

  clearPid() {
    try { fs.rmSync(this.pidPath, { force: true }); } catch (e) { }
  }
}
