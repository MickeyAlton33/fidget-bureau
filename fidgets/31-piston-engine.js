/* № 31 — Piston engine. An inline-triple in cross-section: three pistons ride a
   common crankshaft, each conrod solved in closed form from slider-crank geometry
   (piston height = crank throw minus the rod's foreshortening). It idles on a
   little motor; grab the crank and whirl it in a circle to rev, flick to throw
   momentum, then it coasts down on friction. Wound out, the cylinders spit fire
   at top-dead-centre. Crankshaft amber, pistons sky, conrods cream. */
F.register({
  n: 31, id: 'piston-engine', cat: 'mech',
  title: 'Piston engine', hint: 'Crank it to rev — pistons pump',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2, HALF = Math.PI / 2;
    const AMBER = inks[0], CORAL = inks[1], SKY = inks[3], CREAM = inks[5];
    const DARK = 'rgba(20,16,13,0.55)';   // a shade of bg, for machined grooves
    const NCYL = 3;
    const PHASE = [0, TAU / 3, 2 * TAU / 3]; // 120° crank spacing (inline-triple)
    const MOTOR = 1.5;      // idle angular velocity (rad/s)
    const FRIC = 0.55;      // coast-down toward idle (heavy-flywheel feel)
    const MAXW = 34;        // angular velocity clamp
    const FIRE_SPD = 5.5;   // crank speed above which cylinders fire at TDC

    let theta = 0, vel = MOTOR, lastTheta = 0, spd = 0;
    let grab = null, flick = 0, grabR = 0;

    // geometry — rebuilt from env.w/env.h every frame so a resize can't strand it
    let S = 1, R = 20, L = 70, bore = 40, pistH = 30, headY = 0, boreBot = 0;
    let blkX = 0, blkY = 0, blkW = 0, blkH = 0, cyA = 0;
    const cxs = new Float64Array(NCYL);
    // per-frame kinematics (allocated once)
    const PX = new Float64Array(NCYL), PY = new Float64Array(NCYL), WY = new Float64Array(NCYL);
    // combustion bursts + top-dead-centre bookkeeping
    const fires = [];
    const tdcFloor = new Int32Array(NCYL);

    function layout() {
      const w = env.w, h = env.h, m = Math.min(w, h);
      S = m / 300;
      cyA = h * 0.70;                         // crankshaft axis height
      R = 0.085 * m;                          // crank throw radius
      L = 0.30 * m;                           // conrod length (> R, keeps sqrt real)
      const span = Math.min(0.27 * w, 0.40 * m);
      const cx = w / 2;
      cxs[0] = cx - span; cxs[1] = cx; cxs[2] = cx + span;
      bore = Math.min(span * 0.86, 0.30 * m);
      pistH = 1.30 * R;
      const tdcCrown = cyA - R - L - pistH * 0.5;
      headY = tdcCrown - 0.05 * m;            // cylinder-head inner face
      boreBot = cyA - 0.02 * m;
      const pad = 0.05 * m;
      blkX = cxs[0] - bore * 0.5 - pad;
      blkY = headY - 0.055 * m;
      blkW = (cxs[2] + bore * 0.5 + pad) - blkX;
      blkH = (cyA + R + 0.12 * m) - blkY;
    }
    layout();

    function rr(x, y, w, h, r) {              // rounded-rect path (roundRect-free)
      r = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    }

    return {
      draw(t, dt) {
        layout();
        const w = env.w, h = env.h;

        // advance the crank: motor + friction when free, hand drives it when held
        if (!grab) {
          vel = MOTOR + (vel - MOTOR) * Math.pow(FRIC, dt);
          theta += vel * dt;
        }
        // instantaneous crank speed covers both coasting and hand-cranking
        const omega = (theta - lastTheta) / Math.max(dt, 1e-6);
        lastTheta = theta;
        const os = Math.min(Math.abs(omega), MAXW);
        if (os > spd) spd = os;               // fast attack
        else spd += (os - spd) * (1 - Math.pow(0.15, dt)); // slow release

        // fire a cylinder each time it sweeps through top-dead-centre while revving
        for (let i = 0; i < NCYL; i++) {
          const fl = Math.floor((theta + PHASE[i] - HALF) / TAU);
          if (fl !== tdcFloor[i]) {
            tdcFloor[i] = fl;
            if (spd > FIRE_SPD && fires.length < 14) {
              const str = 0.3 + 0.7 * Math.min(1, (spd - FIRE_SPD) / 16);
              const life = 0.15 + 0.07 * str;
              fires.push({
                i, life, max: life, str,
                jx: (Math.random() - 0.5) * 0.5, sc: 0.85 + Math.random() * 0.3,
              });
            }
          }
        }

        // per-cylinder slider-crank solve
        for (let i = 0; i < NCYL; i++) {
          const a = theta + PHASE[i], ca = Math.cos(a), sa = Math.sin(a);
          PX[i] = cxs[i] + R * ca;
          PY[i] = cyA - R * sa;
          WY[i] = PY[i] - Math.sqrt(Math.max(0, L * L - R * R * ca * ca));
        }

        // ---------- paint ----------
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.lineJoin = 'round'; g.lineCap = 'round';

        // faint engine block + cylinder bores
        g.strokeStyle = CREAM; g.globalAlpha = 0.16;
        g.lineWidth = Math.max(2, 3 * S);
        rr(blkX, blkY, blkW, blkH, 12 * S); g.stroke();
        g.globalAlpha = 0.13; g.lineWidth = Math.max(1.5, 2.4 * S);
        for (let i = 0; i < NCYL; i++) {
          rr(cxs[i] - bore * 0.5, headY, bore, boreBot - headY, 6 * S); g.stroke();
        }
        // spark plugs at each head
        g.globalAlpha = 0.6; g.strokeStyle = AMBER; g.lineWidth = Math.max(2, 2.6 * S);
        g.beginPath();
        for (let i = 0; i < NCYL; i++) { g.moveTo(cxs[i], headY - 5 * S); g.lineTo(cxs[i], headY + 3 * S); }
        g.stroke();
        g.globalAlpha = 1;

        // main crankshaft axis (behind everything)
        g.strokeStyle = AMBER; g.globalAlpha = 0.4; g.lineWidth = Math.max(3, 4.5 * S);
        g.beginPath(); g.moveTo(cxs[0], cyA); g.lineTo(cxs[NCYL - 1], cyA); g.stroke();

        // rotating counterweights, opposite each crank pin
        g.fillStyle = AMBER; g.globalAlpha = 0.5;
        for (let i = 0; i < NCYL; i++) {
          const a = theta + PHASE[i];
          const cwx = cxs[i] - 0.72 * R * Math.cos(a), cwy = cyA + 0.72 * R * Math.sin(a);
          g.beginPath(); g.arc(cwx, cwy, R * 0.6, 0, TAU); g.fill();
        }
        g.globalAlpha = 1;

        // crank webs (throw arms), journal -> pin
        g.strokeStyle = AMBER; g.lineWidth = Math.max(4, 6 * S);
        g.beginPath();
        for (let i = 0; i < NCYL; i++) { g.moveTo(cxs[i], cyA); g.lineTo(PX[i], PY[i]); }
        g.stroke();

        // conrods (cream) with a big-end ring at each crank pin
        g.strokeStyle = CREAM; g.lineWidth = Math.max(3.5, 5 * S);
        g.beginPath();
        for (let i = 0; i < NCYL; i++) { g.moveTo(PX[i], PY[i]); g.lineTo(cxs[i], WY[i]); }
        g.stroke();
        const bigR = Math.max(3, R * 0.28);
        g.lineWidth = Math.max(2, 2.6 * S);
        for (let i = 0; i < NCYL; i++) {
          g.fillStyle = bg; g.beginPath(); g.arc(PX[i], PY[i], bigR, 0, TAU); g.fill();
          g.strokeStyle = CREAM; g.beginPath(); g.arc(PX[i], PY[i], bigR, 0, TAU); g.stroke();
        }

        // pistons (sky) — chunky rounded slugs sliding in the bores
        const pw = bore * 0.82, pinR = Math.max(2.5, R * 0.2);
        for (let i = 0; i < NCYL; i++) {
          const x = cxs[i] - pw * 0.5, y = WY[i] - pistH * 0.5;
          g.fillStyle = SKY; rr(x, y, pw, pistH, Math.min(6 * S, pw * 0.28)); g.fill();
          // compression rings
          g.strokeStyle = DARK; g.lineWidth = Math.max(1.5, 2 * S);
          g.beginPath();
          g.moveTo(x + 4 * S, y + pistH * 0.30); g.lineTo(x + pw - 4 * S, y + pistH * 0.30);
          g.moveTo(x + 4 * S, y + pistH * 0.46); g.lineTo(x + pw - 4 * S, y + pistH * 0.46);
          g.stroke();
          // crown highlight
          g.strokeStyle = CREAM; g.globalAlpha = 0.28;
          g.beginPath();
          g.moveTo(x + 5 * S, y + pistH * 0.14); g.lineTo(x + pw - 5 * S, y + pistH * 0.14);
          g.stroke(); g.globalAlpha = 1;
          // wrist pin
          g.fillStyle = bg; g.beginPath(); g.arc(cxs[i], WY[i], pinR, 0, TAU); g.fill();
          g.strokeStyle = SKY; g.lineWidth = Math.max(1.5, 2 * S);
          g.beginPath(); g.arc(cxs[i], WY[i], pinR, 0, TAU); g.stroke();
        }

        // amber journals on top: crank pins + main bearings
        g.fillStyle = AMBER;
        for (let i = 0; i < NCYL; i++) {
          g.beginPath(); g.arc(PX[i], PY[i], Math.max(2.5, R * 0.16), 0, TAU); g.fill();
          g.beginPath(); g.arc(cxs[i], cyA, Math.max(3, R * 0.22), 0, TAU); g.fill();
        }

        // combustion flashes at the chamber tops
        for (let k = fires.length - 1; k >= 0; k--) {
          const f = fires[k];
          f.life -= dt;
          if (f.life <= 0) { fires.splice(k, 1); continue; }
          const u = f.life / f.max;                 // 1 -> 0
          const gx = cxs[f.i] + f.jx * bore * 0.2, gy = headY + bore * 0.12;
          const rad = bore * 0.42 * f.str * f.sc * (0.7 + (1 - u) * 0.9);
          g.fillStyle = CORAL; g.globalAlpha = 0.4 * u * f.str;
          g.beginPath(); g.arc(gx, gy, rad * 1.7, 0, TAU); g.fill();
          g.globalAlpha = 0.6 * u;
          g.beginPath(); g.arc(gx, gy, rad, 0, TAU); g.fill();
          g.fillStyle = AMBER; g.globalAlpha = 0.75 * u;
          g.beginPath(); g.arc(gx, gy, rad * 0.58, 0, TAU); g.fill();
          g.fillStyle = CREAM; g.globalAlpha = 0.9 * u;
          g.beginPath(); g.arc(gx, gy, rad * 0.28, 0, TAU); g.fill();
        }
        g.globalAlpha = 1;

        // faint ring showing the circle you're cranking around
        if (grab) {
          g.strokeStyle = CREAM; g.globalAlpha = 0.2; g.lineWidth = Math.max(2, 2.5 * S);
          g.beginPath();
          g.arc(cxs[1], cyA, Math.min(grabR, Math.max(w, h)), 0, TAU); g.stroke();
          g.globalAlpha = 1;
        }
      },
      down(p) {
        layout();
        const dx = p.x - cxs[1], dy = p.y - cyA;
        grab = { a0: Math.atan2(dy, dx) };
        grabR = Math.hypot(dx, dy);
        flick = 0;
      },
      move(p) {
        if (!grab) return;
        const a = Math.atan2(p.y - cyA, p.x - cxs[1]);
        let da = a - grab.a0;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        if (da > 1.5) da = 1.5; else if (da < -1.5) da = -1.5; // cap a single step
        grab.a0 = a;
        grabR = Math.hypot(p.x - cxs[1], p.y - cyA);
        theta += da;
        flick = flick * 0.6 + da * 0.4 * 60;
      },
      up() {
        if (grab) vel = Math.max(-MAXW, Math.min(MAXW, flick));
        grab = null;
      },
      resize() { layout(); },
    };
  },
});
