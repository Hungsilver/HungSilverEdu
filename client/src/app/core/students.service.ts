import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PagedResult, RedeemRewardRequest, Student, StudentProgress, StudentRequest } from './models';

export interface StudentQuery {
  page: number;
  pageSize: number;
  search?: string;
  includeDeleted?: boolean;
}

@Injectable({ providedIn: 'root' })
export class StudentsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/students`;

  getPaged(query: StudentQuery): Observable<PagedResult<Student>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.search) params = params.set('search', query.search);
    if (query.includeDeleted) params = params.set('includeDeleted', true);
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
}
