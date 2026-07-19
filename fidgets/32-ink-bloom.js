/* № 32 — Ink bloom. A dark pane of still water. Tap and a drop of ink
   blooms — a burst of dye that expands, slows, softens and fades into
   wispy tendrils. Drag to stir: each stroke leaves decaying eddies that
   swirl the dye into ribbons. Left alone, the water is never still — a
   faint curl current drifts the dye and stray drops keep seeping in.
   Dye is ≤800 soft blobs (allocated once, recycled), advected by a
   procedural curl flow plus a handful of Gaussian vortices — no grid. */
F.register({
  n: 32, id: 'ink-bloom', cat: 'matter',
  title: 'Ink bloom', hint: 'Tap to drop ink — drag to stir',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const N = 800;

    // --- dye pool, allocated ONCE and recycled through a ring cursor ---
    const px = new Float32Array(N), py = new Float32Array(N);   // position (CSS px)
    const vx = new Float32Array(N), vy = new Float32Array(N);   // ejection velocity (decays)
    const age = new Float32Array(N), ttl = new Float32Array(N); // seconds lived / to live
    const rad = new Float32Array(N), alp = new Float32Array(N); // base blob radius / alpha
    const ink = new Uint8Array(N);                              // which sprite (0..pick-1)
    for (let i = 0; i < N; i++) { ttl[i] = 1; age[i] = 2; }     // start every slot dead
    let head = 0;

    // three inks — a different one per drop
    const pick = [1, 3, 2]; // coral, sky, mint
    let inkCursor = 0;

    // --- soft radial blob sprite, one per ink, pre-rendered ONCE ---
    const D = 64;
    function makeSprite(hex) {
      if (typeof OffscreenCanvas === 'undefined') return { width: D, height: D };
      const oc = new OffscreenCanvas(D, D);
      const c = oc.getContext('2d');
      const r = parseInt(hex.slice(1, 3), 16);
      const gg = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const grad = c.createRadialGradient(D / 2, D / 2, 0, D / 2, D / 2, D / 2);
      grad.addColorStop(0.00, `rgba(${r},${gg},${b},1)`);
      grad.addColorStop(0.45, `rgba(${r},${gg},${b},0.32)`);
      grad.addColorStop(1.00, `rgba(${r},${gg},${b},0)`);
      c.fillStyle = grad;
      c.fillRect(0, 0, D, D);
      return oc;
    }
    const sprites = pick.map(i => makeSprite(inks[i]));

    // translucent veil in the ground colour — decays old dye into soft trails
    const veil = `rgba(${parseInt(bg.slice(1, 3), 16)},${parseInt(bg.slice(3, 5), 16)},${parseInt(bg.slice(5, 7), 16)},0.24)`;

    // --- stirring eddies: a few decaying Gaussian vortices ---
    const MV = 14;
    const vcx = new Float32Array(MV), vcy = new Float32Array(MV);
    const vstr = new Float32Array(MV);                          // swirl (1/s), signed
    const vpx = new Float32Array(MV), vpy = new Float32Array(MV); // along-stroke push (px/s)
    const vinv = new Float32Array(MV), vcut = new Float32Array(MV); // falloff constants
    const vlife = new Float32Array(MV);
    function addVortex(x, y, str, pushx, pushy, sig) {
      let s = 0, m = vlife[0];
      for (let i = 1; i < MV; i++) if (vlife[i] < m) { m = vlife[i]; s = i; }
      const s2 = Math.max(1, sig * sig);
      vcx[s] = x; vcy[s] = y;
      vstr[s] = Math.max(-5, Math.min(5, str));
      vpx[s] = Math.max(-760, Math.min(760, pushx));
      vpy[s] = Math.max(-760, Math.min(760, pushy));
      vinv[s] = 1 / (2 * s2);
      vcut[s] = 6 * s2;
      vlife[s] = 1;
    }

    // --- release a bloom of dye ---
    function bloom(x, y, si, o) {
      const S = Math.min(env.w || 300, env.h || 300);
      const spd = o.spd * S, rBase = o.rad * S;
      for (let k = 0; k < o.count; k++) {
        const i = head; head = (head + 1) % N;
        const a = Math.random() * TAU;
        const tend = Math.random() < o.tendril;
        const u = Math.random();
        const sp = spd * (0.15 + u * u * (tend ? 1.6 : 0.95));
        const seed = rBase * 0.25 * Math.random();
        px[i] = x + Math.cos(a) * seed;
        py[i] = y + Math.sin(a) * seed;
        vx[i] = Math.cos(a) * sp;
        vy[i] = Math.sin(a) * sp;
        age[i] = 0;
        ttl[i] = o.ttl0 + Math.random() * o.ttl1 * (tend ? 1.5 : 1);
        rad[i] = rBase * (tend ? 0.55 : 1) * (0.7 + Math.random() * 0.6);
        alp[i] = (tend ? o.alpha * 0.6 : o.alpha) * (0.7 + Math.random() * 0.6);
        ink[i] = si;
      }
    }

    const TAP  = { count: 150, spd: 0.82, rad: 0.045, ttl0: 4.2, ttl1: 2.6, alpha: 0.095, tendril: 0.22 };
    const DBL  = { count: 210, spd: 0.72, rad: 0.058, ttl0: 5.5, ttl1: 3.2, alpha: 0.10,  tendril: 0.18 };
    const IDLE = { count: 55,  spd: 0.32, rad: 0.052, ttl0: 6.0, ttl1: 3.0, alpha: 0.055, tendril: 0.32 };
    const SEED = { count: 90,  spd: 0.50, rad: 0.050, ttl0: 5.5, ttl1: 3.2, alpha: 0.065, tendril: 0.30 };

    let drag = null;
    let nextIdle = 2.2;
    let lastW = env.w || 320, lastH = env.h || 320;

    // already blooming on first sight
    bloom((env.w || 320) * 0.40, (env.h || 320) * 0.42, 0, SEED);
    bloom((env.w || 320) * 0.63, (env.h || 320) * 0.60, 2, SEED);

    return {
      draw(t, dt) {
        const W = env.w, H = env.h;
        const invW = 1 / Math.max(1, W), invH = 1 / Math.max(1, H);
        const S = Math.min(W, H);
        lastW = W; lastH = H;

        // stray drops keep the water alive while it's left alone
        nextIdle -= dt;
        if (nextIdle <= 0) {
          inkCursor = (inkCursor + 1) % pick.length;
          bloom(0.12 * W + Math.random() * 0.76 * W,
                0.12 * H + Math.random() * 0.76 * H, inkCursor, IDLE);
          nextIdle = 3.4 + Math.random() * 3.2;
        }

        // eddies fade over ~2s
        for (let v = 0; v < MV; v++) if (vlife[v] > 0) {
          vlife[v] -= dt * 0.5; if (vlife[v] < 0) vlife[v] = 0;
        }

        // ambient curl current (divergence-free sum of shear waves)
        const p1 = t * 0.060, p2 = -t * 0.048 + 1.7, p3 = t * 0.075 + 4.0;
        const amb = S * 0.006;
        const decay = Math.pow(0.14, dt);   // ejection slowdown, same for all
        const cap = 0.6 * S;                 // clamp any single-frame leap

        // clear to a translucent veil, then build dye additively
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        g.fillStyle = veil;
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'lighter';

        for (let i = 0; i < N; i++) {
          let ag = age[i];
          if (ag >= ttl[i]) continue;         // dead slot
          ag += dt; age[i] = ag;
          if (ag >= ttl[i]) continue;         // just expired this frame

          const nx = px[i] * invW, ny = py[i] * invH;
          const c1 = Math.cos(2.6 * nx + 3.0 * ny + p1);
          const c2 = Math.cos(-3.4 * nx + 2.2 * ny + p2);
          const c3 = Math.cos(1.8 * nx - 3.6 * ny + p3);
          let fx = (3.0 * c1 + 2.2 * c2 - 3.6 * c3) * amb;
          let fy = (-2.6 * c1 + 3.4 * c2 - 1.8 * c3) * amb;

          for (let v = 0; v < MV; v++) {
            const lf = vlife[v];
            if (lf <= 0) continue;
            const dx = px[i] - vcx[v], dy = py[i] - vcy[v];
            const r2 = dx * dx + dy * dy;
            if (r2 > vcut[v]) continue;
            const w = lf * Math.exp(-r2 * vinv[v]);
            fx += w * (vstr[v] * -dy + vpx[v]);
            fy += w * (vstr[v] * dx + vpy[v]);
          }

          let sx = (fx + vx[i]) * dt, sy = (fy + vy[i]) * dt;
          const s2 = sx * sx + sy * sy;
          if (s2 > cap * cap) { const sc = cap / Math.sqrt(s2 + 1e-6); sx *= sc; sy *= sc; }
          px[i] += sx; py[i] += sy;
          vx[i] *= decay; vy[i] *= decay;

          const f = ag / ttl[i];
          const fin = ag < 0.14 ? ag / 0.14 : 1;
          let a = alp[i] * fin * Math.pow(1 - f, 1.25);
          if (a > 0.004) {
            const r = rad[i] * (0.55 + 1.7 * f);
            g.globalAlpha = a > 1 ? 1 : a;
            g.drawImage(sprites[ink[i]], px[i] - r, py[i] - r, r * 2, r * 2);
          }
        }

        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      },

      down(p) {
        drag = { x: p.x, y: p.y, dx: 0, dy: 0, sign: Math.random() < 0.5 ? 1 : -1, sx: p.x, sy: p.y };
        inkCursor = (inkCursor + 1) % pick.length;
        bloom(p.x, p.y, inkCursor, TAP);
      },

      move(p) {
        if (!p.held) return;
        if (!drag) { drag = { x: p.x, y: p.y, dx: 0, dy: 0, sign: Math.random() < 0.5 ? 1 : -1, sx: p.x, sy: p.y }; return; }
        const dx = p.x - drag.x, dy = p.y - drag.y;
        const cross = drag.dx * dy - drag.dy * dx;
        if (Math.abs(cross) > 4) drag.sign = cross > 0 ? 1 : -1;
        drag.dx = dx; drag.dy = dy; drag.x = p.x; drag.y = p.y;
        const S = Math.min(env.w || 300, env.h || 300);
        if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 0.035 * S) {
          const len = Math.hypot(dx, dy), il = 1 / (len + 1e-6);
          const pmag = Math.min(760, len * 13);
          addVortex(p.x, p.y, Math.min(5, len * 0.16) * drag.sign,
                    dx * il * pmag, dy * il * pmag, 0.20 * S);
          drag.sx = p.x; drag.sy = p.y;
        }
      },

      up() { drag = null; },
      leave() { drag = null; },

      dbl(p) {
        inkCursor = (inkCursor + 1) % pick.length;
        bloom(p.x, p.y, inkCursor, DBL);
        const S = Math.min(env.w || 300, env.h || 300);
        addVortex(p.x, p.y, (Math.random() < 0.5 ? 1 : -1) * 3.5, 0, 0, 0.26 * S);
      },

      resize(w, h) {
        const sx = w / (lastW + 1e-6), sy = h / (lastH + 1e-6);
        if (isFinite(sx) && isFinite(sy) && sx > 0 && sy > 0) {
          for (let i = 0; i < N; i++) { px[i] *= sx; py[i] *= sy; }
          for (let v = 0; v < MV; v++) { vcx[v] *= sx; vcy[v] *= sy; }
        }
        lastW = w; lastH = h;
      },
    };
  },
});
