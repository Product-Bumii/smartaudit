import { inject, Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslateService } from '@ngx-translate/core';

/** Paginator labels from the translation files, refreshed when the language changes. */
@Injectable()
export class TranslatedPaginatorIntl extends MatPaginatorIntl {
  private readonly translate = inject(TranslateService);

  constructor() {
    super();
    this.translate.onLangChange.subscribe(() => this.refresh());
    this.refresh();
  }

  private refresh(): void {
    const t = (k: string) => this.translate.instant(`list.${k}`);
    this.itemsPerPageLabel = t('itemsPerPage');
    this.nextPageLabel = t('nextPage');
    this.previousPageLabel = t('previousPage');
    this.firstPageLabel = t('firstPage');
    this.lastPageLabel = t('lastPage');
    this.changes.next();
  }

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    const start = length === 0 ? 0 : page * pageSize + 1;
    const end = Math.min((page + 1) * pageSize, length);
    return this.translate.instant('list.range', { start, end, total: length });
  };
}
