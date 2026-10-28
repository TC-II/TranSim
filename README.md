# TranSim

Simulador interactivo de dispositivos semiconductores para **Teoría de Circuitos II**.

👉 **https://tc-ii.github.io/TranSim/**

| Pestaña | Qué muestra |
|---|---|
| **Juntura PN** | Corte con iones fijos y portadores inyectados/generados, diagrama de bandas con cuasi-niveles de Fermi, I–V (lin/log), ρ(x), E(x), ψ(x). |
| **MOSFET** | Corte transversal con canal de inversión, zonas de vaciamiento y pinch-off; electrones que aceleran donde la carga del canal baja (v = I/Q). Curvas de salida con regiones triodo/saturación, transferencia lin/log (subumbral), efecto cuerpo, bandas verticales (compuerta→sustrato) y laterales (fuente→drenador). |
| **BJT** | Vista intrínseca 1D y corte planar de un NPN integrado, recombinación en la base, efecto Early. Curvas de salida con regiones, Gummel, bandas E→B→C con E_Fn/E_Fp y perfil de minoritarios. |
| **CMOS** | Corte del inversor (NMOS + PMOS en pozo n), VTC con regiones A–E, márgenes de ruido, rectas de carga, corriente de cortocircuito, modo dinámico con C_L y bandas bajo ambas compuertas. |

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
