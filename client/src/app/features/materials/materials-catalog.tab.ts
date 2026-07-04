import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { AuthService } from '../../core/auth.service';
import { GradesService } from '../../core/grades.service';
import { MaterialsService } from '../../core/materials.service';
import { SubjectsService } from '../../core/subjects.service';
import { Grade, GradeRequest, MaterialCategory, Subject, SubjectRequest } from '../../core/models';

/**
 * Tab "Danh mục" của Kho tài liệu — CRUD dữ liệu nguồn cho các dropdown của form tạo tài liệu:
 * Loại tài liệu (Teacher + Admin), Môn học và Khối (chỉ Admin sửa — dùng chung với module Lớp học).
 * Phát `(changed)` sau mỗi thay đổi để trang cha nạp lại dropdown.
 */
@Component({
  selector: 'app-materials-catalog-tab',
  imports: [
    FormsModule, NzButtonModule, NzFormModule, NzIconModule, NzInputModule, NzInputNumberModule,
    NzPopconfirmModule, NzTableModule, NzTooltipModule
  ],
  template: `
    <div class="catalog-grid">
      <section>
        <h3>Loại tài liệu</h3>
        @if (canManage()) {
          <form nz-form nzLayout="inline">
            <input nz-input placeholder="Tên loại tài liệu" [(ngModel)]="catName" name="catName" />
            <nz-input-number [(ngModel)]="catSort" name="catSort" [nzMin]="0" nzPlaceHolder="Thứ tự" />
            <button nz-button nzType="primary" (click)="saveCategory()">{{ editingCategory() ? 'Cập nhật' : 'Thêm' }}</button>
            @if (editingCategory()) { <button nz-button (click)="resetCategory()">Hủy</button> }
          </form>
        }
        <nz-table [nzData]="categories()" [nzFrontPagination]="false" nzSize="small">
          <thead><tr><th nzWidth="64px" style="white-space: nowrap">STT</th><th>Tên</th>@if (canManage()) { <th>Thao tác</th> }</tr></thead>
          <tbody>
            @for (c of categories(); track c.id; let i = $index) {
              <tr><td>{{ i + 1 }}</td><td>{{ c.name }}</td>
                @if (canManage()) {
                  <td>
                    <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Sửa loại tài liệu" aria-label="Sửa loại tài liệu" (click)="editCategory(c)"><nz-icon nzType="edit" /></button>
                    <button nz-button nzType="link" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa loại tài liệu" aria-label="Xóa loại tài liệu"
                      nz-popconfirm nzPopconfirmTitle="Xóa loại tài liệu này?" (nzOnConfirm)="deleteCategory(c)"><nz-icon nzType="delete" /></button>
                  </td>
                }
              </tr>
            }
          </tbody>
        </nz-table>
      </section>

      <section>
        <h3>Môn học @if (!auth.isAdmin()) { <span class="muted">(chỉ Admin sửa)</span> }</h3>
        @if (auth.isAdmin()) {
          <form nz-form nzLayout="inline">
            <input nz-input placeholder="Tên môn" [(ngModel)]="subjectName" name="subjectName" />
            <nz-input-number [(ngModel)]="subjectIndex" name="subjectIndex" [nzMin]="0" nzPlaceHolder="Thứ tự" />
            <button nz-button nzType="primary" (click)="saveSubject()">{{ editingSubject() ? 'Cập nhật' : 'Thêm' }}</button>
            @if (editingSubject()) { <button nz-button (click)="resetSubject()">Hủy</button> }
          </form>
        }
        <nz-table [nzData]="subjects()" [nzFrontPagination]="false" nzSize="small">
          <thead><tr><th nzWidth="64px" style="white-space: nowrap">STT</th><th>Mã</th><th>Tên</th>@if (auth.isAdmin()) { <th>Thao tác</th> }</tr></thead>
          <tbody>
            @for (s of subjects(); track s.id; let i = $index) {
              <tr><td>{{ i + 1 }}</td><td>{{ s.code }}</td><td>{{ s.name }}</td>
                @if (auth.isAdmin()) {
                  <td>
                    <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Sửa môn" aria-label="Sửa môn" (click)="editSubject(s)"><nz-icon nzType="edit" /></button>
                    <button nz-button nzType="link" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa môn" aria-label="Xóa môn"
                      nz-popconfirm nzPopconfirmTitle="Xóa môn?" (nzOnConfirm)="deleteSubject(s)"><nz-icon nzType="delete" /></button>
                  </td>
                }
              </tr>
            }
          </tbody>
        </nz-table>
      </section>

      <section>
        <h3>Khối @if (!auth.isAdmin()) { <span class="muted">(chỉ Admin sửa)</span> }</h3>
        @if (auth.isAdmin()) {
          <form nz-form nzLayout="inline">
            <input nz-input placeholder="Tên khối" [(ngModel)]="gradeName" name="gradeName" />
            <nz-input-number [(ngModel)]="gradeIndex" name="gradeIndex" [nzMin]="0" nzPlaceHolder="Thứ tự" />
            <button nz-button nzType="primary" (click)="saveGrade()">{{ editingGrade() ? 'Cập nhật' : 'Thêm' }}</button>
            @if (editingGrade()) { <button nz-button (click)="resetGrade()">Hủy</button> }
          </form>
        }
        <nz-table [nzData]="grades()" [nzFrontPagination]="false" nzSize="small">
          <thead><tr><th nzWidth="64px" style="white-space: nowrap">STT</th><th>Mã</th><th>Tên</th>@if (auth.isAdmin()) { <th>Thao tác</th> }</tr></thead>
          <tbody>
            @for (g of grades(); track g.id; let i = $index) {
              <tr><td>{{ i + 1 }}</td><td>{{ g.code }}</td><td>{{ g.name }}</td>
                @if (auth.isAdmin()) {
                  <td>
                    <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Sửa khối" aria-label="Sửa khối" (click)="editGrade(g)"><nz-icon nzType="edit" /></button>
                    <button nz-button nzType="link" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa khối" aria-label="Xóa khối"
                      nz-popconfirm nzPopconfirmTitle="Xóa khối?" (nzOnConfirm)="deleteGrade(g)"><nz-icon nzType="delete" /></button>
                  </td>
                }
              </tr>
            }
          </tbody>
        </nz-table>
      </section>
    </div>
  `,
  styles: `
    .catalog-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
    .catalog-grid form { margin-bottom: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
    .muted { color: var(--hs-text-muted); font-size: 13px; font-weight: 400; }
  `
})
export class MaterialsCatalogTab {
  protected readonly auth = inject(AuthService);
  private readonly materialsService = inject(MaterialsService);
  private readonly subjectsService = inject(SubjectsService);
  private readonly gradesService = inject(GradesService);
  private readonly message = inject(NzMessageService);

