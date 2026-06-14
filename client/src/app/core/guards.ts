import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? true : router.createUrlTree(['/login']);
};

/** Đã đăng nhập thì không vào lại trang login/register. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? router.createUrlTree(['/']) : true;
};

/** Dùng với route data: { roles: ['Admin'] }. Điều hướng an toàn theo vai trò khi bị từ chối. */
export const roleGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const allowedRoles = (route.data['roles'] as string[] | undefined) ?? [];
  const userRoles = auth.currentUser()?.roles ?? [];

  if (allowedRoles.some(role => userRoles.includes(role))) return true;

  // Học sinh (chỉ role User) → về portal; còn lại → dashboard. Tránh vòng lặp redirect.
  const target = auth.isStudent() && !auth.isAdmin() && !auth.isTeacher() ? '/portal' : '/dashboard';
  return router.createUrlTree([target]);
};
