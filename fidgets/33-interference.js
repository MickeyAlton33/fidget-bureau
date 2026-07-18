/* № 33 — Interference. Two point sources cast expanding waves across a ripple
   tank. Where crest meets crest the field blazes cream; where crest meets
   trough it cancels to dark, carving the classic hyperbolic fringe bands of a
   double-slit. The crests never stop radiating (the carrier advances with t)
   and the fringe spacing quietly breathes on its own. Drag either source to
   morph the geometry live; scroll to retune the wavelength — fringes bloom
   finer or coarser. The whole field is one small wave buffer (100×100),
   summed once per frame from sin(k·d₁−ωt)+sin(k·d₂−ωt) and upscaled soft. */
F.register({
  n: 33, id: 'interference', cat: 'optics',
  title: 'Interference', hint: 'Drag the two sources — watch fringes form',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2, HALF_PI = Math.PI / 2;

    // ---- wave buffer: fixed resolution, samples normalised card space so a
    //      resize never rescales the physics. Allocated ONCE. The test stub
    //      has no canvas constructor, so fall back to an inert stand-in with
    //      the two methods we actually call. ----
    const BW = 100, BH = 100;
    const oc = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(BW, BH)
      : { getContext: () => ({
          createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
          putImageData: () => {},
        }) };
    const octx = oc.getContext('2d');
    const img = octx.createImageData(BW, BH);
    const px = img.data;
    for (let i = 3; i < px.length; i += 4) px[i] = 255;   // opaque, set once

    // normalised sample x per column (0..1), constant for the buffer's life
    const uArr = new Float32Array(BW);
    for (let bx = 0; bx < BW; bx++) uArr[bx] = bx / (BW - 1);

    // ---- sine lookup (nearest-neighbour, power-of-two mask handles any real,
    //      negatives included) — keeps the per-pixel loop off Math.sin/cos ----
    const LN = 2048, LMASK = LN - 1, L2I = LN / TAU;
    const sinT = new Float32Array(LN);
    for (let i = 0; i < LN; i++) sinT[i] = Math.sin(i / LN * TAU);
    const sinL = x => sinT[((x * L2I) | 0) & LMASK];

    // ---- palette → a sky→cream brightness ramp for the field ----
    const rgb = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
    const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
    const SKY = rgb(inks[3]), CREAM = rgb(inks[5]), GROUND = rgb(bg);
    const AMBER = rgb(inks[0]), CORAL = rgb(inks[1]);
    const stops = [
      [0.00, mix(GROUND, SKY, 0.10)],   // dark nodal channels
      [0.28, mix(GROUND, SKY, 0.55)],   // dim blue
      [0.60, SKY],                      // vivid sky band
      [0.82, mix(SKY, CREAM, 0.65)],
      [1.00, CREAM],                    // blazing crest
    ];
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const f = i / 255;
      let s = 0;
      while (s < stops.length - 2 && f > stops[s + 1][0]) s++;
      const u = Math.min(1, Math.max(0, (f - stops[s][0]) / (stops[s + 1][0] - stops[s][0])));
      const c = mix(stops[s][1], stops[s + 1][1], u);
      lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2];
    }

    // ---- sources (normalised card space; nx,ny ~[0,1], may stray off-card) ----
    const mk = (nx, ny, col) => ({ nx, ny, tx: nx, ty: ny, vx: 0, vy: 0, r: 7, rv: 0, col });
    const src = [mk(0.36, 0.5, AMBER), mk(0.64, 0.5, CORAL)];
    let grab = -1;                 // index of grabbed source, or -1
    let hov = -1;                  // nearest source under a hover, or -1
    let lam = 0.11, lamT = 0.11;   // wavelength (fraction of min dim), eased
    let phase = 0;                 // ωt carrier phase (kept in [0,TAU))
    let flash = 0;                 // wheel / dbl feedback glow
    const OMEGA = 5.0;             // carrier angular frequency

    // nearest source to a normalised point, distance measured in card px
    function nearest(nx, ny, W, H) {
      let bi = -1, bd = Infinity;
      for (let i = 0; i < 2; i++) {
        const dx = (src[i].nx - nx) * W, dy = (src[i].ny - ny) * H;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; bi = i; }
      }
      return { i: bi, d: Math.sqrt(bd) };
    }

    return {
      draw(t, dt) {
        const W = Math.max(1, env.w), H = Math.max(1, env.h), mn = Math.max(1, Math.min(W, H));
        const inv = 1 / mn;

        // ease wavelength (with a slow breath), decay flash, advance carrier
        lam += (lamT - lam) * (1 - Math.pow(0.005, dt));
        flash *= Math.pow(0.03, dt);
        phase = (phase + OMEGA * dt) % TAU;
        const lamEff = lam * (1 + 0.045 * sinL(t * 0.5));
        const kHalf = Math.PI / Math.max(0.02, lamEff);          // k/2
        const gain = 0.94 + 0.06 * sinL(t * 0.6 + 1.3);          // gentle field breath
        const A = 0.65 * gain, Bamp = 0.35 * gain;               // b = vis·(A + Bamp·carrier)

        // springs: tight to the finger while grabbed, loose & wobbly at rest
        for (let i = 0; i < 2; i++) {
          const S = src[i], held = grab === i;
          const k = held ? 190 : 70, damp = held ? 22 : 11;
          S.vx += ((S.tx - S.nx) * k - S.vx * damp) * dt;
          S.vy += ((S.ty - S.ny) * k - S.vy * damp) * dt;
          const sp = Math.hypot(S.vx, S.vy);
          if (sp > 16) { S.vx *= 16 / sp; S.vy *= 16 / sp; }     // stay sane on wild drags
          S.nx += S.vx * dt; S.ny += S.vy * dt;
          const rBase = Math.max(5, mn * 0.03);
          const rT = rBase * (held ? 1.7 : hov === i ? 1.25 : 1);
          S.rv += ((rT - S.r) * 220 - S.rv * 15) * dt;
          S.r += S.rv * dt;
          if (S.r < 2) S.r = 2;
        }

        // ---- render the interference field into the small buffer ----
        const s0px = src[0].nx * W, s0py = src[0].ny * H;
        const s1px = src[1].nx * W, s1py = src[1].ny * H;
        for (let by = 0; by < BH; by++) {
          const yc = (by / (BH - 1)) * H;
          const dy0 = yc - s0py, dy0s = dy0 * dy0;
          const dy1 = yc - s1py, dy1s = dy1 * dy1;
          let o = by * BW * 4;
          for (let bx = 0; bx < BW; bx++, o += 4) {
            const xc = uArr[bx] * W;
            const dx0 = xc - s0px, dx1 = xc - s1px;
            const d0 = Math.sqrt(dx0 * dx0 + dy0s) * inv;         // dist to source 0 (min-dim units)
            const d1 = Math.sqrt(dx1 * dx1 + dy1s) * inv;
            // sin(k·d0−ωt)+sin(k·d1−ωt) = 2·cos(kΔ/2)·sin(kΣ/2−ωt):
            //   cos term is the stationary fringe visibility, sin term the moving crest
            const pd = kHalf * (d0 - d1);
            const sm = kHalf * (d0 + d1) - phase;
            const vis = Math.abs(sinT[(((pd + HALF_PI) * L2I) | 0) & LMASK]);
            let b = vis * (A + Bamp * sinT[((sm * L2I) | 0) & LMASK]);
            let bi = (b * 255) | 0;
            if (bi < 0) bi = 0; else if (bi > 255) bi = 255;
            const k3 = bi * 3;
            px[o] = lut[k3]; px[o + 1] = lut[k3 + 1]; px[o + 2] = lut[k3 + 2];
          }
        }
        octx.putImageData(img, 0, 0);

        // ---- paint the card: field first, then the source markers ----
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.imageSmoothingEnabled = true;
        g.drawImage(oc, 0, 0, BW, BH, 0, 0, W, H);

        g.lineJoin = 'round'; g.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
          const S = src[i], cx = S.nx * W, cy = S.ny * H, r = S.r, col = S.col;
          // layered translucent halo (glow without shadowBlur)
          g.fillStyle = rgba(col, 0.13); g.beginPath(); g.arc(cx, cy, r * 3.4, 0, TAU); g.fill();
          g.fillStyle = rgba(col, 0.24); g.beginPath(); g.arc(cx, cy, r * 2.0, 0, TAU); g.fill();
          // outer ring — brightens on grab / wheel feedback
          g.strokeStyle = rgba(col, Math.min(1, 0.5 + flash * 0.35 + (grab === i ? 0.25 : 0)));
          g.lineWidth = Math.max(2, r * 0.34);
          g.beginPath(); g.arc(cx, cy, r + Math.max(3, r * 0.7), 0, TAU); g.stroke();
          // solid core + a cream glint so the emitter reads as bright
          g.fillStyle = rgba(col, 1); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
          g.fillStyle = rgba(CREAM, 0.9); g.beginPath(); g.arc(cx - r * 0.22, cy - r * 0.22, r * 0.4, 0, TAU); g.fill();
        }
      },

      down(p) {
        const W = Math.max(1, env.w), H = Math.max(1, env.h), mn = Math.max(1, Math.min(W, H));
        const n = nearest(p.x / W, p.y / H, W, H);
        if (n.i >= 0 && n.d < Math.max(24, mn * 0.18)) {
          grab = n.i;
          src[grab].tx = p.x / W; src[grab].ty = p.y / H;
          src[grab].rv += 60;                                    // first-frame pop
        }
      },
      move(p) {
        const W = Math.max(1, env.w), H = Math.max(1, env.h);
        if (grab >= 0 && p.held) {
          src[grab].tx = Math.max(-0.4, Math.min(1.4, p.x / W));
          src[grab].ty = Math.max(-0.4, Math.min(1.4, p.y / H));
        } else if (!p.held) {
          const n = nearest(p.x / W, p.y / H, W, H);
          hov = n.d < Math.max(30, Math.min(W, H) * 0.22) ? n.i : -1;
        }
      },
      up() {
        if (grab >= 0) { src[grab].tx = src[grab].nx; src[grab].ty = src[grab].ny; }  // settle in place
        grab = -1;
      },
      leave() { hov = -1; },
      wheel(dy) {
        lamT = Math.max(0.05, Math.min(0.22, lamT + dy * 0.0004));  // retune wavelength
        flash = 1;
      },
      dbl(p) {
        lamT = 0.11; flash = 1;                                  // snap tuning home, with a flourish
        const W = Math.max(1, env.w), H = Math.max(1, env.h);
        const n = nearest(p.x / W, p.y / H, W, H);
        if (n.i >= 0) {
          src[n.i].vx += (Math.random() - 0.5) * 6;
          src[n.i].vy += (Math.random() - 0.5) * 6;
          src[n.i].rv += 40;
        }
      },
      resize() {
        // normalised coords need no rescale; just keep the sources on-card
        for (let i = 0; i < 2; i++) {
          const S = src[i];
          S.nx = Math.max(-0.2, Math.min(1.2, S.nx));
          S.ny = Math.max(-0.2, Math.min(1.2, S.ny));
          S.tx = Math.max(-0.2, Math.min(1.2, S.tx));
          S.ty = Math.max(-0.2, Math.min(1.2, S.ty));
        }
      },
    };
  },
});
