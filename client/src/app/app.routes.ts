import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';
import { ROLE_ADMIN } from './core/models';

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
      { path: '', redirectTo: 'products', pathMatch: 'full' },
      {
        path: 'products',
        loadComponent: () => import('./features/products/products.page').then(m => m.ProductsPage)
      },
      {
        path: 'admin/users',
        canActivate: [roleGuard],
        data: { roles: [ROLE_ADMIN] },
        loadComponent: () => import('./features/admin/users.page').then(m => m.UsersPage)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
