#!/usr/bin/env node
// Genera la narración del modo explicación: audio/<tab>-<n>.mp3 por cada paso de js/tour.js.
// El guion de cada paso está en tools/narration.mjs; sólo se regeneran los que cambiaron
// (audio/manifest.json guarda un hash por paso).
//
//   node tools/gen_audio.mjs            # pasos nuevos o modificados
//   node tools/gen_audio.mjs --all      # todos
//   node tools/gen_audio.mjs pn-3 bjt-2 # sólo esos
//
// Motor: Chatterbox multilingüe (tools/tts_chatterbox.py) en GPU, clonando una voz de referencia.
//   CHATTERBOX_PY  ~/.local/share/chatterbox/venv/bin/python
//   VOICE_REF      ~/.local/share/chatterbox/voz.wav   (10–15 s de habla limpia)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadChapters } from './tour-texts.mjs';
import { NARRATION } from './narration.mjs';

const ROOT = new URL('../', import.meta.url);
const OUT = new URL('audio/', ROOT).pathname;
const PY = process.env.CHATTERBOX_PY || join(homedir(), '.local/share/chatterbox/venv/bin/python');
const REF = process.env.VOICE_REF || join(homedir(), '.local/share/chatterbox/voz.wav');
const TEMPO = 1.25;                               // aceleración final de la voz (sin cambiar el tono)
const args = process.argv.slice(2), all = args.includes('--all'), only = args.filter(a => !a.startsWith('--'));

const steps = loadChapters(ROOT).flatMap(c => c.steps.map((s, i) => ({ id: `${c.tab}-${i + 1}` })));
for (const s of steps) {
  s.say = NARRATION[s.id];
  if (!s.say) throw new Error(`Falta el guion de ${s.id} en tools/narration.mjs`);
}
const extra = Object.keys(NARRATION).filter(id => !steps.some(s => s.id === id));
if (extra.length) console.warn(`Guiones sin paso en tour.js: ${extra.join(', ')}`);

mkdirSync(OUT, { recursive: true });
const manPath = join(OUT, 'manifest.json');
const manifest = existsSync(manPath) ? JSON.parse(readFileSync(manPath, 'utf8')) : {};
const refHash = createHash('sha1').update(readFileSync(REF)).digest('hex').slice(0, 8);
const tmp = join(tmpdir(), `transim-tts-${process.pid}`);
mkdirSync(tmp, { recursive: true });

const todo = steps.filter(s => {
  s.hash = createHash('sha1').update(refHash + TEMPO + '\n' + s.say).digest('hex').slice(0, 12);
  if (only.length) return only.includes(s.id);
  return all || manifest[s.id]?.hash !== s.hash || !existsSync(join(OUT, s.id + '.mp3'));
});

if (todo.length) {
  const jobs = todo.map(s => ({ text: s.say, wav: join(tmp, s.id + '.wav') }));
  writeFileSync(join(tmp, 'jobs.json'), JSON.stringify(jobs));
  execFileSync(PY, [new URL('tts_chatterbox.py', import.meta.url).pathname, join(tmp, 'jobs.json'), REF], { stdio: ['ignore', 'inherit', 'ignore'] });
  for (const s of todo) {
    const mp3 = join(OUT, s.id + '.mp3');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(tmp, s.id + '.wav'), '-af', `atempo=${TEMPO},loudnorm=I=-18:TP=-1.5`, '-ar', '24000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '64k', mp3]);
    const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString().trim();
    manifest[s.id] = { hash: s.hash, dur: Math.round(dur * 10) / 10 };
  }
}
for (const id of Object.keys(manifest)) if (!steps.some(s => s.id === id)) { rmSync(join(OUT, id + '.mp3'), { force: true }); delete manifest[id]; }
rmSync(tmp, { recursive: true, force: true });
writeFileSync(manPath, JSON.stringify(manifest, null, 1) + '\n');
console.log(`${todo.length} audio(s) generados, ${steps.length} pasos en total.`);
