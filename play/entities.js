'use strict';
// ── items + pixel icons ──────────────────────────────
function icon(draw) { return px(x => { x.clearRect(0, 0, 16, 16); draw(x); }); }
const dots = (x, c, pts) => { x.fillStyle = c; pts.forEach(([a, b, w = 1, h = 1]) => x.fillRect(a, b, w, h)); };
const diag = (x, c, x0, y0, n, w = 1) => { x.fillStyle = c; for (let i = 0; i < n; i++) x.fillRect(x0 + i, y0 - i, w, w); };
const blockIcon = c => icon(x => {
  x.drawImage(c, 0, 0, 16, 16, 2, 2, 12, 12);
  x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(2, 12, 12, 2); x.fillRect(12, 2, 2, 12);
  x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(2, 2, 12, 1);
});
const ICONS = {
  sword: icon(x => { diag(x, '#1b6fa8', 3, 13, 11, 2); diag(x, '#8be1ff', 4, 12, 10); diag(x, '#d8f6ff', 5, 10, 8); dots(x, '#3a2414', [[1, 13, 3, 2], [2, 12, 2, 1]]); dots(x, '#2fb4ff', [[2, 10, 2, 2], [5, 13, 2, 2], [4, 11, 1, 1]]); }),
  axe: icon(x => { diag(x, '#6b4422', 2, 14, 12); diag(x, '#8a5a2c', 3, 14, 11); dots(x, '#5fd2e6', [[8, 2, 5, 2], [7, 4, 6, 2], [9, 6, 4, 2], [11, 8, 2, 1]]); dots(x, '#bff6ff', [[9, 3, 3, 1], [8, 5, 2, 1]]); }),
  pickaxe: icon(x => { diag(x, '#6b4422', 2, 14, 11); diag(x, '#8a5a2c', 3, 14, 10); dots(x, '#5fd2e6', [[5, 2, 6, 2], [3, 3, 2, 2], [11, 3, 2, 2], [12, 5, 2, 3], [2, 5, 2, 3]]); dots(x, '#bff6ff', [[6, 2, 4, 1]]); }),
  wool: blockIcon(CV.wool), planks: blockIcon(CV.planks), dirt: blockIcon(CV.dirt), stone: blockIcon(CV.stone), endstone: blockIcon(CV.endstone),
  web: icon(x => x.drawImage(CV.web, 0, 0)),
  gapple: icon(x => { dots(x, '#6b4422', [[8, 1, 1, 3]]); dots(x, '#3fae3f', [[9, 2, 3, 2]]); dots(x, '#e8b923', [[4, 4, 8, 10], [3, 6, 10, 6], [5, 14, 6, 1]]); dots(x, '#ffe680', [[5, 5, 2, 3]]); dots(x, '#b8860b', [[11, 8, 1, 4], [9, 13, 2, 1]]); }),
  soup: icon(x => { dots(x, '#7a4a2a', [[2, 8, 12, 2], [3, 10, 10, 2], [4, 12, 8, 1]]); dots(x, '#c9935c', [[3, 7, 10, 1]]); dots(x, '#d8434a', [[5, 6, 2, 1], [9, 6, 2, 1]]); dots(x, '#e9d6b5', [[7, 6, 2, 1]]); }),
  bowl: icon(x => { dots(x, '#7a4a2a', [[2, 8, 12, 2], [3, 10, 10, 2], [4, 12, 8, 1]]); dots(x, '#5a341c', [[3, 7, 10, 1]]); }),
  potion: icon(x => { dots(x, '#cfd8dc', [[7, 2, 2, 3]]); dots(x, '#8d6e63', [[7, 1, 2, 1]]); dots(x, '#f04848', [[5, 6, 6, 7], [4, 8, 8, 4], [6, 13, 4, 1]]); dots(x, '#ff9a9a', [[6, 7, 1, 3]]); dots(x, '#cfd8dc', [[5, 5, 6, 1]]); }),
  pearl: icon(x => { dots(x, '#0f5e5a', [[5, 4, 6, 8], [4, 5, 8, 6]]); dots(x, '#2fd3c0', [[6, 5, 4, 6], [5, 6, 6, 4]]); dots(x, '#bfffff', [[6, 6, 2, 1]]); }),
  flesh: icon(x => { dots(x, '#8e4b3a', [[3, 5, 10, 6], [5, 4, 6, 8]]); dots(x, '#5b7a3a', [[6, 6, 2, 2], [9, 8, 2, 1]]); }),
  stick: icon(x => { diag(x, '#6b4422', 4, 13, 9); diag(x, '#8a5a2c', 5, 13, 8); }),
  potato: icon(x => { dots(x, '#a6a63a', [[4, 5, 8, 7], [5, 4, 6, 9]]); dots(x, '#6f8a2a', [[6, 6, 1, 1], [9, 9, 1, 1], [7, 10, 1, 1]]); }),
};
const ITEMS = {
  sword: { name: 'Ethane Sword', kind: 'sword', dmg: 7, speed: 1.6, max: 1 },
  axe: { name: 'Diamond Axe', kind: 'axe', dmg: 9, speed: .9, max: 1 },
  pickaxe: { name: 'Diamond Pickaxe', kind: 'pickaxe', dmg: 5, speed: 1.2, max: 1 },
  wool: { name: 'Ethane Wool', block: 'wool', max: 64 },
  planks: { name: 'Oak Planks', block: 'planks', max: 64 },
  dirt: { name: 'Dirt', block: 'dirt', max: 64, junk: true },
  web: { name: 'Cobweb', block: 'web', max: 64 },
  gapple: { name: 'Golden Apple', food: 32, max: 64 },
  soup: { name: 'Mushroom Stew', food: 32, max: 1 },
  bowl: { name: 'Bowl', max: 64, junk: true },
  potion: { name: 'Splash Potion of Healing', throwable: true, max: 1 },
  pearl: { name: 'Ender Pearl', throwable: true, max: 16 },
  flesh: { name: 'Rotten Flesh', max: 64, junk: true },
  stick: { name: 'Stick', max: 64, junk: true },
  potato: { name: 'Poisonous Potato', max: 64, junk: true },
};
const S = (id, count = 1) => ({ id, count });
function defaultInventory() {
  const inv = new Array(36).fill(null);
  [S('sword'), S('axe'), S('pickaxe'), S('wool', 64), S('gapple', 16), S('soup'), S('potion'), S('pearl', 16), S('web', 16)].forEach((s, i) => inv[i] = s);
  const main = [S('soup'), S('soup'), S('soup'), S('flesh', 7), S('potion'), S('potion'), S('potion'), S('dirt', 23), S('wool', 64),
    S('soup'), S('stick', 3), S('wool', 64), S('planks', 64), S('potato', 2), S('soup'), S('potion')];
  main.forEach((s, i) => inv[9 + i * 1 + (i > 8 ? 1 : 0)] = s);
  return inv;
}
const iconTex = {};
const getIconTex = id => iconTex[id] || (iconTex[id] = (() => { const t = tex(ICONS[id]); return t; })());

