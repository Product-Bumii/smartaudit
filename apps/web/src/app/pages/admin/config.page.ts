import { Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-config',
  imports: [MatTabsModule, RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  template: `
    <div class="page-header">
      <div class="titles">
        <div class="eyebrow">{{ 'config.eyebrow' | translate }}</div>
        <h1>{{ 'config.title' | translate }}</h1>
      </div>
    </div>
    <nav mat-tab-nav-bar [tabPanel]="panel" class="tabs">
      @for (t of tabs; track t.path) {
        <a mat-tab-link [routerLink]="t.path" routerLinkActive #rla="routerLinkActive" [active]="rla.isActive">{{ t.label | translate }}</a>
      }
    </nav>
    <mat-tab-nav-panel #panel><router-outlet /></mat-tab-nav-panel>
  `,
  styles: `.tabs { margin-bottom: 32px; }`,
})
export class ConfigPage {
  readonly tabs = [
    { path: 'sampling-tables', label: 'config.samplingTables' },
    { path: 'questionnaires', label: 'config.questionnaires' },
    { path: 'holidays', label: 'config.holidays' },
    { path: 'settings', label: 'config.settings' },
  ];
}
