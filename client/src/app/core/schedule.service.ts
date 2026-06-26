import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CalendarSession, CreateSessionRequest, CreateSlotRequest, GenerateSessionsRequest, ScheduleFilter, ScheduleSlot } from './models';

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/schedule`;

  /** from/to dạng yyyy-MM-dd. Bộ lọc tùy chọn (cơ sở/môn/khối/giáo viên). */
  getRange(from: string, to: string, classId?: string, filter?: ScheduleFilter): Observable<CalendarSession[]> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (classId) params = params.set('classId', classId);
    if (filter?.branchId) params = params.set('branchId', filter.branchId);
    if (filter?.subjectId) params = params.set('subjectId', filter.subjectId);
    if (filter?.gradeId) params = params.set('gradeId', filter.gradeId);
    if (filter?.teacherProfileId) params = params.set('teacherProfileId', filter.teacherProfileId);
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
