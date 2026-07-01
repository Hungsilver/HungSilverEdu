import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateMaterialRequest, Material, MaterialCategory, MaterialCategoryRequest, MaterialType, PagedResult, UpdateMaterialRequest
} from './models';

@Injectable({ providedIn: 'root' })
export class MaterialsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/materials`;
  private readonly catUrl = `${environment.apiUrl}/material-categories`;

  getByClass(classId: string): Observable<Material[]> {
    const params = new HttpParams().set('classId', classId);
    return this.http.get<Material[]>(this.apiUrl, { params });
  }

  /** Thư viện học liệu chung (không gắn lớp), lọc theo danh mục/loại/khối. */
  getLibrary(categoryId?: string | null, type?: MaterialType | null, gradeBand?: string | null): Observable<Material[]> {
    let params = new HttpParams();
    if (categoryId) params = params.set('categoryId', categoryId);
    if (type) params = params.set('type', type);
    if (gradeBand) params = params.set('gradeBand', gradeBand);
    return this.http.get<Material[]>(`${this.apiUrl}/library`, { params });
  }

  /** Tài liệu theo Môn (lưới phân trang) — trục quản lý mới. */
  getBySubject(subjectId: string, type: MaterialType | null, gradeBand: string | null, page: number, pageSize: number): Observable<PagedResult<Material>> {
    let params = new HttpParams().set('subjectId', subjectId).set('page', page).set('pageSize', pageSize);
    if (type) params = params.set('type', type);
    if (gradeBand) params = params.set('gradeBand', gradeBand);
    return this.http.get<PagedResult<Material>>(`${this.apiUrl}/by-subject`, { params });
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

  // ---- Danh mục học liệu ----
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
