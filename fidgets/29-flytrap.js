/* № 29 — Venus flytrap. Two hinged jaws on swaying stems: mint lobes with a
   coral throat, cream trigger-teeth that interlock, and a glinting nectar lure.
   IDLE it breathes — jaws ease open and settle, the stems sway, the lure pulses.
   Poke inside an open trap and it SNAPS shut in a couple of frames (a hard
   squash past-closed), holds a beat, then creaks slowly back open with an
   elastic overshoot before settling. Each trap fires independently. Springs on
   every moving part; squash & stretch driven by the closing velocity. */
F.register({
  n: 29, id: 'flytrap', cat: 'critters',
  title: 'Venus flytrap', hint: 'Poke inside the trap to make it snap',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const MINT = inks[2], CORAL = inks[1], CREAM = inks[5], AMBER = inks[0];
    const SHADE = 'rgba(20,16,13,0.42)';   // bg-based edge darkener
    const GLINT = 'rgba(242,233,220,0.55)'; // cream-based highlight
    const CLOSED = 0.02;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

    // static config per trap; positions/sizes resolved in layout()
    const CFG = [
      { xk: 0.39, topYk: 0.37, baseXk: 0.47, sizeK: 0.30, openHalf: 0.55, lean: -0.13, swayW: 0.55, breW: 1.00 },
      { xk: 0.68, topYk: 0.55, baseXk: 0.56, sizeK: 0.21, openHalf: 0.50, lean: 0.17, swayW: 0.72, breW: 1.35 },
    ];

    let m = 1;
    const traps = CFG.map(c => ({
      cfg: c,
      half: c.openHalf, hv: 0, phase: 'idle', pt: 0, holdDur: 0.3,
      breath: Math.random() * TAU, swayPh: Math.random() * TAU,
      bendX: 0, bendV: 0, squash: 0, hover: 0, glow: 0, flash: 0,
      baseX: 0, baseY: 0, topX: 0, topY: 0, L: 1,
      hx: 0, hy: 0, axis: -Math.PI / 2,
    }));

    function layout() {
      m = Math.min(env.w, env.h);
      for (const T of traps) {
        const c = T.cfg;
        T.baseX = env.w * c.baseXk; T.baseY = env.h * 1.09;
        T.topX = env.w * c.xk; T.topY = env.h * c.topYk;
        T.L = c.sizeK * m;
        T.hx = T.topX; T.hy = T.topY; T.axis = -Math.PI / 2 + c.lean;
      }
    }
    layout();

    // ---- physics (one sub-step) --------------------------------------------
    function step(T, t, h) {
      const c = T.cfg;
      const swayTarget = 0.05 * m * Math.sin(t * c.swayW + T.swayPh);
      T.bendV += ((swayTarget - T.bendX) * 30 - 6.5 * T.bendV) * h;
      T.bendV = clamp(T.bendV, -40 * m, 40 * m);
      T.bendX = clamp(T.bendX + T.bendV * h, -0.16 * env.w - 1, 0.16 * env.w + 1);

      let target, K, C;
      if (T.phase === 'closing') { target = CLOSED; K = 1500; C = 42; }        // explosive
      else if (T.phase === 'hold') { target = CLOSED; K = 900; C = 60; }        // clamp shut
      else if (T.phase === 'reopen') { target = c.openHalf; K = 40; C = 5.2; }  // slow, springy
      else { target = c.openHalf + 0.06 * Math.sin(t * c.breW + T.breath); K = 52; C = 8.5; }
      T.hv = clamp(T.hv + ((target - T.half) * K - C * T.hv) * h, -90, 90);
      T.half = clamp(T.half + T.hv * h, -0.05, 1.3);
    }

    // is pointer p inside trap T's open mouth wedge?
    function wedgeTest(T, p) {
      const dx = p.x - T.hx, dy = p.y - T.hy;
      const ca = Math.cos(-T.axis), sa = Math.sin(-T.axis);
      const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
      if (lx < -0.12 * T.L) return false;
      const rr = Math.hypot(lx, ly);
      if (rr > T.L * 1.25) return false;
      return Math.abs(Math.atan2(ly, lx)) < T.half + 0.16;
    }

    function snap(T) {
      T.phase = 'closing'; T.pt = 0;
      T.hv = Math.min(T.hv, -13);                 // visible on the very next frame
      T.bendV += (Math.random() * 2 - 1) * 0.7 * m;
      T.flash = 1;
      T.holdDur = 0.26 + Math.random() * 0.22;
    }

    // ---- drawing ------------------------------------------------------------
    function drawSoil() {
      g.fillStyle = 'rgba(79,201,160,0.08)';
      g.beginPath();
      g.ellipse(env.w * 0.5, env.h * 1.06, env.w * 0.5, env.h * 0.14, 0, 0, TAU);
      g.fill();
    }

    function stemPath(x0, y0, cx, cy, x1, y1, wB, wT) {
      const N = 10;
      g.beginPath();
      for (let pass = 0; pass < 2; pass++) {
        for (let j = 0; j <= N; j++) {
          const i = pass === 0 ? j : N - j;
          const s = i / N, u = 1 - s;
          const bx = u * u * x0 + 2 * u * s * cx + s * s * x1;
          const by = u * u * y0 + 2 * u * s * cy + s * s * y1;
          const tx = 2 * u * (cx - x0) + 2 * s * (x1 - cx);
          const ty = 2 * u * (cy - y0) + 2 * s * (y1 - cy);
          const tl = Math.hypot(tx, ty) + 1e-6;
          const nx = -ty / tl, ny = tx / tl;
          const wd = (wB * u + wT * s) * 0.5 * (pass === 0 ? 1 : -1);
          const px = bx + nx * wd, py = by + ny * wd;
          if (pass === 0 && j === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
      }
      g.closePath();
    }

    function drawThroat(L, half) {
      const open = clamp(half / 0.5, 0, 1.3);
      const tw = L * 0.52 * (0.16 + 0.9 * open);
      const tl = L * 0.95;
      g.fillStyle = CORAL;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(tl * 0.42, -tw, tl * 0.9, 0);
      g.quadraticCurveTo(tl * 0.42, tw, 0, 0);
      g.closePath(); g.fill();
      g.fillStyle = SHADE;
      g.beginPath();
      g.ellipse(tl * 0.2, 0, tl * 0.22, tw * 0.55 + 1e-3, 0, 0, TAU);
      g.fill();
    }

    function drawLure(L, half, t, glow) {
      const a = clamp(half / 0.4, 0, 1);
      if (a <= 0.02) return;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.1);
      const bright = 0.5 + 0.5 * glow;
      g.globalAlpha = 0.5 * a;
      g.fillStyle = AMBER;
      g.beginPath(); g.arc(L * 0.52, -L * 0.12, L * 0.022, 0, TAU); g.fill();
      g.beginPath(); g.arc(L * 0.50, L * 0.14, L * 0.020, 0, TAU); g.fill();
      const r = L * 0.055 * (0.85 + 0.25 * pulse);
      g.globalAlpha = a;
      g.fillStyle = AMBER;
      g.beginPath(); g.arc(L * 0.34, 0, r, 0, TAU); g.fill();
      g.globalAlpha = a * (0.55 + 0.45 * pulse) * bright;
      g.fillStyle = CREAM;
      g.beginPath(); g.arc(L * 0.34 - r * 0.3, -r * 0.3, r * 0.45, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }

    function drawJaw(sd, L, Th, half) {
      const la = sd * half;
      const c = Math.cos(la), s = Math.sin(la);
      const mpx = sd * s, mpy = -sd * c;         // unit perp toward the gap
      const N = 12;
      const rim = [], out = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const prof = Math.pow(Math.sin(Math.PI * Math.min(1, u)), 0.62);
        const scoop = 0.09 * L * Math.sin(Math.PI * u);
        const rx = c * L * u - mpx * scoop;
        const ry = s * L * u - mpy * scoop;
        const th = Th * prof + 0.03 * L;
        rim.push(rx, ry);
        out.push(rx - mpx * th, ry - mpy * th);  // back edge, away from gap
      }
      // mint body
      g.fillStyle = MINT;
      g.beginPath();
      g.moveTo(rim[0], rim[1]);
      for (let i = 1; i <= N; i++) g.lineTo(rim[2 * i], rim[2 * i + 1]);
      for (let i = N; i >= 0; i--) g.lineTo(out[2 * i], out[2 * i + 1]);
      g.closePath(); g.fill();
      // coral inner lip (gap-side ~half of the thickness)
      g.fillStyle = CORAL;
      g.beginPath();
      g.moveTo(rim[0], rim[1]);
      for (let i = 1; i <= N; i++) g.lineTo(rim[2 * i], rim[2 * i + 1]);
      for (let i = N; i >= 0; i--) {
        g.lineTo(rim[2 * i] * 0.52 + out[2 * i] * 0.48, rim[2 * i + 1] * 0.52 + out[2 * i + 1] * 0.48);
      }
      g.closePath(); g.fill();
      // outline
      g.strokeStyle = SHADE; g.lineWidth = Math.max(1.4, 0.022 * L); g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(rim[0], rim[1]);
      for (let i = 1; i <= N; i++) g.lineTo(rim[2 * i], rim[2 * i + 1]);
      for (let i = N; i >= 0; i--) g.lineTo(out[2 * i], out[2 * i + 1]);
      g.closePath(); g.stroke();
    }

    function drawTeeth(sd, L, half) {
      const la = sd * half;
      const c = Math.cos(la), s = Math.sin(la);
      const mpx = sd * s, mpy = -sd * c;
      const n = 6;
      g.fillStyle = CREAM;
      g.strokeStyle = SHADE;
      g.lineWidth = Math.max(0.8, 0.006 * L);
      g.lineJoin = 'round';
      for (let k = 0; k < n; k++) {
        const u = 0.17 + (k + (sd > 0 ? 0.5 : 0)) * (0.76 / n);  // staggered → interlock
        if (u > 0.98) continue;
        const prof = Math.pow(Math.sin(Math.PI * u), 0.5);
        const scoop = 0.09 * L * Math.sin(Math.PI * u);
        const bx = c * L * u - mpx * scoop;
        const by = s * L * u - mpy * scoop;
        const tlen = 0.14 * L * (0.5 + 0.65 * prof);
        const bw = 0.03 * L * (0.4 + 0.7 * prof);
        g.beginPath();
        g.moveTo(bx - c * bw, by - s * bw);
        g.lineTo(bx + c * bw, by + s * bw);
        g.lineTo(bx + mpx * tlen + c * 0.03 * L, by + mpy * tlen + s * 0.03 * L);
        g.closePath();
        g.fill(); g.stroke();
      }
    }

    function drawBaseCup(L) {
      g.fillStyle = MINT;
      g.beginPath();
      g.ellipse(-0.02 * L, 0, 0.17 * L, 0.13 * L, 0, 0, TAU);
      g.fill();
      g.strokeStyle = SHADE; g.lineWidth = Math.max(1, 0.02 * L);
      g.stroke();
      g.strokeStyle = GLINT; g.lineWidth = Math.max(0.8, 0.012 * L);
      g.beginPath(); g.arc(-0.02 * L, 0, 0.12 * L, -2.2, -0.9); g.stroke();
    }

    function drawHead(T, t) {
      const L = T.L, half = T.half;
      drawThroat(L, half);
      drawLure(L, half, t, T.glow);
      drawJaw(1, L, L * 0.44, half);
      drawJaw(-1, L, L * 0.44, half);
      drawTeeth(1, L, half);
      drawTeeth(-1, L, half);
      if (T.flash > 0.05) {                        // "snap!" pop of light
        g.globalAlpha = 0.6 * T.flash;
        g.strokeStyle = CREAM; g.lineWidth = Math.max(1.5, 0.03 * L); g.lineJoin = 'round';
        g.beginPath(); g.ellipse(L * 0.25, 0, L * 0.34, L * 0.2, 0, 0, TAU); g.stroke();
        g.globalAlpha = 1;
      }
      drawBaseCup(L);
    }

    function drawTrapFull(T, t) {
      const c = T.cfg;
      const ph = t * c.breW + T.breath;
      const bob = 0.012 * m * Math.sin(ph) - 0.008 * m * Math.abs(Math.sin(ph));
      const hx = T.topX + T.bendX, hy = T.topY + bob;
      T.hx = hx; T.hy = hy;
      const axis = -Math.PI / 2 + c.lean + T.bendX * 0.004;
      T.axis = axis;

      const mx = (T.baseX + hx) / 2 + T.bendX * 0.7;
      const my = (T.baseY + hy) / 2;
      stemPath(T.baseX, T.baseY, mx, my, hx, hy, 0.055 * m, 0.022 * m);
      g.fillStyle = MINT; g.fill();
      g.strokeStyle = SHADE; g.lineWidth = Math.max(1, 0.006 * m); g.lineJoin = 'round'; g.stroke();
      g.strokeStyle = GLINT; g.lineWidth = Math.max(1, 0.008 * m); g.lineCap = 'round';
      g.beginPath(); g.moveTo(T.baseX, T.baseY); g.quadraticCurveTo(mx, my, hx, hy); g.stroke();

      g.save();
      g.translate(hx, hy);
      g.rotate(axis);
      g.scale(1 + T.squash, 1 - T.squash * 0.5);   // stretch along axis as it snaps
      drawHead(T, t);
      g.restore();
    }

    return {
      draw(t, dt) {
        if (!(dt > 0)) dt = 0.016;
        if (dt > 0.05) dt = 0.05;
        for (const T of traps) {
          T.pt += dt;
          if (T.phase === 'closing') {
            if (T.half <= CLOSED + 0.03 || T.pt > 0.22) { T.phase = 'hold'; T.pt = 0; }
          } else if (T.phase === 'hold') {
            if (T.pt > T.holdDur) { T.phase = 'reopen'; T.pt = 0; }
          } else if (T.phase === 'reopen') {
            if (T.pt > 2.4) { T.phase = 'idle'; T.pt = 0; }
          }
          T.flash += (0 - T.flash) * Math.min(1, 5 * dt);
          T.glow += (T.hover - T.glow) * Math.min(1, 9 * dt);
          const SUB = 8, h = dt / SUB;
          for (let s = 0; s < SUB; s++) step(T, t, h);
          const targetSq = clamp(-T.hv * 0.012, -0.22, 0.34);
          T.squash += (targetSq - T.squash) * Math.min(1, 22 * dt);
        }
        g.fillStyle = bg; g.fillRect(0, 0, env.w, env.h);
        drawSoil();
        drawTrapFull(traps[1], t);   // smaller trap sits behind
        drawTrapFull(traps[0], t);
      },
      down(p) {
        let best = null, bd = 1e18;
        for (const T of traps) {
          if (T.phase === 'closing' || T.phase === 'hold') continue;
          if (T.half < 0.16 || !wedgeTest(T, p)) continue;
          const dx = p.x - T.hx, dy = p.y - T.hy, d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = T; }
        }
        if (best) snap(best);
      },
      move(p) {
        if (p.held) return;
        for (const T of traps) {
          T.hover = ((T.phase === 'idle' || T.phase === 'reopen') && T.half > 0.16 && wedgeTest(T, p)) ? 1 : 0;
        }
      },
      dbl(p) {
        for (const T of traps) {
          if ((T.phase === 'idle' || T.phase === 'reopen') && T.half > 0.14) snap(T);
        }
      },
      leave() { for (const T of traps) T.hover = 0; },
      resize() { layout(); },
    };
  },
});
