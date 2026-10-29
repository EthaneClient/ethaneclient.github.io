'use strict';
// shared input state (filled by main.js)
const input = { f: 0, s: 0, jump: false, sprint: false, sneak: false, lmb: false, rmb: false };
const opts = { ac: store.get('ac', false), sens: store.get('sens', 100), fov: store.get('fov', 70) };
const stats = { kills: 0, deaths: 0, hits: 0, combo: 0, best: 0, topBps: 0 };
let player = null;

class Player extends Living {
  constructor() {
    super({ pos: SPAWN });
    this.inv = defaultInventory(); this.sel = 0;
    this.attackTicks = 100; this.sprinting = false; this.sneaking = false; this.jumpTicks = 0; this.airTicks = 0;
    this.using = 0; this.useItem = null; this.placeCd = 0; this.brk = null;
    this.serverPos = this.pos.clone(); this.serverYaw = 0; this.serverPitch = 0; this.rotating = false;
    this.absorb = 0; this.fire = 0; this.blind = 0; this.nausea = 0; this.trapCd = 0;
    this.kaTarget = null; this.kaAcc = 0; this.switchCd = 0; this.auraTarget = null; this.auraAcc = 0;
    this.lastTarget = null; this.lastTargetT = 0; this.tap = null; this.swapBack = -1;
    this.soupCd = 0; this.potTimer = 99; this.afCd = 0; this.nuke = null; this.nukeCd = 0; this.bedRebuild = 0;
    this.scafY = 0; this.climb = 0; this.lagHold = 0; this.miley = false; this.tb = { cd: 0, frozen: 0, burst: 0, near: false };
    this.ac = { vl: {}, buf: [], good: this.pos.clone(), lastFlag: 0, air: 0 };
    this.bps = 0; this.lastPos = this.pos.clone(); this.t = 0;
    this.model = makeHumanoid('player'); scene.add(this.model.root);
  }
  held() { return this.inv[this.sel]; }
  heldItem() { const s = this.held(); return s ? ITEMS[s.id] : null; }
  inPit() { return Math.hypot(this.pos.x - ZONES.pit.x, this.pos.z - ZONES.pit.z) < ZONES.pit.r - .3 && this.pos.y < 3; }
  get eyeH() { return this.sneaking ? 1.27 : 1.62; }
  get eye() { return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeH, this.pos.z); }
  look() { return dirFrom(this.yaw, this.pitch); }
  strength() { const it = this.heldItem(), period = 20 / (it && it.speed || 4); return clamp((this.attackTicks + .5) / period, 0, 1); }
  moving() { return input.f !== 0 || input.s !== 0; }
  canMove() { return !ui.chat && (!ui.anyOpen() || on('InventoryMove')); }
  findSlot(pred, hotbarOnly) { for (let i = 0; i < (hotbarOnly ? 9 : 36); i++) { const s = this.inv[i]; if (s && pred(s, ITEMS[s.id])) return i; } return -1; }
  consume(i, n = 1) { const s = this.inv[i]; if (!s) return; s.count -= n; if (s.count <= 0) this.inv[i] = null; ui.dirtyInv = true; }
  give(stack) {
    for (let i = 0; i < 36 && stack.count > 0; i++) { const s = this.inv[i]; if (s && s.id === stack.id && s.count < ITEMS[s.id].max) { const n = Math.min(stack.count, ITEMS[s.id].max - s.count); s.count += n; stack.count -= n; } }
    for (let i = 0; i < 36 && stack.count > 0; i++) if (!this.inv[i]) { this.inv[i] = { id: stack.id, count: stack.count }; stack.count = 0; }
    ui.dirtyInv = true; return stack.count === 0;
  }

  // ── rotations used by modules (silent unless the module says otherwise) ──
  rotate(yaw, pitch, client) {
    this.serverYaw = yaw; this.serverPitch = clamp(pitch, -90, 90); this.rotating = true;
    if (client) { this.yaw = yaw; this.pitch = this.serverPitch; }
  }

  tick() {
    this.prev.copy(this.pos); this.prevYaw = this.yaw; this.rotating = false;
    this.attackTicks++; if (this.hurtTime > 0) this.hurtTime--; if (this.invul > 0) this.invul--; this.sinceHurt++;
    if (this.placeCd > 0) this.placeCd--; if (this.soupCd > 0) this.soupCd--; this.potTimer++; if (this.afCd > 0) this.afCd--;
    if (this.swapBack >= 0) { this.sel = this.swapBack; this.swapBack = -1; }
    if (!this.alive) return;
    if (this.sinceHurt > 80 && this.health < 20 && this.t % 40 === 0) this.health = Math.min(20, this.health + 1);
    this.t++;
    this.effects();
    this.modulesPre();
    this.movement();
    this.modulesPost();
    this.useAndBreak();
    this.network();
    this.anticheat();
    const d = Math.hypot(this.pos.x - this.lastPos.x, this.pos.z - this.lastPos.z);
    if (d < 3) this.bps = lerp(this.bps, d * 20, .25); this.lastPos.copy(this.pos);
    if (this.bps > stats.topBps && this.bps < 200) stats.topBps = this.bps;
    if (this.swing > 0) this.swing = Math.max(0, this.swing - (on('Animations') && P('Animations', 'Smooth Swing') ? .14 : .17));
  }

  effects() {
    if (this.fire > 0) { this.fire--; if (this.fire % 20 === 0) this.damage(1, 'burned to death'); }
    if (this.blind > 0) this.blind--; if (this.nausea > 0) this.nausea--; if (this.trapCd > 0) this.trapCd--;
    const below = typeAt(Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z));
    if (below === 'plate' && this.trapCd === 0) { this.blind = 120; this.nausea = 140; this.fire = 60; this.trapCd = 60; Sound.play('hurt'); chat('<y>[Playground]</y> Trap plate: Blindness, Nausea and Fire applied. Turn on No Render to hide them.'); }
    if (below === 'refill' && this.t % 20 === 0) this.refill();
  }
  refill() {
    const before = JSON.stringify(this.inv); this.inv = defaultInventory(); this.sel = this.sel; ui.dirtyInv = true;
    if (before !== JSON.stringify(this.inv)) { Sound.play('pop'); chat('<g>Inventory restocked.</g>'); }
  }

  // ── modules that run before movement ──
  modulesPre() {
    // Super Knockback taps
    if (this.tap) { if (this.tap.wait > 0) this.tap.wait--; else if (this.tap.hold > 0) this.tap.hold--; else this.tap = null; }
    if (on('Miley Cyrus') && this.t % 2 === 0) this.miley = !this.miley;
    this.autoSoup(); this.autoPot();
    this.killAura(); this.aura();
    this.antiFireball(); this.bedNuker();
    if (on('Scaffold')) { this.rotate(this.yaw + 180, 80, false); this.scaffold(); }
    if (on('Anti Aim') && !this.rotating) this.rotate(this.yaw + rand(-.5, .5) * P('Anti Aim', 'Yaw Range'), rand(-.5, .5) * P('Anti Aim', 'Pitch Range'), false);
    if (!this.rotating) { this.serverYaw = this.yaw; this.serverPitch = this.pitch; }
  }

  movement() {
    const can = this.canMove();
    let f = can ? input.f : 0, s = can ? input.s : 0;
    const jumpKey = can && input.jump;
    if (this.tap && this.tap.wait === 0 && this.tap.hold > 0) f = this.tap.mode === 'W-Tap' ? 0 : -1;
    this.sneaking = can && (input.sneak || (on('Miley Cyrus') && this.miley)) && !on('Flight') && !on('No Clip');
    const slowUse = this.using > 0 && !on('No Slow');
    if (this.sneaking && !on('Sneak')) { f *= .3; s *= .3; }
    if (slowUse) { f *= .2; s *= .2; }
    const wantSprint = (input.sprint || on('Sprint')) && can && f > 0 && (!this.sneaking || on('Sneak')) && !slowUse;
    if (wantSprint && !this.hColF) this.sprinting = true;
    if (f <= 0 || (this.hColF && !on('Spiderman')) || (this.sneaking && !on('Sneak'))) this.sprinting = false;
    const y = this.yaw * DEG, fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
    const strafe = spd => { if (!(f || s)) { this.vel.x = this.vel.z = 0; return; } let mx = fx * f + rx * s, mz = fz * f + rz * s; const l = Math.hypot(mx, mz); this.vel.x = mx / l * spd; this.vel.z = mz / l * spd; };
    const curSpd = () => Math.hypot(this.vel.x, this.vel.z);
    if (on('Flight') && P('Flight', 'Mode') === 'Polar') {
      ghost.clear(); ghost.add(K(Math.floor(this.pos.x), Math.floor(this.pos.y + 1e-3) - 1, Math.floor(this.pos.z)));
    } else if (ghost.size) ghost.clear();

    // No Clip / Motion flight: no gravity, direct velocity
    if (on('No Clip') || (on('Flight') && P('Flight', 'Mode') === 'Motion')) {
      const nc = on('No Clip'), spd = nc ? .4 : P('Flight', 'Speed');
      strafe(spd);
      this.vel.y = jumpKey ? spd / 2 * (nc ? 2 : 1) : (can && input.sneak) ? -spd / 2 * (nc ? 2 : 1) : 0;
      const r = moveEntity(this, this.vel.x, this.vel.y, this.vel.z, nc);
      this.onGround = r.ground; this.fallDist = 0; this.airTicks = this.onGround ? 0 : this.airTicks + 1; this.hColF = false;
      return;
    }
    // normal walking physics (Minecraft 1.21 values)
    const speedAttr = .1 * (this.sprinting ? 1.3 : 1);
    const acc = this.onGround ? speedAttr : (this.sprinting ? .026 : .02);
    let mf = f * .98, ms = s * .98; const l = Math.hypot(mf, ms);
    if (l > 1) { mf /= l; ms /= l; }
    this.vel.x += (fx * mf + rx * ms) * acc; this.vel.z += (fz * mf + rz * ms) * acc;
    // jumping (+ No Jump Delay)
    if (!jumpKey) this.jumpTicks = 0; else if (this.jumpTicks > 0) this.jumpTicks--;
    const doJump = () => { this.vel.y = .42; if (this.sprinting) { this.vel.x += fx * .2; this.vel.z += fz * .2; } this.jumpTicks = on('No Jump Delay') ? P('No Jump Delay', 'Delay') : 10; };
    if (this.jumpReset && this.onGround) { doJump(); this.jumpReset = false; }
    else if (jumpKey && this.onGround && this.jumpTicks === 0) doJump();
    // Speed modes (logic follows the client's mode classes)
    if (on('Speed') && this.moving() && can) {
      const m = P('Speed', 'Mode');
      if (this.onGround && this.vel.y <= 0) doJump();
      if (m === 'Motion') strafe(P('Speed', 'Speed') + (this.onGround ? .05 : 0));
      else if (m === 'Verus') strafe(this.onGround ? rand(.36, .6) : (this.hurtTime > 0 ? .36 * P('Speed', 'Damage multiplier') : .36));
      else if (m === 'Matrix') { if (curSpd() < .195) strafe(.195); if (this.onGround) { this.vel.x *= 1.001; this.vel.z *= 1.001; } }
      else if (m === 'Polar' && this.airTicks === 1) { const v = rand(0, .01); this.vel.x += fx * v; this.vel.z += fz * v; }
    }
    // webs
    let mx = this.vel.x, my = this.vel.y, mz = this.vel.z;
    const web = inBlockType(this, 'web') && !on('No Web');
    if (web) { mx *= .25; my *= .05; mz *= .25; this.fallDist = 0; }
    // sneaking edge safety
    if (this.sneaking && this.onGround) {
      const c = (dx, dz) => collidesAt(this.pos.x + dx, this.pos.y - .6, this.pos.z + dz, this.hw, this.h);
      while (mx && !c(mx, 0)) mx = Math.abs(mx) < .05 ? 0 : mx - Math.sign(mx) * .05;
      while (mz && !c(0, mz)) mz = Math.abs(mz) < .05 ? 0 : mz - Math.sign(mz) * .05;
      while (mx && mz && !c(mx, mz)) { mx = Math.abs(mx) < .05 ? 0 : mx - Math.sign(mx) * .05; mz = Math.abs(mz) < .05 ? 0 : mz - Math.sign(mz) * .05; }
    }
    const wasGround = this.onGround;
    const r = moveEntity(this, mx, my, mz);
    this.onGround = r.ground; this.hColF = r.hitX || r.hitZ;
    if (r.hitX) this.vel.x = 0; if (r.hitZ) this.vel.z = 0; if (r.hitY) this.vel.y = 0;
    if (web) this.vel.set(0, 0, 0);
    // fall damage / launch pad
    if (!this.onGround && r.dy < 0) this.fallDist -= r.dy;
    if (this.onGround) {
      const under = typeAt(Math.floor(this.pos.x), Math.floor(this.pos.y - .01), Math.floor(this.pos.z));
      if (this.fallDist > 3 && !on('No Fall')) this.damage(Math.ceil(this.fallDist - 3), 'hit the ground too hard');
      else if (this.fallDist > 3) chat(`<e>[Ethane]</e> <d>No Fall (${P('No Fall', 'Mode')}) saved you from ${Math.ceil(this.fallDist - 3) / 2} hearts.</d>`, 'nofall');
      this.fallDist = 0;
      if (under === 'pad') { this.vel.y = 1.75; this.vel.z += .35; this.onGround = false; Sound.play('shoot'); }
    }
    this.airTicks = this.onGround ? 0 : this.airTicks + 1;
    // gravity + friction
    this.vel.y = (this.vel.y - .08) * .98;
    const fr = this.onGround ? .546 : .91;
    this.vel.x *= fr; this.vel.z *= fr;
    if (on('Fast Stop') && !(f || s) && (!P('Fast Stop', 'Ground only') || this.onGround)) { this.vel.x = this.vel.z = 0; }
    // Spiderman
    if (on('Spiderman') && this.hColF && f > 0) { if (++this.climb >= P('Spiderman', 'Climb Delay')) { this.vel.y = P('Spiderman', 'Jump Motion'); this.climb = 0; } }
    if (this.pos.y < -40) { if (on('No Fall')) this.vel.set(0, 0, 0); this.die('fell out of the world'); }
  }

  modulesPost() {
    // drops pickup
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; if (d.delay > 0) continue;
      if (d.pos.distanceTo(this.center()) < 1.5 && this.give({ ...d.stack })) { scene.remove(d.sprite); drops.splice(i, 1); Sound.play('pop'); }
    }
  }

  // ── network-ish: Blink / Fake Lag decide where the "server" sees you ──
  network() {
    if (on('Blink') && P('Blink', 'Outgoing')) return;
    if (on('Fake Lag')) {
      if (--this.lagHold <= 0) { this.serverPos.copy(this.pos); this.lagHold = Math.round(rand(P('Fake Lag', 'Min Pulse Ticks'), Math.max(P('Fake Lag', 'Min Pulse Ticks'), P('Fake Lag', 'Max Pulse Ticks')))); }
      return;
    }
    this.serverPos.copy(this.pos);
  }

  // ── combat ───────────────────────────────────
  hitPos(n) { // Backtrack: entities can be hit where they were
    if (!on('Backtrack') || !n.hist.length) return n.pos;
    if (n.pos.distanceTo(this.pos) > P('Backtrack', 'Range')) return n.pos;
    const back = Math.min(n.hist.length - 1, Math.round(P('Backtrack', 'Max Delay') / 50 * .25));
    return n.hist[n.hist.length - 1 - back];
  }
  attack(target) {
    if (!target || !target.alive) return;
    const it = this.heldItem();
    // Auto Shield Break: swap to the axe for this hit
    if (on('Auto Shield Break') && target.blocking && this.facingShield(target) && (!it || it.kind !== 'axe')) {
      const ax = this.findSlot((s, i) => i.kind === 'axe', true);
      if (ax >= 0) { this.swapBack = this.sel; this.sel = ax; }
    }
    const item = this.heldItem(), st = this.strength();
    const reach = distToBox(this.eye, target.box(this.hitPos(target)));
    this.swing = 1; Sound.play('swing');
    if (opts.ac && !on('Disabler') && reach > 3.05) { this.flag('Reach', false); this.attackTicks = 0; return; }
    let dmg = (item && item.dmg || 1) * (.2 + st * st * .8);
    const crit = st > .9 && ((this.fallDist > 0 && !this.onGround && !this.sprinting) || on('Criticals'));
    if (crit) dmg *= 1.5;
    if (target.blocking && this.facingShield(target)) {
      if (item && item.kind === 'axe') {
        target.shieldDown = 100; target.blocking = false; Sound.play('shieldbreak');
        if (on('Auto Shield Break') && P('Auto Shield Break', 'Notify')) chat(`<e>[Ethane]</e> Broke ${target.name}'s shield.`);
      } else Sound.play('block');
      this.attackTicks = 0; this.markTarget(target); return;
    }
    const kb = .4 + ((this.sprinting || on('Super Knockback')) ? .5 : 0);
    if (hurtNpc(target, dmg, this.pos, kb)) {
      stats.hits++; stats.combo++; stats.best = Math.max(stats.best, stats.combo);
      Sound.play(crit ? 'crit' : 'hit');
      const c = target.center(); Particles.spawn(c.x, c.y + .3, c.z, crit ? '#c9f3ff' : '#dddddd', crit ? 16 : 0, .25, .01, 14);
      if (crit) Particles.spawn(c.x, c.y + .3, c.z, '#2fb4ff', 10, .3, .01, 16);
    }
    if (this.sprinting || on('Super Knockback')) {
      if (!(on('Keep Sprint') && P('Keep Sprint', 'Keep Motion'))) { this.vel.x *= .6; this.vel.z *= .6; }
      if (!(on('Keep Sprint') && P('Keep Sprint', 'Keep Sprint'))) this.sprinting = false;
    }
    if (on('Super Knockback')) this.tap = { mode: P('Super Knockback', 'Mode'), wait: P('Super Knockback', 'Wait'), hold: P('Super Knockback', 'Hold') };
    this.attackTicks = 0; this.markTarget(target);
  }
  markTarget(t) { this.lastTarget = t; this.lastTargetT = this.t; }
  facingShield(n) { const toMe = rotTo(n.pos, this.pos).yaw; return Math.abs(wrapDeg(toMe - n.yaw)) < 90; }
  sorted(list) {
    const eye = this.eye, by = P('KillAura', 'Sorting');
    return list.sort((a, b) => by === 'Health' ? a.health - b.health : by === 'Hurt Time' ? a.hurtTime - b.hurtTime : distToBox(eye, a.box()) - distToBox(eye, b.box()));
  }
  killAura() {
    if (!on('KillAura')) { this.kaTarget = null; return; }
    if (P('KillAura', 'No GUI') && ui.anyOpen()) return;
    const it = this.heldItem();
    if (P('KillAura', 'Swords Only') && (!it || it.kind !== 'sword')) { this.kaTarget = null; return; }
    const eye = this.eye, fov = P('KillAura', 'FOV');
    const cands = this.sorted(npcs.filter(n => n.alive && distToBox(eye, n.box(this.hitPos(n))) <= P('KillAura', 'Rotation Range')
      && (fov >= 180 || Math.abs(wrapDeg(rotTo(eye, n.center()).yaw - this.yaw)) <= fov / 2)
      && (P('KillAura', 'Through Walls') || visible(eye, n.center(this.hitPos(n))))));
    if (!cands.length) { this.kaTarget = null; return; }
    const tm = P('KillAura', 'Target Mode');
    if (tm === 'Best' || !this.kaTarget || !cands.includes(this.kaTarget)) this.kaTarget = cands[0];
    else if (tm === 'Switch' && this.switchCd <= 0) { this.kaTarget = cands[(cands.indexOf(this.kaTarget) + 1) % cands.length]; this.switchCd = 6; }
    this.switchCd--;
    const t = this.kaTarget, b = t.box(this.hitPos(t));
    const aim = closestOnBox(eye, b); aim.y = clamp(aim.y, b[1] + .4, b[4] - .2);
    const r = rotTo(eye, aim); if (P('KillAura', 'Jitter Pitch')) r.pitch += rand(-1.5, 1.5);
    const mode = P('KillAura', 'Rotation Mode'), client = P('KillAura', 'Client Side');
    const cur = client ? { yaw: this.yaw, pitch: this.pitch } : { yaw: this.serverYaw, pitch: this.serverPitch };
    let ny = cur.yaw, np = cur.pitch;
    if (mode === 'Simple') { ny = r.yaw; np = r.pitch; }
    else if (mode === 'Smooth') { const st = P('KillAura', 'Smooth Speed') * 3; ny = cur.yaw + clamp(wrapDeg(r.yaw - cur.yaw), -st, st); np = cur.pitch + clamp(r.pitch - cur.pitch, -st, st); }
    this.kaAcc += rand(P('KillAura', 'Min CPS'), Math.max(P('KillAura', 'Min CPS'), P('KillAura', 'Max CPS'))) / 20;
    const click = this.kaAcc >= 1; if (click) this.kaAcc = Math.min(this.kaAcc - 1, 1);
    if (mode === 'Snap' && click) { ny = r.yaw; np = r.pitch; }
    if (mode !== 'None') this.rotate(ny, np, client);
    if (!click) return;
    const inRange = distToBox(eye, b) <= P('KillAura', 'Attack Range');
    const aimed = mode === 'None' || Math.abs(wrapDeg(r.yaw - ny)) < 35;
    if (inRange && aimed) this.attack(t);
    else if (P('KillAura', 'Swing Misses')) { this.swing = 1; this.attackTicks = 0; }
  }
  aura() {
    if (!on('Aura')) { this.auraTarget = null; return; }
    const eye = this.eye, t = npcs.filter(n => n.alive).sort((a, b) => distToBox(eye, a.box()) - distToBox(eye, b.box()))[0];
    const reachOf = n => P('Aura', 'Dynamic reach') && n.hurtTime > 0 ? P('Aura', 'Hurt reach') : P('Aura', 'Reach');
    if (!t || distToBox(eye, t.box(this.hitPos(t))) > reachOf(t) + 1.5) { this.auraTarget = null; return; }
    this.auraTarget = t;
    const b = t.box(this.hitPos(t)), aim = closestOnBox(eye, b); aim.y = clamp(aim.y, b[1] + .5, b[4] - .3);
    const r = rotTo(eye, aim), rm = P('Aura', 'Rotations');
    let ny = this.serverYaw, np = this.serverPitch;
    const dy = wrapDeg(r.yaw - ny), dp = r.pitch - np;
    if (rm === 'Linear') { ny += clamp(dy, -18, 18); np += clamp(dp, -12, 12); }
    else if (rm === 'Adaptive') { ny += dy * .45; np += dp * .45; }
    else if (rm === 'Advanced') { const g = P('Aura', 'Gravity') / 20, w = P('Aura', 'Wind'); ny += dy * g + rand(-w, w) * .4; np += dp * g + rand(-w, w) * .25; }
    if (rm !== 'None') {
      const lock = P('Aura', 'Lock view');
      const prevY = this.yaw, prevP = this.pitch;
      this.rotate(ny, np, lock);
      if (!lock) { // view influence
        this.yaw = prevY + clamp(wrapDeg(ny - prevY) * P('Aura', 'Yaw Influence %') / 100, -P('Aura', 'Yaw Influence Cap'), P('Aura', 'Yaw Influence Cap'));
        this.pitch = clamp(prevP + clamp((np - prevP) * P('Aura', 'Pitch Influence %') / 100, -P('Aura', 'Pitch Influence Cap'), P('Aura', 'Pitch Influence Cap')), -90, 90);
      }
    }
    const hs = P('Aura', 'Hit select');
    let cps = hs ? 20 : rand(P('Aura', 'Min CPS'), Math.max(P('Aura', 'Min CPS'), P('Aura', 'Max CPS')));
    if (P('Aura', 'Clicking mode') === 'Butterfly') cps *= rand(.6, 1.6);
    this.auraAcc += cps / 20; if (this.auraAcc < 1) return; this.auraAcc = Math.min(this.auraAcc - 1, 1);
    if (hs) {
      const ok = P('Aura', 'Hit select mode') === 'Server' ? t.invul <= 10 : (t.hurtTime === 0 || this.hurtTime > 0);
      if (!ok) return;
      if (P('Aura', 'Perfect criticals') && (this.onGround || this.vel.y > 0)) return;
    }
    if (distToBox(eye, b) > reachOf(t)) return;
    if (P('Aura', 'Ray cast') && rayBox(eye, dirFrom(ny, np), b) == null) return;
    if (!P('Aura', 'Swing')) this.swing = 0;
    this.attack(t);
  }
  autoSoup() {
    if (!on('AutoSoup') || this.health >= P('AutoSoup', 'Health') || this.soupCd > 0) return;
    const i = this.findSlot(s => s.id === 'soup', true); if (i < 0) return;
    this.swapBack = this.sel; this.sel = i; this.health = Math.min(20, this.health + 7); this.soupCd = 3;
    Sound.play('eat'); setTimeout(() => Sound.play('burp'), 120);
    if (P('AutoSoup', 'Drop Bowl')) { this.inv[i] = null; const d = this.look(); dropItem(S('bowl'), this.eye.add(d.multiplyScalar(.5)), d.multiplyScalar(.6)); }
    else this.inv[i] = S('bowl');
    ui.dirtyInv = true;
  }
  autoPot() {
    if (!on('AutoPot') || this.health >= P('AutoPot', 'Health Threshold') || this.potTimer < P('AutoPot', 'Throw Delay')) return;
    const i = this.findSlot(s => s.id === 'potion', true); if (i < 0) return;
    this.swapBack = this.sel; this.sel = i; this.rotate(this.yaw, 90, false);
    throwItem('potion', this.eye, new THREE.Vector3(0, -1, 0)); this.consume(i); this.potTimer = 0; this.swing = 1;
  }
  antiFireball() {
    if (!on('Anti Fireball') || this.afCd > 0) return;
    const fb = projectiles.find(p => p.type === 'fireball' && p.owner === 'turret' && p.pos.distanceTo(this.eye) <= P('Anti Fireball', 'Range'));
    if (!fb) return;
    const r = rotTo(this.eye, fb.pos); this.rotate(r.yaw, r.pitch, false);
    this.deflect(fb); this.afCd = 4;
  }
  deflect(fb) {
    const tgt = new THREE.Vector3(ZONES.turret[0] + .5, ZONES.turret[1] + .5, ZONES.turret[2] + .5);
    fb.vel = (on('Anti Fireball') ? tgt.sub(fb.pos) : this.look()).normalize().multiplyScalar(.6); fb.owner = 'player';
    this.swing = 1; this.attackTicks = 0; Sound.play('hit');
  }
  bedNuker() {
    if (this.bedRebuild > 0 && --this.bedRebuild === 0) { buildBedFort(); rebuild(); chat('<y>[Playground]</y> The bed fort has been rebuilt.'); }
    if (!on('BedNuker')) { this.nuke = null; return; }
    if (P('BedNuker', 'No KillAura') && (this.kaTarget || this.auraTarget)) return;
    if (this.nukeCd > 0) { this.nukeCd--; return; }
    const range = P('BedNuker', 'Range'), eye = this.eye;
    let bed = null, bd = 1e9;
    blocks.forEach((t, k) => { if (!BT[t].bed) return; const [x, y, z] = k.split(',').map(Number); const d = eye.distanceTo(new THREE.Vector3(x + .5, y + .3, z + .5)); if (d <= range && d < bd) { bd = d; bed = [x, y, z]; } });
    if (!bed) { this.nuke = null; return; }
    let tgt = bed;
    if (P('BedNuker', 'Mode') === 'Hypixel') { // dig through what covers the bed first
      const above = [bed[0], bed[1] + 1, bed[2]];
      if (blocks.has(K(...above))) { tgt = above; for (let y = bed[1] + 1; blocks.has(K(bed[0], y + 1, bed[2])) && y < bed[1] + 4; y++) tgt = [bed[0], y + 1, bed[2]]; }
    }
    const key = K(...tgt);
    if (!this.nuke || this.nuke.key !== key) this.nuke = { key, pos: tgt, prog: 0 };
    const t = blocks.get(key), r = rotTo(eye, new THREE.Vector3(tgt[0] + .5, tgt[1] + .5, tgt[2] + .5));
    this.rotate(r.yaw, r.pitch, false);
    this.nuke.prog += this.breakSpeed(t, this.bestToolFor(t));
    this.swing = 1; if (this.t % 4 === 0) Sound.play('dig');
    if (this.nuke.prog >= 1) { this.breakBlock(...tgt); this.nuke = null; this.nukeCd = P('BedNuker', 'Delay'); }
  }
  scaffold() {
    if (P('Scaffold', 'Right Click Only') && !input.rmb) return;
    let slot = this.findSlot((s, i) => !!i.block && i.block !== 'web', true);
    if (slot < 0) { const m = this.findSlot((s, i) => !!i.block && i.block !== 'web'); if (m >= 0) { const tmp = this.inv[8]; this.inv[8] = this.inv[m]; this.inv[m] = tmp; slot = 8; ui.dirtyInv = true; } }
    if (slot < 0) return;
    const towering = input.jump && !this.moving() && P('Scaffold', 'Tower Mode') !== 'None';
    if (!P('Scaffold', 'Keep Y') || towering || this.pos.y - 1 < this.scafY) this.scafY = Math.floor(this.pos.y - .01);
    const x = Math.floor(this.pos.x + this.vel.x), z = Math.floor(this.pos.z + this.vel.z), y = this.scafY;
    const cells = [[x, y, z], [Math.floor(this.pos.x), y, Math.floor(this.pos.z)]];
    for (const [cx, cy, cz] of cells) {
      if (isSolid(cx, cy, cz)) continue;
      const nb = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]].some(([a, b, c]) => isSolid(cx + a, cy + b, cz + c));
      if (!nb || this.eye.distanceTo(new THREE.Vector3(cx + .5, cy + .5, cz + .5)) > P('Scaffold', 'Block Reach')) continue;
      if (boxOverlapsCell(this, cx, cy, cz)) continue;
      this.sel = slot; setBlock(cx, cy, cz, ITEMS[this.inv[slot].id].block); rebuild(); this.consume(slot); this.swing = 1; Sound.play('place');
      if (towering && P('Scaffold', 'Tower Mode') === 'Vanilla' && this.vel.y < .2) this.vel.y = .42;
      break;
    }
  }

  // ── item use / mining ────────────────────────
  bestToolFor(t) { const d = BT[t] || {}; return this.findSlot((s, i) => i.kind === d.tool, true); }
  breakSpeed(t, slot) {
    const d = BT[t]; if (!d || d.hard < 0) return 0; if (d.hard === 0) return 1;
    const s = slot >= 0 ? this.inv[slot] : this.held(), it = s ? ITEMS[s.id] : null;
    let sp = 1, right = it && it.kind === d.tool;
    if (right) sp = d.tool === 'sword' ? 15 : 8;
    if (t === 'wool' && it && it.kind === 'sword') sp = 1.5;
    return sp / d.hard / ((!d.need || right) ? 30 : 100);
  }
  breakBlock(x, y, z) {
    const t = blocks.get(K(x, y, z)); if (!t) return;
    setBlock(x, y, z, null);
    if (BT[t].bed) { const other = [[0, 0, 1], [0, 0, -1]].map(([a, b, c]) => [x + a, y + b, z + c]).find(p => BT[blocks.get(K(...p))] && BT[blocks.get(K(...p))].bed); if (other) setBlock(...other, null); Sound.play('bedbreak'); chat('<r>BED DESTRUCTION > Your bed was destroyed by You!</r> <d>Rebuilding in 5s.</d>'); this.bedRebuild = 100; }
    else Sound.play(BT[t].sound || 'break');
    rebuild();
    Particles.spawn(x + .5, y + .5, z + .5, t === 'wool' ? '#2496eb' : t === 'stone' ? '#8a8a8a' : t === 'planks' ? '#a8844f' : t === 'glass' ? '#cfefff' : t === 'endstone' ? '#dddfa5' : '#bbbbbb', 18, .12, .02, 22);
    if (['wool', 'planks', 'dirt', 'web'].includes(t) && t !== 'web') dropItem(S(t), new THREE.Vector3(x + .5, y + .5, z + .5));
  }
  targetEntity(reach) {
    const eye = this.eye, d = this.look();
    let best = null, bt = reach;
    for (const n of npcs) { if (!n.alive) continue; const t = rayBox(eye, d, n.box(this.hitPos(n))); if (t != null && t <= bt) { bt = t; best = n; } }
    for (const p of projectiles) { if (p.type !== 'fireball') continue; const b = [p.pos.x - .5, p.pos.y - .5, p.pos.z - .5, p.pos.x + .5, p.pos.y + .5, p.pos.z + .5]; const t = rayBox(eye, d, b); if (t != null && t <= bt) { bt = t; best = p; } }
    const blk = raycastBlocks(eye, d, bt); if (best && blk && blk.t < bt) return null;
    return best;
  }
  click() { // left mouse press
    if (!this.alive) return;
    const reach = on('Reach') ? P('Reach', 'Attack Reach') : 3;
    const t = this.targetEntity(on('Reach') ? reach : 3);
    if (t && t.type === 'fireball') { this.deflect(t); return; }
    if (t) { this.attack(t); return; }
    this.swing = 1; this.attackTicks = 0; Sound.play('swing');
  }
  useAndBreak() {
    const can = !ui.anyOpen() && !ui.chat, eye = this.eye, d = this.look(), it = this.heldItem();
    const reach = on('Reach') ? P('Reach', 'Block Reach') : 4.5;
    // mining
    if (can && input.lmb && !this.targetEntity(3)) {
      const hit = raycastBlocks(eye, d, reach);
      if (hit && hit.type !== 'ground') {
        const key = K(hit.x, hit.y, hit.z);
        if (!this.brk || this.brk.key !== key) {
          this.brk = { key, x: hit.x, y: hit.y, z: hit.z, prog: 0 };
          if (on('Auto Tool') && (!P('Auto Tool', 'Only When Sneaking') || this.sneaking)) { const ts = this.bestToolFor(hit.type); if (ts >= 0) this.sel = ts; }
        }
        this.brk.prog += this.breakSpeed(hit.type, -1);
        if (this.t % 4 === 0) { this.swing = 1; Sound.play('dig'); }
        if (this.brk.prog >= 1) { this.breakBlock(hit.x, hit.y, hit.z); this.brk = null; }
      } else this.brk = null;
    } else this.brk = null;
    // eating
    if (this.using > 0) {
      if (!(can && input.rmb) || !it || !it.food) { this.using = 0; }
      else if (--this.using === 0) {
        if (this.held().id === 'gapple') { this.health = Math.min(20, this.health + 4); this.absorb = 4; }
        this.consume(this.sel); Sound.play('burp');
      } else if (this.using % 4 === 0) Sound.play('eat');
    }
    if (!(can && input.rmb) || this.placeCd > 0 || !it) return;
    if (it.block) {
      const hit = raycastBlocks(eye, d, reach); if (!hit) return;
      const [x, y, z] = [hit.x + hit.n[0], hit.y + hit.n[1], hit.z + hit.n[2]];
      if (typeAt(x, y, z) || boxOverlapsCell(this, x, y, z)) return;
      setBlock(x, y, z, it.block); rebuild(); this.consume(this.sel); this.swing = 1; Sound.play('place');
      this.placeCd = on('Fast Place') ? P('Fast Place', 'Delay') : 4;
    } else if (it.food && this.using === 0) {
      if (this.held().id === 'soup') { this.health = Math.min(20, this.health + 7); this.inv[this.sel] = S('bowl'); Sound.play('burp'); this.placeCd = 4; ui.dirtyInv = true; }
      else if (this.health < 20 || this.held().id === 'gapple') this.using = it.food;
    } else if (it.throwable) {
      throwItem(this.held().id, eye.clone().add(d.clone().multiplyScalar(.3)), d); this.consume(this.sel); this.swing = 1; this.placeCd = 4; Sound.play(this.held() && this.held().id === 'pearl' ? 'pearl' : 'swing');
    }
  }
  dropHeld(all) {
    const s = this.held(); if (!s) return;
    const n = all ? s.count : 1, d = this.look();
    dropItem({ id: s.id, count: n }, this.eye.add(d.clone().multiplyScalar(.4)), d.multiplyScalar(.35)); this.consume(this.sel, n);
  }

  // ── health ───────────────────────────────────
  damage(n, cause) {
    if (!this.alive || n <= 0) return;
    if (this.absorb > 0) { const a = Math.min(this.absorb, n); this.absorb -= a; n -= a; }
    this.health -= n; this.hurtTime = 10; this.sinceHurt = 0; stats.combo = 0;
    ui.hurt(); Sound.play('hurt');
    if (this.health <= 0) this.die(cause);
  }
  die(cause) {
    if (!this.alive) return;
    this.alive = false; this.health = 0; stats.deaths++;
    chat(`<r>You ${cause || 'died'}.</r>`);
    ui.death(cause);
    setTimeout(() => this.respawn(), 1600);
  }
  respawn() {
    this.pos.copy(SPAWN); this.prev.copy(SPAWN); this.vel.set(0, 0, 0); this.serverPos.copy(SPAWN);
    this.health = 20; this.absorb = 0; this.fire = this.blind = this.nausea = 0; this.alive = true; this.fallDist = 0;
    this.yaw = 0; this.pitch = 0; this.inv = defaultInventory(); ui.dirtyInv = true; ui.death(null);
    this.ac.good.copy(SPAWN);
  }

  // ── simulated anticheat ("Sentinel") ─────────
  flag(check, setback = true) {
    const v = this.ac.vl[check] = (this.ac.vl[check] || 0) + 1;
    chat(`<r>[Sentinel]</r> You failed <y>${check}</y> <d>(VL ${v})</d>`); Sound.play('flag'); this.ac.lastFlag = this.t;
    if (setback) { this.pos.copy(this.ac.good); this.prev.copy(this.pos); this.vel.set(0, 0, 0); }
  }
  anticheat() {
    if (!opts.ac || on('Disabler')) { this.ac.good.copy(this.pos); return; }
    const sp = Math.hypot(this.pos.x - this.prev.x, this.pos.z - this.prev.z);
    this.ac.buf.push(sp); if (this.ac.buf.length > 12) this.ac.buf.shift();
    const avg = this.ac.buf.reduce((a, b) => a + b, 0) / this.ac.buf.length;
    if (this.ac.buf.length === 12 && avg > .335 && this.t - this.ac.lastFlag > 10) { this.ac.buf.length = 0; return this.flag('Speed'); }
    const dy = this.pos.y - this.prev.y;
    this.ac.air = this.onGround || inBlockType(this, 'web') ? 0 : this.ac.air + 1;
    if (this.ac.air > 25 && dy > -.05 && this.vel.y > -.5 && this.t - this.ac.lastFlag > 10 && !(this.fallDist === 0 && this.vel.y > .5)) { this.ac.air = 0; return this.flag('Fly'); }
    if (this.using > 0 && sp > .13 && on('No Slow') && P('No Slow', 'Mode') === 'Vanilla' && this.t - this.ac.lastFlag > 20) return this.flag('NoSlow', false);
    if (on('Timer') && P('Timer', 'Speed') > 1.05 && this.t % 40 === 0) return this.flag('Timer');
    if (this.t % 20 === 0 && this.t - this.ac.lastFlag > 20 && this.onGround) this.ac.good.copy(this.pos);
  }

  render(a, camMode) {
    const m = this.model;
    m.root.visible = camMode !== 0;
    const p = this.prev.clone().lerp(this.pos, a);
    m.root.position.copy(p);
    const yaw = this.serverYaw;
    this.bodyYaw += wrapDeg(yaw - this.bodyYaw) * (on('Anti Aim') ? 1 : .35);
    m.g.rotation.y = this.bodyYaw * DEG;
    m.head.rotation.set(this.serverPitch * DEG, (yaw - this.bodyYaw) * DEG, 0);
    const sp = Math.hypot(this.pos.x - this.prev.x, this.pos.z - this.prev.z);
    this.limbAmp = lerp(this.limbAmp, Math.min(1, sp * 5), .2); this.limb += sp * 3.2;
    const sw = Math.sin(this.limb) * .9 * this.limbAmp;
    m.legL.rotation.x = sw; m.legR.rotation.x = -sw; m.armL.rotation.x = -sw * .8; m.armR.rotation.x = sw * .8;
    if (this.swing > 0) m.armR.rotation.x = -Math.sin(this.swing * Math.PI) * 1.6;
    m.g.rotation.x = this.sneaking ? .35 : 0; m.g.position.y = this.sneaking ? -.15 : 0;
    setTint(m, this.hurtTime > 0 ? 1 : 0);
  }
}
const boxOverlapsCell = (e, x, y, z) => e.pos.x + e.hw > x && e.pos.x - e.hw < x + 1 && e.pos.y + e.h > y && e.pos.y < y + 1 && e.pos.z + e.hw > z && e.pos.z - e.hw < z + 1;

