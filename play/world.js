'use strict';
// ── renderer / scene ──────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.autoClear = false;
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const FOG = new THREE.Color('#0b1733');
scene.fog = new THREE.Fog(FOG, 40, 150);
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 700);
camera.rotation.order = 'YXZ';
const handScene = new THREE.Scene();
const handCam = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
const hemi = new THREE.HemisphereLight(0x8aa6ff, 0x203020, .55);
const moonLight = new THREE.DirectionalLight(0xbcd2ff, .55);
moonLight.position.set(-40, 80, -60);
scene.add(hemi, moonLight);
handScene.add(new THREE.HemisphereLight(0xffffff, 0x445566, .9), new THREE.AmbientLight(0xffffff, .25));
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = handCam.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix(); handCam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// sky
(function sky() {
  const g = new THREE.SphereGeometry(500, 24, 16), col = [], top = new THREE.Color('#01030b'), hor = new THREE.Color('#13306a');
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = clamp(p.getY(i) / 500, -.1, 1); const c = hor.clone().lerp(top, Math.pow(Math.max(t, 0), .6)); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  const sp = [];
  for (let i = 0; i < 900; i++) { const v = new THREE.Vector3(rand(-1, 1), rand(.05, 1), rand(-1, 1)).normalize().multiplyScalar(450); sp.push(v.x, v.y, v.z); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfeeff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: .85 })));
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ color: 0xeef5ff, fog: false }));
  moon.position.set(-150, 260, -300); moon.lookAt(0, 0, 0); scene.add(moon);
})();

