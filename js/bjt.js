'use strict';
TS.BJT = (() => {
  const { UT, NI, C, clamp, lerp } = TS;
  const NE = 1e19, NB = 1e17, NC = 1e16;
  const phiE = UT * Math.log(NE / NI), phiB = UT * Math.log(NB / NI), phiC = UT * Math.log(NC / NI);
  const VBI_EB = phiE + phiB, VBI_BC = phiB + phiC;
  const IS = 1e-15, BR = 2, VON = 0.5;
  // estructura 1D en unidades normalizadas (0..1)
  const XEB = 0.28, XBC = 0.50, LPE = 0.05, LPC = 0.12;
  const st = { Vbe: 0.7, Vce: 3, betaF: 100, VA: 50, view: '1d', speed: 1 };
  const M = { dirty: true };
  let xsec, pOut, pGum, pBand, pMin, op;
  let cE, cB, cC, flow = [], flashes = [], acc = { eF: 0, eR: 0, hE: 0, hC: 0 };
  let planar = null;
  const r = TS.rng(31);

  const ex = v => Math.exp(Math.min(v, 1.0) / UT);
  function model(Vbe, Vce) {
    const Vbc = Vbe - Vce;
    const iF = IS * (ex(Vbe) - 1), iR = IS * (ex(Vbc) - 1);
    const early = Vbc < 0 ? 1 - Vbc / st.VA : 1;
    const Ic = (iF - iR) * early - iR / BR;
    const Ib = iF / st.betaF + iR / BR;
    return { Vbe, Vce, Vbc, iF, iR, Ic, Ib, Ie: Ic + Ib };
  }
  function region(Vbe, Vbc) {
    const be = Vbe > VON, bc = Vbc > VON;
    if (be && !bc) return 'act';
    if (be && bc) return 'sat';
    if (!be && bc) return 'inv';
    return 'cut';
  }
  const REG = {
    act: ['Activa directa', C.ok], sat: ['Saturación', C.warn], inv: ['Activa inversa', C.violet], cut: ['Corte', C.bad],
  };

  // anchos de vaciamiento (unidades normalizadas)
  function depl(Vbe, Vbc) {
    const wEB = 0.045 * Math.sqrt(Math.max(VBI_EB - Vbe, 0.03) / VBI_EB);
    const wBC = 0.085 * Math.sqrt(Math.max(VBI_BC - Vbc, 0.03) / VBI_BC);
    const d = { eE: wEB * 0.15, eB: wEB * 0.85, cB: wBC * NC / (NB + NC) * 1.6, cC: wBC * (1 - NC / (NB + NC) * 1.6) };
    d.b0 = XEB + d.eB; d.b1 = Math.max(XBC - d.cB, d.b0 + 0.004);
    d.WB = d.b1 - d.b0;
    return d;
  }

  function init() {
    const $ = id => document.getElementById(id);
    xsec = new TS.Surface($('bjt-xsec'));
    pOut = new TS.Plot($('bjt-out')); pGum = new TS.Plot($('bjt-gum'));
    pBand = new TS.Plot($('bjt-band')); pMin = new TS.Plot($('bjt-min'));
    cE = new TS.Cloud(240, rr => [rr() * XEB, 0.03 + 0.94 * rr()], 41, 0.004);
    cB = new TS.Cloud(120, rr => [lerp(XEB, XBC, rr()), 0.03 + 0.94 * rr()], 42, 0.004);
    cC = new TS.Cloud(170, rr => [lerp(XBC, 1, rr()), 0.03 + 0.94 * rr()], 43, 0.004);
    TS.bindControls($('tab-bjt'), st, k => { M.dirty = true; if (k === 'view') { flow = []; flashes = []; } });
    const presets = { cut: [0.3, 3], act: [0.7, 3], sat: [0.75, 0.08], inv: [0.2, -0.6] };
    $('bjt-presets').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      [st.Vbe, st.Vce] = presets[b.dataset.p];
      $('tab-bjt').querySelectorAll('[data-key]').forEach(el => el._refresh && el._refresh());
      M.dirty = true;
    }));
    compute();
  }

  function compute() {
    op = model(st.Vbe, st.Vce);
    op.reg = region(op.Vbe, op.Vbc);
    op.d = depl(op.Vbe, op.Vbc);
  }

  // ------------------------------------------------------------ perfiles físicos (bandas y minoritarios)

  function profile(N = 360) {
    const { Vbe, Vce, Vbc, d } = op;
    const xs = TS.linspace(0, 1, N);
    const psiE = phiE, psiB = -phiB + Vbe, psiC = phiC + Vce;
    const eB = Math.exp(Vbe / UT) - 1, eC = Math.exp(Vbc / UT) - 1;
    const Ei = [], EFn = [], EFp = [], n = [], p = [], minE = [], minB = [], minC = [];
    for (const x of xs) {
      const psi = x < (XEB + XBC) / 2 ? TS.junctionPsi(x, XEB, d.eE, d.eB, psiE, psiB) : TS.junctionPsi(x, XBC, d.cB, d.cC, psiB, psiC);
      const ei = -psi;
      let efn, efp, mE = NaN, mB = NaN, mC = NaN;
      if (x < XEB - d.eE) {
        efn = 0;
        const pr = 1 + eB * Math.exp(-(XEB - d.eE - x) / LPE);
        efp = -UT * Math.log(pr); mE = (NI * NI / NE) * pr;
      } else if (x <= d.b0) { efn = 0; efp = -Vbe; }
      else if (x < d.b1) {
        const t = (x - d.b0) / (d.b1 - d.b0);
        const nr = 1 + eB * (1 - t) + eC * t;
        efn = -Vbe + UT * Math.log(Math.max(nr, 1e-300)); efp = -Vbe; mB = (NI * NI / NB) * nr;
      } else if (x <= XBC + d.cC) { efn = -Vce; efp = -Vbe; }
      else {
        efn = -Vce;
        const pr = 1 + eC * Math.exp(-(x - XBC - d.cC) / LPC);
        efp = -Vce - UT * Math.log(Math.max(pr, 1e-300)); mC = (NI * NI / NC) * pr;
      }
      Ei.push(ei); EFn.push(efn); EFp.push(efp);
      n.push(Math.exp((efn - ei) / UT)); p.push(Math.exp((ei - efp) / UT));
      minE.push(mE); minB.push(mB); minC.push(mC);
    }
    return { xs, Ei, EFn, EFp, n, p, minE, minB, minC };
  }

  function drawPlots() {
    const { Vbe, Vce } = op;
    // ---- salida
    const vbeList = [0.64, 0.66, 0.68, 0.70, 0.72, 0.74];
    const yMax = model(0.74, 10).Ic * 1.12;
    pOut.frame({ xmin: -0.5, xmax: 10, ymin: -0.12 * yMax, ymax: yMax, yunit: 'A', xlabel: 'V_CE [V]', ylabel: 'I_C', ml: 62 });
    const loc = TS.linspace(0.55, 0.8, 50).map(vb => [vb - VON, model(vb, vb - VON).Ic]);
    {
      const cx = pOut.ctx; pOut.clip();
      cx.fillStyle = 'rgba(255,204,77,.08)'; cx.beginPath(); cx.moveTo(pOut.X(0), pOut.Y(0));
      for (const [x, y] of loc) cx.lineTo(pOut.X(x), pOut.Y(y));
      cx.lineTo(pOut.X(0), pOut.Y(yMax * 2)); cx.closePath(); cx.fill();
      pOut.unclip();
    }
    pOut.band(-0.5, 0, 'rgba(180,140,255,.07)');
    pOut.hline(0, C.axis, []);
    for (const vb of vbeList) {
      pOut.fn(vc => model(vb, vc).Ic, -0.5, 10, 'rgba(160,175,200,.45)', 1.2, null, 300);
      pOut.text({ px: pOut.x1 - 3 }, model(vb, 10).Ic, `${vb.toFixed(2)} V`, C.muted, 'right', 'bottom', '10px Inter, sans-serif');
    }
    pOut.line(loc.map(p => p[0]), loc.map(p => p[1]), C.warn, 1.3, [5, 4]);
    pOut.fn(vc => model(Vbe, vc).Ic, -0.5, 10, C.accent, 2.4, null, 400);
    pOut.point(Vce, clamp(op.Ic, -0.12 * yMax, yMax));
    pOut.text({ px: pOut.x0 + 50 }, { py: pOut.y0 + 12 }, 'Saturación', C.warn, 'left', 'middle', 'bold 11px Inter, sans-serif');
    pOut.text(5, yMax * 0.93, 'Activa directa', C.ok, 'center', 'middle', 'bold 11px Inter, sans-serif');
    pOut.text(5, { py: pOut.Y(0) - 8 }, 'Corte (I_C ≈ 0)', C.bad, 'center', 'middle', 'bold 11px Inter, sans-serif');
    pOut.text({ px: pOut.X(-0.25) }, { py: pOut.y1 - 10 }, 'inv.', C.violet, 'center', 'middle', '10px Inter, sans-serif');
    pOut.text({ px: pOut.x0 + 50 }, { py: pOut.y0 + 26 }, 'V_CE = V_CE,sat', C.warn, 'left', 'middle', '10px Inter, sans-serif');
    // ---- Gummel
    pGum.frame({ xmin: 0.2, xmax: 0.85, ymin: 1e-14, ymax: 1e-1, ylog: true, yunit: 'A', xlabel: 'V_BE [V]', ylabel: 'I', ml: 62 });
    pGum.fn(vb => model(vb, Vce).Ic, 0.2, 0.85, C.accent, 2.2, null, 300);
    pGum.fn(vb => model(vb, Vce).Ib, 0.2, 0.85, C.hole, 2.2, null, 300);
    if (op.Ic > 0) pGum.point(Vbe, op.Ic, C.accent2);
    if (op.Ib > 0) pGum.point(Vbe, op.Ib, C.accent2);
    pGum.legend([{ label: 'I_C', color: C.accent }, { label: 'I_B', color: C.hole }], 'tl');
    pGum.text(0.83, 1e-13, `V_CE = ${Vce.toFixed(2)} V · pendiente 60 mV/déc`, C.muted, 'right');
    if (op.Ic > 0 && op.Ib > 0) pGum.text(Vbe + 0.01, Math.sqrt(op.Ic * op.Ib), `β = ${(op.Ic / op.Ib).toFixed(1)}`, C.accent2, 'left');
    // ---- bandas
    const pr = profile(), d = op.d;
    TS.drawBands(pBand, {
      xs: pr.xs, Ei: pr.Ei, EFn: pr.EFn, EFp: pr.EFp, n: pr.n, p: pr.p,
      regions: [
        { x0: 0, x1: XEB, label: 'Emisor n⁺', color: 'rgba(43,85,146,.16)' },
        { x0: XEB, x1: XBC, label: 'Base p', color: 'rgba(110,46,66,.16)' },
        { x0: XBC, x1: 1, label: 'Colector n', color: 'rgba(31,53,88,.16)' },
      ],
      legendCorner: 'tr',
      post: pl => {
        pl.text((d.b0 + d.b1) / 2, { py: pl.y0 + 10 }, `W_B = ${(d.WB / (XBC - XEB) * 100).toFixed(0)} % de la base metalúrgica`, C.accent2, 'center', 'middle', 'bold 11px Inter, sans-serif');
      },
    });
    // ---- minoritarios
    const all = [...pr.minE, ...pr.minB, ...pr.minC].filter(isFinite);
    const ym = Math.max(...all, 1) * 1.15;
    pMin.frame({ xmin: 0, xmax: 1, ymin: 0, ymax: ym, xticks: false, xlabel: 'posición', ylabel: 'concentración [cm⁻³]', ml: 62 });
    pMin.band(0, XEB, 'rgba(43,85,146,.12)'); pMin.band(XEB, XBC, 'rgba(110,46,66,.14)'); pMin.band(XBC, 1, 'rgba(31,53,88,.12)');
    pMin.band(XEB - d.eE, d.b0, 'rgba(255,255,255,.05)'); pMin.band(d.b1, XBC + d.cC, 'rgba(255,255,255,.05)');
    pMin.fillBetween(pr.xs, pr.minB.map(v => isFinite(v) ? v : 0), pr.xs.map(() => 0), 'rgba(77,163,255,.18)');
    pMin.line(pr.xs, pr.minB, C.electron, 2.4);
    pMin.line(pr.xs, pr.minE, C.hole, 2.2);
    pMin.line(pr.xs, pr.minC, C.hole, 2.2);
    pMin.legend([{ label: 'n_p (electrones en base)', color: C.electron }, { label: 'p_n (huecos en E y C)', color: C.hole }], 'tr');
    pMin.text(XEB / 2, { py: pMin.y1 - 9 }, 'Emisor', C.muted, 'center');
    pMin.text((XEB + XBC) / 2, { py: pMin.y1 - 9 }, 'Base', C.muted, 'center');
    pMin.text((XBC + 1) / 2, { py: pMin.y1 - 9 }, 'Colector', C.muted, 'center');
    pMin.text((XEB + XBC) / 2, { py: pMin.y0 + 24 }, 'I_C ∝ −dn_p/dx', C.accent2, 'center');
  }

  function readouts() {
    const [name, col] = REG[op.reg];
    TS.setBadge(document.getElementById('bjt-badge'), name, col);
    const gm = op.Ic / UT;
    TS.readout(document.getElementById('bjt-read'), [
      ['V_BC', op.Vbc.toFixed(3) + ' V'],
      ['Juntura BE', op.Vbe > VON ? 'directa' : 'inversa/apagada'],
      ['Juntura BC', op.Vbc > VON ? 'directa' : 'inversa/apagada'],
      ['I_C', TS.fmtSI(op.Ic, 'A')],
      ['I_B', TS.fmtSI(op.Ib, 'A')],
      ['I_E', TS.fmtSI(op.Ie, 'A')],
      ['β efectivo I_C/I_B', op.Ib > 1e-18 ? (op.Ic / op.Ib).toFixed(1) : '—'],
      ['g_m = I_C/U_T', op.Ic > 0 ? TS.fmtSI(gm, 'S') : '—'],
      ['r_π = β/g_m', op.Ic > 0 ? TS.fmtSI(st.betaF / gm, 'Ω') : '—'],
      ['r_o ≈ (V_A+V_CE)/I_C', op.Ic > 0 ? TS.fmtSI((st.VA + op.Vce) / op.Ic, 'Ω') : '—'],
      ['V_bi EB / BC', VBI_EB.toFixed(2) + ' / ' + VBI_BC.toFixed(2) + ' V'],
    ]);
  }

  // ------------------------------------------------------------ animación 1D

  function step1d(dt) {
    const { d } = op;
    const Rf = TS.visRate(op.iF, 1e-12, 1e-2, 80), Rr = TS.visRate(op.iR, 1e-12, 1e-2, 80);
    const fb = Math.min(0.5, 5 / st.betaF);              // corriente de base exagerada ×5
    acc.eF += Rf * dt; acc.eR += Rr * dt; acc.hE += Rf * fb * 0.6 * dt; acc.hC += Rr * 0.35 * dt;
    while (acc.eF >= 1) { acc.eF--; flow.push({ k: 'eF', u: XEB - d.eE - 0.01, v: 0.05 + 0.9 * r(), rec: r() < fb * 0.4 ? lerp(d.b0, d.b1, r()) : null }); }
    while (acc.eR >= 1) { acc.eR--; flow.push({ k: 'eR', u: XBC + d.cC + 0.01, v: 0.05 + 0.9 * r() }); }
    while (acc.hE >= 1) { acc.hE--; flow.push({ k: 'hE', u: lerp(d.b0, d.b1, r()), v: 0.05 + 0.9 * r(), die: XEB - d.eE - 0.02 - r() * 0.12 }); }
    while (acc.hC >= 1) { acc.hC--; flow.push({ k: 'hC', u: lerp(d.b0, d.b1, r()), v: 0.05 + 0.9 * r(), die: XBC + d.cC + 0.02 + r() * 0.2 }); }
    for (const f of flow) {
      const inBase = f.u > d.b0 && f.u < d.b1;
      const inDep = (f.u > XEB - d.eE && f.u < d.b0) || (f.u > d.b1 && f.u < XBC + d.cC);
      let vel;
      if (f.k === 'eF') vel = inDep ? 0.5 : inBase ? 0.07 + 0.05 * r() : 0.12;
      else if (f.k === 'eR') vel = -(inDep ? 0.5 : inBase ? 0.08 : 0.12);
      else if (f.k === 'hE') vel = inDep ? -0.4 : -0.07;
      else vel = inDep ? 0.4 : 0.07;
      f.u += vel * dt + (inBase ? (r() - 0.5) * 0.004 : 0);
      f.v = clamp(f.v + (r() - 0.5) * (inBase ? 0.05 : 0.02), 0.03, 0.97);
      if (f.k === 'eF' && f.rec !== null && f.u >= f.rec) { f.dead = true; flashes.push({ u: f.u, v: f.v, t: 0 }); }
      if ((f.k === 'hE' && f.u <= f.die) || (f.k === 'hC' && f.u >= f.die)) { f.dead = true; flashes.push({ u: f.u, v: f.v, t: 0 }); }
      if (f.u > 1 || f.u < 0) f.dead = true;
    }
    flow = flow.filter(f => !f.dead);
    if (flow.length > 600) flow.splice(0, flow.length - 600);
  }

  function draw1d() {
    const s = xsec, c = s.ctx, w = s.w, h = s.h, { d } = op;
    const bx0 = 70, bx1 = w - 70, by0 = 92, by1 = h - 56;
    const X = u => lerp(bx0, bx1, u), Y = v => lerp(by0, by1, v);
    c.fillStyle = C.nPlus; c.fillRect(X(0), by0, X(XEB) - X(0), by1 - by0);
    c.fillStyle = C.pType; c.fillRect(X(XEB), by0, X(XBC) - X(XEB), by1 - by0);
    c.fillStyle = C.nType; c.fillRect(X(XBC), by0, X(1) - X(XBC), by1 - by0);
    c.fillStyle = C.depl;
    c.fillRect(X(XEB - d.eE), by0, X(d.b0) - X(XEB - d.eE), by1 - by0);
    c.fillRect(X(d.b1), by0, X(XBC + d.cC) - X(d.b1), by1 - by0);
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(X(XEB), by0); c.lineTo(X(XEB), by1); c.moveTo(X(XBC), by0); c.lineTo(X(XBC), by1); c.stroke(); c.setLineDash([]);
    // mayoritarios / iones
    const inDep = u => (u > XEB - d.eE && u < d.b0) || (u > d.b1 && u < XBC + d.cC);
    const vis = [], ionP = [], hv = [], ionN = [];
    for (const p of cE.p) (inDep(p.bx) ? ionP : vis).push(inDep(p.bx) ? [X(p.bx), Y(p.by)] : [X(p.x), Y(p.y)]);
    for (const p of cC.p) (inDep(p.bx) ? ionP : vis).push(inDep(p.bx) ? [X(p.bx), Y(p.by)] : [X(p.x), Y(p.y)]);
    for (const p of cB.p) (inDep(p.bx) ? ionN : hv).push(inDep(p.bx) ? [X(p.bx), Y(p.by)] : [X(p.x), Y(p.y)]);
    TS.ions(c, ionP, +1, 'rgba(150,200,255,.7)');
    TS.ions(c, ionN, -1, 'rgba(255,160,160,.75)');
    TS.dots(c, vis, C.electron, 2);
    TS.dots(c, hv, C.hole, 2);
    // flujo
    const fe = [], fh = [];
    for (const f of flow) (f.k[0] === 'e' ? fe : fh).push([X(f.u), Y(f.v)]);
    TS.dots(c, fe, '#a8d4ff', 2.6, 8);
    TS.dots(c, fh, '#ffb3b3', 2.6, 8);
    for (const fl of flashes) {
      c.strokeStyle = '#ffe08a'; c.globalAlpha = 1 - fl.t / 0.45; c.lineWidth = 1.5;
      c.beginPath(); c.arc(X(fl.u), Y(fl.v), 3 + 14 * fl.t, 0, 6.28); c.stroke();
    }
    c.globalAlpha = 1;
    // contactos
    c.fillStyle = C.metal;
    c.fillRect(bx0 - 16, by0 - 4, 16, by1 - by0 + 8);
    c.fillRect(bx1, by0 - 4, 16, by1 - by0 + 8);
    const bcx = X((d.b0 + d.b1) / 2);
    c.fillRect(bcx - 18, by0 - 10, 36, 10);
    c.strokeStyle = C.metal; c.lineWidth = 2;
    c.beginPath(); c.moveTo(bcx, by0 - 10); c.lineTo(bcx, 34); c.moveTo(bx0 - 8, by0 - 4); c.lineTo(bx0 - 8, 34); c.moveTo(bx1 + 8, by0 - 4); c.lineTo(bx1 + 8, 34); c.stroke();
    TS.terminal(c, bx0 - 8, 22, 'E', 0);
    TS.terminal(c, bcx, 22, 'B', op.Vbe);
    TS.terminal(c, bx1 + 8, 22, 'C', op.Vce);
    const f = '11px Inter, sans-serif';
    TS.label(c, X(XEB / 2), by1 + 16, 'Emisor n⁺', C.text, 'center', f);
    TS.label(c, X((XEB + XBC) / 2), by1 + 16, 'Base p', C.text, 'center', f);
    TS.label(c, X((XBC + 1) / 2), by1 + 16, 'Colector n', C.text, 'center', f);
    TS.label(c, X((d.b0 + d.b1) / 2), by1 + 32, `W_B efectiva`, C.accent2, 'center', '10px Inter, sans-serif');
    // mecanismos de transporte
    const tY = by0 + 16, bY = by1 - 14, beOn = op.Vbe > 0.4, bcOn = op.Vbc > 0.4;
    if (beOn) {
      TS.tag(c, X((d.b0 + d.b1) / 2), tY, 'difusion', 'e⁻ en la base');
      TS.tag(c, X(XEB - d.eE) - 6, (by0 + by1) / 2, 'difusion', 'h⁺ en emisor', 'right');
    }
    if (bcOn) {
      TS.tag(c, X(XBC + d.cC) + 6, (by0 + by1) / 2, 'difusion', 'h⁺ en colector', 'left');
      if (!beOn) TS.tag(c, X((d.b0 + d.b1) / 2), tY, 'difusion', 'e⁻ en la base');
    } else if (beOn) TS.tag(c, X((d.b1 + XBC + d.cC) / 2), bY, 'arrastre', 'barrido por E de BC');
    if (beOn || bcOn) {
      TS.tag(c, X(0.02), bY, 'arrastre', 'mayoritarios', 'left');
      TS.tag(c, X(0.98), tY, 'arrastre', 'mayoritarios', 'right');
    }
    if (!beOn && !bcOn) TS.tag(c, X(0.5), tY, 'arrastre', 'sólo fugas por generación');
    c.strokeStyle = C.accent2; c.lineWidth = 1;
    c.beginPath(); c.moveTo(X(d.b0), by1 + 24); c.lineTo(X(d.b1), by1 + 24); c.stroke();
    // corrientes convencionales
    const arrowI = (x0, x1, y, I, name, col) => {
      if (Math.abs(I) < 1e-12) return;
      const dir = Math.sign(I);
      TS.arrow(c, dir > 0 ? x0 : x1, y, dir > 0 ? x1 : x0, y, col, 1.6, 6);
      TS.label(c, (x0 + x1) / 2, y - 9, `${name} = ${TS.fmtSI(Math.abs(I), 'A')}`, col, 'center', '10px Inter, sans-serif');
    };
    arrowI(X(0.72), X(0.92), 64, -op.Ic, 'I_C', C.accent);
    arrowI(X(0.05), X(0.22), 64, -op.Ie, 'I_E', C.accent);
    TS.label(c, bcx + 26, 52, `I_B = ${TS.fmtSI(op.Ib, 'A')}`, C.hole, 'left', '10px Inter, sans-serif');
  }

  // ------------------------------------------------------------ corte planar

  const PG = { // geometría planar normalizada
    s: 0.20, epiB: 0.60, blB: 0.74,
    iso0: 0.08, iso1: 0.92,
    bx0: 0.17, bx1: 0.62, bD: 0.42,
    ex0: 0.27, ex1: 0.45, eD: 0.31,
    bc0: 0.53, bc1: 0.59, bcD: 0.26,
    sk0: 0.72, sk1: 0.80,
  };

  function initPlanar() {
    const g = PG;
    const inside = (x, y, a, b, t, bt) => x > a && x < b && y > t && y < bt;
    const m = 0.012;
    planar = {
      eE: new TS.Cloud(90, rr => [lerp(g.ex0 + m, g.ex1 - m, rr()), lerp(g.s + m, g.eD - m, rr())], 51, 0.003),
      hB: new TS.Cloud(110, rr => { for (;;) { const x = lerp(g.bx0 + m, g.bx1 - m, rr()), y = lerp(g.s + m, g.bD - m, rr()); if (!inside(x, y, g.ex0 - 0.03, g.ex1 + 0.03, 0, g.eD + 0.03)) return [x, y]; } }, 52, 0.003),
      eC: new TS.Cloud(110, rr => { for (;;) { const x = lerp(g.iso0 + 0.03, g.iso1 - 0.03, rr()), y = lerp(g.s + m, g.epiB, rr()); if (!inside(x, y, g.bx0 - 0.04, g.bx1 + 0.04, 0, g.bD + 0.05) && !inside(x, y, g.sk0 - m, g.sk1 + m, 0, 1)) return [x, y]; } }, 53, 0.003),
      eBL: new TS.Cloud(100, rr => [lerp(g.iso0 + 0.04, g.iso1 - 0.04, rr()), lerp(g.epiB + m, g.blB - m, rr())], 54, 0.003),
      eSK: new TS.Cloud(40, rr => [lerp(g.sk0 + m, g.sk1 - m, rr()), lerp(g.s + m, g.epiB, rr())], 55, 0.003),
      hS: new TS.Cloud(140, rr => { for (;;) { const x = rr(), y = lerp(g.s + m, 0.97, rr()); if (y > g.blB + 0.03 || x < g.iso0 - 0.01 || x > g.iso1 + 0.01) return [x, y]; } }, 56, 0.003),
    };
  }

  // Trayectorias en L con carril propio por partícula (o ∈ [-1,1]).
  function pathE(o) {
    const g = PG, ex = (g.ex0 + g.ex1) / 2 + o * 0.07, yb = (g.epiB + g.blB) / 2 + o * 0.04, cx = (g.sk0 + g.sk1) / 2 + o * 0.025;
    return [[ex, g.s + 0.01], [ex, yb], [cx, yb], [cx, g.s + 0.01]];
  }
  function pathH(o) {
    const g = PG, bx = (g.bc0 + g.bc1) / 2, yb = g.eD + 0.035 + o * 0.015, ex = (g.ex0 + g.ex1) / 2 + o * 0.07;
    return [[bx, g.s + 0.01], [bx, yb], [ex, yb], [ex, g.eD - 0.03 - Math.abs(o) * 0.02]];
  }
  function pathHC(o) {
    const g = PG, bx = (g.bc0 + g.bc1) / 2, x2 = lerp(g.bx0 + 0.04, g.bx1 - 0.04, (o + 1) / 2);
    return [[bx, g.s + 0.01], [bx, g.bD - 0.02], [x2, g.bD - 0.02], [x2, g.bD + 0.06 + 0.05 * Math.abs(o)]];
  }

  function regionSpeed(x, y) {
    const g = PG, { d } = op;
    const k = 0.35;  // escala de profundidad de las zonas de vaciamiento
    if (y > g.eD - 0.005 && y < g.eD + d.eB * k && x > g.ex0 && x < g.ex1) return 0.6;        // vaciamiento EB
    if (y > g.eD && y < g.bD - d.cB * k) return 0.07;                                         // base neutra
    if (y >= g.bD - d.cB * k && y < g.bD + d.cC * k && x > g.bx0 && x < g.bx1) return 0.7;     // vaciamiento BC
    return 0.22;
  }

  function advance(f, dt) {
    let rem = dt;
    while (rem > 0 && f.i < f.pts.length - 1) {
      const a = f.pts[f.i], b = f.pts[f.i + 1];
      const x = lerp(a[0], b[0], f.t), y = lerp(a[1], b[1], f.t);
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
      const v = regionSpeed(x, y) * (f.rev ? 1 : 1);
      const dtSeg = (1 - f.t) * L / v;
      if (dtSeg > rem) { f.t += rem * v / L; rem = 0; }
      else { rem -= dtSeg; f.i++; f.t = 0; }
    }
    if (f.i >= f.pts.length - 1) f.done = true;
    const a = f.pts[Math.min(f.i, f.pts.length - 2)], b = f.pts[Math.min(f.i + 1, f.pts.length - 1)];
    const t = f.i >= f.pts.length - 1 ? 1 : f.t;
    f.x = lerp(a[0], b[0], t); f.y = lerp(a[1], b[1], t);
  }

  function stepPlanar(dt) {
    if (!planar) initPlanar();
    const g = PG;
    for (const k in planar) planar[k].update(dt);
    const Rf = TS.visRate(op.iF, 1e-12, 1e-2, 70), Rr = TS.visRate(op.iR, 1e-12, 1e-2, 70);
    const fb = Math.min(0.5, 5 / st.betaF);
    acc.eF += Rf * dt; acc.eR += Rr * dt; acc.hE += Rf * fb * 0.6 * dt; acc.hC += Rr * 0.35 * dt;
    const o = () => r() * 2 - 1;
    while (acc.eF >= 1) { acc.eF--; const oo = o(); flow.push({ k: 'e', pts: pathE(oo), i: 0, t: 0, recY: r() < fb * 0.4 ? lerp(g.eD + 0.02, g.bD - 0.03, r()) : null }); }
    while (acc.eR >= 1) { acc.eR--; flow.push({ k: 'e', pts: pathE(o()).reverse(), i: 0, t: 0 }); }
    while (acc.hE >= 1) { acc.hE--; flow.push({ k: 'h', pts: pathH(o()), i: 0, t: 0, flash: true }); }
    while (acc.hC >= 1) { acc.hC--; flow.push({ k: 'h', pts: pathHC(o()), i: 0, t: 0, flash: true }); }
    for (const f of flow) {
      advance(f, dt);
      if (f.recY !== null && f.recY !== undefined && f.i === 0 && f.y >= f.recY) { f.dead = true; flashes.push({ u: f.x, v: f.y, t: 0 }); }
      if (f.done) { f.dead = true; if (f.flash) flashes.push({ u: f.x, v: f.y, t: 0 }); }
    }
    flow = flow.filter(f => !f.dead);
    if (flow.length > 600) flow.splice(0, flow.length - 600);
  }

  function drawPlanar() {
    if (!planar) initPlanar();
    const s = xsec, c = s.ctx, g = PG, { d } = op;
    const W = s.w, H = s.h, X = u => u * W, Y = v => v * H;
    const k = 0.35 * H;     // escala de profundidad de vaciamiento
    const rr = (x0, y0, x1, y1, rad, col) => { c.fillStyle = col; c.beginPath(); c.roundRect(X(x0), Y(y0), X(x1) - X(x0), Y(y1) - Y(y0), [0, 0, rad, rad]); c.fill(); };
    c.fillStyle = C.pType; c.fillRect(0, Y(g.s), W, H - Y(g.s));
    rr(g.iso0, g.s, g.iso1, g.blB, 10, C.nPlus);           // capa enterrada (abajo)
    c.fillStyle = C.nType; c.fillRect(X(g.iso0), Y(g.s), X(g.iso1) - X(g.iso0), Y(g.epiB) - Y(g.s));
    c.fillStyle = C.pPlus; c.fillRect(X(g.iso0 - 0.04), Y(g.s), X(0.04), Y(g.blB + 0.04) - Y(g.s)); c.fillRect(X(g.iso1), Y(g.s), X(0.04), Y(g.blB + 0.04) - Y(g.s));
    c.fillStyle = C.nPlus; c.fillRect(X(g.sk0), Y(g.s), X(g.sk1) - X(g.sk0), Y(g.epiB) - Y(g.s) + 2);
    // vaciamiento BC (mayormente en el colector) y EB (mayormente en la base)
    const wc = d.cC * k, wb = d.cB * k, we = d.eB * k;
    c.fillStyle = C.depl; c.beginPath(); c.roundRect(X(g.bx0) - wc, Y(g.s), X(g.bx1) - X(g.bx0) + 2 * wc, Y(g.bD) - Y(g.s) + wc, [0, 0, 18 + wc, 18 + wc]); c.fill();
    { const rb = Math.max(18 - wb, 2); c.fillStyle = C.pType; c.beginPath(); c.roundRect(X(g.bx0) + wb, Y(g.s), X(g.bx1) - X(g.bx0) - 2 * wb, Y(g.bD) - Y(g.s) - wb, [0, 0, rb, rb]); c.fill(); }
    c.fillStyle = C.depl; c.beginPath(); c.roundRect(X(g.ex0) - we, Y(g.s), X(g.ex1) - X(g.ex0) + 2 * we, Y(g.eD) - Y(g.s) + we, [0, 0, 10 + we, 10 + we]); c.fill();
    rr(g.ex0, g.s, g.ex1, g.eD, 10, C.nPlus);
    rr(g.bc0, g.s, g.bc1, g.bcD, 6, C.pPlus);
    // mayoritarios
    const P = cl => cl.p.map(p => [X(p.x), Y(p.y)]);
    TS.dots(c, [...P(planar.eE), ...P(planar.eC), ...P(planar.eBL), ...P(planar.eSK)], C.electron, 1.9);
    TS.dots(c, [...P(planar.hB), ...P(planar.hS)], C.hole, 1.9);
    // flujo
    TS.dots(c, flow.filter(f => f.k === 'e' && f.x !== undefined).map(f => [X(f.x), Y(f.y)]), '#a8d4ff', 2.5, 8);
    TS.dots(c, flow.filter(f => f.k === 'h' && f.x !== undefined).map(f => [X(f.x), Y(f.y)]), '#ffb3b3', 2.5, 8);
    for (const fl of flashes) {
      c.strokeStyle = '#ffe08a'; c.globalAlpha = 1 - fl.t / 0.45; c.lineWidth = 1.5;
      c.beginPath(); c.arc(X(fl.u), Y(fl.v), 3 + 14 * fl.t, 0, 6.28); c.stroke();
    }
    c.globalAlpha = 1;
    // óxido y contactos
    c.fillStyle = 'rgba(205,184,106,.55)'; c.fillRect(0, Y(g.s) - 8, W, 8);
    c.fillStyle = C.metal;
    const pad = (x0, x1, name, v) => {
      c.fillRect(X(x0), Y(g.s) - 14, X(x1) - X(x0), 14);
      const cx = (X(x0) + X(x1)) / 2;
      c.strokeStyle = C.metal; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, Y(g.s) - 14); c.lineTo(cx, 34); c.stroke();
      TS.terminal(c, cx, 22, name, v);
    };
    pad(g.ex0 + 0.03, g.ex1 - 0.03, 'E', 0);
    pad(g.bc0, g.bc1, 'B', op.Vbe);
    pad(g.sk0 + 0.005, g.sk1 - 0.005, 'C', op.Vce);
    const f = '11px Inter, sans-serif';
    TS.label(c, X((g.ex0 + g.ex1) / 2), Y(g.eD) - 12, 'Emisor n⁺', C.text, 'center', f);
    TS.label(c, X(g.bx0 + 0.04), Y(g.bD) - 14, 'Base p', C.text, 'left', f);
    TS.label(c, X(0.68), Y(0.5), 'Colector n (epi)', C.text, 'center', f);
    TS.label(c, X(0.5), Y((g.epiB + g.blB) / 2), 'Capa enterrada n⁺', C.text, 'center', f);
    TS.label(c, X((g.sk0 + g.sk1) / 2), Y(0.4), 'n⁺', C.text, 'center', f);
    TS.label(c, X(0.5), Y(0.9), 'Sustrato p', C.text, 'center', f);
    if (op.Vbe > 0.4 || op.Vbc > 0.4) {
      TS.tag(c, X(g.ex1) + 8, Y((g.eD + g.bD) / 2), 'difusion', 'e⁻ en la base', 'left');
      if (op.Vbc < 0.4) TS.tag(c, X(g.ex1) + 8, Y(g.bD) + d.cC * 0.35 * H * 0.5 + 6, 'arrastre', 'vaciamiento BC', 'left');
      TS.tag(c, X(0.62), Y((g.epiB + g.blB) / 2) + 16, 'arrastre', 'colector (mayoritarios)');
    }
    TS.label(c, X(g.iso0 - 0.02), Y(0.3), 'p⁺', C.text, 'center', f);
    TS.label(c, X(g.iso1 + 0.02), Y(0.3), 'p⁺', C.text, 'center', f);
  }

  M.init = init;
  M.frame = dt => {
    if (M.dirty) compute();
    const sdt = dt * st.speed;
    cE.update(sdt); cB.update(sdt); cC.update(sdt);
    if (st.view === '1d') step1d(sdt); else stepPlanar(sdt);
    for (const fl of flashes) fl.t += sdt;
    flashes = flashes.filter(fl => fl.t < 0.45);
    if (xsec.visible()) {
      xsec.clear();
      if (st.view === '1d') draw1d(); else drawPlanar();
    }
    const plots = [pOut, pGum, pBand, pMin];
    if (M.dirty || plots.some(p => p.dirty)) {
      drawPlots(); readouts();
      document.getElementById('bjt-xsec-sub').textContent = 'destellos = recombinación · I_B exagerada ×5 para que se vea';
      M.dirty = false; plots.forEach(p => (p.dirty = false));
    }
  };
  return M;
})();
