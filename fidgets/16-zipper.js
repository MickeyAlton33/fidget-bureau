/* № 16 — Zipper. A gently S-curved zipper spans the card. Drag the chunky
   slider along the path: each tooth pair rotates crisply out of (or into)
   mesh as the tab passes — fast drags produce a sequential cascade. The open
   halves sway with a lazy cloth pendulum; idle, the tab creeps a few teeth. */
F.register({
  n: 16, id: 'zipper', cat: 'mech',
  title: 'Zipper', hint: 'Drag the slider up and down',
  make(env) {
    const { g, inks, bg } = env;
    const N = 120, NT = 72;                       // spline samples, teeth (36 pairs)
    const px = new Float32Array(N), py = new Float32Array(N);
    const nx = new Float32Array(N), ny = new Float32Array(N);
    const tx = new Float32Array(N), ty = new Float32Array(N);
    const uT = new Float32Array(NT), zT = new Float32Array(NT);
    const fx = new Float32Array(41), fy = new Float32Array(41);
    const U0 = 0.06, STEP = (0.97 - U0) / (NT - 1);
    const AMBER = inks[0], CREAM = 'rgba(242,233,220,0.8)', SKY = inks[3];
    let s = 0.55, sTgt = 0.55, sRest = 0.55;      // slider path parameter (0=top)
    let dragging = false, hoverNear = false;
    let flapA = 0, flapV = 0;                     // cloth pendulum (open halves)
    let pullA = 0, pullV = 0;                     // dangling pull-tab spring
    let lastAct = -9, idlePh = 0, tNow = 0;
    let toothL = 12, spreadMax = 60;
    const clampS = v => Math.max(0.035, Math.min(0.975, v));
    const eob = x => { const y = x - 1; return 1 + 2.7 * y * y * y + 1.7 * y * y; };

    function layout() {
      const w = env.w, h = env.h;
      for (let i = 0; i < N; i++) {
        const v = i / (N - 1);
        px[i] = 0.5 * w + 0.10 * w * Math.sin(v * Math.PI * 2);
        py[i] = (0.05 + 0.90 * v) * h;
      }
      for (let i = 0; i < N; i++) {
        const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1);
        const dx = px[b] - px[a], dy = py[b] - py[a];
        const L = Math.hypot(dx, dy) + 1e-6;
        tx[i] = dx / L; ty[i] = dy / L;
        nx[i] = -ty[i]; ny[i] = tx[i];
      }
      toothL = Math.max(9, Math.min(15, 0.045 * Math.min(w, h)));
      spreadMax = 0.19 * w;
    }
    layout();
    for (let k = 0; k < NT; k++) { uT[k] = U0 + k * STEP; zT[k] = uT[k] > s ? 1 : 0; }

    const PA = {}, PB = {};
    function pathAt(u, o) {
      const f = Math.max(0, Math.min(1, u)) * (N - 1);
      const i = f | 0, j = Math.min(i + 1, N - 1), r = f - i;
      o.x = px[i] + (px[j] - px[i]) * r; o.y = py[i] + (py[j] - py[i]) * r;
      o.nx = nx[i] + (nx[j] - nx[i]) * r; o.ny = ny[i] + (ny[j] - ny[i]) * r;
      o.tx = tx[i] + (tx[j] - tx[i]) * r; o.ty = ty[i] + (ty[j] - ty[i]) * r;
      return o;
    }
    function lat(u, side) {                       // lateral offset of a tape edge
      if (u >= s) return side * 8;
      const d = s - u;
      const amb = 0.035 * Math.sin(tNow * 0.6 + (side > 0 ? 0 : 2.3));
      return side * (8 + spreadMax * Math.tanh(d * 2.6)) + (flapA + amb) * d * env.h * 0.9;
    }
    function project(p) {                         // nearest path parameter to pointer
      let best = 0, bd = 1e18;
      for (let i = 0; i < N; i += 2) {
        const dx = p.x - px[i], dy = p.y - py[i], q = dx * dx + dy * dy;
        if (q < bd) { bd = q; best = i; }
      }
      return best / (N - 1);
    }

    return {
      draw(t, dt) {
        tNow = t;
        if (!dragging && t - lastAct > 2.2) {     // idle: creep up a few teeth, back down
          idlePh += dt * 0.9;
          sTgt = clampS(sRest - 7 * STEP * 0.5 * (1 - Math.cos(idlePh)));
        }
        const s0 = s;
        s += (sTgt - s) * (1 - Math.exp(-(dragging ? 16 : 3.2) * dt));
        const v = (s - s0) / Math.max(dt, 1e-4);
        flapV += (-flapA * 8 - flapV * 2.2 + v * 0.10) * dt;
        flapA = Math.max(-0.09, Math.min(0.09, flapA + flapV * dt));
        pullV += (-pullA * 55 - pullV * 4.5 - v * 6) * dt;
        pullA = Math.max(-0.9, Math.min(0.9, pullA + pullV * dt));

        g.fillStyle = bg;
        g.fillRect(0, 0, env.w, env.h);

        // fabric halves: translucent regions bounded by the (diverging) tape edges
        for (let side = 1; side >= -1; side -= 2) {
          for (let i = 0; i <= 40; i++) {
            const P = pathAt(1 - i / 40, PA), o = lat(1 - i / 40, side);
            fx[i] = P.x + P.nx * o; fy[i] = P.y + P.ny * o;
          }
          g.beginPath();
          g.moveTo(fx[0], env.h + 12);
          for (let i = 0; i <= 40; i++) g.lineTo(fx[i], fy[i]);
          g.lineTo(fx[40], -12);
          g.lineTo(side > 0 ? -12 : env.w + 12, -12);
          g.lineTo(side > 0 ? -12 : env.w + 12, env.h + 12);
          g.closePath();
          g.fillStyle = 'rgba(242,233,220,0.06)';
          g.fill();
          g.beginPath();                          // tape edge seam
          g.moveTo(fx[0], fy[0]);
          for (let i = 1; i <= 40; i++) g.lineTo(fx[i], fy[i]);
          g.strokeStyle = 'rgba(245,165,36,0.45)';
          g.lineWidth = 2;
          g.lineJoin = 'round';
          g.stroke();
        }

        // teeth: each flips pose over ~150ms as the slider passes it
        g.lineCap = 'round';
        const dz = dt / 0.15;
        for (let k = 0; k < NT; k++) {
          const u = uT[k], side = (k & 1) ? -1 : 1;
          const tgt = u > s ? 1 : 0;              // below slider = zipped
          let z = zT[k];
          z += Math.max(-dz, Math.min(dz, tgt - z));
          zT[k] = z;
          const e = tgt === 1 ? eob(z) : 1 - eob(1 - z);
          const P = pathAt(u, PA);
          const na = Math.atan2(P.ny, P.nx);
          const o = lat(u, side);
          const ux = P.x + P.nx * o, uy = P.y + P.ny * o;      // unzipped: on its tape edge
          const zx = P.x + P.nx * side * 2.8, zy = P.y + P.ny * side * 2.8; // zipped: meshed
          const aU = na + side * 0.9 + flapA * 1.8, aZ = na;
          const X = ux + (zx - ux) * e, Y = uy + (zy - uy) * e;
          const A = aU + (aZ - aU) * e;
          const pulse = Math.sin(Math.PI * Math.max(0, Math.min(1, z)));   // click pop
          const half = toothL * (0.85 + 0.15 * e) * 0.5;
          const cx = Math.cos(A) * half, cy = Math.sin(A) * half;
          g.strokeStyle = (k >> 1) & 1 ? CREAM : AMBER;
          g.lineWidth = toothL * 0.55 * (1 + 0.5 * pulse);
          g.beginPath();
          g.moveTo(X - cx, Y - cy);
          g.lineTo(X + cx, Y + cy);
          g.stroke();
        }

        // slider tab
        const S = pathAt(s, PB);
        const sc = Math.max(0.8, Math.min(1.35, Math.min(env.w, env.h) / 320));
        g.save();
        g.translate(S.x, S.y);
        g.rotate(Math.atan2(S.ty, S.tx) - Math.PI / 2);
        g.scale(sc, sc);
        if (hoverNear || dragging) {
          g.fillStyle = 'rgba(242,233,220,0.09)';
          g.beginPath(); g.arc(0, 0, 27, 0, Math.PI * 2); g.fill();
        }
        g.beginPath();
        g.moveTo(-12, -14); g.lineTo(12, -14); g.lineTo(7.5, 11); g.lineTo(-7.5, 11);
        g.closePath();
        g.fillStyle = bg; g.fill();
        g.strokeStyle = SKY; g.lineWidth = 3; g.lineJoin = 'round'; g.stroke();
        g.strokeStyle = 'rgba(242,233,220,0.5)'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(-5, -6); g.lineTo(5, -6); g.stroke();
        const dx = Math.sin(pullA), dy = Math.cos(pullA);      // dangling pull
        g.strokeStyle = SKY; g.lineWidth = 2.5;
        g.beginPath(); g.arc(dx * 5, 11 + dy * 5, 3.5, 0, Math.PI * 2); g.stroke();
        g.lineWidth = 8;
        g.beginPath();
        g.moveTo(dx * 10, 11 + dy * 10); g.lineTo(dx * 22, 11 + dy * 22);
        g.stroke();
        g.restore();
      },
      down(p) {
        dragging = true; hoverNear = true;
        lastAct = tNow; idlePh = 0;
        sTgt = clampS(project(p));
        pullV += 3;                               // little jolt on grab
      },
      move(p) {
        if (p.held && dragging) { sTgt = clampS(project(p)); lastAct = tNow; return; }
        const S = pathAt(s, PB);
        hoverNear = Math.hypot(p.x - S.x, p.y - S.y) < 34;
      },
      up() {
        dragging = false;
        sRest = clampS(sTgt);
        lastAct = tNow; idlePh = 0;
      },
      dbl(p) {                                    // double-tap: zip to the near end
        sTgt = p.y < env.h / 2 ? 0.035 : 0.975;
        sRest = sTgt; lastAct = tNow; idlePh = 0;
      },
      leave() { hoverNear = false; },
      resize() { layout(); },
    };
  },
});
