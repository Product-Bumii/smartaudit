# Datos sintéticos

Todo el desarrollo usa **solo datos sintéticos** hasta la firma del acuerdo de tratamiento de datos (art. 28 RGPD).
Los dominios `.example` están reservados (RFC 2606): ningún correo sale a personas reales.

## Usuarios de la semilla (`seed/seed-lib.ts`)

| Correo | Rol | Organización |
|---|---|---|
| superadmin.bumii@bumii.example | SUPERADMIN_BUMII | — |
| superadmin.fundacion@masfamilia.example | SUPERADMIN_FUNDACION | — |
| admin@andina.example | ORG_ADMIN | Andina Servicios S.A.S. (sintética) · CO · America/Bogota |
| admin@iberica.example | ORG_ADMIN | Ibérica Logística S.L. (sintética) · ES · Europe/Madrid |
| auditor1@auditoria.example | AUDITOR | **Ambas** (al entrar elige organización) |
| auditor2@auditoria.example | AUDITOR | Ibérica Logística |

## Configuración de la semilla

- Cuestionario M1 **v1** publicado: español aprobado; inglés, catalán, portugués (de Portugal) y francés **pendientes de aprobación por la Fundación** (traducción de Bumii).
- Tabla de mínimos **v1** publicada (fuente: *Tablas entrevistas.xlsx*).
- Festivos CO y ES 2026–2027 publicados (generados con `date-holidays`, sin sobrescrituras).

## Archivos de muestra (`seed/samples`, regenerables con `npx tsx seed/generate-samples.ts`)

| Archivo | Contenido |
|---|---|
| `muestra-valida-30.csv` / `.xlsx` | 30 personas (25 con correo, 5 `SIN_CORREO`), 3 centros, 5 tipos de puesto, todas las columnas |
| `muestra-valida-pequena-12.csv` | 12 personas (por debajo del mínimo de 14 → alerta) |
| `muestra-invalida-errores-fila.csv` | Un error de cada tipo: correo inválido (fila 3), duplicado (5), sexo (6), tramo de edad (7), centro vacío (8), `turnos` (9) |
| `muestra-invalida-columnas-prohibidas.csv` | Columnas `nombre`, `dni`, `salario` → rechazadas |
