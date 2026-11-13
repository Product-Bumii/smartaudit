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
