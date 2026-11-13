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

### Usuarios de prueba (semilla sintética)

Todos son ficticios y usan dominios `.example` reservados (RFC 2606): ningún correo llega a personas reales.
Existen tanto en local como en el servidor de pruebas.

| Correo | Rol | Organización | Qué puede hacer |
|---|---|---|---|
| `superadmin.bumii@bumii.example` | `SUPERADMIN_BUMII` | — (plataforma) | Todo lo de superadmin + ajustes técnicos (proveedor de IA, umbrales, retención) |
| `superadmin.fundacion@masfamilia.example` | `SUPERADMIN_FUNDACION` | — (plataforma) | Organizaciones y sus administradores, configuración (tabla de mínimos, cuestionarios, festivos), ver/suspender/cancelar campañas |
| `admin@andina.example` | `ORG_ADMIN` | Andina Servicios S.A.S. (sintética) · Colombia | Crear y desactivar auditores de su organización |
| `admin@iberica.example` | `ORG_ADMIN` | Ibérica Logística S.L. (sintética) · España | Crear y desactivar auditores de su organización |
| `auditor1@auditoria.example` | `AUDITOR` | **Ambas organizaciones** | Al entrar **elige organización**; crea campañas y sube muestras |
| `auditor2@auditoria.example` | `AUDITOR` | Ibérica Logística S.L. (sintética) | Crea campañas y sube muestras |

