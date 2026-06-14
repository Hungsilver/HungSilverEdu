import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateTuitionInvoiceRequest, PagedResult, TuitionInvoice, UpdateTuitionInvoiceRequest } from './models';

@Injectable({ providedIn: 'root' })
export class TuitionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/tuition`;

  getPaged(page: number, pageSize: number, studentId?: string): Observable<PagedResult<TuitionInvoice>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (studentId) params = params.set('studentId', studentId);
    return this.http.get<PagedResult<TuitionInvoice>>(this.apiUrl, { params });
  }

  getByStudent(studentId: string): Observable<TuitionInvoice[]> {
    return this.http.get<TuitionInvoice[]>(`${this.apiUrl}/students/${studentId}`);
  }

  create(request: CreateTuitionInvoiceRequest): Observable<TuitionInvoice> {
    return this.http.post<TuitionInvoice>(this.apiUrl, request);
  }

  update(id: string, request: UpdateTuitionInvoiceRequest): Observable<TuitionInvoice> {
    return this.http.put<TuitionInvoice>(`${this.apiUrl}/${id}`, request);
  }

  markPaid(id: string, paidOn: string | null): Observable<TuitionInvoice> {
    return this.http.post<TuitionInvoice>(`${this.apiUrl}/${id}/mark-paid`, { paidOn });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  restore(id: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/restore`, {});
  }
}
