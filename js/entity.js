'use strict';
// ---------------------------------------------------------------------------
// Entities, physics, mobs, particles, explosions
// ---------------------------------------------------------------------------
function blockBoxes(world, x0, y0, z0, x1, y1, z1, out) {
  out.length = 0;
  const ix0 = Math.floor(x0), iy0 = Math.floor(y0) - 1, iz0 = Math.floor(z0);
  const ix1 = Math.floor(x1), iy1 = Math.floor(y1), iz1 = Math.floor(z1);
  for (let x = ix0; x <= ix1; x++) for (let z = iz0; z <= iz1; z++) {
    if (!world.isLoaded(x, z)) { out.push([x, -1e3, z, x + 1, 1e3, z + 1]); continue; }
    for (let y = iy0; y <= iy1; y++) {
      const id = world.getBlock(x, y, z);
      if (!id) continue;
      const b = BLOCKS[id];
      if (!b.solid) continue;
      if (b.shape === SH_BOXES || b.shape === SH_MODEL) {
        const m = b.fence ? world.fenceMeta(x, y, z, b) : world.getMeta(x, y, z);
        for (const bx of (b.collide ? b.collide(m) : b.boxes(m))) out.push([x + bx[0] / 16, y + bx[1] / 16, z + bx[2] / 16, x + bx[3] / 16, y + bx[4] / 16 * (b.key === 'snow' ? 0 : 1), z + bx[5] / 16]);
      } else if (b.shape === SH_CACTUS) out.push([x + 1 / 16, y, z + 1 / 16, x + 15 / 16, y + 1, z + 15 / 16]);
      else out.push([x, y, z, x + 1, y + 1, z + 1]);
    }
  }
  return out;
}
const _boxes = [];

class Entity {
  constructor(game, x, y, z, w, h) {
    this.game = game; this.world = game.world;
    this.pos = [x, y, z]; this.prev = [x, y, z]; this.vel = [0, 0, 0];
    this.w = w; this.h = h;
    this.yaw = 0; this.pitch = 0; this.prevYaw = 0;
    this.onGround = false; this.collidedH = false; this.inWater = false; this.inLava = false; this.eyeInWater = false;
    this.dead = false; this.age = 0; this.fallDist = 0; this.stepHeight = 0;
    this.id = Entity.nextId++;
  }
  box() { const w = this.w / 2; return [this.pos[0] - w, this.pos[1], this.pos[2] - w, this.pos[0] + w, this.pos[1] + this.h, this.pos[2] + w]; }
  savePrev() { this.prev[0] = this.pos[0]; this.prev[1] = this.pos[1]; this.prev[2] = this.pos[2]; this.prevYaw = this.yaw; this.prevBodyYaw = this.bodyYaw; }
  ipos(a) { return [lerp(this.prev[0], this.pos[0], a), lerp(this.prev[1], this.pos[1], a), lerp(this.prev[2], this.pos[2], a)]; }

  collides(bb) {
    blockBoxes(this.world, bb[0], bb[1], bb[2], bb[3], bb[4], bb[5], _boxes);
    for (const b of _boxes) if (bb[0] < b[3] && bb[3] > b[0] && bb[1] < b[4] && bb[4] > b[1] && bb[2] < b[5] && bb[5] > b[2]) return true;
    return false;
  }

  static clip(bb, boxes, d, axis) {
    const a = axis, o1 = (axis + 1) % 3, o2 = (axis + 2) % 3;
    for (const b of boxes) {
      if (bb[o1] >= b[o1 + 3] || bb[o1 + 3] <= b[o1] || bb[o2] >= b[o2 + 3] || bb[o2 + 3] <= b[o2]) continue;
      if (d > 0 && bb[a + 3] <= b[a] + 1e-7) { const m = b[a] - bb[a + 3]; if (m < d) d = m; }
      else if (d < 0 && bb[a] >= b[a + 3] - 1e-7) { const m = b[a + 3] - bb[a]; if (m > d) d = m; }
    }
    return d;
  }

  move(dx, dy, dz) {
    if (this.noClip) { this.pos[0] += dx; this.pos[1] += dy; this.pos[2] += dz; return; }
    // sneaking: don't walk off edges
    if (this.sneakEdge && this.onGround && !this.flying) {
      const step = 0.05, dx0 = dx, dz0 = dz;
      const test = (ddx, ddz) => { const b = this.box(); return this.collides([b[0] + ddx, b[1] - 0.6, b[2] + ddz, b[3] + ddx, b[1], b[5] + ddz]); };
      while (dx !== 0 && !test(dx, 0)) { if (Math.abs(dx) < step) dx = 0; else dx -= Math.sign(dx) * step; }
      while (dz !== 0 && !test(0, dz)) { if (Math.abs(dz) < step) dz = 0; else dz -= Math.sign(dz) * step; }
      while (dx !== 0 && dz !== 0 && !test(dx, dz)) {
        if (Math.abs(dx) < step) dx = 0; else dx -= Math.sign(dx) * step;
        if (Math.abs(dz) < step) dz = 0; else dz -= Math.sign(dz) * step;
      }
      // (held back at the edge: no speed kept that way - pushing against an edge built some up, and letting go of
      // sneak then carried the player over it)
      if (this.vel) { if (dx !== dx0) this.vel[0] = 0; if (dz !== dz0) this.vel[2] = 0; }
    }
    const ox = dx, oy = dy, oz = dz;
    const bb = this.box();
    blockBoxes(this.world, Math.min(bb[0], bb[0] + dx) - 0.01, Math.min(bb[1], bb[1] + dy) - 0.01, Math.min(bb[2], bb[2] + dz) - 0.01,
      Math.max(bb[3], bb[3] + dx) + 0.01, Math.max(bb[4], bb[4] + dy) + 0.01, Math.max(bb[5], bb[5] + dz) + 0.01, _boxes);
    const boxes = _boxes.slice();
    // boats and minecarts are solid to the player, as vanilla (canBeCollidedWith): one can stand on one - it went through them into
    // the water, "船没有碰撞箱，站上去会沉下去" (feedback 2026-11-01/02). Not to its own rider; a box already overlapped
    // doesn't hold anyone back (clip only stops what comes from outside)
    if (this.game && this === this.game.player && !this.vehicle && typeof Boat !== 'undefined')
      for (const e of this.game.entities) if ((e instanceof Boat || (typeof Minecart !== 'undefined' && e instanceof Minecart)) && !e.dead && Math.abs(e.pos[0] - bb[0]) < 4 && Math.abs(e.pos[2] - bb[2]) < 4 && Math.abs(e.pos[1] - bb[1]) < 4) boxes.push(e.box());
    dy = Entity.clip(bb, boxes, dy, 1); bb[1] += dy; bb[4] += dy;
    dx = Entity.clip(bb, boxes, dx, 0); bb[0] += dx; bb[3] += dx;
    dz = Entity.clip(bb, boxes, dz, 2); bb[2] += dz; bb[5] += dz;
    const grounded = this.onGround || (oy !== dy && oy < 0);
    if (this.stepHeight > 0 && grounded && (dx !== ox || dz !== oz)) {
      const sb = this.box();
      blockBoxes(this.world, Math.min(sb[0], sb[0] + ox) - 0.01, sb[1] - 0.01, Math.min(sb[2], sb[2] + oz) - 0.01,
        Math.max(sb[3], sb[3] + ox) + 0.01, sb[4] + this.stepHeight + 0.01, Math.max(sb[5], sb[5] + oz) + 0.01, _boxes);
      const b2 = _boxes.slice();
      let sy = Entity.clip(sb, b2, this.stepHeight, 1); sb[1] += sy; sb[4] += sy;
      let sx = Entity.clip(sb, b2, ox, 0); sb[0] += sx; sb[3] += sx;
      let sz = Entity.clip(sb, b2, oz, 2); sb[2] += sz; sb[5] += sz;
      let down = Entity.clip(sb, b2, -sy, 1); sb[1] += down; sb[4] += down;
      if (sx * sx + sz * sz > dx * dx + dz * dz + 1e-6) {
        for (let i = 0; i < 6; i++) bb[i] = sb[i];
        dx = sx; dz = sz; dy = sy + down;
        this.stepped = true;
      }
    }
    this.collidedH = Math.abs(dx - ox) > 1e-6 || Math.abs(dz - oz) > 1e-6;
    this.onGround = oy < 0 && Math.abs(dy - oy) > 1e-7 || (this.stepped && oy <= 0 && this.onGround);
    this.stepped = false;
    if (Math.abs(dy - oy) > 1e-7) this.vel[1] = 0;
    if (Math.abs(dx - ox) > 1e-7) this.vel[0] = 0;
    if (Math.abs(dz - oz) > 1e-7) this.vel[2] = 0;
    this.pos[0] = (bb[0] + bb[3]) / 2; this.pos[1] = bb[1]; this.pos[2] = (bb[2] + bb[5]) / 2;
    // fall distance
    if (this.onGround) {
      if (this.fallDist > 0) this.onLand(this.fallDist);
      this.fallDist = 0;
    } else if (dy < 0) this.fallDist -= dy;
  }
  onLand(d) { }

