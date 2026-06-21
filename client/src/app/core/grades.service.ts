import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Grade, GradeRequest } from './models';

@Injectable({ providedIn: 'root' })
export class GradesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/grades`;

  getAll(includeInactive = false): Observable<Grade[]> {
    return this.http.get<Grade[]>(this.apiUrl, { params: { includeInactive } });
  }

  create(request: GradeRequest): Observable<Grade> {
    return this.http.post<Grade>(this.apiUrl, request);
  }

  update(id: string, request: GradeRequest): Observable<Grade> {
    return this.http.put<Grade>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
