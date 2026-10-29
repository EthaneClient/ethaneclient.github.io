'use strict';
buildWorld(); buildHolos(); spawnNpcs();
player = new Player();
loadConfig('autosave');
if (on('Click GUI')) setMod('Click GUI', false, true);
renderGui();

// ── world tick (20 TPS) ──────────────────────────────
let worldT = 0;
function knock(dir, strength, yBoost) {
  const p = player, nv = new THREE.Vector3(p.vel.x / 2 + dir.x * strength, Math.max(p.vel.y / 2, yBoost), p.vel.z / 2 + dir.z * strength);
  if (on('Velocity')) {
    const m = P('Velocity', 'Mode');
    if (m === 'Cancel') return; if (m === 'Reversed') return p.vel.set(-nv.x, nv.y, -nv.z);
    if (m === 'Custom') { const xz = P('Velocity', 'X/Z multiplier'), y = P('Velocity', 'Y multiplier'); return p.vel.set(p.vel.x + (nv.x - p.vel.x) * xz, p.vel.y + (nv.y - p.vel.y) * y, p.vel.z + (nv.z - p.vel.z) * xz); }
  }
  p.vel.copy(nv);
}
function explode(pos) {
  Sound.play('boom'); Particles.spawn(pos.x, pos.y, pos.z, '#ff8a2a', 40, .35, .005, 26); Particles.spawn(pos.x, pos.y, pos.z, '#555555', 30, .2, -.01, 40);
  const d = player.center().distanceTo(pos);
  if (d < 4 && player.alive) {
    player.fire = Math.max(player.fire, 60);
    player.damage(Math.round((1 - d / 4) * 7) + 1, 'were blown up by a Fireball');
    const dir = player.center().sub(pos).setY(0).normalize(); knock(dir, 1.1 * (1 - d / 4) + .3, .5);
  }
  npcs.forEach(n => { const dn = n.center().distanceTo(pos); if (n.alive && dn < 4) hurtNpc(n, Math.round((1 - dn / 4) * 7) + 1, pos, 1); });
}
function worldTick() {
  worldT++;
  npcs.forEach(n => n.tick());
  // fireball turret
  const tp = new THREE.Vector3(ZONES.turret[0] + .5, ZONES.turret[1] + .5, ZONES.turret[2] + .5);
  if (player.alive && worldT % 70 === 0 && player.eye.distanceTo(tp) < 26) {
    const from = tp.clone().add(player.eye.sub(tp).normalize().multiplyScalar(1));
    if (visible(from, player.eye)) spawnFireball(from, player.eye.add(player.vel.clone().multiplyScalar(6)));
  }
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i]; pr.prev.copy(pr.pos);
    if (pr.type !== 'fireball') pr.vel.y -= pr.type === 'potion' ? .05 : .03;
    const len = pr.vel.length(), dir = pr.vel.clone().normalize();
    const hit = raycastBlocks(pr.pos, dir, len);
    let done = --pr.life <= 0;
    if (pr.type === 'fireball') {
      pr.pos.add(pr.vel);
      const pb = [player.pos.x - .45, player.pos.y, player.pos.z - .45, player.pos.x + .45, player.pos.y + 1.8, player.pos.z + .45];
      if (pr.owner === 'turret' && distToBox(pr.pos, pb) < .4) done = true;
      if (pr.owner === 'player' && npcs.some(n => n.alive && distToBox(pr.pos, n.box()) < .4)) done = true;
      if (pr.owner === 'player' && pr.pos.distanceTo(tp) < 1.6) { done = true; chat('<e>[Ethane]</e> Returned to sender.', 'rts'); }
      if (hit) done = true;
      if (done) explode(pr.pos);
      else if (worldT % 2 === 0) Particles.spawn(pr.pos.x, pr.pos.y, pr.pos.z, '#ffb347', 2, .03, -.002, 10);
    } else {
      if (hit || pr.pos.y < -40) {
        pr.pos.addScaledVector(dir, hit ? hit.t : len); done = true;
        if (pr.type === 'potion') {
          Sound.play('glass'); Particles.spawn(pr.pos.x, pr.pos.y + .3, pr.pos.z, '#f04848', 40, .2, .01, 24);
          if (player.alive && player.center().distanceTo(pr.pos) < 4.2) { player.health = Math.min(20, player.health + 8); chat('<g>+4 hearts</g> <d>(Instant Health II)</d>', 'pot'); }
        } else if (pr.type === 'pearl' && player.alive && hit) {
          const t = new THREE.Vector3(hit.x + .5 + hit.n[0], hit.y + Math.max(0, hit.n[1]), hit.z + .5 + hit.n[2]);
          if (hit.n[1] === 1) t.set(pr.pos.x, hit.y + 1, pr.pos.z);
          player.pos.copy(t); player.prev.copy(t); player.vel.set(0, 0, 0); player.fallDist = 0; Sound.play('tp');
          Particles.spawn(t.x, t.y + 1, t.z, '#b04bff', 30, .15, 0, 25); player.damage(5, 'fell from an ender pearl');
        }
      } else pr.pos.add(pr.vel);
    }
    if (done) { scene.remove(pr.mesh); projectiles.splice(i, 1); }
  }
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i]; if (d.delay > 0) d.delay--; d.age++;
    d.vel.y -= .04; const r = moveEntity(d, d.vel.x, d.vel.y, d.vel.z);
    if (r.ground || r.hitY) { d.vel.y = 0; d.vel.x *= .5; d.vel.z *= .5; } else { d.vel.x *= .98; d.vel.z *= .98; }
    if (d.age > 6000 || d.pos.y < -40) { scene.remove(d.sprite); drops.splice(i, 1); }
  }
  Particles.tick();
  invManagerTick();
  // Tick Base: freeze, then burst the stored ticks when a target is in range
  const tb = player.tb; if (tb.cd > 0) tb.cd--;
  if (on('Tick Base') && tb.cd <= 0 && player.alive && input.f > 0) {
    const n = npcs.find(n => n.alive && n.pos.distanceTo(player.pos) <= P('Tick Base', 'Target Range') && n.pos.distanceTo(player.pos) > 3);
    if (n) { tb.frozen = P('Tick Base', 'Max Ticks'); tb.cd = 40; }
  }
  // trail samples
  if (on('Trail')) { trailPts.push(player.pos.clone()); while (trailPts.length > P('Trail', 'Length')) trailPts.shift(); } else trailPts.length = 0;
}

