'use strict';
// Núcleo común: utilidades numéricas, física de semiconductores, gráficos y partículas.
const TS = (() => {
  const UT = 0.025852;       // kT/q a 300 K [V]
  const NI = 1.0e10;         // concentración intrínseca del Si [cm^-3]
  const EG = 1.12;           // gap del Si [eV]
  const EPS_SI = 1.04e-12;   // [F/cm]
  const EPS_OX = 3.45e-13;   // [F/cm]
  const Q = 1.602e-19;

  const C = {
    bg: '#0d121d', grid: '#1c2436', axis: '#5d6880', text: '#cfd6e4', muted: '#8a94ab',
    electron: '#4da3ff', hole: '#ff6b6b',
    Ec: '#e8ecf6', Ev: '#e8ecf6', Ei: '#6f7a92', EF: '#4fd18b', EFn: '#4da3ff', EFp: '#ff6b6b',
    pType: '#4a2433', pPlus: '#6e2e42', nType: '#1f3558', nPlus: '#2b5592',
    depl: '#2a2d38', oxide: '#cdb86a', poly: '#8c5a2b', metal: '#aeb6c4', sti: '#545a68',
    accent: '#5ab0ff', accent2: '#ffb454', ok: '#4fd18b', warn: '#ffcc4d', bad: '#ff6b6b', violet: '#b48cff',
  };

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const softplus = x => (x > 40 ? x : Math.log1p(Math.exp(x)));

  function bisect(f, a, b, it = 64) {
    let fa = f(a);
    for (let i = 0; i < it; i++) {
      const m = 0.5 * (a + b), fm = f(m);
      if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m;
    }
    return 0.5 * (a + b);
  }

  function linspace(a, b, n) {
    const r = new Array(n);
    for (let i = 0; i < n; i++) r[i] = a + (b - a) * i / (n - 1);
    return r;
  }

  function fmtSI(v, unit, digits = 3) {
    if (!isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a < 1e-18) return '0 ' + unit;
    const pre = [[1e-15, 'f'], [1e-12, 'p'], [1e-9, 'n'], [1e-6, 'µ'], [1e-3, 'm'], [1, ''], [1e3, 'k'], [1e6, 'M']];
    let p = pre[0];
    for (const q of pre) if (a >= q[0] * 0.9995) p = q;
    return parseFloat((v / p[0]).toPrecision(digits)).toString() + ' ' + p[1] + unit;
  }
  const fmtV = v => (v >= 0 ? ' ' : '') + v.toFixed(2) + ' V';

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const gauss = r => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(6.2831853 * r());

  // Comprime corrientes de muchas décadas en una tasa visual de partículas [1/s].
  function visRate(I, Imin = 1e-9, Imax = 1e-2, Rmax = 60) {
    if (!(I > Imin)) return 0;
    return Rmax * clamp(Math.log10(I / Imin) / Math.log10(Imax / Imin), 0, 1);
  }

  // ---------------------------------------------------------------- MOS

  // Parámetros electrostáticos de un MOS de sustrato con dopaje N [cm^-3], tox [nm].
  function mosParams(Vt0, N = 1e17, toxNm = 10) {
    const Cox = EPS_OX / (toxNm * 1e-7);                   // F/cm²
    const phiF = UT * Math.log(N / NI);
    const gamma = Math.sqrt(2 * Q * EPS_SI * N) / Cox;     // V^1/2
    const Vfb = Vt0 - 2 * phiF - gamma * Math.sqrt(2 * phiF);
    return { N, Cox, phiF, gamma, Vfb, Vt0, toxNm };
  }

  // Ancho de vaciamiento [nm] para un potencial ψ sobre un dopaje N.
  const depletionNm = (psi, N) => Math.sqrt(2 * EPS_SI * Math.max(psi, 0) / (Q * N)) * 1e7;

  function mosVt(p, Vsb) { return p.Vfb + 2 * p.phiF + p.gamma * Math.sqrt(2 * p.phiF + Math.max(Vsb, -p.phiF)); }
  function mosSlope(p, Vsb) { return 1 + p.gamma / (2 * Math.sqrt(2 * p.phiF + Math.max(Vsb, -p.phiF))); }

  // Ecuación de potencial de superficie (sustrato tipo p, voltajes respecto del cuerpo).
  // Vcb: potencial de cuasi-Fermi de electrones del canal respecto del cuerpo.
  function mosSurface(p, Vgb, Vcb = 0) {
    const e2 = Math.exp(-(2 * p.phiF + Vcb) / UT);
    const F = psi => {
      const a = UT * (Math.exp(-psi / UT) - 1) + psi + (e2 > 0 ? e2 * (UT * (Math.exp(psi / UT) - 1) - psi) : 0);
      return Math.sqrt(Math.max(a, 0));
    };
    const g = psi => p.Vfb + psi + Math.sign(psi) * p.gamma * F(psi) - Vgb;
    const psi = bisect(g, -1.2, 2 * p.phiF + Vcb + 1.5);
    const Qs = -Math.sign(psi) * p.gamma * F(psi);                          // [V] (Q/Cox)
    const Qb = psi > UT ? -p.gamma * Math.sqrt(psi - UT) : 0;
    const Qi = Math.min(Qs - Qb, 0);
    let regime;
    if (psi < -2 * UT) regime = 'acumulación';
    else if (psi < 2 * UT) regime = 'banda plana';
    else if (psi < p.phiF) regime = 'vaciamiento';
    else if (psi < 2 * p.phiF + Vcb) regime = 'inversión débil';
    else regime = 'inversión fuerte';
    return { psi, Qs, Qb, Qi, regime, Vox: Vgb - p.Vfb - psi };
  }

  // Modelo EKV continuo (válido de subumbral a inversión fuerte). Magnitudes positivas
  // tanto para NMOS como PMOS (para PMOS pasar Vsg, Vsd, |Vt|).
  function mosCurrent(m) {
    const Vp = (m.Vgs - m.Vt) / m.n;
    const a = softplus(Vp / (2 * UT)), b = softplus((Vp - m.Vds) / (2 * UT));
    const Id = 2 * m.n * m.beta * UT * UT * (a * a - b * b) * (1 + m.lambda * Math.max(m.Vds, 0));
    const Vov = m.Vgs - m.Vt;
    const Vdsat = Math.max(Vov / m.n, 0);
    const region = Vov <= 0 ? 'corte' : (m.Vds < Vdsat ? 'triodo' : 'saturación');
    return { Id, Vov, Vdsat, Vp, region };
  }

  // Perfil a lo largo del canal (u=0 fuente, u=1 drenador): carga de inversión q(u) [V]
  // y potencial de canal V(u) [V], incluyendo el estrangulamiento (pinch-off).
  function mosChannel(m, N = 48) {
    const op = mosCurrent(m);
    const n = m.n, Vp = op.Vp;
    const q = new Float64Array(N), V = new Float64Array(N);
    const qOf = v => 2 * n * UT * softplus((Vp - v) / (2 * UT));
    const strong = op.Vov > 3 * UT;
    const pinch = strong && m.Vds > op.Vdsat;
    const Le = pinch ? 1 - Math.min(0.32, 0.11 * Math.sqrt(m.Vds - op.Vdsat)) : 1;
    const Vde = Math.min(m.Vds, strong ? op.Vdsat : m.Vds);
    const Vov = Math.max(op.Vov, 0);
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      let v;
      if (strong) {
        if (u <= Le) {
          const c = (u / Le) * (Vov * Vde - n * Vde * Vde / 2);
          v = (Vov - Math.sqrt(Math.max(Vov * Vov - 2 * n * c, 0))) / n;
        } else {
          const t = (u - Le) / (1 - Le);
          v = op.Vdsat + (m.Vds - op.Vdsat) * t * t;
        }
        q[i] = u <= Le ? qOf(v) : qOf(m.Vds) * 0.3;
      } else {
        // inversión débil: transporte por difusión, carga lineal con la posición
        v = m.Vds * u;
        q[i] = lerp(qOf(0), qOf(m.Vds), u);
      }
      V[i] = v;
    }
    return { ...op, q, V, Le, pinch, N };
  }

  const sample = (arr, u) => {
    const N = arr.length, f = clamp(u, 0, 1) * (N - 1), i = Math.min(Math.floor(f), N - 2), t = f - i;
    return arr[i] * (1 - t) + arr[i + 1] * t;
  };

  // ---------------------------------------------------------------- Canvas / gráficos

  class Surface {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.w = 0; this.h = 0;
      new ResizeObserver(() => this.resize()).observe(canvas);
      this.resize();
    }
    resize() {
      const r = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.w = Math.max(10, r.width); this.h = Math.max(10, r.height);
      this.canvas.width = Math.round(this.w * dpr);
      this.canvas.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.dirty = true;
    }
    clear(bg = C.bg) {
      this.ctx.fillStyle = bg;
      this.ctx.fillRect(0, 0, this.w, this.h);
    }
    visible() { return this.canvas.offsetParent !== null; }
  }

  function niceStep(range, target) {
    const raw = range / Math.max(target, 1);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const r = raw / mag;
    return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
  }

  class Plot extends Surface {
    frame(o) {
      this.o = o;
      const ctx = this.ctx;
      this.clear();
      const ml = o.ml ?? 58, mr = o.mr ?? 14, mt = o.mt ?? (o.title ? 24 : 12), mb = o.mb ?? (o.xlabel ? 38 : 16);
      this.x0 = ml; this.x1 = this.w - mr; this.y0 = mt; this.y1 = this.h - mb;
      this.ylog = !!o.ylog;
      this.ya = this.ylog ? Math.log10(o.ymin) : o.ymin;
      this.yb = this.ylog ? Math.log10(o.ymax) : o.ymax;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.lineWidth = 1;
      // grilla y ticks
      ctx.strokeStyle = C.grid; ctx.fillStyle = C.muted;
      if (o.xticks !== false) {
        const st = niceStep(o.xmax - o.xmin, Math.max(3, (this.x1 - this.x0) / 70));
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        for (let x = Math.ceil(o.xmin / st - 1e-9) * st; x <= o.xmax + 1e-9; x += st) {
          const px = this.X(x);
          ctx.beginPath(); ctx.moveTo(px, this.y0); ctx.lineTo(px, this.y1); ctx.stroke();
          ctx.fillText((Math.abs(x) < 1e-12 ? 0 : +x.toPrecision(4)).toString(), px, this.y1 + 4);
        }
      }
      if (o.yticks !== false) {
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        if (this.ylog) {
          const step = Math.max(1, Math.round((this.yb - this.ya) / 6));
          for (let k = Math.ceil(this.ya); k <= this.yb; k += step) {
            const py = this.Y(Math.pow(10, k));
            ctx.beginPath(); ctx.moveTo(this.x0, py); ctx.lineTo(this.x1, py); ctx.stroke();
            ctx.fillText(o.yunit ? fmtSI(Math.pow(10, k), o.yunit, 1) : '1e' + k, this.x0 - 5, py);
          }
        } else {
          const st = niceStep(o.ymax - o.ymin, Math.max(3, (this.y1 - this.y0) / 40));
          for (let y = Math.ceil(o.ymin / st - 1e-9) * st; y <= o.ymax + 1e-9; y += st) {
            const py = this.Y(y);
            ctx.beginPath(); ctx.moveTo(this.x0, py); ctx.lineTo(this.x1, py); ctx.stroke();
            const lab = o.yunit ? fmtSI(y, o.yunit, 3) : Math.abs(y) < 1e-12 * st ? '0' : Math.abs(y) >= 1e4 ? y.toExponential(1) : (+y.toPrecision(4)).toString();
            ctx.fillText(lab, this.x0 - 5, py);
          }
        }
      }
      ctx.strokeStyle = C.axis;
      ctx.strokeRect(this.x0 + 0.5, this.y0 + 0.5, this.x1 - this.x0, this.y1 - this.y0);
      ctx.fillStyle = C.text;
      if (o.xlabel) { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(o.xlabel, (this.x0 + this.x1) / 2, this.h - 3); }
      if (o.ylabel) {
        ctx.save(); ctx.translate(12, (this.y0 + this.y1) / 2); ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.ylabel, 0, 0); ctx.restore();
      }
      if (o.title) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = C.muted; ctx.fillText(o.title, this.x0, 5); }
      return this;
    }
    X(x) { return this.x0 + (x - this.o.xmin) / (this.o.xmax - this.o.xmin) * (this.x1 - this.x0); }
    Y(y) {
      const v = this.ylog ? Math.log10(Math.max(y, 1e-300)) : y;
      return this.y1 - (v - this.ya) / (this.yb - this.ya) * (this.y1 - this.y0);
    }
    clip() { const c = this.ctx; c.save(); c.beginPath(); c.rect(this.x0, this.y0, this.x1 - this.x0, this.y1 - this.y0); c.clip(); }
    unclip() { this.ctx.restore(); }
    line(xs, ys, color, width = 2, dash = null) {
      const c = this.ctx;
      this.clip();
      c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash || []);
      c.beginPath();
      let pen = false;
      for (let i = 0; i < xs.length; i++) {
        const y = ys[i];
        if (!isFinite(y) || (this.ylog && !(y > 0))) { pen = false; continue; }
        const px = this.X(xs[i]), py = this.Y(y);
        if (!pen) { c.moveTo(px, py); pen = true; } else c.lineTo(px, py);
      }
      c.stroke(); c.setLineDash([]);
      this.unclip();
    }
    fn(f, a, b, color, width = 2, dash = null, n = 200) {
      const xs = linspace(a, b, n);
      this.line(xs, xs.map(f), color, width, dash);
    }
    band(x0, x1, color) { // franja vertical completa
      this.clip();
      this.ctx.fillStyle = color;
      const a = this.X(x0), b = this.X(x1);
      this.ctx.fillRect(Math.min(a, b), this.y0, Math.abs(b - a), this.y1 - this.y0);
      this.unclip();
    }
    fillBetween(xs, ya, yb, color) {
      const c = this.ctx;
      this.clip();
      c.fillStyle = color; c.beginPath();
      for (let i = 0; i < xs.length; i++) c.lineTo(this.X(xs[i]), this.Y(ya[i]));
      for (let i = xs.length - 1; i >= 0; i--) c.lineTo(this.X(xs[i]), this.Y(yb[i]));
      c.closePath(); c.fill();
      this.unclip();
    }
    vline(x, color, dash = [4, 4], width = 1) {
      const c = this.ctx, px = this.X(x);
      c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash);
      c.beginPath(); c.moveTo(px, this.y0); c.lineTo(px, this.y1); c.stroke(); c.setLineDash([]);
    }
    hline(y, color, dash = [4, 4], width = 1) {
      const c = this.ctx, py = this.Y(y);
      if (py < this.y0 || py > this.y1) return;
      c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash);
      c.beginPath(); c.moveTo(this.x0, py); c.lineTo(this.x1, py); c.stroke(); c.setLineDash([]);
    }
    point(x, y, color = C.accent2, r = 5) {
      const c = this.ctx, px = this.X(x), py = this.Y(y);
      if (!isFinite(py)) return;
      c.fillStyle = color; c.strokeStyle = '#000'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(px, clamp(py, this.y0, this.y1), r, 0, 6.2832); c.fill(); c.stroke();
    }
    text(x, y, s, color = C.text, align = 'left', base = 'middle', font = '11px Inter, system-ui, sans-serif') {
      const c = this.ctx;
      c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = base;
      c.fillText(s, typeof x === 'number' ? this.X(x) : x.px, typeof y === 'number' ? this.Y(y) : y.py);
    }
    legend(items, corner = 'tr') {
      const c = this.ctx;
      c.font = '11px Inter, system-ui, sans-serif';
      const w = Math.max(...items.map(i => c.measureText(i.label).width)) + 34;
      const h = items.length * 15 + 6;
      const x = corner.includes('r') ? this.x1 - w - 6 : this.x0 + 6;
      const y = corner.includes('t') ? this.y0 + 6 : this.y1 - h - 6;
      c.fillStyle = 'rgba(13,18,29,.85)'; c.fillRect(x, y, w, h);
      items.forEach((it, k) => {
        const yy = y + 10 + k * 15;
        c.strokeStyle = it.color; c.lineWidth = 2; c.setLineDash(it.dash || []);
        c.beginPath(); c.moveTo(x + 5, yy); c.lineTo(x + 24, yy); c.stroke(); c.setLineDash([]);
        c.fillStyle = C.text; c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillText(it.label, x + 29, yy);
      });
    }
  }

  // Diagrama de bandas genérico: xs, Ei(x) [eV], cuasi-niveles de Fermi y portadores.
  // o: {xs, Ei, EFn, EFp, EF (opcional, único), regions:[{x0,x1,label,color}], dots}
  function drawBands(plot, o) {
    const xs = o.xs, N = xs.length;
    const Ec = o.Ei.map(e => e + EG / 2), Ev = o.Ei.map(e => e - EG / 2);
    let lo = Infinity, hi = -Infinity;
    for (const arr of [Ec, Ev, o.EFn, o.EFp, ...(o.extra || [])]) if (arr) for (const v of arr) { if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
    const pad = 0.25 + 0.06 * (hi - lo);
    plot.frame({ xmin: xs[0], xmax: xs[N - 1], ymin: lo - pad, ymax: hi + pad, xticks: false, ylabel: 'Energía [eV]', xlabel: o.xlabel, title: o.title, ml: 46, mb: o.xlabel ? 34 : 18 });
    if (o.regions) for (const r of o.regions) {
      plot.band(r.x0, r.x1, r.color);
      plot.text((r.x0 + r.x1) / 2, { py: plot.y1 - 9 }, r.label, C.muted, 'center');
    }
    if (o.pre) o.pre(plot);
    plot.fillBetween(xs, Ec, Ec.map(v => v + 0.08), 'rgba(77,163,255,.10)');
    plot.fillBetween(xs, Ev, Ev.map(v => v - 0.08), 'rgba(255,107,107,.10)');
    // portadores: puntos fijos cuya visibilidad depende de log(n/ni)
    if (o.n || o.p) {
      const r = rng(7), ctx = plot.ctx;
      const M = Math.round((plot.x1 - plot.x0) / 2.2);
      const el = [], ho = [];
      for (let k = 0; k < M; k++) {
        const fx = (k + r()) / M, x = lerp(xs[0], xs[N - 1], fx);
        const i = Math.min(N - 1, Math.round(fx * (N - 1)));
        const u1 = r(), u2 = r(), d1 = r(), d2 = r();
        if (o.n && o.n[i] !== null) {
          const s = clamp((Math.log10(Math.max(o.n[i], 1e-30)) - 1.5) / 7.5, 0, 1);
          if (u1 < s * 0.9) el.push([plot.X(x), plot.Y(Ec[i]) - 2.5 - d1 * 7 * (0.4 + s)]);
        }
        if (o.p && o.p[i] !== null) {
          const s = clamp((Math.log10(Math.max(o.p[i], 1e-30)) - 1.5) / 7.5, 0, 1);
          if (u2 < s * 0.9) ho.push([plot.X(x), plot.Y(Ev[i]) + 2.5 + d2 * 7 * (0.4 + s)]);
        }
      }
      plot.clip();
      dots(ctx, el, C.electron, 1.8);
      dots(ctx, ho, C.hole, 1.8);
      plot.unclip();
    }
    plot.line(xs, Ec, C.Ec, 2);
    plot.line(xs, Ev, C.Ev, 2);
    plot.line(xs, o.Ei, C.Ei, 1, [2, 3]);
    if (o.EF) plot.line(xs, o.EF, C.EF, 1.6, [6, 4]);
    if (o.EFn) plot.line(xs, o.EFn, C.EFn, 1.6, [6, 4]);
    if (o.EFp) plot.line(xs, o.EFp, C.EFp, 1.6, [6, 4]);
    if (o.post) o.post(plot);
    // etiquetas de las bandas al borde derecho
    const lab = (arr, s, col) => { const v = arr[N - 1]; if (isFinite(v)) plot.text({ px: plot.x1 - 3 }, v, s, col, 'right', 'bottom', 'bold 11px Inter, sans-serif'); };
    lab(Ec, 'E꜀', C.Ec); lab(Ev, 'Eᵥ', C.Ev);
    if (o.legend !== false) {
      const items = [{ label: 'E꜀ / Eᵥ', color: C.Ec }, { label: 'Eᵢ', color: C.Ei, dash: [2, 3] }];
      if (o.EF) items.push({ label: 'E_F', color: C.EF, dash: [6, 4] });
      if (o.EFn) items.push({ label: 'E_Fn', color: C.EFn, dash: [6, 4] });
      if (o.EFp) items.push({ label: 'E_Fp', color: C.EFp, dash: [6, 4] });
      plot.legend(items, o.legendCorner || 'tr');
    }
  }

  // Potencial de una juntura con perfil parabólico (aproximación de vaciamiento).
  // Devuelve ψ(x) dado: ψL a la izquierda, ψR a la derecha, juntura en xj, anchos wL, wR.
  function junctionPsi(x, xj, wL, wR, psiL, psiR) {
    const D = psiL - psiR, W = wL + wR;
    if (x <= xj - wL) return psiL;
    if (x >= xj + wR) return psiR;
    if (x <= xj) { const t = (x - (xj - wL)) / wL; return psiL - D * (wL / W) * t * t; }
    const t = ((xj + wR) - x) / wR; return psiR + D * (wR / W) * t * t;
  }

  // ---------------------------------------------------------------- partículas

  function dots(ctx, pts, color, r = 2.2, glow = 0) {
    if (!pts.length) return;
    ctx.fillStyle = color;
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
    ctx.beginPath();
    for (const p of pts) { ctx.moveTo(p[0] + r, p[1]); ctx.arc(p[0], p[1], r, 0, 6.2832); }
    ctx.fill();
    if (glow) ctx.shadowBlur = 0;
  }

  // Nube de portadores mayoritarios con agitación térmica alrededor de posiciones base.
  // Coordenadas normalizadas del dispositivo (0..1).
  class Cloud {
    constructor(n, sampler, seed = 1, amp = 0.006) {
      const r = rng(seed);
      this.amp = amp;
      this.p = [];
      for (let i = 0; i < n; i++) {
        const [x, y] = sampler(r);
        this.p.push({ bx: x, by: y, x, y, u: r(), w1: 1.5 + 2.5 * r(), w2: 1.5 + 2.5 * r(), f1: r() * 6.28, f2: r() * 6.28 });
      }
      this.t = 0;
    }
    update(dt) {
      this.t += dt;
      const t = this.t, a = this.amp;
      for (const p of this.p) {
        p.x = p.bx + a * Math.sin(t * p.w1 + p.f1);
        p.y = p.by + a * 1.4 * Math.cos(t * p.w2 + p.f2);
      }
    }
  }

  // Portadores minoritarios: punto con contorno blanco para distinguirlos de los mayoritarios.
  function minority(ctx, pts, color, r = 2.6) {
    if (!pts.length) return;
    ctx.beginPath();
    for (const p of pts) { ctx.moveTo(p[0] + r, p[1]); ctx.arc(p[0], p[1], r, 0, 6.2832); }
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1; ctx.stroke();
  }

  // Ícono de iones fijos (+ o −).
  function ions(ctx, pts, sign, color = 'rgba(255,255,255,.55)', s = 2.6) {
    if (!pts.length) return;
    ctx.strokeStyle = color; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const p of pts) {
      ctx.moveTo(p[0] - s, p[1]); ctx.lineTo(p[0] + s, p[1]);
      if (sign > 0) { ctx.moveTo(p[0], p[1] - s); ctx.lineTo(p[0], p[1] + s); }
    }
    ctx.stroke();
  }

  function label(ctx, x, y, s, color = C.text, align = 'center', font = 'bold 12px Inter, system-ui, sans-serif', base = 'middle') {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
    ctx.fillText(s, x, y);
  }

  // Etiqueta del mecanismo de transporte: 'arrastre' (J = qµnE) o 'difusion' (J = qD dn/dx).
  const TRANSPORT = { arrastre: ['arrastre', '#ffb454'], difusion: ['difusión', '#4fd18b'], ambos: ['arrastre + difusión', '#7fd8ff'] };
  function tag(ctx, x, y, kind, extra = '', align = 'center') {
    const [name, col] = TRANSPORT[kind];
    const s = name + (extra ? ' · ' + extra : '');
    ctx.font = 'bold 10px Inter, system-ui, sans-serif';
    const w = ctx.measureText(s).width + 14;
    const x0 = align === 'center' ? x - w / 2 : align === 'left' ? x : x - w;
    ctx.fillStyle = 'rgba(13,18,29,.82)'; ctx.strokeStyle = col; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(x0, y - 8, w, 16, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x0 + w / 2, y + 0.5);
  }

  // Mecanismo dominante en el canal de un MOS según el nivel de inversión.
  function channelTransport(ch) {
    if (!(ch.Id > 1e-15)) return null;
    if (ch.Vov < -2 * UT) return 'difusion';
    if (ch.Vov < 6 * UT) return 'ambos';
    return 'arrastre';
  }

  function terminal(ctx, x, y, name, volts, color = C.accent2) {
    ctx.fillStyle = '#0d121d'; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x - 34, y - 11, 68, 22, 6); ctx.fill(); ctx.stroke();
    label(ctx, x, y, name + (volts !== undefined ? ' ' + volts.toFixed(2) + 'V' : ''), color, 'center', 'bold 11px Inter, sans-serif');
  }

  function arrow(ctx, x0, y0, x1, y1, color, w = 2, head = 7) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - head * 0.6 * Math.cos(a), y1 - head * 0.6 * Math.sin(a)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(a - 0.4), y1 - head * Math.sin(a - 0.4));
    ctx.lineTo(x1 - head * Math.cos(a + 0.4), y1 - head * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
  }

  // ---------------------------------------------------------------- UI

  // Vincula sliders <input type=range data-key> con un objeto de estado.
  function bindControls(root, state, onChange) {
    root.querySelectorAll('[data-key]').forEach(el => {
      const key = el.dataset.key;
      const out = root.querySelector(`[data-out="${key}"]`);
      const fmt = el.dataset.fmt || '2';
      const unit = el.dataset.unit ?? '';
      const show = () => { if (out) out.textContent = (el.type === 'checkbox' ? '' : (+state[key]).toFixed(+fmt) + (unit ? ' ' + unit : '')); };
      if (el.type === 'checkbox') el.checked = !!state[key];
      else el.value = state[key];
      show();
      el.addEventListener('input', () => {
        state[key] = el.type === 'checkbox' ? el.checked : (el.tagName === 'SELECT' ? el.value : +el.value);
        show();
        onChange && onChange(key);
      });
      el._refresh = () => { if (el.type !== 'checkbox') el.value = state[key]; show(); };
    });
  }

  function setBadge(el, text, color) {
    el.textContent = text;
    el.style.color = color;
    el.style.background = color + '22';
  }

  function readout(table, rows) {
    table.innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  }

  return {
    UT, NI, EG, EPS_SI, EPS_OX, Q, C,
    clamp, lerp, smooth, softplus, bisect, linspace, fmtSI, fmtV, rng, gauss, visRate,
    mosParams, mosVt, mosSlope, mosSurface, mosCurrent, mosChannel, depletionNm, sample,
    Surface, Plot, drawBands, junctionPsi, dots, Cloud, ions, minority, label, terminal, arrow, tag, channelTransport,
    bindControls, setBadge, readout,
  };
})();
