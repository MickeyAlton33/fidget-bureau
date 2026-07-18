/* № 12 — Chaos Bob. Equal-mass double pendulum hung from top-center.
   Grab either bob and fling it: the lower bob inks a fading ribbon whose
   hue rides its speed (sky → lilac → coral). No two throws draw alike. */
F.register({
  n: 12, id: 'chaos-bob', cat: 'matter',
  title: 'Double pendulum', hint: 'Fling it — no two throws draw alike',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    let px = 0, py = 0, L1 = 60, L2 = 55, R1 = 10, R2 = 12, GRAV = 2000;
    let a1 = (0.55 + Math.random() * 0.3) * (Math.random() < 0.5 ? -1 : 1);
    let a2 = a1 * -1.6, w1 = 0, w2 = 0.7;
    let grab = 0, hov = 0, acc = 0;          // grab/hover: 0 none, 1 upper, 2 lower
    let sc1 = 1, sc2 = 1, sv1 = 0, sv2 = 0;  // springy bob scales
    const trail = [];                        // {x, y, s} — lower-bob history
    let pvx = 0, pvy = 0, first = true;
    const C = [inks[3], inks[4], inks[1]].map(hx =>
      [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16)));

    function layout() {
      const m = Math.min(env.w, env.h);
      px = env.w / 2; py = env.h * 0.30;
      L1 = 0.235 * m; L2 = 0.215 * m;
      R1 = Math.max(8, 0.037 * m); R2 = Math.max(9, 0.043 * m);
      GRAV = 7.5 * m;
      trail.length = 0; first = true;
    }
    layout();

    const clampW = v => Math.max(-25, Math.min(25, v));
    const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
    function pos() {
      const x1 = px + L1 * Math.sin(a1), y1 = py + L1 * Math.cos(a1);
      return [x1, y1, x1 + L2 * Math.sin(a2), y1 + L2 * Math.cos(a2)];
    }
    function ink(u, al) {                    // u 0..1 → sky→lilac→coral
      const k = u < 0.5 ? 0 : 1, f = u < 0.5 ? u * 2 : u * 2 - 1;
      const A = C[k], B = C[k + 1];
      return 'rgba(' + (A[0] + (B[0] - A[0]) * f | 0) + ',' +
        (A[1] + (B[1] - A[1]) * f | 0) + ',' +
        (A[2] + (B[2] - A[2]) * f | 0) + ',' + al.toFixed(3) + ')';
    }
    function step(dt) {                      // equal-mass EOM, 4 substeps
      const h = dt / 4;
      for (let k = 0; k < 4; k++) {
        const d = a1 - a2, sd = Math.sin(d), cd = Math.cos(d);
        const den = 3 - Math.cos(2 * d);
        const A1 = (-3 * GRAV * Math.sin(a1) - GRAV * Math.sin(a1 - 2 * a2)
          - 2 * sd * (w2 * w2 * L2 + w1 * w1 * L1 * cd)) / (L1 * den + 1e-6);
        const A2 = (2 * sd * (2 * w1 * w1 * L1 + 2 * GRAV * Math.cos(a1)
          + w2 * w2 * L2 * cd)) / (L2 * den + 1e-6);
        w1 = clampW(w1 + A1 * h); w2 = clampW(w2 + A2 * h);
        a1 += w1 * h; a2 += w2 * h;
      }
      const damp = Math.exp(-0.02 * dt);     // nearly-zero drag: tumbles for ages
      w1 *= damp; w2 *= damp;
      if (!isFinite(a1) || !isFinite(a2) || !isFinite(w1) || !isFinite(w2)) {
        a1 = 0.6; a2 = -0.9; w1 = 0; w2 = 0.5;
      }
      if (Math.abs(w1) + Math.abs(w2) < 0.06 && Math.abs(Math.sin(a1)) < 0.04)
        w2 += 0.5;                           // never let it die completely
    }
    function drawBob(x, y, r, fill) {
      g.fillStyle = fill;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(242,233,220,0.85)';
      g.beginPath(); g.arc(x - r * 0.32, y - r * 0.34, r * 0.26, 0, TAU); g.fill();
    }

    return {
      draw(t, dt) {
        const fdt = Math.max(dt, 1e-3);
        if (grab) {                          // kinematic: ω estimated from drag
          const west = clampW(acc / fdt);
          if (grab === 1) { w1 = w1 * 0.4 + west * 0.6; w2 *= 0.75; }
          else { w2 = w2 * 0.4 + west * 0.6; w1 *= 0.75; }
          acc = 0;
        } else step(dt);

        const g1 = grab === 1 ? 1.3 : hov === 1 ? 1.12 : 1;
        const g2 = grab === 2 ? 1.3 : hov === 2 ? 1.12 : 1;
        sv1 += (g1 - sc1) * 260 * dt; sv1 *= Math.exp(-11 * dt); sc1 += sv1 * dt;
        sv2 += (g2 - sc2) * 260 * dt; sv2 *= Math.exp(-11 * dt); sc2 += sv2 * dt;

        const [x1, y1, x2, y2] = pos();
        if (first) { pvx = x2; pvy = y2; first = false; }
        const sp = Math.hypot(x2 - pvx, y2 - pvy) / fdt;
        pvx = x2; pvy = y2;
        trail.push({ x: x2, y: y2, s: Math.min(1, sp / (8 * (L1 + L2))) });
        if (trail.length > 300) trail.splice(0, trail.length - 300);

        g.fillStyle = bg;
        g.fillRect(0, 0, env.w, env.h);

        g.lineCap = 'round'; g.lineJoin = 'round';
        const n = trail.length;
        for (let i = 1; i < n; i++) {
          const P = trail[i], Q = trail[i - 1];
          const age = i / n;                 // 1 = freshest
          g.strokeStyle = ink(P.s, 0.85 * age * age);
          g.lineWidth = 1 + 2.2 * age;
          g.beginPath(); g.moveTo(Q.x, Q.y); g.lineTo(P.x, P.y); g.stroke();
        }

        g.strokeStyle = inks[5];             // 3px cream rods
        g.globalAlpha = 0.9; g.lineWidth = 3;
        g.beginPath(); g.moveTo(px, py); g.lineTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        g.globalAlpha = 1;
        g.fillStyle = inks[5];               // pivot mount
        g.beginPath(); g.arc(px, py, 4.5, 0, TAU); g.fill();

        drawBob(x1, y1, R1 * sc1, inks[0]);
        drawBob(x2, y2, R2 * sc2, ink(trail[n - 1].s, 1));

        if (hov && !grab) {                  // "grab me" ring
          const hx = hov === 1 ? x1 : x2, hy = hov === 1 ? y1 : y2;
          const hr = (hov === 1 ? R1 * sc1 : R2 * sc2) + 5;
          g.strokeStyle = inks[5]; g.globalAlpha = 0.35; g.lineWidth = 2;
          g.beginPath(); g.arc(hx, hy, hr, 0, TAU); g.stroke();
          g.globalAlpha = 1;
        }
      },
      down(p) {
        const [x1, y1, x2, y2] = pos();
        if (Math.hypot(p.x - x2, p.y - y2) < R2 + 16) grab = 2;
        else if (Math.hypot(p.x - x1, p.y - y1) < R1 + 14) grab = 1;
        else return;
        acc = 0; hov = 0;
        if (grab === 1) w1 = 0; else w2 = 0;
      },
      move(p) {
        if (!grab) {
          const [x1, y1, x2, y2] = pos();
          hov = Math.hypot(p.x - x2, p.y - y2) < R2 + 16 ? 2 :
                Math.hypot(p.x - x1, p.y - y1) < R1 + 14 ? 1 : 0;
          return;
        }
        if (grab === 1) {
          const da = wrap(Math.atan2(p.x - px, p.y - py) - wrap(a1));
          a1 += da; acc += da;
        } else {
          const x1 = px + L1 * Math.sin(a1), y1 = py + L1 * Math.cos(a1);
          const da = wrap(Math.atan2(p.x - x1, p.y - y1) - wrap(a2));
          a2 += da; acc += da;
        }
      },
      up() { grab = 0; },
      leave() { hov = 0; },
      resize() { layout(); },
    };
  },
});
