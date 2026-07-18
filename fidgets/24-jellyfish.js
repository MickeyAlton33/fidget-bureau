/* № 24 — Jellyfish. A translucent moon jelly drifting in dark water. Its domed
   bell contracts on a slow rhythm to jet itself along (squash on the beat,
   stretch as it relaxes), gravity sinks it gently between pulses, and trailing
   tentacles + frilly oral arms lag behind on a lag-spring like wet cloth. Drag
   and it turns to chase the pointer, pulsing harder each beat; let go and it
   eases back to a hypnotic idle bob. Springs drive the bell, the heading, and
   the tentacle lag — nothing snaps. */
F.register({
  n: 24, id: 'jellyfish', cat: 'critters',
  title: 'Jellyfish', hint: 'Drag to guide it — watch it pulse',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2, PI = Math.PI;
    const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
    const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const L = rgbOf(inks[4]);   // lilac  — bell body
    const S = rgbOf(inks[3]);   // sky    — tentacles, ribs, rim
    const Cr = rgbOf(inks[5]);  // cream  — highlights, bioluminescent dots
    const col = (c, a) => { a = a < 0 ? 0 : (a > 1 ? 1 : a); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };

    // --- creature state (springs) ---
    let px = 0, py = 0, vx = 0, vy = 0;        // bell centre + velocity (px, px/s)
    let ang = -PI / 2, angV = 0;               // heading: bell apex points this way
    let sq = 0, sqv = 0;                       // squash spring: >0 squash (wide/flat), <0 stretch
    let flash = 0;                             // beat glow, decays after each pulse
    let excite = 0;                            // 0 idle .. 1 chasing the pointer
    let swx = 0, swy = 0, swvx = 0, swvy = 0;  // tentacle lag-sway (world), a damped spring
    let beatClock = Math.random() * 0.7;       // phase toward the next pulse

    // --- interaction ---
    let dragging = false, tx = 0, ty = 0;

    // --- size-derived (rebuilt on resize) ---
    let m = 1, bw = 1, bh = 1, homeX = 0, homeY = 0;

    // --- transform scratch: local bell coords -> world (apex points along heading) ---
    let WX = 0, WY = 0, HX = 0, HY = 0, PX = 0, PY = 0;
    const toW = (lx, ly) => { WX = px + lx * PX - ly * HX; WY = py + lx * PY - ly * HY; };
    const undLy = (u, bhS) => -0.32 * bhS * Math.sin(PI * u) + 0.05 * bhS * Math.sin(u * 7 * PI);

    // --- seeded-once arrays (no random in layout -> no jump on resize) ---
    const NT = 9;                              // marginal tentacles
    const tPos = new Float32Array(NT), tLen = new Float32Array(NT), tPh = new Float32Array(NT);
    const tWv = new Float32Array(NT), tAmp = new Float32Array(NT), tSpd = new Float32Array(NT), tCurl = new Float32Array(NT);
    const NO = 4;                              // oral arms
    const oPos = new Float32Array(NO), oPh = new Float32Array(NO), oWv = new Float32Array(NO);
    const NM = 24;                             // drifting marine-snow motes (normalised coords)
    const mX = new Float32Array(NM), mY = new Float32Array(NM), mR = new Float32Array(NM), mS = new Float32Array(NM), mA = new Float32Array(NM);
    // oral-arm ribbon scratch (allocated once)
    const cxA = new Float32Array(12), cyA = new Float32Array(12), lxA = new Float32Array(12), lyA = new Float32Array(12), rxA = new Float32Array(12), ryA = new Float32Array(12);

    (function seed() {
      for (let i = 0; i < NT; i++) {
        tPos[i] = (i / (NT - 1)) * 1.7 - 0.85;
        tLen[i] = 0.85 + Math.random() * 0.45;
        tPh[i] = Math.random() * TAU;
        tWv[i] = 1.0 + Math.random() * 1.1;
        tAmp[i] = 0.035 + Math.random() * 0.03;
        tSpd[i] = 1.1 + Math.random() * 0.7;
        tCurl[i] = tPos[i] * 0.14 + (Math.random() - 0.5) * 0.08;   // graceful outward C-curve
      }
      for (let j = 0; j < NO; j++) {
        oPos[j] = (j / (NO - 1)) * 0.5 - 0.25;
        oPh[j] = Math.random() * TAU;
        oWv[j] = 1.6 + Math.random();
      }
      for (let k = 0; k < NM; k++) {
        mX[k] = Math.random(); mY[k] = Math.random();
        mR[k] = 0.6 + Math.random() * 1.6; mS[k] = 0.012 + Math.random() * 0.03; mA[k] = 0.05 + Math.random() * 0.12;
      }
    })();

    function layout() {
      m = Math.min(env.w, env.h);
      bw = 0.29 * m; bh = 0.30 * m;
      homeX = env.w * 0.5; homeY = env.h * 0.40;
      if (px === 0 && py === 0) { px = homeX; py = homeY; }
      px = clamp(px, 0.24 * m, env.w - 0.24 * m);
      py = clamp(py, 0.30 * m, env.h - 0.12 * m);
    }
    layout();

    function beat(strength) {
      sqv += 8 * strength;                                    // kick the squash spring
      flash = Math.min(1.5, flash + 0.8 * strength);
      const th = (0.55 + 0.95 * excite) * m * strength;       // propulsive jet along heading
      vx += Math.cos(ang) * th; vy += Math.sin(ang) * th;
    }

    return {
      draw(t, dt) {
        // ---- excitement follows the drag state ----
        excite += ((dragging ? 1 : 0) - excite) * (1 - Math.pow(0.02, dt));

        // ---- pulse clock: faster when chasing ----
        const rate = 0.52 + 0.55 * excite;   // beats/sec (~1.9s idle, ~0.9s chasing)
        beatClock += rate * dt;
        if (beatClock >= 1) { beatClock -= 1; beat(1); }

        // ---- squash spring (omega~9, zeta~0.5): squash on the beat, overshoot to stretch, settle ----
        sqv += (-81 * sq - 9 * sqv) * dt; sqv = clamp(sqv, -40, 40);
        sq += sqv * dt; sq = clamp(sq, -1.4, 1.4);
        flash *= Math.pow(0.1, dt);

        // ---- heading spring ----
        let tAng = dragging ? Math.atan2(ty - py, tx - px) : (-PI / 2 + 0.5 * Math.sin(t * 0.4));
        let da = tAng - ang; while (da > PI) da -= TAU; while (da < -PI) da += TAU;
        angV += (da * 40 - angV * 10) * dt; angV = clamp(angV, -9, 9); ang += angV * dt;

        // ---- position dynamics ----
        vy += 0.22 * m * dt;                                   // buoyant sink between pulses
        if (dragging) { vx += (tx - px) * 4 * dt; vy += (ty - py) * 4 * dt; }        // seek pointer
        else {                                                                       // home + gentle sway
          vx += (homeX - px) * 2.6 * dt; vy += (homeY - py) * 2.6 * dt;
          vx += Math.cos(t * 0.31) * 0.05 * m * dt;
        }
        const dc = Math.pow(0.16, dt); vx *= dc; vy *= dc;
        vx = clamp(vx, -6 * m, 6 * m); vy = clamp(vy, -6 * m, 6 * m);
        px += vx * dt; py += vy * dt;
        const mgx = 0.24 * m, mgt = 0.30 * m, mgb = 0.12 * m;
        if (px < mgx) { px = mgx; if (vx < 0) vx = 0; } else if (px > env.w - mgx) { px = env.w - mgx; if (vx > 0) vx = 0; }
        if (py < mgt) { py = mgt; if (vy < 0) vy = 0; } else if (py > env.h - mgb) { py = env.h - mgb; if (vy > 0) vy = 0; }

        // ---- tentacle lag-sway spring (tips stream opposite recent motion) ----
        const tsx = -0.14 * vx, tsy = -0.14 * vy;
        swvx += ((tsx - swx) * 36 - swvx * 6) * dt; swvy += ((tsy - swy) * 36 - swvy * 6) * dt;
        swx += swvx * dt; swy += swvy * dt;
        swx = clamp(swx, -0.6 * m, 0.6 * m); swy = clamp(swy, -0.6 * m, 0.6 * m);

        // ---- frame vectors ----
        HX = Math.cos(ang); HY = Math.sin(ang); PX = HY; PY = -HX;
        const W = env.w, Hh = env.h;
        const bwS = bw * (1 + 0.20 * sq) * (1 + 0.03 * Math.sin(t * 1.1));
        const bhS = bh * (1 - 0.16 * sq) * (1 + 0.03 * Math.sin(t * 1.1 + 1));

        g.lineJoin = 'round'; g.lineCap = 'round';

        // ---- water ----
        g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
        for (let k = 0; k < NM; k++) {
          mY[k] += mS[k] * dt; if (mY[k] > 1) mY[k] -= 1;
          g.fillStyle = col(S, mA[k] * 0.6);
          g.beginPath(); g.arc(mX[k] * W, mY[k] * Hh, mR[k], 0, TAU); g.fill();
        }

        // ---- glow halo behind the bell ----
        const hr = bwS * 2.3;
        const rg = g.createRadialGradient(px, py, 0, px, py, hr);
        rg.addColorStop(0, col(L, 0.18 + 0.16 * flash));
        rg.addColorStop(0.45, col(S, 0.07 + 0.06 * flash));
        rg.addColorStop(1, col(S, 0));
        g.fillStyle = rg; g.fillRect(px - hr, py - hr, hr * 2, hr * 2);

        // ---- oral arms (frilly ribbons, behind the bell) ----
        for (let j = 0; j < NO; j++) {
          const K = 10;
          toW(bw * oPos[j] * 0.5, -0.15 * bh);
          const rx = WX, ry = WY;
          const Ln = (0.34 + 0.06 * excite) * m;
          for (let k = 0; k <= K; k++) {
            const sN = k / K, s2 = sN * sN;
            let x = rx - HX * (Ln * sN), y = ry - HY * (Ln * sN);
            const wob = Math.sin(t * 1.3 + oPh[j] + sN * oWv[j] * TAU) * 0.075 * m * Math.sin(PI * sN * 0.9);
            x += PX * wob + swx * s2 * 1.1 + Math.sin(t * 0.35 + j) * 0.04 * m * s2;
            y += PY * wob + swy * s2 * 1.1 + 0.12 * m * s2;
            cxA[k] = x; cyA[k] = y;
          }
          for (let k = 0; k <= K; k++) {
            const sN = k / K;
            const k1 = k < K ? k + 1 : K, k0 = k > 0 ? k - 1 : 0;
            let tX = cxA[k1] - cxA[k0], tY = cyA[k1] - cyA[k0];
            const tl = Math.hypot(tX, tY) + 1e-6; tX /= tl; tY /= tl;
            const nx = -tY, ny = tX;
            const hw = (1 - sN) * 0.055 * m * (1 + 0.4 * Math.sin(sN * 6 + oPh[j] + t * 1.2)) + 0.5;
            lxA[k] = cxA[k] + nx * hw; lyA[k] = cyA[k] + ny * hw;
            rxA[k] = cxA[k] - nx * hw; ryA[k] = cyA[k] - ny * hw;
          }
          g.beginPath(); g.moveTo(lxA[0], lyA[0]);
          for (let k = 1; k <= K; k++) g.lineTo(lxA[k], lyA[k]);
          for (let k = K; k >= 0; k--) g.lineTo(rxA[k], ryA[k]);
          g.closePath();
          g.fillStyle = col(L, 0.26); g.fill();
        }

        // ---- marginal tentacles (behind the bell): trail + undulate + lag-sway ----
        for (let i = 0; i < NT; i++) {
          const K = 14;
          const u = tPos[i] * 0.5 + 0.5;
          toW(bw * tPos[i] * (1 - 0.12 * Math.max(0, sq)), undLy(u, bh) * 0.7);
          const rootX = WX, rootY = WY;
          let ppx = rootX, ppy = rootY;
          const Ln = tLen[i] * 0.5 * m * (1 + 0.25 * excite);
          const amp = tAmp[i] * m, curl = tCurl[i] * m;
          const tc = (i % 3 === 0) ? L : S;
          for (let k = 1; k <= K; k++) {
            const sN = k / K, s2 = sN * sN;
            const env2 = Math.sin(PI * sN * 0.85);                          // fades wobble at root & tip
            const wob = Math.sin(t * tSpd[i] + tPh[i] + sN * tWv[i] * TAU) * amp * env2 + curl * s2;
            const x = rootX - HX * (Ln * sN) + PX * wob + swx * s2 + Math.sin(t * 0.3 + i) * 0.04 * m * s2;
            const y = rootY - HY * (Ln * sN) + PY * wob + swy * s2 + 0.10 * m * s2;
            g.strokeStyle = col(tc, (1 - sN) * (1 - sN) * 0.55 + 0.03);
            g.lineWidth = (1 - sN) * 2.6 + 0.5;
            g.beginPath(); g.moveTo(ppx, ppy); g.lineTo(x, y); g.stroke();
            ppx = x; ppy = y;
          }
        }

        // ---- bell body (layered translucent dome) ----
        g.beginPath();
        const ST = 24;
        for (let k = 0; k <= ST; k++) {
          const a = PI - (k / ST) * PI;
          toW(bwS * Math.cos(a), -bhS * Math.sin(a));
          if (k === 0) g.moveTo(WX, WY); else g.lineTo(WX, WY);
        }
        const SB = 18;
        for (let k = 1; k <= SB; k++) {
          const uu = k / SB;
          toW(bwS * (1 - 2 * uu), undLy(uu, bhS));
          g.lineTo(WX, WY);
        }
        g.closePath();
        toW(0, -bhS); const ax = WX, ay = WY; toW(0, 0); const rxc = WX, ryc = WY;
        const bgrad = g.createLinearGradient(ax, ay, rxc, ryc);
        bgrad.addColorStop(0, col(L, 0.52));
        bgrad.addColorStop(0.6, col(L, 0.30));
        bgrad.addColorStop(1, col(S, 0.14));
        g.fillStyle = bgrad; g.fill();

        // nested inner arcs — glassy depth
        for (const scv of [0.78, 0.55]) {
          g.beginPath();
          for (let k = 0; k <= ST; k++) {
            const a = PI - (k / ST) * PI;
            toW(bwS * scv * Math.cos(a), -bhS * scv * Math.sin(a) - bhS * 0.06);
            if (k === 0) g.moveTo(WX, WY); else g.lineTo(WX, WY);
          }
          g.strokeStyle = col(Cr, 0.1); g.lineWidth = 2; g.stroke();
        }
        // radial ribs
        for (let r = 0; r < 7; r++) {
          const f = r / 6;
          toW(bwS * (1 - 2 * f) * 0.28, -bhS * 0.62); const x1 = WX, y1 = WY;
          toW(bwS * (1 - 2 * f), undLy(f, bhS)); const x2 = WX, y2 = WY;
          g.strokeStyle = col(S, 0.16); g.lineWidth = 1.6;
          g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        }
        // four-leaf gonads
        for (let q = 0; q < 4; q++) {
          const aa = (q / 4) * TAU + TAU / 8;
          toW(Math.cos(aa) * bwS * 0.28, -bhS * 0.42 + Math.sin(aa) * bhS * 0.16);
          g.strokeStyle = col(Cr, 0.13); g.lineWidth = 2;
          g.beginPath(); g.ellipse(WX, WY, bwS * 0.12, bhS * 0.09, ang, 0, TAU); g.stroke();
        }
        // glossy apex highlight
        toW(-bwS * 0.12, -bhS * 0.72);
        g.fillStyle = col(Cr, 0.22);
        g.beginPath(); g.ellipse(WX, WY, bwS * 0.16, bhS * 0.12, ang, 0, TAU); g.fill();
        // bright dome edge
        g.beginPath();
        for (let k = 0; k <= ST; k++) {
          const a = PI - (k / ST) * PI;
          toW(bwS * Math.cos(a), -bhS * Math.sin(a));
          if (k === 0) g.moveTo(WX, WY); else g.lineTo(WX, WY);
        }
        g.strokeStyle = col(Cr, 0.28); g.lineWidth = 2.2; g.stroke();

        // ---- scalloped rim margin + bioluminescent dots ----
        g.beginPath();
        for (let k = 0; k <= SB; k++) {
          const uu = k / SB;
          toW(bwS * (1 - 2 * uu), undLy(uu, bhS));
          if (k === 0) g.moveTo(WX, WY); else g.lineTo(WX, WY);
        }
        g.strokeStyle = col(S, 0.34); g.lineWidth = 2.4; g.stroke();
        const dots = 11;
        for (let d = 0; d < dots; d++) {
          const uu = d / (dots - 1);
          toW(bwS * (1 - 2 * uu), undLy(uu, bhS));
          g.fillStyle = col(Cr, 0.1 + 0.2 * flash);
          g.beginPath(); g.arc(WX, WY, 4.5 + 2.2 * flash, 0, TAU); g.fill();
          g.fillStyle = col(Cr, 0.35 + 0.5 * flash + 0.15 * Math.sin(t * 3 + d));
          g.beginPath(); g.arc(WX, WY, 1.9, 0, TAU); g.fill();
        }
      },

      down(p) {
        dragging = true;
        tx = clamp(p.x, 0, env.w); ty = clamp(p.y, 0, env.h);
        excite = Math.max(excite, 0.55);
        let da = Math.atan2(ty - py, tx - px) - ang;
        while (da > PI) da -= TAU; while (da < -PI) da += TAU;
        ang += da * 0.5; angV = clamp(angV + da * 4, -9, 9);   // immediate turn toward pointer
        beat(1.1); beatClock = 0;                              // and a pulse this instant
      },
      move(p) {
        if (p.held) { dragging = true; tx = clamp(p.x, 0, env.w); ty = clamp(p.y, 0, env.h); }
      },
      up() { dragging = false; },
      leave() { dragging = false; },
      dbl(p) {
        tx = clamp(p.x, 0, env.w); ty = clamp(p.y, 0, env.h);
        excite = Math.max(excite, 0.7); beat(1.8);             // startle burst
      },
      resize() { layout(); },
    };
  },
});
