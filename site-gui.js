'use strict';
// Homepage copy of Ethane's dropdown Click GUI, driven by the same module data as the playground (play/core.js).
// Changes here are a demo only: nothing is saved, so the playground keeps its own config.
saveConfig = () => {};
['KillAura', 'Velocity', 'Speed', 'Sprint', 'ESP', 'Scaffold'].forEach(n => M(n).on = true);
M('Click GUI').on = true;

const stage = $('stage'), panelsEl = $('panels'), alEl = $('al'), tip = $('tip');
const PW = 168, OUT_QUART = 'cubic-bezier(.25,1,.5,1)';
let panels = [], hidden = false, dragging = null, areaH = 0;
const disp = s => P('Click GUI', 'Lower Case') ? s.toLowerCase() : s;
const keyName = c => c ? c.replace('ShiftRight', 'RShift').replace(/^Key/, '') : '';
const sortMods = list => { const len = P('Click GUI', 'Sorting') === 'Length'; return list.sort((a, b) => (len && b.name.length - a.name.length) || a.name.localeCompare(b.name)); };
const narrow = () => stage.classList.contains('scroll');

function renderProps(m, pin) {
  pin.innerHTML = '';
  if (PASSIVE[m.name]) { const n = document.createElement('div'); n.className = 'pr note'; n.textContent = PASSIVE[m.name]; pin.appendChild(n); }
  for (const p of m.props) {
    if (p.hide && p.hide()) continue;
    const r = document.createElement('div'), val = m.v[p.n];
    if (p.t === 'b') {
      r.className = 'pr row'; r.innerHTML = `<span>${disp(p.n)}</span><i class="sw ${val ? 'on' : ''}"></i>`;
      r.onpointerdown = e => { if (e.button) return; setProp(m.name, p.n, !m.v[p.n]); Sound.play('click'); };
    } else if (p.t === 'n') {
      const pct = (val - p.min) / (p.max - p.min) * 100, dec = p.step < 1 ? (String(p.step).split('.')[1] || '').length : 0;
      r.className = 'pr'; r.innerHTML = `<div class="nl"><span style="color:#fff">${disp(p.n)}</span><span>${(+val).toFixed(dec)}</span></div><div class="sl"><i style="width:${pct}%"></i><b style="left:${pct}%"></b></div>`;
      const sl = r.querySelector('.sl');
      const set = e => { const b = sl.getBoundingClientRect(); let v = p.min + clamp((e.clientX - b.left) / b.width, 0, 1) * (p.max - p.min); v = +clamp(Math.round(v / p.step) * p.step, p.min, p.max).toFixed(4); if (v !== m.v[p.n]) setProp(m.name, p.n, v); };
      sl.onpointerdown = e => { if (e.button) return; e.preventDefault(); set(e); const mv = ev => set(ev), up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); };
    } else if (p.t === 'e') {
      r.className = 'pr'; r.innerHTML = `<div>${disp(p.n)}</div><div class="ml">${p.o.map(o => `<button class="${o === val ? 'on' : ''}">${disp(o)}</button>`).join('')}</div>`;
      r.querySelectorAll('button').forEach((b, i) => b.onpointerdown = e => { if (e.button) return; setProp(m.name, p.n, p.o[i]); Sound.play('click'); });
    } else if (p.t === 'c') {
      r.className = 'pr row cl'; r.innerHTML = `<span>${disp(p.n)}</span><input type="color" value="${rgbToHex(val)}">`;
      r.querySelector('input').oninput = e => setProp(m.name, p.n, hexToRgb(e.target.value));
    }
    pin.appendChild(r);
  }
}
function modEl(m) {
  const el = document.createElement('div'); el.className = 'mod'; el.dataset.mod = m.name;
  el.innerHTML = `<div class="mr ${m.on ? 'on' : ''}"><span>${disp(m.name)}</span>${m.bind ? `<i class="bind">${keyName(m.bind)}</i>` : ''}</div><div class="props"><div><div class="pin"></div></div></div>`;
  const mr = el.firstChild;
  let press = 0;
  mr.addEventListener('pointerdown', e => {
    Sound.init();
    if (e.pointerType === 'touch') { press = setTimeout(() => { press = -1; expand(el, m); }, 420); return; }
    if (e.button === 0) toggleMod(m.name); else if (e.button === 2) expand(el, m);
  });
  mr.addEventListener('pointerup', e => { if (e.pointerType === 'touch' && press !== -1) { clearTimeout(press); toggleMod(m.name); } press = 0; });
  mr.addEventListener('pointermove', e => { if (e.pointerType === 'touch' || dragging) return; tip.style.display = 'block'; tip.textContent = m.desc + (PASSIVE[m.name] ? ' (' + PASSIVE[m.name] + ')' : ''); tip.style.left = e.clientX + 14 + 'px'; tip.style.top = e.clientY + 14 + 'px'; });
  mr.addEventListener('pointerleave', () => tip.style.display = 'none');
  renderProps(m, el.querySelector('.pin'));
  return el;
}
function expand(el, m) { if (!m.props.length && !PASSIVE[m.name]) return; el.classList.toggle('open'); Sound.play(el.classList.contains('open') ? 'disable' : 'enable'); }

