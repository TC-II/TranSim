// Convierte el HTML de un paso del modo explicación en texto para leer en voz alta.
// La notación (subíndices, letras griegas, operadores, unidades) se lee "como en clase".

const LETTER = {
  a: 'a', b: 'be', c: 'ce', d: 'de', e: 'e', f: 'efe', g: 'ge', h: 'hache', i: 'i', j: 'jota', k: 'ka',
  l: 'ele', m: 'eme', n: 'ene', o: 'o', p: 'pe', q: 'cu', r: 'erre', s: 'ese', t: 'te', u: 'u', v: 've',
  w: 'doble ve', x: 'equis', y: 'ye', z: 'zeta',
  α: 'alfa', β: 'beta', γ: 'gamma', ε: 'épsilon', ρ: 'ro', ψ: 'psi', φ: 'fi', Φ: 'fi', μ: 'mu', τ: 'tau', λ: 'lambda',
  0: 'cero', 1: 'uno', 2: 'dos', 3: 'tres',
};
// subíndices que se leen como palabra
const WORD = { ox: 'óxido', 'mín': 'mínima', 'máx': 'máxima', sat: 'de saturación', 'd,máx': 'de máxima', 'DS,sat': 'de ese de saturación' };
const SUP_DIGIT = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };

const spell = s => WORD[s] ?? [...s].map(c => LETTER[c.toLowerCase()] ?? LETTER[c] ?? c).join(' ');

export function speakable(html) {
  let t = html
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/<\/?(b|i|em|strong)>/g, '');
  // exponentes: e^(V/UT)
  t = t.replace(/<sup>(.*?)<\/sup>/g, (_, x) => ` elevado a la ${x.replace(/([^<])\//g, '$1 sobre ')},`);
  // símbolo con subíndice: el prefijo pegado (qV, qAD, βI, dQ) se deletrea letra por letra
  t = t.replace(/([A-Za-zΦφψεβαρ]+)<sub>(.*?)<\/sub>/g, (_, base, sub) => ` ${spell(base)} ${spell(sub)} `);
  t = t.replace(/<[^>]+>/g, ' ');
  // superíndices unicode
  t = t.replace(/n⁺p/g, 'ene más pe').replace(/n⁺/g, 'ene más').replace(/p⁺/g, 'pe más').replace(/n⁻/g, 'ene menos')
    .replace(/([0-9])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, b, e) => `${b} a la ${[...e].map(c => SUP_DIGIT[c]).join('')}`)
    .replace(/²/g, ' al cuadrado').replace(/√\(/g, 'raíz de (');
  // unidades después de números
  t = t.replace(/(\d)\s?eV\b/g, '$1 electronvoltios').replace(/(\d)\s?mV\b/g, '$1 milivoltios')
    .replace(/(\d)\s?nm\b/g, '$1 nanómetros').replace(/(\d)\s?V\b/g, '$1 voltios')
    .replace(/mV\/década/g, 'milivoltios por década').replace(/milivoltios\/década/g, 'milivoltios por década');
  // funciones de x: ρ(x), E(x), n(0)
  t = t.replace(/(^|[\s(])([A-Za-zρψ])\((x|y|0)\)/g, (_, pre, f, a) => `${pre}${spell(f)} de ${spell(a)}`);
  t = t.replace(/escala log\b/g, 'escala logarítmica').replace(/de ~\s?/g, 'de unos ').replace(/·ln10/g, ' por logaritmo natural de 10')
    .replace(/\b1 (electronvoltio|voltio|milivoltio|nanómetro)s\b/g, '1 $1');
  // siglas y letras sueltas (p, n, W, S...) se deletrean
  t = t.replace(/(^|[^\p{L}])(BE|BC|EB|NPN|PNP|pn|nV|[pnxBCDGIJLNPQRSTVW])(?=$|[^\p{L}])/gu, (_, pre, w) => `${pre}${spell(w)}`);
  // letras griegas sueltas
  t = t.replace(/[αβγερψφΦμτλ]/g, c => ` ${LETTER[c]} `);
  // operadores
  t = t
    .replace(/\s?≫\s?/g, ' mucho mayor que ').replace(/\s?≪\s?/g, ' mucho menor que ')
    .replace(/\s?≈\s?/g, ' aproximadamente ').replace(/\s?∝\s?/g, ' proporcional a ')
    .replace(/\s=\s/g, ' igual a ').replace(/\s?>\s/g, ' mayor que ').replace(/\s?<\s/g, ' menor que ')
    .replace(/\s?→\s?/g, ', entonces ').replace(/~\s?/g, 'del orden de ')
    .replace(/(\w)\s?–\s?(\w)/g, '$1 $2').replace(/\s[−-]\s/g, ' menos ').replace(/(^|[\s(])−/g, '$1menos ')
    .replace(/\s\+\s/g, ' más ').replace(/(^|[\s(])\+/g, '$1más ')
    .replace(/\s?[·×]\s?/g, ' por ').replace(/\s?\/\s?/g, ' sobre ')
    .replace(/&/g, ' y ');
  // los paréntesis de fórmulas no se leen; se convierten en pausas suaves
  t = t.replace(/\(\s*/g, ', ').replace(/\s*\)/g, ',');
  return t.replace(/\s+([,.:;])/g, '$1').replace(/,\s*,/g, ',').replace(/,\s*([.:;])/g, '$1')
    .replace(/\s+/g, ' ').trim();
}
