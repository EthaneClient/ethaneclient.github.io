'use strict';
// ── utils ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const DEG = Math.PI / 180;
const wrapDeg = a => { a %= 360; if (a >= 180) a -= 360; if (a < -180) a += 360; return a; };
const dirFrom = (yaw, pitch) => {
  const y = yaw * DEG, p = pitch * DEG;
  return new THREE.Vector3(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
};
const rotTo = (from, to) => {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  return { yaw: Math.atan2(-dx, -dz) / DEG, pitch: Math.atan2(dy, Math.hypot(dx, dz)) / DEG };
};
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t));
// ColorUtil.getWaveColor from the client
const wave = (offset) => {
  const f = (Math.sin(performance.now() / 1000 * 3 + offset * 0.05) + 1) / 2;
  return mix(P('Interface', 'Primary Color'), P('Interface', 'Secondary Color'), f);
};
const store = {
  get(k, d) { try { const v = localStorage.getItem('ethane.pg.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ethane.pg.' + k, JSON.stringify(v)); } catch {} },
};

// ── sound (synthesised, no assets) ────────────────────
const Sound = {
  ctx: null, vol: store.get('vol', 45) / 100,
  init() { if (!this.ctx) try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} },
  tone(f, d = .08, type = 'sine', v = .3, f2 = null) {
    const c = this.ctx; if (!c || !this.vol) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v * this.vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .02);
  },
  noise(d = .1, v = .3, freq = 2000) {
    const c = this.ctx; if (!c || !this.vol) return;
    const b = c.createBuffer(1, Math.max(1, c.sampleRate * d | 0), c.sampleRate), a = b.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / a.length);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = v * this.vol;
    s.connect(f).connect(g).connect(c.destination); s.start();
  },
  play(n) {
    switch (n) {
      case 'enable': this.tone(1046, .07, 'triangle', .22); setTimeout(() => this.tone(1568, .08, 'triangle', .2), 55); break;
      case 'disable': this.tone(1046, .07, 'triangle', .22); setTimeout(() => this.tone(784, .08, 'triangle', .2), 55); break;
      case 'click': this.tone(1800, .03, 'square', .06); break;
      case 'hit': this.noise(.09, .5, 1400); this.tone(160, .08, 'sine', .25, 90); break;
      case 'crit': this.noise(.12, .55, 3200); this.tone(320, .1, 'triangle', .2, 140); break;
      case 'swing': this.noise(.05, .12, 5000); break;
      case 'hurt': this.tone(260, .18, 'sawtooth', .18, 120); this.noise(.1, .3, 900); break;
      case 'place': this.noise(.07, .45, 700); break;
      case 'break': this.noise(.14, .55, 1100); break;
      case 'dig': this.noise(.04, .2, 900); break;
      case 'pop': this.tone(1500, .05, 'sine', .15, 2200); break;
      case 'eat': this.noise(.06, .3, 1600); break;
      case 'burp': this.tone(140, .25, 'sawtooth', .15, 90); break;
      case 'glass': this.tone(2400, .12, 'triangle', .2, 1200); this.noise(.15, .3, 6000); break;
      case 'pearl': this.tone(500, .25, 'sine', .2, 1200); break;
      case 'boom': this.noise(.7, .9, 500); this.tone(70, .5, 'sine', .5, 30); break;
      case 'shoot': this.noise(.25, .35, 1200); this.tone(200, .2, 'sawtooth', .12, 400); break;
      case 'block': this.tone(140, .09, 'square', .18); break;
      case 'shieldbreak': this.noise(.25, .6, 2500); this.tone(300, .2, 'square', .15, 80); break;
      case 'flag': this.tone(220, .12, 'square', .12); break;
      case 'bedbreak': this.tone(180, .5, 'sawtooth', .25, 60); this.noise(.3, .4, 1500); break;
      case 'tp': this.tone(300, .2, 'sine', .2, 900); break;
    }
  },
};

