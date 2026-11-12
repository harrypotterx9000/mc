'use strict';
// ---------------------------------------------------------------------------
// GuestSession - the smallest identity this game has (PROJECT_SPEC §3):
//   * a nickname the player chooses;
//   * a temporary player id issued by the server for the current room;
//   * the room id;
//   * the connection state;
//   * a short-lived reconnect hint.
// There is no account here: no registration, login, password, e-mail, phone
// number, permanent profile or user database. The nickname is kept in this
// browser only; the temporary id belongs to the room session.
//
// The server is authoritative. `connected()` is only called from the network
// layer with an id the server sent (the existing room protocol's login eid;
// phase-05's server will issue its own). Until a server has spoken, the
// module exposes a clearly marked provisional id for local/single-player
// bookkeeping - never as an authenticated identity.
// ---------------------------------------------------------------------------
const GuestSession = (() => {
  const NAME_KEY = 'mcjs-guest-name';
  const RESUME_KEY = 'mcjs-guest-resume'; // sessionStorage: one tab, short-lived
  const RESUME_TTL = 5 * 60 * 1000;
  const NAME_MAX = 16;

  // a nickname as the player typed it: no control characters, quotes or markup; 1-16 characters
  function cleanName(v) {
    return String(v == null ? '' : v)
      .replace(/[\u0000-\u001f\u007f<>"'`\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, NAME_MAX);
  }
  const roomCode = (v) => String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const validId = (v) => typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(v);

  let name = '';
  let serverId = '';      // what the server issued (authoritative); '' = none yet
  let provisionalId = ''; // only for local bookkeeping, never sent as an authenticated id
  let room = '';
  let conn = 'idle';      // idle | connecting | connected | disconnected

  function saveName(v) {
    name = cleanName(v);
    try { if (name) localStorage.setItem(NAME_KEY, name); else localStorage.removeItem(NAME_KEY); } catch (e) { }
    // the rest of the game still reads settings.netName; keep it in step (it is a preference, not an account)
    try { if (typeof game !== 'undefined' && game && game.settings) game.settings.netName = name; } catch (e) { }
    if (room) writeResume();
    return name;
  }
  function loadName() {
    try { name = cleanName(localStorage.getItem(NAME_KEY)); } catch (e) { name = ''; }
    if (!name) {
      // take the multiplayer name this browser already had, once, so existing players keep their name
      try { const s = JSON.parse(localStorage.getItem('mcjs-settings') || '{}'); name = cleanName(s.netName); } catch (e) { }
      if (name) saveName(name);
    }
  }
  function randomId() {
    try { const a = crypto.getRandomValues(new Uint8Array(12)); return 'local_' + [...a].map((b) => b.toString(16).padStart(2, '0')).join(''); }
    catch (e) { return 'local_' + Math.random().toString(36).slice(2, 14) + Date.now().toString(36); }
  }
  function resumeRecord() {
    try { return JSON.parse(sessionStorage.getItem(RESUME_KEY) || 'null'); } catch (e) { return null; }
  }
  function clearResume() { try { sessionStorage.removeItem(RESUME_KEY); } catch (e) { } }
  function writeResume() {
    if (!room) { clearResume(); return; }
    const rec = { v: 1, name, room, pid: serverId || '', at: Date.now() };
    try { sessionStorage.setItem(RESUME_KEY, JSON.stringify(rec)); } catch (e) { }
  }

  loadName();

  const api = {
    NAME_KEY, RESUME_KEY, NAME_MAX, RESUME_TTL,
    cleanName,
    get name() { return name; },
    set name(v) { saveName(v); },
    setName(v) { return saveName(v); },
    // the nickname shown when none has been chosen yet
    get displayName() { return name || '玩家'; },
    // server-issued temporary player id; the provisional one is only a local placeholder
    get playerId() { return serverId || (provisionalId || (provisionalId = randomId())); },
    get provisionalPlayerId() { return provisionalId || (provisionalId = randomId()); },
    get serverAssigned() { return !!serverId; },
    get roomId() { return room; },
    get connection() { return conn; },
    get inRoom() { return !!room; },

    // entering a room (or a direct server): a fresh session, no identity carried over
    beginConnect(code) {
      room = roomCode(code);
      serverId = '';
      provisionalId = '';
      conn = 'connecting';
      writeResume();
    },
    // the server said who we are in this session; only the network layer calls this
    connected(id) {
      if (validId(id)) serverId = String(id);
      conn = 'connected';
      writeResume();
      return serverId;
    },
    disconnected() {
      conn = 'disconnected';
      writeResume();
    },
    // the page is going away: keep the room's short reconnect hint, no promise of reconnecting
    suspend() {
      if (room) { conn = 'disconnected'; writeResume(); }
    },
    // the player left on purpose: no session, no reconnect hint
    leaveRoom() {
      room = '';
      serverId = '';
      provisionalId = '';
      conn = 'idle';
      clearResume();
    },
    // the short-lived hint only; nothing is trusted until the server accepts it again
    resumeInfo() {
      const r = resumeRecord();
      if (!r || !r.room || !r.at) return null;
      const age = Date.now() - r.at;
      if (age > RESUME_TTL) { clearResume(); return null; }
      return {
        room: roomCode(r.room),
        name: cleanName(r.name),
        playerId: validId(r.pid) ? r.pid : '',
        serverAssigned: validId(r.pid),
        age,
        expiresIn: Math.max(0, RESUME_TTL - age),
      };
    },
    clearResume,
    // a short line for menus/diagnostics
    statusText() {
      return { idle: '未连接', connecting: '正在连接…', connected: '已连接', disconnected: '连接已断开' }[conn] || conn;
    },
  };
  return api;
})();