// ── humanoid model (32px tall = 1.8 blocks) ──────────
const PXU = 1.8 / 32;
function faceCanvas(hair, skin, eye) {
  return px(x => {
    x.fillStyle = skin; x.fillRect(0, 0, 8, 8);
    x.fillStyle = hair; x.fillRect(0, 0, 8, 2); x.fillRect(0, 2, 1, 1); x.fillRect(7, 2, 1, 1);
    x.fillStyle = '#fff'; x.fillRect(1, 4, 2, 1); x.fillRect(5, 4, 2, 1);
    x.fillStyle = eye; x.fillRect(2, 4, 1, 1); x.fillRect(5, 4, 1, 1);
    x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(3, 6, 2, 1);
  }, 8);
}
const SKINS = {
  player: { skin: '#c99a73', shirt: '#1f6fd0', pants: '#24305e', hair: '#2a1a10', eye: '#2fb4ff' },
  dummy: { skin: '#d9b48f', shirt: '#9c9c9c', pants: '#5e5e5e', hair: '#6b4a2b', eye: '#333' },
  fighter: { skin: '#b07c57', shirt: '#9e2b2b', pants: '#2d2d2d', hair: '#120c08', eye: '#c00' },
  strafer: { skin: '#e0b48d', shirt: '#2b9e5a', pants: '#2b3d6b', hair: '#d9a441', eye: '#2a6' },
  lagger: { skin: '#c99a73', shirt: '#7a3fbf', pants: '#2a2a44', hair: '#000', eye: '#a5f' },
  bot: { skin: '#c99a73', shirt: '#d98b1f', pants: '#3a3a3a', hair: '#3b2614', eye: '#333' },
  shield: { skin: '#d9b48f', shirt: '#4a6fa5', pants: '#31406b', hair: '#5a3a1e', eye: '#335' },
  ghost: { skin: '#cfe8ff', shirt: '#8fb7ff', pants: '#6b8bd6', hair: '#fff', eye: '#00f' },
};
function makeHumanoid(skinName) {
  const s = SKINS[skinName], g = new THREE.Group(), mats = [];
  const L = (c, extra) => { const m = new THREE.MeshLambertMaterial({ color: c, ...extra }); mats.push(m); return m; };
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w * PXU, h * PXU, d * PXU), m);
  const part = (mesh, px_, py, pz, oy) => { const p = new THREE.Group(); p.position.set(px_ * PXU, py * PXU, pz * PXU); mesh.position.y = oy * PXU; p.add(mesh); g.add(p); return p; };
  const face = L('#fff', { map: tex(faceCanvas(s.hair, s.skin, s.eye)) }), skinM = L(s.skin), hairM = L(s.hair);
  const head = part(box(8, 8, 8, [skinM, skinM, hairM, skinM, skinM, face]), 0, 24, 0, 4);
  const body = part(box(8, 12, 4, L(s.shirt)), 0, 12, 0, 6);
  const shirtArm = L(s.shirt);
  const arm = (side) => { const p = part(box(4, 12, 4, [skinM, skinM, shirtArm, skinM, skinM, skinM]), side * 6, 22, 0, -4); return p; };
  const armL = arm(-1), armR = arm(1);
  const pm = L(s.pants);
  const legL = part(box(4, 12, 4, pm), -2, 12, 0, -6), legR = part(box(4, 12, 4, pm), 2, 12, 0, -6);
  const root = new THREE.Group(); root.add(g);
  return { root, g, head, body, armL, armR, legL, legR, mats };
}
function setTint(model, r) { model.mats.forEach(m => m.emissive.setRGB(r * .7, 0, 0)); }

