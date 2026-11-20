# Cambios pendientes en la presentación y sus capturas

Lista numerada de los cambios de la plataforma que todavía no están en las capturas de `img/` ni en el texto de
[`README.md`](README.md). Se aplicarán todos juntos cuando se decida rehacer las capturas. Al aplicar uno, márcalo
como hecho; no se borra ni se renumera nada.

**Situación (19/11/2026):** las capturas se rehicieron con los cambios 1 y 2 (27 capturas nuevas; resumen en
[informe-cambios-1-y-2.md](informe-cambios-1-y-2.md)). Desde entonces se ha añadido el cambio 3 (Fase 2).

| # | Fecha | Cambio | Estado |
|---|---|---|---|
| 1 | 18/11/2026 | Nuevos perfiles: entidades de auditoría, coordinador y auditor asignado (decisiones 56–63) | Hecho (19/11/2026) |
| 2 | 18/11/2026 | «Auditorías» en vez de «campañas», fecha de comienzo de las entrevistas, máximo de completadas, sin catalán, entidades reales y listados con búsqueda (decisiones 64–69) | Hecho (19/11/2026) |
| 3 | 19/11/2026 | Fase 2: lanzar la auditoría, avance y ampliación de ventana, enlace personal, entrevista en el chat (móvil), invitación y recordatorio por correo (decisiones 70–82) | Pendiente |

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

