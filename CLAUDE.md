# SmartAudit efr · Instrucciones de construcción para Claude Code

> Este archivo es la fuente de verdad del proyecto. Guárdalo como `CLAUDE.md` en la raíz del repositorio.
> Versión 1.0 · 12 de noviembre de 2026 · Producto: Bumii · Cliente: Fundación Másfamilia.

---

## 0. Cómo debes trabajar (léelo primero)

1. **Se diseña todo, se construye por fases.** La arquitectura y el modelo de datos cubren las 4 fases de M1 y dejan previstos los módulos M2 y M3. **Solo implementas la fase que se te indique en el prompt.** No adelantes funcionalidades de fases posteriores; deja interfaces, tipos y `TODO(Fase N)` donde corresponda.
2. **Al terminar cada fase, te detienes.** Entregas: resumen de lo construido, cómo probarlo, resultado de los tests, decisiones tomadas por defecto y lista de pendientes. No empiezas la fase siguiente sin instrucción explícita.
3. **IA acotada.** La IA solo conversa dentro de cada pregunta (explica con textos aprobados, pide concretar o confirmar, **dos interacciones como máximo**, decisión 91) y clasifica respuestas. El orden de preguntas, las condiciones, los cálculos, los porcentajes y los permisos son **código determinista** y testeado.
4. **Privacidad desde el día 1.** Solo datos sintéticos en desarrollo. Nunca se captan nombres, documentos de identidad, salario, afiliación sindical, datos de salud ni motivos de baja.
5. **Configuración, no código.** Cuestionarios, tabla de mínimos, textos de correo y umbrales viven en la base de datos, versionados, y se cambian sin redesplegar.
6. **Si algo no está definido aquí**, elige la opción más simple coherente con este documento, déjala marcada como `DECISIÓN POR DEFECTO` en el resumen de la fase y sigue.
7. **Idioma del código:** identificadores, nombres de colecciones y comentarios técnicos en inglés. Textos de interfaz en archivos de traducción (es, en, pt, fr; el catalán se conserva oculto, ver 5.7). Términos de dominio en este documento se dan en español con su nombre técnico entre paréntesis.

---

## 1. Contexto del producto

SmartAudit efr es una plataforma web para realizar **entrevistas escritas conducidas por IA** a la plantilla de las empresas que se certifican con el modelo **efr (Empresa Familiarmente Responsable)** de la Fundación Másfamilia, y convertir las respuestas en las tablas y síntesis del informe de auditoría externa (plantilla ed6, secciones 7.1 a 7.3).

Hoy el auditor elige una muestra de personas, las entrevista en persona o por teléfono, tabula a mano en Excel y copia los resultados al informe. SmartAudit automatiza la entrevista, la codificación y la tabulación; el auditor conserva el control: elige la muestra, valida lo dudoso y aprueba el informe.

**Módulos del producto** (la arquitectura los prevé todos; ahora se construye solo M1):

| Módulo | Propósito | Quién gestiona la campaña | Estado |
|---|---|---|---|
| M1 · Auditoría | Entrevistas a la plantilla durante auditorías efr | Auditor | **En construcción (Fases 1–4)** |
| M2 · Eficacia | Evaluar medidas de conciliación (anexo 1000-16) | Empresa efr | Previsto, no construir |
| M3 · Diagnóstico | Voz del empleado y de la dirección (anexo 1000-12) | Fundación / consultor | Previsto, no construir |

**Marca:** «SmartAudit efr» con «powered by Bumii» visible en interfaz, correos e informes. Colores y logos en variables de tema.

**Volumen:** 1.000–5.000 entrevistas al año. No hace falta diseñar para alta concurrencia, pero sí separar API, worker y almacenamiento.

---

## 2. Stack y arquitectura

### 2.1 Stack (MEAN, TypeScript en todo)

| Capa | Tecnología |
|---|---|
| Base de datos | MongoDB (Docker, replica set de un nodo para poder usar transacciones) con Mongoose |
| API | Node.js LTS + Express, TypeScript, validación con Zod |
| Frontend | Angular (última versión estable), standalone components, signals, Angular Material, `@ngx-translate` o i18n nativo con carga en tiempo de ejecución |
| Tareas en segundo plano | Agenda (cola persistida en MongoDB), proceso `worker` separado |
| Correo | Nodemailer sobre SMTP de Google Workspace (bumii.ai), detrás de una interfaz `MailProvider` |
| IA | Interfaz `LlmProvider` intercambiable; proveedor real por variable de entorno |
| Documentos | `docx` (Word), `exceljs` (Excel), LibreOffice headless en el worker para convertir Word a PDF |
| Proxy y TLS | Caddy (HTTPS automático) |
| Tests | Vitest o Jest (unitarios e integración, con `mongodb-memory-server`), Playwright (e2e) |
| Infraestructura | VPS en la Unión Europea, Docker Compose, despliegue manual por script |

### 2.2 Estructura del monorepo

