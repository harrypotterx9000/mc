// Server configuration: server/config.json overlaid on safe defaults.
// No secrets live here; the admin token is generated into the data directory.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SERVER_DIR, '..');

export const DEFAULTS = {
  serverName: 'OpusMC 自建服务器',
  host: '127.0.0.1',
  port: 8080,
  dataDir: 'server/data',
  staticRoot: '.',
  maxRooms: 8,
  maxPlayersPerRoom: 10,
  maxConnections: 64,
  inviteCodeLength: 8,
  joinPerMinute: 5,
  joinBurst: 3,
  createPerMinute: 4,
  createBurst: 2,
  autosaveSeconds: 60,
  backupEveryMinutes: 10,
  backupKeep: 10,
  resumeSeconds: 120,
  snapshotHz: 10,
  maxBlocksPerRoom: 100000,
  maxBlockEntitiesPerRoom: 5000,
  maxItemsPerRoom: 200,
  logRetentionDays: 14,
  adminLocalhostOnly: true,
  allowedOrigins: [],
};

const NUM = ['port', 'maxRooms', 'maxPlayersPerRoom', 'maxConnections', 'inviteCodeLength', 'joinPerMinute', 'joinBurst', 'createPerMinute', 'createBurst', 'autosaveSeconds', 'backupEveryMinutes', 'backupKeep', 'resumeSeconds', 'snapshotHz', 'maxBlocksPerRoom', 'maxBlockEntitiesPerRoom', 'maxItemsPerRoom', 'logRetentionDays'];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--config') out.config = argv[++i];
    else if (a === '--port') out.port = argv[++i];
    else if (a === '--host') out.host = argv[++i];
    else if (a === '--lan') out.lan = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

export function loadConfig(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('用法: node server/index.mjs [--config server/config.json] [--host 127.0.0.1] [--port 8080] [--lan]');
    console.log('  --lan  绑定 0.0.0.0，让同一局域网的其他设备访问（不用改 config.json）');
    process.exit(0);
  }
  const file = path.resolve(ROOT, args.config || path.join(SERVER_DIR, 'config.json'));
  let raw = {};
  if (fs.existsSync(file)) {
    try {
      const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
      raw = JSON.parse(text);
    } catch (e) { throw new Error('配置文件不是有效 JSON: ' + file + ' — ' + e.message); }
  }
  const cfg = { ...DEFAULTS, ...(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) };
  if (args.lan) cfg.host = '0.0.0.0';
  if (args.port !== undefined) cfg.port = Number(args.port);
  if (args.host !== undefined) cfg.host = String(args.host);
  if (process.env.OPUSMC_PORT) cfg.port = Number(process.env.OPUSMC_PORT);
  if (process.env.OPUSMC_HOST) cfg.host = String(process.env.OPUSMC_HOST);

  for (const k of NUM) {
    const n = Number(cfg[k]);
    if (!Number.isInteger(n)) throw new Error(`配置项 ${k} 必须是整数`);
    cfg[k] = n;
  }
  cfg.serverName = String(cfg.serverName || DEFAULTS.serverName).slice(0, 48) || DEFAULTS.serverName;
  cfg.host = String(cfg.host || DEFAULTS.host);
  cfg.dataDir = path.resolve(ROOT, String(cfg.dataDir || DEFAULTS.dataDir));
  cfg.staticRoot = path.resolve(ROOT, String(cfg.staticRoot || DEFAULTS.staticRoot));
  cfg.configPath = file;
  cfg.projectRoot = ROOT;
  cfg.serverDir = SERVER_DIR;
  cfg.allowedOrigins = Array.isArray(cfg.allowedOrigins) ? cfg.allowedOrigins.map(String).slice(0, 32) : [];
  cfg.adminLocalhostOnly = cfg.adminLocalhostOnly !== false;

  if (!(cfg.port > 0 && cfg.port < 65536)) throw new Error('配置项 port 必须在 1–65535');
  if (!(cfg.maxRooms >= 1 && cfg.maxRooms <= 64)) throw new Error('配置项 maxRooms 必须在 1–64');
  if (!(cfg.maxPlayersPerRoom >= 2 && cfg.maxPlayersPerRoom <= 16)) throw new Error('配置项 maxPlayersPerRoom 必须在 2–16');
  if (!(cfg.inviteCodeLength >= 6 && cfg.inviteCodeLength <= 12)) throw new Error('配置项 inviteCodeLength 必须在 6–12');
  if (!(cfg.joinPerMinute >= 1 && cfg.joinBurst >= 1)) throw new Error('配置项 joinPerMinute / joinBurst 必须 >= 1');
  if (!(cfg.createPerMinute >= 1 && cfg.createBurst >= 1)) throw new Error('配置项 createPerMinute / createBurst 必须 >= 1');
  if (!(cfg.snapshotHz >= 2 && cfg.snapshotHz <= 20)) throw new Error('配置项 snapshotHz 必须在 2–20');
  if (!(cfg.resumeSeconds >= 10 && cfg.resumeSeconds <= 3600)) throw new Error('配置项 resumeSeconds 必须在 10–3600');
  if (!fs.existsSync(cfg.staticRoot)) throw new Error('staticRoot 不存在: ' + cfg.staticRoot);
  return cfg;
}
