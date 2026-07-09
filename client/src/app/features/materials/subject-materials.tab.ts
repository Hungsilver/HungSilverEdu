import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzUploadFile, NzUploadModule, NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import { AuthService } from '../../core/auth.service';
import { FilesService } from '../../core/files.service';
import { MaterialsService } from '../../core/materials.service';
import { Grade, Material, MaterialFolder, MaterialSource, MaterialSubjectSummary } from '../../core/models';
import { AvatarCropModal } from '../../shared/avatar-crop-modal';
import { PAGE_SIZE_OPTIONS, TABLE_SCROLL_Y } from '../../shared/table';
import { TableDragScroll } from '../../shared/table-drag-scroll.directive';

/**
 * Tab "Tài liệu môn học" — điều hướng 3 mức, trạng thái nằm trên URL (?tab=subject&subjectId=&folderId=):
 * Mức 1: lưới Môn học → Mức 2: lưới Bộ tài liệu (vd "Tiếng Anh 10", CRUD + ảnh bìa 16:9) →
 * Mức 3: danh sách tài liệu trong bộ (Unit 1, Unit 2... — nơi upload file; nút "Đề" sinh đề AI từng tài liệu).
 * Tài liệu trong bộ dùng form tối giản — Môn/Khối tự snapshot từ bộ ở server.
 */
