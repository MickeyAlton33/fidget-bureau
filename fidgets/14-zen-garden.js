/* № 14 — Zen garden. A tray of warm sand that remembers your hand. Drag to
   pull a four-prong rake through it, double-click to set a stone ringed with
   grooves, then leave it alone: the sand slowly heals itself, and every so
   often a breeze rakes one faint arc all on its own. */
F.register({
  n: 14, id: 'zen-garden', cat: 'chaos',
  title: 'Zen garden', hint: 'Rake the sand. Double-click to set a stone',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const rgb = s => [1, 3, 5].map(k => parseInt(s.slice(k, k + 2), 16));
    const mix = (a, b, f) => a.map((v, k) => Math.round(v + (b[k] - v) * f));
    const css = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
    const BGC = rgb(bg), CREAM = rgb(inks[5]), AMBER = rgb(inks[0]);
    const SAND = mix(BGC, CREAM, 0.15), STONE = mix(BGC, [0, 0, 0], 0.45);
    let oc, og, vig, m = 1, PAD = 12, lastW = 0, lastH = 0;
    let pebbles = [];             // {x, y, r, k, vk, a, dying}
    let last = null, cur = null;  // rake anchor / live pointer
    let raking = false, hover = null, dir = -0.6;
    let fc = 0, windT = 2.2, wind = null;

    function mkCanvas(w, h) {
      if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
      const noop = () => {};      // harness stand-in: same surface, no pixels
      const ctx = new Proxy({}, { get: (t, k) => t[k] || noop, set: (t, k, v) => (t[k] = v, true) });
      return { width: w, height: h, getContext: () => ctx };
    }
    function grain(n, alpha) {
      for (let i = 0; i < n; i++) {
        og.fillStyle = Math.random() < 0.5 ? css(CREAM, alpha) : css(BGC, alpha * 1.5);
        og.fillRect(PAD + Math.random() * (env.w - PAD * 2),
          PAD + Math.random() * (env.h - PAD * 2), 1 + Math.random() * 1.4, 1 + Math.random() * 1.4);
      }
    }
    function groove(x0, y0, x1, y1, px, py, alpha, wd) {
      og.lineCap = 'round';
      og.lineWidth = wd;
      og.strokeStyle = css(BGC, alpha);              // trough shadow
      og.beginPath(); og.moveTo(x0, y0); og.lineTo(x1, y1); og.stroke();
      og.strokeStyle = css(CREAM, alpha * 0.55);     // lit ridge beside it
      og.beginPath();
      og.moveTo(x0 + px * wd, y0 + py * wd); og.lineTo(x1 + px * wd, y1 + py * wd);
      og.stroke();
    }
    function rake(x0, y0, x1, y1, alpha) {           // 4 prongs across travel
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) + 1e-6;
      const px = -dy / len, py = dx / len, gap = Math.max(4.5, m * 0.024);
      for (let k = -1.5; k <= 1.5; k++) {
        groove(x0 + px * k * gap, y0 + py * k * gap,
          x1 + px * k * gap, y1 + py * k * gap, px, py, alpha, 2);
      }
    }
    function ring(x, y, r, alpha) {
      og.lineWidth = 2;
      og.strokeStyle = css(BGC, alpha);
      og.beginPath(); og.arc(x, y, r, 0, TAU); og.stroke();
      og.strokeStyle = css(CREAM, alpha * 0.55);
      og.beginPath(); og.arc(x, y, r + 2, 0, TAU); og.stroke();
    }
    function stampStone(s) { ring(s.x, s.y, s.r + 7, 0.5); ring(s.x, s.y, s.r + 14, 0.34); }
    function carveArc(cx, cy, r, a0, a1, alpha) {
      const n = Math.max(8, Math.round(Math.abs(a1 - a0) * r / 9));
      let px = cx + r * Math.cos(a0), py = cy + r * Math.sin(a0);
      for (let i = 1; i <= n; i++) {
        const a = a0 + (a1 - a0) * i / n;
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        rake(px, py, x, y, alpha);
        px = x; py = y;
      }
    }
    function build() {
      const w = Math.max(2, env.w), h = Math.max(2, env.h);
      const prev = oc, pw = lastW, ph = lastH;
      lastW = w; lastH = h; m = Math.min(w, h);
      PAD = Math.max(9, m * 0.05);
      oc = mkCanvas(w, h); og = oc.getContext('2d');
      og.fillStyle = css(SAND, 1); og.fillRect(0, 0, w, h);
      if (prev) {                                    // keep every carved groove
        og.drawImage(prev, 0, 0, pw, ph, 0, 0, w, h);
      } else {
        grain(Math.round(w * h / 240), 0.055);
        carveArc(w * 0.34, h * 0.72, m * 0.40, -2.45, -0.62, 0.20);
        carveArc(w * 0.34, h * 0.72, m * 0.56, -2.30, -0.76, 0.14);
        for (const s of pebbles) stampStone(s);
      }
      vig = g.createRadialGradient(w / 2, h / 2, m * 0.30, w / 2, h / 2, m * 0.80);
      vig.addColorStop(0, css(BGC, 0));
      vig.addColorStop(1, css(BGC, 0.42));
      windT = Math.min(windT, 2.2);
    }
    function addStone(x, y) {
      x = Math.min(env.w - PAD * 2.4, Math.max(PAD * 2.4, x));
      y = Math.min(env.h - PAD * 2.4, Math.max(PAD * 2.4, y));
      if (pebbles.filter(s => !s.dying).length >= 5) {
        const old = pebbles.find(s => !s.dying);
        if (old) old.dying = true;                   // oldest bows out
      }
      const s = { x, y, r: m * (0.042 + Math.random() * 0.02), k: 0.1, vk: 0, a: 1, dying: false };
      pebbles.push(s);
      stampStone(s);
    }
    function trayPath(inset, r) {
      const w = env.w, h = env.h;
      g.moveTo(inset + r, inset);
      g.arcTo(w - inset, inset, w - inset, h - inset, r);
      g.arcTo(w - inset, h - inset, inset, h - inset, r);
      g.arcTo(inset, h - inset, inset, inset, r);
      g.arcTo(inset, inset, w - inset, inset, r);
      g.closePath();
    }
    build();
    addStone(env.w * 0.64, env.h * 0.37);

    return {
      draw(t, dt) {
        // slow heal: whisper of fresh sand every 8th frame, plus new grain
        fc++;
        if ((fc & 7) === 0) {
          og.fillStyle = css(SAND, 0.006);
          og.fillRect(0, 0, oc.width, oc.height);
          grain(2, 0.045);
        }
        // an occasional breeze rakes one faint arc by itself
        if (wind) {
          wind.u = Math.min(1, wind.u + dt / wind.dur);
          const a = wind.a0 + wind.sweep * wind.u;
          const x = wind.cx + wind.r * Math.cos(a), y = wind.cy + wind.r * Math.sin(a);
          if (wind.prev) rake(wind.prev.x, wind.prev.y, x, y, 0.13);
          wind.prev = { x, y };
          if (wind.u >= 1) { wind = null; windT = 16 + Math.random() * 9; }
        } else if ((windT -= dt) <= 0) {
          wind = {
            cx: env.w * (0.3 + Math.random() * 0.4), cy: env.h * (0.3 + Math.random() * 0.4),
            r: m * (0.18 + Math.random() * 0.24), a0: Math.random() * TAU,
            sweep: (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 1.3),
            u: 0, dur: 3.5 + Math.random() * 2, prev: null,
          };
        }
        g.fillStyle = bg;
        g.fillRect(0, 0, env.w, env.h);
        g.drawImage(oc, 0, 0, env.w, env.h);
        // stones: springy pop-in, quiet fade-out
        for (let i = pebbles.length - 1; i >= 0; i--) {
          const s = pebbles[i];
          s.vk += (1 - s.k) * 110 * dt;
          s.vk *= Math.pow(0.002, dt);
          s.k += s.vk * dt;
          if (s.dying && (s.a -= dt * 1.5) <= 0) { pebbles.splice(i, 1); continue; }
          const r = Math.max(0, s.r * s.k);
          g.globalAlpha = Math.max(0, Math.min(1, s.a));
          g.fillStyle = css(BGC, 0.5);               // grounding shadow
          g.beginPath(); g.ellipse(s.x + r * 0.14, s.y + r * 0.2, r * 1.04, r * 0.82, 0, 0, TAU); g.fill();
          g.fillStyle = css(STONE, 1);
          g.beginPath(); g.ellipse(s.x, s.y, r, r * 0.86, 0, 0, TAU); g.fill();
          g.fillStyle = css(CREAM, 0.16);            // sheen
          g.beginPath(); g.ellipse(s.x - r * 0.3, s.y - r * 0.4, r * 0.44, r * 0.26, -0.5, 0, TAU); g.fill();
          g.globalAlpha = 1;
        }
        // rake head under the finger, breathing ring on hover
        if (raking && cur) {
          const px = Math.cos(dir + Math.PI / 2), py = Math.sin(dir + Math.PI / 2);
          const gap = Math.max(4.5, m * 0.024);
          g.strokeStyle = css(AMBER, 0.9);
          g.lineWidth = 3; g.lineCap = 'round';
          g.beginPath();
          g.moveTo(cur.x + px * gap * 1.9, cur.y + py * gap * 1.9);
          g.lineTo(cur.x - px * gap * 1.9, cur.y - py * gap * 1.9);
          g.stroke();
          g.fillStyle = css(AMBER, 1);
          for (let k = -1.5; k <= 1.5; k++) {
            g.beginPath(); g.arc(cur.x + px * k * gap, cur.y + py * k * gap, 2.6, 0, TAU); g.fill();
          }
        } else if (hover) {
          g.strokeStyle = css(CREAM, 0.22 + 0.12 * Math.sin(t * 3));
          g.lineWidth = 2;
          g.beginPath(); g.arc(hover.x, hover.y, m * 0.05, 0, TAU); g.stroke();
        }
        g.fillStyle = vig;                           // soft vignette
        g.fillRect(0, 0, env.w, env.h);
        g.beginPath();                               // tray frame masks the rim
        g.rect(0, 0, env.w, env.h);
        trayPath(PAD * 0.5, PAD * 0.9);
        g.fillStyle = bg;
        g.fill('evenodd');
        g.beginPath(); trayPath(PAD * 0.5, PAD * 0.9);
        g.strokeStyle = css(AMBER, 0.55); g.lineWidth = 2.5; g.stroke();
        g.beginPath(); trayPath(PAD * 0.5 + 3, PAD * 0.7);
        g.strokeStyle = css(BGC, 0.5); g.lineWidth = 2; g.stroke();
      },
      down(p) {
        raking = true; hover = null;
        last = { x: p.x, y: p.y }; cur = { x: p.x, y: p.y };
      },
      move(p) {
        cur = { x: p.x, y: p.y };
        if (p.held && raking && last) {
          hover = null;
          const dx = p.x - last.x, dy = p.y - last.y;
          if (Math.hypot(dx, dy) > 2.2) {
            let da = Math.atan2(dy, dx) - dir;
            while (da > Math.PI) da -= TAU;
            while (da < -Math.PI) da += TAU;
            dir += da * 0.45;
            rake(last.x, last.y, p.x, p.y, 0.55);
            last = { x: p.x, y: p.y };
          }
        } else if (!p.held) hover = { x: p.x, y: p.y };
      },
      up() { raking = false; last = null; },
      dbl(p) { addStone(p.x, p.y); },
      leave() { hover = null; raking = false; last = null; },
      resize() {
        const rw = env.w / Math.max(1, lastW), rh = env.h / Math.max(1, lastH);
        for (const s of pebbles) { s.x *= rw; s.y *= rh; s.r *= Math.min(rw, rh); }
        wind = null; last = null;                    // stale coords would streak
        build();
      },
    };
  },
});
