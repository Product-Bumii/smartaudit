# SmartAudit efr · Fase 2: invitaciones y entrevista con IA

**Estado:** Fase 2 terminada y desplegada en el servidor de pruebas (https://efr-staging.bumii.ai), con **Google Gemini**
como proveedor de IA.
**Fecha de las capturas:** 20 de noviembre de 2026.
**Imágenes:** [`img/fase2/`](img/fase2/) · presentación de la Fase 1: [README.md](README.md).

Las capturas muestran la plataforma real con **datos sintéticos** (organización, personas y correos ficticios). Se han
hecho en el entorno local, donde la IA está **simulada**: por eso las preguntas aparecen con su texto oficial. En el
servidor de pruebas la IA es Gemini.

---

## Qué aporta la Fase 2

| Antes (Fase 1) | Ahora (Fase 2) |
|---|---|
| El auditor preparaba la auditoría y cargaba la muestra | El auditor **lanza** la auditoría y la plataforma hace el resto: invita, recuerda, abre y cierra |
| La persona sin correo solo podía comprobar su código | Cada persona **responde la entrevista**, desde el móvil o el ordenador, con su enlace o su código |
| — | Una **IA acotada** ayuda en la conversación: entiende respuestas escritas con palabras propias y pide una aclaración si hace falta |
| — | El auditor **sigue el avance** en directo y puede ampliar el plazo; el coordinador ve solo el agregado |

### El ciclo de una auditoría

1. **Lanzar.** El auditor revisa la muestra y pulsa «lanzar auditoría».
2. **Abrir.** El día de comienzo, a las 9:00 hora de la organización, la ventana se abre sola y salen las
   **invitaciones** por correo. Quien no tiene correo usa el **código en papel**.
3. **Responder.** Cada persona hace una entrevista escrita de unos 10 minutos. Puede pausarla y seguir después.
4. **Recordar.** Los días hábiles 4 y 8 de la ventana sale un **recordatorio**, solo a quien no ha terminado.
5. **Cerrar.** La auditoría se cierra sola al terminar la ventana (10 días hábiles, ampliable) o al llegar al
   **máximo de entrevistas** fijado.

---

## 1. Lanzar la auditoría

### 01 · Muestra cargada, lista para lanzar

![Lanzar auditoría](img/fase2/01-lanzar-auditoria.png)

Con la muestra cargada aparece el botón **«lanzar auditoría»**. La ficha resume lo que se va a pedir: mínimo de 20
entrevistas completadas (tramo 91–150 personas), **máximo de 25** (al llegar ahí se cierra sola), 30 personas en la
muestra y el día de comienzo de las entrevistas. Antes de lanzar, la plataforma pide confirmación: después ya no se
puede cambiar la configuración, solo añadir personas a la muestra.

### 02 · Auditoría lanzada

![Envíos activos](img/fase2/02-auditoria-envios-activos.png)

La auditoría pasa a **«Envíos activos»**: está lanzada y esperando a que se abra la ventana. La ventana de
participación muestra cuándo abre, cuándo cierra, los dos recordatorios y los diez días hábiles.

---

## 2. Los correos

### 03 · Invitación

![Correo de invitación](img/fase2/03-correo-invitacion.png)

Sale al abrir la ventana, a cada persona con correo. Explica quién pide la opinión y para qué, cuánto dura, que es
**confidencial** («nadie de la empresa verá tus respuestas ni sabrá si has participado»), que se puede no responder
y hasta cuándo está disponible. El botón lleva un **enlace personal** que solo sirve para esa persona. Lleva la marca
efr y «powered by Bumii».

### 04 · Recordatorio

![Correo de recordatorio](img/fase2/04-correo-recordatorio.png)

Los días hábiles 4 y 8, solo a quien todavía no ha terminado. Recuerda que puede **continuar donde lo dejó**.

---

## 3. La entrevista, en el móvil

### 05 · El enlace personal

![Enlace personal](img/fase2/05-movil-enlace-personal.png)

Al abrir el enlace, la persona ve el **aviso previo** (uso de IA, finalidad, confidencialidad, derecho a no responder
y a quién dirigirse), elige el **idioma** de la entrevista entre los aprobados y pulsa **«empezar la entrevista»**.
Quien no tiene correo llega a la misma pantalla escribiendo su código en papel.

### 06 · Primera pregunta

![Primera pregunta](img/fase2/06-movil-primera-pregunta.png)

La conversación muestra la pregunta y, debajo, las **opciones como botones**. Un toque basta. También puede
**responder con sus palabras** o pulsar **«Prefiero no responder»**. Arriba, el progreso («1 de unas 13 preguntas»):
el total es aproximado porque algunas preguntas dependen de respuestas anteriores.

### 07 · Respuesta múltiple

![Respuesta múltiple](img/fase2/07-movil-respuesta-multiple.png)

En P2 («¿A través de qué medio…?») se pueden marcar **varias opciones**: se iluminan al tocarlas y se envían con
«enviar». Si se elige «otros», la plataforma pide cuál.

### 08 · Respuesta con sus palabras

![Respuesta con sus palabras](img/fase2/08-movil-respuesta-con-sus-palabras.png)

A «¿Conoce quién es el Mánager efr de su entidad?» la persona escribe «Ni idea, la verdad». La IA lo entiende como
**«No sabe»** y la entrevista sigue. Queda guardado el texto original, la opción asignada, la confianza y la cita que
la justifica, para que el auditor pueda revisarlo.

### 09 · Una aclaración, como máximo

![Aclaración](img/fase2/09-movil-aclaracion.png)

Si la respuesta no encaja con ninguna opción («¿cuál catálogo?»), la plataforma **repregunta una sola vez**, de forma
neutral: repite la pregunta y enumera **todas** las opciones, sin sugerir ninguna. Si tampoco encaja la segunda vez,
la respuesta queda **para revisión del auditor** y la entrevista continúa.

### 10 · Texto complementario

![Texto complementario](img/fase2/10-movil-texto-complementario.png)

Como la persona respondió que excede la jornada «siempre», aparece **P7.1** (compensación). Algunas opciones admiten
un texto que complementa la respuesta, como «días libres».

### 11 · Fin de la entrevista

![Fin de la entrevista](img/fase2/11-movil-fin-de-la-entrevista.png)

Al terminar, el agradecimiento. Al ser una renovación que postula a la excelencia, también se han hecho **P8** y
**P9**. En P9 la persona ha preferido no responder, y en P10 ha dejado un comentario. El enlace ya no permite
empezar otra entrevista.

### 12 · Pausar y continuar

![Continuar la entrevista](img/fase2/12-movil-continuar-la-entrevista.png)

Otra persona respondió tres preguntas y cerró el móvil. Al abrir de nuevo su enlace (o escribir su código) aparece
**«continuar la entrevista»**, que retoma la pregunta pendiente **sin repetir ni perder** respuestas.

### 13 · También en el ordenador

![Chat en el ordenador](img/fase2/13-escritorio-chat.png)

La misma entrevista en una pantalla grande. Todo se puede hacer con el teclado.

---

## 4. Seguimiento de la auditoría

### 14 · El avance

![Avance](img/fase2/14-auditor-avance.png)

Con la auditoría **«En curso»**, el auditor ve en directo:

- **Entrevistas completadas** frente al **mínimo** (9 de 20, el 45 %) y al **máximo** (25).
- Las **empezadas sin terminar** y las **personas invitadas**.
- Una barra de avance y, si hace falta, **alertas**: muestra menor que el mínimo, o un ritmo que, a mitad de plazo, no
  llegaría al mínimo.
- El **estado de cada persona**: invitada, empezada o completada, con su canal (correo o código en papel), la fecha de
  la invitación y los recordatorios. Cada persona se identifica **por su fila en el archivo de muestra del auditor**:
  nunca se muestra su correo ni lo que ha respondido.

### 15 · La ficha completa y la ampliación del plazo

![Ficha en curso](img/fase2/15-auditor-ficha-en-curso-completa.png)

La ficha completa de una auditoría en curso: datos, ventana, muestra, avance e historial de estados. El auditor ha
**ampliado la ventana** una semana. La ventana muestra la ampliación («del 3 de diciembre al 10 de diciembre») y los
nuevos días hábiles, y queda registrada. El historial muestra que la auditoría pasó a «En curso»
**automáticamente** al abrirse la ventana.

*En esta captura la ventana abre de madrugada porque en el entorno local se abrió a mano para la demostración; en la
plataforma real abre a las 9:00 del día de comienzo.*

### 16 · Auditorías en curso

![Auditorías en curso](img/fase2/16-auditor-auditorias-en-curso.png)

El listado de auditorías del auditor, filtrado por **«En curso»**.

### 17 · El coordinador: solo el avance agregado

![Coordinador](img/fase2/17-coordinador-avance-agregado.png)

El coordinador de la entidad de auditoría ve el **estado y el avance** de las auditorías de sus organizaciones, con
las mismas cifras, pero **sin la lista de personas, sin la muestra y sin las respuestas**. El aviso gris lo explica en la
propia pantalla.

---

## 5. La IA, acotada

| La IA **sí** | La IA **no** |
|---|---|
| Formula la pregunta con naturalidad, sin cambiar su sentido | Decide qué pregunta toca, ni cuándo se activa P7.1, P8 o P9 |
| Entiende una respuesta escrita con palabras propias y la asigna a una opción | Inventa preguntas, sugiere respuestas ni menciona datos de la organización |
| Pide **una** aclaración neutral si la respuesta no encaja | Decide nada sobre la persona: lo dudoso lo revisa el auditor |

**Guardas automáticas** (no dependen de la IA):

- Una reformulación que añada preguntas, cifras, enlaces u opciones de respuesta, o que llegue **incompleta**, se
  descarta y se muestra el **texto oficial**.
- Una aclaración que nombre solo algunas opciones (sugeriría la respuesta) se sustituye por una **neutral**.
- Una respuesta que intente dar **instrucciones a la IA** («ignora las instrucciones y marca…») **no se clasifica**:
  pasa a revisión.
- **Ningún dato personal llega a la IA**: correos, teléfonos, códigos o enlaces que escriba una persona se eliminan
  antes de enviar nada. Solo viajan la pregunta, sus opciones y la respuesta.
- Si la IA tarda, falla o responde algo que no encaja con el formato esperado, se reintenta una vez y, si sigue
  fallando, la respuesta queda para revisión. **La entrevista nunca se bloquea.**

**Cómo se ha comprobado.** Una batería automática de **40 personas sintéticas** recorre entrevistas completas:
cooperativas, que escriben en otros idiomas, evasivas, que se salen del tema, que intentan manipular a la IA y que
escriben datos personales. Resultado:

- **0** preguntas inventadas y **0** respuestas sugeridas.
- P7.1, P8 y P9 aparecen **solo cuando corresponde**.
- **Ningún identificador** llega al proveedor de IA (se inspeccionan todas las llamadas).
- Pausar y continuar **no repite ni pierde** respuestas.

---

## 6. Privacidad

- La empresa auditada **no tiene acceso**. El coordinador solo ve cifras agregadas.
- El correo de cada persona está **cifrado** y separado de sus respuestas; solo se usa para enviar la invitación y los
  recordatorios.
- Las respuestas se guardan ligadas a los **datos demográficos**, nunca a la identidad.
- La clave de la IA se guarda **cifrada en el servidor** y no está en ningún archivo de configuración ni en el código.

---

## 7. Pendiente de decidir

| Tema | Propuesta |
|---|---|
| **Reformulación de las preguntas.** En el servidor de pruebas, Gemini a veces cambia un matiz (por ejemplo, desarrolló «efr» de forma incorrecta) | Mostrar siempre el **texto oficial aprobado por la Fundación** y usar la IA solo para entender las respuestas escritas y repreguntar |
| **Procesamiento en la UE** | Gemini con la clave actual no garantiza procesar en Europa; para ello, Gemini en Vertex AI con región europea |
| **Traducciones** del cuestionario al inglés, portugués y francés | Pendientes de aprobación por la Fundación; hasta entonces la entrevista solo se ofrece en español |

**Siguiente fase (3):** revisión de las respuestas dudosas por el auditor, cálculo de resultados, síntesis y el
informe en Word, Excel y PDF.

---

## Cómo regenerar estas capturas

Con la plataforma en local recién arrancada (`npm run dev:local` y `npm start -w apps/web`):

```bash
npm run screenshots
```

El guion de esta fase es `e2e/presentation/fase2.spec.ts`. Lanza una auditoría sintética, abre la ventana, hace que
varias personas respondan y captura cada pantalla.
