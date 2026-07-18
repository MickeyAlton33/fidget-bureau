/* № 37 — Flag. A cloth banner on a pole: a 12×8 Verlet spring-mesh pinned
   along the hoist and flown in a soft procedural breeze. Waves roll from the
   pole out to the fly and settle; grab any point and the whole sheet follows
   elastically, then swings back and wobbles to rest. Shaded by the local
   surface slope so the folds read three-dimensional. */
F.register({
  n: 37, id: 'cloth-flag', cat: 'matter',
  title: 'Flag', hint: 'Drag the cloth — it ripples and settles',
  make(env) {
    const { g, inks, bg } = env;
    const COLS = 12, ROWS = 8, NODES = COLS * ROWS;
    const SIM_DT = 1 / 60, MAX_SUB = 2, ITER = 2;
    const DAMP = 0.985;
    const WIND = 9000;   // z-flutter drive (calibrated below)
    const WINDX = 300;   // steady breeze that holds the fly extended
    const GRAV = 150;    // gentle downward sag

    // Verlet state — allocated ONCE.
    const px = new Float32Array(NODES), py = new Float32Array(NODES), pz = new Float32Array(NODES);
    const ox = new Float32Array(NODES), oy = new Float32Array(NODES), oz = new Float32Array(NODES);
    const rx = new Float32Array(NODES), ry = new Float32Array(NODES); // rest (flat) grid
    const pin = new Uint8Array(NODES);                                // hoist column = 1
    const ph = new Float32Array(NODES);                               // per-node phase jitter
    const sx = new Float32Array(NODES), sy = new Float32Array(NODES); // projected screen coords
    for (let k = 0; k < NODES; k++) ph[k] = Math.random() * 6.2832;

    // geometry (rebuilt in layout / resize)
    let poleX = 0, flagTop = 0, flagH = 1, cw = 1, ch = 1, diag = 1, ZMAX = 1;
    let curW = Math.max(1, env.w), curH = Math.max(1, env.h);
    let XMIN = 0, XMAX = 0, YMIN = 0, YMAX = 0;

    let clock = 0, acc = 0;
    let grab = -1, gx = 0, gy = 0; // grabbed node index + eased pointer target

    // fixed light, pre-normalized, from upper-left-front
    const LX = -0.360, LY = -0.566, LZ = 0.741;
    const SKX = 0.42, SKY = 0.62; // z → screen skew, so billows show in silhouette

    const hx = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const BASE = hx(inks[1]);  // coral cloth
    const CREAM = hx(inks[5]);
    const GND = hx(bg);
    const foldR = BASE[0] + 0.66 * (GND[0] - BASE[0]);
    const foldG = BASE[1] + 0.66 * (GND[1] - BASE[1]);
    const foldB = BASE[2] + 0.66 * (GND[2] - BASE[2]);
    const hiR = BASE[0] + 0.72 * (CREAM[0] - BASE[0]);
    const hiG = BASE[1] + 0.72 * (CREAM[1] - BASE[1]);
    const hiB = BASE[2] + 0.72 * (CREAM[2] - BASE[2]);
    const poleCol = `rgb(${CREAM[0]},${CREAM[1]},${CREAM[2]})`;

    function bounds() {
      curW = Math.max(1, env.w); curH = Math.max(1, env.h);
      XMIN = -curW; XMAX = 2 * curW; YMIN = -curH; YMAX = 2 * curH;
    }
    const clX = v => (v < XMIN ? XMIN : v > XMAX ? XMAX : v);
    const clY = v => (v < YMIN ? YMIN : v > YMAX ? YMAX : v);

    function sat(a, b, rest) {
      const dx = px[b] - px[a], dy = py[b] - py[a], dz = pz[b] - pz[a];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
      const wa = pin[a] ? 0 : 1, wb = pin[b] ? 0 : 1, ws = wa + wb;
      if (ws === 0) return;
      const corr = (d - rest) / d;
      const ca = corr * wa / ws, cb = corr * wb / ws;
      px[a] += dx * ca; py[a] += dy * ca; pz[a] += dz * ca;
      px[b] -= dx * cb; py[b] -= dy * cb; pz[b] -= dz * cb;
    }

    function step(h) {
      const h2 = h * h;
      clock += h;
      const VMAX = Math.max(cw, ch) * 0.85;
      const gust = 0.7 + 0.32 * Math.sin(clock * 0.5) + 0.16 * Math.sin(clock * 0.23 + 1.3);
      const amp = WIND * (gust > 0.2 ? gust : 0.2);
      for (let idx = 0; idx < NODES; idx++) {
        if (pin[idx]) continue;
        const i = idx % COLS, j = (idx / COLS) | 0;
        const fall = i / (COLS - 1), f2 = fall * fall, q = ph[idx];
        const wz = amp * f2 * (Math.sin(clock * 2.2 - i * 0.9 + j * 0.55 + q)
          + 0.55 * Math.sin(clock * 1.4 - i * 1.7 - j * 0.35 + q * 0.5 + 1.7));
        const wx = WINDX * fall + amp * 0.05 * f2 * Math.sin(clock * 1.7 - i * 0.6 + j * 0.9 + q);
        let vx = (px[idx] - ox[idx]) * DAMP;
        let vy = (py[idx] - oy[idx]) * DAMP;
        let vz = (pz[idx] - oz[idx]) * DAMP;
        if (vx > VMAX) vx = VMAX; else if (vx < -VMAX) vx = -VMAX;
        if (vy > VMAX) vy = VMAX; else if (vy < -VMAX) vy = -VMAX;
        if (vz > VMAX) vz = VMAX; else if (vz < -VMAX) vz = -VMAX;
        ox[idx] = px[idx]; oy[idx] = py[idx]; oz[idx] = pz[idx];
        px[idx] += vx + wx * h2;
        py[idx] += vy + GRAV * h2;
        pz[idx] += vz + wz * h2;
      }
      for (let it = 0; it < ITER; it++) {
        for (let j = 0; j < ROWS; j++) { const r = j * COLS; for (let i = 0; i < COLS - 1; i++) sat(r + i, r + i + 1, cw); }
        for (let j = 0; j < ROWS - 1; j++) { const r = j * COLS; for (let i = 0; i < COLS; i++) sat(r + i, r + COLS + i, ch); }
        for (let j = 0; j < ROWS - 1; j++) {
          const r = j * COLS;
          for (let i = 0; i < COLS - 1; i++) { sat(r + i, r + COLS + i + 1, diag); sat(r + i + 1, r + COLS + i, diag); }
        }
      }
      // hoist column stays welded to the pole
      for (let j = 0; j < ROWS; j++) {
        const idx = j * COLS;
        px[idx] = rx[idx]; py[idx] = ry[idx]; pz[idx] = 0;
        ox[idx] = rx[idx]; oy[idx] = ry[idx]; oz[idx] = 0;
      }
      // grabbed node chases the pointer, kept authoritative after the solve
      if (grab >= 0) {
        px[grab] += (gx - px[grab]) * 0.5;
        py[grab] += (gy - py[grab]) * 0.5;
      }
      // clamp — the sim must never explode or leave a NaN in a coordinate
      for (let idx = 0; idx < NODES; idx++) {
        if (pin[idx]) continue;
        let bad = false;
        let x = px[idx]; if (x !== x) { x = rx[idx]; bad = true; } else if (x < XMIN) x = XMIN; else if (x > XMAX) x = XMAX;
        let y = py[idx]; if (y !== y) { y = ry[idx]; bad = true; } else if (y < YMIN) y = YMIN; else if (y > YMAX) y = YMAX;
        let z = pz[idx]; if (z !== z) { z = 0; bad = true; } else if (z < -ZMAX) z = -ZMAX; else if (z > ZMAX) z = ZMAX;
        px[idx] = x; py[idx] = y; pz[idx] = z;
        if (bad) { ox[idx] = x; oy[idx] = y; oz[idx] = z; }
      }
    }

    function layout() {
      bounds();
      const w = curW, h = curH;
      poleX = Math.max(8, w * 0.17);
      const flagW = Math.max(20, w * 0.66);
      flagH = Math.max(16, h * 0.46);
      flagTop = h * 0.20;
      cw = flagW / (COLS - 1);
      ch = flagH / (ROWS - 1);
      diag = Math.hypot(cw, ch);
      ZMAX = Math.max(cw, ch) * 1.35;
      for (let j = 0; j < ROWS; j++) {
        for (let i = 0; i < COLS; i++) {
          const idx = j * COLS + i;
          const X = poleX + i * cw, Y = flagTop + j * ch;
          rx[idx] = X; ry[idx] = Y;
          px[idx] = X; py[idx] = Y; pz[idx] = 0;
          ox[idx] = X; oy[idx] = Y; oz[idx] = 0;
          pin[idx] = i === 0 ? 1 : 0;
        }
      }
      grab = -1;
      // warm the breeze so the flag is already flying on first sight
      for (let k = 0; k < 55; k++) step(SIM_DT);
    }

    function nearest(p) {
      let best = -1, bd = Infinity;
      for (let idx = 0; idx < NODES; idx++) {
        if (pin[idx]) continue;
        const dx = px[idx] - p.x, dy = py[idx] - p.y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = idx; }
      }
      return best;
    }

    layout();

    return {
      draw(t, dt) {
        bounds();
        acc += dt; if (acc > SIM_DT * MAX_SUB) acc = SIM_DT * MAX_SUB;
        while (acc >= SIM_DT) { step(SIM_DT); acc -= SIM_DT; }

        for (let idx = 0; idx < NODES; idx++) {
          sx[idx] = px[idx] + pz[idx] * SKX;
          sy[idx] = py[idx] - pz[idx] * SKY;
        }

        const w = curW, h = curH;
        g.fillStyle = bg; g.fillRect(0, 0, w, h);

        // pole behind the cloth
        const pw = Math.max(4, w * 0.02);
        g.strokeStyle = poleCol; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = pw;
        g.beginPath();
        g.moveTo(poleX, flagTop - h * 0.07);
        g.lineTo(poleX, flagTop + flagH + h * 0.13);
        g.stroke();
        g.fillStyle = poleCol;
        g.beginPath(); g.arc(poleX, flagTop - h * 0.07, pw * 1.05, 0, 6.2832); g.fill();

        // shaded cloth quads
        for (let j = 0; j < ROWS - 1; j++) {
          for (let i = 0; i < COLS - 1; i++) {
            const a = j * COLS + i, b = a + 1, c = a + COLS, d = c + 1;
            const e1x = px[b] - px[a], e1y = py[b] - py[a], e1z = pz[b] - pz[a];
            const e2x = px[c] - px[a], e2y = py[c] - py[a], e2z = pz[c] - pz[a];
            const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
            const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) + 1e-6;
            const dot = (nx * LX + ny * LY + nz * LZ) / nl;
            let s = 0.5 + (dot - 0.741) * 1.6; if (s < 0) s = 0; else if (s > 1) s = 1;
            let R, G, B;
            if (s < 0.5) { const u = s * 2; R = foldR + (BASE[0] - foldR) * u; G = foldG + (BASE[1] - foldG) * u; B = foldB + (BASE[2] - foldB) * u; }
            else { const u = (s - 0.5) * 2; R = BASE[0] + (hiR - BASE[0]) * u; G = BASE[1] + (hiG - BASE[1]) * u; B = BASE[2] + (hiB - BASE[2]) * u; }
            const col = `rgb(${R | 0},${G | 0},${B | 0})`;
            g.beginPath();
            g.moveTo(sx[a], sy[a]); g.lineTo(sx[b], sy[b]); g.lineTo(sx[d], sy[d]); g.lineTo(sx[c], sy[c]);
            g.closePath();
            g.fillStyle = col; g.fill();
            g.strokeStyle = col; g.lineWidth = 1.2; g.stroke(); // hide AA seams
          }
        }

        // faint cream hem to lift the cloth off the ground
        g.strokeStyle = `rgba(${CREAM[0]},${CREAM[1]},${CREAM[2]},0.18)`;
        g.lineWidth = 1.8;
        g.beginPath();
        for (let i = 0; i < COLS; i++) { const idx = i; if (i === 0) g.moveTo(sx[idx], sy[idx]); else g.lineTo(sx[idx], sy[idx]); }
        for (let j = 1; j < ROWS; j++) { const idx = j * COLS + (COLS - 1); g.lineTo(sx[idx], sy[idx]); }
        for (let i = COLS - 2; i >= 0; i--) { const idx = (ROWS - 1) * COLS + i; g.lineTo(sx[idx], sy[idx]); }
        for (let j = ROWS - 2; j >= 1; j--) { const idx = j * COLS; g.lineTo(sx[idx], sy[idx]); }
        g.closePath(); g.stroke();

        // grabbed-node affordance
        if (grab >= 0) {
          g.strokeStyle = poleCol; g.globalAlpha = 0.5; g.lineWidth = 2;
          g.beginPath(); g.arc(sx[grab], sy[grab], Math.max(cw, ch) * 0.5, 0, 6.2832); g.stroke();
          g.globalAlpha = 1;
        }
      },
      down(p) { grab = nearest(p); gx = clX(p.x); gy = clY(p.y); },
      move(p) { if (grab >= 0 && p.held) { gx = clX(p.x); gy = clY(p.y); } },
      up() { grab = -1; },
      leave() { grab = -1; },
      resize() { layout(); },
    };
  },
});
