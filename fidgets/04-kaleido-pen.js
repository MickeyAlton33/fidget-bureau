/* № 04 — Kaleidoscope pen. Scribble in one wedge and the mirrors bloom it
   into a full mandala. Ink drifts through the palette as you draw; leave it
   alone and an invisible pen keeps doodling so the pattern never dies. */
F.register({
  n: 4, id: 'kaleido-pen', cat: 'optics',
  title: 'Kaleidoscope pen', hint: 'Scribble — the mirrors do the rest. Double-click: more mirrors',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const CAP = 240, LIFE = 2.6, IDLE = 1.5;
    const hex = (c) => [
      parseInt(c.slice(1, 3), 16),
      parseInt(c.slice(3, 5), 16),
      parseInt(c.slice(5, 7), 16),
    ];
    const pal = inks.map(hex);
    const fade = `rgba(${hex(bg).join(',')},0.07)`;
    const KS = [4, 6, 8, 12];
    let ki = 2, k = KS[ki];
    let rot = [];              // precomputed [cos, sin] per mirror sector
    function setK(n) {
      k = n; rot = [];
      for (let j = 0; j < k; j++) rot.push([Math.cos(j * TAU / k), Math.sin(j * TAU / k)]);
    }
    setK(k);

    const segs = [];           // {x, y, px, py, ink:[r,g,b], w, age} — center-relative
    let inkPos = Math.random() * 6;
    let now = 0;               // draw-loop clock, readable from handlers
    let lastActive = -9;       // born idle → the ghost pen wakes on frame one
    let last = null;           // user pen tail
    let auto = null;           // autonomous pen tail
    let flash = 0, wipe = false;

    function inkAt(pos) {
      const i = Math.floor(pos) % 6, f = pos - Math.floor(pos);
      const a = pal[i], b = pal[(i + 1) % 6];
      return [
        a[0] + (b[0] - a[0]) * f | 0,
        a[1] + (b[1] - a[1]) * f | 0,
        a[2] + (b[2] - a[2]) * f | 0,
      ];
    }
    function addSeg(px, py, x, y) {
      const len = Math.hypot(x - px, y - py);
      const w = Math.max(1.5, Math.min(5, 5.2 - len * 0.18)); // slow = fat, fast = thin
      segs.push({ x, y, px, py, ink: inkAt(inkPos), w, age: 0 });
      inkPos += len * 0.006;   // ink strolls through the palette as you draw
      if (segs.length > CAP) segs.shift();
    }
    function rel(p) { return [p.x - env.w / 2, p.y - env.h / 2]; }

    return {
      draw(t, dt) {
        now = t;
        if (wipe) { g.fillStyle = bg; g.fillRect(0, 0, env.w, env.h); wipe = false; }
        else { g.fillStyle = fade; g.fillRect(0, 0, env.w, env.h); }

        // ghost pen: sum-of-sines wander after a quiet spell
        if (t - lastActive > IDLE) {
          const R = 0.36 * Math.min(env.w, env.h);
          const ax = R * (0.62 * Math.sin(0.43 * t + 1.3) + 0.40 * Math.sin(0.97 * t + 0.5));
          const ay = R * (0.62 * Math.sin(0.53 * t) + 0.40 * Math.sin(1.21 * t + 2.1));
          if (auto) addSeg(auto[0], auto[1], ax, ay);
          auto = [ax, ay];
        } else auto = null;

        for (let i = 0; i < segs.length; i++) segs[i].age += dt;
        while (segs.length && segs[0].age > LIFE) segs.shift();

        const cx = env.w / 2, cy = env.h / 2;
        g.lineCap = 'round';
        for (let i = 0; i < segs.length; i++) {
          const s = segs[i], q = s.age / LIFE;
          g.strokeStyle =
            `rgba(${s.ink[0]},${s.ink[1]},${s.ink[2]},${Math.min(1, 1.5 * (1 - q))})`;
          g.lineWidth = s.w;
          g.beginPath();
          for (let j = 0; j < k; j++) {
            const c = rot[j][0], sn = rot[j][1];
            g.moveTo(cx + s.px * c - s.py * sn, cy + s.px * sn + s.py * c);
            g.lineTo(cx + s.x * c - s.y * sn, cy + s.x * sn + s.y * c);
            // mirror twin (y negated, then rotated)
            g.moveTo(cx + s.px * c + s.py * sn, cy + s.px * sn - s.py * c);
            g.lineTo(cx + s.x * c + s.y * sn, cy + s.x * sn - s.y * c);
          }
          g.stroke();
        }

        // mirror-count change: cream veil + the new mirror lines, fading fast
        if (flash > 0.01) {
          const Rm = Math.hypot(env.w, env.h) / 2;
          g.globalAlpha = flash * 0.5;
          g.strokeStyle = inks[5];
          g.lineWidth = 1.5;
          g.beginPath();
          for (let j = 0; j < k; j++) {
            g.moveTo(cx, cy);
            g.lineTo(cx + Rm * rot[j][0], cy + Rm * rot[j][1]);
          }
          g.stroke();
          g.globalAlpha = flash * 0.15;
          g.fillStyle = inks[5];
          g.fillRect(0, 0, env.w, env.h);
          g.globalAlpha = 1;
          flash = Math.max(0, flash - dt * 3);
        }
      },
      down(p) {
        lastActive = now;
        last = rel(p);
        addSeg(last[0] - 0.4, last[1], last[0], last[1]); // instant fat dot × mirrors
      },
      move(p) {
        if (!p.held) return;
        lastActive = now;
        const [x, y] = rel(p);
        if (!last) { last = [x, y]; return; }
        const d = Math.hypot(x - last[0], y - last[1]);
        if (d < 1.6) return;                    // ignore jitter
        if (d > 70) { last = [x, y]; return; }  // wild sweep: jump, don't chord
        addSeg(last[0], last[1], x, y);
        last = [x, y];
      },
      up() { lastActive = now; last = null; },
      dbl() {
        ki = (ki + 1) % KS.length;
        setK(KS[ki]);
        wipe = true; flash = 1;
      },
    };
  },
});
