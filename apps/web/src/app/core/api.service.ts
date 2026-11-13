import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface ApiFailure {
  status: number;
  code: string;
  details?: unknown;
}

/** Normalizes any HTTP error into `{ status, code, details }` (uniform API error format). */
export function toApiFailure(err: unknown): ApiFailure {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { error?: { code?: string; details?: unknown } } | null;
    return { status: err.status, code: body?.error?.code ?? (err.status === 0 ? 'NETWORK_ERROR' : 'INTERNAL_ERROR'), details: body?.error?.details };
  }
  return { status: 0, code: 'INTERNAL_ERROR' };
}

/** Thin promise-based wrapper over HttpClient. Cookies are sent automatically (same origin). */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(url: string, params?: Record<string, string | number | undefined>): Promise<T> {
    let p = new HttpParams();
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v !== undefined) p = p.set(k, String(v));
    });
    return firstValueFrom(this.http.get<T>(`/api${url}`, { params: p, withCredentials: true }));
  }
  post<T>(url: string, body: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(`/api${url}`, body, { withCredentials: true }));
  }
  put<T>(url: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(`/api${url}`, body, { withCredentials: true }));
  }
  patch<T>(url: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.patch<T>(`/api${url}`, body, { withCredentials: true }));
  }
  delete<T>(url: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(`/api${url}`, { withCredentials: true }));
  }
  upload<T>(url: string, file: File): Promise<T> {
    const form = new FormData();
    form.append('file', file, file.name);
    return firstValueFrom(this.http.post<T>(`/api${url}`, form, { withCredentials: true }));
  }

  /** Downloads a file and triggers the browser save dialog. */
  async download(url: string): Promise<void> {
    const res = await firstValueFrom(this.http.get(`/api${url}`, { observe: 'response', responseType: 'blob', withCredentials: true }));
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'descarga';
    const href = URL.createObjectURL(res.body as Blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.click();
    URL.revokeObjectURL(href);
  }
}
