'use strict';
const ui = {
  gui: false, inv: false, chat: false, paused: true, dirtyInv: true, camMode: 0,
  anyOpen() { return this.gui || this.inv; },
  hurt() { const h = $('hurtOv'); h.style.opacity = 1; setTimeout(() => h.style.opacity = 0, 180); $('hearts').classList.remove('hurt'); void $('hearts').offsetWidth; $('hearts').classList.add('hurt'); },
  death(cause) { $('death').classList.toggle('on', !!cause); if (cause) $('deathMsg').textContent = 'You ' + cause + '.'; },
};

// ── chat ─────────────────────────────────────────────
const chatLog = [], chatKeys = {};
function chat(html, key) {
  if (key) { const now = performance.now(); if (chatKeys[key] && now - chatKeys[key] < 2500) return; chatKeys[key] = now; }
  html = html.replace(/<(e|y|r|g|d)>/g, '<span class="$1">').replace(/<\/(e|y|r|g|d)>/g, '</span>');
  const p = document.createElement('p'); p.innerHTML = html; $('chat').appendChild(p);
  chatLog.push(p);
  const max = on('Chat Fixer') && P('Chat Fixer', 'Limited Chat') ? Math.min(P('Chat Fixer', 'History Length'), 100) : 100;
  while (chatLog.length > Math.max(10, max)) chatLog.shift().remove();
  const vis = () => [...$('chat').children].slice(-10);
  [...$('chat').children].forEach(c => c.style.display = vis().includes(c) || ui.chat ? '' : 'none');
  setTimeout(() => p.classList.add('fade'), 10000);
}
const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const keyName = code => !code ? 'None' : code.replace(/^Key|^Digit/, '').replace('ShiftRight', 'RShift').replace('ShiftLeft', 'LShift').replace('ControlLeft', 'LCtrl').replace('ControlRight', 'RCtrl').replace('AltLeft', 'LAlt').replace('AltRight', 'RAlt');
const parseKey = k => { k = k.toUpperCase(); const map = { RSHIFT: 'ShiftRight', LSHIFT: 'ShiftLeft', RCTRL: 'ControlRight', LCTRL: 'ControlLeft', LALT: 'AltLeft', RALT: 'AltRight', TAB: 'Tab', CAPS: 'CapsLock', NONE: null };
  if (k in map) return map[k]; if (/^[A-Z]$/.test(k)) return 'Key' + k; if (/^[0-9]$/.test(k)) return 'Digit' + k; if (/^F\d{1,2}$/.test(k)) return k; return undefined; };
