// Carga js/tour.js fuera del navegador y devuelve los capítulos del modo explicación.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function loadChapters(root) {
  const ctx = { TS: {}, document: { getElementById: () => ({ addEventListener() {} }) } };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('js/tour.js', root), 'utf8') + '\nTS.TOUR.CHAPTERS', ctx);
  return ctx.TS.TOUR.CHAPTERS;
}
