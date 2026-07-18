/* № 28 — Magnifier. A round glass you drag across a bold dot-lattice. Under
   the lens the lattice bulges through a barrel/fisheye map: source dots inside
   a sampling disk are pushed radially outward and swollen by a local
   magnification that peaks at the center, clipped to the glass and dressed
   with a cream rim, a sky tint and a specular glare. Idle: the lens glides on
   a slow Lissajous while the lattice drifts and twinkles. Scroll to zoom. */
F.register({
  n: 28, id: 'lens', cat: 'optics',
  title: 'Magnifier', hint: 'Drag the lens over the grid',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const amber = inks[0], mint = inks[2];      // the lattice
    const B = 0.5;                              // barrel strength (edge squeeze)

    // Per-cell twinkle phases — one fixed table, indexed by grid coords mod 32,
    // so it never reallocates on resize and every dot keeps a stable shimmer.
    const PN = 32;
    const phase = new Float32Array(PN * PN);
    for (let i = 0; i < phase.length; i++) phase[i] = Math.random() * TAU;

    // Scratch for the magnified dots — computed once per frame, drawn by color.
    const MAXM = 512;
    const mX = new Float32Array(MAXM), mY = new Float32Array(MAXM);
    const mR = new Float32Array(MAXM), mP = new Uint8Array(MAXM);

    let lx = env.w * 0.5, ly = env.h * 0.44;   // lens center
    let lvx = 0, lvy = 0;                       // its spring velocity
    let zoom = 2.1, zoomT = 2.1, zv = 0;        // center magnification (eased)
    let held = false, px = 0, py = 0;           // pointer while dragging
    let hov = null;                             // pointer while hovering
    let pop = 0;                                // grab-pop feedback
    let flash = 0;                              // wheel feedback glow
    const idleA = Math.random() * TAU, idleB = Math.random() * TAU;

    return {
      draw(t, dt) {
        const w = env.w, h = env.h, m = Math.min(w, h);
        const gap = Math.max(18, Math.min(34, m * 0.072));
        const R = m * 0.29;
        const baseR = Math.max(2, Math.min(4, gap * 0.15));

        // --- eased zoom (a springy detune with overshoot) & decaying pulses ---
        zv += ((zoomT - zoom) * 190 - zv * 17) * dt;
        zoom += zv * dt;
        if (zoom < 1.3) { zoom = 1.3; if (zv < 0) zv = 0; }
        if (zoom > 4.5) { zoom = 4.5; if (zv > 0) zv = 0; }
        flash *= Math.pow(0.02, dt);
        pop *= Math.pow(0.015, dt);

        // --- lens target: the finger when held, else a slow orbit that leans
        //     toward a hovering cursor so the sweet-spot never stops gliding ---
        let tx, ty;
        if (held) { tx = px; ty = py; }
        else {
          tx = w * 0.5 + Math.cos(idleA + t * 0.19) * m * 0.19;
          ty = h * 0.5 + Math.sin(idleB + t * 0.15) * m * 0.15;
          if (hov) { tx += (hov.x - tx) * 0.25; ty += (hov.y - ty) * 0.25; }
        }
        tx = Math.max(-0.04 * w, Math.min(1.04 * w, tx));
        ty = Math.max(-0.04 * h, Math.min(1.04 * h, ty));
        // Tight, snappy spring on the finger; loose and wobbly gliding home.
        const k = held ? 220 : 26, dmp = held ? 27 : 8;
        lvx += ((tx - lx) * k - lvx * dmp) * dt;
        lvy += ((ty - ly) * k - lvy * dmp) * dt;
        const sp = Math.hypot(lvx, lvy) + 1e-6;
        if (sp > 4200) { lvx *= 4200 / sp; lvy *= 4200 / sp; }
        lx += lvx * dt; ly += lvy * dt;
        lx = Math.max(-0.12 * w, Math.min(1.12 * w, lx));
        ly = Math.max(-0.12 * h, Math.min(1.12 * h, ly));

        // Lattice sways gently (oscillates, never scrolls away).
        const driftX = Math.sin(t * 0.08) * gap * 0.35 + Math.cos(t * 0.05) * gap * 0.12;
        const driftY = Math.cos(t * 0.07) * gap * 0.35 + Math.sin(t * 0.06) * gap * 0.12;

        // --- clear ---
        g.fillStyle = bg;
        g.fillRect(0, 0, w, h);

        // --- base lattice: bold checkerboard dots, size-twinkling ---
        const cols = Math.ceil(w / gap) + 3, rows = Math.ceil(h / gap) + 3;
        g.globalAlpha = 0.82;
        g.beginPath();                                   // amber sublattice
        for (let i = -2; i < cols; i++) for (let j = -2; j < rows; j++) {
          if (((i + j) & 1) !== 0) continue;
          const x = i * gap + driftX, y = j * gap + driftY;
          const tw = Math.sin(t * 1.25 + phase[(i & 31) * 32 + (j & 31)]);
          const r = baseR * (0.72 + 0.2 * tw);
          g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU);
        }
        g.fillStyle = amber; g.fill();
        g.beginPath();                                   // mint sublattice
        for (let i = -2; i < cols; i++) for (let j = -2; j < rows; j++) {
          if (((i + j) & 1) === 0) continue;
          const x = i * gap + driftX, y = j * gap + driftY;
          const tw = Math.sin(t * 1.25 + phase[(i & 31) * 32 + (j & 31)]);
          const r = baseR * (0.72 + 0.2 * tw);
          g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU);
        }
        g.fillStyle = mint; g.fill();
        g.beginPath();                                   // roaming cream sparkle
        for (let i = -2; i < cols; i++) for (let j = -2; j < rows; j++) {
          const tw = Math.sin(t * 1.25 + phase[(i & 31) * 32 + (j & 31)]);
          if (tw < 0.72) continue;
          const x = i * gap + driftX, y = j * gap + driftY, r = baseR * 0.5;
          g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU);
        }
        g.fillStyle = 'rgba(242,233,220,0.5)'; g.fill();
        g.globalAlpha = 1;

        // --- forward fisheye: gather source dots inside the sampling disk,
        //     push each outward and swell it by the local magnification ---
        const Rr = R * (1 + pop * 0.05);                 // lens radius (grab-pop)
        const denom = zoom * (1 - B / 3);
        const Rs = Rr / (denom + 1e-6);                  // source sampling radius
        let mn = 0;
        const i0 = Math.floor((lx - Rs - driftX) / gap) - 1;
        const i1 = Math.ceil((lx + Rs - driftX) / gap) + 1;
        const j0 = Math.floor((ly - Rs - driftY) / gap) - 1;
        const j1 = Math.ceil((ly + Rs - driftY) / gap) + 1;
        for (let i = i0; i <= i1 && mn < MAXM; i++)
          for (let j = j0; j <= j1 && mn < MAXM; j++) {
            const x = i * gap + driftX, y = j * gap + driftY;
            const dx = x - lx, dy = y - ly;
            const d = Math.hypot(dx, dy);
            if (d > Rs) continue;
            const u = d / (Rs + 1e-6);
            const sr = Rr * (u - B * u * u * u / 3) / (1 - B / 3); // barrel radius
            const inv = d > 1e-4 ? 1 / d : 0;
            const mag = zoom * (1 - B * u * u);                    // local zoom
            const tw = Math.sin(t * 1.25 + phase[(i & 31) * 32 + (j & 31)]);
            mX[mn] = lx + dx * inv * sr;
            mY[mn] = ly + dy * inv * sr;
            mR[mn] = Math.max(1, Math.min(20, baseR * mag * (0.85 + 0.12 * tw)));
            mP[mn] = (i + j) & 1;
            mn++;
          }

        // --- the glass: everything inside the rim, clipped to the circle ---
        g.save();
        g.beginPath(); g.arc(lx, ly, Rr, 0, TAU); g.clip();
        g.fillStyle = bg;                                // clean magnified field
        g.fillRect(lx - Rr - 1, ly - Rr - 1, Rr * 2 + 2, Rr * 2 + 2);
        // subtle sky tint, lit from the upper-left
        const tint = g.createRadialGradient(
          lx - Rr * 0.35, ly - Rr * 0.35, Rr * 0.15, lx, ly, Rr * 1.02);
        tint.addColorStop(0, 'rgba(88,166,242,0)');
        tint.addColorStop(0.7, 'rgba(88,166,242,0.05)');
        tint.addColorStop(1, 'rgba(88,166,242,0.16)');
        g.fillStyle = tint;
        g.fillRect(lx - Rr, ly - Rr, Rr * 2, Rr * 2);
        g.beginPath();                                   // magnified amber
        for (let q = 0; q < mn; q++) if (mP[q] === 0) {
          g.moveTo(mX[q] + mR[q], mY[q]); g.arc(mX[q], mY[q], mR[q], 0, TAU);
        }
        g.fillStyle = amber; g.fill();
        g.beginPath();                                   // magnified mint
        for (let q = 0; q < mn; q++) if (mP[q] === 1) {
          g.moveTo(mX[q] + mR[q], mY[q]); g.arc(mX[q], mY[q], mR[q], 0, TAU);
        }
        g.fillStyle = mint; g.fill();
        g.beginPath();                                   // specular on each dot
        for (let q = 0; q < mn; q++) {
          const cr = mR[q] * 0.34; if (cr < 0.8) continue;
          const cx = mX[q] - mR[q] * 0.28, cy = mY[q] - mR[q] * 0.28;
          g.moveTo(cx + cr, cy); g.arc(cx, cy, cr, 0, TAU);
        }
        g.fillStyle = 'rgba(242,233,220,' + (0.5 + flash * 0.3).toFixed(3) + ')';
        g.fill();
        // glare: two crescents hugging the upper-left inner rim + a soft spot
        g.lineCap = 'round';
        g.strokeStyle = 'rgba(242,233,220,0.30)';
        g.lineWidth = Math.max(3, Rr * 0.06);
        g.beginPath(); g.arc(lx, ly, Rr * 0.82, Math.PI * 1.05, Math.PI * 1.5); g.stroke();
        g.strokeStyle = 'rgba(242,233,220,0.16)';
        g.lineWidth = Math.max(2, Rr * 0.03);
        g.beginPath(); g.arc(lx, ly, Rr * 0.64, Math.PI * 1.1, Math.PI * 1.44); g.stroke();
        const sx = lx - Rr * 0.34, sy = ly - Rr * 0.4;
        const spot = g.createRadialGradient(sx, sy, 0, sx, sy, Rr * 0.26);
        spot.addColorStop(0, 'rgba(242,233,220,0.5)');
        spot.addColorStop(1, 'rgba(242,233,220,0)');
        g.fillStyle = spot;
        g.beginPath(); g.arc(sx, sy, Rr * 0.26, 0, TAU); g.fill();
        g.restore();

        // --- rim: soft sky halo, bright cream edge, sky inner line, highlight ---
        const glow = 0.5 + pop * 0.4 + (held ? 0.2 : 0) + 0.12 * Math.sin(t * 1.6);
        const edge = Math.max(2.5, Rr * 0.045);
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.strokeStyle = 'rgba(88,166,242,' + (0.1 + glow * 0.1).toFixed(3) + ')';
        g.lineWidth = Math.max(7, Rr * 0.14);
        g.beginPath(); g.arc(lx, ly, Rr, 0, TAU); g.stroke();
        g.strokeStyle = 'rgba(242,233,220,' + (0.78 + glow * 0.2).toFixed(3) + ')';
        g.lineWidth = edge;
        g.beginPath(); g.arc(lx, ly, Rr, 0, TAU); g.stroke();
        g.strokeStyle = 'rgba(88,166,242,0.45)';
        g.lineWidth = Math.max(1.4, Rr * 0.02);
        g.beginPath(); g.arc(lx, ly, Rr - edge, 0, TAU); g.stroke();
        g.strokeStyle = 'rgba(242,233,220,' + (0.7 + glow * 0.3).toFixed(3) + ')';
        g.lineWidth = Math.max(2.5, Rr * 0.05);
        g.beginPath(); g.arc(lx, ly, Rr, Math.PI * 1.05, Math.PI * 1.45); g.stroke();
      },

      down(p) { held = true; px = p.x; py = p.y; hov = null; pop = 1; },
      move(p) {
        if (p.held) { held = true; px = p.x; py = p.y; }
        else { held = false; hov = { x: p.x, y: p.y }; }
      },
      up() { held = false; hov = null; },
      wheel(dy) {
        zoomT = Math.max(1.4, Math.min(4.2, zoomT - dy * 0.0016));
        flash = 1;
      },
      dbl() { zoomT = 2.1; flash = 1; if (pop < 0.7) pop = 0.7; },
      leave() { hov = null; held = false; },
    };
  },
});