```
/apps
  /api        Express: rutas, controladores, servicios, middlewares de auth y permisos
  /worker     Agenda: envíos, recordatorios, cambios de estado programados, codificación IA, generación de informes
  /web        Angular: área interna (superadmins, coordinador, auditor) y área del participante
/packages
  /shared     Tipos, enums, esquemas Zod y TODA la lógica determinista (tabla de mínimos, días hábiles,
              condiciones del cuestionario, cálculo de porcentajes, validación de muestra). 100% testeado.
  /llm        Interfaz LlmProvider, adaptador mock determinista y adaptadores reales; prompts versionados
  /mail       Interfaz MailProvider, adaptador SMTP y plantillas de correo por idioma
/infra
  docker-compose.yml, docker-compose.dev.yml, Caddyfile, scripts/deploy.sh, scripts/backup.sh
/docs
  decisiones.md (registro de decisiones), datos-sinteticos.md, guia-auditor.md (Fase 4)
/seed
  Cuestionario M1 v1, tabla de mínimos v1, entidades de auditoría, usuarios y organizaciones sintéticas
```

Gestión con npm workspaces (o pnpm). Un `README.md` con arranque local en un solo comando: `docker compose -f infra/docker-compose.dev.yml up`.

### 2.3 Contenedores

`caddy` · `web` (Angular compilado, servido estático) · `api` · `worker` · `mongo` · en desarrollo además `mailpit` (bandeja de pruebas SMTP).

### 2.4 Entornos y dominios

| Entorno | Dominio |
|---|---|
| Local | `localhost` |
| Staging | `staging.efr.bumii.ai` |
| Producción | `efr.bumii.ai` |

Variables en `.env` (plantilla `.env.example` sin secretos). Secretos nunca en el repositorio.

### 2.5 Despliegue (manual)

Código en GitHub. Despliegue con `infra/scripts/deploy.sh <staging|prod>`: build de imágenes, copia al VPS por SSH, `docker compose up -d`, migraciones y verificación de salud (`/api/health`). Backups diarios con `mongodump` cifrado a almacenamiento en la UE (`infra/scripts/backup.sh` + cron) y un procedimiento de restauración documentado y probado en la Fase 4.

---

## 3. Roles y permisos

### 3.1 Roles

> Revisado el 17/11/2026 a propuesta de F+f (decisiones 56–63 en `docs/decisiones.md`): el antiguo `ORG_ADMIN` (administrador de la empresa) pasa a ser el **coordinador de auditorías de una entidad auditora**. La empresa auditada no tiene usuarios.

| Rol (código) | Quién | Ámbito |
|---|---|---|
| `SUPERADMIN_BUMII` | Equipo Bumii | Toda la plataforma |
| `SUPERADMIN_FUNDACION` | Fundación Másfamilia (F+f) | Toda la plataforma |
| `COORDINATOR` | Coordinador o planificador de auditorías efr de una **entidad de auditoría** (ICONTEC, AENOR, SGS…) | Las organizaciones que F+f le asigna |
| `AUDITOR` | Auditor de una entidad de auditoría | Las organizaciones que su coordinador le asigna |
| Participante | Persona de la muestra | Solo su entrevista, sin cuenta |

- **Entidades de auditoría = tabla maestra** gestionada por los superadmins (pueden añadir más). Lista inicial facilitada por F+f (18/11/2026, decisión 67): AENOR, APCER, AUDELCO, CMD, DNV, EDUQATIA, ICONTEC, LOT y SGS. El país de la entidad es opcional.
- **Organización = empresa efr auditada.** No tiene usuarios. Los superadmins la crean y la **asignan a una entidad de auditoría y a uno de sus coordinadores** (una entidad puede tener varios; un coordinador puede llevar varias organizaciones).
- Los superadmins crean las **entidades de auditoría** y sus coordinadores. El coordinador crea y desactiva los auditores de su entidad y **designa el auditor responsable** de cada organización; puede cambiarlo y puede asignarse a sí mismo (entonces actúa como auditor de esa organización).
- **Una cuenta por entidad de auditoría:** el mismo correo puede existir en varias entidades como usuarios distintos (índice único `email + auditEntityId`). Si un correo tiene varias cuentas, tras el enlace mágico el usuario elige a qué entidad entra.
- Los dos superadmins tienen los mismos permisos funcionales. Solo `SUPERADMIN_BUMII` accede a la configuración técnica (proveedor de IA, umbrales, purga de datos).

### 3.2 Matriz de permisos M1

| Acción | Superadmins | COORDINATOR | AUDITOR | Participante |
|---|---|---|---|---|
| Crear entidades de auditoría y sus coordinadores | ✅ | — | — | — |
| Crear organizaciones y asignarlas a entidad + coordinador | ✅ | — | — | — |
| Crear/desactivar auditores de la entidad | ✅ | ✅ (la suya) | — | — |
| Designar o cambiar el auditor de una organización | ✅ | ✅ (sus organizaciones) | — | — |
| Gestionar cuestionarios, tabla de mínimos, textos | ✅ | — | — | — |
| Crear y configurar campaña M1 | ✅ (ver todas) | solo como auditor asignado | ✅ (organizaciones asignadas) | — |
| Cargar y validar la muestra | — | solo como auditor | ✅ | — |
| Ver estado por persona (invitada, iniciada, completada) | ✅ | solo como auditor | ✅ | — |
| Ver avance agregado (% completadas frente al mínimo) | ✅ | ✅ (sus organizaciones) | ✅ | — |
| Ver respuestas individuales con demográficos (sin correo) | ✅ | solo como auditor | ✅ | — |
| Revisar respuestas dudosas | ✅ | solo como auditor | ✅ | — |
| Editar y aprobar la síntesis, exportar informe | ✅ | solo como auditor | ✅ | — |
| Responder la entrevista | — | — | — | ✅ (solo la suya) |