  // in a bubble column (World.bubbleColumnAt): pushed up over soul sand, pulled down over magma, like vanilla's
  // Entity.onInsideBubbleColumn - and in its top block (air above) onAboveBubbleColumn, which throws things out
  bubbleColumn() {
    const w = this.world, x = Math.floor(this.pos[0]), z = Math.floor(this.pos[2]), y = Math.floor(this.pos[1] + 0.1);
    const c = w.bubbleColumnAt(x, y, z);
    if (!c) return;
    const v = this.vel, top = w.getBlock(x, y + 1, z) === AIR;
    if (top) v[1] = c < 0 ? Math.max(-0.9, v[1] - 0.03) : Math.min(1.8, v[1] + 0.1);
    else { v[1] = c < 0 ? Math.max(-0.3, v[1] - 0.03) : Math.min(0.7, v[1] + 0.06); this.fallDist = 0; }
  }
  updateFluids() {
    const b = this.box();
    this.inWater = false; this.inLava = false;
    const x0 = Math.floor(b[0] + 0.001), x1 = Math.floor(b[3] - 0.001), y0 = Math.floor(b[1] + 0.001), y1 = Math.floor(b[4] - 0.001), z0 = Math.floor(b[2] + 0.001), z1 = Math.floor(b[5] - 0.001);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const id = this.world.getBlock(x, y, z);
      if (id === WATER || WLOG[id] || (id && this.world.isWaterlogged(x, y, z))) { this.inWater = true; this.fallDist = 0; }
      else if (id === LAVA) this.inLava = true;
    }
    const ey = this.pos[1] + (this.eyeH || this.h * 0.85);
    this.eyeInWater = this.world.waterAt(Math.floor(this.pos[0]), Math.floor(ey), Math.floor(this.pos[2])) && ey < Math.floor(ey) + 0.9;
    if (this.vel && !this.remote && this.fluidPushed()) {
      if (this.inWater) this.fluidPush(WATER, 0.014, b, x0, x1, y0, y1, z0, z1);
      if (this.inLava) this.fluidPush(LAVA, this.world.dim === 'nether' ? 0.007 : 0.0023333333333333335, b, x0, x1, y0, y1, z0, z1);
    }
  }
  // the current carries things along (Entity.updateFluidHeightAndDoFluidPushing): the flow of the cells it is in,
  // averaged (weaker in the shallows), straight along it for anything but a player, at least 0.0045 a tick from
  // standing; not fish, boats, or a flying player
  // how deep in water its feet are (vanilla getFluidHeight(WATER))
  waterDepth() {
    const w = this.world, x = Math.floor(this.pos[0]), z = Math.floor(this.pos[2]), y0 = Math.floor(this.pos[1]);
    let d = 0;
    for (let y = y0; y <= y0 + 1; y++) {
      const a = w.fluidAmount(WATER, x, y, z); if (a <= 0) break;
      d = Math.max(d, y + (w.fluidAmount(WATER, x, y + 1, z) > 0 ? 1 : a / 9) - this.pos[1]);
    }
    return d;
  }
  fluidPushed() { return !this.flying && !/^(cod|salmon|pufferfish|tropical_fish|squid|glow_squid|dolphin|tadpole|boat|chest_boat)/.test(this.type || ''); }
  fluidPush(id, scale, b, x0, x1, y0, y1, z0, z1) {
    const w = this.world;
    let vx = 0, vy = 0, vz = 0, k = 0, d0 = 0;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const a = w.fluidAmount(id, x, y, z);
      if (a <= 0) continue;
      const top = y + (w.fluidAmount(id, x, y + 1, z) > 0 ? 1 : a / 9);
      if (top < b[1]) continue;
      d0 = Math.max(top - b[1], d0);
      const f = w.fluidFlow(id, x, y, z), s = d0 < 0.4 ? d0 : 1;
      vx += f[0] * s; vy += f[1] * s; vz += f[2] * s; k++;
    }
    let L = Math.hypot(vx, vy, vz);
    if (!(L > 0)) return;
    if (k > 0) { vx /= k; vy /= k; vz /= k; L /= k; }
    if (this !== this.game.player) { vx /= L; vy /= L; vz /= L; L = 1; }
    vx *= scale; vy *= scale; vz *= scale; L *= scale;
    const v = this.vel;
    if (Math.abs(v[0]) < 0.003 && Math.abs(v[2]) < 0.003 && L < 0.0045) { const m = 0.0045 / L; vx *= m; vy *= m; vz *= m; }
    v[0] += vx; v[1] += vy; v[2] += vz;
  }

  lightAt() {
    const l = this.world.getLight(Math.floor(this.pos[0]), Math.floor(this.pos[1] + this.h * 0.5), Math.floor(this.pos[2]));
    return [(l >> 4) / 15, (l & 15) / 15];
  }
  distTo(e) { return Math.hypot(this.pos[0] - e.pos[0], this.pos[1] - e.pos[1], this.pos[2] - e.pos[2]); }
}
Entity.nextId = 1;

