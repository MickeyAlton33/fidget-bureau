/* № 03 — Ripple pool. A pane of still water. Tap to drop stones, drag to
   plow a wake, hover to graze the surface, and the rain keeps it company
   while you're away. Two-buffer wave equation on a 96×96 heightfield,
   painted through one reused ImageData and upscaled soft for a liquid look. */
F.register({
  n: 3, id: 'ripple-pool', cat: 'matter',
  title: 'Ripple pool', hint: 'Tap to drop stones — drag to plow a wake',
  make(env) {
    const { g, inks, bg } = env;
    const N = 96, STEP = 1 / 120, DAMP = 0.99; // ≈0.98 per 60Hz frame
    let cur = new Float32Array(N * N);         // height now
    let old = new Float32Array(N * N);         // height last step (becomes next)
    let acc = 0;                               // sim-time accumulator
    let rain = 1.1;                            // seconds until next raindrop
    let last = null;                           // last held pointer, grid coords
    let graze = null;                          // last hover pointer, grid coords

    // Offscreen 96×96 surface. The test stub has no canvas constructors, so
    // fall back to an inert stand-in with the same two calls we need.
    const oc = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(N, N)
      : { width: N, height: N, getContext: () => ({
          createImageData: (w, h) =>
            ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
          putImageData: () => {},
        }) };
    const octx = oc.getContext('2d');
    const img = octx.createImageData(N, N);
    const px = img.data;
    for (let i = 3; i < px.length; i += 4) px[i] = 255;

    // Height → water color LUT: deep floor, through still bg-blue, up sky,
    // cresting cream. Index 128 = flat water.
    const rgb = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
    const mix = (a, b, f) => [0, 1, 2].map(k => a[k] + (b[k] - a[k]) * f);
    const SKY = rgb(inks[3]), CREAM = rgb(inks[5]), GROUND = rgb(bg);
    const stops = [
      [0.00, mix(GROUND, [0, 0, 0], 0.55)],
      [0.50, mix(GROUND, SKY, 0.14)],
      [0.80, SKY],
      [1.00, CREAM],
    ];
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const f = i / 255;
      let s = 0;
      while (s < stops.length - 2 && f > stops[s + 1][0]) s++;
      const u = (f - stops[s][0]) / (stops[s + 1][0] - stops[s][0]);
      const c = mix(stops[s][1], stops[s + 1][1], Math.min(1, Math.max(0, u)));
      lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2];
    }

    function splash(gx, gy, amp, rad) {
      const x0 = Math.max(1, Math.ceil(gx - rad)), x1 = Math.min(N - 2, Math.floor(gx + rad));
      const y0 = Math.max(1, Math.ceil(gy - rad)), y1 = Math.min(N - 2, Math.floor(gy + rad));
      const r2 = rad * rad;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const d2 = (x - gx) * (x - gx) + (y - gy) * (y - gy);
          if (d2 >= r2) continue;
          const f = 1 - d2 / r2;
          cur[y * N + x] += amp * f * f;
        }
      }
    }

    function step() {
      // next = (sum of 4 neighbors)/2 − prev, damped; zero border reflects.
      for (let y = 1; y < N - 1; y++) {
        let i = y * N + 1;
        for (let x = 1; x < N - 1; x++, i++) {
          old[i] = ((cur[i - 1] + cur[i + 1] + cur[i - N] + cur[i + N]) * 0.5 - old[i]) * DAMP;
        }
      }
      const t = cur; cur = old; old = t;
    }

    function paint() {
      for (let y = 0; y < N; y++) {
        const up = y > 0 ? -N : 0, dn = y < N - 1 ? N : 0;
        let i = y * N, o = i * 4;
        for (let x = 0; x < N; x++, i++, o += 4) {
          // height plus a slope term so crests catch light from above
          const e = 128 + cur[i] * 110 + (cur[i + up] - cur[i + dn]) * 60;
          const k = (e < 0 ? 0 : e > 255 ? 255 : e | 0) * 3;
          px[o] = lut[k]; px[o + 1] = lut[k + 1]; px[o + 2] = lut[k + 2];
        }
      }
      octx.putImageData(img, 0, 0);
    }

    const gridX = p => p.x / Math.max(1, env.w) * N;
    const gridY = p => p.y / Math.max(1, env.h) * N;

    // opening plops so the pool is already alive on first sight
    splash(N * 0.38, N * 0.32, -1.5, 2.3);
    splash(N * 0.68, N * 0.64, -0.9, 1.8);

    return {
      draw(t, dt) {
        rain -= dt;
        if (rain <= 0) {
          splash(4 + Math.random() * (N - 8), 4 + Math.random() * (N - 8),
            -(0.7 + Math.random() * 0.9), 1.4 + Math.random() * 1.2);
          rain = 1.8 + Math.random() * 1.5;
        }
        acc = Math.min(acc + dt, STEP * 4);
        while (acc >= STEP) { step(); acc -= STEP; }
        paint();
        g.fillStyle = bg;
        g.fillRect(0, 0, env.w, env.h);
        g.imageSmoothingEnabled = true;
        g.drawImage(oc, 0, 0, env.w, env.h);
      },
      down(p) {
        const gx = gridX(p), gy = gridY(p);
        splash(gx, gy, -2.6, 2.6);          // stone: sharp, deep
        last = { x: gx, y: gy };
        rain = 2.5;
      },
      move(p) {
        const gx = gridX(p), gy = gridY(p);
        if (p.held) {
          graze = null;
          if (!last) last = { x: gx, y: gy };
          const dx = gx - last.x, dy = gy - last.y;
          const n = Math.min(40, Math.ceil(Math.hypot(dx, dy) / 1.2));
          for (let k = 1; k <= n; k++) {
            splash(last.x + dx * k / n, last.y + dy * k / n, -0.55, 1.7);
          }
          last = { x: gx, y: gy };
          rain = 2.5;
        } else if (!graze) {
          graze = { x: gx, y: gy };
        } else if (Math.hypot(gx - graze.x, gy - graze.y) > 2.2) {
          splash(gx, gy, -0.16, 1.3);       // a fingertip barely brushing it
          graze = { x: gx, y: gy };
        }
      },
      up() { last = null; },
      dbl(p) { splash(gridX(p), gridY(p), -5, 4.5); }, // heave a boulder in
      leave() { last = null; graze = null; },
    };
  },
});
