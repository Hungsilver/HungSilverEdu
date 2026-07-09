import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzUploadFile, NzUploadModule, NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import { AuthService } from '../../core/auth.service';
import { FilesService } from '../../core/files.service';
import { MaterialsService } from '../../core/materials.service';
import { Grade, Material, MaterialCategory, MaterialSource, Subject } from '../../core/models';
import { AvatarCropModal } from '../../shared/avatar-crop-modal';
import { DocumentPreview } from '../../shared/document-preview';

/**
 * Tab "Tài liệu chung" — tài liệu tự do KHÔNG thuộc bộ nào (FolderId null): lưới card + ảnh bìa,
 * form đầy đủ Loại/Môn/Khối. Tài liệu môn học (theo bộ) nằm ở tab "Tài liệu môn học".
 */
@Component({
  selector: 'app-general-materials-tab',
  imports: [
    FormsModule, ReactiveFormsModule,
    NzButtonModule, NzCardModule, NzEmptyModule, NzFormModule, NzIconModule, NzInputModule, NzModalModule,
    NzPaginationModule, NzPopconfirmModule, NzSelectModule, NzSpinModule, NzTagModule, NzTooltipModule, NzUploadModule,
    AvatarCropModal, DocumentPreview
  ],
  template: `
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
      @if (canManage()) {
        <button nz-button nzType="primary" (click)="openCreate()"><nz-icon nzType="plus" /> Thêm tài liệu</button>
      }
    </div>

    <nz-spin [nzSpinning]="loading()">
      <div class="material-grid">
        @for (m of materials(); track m.id) {
          <nz-card class="material-card" [nzCover]="cover"
                   [nzActions]="canManage() ? [aOpen, aDown, aExam, aEdit, aDel] : [aOpen, aDown, aExam]">
            <div class="mc-head">
              <nz-tag>{{ m.code }}</nz-tag>
              @if (m.categoryName) { <nz-tag nzColor="blue">{{ m.categoryName }}</nz-tag> }
            </div>
            <div class="mc-title" [title]="m.title">{{ m.title }}</div>
            <div class="mc-meta">{{ m.subjectName || '—' }} · Khối {{ m.gradeBand || '—' }}</div>
            @if (m.description) { <div class="mc-desc">{{ m.description }}</div> }
          </nz-card>
          <ng-template #cover>
            @if (m.coverFileId) {
              <img class="mc-cover" [src]="filesService.downloadUrl(m.coverFileId)" [alt]="m.title" loading="lazy" />
            } @else {
              <div class="mc-cover-placeholder" aria-hidden="true"><nz-icon nzType="picture" /></div>
            }
          </ng-template>
          <ng-template #aOpen>
            <span nz-tooltip nzTooltipTitle="Xem tài liệu" aria-label="Xem tài liệu" (click)="openMaterial(m)"><nz-icon nzType="eye" /></span>
          </ng-template>
          <ng-template #aDown>
            <span nz-tooltip nzTooltipTitle="Download tài liệu" aria-label="Download tài liệu" (click)="download(m)"><nz-icon nzType="download" /></span>
          </ng-template>
          <ng-template #aExam>
            <span nz-tooltip nzTooltipTitle="Đề của tài liệu" aria-label="Đề của tài liệu" (click)="openExams(m)"><nz-icon nzType="file-text" /></span>
          </ng-template>
          <ng-template #aEdit>
            <span nz-tooltip nzTooltipTitle="Sửa tài liệu" aria-label="Sửa tài liệu" (click)="openEdit(m)"><nz-icon nzType="edit" /></span>
          </ng-template>
          <ng-template #aDel>
            <span class="danger-action" nz-tooltip nzTooltipTitle="Xóa tài liệu" aria-label="Xóa tài liệu"
                  nz-popconfirm nzPopconfirmTitle="Xóa tài liệu này?" (nzOnConfirm)="remove(m)"><nz-icon nzType="delete" /></span>
          </ng-template>
        } @empty {
          @if (!loading()) { <nz-empty class="grid-empty" nzNotFoundContent="Chưa có tài liệu nào." /> }
        }
      </div>
    </nz-spin>
    @if (total() > 0) {
      <nz-pagination class="pager" [nzPageIndex]="page()" [nzPageSize]="pageSize()" [nzTotal]="total()"
        nzShowSizeChanger [nzPageSizeOptions]="GRID_PAGE_SIZES"
        (nzPageIndexChange)="page.set($event); load()"
        (nzPageSizeChange)="pageSize.set($event); page.set(1); load()" />
    }

    <!-- Modal thêm/sửa tài liệu chung (form đầy đủ) -->
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

          <nz-form-item><nz-form-label>Ảnh bìa</nz-form-label>
            <nz-form-control>
              @if (coverFileId(); as cid) {
                <div class="cover-preview">
                  <img [src]="filesService.downloadUrl(cid)" alt="Ảnh bìa" />
                  <button nz-button nzSize="small" nzDanger type="button" (click)="coverFileId.set(null)"><nz-icon nzType="delete" /> Xóa ảnh</button>
                </div>
              }
              <nz-upload nzAccept=".jpg,.jpeg,.png,.gif,.webp" [nzShowUploadList]="false" [nzBeforeUpload]="beforeCoverUpload">
                <button nz-button type="button" [nzLoading]="coverUploading()">
                  <nz-icon nzType="picture" /> {{ coverFileId() ? 'Đổi ảnh bìa' : 'Chọn ảnh bìa (16:9)' }}
                </button>
              </nz-upload>
            </nz-form-control></nz-form-item>

          <nz-form-item><nz-form-label>Mô tả</nz-form-label>
            <nz-form-control><input nz-input formControlName="description" /></nz-form-control></nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <!-- Trình xem tài liệu full màn hình -->
    <app-document-preview />

    <!-- Modal crop ảnh bìa 16:9 -->
    <app-avatar-crop-modal
      [visible]="coverCropVisible()" [imageFile]="coverSourceFile()"
      [aspectRatio]="16 / 9" [roundCropper]="false" [resizeToWidth]="1280"
      title="Cắt ảnh bìa (tỉ lệ 16:9)" outputFileName="cover.png"
      (cropped)="onCoverCropped($event)"
      (cancelled)="coverCropVisible.set(false); coverSourceFile.set(null)" />
  `,
  styles: `
    .filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .filters input, .filters nz-select { min-width: 200px; flex: 1; max-width: 320px; }
    .filter-actions { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
    .filter-actions .spacer { flex: 1; }
    .full { width: 100%; }
    .muted { color: var(--hs-text-muted); margin-left: 8px; }
    .pager { display: flex; justify-content: center; margin-top: 16px; }

    .material-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; min-height: 120px; }
    .grid-empty { grid-column: 1 / -1; align-self: center; }
    .material-card { display: flex; flex-direction: column; }
    .mc-cover { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
    .mc-cover-placeholder { aspect-ratio: 16 / 9; display: grid; place-items: center; font-size: 40px;
      color: rgba(255, 255, 255, 0.9);
      background: linear-gradient(135deg, var(--hs-primary, #4f46e5) 0%, #818cf8 60%, #c7d2fe 100%); }
    .mc-head { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; }
    .mc-title { font-weight: 600; line-height: 1.4; min-height: 2.8em;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .mc-meta { color: var(--hs-text-muted); font-size: 13px; margin-top: 4px; }
    .mc-desc { color: var(--hs-text-muted); font-size: 13px; margin-top: 4px;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .danger-action { color: var(--hs-danger, #ff4d4f); }

    .cover-preview { margin-bottom: 8px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .cover-preview img { width: 100%; max-width: 320px; aspect-ratio: 16 / 9; object-fit: cover;
      border-radius: 8px; border: 1px solid var(--hs-border); }
    @media (max-width: 575px) { .filters input, .filters nz-select { max-width: none; width: 100%; } }
  `
})
export class GeneralMaterialsTab {
  private readonly auth = inject(AuthService);
  private readonly materialsService = inject(MaterialsService);
  protected readonly filesService = inject(FilesService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);

