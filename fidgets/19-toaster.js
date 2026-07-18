/* № 19 — Toaster. Hold to lower the lever and toast the slice — the slot glows,
   the bread darkens, smoke rises. Release to launch it tumbling; drag it back
   over the slot to reload. Leave it on the floor and it sadly shuffles home. */
F.register({
  n: 19, id: 'toaster', cat: 'chaos',
  title: 'Toaster', hint: 'Hold to toast. Release to launch',
  make(env) {
    const { g, inks, bg } = env;
    const TAU = Math.PI * 2, CREAM = [242, 233, 220], AMBER = [245, 165, 36], CORAL = [242, 102, 91], BURNT = [46, 29, 16];
    let W, H, m, cx, tw, th, x0, y0, bodyBot, floorY, slw, seatY, downY, bw, bh, levX, levT, levB, gA, gC, gBody;
    const B = { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0, toast: 0, q: 0, qv: 0, yv: 0, st: 'in', ground: 0, timer: 0, rest: 0 };
    let held = false, htime = 0, heat = 0, lev = 0, levV = 0, drag = null;
    const dragT = { x: 0, y: 0 };
    let vxs = 0, vys = 0, home = false, launchClip = false, hopPh = 0, hopStep = 0;
    const wisps = [], smoke = [];
    for (let i = 0; i < 8; i++) wisps.push({ x: 0, y: 0, ph: Math.random() * TAU, sp: 0, life: 0 });
    for (let i = 0; i < 3; i++) smoke.push({ x: 0, y: 0, r: 0, a: 0 });
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const mixc = (a, b, u) => 'rgb(' + (a[0] + (b[0] - a[0]) * u | 0) + ',' + (a[1] + (b[1] - a[1]) * u | 0) + ',' + (a[2] + (b[2] - a[2]) * u | 0) + ')';
    const tcol = k => k < 0.55 ? mixc(CREAM, AMBER, k / 0.55) : mixc(AMBER, BURNT, (k - 0.55) / 0.45);
    const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

    function layout() {
      W = env.w; H = env.h; m = Math.min(W, H); cx = W * 0.5;
      tw = 0.56 * m; th = 0.30 * m; floorY = H - 0.055 * m; bodyBot = floorY - 0.022 * m;
      y0 = bodyBot - th; x0 = cx - tw / 2;
      slw = 0.30 * m; bw = 0.235 * m; bh = 0.26 * m;
      seatY = y0 - bh * 0.24; downY = y0 + bh * 0.44;
      levX = x0 + tw + 0.03 * m; levT = y0 + th * 0.16; levB = y0 + th * 0.60;
      gA = g.createRadialGradient(cx, y0, 2, cx, y0, m * 0.30);
      gA.addColorStop(0, 'rgba(245,165,36,0.55)'); gA.addColorStop(1, 'rgba(245,165,36,0)');
      gC = g.createRadialGradient(cx, y0, 2, cx, y0, m * 0.26);
      gC.addColorStop(0, 'rgba(242,102,91,0.6)'); gC.addColorStop(1, 'rgba(242,102,91,0)');
      gBody = g.createLinearGradient(0, y0, 0, bodyBot);
      gBody.addColorStop(0, 'rgba(242,233,220,0.30)'); gBody.addColorStop(0.25, 'rgba(88,166,242,0.14)');
      gBody.addColorStop(0.75, 'rgba(242,233,220,0.06)'); gBody.addColorStop(1, 'rgba(88,166,242,0.10)');
      if (B.st === 'in' || B.st === 'toast') { B.x = cx; B.y = seatY; }
      else { B.x = clamp(B.x, bw / 2, W - bw / 2); B.y = Math.min(B.y, floorY - bh / 2); B.ground = floorY; }
    }
    layout(); B.x = cx; B.y = seatY;

    function rr(x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      g.beginPath();
      g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
      g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
      g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
    }
    function breadPath(s) {
      const w2 = bw * 0.5 * s, h2 = bh * 0.5 * s, r = w2 * 0.3;
      g.beginPath();
      g.moveTo(-w2 + r, h2); g.lineTo(w2 - r, h2); g.quadraticCurveTo(w2, h2, w2, h2 - r);
      g.lineTo(w2, -h2 * 0.12); g.quadraticCurveTo(w2, -h2, w2 * 0.34, -h2);
      g.quadraticCurveTo(0, -h2 * 0.76, -w2 * 0.34, -h2);
      g.quadraticCurveTo(-w2, -h2, -w2, -h2 * 0.12);
      g.lineTo(-w2, h2 - r); g.quadraticCurveTo(-w2, h2, -w2 + r, h2); g.closePath();
    }
    function drawBread(t) {
      const inSlot = B.st === 'in' || B.st === 'toast';
      const clip = inSlot || (B.st === 'fly' && (launchClip || home) && B.y + bh * 0.6 > y0);
      g.save();
      if (clip) { g.beginPath(); g.rect(-20, -H, W + 40, H + y0 + m * 0.012); g.clip(); }
      const bob = (B.st === 'in' && !held) ? Math.sin(t * 2.1) * m * 0.006 : 0;
      g.translate(B.x, B.y + bob); g.rotate(B.rot);
      const q = clamp(B.q, -0.35, 0.35); g.scale(1 + q, 1 / (1 + q));
      g.lineJoin = g.lineCap = 'round';
      g.fillStyle = tcol(clamp(B.toast * 0.8 + 0.3, 0, 1)); breadPath(1); g.fill();
      g.strokeStyle = 'rgba(242,233,220,0.4)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = tcol(B.toast); breadPath(0.78); g.fill();
      const ink = B.toast > 0.62 ? 'rgba(242,233,220,0.92)' : bg;
      const mood = B.st === 'walk' ? 3 : B.toast > 0.72 ? 2 : B.toast > 0.3 ? 1 : 0;
      const ex = bw * 0.15, ey = -bh * 0.07, my = bh * 0.1;
      g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 2.2;
      const blink = mood < 2 && ((t * 0.71 + 0.4) % 3.3) < 0.13;
      for (const s of [-1, 1]) {
        if (blink) { g.beginPath(); g.moveTo(s * ex - bw * 0.05, ey); g.lineTo(s * ex + bw * 0.05, ey); g.stroke(); }
        else { g.beginPath(); g.arc(s * ex, ey, mood === 2 ? bw * 0.065 : bw * 0.042, 0, TAU); g.fill(); }
        if (mood >= 2) {
          g.beginPath();
          if (mood === 2) { g.moveTo(s * ex - s * bw * 0.06, ey - bh * 0.085); g.lineTo(s * ex + s * bw * 0.06, ey - bh * 0.13); }
          else { g.moveTo(s * ex - s * bw * 0.06, ey - bh * 0.13); g.lineTo(s * ex + s * bw * 0.06, ey - bh * 0.08); }
          g.stroke();
        }
      }
      g.beginPath();
      if (mood === 0) { g.moveTo(-bw * 0.09, my); g.lineTo(bw * 0.09, my); g.stroke(); }
      else if (mood === 1) { g.arc(0, my - bw * 0.03, bw * 0.13, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke(); }
      else if (mood === 2) { g.arc(0, my + bw * 0.02, bw * 0.07, 0, TAU); g.fill(); }
      else { g.arc(0, my + bw * 0.17, bw * 0.13, 1.25 * Math.PI, 1.75 * Math.PI); g.stroke(); }
      g.restore();
    }
    function drawToaster(t) {
      g.strokeStyle = 'rgba(242,233,220,0.14)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, floorY); g.lineTo(W, floorY); g.stroke();
      g.fillStyle = 'rgba(242,233,220,0.35)';
      rr(x0 + tw * 0.10, bodyBot - 2, tw * 0.12, floorY - bodyBot + 2, 3); g.fill();
      rr(x0 + tw * 0.78, bodyBot - 2, tw * 0.12, floorY - bodyBot + 2, 3); g.fill();
      rr(x0, y0, tw, th, m * 0.055);
      g.fillStyle = bg; g.fill(); g.fillStyle = gBody; g.fill();
      g.strokeStyle = 'rgba(242,233,220,0.6)'; g.lineWidth = 2.5; g.stroke();
      const sx = x0 - m * 0.2 + ((t * 0.16) % 1.45) * (tw + m * 0.4);
      g.save(); rr(x0, y0, tw, th, m * 0.055); g.clip();
      g.translate(sx, y0); g.rotate(-0.26); g.fillStyle = inks[5];
      g.globalAlpha = 0.10; g.fillRect(-m * 0.012, -m * 0.05, m * 0.024, th * 1.4);
      g.globalAlpha = 0.05; g.fillRect(m * 0.03, -m * 0.05, m * 0.05, th * 1.4);
      g.restore(); g.globalAlpha = 1;
      rr(cx - slw / 2, y0 - m * 0.014, slw, m * 0.05, m * 0.02);
      g.fillStyle = bg; g.fill();
      g.strokeStyle = 'rgba(242,233,220,0.4)'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = 'rgba(242,233,220,0.35)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(levX, levT); g.lineTo(levX, levB); g.stroke();
      const ky = levT + (levB - levT) * clamp(lev, -0.15, 1.15);
      g.fillStyle = inks[1];
      rr(levX - m * 0.012, ky - m * 0.017, m * 0.055, m * 0.034, m * 0.012); g.fill();
      g.strokeStyle = 'rgba(242,233,220,0.5)'; g.lineWidth = 2; g.stroke();
      const gl = Math.pow(Math.max(0, Math.sin(t * 1.25 + 2)), 24);
      if (gl > 0.02) {
        g.strokeStyle = 'rgba(242,233,220,' + (0.85 * gl).toFixed(3) + ')'; g.lineWidth = 2;
        const gx = levX + m * 0.036, gy = ky - m * 0.012, s = m * 0.014;
        g.beginPath(); g.moveTo(gx - s, gy); g.lineTo(gx + s, gy); g.moveTo(gx, gy - s); g.lineTo(gx, gy + s); g.stroke();
      }
    }
    function step(dt) {
      const G = 4.3 * m, idt = 1 / Math.max(dt, 1e-3);
      levV += (((held ? 1 : 0) - lev) * 190 - levV * 11) * dt; lev += levV * dt;
      if (held && B.st === 'toast') {
        htime += dt; heat = Math.min(1, heat + dt / 1.1);
        B.toast = Math.min(1, B.toast + dt * (0.13 + 0.17 * heat));
        B.y += (seatY + (downY - seatY) * clamp(lev, 0, 1) - B.y) * Math.min(1, dt * 14);
        B.x += (cx - B.x) * Math.min(1, dt * 14);
      } else heat = Math.max(0, heat - dt * 1.5);
      B.qv += (-B.q * 170 - B.qv * 11) * dt; B.q += B.qv * dt;
      if (B.st === 'in') {
        B.yv += ((seatY - B.y) * 180 - B.yv * 10) * dt; B.y += B.yv * dt;
        B.x += (cx - B.x) * Math.min(1, dt * 12);
        B.rot += (0 - B.rot) * Math.min(1, dt * 10);
      } else if (B.st === 'fly') {
        B.vy = clamp(B.vy + G * dt, -4 * m, 4 * m);
        if (home) B.x += (cx - B.x) * Math.min(1, dt * 6); else B.x += B.vx * dt;
        B.y += B.vy * dt; B.rot += B.vrot * dt;
        if (launchClip && B.y + bh * 0.6 < y0) launchClip = false;
        if (B.x < bw * 0.4) { B.x = bw * 0.4; B.vx = Math.abs(B.vx) * 0.6; }
        if (B.x > W - bw * 0.4) { B.x = W - bw * 0.4; B.vx = -Math.abs(B.vx) * 0.6; }
        if (B.vy > 0 && !launchClip && Math.abs(B.x - cx) < slw * 0.42 && B.y > seatY - bh * 0.06 && B.y < y0 + bh * 0.4) {
          B.st = 'in'; B.yv = Math.min(B.vy * 0.4, m * 1.4); B.vy = B.vx = B.vrot = 0;
          B.rot = wrap(B.rot); B.q = -0.2; if (home) B.toast = 0; home = launchClip = false;
        } else {
          const gy = (B.x > x0 - bw * 0.2 && B.x < x0 + tw + bw * 0.2) ? y0 : floorY;
          if (B.vy > 0 && B.y + bh * 0.5 > gy) {
            B.y = gy - bh * 0.5; B.q = Math.min(0.32, B.q + B.vy / (m * 6));
            if (B.vy < 0.26 * m) {
              B.st = 'floor'; B.ground = gy; B.timer = 0; B.vy = 0; home = false;
              B.rot = wrap(B.rot); B.rest = Math.round(B.rot / (Math.PI / 2)) * (Math.PI / 2);
            } else { B.vy *= -0.45; B.vx *= 0.72; B.vrot *= 0.5; }
          }
        }
      } else if (B.st === 'floor') {
        B.timer += dt; B.rot += (B.rest - B.rot) * Math.min(1, dt * 7);
        const half = (Math.abs(Math.sin(B.rest)) > 0.5 ? bw : bh) * 0.5;
        B.y += (B.ground - half - B.y) * Math.min(1, dt * 9);
        B.x += B.vx * dt; B.vx *= Math.pow(0.02, dt);
        if (B.timer > 6) { B.st = 'walk'; hopPh = 0; hopStep = 0; }
      } else if (B.st === 'walk') {
        const dir = cx > B.x ? 1 : -1;
        B.rot = wrap(B.rot); B.rot += (0 - B.rot) * Math.min(1, dt * 5);
        hopPh += dt * 6.5; const hop = Math.abs(Math.sin(hopPh));
        const stp = Math.floor(hopPh / Math.PI);
        if (stp !== hopStep) { hopStep = stp; B.q = 0.14; }
        B.x += dir * m * 0.05 * dt * (0.35 + hop);
        B.y = B.ground - bh * 0.5 - hop * m * 0.024;
        const near = B.ground < floorY - 1 ? Math.abs(B.x - cx) < slw * 0.35
          : (B.x > x0 - bw * 0.6 && B.x < x0 + tw + bw * 0.6);
        if (near) {
          const dh = Math.max(m * 0.04, B.y - seatY + m * 0.10);
          B.st = 'fly'; home = true; launchClip = false;
          B.vy = -Math.sqrt(2 * G * dh); B.vx = 0; B.vrot = dir * 2.4; B.q = -0.18;
        }
      } else if (B.st === 'drag') {
        const px = B.x, py = B.y, k = Math.min(1, dt * 16);
        B.x += (dragT.x - B.x) * k; B.y += (dragT.y - B.y) * k;
        vxs = vxs * 0.7 + 0.3 * (B.x - px) * idt; vys = vys * 0.7 + 0.3 * (B.y - py) * idt;
        B.rot = wrap(B.rot); B.rot += (clamp(vxs / (m * 4), -0.5, 0.5) - B.rot) * Math.min(1, dt * 9);
      }
      for (const w of wisps) {
        if (w.life <= 0) {
          if (held && B.st === 'toast' && heat > 0.18 && Math.random() < dt * 8) {
            w.x = cx + (Math.random() - 0.5) * slw * 0.7; w.y = y0 - m * 0.01;
            w.sp = (0.13 + Math.random() * 0.12) * m; w.life = 0.7 + Math.random() * 0.5; w.ph = Math.random() * TAU;
          }
        } else { w.y -= w.sp * dt; w.life -= dt * 1.1; }
      }
      const smoking = B.toast > 0.82, slot = B.st === 'in' || B.st === 'toast';
      for (const s of smoke) {
        if (s.a <= 0) {
          if (smoking && Math.random() < dt * 2.2) {
            s.x = (slot ? cx : B.x) + (Math.random() - 0.5) * bw * 0.5;
            s.y = slot ? y0 - m * 0.01 : B.y - bh * 0.35;
            s.r = m * 0.014; s.a = 0.9;
          }
        } else { s.y -= m * 0.09 * dt; s.x += Math.sin(s.a * 9) * m * 0.03 * dt; s.r += m * 0.035 * dt; s.a -= dt * 0.55; }
      }
    }
    return {
      draw(t, dt) {
        if (W !== env.w || H !== env.h) layout();
        step(dt);
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        for (const w of wisps) if (w.life > 0) {
          g.globalAlpha = Math.min(0.4, w.life * (0.15 + heat) * 0.45); g.strokeStyle = inks[0]; g.lineWidth = 2;
          const wx = w.x + Math.sin(w.ph + w.y * 0.05) * m * 0.012;
          g.beginPath(); g.moveTo(wx, w.y); g.quadraticCurveTo(wx + m * 0.01, w.y - m * 0.02, wx, w.y - m * 0.038); g.stroke();
        }
        for (const s of smoke) if (s.a > 0) {
          g.globalAlpha = s.a * 0.22; g.fillStyle = inks[5];
          g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
        }
        g.globalAlpha = 1;
        drawToaster(t);
        if (heat > 0.01) {
          const hh = heat * heat;
          g.globalAlpha = heat * (1 - hh * 0.6); g.fillStyle = gA;
          g.fillRect(cx - m * 0.3, y0 - m * 0.3, m * 0.6, m * 0.38);
          g.globalAlpha = heat * hh; g.fillStyle = gC;
          g.fillRect(cx - m * 0.3, y0 - m * 0.3, m * 0.6, m * 0.38);
          g.globalAlpha = 1;
        }
        drawBread(t);
        if (heat > 0.01) {
          rr(cx - slw / 2, y0 - m * 0.014, slw, m * 0.05, m * 0.02);
          g.strokeStyle = mixc(AMBER, CORAL, heat); g.globalAlpha = heat; g.lineWidth = 2.5; g.stroke();
          g.globalAlpha = heat * 0.3; g.lineWidth = 6; g.stroke(); g.globalAlpha = 1;
        }
      },
      down(p) {
        held = true;
        if ((B.st === 'floor' || B.st === 'walk') && Math.hypot(p.x - B.x, p.y - B.y) < Math.max(bw, bh) * 0.7) {
          B.st = 'drag'; drag = { dx: B.x - p.x, dy: B.y - p.y };
          dragT.x = B.x; dragT.y = B.y; vxs = vys = 0; B.timer = 0;
        } else if (B.st === 'in') { B.st = 'toast'; htime = 0; }
      },
      move(p) {
        if (drag && p.held && B.st === 'drag') { dragT.x = p.x + drag.dx; dragT.y = p.y + drag.dy; }
      },
      up() {
        held = false;
        if (B.st === 'toast') {
          const pow = Math.min(3.2, htime);
          B.vy = -(1.15 + pow * 0.62) * m;
          B.vx = (Math.random() - 0.5) * 0.55 * m;
          B.vrot = (Math.random() < 0.5 ? -1 : 1) * (2.2 + Math.random() * 2.5 + pow * 1.3);
          B.st = 'fly'; home = false; launchClip = true; B.q = -0.22;
        } else if (B.st === 'drag') {
          if (Math.abs(B.x - cx) < slw * 0.8 && B.y < y0 + th * 0.35) {
            B.st = 'in'; B.yv = m * 0.9; B.q = -0.16; B.rot = wrap(B.rot); B.toast = 0;
            home = launchClip = false;
          } else {
            B.st = 'fly'; home = launchClip = false;
            B.vx = clamp(vxs, -2.5 * m, 2.5 * m); B.vy = clamp(vys, -2.5 * m, 2.5 * m);
            B.vrot = clamp(vxs * 0.012, -9, 9);
          }
        }
        drag = null;
      },
      resize() { layout(); },
    };
  },
});
