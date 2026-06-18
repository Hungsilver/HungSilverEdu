import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Subject, SubjectRequest } from './models';

@Injectable({ providedIn: 'root' })
export class SubjectsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/subjects`;

  getAll(includeInactive = false): Observable<Subject[]> {
    let params = new HttpParams();
    if (includeInactive) params = params.set('includeInactive', true);
    return this.http.get<Subject[]>(this.apiUrl, { params });
  }

  create(request: SubjectRequest): Observable<Subject> {
    return this.http.post<Subject>(this.apiUrl, request);
  }

  update(id: string, request: SubjectRequest): Observable<Subject> {
    return this.http.put<Subject>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
