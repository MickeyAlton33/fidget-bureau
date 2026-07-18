/* № 18 — Letter dust. The word FIDGET rendered as a dot-matrix of
   spring-loaded dust motes. Sweep the pointer through to blast it apart —
   every mote wobbles back home with overshoot. Scroll to flip the magnet:
   attract mode smears the letters into orbit around the cursor.
   Double-click for a full scatter. */
F.register({
  n: 18, id: 'letter-dust', cat: 'optics',
  title: 'Letter dust', hint: 'Sweep through the word — scroll to flip the magnet',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    // 5x7 glyphs for F I D G E T — bit 4 is the leftmost column
    const GLYPHS = [
      [31, 16, 16, 30, 16, 16, 16],  // F
      [31, 4, 4, 4, 4, 4, 31],       // I
      [30, 17, 17, 17, 17, 17, 30],  // D
      [15, 16, 16, 19, 17, 17, 14],  // G
      [31, 16, 16, 30, 16, 16, 31],  // E
      [31, 4, 4, 4, 4, 4, 4],        // T
    ];
    const GAP = 1.6, COLS = 6 * 5 + 5 * GAP;
    let N = 0;                       // two motes per lit cell -> 186
    for (const rows of GLYPHS) for (const r of rows)
      for (let c = 0; c < 5; c++) if (r & (16 >> c)) N += 2;
    const px = new Float32Array(N), py = new Float32Array(N);
    const vx = new Float32Array(N), vy = new Float32Array(N);
    const hx = new Float32Array(N), hy = new Float32Array(N);
    const ph = new Float32Array(N);  // personal breeze phase
    const start = [];                // first mote index per letter
    const hasRR = typeof g.roundRect === 'function';
    let sc = 1, dot = 3;
    let pol = 1, polT = 1;           // +1 repel, -1 attract (eased)
    const ptr = { x: 0, y: 0, on: false, held: false };
    let hopT = 0.8;

    function layout() {
      sc = Math.min(env.w, env.h) / 320;
      const u = (0.8 * env.w) / COLS;              // word fills 80% of width
      dot = Math.max(2.2, Math.min(3.6, u * 0.48));
      const x0 = (env.w - COLS * u) / 2, y0 = env.h / 2 - 3.5 * u;
      start.length = 0;
      let i = 0;
      for (let L = 0; L < 6; L++) {
        start.push(i);
        const rows = GLYPHS[L], lx = x0 + L * (5 + GAP) * u;
        for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
          if (!(rows[r] & (16 >> c))) continue;
          const cx = lx + (c + 0.5) * u, cy = y0 + (r + 0.5) * u;
          hx[i] = cx; hy[i] = cy - 0.24 * u; i++;
          hx[i] = cx; hy[i] = cy + 0.24 * u; i++;
        }
      }
      start.push(i);
    }
    layout();
    // birth: dust scattered across the card, springs assemble the word
    for (let i = 0; i < N; i++) {
      px[i] = Math.random() * env.w; py[i] = Math.random() * env.h;
      vx[i] = (Math.random() - 0.5) * 120; vy[i] = (Math.random() - 0.5) * 120;
      ph[i] = Math.random() * TAU;
    }

    return {
      draw(t, dt) {
        pol += (polT - pol) * (1 - Math.pow(0.0005, dt)); // smooth flip
        const K = 90, damp = Math.pow(0.88, dt * 60);
        const s2 = sc * sc;
        const S = (ptr.held ? 10.5e6 : 6e6) * s2;   // magnet strength
        const SOFT = 380 * s2;                       // soft-cap core
        const swirl = 0.65 * Math.max(0, -pol);      // orbit in attract mode
        const bAmp = 1.7 * sc, vmax = 1500 * sc;
        for (let i = 0; i < N; i++) {
          // breeze: soft wave traveling along the word
          const br = Math.sin(t * 2.1 - hx[i] * 0.055 + ph[i] * 0.35);
          vx[i] += (hx[i] + br * bAmp * 0.4 - px[i]) * K * dt;
          vy[i] += (hy[i] + br * bAmp - py[i]) * K * dt;
          if (ptr.on) {
            const dx = px[i] - ptr.x, dy = py[i] - ptr.y;
            const d2 = dx * dx + dy * dy, d = Math.sqrt(d2) + 1e-6;
            const fm = S / (d2 + SOFT);              // inverse-square, capped
            vx[i] += ((pol * dx - swirl * dy) / d) * fm * dt;
            vy[i] += ((pol * dy + swirl * dx) / d) * fm * dt;
          }
          vx[i] *= damp; vy[i] *= damp;
          const v2 = vx[i] * vx[i] + vy[i] * vy[i];
          if (v2 > vmax * vmax) {
            const k = vmax / Math.sqrt(v2); vx[i] *= k; vy[i] *= k;
          }
          px[i] += vx[i] * dt; py[i] += vy[i] * dt;
        }
        // idle life: an occasional mote does a tiny hop
        hopT -= dt;
        if (hopT <= 0) {
          const i = (Math.random() * N) | 0;
          vy[i] -= (60 + Math.random() * 70) * sc;
          vx[i] += (Math.random() - 0.5) * 50 * sc;
          hopT = 0.5 + Math.random() * 1.4;
        }
        g.fillStyle = bg;
        g.fillRect(0, 0, env.w, env.h);
        for (let L = 0; L < 6; L++) {                // one ink per letter
          g.fillStyle = inks[L];
          g.beginPath();
          for (let i = start[L]; i < start[L + 1]; i++) {
            const sp = Math.min(1, (vx[i] * vx[i] + vy[i] * vy[i]) / (90000 * s2));
            const s = dot * (1 + sp * 0.9);          // fast dust swells
            if (hasRR) g.roundRect(px[i] - s / 2, py[i] - s / 2, s, s, s * 0.36);
            else g.rect(px[i] - s / 2, py[i] - s / 2, s, s);
          }
          g.fill();
        }
        if (ptr.on) {                                // magnet cursor: rings
          g.strokeStyle = inks[5];                   // travel out (repel)
          g.lineWidth = ptr.held ? 2.5 : 2;          // or in (attract)
          const rep = pol >= 0;
          for (let k = 0; k < 2; k++) {
            const q = (t * 1.4 + k * 0.5) % 1;
            const e = rep ? q : 1 - q;
            g.globalAlpha = 0.3 * (1 - e * 0.75) * Math.min(1, Math.abs(pol) + 0.3);
            g.beginPath();
            g.arc(ptr.x, ptr.y, (5 + 21 * e) * sc, 0, TAU);
            g.stroke();
          }
          g.globalAlpha = 1;
        }
      },
      down(p) { ptr.x = p.x; ptr.y = p.y; ptr.on = true; ptr.held = true; },
      move(p) { ptr.x = p.x; ptr.y = p.y; ptr.on = true; ptr.held = p.held; },
      up(p) { ptr.held = false; if (p) { ptr.x = p.x; ptr.y = p.y; } },
      leave() { ptr.on = false; ptr.held = false; },
      wheel(dy) { polT = dy > 0 ? -1 : 1; },
      dbl(p) {                                       // full scatter pop
        for (let i = 0; i < N; i++) {
          const dx = px[i] - p.x, dy = py[i] - p.y;
          const d = Math.hypot(dx, dy) + 1e-6;
          const imp = (26000 * sc) / (d + 40 * sc);
          vx[i] += (dx / d) * imp; vy[i] += (dy / d) * imp;
        }
      },
      resize() { layout(); },
    };
  },
});
