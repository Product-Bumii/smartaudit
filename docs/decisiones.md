# Registro de decisiones

Formato: fecha · decisión · motivo · quién decidió. «DECISIÓN POR DEFECTO» = tomada por Claude Code al no estar
definida en CLAUDE.md (regla 0.6); pendiente de validación por el equipo.

## Fase 1 · 12/11/2026

| # | Decisión | Motivo | Quién |
|---|---|---|---|
| 1 | **Angular 21** (no 22) y **TypeScript 5.9** en todo el monorepo | Angular 22 no admite Node 25 (entorno local); la subida a 22 es un `ng update` | DECISIÓN POR DEFECTO |
| 2 | Mongoose 8, Agenda 5, Nodemailer 7, express 5, zod 4 | Versiones estables con API conocida | DECISIÓN POR DEFECTO |
| 3 | Imágenes Docker con **Node 24 LTS**; API y worker empaquetados con esbuild en un único `.cjs` | Imágenes pequeñas, sin `node_modules` en runtime | DECISIÓN POR DEFECTO |
| 4 | Los correos de **usuarios internos** también se cifran (AES-256-GCM + HMAC) | Criterio «ningún correo en claro en la base de datos» | DECISIÓN POR DEFECTO |
| 5 | Estado de persona `pending` (cargada, aún no invitada) antes de `invited` | La Fase 1 genera la muestra sin enviar invitaciones | DECISIÓN POR DEFECTO |
| 6 | Tokens de invitación y códigos de acceso: **hash** (búsqueda) + **copia cifrada** | El worker necesita construir el enlace en Fase 2 y el auditor puede volver a descargar la lista de códigos | DECISIÓN POR DEFECTO |
| 7 | Token solo para personas con correo; código de 8 caracteres solo para `SIN_CORREO`; códigos únicos por campaña | Cada canal usa su credencial | DECISIÓN POR DEFECTO |
| 8 | La lista de códigos incluye la **fila del archivo**, el centro y el tipo de puesto; la fila vive en `participantContacts`, nunca en `respondents` | El auditor reparte los papeles cruzando con su propia lista, sin nombres en la plataforma | DECISIÓN POR DEFECTO |
| 9 | Un AUDITOR solo ve las campañas donde es **líder o colaborador** | Mínimo privilegio | DECISIÓN POR DEFECTO |
| 10 | Recursos de otra organización responden **404** (no 403) | No revelar su existencia | DECISIÓN POR DEFECTO |
| 11 | Suspender/cancelar desde `borrador`, `muestra_cargada`, `envios_activos`, `en_curso`; reanudar solo al estado previo | «Estado activo» no estaba definido | DECISIÓN POR DEFECTO |
| 12 | Ventana: abre a las **09:00** locales del día hábil 1 (hora de envío); cierra a las 23:59:59.999 del día hábil anterior a la visita; recordatorios los días hábiles 4 y 8 a las 09:00 | Interpretación de 5.4 | DECISIÓN POR DEFECTO |
| 13 | Sin calendario publicado para un país/año se usa la lista oficial de `date-holidays` y se registra como `date-holidays-fallback` en la campaña | No bloquear campañas de años sin calendario cargado | DECISIÓN POR DEFECTO |
| 14 | La campaña guarda una **instantánea** de cuestionario, tabla y festivos al crearse y la refresca en cada edición mientras está en `borrador`/`muestra_cargada`; después queda congelada | 5.1 «una campaña activa congela la versión» | DECISIÓN POR DEFECTO |
| 15 | Con más de 16.000 personas el auditor **debe** fijar la cifra (91–143) para guardar la campaña | Evitar campañas sin mínimo | DECISIÓN POR DEFECTO |
| 16 | Configuración versionada: estados `draft`/`published`, **un solo borrador** a la vez; la vigente es la última publicada | Simplicidad | DECISIÓN POR DEFECTO |
| 17 | Aprobar un idioma es metadato y se permite en una versión publicada; cambiar los textos de un idioma en un borrador **anula su aprobación** | La Fundación aprueba traducciones sin forzar nuevas versiones | DECISIÓN POR DEFECTO |
| 18 | Edición de la estructura del cuestionario en la UI mediante **JSON validado** en servidor | Un editor visual completo excede la Fase 1 | DECISIÓN POR DEFECTO |
| 19 | P7.1: el «texto libre opcional» se modela como comentario opcional en cada opción; P10 con 0 aclaraciones | Representación en el esquema de preguntas | DECISIÓN POR DEFECTO |
| 20 | Muestra: máx. 5.000 filas y 5 MB; textos máx. 120 caracteres; valores categóricos sin distinguir mayúsculas/tildes; textos libres unificados a la primera forma vista; filas vacías ignoradas; fila 1 = cabeceras | Robustez frente a Excel reales | DECISIÓN POR DEFECTO |
| 21 | Detección de columnas prohibidas por lista de subcadenas/tokens (nombre, apellido, dni, cédula, salario, sindicato, salud, baja, empleado, teléfono, dirección, id…) | 5.4 y 5.8 | DECISIÓN POR DEFECTO |
| 22 | Sesión deslizante: JWT de 8 h reemitido tras 15 min de uso; cookie de selección de cuenta de 10 min | «8 horas, con renovación» | DECISIÓN POR DEFECTO |
| 23 | Solicitud de enlace siempre responde 202; límites: 30/15 min por IP, 5/15 min por correo, 60/15 min en verificación | No enumerar cuentas; 3.3 | DECISIÓN POR DEFECTO |
| 24 | Fuente de iconos autoalojada (sin Google Fonts) | RGPD: sin transferencias a terceros desde la interfaz | DECISIÓN POR DEFECTO |
| 25 | Modo local sin Docker (`npm run dev:local`, Mongo en memoria) con buzón `/api/dev/outbox`, solo con `MAIL_PROVIDER=memory` y fuera de producción | Permite e2e y demos sin Docker | DECISIÓN POR DEFECTO |
| 26 | MongoDB de producción con autenticación y keyfile; en desarrollo sin auth | Seguridad mínima desde el día 1 | DECISIÓN POR DEFECTO |
| 27 | Backups cifrados con `openssl` AES-256 + PBKDF2 y subida con `rclone` a un remoto en la UE | 2.5 | DECISIÓN POR DEFECTO |
| 28 | El panel de avance del ORG_ADMIN (% frente al mínimo) se deja para la Fase 2 | Sin entrevistas no hay avance | DECISIÓN POR DEFECTO |
| 29 | Traducciones en/ca del cuestionario redactadas por Bumii como borrador | Pendiente #2 de CLAUDE.md | CLAUDE.md |
| 30 | El worker reutiliza los modelos de `apps/api` (dependencia de workspace) | Un único modelo de datos | DECISIÓN POR DEFECTO |

