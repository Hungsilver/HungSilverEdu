import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PagedResult, ParentReport, RedeemRewardRequest, Student, StudentProgress, StudentRequest } from './models';

export interface StudentQuery {
  page: number;
  pageSize: number;
  search?: string;
  includeDeleted?: boolean;
  branchId?: string;
  subjectId?: string;
  gradeId?: string;
  teacherProfileId?: string;
}

@Injectable({ providedIn: 'root' })
export class StudentsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/students`;

  getPaged(query: StudentQuery): Observable<PagedResult<Student>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.search) params = params.set('search', query.search);
    if (query.includeDeleted) params = params.set('includeDeleted', true);
    if (query.branchId) params = params.set('branchId', query.branchId);
    if (query.subjectId) params = params.set('subjectId', query.subjectId);
    if (query.gradeId) params = params.set('gradeId', query.gradeId);
    if (query.teacherProfileId) params = params.set('teacherProfileId', query.teacherProfileId);
    return this.http.get<PagedResult<Student>>(this.apiUrl, { params });
  }

  getById(id: string): Observable<Student> {
    return this.http.get<Student>(`${this.apiUrl}/${id}`);
  }

  create(request: StudentRequest): Observable<Student> {
    return this.http.post<Student>(this.apiUrl, request);
  }

  update(id: string, request: StudentRequest): Observable<Student> {
    return this.http.put<Student>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  restore(id: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/restore`, {});
  }

  getProgress(studentId: string): Observable<StudentProgress> {
    return this.http.get<StudentProgress>(`${this.apiUrl}/${studentId}/progress`);
  }

  redeem(studentId: string, request: RedeemRewardRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${studentId}/redeem`, request);
  }

  generateParentReport(studentId: string, year: number, month: number): Observable<ParentReport> {
    const params = new HttpParams().set('year', year).set('month', month);
    return this.http.post<ParentReport>(`${this.apiUrl}/${studentId}/parent-report`, {}, { params });
  }

  linkUser(studentId: string, userId: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${studentId}/link-user`, { userId });
  }

  /** Giáo viên/Admin đặt lại mật khẩu tài khoản học sinh. */
  resetPassword(studentId: string, newPassword: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${studentId}/password`, { newPassword });
  }
}
