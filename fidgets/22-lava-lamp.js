/* № 22 — Lava lamp. A tall glass vessel of warm wax over a glowing bulb.
   Blobs heated at the base swell, pinch off a bottom pool, stretch into
   teardrops as they rise, cool and flatten near the top, then sink back —
   a perpetual convection loop. Drag to add heat at your finger: nearby wax
   swells and rushes upward while a warm glow trails the pointer. The wax is
   a gooey metaball field (a soft threshold buffer, ≤76×110, allocated once)
   so blobs fuse and split organically instead of reading as hard circles. */
F.register({
  n: 22, id: 'lava-lamp', cat: 'matter',
  title: 'Lava lamp', hint: 'Drag to heat the wax — watch blobs rise',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;

    // palette → rgb (amber, coral, lilac warm trio; cream for glass highlights)
    const hex2rgb = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
    const AMBER = hex2rgb(inks[0]);
    const CORAL = hex2rgb(inks[1]);
    const LILAC = hex2rgb(inks[4]);
    const CREAM = hex2rgb(inks[5]);
    const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';

    // ---- metaball buffer: fixed resolution, physics runs in this space so a
    //      resize never rescales the sim. Allocated ONCE. ----
    const BW = 76, BH = 110;
    const oc = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(BW, BH)
      : { getContext: () => ({
          createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
          putImageData: () => {},
        }) };
    const octx = oc.getContext('2d');
    const img = octx.createImageData(BW, BH);
    const px = img.data;

    // vessel geometry as fractions of the lamp rect (buffer and card share them)
    const GLASS_TOP = 0.075, GLASS_BOT = 0.795;  // wax interior vertical span
    const DOME = 0.075;                           // rounded top length
    const HW_TOP = 0.285, HW_BOT = 0.415;         // interior half-width (frac of width)
    const CX = 0.5;

    // interior half-width (as a fraction of the lamp width) at vertical fraction vf
    function hwFrac(vf) {
      if (vf <= GLASS_TOP || vf >= GLASS_BOT) return 0;
      const taper = HW_TOP + (HW_BOT - HW_TOP) * (vf - GLASS_TOP) / (GLASS_BOT - GLASS_TOP);
      const domeEnd = GLASS_TOP + DOME;
      if (vf < domeEnd) {
        const a = (vf - GLASS_TOP) / DOME;              // 0..1 down the dome
        return taper * Math.sqrt(Math.max(0, 1 - (1 - a) * (1 - a)));
      }
      return taper;
    }

    // per-row interior half-width in buffer px + vertical wax colour LUT (once)
    const hwBuf = new Float32Array(BH);
    for (let by = 0; by < BH; by++) hwBuf[by] = hwFrac(by / BH) * BW;

    const stops = [
      [0.10, mix(LILAC, CREAM, 0.30)],   // cool pale crown
      [0.30, LILAC],                     // lilac
      [0.52, mix(CORAL, LILAC, 0.45)],   // warming
      [0.68, CORAL],                     // coral body
      [0.795, mix(AMBER, CORAL, 0.35)],  // hot amber base
    ];
    const LUT = new Uint8ClampedArray(BH * 3);
    for (let by = 0; by < BH; by++) {
      const vf = by / BH;
      let s = 0;
      while (s < stops.length - 2 && vf > stops[s + 1][0]) s++;
      const f = Math.min(1, Math.max(0, (vf - stops[s][0]) / (stops[s + 1][0] - stops[s][0])));
      const c = mix(stops[s][1], stops[s + 1][1], f);
      LUT[by * 3] = c[0]; LUT[by * 3 + 1] = c[1]; LUT[by * 3 + 2] = c[2];
    }
    const HL = mix(AMBER, CREAM, 0.55);  // hot-core highlight tint

    // ---- blobs (buffer space; y increases downward) ----
    const HEAT_Y = GLASS_BOT * BH;                  // heat source (bottom)
    const COOL_Y = (GLASS_TOP + DOME) * BH;         // cool ceiling (below dome)
    const cxBuf = CX * BW;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const NB = 6;
    const blobs = [];
    const midY = (COOL_Y + HEAT_Y) / 2, halfY = (HEAT_Y - COOL_Y) / 2;
    for (let i = 0; i < NB; i++) {
      const pool = i === 0;                          // a wide reservoir at the base
      const y = pool ? HEAT_Y - 7 : rnd(COOL_Y + 6, HEAT_Y - 6);
      const r0 = pool ? 11 : rnd(5.5, 7);
      blobs.push({
        x: cxBuf + rnd(-6, 6), y,
        vx: rnd(-2, 2), vy: rnd(-3, 3),
        r0, r: r0,
        T: 0.5 + (y - midY) / halfY * 0.6 + rnd(-0.08, 0.08), // hot low, cool high → instant convection
        sx: 1, sy: 1,
        wf: rnd(0.5, 1.1), wp: rnd(0, TAU),          // horizontal wander phase
        neutral: pool ? 1.7 : rnd(0.45, 0.55),       // pool stays denser than it ever gets → pinned low
        buoy: pool ? 3 : rnd(8, 11),
        drag: pool ? 1.6 : rnd(0.5, 0.62),
        wamp: pool ? 1.0 : rnd(2.2, 3.4),
        pool,
      });
    }

    // ---- interaction ----
    let hx = 0, hy = 0, hAmt = 0, hHeld = false;

    // ---- card-space geometry + cached gradients (rebuilt on resize) ----
    let geo = null;
    function buildGeom() {
      const W = env.w, H = env.h, ar = BW / BH;
      let lampH = H * 0.96, lampW = lampH * ar;
      if (lampW > W * 0.9) { lampW = W * 0.9; lampH = lampW / ar; }
      const lampX = (W - lampW) / 2, lampY = (H - lampH) / 2;
      const cx = lampX + lampW * CX, cy = lampY + lampH * 0.5;

      // glass outline sampled down each side (card coords)
      const K = 26, L = [], R = [];
      for (let k = 0; k <= K; k++) {
        const vf = GLASS_TOP + (GLASS_BOT - GLASS_TOP) * (k / K);
        const hw = hwFrac(vf) * lampW, y = lampY + vf * lampH;
        L.push([cx - hw, y]); R.push([cx + hw, y]);
      }

      const yb = lampY + GLASS_BOT * lampH;
      const halo = g.createRadialGradient(cx, lampY + lampH * 0.6, lampH * 0.05, cx, cy, Math.max(lampW, lampH) * 0.78);
      halo.addColorStop(0, rgba(mix(CORAL, AMBER, 0.45), 0.55));
      halo.addColorStop(0.5, rgba(CORAL, 0.14));
      halo.addColorStop(1, rgba(CORAL, 0));

      const glassTint = g.createLinearGradient(0, lampY + GLASS_TOP * lampH, 0, yb);
      glassTint.addColorStop(0, rgba(LILAC, 0.05));
      glassTint.addColorStop(0.55, rgba(CORAL, 0.05));
      glassTint.addColorStop(1, rgba(AMBER, 0.10));

      const bulbGlow = g.createRadialGradient(cx, yb, lampH * 0.02, cx, yb, lampH * 0.62);
      bulbGlow.addColorStop(0, rgba(mix(AMBER, CORAL, 0.35), 0.85));
      bulbGlow.addColorStop(0.35, rgba(CORAL, 0.35));
      bulbGlow.addColorStop(1, rgba(CORAL, 0));

      const baseGrad = g.createLinearGradient(0, yb, 0, lampY + 0.965 * lampH);
      baseGrad.addColorStop(0, rgba(mix(AMBER, CREAM, 0.25), 0.9));
      baseGrad.addColorStop(0.16, rgba(AMBER, 0.5));
      baseGrad.addColorStop(0.5, rgba([26, 18, 13], 1));
      baseGrad.addColorStop(1, rgba([12, 9, 7], 1));

      const capGrad = g.createLinearGradient(0, lampY, 0, lampY + GLASS_TOP * lampH);
      capGrad.addColorStop(0, rgba([30, 22, 16], 1));
      capGrad.addColorStop(0.55, rgba([20, 15, 11], 1));
      capGrad.addColorStop(1, rgba(mix(AMBER, CREAM, 0.2), 0.7));

      geo = { W, H, lampX, lampY, lampW, lampH, cx, yb, L, R, halo, glassTint, bulbGlow, baseGrad, capGrad };
    }
    buildGeom();

    function tracePath(pts0, pts1) {
      g.beginPath();
      g.moveTo(pts0[0][0], pts0[0][1]);
      for (let k = 1; k < pts0.length; k++) g.lineTo(pts0[k][0], pts0[k][1]);
      for (let k = pts1.length - 1; k >= 0; k--) g.lineTo(pts1[k][0], pts1[k][1]);
      g.closePath();
    }

    // ---- simulation ----
    function updateBlobs(t, dt) {
      const fOn = hAmt > 0.002 && geo.lampW > 1 && geo.lampH > 1;
      const fbx = fOn ? (hx - geo.lampX) / geo.lampW * BW : 0;
      const fby = fOn ? (hy - geo.lampY) / geo.lampH * BH : 0;
      for (let i = 0; i < NB; i++) {
        const b = blobs[i];
        // temperature: strong heat only near the base, slow loss in transit,
        // strong cooling only near the crown → a full-height convection loop
        const heatIn = Math.exp(-Math.max(0, HEAT_Y - b.y) / 18);
        const topProx = Math.exp(-Math.max(0, b.y - COOL_Y) / 11);
        let dT = heatIn * (b.pool ? 1.1 : 1.0) - (0.05 + 1.4 * topProx);
        if (fOn) {
          const dx = b.x - fbx, dy = b.y - fby;
          const infl = Math.exp(-(Math.sqrt(dx * dx + dy * dy) + 1e-6) / 16) * hAmt;
          dT += infl * 1.6;
          b.vy -= infl * 28 * dt;                    // rush upward under the finger
        }
        b.T += dT * dt;
        b.T = b.T < 0 ? 0 : b.T > 1.6 ? 1.6 : b.T;

        // buoyancy (hot rises → negative y), drag, gentle horizontal wander
        b.vy += -(b.T - b.neutral) * b.buoy * dt;
        b.vy *= Math.exp(-b.drag * dt);
        b.vx += Math.sin(t * b.wf + b.wp) * b.wamp * dt;
        b.vx *= Math.exp(-1.0 * dt);
        if (b.vy > 24) b.vy = 24; else if (b.vy < -24) b.vy = -24;
        if (b.vx > 22) b.vx = 22; else if (b.vx < -22) b.vx = -22;
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // soft vertical walls (also re-seat the pool on the base)
        const rTop = COOL_Y + b.r * 0.4, rBot = HEAT_Y - b.r * 0.05;
        if (b.y < rTop) { b.y = rTop + (b.y - rTop) * 0.5; if (b.vy < 0) b.vy *= -0.25; }
        if (b.y > rBot) { b.y = rBot + (b.y - rBot) * 0.5; if (b.vy > 0) b.vy *= -0.2; }
        // soft horizontal walls (fit inside the tapering glass)
        const lim = Math.max(2, hwFrac(b.y / BH) * BW - b.r * 0.55);
        if (b.x < cxBuf - lim) { b.x = cxBuf - lim; if (b.vx < 0) b.vx *= -0.3; }
        if (b.x > cxBuf + lim) { b.x = cxBuf + lim; if (b.vx > 0) b.vx *= -0.3; }

        // squash & stretch: teardrop while moving, flatten when cool up top
        let e = b.vy * 0.02; e = e < -0.5 ? -0.5 : e > 0.5 ? 0.5 : e;
        let syT = 1 + Math.abs(e) * (b.vy < 0 ? 1 : 0.7);
        syT -= topProx * Math.max(0, b.neutral - b.T + 0.1) * 1.6;
        if (syT < 0.55) syT = 0.55;
        if (b.pool) syT = 0.62;                       // reservoir is a flat puddle
        const sxT = 1 / syT;
        const k = 1 - Math.pow(0.02, dt);
        b.sy += (syT - b.sy) * k;
        b.sx += (sxT - b.sx) * k;

        // heat swell (spring toward temperature-scaled radius)
        const rT = b.r0 * (1 + Math.min(1.2, b.T) * 0.16);
        b.r += (rT - b.r) * (1 - Math.pow(0.05, dt));
      }
      // gentle spread so neighbours keep identity yet still fuse when close
      for (let i = 0; i < NB; i++) {
        for (let j = i + 1; j < NB; j++) {
          const a = blobs[i], b = blobs[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
          const mn = (a.r + b.r) * 0.6;
          if (d < mn) {
            const push = (mn - d) / mn * 6 * dt, nx = dx / d, ny = dy / d;
            a.x -= nx * push; a.y -= ny * push;
            b.x += nx * push; b.y += ny * push;
          }
        }
      }
    }

    // ---- metaball threshold render into the small buffer ----
    function renderField() {
      px.fill(0);
      for (let i = 0; i < NB; i++) {
        const b = blobs[i];
        b._r2 = b.r * b.r;
        b._isx = 1 / (b.sx * b.sx);
        b._isy = 1 / (b.sy * b.sy);
      }
      for (let by = 0; by < BH; by++) {
        const hw = hwBuf[by];
        if (hw <= 0.5) continue;
        let x0 = Math.floor(cxBuf - hw); if (x0 < 0) x0 = 0;
        let x1 = Math.ceil(cxBuf + hw); if (x1 > BW - 1) x1 = BW - 1;
        const lr = LUT[by * 3], lg = LUT[by * 3 + 1], lb = LUT[by * 3 + 2];
        let o = (by * BW + x0) * 4;
        for (let x = x0; x <= x1; x++, o += 4) {
          let f = 0;
          for (let i = 0; i < NB; i++) {
            const b = blobs[i];
            const dx = x - b.x, dy = by - b.y;
            f += b._r2 / (dx * dx * b._isx + dy * dy * b._isy + 1.5);
          }
          if (f <= 1.15) continue;
          const a = f >= 1.85 ? 1 : (f - 1.15) / 0.7;
          let core = f <= 1.85 ? 0 : (f - 1.85) / 10; if (core > 1) core = 1;
          px[o] = lr + (HL[0] - lr) * core * 0.5;
          px[o + 1] = lg + (HL[1] - lg) * core * 0.5;
          px[o + 2] = lb + (HL[2] - lb) * core * 0.5;
          px[o + 3] = a * 255;
        }
      }
      octx.putImageData(img, 0, 0);
    }

    return {
      draw(t, dt) {
        const W = env.w, H = env.h;
        if (!geo || geo.W !== W || geo.H !== H) buildGeom();
        hAmt += ((hHeld ? 1 : 0) - hAmt) * (1 - Math.pow(0.0025, dt));
        if (!hHeld && hAmt < 0.001) hAmt = 0;
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.9);

        updateBlobs(t, dt);
        renderField();

        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        g.lineJoin = 'round'; g.lineCap = 'round';
        g.fillStyle = bg; g.fillRect(0, 0, W, H);

        // ambient halo around the whole lamp
        g.globalAlpha = 0.1 + hAmt * 0.12 + pulse * 0.03;
        g.fillStyle = geo.halo; g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;

        // metal base housing + glowing heat element along its top
        tracePath(
          [[geo.cx - HW_BOT * geo.lampW, geo.yb], [geo.cx + HW_BOT * geo.lampW, geo.yb]],
          [[geo.cx - 0.5 * geo.lampW, geo.lampY + 0.965 * geo.lampH], [geo.cx + 0.5 * geo.lampW, geo.lampY + 0.965 * geo.lampH]]);
        g.fillStyle = geo.baseGrad; g.fill();
        g.globalAlpha = 0.5 + 0.4 * pulse + hAmt * 0.3;
        g.strokeStyle = rgba(mix(AMBER, CORAL, 0.3), 1);
        g.lineWidth = Math.max(2, geo.lampW * 0.02);
        g.beginPath();
        g.moveTo(geo.cx - HW_BOT * geo.lampW * 0.9, geo.yb);
        g.lineTo(geo.cx + HW_BOT * geo.lampW * 0.9, geo.yb);
        g.stroke();
        g.globalAlpha = 1;

        // everything inside the glass, clipped to the vessel
        g.save();
        tracePath(geo.L, geo.R); g.clip();
        g.fillStyle = geo.glassTint;
        g.fillRect(geo.lampX, geo.lampY, geo.lampW, geo.lampH);
        g.globalAlpha = 0.55 + 0.3 * pulse + hAmt * 0.4;
        g.fillStyle = geo.bulbGlow;
        g.fillRect(geo.lampX - 4, geo.lampY, geo.lampW + 8, geo.lampH);
        g.globalAlpha = 1;
        g.imageSmoothingEnabled = true;
        g.drawImage(oc, 0, 0, BW, BH, geo.lampX, geo.lampY, geo.lampW, geo.lampH);
        g.globalCompositeOperation = 'lighter';                 // additive wax bloom
        g.globalAlpha = 0.22 + hAmt * 0.15;
        g.drawImage(oc, 0, 0, BW, BH, geo.lampX, geo.lampY, geo.lampW, geo.lampH);
        if (hAmt > 0.01) {                                      // warm glow trailing the finger
          const fg = g.createRadialGradient(hx, hy, 0, hx, hy, geo.lampW * 0.5);
          fg.addColorStop(0, rgba(mix(AMBER, CORAL, 0.4), 0.6 * hAmt));
          fg.addColorStop(0.5, rgba(CORAL, 0.25 * hAmt));
          fg.addColorStop(1, rgba(CORAL, 0));
          g.fillStyle = fg;
          g.fillRect(geo.lampX, geo.lampY, geo.lampW, geo.lampH);
        }
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        g.restore();

        // glass rim, inner warm edge, and a reflection streak
        tracePath(geo.L, geo.R);
        g.strokeStyle = rgba(mix(CREAM, LILAC, 0.25), 0.9);
        g.lineWidth = Math.max(2, geo.lampW * 0.022);
        g.stroke();
        tracePath(geo.L, geo.R);
        g.strokeStyle = rgba(CORAL, 0.22);
        g.lineWidth = Math.max(1, geo.lampW * 0.012);
        g.stroke();
        g.globalAlpha = 0.5;
        g.strokeStyle = rgba(CREAM, 0.55);
        g.lineWidth = Math.max(1.5, geo.lampW * 0.02);
        g.beginPath();
        for (let k = 2; k <= 8; k++) {
          const p = geo.L[k];
          if (k === 2) g.moveTo(p[0] + geo.lampW * 0.05, p[1]);
          else g.lineTo(p[0] + geo.lampW * 0.05, p[1]);
        }
        g.stroke();
        g.globalAlpha = 1;

        // cap knob on top
        const cy0 = geo.lampY, cy1 = geo.lampY + GLASS_TOP * geo.lampH;
        tracePath(
          [[geo.cx - HW_TOP * geo.lampW * 0.32, cy0], [geo.cx + HW_TOP * geo.lampW * 0.32, cy0]],
          [[geo.cx - HW_TOP * geo.lampW * 0.5, cy1], [geo.cx + HW_TOP * geo.lampW * 0.5, cy1]]);
        g.fillStyle = geo.capGrad; g.fill();
        g.strokeStyle = rgba(mix(CREAM, LILAC, 0.3), 0.5);
        g.lineWidth = Math.max(1.5, geo.lampW * 0.016);
        g.stroke();
      },
      down(p) { hHeld = true; hx = p.x; hy = p.y; if (hAmt < 0.15) hAmt = 0.15; },
      move(p) { if (p.held) { hHeld = true; hx = p.x; hy = p.y; } },
      up() { hHeld = false; },
      dbl(p) {
        hx = p.x; hy = p.y; hAmt = 1;
        const fbx = (p.x - geo.lampX) / Math.max(1, geo.lampW) * BW;
        const fby = (p.y - geo.lampY) / Math.max(1, geo.lampH) * BH;
        for (const b of blobs) {                                // heave a heat burst in
          const dx = b.x - fbx, dy = b.y - fby;
          const infl = Math.exp(-(Math.sqrt(dx * dx + dy * dy) + 1e-6) / 22);
          b.T = Math.min(1.6, b.T + 0.6 * infl + 0.15);
          b.vy -= 12 * infl;
        }
      },
      leave() { hHeld = false; },
      resize() { buildGeom(); },
    };
  },
});
