/* № 45 — Spinning top. A coral-and-amber peg-top that rests with a lazy lean,
   begging to be spun. Whip it round in a circle and let go: it snaps upright and
   "sleeps", a bright speck racing its flank to show the blur. As the spin bleeds
   off the tip stays pinned while the axis leans out and sweeps a widening cone —
   precession — the wobble swelling until it finally topples, rolls, and eases
   back to its idle lean, ready again. Double-click kicks it straight to speed.
   Rendered in a 3/4 view: world height maps to screen-up, depth is foreshortened,
   so a leaning axis traces a real ellipse and the wobble reads as 3D. */
F.register({
  n: 45, id: 'spinning-top', cat: 'chaos',
  title: 'Spinning top', hint: 'Spin it up — watch it wobble and topple',
  make(env) {
    const { g, bg } = env;
    const TAU = Math.PI * 2;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

    const AMBER = env.inks[0], CORAL = env.inks[1], CREAM = env.inks[5];
    const kZ = 0.52;              // depth foreshortening for the 3/4 view

    // ---- tunables ----
    const SPIN_IDLE = 0.9;        // lazy idle turn (rad/s) — never fully dead
    const VMAX = 42;              // clamp on spin rate
    const GAIN = 1.45;            // whip -> spin amplification on release
    const S_LO = 3, S_HI = 22;    // spin range over which it stands upright
    const S_TOP = 1.5;            // below this (while coasting) it begins to topple
    const LEAN_UP = 0.05;         // lean when spinning fast (asleep, upright)
    const LEAN_WOB = 0.46;        // lean at the height of the precession wobble
    const LEAN_TOP = 1.40;        // lean once toppled over
    const LEAN_IDLE = 0.12;       // resting invite lean
    const PREC_K = 6.2, PREC_MAX = 6.5, PREC_IDLE = 0.55;
    const TOP_DUR = 1.7;          // topple/settle time before easing back to idle

    // ---- state ----
    let dir = Math.random() < 0.5 ? -1 : 1;
    let spin = SPIN_IDLE * dir;   // signed spin rate about own axis
    let ln = LEAN_IDLE;           // eased lean angle from vertical
    let prec = Math.random() * TAU;
    let spinPhase = Math.random() * TAU;
    let episode = false;          // spun & coasting (owns the precess/topple show)
    let toppling = false, toppleT = 0;
    let pop = 0;                  // stand-up squash-&-stretch, decays
    let grabGlow = 0;

    let dragging = false, dragA = 0, dragAccum = 0, dragVel = 0;

    // live contact point (tip), refreshed each frame for the event handlers
    let cx = env.w * 0.5, cy = env.h * 0.585;

    function ground(RAD, LEN, ax, az, lean, tp) {
      // faint warm pool so the small shadow reads on the near-black floor
      const poolR = RAD * 2.3;
      g.save(); g.translate(cx, cy); g.scale(1, kZ);
      let rg = g.createRadialGradient(0, 0, 0, 0, 0, poolR);
      rg.addColorStop(0, 'rgba(245,165,36,0.08)');
      rg.addColorStop(1, 'rgba(245,165,36,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(0, 0, poolR, 0, TAU); g.fill();
      g.restore();
      // contact shadow — drifts toward the lean, spreads with wobble/topple
      const com = 0.5 * LEN;
      const ox = ax * com * 0.5, oy = -az * com * kZ * 0.5;
      const wob = smooth(clamp((lean - 0.15) / 1.2, 0, 1));
      const spread = 1 + 1.3 * wob + 1.2 * tp;
      const sr = RAD * 0.95 * spread;
      g.save(); g.translate(cx + ox, cy + oy); g.scale(1, kZ * 0.9);
      rg = g.createRadialGradient(0, 0, 0, 0, 0, sr);
      rg.addColorStop(0, 'rgba(20,16,13,0.55)');
      rg.addColorStop(0.55, 'rgba(20,16,13,0.30)');
      rg.addColorStop(1, 'rgba(20,16,13,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(0, 0, sr, 0, TAU); g.fill();
      g.restore();
    }

    // draw the peg-top body in a frame whose +x runs tip -> crown along the axis
    function body(L, R, detail, blur, phase, theta) {
      const bp = () => {
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(0.04 * L, 0.14 * R, 0.14 * L, 0.52 * R);
        g.quadraticCurveTo(0.30 * L, 0.96 * R, 0.46 * L, 1.00 * R);
        g.quadraticCurveTo(0.66 * L, 1.00 * R, 0.80 * L, 0.50 * R);
        g.quadraticCurveTo(0.90 * L, 0.30 * R, 0.94 * L, 0.30 * R);
        g.quadraticCurveTo(1.00 * L, 0.27 * R, 1.00 * L, 0);
        g.quadraticCurveTo(1.00 * L, -0.27 * R, 0.94 * L, -0.30 * R);
        g.quadraticCurveTo(0.90 * L, -0.30 * R, 0.80 * L, -0.50 * R);
        g.quadraticCurveTo(0.66 * L, -1.00 * R, 0.46 * L, -1.00 * R);
        g.quadraticCurveTo(0.30 * L, -0.96 * R, 0.14 * L, -0.52 * R);
        g.quadraticCurveTo(0.04 * L, -0.14 * R, 0, 0);
        g.closePath();
      };
      // card light (upper-left) rotated into this local frame
      const ct = Math.cos(theta), st = Math.sin(theta);
      const wlx = -0.42, wly = -0.90;
      const lx = ct * wlx + st * wly, ly = -st * wlx + ct * wly;
      const gcx = 0.46 * L, gr = 1.3 * R;

      // base coral body
      bp(); g.fillStyle = CORAL; g.fill();
      // shade the far flank toward the ground colour
      let dg = g.createLinearGradient(gcx - lx * gr, -ly * gr, gcx + lx * gr, ly * gr);
      dg.addColorStop(0, 'rgba(20,16,13,0.6)');
      dg.addColorStop(0.5, 'rgba(20,16,13,0.12)');
      dg.addColorStop(1, 'rgba(20,16,13,0)');
      bp(); g.fillStyle = dg; g.fill();

      // interior sheen / specular, clipped to the silhouette
      g.save(); bp(); g.clip();
        // warm amber sheen on the lit flank
        const ax0 = gcx + lx * 0.26 * R, ay0 = ly * 0.26 * R;
        let sg = g.createRadialGradient(ax0, ay0, 0, ax0, ay0, 0.95 * R);
        sg.addColorStop(0, 'rgba(245,165,36,0.5)');
        sg.addColorStop(1, 'rgba(245,165,36,0)');
        g.fillStyle = sg; g.fillRect(-0.2 * L, -1.2 * R, 1.4 * L, 2.4 * R);
        // spin-blur band across the equator (fast only)
        if (blur > 0.02) {
          g.lineCap = 'round';
          g.strokeStyle = 'rgba(245,165,36,' + (0.16 * blur).toFixed(3) + ')';
          g.lineWidth = 0.55 * R;
          g.beginPath(); g.moveTo(0.46 * L, -1.04 * R); g.lineTo(0.46 * L, 1.04 * R); g.stroke();
          g.strokeStyle = 'rgba(242,233,220,' + (0.10 * blur).toFixed(3) + ')';
          g.lineWidth = 0.20 * R;
          for (let i = 0; i < 3; i++) {
            const x = (0.34 + i * 0.11) * L;
            g.beginPath(); g.moveTo(x, -1.0 * R); g.lineTo(x, 1.0 * R); g.stroke();
          }
        }
        // moving specular — a bright speck racing the flank to show rotation
        const near = Math.cos(phase);
        const a1 = 0.6 * smooth((near + 0.15)) * detail;
        if (a1 > 0.01) {
          const hx = 0.44 * L, hy = Math.sin(phase) * 0.6 * R;
          let mg = g.createRadialGradient(hx, hy, 0, hx, hy, 0.5 * R);
          mg.addColorStop(0, 'rgba(242,233,220,' + a1.toFixed(3) + ')');
          mg.addColorStop(1, 'rgba(242,233,220,0)');
          g.fillStyle = mg; g.fillRect(-0.2 * L, -1.2 * R, 1.4 * L, 2.4 * R);
        }
      g.restore();

      // chunky dark rim + fine bright rim for separation and gloss
      bp(); g.lineJoin = 'round';
      g.lineWidth = Math.max(2, R * 0.09);
      g.strokeStyle = 'rgba(20,16,13,0.5)'; g.stroke();
      bp(); g.lineWidth = Math.max(1.2, R * 0.045);
      g.strokeStyle = 'rgba(242,233,220,0.14)'; g.stroke();

      // metal glint at the pivot tip
      let tg = g.createRadialGradient(0.05 * L, 0, 0, 0.05 * L, 0, 0.18 * R);
      tg.addColorStop(0, 'rgba(242,233,220,' + (0.2 + 0.5 * detail).toFixed(3) + ')');
      tg.addColorStop(1, 'rgba(242,233,220,0)');
      g.fillStyle = tg; g.beginPath(); g.arc(0.05 * L, 0, 0.18 * R, 0, TAU); g.fill();
    }

    return {
      draw(t, dt) {
        const w = env.w, h = env.h, S = Math.min(w, h);
        cx = w * 0.5; cy = h * 0.585;
        const LEN = 0.40 * S, RAD = 0.155 * S;

        // ---------------- update ----------------
        grabGlow += ((dragging ? 1 : 0) - grabGlow) * (1 - Math.pow(0.0008, dt));
        pop *= Math.exp(-6 * dt);

        if (dragging) {
          const raw = clamp(dragAccum / Math.max(dt, 1e-4), -VMAX, VMAX);
          dragAccum = 0;
          const s = Math.exp(-dt / 0.06);
          dragVel = dragVel * s + raw * (1 - s);
          spin += (dragVel - spin) * (1 - Math.exp(-dt / 0.05));
          if (Math.abs(dragVel) > SPIN_IDLE * 2) dir = dragVel < 0 ? -1 : 1;
        } else if (episode) {
          spin *= Math.pow(0.62, dt);                       // bearing friction coast
          if (!toppling && Math.abs(spin) < S_TOP) { toppling = true; toppleT = 0; }
          if (toppling) {
            toppleT += dt;
            spin *= Math.pow(0.22, dt);                     // drain the last of the spin
            if (toppleT > TOP_DUR) { episode = false; toppling = false; }
          }
        } else {
          spin += (SPIN_IDLE * dir - spin) * (1 - Math.pow(0.03, dt));
        }
        if (!isFinite(spin)) spin = SPIN_IDLE * dir;
        spin = clamp(spin, -VMAX, VMAX);

        // precession: slow while sleeping, accelerating as the spin bleeds off
        let precRate;
        if (episode && !dragging) {
          precRate = clamp(PREC_K / (Math.abs(spin) + 0.6), 0, PREC_MAX);
          if (toppling) precRate *= (1 - 0.75 * smooth(clamp(toppleT / TOP_DUR, 0, 1)));
          precRate *= (spin < 0 ? -1 : 1);
        } else {
          precRate = PREC_IDLE * (spin < 0 ? -1 : 1);
        }
        prec += precRate * dt;
        if (!isFinite(prec)) prec = 0;
        prec %= TAU;

        // own rotation phase (move() turns it directly while dragging)
        if (!dragging) spinPhase += spin * dt;
        if (!isFinite(spinPhase)) spinPhase = 0;
        spinPhase = ((spinPhase % TAU) + TAU) % TAU;

        // lean target — gyroscopic: upright when fast, leaning out as it slows
        const stand = smooth((Math.abs(spin) - S_LO) / (S_HI - S_LO));
        let leanTarget;
        if (dragging) {
          leanTarget = LEAN_UP + (LEAN_IDLE - LEAN_UP) * (1 - stand);
        } else if (episode) {
          if (toppling) {
            const pf = smooth(clamp(toppleT / (TOP_DUR * 0.45), 0, 1));
            leanTarget = LEAN_WOB + (LEAN_TOP - LEAN_WOB) * pf;
          } else {
            leanTarget = LEAN_UP + (LEAN_WOB - LEAN_UP) * (1 - stand);
          }
        } else {
          leanTarget = LEAN_IDLE;
        }
        ln += (leanTarget - ln) * (1 - Math.exp(-(toppling ? 7.5 : 6.0) * dt));
        ln = clamp(ln, 0, 1.5);
        if (!isFinite(ln)) ln = LEAN_IDLE;

        // nutation nod grows as it slows — sells the wobble
        const wobAmt = smooth((S_HI - Math.abs(spin)) / S_HI) * (episode ? 1 : 0.3);
        const lnDraw = clamp(ln + 0.035 * wobAmt * Math.sin(prec * 2.0), 0, 1.5);

        // ---- axis -> screen (3/4 projection) ----
        const sLn = Math.sin(lnDraw), cLn = Math.cos(lnDraw);
        const ax = sLn * Math.cos(prec), ay = cLn, az = sLn * Math.sin(prec);
        const Ux = ax, Uy = -(ay + az * kZ);
        const theta = Math.atan2(Uy, Ux);
        const axisLen = Math.hypot(Ux, Uy);

        // ---------------- render ----------------
        const visSpeed = Math.abs(spin);
        const blur = smooth((visSpeed - 12) / 22);
        const detail = 1 - blur;
        const clearA = 1 - 0.42 * blur;
        g.fillStyle = clearA >= 0.999 ? bg : 'rgba(20,16,13,' + clearA.toFixed(3) + ')';
        g.fillRect(0, 0, w, h);

        ground(RAD, LEN, ax, az, lnDraw, toppling ? smooth(clamp(toppleT / TOP_DUR, 0, 1)) : 0);

        const breath = 1 + 0.012 * Math.sin(t * 1.1);
        const widthF = 1 - 0.12 * Math.abs(az);
        g.save();
        g.translate(cx, cy);
        g.rotate(theta);
        body(LEN * axisLen * (1 + 0.12 * pop) * breath,
             RAD * widthF * (1 - 0.06 * pop) * breath,
             detail, blur, spinPhase, theta);
        g.restore();

        // pinch feedback while spinning it up
        if (grabGlow > 0.01) {
          g.save(); g.translate(cx, cy); g.scale(1, kZ);
          g.beginPath(); g.arc(0, 0, RAD * 1.5, 0, TAU);
          g.restore();
          g.lineWidth = Math.max(2, RAD * 0.1);
          g.strokeStyle = 'rgba(242,233,220,' + (0.26 * grabGlow).toFixed(3) + ')';
          g.stroke();
        }
      },

      down(p) {
        dragging = true;
        dragA = Math.atan2(p.y - cy, p.x - cx);
        dragAccum = 0; dragVel = 0; grabGlow = 1;
      },
      move(p) {
        if (!dragging) return;
        const a = Math.atan2(p.y - cy, p.x - cx);
        let da = a - dragA;
        da = Math.atan2(Math.sin(da), Math.cos(da));   // unwrap across ±π
        dragA = a;
        dragAccum += da;
        spinPhase += da;                                // turn under the hand
      },
      up() {
        if (!dragging) return;
        dragging = false; grabGlow = 0;
        spin = clamp(dragVel * GAIN, -VMAX, VMAX);
        if (Math.abs(spin) > S_TOP * 1.6) {
          episode = true; toppling = false; toppleT = 0; pop = 1;
          dir = spin < 0 ? -1 : 1;
        } else {
          episode = false;                              // a gentle nudge just idles
        }
      },
      dbl() {
        dir = spin < 0 ? -1 : 1;
        spin = clamp(spin + 30 * dir, -VMAX, VMAX);
        if (Math.abs(spin) < 26) spin = 30 * dir;
        episode = true; toppling = false; toppleT = 0; pop = 1;
      },
    };
  },
});
