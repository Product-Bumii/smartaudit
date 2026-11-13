import { provideHttpClient, withFetch, withInterceptors, type HttpInterceptorFn } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { catchError, throwError } from 'rxjs';
import { routes } from './app.routes';
import { AuthService, SessionStore } from './core/auth.service';
import { I18nService } from './core/i18n.service';

/** On 401 from a protected endpoint, drop the session and go to login. */
const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  return next(req).pipe(
    catchError((err) => {
      if (err?.status === 401 && !req.url.includes('/api/auth/') && session.user()) {
        session.user.set(null);
        void router.navigateByUrl('/login');
      }
      return throwError(() => err);
    }),
  );
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([sessionInterceptor])),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
      fallbackLang: 'es',
      lang: 'es',
    }),
    provideAppInitializer(async () => {
      const i18n = inject(I18nService);
      const auth = inject(AuthService);
      await i18n.init();
      await auth.loadMe();
    }),
  ],
};
