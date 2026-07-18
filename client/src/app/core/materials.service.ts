import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AssignMaterialRequest, CreateMaterialFolderRequest, CreateMaterialRequest, CreateMaterialUnitRequest, Material,
  MaterialAssignment, MaterialAssignmentViewer, MaterialCategory, MaterialCategoryRequest, MaterialFolder,
  MaterialPagedFilter, MaterialSubjectSummary, MaterialUnit, PagedResult, StoredFile, UpdateMaterialFolderRequest,
  UpdateMaterialRequest, UpdateMaterialUnitRequest
} from './models';

@Injectable({ providedIn: 'root' })
export class MaterialsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/materials`;
  private readonly catUrl = `${environment.apiUrl}/material-categories`;
  private readonly folderUrl = `${environment.apiUrl}/material-folders`;
  private readonly unitUrl = `${environment.apiUrl}/material-units`;

  /** Danh sách tất cả tài liệu (phân trang) — lọc theo môn/loại/khối + search Mã/Tên. */
  getPaged(filter: MaterialPagedFilter): Observable<PagedResult<Material>> {
    let params = new HttpParams().set('page', filter.page).set('pageSize', filter.pageSize);
    if (filter.search?.trim()) params = params.set('search', filter.search.trim());
    if (filter.subjectId) params = params.set('subjectId', filter.subjectId);
    if (filter.categoryId) params = params.set('categoryId', filter.categoryId);
    if (filter.gradeBand) params = params.set('gradeBand', filter.gradeBand);
    if (filter.folderId) params = params.set('folderId', filter.folderId);
    if (filter.generalOnly) params = params.set('generalOnly', 'true');
    if (filter.unitId) params = params.set('unitId', filter.unitId);
    if (filter.noUnit) params = params.set('noUnit', 'true');
    return this.http.get<PagedResult<Material>>(this.apiUrl, { params });
  }

  create(request: CreateMaterialRequest): Observable<Material> {
    return this.http.post<Material>(this.apiUrl, request);
  }

  update(id: string, request: UpdateMaterialRequest): Observable<Material> {
    return this.http.put<Material>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /** Upload ảnh bìa tài liệu (đã crop 16:9) — file Public, hiển thị trực tiếp qua <img>. */
  uploadCover(file: File): Observable<StoredFile> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<StoredFile>(`${this.apiUrl}/cover-image`, form);
  }

  // ---- Giao tài liệu cho lớp (2026-07-16) ----

  /** Giao tài liệu cho lớp (tùy chọn gắn buổi) — học viên xem ở Portal. */
  assign(materialId: string, request: AssignMaterialRequest): Observable<MaterialAssignment> {
    return this.http.post<MaterialAssignment>(`${this.apiUrl}/${materialId}/assign`, request);
  }

  listAssignmentsByClass(classId: string): Observable<MaterialAssignment[]> {
    return this.http.get<MaterialAssignment[]>(`${this.apiUrl}/assignments/by-class/${classId}`);
  }

  listAssignmentsBySession(sessionId: string): Observable<MaterialAssignment[]> {
    return this.http.get<MaterialAssignment[]>(`${this.apiUrl}/assignments/by-session/${sessionId}`);
  }

  /** Thu hồi lượt giao — tài liệu biến mất khỏi Portal của lớp. */
  removeAssignment(assignmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/assignments/${assignmentId}`);
  }

  /** Trạng thái đã xem per-student của một lượt giao. */
  assignmentViewers(assignmentId: string): Observable<MaterialAssignmentViewer[]> {
    return this.http.get<MaterialAssignmentViewer[]>(`${this.apiUrl}/assignments/${assignmentId}/viewers`);
  }

  // ---- Bộ tài liệu (MaterialFolder) — phân cấp Môn → Bộ → Tài liệu ----

  /** Mức 1 tab "Tài liệu môn học": danh sách môn kèm số bộ + số tài liệu. */
  getSubjectsSummary(): Observable<MaterialSubjectSummary[]> {
    return this.http.get<MaterialSubjectSummary[]>(`${this.folderUrl}/subjects-summary`);
  }

  getFolders(subjectId: string): Observable<MaterialFolder[]> {
    const params = new HttpParams().set('subjectId', subjectId);
    return this.http.get<MaterialFolder[]>(this.folderUrl, { params });
  }

  /** Một bộ theo id — màn chi tiết bộ (deep-link/F5) nạp trực tiếp. */
  getFolder(id: string): Observable<MaterialFolder> {
    return this.http.get<MaterialFolder>(`${this.folderUrl}/${id}`);
  }

  createFolder(request: CreateMaterialFolderRequest): Observable<MaterialFolder> {
    return this.http.post<MaterialFolder>(this.folderUrl, request);
  }

  updateFolder(id: string, request: UpdateMaterialFolderRequest): Observable<MaterialFolder> {
    return this.http.put<MaterialFolder>(`${this.folderUrl}/${id}`, request);
  }

  deleteFolder(id: string): Observable<void> {
    return this.http.delete<void>(`${this.folderUrl}/${id}`);
  }

  // ---- Unit/Chương trong bộ (MaterialUnit) — Bộ → Unit → Tài liệu ----

  /** Danh sách unit của một bộ, server đã sort + đánh số hiển thị (Unit 1/2…, Review 1/2… đếm riêng). */
  getUnits(folderId: string): Observable<MaterialUnit[]> {
    const params = new HttpParams().set('folderId', folderId);
    return this.http.get<MaterialUnit[]>(this.unitUrl, { params });
  }

  createUnit(request: CreateMaterialUnitRequest): Observable<MaterialUnit> {
    return this.http.post<MaterialUnit>(this.unitUrl, request);
  }

  updateUnit(id: string, request: UpdateMaterialUnitRequest): Observable<MaterialUnit> {
    return this.http.put<MaterialUnit>(`${this.unitUrl}/${id}`, request);
  }

  deleteUnit(id: string): Observable<void> {
    return this.http.delete<void>(`${this.unitUrl}/${id}`);
  }

  /** Sắp xếp lại toàn bộ unit của bộ trong 1 call — orderedIds phải khớp chính xác tập unit hiện có. */
  reorderUnits(folderId: string, orderedIds: string[]): Observable<MaterialUnit[]> {
    return this.http.put<MaterialUnit[]>(`${this.unitUrl}/reorder`, { folderId, orderedIds });
  }

  // ---- Loại tài liệu (MaterialCategory) ----
  getCategories(): Observable<MaterialCategory[]> {
    return this.http.get<MaterialCategory[]>(this.catUrl);
  }

  createCategory(request: MaterialCategoryRequest): Observable<MaterialCategory> {
    return this.http.post<MaterialCategory>(this.catUrl, request);
  }

  updateCategory(id: string, request: MaterialCategoryRequest): Observable<MaterialCategory> {
    return this.http.put<MaterialCategory>(`${this.catUrl}/${id}`, request);
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.catUrl}/${id}`);
  }
}
