import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AddPointRequest,
  GeneratedReport,
  PointEntry,
  SaveAttendanceRow,
  SessionSheet,
  TeacherJournal,
  UpsertJournalRequest
} from './models';

@Injectable({ providedIn: 'root' })
export class SessionsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/sessions`;

  getSheet(sessionId: string): Observable<SessionSheet> {
    return this.http.get<SessionSheet>(`${this.apiUrl}/${sessionId}/sheet`);
  }

  saveAttendance(sessionId: string, entries: SaveAttendanceRow[]): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${sessionId}/attendance`, { entries });
  }

  addPoint(sessionId: string, request: AddPointRequest): Observable<PointEntry> {
    return this.http.post<PointEntry>(`${this.apiUrl}/${sessionId}/points`, request);
  }

  removePoint(entryId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/points/${entryId}`);
  }

  getJournal(sessionId: string): Observable<TeacherJournal | null> {
    return this.http.get<TeacherJournal | null>(`${this.apiUrl}/${sessionId}/journal`);
  }

  saveJournal(sessionId: string, request: UpsertJournalRequest): Observable<TeacherJournal> {
    return this.http.put<TeacherJournal>(`${this.apiUrl}/${sessionId}/journal`, request);
  }

  generateReport(sessionId: string): Observable<GeneratedReport> {
    return this.http.post<GeneratedReport>(`${this.apiUrl}/${sessionId}/report/generate`, {});
  }
}