  /** Danh mục nhận từ trang cha (đã nạp qua loadLookups — không gọi API trùng). */
  readonly subjects = input<Subject[]>([]);
  readonly grades = input<Grade[]>([]);
  readonly categories = input<MaterialCategory[]>([]);
  readonly serverUploadAllowed = input(false);

  protected readonly canManage = () => this.auth.isAdmin() || this.auth.isTeacher();
  protected readonly MaterialSource = MaterialSource;
  /** Bội số của 1/2/3/4 cột để lưới không hụt hàng (server clamp pageSize ≤ 100). */
  protected readonly GRID_PAGE_SIZES = [12, 24, 48, 96];

  protected readonly materials = signal<Material[]>([]);
  protected readonly loading = signal(false);

  // Bộ lọc — chỉ áp khi bấm "Tìm kiếm"
  protected search = '';
  protected subjectId: string | null = null;
  protected categoryId: string | null = null;
  protected gradeBand: string | null = null;

  protected readonly page = signal(1);
  protected readonly pageSize = signal(12);
  protected readonly total = signal(0);

  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Material | null>(null);
  protected readonly uploadedFileId = signal<string | null>(null);
  protected readonly uploadedFileName = signal<string | null>(null);

  protected readonly coverFileId = signal<string | null>(null);
  protected readonly coverCropVisible = signal(false);
  protected readonly coverSourceFile = signal<File | null>(null);
  protected readonly coverUploading = signal(false);

