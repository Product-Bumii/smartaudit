# SmartAudit efr · powered by Bumii

Plataforma web para realizar **entrevistas escritas conducidas por IA** a la plantilla de las organizaciones que se
certifican con el modelo **efr (Empresa Familiarmente Responsable)** de la Fundación Másfamilia, y convertir las
respuestas en las tablas y la síntesis del informe de auditoría externa (plantilla ed6, secciones 7.1 a 7.3).

Hoy el auditor elige una muestra de personas, las entrevista en persona o por teléfono, tabula a mano en Excel y copia
los resultados al informe. SmartAudit automatiza la entrevista, la codificación y la tabulación; **el auditor conserva el
control**: elige la muestra, valida lo dudoso y aprueba el informe.

| | |
|---|---|
| Producto | SmartAudit efr · powered by Bumii |
| Cliente | Fundación Másfamilia |
| Estado | **Fase 1 completada** (base, configuración y muestra) + página de acceso con código adelantada de la Fase 2 |
| Servidor de pruebas | **https://efr-staging.bumii.ai** |
| Especificación (fuente de verdad) | [CLAUDE.md](CLAUDE.md) |
| Registro de decisiones | [docs/decisiones.md](docs/decisiones.md) |

> ⚠️ **Solo datos sintéticos.** Hasta la firma del acuerdo de tratamiento de datos (art. 28 RGPD) no se puede usar ningún
> dato personal real, ni en local ni en el servidor de pruebas.

---

## Índice