// ---------------------------------------------------------------------------
// Living entities
// ---------------------------------------------------------------------------
class Living extends Entity {
  constructor(game, x, y, z, w, h, hp) {
    super(game, x, y, z, w, h);
    this.health = hp; this.maxHealth = hp;
    this.hurtTime = 0; this.invuln = 0; this.deathTime = 0;
    this.fire = 0; this.air = 300;
    this.limbSwing = 0; this.limbAmt = 0; this.bodyYaw = 0; this.headYaw = 0;
    this.stepHeight = 0.6; this.slowFall = false;
  }
  hurt(amount, source) {
    if (this.dead || this.deathTime > 0) return false;
    if (this.fireproof && source && (source.type === 'fire' || source.type === 'lava')) return false;
    if (this.invuln > 10 && amount <= this.lastDamage) return false;
    const actual = this.invuln > 10 ? amount - this.lastDamage : amount;
    this.lastDamage = amount; this.invuln = 20; this.hurtTime = 10;
    this.health -= this.reduceDamage ? this.reduceDamage(actual, source) : actual;
    // (no knockback at all - the hop too - when it is all resisted: the warden hopped at every hit, feedback 2026-11-01)
    if (source && source.knockFrom && (source.knock ?? 0.4) > 0) {
      const dx = this.pos[0] - source.knockFrom[0], dz = this.pos[2] - source.knockFrom[2];
      const d = Math.hypot(dx, dz) || 1, k = source.knock ?? 0.4;
      this.vel[0] = this.vel[0] / 2 + dx / d * k; this.vel[2] = this.vel[2] / 2 + dz / d * k;
      if (this.onGround) this.vel[1] = Math.min(0.4, this.vel[1] / 2 + 0.36);
    }
    this.onHurt(source);
    if (this.health <= 0) { this.health = 0; this.die(source); }
    return true;
  }
  onHurt() { }
  die() { this.deathTime = 1; }
  baseTick() {
    this.age++;
    if (this.hurtTime > 0) this.hurtTime--;
    if (this.invuln > 0) this.invuln--;
    this.updateFluids();
    if (this.inWater) this.bubbleColumn();
    if (this.inLava && !this.fireproof) { this.hurt(4, { type: 'lava' }); this.fire = 300; }
    {
      const b0 = this.box();
      this.inWeb = false;
      for (let x = Math.floor(b0[0]); x <= Math.floor(b0[3] - 0.001); x++) for (let y = Math.floor(b0[1]); y <= Math.floor(b0[4] - 0.001); y++) for (let z = Math.floor(b0[2]); z <= Math.floor(b0[5] - 0.001); z++) {
        const id = this.world.getBlock(x, y, z);
        if (id === 177) this.inWeb = true;
        else if (id === 171 && !this.fireproof) { if (this.fire < 160) this.fire = 160; if (this.age % 10 === 0) this.hurt(1, { type: 'fire' }); }
      }
    }
    if (this.fireproof) this.fire = 0;
    if (this.fire > 0) {
      this.fire--;
      if (this.inWater) this.fire = 0;
      else if (this.fire % 20 === 0) this.hurt(1, { type: 'fire' });
      if (Math.random() < 0.3) this.game.particles.spawn('flame', this.pos[0] + (Math.random() - 0.5) * this.w, this.pos[1] + Math.random() * this.h, this.pos[2] + (Math.random() - 0.5) * this.w, 0, 0.02, 0);
    }
    // (the eyes in a bubble column breathe, as vanilla - "气泡柱没氧气", feedback 2026-11-01/02)
    const bubbles = this.eyeInWater && this.world.bubbleColumnAt(Math.floor(this.pos[0]), Math.floor(this.pos[1] + (typeof this.eye === 'function' ? this.eye() : this.h * 0.85)), Math.floor(this.pos[2]));
    if (this.eyeInWater && !this.waterBreather && !bubbles) {
      const resp = this.inv ? armorEnch(this, 'respiration', [39]) : 0;
      if (!resp || Math.random() < 1 / (resp + 1)) this.air--;
      if (this.air <= -20) { this.air = 0; this.hurt(2, { type: 'drown' }); }
    } else this.air = Math.min(300, this.air + 4);
    // contact damage (cactus, magma)
    const b = this.box();
    for (const [x, y, z] of [[b[0] - 0.01, b[1] + 0.3, this.pos[2]], [b[3] + 0.01, b[1] + 0.3, this.pos[2]], [this.pos[0], b[1] + 0.3, b[2] - 0.01], [this.pos[0], b[1] + 0.3, b[5] + 0.01]]) {
      if (this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === 37) { this.hurt(1, { type: 'cactus' }); break; }
    }
    if (this.onGround && this.world.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1] - 0.1), Math.floor(this.pos[2])) === 103 && !this.sneaking) this.hurt(1, { type: 'hotFloor' });
    // a sweet berry bush past its first stage pricks whoever moves through it (vanilla: 1, not foxes and bees;
    // players' feedback 2026-10-31: no damage)
    if (BID.sweet_berry_bush !== undefined && this.type !== 'fox' && this.type !== 'bee') {
      const bx = Math.floor(this.pos[0]), by = Math.floor(this.pos[1] + 0.2), bz = Math.floor(this.pos[2]), w = this.world;
      if (w.getBlock(bx, by, bz) === BID.sweet_berry_bush && Features.propOf(BID.sweet_berry_bush, w.getMeta(bx, by, bz), 'age') !== '0') {
        const mx = this.pos[0] - (this.prev ? this.prev[0] : this.pos[0]), mz = this.pos[2] - (this.prev ? this.prev[2] : this.pos[2]);
        if (Math.abs(mx) >= 0.003 || Math.abs(mz) >= 0.003) this.hurt(1, { type: 'berry' });
      }
    }
    if (this.pos[1] < -40) this.hurt(4, { type: 'void' });
  }
  onLand(d) {
    if (this.slowFall) return;
    const id = this.world.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1] - 0.2), Math.floor(this.pos[2]));
    if (d > 1.5 && id && BLOCKS[id].shape !== SH_LIQUID) {
      const n = Math.min(30, Math.floor(d * 3));
      for (let i = 0; i < n; i++) this.game.particles.spawn('block', this.pos[0] + (Math.random() - 0.5) * this.w, this.pos[1] + 0.1, this.pos[2] + (Math.random() - 0.5) * this.w, (Math.random() - 0.5) * 0.3, 0.1 + Math.random() * 0.1, (Math.random() - 0.5) * 0.3, { id, meta: 0, tint: BLOCKS[id].tint ? this.game.tintAt(Math.floor(this.pos[0]), Math.floor(this.pos[2]), BLOCKS[id].tint) : null });
      if (d > 3) Sound.block('step', BLOCKS[id].sound, this.pos);
    }
    const jb = this.effects ? this.effectAmp('jump_boost') + 1 : 0;
    if (d > 3.0 + jb && !this.inWater && id !== 87) {
      const dmg = Math.ceil(d - 3 - jb);
      this.hurt(dmg, { type: 'fall' });
      // vanilla causeFallDamage: the small / big fall sound (a player's own), then the landing block's fall sound -
      // it was the block's break sound (players' feedback 2026-10-31)
      Sound.ev((this === this.game.player ? 'entity.player.' : 'entity.generic.') + (dmg > 4 ? 'big_fall' : 'small_fall'), this.pos, 1, 1);
      if (BLOCKS[id]) Sound.block('fall', BLOCKS[id].sound, this.pos);
    }
  }
  // MC-like movement physics; fwd/strafe in [-1,1] relative to yaw
  travel(fwd, strafe, speed, jump) {
    const v = this.vel;
    if (this.inWeb) { v[0] *= 0.25; v[2] *= 0.25; v[1] *= 0.05; this.fallDist = 0; }
    if (this.inWater || this.inLava) {
      // vanilla: water drag 0.8 (0.9 while sprinting), vertical drag 0.8, sinking 0.005/tick;
      // lava drag 0.5 and gravity 0.02
      const water = this.inWater;
      let drag = water ? (this.sprinting ? 0.9 : 0.8) : 0.5, acc = 0.02 * (this.waterSpeed || 1);
      // depth strider (water_movement_efficiency, half off the ground): drag and push move toward walking's
      if (water && this.waterEfficiency) { let h = this.waterEfficiency(); if (!this.onGround) h *= 0.5; if (h > 0) { drag += (0.54600006 - drag) * h; acc += (speed - acc) * h; } }
      this.accel(fwd, strafe, acc);
      if (this.swimming && water) {
        // swimming: rise and dive along the view direction
        const ly = Math.sin(this.pitch), k = ly < -0.2 ? 0.085 : 0.06;
        const headWater = this.world.waterAt(Math.floor(this.pos[0]), Math.floor(this.pos[1] + 0.9), Math.floor(this.pos[2]));
        if (ly <= 0 || jump || headWater) v[1] += (ly - v[1]) * k;
      } else if (jump) v[1] += 0.04;
      this.move(v[0], v[1], v[2]);
      if (water) {
        v[0] *= drag; v[1] *= 0.8; v[2] *= drag;
        if (!this.sprinting) v[1] = Math.abs(v[1] - 0.005) < 0.003 && v[1] <= 0 ? -0.003 : v[1] - 0.005;
      } else { v[0] *= drag; v[1] *= drag; v[2] *= drag; v[1] -= 0.02; }
      if (this.collidedH && jump) {
        const b = this.box();
        if (!this.collides([b[0] + v[0], b[1] + 0.6, b[2] + v[2], b[3] + v[0], b[4] + 0.6, b[5] + v[2]])) v[1] = 0.3;
      }
      return;
    }
    const below = this.world.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1] - 0.5), Math.floor(this.pos[2]));
    const slip = this.onGround ? (BLOCKS[below] ? BLOCKS[below].slip : 0.6) : 1;
    const fr = this.onGround ? slip * 0.91 : 0.91;
    const a = this.onGround ? speed * (0.21600002 / (slip * slip * slip)) : (this.airSpeed || 0.02);
    this.accel(fwd, strafe, a);
    if (this.onLadder()) {
      v[0] = clamp(v[0], -0.15, 0.15); v[2] = clamp(v[2], -0.15, 0.15);
      v[1] = Math.max(v[1], -0.15);
      if (this.sneaking && v[1] < 0) v[1] = 0;
      this.fallDist = 0;
    }
    this.move(v[0], v[1], v[2]);
    if (this.onLadder() && (this.collidedH || jump)) v[1] = 0.2;
    // levitation lifts; slow falling falls with an eighth of the gravity (effects.js)
    const lev = this.effects ? this.effectAmp('levitation') : -1, slowFx = this.effects && this.hasEffect('slow_falling');
    if (lev >= 0) { v[1] += (0.05 * (lev + 1) - v[1]) * 0.2; this.fallDist = 0; }
    else { v[1] -= slowFx && v[1] <= 0 ? 0.01 : 0.08; v[1] *= 0.98; }
    if (slowFx) this.fallDist = 0;
    if (this.slowFall && v[1] < -0.1) { v[1] = -0.1; this.fallDist = 0; }
    v[0] *= fr; v[2] *= fr;
    // the block's speed factor (vanilla getBlockSpeedFactor: the one the feet are in if it has one, else the one under
    // them - once; soul sand 0.4), not with soul speed's movement efficiency
    if (this.onGround && !this.flying && !this.soulSpeedOn) {
      const feet = BLOCKS[this.world.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1] + 0.01), Math.floor(this.pos[2]))];
      const sf = (b) => (b && b.slow && b.key !== 'cobweb' ? b.slow : 0), f = sf(feet) || sf(BLOCKS[below]); // (a cobweb slows by inWeb)
      if (f) { v[0] *= f; v[2] *= f; }
    }
  }
  accel(fwd, strafe, a) {
    let l = fwd * fwd + strafe * strafe;
    if (l < 1e-4) return;
    l = Math.sqrt(l); if (l < 1) l = 1;
    fwd *= a / l; strafe *= a / l;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    this.vel[0] += -s * fwd + c * strafe;
    this.vel[2] += -c * fwd - s * strafe;
  }
  onLadder() {
    const id = this.world.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1]), Math.floor(this.pos[2]));
    return id && BLOCKS[id].climbable;
  }
  animate() {
    const dx = this.pos[0] - this.prev[0], dz = this.pos[2] - this.prev[2];
    const sp = Math.min(1, Math.hypot(dx, dz) * 4);
    this.limbAmt += (sp - this.limbAmt) * 0.4;
    this.limbSwing += this.limbAmt;
  }
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
class Inventory {
  constructor() { this.slots = new Array(41).fill(null); this.sel = 0; } // 0-35, armour 36-39, offhand 40
  get held() { return this.slots[this.sel]; }
  add(stack) {
    if (!stack) return 0;
    let n = stack.count;
    const ms = maxStack(stack.id);
    const order = [];
    for (let i = 0; i < 36; i++) order.push(i);
    for (const i of order) {
      const s = this.slots[i];
      if (s && sameKind(s, stack) && s.count < ms && !ITEMS[s.id].durability) { const k = Math.min(n, ms - s.count); s.count += k; n -= k; if (!n) return 0; }
    }
    for (const i of order) {
      if (!this.slots[i]) { const k = Math.min(n, ms); this.slots[i] = { ...stack, count: k, dmg: stack.dmg || 0 }; n -= k; if (!n) return 0; }
    }
    return n;
  }
  count(id) { let n = 0; for (let i = 0; i < 36; i++) if (this.slots[i] && this.slots[i].id === id) n += this.slots[i].count; return n; }
  remove(id, n) {
    for (let i = 0; i < 36 && n > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id) { const k = Math.min(n, s.count); s.count -= k; n -= k; if (!s.count) this.slots[i] = null; }
    }
  }
  armorPoints() {
    let p = 0;
    for (let i = 36; i < 40; i++) { const s = this.slots[i]; if (s && ITEMS[s.id].armor) p += ITEMS[s.id].armor.points; }
    return p;
  }
  armorToughness() {
    let t = 0;
    for (let i = 36; i < 40; i++) { const s = this.slots[i]; if (s && ITEMS[s.id].armor) t += ITEMS[s.id].armor.tough || 0; }
    return t;
  }
  toJSON() { return { slots: this.slots, sel: this.sel }; }
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
const PLAYER_W = Math.fround(0.6), PLAYER_H = { stand: Math.fround(1.8), crouch: Math.fround(1.5), swim: Math.fround(0.6) };
class Player extends Living {
  constructor(game, x, y, z) {
    // (vanilla's sizes are floats - 0.6F wide, 1.8F tall: half a width is 0.30000001192…, and a player pressed
    // against a wall stands where vanilla's would. With exactly 0.3 the box ended 1e-8 inside the wall by the
    // server's sums, and the server pulled the player back every tick - bug 3)
    super(game, x, y, z, PLAYER_W, PLAYER_H.stand, 20);
    this.eyeH = 1.62;
    this.inv = new Inventory();
    this.food = 20; this.saturation = 5; this.exhaustion = 0; this.foodTimer = 0;
    this.flying = false; this.sprinting = false; this.sneaking = false;
    this.spawn = [x, y, z];
    this.bob = 0; this.prevBob = 0; this.bobAmt = 0;
    this.swingT = 0; this.useT = 0;
    this.xp = 0;
    this.distWalked = 0;
  }
  // LivingEntity.swing: restarts only when idle or past half of the 6-tick swing
  swing() { if (this.swingT <= 3) this.swingT = 6; }
  get creative() { return this.game.mode === 'creative' || this.game.mode === 'spectator'; }
  get spectator() { return this.game.mode === 'spectator'; }
  eye() { return this.pose === 'swim' ? 0.4 : this.sneaking && !this.flying ? 1.27 : 1.62; }
  reduceDamage(a, src) {
    if (this.creative && src && src.type !== 'void') return 0;
    // protection enchantments (they also work on falls, fire and drowning): 4% per point, at most 80%
    const epf = protectionPoints(this, src);
    if (src && ['fall', 'drown', 'starve', 'void', 'fire'].includes(src.type)) return a * (1 - epf / 25);
    const armor = this.inv.armorPoints();
    if (armor) {
      const wear = Math.max(1, Math.floor(a / 4));
      for (let i = 36; i < 40; i++) {
        const s = this.inv.slots[i]; if (!s || !ITEMS[s.id].durability) continue;
        let n = 0; for (let k = 0; k < wear; k++) if (!unbreakingSkips(s, true)) n++;
        s.dmg = (s.dmg || 0) + n;
        if (s.dmg >= ITEMS[s.id].durability) { this.inv.slots[i] = null; Sound.block('break', 'metal', this.pos); }
      }
    }
    // vanilla's CombatRules: toughness keeps more of the armour against big hits
    const tough = this.inv.armorToughness(), eff = clamp(armor - 4 * a / (tough + 8), armor * 0.2, 20);
    return a * (1 - eff / 25) * (1 - epf / 25);
  }
  hurt(a, src) {
    if (this.spectator || (this.creative && (!src || src.type !== 'void'))) return false;
    if (this.game.gameOver) return false;
    // vanilla difficulty scaling for damage caused by mobs (melee, projectiles, explosions)
    if (src && src.attacker && src.attacker !== this && src.attacker.T) {
      const d = this.game.difficulty;
      if (d === 0) return false;
      if (d === 1) a = Math.min(a / 2 + 1, a); else if (d === 3) a = a * 3 / 2;
    }
    const r = super.hurt(a, src);
    if (r) { this.exhaust(0.1); Sound.hurt(null); this.game.onPlayerHurt(src); }
    const th = r && src && src.attacker && src.attacker !== this && src.type === 'mob' ? armorEnch(this, 'thorns') : 0;
    if (th && Math.random() < 0.15 * th) src.attacker.hurt(th > 10 ? th - 10 : 1 + Math.floor(Math.random() * 4), { type: 'thorns', attacker: this, knockFrom: this.pos });
    return r;
  }
  die(src) {
    super.die(src);
    this.game.onPlayerDeath(src);
  }
  exhaust(x) { if (!this.creative) this.exhaustion += x; }
  // the held item's upkeep: attack cool-down, how far the hand is lowered (also while riding)
  handsTick() {
    if (this.xpDelay > 0) this.xpDelay--;
    // attack cool-down ticker (reset when switching items)
    const hid = this.inv.held ? this.inv.held.id : -1;
    if (hid !== this.lastHeldId) { this.lastHeldId = hid; this.attackT = 0; } else this.attackT = (this.attackT || 0) + 1;
    // vanilla ItemInHandRenderer: the hand follows the attack cool-down (f^3, at most 0.4 per tick), so after a
    // swing the weapon dips and rises again at the item's attack speed; a new item is swapped in once lowered
    const f = this.game.attackStrength(1);
    this.oHandH = this.handH ?? 1;
    if (this.handItem === undefined) this.handItem = hid;
    this.handH = this.oHandH + clamp((this.handItem === hid ? f * f * f : 0) - this.oHandH, -0.4, 0.4);
    if (this.handH < 0.1) this.handItem = hid;
  }
  // hunger, regeneration and the arm's swing (also while riding)
  hungerTick() {
    const cr = this.creative;
    // hunger
    if (!cr) {
      // vanilla peaceful: regenerate health every second and food every half second
      if (this.game.difficulty === 0) {
        if (this.age % 20 === 0 && this.health < this.maxHealth) this.health = Math.min(this.maxHealth, this.health + 1);
        if (this.age % 10 === 0 && this.food < 20) this.food++;
      }
      if (this.exhaustion >= 4) { this.exhaustion -= 4; if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1); else this.food = Math.max(0, this.food - 1); }
      this.foodTimer++;
      if (this.food >= 18 && this.health < this.maxHealth) {
        if (this.foodTimer >= (this.saturation > 0 && this.food === 20 ? 10 : 80)) { this.health = Math.min(this.maxHealth, this.health + 1); this.exhaust(6); this.foodTimer = 0; }
      } else if (this.food <= 0) {
        if (this.foodTimer >= 80) { const d = this.game.difficulty; if (this.health > 10 || d === 3 || (this.health > 1 && d === 2)) this.hurt(1, { type: 'starve' }); this.foodTimer = 0; }
      } else this.foodTimer = 0;
    // (not topped up below the world: the void hurts creative players too, and refilled every tick they never died -
    // players' feedback 2026-10-31)
    } else { this.food = 20; if (this.pos[1] >= -40) this.health = this.maxHealth; this.air = 300; this.fire = 0; }
    if (this.swingT > 0) this.swingT--;
  }
  tick(input) {
    this.savePrev();
    this.baseTick();
    if (this.deathTime > 0) { this.deathTime++; return; }
    const cr = this.creative;
    if (!cr && this.flying) this.flying = false;
    // vanilla swimming: start by sprinting with the eyes under water, keep it while sprinting in water
    const eyeWater = this.world.waterAt(Math.floor(this.pos[0]), Math.floor(this.pos[1] + this.eye()), Math.floor(this.pos[2]));
    if (this.flying) this.swimming = false;
    else if (this.swimming) this.swimming = this.sprinting && this.inWater;
    else this.swimming = this.sprinting && eyeWater && this.inWater && input.fwd > 0;
    // pose: swim (also used to crawl through 1-block gaps), crouch, stand
    // (a door closed on the player doesn't count: it put them into the crawling pose - "开关门被挤趴下", feedback
    // 2026-11-01/02; they walk out of it as before)
    const fits = (h) => {
      const oh = this.h; this.h = h; const bb = this.box(); this.h = oh;
      blockBoxes(this.world, bb[0], bb[1], bb[2], bb[3], bb[4], bb[5], _boxes);
      for (const b of _boxes) {
        if (!(bb[0] < b[3] && bb[3] > b[0] && bb[1] < b[4] && bb[4] > b[1] && bb[2] < b[5] && bb[5] > b[2])) continue;
        const d = BLOCKS[this.world.getBlock(Math.floor((b[0] + b[3]) / 2), Math.floor((b[1] + b[4]) / 2), Math.floor((b[2] + b[5]) / 2))];
        if (d && d.door) continue;
        return false;
      }
      return true;
    };
    let pose = 'stand';
    if (this.spectator) { this.flying = true; this.noClip = true; this.swimming = false; }
    else if (this.swimming) pose = 'swim';
    else if (this.gliding && !this.glideFlip) pose = 'swim'; // gliding: vanilla's fall-flying pose is the swimming one's size (0.6, eyes at 0.4)
    else if (input.sneak && !this.flying && fits(PLAYER_H.crouch)) pose = 'crouch';
    else if (!this.noClip && !fits(PLAYER_H.stand)) pose = fits(PLAYER_H.crouch) ? 'crouch' : 'swim';
    this.pose = pose;
    this.handsTick();
    // vanilla swimAmount: eases in/out by 0.09 per tick
    this.prevSwimAmt = this.swimAmt || 0; this.swimAmt = clamp(this.prevSwimAmt + (pose === 'swim' ? 0.09 : -0.09), 0, 1);
    this.crawling = pose === 'swim' && !this.swimming;
    this.sneaking = pose === 'crouch';
    this.sneakEdge = this.sneaking;
    this.h = PLAYER_H[pose];
    // sprinting
    const canSprint = cr || this.food > 6;
    if (input.sprint && input.fwd > 0 && canSprint && !this.sneaking && !this.crawling) this.sprinting = true;
    if (input.fwd <= 0 || (this.collidedH && !this.swimming) || !canSprint || this.sneaking || this.crawling) this.sprinting = false;
    // (movement speed 0.1, sprinting x1.3; soul speed adds to it - enchant.js)
    const sp = (0.1 + (this.speedBonus ? this.speedBonus() : 0)) * (this.sprinting ? 1.3 : 1) * effectSpeedFactor(this);
    let fwd = input.fwd * 0.98, str = input.strafe * 0.98;
    if (this.sneaking || this.crawling) { const k = this.sneakSpeed ? this.sneakSpeed() : 0.3; fwd *= k; str *= k; }
    if (this.useT > 0 && this.usingItem && !(ITEMS[this.usingItem] && /_spear$/.test(ITEMS[this.usingItem].key))) { fwd *= 0.2; str *= 0.2; }
    this.airSpeed = this.sprinting ? 0.026 : 0.02;
    this.slowFall = false;
    if (this.flying) {
      const v = this.vel;
      this.accel(fwd, str, this.sprinting ? 0.1 : 0.05);
      let ty = 0; if (input.jump) ty += 0.375; if (input.sneak) ty -= 0.375;
      v[1] += (ty - v[1]) * 0.4;
      this.move(v[0], v[1], v[2]);
      v[0] *= 0.91; v[2] *= 0.91; v[1] *= 0.6;
      if (this.onGround && input.sneak && !this.spectator) this.flying = false;
      this.fallDist = 0;
    } else {
      if (input.jump && this.onGround && !this.inWater && !this.inLava) {
        this.vel[1] = 0.42 + effectJumpBoost(this);
        if (this.sprinting) { this.vel[0] += -Math.sin(this.yaw) * 0.2; this.vel[2] += -Math.cos(this.yaw) * 0.2; this.exhaust(0.2); }
        else this.exhaust(0.05);
        this.jumpT = 0;
      }
      const wasGround = this.onGround;
      this.travel(fwd, str, sp, input.jump);
      // auto-jump: walking into a one-block step with room above jumps on its own
      // (not again while already going up: the tick after one it fired once more - up 1.67 blocks, over fences and walls,
      // "人能跳过栅栏", feedback 2026-11-01/02)
      if (this.game.settings.autoJump && wasGround && this.vel[1] <= 0 && this.collidedH && (input.fwd || input.strafe) && !this.sneaking && !this.inWater) {
        const yaw = this.yaw, dx = -Math.sin(yaw) * input.fwd + Math.cos(yaw) * input.strafe, dz = -Math.cos(yaw) * input.fwd - Math.sin(yaw) * input.strafe;
        const l = Math.hypot(dx, dz) || 1, r = this.w / 2 + 0.3;
        // (the layer the step is on, from feet that may stand high in their block - a dirt path or farmland is 15/16:
        // the block below the step was taken for the step and nothing jumped, players' feedback 2026-10-31)
        const bx = Math.floor(this.pos[0] + dx / l * r), bz = Math.floor(this.pos[2] + dz / l * r), by = Math.floor(this.pos[1] + 0.5);
        const solid = (y) => { const b = BLOCKS[this.world.getBlock(bx, y, bz)]; return b && b.solid; };
        // (only a step a jump clears - vanilla's auto-jump won't try a fence or wall, 1.5 high)
        blockBoxes(this.world, bx + 0.01, by + 0.01, bz + 0.01, bx + 0.99, by + 0.99, bz + 0.99, _boxes);
        let top = by; for (const b of _boxes) if (b[0] < bx + 1 && b[3] > bx && b[2] < bz + 1 && b[5] > bz) top = Math.max(top, b[4]);
        if (solid(by) && !solid(by + 1) && !solid(by + 2) && top <= by + 1.01) { this.vel[1] = 0.42; this.exhaust(0.05); }
      }
    }
    // walking distance & footsteps
    const dx = this.pos[0] - this.prev[0], dz = this.pos[2] - this.prev[2];
    if (this.sprinting && this.onGround && !this.inWater) {
      const bid = this.world.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1] - 0.2), Math.floor(this.pos[2]));
      if (bid && BLOCKS[bid].shape !== SH_LIQUID) this.game.particles.spawn('block', this.pos[0] + (Math.random() - 0.5) * 0.6, this.pos[1] + 0.1, this.pos[2] + (Math.random() - 0.5) * 0.6, -dx * 2, 0.15, -dz * 2, { id: bid, meta: this.world.getMeta(Math.floor(this.pos[0]), Math.floor(this.pos[1] - 0.2), Math.floor(this.pos[2])), tint: BLOCKS[bid].tint ? this.game.tintAt(Math.floor(this.pos[0]), Math.floor(this.pos[2]), BLOCKS[bid].tint) : null });
    }
    const dist = Math.hypot(dx, dz);
    if (this.onGround && !this.flying) {
      this.distWalked += dist;
      if (this.sprinting) this.exhaust(0.1 * dist);
      if (this.distWalked > 1.7 && !this.sneaking) {
        this.distWalked = 0;
        const id = this.world.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1] - 0.2), Math.floor(this.pos[2]));
        if (id && BLOCKS[id]) Sound.block('step', BLOCKS[id].sound, [this.pos[0], this.pos[1], this.pos[2]]);
      }
    } else if (this.inWater) {
      // vanilla: a swim sound every ~1 block moved through water
      this.swimDist = (this.swimDist || 0) + Math.hypot(dx, this.pos[1] - this.prev[1], dz);
      if (this.swimDist > 1.2) { this.swimDist = 0; Sound.ev('entity.player.swim', null, 0.35 * Math.min(1, Math.hypot(dx, dz) * 3 + 0.1), 1 + (Math.random() - Math.random()) * 0.4); }
    }
    // view bobbing
    this.prevBob = this.bob; this.prevBobAmt = this.bobAmt;
    const target = this.onGround && !this.flying ? Math.min(0.1, dist) : 0;
    this.bobAmt += (target - this.bobAmt) * 0.4;
    this.bob += dist;
    this.hungerTick();
    this.animate();
  }
}

