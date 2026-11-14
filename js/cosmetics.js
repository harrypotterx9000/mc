'use strict';
// 装饰：帽子、宠物、名字前缀图标，以及穿戴和显示设置（game/COMMUNITY_PLAN.md）
// ---------------------------------------------------------------------------
// Decorations (game/COMMUNITY_PLAN.md「三、装饰」), the sign-in event's rewards: hats worn on the head (a few small
// boxes like vanilla's head decorations, hidden under a helmet or a pumpkin), a pet that follows its owner (only
// drawn: no entity, no collision, nothing for the server to carry), a name prefix (an icon before the name) and the
// two penguin capes (capes.js). All original pixel art painted here, except the prefix: vanilla's potato item.
// Ids are 'kind:name' ('hat:straw'); a look carries the name alone ({ hat: 'straw', pet, pre }, beside skin and
// cape). Every decoration is free to wear since phase-02 (no account ownership check). Whose are drawn:
// settings.cosShow (选项 → 皮肤与装饰).
// ---------------------------------------------------------------------------
const Cosmetics = (() => {
  const LIST = [
    { id: 'hat:straw', kind: 'hat', name: '草帽' },
    { id: 'hat:tophat', kind: 'hat', name: '礼帽' },
    { id: 'hat:crown', kind: 'hat', name: '皇冠' },
    { id: 'pet:snowman', kind: 'pet', name: '小雪人' },
    { id: 'pre:potato', kind: 'pre', name: '土豆前缀' },
    { id: 'cape:penguin', kind: 'cape', name: '企鹅披风' },
    { id: 'cape:penguinwalk', kind: 'cape', name: '企鹅披风（动态）' },
    { id: 'cape:goldapple', kind: 'cape', name: '金苹果披风' },
  ];
  const KIND = { hat: '帽子', pet: '宠物', pre: '名字前缀', cape: '披风' };
  const info = (id) => LIST.find((d) => d.id === id) || null;
  const name = (id) => { const d = info(id); return d ? d.name : ''; }; // ('' for one this game doesn't know yet)
  const owned = () => LIST.map((d) => d.id);
  const has = (id) => !!info(id);

  // ---- the display setting: 'all' (the default), 'mine' (others' hidden), 'none' (this player's too) ----
  // The previews (the wardrobe's, the inventory's: opts.inv) always show this player's. With the graphics on 流畅 and
  // the setting never chosen, others' pets are left out (COMMUNITY_PLAN.md: weak devices)
  const mode = (g) => (g && g.settings && g.settings.cosShow) || 'all';
  function shown(g, e, opts) {
    if (opts && opts.inv) return true;
    const m = mode(g);
    return m === 'all' || (m === 'mine' && !!g && e === g.player);
  }
  const othersPets = (g) => mode(g) === 'all' && !(g.settings.cosShow === undefined && g.settings.graphics === 'fast');

  // ---- what a player wears ----
  // this player: the wardrobe's preview while choosing, else the look kept on this device; another player: what the
  // room said (skins.js keeps e.look). No ownership filter (phase-02), no account (phase-03)
  function lookOf(g, e) {
    if (g && e === g.player) {
      const s = (typeof Skins !== 'undefined' && (Skins.preview() || (Skins.look && Skins.look()))) || null;
      return s ? { hat: s.hat || null, pet: s.pet || null, pre: s.pre || null } : null;
    }
    return (e && e.look) || (g && g.net && g.net.looks && e && e.name && g.net.looks.get(e.name)) || null;
  }
  // (own keys only: a look from a P2P peer is unchecked, and 'constructor' would find Object.prototype's)
  const hasKey = (T, v) => !!v && Object.prototype.hasOwnProperty.call(T, v);
  const worn = (g, e, kind) => { const l = lookOf(g, e), v = l && l[kind]; return hasKey(kind === 'hat' ? HATS : kind === 'pet' ? PETS : PRES, v) ? v : null; };
  // what this player wears, for the others in a room (skins.js Skins.mine)
  function mine(g) { const l = (g && g.player && lookOf(g, g.player)) || {}; return { hat: l.hat || null, pet: l.pet || null, pre: l.pre || null }; }

  // ---- models: boxes with a texture of their own, painted here ----
  // parts [{ name, pivot, parent, boxes: [[x, y, z, w, h, d, inflate, paint]] }] (model pixels, y up, the front -z).
  // Each box's faces get a place in one texture (packed in rows, vanilla's cube layout) painted by
  // paint(face, i, j, fw, fh) -> '#rrggbb' or null (see-through): i across and j down the face as seen from outside;
  // faces front back left right (the wearer's) top bottom
  function buildModel(r, key, parts) {
    if (r.models[key]) return key;
    const TW = 64, places = [];
    let u = 0, v = 0, rowH = 0;
    for (const p of parts) for (const b of p.boxes) {
      const w = b[3], h = b[4], d = b[5];
      if (u + 2 * (w + d) > TW) { u = 0; v += rowH; rowH = 0; }
      places.push([b, u, v]); u += 2 * (w + d); rowH = Math.max(rowH, d + h);
    }
    const TH = Math.max(16, 1 << Math.ceil(Math.log2(v + rowH)));
    const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
    const cx = cv.getContext('2d'), img = cx.createImageData(TW, TH), D = img.data;
    const put = (x, y, c) => { if (!c) return; const k = (y * TW + x) * 4, n = parseInt(c.slice(1), 16); D[k] = n >> 16; D[k + 1] = (n >> 8) & 255; D[k + 2] = n & 255; D[k + 3] = 255; };
    const face = (b, f, x0, y0, fw, fh) => { for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) put(x0 + i, y0 + j, b[7](f, i, j, fw, fh)); };
    for (const [b, bu, bv] of places) {
      const w = b[3], h = b[4], d = b[5];
      // (render.js boxGeom: +x at u, the front (-z) at u + d, -x at u + d + w, the back after; top and bottom above)
      face(b, 'top', bu + d, bv, w, d); face(b, 'bottom', bu + d + w, bv, w, d);
      face(b, 'right', bu, bv + d, d, h); face(b, 'front', bu + d, bv + d, w, h);
      face(b, 'left', bu + d + w, bv + d, d, h); face(b, 'back', bu + 2 * d + w, bv + d, w, h);
    }
    cx.putImageData(img, 0, 0);
    const uv = new Map(places.map(([b, bu, bv]) => [b, [bu, bv]]));
    const M = { parts: parts.map((p) => ({ name: p.name, pivot: p.pivot, parent: p.parent, boxes: p.boxes.map((b) => [...uv.get(b), b[0], b[1], b[2], b[3], b[4], b[5], b[6] || 0]) })) };
    for (const p of M.parts) p.mesh = r.makeModelPart(p.boxes, TW, TH);
    r.models[key] = M; r.entityTex[key] = r.tex2D(cv, false);
    return key;
  }
  const hash = (i, j, k) => { const h = Math.sin(i * 12.9898 + j * 78.233 + k * 37.719) * 43758.5453; return h - Math.floor(h); };
  const FACE_N = { top: 1, bottom: 2, front: 3, back: 4, left: 5, right: 6 };

  // ---- hats: on the head part (the player model's head pivot 0, 24, 0; the head 8 x 8 x 8 from y 0 to 8, its second
  // layer half a pixel out). Hidden under anything in the head slot ----
  // the straw hat copies X1aoZhe's (his premium skin, read from Mojang 2026-11-02): his straw is a checker of two
  // tones (#ECBF57 / #D8B45E), the top woven in a spiral (SPIRAL is his 8 x 8 hat top), a dark red band (#8A1E1E /
  // #701515) a row up from the brim, and the brim sticking out round the head - here made a real brim and crown
  const SL = '#ECBF57', SD = '#D8B45E';
  const SPIRAL = ['DDDDDDDL', 'DDLLLLLD', 'DLLDDDDD', 'DLDLLLLD', 'DDDDLDLD', 'DDLLLDDD', 'DDDLDLDD', 'DDDDDDLL'];
  const straw = (i, j) => ((i + j) % 2 ? SD : SL);
  const BLACK = '#1C1C22', GOLD = '#F2C94C', GOLD_L = '#FFE27A', GOLD_D = '#C8961E';
  const HATS = {
    straw: [{ name: 'head', pivot: [0, 24, 0], boxes: [
      [-7, 5, -7, 14, 1, 14, 0, (f, i, j) => (f === 'bottom' ? ((i + j) % 2 ? '#B8954A' : '#A8873F') : straw(i, j))],
      [-4, 6, -4, 8, 4, 8, 0.65, (f, i, j) => (f === 'top' ? (SPIRAL[j][i] === 'L' ? SL : SD) : f === 'bottom' ? SD : j === 2 ? ((i * 7 + FACE_N[f]) % 3 ? '#8A1E1E' : '#701515') : straw(i, j))],
    ] }],
    // a black top hat with a dark red band, a sheen down one side, sitting on the head
    tophat: [{ name: 'head', pivot: [0, 24, 0], boxes: [
      [-6, 8.6, -6, 12, 1, 12, 0, (f, i, j, fw) => (f === 'bottom' ? '#141418' : f === 'top' ? (i === 0 || j === 0 || i === fw - 1 || j === fw - 1 ? '#2A2A33' : '#1A1A20') : '#24242C')],
      [-3.5, 9.6, -3.5, 7, 7, 7, 0, (f, i, j) => (f === 'top' ? ((i + j) % 4 ? '#26262E' : '#2E2E38') : f === 'bottom' ? BLACK : j === 5 ? '#9A1A2C' : j === 6 ? '#7A1020' : i === 1 ? '#34343F' : BLACK)],
    ] }],
    // a little gold crown: a band round the top of the head with points on it, jewels set in the band (red in front
    // and behind, blue and green at the sides), lit along its top edge
    crown: [{ name: 'head', pivot: [0, 24, 0], boxes: (() => {
      const band = (front) => (f, i, j, fw) => {
        if (f === 'top') return GOLD_L;
        if (f === 'bottom') return GOLD_D;
        const mid = fw / 2;
        if ((f === 'front' || f === 'back') && front && (i === mid - 1 || i === mid)) return '#E0303A';
        if ((f === 'front' || f === 'back') && front && (i === 1 || i === fw - 2)) return j ? '#3A6AE0' : GOLD_L;
        if ((f === 'left' || f === 'right') && !front && (i === mid - 1 || i === mid)) return '#2FC46A';
        return j === 0 ? GOLD_L : GOLD;
      };
      const pt = (f, i, j, fw, fh) => (f === 'top' ? '#FFF2A0' : j === 0 && fh > 1 ? GOLD_L : GOLD);
      const B = [
        [-5, 7.5, -5, 10, 2, 1, 0, band(true)], [-5, 7.5, 4, 10, 2, 1, 0, band(true)],
        [4, 7.5, -4, 1, 2, 8, 0, band(false)], [-5, 7.5, -4, 1, 2, 8, 0, band(false)],
      ];
      for (const [x, z] of [[-5, -5], [4, -5], [-5, 4], [4, 4]]) B.push([x, 9.5, z, 1, 1, 1, 0, pt]);
      for (const [x, z] of [[-0.5, -5], [-0.5, 4], [4, -0.5], [-5, -0.5]]) B.push([x, 9.5, z, 1, 2, 1, 0, pt]);
      return B;
    })() }],
  };

  // ---- pets ----
  // the snowman: two snowballs, a red scarf with its end hanging, a carrot nose, coal eyes, smile and buttons, twig
  // arms (one waves now and then)
  const snowPx = (f, i, j) => (f === 'bottom' ? '#C5D0DE' : hash(i, j, FACE_N[f]) > 0.86 ? '#DCE5F0' : hash(i, j, FACE_N[f] + 9) > 0.9 ? '#FFFFFF' : '#F2F6FC');
  const COAL = '#26262C', scarf = (f, i, j) => ((i + j) % 3 === 0 ? '#A82828' : '#D23A3A'), twig = (f, i) => (i % 2 ? '#5A3C22' : '#6B4A2B');
  const PETS = {
    snowman: [
      { name: 'body', pivot: [0, 0, 0], boxes: [
        [-3.5, 0, -3.5, 7, 6, 7, 0, (f, i, j) => (f === 'front' && i === 3 && (j === 1 || j === 3) ? COAL : snowPx(f, i, j))],
        [-3, 6, -3, 6, 1, 6, 0, scarf], [1, 3.5, -4.5, 1, 3, 1, 0, scarf],
      ] },
      { name: 'head', parent: 'body', pivot: [0, 7, 0], boxes: [
        [-2.5, 0, -2.5, 5, 5, 5, 0, (f, i, j) => (f === 'front' && ((j === 1 && (i === 1 || i === 3)) || (j === 3 && (i === 1 || i === 3)) || (j === 4 && i === 2)) ? COAL : snowPx(f, i, j + 7))],
        [-0.5, 2, -4.5, 1, 1, 2, 0, (f) => (f === 'front' ? '#D9661A' : '#F08A24')],
      ] },
      { name: 'rarm', parent: 'body', pivot: [3.5, 4.5, 0], boxes: [[0, -0.5, -0.5, 3, 1, 1, 0, twig]] },
      { name: 'larm', parent: 'body', pivot: [-3.5, 4.5, 0], boxes: [[-3, -0.5, -0.5, 3, 1, 1, 0, twig]] },
    ],
  };
  const PET_SCALE = 0.85, PET_MAX = 20, PET_FAR = 32;
  const model = (r, kind, id) => buildModel(r, 'cos_' + kind + '_' + id, (kind === 'hat' ? HATS : PETS)[id]);

  // ---- name prefixes: a character of their own in the text, drawn as the icon (Font.render below) ----
  const PRES = { potato: { ch: '' } };
  // vanilla's potato item, copied out of the block / item texture strip once it is loaded
  let potCv = null;
  function potato() {
    if (potCv) return potCv;
    const r = window.game && window.game.renderer;
    if (!r || !r.stripCanvas || typeof ITEM_KEY === 'undefined' || ITEM_KEY.potato === undefined) return null;
    const [sx, sy] = r.tileXY(ITEMS[ITEM_KEY.potato].tex);
    const cv = document.createElement('canvas'); cv.width = cv.height = 16;
    cv.getContext('2d').drawImage(r.stripCanvas, sx, sy, 16, 16, 0, 0, 16, 16);
    return (potCv = cv);
  }
  const PRE_IMG = { '': potato };
  // the name as shown (name tags, the room's player list, chat): with the icon in front when the player wears one
  function prefixed(g, e, nm, look) {
    const s = String(nm), l = look || lookOf(g, e), p = l && hasKey(PRES, l.pre) && PRES[l.pre];
    return p && !s.startsWith(p.ch) ? p.ch + s : s;
  }
  function tagName(g, e, nm) {
    if (!g || !e || (e !== g.player && e.type !== 'player') || !shown(g, e)) return nm;
    return prefixed(g, e, nm);
  }
  // by name alone (chat lines, the room's list): this player's own, or another's from what the room said
  function preName(g, nm) {
    if (!g || !nm) return nm;
    const me = (g.net && g.net.name) || GuestSession.name;
    if (nm === me) return shown(g, g.player) ? prefixed(g, g.player, nm) : nm;
    if (!shown(g, null)) return nm;
    const e = (g.entities || []).find((x) => x.type === 'player' && x.name === nm);
    const l = (e && e.look) || (g.net && g.net.looks && g.net.looks.get(nm)) || null;
    return l ? prefixed(g, e, nm, l) : nm;
  }
  // the font draws a prefix character as its icon: the text either side as usual, the icon (untinted, like the
  // emoji; not in the shadow) in the 9-pixel space it takes
  (() => {
    const R0 = Font.render, cache = new Map(), CH = Object.keys(PRE_IMG), RE = new RegExp('([' + CH.join('') + '])');
    Font.render = function (str, color) {
      const s = String(str);
      if (!CH.some((c) => s.includes(c))) return R0.call(this, s, color);
      const key = color + (this.noEmo ? '\u0001' : '\u0000') + s;
      let cv = cache.get(key);
      if (cv) return cv;
      const cell = window.FONT_MC.cell;
      cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(this.width(s) * 2) + 2); cv.height = cell;
      const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
      let px = 0, ready = true;
      for (const part of s.split(RE)) {
        if (!part) continue;
        if (PRE_IMG[part]) {
          const im = PRE_IMG[part]();
          if (!im) ready = false; else if (!this.noEmo) x.drawImage(im, 0, 0, 16, 16, px + 1, 0, cell - 1, cell - 1);
          px += this.charW(part) * 2;
        } else { x.drawImage(R0.call(this, part, color), px, 0); px += this.width(part) * 2; }
      }
      // (kept once the icon could be drawn)
      if (ready) { cache.set(key, cv); if (cache.size > 200) cache.delete(cache.keys().next().value); }
      return cv;
    };
  })();

  // ---- drawn with the player model (capes.js Capes.draw: game.js drawMob, the inventory and wardrobe previews) ----
  function drawOn(g, e, m, poses, lt, env, opts) {
    if (!shown(g, e, opts)) return;
    const r = g.renderer, gl = r.gl, cull = gl.isEnabled(gl.CULL_FACE);
    gl.disable(gl.CULL_FACE);
    try {
      const hat = worn(g, e, 'hat'), helmet = e.inv ? e.inv.slots[36] : (e.armorItems || [])[0];
      if (hat && !helmet) { const k = model(r, 'hat', hat); r.drawModel(k, k, m, { head: poses && poses.head }, lt, env, opts || {}); }
      // the wardrobe's turning preview: the pet standing by the feet
      const pet = opts && opts.inv && e === g.player && typeof Skins !== 'undefined' && Skins.preview() && worn(g, e, 'pet');
      if (pet) {
        const k = model(r, 'pet', pet), mm = M4.copy(m), now = performance.now();
        M4.translate(mm, 0.45, Math.abs(Math.sin(now / 300)) * 0.05, -0.1); M4.scale(mm, PET_SCALE, PET_SCALE, PET_SCALE);
        r.drawModel(k, k, mm, petPose(null, now), lt, env, opts);
      }
    } catch (err) { if (g.reportError) g.reportError('decoration', err, true); }
    finally { if (cull) gl.enable(gl.CULL_FACE); }
  }

  // ---- pets following their owners ----
  // A pet's state lives on its owner (e.cosPet), eased each frame: on the ground it keeps behind and to one side,
  // a block or so away, hopping while it moves, standing still it bobs and now and then waves; with the owner in the
  // air (flying, gliding, swimming, or no floor within 3 blocks) it floats by the shoulder. Left far behind (a
  // teleport) it is simply put there
  const solidAt = (w, x, y, z) => { const b = BLOCKS[w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))]; return !!(b && b.solid); };
  // the floor under (x, z) from a block above y to 3 below: a solid block with room above it
  function floorAt(w, x, y, z) {
    for (let yy = Math.floor(y + 1); yy >= Math.floor(y) - 3; yy--) if (!solidAt(w, x, yy, z) && solidAt(w, x, yy - 1, z)) return yy;
    return null;
  }
  function petPose(S, now) {
    const t = now / 1000, wave = S && S.wave > 0 ? Math.sin(S.wave * 12) * 0.5 + 0.9 : 0;
    return {
      head: { ry: Math.sin(t * 0.7) * 0.25, rz: Math.sin(t * 1.3) * 0.06 },
      rarm: { rz: 0.35 + wave + Math.sin(t * 2) * 0.05 }, larm: { rz: -0.35 - Math.sin(t * 2 + 1) * 0.05 },
    };
  }
  function drawPet(g, e, a, env, now, id) {
    const r = g.renderer, w = g.world, ip = e.ipos(a), me = e === g.player;
    const S = e.cosPet || (e.cosPet = { pos: null, t: now, yaw: 0, hop: 0, hopAmt: 0, idle: 0, wave: 0, side: Math.random() < 0.5 ? -1 : 1 });
    const dt = Math.min(0.1, Math.max(0, (now - S.t) / 1000)); S.t = now;
    const by = me && g.playerBodyYaw ? g.playerBodyYaw(a) : (e.bodyYaw ?? e.yaw ?? 0);
    const fw = [-Math.sin(by), -Math.cos(by)], rt = [Math.cos(by), -Math.sin(by)];
    const below = floorAt(w, ip[0], ip[1], ip[2]);
    const air = !!(e.flying || e.gliding || e.swimming || e.netSwim || (me && e.inWater)) || below === null;
    let tx, ty, tz;
    if (air) {
      // (by the left shoulder - the right is where the AI companion floats, companion.js place(); in first person
      // further back, out of the way of the view)
      const back = me && g.perspective === 0 ? 0.6 : 0.15, low = e.gliding || e.swimming || e.netSwim;
      tx = ip[0] - rt[0] * 0.8 - fw[0] * back; tz = ip[2] - rt[1] * 0.8 - fw[1] * back; ty = ip[1] + (low ? 0.3 : 1.3);
    } else {
      let fy = null;
      for (const [b, s] of [[0.9, 0.6 * S.side], [0.9, 0], [0, 0]]) {
        tx = ip[0] - fw[0] * b + rt[0] * s; tz = ip[2] - fw[1] * b + rt[1] * s;
        fy = floorAt(w, tx, ip[1], tz); if (fy !== null) break;
      }
      // (on the owner's level - a slab, a path - it stands where the owner stands)
      ty = fy === null ? ip[1] : Math.abs(fy - ip[1]) < 0.6 ? ip[1] : fy;
    }
    if (!S.pos || S.world !== w || Math.hypot(tx - S.pos[0], ty - S.pos[1], tz - S.pos[2]) > 12) { S.pos = [tx, ty, tz]; S.world = w; }
    const P = S.pos, ox = P[0], oz = P[2], d = Math.hypot(tx - ox, tz - oz);
    // on the ground it sets off once more than half a block from its place and goes all the way (no creeping)
    if (air || d > 0.5) S.going = true; else if (d < 0.08) S.going = false;
    if (S.going) { const k = 1 - Math.exp(-dt * (air ? 4 : 5)); P[0] += (tx - P[0]) * k; P[2] += (tz - P[2]) * k; }
    P[1] += (ty - P[1]) * (1 - Math.exp(-dt * (air ? 4 : 12)));
    const sp = dt > 0 ? Math.hypot(P[0] - ox, P[2] - oz) / dt : 0, moving = sp > 0.3;
    // facing where it goes, else its owner
    const want = moving ? Math.atan2(-(P[0] - ox), -(P[2] - oz)) : Math.atan2(-(ip[0] - P[0]), -(ip[2] - P[2]));
    let dy = want - S.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); S.yaw += dy * (1 - Math.exp(-dt * 8));
    S.hopAmt += ((moving && !air ? 1 : 0) - S.hopAmt) * (1 - Math.exp(-dt * 8));
    if (S.hopAmt > 0.01) S.hop += dt * 8;
    S.idle = moving ? 0 : S.idle + dt;
    if (S.wave > 0) S.wave -= dt; else if (!air && S.idle > 3 && Math.random() < dt * 0.15) S.wave = 1.2;
    const t = now / 1000, hopY = Math.abs(Math.sin(S.hop)) * 0.2 * S.hopAmt;
    const y = P[1] + hopY + (air ? Math.sin(t * 2.5) * 0.06 : 0);
    // (too close to the camera to be anything but in the way)
    if (me && g.perspective === 0 && Math.hypot(P[0] - r.camPos[0], y + 0.3 - r.camPos[1], P[2] - r.camPos[2]) < 0.6) return;
    if (!aabbInFrustum(r.planes, P[0] - 0.4, y, P[2] - 0.4, P[0] + 0.4, y + 0.7, P[2] + 0.4)) return;
    const sq = air ? 1 : 1 + Math.sin(t * 3) * 0.025 * (1 - S.hopAmt) - Math.cos(S.hop * 2) * 0.05 * S.hopAmt;
    const m = M4.create(); M4.translate(m, P[0], y, P[2]); M4.rotY(m, S.yaw);
    M4.scale(m, PET_SCALE / Math.sqrt(sq), PET_SCALE * sq, PET_SCALE / Math.sqrt(sq));
    const L = w.getLight(Math.floor(P[0]), Math.floor(y + 0.3), Math.floor(P[2]));
    const lt = L ? [(L >> 4) / 15, (L & 15) / 15] : e.lightAt();
    const k = model(r, 'pet', id);
    r.drawModel(k, k, m, petPose(S, now), lt, env, {});
    if (!air && hopY < 0.5) r.drawShadow(P[0], P[1], P[2], 0.28, 0.45 * (1 - hopY * 2));
  }
  // (an invisible owner's pet would give them away - the potion, or a server's flag, as game.js drawMob reads it)
  const hidden = (e) => !!(e.invisible || (e.hasEffect && e.hasEffect('invisibility')));
  function drawPets(g, a, env) {
    const p = g.player, now = performance.now(), list = [];
    if (p && !p.dead && !(p.deathTime > 0) && g.mode !== 'spectator' && !hidden(p) && shown(g, p)) { const id = worn(g, p, 'pet'); if (id) list.push([p, id]); }
    if (p && othersPets(g)) {
      const near = [];
      for (const e of g.entities) {
        if (e.type !== 'player' || e === p || e.dead || e.deathTime > 0 || hidden(e)) continue;
        const id = worn(g, e, 'pet'); if (!id) continue;
        const dd = Math.hypot(e.pos[0] - p.pos[0], e.pos[1] - p.pos[1], e.pos[2] - p.pos[2]);
        if (dd <= PET_FAR) near.push([dd, e, id]);
      }
      near.sort((x, y) => x[0] - y[0]);
      for (const [, e, id] of near.slice(0, PET_MAX)) list.push([e, id]);
    }
    if (!list.length) return;
    const gl = g.renderer.gl;
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    for (const [e, id] of list) try { drawPet(g, e, a, env, now, id); } catch (err) { g.reportError('pet', err, true); }
    gl.enable(gl.CULL_FACE);
  }
  // (with the entities, before the companion and the name tags: the tags don't write depth, so a pet drawn after
  // them would paint over one in front of it; and still recording, so the shader pack's shadow map has the pets.
  // Once a frame - the first-person shadow pass calls drawMob itself)
  (() => {
    const de = Game.prototype.drawEntityList;
    Game.prototype.drawEntityList = function (list, a, env, cam) {
      de.call(this, list, a, env, cam);
      if (this.state === 'play' && this.world && this.player) try { drawPets(this, a, env); } catch (err) { this.reportError('pets', err, true); }
    };
  })();

  // ---- icons on menus (the wardrobe, the sign-in card): any decoration id, size pixels square ----
  const ICONS = {
    straw: { pal: { L: SL, D: SD, R: '#8A1E1E', r: '#701515', b: '#A8873F' }, rows: [
      '................', '................', '................', '................',
      '.....LDLDLD.....', '....LDLDLDLD....', '....DLDLDLDL....', '....LDLDLDLD....',
      '....RrRRrRRr....', '....DLDLDLDL....', '.LDLDLDLDLDLDLD.', 'LDLDLDLDLDLDLDLD',
      '.bbbbbbbbbbbbbb.', '................', '................', '................'] },
    tophat: { pal: { K: BLACK, k: '#4A4A58', g: '#5A5A68', R: '#9A1A2C', r: '#7A1020', s: '#0E0E12' }, rows: [
      '................', '.....gggggg.....', '.....KkKKKK.....', '.....KkKKKK.....',
      '.....KkKKKK.....', '.....KkKKKK.....', '.....KkKKKK.....', '.....KkKKKK.....',
      '.....RRRRRR.....', '.....rrrrrr.....', '..gggggggggggg..', '.KKKKKKKKKKKKKK.',
      '..ssssssssssss..', '................', '................', '................'] },
    crown: { pal: { y: '#FFF2A0', G: GOLD, L: GOLD_L, d: GOLD_D, R: '#E0303A', B: '#3A6AE0', E: '#2FC46A' }, rows: [
      '................', '................', '................', '..y....yy....y..',
      '..G...GGGG...G..', '..GG..GRRG..GG..', '..GGGGGGGGGGGG..', '..LLLLLLLLLLLL..',
      '..GBGGGRRGGGEG..', '..GBGGGRRGGGEG..', '..GGGGGGGGGGGG..', '..dddddddddddd..',
      '................', '................', '................', '................'] },
    snowman: { pal: { W: '#F4F8FF', S: '#C5D0DE', k: COAL, o: '#F08A24', R: '#D23A3A', t: '#6B4A2B' }, rows: [
      '................', '......WWWW......', '.....WWWWWW.....', '.....WkWWkW.....',
      '.....WWWWooo....', '.....WkWkWW.....', '......WkWW......', '....RRRRRRRR....',
      '..t.WWWWWRWW.t..', '...tWWWkWRWWt...', '....WWWWWRWW....', '....WWWkWWWW....',
      '....WWWWWWWW....', '.....SSSSSS.....', '................', '................'] },
  };
  const grey = (c) => { const n = parseInt(c.slice(1), 16), l = Math.round((((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) * 0.5 + 20); return 'rgb(' + l + ',' + l + ',' + l + ')'; };
  function drawPix(c, art, x, y, size, locked) {
    const n = art.rows.length, s = size / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < art.rows[j].length; i++) {
      const col = art.pal[art.rows[j][i]]; if (!col) continue;
      const x0 = Math.floor(x + i * s), y0 = Math.floor(y + j * s);
      c.fillStyle = locked ? grey(col) : col; c.fillRect(x0, y0, Math.floor(x + (i + 1) * s) - x0, Math.floor(y + (j + 1) * s) - y0);
    }
  }
  function drawIcon(c, id, x, y, size, locked) {
    const [kind, v] = String(id || '').split(':');
    c.save(); c.imageSmoothingEnabled = false;
    try {
      if (kind === 'cape' && typeof Capes !== 'undefined') { const s = size / 16; Capes.drawFlat(c, v, Math.round(x + (size - 10 * s) / 2), y, s, locked); }
      else if (kind === 'pre') { const im = hasKey(PRES, v) && PRE_IMG[PRES[v].ch](); if (im) { if (locked) c.globalAlpha = 0.35; c.drawImage(im, 0, 0, 16, 16, x, y, size, size); } }
      else if (hasKey(ICONS, v)) drawPix(c, ICONS[v], x, y, size, locked);
    } finally { c.restore(); }
  }

  // the wardrobe (skins.js WardrobeScreen) on a tab: 'skin' 'cape' 'hat' 'pet' 'pre' (or a decoration's id)
  function openWardrobe(game, parent, kind) {
    const s = new WardrobeScreen(game, parent);
    const k = String(kind || '').split(':')[0];
    if (['skin', 'cape', 'hat', 'pet', 'pre'].includes(k)) s.tab = k;
    game.ui.open(s);
    return s;
  }

  return {
    LIST, KIND, info, name, owned, has, shown, lookOf, worn, mine, drawOn, drawIcon, openWardrobe, tagName, preName,
    PRE_CHAR: PRES.potato.ch, preChar: (v) => (hasKey(PRES, v) ? PRES[v].ch : ''),
  };
})();
