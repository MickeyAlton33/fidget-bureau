/* № 43 — Soap film. A bubble stretched across the card, its skin swimming with
   thin-film interference: broad iridescent bands that drift and thin on their
   own, a rainbow swirl roaming the surface, a wet catch-light on the rim. Drag
   to push and swirl the film — your motion smears the colours around and sets
   them wobbling home. Rendered analytically as layered spectral Newton's-ring
   gradients composited additively; no buffers, no offscreen canvas. */
F.register({
  n: 43, id: 'soap-film', cat: 'optics',
  title: 'Soap film', hint: 'Drag to swirl the iridescent film',
  make(env) {
    const { g, bg } = env;
    const TAU = Math.PI * 2;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

    // Palette in spectral cycling order: amber→coral→lilac→sky→mint→cream→…
    const S = [
      [245, 165, 36], [242, 102, 91], [176, 140, 232],
      [88, 166, 242], [79, 201, 160], [242, 233, 220],
    ];
    function spectral(ph) {
      if (!isFinite(ph)) ph = 0;
      let f = ph - Math.floor(ph);          // 0..1
      f *= 6;
      const i = f | 0;                       // 0..5
      const u = f - i;
      const c0 = S[i % 6], c1 = S[(i + 1) % 6];
      return [
        c0[0] + (c1[0] - c0[0]) * u,
        c0[1] + (c1[1] - c0[1]) * u,
        c0[2] + (c1[2] - c0[2]) * u,
      ];
    }

    // ---- living state ----
    let phase = Math.random();       // thickness phase (0..1), always drifting
    let phaseV = 0.05;               // thinning rate
    let spin = Math.random() * TAU;  // rotation of the band centres
    let spinV = 0.22;
    let pushX = 0, pushY = 0, pushVx = 0, pushVy = 0; // drag smear, springs home
    let bright = 0;                  // interaction flare, decays to 0
    let held = false, lastX = 0, lastY = 0;
    let hov = null;

    const IDLE_SPIN = 0.22, IDLE_THIN = 0.05;

    // Three broad band layers; cyc = spectral cycles seen across the bubble.
    const L = [
      { oR: 0.10, sp: 1.00, ang: 0.0, cyc: 1.5, a: 0.34, dr: 0.9, pf: 0.90 },
      { oR: 0.17, sp: -0.62, ang: 2.1, cyc: 2.0, a: 0.30, dr: 1.3, pf: 0.60 },
      { oR: 0.23, sp: 0.47, ang: 4.2, cyc: 2.5, a: 0.26, dr: 0.6, pf: 1.15 },
    ];

    function geom() {
      const w = env.w, h = env.h, m = Math.min(w, h);
      return { bcx: w * 0.5, bcy: h * 0.5, R: Math.max(6, 0.47 * m) };
    }

    // A radial stack of spectral rings — Newton's rings for one film patch.
    // Rg extends past the bubble so an off-centre patch still fills it; cyc is
    // pre-scaled by the caller so the visible band width stays constant.
    function ringGrad(cx, cy, Rg, cyc, phBase, a) {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, Rg));
      const N = 18;
      for (let s = 0; s <= N; s++) {
        const o = s / N;
        const col = spectral(phBase + o * cyc);
        let e = 1;
        if (o > 0.8) e = (1 - o) / 0.2;                 // soft outer fade
        else if (o < 0.08) e = 0.3 + o / 0.08 * 0.7;    // ease the hot centre
        const al = clamp(a * e, 0, 1);
        gr.addColorStop(o, 'rgba(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ',' + al.toFixed(3) + ')');
      }
      return gr;
    }
    function blob(cx, cy, r, rgb, a0) {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, r));
      gr.addColorStop(0, 'rgba(' + rgb + ',' + clamp(a0, 0, 1).toFixed(3) + ')');
      gr.addColorStop(0.55, 'rgba(' + rgb + ',' + clamp(a0 * 0.35, 0, 1).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      return gr;
    }

    return {
      draw(t, dt) {
        const { bcx, bcy, R } = geom();
        const w = env.w, h = env.h;

        // ---- integrate life ----
        spinV = IDLE_SPIN + (spinV - IDLE_SPIN) * Math.pow(0.5, dt);
        spinV = clamp(spinV, -12, 12);
        spin += spinV * dt;
        if (spin > 1e5) spin -= 1e5;

        phaseV = IDLE_THIN + (phaseV - IDLE_THIN) * Math.pow(0.4, dt);
        phaseV = clamp(phaseV, -4, 4);
        phase += phaseV * dt; phase -= Math.floor(phase);

        pushVx += (-pushX * 90 - pushVx * 9) * dt;
        pushVy += (-pushY * 90 - pushVy * 9) * dt;
        pushVx = clamp(pushVx, -3000, 3000); pushVy = clamp(pushVy, -3000, 3000);
        pushX += pushVx * dt; pushY += pushVy * dt;
        const pc = 0.35 * R;
        pushX = clamp(pushX, -pc, pc); pushY = clamp(pushY, -pc, pc);

        bright *= Math.pow(0.10, dt);
        bright = clamp(bright, 0, 2);
        const flare = 1 + Math.min(0.5, bright * 0.28);

        // ---- paint ----
        g.fillStyle = bg;
        g.fillRect(0, 0, w, h);

        // faint halo so the bubble sits in the card
        const halo = g.createRadialGradient(bcx, bcy, R * 0.75, bcx, bcy, R * 1.3);
        halo.addColorStop(0, 'rgba(120,140,220,0.06)');
        halo.addColorStop(1, 'rgba(120,140,220,0)');
        g.fillStyle = halo;
        g.fillRect(bcx - R * 1.35, bcy - R * 1.35, R * 2.7, R * 2.7);

        g.save();
        g.beginPath();
        g.arc(bcx, bcy, R, 0, TAU);
        g.clip();

        // glassy body — offset centre hints a dome under the sheen
        const body = g.createRadialGradient(bcx - R * 0.22, bcy - R * 0.24, R * 0.1, bcx, bcy, R * 1.05);
        body.addColorStop(0, 'rgba(34,44,60,0.55)');
        body.addColorStop(1, 'rgba(12,14,20,0.6)');
        g.fillStyle = body;
        g.fillRect(bcx - R, bcy - R, 2 * R, 2 * R);

        // additive iridescence
        g.globalCompositeOperation = 'lighter';
        const Rg = R * 1.6;
        for (let i = 0; i < L.length; i++) {
          const l = L[i];
          const cx = bcx + Math.cos(spin * l.sp + l.ang) * l.oR * R + pushX * l.pf;
          const cy = bcy + Math.sin(spin * l.sp + l.ang) * l.oR * R + pushY * l.pf;
          g.fillStyle = ringGrad(cx, cy, Rg, l.cyc * 1.6, phase * l.dr + i * 0.31, l.a * flare);
          g.fillRect(bcx - R, bcy - R, 2 * R, 2 * R);
        }

        // roaming rainbow swirl — a brighter patch migrating over the film
        const mcx = bcx + Math.cos(t * 0.13 + spin * 0.2) * R * 0.45 * (0.6 + 0.4 * Math.sin(t * 0.07)) + pushX * 0.5;
        const mcy = bcy + Math.sin(t * 0.17 - spin * 0.15) * R * 0.42 * (0.6 + 0.4 * Math.cos(t * 0.09)) + pushY * 0.5;
        const ma = (0.24 + 0.2 * Math.max(0, Math.sin(t * 0.12 + 1)) + bright * 0.22) * flare;
        g.fillStyle = ringGrad(mcx, mcy, R * 1.1, 1.2 * 1.1, phase * 1.6 + t * 0.03, ma);
        g.fillRect(bcx - R, bcy - R, 2 * R, 2 * R);

        // wet catch-light on the rim (leans faintly toward a hovering cursor)
        let ca = -2.15 + Math.sin(t * 0.23) * 0.06;
        if (hov) {
          let d = Math.atan2(hov.y - bcy, hov.x - bcx) - ca;
          while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
          ca += d * 0.22;
        }
        const scx = bcx + Math.cos(ca) * R * 0.8, scy = bcy + Math.sin(ca) * R * 0.8;
        g.fillStyle = blob(scx, scy, R * 0.55, '242,233,220', 0.4 + bright * 0.28 + 0.08 * Math.sin(t * 0.5));
        g.fillRect(bcx - R, bcy - R, 2 * R, 2 * R);
        g.fillStyle = blob(scx, scy, R * 0.16, '255,250,240', 0.6 + bright * 0.25);
        g.fillRect(scx - R * 0.22, scy - R * 0.22, R * 0.44, R * 0.44);
        // dim secondary sheen opposite the highlight
        const o2 = ca + Math.PI * 0.9;
        g.fillStyle = blob(bcx + Math.cos(o2) * R * 0.7, bcy + Math.sin(o2) * R * 0.7, R * 0.4, '176,140,232', 0.14 * flare);
        g.fillRect(bcx - R, bcy - R, 2 * R, 2 * R);

        g.globalCompositeOperation = 'source-over';
        g.restore();

        // film edge + a bright rim segment under the catch-light
        g.lineJoin = 'round'; g.lineCap = 'round';
        g.lineWidth = Math.max(1.5, R * 0.016);
        g.strokeStyle = 'rgba(242,233,220,0.16)';
        g.beginPath(); g.arc(bcx, bcy, R, 0, TAU); g.stroke();
        g.lineWidth = Math.max(2, R * 0.03);
        g.strokeStyle = 'rgba(242,233,220,' + (0.4 + bright * 0.25).toFixed(3) + ')';
        g.beginPath(); g.arc(bcx, bcy, R, ca - 0.55, ca + 0.55); g.stroke();

        g.globalCompositeOperation = 'source-over';
      },

      down(p) {
        held = true; lastX = p.x; lastY = p.y;
        bright = Math.min(2, bright + 0.5);
        hov = null;
      },
      move(p) {
        if (held && p.held) {
          const { bcx, bcy } = geom();
          const dx = clamp(p.x - lastX, -160, 160);
          const dy = clamp(p.y - lastY, -160, 160);
          lastX = p.x; lastY = p.y;
          const rx = p.x - bcx, ry = p.y - bcy;
          const rl = Math.hypot(rx, ry) + 1e-6;
          spinV = clamp(spinV + (rx * dy - ry * dx) / rl * 0.02, -12, 12); // swirl
          const sp = Math.hypot(dx, dy);
          phaseV = clamp(phaseV + sp * 0.004, -4, 4);                      // thin
          pushVx = clamp(pushVx + dx * 1.2, -3000, 3000);                  // smear
          pushVy = clamp(pushVy + dy * 1.2, -3000, 3000);
          bright = Math.min(2, bright + sp * 0.02);
        } else if (!p.held) {
          held = false; hov = { x: p.x, y: p.y };
        }
      },
      up() { held = false; },
      leave() { held = false; hov = null; },
      dbl() {
        // agitate the film — a burst of swirl, thinning and glow
        spinV = clamp(spinV + (Math.random() - 0.5) * 16, -14, 14);
        phaseV = clamp(phaseV + 1.4, -4, 4);
        pushVx += (Math.random() - 0.5) * 900;
        pushVy += (Math.random() - 0.5) * 900;
        bright = 2;
      },
    };
  },
});
