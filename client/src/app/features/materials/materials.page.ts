import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzUploadModule, NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import { AuthService } from '../../core/auth.service';
import { FilesService } from '../../core/files.service';
import { GradesService } from '../../core/grades.service';
import { MaterialsService } from '../../core/materials.service';
import {
  FileStorageMode, Grade, Material, MaterialCategory, MaterialSource, Subject
} from '../../core/models';
import { ScreenService } from '../../core/screen.service';
import { SettingsService } from '../../core/settings.service';
import { SubjectsService } from '../../core/subjects.service';
import { ColumnDef, ColumnSettings } from '../../shared/column-settings';
import { PageHeader } from '../../shared/page-header';
import { PAGE_SIZE_OPTIONS, TABLE_SCROLL_Y } from '../../shared/table';
import { TableDragScroll } from '../../shared/table-drag-scroll.directive';
import { MaterialsCatalogTab } from './materials-catalog.tab';
import { QuestionBankTab } from './question-bank.tab';

@Component({
  selector: 'app-materials-page',
  imports: [
    FormsModule, ReactiveFormsModule,
    NzTableModule, NzTabsModule, NzButtonModule, NzCardModule, NzIconModule, NzTagModule, NzSelectModule,
    NzModalModule, NzPaginationModule, NzFormModule, NzInputModule, NzPopconfirmModule, NzTooltipModule, NzUploadModule,
    ColumnSettings, PageHeader, TableDragScroll, MaterialsCatalogTab, QuestionBankTab
  ],
  template: `
    <app-page-header title="Kho tài liệu" subtitle="Danh sách tài liệu và danh mục dùng khi tạo tài liệu" icon="link">
      @if (canManage()) {
        <button nz-button nzType="primary" (click)="openCreate()"><nz-icon nzType="plus" /> Thêm tài liệu</button>
      }
    </app-page-header>

    <nz-tabs class="module-tabs" nzType="line">
      <nz-tab nzTitle="Danh sách">
        <div class="filters">
          <input nz-input placeholder="Mã hoặc tên tài liệu" [(ngModel)]="search" (keyup.enter)="applyFilters()" />
          <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Môn học" [(ngModel)]="subjectId">
            @for (s of subjects(); track s.id) { <nz-option [nzValue]="s.id" [nzLabel]="s.name" /> }
          </nz-select>
          <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Khối" [(ngModel)]="gradeBand">
            @for (g of grades(); track g.id) { <nz-option [nzValue]="g.name" [nzLabel]="g.name" /> }
          </nz-select>
          <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Loại tài liệu" [(ngModel)]="categoryId">
            @for (c of categories(); track c.id) { <nz-option [nzValue]="c.id" [nzLabel]="c.name" /> }
          </nz-select>
        </div>
        <div class="filter-actions">
          <button nz-button nzType="primary" (click)="applyFilters()"><nz-icon nzType="search" /> Tìm kiếm</button>
          <button nz-button (click)="resetFilters()"><nz-icon nzType="reload" /> Đặt lại</button>
          <span class="spacer"></span>
          <app-column-settings #cols storageKey="hs-cols-materials" [columns]="COLUMNS" />
        </div>

        @if (screen.isMobile()) {
          <div class="mobile-card-list">
            @for (m of materials(); track m.id) {
              <nz-card>
                <div class="card-header">
                  <span class="card-title">{{ m.title }}</span>
                  <nz-tag>{{ m.code }}</nz-tag>
                </div>
                <div class="card-field"><span class="label">Môn học</span><span>{{ m.subjectName || '—' }}</span></div>
                <div class="card-field"><span class="label">Khối</span><span>{{ m.gradeBand || '—' }}</span></div>
                <div class="card-field"><span class="label">Loại</span><span>{{ m.categoryName || '—' }}</span></div>
                <div class="card-actions">
                  <button nz-button nzSize="small" (click)="openMaterial(m)"><nz-icon nzType="eye" /> Mở</button>
                  <button nz-button nzSize="small" (click)="download(m)"><nz-icon nzType="download" /> Tải</button>
                  <button nz-button nzSize="small" nzType="primary" (click)="openExams(m)"><nz-icon nzType="file-text" /> Đề</button>
                  @if (canManage()) {
                    <button nz-button nzSize="small" nz-tooltip nzTooltipTitle="Sửa tài liệu" aria-label="Sửa tài liệu" (click)="openEdit(m)"><nz-icon nzType="edit" /></button>
                    <button nz-button nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa tài liệu" aria-label="Xóa tài liệu" nz-popconfirm nzPopconfirmTitle="Xóa tài liệu này?" (nzOnConfirm)="remove(m)"><nz-icon nzType="delete" /></button>
                  }
                </div>
              </nz-card>
            } @empty { <p class="muted">Chưa có tài liệu nào.</p> }
          </div>
          @if (total() > pageSize()) {
            <nz-pagination class="pager" [nzPageIndex]="page()" [nzPageSize]="pageSize()" [nzTotal]="total()"
              (nzPageIndexChange)="page.set($event); load()" />
          }
        } @else {
          <nz-table #table appTableDragScroll [nzData]="materials()" [nzLoading]="loading()" [nzFrontPagination]="false"
            [nzPageIndex]="page()" [nzPageSize]="pageSize()" [nzTotal]="total()"
            nzShowSizeChanger [nzPageSizeOptions]="PAGE_SIZE_OPTIONS"
            (nzPageIndexChange)="page.set($event); load()"
            (nzPageSizeChange)="pageSize.set($event); page.set(1); load()"
            [nzScroll]="{ x: '960px', y: scrollY }">
            <thead><tr>
              <th nzWidth="64px" style="white-space: nowrap">STT</th>
              @for (col of cols.visibleColumns(); track col.key) { <th>{{ col.label }}</th> }
              <th nzRight nzWidth="220px">Thao tác</th>
            </tr></thead>
            <tbody>
              @for (m of table.data; track m.id; let i = $index) {
                <tr>
                  <td>{{ (page() - 1) * pageSize() + i + 1 }}</td>
                  @for (col of cols.visibleColumns(); track col.key) {
                    <td>
                      @switch (col.key) {
                        @case ('code') { {{ m.code }} }
                        @case ('title') { {{ m.title }} }
                        @case ('subject') { {{ m.subjectName || '—' }} }
                        @case ('grade') { {{ m.gradeBand || '—' }} }
                        @case ('category') { {{ m.categoryName || '—' }} }
                        @case ('description') { {{ m.description || '—' }} }
                      }
                    </td>
                  }
                  <td nzRight>
                    <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Mở tài liệu" aria-label="Mở tài liệu" (click)="openMaterial(m)"><nz-icon nzType="eye" /></button>
                    <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Download tài liệu" aria-label="Download tài liệu" (click)="download(m)"><nz-icon nzType="download" /></button>
                    <button nz-button nzType="link" nzSize="small" (click)="openExams(m)"><nz-icon nzType="file-text" /> Đề</button>
                    @if (canManage()) {
                      <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Sửa tài liệu" aria-label="Sửa tài liệu" (click)="openEdit(m)"><nz-icon nzType="edit" /></button>
                      <button nz-button nzType="link" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa tài liệu" aria-label="Xóa tài liệu"
                              nz-popconfirm nzPopconfirmTitle="Xóa tài liệu này?" (nzOnConfirm)="remove(m)"><nz-icon nzType="delete" /></button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </nz-tab>

      @if (canManage()) {
        <nz-tab nzTitle="Danh mục">
          <app-materials-catalog-tab (changed)="loadLookups()" />
        </nz-tab>
        <nz-tab nzTitle="Quản lí câu hỏi">
          <!-- Lazy: chỉ khởi tạo (và gọi API ngân hàng câu hỏi) khi GV mở tab. -->
          <ng-template nz-tab>
            <app-question-bank-tab [subjects]="subjects()" [grades]="grades()" />
          </ng-template>
        </nz-tab>
      }
    </nz-tabs>

    <!-- Modal thêm/sửa tài liệu -->
    <nz-modal [nzVisible]="modalOpen()" [nzTitle]="editing() ? 'Sửa tài liệu' : 'Thêm tài liệu'"
      [nzOkLoading]="saving()" [nzOkDisabled]="form.invalid" (nzOnOk)="save()" (nzOnCancel)="modalOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          @if (editing(); as m) {
            <nz-form-item><nz-form-label>Mã tài liệu</nz-form-label>
              <nz-form-control><input nz-input [value]="m.code" disabled /></nz-form-control></nz-form-item>
          }
          <nz-form-item><nz-form-label nzRequired>Tên tài liệu</nz-form-label>
            <nz-form-control nzErrorTip="Nhập tên tài liệu"><input nz-input formControlName="title" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label nzRequired>Môn học</nz-form-label>
            <nz-form-control nzErrorTip="Chọn môn học">
              <nz-select formControlName="subjectId" class="full" nzShowSearch nzPlaceHolder="Chọn môn học">
                @for (s of subjects(); track s.id) { <nz-option [nzValue]="s.id" [nzLabel]="s.name" /> }
              </nz-select>
            </nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label nzRequired>Loại tài liệu</nz-form-label>
            <nz-form-control nzErrorTip="Chọn loại tài liệu">
              <nz-select formControlName="categoryId" class="full" nzShowSearch nzPlaceHolder="Chọn loại (đề kiểm tra, lý thuyết...)">
                @for (c of categories(); track c.id) { <nz-option [nzValue]="c.id" [nzLabel]="c.name" /> }
              </nz-select>
            </nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Khối</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="gradeBand" class="full" nzAllowClear nzShowSearch nzPlaceHolder="Chọn khối (tùy chọn)">
                @for (g of grades(); track g.id) { <nz-option [nzValue]="g.name" [nzLabel]="g.name" /> }
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
  `,
  styles: `
    .filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .filters input, .filters nz-select { min-width: 200px; flex: 1; max-width: 320px; }
    .filter-actions { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
    .filter-actions .spacer { flex: 1; }
    .full { width: 100%; }
    .muted { color: var(--hs-text-muted); margin-left: 8px; }
    .pager { display: flex; justify-content: center; margin-top: 12px; }
    .mobile-card-list { display: flex; flex-direction: column; gap: 12px; }
    .mobile-card-list nz-card { width: 100%; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .card-title { font-weight: 600; flex: 1; margin-right: 8px; }
    .card-field { display: flex; gap: 8px; margin-bottom: 4px; }
    .card-field .label { color: var(--hs-text-muted); min-width: 72px; }
    .card-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
    @media (max-width: 575px) { .filters input, .filters nz-select { max-width: none; width: 100%; } }
  `
})
export class MaterialsPage {
  protected readonly auth = inject(AuthService);
  protected readonly screen = inject(ScreenService);
  private readonly materialsService = inject(MaterialsService);
  private readonly subjectsService = inject(SubjectsService);
  private readonly gradesService = inject(GradesService);
  private readonly filesService = inject(FilesService);
  private readonly settingsService = inject(SettingsService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  protected readonly canManage = computed(() => this.auth.isAdmin() || this.auth.isTeacher());

  protected readonly MaterialSource = MaterialSource;
  protected readonly PAGE_SIZE_OPTIONS = PAGE_SIZE_OPTIONS;
  protected readonly scrollY = TABLE_SCROLL_Y;
  protected readonly COLUMNS: ColumnDef[] = [
    { key: 'code', label: 'Mã' },
    { key: 'title', label: 'Tên tài liệu' },
    { key: 'subject', label: 'Môn học' },
    { key: 'grade', label: 'Khối' },
    { key: 'category', label: 'Loại' },
    { key: 'description', label: 'Mô tả' }
  ];

  protected readonly categories = signal<MaterialCategory[]>([]);
  protected readonly subjects = signal<Subject[]>([]);
  protected readonly grades = signal<Grade[]>([]);
  protected readonly materials = signal<Material[]>([]);
  protected readonly loading = signal(false);
  protected readonly serverUploadAllowed = signal(false);

  // Bộ lọc — chỉ áp khi bấm "Tìm kiếm" (không lọc on-change)
  protected search = '';
  protected subjectId: string | null = null;
  protected categoryId: string | null = null;
  protected gradeBand: string | null = null;

  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly total = signal(0);

  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Material | null>(null);
  protected readonly uploadedFileId = signal<string | null>(null);
  protected readonly uploadedFileName = signal<string | null>(null);

  protected readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    subjectId: new FormControl<string | null>(null, [Validators.required]),
    categoryId: new FormControl<string | null>(null, [Validators.required]),
    gradeBand: new FormControl<string | null>(null),
    source: new FormControl(MaterialSource.ExternalUrl, { nonNullable: true }),
    url: new FormControl<string | null>(null),
    description: new FormControl<string | null>(null)
  });

  constructor() {
    this.loadLookups();
    this.settingsService.getEffective().subscribe(s =>
      this.serverUploadAllowed.set(s.values['FileStorage.Mode'] === FileStorageMode.Server));
    this.load();
  }

  /** Nạp dữ liệu dropdown (môn/khối/loại) — gọi lại khi tab Danh mục thay đổi. */
  protected loadLookups(): void {
    this.subjectsService.getAll().subscribe(s => this.subjects.set(s));
    this.gradesService.getAll().subscribe(g => this.grades.set(g));
    this.materialsService.getCategories().subscribe(c => this.categories.set(c));
  }

  protected load(): void {
    this.loading.set(true);
    this.materialsService.getPaged({
      search: this.search, subjectId: this.subjectId, categoryId: this.categoryId, gradeBand: this.gradeBand,
      page: this.page(), pageSize: this.pageSize()
    }).subscribe({
      next: r => { this.materials.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  protected resetFilters(): void {
    this.search = '';
    this.subjectId = null;
    this.categoryId = null;
    this.gradeBand = null;
    this.applyFilters();
  }

  /** Mở danh sách đề của tài liệu này (sinh đề bằng AI). */
  protected openExams(m: Material): void {
    this.router.navigate(['/materials', m.id, 'exams'], { queryParams: { title: m.title } });
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.uploadedFileId.set(null);
    this.uploadedFileName.set(null);
    this.form.reset({
      title: '', subjectId: this.subjectId, categoryId: this.categoryId, gradeBand: this.gradeBand,
      source: MaterialSource.ExternalUrl, url: null, description: null
    });
    this.modalOpen.set(true);
  }

  protected openEdit(m: Material): void {
    this.editing.set(m);
    this.uploadedFileId.set(m.storedFileId);
    this.uploadedFileName.set(m.storedFileId ? (m.fileName ?? 'file hiện tại') : null);
    this.form.reset({
      title: m.title, subjectId: m.subjectId, categoryId: m.categoryId, gradeBand: m.gradeBand,
      source: m.source, url: m.url, description: m.description
    });
    this.modalOpen.set(true);
  }

  protected customUpload = (item: NzUploadXHRArgs): Subscription =>
    // Trả subscription thật để ng-zorro theo dõi/hủy được khi component bị hủy.
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

  protected save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    if (v.source === MaterialSource.ServerFile && !this.uploadedFileId()) { this.message.warning('Vui lòng tải file lên.'); return; }
    if (v.source === MaterialSource.ExternalUrl && !v.url) { this.message.warning('Vui lòng nhập URL.'); return; }

    const body = {
      categoryId: v.categoryId,
      subjectId: v.subjectId,
      gradeBand: v.gradeBand,
      title: v.title,
      source: v.source,
      url: v.source === MaterialSource.ExternalUrl ? v.url : null,
      storedFileId: v.source === MaterialSource.ServerFile ? this.uploadedFileId() : null,
      description: v.description
    };
    const editing = this.editing();
    const op = editing ? this.materialsService.update(editing.id, body) : this.materialsService.create(body);

    this.saving.set(true);
    op.subscribe({
      next: () => { this.saving.set(false); this.modalOpen.set(false); this.message.success('Đã lưu tài liệu.'); this.load(); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message ?? 'Lưu thất bại.'); }
    });
  }

  protected openMaterial(m: Material): void {
    if (m.source === MaterialSource.ExternalUrl) {
      window.open(m.url!, '_blank');
    } else {
      this.filesService.openInNewTab(m.storedFileId!);
    }
  }

  /** Download tài liệu về máy: file server tải blob kèm token, link ngoài mở tab mới. */
  protected download(m: Material): void {
    if (m.source === MaterialSource.ServerFile && m.storedFileId) {
      this.filesService.download(m.storedFileId, m.fileName ?? m.title);
    } else if (m.url) {
      window.open(m.url, '_blank');
    }
  }

  protected remove(m: Material): void {
    this.materialsService.delete(m.id).subscribe({
      next: () => { this.message.success('Đã xóa.'); this.load(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ?? 'Xóa thất bại.')
    });
  }
}