1. [Accesos rápidos y usuarios de prueba](#1-accesos-rápidos-y-usuarios-de-prueba)
2. [Qué hace la plataforma](#2-qué-hace-la-plataforma)
3. [Roles y permisos](#3-roles-y-permisos)
4. [Recorrido de uso paso a paso](#4-recorrido-de-uso-paso-a-paso)
5. [Arquitectura y tecnología](#5-arquitectura-y-tecnología)
6. [Estructura del repositorio](#6-estructura-del-repositorio)
7. [Puesta en marcha en local](#7-puesta-en-marcha-en-local)
8. [Tests y calidad](#8-tests-y-calidad)
9. [Servidor de pruebas (efr-staging.bumii.ai)](#9-servidor-de-pruebas-efr-stagingbumiiai)
10. [Despliegue en producción con Docker (previsto)](#10-despliegue-en-producción-con-docker-previsto)
11. [Variables de entorno](#11-variables-de-entorno)
12. [Modelo de datos](#12-modelo-de-datos)
13. [Reglas de negocio implementadas](#13-reglas-de-negocio-implementadas)
14. [API](#14-api)
15. [Privacidad y seguridad](#15-privacidad-y-seguridad)
16. [Marca efr](#16-marca-efr)
17. [Internacionalización](#17-internacionalización)
18. [Datos sintéticos de la semilla](#18-datos-sintéticos-de-la-semilla)
19. [Hoja de ruta y pendientes](#19-hoja-de-ruta-y-pendientes)
20. [Solución de problemas](#20-solución-de-problemas)

---

## 1. Accesos rápidos y usuarios de prueba

### Direcciones

| Entorno | URL | Cómo se entra |
|---|---|---|
| **Servidor de pruebas** | https://efr-staging.bumii.ai | Escribe un correo de prueba → pulsa **«entrar con el enlace»** (el enlace sale en pantalla) |
| Local sin Docker | http://localhost:4200 | Igual que arriba (enlace en pantalla). Buzón alternativo: http://localhost:3000/api/dev/outbox |
| Local con Docker | http://localhost:8080 | Enlace en pantalla o en Mailpit: http://localhost:8025 |
| Salud de la API (pruebas) | https://efr-staging.bumii.ai/api/health | — |

**Presentación con capturas:** [docs/presentacion/README.md](docs/presentacion/README.md) (27 capturas, 19/11/2026) ·
**qué cambió con los cambios 1 y 2:** [informe de cambios](docs/presentacion/informe-cambios-1-y-2.md) ·
**Fase 2:** [presentación de la Fase 2](docs/presentacion/fase-2.md) (17 capturas).

### Usuarios de prueba (semilla sintética)

Todos son ficticios y usan dominios `.example` reservados (RFC 2606): ningún correo llega a personas reales.
Existen tanto en local como en el servidor de pruebas.

| Correo | Rol | Entidad de auditoría | Qué puede hacer |
|---|---|---|---|
| `superadmin.bumii@bumii.example` | `SUPERADMIN_BUMII` | — (plataforma) | Lo mismo que el superadmin de la Fundación |
| `superadmin.fundacion@masfamilia.example` | `SUPERADMIN_FUNDACION` | — (plataforma) | Entidades de auditoría y sus coordinadores, organizaciones y su asignación, configuración (tabla de mínimos, cuestionarios, ajustes), ver/suspender/cancelar auditorías |
| `coordinacion@icontec.example` | `COORDINATOR` | ICONTEC · Colombia | Coordina Andina Servicios y Costa Alimentos (esta sin auditor): crea auditores y designa el auditor de cada organización |
| `coordinacion@aenor.example` | `COORDINATOR` | AENOR · España | Coordina Ibérica Logística y Montaña Textil |
| `auditor1@auditoria.example` | `AUDITOR` | **Ambas entidades** | Al entrar **elige entidad**; audita Andina Servicios (Andes) e Ibérica Logística (Ibérica) |
| `auditor2@auditoria.example` | `AUDITOR` | AENOR | Audita Montaña Textil |

Organizaciones (empresas efr, **sin usuarios**): Andina Servicios S.A.S. y Costa Alimentos S.A.S. (Colombia), Ibérica
Logística S.L. y Montaña Textil S.L. (España), todas sintéticas.

**Participantes sin correo:** no tienen cuenta. Entran por `https://<dominio>/c/<auditoría>` con un **código de 8
caracteres** que el auditor descarga tras subir la muestra (ver [paso 4.7](#47-persona-participante)).

### Archivos de muestra de prueba (`seed/samples/`)

| Archivo | Para qué sirve |
|---|---|
| `muestra-valida-30.csv` / `.xlsx` | 30 personas válidas (25 con correo, 5 `SIN_CORREO` → generan códigos de acceso) |
| `muestra-valida-pequena-12.csv` | 12 personas: menos que el mínimo de 14 → muestra el aviso de muestra insuficiente |
| `muestra-invalida-errores-fila.csv` | Un error de cada tipo (correo inválido, duplicado, sexo, tramo de edad, centro vacío, `turnos`) |
| `muestra-invalida-columnas-prohibidas.csv` | Columnas `nombre`, `dni`, `salario` → rechazadas |

Se regeneran con `npx tsx seed/generate-samples.ts`.

---

## 2. Qué hace la plataforma

> **Terminología:** en la interfaz y en los documentos para usuarios, cada proceso de entrevistas de una organización se
> llama **auditoría**. En el código, la API y la base de datos sigue llamándose `campaign` (decisión 68).

### Módulos del producto

| Módulo | Propósito | Gestiona la auditoría | Estado |
|---|---|---|---|
| **M1 · Auditoría** | Entrevistas a la plantilla durante auditorías efr | Auditor | **En construcción** (Fase 1 hecha) |
| M2 · Eficacia | Evaluar medidas de conciliación (anexo 1000-16) | Empresa efr | Previsto (interfaces vacías declaradas) |
| M3 · Diagnóstico | Voz del empleado y de la dirección (anexo 1000-12) | Fundación / consultor | Previsto (interfaces vacías declaradas) |

### Funcionalidades disponibles hoy

- **Acceso por enlace mágico** (sin contraseñas): un solo uso, caduca a los 15 minutos. Si un correo tiene cuentas en
  varias entidades de auditoría, se elige a cuál entrar. En entornos de prueba el enlace aparece en pantalla.
- **Superadmins (F+f):** gestión de **entidades de auditoría** (ICONTEC, AENOR, SGS…) y sus coordinadores; gestión de
  organizaciones (país, zona horaria, idioma) y su **asignación** a una entidad y un coordinador; configuración
  versionada de la **tabla de mínimos** y el **cuestionario M1** (con aprobación por idioma); ajustes generales.
- **Coordinador de auditorías:** ve las organizaciones que tiene asignadas, crea y desactiva los auditores de su
  entidad y **designa el auditor responsable** de cada organización (puede asignarse a sí mismo). De las auditorías solo
  ve el estado y el avance agregado; nunca la muestra, los códigos ni las respuestas.
- **Auditor:**
  - Ve sus organizaciones asignadas y crea y edita auditorías M1 para ellas, con **cálculo automático** del mínimo de
    entrevistas completadas, el **máximo** (al alcanzarlo la auditoría se cierra sola), la **ventana de participación**
    (abre el día de comienzo de las entrevistas y dura 10 días hábiles, de lunes a viernes) y las **preguntas activadas**.
  - Descarga la plantilla de muestra (Excel/CSV), la sube y ve **errores fila a fila** (si hay errores no se carga nada).
  - Ve el resumen de la muestra: valores distintos de centro y tipo de puesto, distribución por sexo y edad, avisos de
    muestra insuficiente y de grupos pequeños (riesgo de reidentificación).
  - Descarga los **códigos de acceso** de las personas sin correo.
  - **Lanza la auditoría** (Fase 2): las invitaciones salen solas al abrir la ventana; recordatorios en los días
    hábiles 4 y 8 a quien no ha completado; la auditoría pasa a *En curso* al abrir y a *Finalizada* al cerrar (o al
    alcanzar el máximo).
  - Sigue el **avance**: completadas frente al mínimo y al máximo, alertas de muestra insuficiente y de proyección por
    debajo del mínimo, y el **estado de cada persona** identificada por su fila en el archivo (nunca por su nombre).
  - **Amplía la ventana** si hace falta (queda registrado).
  - Suspende, reanuda o cancela auditorías.
- **Listados con búsqueda, filtros, orden y páginas** (pensados para cientos de organizaciones y miles de
  auditorías): búsqueda por nombre sin distinguir mayúsculas ni acentos, filtro por entidad de auditoría y estado,
  filtro de auditorías abiertas/cerradas o por estado, 25 filas por página (10, 25, 50 o 100). La búsqueda se conserva al
  volver atrás.
- **Participante** (Fase 2): entra con su **enlace personal** `/i/<token>` (invitación por correo) o con su **código** en
  `/c/<auditoría>` (personas sin correo); ve el aviso previo, elige idioma y responde una **entrevista escrita en el
  móvil**: botones con las opciones, respuesta con sus palabras (la IA la clasifica) o «Prefiero no responder». Puede
  pausar y continuar con el mismo enlace o código, sin repetir ni perder respuestas.
- **IA acotada** (Fase 2): la IA solo reformula la pregunta, clasifica el texto libre y pide **una** aclaración como
  máximo. El orden, las condiciones (P7.1, P8, P9), el umbral de confianza y la revisión humana son código
  determinista. Guardas: reformulaciones que inventen preguntas o nombren opciones, aclaraciones que sugieran una
  respuesta y respuestas que intenten dar instrucciones a la IA se descartan; los datos personales que escriba una
  persona se eliminan antes de llamar a la IA. El proveedor real es **Google Gemini** (`LLM_PROVIDER=gemini`); en
  desarrollo y tests se usa un **adaptador mock determinista**.

### Lo que todavía no existe (fases siguientes)

La revisión de respuestas dudosas, el cálculo de resultados y la
exportación del informe (Word/Excel/PDF), en la Fase 3. Ver [hoja de ruta](#19-hoja-de-ruta-y-pendientes).

---

## 3. Roles y permisos

La organización auditada (empresa efr) **no tiene usuarios**. Los usuarios son F+f (superadmins) y las **entidades de
auditoría** (certificadoras), con dos perfiles: coordinador y auditor (decisión 56).

| Acción | Superadmins (F+f) | COORDINATOR | AUDITOR | Participante |
|---|---|---|---|---|
| Crear entidades de auditoría y sus coordinadores | ✅ | — | — | — |
| Crear organizaciones y asignarlas a entidad + coordinador | ✅ | — | — | — |
| Crear/desactivar auditores de la entidad | ✅ | ✅ (la suya) | — | — |
| Designar o cambiar el auditor de una organización | ✅ | ✅ (sus organizaciones; también a sí mismo) | — | — |
| Gestionar cuestionarios, tabla de mínimos y ajustes | ✅ | — | — | — |
| Crear y configurar auditorías M1 | Ver, suspender y cancelar todas | Solo si es el auditor asignado | ✅ (organizaciones asignadas) | — |
| Ver estado y avance agregado de las auditorías | ✅ | ✅ (sus organizaciones) | ✅ (las suyas) | — |
| Cargar y validar la muestra, descargar códigos | — | Solo como auditor | ✅ (las suyas) | — |
| Ver respuestas, muestra o quién respondió | ✅ (Fase 3) | ❌ salvo como auditor | ✅ (Fase 3) | — |
| Responder la entrevista | — | — | — | ✅ (solo la suya) |

Reglas transversales:

- **Aislamiento por entidad de auditoría** en todas las consultas. Un recurso de otra entidad responde **404** (no se
  revela su existencia); un recurso visible pero sin permiso (coordinador sobre la muestra) responde **403**.
- **Acceso por asignación** (reglas en `packages/shared/src/access.ts`): el auditor solo crea auditorías para las
  organizaciones que tiene asignadas; cada auditoría la gestiona su **auditor responsable**; el coordinador de la
  organización ve solo el agregado; los superadmins ven todas.
- **Cambio de auditor:** las auditorías abiertas pasan al nuevo auditor (queda registrado); no se puede dejar una
  organización sin auditor mientras tenga auditorías abiertas.
- **Cambio de entidad de auditoría:** solo sin auditorías abiertas. Las auditorías anteriores **se quedan con la entidad
  que las hizo** (la nueva no las ve).
- Los guards de Angular solo controlan la navegación; **la autorización siempre la aplica la API**.
- Las acciones administrativas, cambios de configuración y exportaciones quedan registradas en `auditLogs`.

---

## 4. Recorrido de uso paso a paso

### 4.1 Entrar

1. Abre la URL del entorno e introduce un correo de la [tabla de usuarios](#usuarios-de-prueba-semilla-sintética).
2. Pulsa **«enviar enlace de acceso»**. En entornos de prueba aparece el recuadro **«entorno de pruebas»**: pulsa
   **«entrar con el enlace»** (o copia la URL que aparece debajo).
3. Con `auditor1@auditoria.example` aparecerá **«elige la entidad de auditoría»**.

### 4.2 Superadmin: entidades de auditoría y organizaciones

1. Entra con `superadmin.fundacion@masfamilia.example` → **Entidades de auditoría** → **nueva entidad de auditoría**:
   nombre, país y, opcionalmente, el correo de su primer coordinador. En la ficha de la entidad se gestionan sus
   coordinadores y auditores.
2. **Organizaciones** → **nueva organización**: nombre, país (rellena la zona horaria), idioma por defecto y,
   opcionalmente, entidad de auditoría y coordinador.
3. En la ficha de la organización puedes editar sus datos, activarla/desactivarla y cambiar su **asignación**
   (entidad, coordinador y, si hace falta, auditor).

### 4.3 Superadmin: configuración

En **Configuración** hay tres pestañas. Toda la configuración está **versionada**: una versión publicada no se edita,
se crea una nueva (solo puede haber un borrador a la vez). Las auditorías guardan la versión con la que se crearon.

- **Tabla de mínimos:** tramos «desde / hasta / mínimo de completadas / máximo elegible por el auditor». Se valida antes
  de publicar (contigüidad, último tramo sin límite…).
- **Cuestionarios:** versiones del cuestionario M1, textos por idioma, reglas de activación legibles, **aprobación por
  idioma** (solo los idiomas aprobados se ofrecen a participantes) y edición avanzada de la estructura en JSON validado.
- **Ajustes:** remitente de correo y normas disponibles. Los ajustes técnicos (confianza mínima de la IA, proveedor de
  IA y conservación de datos) no se muestran en la interfaz; mantienen sus valores por defecto en la base de datos.

### 4.4 Coordinador: auditores y asignación

1. Entra con `coordinacion@icontec.example` → **Auditores** → escribe el correo y el idioma → **añadir**. Puede
   desactivar y reactivar auditores de su entidad.
2. **Organizaciones** (sus organizaciones asignadas) → en la columna **auditor/a responsable** elige un auditor de su
   entidad o a sí mismo. «Costa Alimentos» viene sin auditor para probarlo.
3. En **Auditorías** ve las auditorías de sus organizaciones con la etiqueta «solo avance».

### 4.5 Auditor: crear una auditoría y cargar la muestra

1. Entra con `auditor2@auditoria.example` (o `auditor1` eligiendo entidad) → **Organizaciones** → **nueva auditoría** en
   la fila de la organización (o **Auditorías** → **nueva auditoría** y elige la organización).
2. Rellena: referencia (opcional), norma (`1000-1` / `1000-2`), tipo de auditoría (inicial o renovación), si incluye el **componente de Bienestar** (P11–P15),
   **fecha de comienzo de las entrevistas**, **población total**, **máximo de entrevistas completadas** (opcional; vacío
   = el mínimo), mánager efr (solo referencia), si postula a excelencia e idiomas.
3. El panel **«2. cálculo automático»** muestra en vivo el mínimo y el máximo de completadas, la ventana (apertura,
   cierre y recordatorios) y qué preguntas se harán. Con más de 16.000 personas hay que fijar el mínimo entre 91 y 143.
4. **Crear** → ficha de la auditoría (estado *Borrador*).
5. En **«3. muestra»** descarga la plantilla, sube el archivo:
   - Con errores: tabla de errores por fila y columna; no se carga nada.
   - Correcto: la auditoría pasa a **Muestra cargada**; se generan los tokens de invitación (personas con correo) y los
     códigos de acceso (personas `SIN_CORREO`).
6. Revisa el resumen y pulsa **«descargar códigos de acceso»** (Excel o CSV): fila del archivo original, código, centro,
   tipo de puesto y enlace. Mientras la auditoría está en *Borrador* o *Muestra cargada* se puede **reemplazar** la muestra.

### 4.6 Auditor: la auditoría se abre sola; seguir el avance

1. Con la muestra cargada la auditoría queda **programada** (*Muestra cargada*): no hay que lanzarla ni se puede
   suspender o cancelar. Hasta que abre se puede **editar** y **reemplazar** la muestra.
2. Cuando abre la ventana (9:00 del día de comienzo, hora de la organización) pasa sola a *En curso* y salen las
   invitaciones; desde entonces solo se pueden **añadir** personas. **En local** no hay worker: el planificador corre cada 30 s, y para no esperar a la fecha basta con
   `curl -X POST localhost:3000/api/dev/campaigns/<id>/open-now`. Los correos se ven en `localhost:3000/api/dev/outbox`.
   En el servidor de pruebas, crea la auditoría con fecha de comienzo **hoy** y se abrirá en el minuto siguiente.
3. La sección **«avance»** muestra completadas frente al mínimo y al máximo, las alertas y el estado de cada persona;
   desde ahí se **amplía la ventana**.

### 4.7 Persona participante

1. Abre su **enlace personal** (correo de invitación, `https://<dominio>/i/<token>`) o el enlace del archivo de códigos
   (`https://<dominio>/c/<auditoría>`) y escribe su **código** (da igual mayúsculas, minúsculas, espacios o guiones).
2. Lee el aviso previo (uso de IA, finalidad, confidencialidad, derecho a no responder, contacto), elige idioma y pulsa
   **«empezar la entrevista»**.
3. Responde con los **botones**, con **sus palabras** o con **«Prefiero no responder»**. Si la respuesta libre no encaja
   con ninguna opción, la IA repregunta una vez; si sigue sin encajar, queda para revisión del auditor.
4. Puede cerrar y volver con el mismo enlace o código: **«continuar la entrevista»** retoma la pregunta pendiente.
5. Al terminar ve el agradecimiento; el enlace ya no permite empezar otra entrevista.
6. Tras **10 intentos fallidos de código en 15 minutos** desde la misma IP, se bloquea temporalmente.

---

## 5. Arquitectura y tecnología

```
                 ┌───────────── Cloudflare (HTTPS) ─────────────┐
navegador ──────▶│                                              │
                 └──────────────────────┬───────────────────────┘
                                        ▼
                        nginx / Caddy (estáticos + proxy /api)
                          │                          │
               Angular (estático)            API Express (Node)
                                                     │
                                  Worker (Agenda) ───┤
                                                     ▼
                                     MongoDB (replica set, transacciones)
```

| Capa | Tecnología |
|---|---|
| Base de datos | MongoDB 8 (replica set de un nodo, necesario para transacciones) + Mongoose 8 |
| API | Node.js 24 + Express 5, TypeScript estricto, validación Zod 4 |
| Frontend | Angular 21 (standalone, signals, zoneless), Angular Material, ngx-translate (es/en/ca/pt/fr) |
| Tareas en segundo plano | Agenda 5 (cola persistida en MongoDB), proceso `worker` separado |
| Correo | Nodemailer (SMTP) tras la interfaz `MailProvider` (adaptadores `smtp`, `memory`, `disabled`) |
| IA | Interfaz `LlmProvider` (implementación en Fase 2) |
| Empaquetado | esbuild: API y worker en un único `.cjs` cada uno, sin `node_modules` en tiempo de ejecución |
| Tests | Vitest (unitarios e integración con `mongodb-memory-server`), Playwright (E2E) |
| Infraestructura | Servidor de pruebas: systemd + nginx. Producción prevista: Docker Compose + Caddy |

**Principio clave: IA acotada.** El orden de preguntas, las condiciones, los cálculos, los porcentajes y los permisos son
**código determinista y testeado** en `packages/shared`. La IA solo formulará preguntas, pedirá una aclaración como
máximo y clasificará respuestas (Fase 2).

**Configuración, no código.** Cuestionarios, tabla de mínimos, textos de correo y umbrales viven en la base de
datos, versionados, y se cambian sin redesplegar.

> Angular 21 en lugar de 22: el Node 25 del equipo de desarrollo no es compatible con Angular 22 (decisión 1).

---

## 6. Estructura del repositorio

```
apps/
  api/            Express: rutas, servicios, auth (enlace mágico), permisos, auditLogs
    src/models/   Las 13 colecciones de MongoDB
    src/routes/   auth, audit-entities, organizations, config, campaigns, participant
    src/services/ campaigns (cálculo, snapshot y acceso), organizations (asignación), sample (Excel/CSV, carga, códigos), users
    test/         Integración (MongoDB en memoria): auth, permisos, auditorías, config, privacidad, participante
  worker/         Agenda: job de purga de retención (apagado por defecto)
  web/            Angular: área interna (superadmins, coordinador, auditor) y página pública del participante
    public/i18n/  Traducciones es / en / ca / pt / fr
packages/
  shared/         Tipos, enums, esquemas Zod y TODA la lógica determinista (100 % de ramas testeadas)
  llm/            Interfaz LlmProvider
  mail/           MailProvider (SMTP, memoria, desactivado) y plantillas de correo por idioma con marca efr
infra/
  docker/         Dockerfiles (dev y producción)
  docker-compose.dev.yml, docker-compose.yml, Caddyfile, Caddyfile.dev
  server/         Servicios systemd, MongoDB propio y sitio nginx del servidor de pruebas
  scripts/        provision-server.sh, deploy-server.sh, deploy.sh, backup.sh, restore.sh
seed/
  data/           Cuestionario M1 v1, tabla de mínimos v1
  samples/        Archivos de muestra sintéticos válidos e inválidos
  seed-lib.ts     Semilla idempotente
scripts/          dev-local.ts (modo sin Docker), check-i18n.ts, smoke-bundle.ts
e2e/              Playwright (presentation/ genera las capturas de docs/presentacion)
docs/             decisiones.md, datos-sinteticos.md, marca.md
  presentacion/   Presentación con 27 capturas, informe de cambios 1 y 2, y cambios-pendientes.md (numera lo que falta por capturar)
design_handoff_smartaudit_marca_efr/   Manual de marca efr y referencia de diseño
```

---

## 7. Puesta en marcha en local

### Requisitos

- **Node.js 24 LTS** (funciona también con Node 25) y npm 11.
- Docker opcional (solo para la opción B).

### Opción A · Sin Docker (recomendada en este equipo)

MongoDB se ejecuta **en memoria** y los datos se pierden al parar. Ideal para probar.

```bash
npm install
npm run dev:local          # Terminal 1: API en http://localhost:3000 con MongoDB en memoria y semilla
npm start -w apps/web      # Terminal 2: Angular en http://localhost:4200 (proxy /api → :3000)
```

Abre http://localhost:4200. El enlace de acceso aparece en pantalla; también en http://localhost:3000/api/dev/outbox.
La primera vez `mongodb-memory-server` descarga un binario de MongoDB (puede tardar).

### Opción B · Con Docker

```bash
docker compose -f infra/docker-compose.dev.yml up
```

| Servicio | URL |
|---|---|
| Aplicación (Caddy → Angular + API) | http://localhost:8080 |
| Mailpit (correos) | http://localhost:8025 |
| API | http://localhost:3000/api/health |
| MongoDB (sin auth, solo desarrollo) | `mongodb://localhost:27017/smartaudit?directConnection=true` |

El servicio `seed` carga los datos sintéticos antes de arrancar la API.

> ⚠️ Esta opción **no se ha podido verificar** porque el equipo de desarrollo no tiene Docker.

---

## 8. Tests y calidad

```bash
npm test                   # shared (100 % ramas) + mail + API (integración) + worker + i18n
npm run test:shared        # solo packages/shared con cobertura
npm run e2e                # Playwright (arranca dev:local y Angular si no están levantados)
npm run smoke:bundle       # build de producción de la API y prueba de humo del bundle
npm run lint               # ESLint
npm run typecheck          # TypeScript estricto
npm run check:i18n         # mismas claves en es/en/ca/pt/fr y claves usadas existentes
```

| Suite | Contenido | Resultado actual |
|---|---|---|
| `packages/shared` | Tabla de mínimos (fronteras 90/91 … 16.000/16.001), días hábiles (lunes a viernes) y ventanas desde la fecha de comienzo (fin de semana, fin de año, cambio de hora), **máximo de completadas**, búsqueda sin acentos, idiomas disponibles, **motor de entrevista** (siguiente pregunta, botones, texto libre, una aclaración, umbral y revisión), **guardas de la IA** (reformulación, aclaración, instrucciones, datos personales), **planificación** (invitaciones, recordatorios, transiciones), avance y alertas, ampliación de ventana, validación de muestra, activación de preguntas, estados de auditoría, permisos, **acceso por asignación** (entidad, coordinador, auditor, traspaso de auditorías), códigos, retención, disponibilidad del participante | 186 tests · **100 % de ramas** |
| `packages/mail` | Plantillas por idioma (acceso, alta, **invitación**, **recordatorio**), marca, escape HTML, proveedores | 6 tests |
| `packages/llm` | Adaptador mock (clasificación por opciones y sinónimos en varios idiomas, aclaración neutral), registro de llamadas, validación del esquema | 6 tests |
| `apps/api` | Enlace mágico, selección de entidad, límites de peticiones, aislamiento entre entidades de auditoría, coordinador solo con agregado, asignación y traspaso de auditorías, auditorías (máximo y **cierre automático al alcanzarlo**), **listados paginados con búsqueda, filtros y orden**, carga de muestra, configuración versionada, **ningún correo en claro en la BD**, acceso con código; **Fase 2**: lanzar, invitaciones al abrir la ventana, enlace personal, entrevista completa (botones, abstención, P7.1/P8/P9), pausa y reanudación, aclaración y revisión, instrucciones a la IA nunca clasificadas, **ningún identificador enviado a la IA**, recordatorios, ampliación, cierre, límite diario y reintentos, proveedor «malicioso» neutralizado; **40 personas sintéticas** | 88 tests |
| `apps/worker` | Purga de retención (apagada / activada) | 2 tests |
| E2E (Playwright) | Superadmin crea entidad de auditoría con coordinador y organización asignada → coordinador crea auditor y lo designa → el superadmin la encuentra con la búsqueda y el filtro por entidad → auditor crea auditoría con máximo, sube muestra con errores, la corrige → `muestra_cargada` con mínimo, máximo y ventana correctos → el coordinador la encuentra con la búsqueda → coordinador solo ve el agregado; selección de entidad; acceso con código; **Fase 2**: el auditor lanza la auditoría, se abre la ventana, una persona entra con su enlace personal en un **móvil**, responde toda la entrevista (con pausa y reanudación) y el auditor ve el avance | 4 tests |
| i18n | 436 claves × 5 ficheros (4 idiomas ofrecidos; el catalán se conserva oculto) | OK |

E2E contra el servidor de pruebas:

```bash
E2E_BASE_URL=https://efr-staging.bumii.ai npm run e2e
```

Convenciones: TypeScript estricto, ESLint + Prettier, toda regla de negocio en `packages/shared` con tests, validación Zod
en todas las rutas, errores de API con formato uniforme `{ "error": { "code", "message", "details" } }`.

---

## 9. Servidor de pruebas (efr-staging.bumii.ai)

| | |
|---|---|
| URL | https://efr-staging.bumii.ai |
| Host | `ssh test2` (Ubuntu, 1 CPU, 2 GB, compartido con las apps Etapas) |
| HTTPS | Cloudflare (registro proxied). El origen solo acepta tráfico de Cloudflare |
| Modo | `NODE_ENV=staging`: endurecido como producción, **sin correo** (`MAIL_PROVIDER=disabled`) y **enlace de acceso en pantalla** |
| Datos | Solo sintéticos (semilla + datos creados por los tests E2E) |

### Componentes en el servidor (sin Docker)

| Componente | Detalle |
|---|---|
| `smartaudit-api.service` | API en `127.0.0.1:3100`, usuario `smartaudit`, límite 320 MB |
| `smartaudit-worker.service` | Worker Agenda, límite 220 MB |
| `mongod-smartaudit.service` | MongoDB propio en `127.0.0.1:27018`, replica set `rs0`, autenticación, límite 450 MB. **No toca el MongoDB de Etapas** |
| nginx | Sitio `/etc/nginx/sites-available/smartaudit` (bloque independiente) |
| Código | `/opt/smartaudit/releases/<versión>` y enlace `/opt/smartaudit/current` (se conservan 5 versiones) |
| Secretos | `/opt/smartaudit/shared/.env` (generados en el servidor; no salen de él) |

### Desplegar una nueva versión

```bash
infra/scripts/deploy-server.sh test2
```

Compila localmente API, worker y web, sube el paquete, aplica migraciones (y la semilla solo la primera vez), cambia
`current`, reinicia los servicios y comprueba `/api/health`.

### Clave de la IA (Gemini)

La clave **no está en `.env` ni en el repositorio**: es una credencial cifrada de systemd
(`/etc/credstore.encrypted/gemini_api_key`, solo root) que systemd descifra únicamente para `smartaudit-api`
(`ImportCredential=gemini_api_key`). Para ponerla o cambiarla:

```bash
infra/scripts/set-gemini-key.sh test2
```

Pide la clave sin mostrarla (no queda en el historial), la cifra en el servidor con `systemd-creds`, deja
`LLM_PROVIDER=gemini` y reinicia la API comprobando su salud. Si la clave no es válida, la entrevista sigue
funcionando: las preguntas se muestran con el texto oficial y las respuestas libres pasan a revisión del auditor.

### Operación

```bash
ssh test2 'sudo journalctl -u smartaudit-api -f'        # logs de la API
ssh test2 'sudo systemctl restart smartaudit-api'       # reiniciar
ssh test2 'systemctl status smartaudit-api smartaudit-worker mongod-smartaudit'
```

La preparación inicial (ya hecha, idempotente) está en `infra/scripts/provision-server.sh` con los ficheros de
`infra/server/`.

---

## 10. Despliegue en producción con Docker (previsto)

Para `efr.bumii.ai` (VPS en la UE) está preparado el despliegue con Docker Compose y Caddy (HTTPS automático):

```bash
infra/scripts/deploy.sh staging   # o prod (rechaza cambios sin commitear)
```

Ejecuta los tests, construye las imágenes (`infra/docker/app.Dockerfile`, targets `api`, `worker`, `web`), las copia
por SSH, levanta `infra/docker-compose.yml`, aplica migraciones y comprueba la salud. Configuración local en
`infra/.deploy.env` (no versionado): `STAGING_HOST`, `PROD_HOST`, `REMOTE_DIR`, `SSH_OPTS`.

**Backups:** `infra/scripts/backup.sh` (cron diario) hace `mongodump`, lo cifra con AES-256 (PBKDF2) y lo sube con
`rclone` a almacenamiento en la UE. Restauración: `infra/scripts/restore.sh <archivo.enc> [--drop]` (la prueba de
restauración es de la Fase 4).

> ⚠️ Esta vía **no se ha podido verificar** (sin Docker en el equipo de desarrollo).

---

## 11. Variables de entorno

Plantilla sin secretos: [.env.example](.env.example).

| Variable | Por defecto | Descripción |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test`, `staging` o `production` |
| `PORT` | `3000` | Puerto de la API |
| `MONGO_URL` | `mongodb://localhost:27017/smartaudit?replicaSet=rs0` | Conexión (replica set obligatorio) |
| `APP_URL` | `http://localhost:4200` | URL pública (para los enlaces de acceso) |
| `CORS_ORIGINS` | `http://localhost:4200` | Orígenes permitidos, separados por comas |
| `JWT_SECRET` | — (obligatoria, ≥ 32 car.) | Firma de la sesión |
| `FIELD_ENCRYPTION_KEY` | — (obligatoria) | 32 bytes en base64 para cifrar correos (AES-256-GCM) |
| `EMAIL_HASH_KEY` | — (obligatoria, ≥ 32 car.) | Clave HMAC para buscar correos sin descifrarlos |
| `MAIL_PROVIDER` | `smtp` | `smtp`, `memory` (local) o `disabled` (pruebas sin correo) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | `localhost` / `1025` / `false` | SMTP (Google Workspace en producción, Mailpit en desarrollo) |
| `MAIL_FROM_NAME` / `MAIL_FROM_ADDRESS` | `SmartAudit efr` / `no-reply@bumii.ai` | Remitente por defecto (también editable en Ajustes) |
| `COOKIE_SECURE` | `true` en staging/producción | Cookie de sesión solo por HTTPS |
| `TRUST_PROXY` | `false` | `true` detrás de nginx/Caddy (IP real para límites de peticiones) |
| `DEV_SHOW_MAGIC_LINK` | `false` | Muestra el enlace de acceso en pantalla. **Prohibido en producción** (la API no arranca) |
| `ENABLE_DEV_OUTBOX` | `false` | Buzón `/api/dev/outbox` (solo con `MAIL_PROVIDER=memory` y fuera de staging/producción) |
| `LLM_PROVIDER` | `mock` | Proveedor de IA: `mock` (determinista, desarrollo y tests) o `gemini` (Google Gemini) |
| `GEMINI_API_KEY` / `GEMINI_API_KEY_FILE` | — | Clave de Gemini. **En los servidores no se usan**: la clave es una credencial cifrada de systemd (ver §9) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Modelo de Gemini |
| `GEMINI_BASE_URL` | API pública de Gemini | Otro endpoint compatible (p. ej. regional) |
| `LLM_TIMEOUT_MS` | `15000` | Tiempo máximo por llamada a la IA |
| `LOG_LEVEL` | `info` | Nivel de logs (pino) |

Generar secretos:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT_SECRET, EMAIL_HASH_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"      # FIELD_ENCRYPTION_KEY
```

---

## 12. Modelo de datos

Todas las colecciones llevan `createdAt`/`updatedAt` y, si aplica, `organizationId`. La configuración tiene `version` y
una versión publicada no se edita.

| Colección | Contenido |
|---|---|
| `auditEntities` | Entidad de auditoría (certificadora): nombre, país, estado |
| `organizations` | Empresa efr auditada: nombre, país, zona horaria IANA, idioma por defecto, estado y **asignación** (`auditEntityId`, `coordinatorId`, `auditorId`, historial) |
| `users` | Correo **cifrado** + hash, rol, entidad de auditoría (nula en superadmins), estado, idioma. Único por (correo, entidad) |
| `magicLinkTokens` | Hash del token, usuarios, caducidad, uso |
| `samplingTables` | Versión, estado, tramos `{min, max, required, rangeMax}` |
| `questionnaires` | Módulo, versión, estado, idiomas con estado de aprobación, preguntas |
| `campaigns` | Módulo, organización, **entidad de auditoría** que la hace, `slug` público, configuración M1, **instantánea** de cuestionario y tabla, mínimo, ventana, estado e historial |
| `participantContacts` | **Colección separada**: correo cifrado, token de invitación y código de acceso (hash + copia cifrada), fila del archivo, envíos |
| `respondents` | Demográficos y estado (`pending`, `invited`, `started`, `completed`), `completedAt`. **Sin correo ni identificadores** |
| `interviews` | Entrevista: estado, mensajes, respuestas codificadas (Fase 2) |
| `reports` | Tablas calculadas, síntesis IA y editada, aprobación, archivos (Fase 3) |
| `auditLogs` | Actor, acción, recurso, fecha, IP |
| `settings` | Umbral de confianza, proveedor de IA, remitente, normas, plantillas de correo, retención |

---

## 13. Reglas de negocio implementadas

Todas en `packages/shared`, deterministas y con tests.

### Tabla de mínimos (v1) — sobre entrevistas **completadas**

| Población total | Mínimo |
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
| Más de 16.000 | El auditor fija entre 91 y 143 |

### Ventana de participación

- Abre el **día de comienzo de las entrevistas** (a las 09:00 hora local de la organización) y dura **10 días hábiles**:
  cierra a las **23:59 del 10.º día hábil**. Si la fecha cae en fin de semana, abre el siguiente día hábil (con aviso).
- Recordatorios en los días hábiles **4 y 8**, a las 09:00.
- Día hábil = **lunes a viernes**, en la zona horaria de la organización. Los festivos no se tienen en cuenta.

### Cuestionario M1 v1 y activación

P1–P10. Reglas declarativas evaluadas en código (nunca por la IA):

- **P7.1** solo si P7 ∈ {`ALGUNAS_VECES`, `SIEMPRE`}.
- **P8** solo en auditorías de **renovación**.
- **P9** solo si la organización **postula o mantiene excelencia**.
- P10 (comentarios) es opcional. Todas admiten «Prefiero no responder».

### Máximo de entrevistas completadas

- Por defecto es el **mínimo** de la tabla; el auditor puede subirlo, nunca por debajo del mínimo ni por encima de la
  población total. No lo limita la muestra cargada (se pueden añadir personas); la ficha avisa si el máximo la supera.
- Al alcanzarlo, la auditoría pasa de `en_curso` a **`finalizada`** (motivo `maximum_reached` en el historial) y los
  enlaces y códigos pendientes dejan de servir.

### Estados de la auditoría

`borrador` → `muestra_cargada` (programada) → `en_curso` (sola, al abrir la ventana) → `finalizada` (sola, al cerrar la
ventana o al alcanzar el máximo) → `informe_generado`. **Sin activación manual, suspensión ni cancelación** (grupo de
cambios 3). La configuración y la muestra se editan/reemplazan hasta que abre la ventana; en curso solo se pueden
**añadir** personas. `envios_activos`, `suspendida` y `cancelada` solo aparecen en auditorías anteriores a ese cambio.

### Archivo de muestra

| Columna | Obligatoria | Valores |
|---|---|---|
| `correo` | Sí | Email válido o `SIN_CORREO` |
| `sexo` | Sí | `Mujer`, `Hombre`, `Otro`, `No indica` |
| `tramo_edad` | Sí | `<30`, `30-40`, `41-50`, `51-60`, `>60` |
| `centro_trabajo` | Sí | Texto (se normaliza) |
| `tipo_puesto` | Sí | Texto (se normaliza) |
| `tramo_antiguedad` | No | `<2`, `2-5`, `6-10`, `>10` |
| `area` | No | Texto |
| `turnos`, `teletrabajo`, `hijos_o_dependientes`, `rlpt` | No | `Sí` / `No` |

Máximo 5.000 filas y 5 MB. Errores detectados: columna obligatoria ausente o repetida, columna desconocida, **columna
prohibida** (nombre, DNI, cédula, salario, sindicato, salud, baja, empleado, teléfono…), campo vacío, correo inválido o
duplicado, valor fuera de categoría, texto demasiado largo. **Si hay un solo error, no se carga nada.**

---

## 14. API

Prefijo `/api`. Sesión por cookie `httpOnly` (`sa_session`). Errores: `{ "error": { "code", "message", "details" } }`.

| Método y ruta | Quién | Descripción |
|---|---|---|
| `GET /health` | Público | Estado de la API y la base de datos |
| `POST /auth/magic-link` | Público | Solicita el enlace (siempre 202; `devLink` en pruebas) |
| `POST /auth/verify` | Público | Consume el enlace → sesión o elección de entidad de auditoría |
| `GET /auth/accounts` · `POST /auth/select` | Con selección pendiente | Elegir entidad de auditoría |
| `GET /auth/me` · `PATCH /auth/me` · `POST /auth/logout` | Con sesión | Usuario actual, idioma, salir |
| `GET/POST /audit-entities` · `GET/PATCH /audit-entities/:entityId` | Superadmins | Entidades de auditoría |
| `GET/POST /audit-entities/:entityId/coordinators` · `PATCH …/coordinators/:userId` | Superadmins | Coordinadores |
| `GET/POST /audit-entities/:entityId/auditors` · `PATCH …/auditors/:userId` | Superadmins, coordinador (la suya) | Auditores |
| `GET/POST /organizations` · `GET/PATCH /organizations/:orgId` | Superadmins | Organizaciones |
| `PUT /organizations/:orgId/assignment` | Superadmins | Entidad de auditoría y coordinador |
| `GET /organizations/:orgId/assignable-auditors` · `PUT /organizations/:orgId/auditor` | Superadmins, coordinador de la organización | Auditor responsable (traspasa las auditorías abiertas) |
| `GET /assigned-organizations` | Coordinador, auditor | Organizaciones asignadas |
| `/config/sampling-tables[/:id[/publish]]` | Superadmins | Tabla de mínimos versionada |
| `/config/questionnaires[/:id[/new-version · /publish · /languages/:lang/approve]]` | Superadmins | Cuestionarios |
| `GET/PUT /config/settings` | Superadmins (los ajustes técnicos solo Bumii, vía API) | Ajustes |
| `GET /campaigns` · `GET /campaigns/:id` | Auditor (las suyas), coordinador (agregado), superadmins | Listado paginado y detalle con `access` (`manage`, `aggregate`, `supervise`) |
| `GET /campaigns/options` · `POST /campaigns/preview` · `POST /campaigns` · `PUT /campaigns/:id` | Auditor de la organización | Opciones (incluye sus organizaciones), vista previa del cálculo, crear (`organizationId`), editar |
| `GET /campaigns/sample-template?format=xlsx\|csv` | Auditor | Plantilla de muestra |
| `POST /campaigns/:id/sample?mode=replace\|append` | Auditor | Subir muestra (multipart `file`) |
| `GET /campaigns/:id/sample/summary` | Auditor | Resumen de la muestra |
| `GET /campaigns/:id/access-codes?format=xlsx\|csv` | Auditor | Códigos de acceso (registrado en `auditLogs`) |
| `GET /participant/c/:slug` · `POST /participant/c/:slug/access` | Público | Landing con código; abre la sesión del participante |
| `POST /participant/i/:token` | Público | Enlace personal de invitación; abre la sesión del participante |
| `GET /participant/session` | Participante | Disponibilidad, idiomas, ventana y estado de su entrevista |
| `POST /participant/interview/start` · `GET /participant/interview` | Participante | Empezar (aviso aceptado + idioma) o reanudar |
| `POST /participant/interview/answer` | Participante | Responder: `options`, `abstain` o `text` |
| `GET /campaigns/:id/progress` | Auditor, coordinador (agregado), superadmins | Avance, alertas y estado por persona (fila del archivo) |
| `POST /campaigns/:id/window/extend` | Auditor | Ampliar la ventana (`closeDate`, `reason`) |
| `POST /dev/tick` · `POST /dev/campaigns/:id/open-now` | Solo modo local en memoria | Ejecutar el planificador / abrir la ventana ya |
| `GET /dev/outbox` | Solo modo local en memoria | Correos enviados (desarrollo) |

**Listados paginados** (`GET /organizations`, `GET /assigned-organizations`, `GET /campaigns`) responden
`{ items, total, page, pageSize }` y aceptan `q` (búsqueda sin mayúsculas ni acentos), `page` (desde 1), `pageSize`
(10, 25, 50, 100; por defecto 25), `sort` y `dir` (`asc`/`desc`). Además: organizaciones `auditEntityId` (o `none`) y
`status`; auditorías `status` (`open`, `closed` o un estado) y `organizationId`. `sort` en auditorías: `createdAt`
(por defecto, más recientes primero), `reference`, `organization`, `interviewStartDate`, `status`.

---

## 15. Privacidad y seguridad

- **Nunca se captan** nombre, documento de identidad, número de empleado, salario, afiliación sindical, datos de salud
  ni motivos de baja. La plantilla de muestra rechaza columnas que lo parezcan.
- **Ningún correo en claro en la base de datos** (usuarios y participantes): cifrado AES-256-GCM + HMAC para búsquedas.
  Un test recorre todas las colecciones para comprobarlo.
- Las respuestas se relacionan con **demográficos, nunca con la identidad**; el vínculo correo ↔ persona está en una
  colección separada que solo sirve para invitar y marcar el estado.
- La empresa auditada **no tiene acceso** a la plataforma; el coordinador de la entidad de auditoría tampoco ve quién
  respondió ni qué respondió (salvo que actúe como auditor de esa organización).
- Enlaces mágicos de un solo uso, 15 minutos, guardados como hash. Sesión JWT de 8 horas con renovación, cookie
  `httpOnly`, `Secure`, `SameSite=Lax`.
- Límites de peticiones: enlace mágico (30 por IP y 5 por correo cada 15 min), verificación (60 por IP) y códigos de
  participante (10 fallos por IP cada 15 min → bloqueo temporal).
- Cabeceras de seguridad (helmet + CSP en nginx/Caddy), CORS restringido, logs sin datos personales.
- Retención indefinida por defecto; job de purga construido y **apagado**.
- El enlace en pantalla (`DEV_SHOW_MAGIC_LINK`) hace que, en el servidor de pruebas, cualquiera que conozca un correo de
  usuario pueda entrar: por eso **solo datos sintéticos**.

---

## 16. Marca efr

La interfaz, los correos y los Excel siguen el **Manual de identidad corporativa efr 2025**
(`design_handoff_smartaudit_marca_efr/`). Detalle en [docs/marca.md](docs/marca.md).

- Naranja `#FF6600` (títulos, acentos, botón primario), gris oscuro `#333333` (texto), gris medio `#999999` (metadatos).
- Arial (Verdana para valores técnicos). Títulos en negrita, naranja y **minúsculas**.
- Estética plana: sin radios, sin sombras, sin iconos, sin bordes laterales.
- Claim principal: **«efr es conciliación»**.
- **Pendiente:** logotipos oficiales y sello técnico (hoy se muestra «efr» en Arial Bold como marcador). Se conectan en
  `apps/web/src/app/core/brand.ts`.
- **Conflicto abierto:** el contraste del naranja (3,0:1) no cumple WCAG AA para texto normal; requiere decisión.

---

## 17. Internacionalización

Cuatro idiomas disponibles en la interfaz interna, la página del participante y los correos:

| Código | Idioma | Formato de fechas |
|---|---|---|
| `es` | Español | es-ES |
| `en` | Inglés | en-GB |
| `pt` | **Portugués de Portugal** | pt-PT |
| `fr` | Francés | fr-FR |

El **catalán (`ca`) no se ofrece** (decisión 66): no aparece en el selector de idioma ni puede elegirse para
organizaciones, usuarios ni auditorías, y nunca se ofrece a participantes. Se conservan sus traducciones y los textos del
cuestionario por si se reactiva (`AVAILABLE_LANGUAGES` en `packages/shared/src/enums.ts` y `LANGS` en la web).

La interfaz detecta el idioma del navegador y permite cambiarlo; los usuarios guardan su idioma preferido. **Ningún
texto visible está escrito directamente en el código** (`apps/web/public/i18n/<idioma>.json`). El cuestionario tiene
textos en los cinco idiomas; solo el español está aprobado y el resto está **pendiente de aprobación por la Fundación**
(no se ofrecen a participantes hasta entonces).

Para añadir otro idioma: código en `LANGUAGES` (`packages/shared/src/enums.ts`) y `LANGS` (`apps/web/src/app/core/models.ts`),
fichero `public/i18n/<código>.json`, plantillas de correo (`packages/mail/src/templates.ts`), etiquetas de rol
(`apps/api/src/services/users.ts`), locale de fechas (`tz-date.pipe.ts`), textos del cuestionario en la semilla y
`npm run check:i18n`.

---

## 18. Datos sintéticos de la semilla

La semilla (`seed/seed-lib.ts`, idempotente) carga:

- Cuestionario M1 **v1** publicado (español aprobado; inglés, catalán, portugués y francés pendientes). En bases de
  datos anteriores a portugués y francés, la semilla publica una versión nueva que los añade.
- Tabla de mínimos **v1** publicada.
- Tabla maestra de **entidades de auditoría** (lista real facilitada por F+f): AENOR, APCER, AUDELCO, CMD, DNV, EDUQATIA,
  ICONTEC, LOT y SGS. Los superadmins pueden añadir más. Los usuarios de prueba están en **ICONTEC** (CO) y **AENOR** (ES).
- Organizaciones **Andina Servicios S.A.S.** y **Costa Alimentos S.A.S.** (CO, America/Bogota; asignadas a ICONTEC) e
  **Ibérica Logística S.L.** y **Montaña Textil S.L.** (ES, Europe/Madrid; asignadas a AENOR), todas sintéticas.
- Los usuarios de la [tabla de la sección 1](#usuarios-de-prueba-semilla-sintética).

```bash
npm run seed               # contra MONGO_URL (requiere las claves de cifrado del entorno)
```

Más información en [docs/datos-sinteticos.md](docs/datos-sinteticos.md).

---

## 19. Hoja de ruta y pendientes

| Fase | Contenido | Estado |
|---|---|---|
| **1** · Base, configuración y muestra | Monorepo, modelo de datos, auth, permisos, configuración, auditorías, muestra, códigos, i18n, marca | ✅ Hecha |
| **2** · Invitaciones y motor conversacional | Envío de invitaciones, enlace `/i/<token>`, chat con IA, clasificación, recordatorios, transiciones automáticas, panel de avance | ✅ Hecha. IA: Google Gemini (falta poner la clave real) |
| **3** · Codificación, revisión e informes | Revisión de dudosas, resultados, síntesis IA, Word/Excel/PDF | ⏳ |
| **4** · Piloto y producción | Concordancia IA–auditor, endurecimiento, carga, restauración de backup, `efr.bumii.ai` | ⏳ |

Pendientes y decisiones abiertas (detalle en [docs/decisiones.md](docs/decisiones.md)):

- **Clave real de Gemini** en el servidor (hoy hay una ficticia) y revisar las condiciones de uso de datos del plan
  contratado (sin entrenamiento con los datos; para procesar en la UE, Gemini en Vertex AI con región europea).
- Logotipos oficiales efr y sello técnico.
- Contraste del naranja frente a WCAG AA.
- Traducciones oficiales del cuestionario (en, pt, fr).
- Contacto de protección de datos para el aviso al participante.
- Plazo de conservación de datos (RGPD).
- Integración de correo (SMTP Google Workspace).
- Verificar los Compose de Docker en un equipo con Docker.

---

## 20. Solución de problemas

| Síntoma | Causa probable y solución |
|---|---|
| No aparece el enlace en pantalla | El correo no tiene cuenta activa, o el entorno no tiene `DEV_SHOW_MAGIC_LINK=true` |
| «El enlace no es válido, ya se ha usado o ha caducado» | Cada enlace es de un solo uso y dura 15 minutos: solicita otro |
| En local, los datos han desaparecido | El modo `dev:local` usa MongoDB en memoria: se reinicia al parar la API |
| Los tests de integración tardan en arrancar | Primera descarga del binario de MongoDB, o arranque lento bajo Rosetta (Mac con chip Apple) |
| La API no arranca: «not allowed» en producción | `DEV_SHOW_MAGIC_LINK`, `ENABLE_DEV_OUTBOX` o un proveedor de correo distinto de `smtp` en producción |
| La carga de muestra falla con error de transacción | MongoDB no está en modo replica set |
| «Demasiados intentos fallidos» en la página del código | Bloqueo temporal de 15 minutos tras 10 fallos desde la misma IP |
| El servidor de pruebas no responde | `ssh test2 'systemctl status smartaudit-api mongod-smartaudit'` y `journalctl -u smartaudit-api -n 50` |

---

SmartAudit efr · **powered by Bumii** · efr es conciliación · [www.soyefr.org](https://www.soyefr.org)
