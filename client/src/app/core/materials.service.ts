import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateMaterialRequest, Material, MaterialCategory, MaterialCategoryRequest, MaterialPagedFilter, PagedResult,
  StoredFile, UpdateMaterialRequest
} from './models';

@Injectable({ providedIn: 'root' })
export class MaterialsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/materials`;
  private readonly catUrl = `${environment.apiUrl}/material-categories`;

  /** Danh sách tất cả tài liệu (phân trang) — lọc theo môn/loại/khối + search Mã/Tên. */
  getPaged(filter: MaterialPagedFilter): Observable<PagedResult<Material>> {
    let params = new HttpParams().set('page', filter.page).set('pageSize', filter.pageSize);
    if (filter.search?.trim()) params = params.set('search', filter.search.trim());
    if (filter.subjectId) params = params.set('subjectId', filter.subjectId);
    if (filter.categoryId) params = params.set('categoryId', filter.categoryId);
    if (filter.gradeBand) params = params.set('gradeBand', filter.gradeBand);
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
