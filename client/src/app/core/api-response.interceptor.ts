import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { catchError, map, throwError } from 'rxjs';
import { ApiResponse } from './models';

/**
 * Unwrap ApiResponse wrapper từ backend:
 * - Success: trả body.data thay vì toàn bộ wrapper
 * - isSuccess === false: throw error với message từ server
 * - HTTP error: extract message từ ApiResponse body nếu có
 */
export const apiResponseInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map(event => {
      if (event instanceof HttpResponse && event.body && typeof event.body === 'object' && 'isSuccess' in event.body) {
        const wrapper = event.body as ApiResponse<unknown>;
        if (!wrapper.isSuccess) {
          throw new HttpErrorResponse({
            error: { message: wrapper.message },
            status: wrapper.statusCode,
            statusText: wrapper.message,
            url: event.url ?? undefined
          });
        }
        return event.clone({ body: wrapper.data });
      }
      return event;
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.error && typeof error.error === 'object' && 'isSuccess' in error.error) {
        const wrapper = error.error as ApiResponse<unknown>;
        return throwError(() => new HttpErrorResponse({
          error: { message: wrapper.message },
          status: wrapper.statusCode,
          statusText: wrapper.message,
          url: error.url ?? undefined
        }));
      }
      return throwError(() => error);
    })
  );
};
