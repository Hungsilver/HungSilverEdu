import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PointReason, PointReasonRequest, PointReasonType } from './models';

@Injectable({ providedIn: 'root' })
export class PointReasonsService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/point-reasons';

  getAll(type?: PointReasonType, includeInactive = false): Observable<PointReason[]> {
    let params = new HttpParams();
    if (type !== undefined) params = params.set('type', type);
    if (includeInactive) params = params.set('includeInactive', 'true');
    return this.http.get<PointReason[]>(this.base, { params });
  }

  create(request: PointReasonRequest): Observable<PointReason> {
    return this.http.post<PointReason>(this.base, request);
  }

  update(id: string, request: PointReasonRequest): Observable<PointReason> {
    return this.http.put<PointReason>(`${this.base}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
