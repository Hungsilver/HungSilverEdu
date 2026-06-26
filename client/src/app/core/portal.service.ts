import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CalendarSession, PortalAssignment, PortalProfile, SubmitAssignmentRequest } from './models';

@Injectable({ providedIn: 'root' })
export class PortalService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/portal`;

  me(): Observable<PortalProfile> {
    return this.http.get<PortalProfile>(`${this.apiUrl}/me`);
  }

  assignments(): Observable<PortalAssignment[]> {
    return this.http.get<PortalAssignment[]>(`${this.apiUrl}/assignments`);
  }

  /** Lịch học của chính học sinh (các lớp đang học). from/to dạng yyyy-MM-dd. */
  schedule(from: string, to: string): Observable<CalendarSession[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<CalendarSession[]>(`${this.apiUrl}/schedule`, { params });
  }

  submit(id: string, request: SubmitAssignmentRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/assignments/${id}/submit`, request);
  }
}
