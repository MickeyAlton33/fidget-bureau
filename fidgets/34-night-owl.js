/* № 34 — Night owl. A round lilac-and-amber owl perched on a branch under a
   few twinkling stars. Its big cream-and-amber eyes track your pointer, and
   its head springily swivels and cocks to keep watching you — owls turn their
   heads — foreshortening as it turns, then overshooting and settling back. It
   blinks slow, breathes, and ruffles its feathers now and then. Dart in fast
   or get too close and it startles: eyes wide, feathers puffed, a little hop,
   then it settles and stares you down again. */
F.register({
  n: 34, id: 'night-owl', cat: 'critters',
  title: 'Night owl', hint: 'Move around — the owl watches you',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const AMBER = inks[0], CORAL = inks[1], LILAC = inks[4], CREAM = inks[5];
    const DARK = bg;                               // dark pupils
    const AMBER_A = 'rgba(245,165,36,0.5)';        // muted branch / claws base
    const CREAM_R = 'rgba(242,233,220,0.14)';      // moonlit rim light
    const CREAM_G = 'rgba(242,233,220,0.92)';      // eye glint
    const DARK_5 = 'rgba(20,16,13,0.5)';           // eye outline
    const DARK_3 = 'rgba(20,16,13,0.30)';          // chest marks / feather grooves
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

    // ---- pointer ----
    let px = 0, py = 0, ptr = false, haveP = false, ppx = 0, ppy = 0, wasNear = false;

    // ---- springs { p: position, v: velocity } (ease toward target, overshoot) ----
    const yaw = { p: 0, v: 0 }, tilt = { p: 0, v: 0 };            // head swivel / cock
    const hx = { p: 0, v: 0 }, hy = { p: 0, v: 0 }, by = { p: 0, v: 0 }; // head drift + hop
    const puff = { p: 0, v: 0 };                                  // feather puff
    // pupils, stored as offsets in circular (un-foreshortened) eye space
    const pup = [{ x: 0, y: 0, vx: 0, vy: 0 }, { x: 0, y: 0, vx: 0, vy: 0 }];

    // ---- life timers ----
    let startle = 0;
    let blinkP = -1, blinkT = 1.3 + Math.random() * 2.2, reblink = 0;
    let ruffleT = 3 + Math.random() * 3;
    let microT = 1 + Math.random() * 2;
    let miYaw = 0, miTilt = 0, miHx = 0, miHy = 0;                // idle micro-pose targets

    // ---- stars: a few, normalized to the card, kept clear of the owl's head ----
    const stars = [];
    for (let i = 0; i < 5; i++) {
      let x, y, tries = 0;
      do { x = 0.07 + Math.random() * 0.86; y = 0.05 + Math.random() * 0.30; tries++; }
      while (tries < 8 && x > 0.30 && x < 0.70 && y < 0.28);
      stars.push({ x, y, s: 0.007 + Math.random() * 0.011,
        ph: Math.random() * TAU, rate: 0.7 + Math.random() * 1.6,
        amber: Math.random() < 0.25 });
    }

    // ---- head frame (written each frame before the head is drawn) ----
    let _hx = 0, _hy = 0, _co = 1, _si = 0, _ti = 0;
    function TW(lx, ly) { return [_hx + lx * _co - ly * _si, _hy + lx * _si + ly * _co]; }
    function ell(lx, ly, r, rxs, fill) {          // foreshortened + tilted ellipse
      const p = TW(lx, ly);
      g.beginPath();
      g.ellipse(p[0], p[1], Math.max(0.4, r * rxs), Math.max(0.4, r), _ti, 0, TAU);
      g.fillStyle = fill; g.fill();
    }
    function triL(ax, ay, bx, by2, cx2, cy2, fill) {
      const A = TW(ax, ay), B = TW(bx, by2), C = TW(cx2, cy2);
      g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(C[0], C[1]);
      g.closePath(); g.fillStyle = fill; g.fill();
    }
    function sstep(s, target, k, c, dt, vmax) {    // semi-implicit damped spring
      s.v += ((target - s.p) * k - s.v * c) * dt;
      if (s.v > vmax) s.v = vmax; else if (s.v < -vmax) s.v = -vmax;
      s.p += s.v * dt;
    }

    return {
      draw(t, dt) {
        const w = env.w, h = env.h, m = Math.min(w, h);
        const cx = w * 0.5, cy = h * 0.5;
        const R = m * 0.25, headR = m * 0.215;
        const branchY = h * 0.82;

        // ---- pointer speed (frame to frame; no clocks) ----
        let spd = 0;
        if (ptr && haveP) spd = Math.hypot(px - ppx, py - ppy) / Math.max(dt, 1e-3);
        ppx = px; ppy = py; haveP = ptr;

        // approximate face centre (world) for aim + proximity
        const pvy0 = cy - R * 0.30 + by.p + hy.p;
        const fcx = cx + hx.p + Math.sin(yaw.p) * headR * 0.5;
        const fcy = pvy0 - R * 0.34;
        const near = ptr ? Math.hypot(px - fcx, py - fcy) : 1e9;

        // ---- startle: a fast sweep, or a fresh close approach ----
        const isNear = ptr && near < headR * 0.82;
        const isFast = ptr && spd > m * 4.2;
        if ((isFast || (isNear && !wasNear)) && startle < 0.5) {
          by.v -= m * 1.6; hy.v -= m * 1.0; puff.v += 5;          // hop + head jerk + puff
          yaw.v += clamp((px - cx) / (w * 0.4), -1, 1) * 2.2;
          tilt.v += (Math.random() - 0.5) * 1.2;
          blinkP = -1; startle = 1;
        }
        wasNear = isNear;
        startle *= Math.pow(0.09, dt);

        // ---- blink (slow sweep, scheduled; paused while startled) ----
        if (blinkP >= 0) {
          blinkP += dt / 0.42;
          if (blinkP >= 1) {
            if (reblink > 0) { reblink--; blinkP = 0; }
            else { blinkP = -1; blinkT = 2.4 + Math.random() * 3.4; }
          }
        } else {
          blinkT -= dt;
          if (blinkT <= 0 && startle < 0.3) { blinkP = 0; reblink = Math.random() < 0.16 ? 1 : 0; }
        }

        // ---- occasional feather ruffle ----
        ruffleT -= dt;
        if (ruffleT <= 0) {
          puff.v += 3.0 + Math.random() * 1.6;
          hx.v += (Math.random() - 0.5) * m * 1.0;
          tilt.v += (Math.random() - 0.5) * 0.9;
          ruffleT = 4.5 + Math.random() * 5;
        }

        // ---- idle micro head adjustments (little curious re-poses) ----
        microT -= dt;
        if (microT <= 0) {
          miYaw = (Math.random() - 0.5) * 0.20;
          miTilt = (Math.random() - 0.5) * 0.14;
          miHx = (Math.random() - 0.5) * m * 0.02;
          miHy = (Math.random() - 0.5) * m * 0.02;
          microT = 1.4 + Math.random() * 2.4;
        }

        // ---- spring targets ----
        let tYaw = miYaw + Math.sin(t * 0.35) * 0.05;             // gentle idle sway
        let tTilt = miTilt + Math.sin(t * 0.6) * 0.03;
        let tHx = miHx, tHy = miHy;
        if (ptr) {
          tYaw += clamp((px - cx) / (w * 0.40), -1, 1) * 1.2;      // swivel toward you
          tTilt += clamp((px - cx) / (w * 0.55), -1, 1) * 0.16
                 - clamp((py - fcy) / (h * 0.5), -1, 1) * 0.05;    // curious cock
          tHx += clamp((px - cx) / (w * 0.5), -1, 1) * R * 0.05;
          tHy += clamp((py - fcy) / (h * 0.5), -1, 1) * R * 0.10;
        }
        if (startle > 0.05) {                                     // frightened shiver
          tTilt += Math.sin(t * 40) * 0.05 * startle;
          tHx += Math.sin(t * 34) * m * 0.01 * startle;
        }
        sstep(yaw, tYaw, 90, 11, dt, 30); yaw.p = clamp(yaw.p, -1.3, 1.3);
        sstep(tilt, tTilt, 95, 12, dt, 30); tilt.p = clamp(tilt.p, -1.0, 1.0);
        sstep(hx, tHx, 70, 10, dt, m * 20);
        sstep(hy, tHy, 70, 10, dt, m * 20);
        sstep(by, 0, 120, 12, dt, m * 30); by.p = clamp(by.p, -R * 0.6, R * 0.3);
        sstep(puff, startle * 0.5, 55, 9, dt, 60); puff.p = clamp(puff.p, 0, 1.4);

        const breath = Math.sin(t * 1.5);
        const puffAmt = puff.p;

        // ============================ paint ============================
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.lineJoin = 'round'; g.lineCap = 'round';

        // subtle crescent moon (a night marker, top corner)
        g.globalAlpha = 0.8;
        g.fillStyle = CREAM;
        g.beginPath(); g.arc(w * 0.82, h * 0.15, m * 0.062, 0, TAU); g.fill();
        g.fillStyle = bg;
        g.beginPath(); g.arc(w * 0.82 + m * 0.026, h * 0.15 - m * 0.018, m * 0.06, 0, TAU); g.fill();
        g.globalAlpha = 1;

        // twinkling stars
        for (const st of stars) {
          const tw = 0.5 + 0.5 * Math.sin(t * st.rate + st.ph);
          const X = st.x * w, Y = st.y * h, rad = st.s * m * (0.6 + 0.8 * tw);
          g.globalAlpha = 0.18 + 0.6 * tw;
          g.fillStyle = st.amber ? AMBER : CREAM;
          g.beginPath();
          for (let k = 0; k < 8; k++) {
            const ang = k / 8 * TAU - Math.PI / 2, rr = (k % 2) ? rad * 0.34 : rad;
            const X2 = X + rr * Math.cos(ang), Y2 = Y + rr * Math.sin(ang);
            k ? g.lineTo(X2, Y2) : g.moveTo(X2, Y2);
          }
          g.closePath(); g.fill();
        }
        g.globalAlpha = 1;

        // branch
        g.strokeStyle = AMBER_A; g.lineWidth = m * 0.06;
        g.beginPath(); g.moveTo(w * 0.05, branchY); g.lineTo(w * 0.95, branchY + m * 0.006); g.stroke();
        g.strokeStyle = CREAM_R; g.lineWidth = m * 0.018;
        g.beginPath(); g.moveTo(w * 0.12, branchY - m * 0.022); g.lineTo(w * 0.88, branchY - m * 0.022); g.stroke();
        g.strokeStyle = AMBER_A; g.lineWidth = m * 0.028;
        g.beginPath();
        g.moveTo(w * 0.72, branchY);
        g.quadraticCurveTo(w * 0.80, branchY - m * 0.09, w * 0.87, branchY - m * 0.13);
        g.stroke();

        // feet: legs + talons gripping the branch (lift a touch on the hop)
        for (const s of [-1, 1]) {
          const fx = cx + s * R * 0.34;
          const legTop = cy + R * 0.70 + by.p;
          g.strokeStyle = AMBER; g.lineWidth = m * 0.03;
          g.beginPath(); g.moveTo(fx, legTop); g.lineTo(fx, branchY - m * 0.01); g.stroke();
          g.strokeStyle = CORAL; g.lineWidth = m * 0.022;
          for (const tt of [-1, 0, 1]) {
            g.beginPath();
            g.moveTo(fx, branchY - m * 0.02);
            g.quadraticCurveTo(fx + tt * m * 0.03, branchY + m * 0.015, fx + tt * m * 0.045, branchY + m * 0.055);
            g.stroke();
          }
        }

        // ---- body: breathing egg with a puff ripple ----
        const byy = cy + by.p;
        g.fillStyle = LILAC;
        g.beginPath();
        const NB = 30;
        for (let k = 0; k <= NB; k++) {
          const a = k / NB * TAU;
          const down = (Math.sin(a) + 1) * 0.5;               // wider toward the base
          const rx = R * (0.80 + 0.12 * down);
          const ry = R * (1.00 + 0.02 * breath);
          const bump = 1 + puffAmt * 0.05 * Math.sin(9 * a + t * 3) + 0.02 * Math.sin(3 * a + t * 0.7);
          const X = cx + rx * bump * Math.cos(a);
          const Y = byy + ry * bump * Math.sin(a);
          k ? g.lineTo(X, Y) : g.moveTo(X, Y);
        }
        g.closePath(); g.fill();
        g.strokeStyle = CREAM_R; g.lineWidth = m * 0.02;
        g.beginPath(); g.ellipse(cx, byy, R * 0.84, R * 1.0, 0, Math.PI * 1.06, Math.PI * 1.72); g.stroke();

        // ---- wings: fold at the sides, flare on puff/startle ----
        for (const s of [-1, 1]) {
          const ang = s * (0.22 + puffAmt * 0.22 + startle * 0.16);
          const wx = cx + s * R * 0.60, wy = byy + R * 0.02;
          g.fillStyle = LILAC;
          g.beginPath(); g.ellipse(wx, wy, R * 0.24, R * 0.56, ang, 0, TAU); g.fill();
          g.strokeStyle = DARK_3; g.lineWidth = m * 0.012;
          g.beginPath(); g.ellipse(wx, wy + R * 0.18, R * 0.19, R * 0.30, ang, 0, TAU); g.stroke();
          g.strokeStyle = CREAM_R; g.lineWidth = m * 0.018;
          g.beginPath(); g.ellipse(wx, wy, R * 0.24, R * 0.56, ang, Math.PI, Math.PI * 1.6); g.stroke();
        }

        // ---- belly patch + chest chevrons ----
        g.fillStyle = AMBER;
        g.beginPath(); g.ellipse(cx, byy + R * 0.28, R * 0.50, R * 0.60, 0, 0, TAU); g.fill();
        g.strokeStyle = DARK_3; g.lineWidth = m * 0.013;
        for (let i = 0; i < 3; i++) {
          const yy = byy + R * 0.10 + i * R * 0.22;
          g.beginPath();
          g.moveTo(cx - R * 0.20, yy); g.lineTo(cx, yy + R * 0.10); g.lineTo(cx + R * 0.20, yy);
          g.stroke();
        }

        // ============================ head ============================
        _hx = cx + hx.p;
        _hy = pvy0 + Math.sin(t * 1.5) * R * 0.01;
        _ti = tilt.p; _co = Math.cos(_ti); _si = Math.sin(_ti);
        const fsx = Math.max(0.34, Math.cos(yaw.p));       // horizontal foreshorten as it turns
        const faceShift = Math.sin(yaw.p) * headR * 0.52;  // face slides toward the turn
        const hcl = -R * 0.34;                             // head centre (head-local y)
        const eyeR0 = headR * 0.46;                        // big, bold eyes
        const eyeR = eyeR0 * (1 + startle * 0.16);         // widen when startled
        const irisR = eyeR * 0.58;
        const pupR = eyeR * 0.42 * (1 - startle * 0.10);
        const eyeGap = eyeR0 * 1.04;
        const eyeLY = hcl - headR * 0.03;
        const beakLY = eyeLY + eyeR0 * 1.18;
        const tuftLY = hcl - headR * 0.80;
        const maxD = Math.max(1, eyeR - irisR - m * 0.004);

        // back-of-head bump (peeks out on the far side when the head is turned)
        if (Math.abs(faceShift) > headR * 0.08) {
          ell(-faceShift * 0.7, hcl + headR * 0.04, headR * 0.82, 0.55 + 0.2 * fsx, LILAC);
        }
        // ear tufts (perk up when startled / ruffled)
        const tuftH = headR * (0.5 + startle * 0.25 + puffAmt * 0.18);
        for (const s of [-1, 1]) {
          const bxr = faceShift * 0.5 + s * headR * 0.5;
          triL(bxr - headR * 0.14, tuftLY, bxr + headR * 0.14, tuftLY,
               bxr + s * headR * 0.09, tuftLY - tuftH, LILAC);
        }
        // head dome + rim light
        ell(faceShift * 0.15, hcl, headR, 0.86 + 0.14 * fsx, LILAC);
        {
          const p = TW(faceShift * 0.15, hcl);
          g.strokeStyle = CREAM_R; g.lineWidth = m * 0.02;
          g.beginPath();
          g.ellipse(p[0], p[1], headR * (0.86 + 0.14 * fsx), headR, _ti, Math.PI * 1.08, Math.PI * 1.7);
          g.stroke();
        }
        // amber facial discs
        for (const s of [-1, 1]) {
          ell(faceShift + s * eyeGap * fsx, eyeLY, eyeR * 1.16, fsx, AMBER);
        }
        // brow ridges (lift when startled)
        for (const s of [-1, 1]) {
          const p = TW(faceShift + s * eyeGap * fsx, eyeLY - eyeR * 0.12 - startle * eyeR * 0.22);
          g.strokeStyle = LILAC; g.lineWidth = m * 0.022;
          g.beginPath();
          g.ellipse(p[0], p[1], eyeR * 1.08 * fsx, eyeR, _ti, Math.PI * 1.12, Math.PI * 1.88);
          g.stroke();
        }
        // cream sclera
        for (const s of [-1, 1]) {
          ell(faceShift + s * eyeGap * fsx, eyeLY, eyeR, fsx, CREAM);
        }
        // iris + pupil + glint (tracking), blink lid, outline
        for (let i = 0; i < 2; i++) {
          const s = i ? 1 : -1;
          const elx = faceShift + s * eyeGap * fsx;
          const ew = TW(elx, eyeLY);
          const P = pup[i];
          let tx, ty;
          if (ptr) {                                        // aim toward pointer, in eye space
            const ddx = px - ew[0], ddy = py - ew[1];
            const lxp = (ddx * _co + ddy * _si) / fsx;      // un-tilt, un-foreshorten
            const lyp = -ddx * _si + ddy * _co;
            const dd = Math.hypot(lxp, lyp) + 1e-6;
            const mag = Math.min(maxD, maxD * dd / (m * 0.42));
            tx = lxp / dd * mag; ty = lyp / dd * mag;
          } else {                                          // idle wander
            tx = Math.sin(t * 0.5 + s) * eyeR * 0.12;
            ty = Math.sin(t * 0.37 + s * 2) * eyeR * 0.10 + eyeR * 0.05;
          }
          P.vx += ((tx - P.x) * 140 - P.vx * 13) * dt;      // springy pupils (overshoot)
          P.vy += ((ty - P.y) * 140 - P.vy * 13) * dt;
          const vm = Math.hypot(P.vx, P.vy), vmax = m * 30;
          if (vm > vmax) { P.vx *= vmax / vm; P.vy *= vmax / vm; }
          P.x += P.vx * dt; P.y += P.vy * dt;
          const pd = Math.hypot(P.x, P.y) + 1e-6;
          if (pd > maxD) { P.x *= maxD / pd; P.y *= maxD / pd; }
          const ilx = elx + P.x * fsx, ily = eyeLY + P.y;
          ell(ilx, ily, irisR, fsx, AMBER);
          ell(ilx, ily, pupR, fsx, DARK);
          ell(ilx - eyeR * 0.13, ily - eyeR * 0.15, eyeR * 0.12, fsx, CREAM_G);
          const lid = blinkP >= 0 ? Math.sin(Math.PI * Math.min(1, blinkP)) : 0;
          if (lid > 0.001) {
            g.save();
            g.beginPath(); g.ellipse(ew[0], ew[1], eyeR * fsx, eyeR, _ti, 0, TAU); g.clip();
            g.fillStyle = LILAC;
            g.fillRect(ew[0] - eyeR - 2, ew[1] - eyeR - 2, (eyeR + 2) * 2, lid * 2 * eyeR + 2);
            g.restore();
          }
          g.strokeStyle = DARK_5; g.lineWidth = Math.max(1.5, m * 0.006);
          g.beginPath(); g.ellipse(ew[0], ew[1], eyeR * fsx, eyeR, _ti, 0, TAU); g.stroke();
        }
        // coral beak (opens a touch when startled)
        {
          const bw = eyeR0 * 0.34, openG = startle * eyeR0 * 0.16;
          triL(faceShift - bw * fsx, beakLY, faceShift + bw * fsx, beakLY,
               faceShift, beakLY + eyeR0 * 0.55, CORAL);
          triL(faceShift - bw * 0.6 * fsx, beakLY + eyeR0 * 0.5 + openG,
               faceShift + bw * 0.6 * fsx, beakLY + eyeR0 * 0.5 + openG,
               faceShift, beakLY + eyeR0 * 0.85 + openG, CORAL);
        }
      },
      down(p) {
        const m = Math.min(env.w, env.h);
        px = p.x; py = p.y; ptr = true;
        startle = 1;                                        // poke = big startle + hop
        by.v -= m * 1.9; hy.v -= m * 1.2; puff.v += 6.5;
        yaw.v += clamp((px - env.w * 0.5) / (env.w * 0.4), -1, 1) * 3.2;
        blinkP = -1;
      },
      move(p) { px = p.x; py = p.y; ptr = true; },
      dbl(p) {                                              // curious head-roll + blink
        px = p.x; py = p.y; ptr = true;
        tilt.v += (px > env.w * 0.5 ? 1 : -1) * 7.0;
        puff.v += 3; blinkP = 0;
      },
      leave() { ptr = false; haveP = false; wasNear = false; },
    };
  },
});
