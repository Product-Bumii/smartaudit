# Cambios pendientes en la presentación y sus capturas

Lista numerada de los cambios de la plataforma que todavía no están en las capturas de `img/` ni en el texto de
[`README.md`](README.md). Se aplicarán todos juntos cuando se decida rehacer las capturas. Al aplicar uno, márcalo
como hecho; no se borra ni se renumera nada.

| # | Fecha | Cambio | Estado |
|---|---|---|---|
| 1 | 18/11/2026 | Nuevos perfiles: entidades de auditoría, coordinador y auditor asignado (decisiones 56–63) | Pendiente |

---

## 1 · Nuevos perfiles: entidades de auditoría, coordinador y auditor asignado

El administrador de la organización (`ORG_ADMIN`, `admin@andina.example`) ya no existe. Ahora hay entidades de
auditoría con coordinadores. Los coordinadores designan el auditor de cada organización.

**Script `e2e/presentation/screenshots.spec.ts`:** hoy no funciona. Hay que:
- cambiar `admin@andina.example` por un coordinador (`coordinacion@certandes.example`);
- elegir la cuenta por entidad (`account-Certificadora Andes (sintética)`) en vez de por organización;
- añadir `organizationId` al crear la campaña por la API.

**Capturas que cambian:**

| Captura | Qué cambia |
|---|---|
| 03 · Elección de organización | Pasa a ser **elección de entidad de auditoría**: Certificadora Andes / Certificadora Ibérica |
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
