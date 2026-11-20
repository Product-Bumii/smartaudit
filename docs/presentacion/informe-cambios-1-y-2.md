# SmartAudit efr · informe de cambios 1 y 2

**Fecha:** 19 de noviembre de 2026
**Para:** Fundación Másfamilia (F+f) y equipo Bumii
**Versión en el servidor de pruebas:** https://efr-staging.bumii.ai (desde el 18 de noviembre)
**Capturas:** [`img/`](img/), recorrido completo en la [presentación](README.md)

Este informe resume los dos bloques de cambios que la Fundación pidió tras revisar la Fase 1, cómo quedan en la
plataforma y qué captura muestra cada uno. Todo está probado (tests automáticos y recorrido completo de punta a punta)
y desplegado en el servidor de pruebas.

---

## En una página

| # | Qué se pidió | Qué hace ahora la plataforma | Capturas |
|---|---|---|---|
| 1 | Que la gestión la hagan las **entidades de auditoría**, no las empresas | La Fundación asigna cada organización a una entidad y un **coordinador**; el coordinador designa el **auditor** | 03, 04, 05, 08, 11–14 |
| 2a | Llamar **«auditorías»** a las campañas | Todos los textos de la interfaz usan «auditoría» | 16, 18, 21, 25 |
| 2b | **Fecha de comienzo de las entrevistas** en vez de fecha de la visita | La ventana abre ese día y dura 10 días hábiles | 16, 18 |
| 2c | **Número máximo de respuestas** y cierre al alcanzarlo | Campo «máximo de entrevistas completadas»; al alcanzarlo la auditoría se cierra sola | 16, 17, 18 |
| 2d | **No ofrecer el catalán** | Desaparece de todos los selectores; quedan español, inglés, portugués y francés | 01, 16 |
| 2e | **Empresa auditora** en un desplegable administrable | Tabla maestra con las 9 entidades reales, ampliable por la Fundación | 04, 05, 08 |
| 2f | **Encontrar organizaciones y auditorías** sin hacer scroll en listas de cientos de filas | Buscador, filtros, orden por columnas y páginas en todos los listados | 06, 07, 11, 21, 25 |

---

## Cambio 1 · Perfiles por entidad de auditoría

**Qué se pidió.** La Fundación propuso que el antiguo «administrador de la organización» fuese el **coordinador de
auditorías de una entidad auditora** (ICONTEC, AENOR, SGS…), que asigna los auditores a cada empresa.

**Cómo queda.**

- **Superadministración (Fundación y Bumii):** crea las entidades de auditoría y sus coordinadores, crea las
  organizaciones y las asigna a una entidad y a uno de sus coordinadores ([04](img/04-superadmin-entidades-de-auditoria.png),
  [05](img/05-superadmin-ficha-entidad.png), [08](img/08-superadmin-ficha-organizacion.png)).
- **Coordinación:** ve solo las organizaciones que tiene asignadas, da de alta a sus auditores y designa el auditor de
  cada organización; puede asignarse a sí misma ([11](img/11-coordinador-mis-organizaciones.png),
  [12](img/12-coordinador-designar-auditor.png), [13](img/13-coordinador-auditores.png)).
- **Auditor/a:** ve las organizaciones que le han asignado y crea sus auditorías
  ([15](img/15-auditor-mis-organizaciones.png)).
- **La empresa auditada no tiene acceso** a la plataforma.

**Reglas acordadas con la Fundación.**

| Pregunta | Respuesta aplicada |
|---|---|
| ¿Puede una entidad tener varios coordinadores? | Sí; cada uno ve solo las organizaciones que tiene asignadas |
| ¿Tiene acceso la empresa auditada? | No, en esta versión |
| Si cambia el auditor de una organización, ¿qué pasa con sus auditorías abiertas? | Pasan al nuevo auditor; el cambio queda registrado |
| Si una organización cambia de entidad, ¿qué pasa con sus auditorías anteriores? | Se quedan con la entidad que las hizo. Solo se puede cambiar de entidad sin auditorías abiertas |
| ¿Puede el coordinador ser el auditor? | Sí, puede asignarse a sí mismo |

**Confidencialidad.** El coordinador ve el estado y el avance de las auditorías de sus organizaciones, pero **nunca la
muestra, los códigos de acceso ni las respuestas**, salvo cuando él mismo es el auditor
([14](img/14-coordinador-auditoria-solo-avance.png)). Cada entidad trabaja aislada de las demás: un auditor que
trabaja para dos entidades elige al entrar con cuál trabaja ([03](img/03-eleccion-de-entidad.png)).

---

## Cambio 2 · Auditorías, ventana, máximo, idiomas, entidades y listados

### 2a · «Auditorías» en lugar de «campañas»

Toda la interfaz habla de **auditorías**: el menú, los títulos, los botones («nueva auditoría», «cancelar auditoría»)
y los mensajes, en los cuatro idiomas ([21](img/21-auditor-auditorias-abiertas.png),
[25](img/25-superadmin-todas-las-auditorias.png)). Internamente el sistema sigue usando el término técnico
«campaign»; no afecta a nadie que use la plataforma.

### 2b · Fecha de comienzo de las entrevistas

El campo «fecha de la visita» pasa a ser **«comienzo de las entrevistas»**, y la ventana se calcula hacia delante:

- **Abre** ese día a las 9:00, hora local de la organización.
- **Dura 10 días hábiles** (de lunes a viernes) y **cierra** a las 23:59 del décimo.
- Los **recordatorios** salen los días hábiles 4 y 8 a quien no haya completado.
- Si la fecha cae en fin de semana, la ventana abre el lunes siguiente y la plataforma lo avisa.

