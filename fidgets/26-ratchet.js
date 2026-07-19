/* № 26 — Ratchet & pawl. A sky sawtooth wheel, an amber hand-lever carrying a
   coral driving pawl, and a fixed coral holding pawl — each on its own little
   spring. Rock the lever: forward strokes ratchet the wheel tooth-by-tooth with
   a springy overshoot and a spark; back-strokes only carry the lever home while
   the holding pawl locks the wheel. The advance is strictly one-way — no matter
   how you drag, the wheel never unwinds. */
F.register({
  n: 26, id: 'ratchet', cat: 'mech',
  title: 'Ratchet & pawl', hint: 'Drag the lever — it clicks one way only',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const AMBER = inks[0], CORAL = inks[1], SKY = inks[3], CREAM = inks[5];
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const N = 12, PITCH = TAU / N, RISER = 0.17;   // riser = steep fraction of a tooth
    const LN = Math.PI / 2, SW = 1.15;             // lever neutral (points down) + stroke half-arc
    const CONTACT = 0.17;                          // driving-pawl tip trails the lever by this
    const HOLD = -0.62, HOLD_OFF = 0.34;           // holding-pawl contact angle + anchor lead
    const SPARK = [0.4, 1.7, 3.0, 4.3];            // spark ray angles (allocated once)

    // ---- size-derived layout (rebuilt on resize) ----
    let cx = 0, cy = 0, m = 0, Rroot = 0, Rtip = 0, ARM = 0, HANDLE = 0;
    let hax = 0, hay = 0, hpx = 0, hpy = 0, LW = 2;
    function layout() {
      const w = env.w, h = env.h; m = Math.min(w, h);
      cx = w * 0.5; cy = h * 0.455;
      Rtip = 0.30 * m; Rroot = Rtip - 0.075 * m;
      ARM = Rtip + 0.055 * m; HANDLE = Rtip + 0.165 * m;
      LW = Math.max(2, 0.0125 * m);
      hax = cx + (Rtip + 0.115 * m) * Math.cos(HOLD + HOLD_OFF);       // holding-pawl pivot
      hay = cy + (Rtip + 0.115 * m) * Math.sin(HOLD + HOLD_OFF);
      hpx = cx + (Rtip + 0.205 * m) * Math.cos(HOLD + HOLD_OFF + 0.17); // its fixed spring post
      hpy = cy + (Rtip + 0.205 * m) * Math.sin(HOLD + HOLD_OFF + 0.17);
    }
    layout();

    function toothR(local) {               // tooth-profile radius at a wheel-local angle
      let u = local % PITCH; if (u < 0) u += PITCH;
      const f = u / PITCH;
      return f < RISER
        ? Rroot + (Rtip - Rroot) * (f / RISER)                 // steep riser (up)
        : Rtip - (Rtip - Rroot) * ((f - RISER) / (1 - RISER)); // long ramp (down)
    }
    function coilSpring(x1, y1, x2, y2, coils, amp, wid) {
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) + 1e-6;
      const px = -dy / L, py = dx / L, seg = coils * 2;
      g.strokeStyle = CORAL; g.lineWidth = wid;
      g.beginPath(); g.moveTo(x1, y1);
      for (let i = 1; i < seg; i++) {
        const f = i / seg, s = (i & 1) ? 1 : -1;
        g.lineTo(x1 + dx * f + px * amp * s, y1 + dy * f + py * amp * s);
      }
      g.lineTo(x2, y2); g.stroke();
    }

    // ---- state ----
    let leverAng = LN, leverVel = 0, leverTarget = LN, leverPrev = LN;
    let drive = 0, lockNotch = 0;          // monotonic: forward-only accumulation + committed detent
    let wheelAng = 0, wheelVel = 0;
    let flashD = 0, flashH = 0, snap = 0, fAng = LN - CONTACT;
    let grab = null, grabbed = 0, hx = -999, hy = -999;
    const seed = Math.random() * TAU;

    return {
      draw(t, dt) {
        const w = env.w, h = env.h;

        // ---------- lever (spring toward finger while dragging, else idle sway) ----------
        const tgt = grab ? leverTarget : LN + Math.sin(t * 1.1 + seed) * 0.028;
        const kL = 170, cL = 2 * 0.62 * Math.sqrt(kL);
        leverVel += (-kL * (leverAng - tgt) - cL * leverVel) * dt;
        leverVel = clamp(leverVel, -90, 90);
        leverAng = clamp(leverAng + leverVel * dt, LN - SW - 0.25, LN + SW + 0.25);

        // forward-only drive: only while actively dragging, only on forward motion
        const dL = leverAng - leverPrev; leverPrev = leverAng;
        if (grab && dL > 0) drive += dL;
        const nn = Math.floor(drive / PITCH);
        if (nn > lockNotch) {                       // one or more teeth committed -> click(s)
          const steps = Math.min(nn - lockNotch, 5);
          lockNotch = nn;
          wheelVel += 0.8 * steps;                  // little forward kick on top of the step
          flashD = 1; flashH = 1; snap = 1; fAng = leverAng - CONTACT;
        }
        if (lockNotch > 120000) {                   // fold huge angles, keeping every phase aligned
          const wc = Math.floor(lockNotch / N) * N;
          lockNotch -= wc; drive -= wc * PITCH; wheelAng -= wc * PITCH;
        }

        // ---------- wheel: spring to the committed notch (one-way, springy snap) ----------
        const wtar = lockNotch * PITCH;
        const kW = 320, cW = 2 * 0.42 * Math.sqrt(kW);
        wheelVel += (-kW * (wheelAng - wtar) - cW * wheelVel) * dt;
        wheelVel = clamp(wheelVel, -18, 18);
        wheelAng += wheelVel * dt;
        const rest = 1 - Math.min(1, Math.abs(wheelVel) * 3 + snap);      // 1 only once settled
        const wa = wheelAng + rest * (Math.sin(t * 2.4 + seed) * 0.007 +  // micro-creep at idle
          Math.sin(t * 5.7 + seed * 2) * 0.004);

        // decays
        flashD = Math.max(0, flashD - dt * 6);
        flashH = Math.max(0, flashH - dt * 6);
        snap = Math.max(0, snap - dt * 7);
        grabbed += ((grab ? 1 : 0) - grabbed) * Math.min(1, 12 * dt);

        // ================= render =================
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.lineCap = 'round'; g.lineJoin = 'round';

        // wheel body: faint disc, spokes, sawtooth ring, hub
        g.globalAlpha = 0.10; g.fillStyle = SKY;
        g.beginPath(); g.arc(cx, cy, Rroot, 0, TAU); g.fill();
        g.globalAlpha = 0.28; g.strokeStyle = SKY; g.lineWidth = LW;
        for (let s = 0; s < 6; s++) {
          const a = wa + s * (TAU / 6);
          g.beginPath();
          g.moveTo(cx + Rroot * 0.28 * Math.cos(a), cy + Rroot * 0.28 * Math.sin(a));
          g.lineTo(cx + Rroot * 0.9 * Math.cos(a), cy + Rroot * 0.9 * Math.sin(a));
          g.stroke();
        }
        g.globalAlpha = 1;
        g.beginPath();
        for (let k = 0; k < N; k++) {
          const a0 = wa + k * PITCH, ac = a0 + RISER * PITCH;
          g.lineTo(cx + Rroot * Math.cos(a0), cy + Rroot * Math.sin(a0));
          g.lineTo(cx + Rtip * Math.cos(ac), cy + Rtip * Math.sin(ac));
        }
        g.closePath();
        g.globalAlpha = 0.13; g.fillStyle = SKY; g.fill();
        g.globalAlpha = 1; g.strokeStyle = SKY; g.lineWidth = LW * 1.15; g.stroke();
        g.beginPath(); g.arc(cx, cy, Rroot * 0.24, 0, TAU); g.stroke();

        // ---------- holding pawl (fixed, coral) ----------
        {
          const rS = toothR(HOLD - wa) + LW;
          const tx = cx + rS * Math.cos(HOLD), ty = cy + rS * Math.sin(HOLD);
          coilSpring(hpx, hpy, (hax + tx) / 2, (hay + ty) / 2, 3, LW * 1.3, LW * 0.7);
          g.strokeStyle = CREAM; g.globalAlpha = 0.5; g.lineWidth = LW * 0.9;   // fixed bracket stub
          g.beginPath(); g.moveTo(hax, hay);
          g.lineTo(hax + LW * 2.6 * Math.cos(HOLD + HOLD_OFF), hay + LW * 2.6 * Math.sin(HOLD + HOLD_OFF));
          g.stroke(); g.globalAlpha = 1;
          g.strokeStyle = CORAL; g.lineWidth = LW * 1.5;                        // pawl finger
          g.beginPath(); g.moveTo(hax, hay); g.lineTo(tx, ty); g.stroke();
          g.fillStyle = CORAL; g.beginPath(); g.arc(tx, ty, LW * 1.1, 0, TAU); g.fill();
          g.fillStyle = bg; g.beginPath(); g.arc(hax, hay, LW * 0.8, 0, TAU); g.fill();
          g.strokeStyle = CORAL; g.lineWidth = LW * 0.8; g.stroke();
          if (flashH > 0) glow(tx, ty, flashH);
        }

        // ---------- lever + driving pawl (amber arm, coral pawl) ----------
        const ahx = cx + HANDLE * Math.cos(leverAng), ahy = cy + HANDLE * Math.sin(leverAng);
        const dAng = leverAng - CONTACT;                 // driving-pawl contact angle
        const rSd = toothR(dAng - wa);                   // rides the real teeth
        const dtr = rSd + LW + snap * LW * 2.2;          // pops outward on each snap
        const dtx = cx + dtr * Math.cos(dAng), dty = cy + dtr * Math.sin(dAng);
        const dax = cx + ARM * Math.cos(leverAng), day = cy + ARM * Math.sin(leverAng);   // pivot on lever
        const spx = cx + (ARM + 0.075 * m) * Math.cos(leverAng + 0.05);                   // spring stud
        const spy = cy + (ARM + 0.075 * m) * Math.sin(leverAng + 0.05);
        // arm
        g.strokeStyle = AMBER; g.lineWidth = LW * 2.1;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(ahx, ahy); g.stroke();
        g.strokeStyle = CREAM; g.globalAlpha = 0.22; g.lineWidth = LW * 0.7;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(ahx, ahy); g.stroke();
        g.globalAlpha = 1;
        // driving pawl spring + finger + tip
        coilSpring(spx, spy, (dax + dtx) / 2, (day + dty) / 2, 3, LW * 1.2, LW * 0.7);
        g.strokeStyle = CORAL; g.lineWidth = LW * 1.5;
        g.beginPath(); g.moveTo(dax, day); g.lineTo(dtx, dty); g.stroke();
        g.fillStyle = CORAL; g.beginPath(); g.arc(dtx, dty, LW * 1.1, 0, TAU); g.fill();
        if (flashD > 0) glow(cx + rSd * Math.cos(fAng), cy + rSd * Math.sin(fAng), flashD);
        // handle knob
        const kr = 0.052 * m;
        g.fillStyle = AMBER; g.beginPath(); g.arc(ahx, ahy, kr, 0, TAU); g.fill();
        g.strokeStyle = bg; g.lineWidth = LW * 0.9; g.stroke();
        g.fillStyle = CREAM; g.beginPath(); g.arc(ahx, ahy, LW * 0.7, 0, TAU); g.fill();
        // center pivot cap
        g.fillStyle = AMBER; g.beginPath(); g.arc(cx, cy, LW * 2.0, 0, TAU); g.fill();
        g.fillStyle = CREAM; g.beginPath(); g.arc(cx, cy, LW * 0.8, 0, TAU); g.fill();

        // grab / hover affordance on the handle
        const near = Math.hypot(hx - ahx, hy - ahy) < kr + 16;
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.3 + seed);
        const aff = Math.max(grabbed, near ? 0.7 : 0.16 + 0.16 * pulse);
        if (aff > 0.02) {
          g.globalAlpha = aff * 0.6; g.strokeStyle = CREAM; g.lineWidth = LW * 0.9;
          g.beginPath(); g.arc(ahx, ahy, kr + LW * 1.6 + pulse * 2, 0, TAU); g.stroke();
          g.globalAlpha = 1;
        }

        function glow(x, y, a) {
          g.fillStyle = CREAM;
          g.globalAlpha = a * 0.20; g.beginPath(); g.arc(x, y, LW * 3.4, 0, TAU); g.fill();
          g.globalAlpha = a * 0.9; g.beginPath(); g.arc(x, y, LW * (1.0 + a), 0, TAU); g.fill();
          g.globalAlpha = a * 0.8; g.strokeStyle = CREAM; g.lineWidth = LW * 0.7;
          for (let i = 0; i < 4; i++) {
            const ra = SPARK[i] + fAng;
            g.beginPath(); g.moveTo(x, y);
            g.lineTo(x + LW * (2 + 3 * a) * Math.cos(ra), y + LW * (2 + 3 * a) * Math.sin(ra));
            g.stroke();
          }
          g.globalAlpha = 1;
        }
      },
      down(p) { grab = { a0: Math.atan2(p.y - cy, p.x - cx) }; },
      move(p) {
        if (grab && p.held) {
          const a = Math.atan2(p.y - cy, p.x - cx);
          let da = a - grab.a0;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          grab.a0 = a;
          leverTarget = clamp(leverTarget + da, LN - SW, LN + SW);
        } else { hx = p.x; hy = p.y; }
      },
      up() { grab = null; },
      leave() { hx = -999; hy = -999; },
      resize() { layout(); },
    };
  },
});
