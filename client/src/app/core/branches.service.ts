import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Branch, BranchRequest } from './models';

@Injectable({ providedIn: 'root' })
export class BranchesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/branches`;

  getAll(includeInactive = false): Observable<Branch[]> {
    let params = new HttpParams();
    if (includeInactive) params = params.set('includeInactive', true);
    return this.http.get<Branch[]>(this.apiUrl, { params });
  }

  create(request: BranchRequest): Observable<Branch> {
    return this.http.post<Branch>(this.apiUrl, request);
  }

  update(id: string, request: BranchRequest): Observable<Branch> {
    return this.http.put<Branch>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
