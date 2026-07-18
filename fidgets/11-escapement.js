/* № 11 — Escapement. A working clock heart: pendulum, coral anchor, 18-tooth
   amber escape wheel under constant spring torque. Each beat frees exactly one
   tooth — velocity burst, hard catch, 1px recoil. Drag the bob to pump the
   beat; press-hold the anchor to let the wheel scream free, then catch it. */
F.register({
  n: 11, id: 'escapement', cat: 'mech',
  title: 'Escapement', hint: 'Drag the bob — hold the anchor to bank up ticks',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2, TOOTH = TAU / 18;
    const AMBER = inks[0], CORAL = inks[1], CREAM = inks[5];
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    // pendulum
    let pa = 0.30, pv = 0, amp = 0.30;     // angle from vertical-down, ang vel
    const K = 20, DAMP = 0.2, KICK = 0.10, TH = 0.05;
    let side = 0;                          // last release side (-1|0|1)
    // escape wheel
    let wa = 0, wv = 0, lockA = 0;         // angle, velocity, locked angle
    let mode = 'lock';                     // 'lock' | 'adv' | 'free'
    let advT = 0, clatterN = 0, clatterT = 0, freeTooth = 0;
    const BURST = 7.5, ACC = 34, FREE = 15;
    // banked spring, subdial, fx
    let bank = 0.75, subSteps = 0, subA = 0, subV = 0;
    let snap = 0, catchDir = 1, liftE = 0;
    // interaction
    let drag = false, holding = false, dragV = 0, hx = -999, hy = -999;
    let m, P = { x: 0, y: 0 }, W = { x: 0, y: 0, r: 1 }, L = 1, bobR = 1, S = { x: 0, y: 0, r: 1 };
    function layout() {
      const w = env.w, h = env.h; m = Math.min(w, h);
      P.x = w * 0.5; P.y = h * 0.115;
      W.x = w * 0.5; W.y = P.y + 0.30 * m; W.r = 0.185 * m;
      L = 0.60 * m; bobR = Math.max(10, 0.058 * m);
      S.x = w * 0.81; S.y = h * 0.76; S.r = 0.078 * m;
    }
    layout();

    function doCatch() {
      wa = advT; lockA = advT; wv = 0; mode = 'lock';
      snap = 1; catchDir = -catchDir; subSteps++;
      bank = Math.max(0, bank - 0.006);
      if (clatterN > 0) clatterT = 0.055 + Math.random() * 0.035;
    }
    function startAdv(v) { mode = 'adv'; advT = lockA + TOOTH; wv = v; }
    function release() {                   // pendulum passed a pallet threshold
      if (!drag) pv += KICK * (pv >= 0 ? 1 : -1) * (bank > 0.02 ? 1 : 0.45);
      if (mode === 'lock' && clatterN === 0) startAdv(BURST);
    }

    function drawWheel(a, spd) {
      const x = W.x, y = W.y, r = W.r, Ro = r * 1.11, Ri = r * 0.95;
      g.lineJoin = g.lineCap = 'round';
      g.strokeStyle = AMBER;
      const crisp = spd > 6 ? Math.max(0.22, 1 - (spd - 6) / 13) : 1;
      if (spd > 6) {                       // motion-blur arcs at speed
        const trail = Math.min(1.25, spd * 0.06);
        g.globalAlpha = 0.16; g.lineWidth = 4;
        for (let s = 0; s < 5; s++) {
          const sa = a + (s / 5) * TAU;
          g.beginPath(); g.arc(x, y, r * 0.55, sa - trail, sa); g.stroke();
        }
        g.globalAlpha = 0.10; g.lineWidth = 6;
        for (let s = 0; s < 3; s++) {
          const sa = a + (s / 3) * TAU;
          g.beginPath(); g.arc(x, y, Ro - 3, sa - trail * 1.4, sa); g.stroke();
        }
      }
      g.globalAlpha = crisp; g.lineWidth = 2.5;
      g.beginPath();                       // 18 ratchet teeth
      for (let k = 0; k < 18; k++) {
        const a0 = a + k * TOOTH, a1 = a0 + TOOTH * 0.18;
        g.lineTo(x + Ro * Math.cos(a0), y + Ro * Math.sin(a0));
        g.lineTo(x + Ri * Math.cos(a1), y + Ri * Math.sin(a1));
      }
      g.closePath(); g.stroke();
      g.beginPath(); g.arc(x, y, r * 0.72, 0, TAU); g.stroke();
      for (let s = 0; s < 5; s++) {
        const sa = a + (s / 5) * TAU;
        g.beginPath();
        g.moveTo(x + r * 0.30 * Math.cos(sa), y + r * 0.30 * Math.sin(sa));
        g.lineTo(x + r * 0.70 * Math.cos(sa), y + r * 0.70 * Math.sin(sa));
        g.stroke();
      }
      // banked mainspring: a hub spiral that visibly unwinds as it spends
      g.globalAlpha = 0.7; g.strokeStyle = CREAM; g.lineWidth = 1.8;
      const turns = (0.5 + 2.5 * bank) * TAU;
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const f = i / 40, an = a * 0.3 + f * turns, rr = 2 + f * (r * 0.26 - 2);
        g.lineTo(x + rr * Math.cos(an), y + rr * Math.sin(an));
      }
      g.stroke(); g.globalAlpha = 1;
    }
    function drawAnchor() {
      const lift = liftE * 0.05 * m, rot = clamp(pa, -0.6, 0.6) * 0.33;
      const ax = P.x + snap * 1.5 * catchDir, ay = P.y - lift * 0.3;
      g.strokeStyle = CORAL; g.lineWidth = 3.5; g.lineCap = 'round';
      for (let s = -1; s <= 1; s += 2) {
        const ba = -Math.PI / 2 + s * 0.55;
        const tx = W.x + (W.r + 4) * Math.cos(ba) - P.x;
        const ty = W.y + (W.r + 4) * Math.sin(ba) - P.y;
        const rr = rot + s * liftE * 0.28, ca = Math.cos(rr), sa = Math.sin(rr);
        const vx = tx * ca - ty * sa, vy = tx * sa + ty * ca;
        const TX = ax + vx, TY = ay + vy - lift;
        g.beginPath(); g.moveTo(ax, ay);
        g.quadraticCurveTo(ax + vx * 0.45 + s * 0.05 * m, ay + vy * 0.35 - lift * 0.5, TX, TY);
        g.stroke();
        const fl = W.r * 0.18, fan = ba + rr + Math.PI + s * 0.85;   // pallet flag
        g.beginPath(); g.moveTo(TX, TY);
        g.lineTo(TX + fl * Math.cos(fan), TY + fl * Math.sin(fan)); g.stroke();
        if (snap > 0.03 && s === catchDir) {   // spark on the catching pallet
          g.fillStyle = CREAM; g.globalAlpha = snap * 0.85;
          g.beginPath(); g.arc(TX, TY, 2.5 + 3.5 * snap, 0, TAU); g.fill();
          g.globalAlpha = 1;
        }
      }
      g.beginPath(); g.arc(ax, ay, 4.5, 0, TAU); g.stroke();
    }

    return {
      draw(t, dt) {
        if (!drag) {                       // pendulum physics
          pv += (-K * Math.sin(pa) - DAMP * pv - 0.05 * pv * Math.abs(pv)) * dt;
          if (amp < 0.15) pv += 0.5 * dt * (pv >= 0 ? 1 : -1);   // never stall
          pv = clamp(pv, -10, 10);
          pa += pv * dt;
          if (pa > 1.5) { pa = 1.5; pv *= -0.3; }                // banking pins
          if (pa < -1.5) { pa = -1.5; pv *= -0.3; }
        }
        amp = Math.max(Math.abs(pa), amp * (1 - 0.5 * dt));
        if (side !== 1 && pa > TH) { side = 1; release(); }
        else if (side !== -1 && pa < -TH) { side = -1; release(); }
        if (mode === 'adv') {              // one tooth in flight
          wv += ACC * dt; wa += wv * dt;
          if (wa >= advT) doCatch();
        } else if (mode === 'free') {      // anchor lifted: wheel runs away
          wv += ((bank > 0.02 ? FREE : 2.5) - wv) * 4 * dt;
          wa += wv * dt;
          bank = Math.max(0, bank - Math.abs(wv) * 0.016 * dt);
          const ft = Math.floor(wa / TOOTH);
          if (ft > freeTooth) { subSteps += ft - freeTooth; freeTooth = ft; }
        } else {
          bank = Math.min(1, bank + 0.05 * dt);
          if (clatterN > 0 && (clatterT -= dt) <= 0) { clatterN--; startAdv(BURST * 1.15); }
        }
        liftE += ((holding ? 1 : 0) - liftE) * Math.min(1, 11 * dt);
        snap = Math.max(0, snap - dt * 7);
        subV += ((subSteps * TOOTH - subA) * 85 - subV * 11) * dt;   // subdial hand
        subA += subV * dt;
        // --- render ---
        g.fillStyle = bg; g.fillRect(0, 0, env.w, env.h);
        g.globalAlpha = 0.35; g.strokeStyle = AMBER; g.lineWidth = 2;
        g.beginPath(); g.arc(S.x, S.y, S.r, 0, TAU); g.stroke();
        g.globalAlpha = 0.3; g.strokeStyle = CREAM; g.lineWidth = 1.8;
        for (let k = 0; k < 6; k++) {
          const a = k * TAU / 6 - Math.PI / 2;
          g.beginPath();
          g.moveTo(S.x + S.r * 0.78 * Math.cos(a), S.y + S.r * 0.78 * Math.sin(a));
          g.lineTo(S.x + S.r * 0.94 * Math.cos(a), S.y + S.r * 0.94 * Math.sin(a));
          g.stroke();
        }
        g.globalAlpha = 1; g.lineWidth = 2.5; g.strokeStyle = CREAM;
        const ha = subA - Math.PI / 2;
        g.beginPath(); g.moveTo(S.x, S.y);
        g.lineTo(S.x + S.r * 0.72 * Math.cos(ha), S.y + S.r * 0.72 * Math.sin(ha));
        g.stroke();
        g.fillStyle = CORAL; g.beginPath(); g.arc(S.x, S.y, 2.5, 0, TAU); g.fill();
        drawWheel(wa - (mode === 'lock' ? snap * 0.02 : 0), Math.abs(wv));
        drawAnchor();
        // pendulum: cream rod, brass-circle bob, drawn in front
        const bx = P.x + L * Math.sin(pa), by = P.y + L * Math.cos(pa);
        g.strokeStyle = CREAM; g.lineWidth = 3; g.globalAlpha = 0.95;
        g.beginPath(); g.moveTo(P.x, P.y); g.lineTo(bx, by); g.stroke();
        g.globalAlpha = 0.15; g.fillStyle = AMBER;
        g.beginPath(); g.arc(bx, by, bobR, 0, TAU); g.fill();
        g.globalAlpha = 1; g.strokeStyle = AMBER; g.lineWidth = 3.5;
        g.beginPath(); g.arc(bx, by, bobR, 0, TAU); g.stroke();
        g.fillStyle = CREAM; g.beginPath(); g.arc(bx, by, 2.5, 0, TAU); g.fill();
        if (drag || Math.hypot(hx - bx, hy - by) < bobR + 14) {   // grab affordance
          g.strokeStyle = CREAM; g.globalAlpha = drag ? 0.5 : 0.25; g.lineWidth = 2;
          g.beginPath(); g.arc(bx, by, bobR + 7, 0, TAU); g.stroke();
          g.globalAlpha = 1;
        }
      },
      down(p) {
        if (p.y < env.h / 3) {             // grab the anchor: freewheel
          holding = true; mode = 'free'; clatterN = 0;
          freeTooth = Math.floor(wa / TOOTH);
        } else {                           // grab the bob
          drag = true; dragV = 0;
          pa = clamp(Math.atan2(p.x - P.x, p.y - P.y), -1.35, 1.35);
        }
      },
      move(p) {
        hx = p.x; hy = p.y;
        if (!drag) return;
        const na = clamp(Math.atan2(p.x - P.x, p.y - P.y), -1.35, 1.35);
        dragV = dragV * 0.55 + (na - pa) * 0.45 * 60;
        pa = na;
      },
      up() {
        if (drag) { pv = clamp(dragV, -8, 8); drag = false; }
        if (holding) {                     // re-engage: catch-up clatter
          holding = false;
          lockA = (Math.floor(wa / TOOTH) + 1) * TOOTH;
          clatterN = 1 + ((Math.random() * 2) | 0);
          advT = lockA; mode = 'adv';      // slam into the first catch at speed
        }
      },
      resize() { layout(); },
    };
  },
});
