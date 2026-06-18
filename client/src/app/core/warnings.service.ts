import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Warnings } from './models';

@Injectable({ providedIn: 'root' })
export class WarningsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/warnings`;

  getWarnings(classId?: string): Observable<Warnings> {
    let params = new HttpParams();
    if (classId) params = params.set('classId', classId);
    return this.http.get<Warnings>(this.apiUrl, { params });
  }

  /** Cảnh báo của riêng 1 học sinh (nhúng ở chi tiết HS — Đợt 7). */
  getStudentWarnings(studentId: string): Observable<Warnings> {
    const params = new HttpParams().set('studentId', studentId);
    return this.http.get<Warnings>(this.apiUrl, { params });
  }
}
