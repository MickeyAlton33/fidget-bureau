/* № 07 — Sand spout. A falling-sand automaton: an idle spout trickles banded
   sediment into dunes; hold to pour your own strata, sweep fast to carve
   channels and watch the piles collapse and re-flow. */
F.register({
  n: 7, id: 'sand-spout', cat: 'matter',
  title: 'Sand spout', hint: 'Hold to pour sand — sweep fast to carve the dunes',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const N = 100, NN = N * N;
    const cells = new Uint8Array(NN);      // 0 empty, 1..5 = ink index + 1
    const spark = new Uint8Array(NN);      // fixed dither mask: darker grains
    for (let i = 0; i < NN; i++) spark[i] = Math.random() < 0.35 ? 1 : 0;
    // one reused 100×100 ImageData, upscaled crisp via an offscreen canvas
    const scan = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(N, N) : null;
    const sg = scan ? scan.getContext('2d') : null;
    const img = (sg || g).createImageData(N, N);
    const pix = new Uint32Array(img.data.buffer);
    // packed ABGR palette per ink: bright grain + a darker sparkle twin
    const palA = new Uint32Array(6), palB = new Uint32Array(6);
    for (let k = 0; k < 5; k++) {
      const r = parseInt(inks[k].slice(1, 3), 16);
      const gr = parseInt(inks[k].slice(3, 5), 16);
      const b = parseInt(inks[k].slice(5, 7), 16);
      palA[k + 1] = (0xFF000000 | (b << 16) | (gr << 8) | r) >>> 0;
      palB[k + 1] = (0xFF000000 | ((b * 0.72 | 0) << 16) | ((gr * 0.72 | 0) << 8) | (r * 0.72 | 0)) >>> 0;
    }
    const CAP = (0.55 * NN) | 0;
    let count = 0;
    // starter dune with visible strata so the card reads "sand" at first paint
    for (let x = 0; x < N; x++) {
      const hgt = Math.round(20 * Math.exp(-((x - N / 2) * (x - N / 2)) / 500));
      for (let y = N - hgt; y < N; y++) {
        cells[y * N + x] = 1 + (Math.floor((N - 1 - y) / 5) % 5);
        count++;
      }
    }
    let px = 160, py = 60, lx = 160, ly = 60;
    let held = false, hover = false, spd = 0, acc = 0, fc = 0;
    let mode = 0, curInk = 1;              // mode: 0 pour, 1 carve

    function put(cx, cy, v) {
      if (cx < 0 || cx >= N || cy < 0 || cy >= N) return;
      const i = cy * N + cx;
      if (!cells[i]) { cells[i] = v; count++; }
    }
    function pinch(cx, cy, n, v) {
      for (let k = 0; k < n; k++)
        put(cx + ((Math.random() * 5) | 0) - 2, cy + ((Math.random() * 3) | 0) - 1, v);
    }
    function clearDisc(cx, cy, r) {
      for (let dy = -r; dy <= r; dy++) {
        const y = cy + dy;
        if (y < 0 || y >= N) continue;
        const span = Math.floor(Math.sqrt(r * r - dy * dy));
        for (let dx = -span; dx <= span; dx++) {
          const x = cx + dx;
          if (x < 0 || x >= N) continue;
          const i = y * N + x;
          if (cells[i]) { cells[i] = 0; count--; }
        }
      }
    }
    function step(flip) {                  // bottom-up: each grain moves once
      for (let y = N - 2; y >= 0; y--) {
        const row = y * N, below = row + N;
        for (let k = 0; k < N; k++) {
          const x = flip ? N - 1 - k : k;
          const i = row + x, v = cells[i];
          if (!v) continue;
          if (!cells[below + x]) { cells[below + x] = v; cells[i] = 0; continue; }
          const bl = x > 0 && !cells[below + x - 1] && !cells[i - 1];
          const br = x < N - 1 && !cells[below + x + 1] && !cells[i + 1];
          if (!bl && !br) continue;        // buried grains settle for free
          const d = bl && br ? (Math.random() < 0.5 ? -1 : 1) : (bl ? -1 : 1);
          cells[below + x + d] = v; cells[i] = 0;
        }
      }
      if (count > CAP) {                   // over-full: the floor seeps away
        const bot = (N - 1) * N;
        for (let x = 0; x < N; x++)
          if (cells[bot + x] && Math.random() < 0.3) { cells[bot + x] = 0; count--; }
      }
    }

    return {
      draw(t, dt) {
        curInk = 1 + (Math.floor(t / 3) % 5);          // sediment band, ~3 s each
        const cw = env.w / N, ch = env.h / N;
        const raw = Math.hypot(px - lx, py - ly) / Math.max(dt, 1e-3);
        spd += (Math.min(raw, 4000) - spd) * 0.4;      // smoothed px/s
        mode = held && spd > (mode === 1 ? 110 : 170) ? 1 : 0;
        if (held) {
          if (mode === 1) {                // carve discs all along the sweep
            const ax = lx / cw, ay = ly / ch, bx = px / cw, by = py / ch;
            const steps = Math.min(48, Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 2)));
            for (let s = 0; s <= steps; s++) {
              clearDisc(Math.round(ax + (bx - ax) * s / steps),
                        Math.round(ay + (by - ay) * s / steps), 4);
            }
          } else {                         // pour a steady stream at the pointer
            const cx = Math.max(0, Math.min(N - 1, Math.round(px / cw)));
            const cy = Math.max(0, Math.min(N - 1, Math.round(py / ch)));
            pinch(cx, cy, 3 + (Math.random() < 0.5 ? 1 : 0), curInk);
          }
        } else {                           // idle: thin trickle, slow sway
          const sx = Math.round(N / 2 + Math.sin(t * 0.35) * 6);
          put(sx + ((Math.random() * 3) | 0) - 1, 0, curInk);
          if (Math.random() < 0.4) put(sx + ((Math.random() * 3) | 0) - 1, 1, curInk);
        }
        acc = Math.min(acc + dt * 120, 3);
        while (acc >= 1) { acc -= 1; step((fc++) & 1); }
        // render: 1 cell = 1 texel, nearest-neighbour upscale for chunky grains
        for (let i = 0; i < NN; i++) pix[i] = spark[i] ? palB[cells[i]] : palA[cells[i]];
        g.fillStyle = bg;
        g.fillRect(0, 0, env.w, env.h);
        if (sg) {
          sg.putImageData(img, 0, 0);
          g.imageSmoothingEnabled = false;
          g.drawImage(scan, 0, 0, N, N, 0, 0, env.w, env.h);
        }
        // the spout: a cream hopper riding its sway, lip in the ink it pours
        const sxp = (N / 2 + Math.sin(t * 0.35) * 6) * cw;
        g.lineCap = g.lineJoin = 'round';
        g.strokeStyle = inks[5];
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(sxp - 13, -3); g.lineTo(sxp - 4.5, 8);
        g.moveTo(sxp + 13, -3); g.lineTo(sxp + 4.5, 8);
        g.stroke();
        g.strokeStyle = inks[curInk - 1];
        g.beginPath(); g.moveTo(sxp - 4.5, 8); g.lineTo(sxp + 4.5, 8); g.stroke();
        if (held || hover) {               // cursor: carve blade or pour nozzle
          g.beginPath();
          if (mode === 1) {
            g.strokeStyle = inks[5]; g.lineWidth = 2.5; g.globalAlpha = 0.8;
            g.arc(px, py, 4.5 * cw, 0, TAU);
          } else {
            g.strokeStyle = inks[curInk - 1]; g.lineWidth = 2;
            g.globalAlpha = held ? 0.9 : 0.3;
            g.arc(px, py, held ? 7 : 10, 0, TAU);
          }
          g.stroke();
          g.globalAlpha = 1;
        }
        lx = px; ly = py;
      },
      down(p) {
        px = lx = p.x; py = ly = p.y;
        held = true; spd = 0; mode = 0;
        const cx = Math.max(0, Math.min(N - 1, Math.round(p.x / (env.w / N))));
        const cy = Math.max(0, Math.min(N - 1, Math.round(p.y / (env.h / N))));
        pinch(cx, cy, 8, curInk);          // instant answering puff of sand
      },
      move(p) { px = p.x; py = p.y; held = held && p.held; hover = true; },
      up() { held = false; },
      leave() { held = false; hover = false; },
    };
  },
});
