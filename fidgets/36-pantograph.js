/* № 36 — Pantograph. The hinged parallelogram arm that copies a drawing at a
   larger scale. A fixed anchor pivot, a sky stylus you drag, and a mint pen
   carried on the linkage that always traces pen = anchor + 1.7·(stylus − anchor):
   collinear with the anchor, 1.7× as far out. The stylus rides at fraction 1/1.7
   along one bar and the pen rides the opposite bar extended, so the parallelogram
   flexes as a rigid four-bar. Left alone the stylus glides a slow looping path and
   the pen keeps drawing; grab it and the big copy mirrors your small hand motion. */
F.register({
  n: 36, id: 'pantograph', cat: 'mech',
  title: 'Pantograph', hint: 'Drag the stylus — the arm copies it',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const CREAM = inks[5], AMBER = inks[0], MINT = inks[2], SKY = inks[3];

    // --- mechanism, in linkage units relative to the anchor O (the unit origin) ---
    const RATIO = 1.7;            // pen enlargement: P = O + RATIO·(S − O)
    const TT = 1 / RATIO;         // stylus sits at fraction TT along bar U→X
    const LP = 1.0, LQ = 1.0;     // parallelogram side lengths (a rhombus)
    const LA = LP, LB = TT * LQ;  // the two link lengths of the arm reaching the stylus
    const RMIN = Math.abs(LA - LB) + 0.09;  // clamp the stylus reach safely inside the
    const RMAX = (LA + LB) - 0.09;          // fully-folded / straight singular poses
    const BRANCH = 1;             // fixed elbow branch — the arm never flips over

    // stylus spring state (unit space) and its looping idle path
    let sx, sy, svx = 0, svy = 0;
    const CPHI = -0.85, CD = 1.0;                    // idle centre: up-and-right of O
    const cx0 = CD * Math.cos(CPHI), cy0 = CD * Math.sin(CPHI);
    sx = cx0 + 0.40; sy = cy0;                        // seed on the path: frame one is alive
    let tgx = sx, tgy = sy;                           // spring target (unit space)
    let dragging = false, offx = 0, offy = 0;         // grab offset in screen px

    // --- capped trace ring buffers, allocated ONCE (stylus faint, pen bold) ---
    const CAP = 240;
    const styBuf = new Float64Array(CAP * 2);
    const penBuf = new Float64Array(CAP * 2);
    let head = 0, count = 0;
    function pushTrace(ax, ay, bx, by) {
      const i = head * 2;
      styBuf[i] = ax; styBuf[i + 1] = ay;
      penBuf[i] = bx; penBuf[i + 1] = by;
      head = (head + 1) % CAP;
      if (count < CAP) count++;
    }

    // solved joints (unit space), recomputed each frame
    let Ux = 0, Uy = 0, Vx = 0, Vy = 0, Xx = 0, Xy = 0, Px = 0, Py = 0;
    function solve() {
      // keep the stylus in the reachable annulus so the four-bar can never invert
      let d = Math.hypot(sx, sy) + 1e-6;
      if (d < RMIN) { const k = RMIN / d; sx *= k; sy *= k; d = RMIN; }
      else if (d > RMAX) { const k = RMAX / d; sx *= k; sy *= k; d = RMAX; }
      // elbow U = circle(O, LA) ∩ circle(S, LB), one fixed branch
      const A = (LA * LA - LB * LB + d * d) / (2 * d);
      const H = Math.sqrt(Math.max(0, LA * LA - A * A));
      const nx = sx / d, ny = sy / d;                 // unit O→S
      Ux = A * nx - BRANCH * H * ny;
      Uy = A * ny + BRANCH * H * nx;
      // close the parallelogram: q = (S − U)/TT, then X = U + q and V = O + q
      const qx = (sx - Ux) / TT, qy = (sy - Uy) / TT;
      Vx = qx; Vy = qy;
      Xx = Ux + qx; Xy = Uy + qy;
      // the pen is the guaranteed-collinear enlargement of the stylus
      Px = RATIO * sx; Py = RATIO * sy;
    }

    // screen mapping, refreshed each frame from live env.w/env.h (rescales on resize)
    let Ox = 0, Oy = 0, sc = 1;
    function frame() {
      const w = env.w, h = env.h, m = Math.max(1, Math.min(w, h));
      sc = 0.30 * m;
      Ox = 0.29 * w; Oy = 0.72 * h;
    }
    function SX(u) { return Ox + u * sc; }
    function SY(u) { return Oy + u * sc; }

    function drawTrail(buf, col, wMax, aMax) {
      if (count < 2) return;
      g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
      const BANDS = 10, last = count - 1;
      for (let b = 0; b < BANDS; b++) {              // banded so the tail fades toward the tip
        const k0 = Math.floor(b * last / BANDS);
        const k1 = Math.floor((b + 1) * last / BANDS);
        if (k1 <= k0) continue;
        const f = (b + 1) / BANDS;
        g.globalAlpha = aMax * f * f;
        g.lineWidth = wMax * (0.35 + 0.65 * f);
        g.beginPath();
        for (let k = k0; k <= k1; k++) {
          const idx = ((head - count + k) % CAP + CAP) % CAP;
          const X = SX(buf[idx * 2]), Y = SY(buf[idx * 2 + 1]);
          if (k === k0) g.moveTo(X, Y); else g.lineTo(X, Y);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    function pivot(ux, uy, r) {                       // amber pin with a dark seat
      const X = SX(ux), Y = SY(uy);
      g.fillStyle = bg; g.beginPath(); g.arc(X, Y, r + 1.5, 0, TAU); g.fill();
      g.fillStyle = AMBER; g.beginPath(); g.arc(X, Y, r, 0, TAU); g.fill();
    }

    function setTarget(p) {                           // screen pointer → clamped unit target
      frame();
      let ux = (p.x + offx - Ox) / sc, uy = (p.y + offy - Oy) / sc;
      const d = Math.hypot(ux, uy) + 1e-6;
      if (d < RMIN) { const k = RMIN / d; ux *= k; uy *= k; }
      else if (d > RMAX) { const k = RMAX / d; ux *= k; uy *= k; }
      tgx = ux; tgy = uy;
    }

    return {
      draw(t, dt) {
        frame();
        const w = env.w, h = env.h;

        // target: the slow looping idle path, or the dragged pointer
        if (!dragging) {
          const th = 0.50 * t, rot = 0.12 * t;
          const ex = 0.40 * Math.cos(th), ey = 0.30 * Math.sin(th);
          const cr = Math.cos(rot), sr = Math.sin(rot);   // precess the ellipse into a rosette
          tgx = cx0 + (ex * cr - ey * sr);
          tgy = cy0 + (ex * sr + ey * cr);
        }
        // spring the stylus toward the target — slightly underdamped for mechanical lag
        const K = 80, C = 10.7;                            // C ≈ 2·√K·0.6
        svx += (K * (tgx - sx) - C * svx) * dt;
        svy += (K * (tgy - sy) - C * svy) * dt;
        const vm = Math.hypot(svx, svy);
        if (vm > 26) { const s = 26 / vm; svx *= s; svy *= s; }
        sx += svx * dt; sy += svy * dt;

        solve();
        pushTrace(sx, sy, Px, Py);

        // --- paint: whole card from bg, then traces, then the linkage on top ---
        g.fillStyle = bg; g.fillRect(0, 0, w, h);

        drawTrail(styBuf, SKY, Math.max(1.3, sc * 0.022), 0.34);   // faint small original
        drawTrail(penBuf, MINT, Math.max(2.4, sc * 0.038), 0.9);   // bold enlarged copy

        // rods: the parallelogram O-U-X-V plus the V-X bar extended through X to the pen
        const rod = Math.max(3, sc * 0.05);
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.strokeStyle = CREAM; g.lineWidth = rod;
        g.beginPath();
        g.moveTo(SX(0), SY(0));
        g.lineTo(SX(Ux), SY(Uy));
        g.lineTo(SX(Xx), SY(Xy));
        g.lineTo(SX(Vx), SY(Vy));
        g.closePath();
        g.moveTo(SX(Xx), SY(Xy));
        g.lineTo(SX(Px), SY(Py));
        g.stroke();

        const pr = Math.max(2.5, sc * 0.038);
        pivot(Ux, Uy, pr); pivot(Vx, Vy, pr); pivot(Xx, Xy, pr);

        // pen tip (mint) — the drawing point, with a soft glow
        const penX = SX(Px), penY = SY(Py);
        g.globalAlpha = 0.18; g.fillStyle = MINT;
        g.beginPath(); g.arc(penX, penY, pr * 3.2, 0, TAU); g.fill();
        g.globalAlpha = 1;
        g.fillStyle = bg; g.beginPath(); g.arc(penX, penY, pr * 1.7 + 1.5, 0, TAU); g.fill();
        g.fillStyle = MINT; g.beginPath(); g.arc(penX, penY, pr * 1.7, 0, TAU); g.fill();

        // stylus handle (sky) — the grab affordance; pulses at idle, flares while held
        const stX = SX(sx), stY = SY(sy);
        if (!dragging) {
          const pulse = pr * (2.1 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.4)));
          g.globalAlpha = 0.28; g.strokeStyle = SKY;
          g.lineWidth = Math.max(1.5, sc * 0.02);
          g.beginPath(); g.arc(stX, stY, pulse, 0, TAU); g.stroke();
          g.globalAlpha = 1;
        } else {
          g.globalAlpha = 0.5; g.fillStyle = SKY;
          g.beginPath(); g.arc(stX, stY, pr * 3, 0, TAU); g.fill();
          g.globalAlpha = 1;
        }
        g.fillStyle = bg; g.beginPath(); g.arc(stX, stY, pr * 1.6 + 1.5, 0, TAU); g.fill();
        g.strokeStyle = SKY; g.lineWidth = Math.max(2, sc * 0.03);
        g.beginPath(); g.arc(stX, stY, pr * 1.6, 0, TAU); g.stroke();
        g.fillStyle = SKY; g.beginPath(); g.arc(stX, stY, pr * 0.7, 0, TAU); g.fill();

        // anchor (fixed): a hatched ground plus a bold ringed amber pivot that never moves
        const gx = SX(0), gy = SY(0), hw = Math.max(9, sc * 0.16);
        g.globalAlpha = 0.5; g.strokeStyle = CREAM;
        g.lineWidth = Math.max(1.5, sc * 0.02); g.lineCap = 'round';
        g.beginPath();
        g.moveTo(gx - hw, gy + pr * 1.6); g.lineTo(gx + hw, gy + pr * 1.6);
        for (let i = -2; i <= 2; i++) {
          const bx = gx + i * (hw / 2.4);
          g.moveTo(bx, gy + pr * 1.6); g.lineTo(bx - hw * 0.28, gy + pr * 1.6 + hw * 0.42);
        }
        g.stroke(); g.globalAlpha = 1;
        g.fillStyle = bg; g.beginPath(); g.arc(gx, gy, pr * 1.9 + 1.6, 0, TAU); g.fill();
        g.strokeStyle = AMBER; g.lineWidth = Math.max(2, sc * 0.03);
        g.beginPath(); g.arc(gx, gy, pr * 1.9, 0, TAU); g.stroke();
        g.fillStyle = AMBER; g.beginPath(); g.arc(gx, gy, pr * 0.9, 0, TAU); g.fill();
      },

      down(p) {
        frame();
        dragging = true;
        // grab the stylus if the press lands near it; otherwise summon it to the finger
        const dx = (Ox + sx * sc) - p.x, dy = (Oy + sy * sc) - p.y;
        const grabR = Math.max(22, 0.14 * Math.min(env.w, env.h));
        if (Math.hypot(dx, dy) < grabR) { offx = dx; offy = dy; }
        else { offx = 0; offy = 0; }
        setTarget(p);
      },
      move(p) {
        if (!dragging || !p.held) return;
        setTarget(p);
      },
      up() {
        dragging = false;
      },
    };
  },
});