## Marca efr · 12/11/2026

Aplicación del handoff `design_handoff_smartaudit_marca_efr` y del Manual de identidad corporativa efr 2025 (detalle en `docs/marca.md`).

| # | Decisión | Motivo | Quién |
|---|---|---|---|
| 31 | Se sustituye el tema verde provisional por los tokens efr (`--efr-*`), Arial, radio 0, sin sombras, títulos y botones en minúsculas | Manual y handoff (alta fidelidad, definitivos) | Handoff de marca |
| 32 | Logotipos y sello técnico se muestran con un **marcador** (acrónimo «efr» en Arial Bold) hasta recibir los archivos oficiales; se conectan en `brand.ts` | El handoff los marca como placeholders | DECISIÓN POR DEFECTO |
| 33 | **Conflicto de accesibilidad:** blanco sobre `#FF6600` y naranja sobre blanco dan 3,0:1. Cumple AA para texto grande (títulos ≥ 20px en negrita) y componentes, pero **no** para texto normal (4,5:1): etiquetas de botón primario de 15px y enlaces. Se mantiene el diseño de marca; las etiquetas de estado usan texto gris oscuro con acento naranja para no depender del contraste del naranja | Marca vs. objetivo WCAG 2.1 AA de CLAUDE.md: **requiere decisión de la Fundación / Bumii** | DECISIÓN POR DEFECTO |
| 34 | Único color fuera de la paleta: rojo `#B42318`, solo para errores de validación | Los errores deben distinguirse (accesibilidad) | DECISIÓN POR DEFECTO |
| 35 | Se retiran los iconos de la interfaz (y la fuente Material Icons) | «No se usan iconos ni fotografías» (handoff) | Handoff de marca |
| 36 | Se mantiene el nombre «SmartAudit efr · powered by Bumii» de CLAUDE.md (el handoff dice «Smartaudit by Bumii») | CLAUDE.md es la fuente de verdad del producto | DECISIÓN POR DEFECTO |
| 37 | El contacto de identidad corporativa (persona de la Fundación) no se muestra en la aplicación; el pie enlaza solo a www.soyefr.org | Es un contacto interno de marca, no de soporte a usuarios | DECISIÓN POR DEFECTO |

## Acceso sin correo en entornos de prueba · 12/11/2026

