import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AccountProvisionResult, BulkProvisionResult, CreateTeacherAccountRequest, PagedResult, ProvisionAccountRequest, TeacherDetail, TeacherProfile, TeacherRequest, UnlinkedUser } from './models';

export interface TeacherQuery {
  page: number;
  pageSize: number;
  search?: string;
  includeDeleted?: boolean;
}

@Injectable({ providedIn: 'root' })
export class TeachersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/teachers`;

  getPaged(query: TeacherQuery): Observable<PagedResult<TeacherProfile>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.search) params = params.set('search', query.search);
    if (query.includeDeleted) params = params.set('includeDeleted', true);
    return this.http.get<PagedResult<TeacherProfile>>(this.apiUrl, { params });
  }

  getById(id: string): Observable<TeacherDetail> {
    return this.http.get<TeacherDetail>(`${this.apiUrl}/${id}`);
  }

  create(request: TeacherRequest): Observable<TeacherProfile> {
    return this.http.post<TeacherProfile>(this.apiUrl, request);
  }

  update(id: string, request: TeacherRequest): Observable<TeacherProfile> {
    return this.http.put<TeacherProfile>(`${this.apiUrl}/${id}`, request);
  }

  createAccount(request: CreateTeacherAccountRequest): Observable<TeacherProfile> {
    return this.http.post<TeacherProfile>(`${this.apiUrl}/accounts`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getUnlinkedUsers(): Observable<UnlinkedUser[]> {
    return this.http.get<UnlinkedUser[]>(`${this.apiUrl}/unlinked-users`);
  }

  linkAccount(teacherId: string, userId: string): Observable<TeacherProfile> {
    return this.http.put<TeacherProfile>(`${this.apiUrl}/${teacherId}/link-account`, { userId });
  }

  unlinkAccount(teacherId: string): Observable<TeacherProfile> {
    return this.http.delete<TeacherProfile>(`${this.apiUrl}/${teacherId}/link-account`);
  }

  /** Cấp tài khoản cho hồ sơ GV có sẵn (tên đăng nhập = Mã GV; mật khẩu trống ⇒ mặc định). */
  provisionAccount(teacherId: string, request: ProvisionAccountRequest = {}): Observable<AccountProvisionResult> {
    return this.http.post<AccountProvisionResult>(`${this.apiUrl}/${teacherId}/account`, request);
  }

  /** Cấp tài khoản hàng loạt cho nhiều giáo viên chưa có tài khoản. */
  bulkProvision(ids: string[], password?: string | null): Observable<BulkProvisionResult> {
    return this.http.post<BulkProvisionResult>(`${this.apiUrl}/accounts/provision`, { ids, password });
  }

  /** Đặt lại mật khẩu tài khoản giáo viên (trống ⇒ mật khẩu mặc định, bắt đổi lần đầu). */
  resetPassword(teacherId: string, password?: string | null): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${teacherId}/account/reset-password`, { password });
  }

  /** Khóa/mở khóa đăng nhập tài khoản giáo viên. */
  setLocked(teacherId: string, locked: boolean): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${teacherId}/account/lock`, { locked });
  }
}