function command(line) {
  const [cmd, ...a] = line.slice(1).trim().split(/\s+/), c = (cmd || '').toLowerCase();
  const E = s => chat('<e>[Ethane]</e> ' + s);
  // module names can contain spaces, so try the longest prefix that matches a module
  const modArg = (args) => { for (let n = args.length; n > 0; n--) { const m = findMod(args.slice(0, n).join(' ')); if (m) return [m, args.slice(n)]; } return [null, args]; };
  switch (c) {
    case 'help': case 'h':
      E('Commands: <y>.toggle</y> &lt;module&gt; · <y>.bind</y> &lt;module&gt; &lt;key|none&gt; · <y>.binds</y> · <y>.hide</y> &lt;module&gt; · <y>.config</y> save|load|list|delete &lt;name&gt; · <y>.panic</y> · <y>.clickgui</y> · <y>.scripts</y>'); break;
    case 'toggle': case 't': { const [m] = modArg(a); if (!m) return E('<r>Unknown module.</r>'); toggleMod(m.name); E(`${m.name} ${m.on ? '<g>enabled</g>' : '<r>disabled</r>'}.`); break; }
    case 'bind': case 'b': {
      const [m, rest] = modArg(a); if (!m || !rest[0]) return E('<r>Usage: .bind &lt;module&gt; &lt;key|none&gt;</r>');
      const k = parseKey(rest[0]); if (k === undefined) return E('<r>Unknown key.</r>');
      m.bind = k; saveConfig('autosave'); renderGui(); E(`Bound ${m.name} to <y>${keyName(k)}</y>.`); break;
    }
    case 'binds': { const b = [...MODS.values()].filter(m => m.bind); E(b.length ? b.map(m => `${m.name} <y>${keyName(m.bind)}</y>`).join(' · ') : 'No binds.'); break; }
    case 'hide': { const [m] = modArg(a); if (!m) return E('<r>Unknown module.</r>'); m.hidden = !m.hidden; saveConfig('autosave'); hooks.change.forEach(f => f(m)); E(`${m.name} is now ${m.hidden ? 'hidden from' : 'shown in'} the ArrayList.`); break; }
    case 'config': case 'c': {
      const sub = (a[0] || '').toLowerCase(), name = a[1];
      if (sub === 'list') { const n = Object.keys(store.get('configs', {})).filter(k => k !== 'autosave'); return E(n.length ? 'Configs: ' + n.join(', ') : 'No saved configs.'); }
      if (!name) return E('<r>Usage: .config save|load|delete &lt;name&gt;</r>');
      if (sub === 'save') { saveConfig(name); E(`Saved config "${esc(name)}".`); }
      else if (sub === 'load') { E(loadConfig(name) ? `Loaded config "${esc(name)}".` : `<r>No config named "${esc(name)}".</r>`); renderGui(); }
      else if (sub === 'delete') { const all = store.get('configs', {}); delete all[name]; store.set('configs', all); E(`Deleted config "${esc(name)}".`); }
      break;
    }
    case 'panic': MODS.forEach(m => { if (m.on && m.name !== 'Click GUI') setMod(m.name, false, true); }); Sound.play('disable'); E('Disabled all modules.'); break;
    case 'clickgui': openGui(true); break;
    case 'scripts': E('Lua scripts load in the real client only.'); break;
    default: E(`<r>Unknown command.</r> Type <y>.help</y>`);
  }
}

