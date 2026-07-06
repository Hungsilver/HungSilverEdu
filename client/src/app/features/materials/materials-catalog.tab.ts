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
import { MaterialsService } from '../../core/materials.service';
import { MaterialCategory } from '../../core/models';

/**
 * Tab "Danh mục" của Kho tài liệu — chỉ quản lý danh mục thuộc về tài liệu: Loại tài liệu
 * (Teacher + Admin). Môn học & Khối là danh mục dùng chung, quản lý tại module Lớp học → Danh mục.
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
        <p class="muted">Môn học &amp; Khối được quản lý tại Lớp học → Danh mục.</p>
      </section>
    </div>
  `,
  styles: `
    .catalog-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
    .catalog-grid section { max-width: 640px; }
    .catalog-grid form { margin-bottom: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
    .muted { color: var(--hs-text-muted); font-size: 13px; font-weight: 400; margin-top: 12px; }
  `
})
export class MaterialsCatalogTab {
  protected readonly auth = inject(AuthService);
  private readonly materialsService = inject(MaterialsService);
  private readonly message = inject(NzMessageService);

  /** Báo trang cha nạp lại dropdown sau khi danh mục thay đổi. */
  readonly changed = output<void>();

  protected readonly canManage = () => this.auth.isAdmin() || this.auth.isTeacher();

  protected readonly categories = signal<MaterialCategory[]>([]);

  protected readonly editingCategory = signal<MaterialCategory | null>(null);
  protected catName = '';
  protected catSort = 0;

  constructor() {
    this.load();
  }

  private load(): void {
    this.materialsService.getCategories().subscribe(c => this.categories.set(c));
  }

  private onSaved(): void {
    this.load();
    this.changed.emit();
  }

  private showError(err: HttpErrorResponse, fallback: string): void {
    this.message.error(err.error?.message ?? err.message ?? fallback);
  }

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
}
