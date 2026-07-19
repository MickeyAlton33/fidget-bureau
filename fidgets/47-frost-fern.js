/* № 47 — Frost. Dendritic ice ferns creeping in from the cold edges of a dark
   pane. At idle the frost advances tip by tip, branching at hexagonal angles
   and thinning as it goes, until a fixed crystal pool fills and it only
   shimmers. Drag to trail a chill and seed new ferns; double-click to breathe
   warmth — the frost retreats and fades, freeing the glass to frost anew. */
F.register({
  n: 47, id: 'frost-fern', cat: 'matter',
  title: 'Frost', hint: 'Drag a chill to grow frost — double-click melts',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const rgb = s => [1, 3, 5].map(k => parseInt(s.slice(k, k + 2), 16));
    const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    const css = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
    const SKYc = rgb(inks[3]), LILc = rgb(inks[4]), CREAMc = rgb(inks[5]), AMBERc = rgb(inks[0]);

    // growth shape constants
    const POOL = 340, TIERS = 5;
    const MAXGEN = 4, SPINE_GEN = 2, SIDE_RATIO = 0.58, SPINE_RATIO = 0.8, SEED_RESERVE = 34;

    // fixed crystal pool — allocated ONCE, never grown
    const segs = new Array(POOL);
    for (let i = 0; i < POOL; i++) {
      segs[i] = { used: false, x0: 0, y0: 0, ang: 0, cx: 1, cy: 0, len: 0, tgt: 0,
        node: 0, gap: 1, gen: 0, side: 1, grow: false, ci: 0, seed: 0, melt: 0, tx: 0, ty: 0 };
    }
    const free = [];
    for (let i = POOL - 1; i >= 0; i--) free.push(i);

    let m = 1, u = 1, haloW = 4, lastW = 1, lastH = 1;
    const wTier = [], coreCss = [[], []];
    function metrics() {
      lastW = Math.max(1, env.w); lastH = Math.max(1, env.h); m = Math.min(lastW, lastH);
      u = Math.max(0.7, Math.min(1.5, m / 360));
      const baseW = [3.4, 2.5, 1.9, 1.4, 1.05];
      for (let t = 0; t < TIERS; t++) wTier[t] = Math.max(0.85, baseW[t] * u);
      for (let c = 0; c < 2; c++) {
        const base = c ? LILc : SKYc;
        for (let t = 0; t < TIERS; t++) {
          coreCss[c][t] = css(mix(base, CREAMc, 0.32 + 0.55 * (t / (TIERS - 1))), 0.9);
        }
      }
      haloW = wTier[0] + 3 * u;
    }
    metrics();

    function spawn(x0, y0, ang, tgt, gen, ci) {
      if (free.length === 0 || tgt < m * 0.02 || !isFinite(ang)) return;
      const i = free.pop(), s = segs[i];
      s.used = true; s.x0 = x0; s.y0 = y0; s.ang = ang;
      s.cx = Math.cos(ang); s.cy = Math.sin(ang);
      s.len = 0; s.tgt = tgt; s.gap = Math.max(m * 0.028, tgt * 0.34); s.node = s.gap;
      s.gen = gen; s.side = Math.random() < 0.5 ? 1 : -1; s.grow = true;
      s.ci = ci; s.seed = Math.random() * TAU; s.melt = 0;
      s.tx = x0; s.ty = y0;            // valid tip even before first step (no NaN)
    }
    function freeSeg(i) {
      const s = segs[i];
      if (!s.used) return;
      s.used = false; s.grow = false; free.push(i);
    }
    function seedEdge() {
      if (free.length <= SEED_RESERVE) return;
      const w = env.w, h = env.h, side = (Math.random() * 4) | 0, q = Math.random();
      let x, y, a;
      if (side === 0) { x = 0; y = q * h; a = 0; }            // left → creep right
      else if (side === 1) { x = w; y = q * h; a = Math.PI; } // right → left
      else if (side === 2) { x = q * w; y = 0; a = Math.PI / 2; } // top → down
      else { x = q * w; y = h; a = -Math.PI / 2; }           // bottom → up
      a += (Math.random() - 0.5) * 1.15;
      spawn(x, y, a, m * (0.12 + Math.random() * 0.08), 0, Math.random() < 0.5 ? 0 : 1);
    }
    function seedDrag(x, y) {
      x = Math.max(0, Math.min(env.w, x)); y = Math.max(0, Math.min(env.h, y));
      let n = 1 + (Math.random() < 0.55 ? 1 : 0);
      while (n-- > 0 && free.length > 6) {
        spawn(x, y, Math.random() * TAU, m * (0.075 + Math.random() * 0.06), 0, Math.random() < 0.5 ? 0 : 1);
      }
    }

    function stepAll(dt) {
      const GROW = m * 0.45, MELT = 1.5, MINLEN = m * 0.02;
      for (let i = 0; i < POOL; i++) {
        const s = segs[i];
        if (!s.used) continue;
        if (s.melt > 0) {                                    // warmth: retract from the tip, fade
          s.melt += MELT * (1 + 0.6 * s.gen) * dt;
          s.len *= Math.pow(0.16, dt);
          if (s.melt >= 1) { freeSeg(i); continue; }
        } else if (s.grow) {
          s.len += GROW * dt;
          while (s.len >= s.node && s.gen < MAXGEN && free.length > 0 && s.tgt * SIDE_RATIO > MINLEN) {
            const px = s.x0 + s.cx * s.node, py = s.y0 + s.cy * s.node;
            s.side = -s.side;                                // alternate pinnae, hexagonal 60° bias
            const ba = s.ang + s.side * (Math.PI / 3) + (Math.random() - 0.5) * 0.34;
            spawn(px, py, ba, s.tgt * SIDE_RATIO, s.gen + 1, s.ci);
            s.node += s.gap;
          }
          if (s.len >= s.tgt) {
            s.len = s.tgt; s.grow = false;
            if (s.gen <= SPINE_GEN && free.length > 0 && s.tgt * SPINE_RATIO > MINLEN) {
              const tx = s.x0 + s.cx * s.tgt, ty = s.y0 + s.cy * s.tgt;
              spawn(tx, ty, s.ang + (Math.random() - 0.5) * 0.3, s.tgt * SPINE_RATIO, s.gen, s.ci);
            }
          }
        }
        s.tx = s.x0 + s.cx * s.len; s.ty = s.y0 + s.cy * s.len;
      }
    }

    let seedT = 0, hover = null, lastSeed = null;
    const waves = [];                                        // {x,y,r,maxR}

    // start already frosting: a few edge origins, pre-grown so idle is alive
    for (let k = 0; k < 5; k++) seedEdge();
    for (let k = 0; k < 20; k++) stepAll(0.04);

    return {
      draw(t, dt) {
        const WARMTH = m * 1.7;
        seedT -= dt;
        if (seedT <= 0) { seedEdge(); seedT = 0.55 + Math.random() * 0.7; }

        // warmth waves expand and mark frost roots for melting
        if (waves.length) {
          for (let wi = 0; wi < waves.length; wi++) waves[wi].r += WARMTH * dt;
          for (let i = 0; i < POOL; i++) {
            const s = segs[i];
            if (!s.used || s.melt > 0) continue;
            for (let wi = 0; wi < waves.length; wi++) {
              const wv = waves[wi], dx = s.x0 - wv.x, dy = s.y0 - wv.y;
              if (dx * dx + dy * dy < wv.r * wv.r) { s.melt = 1e-4; break; }
            }
          }
          for (let wi = waves.length - 1; wi >= 0; wi--) if (waves[wi].r > waves[wi].maxR) waves.splice(wi, 1);
        }

        stepAll(dt);

        g.fillStyle = bg;
        g.fillRect(0, 0, env.w, env.h);
        g.lineCap = 'round'; g.lineJoin = 'round';

        // warmth glow beneath the frost — revealed as ice fades over it
        for (let wi = 0; wi < waves.length; wi++) {
          const wv = waves[wi], a = 0.16 * Math.max(0, 1 - wv.r / wv.maxR), r = Math.max(1, wv.r);
          const rg = g.createRadialGradient(wv.x, wv.y, 0, wv.x, wv.y, r);
          rg.addColorStop(0, css(AMBERc, a));
          rg.addColorStop(0.55, css(AMBERc, a * 0.4));
          rg.addColorStop(1, css(AMBERc, 0));
          g.fillStyle = rg;
          g.beginPath(); g.arc(wv.x, wv.y, r, 0, TAU); g.fill();
        }

        // soft halo bloom (bucketed by ink — one stroke each)
        for (let c = 0; c < 2; c++) {
          g.strokeStyle = css(c ? LILc : SKYc, 0.085);
          g.lineWidth = haloW;
          g.beginPath();
          for (let i = 0; i < POOL; i++) {
            const s = segs[i];
            if (!s.used || s.melt > 0 || s.ci !== c) continue;
            g.moveTo(s.x0, s.y0); g.lineTo(s.tx, s.ty);
          }
          g.stroke();
        }
        // bright crystal cores (bucketed by ink × generation tier)
        for (let c = 0; c < 2; c++) {
          for (let tr = 0; tr < TIERS; tr++) {
            g.strokeStyle = coreCss[c][tr];
            g.lineWidth = wTier[tr];
            g.beginPath();
            for (let i = 0; i < POOL; i++) {
              const s = segs[i];
              if (!s.used || s.melt > 0 || s.ci !== c) continue;
              const tt = s.gen < TIERS ? s.gen : TIERS - 1;
              if (tt !== tr) continue;
              g.moveTo(s.x0, s.y0); g.lineTo(s.tx, s.ty);
            }
            g.stroke();
          }
        }
        // melting frost — drawn individually so it can fade on its own
        for (let i = 0; i < POOL; i++) {
          const s = segs[i];
          if (!s.used || s.melt <= 0) continue;
          const a = Math.max(0, 1 - s.melt), tt = s.gen < TIERS ? s.gen : TIERS - 1;
          g.strokeStyle = css(mix(s.ci ? LILc : SKYc, CREAMc, 0.4), 0.85 * a);
          g.lineWidth = Math.max(0.6, wTier[tt] * (0.5 + 0.5 * a));
          g.beginPath(); g.moveTo(s.x0, s.y0); g.lineTo(s.tx, s.ty); g.stroke();
        }
        // advancing frost front — a bright bead at each live tip
        g.fillStyle = css(CREAMc, 0.85);
        for (let i = 0; i < POOL; i++) {
          const s = segs[i];
          if (!s.used || s.melt > 0 || !s.grow || s.gen > 2) continue;
          g.beginPath(); g.arc(s.tx, s.ty, 1.5 * u, 0, TAU); g.fill();
        }
        // faint shimmer — twinkles that persist once growth has capped out
        for (let i = 0; i < POOL; i += 5) {
          const s = segs[i];
          if (!s.used || s.melt > 0) continue;
          const tw = Math.sin(t * 2.2 + s.seed);
          if (tw > 0.55) {
            g.fillStyle = css(CREAMc, (tw - 0.55) * 0.8);
            g.beginPath(); g.arc(s.tx, s.ty, 1.3 * u, 0, TAU); g.fill();
          }
        }
        // cold breath under the hovering pointer — a "grab me" affordance
        if (hover) {
          g.strokeStyle = css(SKYc, 0.16 + 0.08 * Math.sin(t * 3));
          g.lineWidth = 2 * u;
          g.beginPath(); g.arc(hover.x, hover.y, m * 0.05 * (1 + 0.06 * Math.sin(t * 3)), 0, TAU); g.stroke();
        }
      },
      down(p) { hover = null; lastSeed = { x: p.x, y: p.y }; seedDrag(p.x, p.y); },
      move(p) {
        if (p.held) {
          hover = null;
          if (lastSeed) {
            const dx = p.x - lastSeed.x, dy = p.y - lastSeed.y, gap = m * 0.06;
            if (dx * dx + dy * dy > gap * gap) { seedDrag(p.x, p.y); lastSeed = { x: p.x, y: p.y }; }
          }
        } else hover = { x: p.x, y: p.y };
      },
      up() { lastSeed = null; },
      dbl(p) {
        waves.push({ x: p.x, y: p.y, r: m * 0.02, maxR: Math.hypot(env.w, env.h) * 1.05 });
        if (waves.length > 4) waves.shift();
      },
      leave() { hover = null; lastSeed = null; },
      resize() {
        let rx = Math.max(1, env.w) / lastW, ry = Math.max(1, env.h) / lastH;
        if (!isFinite(rx) || rx <= 0) rx = 1;
        if (!isFinite(ry) || ry <= 0) ry = 1;
        const sc = Math.sqrt(rx * ry);
        for (let i = 0; i < POOL; i++) {
          const s = segs[i];
          if (!s.used) continue;
          s.x0 *= rx; s.y0 *= ry; s.len *= sc; s.tgt *= sc; s.node *= sc; s.gap *= sc;
          s.tx = s.x0 + s.cx * s.len; s.ty = s.y0 + s.cy * s.len;
        }
        for (let wi = 0; wi < waves.length; wi++) {
          waves[wi].x *= rx; waves[wi].y *= ry; waves[wi].r *= sc; waves[wi].maxR *= sc;
        }
        lastSeed = null; hover = null;
        metrics();
      },
    };
  },
});