  /** Báo trang cha nạp lại dropdown sau khi danh mục thay đổi. */
  readonly changed = output<void>();

  protected readonly canManage = () => this.auth.isAdmin() || this.auth.isTeacher();

  protected readonly categories = signal<MaterialCategory[]>([]);
  protected readonly subjects = signal<Subject[]>([]);
  protected readonly grades = signal<Grade[]>([]);

  protected readonly editingCategory = signal<MaterialCategory | null>(null);
  protected catName = '';
  protected catSort = 0;
  protected readonly editingSubject = signal<Subject | null>(null);
  protected subjectName = '';
  protected subjectIndex = 0;
  protected readonly editingGrade = signal<Grade | null>(null);
  protected gradeName = '';
  protected gradeIndex = 0;

  constructor() {
    this.load();
  }

  private load(): void {
    this.materialsService.getCategories().subscribe(c => this.categories.set(c));
    this.subjectsService.getAll().subscribe(s => this.subjects.set(s));
    this.gradesService.getAll().subscribe(g => this.grades.set(g));
  }

  private onSaved(): void {
    this.load();
    this.changed.emit();
  }

  private showError(err: HttpErrorResponse, fallback: string): void {
    this.message.error(err.error?.message ?? err.message ?? fallback);
  }

  // ---- Loại tài liệu ----
  protected saveCategory(): void {
    const name = this.catName.trim();
    if (!name) { this.message.warning('Nhập tên loại tài liệu.'); return; }
    const body = { name, description: null, sortOrder: this.catSort };
    const editing = this.editingCategory();
    const op = editing ? this.materialsService.updateCategory(editing.id, body) : this.materialsService.createCategory(body);
    op.subscribe({ next: () => { this.resetCategory(); this.onSaved(); }, error: err => this.showError(err, 'Lưu loại tài liệu thất bại.') });
  }
  protected editCategory(c: MaterialCategory): void { this.editingCategory.set(c); this.catName = c.name; this.catSort = c.sortOrder; }
  protected resetCategory(): void { this.editingCategory.set(null); this.catName = ''; this.catSort = 0; }
  protected deleteCategory(c: MaterialCategory): void {
    this.materialsService.deleteCategory(c.id).subscribe({ next: () => this.onSaved(), error: err => this.showError(err, 'Xóa loại tài liệu thất bại.') });
  }

  // ---- Môn học (chỉ Admin — BE đã chặn) ----
  protected saveSubject(): void {
    const req: SubjectRequest = { name: this.subjectName.trim(), description: null, indexOrder: this.subjectIndex, isActive: true };
    if (!req.name) return;
    const editing = this.editingSubject();
    const op = editing ? this.subjectsService.update(editing.id, req) : this.subjectsService.create(req);
    op.subscribe({ next: () => { this.resetSubject(); this.onSaved(); }, error: err => this.showError(err, 'Lưu môn thất bại.') });
  }
  protected editSubject(s: Subject): void { this.editingSubject.set(s); this.subjectName = s.name; this.subjectIndex = s.indexOrder; }
  protected resetSubject(): void { this.editingSubject.set(null); this.subjectName = ''; this.subjectIndex = 0; }
  protected deleteSubject(s: Subject): void {
    this.subjectsService.delete(s.id).subscribe({ next: () => this.onSaved(), error: err => this.showError(err, 'Xóa môn thất bại.') });
  }

  // ---- Khối (chỉ Admin — BE đã chặn) ----
  protected saveGrade(): void {
    const req: GradeRequest = { name: this.gradeName.trim(), indexOrder: this.gradeIndex, isActive: true };
    if (!req.name) return;
    const editing = this.editingGrade();
    const op = editing ? this.gradesService.update(editing.id, req) : this.gradesService.create(req);
    op.subscribe({ next: () => { this.resetGrade(); this.onSaved(); }, error: err => this.showError(err, 'Lưu khối thất bại.') });
  }
  protected editGrade(g: Grade): void { this.editingGrade.set(g); this.gradeName = g.name; this.gradeIndex = g.indexOrder; }
  protected resetGrade(): void { this.editingGrade.set(null); this.gradeName = ''; this.gradeIndex = 0; }
  protected deleteGrade(g: Grade): void {
    this.gradesService.delete(g.id).subscribe({ next: () => this.onSaved(), error: err => this.showError(err, 'Xóa khối thất bại.') });
  }
}
