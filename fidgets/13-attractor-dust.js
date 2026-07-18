/* № 13 — Attractor dust. A Peter de Jong map orbit rendered as living dust:
   x' = sin(a·y) − cos(b·x), y' = sin(c·x) − cos(d·y). The pointer bends the
   map's parameters, so gliding slowly morphs one chaotic creature into the
   next; a click freezes the fade and burns the current one in bright. */
F.register({
  n: 13, id: 'attractor-dust', cat: 'optics',
  title: 'Attractor dust', hint: 'Glide slowly — every position is a new creature',
  make(env) {
    const { g, inks, bg } = env;
    const ITER = 3500, HALF = 1925;     // cream gets slightly more dust than sky
    let a = 1.4, b = -2.3, c = 2.4, d = -2.1;   // classic de Jong to open on
    let ox = 0.1, oy = 0.1;             // orbit continues frame to frame
    let px = 0.5, py = 0.5;             // normalized pointer 0..1
    let hover = false;
    let mix = 0;                        // 0 = idle wander, 1 = pointer rules
    let now = 0, lastTouch = -9;
    let freezeUntil = -1;               // while t < this, skip the fade
    let clickX = 0, clickY = 0;
    let idleU = Math.random() * Math.PI * 2;
    let needClear = true;

    function aim(p) {
      const w = Math.max(1, env.w), h = Math.max(1, env.h);
      px = Math.min(1, Math.max(0, p.x / w));
      py = Math.min(1, Math.max(0, p.y / h));
    }

    return {
      draw(t, dt) {
        now = t;
        const w = env.w, h = env.h;
        const frozen = t < freezeUntil;

        // Idle: parameters trace a slow closed lemniscate through
        // known-nice territory (a ~ -2..2, b ~ -2.4..1.6). The idle clock
        // pauses while frozen so a captured creature stays crisp.
        if (!frozen) idleU += dt * 0.19;
        const ia = 2.0 * Math.sin(idleU);
        const ib = -0.4 + 2.0 * Math.sin(2 * idleU + 1.1);

        // Pointer targets blended over the idle path by an eased mix, so
        // leaving the card melts the creature back into its wander.
        const want = (hover || now - lastTouch < 2.0) ? 1 : 0;
        mix += (want - mix) * (1 - Math.exp(-dt * 3.5));
        const ta = ia + ((px * 2 - 1) * 2.6 - ia) * mix;
        const tb = ib + ((py * 2 - 1) * 2.6 - ib) * mix;

        // Ease a/b toward targets (~0.04/frame); c/d trail them at half
        // rate with fixed offsets so the family stays gorgeous.
        const k1 = 1 - Math.pow(0.96, dt * 60);
        const k2 = 1 - Math.pow(0.98, dt * 60);
        a += (ta - a) * k1;
        b += (tb - b) * k1;
        c += (a * 0.7 - 1.4 - c) * k2;
        d += (b * 0.7 + 0.8 - d) * k2;

        // Translucent fade so dust ghosts and morphs — skipped while a
        // click has frozen it, letting the creature burn in bright.
        if (needClear) {
          g.fillStyle = bg;
          g.fillRect(0, 0, w, h);
          needClear = false;
        } else if (!frozen) {
          g.globalAlpha = 0.1;
          g.fillStyle = bg;
          g.fillRect(0, 0, w, h);
          g.globalAlpha = 1;
        }

        // Continue the orbit, plotting 1×1 dust mapped from attractor
        // space [-2.1, 2.1]² to the card with a margin.
        const mrg = Math.min(w, h) * 0.07;
        const cx = w * 0.5, cy = h * 0.5;
        const sx = (w * 0.5 - mrg) / 2.1, sy = (h * 0.5 - mrg) / 2.1;
        let x = ox, y = oy;
        g.globalAlpha = frozen ? 0.3 : 0.2;
        g.fillStyle = inks[5];                    // cream
        for (let i = 0; i < ITER; i++) {
          if (i === HALF) g.fillStyle = inks[3];  // sky
          const nx = Math.sin(a * y) - Math.cos(b * x);
          y = Math.sin(c * x) - Math.cos(d * y);
          x = nx;
          g.fillRect(cx + x * sx, cy + y * sy, 1, 1);
        }
        ox = x; oy = y;
        g.globalAlpha = 1;

        // Click feedback: one quick ring where the burn-in started.
        const age = 2.5 - (freezeUntil - t);
        if (frozen && age < 0.45) {
          g.globalAlpha = 0.5 * (1 - age / 0.45);
          g.strokeStyle = inks[3];
          g.lineWidth = 2.5;
          g.beginPath();
          g.arc(clickX, clickY, 8 + age * 150, 0, Math.PI * 2);
          g.stroke();
          g.globalAlpha = 1;
        }
      },
      down(p) {
        hover = true; lastTouch = now; aim(p);
        freezeUntil = now + 2.5;
        clickX = p.x; clickY = p.y;
      },
      move(p) { hover = true; lastTouch = now; aim(p); },
      up() { lastTouch = now; },
      leave() { hover = false; },
      resize() { needClear = true; },
    };
  },
});
