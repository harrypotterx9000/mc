// Client identity for direct LAN clients and for HTTPS/WSS deployments where a
// reverse proxy or tunnel connects to this process from 127.0.0.1.
//
// Trust rule: forwarding headers are only believed when the direct socket is a
// loopback address (the proxy runs on this machine). A LAN client that sends
// X-Forwarded-For itself therefore cannot change its identity, bypass the
// per-IP join/create limits or reach the admin interface.
import net from 'node:net';

// Normalise an address header value: strip [brackets], IPv4:port and the
// IPv4-mapped IPv6 prefix. Returns '' for anything that is not an IP.
export function cleanIp(value) {
  let s = String(value == null ? '' : value).trim();
  if (!s) return '';
  if (s.startsWith('[')) {
    const end = s.indexOf(']');
    if (end > 0) s = s.slice(1, end);
  }
  s = s.replace(/^::ffff:/i, '');
  if (net.isIP(s)) return s;
  const m = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(s);
  if (m && net.isIP(m[1])) return m[1];
  return '';
}

export function isLoopback(value) {
  const s = cleanIp(value);
  return s === '127.0.0.1' || s === '::1';
}

// The address a proxy appended for the real client. Proxies append their own
// hop, so the last valid value is the one closest to this process; client-sent
// values appear earlier. CF-Connecting-IP is Cloudflare's authoritative value.
export function forwardedIp(req) {
  const headers = (req && req.headers) || {};
  const xff = String(headers['x-forwarded-for'] || '')
    .split(',')
    .map(cleanIp)
    .filter(Boolean);
  if (xff.length) return xff[xff.length - 1];
  const cf = cleanIp(String(headers['cf-connecting-ip'] || '').split(',')[0]);
  if (cf) return cf;
  return cleanIp(String(headers['x-real-ip'] || '').split(',')[0]);
}

// Effective client address for rate limits and logs. Forwarded headers are
// honoured only for a local proxy; direct LAN clients keep their socket IP.
export function clientIp(req) {
  const direct = cleanIp(req && req.socket && req.socket.remoteAddress);
  const forwarded = forwardedIp(req);
  return (forwarded && isLoopback(direct)) ? forwarded : direct;
}
