import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';
import { ROLE_ADMIN, ROLE_TEACHER, ROLE_USER } from './core/models';

const teacherOrAdmin = { roles: [ROLE_ADMIN, ROLE_TEACHER] };
const adminOnly = { roles: [ROLE_ADMIN] };

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then(m => m.LoginPage)
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register.page').then(m => m.RegisterPage)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then(m => m.Shell),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      {
        path: 'dashboard',
        canActivate: [roleGuard],
        data: adminOnly,
        loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage)
      },
      {
        path: 'students',
        canActivate: [roleGuard],
        data: adminOnly,
        loadComponent: () => import('./features/students/students.page').then(m => m.StudentsPage)
      },
      {
        path: 'students/:id',
        canActivate: [roleGuard],
        data: teacherOrAdmin,
        loadComponent: () => import('./features/students/student-detail.page').then(m => m.StudentDetailPage)
      },
      {
        path: 'classes',
        canActivate: [roleGuard],
        data: teacherOrAdmin,
        loadComponent: () => import('./features/classes/classes.page').then(m => m.ClassesPage)
      },
      {
        path: 'classes/:id',
        canActivate: [roleGuard],
        data: teacherOrAdmin,
        loadComponent: () => import('./features/classes/class-detail.page').then(m => m.ClassDetailPage)
      },
      {
        path: 'schedule',
        canActivate: [roleGuard],
        data: adminOnly,
        loadComponent: () => import('./features/schedule/schedule.page').then(m => m.SchedulePage)
      },
      {
        path: 'sessions/:id',
        canActivate: [roleGuard],
        data: teacherOrAdmin,
        loadComponent: () => import('./features/sessions/session.page').then(m => m.SessionPage)
      },
      {
        path: 'sessions/:id/journal',
        canActivate: [roleGuard],
        data: teacherOrAdmin,
        loadComponent: () => import('./features/sessions/session-journal.page').then(m => m.SessionJournalPage)
      },
      {
        path: 'sessions/:id/report',
        canActivate: [roleGuard],
        data: teacherOrAdmin,
        loadComponent: () => import('./features/sessions/session-report.page').then(m => m.SessionReportPage)
      },
      {
        path: 'settings',
        canActivate: [roleGuard],
        data: { roles: [ROLE_ADMIN] },
        loadComponent: () => import('./features/settings/settings.page').then(m => m.SettingsPage)
      },

      // Demo cũ (giữ làm tham chiếu, không hiện trên menu).
      {
        path: 'products',
        loadComponent: () => import('./features/products/products.page').then(m => m.ProductsPage)
      },
      {
        path: 'admin/users',
        canActivate: [roleGuard],
        data: { roles: [ROLE_ADMIN] },
        loadComponent: () => import('./features/admin/users.page').then(m => m.UsersPage)
      },

      // Giai đoạn 2 — placeholder.
      {
        path: 'tuition',
        canActivate: [roleGuard],
        data: adminOnly,
        loadComponent: () => import('./features/tuition/tuition.page').then(m => m.TuitionPage)
      },
      {
        path: 'materials',
        canActivate: [roleGuard],
        data: { roles: [ROLE_ADMIN, ROLE_TEACHER] },
        loadComponent: () => import('./features/materials/materials.page').then(m => m.MaterialsPage)
      },
      {
        path: 'notifications',
        canActivate: [roleGuard],
        data: adminOnly,
        loadComponent: () => import('./features/notifications/notifications.page').then(m => m.NotificationsPage)
      },
      {
        path: 'evaluations',
        canActivate: [roleGuard],
        data: { roles: [ROLE_ADMIN, ROLE_TEACHER] },
        loadComponent: () => import('./features/evaluations/evaluations.page').then(m => m.EvaluationsPage)
      },
      {
        path: 'warnings',
        canActivate: [roleGuard],
        data: adminOnly,
        loadComponent: () => import('./features/warnings/warnings.page').then(m => m.WarningsPage)
      },
      {
        path: 'portal',
        canActivate: [roleGuard],
        data: { roles: [ROLE_USER] },
        loadComponent: () => import('./features/portal/portal.page').then(m => m.PortalPage)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
