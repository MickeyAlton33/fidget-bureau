/* № 08 — Moiré dial. Two concentric-ring gratings interfere: a fixed cream
   one and an amber one that spring-chases your finger. Fringes crawl on an
   idle orbit; scrolling detunes the amber pitch so the pattern blooms,
   collapses, and blooms again. The interference does all the drawing. */
F.register({
  n: 8, id: 'moire-dial', cat: 'optics',
  title: 'Moiré dial', hint: 'Drag the grating — scroll to tune its pitch',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2;
    const PITCH_A = 7;                        // fixed grating pitch (px)
    let pitchB = 7.7, pitchT = 7.7;           // eased + wheel target, 5..10
    let bx = env.w * 0.62, by = env.h * 0.44; // amber grating center
    let vx = 0, vy = 0;                       // its spring velocity
    let held = false;
    let px = 0, py = 0;                       // pointer while held
    let hov = null;                           // pointer while hovering
    const idleA = Math.random() * TAU;        // idle-orbit phase
    let hubR = 3.5, hubV = 0;                 // springy grab-dot radius
    let flash = 0;                            // wheel feedback glow

    // One batched path of concentric strokes, big enough to always cover
    // the card; count is bounded by the diagonal (centers are clamped).
    function grating(cx, cy, pitch) {
      const w = env.w, h = env.h;
      const maxR = Math.hypot(
        Math.max(Math.abs(cx), Math.abs(cx - w)),
        Math.max(Math.abs(cy), Math.abs(cy - h)));
      const n = Math.min(150, Math.ceil(maxR / pitch));
      g.beginPath();
      for (let i = 1; i <= n; i++) {
        const r = i * pitch;
        g.moveTo(cx + r, cy);
        g.arc(cx, cy, r, 0, TAU);
      }
      g.stroke();
    }

    return {
      draw(t, dt) {
        const w = env.w, h = env.h, m = Math.min(w, h);

        // Target: the finger while held; otherwise a slow orbit around the
        // fixed center so the fringes never stop crawling. Hovering leans
        // the orbit toward the cursor — the card notices you before a grab.
        let tx, ty;
        if (held) { tx = px; ty = py; }
        else {
          const a = idleA + t * 0.33;
          tx = w * 0.5 + Math.cos(a) * m * 0.17;
          ty = h * 0.5 + Math.sin(a) * m * 0.17;
          if (hov) { tx += (hov.x - tx) * 0.3; ty += (hov.y - ty) * 0.3; }
        }
        tx = Math.max(-0.12 * w, Math.min(1.12 * w, tx));
        ty = Math.max(-0.12 * h, Math.min(1.12 * h, ty));

        // Under-damped spring: tight on the finger, loose and wobbly when
        // gliding home, so a release overshoots and settles with life.
        const k = held ? 150 : 32, damp = held ? 15 : 7;
        vx += ((tx - bx) * k - vx * damp) * dt;
        vy += ((ty - by) * k - vy * damp) * dt;
        const sp = Math.hypot(vx, vy) + 1e-6;
        if (sp > 2800) { vx *= 2800 / sp; vy *= 2800 / sp; }
        bx += vx * dt; by += vy * dt;
        bx = Math.max(-0.15 * w, Math.min(1.15 * w, bx));
        by = Math.max(-0.15 * h, Math.min(1.15 * h, by));

        // Ease the tuned pitch; a whisper of breath keeps fringes swelling.
        pitchB += (pitchT - pitchB) * (1 - Math.pow(0.004, dt));
        flash *= Math.pow(0.02, dt);
        const pB = pitchB + Math.sin(t * 0.5) * 0.07;

        g.fillStyle = bg;
        g.fillRect(0, 0, w, h);
        g.lineWidth = 1.5; // deliberate grating aesthetic

        // Layer A — fixed cream rings, quiet.
        g.strokeStyle = 'rgba(242,233,220,0.30)';
        grating(w * 0.5, h * 0.5, PITCH_A);

        // Layer B — amber rings, additive, so crossings glow into fringes.
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = 'rgba(245,165,36,' + (0.42 + flash * 0.3).toFixed(3) + ')';
        grating(bx, by, pB);
        g.globalCompositeOperation = 'source-over';

        // Fixed grating's anchor: a quiet cream tick at dead center.
        g.strokeStyle = 'rgba(242,233,220,0.4)';
        g.lineWidth = 2;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(w * 0.5 - 5, h * 0.5); g.lineTo(w * 0.5 + 5, h * 0.5);
        g.moveTo(w * 0.5, h * 0.5 - 5); g.lineTo(w * 0.5, h * 0.5 + 5);
        g.stroke();

        // The grab handle: an amber hub that pops when you take hold.
        const hT = held ? 6.5 : 3.5;
        hubV += ((hT - hubR) * 200 - hubV * 13) * dt;
        hubR += hubV * dt;
        const hr = Math.max(1.5, Math.min(12, hubR));
        g.fillStyle = inks[0];
        g.beginPath(); g.arc(bx, by, hr, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(245,165,36,0.55)';
        g.beginPath(); g.arc(bx, by, hr + 4.5, 0, TAU); g.stroke();
      },

      down(p) {
        held = true; px = p.x; py = p.y;
        hubV += 90; // first-frame pop
      },
      move(p) {
        if (held && p.held) { px = p.x; py = p.y; }
        else if (!p.held) { held = false; hov = { x: p.x, y: p.y }; }
      },
      up() { held = false; },
      leave() { hov = null; },
      wheel(dy) {
        pitchT = Math.max(5, Math.min(10, pitchT + dy * 0.01));
        flash = 1;
      },
      dbl() {
        // Snap the tuning home with a flourish.
        pitchT = 7.7; flash = 1;
        vx += (Math.random() - 0.5) * 700;
        vy += (Math.random() - 0.5) * 700;
      },
    };
  },
});
