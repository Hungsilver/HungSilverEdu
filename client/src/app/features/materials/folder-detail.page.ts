import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzUploadModule, NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import { AuthService } from '../../core/auth.service';
import { FilesService } from '../../core/files.service';
import { MaterialsService } from '../../core/materials.service';
import {
  FileStorageMode, Material, MaterialFolder, MaterialSource, MaterialUnit, MaterialUnitKind
} from '../../core/models';
import { SettingsService } from '../../core/settings.service';
import { DocumentPreview } from '../../shared/document-preview';

/**
 * Màn immersive chi tiết BỘ TÀI LIỆU kiểu "sách giáo khoa" (Sách Mềm) — route /materials/folders/:folderId.
 * Mức 3 (không ?unitId=): panel 2 cột thanh Unit (Unit xanh lá + chip số cam, Review cam) + sidebar
 * "Tài nguyên khác" chứa tài liệu chưa thuộc Unit. Mức 4 (?unitId=): danh sách bài học trong Unit,
 * click mở viewer. Nền hero = ảnh bìa bộ blur (fallback gradient ấm). Chỉ Admin/Teacher (roleGuard).
 */
@Component({
  selector: 'app-folder-detail-page',
  host: { class: 'hs-mat-theme' },
  imports: [
    ReactiveFormsModule,
    NzButtonModule, NzDropDownModule, NzEmptyModule, NzFormModule, NzIconModule, NzInputModule, NzModalModule,
    NzPopconfirmModule, NzRadioModule, NzSelectModule, NzSpinModule, NzTooltipModule, NzUploadModule,
    DocumentPreview
  ],
  template: `
    <div class="fd-page" [class.has-cover]="!!folder()?.coverFileId">
      <div class="fd-hero-bg" [style.background-image]="heroBg()"></div>
      <div class="fd-hero-overlay"></div>

      <div class="fd-top">
        <button class="fd-home" nz-button nzShape="circle" aria-label="Về Kho tài liệu"
                nz-tooltip nzTooltipTitle="Về Kho tài liệu" (click)="goHome()"><nz-icon nzType="home" /></button>
        <header class="fd-head">
          <h1 class="fd-title">{{ folder()?.name || 'Bộ tài liệu' }}</h1>
          <div class="fd-sub">
            {{ folder()?.subjectName }}@if (folder()?.gradeBand) { · Khối {{ folder()?.gradeBand }} }
          </div>
        </header>
      </div>

      <div class="fd-body">
        <main class="fd-panel">
          @if (unitId()) {
            <!-- ================= MỨC 4: CHI TIẾT UNIT (danh sách bài học) ================= -->
            <div class="unit-head" [class.is-review]="currentUnit()?.kind === Kind.Review">
              <button class="fd-back" nz-button nzShape="circle" aria-label="Quay lại danh sách Unit"
                      (click)="backToUnits()"><nz-icon nzType="arrow-left" /></button>
              @if (currentUnit(); as u) {
                @if (u.kind === Kind.Unit) {
                  <span class="uh-label">Unit</span><span class="uh-no">{{ u.unitNo }}</span>
                  <span class="uh-name">{{ u.name }}</span>
                } @else {
                  <span class="uh-name">Review {{ u.unitNo }}@if (u.name) { — {{ u.name }} }</span>
                }
              } @else { <span class="uh-name">…</span> }
              <span class="spacer"></span>
              @if (canManage()) {
                <button nz-button nzGhost class="uh-add" (click)="openCreateMaterial(unitId()!)">
                  <nz-icon nzType="plus" /><span class="btn-text"> Thêm tài liệu</span></button>
              }
            </div>

            <nz-spin [nzSpinning]="materialsLoading()">
              <div class="lesson-list">
                @for (m of unitMaterials(); track m.id) {
                  <div class="lesson-row">
                    <a class="lesson-title" (click)="openMaterial(m)">{{ m.title }}</a>
                    @if (m.description) { <span class="lesson-desc">{{ m.description }}</span> }
                    <span class="lesson-actions">
                      <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Download tài liệu"
                              aria-label="Download tài liệu" (click)="download(m)"><nz-icon nzType="download" /></button>
                      <button nz-button nzType="link" nzSize="small" (click)="openExams(m)"><nz-icon nzType="file-text" /> Đề</button>
                      @if (canManage()) {
                        <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Sửa tài liệu"
                                aria-label="Sửa tài liệu" (click)="openEditMaterial(m)"><nz-icon nzType="edit" /></button>
                        <button nz-button nzType="link" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa tài liệu" aria-label="Xóa tài liệu"
                                nz-popconfirm nzPopconfirmTitle="Xóa tài liệu này?" (nzOnConfirm)="removeMaterial(m)"><nz-icon nzType="delete" /></button>
                      }
                    </span>
                  </div>
                } @empty {
                  @if (!materialsLoading()) { <nz-empty nzNotFoundContent="Unit chưa có tài liệu — bấm Thêm tài liệu." /> }
                }
              </div>
            </nz-spin>
          } @else {
            <!-- ================= MỨC 3: DANH SÁCH UNIT TRONG BỘ ================= -->
            @if (canManage()) {
              <div class="fd-toolbar">
                <button nz-button nzType="primary" (click)="openCreateUnit()"><nz-icon nzType="plus" /> Thêm Unit</button>
              </div>
            }
            <nz-spin [nzSpinning]="loading()">
              <div class="unit-cols">
                @for (col of unitColumns(); track $index) {
                  <div class="unit-col">
                    @for (u of col; track u.id) {
                      <div class="unit-bar" [class.is-review]="u.kind === Kind.Review" tabindex="0" role="button"
                           [attr.aria-label]="unitLabel(u)" (click)="openUnit(u)" (keyup.enter)="openUnit(u)">
                        @if (u.kind === Kind.Unit) {
                          <span class="unit-label">Unit</span><span class="unit-no">{{ u.unitNo }}</span>
                          <span class="unit-name">{{ u.name }}</span>
                        } @else {
                          <span class="unit-name">Review {{ u.unitNo }}@if (u.name) { — {{ u.name }} }</span>
                        }
                        <span class="unit-count" nz-tooltip nzTooltipTitle="Số tài liệu">{{ u.materialCount }}</span>
                        @if (canManage()) {
                          <span class="unit-actions" (click)="$event.stopPropagation()">
                            <button nz-button nzType="text" nzSize="small" [disabled]="isFirst(u)" aria-label="Chuyển lên"
                                    (click)="moveUnit(u, -1)"><nz-icon nzType="arrow-up" /></button>
                            <button nz-button nzType="text" nzSize="small" [disabled]="isLast(u)" aria-label="Chuyển xuống"
                                    (click)="moveUnit(u, 1)"><nz-icon nzType="arrow-down" /></button>
                            <button nz-button nzType="text" nzSize="small" aria-label="Sửa unit"
                                    (click)="openEditUnit(u)"><nz-icon nzType="edit" /></button>
                            <button nz-button nzType="text" nzSize="small" aria-label="Xóa unit"
                                    nz-popconfirm nzPopconfirmTitle="Xóa unit này?" (nzOnConfirm)="removeUnit(u)"><nz-icon nzType="delete" /></button>
                          </span>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
              @if (!loading() && units().length === 0) {
                <nz-empty nzNotFoundContent="Bộ chưa có Unit — bấm Thêm Unit để dựng mục lục như sách." />
              }
            </nz-spin>
          }
        </main>

        <!-- Sidebar "Tài nguyên khác" = tài liệu chưa thuộc Unit (hiện ở cả mức 3 và 4) -->
        @if (unassigned().length > 0 || canManage()) {
          <aside class="fd-side">
            <div class="side-title">Tài nguyên khác</div>
            <div class="side-hint">Tài liệu ngoài mục lục Unit</div>
            @for (m of unassigned(); track m.id) {
              <div class="side-item">
                <a class="side-link" (click)="openMaterial(m)"><nz-icon nzType="file-text" /><span>{{ m.title }}</span></a>
                <button class="side-more" nz-button nzType="text" nzSize="small" nz-dropdown [nzDropdownMenu]="sideMenu"
                        aria-label="Thao tác tài liệu"><nz-icon nzType="more" /></button>
                <nz-dropdown-menu #sideMenu="nzDropdownMenu">
                  <ul nz-menu>
                    <li nz-menu-item (click)="download(m)"><nz-icon nzType="download" /> Download</li>
                    <li nz-menu-item (click)="openExams(m)"><nz-icon nzType="file-text" /> Đề</li>
                    @if (canManage()) {
                      <li nz-menu-item (click)="openEditMaterial(m)"><nz-icon nzType="edit" /> Sửa</li>
                      <li nz-menu-item nzDanger (click)="confirmRemoveMaterial(m)"><nz-icon nzType="delete" /> Xóa</li>
                    }
                  </ul>
                </nz-dropdown-menu>
              </div>
            } @empty { <div class="side-empty">Chưa có tài liệu nào ngoài Unit.</div> }
            @if (canManage()) {
              <button nz-button nzBlock nzSize="small" class="side-add" (click)="openCreateMaterial(null)">
                <nz-icon nzType="plus" /> Thêm tài liệu</button>
            }
          </aside>
        }
      </div>
    </div>

    <!-- Modal thêm/sửa UNIT -->
    <nz-modal [nzVisible]="unitModalOpen()" [nzTitle]="editingUnit() ? 'Sửa Unit' : 'Thêm Unit'"
      [nzOkLoading]="saving()" (nzOnOk)="saveUnit()" (nzOnCancel)="unitModalOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="unitForm">
          <nz-form-item><nz-form-label>Kiểu</nz-form-label>
            <nz-form-control>
              <nz-radio-group formControlName="kind" nzButtonStyle="solid">
                <label nz-radio-button [nzValue]="Kind.Unit">Unit thường</label>
                <label nz-radio-button [nzValue]="Kind.Review">Review (ôn tập)</label>
              </nz-radio-group>
            </nz-form-control></nz-form-item>
          <nz-form-item>
            <nz-form-label [nzRequired]="unitForm.value.kind === Kind.Unit">Tên chủ đề</nz-form-label>
            <nz-form-control [nzExtra]="unitForm.value.kind === Kind.Review ? 'Review để trống tên vẫn được — hiển thị \\'Review 1\\', \\'Review 2\\'…' : 'Số thứ tự \\'Unit 1/2/3\\' tự đánh theo vị trí — không cần nhập.'">
              <input nz-input formControlName="name"
                     [placeholder]="unitForm.value.kind === Kind.Unit ? 'VD: Family life' : 'VD: Unit 1-2-3 (tùy chọn)'" />
            </nz-form-control></nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <!-- Modal thêm/sửa TÀI LIỆU (form tối giản — Môn/Khối snapshot từ bộ ở server) -->
    <nz-modal [nzVisible]="materialModalOpen()" [nzTitle]="editingMaterial() ? 'Sửa tài liệu' : 'Thêm tài liệu'"
      [nzOkLoading]="saving()" [nzOkDisabled]="materialForm.invalid" (nzOnOk)="saveMaterial()" (nzOnCancel)="materialModalOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="materialForm">
          @if (editingMaterial(); as m) {
            <nz-form-item><nz-form-label>Mã tài liệu</nz-form-label>
              <nz-form-control><input nz-input [value]="m.code" disabled /></nz-form-control></nz-form-item>
          }
          <nz-form-item><nz-form-label nzRequired>Tên tài liệu</nz-form-label>
            <nz-form-control nzErrorTip="Nhập tên tài liệu">
              <input nz-input formControlName="title" placeholder="VD: Getting Started, Reading..." /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Unit</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="unitId" class="full" nzAllowClear nzPlaceHolder="— Chưa thuộc Unit —">
                @for (u of units(); track u.id) {
                  <nz-option [nzValue]="u.id" [nzLabel]="unitLabel(u)" />
                }
              </nz-select>
            </nz-form-control></nz-form-item>
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

    <!-- Trình xem tài liệu full màn hình dùng chung -->
    <app-document-preview />
  `,
  // Style layout của flow này nằm ở styles.scss dưới scope .hs-mat-theme (host class) —
  // tránh vượt budget anyComponentStyle, đồng thời dùng chung token với card sách ở tab môn học.
  styles: `
    :host { display: block; }
    .full { width: 100%; }
    .muted { color: var(--hs-text-muted); }
    .spacer { flex: 1; }
  `
})
export class FolderDetailPage {
  private readonly auth = inject(AuthService);
  private readonly materialsService = inject(MaterialsService);
  private readonly settingsService = inject(SettingsService);
  protected readonly filesService = inject(FilesService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);

