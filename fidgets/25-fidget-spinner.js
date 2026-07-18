/* № 25 — Fidget spinner. Three rounded lobes — coral, amber, mint — around a
   metal bearing that stays still while the body blurs. It never sits dead: a
   slow residual turn and a faint breathing wobble keep it begging for a flick.
   Sweep around the hub to spin it up (a fast whip throws real momentum), then
   watch it coast down on lazy bearing friction — the lobes smear into fading
   afterimage rings at speed and resolve back into three as it slows. Tap the
   body to catch it; double-click to kick it hard. */
F.register({
  n: 25, id: 'fidget-spinner', cat: 'chaos',
  title: 'Fidget spinner', hint: 'Flick to spin — feel it coast down',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const AMBER = inks[0], CORAL = inks[1], MINT = inks[2];
    const LOBE = [CORAL, AMBER, MINT];
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const smooth = (x) => x * x * (3 - 2 * x);

    const IDLE = 0.85;         // residual idle angular speed (rad/s) — never dead
    const VMAX = 130;          // clamp on angular velocity (rad/s)
    const GAIN = 1.5;          // flick amplification on release
    const KLOW = 0.45, KHIGH = 0.90; // bearing friction: settle-fast / coast-long

    let angle = Math.random() * TAU;         // body rotation
    let dir = Math.random() < 0.5 ? -1 : 1;  // current spin direction
    let vel = IDLE * dir;                     // angular velocity

    let grabbing = false;
    let grabAngle = 0;    // last pointer angle around the hub
    let dragAccum = 0;    // angle swept by the pointer since last frame
    let dragVel = 0;      // smoothed pointer angular velocity (for release)
    let grabGlow = 0;     // eased pinch highlight

    const wob1 = Math.random() * TAU, wob2 = Math.random() * TAU; // idle phases

    function hubAngle(p) {
      return Math.atan2(p.y - env.h / 2, p.x - env.w / 2);
    }

    // one spinner arm along axis `a`, filled `col`; detail fades out at speed
    function lobe(R, a, col, detail) {
      const rTip = 0.30 * R;
      const ux = Math.cos(a), uy = Math.sin(a);
      const vx = -uy, vy = ux;
      const tx = ux * (R - rTip), ty = uy * (R - rTip); // tip-circle centre (local)
      const rB = 0.17 * R, wB = 0.72 * rTip;            // base tucked under bearing
      const phi = 1.30;                                 // shoulder half-angle on tip
      const bLx = ux * rB + vx * wB, bLy = uy * rB + vy * wB;
      const bRx = ux * rB - vx * wB, bRy = uy * rB - vy * wB;
      const sLx = tx + rTip * Math.cos(a + phi), sLy = ty + rTip * Math.sin(a + phi);
      const cwx = 0.52 * rTip, rMid = 0.55 * R;         // waist control
      const cLx = ux * rMid + vx * cwx, cLy = uy * rMid + vy * cwx;
      const cRx = ux * rMid - vx * cwx, cRy = uy * rMid - vy * cwx;

      g.beginPath();
      g.moveTo(bLx, bLy);
      g.quadraticCurveTo(cLx, cLy, sLx, sLy);
      g.arc(tx, ty, rTip, a + phi, a - phi, true);      // outward rounded tip
      g.quadraticCurveTo(cRx, cRy, bRx, bRy);
      g.closePath();
      g.fillStyle = col;
      g.fill();

      // chunky dark rim for separation between overlapping lobes
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.lineWidth = Math.max(2, R * 0.02);
      g.strokeStyle = 'rgba(20,16,13,' + (0.42 * detail).toFixed(3) + ')';
      g.stroke();

      // glossy highlight crescent + centre spoke
      if (detail > 0.02) {
        g.strokeStyle = 'rgba(242,233,220,' + (0.22 * detail).toFixed(3) + ')';
        g.lineWidth = rTip * 0.16;
        g.beginPath();
        g.arc(tx, ty, rTip * 0.66, a - 0.55, a + 0.95);
        g.stroke();
        g.strokeStyle = 'rgba(242,233,220,' + (0.16 * detail).toFixed(3) + ')';
        g.lineWidth = Math.max(1.5, R * 0.028);
        g.beginPath();
        g.moveTo(ux * rB * 1.1, uy * rB * 1.1);
        g.lineTo(tx, ty);
        g.stroke();
      }

      // weighted metal cap at the tip
      const capA = 0.32 + 0.68 * detail;
      g.beginPath();
      g.arc(tx, ty, rTip * 0.40, 0, TAU);
      g.fillStyle = 'rgba(20,16,13,' + (0.30 * capA).toFixed(3) + ')';
      g.fill();
      g.beginPath();
      g.arc(tx, ty, rTip * 0.30, 0, TAU);
      g.fillStyle = 'rgba(242,233,220,' + (0.90 * capA).toFixed(3) + ')';
      g.fill();
      g.beginPath();
      g.arc(tx, ty, rTip * 0.12, 0, TAU);
      g.fillStyle = 'rgba(20,16,13,' + (0.80 * capA).toFixed(3) + ')';
      g.fill();
    }

    // static centre bearing — crisp while the body blurs, which sells the spin
    function bearing(R) {
      const rC = 0.20 * R;
      if (grabGlow > 0.01) {                             // pinch feedback
        g.lineWidth = Math.max(2, R * 0.03);
        g.strokeStyle = 'rgba(242,233,220,' + (0.35 * grabGlow).toFixed(3) + ')';
        g.beginPath();
        g.arc(0, 0, rC * (1.5 + 0.12 * grabGlow), 0, TAU);
        g.stroke();
      }
      g.beginPath();
      g.arc(0, 0, rC * 1.14, 0, TAU);
      g.fillStyle = 'rgba(20,16,13,0.60)';
      g.fill();
      g.beginPath();
      g.arc(0, 0, rC, 0, TAU);
      g.fillStyle = inks[5];                             // cream metal
      g.fill();
      g.save();
      g.beginPath();
      g.arc(0, 0, rC, 0, TAU);
      g.clip();
      g.beginPath();                                     // cool lower half (sky)
      g.arc(0, rC * 0.55, rC, 0, TAU);
      g.fillStyle = 'rgba(88,166,242,0.20)';
      g.fill();
      g.beginPath();                                     // ground shade
      g.arc(rC * 0.32, rC * 0.5, rC * 0.92, 0, TAU);
      g.fillStyle = 'rgba(20,16,13,0.26)';
      g.fill();
      g.beginPath();                                     // specular highlight
      g.arc(-rC * 0.34, -rC * 0.34, rC * 0.34, 0, TAU);
      g.fillStyle = 'rgba(242,233,220,0.85)';
      g.fill();
      g.restore();
      g.lineWidth = Math.max(1.5, R * 0.02);
      g.strokeStyle = 'rgba(242,233,220,0.55)';
      g.beginPath();
      g.arc(0, 0, rC, 0, TAU);
      g.stroke();
      g.beginPath();                                     // bore
      g.arc(0, 0, rC * 0.30, 0, TAU);
      g.fillStyle = 'rgba(20,16,13,0.78)';
      g.fill();
    }

    return {
      draw(t, dt) {
        const w = env.w, h = env.h, cx = w / 2, cy = h / 2;
        const R = 0.42 * Math.min(w, h);

        // --- physics ---
        if (grabbing) {
          const raw = clamp(dragAccum / Math.max(dt, 1e-4), -VMAX, VMAX);
          dragAccum = 0;
          const s = Math.exp(-dt / 0.05);
          dragVel = dragVel * s + raw * (1 - s);
          if (Math.abs(dragVel) > IDLE * 2) dir = dragVel < 0 ? -1 : 1;
        } else {
          angle += vel * dt;
          const kEff = KLOW + (KHIGH - KLOW) * smooth(clamp(Math.abs(vel) / 26, 0, 1));
          const target = IDLE * dir;
          vel = target + (vel - target) * Math.pow(kEff, dt);
          vel = clamp(vel, -VMAX, VMAX);
        }
        if (!isFinite(vel)) vel = IDLE * dir;
        if (!isFinite(angle)) angle = 0;
        angle = ((angle % TAU) + TAU) % TAU;
        grabGlow += ((grabbing ? 1 : 0) - grabGlow) * (1 - Math.pow(0.001, dt));

        const visSpeed = grabbing ? Math.abs(dragVel) : Math.abs(vel);

        // --- motion-blur trail: fast clears leave long afterimages, slow crisp ---
        const blur = smooth(clamp((visSpeed - 1) / 25, 0, 1));
        const detail = 1 - blur;
        const clearA = 1 - 0.80 * blur;
        g.globalAlpha = 1;
        g.fillStyle = clearA >= 0.999 ? bg : 'rgba(20,16,13,' + clearA.toFixed(3) + ')';
        g.fillRect(0, 0, w, h);

        // --- idle breathing wobble (dies out once it's spinning fast) ---
        const idle = 1 - clamp(visSpeed / 8, 0, 1);
        const breath = 1 + Math.sin(t * 0.9 + wob1) * 0.010 * idle;
        const wob = Math.sin(t * 1.3 + wob2) * 0.016 * idle;
        const rock = Math.sin(t * 0.7 + wob1) * 0.020 * idle;

        // --- spinning body ---
        g.save();
        g.translate(cx, cy);
        g.scale(breath * (1 + wob), breath * (1 - wob));
        g.rotate(angle + rock);
        for (let i = 0; i < 3; i++) lobe(R, (i / 3) * TAU, LOBE[i], detail);
        g.restore();

        // --- still centre bearing ---
        g.save();
        g.translate(cx, cy);
        g.scale(breath, breath);
        bearing(R);
        g.restore();
        g.globalAlpha = 1;
      },
      down(p) {
        grabbing = true;
        grabAngle = hubAngle(p);
        dragAccum = 0;
        dragVel = 0;
      },
      move(p) {
        if (!grabbing) return;
        const a = hubAngle(p);
        let da = a - grabAngle;
        da = Math.atan2(Math.sin(da), Math.cos(da)); // unwrap across the ±π seam
        grabAngle = a;
        angle += da;
        dragAccum += da;
      },
      up() {
        if (!grabbing) return;
        grabbing = false;
        vel = clamp(dragVel * GAIN, -VMAX, VMAX);
        if (Math.abs(vel) > IDLE * 1.5) dir = vel < 0 ? -1 : 1;
      },
      dbl() {
        vel = clamp(vel + 55 * dir, -VMAX, VMAX); // kick it hard
        if (Math.abs(vel) > IDLE * 1.5) dir = vel < 0 ? -1 : 1;
      },
    };
  },
});
