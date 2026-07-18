/* № 35 — Magic 8-ball. A dark sphere that floats and bobs, a blue-lilac die
   drifting behind its cloudy window. Click it or shake it (a fast drag) and the
   whole ball jiggles on its spring, the ink clouds over and swirls, then a
   triangular die face rises to the glass carrying your fortune. */
F.register({
  n: 35, id: 'magic-8', cat: 'chaos',
  title: 'Magic 8-ball', hint: 'Shake it, then read your fortune',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const SKY = inks[3], LILAC = inks[4], CREAM = inks[5];
    const ANSWERS = [
      'IT IS CERTAIN', 'WITHOUT A DOUBT', 'YES DEFINITELY', 'REPLY HAZY TRY AGAIN',
      'ASK AGAIN LATER', 'BETTER NOT TELL YOU NOW', 'CANNOT PREDICT NOW',
      "DON'T COUNT ON IT", 'MY REPLY IS NO', 'OUTLOOK NOT SO GOOD',
      'OUTLOOK GOOD', 'SIGNS POINT TO YES',
    ];
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const smooth = (a, b, x) => { const t = clamp((x - a) / ((b - a) + 1e-6), 0, 1); return t * t * (3 - 2 * t); };

    // spring states {x, v} — all rest at 0
    const wobX = { x: 0, v: 0 }, wobY = { x: 0, v: 0 };   // positional jiggle (px)
    const rotS = { x: 0, v: 0 };                          // wobble rotation (rad)
    const sqS = { x: 0, v: 0 };                           // squash & stretch
    function sprC(s, k, c, dt, vlo, vhi, plo, phi) {
      s.v += (0 - s.x) * k * dt;
      let nv = clamp(s.v * Math.exp(-c * dt), vlo, vhi);
      let nx = clamp(s.x + nv * dt, plo, phi);
      if (!isFinite(nx + nv)) { nx = 0; nv = 0; }
      s.x = nx; s.v = nv;
    }

    let shakeT = 999;          // seconds since the last shake began
    let hasAnswer = false;     // has a fortune ever been drawn?
    let answer = '';
    let answerLines = [];
    let answerFont = 12;

    // ink wisps — a fixed set, animated (never reseeded per frame)
    const NB = 5, blobs = [];
    for (let i = 0; i < NB; i++) blobs.push({
      a: Math.random() * TAU, orb: 0.28 + Math.random() * 0.5,
      sp: (0.35 + Math.random() * 0.7) * (Math.random() < 0.5 ? -1 : 1),
      ph: Math.random() * TAU, sc: 0.42 + Math.random() * 0.5,
    });

    // pointer state for shake detection
    let px = 0, py = 0, ppx = 0, ppy = 0, hasPtr = false, held = false;
    let isDown = false, downMoved = 0;

    let S = null;  // size-derived geometry + cached static gradients
    function build() {
      const w = env.w, h = env.h, m = Math.min(w, h);
      const R = 0.42 * m, rW = 0.46 * R, winOff = 0.14 * R, eightOff = -0.58 * R, rE = 0.15 * R;
      const G_body = g.createRadialGradient(-R * 0.32, -R * 0.36, R * 0.05, 0, 0, R * 1.02);
      G_body.addColorStop(0, '#47474f'); G_body.addColorStop(0.5, '#28282e'); G_body.addColorStop(1, '#0c0c0f');
      const G_spec = g.createRadialGradient(-R * 0.36, -R * 0.42, 0, -R * 0.36, -R * 0.42, R * 0.55);
      G_spec.addColorStop(0, 'rgba(242,233,220,0.45)'); G_spec.addColorStop(0.4, 'rgba(242,233,220,0.12)'); G_spec.addColorStop(1, 'rgba(242,233,220,0)');
      const G_ink = g.createRadialGradient(0, winOff - rW * 0.25, rW * 0.1, 0, winOff, rW * 1.05);
      G_ink.addColorStop(0, 'rgba(38,48,86,1)'); G_ink.addColorStop(1, 'rgba(7,9,22,1)');
      const G_vig = g.createRadialGradient(0, winOff, rW * 0.5, 0, winOff, rW * 1.02);
      G_vig.addColorStop(0, 'rgba(4,5,14,0)'); G_vig.addColorStop(0.68, 'rgba(4,5,14,0.16)'); G_vig.addColorStop(1, 'rgba(4,5,14,0.72)');
      const G_glass = g.createRadialGradient(-rW * 0.34, winOff - rW * 0.4, 0, -rW * 0.34, winOff - rW * 0.4, rW * 0.95);
      G_glass.addColorStop(0, 'rgba(233,240,255,0.30)'); G_glass.addColorStop(0.5, 'rgba(233,240,255,0.05)'); G_glass.addColorStop(1, 'rgba(233,240,255,0)');
      const G_shadow = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.85);
      G_shadow.addColorStop(0, 'rgba(0,0,0,0.5)'); G_shadow.addColorStop(1, 'rgba(0,0,0,0)');
      S = { m, R, rW, winOff, eightOff, rE, G_body, G_spec, G_ink, G_vig, G_glass, G_shadow };
      fitText();
    }

    // pack the fortune into the settled die face, choosing the largest font that fits
    function fitText() {
      if (!hasAnswer || !S) { answerLines = []; return; }
      const rT = S.rW * 0.94, boxW = rT * 0.9, boxH = rT * 0.94;
      const words = answer.split(' ');
      for (let fs = Math.round(S.rW * 0.5); fs >= 6; fs--) {
        g.font = '700 ' + fs + 'px ui-monospace, Menlo, monospace';
        const lines = []; let cur = '', bad = false;
        for (const wd of words) {
          const test = cur ? cur + ' ' + wd : wd;
          if (g.measureText(test).width <= boxW) cur = test;
          else { if (cur) lines.push(cur); cur = wd; if (g.measureText(wd).width > boxW) { bad = true; break; } }
        }
        if (cur) lines.push(cur);
        if (bad) continue;
        if (lines.length <= 3 && lines.length * fs * 1.12 <= boxH) { answerLines = lines; answerFont = fs; return; }
      }
      answerLines = [answer]; answerFont = Math.max(6, Math.round(S.rW * 0.26));
    }

    function triggerShake() {
      if (shakeT < 0.5) return;                 // debounce so it can't false-fire constantly
      shakeT = 0;
      answer = ANSWERS[Math.random() * ANSWERS.length | 0];
      hasAnswer = true;
      fitText();
      const R = S ? S.R : 100, dir = Math.random() * TAU;
      wobX.v += Math.cos(dir) * R * 1.7;
      wobY.v += Math.sin(dir) * R * 1.3 - R * 0.6;
      rotS.v += (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 3);
      sqS.v += 9;
    }

    function drawDie(depth, ta, t) {
      const rW = S.rW, winOff = S.winOff;
      const drift = 0.5 + depth;
      const ax = Math.sin(t * 0.8 + 1.3) * rW * 0.06 * drift;
      const ay = winOff + Math.cos(t * 0.6 + 0.4) * rW * 0.06 * drift - depth * rW * 0.18;
      const scale = 0.55 + (1 - depth) * 0.42;
      const alpha = 0.16 + (1 - depth) * 0.84;
      const rT = rW * 0.94 * scale;
      const p0y = ay - rT, by = ay + rT * 0.5, bx = rT * 0.866;
      const dg = g.createLinearGradient(ax, p0y, ax, by);
      dg.addColorStop(0, SKY); dg.addColorStop(1, LILAC);
      g.globalAlpha = alpha;
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(ax, p0y); g.lineTo(ax - bx, by); g.lineTo(ax + bx, by); g.closePath();
      g.fillStyle = dg; g.fill();
      g.lineWidth = Math.max(1.5, rT * 0.05);
      g.strokeStyle = 'rgba(242,233,220,' + (0.32 * alpha).toFixed(3) + ')';
      g.stroke();
      if (ta > 0.01 && answerLines.length) {
        const fpx = Math.max(5, Math.round(answerFont * scale)), lh = fpx * 1.12;
        g.globalAlpha = alpha * ta;
        g.fillStyle = CREAM;
        g.font = '700 ' + fpx + 'px ui-monospace, Menlo, monospace';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        const startY = ay + rT * 0.08 - (answerLines.length - 1) * lh * 0.5;
        for (let i = 0; i < answerLines.length; i++) g.fillText(answerLines[i], ax, startY + i * lh);
      }
      g.globalAlpha = 1;
    }

    function drawWisps(cloud, t) {
      if (cloud <= 0.002) return;
      const rW = S.rW, winOff = S.winOff;
      for (let i = 0; i < NB; i++) {
        const b = blobs[i], ang = b.a + t * b.sp;
        const orb = rW * b.orb * (0.7 + 0.3 * Math.sin(t * 0.7 + b.ph));
        const x = Math.cos(ang) * orb, y = winOff + Math.sin(ang) * orb * 0.9;
        const rad = rW * b.sc * (0.62 + 0.24 * Math.sin(t + b.ph));
        const a = cloud * 0.5 * b.sc;
        const wg = g.createRadialGradient(x, y, 0, x, y, rad);
        wg.addColorStop(0, 'rgba(150,176,228,' + a.toFixed(3) + ')');
        wg.addColorStop(1, 'rgba(150,176,228,0)');
        g.fillStyle = wg;
        g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
      }
    }

    build();

    return {
      draw(t, dt) {
        const w = env.w, h = env.h, cx = w / 2, cy = h / 2;
        if (!S) build();
        const R = S.R, rW = S.rW, winOff = S.winOff, eightOff = S.eightOff, rE = S.rE;
        shakeT += dt;

        // shake detection + follow-the-hand jiggle while dragging
        if (held && isDown) {
          const dx = px - ppx, dy = py - ppy;
          const spd = Math.hypot(dx, dy) / Math.max(dt, 1e-3);
          wobX.v += clamp(dx, -45, 45) * 4;
          wobY.v += clamp(dy, -45, 45) * 4;
          if (spd > 600) triggerShake();
        }
        ppx = px; ppy = py;

        // relax the springs back to rest
        sprC(wobX, 95, 5, dt, -900, 900, -R * 0.6, R * 0.6);
        sprC(wobY, 95, 5, dt, -900, 900, -R * 0.6, R * 0.6);
        sprC(rotS, 130, 6, dt, -16, 16, -0.17, 0.17);
        sprC(sqS, 150, 5, dt, -40, 40, -1.2, 1.2);

        // reveal sequence driven entirely off shakeT: cloud → clear → rise → answer
        let cloud, dieDepth, textAlpha;
        if (!hasAnswer) {
          cloud = 0.5 + 0.1 * Math.sin(t * 0.5);
          dieDepth = 0.5 + 0.12 * Math.sin(t * 0.7 + 1.0);
          textAlpha = 0;
        } else {
          const rise = smooth(0.32, 1.25, shakeT), onset = smooth(0, 0.08, shakeT);
          cloud = onset * (1 - rise * 0.58);
          dieDepth = 1 - rise * 0.9;
          textAlpha = smooth(0.7, 1.2, shakeT);
        }

        // idle life
        const bob = Math.sin(t * 0.95) * R * 0.028;
        const sway = Math.sin(t * 0.62 + 0.7) * R * 0.02;
        const brer = Math.sin(t * 1.6) * 0.012;
        const sq = sqS.x;
        const sx = clamp((1 - sq * 0.1) * (1 + brer), 0.8, 1.25);
        const sy = clamp((1 + sq * 0.11) * (1 - brer), 0.8, 1.25);

        g.fillStyle = bg;
        g.fillRect(0, 0, w, h);

        // soft contact shadow so the ball reads as floating over the ground
        g.save();
        g.translate(cx + sway * 0.5, cy + R * 0.99);
        g.scale(1, 0.22);
        g.fillStyle = S.G_shadow;
        g.beginPath(); g.arc(0, 0, R * 0.85, 0, TAU); g.fill();
        g.restore();

        g.save();
        g.translate(cx + sway + wobX.x, cy + bob + wobY.x);
        g.rotate(rotS.x + Math.sin(t * 0.5) * 0.02);
        g.scale(sx, sy);

        // sphere body
        g.beginPath(); g.arc(0, 0, R, 0, TAU);
        g.fillStyle = S.G_body; g.fill();

        // rim: faint all round, brighter cool catch on the lower-right
        g.lineJoin = 'round'; g.lineCap = 'round';
        g.lineWidth = Math.max(1.5, R * 0.02);
        g.strokeStyle = 'rgba(190,196,214,0.09)';
        g.beginPath(); g.arc(0, 0, R - g.lineWidth * 0.5, 0, TAU); g.stroke();
        g.lineWidth = Math.max(2, R * 0.028);
        g.strokeStyle = 'rgba(120,150,235,0.2)';
        g.beginPath(); g.arc(0, 0, R - g.lineWidth * 0.5, 0.12 * Math.PI, 0.86 * Math.PI); g.stroke();

        // specular highlight + a sharp glint, clipped to the ball
        g.save();
        g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
        g.fillStyle = S.G_spec; g.fillRect(-R, -R, 2 * R, 2 * R);
        g.globalAlpha = 0.8; g.fillStyle = 'rgba(245,240,230,0.5)';
        g.beginPath(); g.ellipse(-R * 0.34, -R * 0.44, R * 0.1, R * 0.06, -0.6, 0, TAU); g.fill();
        g.globalAlpha = 1;
        g.restore();

        // the white "8" badge up top
        g.beginPath(); g.arc(0, eightOff, rE, 0, TAU);
        g.fillStyle = '#EDE7DB'; g.fill();
        g.lineWidth = Math.max(1, rE * 0.08); g.strokeStyle = 'rgba(0,0,0,0.16)';
        g.beginPath(); g.arc(0, eightOff, rE * 0.9, 0, TAU); g.stroke();
        g.fillStyle = '#14100D';
        g.font = '900 ' + Math.round(rE * 1.5) + 'px ui-monospace, Menlo, monospace';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('8', 0, eightOff + rE * 0.06);

        // the answer window — dark seat, murky ink, die, swirl, vignette, glass
        g.lineWidth = Math.max(2, rW * 0.1); g.strokeStyle = 'rgba(0,0,0,0.45)';
        g.beginPath(); g.arc(0, winOff, rW, 0, TAU); g.stroke();
        g.save();
        g.beginPath(); g.arc(0, winOff, rW, 0, TAU); g.clip();
        g.fillStyle = S.G_ink; g.fillRect(-rW, winOff - rW, 2 * rW, 2 * rW);
        drawDie(dieDepth, textAlpha, t);
        drawWisps(cloud, t);
        g.fillStyle = S.G_vig; g.fillRect(-rW, winOff - rW, 2 * rW, 2 * rW);
        g.restore();
        g.save();
        g.beginPath(); g.arc(0, winOff, rW, 0, TAU); g.clip();
        g.fillStyle = S.G_glass; g.fillRect(-rW, winOff - rW, 2 * rW, 2 * rW);
        g.restore();
        g.lineWidth = Math.max(1.5, rW * 0.045); g.strokeStyle = 'rgba(210,220,245,0.16)';
        g.beginPath(); g.arc(0, winOff, rW * 0.99, 0, TAU); g.stroke();

        g.restore();
      },
      down(p) {
        hasPtr = true; held = true; isDown = true; downMoved = 0;
        px = p.x; py = p.y; ppx = p.x; ppy = p.y;
        const R = S ? S.R : 100;
        wobX.v += (Math.random() - 0.5) * R * 0.5;
        wobY.v += -R * 0.4;
        sqS.v += 3;
      },
      move(p) {
        if (isDown) downMoved += Math.abs(p.x - px) + Math.abs(p.y - py);
        px = p.x; py = p.y; hasPtr = true; held = !!p.held;
      },
      up() {
        held = false;
        if (isDown && downMoved < 10) triggerShake();  // a plain click still shakes
        isDown = false;
      },
      leave() { hasPtr = false; held = false; isDown = false; },
      resize() { build(); },
    };
  },
});