// ── panels: target position (x,y) + smoothed render position, like CategoryComponent ──
function defaultPos(i) {
  const w = panelsEl.clientWidth, gap = clamp((w - CATS.length * PW) / (CATS.length - 1), 10, 34);
  return { x: i * (PW + gap), y: (i % 2) * 14 };
}
function build() {
  const open = new Set([...panelsEl.querySelectorAll('.mod.open')].map(e => e.dataset.mod));
  const prev = panels; panelsEl.innerHTML = '';
  panels = CATS.map((c, i) => {
    const pn = document.createElement('div'); pn.className = 'panel';
    pn.innerHTML = `<div class="pbody"><div class="ph">${disp(c)}</div><div class="mods"></div></div>`;
    const mods = pn.querySelector('.mods'), list = sortMods([...MODS.values()].filter(m => m.cat === c));
    list.forEach((m, j) => { const e = modEl(m); if (j === list.length - 1) e.classList.add('last'); if (open.has(m.name)) e.classList.add('open'); mods.appendChild(e); });
    const p = prev[i] ? { x: prev[i].x, y: prev[i].y, moved: prev[i].moved } : { ...defaultPos(i), moved: false };
    const o = { el: pn, body: pn.firstChild, i, x: p.x, y: p.y, rx: p.x, ry: p.y, tilt: 0, moved: p.moved, z: 1 };
    pn.querySelector('.ph').addEventListener('pointerdown', e => startDrag(o, e));
    panelsEl.appendChild(pn);
    return o;
  });
}
let zTop = 10;
function startDrag(o, e) {
  if (e.button || narrow() || hidden) return;
  e.preventDefault(); Sound.init();
  const h = e.currentTarget; h.setPointerCapture(e.pointerId);
  const ox = e.clientX - o.x, oy = e.clientY - o.y;
  o.el.style.zIndex = ++zTop; o.el.classList.add('dragging'); o.moved = true;
  dragging = o; tip.style.display = 'none';
  const maxX = () => panelsEl.clientWidth - PW, maxY = () => Math.max(0, areaH - o.body.offsetHeight);
  const mv = ev => { o.x = clamp(ev.clientX - ox, 0, maxX()); o.y = clamp(ev.clientY - oy, 0, maxY()); };
  const up = () => { o.el.classList.remove('dragging'); dragging = null; h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); };
  h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
}
stage.addEventListener('contextmenu', e => e.preventDefault());

// ── open / close animations (Web Animations, so they always run) ──
function openAnim() {
  panels.forEach(o => {
    o.body.getAnimations().forEach(a => a.cancel());
    o.body.style.visibility = '';
    o.body.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 500, delay: o.i * 55, easing: OUT_QUART, fill: 'backwards' });
  });
}
function closeAnim() {
  panels.forEach(o => {
    o.body.getAnimations().forEach(a => a.cancel());
    const a = o.body.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0)', opacity: 0 }], { duration: 260, delay: (CATS.length - 1 - o.i) * 35, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
    a.onfinish = () => { if (hidden) { o.body.style.visibility = 'hidden'; a.cancel(); } };
  });
}
function setHidden(h) {
  if (hidden === h) return;
  hidden = h; M('Click GUI').on = !h;
  const row = panelsEl.querySelector('.mod[data-mod="Click GUI"] .mr'); if (row) row.classList.toggle('on', !h);
  stage.classList.toggle('closed', h); tip.style.display = 'none';
  alKey = '';
  h ? closeAnim() : openAnim();
}
addEventListener('keydown', e => {
  if (e.code !== 'ShiftRight' || e.repeat || /input|textarea/i.test(document.activeElement.tagName)) return;
  Sound.init(); Sound.play(hidden ? 'enable' : 'disable'); setHidden(!hidden);
});
$('reopen').onclick = () => { Sound.init(); Sound.play('enable'); setHidden(false); };

