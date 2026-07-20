import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { AuthService } from '../../core/auth.service';
import { FilesService } from '../../core/files.service';
import { MaterialsService } from '../../core/materials.service';
import { Grade, MaterialFolder, MaterialSubjectSummary } from '../../core/models';
import { AvatarCropModal } from '../../shared/avatar-crop-modal';

/** Nhóm bộ tài liệu theo Khối — section heading kiểu trang thư viện Sách Mềm. */
interface FolderGroup {
  key: string;
  label: string;
  folders: MaterialFolder[];
}

/**
 * Tab "Tài liệu môn học" — 2 mức trong tab, trạng thái nằm trên URL (?tab=subject&subjectId=):
 * Mức 1: lưới Môn học → Mức 2: lưới "card sách" các Bộ tài liệu nhóm theo Khối (kiểu Sách Mềm).
 * Click card → màn immersive /materials/folders/:folderId (units + tài liệu — folder-detail.page).
 * Link cũ ?folderId= được redirect sang route mới (replaceUrl) để bookmark/back-link không vỡ.
 */
@Component({
  selector: 'app-subject-materials-tab',
  host: { class: 'hs-mat-theme' },
  imports: [
    ReactiveFormsModule,
    NzButtonModule, NzCardModule, NzDropDownModule, NzEmptyModule, NzFormModule, NzIconModule, NzInputModule,
    NzModalModule, NzSelectModule, NzSpinModule, NzUploadModule,
    AvatarCropModal
  ],
  template: `
    <!-- Breadcrumb tự dựng: Môn học / {Môn} -->
    @if (level() === 2) {
      <div class="crumbs">
        <a (click)="goSubjects()">Môn học</a>
        <span class="sep">/</span><span class="current">{{ subjectName() || 'Môn học' }}</span>
      </div>
    }

    <nz-spin [nzSpinning]="loading()">
      @switch (level()) {
        <!-- ================= MỨC 1: LƯỚI MÔN HỌC ================= -->
        @case (1) {
          <div class="material-grid">
            @for (s of summaries(); track s.subjectId) {
              <nz-card class="subject-card" (click)="openSubject(s.subjectId)">
                <div class="subject-icon"><nz-icon nzType="book" /></div>
                <div class="mc-title">{{ s.subjectName }}</div>
                <div class="mc-meta">{{ s.folderCount }} bộ tài liệu · {{ s.materialCount }} tài liệu</div>
              </nz-card>
            } @empty {
              @if (!loading()) { <nz-empty class="grid-empty" nzNotFoundContent="Chưa có môn học nào — thêm Môn tại Lớp học → Danh mục." /> }
            }
          </div>
        }

        <!-- ================= MỨC 2: LƯỚI "CARD SÁCH" BỘ TÀI LIỆU (nhóm theo Khối) ================= -->
        @case (2) {
          @if (canManage()) {
            <div class="toolbar">
              <button nz-button nzType="primary" (click)="openCreateFolder()"><nz-icon nzType="plus" /> Thêm bộ tài liệu</button>
            </div>
          }
          @for (group of groupedFolders(); track group.key) {
            <h3 class="group-heading">{{ group.label }}</h3>
            <div class="book-grid">
              @for (f of group.folders; track f.id) {
                <div class="book-card" tabindex="0" role="button" [attr.aria-label]="'Mở bộ ' + f.name"
                     (click)="openFolder(f)" (keyup.enter)="openFolder(f)">
                  <div class="book-cover">
                    @if (f.coverFileId) {
                      <img [src]="filesService.downloadUrl(f.coverFileId)" [alt]="f.name" loading="lazy" />
                    } @else {
                      <div class="book-cover-ph" aria-hidden="true"><nz-icon nzType="read" /></div>
                    }
                    @if (canManage()) {
                      <button class="book-menu" nz-button nzShape="circle" nzSize="small" nz-dropdown
                              [nzDropdownMenu]="menu" nzTrigger="click" aria-label="Thao tác bộ tài liệu"
                              (click)="$event.stopPropagation()"><nz-icon nzType="more" /></button>
                      <nz-dropdown-menu #menu="nzDropdownMenu">
                        <ul nz-menu>
                          <li nz-menu-item (click)="openEditFolder(f)"><nz-icon nzType="edit" /> Sửa bộ tài liệu</li>
                          <li nz-menu-item nzDanger (click)="confirmRemoveFolder(f)"><nz-icon nzType="delete" /> Xóa bộ tài liệu</li>
                        </ul>
                      </nz-dropdown-menu>
                    }
                  </div>
                  <div class="book-body">
                    <div class="book-title" [title]="f.name">{{ f.name }}</div>
                    @if (f.description) { <div class="book-sub">{{ f.description }}</div> }
                  </div>
                  <div class="book-foot">
                    <span class="foot-count"><span class="dot"></span>{{ f.materialCount }} tài liệu</span>
                    <span class="foot-badge">{{ f.unitCount || 0 }} UNIT</span>
                  </div>
                </div>
              }
            </div>
          } @empty {
            @if (!loading()) { <nz-empty class="grid-empty" nzNotFoundContent="Chưa có bộ tài liệu nào — bấm Thêm bộ tài liệu." /> }
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
                  <nz-icon nzType="picture" /> {{ folderCoverId() ? 'Đổi ảnh bìa' : 'Chọn ảnh bìa sách' }}
                </button>
              </nz-upload>
            </nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Mô tả</nz-form-label>
            <nz-form-control><textarea nz-input formControlName="description" rows="2"></textarea></nz-form-control></nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <!-- Modal crop ảnh bìa bộ theo tỉ lệ bìa sách -->
    <app-avatar-crop-modal
      [visible]="coverCropVisible()" [imageFile]="coverSourceFile()"
      [aspectRatio]="3 / 4" [roundCropper]="false" [resizeToWidth]="900"
      [modalWidth]="520" [cropAreaMaxWidth]="360" [containWithinAspectRatio]="true"
      title="Cắt ảnh bìa sách" outputFileName="book-cover.png"
      (cropped)="onCoverCropped($event)"
      (cancelled)="coverCropVisible.set(false); coverSourceFile.set(null)" />
  `,
  styles: `
    .crumbs { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 14px; flex-wrap: wrap; }
    .crumbs a { color: var(--hs-primary, #4f46e5); cursor: pointer; }
    .crumbs a:hover { text-decoration: underline; }
    .crumbs .sep { color: var(--hs-text-muted); }
    .crumbs .current { font-weight: 600; }
    .toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; justify-content: flex-end; }
    .full { width: 100%; }

    /* ===== Mức 1: lưới Môn (giữ nguyên, polish nhẹ) ===== */
    .material-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; min-height: 120px; }
    .grid-empty { grid-column: 1 / -1; align-self: center; display: block; }
    .subject-card { cursor: pointer; text-align: center; transition: box-shadow 0.2s, transform 0.2s; }
    .subject-card:hover { box-shadow: var(--hs-shadow-hover); transform: translateY(-2px); }
    .subject-icon { font-size: 40px; color: var(--hs-primary, #4f46e5); margin-bottom: 8px; }
    .mc-title { font-weight: 600; line-height: 1.4;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .mc-meta { color: var(--hs-text-muted); font-size: 13px; margin-top: 4px; }

    /* ===== Mức 2: card sách kiểu thư viện Sách Mềm ===== */
    .group-heading { font-size: 17px; margin: 4px 0 12px; }
    .group-heading:not(:first-of-type) { margin-top: 20px; }
    .book-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
    .book-card { display: flex; flex-direction: column; cursor: pointer; overflow: hidden;
      background: var(--hs-surface); border: 1px solid var(--hs-border); border-radius: var(--hs-radius);
      box-shadow: var(--hs-shadow); transition: box-shadow 0.2s, transform 0.2s; }
    .book-card:hover, .book-card:focus-visible { box-shadow: var(--hs-shadow-hover); transform: translateY(-2px); }
    .book-cover { position: relative; }
    .book-cover img { display: block; width: 100%; aspect-ratio: 3 / 4; object-fit: cover; }
    .book-cover-ph { aspect-ratio: 3 / 4; display: grid; place-items: center; font-size: 42px;
      color: rgba(255, 255, 255, 0.92);
      background: linear-gradient(135deg, var(--hs-mat-green) 0%, #a3c162 55%, #ffd98e 100%); }
    .book-menu { position: absolute; top: 8px; right: 8px; opacity: 0; transition: opacity 0.15s;
      background: rgba(0, 0, 0, 0.4); color: #fff; border: 0; }
    .book-menu:hover, .book-menu:focus { background: rgba(0, 0, 0, 0.6); color: #fff; }
    .book-card:hover .book-menu, .book-card:focus-within .book-menu { opacity: 1; }
    @media (hover: none) { .book-menu { opacity: 1; } }
    .book-body { flex: 1; padding: 12px 16px 10px; }
    .book-title { font-weight: 600; font-size: 15px; line-height: 1.4;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .book-sub { color: var(--hs-text-muted); font-size: 13px; margin-top: 4px;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .book-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px;
      border-top: 1px solid var(--hs-border); padding: 9px 16px; }
    .foot-count { display: inline-flex; align-items: center; gap: 6px;
      color: var(--hs-mat-green-text); font-weight: 600; font-size: 13px; }
    .foot-count .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--hs-mat-green); }
    .foot-badge { background: var(--hs-mat-badge-bg); color: #fff; border-radius: 4px;
      padding: 2px 8px; font-size: 12px; font-weight: 700; white-space: nowrap; }

    .cover-preview { margin-bottom: 8px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .cover-preview img { width: 100%; max-width: 180px; aspect-ratio: 3 / 4; object-fit: cover;
      border-radius: 8px; border: 1px solid var(--hs-border); }
  `
})
export class SubjectMaterialsTab {
  private readonly auth = inject(AuthService);
  private readonly materialsService = inject(MaterialsService);
  protected readonly filesService = inject(FilesService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);

