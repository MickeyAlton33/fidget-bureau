/* № 49 — Inchworm. A looper caterpillar that humps and stretches its way
   around the card, patrolling on its own and rearing up to look about. Tap
   ahead and it turns, then inches over with the classic gait: the front foot
   plants, the back humps up and draws in, the front reaches out and plants —
   a travelling arch running down a springy, segmented body. */
F.register({
  n: 49, id: 'inchworm', cat: 'critters',
  title: 'Inchworm', hint: 'Tap ahead — the inchworm humps along to it',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const MINT = inks[2], AMBER = inks[0], CREAM = inks[5];
    const OUT = '#3D765E';                 // darker mint — outline / segment creases
    const M = 18;                          // spine nodes: tail=0 .. head=M-1
    const NS = 34;                         // bezier samples for arc-length resample
    const X = new Float64Array(M), Y = new Float64Array(M);
    const PX = new Float64Array(M), PY = new Float64Array(M);
    const TX = new Float64Array(M), TY = new Float64Array(M);
    const BX = new Float64Array(NS), BY = new Float64Array(NS), CL = new Float64Array(NS);
    const RAD = new Float64Array(M);

    let S = 120, gap = 26, Rmid = 10;      // sizes (set in layout)
    let heading = 0.15;                    // facing angle
    let gp = 0;                            // gait phase [0,1)
    let planted = 1;                       // 1 = head planted (hump), 0 = tail planted (stretch)
    let plantX = 0, plantY = 0;            // the planted foot
    let tgX = 0, tgY = 0;                  // goal point
    let pursue = 0;                        // 1 while chasing a tap
    let speed = 0, hump = 0;               // gait rate, current arch amount
    let wander = 2.0;                      // countdown to next idle waypoint
    let rear = 0, rearDur = 0, nextRear = 4.5;   // rear-up-to-look state
    let alert = 0, blink = 0, nextBlink = 3;

    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const ease = u => u * u * (3 - 2 * u);
    const clampX = x => clamp(x, 0.10 * env.w, 0.90 * env.w);
    const clampY = y => clamp(y, 0.12 * env.h, 0.88 * env.h);
    function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
    function clampPlant() {
      const p = 0.12 * Math.min(env.w, env.h);
      plantX = clamp(plantX, p, env.w - p); plantY = clamp(plantY, p, env.h - p);
    }
    function pickWander() {
      tgX = 0.20 * env.w + Math.random() * 0.60 * env.w;
      tgY = 0.22 * env.h + Math.random() * 0.60 * env.h;
      wander = 2.4 + Math.random() * 3.0;
    }

    function layout(reset) {
      const m = Math.min(env.w, env.h);
      S = 0.40 * m; gap = 0.22 * S; Rmid = 0.088 * S;
      if (reset) {
        plantX = 0.5 * env.w; plantY = 0.60 * env.h;
        gp = 0; planted = 1; heading = 0.15; speed = 0;
        const dx = Math.cos(heading), dy = Math.sin(heading);
        for (let j = 0; j < M; j++) {          // start stretched out behind the head
          const u = j / (M - 1);
          X[j] = PX[j] = plantX - dx * S * (1 - u);
          Y[j] = PY[j] = plantY - dy * S * (1 - u);
        }
        pickWander();
      }
      clampPlant();
      tgX = clampX(tgX); tgY = clampY(tgY);
    }
    layout(true);

    // --- gait -> target skeleton (feet + a cubic-bezier arch, arc-length even) ---
    function computeTargets() {
      const dx = Math.cos(heading), dy = Math.sin(heading);
      let upx = -dy, upy = dx;
      if (upy > 0) { upx = -upx; upy = -upy; }  // arch always bulges toward screen-up
      const hop = 0.085 * S;
      let F0x, F0y, F1x, F1y;
      if (planted === 1) {                       // HUMP: head planted, tail draws up and in
        const u = clamp(gp / 0.5, 0, 1);
        const td = S + (gap - S) * ease(u), lf = hop * Math.sin(Math.PI * u);
        F1x = plantX; F1y = plantY;
        F0x = plantX - dx * td + upx * lf; F0y = plantY - dy * td + upy * lf;
      } else {                                   // STRETCH: tail planted, head reaches out
        const u = clamp((gp - 0.5) / 0.5, 0, 1);
        const hd = gap + (S - gap) * ease(u), lf = hop * Math.sin(Math.PI * u);
        F0x = plantX; F0y = plantY;
        F1x = plantX + dx * hd + upx * lf; F1y = plantY + dy * hd + upy * lf;
      }
      if (rear > 0.001) { F1x += upx * 0.34 * S * rear; F1y += upy * 0.34 * S * rear; }

      const ddx = F1x - F0x, ddy = F1y - F0y;
      const d = Math.hypot(ddx, ddy) + 1e-6;
      hump = clamp((S - d) / (S - gap + 1e-6), 0, 1);
      const cpUp = 0.72 * Math.sqrt(Math.max(0, S * S - d * d));  // fold slack upward
      const ax = ddx / d, ay = ddy / d;
      const c1x = F0x + ax * d * 0.28 + upx * cpUp, c1y = F0y + ay * d * 0.28 + upy * cpUp;
      const c2x = F1x - ax * d * 0.28 + upx * cpUp, c2y = F1y - ay * d * 0.28 + upy * cpUp;

      let px = F0x, py = F0y; BX[0] = F0x; BY[0] = F0y; CL[0] = 0;
      for (let s = 1; s < NS; s++) {
        const u = s / (NS - 1), iu = 1 - u;
        const b0 = iu * iu * iu, b1 = 3 * iu * iu * u, b2 = 3 * iu * u * u, b3 = u * u * u;
        const bx = b0 * F0x + b1 * c1x + b2 * c2x + b3 * F1x;
        const by = b0 * F0y + b1 * c1y + b2 * c2y + b3 * F1y;
        BX[s] = bx; BY[s] = by;
        CL[s] = CL[s - 1] + Math.hypot(bx - px, by - py);
        px = bx; py = by;
      }
      const total = CL[NS - 1] + 1e-6;
      let seg = 1;
      for (let j = 0; j < M; j++) {
        const want = total * (j / (M - 1));
        while (seg < NS - 1 && CL[seg] < want) seg++;
        const f = (want - CL[seg - 1]) / (CL[seg] - CL[seg - 1] + 1e-6);
        TX[j] = BX[seg - 1] + (BX[seg] - BX[seg - 1]) * f;
        TY[j] = BY[seg - 1] + (BY[seg] - BY[seg - 1]) * f;
      }
    }

    function step(dt) {
      const K = 170, damp = 0.85, maxV = 0.5 * S;
      for (let j = 0; j < M; j++) {
        let vx = (X[j] - PX[j]) * damp, vy = (Y[j] - PY[j]) * damp;
        const vm = Math.hypot(vx, vy);
        if (vm > maxV) { vx *= maxV / vm; vy *= maxV / vm; }
        PX[j] = X[j]; PY[j] = Y[j];
        X[j] += vx + (TX[j] - X[j]) * K * dt * dt;
        Y[j] += vy + (TY[j] - Y[j]) * K * dt * dt;
      }
      for (let j = 1; j < M - 1; j++) {          // gentle smoothing keeps the tube clean
        X[j] += ((X[j - 1] + X[j + 1]) * 0.5 - X[j]) * 0.10;
        Y[j] += ((Y[j - 1] + Y[j + 1]) * 0.5 - Y[j]) * 0.10;
      }
      const pj = planted === 1 ? M - 1 : 0;      // pin the planted foot — no slip
      X[pj] = TX[pj]; Y[pj] = TY[pj]; PX[pj] = X[pj]; PY[pj] = Y[pj];
      if (X[M - 1] !== X[M - 1] || Y[0] !== Y[0]) layout(true);   // NaN insurance
    }

    function drawBody(t) {
      const breathe = 1 + 0.03 * Math.sin(t * 2.1);
      for (let j = 0; j < M; j++) {
        const u = j / (M - 1);
        let pr = 0.60 + 0.40 * Math.sin(Math.PI * Math.pow(u, 0.85));
        pr *= 1 + 0.16 * hump * Math.sin(Math.PI * u);   // squash on the hump
        RAD[j] = Rmid * pr * breathe;
      }
      g.lineJoin = 'round'; g.lineCap = 'round';
      // body: overlapping circles, each ringed — later circles hide the front of
      // the previous ring, so a dark tail-side crease shows on every segment
      g.lineWidth = Math.max(2, Rmid * 0.26);
      for (let j = 0; j < M - 1; j++) {
        g.fillStyle = MINT;
        g.beginPath(); g.arc(X[j], Y[j], RAD[j], 0, TAU); g.fill();
        g.strokeStyle = OUT; g.stroke();
      }
      // amber dorsal spots on alternate segments
      g.fillStyle = AMBER;
      for (let j = 2; j < M - 2; j += 2) {
        let nx = -(Y[j + 1] - Y[j - 1]), ny = (X[j + 1] - X[j - 1]);
        const nl = Math.hypot(nx, ny) + 1e-6; nx /= nl; ny /= nl;
        const s = ny > 0 ? -1 : 1;
        g.beginPath();
        g.arc(X[j] + nx * s * RAD[j] * 0.30, Y[j] + ny * s * RAD[j] * 0.30, RAD[j] * 0.26, 0, TAU);
        g.fill();
      }

      // head frame from the facing direction (robust, and it reads as "looking ahead")
      const hxp = X[M - 1], hyp = Y[M - 1];
      const fx = Math.cos(heading), fy = Math.sin(heading);
      let ux = -fy, uy = fx; if (uy > 0) { ux = -ux; uy = -uy; }
      const Rh = Rmid * 1.35 * breathe;

      // antennae (behind the face) with amber tip-knobs
      const antL = Rh * 1.55 * (1 + 0.18 * alert);
      const bx = hxp + fx * Rh * 0.2 + ux * Rh * 0.7, by = hyp + fy * Rh * 0.2 + uy * Rh * 0.7;
      g.strokeStyle = AMBER; g.lineWidth = Math.max(2, Rh * 0.16);
      for (let s = -1; s <= 1; s += 2) {
        const wob = 0.42 * Math.sin(t * 3.2 + s * 1.6) * (0.55 + 0.9 * alert);
        const ang = Math.atan2(uy, ux) + s * 0.42 + wob;
        const tx = bx + Math.cos(ang) * antL, ty = by + Math.sin(ang) * antL;
        const cx = bx + Math.cos(ang) * antL * 0.5 + fx * antL * 0.16;
        const cy = by + Math.sin(ang) * antL * 0.5 + fy * antL * 0.16;
        g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(cx, cy, tx, ty); g.stroke();
        g.fillStyle = AMBER; g.beginPath(); g.arc(tx, ty, Math.max(2.2, Rh * 0.2), 0, TAU); g.fill();
      }

      // cream face with a mint rim
      g.fillStyle = CREAM; g.beginPath(); g.arc(hxp, hyp, Rh, 0, TAU); g.fill();
      g.strokeStyle = MINT; g.lineWidth = Math.max(2.2, Rh * 0.2);
      g.beginPath(); g.arc(hxp, hyp, Rh, 0, TAU); g.stroke();

      // eyes (blink) + a small smile
      const sx = -fy, sy = fx;
      const eo = Rh * 0.40, ef = Rh * 0.26, eup = Rh * 0.08;
      for (let s = -1; s <= 1; s += 2) {
        const ex = hxp + fx * ef + sx * s * eo + ux * eup;
        const ey = hyp + fy * ef + sy * s * eo + uy * eup;
        if (blink > 0) {
          g.strokeStyle = OUT; g.lineWidth = Math.max(2, Rh * 0.14);
          g.beginPath();
          g.moveTo(ex - sx * Rh * 0.17, ey - sy * Rh * 0.17);
          g.lineTo(ex + sx * Rh * 0.17, ey + sy * Rh * 0.17);
          g.stroke();
        } else {
          g.fillStyle = bg; g.beginPath(); g.arc(ex, ey, Rh * 0.24, 0, TAU); g.fill();
          g.fillStyle = CREAM;
          g.beginPath(); g.arc(ex - fx * Rh * 0.05 + ux * Rh * 0.06, ey - fy * Rh * 0.05 + uy * Rh * 0.06, Rh * 0.08, 0, TAU); g.fill();
        }
      }
      g.strokeStyle = OUT; g.lineWidth = Math.max(1.6, Rh * 0.1);
      const a0 = Math.atan2(fy, fx);
      g.beginPath(); g.arc(hxp + fx * Rh * 0.46, hyp + fy * Rh * 0.46, Rh * 0.3, a0 - 1.05, a0 + 1.05); g.stroke();
    }

    return {
      draw(t, dt) {
        const hxp = X[M - 1], hyp = Y[M - 1];
        const dist = Math.hypot(tgX - hxp, tgY - hyp);
        const arriveR = 0.30 * S;

        // turn toward the goal — immediate but eased
        const dh = angDiff(Math.atan2(tgY - hyp, tgX - hxp), heading);
        const maxStep = (pursue ? 3.0 : 2.0) * dt;
        heading += clamp(dh * clamp(dt * 4.5, 0, 1), -maxStep, maxStep);

        // idle waypoints / arrival
        wander -= dt;
        if (!pursue) { if (dist < arriveR || wander <= 0) pickWander(); }
        else if (dist < arriveR * 0.7) { pursue = 0; pickWander(); }

        // rear up to look around (idle only)
        nextRear -= dt;
        if (!pursue && rearDur <= 0 && nextRear <= 0 && dist > arriveR) {
          rearDur = 1.7; nextRear = 6 + Math.random() * 6; alert = 1;
        }
        if (rearDur > 0) rearDur -= dt;
        rear += (((rearDur > 0 && !pursue) ? 1 : 0) - rear) * clamp(dt * 4, 0, 1);
        if (rear > 0.01 && !pursue) heading += Math.sin(t * 1.7) * 1.0 * dt * rear;

        // gait speed: fast when pursuing, eased to rest near the goal and while rearing
        const moveGate = clamp((dist - arriveR * 0.6) / (arriveR * 1.4), 0, 1);
        const tSpeed = (pursue ? 0.82 : 0.44) * moveGate * (1 - 0.92 * rear);
        speed += (tSpeed - speed) * clamp(dt * 3, 0, 1);
        gp += speed * dt;
        if (gp >= 1) gp -= 1;

        // re-plant the trailing foot at each half-cycle
        const dx = Math.cos(heading), dy = Math.sin(heading);
        if (gp < 0.5 && planted === 0) { plantX += dx * S; plantY += dy * S; planted = 1; clampPlant(); }
        else if (gp >= 0.5 && planted === 1) { plantX -= dx * gap; plantY -= dy * gap; planted = 0; clampPlant(); }

        alert += (0 - alert) * clamp(dt * 1.5, 0, 1);
        nextBlink -= dt;
        if (nextBlink <= 0 && blink <= 0) { blink = 0.16; nextBlink = 2.5 + Math.random() * 3.5; }
        if (blink > 0) blink -= dt;

        computeTargets();
        step(dt);

        g.fillStyle = bg; g.fillRect(0, 0, env.w, env.h);
        drawBody(t);
      },
      down(p) { tgX = clampX(p.x); tgY = clampY(p.y); pursue = 1; alert = 1; rearDur = 0; nextRear = 5 + Math.random() * 4; },
      move(p) { if (p.held) { tgX = clampX(p.x); tgY = clampY(p.y); pursue = 1; } },
      up() { },
      resize() { layout(false); },
    };
  },
});
