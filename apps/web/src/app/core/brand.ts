/**
 * Configuración de marca (manual de identidad efr 2025). Los logotipos oficiales están PENDIENTES de la
 * Fundación Másfamilia: mientras `logos.*` sea null se muestra el acrónimo «efr» en Arial Bold como
 * marcador. Para usarlos, copia los SVG a `public/brand/` y pon aquí su ruta.
 */
export type LogoVariant = 'positive' | 'negative-orange' | 'negative-gray' | 'grayscale';

export const BRAND = {
  product: 'SmartAudit',
  poweredBy: 'powered by Bumii',
  /** Claims oficiales, en orden de acepción. El primero acompaña siempre a la marca. */
  claims: ['efr es conciliación', 'efr es más', 'soy efr'] as const,
  logos: {
    positive: null as string | null, // p. ej. '/brand/efr-positivo.svg'
    'negative-orange': null as string | null,
    'negative-gray': null as string | null,
    grayscale: null as string | null,
  } satisfies Record<LogoVariant, string | null>,
  /** Tamaño mínimo on-line del logotipo (manual 1.5). */
  logoMinWidthPx: 47,
  links: { site: 'https://www.soyefr.org', siteLabel: 'www.soyefr.org' },
};