**Participantes sin correo:** no tienen cuenta. Entran por `https://<dominio>/c/<campaña>` con un **código de 8
caracteres** que el auditor descarga tras subir la muestra (ver [paso 4.6](#46-acceso-de-una-persona-sin-correo)).

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

### Módulos del producto

| Módulo | Propósito | Gestiona la campaña | Estado |
|---|---|---|---|
| **M1 · Auditoría** | Entrevistas a la plantilla durante auditorías efr | Auditor | **En construcción** (Fase 1 hecha) |
| M2 · Eficacia | Evaluar medidas de conciliación (anexo 1000-16) | Empresa efr | Previsto (interfaces vacías declaradas) |
| M3 · Diagnóstico | Voz del empleado y de la dirección (anexo 1000-12) | Fundación / consultor | Previsto (interfaces vacías declaradas) |

### Funcionalidades disponibles hoy

- **Acceso por enlace mágico** (sin contraseñas): un solo uso, caduca a los 15 minutos. Si un correo tiene cuentas en
  varias organizaciones, se elige a cuál entrar. En entornos de prueba el enlace aparece en pantalla.
- **Superadmins:** gestión de organizaciones (país, zona horaria, idioma) y de sus administradores; configuración
  versionada de la **tabla de mínimos**, el **cuestionario M1** (con aprobación por idioma) y los **festivos**; ajustes.
- **Administrador de organización:** gestión de los auditores de su organización. Nunca ve muestras ni respuestas.
- **Auditor:**
  - Crea y edita campañas M1 con **cálculo automático** del mínimo de entrevistas completadas, la **ventana de
    participación** (10 días hábiles con festivos del país) y las **preguntas activadas**.
  - Descarga la plantilla de muestra (Excel/CSV), la sube y ve **errores fila a fila** (si hay errores no se carga nada).
  - Ve el resumen de la muestra: valores distintos de centro y tipo de puesto, distribución por sexo y edad, avisos de
    muestra insuficiente y de grupos pequeños (riesgo de reidentificación).
  - Descarga los **códigos de acceso** de las personas sin correo.
  - Suspende, reanuda o cancela campañas.
- **Participante sin correo:** página pública `/c/<campaña>` que pide el código, muestra el aviso previo, la elección de
  idioma y cuándo abre la entrevista.

### Lo que todavía no existe (fases siguientes)

Envío de invitaciones y recordatorios por correo, la **entrevista con IA** (chat), la revisión de respuestas dudosas,
el cálculo de resultados y la exportación del informe (Word/Excel/PDF). Ver [hoja de ruta](#19-hoja-de-ruta-y-pendientes).

---

## 3. Roles y permisos

| Acción | Superadmins | ORG_ADMIN | AUDITOR | Participante |
|---|---|---|---|---|
| Crear organizaciones y su ORG_ADMIN | ✅ | — | — | — |
| Crear/desactivar auditores de la organización | ✅ | ✅ (solo la suya) | — | — |
| Gestionar cuestionarios, tabla de mínimos, festivos | ✅ | — | — | — |
| Ajustes técnicos (IA, umbrales, retención) | Solo `SUPERADMIN_BUMII` | — | — | — |
| Crear y configurar campañas M1 | Ver, suspender y cancelar todas | — | ✅ (las suyas) | — |
| Cargar y validar la muestra, descargar códigos | — | — | ✅ | — |
| Ver respuestas, muestra o quién respondió | ✅ (Fase 3) | ❌ **nunca** | ✅ (Fase 3) | — |
| Responder la entrevista | — | — | — | ✅ (solo la suya) |

Reglas transversales:

- **Aislamiento por organización** en todas las consultas. Un recurso de otra organización responde **404** (no se
  revela su existencia).
- **Cada campaña solo la ve y la gestiona el auditor que la creó** (no hay auditores colaboradores). Los superadmins las
  ven todas.
- Los guards de Angular solo controlan la navegación; **la autorización siempre la aplica la API**.
- Las acciones administrativas, cambios de configuración y exportaciones quedan registradas en `auditLogs`.

---

## 4. Recorrido de uso paso a paso

### 4.1 Entrar

1. Abre la URL del entorno e introduce un correo de la [tabla de usuarios](#usuarios-de-prueba-semilla-sintética).
2. Pulsa **«enviar enlace de acceso»**. En entornos de prueba aparece el recuadro **«entorno de pruebas»**: pulsa
   **«entrar con el enlace»** (o copia la URL que aparece debajo).
3. Con `auditor1@auditoria.example` aparecerá **«elige la organización»**.

### 4.2 Superadmin: crear una organización y su administrador

1. Entra con `superadmin.fundacion@masfamilia.example` → **Organizaciones** → **nueva organización**.
2. Rellena nombre, país (rellena la zona horaria), idioma por defecto y, opcionalmente, el correo del administrador.
3. En la ficha de la organización puedes editar sus datos, activarla/desactivarla y gestionar administradores y auditores.

### 4.3 Superadmin: configuración

En **Configuración** hay cuatro pestañas. Toda la configuración está **versionada**: una versión publicada no se edita,
se crea una nueva (solo puede haber un borrador a la vez). Las campañas guardan la versión con la que se crearon.

- **Tabla de mínimos:** tramos «desde / hasta / mínimo de completadas / máximo elegible por el auditor». Se valida antes
  de publicar (contigüidad, último tramo sin límite…).
- **Cuestionarios:** versiones del cuestionario M1, textos por idioma, reglas de activación legibles, **aprobación por
  idioma** (solo los idiomas aprobados se ofrecen a participantes) y edición avanzada de la estructura en JSON validado.
- **Festivos:** calendario por país y año generado con `date-holidays`, con sobrescrituras manuales (añadir un festivo o
  marcar un oficial como laborable).
- **Ajustes:** remitente de correo, normas disponibles y, solo para Bumii, confianza mínima de la IA, proveedor de IA y
  retención de datos (apagada por defecto).

### 4.4 Administrador de organización: crear auditores

Entra con `admin@andina.example` → **Auditores** → escribe el correo y el idioma → **añadir**. Puede desactivar y
reactivar auditores. No ve campañas, muestras ni respuestas.

### 4.5 Auditor: crear una campaña y cargar la muestra

1. Entra con `auditor2@auditoria.example` (o `auditor1` eligiendo organización) → **Campañas** → **nueva campaña**.
2. Rellena: referencia (opcional), norma (`1000-1` / `1000-2`), tipo de auditoría (inicial, mantenimiento, renovación),
   fecha de la visita, **población total**, mánager efr (solo referencia), si postula a excelencia e idiomas.
3. El panel **«2. cálculo automático»** muestra en vivo el mínimo de completadas, la ventana (apertura, cierre y
   recordatorios) y qué preguntas se harán. Con más de 16.000 personas hay que fijar el mínimo entre 91 y 143.
4. **Crear** → ficha de la campaña (estado *Borrador*).
5. En **«3. muestra»** descarga la plantilla, sube el archivo:
   - Con errores: tabla de errores por fila y columna; no se carga nada.
   - Correcto: la campaña pasa a **Muestra cargada**; se generan los tokens de invitación (personas con correo) y los
     códigos de acceso (personas `SIN_CORREO`).
6. Revisa el resumen y pulsa **«descargar códigos de acceso»** (Excel o CSV): fila del archivo original, código, centro,
   tipo de puesto y enlace. Mientras la campaña está en *Borrador* o *Muestra cargada* se puede **reemplazar** la muestra.

### 4.6 Acceso de una persona sin correo

1. Abre el enlace del archivo de códigos (`https://<dominio>/c/<campaña>`).
2. Escribe el código (da igual mayúsculas, minúsculas, espacios o guiones) → **continuar**.
3. Código correcto: se muestra cuándo abre y cierra la entrevista, el aviso previo (uso de IA, finalidad,
   confidencialidad, derecho a no responder, contacto) y la elección de idioma.
4. El botón **«empezar la entrevista»** está deshabilitado: la entrevista es de la Fase 2. En las pruebas verás siempre
   «aún no está abierta» porque las campañas todavía no se pueden lanzar.
5. Tras **10 intentos fallidos en 15 minutos** desde la misma IP, se bloquea temporalmente.

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

**Configuración, no código.** Cuestionarios, tabla de mínimos, festivos, textos de correo y umbrales viven en la base de
datos, versionados, y se cambian sin redesplegar.

> Angular 21 en lugar de 22: el Node 25 del equipo de desarrollo no es compatible con Angular 22 (decisión 1).

---

## 6. Estructura del repositorio

```
apps/
  api/            Express: rutas, servicios, auth (enlace mágico), permisos, auditLogs
    src/models/   Las 13 colecciones de MongoDB
    src/routes/   auth, organizations, config, campaigns, participant
    src/services/ campaigns (cálculo y snapshot), sample (Excel/CSV, carga, códigos), users
    test/         Integración (MongoDB en memoria): auth, permisos, campañas, config, privacidad, participante
  worker/         Agenda: job de purga de retención (apagado por defecto)
  web/            Angular: área interna (superadmins, admin, auditor) y página pública del participante
    public/i18n/  Traducciones es / en / ca
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
e2e/              Playwright
docs/             decisiones.md, datos-sinteticos.md, marca.md
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
| `packages/shared` | Tabla de mínimos (fronteras 90/91 … 16.000/16.001), días hábiles y ventanas con festivos CO/ES, fin de año, cambio de hora, validación de muestra, activación de preguntas, estados de campaña, permisos, códigos, retención, disponibilidad del participante | 129 tests · **100 % de ramas** |
| `packages/mail` | Plantillas por idioma, marca, escape HTML, proveedores | 6 tests |
| `apps/api` | Enlace mágico, selección de organización, límites de peticiones, aislamiento entre organizaciones, ORG_ADMIN sin acceso a muestras, campañas, carga de muestra, configuración versionada, **ningún correo en claro en la BD**, acceso con código | 53 tests |
| `apps/worker` | Purga de retención (apagada / activada) | 2 tests |
| E2E (Playwright) | Superadmin crea organización y admin → admin crea auditor → auditor crea campaña, sube muestra con errores, la corrige → `muestra_cargada` con mínimo y ventana correctos; selección de organización; acceso con código | 3 tests (local y servidor de pruebas) |
| i18n | 333 claves × 5 idiomas | OK |

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
| `organizations` | Nombre, país, zona horaria IANA, idioma por defecto, estado |
| `users` | Correo **cifrado** + hash, rol, organización (nula en superadmins), estado, idioma. Único por (correo, organización) |
| `magicLinkTokens` | Hash del token, usuarios, caducidad, uso |
| `samplingTables` | Versión, estado, tramos `{min, max, required, rangeMax}` |
| `holidayCalendars` | País, año, versión, fechas oficiales, sobrescrituras, fechas efectivas |
| `questionnaires` | Módulo, versión, estado, idiomas con estado de aprobación, preguntas |
| `campaigns` | Módulo, organización, `slug` público, configuración M1, **instantánea** de cuestionario, tabla y festivos, mínimo, ventana, estado e historial |
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

- Abre **10 días hábiles antes de la visita** (a las 09:00 hora local de la organización) y cierra a las **23:59 del día
  hábil anterior** a la visita.
- Recordatorios en los días hábiles **4 y 8**, a las 09:00.
- Día hábil = lunes a viernes menos festivos del país (calendario publicado o, si no existe, `date-holidays`).

### Cuestionario M1 v1 y activación

P1–P10. Reglas declarativas evaluadas en código (nunca por la IA):

- **P7.1** solo si P7 ∈ {`ALGUNAS_VECES`, `SIEMPRE`}.
- **P8** solo en auditorías de **renovación**.
- **P9** solo si la organización **postula o mantiene excelencia**.
- P10 (comentarios) es opcional. Todas admiten «Prefiero no responder».

### Estados de la campaña

`borrador` → `muestra_cargada` → `envios_activos` → `en_curso` → `finalizada` → `informe_generado`, más `suspendida` y
`cancelada` desde `borrador`, `muestra_cargada`, `envios_activos` y `en_curso`. Una suspendida solo se reanuda al estado
anterior. La configuración y la muestra solo se editan/reemplazan en `borrador` y `muestra_cargada`; en curso solo se
pueden **añadir** personas.

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
| `POST /auth/verify` | Público | Consume el enlace → sesión o elección de organización |
| `GET /auth/accounts` · `POST /auth/select` | Con selección pendiente | Elegir organización |
| `GET /auth/me` · `PATCH /auth/me` · `POST /auth/logout` | Con sesión | Usuario actual, idioma, salir |
| `GET/POST /organizations` · `GET/PATCH /organizations/:orgId` | Superadmins | Organizaciones |
| `GET/POST /organizations/:orgId/admins` · `PATCH …/admins/:userId` | Superadmins | Administradores de la organización |
| `GET/POST /organizations/:orgId/auditors` · `PATCH …/auditors/:userId` | Superadmins, ORG_ADMIN (la suya) | Auditores |
| `/config/sampling-tables[/:id[/publish]]` | Superadmins | Tabla de mínimos versionada |
| `/config/questionnaires[/:id[/new-version · /publish · /languages/:lang/approve]]` | Superadmins | Cuestionarios |
| `/config/holidays[/:id[/publish]]` | Superadmins | Festivos |
| `GET/PUT /config/settings` | Superadmins (técnicos solo Bumii) | Ajustes |
| `GET /campaigns` · `GET /campaigns/:id` | Auditor (las suyas), superadmins | Listado y detalle |
| `GET /campaigns/options` · `POST /campaigns/preview` · `POST /campaigns` · `PUT /campaigns/:id` | Auditor | Opciones, vista previa del cálculo, crear, editar |
| `POST /campaigns/:id/status` | Auditor, superadmins | Suspender, reanudar, cancelar |
| `GET /campaigns/sample-template?format=xlsx\|csv` | Auditor | Plantilla de muestra |
| `POST /campaigns/:id/sample?mode=replace\|append` | Auditor | Subir muestra (multipart `file`) |
| `GET /campaigns/:id/sample/summary` | Auditor | Resumen de la muestra |
| `GET /campaigns/:id/access-codes?format=xlsx\|csv` | Auditor | Códigos de acceso (registrado en `auditLogs`) |
| `GET /participant/c/:slug` · `POST /participant/c/:slug/access` | Público | Página del participante y validación del código |
| `GET /dev/outbox` | Solo modo local en memoria | Correos enviados (desarrollo) |

---

## 15. Privacidad y seguridad

- **Nunca se captan** nombre, documento de identidad, número de empleado, salario, afiliación sindical, datos de salud
  ni motivos de baja. La plantilla de muestra rechaza columnas que lo parezcan.
- **Ningún correo en claro en la base de datos** (usuarios y participantes): cifrado AES-256-GCM + HMAC para búsquedas.
  Un test recorre todas las colecciones para comprobarlo.
- Las respuestas se relacionan con **demográficos, nunca con la identidad**; el vínculo correo ↔ persona está en una
  colección separada que solo sirve para invitar y marcar el estado.
- La empresa (ORG_ADMIN) **nunca** ve quién respondió ni qué respondió.
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

Cinco idiomas en la interfaz interna, la página del participante y los correos:

| Código | Idioma | Formato de fechas |
|---|---|---|
| `es` | Español | es-ES |
| `en` | Inglés | en-GB |
| `ca` | Catalán | ca-ES |
| `pt` | **Portugués de Portugal** | pt-PT |
| `fr` | Francés | fr-FR |

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
- Festivos de Colombia y España 2026–2027 publicados.
- Organizaciones **Andina Servicios S.A.S. (sintética)** (CO, America/Bogota) e **Ibérica Logística S.L. (sintética)**
  (ES, Europe/Madrid).
- Los usuarios de la [tabla de la sección 1](#usuarios-de-prueba-semilla-sintética).

```bash
npm run seed               # contra MONGO_URL (requiere las claves de cifrado del entorno)
```

Más información en [docs/datos-sinteticos.md](docs/datos-sinteticos.md).

---

## 19. Hoja de ruta y pendientes

| Fase | Contenido | Estado |
|---|---|---|
| **1** · Base, configuración y muestra | Monorepo, modelo de datos, auth, permisos, configuración, campañas, muestra, códigos, i18n, marca | ✅ Hecha |
| **2** · Invitaciones y motor conversacional | Envío de invitaciones, enlace `/i/<token>`, chat con IA, clasificación, recordatorios, transiciones automáticas, panel de avance | ⏳ Página `/c/<campaña>` adelantada; el resto pendiente |
| **3** · Codificación, revisión e informes | Revisión de dudosas, resultados, síntesis IA, Word/Excel/PDF | ⏳ |
| **4** · Piloto y producción | Concordancia IA–auditor, endurecimiento, carga, restauración de backup, `efr.bumii.ai` | ⏳ |

Pendientes y decisiones abiertas (detalle en [docs/decisiones.md](docs/decisiones.md)):

- Proveedor de IA definitivo (Fase 2).
- Logotipos oficiales efr y sello técnico.
- Contraste del naranja frente a WCAG AA.
- Traducciones oficiales del cuestionario (en, ca).
- Contacto de protección de datos para el aviso al participante.
- Plazo de conservación de datos (RGPD).
- Integración de correo (SMTP Google Workspace).
- Verificar los Compose de Docker en un equipo con Docker.
- `CLAUDE.md` aún menciona «marca del certificado» y «auditores colaboradores», ya retirados del producto.

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
