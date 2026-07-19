/* № 41 — Metronome. A wind-up Maelzel metronome: an amber pyramid with an
   inverted-pendulum rod, a coral sliding weight, and a faint tempo scale.
   It ticks side to side on its own, lingering a hair at each extreme (a crisp
   flash + a scale-mark pulse marks the beat). Drag the weight UP the rod to
   slow it, DOWN to race it — same reason as the real device: it lengthens the
   effective pendulum. Shove the rod itself to push or restart the swing; the
   body rocks a touch against every beat. */
F.register({
  n: 41, id: 'metronome', cat: 'mech',
  title: 'Metronome', hint: 'Drag the weight to set the tempo',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const AMBER = inks[0], CORAL = inks[1], CREAM = inks[5];
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

    // ---- tunables ----
    const Q = 1.5;                        // >1 = linger (hesitate) at the extremes
    const BPM_FAST = 168, BPM_SLOW = 40;  // weight low = fast, weight high = slow
    const F_MIN = 0.40, F_MAX = 0.86;     // weight travel along rod (0 = pivot, 1 = tip)
    const IDLE_AMP = 0.44, MAX_AMP = 0.92;
    const GRADS = 9;

    // ---- state ----
    let phase = 0;                        // beat phase; extremes at pi/2 + k*pi
    let omega = Math.PI * 107 / 60;       // current angular tempo (eased)
    let lastN = -1;                       // last extreme index crossed
    let amp = IDLE_AMP;                   // current swing amplitude (rad)
    let f = 0.62, fShown = 0.62;          // weight fraction: target / eased-shown
    let armAngle = 0;                     // rendered arm angle from vertical (+ = right)
    let rock = 0;                         // body reaction rock (eased)
    let flash = 0, flashX = 0, flashY = 0;// tick flash intensity + world spot
    let pulse = 0;                        // slow idle breath for the grab affordance
    let dragArm = false, dragWt = false, dragV = 0;
    let hx = -999, hy = -999;             // hover point (body-local, pre-rock)

    // ---- layout (recomputed every frame from live env.w/env.h) ----
    let cx, topY, baseY, bodyH, halfTop, halfBot, pivotX, pivotY, L, wr, rodW, mm;
    function layout() {
      const w = env.w, h = env.h; mm = Math.min(w, h);
      cx = w * 0.5;
      topY = h * 0.125; baseY = h * 0.92; bodyH = baseY - topY;
      halfBot = Math.min(w * 0.31, 0.34 * mm);
      halfTop = halfBot * 0.30;
      pivotX = cx; pivotY = topY + bodyH * 0.88;       // pivot sits low, near the base
      L = pivotY - (topY - 0.045 * h);                 // rod pokes just out the top
      wr = Math.max(9, 0.055 * mm);
      rodW = Math.max(3, 0.017 * mm);
    }

    // ---- helpers ----
    const shape = (s) => {                // s in [-1,1] -> flatter near the ends
      const a = clamp(Math.abs(s), 0, 1);
      return (s < 0 ? -1 : 1) * (1 - Math.pow(1 - a, Q));
    };
    const shapeInv = (y) => {             // exact inverse of shape()
      const a = clamp(Math.abs(y), 0, 1);
      return (y < 0 ? -1 : 1) * (1 - Math.pow(1 - a, 1 / Q));
    };
    function halfAt(y) {                  // body half-width at a given local y
      const fr = clamp((y - topY) / (bodyH + 1e-6), 0, 1);
      return halfTop + fr * (halfBot - halfTop);
    }
    const rodX = (fr, a) => pivotX + fr * L * Math.sin(a);
    const rodY = (fr, a) => pivotY - fr * L * Math.cos(a);
    function bpmOf(fr) {
      const u = clamp((fr - F_MIN) / (F_MAX - F_MIN + 1e-6), 0, 1);
      return BPM_FAST + (BPM_SLOW - BPM_FAST) * u;      // low = fast, high = slow
    }
    // invert the subtle body rock so hit-testing matches what's drawn
    const unrockX = (x, y) => { const c = Math.cos(rock), s = Math.sin(rock); return cx + (x - cx) * c + (y - baseY) * s; };
    const unrockY = (x, y) => { const c = Math.cos(rock), s = Math.sin(rock); return baseY - (x - cx) * s + (y - baseY) * c; };
    function roundRect(x, y, w, h, r) {
      const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
      g.beginPath();
      g.moveTo(x + rr, y);
      g.arcTo(x + w, y, x + w, y + h, rr);
      g.arcTo(x + w, y + h, x, y + h, rr);
      g.arcTo(x, y + h, x, y, rr);
      g.arcTo(x, y, x + w, y, rr);
      g.closePath();
    }
    function distToRod(x, y) {
      const ax = pivotX, ay = pivotY, bx = rodX(1, armAngle), by = rodY(1, armAngle);
      const vx = bx - ax, vy = by - ay, wx = x - ax, wy = y - ay;
      let tt = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy + 1e-6), 0, 1);
      return Math.hypot(x - (ax + tt * vx), y - (ay + tt * vy));
    }

    // ---- drawing (all inside the rocked frame) ----
    function drawBody() {
      const blx = cx - halfBot, brx = cx + halfBot, tlx = cx - halfTop, trx = cx + halfTop;
      g.globalAlpha = 0.15; g.fillStyle = AMBER;
      g.beginPath();
      g.moveTo(blx, baseY); g.lineTo(brx, baseY); g.lineTo(trx, topY); g.lineTo(tlx, topY);
      g.closePath(); g.fill();
      // inner bevels for a bit of pyramid depth
      g.globalAlpha = 0.45; g.strokeStyle = AMBER; g.lineWidth = Math.max(1.5, mm * 0.006);
      for (const sgn of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + sgn * (halfBot - mm * 0.055), baseY - mm * 0.02);
        g.lineTo(cx + sgn * (halfTop - mm * 0.03), topY + mm * 0.03);
        g.stroke();
      }
      // bold outline
      g.globalAlpha = 1; g.lineWidth = Math.max(3, mm * 0.022);
      g.beginPath();
      g.moveTo(blx, baseY); g.lineTo(brx, baseY); g.lineTo(trx, topY); g.lineTo(tlx, topY);
      g.closePath(); g.stroke();
      // foot / plinth
      const fh = mm * 0.05, fhw = halfBot * 1.04;
      g.globalAlpha = 0.15; g.fillStyle = AMBER;
      roundRect(cx - fhw, baseY - fh * 0.35, fhw * 2, fh, fh * 0.45); g.fill();
      g.globalAlpha = 1; g.lineWidth = Math.max(3, mm * 0.02);
      roundRect(cx - fhw, baseY - fh * 0.35, fhw * 2, fh, fh * 0.45); g.stroke();
    }

    function drawScale() {
      const nearest = Math.round((fShown - F_MIN) / (F_MAX - F_MIN + 1e-6) * (GRADS - 1));
      for (let k = 0; k < GRADS; k++) {
        const fr = F_MIN + (F_MAX - F_MIN) * k / (GRADS - 1);
        const y = pivotY - fr * L;
        const hw = halfAt(y) * 0.46;
        const on = k === nearest;
        g.strokeStyle = CREAM;
        g.globalAlpha = on ? (0.55 + 0.4 * flash) : 0.16;
        g.lineWidth = on ? Math.max(2.5, mm * 0.013) : Math.max(1.5, mm * 0.008);
        const ext = on ? hw + mm * 0.022 : hw;
        g.beginPath(); g.moveTo(cx - ext, y); g.lineTo(cx + ext, y); g.stroke();
      }
      g.globalAlpha = 1;
    }

    function drawRod() {
      const tx = rodX(1, armAngle), ty = rodY(1, armAngle);
      const wxp = rodX(fShown, armAngle), wyp = rodY(fShown, armAngle);
      // rod
      g.globalAlpha = 1; g.strokeStyle = CREAM; g.lineWidth = rodW;
      g.beginPath(); g.moveTo(pivotX, pivotY); g.lineTo(tx, ty); g.stroke();
      g.fillStyle = CREAM; g.beginPath(); g.arc(tx, ty, rodW * 0.8, 0, TAU); g.fill();
      // pivot hub
      g.fillStyle = AMBER; g.beginPath(); g.arc(pivotX, pivotY, wr * 0.5, 0, TAU); g.fill();
      g.strokeStyle = CREAM; g.lineWidth = Math.max(2, mm * 0.008);
      g.beginPath(); g.arc(pivotX, pivotY, wr * 0.5, 0, TAU); g.stroke();
      g.fillStyle = CORAL; g.beginPath(); g.arc(pivotX, pivotY, wr * 0.16, 0, TAU); g.fill();
      // sliding weight (coral block riding the rod)
      const aw = wr * 0.95, ah = wr * 1.25;
      g.save();
      g.translate(wxp, wyp); g.rotate(armAngle);
      g.globalAlpha = 0.95; g.fillStyle = CORAL;
      roundRect(-aw, -ah, aw * 2, ah * 2, wr * 0.5); g.fill();
      g.globalAlpha = 1; g.strokeStyle = CREAM; g.lineWidth = Math.max(2, mm * 0.01);
      roundRect(-aw, -ah, aw * 2, ah * 2, wr * 0.5); g.stroke();
      g.globalAlpha = 0.5; g.lineWidth = Math.max(1.5, mm * 0.006);
      for (const gy of [-ah * 0.42, 0, ah * 0.42]) {
        g.beginPath(); g.moveTo(-aw * 0.6, gy); g.lineTo(aw * 0.6, gy); g.stroke();
      }
      g.restore();
      g.globalAlpha = 1;
      // grab affordance on the weight — an obvious 'drag me' at all times
      const overW = Math.hypot(hx - wxp, hy - wyp) < wr + 14;
      if (dragWt || (overW && !dragArm)) {
        g.strokeStyle = CREAM; g.globalAlpha = dragWt ? 0.55 : 0.3; g.lineWidth = 2;
        g.beginPath(); g.arc(wxp, wyp, wr * 1.55, 0, TAU); g.stroke();
      } else if (!dragArm) {
        g.strokeStyle = CORAL; g.globalAlpha = 0.1 + 0.13 * pulse; g.lineWidth = 2;
        g.beginPath(); g.arc(wxp, wyp, wr * (1.42 + 0.16 * pulse), 0, TAU); g.stroke();
      }
      g.globalAlpha = 1;
    }

    function drawFlash() {
      g.globalAlpha = flash * 0.85; g.fillStyle = CREAM;
      g.beginPath(); g.arc(flashX, flashY, wr * (0.28 + 0.24 * flash), 0, TAU); g.fill();
      g.globalAlpha = flash * 0.6; g.strokeStyle = CORAL; g.lineWidth = Math.max(2, mm * 0.011);
      g.beginPath(); g.arc(flashX, flashY, wr * (0.5 + 1.1 * (1 - flash)), 0, TAU); g.stroke();
      g.globalAlpha = 1;
    }

    return {
      draw(t, dt) {
        layout();
        const w = env.w, h = env.h;

        // tempo eases toward the target implied by the (shown) weight height
        const omT = Math.PI * bpmOf(fShown) / 60;
        omega += (omT - omega) * Math.min(1, 8 * dt);
        if (!dragWt) fShown += (f - fShown) * Math.min(1, 12 * dt);
        amp += (IDLE_AMP - amp) * Math.min(1, 2.5 * dt);

        if (!dragArm) {
          phase += omega * dt;
          armAngle = amp * shape(Math.sin(phase));
          const n = Math.floor((phase - Math.PI / 2) / Math.PI);   // extreme just crossed
          if (n > lastN) {
            lastN = n;
            flash = 1;
            flashX = rodX(1, armAngle); flashY = rodY(1, armAngle);
          }
        }
        const rockT = clamp(-0.085 * armAngle, -0.05, 0.05);
        rock += (rockT - rock) * Math.min(1, 10 * dt);
        flash = Math.max(0, flash - dt * 6);
        pulse = 0.5 + 0.5 * Math.sin(t * 1.7);

        // ---- render ----
        g.globalAlpha = 1;
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.lineJoin = 'round'; g.lineCap = 'round';
        g.save();
        g.translate(cx, baseY); g.rotate(rock); g.translate(-cx, -baseY);
        drawBody();
        drawScale();
        drawRod();
        if (flash > 0.02) drawFlash();
        g.restore();
        g.globalAlpha = 1;
      },

      down(p) {
        const lx = unrockX(p.x, p.y), ly = unrockY(p.x, p.y);
        const wxp = rodX(fShown, armAngle), wyp = rodY(fShown, armAngle);
        if (Math.hypot(lx - wxp, ly - wyp) < wr + 14) { dragWt = true; return; }
        if (distToRod(lx, ly) < 26 || (ly < pivotY - 4 && Math.abs(lx - cx) < halfAt(ly) + 10)) {
          dragArm = true; dragV = 0;
        }
      },
      move(p) {
        const lx = unrockX(p.x, p.y), ly = unrockY(p.x, p.y);
        hx = lx; hy = ly;
        if (dragWt) {
          const proj = (lx - pivotX) * Math.sin(armAngle) - (ly - pivotY) * Math.cos(armAngle);
          const fr = clamp(proj / (L + 1e-6), F_MIN, F_MAX);
          f = fr; fShown = fr;                          // weight answers instantly
        } else if (dragArm) {
          const th = Math.atan2(lx - pivotX, -(ly - pivotY));
          const na = clamp(th, -MAX_AMP, MAX_AMP);
          dragV = dragV * 0.6 + (na - armAngle) * 0.4 * 60;
          armAngle = na;                                // arm answers instantly
        }
      },
      up() {
        if (dragArm) {
          dragArm = false;
          // resume the phase-driven swing from the released angle + direction
          if (Math.abs(armAngle) > amp) amp = Math.min(MAX_AMP, Math.abs(armAngle) + 0.02);
          const sVal = shapeInv(clamp(armAngle / (amp + 1e-6), -1, 1));
          let ph = Math.asin(clamp(sVal, -1, 1));       // moving toward +extreme
          if (dragV < 0) ph = Math.PI - ph;             // moving toward -extreme
          phase = ph;
          lastN = Math.floor((phase - Math.PI / 2) / Math.PI);
          amp = clamp(Math.max(amp, IDLE_AMP + Math.min(0.3, Math.abs(dragV) * 0.05)), IDLE_AMP, MAX_AMP);
        }
        dragWt = false;
      },
      wheel(dy) {
        // nudge the weight along the rod (scroll up = weight up = slower)
        f = clamp(f - Math.sign(dy) * 0.06, F_MIN, F_MAX);
      },
      dbl() {
        // glide back to a calm ~120 bpm and give the swing a soft push
        const u = clamp((120 - BPM_FAST) / (BPM_SLOW - BPM_FAST), 0, 1);
        f = clamp(F_MIN + u * (F_MAX - F_MIN), F_MIN, F_MAX);
        amp = clamp(Math.max(amp, IDLE_AMP + 0.16), IDLE_AMP, MAX_AMP);
      },
      leave() { hx = -999; hy = -999; },
    };
  },
});