// ---------------------------------------------------------------------------
// Mobs
// ---------------------------------------------------------------------------
// mobs at home in water (they don't avoid it)
const WATER_MOBS = /^(cod|salmon|pufferfish|tropical_fish|squid|glow_squid|dolphin|axolotl|turtle|frog|tadpole|drowned|guardian|elder_guardian|nautilus|zombie_nautilus)$/;
const MOB_TYPES = {
  pig: { cn: '猪', hp: 10, w: 0.9, h: 0.9, speed: 0.25, model: 'pig', passive: true, food: 'carrot', drops: [['porkchop', 1, 3, 'cooked_porkchop']], scale: 1 },
  cow: { cn: '牛', hp: 10, w: 0.9, h: 1.4, speed: 0.2, model: 'cow', passive: true, food: 'wheat', drops: [['beef', 1, 3, 'cooked_beef'], ['leather', 0, 2]], scale: 1 },
  sheep: { cn: '羊', hp: 8, w: 0.9, h: 1.3, speed: 0.23, model: 'sheep', passive: true, food: 'wheat', drops: [['mutton', 1, 2, 'cooked_mutton']], scale: 1 },
  chicken: { cn: '鸡', hp: 4, w: 0.4, h: 0.7, speed: 0.25, model: 'chicken', passive: true, food: 'wheat_seeds', drops: [['chicken', 1, 1, 'cooked_chicken'], ['feather', 0, 2]], scale: 1 },
  zombie: { cn: '僵尸', hp: 20, w: 0.6, h: 1.95, speed: 0.23, model: 'zombie', hostile: true, attack: 3, armor: 2, burns: true, drops: [['rotten_flesh', 0, 2]], scale: 0.9375 },
  skeleton: { cn: '骷髅', hp: 20, w: 0.6, h: 1.99, speed: 0.25, model: 'skeleton', hostile: true, burns: true, ranged: true, drops: [['bone', 0, 2], ['arrow', 0, 2]], scale: 0.9375 },
  creeper: { cn: '苦力怕', hp: 20, w: 0.6, h: 1.7, speed: 0.25, model: 'creeper', hostile: true, drops: [['gunpowder', 0, 2]], scale: 1 },
  spider: { cn: '蜘蛛', hp: 16, w: 1.4, h: 0.9, speed: 0.3, model: 'spider', hostile: true, attack: 2, climbs: true, drops: [['string', 0, 2]], scale: 1 },
};