// ── damage to NPCs + NPC attacks on the player ───────
function hurtNpc(n, dmg, from, kb) {
  if (!n.alive) return false;
  if (n.invul > 10) { if (dmg <= n.lastDmg) return false; n.health -= dmg - n.lastDmg; n.lastDmg = dmg; }
  else { n.health -= dmg; n.lastDmg = dmg; n.invul = 20; n.hurtTime = 10; }
  n.sinceHurt = 0;
  const d = new THREE.Vector3(n.pos.x - from.x, 0, n.pos.z - from.z); if (d.lengthSq() < 1e-6) d.set(Math.random() - .5, 0, Math.random() - .5); d.normalize();
  n.vel.x = n.vel.x / 2 + d.x * kb; n.vel.z = n.vel.z / 2 + d.z * kb; if (n.onGround) n.vel.y = Math.min(.4, n.vel.y / 2 + .4);
  if (n.health <= 0) { n.health = 0; n.alive = false; n.deathTime = 0; stats.kills++; chat(`<d>${n.name} was slain by You</d>`); Particles.spawn(n.pos.x, n.pos.y + 1, n.pos.z, '#ffffff', 25, .12, -.005, 30); }
  return true;
}
function attackPlayer(npc, dmg) {
  const p = player; if (!p.alive || p.invul > 10) return;
  p.invul = 20;
  p.damage(dmg, `were slain by ${npc.name}`); if (!p.alive) return;
  // knockback, then the Velocity module
  const d = new THREE.Vector3(p.pos.x - npc.pos.x, 0, p.pos.z - npc.pos.z).normalize(), kb = .4 + .5 * .6;
  const nv = new THREE.Vector3(p.vel.x / 2 + d.x * kb, p.onGround ? Math.min(.4, p.vel.y / 2 + .4) : p.vel.y, p.vel.z / 2 + d.z * kb);
  if (on('Blink') && P('Blink', 'Incoming')) { p.pendingKb = nv; return; }
  if (!on('Velocity')) { p.vel.copy(nv); return; }
  const m = P('Velocity', 'Mode');
  if (m === 'Cancel') { if (opts.ac && !on('Disabler')) p.flag('Velocity', false); return; }
  if (m === 'Reversed') { p.vel.set(-nv.x, nv.y, -nv.z); return; }
  if (m === 'Custom') { const xz = P('Velocity', 'X/Z multiplier'), y = P('Velocity', 'Y multiplier'); p.vel.set(p.vel.x + (nv.x - p.vel.x) * xz, p.vel.y + (nv.y - p.vel.y) * y, p.vel.z + (nv.z - p.vel.z) * xz); return; }
  p.vel.copy(nv); if (p.onGround) { p.jumpReset = true; p.vel.x *= .6; p.vel.z *= .6; }
}
