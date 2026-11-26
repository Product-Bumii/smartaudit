# Cambios pendientes en la presentación y sus capturas

Lista numerada de los cambios de la plataforma que todavía no están en las capturas de `img/` ni en el texto de
[`README.md`](README.md). Se aplicarán todos juntos cuando se decida rehacer las capturas. Al aplicar uno, márcalo
como hecho; no se borra ni se renumera nada.

**Situación (19/11/2026):** las capturas se rehicieron con los cambios 1 y 2 (27 capturas nuevas; resumen en
[informe-cambios-1-y-2.md](informe-cambios-1-y-2.md)). Desde entonces se ha añadido el cambio 3 (Fase 2), aplicado el 20/11/2026 con 17 capturas en `img/fase2/` y la [presentación de la Fase 2](fase-2.md). Después se añadieron los cambios 4 (grupo de cambios 3 de F+f) y 5 (entrevista conversada): el 25/11/2026 se hicieron 20 capturas nuevas en `img/cambios3/` con su [informe](informe-cambios-3.md), con la IA real en el servidor de pruebas. Quedan por rehacer las capturas antiguas de la Fase 1 y la Fase 2 que muestran botones de opción, «lanzar» o los estados retirados.

| # | Fecha | Cambio | Estado |
|---|---|---|---|
| 1 | 18/11/2026 | Nuevos perfiles: entidades de auditoría, coordinador y auditor asignado (decisiones 56–63) | Hecho (19/11/2026) |
| 2 | 18/11/2026 | «Auditorías» en vez de «campañas», fecha de comienzo de las entrevistas, máximo de completadas, sin catalán, entidades reales y listados con búsqueda (decisiones 64–69) | Hecho (19/11/2026) |
| 3 | 19/11/2026 | Fase 2: lanzar la auditoría, avance y ampliación de ventana, enlace personal, entrevista en el chat (móvil), invitación y recordatorio por correo (decisiones 70–82) | Hecho (20/11/2026) |
| 4 | 25/11/2026 | Grupo de cambios 3 de F+f: tipos de auditoría inicial/renovación, componente de Bienestar (P11–P15), máximo sin tope por la muestra, sin lanzar/suspender/cancelar (decisiones 85–89) | Capturas nuevas hechas (25/11/2026, [informe-cambios-3.md](informe-cambios-3.md)); falta rehacer las antiguas de Fase 1 y Fase 2 |
| 5 | 25/11/2026 | Entrevista conversada: respuesta escrita, frase que propone las respuestas, hasta 2 interacciones, explicaciones aprobadas, opción P2 «No he recibido información» (decisiones 90–93) | Capturas nuevas hechas (25/11/2026, [informe-cambios-3.md](informe-cambios-3.md)); falta rehacer las antiguas de Fase 2 |

---

## 1 · Nuevos perfiles: entidades de auditoría, coordinador y auditor asignado

El administrador de la organización (`ORG_ADMIN`, `admin@andina.example`) ya no existe. Ahora hay entidades de
auditoría con coordinadores. Los coordinadores designan el auditor de cada organización.

**Script `e2e/presentation/screenshots.spec.ts`:** hoy no funciona. Hay que:
- cambiar `admin@andina.example` por un coordinador (`coordinacion@icontec.example`);
- elegir la cuenta por entidad (`account-ICONTEC`) en vez de por organización;
- añadir `organizationId` al crear la campaña por la API.

**Capturas que cambian:**

| Captura | Qué cambia |
|---|---|
| 03 · Elección de organización | Pasa a ser **elección de entidad de auditoría**: ICONTEC / AENOR |
| 04 · Superadmin: organizaciones | Columnas de entidad, coordinador y auditor. El alta pide entidad y coordinador, no un administrador |
| 05 · Ficha de organización | El bloque de administradores y auditores se sustituye por el de **asignación** (entidad, coordinador, auditor) |
| 09 · Auditores de la organización | Desaparece. La sustituyen las capturas nuevas del coordinador (ver abajo) |
| 10 · Campañas del auditor | Columna de organización |
| 11 · Nueva campaña | Campo **organización** (solo las asignadas al auditor) |
| 18 · Superadmin: todas las campañas | Columna de organización para todos; etiqueta «solo avance» donde corresponda |
| 19 · Multiidioma | Rehacer con la nueva navegación (Organizaciones, Campañas) |

**Capturas nuevas:**
- Superadmin: lista de **entidades de auditoría** con su número de coordinadores, auditores y organizaciones.
- Superadmin: **ficha de una entidad de auditoría**, con sus coordinadores y auditores.
- Coordinador: **mis organizaciones**, con el selector del auditor responsable (incluido él mismo).
- Coordinador: **auditores** de su entidad.
- Coordinador: ficha de una campaña con el aviso **«solo avance»**, sin muestra ni códigos.
- Auditor: **mis organizaciones**, con el botón «nueva campaña» en cada fila.