@Component({
  selector: 'app-subject-materials-tab',
  imports: [
    DatePipe, FormsModule, ReactiveFormsModule,
    NzAlertModule, NzButtonModule, NzCardModule, NzEmptyModule, NzFormModule, NzIconModule, NzInputModule, NzModalModule,
    NzPopconfirmModule, NzSelectModule, NzSpinModule, NzTableModule, NzTagModule, NzTooltipModule, NzUploadModule,
    AvatarCropModal, TableDragScroll
  ],
  template: `
    <!-- Breadcrumb tự dựng: Môn học / {Môn} / {Bộ} -->
    @if (level() > 1) {
      <div class="crumbs">
        <a (click)="go(null, null)">Môn học</a>
        @if (level() === 2) {
          <span class="sep">/</span><span class="current">{{ subjectName() || 'Môn học' }}</span>
        } @else {
          <span class="sep">/</span><a (click)="go(subjectId(), null)">{{ subjectName() || 'Môn học' }}</a>
          <span class="sep">/</span><span class="current">{{ currentFolder()?.name || 'Bộ tài liệu' }}</span>
        }
      </div>
    }

    <nz-spin [nzSpinning]="loading()">
      @switch (level()) {
        <!-- ================= MỨC 1: LƯỚI MÔN HỌC ================= -->
        @case (1) {
          <div class="material-grid">
            @for (s of summaries(); track s.subjectId) {
              <nz-card class="subject-card" (click)="go(s.subjectId, null)">
                <div class="subject-icon"><nz-icon nzType="book" /></div>
                <div class="mc-title">{{ s.subjectName }}</div>
                <div class="mc-meta">{{ s.folderCount }} bộ tài liệu · {{ s.materialCount }} tài liệu</div>
              </nz-card>
            } @empty {
              @if (!loading()) { <nz-empty class="grid-empty" nzNotFoundContent="Chưa có môn học nào — thêm Môn tại Lớp học → Danh mục." /> }
            }
          </div>
        }

        <!-- ================= MỨC 2: LƯỚI BỘ TÀI LIỆU ================= -->
        @case (2) {
          @if (canManage()) {
            <div class="toolbar">
              <button nz-button nzType="primary" (click)="openCreateFolder()"><nz-icon nzType="plus" /> Thêm bộ tài liệu</button>
            </div>
          }
          <div class="material-grid">
            @for (f of folders(); track f.id) {
              <nz-card class="material-card" [nzCover]="fCover"
                       [nzActions]="canManage() ? [fOpen, fEdit, fDel] : [fOpen]">
                <div class="mc-head">
                  @if (f.gradeBand) { <nz-tag nzColor="blue">Khối {{ f.gradeBand }}</nz-tag> }
                  <nz-tag>{{ f.materialCount }} tài liệu</nz-tag>
                </div>
                <div class="mc-title clickable" [title]="f.name" (click)="go(subjectId(), f.id)">{{ f.name }}</div>
                @if (f.description) { <div class="mc-desc">{{ f.description }}</div> }
              </nz-card>
              <ng-template #fCover>
                @if (f.coverFileId) {
                  <img class="mc-cover clickable" [src]="filesService.downloadUrl(f.coverFileId)" [alt]="f.name"
                       loading="lazy" (click)="go(subjectId(), f.id)" />
                } @else {
                  <div class="mc-cover-placeholder clickable" aria-hidden="true" (click)="go(subjectId(), f.id)"><nz-icon nzType="folder-open" /></div>
                }
              </ng-template>
              <ng-template #fOpen>
                <span nz-tooltip nzTooltipTitle="Mở bộ tài liệu" aria-label="Mở bộ tài liệu" (click)="go(subjectId(), f.id)"><nz-icon nzType="eye" /></span>
              </ng-template>
              <ng-template #fEdit>
                <span nz-tooltip nzTooltipTitle="Sửa bộ tài liệu" aria-label="Sửa bộ tài liệu" (click)="openEditFolder(f)"><nz-icon nzType="edit" /></span>
              </ng-template>
              <ng-template #fDel>
                <span class="danger-action" nz-tooltip nzTooltipTitle="Xóa bộ tài liệu" aria-label="Xóa bộ tài liệu"
                      nz-popconfirm nzPopconfirmTitle="Xóa bộ tài liệu này?" (nzOnConfirm)="removeFolder(f)"><nz-icon nzType="delete" /></span>
              </ng-template>
            } @empty {
              @if (!loading()) { <nz-empty class="grid-empty" nzNotFoundContent="Chưa có bộ tài liệu nào — bấm Thêm bộ tài liệu." /> }
            }
          </div>
        }

        <!-- ================= MỨC 3: DANH SÁCH TÀI LIỆU TRONG BỘ ================= -->
        @case (3) {
          <div class="toolbar">
            <input nz-input class="search" placeholder="Mã hoặc tên tài liệu" [(ngModel)]="search" (keyup.enter)="applySearch()" />
            <button nz-button (click)="applySearch()"><nz-icon nzType="search" /> Tìm</button>
            <span class="spacer"></span>
            @if (canManage()) {
              <button nz-button nzType="primary" (click)="openCreateMaterial()"><nz-icon nzType="plus" /> Thêm tài liệu</button>
            }
          </div>
          <nz-table #table appTableDragScroll [nzData]="materials()" [nzLoading]="loading()" [nzFrontPagination]="false"
            [nzPageIndex]="page()" [nzPageSize]="pageSize()" [nzTotal]="total()"
            nzShowSizeChanger [nzPageSizeOptions]="PAGE_SIZE_OPTIONS"
            (nzPageIndexChange)="page.set($event); loadMaterials()"
            (nzPageSizeChange)="pageSize.set($event); page.set(1); loadMaterials()"
            [nzScroll]="{ x: '820px', y: scrollY }">
            <thead><tr>
              <th nzWidth="56px" style="white-space: nowrap">STT</th>
              <th nzWidth="110px">Mã</th>
              <th>Tên tài liệu</th>
              <th nzWidth="220px">Nguồn</th>
              <th nzWidth="110px">Ngày tạo</th>
              <th nzRight nzWidth="190px">Thao tác</th>
            </tr></thead>
            <tbody>
              @for (m of table.data; track m.id; let i = $index) {
                <tr>
                  <td>{{ (page() - 1) * pageSize() + i + 1 }}</td>
                  <td><nz-tag>{{ m.code }}</nz-tag></td>
                  <td>
                    <div class="row-title">{{ m.title }}</div>
                    @if (m.description) { <div class="row-desc">{{ m.description }}</div> }
                  </td>
                  <td>{{ m.fileName || m.url || '—' }}</td>
                  <td>{{ m.createdAt | date: 'dd/MM/yyyy' }}</td>
                  <td nzRight>
                    <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Xem tài liệu" aria-label="Xem tài liệu" (click)="openMaterial(m)"><nz-icon nzType="eye" /></button>
                    <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Download tài liệu" aria-label="Download tài liệu" (click)="download(m)"><nz-icon nzType="download" /></button>
                    <button nz-button nzType="link" nzSize="small" (click)="openExams(m)"><nz-icon nzType="file-text" /> Đề</button>
                    @if (canManage()) {
                      <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Sửa tài liệu" aria-label="Sửa tài liệu" (click)="openEditMaterial(m)"><nz-icon nzType="edit" /></button>
                      <button nz-button nzType="link" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa tài liệu" aria-label="Xóa tài liệu"
                              nz-popconfirm nzPopconfirmTitle="Xóa tài liệu này?" (nzOnConfirm)="removeMaterial(m)"><nz-icon nzType="delete" /></button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (!loading() && materials().length === 0) {
            <p class="muted">Bộ này chưa có tài liệu — bấm <strong>Thêm tài liệu</strong> để upload (Unit 1, Unit 2, Exercise...).</p>
          }
        }
      }
    </nz-spin>

    <!-- Modal thêm/sửa BỘ tài liệu -->
    <nz-modal [nzVisible]="folderModalOpen()" [nzTitle]="editingFolder() ? 'Sửa bộ tài liệu' : 'Thêm bộ tài liệu'"
      [nzOkLoading]="saving()" (nzOnOk)="saveFolder()" (nzOnCancel)="folderModalOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="folderForm">
          <nz-form-item><nz-form-label nzRequired>Tên bộ tài liệu</nz-form-label>
            <nz-form-control nzErrorTip="Nhập tên bộ tài liệu">
              <input nz-input formControlName="name" placeholder="VD: Tiếng Anh 10" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Khối</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="gradeBand" class="full" nzAllowClear nzShowSearch nzPlaceHolder="Chọn khối (tùy chọn)">
                @for (g of grades(); track g.id) { <nz-option [nzValue]="g.name" [nzLabel]="g.name" /> }
              </nz-select>
            </nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Ảnh bìa</nz-form-label>
            <nz-form-control>
              @if (folderCoverId(); as cid) {
                <div class="cover-preview">
                  <img [src]="filesService.downloadUrl(cid)" alt="Ảnh bìa" />
                  <button nz-button nzSize="small" nzDanger type="button" (click)="folderCoverId.set(null)"><nz-icon nzType="delete" /> Xóa ảnh</button>
                </div>
              }
              <nz-upload nzAccept=".jpg,.jpeg,.png,.gif,.webp" [nzShowUploadList]="false" [nzBeforeUpload]="beforeCoverUpload">
                <button nz-button type="button" [nzLoading]="coverUploading()">
                  <nz-icon nzType="picture" /> {{ folderCoverId() ? 'Đổi ảnh bìa' : 'Chọn ảnh bìa (16:9)' }}
                </button>
              </nz-upload>
            </nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Mô tả</nz-form-label>
            <nz-form-control><textarea nz-input formControlName="description" rows="2"></textarea></nz-form-control></nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <!-- Modal thêm/sửa TÀI LIỆU trong bộ (tối giản — Môn/Khối snapshot từ bộ ở server) -->
    <nz-modal [nzVisible]="materialModalOpen()" [nzTitle]="editingMaterial() ? 'Sửa tài liệu' : 'Thêm tài liệu vào bộ'"
      [nzOkLoading]="saving()" [nzOkDisabled]="materialForm.invalid" (nzOnOk)="saveMaterial()" (nzOnCancel)="materialModalOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="materialForm">
          @if (editingMaterial(); as m) {
            <nz-form-item><nz-form-label>Mã tài liệu</nz-form-label>
              <nz-form-control><input nz-input [value]="m.code" disabled /></nz-form-control></nz-form-item>
          }
          <nz-form-item><nz-form-label nzRequired>Tên tài liệu</nz-form-label>
            <nz-form-control nzErrorTip="Nhập tên tài liệu">
              <input nz-input formControlName="title" placeholder="VD: Unit 1, Exercise..." /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label nzRequired>Nguồn</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="source" class="full">
                <nz-option [nzValue]="MaterialSource.ExternalUrl" nzLabel="Liên kết (URL)" />
                @if (serverUploadAllowed()) { <nz-option [nzValue]="MaterialSource.ServerFile" nzLabel="Tải file lên server" /> }
              </nz-select>
            </nz-form-control></nz-form-item>
          @if (materialForm.value.source === MaterialSource.ExternalUrl) {
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

    <!-- Modal xem trước tài liệu -->
    <nz-modal [nzVisible]="previewOpen()" [nzTitle]="previewTitle()" [nzFooter]="null" [nzWidth]="1000"
      (nzOnCancel)="closePreview()">
      <ng-container *nzModalContent>
        @if (previewLoading()) {
          <div class="preview-loading"><nz-spin nzSimple /></div>
        } @else if (previewError()) {
          <nz-alert nzType="warning" [nzMessage]="previewError()" nzShowIcon />
        } @else if (previewUrl()) {
          <iframe class="preview-frame" [src]="previewUrl()" title="Xem tài liệu"></iframe>
        }
      </ng-container>
    </nz-modal>

    <!-- Modal crop ảnh bìa bộ 16:9 -->
    <app-avatar-crop-modal
      [visible]="coverCropVisible()" [imageFile]="coverSourceFile()"
      [aspectRatio]="16 / 9" [roundCropper]="false" [resizeToWidth]="1280"
      title="Cắt ảnh bìa (tỉ lệ 16:9)" outputFileName="cover.png"
      (cropped)="onCoverCropped($event)"
      (cancelled)="coverCropVisible.set(false); coverSourceFile.set(null)" />
  `,
  styles: `
    .crumbs { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 14px; flex-wrap: wrap; }
    .crumbs a { color: var(--hs-primary, #4f46e5); cursor: pointer; }
    .crumbs a:hover { text-decoration: underline; }
    .crumbs .sep { color: var(--hs-text-muted); }
    .crumbs .current { font-weight: 600; }
    .toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
    .toolbar .search { max-width: 280px; }
    .toolbar .spacer { flex: 1; }
    .full { width: 100%; }
    .muted { color: var(--hs-text-muted); margin-top: 12px; }
    .clickable { cursor: pointer; }

    .material-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; min-height: 120px; }
    .grid-empty { grid-column: 1 / -1; align-self: center; }
    .material-card { display: flex; flex-direction: column; }
    .subject-card { cursor: pointer; text-align: center; transition: box-shadow 0.2s; }
    .subject-card:hover { box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12); }
    .subject-icon { font-size: 40px; color: var(--hs-primary, #4f46e5); margin-bottom: 8px; }
    .mc-cover { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
    .mc-cover-placeholder { aspect-ratio: 16 / 9; display: grid; place-items: center; font-size: 40px;
      color: rgba(255, 255, 255, 0.9);
      background: linear-gradient(135deg, var(--hs-primary, #4f46e5) 0%, #818cf8 60%, #c7d2fe 100%); }
    .mc-head { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; }
    .mc-title { font-weight: 600; line-height: 1.4;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .mc-meta { color: var(--hs-text-muted); font-size: 13px; margin-top: 4px; }
    .mc-desc { color: var(--hs-text-muted); font-size: 13px; margin-top: 4px;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .danger-action { color: var(--hs-danger, #ff4d4f); }
    .row-title { font-weight: 500; }
    .row-desc { color: var(--hs-text-muted); font-size: 12px; }

    .cover-preview { margin-bottom: 8px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .cover-preview img { width: 100%; max-width: 320px; aspect-ratio: 16 / 9; object-fit: cover;
      border-radius: 8px; border: 1px solid var(--hs-border); }
    .preview-loading { min-height: 360px; display: grid; place-items: center; }
    .preview-frame { width: 100%; height: min(72vh, 760px); border: 1px solid var(--hs-border); border-radius: 8px; }
    @media (max-width: 575px) { .toolbar .search { max-width: none; flex: 1; } }
  `
})
export class SubjectMaterialsTab {
  private readonly auth = inject(AuthService);
  private readonly materialsService = inject(MaterialsService);
  protected readonly filesService = inject(FilesService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  /** Trạng thái điều hướng từ URL (?subjectId=&folderId=) — trang cha bind query param rồi truyền xuống. */
  readonly subjectId = input<string | null>(null);
  readonly folderId = input<string | null>(null);
  readonly grades = input<Grade[]>([]);
  readonly serverUploadAllowed = input(false);

  protected readonly canManage = () => this.auth.isAdmin() || this.auth.isTeacher();
  protected readonly MaterialSource = MaterialSource;
  protected readonly PAGE_SIZE_OPTIONS = PAGE_SIZE_OPTIONS;
  protected readonly scrollY = TABLE_SCROLL_Y;

  protected readonly level = computed(() => (this.folderId() ? 3 : this.subjectId() ? 2 : 1));

  protected readonly summaries = signal<MaterialSubjectSummary[]>([]);
  protected readonly folders = signal<MaterialFolder[]>([]);
  protected readonly materials = signal<Material[]>([]);
  protected readonly loading = signal(false);

  protected readonly currentFolder = computed(() => this.folders().find(f => f.id === this.folderId()) ?? null);
  protected readonly subjectName = computed(() => {
    const sid = this.subjectId();
    if (!sid) return '';
    return this.summaries().find(s => s.subjectId === sid)?.subjectName
      ?? this.currentFolder()?.subjectName
      ?? this.folders().find(f => f.subjectId === sid)?.subjectName
      ?? '';
  });

  // Mức 3: search + phân trang server
  protected search = '';
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly total = signal(0);

  protected readonly saving = signal(false);

  // Modal bộ tài liệu
  protected readonly folderModalOpen = signal(false);
  protected readonly editingFolder = signal<MaterialFolder | null>(null);
  protected readonly folderCoverId = signal<string | null>(null);
  protected readonly folderForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    gradeBand: new FormControl<string | null>(null),
    description: new FormControl<string | null>(null)
  });

  // Modal tài liệu trong bộ (tối giản)
  protected readonly materialModalOpen = signal(false);
  protected readonly editingMaterial = signal<Material | null>(null);
  protected readonly uploadedFileId = signal<string | null>(null);
  protected readonly uploadedFileName = signal<string | null>(null);
  protected readonly materialForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    source: new FormControl(MaterialSource.ExternalUrl, { nonNullable: true }),
    url: new FormControl<string | null>(null),
    description: new FormControl<string | null>(null)
  });

  // Crop ảnh bìa bộ
  protected readonly coverCropVisible = signal(false);
  protected readonly coverSourceFile = signal<File | null>(null);
  protected readonly coverUploading = signal(false);

  protected readonly previewOpen = signal(false);
  protected readonly previewTitle = signal('Xem tài liệu');
  protected readonly previewLoading = signal(false);
  protected readonly previewError = signal<string | null>(null);
  protected readonly previewUrl = signal<SafeResourceUrl | null>(null);
  private previewObjectUrl: string | null = null;
  private previewRequestId = 0;

  constructor() {
    this.destroyRef.onDestroy(() => this.revokePreviewUrl());

    // Nạp dữ liệu theo mức hiện tại — effect theo input để tự nạp lại khi query param đổi
    // (cùng route nên component KHÔNG bị tạo lại khi điều hướng giữa các mức).
    effect(() => {
      const sid = this.subjectId();
      const fid = this.folderId();
      untracked(() => {
        if (fid) {
          this.page.set(1);
          this.search = '';
          this.loadMaterials();
          // Cần danh sách bộ của môn cho breadcrumb + tên bộ (vào thẳng URL mức 3).
          if (sid && this.folders().every(f => f.subjectId !== sid)) this.loadFolders(sid);
        } else if (sid) {
          this.loadFolders(sid);
        } else {
          this.loadSummary();
        }
      });
    });
  }

  /** Điều hướng giữa các mức — đẩy trạng thái lên URL (null sẽ XÓA param). */
  protected go(subjectId: string | null, folderId: string | null): void {
    this.router.navigate([], {
      queryParams: { tab: 'subject', subjectId, folderId },
      queryParamsHandling: 'merge'
    });
  }

  private loadSummary(): void {
    this.loading.set(true);
    this.materialsService.getSubjectsSummary().subscribe({
      next: s => { this.summaries.set(s); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  private loadFolders(subjectId: string): void {
    this.loading.set(true);
    this.materialsService.getFolders(subjectId).subscribe({
      next: f => { this.folders.set(f); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
    // Nạp kèm summary nếu chưa có — để breadcrumb có tên môn khi vào thẳng URL.
    if (this.summaries().length === 0) this.materialsService.getSubjectsSummary().subscribe(s => this.summaries.set(s));
  }

  protected loadMaterials(): void {
    const fid = this.folderId();
    if (!fid) return;
    this.loading.set(true);
    this.materialsService.getPaged({
      search: this.search, folderId: fid, page: this.page(), pageSize: this.pageSize()
    }).subscribe({
      next: r => { this.materials.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected applySearch(): void {
    this.page.set(1);
    this.loadMaterials();
  }

  // ---- CRUD Bộ tài liệu ----

  protected openCreateFolder(): void {
    this.editingFolder.set(null);
    this.folderCoverId.set(null);
    this.folderForm.reset({ name: '', gradeBand: null, description: null });
    this.folderModalOpen.set(true);
  }

  protected openEditFolder(f: MaterialFolder): void {
    this.editingFolder.set(f);
    this.folderCoverId.set(f.coverFileId);
    this.folderForm.reset({ name: f.name, gradeBand: f.gradeBand, description: f.description });
    this.folderModalOpen.set(true);
  }

  protected saveFolder(): void {
    const v = this.folderForm.getRawValue();
    if (!v.name.trim()) { this.message.warning('Nhập tên bộ tài liệu.'); return; }
    const sid = this.subjectId();
    if (!sid) return;

    const editing = this.editingFolder();
    const body = { name: v.name.trim(), gradeBand: v.gradeBand, coverFileId: this.folderCoverId(), description: v.description };
    const op = editing
      ? this.materialsService.updateFolder(editing.id, body)
      : this.materialsService.createFolder({ ...body, subjectId: sid });

    this.saving.set(true);
    op.subscribe({
      next: () => { this.saving.set(false); this.folderModalOpen.set(false); this.message.success('Đã lưu bộ tài liệu.'); this.loadFolders(sid); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message ?? 'Lưu thất bại.'); }
    });
  }

  protected removeFolder(f: MaterialFolder): void {
    this.materialsService.deleteFolder(f.id).subscribe({
      next: () => { this.message.success('Đã xóa bộ tài liệu.'); this.loadFolders(this.subjectId()!); },
      // Bộ còn tài liệu ⇒ BE chặn (MaterialFolder.InUse) — hiện message tiếng Việt từ server.
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ?? 'Xóa thất bại.')
    });
  }

  // ---- CRUD Tài liệu trong bộ (tối giản) ----

  protected openCreateMaterial(): void {
    this.editingMaterial.set(null);
    this.uploadedFileId.set(null);
    this.uploadedFileName.set(null);
    this.materialForm.reset({ title: '', source: MaterialSource.ExternalUrl, url: null, description: null });
    this.materialModalOpen.set(true);
  }

  protected openEditMaterial(m: Material): void {
    this.editingMaterial.set(m);
    this.uploadedFileId.set(m.storedFileId);
    this.uploadedFileName.set(m.storedFileId ? (m.fileName ?? 'file hiện tại') : null);
    this.materialForm.reset({ title: m.title, source: m.source, url: m.url, description: m.description });
    this.materialModalOpen.set(true);
  }

  protected saveMaterial(): void {
    if (this.materialForm.invalid) return;
    const v = this.materialForm.getRawValue();
    if (v.source === MaterialSource.ServerFile && !this.uploadedFileId()) { this.message.warning('Vui lòng tải file lên.'); return; }
    if (v.source === MaterialSource.ExternalUrl && !v.url) { this.message.warning('Vui lòng nhập URL.'); return; }

    // Môn/Khối server tự snapshot từ bộ — client không gửi.
    const editing = this.editingMaterial();
    const body = {
      categoryId: editing?.categoryId ?? null,
      subjectId: null,
      gradeBand: null,
      title: v.title,
      source: v.source,
      url: v.source === MaterialSource.ExternalUrl ? v.url : null,
      storedFileId: v.source === MaterialSource.ServerFile ? this.uploadedFileId() : null,
      description: v.description,
      coverFileId: editing?.coverFileId ?? null,
      folderId: this.folderId()
    };
    const op = editing ? this.materialsService.update(editing.id, body) : this.materialsService.create(body);

    this.saving.set(true);
    op.subscribe({
      next: () => { this.saving.set(false); this.materialModalOpen.set(false); this.message.success('Đã lưu tài liệu.'); this.loadMaterials(); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message ?? 'Lưu thất bại.'); }
    });
  }

  protected removeMaterial(m: Material): void {
    this.materialsService.delete(m.id).subscribe({
      next: () => { this.message.success('Đã xóa.'); this.loadMaterials(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ?? 'Xóa thất bại.')
    });
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

  protected openMaterial(m: Material): void {
    if (m.source === MaterialSource.ExternalUrl) {
      window.open(m.url!, '_blank');
    } else {
      this.openPreview(m);
    }
  }

  private openPreview(m: Material): void {
    if (!m.storedFileId) return;
    this.revokePreviewUrl();
    this.previewTitle.set(m.title);
    this.previewOpen.set(true);
    this.previewLoading.set(true);
    this.previewError.set(null);
    this.previewUrl.set(null);
    const requestId = ++this.previewRequestId;

    this.filesService.preview(m.storedFileId).subscribe({
      next: blob => {
        if (requestId !== this.previewRequestId || !this.previewOpen()) return;
        this.previewObjectUrl = URL.createObjectURL(blob);
        this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl));
        this.previewLoading.set(false);
      },
      error: async err => {
        if (requestId !== this.previewRequestId || !this.previewOpen()) return;
        this.previewLoading.set(false);
        this.previewError.set(await this.filesService.errorMessage(err, 'Không xem trước được tài liệu này.'));
      }
    });
  }

  protected closePreview(): void {
    this.previewRequestId++;
    this.previewOpen.set(false);
    this.previewLoading.set(false);
    this.previewError.set(null);
    this.previewUrl.set(null);
    this.revokePreviewUrl();
  }

  private revokePreviewUrl(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
  }

  protected download(m: Material): void {
    if (m.source === MaterialSource.ServerFile && m.storedFileId) {
      this.filesService.download(m.storedFileId, m.fileName ?? m.title);
    } else if (m.url) {
      window.open(m.url, '_blank');
    }
  }

  /** Mở trang đề (sinh đề AI) của tài liệu — kèm ngữ cảnh để nút back quay về đúng bộ. */
  protected openExams(m: Material): void {
    this.router.navigate(['/materials', m.id, 'exams'], {
      queryParams: { title: m.title, tab: 'subject', subjectId: this.subjectId(), folderId: this.folderId() }
    });
  }

  // ---- Ảnh bìa bộ: chọn → crop 16:9 → upload (Public) ----

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
      next: f => { this.coverUploading.set(false); this.folderCoverId.set(f.id); this.message.success('Đã tải ảnh bìa.'); },
      error: (e: HttpErrorResponse) => { this.coverUploading.set(false); this.message.error(e.error?.message ?? e.message ?? 'Tải ảnh bìa thất bại.'); }
    });
  }
}