Reglas transversales: aislamiento estricto por **entidad de auditoría** y acceso por **asignación** (reglas deterministas en `packages/shared/src/access.ts`: `manage` para el auditor responsable, `aggregate` para el coordinador de la organización, `supervise` para superadmins), mínimo privilegio, y **registro en `auditLogs`** de cada acceso a respuestas individuales, exportación, cambio de configuración, asignación y acción administrativa.

- Al cambiar el auditor, las campañas abiertas pasan al nuevo auditor; no se puede dejar sin auditor una organización con campañas abiertas.
- Cada campaña pertenece a la entidad de auditoría que la hizo. Una organización solo cambia de entidad sin campañas abiertas, y las campañas anteriores se quedan con la entidad anterior.

### 3.3 Autenticación

- **Usuarios internos: enlace mágico por correo.** Token aleatorio de 32 bytes, guardado con hash, un solo uso, caduca a los 15 minutos. Sesión con JWT en cookie `httpOnly`, `Secure`, `SameSite=Lax`, de 8 horas, con renovación. Límite de peticiones por IP y por correo.
- **Participantes:** sin cuenta (ver 5.4).

---

## 4. Modelo de datos (MongoDB)

Todas las colecciones llevan `createdAt`, `updatedAt` y, si aplica, `organizationId` (y `auditEntityId`). Todo lo que es configuración tiene `version` y no se edita una versión publicada: se crea otra.

| Colección | Contenido clave |
|---|---|
| `auditEntities` | entidad de auditoría (certificadora): nombre, país, estado |
| `organizations` | nombre, país (`CO`, `ES`…), zona horaria IANA, idioma por defecto, estado, asignación (`auditEntityId`, `coordinatorId`, `auditorId`) e historial de asignaciones |
| `users` | email, rol, auditEntityId (nulo en superadmins), estado, idioma preferido. Índice único `(email, auditEntityId)` |
| `magicLinkTokens` | hash del token, userId(s), expiración, usado |
| `samplingTables` | versión, estado (`draft`/`published`), tramos `[{min, max, required, rangeMax?}]` |
| `questionnaires` | módulo, versión, estado, idiomas con estado de aprobación por idioma, preguntas (ver 5.2) |
| `campaigns` | módulo (`M1`/`M2`/`M3`), organizationId, auditEntityId (entidad que la hace), creada por, configuración M1 (con el auditor responsable) (ver 5.1), snapshot de cuestionario y tabla, idiomas disponibles, ventana, programación de recordatorios, mínimo exigido, estado e historial de estados |
| `participantContacts` | **colección separada**: campaignId, respondentId, email cifrado, `noEmail`, hash del token de invitación, hash del código de acceso, envíos y rebotes |
| `respondents` | campaignId, demográficos (sexo, tramo de edad, centro, tipo de puesto y opcionales), estado (`invited`, `started`, `completed`), `completedAt`. **Sin correo ni identificadores personales** |
| `interviews` | campaignId, respondentId, idioma, estado de la máquina de estados, mensajes, respuestas por pregunta (ver 5.5), versión de modelo y de prompt |
| `reports` | campaignId, versión, tablas calculadas, síntesis IA original, síntesis editada, aprobada por, archivos generados |
| `auditLogs` | actor, acción, recurso, fecha, IP |
| `settings` | umbrales (confianza mínima), proveedor de IA, retención (desactivada), remitente de correo |

Reglas:
- **El correo nunca se guarda junto a las respuestas.** El vínculo `participantContacts` ↔ `respondents` solo se usa para enviar invitaciones y recordatorios y para marcar el estado.
- **Emails cifrados a nivel de campo** (AES-256-GCM, clave en variable de entorno) más un hash para búsquedas y detección de duplicados.
- **Las respuestas se relacionan con los demográficos, nunca con la identidad.**
- Diseño genérico de módulos: `campaigns`, `questionnaires`, `respondents`, `interviews` y `reports` llevan `module`. Los datos específicos de cada módulo van en un subdocumento tipado (`m1Config`, y en el futuro `m2Config` con inventario de medidas y `m3Config` con recorridos empleado/dirección). Deja las interfaces de M2 y M3 declaradas y vacías.
- **Retención:** por defecto indefinida. Construye el job de purga configurable (borrar contactos X días tras el cierre, anonimizar respuestas tras Y años) **apagado** en `settings`.

---

## 5. Reglas de negocio de M1

### 5.1 Campaña M1 (en la interfaz: «auditoría»)

> Revisado el 18/11/2026 (cambio 2, decisiones 64–69): en la interfaz y en los textos para usuarios la campaña se llama **auditoría**; en el código, la API y la base de datos sigue siendo `campaign`.

Campos que diligencia el auditor:
- Entidad (organización, elegida entre las asignadas al auditor y fijada después). *(La «marca del certificado» se retiró: decisión 39.)*
- Norma: `1000-1` o `1000-2` (la v1 solo estas; la lista vive en configuración).
- Tipo de auditoría: `inicial` o `renovacion` (25/11/2026, grupo de cambios 3, decisión 85; `mantenimiento` ya no se ofrece y solo se conserva en auditorías antiguas).
- **Componente de Bienestar** (casilla): si se marca, se activan las preguntas P11 a P15 (decisión 86).
- Postula o mantiene excelencia: sí/no.
- Auditor responsable: el auditor asignado a la organización que crea la campaña. *(Los auditores colaboradores se retiraron: decisión 41.)*
- Nombre del mánager efr de la entidad (solo para referencia de codificación; la IA no lo menciona).
- **Fecha de comienzo de las entrevistas** (sustituye a la fecha de la visita): la ventana abre ese día (ver 5.4).
- **Máximo de entrevistas completadas**: por defecto, el mínimo de la tabla; el auditor puede subirlo, nunca por debajo del mínimo ni por encima de la población total. **No lo limita la muestra cargada** (se pueden añadir personas con la auditoría en curso; la ficha avisa si el máximo la supera; decisión 87). **Al alcanzarlo, la auditoría pasa de `en_curso` a `finalizada`** automáticamente (motivo `maximum_reached`) y los enlaces y códigos pendientes dejan de servir.
- Número total de personas en el alcance (cuenta ajena el día de la auditoría, sin subcontratas ni personal de ETT). **Es el único dato de la plantilla que se pide.**
- Idiomas disponibles para los participantes (por defecto: es, en, pt, fr, solo los aprobados; el catalán no se ofrece).

