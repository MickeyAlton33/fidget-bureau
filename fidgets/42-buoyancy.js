/* № 42 — Corks. A side-on tank: five corks ride a wavy, living waterline,
   tipping with the swell. Grab one and shove it under — it fights back, and
   on release buoyancy fires it up through the surface in a splash, the
   ripples spreading along the water to jostle its neighbors. A 1-D wave
   carries both the idle swell and every splash; buoyancy is an upward pull
   that grows with how deep a cork is pushed, tamed by water drag. */
F.register({
  n: 42, id: 'buoyancy', cat: 'matter',
  title: 'Corks', hint: 'Push the corks under — they bob back up',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

    // ---- palette: amber corks on a sky/mint tank, cream for light ----
    const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    const AMBER = hex(inks[0]), MINT = hex(inks[2]), SKY = hex(inks[3]), CREAM = hex(inks[5]), GROUND = hex(bg);
    const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    const rgb = c => 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
    const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
    const BAND = mix(AMBER, GROUND, 0.52);   // dark cork band
    const RIM = mix(AMBER, GROUND, 0.34);    // chunky outline
    const HILITE = mix(AMBER, CREAM, 0.7);   // lit upper edge

    // ---- 1-D surface: procedural swell (always alive) + dynamic wave ----
    const M = 88;
    let surf = new Float32Array(M);
    let surfPrev = new Float32Array(M);
    const lineY = new Float32Array(M);
    const SSTEP = 1 / 120, SVDAMP = 0.985, SK = 0.22;
    let sacc = 0;

    // ---- size-derived state, (re)built in layout() ----
    let m, baseY, colW, A1, A2, A3, k1, k2, k3, G, B, VMAX, SMAX;
    const W1 = 0.55, W2 = 0.83, W3 = 1.7, FRACEQ = 0.36;
    let corks = [], seeded = false, lastW = 0, lastH = 0, lastM = 0;

    function layout() {
      const w = env.w, h = env.h, nm = Math.min(w, h);
      baseY = h * 0.40;
      colW = w / (M - 1);
      A1 = nm * 0.022; A2 = nm * 0.012; A3 = nm * 0.006;
      k1 = TAU * 1.4 / w; k2 = TAU * 2.6 / w; k3 = TAU * 4.6 / w;
      G = nm * 2.2; B = G / FRACEQ; VMAX = nm * 3.2; SMAX = nm * 0.10;
      if (!seeded) {
        for (let i = 0; i < 5; i++) {
          const hw = nm * (0.050 + Math.random() * 0.022);
          const hh = hw * (1.35 + Math.random() * 0.28);
          const x = w * (0.15 + 0.70 * (i / 4)) + (Math.random() - 0.5) * w * 0.04;
          corks.push({ x, y: baseY - 0.28 * hh, vx: (Math.random() - 0.5) * 10, vy: 0,
            hw, hh, ang: (Math.random() - 0.5) * 0.18, av: 0, pf: 0 });
        }
        seeded = true;
        disturb(w * 0.32, -3.5, nm * 0.05);  // opening ripples so it greets you alive
        disturb(w * 0.7, 2.4, nm * 0.045);
      } else if (lastW > 0) {
        const sx = w / lastW, sy = h / lastH, ss = nm / (lastM || nm);
        for (const c of corks) {
          c.hw *= ss; c.hh *= ss;
          c.x = clamp(c.x * sx, c.hw, w - c.hw);
          c.y *= sy; c.vx *= 0.3; c.vy *= 0.3;
        }
      }
      m = nm; lastW = w; lastH = h; lastM = nm;
    }

    function swellAt(x, t) {
      return A1 * Math.sin(x * k1 + t * W1) + A2 * Math.sin(x * k2 - t * W2 + 1.7)
        + A3 * Math.sin(x * k3 + t * W3 + 0.4);
    }
    function surfAt(x) {
      const f = clamp(x / colW, 0, M - 1), i = f | 0, fr = f - i;
      const a = surf[i], b = surf[i < M - 1 ? i + 1 : i];
      return a + (b - a) * fr;
    }
    const waterY = (x, t) => baseY + swellAt(x, t) + surfAt(x);

    function disturb(x, amount, radPx) {
      const c = x / colW, rad = Math.max(1, radPx / colW);
      const i0 = Math.max(0, Math.floor(c - rad)), i1 = Math.min(M - 1, Math.ceil(c + rad));
      for (let i = i0; i <= i1; i++) {
        const d = (i - c) / rad;
        if (d * d >= 1) continue;
        surf[i] += amount * (1 - d * d);
      }
    }
    function surfStep() {
      for (let i = 0; i < M; i++) {
        const c = surf[i];
        const l = i > 0 ? surf[i - 1] : c, r = i < M - 1 ? surf[i + 1] : c;
        let n = c + (c - surfPrev[i]) * SVDAMP + SK * (l + r - 2 * c);
        if (n > SMAX) n = SMAX; else if (n < -SMAX) n = -SMAX; else if (n !== n) n = 0;
        surfPrev[i] = n;
      }
      const tmp = surf; surf = surfPrev; surfPrev = tmp;
    }

    // ---- splash droplets ----
    let drops = [];
    const DROPMAX = 80;
    function emit(x, y, count, power) {
      for (let k = 0; k < count && drops.length < DROPMAX; k++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.3;
        const sp = power * (0.4 + Math.random() * 0.9);
        drops.push({ x: x + (Math.random() - 0.5) * 6, y: y - 2,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.45 + Math.random() * 0.45,
          col: Math.random() < 0.5 ? CREAM : mix(SKY, CREAM, 0.4) });
      }
    }

    // ---- pointer / grab ----
    let ptr = { x: 0, y: 0 }, grab = null, hover = null, tNow = 0;
    function pick(px, py) {
      let best = -1, bestd = 16;
      for (let i = 0; i < corks.length; i++) {
        const c = corks[i], dx = px - c.x, dy = py - c.y;
        const ca = Math.cos(-c.ang), sa = Math.sin(-c.ang);
        const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
        const ox = Math.max(0, Math.abs(lx) - c.hw), oy = Math.max(0, Math.abs(ly) - c.hh);
        const d = Math.hypot(ox, oy);
        if (d < bestd) { bestd = d; best = i; }
      }
      return best;
    }

    function trace(r, sy) {                    // rounded vertical capsule, local frame
      g.beginPath();
      g.arc(0, -sy, r, 0, Math.PI, true);      // top cap bulges up
      g.lineTo(-r, sy);                        // left side
      g.arc(0, sy, r, Math.PI, 0, true);       // bottom cap bulges down
      g.closePath();                           // right side
    }
    function drawCork(c) {
      const hw = c.hw, hh = c.hh, r = hw, sy = Math.max(1, hh - hw);
      g.save();
      g.translate(c.x, c.y);
      g.rotate(c.ang);
      trace(r, sy);
      g.fillStyle = rgb(AMBER);
      g.fill();
      g.save();
      trace(r, sy);
      g.clip();
      const gg = g.createLinearGradient(-hw, -hh, hw, hh);   // rounded shading
      gg.addColorStop(0, rgba(HILITE, 0.6));
      gg.addColorStop(0.5, rgba(AMBER, 0));
      gg.addColorStop(1, rgba(BAND, 0.5));
      g.fillStyle = gg;
      g.fillRect(-hw, -hh, hw * 2, hh * 2);
      const bH = Math.max(3, hh * 0.18);                     // dark band
      g.fillStyle = rgb(BAND);
      g.fillRect(-hw, hh * 0.18 - bH * 0.5, hw * 2, bH);
      g.strokeStyle = rgba(CREAM, 0.5);                      // specular streak
      g.lineWidth = Math.max(2, hw * 0.34);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-hw * 0.34, -sy * 0.7);
      g.lineTo(-hw * 0.34, sy * 0.25);
      g.stroke();
      g.restore();
      trace(r, sy);                                          // chunky rim
      g.strokeStyle = rgb(RIM);
      g.lineWidth = Math.max(2, hw * 0.16);
      g.lineJoin = 'round';
      g.stroke();
      g.restore();
    }

    layout();

    return {
      draw(t, dt) {
        tNow = t;
        dt = dt > 0.05 ? 0.05 : dt < 0 ? 0 : dt;
        const w = env.w, h = env.h;

        // corks displace the surface as they move through it (jostles neighbors)
        for (const c of corks) {
          const wy = waterY(c.x, t);
          const frac = clamp((c.y + c.hh - wy) / (2 * c.hh + 1e-6), 0, 1);
          if (frac > 0.02) disturb(c.x, clamp(-c.vy * frac * 0.010, -6, 6), c.hw * 1.3);
        }
        sacc = Math.min(sacc + dt, SSTEP * 4);
        while (sacc >= SSTEP) { surfStep(); sacc -= SSTEP; }

        // integrate each cork
        for (let i = 0; i < corks.length; i++) {
          const c = corks[i];
          if (grab && grab.i === i) {                        // held: crisp follow + flick tracking
            let tx = clamp(ptr.x + grab.ox, -0.4 * w, 1.4 * w);
            let ty = clamp(ptr.y + grab.oy, -0.4 * h, 1.6 * h);
            const ivx = clamp((tx - c.x) / Math.max(dt, 1e-3), -VMAX, VMAX);
            const ivy = clamp((ty - c.y) / Math.max(dt, 1e-3), -VMAX, VMAX);
            grab.evx = grab.evx * 0.6 + ivx * 0.4;
            grab.evy = grab.evy * 0.6 + ivy * 0.4;
            c.vx = ivx; c.vy = ivy; c.x = tx; c.y = ty;
          } else {
            const wy = waterY(c.x, t);
            const frac = clamp((c.y + c.hh - wy) / (2 * c.hh + 1e-6), 0, 1);
            const ay = G - B * frac;                          // gravity down, buoyancy up
            c.vy += ay * dt;
            c.vy -= c.vy * (0.5 + 2.9 * frac) * dt;           // air vs water drag
            c.vy = clamp(c.vy, -VMAX, VMAX);
            c.y += c.vy * dt;
            const slope = (waterY(c.x + 6, t) - waterY(c.x - 6, t)) / 12;
            c.vx += -slope * G * 0.04 * frac * dt;            // slide gently down the swell
            c.vx -= c.vx * (0.8 + 1.6 * frac) * dt;
            c.vx = clamp(c.vx, -VMAX * 0.5, VMAX * 0.5);
            c.x += c.vx * dt;
            const targ = clamp(Math.atan(slope), -0.5, 0.5);  // tip with the surface
            c.av += (targ - c.ang) * 22 * dt;
            c.av -= c.av * (3 + 3 * frac) * dt;
            c.av = clamp(c.av, -8, 8);
            c.ang = clamp(c.ang + c.av * dt, -1.2, 1.2);
          }
          // splash on a fast break through the surface
          const wy2 = waterY(c.x, t);
          const f2 = clamp((c.y + c.hh - wy2) / (2 * c.hh + 1e-6), 0, 1);
          if (c.pf - f2 > 0.05 && c.vy < -m * 0.6 && f2 < 0.6) {
            emit(c.x, wy2, 2 + (Math.random() * 3 | 0), Math.min(m * 1.6, -c.vy * 0.6));
            disturb(c.x, 2, c.hw * 1.4);
          } else if (f2 - c.pf > 0.10 && c.vy > m * 0.7) {
            emit(c.x, wy2, 2, Math.min(m * 1.2, c.vy * 0.4));
          }
          c.pf = f2;
          if (c.x !== c.x) { c.x = w * 0.5; c.vx = 0; }        // never NaN a coord
          if (c.y !== c.y) { c.y = baseY; c.vy = 0; }
          if (c.ang !== c.ang) { c.ang = 0; c.av = 0; }
        }

        // pairwise jostle (only 5 corks)
        for (let a = 0; a < corks.length; a++) for (let b = a + 1; b < corks.length; b++) {
          const ca = corks[a], cb = corks[b];
          const dx = cb.x - ca.x, dy = cb.y - ca.y;
          const mnx = (ca.hw + cb.hw) * 0.95, mny = (ca.hh + cb.hh) * 0.7;
          if (Math.abs(dx) < mnx && Math.abs(dy) < mny) {
            const push = (mnx - Math.abs(dx)) * 0.25, dir = dx >= 0 ? 1 : -1;
            const rvx = cb.vx - ca.vx, rvy = cb.vy - ca.vy, j = 0.25;
            if (!(grab && grab.i === a)) { ca.x -= dir * push; ca.vx += rvx * j; ca.vy += rvy * j * 0.5; }
            if (!(grab && grab.i === b)) { cb.x += dir * push; cb.vx -= rvx * j; cb.vy -= rvy * j * 0.5; }
          }
        }
        // soft walls + tank floor/ceiling for free corks
        for (let i = 0; i < corks.length; i++) {
          const c = corks[i];
          if (grab && grab.i === i) continue;
          if (c.x < c.hw) { c.x = c.hw; if (c.vx < 0) c.vx = -c.vx * 0.4; }
          else if (c.x > w - c.hw) { c.x = w - c.hw; if (c.vx > 0) c.vx = -c.vx * 0.4; }
          const floor = h - c.hh * 0.5;
          if (c.y > floor) { c.y = floor; if (c.vy > 0) c.vy = -c.vy * 0.3; }
          if (c.y < -c.hh * 2) { c.y = -c.hh * 2; if (c.vy < 0) c.vy = 0; }
        }

        // droplets
        for (let i = drops.length - 1; i >= 0; i--) {
          const d = drops[i];
          d.vy += G * 1.15 * dt;
          d.x += d.vx * dt; d.y += d.vy * dt;
          d.life -= dt;
          const wy = waterY(d.x, t);
          if (d.life <= 0 || (d.vy > 0 && d.y > wy)) {
            if (d.y > wy && d.vy > 40) disturb(d.x, 0.6, m * 0.02);
            drops.splice(i, 1);
          }
        }

        // ===== render =====
        g.fillStyle = bg;
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < M; i++) {
          let v = baseY + swellAt(i * colW, t) + surf[i];
          lineY[i] = clamp(v === v ? v : baseY, 6, h - 4);
        }
        // water body
        g.beginPath();
        g.moveTo(0, lineY[0]);
        for (let i = 1; i < M; i++) g.lineTo(i * colW, lineY[i]);
        g.lineTo(w, h); g.lineTo(0, h); g.closePath();
        const gb = g.createLinearGradient(0, baseY - m * 0.06, 0, h);
        gb.addColorStop(0, rgba(SKY, 0.34));
        gb.addColorStop(0.5, rgba(mix(SKY, MINT, 0.6), 0.46));
        gb.addColorStop(1, rgba(mix(MINT, GROUND, 0.55), 0.66));
        g.fillStyle = gb; g.fill();
        // corks
        for (const c of corks) drawCork(c);
        // translucent water veil tints the submerged parts
        g.beginPath();
        g.moveTo(0, lineY[0]);
        for (let i = 1; i < M; i++) g.lineTo(i * colW, lineY[i]);
        g.lineTo(w, h); g.lineTo(0, h); g.closePath();
        const gv = g.createLinearGradient(0, baseY - m * 0.02, 0, h);
        gv.addColorStop(0, rgba(SKY, 0.20));
        gv.addColorStop(0.5, rgba(MINT, 0.34));
        gv.addColorStop(1, rgba(mix(MINT, GROUND, 0.4), 0.52));
        g.fillStyle = gv; g.fill();
        // bold waterline + crest sparkle
        g.lineJoin = 'round'; g.lineCap = 'round';
        g.beginPath();
        g.moveTo(0, lineY[0]);
        for (let i = 1; i < M; i++) g.lineTo(i * colW, lineY[i]);
        g.strokeStyle = rgba(mix(MINT, CREAM, 0.3), 0.9);
        g.lineWidth = Math.max(2, m * 0.010);
        g.stroke();
        g.beginPath();
        g.moveTo(0, lineY[0] - 2);
        for (let i = 1; i < M; i++) g.lineTo(i * colW, lineY[i] - 2);
        g.strokeStyle = rgba(CREAM, 0.26);
        g.lineWidth = 1.5;
        g.stroke();
        // splashes on top
        for (const d of drops) {
          const a = clamp(d.life * 1.6, 0, 1);
          g.fillStyle = rgba(d.col, 0.85 * a);
          g.beginPath();
          g.arc(d.x, d.y, Math.max(1.4, m * 0.010), 0, TAU);
          g.fill();
        }
      },
      down(p) {
        ptr.x = p.x; ptr.y = p.y;
        const i = pick(p.x, p.y);
        if (i >= 0) { const c = corks[i]; grab = { i, ox: c.x - p.x, oy: c.y - p.y, evx: 0, evy: 0 }; }
      },
      move(p) {
        ptr.x = p.x; ptr.y = p.y;
        if (!p.held) {
          const wy = waterY(p.x, tNow);
          if (Math.abs(p.y - wy) < m * 0.10) {
            if (hover == null) hover = p.x;
            else if (Math.abs(p.x - hover) > colW * 0.8) { disturb(p.x, -0.5, m * 0.03); hover = p.x; }
          } else hover = null;
        }
      },
      up() {
        if (grab) { const c = corks[grab.i]; c.vx = clamp(grab.evx, -VMAX, VMAX); c.vy = clamp(grab.evy, -VMAX, VMAX); grab = null; }
      },
      leave() {
        if (grab) { const c = corks[grab.i]; c.vx = clamp(grab.evx, -VMAX, VMAX); c.vy = clamp(grab.evy, -VMAX, VMAX); grab = null; }
        hover = null;
      },
      dbl(p) {
        const i = pick(p.x, p.y);
        if (i >= 0) {                                   // dunk a cork and watch it fire back
          const c = corks[i];
          c.vy = clamp(c.vy + VMAX * 0.5, -VMAX, VMAX);
          disturb(c.x, 2.5, c.hw * 1.6);
          emit(c.x, waterY(c.x, tNow), 5, m * 1.1);
        } else {
          disturb(p.x, -3, m * 0.05);
          emit(p.x, waterY(p.x, tNow), 4, m * 0.9);
        }
      },
      resize() { layout(); },
    };
  },
});
