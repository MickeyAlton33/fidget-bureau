/* № 30 — Etch-a-sketch. A cool silver screen set in a chunky amber body with
   two ridged knobs. Drag to scrape ONE continuous aluminium line across the
   silver — the stylus never lifts, so the left knob rolls with your horizontal
   motion and the right knob with your vertical. Shake the pointer hard and the
   screen shudders while a powder sweep wipes it back to blank silver. Idle: the
   last drawing shimmers under a moving sheen and the knobs quiver. */
F.register({
  n: 30, id: 'etch-sketch', cat: 'chaos',
  title: 'Etch-a-sketch', hint: 'Drag to draw — shake hard to erase',
  make(env) {
    const { g, bg } = env;
    const TAU = Math.PI * 2;

    // palette: amber body, coral banner, cool aluminium screen, dark scratch
    const AMBER = '#F5A524', AMBER_D = '#B4780F', AMBER_DK = '#6E4A0A';
    const CORAL = '#F2665B';
    const CREAM = '#F2E9DC', CREAM_HI = '#FFFBF3';
    const SILVER = '#A4A4AA', SILVER_HI = '#C8C8CE';
    const LINE = '#2C2824';

    // ---- geometry (recomputed on resize) ----
    let FX0 = 0, FY0 = 0, FX1 = 1, FY1 = 1, Rout = 1;
    let SX0 = 0, SY0 = 0, SX1 = 1, SY1 = 1, SW = 1, SH = 1, Rscr = 1;
    let kr = 6, LKX = 0, LKY = 0, RKX = 0, RKY = 0;
    let bandX0 = 0, bandX1 = 1, bandY0 = 0, bandY1 = 1;
    let m = 1;

    function layout() {
      const W = env.w, H = env.h;
      m = Math.min(W, H);
      const marg = m * 0.026;
      const side = m * 0.058, topB = m * 0.132, botB = m * 0.238;
      FX0 = marg; FY0 = marg; FX1 = W - marg; FY1 = H - marg;
      Rout = m * 0.11;
      SX0 = FX0 + side; SX1 = FX1 - side;
      SY0 = FY0 + topB; SY1 = FY1 - botB;
      if (SX1 < SX0 + 12) { const c = (FX0 + FX1) / 2; SX0 = c - 6; SX1 = c + 6; }
      if (SY1 < SY0 + 12) { const c = (FY0 + FY1) / 2; SY0 = c - 6; SY1 = c + 6; }
      SW = SX1 - SX0; SH = SY1 - SY0;
      Rscr = Math.min(m * 0.05, SW * 0.22, SH * 0.22);
      bandX0 = FX0 + side * 0.7; bandX1 = FX1 - side * 0.7;
      bandY0 = FY0 + m * 0.03; bandY1 = SY0 - m * 0.028;
      if (bandY1 < bandY0 + 3) bandY1 = bandY0 + 3;
      kr = Math.max(6, Math.min(botB * 0.34, (FX1 - FX0) * 0.11));
      const ky = (SY1 + FY1) / 2;
      LKX = FX0 + (FX1 - FX0) * 0.205; LKY = ky;
      RKX = FX0 + (FX1 - FX0) * 0.795; RKY = ky;
    }

    // ---- drawing buffer: normalised screen coords in a fixed ring buffer ----
    const CAP = 1000;
    const buf = new Float32Array(CAP * 2);
    let startIdx = 0, count = 0;
    const INSET = 0.012;
    function clampN(v) { return v < INSET ? INSET : v > 1 - INSET ? 1 - INSET : v; }
    function pushPt(nx, ny) {
      const slot = (startIdx + count) % CAP;
      buf[slot * 2] = nx; buf[slot * 2 + 1] = ny;
      if (count < CAP) count++; else startIdx = (startIdx + 1) % CAP;
    }

    // pen (stylus), normalised
    let pnx = 0.5, pny = 0.5, lastNx = 0.5, lastNy = 0.5;

    // seed a spiral so the idle screen already holds a drawing
    (function seed() {
      const turns = 4.1, pts = 190;
      for (let i = 0; i < pts; i++) {
        const u = i / (pts - 1);
        const a = u * turns * TAU + 0.6;
        const rad = 0.05 + u * 0.36;
        pushPt(clampN(0.5 + Math.cos(a) * rad), clampN(0.5 + Math.sin(a) * rad * 0.92));
      }
      const li = (startIdx + count - 1) % CAP;
      pnx = buf[li * 2]; pny = buf[li * 2 + 1]; lastNx = pnx; lastNy = pny;
    })();

    // ---- interaction / knob state ----
    let drawing = false;
    let ptrX = 0, ptrY = 0, havePtr = false;
    let leftAng = 0, rightAng = 0;
    const lph = Math.random() * TAU, rph = Math.random() * TAU;

    // shake detector (leaky integrator over fast direction reversals)
    let frameDX = 0, frameDY = 0, pvx = 0, pvy = 0, psp = 0, shakeCharge = 0;
    const SHAKE_SPEED = 780, SHAKE_NEED = 3.6;

    // erase animation
    let erasing = false, wipeT = 0, shudT = 999;
    const WIPE_DUR = 0.62;
    const powder = [];

    function triggerErase() {
      if (erasing) return;
      erasing = true; wipeT = 0; shudT = 0; shakeCharge = 0;
    }

    layout();

    function roundRect(x, y, w, h, r) {
      const rr = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
      g.beginPath();
      g.moveTo(x + rr, y);
      g.arcTo(x + w, y, x + w, y + h, rr);
      g.arcTo(x + w, y + h, x, y + h, rr);
      g.arcTo(x, y + h, x, y, rr);
      g.arcTo(x, y, x + w, y, rr);
      g.closePath();
    }

    function drawKnob(cx, cy, ang) {
      g.fillStyle = AMBER_DK;                              // seat shadow
      g.beginPath(); g.arc(cx, cy + kr * 0.1, kr * 1.06, 0, TAU); g.fill();
      const gr = g.createRadialGradient(cx - kr * 0.34, cy - kr * 0.34, kr * 0.12, cx, cy, kr);
      gr.addColorStop(0, CREAM_HI); gr.addColorStop(0.55, AMBER); gr.addColorStop(1, AMBER_D);
      g.fillStyle = gr;                                    // body
      g.beginPath(); g.arc(cx, cy, kr, 0, TAU); g.fill();
      g.strokeStyle = AMBER_DK; g.lineWidth = Math.max(1.4, kr * 0.085); g.lineCap = 'round';
      const teeth = 14;                                    // knurl (shows spin)
      for (let k = 0; k < teeth; k++) {
        const a = ang + (k / teeth) * TAU, c = Math.cos(a), s = Math.sin(a);
        g.beginPath();
        g.moveTo(cx + c * kr * 0.74, cy + s * kr * 0.74);
        g.lineTo(cx + c * kr * 0.96, cy + s * kr * 0.96);
        g.stroke();
      }
      g.strokeStyle = AMBER_DK; g.lineWidth = Math.max(2, kr * 0.12);
      g.beginPath(); g.arc(cx, cy, kr * 0.99, 0, TAU); g.stroke();
      const pc = Math.cos(ang), psn = Math.sin(ang);       // pointer dot
      g.fillStyle = CREAM;
      g.beginPath(); g.arc(cx + pc * kr * 0.5, cy + psn * kr * 0.5, Math.max(2, kr * 0.15), 0, TAU); g.fill();
      g.fillStyle = AMBER_D;
      g.beginPath(); g.arc(cx, cy, kr * 0.2, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,251,243,0.5)'; g.lineWidth = Math.max(1.4, kr * 0.09);
      g.beginPath(); g.arc(cx, cy, kr * 0.62, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
    }

    return {
      draw(t, dt) {
        // shake integrator (only while actively drawing)
        if (drawing && !erasing) {
          shakeCharge = Math.max(0, shakeCharge - dt * 2.2);
          const vx = frameDX / (dt + 1e-6), vy = frameDY / (dt + 1e-6);
          const sp = Math.hypot(vx, vy);
          if (sp > SHAKE_SPEED && psp > SHAKE_SPEED) {
            const dot = vx * pvx + vy * pvy;
            if (dot < -0.25 * sp * psp) {                  // sharp reversal at speed
              shakeCharge += 1.2;
              if (shakeCharge >= SHAKE_NEED) triggerErase();
            }
          }
          pvx = vx; pvy = vy; psp = sp;
        } else { psp = 0; }
        frameDX = 0; frameDY = 0;

        // erase sweep
        let wipeYn = 1.3;
        if (erasing) {
          wipeT += dt;
          wipeYn = (wipeT / WIPE_DUR) * (wipeT / WIPE_DUR) * 1.08;   // accelerates
          if (wipeYn < 1.05) {
            const wy = SY0 + Math.min(1, wipeYn) * SH;
            for (let s = 0; s < 8; s++) {
              powder.push({
                x: SX0 + Math.random() * SW, y: wy - Math.random() * 3,
                vx: (Math.random() - 0.5) * 50, vy: 30 + Math.random() * 130,
                l: 0.55 + Math.random() * 0.4, sz: 1 + Math.random() * 2.2,
                c: Math.random() < 0.5 ? SILVER_HI : CREAM,
              });
            }
            if (powder.length > 200) powder.splice(0, powder.length - 200);
          }
          if (wipeT >= WIPE_DUR) { erasing = false; count = 0; startIdx = 0; }
        }
        shudT += dt;
        const senv = shudT < 1 ? Math.exp(-shudT * 7) : 0;
        const shX = senv * Math.sin(shudT * 55) * m * 0.02;
        const shY = senv * Math.cos(shudT * 47) * m * 0.014;

        // ---- paint ----
        const W = env.w, H = env.h;
        g.fillStyle = bg; g.fillRect(0, 0, W, H);

        g.save();
        g.translate(shX, shY);
        g.lineJoin = 'round'; g.lineCap = 'round';

        // amber body
        roundRect(FX0, FY0, FX1 - FX0, FY1 - FY0, Rout);
        g.fillStyle = AMBER; g.fill();
        const bgr = g.createLinearGradient(0, FY0, 0, FY1);
        bgr.addColorStop(0, 'rgba(255,251,243,0.28)');
        bgr.addColorStop(0.4, 'rgba(255,251,243,0)');
        bgr.addColorStop(1, 'rgba(60,40,6,0.34)');
        g.fillStyle = bgr; g.fill();
        g.strokeStyle = AMBER_DK; g.lineWidth = Math.max(2, m * 0.01);
        roundRect(FX0, FY0, FX1 - FX0, FY1 - FY0, Rout); g.stroke();

        // coral banner with two cream studs
        roundRect(bandX0, bandY0, bandX1 - bandX0, bandY1 - bandY0, Math.min(Rscr, (bandY1 - bandY0) * 0.5));
        g.fillStyle = CORAL; g.fill();
        const cgr = g.createLinearGradient(0, bandY0, 0, bandY1);
        cgr.addColorStop(0, 'rgba(255,251,243,0.3)');
        cgr.addColorStop(1, 'rgba(120,30,26,0.3)');
        g.fillStyle = cgr; g.fill();
        const bcy = (bandY0 + bandY1) / 2, br2 = Math.max(2, (bandY1 - bandY0) * 0.16);
        g.fillStyle = 'rgba(242,233,220,0.85)';
        g.beginPath(); g.arc(bandX0 + br2 * 2.2, bcy, br2, 0, TAU); g.fill();
        g.beginPath(); g.arc(bandX1 - br2 * 2.2, bcy, br2, 0, TAU); g.fill();

        // dark recess around the screen
        roundRect(SX0 - m * 0.016, SY0 - m * 0.016, SW + m * 0.032, SH + m * 0.032, Rscr + m * 0.014);
        g.fillStyle = AMBER_DK; g.fill();

        // ---- screen ----
        g.save();
        roundRect(SX0, SY0, SW, SH, Rscr);
        g.clip();
        g.fillStyle = SILVER; g.fillRect(SX0, SY0, SW, SH);
        const vg = g.createRadialGradient(SX0 + SW / 2, SY0 + SH / 2, SH * 0.2,
          SX0 + SW / 2, SY0 + SH / 2, Math.hypot(SW, SH) * 0.55);
        vg.addColorStop(0, 'rgba(200,200,206,0.2)');
        vg.addColorStop(1, 'rgba(60,60,66,0.3)');
        g.fillStyle = vg; g.fillRect(SX0, SY0, SW, SH);
        const sweep = ((t * 0.06) % 1) * 1.6 - 0.3;         // moving metallic sheen
        const gx = SX0 + sweep * SW;
        const shg = g.createLinearGradient(gx - SW * 0.22, SY0, gx + SW * 0.22, SY1);
        shg.addColorStop(0, 'rgba(230,230,236,0)');
        shg.addColorStop(0.5, 'rgba(230,230,236,0.12)');
        shg.addColorStop(1, 'rgba(230,230,236,0)');
        g.fillStyle = shg; g.fillRect(SX0, SY0, SW, SH);

        // the scratched polyline (engraved: light powder ridge under a dark groove)
        if (count > 0) {
          g.save();
          if (erasing) {
            const wy = SY0 + Math.min(1.3, wipeYn) * SH;
            g.beginPath(); g.rect(SX0 - 2, wy, SW + 4, SY1 - wy + 3); g.clip();
          }
          g.beginPath();
          for (let i = 0; i < count; i++) {
            const idx = (startIdx + i) % CAP;
            const x = SX0 + buf[idx * 2] * SW, y = SY0 + buf[idx * 2 + 1] * SH;
            if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
          }
          g.lineTo(SX0 + pnx * SW, SY0 + pny * SH);
          g.strokeStyle = 'rgba(206,206,212,' + (0.4 + 0.12 * Math.sin(t * 1.3)).toFixed(3) + ')';
          g.lineWidth = Math.max(4, m * 0.016); g.stroke();
          g.strokeStyle = LINE; g.lineWidth = Math.max(2.4, m * 0.011); g.stroke();
          g.restore();
        }

        // aluminium powder
        if (powder.length) {
          for (let i = powder.length - 1; i >= 0; i--) {
            const q = powder[i];
            q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 320 * dt; q.l -= dt / 0.75;
            if (q.l <= 0 || q.y > SY1 + 6) { powder.splice(i, 1); continue; }
            g.globalAlpha = q.l;
            g.fillStyle = q.c;
            g.fillRect(q.x - q.sz * 0.5, q.y - q.sz * 0.5, q.sz, q.sz);
          }
          g.globalAlpha = 1;
        }

        // bright sweep edge
        if (erasing) {
          const wy = SY0 + Math.min(1, wipeYn) * SH;
          g.strokeStyle = 'rgba(230,230,236,0.85)'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(SX0, wy); g.lineTo(SX1, wy); g.stroke();
          g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(SX0, wy - 1.5); g.lineTo(SX1, wy - 1.5); g.stroke();
        }

        // stylus tip (with a soft idle pulse — a "grab me" cue)
        if (!erasing) {
          const px = SX0 + pnx * SW, py = SY0 + pny * SH;
          const pulse = 0.5 + 0.5 * Math.sin(t * 3.1);
          g.strokeStyle = 'rgba(44,40,36,' + (0.25 + 0.2 * pulse).toFixed(3) + ')';
          g.lineWidth = 1.5;
          g.beginPath(); g.arc(px, py, Math.max(3, m * 0.02) + pulse * 2, 0, TAU); g.stroke();
          g.fillStyle = LINE;
          g.beginPath(); g.arc(px, py, Math.max(2.4, m * 0.012), 0, TAU); g.fill();
          g.fillStyle = 'rgba(232,232,238,0.7)';
          g.beginPath(); g.arc(px - 1, py - 1, Math.max(1, m * 0.004), 0, TAU); g.fill();
        }

        g.restore(); // screen clip

        // knobs (idle quiver, extra jitter during the shudder)
        const jL = (drawing ? 0 : Math.sin(t * 2.3 + lph) * 0.045) + senv * Math.sin(shudT * 40 + lph) * 0.4;
        const jR = (drawing ? 0 : Math.cos(t * 2.1 + rph) * 0.045) + senv * Math.cos(shudT * 44 + rph) * 0.4;
        drawKnob(LKX, LKY, leftAng + jL);
        drawKnob(RKX, RKY, rightAng + jR);

        g.restore(); // shudder
      },

      down(p) {
        ptrX = p.x; ptrY = p.y; havePtr = true; drawing = true;
        pvx = 0; pvy = 0; psp = 0; shakeCharge = 0; frameDX = 0; frameDY = 0;
        if (count === 0) { pushPt(pnx, pny); lastNx = pnx; lastNy = pny; }
      },
      move(p) {
        const dx = havePtr ? p.x - ptrX : 0, dy = havePtr ? p.y - ptrY : 0;
        ptrX = p.x; ptrY = p.y; havePtr = true;
        if (p.held && drawing && !erasing) {
          frameDX += dx; frameDY += dy;
          const opx = pnx * SW, opy = pny * SH;
          pnx = clampN(pnx + dx / (SW + 1e-6));
          pny = clampN(pny + dy / (SH + 1e-6));
          leftAng += (pnx * SW - opx) / (kr + 1e-6);        // left knob = horizontal
          rightAng += (pny * SH - opy) / (kr + 1e-6);       // right knob = vertical
          const ddx = (pnx - lastNx) * SW, ddy = (pny - lastNy) * SH;
          if (ddx * ddx + ddy * ddy > 5) { pushPt(pnx, pny); lastNx = pnx; lastNy = pny; }
        }
      },
      up() {
        drawing = false; psp = 0;
        if (count > 0) { pushPt(pnx, pny); lastNx = pnx; lastNy = pny; }
      },
      leave() { havePtr = false; },
      resize() { layout(); },
    };
  },
});