// ── procedural textures ───────────────────────────────
function px(draw, size = 16) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); draw(x, size); return c;
}
function noiseFill(x, base, vary, seed = 1) {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
    const k = (r() - .5) * vary; x.fillStyle = rgb(base.map(v => clamp(Math.round(v + k), 0, 255))); x.fillRect(i, j, 1, 1);
  }
}
function tex(canvas, repeat) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const CV = {
  grass: px(x => noiseFill(x, [86, 140, 62], 34, 3)),
  grassSide: px(x => { noiseFill(x, [121, 85, 58], 30, 5); for (let i = 0; i < 16; i++) { const h = 3 + (i * 7 % 3); x.fillStyle = '#5a8c3e'; x.fillRect(i, 0, 1, h); } }),
  dirt: px(x => noiseFill(x, [121, 85, 58], 30, 5)),
  stone: px(x => { noiseFill(x, [125, 125, 128], 26, 7); x.fillStyle = 'rgba(0,0,0,.18)'; [[2, 3, 5], [9, 10, 4], [4, 12, 3], [11, 2, 3]].forEach(([a, b, w]) => x.fillRect(a, b, w, 1)); }),
  planks: px(x => { noiseFill(x, [168, 132, 82], 16, 9); x.fillStyle = 'rgba(60,35,10,.55)'; [3, 7, 11, 15].forEach(y => x.fillRect(0, y, 16, 1)); [[5, 0], [12, 4], [2, 8], [9, 12]].forEach(([a, b]) => x.fillRect(a, b, 1, 3)); }),
  wool: px(x => { noiseFill(x, [36, 150, 235], 22, 11); x.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 16; i += 2) x.fillRect(i, (i * 5) % 16, 1, 1); }),
  endstone: px(x => { noiseFill(x, [221, 223, 165], 22, 13); x.fillStyle = 'rgba(120,120,60,.35)'; [[3, 4], [10, 7], [6, 12], [13, 13]].forEach(([a, b]) => x.fillRect(a, b, 2, 1)); }),
  glass: px(x => { x.clearRect(0, 0, 16, 16); x.fillStyle = 'rgba(200,235,255,.9)'; x.fillRect(0, 0, 16, 1); x.fillRect(0, 15, 16, 1); x.fillRect(0, 0, 1, 16); x.fillRect(15, 0, 1, 16); x.fillStyle = 'rgba(220,240,255,.6)'; x.fillRect(3, 3, 1, 1); x.fillRect(4, 4, 2, 1); x.fillRect(11, 10, 1, 2); x.fillStyle = 'rgba(200,230,255,.08)'; x.fillRect(1, 1, 14, 14); }),
  web: px(x => { x.clearRect(0, 0, 16, 16); x.strokeStyle = 'rgba(235,235,235,.95)'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, 0); x.lineTo(16, 16); x.moveTo(16, 0); x.lineTo(0, 16); x.moveTo(8, 0); x.lineTo(8, 16); x.moveTo(0, 8); x.lineTo(16, 8); x.stroke(); x.strokeRect(4.5, 4.5, 7, 7); }),
  bedTop: px(x => { x.fillStyle = '#b52d2d'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#d64545'; x.fillRect(1, 1, 14, 14); x.fillStyle = '#f0f0f0'; x.fillRect(2, 1, 12, 5); }),
  bedFoot: px(x => { x.fillStyle = '#b52d2d'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#d64545'; x.fillRect(1, 0, 14, 15); }),
  bedSide: px(x => { x.fillStyle = '#7a4c25'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#c33a3a'; x.fillRect(0, 0, 16, 9); }),
  pad: px(x => { noiseFill(x, [20, 50, 80], 10, 17); x.fillStyle = '#2fb4ff'; [[7, 2, 2, 12], [5, 4, 6, 1], [4, 5, 8, 1], [3, 6, 10, 1]].forEach(r => x.fillRect(...r)); x.strokeStyle = '#8be1ff'; x.strokeRect(.5, .5, 15, 15); }),
  obsidian: px(x => { noiseFill(x, [24, 16, 38], 18, 19); x.fillStyle = 'rgba(120,80,200,.35)'; [[3, 3], [11, 6], [6, 11], [13, 13]].forEach(([a, b]) => x.fillRect(a, b, 2, 1)); }),
  turret: px(x => { noiseFill(x, [110, 110, 112], 18, 21); x.fillStyle = '#222'; x.fillRect(4, 4, 8, 8); x.fillStyle = '#ff7a1a'; x.fillRect(6, 6, 4, 4); }),
  plate: px(x => { x.fillStyle = '#7a1f8a'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#b64ac9'; x.fillRect(1, 1, 14, 14); }),
  refill: px(x => { x.fillStyle = '#1d6b3a'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#3fdc7a'; x.fillRect(1, 1, 14, 14); x.fillStyle = '#eaffef'; x.fillRect(7, 3, 2, 10); x.fillRect(3, 7, 10, 2); }),
  dirtItem: null,
};
const mat = (c, o = {}) => new THREE.MeshLambertMaterial({ map: tex(c), ...o });
const clear = c => mat(c, { transparent: true, alphaTest: .1, side: THREE.DoubleSide });
// face order: +x, -x, +y, -y, +z, -z
const BT = {
  dirt: { m: mat(CV.dirt), hard: 0.5, tool: 'shovel', solid: true },
  stone: { m: mat(CV.stone), hard: 1.5, tool: 'pickaxe', need: true, solid: true },
  planks: { m: mat(CV.planks), hard: 2, tool: 'axe', solid: true },
  wool: { m: mat(CV.wool), hard: 0.8, tool: 'shears', solid: true },
  endstone: { m: mat(CV.endstone), hard: 3, tool: 'pickaxe', need: true, solid: true },
  glass: { m: clear(CV.glass), hard: 0.3, solid: true, sound: 'glass' },
  web: { m: clear(CV.web), hard: 4, tool: 'sword', solid: false, web: true },
  obsidian: { m: mat(CV.obsidian), hard: -1, solid: true },
  turret: { m: [mat(CV.turret), mat(CV.turret), mat(CV.obsidian), mat(CV.obsidian), mat(CV.turret), mat(CV.turret)], hard: -1, solid: true },
  pad: { m: [mat(CV.dirt), mat(CV.dirt), mat(CV.pad, { emissive: 0x0a3050 }), mat(CV.dirt), mat(CV.dirt), mat(CV.dirt)], hard: -1, solid: true },
  bed_head: { m: [mat(CV.bedSide), mat(CV.bedSide), mat(CV.bedTop), mat(CV.bedSide), mat(CV.bedSide), mat(CV.bedSide)], hard: 0.2, solid: true, h: .5625, bed: true },
  bed_foot: { m: [mat(CV.bedSide), mat(CV.bedSide), mat(CV.bedFoot), mat(CV.bedSide), mat(CV.bedSide), mat(CV.bedSide)], hard: 0.2, solid: true, h: .5625, bed: true },
  plate: { m: mat(CV.plate, { emissive: 0x2a0630 }), hard: -1, solid: false, h: .0625 },
  refill: { m: mat(CV.refill, { emissive: 0x08301a }), hard: -1, solid: false, h: .0625 },
};

// ── voxel world ──────────────────────────────────────
const W = 48;                                   // ground spans -W..W
const PIT = { x0: -8, x1: 8, z0: 18, z1: 36 };  // void gap for bridging
const inPit = (x, z) => x >= PIT.x0 && x <= PIT.x1 && z >= PIT.z0 && z <= PIT.z1;
const blocks = new Map();
const K = (x, y, z) => x + ',' + y + ',' + z;
const ghost = new Set();                       // client-side ghost blocks (Polar flight)
function typeAt(x, y, z) {
  const t = blocks.get(K(x, y, z));
  if (t) return t;
  if (y === -1 && Math.abs(x) <= W && Math.abs(z) <= W && !inPit(x, z)) return 'ground';
  return null;
}
const isSolid = (x, y, z) => { const t = typeAt(x, y, z); return t === 'ground' || (t && BT[t].solid) || ghost.has(K(x, y, z)); };
const blockH = t => (t && BT[t] && BT[t].h) || 1;

// instanced rendering per block type
const geoFull = new THREE.BoxGeometry(1, 1, 1);
const inst = {};
const tmpM = new THREE.Matrix4();
for (const [t, d] of Object.entries(BT)) {
  const h = d.h || 1, g = h === 1 ? geoFull : new THREE.BoxGeometry(1, h, 1);
  const m = new THREE.InstancedMesh(g, d.m, 4096); m.count = 0; m.userData.h = h;
  m.frustumCulled = false; inst[t] = m; scene.add(m);
}
const dirty = new Set();
function rebuild() {
  if (!dirty.size) return;
  const per = {}; dirty.forEach(t => per[t] = []);
  blocks.forEach((t, k) => { if (per[t]) per[t].push(k); });
  for (const t of dirty) {
    const m = inst[t], h = m.userData.h; let i = 0;
    for (const k of per[t]) { const [x, y, z] = k.split(',').map(Number); tmpM.makeTranslation(x + .5, y + h / 2, z + .5); m.setMatrixAt(i++, tmpM); }
    m.count = i; m.instanceMatrix.needsUpdate = true;
  }
  dirty.clear();
}
function setBlock(x, y, z, t) {
  const k = K(x, y, z), old = blocks.get(k);
  if (old) dirty.add(old);
  if (t) { blocks.set(k, t); dirty.add(t); } else blocks.delete(k);
}

// ground slab (with a hole for the pit)
(function ground() {
  const gt = tex(CV.grass, true), st = tex(CV.grassSide, true);
  const topM = new THREE.MeshLambertMaterial({ map: gt }), sideM = new THREE.MeshLambertMaterial({ map: st, side: THREE.DoubleSide });
  const rects = [[-W, W + 1, -W, PIT.z0], [-W, W + 1, PIT.z1 + 1, W + 1], [-W, PIT.x0, PIT.z0, PIT.z1 + 1], [PIT.x1 + 1, W + 1, PIT.z0, PIT.z1 + 1]];
  for (const [x0, x1, z0, z1] of rects) {
    const w = x1 - x0, d = z1 - z0, g = new THREE.PlaneGeometry(w, d);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
    const m = new THREE.Mesh(g, topM); m.rotation.x = -Math.PI / 2; m.position.set(x0 + w / 2, 0, z0 + d / 2); scene.add(m);
  }
  const side = (len, x, z, ry) => {
    const g = new THREE.PlaneGeometry(len, 1); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len);
    const m = new THREE.Mesh(g, sideM); m.position.set(x, -.5, z); m.rotation.y = ry; scene.add(m);
  };
  const S = 2 * W + 1;
  side(S, 0.5, -W, 0); side(S, 0.5, W + 1, 0); side(S, -W, 0.5, Math.PI / 2); side(S, W + 1, 0.5, Math.PI / 2);
  const pw = PIT.x1 - PIT.x0 + 1, pd = PIT.z1 - PIT.z0 + 1;
  side(pw, (PIT.x0 + PIT.x1 + 1) / 2, PIT.z0, 0); side(pw, (PIT.x0 + PIT.x1 + 1) / 2, PIT.z1 + 1, 0);
  side(pd, PIT.x0, (PIT.z0 + PIT.z1 + 1) / 2, Math.PI / 2); side(pd, PIT.x1 + 1, (PIT.z0 + PIT.z1 + 1) / 2, Math.PI / 2);
})();

// ── collision (Minecraft-style axis clipping) ─────────
function boxesIn(x0, y0, z0, x1, y1, z1, noClip) {
  const out = [];
  for (let x = Math.floor(x0); x <= Math.floor(x1); x++)
    for (let y = Math.floor(y0) - 1; y <= Math.floor(y1); y++)
      for (let z = Math.floor(z0); z <= Math.floor(z1); z++) {
        if (ghost.has(K(x, y, z))) { out.push([x, y, z, x + 1, y + 1, z + 1]); continue; }
        if (noClip) continue;
        const t = typeAt(x, y, z);
        if (t && (t === 'ground' || BT[t].solid)) out.push([x, y, z, x + 1, y + blockH(t), z + 1]);
      }
  return out;
}
// ent: {pos (feet centre), hw (half width), h (height)}; returns {x,y,z} actually moved + collision flags
function moveEntity(e, dx, dy, dz, noClip) {
  const p = e.pos, hw = e.hw;
  let bx0 = p.x - hw, by0 = p.y, bz0 = p.z - hw, bx1 = p.x + hw, by1 = p.y + e.h, bz1 = p.z + hw;
  const list = boxesIn(Math.min(bx0, bx0 + dx), Math.min(by0, by0 + dy), Math.min(bz0, bz0 + dz), Math.max(bx1, bx1 + dx), Math.max(by1, by1 + dy), Math.max(bz1, bz1 + dz), noClip);
  const ody = dy, odx = dx, odz = dz;
  for (const b of list) if (bx1 > b[0] && bx0 < b[3] && bz1 > b[2] && bz0 < b[5]) {
    if (dy > 0 && by1 <= b[1]) dy = Math.min(dy, b[1] - by1); else if (dy < 0 && by0 >= b[4]) dy = Math.max(dy, b[4] - by0);
  }
  by0 += dy; by1 += dy;
  for (const b of list) if (by1 > b[1] && by0 < b[4] && bz1 > b[2] && bz0 < b[5]) {
    if (dx > 0 && bx1 <= b[0]) dx = Math.min(dx, b[0] - bx1); else if (dx < 0 && bx0 >= b[3]) dx = Math.max(dx, b[3] - bx0);
  }
  bx0 += dx; bx1 += dx;
  for (const b of list) if (by1 > b[1] && by0 < b[4] && bx1 > b[0] && bx0 < b[3]) {
    if (dz > 0 && bz1 <= b[2]) dz = Math.min(dz, b[2] - bz1); else if (dz < 0 && bz0 >= b[5]) dz = Math.max(dz, b[5] - bz0);
  }
  p.x += dx; p.y += dy; p.z += dz;
  return { dx, dy, dz, hitX: dx !== odx, hitY: dy !== ody, hitZ: dz !== odz, ground: ody < 0 && dy !== ody };
}
function collidesAt(x, y, z, hw, h) {
  return boxesIn(x - hw, y, z - hw, x + hw, y + h, z + hw).some(b => x + hw > b[0] && x - hw < b[3] && y + h > b[1] && y < b[4] && z + hw > b[2] && z - hw < b[5]);
}
function inBlockType(e, type) {
  for (let x = Math.floor(e.pos.x - e.hw); x <= Math.floor(e.pos.x + e.hw); x++)
    for (let y = Math.floor(e.pos.y); y <= Math.floor(e.pos.y + e.h - .01); y++)
      for (let z = Math.floor(e.pos.z - e.hw); z <= Math.floor(e.pos.z + e.hw); z++)
        if (blocks.get(K(x, y, z)) === type) return { x, y, z };
  return null;
}

// voxel ray (Amanatides & Woo)
function raycastBlocks(o, d, max, filter) {
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z);
  let tx = d.x ? ((sx > 0 ? x + 1 - o.x : o.x - x) * tdx) : Infinity;
  let ty = d.y ? ((sy > 0 ? y + 1 - o.y : o.y - y) * tdy) : Infinity;
  let tz = d.z ? ((sz > 0 ? z + 1 - o.z : o.z - z) * tdz) : Infinity;
  let n = [0, 0, 0], t = 0;
  for (let i = 0; i < 300 && t <= max; i++) {
    const ty_ = typeAt(x, y, z);
    if (ty_ && (!filter || filter(ty_))) {
      const h = blockH(ty_);
      if (h >= 1 || o.y + d.y * t <= y + h + 1e-3 || ty_ === 'ground') return { x, y, z, n, t, type: ty_ };
    }
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; }
    else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
  }
  return null;
}
const visible = (a, b) => { const d = b.clone().sub(a), l = d.length(); const r = raycastBlocks(a, d.normalize(), l, t => t !== 'web' && t !== 'glass' && BT[t] ? BT[t].solid : t === 'ground'); return !r || r.t >= l - .05; };
function rayBox(o, d, b) { // b: [x0,y0,z0,x1,y1,z1]
  let t0 = 0, t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    const oo = [o.x, o.y, o.z][i], dd = [d.x, d.y, d.z][i];
    if (Math.abs(dd) < 1e-9) { if (oo < b[i] || oo > b[i + 3]) return null; continue; }
    let a = (b[i] - oo) / dd, c = (b[i + 3] - oo) / dd; if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return null;
  }
  return t0;
}
const distToBox = (p, b) => Math.hypot(Math.max(b[0] - p.x, 0, p.x - b[3]), Math.max(b[1] - p.y, 0, p.y - b[4]), Math.max(b[2] - p.z, 0, p.z - b[5]));
const closestOnBox = (p, b) => new THREE.Vector3(clamp(p.x, b[0], b[3]), clamp(p.y, b[1], b[4]), clamp(p.z, b[2], b[5]));

// ── floating text (holograms / name tags) ─────────────
function textSprite(lines, opt = {}) {
  const fs = opt.size || 44, pad = 14, font = `${opt.weight || 600} ${fs}px ${opt.font || 'Outfit, sans-serif'}`;
  const c = document.createElement('canvas'), x = c.getContext('2d'); x.font = font;
  const w = Math.max(...lines.map(l => x.measureText(l.t || l).width)) + pad * 2, h = lines.length * fs * 1.2 + pad * 2;
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  if (opt.bg) { x.fillStyle = opt.bg; x.fillRect(0, 0, c.width, c.height); }
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'top';
  lines.forEach((l, i) => {
    const txt = l.t || l; x.fillStyle = 'rgba(0,0,0,.55)'; x.fillText(txt, c.width / 2 + 3, pad + i * fs * 1.2 + 3);
    x.fillStyle = l.c || opt.color || '#fff'; x.fillText(txt, c.width / 2, pad + i * fs * 1.2);
  });
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false, depthTest: opt.depthTest !== false }));
  const scale = (opt.scale || .0062);
  s.scale.set(c.width * scale, c.height * scale, 1);
  return s;
}
const holos = [];
function holo(x, y, z, lines, opt) { const s = textSprite(lines, opt); s.position.set(x, y, z); scene.add(s); holos.push(s); return s; }

// ── world layout ─────────────────────────────────────
const SPAWN = new THREE.Vector3(0.5, 0, 6.5);
const ZONES = {
  pit: { x: 0.5, z: -25.5, r: 7 },
  bed: { head: [-24, 0, -4], foot: [-24, 0, -3] },
  turret: [-42, 4, 0],
  trap: [-14, 0, 16],
  refill: [3, 0, 8],
  pad: [34, -1, 10],
};
function fill(x0, y0, z0, x1, y1, z1, t, chance = 1) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (Math.random() < chance) setBlock(x, y, z, t);
}
function buildBedFort() {
  const [hx, , hz] = ZONES.bed.head;
  fill(hx - 2, 0, hz - 2, hx + 2, 2, hz + 3, 'endstone');
  fill(hx - 1, 0, hz - 1, hx + 1, 1, hz + 2, 'wool');
  setBlock(hx, 0, hz, 'bed_head'); setBlock(hx, 0, hz + 1, 'bed_foot');
}
function buildWorld() {
  [...blocks.keys()].forEach(k => { dirty.add(blocks.get(k)); }); blocks.clear();
  // PvP pit ring
  const P0 = ZONES.pit;
  for (let a = 0; a < 360; a += 4) {
    const x = Math.floor(P0.x + Math.cos(a * DEG) * P0.r), z = Math.floor(P0.z + Math.sin(a * DEG) * P0.r);
    if (a > 70 && a < 110) continue;                 // entrance (south side)
    setBlock(x, 0, z, 'stone');
  }
  // movement course
  fill(14, 0, 10, 20, 11, 10, 'stone');                           // Spiderman wall
  fill(24, 0, 8, 29, 1, 12, 'web', .7);                            // web field
  setBlock(...ZONES.pad, 'pad');                                   // launch pad (No Fall)
  fill(39, 0, 9, 41, 3, 11, 'glass'); fill(40, 0, 10, 40, 1, 10, null); // V-Clip cell
  // bed fort, mining wall, turret, trap, refill
  buildBedFort();
  for (let x = -30; x <= -18; x++) { setBlock(x, 0, 10, 'stone'); setBlock(x, 1, 10, 'planks'); setBlock(x, 2, 10, 'wool'); setBlock(x, 3, 10, x % 2 ? 'glass' : 'dirt'); }
  fill(-42, 0, 0, -42, 3, 0, 'obsidian'); setBlock(...ZONES.turret, 'turret');
  setBlock(...ZONES.trap, 'plate'); setBlock(...ZONES.refill, 'refill');
  rebuild();
}
function buildHolos() {
  holo(0.5, 3.4, 1.5, [{ t: 'ETHANE PLAYGROUND', c: '#2fb4ff' }, 'RShift opens the Click GUI', { t: 'T chat · E inventory · F5 camera', c: '#9fb3d6' }], { size: 46, scale: .0068 });
  holo(0.5, 3.2, -6, [{ t: 'TRAINING DUMMIES', c: '#ffd75a' }, 'KillAura · Aura · Criticals · Reach · Backtrack', { t: 'Auto Shield Break on the shield dummy', c: '#9fb3d6' }]);
  holo(-15.5, 3.2, -12, [{ t: 'MULTI-TARGET', c: '#ffd75a' }, 'Target Mode · Sorting', { t: 'three bots with different health', c: '#9fb3d6' }]);
  holo(0.5, 3.6, -17.5, [{ t: 'PvP PIT', c: '#ff6b6b' }, 'The Fighter attacks you inside the ring', { t: 'Velocity · AutoPot · AutoSoup · Target HUD · Tick Base', c: '#9fb3d6' }]);
  holo(17.5, 13.4, 9.5, [{ t: 'SPIDERMAN', c: '#ffd75a' }, 'walk into the wall']);
  holo(27, 3.4, 10.5, [{ t: 'WEBS', c: '#ffd75a' }, 'No Web']);
  holo(34.5, 3.4, 10.5, [{ t: 'LAUNCH PAD', c: '#ffd75a' }, 'No Fall · step on it']);
  holo(40.5, 5.6, 10.5, [{ t: 'V-CLIP CELL', c: '#ffd75a' }, 'break in, then V-Clip or No Clip out']);
  for (let i = 1; i <= 3; i++) holo(12 + i * 10, 2.2, 0.5, [{ t: i * 10 + 'm', c: '#8be1ff' }], { size: 60, scale: .009 });
  holo(12, 3, 0.5, [{ t: 'SPEED LANE', c: '#ffd75a' }, 'Speed · Flight · Timer · Fast Stop', { t: 'watch your BPS', c: '#9fb3d6' }]);
  holo(0.5, 3, 16.5, [{ t: 'THE GAP', c: '#ffd75a' }, 'Scaffold across · Keep Y · Tower', { t: 'falling in respawns you', c: '#9fb3d6' }]);
  holo(-23.5, 5, -2.5, [{ t: 'BED FORT', c: '#ff6b6b' }, 'BedNuker (Vanilla or Hypixel)']);
  holo(-23.5, 6, 10.5, [{ t: 'BUILD / MINE', c: '#ffd75a' }, 'Auto Tool · Fast Place']);
  holo(-41.5, 7, 0.5, [{ t: 'FIREBALL TURRET', c: '#ff9a3c' }, 'Anti Fireball · hits you within 26 blocks']);
  holo(-13.5, 2.4, 16.5, [{ t: 'TRAP PLATE', c: '#d17bff' }, 'No Render: blindness, nausea, fire']);
  holo(3.5, 2.2, 8.5, [{ t: 'REFILL', c: '#55ff8a' }, 'stand here to restock']);
}
