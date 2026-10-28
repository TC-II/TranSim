# TranSim

Simulador interactivo de dispositivos semiconductores para **Teoría de Circuitos II**.

👉 **https://tc-ii.github.io/TranSim/**

| Pestaña | Qué muestra |
|---|---|
| **Juntura PN** | Corte con iones fijos y portadores inyectados/generados, diagrama de bandas con cuasi-niveles de Fermi, I–V (lin/log), ρ(x), E(x), ψ(x). |
| **MOSFET** | Corte transversal con canal de inversión, zonas de vaciamiento y pinch-off; electrones que aceleran donde la carga del canal baja (v = I/Q). Curvas de salida con regiones triodo/saturación, transferencia lin/log (subumbral), efecto cuerpo, bandas verticales (compuerta→sustrato) y laterales (fuente→drenador). |
| **BJT** | Vista intrínseca 1D y corte planar de un NPN integrado, recombinación en la base, efecto Early. Curvas de salida con regiones, Gummel, bandas E→B→C con E_Fn/E_Fp y perfil de minoritarios. |
| **Capacitor MOS** | Corte con carga de compuerta y campo en el óxido, acumulación/vaciamiento/inversión, transitorio de generación y vaciamiento profundo, minoritarios. Bandas, C–V (BF, AF, vaciamiento profundo), ρ(y), E(y), ψ(y). |

## Modo explicación

El botón **▶ Modo explicación** abre un recorrido guiado de 39 pasos por las cuatro pestañas (juntura PN → capacitor MOS → MOSFET → BJT).
Cada paso mueve los controles con una transición animada, resalta el gráfico relevante y explica la física. Se navega con ← → y se puede saltar a cualquier paso o tema.

Cada paso tiene **narración en voz alta** (🔊, tecla N para silenciar) y opción de *avance automático* al terminar el audio.
Los MP3 de `audio/` se generan con [piper](https://github.com/rhasspy/piper) (voz `es_AR-daniela-high`) a partir de los textos de `js/tour.js`:

```bash
python -m venv ~/.local/share/piper-tts/venv && ~/.local/share/piper-tts/venv/bin/pip install piper-tts
# bajar es_AR-daniela-high.onnx y .onnx.json de huggingface.co/rhasspy/piper-voices a ~/.local/share/piper-tts/
node tools/gen_audio.mjs          # regenera sólo los pasos cuyo texto cambió
node tools/gen_audio.mjs --print  # muestra cómo se va a leer cada paso
```

La notación (subíndices, letras griegas, operadores) se convierte a texto hablado en `tools/speak.mjs`; un paso puede definir `say: '…'` para fijar su lectura a mano.

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