Ejemplo de la captura [16](img/16-nueva-auditoria-calculo-automatico.png): comienzo el miércoles 25 de noviembre,
cierre el martes 8 de diciembre; recordatorios el 30 de noviembre y el 4 de diciembre.

### 2c · Máximo de entrevistas completadas

- Campo nuevo en la auditoría. **Si se deja vacío, el máximo es el mínimo de la tabla** (por ejemplo, 26 para 250–500
  personas).
- El auditor puede **subirlo**, pero nunca por debajo del mínimo ni por encima de la población total o de las personas
  de la muestra cargada ([17](img/17-nueva-auditoria-maximo-no-valido.png)).
- **Al alcanzar el máximo, la auditoría pasa sola a «finalizada»**: los enlaces y códigos que falten por usar dejan de
  servir y el historial lo registra.
- El máximo aparece en el cálculo automático y en la ficha de la auditoría
  ([16](img/16-nueva-auditoria-calculo-automatico.png), [18](img/18-ficha-auditoria-borrador.png)).
- El cierre está construido y probado; empezará a actuar en cuanto haya entrevistas completadas (Fase 2).

### 2d · Sin catalán

El catalán **ya no se ofrece**: no aparece en el selector de idioma ([01](img/01-acceso.png)), ni al configurar
organizaciones, usuarios o auditorías, ni a las personas participantes. Quedan **español, inglés, portugués de
Portugal y francés** ([16](img/16-nueva-auditoria-calculo-automatico.png)). Las traducciones al catalán se conservan
por si en el futuro se quiere reactivar.

### 2e · Empresas auditoras en una tabla maestra

El desplegable de «empresa auditora» es la **entidad de auditoría** del cambio 1. Es una **tabla maestra** que
administra la Fundación desde «Entidades de auditoría» ([04](img/04-superadmin-entidades-de-auditoria.png)):

- Contiene las **nueve entidades actuales**: AENOR, APCER, AUDELCO, CMD, DNV, EDUQATIA, ICONTEC, LOT y SGS.
- La Fundación puede **añadir** entidades nuevas, **editar** su nombre o país y **desactivarlas**. Una entidad
  desactivada deja de ofrecerse y sus usuarios no pueden entrar, pero su histórico se conserva.
- El país de la entidad es **opcional**, porque varias trabajan en más de un país. Solo se ha rellenado donde es
  seguro: AENOR (España), APCER (Portugal) e ICONTEC (Colombia).
- La ficha de cada organización muestra su entidad y su coordinador ([08](img/08-superadmin-ficha-organizacion.png)).

### 2f · Listados con búsqueda, filtros y páginas

Pensado para los volúmenes que indicó la Fundación: **300–400 organizaciones**, **50–60 por coordinador** y muchas
más auditorías.

| Listado | Buscador | Filtros | Orden | Capturas |
|---|---|---|---|---|
| Organizaciones (Fundación) | Por nombre | Entidad de auditoría (incluido «sin entidad»), estado | Nombre, país, estado | [06](img/06-superadmin-organizaciones.png), [07](img/07-superadmin-organizaciones-busqueda.png) |
| Mis organizaciones (coordinador y auditor) | Por nombre | — | Nombre, país | [11](img/11-coordinador-mis-organizaciones.png), [15](img/15-auditor-mis-organizaciones.png) |
| Auditorías (todos los perfiles) | Por referencia u organización | Abiertas, cerradas o un estado concreto | Referencia, organización, comienzo, estado | [21](img/21-auditor-auditorias-abiertas.png), [25](img/25-superadmin-todas-las-auditorias.png) |

En todos los casos:

- **La búsqueda no distingue mayúsculas ni acentos**: «montana» encuentra «Montaña Textil».
- **25 filas por página**, con opción de 10, 50 o 100.
- **Búsqueda, filtros y página se conservan** al abrir una fila y volver atrás.
- **«Cerradas»** son las auditorías con informe generado y las canceladas.

---

## Lo que queda abierto

| Tema | Situación |
|---|---|
| Datos de empresa para estudios de benchmark (sector, tamaño, otros) | Propuesta enviada; pendiente de decidir con la Fundación qué clasificación de sectores usar |
| Ver respuestas por sexo o tramo de edad (por ejemplo, P4) | Previsto en la Fase 3, con protección de grupos pequeños (ninguna casilla con menos de 5 personas) |
| Histórico de auditorías cerradas e informes de evolución | Propuesta enviada: vista por defecto «abiertas», pestaña «histórico» y línea temporal por organización. Pendiente: si el informe de evolución debe incluir auditorías hechas por otra entidad de auditoría |
| Eliminar del todo una entidad de auditoría | No se añade, a petición de la Fundación; se desactiva y se conserva su histórico |

---

## Cómo comprobarlo en el servidor de pruebas

En https://efr-staging.bumii.ai, escribe uno de estos correos y pulsa «entrar con el enlace» (en pruebas el enlace
aparece en pantalla):

| Correo | Perfil | Qué probar |
|---|---|---|
| `superadmin.fundacion@masfamilia.example` | Fundación | Entidades de auditoría; organizaciones con buscador y filtros; asignación de una organización |
| `coordinacion@icontec.example` | Coordinación de ICONTEC | «Costa Alimentos» no tiene auditor: designarlo (o asignarse) desde «Organizaciones» |
| `auditor1@auditoria.example` | Auditor en ICONTEC y AENOR | Elegir entidad al entrar; crear una auditoría con fecha de comienzo y máximo |
| `auditor2@auditoria.example` | Auditor de AENOR | Auditorías de Montaña Textil |

Todos los datos son sintéticos, salvo los nombres de las entidades de auditoría.