**Estados** (revisados el 25/11/2026, grupo de cambios 3, decisión 88):
`borrador` → `muestra_cargada` → `en_curso` → `finalizada` → `informe_generado`. **No hay activación manual, ni suspensión, ni cancelación:** al cargar la muestra la auditoría queda programada y se abre sola el día de comienzo (`en_curso`, salen las invitaciones); se cierra sola al terminar la ventana o al alcanzar el máximo. Hasta que abre se puede editar y reemplazar la muestra; en curso solo se pueden añadir personas. `envios_activos`, `suspendida` y `cancelada` solo existen en auditorías anteriores a este cambio. Cada transición se valida en código y se registra en el historial. Una campaña en curso congela la versión del cuestionario y de la tabla con la que se abrió.

### 5.2 Cuestionario oficial M1 v1

Fuente: hoja «Cuestionario Oficial M1» del Excel *SmartAudit_efr_M1_Plan_y_Preguntas (F+f) (2) 4 nov.xlsx*. Se carga como semilla en español; las versiones en inglés, portugués, francés (y catalán, oculto) se crean como borrador **pendiente de aprobación por la Fundación** y solo se ofrecen a participantes cuando están aprobadas.

Cada pregunta tiene: `code`, `block`, `order`, `text` por idioma, `type` (`single`, `multi`, `yes_no`, `free_text`), `options[]` con `code` interno estable y etiqueta por idioma, `activation` (expresión declarativa evaluada en código, nunca por la IA), `mandatory`, `allowAbstain` (por defecto sí), `maxClarifications` (por defecto 1), `reportMapping`.

| Código | Pregunta | Activación | Opciones (código interno) |
|---|---|---|---|
| P1 | ¿Conoce o ha oído hablar de la existencia del Modelo efr (Empresa Familiarmente Responsable) en la organización? | Siempre | `SI`, `NO`, `NS_NC` |
| P2 | ¿A través de qué medio de comunicación se enteró o recibe información sobre el Modelo efr? | Siempre | **Múltiple:** `INTRANET`, `MAIL`, `REUNIONES`, `BOCA_A_BOCA`, `OTROS` (+ texto «¿cuál?») |
| P3.1 | ¿Conoce quién es el Mánager efr de su entidad? | Siempre | `SI`, `NO`, `NS` |
| P3.2 | ¿Conoce o sabe que existe un canal de comunicación directo con la Fundación Másfamilia? | Siempre | `SI`, `NO`, `NS` |
| P3.3 | ¿Conoce el catálogo o las medidas de conciliación efr que ofrece su entidad? | Siempre | `SI`, `NO`, `NS` |
| P4 | ¿Cómo valora la conciliación en su entidad en comparación con lo que observa en otras empresas de su entorno? | Siempre | `POR_ENCIMA`, `EN_LA_MEDIA`, `POR_DEBAJO`, `NS_NC` |
| P5 | ¿Su superior directo/a apoya la conciliación y el uso de las medidas efr? | Siempre | `SIEMPRE`, `ALGUNAS_VECES`, `NUNCA` |
| P6 | ¿Cuál es la actitud de la empresa respecto a las personas que hacen uso activo de las medidas de conciliación? | Siempre | `POSITIVA`, `NEUTRA`, `NEGATIVA` |
| P7 | ¿Se excede la jornada laboral de manera reiterada? *(ayuda: «excede» = más del 10 % de la duración de la jornada; «reiterada» = más del 10 % de las jornadas)* | Siempre | `NUNCA`, `ALGUNAS_VECES`, `SIEMPRE` |
| P7.1 | En caso de realizar exceso de jornada, ¿se siente compensado/a por ese exceso en tiempo libre o económicamente? | Si P7 ∈ {`ALGUNAS_VECES`, `SIEMPRE`} | `SI_TIEMPO`, `SI_ECONOMICA`, `SI_AMBAS`, `NO` (+ texto libre opcional) |
| P8 | ¿En los últimos años se han mejorado las condiciones en materia de conciliación en su empresa? | Si tipo = `renovacion` | `GRAN_AVANCE`, `MODERADO`, `NULO`, `NS_NC` |
| P9 | ¿Cree que su empresa es excelente en conciliación? | Si postula a excelencia | `SI`, `NO` |
| P11 | ¿La salud y el bienestar de las personas son un valor importante en esta organización? | Si la auditoría incluye **Bienestar** | `EN_DESACUERDO`, `NI_DE_ACUERDO_NI_EN_DESACUERDO`, `DE_ACUERDO` |
| P12 | ¿Los líderes actúan de manera coherente con los valores de bienestar que promueve la organización? | Si incluye **Bienestar** | Ídem |
| P13 | ¿Siento que mi bienestar es importante para mi responsable directo? | Si incluye **Bienestar** | Ídem |
| P14 | ¿Qué acciones de la organización contribuyen más a tu bienestar en el trabajo? | Si incluye **Bienestar**, opcional | Texto libre disociado |
| P15 | ¿Qué podría hacer la organización para mejorar el bienestar de las personas? | Si incluye **Bienestar**, opcional | Texto libre disociado |
| P10 | Comentarios abiertos sobre la conciliación | Siempre, **opcional** | Texto libre |

