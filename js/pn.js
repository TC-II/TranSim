'use strict';
TS.PN = (() => {
  const { UT, NI, C, clamp, lerp } = TS;
  const NA = 1e16, ND = 5e16, LN = 0.55, LP = 0.4;   // longitudes de difusión ilustrativas [µm]
  const IS = 1e-15;
  const phiP = UT * Math.log(NA / NI), phiN = UT * Math.log(ND / NI), VBI = phiP + phiN;
  const XL = -2, XR = 2;                              // extensión del dispositivo [µm]
  const st = { Va: 0, logI: true, speed: 1 };
  const M = { dirty: true };
  let xsec, pBand, pIV, pRho, pE, pPsi, holes, elecs, flow = [], flashes = [], accN = 0, accP = 0, accG = 0;
  const r = TS.rng(11);

  const W = Va => Math.sqrt(2 * TS.EPS_SI * Math.max(VBI - Va, 0.02) * (1 / NA + 1 / ND) / TS.Q) * 1e4; // µm
  const geom = Va => { const w = W(Va); return { w, xp: w * ND / (NA + ND), xn: w * NA / (NA + ND) }; };
  const current = Va => IS * (Math.exp(Va / UT) - 1);
  const toU = x => (x - XL) / (XR - XL);              // µm -> [0,1]

  function init() {
    const $ = id => document.getElementById(id);
    xsec = new TS.Surface($('pn-xsec'));
    pBand = new TS.Plot($('pn-band')); pIV = new TS.Plot($('pn-iv'));
    pRho = new TS.Plot($('pn-rho')); pE = new TS.Plot($('pn-field')); pPsi = new TS.Plot($('pn-pot'));
    holes = new TS.Cloud(300, rr => [rr() * 0.5, 0.04 + 0.92 * rr()], 3);
    elecs = new TS.Cloud(340, rr => [0.5 + rr() * 0.5, 0.04 + 0.92 * rr()], 4);
    TS.bindControls($('tab-pn'), st, () => { M.dirty = true; });
  }

  function profile(Va, N = 300) {
    const g = geom(Va);
    const xs = TS.linspace(XL, XR, N);
    const psiP = -phiP + Va, psiN = phiN;
    const Ei = [], EFn = [], EFp = [], n = [], p = [], psi = [];
    const ex = Math.exp(Va / UT) - 1;
    for (const x of xs) {
      const ps = TS.junctionPsi(x, 0, g.xp, g.xn, psiP, psiN);
      psi.push(ps);
      const ei = -ps;
      Ei.push(ei);
      let efn, efp;
      if (x < -g.xp) {                       // lado p neutro: electrones minoritarios
        efp = -Va;
        const nn = (NI * NI / NA) * (1 + ex * Math.exp((x + g.xp) / LN));
        efn = ei + UT * Math.log(Math.max(nn, 1e-300) / NI);
      } else if (x > g.xn) {                 // lado n neutro: huecos minoritarios
        efn = 0;
        const pp = (NI * NI / ND) * (1 + ex * Math.exp(-(x - g.xn) / LP));
        efp = ei - UT * Math.log(Math.max(pp, 1e-300) / NI);
      } else { efn = 0; efp = -Va; }
      EFn.push(efn); EFp.push(efp);
      n.push(Math.exp((efn - ei) / UT)); p.push(Math.exp((ei - efp) / UT));
    }
    return { xs, Ei, EFn, EFp, n, p, psi, g };
  }

  function drawPlots() {
    const Va = st.Va, pr = profile(Va), g = pr.g;
    // bandas
    TS.drawBands(pBand, {
      xs: pr.xs, Ei: pr.Ei, EFn: pr.EFn, EFp: pr.EFp, n: pr.n, p: pr.p, xlabel: 'x [µm]',
      regions: [
        { x0: XL, x1: -g.xp, label: 'p neutro', color: 'rgba(110,46,66,.18)' },
        { x0: -g.xp, x1: g.xn, label: 'vaciamiento', color: 'rgba(255,255,255,.05)' },
        { x0: g.xn, x1: XR, label: 'n neutro', color: 'rgba(43,85,146,.18)' },
      ],
      post: pl => {
        const yA = -Va, yB = 0, xx = 1.75;
        if (Math.abs(Va) > 0.05) {
          TS.arrow(pl.ctx, pl.X(xx), pl.Y(yB), pl.X(xx), pl.Y(yA), C.accent2, 1.5, 6);
          pl.text(xx - 0.05, (yA + yB) / 2, `qV_A = ${Va.toFixed(2)} eV`, C.accent2, 'right');
        }
        pl.text(-1.95, { py: pl.y0 + 10 }, `barrera q(V_bi−V_A) = ${(VBI - Va).toFixed(2)} eV`, C.accent2, 'left', 'middle', 'bold 11px Inter, sans-serif');
      },
      legendCorner: 'br',
    });
    // I–V
    const I = current(Va);
    if (st.logI) {
      pIV.frame({ xmin: -5, xmax: 0.8, ymin: 1e-16, ymax: 1, ylog: true, yunit: 'A', xlabel: 'V_A [V]', ylabel: '|I|' });
      pIV.fn(v => Math.abs(current(v)), -5, 0.8, C.accent, 2, null, 400);
      pIV.point(Va, Math.max(Math.abs(I), 1e-16));
    } else {
      const ym = current(0.8);
      pIV.frame({ xmin: -5, xmax: 0.8, ymin: -0.05 * ym, ymax: ym * 1.05, yunit: 'A', xlabel: 'V_A [V]', ylabel: 'I' });
      pIV.fn(current, -5, 0.8, C.accent, 2, null, 400);
      pIV.point(Va, I);
    }
    pIV.vline(0, C.axis);
    pIV.text({ px: pIV.x0 + 8 }, { py: pIV.y0 + 12 }, 'Inversa', C.muted);
    pIV.text({ px: pIV.x1 - 8 }, { py: pIV.y0 + 12 }, 'Directa', C.muted, 'right');
    // ρ, E, ψ
    const xs = pr.xs;
    const rho = xs.map(x => (x >= -g.xp && x < 0 ? -NA : x >= 0 && x <= g.xn ? ND : 0) / 1e16);
    pRho.frame({ xmin: XL, xmax: XR, ymin: -1.4, ymax: 5.6, xlabel: 'x [µm]', ylabel: 'ρ/q [10¹⁶ cm⁻³]', mb: 30 });
    pRho.fillBetween(xs, rho, xs.map(() => 0), 'rgba(90,176,255,.25)');
    pRho.line(xs, rho, C.accent, 2);
    pRho.text(-g.xp / 2, -1.2, '−qN_A', C.hole, 'center');
    pRho.text(g.xn / 2 + 0.25, 5.3, '+qN_D', C.electron, 'left');
    const gmax = geom(-5), Emax5 = TS.Q * NA * gmax.xp * 1e-4 / TS.EPS_SI / 1e3;
    const E = xs.map(x => {
      if (x < -g.xp || x > g.xn) return 0;
      return x < 0 ? -TS.Q * NA * (x + g.xp) * 1e-4 / TS.EPS_SI / 1e3 : -TS.Q * ND * (g.xn - x) * 1e-4 / TS.EPS_SI / 1e3;
    });
    pE.frame({ xmin: XL, xmax: XR, ymin: -Emax5 * 1.1, ymax: Emax5 * 0.1, xlabel: 'x [µm]', ylabel: 'E [kV/cm]', mb: 30 });
    pE.fillBetween(xs, E, xs.map(() => 0), 'rgba(255,180,84,.25)');
    pE.line(xs, E, C.accent2, 2);
    pE.text(0.1, Math.min(...E) * 1.02, `|E|máx = ${(-Math.min(...E)).toFixed(1)} kV/cm`, C.text, 'left', 'top');
    pPsi.frame({ xmin: XL, xmax: XR, ymin: -phiP - 5.2, ymax: phiN + 0.9, xlabel: 'x [µm]', ylabel: 'ψ [V]', mb: 30 });
    pPsi.line(xs, pr.psi, C.ok, 2);
    pPsi.text(-1.9, pr.psi[0] + 0.25, 'ψ_p = −φ_p + V_A', C.muted, 'left', 'bottom');
  }

  function spawnFlash(u, v, color) { flashes.push({ u, v, t: 0, color }); }

  function step(dt) {
    const Va = st.Va, g = geom(Va), I = current(Va);
    const uP = toU(-g.xp), uN = toU(g.xn);
    holes.update(dt); elecs.update(dt);
    // inyección en directa
    const R = TS.visRate(I, 1e-12, 1e-2, 70);
    accN += R * 0.75 * dt; accP += R * 0.25 * dt;
    while (accN >= 1) { accN--; flow.push({ k: 'e', u: uN, v: 0.05 + 0.9 * r(), life: -Math.log(r() + 1e-9) * LN, d: 0 }); }
    while (accP >= 1) { accP--; flow.push({ k: 'h', u: uP, v: 0.05 + 0.9 * r(), life: -Math.log(r() + 1e-9) * LP, d: 0 }); }
    // generación térmica (exagerada) en inversa
    if (Va < 0) {
      accG += (1.5 + 2.5 * (g.w / W(0))) * dt;
      while (accG >= 1) {
        accG--;
        const uu = lerp(uP - 0.04, uN + 0.04, r()), vv = 0.05 + 0.9 * r();
        flow.push({ k: 'ge', u: uu, v: vv, life: 9, d: 0 });
        flow.push({ k: 'gh', u: uu, v: vv, life: 9, d: 0 });
        spawnFlash(uu, vv, '#ffffff');
      }
    }
    const umPerU = XR - XL;
    for (const f of flow) {
      const inDep = f.u > uP && f.u < uN;
      let vel;
      if (f.k === 'e') vel = inDep ? -0.6 : -(0.05 + 0.08 * r());       // hacia p
      else if (f.k === 'h') vel = inDep ? 0.6 : (0.05 + 0.08 * r());    // hacia n
      else if (f.k === 'ge') vel = inDep ? 0.45 : 0.15;                 // generado: electrón a n
      else vel = inDep ? -0.45 : -0.15;                                 // generado: hueco a p
      const du = vel * dt * st.speed;
      f.u += du + (inDep ? 0 : (r() - 0.5) * 0.004 * st.speed);
      f.v = clamp(f.v + (r() - 0.5) * 0.03 * st.speed, 0.03, 0.97);
      if (!inDep) f.d += Math.abs(du) * umPerU;
      if (f.d > f.life || f.u < 0.01 || f.u > 0.99) {
        f.dead = true;
        if ((f.k === 'e' || f.k === 'h') && f.u > 0.01 && f.u < 0.99) spawnFlash(f.u, f.v, '#ffe08a');
      }
    }
    flow = flow.filter(f => !f.dead);
    for (const fl of flashes) fl.t += dt * st.speed;
    flashes = flashes.filter(fl => fl.t < 0.45);
  }

  function drawXsec() {
    const s = xsec, c = s.ctx, w = s.w, h = s.h;
    s.clear();
    const Va = st.Va, g = geom(Va);
    const bx0 = 70, bx1 = w - 70, by0 = 54, by1 = h - 44;
    const X = u => lerp(bx0, bx1, u), Y = v => lerp(by0, by1, v);
    const uP = toU(-g.xp), uN = toU(g.xn), uJ = 0.5;
    c.fillStyle = C.pType; c.fillRect(X(0), by0, X(uJ) - X(0), by1 - by0);
    c.fillStyle = C.nType; c.fillRect(X(uJ), by0, X(1) - X(uJ), by1 - by0);
    c.fillStyle = C.depl; c.fillRect(X(uP), by0, X(uN) - X(uP), by1 - by0);
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(X(uJ), by0 - 6); c.lineTo(X(uJ), by1 + 6); c.stroke(); c.setLineDash([]);
    c.strokeStyle = 'rgba(255,255,255,.25)';
    c.strokeRect(X(uP), by0, X(uN) - X(uP), by1 - by0);
    // contactos
    c.fillStyle = C.metal;
    c.fillRect(bx0 - 16, by0 - 6, 16, by1 - by0 + 12);
    c.fillRect(bx1, by0 - 6, 16, by1 - by0 + 12);
    TS.terminal(c, bx0 - 8, by0 - 24, 'Ánodo', Va);
    TS.terminal(c, bx1 + 8, by0 - 24, 'Cátodo', 0);
    // iones y mayoritarios
    const hv = [], hi = [], ev = [], ei = [];
    for (const p of holes.p) (p.bx > uP ? hi.push([X(p.bx), Y(p.by)]) : hv.push([X(p.x), Y(p.y)]));
    for (const p of elecs.p) (p.bx < uN ? ei.push([X(p.bx), Y(p.by)]) : ev.push([X(p.x), Y(p.y)]));
    TS.ions(c, hi, -1, 'rgba(255,150,150,.8)');
    TS.ions(c, ei.filter((_, k) => k % 1 === 0), +1, 'rgba(150,200,255,.8)');
    TS.dots(c, hv, C.hole, 2.1);
    TS.dots(c, ev, C.electron, 2.1);
    // portadores en tránsito
    const fe = [], fh = [];
    for (const f of flow) ((f.k === 'e' || f.k === 'ge') ? fe : fh).push([X(f.u), Y(f.v)]);
    TS.dots(c, fe, '#9fd0ff', 2.6, 8);
    TS.dots(c, fh, '#ffb0b0', 2.6, 8);
    for (const fl of flashes) {
      c.strokeStyle = fl.color; c.globalAlpha = 1 - fl.t / 0.45; c.lineWidth = 1.5;
      c.beginPath(); c.arc(X(fl.u), Y(fl.v), 3 + 14 * fl.t, 0, 6.28); c.stroke();
    }
    c.globalAlpha = 1;
    // campo eléctrico
    const Emax = TS.Q * NA * g.xp * 1e-4 / TS.EPS_SI;
    const ay = by1 + 20;
    TS.arrow(c, X(uN), ay, X(uP), ay, C.accent2, 2);
    TS.label(c, (X(uP) + X(uN)) / 2, ay + 13, `E (máx ${(Emax / 1e3).toFixed(0)} kV/cm)`, C.accent2, 'center', '11px Inter, sans-serif');
    // mecanismos de transporte
    const tY = by0 + 16, bY = by1 - 14, xd = (X(uP) + X(uN)) / 2;
    if (Va > 0.05) {
      TS.tag(c, X(uP) - 8, tY, 'difusion', 'e⁻ minoritarios', 'right');
      TS.tag(c, X(uN) + 8, tY, 'difusion', 'h⁺ minoritarios', 'left');
      TS.tag(c, xd, (by0 + by1) / 2, 'ambos', 'casi en equilibrio');
      TS.tag(c, X(0) + 6, bY, 'arrastre', 'h⁺ mayoritarios', 'left');
      TS.tag(c, X(1) - 6, bY, 'arrastre', 'e⁻ mayoritarios', 'right');
    } else if (Va < -0.05) {
      TS.tag(c, xd, tY, 'arrastre', 'pares generados');
      TS.tag(c, X(uP) - 8, bY, 'difusion', 'e⁻ hacia la juntura', 'right');
      TS.tag(c, X(uN) + 8, bY, 'difusion', 'h⁺ hacia la juntura', 'left');
    } else {
      TS.tag(c, xd, tY, 'ambos', 'se cancelan (I = 0)');
    }
    TS.label(c, X(0.22), by0 - 22, 'tipo p  (N_A = 10¹⁶)', C.text);
    TS.label(c, X(0.78), by0 - 22, 'tipo n  (N_D = 5·10¹⁶)', C.text);
    TS.label(c, (X(uP) + X(uN)) / 2, by0 - 8, `W = ${(g.w * 1000).toFixed(0)} nm`, C.muted, 'center', '11px Inter, sans-serif');
  }

  function readouts() {
    const Va = st.Va, g = geom(Va), I = current(Va);
    const badge = document.getElementById('pn-badge');
    if (Va > 0.05) TS.setBadge(badge, 'Polarización directa', C.ok);
    else if (Va < -0.05) TS.setBadge(badge, 'Polarización inversa', C.bad);
    else TS.setBadge(badge, 'Equilibrio', C.accent);
    const Cj = TS.EPS_SI / (g.w * 1e-4) * 1e9; // nF/cm²
    TS.readout(document.getElementById('pn-read'), [
      ['V_bi', VBI.toFixed(3) + ' V'],
      ['Barrera V_bi − V_A', (VBI - Va).toFixed(3) + ' V'],
      ['W', (g.w * 1000).toFixed(1) + ' nm'],
      ['x_p / x_n', (g.xp * 1000).toFixed(0) + ' / ' + (g.xn * 1000).toFixed(0) + ' nm'],
      ['I', TS.fmtSI(I, 'A')],
      ['C_j (por área)', Cj.toFixed(1) + ' nF/cm²'],
      ['n·p en la juntura', 'n_i²·e^(V_A/U_T) = ' + Math.exp(Va / UT).toExponential(1) + '·n_i²'],
    ]);
  }

  M.init = init;
  M.frame = dt => {
    step(dt);
    if (xsec.visible()) drawXsec();
    const plots = [pBand, pIV, pRho, pE, pPsi];
    if (M.dirty || plots.some(p => p.dirty)) {
      drawPlots(); readouts();
      M.dirty = false; plots.forEach(p => (p.dirty = false));
    }
  };
  return M;
})();
