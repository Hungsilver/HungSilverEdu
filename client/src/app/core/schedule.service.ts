import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CalendarSession, CreateSessionRequest, CreateSlotRequest, GenerateSessionsRequest, ScheduleSlot } from './models';

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/schedule`;

  /** from/to dạng yyyy-MM-dd. */
  getRange(from: string, to: string, classId?: string): Observable<CalendarSession[]> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (classId) params = params.set('classId', classId);
    return this.http.get<CalendarSession[]>(this.apiUrl, { params });
  }

  getSlots(classId: string): Observable<ScheduleSlot[]> {
    return this.http.get<ScheduleSlot[]>(`${this.apiUrl}/classes/${classId}/slots`);
  }

  addSlot(request: CreateSlotRequest): Observable<ScheduleSlot> {
    return this.http.post<ScheduleSlot>(`${this.apiUrl}/slots`, request);
  }

  removeSlot(slotId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/slots/${slotId}`);
  }

  generateSessions(classId: string, request: GenerateSessionsRequest): Observable<number> {
    return this.http.post<number>(`${this.apiUrl}/classes/${classId}/generate-sessions`, request);
  }

  createSession(request: CreateSessionRequest): Observable<CalendarSession> {
    return this.http.post<CalendarSession>(`${this.apiUrl}/sessions`, request);
  }

  cancelSession(sessionId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/sessions/${sessionId}/cancel`, {});
  }
}