  /** Path param :folderId + query param ?subjectId=&unitId= (withComponentInputBinding). */
  readonly folderId = input<string | null>(null);
  readonly subjectId = input<string | null>(null);
  readonly unitId = input<string | null>(null);

  protected readonly canManage = () => this.auth.isAdmin() || this.auth.isTeacher();
  protected readonly MaterialSource = MaterialSource;
  protected readonly Kind = MaterialUnitKind;

  protected readonly folder = signal<MaterialFolder | null>(null);
  protected readonly units = signal<MaterialUnit[]>([]);
  /** Tài liệu chưa thuộc Unit — sidebar "Tài nguyên khác". */
  protected readonly unassigned = signal<Material[]>([]);
  /** Tài liệu của unit đang mở (mức 4). */
  protected readonly unitMaterials = signal<Material[]>([]);
  protected readonly loading = signal(false);
  protected readonly materialsLoading = signal(false);
  protected readonly saving = signal(false);
  protected readonly serverUploadAllowed = signal(false);

  protected readonly currentUnit = computed(() => this.units().find(u => u.id === this.unitId()) ?? null);
  protected readonly heroBg = computed(() => {
    const cid = this.folder()?.coverFileId;
    return cid ? `url(${this.filesService.downloadUrl(cid)})` : '';
  });
  /** 2 cột kiểu mục lục sách: nửa đầu cột trái, nửa sau cột phải (mobile stack giữ thứ tự). */
  protected readonly unitColumns = computed(() => {
    const list = this.units();
    if (list.length === 0) return [];
    const half = Math.ceil(list.length / 2);
    return list.length <= 3 ? [list] : [list.slice(0, half), list.slice(half)];
  });

