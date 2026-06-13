import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthResponse } from './models';
import { AuthService } from './auth.service';

// Single-flight: nhiều request 401 cùng lúc chỉ trigger 1 lần refresh.
let refreshInFlight$: Observable<AuthResponse> | null = null;

/** Gắn Bearer token vào request /api; gặp 401 thì thử refresh 1 lần rồi retry. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const authReq = withToken(req, auth.accessToken());

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthEndpoint = req.url.includes('/auth/');
      if (error.status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }

      refreshInFlight$ ??= auth.refresh().pipe(
        finalize(() => (refreshInFlight$ = null)),
        shareReplay(1)
      );

      return refreshInFlight$.pipe(
        switchMap(() => next(withToken(req, auth.accessToken()))),
        catchError((refreshError: HttpErrorResponse) => {
          auth.clearSession();
          void router.navigate(['/login']);
          return throwError(() => refreshError);
        })
      );
    })
  );
};

function withToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;
}
