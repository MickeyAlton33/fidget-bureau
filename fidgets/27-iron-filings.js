/* № 27 — Iron filings. The classic tray: a two-tone bar magnet rides over a
   field of iron filings. Each filing springs its angle toward the local dipole
   field of the two poles and grows bright where the field is strong, so glowing
   whiskers bunch into field-line arcs between the poles. Idle: the magnet drifts
   and slowly turns so the whole field shimmers. Drag to steer it; scroll to
   stretch the bar; double-click to shake the tray. */
F.register({
  n: 27, id: 'iron-filings', cat: 'matter',
  title: 'Iron filings', hint: 'Drag the magnet — filings snap to the field',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const COLS = 22, ROWS = 22, N = COLS * ROWS;
    const NB = 8;                 // alpha/width buckets for batched stroking

    // Fixed per-filing buffers — allocated ONCE, positions rebuilt on resize.
    const fx = new Float32Array(N), fy = new Float32Array(N);
    const ffade = new Float32Array(N);           // radial edge-fade, constant
    const fang = new Float32Array(N), fvel = new Float32Array(N);
    const flen = new Float32Array(N);
    const fb = new Uint8Array(N);                 // bucket index per frame
    const fjx = new Float32Array(N), fjy = new Float32Array(N); // stable jitter
    for (let i = 0; i < N; i++) {
      fjx[i] = (Math.random() - 0.5) * 0.7;
      fjy[i] = (Math.random() - 0.5) * 0.7;
    }

    // palette helpers
    function px2(h) { const n = parseInt(h.slice(1), 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }
    const CR = px2(inks[5]);                       // cream, for filings/labels
    const AM = px2(inks[0]);                        // amber, for the aura
    function creamA(a) { return 'rgba(' + CR.r + ',' + CR.g + ',' + CR.b + ',' + a + ')'; }
    const bucketCol = [], bucketW = [];
    for (let b = 0; b < NB; b++) {
      bucketCol[b] = creamA(Math.min(1, (b + 0.85) / NB).toFixed(3));
      bucketW[b] = 1.5 + 1.5 * (b / (NB - 1));
    }
    const haloIn = 'rgba(' + AM.r + ',' + AM.g + ',' + AM.b + ',0.16)';
    const haloOut = 'rgba(' + AM.r + ',' + AM.g + ',' + AM.b + ',0)';

    // magnet + interaction state
    let mx = env.w * 0.5, my = env.h * 0.5, mvx = 0, mvy = 0;
    let mAng = Math.random() * TAU;
    let magLenScale = 1, pop = 1, spacing = 12;
    let dragging = false, held = false;
    let px = mx, py = my;

    const MAG_K = 155, MAG_C = 18;    // magnet centre spring
    const ANG_K = 100, ANG_C = 11;    // filing angle spring (under-damped)
    const INV_PEAK = 1 / 200;         // strength → 0..1 (scale-invariant)

    function layout() {
      const w = env.w, h = env.h;
      const m = 0.05, x0 = w * m, y0 = h * m;
      const sx = (w * (1 - 2 * m)) / (COLS - 1), sy = (h * (1 - 2 * m)) / (ROWS - 1);
      spacing = Math.min(sx, sy);
      const cx = w * 0.5, cy = h * 0.5, maxR = 0.62 * Math.max(1, Math.min(w, h));
      let i = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = x0 + (c + fjx[i]) * sx, y = y0 + (r + fjy[i]) * sy;
          fx[i] = x; fy[i] = y;
          let f = 1.15 - Math.hypot(x - cx, y - cy) / maxR;
          ffade[i] = f < 0 ? 0 : (f > 1 ? 1 : f);
          i++;
        }
      }
    }

    function seedAngles() {                 // paint a correct field on frame 1
      const md = Math.max(1, Math.min(env.w, env.h));
      const hl = 0.215 * md * magLenScale, pd = 0.62 * hl;
      const ux = Math.cos(mAng), uy = Math.sin(mAng);
      const Nx = mx + ux * pd, Ny = my + uy * pd, Sx = mx - ux * pd, Sy = my - uy * pd;
      const Q = md * md, sf = (0.045 * md) * (0.045 * md);
      for (let i = 0; i < N; i++) {
        const dnx = fx[i] - Nx, dny = fy[i] - Ny, rn2 = dnx * dnx + dny * dny + sf;
        const dsx = fx[i] - Sx, dsy = fy[i] - Sy, rs2 = dsx * dsx + dsy * dsy + sf;
        const iN = Q / (rn2 * Math.sqrt(rn2)), iS = Q / (rs2 * Math.sqrt(rs2));
        const Bx = dnx * iN - dsx * iS, By = dny * iN - dsy * iS;
        const str = Math.sqrt(Bx * Bx + By * By);
        fang[i] = Math.atan2(By, Bx) + (Math.random() - 0.5) * 0.5;
        fvel[i] = 0;
        const br = Math.sqrt(str * INV_PEAK > 1 ? 1 : str * INV_PEAK);
        flen[i] = spacing * (0.28 + 0.66 * br);
      }
    }
    layout();
    seedAngles();

    function drawMagnet(halfLen, halfThick) {
      const ux = Math.cos(mAng), uy = Math.sin(mAng);
      const r = halfThick, bx = Math.max(halfLen, r + 2);
      g.save();
      g.translate(mx, my);
      g.rotate(mAng);
      g.scale(pop, 1 / Math.sqrt(pop));
      const stad = () => {
        g.beginPath();
        g.moveTo(-bx + r, -r);
        g.lineTo(bx - r, -r);
        g.arc(bx - r, 0, r, -Math.PI / 2, Math.PI / 2);
        g.lineTo(-bx + r, r);
        g.arc(-bx + r, 0, r, Math.PI / 2, Math.PI * 1.5);
        g.closePath();
      };
      g.save(); g.beginPath(); g.rect(-bx - 4, -r - 4, bx + 4, (r + 4) * 2); g.clip();
      stad(); g.fillStyle = inks[3]; g.fill(); g.restore();          // S half — sky
      g.save(); g.beginPath(); g.rect(0, -r - 4, bx + 4, (r + 4) * 2); g.clip();
      stad(); g.fillStyle = inks[1]; g.fill(); g.restore();          // N half — coral
      g.strokeStyle = 'rgba(20,16,13,0.55)'; g.lineWidth = 2;         // pole seam
      g.beginPath(); g.moveTo(0, -r * 0.78); g.lineTo(0, r * 0.78); g.stroke();
      if (held) { stad(); g.strokeStyle = creamA(0.55); g.lineWidth = 2.5; g.stroke(); }
      g.restore();
      // upright pole labels in world space
      const lp = bx * 0.52;
      g.font = '700 ' + Math.max(9, r * 0.95 | 0) + 'px ui-monospace, Menlo, monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = creamA(0.9);
      g.fillText('N', mx + ux * lp, my + uy * lp);
      g.fillText('S', mx - ux * lp, my - uy * lp);
    }

    return {
      draw(t, dt) {
        const w = env.w, h = env.h, md = Math.max(1, Math.min(w, h));
        const cx = w * 0.5, cy = h * 0.5;
        const halfLen = 0.215 * md * magLenScale, halfThick = 0.072 * md;
        const poleDist = 0.62 * halfLen;

        // magnet target: pointer while dragging, a drifting Lissajous at idle
        let tx, ty;
        if (dragging) { tx = px; ty = py; }
        else {
          tx = cx + 0.13 * md * Math.sin(t * 0.31) + 0.05 * md * Math.sin(t * 0.19 + 1.3);
          ty = cy + 0.11 * md * Math.sin(t * 0.24 + 0.7) + 0.045 * md * Math.cos(t * 0.15);
        }
        // spring the magnet centre (slight overshoot), clamp for wild drags
        mvx += ((tx - mx) * MAG_K - mvx * MAG_C) * dt;
        mvy += ((ty - my) * MAG_K - mvy * MAG_C) * dt;
        const vm = 9000;
        if (mvx > vm) mvx = vm; else if (mvx < -vm) mvx = -vm;
        if (mvy > vm) mvy = vm; else if (mvy < -vm) mvy = -vm;
        mx += mvx * dt; my += mvy * dt;
        if (!isFinite(mx) || !isFinite(my)) { mx = cx; my = cy; mvx = 0; mvy = 0; }
        mAng += (0.19 + 0.11 * Math.sin(t * 0.1)) * dt;
        if (mAng > TAU) mAng -= TAU; else if (mAng < 0) mAng += TAU;
        pop += (1 - pop) * (1 - Math.pow(0.001, dt));

        // pole positions from the bar's axis
        const ux = Math.cos(mAng), uy = Math.sin(mAng);
        const Nx = mx + ux * poleDist, Ny = my + uy * poleDist;
        const Sx = mx - ux * poleDist, Sy = my - uy * poleDist;
        const Q = md * md, sf = (0.045 * md) * (0.045 * md);
        const lenA = 1 - Math.pow(0.0006, dt);

        // update every filing: spring angle to field, ease length, pick bucket
        for (let i = 0; i < N; i++) {
          const x = fx[i], y = fy[i];
          const dnx = x - Nx, dny = y - Ny, rn2 = dnx * dnx + dny * dny + sf;
          const dsx = x - Sx, dsy = y - Sy, rs2 = dsx * dsx + dsy * dsy + sf;
          const iN = Q / (rn2 * Math.sqrt(rn2)), iS = Q / (rs2 * Math.sqrt(rs2));
          const Bx = dnx * iN - dsx * iS, By = dny * iN - dsy * iS;
          const str = Math.sqrt(Bx * Bx + By * By);
          let d = Math.atan2(By, Bx) - fang[i];
          d -= Math.PI * Math.round(d / Math.PI);   // nearest orientation (mod π)
          let v = fvel[i];
          v += d * ANG_K * dt; v -= v * ANG_C * dt;
          fvel[i] = v; fang[i] += v * dt;
          let s = str * INV_PEAK; if (s > 1) s = 1;
          const br = Math.sqrt(s);
          flen[i] += (spacing * (0.28 + 0.66 * br) - flen[i]) * lenA;
          let a = (0.10 + 0.92 * br) * ffade[i];
          if (a > 1) a = 1; else if (a < 0) a = 0;
          let b = (a * NB) | 0; if (b >= NB) b = NB - 1; else if (b < 0) b = 0;
          fb[i] = b;
        }

        // paint
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        const haloR = halfLen * 1.9 + halfThick;
        const grd = g.createRadialGradient(mx, my, halfThick * 0.5, mx, my, haloR);
        grd.addColorStop(0, haloIn); grd.addColorStop(1, haloOut);
        g.fillStyle = grd;
        g.beginPath(); g.arc(mx, my, haloR, 0, TAU); g.fill();

        g.lineCap = 'round'; g.lineJoin = 'round';
        for (let b = 0; b < NB; b++) {
          g.strokeStyle = bucketCol[b]; g.lineWidth = bucketW[b];
          g.beginPath();
          for (let i = 0; i < N; i++) {
            if (fb[i] !== b) continue;
            const hl = flen[i] * 0.5;
            const c = Math.cos(fang[i]) * hl, s = Math.sin(fang[i]) * hl;
            g.moveTo(fx[i] - c, fy[i] - s); g.lineTo(fx[i] + c, fy[i] + s);
          }
          g.stroke();
        }

        drawMagnet(halfLen, halfThick);
      },
      down(p) { dragging = true; held = true; px = p.x; py = p.y; pop = 1.14; },
      move(p) { px = p.x; py = p.y; if (p.held) { dragging = true; held = true; } else { dragging = false; held = false; } },
      up() { dragging = false; held = false; },
      leave() { dragging = false; held = false; },
      wheel(dy) {
        magLenScale += -dy * 0.0009;
        if (magLenScale < 0.55) magLenScale = 0.55; else if (magLenScale > 1.6) magLenScale = 1.6;
      },
      dbl() {                          // shake the tray: kick the whiskers awhirl
        for (let i = 0; i < N; i++) {
          let k = (Math.random() - 0.5) * 32;
          if (k > 16) k = 16; else if (k < -16) k = -16;
          fvel[i] += k;
        }
        pop = 1.1;
      },
      resize() { layout(); },
    };
  },
});
