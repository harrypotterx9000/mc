// Minimal RFC 6455 WebSocket server for OpusMC's self-hosted server.
// Zero npm dependencies: Node's HTTP upgrade + SHA-1 handshake + frame codec.
// Only what the game protocol needs: text frames, fragmentation, ping/pong,
// close, masking checks and size limits. No extensions (permessage-deflate is
// not negotiated).
import { createHash } from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const OP = { CONT: 0, TEXT: 1, BINARY: 2, CLOSE: 8, PING: 9, PONG: 10 };

function frame(opcode, payload) {
  const len = payload.length;
  let head;
  if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
  else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  head[0] = 0x80 | opcode;
  return Buffer.concat([head, payload]);
}

export class WSConnection {
  constructor(owner, req, socket) {
    this.owner = owner;
    this.req = req;
    this.socket = socket;
    this.ip = req.socket.remoteAddress || '';
    this.origin = String(req.headers.origin || '');
    this.userAgent = String(req.headers['user-agent'] || '').slice(0, 200);
    this.closed = false;
    this.closeCode = 0;
    this.closeReason = '';
    this._buf = Buffer.alloc(0);
    this._frag = null;
    this._fragOp = 0;
    this._lastPong = Date.now();
    this._lastSeen = Date.now();
    this._closeTimer = null;
    this._decoder = new TextDecoder('utf-8', { fatal: true });
    socket.on('data', (chunk) => this._feed(chunk));
    socket.on('error', () => this._finish());
    socket.on('close', () => this._finish());
    socket.on('end', () => this._finish());
  }

  get remoteAddress() { return this.ip; }
  get bufferedAmount() { return this.socket.writableLength || 0; }

  send(obj) {
    if (this.closed) return false;
    let text;
    try { text = typeof obj === 'string' ? obj : JSON.stringify(obj); } catch (e) { return false; }
    return this._sendFrame(OP.TEXT, Buffer.from(text, 'utf8'));
  }

