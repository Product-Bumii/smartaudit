# Handoff: Uso de marca en aplicativo Smartaudit by Bumii

## Overview
Design system / kit de marca efr para su uso dentro del aplicativo **Smartaudit by Bumii**, dirigido a organizaciones con certificado efr en vigor. Basado en el *Manual de identidad corporativa efr 2025* (incluido en `referencia/`).

## About the Design Files
Los archivos de este paquete son **referencias de diseño hechas en HTML**: prototipos que muestran el aspecto y el comportamiento previstos. No son código de producción para copiar tal cual. La tarea es **recrear estos diseños en el entorno real del codebase** (React, Vue, etc.) con sus patrones y librerías. Si aún no hay entorno, elige el framework más adecuado.

Para abrir la referencia: abre `Uso de marca en aplicativo Smartaudit by Bumii.dc.html` en un navegador (necesita `support.js` e `image-slot.js` en la misma carpeta, y servirse por HTTP, p. ej. `npx serve`).

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciado e interacciones son definitivos. Los logotipos y el sello técnico son **placeholders** (`<image-slot>`): hay que sustituirlos por los archivos oficiales de efr.

## Design Tokens

### Color
| Token | HEX | RGB | CMYK | Pantone | Uso |
|---|---|---|---|---|---|
| `efr-orange` | `#FF6600` | 255 102 0 | 0 60 100 0 | 151 C | Títulos, acentos, CTA primario |
| `efr-gray-dark` | `#333333` | 51 51 51 | 0 0 0 80 | Process Black | Texto, CTA hover, fondos oscuros |
| `efr-gray-mid` | `#999999` | 153 153 153 | 0 0 0 40 | 877 | Metadatos, numeración (no para texto de cuerpo: contraste bajo) |
| `surface` | `#FFFFFF` | — | — | — | Fondo base |
| `surface-alt` | `#F4F4F4` | — | — | — | Secciones alternas, tarjetas |
| `border` | `#E6E6E6` | — | — | — | Divisores, bordes de tarjeta |
| `border-strong` | `#D0D0D0` | — | — | — | Divisores sobre `surface-alt` |

Proporción orientativa: naranja 60 / gris oscuro 30 / gris medio 10.

### Tipografía
- **Títulos:** Arial Bold, `#FF6600`, **siempre en minúsculas** (p. ej. "1. la marca").
- **Texto:** Arial Regular (alternativa Verdana), `#333333` o negro.
- Stack: `Arial, Helvetica, sans-serif`; Verdana para valores técnicos (códigos de color).

| Rol | Tamaño / interlineado | Peso | Color |
|---|---|---|---|
| Display (hero) | clamp(48px, 8vw, 112px) / 0.95, letter-spacing −3px | 700 | #FF6600 |
| Claim grande | clamp(32px, 5vw, 56px), letter-spacing −1px | 700 | #FF6600 / #333333 |
| Título 1 | 48px / 1.08 | 700 | #FF6600 |
| Título sección (h2) | 36px | 700 | #FF6600 |
| Título 2 | 28px / 1.2 | 700 | #FF6600 |
| Lead | 19px / 1.55 | 400 | #333333 |
| Cuerpo | 16–17px / 1.6 | 400 | #333333 |
| Secundario | 14–15px / 1.5 | 400 | #333333 |
| Nota / etiqueta | 12–13px | 400 | #333333 o #999999 |
| Eyebrow | 14px, uppercase, letter-spacing 2px | 400 | #999999 |

### Espaciado
Escala usada: 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 72, 80, 96 px.
- Padding de sección: `80px clamp(24px, 6vw, 96px)`.
- Gap entre bloques de sección: 40px. Gap de grids de tarjetas: 16–32px.

### Radios, sombras, bordes
- **Radio: 0** en todo (estética plana, rectangular). Sin sombras.
- Bordes 1px `#E6E6E6`; acento superior 3px (`#FF6600` dato destacado, `#333333` reglas "No").
- Acento lateral 2px `#FF6600` en firma; acento inferior 8px `#FF6600` en portada de informe.

