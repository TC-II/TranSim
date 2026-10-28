'use strict';
// Modo explicación: recorrido guiado por toda la física, paso a paso.
// Cada paso fija controles (con transición animada), resalta un gráfico y explica qué se ve.
TS.TOUR = (() => {
  const CHAPTERS = [
    {
      tab: 'pn', name: 'Juntura PN',
      reset: { Va: 0, logI: true, speed: 1 },
      steps: [
        {
          title: 'Equilibrio: nace la zona de vaciamiento', focus: 'pn-xsec', set: { Va: 0 },
          text: `Al unir un semiconductor p con uno n, los huecos difunden hacia n y los electrones hacia p (hay un gradiente enorme de concentración).
            Al irse, dejan atrás <b>iones fijos sin compensar</b>: aceptores (−) del lado p y donores (+) del lado n. Esa es la <b>zona de vaciamiento</b>.
            Los iones generan un campo eléctrico que empuja a los portadores en sentido contrario. En equilibrio, para cada tipo de portador la corriente de <b>difusión</b> se cancela exactamente con la de <b>arrastre</b>: I = 0.`,
        },
        {
          title: 'Bandas en equilibrio', focus: 'pn-band', set: { Va: 0 },
          text: `En equilibrio el nivel de Fermi es <b>plano</b> en todo el dispositivo (E<sub>Fn</sub> = E<sub>Fp</sub>): no hay corriente neta.
            Para que E<sub>F</sub> quede cerca de E<sub>c</sub> en el lado n y cerca de E<sub>v</sub> en el lado p, las bandas tienen que curvarse una altura
            <b>qV<sub>bi</sub> ≈ 0,76 eV</b>. Esa es la barrera que deben superar los mayoritarios para pasar al otro lado.
            Los puntitos sobre E<sub>c</sub> y bajo E<sub>v</sub> muestran cuántos electrones y huecos hay en cada punto (escala logarítmica).`,
        },
        {
          title: 'Carga, campo y potencial', focus: 'pn-rho', set: { Va: 0 },
          text: `Con la <b>aproximación de vaciamiento</b> la carga ρ(x) es rectangular: −qN<sub>A</sub> en x<sub>p</sub> y +qN<sub>D</sub> en x<sub>n</sub>.
            Integrando ρ/ε se obtiene un campo E(x) <b>triangular</b> (máximo en la juntura) e integrando otra vez, un potencial ψ(x) parabólico que sube V<sub>bi</sub>.
            La neutralidad exige N<sub>A</sub>x<sub>p</sub> = N<sub>D</sub>x<sub>n</sub>: la zona se extiende más en el lado <b>menos dopado</b> (acá el p).`,
        },
        {
          title: 'Polarización directa: inyección', focus: 'pn-xsec', set: { Va: 0.6 },
          text: `Con V<sub>A</sub> > 0 la barrera baja a q(V<sub>bi</sub> − V<sub>A</sub>) y la zona de vaciamiento se angosta.
            Muchos más mayoritarios logran cruzar: los electrones entran al lado p y los huecos al lado n, donde son <b>minoritarios</b>.
            Ahí avanzan por <b>difusión</b> y se van recombinando con los mayoritarios (destellos amarillos) a lo largo de una longitud de difusión.`,
        },
        {
          title: 'Cuasi-niveles de Fermi', focus: 'pn-band', set: { Va: 0.6 },
          text: `Fuera del equilibrio ya no hay un único E<sub>F</sub>: los electrones tienen E<sub>Fn</sub> y los huecos E<sub>Fp</sub>.
            En la zona de vaciamiento ambos son casi planos y están separados exactamente <b>qV<sub>A</sub></b>.
            En las zonas neutras vuelven a juntarse a medida que el exceso de minoritarios desaparece por recombinación.`,
        },
        {
          title: 'Ley de la juntura y concentraciones', focus: 'pn-conc', set: { Va: 0.6 },
          text: `En los bordes de la zona de vaciamiento se cumple <b>n·p = n<sub>i</sub>² e<sup>V<sub>A</sub>/U<sub>T</sub></sup></b>.
            Con 0,6 V eso es un factor ~10¹⁰: la concentración de minoritarios en el borde sube muchísimo y decae exponencialmente hacia adentro.
            Los mayoritarios casi no cambian (siguen ≈ N<sub>A</sub> o N<sub>D</sub>): es <b>inyección de bajo nivel</b>.`,
        },
        {
          title: 'Quién lleva la corriente', focus: 'pn-cur', set: { Va: 0.6 },
          text: `La corriente total es la misma en todo x. Cerca de la juntura la llevan los <b>minoritarios por difusión</b>;
            a medida que se recombinan, la corriente pasa a los <b>mayoritarios por arrastre</b>, que llegan desde los contactos.
            El lado menos dopado aporta la mayor parte: la componente de electrones domina porque N<sub>A</sub> &lt; N<sub>D</sub>.`,
        },
        {
          title: 'Característica I–V', focus: 'pn-iv', set: { Va: 0.7, logI: true },
          text: `La corriente es <b>I = I<sub>S</sub>(e<sup>V<sub>A</sub>/U<sub>T</sub></sup> − 1)</b>: en escala log es una recta de
            <b>60 mV por década</b> a temperatura ambiente. En inversa la corriente satura en −I<sub>S</sub>, muchísimo más chica.`,
        },
        {
          title: 'Polarización inversa', focus: 'pn-xsec', set: { Va: -4 },
          text: `Con V<sub>A</sub> &lt; 0 la barrera crece, la zona de vaciamiento se ensancha (W ∝ √(V<sub>bi</sub> − V<sub>A</sub>)) y el campo máximo aumenta.
            Los mayoritarios ya no pueden cruzar. Sólo circula una corriente pequeña: pares electrón-hueco <b>generados térmicamente</b>
            (destellos blancos) que el campo separa por <b>arrastre</b>, más los minoritarios que llegan al borde por difusión.`,
        },
      ],
    },
    {
      tab: 'moscap', name: 'Capacitor MOS',
      reset: { Vg: 1.5, mode: 'lf', sub: 'p', logN: 17, tox: 10, gate: 'npoly', speed: 1 },
      steps: [
        {
          title: 'Banda plana', focus: 'mc-band', set: { Vg: -0.98 },
          text: `El capacitor MOS es compuerta / óxido / semiconductor, sin fuente ni drenador. Como la compuerta y el silicio tienen distinta función trabajo,
            aun con V<sub>G</sub> = 0 las bandas están curvadas. Hay un voltaje, la <b>tensión de banda plana V<sub>FB</sub> = Φ<sub>M</sub> − Φ<sub>S</sub></b>
            (≈ −0,98 V para poli n⁺ sobre p 10¹⁷), que deja las bandas planas y el semiconductor sin carga.`,
        },
        {
          title: 'Acumulación', focus: 'mc-xsec', set: { Vg: -3 },
          text: `Con V<sub>G</sub> &lt; V<sub>FB</sub> la compuerta queda negativa (signos − en la compuerta) y <b>atrae a los huecos mayoritarios</b> a la superficie,
            formando una capa muy delgada (del orden de la longitud de Debye, ~13 nm). Las bandas se curvan hacia arriba en la superficie.
            El campo en el óxido apunta hacia la compuerta. Los pocos electrones minoritarios que llegan a la superficie se recombinan.`,
        },
        {
          title: 'Vaciamiento', focus: 'mc-xsec', set: { Vg: 0 },
          text: `Con V<sub>G</sub> > V<sub>FB</sub> la compuerta se carga positiva y <b>repele a los huecos</b>: se retiran por arrastre (muy rápido, son mayoritarios)
            y dejan los aceptores ionizados (−) al descubierto. Esa carga Q<sub>B</sub> = −qN<sub>A</sub>W<sub>d</sub> equilibra la carga de la compuerta.
            Fijate en ρ(y), E(y) y ψ(y) abajo: es media juntura n⁺p, con el óxido en serie.`,
        },
        {
          title: 'Las bandas se curvan hacia abajo', focus: 'mc-band', set: { Vg: 0.2 },
          text: `El potencial de superficie ψ<sub>s</sub> crece y las bandas bajan en la superficie. E<sub>i</sub> se acerca a E<sub>F</sub>:
            hay cada vez menos huecos y cada vez más electrones en la superficie (mirá los puntitos).
            Cuando ψ<sub>s</sub> = φ<sub>F</sub>, E<sub>i</sub> cruza a E<sub>F</sub> y en la superficie n = p = n<sub>i</sub>: empieza la inversión débil.`,
        },
        {
          title: 'Inversión fuerte', focus: 'mc-xsec', set: { Vg: 2 },
          text: `Con ψ<sub>s</sub> ≈ 2φ<sub>F</sub> la concentración de electrones en la superficie iguala a N<sub>A</sub>: <b>inversión fuerte</b> (V<sub>G</sub> > V<sub>T</sub>).
            A partir de acá la capa de inversión crece exponencialmente con ψ<sub>s</sub>, así que ψ<sub>s</sub> y W<sub>d</sub> quedan prácticamente clavados
            (W<sub>d,máx</sub>): toda carga extra de la compuerta se compensa con más electrones en la capa de inversión.`,
        },
        {
          title: 'De dónde salen los minoritarios', focus: 'mc-xsec', pre: { Vg: -1 }, set: { Vg: 3 }, dur: 250, delay: 900,
          text: `No hay fuente que aporte electrones: tienen que <b>generarse térmicamente</b> en la zona de vaciamiento (o llegar por difusión desde el sustrato).
            Al subir V<sub>G</sub> de golpe, todavía no hay electrones, así que la carga se compensa ensanchando W<sub>d</sub> más allá del máximo:
            <b>vaciamiento profundo transitorio</b>. A medida que se generan pares, el campo arrastra los electrones a la superficie y los huecos al sustrato; la capa crece y W<sub>d</sub> vuelve.`,
        },
        {
          title: 'Curva C–V en baja frecuencia', focus: 'mc-cv', set: { mode: 'lf', Vg: 2 },
          text: `La capacidad es C<sub>ox</sub> en serie con la del semiconductor C<sub>s</sub> = dQ<sub>s</sub>/dψ<sub>s</sub>.
            En acumulación C<sub>s</sub> es enorme → C ≈ C<sub>ox</sub>. En vaciamiento C<sub>s</sub> = ε<sub>s</sub>/W<sub>d</sub> y C baja.
            En inversión, si la señal es lenta, la carga de inversión la sigue en la superficie y C <b>vuelve a C<sub>ox</sub></b>.`,
        },
        {
          title: 'Alta frecuencia', focus: 'mc-cv', set: { mode: 'hf', Vg: 2 },
          text: `Si la señal de medición es rápida, la generación térmica no alcanza a modificar la capa de inversión en cada ciclo.
            La carga sólo puede responder en el borde de W<sub>d,máx</sub> (mayoritarios), así que la curva queda plana en <b>C<sub>mín</sub></b>.`,
        },
        {
          title: 'Vaciamiento profundo', focus: 'mc-band', set: { mode: 'deep', Vg: 3.5 },
          text: `Si además el barrido de V<sub>G</sub> es más rápido que la generación, nunca se forma la capa de inversión: W<sub>d</sub> sigue creciendo
            y C sigue bajando. En el diagrama de bandas ya no hay un E<sub>Fn</sub> definido: el semiconductor está fuera de equilibrio.`,
        },
        {
          title: 'Efecto de los parámetros', focus: 'mc-cv', set: { mode: 'hf', Vg: 2, tox: 25, logN: 16, gate: 'ppoly' },
          text: `Con un <b>óxido más grueso</b> C<sub>ox</sub> baja y V<sub>T</sub> crece. Con <b>menos dopaje</b> W<sub>d,máx</sub> crece, por lo que C<sub>mín</sub>/C<sub>ox</sub> baja.
            Cambiar la compuerta a <b>poli p⁺</b> mueve V<sub>FB</sub> unos +1,1 V y desplaza toda la curva. Probá también sustrato tipo n: todo se espeja.`,
        },
      ],
    },
    {
      tab: 'mosfet', name: 'MOSFET',
      reset: { Vgs: 2.5, Vds: 1.5, Vsb: 0, WL: 10, lambda: 0.05, cut: 0.5, logT: false, speed: 1 },
      steps: [
        {
          title: 'Un capacitor MOS con fuente y drenador', focus: 'mos-xsec', set: { Vgs: 0, Vds: 0 },
          text: `El MOSFET es el capacitor MOS más dos regiones n⁺ (fuente y drenador) que pueden aportar y recibir electrones en forma inmediata.
            Con V<sub>GS</sub> = 0 la superficie está en vaciamiento (V<sub>GB</sub> = 0 > V<sub>FB</sub> = −0,62 V) pero no invertida:
            entre S y D hay dos junturas pn enfrentadas y <b>no circula corriente</b>.`,
        },
        {
          title: 'La barrera fuente–canal', focus: 'mos-bandl', set: { Vgs: 0, Vds: 1 },
          text: `En el corte lateral sobre la superficie se ve una <b>barrera de ~1 eV</b> entre la fuente y el canal: los electrones de la fuente no pueden entrar.
            La compuerta controla la altura de esa barrera a través del potencial de superficie. El drenador (a V<sub>DS</sub>) está más abajo en energía.`,
        },
        {
          title: 'Subumbral: difusión sobre la barrera', focus: 'mos-tr', set: { Vgs: 0.5, Vds: 1, logT: true },
          text: `Al subir V<sub>GS</sub> la barrera baja y algunos electrones la superan por emisión térmica: la corriente crece <b>exponencialmente</b>.
            Como casi no hay campo lateral en el canal, el transporte es por <b>difusión</b>. La pendiente es S = n·U<sub>T</sub>·ln10 ≈ 77 mV/década
            (n > 1 porque parte del voltaje de compuerta cae sobre la capacidad de vaciamiento).`,
        },
        {
          title: 'Inversión: se forma el canal', focus: 'mos-bandv', set: { Vgs: 2.5, Vds: 0, logT: false },
          text: `Con V<sub>GS</sub> > V<sub>T</sub> la superficie se invierte: el corte vertical bajo la compuerta es igual al del capacitor MOS en inversión fuerte.
            La diferencia es que los electrones del canal vienen de la fuente al instante, no por generación térmica.
            El canal une S y D: el transistor está listo para conducir.`,
        },
        {
          title: 'Triodo: resistencia controlada', focus: 'mos-xsec', set: { Vgs: 2.5, Vds: 0.3 },
          text: `Con V<sub>DS</sub> chico el canal es casi uniforme y los electrones se mueven por <b>arrastre</b> en el campo lateral:
            el transistor es una resistencia controlada por V<sub>GS</sub>, I<sub>D</sub> ≈ β(V<sub>GS</sub> − V<sub>T</sub>)V<sub>DS</sub>.`,
        },
        {
          title: 'Hacia la saturación: pinch-off', focus: 'mos-xsec', set: { Vds: 3 }, dur: 2500,
          text: `Al crecer V<sub>DS</sub>, el potencial del canal V(x) sube hacia el drenador y la carga de inversión Q<sub>i</sub> = C<sub>ox</sub>(V<sub>GS</sub> − V<sub>T</sub> − nV) disminuye:
            el canal se afina. Como la corriente es la misma en todo el canal (I = W·Q<sub>i</sub>·v), los electrones <b>aceleran</b> donde hay menos carga.
            Cuando V<sub>DS</sub> = V<sub>DS,sat</sub> la carga se anula en el drenador: <b>pinch-off</b>. Desde ahí, el campo de la zona de vaciamiento los arrastra al drenador.`,
        },
        {
          title: 'Bandas en saturación', focus: 'mos-bandl', set: { Vds: 3 },
          text: `En el corte lateral, E<sub>Fn</sub> cae suavemente a lo largo del canal y luego casi toda la caída restante ocurre en el tramo estrangulado cerca del drenador.
            La barrera fuente–canal sigue fijada por V<sub>GS</sub>: por eso la corriente depende de V<sub>GS</sub> y casi no de V<sub>DS</sub>.`,
        },
        {
          title: 'Característica de salida', focus: 'mos-out', pre: { Vds: 0 }, set: { Vds: 4.5, lambda: 0.12 }, dur: 3500,
          text: `Mirá cómo el punto recorre la curva: primero la zona <b>triodo</b> (casi lineal), luego cruza la parábola V<sub>DS</sub> = V<sub>DS,sat</sub> y entra en <b>saturación</b>.
            Allí I<sub>D</sub> sólo crece por la <b>modulación de largo de canal</b> (λ): el punto de pinch-off se acerca a la fuente y el canal efectivo se acorta.`,
        },
        {
          title: 'Efecto cuerpo', focus: 'mos-tr', set: { Vsb: 2, Vds: 1.5, lambda: 0.05 },
          text: `Si la fuente está por encima del sustrato (V<sub>SB</sub> > 0), la juntura canal–sustrato queda más polarizada en inversa y la zona de vaciamiento
            tiene más carga fija que compensar. Hace falta más V<sub>GS</sub> para invertir: <b>V<sub>T</sub> aumenta</b> y la curva de transferencia se corre a la derecha
            (la curva punteada es V<sub>SB</sub> = 0).`,
        },
      ],
    },
    {
      tab: 'bjt', name: 'BJT',
      reset: { Vbe: 0.7, Vce: 3, betaF: 100, VA: 50, view: '1d', speed: 1 },
      steps: [
        {
          title: 'Estructura y corte', focus: 'bjt-xsec', set: { Vbe: 0.3, Vce: 3 },
          text: `El NPN son dos junturas pn espalda con espalda: emisor–base y base–colector. El <b>emisor está muy dopado</b>, la <b>base es angosta</b>
            y el colector es poco dopado. Con ambas junturas en inversa (o casi sin polarizar), los portadores no cruzan: <b>corte</b>, sólo fugas.`,
        },
        {
          title: 'Activa directa: el efecto transistor', focus: 'bjt-xsec', set: { Vbe: 0.7, Vce: 3 },
          text: `Con BE en directa, el emisor <b>inyecta electrones en la base</b>, donde son minoritarios (contorno blanco). Como la base es mucho más angosta que la
            longitud de difusión, casi todos atraviesan la base por <b>difusión</b> sin recombinarse. Al llegar a la juntura BC (en inversa), su campo los
            <b>arrastra al colector</b>. Una juntura en directa controla la corriente que pasa por otra en inversa.`,
        },
        {
          title: 'Bandas: la cascada', focus: 'bjt-band', set: { Vbe: 0.7, Vce: 3 },
          text: `La barrera EB baja qV<sub>BE</sub> y los electrones del emisor la superan. En la base, E<sub>Fn</sub> cae (su concentración baja hacia el colector)
            y en la juntura BC encuentran una gran "cascada" de energía: cualquier electrón que llegue ahí cae al colector.
            Por eso la corriente de colector no depende de V<sub>CE</sub>: depende de cuántos electrones inyecta el emisor.`,
        },
        {
          title: 'Perfil de minoritarios en la base', focus: 'bjt-min', set: { Vbe: 0.7, Vce: 3 },
          text: `La concentración de electrones en la base es casi lineal: n(0) = n<sub>p0</sub>e<sup>V<sub>BE</sub>/U<sub>T</sub></sup> del lado del emisor y ≈ 0 del lado del colector.
            La corriente de colector es la <b>corriente de difusión</b> de ese gradiente: I<sub>C</sub> = qAD<sub>n</sub>n(0)/W<sub>B</sub> ∝ e<sup>V<sub>BE</sub>/U<sub>T</sub></sup>.`,
        },
        {
          title: 'Componentes de corriente', focus: 'bjt-cur', set: { Vbe: 0.7, Vce: 3 },
          text: `La corriente de base tiene dos partes: los <b>huecos que la base inyecta al emisor</b> (pocos, porque N<sub>E</sub> ≫ N<sub>B</sub>: eficiencia de emisor γ ≈ 1)
            y la <b>recombinación en la base</b> (poca, porque W<sub>B</sub> ≪ L<sub>n</sub>: factor de transporte α<sub>T</sub> ≈ 1).
            Por eso β = I<sub>C</sub>/I<sub>B</sub> es grande. Los destellos del corte son esas recombinaciones (exageradas ×5).`,
        },
        {
          title: 'Concentraciones en todo el dispositivo', focus: 'bjt-conc', set: { Vbe: 0.7, Vce: 3 },
          text: `En escala log se ven mayoritarios y minoritarios a la vez: los mayoritarios siguen al dopaje, los minoritarios suben muchísimo en los bordes de la
            juntura en directa (ley de la juntura) y caen a casi nada en la juntura BC en inversa, que vacía la base del lado del colector.`,
        },
        {
          title: 'Gráfico de Gummel', focus: 'bjt-gum', set: { Vbe: 0.65, Vce: 3 },
          text: `I<sub>C</sub> e I<sub>B</sub> son exponenciales en V<sub>BE</sub> con pendiente de 60 mV/década. La separación vertical constante entre ambas es β.
            Ésta es la forma más directa de medir β y la calidad del transistor.`,
        },
        {
          title: 'Efecto Early', focus: 'bjt-out', pre: { Vce: 1 }, set: { Vce: 10, VA: 20, Vbe: 0.7 }, dur: 3000,
          text: `Al crecer V<sub>CE</sub>, la zona de vaciamiento BC se mete en la base y la <b>base efectiva se angosta</b>. Con W<sub>B</sub> menor el gradiente de
            minoritarios es mayor y la corriente de colector crece: las curvas tienen pendiente y extrapoladas cortan el eje en −V<sub>A</sub> (tensión de Early).`,
        },
        {
          title: 'Saturación', focus: 'bjt-min', set: { Vbe: 0.75, Vce: 0.08, VA: 50 },
          text: `Con V<sub>CE</sub> muy chico la juntura BC también queda en directa y el colector <b>inyecta electrones en la base</b>. El perfil se levanta del lado del
            colector, el gradiente disminuye e I<sub>C</sub> cae por debajo de βI<sub>B</sub>. Además se acumula mucha carga en la base (y huecos en el colector),
            que hay que remover para apagar el transistor: por eso salir de saturación es lento.`,
        },
        {
          title: 'Activa inversa', focus: 'bjt-out', set: { Vbe: 0.2, Vce: -0.45 },
          text: `Si se intercambian los papeles (BC en directa, BE en inversa), el colector actúa de emisor e I<sub>C</sub> cambia de signo. Funciona, pero con β<sub>R</sub> muy chico:
            como el colector es poco dopado, la base le inyecta muchos huecos (mala eficiencia de "emisor"), y la geometría no está pensada para que el emisor
            recolecte los electrones.`,
        },
        {
          title: 'El transistor real: corte planar', focus: 'bjt-xsec', set: { view: 'planar', Vbe: 0.7, Vce: 3 },
          text: `En un circuito integrado el transistor es planar: el emisor n⁺ está difundido dentro de la base p, que a su vez está en el colector epitaxial n.
            La <b>capa enterrada n⁺</b> y el <b>sinker</b> llevan la corriente de colector hasta el contacto con baja resistencia, y el aislamiento p⁺ separa
            transistores vecinos. La física es la misma: inyección, difusión vertical en la base y arrastre en la juntura BC.`,
        },
      ],
    },
  ];

  let on = false, ch = 0, st = 0, panel, tweens = [], timer = null;

  // narración: audio/<tab>-<n>.mp3 generados con tools/gen_audio.mjs (piper)
  const pref = (k, d) => { try { const v = localStorage.getItem('tour-' + k); return v === null ? d : v === '1'; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem('tour-' + k, v ? '1' : '0'); } catch { /* sin storage */ } };
  let sound = pref('sound', true), auto = pref('auto', false), advTimer = null, manifest = null;
  const voice = new Audio();
  voice.preload = 'auto';
  fetch('audio/manifest.json').then(r => r.json()).then(m => { manifest = m; }).catch(() => { manifest = {}; });

  function stepId() { return `${CHAPTERS[ch].tab}-${st + 1}`; }
  function narrate() {
    clearTimeout(advTimer);
    voice.pause();
    if (!sound) return;
    const id = stepId(), h = manifest?.[id]?.hash;
    voice.src = `audio/${id}.mp3${h ? '?h=' + h : ''}`;
    voice.currentTime = 0;
    voice.play().catch(() => { /* bloqueado por el navegador o sin archivo */ });
  }
  voice.addEventListener('ended', () => {
    if (on && auto && !(ch === CHAPTERS.length - 1 && st === CHAPTERS[ch].steps.length - 1)) advTimer = setTimeout(next, 1200);
  });
  voice.addEventListener('timeupdate', () => {
    if (panel && voice.duration) panel.querySelector('.tour-abar i').style.width = (voice.currentTime / voice.duration * 100) + '%';
  });
  function setSound(v, quiet) {
    sound = v; save('sound', v);
    panel.querySelector('.tour-snd').classList.toggle('off', !v);
    panel.querySelector('.tour-snd').textContent = v ? '🔊' : '🔇';
    panel.querySelector('.tour-abar i').style.width = '0';
    if (quiet) return;
    if (v) narrate(); else { voice.pause(); clearTimeout(advTimer); }
  }

  function control(tab, key) { return document.querySelector(`#tab-${tab} [data-key="${key}"]`); }
  function setNow(tab, key, v) {
    const el = control(tab, key);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    el.dispatchEvent(new Event('input'));
  }
  function tweenTo(tab, vals, dur) {
    const now = performance.now();
    for (const [k, v] of Object.entries(vals)) {
      const el = control(tab, k);
      if (!el) continue;
      if (el.type === 'range' && typeof v === 'number') tweens.push({ tab, k, a: +el.value, b: v, t0: now, dur });
      else setNow(tab, k, v);
    }
  }
  function tick(t) {
    tweens = tweens.filter(tw => {
      const u = Math.min(1, (t - tw.t0) / tw.dur), e = u * u * (3 - 2 * u);
      setNow(tw.tab, tw.k, tw.a + (tw.b - tw.a) * e);
      return u < 1;
    });
    if (on) requestAnimationFrame(tick);
  }

  function apply() {
    const C = CHAPTERS[ch], S = C.steps[st];
    TS.showTab(C.tab);
    tweens = []; clearTimeout(timer);
    // estado acumulado de los pasos anteriores: cada paso es reproducible aunque se salte directo a él
    const base = { ...C.reset };
    for (let j = 0; j < st; j++) Object.assign(base, C.steps[j].set);
    for (const [k, v] of Object.entries(base)) setNow(C.tab, k, v);
    if (S.pre) for (const [k, v] of Object.entries(S.pre)) setNow(C.tab, k, v);
    const go = () => tweenTo(C.tab, S.set || {}, S.dur || 700);
    if (S.pre) timer = setTimeout(go, S.delay || 400); else go();
    document.querySelectorAll('.tour-focus').forEach(e => e.classList.remove('tour-focus'));
    const card = document.getElementById(S.focus)?.closest('.card');
    if (card) {
      card.classList.add('tour-focus');
      setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: innerWidth > 900 ? 'center' : 'start' }), 60);
    }
    render();
    panel.querySelector('.tour-abar i').style.width = '0';
    narrate();
  }

  function total() { return CHAPTERS.reduce((a, c) => a + c.steps.length, 0); }
  function globalIndex() { let n = 0; for (let i = 0; i < ch; i++) n += CHAPTERS[i].steps.length; return n + st; }

  function render() {
    const C = CHAPTERS[ch], S = C.steps[st];
    panel.querySelector('.tour-chapter').value = ch;
    panel.querySelector('.tour-count').textContent = `paso ${st + 1} de ${C.steps.length}`;
    panel.querySelector('.tour-title').textContent = S.title;
    panel.querySelector('.tour-text').innerHTML = S.text;
    panel.querySelector('.tour-bar i').style.width = ((globalIndex() + 1) / total() * 100) + '%';
    panel.querySelector('.tour-prev').disabled = ch === 0 && st === 0;
    const last = ch === CHAPTERS.length - 1 && st === C.steps.length - 1;
    const nextBtn = panel.querySelector('.tour-next');
    nextBtn.textContent = last ? 'Terminar' : st === C.steps.length - 1 ? `Siguiente tema: ${CHAPTERS[ch + 1].name} ▶` : 'Siguiente ▶';
    panel.querySelector('.tour-dots').innerHTML = C.steps.map((_, i) => `<b class="${i === st ? 'cur' : i < st ? 'done' : ''}" data-i="${i}"></b>`).join('');
  }

  function next() {
    const C = CHAPTERS[ch];
    if (st < C.steps.length - 1) { st++; apply(); }
    else if (ch < CHAPTERS.length - 1) { ch++; st = 0; apply(); }
    else stop();
  }
  function prev() {
    if (st > 0) { st--; apply(); }
    else if (ch > 0) { ch--; st = CHAPTERS[ch].steps.length - 1; apply(); }
  }

  function build() {
    panel = document.createElement('div');
    panel.className = 'tour-panel';
    panel.innerHTML = `
      <div class="tour-head">
        <span class="tour-badge">Modo explicación</span>
        <select class="tour-chapter">${CHAPTERS.map((c, i) => `<option value="${i}">${i + 1}. ${c.name}</option>`).join('')}</select>
        <span class="tour-count"></span>
        <button class="tour-close" title="Salir (Esc)">✕</button>
      </div>
      <div class="tour-bar"><i></i></div>
      <div class="tour-audio">
        <button class="tour-snd" title="Narración en voz alta (N)">🔊</button>
        <div class="tour-abar"><i></i></div>
        <label class="tour-auto" title="Pasar solo al siguiente paso cuando termina el audio"><input type="checkbox"> avance automático</label>
      </div>
      <h3 class="tour-title"></h3>
      <div class="tour-text"></div>
      <div class="tour-dots"></div>
      <div class="tour-nav">
        <button class="tour-prev">◀ Anterior</button>
        <button class="tour-replay" title="Repetir la animación de este paso">↻ Repetir</button>
        <button class="tour-next">Siguiente ▶</button>
      </div>
      <div class="tour-hint">← → para navegar · N silencia la voz · podés mover los controles libremente en cualquier paso</div>`;
    document.body.appendChild(panel);
    panel.querySelector('.tour-next').onclick = next;
    panel.querySelector('.tour-prev').onclick = prev;
    panel.querySelector('.tour-close').onclick = stop;
    panel.querySelector('.tour-replay').onclick = () => apply();
    panel.querySelector('.tour-snd').onclick = () => setSound(!sound);
    const autoBox = panel.querySelector('.tour-auto input');
    autoBox.checked = auto;
    autoBox.onchange = () => { auto = autoBox.checked; save('auto', auto); if (auto && voice.ended) next(); };
    setSound(sound, true);
    panel.querySelector('.tour-chapter').onchange = e => { ch = +e.target.value; st = 0; apply(); };
    panel.querySelector('.tour-dots').onclick = e => { const i = e.target.dataset.i; if (i !== undefined) { st = +i; apply(); } };
    document.addEventListener('keydown', e => {
      if (!on || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '') && document.activeElement.type !== 'range') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === 'Escape') stop();
      else if (e.key === 'n' || e.key === 'N') setSound(!sound);
    });
  }

  function start(tabId) {
    if (!panel) build();
    on = true;
    document.body.classList.add('touring');
    panel.style.display = '';
    const i = CHAPTERS.findIndex(c => c.tab === tabId);
    ch = i >= 0 ? i : 0; st = 0;
    apply();
    requestAnimationFrame(tick);
    document.getElementById('tour-btn').classList.add('active');
  }
  function stop() {
    on = false; tweens = []; clearTimeout(timer); clearTimeout(advTimer);
    voice.pause();
    if (panel) panel.style.display = 'none';
    document.body.classList.remove('touring');
    document.querySelectorAll('.tour-focus').forEach(e => e.classList.remove('tour-focus'));
    document.getElementById('tour-btn').classList.remove('active');
  }

  document.getElementById('tour-btn').addEventListener('click', () => (on ? stop() : start(location.hash.slice(1))));
  return { start, stop, CHAPTERS };
})();
