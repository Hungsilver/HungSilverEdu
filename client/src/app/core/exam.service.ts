import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AssignExamRequest, CreateExamFromQuestionsRequest, CreateExamFromQuestionsResult, ExamAssignment, ExamDetail,
  ExamGenerationJob, ExamGenerationJobStartResult, ExamListItem, ExamQuestion, ExamQuestionBankFilter,
  ExamQuestionBankItem, ExamQuestionIdsResult, ExamReport, ExamStatus, GenerateExamRequest, PagedResult,
  TeacherAttemptReview, UpdateExamRequest, UpsertQuestionRequest
} from './models';

/** Bộ đề trắc nghiệm: sinh từ tài liệu bằng AI, duyệt/sửa, phát hành. */
@Injectable({ providedIn: 'root' })
export class ExamService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/exams`;

  startGeneration(materialId: string, request: GenerateExamRequest): Observable<ExamGenerationJobStartResult> {
    return this.http.post<ExamGenerationJobStartResult>(`${this.apiUrl}/generate/${materialId}`, request);
  }

  startGenerationFromUpload(sourceMaterialId: string, form: FormData): Observable<ExamGenerationJobStartResult> {
    return this.http.post<ExamGenerationJobStartResult>(`${this.apiUrl}/generate-upload/${sourceMaterialId}`, form);
  }

  getGenerationJob(jobId: string): Observable<ExamGenerationJob> {
    return this.http.get<ExamGenerationJob>(`${this.apiUrl}/generation-jobs/${jobId}`);
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

  // ---- Ngân hàng câu hỏi ----

  listQuestions(filter: ExamQuestionBankFilter): Observable<PagedResult<ExamQuestionBankItem>> {
    return this.http.get<PagedResult<ExamQuestionBankItem>>(`${this.apiUrl}/questions`, { params: this.bankParams(filter) });
  }

  /** Toàn bộ id câu hỏi khớp bộ lọc (phục vụ "chọn tất cả" — server cap 1000). */
  listQuestionIds(filter: ExamQuestionBankFilter): Observable<ExamQuestionIdsResult> {
    return this.http.get<ExamQuestionIdsResult>(`${this.apiUrl}/questions/ids`, { params: this.bankParams(filter) });
  }

  createFromQuestions(request: CreateExamFromQuestionsRequest): Observable<CreateExamFromQuestionsResult> {
    return this.http.post<CreateExamFromQuestionsResult>(`${this.apiUrl}/from-questions`, request);
  }

  /** Nhân bản nguyên trạng 1 đề thành đề Draft mới. */
  duplicate(examId: string): Observable<CreateExamFromQuestionsResult> {
    return this.http.post<CreateExamFromQuestionsResult>(`${this.apiUrl}/${examId}/duplicate`, {});
  }

  private bankParams(filter: ExamQuestionBankFilter): HttpParams {
    let params = new HttpParams().set('page', filter.page).set('pageSize', filter.pageSize);
    if (filter.search?.trim()) params = params.set('search', filter.search.trim());
    if (filter.subjectId) params = params.set('subjectId', filter.subjectId);
    if (filter.gradeBand) params = params.set('gradeBand', filter.gradeBand);
    if (filter.materialId) params = params.set('materialId', filter.materialId);
    if (filter.examId) params = params.set('examId', filter.examId);
    if (filter.type) params = params.set('type', filter.type);
    if (filter.examStatus) params = params.set('examStatus', filter.examStatus);
    return params;
  }

  // ---- Giao đề cho lớp (Pha 2) ----

  assign(examId: string, request: AssignExamRequest): Observable<ExamAssignment> {
    return this.http.post<ExamAssignment>(`${this.apiUrl}/${examId}/assign`, request);
  }

  listAssignments(examId: string): Observable<ExamAssignment[]> {
    return this.http.get<ExamAssignment[]>(`${this.apiUrl}/${examId}/assignments`);
  }

  /** Các lượt giao gắn với một buổi học (section Bài tập trong màn hình buổi học). */
  listBySession(sessionId: string): Observable<ExamAssignment[]> {
    return this.http.get<ExamAssignment[]>(`${this.apiUrl}/assignments/by-session/${sessionId}`);
  }

  /** Mọi lượt giao của một lớp (section Bài tập trong trang chi tiết lớp). */
  listByClass(classId: string): Observable<ExamAssignment[]> {
    return this.http.get<ExamAssignment[]>(`${this.apiUrl}/assignments/by-class/${classId}`);
  }

  /** GV xem bài làm một học viên đã nộp. */
  attemptReview(attemptId: string): Observable<TeacherAttemptReview> {
    return this.http.get<TeacherAttemptReview>(`${this.apiUrl}/attempts/${attemptId}/review`);
  }

  closeAssignment(assignmentId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/assignments/${assignmentId}/close`, {});
  }

  report(assignmentId: string): Observable<ExamReport> {
    return this.http.get<ExamReport>(`${this.apiUrl}/assignments/${assignmentId}/report`);
  }
}