**Textos de `README.md` (presentación):**
- La sección «3. Administración de la organización (empresa efr)» pasa a ser **coordinación de la entidad de auditoría**.
- La empresa auditada **no tiene acceso** a la plataforma.
- Actualizar la frase de la tabla inicial «Gestión de organizaciones, administradores y auditores».
- Actualizar la explicación de la 03: ahora se elige la entidad, no la organización.

---

## 2 · Auditorías, comienzo de las entrevistas, máximo, idiomas, entidades reales y listados

**Textos:** en la interfaz, «campaña(s)» pasa a ser **«auditoría(s)»**: menú, títulos, botones («nueva auditoría»,
«cancelar auditoría»), mensajes y la propia presentación. «Fecha de la visita» pasa a ser **«comienzo de las
entrevistas»**.

**Script `e2e/presentation/screenshots.spec.ts`:** además de lo del cambio 1:
- `visitDate` → `interviewStartDate`; el campo del formulario es `cf-start-date` (antes `cf-visit-date`);
- la ventana ahora **abre** en esa fecha. Para la misma ventana de antes (25 nov – 8 dic), usar el 25/11/2026 en vez
  del 9/12/2026;
- el selector de idioma ya no tiene `ca`, y la entidad de la cuenta es `account-ICONTEC` / `account-AENOR`;
- las listas llevan búsqueda: hacer las capturas sin texto en el buscador o con una búsqueda que se vea a propósito.

**Capturas que cambian:**

| Captura | Qué cambia |
|---|---|
| 01–02 · Acceso | El selector de idioma muestra es · en · pt · fr (sin ca) |
| 03 · Elección de entidad | ICONTEC / AENOR (nombres reales de la tabla maestra) |
| 04 · Superadmin: organizaciones | Buscador, filtros por entidad y estado, columnas ordenables y paginador |
| 05 · Ficha de organización | El desplegable de entidad lista las 9 entidades reales |
| 10 · Auditorías del auditor | Título «Auditorías», buscador, filtro de estado (abiertas, cerradas o un estado), paginador; columna «comienzo de las entrevistas» |
| 11 · Nueva auditoría | Campo «comienzo de las entrevistas» con su explicación, campo **máximo de entrevistas completadas**, y el máximo en el panel de cálculo |
| 12 y 14 · Ficha de la auditoría | Nuevo indicador **máximo de completadas** y fecha de comienzo de las entrevistas |
| 18 · Superadmin: todas las auditorías | Igual que la 10, con muchas filas: buena captura para enseñar el buscador y el paginador |
| 19 · Multiidioma | Rehacer con los textos nuevos |

**Capturas nuevas (sugeridas):**
- Superadmin: **entidades de auditoría** con las 9 reales (sustituye o amplía la propuesta del cambio 1).
- Lista de organizaciones **filtrada** (por ejemplo, búsqueda «andina» o filtro por ICONTEC).
- Lista de auditorías con el filtro **«abiertas»**.
- Mensaje de error del máximo (por ejemplo, un máximo por debajo del mínimo).

**Textos de `README.md` (presentación):**
- Renombrar «campañas» a «auditorías» en todo el texto.
- Explicar la regla de la ventana (abre el día de comienzo y dura 10 días hábiles) y el cierre automático por máximo.
- Quitar el catalán de la lista de idiomas (quedan español, inglés, portugués y francés).
- Mencionar la búsqueda y la paginación en los listados.

---

## 3 · Fase 2: lanzamiento, avance y entrevista con IA

**Script `e2e/presentation/screenshots.spec.ts`:** lanzar una auditoría (botón `launch`), abrir la ventana con
`POST /api/dev/campaigns/:id/open-now`, sacar el enlace personal del buzón `GET /api/dev/outbox` y recorrer la
entrevista (área `chat-answer`, con el código de la pregunta en `data-question`). Varias personas sintéticas
respondiendo para que el avance tenga cifras.

**Capturas que cambian:**

| Captura | Qué cambia |
|---|---|
| 20 · Ficha con la muestra cargada | Botón **«lanzar auditoría»** |
| 22–24 · Participante | Ya se puede **empezar**: el botón está activo cuando la entrevista está abierta, y aparece «continuar la entrevista» al volver |
| 14 · Coordinador, solo avance | Ahora muestra la sección **avance** (agregado) |

**Capturas nuevas:**
- Ficha de la auditoría **en curso** con la sección **avance**: completadas frente al mínimo y al máximo, barra,
  alertas, **estado por persona** (fila del archivo) y **ampliar la ventana**.
- Correo de **invitación** y de **recordatorio** con la marca efr.
- Landing del **enlace personal** (`/i/<token>`): bienvenida, aviso previo, idioma y «empezar la entrevista».
- **Chat en el móvil**: pregunta con botones, respuesta múltiple (P2), respuesta con sus palabras, la **aclaración**
  (repregunta) y «Prefiero no responder».
- **Fin de la entrevista** («¡gracias por participar!»).
- Historial de estados con *Envíos activos* → *En curso* (automático) y, si se quiere, el cierre por **máximo**.

