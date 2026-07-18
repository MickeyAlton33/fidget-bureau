/* № 06 — Strandbeest. Two mirrored Jansen-linkage leg pairs on one crankshaft,
   solved in closed form each frame. Drag horizontally to walk it; the ground
   scrolls under the planted feet and every footfall kicks a puff of dust. */
F.register({
  n: 6, id: 'strandbeest', cat: 'mech',
  title: 'Strandbeest', hint: 'Drag left or right to make it walk',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    // Theo Jansen's holy numbers (linkage units)
    const La = 38.0, Lb = 41.5, Lc = 39.3, Ld = 40.1, Le = 55.8, Lf = 39.4,
          Lg = 36.7, Lh = 65.7, Li = 49.0, Lj = 50.0, Lk = 61.9, Ll = 7.8, Lm = 15.0;
    const SGN = [-1, -1, 1, 1, -1]; // branch picks (verified at crank angle 0, y-down)
    const FOOT_Y = 91.8;            // lowest foot y over a full crank revolution
    const STRIDE = 20.54;           // stance-foot units per radian of crank
    const MINT = inks[2], CREAM = inks[5], AMBER = inks[0];
    const IDLE = 1.15;
    let theta = 0, vel = IDLE, grab = null, flick = 0;
    let groundOff = 0, groundVel = 0;
    let S = 1, cx = 0, cy = 0, gy = 0;
    const dust = [];
    // A mirrored pair shares its crank pin: the side:-1 leg is the canonical leg
    // solved at PI - psi then x-flipped, so at theta=0 the near pair sits at
    // effective crank phases 0 and PI. Far pair (dim, behind) rides a second
    // crank throw at +PI/2 for a four-beat gait.
    const legs = [
      { ph: Math.PI / 2, side: 1, far: 1 }, { ph: Math.PI / 2, side: -1, far: 1 },
      { ph: 0, side: 1, far: 0 }, { ph: 0, side: -1, far: 0 },
    ];
    // P = [Cx,Cy, Tx,Ty, Ex,Ey, Kx,Ky, Nx,Ny, Fx,Fy] in canonical linkage units
    for (const L of legs) { L.P = new Float64Array(12); L.air = true; }

    let ox = 0, oy = 0;
    function xs(px, py, pr, qx, qy, qr, s) { // circle-circle intersection
      const dx = qx - px, dy = qy - py, D = Math.hypot(dx, dy) + 1e-9;
      if (D > pr + qr || D < Math.abs(pr - qr)) return false;
      const A = (pr * pr - qr * qr + D * D) / (2 * D);
      const H = Math.sqrt(Math.max(0, pr * pr - A * A));
      ox = px + (A * dx - s * dy * H) / D;
      oy = py + (A * dy + s * dx * H) / D;
      return true;
    }
    function solve(L, psi) {
      // fixed pivot A=(-La,Ll); on failure a joint keeps its last valid spot
      const P = L.P, phi = L.side > 0 ? psi : Math.PI - psi;
      P[0] = Lm * Math.cos(phi); P[1] = Lm * Math.sin(phi);
      if (xs(-La, Ll, Lb, P[0], P[1], Lj, SGN[0])) { P[2] = ox; P[3] = oy; }
      if (xs(-La, Ll, Ld, P[2], P[3], Le, SGN[1])) { P[4] = ox; P[5] = oy; }
      if (xs(-La, Ll, Lc, P[0], P[1], Lk, SGN[2])) { P[6] = ox; P[7] = oy; }
      if (xs(P[4], P[5], Lf, P[6], P[7], Lg, SGN[3])) { P[8] = ox; P[9] = oy; }
      if (xs(P[6], P[7], Li, P[8], P[9], Lh, SGN[4])) { P[10] = ox; P[11] = oy; }
    }
    for (const L of legs) { solve(L, L.ph); L.air = L.P[11] < FOOT_Y - 3.4; }

    function drawLeg(L) {
      const P = L.P, s = L.side, dim = L.far;
      const ax = cx - s * La * S, ay = cy + Ll * S;
      const x = i => cx + s * P[i] * S, y = i => cy + P[i + 1] * S;
      g.lineCap = g.lineJoin = 'round';
      g.globalAlpha = dim ? 0.26 : 1;
      g.lineWidth = dim ? 2 : 3;
      g.strokeStyle = MINT; // the two rigid triangles: (A,T,E) and (K,N,F)
      g.beginPath();
      g.moveTo(ax, ay); g.lineTo(x(2), y(2)); g.lineTo(x(4), y(4)); g.closePath();
      g.moveTo(x(6), y(6)); g.lineTo(x(8), y(8)); g.lineTo(x(10), y(10)); g.closePath();
      g.stroke();
      g.strokeStyle = CREAM; // rods j, k, c, f
      g.beginPath();
      g.moveTo(x(0), y(0)); g.lineTo(x(2), y(2));
      g.moveTo(x(0), y(0)); g.lineTo(x(6), y(6));
      g.moveTo(ax, ay); g.lineTo(x(6), y(6));
      g.moveTo(x(4), y(4)); g.lineTo(x(8), y(8));
      g.stroke();
      if (!dim) {
        const r = Math.max(2, 2.1 * S);
        g.fillStyle = bg; g.lineWidth = 1.6;
        for (const i of [2, 4, 6, 8]) {
          g.beginPath(); g.arc(x(i), y(i), r, 0, TAU); g.fill(); g.stroke();
        }
        g.fillStyle = MINT; // foot pad
        g.beginPath(); g.arc(x(10), y(10), r * 1.4, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    }

    return {
      draw(t, dt) {
        const w = env.w, h = env.h;
        S = Math.max(0.2, Math.min(w, h) / 240);
        cx = w / 2; gy = h * 0.78; cy = gy - FOOT_Y * S;
        if (grab) flick *= Math.pow(0.05, dt); // holding still bleeds the flick
        else { vel = IDLE + (vel - IDLE) * Math.pow(0.5, dt); theta += vel * dt; }
        // solve legs; planted feet drive the ground, landings kick dust
        let acc = 0, nc = 0;
        for (const L of legs) {
          const pfx = L.P[10];
          solve(L, theta + L.ph);
          const fx = L.P[10], fy = L.P[11], onG = fy >= FOOT_Y - 2.2;
          if (onG) { acc += L.side * (fx - pfx) * S; nc++; }
          if (L.air && onG) {
            const px = cx + L.side * fx * S, n = L.far ? 2 : 4;
            for (let q = 0; q < n; q++) {
              if (dust.length >= 48) dust.shift();
              dust.push({
                x: px + (Math.random() - 0.5) * 9 * S, y: gy - 1,
                vx: (Math.random() - 0.5) * 26 * S + groundVel * 0.6,
                vy: -(15 + Math.random() * 30) * S,
                life: 0.4 + Math.random() * 0.3, max: 0.7, dim: L.far,
              });
            }
          }
          L.air = fy < FOOT_Y - 3.4;
        }
        if (dt > 1e-4) {
          if (nc) groundVel += (acc / nc / dt - groundVel) * (1 - Math.pow(0.002, dt));
          else groundVel *= Math.pow(0.3, dt);
        }
        groundOff += groundVel * dt;
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        // scrolling ground: baseline plus raked tick marks moving with the feet
        g.strokeStyle = CREAM; g.lineCap = 'round';
        g.globalAlpha = 0.4; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, gy + 1); g.lineTo(w, gy + 1); g.stroke();
        g.globalAlpha = 0.2;
        const sp = 24 * S, x0 = ((groundOff % sp) + sp) % sp - sp;
        g.beginPath();
        for (let x = x0; x < w + sp; x += sp) {
          g.moveTo(x, gy + 4); g.lineTo(x - 5 * S, gy + 9 * S);
        }
        g.stroke(); g.globalAlpha = 1;
        drawLeg(legs[0]); drawLeg(legs[1]); // far pair, dim, behind
        // chassis truss between the two fixed pivots
        const ay = cy + Ll * S;
        g.strokeStyle = CREAM; g.lineWidth = 3; g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(cx - La * S, ay); g.lineTo(cx + La * S, ay);
        g.moveTo(cx - La * S, ay); g.lineTo(cx, cy); g.lineTo(cx + La * S, ay);
        g.stroke();
        for (const sd of [-1, 1]) {
          g.fillStyle = bg; g.lineWidth = 1.6;
          g.beginPath(); g.arc(cx + sd * La * S, ay, Math.max(2, 2.1 * S), 0, TAU);
          g.fill(); g.stroke();
        }
        drawLeg(legs[2]); drawLeg(legs[3]); // near pair, bold
        // crankshaft: one throw per pair, quarter turn apart
        g.strokeStyle = AMBER; g.fillStyle = AMBER;
        for (const ph of [Math.PI / 2, 0]) {
          const pinx = cx + Lm * S * Math.cos(theta + ph);
          const piny = cy + Lm * S * Math.sin(theta + ph);
          g.globalAlpha = ph ? 0.35 : 1; g.lineWidth = ph ? 2 : 3;
          g.beginPath(); g.moveTo(cx, cy); g.lineTo(pinx, piny); g.stroke();
          g.beginPath(); g.arc(pinx, piny, ph ? 2.2 : 3, 0, TAU); g.fill();
        }
        g.globalAlpha = 1;
        g.beginPath(); g.arc(cx, cy, Math.max(3, 3.2 * S), 0, TAU); g.fill();
        // dust puffs
        for (let i = dust.length - 1; i >= 0; i--) {
          const D = dust[i];
          D.life -= dt;
          if (D.life <= 0) { dust.splice(i, 1); continue; }
          D.x += D.vx * dt; D.y += D.vy * dt; D.vy += 90 * S * dt;
          const u = D.life / D.max;
          g.globalAlpha = u * (D.dim ? 0.22 : 0.5);
          g.fillStyle = CREAM;
          g.beginPath();
          g.arc(D.x, D.y, 1.4 + (1 - u) * 3.6 * S, 0, TAU);
          g.fill();
        }
        g.globalAlpha = 1;
      },
      down(p) { grab = { x: p.x }; vel = 0; flick = 0; },
      move(p) {
        if (!grab || !p.held) return;
        const dph = (p.x - grab.x) / (STRIDE * S); // drag right -> walk right
        grab.x = p.x;
        theta += dph;
        flick = flick * 0.55 + dph * 27;
      },
      up() {
        if (grab) vel = Math.max(-10, Math.min(10, flick));
        grab = null;
      },
    };
  },
});
