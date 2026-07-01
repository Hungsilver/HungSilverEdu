import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ExamDetail, ExamGenerationResult, ExamListItem, ExamQuestion, ExamStatus, GenerateExamRequest,
  PagedResult, UpdateExamRequest, UpsertQuestionRequest
} from './models';

/** Bộ đề trắc nghiệm: sinh từ tài liệu bằng AI, duyệt/sửa, phát hành. */
@Injectable({ providedIn: 'root' })
export class ExamService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/exams`;

  generate(materialId: string, request: GenerateExamRequest): Observable<ExamGenerationResult> {
    return this.http.post<ExamGenerationResult>(`${this.apiUrl}/generate/${materialId}`, request);
  }

  listByMaterial(materialId: string, page = 1, pageSize = 50): Observable<PagedResult<ExamListItem>> {
    const params = new HttpParams().set('materialId', materialId).set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResult<ExamListItem>>(this.apiUrl, { params });
  }

  listBySubject(subjectId: string, status: ExamStatus | null, page = 1, pageSize = 20): Observable<PagedResult<ExamListItem>> {
    let params = new HttpParams().set('subjectId', subjectId).set('page', page).set('pageSize', pageSize);
    if (status) params = params.set('status', status);
    return this.http.get<PagedResult<ExamListItem>>(this.apiUrl, { params });
  }

  detail(id: string): Observable<ExamDetail> {
    return this.http.get<ExamDetail>(`${this.apiUrl}/${id}`);
  }

  update(id: string, request: UpdateExamRequest): Observable<ExamDetail> {
    return this.http.put<ExamDetail>(`${this.apiUrl}/${id}`, request);
  }

  addQuestion(examId: string, request: UpsertQuestionRequest): Observable<ExamQuestion> {
    return this.http.post<ExamQuestion>(`${this.apiUrl}/${examId}/questions`, request);
  }

  updateQuestion(examId: string, questionId: string, request: UpsertQuestionRequest): Observable<ExamQuestion> {
    return this.http.put<ExamQuestion>(`${this.apiUrl}/${examId}/questions/${questionId}`, request);
  }

  deleteQuestion(examId: string, questionId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${examId}/questions/${questionId}`);
  }

  publish(id: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/publish`, {});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