// ── click gui ────────────────────────────────────────
const guiEl = $('gui'), tip = $('tip');
const panelPos = store.get('panels', null) || CATS.map((c, i) => ({ x: 24 + i * 186, y: 70 }));
let compactTab = 'Combat';
const disp = s => P('Click GUI', 'Lower Case') ? s.toLowerCase() : s;
function sortMods(list) {
  const len = P('Click GUI', 'Sorting') === 'Length';
  return list.sort((a, b) => (len && b.name.length - a.name.length) || a.name.localeCompare(b.name));
}
function modEl(m) {
  const el = document.createElement('div'); el.className = 'mod'; el.dataset.mod = m.name;
  el.innerHTML = `<div class="mr ${m.on ? 'on' : ''}"><span>${disp(m.name)}</span>${m.bind && m.name !== 'Click GUI' ? `<i class="bind">${keyName(m.bind)}</i>` : ''}</div><div class="props"><div><div class="pin"></div></div></div>`;
  const mr = el.firstChild;
  mr.addEventListener('mousedown', e => {
    if (e.button === 0) { toggleMod(m.name); }
    else if (e.button === 2) { if (m.props.length || PASSIVE[m.name]) { el.classList.toggle('open'); Sound.play(el.classList.contains('open') ? 'disable' : 'enable'); } }
  });
  mr.addEventListener('mousemove', e => { tip.style.display = 'block'; tip.textContent = m.desc + (PASSIVE[m.name] ? ' — ' + PASSIVE[m.name] : ''); tip.style.left = e.clientX + 14 + 'px'; tip.style.top = e.clientY + 12 + 'px'; });
  mr.addEventListener('mouseleave', () => tip.style.display = 'none');
  renderProps(m, el.querySelector('.pin'));
  return el;
}
function renderProps(m, pin) {
  pin.innerHTML = '';
  if (PASSIVE[m.name]) { const n = document.createElement('div'); n.className = 'pr note'; n.textContent = PASSIVE[m.name]; pin.appendChild(n); }
  for (const p of m.props) {
    if (p.hide && p.hide()) continue;
    const r = document.createElement('div'), val = m.v[p.n];
    if (p.t === 'b') {
      r.className = 'pr row'; r.innerHTML = `<span>${disp(p.n)}</span><i class="sw ${val ? 'on' : ''}"></i>`;
      r.onmousedown = e => { if (e.button) return; setProp(m.name, p.n, !m.v[p.n]); Sound.play('click'); };
    } else if (p.t === 'n') {
      const pct = (val - p.min) / (p.max - p.min) * 100, dec = p.step < 1 ? (String(p.step).split('.')[1] || '').length : 0;
      r.className = 'pr'; r.innerHTML = `<div class="nl"><span style="color:#fff">${disp(p.n)}</span><span>${(+val).toFixed(dec)}</span></div><div class="sl"><i style="width:${pct}%"></i><b style="left:${pct}%"></b></div>`;
      const sl = r.querySelector('.sl');
      const set = e => { const b = sl.getBoundingClientRect(); let v = p.min + clamp((e.clientX - b.left) / b.width, 0, 1) * (p.max - p.min); v = Math.round(v / p.step) * p.step; v = +clamp(v, p.min, p.max).toFixed(4); if (v !== m.v[p.n]) setProp(m.name, p.n, v); };
      sl.onmousedown = e => { if (e.button) return; set(e); const mv = ev => set(ev), up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); }; addEventListener('mousemove', mv); addEventListener('mouseup', up); };
    } else if (p.t === 'e') {
      r.className = 'pr'; r.innerHTML = `<div>${disp(p.n)}</div><div class="ml">${p.o.map(o => `<button class="${o === val ? 'on' : ''}">${disp(o)}</button>`).join('')}</div>`;
      r.querySelectorAll('button').forEach((b, i) => b.onmousedown = e => { if (e.button) return; setProp(m.name, p.n, p.o[i]); Sound.play('click'); });
    } else if (p.t === 'c') {
      r.className = 'pr row cl'; r.innerHTML = `<span>${disp(p.n)}</span><input type="color" value="${rgbToHex(val)}">`;
      r.querySelector('input').oninput = e => setProp(m.name, p.n, hexToRgb(e.target.value));
    }
    pin.appendChild(r);
  }
}
function renderGui() {
  const open = new Set([...guiEl.querySelectorAll('.mod.open')].map(e => e.dataset.mod));
  guiEl.innerHTML = '<div class="gui-help">left-click toggle · right-click settings · drag the headers · RShift / Esc closes</div>';
  if (P('Click GUI', 'Style') === 'Compact') {
    const w = document.createElement('div'); w.className = 'compact';
    w.innerHTML = `<div class="tabs"><div class="t1">Ethane</div>${CATS.map(c => `<button class="${c === compactTab ? 'on' : ''}">${disp(c)}</button>`).join('')}</div><div class="list"></div>`;
    w.querySelectorAll('.tabs button').forEach((b, i) => b.onclick = () => { compactTab = CATS[i]; renderGui(); });
    const list = w.querySelector('.list');
    sortMods([...MODS.values()].filter(m => m.cat === compactTab)).forEach(m => list.appendChild(modEl(m)));
    w.style.setProperty('--a', 'var(--c1)'); w.style.setProperty('--b', 'var(--c2)');
    guiEl.appendChild(w);
  } else CATS.forEach((c, i) => {
    const pn = document.createElement('div'); pn.className = 'panel'; pn.dataset.i = i;
    pn.style.left = panelPos[i].x + 'px'; pn.style.top = panelPos[i].y + 'px'; pn.style.animationDelay = i * 40 + 'ms';
    pn.innerHTML = `<div class="ph">${disp(c)}</div><div class="mods"></div>`;
    const mods = pn.querySelector('.mods'), list = sortMods([...MODS.values()].filter(m => m.cat === c));
    list.forEach((m, j) => { const e = modEl(m); if (j === list.length - 1) e.classList.add('last'); mods.appendChild(e); });
    dragPanel(pn, i); guiEl.appendChild(pn);
  });
  open.forEach(n => { const e = guiEl.querySelector(`.mod[data-mod="${CSS.escape(n)}"]`); if (e) e.classList.add('open'); });
}
function dragPanel(pn, i) {
  const h = pn.querySelector('.ph');
  h.onmousedown = e => {
    if (e.button) return;
    const ox = e.clientX - panelPos[i].x, oy = e.clientY - panelPos[i].y; let lastX = e.clientX, tilt = 0;
    pn.classList.add('dragging'); guiEl.appendChild(pn);
    const mv = ev => { panelPos[i] = { x: ev.clientX - ox, y: ev.clientY - oy }; tilt = clamp(tilt * .6 + (ev.clientX - lastX) * .9, -14, 14); lastX = ev.clientX; pn.style.left = panelPos[i].x + 'px'; pn.style.top = panelPos[i].y + 'px'; pn.style.transform = `rotate(${tilt}deg)`; };
    const up = () => { pn.classList.remove('dragging'); pn.style.transition = 'transform .4s'; pn.style.transform = ''; setTimeout(() => pn.style.transition = '', 400); store.set('panels', panelPos); removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
}
guiEl.addEventListener('contextmenu', e => e.preventDefault());
function openGui(state) {
  if (ui.gui === state) return;
  ui.gui = state; guiEl.classList.toggle('on', state); tip.style.display = 'none';
  setMod('Click GUI', state, true);
  if (state) { renderGui(); document.exitPointerLock && document.exitPointerLock(); }
  else lockPointer();
}
hooks.change.push((m, prop) => {
  if (!m) return;
  if (m.name === 'Click GUI' && prop) return renderGui();
  const el = guiEl.querySelector(`.mod[data-mod="${CSS.escape(m.name)}"]`);
  if (!el) return;
  el.firstChild.classList.toggle('on', m.on);
  if (prop) renderProps(m, el.querySelector('.pin'));
});

// ── HUD widgets ──────────────────────────────────────
function heartImg(kind) {
  const shape = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  return px(x => {
    x.clearRect(0, 0, 9, 9); x.fillStyle = '#111';
    shape.forEach((r, j) => [...r].forEach((c, i) => { if (c === '#') x.fillRect(i, j, 3, 3); }));
    const fill = kind === 'gold' ? '#f2c335' : kind === 'empty' ? '#3a1010' : '#e3262c';
    shape.forEach((r, j) => [...r].forEach((c, i) => { if (c !== '#') return; x.fillStyle = kind === 'half' && i > 3 ? '#3a1010' : fill; x.fillRect(i + 1, j + 1, 1, 1); }));
    if (kind !== 'empty') { x.fillStyle = kind === 'gold' ? '#fff3b0' : '#ff9a9a'; x.fillRect(2, 2, 1, 1); }
  }, 9).toDataURL();
}
const HEART = { full: heartImg('full'), half: heartImg('half'), empty: heartImg('empty'), gold: heartImg('gold') };
const heartEls = [...Array(14)].map(() => { const i = document.createElement('i'); $('hearts').appendChild(i); return i; });
const slotEls = [...Array(9)].map(() => { const d = document.createElement('div'); d.className = 'slot'; d.innerHTML = '<canvas width="16" height="16"></canvas><b></b>'; $('hotbar').appendChild(d); return d; });
function drawStack(cv, b, s) {
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, 16, 16);
  if (s) x.drawImage(ICONS[s.id], 0, 0);
  b.textContent = s && s.count > 1 ? s.count : '';
}
let lastSel = -1, nameTimer = 0;
const faceCache = {};
const faceUrl = skin => faceCache[skin] || (faceCache[skin] = (() => { const s = SKINS[skin]; return faceCanvas(s.hair, s.skin, s.eye).toDataURL(); })());

const alEls = new Map(); let alKey = '';
function alText(m) {
  let n = m.name, s = m.suffix && P('Array List', 'Show Suffix') ? m.suffix() : null;
  if (P('Array List', 'Lower Case')) { n = n.toLowerCase(); s = s && s.toLowerCase(); }
  return { n, s };
}
function updateArrayList() {
  const show = on('Array List'); $('al').style.display = show ? '' : 'none'; if (!show) return;
  const list = [...MODS.values()].filter(m => m.on && !m.hidden);
  const key = list.map(m => { const t = alText(m); return t.n + t.s; }).join('|') + P('Array List', 'Theme') + P('Array List', 'Font Shadow') + P('Interface', 'Font');
  if (key !== alKey) {
    alKey = key;
    for (const [n, el] of alEls) if (!list.find(m => m.name === n)) { el.classList.add('out'); alEls.delete(n); setTimeout(() => el.remove(), 300); }
    for (const m of list) {
      let el = alEls.get(m.name);
      if (!el) { el = document.createElement('div'); el.className = 'ali out'; $('al').appendChild(el); alEls.set(m.name, el); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('out'))); }
      const t = alText(m), th = P('Array List', 'Theme');
      el.innerHTML = `<span class="nm">${t.n}</span>${t.s ? `<span class="sf"> [${t.s}]</span>` : ''}${th === 'Bar' ? '<i class="bar"></i>' : th === 'Border' ? '<i class="bor"></i>' : ''}`;
      el.classList.toggle('shadow', P('Array List', 'Font Shadow'));
    }
    const sorted = [...alEls.values()].sort((a, b) => b.offsetWidth - a.offsetWidth);
    sorted.forEach((el, i) => { el.style.top = 4 + i * 22 + 'px'; el.dataset.i = i; const tp = el.querySelector('.top'); if (tp) tp.remove(); if (i === 0 && P('Array List', 'Theme') === 'Border') el.insertAdjacentHTML('beforeend', '<i class="top"></i>'); });
  }
  for (const el of alEls.values()) {
    const c = rgb(wave(+el.dataset.i * 22 * .5));
    el.querySelector('.nm').style.color = c;
    el.querySelectorAll('.bar,.bor,.top').forEach(b => b.style.background = c);
  }
}
let fpsCount = 0, fps = 0, fpsT = performance.now();
function updateHud(dt) {
  const p = player, hud = $('hud');
  fpsCount++; if (performance.now() - fpsT > 500) { fps = Math.round(fpsCount * 1000 / (performance.now() - fpsT)); fpsCount = 0; fpsT = performance.now(); }
  const iface = on('Interface');
  hud.classList.toggle('pfont', P('Interface', 'Font') === 'Product Sans');
  document.documentElement.style.setProperty('--c1', rgb(P('Interface', 'Primary Color')));
  document.documentElement.style.setProperty('--c2', rgb(P('Interface', 'Secondary Color')));
  $('wm').style.display = $('stats').style.display = iface ? '' : 'none';
  if (iface) {
    const t = P('Interface', 'Lower Case') ? 'ethane' : 'Ethane';
    $('wmTitle').innerHTML = [...t].map((ch, i) => `<span style="color:${rgb(wave(i * 12))}">${ch}</span>`).join('');
    const lc = s => P('Interface', 'Lower Case') ? s.toLowerCase() : s;
    $('stats').innerHTML = (P('Interface', 'FPS') ? `<div>${lc('FPS')}: <b>${fps}</b></div>` : '') + (P('Interface', 'BPS') ? `<div>${lc('BPS')}: <b>${p.bps.toFixed(2)}</b></div>` : '');
  }
  updateArrayList();
  if (ui.gui) guiEl.querySelectorAll('.panel').forEach(pn => { const i = +pn.dataset.i; pn.style.setProperty('--a', rgb(wave(i * 20))); pn.style.setProperty('--b', rgb(wave((i + 1) * 20))); });
  // scoreboard
  const sbOn = !(on('Scoreboard') && P('Scoreboard', 'Hide'));
  $('sb').style.display = sbOn ? '' : 'none';
  if (sbOn) {
    const rows = [['Kills', stats.kills], ['Deaths', stats.deaths], ['Hits', stats.hits], ['Best combo', stats.best], ['Top speed', stats.topBps.toFixed(1) + ' b/s'], ['Sentinel', opts.ac ? (on('Disabler') ? '§disabled' : 'on') : 'off']];
    $('sb').innerHTML = `<h4>ETHANE PLAYGROUND</h4>` + rows.map(([a, b], i) => `<p><span>${a}: <span style="color:#55ffff">${String(b).replace('§', '')}</span></span><span>${rows.length - i}</span></p>`).join('') + `<p class="ip">playground.ethane</p>`;
  }
  // target hud
  const tg = p.kaTarget || p.auraTarget || (p.lastTarget && p.t - p.lastTargetT < 60 ? p.lastTarget : null);
  const th = on('Target HUD') && tg && (tg.alive || tg.deathTime < 20);
  $('thud').classList.toggle('on', !!th);
  if (th) {
    $('thudName').textContent = tg.name; $('thudHp').textContent = tg.health.toFixed(1);
    $('thudBar').style.width = tg.health / tg.maxHealth * 100 + '%';
    const f = faceUrl(tg.skin || 'dummy');
    if ($('thudFace').dataset.f !== f) { $('thudFace').style.backgroundImage = `url(${f})`; $('thudFace').dataset.f = f; }
    $('thudFace').classList.toggle('hurt', tg.hurtTime > 0);
    $('thudDist').textContent = p.pos.distanceTo(tg.pos).toFixed(1) + 'm';
    $('thudWl').textContent = p.health >= tg.health ? 'W' : 'L'; $('thudWl').style.color = p.health >= tg.health ? '#55ff55' : '#ff5555';
  }
  // hearts
  const hp = Math.max(0, Math.ceil(p.health)), ab = Math.ceil(p.absorb);
  heartEls.forEach((el, i) => {
    let k = i < 10 ? (hp >= (i + 1) * 2 ? 'full' : hp === i * 2 + 1 ? 'half' : 'empty') : (ab > (i - 10) * 2 ? 'gold' : null);
    el.style.display = k ? '' : 'none'; if (k) el.style.backgroundImage = `url(${HEART[k]})`;
  });
  // hotbar
  if (ui.dirtyInv) { slotEls.forEach((el, i) => drawStack(el.firstChild, el.lastChild, p.inv[i])); renderInv(); ui.dirtyInv = false; }
  slotEls.forEach((el, i) => el.classList.toggle('sel', i === p.sel));
  if (p.sel !== lastSel) { lastSel = p.sel; const s = p.held(); $('itemName').textContent = s ? ITEMS[s.id].name : ''; nameTimer = 2; $('itemName').style.opacity = 1; }
  if ((nameTimer -= dt) <= 0) $('itemName').style.opacity = 0;
  // attack indicator + break progress
  const st = p.strength(); $('cool').style.display = st < 1 ? 'block' : 'none'; $('cool').firstChild.style.width = st * 100 + '%';
  const bp = p.brk ? p.brk.prog : p.nuke ? p.nuke.prog : 0; $('brk').style.display = bp > 0 ? 'block' : 'none'; $('brk').firstChild.style.width = bp * 100 + '%';
  // overlays
  const nr = k => on('No Render') && P('No Render', k);
  $('fireOv').style.display = p.fire > 0 && !nr('Fire') ? 'block' : 'none';
  $('blindOv').style.display = p.blind > 0 && !nr('Blindness') ? 'block' : 'none';
  $('game').classList.toggle('nausea', p.nausea > 0 && !nr('Nausea'));
  $('xh').style.display = ui.camMode === 0 ? '' : 'none';
  hud.classList.toggle('chatopen', ui.chat);
}