// ── module hooks ─────────────────────────────────────
hooks.enable['Click GUI'] = () => openGui(true);
hooks.disable['Click GUI'] = () => openGui(false);
hooks.enable['V-Clip'] = () => {
  const p = player, up = P('V-Clip', 'Clip Up'), h = P('V-Clip', 'Height');
  let y = p.pos.y + (up ? h : -h);
  const overGround = Math.abs(p.pos.x) <= W && Math.abs(p.pos.z) <= W && !inPit(Math.floor(p.pos.x), Math.floor(p.pos.z));
  if (!up && overGround && y < 0) y = 0;
  for (let i = 0; i < 40 && collidesAt(p.pos.x, y, p.pos.z, p.hw, p.h); i++) y += up ? 1 : (y - 1 < 0 && overGround ? 1 : -1);
  p.pos.y = y; p.prev.copy(p.pos); p.vel.y = 0; Sound.play('tp');
  setTimeout(() => setMod('V-Clip', false, true), 50);
};
hooks.enable['Scaffold'] = () => { player.scafY = Math.floor(player.pos.y - .01); if (P('Scaffold', 'Auto F5') && ui.camMode === 0) { ui.camMode = 1; player.scafF5 = true; } };
hooks.disable['Scaffold'] = () => { if (player.scafF5) { ui.camMode = 0; player.scafF5 = false; } };
hooks.disable['Blink'] = () => { player.serverPos.copy(player.pos); if (player.pendingKb) { player.vel.copy(player.pendingKb); player.pendingKb = null; } Sound.play('tp'); };
hooks.disable['Flight'] = () => ghost.clear();
hooks.enable['Anti Cheat Sniffer'] = () => setTimeout(sniff, 600);
hooks.enable['Disabler'] = () => { if (opts.ac) chat(`<e>[Ethane]</e> Disabler (${M('Disabler').suffix()}) active: Sentinel checks are disabled.`); };
function sniff() { if (!on('Anti Cheat Sniffer')) return; chat(opts.ac ? '<e>[Ethane]</e> Anticheat detected: <y>Sentinel</y> <d>(simulated)</d>' : '<e>[Ethane]</e> No anticheat detected on this server.'); }

