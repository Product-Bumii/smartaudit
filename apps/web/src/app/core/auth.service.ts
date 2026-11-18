import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { I18nService } from './i18n.service';
import type { AccountChoice, Language, Role, SessionUser } from './models';

export type VerifyResult = { status: 'authenticated'; user: SessionUser } | { status: 'select_account'; accounts: AccountChoice[] };

/** Session state holder, kept separate so the HTTP interceptor can read it without a DI cycle. */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  readonly user = signal<SessionUser | null>(null);
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly user = inject(SessionStore).user;
  readonly isSuperadmin = computed(() => this.user()?.role.startsWith('SUPERADMIN') ?? false);

  async loadMe(): Promise<void> {
    try {
      const { user } = await this.api.get<{ user: SessionUser }>('/auth/me');
      this.user.set(user);
    } catch {
      this.user.set(null);
    }
  }

  /** `devLink` only comes back in test environments without email (DEV_SHOW_MAGIC_LINK). */
  requestLink(email: string): Promise<{ ok: boolean; devLink?: string }> {
    return this.api.post('/auth/magic-link', { email, language: this.i18n.lang() });
  }

  async verify(token: string): Promise<VerifyResult> {
    const res = await this.api.post<VerifyResult>('/auth/verify', { token });
    if (res.status === 'authenticated') await this.onLogin(res.user);
    return res;
  }

  pendingAccounts(): Promise<{ accounts: AccountChoice[] }> {
    return this.api.get('/auth/accounts');
  }

  async select(userId: string): Promise<void> {
    const res = await this.api.post<{ user: SessionUser }>('/auth/select', { userId });
    await this.onLogin(res.user);
  }

  async logout(): Promise<void> {
    await this.api.post('/auth/logout').catch(() => undefined);
    this.user.set(null);
    await this.router.navigateByUrl('/login');
  }

  async setLanguage(lang: Language): Promise<void> {
    await this.i18n.use(lang);
    if (this.user()) {
      await this.api.patch('/auth/me', { preferredLanguage: lang }).catch(() => undefined);
      this.user.update((u) => (u ? { ...u, preferredLanguage: lang } : u));
    }
  }

  homeFor(role: Role | undefined): string {
    if (!role) return '/login';
    if (role === 'COORDINATOR' || role === 'AUDITOR') return '/my/organizations';
    return '/admin/organizations';
  }

  private async onLogin(user: SessionUser): Promise<void> {
    this.user.set(user);
    await this.i18n.use(user.preferredLanguage);
  }
}
