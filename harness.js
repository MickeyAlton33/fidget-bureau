#!/usr/bin/env node
/* Fidget test harness.
   Usage: node harness.js fidgets/07-gear-wall.js [expectedN expectedId expectedCat]
   Loads one fidget file with a stubbed canvas environment, then:
   - validates the registered definition
   - runs 240 draw frames
   - fires a realistic pointer script (drag arc, hover sweep, wheel, dbl, leave)
   - resizes and runs more frames
   - times the draw loop as a cheap CPU proxy
   Exit 0 = pass. Any exception or contract violation = exit 1 with details. */
'use strict';

const path = require('path');
const file = process.argv[2];
if (!file) { console.error('usage: node harness.js <fidget.js> [n id cat]'); process.exit(2); }
const expectN = process.argv[3] ? Number(process.argv[3]) : null;
const expectId = process.argv[4] || null;
const expectCat = process.argv[5] || null;

const INKS = ['#F5A524', '#F2665B', '#4FC9A0', '#58A6F2', '#B08CE8', '#F2E9DC'];
const BG = '#14100D';
const CATS = ['mech', 'matter', 'optics', 'critters', 'chaos'];

function anyCallable() {
  // A stub object whose every method exists and whose every getter is benign.
  const fn = (...a) => stub;
  const stub = new Proxy(fn, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'data') return new Uint8ClampedArray(4 * 640 * 640);
      if (k === 'width' || k === 'height') return 640;
      if (k === 'length') return 0;
      return stub;
    },
    apply() { return stub; },
  });
  return stub;
}

function makeCtxStub() {
  const values = {};
  const gradStub = anyCallable();
  return new Proxy({}, {
    get(t, k) {
      if (k in values) return values[k];
      switch (k) {
        case 'canvas': return { width: 640, height: 640 };
        case 'createLinearGradient':
        case 'createRadialGradient':
        case 'createConicGradient': return () => gradStub;
        case 'createPattern': return () => gradStub;
        case 'measureText': return () => ({ width: 12, actualBoundingBoxAscent: 9, actualBoundingBoxDescent: 3 });
        case 'getImageData': return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h });
        case 'createImageData': return (w, h) => {
          if (typeof w === 'object') return { data: new Uint8ClampedArray(w.width * w.height * 4), width: w.width, height: w.height };
          return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
        };
        case 'getTransform': return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
        case 'isPointInPath':
        case 'isPointInStroke': return () => false;
        case 'getLineDash': return () => [];
        default: return (...args) => undefined;
      }
    },
    set(t, k, v) { values[k] = v; return true; },
  });
}

function makeCanvasStub(g) {
  return {
    width: 640, height: 640,
    style: {},
    getContext: () => g,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 320, right: 320, bottom: 320 }),
    addEventListener: () => {},
    removeEventListener: () => {},
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
  };
}

const defs = [];
global.F = { register: d => defs.push(d), INKS, BG };
global.window = undefined; // fidgets must not touch window/document
global.document = undefined;

const fails = [];
let perFrameMs = null;
function fail(msg, err) {
  fails.push(msg + (err ? `\n    ${err.stack ? err.stack.split('\n').slice(0, 4).join('\n    ') : err}` : ''));
}

try {
  require(path.resolve(file));
} catch (err) {
  fail('file threw while loading', err);
  report();
}

if (defs.length !== 1) fail(`expected exactly 1 F.register() call, got ${defs.length}`);
const def = defs[0] || {};
if (typeof def.n !== 'number' || !Number.isInteger(def.n) || def.n < 1 || def.n > 50) fail(`bad n: ${def.n}`);
if (typeof def.id !== 'string' || !/^[a-z0-9-]{3,32}$/.test(def.id)) fail(`bad id: ${def.id}`);
if (typeof def.title !== 'string' || def.title.length < 3 || def.title.length > 30) fail(`bad title: ${def.title}`);
if (typeof def.hint !== 'string' || def.hint.length < 8 || def.hint.length > 70) fail(`bad hint: ${def.hint}`);
if (!CATS.includes(def.cat)) fail(`bad cat: ${def.cat} (must be one of ${CATS.join('/')})`);
if (typeof def.make !== 'function') fail('make is not a function');
if (expectN !== null && def.n !== expectN) fail(`n mismatch: expected ${expectN}, got ${def.n}`);
if (expectId !== null && def.id !== expectId) fail(`id mismatch: expected ${expectId}, got ${def.id}`);
if (expectCat !== null && def.cat !== expectCat) fail(`cat mismatch: expected ${expectCat}, got ${def.cat}`);
if (fails.length) report();

