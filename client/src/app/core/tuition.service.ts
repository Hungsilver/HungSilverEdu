import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateTuitionInvoiceRequest, PagedResult, PayStudentTuitionRequest, TuitionBill,
  TuitionInvoice, TuitionStudentListItem, UpdateTuitionInvoiceRequest
} from './models';

export interface TuitionStudentQuery {
  page: number;
  pageSize: number;
  search?: string;
  periodYear: number;
  periodMonth: number;
  dueDate?: string | null;
  branchId?: string;
  subjectId?: string;
  gradeId?: string;
  teacherProfileId?: string;
}

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

  getStudents(query: TuitionStudentQuery): Observable<PagedResult<TuitionStudentListItem>> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize)
      .set('periodYear', query.periodYear)
      .set('periodMonth', query.periodMonth);
    if (query.search) params = params.set('search', query.search);
    if (query.dueDate) params = params.set('dueDate', query.dueDate);
    if (query.branchId) params = params.set('branchId', query.branchId);
    if (query.subjectId) params = params.set('subjectId', query.subjectId);
    if (query.gradeId) params = params.set('gradeId', query.gradeId);
    if (query.teacherProfileId) params = params.set('teacherProfileId', query.teacherProfileId);
    return this.http.get<PagedResult<TuitionStudentListItem>>(`${this.apiUrl}/students`, { params });
  }

  getBill(studentId: string, periodYear: number, periodMonth: number, dueDate?: string | null): Observable<TuitionBill> {
    let params = new HttpParams().set('periodYear', periodYear).set('periodMonth', periodMonth);
    if (dueDate) params = params.set('dueDate', dueDate);
    return this.http.get<TuitionBill>(`${this.apiUrl}/students/${studentId}/bill`, { params });
  }

  payStudent(studentId: string, request: PayStudentTuitionRequest): Observable<TuitionBill> {
    return this.http.post<TuitionBill>(`${this.apiUrl}/students/${studentId}/pay`, request);
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