P11–P15 (bloque «Bienestar», grupo de cambios 3, tabla facilitada por F+f el 25/11/2026) se hacen antes de P10. *«De acuerdo»* se ha añadido como tercera opción de P11–P13 porque la tabla recibida mostraba solo dos (pendiente de confirmar). En la Fase 3, P14 y P15 («texto libre disociado») se presentarán sin vínculo con los demográficos.

Todas las preguntas admiten además `ABSTENCION` («Prefiero no responder»), que cuenta como respondida.

**Entrevista completada** = todas las preguntas obligatorias activadas tienen respuesta codificada, abstención o estado `pending_review`. Se marca `completedAt`. Es la unidad que se usará para facturar (sin módulo de facturación en la v1, pero la consulta debe ser trivial).

### 5.3 Tabla de mínimos de entrevistas completadas (semilla v1)

Fuente: *Tablas entrevistas.xlsx*. El mínimo se exige sobre **entrevistas completadas**, no sobre el tamaño de la muestra.

| Personas en el alcance | Mínimo de completadas |
|---|---|
| 1–90 | 14 |
| 91–150 | 20 |
| 151–249 | 25 |
| 250–500 | 26 |
| 501–1.000 | 52 |
| 1.001–2.000 | 59 |
| 2.001–4.000 | 66 |
| 4.001–8.000 | 78 |
| 8.001–16.000 | 91 |
| Más de 16.000 | El auditor fija la cifra entre 91 y 143 (mínimo 91); se registra |

La campaña guarda la versión de la tabla, el tamaño declarado, el tramo y el mínimo aplicado.

### 5.4 Muestra, invitaciones y acceso

**Archivo de muestra** (Excel o CSV desde una plantilla descargable en la plataforma):

| Columna | Obligatoria | Valores |
|---|---|---|
| `correo` | Sí | Email válido o `SIN_CORREO` |
| `sexo` | Sí | `Mujer`, `Hombre`, `Otro`, `No indica` |
| `tramo_edad` | Sí | `<30`, `30-40`, `41-50`, `51-60`, `>60` |
| `centro_trabajo` | Sí | Texto (se normaliza; se muestra la lista de valores distintos al auditor) |
| `tipo_puesto` | Sí | Texto (ídem) |
| `tramo_antiguedad` | No | `<2`, `2-5`, `6-10`, `>10` |
| `area` | No | Texto |
| `turnos` | No | `Sí` / `No` |
| `teletrabajo` | No | `Sí` / `No` |
| `hijos_o_dependientes` | No | `Sí` / `No` |
| `rlpt` | No | `Sí` / `No` (representación legal de los trabajadores) |

Validación: errores por fila (correo inválido, duplicado, campo obligatorio vacío, valor fuera de categoría, columnas desconocidas). Si hay errores, no se carga nada y el auditor corrige y vuelve a subir. La plataforma rechaza columnas que parezcan datos prohibidos (nombre, DNI, cédula, salario, sindicato, salud). Mientras la campaña está en `borrador` o `muestra_cargada` el auditor puede reemplazar la muestra; con la campaña activa puede **añadir** personas.

**Política de mínimo:** se invita a toda la muestra cargada. La plataforma no bloquea; muestra el avance de completadas frente al mínimo y alerta si la muestra es menor que el mínimo o si a la mitad de la ventana la proyección no alcanza.

**Acceso de participantes:**
- **Con correo (canal principal):** enlace único `https://efr.bumii.ai/i/<token>` (32 bytes aleatorios, guardado con hash, revocable, caduca al cerrar la ventana, deja de servir para empezar de nuevo una vez completada).
- **Sin correo:** landing de campaña `https://efr.bumii.ai/c/<slugCampaña>` (también como QR) donde la persona introduce un **código aleatorio único** de 8 caracteres (alfabeto sin caracteres ambiguos). El auditor descarga la lista de códigos para entregarlos en papel. Límite de intentos por IP y bloqueo temporal.
- Antes de empezar, la persona ve un aviso breve (uso de IA, finalidad, confidencialidad, derecho a no responder, contacto) y elige idioma entre los disponibles.

**Remitente:** cuenta de bumii.ai vía SMTP de Google Workspace (configurar SPF, DKIM y DMARC). El nombre visible y el remitente están en `settings` para poder pasar después a un dominio de la Fundación. Limitar el envío en el worker para no superar el cupo diario de Workspace (unos 2.000 correos/día) y reintentar con backoff.

**Ventana y recordatorios:**
- Abre el **día de comienzo de las entrevistas** a las 9:00 y dura **10 días hábiles**: cierra a las 23:59 del 10.º día hábil. Si la fecha no es hábil, abre el siguiente día hábil (con aviso al auditor).
- Recordatorios automáticos en los días hábiles 4 y 8 de la ventana, solo a quien no ha completado.
- Correos a las 9:00 hora local de la organización.
- Días hábiles = lunes a viernes, en la zona horaria de la organización. **Los festivos no se tienen en cuenta** (13/11/2026, decisión 54: se retiraron `holidayCalendars` y su pantalla).
- El auditor puede ampliar la ventana; queda registrado.

