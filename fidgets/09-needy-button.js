/* № 09 — The needy button. A glossy keycap that leans and stretches toward
   your pointer, trembling harder the closer you hover. Press it and it beams
   gratitude sparks — then wants MORE. Ignore it for ten seconds and it slumps,
   fades, and does sad little hops for attention. */
F.register({
  n: 9, id: 'needy-button', cat: 'chaos',
  title: 'The needy button', hint: 'It just wants to be pressed. You know what to do',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const AMBER = inks[0], CREAM = inks[5];
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    // spring states {x, v}
    const lean = { x: 0, v: 0 }, leanY = { x: 0, v: 0 };
    const skew = { x: 0, v: 0 }, prs = { x: 0, v: 0 }, gsc = { x: 1, v: 0 };
    let clicks = 0, pressed = false, anticT = 0, fired = false, flash = 0;
    let px = 0, py = 0, hasPtr = false, lastAct = 0, tNow = 0;
    let slump = 0, lastHop = -99, hopY = 0, hopV = 0;
    const sparks = [];

    function spring(s, tgt, k, c, dt) {
      s.v += (tgt - s.x) * k * dt;
      s.v = clamp(s.v * Math.exp(-c * dt), -4000, 4000);
      s.x += s.v * dt;
      if (!isFinite(s.x + s.v)) { s.x = tgt; s.v = 0; }
    }
    function rr(x, y, w, h, r) {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    }
    function geom() {
      const m = Math.min(env.w, env.h);
      const bw = 0.54 * m * gsc.x, bh = 0.30 * m * gsc.x;
      return { m, bw, bh, r: bh * 0.30, depth: bh * 0.20, travel: bh * 0.30 };
    }
    function inside(p) {
      const { bw, bh, depth } = geom();
      const dx = p.x - (env.w / 2 + lean.x);
      const dy = p.y - (env.h / 2 + leanY.x - depth * 0.5);
      return Math.abs(dx) < bw * 0.62 && Math.abs(dy) < bh * 0.85;
    }
    function fire() {                        // the moment of gratitude
      fired = true; clicks++; lastAct = tNow; flash = 1;
      const { m, bw, bh } = geom();
      const cx = env.w / 2 + lean.x, cy = env.h / 2 + leanY.x;
      const n = 8 + (Math.random() * 5 | 0);
      const pal = [inks[2], inks[3], CREAM, AMBER];
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / n - 0.5) * 2.4 + (Math.random() - 0.5) * 0.4;
        const sp = m * (0.45 + Math.random() * 0.55);
        sparks.push({
          x: cx + (Math.random() - 0.5) * bw * 0.7, y: cy - bh * 0.6,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spin: Math.random() * TAU,
          age: 0, life: 0.5 + Math.random() * 0.3, ink: pal[i & 3],
        });
      }
      if (sparks.length > 64) sparks.splice(0, sparks.length - 64);
    }

    return {
      draw(t, dt) {
        tNow = t;
        const w = env.w, h = env.h, cx = w / 2, cy = h / 2;
        const { m, bw, bh, r, depth, travel } = geom();
        const cling = Math.min(clicks, 22);
        // --- neglect: slump in slowly, perk up fast ---
        const sTgt = t - lastAct > 10 ? 1 : 0;
        slump += (sTgt - slump) * (1 - Math.pow(sTgt ? 0.45 : 1e-4, dt));
        if (slump > 0.6 && t - lastHop > 4) { hopV = -0.38 * m; lastHop = t; }
        if (hopY < 0 || hopV < 0) {
          hopV += m * 3.4 * dt; hopY += hopV * dt;
          if (hopY >= 0) { hopY = 0; if (hopV > 0) prs.v += 8; hopV = 0; } // land squish
        }
        // --- lean + skew toward pointer, quiver with proximity ---
        const d = Math.hypot(px - cx, py - cy) + 1e-6;
        const near = hasPtr ? clamp(1 - d / (0.75 * m), 0, 1) : 0;
        const gain = (0.14 + cling * 0.016) * (1 - slump * 0.7);
        spring(lean, clamp((px - cx) * near * gain, -0.16 * m, 0.16 * m), 140, 13, dt);
        spring(leanY, clamp((py - cy) * near * gain * 0.6, -0.10 * m, 0.10 * m), 140, 13, dt);
        spring(skew, clamp((px - cx) / (w * 0.5), -1, 1) * 0.30 * near * (1 - slump), 120, 12, dt);
        const qf = 8 + cling * 0.8, calm = pressed ? 0.15 : 1;
        const qa = near * near * (0.9 + cling * 0.14) * calm * (1 - slump * 0.85) * (m / 300);
        const qx = Math.sin(t * qf * TAU) * qa, qy = Math.sin(t * qf * 1.63 * TAU + 1.2) * qa * 0.8;
        // --- press: 2-frame anticipation rise, then deep travel ---
        if (pressed && anticT > 0) anticT -= dt;
        if (pressed && anticT <= 0 && !fired) fire();
        spring(prs, pressed ? (anticT > 0 ? -0.5 : 1) : 0,
          pressed ? 1300 : 420, pressed ? 32 : 9, dt);
        const pD = clamp(prs.x, -0.7, 1.15);
        spring(gsc, Math.min(1 + clicks * 0.02, 1.26), 90, 7, dt);   // grows clingier
        flash *= Math.pow(0.02, dt);
        // --- compose ---
        g.fillStyle = bg;
        g.fillRect(0, 0, w, h);
        const mute = 1 - slump * 0.45;
        const breathe = Math.sin(t * 1.7) * 0.014 * (1 - near);
        const vstr = clamp(Math.abs(lean.v) * 6e-4, 0, 0.06);        // stretch when lunging
        const sx = 1 + pD * 0.10 - breathe + vstr, sy = 1 - pD * 0.14 + breathe - vstr * 0.6;
        const elev = depth - pD * travel;
        g.save();
        g.translate(cx + lean.x + qx, cy + leanY.x + qy + hopY + slump * bh * 0.22);
        g.rotate(slump * 0.13 + Math.sin(t * 0.9) * 0.02 * (1 - slump) + skew.x * 0.06);
        g.transform(1, 0, skew.x * 0.30, 1, 0, 0);
        g.scale(sx, sy);
        g.globalAlpha = mute;
        // socket the cap sinks into
        g.fillStyle = 'rgba(242,102,91,0.42)';
        rr(-bw / 2, -bh / 2, bw, bh, r);
        g.fill();
        g.fillStyle = 'rgba(20,16,13,0.35)';
        rr(-bw / 2 + 3, -bh / 2 + 3, bw - 6, bh - 6, r * 0.8);
        g.fill();
        // glossy cap face
        rr(-bw / 2, -bh / 2 - elev, bw, bh, r);
        g.fillStyle = AMBER;
        g.fill();
        g.save();
        g.clip();
        g.fillStyle = 'rgba(20,16,13,0.24)';                         // bottom shade
        g.fillRect(-bw / 2, -elev + bh * 0.10, bw, bh);
        g.fillStyle = 'rgba(242,233,220,' + (0.16 + flash * 0.3).toFixed(3) + ')'; // top light
        g.fillRect(-bw / 2, -bh / 2 - elev, bw, bh * 0.32);
        const ph = ((t * 0.3) % 1.5) / 1.5;                          // idle sheen sweep
        g.save();
        g.translate(ph * 2.6 * bw - 1.3 * bw, -elev);
        g.rotate(-0.45);
        g.globalAlpha = mute * 0.13 * (1 - slump);
        g.fillStyle = CREAM;
        g.fillRect(-bw * 0.09, -bh * 1.4, bw * 0.18, bh * 2.8);
        g.fillRect(-bw * 0.03, -bh * 1.4, bw * 0.06, bh * 2.8);
        g.restore();
        g.restore();
        g.strokeStyle = 'rgba(242,233,220,0.30)';                    // glossy rim
        g.lineWidth = 2;
        g.lineJoin = 'round';
        rr(-bw / 2 + 2, -bh / 2 - elev + 2, bw - 4, bh - 4, r * 0.85);
        g.stroke();
        g.fillStyle = 'rgba(20,16,13,0.92)';                         // the label
        g.font = '700 ' + Math.max(9, Math.round(bh * 0.34)) + 'px ui-monospace, Menlo, monospace';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('PRESS', 0, -elev + bh * 0.04);
        g.restore();
        // gratitude sparks — little spinning twinkles
        g.lineCap = 'round';
        g.lineWidth = 2;
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i];
          s.age += dt;
          if (s.age > s.life) { sparks.splice(i, 1); continue; }
          s.vy += m * 1.8 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
          const f = 1 - s.age / s.life, l = 2.5 + 4.5 * f, a = s.spin + s.age * 6;
          g.strokeStyle = s.ink;
          g.globalAlpha = f;
          g.beginPath();
          for (let k = 0; k < 4; k++) {
            const aa = a + k * TAU / 4;
            g.moveTo(s.x, s.y);
            g.lineTo(s.x + Math.cos(aa) * l, s.y + Math.sin(aa) * l);
          }
          g.stroke();
        }
        g.globalAlpha = 1;
      },
      down(p) {
        lastAct = tNow; hasPtr = true; px = p.x; py = p.y;
        if (inside(p)) { pressed = true; anticT = 0.034; fired = false; }
        else {          // missed? it lunges hopefully toward the pointer anyway
          lean.v += clamp(p.x - env.w / 2, -60, 60) * 3;
          leanY.v += clamp(p.y - env.h / 2, -60, 60) * 3;
        }
      },
      move(p) { px = p.x; py = p.y; hasPtr = true; lastAct = tNow; },
      up() {
        if (pressed && !fired) fire();   // a fast click still counts
        pressed = false; anticT = 0;
      },
      leave() { hasPtr = false; },
    };
  },
});