hooks.change.push((m, prop) => {
  if (!m) return;
  if (m.name === 'Click GUI' && prop) { build(); alKey = ''; return; }
  if (m.name === 'Click GUI') { setHidden(!m.on); return; }
  const el = panelsEl.querySelector(`.mod[data-mod="${CSS.escape(m.name)}"]`);
  if (!el) return;
  el.firstChild.classList.toggle('on', m.on);
  if (prop) renderProps(m, el.querySelector('.pin'));
});

// ── ArrayList: sorted by width, wave colours, masked at the right edge ──
const alEls = new Map(); let alKey = '';
function updateArrayList() {
  const list = [...MODS.values()].filter(m => m.on && !m.hidden);
  const key = list.map(m => m.name + (m.suffix ? m.suffix() : '')).join('|');
  if (key !== alKey) {
    alKey = key;
    for (const [n, el] of alEls) if (!list.find(m => m.name === n)) { el.classList.add('out'); alEls.delete(n); setTimeout(() => el.remove(), 320); }
    for (const m of list) {
      let el = alEls.get(m.name);
      if (!el) { el = document.createElement('div'); el.className = 'ali out'; alEl.appendChild(el); alEls.set(m.name, el); }
      el.innerHTML = `<span class="nm">${m.name}</span>${m.suffix ? `<span class="sf"> [${m.suffix()}]</span>` : ''}<i class="bar"></i>`;
    }
    const sorted = [...alEls.values()].sort((a, b) => b.offsetWidth - a.offsetWidth);
    sorted.forEach((el, i) => { el.style.top = i * 22 + 'px'; el.dataset.i = i; });
    alEl.style.height = Math.max(alEls.size, alEl.children.length) * 22 + 'px';
    requestAnimationFrame(() => requestAnimationFrame(() => sorted.forEach(el => el.classList.remove('out'))));
  }
  for (const el of alEls.values()) { const c = rgb(wave(+el.dataset.i * 11)); el.firstChild.style.color = c; el.lastChild.style.background = c; }
}

function frame() {
  const t = performance.now();
  panels.forEach(o => { o.el.style.setProperty('--a', rgb(wave(o.i * 20))); o.el.style.setProperty('--b', rgb(wave((o.i + 1) * 20))); });
  if (narrow()) { panels.forEach(o => o.el.style.transform = ''); panelsEl.style.height = ''; }
  else {
    panels.forEach(o => {
      const dx = o.x - o.rx;
      o.rx += dx * .2; o.ry += (o.y - o.ry) * .2;                       // renderX += (x - renderX) * 0.2
      const target = dragging === o ? clamp(dx, -25, 25) : 0;            // targetTilt = diffX
      o.tilt += (target - o.tilt) * .12;                                 // eased towards the target
      if (Math.abs(o.tilt) < .01) o.tilt = 0;
      o.el.style.transform = `translate3d(${o.rx.toFixed(2)}px,${o.ry.toFixed(2)}px,0) rotate(${o.tilt.toFixed(2)}deg)`;
    });
    if (!dragging) {
      let h = 0; panels.forEach(o => h = Math.max(h, o.y + o.body.offsetHeight));
      areaH = hidden ? 120 : Math.max(h + 12, 140);
      panelsEl.style.height = areaH + 'px';
    }
  }
  updateArrayList();
  requestAnimationFrame(frame);
}
function fit() {
  stage.classList.toggle('scroll', innerWidth < 1000);
  if (narrow()) return;
  panels.forEach(o => { if (!o.moved) { const p = defaultPos(o.i); o.x = p.x; o.y = p.y; } o.x = clamp(o.x, 0, Math.max(0, panelsEl.clientWidth - PW)); });
}
addEventListener('resize', fit);
stage.classList.toggle('scroll', innerWidth < 1000);
build();
panels.forEach(o => { o.rx = o.x; o.ry = o.y; });
requestAnimationFrame(() => { openAnim(); requestAnimationFrame(frame); });
