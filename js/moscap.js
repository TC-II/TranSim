'use strict';
// Capacitor MOS: compuerta / óxido / semiconductor, sin fuente ni drenador.
// Internamente todo se calcula en la convención de sustrato p (sg = +1); para sustrato n
// se espejan voltajes y cargas con sg = −1.
TS.MOSCAP = (() => {
  const { UT, C, clamp, lerp } = TS;
  const st = { Vg: 1.5, sub: 'p', logN: 17, tox: 10, gate: 'npoly', mode: 'lf', speed: 1 };
  const M = { dirty: true };
  const PHI_M = { npoly: 4.05, ppoly: 5.17, al: 4.10 };
  const TAU_MAJ = 0.12, TAU_GEN = 1.6, TAU_REC = 0.5, DEEP_VCB = 30;
  let xsec, pBand, pCV, pRho, pE, pPsi;
  let p, sg, eq, cv, maj, acc, inv, gen = [], accG = 0;
  let qiD = 0, wD = 0, lastW = 0, dW = 0, t = 0;   // estado mostrado (transitorio)
  let mins = [], flashes = [];                      // minoritarios del sustrato (coord. normalizadas)
  const r = TS.rng(91);

  function params() {
    const N = Math.pow(10, st.logN);
    const q = TS.mosParams(0, N, st.tox);
    sg = st.sub === 'p' ? 1 : -1;
    const phiS = 4.05 + TS.EG / 2 + sg * q.phiF;
    q.VfbR = PHI_M[st.gate] - phiS;
    q.Vfb = sg * q.VfbR;                                   // convención sustrato p
    q.VtR = sg * (q.Vfb + 2 * q.phiF + q.gamma * Math.sqrt(2 * q.phiF));
    q.a = TS.Q * N / (2 * TS.EPS_SI);                      // ψ = a·W²   [V/cm²]
    q.b = TS.Q * N / q.Cox;                                 // Qb/Cox = b·W [V/cm]
    q.LD = Math.sqrt(TS.EPS_SI * UT / (TS.Q * N));          // longitud de Debye [cm]
    q.Wmax = TS.depletionNm(2 * q.phiF, N) * 1e-7;          // [cm]
    return q;
  }

  const solveEq = Vgp => TS.mosSurface(p, Vgp, 0);
  const solveDeep = Vgp => TS.mosSurface(p, Vgp, DEEP_VCB);

  function cvCurves() {
    const xs = TS.linspace(-4, 4, 321), h = 4e-3;
    const cOf = (f, v) => 1 - (f(v + h).psi - f(v - h).psi) / (2 * h);
    const lf = [], hf = [], dd = [];
    for (const V of xs) {
      const v = sg * V;
      const cl = cOf(solveEq, v);
      lf.push(cl);
      const s = solveEq(v);
      if (s.psi < p.phiF) hf.push(cl);
      else { const W = TS.depletionNm(s.psi, p.N) * 1e-7; hf.push(1 / (1 + p.Cox * W / TS.EPS_SI)); }
      dd.push(cOf(solveDeep, v));
    }
    return { xs, lf, hf, dd };
  }

  function compute() {
    p = params();
    const v = sg * st.Vg;
    eq = st.mode === 'deep' ? solveDeep(v) : solveEq(v);
    eq.qi = -eq.Qi;                                         // carga de inversión (magnitud, V)
    eq.qacc = eq.psi < 0 ? eq.Qs : 0;
    cv = cvCurves();
  }

  // Estado mostrado: la carga de inversión sigue a la de equilibrio con la constante de
  // generación térmica; mientras falta carga, W_d se agranda (vaciamiento profundo transitorio).
  function displayState() {
    const v = sg * st.Vg, rhs = v - p.Vfb - qiD;
    if (eq.psi <= 0 || rhs <= 0) return { W: 0, psi: eq.psi, qacc: eq.qacc, qi: 0, qb: 0 };
    const W = (-p.b + Math.sqrt(p.b * p.b + 4 * p.a * rhs)) / (2 * p.a);
    return { W, psi: p.a * W * W, qacc: 0, qi: qiD, qb: p.b * W };
  }

  function init() {
    const $ = id => document.getElementById(id);
    xsec = new TS.Surface($('mc-xsec'));
    pBand = new TS.Plot($('mc-band')); pCV = new TS.Plot($('mc-cv'));
    pRho = new TS.Plot($('mc-rho')); pE = new TS.Plot($('mc-field')); pPsi = new TS.Plot($('mc-pot'));
    maj = new TS.Cloud(460, rr => [0.02 + 0.96 * rr(), 0.012 + 0.97 * rr()], 81, 0.004);
    acc = new TS.Cloud(130, rr => [0.02 + 0.96 * rr(), rr()], 82, 0.003);
    inv = new TS.Cloud(130, rr => [0.02 + 0.96 * rr(), rr()], 83, 0.003);
    TS.bindControls($('tab-moscap'), st, k => {
      M.dirty = true;
      if (k === 'sub' || k === 'logN' || k === 'tox' || k === 'gate') { gen = []; M.reset = true; }
    });
    compute();
    qiD = eq.qi; wD = displayState().W; lastW = wD;
  }

  // ------------------------------------------------------------ animación

  function step(dt) {
    dt *= st.speed; t += dt;
    maj.update(dt); acc.update(dt); inv.update(dt);
    if (M.reset) { qiD = eq.qi; wD = displayState().W; M.reset = false; }
    const target = eq.qi;
    const tau = target > qiD ? (st.mode === 'deep' ? 1e9 : TAU_GEN) : TAU_REC;
    const missing = target - qiD;
    qiD += (target - qiD) * (1 - Math.exp(-dt / tau));
    if (st.mode === 'deep') qiD = Math.min(qiD, target + 1e-9);
    const ds = displayState();
    wD += (ds.W - wD) * (1 - Math.exp(-dt / TAU_MAJ));
    dW = (wD - lastW) / Math.max(dt, 1e-6); lastW = wD;
    // pares generados térmicamente dentro de W_d mientras falta carga de inversión
    const gr = missing > 0.01 && st.mode !== 'deep' ? clamp(missing / TAU_GEN * 30, 2, 45) : 0;
    accG += gr * dt;
    while (accG >= 1) { accG--; const y = r() * 0.95, x = 0.03 + 0.94 * r(); gen.push({ x, y, k: 'min' }, { x, y, k: 'maj' }); }
    for (const g of gen) {
      g.y += (g.k === 'min' ? -1 : 1) * 0.9 * dt;
      g.x += (r() - 0.5) * 0.004;
      if (g.y < 0 || g.y > 1) g.dead = true;
    }
    gen = gen.filter(g => !g.dead).slice(-300);
    // minoritarios: difusión en la zona neutra, arrastre hacia la superficie dentro de W_d
    const wN = clamp(wD / p.Wmax * 0.42, 0, 1);
    const spawn = () => ({ x: 0.03 + 0.94 * r(), y: Math.min(0.99, wN + 0.06 + (1 - wN - 0.06) * r()) });
    if (!mins.length) for (let k = 0; k < 34; k++) mins.push(spawn());
    for (let k = 0; k < mins.length; k++) {
      const m = mins[k];
      if (m.y < wN && eq.psi > 0) {                     // campo de la zona de vaciamiento
        m.y -= 1.1 * dt; m.drift = true;
        if (m.y < 0.015) { mins[k] = spawn(); }         // se incorpora a la capa de inversión
      } else {
        m.drift = false;
        m.x = clamp(m.x + (r() - 0.5) * 0.9 * Math.sqrt(dt) * 0.12, 0.02, 0.98);
        m.y = clamp(m.y + (r() - 0.5) * 0.9 * Math.sqrt(dt) * 0.12, 0.005, 0.99);
        if (eq.psi < 0 && m.y < 0.06 && r() < dt * 3) { flashes.push({ x: m.x, y: m.y, t: 0 }); mins[k] = spawn(); }  // recombinan con la acumulación
      }
    }
    for (const f of flashes) f.t += dt;
    flashes = flashes.filter(f => f.t < 0.45);
  }

  function drawXsec() {
    const s = xsec, c = s.ctx, w = s.w, h = s.h;
    s.clear();
    const ds = displayState(), W = wD;
    const x0 = 40, x1 = w - 40, gTop = 52, gBot = 98, oxH = 34, sTop = gBot + oxH, sBot = h - 30;
    const pxPerCm = (sBot - sTop) * 0.42 / p.Wmax;
    const wPx = Math.min(W * pxPerCm, sBot - sTop);
    const majCol = sg > 0 ? C.hole : C.electron, minCol = sg > 0 ? C.electron : C.hole;
    const X = u => lerp(x0, x1, u), Ys = v => lerp(sTop, sBot, v);
    // semiconductor y zona de vaciamiento
    c.fillStyle = sg > 0 ? C.pType : C.nType; c.fillRect(x0, sTop, x1 - x0, sBot - sTop);
    c.fillStyle = C.depl; c.fillRect(x0, sTop, x1 - x0, wPx);
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.setLineDash([4, 4]);
    if (wPx > 2) { c.beginPath(); c.moveTo(x0, sTop + wPx); c.lineTo(x1, sTop + wPx); c.stroke(); }
    c.setLineDash([]);
    // mayoritarios e iones fijos
    const vis = [], ion = [];
    for (const q of maj.p) {
      const y = Ys(q.by);
      if (y - sTop < wPx) ion.push([X(q.bx), y]); else vis.push([X(q.x), Ys(q.y)]);
    }
    TS.ions(c, ion, -sg, sg > 0 ? 'rgba(255,160,160,.75)' : 'rgba(150,200,255,.75)');
    TS.dots(c, vis, majCol, 2);
    // capa de acumulación (mayoritarios) e inversión (minoritarios) en la superficie
    const QREF = 1e-6;   // C/cm² que llenan la capa
    const qaccC = ds.qacc * p.Cox, qiC = ds.qi * p.Cox;
    const lay = (cl, frac, col) => TS.dots(c, cl.p.filter(q => q.u < frac).map(q => [X(q.x), sTop + 1.5 + q.by * 7]), col, 2);
    if (qaccC > 0) {
      c.fillStyle = sg > 0 ? 'rgba(255,107,107,.25)' : 'rgba(77,163,255,.25)'; c.fillRect(x0, sTop, x1 - x0, 4 + 5 * clamp(qaccC / QREF, 0, 1));
      lay(acc, clamp(qaccC / QREF, 0, 1), majCol);
    }
    if (qiC > 0) {
      c.fillStyle = sg > 0 ? 'rgba(77,163,255,.3)' : 'rgba(255,107,107,.3)'; c.fillRect(x0, sTop, x1 - x0, 3 + 6 * clamp(qiC / QREF, 0, 1));
      lay(inv, clamp(qiC / QREF, 0, 1), minCol);
    }
    // minoritarios del sustrato y recombinaciones
    TS.minority(c, mins.map(m => [X(m.x), Ys(m.y)]), minCol, 3.2);
    for (const f of flashes) {
      c.strokeStyle = '#ffe08a'; c.globalAlpha = 1 - f.t / 0.45; c.lineWidth = 1.5;
      c.beginPath(); c.arc(X(f.x), Ys(f.y), 3 + 14 * f.t, 0, 6.28); c.stroke();
    }
    c.globalAlpha = 1;
    const lg = [x1 - 230, sTop + 14];
    c.fillStyle = 'rgba(13,18,29,.8)'; c.fillRect(lg[0] - 8, lg[1] - 10, 236, 20);
    TS.dots(c, [[lg[0], lg[1]]], majCol, 3); TS.label(c, lg[0] + 8, lg[1], 'mayoritario', C.text, 'left', '10px Inter, sans-serif');
    TS.minority(c, [[lg[0] + 82, lg[1]]], minCol, 3); TS.label(c, lg[0] + 90, lg[1], 'minoritario', C.text, 'left', '10px Inter, sans-serif');
    TS.ions(c, [[lg[0] + 166, lg[1]]], -sg, '#ddd'); TS.label(c, lg[0] + 174, lg[1], 'ion fijo', C.text, 'left', '10px Inter, sans-serif');
    // pares generados
    TS.dots(c, gen.map(g => [X(g.x), sTop + g.y * wPx]).filter((_, i) => gen[i].k === 'min'), sg > 0 ? '#a8d4ff' : '#ffb3b3', 2.4, 7);
    TS.dots(c, gen.map(g => [X(g.x), sTop + g.y * wPx]).filter((_, i) => gen[i].k === 'maj'), sg > 0 ? '#ffb3b3' : '#a8d4ff', 2.4, 7);
    // óxido y campo
    c.fillStyle = C.oxide; c.globalAlpha = 0.85; c.fillRect(x0, gBot, x1 - x0, oxH); c.globalAlpha = 1;
    const voxR = sg * (sg * st.Vg - p.Vfb - ds.psi - 0);   // V_ox real
    const Eox = voxR / (st.tox * 1e-7);
    const L = clamp(Math.abs(Eox) / 6e6, 0, 1) * (oxH - 8);
    if (L > 2) for (let k = 0; k < 9; k++) {
      const ax = X((k + 0.5) / 9), yc = gBot + oxH / 2;
      if (Eox > 0) TS.arrow(c, ax, yc - L / 2, ax, yc + L / 2, '#5b4a12', 1.6, 6);
      else TS.arrow(c, ax, yc + L / 2, ax, yc - L / 2, '#5b4a12', 1.6, 6);
    }
    TS.label(c, x1 - 6, gBot + oxH / 2, `SiO₂ · t_ox = ${st.tox} nm · E_ox = ${(Math.abs(Eox) / 1e6).toFixed(2)} MV/cm`, '#3d320c', 'right', 'bold 10px Inter, sans-serif');
    // compuerta y su carga
    c.fillStyle = st.gate === 'al' ? C.metal : C.poly; c.fillRect(x0, gTop, x1 - x0, gBot - gTop);
    const QG = sg * (ds.psi < 0 ? -ds.qacc : ds.qb + ds.qi) * p.Cox;
    const nG = Math.round(clamp(Math.abs(QG) / QREF * 34, 0, 80));
    const gp = [];
    for (let k = 0; k < nG; k++) gp.push([X((k + 0.5) / nG), gBot - 7 - (k % 2) * 6]);
    TS.ions(c, gp, QG > 0 ? 1 : -1, QG > 0 ? '#ffe0a0' : '#bfe0ff', 3.2);
    const gName = { npoly: 'Poli-Si n⁺', ppoly: 'Poli-Si p⁺', al: 'Aluminio' }[st.gate];
    TS.label(c, x0 + 8, gTop + 12, `Compuerta (${gName})`, st.gate === 'al' ? '#1a1f2b' : '#f0dcc0', 'left', 'bold 11px Inter, sans-serif');
    c.strokeStyle = C.metal; c.lineWidth = 2; c.beginPath(); c.moveTo((x0 + x1) / 2, gTop); c.lineTo((x0 + x1) / 2, 34); c.stroke();
    TS.terminal(c, (x0 + x1) / 2, 22, 'V_G', st.Vg);
    c.fillStyle = C.metal; c.fillRect(x0, sBot, x1 - x0, 7);
    TS.label(c, x0 + 8, sBot - 12, sg > 0 ? `Sustrato p (N_A = 10^${st.logN.toFixed(1)} cm⁻³)` : `Sustrato n (N_D = 10^${st.logN.toFixed(1)} cm⁻³)`, C.text, 'left', '11px Inter, sans-serif');
    TS.label(c, x1, sBot + 16, 'cuerpo a masa', C.muted, 'right', '10px Inter, sans-serif');
    if (wPx > 14) TS.label(c, x0 + 8, sTop + wPx - 9, `W_d = ${(W * 1e7).toFixed(0)} nm`, C.muted, 'left', '10px Inter, sans-serif');
    // mecanismos de transporte
    const yTag = Math.min(sTop + Math.max(wPx, 20) + 18, sBot - 30);
    const generating = gen.length > 0;
    if (generating) {
      TS.tag(c, X(0.72), sTop + Math.max(wPx * 0.5, 16), 'arrastre', 'pares generados en W_d');
      TS.tag(c, X(0.72), yTag, 'difusion', 'minoritarios del sustrato → W_d');
    }
    if (mins.some(m => m.drift)) TS.tag(c, X(0.5), sTop + Math.max(wPx * 0.35, 12), 'arrastre', 'minoritarios barridos a la superficie');
    if (Math.abs(dW) * pxPerCm > 8) TS.tag(c, X(0.28), yTag, 'arrastre', dW > 0 ? 'mayoritarios se alejan' : 'mayoritarios vuelven');
    else if (!generating) TS.tag(c, X(0.5), yTag, 'ambos', 'equilibrio: J_arrastre = −J_difusión (J = 0)');
  }

  // ------------------------------------------------------------ gráficos

  function drawCV() {
    const VfbR = p.VfbR, VtR = p.VtR;
    pCV.frame({ xmin: -4, xmax: 4, ymin: 0, ymax: 1.08, xlabel: 'V_G [V]', ylabel: 'C / C_ox' });
    const lo = Math.min(VfbR, VtR), hi = Math.max(VfbR, VtR);
    const accCol = 'rgba(255,107,107,.07)', invCol = 'rgba(77,163,255,.08)';
    pCV.band(-4, lo, sg > 0 ? accCol : invCol);
    pCV.band(hi, 4, sg > 0 ? invCol : accCol);
    pCV.text((-4 + lo) / 2, 0.06, sg > 0 ? 'acumulación' : 'inversión', C.muted, 'center');
    pCV.text((lo + hi) / 2, 0.06, 'vaciam.', C.muted, 'center');
    pCV.text((hi + 4) / 2, 0.06, sg > 0 ? 'inversión' : 'acumulación', C.muted, 'center');
    pCV.vline(VfbR, C.ok); pCV.text(VfbR, 1.04, 'V_FB', C.ok, 'center');
    pCV.vline(VtR, C.bad); pCV.text(VtR, 1.04, 'V_T', C.bad, 'center');
    const sel = { lf: 'lf', hf: 'hf', deep: 'dd' }[st.mode];
    const sty = { lf: [C.ok, null], hf: [C.accent, null], dd: [C.accent2, [6, 4]] };
    for (const k of ['lf', 'hf', 'dd']) pCV.line(cv.xs, cv[k], k === sel ? sty[k][0] : sty[k][0] + '55', k === sel ? 2.6 : 1.4, sty[k][1]);
    const yv = TS.sample(cv[sel], (st.Vg + 4) / 8);
    pCV.point(st.Vg, yv);
    pCV.legend([{ label: 'baja frecuencia (cuasi-estática)', color: C.ok }, { label: 'alta frecuencia', color: C.accent }, { label: 'vaciamiento profundo', color: C.accent2, dash: [6, 4] }], sg > 0 ? 'bl' : 'br');
  }

  function drawProfiles() {
    const ds = displayState(), W = wD;
    const tox = st.tox * 1e-7, scale = Math.max(p.Wmax * 1.6, W * 1.25);
    const xA = -(tox + scale * 0.25), xB = scale;
    const nm = v => v * 1e7;
    const delta = scale * 0.045;
    const qN = TS.Q * p.N;
    const QG = sg * (ds.psi < 0 ? -ds.qacc : ds.qb + ds.qi) * p.Cox;      // C/cm²
    const Qi = -sg * ds.qi * p.Cox, Qacc = sg * ds.qacc * p.Cox;
    // ρ
    const hG = QG / (qN * delta), hS = (Qi + Qacc) / (qN * delta);
    const ym = Math.max(Math.abs(hG), Math.abs(hS), 1.2) * 1.15;
    pRho.frame({ xmin: nm(xA), xmax: nm(xB), ymin: -ym, ymax: ym, xlabel: 'y [nm]', ylabel: 'ρ / qN', mb: 30 });
    pRho.band(nm(-tox), 0, 'rgba(205,184,106,.12)');
    const blk = (a, b, hgt, col) => pRho.fillBetween([nm(a), nm(b)], [hgt, hgt], [0, 0], col);
    blk(-tox - delta, -tox, hG, hG > 0 ? 'rgba(255,180,84,.7)' : 'rgba(120,180,255,.7)');
    if (W > 0) blk(0, W, -sg, sg > 0 ? 'rgba(255,107,107,.45)' : 'rgba(77,163,255,.45)');
    if (Math.abs(hS) > 1e-3) blk(0, delta, hS, Qi !== 0 ? (sg > 0 ? 'rgba(77,163,255,.8)' : 'rgba(255,107,107,.8)') : (sg > 0 ? 'rgba(255,107,107,.8)' : 'rgba(77,163,255,.8)'));
    pRho.hline(0, C.axis, []);
    pRho.text(nm(-tox - delta), hG * 0.5, `Q_G = ${(QG * 1e9).toFixed(0)} nC/cm²`, C.text, 'right');
    if (W > 0) pRho.text(nm(W) / 2, -sg * ym * 0.55, `Q_B = ${(-sg * qN * W * 1e9).toFixed(0)} nC/cm²`, C.text, 'center');
    if (Math.abs(Qi) > 1e-10) pRho.text(nm(delta) + 3, hS * 0.7, `Q_inv = ${(Qi * 1e9).toFixed(0)} nC/cm²`, C.text, 'left');
    if (Math.abs(Qacc) > 1e-10) pRho.text(nm(delta) + 3, hS * 0.7, `Q_acum = ${(Qacc * 1e9).toFixed(0)} nC/cm²`, C.text, 'left');
    // E y ψ
    const ys = TS.linspace(xA, xB, 400);
    const voxR = sg * (sg * st.Vg - p.Vfb - ds.psi);
    const Eox = voxR / tox;
    const di = scale * 0.03;
    const Es = y => {
      if (ds.psi < 0) return sg * ds.psi * 0 + (Eox * TS.EPS_OX / TS.EPS_SI) * Math.exp(-y / p.LD);
      if (y > W) return 0;
      const Eb = sg * qN * (W - y) / TS.EPS_SI;
      const E0 = Eox * TS.EPS_OX / TS.EPS_SI;
      return y < di && ds.qi > 0 ? lerp(E0, sg * qN * (W - di) / TS.EPS_SI, y / di) : Eb;
    };
    const E = ys.map(y => (y < -tox ? 0 : y < 0 ? Eox : Es(y)) / 1e6);
    const em = Math.max(...E.map(Math.abs), 0.05) * 1.15;
    pE.frame({ xmin: nm(xA), xmax: nm(xB), ymin: -em, ymax: em, xlabel: 'y [nm]', ylabel: 'E [MV/cm]', mb: 30 });
    pE.band(nm(-tox), 0, 'rgba(205,184,106,.12)');
    pE.fillBetween(ys.map(nm), E, E.map(() => 0), 'rgba(255,180,84,.22)');
    pE.line(ys.map(nm), E, C.accent2, 2);
    pE.hline(0, C.axis, []);
    pE.text(nm(-tox / 2), E[Math.round((-tox / 2 - xA) / (xB - xA) * 399)] * 1.08, 'ε_ox E_ox = ε_s E_s', C.text, 'center', E[0] >= 0 ? 'bottom' : 'top');
    const VgEff = st.Vg - p.VfbR;
    const psiY = y => {
      if (y < -tox) return VgEff;
      if (y < 0) return lerp(sg * ds.psi, VgEff, -y / tox);
      if (ds.psi < 0) return sg * ds.psi * Math.exp(-y / p.LD);
      return y < W ? sg * ds.psi * (1 - y / W) ** 2 : 0;
    };
    const ps = ys.map(psiY);
    const pm = Math.max(...ps.map(Math.abs), 0.2) * 1.15;
    pPsi.frame({ xmin: nm(xA), xmax: nm(xB), ymin: -pm, ymax: pm, xlabel: 'y [nm]', ylabel: 'ψ [V]', mb: 30 });
    pPsi.band(nm(-tox), 0, 'rgba(205,184,106,.12)');
    pPsi.line(ys.map(nm), ps, C.ok, 2);
    pPsi.hline(0, C.axis, []);
    pPsi.text(nm(xA) + 3, VgEff, 'V_G − V_FB', C.muted, 'left', VgEff >= 0 ? 'bottom' : 'top');
    pPsi.text(3, sg * ds.psi, `ψs = ${(sg * ds.psi).toFixed(2)} V`, C.accent2, 'left', sg * ds.psi >= 0 ? 'bottom' : 'top');
  }

  function readouts() {
    const ds = displayState();
    const psiR = sg * ds.psi;
    let name, col;
    if (ds.psi < -2 * UT) { name = 'Acumulación'; col = C.hole; }
    else if (ds.psi < 2 * UT) { name = 'Banda plana'; col = C.muted; }
    else if (ds.psi < p.phiF) { name = 'Vaciamiento'; col = C.warn; }
    else if (st.mode === 'deep' && ds.psi > 2 * p.phiF) { name = 'Vaciamiento profundo'; col = C.accent2; }
    else if (ds.psi < 2 * p.phiF) { name = 'Inversión débil'; col = C.accent; }
    else { name = 'Inversión fuerte'; col = C.ok; }
    if (gen.length > 0) name += ' (transitorio)';
    TS.setBadge(document.getElementById('mc-badge'), name, col);
    const sel = { lf: 'lf', hf: 'hf', deep: 'dd' }[st.mode];
    const cn = TS.sample(cv[sel], (st.Vg + 4) / 8);
    TS.readout(document.getElementById('mc-read'), [
      ['C_ox = ε_ox/t_ox', (p.Cox * 1e9).toFixed(1) + ' nF/cm²'],
      ['V_FB = Φ_M − Φ_S', p.VfbR.toFixed(3) + ' V'],
      ['V_T', p.VtR.toFixed(3) + ' V'],
      ['φ_F', p.phiF.toFixed(3) + ' V'],
      ['γ', p.gamma.toFixed(3) + ' V½'],
      ['ψs', psiR.toFixed(3) + ' V'],
      ['V_ox', (st.Vg - p.VfbR - psiR).toFixed(3) + ' V'],
      ['W_d (mostrado)', (wD * 1e7).toFixed(0) + ' nm'],
      ['W_d,máx (equilibrio)', (p.Wmax * 1e7).toFixed(0) + ' nm'],
      ['Q_inv', (ds.qi * p.Cox * 1e9).toFixed(1) + ' nC/cm²'],
      ['Q_B', (ds.qb * p.Cox * 1e9).toFixed(1) + ' nC/cm²'],
      ['C/C_ox en V_G', cn.toFixed(3)],
      ['C_mín (AF) / C_ox', Math.min(...cv.hf).toFixed(3)],
      ['L_Debye', (p.LD * 1e7).toFixed(1) + ' nm'],
    ]);
  }

  let tick = 0;
  M.init = init;
  M.frame = dt => {
    if (M.dirty) compute();
    step(dt);
    if (xsec.visible()) drawXsec();
    const plots = [pBand, pCV, pRho, pE, pPsi];
    tick += dt;
    const moving = gen.length > 0 || Math.abs(eq.qi - qiD) > 1e-3 || Math.abs(dW) > 1e-9;
    if (M.dirty || plots.some(q => q.dirty)) {
      const subLabel = sg > 0 ? 'Si tipo p' : 'Si tipo n';
      TS.mosBand(pBand, p, st.Vg, st.mode === 'deep' ? sg * DEEP_VCB : 0, sg > 0 ? 'n' : 'p',
        st.mode === 'deep' ? 'vaciamiento profundo: sin capa de inversión' : 'equilibrio', { deep: st.mode === 'deep', subLabel, legendCorner: 'br' });
      drawCV();
    }
    if (M.dirty || plots.some(q => q.dirty) || (moving && tick > 0.05)) {
      drawProfiles(); readouts(); tick = 0;
    }
    M.dirty = false; plots.forEach(q => (q.dirty = false));
  };
  return M;
})();