  sendRaw(buffer) {
    if (this.closed) return false;
    return this._sendFrame(OP.BINARY, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  }

  _sendFrame(opcode, payload) {
    if (this.closed || !this.socket.writable) return false;
    if (this.bufferedAmount > this.owner.maxBufferedBytes) { this.close(1013, 'server busy'); return false; }
    try {
      this.socket.write(frame(opcode, payload));
      return true;
    } catch (e) { this._finish(); return false; }
  }

  ping() {
    if (this.closed) return;
    const p = Buffer.alloc(8); p.writeBigUInt64BE(BigInt(Date.now()));
    this._sendFrame(OP.PING, p);
    if (Date.now() - this._lastPong > this.owner.idleMs) this.terminate();
  }

  close(code = 1000, reason = '') {
    if (this.closed) return;
    if (this._closeTimer) return;
    let r = Buffer.from(String(reason || '').slice(0, 100), 'utf8');
    const p = Buffer.alloc(2 + r.length);
    p.writeUInt16BE(code >>> 0, 0);
    r.copy(p, 2);
    this._sendFrame(OP.CLOSE, p);
    this.closed = true;
    this.closeCode = code;
    this.closeReason = String(reason || '');
    try { this.socket.end(); } catch (e) { }
    this._closeTimer = setTimeout(() => this.terminate(), 1000);
    this._closeTimer.unref();
    this._emitClose();
  }

  terminate() {
    try { this.socket.destroy(); } catch (e) { }
    this._finish();
  }

  _finish() {
    if (this._done) return;
    this._done = true;
    this.closed = true;
    if (this._closeTimer) { clearTimeout(this._closeTimer); this._closeTimer = null; }
    this.owner.clients.delete(this);
    this._emitClose();
  }

  _emitClose() {
    if (this._closeEmitted) return;
    this._closeEmitted = true;
    try { this.owner.onClose && this.owner.onClose(this, this.closeCode, this.closeReason); } catch (e) { }
  }

  _feed(chunk) {
    if (this.closed) return;
    this._lastSeen = Date.now();
    if (this._buf.length + chunk.length > this.owner.maxBufferedBytes) { this.close(1009, 'message too large'); return; }
    this._buf = this._buf.length ? Buffer.concat([this._buf, chunk]) : chunk;
    try {
      while (this._parse()) { /* keep parsing */ }
    } catch (e) {
      this.close(1002, 'protocol error');
    }
  }

  // Returns true when another frame may follow in the buffer.
  _parse() {
    const b = this._buf;
    if (b.length < 2) return false;
    const b0 = b[0], b1 = b[1];
    const fin = (b0 & 0x80) !== 0, rsv = b0 & 0x70, op = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f, off = 2;
    if (rsv) throw new Error('rsv');
    if (!masked) throw new Error('unmasked client frame');
    if (len === 126) {
      if (b.length < 4) return false;
      len = b.readUInt16BE(2); off = 4;
    } else if (len === 127) {
      if (b.length < 10) return false;
      const big = b.readBigUInt64BE(2);
      if (big > BigInt(this.owner.maxMessageBytes + 1024)) throw new Error('too large');
      len = Number(big); off = 10;
    }
    if (len > this.owner.maxMessageBytes) throw new Error('too large');
    if (op >= 8) {
      if (!fin || len > 125) throw new Error('bad control frame');
    }
    if (b.length < off + 4 + len) return false;
    const mask = b.subarray(off, off + 4); off += 4;
    const payload = Buffer.from(b.subarray(off, off + len));
    for (let i = 0; i < len; i++) payload[i] ^= mask[i & 3];
    this._buf = b.subarray(off + len);

    if (op === OP.PING) { this._sendFrame(OP.PONG, payload); return true; }
    if (op === OP.PONG) { this._lastPong = Date.now(); return true; }
    if (op === OP.CLOSE) {
      const code = payload.length >= 2 ? payload.readUInt16BE(0) : 1000;
      const reason = payload.length > 2 ? this._decoder.decode(payload.subarray(2)).slice(0, 100) : '';
      this.close(code === 1005 || code === 1006 ? 1000 : code, reason);
      return false;
    }
    if (op === OP.CONT) {
      if (!this._frag) throw new Error('unexpected continuation');
      if (this._frag.length + payload.length > this.owner.maxMessageBytes) throw new Error('too large');
      this._frag = Buffer.concat([this._frag, payload]);
      if (fin) {
        const data = this._frag; this._frag = null;
        this._message(this._fragOp, data);
      }
      return true;
    }
    if (op === OP.TEXT || op === OP.BINARY) {
      if (this._frag) throw new Error('nested data frame');
      if (fin) this._message(op, payload);
      else { this._frag = payload; this._fragOp = op; }
      return true;
    }
    throw new Error('unknown opcode');
  }

  _message(op, payload) {
    if (op === OP.TEXT) {
      let text;
      try { text = this._decoder.decode(payload); } catch (e) { this.close(1007, 'invalid utf-8'); return; }
      try { this.owner.onMessage && this.owner.onMessage(this, text); } catch (e) { this.owner.onError && this.owner.onError(this, e); }
    } else {
      this.owner.onBinary && this.owner.onBinary(this, payload);
    }
  }
}

export class WSServer {
  constructor({ server, path = '/ws', maxConnections = 64, maxMessageBytes = 262144, maxBufferedBytes = 4 << 20, pingMs = 30000, idleMs = 90000, originCheck = null, onConnection, onMessage, onBinary, onClose, onError }) {
    this.path = path;
    this.maxConnections = maxConnections;
    this.maxMessageBytes = maxMessageBytes;
    this.maxBufferedBytes = maxBufferedBytes;
    this.pingMs = pingMs;
    this.idleMs = idleMs;
    this.originCheck = originCheck;
    this.onConnection = onConnection;
    this.onMessage = onMessage;
    this.onBinary = onBinary;
    this.onClose = onClose;
    this.onError = onError;
    this.clients = new Set();
    server.on('upgrade', (req, socket, head) => this._upgrade(req, socket, head));
    this._timer = setInterval(() => { for (const c of this.clients) c.ping(); }, pingMs);
    this._timer.unref();
  }

  _upgrade(req, socket, head) {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname !== this.path) return this._reject(socket, 404, 'Not Found');
      if (req.method !== 'GET') return this._reject(socket, 405, 'Method Not Allowed');
      if (String(req.headers.upgrade || '').toLowerCase() !== 'websocket') return this._reject(socket, 400, 'Bad Request');
      if (String(req.headers['sec-websocket-version'] || '') !== '13') return this._reject(socket, 426, 'Upgrade Required');
      const key = String(req.headers['sec-websocket-key'] || '');
      if (!/^[A-Za-z0-9+/]{22}==$/.test(key)) return this._reject(socket, 400, 'Bad Request');
      if (this.clients.size >= this.maxConnections) return this._reject(socket, 503, 'Service Unavailable');
      if (this.originCheck && !this.originCheck(req, url)) return this._reject(socket, 403, 'Forbidden');
      const accept = createHash('sha1').update(key + GUID).digest('base64');
      socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n');
      socket.setNoDelay(true);
      const conn = new WSConnection(this, req, socket);
      this.clients.add(conn);
      try { this.onConnection && this.onConnection(conn, req); } catch (e) { this.onError && this.onError(conn, e); conn.close(1011, 'server error'); }
      if (head && head.length) conn._feed(head);
    } catch (e) {
      try { socket.destroy(); } catch (e2) { }
    }
  }

  _reject(socket, status, text) {
    try {
      const body = text + '\n';
      socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
      socket.end();
      setTimeout(() => { try { socket.destroy(); } catch (e) { } }, 1000).unref();
    } catch (e) { try { socket.destroy(); } catch (e2) { } }
  }

  get size() { return this.clients.size; }

  closeAll(code = 1001, reason = 'server shutting down') {
    for (const c of [...this.clients]) c.close(code, reason);
  }
}
