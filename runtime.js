/* The Fidget Bureau — exhibit runtime.
   Mounts every registered fidget into a card, sizes its canvas for the
   device pixel ratio, drives a single shared rAF loop (only visible
   exhibits are stepped), normalizes pointer input, and contains errors
   so one broken exhibit never takes down the wing. */
(() => {
'use strict';

const INKS = ['#F5A524', '#F2665B', '#4FC9A0', '#58A6F2', '#B08CE8', '#F2E9DC'];
const BG = '#14100D';
const CATS = {
  mech:     'Mechanisms',
  matter:   'Matter',
  optics:   'Optics',
  critters: 'Creatures',
  chaos:    'Curiosities',
};

const registry = [];
window.F = { register: d => registry.push(d), INKS, BG };

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DPR = Math.min(2, window.devicePixelRatio || 1);

/* ---- shared audio, created lazily on first gesture ---- */
let audioCtx = null;
function getAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = AC ? new AC() : null;
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/* ---- fiddle ledger ---- */
let fiddled = new Set();
try { fiddled = new Set(JSON.parse(localStorage.getItem('bureau-fiddled') || '[]')); } catch (e) {}
function saveFiddled() {
  try { localStorage.setItem('bureau-fiddled', JSON.stringify([...fiddled])); } catch (e) {}
}

const cards = [];          // mounted card records
const active = new Set();  // records currently on screen

function breakCard(rec, err) {
  if (rec.broken) return;
  rec.broken = true;
  active.delete(rec);
  console.error(`[bureau] exhibit ${rec.def.id} is out of order:`, err);
  const note = document.createElement('div');
  note.className = 'outoforder';
  note.innerHTML = `<strong>Out of order</strong>Exhibit № ${String(rec.def.n).padStart(2, '0')} is being serviced.`;
  rec.stage.appendChild(note);
}

function sizeCanvas(rec) {
  const r = rec.stage.getBoundingClientRect();
  const w = Math.max(40, Math.round(r.width));
  const h = Math.max(40, Math.round(r.height));
  if (w === rec.env.w && h === rec.env.h && rec.canvas.width) return;
  rec.canvas.width = Math.round(w * DPR);
  rec.canvas.height = Math.round(h * DPR);
  rec.env.w = w;
  rec.env.h = h;
  if (rec.inst && rec.inst.resize) {
    try { rec.inst.resize(w, h); } catch (err) { breakCard(rec, err); }
  }
}

function ensureInst(rec) {
  if (rec.inst || rec.broken) return;
  sizeCanvas(rec);
  try {
    rec.inst = rec.def.make(rec.env);
    if (!rec.inst || typeof rec.inst.draw !== 'function') throw new Error('make() returned no draw()');
  } catch (err) {
    rec.inst = null;
    breakCard(rec, err);
  }
}

function markFiddled(rec) {
  if (fiddled.has(rec.def.id)) return;
  fiddled.add(rec.def.id);
  rec.card.classList.add('fiddled');
  saveFiddled();
  updateLedger();
}

function updateLedger() {
  const total = cards.length;
  const n = [...fiddled].filter(id => cards.some(c => c.def.id === id)).length;
  const tally = document.getElementById('tally');
  const bar = document.getElementById('tally-bar');
  if (tally) tally.textContent = `${n} / ${total}`;
  if (bar) bar.style.width = total ? `${(100 * n / total)}%` : '0%';
  const done = document.getElementById('tally-done');
  if (done) done.hidden = n < total || total === 0;
}

function localPoint(rec, e) {
  const r = rec.canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top, held: rec.held };
}

function call(rec, fn, ...args) {
  if (!rec.inst || rec.broken || !rec.inst[fn]) return;
  try { rec.inst[fn](...args); } catch (err) { breakCard(rec, err); }
}

function mountCard(def) {
  const grid = document.getElementById('grid');
  const card = document.createElement('figure');
  card.className = 'card';
  card.dataset.cat = def.cat;
  if (fiddled.has(def.id)) card.classList.add('fiddled');

  const stage = document.createElement('div');
  stage.className = 'stage';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${def.title}. ${def.hint}`);
  stage.appendChild(canvas);

  const plaque = document.createElement('figcaption');
  plaque.className = 'plaque';
  plaque.innerHTML =
    `<span class="no">№ ${String(def.n).padStart(2, '0')} · ${(CATS[def.cat] || def.cat).toUpperCase()}</span>` +
    `<span class="tick" title="Fiddled with. The Bureau thanks you.">✓</span>` +
    `<h3>${def.title}</h3><p class="hint">${def.hint}</p>`;

  card.appendChild(stage);
  card.appendChild(plaque);
  grid.appendChild(card);

  const g = canvas.getContext('2d');
  const rec = {
    def, card, stage, canvas, g,
    env: { c: canvas, g, w: 0, h: 0, inks: INKS, bg: BG, audio: getAudio },
    inst: null, broken: false, held: false, t: 0,
  };

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    ensureInst(rec);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    rec.held = true;
    markFiddled(rec);
    call(rec, 'down', localPoint(rec, e));
  });
  canvas.addEventListener('pointermove', e => {
    if (!rec.inst) return;
    call(rec, 'move', localPoint(rec, e));
  });
  const release = e => {
    if (!rec.held && !rec.inst) return;
    const was = rec.held;
    rec.held = false;
    if (was) call(rec, 'up', localPoint(rec, e));
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', e => {
    if (!rec.held) call(rec, 'leave', localPoint(rec, e));
  });
  canvas.addEventListener('dblclick', e => {
    e.preventDefault();
    ensureInst(rec);
    call(rec, 'dbl', localPoint(rec, e));
  });
  canvas.addEventListener('wheel', e => {
    ensureInst(rec);
    if (rec.inst && rec.inst.wheel) {
      e.preventDefault();
      markFiddled(rec);
      call(rec, 'wheel', e.deltaY, localPoint(rec, e));
    }
  }, { passive: false });

  cards.push(rec);
  return rec;
}

/* ---- masthead: the title itself is exhibit zero ---- */
const letters = [];
function mountMasthead() {
  const h1 = document.getElementById('masthead');
  if (!h1 || reduced) return;
  const text = h1.textContent;
  h1.textContent = '';
  h1.setAttribute('aria-label', text);
  const words = text.split(' ');
  words.forEach((word, wi) => {
    const wspan = document.createElement('span');
    wspan.className = 'word';
    wspan.setAttribute('aria-hidden', 'true');
    for (const ch of word) {
      const s = document.createElement('span');
      s.textContent = ch;
      s.className = 'glyph';
      wspan.appendChild(s);
      letters.push({ el: s, y: 0, vy: 0, r: 0, vr: 0 });
    }
    h1.appendChild(wspan);
    if (wi < words.length - 1) h1.appendChild(document.createTextNode(' '));
  });
  h1.addEventListener('pointermove', e => {
    for (const L of letters) {
      const r = L.el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const d = Math.hypot(e.clientX - cx, e.clientY - cy);
      if (d < 64) {
        const k = (64 - d) / 64;
        L.vy -= 160 * k;
        L.vr += (e.clientX < cx ? -1 : 1) * 3.5 * k;
      }
    }
  });
}
function mastheadStep(dt) {
  for (const L of letters) {
    L.vy += -260 * L.y * dt; L.vy *= Math.pow(0.0045, dt); L.y += L.vy * dt;
    L.vr += -260 * L.r * dt; L.vr *= Math.pow(0.0045, dt); L.r += L.vr * dt;
    if (Math.abs(L.y) > 0.1 || Math.abs(L.r) > 0.1 || Math.abs(L.vy) > 0.1 || Math.abs(L.vr) > 0.1) {
      L.el.style.transform = `translateY(${L.y.toFixed(1)}px) rotate(${L.r.toFixed(2)}deg)`;
    } else if (L.el.style.transform) {
      L.el.style.transform = '';
    }
  }
}

/* ---- filter chips ---- */
function mountChips() {
  const nav = document.getElementById('chips');
  if (!nav) return;
  const counts = {};
  for (const rec of cards) counts[rec.def.cat] = (counts[rec.def.cat] || 0) + 1;
  const mk = (key, label, count) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.filter = key;
    b.innerHTML = count == null ? label : `${label} <i>${count}</i>`;
    b.setAttribute('aria-pressed', key === 'all' ? 'true' : 'false');
    b.addEventListener('click', () => {
      for (const o of nav.querySelectorAll('button')) o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
      for (const rec of cards) rec.card.hidden = key !== 'all' && rec.def.cat !== key;
    });
    nav.appendChild(b);
  };
  mk('all', 'All exhibits', cards.length);
  for (const key of Object.keys(CATS)) if (counts[key]) mk(key, CATS[key], counts[key]);
}

/* ---- boot ---- */
function boot() {
  registry.sort((a, b) => a.n - b.n);
  for (const def of registry) mountCard(def);
  mountChips();
  mountMasthead();
  updateLedger();

  const reset = document.getElementById('reset-ledger');
  if (reset) reset.addEventListener('click', () => {
    fiddled.clear();
    saveFiddled();
    for (const rec of cards) rec.card.classList.remove('fiddled');
    updateLedger();
  });

  const io = new IntersectionObserver(entries => {
    for (const en of entries) {
      const rec = cards.find(c => c.stage === en.target);
      if (!rec || rec.broken) continue;
      if (en.isIntersecting) {
        ensureInst(rec);
        if (!rec.broken) active.add(rec);
      } else {
        active.delete(rec);
      }
    }
  }, { rootMargin: '120px' });
  for (const rec of cards) io.observe(rec.stage);

  const ro = new ResizeObserver(entries => {
    for (const en of entries) {
      const rec = cards.find(c => c.stage === en.target);
      if (rec && rec.inst) sizeCanvas(rec);
    }
  });
  for (const rec of cards) ro.observe(rec.stage);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const rec of active) {
      if (!rec.inst || rec.broken) continue;
      rec.t += dt;
      rec.g.setTransform(DPR, 0, 0, DPR, 0, 0);
      try { rec.inst.draw(rec.t, dt); } catch (err) { breakCard(rec, err); }
    }
    mastheadStep(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
