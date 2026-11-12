// Protocol primitives: message limits, sanitizers and field validators.
// Everything a client sends is untrusted; these helpers return clean values or
// null/false, and are shared by the room manager and the HTTP API.
export const PROTO = 1;

export const LIMITS = {
  maxName: 16,
  maxRoomName: 24,
  maxChat: 256,
  maxTextBytes: 64 * 1024,
  maxPstateBytes: 16 * 1024,
  maxBlockBatch: 256,
  maxBeBytes: 4 * 1024,
  maxBeBatch: 1,
  maxStackBytes: 512,
  // player/entity positions may be a little outside the build range while
  // flying; block coordinates are the game's 0..383 (gen-2 HEIGHT)
  posMinY: -64,
  posMaxY: 512,
  blockMinY: 0,
  blockMaxY: 383,
  maxCoord: 30000000,
  maxArmor: 4,
  maxLookString: 64,
};

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const HTML = /[<>"'`\\]/g;

export function cleanText(v, max, { allowNewlines = false, allowAngles = false } = {}) {
  let s = String(v == null ? '' : v);
  s = s.replace(CONTROL, '');
  if (!allowNewlines) s = s.replace(/[\r\n\t]+/g, ' ');
  if (!allowAngles) s = s.replace(HTML, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s.slice(0, max);
}

export const cleanName = (v) => cleanText(v, LIMITS.maxName);
export const cleanRoomName = (v) => cleanText(v, LIMITS.maxRoomName);
export const cleanChat = (v) => cleanText(v, LIMITS.maxChat, { allowNewlines: false });

export function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
export function isInt(v) { return typeof v === 'number' && Number.isInteger(v); }
export function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }
export function isBool(v) { return typeof v === 'boolean'; }
export function inInt(v, lo, hi) { return isInt(v) && v >= lo && v <= hi; }
export function byteLength(v) { try { return Buffer.byteLength(JSON.stringify(v)); } catch (e) { return Infinity; } }

export function validCode(v) { return typeof v === 'string' && /^[A-Z2-9]{6,12}$/.test(v); }
export function validPid(v) { return typeof v === 'string' && /^p_[a-f0-9]{16}$/.test(v); }
export function validToken(v) { return typeof v === 'string' && /^[A-Za-z0-9_-]{20,128}$/.test(v); }

export function validPos(v, yMin = LIMITS.posMinY, yMax = LIMITS.posMaxY) {
  if (!Array.isArray(v) || v.length < 3) return null;
  const [x, y, z] = v;
  if (!isNum(x) || !isNum(y) || !isNum(z)) return null;
  if (Math.abs(x) > LIMITS.maxCoord || Math.abs(z) > LIMITS.maxCoord) return null;
  if (y < yMin || y > yMax) return null;
  return [x, y, z];
}

export function validLook(v) {
  if (v == null) return null;
  if (!isObj(v)) return null;
  const out = {};
  const skin = v.skin == null ? null : String(v.skin);
  if (skin !== null && (skin.length > LIMITS.maxLookString || !/^(p:[a-z_]{3,20}|m:[A-Za-z0-9_]{3,16})$/.test(skin))) return null;
  out.skin = skin;
  out.slim = !!v.slim;
  for (const k of ['cape', 'hat', 'pet', 'pre']) {
    const s = v[k] == null ? null : String(v[k]);
    if (s !== null && !/^[a-z]{3,16}$/.test(s)) return null;
    out[k] = s;
  }
  return out;
}

export function validArmor(v) {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > LIMITS.maxArmor) return null;
  const out = [];
  for (const x of v) {
    if (x == null) { out.push(null); continue; }
    if (!inInt(x, 0, 65535)) return null;
    out.push(x);
  }
  while (out.length < LIMITS.maxArmor) out.push(null);
  return out;
}