// ── module definitions (names, descriptions, settings and defaults from the client source) ──
const B = (n, d, x) => ({ t: 'b', n, d, ...x });
const N = (n, d, min, max, step, x) => ({ t: 'n', n, d, min, max, step, ...x });
const E = (n, d, o, x) => ({ t: 'e', n, d, o, ...x });
const C = (n, d) => ({ t: 'c', n, d });
const mode = m => () => P(m, 'Mode');

const DEFS = [
  // Combat
  ['Aura', 'Combat', 'Attacks nearby players.', [
    B('Hit select', false), B('Perfect criticals', false, { hide: () => !P('Aura', 'Hit select') }),
    E('Rotations', 'Adaptive', ['None', 'Linear', 'Adaptive', 'Advanced']), E('Mode', 'Single', ['Single']),
    E('Clicking mode', 'Normal', ['Normal', 'Butterfly']),
    N('Gravity', 9, 1, 20, .5), N('Wind', 3, 1, 10, .5),
    N('Yaw Influence %', 14, 0, 100, 1), N('Yaw Influence Cap', 50, 0, 180, 1),
    N('Pitch Influence %', 15, 0, 100, 1), N('Pitch Influence Cap', 30, 0, 180, 1),
    N('Min CPS', 8, 1, 20, .5, { hide: () => P('Aura', 'Hit select') }), N('Max CPS', 12, 1, 20, .5, { hide: () => P('Aura', 'Hit select') }),
    N('Reach', 4.5, 3, 6, .1), B('Dynamic reach', false), N('Hurt reach', 4.5, 3, 6, .1, { hide: () => !P('Aura', 'Dynamic reach') }),
    E('Hit select mode', 'Always', ['Always', 'Server'], { hide: () => !P('Aura', 'Hit select') }),
    B('Swing', true), B('Lock view', false), B('Ray cast', true)], mode('Aura')],
  ['AutoPot', 'Combat', 'Tis but a scratch!', [N('Throw Delay', 15, 0, 20, 1), N('Health Threshold', 10, 1, 20, .5)]],
  ['Auto Shield Break', 'Combat', 'Automatically breaks the shield on attack.', [B('Notify', false)]],
  ['AutoSoup', 'Combat', 'Ravioli ravioli give me the formuroli', [N('Health', 13, 1, 20, 1), B('Drop Bowl', true)]],
  ['Backtrack', 'Combat', 'Hits entities where they were.', [N('Range', 6, 3, 10, .1), N('Max Delay', 1000, 0, 5000, 100), B('Delay Velocity', true)]],
  ['Criticals', 'Combat', "Deals critical's to the enemies using packets.", [E('Mode', 'Packet', ['Packet'])], mode('Criticals')],
  ['Fake Lag', 'Combat', 'BRO IM JUST LAGGING BROO', [N('Min Pulse Ticks', 1, 1, 20, 1), N('Max Pulse Ticks', 4, 1, 20, 1)]],
  ['KillAura', 'Combat', 'Now I Am Become Death, the Destroyer of Worlds.', [
    N('Rotation Range', 5, 1, 8, .1), N('Attack Range', 3.1, 1, 6, .1), N('FOV', 180, 1, 180, 1), B('Through Walls', false),
    E('Target Mode', 'Single', ['Single', 'Switch', 'Best']), E('Sorting', 'Health', ['Health', 'Distance', 'Hurt Time']),
    E('Rotation Mode', 'Smooth', ['Simple', 'Smooth', 'Snap', 'None']), N('Smooth Speed', 8, 1, 50, 1, { hide: () => P('KillAura', 'Rotation Mode') !== 'Smooth' }),
    B('Client Side', true), B('Jitter Pitch', true), N('Min CPS', 8, 1, 20, 1), N('Max CPS', 12, 1, 20, 1),
    B('Swing Misses', true), B('Swords Only', false), B('No GUI', true), B('Show Target', true), B('Utah Shape', true, { hide: () => !P('KillAura', 'Show Target') })]],
  ['Reach', 'Combat', 'Extend your arms in order to reach higher branches', [N('Attack Reach', 3, 3, 6, .1), N('Block Reach', 4.5, 4.5, 10, .1)]],
  ['Super Knockback', 'Combat', 'Increases knockback by manipulating your movement inputs.', [E('Mode', 'W-Tap', ['W-Tap', 'S-Tap']), N('Wait', 1, 0, 10, 1), N('Hold', 2, 1, 10, 1)]],
  ['Tick Base', 'Combat', 'cs hake 2005', [N('Target Range', 4, 1, 8, .1), N('Max Ticks', 7, 2, 20, 1)]],
  ['Velocity', 'Combat', 'Modifies your knockback', [
    E('Mode', 'Cancel', ['Cancel', 'Reversed', 'Custom', 'Jump Reset']),
    N('X/Z multiplier', 1, -2, 2, .01, { hide: () => P('Velocity', 'Mode') !== 'Custom' }),
    N('Y multiplier', 1, -2, 2, .01, { hide: () => P('Velocity', 'Mode') !== 'Custom' }),
    B('Polar', true, { hide: () => P('Velocity', 'Mode') !== 'Jump Reset' })], mode('Velocity')],
  // Movement
  ['Fast Stop', 'Movement', 'Stops you instantly.', [B('Ground only', false)]],
  ['Flight', 'Movement', 'zoomies', [E('Mode', 'Motion', ['Motion', 'Polar']), N('Speed', .25, .1, 1.5, .01, { hide: () => P('Flight', 'Mode') !== 'Motion' })], mode('Flight')],
  ['InventoryMove', 'Movement', 'hold on let me dig in my pocket rq', []],
  ['Keep Sprint', 'Movement', 'Prevents you from stopping sprinting after attacking.', [B('Keep Sprint', true), B('Keep Motion', true)]],
  ['Movement Fix', 'Movement', 'Locks your movement to your rotations.', []],
  ['No Jump Delay', 'Movement', 'Removes the delay between jumps.', [N('Delay', 0, 0, 10, 1)]],
  ['No Slow', 'Movement', 'Prevents you from being slowed down while eating', [E('Mode', 'Vanilla', ['Vanilla', 'Grim'])], mode('No Slow')],
  ['No Web', 'Movement', "Disables web collision so you don't get slowed down.", [B('Grim', false)]],
  ['Scaffold', 'Movement', 'Automatically places blocks under you.', [
    B('Moving Backwards', false), B('Right Click Only', false), N('Block Reach', 4.5, 2, 6, .1),
    E('Tower Mode', 'Vanilla', ['None', 'Legit', 'Vanilla']), B('Keep Y', true), B('Auto F5', true)]],
  ['Sneak', 'Movement', 'Prevents you from slowing down while sneaking.', []],
  ['Speed', 'Movement', 'zoomies', [E('Mode', 'Legit', ['Motion', 'Verus', 'Legit', 'Matrix', 'Polar']),
    N('Speed', .25, .1, 1.5, .01, { hide: () => P('Speed', 'Mode') !== 'Motion' }),
    N('Damage multiplier', 1.5, 1, 4, .01, { hide: () => P('Speed', 'Mode') !== 'Verus' })], mode('Speed')],
  ['Spiderman', 'Movement', 'with great power comes great responsibility.', [N('Jump Motion', .42, .1, 1, .01), N('Climb Delay', 4, 2, 10, 1)]],
  ['Sprint', 'Movement', 'Automatically sprints.', []],
  ['V-Clip', 'Movement', 'Teleports you vertically.', [N('Height', 10, 1, 80, .1), B('Clip Up', false)]],
  // Render
  ['Animations', 'Render', 'Customize your animations.', [B('Smooth Swing', true), B('1.7 Blocking', true),
    N('Offset X', 0, -2, 2, .1), N('Offset Y', 0, -2, 2, .1), N('Offset Z', 0, -2, 2, .1),
    N('Rotation X', 0, -180, 180, 1), N('Rotation Y', 0, -180, 180, 1), N('Rotation Z', 0, -180, 180, 1), N('Size', 1, .1, 5, .1)]],
  ['Array List', 'Render', 'Displays a list of enabled modules.', [E('Theme', 'Background', ['Background', 'Bar', 'Border']),
    B('Font Shadow', false), B('Lower Case', false), B('Show Suffix', true)]],
  ['Camera Clip', 'Render', 'Allows your camera to clip through blocks.', []],
  ['Chat Fixer', 'Render', 'Fixes chat clearing and length.', [B('No Clear', true), B('Limited Chat', false), N('History Length', 100, 1, 5000, 10)]],
  ['Click GUI', 'Render', 'Hi', [E('Sorting', 'Length', ['Length', 'Alphabetical']), B('Lower Case', false), E('Style', 'Dropdown', ['Dropdown', 'Compact'])]],
  ['ESP', 'Render', 'See entities through walls.', [B('Boxes', true), B('Tracers', false), B('Health Bar', true), N('Tracer Width', 1, .1, 5, .1)]],
  ['Fullbright', 'Render', 'Makes everything bright.', [N('Gamma', 16, 1, 16, 1)]],
  ['Interface', 'Render', 'Displays the client.', [E('Font', 'Minecraft', ['Product Sans', 'Minecraft']), B('Lower Case', false),
    B('FPS', true), B('BPS', true), C('Primary Color', [7, 236, 253]), C('Secondary Color', [0, 142, 250])], () => P('Interface', 'Font')],
  ['No FOV', 'Render', 'Disables FOV multipliers.', []],
  ['No Render', 'Render', 'Disables various rendering effects.', [B('Fire', true), B('Blindness', true), B('Nausea', true), B('Invisibles', true)]],
  ['Scoreboard', 'Render', 'Modify the in-game scoreboard.', [B('Hide', false)]],
  ['Target HUD', 'Render', 'Displays information about your target.', []],
  ['Trail', 'Render', 'Leaves a trail behind you.', [E('Mode', 'Line', ['Line', 'Dots', 'Circle']), N('Length', 20, 5, 100, 1)]],
  ['Zoom', 'Render', 'Zoom in on things.', [N('Zoom FOV', 30, 1, 179, 1), B('Smooth Look', true)]],
  // Player
  ['Anti Aim', 'Player', 'Confuses other players by looking around randomly.', [N('Yaw Range', 360, 0, 360, 10), N('Pitch Range', 180, 0, 180, 5)]],
  ['Anti Fireball', 'Player', 'Automatically hits back fireballs.', [N('Range', 5, 1, 10, .5)]],
  ['Auto Tool', 'Player', 'Automatically switches to the best tool for the block.', [B('Only When Sneaking', false)]],
  ['BedNuker', 'Player', 'Breaks beds automatically.', [E('Mode', 'Hypixel', ['Vanilla', 'Hypixel']), B('Whitelist', true), B('No KillAura', true), N('Range', 4.5, 1, 6, .1), N('Delay', 0, 0, 20, 1)]],
  ['Blink', 'Player', 'Simulates network lag.', [B('Outgoing', true), B('Incoming', true)]],
  ['Fast Place', 'Player', 'Removes the delay between placing blocks.', [N('Delay', 0, 0, 4, 1)]],
  ['Inventory Manager', 'Player', 'Sorts your inventory.', [N('First Delay', 8, 0, 20, 1), N('Item Delay', 4, 0, 20, 1), B('Auto Close', true), B('Throw Junk', true)]],
  ['Miley Cyrus', 'Player', 'Automatically twerks.', []],
  ['No Clip', 'Player', 'im just a spooky ghost i swr', []],
  ['No Fall', 'Player', 'Prevents you from taking fall damage.', [E('Mode', 'CubeCraft', ['Spoof', 'CubeCraft', 'Vulcan'])], mode('No Fall')],
  ['Timer', 'Player', 'Changes the game speed.', [N('Speed', 1, .1, 10, .1)]],
  // Other
  ['Anti Cheat Sniffer', 'Other', 'Attempts to guess the anticheat the server is using.', []],
  ['Anti Log Bypass', 'Other', 'Prevents the server from timing you out quickly during lag.', []],
  ['Crystal Optimizer', 'Other', 'Optimizes the handling of using end crystals.', []],
  ['Disabler', 'Other', 'Disables certain anti-cheat checks.', [E('Mode', 'CubeCraft', ['CubeCraft', 'MiniBlox']),
    E('Type', 'A', ['A', 'B'], { hide: () => P('Disabler', 'Mode') !== 'CubeCraft' }), B('Spoof ground', true, { hide: () => P('Disabler', 'Mode') !== 'CubeCraft' })],
    () => P('Disabler', 'Mode') === 'CubeCraft' ? `CubeCraft (${P('Disabler', 'Type')})` : 'MiniBlox'],
];
// Modules that change nothing you can see in a single-player sandbox
const PASSIVE = {
  'Movement Fix': 'Fixes movement under silent rotations. Works in the background here.',
  'Anti Log Bypass': 'Only matters on a real server connection.',
  'Crystal Optimizer': 'There are no end crystals in the playground.',
  'Chat Fixer': 'Keeps chat when you respawn (No Clear).',
};
const CATS = ['Combat', 'Movement', 'Render', 'Player', 'Other'];

