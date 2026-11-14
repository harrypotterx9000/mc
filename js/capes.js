'use strict';
// ---------------------------------------------------------------------------
// Capes: all original designs, none of Mojang's or Bilibili's. Four static ones
// drawn pixel by pixel, three animated ones worked out frame by frame. Every design is free (phase-02: no unlock
// condition), the administrators' and the sign-in event's included. Each is a texture in
// vanilla's cape layout (64 x 32: the cape 10 x 16 x 1 at 0,0; the elytra 10 x 20 x 2 at 22,0), so a player wearing
// an elytra wears the design's wings, as in vanilla - each design has its own (outline and picture, WINGS), they are
// not the cape stretched. Animated capes are 16 frames made once; the current
// one is copied into the cape's texture only when it changes (8 a second), nothing is made per frame.
// The cape hangs from the top of the back and swings like vanilla's (CapeLayer): it trails a lagging point that
// follows the player, swings more when moving forward or falling, sways while walking, and moves out over a
// chestplate. Not drawn in first person.
// ---------------------------------------------------------------------------
const Capes = (() => {
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  // ---- the static designs: 10 x 16 pixels, the outside of the cape ----
  const ART = {
    potato: {
      pal: { y: '#E8B830', g: '#3F7A3A', G: '#2F5D2C', s: '#7BC24F', p: '#C8914F', P: '#A06A33', d: '#6E4522', h: '#E8BB80' },
      rows: ['yyyyyyyyyy', 'yGgGgGgGgy', 'ygGgsgGgGy', 'yGgGssGgGy', 'ygGgGsgGgy', 'yGgpppppgy', 'ygpphpppPy', 'yGphhppdPy',
        'ygpppppPPy', 'yGpdpppPPy', 'ygpppdPPPy', 'yGgPPPPPgy', 'ygGgGgGgGy', 'yGgGgGgGgy', 'ygGgGgGgGy', 'yyyyyyyyyy'],
    },
    sakura: {
      pal: { s: '#F9D3E2', S: '#F3B4CC', w: '#FFFFFF', p: '#E86A9A', b: '#6A4434', k: '#4A2E24' },
      rows: ['ssSsssSsss', 'sspwpsssSs', 'spwpbbsSss', 'ssbbkspwps', 'sbksspwwps', 'bkSsssppss', 'kssSpssSss', 'ssspwpssSs',
        'sSsspssbbs', 'sssSssbkSs', 'spssSbkspw', 'pwpsbkssSp', 'spsbkSsssS', 'ssbkssSpss', 'sbkssspwps', 'bkSsssspss'],
    },
    starry: {
      pal: { n: '#0B1636', N: '#16245A', w: '#FFFFFF', y: '#FFE58A', m: '#F5F1C8', b: '#2B3A7A', c: '#5468B8' },
      rows: ['nNnnnwnnNn', 'nnnNnnnnnn', 'nwnnnnmmnn', 'nnnnnmmnnn', 'nnNnnmmnnN', 'nnnnnnmmny', 'Nnnynnnnnn', 'nnnnnNnnnn',
        'nnwnnnnnwn', 'nnnnnnnNnn', 'nNnnnynnnn', 'nnnnnnnnnn', 'nnnNnnnnwn', 'nwnnnnNnnn', 'cnncnncnnc', 'bbbbbbbbbb'],
    },
    ocean: {
      pal: { l: '#8FDBF5', w: '#EEF9FF', m: '#2C7CC4', d: '#114780', D: '#0B3462', s: '#F2D79B' },
      rows: ['llllllllll', 'lwwllllwwl', 'wmmwllwmmw', 'mmmmwwmmmm', 'mmmmmmmmmm', 'mwwmmmmwwm', 'wddwmmwddw', 'dddddddddd',
        'dwwddddwwd', 'wDDwddwDDw', 'DDDDDDDDDD', 'DDsDDDDDsD', 'DDDDDDDDDD', 'DDDDsDDDDD', 'ssDDDDDsss', 'ssssssssss'],
    },
    // the sign-in event's (day 2, COMMUNITY_PLAN.md): a penguin on a pale blue winter sky, light snow, on a snowbank
    penguin: {
      pal: { b: '#BFE6FF', w: '#FFFFFF', k: '#1E1E26', e: '#FFFFFF', o: '#F29A2E', W: '#F7F7F2', g: '#F4FAFF', G: '#D6ECFA' },
      rows: ['bwbbbbbwbb', 'bbbkkkkbbb', 'wbkkkkkkbb', 'bbkekkekbw', 'bbkkookkbb', 'bbkkWWkkbb', 'bkkWWWWkkb', 'bkkWWWWkkb',
        'wkkWWWWkkb', 'bbkWWWWkbb', 'bbkWWWWkbw', 'bbkkWWkkbb', 'bwbkkkkbbb', 'bboobboobb', 'gggggggggg', 'gGgggGgggG'],
    },
  };
  // (the same penguin as a sprite for the animated one: '.' is the sky behind it; its feet are drawn on their own)
  const PENGUIN = ['...kkkk...', '..kkkkkk..', '..kekkek..', '..kkookk..', '..kkWWkk..', '.kkWWWWkk.', '.kkWWWWkk.',
    '.kkWWWWkk.', '..kWWWWk..', '..kWWWWk..', '..kkWWkk..', '...kkkk...'];
  // the golden apple (8 x 9): stem and leaf, a dent at the top, lit from the top left
  const GOLDAPPLE = ['....b...', '...bgG..', '.yy.byy.', 'yWYyyyyy', 'yYYyyyyo', 'yYyyyyyo', 'yyyyyyoo', '.yyyyoo.', '..yo.oo.'];
  // ---- the animated designs: colour at (u, v) of the cape (0-1 across, 0-1 down) at time t (0-1, one loop) ----
  const TAU = Math.PI * 2;
  const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  const STAR = (u, v, seed) => { const h = Math.sin(Math.floor(u * 10) * 12.9898 + Math.floor(v * 16) * 78.233 + seed) * 43758.5453; return h - Math.floor(h); };
  const ANIM = {
    // a summer sunset by the sea: the sun low in an orange sky, its light glittering on the water, waves running up the sand
    sunset(u, v, t) {
      const x = Math.min(9, Math.floor(u * 10)), y = Math.min(15, Math.floor(v * 16));
      const rnd = (s) => { const h = Math.sin(x * 12.9898 + y * 78.233 + s) * 43758.5453; return h - Math.floor(h); };
      if (y < 8) {
        let c = mix(hex('#FF7A59'), hex('#FFD27A'), y / 7);
        const r = Math.hypot(x - 4.5, (y - 6.2) * 1.1);
        if (r < 2.4) c = hex(r < 1.4 ? '#FFF6C8' : '#FFE27A');
        if (y < 3 && rnd(2) > 0.86) c = mix(c, hex('#FFB8A0'), 0.6); // a few pink clouds
        return c;
      }
      if (y < 13) {
        // the sun's path on the water: glints that change every frame
        let c = y === 8 ? hex('#4AA3E0') : hex(y < 11 ? '#2B7FD1' : '#1F64B0');
        if (Math.abs(x - 4.5) < 1.6 - (y - 8) * 0.15 && rnd(Math.floor(t * 16)) > 0.4) c = hex(y === 8 ? '#FFF2B0' : '#FFD27A');
        return c;
      }
      const foam = 13 + Math.round(0.9 * Math.sin(t * TAU + x * 0.4));
      if (y === foam) return hex('#F5FBFF');
      if (y < foam) return hex('#5BB7E8');
      return hex(y === 15 ? '#E8C77E' : '#F2D79B');
    },
    lava(u, v, t) {
      const flow = Math.sin(u * 7 + Math.sin(v * 5 + t * TAU) * 1.5) * Math.cos(v * 6 - t * TAU * 2) + 0.6 * Math.sin((u + v) * 9 + t * TAU);
      let c = flow > 0.9 ? hex('#FFE27A') : flow > 0.35 ? hex('#FF9A2A') : flow > -0.3 ? hex('#E0461A') : flow > -0.9 ? hex('#7A1A0A') : hex('#2E0A04');
      return c;
    },
    nebula(u, v, t) {
      const a = Math.sin(u * 4 + t * TAU) + Math.sin(v * 5 - t * TAU) + Math.sin((u - v) * 6 + 1.3) * 0.7 + Math.sin(u * 9 + v * 3 + t * TAU * 2) * 0.4;
      const f = (a + 3) / 6;
      let c = f < 0.4 ? mix(hex('#0A0420'), hex('#2A1060'), f / 0.4) : f < 0.7 ? mix(hex('#2A1060'), hex('#7A3AB8'), (f - 0.4) / 0.3) : mix(hex('#7A3AB8'), hex('#F08AD8'), Math.min(1, (f - 0.7) / 0.3));
      const s = STAR(u, v, 7); if (s > 0.9) c = mix(c, [255, 255, 255], Math.max(0, Math.sin(t * TAU * 3 + s * 60)));
      return c;
    },
  };
  // the administrators' crown (选项 → 账号 → 管理员), in eight colourings they pick from: a diamond weave, a border
  // with a light running round it, a crown set with two jewels that glint, a star below that breathes, sparks, and a
  // sheen sweeping across now and then. A colouring: background top / bottom, weave, border and its light, crown
  // light / mid / dark, the two jewels, the star's light, the sparks
  const CROWN = ['#.##.#', '######', '#R##B#', '######'];
  const STARP = ['.##.', '####', '.##.'];
  const GOLDS = { rim: '#E8B830', rimL: '#FFF6C0', crL: '#FFE27A', cr: '#F2C94C', crD: '#C8961E', star: '#FFF0A0' };
  const SILVER = { rim: '#B8C0CC', rimL: '#FFFFFF', crL: '#F2F5FA', cr: '#C8D0DC', crD: '#8A94A4', star: '#FFFFFF' };
  const CROWNS = {
    admin: ['紫金', { ...GOLDS, bg1: '#2A0A4A', bg2: '#4A1478', weave: '#7A3AB8', j1: '#E0303A', j2: '#3A6AE0', spark: '#FFF0C8' }],
    admblack: ['黑金', { ...GOLDS, bg1: '#0C0C10', bg2: '#1E1E26', weave: '#3C3A30', j1: '#E0303A', j2: '#2FC4A0', spark: '#FFE08A' }],
    admred: ['酒红金', { ...GOLDS, bg1: '#3A0610', bg2: '#6E1020', weave: '#A8303E', j1: '#2FB0E0', j2: '#3AD07A', spark: '#FFE6C0' }],
    admblue: ['宝蓝金', { ...GOLDS, bg1: '#08163E', bg2: '#123072', weave: '#2E5AB8', j1: '#E0303A', j2: '#3AD07A', spark: '#DDEBFF' }],
    admgreen: ['翡翠金', { ...GOLDS, bg1: '#052A1A', bg2: '#0C5434', weave: '#1F8A55', j1: '#E0303A', j2: '#3A6AE0', spark: '#E6FFE0' }],
    admivory: ['象牙白金', { ...GOLDS, rim: '#C8961E', bg1: '#F4F0E6', bg2: '#DCD2BE', weave: '#FFFFFF', j1: '#D0283A', j2: '#2A5AD0', spark: '#FFFFFF', star: '#FFE27A' }],
    admsilver: ['黑银', { ...SILVER, bg1: '#0C0C10', bg2: '#1C1E26', weave: '#3A3E4A', j1: '#E0303A', j2: '#3A8AE0', spark: '#E6F0FF' }],
    admnavy: ['午夜蓝银', { ...SILVER, star: '#EAF2FF', bg1: '#060A1E', bg2: '#101C44', weave: '#26386E', j1: '#8A3AE0', j2: '#3AD0E0', spark: '#CFE0FF' }],
  };
  const crownCape = (P) => (u, v, t) => {
    const x = Math.min(9, Math.floor(u * 10)), y = Math.min(15, Math.floor(v * 16));
    const RIM = hex(P.rim), LIGHT = hex(P.rimL);
    if (x === 0 || x === 9 || y === 0 || y === 15) {
      // (48 pixels round the edge; the light goes round once a loop)
      const k = y === 0 ? x : x === 9 ? 9 + y : y === 15 ? 24 + (9 - x) : 33 + (15 - y);
      const d = Math.abs((((k - t * 48) % 48) + 48) % 48), near = Math.min(d, 48 - d);
      return near < 1.5 ? LIGHT : near < 3.5 ? mix(RIM, LIGHT, 0.45) : RIM;
    }
    const sheen = (c) => { const s = (x + y * 0.6) / 15, p = (t * 1.6) % 1.6 - 0.2; return Math.abs(s - p) < 0.07 ? mix(c, [255, 255, 255], 0.3) : c; };
    const cr = y >= 2 && y <= 5 && x >= 2 && x <= 7 ? CROWN[y - 2][x - 2] : '.';
    if (cr === 'R' || cr === 'B') return mix(hex(cr === 'R' ? P.j1 : P.j2), [255, 255, 255], Math.max(0, Math.sin(t * TAU * 2 + (cr === 'R' ? 0 : 2))) * 0.5);
    if (cr === '#') return sheen(hex(y === 2 ? P.crL : y === 5 ? P.crD : P.cr));
    const st = y >= 9 && y <= 11 && x >= 3 && x <= 6 ? STARP[y - 9][x - 3] : '.';
    if (st === '#') return mix(hex(P.crD), hex(P.star), 0.5 + 0.5 * Math.sin(t * TAU));
    let c = mix(hex(P.bg1), hex(P.bg2), y / 15);
    if ((x + y) % 4 === 0 && (((x - y) % 4) + 4) % 4 === 0) c = mix(c, hex(P.weave), 0.55);
    const sp = STAR(u, v, 11);
    if (sp > 0.92) c = mix(c, hex(P.spark), Math.max(0, Math.sin(t * TAU * 3 + sp * 60)) * 0.9);
    return sheen(c);
  };
  for (const id in CROWNS) ANIM[id] = crownCape(CROWNS[id][1]);
  // more of the administrators' designs (ids start with adm: the room service lets only administrators wear them)
  const px = (u, v) => [Math.min(9, Math.floor(u * 10)), Math.min(15, Math.floor(v * 16))];
  const rndc = (x, y, s) => { const h = Math.sin(x * 12.9898 + y * 78.233 + s) * 43758.5453; return h - Math.floor(h); };
  // the Ender dragon's: black and violet, ender particles rising, a pair of eyes that glow and blink, a violet edge
  ANIM.admender = (u, v, t) => {
    const [x, y] = px(u, v);
    if (x === 0 || x === 9 || y === 0 || y === 15) return mix(hex('#3A0F55'), hex('#B040E0'), 0.5 + 0.5 * Math.sin(t * TAU + (x + y) * 0.5));
    if (y === 3 && (x === 3 || x === 6)) { const blink = (t * 16 | 0) % 16 === 9; return blink ? hex('#1A0826') : mix(hex('#CC33FF'), hex('#FFD0FF'), 0.5 + 0.5 * Math.sin(t * TAU * 2)); }
    let c = mix(hex('#0B0410'), hex('#1E0A30'), y / 15);
    for (let k = 0; k < 2; k++) { // two particles a column, rising and wrapping
      const py = ((rndc(x, k, 3) * 16 - t * 16 * (1 + k)) % 16 + 16) % 16;
      if (Math.abs(py - y) < 0.6) c = hex(k ? '#FF66FF' : '#CC33FF'); else if (Math.abs(py - y) < 1.4) c = mix(c, hex('#7A1AA0'), 0.6);
    }
    return c;
  };
  // the aurora: a night sky, two ribbons of light waving (green to cyan, violet below), stars, snowy mountains
  ANIM.admaurora = (u, v, t) => {
    const [x, y] = px(u, v);
    const MT = [12, 11, 10, 11, 12, 11, 10, 9, 10, 11];
    if (y >= MT[x]) return hex(y === MT[x] ? '#F2F8FF' : y < 14 ? '#9DB4D0' : '#6E86A8');
    let c = mix(hex('#03101C'), hex('#0B2540'), y / 12);
    const y1 = 3.5 + 1.6 * Math.sin(x * 0.7 + t * TAU), y2 = 7 + 1.2 * Math.sin(x * 0.55 - t * TAU + 1);
    const d1 = Math.abs(y - y1), d2 = Math.abs(y - y2);
    if (d1 < 1.6) c = mix(c, mix(hex('#3BFF9A'), hex('#4AE0FF'), x / 9), 1 - d1 / 1.6);
    if (d2 < 1.2) c = mix(c, hex('#9A5BFF'), (1 - d2 / 1.2) * 0.8);
    const s = rndc(x, y, 9); if (s > 0.93 && d1 > 1.6) c = mix(c, [255, 255, 255], Math.max(0, Math.sin(t * TAU * 2 + s * 40)));
    return c;
  };
  // the red river (for 有问题的红河): a crimson river winding down between dark stone banks, flowing, gold along its banks
  ANIM.admriver = (u, v, t) => {
    const [x, y] = px(u, v);
    const mid = 4.5 + 2.2 * Math.sin(y * 0.45), half = 1.6;
    const d = Math.abs(x - mid);
    if (d < half) {
      const flow = ((y - t * 16) % 4 + 4) % 4;
      return flow < 1 ? hex('#FF5A5A') : flow < 2 ? hex('#E0283A') : hex('#B3122E');
    }
    if (d < half + 0.9) return (y + Math.floor(t * 8)) % 3 ? hex('#E8B830') : hex('#FFE27A');
    const s = rndc(x, y, 4);
    return s > 0.8 ? hex('#4A4A4A') : s > 0.4 ? hex('#353535') : hex('#262626');
  };
  // liquid gold: a gold band at the shoulders running down in drips of different lengths over black, a sheen
  ANIM.admgold = (u, v, t) => {
    const [x, y] = px(u, v);
    const base = 3 + Math.floor(rndc(x, 0, 6) * 4), len = 3 + Math.floor((0.5 + 0.5 * Math.sin(t * TAU + x * 1.3)) * 7);
    let c = y < 2 ? hex('#E8B830') : y <= base + len ? (y === base + len ? hex('#FFE27A') : hex(y % 2 ? '#D9A520' : '#E8B830')) : mix(hex('#141414'), hex('#222222'), y / 15);
    const s = (x + y * 0.6) / 15, p = (t * 1.4) % 1.4 - 0.2;
    if (Math.abs(s - p) < 0.06 && y <= base + len) c = mix(c, [255, 255, 255], 0.5);
    return c;
  };
  // the void: deep black, a spiral galaxy turning in the middle (violet and blue arms, a white core), far stars
  ANIM.admvoid = (u, v, t) => {
    const [x, y] = px(u, v);
    const dx = x - 4.5, dy = (y - 7.5) * 0.7, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    let c = hex('#03020A');
    if (r < 0.9) return hex('#FFFFFF');
    if (r < 1.6) c = hex('#C8B8FF');
    else if (r < 5.2) { const arm = Math.cos(2 * (a - r * 0.9 - t * TAU)); if (arm > 0.55) c = mix(hex('#3A2AA0'), hex('#B060FF'), (arm - 0.55) / 0.45 * (1 - r / 6)); }
    const s = rndc(x, y, 12); if (s > 0.92) c = mix(c, [255, 255, 255], 0.4 + 0.6 * Math.max(0, Math.sin(t * TAU * 2 + s * 50)));
    return c;
  };
  // the sign-in event's animated penguin (day 5): the same penguin waddling from side to side - leaning one way it
  // lifts the other foot and rises a pixel - while snow falls past it (16 frames: two steps each way)
  ANIM.penguinwalk = (u, v, t) => {
    const [x, y] = px(u, v), f = Math.floor(t * 16) % 16, step = (f >> 1) % 4;
    const dx = [0, 1, 0, -1][step], lift = step === 1 ? 0 : step === 3 ? 1 : -1, dy = lift >= 0 ? -1 : 0;
    if (y >= 14) return hex(y === 15 && x % 4 === 1 ? '#D6ECFA' : '#F4FAFF');
    const sy = y - 1 - dy, sx = x - dx;
    const ch = sy >= 0 && sy < 12 && sx >= 0 && sx < 10 ? PENGUIN[sy][sx] : '.';
    if (ch !== '.') return hex({ k: '#1E1E26', e: '#FFFFFF', o: '#F29A2E', W: '#F7F7F2' }[ch]);
    // the feet, each under its side of the body (s 0 the left): the lifted one a row up, the other on the snow
    for (let s = 0; s < 2; s++) {
      const fx = (s ? 6 : 2) + dx, top = lift === s || dy ? 12 : 13, bot = lift === s ? 12 : 13;
      if ((x === fx || x === fx + 1) && y >= top && y <= bot) return hex('#F29A2E');
    }
    for (let k = 0; k < 7; k++) { const fy = (k * 7 + f) % 16, fx = ((k * 3 + 1) % 10 + (((fy >> 2) + k) & 1)) % 10; if (x === fx && y === fy) return hex('#FFFFFF'); }
    return hex(y < 7 ? '#BFE6FF' : '#C8EAFF');
  };
  // the launch gift (the first announcement's, 2026-11-02): a golden apple on deep crimson in a gold frame - a light
  // runs round the frame, a sheen sweeps across the apple, the glow behind it breathes, gold sparks twinkle
  ANIM.goldapple = (u, v, t) => {
    const [x, y] = px(u, v);
    if (x === 0 || x === 9 || y === 0 || y === 15) {
      // (where round the frame, clockwise from the top left: 0-48)
      const p = y === 0 ? x : x === 9 ? 9 + y : y === 15 ? 33 - x : 48 - y, d = ((p - t * 48) % 48 + 48) % 48;
      return d < 2 || d > 46 ? hex('#FFF6C8') : d < 4 || d > 44 ? hex('#FFD860') : hex('#C8901E');
    }
    const ax = x - 1, ay = y - 3, ch = ay >= 0 && ay < GOLDAPPLE.length && ax >= 0 && ax < 8 ? GOLDAPPLE[ay][ax] : '.';
    if (ch !== '.') {
      let c = hex({ b: '#6B3E12', g: '#4FB83A', G: '#2E7F28', W: '#FFFDF0', Y: '#FFE98A', y: '#F5C431', o: '#C98A12' }[ch]);
      const sh = Math.abs(x + y - (t * 30 - 4)); // (the sheen: a band across, once a loop)
      if ('WYyo'.includes(ch) && sh < 1.5) c = mix(c, [255, 255, 240], sh < 0.5 ? 0.7 : 0.35);
      return c;
    }
    const r = Math.hypot(x - 4.5, (y - 7) * 0.9), glow = Math.max(0, 1 - r / 5.5) * (0.35 + 0.25 * Math.sin(t * TAU));
    let c = mix(mix(hex('#6E1426'), hex('#3A0814'), y / 15), hex('#E07A28'), glow);
    if (y === 13) c = mix(c, hex('#C8901E'), x % 2 ? 0.5 : 0.25); // (a gold hem)
    const s = rndc(x, y, 21); if (s > 0.86) c = mix(c, hex('#FFE27A'), Math.max(0, Math.sin(t * TAU * 2 + s * 60)) * 0.9);
    return c;
  };
  // ---- the elytra: every design has wings of its own, outline and picture, not the cape stretched over them ----
  // On one wing's 10 x 20 face: i across from the spine (0) to the outer edge (9), j down from the shoulder (0) to the
  // bottom (19). top / bot: where each column starts and ends (the rest is cut away, like vanilla's elytra); color:
  // the pixel at i, j (t: 0-1 through an animated design's loop; rim: on the outline). bot may depend on t (lava drips).
  const MOON = new Set([[6, 2], [7, 2], [5, 3], [6, 3], [5, 4], [5, 5], [6, 5], [6, 6], [7, 6]].map(([i, j]) => i * 100 + j)); // a crescent
  const rnd2 = (i, j, s) => { const h = Math.sin(i * 12.9898 + j * 78.233 + s) * 43758.5453; return h - Math.floor(h); };
  const WINGS = {
    // a potato leaf: rounded, a gold rim, the midrib running out and down, a little potato at the shoulder
    potato: {
      top: [2, 1, 1, 0, 0, 0, 0, 0, 1, 2], bot: [19, 19, 19, 18, 17, 16, 15, 13, 11, 8],
      color(i, j, t, rim) {
        if (rim) return hex('#E8B830');
        const pot = Math.hypot((i - 2.5) / 1.6, (j - 6) / 2.4);
        if (pot < 1) return hex(i === 2 && j === 6 ? '#6E4522' : i + j < 7 ? '#E8BB80' : i >= 3 && j >= 7 ? '#A06A33' : '#C8914F');
        const mid = Math.round(4 + i * 1.4);
        if (j === mid || (i > 3 && i < 8 && j === mid + 3 - (i % 2))) return hex(j === mid ? '#7BC24F' : '#5E9E45');
        return hex((i + j) % 2 ? '#3F7A3A' : '#356B32');
      },
    },
    // cherry blossom: a scalloped hem like petals, a branch along the shoulder with flowers
    sakura: {
      top: [3, 2, 1, 1, 0, 0, 0, 0, 0, 1], bot: [19, 18, 19, 18, 17, 15, 16, 14, 12, 13],
      color(i, j, t, rim) {
        const FL = [[3, 6], [7, 5], [5, 10], [2, 13], [7, 12], [4, 16]];
        for (const [a, b] of FL) { const d = Math.abs(i - a) + Math.abs(j - b); if (d === 0) return hex('#E86A9A'); if (d === 1) return hex('#FFFFFF'); }
        if (j === 2 + Math.round(i * 0.45) || (i > 2 && i < 6 && j === 5 + Math.round((i - 3) * 0.8))) return hex(i % 3 ? '#6A4434' : '#4A2E24');
        if (rim) return hex('#E86A9A');
        return mix(hex('#FCE4EE'), hex('#F3B4CC'), j / 19);
      },
    },
    // the night sky: feathers ending in points, a crescent moon, stars getting brighter towards the hem
    starry: {
      top: [3, 2, 1, 0, 0, 0, 0, 0, 0, 0], bot: [19, 17, 19, 16, 18, 15, 16, 12, 13, 9],
      color(i, j, t, rim) {
        if (MOON.has(i * 100 + j)) return hex('#F5F1C8');
        if (rim) return hex('#5468B8');
        const s = rnd2(i, j, 3);
        if (s > 0.93) return hex(s > 0.97 ? '#FFE58A' : '#FFFFFF');
        return mix(hex('#0B1636'), hex('#2B3A7A'), Math.min(1, j / 16));
      },
    },
    // the sea: light at the shoulder, deep at the hem, wave lines, the hem a run of breaking crests
    ocean: {
      top: [3, 2, 1, 1, 0, 0, 0, 0, 0, 1], bot: [19, 19, 18, 18, 19, 17, 16, 16, 14, 12],
      color(i, j, t, rim) {
        const bot = this.bot[i];
        if (rim && j >= bot - 1) return hex('#EEF9FF');
        if (rim) return hex('#0B3462');
        if ((j + Math.round(1.4 * Math.sin(i * 0.9))) % 6 === 3) return hex('#EEF9FF');
        const f = j / 19;
        return f < 0.45 ? mix(hex('#8FDBF5'), hex('#2C7CC4'), f / 0.45) : mix(hex('#2C7CC4'), hex('#114780'), (f - 0.45) / 0.55);
      },
    },
    // the sunset by the sea: the sun out at the wing's edge, its light glittering on the water, waves on the sand
    sunset: {
      top: [3, 2, 1, 1, 0, 0, 0, 0, 0, 1], bot: [19, 19, 19, 18, 18, 17, 16, 15, 13, 11],
      color(i, j, t, rim) {
        const bot = this.bot[i];
        if (j < 9) {
          const r = Math.hypot(i - 6.5, (j - 5.5) * 1.1);
          if (r < 2.3) return hex(r < 1.3 ? '#FFF6C8' : '#FFE27A');
          const c = mix(hex('#FF7A59'), hex('#FFD27A'), j / 8);
          return rim ? mix(c, hex('#E0503A'), 0.5) : j < 3 && rnd2(i, j, 2) > 0.85 ? mix(c, hex('#FFB8A0'), 0.6) : c;
        }
        const foam = bot - 2 + Math.round(0.8 * Math.sin(t * TAU + i * 0.6));
        if (j === foam) return hex('#F5FBFF');
        if (j > foam) return hex(j === bot ? '#E8C77E' : '#F2D79B');
        if (Math.abs(i - 6.5) < 1.8 - (j - 9) * 0.12 && rnd2(i, j, Math.floor(t * 16)) > 0.45) return hex('#FFD27A');
        return hex(j === 9 ? '#4AA3E0' : j < 12 ? '#2B7FD1' : '#1F64B0');
      },
    },
    // lava: a dark crust at the shoulder with glowing cracks, molten below, drips running off the hem
    lava: {
      top: [2, 1, 1, 0, 0, 0, 0, 0, 1, 2], hem: [17, 17, 16, 16, 15, 15, 14, 13, 12, 10],
      bot(i, t) { return this.hem[i] + (i % 3 === 1 ? Math.round(2.5 * (0.5 + 0.5 * Math.sin(t * TAU + i * 1.7))) : 0); },
      color(i, j, t, rim) {
        if (j > this.hem[i]) return hex(j === this.bot(i, t) ? '#FFE27A' : '#FF9A2A');
        if (j <= this.top[i] + 1) return hex(rnd2(i, j, 5) > 0.7 ? '#FF6A1A' : '#2E0A04');
        const c = ANIM.lava(i / 9, j / 19, t);
        return rim ? mix(c, hex('#2E0A04'), 0.5) : c;
      },
    },
    // a nebula: wisps at the edges, glowing clouds, twinkling stars
    nebula: {
      top: [3, 2, 1, 0, 0, 0, 0, 0, 1, 2], bot: [19, 18, 19, 17, 18, 16, 17, 14, 15, 11],
      color(i, j, t, rim) {
        const c = ANIM.nebula(i / 9, j / 19, t);
        return rim ? mix(c, hex('#F08AD8'), 0.45) : c;
      },
    },
    // the penguins': a flipper's outline (black, rounded at the tip), the pale winter sky inside with snowflakes, a
    // snowbank along the hem; the animated one's snow falls (a row a frame, 16 rows a loop)
    penguin: {
      top: [3, 2, 1, 1, 0, 0, 0, 0, 1, 2], bot: [19, 19, 19, 18, 18, 17, 16, 15, 13, 10],
      color(i, j, t, rim) {
        if (rim) return hex('#1E1E26');
        const bot = this.bot[i];
        if (j >= bot - 2) return hex(j === bot - 2 && i % 3 === 1 ? '#D6ECFA' : '#F4FAFF');
        if (rnd2(i, this.fall ? ((j - Math.floor(t * 16)) % 16 + 16) % 16 : j, 13) > 0.9) return hex('#FFFFFF');
        return mix(hex('#BFE6FF'), hex('#A8D8F5'), j / 19);
      },
    },
  };
  WINGS.penguinwalk = { ...WINGS.penguin, fall: true };
  // the golden apple's: crimson feathers with a gold rim a light runs along, gold feather lines, sparks
  WINGS.goldapple = {
    top: [2, 1, 0, 0, 0, 0, 0, 0, 1, 2], bot: [19, 19, 19, 18, 18, 17, 16, 15, 13, 10],
    color(i, j, t, rim) {
      if (rim) { const d = Math.abs(i + j - t * 30); return d < 1.5 ? hex('#FFF6C8') : d < 3 ? hex('#FFD860') : hex('#C8901E'); }
      let c = mix(hex('#6E1426'), hex('#3A0814'), j / 19);
      if (j > 4 && (j - Math.round(i * 0.8)) % 4 === 0) c = mix(c, hex('#C8901E'), 0.55);
      const s = rnd2(i, j, 21); if (s > 0.88) c = mix(c, hex('#FFE27A'), Math.max(0, Math.sin(t * TAU * 2 + s * 60)) * 0.9);
      return c;
    },
  };
  // the crowns' wings: long feathers ending in points, the rim lit by a light running from the shoulder out to the
  // tips, feather lines in the weave's colour, the crown at the shoulder and a jewel at the tip that glints (the wings
  // also glow, are drawn larger, and leave a trail of sparks - drawWings, wingFx)
  for (const id in CROWNS) {
    const P = CROWNS[id][1];
    WINGS[id] = {
      top: [2, 1, 0, 0, 0, 0, 0, 0, 1, 2], bot: [19, 19, 19, 18, 19, 17, 18, 16, 17, 13],
      color(i, j, t, rim) {
        if (rim) { const d = Math.abs(i + j - t * 30); return d < 1.5 ? hex(P.rimL) : d < 3 ? mix(hex(P.rim), hex(P.rimL), 0.5) : hex(P.rim); }
        const cr = j >= 3 && j <= 6 && i >= 2 && i <= 7 ? CROWN[j - 3][i - 2] : '.';
        if (cr === 'R' || cr === 'B') return hex(cr === 'R' ? P.j1 : P.j2);
        if (cr === '#') return hex(j === 3 ? P.crL : P.cr);
        if (i === 8 && j === 15) return mix(hex(P.j1), [255, 255, 255], Math.max(0, Math.sin(t * TAU * 2)) * 0.6); // (the jewel at the tip)
        let c = mix(hex(P.bg1), hex(P.bg2), j / 19);
        if (j > 7 && (j - Math.round(i * 0.8)) % 4 === 0) c = mix(c, hex(P.weave), 0.7); // (feather lines)
        const s = rnd2(i, j, 11);
        if (s > 0.92) c = mix(c, hex(P.spark), Math.max(0, Math.sin(t * TAU * 3 + s * 60)) * 0.9);
        return c;
      },
    };
  }
  // the other administrators' designs: long pointed feathers (the wings are drawn larger too - drawWings), the picture
  // from the cape's own design, each its own rim
  const ADM_RIM = { admender: '#B040E0', admaurora: '#4AE0FF', admriver: '#E8B830', admgold: '#FFE27A', admvoid: '#6A5AE0' };
  for (const id in ADM_RIM) WINGS[id] = {
    top: [2, 1, 0, 0, 0, 0, 0, 0, 1, 3], bot: [19, 19, 19, 18, 19, 17, 18, 15, 16, 12],
    color(i, j, t, rim) { const c = ANIM[id](i / 9, Math.min(1, j / 19), t); return rim ? mix(c, hex(ADM_RIM[id]), 0.7) : c; },
  };
  // a wing as a 10 x 20 grid of colours (null: cut away) for loop time t
  function wingGrid(w, t) {
    const bot = (i) => (typeof w.bot === 'function' ? w.bot(i, t) : w.bot[i]);
    const inside = (i, j) => i >= 0 && i < 10 && j >= w.top[i] && j <= bot(i) && j < 20;
    const g = [];
    for (let j = 0; j < 20; j++) for (let i = 0; i < 10; i++) {
      if (!inside(i, j)) { g.push(null); continue; }
      const rim = !inside(i - 1, j) || !inside(i + 1, j) || !inside(i, j - 1) || !inside(i, j + 1);
      g.push(w.color(i, j, t, rim));
    }
    return g;
  }
  const LIST = [
    { id: 'potato', name: '土豆', anim: false }, { id: 'sakura', name: '樱花', anim: false }, { id: 'starry', name: '星空', anim: false }, { id: 'ocean', name: '海浪', anim: false },
    { id: 'sunset', name: '海边日落', anim: true }, { id: 'lava', name: '熔岩', anim: true }, { id: 'nebula', name: '星云', anim: true },
    // (the administrators' designs: free like every other one since phase-02)
    ...Object.entries(CROWNS).map(([id, [cn]]) => ({ id, name: '王冠·' + cn, anim: true, admin: true })),
    { id: 'admender', name: '管理员·末影', anim: true, admin: true }, { id: 'admaurora', name: '管理员·极光', anim: true, admin: true },
    { id: 'admriver', name: '管理员·红河', anim: true, admin: true }, { id: 'admgold', name: '管理员·流金', anim: true, admin: true },
    { id: 'admvoid', name: '管理员·虚空', anim: true, admin: true },
    // the sign-in event's rewards (ev: also in cosmetics.js; free to wear since phase-02)
    { id: 'penguin', name: '企鹅', anim: false, ev: true }, { id: 'penguinwalk', name: '摇摆企鹅', anim: true, ev: true },
    // (an event reward given by the service: community.js)
    { id: 'goldapple', name: '金苹果', anim: true, ev: true },
  ];
  // the colours an administrator's wings throw off as sparks (wingFx): the crowns' sparks, border light and jewels
  const fx = (id) => { const c = CROWNS[id]; if (c) { const P = c[1]; return [P.spark, P.rimL, P.j1, P.j2].map(hex); } const r = ADM_RIM[id]; return r ? [hex(r), [255, 255, 255]] : null; };
  const FRAMES = 16, FPS = 8;
  // the texture of one design (one frame): colour at (u, v) painted over the cape's and the elytra's faces
  // inset: the edges (the cape's 1-pixel thickness, the elytra's sides) take the colour a pixel in from the border -
  // an animated design's outer row can be its darkest and read as a black strip along the top
  function paint(colorAt, inset, wing, t) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32;
    const x = cv.getContext('2d'), id = x.createImageData(64, 32), d = id.data;
    const put = (px, py, c, dim = 1) => { const i = (py * 64 + px) * 4; d[i] = c[0] * dim; d[i + 1] = c[1] * dim; d[i + 2] = c[2] * dim; d[i + 3] = 255; };
    const rect = (x0, y0, w, h, f) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) f(x0 + i, y0 + j, (i + 0.5) / w, (j + 0.5) / h); };
    const e0 = inset ? 0.15 : 0, e1 = 1 - e0, rim = (u, v) => colorAt(Math.min(e1, Math.max(e0, u)), Math.min(e1, Math.max(e0, v)));
    const edge = rim(0.5, 0.97);
    rect(1, 1, 10, 16, (px, py, u, v) => put(px, py, colorAt(u, v)));                 // outside
    rect(12, 1, 10, 16, (px, py, u, v) => put(px, py, colorAt(1 - u, v), 0.62));       // inside (against the back)
    rect(0, 1, 1, 16, (px, py, u, v) => put(px, py, rim(0, v), 0.8)); rect(11, 1, 1, 16, (px, py, u, v) => put(px, py, rim(1, v), 0.8));
    rect(1, 0, 10, 1, (px, py, u) => put(px, py, rim(u, 0), 0.9)); rect(11, 0, 10, 1, (px, py, u) => put(px, py, edge, 0.8));
    // the elytra (vanilla's box 10 x 20 x 2 at 22, 0; the left wing, the right one mirrored): this design's own wing.
    // The outside (seen from behind) is the face at 36 (u 36 the outer edge, 45 the spine), the inside the face at 24
    // (the other way round, darker); the sides, top and bottom only where the outline reaches them
    const W = wingGrid(wing, t), at = (i, j) => W[j * 10 + i];
    for (let j = 0; j < 20; j++) for (let i = 0; i < 10; i++) {
      const c = at(i, j); if (!c) continue;
      put(45 - i, 2 + j, c); put(24 + i, 2 + j, c, 0.7);
      if (i === 0) { put(22, 2 + j, c, 0.8); put(23, 2 + j, c, 0.8); }
      if (i === 9) { put(34, 2 + j, c, 0.8); put(35, 2 + j, c, 0.8); }
    }
    for (let i = 0; i < 10; i++) {
      if (at(i, 0)) { put(24 + i, 0, at(i, 0), 0.9); put(24 + i, 1, at(i, 0), 0.9); }
      if (at(i, 19)) { put(34 + i, 0, at(i, 19), 0.8); put(34 + i, 1, at(i, 19), 0.8); }
    }
    x.putImageData(id, 0, 0);
    return cv;
  }
  const artAt = (a) => (u, v) => { const r = a.rows[Math.min(15, Math.floor(v * 16))], ch = r[Math.min(9, Math.floor(u * 10))]; return hex(a.pal[ch] || '#FF00FF'); };
  const made = new Map(); // id -> { frames: [canvas], tex, shown }
  // (a design replaced by another: whoever wore it wears the new one)
  const ALIAS = { aurora: 'sunset' }, norm = (id) => ALIAS[id] || id;
  function get(id) {
    id = norm(id);
    let c = made.get(id);
    if (c) return c;
    if (ART[id]) c = { frames: [paint(artAt(ART[id]), false, WINGS[id], 0)] };
    else if (ANIM[id]) c = { frames: Array.from({ length: FRAMES }, (_, f) => paint((u, v) => ANIM[id](u, v, f / FRAMES), true, WINGS[id], f / FRAMES)) };
    else return null;
    made.set(id, c);
    return c;
  }
  const frameNow = (c) => (c.frames.length > 1 ? Math.floor(performance.now() / 1000 * FPS) % c.frames.length : 0);
  // the renderer's texture key of a cape, its current frame uploaded
  function texKey(r, id) {
    id = norm(id); const c = get(id); if (!c) return null;
    const key = 'cape_' + id, gl = r.gl, f = frameNow(c);
    if (!r.entityTex[key]) { r.entityTex[key] = r.tex2D(c.frames[f], false); c.shown = f; }
    else if (c.shown !== f) { gl.bindTexture(gl.TEXTURE_2D, r.entityTex[key]); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, c.frames[f]); c.shown = f; }
    return key;
  }
  // the model: an empty part that follows the body, and the cape (vanilla PlayerCapeModel: the box turned around)
  function initModel(r) {
    if (r.models.cape) return;
    const parts = [
      { name: 'body', pivot: [0, 12, 0], boxes: [] },
      { name: 'cape', parent: 'body', pivot: [0, 12, 2], boxes: [[0, 0, -5, -16, -1, 10, 16, 1]], rotY: Math.PI },
    ];
    for (const p of parts) p.mesh = r.makeModelPart(p.boxes, 64, 32);
    r.models.cape = { parts };
  }
  // a design's wings: vanilla's elytra boxes (the same texture layout, equip.js eq_elytra) pressed to one pixel thick,
  // half a pixel off the back. Vanilla's are four thick (2, inflated 1 each way) - with a design's own outline they
  // read as slabs
  function initWings(r) {
    if (r.models.cape_wings) return;
    const thin = (data) => { for (let k = 2; k < data.length; k += 8) data[k] = (1 + (data[k] * 16 - 1) * 0.25) / 16; };
    const parts = [
      { name: 'lw', pivot: [-5, 24, 2], boxes: [[22, 0, 0, -20, 0, 10, 20, 2, 1]] },
      { name: 'rw', pivot: [5, 24, 2], boxes: [[22, 0, -10, -20, 0, 10, 20, 2, 1, true]] },
    ];
    for (const p of parts) p.mesh = r.makeModelPart(p.boxes, 64, 32, thin);
    r.models.cape_wings = { parts };
  }
  // the swing (vanilla CapeLayer / Player cloak): a point trailing the player, eased per frame (0.25 a tick). It
  // trails where the model is drawn (ip, between two ticks) and turns with the drawn body: the tick position jumps
  // 20 times a second, and trailing that made the cape twitch on every tick while moving
  function swing(g, e, a, sneaking, ip) {
    const now = performance.now(), p = ip || e.pos;
    if (!e.cloak || now - (e.cloakT || 0) > 1000) { e.cloak = [p[0], p[1], p[2]]; e.cloakT = now; }
    const dt = Math.min(0.25, (now - e.cloakT) / 1000); e.cloakT = now;
    const k = 1 - Math.pow(0.75, dt * 20);
    for (let i = 0; i < 3; i++) { if (Math.abs(p[i] - e.cloak[i]) > 10) e.cloak[i] = p[i]; e.cloak[i] += (p[i] - e.cloak[i]) * k; }
    let by = e.bodyYaw ?? e.yaw ?? 0;
    if (e === g.player && g.playerBodyYaw) by = g.playerBodyYaw(a);
    else if (e.prevBodyYaw !== undefined) { let d = by - e.prevBodyYaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; by = e.prevBodyYaw + d * a; }
    const dx = e.cloak[0] - p[0], dy = e.cloak[1] - p[1], dz = e.cloak[2] - p[2];
    // behind the body (this game's yaw 0 faces -z): how far back and to the side the trailing point is
    const back = dx * Math.sin(by) + dz * Math.cos(by), side = dx * Math.cos(by) - dz * Math.sin(by);
    let up = clamp(dy * 10, -6, 32);
    const f2 = clamp(back * 100, 0, 150), f3 = clamp(side * 100, -20, 20);
    // the sway while walking: vanilla sin(walkDist * 6) * 32 * bob, walkDist 0.6 a block walked and bob the eased
    // ground speed (at most 0.1). This player keeps both (the view bobbing's bob / bobAmt); another player only its
    // legs' swing, which goes on 4 a block (walkDist about 0.15 of it, bob about a quarter of the swing speed)
    let walk, bob;
    if (e.bobAmt !== undefined) { walk = lerp(e.prevBob || 0, e.bob || 0, a) * 0.6; bob = lerp(e.prevBobAmt || 0, e.bobAmt, a); }
    else { walk = ((e.limbSwing || 0) - (e.limbAmt || 0) * (1 - a)) * 0.15; bob = e.flying ? 0 : Math.min(0.1, (e.limbAmt || 0) / 4); }
    up += Math.sin(walk * 6) * 32 * bob;
    if (sneaking) up += 25;
    const D = Math.PI / 180;
    return { rx: -(6 + f2 / 2 + up) * D, rz: (f3 / 2) * D, ry: (-f3 / 2) * D };
  }
  // which cape a player wears: this player's from the device, another player's from what the room sent
  function of(g, e) {
    let id = null;
    if (e === g.player) {
      const pv = typeof Skins !== 'undefined' && Skins.preview();
      const s = pv || (typeof Skins !== 'undefined' && Skins.look ? Skins.look() : null);
      id = s && s.cape; if (id && !info(id)) id = null;
    }
    else if (e.look) id = e.look.cape;
    return id && get(id) ? norm(id) : null;
  }
  const info = (id) => LIST.find((c) => c.id === norm(id));
  // (phase-02: no cape is locked - the administrators' and the sign-in event's are free too; only a known id is accepted)
  const unlocked = (id) => !!info(id);
  // the display setting (选项 → 皮肤与装饰, cosmetics.js): whose capes are drawn. The wardrobe's and the inventory's
  // previews always show this player's
  const shown = (g, e, opts) => typeof Cosmetics === 'undefined' || Cosmetics.shown(g, e, opts);
  // drawn with the player model (game.js drawMob, the inventory preview): m is the model matrix, poses the player's.
  // The decorations worn on the model (a hat; a pet in the wardrobe's preview) come with it
  function draw(g, e, m, poses, lt, env, opts) {
    if (shown(g, e, opts)) drawCape(g, e, m, poses, lt, env, opts);
    if (typeof Cosmetics !== 'undefined') Cosmetics.drawOn(g, e, m, poses, lt, env, opts);
  }
  function drawCape(g, e, m, poses, lt, env, opts) {
    const id = of(g, e); if (!id) return;
    const r = g.renderer; initModel(r);
    const key = texKey(r, id); if (!key) return;
    const chest = e.inv ? e.inv.slots[38 - 1] : (e.armorItems || [])[1];
    const elytra = chest && keyOfStack(chest) === 'elytra';
    if (elytra) return; // (the design is on the wings instead)
    const s = opts && opts.still ? { rx: -6 * Math.PI / 180, rz: 0, ry: 0 } : swing(g, e, opts && opts.a != null ? opts.a : (g.frameA || 1), e.sneaking && !e.flying, opts && opts.ip);
    const armoured = !!(chest && ITEMS[chest.id].armor && ITEMS[chest.id].armor.mat !== 'elytra');
    const P = { body: poses && poses.body ? poses.body : undefined, cape: { rx: s.rx, rz: s.rz, ry: s.ry, t: armoured ? [0, 0, 1 / 16] : undefined } };
    const gl = r.gl, cull = gl.isEnabled(gl.CULL_FACE);
    gl.disable(gl.CULL_FACE);
    r.drawModel('cape', key, m, P, lt, env, opts || {});
    if (cull) gl.enable(gl.CULL_FACE);
  }
  // a cape flat on a menu: its outside, s screen pixels a texel, greyed when locked
  function drawFlat(c, id, x, y, s, locked) {
    const cp = get(id); if (!cp) return;
    const f = frameNow(cp);
    c.drawImage(cp.frames[f], 1, 1, 10, 16, x, y, 10 * s, 16 * s);
    if (locked) { c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x, y, 10 * s, 16 * s); }
  }
  return { list: LIST, get, texKey, draw, drawFlat, of, info, unlocked, shown, initModel, initWings, fx };
})();

