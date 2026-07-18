/* № 20 — Startle tank. ~55 boid fish mill in a slow torus; hover lures the
   school along a point trailing the pointer (they stay shy of touching it),
   click strikes like a predator — silvery flash, scatter, recondense. */
F.register({
  n: 20, id: 'startle-tank', cat: 'critters',
  title: 'Startle tank', hint: 'Hover to lead the school — click to scatter it',
  make(env) {
    const { g, inks } = env;
    const TAU = Math.PI * 2, N = 55, GS = 8;
    const X = new Float32Array(N), Y = new Float32Array(N);
    const VX = new Float32Array(N), VY = new Float32Array(N);
    const PH = new Float32Array(N), SZ = new Float32Array(N);
    const head = new Int16Array(GS * GS), next = new Int16Array(N);
    let panic = 0, hover = false, strike = null;
    let px = 0, py = 0, dirx = 0, diry = 0, lx = 0, ly = 0;

    function hex(s) { return [1, 3, 5].map(k => parseInt(s.slice(k, k + 2), 16)); }
    const SKY = hex(inks[3]), MINT = hex(inks[2]), CREAM = hex(inks[5]);
    function mix(a, b, f) {
      return 'rgb(' + (a[0] + (b[0] - a[0]) * f | 0) + ',' +
        (a[1] + (b[1] - a[1]) * f | 0) + ',' + (a[2] + (b[2] - a[2]) * f | 0) + ')';
    }

    (function seed() {
      const cx = env.w / 2, cy = env.h / 2, R = Math.min(env.w, env.h) * 0.3;
      for (let i = 0; i < N; i++) {
        const a = Math.random() * TAU, r = R * (0.5 + Math.random() * 0.7);
        X[i] = cx + Math.cos(a) * r; Y[i] = cy + Math.sin(a) * r;
        VX[i] = -Math.sin(a) * 44; VY[i] = Math.cos(a) * 44;
        PH[i] = Math.random() * TAU;
        SZ[i] = 6.2 + Math.random() * 3.6;
      }
      lx = px = cx; ly = py = cy;
    })();

    return {
      draw(t, dt) {
        const w = env.w, h = env.h, m = Math.min(w, h);
        panic = Math.max(0, panic - dt);
        const f = Math.min(1, panic / 1.2);          // panic intensity 0..1
        const vmax = 95 + 185 * f, vmin = 26;
        const cohW = 1 - 0.88 * f;                   // cohesion collapses in panic
        // lure point eases toward a spot trailing behind the pointer
        const dl = Math.hypot(dirx, diry) + 1e-6;
        const trail = Math.min(40, dl * 7);
        const tgx = px - dirx / dl * trail, tgy = py - diry / dl * trail;
        const ease = 1 - Math.pow(0.004, dt);
        lx += (tgx - lx) * ease; ly += (tgy - ly) * ease;

        // ---- spatial buckets (8x8) ----
        head.fill(-1);
        const gw = w / GS, gh = h / GS;
        for (let i = 0; i < N; i++) {
          const bx = Math.min(GS - 1, Math.max(0, X[i] / gw | 0));
          const by = Math.min(GS - 1, Math.max(0, Y[i] / gh | 0));
          const c = by * GS + bx;
          next[i] = head[c]; head[c] = i;
        }

        // ---- flock physics ----
        const nbr2 = 34 * 34, sep = 13, M = 0.11 * m;
        const ccx = w / 2, ccy = h / 2, R0 = 0.3 * m;
        const drag = Math.pow(0.6, dt);
        for (let i = 0; i < N; i++) {
          const xi = X[i], yi = Y[i];
          let ax = 0, ay = 0, avx = 0, avy = 0, mx = 0, my = 0, cnt = 0;
          const cx0 = Math.min(GS - 1, Math.max(0, xi / gw | 0));
          const cy0 = Math.min(GS - 1, Math.max(0, yi / gh | 0));
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
            const bx = cx0 + ox, by = cy0 + oy;
            if (bx < 0 || by < 0 || bx >= GS || by >= GS) continue;
            for (let j = head[by * GS + bx]; j >= 0; j = next[j]) {
              if (j === i) continue;
              const dx = X[j] - xi, dy = Y[j] - yi, d2 = dx * dx + dy * dy;
              if (d2 > nbr2) continue;
              avx += VX[j]; avy += VY[j]; mx += X[j]; my += Y[j]; cnt++;
              if (d2 < sep * sep) {                  // separation
                const d = Math.sqrt(d2) + 1e-6, s = (sep - d) * 28 / d;
                ax -= dx * s; ay -= dy * s;
              }
            }
          }
          if (cnt) {
            ax += (avx / cnt - VX[i]) * 3.2;         // alignment
            ay += (avy / cnt - VY[i]) * 3.2;
            ax += (mx / cnt - xi) * 4.5 * cohW;      // cohesion
            ay += (my / cnt - yi) * 4.5 * cohW;
          }
          // soft walls
          if (xi < M) ax += (M - xi) * 8; else if (xi > w - M) ax -= (xi - w + M) * 8;
          if (yi < M) ay += (M - yi) * 8; else if (yi > h - M) ay -= (yi - h + M) * 8;
          // weak orbit-the-center: tangential push + gentle ring pull
          const rx = xi - ccx, ry = yi - ccy, rr = Math.hypot(rx, ry) + 1e-6;
          const calm = 1 - f;
          ax += (-ry / rr * 24 + rx / rr * (R0 - rr) * 0.7) * calm;
          ay += (rx / rr * 24 + ry / rr * (R0 - rr) * 0.7) * calm;
          // shy lure toward the trailing point
          if (hover) {
            const dxl = lx - xi, dyl = ly - yi, d = Math.hypot(dxl, dyl) + 1e-6;
            const pull = Math.max(-130, Math.min(130, (d - 30) * 2.6)) * (1 - 0.85 * f);
            ax += dxl / d * pull; ay += dyl / d * pull;
          }
          let vx = (VX[i] + ax * dt) * drag, vy = (VY[i] + ay * dt) * drag;
          const sp = Math.hypot(vx, vy) + 1e-6;
          const cl = sp > vmax ? vmax / sp : sp < vmin ? vmin / sp : 1;
          VX[i] = vx *= cl; VY[i] = vy *= cl;
          X[i] = xi + vx * dt; Y[i] = yi + vy * dt;
          PH[i] += (6 + sp * 0.06) * dt;             // tail-beat speeds with swim speed
        }

        // ---- render (translucent ground for a short wake) ----
        g.fillStyle = 'rgba(20,16,13,0.5)';
        g.fillRect(0, 0, w, h);
        const flash = f * f * 0.9;
        const c0 = flash > 0.01 ? mix(SKY, CREAM, flash) : inks[3];
        const c1 = flash > 0.01 ? mix(MINT, CREAM, flash) : inks[2];
        for (let i = 0; i < N; i++) {
          const vx = VX[i], vy = VY[i], sp = Math.hypot(vx, vy) + 1e-6;
          const ca = vx / sp, sa = vy / sp, s = SZ[i];
          const wig = Math.sin(PH[i]) * s * (0.42 + 0.3 * f);
          const bx = X[i], by = Y[i];
          g.fillStyle = i & 1 ? c1 : c0;
          g.beginPath();
          g.moveTo(bx + ca * s, by + sa * s);                              // nose
          g.lineTo(bx - ca * s * 0.5 - sa * s * 0.36, by - sa * s * 0.5 + ca * s * 0.36);
          g.lineTo(bx - ca * s * 1.15 - sa * wig, by - sa * s * 1.15 + ca * wig); // tail
          g.lineTo(bx - ca * s * 0.5 + sa * s * 0.36, by - sa * s * 0.5 - ca * s * 0.36);
          g.closePath();
          g.fill();
        }
        // predator-strike shockwave
        if (strike) {
          strike.age += dt;
          const a = strike.age / 0.4;
          if (a >= 1) strike = null;
          else {
            g.strokeStyle = inks[1];
            g.globalAlpha = (1 - a) * 0.8;
            g.lineWidth = 3;
            g.lineCap = 'round';
            g.beginPath();
            g.arc(strike.x, strike.y, 8 + a * a * 0.5 * m, 0, TAU);
            g.stroke();
            g.globalAlpha = 1;
          }
        }
      },
      down(p) {
        const m = Math.min(env.w, env.h);
        for (let i = 0; i < N; i++) {
          const dx = X[i] - p.x, dy = Y[i] - p.y, d = Math.hypot(dx, dy) + 1e-6;
          const k = 60 + 300 * Math.exp(-d / (0.45 * m));
          VX[i] += dx / d * k + (Math.random() - 0.5) * 70;
          VY[i] += dy / d * k + (Math.random() - 0.5) * 70;
        }
        panic = 1.5;
        strike = { x: p.x, y: p.y, age: 0 };
      },
      move(p) {
        dirx = dirx * 0.75 + (p.x - px) * 0.25;
        diry = diry * 0.75 + (p.y - py) * 0.25;
        px = p.x; py = p.y; hover = true;
      },
      leave() { hover = false; dirx = diry = 0; },
      resize(w, h) {
        for (let i = 0; i < N; i++) {
          X[i] = Math.min(w - 4, Math.max(4, X[i]));
          Y[i] = Math.min(h - 4, Math.max(4, Y[i]));
        }
        lx = Math.min(w, Math.max(0, lx)); ly = Math.min(h, Math.max(0, ly));
      },
    };
  },
});