### 5.5 Motor de entrevista (IA acotada)

> Revisado el 25/11/2026 a partir de los comentarios de F+f («entrevista conversada», decisiones 90–93): no se responde marcando opciones y la IA conversa hasta dos veces por pregunta. Los cuestionarios anteriores (con botones) siguen funcionando para las auditorías que los congelaron.

Máquina de estados en servidor (código en `packages/shared`), nunca decidida por la IA:
1. Determina la siguiente pregunta activa según el cuestionario congelado, las respuestas previas y la configuración de la campaña.
2. Muestra el **texto oficial** con una **frase aprobada que propone todas las respuestas posibles** (`answerHint`, p. ej. «¿Diría que siempre, algunas veces o nunca?»). La IA no la reformula. Solo hay un botón: «Prefiero no responder» (`answerMode: 'text'`; en los cuestionarios antiguos, `buttons`, la IA reformula y las opciones son botones con confianza 1).
3. La persona responde **siempre por escrito**. La IA devuelve una salida estructurada validada con Zod: `{ optionCodes[], confidence (0-1), status: classified | ambiguous | abstained | off_topic | question, supportingQuote }`, viendo la conversación de esa pregunta (sin identificadores).
4. Si queda alguna de las **2 interacciones** (`maxClarifications`), el código decide el motivo y la IA redacta la respuesta, reaccionando a lo que dijo la persona:
   - `question`, la persona pregunta qué significa algo: explica **solo con la explicación aprobada** de la pregunta (`explanation`) y vuelve a preguntar;
   - `confirm`, la confianza está entre 0,5 y el umbral (0,8 por defecto, en `settings`): propone su interpretación y la persona confirma o corrige;
   - `ambiguous`: recoge lo dicho y pide concretar;
   - `off_topic`: reconduce a la pregunta.
5. Sin interacciones restantes, lo que no queda clasificado con confianza suficiente se guarda como `pending_review`.
6. Toda repregunta pasa por una guarda determinista: nombra todas las opciones o ninguna (salvo la interpretación propuesta), no trae cifras ni enlaces que no estén en los textos aprobados y está completa; si no, se usa el texto por defecto aprobado.

Por cada respuesta se guarda: código de pregunta, texto original, códigos asignados, estado, confianza, cita de apoyo, aclaraciones usadas, modelo y versión del prompt, y revisión humana posterior.

Reglas duras:
- La IA nunca genera preguntas nuevas, nunca menciona medidas, nombres ni datos de la organización que la persona no haya aportado, y nunca infiere una respuesta que no existe.
- **Al proveedor de IA no se le envían correos, códigos ni ningún identificador.** Solo el texto de la pregunta, las opciones y la respuesta.
- Defensa frente a manipulación de instrucciones: el texto del participante va delimitado como dato; la salida siempre se valida contra el esquema; si no valida, se reintenta una vez y si no, `pending_review`.
- Pausa y reanudación: el mismo enlace o código retoma en la pregunta pendiente sin repetir ni perder respuestas.
- Cada entrevista está aislada: el contexto de la IA solo contiene esa entrevista.

**Interfaz `LlmProvider`** (`packages/llm`): `phraseQuestion()`, `classifyAnswer()`, `phraseClarification()`, `summarize()`, `anonymizeComment()`. Implementar un adaptador **mock determinista** para desarrollo y tests, y un adaptador real elegido por variable de entorno (el proveedor se decide al iniciar la Fase 2; debe garantizar que no retiene ni entrena con los datos y preferiblemente procesar en la UE). Prompts versionados como archivos en el repositorio.

### 5.6 Resultados e informe

**Cálculo determinista** (en `packages/shared`, nunca por la IA):
- Por pregunta: n de respuestas, abstenciones y porcentaje por opción. Los porcentajes se calculan **sobre las respuestas válidas** (sin abstenciones ni `pending_review` sin resolver); el informe muestra siempre n y el número de abstenciones.
- P2 (múltiple): porcentaje de personas que mencionan cada medio; la suma puede pasar de 100 %. Los textos de «Otros» se listan.
- P7.1: solo sobre quienes respondieron `ALGUNAS_VECES` o `SIEMPRE` en P7.
- P8: porcentajes sobre `GRAN_AVANCE`, `MODERADO` y `NULO`; `NS_NC` excluido de la base. La exclusión es configuración del cuestionario (`results.excludeFromBase`).
- Sección 7.1: número de entrevistas por modalidad (nueva modalidad «Entrevista escrita asistida por IA»), distribución por tramo de edad y sexo.
- El informe se genera siempre en español, aunque las entrevistas se hayan respondido en otros idiomas (los códigos internos son los mismos).

**Vista del auditor:** tablas agregadas, cola de respuestas dudosas y respuestas individuales ligadas a sus demográficos (nunca al correo). *(Construido en «cambios 4», bloques 1 y 2, decisiones 94–97: el auditor decide código, abstención o «sin respuesta válida»; las respuestas abiertas, incluida P10, se muestran aparte sin demográficos hasta que haya anonimización.)* Mostrar aviso de confidencialidad al abrir respuestas individuales y registrar cada acceso. Advertir cuando un grupo demográfico tenga menos de 3 personas, por riesgo de reidentificación.

