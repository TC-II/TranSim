// Guiones hablados del modo explicación: lo que dice la voz en cada paso.
// No son el texto del panel leído: son la explicación "de pizarrón", sin símbolos.
// Clave: <pestaña>-<n° de paso>. Si cambia un paso en js/tour.js, actualizar acá y correr tools/gen_audio.mjs.
export const NARRATION = {
  // ───────────── Arrastre y difusión ─────────────
  'dd-1': `Antes de meternos con junturas, veamos cómo se mueven los portadores. Hay solo dos formas: arrastre y difusión.
    Primero, algo fundamental: a temperatura ambiente, los electrones nunca están quietos. Chocan contra la red y salen disparados en cualquier dirección, a unos diez millones de centímetros por segundo.
    Seguí el trazo blanco: es un solo electrón, zigzagueando sin rumbo.
    Si la concentración es pareja y no hay campo, cruzan tantos para un lado como para el otro. El flujo neto es cero, y no hay corriente.`,

  'dd-2': `Ahora aplicamos un campo eléctrico.
    El zigzag sigue, pero encima aparece una pequeña velocidad neta, proporcional al campo. Eso es el arrastre.
    Como el electrón tiene carga negativa, deriva en contra del campo. Fijate cómo el trazo se va corriendo hacia la izquierda, y el flujo neto deja de ser cero.
    La corriente de arrastre es proporcional a la concentración y al campo. Es, ni más ni menos, la ley de Ohm.`,

  'dd-3': `Sumemos los huecos.
    Los huecos tienen carga positiva, así que derivan a favor del campo, al revés que los electrones.
    Pero ojo con esto: como la carga también es opuesta, las dos corrientes de arrastre van en el mismo sentido, y se suman.
    Mirá el diagrama de bandas: el campo las inclina. Los electrones ruedan hacia abajo, y los huecos, que son como burbujas, flotan hacia arriba.`,

  'dd-4': `¿Qué tan fácil es arrastrar a un portador? Eso lo mide la movilidad.
    En el silicio, los electrones son casi tres veces más móviles que los huecos. Por eso los transistores de canal ene, y los bipolares ene pe ene, son más rápidos.
    Y si el campo es muy grande, la velocidad deja de crecer: satura, cerca de diez millones de centímetros por segundo.`,

  'dd-5': `Ahora apagamos el campo, y armamos un gradiente: el contacto de la izquierda mantiene muchos electrones, y el de la derecha, pocos.
    Nadie los empuja. Cada electrón sigue zigzagueando al azar, igual que antes.
    Pero como a la izquierda hay más, simplemente cruzan más hacia la derecha que al revés.
    Ese flujo neto, de donde hay más hacia donde hay menos, es la difusión. Es pura estadística.`,

  'dd-6': `El flujo de difusión es proporcional al gradiente: cuanto más empinado el perfil, más corriente.
    Y acá hay una sutileza. Electrones y huecos difunden en el mismo sentido, hacia donde hay menos. Pero como tienen carga opuesta, sus corrientes de difusión tienen signos contrarios.
    Mirá el gráfico: con el perfil lineal, la corriente de difusión es la misma en toda la barra.`,

  'dd-7': `Arrastre y difusión no son dos fenómenos independientes. Los dos salen del mismo movimiento térmico, y de los mismos choques.
    Por eso están atados por la relación de Einstein: el cociente entre la constante de difusión y la movilidad es igual a la tensión térmica, unos veintiséis milivolts.
    Un portador muy móvil también difunde rápido.`,

  'dd-8': `Último experimento, y el más importante.
    Tenemos un gradiente que empuja a los electrones hacia la derecha, y un campo que los arrastra hacia la izquierda.
    Si elegimos el campo justo, las dos corrientes se cancelan exactamente. Los electrones se siguen moviendo, pero el flujo neto es cero.
    En ese caso el perfil es exponencial, y el nivel de Fermi queda perfectamente plano.
    Esto es exactamente lo que pasa en una juntura pe ene en equilibrio. Vamos a verlo.`,

  // ───────────── Juntura PN ─────────────
  'pn-1': `Arranquemos por lo más básico: la juntura pe ene.
    Pegamos un pedazo de silicio tipo pe, lleno de huecos, con uno tipo ene, lleno de electrones.
    ¿Qué pasa en la unión? Hay muchísimos electrones de un lado y casi ninguno del otro, así que empiezan a difundir. Lo mismo los huecos, en sentido contrario.
    Pero fijate algo clave: cuando se van, dejan atrás los iones de las impurezas, que están fijos en la red y no se pueden mover.
    Esa franja de iones sin compensar es la zona de vaciamiento. Y esos iones crean un campo eléctrico que empuja a los portadores de vuelta.
    En equilibrio, la difusión y el arrastre se cancelan exactamente, y la corriente neta es cero.`,

  'pn-2': `Ahora miremos lo mismo en el diagrama de bandas.
    En equilibrio, el nivel de Fermi tiene que ser plano en todo el dispositivo. Si no lo fuera, habría corriente.
    Pero del lado ene el nivel de Fermi está cerca de la banda de conducción, y del lado pe cerca de la de valencia. ¿Cómo se concilia eso? Curvando las bandas.
    Esa curvatura es la barrera de potencial de contacto, unos setenta y seis centésimos de electronvoltio en este caso.
    Es el escalón que tiene que trepar un electrón del lado ene para pasar al lado pe. Los puntitos te muestran cuántos portadores hay en cada lugar.`,

  'pn-3': `Veamos la electrostática.
    Con la aproximación de vaciamiento, la carga es muy simple: un rectángulo negativo del lado pe, por los aceptores, y uno positivo del lado ene, por los donores.
    Si integrás la carga, obtenés el campo eléctrico, que tiene forma de triángulo, con el máximo justo en la unión.
    Y si integrás otra vez, tenés el potencial, que sube suavemente, en forma de parábola, hasta el potencial de contacto.
    Un detalle importante: la carga total tiene que ser cero, así que la zona de vaciamiento se mete mucho más en el lado menos dopado. Acá, el lado pe.`,

  'pn-4': `Ahora polarizamos en directa. Mirá qué pasa.
    La tensión aplicada le resta a la barrera, así que el escalón baja y la zona de vaciamiento se angosta.
    De golpe, muchísimos más portadores logran cruzar. Los electrones entran al lado pe, y los huecos al lado ene.
    Y ojo, porque del otro lado son minoritarios. Avanzan por difusión, y en el camino se van encontrando con mayoritarios y se recombinan. Esos son los destellos amarillos.
    Recorren, en promedio, una longitud de difusión antes de desaparecer.`,

  'pn-5': `Fuera del equilibrio ya no hay un único nivel de Fermi.
    Lo partimos en dos: un cuasi nivel para los electrones y otro para los huecos.
    Dentro de la zona de vaciamiento, los dos son prácticamente planos, y están separados exactamente por la tensión aplicada.
    Y a medida que te alejás de la unión, en las zonas neutras, se vuelven a juntar, porque el exceso de minoritarios se va recombinando.`,

  'pn-6': `Esta es la famosa ley de la juntura.
    En el borde de la zona de vaciamiento, el producto de electrones por huecos crece exponencialmente con la tensión aplicada.
    Con seis décimas de volt, eso es un factor de diez mil millones. Mirá el gráfico en escala logarítmica: los minoritarios en el borde se disparan, y después caen exponencialmente hacia adentro.
    Los mayoritarios, en cambio, casi ni se mueven. Eso es lo que llamamos inyección en bajo nivel.`,

  'pn-7': `¿Y quién lleva la corriente?
    La corriente total tiene que ser la misma en cualquier punto del diodo. Lo que cambia es quién la transporta.
    Cerca de la unión, la llevan los minoritarios, por difusión. Pero a medida que se recombinan, la posta pasa a los mayoritarios, que vienen desde los contactos por arrastre.
    Y fijate que la componente de electrones es la más grande: domina el lado menos dopado.`,

  'pn-8': `Esta es la curva corriente tensión del diodo.
    La corriente crece exponencialmente con la tensión, así que en escala logarítmica es una recta, con una pendiente de unos sesenta milivolts por década a temperatura ambiente.
    En inversa, la corriente satura en un valor chiquitísimo, la corriente de saturación. Es por eso que el diodo conduce en un solo sentido.`,

  'pn-9': `Por último, polarización inversa.
    Ahora la tensión se suma a la barrera, que crece. La zona de vaciamiento se ensancha, y el campo máximo aumenta.
    Los mayoritarios ya no pueden cruzar de ninguna manera.
    Lo único que circula es una corriente muy chica: pares electrón hueco que se generan térmicamente, esos destellos blancos, y que el campo separa. Más los pocos minoritarios que llegan al borde por difusión.`,

  // ───────────── Capacitor MOS ─────────────
  'moscap-1': `Pasemos al capacitor MOS: una compuerta, un óxido, y el semiconductor. Sin fuente ni drenador.
    Primera sorpresa: aunque la tensión de compuerta sea cero, las bandas ya están curvadas. ¿Por qué? Porque la compuerta y el silicio tienen distinta función trabajo.
    Hay una tensión especial, la tensión de banda plana, que compensa esa diferencia y deja las bandas planas, sin carga en el semiconductor.
    Para polisilicio ene más sobre este sustrato pe, da casi menos un volt.`,

  'moscap-2': `Empecemos con la compuerta bien negativa, por debajo de banda plana.
    La compuerta negativa atrae a los huecos, que son los mayoritarios, y los amontona en la superficie. Esto es acumulación.
    Es una capa finísima, del orden de la longitud de Debye, apenas unos nanómetros.
    En el diagrama, las bandas se curvan hacia arriba en la superficie. Y los pocos electrones que llegan ahí se recombinan enseguida.`,

  'moscap-3': `Ahora subimos la compuerta por encima de banda plana.
    La compuerta se carga positiva y empuja a los huecos lejos de la superficie. Se van rapidísimo, porque son mayoritarios.
    Lo que queda al descubierto son los aceptores ionizados, cargas negativas fijas. Eso es vaciamiento.
    Esa carga fija es la que equilibra la carga de la compuerta. Mirá los gráficos de abajo: carga, campo y potencial. Es exactamente media juntura ene más pe, con el óxido en serie.`,

  'moscap-4': `A medida que seguimos subiendo la compuerta, el potencial de superficie crece y las bandas bajan cada vez más en la superficie.
    El nivel intrínseco se va acercando al nivel de Fermi. Eso quiere decir que en la superficie hay cada vez menos huecos y cada vez más electrones. Fijate en los puntitos.
    Cuando el nivel intrínseco cruza al de Fermi, en la superficie hay igual cantidad de electrones que de huecos. Ahí arranca la inversión débil.`,

  'moscap-5': `Seguimos subiendo, y llegamos a inversión fuerte.
    Cuando el potencial de superficie llega a más o menos el doble del potencial de Fermi, la concentración de electrones en la superficie iguala al dopaje. La superficie se dio vuelta: ahora es tipo ene.
    Esa tensión de compuerta es la tensión umbral.
    Y a partir de acá pasa algo muy lindo: como la carga de inversión crece exponencialmente, el potencial de superficie y el ancho de vaciamiento quedan prácticamente clavados. Toda carga extra en la compuerta se compensa con más electrones en la capa de inversión.`,

  'moscap-6': `Pero pará. ¿De dónde salen esos electrones? Acá no hay fuente que los aporte.
    Tienen que generarse térmicamente en la zona de vaciamiento, o llegar por difusión desde el sustrato. Y eso es lento.
    Entonces, si subimos la compuerta de golpe, todavía no hay electrones. La única forma de compensar la carga es ensanchar el vaciamiento más allá del máximo. Eso es vaciamiento profundo, transitorio.
    Mirá cómo, de a poco, se generan pares: el campo lleva los electrones a la superficie y los huecos al sustrato. La capa de inversión crece, y el vaciamiento vuelve a su valor de equilibrio.`,

  'moscap-7': `Ahora la curva capacidad tensión, medida a baja frecuencia.
    La capacidad total es la del óxido en serie con la del semiconductor.
    En acumulación, la capacidad del semiconductor es enorme, así que manda la del óxido.
    En vaciamiento, el semiconductor se comporta como un capacitor con placas separadas por el ancho de vaciamiento, y la capacidad total baja.
    Y en inversión, si la señal es lenta, los electrones de la capa de inversión llegan a seguirla, y la capacidad vuelve a subir hasta la del óxido.`,

  'moscap-8': `¿Y si medimos a alta frecuencia?
    Ahora la señal es demasiado rápida. La generación térmica no llega a modificar la capa de inversión en cada ciclo.
    Lo único que puede responder es el borde de la zona de vaciamiento, con los mayoritarios. Y como ese ancho ya está en su máximo, la curva se queda plana, en la capacidad mínima.`,

  'moscap-9': `Y si además el barrido de la compuerta es más rápido que la generación, directamente nunca se forma la capa de inversión.
    El vaciamiento sigue creciendo, y la capacidad sigue bajando, por debajo del mínimo de equilibrio.
    En el diagrama de bandas, ya no hay un cuasi nivel de Fermi definido para los electrones. El semiconductor está fuera de equilibrio.`,

  'moscap-10': `Para cerrar, jugá con los parámetros.
    Con un óxido más grueso, la capacidad del óxido baja y la tensión umbral sube.
    Con menos dopaje, el vaciamiento máximo es más ancho, y la capacidad mínima cae todavía más.
    Si cambiás la compuerta a polisilicio pe más, la tensión de banda plana se corre más de un volt, y toda la curva se desplaza.
    Y probá con un sustrato tipo ene: todo se espeja.`,

  // ───────────── MOSFET ─────────────
  'mosfet-1': `Ahora sí, el MOSFET. Es el capacitor MOS que acabamos de ver, más dos regiones ene más: la fuente y el drenador.
    La gran diferencia es que la fuente puede aportar electrones al instante.
    Con la compuerta en cero, la superficie está vaciada, porque estamos por encima de banda plana, pero todavía no está invertida.
    Entre fuente y drenador hay dos junturas pe ene enfrentadas, así que no circula corriente.`,

  'mosfet-2': `Miremos el corte lateral, a lo largo de la superficie.
    Entre la fuente y el canal hay una barrera de alrededor de un electronvoltio. Los electrones de la fuente no pueden entrar.
    Y acá está la idea central del MOSFET: la compuerta controla la altura de esa barrera, a través del potencial de superficie.
    El drenador, polarizado positivo, está más abajo en energía, esperando.`,

  'mosfet-3': `Subimos un poco la compuerta, todavía por debajo del umbral.
    La barrera baja, y algunos electrones con suficiente energía térmica la superan. Como la cantidad que pasa depende exponencialmente de la altura de la barrera, la corriente crece exponencialmente.
    Fijate que en el canal casi no hay campo lateral, así que el transporte es por difusión, igual que en un diodo.
    La pendiente es de unos setenta y siete milivolts por década, un poco peor que el ideal de sesenta, porque parte de la tensión de compuerta se pierde en la capacidad de vaciamiento.`,

  'mosfet-4': `Ahora pasamos el umbral, y la superficie se invierte.
    El corte vertical bajo la compuerta es exactamente el mismo que el del capacitor MOS en inversión fuerte.
    La diferencia es que acá los electrones del canal no tienen que esperar a la generación térmica: vienen de la fuente, al instante.
    El canal une fuente y drenador. El transistor está listo para conducir.`,

  'mosfet-5': `Con una tensión de drenador chica, el canal es casi uniforme.
    Los electrones se mueven por arrastre, empujados por el campo lateral. Es decir, el transistor se comporta como una resistencia, cuyo valor controla la compuerta.
    Esta es la zona de triodo, o zona lineal.`,

  'mosfet-6': `Subamos la tensión de drenador.
    El potencial del canal sube a medida que nos acercamos al drenador, y entonces la tensión efectiva entre compuerta y canal es menor ahí. La carga de inversión disminuye: el canal se afina.
    Pero la corriente tiene que ser la misma en todo el canal. ¿Cómo se arregla? Los electrones aceleran donde hay menos carga.
    Cuando la carga se anula del lado del drenador, llegamos al estrangulamiento, el famoso pinch off. A partir de ahí, el campo de la zona de vaciamiento arrastra los electrones al drenador.`,

  'mosfet-7': `En el diagrama de bandas lateral se ve muy claro.
    El cuasi nivel de Fermi de los electrones cae suavemente a lo largo del canal, y casi toda la caída restante se concentra en el tramo estrangulado, cerca del drenador.
    Pero la barrera entre fuente y canal sigue fijada por la compuerta. Por eso, en saturación, la corriente depende de la compuerta y casi nada del drenador.`,

  'mosfet-8': `Seguí el punto en la característica de salida.
    Primero recorre la zona de triodo, casi lineal. Después cruza la parábola que marca la tensión de saturación, y entra en saturación.
    Ahí la corriente crece apenas, por la modulación del largo de canal: el punto de estrangulamiento se acerca a la fuente, y el canal efectivo se acorta un poquito.`,

  'mosfet-9': `Último efecto: el efecto cuerpo.
    Si la fuente queda por encima del sustrato, la juntura entre canal y sustrato está más polarizada en inversa, y la zona de vaciamiento tiene más carga fija.
    Entonces hace falta más tensión de compuerta para invertir la superficie. La tensión umbral aumenta, y la curva de transferencia se corre a la derecha. La línea punteada es la referencia, sin efecto cuerpo.`,

  // ───────────── BJT ─────────────
  'bjt-1': `Terminamos con el transistor bipolar, un ene pe ene.
    Son dos junturas pe ene pegadas espalda con espalda: emisor base, y base colector.
    El emisor está muy dopado, la base es angosta, y el colector es poco dopado. Ya vas a ver por qué.
    Con las dos junturas en inversa, o casi sin polarizar, nadie cruza. Estamos en corte: solo hay fugas.`,

  'bjt-2': `Ahora sí, el efecto transistor. Polarizamos la juntura base emisor en directa.
    El emisor inyecta electrones en la base, donde son minoritarios. Son los que tienen contorno blanco.
    Como la base es mucho más angosta que la longitud de difusión, casi todos la atraviesan sin llegar a recombinarse.
    Y cuando llegan a la juntura base colector, que está en inversa, el campo los arrastra al colector.
    Fijate lo que pasó: una juntura en directa está controlando la corriente que pasa por otra en inversa. Esa es toda la magia.`,

  'bjt-3': `En el diagrama de bandas, esto es una cascada.
    La tensión base emisor baja la barrera, y los electrones del emisor la superan.
    En la base, su concentración va bajando hacia el colector. Y en la juntura base colector se encuentran con un salto enorme de energía: cualquier electrón que llegue ahí cae al colector.
    Por eso la corriente de colector casi no depende de la tensión colector emisor. Depende de cuántos electrones inyecta el emisor.`,

  'bjt-4': `Miremos el perfil de minoritarios en la base.
    Es casi una recta. Del lado del emisor, la concentración está fijada por la ley de la juntura, y crece exponencialmente con la tensión base emisor. Del lado del colector, es prácticamente cero.
    La corriente de colector es simplemente la corriente de difusión de ese gradiente. Por eso también es exponencial con la tensión base emisor.`,

  'bjt-5': `¿Y la corriente de base? Tiene dos partes.
    Por un lado, los huecos que la base inyecta en el emisor. Son pocos, porque el emisor está mucho más dopado que la base. Eso es la eficiencia de emisor, casi uno.
    Por otro lado, la recombinación en la base. También es poca, porque la base es mucho más angosta que la longitud de difusión. Es el factor de transporte, también casi uno.
    Como la corriente de base es tan chica comparada con la de colector, la ganancia beta es grande. Los destellos que ves son esas recombinaciones, exageradas para que se noten.`,

  'bjt-6': `En escala logarítmica podemos ver todo junto, mayoritarios y minoritarios.
    Los mayoritarios siguen al dopaje de cada región.
    Los minoritarios se disparan en los bordes de la juntura en directa, por la ley de la juntura. Y caen a casi nada en la juntura base colector, que está en inversa y vacía la base de ese lado.`,

  'bjt-7': `Este es el gráfico de Gummel.
    Las corrientes de colector y de base, en escala logarítmica contra la tensión base emisor. Las dos son rectas, con la misma pendiente de sesenta milivolts por década.
    La separación vertical entre ambas es justamente la ganancia beta. Es la forma más directa de medir la calidad de un transistor.`,

  'bjt-8': `Ahora el efecto Early.
    Al aumentar la tensión colector emisor, la zona de vaciamiento base colector se mete en la base, y la base efectiva se angosta.
    Con una base más angosta, el gradiente de minoritarios es mayor, y la corriente de colector crece un poco.
    Por eso las curvas de salida tienen pendiente. Si las extrapolás hacia atrás, todas cortan el eje en el mismo punto: la tensión de Early.`,

  'bjt-9': `¿Qué pasa si la tensión colector emisor es muy chica?
    La juntura base colector también queda en directa, y ahora el colector inyecta electrones en la base.
    El perfil se levanta del lado del colector, el gradiente disminuye, y la corriente de colector cae por debajo de beta por la corriente de base. Estamos en saturación.
    Además, se acumula muchísima carga en la base. Esa carga hay que sacarla para apagar el transistor, y por eso salir de saturación es lento.`,

  'bjt-10': `¿Y si damos vuelta los papeles? Base colector en directa, base emisor en inversa.
    El colector pasa a actuar como emisor, y la corriente cambia de signo. Funciona, pero con una ganancia muy chica.
    ¿Por qué? Porque el colector es poco dopado, y la base le inyecta muchos huecos: es un muy mal emisor. Y además la geometría no está pensada para que el emisor recolecte los electrones.`,

  'bjt-11': `Para terminar, así se ve un bipolar real en un circuito integrado. Es planar.
    El emisor ene más está difundido dentro de la base pe, que a su vez está dentro del colector epitaxial ene.
    La capa enterrada y el sinker llevan la corriente de colector hasta el contacto con poca resistencia, y el aislamiento pe más separa transistores vecinos.
    Pero la física es exactamente la misma que vimos: inyección, difusión a través de la base, y arrastre en la juntura base colector.`,
};