export function validStack(v) {
  if (!isObj(v)) return null;
  if (!inInt(v.id, 0, 65535)) return null;
  if (!inInt(v.count, 1, 64)) return null;
  const out = { id: v.id, count: v.count };
  if (v.dmg != null) { if (!inInt(v.dmg, 0, 100000)) return null; out.dmg = v.dmg; }
  if (v.x != null) { const s = String(v.x); if (s.length > 32 || !/^[A-Za-z0-9_:.+-]*$/.test(s)) return null; out.x = s; }
  if (v.unk != null) { const s = String(v.unk); if (s.length > 32 || !/^[A-Za-z0-9_:.+-]*$/.test(s)) return null; out.unk = s; }
  if (byteLength(out) > LIMITS.maxStackBytes) return null;
  return out;
}

export function validState(m) {
  const pos = validPos(m.pos);
  if (!pos) return null;
  if (!isNum(m.yaw) || !isNum(m.pitch)) return null;
  const yaw = ((m.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, m.pitch));
  const armor = validArmor(m.armor);
  if (!armor) return null;
  const mode = ['survival', 'creative', 'spectator', 'adventure'].includes(m.mode) ? m.mode : 'survival';
  let look;
  if (m.look === null) look = null;
  else if (m.look !== undefined) {
    look = validLook(m.look);
    if (!look) return null;
  }
  const health = isNum(m.health) ? Math.max(0, Math.min(20, m.health)) : 20;
  return {
    pos, yaw, pitch, armor, mode, health,
    held: m.held == null ? null : (inInt(m.held, 0, 65535) ? m.held : null),
    sneak: !!m.sneak, swing: !!m.swing, dead: !!m.dead, flying: !!m.flying, swim: !!m.swim,
    look,
  };
}

export function validBlockEntry(e) {
  if (!Array.isArray(e) || e.length < 5 || e.length > 6) return null;
  const [x, y, z, id, meta, wl] = e;
  if (!inInt(x, -LIMITS.maxCoord, LIMITS.maxCoord) || !inInt(z, -LIMITS.maxCoord, LIMITS.maxCoord)) return null;
  if (!inInt(y, LIMITS.blockMinY, LIMITS.blockMaxY)) return null;
  if (!inInt(id, 0, 65535) || !inInt(meta, 0, 15)) return null;
  if (wl !== undefined && wl !== null && !inInt(wl, 0, 1)) return null;
  return [x, y, z, id, meta, wl === undefined || wl === null ? 0 : wl];
}

export function validBlockEntityKey(k) {
  if (typeof k !== 'string' || k.length > 48) return false;
  const m = /^(-?\d{1,9}),(-?\d{1,9}),(-?\d{1,9})$/.exec(k);
  if (!m) return false;
  const x = +m[1], y = +m[2], z = +m[3];
  return Math.abs(x) <= LIMITS.maxCoord && Math.abs(z) <= LIMITS.maxCoord && y >= LIMITS.blockMinY && y <= LIMITS.blockMaxY;
}

export function validBlockEntityData(data) {
  if (!isObj(data)) return null;
  if (byteLength(data) > LIMITS.maxBeBytes) return null;
  // opaque game data (chest slots, signs ...): only a depth/size guard, the
  // client's game data owns the meaning
  let depth = 0;
  const DANGEROUS = new Set(['__proto__', 'constructor', 'prototype']);
  const walk = (v, d) => {
    if (d > 8) throw new Error('deep');
    if (v && typeof v === 'object') {
      if (Array.isArray(v)) { if (v.length > 128) throw new Error('array'); for (const x of v) walk(x, d + 1); }
      else {
        const ks = Object.keys(v); if (ks.length > 64) throw new Error('keys');
        for (const k of ks) { if (DANGEROUS.has(k)) throw new Error('key'); walk(v[k], d + 1); }
      }
    }
  };
  try { walk(data, 0); } catch (e) { return null; }
  return data;
}

export function validPstate(data) {
  if (!isObj(data)) return null;
  if (byteLength(data) > LIMITS.maxPstateBytes) return null;
  try { return JSON.parse(JSON.stringify(data)); } catch (e) { return null; }
}
