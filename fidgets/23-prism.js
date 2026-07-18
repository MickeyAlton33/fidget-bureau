/* № 23 — Prism. A wedge of glass splits a pale beam into spectrum. The beam
   breathes at idle so the fanned rainbow shimmers and slides, and motes drift
   through the light catching it. Drag to aim the beam into the glass — the
   refraction and the spread of the exit spectrum answer live. */
F.register({
  n: 23, id: 'prism', cat: 'optics',
  title: 'Prism', hint: 'Drag the beam into the prism',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;

    // Spectral ramp red→violet, built from the palette's warm→cool inks and
    // interpolated into a smooth band.
    const SP = [
      [242, 102, 91],   // coral — red
      [245, 165, 36],   // amber — orange
      [244, 206, 120],  // gold  — yellow  (amber↔cream)
      [79, 201, 160],   // mint  — green
      [88, 166, 242],   // sky   — blue
      [176, 140, 232],  // lilac — violet
    ];
    function specColor(u) {
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const n = SP.length - 1, x = u * n;
      let i = Math.floor(x); if (i >= n) i = n - 1;
      const f = x - i, a = SP[i], b = SP[i + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }
    const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';

    const N = 9;                 // rays in the fan
    const rays = [];
    for (let i = 0; i < N; i++) { const u = i / (N - 1); rays.push({ u, c: specColor(u) }); }

    // 2D Snell refraction. n points against the incident side; null = TIR.
    function refract(ix, iy, nx, ny, eta) {
      const ci = -(ix * nx + iy * ny);
      const k = 1 - eta * eta * (1 - ci * ci);
      if (k < 0) return null;
      const mm = eta * ci - Math.sqrt(k);
      let tx = eta * ix + mm * nx, ty = eta * iy + mm * ny;
      const L = Math.hypot(tx, ty) + 1e-6;
      return [tx / L, ty / L];
    }

    // ---- geometry (rebuilt on resize) ----
    let ax, ay, bx, by, vdx, vdy, rdx, rdy;
    let n1x, n1y, n2x, n2y, pex, pey;
    function layout() {
      const w = env.w, h = env.h, m = Math.min(w, h);
      const cx = w * 0.5, cy = h * 0.53, R = Math.max(20, m * 0.27);
      ax = cx; ay = cy - R;                                                   // apex (top)
      bx = cx + R * Math.cos(Math.PI * 5 / 6); by = cy + R * Math.sin(Math.PI * 5 / 6); // bottom-left
      vdx = cx + R * Math.cos(Math.PI / 6); vdy = cy + R * Math.sin(Math.PI / 6);       // bottom-right
      rdx = vdx - ax; rdy = vdy - ay;                                         // right face A→D
      const gx = (ax + bx + vdx) / 3, gy = (ay + by + vdy) / 3;
      let ex = bx - ax, ey = by - ay, L = Math.hypot(ex, ey) + 1e-6;          // left face normal
      n1x = ey / L; n1y = -ex / L;
      if (((ax + bx) / 2 - gx) * n1x + ((ay + by) / 2 - gy) * n1y < 0) { n1x = -n1x; n1y = -n1y; }
      ex = rdx; ey = rdy; L = Math.hypot(ex, ey) + 1e-6;                      // right face normal
      n2x = ey / L; n2y = -ex / L;
      if (((ax + vdx) / 2 - gx) * n2x + ((ay + vdy) / 2 - gy) * n2y < 0) { n2x = -n2x; n2y = -n2y; }
      pex = ax + (bx - ax) * 0.55; pey = ay + (by - ay) * 0.55;               // beam pivot on left face
    }
    layout();

    const NEUTRAL = 0.44;        // resting beam heading (into the left face)
    let aim = NEUTRAL, aimV = 0;
    let held = false, hov = false, hovx = 0, hovy = 0, ptx = 0, pty = 0;
    let grab = 0, burst = 0;

    // dust motes in normalised space so they survive a resize
    const motes = [];
    for (let i = 0; i < 34; i++) motes.push({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() * 2 - 1) * 0.013, vy: (Math.random() * 2 - 1) * 0.013,
      ph: Math.random() * TAU, sp: 0.6 + Math.random() * 1.0, r: 0.7 + Math.random() * 1.5,
    });

    function distSeg(px, py, x1, y1, x2, y2) {
      const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy + 1e-6;
      let s = ((px - x1) * dx + (py - y1) * dy) / l2;
      s = s < 0 ? 0 : s > 1 ? 1 : s;
      return Math.hypot(px - (x1 + s * dx), py - (y1 + s * dy));
    }

    return {
      draw(t, dt) {
        const w = env.w, h = env.h, m = Math.min(w, h), diag = Math.hypot(w, h);

        // ---- aim spring ----
        let target;
        if (held) {
          target = Math.atan2(pey - pty, pex - ptx);
          target = Math.max(NEUTRAL - 0.72, Math.min(NEUTRAL + 0.72, target));
        } else {
          target = NEUTRAL + Math.sin(t * 0.5) * 0.27 + Math.sin(t * 0.23 + 1) * 0.12;
          if (hov) {
            let ht = Math.atan2(pey - hovy, pex - hovx);
            ht = Math.max(NEUTRAL - 0.72, Math.min(NEUTRAL + 0.72, ht));
            target += (ht - target) * 0.35;
          }
        }
        const K = held ? 130 : 46, DP = held ? 13 : 10;
        aimV += ((target - aim) * K - aimV * DP) * dt;
        if (aimV > 30) aimV = 30; else if (aimV < -30) aimV = -30;
        aim += aimV * dt;
        aim = Math.max(NEUTRAL - 1.0, Math.min(NEUTRAL + 1.0, aim));
        grab *= Math.pow(0.02, dt);
        burst *= Math.pow(0.08, dt);

        // ---- trace: entry refraction, interior ray, exit dispersion ----
        const dirx = Math.cos(aim), diry = Math.sin(aim);
        const srcx = pex - dirx * diag * 1.2, srcy = pey - diry * diag * 1.2;
        const T = refract(dirx, diry, n1x, n1y, 1 / 1.5) || [dirx, diry];
        const cosi = Math.max(0, Math.min(1, -(dirx * n1x + diry * n1y)));
        const det = rdx * T[1] - rdy * T[0];
        let s = (T[0] * (ay - pey) - T[1] * (ax - pex)) / (det + (det >= 0 ? 1e-6 : -1e-6));
        s = s < 0.12 ? 0.12 : s > 0.9 ? 0.9 : s;
        const p2x = ax + rdx * s, p2y = ay + rdy * s;
        const ec = refract(T[0], T[1], -n2x, -n2y, 1.5) || [T[0], T[1]];
        const phi0 = Math.atan2(ec[1], ec[0]);
        let spread = 0.34 + (1 - cosi) * 0.5 + Math.sin(t * 0.6) * 0.07 + burst * 0.6;
        spread = spread < 0.26 ? 0.26 : spread > 1.05 ? 1.05 : spread;
        const RAY = diag * 1.35;

        // ---- paint ----
        g.fillStyle = bg; g.fillRect(0, 0, w, h);

        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(vdx, vdy); g.closePath();
        g.fillStyle = 'rgba(242,233,220,' + (0.05 + 0.02 * Math.sin(t * 0.7)).toFixed(3) + ')';
        g.fill();

        g.lineCap = 'round'; g.lineJoin = 'round';
        g.globalCompositeOperation = 'lighter';

        // motes catching the light
        for (let i = 0; i < motes.length; i++) {
          const mo = motes[i];
          mo.x += mo.vx * dt; mo.y += mo.vy * dt;
          if (mo.x < -0.02) mo.x += 1.04; else if (mo.x > 1.02) mo.x -= 1.04;
          if (mo.y < -0.02) mo.y += 1.04; else if (mo.y > 1.02) mo.y -= 1.04;
          const mx = mo.x * w, my = mo.y * h;
          let a = 0.06 + 0.10 * (0.5 + 0.5 * Math.sin(t * mo.sp + mo.ph));
          let col = [242, 233, 220];
          const db = distSeg(mx, my, srcx, srcy, pex, pey);
          if (db < 15) a += (1 - db / 15) * 0.45;
          const ddx = mx - p2x, ddy = my - p2y, dd = Math.hypot(ddx, ddy);
          if (dd < RAY * 0.9 && (ddx * ec[0] + ddy * ec[1]) > 0) {
            let dl = Math.atan2(ddy, ddx) - phi0;
            while (dl > Math.PI) dl -= TAU; while (dl < -Math.PI) dl += TAU;
            if (Math.abs(dl) < spread * 0.55) { col = specColor(0.5 + dl / spread); a += (1 - dd / (RAY * 0.9)) * 0.5; }
          }
          g.fillStyle = rgba(col, Math.min(0.9, a).toFixed(3));
          g.beginPath(); g.arc(mx, my, mo.r, 0, TAU); g.fill();
        }

        // incoming pale beam — soft halo + bright core
        const ib = 0.42 + grab * 0.4;
        let bm = g.createLinearGradient(srcx, srcy, pex, pey);
        bm.addColorStop(0, 'rgba(242,233,220,0)');
        bm.addColorStop(1, 'rgba(242,233,220,' + (ib * 0.5).toFixed(3) + ')');
        g.strokeStyle = bm; g.lineWidth = Math.max(6, m * 0.03);
        g.beginPath(); g.moveTo(srcx, srcy); g.lineTo(pex, pey); g.stroke();
        bm = g.createLinearGradient(srcx, srcy, pex, pey);
        bm.addColorStop(0, 'rgba(255,250,240,0)');
        bm.addColorStop(1, 'rgba(255,250,240,' + ib.toFixed(3) + ')');
        g.strokeStyle = bm; g.lineWidth = Math.max(2, m * 0.008);
        g.beginPath(); g.moveTo(srcx, srcy); g.lineTo(pex, pey); g.stroke();

        // interior streak through the glass
        g.strokeStyle = 'rgba(255,250,240,' + (ib * 0.7).toFixed(3) + ')';
        g.lineWidth = Math.max(2, m * 0.01);
        g.beginPath(); g.moveTo(pex, pey); g.lineTo(p2x, p2y); g.stroke();

        // exit spectrum fan
        const softW = Math.max(5, m * 0.028), coreW = Math.max(2, m * 0.009);
        for (let i = 0; i < N; i++) {
          const r = rays[i], phi = phi0 + (r.u - 0.5) * spread;
          const ex2 = p2x + Math.cos(phi) * RAY, ey2 = p2y + Math.sin(phi) * RAY;
          const a = (0.5 + grab * 0.3) * (0.72 + 0.28 * Math.sin(t * 1.3 + i * 0.7));
          const gr = g.createLinearGradient(p2x, p2y, ex2, ey2);
          gr.addColorStop(0, rgba(r.c, (a * 0.9).toFixed(3)));
          gr.addColorStop(0.45, rgba(r.c, (a * 0.32).toFixed(3)));
          gr.addColorStop(1, rgba(r.c, 0));
          g.strokeStyle = gr; g.lineWidth = softW;
          g.beginPath(); g.moveTo(p2x, p2y); g.lineTo(ex2, ey2); g.stroke();
          g.strokeStyle = rgba(r.c, (a * 0.55).toFixed(3)); g.lineWidth = coreW;
          g.beginPath(); g.moveTo(p2x, p2y); g.lineTo(p2x + Math.cos(phi) * RAY * 0.6, p2y + Math.sin(phi) * RAY * 0.6); g.stroke();
        }

        // luminous blooms where light enters and leaves the glass
        const bloom = (x, y, rad, col, al) => {
          const rg = g.createRadialGradient(x, y, 0, x, y, rad);
          rg.addColorStop(0, rgba(col, al)); rg.addColorStop(1, rgba(col, 0));
          g.fillStyle = rg; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
        };
        bloom(pex, pey, Math.max(6, m * 0.05), [255, 250, 240], (0.5 + grab * 0.4).toFixed(3));
        bloom(p2x, p2y, Math.max(8, m * 0.07), [255, 248, 238], (0.55 + grab * 0.4).toFixed(3));

        // glinting left face + apex sparkle
        const gp = 0.5 + 0.42 * Math.sin(t * 0.9);
        const glx = ax + (bx - ax) * gp, gly = ay + (by - ay) * gp;
        g.strokeStyle = 'rgba(255,250,240,0.9)'; g.lineWidth = 3;
        g.beginPath();
        g.moveTo(glx - (bx - ax) * 0.07, gly - (by - ay) * 0.07);
        g.lineTo(glx + (bx - ax) * 0.07, gly + (by - ay) * 0.07);
        g.stroke();
        const spk = 3 + 2 * (0.5 + 0.5 * Math.sin(t * 2.1));
        g.strokeStyle = 'rgba(255,252,245,0.85)'; g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(ax - spk, ay); g.lineTo(ax + spk, ay);
        g.moveTo(ax, ay - spk); g.lineTo(ax, ay + spk);
        g.stroke();

        g.globalCompositeOperation = 'source-over';

        // crisp glass rim
        g.strokeStyle = 'rgba(242,233,220,0.85)'; g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(vdx, vdy); g.closePath();
        g.stroke();

        g.globalAlpha = 1;
      },

      down(p) { held = true; ptx = p.x; pty = p.y; grab = 1; burst = 0.5; },
      move(p) {
        if (p.held) { held = true; ptx = p.x; pty = p.y; }
        else { held = false; hov = true; hovx = p.x; hovy = p.y; }
      },
      up() { held = false; },
      leave() { hov = false; },
      dbl() { burst = 1; grab = 1; },
      resize() { layout(); },
    };
  },
});