## Reglas de marca (del manual)
- efr = **e**quilibrio, **f**lexibilidad, **r**esponsabilidad. Denominación, tipografía y colores no se modifican.
- **Logotipo:** zona de seguridad de 1U alrededor; conjunto 7U × 4,5U. Tamaño mínimo **47 px** on-line / **11 cm** impreso.
- Variantes permitidas: positivo (fondo blanco), negativo sobre naranja, negativo sobre gris oscuro, escala de grises.
- No deformar, inclinar, cambiar proporciones ni colores; no colocar sobre fondos de bajo contraste.
- **Sello técnico:** identifica a la organización y su certificado (modelo efr 1000-1 / 1000-2, nº de certificación, año de vigencia, entidad evaluadora). Usarlo siempre que se comunique expresamente el certificado. El logotipo solo no acredita el certificado.
- **Claims:** "efr es conciliación" (primera acepción), "efr es más", "soy efr". Los mensajes propios amplían la marca, nunca la sustituyen.

## Screens / Views
Una sola página de documentación con layout de 2 columnas: `grid-template-columns: minmax(0,240px) minmax(0,1fr)`.

- **Nav lateral (sticky, top 0, altura 100vh):** padding 40px 24px, borde derecho 1px #E6E6E6. Wordmark "efr" 34px bold naranja; subtítulo 13px; enlaces de ancla 14px naranja (hover gris + subrayado); nota al pie 12px #999.
- **Header:** padding 96px/72px; eyebrow, display "efr es conciliación.", lead (máx. 640px).
- **01 la marca:** grid de 3 tarjetas (e / f / r) separadas por 2px #E6E6E6. Letra 72px bold naranja, título 20px bold, texto 15px.
- **02 logotipo:** zona de seguridad (caja gris 4:3 con contorno discontinuo naranja), tamaño mínimo, 4 variantes en grid (aspect 3:2), 3 reglas "No".
- **03 sello técnico:** fondo #F4F4F4; sello cuadrado + tabla clave/valor (filas 14px padding, divisor #D0D0D0).
- **04 claims:** lista numerada, claim a clamp(32–56px).
- **05 color:** selector segmentado HEX / RGB / CMYK / Pantone + 3 muestras (bloque de color 200px alto + nombre, valor, estado).
- **06 tipografía:** 2 especímenes "Aa" 120px + escala tipográfica en filas (etiqueta 140px + muestra).
- **07 componentes:** botones, dato destacado, bloque de cierre oscuro.
- **08 aplicaciones:** post 1080×1080 (fondo naranja), portada de informe 16:9, firma de correo con sello.
- **Footer contacto:** fondo #333333, texto blanco; soyefr.org, fundacion@masfamilia.org, Elena Charro (echarro@masfamilia.org).

## Componentes
- **Botón primario:** bg #FF6600, texto #FFF bold 15px, padding 14px 24px, radio 0, sin borde. Hover: bg #333333.
- **Botón secundario:** borde 2px #333333, bg #FFF, texto #333 bold 15px, padding 12px 22px. Hover: borde y texto #FF6600.
- **Dato destacado:** borde superior 3px #FF6600, cifra 48px bold naranja, descripción 15px.
- **Bloque de cierre:** bg #333333, padding 32px, título 24px bold blanco, texto 14px #E6E6E6.
- **Selector segmentado:** contenedor #F4F4F4 padding 4px gap 4px; opción 13px padding 8px 14px; activa bg #333 texto #FFF.

## Interactions & Behavior
- Nav: enlaces de ancla a cada sección.
- Color: el selector cambia el formato mostrado en las 3 muestras. Clic en muestra → copia el valor al portapapeles y muestra "copiado ✓" durante 1,4 s.
- Botones: transición de hover de color (sin animación definida; usar ~150ms ease).
- Responsive: grids con `repeat(auto-fit, minmax(…,1fr))`; tamaños de display con `clamp()`.

## State Management
- `colorFormat`: 'HEX' | 'RGB' | 'CMYK' | 'Pantone' (por defecto 'HEX').
- `copiedColor`: nombre de la muestra copiada o null (reset tras 1400ms).
- `claim` (configurable): claim usado en las aplicaciones de ejemplo.

## Assets
- Logotipo efr (positivo, negativos, grises) y sello técnico: **pendientes**, solicitar a la Fundación Másfamilia / soyefr.org. En el prototipo son placeholders.
- No se usan iconos ni fotografías.

## Files
- `Uso de marca en aplicativo Smartaudit by Bumii.dc.html`: referencia de diseño completa.
- `support.js`, `image-slot.js`: runtime necesario para abrir la referencia.
- `referencia/Manual de identidad corporativa efr 2025.pdf`: manual original.
