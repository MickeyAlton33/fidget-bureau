/* № 15 — Cat tail. Hindquarters parked at the bottom edge, tail up in
   frame doing its own slow thinking. Hover near the tip and it curls up
   to meet you; grab it and the ears rise — the cat is keeping score. */
F.register({
  n: 15, id: 'cat-tail', cat: 'critters',
  title: 'Cat tail', hint: 'Pet the tail. The cat has opinions',
  make(env) {
    const { g, inks, bg } = env;
    const CREAM = inks[5];
    const N = 8; // tail segments
    const X = new Float64Array(N + 1), Y = new Float64Array(N + 1);
    const PX = new Float64Array(N + 1), PY = new Float64Array(N + 1);
    const TX = new Float64Array(N + 1), TY = new Float64Array(N + 1);
    let L = 16, bx = 0, by = 0, backY = 0, now = 0;
    let grab = -1, hover = null, dragSpd = 0, cur = 0;
    let annoy = 0, lastUp = -9, thrashEnd = -9, whipT0 = -99, whipAmp = 0;
    let earUp = 0, earV = 0, earFlat = 0;

    function layout(reset) {
      bx = 0.73 * env.w; by = 0.76 * env.h;
      backY = 0.878 * env.h;
      L = 0.052 * Math.min(env.w, env.h);
      if (reset) for (let i = 0; i <= N; i++) {
        X[i] = PX[i] = bx; Y[i] = PY[i] = by - i * L;
      }
    }
    layout(true);

    function pose(t) { // target skeleton: idle swish / thrash / whip wave
      const thrash = t < thrashEnd, wt = t - whipT0;
      let a = -Math.PI / 2 + (thrash ? 0.55 * Math.sin(t * 9.5)
        : 0.16 * Math.sin(t * 1.5) + 0.05 * Math.sin(t * 0.53));
      let x = bx, y = by;
      TX[0] = x; TY[0] = y;
      for (let i = 0; i < N; i++) {
        let k = thrash ? 0.30 * Math.sin(t * 9.5 - i * 0.85)
          : -0.10 + 0.14 * Math.sin(t * 1.5 - i * 0.66) + 0.05 * Math.sin(t * 0.37 + i * 0.5);
        if (wt < 0.7) k += whipAmp * (0.3 + 0.1 * i) * Math.sin(wt * 15 - i * 1.05) * Math.exp(-wt * 4.5);
        a += k;
        if (hover && cur > 0.01 && i >= N - 3) { // curious tip curls to pointer
          let d = Math.atan2(hover.y - y, hover.x - x) - a;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          a += d * cur * (0.18 + 0.18 * (i - N + 3));
        }
        x += L * Math.cos(a); y += L * Math.sin(a);
        TX[i + 1] = x; TY[i + 1] = y;
      }
    }

    function step(t, dt) {
      pose(t);
      const K = grab >= 0 ? 30 : t < thrashEnd ? 260 : 95;
      const damp = grab >= 0 ? 0.80 : 0.90;
      for (let i = 1; i <= N; i++) { // verlet, sprung toward the pose
        const vx = (X[i] - PX[i]) * damp, vy = (Y[i] - PY[i]) * damp;
        PX[i] = X[i]; PY[i] = Y[i];
        X[i] += vx + (TX[i] - X[i]) * K * dt * dt;
        Y[i] += vy + (TY[i] - Y[i]) * K * dt * dt;
      }
      for (let it = 0; it < 4; it++) { // distance constraints, base pinned
        X[0] = bx; Y[0] = by;
        if (grab >= 0 && hover) { X[grab] = hover.x; Y[grab] = hover.y; }
        for (let i = 0; i < N; i++) {
          const dx = X[i + 1] - X[i], dy = Y[i + 1] - Y[i];
          const d = Math.hypot(dx, dy) + 1e-6, e = (d - L) / d;
          const p0 = i === 0 || i === grab, p1 = i + 1 === grab;
          const w0 = p0 ? 0 : p1 ? 1 : 0.5, w1 = p1 ? 0 : p0 ? 1 : 0.5;
          X[i] += dx * e * w0; Y[i] += dy * e * w0;
          X[i + 1] -= dx * e * w1; Y[i + 1] -= dy * e * w1;
        }
      }
      if (X[N] !== X[N] || Y[N] !== Y[N]) layout(true); // NaN insurance
      if (grab >= 0 && hover) { PX[grab] = X[grab]; PY[grab] = Y[grab]; }
    }

    function seg(i) {
      g.beginPath();
      g.moveTo(X[i], Y[i]);
      g.lineTo(X[i + 1], Y[i + 1]);
      g.stroke();
    }
    function ear(ex, side, m) {
      const eh = 0.15 * m * (1 - 0.55 * earFlat), ew = 0.10 * m;
      const baseY = backY + 4 + (1 - Math.min(1, earUp)) * (0.15 * m + 12);
      g.save();
      g.translate(ex, baseY);
      g.rotate(side * earFlat * 1.05); // annoyed ears go airplane-mode
      g.beginPath();
      g.moveTo(-ew / 2, 0);
      g.lineTo(side * ew * 0.12, -eh);
      g.lineTo(ew / 2, 0);
      g.closePath();
      g.fillStyle = bg; g.fill();
      g.fillStyle = 'rgba(242,233,220,0.08)'; g.fill();
      g.strokeStyle = CREAM; g.lineWidth = 2.5; g.lineJoin = 'round'; g.stroke();
      g.beginPath(); // inner ear flushes coral with irritation
      g.moveTo(-ew * 0.22, -eh * 0.14);
      g.lineTo(side * ew * 0.08, -eh * 0.62);
      g.lineTo(ew * 0.22, -eh * 0.14);
      g.closePath();
      g.fillStyle = 'rgba(242,102,91,' + (0.18 + 0.5 * earFlat).toFixed(2) + ')';
      g.fill();
      g.restore();
    }
    function body(t) {
      const w = env.w, h = env.h, br = Math.sin(t * 1.1) * 0.005 * h; // breathing
      g.beginPath();
      g.moveTo(-9, h + 9);
      g.lineTo(-9, 0.885 * h + br);
      g.quadraticCurveTo(0.26 * w, 0.848 * h + br, 0.50 * w, 0.818 * h + br);
      g.quadraticCurveTo(0.70 * w, 0.732 * h, 0.85 * w, 0.802 * h); // haunch
      g.quadraticCurveTo(0.97 * w, 0.862 * h, w + 9, 0.99 * h);
      g.lineTo(w + 9, h + 9);
      g.closePath();
      g.fillStyle = bg; g.fill();
      g.fillStyle = 'rgba(242,233,220,0.07)'; g.fill();
      g.strokeStyle = CREAM; g.lineWidth = 2.5; g.lineJoin = 'round'; g.stroke();
      g.strokeStyle = 'rgba(242,233,220,0.22)'; // inner haunch line
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0.68 * w, 1.02 * h, 0.19 * Math.min(w, h), -2.6, -0.5);
      g.stroke();
    }

    return {
      draw(t, dt) {
        now = t;
        const m = Math.min(env.w, env.h), thrash = t < thrashEnd;
        if (grab < 0 && !thrash && t - lastUp > 2.2) annoy = Math.max(0, annoy - dt * 0.55);
        earFlat += ((thrash ? 1 : 0.24 * annoy) - earFlat) * Math.min(1, dt * 6);
        const uT = (grab >= 0 || thrash || annoy > 0.1) ? 1 : 0;
        earV += (uT - earUp) * 130 * dt;
        earV *= Math.max(0, 1 - 8 * dt);
        earUp = Math.max(-0.05, Math.min(1.2, earUp + earV * dt));
        let cT = 0;
        if (hover && !hover.held && grab < 0 && !thrash) {
          const d = Math.hypot(hover.x - X[N], hover.y - Y[N]);
          cT = Math.max(0, Math.min(1, 1.4 - d / (0.36 * m)));
        }
        cur += (cT - cur) * Math.min(1, dt * 5);
        step(t, dt);

        g.fillStyle = bg;
        g.fillRect(0, 0, env.w, env.h);
        if (earUp > 0.02) { ear(0.175 * env.w, -1, m); ear(0.315 * env.w, 1, m); }
        // tail: cream halo under a dark core = dark tail with cream outline
        g.lineCap = 'round'; g.lineJoin = 'round';
        const wb = Math.max(8, 0.035 * m) * (1 + 0.30 * earFlat), wtip = wb * 0.4;
        g.strokeStyle = CREAM;
        for (let i = 0; i < N; i++) {
          g.lineWidth = wb + (wtip - wb) * i / (N - 1) + 4.5;
          seg(i);
        }
        const tint = thrash ? 'rgba(242,102,91,0.35)' : 'rgba(242,233,220,0.10)';
        for (let i = 0; i < N - 1; i++) { // last segment stays solid cream: the tip
          g.lineWidth = wb + (wtip - wb) * i / (N - 1);
          g.strokeStyle = bg; seg(i);
          g.strokeStyle = tint; seg(i);
        }
        if (grab >= 0) {
          g.strokeStyle = CREAM; g.globalAlpha = 0.4; g.lineWidth = 2;
          g.beginPath(); g.arc(X[grab], Y[grab], 9, 0, Math.PI * 2); g.stroke();
          g.globalAlpha = 1;
        }
        body(t);
      },
      down(p) {
        hover = { x: p.x, y: p.y, held: true };
        let best = -1, bd = Math.pow(Math.max(24, 0.09 * Math.min(env.w, env.h)), 2);
        for (let i = 1; i <= N; i++) {
          const dx = p.x - X[i], dy = p.y - Y[i], d2 = dx * dx + dy * dy;
          if (d2 < bd) { bd = d2; best = i; }
        }
        if (best < 0) return;
        grab = best; dragSpd = 0; whipT0 = -99;
        annoy = now - lastUp < 2 ? Math.min(3, annoy + 1) : Math.max(1, annoy);
        if (annoy >= 3) thrashEnd = now + 3.2;
        earV += 6; // ears pop the instant you grab
      },
      move(p) {
        if (grab >= 0 && hover) dragSpd = dragSpd * 0.7 + Math.hypot(p.x - hover.x, p.y - hover.y) * 18;
        hover = { x: p.x, y: p.y, held: p.held };
      },
      up() {
        if (grab < 0) return;
        lastUp = now; whipT0 = now; // whip-crack rides down the chain
        whipAmp = Math.min(1.0, 0.25 + dragSpd * 0.0035);
        if (annoy >= 3) thrashEnd = Math.max(thrashEnd, now + 3);
        grab = -1;
      },
      leave() { hover = null; },
      resize() { layout(false); },
    };
  },
});
