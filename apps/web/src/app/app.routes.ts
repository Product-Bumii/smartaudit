import { Routes } from '@angular/router';
import { authGuard, guestOnly, homeRedirect, roleGuard } from './core/guards';
import { ShellComponent } from './layout/shell.component';

const SUPER = ['SUPERADMIN_BUMII', 'SUPERADMIN_FUNDACION'] as const;

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [homeRedirect], children: [] },
  { path: 'login', canActivate: [guestOnly], loadComponent: () => import('./pages/auth/login.page').then((m) => m.LoginPage) },
  { path: 'auth/verify', loadComponent: () => import('./pages/auth/verify.page').then((m) => m.VerifyPage) },
  // Public participant area (no account). TODO(Fase 2): /i/:token (email invitation) and the interview chat.
  { path: 'c/:slug', loadComponent: () => import('./pages/participant/access-code.page').then((m) => m.AccessCodePage) },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'admin/organizations', canActivate: [roleGuard(...SUPER)], loadComponent: () => import('./pages/admin/organizations.page').then((m) => m.OrganizationsPage) },
      { path: 'admin/organizations/:id', canActivate: [roleGuard(...SUPER)], loadComponent: () => import('./pages/admin/organization-detail.page').then((m) => m.OrganizationDetailPage) },
      {
        path: 'admin/config',
        canActivate: [roleGuard(...SUPER)],
        loadComponent: () => import('./pages/admin/config.page').then((m) => m.ConfigPage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'sampling-tables' },
          { path: 'sampling-tables', loadComponent: () => import('./pages/admin/sampling-tables.page').then((m) => m.SamplingTablesPage) },
          { path: 'questionnaires', loadComponent: () => import('./pages/admin/questionnaires.page').then((m) => m.QuestionnairesPage) },
          { path: 'settings', loadComponent: () => import('./pages/admin/settings.page').then((m) => m.SettingsPage) },
        ],
      },
      { path: 'org/auditors', canActivate: [roleGuard('ORG_ADMIN')], loadComponent: () => import('./pages/org/auditors.page').then((m) => m.AuditorsPage) },
      { path: 'campaigns', canActivate: [roleGuard('AUDITOR', ...SUPER)], loadComponent: () => import('./pages/campaigns/campaign-list.page').then((m) => m.CampaignListPage) },
      { path: 'campaigns/new', canActivate: [roleGuard('AUDITOR')], loadComponent: () => import('./pages/campaigns/campaign-form.page').then((m) => m.CampaignFormPage) },
      { path: 'campaigns/:id/edit', canActivate: [roleGuard('AUDITOR')], loadComponent: () => import('./pages/campaigns/campaign-form.page').then((m) => m.CampaignFormPage) },
      { path: 'campaigns/:id', canActivate: [roleGuard('AUDITOR', ...SUPER)], loadComponent: () => import('./pages/campaigns/campaign-detail.page').then((m) => m.CampaignDetailPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
