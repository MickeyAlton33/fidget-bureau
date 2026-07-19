/* № 40 — Whack-a-mole. A 3×3 board of dirt holes with raised cream lips. Amber
   moles spring up on their own, linger a beat, then duck back down — bonk a
   raised one with the mallet that tracks your pointer and it squashes flat, sees
   spinning stars, and drops home. Miss, and the mallet just whiffs the dirt.
   Everything is springs and squash & stretch; the board keeps its own tally. */
F.register({
  n: 40, id: 'whack-mole', cat: 'chaos',
  title: 'Whack-a-mole', hint: 'Bonk the moles as they pop up',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const AMBER = inks[0], CORAL = inks[1], SKY = inks[3], CREAM = inks[5];
    const PIT = 'rgba(8,6,4,0.72)';     // hole shadow — a darkening of the ground
    const DIRT = 'rgba(8,6,4,0.5)';
    const DARK = 'rgba(20,16,13,';      // outline ink (ground) — append "a)"
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

    const N = 9;
    const holes = [];
    for (let i = 0; i < N; i++) {
      holes.push({
        target: 0, pop: 0, pv: 0,   // emerge: target 0/1, position (spring), velocity
        linger: 0,                  // seconds left showing before it ducks on its own
        bonk: 0,                    // 1 at the moment of a bonk → decays to 0 (also the daze)
        flash: 0,                   // expanding hit-ring
        spin: Math.random() * TAU,  // star / idle-sway phase
        blink: 2 + Math.random() * 4,
      });
    }
    let spawnTimer = 0.3, score = 0;

    // mallet — eased pointer follow, springy swing, drifts to an idle home when the
    // pointer leaves so the card never goes dead.
    let tx = env.w * 0.84, ty = env.h * 0.86;
    let hx = tx, hy = ty, swing = 0, swingV = 0, homing = true;

    function metrics() {
      const w = env.w, h = env.h, m = Math.min(w, h);
      const rx = m * 0.12, ry = rx * 0.52;
      return {
        w, h, m, rx, ry,
        Rox: rx * 1.3, Roy: ry * 1.34,     // raised outer lip
        br: rx * 0.82,                     // mole body radius
      };
    }
    const hX = (M, i) => M.w * (0.2 + 0.3 * (i % 3));
    const hY = (M, i) => M.h * (0.2 + 0.3 * ((i / 3) | 0));
    function moleY(M, o, i) {
      const pe = clamp(o.pop, -0.15, 1.2);
      const y = hY(M, i);
      const base = y + M.br * 1.85;        // fully down: hidden below the front lip
      const top = y - M.br * 0.45;         // fully up: poking well above the rim
      return base + (top - base) * pe;
    }

    function spawn() {
      let pick = -1, seen = 0;
      for (let i = 0; i < N; i++) {         // reservoir-pick a random idle hole
        const o = holes[i];
        if (o.target === 0 && o.pop < 0.2 && o.bonk <= 0) { seen++; if (Math.random() < 1 / seen) pick = i; }
      }
      if (pick < 0) return;
      const o = holes[pick];
      o.target = 1;
      o.linger = 0.75 + Math.random() * 1.0;
      o.pv = 5.5 + Math.random() * 3;       // launch kick for a springy emerge
    }
    // pre-pop two so the board is alive on the very first frame
    holes[4].target = 1; holes[4].linger = 1.5; holes[4].pop = 0.15; holes[4].pv = 6;
    holes[7].target = 1; holes[7].linger = 2.2; holes[7].pop = 0.05; holes[7].pv = 5;

    function hit(px, py) {
      const M = metrics();
      let best = -1, bd = 1e9;
      for (let i = 0; i < N; i++) {
        const o = holes[i];
        if (o.bonk > 0 || clamp(o.pop, -0.15, 1.2) < 0.45) continue;  // only a raised mole
        const dx = px - hX(M, i), dy = py - moleY(M, o, i);
        const d = dx * dx + dy * dy, r = M.br * 1.45;
        if (d < r * r && d < bd) { bd = d; best = i; }
      }
      return best;
    }

    function rr(x, y, w, h, r) {
      r = Math.min(r, w * 0.5, h * 0.5);
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    }
    function sparkle(x, y, r, rot, col, a) {
      g.save();
      g.translate(x, y); g.rotate(rot);
      g.globalAlpha = clamp(a, 0, 1);
      g.fillStyle = col;
      g.beginPath();
      for (let k = 0; k < 4; k++) {
        const o = k * Math.PI / 2, o2 = o + Math.PI / 4;
        g.lineTo(Math.cos(o) * r, Math.sin(o) * r);
        g.lineTo(Math.cos(o2) * r * 0.38, Math.sin(o2) * r * 0.38);
      }
      g.closePath(); g.fill();
      g.globalAlpha = 1;
      g.restore();
    }

    // pit + the far (back) half of the raised cream lip — drawn behind the mole
    function pitBack(M, i) {
      const x = hX(M, i), y = hY(M, i);
      g.fillStyle = PIT;
      g.beginPath(); g.ellipse(x, y, M.rx, M.ry, 0, 0, TAU); g.fill();
      g.fillStyle = DIRT;
      g.beginPath(); g.ellipse(x, y + M.ry * 0.3, M.rx * 0.8, M.ry * 0.55, 0, 0, TAU); g.fill();
      g.save();
      g.beginPath(); g.rect(x - M.Rox - 2, y - M.Roy - 2, (M.Rox + 2) * 2, M.Roy + 2); g.clip();
      g.beginPath();
      g.ellipse(x, y, M.Rox, M.Roy, 0, 0, TAU);
      g.ellipse(x, y, M.rx, M.ry, 0, 0, TAU);
      g.fillStyle = 'rgba(242,233,220,0.5)';
      g.fill('evenodd');
      g.restore();
    }

    // near (front) half of the lip — drawn over the mole's base to seat it in the hole
    function lipFront(M, i) {
      const x = hX(M, i), y = hY(M, i);
      g.save();
      g.beginPath(); g.rect(x - M.Rox - 2, y, (M.Rox + 2) * 2, M.Roy + 3); g.clip();
      g.beginPath();
      g.ellipse(x, y, M.Rox, M.Roy, 0, 0, TAU);
      g.ellipse(x, y, M.rx, M.ry, 0, 0, TAU);
      g.fillStyle = CREAM;
      g.fill('evenodd');
      g.restore();
      g.strokeStyle = DARK + '0.26)';
      g.lineWidth = Math.max(1.5, M.rx * 0.06);
      g.beginPath(); g.ellipse(x, y, M.rx, M.ry, 0, Math.PI * 0.1, Math.PI * 0.9); g.stroke();
    }

    function drawMole(M, o, cx, my) {
      const R = M.br;
      const st = clamp(o.pv * 0.016, -0.32, 0.42);         // stretch tall while shooting up
      let sx = 1 - st * 0.5 + o.bonk * 0.85;               // flatten wide on a bonk
      let sy = 1 + st - o.bonk * 0.66;
      sx = clamp(sx, 0.55, 1.95); sy = clamp(sy, 0.28, 1.5);
      const dazed = o.bonk > 0.05, blink = o.blink < 0 && !dazed;
      g.save();
      g.translate(cx + Math.sin(o.spin * 0.5) * R * 0.05 * clamp(o.pop, 0, 1), my);
      g.scale(sx, sy);
      // ears (behind body)
      g.fillStyle = AMBER;
      g.beginPath(); g.ellipse(-R * 0.56, -R * 0.98, R * 0.31, R * 0.33, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(R * 0.56, -R * 0.98, R * 0.31, R * 0.33, 0, 0, TAU); g.fill();
      // body
      g.fillStyle = AMBER;
      g.beginPath(); g.ellipse(0, 0, R, R * 1.06, 0, 0, TAU); g.fill();
      g.lineWidth = Math.max(2, R * 0.09); g.strokeStyle = DARK + '0.4)'; g.stroke();
      // inner-ear coral on the poking tips
      g.fillStyle = 'rgba(242,102,91,0.6)';
      g.beginPath(); g.ellipse(-R * 0.56, -R * 1.1, R * 0.13, R * 0.14, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(R * 0.56, -R * 1.1, R * 0.13, R * 0.14, 0, 0, TAU); g.fill();
      // cream muzzle
      g.fillStyle = 'rgba(242,233,220,0.94)';
      g.beginPath(); g.ellipse(0, R * 0.3, R * 0.6, R * 0.62, 0, 0, TAU); g.fill();
      // cheeks
      g.fillStyle = 'rgba(242,102,91,0.4)';
      g.beginPath(); g.ellipse(-R * 0.52, R * 0.12, R * 0.19, R * 0.14, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(R * 0.52, R * 0.12, R * 0.19, R * 0.14, 0, 0, TAU); g.fill();
      // eyes
      const ex = R * 0.32, ey = -R * 0.14;
      if (dazed) {
        g.strokeStyle = DARK + '0.85)'; g.lineWidth = Math.max(2, R * 0.1); g.lineCap = 'round';
        for (let s = -1; s <= 1; s += 2) {
          g.beginPath();
          g.moveTo(s * ex - R * 0.12, ey - R * 0.12); g.lineTo(s * ex + R * 0.12, ey + R * 0.12);
          g.moveTo(s * ex + R * 0.12, ey - R * 0.12); g.lineTo(s * ex - R * 0.12, ey + R * 0.12);
          g.stroke();
        }
      } else if (blink) {
        g.strokeStyle = DARK + '0.85)'; g.lineWidth = Math.max(2, R * 0.09); g.lineCap = 'round';
        for (let s = -1; s <= 1; s += 2) {
          g.beginPath(); g.moveTo(s * ex - R * 0.13, ey); g.lineTo(s * ex + R * 0.13, ey); g.stroke();
        }
      } else {
        g.fillStyle = DARK + '0.9)';
        g.beginPath(); g.ellipse(-ex, ey, R * 0.14, R * 0.17, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(ex, ey, R * 0.14, R * 0.17, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(242,233,220,0.9)';
        g.beginPath(); g.arc(-ex + R * 0.05, ey - R * 0.06, R * 0.045, 0, TAU); g.fill();
        g.beginPath(); g.arc(ex + R * 0.05, ey - R * 0.06, R * 0.045, 0, TAU); g.fill();
      }
      // nose
      g.fillStyle = CORAL;
      g.beginPath(); g.ellipse(0, R * 0.16, R * 0.19, R * 0.15, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(242,233,220,0.7)';
      g.beginPath(); g.arc(-R * 0.06, R * 0.11, R * 0.05, 0, TAU); g.fill();
      // mouth
      g.strokeStyle = DARK + '0.55)'; g.lineWidth = Math.max(1.5, R * 0.055); g.lineCap = 'round';
      if (dazed) {
        g.beginPath(); g.ellipse(0, R * 0.46, R * 0.11, R * 0.12, 0, 0, TAU); g.stroke();
      } else {
        g.beginPath(); g.arc(0, R * 0.32, R * 0.16, 0.18 * Math.PI, 0.82 * Math.PI); g.stroke();
      }
      // whiskers
      g.strokeStyle = 'rgba(242,233,220,0.4)'; g.lineWidth = Math.max(1.5, R * 0.04);
      for (let s = -1; s <= 1; s += 2) {
        g.beginPath();
        g.moveTo(s * R * 0.18, R * 0.18); g.lineTo(s * R * 0.6, R * 0.1);
        g.moveTo(s * R * 0.18, R * 0.24); g.lineTo(s * R * 0.62, R * 0.28);
        g.stroke();
      }
      g.restore();
    }

    function drawHammer(M, t) {
      const m = M.m;
      const dx = m * 0.13, dy = m * 0.17;
      const px = hx - dx, py = hy - dy;          // hand pivot, up-left of the cursor
      const HL = Math.hypot(dx, dy);              // head reaches the cursor at full strike
      const phiS = Math.atan2(dy, dx);
      const bob = homing ? Math.sin(t * 2.4) * 0.06 : 0;
      const phi = (phiS - 0.8) + swing * 0.8 + bob;   // cocked back at rest → swung down struck
      const th = m * 0.1, ln = m * 0.19, hw = m * 0.05;
      g.save();
      g.translate(px, py);
      g.rotate(phi);
      g.lineCap = 'round';
      g.strokeStyle = SKY; g.lineWidth = hw;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(HL * 0.92, 0); g.stroke();
      g.strokeStyle = AMBER; g.lineWidth = hw * 0.86;      // grip wrap near the hand
      g.beginPath(); g.moveTo(hw * 0.5, 0); g.lineTo(HL * 0.34, 0); g.stroke();
      g.fillStyle = SKY; g.beginPath(); g.arc(0, 0, hw * 0.6, 0, TAU); g.fill();
      g.translate(HL, 0);                                   // the mallet head
      g.fillStyle = CREAM; rr(-th / 2, -ln / 2, th, ln, th * 0.36); g.fill();
      g.fillStyle = 'rgba(245,165,36,0.85)'; rr(th * 0.14, -ln / 2, th * 0.36, ln, th * 0.16); g.fill();
      g.strokeStyle = DARK + '0.34)'; g.lineWidth = Math.max(1.5, m * 0.006);
      rr(-th / 2, -ln / 2, th, ln, th * 0.36); g.stroke();
      g.restore();
    }

    return {
      draw(t, dt) {
        const M = metrics();

        // mallet: eased follow + swing spring
        const kf = Math.min(1, dt * 20);
        hx += (tx - hx) * kf; hy += (ty - hy) * kf;
        swingV += (-swing * 240 - swingV * 16) * dt;
        swingV = clamp(swingV, -60, 60);
        swing = clamp(swing + swingV * dt, -0.5, 1.7);

        // scheduler: keep the board popping, capped so it stays whack-able
        let up = 0;
        for (let i = 0; i < N; i++) if (holes[i].target === 1) up++;
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          if (up < 3) spawn();
          spawnTimer = 0.45 + Math.random() * 0.85;
        }

        // advance each mole
        for (let i = 0; i < N; i++) {
          const o = holes[i];
          if (o.bonk > 0) o.bonk = Math.max(0, o.bonk - dt / 0.55);
          if (o.target === 1 && o.pop > 0.6) { o.linger -= dt; if (o.linger <= 0) o.target = 0; }
          const acc = (o.target - o.pop) * 205 - o.pv * 15;   // springy pop / duck
          o.pv = clamp(o.pv + acc * dt, -32, 32);
          o.pop = clamp(o.pop + o.pv * dt, -0.3, 1.2);
          o.spin += dt * 7;
          o.blink -= dt; if (o.blink < -0.13) o.blink = 2.4 + Math.random() * 3.6;
          if (o.flash > 0) o.flash -= dt / 0.24;
        }

        // ---- paint, back to front ----
        g.fillStyle = bg; g.fillRect(0, 0, M.w, M.h);
        g.lineJoin = 'round'; g.lineCap = 'round';

        for (let i = 0; i < N; i++) pitBack(M, i);

        // moles, each clipped to (its column above the hole ∪ the hole opening) so a
        // squashed bonk can never spill onto the dirt or a neighbour
        for (let i = 0; i < N; i++) {
          const o = holes[i];
          if (o.pop < 0.02 && o.bonk <= 0) continue;
          const x = hX(M, i), y = hY(M, i);
          g.save();
          g.beginPath();
          g.rect(x - M.rx * 1.22, y - M.br * 3, M.rx * 2.44, M.br * 3);
          g.ellipse(x, y, M.rx * 0.99, M.ry * 0.99, 0, 0, TAU);
          g.clip();
          drawMole(M, o, x, moleY(M, o, i));
          g.restore();
        }

        for (let i = 0; i < N; i++) lipFront(M, i);

        // flashes + dazed stars, on top and unclipped so they read cleanly
        for (let i = 0; i < N; i++) {
          const o = holes[i];
          const x = hX(M, i), y = hY(M, i);
          if (o.flash > 0) {
            const f = clamp(o.flash, 0, 1);
            g.strokeStyle = 'rgba(242,233,220,' + (f * 0.8).toFixed(3) + ')';
            g.lineWidth = 1.5 + 4 * f;
            g.beginPath(); g.arc(x, y - M.br * 0.5, M.br * (0.5 + (1 - f) * 1.5), 0, TAU); g.stroke();
          }
          if (o.bonk > 0.06) {
            const a = o.bonk, cyS = y - M.br * 0.8, orb = M.br * 0.95;
            for (let s = 0; s < 3; s++) {
              const ang = o.spin + s * TAU / 3;
              sparkle(x + Math.cos(ang) * orb, cyS + Math.sin(ang) * orb * 0.5,
                      M.br * 0.24 * (0.6 + 0.4 * a), o.spin * 1.6 + s, s === 1 ? CREAM : AMBER, 0.5 + 0.5 * a);
            }
          }
        }

        // tally + mallet on top
        const pad = Math.max(8, M.m * 0.05);
        sparkle(pad + M.m * 0.018, pad + M.m * 0.02, M.m * 0.022, -0.3, AMBER, 0.9);
        g.fillStyle = 'rgba(242,233,220,0.85)';
        g.font = '700 ' + Math.max(12, Math.round(M.m * 0.055)) + 'px ui-monospace, Menlo, monospace';
        g.textBaseline = 'middle'; g.textAlign = 'left';
        g.fillText(String(score), pad + M.m * 0.05, pad + M.m * 0.02);

        drawHammer(M, t);
      },
      down(p) {
        tx = p.x; ty = p.y; homing = false;
        const i = hit(p.x, p.y);
        if (i >= 0) {
          const o = holes[i];
          o.bonk = 1; o.target = 0; o.linger = 0; o.pv = -7;  // squash flat & slam it home
          o.spin = Math.random() * TAU; o.flash = 1;
          score++;
          swingV = 22;                                        // a hard whack
        } else {
          swingV = 14;                                        // a whiff
        }
      },
      move(p) { tx = p.x; ty = p.y; homing = false; },
      leave() { homing = true; tx = env.w * 0.84; ty = env.h * 0.86; },
    };
  },
});
