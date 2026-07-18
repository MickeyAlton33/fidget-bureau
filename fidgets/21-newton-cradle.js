/* № 21 — Newton's cradle. Five steel balls on V-strings from a top bar, just
   touching. Pull an end ball (or two, or three) and let it drop: the impact
   rings elastically along the row and launches the far end by the same amount.
   Never fully still — a faint residual swing keeps it click-clacking at idle. */
F.register({
  n: 21, id: 'newton-cradle', cat: 'mech',
  title: "Newton's cradle", hint: 'Pull an end ball and let it drop',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const N = 5;
    const SKY = inks[3], CREAM = inks[5], AMBER = inks[0];

    // --- tunables ---
    const W2 = 22;            // pendulum stiffness (angular freq squared)
    const DAMP = 0.9;         // fraction of angular velocity kept per second
    const THMAX = 0.72;       // clamp on swing angle (rad)
    const SUB = 4;            // integration substeps / frame
    const PASSES = 12;        // collision-resolution passes / substep
    const CEPS = 0.6;         // contact slop (px)
    const SQK = 200, SQC = 15, SQKICK = 14; // squash spring + impact kick

    // --- state (angles measured from vertical, +x to the right) ---
    const th = new Float64Array(N);
    const om = new Float64Array(N);
    const sq = new Float64Array(N);   // squash displacement (>0 = flattened)
    const sqv = new Float64Array(N);
    const cool = new Float64Array(N - 1); // per-contact spark cooldown
    const sparks = [];               // {x,y,life,max,s}

    // --- geometry (rebuilt from env.w/env.h every frame) ---
    let W = 0, H = 0, cx = 0, r = 20, L = 120, pivY = 40, span = 40, vspr = 16, baseY = 300;
    let lastR = -1, bgrad = null;

    function makeGrad() {
      const gr = g.createRadialGradient(-r * 0.32, -r * 0.4, r * 0.05, -r * 0.06, -r * 0.06, r * 1.06);
      gr.addColorStop(0, '#F4ECE0');
      gr.addColorStop(0.13, SKY);
      gr.addColorStop(0.42, '#2C4B69');
      gr.addColorStop(0.74, '#172A3D');
      gr.addColorStop(1, '#0E1A27');
      return gr;
    }
    function geom() {
      W = env.w; H = env.h;
      const m = Math.min(W, H);
      r = m * 0.052;
      span = 2 * r;
      cx = W * 0.5;
      pivY = H * 0.18;
      L = H * 0.40;
      vspr = r * 0.85;
      baseY = H * 0.92;
      if (r !== lastR) { lastR = r; bgrad = makeGrad(); }
    }
    function pivX(i) { return cx + (i - (N - 1) * 0.5) * span; }
    function bx(i) { return pivX(i) + L * Math.sin(th[i]); }
    function by(i) { return pivY + L * Math.cos(th[i]); }

    // hardest contact seen during a frame's collision resolution
    let mrel = 0, mx = 0, my = 0, mi = 0;

    function collide() {
      for (let pass = 0; pass < PASSES; pass++) {
        for (let i = 0; i < N - 1; i++) {
          const xi = bx(i), xj = bx(i + 1);
          const gap = xj - xi - span;
          if (gap > CEPS) continue;
          const vi = L * Math.cos(th[i]) * om[i];       // horizontal speeds
          const vj = L * Math.cos(th[i + 1]) * om[i + 1];
          if (vi > vj + 1e-4) {                          // approaching: elastic swap
            const tmp = om[i]; om[i] = om[i + 1]; om[i + 1] = tmp;
            const rel = vi - vj;
            const sf = Math.min(0.4, rel / (L * 5 + 1e-6));
            sqv[i] += sf * SQKICK; sqv[i + 1] += sf * SQKICK;
            if (sqv[i] > 5) sqv[i] = 5;
            if (sqv[i + 1] > 5) sqv[i + 1] = 5;
            if (rel > mrel) { mrel = rel; mx = (xi + xj) * 0.5; my = (by(i) + by(i + 1)) * 0.5; mi = i; }
          }
          if (gap < 0) {                                 // push out of penetration
            const corr = gap * 0.5;
            th[i] += corr / (L * Math.cos(th[i]) + 1e-6);
            th[i + 1] -= corr / (L * Math.cos(th[i + 1]) + 1e-6);
          }
        }
      }
    }

    function integrate(sd, dfac, mask) {
      for (let i = 0; i < N; i++) {
        if (mask && mask[i]) continue;
        om[i] = (om[i] - W2 * Math.sin(th[i]) * sd) * dfac;
        if (om[i] > 8) om[i] = 8; else if (om[i] < -8) om[i] = -8;
        th[i] += om[i] * sd;
        if (th[i] > THMAX) { th[i] = THMAX; if (om[i] > 0) om[i] = 0; }
        else if (th[i] < -THMAX) { th[i] = -THMAX; if (om[i] < 0) om[i] = 0; }
      }
    }

    function simulate(dt) {
      mrel = 0;
      const sd = dt / SUB, dfac = Math.pow(DAMP, sd);
      const mask = grab ? grab.mask : null;
      for (let s = 0; s < SUB; s++) {
        integrate(sd, dfac, mask);
        collide();
        if (grab) for (const i of grab.group) { th[i] = grab.ang; om[i] = 0; }
      }
    }

    function nudge(dt) {
      let E = 0;
      for (let i = 0; i < N; i++) E += 0.5 * om[i] * om[i] + W2 * (1 - Math.cos(th[i]));
      if (E < 0.24) lowT += dt; else lowT = 0;
      if (lowT > 0.7) {                                  // faint ambient kick to an end
        const end = Math.random() < 0.5 ? 0 : N - 1;
        om[end] += (end === 0 ? -1 : 1) * (0.9 + Math.random() * 0.6);
        lowT = 0;
      }
    }

    // grab + idle state
    let grab = null;
    let lowT = 0;

    geom();
    th[0] = -0.5; // start lifted so it is already dropping on frame 1

    // ---- drawing ----
    function drawFrame() {
      const x0 = pivX(0) - r * 1.7, x1 = pivX(N - 1) + r * 1.7;
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = CREAM; g.globalAlpha = 0.2; g.lineWidth = Math.max(2, r * 0.22);
      g.beginPath();
      g.moveTo(x0, pivY); g.lineTo(x0, baseY);
      g.moveTo(x1, pivY); g.lineTo(x1, baseY);
      g.moveTo(x0 - r * 0.5, baseY); g.lineTo(x1 + r * 0.5, baseY);
      g.stroke();
      g.globalAlpha = 1;
      g.lineWidth = Math.max(4, r * 0.42);               // bold top bar
      g.beginPath(); g.moveTo(x0 - r * 0.5, pivY); g.lineTo(x1 + r * 0.5, pivY); g.stroke();
      g.globalAlpha = 0.22; g.strokeStyle = SKY; g.lineWidth = Math.max(2, r * 0.16);
      g.beginPath(); g.moveTo(x0, pivY + r * 0.24); g.lineTo(x1, pivY + r * 0.24); g.stroke();
      g.globalAlpha = 1;
    }
    function drawStrings() {
      g.strokeStyle = CREAM; g.globalAlpha = 0.5; g.lineWidth = Math.max(1.4, r * 0.09);
      g.beginPath();
      for (let i = 0; i < N; i++) {
        const X = bx(i), Y = by(i), p = pivX(i);
        g.moveTo(p - vspr, pivY); g.lineTo(X, Y);
        g.moveTo(p + vspr, pivY); g.lineTo(X, Y);
      }
      g.stroke();
      g.globalAlpha = 1;
    }
    function drawBall(X, Y, s, held) {
      const c = s < -0.26 ? -0.26 : s > 0.34 ? 0.34 : s;
      g.save();
      g.translate(X, Y);
      g.scale(1 - c, 1 + c * 0.5);                       // horizontal squash on impact
      g.fillStyle = bgrad;
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.globalAlpha = 0.45; g.strokeStyle = SKY; g.lineWidth = Math.max(1.2, r * 0.08);
      g.beginPath(); g.arc(0, 0, r * 0.92, 0.12 * Math.PI, 0.72 * Math.PI); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(244,236,224,0.92)';            // hot specular dot
      g.beginPath(); g.arc(-r * 0.33, -r * 0.4, r * 0.14, 0, TAU); g.fill();
      g.restore();
      if (held) {
        g.strokeStyle = CREAM; g.globalAlpha = 0.6; g.lineWidth = Math.max(2, r * 0.13);
        g.beginPath(); g.arc(X, Y, r * 1.3, 0, TAU); g.stroke();
        g.globalAlpha = 1;
      }
    }
    function drawSparks() {
      if (!sparks.length) return;
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < sparks.length; k++) {
        const s = sparks[k], u = s.life / s.max;
        const rad = r * (0.3 + (1 - u) * 0.85) * (0.55 + s.s);
        g.globalAlpha = 0.45 * u; g.fillStyle = AMBER;
        g.beginPath(); g.arc(s.x, s.y, rad, 0, TAU); g.fill();
        g.globalAlpha = 0.85 * u; g.fillStyle = CREAM;
        g.beginPath(); g.arc(s.x, s.y, rad * 0.4, 0, TAU); g.fill();
        if (u > 0.55 && s.s > 0.14) {                    // radiating clack ticks
          g.globalAlpha = (u - 0.55) / 0.45 * 0.7; g.strokeStyle = CREAM;
          g.lineWidth = Math.max(1, r * 0.06);
          const tl = rad * 1.5;
          g.beginPath();
          for (let q = 0; q < 4; q++) {
            const a = q * (Math.PI * 0.5) + 0.4;
            g.moveTo(s.x + Math.cos(a) * rad * 0.3, s.y + Math.sin(a) * rad * 0.3);
            g.lineTo(s.x + Math.cos(a) * tl, s.y + Math.sin(a) * tl);
          }
          g.stroke();
        }
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }

    return {
      draw(t, dt) {
        geom();
        simulate(dt);
        for (let i = 0; i < N; i++) {                    // squash springs back with overshoot
          sqv[i] += (-SQK * sq[i] - SQC * sqv[i]) * dt;
          sq[i] += sqv[i] * dt;
        }
        for (let i = 0; i < N - 1; i++) if (cool[i] > 0) cool[i] -= dt;
        if (mrel > 0.7 * L && cool[mi] <= 0) {           // one flash at the hardest contact
          const sf = Math.min(0.4, Math.max(0.05, mrel / (L * 6 + 1e-6)));
          if (sparks.length > 22) sparks.shift();
          const life = 0.16 + sf * 0.22;
          sparks.push({ x: mx, y: my, life, max: life, s: sf });
          cool[mi] = 0.08;
        }
        for (let k = sparks.length - 1; k >= 0; k--) {
          sparks[k].life -= dt;
          if (sparks[k].life <= 0) sparks.splice(k, 1);
        }
        if (!grab) nudge(dt);

        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        drawFrame();
        drawStrings();
        for (let i = 0; i < N; i++) drawBall(bx(i), by(i), sq[i], grab && grab.mask[i]);
        drawSparks();
      },
      down(p) {
        geom();
        let gi = -1, best = 1e9;
        for (let i = 0; i < N; i++) {
          const d = Math.hypot(p.x - bx(i), p.y - by(i));
          if (d < r * 1.5 && d < best) { best = d; gi = i; }
        }
        if (gi < 0) { grab = null; return; }
        for (let i = 0; i < N; i++) om[i] = 0;            // catch the works
        const group = [], mask = [false, false, false, false, false];
        let side;
        if (gi <= (N - 1) * 0.5) { for (let i = 0; i <= gi; i++) { group.push(i); mask[i] = true; } side = -1; }
        else { for (let i = gi; i < N; i++) { group.push(i); mask[i] = true; } side = 1; }
        const a = th[gi];
        for (const i of group) th[i] = a;                // lift as a rigid touching set
        grab = { group, mask, side, gi, ang: a, lastTh: a, flick: 0 };
      },
      move(p) {
        if (!grab || !p.held) return;
        geom();
        let a = Math.atan2(p.x - pivX(grab.gi), p.y - pivY);
        if (grab.side < 0) a = a < -THMAX ? -THMAX : a > 0 ? 0 : a;   // stays on its own side
        else a = a > THMAX ? THMAX : a < 0 ? 0 : a;
        grab.flick = grab.flick * 0.6 + (a - grab.lastTh) * 24;
        grab.lastTh = a;
        grab.ang = a;
        for (const i of grab.group) { th[i] = a; om[i] = 0; }
      },
      up() {
        if (!grab) return;
        const f = grab.flick < -6 ? -6 : grab.flick > 6 ? 6 : grab.flick;
        for (const i of grab.group) om[i] = f;
        grab = null;
      },
      resize() { geom(); },
    };
  },
});