// ── particles ────────────────────────────────────────
const Particles = (() => {
  const N = 2500, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N), grav = new Float32Array(N);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: .09, vertexColors: true, transparent: true, depthWrite: false }));
  pts.frustumCulled = false; scene.add(pts);
  let head = 0; life.fill(0); for (let i = 0; i < N; i++) pos[i * 3 + 1] = -999;
  return {
    pts,
    spawn(x, y, z, c, n = 8, spd = .15, gr = .02, lf = 18) {
      const cc = new THREE.Color(c);
      for (let k = 0; k < n; k++) {
        const i = head = (head + 1) % N;
        pos.set([x + rand(-.15, .15), y + rand(-.15, .15), z + rand(-.15, .15)], i * 3);
        vel.set([rand(-1, 1) * spd, rand(-.3, 1) * spd, rand(-1, 1) * spd], i * 3);
        col.set([cc.r * rand(.8, 1.1), cc.g * rand(.8, 1.1), cc.b * rand(.8, 1.1)], i * 3); life[i] = lf * rand(.6, 1.2); grav[i] = gr;
      }
    },
    tick() {
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue;
        life[i]--; if (life[i] <= 0) { pos[i * 3 + 1] = -999; continue; }
        pos[i * 3] += vel[i * 3]; pos[i * 3 + 1] += vel[i * 3 + 1]; pos[i * 3 + 2] += vel[i * 3 + 2];
        vel[i * 3 + 1] -= grav[i]; vel[i * 3] *= .92; vel[i * 3 + 2] *= .92;
      }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    },
  };
})();