class Mob extends Living {
  constructor(game, type, x, y, z) {
    const T = MOB_TYPES[type];
    super(game, x, y, z, T.w, T.h, T.hp);
    this.type = type; this.T = T;
    this.fireproof = !!T.fireproof;
    this.yaw = Math.random() * Math.PI * 2; this.bodyYaw = this.yaw;
    this.target = null; this.wander = null; this.wanderT = 0; this.panic = 0; this.attackCd = 0;
    this.fuse = -1; this.prevFuse = -1; this.sheared = false; this.woolColor = 0;
    this.persistent = !!T.passive;
    this.idleSound = 100 + Math.random() * 300;
    this.stuck = 0; this.eggT = 6000 + Math.random() * 6000;
    this.waterSpeed = 1.5;
    if (type === 'chicken') this.slowFall = true;
    if (type === 'sheep') { const r = Math.random(); this.woolColor = r < 0.05 ? 15 : r < 0.1 ? 7 : r < 0.15 ? 8 : r < 0.18 ? 12 : r < 0.182 ? 6 : 0; }
  }
  hurt(a, src) {
    // natural armour (vanilla's zombies 2): 4% less a point; breach on the attacker's mace takes 15% of it off a level
    if (this.T.armor && a > 0 && !(src && (src.type === 'void' || src.bypass))) {
      const br = src && src.attacker && src.attacker.inv && typeof enchLevel === 'function' ? enchLevel(src.attacker.inv.held, 'breach') : 0;
      a *= 1 - Math.min(20, this.T.armor) * Math.max(0, 1 - 0.15 * br) / 25;
    }
    const r = super.hurt(a, src);
    if (r) {
      // (the blow that kills: the death sound, like vanilla - it was the hurt sound again)
      Sound.mob(this.type, this.health <= 0 ? 'death' : 'hurt', this.pos);
      if (this.T.passive) this.panic = 100;
      if (src && src.attacker && !this.T.passive) this.target = src.attacker;
      if (this.type === 'spider' && src && src.attacker) this.target = src.attacker;
    }
    return r;
  }
  die(src) {
    super.die(src);
    if (src && (src.attacker === this.game.player || src.player)) this.game.stats.kills++;
    const r = Math.random;
    if (!this.baby) for (const [k, mn, mx, cooked] of this.T.drops) {
      const n = mn + Math.floor(r() * (mx - mn + 1)) + (src && src.looting ? Math.floor(r() * (src.looting + 1)) : 0);
      if (n > 0) this.game.dropItem(this.pos[0], this.pos[1] + 0.5, this.pos[2], makeStack(this.fire > 0 && cooked ? cooked : k, n));
    }
    if (this.type === 'sheep' && !this.sheared) this.game.dropItem(this.pos[0], this.pos[1] + 0.5, this.pos[2], makeStack(128 + this.woolColor, 1));
    if (this.type === 'creeper' && src && src.type === 'arrow' && Math.random() < 0.2) this.game.dropItem(this.pos[0], this.pos[1] + 0.5, this.pos[2], makeStack('tnt', 1));
    this.game.onMobKilled(this, src);
  }
  deathTick() {
    if (this.deathTime <= 0) return false;
    this.deathTime++;
    if (this.T.flying) this.move(0, -0.05, 0); else this.travel(0, 0, 0, false);
    if (this.deathTime > 20) {
      this.dead = true;
      for (let i = 0; i < 12; i++) this.game.particles.spawn('poof', this.pos[0] + (Math.random() - 0.5) * this.w, this.pos[1] + Math.random() * this.h, this.pos[2] + (Math.random() - 0.5) * this.w, (Math.random() - 0.5) * 0.1, Math.random() * 0.1, (Math.random() - 0.5) * 0.1);
      if (this.onRemoved) this.onRemoved();
    }
    return true;
  }
  tick() {
    this.savePrev();
    this.baseTick();
    if (this.deathTick()) return;
    const g = this.game, p = g.player, T = this.T;
    let fwd = 0, jump = false, mod = 1;
    let lookAt = null;
    const dP = this.distTo(p);
    const day = g.isDay();
    // despawn hostiles far away
    if (!this.persistent && (dP > 100 || (dP > 40 && this.age > 600 && Math.random() < 0.001))) { this.dead = true; return; }
    // burn in daylight
    if (T.burns && day && !this.inWater && this.age % 20 === 0) {
      const sky = this.world.skyAt(Math.floor(this.pos[0]), Math.floor(this.pos[1] + this.h), Math.floor(this.pos[2]));
      if (sky >= 15 && g.weather < 0.5) this.fire = Math.max(this.fire, 160);
    }
    if (dP < 32 && Sound.warmMob) Sound.warmMob(this.type);
    if (--this.idleSound < 0) { this.idleSound = 200 + Math.random() * 400; if (dP < 20) Sound.mob(this.type, 'idle', this.pos); }
    if (this.attackCd > 0) this.attackCd--;
    const playerOk = p.deathTime === 0 && !p.creative;
    if (T.hostile) {
      if (this.type === 'spider' && day && !this.target) { }
      else if (playerOk && dP < seenWithin(p, 16) && (!this.target || this.target === p)) this.target = p;
      if (this.target && (this.target.dead || this.target.deathTime > 0 || (this.target === p && (!playerOk || dP > 24)))) this.target = null;
      if (this.type === 'spider' && day && this.target && !this.provoked && this.age % 100 === 0) this.target = null;
    }
    if (this.target) {
      const t = this.target;
      const dx = t.pos[0] - this.pos[0], dz = t.pos[2] - this.pos[2], d = Math.hypot(dx, dz);
      const want = Math.atan2(-dx, -dz);
      lookAt = t;
      if (T.ranged) {
        this.turnTo(want, 0.3);
        if (d > 10) fwd = 1; else if (d < 5) fwd = -0.6;
        if (this.attackCd <= 0 && d < 16 && this.canSee(t)) { this.shoot(t); this.attackCd = 40 + Math.floor(Math.random() * 20); }
      } else if (this.type === 'creeper') {
        this.turnTo(want, 0.4);
        if (dP < 3 && this.canSee(t)) { if (this.fuse < 0) { this.fuse = 0; Sound.fuse(this.pos); } }
        else if (dP > 7 && this.fuse >= 0) this.fuse = Math.max(-1, this.fuse - 2);
        if (this.fuse < 0) fwd = 1;
      } else {
        this.turnTo(want, 0.4);
        fwd = 1;
        if (this.type === 'spider' && this.onGround && d < 4 && d > 1.5 && Math.random() < 0.1) { this.vel[1] = 0.4; this.vel[0] += dx / d * 0.3; this.vel[2] += dz / d * 0.3; }
        // (in height the two bodies must overlap, as vanilla's attack box: a mob is as tall as it stands - one jumping at
        // a pillar counts from where it jumped. A 3-high pillar is safe from an iron golem again: "铁傀儡跳起来打我")
        const reach = this.w / 2 + t.w / 2 + 0.6, base = Math.min(this.pos[1], this.jumpFromY ?? this.pos[1]);
        if (d < reach && t.pos[1] < base + this.h && t.pos[1] + t.h > base && this.attackCd <= 0) {
          this.attackCd = 20; this.swingT = 6;
          t.hurt(T.attack, { type: 'mob', attacker: this, knockFrom: this.pos });
        }
      }
    } else if (this.panic > 0) {
      this.panic--;
      mod = 1.6;
      if (!this.wander || this.wanderT <= 0 || this.age % 20 === 0) this.pickWander(6);
    } else {
      // follow player holding food
      const held = p.inv.held;
      if (T.passive && held && T.food && held.id === item(T.food) && dP < 8 && dP > 2) {
        lookAt = p;
        this.turnTo(Math.atan2(-(p.pos[0] - this.pos[0]), -(p.pos[2] - this.pos[2])), 0.3);
        fwd = 1;
      } else if (dP < 8 && Math.random() < 0.02) lookAt = p;
    }
    if (this.creeperTick()) return;
    // fallen in: make for dry land
    if (!this.target && this.inWater && this.landMob && !this.wander && this.age % 10 === 0) this.pickWander(12);
    if (!this.target && fwd === 0) {
      if (this.wander) {
        this.wanderT--;
        const dx = this.wander[0] - this.pos[0], dz = this.wander[2] - this.pos[2];
        if (Math.hypot(dx, dz) < 0.8 || this.wanderT <= 0) this.wander = null;
        else { this.turnTo(Math.atan2(-dx, -dz), 0.25); fwd = 1; }
      } else if (Math.random() < (this.panic > 0 ? 1 : 0.008)) this.pickWander(10);
    }
    // obstacle avoidance: don't walk off cliffs or into lava
    if (fwd > 0) {
      const ax = this.pos[0] - Math.sin(this.yaw) * (this.w / 2 + 0.5), az = this.pos[2] - Math.cos(this.yaw) * (this.w / 2 + 0.5);
      const fx = Math.floor(ax), fz = Math.floor(az), fy = Math.floor(this.pos[1]);
      let drop = 0;
      while (drop < 5 && !BLOCKS[this.world.getBlock(fx, fy - 1 - drop, fz)].solid && !IS_FLUID[this.world.getBlock(fx, fy - 1 - drop, fz)]) drop++;
      const danger = this.world.getBlock(fx, fy - 1 - drop, fz) === LAVA || this.world.getBlock(fx, fy, fz) === LAVA;
      // (on land, a land mob doesn't stroll into water; chasing something or following food it may)
      const wet = !this.target && this.landMob && !this.inWater && !!this.wander && (this.world.waterAt(fx, fy, fz) || this.world.waterAt(fx, fy - 1 - drop, fz));
      if (danger || wet || (drop > 3 && !this.target)) { fwd = 0; this.wander = null; }
      if (this.collidedH && this.onGround && !this.noJump) jump = true;
      if (this.collidedH && T.climbs) { this.vel[1] = 0.2; this.fallDist = 0; }
    }
    if (this.inWater && (this.vel[1] < 0.02 || this.collidedH)) jump = true;
    // stuck detection
    if (fwd > 0 && Math.hypot(this.pos[0] - this.prev[0], this.pos[2] - this.prev[2]) < 0.01) { if (++this.stuck > 30) { this.yaw += (Math.random() - 0.5) * 2; this.stuck = 0; this.wander = null; } }
    else this.stuck = 0;
    if (jump && this.onGround) { this.vel[1] = 0.42; this.jumpFromY = this.pos[1]; }
    else if (this.onGround) this.jumpFromY = undefined;
    const speed = T.speed * T.speed * mod * (this.fuse >= 0 ? 0.4 : 1);
    this.travel(fwd, 0, speed, jump);
    // body/head rotation
    let d = this.yaw - this.bodyYaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    this.bodyYaw += d * 0.3;
    if (lookAt) {
      const dx = lookAt.pos[0] - this.pos[0], dz = lookAt.pos[2] - this.pos[2];
      let hy = Math.atan2(-dx, -dz) - this.bodyYaw; while (hy > Math.PI) hy -= Math.PI * 2; while (hy < -Math.PI) hy += Math.PI * 2;
      this.headYaw += (clamp(hy, -1.2, 1.2) - this.headYaw) * 0.3;
      const dy = (lookAt.pos[1] + (lookAt.eyeH || 1)) - (this.pos[1] + this.h * 0.85);
      this.pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.8, 0.8);
    } else { this.headYaw *= 0.9; this.pitch *= 0.9; }
    // chickens lay eggs
    if (this.type === 'chicken' && --this.eggT < 0) { this.eggT = 6000 + Math.random() * 6000; this.game.dropItem(this.pos[0], this.pos[1] + 0.3, this.pos[2], makeStack('egg', 1)); Sound.pop(this.pos); }
    // sheep eat grass to regrow wool
    if (this.type === 'sheep' && this.sheared && Math.random() < 0.002) {
      const bx = Math.floor(this.pos[0]), by = Math.floor(this.pos[1] - 0.5), bz = Math.floor(this.pos[2]);
      if (this.world.getBlock(bx, by, bz) === 2) { this.world.setBlock(bx, by, bz, 3, 0); this.sheared = false; this.eatT = 40; }
    }
    if (this.eatT > 0) this.eatT--;
    if (this.loveT > 0) { this.loveT--; if (this.age % 10 === 0) this.game.particles.spawn('heart', this.pos[0] + (Math.random() - 0.5) * this.w, this.pos[1] + this.h, this.pos[2] + (Math.random() - 0.5) * this.w, 0, 0.02, 0); }
    if (this.baby && --this.growT <= 0) { this.baby = false; this.w = this.T.w; this.h = this.T.h; }
    if (this.swingT > 0) this.swingT--;
    this.animate();
  }
  makeBaby() { this.baby = true; this.growT = 6000; this.w = this.T.w * 0.5; this.h = this.T.h * 0.5; return this; }
  creeperTick() {
    if (this.type !== 'creeper' || this.fuse < 0) { this.prevFuse = this.fuse; return false; }
    this.prevFuse = this.fuse;
    this.fuse++;
    if (this.fuse >= 30) {
      this.dead = true;
      this.game.explode(this.pos[0], this.pos[1] + 0.8, this.pos[2], 3, this);
      return true;
    }
    return false;
  }
  turnTo(a, rate) {
    let d = a - this.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += clamp(d, -rate, rate);
  }
  // land mobs keep out of water (vanilla WaterAvoidingRandomStrollGoal / LandRandomPos): they stroll only to dry
  // ground - none found, they stay put - and one that fell in heads for the nearest dry ground; water mobs don't care
  get landMob() { return !WATER_MOBS.test(this.type || '') && !this.flies && !(typeof FlyingMob !== 'undefined' && this instanceof FlyingMob); }
  dryGround(x, y0, z) {
    const w = this.world, fx = Math.floor(x), fz = Math.floor(z);
    for (let y = y0 + 2; y >= y0 - 4; y--) {
      const b = BLOCKS[w.getBlock(fx, y - 1, fz)];
      if (!b || !b.solid || BLOCKS[w.getBlock(fx, y, fz)].solid) continue;
      return w.waterAt(fx, y, fz) || w.waterAt(fx, y - 1, fz) || w.getBlock(fx, y, fz) === LAVA ? null : y;
    }
    return null;
  }
  pickWander(r) {
    const land = this.landMob, y0 = Math.floor(this.pos[1]);
    for (let i = 0; i < (land ? 10 : 1); i++) {
      const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * r, x = this.pos[0] + Math.sin(a) * d, z = this.pos[2] + Math.cos(a) * d;
      const y = land ? this.dryGround(x, y0, z) : y0;
      if (y === null) continue;
      this.wander = [x, y, z]; this.wanderT = 120;
      return true;
    }
    return false;
  }
  canSee(t) {
    const a = [this.pos[0], this.pos[1] + this.h * 0.85, this.pos[2]], b = [t.pos[0], t.pos[1] + (t.eyeH || 1), t.pos[2]];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.ceil(d * 2);
    for (let i = 1; i < n; i++) {
      const k = i / n;
      const id = this.world.getBlock(Math.floor(lerp(a[0], b[0], k)), Math.floor(lerp(a[1], b[1], k)), Math.floor(lerp(a[2], b[2], k)));
      if (SOLIDCUBE[id]) return false;
    }
    return true;
  }
  shoot(t) {
    const sx = this.pos[0], sy = this.pos[1] + 1.5, sz = this.pos[2];
    const dx = t.pos[0] - sx, dz = t.pos[2] - sz, dist = Math.hypot(dx, dz);
    const dy = t.pos[1] + 1.2 - sy + dist * 0.2 * 0.5;
    const l = Math.hypot(dx, dy, dz);
    const sp = 1.6, err = 0.08;
    const a = new Arrow(this.game, sx, sy, sz, [dx / l * sp + (Math.random() - 0.5) * err, dy / l * sp + (Math.random() - 0.5) * err, dz / l * sp + (Math.random() - 0.5) * err], this);
    this.game.addEntity(a);
    Sound.bow(this.pos);
    this.swingT = 6;
  }
  pose(a) {
    const swing = lerp(this.limbSwing - this.limbAmt, this.limbSwing, a) * 0.6662, amt = this.limbAmt;
    const l = Math.cos(swing) * 1.4 * amt, r = Math.cos(swing + Math.PI) * 1.4 * amt;
    const P = { head: { ry: this.headYaw, rx: this.pitch } };
    switch (this.T.model) {
      case 'zombie': case 'skeleton': {
        const raise = this.type === 'zombie' ? Math.PI / 2 + Math.sin(this.age * 0.067) * 0.05 : (this.target ? Math.PI / 2 : 0);
        P.rarm = { rx: raise + (this.type === 'zombie' ? 0 : r * 0.5) + (this.swingT > 0 ? Math.sin(this.swingT / 6 * Math.PI) * 0.6 : 0) };
        P.larm = { rx: raise + (this.type === 'zombie' ? Math.sin(this.age * 0.067 + 1) * 0.05 : l * 0.5) };
        P.rleg = { rx: l }; P.lleg = { rx: r };
        break;
      }
      case 'creeper': P.leg0 = { rx: l }; P.leg1 = { rx: r }; P.leg2 = { rx: r }; P.leg3 = { rx: l }; break;
      case 'chicken': {
        P.leg0 = { rx: l }; P.leg1 = { rx: r };
        const flap = this.onGround ? 0 : Math.sin(this.age * 1.5) * 0.8 + 0.8;
        P.wing0 = { rz: -flap }; P.wing1 = { rz: flap };
        break;
      }
      case 'spider': {
        for (let i = 0; i < 8; i++) {
          const right = i % 2 === 0, row = i >> 1;
          const spread = [0.7, 0.3, -0.3, -0.7][row];
          const ph = Math.cos(swing * 2 + (row % 2 ? Math.PI : 0) + (right ? 0 : Math.PI)) * 0.4 * amt;
          P['leg' + i] = { ry: (right ? -spread : spread) + ph, rz: right ? -0.6 + Math.abs(ph) * 0.3 : 0.6 - Math.abs(ph) * 0.3 };
        }
        break;
      }
      default:
        P.leg0 = { rx: l }; P.leg1 = { rx: r }; P.leg2 = { rx: r }; P.leg3 = { rx: l };
        if (this.type === 'sheep' && this.eatT > 0) P.head.rx = -0.9;
    }
    return P;
  }
}
// vanilla Player.canBeSeenAsEnemy: a player in creative or spectator mode is no mob's enemy - nothing picks them out,
// hits back at them (wolves, bees, piglins, golems ...), or keeps chasing one who switched to creative
Object.defineProperty(Mob.prototype, 'target', {
  get() { const t = this._target; if (t instanceof Player && (t.creative || t.spectator)) { this._target = null; return null; } return t; },
  set(v) { this._target = v instanceof Player && (v.creative || v.spectator) ? null : (v || null); },
  configurable: true,
});

