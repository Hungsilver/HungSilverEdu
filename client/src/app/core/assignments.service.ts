import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Assignment, CreateAssignmentRequest, SubmissionStatus, SubmissionStatusInfo } from './models';

@Injectable({ providedIn: 'root' })
export class AssignmentsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/assignments`;

  getByClass(classId: string): Observable<Assignment[]> {
    const params = new HttpParams().set('classId', classId);
    return this.http.get<Assignment[]>(this.apiUrl, { params });
  }

  getBySession(sessionId: string): Observable<Assignment[]> {
    return this.http.get<Assignment[]>(`${this.apiUrl}/by-session/${sessionId}`);
  }

  create(request: CreateAssignmentRequest): Observable<Assignment> {
    return this.http.post<Assignment>(this.apiUrl, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getSubmissions(id: string): Observable<SubmissionStatusInfo[]> {
    return this.http.get<SubmissionStatusInfo[]>(`${this.apiUrl}/${id}/submissions`);
  }

  setStatus(id: string, studentId: string, status: SubmissionStatus): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}/submissions/${studentId}`, { status });
  }
}
