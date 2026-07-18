/* № 10 — Wobble flan. A caramel flan on a little plate: 16 rim points laced
   with springs to their rest pose and to their neighbours, so any poke runs
   round the rim as a travelling jiggle. Grab it, stretch it rudely, let go —
   it snaps back and wobbles for ages. Eyes and mouth ride the jelly. */
F.register({
  n: 10, id: 'wobble-flan', cat: 'critters',
  title: 'Wobble flan', hint: 'Grab the flan. Stretch it. Let go. Repeat',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2, N = 16;
    const AMBER = inks[0], CREAM = inks[5];
    const RX = new Float32Array(N), RY = new Float32Array(N), KS = new Float32Array(N);
    const dx = new Float32Array(N), dy = new Float32Array(N);
    const vx = new Float32Array(N), vy = new Float32Array(N);
    const ax = new Float32Array(N), ay = new Float32Array(N);
    const px = new Float32Array(N), py = new Float32Array(N);
    const feat = [{ x: 0, y: 0, vx: 0, vy: 0 }, { x: 0, y: 0, vx: 0, vy: 0 }, { x: 0, y: 0, vx: 0, vy: 0 }];
    let m = 1, cx = 0, cy = 0, rxv = 1, ryv = 1, plateY = 0;
    let anchors = [[0, 0], [0, 0], [0, 0]];   // eyeL, eyeR, mouth rest spots
    let grab = null;                          // {i, offX, offY, pullX, pullY}
    let nextJig = 3.2, nextBlink = 2.2, blinkT = -9, open = 0;
    let sdx = 0, sdy = 0;                     // output slot of sample()

    function layout() {
      m = Math.min(env.w, env.h);
      cx = env.w / 2; cy = env.h * 0.44;
      rxv = 0.30 * m; ryv = 0.22 * m;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * TAU, s = Math.sin(a);
        RX[i] = cx + rxv * (1 - 0.16 * Math.max(0, -s)) * Math.cos(a);
        RY[i] = cy + ryv * (s > 0 ? 0.8 * s : s);
        KS[i] = 1 + 1.6 * Math.max(0, s) * s;    // base clings to the plate
      }
      plateY = cy + ryv * 0.8 + 0.05 * m;
      anchors = [[cx - rxv * 0.3, cy + ryv * 0.34], [cx + rxv * 0.3, cy + ryv * 0.34], [cx, cy + ryv * 0.62]];
    }
    layout();

    // inverse-distance sample of the rim displacement field at an interior spot
    function sample(x, y) {
      let sw = 1e-6, ox = 0, oy = 0;
      for (let i = 0; i < N; i++) {
        const w = 1 / ((x - RX[i]) * (x - RX[i]) + (y - RY[i]) * (y - RY[i]) + 0.004 * m * m);
        sw += w; ox += w * dx[i]; oy += w * dy[i];
      }
      sdx = ox / sw; sdy = oy / sw;
    }
    function jolt(gi, amp) {
      const ang = Math.random() * TAU;
      for (let i = 0; i < N; i++) {
        let d = Math.abs(i - gi); d = Math.min(d, N - d);
        const w = Math.exp(-d * d / 6.5);
        vx[i] += Math.cos(ang) * amp * w; vy[i] += Math.sin(ang) * amp * w * 0.8;
      }
    }
    function nearest(p) {
      let bi = 0, bd = 1e18;
      for (let i = 0; i < N; i++) {
        const d = (p.x - RX[i] - dx[i]) ** 2 + (p.y - RY[i] - dy[i]) ** 2;
        if (d < bd) { bd = d; bi = i; }
      }
      return [bi, Math.sqrt(bd)];
    }
    function blobPath() {
      g.beginPath();
      g.moveTo((px[N - 1] + px[0]) / 2, (py[N - 1] + py[0]) / 2);
      for (let i = 0; i < N; i++) {
        const nx = (i + 1) % N;
        g.quadraticCurveTo(px[i], py[i], (px[i] + px[nx]) / 2, (py[i] + py[nx]) / 2);
      }
      g.closePath();
    }
    function physics(t, dt) {
      const SUB = 4, h = dt / SUB;
      const K = 80, C = 340, DMP = 2.2, VC = 6 * m, DC = 1.35 * m;
      if (grab) {                               // pin grabbed point, keep flick velocity
        const iv = 1 / Math.max(dt, 1e-3);
        vx[grab.i] = Math.max(-VC, Math.min(VC, 0.5 * vx[grab.i] + 0.5 * (grab.pullX - dx[grab.i]) * iv));
        vy[grab.i] = Math.max(-VC, Math.min(VC, 0.5 * vy[grab.i] + 0.5 * (grab.pullY - dy[grab.i]) * iv));
        dx[grab.i] = grab.pullX; dy[grab.i] = grab.pullY;
      }
      for (let s = 0; s < SUB; s++) {
        for (let i = 0; i < N; i++) {
          const pv = (i + N - 1) % N, nx = (i + 1) % N;
          let fx = -K * KS[i] * dx[i] + C * (dx[pv] + dx[nx] - 2 * dx[i]) - DMP * vx[i];
          let fy = -K * KS[i] * dy[i] + C * (dy[pv] + dy[nx] - 2 * dy[i]) - DMP * vy[i];
          fx += 0.5 * m * Math.sin(t * 2.3 + i * 2.1);          // ambient quiver
          fy += 0.4 * m * Math.sin(t * 1.7 + i * 1.3);
          if (grab && i !== grab.i) {                           // gaussian falloff pull
            let d = Math.abs(i - grab.i); d = Math.min(d, N - d);
            const w = Math.exp(-d * d / 8);
            fx += (grab.pullX * w - dx[i]) * 520 * w - 8 * w * vx[i];
            fy += (grab.pullY * w - dy[i]) * 520 * w - 8 * w * vy[i];
          }
          ax[i] = fx; ay[i] = fy;
        }
        for (let i = 0; i < N; i++) {
          if (grab && i === grab.i) continue;
          vx[i] = Math.max(-VC, Math.min(VC, vx[i] + ax[i] * h));
          vy[i] = Math.max(-VC, Math.min(VC, vy[i] + ay[i] * h));
          dx[i] += vx[i] * h; dy[i] += vy[i] * h;
          const L = Math.hypot(dx[i], dy[i]);
          if (L > DC) { dx[i] *= DC / L; dy[i] *= DC / L; }
        }
      }
    }

    return {
      draw(t, dt) {
        if (t > nextJig) {                       // spontaneous self-jiggle
          nextJig = t + 6 + Math.random() * 2.5;
          if (!grab) jolt((Math.random() * N) | 0, 1.5 * m);
        }
        physics(t, dt);
        let wob = 0, lo = 1e9, hi = -1e9;
        for (let i = 0; i < N; i++) {
          px[i] = RX[i] + dx[i]; py[i] = RY[i] + dy[i];
          if (px[i] < lo) lo = px[i]; if (px[i] > hi) hi = px[i];
          wob += Math.abs(vx[i]) + Math.abs(vy[i]);
        }
        wob /= N * m;
        for (let f = 0; f < 3; f++) {            // features lag-spring after the jelly
          const A = anchors[f], F = feat[f];
          sample(A[0], A[1]);
          F.vx += ((sdx * 0.85 - F.x) * 170 - 7.5 * F.vx) * dt;
          F.vy += ((sdy * 0.85 - F.y) * 170 - 7.5 * F.vy) * dt;
          F.x += F.vx * dt; F.y += F.vy * dt;
        }
        const openT = grab ? Math.min(1, Math.hypot(grab.pullX, grab.pullY) / (0.5 * m))
          : Math.min(0.55, wob * 1.2);
        open += (openT - open) * (1 - Math.pow(0.002, dt));

        g.fillStyle = bg; g.fillRect(0, 0, env.w, env.h);
        // soft shadow, squashing wider + flatter as the flan flings about
        const swr = Math.max(rxv * 1.62, (hi - lo) / 2 + 0.10 * m);
        const shy = 0.045 * m * Math.max(0.5, Math.min(1, rxv * 1.62 / swr));
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath();
        g.ellipse((lo + hi) / 2, plateY + 0.055 * m, swr * 1.12, shy * 1.35, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.34)'; g.beginPath();
        g.ellipse((lo + hi) / 2, plateY + 0.055 * m, swr, shy, 0, 0, TAU); g.fill();
        // the little plate: two flat ellipses
        g.fillStyle = 'rgba(176,140,232,0.45)'; g.beginPath();
        g.ellipse(cx, plateY + 0.014 * m, rxv * 1.55, 0.075 * m, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(176,140,232,0.85)'; g.beginPath();
        g.ellipse(cx, plateY, rxv * 1.42, 0.06 * m, 0, 0, TAU); g.fill();
        // cream body
        blobPath();
        g.fillStyle = CREAM; g.fill();
        g.save(); g.clip();
        // caramel cap with a drippy edge that rides the deformation
        g.fillStyle = AMBER; g.beginPath();
        g.moveTo(cx - 2 * rxv, cy - 4 * ryv);
        let qpx = 0, qpy = 0;
        for (let k = 0; k <= 6; k++) {
          const bx = cx + (k / 3 - 1) * rxv * 1.3;
          const by = cy - ryv * 0.08 + ryv * (0.18 * Math.sin(k * 2.4 + 0.6) + 0.05 * Math.sin(t * 0.8 + k * 1.7));
          sample(bx, by);
          const qx = bx + sdx * 0.9, qy = by + sdy * 0.9;
          if (k === 0) g.lineTo(qx, qy);
          else g.quadraticCurveTo(qpx, qpy, (qpx + qx) / 2, (qpy + qy) / 2);
          qpx = qx; qpy = qy;
        }
        g.lineTo(qpx, qpy);
        g.lineTo(cx + 2 * rxv, cy - 4 * ryv);
        g.closePath(); g.fill();
        // glossy glint on the caramel
        sample(cx - rxv * 0.38, cy - ryv * 0.55);
        g.fillStyle = 'rgba(242,233,220,0.5)'; g.beginPath();
        g.ellipse(cx - rxv * 0.38 + sdx, cy - ryv * 0.55 + sdy, rxv * 0.16, ryv * 0.1, -0.5, 0, TAU);
        g.fill();
        g.restore();
        // face
        if (t > nextBlink) { blinkT = t; nextBlink = t + 2.6 + Math.random() * 3; }
        const bs = Math.min(1, (t - blinkT) / 0.22), blinkS = 0.12 + 0.88 * Math.abs(2 * bs - 1);
        g.fillStyle = bg;
        for (let e = 0; e < 2; e++) {
          const A = anchors[e], F = feat[e];
          g.beginPath();
          g.ellipse(A[0] + F.x, A[1] + F.y, 0.026 * m, 0.026 * m * blinkS, 0, 0, TAU);
          g.fill();
        }
        const MA = anchors[2], MF = feat[2];
        const mxp = MA[0] + MF.x, myp = MA[1] + MF.y;
        if (open < 0.24) {                       // little smile → "oh!" when stretched
          g.strokeStyle = bg; g.lineCap = 'round'; g.lineWidth = 0.014 * m;
          g.beginPath();
          g.arc(mxp, myp - 0.03 * m, 0.045 * m, TAU * 0.14, TAU * 0.36);
          g.stroke();
        } else {
          g.beginPath();
          g.ellipse(mxp, myp, 0.02 * m + 0.02 * m * open, 0.014 * m + 0.045 * m * open, 0, 0, TAU);
          g.fill();
        }
      },
      down(p) {
        const [i, d] = nearest(p);
        const inside = ((p.x - cx) / (rxv * 1.2)) ** 2 + ((p.y - cy) / (ryv * 1.35)) ** 2 <= 1;
        if (!inside && d > 0.13 * m) return;
        grab = { i, offX: p.x - RX[i] - dx[i], offY: p.y - RY[i] - dy[i], pullX: dx[i], pullY: dy[i] };
      },
      move(p) {
        if (grab && p.held) {
          let ux = p.x - grab.offX - RX[grab.i], uy = p.y - grab.offY - RY[grab.i];
          const L = Math.hypot(ux, uy), MAX = 1.15 * m;
          if (L > MAX) { ux *= MAX / L; uy *= MAX / L; }
          grab.pullX = ux; grab.pullY = uy;
        } else if (!p.held) {                    // petting ripple on hover
          const [i, d] = nearest(p);
          if (d < 0.12 * m) {
            const ox = RX[i] + dx[i] - p.x, oy = RY[i] + dy[i] - p.y;
            const L = Math.hypot(ox, oy) + 1e-6;
            vx[i] += (ox / L) * 0.09 * m; vy[i] += (oy / L) * 0.09 * m;
          }
        }
      },
      up() { grab = null; },
      dbl(p) { const [i] = nearest(p); jolt(i, 2.2 * m); },
      resize() { layout(); },
    };
  },
});