  // Modal Unit
  protected readonly unitModalOpen = signal(false);
  protected readonly editingUnit = signal<MaterialUnit | null>(null);
  protected readonly unitForm = new FormGroup({
    kind: new FormControl(MaterialUnitKind.Unit, { nonNullable: true }),
    name: new FormControl<string | null>(null)
  });

  // Modal Tài liệu (tối giản + chọn Unit)
  protected readonly materialModalOpen = signal(false);
  protected readonly editingMaterial = signal<Material | null>(null);
  protected readonly uploadedFileId = signal<string | null>(null);
  protected readonly uploadedFileName = signal<string | null>(null);
  protected readonly materialForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    unitId: new FormControl<string | null>(null),
    source: new FormControl(MaterialSource.ExternalUrl, { nonNullable: true }),
    url: new FormControl<string | null>(null),
    description: new FormControl<string | null>(null)
  });

  /** Trình xem tài liệu full màn hình dùng chung. */
  private readonly preview = viewChild.required(DocumentPreview);

  constructor() {
    this.settingsService.getEffective().subscribe(s =>
      this.serverUploadAllowed.set(s.values['FileStorage.Mode'] === FileStorageMode.Server));

    // Đổi bộ (deep-link/F5) → nạp bộ + units + tài liệu ngoài unit.
    effect(() => {
      const fid = this.folderId();
      untracked(() => { if (fid) this.loadFolderContext(fid); });
    });

    // Đổi unit đang mở → nạp danh sách bài học (mức 4).
    effect(() => {
      const uid = this.unitId();
      untracked(() => { if (uid) this.loadUnitMaterials(uid); });
    });
  }

  // ---- Điều hướng ----

  protected goHome(): void {
    const sid = this.folder()?.subjectId ?? this.subjectId();
    this.router.navigate(['/materials'], { queryParams: { tab: 'subject', subjectId: sid } });
  }

  protected openUnit(u: MaterialUnit): void {
    this.router.navigate([], { queryParams: { unitId: u.id }, queryParamsHandling: 'merge' });
  }

  protected backToUnits(): void {
    this.router.navigate([], { queryParams: { unitId: null }, queryParamsHandling: 'merge' });
  }

  /** Nhãn hiển thị của unit — dùng cho aria-label + option select. */
  protected unitLabel(u: MaterialUnit): string {
    return u.kind === MaterialUnitKind.Unit
      ? `Unit ${u.unitNo} — ${u.name}`
      : `Review ${u.unitNo}${u.name ? ` — ${u.name}` : ''}`;
  }

  // ---- Nạp dữ liệu ----

  private loadFolderContext(folderId: string): void {
    this.loading.set(true);
    this.materialsService.getFolder(folderId).subscribe({
      next: f => this.folder.set(f),
      error: (err: HttpErrorResponse) => {
        this.message.error(err.error?.message ?? 'Không tìm thấy bộ tài liệu.');
        this.router.navigate(['/materials'], { queryParams: { tab: 'subject' } });
      }
    });
    this.loadUnits(folderId);
    this.loadUnassigned(folderId);
  }

  private loadUnits(folderId: string): void {
    this.loading.set(true);
    this.materialsService.getUnits(folderId).subscribe({
      next: list => { this.units.set(list); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  private loadUnassigned(folderId: string): void {
    this.materialsService.getPaged({ folderId, noUnit: true, page: 1, pageSize: 100 })
      .subscribe(r => this.unassigned.set(r.items));
  }

  private loadUnitMaterials(unitId: string): void {
    const fid = this.folderId();
    if (!fid) return;
    this.materialsLoading.set(true);
    this.materialsService.getPaged({ folderId: fid, unitId, page: 1, pageSize: 100 }).subscribe({
      next: r => { this.unitMaterials.set(r.items); this.materialsLoading.set(false); },
      error: () => this.materialsLoading.set(false)
    });
  }

  /** Nạp lại mọi thứ phụ thuộc tài liệu sau CRUD (đếm trên bar + sidebar + list unit đang mở). */
  private reloadAfterMaterialChange(): void {
    const fid = this.folderId();
    if (!fid) return;
    this.loadUnits(fid);
    this.loadUnassigned(fid);
    const uid = this.unitId();
    if (uid) this.loadUnitMaterials(uid);
  }

  // ---- CRUD Unit ----

  protected openCreateUnit(): void {
    this.editingUnit.set(null);
    this.unitForm.reset({ kind: MaterialUnitKind.Unit, name: null });
    this.unitModalOpen.set(true);
  }

  protected openEditUnit(u: MaterialUnit): void {
    this.editingUnit.set(u);
    this.unitForm.reset({ kind: u.kind, name: u.name || null });
    this.unitModalOpen.set(true);
  }

  protected saveUnit(): void {
    const fid = this.folderId();
    if (!fid) return;
    const v = this.unitForm.getRawValue();
    if (v.kind === MaterialUnitKind.Unit && !v.name?.trim()) { this.message.warning('Nhập tên chủ đề cho Unit.'); return; }

    const editing = this.editingUnit();
    const op = editing
      ? this.materialsService.updateUnit(editing.id, { kind: v.kind, name: v.name?.trim() || null })
      : this.materialsService.createUnit({ folderId: fid, kind: v.kind, name: v.name?.trim() || null });

    this.saving.set(true);
    op.subscribe({
      next: () => { this.saving.set(false); this.unitModalOpen.set(false); this.message.success('Đã lưu Unit.'); this.loadUnits(fid); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message ?? 'Lưu thất bại.'); }
    });
  }

  protected removeUnit(u: MaterialUnit): void {
    this.materialsService.deleteUnit(u.id).subscribe({
      next: () => { this.message.success('Đã xóa Unit.'); this.loadUnits(this.folderId()!); },
      // Unit còn tài liệu ⇒ BE chặn (MaterialUnit.InUse) — hiện message tiếng Việt từ server.
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ?? 'Xóa thất bại.')
    });
  }

  protected isFirst(u: MaterialUnit): boolean { return this.units()[0]?.id === u.id; }
  protected isLast(u: MaterialUnit): boolean { return this.units().at(-1)?.id === u.id; }

  /** Đổi chỗ với hàng xóm rồi gửi TOÀN BỘ thứ tự mới trong 1 call reorder — server đánh số lại. */
  protected moveUnit(u: MaterialUnit, dir: -1 | 1): void {
    const fid = this.folderId();
    if (!fid) return;
    const ids = this.units().map(x => x.id);
    const i = ids.indexOf(u.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    this.materialsService.reorderUnits(fid, ids).subscribe({
      next: list => this.units.set(list),
      error: (err: HttpErrorResponse) => {
        this.message.error(err.error?.message ?? err.message ?? 'Sắp xếp thất bại.');
        this.loadUnits(fid); // dữ liệu cũ (unit vừa thêm/xóa nơi khác) — đồng bộ lại
      }
    });
  }

  // ---- CRUD Tài liệu ----

  protected openCreateMaterial(unitId: string | null): void {
    this.editingMaterial.set(null);
    this.uploadedFileId.set(null);
    this.uploadedFileName.set(null);
    this.materialForm.reset({ title: '', unitId, source: MaterialSource.ExternalUrl, url: null, description: null });
    this.materialModalOpen.set(true);
  }

  protected openEditMaterial(m: Material): void {
    this.editingMaterial.set(m);
    this.uploadedFileId.set(m.storedFileId);
    this.uploadedFileName.set(m.storedFileId ? (m.fileName ?? 'file hiện tại') : null);
    this.materialForm.reset({ title: m.title, unitId: m.unitId, source: m.source, url: m.url, description: m.description });
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
      folderId: this.folderId(),
      unitId: v.unitId
    };
    const op = editing ? this.materialsService.update(editing.id, body) : this.materialsService.create(body);

    this.saving.set(true);
    op.subscribe({
      next: () => { this.saving.set(false); this.materialModalOpen.set(false); this.message.success('Đã lưu tài liệu.'); this.reloadAfterMaterialChange(); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message ?? 'Lưu thất bại.'); }
    });
  }

  protected removeMaterial(m: Material): void {
    this.materialsService.delete(m.id).subscribe({
      next: () => { this.message.success('Đã xóa.'); this.reloadAfterMaterialChange(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ?? 'Xóa thất bại.')
    });
  }

  /** Xóa từ menu ⋮ sidebar — confirm bằng modal (popconfirm không hợp trong dropdown). */
  protected confirmRemoveMaterial(m: Material): void {
    this.modal.confirm({
      nzTitle: 'Xóa tài liệu này?',
      nzContent: m.title,
      nzOkText: 'Xóa',
      nzOkDanger: true,
      nzOnOk: () => this.removeMaterial(m)
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

  // ---- Xem / Download / Đề (pattern dùng chung của Kho tài liệu) ----

  protected openMaterial(m: Material): void {
    if (m.source === MaterialSource.ExternalUrl) {
      window.open(m.url!, '_blank');
    } else if (m.storedFileId) {
      this.preview().open({ fileId: m.storedFileId, title: m.title, fileName: m.fileName });
    }
  }

  protected download(m: Material): void {
    if (m.source === MaterialSource.ServerFile && m.storedFileId) {
      this.filesService.download(m.storedFileId, m.fileName ?? m.title);
    } else if (m.url) {
      window.open(m.url, '_blank');
    }
  }

  /** Mở trang đề (sinh đề AI) — kèm ngữ cảnh folderId + unitId để nút back quay về đúng màn. */
  protected openExams(m: Material): void {
    this.router.navigate(['/materials', m.id, 'exams'], {
      queryParams: {
        title: m.title, tab: 'subject',
        subjectId: this.folder()?.subjectId ?? this.subjectId(),
        folderId: this.folderId(), unitId: this.unitId()
      }
    });
  }
}
