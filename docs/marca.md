# Marca efr en SmartAudit

Fuente: `design_handoff_smartaudit_marca_efr/` (referencia HTML de alta fidelidad) y *Manual de identidad
corporativa efr 2025* (`design_handoff_smartaudit_marca_efr/referencia/`).

## Dónde vive la marca

| Qué | Dónde |
|---|---|
| Tokens de color, tipografía, radios, botones, avisos, datos destacados | `apps/web/src/styles.scss` (variables `--efr-*`) |
| Nombre del producto, claims, rutas de logotipos, tamaño mínimo, web | `apps/web/src/app/core/brand.ts` |
| Logotipo con variantes y zona de seguridad | `apps/web/src/app/layout/efr-logo.component.ts` |
| Firma del aplicativo (logotipo + SmartAudit + powered by Bumii) | `apps/web/src/app/layout/brand.component.ts` |
| Correos | `packages/mail/src/templates.ts` (`DEFAULT_BRAND`) |
| Excel exportados | `apps/api/src/services/sample.ts` (`brandHeader`, `brandSheet`) |
| Favicon | `apps/web/public/favicon.svg` |

## Reglas aplicadas

- **Color:** naranja `#FF6600` (títulos, acentos, botón primario), gris oscuro `#333333` (texto, hover, fondos oscuros), gris medio `#999999` solo para metadatos y numeración. Superficies `#FFFFFF` / `#F4F4F4`, bordes `#E6E6E6` / `#D0D0D0`.
- **Tipografía:** Arial (Regular y Bold); Verdana para valores técnicos (códigos, fechas de días hábiles).
- **Títulos:** negrita, naranja y **siempre en minúsculas** (por CSS). Los nombres propios (organizaciones, campañas) conservan sus mayúsculas con la clase `keep-case`.
- **Secciones numeradas** al estilo del manual («1. datos de la auditoría») con la clase `numbered` + `section-title`.
- **Estética plana:** radio 0 y sin sombras en todo, incluidos los componentes de Material.
- **Componentes:** botón primario naranja → hover gris oscuro; secundario con borde 2px gris oscuro → hover naranja; dato destacado con borde superior 3px naranja y cifra 48px; bloque de cierre en gris oscuro; selector segmentado para idioma.
- **Sin iconos ni fotografías** (se retiró la fuente Material Icons).
- **Estructura:** navegación lateral fija de 240px como en la referencia; portada de acceso con el claim «efr es conciliación.» en tamaño display; pie en gris oscuro con el logotipo en negativo.

## Pendiente

1. **Logotipos oficiales** (positivo, negativos, escala de grises) y **sello técnico**: solicitarlos a la Fundación Másfamilia. Copiarlos en `apps/web/public/brand/` y rellenar `BRAND.logos` en `brand.ts`. Mientras tanto se muestra el acrónimo «efr» en Arial Bold como marcador.
2. **Portada de informe 16:9** (borde inferior 8px naranja) y **sello técnico de la organización** en el informe: se aplican en la exportación Word/PDF de la Fase 3.
3. **Contraste (WCAG 2.1 AA):** ver `docs/decisiones.md` (decisión 33).