// ── input ────────────────────────────────────────────
const canvas = renderer.domElement, keys = new Set();
let started = false, locked = false;
function lockPointer() { if (!started) return; try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch {} }
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) { $('pause').classList.remove('on'); ui.paused = false; }
  else if (started && !ui.gui && !ui.inv && !ui.chat) { ui.paused = true; $('pause').classList.add('on'); keys.clear(); syncKeys(); }
});
function syncKeys() {
  input.f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  input.s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  input.jump = keys.has('Space'); input.sprint = keys.has('ControlLeft') || keys.has('ControlRight'); input.sneak = keys.has('ShiftLeft');
}
addEventListener('keydown', e => {
  if (!started) return;
  if (ui.chat) {
    if (e.code === 'Escape') closeChat();
    else if (e.code === 'Enter') { const v = $('chatInput').value.trim(); closeChat(); if (v) { if (v.startsWith('.')) { chat('<d>' + esc(v) + '</d>'); command(v); } else chat('&lt;You&gt; ' + esc(v)); } }
    return;
  }
  if (['Space', 'F5', 'Tab', 'Slash'].includes(e.code) || (e.ctrlKey && /Key[WSDA]/.test(e.code))) e.preventDefault();
  if (e.repeat) return;
  for (const m of MODS.values()) if (m.bind && m.bind === e.code) { if (m.name === 'Click GUI') { openGui(!ui.gui); } else if (!ui.gui) toggleMod(m.name); return; }
  if (ui.gui) { if (e.code === 'Escape') openGui(false); keys.add(e.code); syncKeys(); return; }
  if (ui.inv) { if (e.code === 'KeyE' || e.code === 'Escape') openInv(false); keys.add(e.code); syncKeys(); return; }
  if (ui.paused) return;
  keys.add(e.code); syncKeys();
  if (/^Digit[1-9]$/.test(e.code)) player.sel = +e.code[5] - 1;
  else if (e.code === 'KeyE') openInv(true);
  else if (e.code === 'KeyT' || e.code === 'Slash' || e.code === 'Period') openChat(e.code === 'Period' ? '.' : e.code === 'Slash' ? '/' : '');
  else if (e.code === 'F5') ui.camMode = (ui.camMode + 1) % 3;
  else if (e.code === 'KeyQ') player.dropHeld(e.ctrlKey);
});
addEventListener('keyup', e => { keys.delete(e.code); syncKeys(); });
addEventListener('blur', () => { keys.clear(); syncKeys(); input.lmb = input.rmb = false; });
function openChat(pre) {
  ui.chat = true; keys.clear(); syncKeys(); document.exitPointerLock && document.exitPointerLock();
  const i = $('chatInput'); i.value = pre; setTimeout(() => { i.focus(); i.setSelectionRange(pre.length, pre.length); }, 0);
  [...$('chat').children].slice(-20).forEach(c => c.style.display = '');
}
function closeChat() { ui.chat = false; $('chatInput').blur(); [...$('chat').children].slice(0, -10).forEach(c => c.style.display = 'none'); lockPointer(); }
canvas.addEventListener('mousedown', e => {
  if (!started) return;
  if (!locked) { if (!ui.anyOpen() && !ui.chat) lockPointer(); return; }
  Sound.init();
  if (e.button === 0) { input.lmb = true; player.click(); } else if (e.button === 2) input.rmb = true;
});
addEventListener('mouseup', e => { if (e.button === 0) input.lmb = false; if (e.button === 2) input.rmb = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => {
  if (!locked || !player.alive) return;
  let s = opts.sens / 100 * .15;
  if (on('Zoom') && P('Zoom', 'Smooth Look')) s *= P('Zoom', 'Zoom FOV') / opts.fov;
  player.yaw -= e.movementX * s; player.pitch = clamp(player.pitch - e.movementY * s, -90, 90);
});
addEventListener('wheel', e => { if (locked) player.sel = (player.sel + (e.deltaY > 0 ? 1 : 8)) % 9; }, { passive: true });

// start / pause screens
$('loadTxt').textContent = 'Click to play';
$('playBtn').onclick = () => { started = true; Sound.init(); $('start').classList.remove('on'); ui.paused = false; lockPointer(); setTimeout(sniff, 1500); if (!store.get('seen', false)) { store.set('seen', true); chat('<e>[Ethane]</e> Welcome to the playground. Press <y>RShift</y> for the Click GUI, <y>T</y> for chat. Try <y>.help</y>'); } };
$('resumeBtn').onclick = () => { Sound.init(); lockPointer(); };
$('resetBtn').onclick = () => { buildWorld(); spawnNpcs(); projectiles.forEach(p => scene.remove(p.mesh)); projectiles.length = 0; drops.forEach(d => scene.remove(d.sprite)); drops.length = 0; player.respawn(); chat('<y>[Playground]</y> World reset.'); lockPointer(); };
$('optAc').checked = opts.ac;
$('optAc').onchange = e => { opts.ac = e.target.checked; store.set('ac', opts.ac); chat(opts.ac ? '<r>[Sentinel]</r> Simulated anticheat enabled.' : '<d>Simulated anticheat disabled.</d>'); setTimeout(sniff, 400); };
$('optSens').value = opts.sens; $('optSens').oninput = e => { opts.sens = +e.target.value; store.set('sens', opts.sens); };
$('optFov').value = opts.fov; $('optFov').oninput = e => { opts.fov = +e.target.value; store.set('fov', opts.fov); };
$('optVol').value = Sound.vol * 100; $('optVol').oninput = e => { Sound.vol = e.target.value / 100; store.set('vol', +e.target.value); };
$('optHelp').onchange = e => holos.forEach(h => h.visible = e.target.checked);

// ── render helpers ───────────────────────────────────
const lineMat = c => new THREE.LineBasicMaterial({ color: c, depthTest: false, transparent: true });
const boxLines = (w, h, c) => { const l = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, w)), lineMat(c)); l.renderOrder = 10; scene.add(l); return l; };
const hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: .6 }));
scene.add(hl);
const nukeBox = boxLines(1.02, 1.02, 0xff4040);
const espBoxes = [], espBars = [], tracers = [], btBoxes = [];
const ghostBox = boxLines(.6, 1.8, 0xffffff);
const markerRing = new THREE.LineLoop(new THREE.BufferGeometry(), lineMat(0xffffff)); markerRing.renderOrder = 10; scene.add(markerRing);
function setMarkerShape(utah) {
  let pts;
  if (utah) pts = [[-.5, -.6], [.5, -.6], [.5, .3], [.2, .3], [.2, .6], [-.5, .6]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  else pts = [...Array(40)].map((_, i) => new THREE.Vector3(Math.cos(i / 40 * Math.PI * 2) * .6, 0, Math.sin(i / 40 * Math.PI * 2) * .6));
  markerRing.geometry.setFromPoints(pts);
}
let markerUtah = null;
const trailPts = [];
const trailLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x2fb4ff, transparent: true }));
const trailDots = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0x2fb4ff, size: .12 }));
const trailRings = [...Array(25)].map(() => { const r = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([...Array(24)].map((_, i) => new THREE.Vector3(Math.cos(i / 24 * 6.283) * .35, 0, Math.sin(i / 24 * 6.283) * .35))), new THREE.LineBasicMaterial({ color: 0x2fb4ff, transparent: true })); scene.add(r); return r; });
scene.add(trailLine, trailDots);
const tracerMat = lineMat(0xffffff);

