'use strict';
// Arrastre y difusión en una barra de Si uniforme: los dos mecanismos de transporte antes de las junturas.
// Portadores con caminata aleatoria (agitación térmica) + velocidad de arrastre; reservorios en los
// contactos fijan la concentración en cada extremo (gradiente). Curvas: solución estacionaria exacta
// de la ecuación de arrastre-difusión  F = v·n − D·dn/dx = cte.
TS.DD = (() => {
  const { UT, NI, C, clamp, lerp } = TS;
  const L = 2e-4;                                 // largo de la barra [cm] (2 µm)
  const N0 = 1e16;                                // concentración media [cm⁻³]
  const SP = {
    n: { name: 'electrones', sym: 'e⁻', mu: 1350, vsat: 1.07e7, sgn: -1, col: C.electron, Dvis: 0.075 },
    p: { name: 'huecos', sym: 'h⁺', mu: 480, vsat: 0.84e7, sgn: +1, col: C.hole, Dvis: 0.075 * 480 / 1350 },
  };
  for (const s of Object.values(SP)) s.D = s.mu * UT;   // Einstein: D = µ·kT/q
  const K = 210;                                  // partículas por unidad de largo a N0
  const RES = 0.07;                               // ancho de cada reservorio (unidades de largo)
  const st = { E: 0, g: 0, car: 'n', speed: 1 };
  const M = { dirty: true };
  const r = TS.rng(5);
  let xsec, pConc, pCur, pBand, pVel;
  const parts = { n: [], p: [] }, rate = { n: 0, p: 0 };
  // flujo neto: cruces por el centro en una ventana deslizante de WIN s (se reinicia al mover un control)
  const WIN = 8, log = { n: [], p: [] };
  let tNow = 0, tReset = 0, tShow = 0;
  const resetFlux = () => { log.n = []; log.p = []; tReset = tNow; tShow = 0; };
  let tracer = null, trail = [];
  const NB = 20, hist = { n: new Array(NB).fill(1), p: new Array(NB).fill(1) };

  const species = () => (st.car === 'both' ? ['n', 'p'] : [st.car]);
  const ends = () => [1 + st.g, 1 - st.g];        // n/N0 en x = 0 y x = L
  // Péclet: v·L/D = ±E·L/U_T (los electrones van contra el campo)
  const peclet = k => SP[k].sgn * st.E * 1e3 * L / UT;
  const vdrift = (k, E = st.E) => SP[k].sgn * SP[k].mu * E * 1e3;    // cm/s (régimen lineal)

  // perfil estacionario n(u)/N0 con u = x/L
  function prof(k, u) {
    const [a, b] = ends(), Pe = peclet(k);
    if (Math.abs(Pe) < 1e-6) return a + (b - a) * u;
    return a + (b - a) * Math.expm1(Pe * u) / Math.expm1(Pe);
  }
  function dprof(k, u) {                          // d(n/N0)/du
    const [a, b] = ends(), Pe = peclet(k);
    if (Math.abs(Pe) < 1e-6) return b - a;
    return (b - a) * Pe * Math.exp(Pe * u) / Math.expm1(Pe);
  }
  // densidades de corriente [A/cm²]: arrastre, difusión. J = q·(signo de la carga)·flujo
  function currents(k, u) {
    const s = SP[k];
    const n = prof(k, u) * N0, dndx = dprof(k, u) * N0 / L;
    const Fdr = vdrift(k) * n, Fdi = -s.D * dndx;
    const z = k === 'n' ? -1 : 1;
    return { dr: z * TS.Q * Fdr, di: z * TS.Q * Fdi };
  }

  function init() {
    const $ = id => document.getElementById(id);
    xsec = new TS.Surface($('dd-xsec'));
    pConc = new TS.Plot($('dd-conc')); pCur = new TS.Plot($('dd-cur'));
    pBand = new TS.Plot($('dd-band')); pVel = new TS.Plot($('dd-vel'));
    TS.bindControls($('tab-dd'), st, k => { M.dirty = true; if (k !== 'speed') resetFlux(); });
    $('dd-balance').addEventListener('click', () => {
      // campo que cancela exactamente la difusión: n ∝ e^(Pe·u) con Pe = ln(n(L)/n(0))
      const [a, b] = ends(), k = st.car === 'p' ? 'p' : 'n';
      if (st.car === 'both') { st.car = 'n'; $('tab-dd').querySelector('[data-key="car"]')._refresh(); }
      st.E = +(Math.log(b / a) * UT / (SP[k].sgn * 1e3 * L)).toFixed(3);
      resetFlux();
      $('tab-dd').querySelector('[data-key="E"]')._refresh();
      M.dirty = true;
    });
    for (const k of ['n', 'p']) for (let i = 0; i < K; i++) parts[k].push(spawn(k, -RES + r() * (1 + 2 * RES)));
  }

  function spawn(k, u) { return { u, v: 0.04 + 0.92 * r() }; }

  function walk(k, p, dt) {
    const s = SP[k], D = s.Dvis * st.speed;
    const vd = peclet(k) * D;                     // Pe = v·L/D en unidades normalizadas
    p.u += vd * dt + Math.sqrt(2 * D * dt) * TS.gauss(r);
    p.v += Math.sqrt(2 * D * dt) * TS.gauss(r) * 0.8;
    if (p.v < 0.03) p.v = 0.06 - p.v; else if (p.v > 0.97) p.v = 1.94 - p.v;
  }

  function step(dt) {
    dt = Math.min(dt, 0.04);
    tNow += dt;
    if (tNow - tShow > 0.5) {                     // el número se refresca dos veces por segundo
      tShow = tNow;
      const span = Math.max(1, Math.min(WIN, tNow - tReset));
      for (const k of ['n', 'p']) rate[k] = log[k].reduce((a, [, c]) => a + c, 0) / span;
    }
    const [a, b] = ends();
    for (const k of ['n', 'p']) {
      const P = parts[k];
      let cross = 0;
      for (const p of P) {
        const u0 = p.u;
        walk(k, p, dt);
        if (u0 < 0.5 && p.u >= 0.5) cross++; else if (u0 >= 0.5 && p.u < 0.5) cross--;
      }
      if (cross) log[k].push([tNow, cross]);
      while (log[k].length && log[k][0][0] < tNow - WIN) log[k].shift();
      // reservorios: se fija la cantidad de partículas en cada contacto (concentración de borde)
      let out = P.filter(p => p.u >= -RES && p.u <= 1 + RES);
      for (const [lo, hi, c] of [[-RES, 0, a], [1, 1 + RES, b]]) {
        const inRes = out.filter(p => p.u >= lo && p.u < hi), want = Math.round(c * K * RES);
        for (let i = inRes.length; i < want; i++) out.push(spawn(k, lo + r() * (hi - lo)));
        if (inRes.length > want) { const drop = new Set(inRes.slice(want)); out = out.filter(p => !drop.has(p)); }
      }
      parts[k] = out;
      const cnt = new Array(NB).fill(0);
      for (const p of out) if (p.u >= 0 && p.u < 1) cnt[Math.floor(p.u * NB)]++;
      const a2 = Math.min(1, dt / 1.5);
      hist[k] = hist[k].map((h, i) => h + (cnt[i] / (K / NB) - h) * a2);
    }
    // portador marcado: muestra la trayectoria (agitación + deriva)
    const k = species()[0];
    if (!tracer || tracer.k !== k) { tracer = { k, u: 0.5, v: 0.5 }; trail = []; }
    walk(k, tracer, dt);
    if (tracer.u < 0 || tracer.u > 1) { tracer.u = tracer.u < 0 ? 0.98 : 0.02; trail = []; }
    trail.push([tracer.u, tracer.v]);
    if (trail.length > 160) trail.shift();
  }

  function drawXsec() {
    const s = xsec, c = s.ctx, w = s.w, h = s.h;
    s.clear();
    const bx0 = 74, bx1 = w - 74, by0 = 58, by1 = h - 50;
    const X = u => lerp(bx0, bx1, u), Y = v => lerp(by0, by1, v);
    c.fillStyle = '#232a3a'; c.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
    c.strokeStyle = 'rgba(255,255,255,.25)'; c.strokeRect(bx0 + 0.5, by0 + 0.5, bx1 - bx0, by1 - by0);
    const show = species();
    c.save(); c.beginPath(); c.rect(bx0, by0, bx1 - bx0, by1 - by0); c.clip();
    for (const k of show) TS.dots(c, parts[k].map(p => [X(p.u), Y(p.v)]), SP[k].col, 2.2);
    c.restore();
    // trayectoria del portador marcado
    if (trail.length > 1) {
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.2; c.beginPath();
      trail.forEach(([u, v], i) => (i ? c.lineTo(X(u), Y(v)) : c.moveTo(X(u), Y(v))));
      c.stroke();
      TS.minority(c, [[X(tracer.u), Y(tracer.v)]], SP[tracer.k].col, 3.6);
    }
    // contactos (reservorios)
    c.fillStyle = C.metal;
    c.fillRect(bx0 - 18, by0 - 6, 18, by1 - by0 + 12);
    c.fillRect(bx1, by0 - 6, 18, by1 - by0 + 12);
    const V = st.E * 1e3 * L;                     // tensión aplicada: E uniforme
    TS.terminal(c, bx0 - 9, by0 - 26, 'V', V);
    TS.terminal(c, bx1 + 9, by0 - 26, 'V', 0);
    const [a, b] = ends();
    TS.label(c, bx0 - 9, by1 + 18, `n = ${a.toFixed(1)}·N₀`, C.muted, 'center', '10.5px Inter, sans-serif');
    TS.label(c, bx1 + 9, by1 + 18, `n = ${b.toFixed(1)}·N₀`, C.muted, 'center', '10.5px Inter, sans-serif');
    // campo
    const ay = by0 - 26, xm = (bx0 + bx1) / 2;
    if (Math.abs(st.E) > 0.005) {
      const len = clamp(Math.abs(st.E) / 2, 0.15, 1) * 150 * Math.sign(st.E);
      TS.arrow(c, xm - len / 2, ay, xm + len / 2, ay, C.accent2, 2.4, 9);
      TS.label(c, xm, ay - 14, `E = ${st.E.toFixed(2)} kV/cm`, C.accent2, 'center', 'bold 11px Inter, sans-serif');
    } else TS.label(c, xm, ay, 'E = 0', C.muted, 'center', 'bold 11px Inter, sans-serif');
    // flujo neto medido (cruces por el centro) y mecanismos
    const yy = by1 + 18;
    show.forEach((k, i) => {
      const f = rate[k], y = yy + i * 16;
      if (Math.abs(f) > 1.2) {
        const d = Math.sign(f) * clamp(Math.abs(f) * 3, 18, 70);
        TS.arrow(c, xm - d / 2, y, xm + d / 2, y, SP[k].col, 2, 7);
      }
      TS.label(c, xm + 80, y, `flujo neto de ${SP[k].sym}: ${f >= 0 ? '+' : ''}${f.toFixed(0)}/s`, SP[k].col, 'left', '10.5px Inter, sans-serif');
    });
    const hasE = Math.abs(st.E) > 0.005, hasG = st.g > 0.02, tY = by0 + 14;
    if (hasE) TS.tag(c, X(0.02), tY, 'arrastre', show.length > 1 ? 'e⁻ contra E, h⁺ con E' : `${SP[show[0]].sym} ${SP[show[0]].sgn < 0 ? 'contra' : 'a favor de'} E`, 'left');
    if (hasG) TS.tag(c, X(0.98), tY, 'difusion', 'de más a menos concentración', 'right');
    if (!hasE && !hasG) TS.tag(c, xm, tY, 'ambos', 'sólo agitación térmica: flujo neto 0');
  }

  function drawPlots() {
    const show = species(), xs = TS.linspace(0, 1, 160), xum = xs.map(u => u * L * 1e4);
    // concentración: solución analítica + histograma de la simulación
    const [a, b] = ends();
    pConc.frame({ xmin: 0, xmax: 2, ymin: 0, ymax: 2.1, xlabel: 'x [µm]', ylabel: 'n/N₀, p/N₀', ml: 46 });
    for (const k of show) {
      pConc.ctx.fillStyle = SP[k].col + '33';
      hist[k].forEach((y, i) => {
        const x0 = pConc.X(i / NB * 2), x1 = pConc.X((i + 1) / NB * 2);
        pConc.ctx.fillRect(x0 + 1, pConc.Y(y), x1 - x0 - 2, pConc.y1 - pConc.Y(y));
      });
      pConc.line(xum, xs.map(u => prof(k, u)), SP[k].col, 2.4);
    }
    pConc.legend([...show.map(k => ({ label: `${SP[k].name} (teoría)`, color: SP[k].col })), { label: 'barras: simulación', color: 'rgba(200,200,200,.4)' }], 'tr');
    if (st.g > 0.02) pConc.text(1, 0.12, `dn/dx < 0  →  difusión hacia +x`, C.ok, 'center');

    // componentes de corriente
    const comp = show.map(k => xs.map(u => currents(k, u)));
    const all = comp.flat().flatMap(o => [o.dr, o.di, o.dr + o.di]);
    const m = Math.max(50, ...all.map(Math.abs)) * 1.15;
    pCur.frame({ xmin: 0, xmax: 2, ymin: -m, ymax: m, xlabel: 'x [µm]', ylabel: 'J [A/cm²]', ml: 54 });
    pCur.hline(0, C.axis, []);
    const items = [];
    show.forEach((k, i) => {
      const cc = comp[i], dsh = k === 'p' ? [5, 3] : null, sym = SP[k].sym;
      pCur.line(xum, cc.map(o => o.dr), C.accent2, 2, dsh);
      pCur.line(xum, cc.map(o => o.di), C.ok, 2, dsh);
      pCur.line(xum, cc.map(o => o.dr + o.di), SP[k].col, 2.6, dsh);
      items.push({ label: `arrastre ${sym}`, color: C.accent2, dash: dsh }, { label: `difusión ${sym}`, color: C.ok, dash: dsh }, { label: `total ${sym}`, color: SP[k].col, dash: dsh });
    });
    if (show.length > 1) {
      pCur.line(xum, xs.map((_, j) => comp[0][j].dr + comp[0][j].di + comp[1][j].dr + comp[1][j].di), C.text, 1.4, [2, 3]);
      items.push({ label: 'J total', color: C.text, dash: [2, 3] });
    }
    pCur.legend(items, 'br');
    const tot = comp[0][80].dr + comp[0][80].di, big = Math.max(Math.abs(comp[0][80].dr), Math.abs(comp[0][80].di));
    if (show.length === 1 && big > 1 && Math.abs(tot) < 0.03 * big) pCur.text(1, m * 0.85, 'arrastre = −difusión  →  J = 0', C.accent2, 'center', 'middle', 'bold 11px Inter, sans-serif');

    // bandas (zoom): E uniforme → bandas inclinadas; cuasi-nivel de Fermi según la concentración
    const k0 = show[0], sgE = k0 === 'n' ? 1 : -1;            // banda del portador mostrado
    const Ei = xs.map(u => st.E * 1e3 * u * L);
    const band = Ei.map(e => e + sgE * TS.EG / 2);
    const lines = show.map(k => ({ k, ef: xs.map((u, i) => Ei[i] + (k === 'n' ? 1 : -1) * UT * Math.log(prof(k, u) * N0 / NI)) }));
    const bandOther = show.length > 1 ? Ei.map(e => e - TS.EG / 2) : null;
    const vals = [...band, ...lines.flatMap(l => l.ef), ...(bandOther || [])];
    const lo = Math.min(...vals), hi = Math.max(...vals), pad = 0.06 + 0.1 * (hi - lo);
    pBand.frame({ xmin: 0, xmax: 2, ymin: lo - pad, ymax: hi + pad, xlabel: 'x [µm]', ylabel: 'Energía [eV]', ml: 50 });
    const bandsDraw = [[band, k0]]; if (bandOther) bandsDraw.push([bandOther, 'p']);
    const rr = TS.rng(3), cx = pBand.ctx;
    for (const [bd, k] of bandsDraw) {
      const pts = [], up = k === 'n' ? -1 : 1;
      for (let j = 0; j < 260; j++) {
        const u = rr(), i = Math.round(u * 159);
        if (rr() < prof(k, u) / 2.1) pts.push([pBand.X(u * 2), pBand.Y(bd[i]) + up * (3 + rr() * 9)]);
      }
      pBand.clip(); TS.dots(cx, pts, SP[k].col, 1.8); pBand.unclip();
      pBand.line(xum, bd, C.Ec, 2.2);
      pBand.text({ px: pBand.x1 - 4 }, bd[159], k === 'n' ? 'E꜀' : 'Eᵥ', C.Ec, 'right', k === 'n' ? 'bottom' : 'top', 'bold 11px Inter, sans-serif');
    }
    for (const l of lines) {
      pBand.line(xum, l.ef, SP[l.k].col, 1.8, [6, 4]);
      pBand.text({ px: pBand.x0 + 4 }, l.ef[0], l.k === 'n' ? 'E_Fn' : 'E_Fp', SP[l.k].col, 'left', l.k === 'n' ? 'top' : 'bottom');
    }
    if (Math.abs(st.E) > 0.005) pBand.text(1, { py: pBand.y0 + 10 }, `bandas inclinadas por E: los e⁻ "ruedan" hacia abajo, los h⁺ "flotan" hacia arriba`, C.accent2, 'center', 'middle', '10.5px Inter, sans-serif');
    const cc0 = currents(k0, 0.5), big0 = Math.max(Math.abs(cc0.dr), Math.abs(cc0.di));
    if (show.length === 1 && big0 > 1 && Math.abs(cc0.dr + cc0.di) < 0.03 * big0) pBand.text(1, { py: pBand.y1 - 12 }, `E_F${k0} plano  ⇔  corriente nula`, C.ok, 'center', 'middle', 'bold 11px Inter, sans-serif');
    else if (st.g > 0.02) pBand.text(1, { py: pBand.y1 - 12 }, `E_F${k0} inclinado  ⇔  hay corriente`, C.muted, 'center');

    // velocidad de arrastre vs campo (con saturación)
    const vOf = (k, E) => { const s = SP[k], v = s.mu * Math.abs(E) * 1e3; return v / (1 + v / s.vsat) / 1e6; };
    pVel.frame({ xmin: 0, xmax: 60, ymin: 0, ymax: 11, xlabel: '|E| [kV/cm]', ylabel: 'v_d [10⁶ cm/s]', ml: 46 });
    for (const k of ['n', 'p']) {
      pVel.fn(E => vOf(k, E), 0, 60, SP[k].col, 2.2);
      pVel.fn(E => SP[k].mu * E * 1e3 / 1e6, 0, 60, SP[k].col, 1, [3, 4]);
    }
    pVel.line([0, 60], [10.7, 10.7], C.muted, 1, [2, 4]);
    pVel.text(59, 10.4, 'saturación ≈ 10⁷ cm/s', C.muted, 'right', 'top');
    for (const k of show) pVel.point(Math.abs(st.E), vOf(k, st.E), SP[k].col, 4.5);
    pVel.legend([{ label: `e⁻  µn = ${SP.n.mu} cm²/Vs`, color: C.electron }, { label: `h⁺  µp = ${SP.p.mu} cm²/Vs`, color: C.hole }, { label: 'v = µE (lineal)', color: C.muted, dash: [3, 4] }], 'br');
  }

  function readouts() {
    const show = species(), k = show[0], cc = currents(k, 0.5), big = Math.max(Math.abs(cc.dr), Math.abs(cc.di));
    const badge = document.getElementById('dd-badge');
    const hasE = Math.abs(st.E) > 0.005, hasG = st.g > 0.02;
    if (show.length === 1 && hasE && hasG && Math.abs(cc.dr + cc.di) < 0.03 * big) TS.setBadge(badge, 'Arrastre y difusión se cancelan', C.ok);
    else if (hasE && hasG) TS.setBadge(badge, 'Arrastre + difusión', '#7fd8ff');
    else if (hasE) TS.setBadge(badge, 'Arrastre', C.accent2);
    else if (hasG) TS.setBadge(badge, 'Difusión', C.ok);
    else TS.setBadge(badge, 'Sólo agitación térmica', C.accent);
    const rows = [['V aplicada (E·L)', (st.E * 1e3 * L).toFixed(3) + ' V']];
    for (const kk of show) {
      const s = SP[kk], c2 = currents(kk, 0.5);
      rows.push([`v_d ${s.sym} = µE`, TS.fmtSI(Math.abs(vdrift(kk)) / 100, 'm/s')]);
      rows.push([`D ${s.sym} = µ·kT/q`, s.D.toFixed(1) + ' cm²/s']);
      rows.push([`J ${s.sym} arrastre / difusión`, `${c2.dr.toFixed(0)} / ${c2.di.toFixed(0)} A/cm²`]);
      rows.push([`J ${s.sym} total`, (c2.dr + c2.di).toFixed(0) + ' A/cm²']);
    }
    rows.push(['D/µ (Einstein)', (UT * 1e3).toFixed(1) + ' mV = kT/q']);
    TS.readout(document.getElementById('dd-read'), rows);
  }

  M.init = init;
  M.frame = dt => {
    step(dt);
    if (xsec.visible()) drawXsec();
    const plots = [pConc, pCur, pBand, pVel];
    M.t = (M.t || 0) + dt;
    if (M.t > 0.25) { M.t = 0; pConc.dirty = true; }        // el histograma se actualiza con la simulación
    if (M.dirty || plots.some(p => p.dirty)) {
      drawPlots(); readouts();
      M.dirty = false; plots.forEach(p => (p.dirty = false));
    }
  };
  return M;
})();