const g = makeCtxStub();
const canvas = makeCanvasStub(g);
const env = { c: canvas, g, w: 320, h: 320, inks: INKS, bg: BG, audio: () => anyCallable() };

let inst;
try {
  inst = def.make(env);
} catch (err) { fail('make() threw', err); report(); }
if (!inst || typeof inst.draw !== 'function') { fail('make() must return an object with a draw(t, dt) function'); report(); }
for (const k of Object.keys(inst)) {
  if (!['draw', 'down', 'move', 'up', 'wheel', 'dbl', 'leave', 'resize'].includes(k)) {
    fail(`unknown key "${k}" returned from make() — allowed: draw/down/move/up/wheel/dbl/leave/resize`);
  }
}
if (fails.length) report();

const dt = 1 / 60;
let t = 0;
function frames(n, label) {
  for (let i = 0; i < n; i++) {
    t += dt;
    try { inst.draw(t, dt); } catch (err) { fail(`draw() threw during ${label} (frame ${i}, t=${t.toFixed(2)})`, err); report(); }
  }
}
function fire(name, ...args) {
  if (!inst[name]) return;
  try { inst[name](...args); } catch (err) { fail(`${name}() threw with args ${JSON.stringify(args)}`, err); report(); }
}

// idle
frames(120, 'idle');

// drag: down center, sweep an arc while held, release
fire('down', { x: 160, y: 160, held: true });
for (let i = 0; i < 40; i++) {
  const a = (i / 40) * Math.PI * 2;
  fire('move', { x: 160 + 90 * Math.cos(a), y: 160 + 90 * Math.sin(a), held: true });
  frames(1, 'held-drag');
}
fire('up', { x: 250, y: 160, held: false });
frames(30, 'post-drag');

// fast diagonal drag with out-of-bounds excursions (pointer capture allows negative coords)
fire('down', { x: 10, y: 10, held: true });
for (let i = 0; i < 20; i++) {
  fire('move', { x: -30 + i * 22, y: -20 + i * 21, held: true });
  frames(1, 'wild-drag');
}
fire('up', { x: 410, y: 400, held: false });

// hover sweep (not held)
for (let i = 0; i < 25; i++) {
  fire('move', { x: i * 13, y: 160 + 60 * Math.sin(i / 3), held: false });
  frames(1, 'hover');
}
fire('leave', { x: 330, y: 160, held: false });

// wheel, double-click, second quick tap
fire('wheel', 120, { x: 160, y: 160, held: false });
fire('wheel', -120, { x: 80, y: 240, held: false });
fire('dbl', { x: 160, y: 160, held: false });
fire('down', { x: 200, y: 100, held: true });
fire('up', { x: 200, y: 100, held: false });
frames(60, 'post-events');

// resize then keep running
env.w = 264; env.h = 264;
fire('resize', 264, 264);
frames(60, 'post-resize');
env.w = 320; env.h = 320;
fire('resize', 320, 320);

// perf proxy: 240 frames of pure draw
const t0 = process.hrtime.bigint();
frames(240, 'perf');
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
perFrameMs = ms / 240;
if (perFrameMs > 4) fail(`draw() too slow: ${perFrameMs.toFixed(2)}ms/frame in a stub context (budget 4ms — the real canvas adds more)`);

report();

function report() {
  if (fails.length) {
    console.error(`FAIL ${file}`);
    for (const f of fails) console.error('  - ' + f);
    process.exit(1);
  } else {
    console.log(`PASS ${file} (${def.id}, №${def.n}, ${def.cat}) draw=${(perFrameMs === null ? '?' : perFrameMs.toFixed(2))}ms/frame`);
    process.exit(0);
  }
}
