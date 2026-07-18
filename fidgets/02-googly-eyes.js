/* № 02 — Googly eyes. A coral blob with two huge plastic googly eyes: the
   pupils are loose discs that chase your pointer and rattle off the rims.
   Stir fast circles around it until it goes dizzy — then it shakes it off. */
F.register({
  n: 2, id: 'googly-eyes', cat: 'critters',
  title: 'Googly eyes', hint: 'Wave at it, stir circles until it gets dizzy',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const CORAL = inks[1], CREAM = inks[5], AMBER = inks[0];
    const eyes = [{ x: 0, y: 0, vx: 0, vy: 0 }, { x: 0, y: 0, vx: 0, vy: 0 }];
    let bx = 0, by = 0, bvx = 0, bvy = 0;         // body offset spring
    let px = 0, py = 0, ptr = false;               // last pointer (world)
    let drag = false, lx = 0, ly = 0;
    let lastAng = 0, haveAng = false, stir = 0, stirDir = 1;
    let dizzy = 0, shake = 0, wob = 0;
    let blinkIn = 2 + Math.random() * 3, blinkP = -1;

    function geom() {
      const w = env.w, h = env.h, m = Math.min(w, h);
      const R = m * 0.33;
      return { w, h, m, R, cx: w * 0.5, cy: h * 0.55,
               er: R * 0.48, ex: R * 0.48, ey: -R * 0.3 };
    }
    function stepPupil(e, sx, sy, pfx, pfy, maxD, m, dt) {
      let ax = pfx, ay = pfy;
      if (ptr) {
        const dx = px - sx - e.x, dy = py - sy - e.y;
        const d = Math.hypot(dx, dy) + 1e-6;
        ax += (dx / d) * m * 5.5; ay += (dy / d) * m * 5.5 + m * 0.9;
      } else ay += m * 2.2;                        // idle: just gravity
      e.vx += ax * dt; e.vy += ay * dt;
      const dr = Math.pow(0.5, dt);
      e.vx *= dr; e.vy *= dr;
      const vm = Math.hypot(e.vx, e.vy), vmax = m * 8;
      if (vm > vmax) { e.vx *= vmax / vm; e.vy *= vmax / vm; }
      e.x += e.vx * dt; e.y += e.vy * dt;
      const d2 = Math.hypot(e.x, e.y) + 1e-6;
      if (d2 > maxD) {                             // bounce off socket rim
        const nx = e.x / d2, ny = e.y / d2;
        e.x = nx * maxD; e.y = ny * maxD;
        const vn = e.vx * nx + e.vy * ny;
        if (vn > 0) { e.vx -= 1.62 * vn * nx; e.vy -= 1.62 * vn * ny; }
      }
    }

    return {
      draw(t, dt) {
        const G = geom(), m = G.m, R = G.R;
        // timers
        if (dizzy > 0) { dizzy -= dt; if (dizzy <= 0) shake = 0.8; }
        else if (shake > 0) shake -= dt;
        wob += (((dizzy > 0) ? 1 : 0) - wob) * Math.min(1, dt * 6);
        stir *= Math.pow(0.3, dt);
        if (blinkP >= 0) {
          blinkP += dt / 0.26;
          if (blinkP > 1) { blinkP = -1; blinkIn = 3 + Math.random() * 3; }
        } else if (dizzy <= 0 && (blinkIn -= dt) <= 0) blinkP = 0;
        // body spring: spring-back + queasy sway + head-shake forcing
        let fx = -170 * bx - 11 * bvx, fy = -170 * by - 11 * bvy;
        fx += Math.sin(t * 4.3) * m * 6 * wob;
        fy += Math.cos(t * 3.2) * m * 5 * wob;
        if (shake > 0) fx += Math.sin(shake * 42) * m * 85 * (shake / 0.8);
        bvx += fx * dt; bvy += fy * dt;
        const bs = Math.hypot(bvx, bvy), bmax = m * 10;
        if (bs > bmax) { bvx *= bmax / bs; bvy *= bmax / bs; }
        bx += bvx * dt; by += bvy * dt;
        const bd = Math.hypot(bx, by);
        if (bd > R * 0.5) { bx *= R * 0.5 / bd; by *= R * 0.5 / bd; }
        // pose: breathing + velocity squash + queasy tilt
        const br = 1 + 0.025 * Math.sin(t * 1.6);
        const qx = Math.min(0.12, Math.abs(bvx) / (m * 8));
        const qy = Math.min(0.12, Math.abs(bvy) / (m * 8));
        const sq = 0.05 * Math.sin(t * 5.1) * wob;
        const sxx = br * (1 + qx - qy + sq), syy = br * (1 - qx + qy - sq);
        const tilt = wob * 0.1 * Math.sin(t * 2.6) +
          (shake > 0 ? Math.sin(shake * 42) * 0.06 * (shake / 0.8) : 0);
        const ox = G.cx + bx, oy = G.cy + by;
        const co = Math.cos(tilt), si = Math.sin(tilt);
        const bp = (X, Y) => {
          const a = X * sxx, b = Y * syy;
          return [ox + a * co - b * si, oy + a * si + b * co];
        };
        g.fillStyle = bg;
        g.fillRect(0, 0, G.w, G.h);
        // blob body — lobed, breathing outline
        g.fillStyle = CORAL;
        g.beginPath();
        for (let k = 0; k <= 26; k++) {
          const a = (k / 26) * TAU;
          const r = R * (1 + 0.05 * Math.sin(3 * a + t * 0.9)
            + 0.03 * Math.sin(5 * a - t * 1.4)
            + 0.05 * wob * Math.sin(2 * a + t * 8));
          const [X, Y] = bp(r * Math.cos(a), r * Math.sin(a));
          k ? g.lineTo(X, Y) : g.moveTo(X, Y);
        }
        g.closePath(); g.fill();
        // cheeks
        g.globalAlpha = 0.5; g.fillStyle = AMBER;
        for (const s of [-1, 1]) {
          const [X, Y] = bp(s * R * 0.62, R * 0.2);
          g.beginPath(); g.arc(X, Y, R * 0.12, 0, TAU); g.fill();
        }
        g.globalAlpha = 1;
        // eyes
        const er = G.er, pr = er * 0.42, maxD = er - pr - 1;
        g.lineCap = g.lineJoin = 'round';
        for (let i = 0; i < 2; i++) {
          const s = i ? 1 : -1, e = eyes[i];
          let [sx, sy] = bp(s * G.ex, G.ey);
          sy += wob * er * 0.1 * Math.sin(t * 8 + s * 2.1);
          stepPupil(e, sx, sy, -fx * 0.6, -fy * 0.6, maxD, m, dt);
          g.fillStyle = CREAM;
          g.beginPath(); g.arc(sx, sy, er, 0, TAU); g.fill();
          if (dizzy > 0) {                         // hypno-spiral pupils
            g.strokeStyle = bg;
            g.lineWidth = Math.max(2.5, er * 0.1);
            g.beginPath();
            const a0 = -stirDir * t * 7 + s * 1.7;
            for (let k = 0; k <= 30; k++) {
              const rr = (k / 30) * er * 0.62;
              const aa = a0 + stirDir * k * 0.42;
              const X = sx + rr * Math.cos(aa), Y = sy + rr * Math.sin(aa);
              k ? g.lineTo(X, Y) : g.moveTo(X, Y);
            }
            g.stroke();
          } else {                                 // loose disc pupil + glint
            g.fillStyle = bg;
            g.beginPath(); g.arc(sx + e.x, sy + e.y, pr, 0, TAU); g.fill();
            g.fillStyle = CREAM;
            g.beginPath();
            g.arc(sx + e.x - pr * 0.32, sy + e.y - pr * 0.32, pr * 0.26, 0, TAU);
            g.fill();
          }
          if (blinkP >= 0) {                       // eyelid sweep
            const k = Math.sin(Math.PI * Math.min(1, blinkP));
            g.save();
            g.beginPath(); g.arc(sx, sy, er, 0, TAU); g.clip();
            g.fillStyle = CORAL;
            g.fillRect(sx - er - 2, sy - er - 2, er * 2 + 4, k * er * 2 + 2);
            g.restore();
          }
          g.strokeStyle = bg;
          g.lineWidth = Math.max(2, m * 0.008);
          g.beginPath(); g.arc(sx, sy, er, 0, TAU); g.stroke();
        }
        // mouth
        const [mx, my] = bp(0, R * 0.48);
        g.strokeStyle = bg;
        g.lineWidth = Math.max(2.5, m * 0.013);
        g.beginPath();
        if (wob > 0.4) {                           // queasy squiggle
          for (let k = 0; k <= 16; k++) {
            const X = (k / 16 - 0.5) * R * 0.44;
            const Y = Math.sin((X / R) * 22 + t * 11) * R * 0.045;
            k ? g.lineTo(mx + X, my + Y) : g.moveTo(mx + X, my + Y);
          }
        } else if (shake > 0 || bs > m * 2) {      // startled 'o'
          g.arc(mx, my, R * 0.08, 0, TAU);
        } else g.arc(mx, my - R * 0.06, R * 0.17, 0.2 * Math.PI, 0.8 * Math.PI);
        g.stroke();
      },
      down(p) {
        const G = geom();
        lx = px = p.x; ly = py = p.y; ptr = true;
        if (Math.hypot(p.x - G.cx, p.y - G.cy) < G.R * 1.2) {
          drag = true;                             // poke: recoil + startle
          bvx += (G.cx - p.x) * 3; bvy += (G.cy - p.y) * 3;
          for (const e of eyes) {
            e.vy -= G.m * (0.8 + Math.random() * 0.6);
            e.vx += G.m * (Math.random() - 0.5) * 0.8;
          }
        }
      },
      move(p) {
        const G = geom();
        px = p.x; py = p.y; ptr = true;
        const dx = p.x - G.cx, dy = p.y - G.cy;
        const a = Math.atan2(dy, dx);
        if (haveAng && Math.hypot(dx, dy) > G.R * 0.2) {
          let da = a - lastAng;
          if (da > Math.PI) da -= TAU; else if (da < -Math.PI) da += TAU;
          if (Math.abs(da) < 1.2) stir = Math.max(-20, Math.min(20, stir + da));
        }
        lastAng = a; haveAng = true;
        if (dizzy <= 0 && shake <= 0 && Math.abs(stir) > 7.5) {
          stirDir = stir < 0 ? -1 : 1;
          dizzy = 2.5; stir = 0; blinkP = -1;
        }
        if (drag && p.held) { bvx += (p.x - lx) * 14; bvy += (p.y - ly) * 14; }
        lx = p.x; ly = p.y;
      },
      up() { drag = false; },
      leave() { ptr = false; haveAng = false; drag = false; },
    };
  },
});
