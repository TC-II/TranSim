#!/usr/bin/env node
// Genera la narración del modo explicación: audio/<tab>-<n>.mp3 por cada paso de js/tour.js.
// Sólo regenera los pasos cuyo texto cambió (audio/manifest.json guarda un hash por paso).
//
//   node tools/gen_audio.mjs            # pasos nuevos o modificados
//   node tools/gen_audio.mjs --all      # todos
//   node tools/gen_audio.mjs --print    # sólo muestra el texto hablado
//
// Requiere piper-tts (https://github.com/rhasspy/piper) y ffmpeg. Por defecto busca:
//   PIPER_PY    ~/.local/share/piper-tts/venv/bin/python   (python con `pip install piper-tts`)
//   PIPER_VOICE ~/.local/share/piper-tts/es_AR-daniela-high.onnx
// Un paso puede tener `say: '...'` en tour.js para reemplazar la lectura automática del texto.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { loadChapters } from './tour-texts.mjs';
import { speakable } from './speak.mjs';

const ROOT = new URL('../', import.meta.url);
const OUT = new URL('audio/', ROOT).pathname;
const PY = process.env.PIPER_PY || join(homedir(), '.local/share/piper-tts/venv/bin/python');
const VOICE = process.env.PIPER_VOICE || join(homedir(), '.local/share/piper-tts/es_AR-daniela-high.onnx');
const args = new Set(process.argv.slice(2));

const steps = loadChapters(ROOT).flatMap(c => c.steps.map((s, i) => ({
  id: `${c.tab}-${i + 1}`,
  say: s.say || `${speakable(s.title)}. ${speakable(s.text)}`,
})));

if (args.has('--print')) {
  for (const s of steps) console.log(`[${s.id}] ${s.say}\n`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
const manPath = join(OUT, 'manifest.json');
const manifest = existsSync(manPath) ? JSON.parse(readFileSync(manPath, 'utf8')) : {};
const voice = basename(VOICE, '.onnx');
const tmp = join(tmpdir(), `transim-tts-${process.pid}.wav`);
let made = 0;

for (const s of steps) {
  const hash = createHash('sha1').update(voice + '\n' + s.say).digest('hex').slice(0, 12);
  const mp3 = join(OUT, s.id + '.mp3');
  if (!args.has('--all') && manifest[s.id]?.hash === hash && existsSync(mp3)) continue;
  process.stdout.write(`${s.id} … `);
  execFileSync(PY, ['-m', 'piper', '-m', VOICE, '-f', tmp, '--sentence-silence', '0.3'], { input: s.say, stdio: ['pipe', 'ignore', 'inherit'] });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '48k', mp3]);
  const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString().trim();
  manifest[s.id] = { hash, dur: Math.round(dur * 10) / 10 };
  console.log(`${manifest[s.id].dur} s`);
  made++;
}
// pasos que ya no existen
for (const id of Object.keys(manifest)) if (!steps.some(s => s.id === id)) { rmSync(join(OUT, id + '.mp3'), { force: true }); delete manifest[id]; }
rmSync(tmp, { force: true });
writeFileSync(manPath, JSON.stringify(manifest, null, 1) + '\n');
console.log(`${made} audio(s) generados, ${steps.length} pasos en total.`);
