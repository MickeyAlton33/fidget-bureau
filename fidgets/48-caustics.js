/* № 48 — Caustics. The bright, shifting web of light on a sunlit pool floor.
   A handful of slow sine "flows" stand in for the water surface acting as a
   lens: their summed displacement folds a fine light-grid onto itself, and
   where the folds pile up — each line stroked additively — the caustic net
   glows. Drag to disturb the surface: ripples race out from your finger and
   bend the web along their crests. Soft god-rays sink from above. No second
   canvas, no per-pixel loop — just additive strokes over a deep-water floor. */
F.register({
  n: 48, id: 'caustics', cat: 'optics',
  title: 'Caustics', hint: 'Ripple the water — light dances below',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;

    // The morphing surface: a few slow longitudinal sine flows whose sum
    // compresses the light map into caustic folds. Seeded once so the idle
    // motion is stable and never flickers.
    const waves = [];
    const NW = 5;
    let sumA = 0;
    for (let k = 0; k < NW; k++) {
      const ang = Math.random() * TAU;
      const a = 0.6 + Math.random() * 0.7;
      sumA += a;
      waves.push({
        cx: Math.cos(ang), cy: Math.sin(ang),          // propagation direction
        fRel: 0.45 + Math.random() * 1.05,             // wavelength ÷ card size
        w: (0.14 + Math.random() * 0.34) * (Math.random() < 0.5 ? -1 : 1),
        ph: Math.random() * TAU, aN: 0, f: 0,
      });
    }
    for (const wv of waves) wv.aN = (0.6 + Math.random() * 0.7) / sumA; // normalized

    // Ripples: expanding crests from the pointer that warp the web.
    const MAXR = 8;
    const ripples = [];
    function addRipple(x, y, amp, spd) {
      const W = Math.max(14, sp * 0.55);
      ripples.push({
        x, y, age: 0, amp, spd, R: 0, curAmp: amp,
        W, band: W * 2.6, inv2: 1 / (W * W), kk: TAU / (W * 2.4),
      });
      if (ripples.length > MAXR) ripples.splice(0, ripples.length - MAXR);
    }

    // Warped light-grid buffers, sized in sizeGrid() / resize().
    let sp = 40, baseAmp = 30;
    let nH = 0, nHS = 0, nV = 0, nVS = 0, stepH = 0, stepV = 0, gx0 = 0, gy0 = 0;
    let hx, hy, vx, vy, builtW = 0, builtH = 0;

    function sizeGrid() {
      const w = Math.max(1, env.w), h = Math.max(1, env.h), m = Math.min(w, h);
      sp = m / 8;
      baseAmp = sp * 0.9;                              // enough to fold the grid
      for (const wv of waves) wv.f = TAU / (m * wv.fRel);
      const margin = sp * 1.6;                         // cover corners when warped
      gx0 = -margin; gy0 = -margin;
      const spanW = w + margin * 2, spanH = h + margin * 2;
      stepH = stepV = sp / 2.6;                        // sample finer than spacing
      nH = Math.ceil(spanH / sp) + 1;
      nV = Math.ceil(spanW / sp) + 1;
      nHS = Math.ceil(spanW / stepH) + 1;
      nVS = Math.ceil(spanH / stepV) + 1;
      hx = new Float32Array(nH * nHS); hy = new Float32Array(nH * nHS);
      vx = new Float32Array(nV * nVS); vy = new Float32Array(nV * nVS);
      builtW = env.w; builtH = env.h;
    }
    sizeGrid();

    // The pool is already alive on first sight.
    addRipple(env.w * 0.40, env.h * 0.36, 9, 140);
    addRipple(env.w * 0.66, env.h * 0.62, 7, 120);
    let ambient = 1.8;

    // Displacement of the light map at (x, y), written into D (reused).
    const D = [0, 0];
    let frameAmp = baseAmp;
    function disp(x, y, t) {
      let ex = 0, ey = 0;
      for (let k = 0; k < waves.length; k++) {
        const wv = waves[k];
        const s = Math.sin((x * wv.cx + y * wv.cy) * wv.f + wv.w * t + wv.ph);
        ex += wv.aN * s * wv.cx;
        ey += wv.aN * s * wv.cy;
      }
      ex *= frameAmp; ey *= frameAmp;
      for (let k = 0; k < ripples.length; k++) {
        const r = ripples[k];
        const dx = x - r.x, dy = y - r.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
        const e = d - r.R;
        if (e < -r.band || e > r.band) continue;       // outside the crest band
        const dv = r.curAmp * Math.exp(-e * e * r.inv2) * Math.cos(e * r.kk);
        ex += dv * dx / d; ey += dv * dy / d;
      }
      if (ex > 260) ex = 260; else if (ex < -260) ex = -260;
      if (ey > 260) ey = 260; else if (ey < -260) ey = -260;
      D[0] = ex; D[1] = ey;
    }

    // Each line is its own stroke so converging lines stack additively into
    // bright caustic filaments (a single path would just union, not brighten).
    function strokeFamily(px, py, nLines, nSamp, style) {
      g.strokeStyle = style;
      for (let j = 0; j < nLines; j++) {
        let idx = j * nSamp;
        g.beginPath();
        g.moveTo(px[idx], py[idx]);
        for (let i = 1; i < nSamp; i++) { idx++; g.lineTo(px[idx], py[idx]); }
        g.stroke();
      }
    }

    let glow = 0, glowX = 0, glowY = 0, lastX = 0, lastY = 0, dragAcc = 0, have = false;

    return {
      draw(t, dt) {
        if (env.w !== builtW || env.h !== builtH) sizeGrid();
        const w = env.w, h = env.h, m = Math.min(w, h), diag = Math.hypot(w, h);

        // Advance + cull ripples in place (no per-frame allocation).
        let n = 0;
        for (let i = 0; i < ripples.length; i++) {
          const r = ripples[i];
          r.age += dt;
          r.R = r.spd * r.age;
          r.curAmp = r.amp * Math.exp(-r.age * 1.5);
          if (r.curAmp > 0.25 && r.R < diag * 1.3) ripples[n++] = r;
        }
        ripples.length = n;

        // A gentle disturbance now and then so idle water keeps breathing.
        ambient -= dt;
        if (ambient <= 0) {
          addRipple(w * (0.15 + Math.random() * 0.7), h * (0.15 + Math.random() * 0.7),
            5 + Math.random() * 4, 110 + Math.random() * 50);
          ambient = 2.6 + Math.random() * 2.4;
        }

        glow *= Math.pow(0.05, dt);
        frameAmp = baseAmp * (0.82 + 0.18 * Math.sin(t * 0.3));   // slow breath

        // Warp the light-grid.
        for (let j = 0; j < nH; j++) {
          const by = gy0 + j * sp; let idx = j * nHS;
          for (let i = 0; i < nHS; i++) {
            const bx = gx0 + i * stepH; disp(bx, by, t);
            hx[idx] = bx + D[0]; hy[idx] = by + D[1]; idx++;
          }
        }
        for (let j = 0; j < nV; j++) {
          const bx = gx0 + j * sp; let idx = j * nVS;
          for (let i = 0; i < nVS; i++) {
            const by = gy0 + i * stepV; disp(bx, by, t);
            vx[idx] = bx + D[0]; vy[idx] = by + D[1]; idx++;
          }
        }

        // Floor: warm ground with a deep pool of blue sunk into the middle.
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        const fg = g.createRadialGradient(w * 0.5, h * 0.42, m * 0.04,
          w * 0.5, h * 0.52, diag * 0.62);
        fg.addColorStop(0, 'rgba(34,74,92,0.55)');
        fg.addColorStop(1, 'rgba(34,74,92,0)');
        g.fillStyle = fg; g.fillRect(0, 0, w, h);

        // From here down it is all light — add it.
        g.globalCompositeOperation = 'lighter';
        g.lineJoin = 'round'; g.lineCap = 'round';

        // God-rays sinking from the surface, swaying slowly.
        for (let i = 0; i < 3; i++) {
          const cx = ((i + 0.5) / 3 + Math.sin(t * 0.13 + i * 2.2) * 0.07) * w;
          const tw = m * 0.02, bw = m * 0.17;
          const rg = g.createLinearGradient(0, 0, 0, h);
          rg.addColorStop(0, 'rgba(120,190,245,0.10)');
          rg.addColorStop(1, 'rgba(120,190,245,0)');
          g.fillStyle = rg;
          g.beginPath();
          g.moveTo(cx - tw, 0); g.lineTo(cx + tw, 0);
          g.lineTo(cx + bw, h); g.lineTo(cx - bw, h);
          g.closePath(); g.fill();
        }

        // The caustic web: a soft coloured halo, then a hot cream core.
        g.lineWidth = Math.max(2.4, m * 0.014);
        strokeFamily(hx, hy, nH, nHS, 'rgba(88,166,242,0.055)');   // sky halo
        strokeFamily(vx, vy, nV, nVS, 'rgba(79,201,160,0.055)');   // mint halo
        g.lineWidth = Math.max(1.1, m * 0.006);
        strokeFamily(hx, hy, nH, nHS, 'rgba(242,233,220,0.09)');   // cream core
        strokeFamily(vx, vy, nV, nVS, 'rgba(242,233,220,0.09)');

        // Travelling crests, faint and minty, so a disturbance reads at once.
        for (let i = 0; i < ripples.length; i++) {
          const r = ripples[i];
          const a = Math.min(0.22, r.curAmp * 0.018);
          if (r.R < 3 || a < 0.01) continue;
          g.strokeStyle = 'rgba(150,222,205,' + a.toFixed(3) + ')';
          g.lineWidth = Math.max(1.5, r.W * 0.22);
          g.beginPath(); g.arc(r.x, r.y, r.R, 0, TAU); g.stroke();
        }

        // Light gathering under the fingertip — springs up on touch, fades.
        if (glow > 0.01) {
          const rad = Math.max(9, m * 0.13), a = Math.min(0.5, glow * 0.5);
          const bl = g.createRadialGradient(glowX, glowY, 0, glowX, glowY, rad);
          bl.addColorStop(0, 'rgba(242,233,220,' + a.toFixed(3) + ')');
          bl.addColorStop(1, 'rgba(242,233,220,0)');
          g.fillStyle = bl;
          g.beginPath(); g.arc(glowX, glowY, rad, 0, TAU); g.fill();
        }

        g.globalCompositeOperation = 'source-over';
      },

      down(p) {
        addRipple(p.x, p.y, 22, 165);
        glow = 1; glowX = p.x; glowY = p.y;
        lastX = p.x; lastY = p.y; dragAcc = 0; have = true;
      },
      move(p) {
        if (!p.held) { have = false; return; }
        if (!have) { lastX = p.x; lastY = p.y; have = true; }
        dragAcc += Math.hypot(p.x - lastX, p.y - lastY);
        glow = Math.min(1, glow + 0.6); glowX = p.x; glowY = p.y;
        if (dragAcc > sp * 0.5) { addRipple(p.x, p.y, 15, 158); dragAcc = 0; }
        lastX = p.x; lastY = p.y;
      },
      up() { have = false; dragAcc = 0; },
      dbl(p) { addRipple(p.x, p.y, 34, 205); glow = 1; glowX = p.x; glowY = p.y; },
      leave() { have = false; dragAcc = 0; },
      resize() { sizeGrid(); },
    };
  },
});
