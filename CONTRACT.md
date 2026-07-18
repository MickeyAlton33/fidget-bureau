# The Fidget Bureau — Exhibit Contract

You are implementing ONE fidget: a small interactive canvas toy that lives in a square
card (~280–420 CSS px) on a page with 49 siblings. This document is binding.

## File shape

One file, one registration, nothing else at top level:

```js
F.register({
  n: 7, id: 'my-toy', cat: 'mech',
  title: 'My toy', hint: 'Drag the thing — feel the other thing',
  make(env) {
    // ALL state lives in this closure
    return {
      draw(t, dt) { /* required */ },
      down(p) {}, move(p) {}, up(p) {},      // optional
      wheel(dy, p) {}, dbl(p) {}, leave(p) {}, // optional
      resize(w, h) {},                        // optional
    };
  },
});
```

- `n` (1–50), `id` (kebab-case 3–32 chars), `cat` (`mech|matter|optics|critters|chaos`),
  `title` (≤30 chars), `hint` (8–70 chars, imperative, tells the visitor what to do).
- Files are concatenated into one page. Declare NOTHING outside `F.register(...)` —
  no top-level `const`/`let`/helper functions. Everything goes inside `make()`.
- Only the keys shown above may appear on the returned instance (the harness rejects others).

## The environment

`env = { c, g, w, h, inks, bg, audio }`

- `g` — CanvasRenderingContext2D. The runtime resets the transform every frame; draw in
  CSS-pixel coordinates `0..env.w × 0..env.h`. Never read `env.c.width` (that's device px).
- `env.w`, `env.h` — live values; they change when the card resizes. Read them fresh in
  `draw()`. Rebuild any size-derived buffers in `resize(w, h)`.
- `env.inks` — the palette, in order: `['#F5A524' amber, '#F2665B' coral, '#4FC9A0' mint,
  '#58A6F2' sky, '#B08CE8' lilac, '#F2E9DC' cream]`. Use these (plus rgba/alpha
  variants of them) — do not invent unrelated colors.
- `env.bg` — `'#14100D'`. Paint the whole card from this every frame: opaque
  `g.fillStyle = bg; g.fillRect(0,0,env.w,env.h)`, or a translucent version for
  deliberate trails. Never leave stale garbage or accumulate uncleared strokes.
- `env.audio()` — do NOT use unless your spec explicitly says so.

## Lifecycle & input semantics

- `draw(t, dt)` runs only while the card is on screen. `t` = seconds of visible life,
  `dt` clamped ≤ 0.05. ALL timing comes from `t`/`dt` — no `Date.now`, no
  `performance.now`, no `setTimeout`/`setInterval`/`requestAnimationFrame`.
- `p = { x, y, held }` in CSS px. `move` fires on hover too — `p.held` says whether the
  button is down. During a held drag the pointer is captured: coordinates can go negative
  or beyond `env.w/h`, and `up` can land outside the card. Never crash on that.
- Declare `wheel` ONLY if you use it (declaring it blocks page scrolling over the card).
- `dbl` fires on double-click (a `down`/`up` pair precedes it — design accordingly).

## Hard bans

No `window`, `document`, DOM, `localStorage`, `fetch`, images, web fonts, emoji-glyph
rendering, `console` spam, or libraries. The harness runs your file with those absent —
touching them fails the build. `Math.random()` is fine (seeding at init and in event
handlers; avoid per-frame reseeding that causes flicker).

## Performance budget

~2 ms of JS per frame — you share the page with up to ~9 other visible exhibits.

- Particles: ≤ ~800 with O(n) updates. Pairwise-collision only for n ≤ ~50.
- Typed arrays for grids; allocate buffers ONCE (in `make`/`resize`), never per frame.
- `getImageData`/`putImageData`: small dedicated buffers only (≤ ~110×110), reused.
- `shadowBlur`: at most 1–2 uses per frame, never inside a loop. Prefer layered
  translucent strokes or radial gradients for glow.
- Cap every trail/history array; splice the old end.
- Offscreen canvases: create in `make`/`resize` only.

## Robustness

- Guard divisions: `Math.hypot(dx,dy) + 1e-6`. Clamp spring/sim velocities.
- NaN in a coordinate silently blanks the whole canvas — the reviewer will hunt for this.
- Simulations must stay stable through the harness's wild-drag test (fast pointer sweeps
  with out-of-bounds coordinates) and through a resize mid-life.

## House style — what "good" looks like

- **Alive at idle.** Before any touch: breathing, drifting, ticking — an obvious
  "grab me" affordance. A static card is a defect.
- **Immediate response.** First frame after input, something visibly answers.
- **Springs everywhere.** Nothing snaps or teleports; ease it, let it overshoot, let it
  wobble to rest. Squash & stretch on anything with personality.
- **Bold at 300px.** Chunky 2–4px strokes, `lineCap/lineJoin: 'round'`, big readable
  shapes. No fields of 1px hairlines (a deliberate dust/dot aesthetic is fine).
- **Palette discipline.** Inks on the warm dark ground. 2–3 inks per exhibit usually
  beats all six.
- **No explanatory text on canvas.** The plaque under the card shows title + hint.
  Glyphs/labels that are part of the toy itself (per spec) are allowed, drawn with
  system font strings like `'700 14px ui-monospace, Menlo, monospace'`.
- Study `fidgets/01-gear-wall.js` — that is the bar.

## Verify before you finish

```
node <dir>/harness.js <dir>/fidgets/NN-your-id.js <n> <id> <cat>
```

Must print `PASS`. It checks the contract, runs 240 idle frames, a drag arc, a wild
out-of-bounds drag, hover sweeps, wheel, double-click, a resize, and times your draw
loop (budget 4 ms/frame in the stub). Fix and re-run until PASS — do not return without it.
