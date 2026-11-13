import { Component, computed, input } from '@angular/core';
import { BRAND, type LogoVariant } from '../core/brand';

/**
 * Logotipo efr con sus variantes permitidas (manual 1.6) y zona de seguridad de 1U (manual 1.5).
 * El conjunto mide 7U × 4,5U; `height` es la altura del logotipo sin la zona de seguridad.
 * Nunca se deforma: con logotipo oficial se usa `object-fit: contain`.
 */
@Component({
  selector: 'app-efr-logo',
  template: `
    <span class="safe-zone" [class]="variant()" [style.padding.px]="unit()" [style.--efr-logo-h]="effectiveHeight() + 'px'">
      @if (src(); as s) {
        <img [src]="s" alt="efr" [style.height.px]="effectiveHeight()" />
      } @else {
        <span class="wordmark" role="img" aria-label="efr">efr</span>
      }
    </span>
  `,
  styles: `
    :host { display: inline-flex; }
    .safe-zone { display: inline-flex; align-items: center; justify-content: center; line-height: 1; }
    .safe-zone.negative-orange { background: var(--efr-orange); }
    .safe-zone.negative-gray { background: var(--efr-gray-dark); }
    img { width: auto; object-fit: contain; display: block; }
    .wordmark { font-family: Arial, Helvetica, sans-serif; font-weight: 700; letter-spacing: -0.04em; font-size: calc(var(--efr-logo-h) * 1.1); line-height: 0.8; color: var(--efr-orange); }
    .negative-orange .wordmark, .negative-gray .wordmark { color: #fff; }
    .grayscale .wordmark { color: var(--efr-gray-mid); }
  `,
})
export class EfrLogoComponent {
  readonly variant = input<LogoVariant>('positive');
  /** Altura del logotipo en px (sin zona de seguridad). */
  readonly height = input(28);
  /** Muestra la zona de seguridad (1U alrededor). Desactivar solo si el contenedor ya la garantiza. */
  readonly safeZone = input(false);

  readonly src = computed(() => BRAND.logos[this.variant()]);
  /** Respeta el tamaño mínimo on-line (47 px de ancho ≈ 47 / 7 × 4,5 px de alto). */
  readonly effectiveHeight = computed(() => Math.max(this.height(), Math.ceil((BRAND.logoMinWidthPx / 7) * 4.5)));
  readonly unit = computed(() => (this.safeZone() ? this.effectiveHeight() / 4.5 : 0));
}
