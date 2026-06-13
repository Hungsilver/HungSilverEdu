import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthResponse, ROLE_ADMIN, UserDto } from './models';

/**
 * Access token chỉ giữ trong memory (signal) — không đụng localStorage để tránh XSS.
 * Refresh token nằm trong HttpOnly cookie do backend quản lý; khi reload trang,
 * tryRestoreSession() gọi /auth/refresh để khôi phục phiên từ cookie.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  readonly accessToken = signal<string | null>(null);
  readonly currentUser = signal<UserDto | null>(null);
  readonly isLoggedIn = computed(() => this.currentUser() !== null);
  readonly isAdmin = computed(() => this.currentUser()?.roles.includes(ROLE_ADMIN) ?? false);

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, { email, password })
      .pipe(tap(res => this.setSession(res)));
  }

  register(email: string, password: string, fullName: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/register`, { email, password, fullName })
      .pipe(tap(res => this.setSession(res)));
  }

  googleLogin(idToken: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/google`, { idToken })
      .pipe(tap(res => this.setSession(res)));
  }

  refresh(): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/refresh`, {})
      .pipe(tap(res => this.setSession(res)));
  }

  /** Gọi lúc app khởi động: nếu refresh cookie còn hạn thì tự đăng nhập lại. */
  async tryRestoreSession(): Promise<void> {
    try {
      await firstValueFrom(this.refresh());
    } catch {
      this.clearSession();
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.apiUrl}/logout`, {}));
    } catch {
      // logout là best-effort, vẫn xóa phiên local
    }
    this.clearSession();
    await this.router.navigate(['/login']);
  }

  clearSession(): void {
    this.accessToken.set(null);
    this.currentUser.set(null);
  }

  private setSession(res: AuthResponse): void {
    this.accessToken.set(res.accessToken);
    this.currentUser.set(res.user);
  }
}
