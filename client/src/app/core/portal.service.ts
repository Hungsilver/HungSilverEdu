import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CalendarSession, ExamAttemptResult, PortalAttempt, PortalExam, PortalMaterial, PortalProfile, PortalReview,
  SaveExamAnswerRequest
} from './models';

@Injectable({ providedIn: 'root' })
export class PortalService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/portal`;

  me(): Observable<PortalProfile> {
    return this.http.get<PortalProfile>(`${this.apiUrl}/me`);
  }

  /** Lịch học của chính học sinh (các lớp đang học). from/to dạng yyyy-MM-dd. */
  schedule(from: string, to: string): Observable<CalendarSession[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<CalendarSession[]>(`${this.apiUrl}/schedule`, { params });
  }

  // ---- Tài liệu được giao ----

  myMaterials(): Observable<PortalMaterial[]> {
    return this.http.get<PortalMaterial[]>(`${this.apiUrl}/materials`);
  }

  /** Đánh dấu đã xem (ghi lần đầu, idempotent) — gọi khi học viên mở tài liệu. */
  markMaterialViewed(assignmentId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/materials/${assignmentId}/view`, {});
  }

  // ---- Đề trắc nghiệm (Pha 2) ----

  myExams(): Observable<PortalExam[]> {
    return this.http.get<PortalExam[]>(`${this.apiUrl}/exams`);
  }

  startExam(assignmentId: string): Observable<PortalAttempt> {
    return this.http.post<PortalAttempt>(`${this.apiUrl}/exams/${assignmentId}/start`, {});
  }

  saveExamAnswer(attemptId: string, request: SaveExamAnswerRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/exams/attempts/${attemptId}/answer`, request);
  }

  submitExam(attemptId: string): Observable<ExamAttemptResult> {
    return this.http.post<ExamAttemptResult>(`${this.apiUrl}/exams/attempts/${attemptId}/submit`, {});
  }

  reviewExam(attemptId: string): Observable<PortalReview> {
    return this.http.get<PortalReview>(`${this.apiUrl}/exams/attempts/${attemptId}/review`);
  }
}
