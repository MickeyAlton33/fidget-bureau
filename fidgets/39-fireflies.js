/* № 39 — Fireflies. A swarm of soft amber sparks drifting in the dark, each
   blinking on its own phase. Left alone they fall into unison (mean-field
   Kuramoto — nudge every phase toward the swarm's mean), breathe apart, and
   re-sync. Hover and they gather to your pointer and pulse together; flick
   fast and they scatter, their blinking shattering, then regroup. */
F.register({
  n: 39, id: 'fireflies', cat: 'critters',
  title: 'Fireflies', hint: 'Hold still — they gather and blink in sync',
  make(env) {
    const { g, inks } = env;
    const TAU = Math.PI * 2, N = 100, RG = 30;
    const OBASE = 3.4, OSPREAD = 0.24;          // natural blink rate + spread
    const SZMIN = 7, SZMAX = 14;
    const KBASE = 1.4, KAMP = 1.1, KW = 0.4;    // coupling breathes in/out of sync
    const DRAG = 0.5, WSTR = 26, WALL = 6, CENT = 0.05;
    const RING = 24, ATTRACT = 1.6, MAXPULL = 130;
    const SCATTER_TH = 820, RELAX = 1.25, COOLDOWN = 0.33;
    const BASEGLOW = 0.07, FLASH = 0.85;

    const X = new Float32Array(N), Y = new Float32Array(N);
    const VX = new Float32Array(N), VY = new Float32Array(N);
    const PH = new Float32Array(N), OM = new Float32Array(N);
    const SZ = new Float32Array(N), BR = new Float32Array(N);
    const WA = new Float32Array(N), WB = new Float32Array(N);
    const WP = new Float32Array(N), WQ = new Float32Array(N);
    const TN = new Uint8Array(N);

    let px = env.w / 2, py = env.h / 2, lastpx = px, lastpy = py;
    let active = false, startle = 0, syncBoost = 0, scatterCD = 0;

    function rgb(s) {
      return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    }
    function glow(hex) {                          // one reusable bloom per tint
      const c = rgb(hex);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, RG);
      gr.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.95)');
      gr.addColorStop(0.22, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.42)');
      gr.addColorStop(0.55, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.12)');
      gr.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
      return gr;
    }
    const GRAD = [glow(inks[0]), glow(inks[5]), glow(inks[1])]; // amber, cream, coral

    (function seed() {
      const w = env.w, h = env.h;
      for (let i = 0; i < N; i++) {
        X[i] = Math.random() * w; Y[i] = Math.random() * h;
        VX[i] = (Math.random() - 0.5) * 20; VY[i] = (Math.random() - 0.5) * 20;
        PH[i] = Math.random() * TAU;
        OM[i] = OBASE * (1 + OSPREAD * (Math.random() * 2 - 1));
        SZ[i] = SZMIN + Math.random() * (SZMAX - SZMIN);
        BR[i] = 0.7 + Math.random() * 0.5;
        WA[i] = 0.15 + Math.random() * 0.4; WB[i] = 0.15 + Math.random() * 0.4;
        WP[i] = Math.random() * TAU; WQ[i] = Math.random() * TAU;
        const r = Math.random();
        TN[i] = r < 0.6 ? 0 : r < 0.94 ? 1 : 2;
      }
    })();

    return {
      draw(t, dt) {
        const w = env.w, h = env.h, m = Math.min(w, h);

        // pointer speed from per-frame delta (robust, uses dt) + clamped target
        const inv = dt > 1e-6 ? 1 / dt : 0;
        const pspeed = Math.hypot(px - lastpx, py - lastpy) * inv;
        lastpx = px; lastpy = py;
        const tx = px < 0 ? 0 : px > w ? w : px;
        const ty = py < 0 ? 0 : py > h ? h : py;

        startle = Math.max(0, startle - dt / RELAX);
        syncBoost = Math.max(0, syncBoost - dt / 1.2);
        scatterCD = Math.max(0, scatterCD - dt);

        // fast flick: shove fireflies outward and shatter their sync
        if (active && pspeed > SCATTER_TH && scatterCD <= 0) {
          for (let i = 0; i < N; i++) {
            const dx = X[i] - tx, dy = Y[i] - ty, d = Math.hypot(dx, dy) + 1e-6;
            const k = 40 + 240 * Math.exp(-d / (0.45 * m));
            VX[i] += dx / d * k + (Math.random() - 0.5) * 60;
            VY[i] += dy / d * k + (Math.random() - 0.5) * 60;
            PH[i] += (Math.random() - 0.5) * 1.6;
          }
          startle = 1; scatterCD = COOLDOWN;
        }

        // ---- Kuramoto order parameter (single global mean phase, O(n)) ----
        let sc = 0, ss = 0;
        for (let i = 0; i < N; i++) { sc += Math.cos(PH[i]); ss += Math.sin(PH[i]); }
        sc /= N; ss /= N;
        const R = Math.hypot(sc, ss);            // coherence 0..1
        const psi = Math.atan2(ss, sc);          // mean phase
        let K = KBASE + KAMP * Math.sin(t * KW) + syncBoost + (active ? 0.6 : 0);
        if (K < 0) K = 0;

        // ---- wander, pointer forces, blink coupling ----
        const cx = w / 2, cy = h / 2, M = 0.1 * m;
        const drag = Math.pow(DRAG, dt), vmax = 140 + 260 * startle;
        for (let i = 0; i < N; i++) {
          let xi = X[i], yi = Y[i];
          let ax = Math.sin(t * WA[i] + WP[i]) * WSTR + (cx - xi) * CENT;
          let ay = Math.cos(t * WB[i] + WQ[i]) * WSTR + (cy - yi) * CENT;
          if (xi < M) ax += (M - xi) * WALL; else if (xi > w - M) ax -= (xi - (w - M)) * WALL;
          if (yi < M) ay += (M - yi) * WALL; else if (yi > h - M) ay -= (yi - (h - M)) * WALL;
          if (active) {
            const dx = tx - xi, dy = ty - yi, d = Math.hypot(dx, dy) + 1e-6;
            let pull = (d - RING) * ATTRACT;
            if (pull > MAXPULL) pull = MAXPULL; else if (pull < -MAXPULL) pull = -MAXPULL;
            pull *= (1 - startle);
            ax += dx / d * pull; ay += dy / d * pull;
          }
          let vx = (VX[i] + ax * dt) * drag, vy = (VY[i] + ay * dt) * drag;
          const sp = Math.hypot(vx, vy);
          if (sp > vmax) { const f = vmax / sp; vx *= f; vy *= f; }
          VX[i] = vx; VY[i] = vy;
          xi += vx * dt; yi += vy * dt;
          if (xi < -40) xi = -40; else if (xi > w + 40) xi = w + 40;
          if (yi < -40) yi = -40; else if (yi > h + 40) yi = h + 40;
          X[i] = xi; Y[i] = yi;
          PH[i] += (OM[i] + K * R * Math.sin(psi - PH[i])) * dt;
        }

        // ---- render: translucent veil for glow trails, additive blooms ----
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(20,16,13,0.34)';
        g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < N; i++) {
          let fl = Math.cos(PH[i]) * 0.5 + 0.5;    // 0..1, peak at phase 0
          fl = fl * fl * fl;                       // sharpen to a brief flash
          let a = BASEGLOW + fl * FLASH * BR[i];
          if (a > 1) a = 1;
          const s = SZ[i] * (0.5 + fl * 0.95);     // dim ember small, flash blooms
          g.globalAlpha = a;
          g.fillStyle = GRAD[TN[i]];
          g.save();
          g.translate(X[i], Y[i]);
          const k = s / RG;
          g.scale(k, k);
          g.fillRect(-RG, -RG, RG * 2, RG * 2);
          g.restore();
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      },
      down(p) {
        active = true; px = p.x; py = p.y; lastpx = p.x; lastpy = p.y;
        syncBoost = 1.4;                            // a press summons them into sync
      },
      move(p) {
        if (!active) { lastpx = p.x; lastpy = p.y; } // no false flick on re-entry
        active = true; px = p.x; py = p.y;
      },
      leave() { active = false; },
      resize(w, h) {
        for (let i = 0; i < N; i++) {
          X[i] = Math.min(w - 2, Math.max(2, X[i]));
          Y[i] = Math.min(h - 2, Math.max(2, Y[i]));
        }
        px = Math.min(w, Math.max(0, px)); py = Math.min(h, Math.max(0, py));
        lastpx = px; lastpy = py;
      },
    };
  },
});
