# TranSim

Simulador interactivo de dispositivos semiconductores para **Teoría de Circuitos II**.

👉 **https://tc-ii.github.io/TranSim/**

| Pestaña | Qué muestra |
|---|---|
| **Arrastre y difusión** | Barra de Si con portadores en agitación térmica (caminata aleatoria) bajo un campo y/o un gradiente de concentración; trayectoria de un portador, flujo neto medido, perfil simulado vs. solución exacta, componentes de corriente, bandas inclinadas con cuasi-nivel de Fermi, velocidad de arrastre con saturación y relación de Einstein. |
| **Juntura PN** | Corte con iones fijos y portadores inyectados/generados, diagrama de bandas con cuasi-niveles de Fermi, I–V (lin/log), ρ(x), E(x), ψ(x). |
| **MOSFET** | Corte transversal con canal de inversión, zonas de vaciamiento y pinch-off; electrones que aceleran donde la carga del canal baja (v = I/Q). Curvas de salida con regiones triodo/saturación, transferencia lin/log (subumbral), efecto cuerpo, bandas verticales (compuerta→sustrato) y laterales (fuente→drenador). |
| **BJT** | Vista intrínseca 1D y corte planar de un NPN integrado, recombinación en la base, efecto Early. Curvas de salida con regiones, Gummel, bandas E→B→C con E_Fn/E_Fp y perfil de minoritarios. |
| **Capacitor MOS** | Corte con carga de compuerta y campo en el óxido, acumulación/vaciamiento/inversión, transitorio de generación y vaciamiento profundo, minoritarios. Bandas, C–V (BF, AF, vaciamiento profundo), ρ(y), E(y), ψ(y). |

## Modo explicación

El botón **▶ Modo explicación** abre un recorrido guiado de 47 pasos por las cinco pestañas (arrastre y difusión → juntura PN → capacitor MOS → MOSFET → BJT).
Cada paso mueve los controles con una transición animada, resalta el gráfico relevante y explica la física. Se navega con ← → y se puede saltar a cualquier paso o tema.

Cada paso tiene **narración en voz alta** (🔊, tecla N para silenciar), velocidad de voz 1× / 1,25× / 1,5× y opción de *avance automático* al terminar el audio.
Los guiones hablados están en `tools/narration.mjs` (una explicación por paso, no la lectura del texto del panel) y los MP3 de `audio/`
se sintetizan con [Chatterbox](https://github.com/resemble-ai/chatterbox) multilingüe en GPU, clonando el timbre de una voz de referencia
(un narrador de dominio público de LibriVox):

```bash
uv venv --python 3.11 ~/.local/share/chatterbox/venv
printf 'torch==2.8.0\ntorchaudio==2.8.0\n' > /tmp/ov.txt   # torch 2.8 + CUDA 12.8 para GPUs RTX 50
VIRTUAL_ENV=~/.local/share/chatterbox/venv uv pip install --extra-index-url https://download.pytorch.org/whl/cu128 \
  --index-strategy unsafe-best-match --override /tmp/ov.txt chatterbox-tts "setuptools<81"
# voz de referencia: 10–15 s de habla limpia en ~/.local/share/chatterbox/voz.wav
node tools/gen_audio.mjs          # regenera sólo los pasos cuyo guion cambió
node tools/gen_audio.mjs pn-3     # un paso puntual
```

Las letras sueltas se escriben como se pronuncian en los guiones ("pe", "ene") para que la voz no las deletree.

## Modelos

- MOSFET: modelo continuo tipo EKV + ecuación de potencial de superficie (aproximación de lámina de carga).
- BJT: Ebers–Moll (transporte) con efecto Early.
- Junturas: aproximación de vaciamiento.

Los parámetros son didácticos; algunas cosas están exageradas a propósito para que se vean (p. ej. I_B ×5 en la animación del BJT).

## Desarrollo

Sitio estático sin dependencias ni build: HTML + Canvas + JS.

```bash
python3 -m http.server 8000
```