| # | Decisión | Motivo | Quién |
|---|---|---|---|
| 38 | Con `DEV_SHOW_MAGIC_LINK=true` la API devuelve el enlace mágico (`devLink`) y la pantalla de acceso lo muestra con un botón «entrar con el enlace». Solo aparece si el correo tiene cuenta activa. **La API se niega a arrancar si se activa con `NODE_ENV=production`** (staging y producción usan ese modo). Activado en `npm run dev:local` y en el Compose de desarrollo | Aún no hay integración con correo y el entorno es de pruebas | Usuario |

## Retirada de «marca del certificado» · 12/11/2026

| # | Decisión | Motivo | Quién |
|---|---|---|---|
| 39 | Se elimina el campo «marca del certificado» (`certificateBrand`) de organizaciones y campañas en todas las capas (esquemas, modelos, API, semilla, interfaz, traducciones, tests). Una campaña sin referencia se muestra con el nombre de la organización | No aporta valor; CLAUDE.md (secciones 4 y 5.1) aún lo menciona | Usuario |

## Ajustes del formulario de campaña · 12/11/2026

| # | Decisión | Motivo | Quién |
|---|---|---|---|
| 40 | «Personas en el alcance» pasa a llamarse **«Población total»** (en: *Total population*, ca: *Població total*) y se quita la ayuda «Cuenta ajena el día de la auditoría, sin subcontratas ni ETT» | Claridad para el auditor | Usuario |
| 41 | Se elimina el concepto de **auditores colaboradores** en todas las capas. Solo el auditor que crea la campaña la ve y la gestiona (sustituye a la decisión 9); los superadmins siguen viéndolas todas | No existen auditores colaboradores. CLAUDE.md (5.1) aún los menciona | Usuario |

## Estilo sin bordes laterales · 12/11/2026

| # | Decisión | Motivo | Quién |
|---|---|---|---|
| 42 | Se eliminan todos los bordes laterales izquierdos gruesos (etiquetas de estado, avisos, navegación activa, avisos emergentes). Las etiquetas se distinguen por relleno y borde fino de 1 px: activa = fondo gris claro; condicional = borde discontinuo; inactiva = borde fino y texto gris. Se mantienen los acentos superiores del manual (dato destacado) | Preferencia visual | Usuario |

## Acceso de participantes sin correo · 12/11/2026

| # | Decisión | Motivo | Quién |
|---|---|---|---|
| 43 | Se adelanta de la Fase 2 la **página pública `/c/<campaña>`**: pide el código de 8 caracteres (admite minúsculas, espacios y guiones), lo valida en `POST /api/participant/c/:slug/access` y muestra el aviso previo, la elección de idioma y la disponibilidad (`participantAvailability` en `packages/shared`). La entrevista (chat) sigue siendo Fase 2: el botón «empezar» queda deshabilitado | El enlace del archivo de códigos llevaba al acceso interno | Usuario |
| 44 | Bloqueo temporal: 10 intentos **fallidos** por IP en 15 minutos (`TOO_MANY_ATTEMPTS`); los aciertos no cuentan | 5.4 «límite de intentos por IP y bloqueo temporal» | DECISIÓN POR DEFECTO |
| 45 | La página pública no muestra el nombre de la organización ni ningún dato de la campaña salvo los idiomas y las fechas de la ventana; el contacto del aviso remite a la persona auditora | Mínima exposición en una URL pública; contacto de protección de datos pendiente | DECISIÓN POR DEFECTO |

## Servidor de pruebas test2 · 12/11/2026

| # | Decisión | Motivo | Quién |
|---|---|---|---|
| 46 | Despliegue en `test2` **sin Docker**, con systemd + nginx (mismo patrón que las apps Etapas del host): `infra/server/*`, `provision-server.sh`, `deploy-server.sh` | El host no tiene Docker y es pequeño (1 CPU, 2 GB) | Usuario / DECISIÓN POR DEFECTO |
| 47 | Dominio **`efr-staging.bumii.ai`** (en lugar de `staging.efr.bumii.ai`) | El certificado universal de Cloudflare solo cubre `*.bumii.ai` (un nivel) | DECISIÓN POR DEFECTO |
| 48 | **MongoDB propio** para SmartAudit (puerto 27018, replica set, auth, caché 256 MB, límite 450 MB) | El MongoDB del host es standalone y lo usan otras apps; convertirlo exigía reiniciarlo | Usuario |
| 49 | Nuevo entorno `NODE_ENV=staging` y proveedor de correo `disabled`: como producción, pero permite el enlace en pantalla; producción sigue rechazándolo | Sin integración de correo en el servidor de pruebas | Usuario |
| 50 | Límites de memoria: API 320 MB (heap 160), worker 220 MB (heap 96), sin `--enable-source-maps` | Host compartido con poca RAM | DECISIÓN POR DEFECTO |

