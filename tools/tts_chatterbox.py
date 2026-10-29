"""Sintetiza los guiones con Chatterbox multilingüe (GPU), clonando el timbre de una voz de referencia.

Uso: python tts_chatterbox.py <trabajos.json> <referencia.wav>
trabajos.json = [{"text": "...", "wav": "/ruta/salida.wav"}, ...]
"""
import json
import re
import sys

import torch
import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

jobs = json.load(open(sys.argv[1]))
ref = sys.argv[2]
model = ChatterboxMultilingualTTS.from_pretrained(device="cuda" if torch.cuda.is_available() else "cpu")


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


for job in jobs:
    torch.manual_seed(7)
    parts = []
    for c in chunks(job["text"]):
        wav = model.generate(c, language_id="es", audio_prompt_path=ref,
                             exaggeration=0.7, cfg_weight=0.3, temperature=0.8)
        pause = 0.25 if c.endswith((".", "?", "!")) else 0.12
        parts += [wav, torch.zeros(1, int(model.sr * pause))]
    ta.save(job["wav"], torch.cat(parts, dim=1), model.sr)
    print(job["wav"], flush=True)