// held item (rendered in its own pass so it never clips into walls)
const hand = new THREE.Group(); handScene.add(hand);
const handArm = new THREE.Mesh(new THREE.BoxGeometry(.18, .18, .6), new THREE.MeshLambertMaterial({ color: 0xc99a73 }));
const handPlane = new THREE.Mesh(new THREE.PlaneGeometry(.42, .42), new THREE.MeshLambertMaterial({ transparent: true, alphaTest: .1, side: THREE.DoubleSide }));
const handBlock = new THREE.Mesh(new THREE.BoxGeometry(.32, .32, .32), BT.wool.m);
hand.add(handArm, handPlane, handBlock);
let heldId = null, eyeSmooth = 1.62, fovNow = 70, bob = 0, hurtRoll = 0;
function updateHand(a) {
  const s = player.held(), id = s ? s.id : null, it = s ? ITEMS[id] : null;
  if (id !== heldId) {
    heldId = id;
    handArm.visible = !s; handBlock.visible = !!(it && it.block && it.block !== 'web'); handPlane.visible = !!s && !handBlock.visible;
    if (handBlock.visible) handBlock.material = BT[it.block].m;
    if (handPlane.visible) { handPlane.material.map = getIconTex(id); handPlane.material.needsUpdate = true; }
  }
  const p = clamp(1 - player.swing, 0, 1), sw = player.swing > 0 ? p : 1;
  const s1 = Math.sin(sw * sw * Math.PI), s2 = Math.sin(Math.sqrt(sw) * Math.PI);
  const anim = on('Animations');
  const blocking = anim && P('Animations', '1.7 Blocking') && input.rmb && it && it.kind === 'sword' && !ui.anyOpen();
  const eating = player.using > 0;
  const walk = Math.sin(bob) * Math.min(1, player.bps / 6);
  hand.position.set(.5 - s2 * .14 + walk * .015, -.5 + Math.sin(Math.sqrt(sw) * Math.PI * 2) * .06 - s1 * .06 - Math.abs(walk) * .015, -.7 - s2 * .08);
  hand.rotation.set(-s2 * .7, .5 - s1 * .3, s2 * .2);
  if (blocking) { hand.position.set(.28, -.36, -.62); hand.rotation.set(.35, 1.15, .95); }
  if (eating) { hand.position.set(.18, -.38 + Math.abs(Math.sin(performance.now() / 70)) * .03, -.55); hand.rotation.set(.2, .9, 0); }
  if (handPlane.visible) { handPlane.rotation.set(0, -Math.PI / 2 + .2, .6); handPlane.position.set(0, .1, 0); }
  if (handArm.visible) { handArm.position.set(.05, -.05, .05); handArm.rotation.set(.3, 0, 0); }
  if (anim) {
    hand.position.x += P('Animations', 'Offset X') * .25; hand.position.y += P('Animations', 'Offset Y') * .25; hand.position.z += P('Animations', 'Offset Z') * .25;
    hand.rotation.x += P('Animations', 'Rotation X') * DEG; hand.rotation.y += P('Animations', 'Rotation Y') * DEG; hand.rotation.z += P('Animations', 'Rotation Z') * DEG;
    hand.scale.setScalar(P('Animations', 'Size'));
  } else hand.scale.setScalar(1);
}

