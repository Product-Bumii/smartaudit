# Datos sintéticos

Todo el desarrollo usa **solo datos sintéticos** hasta la firma del acuerdo de tratamiento de datos (art. 28 RGPD).
Los dominios `.example` están reservados (RFC 2606): ningún correo sale a personas reales.

## Usuarios de la semilla (`seed/seed-lib.ts`)

| Correo | Rol | Entidad de auditoría |
|---|---|---|
| superadmin.bumii@bumii.example | SUPERADMIN_BUMII | — |
| superadmin.fundacion@masfamilia.example | SUPERADMIN_FUNDACION | — |
| coordinacion@certandes.example | COORDINATOR | Certificadora Andes (sintética) · CO |
| coordinacion@certiberica.example | COORDINATOR | Certificadora Ibérica (sintética) · ES |
| auditor1@auditoria.example | AUDITOR | **Ambas** (al entrar elige entidad) |
| auditor2@auditoria.example | AUDITOR | Certificadora Ibérica |

## Organizaciones de la semilla (empresas efr, sin usuarios)

| Organización | País · zona horaria | Entidad · coordinador | Auditor |
|---|---|---|---|
| Andina Servicios S.A.S. (sintética) | CO · America/Bogota | Andes · coordinacion@certandes.example | auditor1 (Andes) |
| Costa Alimentos S.A.S. (sintética) | CO · America/Bogota | Andes · coordinacion@certandes.example | — (para probar la asignación) |
| Ibérica Logística S.L. (sintética) | ES · Europe/Madrid | Ibérica · coordinacion@certiberica.example | auditor1 (Ibérica) |
| Montaña Textil S.L. (sintética) | ES · Europe/Madrid | Ibérica · coordinacion@certiberica.example | auditor2 |

Las entidades de auditoría de la semilla tienen nombres inventados; nunca se usan nombres de certificadoras reales en
los datos de prueba.

## Configuración de la semilla

- Cuestionario M1 **v1** publicado: español aprobado; inglés, catalán, portugués (de Portugal) y francés **pendientes de aprobación por la Fundación** (traducción de Bumii).
- Tabla de mínimos **v1** publicada (fuente: *Tablas entrevistas.xlsx*).

## Archivos de muestra (`seed/samples`, regenerables con `npx tsx seed/generate-samples.ts`)

| Archivo | Contenido |
|---|---|
| `muestra-valida-30.csv` / `.xlsx` | 30 personas (25 con correo, 5 `SIN_CORREO`), 3 centros, 5 tipos de puesto, todas las columnas |
| `muestra-valida-pequena-12.csv` | 12 personas (por debajo del mínimo de 14 → alerta) |
| `muestra-invalida-errores-fila.csv` | Un error de cada tipo: correo inválido (fila 3), duplicado (5), sexo (6), tramo de edad (7), centro vacío (8), `turnos` (9) |
| `muestra-invalida-columnas-prohibidas.csv` | Columnas `nombre`, `dni`, `salario` → rechazadas |
