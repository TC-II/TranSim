'use strict';
TS.MOSFET = (() => {
  const { UT, C, clamp, lerp } = TS;
  const P = TS.mosParams(0.7, 1e17, 10);
  const KP = 200e-6;                          // µn·Cox [A/V²]
  const PHI_NP = UT * Math.log(1e20 / TS.NI); // n+ de fuente/drenador
  const VBI = P.phiF + PHI_NP;
  const st = { Vgs: 2.5, Vds: 1.5, Vsb: 0, WL: 10, lambda: 0.05, cut: 0.5, logT: false, speed: 1 };
  const M = { dirty: true };
  let xsec, pOut, pTr, pBV, pBL;
  let holes, eS, eD, accL, invL, flow = [], acc = 0, op = null;
  const r = TS.rng(5);
  const KV = 2, D0 = 12, QREF = 3;

  const model = (Vgs, Vds, Vsb = st.Vsb) => {
    const Vt = TS.mosVt(P, Vsb), n = TS.mosSlope(P, Vsb);
    return { beta: KP * st.WL, Vt, n, lambda: st.lambda, Vgs, Vds };
  };
  const Id = (Vgs, Vds, Vsb) => TS.mosCurrent(model(Vgs, Vds, Vsb)).Id;

  // Geometría en píxeles a partir del tamaño del canvas.
  function geo(w, h) {
    const sy = h * 0.40;
    return {
      w, h, sy, x0: 30, x1: w - 30, by: h - 34,
      gx0: w * 0.34, gx1: w * 0.66,
      sx0: w * 0.10, sx1: w * 0.345, dx0: w * 0.655, dx1: w * 0.90,
      jd: h * 0.15, tox: 7, gh: h * 0.085,
      nmPx: (h * 0.075) / TS.depletionNm(2 * P.phiF, P.N),
    };
  }

  function init() {
    const $ = id => document.getElementById(id);
    xsec = new TS.Surface($('mos-xsec'));
    pOut = new TS.Plot($('mos-out')); pTr = new TS.Plot($('mos-tr'));
    pBV = new TS.Plot($('mos-bandv')); pBL = new TS.Plot($('mos-bandl'));
    // nubes en coordenadas normalizadas (x/w, y/h); la geometría es proporcional al canvas
    const g = geo(1, 1);
    const inNp = (x, y) => y < g.sy + g.jd + 0.01 && ((x > g.sx0 - 0.01 && x < g.sx1 + 0.01) || (x > g.dx0 - 0.01 && x < g.dx1 + 0.01));
    holes = new TS.Cloud(440, rr => {
      for (;;) { const x = lerp(g.x0 / 900, 1 - g.x0 / 900, rr()), y = lerp(g.sy + 0.012, 0.9, rr()); if (!inNp(x, y)) return [x, y]; }
    }, 21, 0.0035);
    eS = new TS.Cloud(110, rr => [lerp(g.sx0 + 0.006, g.sx1 - 0.006, rr()), lerp(g.sy + 0.01, g.sy + g.jd - 0.01, rr())], 22, 0.003);
    eD = new TS.Cloud(110, rr => [lerp(g.dx0 + 0.006, g.dx1 - 0.006, rr()), lerp(g.sy + 0.01, g.sy + g.jd - 0.01, rr())], 23, 0.003);
    accL = new TS.Cloud(90, rr => [lerp(g.gx0, g.gx1, rr()), g.sy + 0.004 + 0.018 * rr()], 24, 0.002);
    invL = new TS.Cloud(120, rr => [lerp(g.gx0 - 0.01, g.gx1 + 0.01, rr()), rr()], 25, 0.0025);
    TS.bindControls($('tab-mosfet'), st, () => { M.dirty = true; });
    compute();
  }

  function compute() {
    const m = model(st.Vgs, st.Vds);
    const ch = TS.mosChannel(m, 48);
    const dep = new Float64Array(ch.N), psi = new Float64Array(ch.N);
    for (let i = 0; i < ch.N; i++) {
      const s = TS.mosSurface(P, st.Vgs + st.Vsb, st.Vsb + ch.V[i]);
      psi[i] = s.psi;
      dep[i] = TS.depletionNm(Math.max(s.psi, 0), P.N);
    }
    const sCut = TS.mosSurface(P, st.Vgs + st.Vsb, st.Vsb + TS.sample(ch.V, st.cut));
    op = { m, ch, dep, psi, sCut };
  }

  // ------------------------------------------------------------ animación

  function step(dt) {
    dt *= st.speed;
    holes.update(dt); eS.update(dt); eD.update(dt); accL.update(dt); invL.update(dt);
    const { ch, m } = op;
    const idb = ch.Id / m.beta;
    acc += Math.min(140, D0 * KV * idb) * dt;
    while (acc >= 1) { acc--; flow.push({ u: -0.3 - 0.05 * r(), f: r() }); }
    for (const p of flow) {
      let v;
      if (p.u < 0 || p.u > 1) v = 0.7;
      else if (p.u > ch.Le) v = 2.4;
      else v = clamp(KV * idb / Math.max(TS.sample(ch.q, p.u), 0.04), 0.02, 2.4);
      p.u += v * dt;
      p.f = clamp(p.f + (r() - 0.5) * 0.15, 0, 1);
      if (p.u > 1.32) p.dead = true;
    }
    flow = flow.filter(p => !p.dead);
    if (flow.length > 500) flow.splice(0, flow.length - 500);
  }

  function drawXsec() {
    const s = xsec, c = s.ctx, g = geo(s.w, s.h);
    const { ch, dep, sCut } = op;
    s.clear();
    const Vds = st.Vds, Vsb = st.Vsb;
    const wS = TS.depletionNm(VBI + Vsb, P.N) * g.nmPx, wD = TS.depletionNm(VBI + Vsb + Vds, P.N) * g.nmPx;
    const depAt = x => (x < g.gx0 || x > g.gx1) ? 0 : TS.sample(dep, (x - g.gx0) / (g.gx1 - g.gx0)) * g.nmPx;
    const rad = g.jd * 0.55;
    // sustrato y zonas de vaciamiento
    c.fillStyle = C.pType; c.fillRect(g.x0, g.sy, g.x1 - g.x0, g.by - g.sy);
    c.save(); c.beginPath(); c.rect(g.x0, g.sy, g.x1 - g.x0, g.by - g.sy); c.clip();
    c.fillStyle = C.depl;
    c.beginPath(); c.roundRect(g.sx0 - wS, g.sy - 1, g.sx1 - g.sx0 + 2 * wS, g.jd + wS + 1, [0, 0, rad + wS, rad + wS]); c.fill();
    c.beginPath(); c.roundRect(g.dx0 - wD, g.sy - 1, g.dx1 - g.dx0 + 2 * wD, g.jd + wD + 1, [0, 0, rad + wD, rad + wD]); c.fill();
    c.beginPath(); c.moveTo(g.gx0, g.sy);
    for (let i = 0; i <= 60; i++) { const x = lerp(g.gx0, g.gx1, i / 60); c.lineTo(x, g.sy + depAt(x)); }
    c.lineTo(g.gx1, g.sy); c.closePath(); c.fill();
    c.restore();
    const inDep = (x, y) => {
      const d = y - g.sy;
      if (x >= g.gx0 && x <= g.gx1 && d < depAt(x)) return true;
      const inR = (a, b, w) => {
        if (x < a - w || x > b + w || d > g.jd + w) return false;
        if (d < g.jd - rad) return true;
        const R = rad + w, cy = g.jd - rad;
        if (x < a + rad) return Math.hypot(x - (a + rad), d - cy) < R;
        if (x > b - rad) return Math.hypot(x - (b - rad), d - cy) < R;
        return true;
      };
      return inR(g.sx0, g.sx1, wS) || inR(g.dx0, g.dx1, wD);
    };
    // fuente y drenador n+
    c.fillStyle = C.nPlus;
    c.beginPath(); c.roundRect(g.sx0, g.sy, g.sx1 - g.sx0, g.jd, [0, 0, rad, rad]); c.fill();
    c.beginPath(); c.roundRect(g.dx0, g.sy, g.dx1 - g.dx0, g.jd, [0, 0, rad, rad]); c.fill();
    // huecos mayoritarios (posiciones base = aceptores; en vaciamiento queda el ion −)
    const hv = [], hi = [];
    for (const p of holes.p) {
      const x = p.bx * g.w, y = p.by * g.h;
      if (inDep(x, y)) hi.push([x, y]); else hv.push([p.x * g.w, p.y * g.h]);
    }
    TS.ions(c, hi, -1, 'rgba(255,160,160,.7)');
    TS.dots(c, hv, C.hole, 2);
    // acumulación de huecos en la superficie
    const accS = clamp(-op.psi[0] / 0.12, 0, 1);
    TS.dots(c, accL.p.filter(p => p.u < accS).map(p => [p.x * g.w, p.y * g.h]), C.hole, 2);
    // electrones en n+
    TS.dots(c, [...eS.p, ...eD.p].map(p => [p.x * g.w, p.y * g.h]), C.electron, 2);
    // canal de inversión
    const thick = q => 1.5 + 10 * clamp(q / QREF, 0, 1.3);
    const grd = c.createLinearGradient(0, g.sy, 0, g.sy + 14);
    grd.addColorStop(0, 'rgba(77,163,255,.75)'); grd.addColorStop(1, 'rgba(77,163,255,.05)');
    c.fillStyle = grd;
    c.beginPath(); c.moveTo(g.gx0 - 4, g.sy);
    for (let i = 0; i <= 60; i++) {
      const u = i / 60, q = TS.sample(ch.q, u), a = clamp(q / 0.15, 0, 1);
      c.lineTo(lerp(g.gx0, g.gx1, u), g.sy + thick(q) * a);
    }
    c.lineTo(g.gx1 + 4, g.sy); c.closePath(); c.fill();
    const inv = [];
    for (const p of invL.p) {
      const u = clamp((p.x * g.w - g.gx0) / (g.gx1 - g.gx0), 0, 1), q = TS.sample(ch.q, u);
      if (p.u < q / QREF * 1.2) inv.push([p.x * g.w, g.sy + 1.2 + p.by * thick(q) * 0.9]);
    }
    c.globalAlpha = 0.65; TS.dots(c, inv, C.electron, 1.8); c.globalAlpha = 1;
    // óxido, compuerta y contactos
    c.fillStyle = C.oxide; c.fillRect(g.gx0 - 10, g.sy - g.tox, g.gx1 - g.gx0 + 20, g.tox);
    c.fillStyle = C.poly; c.fillRect(g.gx0, g.sy - g.tox - g.gh, g.gx1 - g.gx0, g.gh);
    const scx = (g.sx0 + g.gx0 - 14) / 2, dcx = (g.dx1 + g.gx1 + 14) / 2, cw = g.w * 0.07;
    c.fillStyle = C.metal;
    c.fillRect(scx - cw / 2, g.sy - 12, cw, 12);
    c.fillRect(dcx - cw / 2, g.sy - 12, cw, 12);
    c.fillRect(g.x0, g.by, g.x1 - g.x0, 8);
    const gcx = (g.gx0 + g.gx1) / 2, gTop = g.sy - g.tox - g.gh;
    c.fillRect(gcx - cw / 2, gTop - 8, cw, 8);
    c.strokeStyle = C.metal; c.lineWidth = 2;
    c.beginPath();
    c.moveTo(scx, g.sy - 12); c.lineTo(scx, 34);
    c.moveTo(dcx, g.sy - 12); c.lineTo(dcx, 34);
    c.moveTo(gcx, gTop - 8); c.lineTo(gcx, 34);
    c.stroke();
    TS.terminal(c, scx, 22, 'S', 0);
    TS.terminal(c, gcx, 22, 'G', st.Vgs);
    TS.terminal(c, dcx, 22, 'D', st.Vds);
    TS.terminal(c, g.w / 2, g.by + 20, 'B', -Vsb);
    // electrones del flujo de corriente
    const fl = [];
    for (const p of flow) {
      let x, y;
      const t0 = thick(TS.sample(ch.q, 0));
      if (p.u < 0) { x = lerp(scx, g.gx0, (p.u + 0.3) / 0.3); y = g.sy + 2 + p.f * t0; }
      else if (p.u <= 1) {
        x = lerp(g.gx0, g.gx1, p.u);
        y = p.u > ch.Le ? g.sy + 2 + p.f * Math.max(6, depAt(x) * 0.35) : g.sy + 1.5 + p.f * thick(TS.sample(ch.q, p.u)) * 0.9;
      } else { x = lerp(g.gx1, dcx, (p.u - 1) / 0.32); y = g.sy + 2 + p.f * 8; }
      fl.push([x, y]);
    }
    TS.dots(c, fl, '#a8d4ff', 2.4, 7);
    // líneas de corte
    const xc = lerp(g.gx0, g.gx1, st.cut);
    c.setLineDash([5, 4]); c.lineWidth = 1.3;
    c.strokeStyle = C.warn; c.beginPath(); c.moveTo(xc, gTop); c.lineTo(xc, g.by); c.stroke();
    c.strokeStyle = '#7fd8ff'; c.beginPath(); c.moveTo(g.sx0 + 10, g.sy + 3); c.lineTo(g.dx1 - 10, g.sy + 3); c.stroke();
    c.setLineDash([]);
    // etiquetas
    const f = '11px Inter, sans-serif';
    TS.label(c, (g.sx0 + g.sx1) / 2, g.sy + g.jd * 0.62, 'Fuente n⁺', C.text, 'center', f);
    TS.label(c, (g.dx0 + g.dx1) / 2, g.sy + g.jd * 0.62, 'Drenador n⁺', C.text, 'center', f);
    TS.label(c, gcx, g.sy - g.tox - g.gh / 2, 'Poli-Si n⁺', '#f0dcc0', 'center', f);
    TS.label(c, g.x0 + 8, g.by - 12, 'Sustrato p', C.text, 'left', f);
    TS.label(c, g.gx1 + 14, g.sy - g.tox / 2 - 1, 'SiO₂', C.oxide, 'left', '10px Inter, sans-serif');
    if (ch.pinch) {
      const xp = lerp(g.gx0, g.gx1, ch.Le);
      TS.arrow(c, xp - 2, g.sy + 46, xp, g.sy + 6, C.accent2, 1.4, 6);
      TS.label(c, xp - 2, g.sy + 54, 'pinch-off', C.accent2, 'center', f);
    }
    const dmax = Math.max(...dep) * g.nmPx;
    if (dmax > 12) TS.label(c, g.gx0 + 6, g.sy + dmax * 0.65, `W_d ≈ ${Math.round(Math.max(...dep))} nm`, C.muted, 'left', '10px Inter, sans-serif');
    TS.label(c, g.w - 34, g.h - 12, `regimen bajo G: ${op.sCut.regime}`, C.muted, 'right', '10px Inter, sans-serif');
  }

  // ------------------------------------------------------------ gráficos

  function drawPlots() {
    const { ch, m } = op;
    const VdsMax = 5, Vt = m.Vt;
    // salida
    const yMax = Id(5, VdsMax) * 1.08;
    pOut.frame({ xmin: 0, xmax: VdsMax, ymin: 0, ymax: yMax, yunit: 'A', xlabel: 'V_DS [V]', ylabel: 'I_D', ml: 62 });
    const vgList = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].filter(v => v > Vt + 0.05);
    const loc = TS.linspace(Vt, 5, 60).map(vg => { const mm = model(vg, 0); const vds = (vg - Vt) / mm.n; return [vds, Id(vg, vds)]; });
    {
      const cx = pOut.ctx; pOut.clip();
      cx.fillStyle = 'rgba(90,176,255,.07)'; cx.beginPath(); cx.moveTo(pOut.X(0), pOut.Y(0));
      for (const [x, y] of loc) cx.lineTo(pOut.X(x), pOut.Y(y));
      cx.lineTo(pOut.X(loc[loc.length - 1][0]), pOut.Y(yMax)); cx.lineTo(pOut.X(0), pOut.Y(yMax)); cx.closePath(); cx.fill();
      pOut.unclip();
    }
    for (const vg of vgList) {
      pOut.fn(vd => Id(vg, vd), 0, VdsMax, 'rgba(160,175,200,.45)', 1.2);
      pOut.text({ px: pOut.x1 - 3 }, Id(vg, VdsMax), `${vg} V`, C.muted, 'right', 'bottom', '10px Inter, sans-serif');
    }
    pOut.line(loc.map(p => p[0]), loc.map(p => p[1]), C.warn, 1.3, [5, 4]);
    pOut.fn(vd => Id(st.Vgs, vd), 0, VdsMax, C.accent, 2.4);
    pOut.point(st.Vds, ch.Id);
    pOut.text({ px: pOut.x0 + 10 }, { py: pOut.y0 + 12 }, 'Triodo', C.accent, 'left', 'middle', 'bold 11px Inter, sans-serif');
    pOut.text({ px: pOut.x0 + (pOut.x1 - pOut.x0) * 0.55 }, { py: pOut.y0 + 12 }, 'Saturación', C.ok, 'left', 'middle', 'bold 11px Inter, sans-serif');
    pOut.text({ px: pOut.x0 + (pOut.x1 - pOut.x0) * 0.55 }, { py: pOut.y0 + 26 }, 'V_DS = V_DS,sat', C.warn, 'left', 'middle', '10px Inter, sans-serif');
    // transferencia
    const vgA = -1.5, vgB = 5;
    if (st.logT) {
      pTr.frame({ xmin: vgA, xmax: vgB, ymin: 1e-13, ymax: 1e-1, ylog: true, yunit: 'A', xlabel: 'V_GS [V]', ylabel: 'I_D', ml: 62 });
      pTr.band(vgA, Vt, 'rgba(255,107,107,.06)');
      if (st.Vsb > 0) pTr.fn(vg => Id(vg, st.Vds, 0), vgA, vgB, 'rgba(160,175,200,.5)', 1.2, [4, 3], 300);
      pTr.fn(vg => Id(vg, st.Vds), vgA, vgB, C.accent, 2.4, null, 300);
      pTr.point(st.Vgs, Math.max(ch.Id, 1e-13));
      pTr.text(vgA + 0.1, 1e-11, 'subumbral', C.bad, 'left');
    } else {
      const ym = Id(vgB, st.Vds) * 1.08 || 1e-6;
      pTr.frame({ xmin: vgA, xmax: vgB, ymin: 0, ymax: ym, yunit: 'A', xlabel: 'V_GS [V]', ylabel: 'I_D', ml: 62 });
      pTr.band(vgA, Vt, 'rgba(255,107,107,.06)');
      if (st.Vsb > 0) pTr.fn(vg => Id(vg, st.Vds, 0), vgA, vgB, 'rgba(160,175,200,.5)', 1.2, [4, 3], 300);
      pTr.fn(vg => Id(vg, st.Vds), vgA, vgB, C.accent, 2.4, null, 300);
      // frontera triodo/saturación sobre la curva: V_GS = V_T + n V_DS
      pTr.vline(Vt + m.n * st.Vds, 'rgba(255,204,77,.6)', [3, 3]);
      pTr.text(Vt + m.n * st.Vds + 0.05, ym * 0.9, 'sat. | triodo', C.warn, 'left');
      pTr.point(st.Vgs, ch.Id);
    }
    pTr.vline(Vt, C.bad, [4, 3], 1.3);
    pTr.text(Vt + 0.05, st.logT ? 1e-2 : (Id(vgB, st.Vds) * 0.5), `V_T = ${Vt.toFixed(2)} V`, C.bad, 'left');
    if (st.Vsb > 0) pTr.legend([{ label: `V_SB = ${st.Vsb.toFixed(2)} V`, color: C.accent }, { label: 'V_SB = 0', color: 'rgba(160,175,200,.7)', dash: [4, 3] }], 'tl');
    // bandas
    const Vc = TS.sample(ch.V, st.cut);
    TS.mosBand(pBV, P, st.Vgs + st.Vsb, st.Vsb + Vc, 'n', `x/L = ${st.cut.toFixed(2)} · V_canal = ${Vc.toFixed(2)} V`);
    drawLateral();
  }

  function drawLateral() {
    const { ch, psi } = op;
    const N = 300, xs = TS.linspace(-0.45, 1.45, N);
    const psS = P.phiF + PHI_NP + st.Vsb, psD = psS + st.Vds;
    let ps = xs.map(x => x < 0 ? psS : x > 1 ? psD : TS.sample(psi, x));
    for (let k = 0; k < 4; k++) {        // suavizado de las transiciones de juntura
      const o = ps.slice();
      for (let i = 2; i < N - 2; i++) ps[i] = (o[i - 2] + o[i - 1] + o[i] + o[i + 1] + o[i + 2]) / 5;
    }
    const Ei = ps.map(v => -v);
    const EFn = xs.map(x => -P.phiF - st.Vsb - (x < 0 ? 0 : x > 1 ? st.Vds : TS.sample(ch.V, x)));
    const EFp = xs.map(x => (x < 0 || x > 1) ? NaN : -P.phiF);
    const n = xs.map((x, i) => Math.exp((EFn[i] - Ei[i]) / UT));
    const p = xs.map((x, i) => Math.exp((Ei[i] - (isFinite(EFp[i]) ? EFp[i] : EFn[i])) / UT));
    TS.drawBands(pBL, {
      xs, Ei, EFn, EFp, n, p,
      regions: [
        { x0: -0.45, x1: 0, label: 'Fuente n⁺', color: 'rgba(43,85,146,.18)' },
        { x0: 0, x1: 1, label: 'canal (superficie bajo G)', color: 'rgba(0,0,0,0)' },
        { x0: 1, x1: 1.45, label: 'Drenador n⁺', color: 'rgba(43,85,146,.18)' },
      ],
      post: pl => {
        const barrier = psS - TS.sample(psi, 0.02);
        pl.text(0.5, { py: pl.y0 + 10 }, `barrera fuente→canal: ${barrier.toFixed(2)} eV`, C.accent2, 'center', 'middle', 'bold 11px Inter, sans-serif');
      },
      legendCorner: 'tr',
    });
  }

  function readouts() {
    const { ch, m, sCut } = op;
    const col = { 'corte': C.bad, 'triodo': C.accent, 'saturación': C.ok }[ch.region];
    const name = { 'corte': 'Corte / subumbral', 'triodo': 'Triodo (óhmica)', 'saturación': 'Saturación' }[ch.region];
    TS.setBadge(document.getElementById('mos-badge'), name, col);
    const h = 1e-3;
    const gm = (Id(st.Vgs + h, st.Vds) - Id(st.Vgs - h, st.Vds)) / (2 * h);
    const gds = (Id(st.Vgs, st.Vds + h) - Id(st.Vgs, Math.max(st.Vds - h, 0))) / (st.Vds > h ? 2 * h : h);
    TS.readout(document.getElementById('mos-read'), [
      ['V_T (con V_SB)', m.Vt.toFixed(3) + ' V'],
      ['Factor de pendiente n', m.n.toFixed(3)],
      ['β = k′·W/L', TS.fmtSI(m.beta, 'A/V²')],
      ['V_GS − V_T', ch.Vov.toFixed(3) + ' V'],
      ['V_DS,sat', ch.Vdsat.toFixed(3) + ' V'],
      ['I_D', TS.fmtSI(ch.Id, 'A')],
      ['g_m', TS.fmtSI(gm, 'S')],
      ['r_o = 1/g_ds', gds > 0 ? TS.fmtSI(1 / gds, 'Ω') : '∞'],
      ['ΔL/L (pinch-off)', ch.pinch ? ((1 - ch.Le) * 100).toFixed(1) + ' %' : '—'],
      ['S subumbral', (m.n * UT * Math.LN10 * 1000).toFixed(1) + ' mV/déc'],
      ['ψs en el corte', sCut.psi.toFixed(3) + ' V'],
      ['Régimen en el corte', sCut.regime],
      ['2φ_F', (2 * P.phiF).toFixed(3) + ' V'],
      ['γ', P.gamma.toFixed(3) + ' V½'],
    ]);
  }

  M.init = init;
  M.frame = dt => {
    if (M.dirty) compute();
    step(dt);
    if (xsec.visible()) drawXsec();
    const plots = [pOut, pTr, pBV, pBL];
    if (M.dirty || plots.some(p => p.dirty)) {
      drawPlots(); readouts();
      M.dirty = false; plots.forEach(p => (p.dirty = false));
    }
  };
  return M;
})();