// ── inventory screen ─────────────────────────────────
const invSlots = [];
let cursorStack = null;
['invMain', 'invBar'].forEach((id, g) => {
  for (let i = 0; i < (g ? 9 : 27); i++) {
    const idx = g ? i : 9 + i, d = document.createElement('div'); d.className = 'islot';
    d.innerHTML = '<canvas width="16" height="16"></canvas><b></b>';
    d.addEventListener('mousedown', e => invClick(idx, e)); invSlots[idx] = d; $(id).appendChild(d);
  }
});
$('inv').addEventListener('contextmenu', e => e.preventDefault());
function renderInv() {
  invSlots.forEach((el, i) => drawStack(el.firstChild, el.lastChild, player.inv[i]));
  const c = $('cursorItem'); c.style.display = cursorStack ? 'block' : 'none';
  if (cursorStack) { c.innerHTML = '<canvas width="16" height="16"></canvas><b></b>'; drawStack(c.firstChild, c.lastChild, cursorStack); }
}
addEventListener('mousemove', e => { const c = $('cursorItem'); c.style.left = e.clientX - 16 + 'px'; c.style.top = e.clientY - 16 + 'px'; });
function invClick(i, e) {
  const inv = player.inv, s = inv[i];
  if (e.shiftKey && s) { const range = i < 9 ? [9, 36] : [0, 9]; for (let j = range[0]; j < range[1]; j++) if (!inv[j]) { inv[j] = s; inv[i] = null; break; } }
  else if (e.button === 2) {
    if (!cursorStack && s) { const h = Math.ceil(s.count / 2); cursorStack = { id: s.id, count: h }; s.count -= h; if (!s.count) inv[i] = null; }
    else if (cursorStack && (!s || (s.id === cursorStack.id && s.count < ITEMS[s.id].max))) { if (!s) inv[i] = { id: cursorStack.id, count: 0 }; inv[i].count++; if (!--cursorStack.count) cursorStack = null; }
  } else {
    if (cursorStack && s && s.id === cursorStack.id) { const n = Math.min(cursorStack.count, ITEMS[s.id].max - s.count); s.count += n; cursorStack.count -= n; if (!cursorStack.count) cursorStack = null; }
    else { inv[i] = cursorStack; cursorStack = s || null; }
  }
  Sound.play('click'); ui.dirtyInv = true;
}
function openInv(state) {
  if (ui.inv === state) return;
  ui.inv = state; $('inv').classList.toggle('on', state);
  if (state) { invMgr.t = 0; invMgr.wait = P('Inventory Manager', 'First Delay'); ui.dirtyInv = true; document.exitPointerLock && document.exitPointerLock(); }
  else { if (cursorStack) { player.give(cursorStack); cursorStack = null; } ui.dirtyInv = true; lockPointer(); }
}
// Inventory Manager: throws junk and sorts the hotbar while the inventory is open
const invMgr = { wait: 0 };
const LAYOUT = [s => s.id === 'sword', s => s.id === 'axe', s => s.id === 'pickaxe', s => ITEMS[s.id].block === 'wool', s => s.id === 'gapple', s => s.id === 'soup', s => s.id === 'potion', s => s.id === 'pearl', s => s.id === 'web'];
function invManagerTick() {
  if (!ui.inv || !on('Inventory Manager')) return;
  if (invMgr.wait-- > 0) return;
  const inv = player.inv, flash = i => { const el = invSlots[i]; el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 160); };
  if (P('Inventory Manager', 'Throw Junk')) {
    const j = inv.findIndex(s => s && ITEMS[s.id].junk);
    if (j >= 0) { flash(j); const d = player.look(); dropItem(inv[j], player.eye.add(d.clone().multiplyScalar(.4)), d.multiplyScalar(.3)); inv[j] = null; ui.dirtyInv = true; invMgr.wait = P('Inventory Manager', 'Item Delay'); return; }
  }
  for (let slot = 0; slot < 9; slot++) {
    if (inv[slot] && LAYOUT[slot](inv[slot])) continue;
    const from = inv.findIndex((s, i) => s && i !== slot && LAYOUT[slot](s) && !(i < 9 && LAYOUT[i](s)));
    if (from < 0) continue;
    flash(from); flash(slot); [inv[slot], inv[from]] = [inv[from], inv[slot]]; ui.dirtyInv = true; invMgr.wait = P('Inventory Manager', 'Item Delay'); return;
  }
  if (P('Inventory Manager', 'Auto Close')) openInv(false);
}
