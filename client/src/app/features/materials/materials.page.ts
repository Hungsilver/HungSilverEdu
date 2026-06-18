import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzUploadModule, NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import { AuthService } from '../../core/auth.service';
import { ClassesService } from '../../core/classes.service';
import { FilesService } from '../../core/files.service';
import { MaterialsService } from '../../core/materials.service';
import {
  ClassListItem, CreateMaterialRequest, FileStorageMode, Material, MaterialCategory, MaterialSource,
  MaterialType, MATERIAL_TYPE_LABELS
} from '../../core/models';
import { ScreenService } from '../../core/screen.service';
import { SettingsService } from '../../core/settings.service';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-materials-page',
  imports: [
    FormsModule, ReactiveFormsModule,
    NzTableModule, NzButtonModule, NzCardModule, NzIconModule, NzTagModule, NzSelectModule, NzRadioModule, NzInputNumberModule,
    NzModalModule, NzFormModule, NzInputModule, NzPopconfirmModule, NzUploadModule, PageHeader
  ],
  template: `
    <app-page-header title="Kho tài liệu" subtitle="Học liệu theo lớp hoặc thư viện chung theo danh mục" icon="link">
      <div class="actions">
        <nz-radio-group [(ngModel)]="mode" (ngModelChange)="onModeChange()" nzButtonStyle="solid">
          <label nz-radio-button nzValue="class">Theo lớp</label>
          <label nz-radio-button nzValue="library">Thư viện</label>
        </nz-radio-group>
        @if (auth.isAdmin()) {
          <button nz-button (click)="openCatManager()"><nz-icon nzType="setting" /> Danh mục</button>
        }
      </div>
    </app-page-header>

    <div class="filters">
      @if (mode === 'class') {
        <nz-select class="cls" nzShowSearch nzPlaceHolder="Chọn lớp" [(ngModel)]="classId" (ngModelChange)="loadMaterials()">
          @for (c of classes(); track c.id) { <nz-option [nzValue]="c.id" [nzLabel]="c.name" /> }
        </nz-select>
      } @else {
        <nz-select class="cls" nzAllowClear nzPlaceHolder="Tất cả danh mục" [(ngModel)]="libCategoryId" (ngModelChange)="loadMaterials()">
          @for (c of categories(); track c.id) { <nz-option [nzValue]="c.id" [nzLabel]="c.name" /> }
        </nz-select>
        <nz-select class="cls" nzAllowClear nzPlaceHolder="Tất cả loại" [(ngModel)]="libType" (ngModelChange)="loadMaterials()">
          @for (t of types; track t) { <nz-option [nzValue]="t" [nzLabel]="typeLabels[t]" /> }
        </nz-select>
        <nz-select class="cls" nzAllowClear nzShowSearch nzPlaceHolder="Tất cả khối" [(ngModel)]="libGradeBand" (ngModelChange)="loadMaterials()">
          @for (b of gradeBands(); track b) { <nz-option [nzValue]="b" [nzLabel]="b" /> }
        </nz-select>
      }
      <button nz-button nzType="primary" [disabled]="mode === 'class' && !classId" (click)="openCreate()">
        <nz-icon nzType="plus" /> Thêm tài liệu
      </button>
    </div>

    @if (mode === 'library' || classId) {
      @if (screen.isMobile()) {
        <div class="mobile-card-list">
          @for (m of materials(); track m.id) {
            <nz-card>
              <div class="card-header">
                <span class="card-title">{{ m.title }}</span>
                <nz-tag>{{ typeLabels[m.type] }}</nz-tag>
              </div>
              <div class="card-field"><span class="label">Danh mục</span><span>{{ m.categoryName || '—' }}</span></div>
              <div class="card-field"><span class="label">Khối</span><span>{{ m.gradeBand || '—' }}</span></div>
              <div class="card-field"><span class="label">Mô tả</span><span>{{ m.description || '—' }}</span></div>
              <div class="card-actions">
                <a nz-button nzSize="small" [href]="m.downloadUrl" target="_blank"><nz-icon nzType="eye" /> Mở</a>
                <button nz-button nzSize="small" (click)="openEdit(m)"><nz-icon nzType="edit" /> Sửa</button>
                <button nz-button nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Xóa tài liệu này?" (nzOnConfirm)="remove(m)"><nz-icon nzType="delete" /> Xóa</button>
              </div>
            </nz-card>
          }
        </div>
      } @else {
        <nz-table #table [nzData]="materials()" [nzLoading]="loading()" [nzFrontPagination]="false" [nzScroll]="{ x: '640px' }">
          <thead><tr><th nzLeft>Tiêu đề</th><th>Loại</th><th>Danh mục</th><th>Khối</th><th>Mô tả</th><th nzRight>Thao tác</th></tr></thead>
          <tbody>
            @for (m of table.data; track m.id) {
              <tr>
                <td nzLeft>{{ m.title }}</td>
                <td><nz-tag>{{ typeLabels[m.type] }}</nz-tag></td>
                <td>{{ m.categoryName || '—' }}</td>
                <td>{{ m.gradeBand || '—' }}</td>
                <td>{{ m.description || '—' }}</td>
                <td nzRight>
                  <a nz-button nzType="link" nzSize="small" [href]="m.downloadUrl" target="_blank"><nz-icon nzType="eye" /> Mở</a>
                  <button nz-button nzType="link" nzSize="small" (click)="openEdit(m)"><nz-icon nzType="edit" /></button>
                  <button nz-button nzType="link" nzSize="small" nzDanger
                          nz-popconfirm nzPopconfirmTitle="Xóa tài liệu này?" (nzOnConfirm)="remove(m)"><nz-icon nzType="delete" /></button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    } @else {
      <p class="muted">Chọn một lớp để xem kho tài liệu.</p>
    }

    <!-- Modal thêm/sửa học liệu -->
    <nz-modal [nzVisible]="modalOpen()" [nzTitle]="editing() ? 'Sửa tài liệu' : 'Thêm tài liệu'"
      [nzOkLoading]="saving()" [nzOkDisabled]="form.invalid" (nzOnOk)="save()" (nzOnCancel)="modalOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item><nz-form-label nzRequired>Tiêu đề</nz-form-label>
            <nz-form-control nzErrorTip="Nhập tiêu đề"><input nz-input formControlName="title" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label nzRequired>Loại</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="type" class="full">
                @for (t of types; track t) { <nz-option [nzValue]="t" [nzLabel]="typeLabels[t]" /> }
              </nz-select>
            </nz-form-control></nz-form-item>
          <nz-form-item>
            <nz-form-label [nzRequired]="mode === 'library'">Danh mục</nz-form-label>
            <nz-form-control nzErrorTip="Chọn danh mục cho học liệu thư viện">
              <nz-select formControlName="categoryId" class="full" nzAllowClear nzPlaceHolder="Chọn danh mục">
                @for (c of categories(); track c.id) { <nz-option [nzValue]="c.id" [nzLabel]="c.name" /> }
              </nz-select>
            </nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Khối</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="gradeBand" class="full" nzAllowClear nzShowSearch nzPlaceHolder="Chọn khối (tùy chọn)">
                @for (b of gradeBands(); track b) { <nz-option [nzValue]="b" [nzLabel]="b" /> }
              </nz-select>
            </nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label nzRequired>Nguồn</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="source" class="full">
                <nz-option [nzValue]="MaterialSource.ExternalUrl" nzLabel="Liên kết (URL)" />
                @if (serverUploadAllowed()) { <nz-option [nzValue]="MaterialSource.ServerFile" nzLabel="Tải file lên server" /> }
              </nz-select>
            </nz-form-control></nz-form-item>

          @if (form.value.source === MaterialSource.ExternalUrl) {
            <nz-form-item><nz-form-label nzRequired>Đường dẫn (URL)</nz-form-label>
              <nz-form-control><input nz-input formControlName="url" placeholder="https://..." /></nz-form-control></nz-form-item>
          } @else {
            <nz-form-item><nz-form-label nzRequired>File</nz-form-label>
              <nz-form-control>
                <nz-upload [nzCustomRequest]="customUpload" [nzLimit]="1" nzAccept="*">
                  <button nz-button type="button"><nz-icon nzType="link" /> Chọn file</button>
                </nz-upload>
                @if (uploadedFileName()) { <span class="muted">Đã tải: {{ uploadedFileName() }}</span> }
              </nz-form-control></nz-form-item>
          }

          <nz-form-item><nz-form-label>Mô tả</nz-form-label>
            <nz-form-control><input nz-input formControlName="description" /></nz-form-control></nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <!-- Modal quản lý danh mục (Admin) -->
    <nz-modal [nzVisible]="catModalOpen()" nzTitle="Danh mục học liệu" [nzFooter]="null" (nzOnCancel)="catModalOpen.set(false)">
      <ng-container *nzModalContent>
        <div class="cat-form">
          <input nz-input [(ngModel)]="catName" placeholder="Tên danh mục" />
          <nz-input-number [(ngModel)]="catSort" [nzMin]="0" nzPlaceHolder="Thứ tự" />
          <button nz-button nzType="primary" (click)="saveCat()">{{ catEditId ? 'Lưu' : 'Thêm' }}</button>
          @if (catEditId) { <button nz-button (click)="resetCatForm()">Hủy</button> }
        </div>
        @for (c of categories(); track c.id) {
          <div class="cat-row">
            <span class="n">{{ c.name }} <span class="muted">#{{ c.sortOrder }}</span></span>
            <button nz-button nzType="link" nzSize="small" (click)="editCat(c)"><nz-icon nzType="edit" /></button>
            <button nz-button nzType="link" nzSize="small" nzDanger
                    nz-popconfirm nzPopconfirmTitle="Xóa danh mục này?" (nzOnConfirm)="removeCat(c)"><nz-icon nzType="delete" /></button>
          </div>
        } @empty { <p class="muted">Chưa có danh mục.</p> }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
    .cls { min-width: 200px; }
    .full { width: 100%; }
    .muted { color: var(--hs-text-muted); margin-left: 8px; }
    .cat-form { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
    .cat-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--hs-border); }
    .cat-row .n { flex: 1; }
    .mobile-card-list { display: flex; flex-direction: column; gap: 12px; }
    .mobile-card-list nz-card { width: 100%; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .card-title { font-weight: 600; flex: 1; margin-right: 8px; }
    .card-field { display: flex; gap: 8px; margin-bottom: 4px; }
    .card-field .label { color: var(--hs-text-muted); min-width: 72px; }
    .card-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  `
})
export class MaterialsPage {
  protected readonly auth = inject(AuthService);
  protected readonly screen = inject(ScreenService);
  private readonly materialsService = inject(MaterialsService);
  private readonly classesService = inject(ClassesService);
  private readonly filesService = inject(FilesService);
  private readonly settingsService = inject(SettingsService);
  private readonly message = inject(NzMessageService);

