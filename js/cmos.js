'use strict';
TS.CMOS = (() => {
  const { UT, C, clamp, lerp } = TS;
  const PN = TS.mosParams(0.6, 1e17, 10), PP = TS.mosParams(0.6, 1e17, 10);
  const KN = 200e-6, KP = 80e-6, WLN = 2, LAMBDA = 0.05, NS = TS.mosSlope(PN, 0);
  const st = { mode: 'static', Vin: 1.4, VDD: 3.3, ratio: 2.5, freq: 0.25, CL: 1, speed: 1 };
  const M = { dirty: true };
  let xsec, pVtc, pLoad, pCur, pBn, pBp;
  let clouds, flowN = [], flowP = [], accN = 0, accP = 0, op, vtc;
  let t = 0, vout = 0, hist = [];
  const r = TS.rng(77);
  const QREF = 3, KV = 2, D0 = 12;

  const mN = (Vin, Vout) => ({ beta: KN * WLN, Vt: PN.Vt0, n: NS, lambda: LAMBDA, Vgs: Vin, Vds: Vout });
  const mP = (Vin, Vout) => ({ beta: KP * WLN * st.ratio, Vt: PP.Vt0, n: NS, lambda: LAMBDA, Vgs: st.VDD - Vin, Vds: st.VDD - Vout });
  const In = (Vin, Vout) => TS.mosCurrent(mN(Vin, Vout)).Id;
  const Ip = (Vin, Vout) => TS.mosCurrent(mP(Vin, Vout)).Id;
  const solve = Vin => TS.bisect(v => In(Vin, v) - Ip(Vin, v), 0, st.VDD, 50);

  const REGC = {
    A: ['A', 'N corte · P triodo', 'rgba(255,107,107,.10)'],
    B: ['B', 'N sat · P triodo', 'rgba(255,204,77,.10)'],
    C: ['C', 'N sat · P sat', 'rgba(79,209,139,.13)'],
    D: ['D', 'N triodo · P sat', 'rgba(90,176,255,.10)'],
    E: ['E', 'N triodo · P corte', 'rgba(180,140,255,.10)'],
  };
  function regionCode(rn, rp) {
    if (rn === 'corte') return 'A';
    if (rp === 'corte') return 'E';
    if (rn === 'saturación' && rp === 'triodo') return 'B';
    if (rn === 'saturación' && rp === 'saturación') return 'C';
    if (rn === 'triodo' && rp === 'saturación') return 'D';
    return rn === 'triodo' ? 'D' : 'B';
  }

  // geometría normalizada (fracciones de ancho/alto del canvas)
  const G = {
    sy: 0.45, jd: 0.10, tox: 0.016, gh: 0.065,
    psub: [0.03, 0.09],
    nS: [0.12, 0.20], nG: [0.20, 0.31], nD: [0.31, 0.39],
    well: [0.50, 0.975], wellD: 0.83,
    pD: [0.58, 0.66], pG: [0.66, 0.77], pS: [0.77, 0.85],
    wc: [0.885, 0.945],
    sti: [[0.095, 0.115], [0.395, 0.415], [0.545, 0.565], [0.855, 0.875]],
  };
  const inR = (x, y, a, d0, d1) => x > a[0] && x < a[1] && y > d0 && y < d1;

  function init() {
    const $ = id => document.getElementById(id);
    xsec = new TS.Surface($('cmos-xsec'));
    pVtc = new TS.Plot($('cmos-vtc')); pLoad = new TS.Plot($('cmos-load')); pCur = new TS.Plot($('cmos-cur'));
    pBn = new TS.Plot($('cmos-bandn')); pBp = new TS.Plot($('cmos-bandp'));
    const g = G, m = 0.012, jb = g.sy + g.jd;
    const inWell = (x, y) => x > g.well[0] - 0.015 && x < g.well[1] + 0.015 && y < g.wellD + 0.03;
    const sampleIn = (a, d0, d1) => rr => [lerp(a[0] + 0.006, a[1] - 0.006, rr()), lerp(d0 + 0.008, d1 - 0.008, rr())];
    clouds = {
      hSub: new TS.Cloud(330, rr => { for (;;) { const x = lerp(0.01, 0.99, rr()), y = lerp(g.sy + m, 0.96, rr()); if (!inWell(x, y) && !(y < jb + 0.02 && (inR(x, y, [g.nS[0] - 0.01, g.nD[1] + 0.01], 0, 1) || inR(x, y, [g.psub[0] - 0.01, g.psub[1] + 0.01], 0, 1)))) return [x, y]; } }, 61, 0.0035),
      eWell: new TS.Cloud(230, rr => { for (;;) { const x = lerp(g.well[0] + m, g.well[1] - m, rr()), y = lerp(g.sy + m, g.wellD - m, rr()); if (!(y < jb + 0.02 && (inR(x, y, [g.pD[0] - 0.01, g.pS[1] + 0.01], 0, 1) || inR(x, y, [g.wc[0] - 0.01, g.wc[1] + 0.01], 0, 1)))) return [x, y]; } }, 62, 0.0035),
      eNS: new TS.Cloud(45, sampleIn(g.nS, g.sy, jb), 63, 0.003), eND: new TS.Cloud(45, sampleIn(g.nD, g.sy, jb), 64, 0.003),
      eWC: new TS.Cloud(35, sampleIn(g.wc, g.sy, jb), 65, 0.003),
      hPS: new TS.Cloud(45, sampleIn(g.pS, g.sy, jb), 66, 0.003), hPD: new TS.Cloud(45, sampleIn(g.pD, g.sy, jb), 67, 0.003),
      hSC: new TS.Cloud(35, sampleIn(g.psub, g.sy, jb), 68, 0.003),
      invN: new TS.Cloud(70, rr => [lerp(g.nG[0], g.nG[1], rr()), rr()], 69, 0.002),
      invP: new TS.Cloud(70, rr => [lerp(g.pG[0], g.pG[1], rr()), rr()], 70, 0.002),
    };
    TS.bindControls($('tab-cmos'), st, k => {
      M.dirty = true;
      if (k === 'VDD') { const el = $('tab-cmos').querySelector('[data-key="Vin"]'); el.max = st.VDD; if (st.Vin > st.VDD) { st.Vin = st.VDD; el._refresh(); } }
      if (k === 'mode') { hist = []; t = 0; vout = solve(st.mode === 'sine' ? st.VDD / 2 : 0); }
      $('cmos-vin-ctrl').style.opacity = st.mode === 'static' ? 1 : 0.4;
    });
    $('tab-cmos').querySelector('[data-key="Vin"]').max = st.VDD;
    vout = solve(st.Vin);
    compute();
  }

  function sweep() {
    const N = 241, xs = TS.linspace(0, st.VDD, N), ys = xs.map(solve);
    const codes = xs.map((v, i) => regionCode(TS.mosCurrent(mN(v, ys[i])).region, TS.mosCurrent(mP(v, ys[i])).region));
    // V_IL, V_IH: pendiente = −1; V_M: V_out = V_in
    let VIL = NaN, VIH = NaN, VM = NaN;
    for (let i = 1; i < N; i++) {
      const sl = (ys[i] - ys[i - 1]) / (xs[i] - xs[i - 1]);
      if (isNaN(VIL) && sl < -1) VIL = xs[i - 1];
      if (!isNaN(VIL) && isNaN(VIH) && sl > -1 && xs[i] > VIL + 0.05) VIH = xs[i - 1];
      if (isNaN(VM) && ys[i] < xs[i]) VM = lerp(xs[i - 1], xs[i], (ys[i - 1] - xs[i - 1]) / ((ys[i - 1] - xs[i - 1]) - (ys[i] - xs[i])));
    }
    const Idd = xs.map((v, i) => In(v, ys[i]));
    return { xs, ys, codes, VIL, VIH, VM, Idd };
  }

  function vinAt(time) {
    const ph = (time * st.freq) % 1;
    if (st.mode === 'sine') return st.VDD / 2 * (1 - Math.cos(2 * Math.PI * ph));
    const e = 0.04;
    if (ph < e) return st.VDD * ph / e;
    if (ph < 0.5) return st.VDD;
    if (ph < 0.5 + e) return st.VDD * (1 - (ph - 0.5) / e);
    return 0;
  }

  function compute() {
    vtc = sweep();
    if (st.mode === 'static') { vout = solve(st.Vin); }
    setOp();
  }

  function setOp() {
    const Vin = st.Vin, Vout = vout;
    const chN = TS.mosChannel(mN(Vin, Vout), 40), chP = TS.mosChannel(mP(Vin, Vout), 40);
    op = { Vin, Vout, chN, chP, In: chN.Id, Ip: chP.Id };
  }

  // ------------------------------------------------------------ animación

  function stepFlow(list, ch, beta, dt, accKey) {
    const idb = ch.Id / beta;
    let a = (accKey === 'n' ? accN : accP) + Math.min(110, D0 * KV * idb) * dt;
    while (a >= 1) { a--; list.push({ u: -0.3 - 0.05 * r(), f: r() }); }
    if (accKey === 'n') accN = a; else accP = a;
    for (const p of list) {
      let v;
      if (p.u < 0 || p.u > 1) v = 0.7;
      else if (p.u > ch.Le) v = 2.4;
      else v = clamp(KV * idb / Math.max(TS.sample(ch.q, p.u), 0.04), 0.02, 2.4);
      p.u += v * dt;
      p.f = clamp(p.f + (r() - 0.5) * 0.15, 0, 1);
      if (p.u > 1.3) p.dead = true;
    }
    return list.filter(p => !p.dead).slice(-400);
  }

  function step(dt) {
    dt *= st.speed;
    for (const k in clouds) clouds[k].update(dt);
    if (st.mode !== 'static') {
      const Iref = In(st.VDD, st.VDD), tau = 0.12 * st.CL;
      const sub = 10;
      for (let i = 0; i < sub; i++) {
        t += dt / sub;
        const vi = vinAt(t);
        vout = clamp(vout + (Ip(vi, vout) - In(vi, vout)) / Iref * st.VDD / tau * dt / sub, 0, st.VDD);
      }
      st.Vin = vinAt(t);
      setOp();
      hist.push([t, st.Vin, vout, op.In, op.Ip]);
      const win = 2 / st.freq;
      while (hist.length && hist[0][0] < t - win) hist.shift();
      M.dynDirty = true;
    }
    flowN = stepFlow(flowN, op.chN, KN * WLN, dt, 'n');
    flowP = stepFlow(flowP, op.chP, KP * WLN * st.ratio, dt, 'p');
  }

  function drawXsec() {
    const s = xsec, c = s.ctx, W = s.w, H = s.h, g = G;
    s.clear();
    const X = u => u * W, Y = v => v * H;
    const sy = Y(g.sy), jd = Y(g.jd) - 0, rad = jd * 0.5;
    const nmPx = H * 0.055 / TS.depletionNm(2 * PN.phiF, PN.N);
    const Vbi = PN.phiF + UT * Math.log(1e20 / TS.NI);
    const { chN, chP } = op;
    // sustrato y pozo
    c.fillStyle = C.pType; c.fillRect(0, sy, W, H - sy);
    const wW = TS.depletionNm(0.8 + st.VDD, PN.N) * nmPx * 0.35;
    c.fillStyle = C.depl; c.beginPath(); c.roundRect(X(g.well[0]) - wW, sy, X(g.well[1]) - X(g.well[0]) + 2 * wW, Y(g.wellD) - sy + wW, [0, 0, 26 + wW, 26 + wW]); c.fill();
    c.fillStyle = C.nType; c.beginPath(); c.roundRect(X(g.well[0]) + wW * 0.5, sy, X(g.well[1]) - X(g.well[0]) - wW, Y(g.wellD) - sy - wW * 0.5, [0, 0, 24, 24]); c.fill();
    // vaciamiento bajo compuertas y en drenadores
    const gateDep = (ga, ch, P, Vgb, VcbSign, depCol) => {
      c.fillStyle = depCol; c.beginPath(); c.moveTo(X(ga[0]), sy);
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        const sres = TS.mosSurface(P, Vgb, TS.sample(ch.V, VcbSign > 0 ? u : 1 - u));
        c.lineTo(lerp(X(ga[0]), X(ga[1]), u), sy + TS.depletionNm(Math.max(sres.psi, 0), P.N) * nmPx);
      }
      c.lineTo(X(ga[1]), sy); c.closePath(); c.fill();
    };
    gateDep(g.nG, chN, PN, op.Vin, 1, C.depl);
    gateDep(g.pG, chP, PP, st.VDD - op.Vin, -1, C.depl);
    const jdep = (a, Vr) => {
      const w = TS.depletionNm(Vbi + Math.max(Vr, 0), PN.N) * nmPx;
      c.fillStyle = C.depl; c.beginPath(); c.roundRect(X(a[0]) - w, sy, X(a[1]) - X(a[0]) + 2 * w, jd + w, [0, 0, rad + w, rad + w]); c.fill();
    };
    jdep(g.nS, 0); jdep(g.nD, op.Vout); jdep(g.pD, st.VDD - op.Vout); jdep(g.pS, 0);
    // difusiones
    const diff = (a, col) => { c.fillStyle = col; c.beginPath(); c.roundRect(X(a[0]), sy, X(a[1]) - X(a[0]), jd, [0, 0, rad, rad]); c.fill(); };
    diff(g.psub, C.pPlus); diff(g.nS, C.nPlus); diff(g.nD, C.nPlus);
    diff(g.pD, C.pPlus); diff(g.pS, C.pPlus); diff(g.wc, C.nPlus);
    // portadores mayoritarios (ocultos en vaciamiento aproximado: bajo compuerta)
    const P = cl => cl.p.map(p => [X(p.x), Y(p.y)]);
    const nearGate = (p, ga) => p.x > ga[0] && p.x < ga[1] && p.y < g.sy + 0.06;
    const nearWellEdge = p => {
      const dx = Math.min(Math.abs(p.bx - g.well[0]), Math.abs(p.bx - g.well[1])) * W, dy = Math.abs(p.by - g.wellD) * H;
      const inside = p.bx > g.well[0] && p.bx < g.well[1] && p.by < g.wellD;
      const dd = inside ? Math.min(dx, dy) : (p.by < g.wellD ? dx : (p.bx > g.well[0] && p.bx < g.well[1] ? dy : Math.hypot(dx, dy)));
      return dd < wW * 0.9;
    };
    TS.dots(c, clouds.hSub.p.filter(p => !nearGate(p, g.nG) && !nearWellEdge(p)).map(p => [X(p.x), Y(p.y)]), C.hole, 1.9);
    TS.dots(c, clouds.eWell.p.filter(p => !nearGate(p, g.pG) && !nearWellEdge(p)).map(p => [X(p.x), Y(p.y)]), C.electron, 1.9);
    TS.dots(c, [...P(clouds.eNS), ...P(clouds.eND), ...P(clouds.eWC)], C.electron, 1.9);
    TS.dots(c, [...P(clouds.hPS), ...P(clouds.hPD), ...P(clouds.hSC)], C.hole, 1.9);
    // canales de inversión
    const thick = q => 1.5 + 9 * clamp(q / QREF, 0, 1.3);
    const channel = (ga, ch, dir, col, cloud) => {
      c.fillStyle = col;
      c.beginPath(); c.moveTo(X(ga[0]), sy);
      for (let i = 0; i <= 40; i++) {
        const xx = i / 40, u = dir > 0 ? xx : 1 - xx, q = TS.sample(ch.q, u);
        c.lineTo(lerp(X(ga[0]), X(ga[1]), xx), sy + thick(q) * clamp(q / 0.15, 0, 1));
      }
      c.lineTo(X(ga[1]), sy); c.closePath(); c.fill();
      const pts = [];
      for (const p of cloud.p) {
        const xx = (p.x - ga[0]) / (ga[1] - ga[0]), u = dir > 0 ? xx : 1 - xx, q = TS.sample(ch.q, clamp(u, 0, 1));
        if (p.u < q / QREF * 1.2) pts.push([X(p.x), sy + 1.2 + p.by * thick(q) * 0.9]);
      }
      return pts;
    };
    const ptsN = channel(g.nG, chN, 1, 'rgba(77,163,255,.45)', clouds.invN);
    const ptsP = channel(g.pG, chP, -1, 'rgba(255,107,107,.45)', clouds.invP);
    c.globalAlpha = 0.7; TS.dots(c, ptsN, C.electron, 1.7); TS.dots(c, ptsP, C.hole, 1.7); c.globalAlpha = 1;
    // STI, óxido de compuerta, polisilicio
    c.fillStyle = C.sti;
    for (const a of g.sti) c.fillRect(X(a[0]), sy - 4, X(a[1]) - X(a[0]), Y(0.07));
    const gate = (ga, lab) => {
      c.fillStyle = C.oxide; c.fillRect(X(ga[0]) - 4, sy - Y(g.tox), X(ga[1]) - X(ga[0]) + 8, Y(g.tox));
      c.fillStyle = C.poly; c.fillRect(X(ga[0]), sy - Y(g.tox) - Y(g.gh), X(ga[1]) - X(ga[0]), Y(g.gh));
      TS.label(c, X((ga[0] + ga[1]) / 2), sy - Y(g.tox) - Y(g.gh) / 2, lab, '#f0dcc0', 'center', '10px Inter, sans-serif');
    };
    gate(g.nG, 'G (NMOS)'); gate(g.pG, 'G (PMOS)');
    // flujo de portadores en los canales
    const flowPts = (list, sa, ga, da, ch, dir) => {
      const scx = X((sa[0] + sa[1]) / 2), dcx = X((da[0] + da[1]) / 2);
      const gS = dir > 0 ? X(ga[0]) : X(ga[1]), gD = dir > 0 ? X(ga[1]) : X(ga[0]);
      return list.map(p => {
        let x, y;
        if (p.u < 0) { x = lerp(scx, gS, (p.u + 0.3) / 0.3); y = sy + 2 + p.f * 8; }
        else if (p.u <= 1) { x = lerp(gS, gD, p.u); y = sy + 1.5 + p.f * (p.u > ch.Le ? 10 : thick(TS.sample(ch.q, p.u)) * 0.9); }
        else { x = lerp(gD, dcx, (p.u - 1) / 0.3); y = sy + 2 + p.f * 8; }
        return [x, y];
      });
    };
    TS.dots(c, flowPts(flowN, g.nS, g.nG, g.nD, chN, 1), '#a8d4ff', 2.4, 7);
    TS.dots(c, flowPts(flowP, g.pS, g.pG, g.pD, chP, -1), '#ffb3b3', 2.4, 7);
    // contactos y cableado
    const cx = a => X((a[0] + a[1]) / 2);
    const gTop = sy - Y(g.tox) - Y(g.gh);
    c.fillStyle = C.metal;
    for (const a of [g.psub, g.nS, g.nD, g.pD, g.pS, g.wc]) c.fillRect(cx(a) - 10, sy - 10, 20, 10);
    c.strokeStyle = C.metal; c.lineWidth = 2;
    const yIn = Y(0.08), yOut = Y(0.19), yRail = Y(0.29);
    const wire = pts => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.stroke(); };
    wire([[cx(g.psub), sy - 10], [cx(g.psub), yRail], [cx(g.nS), yRail], [cx(g.nS), sy - 10]]);
    wire([[cx(g.pS), sy - 10], [cx(g.pS), yRail], [cx(g.wc), yRail], [cx(g.wc), sy - 10]]);
    c.strokeStyle = '#c9a0ff';
    wire([[cx(g.nD), sy - 10], [cx(g.nD), yOut], [cx(g.pD), yOut], [cx(g.pD), sy - 10]]);
    c.strokeStyle = C.accent2;
    wire([[cx(g.nG), gTop], [cx(g.nG), yIn], [cx(g.pG), yIn], [cx(g.pG), gTop]]);
    TS.terminal(c, X(0.06), Y(0.29) - 22, 'GND', 0, C.muted);
    TS.terminal(c, X(0.915), Y(0.29) - 22, 'VDD', st.VDD, C.ok);
    TS.terminal(c, X(0.475), yIn, 'Vin', op.Vin, C.accent2);
    TS.terminal(c, X(0.475), yOut, 'Vout', op.Vout, '#c9a0ff');
    // corrientes
    const f = '10px Inter, sans-serif';
    TS.label(c, cx(g.nG), yRail - 10, `I_Dn = ${TS.fmtSI(op.In, 'A')}`, C.electron, 'center', f);
    TS.label(c, cx(g.pG), yRail - 10, `I_Dp = ${TS.fmtSI(op.Ip, 'A')}`, C.hole, 'center', f);
    const rn = chN.region, rp = chP.region;
    TS.label(c, cx(g.nG), sy + jd + 26, `NMOS: ${rn}`, C.text, 'center', 'bold 11px Inter, sans-serif');
    TS.label(c, cx(g.pG), sy + jd + 26, `PMOS: ${rp}`, C.text, 'center', 'bold 11px Inter, sans-serif');
    TS.label(c, X(0.25), Y(0.93), 'Sustrato p (GND)', C.text, 'center', f);
    const trTag = (ch, ga, carrier) => {
      const tr = TS.channelTransport(ch);
      if (tr) TS.tag(c, cx(ga), sy + jd + 46, tr, carrier + { arrastre: ' en el canal', difusion: ' (subumbral)', ambos: ' (inv. moderada)' }[tr]);
    };
    trTag(chN, g.nG, 'e⁻'); trTag(chP, g.pG, 'h⁺');
    TS.label(c, X(0.74), Y(g.wellD) - 14, 'Pozo n (VDD)', C.text, 'center', f);
    TS.label(c, cx(g.nS), sy + jd * 0.6, 'n⁺', C.text, 'center', f); TS.label(c, cx(g.nD), sy + jd * 0.6, 'n⁺', C.text, 'center', f);
    TS.label(c, cx(g.pS), sy + jd * 0.6, 'p⁺', C.text, 'center', f); TS.label(c, cx(g.pD), sy + jd * 0.6, 'p⁺', C.text, 'center', f);
    TS.label(c, cx(g.wc), sy + jd * 0.6, 'n⁺', C.text, 'center', f); TS.label(c, cx(g.psub), sy + jd * 0.6, 'p⁺', C.text, 'center', f);
  }

  // ------------------------------------------------------------ gráficos

  function drawStaticPlots() {
    const VDD = st.VDD, v = vtc;
    // VTC con regiones
    pVtc.frame({ xmin: 0, xmax: VDD, ymin: 0, ymax: VDD * 1.05, xlabel: 'V_in [V]', ylabel: 'V_out [V]' });
    let i0 = 0;
    for (let i = 1; i <= v.xs.length; i++) {
      if (i === v.xs.length || v.codes[i] !== v.codes[i0]) {
        const code = v.codes[i0], x0 = v.xs[i0], x1 = v.xs[i - 1];
        pVtc.band(x0, x1, REGC[code][2]);
        if (x1 - x0 > VDD * 0.03) pVtc.text((x0 + x1) / 2, VDD * 1.0, code, C.text, 'center', 'middle', 'bold 12px Inter, sans-serif');
        i0 = i;
      }
    }
    pVtc.line([0, VDD], [0, VDD], 'rgba(160,175,200,.4)', 1, [4, 4]);
    if (isFinite(v.VIL)) { pVtc.vline(v.VIL, C.warn); pVtc.text(v.VIL, { py: pVtc.y1 - 8 }, 'V_IL', C.warn, 'center'); }
    if (isFinite(v.VIH)) { pVtc.vline(v.VIH, C.warn); pVtc.text(v.VIH, { py: pVtc.y1 - 8 }, 'V_IH', C.warn, 'center'); }
    pVtc.line(v.xs, v.ys, C.violet, 2.4);
    if (isFinite(v.VM)) { pVtc.point(v.VM, v.VM, C.ok, 4); pVtc.text(v.VM + 0.05, v.VM + 0.05, 'V_M', C.ok, 'left', 'bottom'); }
    pVtc.point(op.Vin, op.Vout);
    pVtc.legend(['A', 'B', 'C', 'D', 'E'].map(k => ({ label: `${k}: ${REGC[k][1]}`, color: REGC[k][2].replace(/[\d.]+\)$/, '0.9)') })), 'bl');
    // rectas de carga
    const yMax = Math.max(In(VDD, VDD), Ip(0, 0)) * 1.08;
    pLoad.frame({ xmin: 0, xmax: VDD, ymin: 0, ymax: yMax, yunit: 'A', xlabel: 'V_out [V]', ylabel: 'I_D', ml: 62 });
    for (let k = 1; k <= 5; k++) {
      const vi = VDD * k / 6;
      pLoad.fn(x => In(vi, x), 0, VDD, 'rgba(77,163,255,.22)', 1);
      pLoad.fn(x => Ip(vi, x), 0, VDD, 'rgba(255,107,107,.22)', 1);
    }
    pLoad.fn(x => In(op.Vin, x), 0, VDD, C.electron, 2.4);
    pLoad.fn(x => Ip(op.Vin, x), 0, VDD, C.hole, 2.4);
    pLoad.point(op.Vout, op.In);
    pLoad.legend([{ label: `I_Dn (V_GS = ${op.Vin.toFixed(2)} V)`, color: C.electron }, { label: `I_Dp (V_SG = ${(VDD - op.Vin).toFixed(2)} V)`, color: C.hole }], 'tr');
    // bandas
    const VmidN = TS.sample(op.chN.V, 0.5), VmidP = TS.sample(op.chP.V, 0.5);
    TS.mosBand(pBn, PN, op.Vin, VmidN, 'n', `NMOS · V_GB = ${op.Vin.toFixed(2)} V`);
    TS.mosBand(pBp, PP, op.Vin - VDD, -VmidP, 'p', `PMOS · V_GB = ${(op.Vin - VDD).toFixed(2)} V`);
  }

  function drawCurPlot() {
    const VDD = st.VDD;
    if (st.mode === 'static') {
      document.getElementById('cmos-third-title').innerHTML = 'Corriente de alimentación I<sub>DD</sub> vs V<sub>in</sub>';
      const ym = Math.max(...vtc.Idd) * 1.15 || 1e-6;
      pCur.frame({ xmin: 0, xmax: VDD, ymin: 0, ymax: ym, yunit: 'A', xlabel: 'V_in [V]', ylabel: 'I_DD', ml: 62 });
      pCur.fillBetween(vtc.xs, vtc.Idd, vtc.xs.map(() => 0), 'rgba(79,209,139,.15)');
      pCur.line(vtc.xs, vtc.Idd, C.ok, 2.2);
      pCur.point(op.Vin, op.In);
      pCur.text({ px: pCur.x0 + 8 }, { py: pCur.y0 + 12 }, 'sólo hay corriente cuando ambos conducen', C.muted);
      return;
    }
    document.getElementById('cmos-third-title').innerHTML = 'Formas de onda (tiempo ralentizado)';
    const win = 2 / st.freq, t1 = Math.max(t, win), t0 = t1 - win;
    pCur.frame({ xmin: t0, xmax: t1, ymin: -0.1 * VDD, ymax: VDD * 1.25, xlabel: 't [s] (escala de animación)', ylabel: 'V' });
    const ts = hist.map(h => h[0]);
    const Iref = In(VDD, VDD);
    pCur.line(ts, hist.map(h => h[3] / Iref * VDD * 0.9), 'rgba(77,163,255,.7)', 1.4);
    pCur.line(ts, hist.map(h => h[4] / Iref * VDD * 0.9), 'rgba(255,107,107,.7)', 1.4);
    pCur.line(ts, hist.map(h => h[1]), C.accent2, 2.2);
    pCur.line(ts, hist.map(h => h[2]), C.violet, 2.4);
    pCur.legend([{ label: 'V_in', color: C.accent2 }, { label: 'V_out', color: C.violet }, { label: 'I_Dn (rel.)', color: C.electron }, { label: 'I_Dp (rel.)', color: C.hole }], 'tr');
  }

  function readouts() {
    const rn = op.chN.region, rp = op.chP.region, code = regionCode(rn, rp);
    const col = { A: C.bad, B: C.warn, C: C.ok, D: C.accent, E: C.violet }[code];
    TS.setBadge(document.getElementById('cmos-badge'), `Región ${code}: ${REGC[code][1]}`, col);
    const v = vtc, VDD = st.VDD, h = 1e-3;
    const gain = st.mode === 'static' ? (solve(Math.min(op.Vin + h, VDD)) - solve(Math.max(op.Vin - h, 0))) / (2 * h) : NaN;
    TS.readout(document.getElementById('cmos-read'), [
      ['V_in / V_out', `${op.Vin.toFixed(2)} / ${op.Vout.toFixed(2)} V`],
      ['NMOS', rn], ['PMOS', rp],
      ['I_Dn', TS.fmtSI(op.In, 'A')], ['I_Dp', TS.fmtSI(op.Ip, 'A')],
      ['Ganancia dV_out/dV_in', isFinite(gain) ? gain.toFixed(2) : '—'],
      ['V_M', v.VM.toFixed(3) + ' V'],
      ['V_IL / V_IH', `${v.VIL.toFixed(2)} / ${v.VIH.toFixed(2)} V`],
      ['NM_L = V_IL', v.VIL.toFixed(2) + ' V'],
      ['NM_H = V_DD − V_IH', (VDD - v.VIH).toFixed(2) + ' V'],
      ['P (estática)', TS.fmtSI(VDD * op.In, 'W')],
      ['β_n / β_p', `${TS.fmtSI(KN * WLN, 'A/V²')} / ${TS.fmtSI(KP * WLN * st.ratio, 'A/V²')}`],
    ]);
  }

  let rdTimer = 0;
  M.init = init;
  M.frame = dt => {
    if (M.dirty) compute();
    step(dt);
    if (xsec.visible()) drawXsec();
    const plots = [pVtc, pLoad, pCur, pBn, pBp];
    const dyn = st.mode !== 'static';
    rdTimer += dt;
    if (M.dirty || plots.some(p => p.dirty) || (dyn && rdTimer > 0.05)) {
      drawStaticPlots(); drawCurPlot(); readouts();
      rdTimer = 0;
      M.dirty = false; plots.forEach(p => (p.dirty = false));
      if (dyn) document.querySelector('#tab-cmos [data-out="Vin"]').textContent = st.Vin.toFixed(2) + ' V';
    }
  };
  return M;
})();
