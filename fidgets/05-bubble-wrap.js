/* № 05 — Bubble wrap. A 7×7 sheet of plump translucent bubbles. Sweep the
   pointer across (hover or drag) to machine-gun pop them; clear the sheet and
   a fresh one slides in with a satisfied little overshoot. */
F.register({
  n: 5, id: 'bubble-wrap', cat: 'chaos',
  title: 'Bubble wrap', hint: 'Sweep across to pop. Pop them all, get a fresh sheet',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const N = 7, NN = N * N;
    const SKY = '88,166,242', CREAM = '242,233,220';
    let cell = 0, ox = 0, oy = 0, R = 0;
    let bub = [];                 // {p popped, f flash, s squash, sv, ph, wr}
    let parts = [];               // shards {x, y, vx, vy, l, ink}
    let popped = 0;
    let mode = 0;                 // 0 live · 1 sliding out · 2 sliding in
    let sx = 0, sxv = 0, hold = 0;
    let idleT = 1.2, trembleI = -1, trembleT = 0;
    let last = null;              // previous pointer pos for segment sweeps

    function layout() {
      const m = Math.min(env.w, env.h);
      cell = m / (N + 0.55);
      ox = (env.w - cell * (N - 1)) / 2;
      oy = (env.h - cell * (N - 1)) / 2;
      R = cell * 0.42;
    }
    function fresh() {
      bub = [];
      for (let i = 0; i < NN; i++) {
        bub.push({ p: 0, f: 0, s: 0, sv: 0, ph: Math.random() * TAU, wr: Math.random() * TAU });
      }
      popped = 0; trembleI = -1; trembleT = 0;
    }
    layout(); fresh();

    const bx = i => ox + (i % N) * cell;
    const by = i => oy + ((i / N) | 0) * cell;

    function pop(i) {
      const b = bub[i];
      if (b.p) return;
      b.p = 1; b.f = 1; popped++;
      if (i === trembleI) trembleT = 0;
      const x = bx(i), y = by(i);
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * TAU, sp = 60 + Math.random() * 130;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50, l: 1, ink: k ? inks[3] : inks[5] });
      }
      if (parts.length > 150) parts.splice(0, parts.length - 150);
      const c = i % N, r = (i / N) | 0;                     // nudge the 4 neighbors
      if (c > 0 && !bub[i - 1].p) bub[i - 1].sv += 4.5;
      if (c < N - 1 && !bub[i + 1].p) bub[i + 1].sv += 4.5;
      if (r > 0 && !bub[i - N].p) bub[i - N].sv += 4.5;
      if (r < N - 1 && !bub[i + N].p) bub[i + N].sv += 4.5;
      if (popped >= NN) { mode = 1; hold = 0.3; sxv = 220; }
    }
    function sweep(x0, y0, x1, y1) {                       // pop along the swept segment
      const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy + 1e-6;
      const RR = (R + 2) * (R + 2);
      for (let i = 0; i < NN; i++) {
        if (bub[i].p) continue;
        const cx = bx(i) - x0, cy = by(i) - y0;
        const u = Math.max(0, Math.min(1, (cx * dx + cy * dy) / len2));
        const ex = cx - u * dx, ey = cy - u * dy;
        if (ex * ex + ey * ey < RR) pop(i);
      }
    }

    return {
      draw(t, dt) {
        if (mode === 1) {                                  // page-flip wipe out…
          hold -= dt;
          if (hold <= 0) { sxv += 3000 * dt; sx -= sxv * dt; }
          if (sx < -(env.w * 0.85 + R * 3)) { fresh(); parts.length = 0; mode = 2; sx = env.w * 1.15; sxv = 0; }
        } else if (mode === 2) {                           // …fresh sheet springs in
          sxv += (-sx * 90 - sxv * 7) * dt;
          sx += sxv * dt;
          if (Math.abs(sx) < 0.4 && Math.abs(sxv) < 6) { sx = 0; sxv = 0; mode = 0; }
        }
        if (trembleT > 0) trembleT -= dt;
        idleT -= dt;
        if (mode === 0 && idleT <= 0) {                    // tempt with a random tremble
          if (popped < NN) {
            let j = (Math.random() * NN) | 0, tries = 0;
            while (bub[j].p && ++tries < 40) j = (Math.random() * NN) | 0;
            if (!bub[j].p) { trembleI = j; trembleT = 0.7; }
          }
          idleT = 2 + Math.random() * 2.5;
        }
        g.fillStyle = bg;
        g.fillRect(0, 0, env.w, env.h);
        g.save();
        const br = 1 + 0.005 * Math.sin(t * 0.9);          // the sheet breathes
        g.translate(env.w / 2 + sx, env.h / 2 + Math.abs(sx) * 0.06);
        g.rotate(sx * 0.0006);
        g.scale(br, br);
        g.translate(-env.w / 2, -env.h / 2);
        g.lineCap = 'round';
        for (let i = 0; i < NN; i++) {
          const b = bub[i];
          b.sv += (-b.s * 140 - b.sv * 10) * dt;           // squash spring
          b.s = Math.max(-0.6, Math.min(0.6, b.s + b.sv * dt));
          let x = bx(i), y = by(i);
          if (i === trembleI && trembleT > 0) {
            const e = trembleT / 0.7;
            x += Math.sin(t * 34 + b.ph) * 2.4 * e;
            y += Math.cos(t * 27 + b.ph) * 1.7 * e;
          }
          if (b.p) {                                       // deflated wrinkle
            g.strokeStyle = 'rgba(' + SKY + ',0.30)';
            g.lineWidth = 2;
            g.beginPath(); g.arc(x - R * 0.12, y + R * 0.1, R * 0.34, b.wr, b.wr + 1.9); g.stroke();
            g.beginPath(); g.arc(x + R * 0.16, y - R * 0.06, R * 0.2, b.wr + 2.6, b.wr + 4.1); g.stroke();
            g.beginPath(); g.arc(x, y + R * 0.18, R * 0.5, b.wr + 3.7, b.wr + 4.9); g.stroke();
          } else {                                         // plump dome
            const rx = R * (1 + 0.16 * b.s), ry = R * (1 - 0.28 * b.s);
            g.fillStyle = 'rgba(' + SKY + ',0.13)';
            g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
            g.fillStyle = 'rgba(' + SKY + ',0.10)';
            g.beginPath(); g.ellipse(x - rx * 0.12, y - ry * 0.14, rx * 0.62, ry * 0.62, 0, 0, TAU); g.fill();
            g.strokeStyle = 'rgba(' + SKY + ',0.55)';      // soft rim
            g.lineWidth = 2;
            g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.stroke();
            const sh = 0.38 + 0.26 * Math.sin(t * 0.8 + b.ph);
            g.strokeStyle = 'rgba(' + CREAM + ',' + sh.toFixed(3) + ')';
            g.lineWidth = Math.max(2, R * 0.16);           // shimmering highlight arc
            g.beginPath(); g.ellipse(x, y, rx * 0.6, ry * 0.6, 0, -2.7, -1.5); g.stroke();
            g.fillStyle = 'rgba(' + CREAM + ',' + (sh * 0.5).toFixed(3) + ')';
            g.beginPath(); g.arc(x + rx * 0.3, y + ry * 0.34, Math.max(1, R * 0.05), 0, TAU); g.fill();
          }
          if (b.f > 0) {                                   // expanding pop flash
            b.f = Math.max(0, b.f - dt / 0.2);
            g.strokeStyle = 'rgba(' + CREAM + ',' + (b.f * 0.9).toFixed(3) + ')';
            g.lineWidth = 1.5 + 3 * b.f;
            g.beginPath(); g.arc(x, y, R * (0.6 + (1 - b.f) * 1.15), 0, TAU); g.stroke();
          }
        }
        for (let k = parts.length - 1; k >= 0; k--) {      // shards
          const q = parts[k];
          q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 520 * dt; q.l -= dt / 0.45;
          if (q.l <= 0) { parts.splice(k, 1); continue; }
          g.globalAlpha = q.l;
          g.fillStyle = q.ink;
          g.fillRect(q.x - 1.5, q.y - 1.5, 3, 3);
        }
        g.globalAlpha = 1;
        g.restore();
      },
      down(p) {
        if (mode === 0) sweep(p.x, p.y, p.x, p.y);
        last = { x: p.x, y: p.y };
      },
      move(p) {
        if (mode === 0) {
          if (last) sweep(last.x, last.y, p.x, p.y);
          else sweep(p.x, p.y, p.x, p.y);
        }
        last = { x: p.x, y: p.y };
      },
      leave() { last = null; },
      resize() { layout(); },
    };
  },
});