// ---------------------------------------------------------------------------
// Item entity
// ---------------------------------------------------------------------------
class ItemEntity extends Entity {
  constructor(game, x, y, z, stack, vel) {
    super(game, x, y, z, 0.25, 0.25);
    this.stack = stack; this.pickup = 10; this.bobOff = Math.random() * Math.PI * 2;
    if (vel) this.vel = vel; else this.vel = [(Math.random() - 0.5) * 0.2, 0.2, (Math.random() - 0.5) * 0.2];
  }
  tick() {
    this.savePrev();
    this.age++;
    if (this.pickup > 0) this.pickup--;
    this.updateFluids();
    const v = this.vel;
    // in water (deeper than 0.1 where it is): no gravity, a slight rise, a little drag (ItemEntity.setUnderwaterMovement)
    if (this.inWater && this.waterDepth() > 0.1) { v[0] *= 0.99; v[2] *= 0.99; if (v[1] < 0.06) v[1] += 5e-4; this.bubbleColumn(); }
    else { v[1] -= 0.04; if (this.inWater) this.bubbleColumn(); }
    if (this.collides(this.box())) { this.pos[1] += 0.1; v[1] = 0.1; }
    this.move(v[0], v[1], v[2]);
    const f = this.onGround ? 0.6 * 0.98 : 0.98;
    v[0] *= f; v[2] *= f; v[1] *= 0.98;
    if (this.onGround) v[1] *= -0.5;
    if (this.inLava) { this.dead = true; Sound.fizz(this.pos); return; }
    if (this.age > 6000) this.dead = true;
    // merge
    if (this.age % 20 === 0) {
      for (const e of this.game.entities) {
        if (e === this || !(e instanceof ItemEntity) || e.dead || !sameKind(e.stack, this.stack) || ITEMS[e.stack.id].durability) continue;
        if (this.distTo(e) < 1.2 && this.stack.count + e.stack.count <= maxStack(this.stack.id)) { this.stack.count += e.stack.count; e.dead = true; }
      }
    }
    // pickup
    const p = this.game.player;
    if (this.pickup <= 0 && p.deathTime === 0) {
      const b = p.box();
      if (this.pos[0] > b[0] - 1 && this.pos[0] < b[3] + 1 && this.pos[1] > b[1] - 0.5 && this.pos[1] < b[4] + 0.5 && this.pos[2] > b[2] - 1 && this.pos[2] < b[5] + 1) {
        const left = p.inv.add(this.stack);
        if (left < this.stack.count) {
          this.game.onPickup(this.stack.id, this.stack.count - left);
          Sound.pop(this.pos);
          this.game.particles.pickupAnim(this, p);
        }
        if (left === 0) this.dead = true; else this.stack.count = left;
      }
    }
  }
}