// ── living entities ──────────────────────────────────
class Living {
  constructor(o) {
    this.pos = o.pos.clone(); this.prev = this.pos.clone(); this.vel = new THREE.Vector3();
    this.yaw = o.yaw || 0; this.prevYaw = this.yaw; this.pitch = 0; this.bodyYaw = this.yaw;
    this.hw = .3; this.h = 1.8; this.maxHealth = 20; this.health = o.health || 20;
    this.hurtTime = 0; this.invul = 0; this.lastDmg = 0; this.onGround = false; this.fallDist = 0;
    this.limb = 0; this.limbAmp = 0; this.swing = 0; this.sinceHurt = 999; this.alive = true; this.deathTime = 0;
  }
  box(p = this.pos) { return [p.x - this.hw, p.y, p.z - this.hw, p.x + this.hw, p.y + this.h, p.z + this.hw]; }
  get eye() { return new THREE.Vector3(this.pos.x, this.pos.y + this.h * .9, this.pos.z); }
  center(p = this.pos) { return new THREE.Vector3(p.x, p.y + this.h / 2, p.z); }
}
class NPC extends Living {
  constructor(o) {
    super(o);
    Object.assign(this, { skin: o.skin, kind: o.kind, name: o.name, anchor: o.pos.clone(), startHealth: o.health || 20, regen: o.regen !== false, invisible: !!o.invisible });
    this.model = makeHumanoid(o.skin); scene.add(this.model.root);
    this.tag = textSprite([o.name], { size: 40, bg: 'rgba(0,0,0,.35)', font: "'VT323', monospace", weight: 400, scale: .0052 });
    scene.add(this.tag);
    this.hist = [];       // past positions for Backtrack
    this.t = Math.random() * 100; this.dir = 1; this.attackCd = 20; this.shieldDown = 0; this.blocking = o.kind === 'shield';
    if (o.kind === 'shield') {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(.6, .8, .06), new THREE.MeshLambertMaterial({ color: 0x8a6a3a }));
      const face = new THREE.Mesh(new THREE.BoxGeometry(.5, .7, .07), new THREE.MeshLambertMaterial({ color: 0x2fb4ff }));
      sh.add(face); this.shield = sh; this.model.armL.add(sh); sh.position.set(-.05, -.45, -.25); sh.rotation.y = .2;
    }
    if (o.kind === 'fighter') {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, .9), new THREE.MeshLambertMaterial({ color: 0x8be1ff, emissive: 0x0b3a55 }));
      sw.position.set(0, -.62, -.35); this.model.armR.add(sw);
    }
    this.model.mats.forEach(m => { m.transparent = true; });
  }
  respawn() {
    this.pos.copy(this.anchor); this.prev.copy(this.pos); this.vel.set(0, 0, 0);
    this.health = this.startHealth; this.alive = true; this.deathTime = 0; this.hurtTime = 0; this.hist.length = 0;
    this.model.g.rotation.z = 0;
  }
  physics(mx, mz, speed, jump) {
    const fr = this.onGround ? .546 : .91, acc = this.onGround ? speed : speed * .2;
    this.vel.x += mx * acc; this.vel.z += mz * acc;
    if (jump && this.onGround) this.vel.y = .42;
    const r = moveEntity(this, this.vel.x, this.vel.y, this.vel.z);
    this.onGround = r.ground; this.hCol = r.hitX || r.hitZ;
    if (r.hitX) this.vel.x = 0; if (r.hitZ) this.vel.z = 0; if (r.hitY) this.vel.y = 0;
    this.vel.y = (this.vel.y - .08) * .98; this.vel.x *= fr; this.vel.z *= fr;
    if (this.pos.y < -40) this.respawn();
  }
  faceTo(p, turn = 30) {
    const r = rotTo(this.eye, p);
    this.yaw += clamp(wrapDeg(r.yaw - this.yaw), -turn, turn); this.pitch = clamp(r.pitch, -60, 60);
  }
  tick() {
    this.prev.copy(this.pos); this.prevYaw = this.yaw; this.t++;
    if (this.hurtTime > 0) this.hurtTime--; if (this.invul > 0) this.invul--; this.sinceHurt++;
    if (this.shieldDown > 0) this.shieldDown--;
    if (!this.alive) { this.deathTime++; this.physics(0, 0, 0); if (this.deathTime > 40) this.respawn(); return; }
    let mx = 0, mz = 0, speed = .1, jump = false;
    const home = new THREE.Vector3().subVectors(this.anchor, this.pos); home.y = 0;
    switch (this.kind) {
      case 'strafer': {
        if (this.t % 90 === 0) this.dir *= -1;
        const a = this.t * .045 * this.dir, tgt = new THREE.Vector3(this.anchor.x + Math.cos(a) * 2.6, 0, this.anchor.z + Math.sin(a) * 2.6);
        const d = tgt.sub(this.pos); d.y = 0; if (d.length() > .1) { d.normalize(); mx = d.x; mz = d.z; }
        speed = .13; jump = Math.random() < .03;
        if (player) this.faceTo(player.eye, 20);
        break;
      }
      case 'lagger':
        if (this.t % 16 === 0) { this.dir *= -1; this.pos.x = this.anchor.x + this.dir * 2.2; }
        if (player) this.faceTo(player.eye, 40);
        break;
      case 'fighter': {
        const tp = player && player.alive && player.inPit() ? player.serverPos : null;
        if (tp) {
          const d = new THREE.Vector3(tp.x - this.pos.x, 0, tp.z - this.pos.z), dist = d.length();
          this.faceTo(new THREE.Vector3(tp.x, tp.y + 1.5, tp.z), 25);
          if (dist > 2.2) { d.normalize(); mx = d.x; mz = d.z; speed = .13; }
          const side = Math.sin(this.t * .09) * .6; mx += -mz * side * .4; mz += mx * side * .4;
          jump = this.hCol || (dist < 4 && Math.random() < .04);
          if (--this.attackCd <= 0 && dist < 3 && Math.abs(tp.y - this.pos.y) < 2.5 && visible(this.eye, new THREE.Vector3(tp.x, tp.y + 1.5, tp.z))) {
            this.attackCd = 11 + (Math.random() * 4 | 0); this.swing = 1; attackPlayer(this, 3);
          }
        } else if (home.length() > .6) { home.normalize(); mx = home.x; mz = home.z; this.attackCd = 20; }
        break;
      }
      default:
        if (home.length() > .5) { home.normalize(); mx = home.x * .6; mz = home.z * .6; }
        if (player && this.kind !== 'ghost') this.faceTo(player.eye, 8);
        if (this.kind === 'shield') this.blocking = this.shieldDown === 0;
    }
    this.physics(mx, mz, speed, jump);
    if (this.regen && this.sinceHurt > 60 && this.health < this.maxHealth) this.health = Math.min(this.maxHealth, this.health + .1);
    this.hist.push(this.pos.clone()); if (this.hist.length > 100) this.hist.shift();
    if (this.swing > 0) this.swing = Math.max(0, this.swing - .17);
  }
  render(a) {
    const m = this.model, p = this.prev.clone().lerp(this.pos, a);
    const show = !this.invisible || (on('No Render') && P('No Render', 'Invisibles'));
    m.root.visible = show; this.tag.visible = !this.invisible;
    m.mats.forEach(x => x.opacity = this.invisible ? .35 : 1);
    m.root.position.copy(p);
    const yaw = this.prevYaw + wrapDeg(this.yaw - this.prevYaw) * a;
    this.bodyYaw += wrapDeg(yaw - this.bodyYaw) * .3;
    m.g.rotation.y = this.bodyYaw * DEG; m.head.rotation.set(this.pitch * DEG, (yaw - this.bodyYaw) * DEG, 0);
    const sp = Math.hypot(this.pos.x - this.prev.x, this.pos.z - this.prev.z);
    this.limbAmp = lerp(this.limbAmp, Math.min(1, sp * 6), .2); this.limb += sp * 4;
    const sw = Math.sin(this.limb) * .9 * this.limbAmp;
    m.legL.rotation.x = sw; m.legR.rotation.x = -sw; m.armL.rotation.x = -sw * .8; m.armR.rotation.x = sw * .8;
    if (this.swing > 0) m.armR.rotation.x = -Math.sin(this.swing * Math.PI) * 1.6;
    if (this.kind === 'shield') { m.armL.rotation.x = this.blocking ? -1.1 : -sw * .8; m.armL.rotation.z = this.blocking ? -.35 : 0; }
    m.g.rotation.z = this.alive ? 0 : Math.min(1, this.deathTime / 10) * Math.PI / 2;
    setTint(m, this.hurtTime > 0 || !this.alive ? 1 : 0);
    this.tag.position.set(p.x, p.y + 2.25, p.z);
  }
}
const npcs = [];
function spawnNpcs() {
  npcs.forEach(n => { scene.remove(n.model.root); scene.remove(n.tag); }); npcs.length = 0;
  const add = o => npcs.push(new NPC({ ...o, pos: new THREE.Vector3(o.x, 0, o.z) }));
  add({ kind: 'dummy', name: 'Dummy', skin: 'dummy', x: -7.5, z: -9.5 });
  add({ kind: 'shield', name: 'Shield', skin: 'shield', x: -3.5, z: -9.5 });
  add({ kind: 'strafer', name: 'Strafer', skin: 'strafer', x: 1, z: -10 });
  add({ kind: 'lagger', name: 'Lagger', skin: 'lagger', x: 6, z: -9.5 });
  add({ kind: 'ghost', name: 'Invisible', skin: 'ghost', x: 10.5, z: -9.5, invisible: true });
  add({ kind: 'bot', name: 'Bot A', skin: 'bot', x: -15.5, z: -15.5 });
  add({ kind: 'bot', name: 'Bot B', skin: 'bot', x: -13.5, z: -17.5, health: 12, regen: false });
  add({ kind: 'bot', name: 'Bot C', skin: 'bot', x: -17.5, z: -17.5, health: 6, regen: false });
  add({ kind: 'fighter', name: 'Fighter', skin: 'fighter', x: ZONES.pit.x, z: ZONES.pit.z });
}