function render(aW, aP, dt) {
  rebuild();
  const p = player;
  // lighting (Fullbright)
  const fb = on('Fullbright') ? P('Fullbright', 'Gamma') / 16 : 0;
  hemi.intensity = .55 + fb * 1.1; moonLight.intensity = .55 + fb * .5;
  const blind = p.blind > 0 && !(on('No Render') && P('No Render', 'Blindness'));
  scene.fog.near = blind ? 1 : 40 + fb * 60; scene.fog.far = blind ? 6 : 150 + fb * 150;
  // camera
  const pos = p.prev.clone().lerp(p.pos, aP);
  eyeSmooth = lerp(eyeSmooth, p.eyeH, .3);
  const eye = new THREE.Vector3(pos.x, pos.y + eyeSmooth, pos.z);
  bob += p.bps * dt * 1.7 * (p.onGround ? 1 : 0);
  hurtRoll = lerp(hurtRoll, p.hurtTime > 0 ? (p.hurtTime / 10) * .12 : 0, .35);
  const dir = dirFrom(p.yaw, p.pitch);
  camera.rotation.set(p.pitch * DEG, p.yaw * DEG, 0);
  if (ui.camMode === 0) {
    const b = Math.min(1, p.bps / 5.6) * .035;
    camera.position.copy(eye).add(new THREE.Vector3(Math.cos(p.yaw * DEG) * Math.sin(bob) * b, -Math.abs(Math.cos(bob)) * b, -Math.sin(p.yaw * DEG) * Math.sin(bob) * b));
    camera.rotation.z = hurtRoll;
  } else {
    const back = ui.camMode === 1 ? dir.clone().negate() : dir.clone();
    let dist = 4;
    if (!on('Camera Clip')) { const h = raycastBlocks(eye, back, 4); if (h) dist = Math.max(.3, h.t - .2); }
    camera.position.copy(eye).addScaledVector(back, dist);
    if (ui.camMode === 2) camera.lookAt(eye);
    camera.rotation.z = 0;
  }
  // FOV
  let targetFov = opts.fov;
  if (!on('No FOV')) targetFov *= (p.sprinting ? 1.15 : 1) * (on('Speed') || on('Flight') ? 1.05 : 1);
  if (on('Zoom')) targetFov = P('Zoom', 'Zoom FOV');
  fovNow = lerp(fovNow, targetFov, on('Zoom') ? .2 : .12);
  if (Math.abs(camera.fov - fovNow) > .01) { camera.fov = fovNow; camera.updateProjectionMatrix(); }
  // entities
  const freeze = on('Blink') && P('Blink', 'Incoming');
  npcs.forEach(n => { if (!freeze) n.render(aW); });
  p.render(aP, ui.camMode);
  projectiles.forEach(pr => pr.mesh.position.copy(pr.prev.clone().lerp(pr.pos, aW)));
  drops.forEach(d => { d.sprite.position.set(d.pos.x, d.pos.y + .25 + Math.sin(d.age * .1) * .05, d.pos.z); });
  // block highlight
  const look = raycastBlocks(eye, dir, on('Reach') ? P('Reach', 'Block Reach') : 4.5);
  hl.visible = !!look && look.type !== 'ground' && ui.camMode === 0 && !ui.anyOpen();
  if (hl.visible) { const h = blockH(look.type); hl.scale.set(1, h, 1); hl.position.set(look.x + .5, look.y + h / 2, look.z + .5); }
  nukeBox.visible = !!p.nuke; if (p.nuke) nukeBox.position.set(p.nuke.pos[0] + .5, p.nuke.pos[1] + .5, p.nuke.pos[2] + .5);
  // ESP / tracers / backtrack
  const c1 = new THREE.Color(rgb(P('Interface', 'Primary Color')));
  npcs.forEach((n, i) => {
    if (!espBoxes[i]) { espBoxes[i] = boxLines(.66, 1.86, 0xffffff); const bar = new THREE.Mesh(new THREE.PlaneGeometry(.08, 1.8), new THREE.MeshBasicMaterial({ color: 0x55ff55, depthTest: false })); bar.renderOrder = 11; scene.add(bar); espBars[i] = bar; tracers[i] = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), tracerMat); tracers[i].renderOrder = 10; scene.add(tracers[i]); btBoxes[i] = boxLines(.6, 1.8, 0xffffff); btBoxes[i].material.opacity = .5; }
    const np = freeze ? n.model.root.position : n.prev.clone().lerp(n.pos, aW), show = on('ESP') && n.alive;
    espBoxes[i].visible = show && P('ESP', 'Boxes'); espBoxes[i].position.set(np.x, np.y + .9, np.z); espBoxes[i].material.color.copy(n.hurtTime > 0 ? new THREE.Color(0xff4444) : c1);
    const bar = espBars[i]; bar.visible = show && P('ESP', 'Health Bar');
    if (bar.visible) { const f = n.health / n.maxHealth; bar.scale.y = Math.max(.01, f); bar.quaternion.copy(camera.quaternion); const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); bar.position.set(np.x, np.y + .9 * f, np.z).addScaledVector(right, -.45); bar.material.color.setHSL(f * .33, 1, .5); }
    const tr = tracers[i]; tr.visible = show && P('ESP', 'Tracers');
    if (tr.visible) { const a = camera.position.clone().add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(.3)); tr.geometry.setFromPoints([a, new THREE.Vector3(np.x, np.y + .9, np.z)]); tr.material.color.copy(c1); }
    const hp = p.hitPos(n), bb = btBoxes[i]; bb.visible = on('Backtrack') && n.alive && hp !== n.pos && hp.distanceTo(n.pos) > .05;
    if (bb.visible) bb.position.set(hp.x, hp.y + .9, hp.z);
  });
  // server-side ghost (Blink / Fake Lag)
  ghostBox.visible = p.serverPos.distanceTo(p.pos) > .08; ghostBox.position.set(p.serverPos.x, p.serverPos.y + .9, p.serverPos.z); ghostBox.material.color.copy(c1);
  // KillAura target marker
  const kt = p.kaTarget;
  markerRing.visible = !!(on('KillAura') && P('KillAura', 'Show Target') && kt && kt.alive);
  if (markerRing.visible) {
    const u = P('KillAura', 'Utah Shape'); if (u !== markerUtah) { markerUtah = u; setMarkerShape(u); }
    const tpp = kt.prev.clone().lerp(kt.pos, aW), t = performance.now() / 1000;
    markerRing.position.set(tpp.x, tpp.y + .9 + Math.sin(t * 3) * .85, tpp.z); markerRing.rotation.y = t * 1.5; markerRing.material.color.copy(c1);
  }
  // trail
  const tm = on('Trail') ? P('Trail', 'Mode') : null;
  trailLine.visible = tm === 'Line'; trailDots.visible = tm === 'Dots';
  const pts = trailPts.map(v => new THREE.Vector3(v.x, v.y + .05, v.z));
  if (tm === 'Line' && pts.length > 1) { trailLine.geometry.setFromPoints(pts); trailLine.material.color.copy(c1); }
  if (tm === 'Dots' && pts.length) { trailDots.geometry.setFromPoints(pts); trailDots.material.color.copy(c1); }
  trailRings.forEach((r, i) => { const v = pts[pts.length - 1 - i * 3]; r.visible = tm === 'Circle' && !!v; if (r.visible) { r.position.copy(v); r.material.color.copy(c1); r.material.opacity = 1 - i / trailRings.length; } });
  // draw
  renderer.clear(); renderer.render(scene, camera);
  if (ui.camMode === 0 && p.alive) { updateHand(aP); renderer.clearDepth(); handCam.rotation.z = hurtRoll * .5; renderer.render(handScene, handCam); }
}

// ── main loop ────────────────────────────────────────
let last = performance.now(), wAcc = 0, pAcc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(.25, (now - last) / 1000); last = now;
  if (!ui.paused || ui.gui || ui.inv || ui.chat) {
    wAcc += dt * 1000; pAcc += dt * 1000 * (on('Timer') ? P('Timer', 'Speed') : 1);
    let n = 0;
    while (wAcc >= 50 && n++ < 10) { wAcc -= 50; worldTick(); }
    n = 0;
    while (pAcc >= 50 && n++ < 40) {
      pAcc -= 50;
      const tb = player.tb;
      if (tb.frozen > 0) { if (--tb.frozen === 0) for (let i = 0; i < P('Tick Base', 'Max Ticks'); i++) player.tick(); continue; }
      player.tick();
    }
    if (wAcc > 500) wAcc = 0; if (pAcc > 2000) pAcc = 0;
  }
  render(wAcc / 50, clamp(pAcc / 50, 0, 1), dt);
  updateHud(dt);
}
requestAnimationFrame(frame);