class FallingBlock extends Entity {
  constructor(game, x, y, z, id, meta) { super(game, x + 0.5, y, z + 0.5, 0.98, 0.98); this.blockId = id; this.meta = meta; }
  tick() {
    this.savePrev(); this.age++;
    this.vel[1] = (this.vel[1] - 0.04) * 0.98;
    this.move(0, this.vel[1], 0);
    if (this.onGround || this.age > 600) {
      this.dead = true;
      const x = Math.floor(this.pos[0]), z = Math.floor(this.pos[2]);
      // (a column falling together lands a little inside the one under it, which has just become a block: the cell
      // above then - before, the top one of three sand dropped as an item, "落下的沙子生成方块又掉一个")
      let y = Math.floor(this.pos[1] + 0.5);
      const free = (yy) => { const c = this.world.getBlock(x, yy, z); return c === 0 || REPLACEABLE[c]; };
      for (let k = 0; k < 8 && this.onGround && !free(y) && SOLIDCUBE[this.world.getBlock(x, y, z)]; k++) y++; // (not on a torch: that breaks it, as in vanilla)
      if (free(y)) { this.world.setBlock(x, y, z, this.blockId, this.meta); Sound.block('place', BLOCKS[this.blockId].sound, this.pos); }
      else this.game.dropItem(this.pos[0], this.pos[1], this.pos[2], makeStack(this.blockId, 1));
    }
  }
}

class PrimedTNT extends Entity {
  constructor(game, x, y, z, fuse = 80) {
    super(game, x + 0.5, y, z + 0.5, 0.98, 0.98);
    this.fuse = fuse;
    const a = Math.random() * Math.PI * 2;
    this.vel = [-Math.sin(a) * 0.02, 0.2, -Math.cos(a) * 0.02];
    Sound.fuse(this.pos);
  }
  tick() {
    this.savePrev(); this.age++;
    this.updateFluids();
    this.vel[1] -= 0.04;
    this.move(this.vel[0], this.vel[1], this.vel[2]);
    this.vel[0] *= 0.98; this.vel[1] *= 0.98; this.vel[2] *= 0.98;
    if (this.onGround) { this.vel[0] *= 0.7; this.vel[2] *= 0.7; this.vel[1] *= -0.5; }
    if (Math.random() < 0.5) this.game.particles.spawn('smoke', this.pos[0], this.pos[1] + 1.1, this.pos[2], 0, 0.02, 0);
    if (--this.fuse <= 0) { this.dead = true; this.game.explode(this.pos[0], this.pos[1] + 0.49, this.pos[2], 4, this, this.inWater); }
  }
}

class Arrow extends Entity {
  constructor(game, x, y, z, vel, shooter) {
    super(game, x, y, z, 0.5, 0.5);
    this.vel = vel; this.shooter = shooter; this.stuck = false; this.life = 0;
    this.fromPlayer = shooter === game.player;
    this.updateRot();
  }
  breakSnowball() {
    for (let i = 0; i < 8; i++) this.game.particles.spawn('block', this.pos[0], this.pos[1], this.pos[2], (Math.random() - 0.5) * 0.2, Math.random() * 0.2, (Math.random() - 0.5) * 0.2, { id: 1, layer: ITEMS[this.snowball].tex });
    if (ITEMS[this.snowball].key === 'egg' && Math.random() < 0.125) { const c = new Mob(this.game, 'chicken', this.pos[0], this.pos[1], this.pos[2]).makeBaby(); c.persistent = true; this.game.addEntity(c); }
  }
  updateRot() { const v = this.vel; this.yaw = Math.atan2(-v[0], -v[2]); this.pitch = Math.atan2(v[1], Math.hypot(v[0], v[2])); }
  tick() {
    this.savePrev(); this.age++;
    if (this.stuck) {
      if (++this.life > 1200) this.dead = true;
      if (this.world.getBlock(...this.stuckAt) === 0) { this.stuck = false; }
      if (this.fromPlayer && this.age > 10) {
        const p = this.game.player;
        // infinity / creative arrows can't be picked up (they go when touched in creative)
        if (this.distTo(p) < 1.5 && (this.noPickup ? p.creative : p.inv.add(this.stack ? { ...this.stack, count: 1 } : makeStack('arrow', 1)) === 0)) { this.dead = true; Sound.pop(this.pos); }
      }
      return;
    }
    const v = this.vel;
    const steps = Math.ceil(Math.hypot(v[0], v[1], v[2]) / 0.25);
    for (let i = 0; i < steps; i++) {
      const nx = this.pos[0] + v[0] / steps, ny = this.pos[1] + v[1] / steps, nz = this.pos[2] + v[2] / steps;
      // a block first, by its real shape (doors, panes, fences too): the arrow used to look for someone to hit before
      // the wall in between, and thin blocks didn't stop it - "骷髅的箭穿过门/墙射到我", feedback 2026-11-01/02
      {
        blockBoxes(this.world, nx - 0.02, ny - 0.02, nz - 0.02, nx + 0.02, ny + 0.02, nz + 0.02, _boxes);
        const inBox = _boxes.some((b) => nx > b[0] && nx < b[3] && ny > b[1] && ny < b[4] && nz > b[2] && nz < b[5]);
        const bid = this.world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
        if (inBox && bid && !IS_FLUID[bid]) {
          if (this.snowball) { this.breakSnowball(); this.dead = true; return; }
          this.stuck = true; this.stuckAt = [Math.floor(nx), Math.floor(ny), Math.floor(nz)];
          Sound.arrowHit(this.pos);
          return;
        }
      }
      // entity hit
      for (const e of this.game.entities.concat([this.game.player])) {
        if (e === this.shooter || e === this || e.dead || (!(e instanceof Living) && !e.hittable) || e.deathTime > 0) continue;
        const parts = e.parts ? e.parts() : [{ box: e.box() }];
        const part = parts.find(pt => { const b = pt.box; return nx > b[0] - 0.15 && nx < b[3] + 0.15 && ny > b[1] && ny < b[4] && nz > b[2] - 0.15 && nz < b[5] + 0.15; });
        if (part) {
          if (this.hitSet && this.hitSet.has(e)) continue;
          // a trident does 8 (impaling more on mobs in water); arrows by their speed
          let dmg = this.snowball ? (e.type === 'blaze' ? 3 : 0) : Math.ceil(Math.hypot(v[0], v[1], v[2]) * (this.baseDmg || 2));
          if (this.trident) dmg = 8 + (e.inWater ? 2.5 * enchLevel(this.stack, 'impaling') : 0);
          if (this.fire > 0 && !this.snowball && !e.fireproof && e instanceof Living) e.fire = Math.max(e.fire || 0, 100);
          if (this.snowball) { this.breakSnowball(); }
          if (e.parts) { e.hurtPart(part, dmg, { type: 'arrow', attacker: this.shooter, player: this.fromPlayer }); Sound.arrowHit(this.pos); this.dead = true; return; }
          const hit = e.hurt(dmg, { type: this.trident ? 'trident' : 'arrow', attacker: this.shooter, knockFrom: [this.pos[0] - v[0], 0, this.pos[2] - v[2]], knock: 0.3 + (this.punch || 0) * 0.6, player: this.fromPlayer,
            fire: this.fire > 0 && !this.snowball, speed2: v[0] * v[0] + v[1] * v[1] + v[2] * v[2] });
          if (hit && e.addEffect) {
            // tipped arrows: their potion for an eighth of the time; spectral arrows: glowing
            if (this.tip && this.tip.pot && typeof POTIONS !== 'undefined') for (const [k, t, amp] of POTIONS[this.tip.pot] || []) { if (k === 'instant_health' || k === 'instant_damage') e.addEffect(k, amp, 1); else if (t / 8 >= 1) e.addEffect(k, amp, Math.floor(t / 8)); }
            if (this.tip && ITEMS[this.tip.id].key === 'spectral_arrow') e.addEffect('glowing', 0, 200);
          }
          if (hit && this.onHit) this.onHit(e);
          Sound.arrowHit(this.pos);
          (this.hitSet || (this.hitSet = new Set())).add(e);
          if (this.trident) return; // it bounces off and falls
          if (this.pierce > 0) { this.pierce--; continue; }
          this.dead = true; return;
        }
      }
      const bx = Math.floor(nx), by = Math.floor(ny), bz = Math.floor(nz);
      const id = this.world.getBlock(bx, by, bz);
      if (id && BLOCKS[id].solid) {
        if (this.snowball) { this.breakSnowball(); this.dead = true; return; }
        this.stuck = true; this.stuckAt = [bx, by, bz];
        if (id === 26 && this.shooter && this.shooter.fire > 0) { }
        Sound.arrowHit(this.pos);
        return;
      }
      this.pos[0] = nx; this.pos[1] = ny; this.pos[2] = nz;
    }
    this.updateFluids();
    const drag = this.inWater ? 0.6 : 0.99;
    v[0] *= drag; v[1] = v[1] * drag - 0.05; v[2] *= drag;
    this.updateRot();
    if (this.age > 400) this.dead = true;
  }
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------
class Particles {
  constructor(game) { this.game = game; this.list = []; this.pickups = []; this.max = 3000; }
  spawn(type, x, y, z, vx, vy, vz, extra) {
    if (this.list.length >= this.max) return;
    const p = { type, x, y, z, px: x, py: y, pz: z, vx, vy, vz, age: 0, life: 20, size: 0.1, grav: 0, layer: 0, u0: 0, v0: 0, us: 1, col: [255, 255, 255], bright: false, frames: 0, base: 0 };
    const r = Math.random;
    switch (type) {
      case 'block': {
        const b = BLOCKS[extra.id];
        p.layer = extra.layer ?? (b.texFn ? b.texFn.call(b, 0, extra.meta || 0) : b.particle);
        p.us = 0.25; p.u0 = r() * 0.75; p.v0 = r() * 0.75;
        p.life = 4 / (r() * 0.9 + 0.1); p.grav = 0.04; p.size = 0.05 + r() * 0.05;
        if (b.tint) { const t = extra.tint || [124, 189, 107]; p.col = t; }
        break;
      }
      case 'smoke': p.frames = 12; p.base = T('p_big_smoke_0'); p.life = 20 + r() * 20; p.size = 0.15 + r() * 0.15; p.grav = -0.002; p.col = [80, 80, 80]; break;
      case 'poof': p.frames = 8; p.base = T('p_generic_0'); p.life = 16 + r() * 8; p.size = 0.15 + r() * 0.1; p.col = [230, 230, 230]; p.reverse = true; break;
      case 'explosion': p.frames = 16; p.base = T('p_explosion_0'); p.life = 8 + r() * 8; p.size = 1 + r() * 0.8; p.bright = true; break;
      case 'flame': p.layer = T('p_flame'); p.life = 10 + r() * 10; p.size = 0.06 + r() * 0.04; p.bright = true; break;
      case 'lava': p.layer = T('p_lava'); p.life = 30; p.size = 0.08; p.grav = 0.04; p.bright = true; break;
      case 'splash': p.layer = T('p_splash_' + (r() * 4 | 0)); p.life = 10; p.size = 0.08; p.grav = 0.04; p.col = [80, 120, 230]; break;
      case 'bubble': p.layer = T('p_bubble'); p.life = 20 + r() * 20; p.size = 0.05; p.grav = -0.01; break;
      // the sword's sweep (vanilla AttackSweepParticle: 4 ticks, grey), soul speed's souls rising off the sand
      case 'sweep': { p.frames = 8; p.base = T('p_sweep_0'); p.life = 4; p.size = 1; p.grav = 0; const c = 150 + r() * 100 | 0; p.col = [c, c, c]; p.bright = true; break; }
      case 'soul': p.frames = 11; p.base = T('p_soul_0'); p.life = 22; p.size = 0.12; p.grav = -0.002; p.bright = true; break;
      case 'crit': p.layer = T('p_critical_hit'); p.life = 12; p.size = 0.08; p.grav = 0.02; p.bright = true; break;
      case 'heart': p.layer = T('p_heart'); p.life = 20; p.size = 0.15; p.grav = -0.005; p.bright = true; break;
      case 'happy_villager': p.layer = T('p_glint'); p.life = 20; p.size = 0.1; p.grav = -0.002; p.bright = true; break;
      case 'note': p.layer = T('p_note'); p.life = 20; p.size = 0.15; p.bright = true; p.col = extra.col; break;
      case 'damage': p.layer = T('p_damage'); p.life = 15; p.size = 0.1; p.grav = 0.02; break;
      case 'glint': p.layer = T('p_glint'); p.life = 20; p.size = 0.08; p.bright = true; break;
      // potion swirls round whoever has an effect, and splash potions' burst (vanilla SpellParticle: 8-40 ticks, the
      // sprite running through the effect frames, in the effects' colour). Missing, they came out as layer 0 - stone
      case 'effect': p.frames = 3; p.base = T('p_effect_0'); p.life = Math.floor(8 / (r() * 0.8 + 0.2)); p.size = 0.06 + r() * 0.04; p.col = extra.col || [255, 255, 255]; break;
      case 'bone_meal': p.layer = T('p_effect_' + (r() * 3 | 0)); p.life = 20; p.size = 0.08; p.col = [120, 220, 90]; p.bright = true; break;
      case 'rain': p.layer = T('p_splash_' + (r() * 4 | 0)); p.life = 6; p.size = 0.06; p.grav = 0.04; p.col = [100, 140, 230]; break;
      case 'portal': p.frames = 8; p.base = T('p_generic_0'); p.life = 30 + r() * 20; p.size = 0.06 + r() * 0.05; p.reverse = true; p.bright = true; { const k = r() * 0.6 + 0.4; p.col = [Math.round(230 * k), Math.round(80 * k), 255]; } p.vx *= 0.5; p.vy = p.vy * 0.5 - 0.01; p.vz *= 0.5; break;
      case 'breath': p.frames = 8; p.base = T('p_generic_0'); p.life = 20 + r() * 20; p.size = 0.12 + r() * 0.08; p.reverse = true; p.bright = true; p.col = [200, 60 + r() * 60 | 0, 255]; break;
    }
    this.list.push(p);
    return p;
  }
  blockBreak(x, y, z, id, meta) {
    const tint = BLOCKS[id].tint ? this.game.tintAt(x, z, BLOCKS[id].tint) : null;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) {
      const px = x + (i + 0.5) / 4, py = y + (j + 0.5) / 4, pz = z + (k + 0.5) / 4;
      this.spawn('block', px, py, pz, (px - x - 0.5) * 0.3 + (Math.random() - 0.5) * 0.05, (py - y - 0.5) * 0.3 + Math.random() * 0.1, (pz - z - 0.5) * 0.3, { id, meta, tint });
    }
  }
  blockHit(x, y, z, face, id, meta) {
    const D = DIRS[face];
    const px = x + 0.5 + D[0] * 0.52 + (D[0] ? 0 : (Math.random() - 0.5) * 0.9);
    const py = y + 0.5 + D[1] * 0.52 + (D[1] ? 0 : (Math.random() - 0.5) * 0.9);
    const pz = z + 0.5 + D[2] * 0.52 + (D[2] ? 0 : (Math.random() - 0.5) * 0.9);
    const tint = BLOCKS[id].tint ? this.game.tintAt(x, z, BLOCKS[id].tint) : null;
    this.spawn('block', px, py, pz, D[0] * 0.05, 0.05 + D[1] * 0.05, D[2] * 0.05, { id, meta, tint });
  }
  pickupAnim(e, p) { this.pickups.push({ stack: { ...e.stack }, from: [...e.pos], t: 0, target: p }); }
  tick() {
    const w = this.game.world;
    for (const p of this.list) {
      p.px = p.x; p.py = p.y; p.pz = p.z;
      p.age++;
      p.vy -= p.grav;
      let nx = p.x + p.vx, ny = p.y + p.vy, nz = p.z + p.vz;
      if (p.grav > 0) {
        const id = w.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
        if (id && SOLIDCUBE[id]) { if (p.vy < 0) { ny = p.y; p.vy = 0; p.vx *= 0.7; p.vz *= 0.7; } else { nx = p.x; nz = p.z; } }
      }
      p.x = nx; p.y = ny; p.z = nz;
      p.vx *= 0.98; p.vy *= 0.98; p.vz *= 0.98;
      if (p.type === 'smoke' || p.type === 'explosion') { p.vx *= 0.9; p.vz *= 0.9; }
      if (p.type === 'bubble' && w.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) !== WATER) p.age = p.life;
      if (p.type === 'lava' && Math.random() < 0.1) this.spawn('smoke', p.x, p.y, p.z, 0, 0.01, 0);
      if (p.age % 4 === 1) p.light = w.getLight(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
    }
    this.list = this.list.filter(p => p.age < p.life);
    for (const q of this.pickups) q.t++;
    this.pickups = this.pickups.filter(q => q.t < 3);
  }
  // build billboard quads into a MeshBuffer
  build(mb, a, cam, right, up) {
    mb.reset();
    for (const p of this.list) {
      const x = lerp(p.px, p.x, a), y = lerp(p.py, p.y, a), z = lerp(p.pz, p.z, a);
      let layer = p.layer;
      if (p.frames) {
        const f = Math.min(p.frames - 1, Math.floor((p.age + a) / p.life * p.frames));
        layer = p.base + (p.reverse ? p.frames - 1 - f : f);
      }
      const s = p.size;
      const rx = right[0] * s, ry = right[1] * s, rz = right[2] * s, ux = up[0] * s, uy = up[1] * s, uz = up[2] * s;
      const l = p.light ?? 0xF0;
      const sky = p.bright ? 255 : (l >> 4) * 17, blk = p.bright ? 255 : (l & 15) * 17;
      const u0 = p.u0, v0 = p.v0, u1 = u0 + p.us, v1 = v0 + p.us;
      const c = p.col;
      mb.v(x - rx - ux, y - ry - uy, z - rz - uz, u0, v1, layer, 0, c[0], c[1], c[2], 255, sky, blk, 0);
      mb.v(x + rx - ux, y + ry - uy, z + rz - uz, u1, v1, layer, 0, c[0], c[1], c[2], 255, sky, blk, 0);
      mb.v(x + rx + ux, y + ry + uy, z + rz + uz, u1, v0, layer, 0, c[0], c[1], c[2], 255, sky, blk, 0);
      mb.v(x - rx + ux, y - ry + uy, z - rz + uz, u0, v0, layer, 0, c[0], c[1], c[2], 255, sky, blk, 0);
    }
  }
}