// the player models draw their capes; an elytra worn by a caped player shows the cape (vanilla WingsLayer)
(() => {
  const dm = Game.prototype.drawMob;
  Game.prototype.drawMob = function (e, ip, a, env, l) {
    dm.call(this, e, ip, a, env, l);
    if ((e === this.player || e.type === 'player') && !e.dead && !(e.invisible || (e.hasEffect && e.hasEffect('invisibility'))) && this.lastPlayerModel) {
      try { Capes.draw(this, e, this.lastPlayerModel.m, this.lastPlayerModel.poses, this.lastPlayerModel.lt, env, { ip, a }); } catch (err) { this.reportError('cape', err, true); }
    }
    this.lastPlayerModel = null;
  };
  // (drawMob keeps the matrix and poses of the player model it drew: game.js)
  const dw = Game.prototype.drawWings;
  if (dw) Game.prototype.drawWings = function (e, m, lt, env, overlay, vp) {
    // (a design hidden by the display setting: vanilla's elytra; the previews pass vp and always show it)
    const id = Capes.shown(this, e, vp ? { inv: true } : null) ? Capes.of(this, e) : null, r = this.renderer;
    if (!id) return dw.call(this, e, m, lt, env, overlay, vp);
    // the design's texture on its own thin wings (the vanilla ones stay for an elytra without a cape)
    const k = Capes.texKey(r, id), bt = r.beTex;
    r.initEquipModels(); Capes.initWings(r);
    const em = r.models.eq_elytra;
    // (an administrator's: 1.3 times as large, grown out from the shoulders, and glowing - lit in the dark too)
    const adm = !!(Capes.info(id) && Capes.info(id).admin), rdm = r.drawModel;
    if (adm) {
      m = new Float32Array(m); M4.translate(m, 0, 1.5, 0.125); M4.scale(m, 1.3, 1.3, 1.3); M4.translate(m, 0, -1.5, -0.125);
      r.drawModel = function (n, t, mm, ps, l2, e2, o) { return rdm.call(this, n, t, mm, ps, l2, e2, { ...(o || {}), bright: true }); };
    }
    r.beTex = (n) => (n === 'elytra_wings' ? k : bt.call(r, n)); r.models.eq_elytra = r.models.cape_wings;
    try { dw.call(this, e, m, lt, env, overlay, vp); } finally { r.beTex = bt; r.models.eq_elytra = em; r.drawModel = rdm; }
  };
  // an administrator's elytra throws off sparks in its design's colours: a trail from both wing tips while gliding,
  // thicker with bursts in the jewels' colours under a rocket's boost, now and then one while standing (anyone wearing
  // one: this player, and others in a room)
  // (white particles, coloured: the critical-hit star, floating instead of falling; the potion swirl)
  const spark = (g, type, x, y, z, vx, vy, vz, col) => { const L = g.particles.list, n = L.length; g.particles.spawn(type, x, y, z, vx, vy, vz, { col }); if (L.length > n) { const q = L[L.length - 1]; q.col = col; q.bright = true; if (type === 'crit') { q.grav = 0; q.life = 14 + Math.random() * 8; } } };
  function wingFx(g, e, cols) {
    const by = e.bodyYaw ?? e.yaw ?? 0, bk = [Math.sin(by), Math.cos(by)], sd = [Math.cos(by), -Math.sin(by)], R = Math.random;
    const v = e === g.player ? e.vel : e.netVel || [0, 0, 0], pick = () => cols[(R() * cols.length) | 0];
    if (e.gliding) {
      const boost = e === g.player ? e.boostT > 0 : Math.hypot(v[0], v[1], v[2]) > 1.2;
      for (const s of [-1, 1]) {
        // (the tips of the spread wings: out to the sides and a little up and back; somewhere along the outer edge)
        const f = 0.8 + R() * 0.2, x = e.pos[0] + sd[0] * s * 1.75 * f + bk[0] * 0.5, y = e.pos[1] + 0.75 * f, z = e.pos[2] + sd[1] * s * 1.75 * f + bk[1] * 0.5;
        spark(g, 'crit', x, y, z, -v[0] * 0.15 + (R() - 0.5) * 0.02, -v[1] * 0.15 + (R() - 0.5) * 0.02, -v[2] * 0.15 + (R() - 0.5) * 0.02, pick());
        if (boost) for (let k = 0; k < 2; k++) spark(g, 'effect', x, y, z, (R() - 0.5) * 0.2, (R() - 0.5) * 0.2, (R() - 0.5) * 0.2, cols[2 + ((R() * (cols.length - 2)) | 0)] || pick());
      }
    } else if (g.tickCount % 7 === 0) {
      const s = R() < 0.5 ? -1 : 1, up = 0.6 + R() * 0.8;
      spark(g, 'crit', e.pos[0] + sd[0] * s * 0.45 + bk[0] * 0.35, e.pos[1] + up, e.pos[2] + sd[1] * s * 0.45 + bk[1] * 0.35, 0, 0.01, 0, pick());
    }
  }
  const tk = Game.prototype.tick;
  Game.prototype.tick = function () {
    const r = tk.apply(this, arguments);
    if (this.state !== 'play' || !this.world || (this.ui.screen && this.ui.screen.pauses && !this.net)) return r;
    for (const e of [this.player, ...this.entities]) {
      if (!e || e.dead || (e !== this.player && e.type !== 'player')) continue;
      const id = Capes.shown(this, e) && Capes.of(this, e), cols = id && Capes.info(id) && Capes.info(id).admin && Capes.fx(id);
      if (!cols) continue;
      if (keyOfStack(e.inv ? e.inv.slots[37] : (e.armorItems || [])[1]) !== 'elytra') continue;
      wingFx(this, e, cols);
    }
    return r;
  };
})();
