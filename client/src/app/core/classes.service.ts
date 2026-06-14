import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ClassDetail, ClassListItem, ClassRequest, PagedResult, RosterItem } from './models';

export interface ClassQuery {
  page: number;
  pageSize: number;
  search?: string;
  includeDeleted?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ClassesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/classes`;

  getPaged(query: ClassQuery): Observable<PagedResult<ClassListItem>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.search) params = params.set('search', query.search);
    if (query.includeDeleted) params = params.set('includeDeleted', true);
    return this.http.get<PagedResult<ClassListItem>>(this.apiUrl, { params });
  }

  getById(id: string): Observable<ClassDetail> {
    return this.http.get<ClassDetail>(`${this.apiUrl}/${id}`);
  }

  getRoster(id: string): Observable<RosterItem[]> {
    return this.http.get<RosterItem[]>(`${this.apiUrl}/${id}/roster`);
  }

  create(request: ClassRequest): Observable<ClassDetail> {
    return this.http.post<ClassDetail>(this.apiUrl, request);
  }

  update(id: string, request: ClassRequest): Observable<ClassDetail> {
    return this.http.put<ClassDetail>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  restore(id: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/restore`, {});
  }

  assignTeacher(id: string, teacherId: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}/teacher`, { teacherId });
  }

  enroll(id: string, studentId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/enroll`, { studentId });
  }

  withdraw(id: string, studentId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/students/${studentId}`);
  }
}