// ---- experience orbs (vanilla ExperienceOrb) -------------------------------------------------------
const XP_SIZES = [2477, 1237, 617, 307, 149, 73, 37, 17, 7, 3, 1];
class ExperienceOrb extends Entity {
  constructor(game, x, y, z, value) {
    super(game, x, y, z, 0.5, 0.5);
    this.value = value;
    this.vel = [(Math.random() * 0.2 - 0.1) * 2, Math.random() * 0.2 * 2, (Math.random() * 0.2 - 0.1) * 2];
    this.icon = value >= 2477 ? 10 : value >= 1237 ? 9 : value >= 617 ? 8 : value >= 307 ? 7 : value >= 149 ? 6 : value >= 73 ? 5 : value >= 37 ? 4 : value >= 17 ? 3 : value >= 7 ? 2 : value >= 3 ? 1 : 0;
  }
  tick() {
    this.savePrev(); this.age++;
    this.updateFluids();
    const v = this.vel, g = this.game, p = g.player;
    if (this.inWater) { v[0] *= 0.99; v[2] *= 0.99; if (v[1] < 0.06) v[1] += 5e-4; }
    else v[1] -= 0.03;
    if (this.inLava) { v[1] = 0.2; v[0] = (Math.random() - Math.random()) * 0.2; v[2] = (Math.random() - Math.random()) * 0.2; }
    if (this.collides(this.box())) { this.pos[1] += 0.1; v[1] = 0.1; }
    // drift toward the player within 8 blocks
    if (p.deathTime === 0 && g.mode !== 'spectator') {   // (creative players too, like vanilla: players' feedback 2026-10-31)
      const dx = p.pos[0] - this.pos[0], dy = p.pos[1] + p.eye() / 2 - this.pos[1], dz = p.pos[2] - this.pos[2];
      const l = Math.hypot(dx, dy, dz);
      if (l < 8) { let d = 1 - l / 8; d *= d; v[0] += dx / l * d * 0.1; v[1] += dy / l * d * 0.1; v[2] += dz / l * d * 0.1; }
    }
    this.move(v[0], v[1], v[2]);
    const f = this.onGround ? 0.6 * 0.98 : 0.98;
    v[0] *= f; v[1] *= 0.98; v[2] *= f;
    if (this.onGround) v[1] *= -0.9;
    if (this.age >= 6000) { this.dead = true; return; }
    // pick-up: one orb every 2 ticks
    if (p.deathTime === 0 && g.mode !== 'spectator' && (p.xpDelay || 0) <= 0) {
      const b = p.box();
      if (this.pos[0] > b[0] - 0.25 && this.pos[0] < b[3] + 0.25 && this.pos[1] > b[1] - 0.25 && this.pos[1] < b[4] + 0.25 && this.pos[2] > b[2] - 0.25 && this.pos[2] < b[5] + 0.25) {
        p.xpDelay = 2;
        Sound.ev('entity.experience_orb.pickup', null, 0.1, (Math.random() - Math.random()) * 0.35 + 0.9);
        let xp = this.value;
        const mend = [p.inv.sel, 36, 37, 38, 39, 40].map(i => p.inv.slots[i]).filter(s => s && s.dmg > 0 && enchLevel(s, 'mending'));
        if (mend.length) { const s = mend[Math.floor(Math.random() * mend.length)], r = Math.min(xp * 2, s.dmg); s.dmg -= r; xp -= Math.ceil(r / 2); }
        if (xp > 0) g.addXp(xp);
        this.dead = true;
      }
    }
  }
}