  /** Trình xem tài liệu full màn hình dùng chung. */
  private readonly preview = viewChild.required(DocumentPreview);

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
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.materialsService.getPaged({
      search: this.search, subjectId: this.subjectId, categoryId: this.categoryId, gradeBand: this.gradeBand,
      generalOnly: true, page: this.page(), pageSize: this.pageSize()
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

  /** Mở danh sách đề của tài liệu này — kèm ngữ cảnh tab để nút back quay về đúng chỗ. */
  protected openExams(m: Material): void {
    this.router.navigate(['/materials', m.id, 'exams'], { queryParams: { title: m.title, tab: 'general' } });
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.uploadedFileId.set(null);
    this.uploadedFileName.set(null);
    this.coverFileId.set(null);
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
    this.coverFileId.set(m.coverFileId);
    this.form.reset({
      title: m.title, subjectId: m.subjectId, categoryId: m.categoryId, gradeBand: m.gradeBand,
      source: m.source, url: m.url, description: m.description
    });
    this.modalOpen.set(true);
  }

  protected customUpload = (item: NzUploadXHRArgs): Subscription =>
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

  protected beforeCoverUpload = (file: NzUploadFile): false => {
    const f = file as unknown as File;
    if (!f.type?.startsWith('image/')) {
      this.message.error('Ảnh bìa chỉ chấp nhận file ảnh (jpg, png, gif, webp).');
      return false;
    }
    this.coverSourceFile.set(f);
    this.coverCropVisible.set(true);
    return false;
  };

  protected onCoverCropped(file: File): void {
    this.coverCropVisible.set(false);
    this.coverSourceFile.set(null);
    this.coverUploading.set(true);
    this.materialsService.uploadCover(file).subscribe({
      next: f => { this.coverUploading.set(false); this.coverFileId.set(f.id); this.message.success('Đã tải ảnh bìa.'); },
      error: (e: HttpErrorResponse) => { this.coverUploading.set(false); this.message.error(e.error?.message ?? e.message ?? 'Tải ảnh bìa thất bại.'); }
    });
  }

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
      description: v.description,
      coverFileId: this.coverFileId(),
      folderId: null // Tài liệu chung — không thuộc bộ nào
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
    } else if (m.storedFileId) {
      this.preview().open({ fileId: m.storedFileId, title: m.title, fileName: m.fileName });
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