  protected readonly MaterialSource = MaterialSource;
  protected readonly typeLabels = MATERIAL_TYPE_LABELS;
  protected readonly types = [MaterialType.Pdf, MaterialType.Video, MaterialType.Vocabulary, MaterialType.Test, MaterialType.Homework];

  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly categories = signal<MaterialCategory[]>([]);
  protected readonly materials = signal<Material[]>([]);
  protected readonly gradeBands = signal<string[]>([]);
  protected readonly loading = signal(false);
  protected readonly serverUploadAllowed = signal(false);

  protected mode: 'class' | 'library' = 'class';
  protected classId: string | null = null;
  protected libCategoryId: string | null = null;
  protected libType: MaterialType | null = null;
  protected libGradeBand: string | null = null;

  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Material | null>(null);
  protected readonly uploadedFileId = signal<string | null>(null);
  protected readonly uploadedFileName = signal<string | null>(null);

  protected readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    type: new FormControl(MaterialType.Pdf, { nonNullable: true }),
    categoryId: new FormControl<string | null>(null),
    gradeBand: new FormControl<string | null>(null),
    source: new FormControl(MaterialSource.ExternalUrl, { nonNullable: true }),
    url: new FormControl<string | null>(null),
    description: new FormControl<string | null>(null)
  });

  // Quản lý danh mục
  protected readonly catModalOpen = signal(false);
  protected catName = '';
  protected catSort = 0;
  protected catEditId: string | null = null;

  constructor() {
    this.classesService.getPaged({ page: 1, pageSize: 200 }).subscribe(r => this.classes.set(r.items));
    this.materialsService.getCategories().subscribe(c => this.categories.set(c));
    this.settingsService.getEffective().subscribe(s => {
      this.serverUploadAllowed.set(s.values['FileStorage.Mode'] === FileStorageMode.Server);
      const raw = s.values['Class.GradeBands'] ?? '';
      this.gradeBands.set(raw.split(/[\n,]/).map(x => x.trim()).filter(Boolean));
    });
  }

  protected onModeChange(): void {
    this.materials.set([]);
    this.loadMaterials();
  }

  protected loadMaterials(): void {
    if (this.mode === 'class') {
      if (!this.classId) return;
      this.loading.set(true);
      this.materialsService.getByClass(this.classId).subscribe({
        next: m => { this.materials.set(m); this.loading.set(false); },
        error: () => this.loading.set(false)
      });
    } else {
      this.loading.set(true);
      this.materialsService.getLibrary(this.libCategoryId, this.libType, this.libGradeBand).subscribe({
        next: m => { this.materials.set(m); this.loading.set(false); },
        error: () => this.loading.set(false)
      });
    }
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.uploadedFileId.set(null);
    this.uploadedFileName.set(null);
    this.applyCategoryValidator();
    this.form.reset({
      title: '', type: MaterialType.Pdf,
      categoryId: this.mode === 'library' ? this.libCategoryId : null,
      gradeBand: this.mode === 'library' ? this.libGradeBand : null,
      source: MaterialSource.ExternalUrl, url: null, description: null
    });
    this.modalOpen.set(true);
  }

  protected openEdit(m: Material): void {
    this.editing.set(m);
    this.uploadedFileId.set(m.storedFileId);
    this.uploadedFileName.set(m.storedFileId ? 'file hiện tại' : null);
    this.applyCategoryValidator();
    this.form.reset({ title: m.title, type: m.type, categoryId: m.categoryId, gradeBand: m.gradeBand, source: m.source, url: m.url, description: m.description });
    this.modalOpen.set(true);
  }

  /** Học liệu thư viện bắt buộc danh mục; học liệu theo lớp thì tùy chọn. */
  private applyCategoryValidator(): void {
    const ctrl = this.form.controls.categoryId;
    ctrl.setValidators(this.mode === 'library' ? [Validators.required] : []);
    ctrl.updateValueAndValidity();
  }

  protected customUpload = (item: NzUploadXHRArgs): Subscription => {
    this.filesService.upload(item.file as unknown as File).subscribe({
      next: f => {
        this.uploadedFileId.set(f.id);
        this.uploadedFileName.set(f.fileName);
        item.onSuccess?.(f, item.file, null as never);
        this.message.success('Đã tải file lên.');
      },
      error: (e: HttpErrorResponse) => {
        item.onError?.(e as never, item.file);
        this.message.error(e.error?.message ?? e.message);
      }
    });
    return new Subscription();
  };

  protected save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    if (v.source === MaterialSource.ServerFile && !this.uploadedFileId()) { this.message.warning('Vui lòng tải file lên.'); return; }
    if (v.source === MaterialSource.ExternalUrl && !v.url) { this.message.warning('Vui lòng nhập URL.'); return; }

    const body = {
      categoryId: v.categoryId,
      gradeBand: v.gradeBand,
      title: v.title, type: v.type, source: v.source,
      url: v.source === MaterialSource.ExternalUrl ? v.url : null,
      storedFileId: v.source === MaterialSource.ServerFile ? this.uploadedFileId() : null,
      description: v.description
    };
    const editing = this.editing();
    const op = editing
      ? this.materialsService.update(editing.id, body)
      : this.materialsService.create({
          classId: this.mode === 'class' ? this.classId : null, ...body
        } as CreateMaterialRequest);

    this.saving.set(true);
    op.subscribe({
      next: () => { this.saving.set(false); this.modalOpen.set(false); this.message.success('Đã lưu tài liệu.'); this.loadMaterials(); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message ??'Lưu thất bại.'); }
    });
  }

  protected remove(m: Material): void {
    this.materialsService.delete(m.id).subscribe({
      next: () => { this.message.success('Đã xóa.'); this.loadMaterials(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ??'Xóa thất bại.')
    });
  }

  // ---- Quản lý danh mục ----
  protected openCatManager(): void {
    this.resetCatForm();
    this.catModalOpen.set(true);
  }

  protected resetCatForm(): void {
    this.catEditId = null;
    this.catName = '';
    this.catSort = 0;
  }

  protected editCat(c: MaterialCategory): void {
    this.catEditId = c.id;
    this.catName = c.name;
    this.catSort = c.sortOrder;
  }

  protected saveCat(): void {
    if (!this.catName.trim()) { this.message.warning('Nhập tên danh mục.'); return; }
    const body = { name: this.catName.trim(), description: null, sortOrder: this.catSort };
    const op = this.catEditId
      ? this.materialsService.updateCategory(this.catEditId, body)
      : this.materialsService.createCategory(body);
    op.subscribe({
      next: () => {
        this.message.success('Đã lưu danh mục.');
        this.resetCatForm();
        this.materialsService.getCategories().subscribe(c => this.categories.set(c));
      },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ??'Lưu thất bại.')
    });
  }

  protected removeCat(c: MaterialCategory): void {
    this.materialsService.deleteCategory(c.id).subscribe({
      next: () => { this.message.success('Đã xóa danh mục.'); this.materialsService.getCategories().subscribe(x => this.categories.set(x)); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ??'Xóa thất bại.')
    });
  }
}