const MODS = new Map();
for (const [name, cat, desc, props, suffix] of DEFS) {
  const v = {};
  props.forEach(p => v[p.n] = Array.isArray(p.d) ? p.d.slice() : p.d);
  MODS.set(name, { name, cat, desc, props, v, suffix: suffix || null, on: false, bind: null, hidden: false });
}
const M = n => MODS.get(n);
const on = n => MODS.get(n).on;
const P = (n, p) => MODS.get(n).v[p];
const findMod = q => { q = q.toLowerCase().replace(/[\s_-]/g, ''); return [...MODS.values()].find(m => m.name.toLowerCase().replace(/[\s_-]/g, '') === q); };

// defaults for the playground (Anti Cheat Sniffer toggles itself on in the real client too)
['Interface', 'Array List', 'Target HUD', 'Anti Cheat Sniffer'].forEach(n => M(n).on = true);
M('Click GUI').bind = 'ShiftRight';

const hooks = { enable: {}, disable: {}, change: [] };
function setMod(name, state, silent) {
  const m = M(name); if (!m || m.on === state) return;
  m.on = state;
  if (!silent) Sound.play(state ? 'enable' : 'disable');
  const h = (state ? hooks.enable : hooks.disable)[name]; if (h) h();
  hooks.change.forEach(f => f(m));
  saveConfig('autosave');
}
const toggleMod = n => setMod(n, !on(n));
function setProp(name, prop, val) {
  M(name).v[prop] = val;
  hooks.change.forEach(f => f(M(name), prop));
  saveConfig('autosave');
}
function serialize() {
  const o = {};
  MODS.forEach((m, n) => { o[n] = { on: n === 'Click GUI' ? false : m.on, bind: m.bind, hidden: m.hidden, v: m.v }; });
  return o;
}
function saveConfig(name) { const all = store.get('configs', {}); all[name] = serialize(); store.set('configs', all); }
function loadConfig(name) {
  const c = store.get('configs', {})[name]; if (!c) return false;
  for (const [n, s] of Object.entries(c)) {
    const m = M(n); if (!m) continue;
    m.bind = s.bind; m.hidden = !!s.hidden;
    for (const k in s.v) if (k in m.v) m.v[k] = s.v[k];
    if (n !== 'Click GUI' && m.on !== s.on) setMod(n, s.on, true);
  }
  hooks.change.forEach(f => f(null));
  return true;
}