**Listados:** las listas de organizaciones (superadmins, coordinador y auditor) y de auditorías se buscan, filtran, ordenan y paginan en el servidor (cientos de organizaciones, decenas por coordinador, miles de auditorías): búsqueda sin mayúsculas ni acentos, filtros por entidad de auditoría y estado, auditorías abiertas/cerradas o por estado, 25 filas por página.

**Vista del coordinador (COORDINATOR):** solo avance agregado (% de completadas frente al mínimo), sin desglose por persona ni respuestas.

**Síntesis IA:** la IA redacta la síntesis cualitativa (7.3) **a partir de las tablas ya calculadas y de los comentarios anonimizados**, marcada como «pendiente de contraste». El auditor la edita en la plataforma; se guardan el texto original de la IA, cada versión editada y la aprobación. Los porcentajes no son editables.

**Exportaciones:** Word (formato de la plantilla ed6, secciones 7.1 a 7.3), Excel (tabulación por persona con demográficos y códigos, más hojas de resultados) y PDF (convertido desde el Word). Todas con «powered by Bumii».

### 5.7 Internacionalización

Español, inglés, portugués (de Portugal) y francés en: interfaz interna, área del participante, correos, cuestionario y entrevista. **El catalán no se ofrece** (18/11/2026, decisión 66): no aparece en ningún selector ni se ofrece a participantes, pero se conservan sus traducciones y los textos del cuestionario por si se reactiva. La interfaz detecta el idioma del navegador y permite cambiarlo. El participante elige idioma al entrar entre los habilitados en la campaña y aprobados en el cuestionario. Ningún texto visible queda escrito directamente en el código.

### 5.8 Lo que nunca se capta ni se muestra

Nombre, documento de identidad, número de empleado, salario, afiliación sindical, datos de salud, motivos de baja. La empresa auditada no tiene acceso a la plataforma, y el coordinador nunca ve quién respondió ni qué respondió (salvo cuando actúa como auditor de esa organización).

---

## 6. Plan por fases

Ciclos semanales con demo los viernes. Cada fase termina con sus criterios de aceptación cumplidos y los tests en verde.

### Fase 1 · Base, configuración y muestra (semanas 1–2)

**Construir:**
1. Monorepo, Docker Compose de desarrollo (con Mailpit), Caddy, `.env.example`, README, script de despliegue manual y de backup.
2. `packages/shared` con tipos, enums, esquemas Zod y la lógica determinista de esta fase: tabla de mínimos, días hábiles y ventana, validación del archivo de muestra, evaluación de activación de preguntas.
3. Modelo de datos completo (todas las colecciones de la sección 4, aunque algunas se usen en fases posteriores), cifrado de correos, `auditLogs`.
4. Autenticación por enlace mágico (los correos van a Mailpit en desarrollo; `MailProvider` con adaptador SMTP ya implementado), selección de entidad de auditoría cuando un correo tiene varias cuentas, roles y middleware de permisos con aislamiento por entidad de auditoría y acceso por asignación.
5. Superadmins: gestión de entidades de auditoría y sus coordinadores, y de organizaciones (país, zona horaria, idioma) con su asignación a entidad y coordinador; gestión de configuración (cuestionarios con versiones e idiomas, tabla de mínimos; los festivos se retiraron en la decisión 54).
6. COORDINATOR: gestión de auditores de su entidad y designación del auditor responsable de cada organización asignada (puede ser él mismo).
7. Auditor: crear y editar campaña M1 (5.1), cálculo automático del mínimo, de la ventana y de las preguntas activadas; descarga de plantilla de muestra; carga y validación con errores por fila; listado de valores distintos de centro y tipo de puesto; generación de tokens de invitación y códigos de acceso; descarga de la lista de códigos para personas sin correo; paso a `muestra_cargada`.
8. Interfaz Angular con Material, tema de marca «SmartAudit efr · powered by Bumii», i18n (hoy es/en/pt/fr; el catalán se conserva oculto).
9. Semillas: cuestionario M1 v1 (es aprobado; el resto de idiomas en borrador), tabla de mínimos v1, entidades de auditoría reales (tabla maestra), organizaciones y usuarios sintéticos, archivos de muestra sintéticos válidos e inválidos.

**No construir todavía:** envíos de invitaciones, landing del participante, chat, recordatorios, IA, informes.

**Criterios de aceptación de la Fase 1:**
- `docker compose up` deja todo funcionando en local con datos semilla.
- Tests unitarios al 100 % de ramas en `packages/shared` (incluye fronteras de tramos: 90/91, 150/151, 249/250, 500/501, 16.000/16.001; ventanas que cruzan fines de semana, fin de año y cambio de hora en CO y ES).
- Tests de integración de permisos: ningún rol accede a recursos de otra entidad de auditoría ni a organizaciones que no tiene asignadas; el COORDINATOR (salvo como auditor asignado) no puede leer muestras ni respuestas.
- E2E (Playwright): superadmin crea la entidad de auditoría con su coordinador y una organización asignada a él → el coordinador crea un auditor y lo designa para la organización → el auditor entra por enlace mágico, crea campaña, sube una muestra con errores, la corrige y la campaña queda en `muestra_cargada` con el mínimo y la ventana correctos.
- Ningún correo en claro en la base de datos.

### Fase 2 · Invitaciones y motor conversacional (semanas 3–4)

