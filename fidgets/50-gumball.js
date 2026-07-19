/* № 50 — Gumball machine. A glass globe packed with candy-coloured gumballs
   that jostle under gravity. Crank the coral knob (drag it in a circle) and
   every turn drops one ball down the chute — it bounces into the tray while
   the globe refills from the top and the pile resettles. */
F.register({
  n: 50, id: 'gumball', cat: 'chaos',
  title: 'Gumball machine', hint: 'Turn the crank to drop a gumball',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const CREAM = inks[5], CORAL = inks[1], AMBER = inks[0];
    const DARK = '20,16,13';

    // physics / gameplay constants
    const H = 1 / 120;                 // fixed sim step
    const DAMP = Math.pow(0.12, H);    // globe velocity damping / substep
    const TDAMP = Math.pow(0.4, H);    // tray velocity damping / substep
    const N_TARGET = 26;               // gumballs kept in the globe
    const TRAY_CAP = 6;                // dispensed balls kept in the tray
    const STEP = TAU * 0.5;            // crank travel per gumball (half turn)
    const MAXW = TAU * 2.6;            // crank flick speed cap (rad/s)

    // geometry — all set in layout()
    let cx, gcy, GR, br;
    let collarY, baseBot, baseTopHalf, baseBotHalf;
    let neckY, chuteHalf, chuteMouthY, trayHalf, trayFloorY;
    let knobCX, knobCY, knobR, GRAV, VMAX, globeGrad, baseGrad;

    // state (arrays allocated ONCE, mutated in place)
    const balls = [];      // globe gumballs {x,y,vx,vy,ink}
    const dispensed = [];  // {x,y,vx,vy,ink,stage,alpha,leaving}
    let crankAngle = 0, crankVel = 0, crankAccum = 0, grab = false, grabAng = 0;
    let physAcc = 0, refillCd = 0, nudgeCd = 1, dispenseFlash = 0;

    function layout() {
      const w = env.w, h = env.h, m = Math.min(w, h);
      cx = w / 2;
      GR = m * 0.275;
      gcy = h * 0.30;
      br = GR * 0.15;
      collarY = gcy + GR * 0.86;
      baseBot = h * 0.955;
      baseTopHalf = GR * 0.72;
      baseBotHalf = GR * 1.02;
      neckY = collarY + br;
      chuteHalf = br * 1.35;
      chuteMouthY = h * 0.775;
      trayHalf = GR * 0.66;
      trayFloorY = h * 0.895;
      knobR = GR * 0.17;
      knobCX = cx + GR * 0.60;
      knobCY = collarY + (baseBot - collarY) * 0.36;
      GRAV = m * 4.0;
      VMAX = m * 25;
      globeGrad = g.createRadialGradient(cx - GR * 0.32, gcy - GR * 0.36, GR * 0.08, cx, gcy, GR);
      globeGrad.addColorStop(0, 'rgba(242,233,220,0.12)');
      globeGrad.addColorStop(0.55, 'rgba(242,233,220,0.03)');
      globeGrad.addColorStop(1, 'rgba(20,16,13,0.38)');
      baseGrad = g.createLinearGradient(0, collarY, 0, baseBot);
      baseGrad.addColorStop(0, 'rgba(20,16,13,0.0)');
      baseGrad.addColorStop(1, 'rgba(20,16,13,0.45)');
    }

    function initFill() {
      balls.length = 0;
      for (let i = 0; i < N_TARGET; i++) {
        const a = Math.random() * TAU, rr2 = Math.sqrt(Math.random()) * (GR - br) * 0.92;
        balls.push({ x: cx + Math.cos(a) * rr2, y: gcy + Math.sin(a) * rr2, vx: 0, vy: 0, ink: (Math.random() * 6) | 0 });
      }
    }
    layout(); initFill();

    // --- physics helpers ---------------------------------------------------
    function collide(a, b, rest) {
      let dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) + 1e-6;
      const minD = br * 2;
      if (d >= minD) return;
      const nx = dx / d, ny = dy / d, ov = (minD - d) * 0.5;
      a.x -= nx * ov; a.y -= ny * ov;
      b.x += nx * ov; b.y += ny * ov;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn < 0) {
        const j = -(1 + rest) * vn * 0.5;
        a.vx -= j * nx; a.vy -= j * ny;
        b.vx += j * nx; b.vy += j * ny;
      }
    }
    function confineGlobe(b) {
      const dx = b.x - cx, dy = b.y - gcy;
      const d = Math.hypot(dx, dy) + 1e-6, maxD = GR - br;
      if (d > maxD) {
        const nx = dx / d, ny = dy / d;
        b.x = cx + nx * maxD; b.y = gcy + ny * maxD;
        const vn = b.vx * nx + b.vy * ny;
        if (vn > 0) { b.vx -= 1.1 * vn * nx; b.vy -= 1.1 * vn * ny; }
      }
    }
    function confineDisp(d) {
      if (d.stage === 0) {                     // in the narrow chute
        const lo = cx - chuteHalf + br, hi = cx + chuteHalf - br;
        if (d.x < lo) { d.x = lo; if (d.vx < 0) d.vx *= -0.4; }
        else if (d.x > hi) { d.x = hi; if (d.vx > 0) d.vx *= -0.4; }
        if (d.y >= chuteMouthY) d.stage = 1;
      } else {                                 // loose in the tray
        const lo = cx - trayHalf + br, hi = cx + trayHalf - br;
        if (d.x < lo) { d.x = lo; if (d.vx < 0) d.vx *= -0.35; }
        else if (d.x > hi) { d.x = hi; if (d.vx > 0) d.vx *= -0.35; }
        const fl = trayFloorY - br;
        if (d.y > fl) { d.y = fl; if (d.vy > 0) d.vy *= -0.35; d.vx *= 0.86; }
      }
      if (!isFinite(d.x)) { d.x = cx; d.vx = 0; }
      if (!isFinite(d.y)) { d.y = chuteMouthY; d.vy = 0; }
    }
    function clampV(b) {
      if (!isFinite(b.vx)) b.vx = 0; else b.vx = b.vx < -VMAX ? -VMAX : b.vx > VMAX ? VMAX : b.vx;
      if (!isFinite(b.vy)) b.vy = 0; else b.vy = b.vy < -VMAX ? -VMAX : b.vy > VMAX ? VMAX : b.vy;
    }
    function substep(t) {
      const gx = Math.sin(t * 0.9) * GRAV * 0.05;   // gentle rock keeps the pile alive
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        b.vx = (b.vx + gx * H) * DAMP; b.vy = (b.vy + GRAV * H) * DAMP;
        b.x += b.vx * H; b.y += b.vy * H;
      }
      for (let i = 0; i < balls.length; i++)
        for (let j = i + 1; j < balls.length; j++) collide(balls[i], balls[j], 0.08);
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        if (!isFinite(b.x) || !isFinite(b.y)) { b.x = cx; b.y = gcy; b.vx = 0; b.vy = 0; }
        confineGlobe(b); clampV(b);
      }
      for (let i = 0; i < dispensed.length; i++) {
        const d = dispensed[i];
        d.vx = d.vx * TDAMP; d.vy = (d.vy + GRAV * H) * TDAMP;
        d.x += d.vx * H; d.y += d.vy * H;
        confineDisp(d);
      }
      for (let i = 0; i < dispensed.length; i++)
        for (let j = i + 1; j < dispensed.length; j++) {
          if (dispensed[i].leaving || dispensed[j].leaving) continue;
          collide(dispensed[i], dispensed[j], 0.26);
        }
      for (let i = 0; i < dispensed.length; i++) { confineDisp(dispensed[i]); clampV(dispensed[i]); }
    }

    // --- gameplay ----------------------------------------------------------
    function spawnGlobeBall() {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.3;
      const rr2 = (GR - br) * (0.5 + Math.random() * 0.32);
      balls.push({ x: cx + Math.cos(a) * rr2, y: gcy + Math.sin(a) * rr2 - (GR - br) * 0.1,
        vx: (Math.random() - 0.5) * 20, vy: 20, ink: (Math.random() * 6) | 0 });
    }
    function dispense() {
      if (balls.length === 0) return;
      let bi = 0, best = -Infinity;                 // pick the lowest, most central ball
      for (let i = 0; i < balls.length; i++) {
        const s = balls[i].y - Math.abs(balls[i].x - cx) * 0.35;
        if (s > best) { best = s; bi = i; }
      }
      const b = balls[bi];
      balls.splice(bi, 1);
      dispensed.push({ x: cx + (Math.random() - 0.5) * chuteHalf, y: neckY,
        vx: (Math.random() - 0.5) * 30, vy: 55 + Math.random() * 40,
        ink: b.ink, stage: 0, alpha: 1, leaving: false });
      dispenseFlash = 1;
      let live = 0;
      for (let i = 0; i < dispensed.length; i++) if (!dispensed[i].leaving) live++;
      if (live > TRAY_CAP) {
        for (let i = 0; i < dispensed.length; i++) {
          if (!dispensed[i].leaving) { dispensed[i].leaving = true; break; }
        }
      }
    }
    function processDispense() {
      let guard = 0;
      while (crankAccum >= STEP && guard < 3) { crankAccum -= STEP; dispense(); guard++; }
      while (crankAccum <= -STEP && guard < 3) { crankAccum += STEP; dispense(); guard++; }
      if (guard >= 3) crankAccum = 0;
    }

    // --- rendering helpers -------------------------------------------------
    function rr(x, y, wd, ht, rad) {
      const r = Math.min(rad, wd / 2, ht / 2);
      g.beginPath();
      g.moveTo(x + r, y);
      g.lineTo(x + wd - r, y); g.arc(x + wd - r, y + r, r, -Math.PI / 2, 0);
      g.lineTo(x + wd, y + ht - r); g.arc(x + wd - r, y + ht - r, r, 0, Math.PI / 2);
      g.lineTo(x + r, y + ht); g.arc(x + r, y + ht - r, r, Math.PI / 2, Math.PI);
      g.lineTo(x, y + r); g.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
      g.closePath();
    }
    function gum(x, y, ink, alpha) {
      if (alpha <= 0) return;
      const r = br;
      g.globalAlpha = alpha;
      g.fillStyle = ink;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.globalAlpha = alpha * 0.26;                 // inner rim shadow → roundness
      g.strokeStyle = 'rgba(' + DARK + ',1)';
      g.lineWidth = Math.max(1.5, r * 0.18);
      g.beginPath(); g.arc(x, y, r * 0.9, 0, TAU); g.stroke();
      g.globalAlpha = alpha * 0.85;                 // specular highlight
      g.fillStyle = CREAM;
      g.beginPath(); g.arc(x - r * 0.34, y - r * 0.36, r * 0.24, 0, TAU); g.fill();
      g.globalAlpha = alpha * 0.35;
      g.beginPath(); g.arc(x + r * 0.22, y + r * 0.28, r * 0.09, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }
    function drawGlass() {
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.strokeStyle = 'rgba(' + DARK + ',0.35)';    // lower inner shadow
      g.lineWidth = GR * 0.09;
      g.beginPath(); g.arc(cx, gcy, GR - GR * 0.05, 0.4, Math.PI - 0.4); g.stroke();
      g.strokeStyle = 'rgba(242,233,220,0.85)';     // bright rim
      g.lineWidth = Math.max(2.5, GR * 0.03);
      g.beginPath(); g.arc(cx, gcy, GR, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(242,233,220,0.55)';     // upper-left highlight
      g.lineWidth = Math.max(3, GR * 0.06);
      g.beginPath(); g.arc(cx, gcy, GR * 0.9, -2.5, -1.45); g.stroke();
      g.strokeStyle = 'rgba(242,233,220,0.3)';
      g.lineWidth = Math.max(2, GR * 0.035);
      g.beginPath(); g.arc(cx, gcy, GR * 0.8, -2.3, -1.8); g.stroke();
    }
    function drawLid() {
      const ly = gcy - GR;
      g.fillStyle = AMBER; g.strokeStyle = 'rgba(' + DARK + ',0.3)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(cx, ly + GR * 0.02, GR * 0.19, GR * 0.09, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = CORAL;
      g.beginPath(); g.arc(cx, ly - GR * 0.05, GR * 0.09, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(242,233,220,0.5)'; g.lineWidth = 2; g.stroke();
    }
    function drawBase() {
      g.beginPath();
      g.moveTo(cx - baseTopHalf, collarY);
      g.lineTo(cx + baseTopHalf, collarY);
      g.lineTo(cx + baseBotHalf, baseBot);
      g.lineTo(cx - baseBotHalf, baseBot);
      g.closePath();
      g.fillStyle = AMBER; g.fill();
      g.fillStyle = baseGrad; g.fill();
      g.lineJoin = 'round'; g.strokeStyle = 'rgba(' + DARK + ',0.4)';
      g.lineWidth = Math.max(2, GR * 0.03); g.stroke();
      // collar band holding the globe
      rr(cx - baseTopHalf * 1.04, collarY - GR * 0.12, baseTopHalf * 2.08, GR * 0.22, GR * 0.07);
      g.fillStyle = AMBER; g.fill();
      g.strokeStyle = 'rgba(' + DARK + ',0.35)'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = 'rgba(242,233,220,0.28)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx - baseTopHalf * 0.86, collarY - GR * 0.07);
      g.lineTo(cx + baseTopHalf * 0.86, collarY - GR * 0.07); g.stroke();
      // recessed chute
      const chTop = collarY + GR * 0.05;
      rr(cx - chuteHalf - 3, chTop, (chuteHalf + 3) * 2, chuteMouthY - chTop + 4, chuteHalf);
      g.fillStyle = 'rgba(' + DARK + ',0.55)'; g.fill();
      g.strokeStyle = 'rgba(' + DARK + ',0.5)'; g.lineWidth = 2; g.stroke();
      // tray well (dark interior)
      rr(cx - trayHalf, chuteMouthY - 2, trayHalf * 2, trayFloorY - chuteMouthY + GR * 0.08, GR * 0.06);
      g.fillStyle = 'rgba(' + DARK + ',0.5)'; g.fill();
    }
    function drawTrayFront() {
      rr(cx - trayHalf - GR * 0.05, trayFloorY - GR * 0.02, (trayHalf + GR * 0.05) * 2, GR * 0.15, GR * 0.05);
      g.fillStyle = AMBER; g.fill();
      g.fillStyle = 'rgba(' + DARK + ',0.16)'; g.fill();
      g.strokeStyle = 'rgba(' + DARK + ',0.35)'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = 'rgba(242,233,220,0.28)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx - trayHalf, trayFloorY + GR * 0.005);
      g.lineTo(cx + trayHalf, trayFloorY + GR * 0.005); g.stroke();
    }
    function drawCrank(t) {
      g.fillStyle = 'rgba(' + DARK + ',0.28)';
      g.beginPath(); g.arc(knobCX, knobCY, knobR * 1.24, 0, TAU); g.fill();
      g.fillStyle = CORAL;
      g.beginPath(); g.arc(knobCX, knobCY, knobR, 0, TAU); g.fill();
      g.fillStyle = 'rgba(' + DARK + ',0.18)';
      g.beginPath(); g.arc(knobCX, knobCY + knobR * 0.14, knobR * 0.92, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(242,233,220,0.5)'; g.lineWidth = Math.max(2, knobR * 0.14);
      g.beginPath(); g.arc(knobCX, knobCY, knobR, 0, TAU); g.stroke();
      const hx = knobCX + Math.cos(crankAngle) * knobR * 0.6;
      const hy = knobCY + Math.sin(crankAngle) * knobR * 0.6;
      g.strokeStyle = CREAM; g.lineWidth = Math.max(3, knobR * 0.26); g.lineCap = 'round';
      g.beginPath(); g.moveTo(knobCX, knobCY); g.lineTo(hx, hy); g.stroke();
      const pulse = grab ? 1 : 0.72 + 0.28 * Math.sin(t * 2.2);
      g.globalAlpha = pulse; g.fillStyle = CREAM;
      g.beginPath(); g.arc(hx, hy, knobR * 0.3, 0, TAU); g.fill(); g.globalAlpha = 1;
      g.fillStyle = 'rgba(' + DARK + ',0.6)';
      g.beginPath(); g.arc(knobCX, knobCY, knobR * 0.16, 0, TAU); g.fill();
    }

    // --- instance ----------------------------------------------------------
    function draw(t, dt) {
      // crank momentum after release keeps dropping balls as it spins down
      if (!grab) {
        crankVel *= Math.pow(0.25, dt);
        if (Math.abs(crankVel) < 0.04) crankVel = 0;
        const da = crankVel * dt;
        crankAngle += da; crankAccum += da; processDispense();
      }
      // trickle-refill the globe so it stays packed
      refillCd -= dt;
      if (balls.length < N_TARGET && refillCd <= 0) { spawnGlobeBall(); refillCd = 0.16 + Math.random() * 0.14; }
      // occasional nudge so a settled pile never freezes
      nudgeCd -= dt;
      if (nudgeCd <= 0) {
        if (balls.length) {
          const b = balls[(Math.random() * balls.length) | 0];
          b.vx += (Math.random() - 0.5) * GRAV * 0.08;
          b.vy -= Math.random() * GRAV * 0.05;
        }
        nudgeCd = 1.4 + Math.random() * 2.2;
      }
      // fixed-step physics (stable at any frame dt)
      physAcc += dt;
      let steps = 0;
      while (physAcc >= H && steps < 3) { substep(t); physAcc -= H; steps++; }
      if (steps >= 3) physAcc = 0;
      // fade out / cull spent tray balls
      for (let i = dispensed.length - 1; i >= 0; i--) {
        const d = dispensed[i];
        if (d.leaving) { d.alpha -= dt / 0.5; if (d.alpha <= 0) { dispensed.splice(i, 1); continue; } }
        if (!isFinite(d.x) || !isFinite(d.y)) dispensed.splice(i, 1);
      }
      if (dispenseFlash > 0) dispenseFlash = Math.max(0, dispenseFlash - dt / 0.25);

      // ---- render ----
      const w = env.w, h = env.h;
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      // globe interior
      g.beginPath(); g.arc(cx, gcy, GR, 0, TAU);
      g.fillStyle = globeGrad; g.fill();
      // gumballs, clipped inside the glass
      g.save();
      g.beginPath(); g.arc(cx, gcy, GR - 1, 0, TAU); g.clip();
      for (let i = 0; i < balls.length; i++) gum(balls[i].x, balls[i].y, inks[balls[i].ink], 1);
      g.restore();
      drawGlass();
      drawLid();
      drawBase();
      for (let i = 0; i < dispensed.length; i++) {
        const d = dispensed[i];
        gum(d.x, d.y, inks[d.ink], d.leaving ? d.alpha : 1);
      }
      drawTrayFront();
      if (dispenseFlash > 0) {
        g.globalAlpha = dispenseFlash * 0.5;
        g.strokeStyle = CREAM; g.lineWidth = 2.5;
        g.beginPath(); g.arc(cx, chuteMouthY, chuteHalf * (1.1 + (1 - dispenseFlash) * 1.1), 0, TAU); g.stroke();
        g.globalAlpha = 1;
      }
      drawCrank(t);
    }
    function down(p) {
      if (Math.hypot(p.x - knobCX, p.y - knobCY) <= knobR * 1.4) {
        grab = true; grabAng = Math.atan2(p.y - knobCY, p.x - knobCX); crankVel = 0;
      }
    }
    function move(p) {
      if (!grab) return;
      const a = Math.atan2(p.y - knobCY, p.x - knobCX);
      let da = a - grabAng;
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      grabAng = a;
      crankAngle += da; crankAccum += da;
      crankVel = crankVel * 0.6 + da * 0.4 * 60;
      processDispense();
    }
    function up() {
      if (grab) crankVel = crankVel < -MAXW ? -MAXW : crankVel > MAXW ? MAXW : crankVel;
      grab = false;
    }
    function resize() {
      const ocx = cx, ogcy = gcy, oGR = GR;
      layout();
      const s = oGR > 1e-6 ? GR / oGR : 1;
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        b.x = cx + (b.x - ocx) * s; b.y = gcy + (b.y - ogcy) * s;
        if (!isFinite(b.x) || !isFinite(b.y)) { b.x = cx; b.y = gcy; b.vx = 0; b.vy = 0; }
        confineGlobe(b);
      }
      for (let i = 0; i < dispensed.length; i++) {
        const d = dispensed[i];
        d.x = cx + (d.x - ocx) * s;
        d.x = Math.max(cx - trayHalf + br, Math.min(cx + trayHalf - br, d.x));
        d.y = Math.max(neckY, Math.min(trayFloorY - br, gcy + (d.y - ogcy) * s));
        if (!isFinite(d.x) || !isFinite(d.y)) { d.x = cx; d.y = chuteMouthY; d.vx = 0; d.vy = 0; }
      }
    }

    return { draw, down, move, up, resize };
  },
});