  /** Trạng thái điều hướng từ URL (?subjectId=) — trang cha bind query param rồi truyền xuống.
   * folderId chỉ còn để redirect link cũ sang /materials/folders/:folderId. */
  readonly subjectId = input<string | null>(null);
  readonly folderId = input<string | null>(null);
  readonly grades = input<Grade[]>([]);

  protected readonly canManage = () => this.auth.isAdmin() || this.auth.isTeacher();

  protected readonly level = computed(() => (this.subjectId() ? 2 : 1));

  protected readonly summaries = signal<MaterialSubjectSummary[]>([]);
  protected readonly folders = signal<MaterialFolder[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  protected readonly subjectName = computed(() => {
    const sid = this.subjectId();
    if (!sid) return '';
    return this.summaries().find(s => s.subjectId === sid)?.subjectName
      ?? this.folders().find(f => f.subjectId === sid)?.subjectName
      ?? '';
  });

  /** Nhóm bộ theo Khối (thứ tự theo danh mục Khối), nhóm chưa phân khối xuống cuối. */
  protected readonly groupedFolders = computed<FolderGroup[]>(() => {
    const folders = this.folders();
    if (folders.length === 0) return [];
    const byBand = new Map<string, MaterialFolder[]>();
    for (const f of folders) {
      const key = f.gradeBand ?? '';
      byBand.set(key, [...(byBand.get(key) ?? []), f]);
    }
    const groups: FolderGroup[] = [];
    for (const g of this.grades()) {
      const items = byBand.get(g.name);
      if (items) { groups.push({ key: g.name, label: `Khối ${g.name}`, folders: items }); byBand.delete(g.name); }
    }
    // Khối chỉ còn trong snapshot (đã xóa khỏi danh mục) — vẫn hiện để không "mất" bộ.
    for (const [key, items] of byBand) {
      if (key !== '') groups.push({ key, label: `Khối ${key}`, folders: items });
    }
    const noBand = byBand.get('');
    if (noBand) groups.push({ key: '__none__', label: 'Chưa phân khối', folders: noBand });
    return groups;
  });

  // Modal bộ tài liệu
  protected readonly folderModalOpen = signal(false);
  protected readonly editingFolder = signal<MaterialFolder | null>(null);
  protected readonly folderCoverId = signal<string | null>(null);
  protected readonly folderForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    gradeBand: new FormControl<string | null>(null),
    description: new FormControl<string | null>(null)
  });

  // Crop ảnh bìa bộ
  protected readonly coverCropVisible = signal(false);
  protected readonly coverSourceFile = signal<File | null>(null);
  protected readonly coverUploading = signal(false);

  constructor() {
    // Nạp dữ liệu theo mức — effect theo input để tự nạp lại khi query param đổi.
    // Link cũ ?folderId= → redirect sang màn immersive mới (replaceUrl để back-stack không kẹt).
    effect(() => {
      const sid = this.subjectId();
      const fid = this.folderId();
      untracked(() => {
        if (fid) {
          this.router.navigate(['/materials/folders', fid], {
            queryParams: { subjectId: sid },
            replaceUrl: true
          });
        } else if (sid) {
          this.loadFolders(sid);
        } else {
          this.loadSummary();
        }
      });
    });
  }

  // ---- Điều hướng ----

  protected goSubjects(): void {
    this.router.navigate([], { queryParams: { tab: 'subject', subjectId: null, folderId: null }, queryParamsHandling: 'merge' });
  }

  protected openSubject(subjectId: string): void {
    this.router.navigate([], { queryParams: { tab: 'subject', subjectId, folderId: null }, queryParamsHandling: 'merge' });
  }

  /** Mở màn immersive chi tiết bộ (units) — route riêng, kèm subjectId cho nút Home. */
  protected openFolder(f: MaterialFolder): void {
    this.router.navigate(['/materials/folders', f.id], { queryParams: { subjectId: this.subjectId() } });
  }

  // ---- Nạp dữ liệu ----

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

  /** Xóa từ menu ⋮ — confirm bằng modal (popconfirm không hợp trong dropdown). */
  protected confirmRemoveFolder(f: MaterialFolder): void {
    this.modal.confirm({
      nzTitle: 'Xóa bộ tài liệu này?',
      nzContent: f.name,
      nzOkText: 'Xóa',
      nzOkDanger: true,
      nzOnOk: () => this.removeFolder(f)
    });
  }

  private removeFolder(f: MaterialFolder): void {
    this.materialsService.deleteFolder(f.id).subscribe({
      next: () => { this.message.success('Đã xóa bộ tài liệu.'); this.loadFolders(this.subjectId()!); },
      // Bộ còn tài liệu/Unit ⇒ BE chặn (MaterialFolder.InUse / .HasUnits) — hiện message tiếng Việt từ server.
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ?? 'Xóa thất bại.')
    });
  }

  // ---- Ảnh bìa bộ: chọn → crop tỉ lệ bìa sách → upload (Public) ----

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