## Portugués de Portugal y francés · 13/11/2026

| # | Decisión | Motivo | Quién |
|---|---|---|---|
| 51 | Se añaden **portugués de Portugal** (código `pt`, fechas pt-PT, registro formal «o seu») y **francés** (`fr`, «vous») en interfaz, página del participante, correos, etiquetas de rol y cuestionario M1 | Petición del usuario | Usuario |
| 52 | Las traducciones del cuestionario en pt y fr son de Bumii y quedan **pendientes de aprobación por la Fundación** | Mismo criterio que inglés y catalán (pendiente #2 de CLAUDE.md) | DECISIÓN POR DEFECTO |
| 53 | En bases de datos ya sembradas, la semilla **publica una versión nueva** del cuestionario con los idiomas que falten (la publicada no se edita; las campañas conservan su copia) | Inmutabilidad de la configuración publicada | DECISIÓN POR DEFECTO |

## Sin festivos y sin ajustes técnicos en la interfaz · 13/11/2026

| # | Decisión | Motivo | Quién |
|---|---|---|---|
| 54 | **Se elimina el cálculo de festivos.** Día hábil = lunes a viernes en la zona horaria de la organización. Se retiran la pestaña «festivos», la colección `holidayCalendars`, la instantánea de festivos de las campañas, la librería `date-holidays` y su semilla. El país de la organización queda como dato informativo (código ISO de 2 letras) | No es necesario. CLAUDE.md (5.4) aún habla de festivos | Usuario |
| 55 | **Se retira la sección «Ajustes técnicos»** de la pantalla de ajustes (confianza mínima de la IA, proveedor de IA, conservación de datos). Los valores siguen en `settings` con sus valores por defecto (0,8, mock, purga apagada) y la API los mantiene para la Fase 2 | Petición del usuario | Usuario |

## Entidades de auditoría y coordinadores · 17/11/2026

Propuesta de F+f: el «administrador de la organización» pasa a ser el **coordinador de auditorías de una entidad
auditora** (ICONTEC, AENOR, SGS…). Preguntas resueltas una a una con el usuario.

| # | Decisión | Motivo | Quién |
|---|---|---|---|
| 56 | Nueva colección **`auditEntities`**. Roles: `SUPERADMIN_*` (F+f), **`COORDINATOR`** (sustituye a `ORG_ADMIN`) y `AUDITOR`; coordinadores y auditores pertenecen a una entidad de auditoría (`users.auditEntityId`, único por correo + entidad). La organización auditada **no tiene usuarios** en la v1 | Propuesta de F+f | Usuario |
| 57 | F+f asigna cada organización a una **entidad de auditoría y uno de sus coordinadores** (`organizations.auditEntityId/coordinatorId`); una entidad puede tener **varios coordinadores** y cada uno ve solo las organizaciones que tiene asignadas | Reparto de cartera dentro de una certificadora | Usuario |
| 58 | El coordinador **designa y puede cambiar el auditor** de cada organización (`organizations.auditorId`, con historial). Puede **asignarse a sí mismo**: entonces actúa como auditor de esa organización | Entidades pequeñas | Usuario |
| 59 | Al cambiar el auditor, las **campañas abiertas** (todas salvo `informe_generado` y `cancelada`) **pasan al nuevo auditor** y el anterior deja de verlas; no se puede dejar la organización sin auditor con campañas abiertas | Continuidad de la auditoría | Usuario |
| 60 | Cada campaña guarda la **entidad de auditoría** que la hizo. Si la organización cambia de entidad, las campañas anteriores **se quedan con la entidad anterior** (la nueva no las ve; F+f ve todas). El cambio de entidad solo se permite sin campañas abiertas | Protege las respuestas individuales de auditorías ajenas | Usuario / DECISIÓN POR DEFECTO (bloqueo con campañas abiertas) |
| 61 | Nivel de acceso por campaña calculado en `packages/shared/src/access.ts`: `manage` (auditor responsable), `aggregate` (coordinador de la organización: estado y avance, nunca muestra, códigos ni respuestas), `supervise` (superadmins), `none` (404). Visible sin permiso → 403 | Reglas deterministas y testeadas | DECISIÓN POR DEFECTO |
| 62 | El aviso de avance agregado para la empresa (antes del `ORG_ADMIN`) pasa al **coordinador**; la empresa no tiene acceso | Pregunta 2 | Usuario |
| 63 | La base de datos de staging se **reinicia** con la semilla nueva en lugar de migrar | Solo contiene datos sintéticos | Usuario |
| 64 | La «fecha de la visita» pasa a ser la **fecha de comienzo de las entrevistas** (`m1Config.interviewStartDate`): la ventana **abre ese día a las 9:00 y dura 10 días hábiles** (cierra a las 23:59 del 10.º); recordatorios en los días hábiles 4 y 8. Si la fecha no es hábil, abre el siguiente día hábil y se avisa (`START_NOT_BUSINESS_DAY`) | Cambio 2 de F+f; pregunta 1 | Usuario |
| 65 | **Máximo de entrevistas completadas** (`m1Config.maxCompleted`, resuelto en `sampling.maximum`): por defecto el mínimo; el auditor puede subirlo dentro de [mínimo, población total] y sin superar la muestra cargada. Al alcanzarlo, `en_curso` → `finalizada` (motivo `maximum_reached`, `closeIfMaximumReached`). Se disparará desde el motor de entrevistas (`TODO(Fase 2)`) | Cambio 2; pregunta 2 | Usuario |
| 66 | **El catalán no se ofrece**: `AVAILABLE_LANGUAGES` = es, en, pt, fr para interfaz, organizaciones, usuarios, auditorías y participantes. Se conservan `ca.json`, las plantillas y los textos del cuestionario. La lista es una constante de código, no un ajuste en `settings` | Cambio 2 | Usuario (constante en código: DECISIÓN POR DEFECTO) |
| 67 | **Entidades de auditoría reales** como tabla maestra: AENOR, APCER, AUDELCO, CMD, DNV, EDUQATIA, ICONTEC, LOT y SGS («EDUQATIA ICONTEC» se interpreta como dos entidades). Sustituyen a las sintéticas; los usuarios de prueba pasan a ICONTEC (CO) y AENOR (ES). El país de la entidad pasa a ser **opcional** y solo se rellena donde es seguro (AENOR ES, APCER PT, ICONTEC CO) | Cambio 2; pregunta 3 | Usuario (país opcional: DECISIÓN POR DEFECTO) |
| 68 | «Campañas» pasa a llamarse **«auditorías»** solo en la interfaz, los correos y la documentación para usuarios. Identificadores, rutas (`/campaigns`), API y colecciones siguen siendo `campaign` | Cambio 2; renombrar el código no aporta nada al usuario y rompería enlaces | DECISIÓN POR DEFECTO |
| 69 | **Listados paginados en el servidor** (organizaciones, organizaciones asignadas y auditorías): búsqueda sin mayúsculas ni acentos (`searchPattern`), filtros (entidad, «sin entidad», estado; auditorías abiertas/cerradas o un estado), orden por columnas y 25 filas por página (10/25/50/100). El estado de la lista va en la URL para conservarlo al volver atrás. «Cerradas» = `informe_generado` y `cancelada` | Cambio 2: 300–400 organizaciones, 50–60 por coordinador | DECISIÓN POR DEFECTO |

## Fase 2 · Invitaciones y motor conversacional · 19/11/2026

| # | Decisión | Motivo | Quién |
|---|---|---|---|
| 70 | Si la respuesta de la que depende una pregunta queda **pendiente de revisión** (p. ej. P7), la pregunta condicionada (P7.1) **se hace**; una abstención no la activa | No se puede saber si aplica; está redactada «en caso de…» y se puede declinar | DECISIÓN POR DEFECTO |
| 71 | La entrevista se da por **completada** cuando el motor no tiene más preguntas, incluida la opcional P10, que se salta con un toque («No tengo comentarios»). Ese momento marca `completedAt` y la entrevista facturable | Es lo más simple y equivale a «todas las obligatorias respondidas» más un toque | DECISIÓN POR DEFECTO |
| 72 | **Guardas deterministas sobre la IA** (`packages/shared/src/interview.ts`): una reformulación se descarta si añade preguntas, cifras, enlaces u opciones de respuesta que no estén en el texto oficial; una aclaración se descarta si nombra solo algunas opciones o lleva enlaces; las respuestas que parecen **instrucciones a la IA** no se envían a clasificar (se tratan como fuera de tema); correos, enlaces, códigos y números de teléfono o documento se **eliminan** antes de llamar al proveedor | Criterios de la Fase 2: 0 preguntas inventadas, 0 respuestas sugeridas, ningún identificador al proveedor | DECISIÓN POR DEFECTO |
| 73 | Clasificación de la IA validada con el esquema; si no valida, **un reintento** y después `pending_review`. Confianza < umbral → `pending_review` sin aclaración; ambigua o fuera de tema → **una aclaración** y después `pending_review` | Sección 5.5 | CLAUDE.md |
| 74 | **Adaptador mock determinista** (`packages/llm`): conserva el texto oficial, clasifica por etiquetas y sinónimos en es/en/pt/fr/ca y repregunta listando todas las opciones. `LLM_PROVIDER=mock` hasta que se decida el proveedor real. Prompts versionados en `packages/llm/src/prompts/m1-v1.ts` | Decisión pendiente 1 de CLAUDE.md | DECISIÓN POR DEFECTO |
| 75 | **Lanzar** = `muestra_cargada` → `envios_activos` (botón del auditor). Las invitaciones salen **al abrir la ventana** (9:00 del día de comienzo), momento en que pasa a `en_curso`; las personas sin correo pasan a «invitada» al lanzar (código en papel) | Sección 5.4: correos a las 9:00 y ventana desde el día de comienzo | DECISIÓN POR DEFECTO |
| 76 | Un **planificador idempotente** (`apps/api/src/services/scheduler.ts`) se ejecuta cada minuto en el worker: transiciones automáticas, invitaciones y recordatorios (días hábiles 4 y 8, solo a quien no ha completado). Respeta `settings.mailDailyLimit` (últimas 24 h) y reintenta los fallos con esperas de 2, 4, 8… minutos, hasta 5 intentos | Cupo de Google Workspace y reintentos con backoff (5.4) | DECISIÓN POR DEFECTO |
| 77 | Los correos al participante van en el **idioma por defecto de la organización** (si está disponible; si no, español): todavía no se sabe qué idioma elegirá la persona | Simplicidad | DECISIÓN POR DEFECTO |
| 78 | **Sesión del participante**: cookie `httpOnly` de 12 h, limitada a `/api/participant`, que solo identifica el registro de respuesta (nunca el correo). Se abre con el enlace personal o con el código; en cada petición se comprueba que el enlace o código sigue vigente | Sin cuentas para participantes (5.4) | DECISIÓN POR DEFECTO |
| 79 | **Estado por persona** para el auditor (y superadmins): se identifica por la **fila del archivo de muestra** del auditor, con canal (correo o código en papel), estado, invitación y recordatorios. Nunca correo ni respuestas. El coordinador solo ve el agregado | Matriz 3.2 y privacidad | DECISIÓN POR DEFECTO |
| 80 | La **ampliación de ventana** solo se permite con la auditoría lanzada y abierta (`envios_activos`, `en_curso`), a una fecha posterior; cierra a las 23:59 locales y queda en `window.extensions` y en `auditLogs` | Sección 5.4 | DECISIÓN POR DEFECTO |
| 81 | **Herramientas de desarrollo** solo en el modo local en memoria: `POST /api/dev/tick` (planificador) y `POST /api/dev/campaigns/:id/open-now` (abrir la ventana ya); además el planificador corre cada 30 s en `dev:local`. En el servidor de pruebas basta con crear la auditoría con fecha de comienzo **hoy** | Pruebas de punta a punta sin esperar a las fechas | DECISIÓN POR DEFECTO |
| 82 | En la pregunta de **respuesta múltiple** (P2) las opciones son botones que se activan y desactivan, más «enviar», en lugar de casillas | Más cómodo en el móvil y fiable con teclado y lectores de pantalla | DECISIÓN POR DEFECTO |
| 83 | **Proveedor de IA: Google Gemini** (`packages/llm/src/gemini.ts`, API REST `generateContent` sin SDK): temperatura 0, salida JSON con esquema para clasificar, tiempo máximo de 15 s, modelo configurable (`GEMINI_MODEL`, por defecto `gemini-2.5-flash`). Los errores nunca incluyen la clave. El worker no usa la IA | Decisión del usuario; cierra la decisión pendiente 1 | Usuario |
| 84 | La **clave de Gemini** se guarda en los servidores como **credencial cifrada de systemd** (`systemd-creds`, clave del servidor o TPM2) en `/etc/credstore.encrypted/gemini_api_key`, importada solo por `smartaudit-api` (`ImportCredential=`). Nunca en `.env`, en el repositorio ni en la línea de comandos. Se pone o rota con `infra/scripts/set-gemini-key.sh <host>`. Si se elige Gemini sin clave, la API no arranca | Petición del usuario: guardarla de forma segura en el sistema operativo | DECISIÓN POR DEFECTO (mecanismo) |

## Grupo de cambios 3 de F+f · 25/11/2026

| # | Decisión | Motivo | Quién |
|---|---|---|---|
| 85 | **Tipo de auditoría: solo `inicial` o `renovacion`.** `mantenimiento` deja de ofrecerse; se conserva en la base de datos para las auditorías antiguas (`LEGACY_AUDIT_TYPES`) | Grupo de cambios 3 | Usuario |
| 86 | **Componente de Bienestar**: casilla en la auditoría (`m1Config.wellbeing`) que activa P11–P15 (regla `campaign_in` sobre `wellbeing`). P11–P13: acuerdo en tres opciones; P14–P15: texto libre opcional. Van antes de P10. Las bases de datos existentes reciben una **nueva versión del cuestionario** con esas preguntas (la semilla sincroniza preguntas, además de idiomas) | Grupo de cambios 3; tabla de preguntas de F+f | Usuario |
| 87 | El **máximo** ya no lo limita la muestra cargada, solo la población total (antes se rechazaba al editar una auditoría con la muestra cargada, aunque al crearla se había aceptado). La ficha avisa si el máximo supera la muestra | Fallo informado en el grupo de cambios 3 | Usuario (corrección) |
| 88 | **Sin activación, suspensión ni cancelación.** Con la muestra cargada la auditoría queda programada (`muestra_cargada`) y se abre sola en la fecha de comienzo (`en_curso`); se puede editar y reemplazar la muestra hasta entonces. Se retiran el botón «lanzar», el menú «cambiar estado», las rutas `POST /campaigns/:id/launch` y `/status` y los permisos `campaign.suspend`/`campaign.cancel`. Las personas sin correo pasan a «invitada» al abrirse la ventana | Grupo de cambios 3, pregunta 1 | Usuario |
| 89 | En P11–P13 se añade **«De acuerdo»** como tercera opción: la tabla recibida mostraba solo «En desacuerdo» y «Ni de acuerdo ni en desacuerdo», probablemente por una celda cortada. P14–P15 («texto libre disociado») son opcionales y en la Fase 3 se mostrarán sin demográficos. Se corrige «organización.?» → «organización?» | Interpretación de la tabla recibida | DECISIÓN POR DEFECTO (pendiente de confirmar) |


## Entrevista conversada (comentarios de F+f) · 25/11/2026

F+f pidió que la entrevista no se pareciera a un formulario: la IA debe proponer las respuestas posibles, no se debe
poder responder marcando una opción, y ante respuestas incoherentes o preguntas de la persona debe repreguntar,
aclarar o conversar, con dos interacciones como máximo. Ejemplo revisado: entrevista del 24/11 en el servidor de
pruebas, en la que «¿Qué modelo es el efr?» y «¿Qué es un mánager efr?» solo recibían «responda de nuevo».

| # | Decisión | Motivo | Quién |
|---|---|---|---|
| 90 | **Respuesta siempre escrita** en las preguntas cerradas (`answerMode: 'text'` por pregunta; las versiones anteriores del cuestionario quedan con botones). Solo «Prefiero no responder» sigue siendo un botón. La API rechaza las opciones marcadas (`TEXT_ANSWER_REQUIRED`) | Comentarios de F+f: no se debe poder responder con un check | Usuario |
| 91 | **Hasta 2 interacciones por pregunta** (`maxClarifications: 2`), cada una con un motivo decidido en código (`FollowUpReason`): `question` (la persona pregunta qué significa algo → la IA explica **solo con la explicación aprobada** de la pregunta y vuelve a preguntar), `confirm` (confianza entre 0,5 y el umbral → la IA propone su interpretación y la persona confirma o corrige), `ambiguous` (recoge lo dicho y pide concretar), `off_topic` (reconduce). La IA reacciona a lo que dijo la persona, ve la conversación de esa pregunta (sin identificadores) y su texto pasa por la guarda (todas las opciones o ninguna, salvo la interpretación propuesta; sin cifras que no estén en los textos aprobados). Sin interacciones restantes, `pending_review`. Prompts `m1-v2` | Comentarios de F+f; sustituye «una aclaración como máximo» (secciones 0.3 y 5.5) y «confianza baja → revisión directa» | Usuario |
| 92 | La pregunta se muestra con el **texto oficial más una frase aprobada que propone las respuestas** (`answerHint`, p. ej. «¿Diría que siempre, algunas veces o nunca?»), **sin reformulación de la IA**: la IA conversa en las repreguntas. Interpretación de «preguntar proponiendo una posible respuesta»: se proponen **todas** las respuestas en la pregunta y **una** solo como confirmación, para no inducir la respuesta | Comentarios de F+f y deriva observada en las reformulaciones de Gemini («importante» → «fundamental») | DECISIÓN POR DEFECTO (pendiente de confirmar con F+f) |
| 93 | Nuevos textos del cuestionario, **redactados por Bumii y pendientes de aprobación de F+f**: frases de respuesta y explicaciones de cada pregunta cerrada (es, en, pt, fr y ca oculto) y la opción de P2 **«No he recibido información»** (`NINGUNO`), para que quien no conoce el modelo efr no quede registrado como abstención. Llegan a las bases de datos existentes como nueva versión del cuestionario (revisión 2 de la semilla, `seedRevision`); las auditorías ya abiertas conservan su versión | Ejemplo de F+f: «no me han informado» se guardaba como abstención | DECISIÓN POR DEFECTO (pendiente de aprobación) |

## Cambios 4 (Fase 3) · bloques 1 y 2: cálculo de resultados y revisión del auditor · 25/11/2026

| # | Decisión | Motivo | Quién |
|---|---|---|---|
| 94 | **Decisión del auditor** sobre una respuesta en revisión: código(s) de la pregunta, **abstención** o **«sin respuesta válida»** (`review.decision`). Solo se revisan respuestas enviadas a revisión (`pending_review`); la decisión puede cambiarse hasta que se genere el informe (después, `409 REPORT_ALREADY_GENERATED`). También pueden revisar los superadmins. Cada decisión y cada consulta de la cola quedan en `auditLogs` | Sección 5.6 («cola de respuestas dudosas») y matriz 3.2 | DECISIÓN POR DEFECTO |
| 95 | **Cálculo de resultados** (`packages/shared/src/results.ts`): solo entrevistas **completadas**; cada respuesta cuenta con su valor efectivo (la decisión del auditor y, si no la hay, la codificación de la IA); las preguntas condicionadas (P7.1) solo cuentan si su condición se cumple con los valores efectivos; la exclusión de la base es **configuración** del cuestionario (`results.excludeFromBase`, P8 «No sabe / No contesta», revisión 3 de la semilla); porcentajes con **un decimal, redondeo hacia arriba en el 5**, sin forzar que sumen 100; en P2 se listan solo los textos de opciones que piden texto («Otros») | Sección 5.6; el redondeo está pendiente de confirmar con F+f | DECISIÓN POR DEFECTO |
| 96 | **Respuestas individuales**: filas con demográficos y respuestas codificadas, **sin correo, fila del archivo ni fechas**, en un orden que no es el de las entrevistas; se cargan solo tras aceptar el aviso de confidencialidad y cada carga se registra. **Todas las respuestas abiertas** (P14–P15 «texto libre disociado» y también **P10**) se muestran aparte, sin demográficos, hasta que exista la anonimización de comentarios (bloque 4). Aviso de grupos de menos de 3 personas (sexo, edad, centro y tipo de puesto) | Sección 5.6 y 5.8; P10 puede contener datos que identifiquen | DECISIÓN POR DEFECTO |
| 97 | Resultados, revisión y respuestas individuales: acceso **`manage` (auditor responsable) y `supervise` (superadmins)**; el coordinador recibe 403 y solo ve el avance agregado; otra entidad de auditoría, 404 | Matriz 3.2 | CLAUDE.md |

## Ayuda temporal de pruebas · 26/11/2026

| # | Decisión | Motivo | Quién |
|---|---|---|---|
| 98 | **TEMPORAL — retirar antes de producción.** En la tabla «Estado por persona» del avance, el auditor responsable y los superadmins tienen un botón **«ver enlace»** que muestra el enlace de la invitación de cada persona (o la página de la auditoría y su código en papel) para abrir su entrevista. Solo con `DEV_SHOW_MAGIC_LINK=true`, que la API **no permite en producción** (no arranca); si está apagado, la ruta `POST /api/campaigns/:id/people/:ref/test-link` responde 404 y la tabla no muestra la columna. Solo con la auditoría abierta; cada uso queda en `auditLogs` (`participant.testLink`). El coordinador no lo ve | Petición del usuario: aún no hay integración de correo y hay que poder entrar como cada persona para probar los resultados | Usuario |
| 99 | La **plantilla de muestra en Excel** tiene todas las columnas en **formato texto**, para que Excel no convierta los tramos «2-5» y «6-10» en fechas (2 de mayo, 6 de octubre). Al subir un Excel hecho con una plantilla anterior, una fecha en una columna de tramo se convierte en el tramo si solo una lectura (día-mes o mes-día) es válida; si no, la fila da el error habitual de valor fuera de categoría | Fallo informado por el usuario (26/11/2026) | Usuario (corrección) |
