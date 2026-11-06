// Where the room service is (multiplayer/rooms): its HTTPS address, e.g. 'https://mc.example.com'.
// share: the page address put into invite links (default: this page's own); ?rooms=<address> overrides rooms for testing.
window.NET_CONFIG = {
  // (port 8443: the IDC drops HTTPS to this name on 443 whenever it can read it - not on its 备案 whitelist - which
  // was every HarmonyOS phone and some others; Caddy serves both ports)
  rooms: 'https://xz.honghemc.cn:8443',
  share: '',
};
