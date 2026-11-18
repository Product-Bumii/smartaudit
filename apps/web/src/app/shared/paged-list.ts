import { inject, signal } from '@angular/core';
import type { PageEvent } from '@angular/material/paginator';
import type { Sort } from '@angular/material/sort';
import { ActivatedRoute, Router } from '@angular/router';
import type { Paged } from '../core/models';

export type ListParams = Record<string, string | number | undefined>;

export interface PagedListOptions<T> {
  /** Loads one page from the API with the given query parameters. */
  load: (params: ListParams) => Promise<Paged<T>>;
  onError: (e: unknown) => void;
  sort: string;
  dir: 'asc' | 'desc';
  /** Names of the extra filters (query parameters) this list supports. */
  filters?: string[];
}

const SEARCH_DELAY_MS = 300;

/**
 * State of a server-side list (search, filters, sorting, page), mirrored in the URL query so it survives
 * opening a row and coming back. Create it in an injection context (a component field).
 */
export class PagedList<T> {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private requestId = 0;

  readonly items = signal<T[]>([]);
  readonly total = signal(0);
  readonly loaded = signal(false);
  readonly q = signal('');
  /** 0-based (as MatPaginator). */
  readonly page = signal(0);
  readonly pageSize = signal(25);
  readonly sort = signal('');
  readonly dir = signal<'asc' | 'desc'>('asc');
  readonly filters = signal<Partial<Record<string, string>>>({});

  constructor(private readonly options: PagedListOptions<T>) {
    const qp = this.route.snapshot.queryParamMap;
    this.q.set(qp.get('q') ?? '');
    this.page.set(Math.max(0, Number(qp.get('page') ?? 1) - 1) || 0);
    const size = Number(qp.get('pageSize'));
    this.pageSize.set([10, 25, 50, 100].includes(size) ? size : 25);
    this.sort.set(qp.get('sort') ?? options.sort);
    this.dir.set(qp.get('dir') === 'asc' || qp.get('dir') === 'desc' ? (qp.get('dir') as 'asc' | 'desc') : options.dir);
    const filters: Partial<Record<string, string>> = {};
    for (const f of options.filters ?? []) {
      const v = qp.get(f);
      if (v) filters[f] = v;
    }
    this.filters.set(filters);
  }

  /** True when a search or a filter narrows the list (to show "no results" instead of "empty"). */
  narrowed(): boolean {
    return !!this.q().trim() || Object.keys(this.filters()).length > 0;
  }

  private params(): ListParams {
    return {
      q: this.q().trim() || undefined,
      page: this.page() + 1,
      pageSize: this.pageSize(),
      sort: this.sort(),
      dir: this.dir(),
      ...this.filters(),
    };
  }

  async reload(): Promise<void> {
    const id = ++this.requestId;
    const params = this.params();
    // Only what differs from the defaults goes to the URL (clean links when nothing was changed).
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...params,
        page: params['page'] === 1 ? undefined : params['page'],
        pageSize: params['pageSize'] === 25 ? undefined : params['pageSize'],
        sort: params['sort'] === this.options.sort ? undefined : params['sort'],
        dir: params['dir'] === this.options.dir ? undefined : params['dir'],
      },
      replaceUrl: true,
    });
    try {
      const res = await this.options.load(params);
      if (id !== this.requestId) return; // a newer request is on its way
      this.items.set(res.items);
      this.total.set(res.total);
      // The page may be past the end after a change elsewhere: go back to the last one.
      if (res.items.length === 0 && res.total > 0 && this.page() > 0) {
        this.page.set(Math.max(0, Math.ceil(res.total / this.pageSize()) - 1));
        await this.reload();
        return;
      }
    } catch (e) {
      this.options.onError(e);
    } finally {
      if (id === this.requestId) this.loaded.set(true);
    }
  }

  onSearch(value: string): void {
    this.q.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.page.set(0);
      void this.reload();
    }, SEARCH_DELAY_MS);
  }

  onPage(e: PageEvent): void {
    this.page.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
    void this.reload();
  }

  onSort(e: Sort): void {
    this.sort.set(e.direction ? e.active : this.options.sort);
    this.dir.set(e.direction || this.options.dir);
    this.page.set(0);
    void this.reload();
  }

  setFilter(name: string, value: string | null): void {
    this.filters.update((f) => {
      const next = { ...f };
      if (value) next[name] = value;
      else delete next[name];
      return next;
    });
    this.page.set(0);
    void this.reload();
  }

  clear(): void {
    clearTimeout(this.timer);
    this.q.set('');
    this.filters.set({});
    this.page.set(0);
    void this.reload();
  }
}