**Construir:** envío de invitaciones (al abrir la ventana; desde el grupo de cambios 3 sin paso manual), enlace único y landing con código, aviso previo y selección de idioma, chat web adaptado a móvil (desde la entrevista conversada, solo texto libre + «Prefiero no responder»), máquina de estados de la entrevista, `LlmProvider` con adaptador mock y uno real, clasificación con confianza y hasta dos interacciones por pregunta (decisión 91), pausa y reanudación, recordatorios programados, transiciones automáticas de estado (`en_curso` al abrir la ventana, `finalizada` al cerrarla), panel de avance (auditor: estado por persona; coordinador: % agregado), alertas de mínimo, ampliación de ventana, suite de unas 40 personas sintéticas para pruebas (incluye perfiles evasivos, fuera de tema e intentos de manipular a la IA).

**Criterios de aceptación:** 0 preguntas inventadas o respuestas sugeridas en las 40 pruebas adversariales; la pregunta P7.1, P8 y P9 solo aparecen cuando corresponde; reanudar tras desconexión no repite ni pierde respuestas; entrevista completa en móvil; ningún identificador enviado al proveedor de IA (test que inspecciona las llamadas).

### Fase 3 · Codificación, revisión e informes (semanas 5–6)

**Construir:** cola de revisión de dudosas para el auditor, vista de respuestas individuales con demográficos y registro de accesos, cálculo determinista de resultados (5.6), anonimización de comentarios, síntesis IA con edición, versiones y aprobación, exportación a Word, Excel y PDF, estado `informe_generado`, panel técnico (tasa de finalización, repreguntas, pendientes, duración, coste estimado por entrevista).

**Criterios de aceptación:** porcentajes idénticos al cálculo de referencia en el 100 % de los casos; reproducir los Excel reales de auditoría inicial y de renovación y señalar sus errores de suma; respuestas enviadas a revisión manual ≤ 10 % sobre el set sintético; el Word respeta el formato de la plantilla ed6.

### Fase 4 · Piloto real y puesta en producción (semanas 7–8)

**Construir:** herramienta de comparación a doble ciego (importar codificaciones hechas por auditores y medir concordancia IA–auditor por pregunta), endurecimiento de seguridad (cabeceras, límites de peticiones, revisión de dependencias, pruebas de aislamiento entre organizaciones), prueba de carga básica, prueba de restauración de backup, monitorización y alertas, guía de una página para auditores, despliegue a producción en `efr.bumii.ai`.

**Criterios de aceptación:** concordancia IA–auditor ≥ 90 % por pregunta cerrada (o igual a la concordancia entre auditores si es menor); duración mediana ≤ 10 minutos; completadas/iniciadas ≥ 80 %; restauración de backup probada; ningún dato personal real usado antes de la firma del acuerdo de tratamiento de datos.

---

## 7. Calidad y convenciones

- TypeScript estricto en todo; ESLint y Prettier; commits convencionales.
- Toda regla de negocio en `packages/shared`, con tests unitarios obligatorios. Ninguna regla de negocio en componentes Angular ni en controladores.
- Validación de entrada con Zod en todas las rutas; errores de API con formato uniforme.
- Logs estructurados sin datos personales (nunca correos, códigos, tokens ni texto de respuestas en logs).
- Cabeceras de seguridad, CORS restringido, límites de peticiones en autenticación, landing y chat.
- Accesibilidad: objetivo WCAG 2.1 AA; navegación completa por teclado en el área del participante.
- Registro de decisiones en `docs/decisiones.md` (fecha, decisión, motivo, quién decidió).

---

## 8. Decisiones pendientes (no bloquean la Fase 1)

| # | Pendiente | Default mientras tanto |
|---|---|---|
| 1 | Proveedor de IA definitivo | **Decidido (20/11/2026): Google Gemini** (decisión 83). Mock en desarrollo y tests |
| 2 | Traducciones oficiales del cuestionario al inglés, portugués y francés | Borrador generado por Bumii, pendiente de aprobación de la Fundación |
| 3 | Plazo de conservación de datos (el RGPD exige plazos definidos) | Indefinido; purga configurable construida y apagada |
| 4 | Remitente con dominio de la Fundación | bumii.ai; configurable en `settings` |
| 5 | Validación de representatividad por demográficos de la plantilla | Fuera de la v1; el modelo permite añadir totales por grupo después |
| 6 | Preguntas de excelencia de las normas 1000-6 y 1000-7 | Solo P9 hasta que la Fundación envíe los textos |
| 7 | Si P8 se activa también en auditorías de mantenimiento | Resuelto: ya no hay auditorías de mantenimiento (decisión 85) |
| 8 | Normas 1000-5, 2000 y 3000 | Fuera de la v1; la lista de normas está en configuración |
| 9 | Facturación por entrevista completada | Fuera de la v1; `completedAt` permite la consulta |
| 10 | Acuerdo de tratamiento de datos (art. 28 RGPD) | Solo datos sintéticos hasta su firma |

---

## 9. Prompt de arranque para Claude Code (Fase 1)

```
Lee CLAUDE.md completo. Vamos a construir SOLO la Fase 1 (sección 6, «Fase 1 · Base,
configuración y muestra»). Antes de escribir código, preséntame en un mensaje corto:
(1) la estructura de carpetas que vas a crear, (2) el esquema de cada colección de MongoDB
y (3) el orden de trabajo en pasos. Espera mi confirmación. Después construye paso a paso,
con tests en verde al final de cada paso, y al terminar la fase detente y entrégame el
resumen indicado en la sección 0.
```
