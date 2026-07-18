/* № 38 — Spirograph. A wheel rolls inside a fixed ring with a pen hole in it,
   tracing hypotrochoid roses. It draws forever on its own — the bright pen
   sweeps round and the inked trail fades behind it, so the sheet never fills.
   Crank it by dragging round the middle, scroll to swap gears (more/fewer
   petals), double-click for fresh ink on a clean sheet. */
F.register({
  n: 38, id: 'spirograph', cat: 'optics',
  title: 'Spirograph', hint: 'Draw loops — scroll to change the gears',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const hex = (c) => [
      parseInt(c.slice(1, 3), 16),
      parseInt(c.slice(3, 5), 16),
      parseInt(c.slice(5, 7), 16),
    ];
    const pal = inks.map(hex);

    // ── capped pen history, allocated ONCE — a ring buffer in ring-space
    //    (coords are pen / ringRadius, so a resize just rescales them) ──
    const CAP = 640;
    const bx = new Float32Array(CAP);   // pen x, ring-normalized (~ -1..1)
    const by = new Float32Array(CAP);   // pen y, ring-normalized
    const bc = new Float32Array(CAP);   // ink position along the palette
    let head = 0, count = 0;

    // ── motion / mechanism state ──
    const MOTOR = 2.0;      // idle roll speed (rad/s of the wheel's orbit)
    const CRANK = 1.6;      // pointer-orbit → roll gain when dragging
    const MAXSPD = 11;      // flick speed clamp
    const DTH = 0.02;       // roll radians between stored pen points
    const MAXP = 26;        // max points minted per frame (bounds the work)
    const DETUNE = 0.055;   // wheel never quite divides the ring → slow precession
    const INKV = 0.16;      // ink drift along the palette, per stored point (×DTH)
    const NCH = 30;         // trail is stroked in this many colour/age chunks
    const PENFRAC = 0.78;   // pen hole offset as a fraction of the wheel radius

    let theta = 0;              // wheel-centre orbit angle
    let penTheta = 0;           // angle the trail has been minted up to
    let speed = MOTOR;          // live roll speed (eases toward MOTOR)
    let freq = 5, freqTarget = 5; // (R-r)/r ratio → petals ≈ freq + 1
    let inkPos = Math.random() * 6;
    let base = inkPos | 0;
    let grab = null;            // { a } pointer angle while cranking
    let flick = 0;              // momentum estimate for release
    let flash = 0;              // brief event pulse (wheel / dbl)

    function inkAt(pos) {
      pos = ((pos % 6) + 6) % 6;
      const i = pos | 0, f = pos - i;
      const a = pal[i], b = pal[(i + 1) % 6];
      return [
        (a[0] + (b[0] - a[0]) * f) | 0,
        (a[1] + (b[1] - a[1]) * f) | 0,
        (a[2] + (b[2] - a[2]) * f) | 0,
      ];
    }
    function addPoint(th) {
      const F = freq + DETUNE;
      const A = freq / (freq + 1);   // wheel-centre orbit radius (ring=1)
      const rr = 1 / (freq + 1);     // wheel radius
      const d = PENFRAC * rr;        // pen offset from wheel centre
      bx[head] = A * Math.cos(th) + d * Math.cos(F * th);
      by[head] = A * Math.sin(th) - d * Math.sin(F * th);
      bc[head] = inkPos;
      head = (head + 1) % CAP;
      if (count < CAP) count++;
      inkPos += DTH * INKV;
      if (inkPos > 6000) inkPos -= 6000; // keep it small (6000 = 1000×6 palettes)
    }

    return {
      draw(t, dt) {
        // free-running motor eases back to idle; freq springs to its target
        if (!grab) {
          speed += (MOTOR - speed) * (1 - Math.pow(0.35, dt));
          theta += speed * dt;
        }
        freq += (freqTarget - freq) * (1 - Math.pow(0.02, dt));

        // mint pen points from penTheta up to the current roll (bounded work)
        const dth = theta - penTheta;
        const steps = Math.min(MAXP, Math.max(count ? 0 : 1, Math.round(Math.abs(dth) / DTH)));
        if (steps > 0) {
          for (let s = 1; s <= steps; s++) addPoint(penTheta + dth * (s / steps));
          penTheta = theta;
        }

        const w = env.w, h = env.h, cx = w / 2, cy = h / 2;
        const S = 0.42 * Math.min(w, h);

        g.fillStyle = bg;
        g.fillRect(0, 0, w, h);

        // ── faint mechanism ghost: fixed ring, rolling wheel, pen arm ──
        const F = freq + DETUNE;
        const A = freq / (freq + 1), rr = 1 / (freq + 1), d = PENFRAC * rr;
        const wcx = cx + A * Math.cos(theta) * S, wcy = cy + A * Math.sin(theta) * S;
        const pnx = cx + (A * Math.cos(theta) + d * Math.cos(F * theta)) * S;
        const pny = cy + (A * Math.sin(theta) - d * Math.sin(F * theta)) * S;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.lineWidth = 1.5;
        g.strokeStyle = `rgba(${pal[5][0]},${pal[5][1]},${pal[5][2]},${0.09 + flash * 0.22})`;
        g.beginPath(); g.arc(cx, cy, S, 0, TAU); g.stroke();
        g.beginPath(); g.arc(wcx, wcy, rr * S, 0, TAU); g.stroke();
        g.beginPath(); g.moveTo(wcx, wcy); g.lineTo(pnx, pny); g.stroke();

        // ── the glowing, fading trail ──
        if (count > 1) {
          const start = (head - count + CAP) % CAP;
          g.globalCompositeOperation = 'lighter';
          for (let pass = 0; pass < 2; pass++) {
            const wide = pass === 0;
            g.lineWidth = wide ? Math.max(4, S * 0.05) : 2.6;
            for (let c = 0; c < NCH; c++) {
              const lo = (c * count / NCH) | 0;
              let hi = ((c + 1) * count / NCH) | 0;
              if (hi <= lo) continue;
              if (hi > count - 1) hi = count - 1;
              const fade = Math.pow(c / (NCH - 1), 1.25); // old = dim, new = bright
              const col = inkAt(bc[(start + ((lo + hi) >> 1)) % CAP]);
              g.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${(wide ? 0.10 : 0.5) * fade})`;
              g.beginPath();
              for (let i = lo; i <= hi; i++) {
                const idx = (start + i) % CAP;
                const X = cx + bx[idx] * S, Y = cy + by[idx] * S;
                if (i === lo) g.moveTo(X, Y); else g.lineTo(X, Y);
              }
              g.stroke();
            }
          }
          // the pen: a bright wet dot with a soft halo at the newest point
          const n = (head - 1 + CAP) % CAP;
          const col = inkAt(bc[n]);
          const PX = cx + bx[n] * S, PY = cy + by[n] * S;
          g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.3)`;
          g.beginPath(); g.arc(PX, PY, 7, 0, TAU); g.fill();
          g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.95)`;
          g.beginPath(); g.arc(PX, PY, 3.2, 0, TAU); g.fill();
          g.globalCompositeOperation = 'source-over';
        }

        if (flash > 0.001) flash = Math.max(0, flash - dt * 2.5);
      },

      down(p) {
        grab = { a: Math.atan2(p.y - env.h / 2, p.x - env.w / 2) };
        flick = 0;
      },
      move(p) {
        if (!grab) return;
        const a = Math.atan2(p.y - env.h / 2, p.x - env.w / 2);
        let da = a - grab.a;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        grab.a = a;
        theta += da * CRANK;                       // crank the roll → draw by hand
        flick = flick * 0.6 + da * CRANK * 60 * 0.4;
      },
      up() {
        if (grab && Math.abs(flick) > 0.4)         // a real flick imparts momentum;
          speed = Math.max(-MAXSPD, Math.min(MAXSPD, flick)); // a bare tap doesn't stall it
        grab = null;
      },
      wheel(dy) {
        freqTarget = Math.max(2, Math.min(12, freqTarget + (dy > 0 ? 1 : -1)));
        flash = 1;
      },
      dbl() {
        base = (base + 2 + (Math.random() * 3 | 0)) % 6; // jump to a new ink family
        inkPos = base;
        head = 0; count = 0;                             // fresh sheet
        penTheta = theta; flick = 0; grab = null;
        flash = 1;
      },
    };
  },
});
