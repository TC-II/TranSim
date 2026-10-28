'use strict';
// Diagrama de bandas vertical de una estructura MOS (compuerta / óxido / semiconductor).
// type 'n' = NMOS (sustrato p), 'p' = PMOS (sustrato n). Vgb y Vcb son valores reales
// respecto del cuerpo; Vcb es el potencial del canal (cuasi-Fermi de minoritarios).
TS.mosBand = function (plot, p, Vgb, Vcb, type, title, opt = {}) {
  const { UT, C, EG } = TS;
  const sg = type === 'n' ? 1 : -1;
  const s = TS.mosSurface(p, sg * Vgb, sg * Vcb);
  const psiS = sg * s.psi;
  const Wref = TS.depletionNm(2 * p.phiF, p.N);
  const WdA = TS.depletionNm(Math.max(s.psi, 0), p.N) / Wref;
  const xEnd = Math.max(3.0, WdA * 1.25), sc = xEnd / 3;
  const xG0 = -1.3 * sc, xOx = -0.45 * sc, N = 260;
  const xs = TS.linspace(xG0, xEnd, N);
  const Ei = [], EFn = [], EFp = [], nn = [], pp = [];
  const EFbulk = -sg * p.phiF;
  const Wd = TS.depletionNm(Math.max(s.psi, 0), p.N) / Wref;
  const LD = Math.sqrt(TS.EPS_SI * UT / (TS.Q * p.N)) * 1e7 / Wref;
  for (const x of xs) {
    if (x < 0) { Ei.push(NaN); EFn.push(NaN); EFp.push(NaN); nn.push(null); pp.push(null); continue; }
    let psi;
    if (s.psi >= 0) psi = x < Wd ? s.psi * (1 - x / Wd) ** 2 : 0;
    else psi = s.psi * Math.exp(-x / (1.5 * LD));
    // psi en "magnitud" (convención sustrato p); pasar a valores reales
    const psiR = sg * psi;
    Ei.push(-psiR);
    const nMin = Math.exp((psi - p.phiF - sg * Vcb) / UT);   // minoritarios (/ni)
    const nMaj = Math.exp((p.phiF - psi) / UT);              // mayoritarios (/ni)
    const efMin = opt.deep ? NaN : EFbulk - Vcb, nm = opt.deep ? null : nMin;
    if (type === 'n') {
      EFp.push(EFbulk); EFn.push(efMin); nn.push(nm); pp.push(nMaj);
    } else {
      EFn.push(EFbulk); EFp.push(efMin); pp.push(nm); nn.push(nMaj);
    }
  }
  const Ec0 = -psiS + EG / 2, Ev0 = -psiS - EG / 2;
  const EcOx0 = Ec0 + 3.1, VoxR = sg * s.Vox;
  const EcOxG = EcOx0 - VoxR, EvOx0 = Ev0 - 4.7, EvOxG = EvOx0 - VoxR;
  const EFg = EFbulk - Vgb;
  const subLabel = opt.subLabel || (type === 'n' ? 'Si tipo p' : 'Si tipo n (pozo)');
  TS.drawBands(plot, {
    xs, Ei, EFn, EFp, n: nn, p: pp, title,
    extra: [[EFg, EFg - 0.3, EFg + 0.3, Ec0 + 0.9, Ev0 - 0.9]],
    regions: [
      { x0: xG0, x1: xOx, label: 'Compuerta', color: 'rgba(174,182,196,.10)' },
      { x0: xOx, x1: 0, label: 'SiO₂', color: 'rgba(205,184,106,.13)' },
      { x0: 0, x1: xEnd, label: subLabel, color: 'rgba(0,0,0,0)' },
    ],
    pre: pl => {
      // metal de compuerta: estados llenos hasta E_F
      const c = pl.ctx;
      pl.clip();
      c.fillStyle = 'rgba(77,163,255,.18)';
      const yF = pl.Y(EFg);
      c.fillRect(pl.X(xG0), yF, pl.X(xOx) - pl.X(xG0), pl.y1 - yF);
      pl.unclip();
    },
    post: pl => {
      pl.line([xOx, 0], [EcOxG, EcOx0], C.Ec, 2);
      pl.line([xOx, 0], [EvOxG, EvOx0], C.Ev, 2);
      pl.line([xG0, xOx], [EFg, EFg], C.EF, 2.2);
      pl.text(xG0 + 0.05, EFg - 0.05, 'E_F,m', C.EF, 'left', 'top');
      pl.text(xEnd / 2, { py: pl.y0 + 10 }, `ψs = ${psiS.toFixed(3)} V · ${s.regime}`, C.accent2, 'center', 'middle', 'bold 11px Inter, sans-serif');
    },
    legendCorner: opt.legendCorner || (type === 'n' ? 'br' : 'tr'),
  });
  return s;
};
