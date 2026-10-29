"""Sintetiza los guiones con Chatterbox multilingüe (GPU), clonando el timbre de una voz de referencia.

Uso: python tts_chatterbox.py <trabajos.json> <referencia.wav>
trabajos.json = [{"text": "...", "wav": "/ruta/salida.wav"}, ...]

Chatterbox a veces sigue "hablando" después de la última palabra (balbuceo o ruido) y a veces saltea
una oración. Cada frase se transcribe con Whisper (marcas de tiempo por palabra): si faltan palabras se
regenera con otra semilla, y se corta justo después de su última palabra.
"""
import json
import re
import sys
import unicodedata

import torch
import torchaudio as ta
import whisper
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

jobs = json.load(open(sys.argv[1]))
ref = sys.argv[2]
dev = "cuda" if torch.cuda.is_available() else "cpu"
model = ChatterboxMultilingualTTS.from_pretrained(device=dev)
asr = whisper.load_model("medium", device=dev)
SR = model.sr


def chunks(text, limit=230):
    """Agrupa oraciones completas en bloques cortos: Chatterbox entona mejor así."""
    out, cur = [], ""
    for s in re.split(r"(?<=[.?!:])\s+", " ".join(text.split())):
        if cur and len(cur) + len(s) > limit:
            out.append(cur)
            cur = s
        else:
            cur = f"{cur} {s}".strip()
    return out + [cur] if cur else out


def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in w if unicodedata.category(c) != "Mn"))


def listen(wav):
    a16 = ta.functional.resample(wav, SR, 16000)[0].cpu().numpy()
    res = asr.transcribe(a16, language="es", word_timestamps=True, condition_on_previous_text=False, fp16=dev == "cuda")
    return [w for seg in res["segments"] for w in seg.get("words", [])]


def coverage(text, words):
    """Fracción de las palabras del guion que Whisper escuchó."""
    want = [norm(w) for w in text.split() if norm(w)]
    heard = {norm(w["word"]) for w in words}
    return sum(w in heard for w in want) / max(len(want), 1)


def same(a, b):
    return a == b or (len(a) >= 4 and len(b) >= 4 and a[:4] == b[:4])


def trim(wav, text, words):
    """Corta después de la última palabra del texto; si Whisper no la encuentra, después de la última voz."""
    target = norm(text.split()[-1])
    end = None
    for w in reversed(words):
        if same(norm(w["word"]), target):
            end = w["end"]
            break
    if end is None and words:
        end = words[-1]["end"]
    hop = int(SR * 0.02)
    x = wav[0]
    env = x[: x.numel() // hop * hop].reshape(-1, hop).pow(2).mean(1).sqrt()
    peak = env.max().item() + 1e-9
    if end is None:                                # sin transcripción: recorte por energía
        loud = (env > 0.05 * peak).nonzero()
        end = (loud[-1].item() + 1) * hop / SR if len(loud) else x.numel() / SR
    # primer tramo silencioso cerca del final de la palabra (las marcas de Whisper pueden errar ±0,1 s)
    cut = end + 0.06
    for i in range(max(int(end * SR / hop), 0), min(int((end + 0.30) * SR / hop), len(env))):
        if env[i] < 0.06 * peak:
            cut = i * hop / SR + 0.04
            break
    n = min(int(cut * SR), x.numel())
    out = wav[:, :n].clone()
    fade = min(int(0.05 * SR), n)
    out[:, n - fade:] *= torch.linspace(1, 0, fade, device=out.device)
    return out


for job in jobs:
    parts = []
    for c in chunks(job["text"]):
        best = None
        for seed in (7, 11, 23, 42):
            torch.manual_seed(seed)
            wav = model.generate(c, language_id="es", audio_prompt_path=ref,
                                 exaggeration=0.7, cfg_weight=0.3, temperature=0.8)
            words = listen(wav)
            cov = coverage(c, words)
            if best is None or cov > best[0]:
                best = (cov, wav, words)
            if cov >= 0.85:
                break
        if best[0] < 0.85:
            print(f"  aviso: frase incompleta ({best[0]:.0%}): {c[:60]}…", flush=True)
        pause = 0.25 if c.endswith((".", "?", "!")) else 0.12
        parts += [trim(best[1], c, best[2]), torch.zeros(1, int(SR * pause))]
    ta.save(job["wav"], torch.cat(parts, dim=1), SR)
    print(job["wav"], flush=True)
