/* № 01 — Gear Wall. Reference implementation and house-style example.
   A meshed gear train: drag any gear to crank the whole works, flick for
   momentum, and a tiny motor keeps it idling when you leave it alone. */
F.register({
  n: 1, id: 'gear-wall', cat: 'mech',
  title: 'Gear wall', hint: 'Drag any gear to crank the works — flick it',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    let gears = [];       // {x, y, r, T, sign, off, ink}
    let phase = 0;        // master angle of gear 0
    let vel = 0.35;       // master angular velocity
    const MOTOR = 0.35;
    let grab = null;      // {i, a0, phase0, lastA, lastT}
    let flickV = 0;

    function layout() {
      const w = env.w, h = env.h, m = Math.min(w, h);
      const pts = [
        [0.30 * w, 0.36 * h], [0.66 * w, 0.52 * h],
        [0.42 * w, 0.80 * h], [0.11 * w, 0.15 * h],
      ];
      const rs = [0.20 * m];
      rs[1] = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) - rs[0];
      rs[2] = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]) - rs[1];
      rs[3] = Math.hypot(pts[3][0] - pts[0][0], pts[3][1] - pts[0][1]) - rs[0];
      const chain = [[0, 1], [1, 2], [0, 3]]; // meshing pairs (a drives b)
      const inkFor = [inks[0], inks[3], inks[2], inks[1]];
      gears = pts.map(([x, y], i) => ({
        x, y, r: rs[i],
        T: Math.max(7, Math.round(rs[i] / (0.026 * m))),
        sign: 1, off: 0, ink: inkFor[i],
      }));
      // alternate spin direction and align teeth along the chain
      for (const [a, b] of chain) {
        const A = gears[a], B = gears[b];
        B.sign = -A.sign;
        const thAB = Math.atan2(B.y - A.y, B.x - A.x);
        const thBA = thAB + Math.PI;
        const sa = TAU / A.T, sb = TAU / B.T;
        const toothPhase = (((thAB - A.off) % sa) + sa) % sa;
        B.off = thBA - (toothPhase / sa + 0.5) * sb;
      }
    }
    layout();

    function angleOf(i) {
      const G = gears[i];
      return G.sign * phase * (gears[0].T / G.T) + G.off;
    }
    function hit(p) {
      for (let i = 0; i < gears.length; i++) {
        const G = gears[i];
        if (Math.hypot(p.x - G.x, p.y - G.y) < G.r + 6) return i;
      }
      return -1;
    }
    function drawGear(G, a) {
      const tooth = Math.min(5.5, G.r * 0.16);
      g.strokeStyle = G.ink;
      g.lineWidth = 2.5;
      g.lineJoin = 'round';
      g.beginPath();
      for (let k = 0; k < G.T; k++) {
        const a0 = a + (k / G.T) * TAU;
        const a1 = a + ((k + 0.38) / G.T) * TAU;
        const a2 = a + ((k + 0.5) / G.T) * TAU;
        const a3 = a + ((k + 0.88) / G.T) * TAU;
        const ro = G.r + tooth, ri = G.r - tooth * 0.4;
        g.lineTo(G.x + ro * Math.cos(a0), G.y + ro * Math.sin(a0));
        g.lineTo(G.x + ro * Math.cos(a1), G.y + ro * Math.sin(a1));
        g.lineTo(G.x + ri * Math.cos(a2), G.y + ri * Math.sin(a2));
        g.lineTo(G.x + ri * Math.cos(a3), G.y + ri * Math.sin(a3));
      }
      g.closePath();
      g.stroke();
      // hub and spokes
      g.beginPath();
      g.arc(G.x, G.y, Math.max(3, G.r * 0.14), 0, TAU);
      g.stroke();
      const spokes = G.r > 30 ? 4 : 3;
      for (let s = 0; s < spokes; s++) {
        const sa = a + (s / spokes) * TAU;
        g.beginPath();
        g.moveTo(G.x + G.r * 0.2 * Math.cos(sa), G.y + G.r * 0.2 * Math.sin(sa));
        g.lineTo(G.x + G.r * 0.72 * Math.cos(sa), G.y + G.r * 0.72 * Math.sin(sa));
        g.stroke();
      }
    }

    return {
      draw(t, dt) {
        if (!grab) {
          vel = MOTOR + (vel - MOTOR) * Math.pow(0.45, dt);
          phase += vel * dt;
        }
        g.fillStyle = bg;
        g.fillRect(0, 0, env.w, env.h);
        for (let i = 0; i < gears.length; i++) drawGear(gears[i], angleOf(i));
        // grabbed-gear highlight
        if (grab) {
          const G = gears[grab.i];
          g.strokeStyle = inks[5];
          g.globalAlpha = 0.35;
          g.beginPath();
          g.arc(G.x, G.y, G.r * 0.45, 0, TAU);
          g.stroke();
          g.globalAlpha = 1;
        }
      },
      down(p) {
        const i = hit(p);
        if (i < 0) return;
        const G = gears[i];
        grab = { i, a0: Math.atan2(p.y - G.y, p.x - G.x), phase0: phase, lastA: 0, lastT: 0 };
        flickV = 0;
      },
      move(p) {
        if (!grab) return;
        const G = gears[grab.i];
        const a = Math.atan2(p.y - G.y, p.x - G.x);
        let da = a - grab.a0;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        // unwrap continuously so multi-turn cranks accumulate
        grab.a0 = a;
        const dphase = da * (G.T / gears[0].T) * G.sign;
        phase += dphase;
        flickV = flickV * 0.6 + dphase * 0.4 * 60;
      },
      up() {
        if (grab) vel = Math.max(-14, Math.min(14, flickV));
        grab = null;
      },
      resize() { layout(); },
    };
  },
});
