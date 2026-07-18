/* № 17 — Orbit garden. A warm sun tends three planets on softened
   inverse-square orbits (semi-implicit Euler). Grab a planet and throw
   it — slingshots, tight whirls, near-escapes. Hold empty space to grow
   a lilac gravity well that bends every path; a soft outer spring
   returns anything that strays, so the garden never loses a planet. */
F.register({
  n: 17, id: 'orbit-garden', cat: 'matter',
  title: 'Orbit garden', hint: 'Throw a planet — hold empty space to bend gravity',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    let m = Math.min(env.w, env.h), cx = env.w / 2, cy = env.h / 2;
    const P = [];                        // planets
    let grab = -1;                       // grabbed planet index
    const ptr = { x: 0, y: 0 };
    let tvx = 0, tvy = 0;                // smoothed throw velocity
    const well = { x: 0, y: 0, m: 0, on: false };
    const GM = () => 0.032 * m * m * m;  // sun mass, scale-invariant periods

    function circ(x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); }

    function init() {
      m = Math.min(env.w, env.h); cx = env.w / 2; cy = env.h / 2;
      P.length = 0;
      const defs = [
        { d: 0.20, pr: 0.031, ink: inks[2], dir: 1, a: 0.4 },             // mint
        { d: 0.30, pr: 0.027, ink: inks[3], dir: 1, a: 2.9, moon: 1 },    // sky
        { d: 0.41, pr: 0.023, ink: inks[4], dir: -1, a: 4.7 },            // lilac
      ];
      for (const d of defs) {
        const r = d.d * m, s = 0.06 * m;
        const v = d.dir * Math.sqrt(GM() * r * r / Math.pow(r * r + s * s, 1.5));
        P.push({
          x: cx + r * Math.cos(d.a), y: cy + r * Math.sin(d.a),
          vx: -v * Math.sin(d.a), vy: v * Math.cos(d.a),
          pr0: d.pr, pr: Math.max(5, d.pr * m),
          ink: d.ink, moon: !!d.moon, trail: [],
        });
      }
    }
    init();

    function release() {
      if (grab >= 0) {
        const p = P[grab];
        const sp = Math.hypot(tvx, tvy) + 1e-6, vm = 1.9 * m;
        const k = sp > vm ? vm / sp : 1;
        p.vx = tvx * k; p.vy = tvy * k;
        grab = -1;
      }
      well.on = false;
    }

    function drawTrail(p) {
      const tr = p.trail, n = tr.length / 2;
      if (n < 4) return;
      g.strokeStyle = p.ink; g.lineWidth = 2;
      for (let i = 3; i < n; i += 3) {
        const a = i / n;
        g.globalAlpha = 0.38 * a * a;
        g.beginPath();
        g.moveTo(tr[(i - 3) * 2], tr[(i - 3) * 2 + 1]);
        g.lineTo(tr[i * 2], tr[i * 2 + 1]);
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    return {
      draw(t, dt) {
        const idt = 1 / Math.max(dt, 1e-4);
        well.m = well.on ? Math.min(1, well.m + dt / 0.55)
                         : Math.max(0, well.m - dt / 0.95);
        const s2 = 0.0036 * m * m, sw2 = 0.0072 * m * m;
        const gm = GM(), wgm = 0.8 * gm * well.m;
        const R = 0.48 * m, vmax = 1.9 * m;
        for (let i = 0; i < P.length; i++) {
          const p = P[i];
          if (i === grab) {              // spring-follow the pointer
            const k = 1 - Math.exp(-28 * dt);
            const nx = p.x + (ptr.x - p.x) * k, ny = p.y + (ptr.y - p.y) * k;
            const kv = 1 - Math.exp(-20 * dt);
            tvx += ((nx - p.x) * idt - tvx) * kv;
            tvy += ((ny - p.y) * idt - tvy) * kv;
            p.x = nx; p.y = ny; p.vx = tvx; p.vy = tvy;
          } else {
            let dx = cx - p.x, dy = cy - p.y;
            let f = gm / Math.pow(dx * dx + dy * dy + s2, 1.5);
            let ax = dx * f, ay = dy * f;
            if (well.m > 0.01) {
              dx = well.x - p.x; dy = well.y - p.y;
              f = wgm / Math.pow(dx * dx + dy * dy + sw2, 1.5);
              ax += dx * f; ay += dy * f;
            }
            const rx = p.x - cx, ry = p.y - cy;
            const dc = Math.hypot(rx, ry) + 1e-6;
            if (dc > R) {                // soft fence: gentle inward spring
              const k = 30 * (dc - R) / dc;
              ax -= rx * k; ay -= ry * k;
              const damp = Math.pow(0.25, dt);
              p.vx *= damp; p.vy *= damp;
            }
            p.vx += ax * dt; p.vy += ay * dt;
            const sp = Math.hypot(p.vx, p.vy);
            if (sp > vmax) { p.vx *= vmax / sp; p.vy *= vmax / sp; }
            p.x += p.vx * dt; p.y += p.vy * dt;
          }
          p.trail.push(p.x, p.y);
          if (p.trail.length > 240) p.trail.splice(0, p.trail.length - 240);
        }

        g.fillStyle = bg; g.fillRect(0, 0, env.w, env.h);
        g.lineJoin = 'round'; g.lineCap = 'round';
        // garden fence, barely there
        g.strokeStyle = inks[5]; g.globalAlpha = 0.07; g.lineWidth = 2;
        circ(cx, cy, R); g.stroke();
        g.globalAlpha = 1;
        // gravity well: dim lilac dimple + concentric suction rings
        if (well.m > 0.004) {
          const wr = 0.17 * m * (0.45 + 0.55 * well.m);
          const dg = g.createRadialGradient(well.x, well.y, 0, well.x, well.y, wr);
          dg.addColorStop(0, 'rgba(176,140,232,0.32)');
          dg.addColorStop(1, 'rgba(176,140,232,0)');
          g.globalAlpha = well.m; g.fillStyle = dg;
          circ(well.x, well.y, wr); g.fill();
          g.strokeStyle = inks[4]; g.lineWidth = 2;
          for (let k = 0; k < 3; k++) {
            const ph = 1 - ((t * 0.9 + k / 3) % 1);   // rings fall inward
            g.globalAlpha = 0.5 * well.m * Math.sin(ph * Math.PI);
            circ(well.x, well.y, wr * ph); g.stroke();
          }
          g.globalAlpha = 1;
        }
        for (const p of P) drawTrail(p);
        // sun: layered radial-gradient glow, cream core to coral rim
        const sunR = 0.055 * m * (1 + 0.05 * Math.sin(t * 2.1));
        const halo = g.createRadialGradient(cx, cy, sunR * 0.4, cx, cy, sunR * 3.4);
        halo.addColorStop(0, 'rgba(245,165,36,0.30)');
        halo.addColorStop(0.5, 'rgba(242,102,91,0.10)');
        halo.addColorStop(1, 'rgba(242,102,91,0)');
        g.fillStyle = halo; circ(cx, cy, sunR * 3.4); g.fill();
        const body = g.createRadialGradient(cx, cy, 0, cx, cy, sunR);
        body.addColorStop(0, inks[5]);
        body.addColorStop(0.4, inks[0]);
        body.addColorStop(1, inks[1]);
        g.fillStyle = body; circ(cx, cy, sunR); g.fill();
        // planets, sun-lit, one with a moon
        for (let i = 0; i < P.length; i++) {
          const p = P[i];
          g.globalAlpha = 1; g.fillStyle = p.ink;
          circ(p.x, p.y, p.pr); g.fill();
          const la = Math.atan2(cy - p.y, cx - p.x);
          g.fillStyle = inks[5]; g.globalAlpha = 0.5;
          circ(p.x + Math.cos(la) * p.pr * 0.42,
               p.y + Math.sin(la) * p.pr * 0.42, p.pr * 0.34);
          g.fill();
          if (p.moon) {
            const ma = t * 2.4;
            g.globalAlpha = 0.9; g.fillStyle = inks[5];
            circ(p.x + (p.pr + 6) * Math.cos(ma),
                 p.y + (p.pr + 6) * 0.8 * Math.sin(ma), 2.6);
            g.fill();
          }
          if (i === grab) {
            g.globalAlpha = 0.4; g.strokeStyle = inks[5]; g.lineWidth = 2;
            circ(p.x, p.y, p.pr + 6); g.stroke();
          }
        }
        g.globalAlpha = 1;
      },
      down(p) {
        ptr.x = p.x; ptr.y = p.y;
        let best = -1, bd = 1e9;
        for (let i = 0; i < P.length; i++) {
          const d = Math.hypot(p.x - P[i].x, p.y - P[i].y);
          if (d < P[i].pr + 14 && d < bd) { bd = d; best = i; }
        }
        if (best >= 0) { grab = best; tvx = P[best].vx; tvy = P[best].vy; }
        else { well.on = true; well.x = p.x; well.y = p.y; }
      },
      move(p) {
        ptr.x = p.x; ptr.y = p.y;
        if (!p.held) release();
        else if (well.on) { well.x = p.x; well.y = p.y; }
      },
      up() { release(); },
      resize() {
        const om = m, ocx = cx, ocy = cy;
        m = Math.min(env.w, env.h); cx = env.w / 2; cy = env.h / 2;
        const k = m / (om + 1e-6);
        for (const p of P) {
          p.x = cx + (p.x - ocx) * k; p.y = cy + (p.y - ocy) * k;
          p.vx *= k; p.vy *= k;
          p.pr = Math.max(5, p.pr0 * m);
          p.trail.length = 0;
        }
        well.x = cx + (well.x - ocx) * k;
        well.y = cy + (well.y - ocy) * k;
      },
    };
  },
});
