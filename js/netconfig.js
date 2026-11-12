// Where the room service is (multiplayer/rooms): its HTTPS address, e.g. 'https://mc.example.com'.
// share: the page address put into invite links (default: this page's own); ?rooms=<address> overrides rooms for testing.
window.NET_CONFIG = {
  // (port 8443: the IDC drops HTTPS to this name on 443 whenever it can read it - not on its 备案 whitelist - which
  // was every HarmonyOS phone and some others; Caddy serves both ports)
  // phase-04: the address is still the original room service (multiplayer is phase-05). The page no longer polls
  // its /api/announce in the background: a standalone single-player game must not talk to a third-party platform
  // when nobody asked it to. phase-05's own server replaces the room service and re-enables announcements.
  rooms: 'https://xz.honghemc.cn:8443',
  announce: false,
  share: '',
};
