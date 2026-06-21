import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ClassDetail, ClassImportCommitRequest, ClassImportPreview, ClassImportResult, ClassListItem, ClassRequest, ClassStudentOverview,
  CreateClassStudentRequest, CreateClassStudentResult, PagedResult, RosterItem, StudentImportPreview, StudentImportResult
} from './models';

export interface ClassQuery {
  page: number;
  pageSize: number;
  search?: string;
  includeDeleted?: boolean;
  branchId?: string;
  subjectId?: string;
  gradeId?: string;
  teacherProfileId?: string;
}

@Injectable({ providedIn: 'root' })
export class ClassesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/classes`;

  getPaged(query: ClassQuery): Observable<PagedResult<ClassListItem>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.search) params = params.set('search', query.search);
    if (query.includeDeleted) params = params.set('includeDeleted', true);
    if (query.branchId) params = params.set('branchId', query.branchId);
    if (query.subjectId) params = params.set('subjectId', query.subjectId);
    if (query.gradeId) params = params.set('gradeId', query.gradeId);
    if (query.teacherProfileId) params = params.set('teacherProfileId', query.teacherProfileId);
    return this.http.get<PagedResult<ClassListItem>>(this.apiUrl, { params });
  }

  getById(id: string): Observable<ClassDetail> {
    return this.http.get<ClassDetail>(`${this.apiUrl}/${id}`);
  }

  getRoster(id: string): Observable<RosterItem[]> {
    return this.http.get<RosterItem[]>(`${this.apiUrl}/${id}/roster`);
  }

  getOverview(id: string): Observable<ClassStudentOverview[]> {
    return this.http.get<ClassStudentOverview[]>(`${this.apiUrl}/${id}/overview`);
  }

  create(request: ClassRequest): Observable<ClassDetail> {
    return this.http.post<ClassDetail>(this.apiUrl, request);
  }

  update(id: string, request: ClassRequest): Observable<ClassDetail> {
    return this.http.put<ClassDetail>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  restore(id: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/restore`, {});
  }

  assignTeacher(id: string, teacherProfileId: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}/teacher`, { teacherProfileId });
  }

  enroll(id: string, studentId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/enroll`, { studentId });
  }

  /** Giáo viên/Admin tạo 1 học sinh trong lớp (kèm tài khoản đăng nhập nếu chọn). */
  createStudent(id: string, request: CreateClassStudentRequest): Observable<CreateClassStudentResult> {
    return this.http.post<CreateClassStudentResult>(`${this.apiUrl}/${id}/students`, request);
  }

  withdraw(id: string, studentId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/students/${studentId}`);
  }

  // ---- Import Excel học viên ----
  downloadImportTemplate(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/import-template`, { responseType: 'blob' });
  }

  importPreview(classId: string, file: File): Observable<StudentImportPreview> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<StudentImportPreview>(`${this.apiUrl}/${classId}/import-students/preview`, fd);
  }

  importCommit(classId: string, file: File, createAccounts: boolean): Observable<StudentImportResult> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('createAccounts', String(createAccounts));
    return this.http.post<StudentImportResult>(`${this.apiUrl}/${classId}/import-students`, fd);
  }

  // ---- Import Excel danh sách LỚP (Đợt 7) ----
  downloadClassImportTemplate(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/import-classes-template`, { responseType: 'blob' });
  }

  importClassesPreview(file: File): Observable<ClassImportPreview> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ClassImportPreview>(`${this.apiUrl}/import-classes/preview`, fd);
  }

  importClassesCommit(request: ClassImportCommitRequest): Observable<ClassImportResult> {
    return this.http.post<ClassImportResult>(`${this.apiUrl}/import-classes`, request);
  }

  // ---- Export Excel ----
  exportClasses(query?: Partial<ClassQuery>): Observable<Blob> {
    let params = new HttpParams();
    if (query?.search) params = params.set('search', query.search);
    if (query?.branchId) params = params.set('branchId', query.branchId);
    if (query?.subjectId) params = params.set('subjectId', query.subjectId);
    if (query?.gradeId) params = params.set('gradeId', query.gradeId);
    if (query?.teacherProfileId) params = params.set('teacherProfileId', query.teacherProfileId);
    return this.http.get(`${this.apiUrl}/export`, { params, responseType: 'blob' });
  }
}