// ── projectiles + item drops ─────────────────────────
const projectiles = [], drops = [];
function spawnFireball(from, to) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(.6, .6, .6), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
  const core = new THREE.Mesh(new THREE.BoxGeometry(.4, .4, .4), new THREE.MeshBasicMaterial({ color: 0xffe08a })); m.add(core);
  m.position.copy(from); scene.add(m);
  projectiles.push({ type: 'fireball', pos: from.clone(), prev: from.clone(), vel: to.clone().sub(from).normalize().multiplyScalar(.55), mesh: m, life: 160, owner: 'turret', hw: .5 });
  Sound.play('shoot');
}
function throwItem(type, from, dir) {
  const color = type === 'potion' ? 0xf04848 : 0x2fd3c0;
  const m = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .2), new THREE.MeshBasicMaterial({ color }));
  m.position.copy(from); scene.add(m);
  projectiles.push({ type, pos: from.clone(), prev: from.clone(), vel: dir.clone().multiplyScalar(type === 'potion' ? .5 : 1.5), mesh: m, life: 200 });
}
function dropItem(stack, pos, vel) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: getIconTex(stack.id), transparent: true, alphaTest: .1 }));
  sp.scale.set(.32, .32, 1); sp.position.copy(pos); scene.add(sp);
  drops.push({ stack, pos: pos.clone(), vel: vel || new THREE.Vector3(rand(-.1, .1), .2, rand(-.1, .1)), sprite: sp, delay: 40, age: 0, hw: .125, h: .25 });
}
