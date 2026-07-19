/* № 44 — Puffer fish. A small worried fish drifting in the dark water: fins
   fluttering, tail waving, a big eye blinking now and then. Poke it — or rush
   it, or corner it against an edge while it nervously flees your pointer — and
   it STARTLES, ballooning into a spiky cream ball with a springy overshoot,
   then slowly, grumpily deflates back to its calm little self. */
F.register({
  n: 44, id: 'puffer', cat: 'critters',
  title: 'Puffer fish', hint: 'Poke it — watch it puff up with spikes',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const AMBER = inks[0], CREAM = inks[5];

    // ---- sizing (rebuilt on resize) ----
    let m = 1, baseR = 30, homeX = 0, homeY = 0, wanderAmp = 20, inited = false;

    // ---- fish state ----
    let fx = 0, fy = 0, fvx = 0, fvy = 0;         // centre + velocity
    let face = 1, faceT = 1;                       // horizontal facing, eased
    let puff = 0, puffV = 0, puffTarget = 0, puffHold = 0;
    let grump = 0, curR = 30;
    let pupilX = 0.2, pupilY = 0.2;                // eased look direction

    // ---- timers ----
    let now = 0, blinkT = -9, nextBlink = 2.4, lastStartle = -9;
    let cornerCd = 0, nextIdleBub = 3;

    // ---- pointer ----
    let px = 0, py = 0, lpx = 0, lpy = 0, pdown = false, pinside = false, pspeed = 0;

    // ---- spikes (seeded once) ----
    const NSP = 16;
    const spA = new Float32Array(NSP), spLen = new Float32Array(NSP);
    const spPh = new Float32Array(NSP), spW = new Float32Array(NSP);
    for (let i = 0; i < NSP; i++) {
      spA[i] = (i / NSP) * TAU + (Math.random() - 0.5) * 0.14;
      spLen[i] = 0.8 + Math.random() * 0.5;
      spPh[i] = Math.random() * TAU;
      spW[i] = 0.7 + Math.random() * 0.6;
    }
    // ---- freckles (seeded once) ----
    const NSPOT = 4;
    const spotA = new Float32Array(NSPOT), spotR = new Float32Array(NSPOT);
    for (let i = 0; i < NSPOT; i++) {
      spotA[i] = 0.6 + Math.random() * (Math.PI - 1.2);
      spotR[i] = 0.35 + Math.random() * 0.4;
    }

    // ---- bubbles ----
    const bubbles = [];
    function spawnBubbles(k) {
      for (let i = 0; i < k; i++) {
        if (bubbles.length > 40) bubbles.shift();
        bubbles.push({
          x: fx + face * baseR * 0.5 + (Math.random() - 0.5) * baseR * 0.6,
          y: fy - baseR * 0.25 + (Math.random() - 0.5) * baseR * 0.4,
          vy: (0.4 + Math.random() * 0.5) * m,
          r: baseR * (0.06 + Math.random() * 0.08),
          life: 1, max: 0.8 + Math.random() * 0.9,
          wob: Math.random() * TAU,
        });
      }
    }

    function startle(sx, sy) {
      if (puff > 0.45 || now < lastStartle + 0.2) return;   // refractory
      lastStartle = now;
      puffTarget = 1; puffHold = 0.7; puffV += 2.6;         // snappy overshoot
      let dx = fx - sx, dy = fy - sy;
      const d = Math.hypot(dx, dy) + 1e-6;
      if (d < 1) { dx = 0; dy = -1; }
      fvx += (dx / d) * 0.45 * m;                            // recoil away
      fvy += (dy / d) * 0.45 * m - 0.12 * m;                 // + startled hop
      spawnBubbles(6);
      nextBlink = now + 2.4 + Math.random() * 3;
    }

    function layout() {
      m = Math.min(env.w, env.h);
      baseR = 0.115 * m;
      homeX = env.w * 0.5; homeY = env.h * 0.52;
      wanderAmp = 0.10 * m;
      if (!inited) { fx = homeX; fy = homeY; inited = true; }
      fx = Math.max(baseR, Math.min(env.w - baseR, fx));
      fy = Math.max(baseR, Math.min(env.h - baseR, fy));
    }
    layout();

    return {
      draw(t, dt) {
        now = t;
        const w = env.w, h = env.h;
        pspeed = Math.hypot(px - lpx, py - lpy) / Math.max(dt, 1e-3);

        // ---- puff spring + slow deflate ----
        if (puffHold > 0) puffHold -= dt;
        else puffTarget += (0 - puffTarget) * (1 - Math.pow(0.3, dt));
        {
          const SUB = 3, hh = dt / SUB, K = 210, C = 13;
          for (let s = 0; s < SUB; s++) {
            const a = (puffTarget - puff) * K - puffV * C;
            puffV += a * hh; puff += puffV * hh;
          }
          if (puff < 0) { puff = 0; if (puffV < 0) puffV = 0; }
          if (puff > 1.6) { puff = 1.6; if (puffV > 0) puffV = 0; }
        }
        const pf = Math.min(1, puff);
        const alarm = Math.max(0, Math.min(1, puff * 1.15));
        const deflating = puffHold <= 0 && puffV < -0.05 && puff > 0.12;
        if (deflating) grump += (1 - grump) * (1 - Math.pow(0.2, dt));
        else grump += (0 - grump) * (1 - Math.pow(0.75, dt));

        // ---- body radii (squash & stretch on inflate) ----
        const breathe = 1 + 0.03 * Math.sin(t * 1.8) * (1 - pf);
        const ss = Math.max(-0.24, Math.min(0.24, puffV * 0.09));
        const RXd = Math.max(4, baseR * (1.15 + 0.78 * puff) * breathe * (1 - ss));
        const RYd = Math.max(4, baseR * (0.80 + 1.13 * puff) * breathe * (1 + ss));
        const bodyRep = (RXd + RYd) * 0.5;
        curR = Math.max(RXd, RYd);
        const spikeReach = baseR * 0.6 * Math.max(0, puff);
        const effR = Math.max(RXd, RYd) + spikeReach * 0.7 + 2;

        // ---- steering: idle drift, flee, shy hover ----
        const idleX = homeX + wanderAmp * Math.sin(t * 0.23 + 1.7) + wanderAmp * 0.5 * Math.sin(t * 0.37);
        const idleY = homeY + wanderAmp * 0.7 * Math.sin(t * 0.31 + 0.6) + baseR * 0.12 * Math.sin(t * 1.6);
        let d = 0, R = 0, fleeing = false, fleeDX = 0, fleeDY = 0;
        if (pdown) {
          const ddx = fx - px, ddy = fy - py;
          d = Math.hypot(ddx, ddy) + 1e-6;
          R = baseR * 4 + 0.15 * m;
          if (d < R) { fleeing = true; fleeDX = ddx / d; fleeDY = ddy / d; }
        }
        const kI = fleeing ? 1.2 : 6;
        let ax = (idleX - fx) * kI - fvx * 2.2;
        let ay = (idleY - fy) * kI - fvy * 2.2;
        if (fleeing) {
          const s = 1 - d / R;
          ax += fleeDX * 7 * m * s; ay += fleeDY * 7 * m * s;
        } else if (pinside && !pdown) {
          const ddx = fx - px, ddy = fy - py, dd = Math.hypot(ddx, ddy) + 1e-6;
          const RR = baseR * 2.3;
          if (dd < RR) { const s = 1 - dd / RR; ax += (ddx / dd) * 2 * m * s; ay += (ddy / dd) * 2 * m * s; }
        }
        fvx += ax * dt; fvy += ay * dt;
        const spd = Math.hypot(fvx, fvy), SPDMAX = 9 * m;
        if (spd > SPDMAX) { fvx *= SPDMAX / spd; fvy *= SPDMAX / spd; }
        fx += fvx * dt; fy += fvy * dt;

        // ---- bounds + corner puff ----
        let hitL = false, hitR = false, hitT = false, hitB = false;
        if (fx < effR) { fx = effR; if (fvx < 0) fvx *= -0.3; hitL = true; }
        if (fx > w - effR) { fx = w - effR; if (fvx > 0) fvx *= -0.3; hitR = true; }
        if (fy < effR) { fy = effR; if (fvy < 0) fvy *= -0.3; hitT = true; }
        if (fy > h - effR) { fy = h - effR; if (fvy > 0) fvy *= -0.3; hitB = true; }
        if (effR * 2 > w) fx = w * 0.5;    // card narrower than fish
        if (effR * 2 > h) fy = h * 0.5;
        if (fleeing && puff < 0.4) {
          const cornered =
            (hitL && fleeDX < -0.3) || (hitR && fleeDX > 0.3) ||
            (hitT && fleeDY < -0.3) || (hitB && fleeDY > 0.3);
          if (cornered && now > cornerCd) { cornerCd = now + 1.2; startle(px, py); }
        }

        // ---- fast-approach startle (hover) ----
        if (pinside && !pdown && puff < 0.4) {
          const dd = Math.hypot(fx - px, fy - py);
          const toward = (px - lpx) * (fx - px) + (py - lpy) * (fy - py);
          if (dd < baseR * 1.9 && pspeed > 4 * m && toward > 0) startle(px, py);
        }

        // ---- facing ----
        if (Math.abs(fvx) > 0.05 * m) faceT = fvx > 0 ? 1 : -1;
        face += (faceT - face) * (1 - Math.pow(0.02, dt));

        // ---- look / pupil ----
        let lookX, lookY;
        if (pinside || pdown) {
          const ddx = px - fx, ddy = py - fy, dd = Math.hypot(ddx, ddy) + 1e-6;
          lookX = ddx / dd; lookY = ddy / dd;
        } else {
          lookX = 0.3 * face + 0.2 * Math.sin(t * 0.6);
          lookY = 0.2 + 0.15 * Math.sin(t * 0.8 + 1.3);
        }
        pupilX += (lookX - pupilX) * (1 - Math.pow(0.02, dt));
        pupilY += (lookY - pupilY) * (1 - Math.pow(0.02, dt));

        // ---- blink ----
        if (alarm < 0.2 && t > nextBlink) { blinkT = t; nextBlink = t + 2.6 + Math.random() * 3.4; }
        const bph = (t - blinkT) / 0.16;
        const blink = (bph >= 0 && bph <= 1) ? Math.abs(2 * bph - 1) : 1;
        const eyeOpen = alarm > 0.25 ? 1 : 0.08 + 0.92 * blink;

        // ---- bubbles ----
        if (t > nextIdleBub) { nextIdleBub = t + 2.6 + Math.random() * 3.2; spawnBubbles(1); }
        for (let i = bubbles.length - 1; i >= 0; i--) {
          const b = bubbles[i];
          b.life -= dt / b.max;
          b.y -= b.vy * dt;
          b.x += Math.sin(t * 4 + b.wob) * 10 * dt;
          if (b.life <= 0 || b.y < -baseR) bubbles.splice(i, 1);
        }

        // ================= DRAW =================
        g.fillStyle = bg; g.fillRect(0, 0, w, h);

        for (let i = 0; i < bubbles.length; i++) {
          const b = bubbles[i];
          const al = Math.max(0, Math.min(1, b.life)) * 0.45;
          g.strokeStyle = `rgba(242,233,220,${al})`;
          g.lineWidth = Math.max(1, baseR * 0.03);
          g.beginPath();
          g.arc(b.x, b.y, b.r * (0.6 + 0.5 * (1 - b.life)), 0, TAU);
          g.stroke();
        }

        const tilt = 0.05 * Math.sin(t * 1.3) * (1 - pf) +
          Math.max(-0.18, Math.min(0.18, fvx * 0.0005)) * (1 - 0.7 * pf);
        const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
        const finA = 1 - 0.85 * pf;

        g.save();
        g.translate(fx, fy);
        g.rotate(tilt);
        g.lineJoin = 'round'; g.lineCap = 'round';

        // ---- tail + dorsal (behind body) ----
        if (finA > 0.02) {
          g.save();
          g.translate(-face * RXd * 0.82, 0);
          g.rotate(0.34 * Math.sin(t * 4.5 + 0.4));
          g.fillStyle = `rgba(88,166,242,${0.9 * finA})`;
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(-face * RXd * 0.72, -RYd * 0.72);
          g.lineTo(-face * RXd * 0.52, 0);
          g.lineTo(-face * RXd * 0.72, RYd * 0.72);
          g.closePath(); g.fill();
          g.restore();
          g.save();
          g.translate(-face * RXd * 0.05, -RYd * 0.82);
          g.rotate(0.18 * Math.sin(t * 4 + 2) * face);
          g.fillStyle = `rgba(88,166,242,${0.8 * finA})`;
          g.beginPath();
          g.moveTo(-face * RXd * 0.28, RYd * 0.18);
          g.lineTo(face * RXd * 0.03, -RYd * 0.5);
          g.lineTo(face * RXd * 0.3, RYd * 0.14);
          g.closePath(); g.fill();
          g.restore();
        }

        // ---- spikes (behind body, flush when calm) ----
        if (puff > 0.02) {
          g.fillStyle = CREAM;
          for (let i = 0; i < NSP; i++) {
            const a = spA[i], ca = Math.cos(a), sa = Math.sin(a);
            const denom = Math.hypot(RYd * ca, RXd * sa) + 1e-6;
            const rs = RXd * RYd / denom;
            const len = spikeReach * spLen[i] * (1 + 0.06 * Math.sin(t * 13 + spPh[i]));
            const bx = rs * 0.86 * ca, by = rs * 0.86 * sa;
            const ex = -sa * rs * 0.14 * spW[i], ey = ca * rs * 0.14 * spW[i];
            g.beginPath();
            g.moveTo(bx + ex, by + ey);
            g.lineTo((rs + len) * ca, (rs + len) * sa);
            g.lineTo(bx - ex, by - ey);
            g.closePath(); g.fill();
          }
        }

        // ---- body ----
        g.fillStyle = AMBER;
        g.beginPath(); g.ellipse(0, 0, RXd, RYd, 0, 0, TAU); g.fill();
        g.save();
        g.beginPath(); g.ellipse(0, 0, RXd, RYd, 0, 0, TAU); g.clip();
        g.fillStyle = 'rgba(242,102,91,0.5)';
        g.beginPath(); g.ellipse(0, RYd * 0.55, RXd * 1.1, RYd * 0.85, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(245,233,220,0.16)';
        g.beginPath(); g.ellipse(-face * RXd * 0.15, -RYd * 0.42, RXd * 0.6, RYd * 0.4, 0, 0, TAU); g.fill();
        const spotFade = (1 - pf) * 0.5;
        if (spotFade > 0.03) {
          g.fillStyle = `rgba(242,102,91,${0.45 * spotFade})`;
          for (let i = 0; i < NSPOT; i++) {
            const sx = Math.cos(spotA[i]) * RXd * spotR[i] * -face;
            const sy = -Math.abs(Math.sin(spotA[i])) * RYd * spotR[i] - RYd * 0.04;
            g.beginPath(); g.ellipse(sx, sy, baseR * 0.08, baseR * 0.08, 0, 0, TAU); g.fill();
          }
        }
        g.restore();
        g.lineWidth = Math.max(2, baseR * 0.05);
        g.strokeStyle = 'rgba(20,16,13,0.22)';
        g.beginPath(); g.ellipse(0, 0, RXd, RYd, 0, 0, TAU); g.stroke();

        // ---- pectoral fin (front) ----
        if (finA > 0.02) {
          g.save();
          g.translate(face * RXd * 0.2, RYd * 0.34);
          g.rotate(0.5 * Math.sin(t * 7 + 1) * face);
          g.fillStyle = `rgba(88,166,242,${0.85 * finA})`;
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(face * RXd * 0.5, RYd * 0.42);
          g.lineTo(face * RXd * 0.04, RYd * 0.6);
          g.closePath(); g.fill();
          g.restore();
        }
        g.restore();

        // ================= FACE (world) =================
        const eyeLX = face * RXd * 0.4, eyeLY = -RYd * 0.34;
        const wex = fx + eyeLX * cosT - eyeLY * sinT;
        const wey = fy + eyeLX * sinT + eyeLY * cosT;
        const er = bodyRep * 0.36;
        const ery = er * eyeOpen;

        // brow: worried when alarmed, angry when deflating, gentle when calm
        const browY0 = wey - ery * 0.9 - er * 0.35;
        const bt = grump * er * 0.6 - alarm * er * 0.45;
        const inX = wex + face * er * 0.85, inY = browY0 + bt;
        const outX = wex - face * er * 0.55, outY = browY0 - bt * 0.4;
        g.strokeStyle = 'rgba(20,16,13,0.85)';
        g.lineWidth = Math.max(2.5, baseR * 0.12); g.lineCap = 'round';
        g.beginPath();
        g.moveTo(inX, inY);
        g.quadraticCurveTo((inX + outX) * 0.5, (inY + outY) * 0.5 - er * 0.18, outX, outY);
        g.stroke();

        // eye
        g.save();
        g.translate(wex, wey);
        g.fillStyle = CREAM;
        g.beginPath(); g.ellipse(0, 0, er, ery, 0, 0, TAU); g.fill();
        g.lineWidth = Math.max(1.5, baseR * 0.035);
        g.strokeStyle = 'rgba(20,16,13,0.4)';
        g.stroke();
        if (eyeOpen > 0.3) {
          const pr = er * (0.55 - 0.2 * alarm);
          const offAmt = (er - pr) * 0.65 * (1 - 0.65 * alarm);
          let ox = pupilX, oy = pupilY;
          const ol = Math.hypot(ox, oy);
          if (ol > 1) { ox /= ol; oy /= ol; }
          const pxo = ox * offAmt;
          const lim = Math.max(0, ery - pr);
          const pyo = Math.max(-lim, Math.min(lim, oy * offAmt));
          g.fillStyle = bg;
          g.beginPath(); g.ellipse(pxo, pyo, pr, Math.min(pr, ery * 0.95), 0, 0, TAU); g.fill();
          g.fillStyle = CREAM;
          g.beginPath(); g.ellipse(pxo - pr * 0.35, pyo - pr * 0.4, pr * 0.3, pr * 0.3, 0, 0, TAU); g.fill();
        }
        g.restore();

        // cheek blush when content
        const blush = (1 - alarm) * (1 - grump);
        if (blush > 0.08) {
          g.fillStyle = `rgba(242,102,91,${0.35 * blush})`;
          g.beginPath(); g.ellipse(wex + face * er * 0.1, wey + er * 0.9, er * 0.42, er * 0.28, 0, 0, TAU); g.fill();
        }

        // mouth: shocked O, grumpy frown, or calm smile
        const mLX = face * RXd * 0.5, mLY = RYd * 0.44;
        const wmx = fx + mLX * cosT - mLY * sinT;
        const wmy = fy + mLX * sinT + mLY * cosT;
        const msz = baseR * 0.5;
        g.save(); g.translate(wmx, wmy);
        if (alarm > 0.4) {
          g.fillStyle = bg;
          g.beginPath(); g.ellipse(0, 0, msz * 0.42 * alarm, msz * 0.52 * alarm, 0, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(242,102,91,0.7)'; g.lineWidth = Math.max(1.5, baseR * 0.05); g.stroke();
        } else if (grump > 0.35) {
          g.strokeStyle = 'rgba(20,16,13,0.8)'; g.lineWidth = Math.max(2, baseR * 0.09);
          g.beginPath(); g.arc(0, msz * 0.5, msz * 0.6, TAU * 0.62, TAU * 0.88); g.stroke();
        } else {
          g.strokeStyle = 'rgba(20,16,13,0.75)'; g.lineWidth = Math.max(2, baseR * 0.08);
          g.beginPath(); g.arc(0, -msz * 0.3, msz * 0.5, TAU * 0.12, TAU * 0.38); g.stroke();
        }
        g.restore();

        lpx = px; lpy = py;
      },
      down(p) {
        pdown = true; pinside = true; px = p.x; py = p.y;
        if (Math.hypot(p.x - fx, p.y - fy) < curR * 1.2) startle(p.x, p.y);
      },
      move(p) {
        px = p.x; py = p.y; pinside = true; pdown = p.held;
      },
      up(p) {
        if (p) { px = p.x; py = p.y; }
        pdown = false;
      },
      leave() {
        pinside = false; pdown = false;
      },
      resize() { layout(); },
    };
  },
});
