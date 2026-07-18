# The Fidget Bureau

**Fifty small machines for busy fingers.**

A gallery of 50 tiny interactive canvas toys — gears you can crank, sand you can
pour, a jellyfish that pulses toward your cursor, a Magic 8-Ball you can shake.
Every exhibit responds to touch. There are no goals, no scores, and no way to
lose. Drag, scrub, spin, rake, poke.

### ▶ Play it live

**https://mickeyalton33.github.io/fidget-bureau/**

Each toy is a self-contained little machine built from nothing but mathematics —
no images, no fonts, no libraries, no network. The whole gallery is a single
static HTML file.

## The exhibits

Fifty exhibits across five wings, ten apiece:

| Wing | What lives there |
|------|------------------|
| **Mechanisms** | gear trains, a strandbeest, an escapement, Newton's cradle, a piston engine, a metronome, a split-flap board … |
| **Matter** | ripple pools, pouring sand, a lava lamp, iron filings, ink blooming in water, a waving flag, growing frost … |
| **Optics** | a kaleidoscope pen, moiré, a prism, a magnifier lens, wave interference, a spirograph, soap-film iridescence, caustics … |
| **Creatures** | googly eyes, a wobble flan, a cat's tail, a jellyfish, a Venus flytrap, a night owl, fireflies, a puffer fish … |
| **Curiosities** | bubble wrap, a needy button, a zen garden, a toaster, a fidget spinner, an etch-a-sketch, a Magic 8-Ball, whack-a-mole … |

## How it's built

Each fidget is one JavaScript file in [`fidgets/`](fidgets/) that registers itself
through a tiny contract (see [`CONTRACT.md`](CONTRACT.md)): a `make(env)` factory
returning a `draw(t, dt)` loop plus optional pointer handlers. All state lives in a
closure; timing comes only from the frame clock; the palette is fixed. A shared
[`runtime.js`](runtime.js) mounts every exhibit into a card, drives a single
`requestAnimationFrame` loop (only visible cards are stepped), normalizes pointer
input, and sandboxes each toy so one failure never takes down the wing.

```
fidgets/NN-id.js   →   one exhibit, one F.register({...})
runtime.js         →   the shared engine (mount, size, rAF, input, error-contain)
shell.html         →   the page chrome (masthead, filter chips, ledger)
build.js           →   concatenates it all into dist/ and docs/
harness.js         →   headless test rig for a single fidget
CONTRACT.md        →   the exhibit contract every fidget obeys
```

## Build & test

No dependencies — just Node.

```bash
# assemble the gallery → dist/index.html, dist/artifact.html, docs/index.html
node build.js

# test one fidget against the contract (240 idle frames, a drag arc,
# a wild out-of-bounds drag, hover/wheel/dblclick, a resize, a perf check)
node harness.js fidgets/01-gear-wall.js 1 gear-wall mech
```

Open `dist/index.html` in a browser to view locally. `docs/index.html` is the same
file, and is what GitHub Pages serves.

## Credits

Handmade from mathematics. No cookies, no points, no purpose.
