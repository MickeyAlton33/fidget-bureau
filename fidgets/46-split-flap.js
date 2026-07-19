/* № 46 — Split-flap. A four-drum station board. Each drum shows a character
   split across a center seam; to change it, the top half folds down over the
   seam in the classic mechanical flip, cascading through intermediate glyphs
   and easing to a bouncing stop. Idle, the board keeps updating itself and
   resting on short words. Click a drum to flip it; scroll to spin it fast. */
F.register({
  n: 46, id: 'split-flap', cat: 'mech',
  title: 'Split-flap', hint: 'Click a dial to flip through it',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const N = CHARS.length;
    const WORDS = ['PLAY', 'FLIP', 'SPIN', 'GLOW', 'WAVE', 'ZOOM', 'IDLE',
      'SOON', 'GONE', 'OPEN', 'BOLT', 'GRIN', 'TICK', 'HUSH', 'DRUM', 'JOLT'];
    const CREAM = inks[5], AMBER = inks[0], CORAL = inks[1];
    const PANEL_T = '#2a2520', PANEL_B = '#1f1b16', FLAP = '#302a23',
      SEAM = '#0c0a08', HOUSE = '#191410';

    // motion / spring constants
    const APPROACH = 7, MINFIN = 3.2, ACCEL = 16;   // forward-cascade easing
    const STIFF = 185, DAMP = 12, KICK = 2.2, VREF = 9; // landing bounce

    const drums = [];
    for (let i = 0; i < 4; i++) drums.push({ pos: 0, vel: 0, target: 0, maxV: 22, sq: 0, sqV: 0, lastI: 0, lit: 0 });

    let xs = [0, 0, 0, 0], cy = 0, dw = 0, dh = 0, rad = 6, pegR = 3;
    let fontStr = '700 30px ui-monospace, Menlo, monospace';
    let houseX = 0, houseY = 0, houseW = 0, houseH = 0;

    function layout() {
      const w = env.w, h = env.h;
      const gapK = 0.16;
      dw = (w * 0.9) / (4 + 3 * gapK);
      const gap = dw * gapK;
      dh = Math.min(dw * 1.55, h * 0.6);
      rad = Math.max(3, Math.min(dw * 0.12, dh * 0.2));
      pegR = Math.max(2.5, dw * 0.05);
      cy = h * 0.5;
      const totalW = dw * 4 + gap * 3;
      const x0 = (w - totalW) / 2 + dw / 2;
      for (let i = 0; i < 4; i++) xs[i] = x0 + i * (dw + gap);
      fontStr = '700 ' + Math.max(8, Math.round(dh * 0.6)) + 'px ui-monospace, Menlo, monospace';
      const padX = dw * 0.28, padY = dh * 0.16;
      houseX = xs[0] - dw / 2 - padX;
      houseW = (xs[3] + dw / 2 + padX) - houseX;
      houseY = cy - dh / 2 - padY;
      houseH = dh + padY * 2;
    }
    layout();

    // sit exactly on the opening word
    (function () {
      const w = WORDS[0];
      for (let i = 0; i < 4; i++) {
        const li = CHARS.indexOf(w[i]);
        drums[i].pos = li; drums[i].target = li; drums[i].lastI = li;
      }
    })();

    let idleT = 0, idleNext = 1.3, wi = 0, hoverCol = -1, tNow = 0;

    function setWord(word, fast) {
      for (let i = 0; i < 4; i++) {
        const d = drums[i];
        const cur = ((Math.floor(d.target) % N) + N) % N;
        const delta = (CHARS.indexOf(word[i]) - cur + N) % N;
        d.target += delta;
        d.maxV = fast ? 30 : 22;
        if (delta > 0) d.lit = Math.max(d.lit, 0.6);
      }
    }
    function flipColumn(i, steps, maxV) {
      const d = drums[i];
      d.target = Math.max(d.target, d.pos) + steps;
      if (d.target - d.pos > 5 * N) d.target = d.pos + 5 * N;
      d.maxV = maxV; d.lit = 1;
    }
    function colAt(x) {
      let best = 0, bd = 1e18;
      for (let i = 0; i < 4; i++) { const q = Math.abs(x - xs[i]); if (q < bd) { bd = q; best = i; } }
      return best;
    }
    function scheduleIdle() {
      if (Math.random() < 0.62) {
        wi = (wi + 1 + (Math.random() * (WORDS.length - 1) | 0)) % WORDS.length;
        setWord(WORDS[wi], false);
      } else {
        flipColumn(Math.random() * 4 | 0, 2 + (Math.random() * 5 | 0), 24);
      }
    }

    function stepDrum(d, dt) {
      if (d.target - d.pos > 5 * N) d.target = d.pos + 5 * N;
      const rem = d.target - d.pos;
      if (rem > 1e-4) {
        const desired = Math.min(d.maxV, Math.max(MINFIN, rem * APPROACH));
        d.vel += (desired - d.vel) * (1 - Math.exp(-ACCEL * dt));
        d.pos += d.vel * dt;
        const fl = Math.floor(d.pos);
        if (fl !== d.lastI) {                       // a flap just landed
          d.lastI = fl;
          const slow = Math.max(0, 1 - d.vel / VREF);
          d.sqV -= KICK * slow;
          if (slow > 0.2) d.lit = Math.min(1, d.lit + 0.4 * slow);
        }
        if (d.pos >= d.target - 1e-3) {
          d.pos = d.target; d.vel = 0;
          const k = Math.floor(d.pos / N);           // keep indices small
          if (k > 0) { d.pos -= k * N; d.target -= k * N; }
          d.lastI = Math.floor(d.pos);
        }
      } else { d.vel = 0; }
      d.sqV += (-d.sq * STIFF - d.sqV * DAMP) * dt;
      d.sq += d.sqV * dt;
      if (d.sq < -0.2) { d.sq = -0.2; if (d.sqV < 0) d.sqV = 0; }
      if (d.sq > 0.12) { d.sq = 0.12; if (d.sqV > 0) d.sqV = 0; }
      d.lit *= Math.pow(0.14, dt);
    }

    function rr(x, y, w, h, r) {
      r = Math.min(r, w * 0.5, h * 0.5);
      g.beginPath();
      g.moveTo(x + r, y);
      g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
      g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
      g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
      g.closePath();
    }
    function clipHalf(top, cx) {
      const x0 = cx - dw / 2, x1 = cx + dw / 2, topY = cy - dh / 2, botY = cy + dh / 2, r = rad;
      g.beginPath();
      if (top) {
        g.moveTo(x0, cy); g.lineTo(x0, topY + r); g.quadraticCurveTo(x0, topY, x0 + r, topY);
        g.lineTo(x1 - r, topY); g.quadraticCurveTo(x1, topY, x1, topY + r); g.lineTo(x1, cy);
      } else {
        g.moveTo(x0, cy); g.lineTo(x1, cy); g.lineTo(x1, botY - r);
        g.quadraticCurveTo(x1, botY, x1 - r, botY); g.lineTo(x0 + r, botY);
        g.quadraticCurveTo(x0, botY, x0, botY - r);
      }
      g.closePath(); g.clip();
    }

    function drawDrum(d, i) {
      const cx = xs[i];
      const idx = ((Math.floor(d.pos) % N) + N) % N;
      const C = CHARS[idx], D = CHARS[(idx + 1) % N];
      let f = d.pos - Math.floor(d.pos);
      if (!(f >= 0)) f = 0; if (f > 1) f = 1;

      const halfH = dh / 2, topY = cy - halfH, x0 = cx - dw / 2;
      const vs = Math.max(0.72, Math.min(1.12, 1 + d.sq));

      g.save();
      g.translate(cx, cy); g.scale(1, vs); g.translate(-cx, -cy);
      g.font = fontStr; g.textAlign = 'center'; g.textBaseline = 'middle';

      rr(x0, topY, dw, dh, rad); g.fillStyle = PANEL_B; g.fill();

      // static cards behind the flaps: incoming top (D), outgoing bottom (C)
      g.save(); clipHalf(true, cx);
      g.fillStyle = PANEL_T; g.fillRect(x0, topY, dw, halfH + 0.6);
      g.fillStyle = CREAM; g.fillText(D, cx, cy);
      g.restore();
      g.save(); clipHalf(false, cx);
      g.fillStyle = PANEL_B; g.fillRect(x0, cy - 0.6, dw, halfH + 0.6);
      g.fillStyle = CREAM; g.fillText(C, cx, cy);
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x0, cy, dw, halfH * 0.14);
      g.restore();

      // folding flap: top half (C) folds toward the seam, then the far face
      // (bottom of D) folds down over the bottom — one continuous flip
      if (f < 0.5) {
        const sT = Math.cos((f / 0.5) * Math.PI / 2);
        if (sT > 0.025) {
          g.save(); clipHalf(true, cx);
          g.translate(cx, cy); g.scale(1, sT); g.translate(-cx, -cy);
          g.fillStyle = FLAP; g.fillRect(x0, topY, dw, halfH + 0.6);
          g.fillStyle = CREAM; g.fillText(C, cx, cy);
          g.fillStyle = 'rgba(8,6,4,' + (0.34 * (1 - sT)).toFixed(3) + ')';
          g.fillRect(x0, topY, dw, halfH + 0.6);
          g.restore();
        }
      } else {
        const sB = Math.sin(((f - 0.5) / 0.5) * Math.PI / 2);
        if (sB > 0.025) {
          g.save(); clipHalf(false, cx);
          g.translate(cx, cy); g.scale(1, sB); g.translate(-cx, -cy);
          g.fillStyle = FLAP; g.fillRect(x0, cy - 0.6, dw, halfH + 0.6);
          g.fillStyle = CREAM; g.fillText(D, cx, cy);
          g.fillStyle = 'rgba(8,6,4,' + (0.34 * (1 - sB)).toFixed(3) + ')';
          g.fillRect(x0, cy - 0.6, dw, halfH + 0.6);
          g.restore();
        }
      }

      // center seam
      g.fillStyle = SEAM; g.fillRect(x0, cy - 1.3, dw, 2.6);
      g.fillStyle = 'rgba(245,165,36,0.16)'; g.fillRect(x0, cy + 1.3, dw, 0.9);

      // frame — warms to coral when active/hovered
      rr(x0, topY, dw, dh, rad);
      g.lineWidth = Math.max(2, dw * 0.045); g.lineJoin = 'round';
      const glow = Math.max(d.lit, hoverCol === i ? 0.5 : 0);
      g.strokeStyle = glow > 0.02
        ? 'rgba(242,102,91,' + (0.35 + 0.5 * Math.min(1, glow)).toFixed(3) + ')'
        : 'rgba(245,165,36,0.42)';
      g.stroke();
      g.restore();

      // axle pegs on the seam (shimmer for continuous life)
      const pa = 0.55 + 0.4 * Math.sin(tNow * 2.3 + i * 1.7);
      g.fillStyle = 'rgba(245,165,36,' + pa.toFixed(3) + ')';
      g.beginPath(); g.arc(x0, cy, pegR, 0, TAU); g.fill();
      g.beginPath(); g.arc(x0 + dw, cy, pegR, 0, TAU); g.fill();
    }

    return {
      draw(t, dt) {
        tNow = t;
        idleT += dt;
        if (idleT >= idleNext) { idleT = 0; idleNext = 2.3 + Math.random() * 2.6; scheduleIdle(); }
        for (let i = 0; i < 4; i++) stepDrum(drums[i], dt);

        g.fillStyle = bg; g.fillRect(0, 0, env.w, env.h);

        rr(houseX, houseY, houseW, houseH, rad * 1.3);
        g.fillStyle = HOUSE; g.fill();
        g.lineWidth = 2; g.strokeStyle = 'rgba(245,165,36,0.22)'; g.lineJoin = 'round'; g.stroke();
        const led = 0.3 + 0.45 * (0.5 + 0.5 * Math.sin(tNow * 3.1));
        g.fillStyle = 'rgba(245,165,36,' + led.toFixed(3) + ')';
        g.beginPath(); g.arc(houseX + houseW - rad, houseY + rad, Math.max(2, pegR * 0.7), 0, TAU); g.fill();

        for (let i = 0; i < 4; i++) drawDrum(drums[i], i);
      },
      down(p) {
        idleT = 0; idleNext = Math.max(idleNext, 3.5);
        const i = colAt(p.x);
        flipColumn(i, 4 + (Math.random() * 4 | 0), 26);
        drums[i].sqV -= 0.6;                          // immediate answer to the click
      },
      move(p) {
        if (p.held) return;
        if (p.x < houseX || p.x > houseX + houseW || p.y < houseY - 15 || p.y > houseY + houseH + 15) { hoverCol = -1; return; }
        hoverCol = colAt(p.x);
      },
      wheel(dy, p) {
        idleT = 0; idleNext = Math.max(idleNext, 3.5);
        const i = colAt(p.x);
        const steps = 3 + Math.min(7, Math.round(Math.abs(dy) / 45));
        const d = drums[i];
        d.target = Math.max(d.target, d.pos) + steps;
        if (d.target - d.pos > 5 * N) d.target = d.pos + 5 * N;
        d.maxV = 42; d.lit = 1;
      },
      dbl() {
        idleT = 0; idleNext = Math.max(idleNext, 3.5);
        wi = (wi + 1 + (Math.random() * (WORDS.length - 1) | 0)) % WORDS.length;
        setWord(WORDS[wi], true);
        for (let i = 0; i < 4; i++) drums[i].lit = 1;
      },
      leave() { hoverCol = -1; },
      resize() { layout(); },
    };
  },
});