**Textos de la presentación:** explicar el ciclo (lanzar → invitaciones al abrir → recordatorios días 4 y 8 → cierre
por fecha o por máximo), la IA acotada y sus guardas, y la pausa y reanudación.

---

## 4 · Grupo de cambios 3: tipos de auditoría, Bienestar, máximo y sin activación

**Scripts:** `e2e/presentation/fase2.spec.ts` ya no lanza la auditoría; sus capturas 01 y 02 siguen con los nombres
antiguos (`01-lanzar-auditoria`, `02-auditoria-envios-activos`) y hay que renombrarlas, por ejemplo
`01-auditoria-programada` y `02-editar-auditoria-bienestar`. `screenshots.spec.ts` ya no cancela ni suspende auditorías
de demostración.

**Capturas que cambian:**

| Captura | Qué cambia |
|---|---|
| Fase 1 · 16 y 17 · Nueva auditoría | Tipo de auditoría solo «Inicial» o «Renovación»; casilla **«Incluye el componente de Bienestar (P11–P15)»**; P11–P15 en «preguntas activadas» |
| Fase 1 · 18 y 20 · Ficha de la auditoría | Sin menú «cambiar estado»; aviso **«Auditoría programada: se abrirá sola el…»** con la muestra cargada; fila «Componente de Bienestar» en los datos |
| Fase 1 · 21 y 25 · Listados | El filtro de estado ya no ofrece «Envíos activos», «Suspendida» ni «Cancelada» |
| Fase 2 · 01 y 02 | Ya no hay «lanzar auditoría» ni estado «Envíos activos»: sustituir por la auditoría programada y por la edición con Bienestar |
| Fase 2 · 15 · Ficha en curso | Sin «cambiar estado»; el historial pasa de «Muestra cargada» a «En curso» directamente |

**Capturas nuevas (sugeridas):** la entrevista en el móvil con P11 (escala de acuerdo) y P14 (texto libre); el aviso
de máximo superior a la muestra.

**Textos:** en `fase-2.md` y en `README.md` de la presentación, quitar «lanzar», «envíos activos», suspender y cancelar;
explicar que la auditoría queda programada al cargar la muestra; añadir el componente de Bienestar.

## 5 · Entrevista conversada (comentarios de F+f, 25/11/2026)

**Capturas que cambian:**

| Captura | Qué cambia |
|---|---|
| Fase 2 · chat en el móvil (todas las de la entrevista) | Sin botones de opción: la pregunta oficial lleva la frase que propone las respuestas («Puede responder que sí, que no o que no lo sabe»), aviso «Responde con tus palabras. Si algo no te queda claro, pregúntalo.», cuadro «Escribe tu respuesta» y solo el botón «Prefiero no responder» |
| Fase 2 · repregunta | Ahora reacciona: explicación aprobada cuando la persona pregunta («¿Qué es un mánager efr?»), propuesta de interpretación para confirmar («Entiendo que su respuesta sería «Sí». ¿Es así?») y hasta dos repreguntas |
| Fase 1 · cuestionarios (superadmin) | Cada pregunta cerrada muestra la frase de respuesta, la «Explicación para la IA» y la etiqueta «Conversación · hasta 2 repreguntas»; P2 tiene la opción «No he recibido información» |

**Capturas nuevas (sugeridas):** la conversación del ejemplo de F+f (P1 «¿Qué modelo es el efr?» → explicación →
respuesta) y una confirmación.

**Scripts:** `e2e/presentation/fase2.spec.ts` pulsa botones de opción (`chat-option-*`): hay que pasarlo a respuestas
escritas, como `e2e/phase2.spec.ts`.

**Textos:** en `fase-2.md`, sustituir «botones + texto libre» y «una aclaración como máximo» por la entrevista
conversada (decisiones 90–93).

## 6 · Cambios 4 (Fase 3), bloques 1 y 2: resultados y revisión (25/11/2026)

**Pantallas nuevas (capturas sugeridas):**

| Pantalla | Qué mostrar |
|---|---|
| Ficha de la auditoría | Nueva sección «Resultados y revisión» con los botones resultados, revisión de respuestas y respuestas individuales |
| Resultados | Aviso de respuestas pendientes; sección 7.1 (modalidad y tabla sexo × tramo de edad); tabla por pregunta con n, abstenciones y pendientes; P2 con los textos de «Otros»; P8 con «No sabe / No contesta» fuera de la base |
| Revisión de respuestas | Una respuesta pendiente con su conversación, la propuesta de la IA, la decisión (opciones, abstención, «sin respuesta válida») y la nota; filtro pendientes / revisadas / todas |
| Respuestas individuales | Aviso de confidencialidad antes de cargar; tabla con demográficos y respuestas (las decididas en la revisión, en negrita); aviso de grupos de menos de 3 personas; respuestas abiertas aparte |

**Textos:** informe de cambios 4 (por crear) explicando el cálculo (decisiones 94–97).

