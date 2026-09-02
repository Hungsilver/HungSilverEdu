import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateUserRequest, PagedResult, UpdateUserRequest, UserListItem } from './models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/users`;

  getPaged(page: number, pageSize: number, search?: string, role?: string): Observable<PagedResult<UserListItem>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) params = params.set('search', search);
    if (role) params = params.set('role', role);
    return this.http.get<PagedResult<UserListItem>>(this.apiUrl, { params });
  }

  create(request: CreateUserRequest): Observable<UserListItem> {
    return this.http.post<UserListItem>(this.apiUrl, request);
  }

  update(id: string, request: UpdateUserRequest): Observable<UserListItem> {
    return this.http.put<UserListItem>(`${this.apiUrl}/${id}`, request);
  }

  /** Trống password ⇒ về mật khẩu mặc định của hệ thống. */
  resetPassword(id: string, password: string | null, mustChangePassword: boolean): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/reset-password`, { password, mustChangePassword });
  }

  setLocked(id: string, locked: boolean): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/lock`, { locked });
  }

  assignRoles(id: string, roles: string[]): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}/roles`, { roles });
  }

  softDelete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  restore(id: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/restore`, {});
  }
}
