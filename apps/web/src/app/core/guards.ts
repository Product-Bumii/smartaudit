import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import type { Role } from './models';

/** Route guards only control navigation; authorization is always enforced by the API. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.user() ? true : inject(Router).createUrlTree(['/login']);
};

export const roleGuard =
  (...roles: Role[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const user = auth.user();
    if (!user) return inject(Router).createUrlTree(['/login']);
    return roles.includes(user.role) ? true : inject(Router).createUrlTree([auth.homeFor(user.role)]);
  };

export const homeRedirect: CanActivateFn = () => {
  const auth = inject(AuthService);
  return inject(Router).createUrlTree([auth.homeFor(auth.user()?.role)]);
};

export const guestOnly: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.user() ? inject(Router).createUrlTree([auth.homeFor(auth.user()?.role)]) : true;
};
