import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { AuthService } from '../../core/auth.service';
import { FilesService } from '../../core/files.service';
import { MaterialsService } from '../../core/materials.service';
import { Material, MaterialFolder, MaterialSource, MaterialUnit, MaterialUnitKind } from '../../core/models';
import { AssignToClassModal } from '../../shared/assign-to-class.modal';
import { DocumentPreview } from '../../shared/document-preview';
import { ExamGenerateModal } from '../exams/exam-generate.modal';
import { ExamsOfMaterialModal } from '../exams/exams-of-material.modal';
import { MaterialFormModal } from './material-form.modal';

/**
 * Chi tiết một Bộ tài liệu — trình bày kiểu "sách": bìa làm nền + mục lục Unit + danh sách bài học.
 *
 * Mục lục là LƯỚI THẺ tự xuống dòng nên giáo viên thấy hết Unit kèm TÊN trong một lần nhìn
 * (không cuộn ngang), và chọn Unit là đổi luôn danh sách bên dưới — không phải vào/ra hai mức như trước.
 * Mỗi bài học là một thẻ có badge số đề, nút giao cho lớp và nút sinh đề bằng AI.
 */
@Component({
  selector: 'app-folder-detail-page',
  imports: [
    ReactiveFormsModule,
    NzButtonModule, NzCardModule, NzDropDownModule, NzEmptyModule, NzFormModule, NzIconModule,
    NzInputModule, NzModalModule, NzRadioModule, NzSpinModule, NzTagModule, NzTooltipModule,
    DocumentPreview, MaterialFormModal, AssignToClassModal, ExamGenerateModal, ExamsOfMaterialModal
  ],
  host: { class: 'hs-book' },
  template: `
    <!-- Hero: ảnh bìa làm nền mờ, nội dung nổi bên trên -->
    <div class="hero">
      <div class="hero-bg" [style.background-image]="heroBg()"></div>
      <div class="hero-overlay"></div>
      <div class="hero-inner">
        <button nz-button nzShape="circle" nzType="primary" class="hero-home"
                nz-tooltip nzTooltipTitle="Về danh sách bộ tài liệu" aria-label="Về danh sách bộ tài liệu"
                (click)="goHome()">
          <nz-icon nzType="home" />
        </button>
        <div class="hero-text">
          <div class="hero-crumb">{{ folder()?.subjectName || 'Môn học' }}@if (folder()?.gradeBand) { · Khối {{ folder()?.gradeBand }} }</div>
          <h1 class="hero-title">{{ folder()?.name || 'Bộ tài liệu' }}</h1>
          <div class="hero-meta">
            {{ folder()?.materialCount ?? 0 }} tài liệu · {{ units().length }} Unit
            @if ((folder()?.examCount ?? 0) > 0) { · {{ folder()?.examCount }} đề }
          </div>
        </div>
        @if (canManage()) {
          <button nz-button nzType="primary" (click)="openCreateMaterial(activeUnitId())">
            <nz-icon nzType="plus" /> Thêm tài liệu
          </button>
        }
      </div>
    </div>

    <!-- Mục lục: lưới thẻ Unit, thấy hết cùng lúc kèm tên -->
    <div class="toc-head">
      <h3>Mục lục</h3>
      <span class="rule"></span>
      @if (canManage()) {
        <button nz-button nzSize="small" (click)="openCreateUnit()"><nz-icon nzType="plus" /> Thêm Unit</button>
      }
    </div>
    <nz-spin [nzSpinning]="loading()">
      <div class="toc">
        @for (u of units(); track u.id) {
          <div class="unit-card" role="button" tabindex="0" [class.is-review]="u.kind === Kind.Review"
               [attr.aria-selected]="u.id === activeUnitId()" (click)="selectUnit(u.id)"
               (keydown.enter)="selectUnit(u.id)" (keydown.space)="$event.preventDefault(); selectUnit(u.id)">
            <span class="unit-no">{{ u.kind === Kind.Review ? 'R' + u.unitNo : u.unitNo }}</span>
            <span class="unit-text">
              <span class="unit-lab">{{ u.kind === Kind.Review ? 'Review ' + u.unitNo : 'Unit ' + u.unitNo }}</span>
              <span class="unit-name">{{ u.name || 'Chưa đặt tên' }}</span>
              <span class="unit-meta">
                {{ u.materialCount }} tài liệu@if (u.examCount > 0) { · {{ u.examCount }} đề }
              </span>
            </span>
            @if (canManage()) {
              <span class="unit-tools" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
                <button nz-button nzType="text" nzSize="small" [disabled]="isFirst(u)"
                        nz-tooltip nzTooltipTitle="Lên trên" aria-label="Chuyển Unit lên trên" (click)="moveUnit(u, -1)">
                  <nz-icon nzType="arrow-up" />
                </button>
                <button nz-button nzType="text" nzSize="small" [disabled]="isLast(u)"
                        nz-tooltip nzTooltipTitle="Xuống dưới" aria-label="Chuyển Unit xuống dưới" (click)="moveUnit(u, 1)">
                  <nz-icon nzType="arrow-down" />
                </button>
                <button nz-button nzType="text" nzSize="small" nz-tooltip nzTooltipTitle="Sửa Unit"
                        aria-label="Sửa Unit" (click)="openEditUnit(u)">
                  <nz-icon nzType="edit" />
                </button>
                <button nz-button nzType="text" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa Unit"
                        aria-label="Xóa Unit" (click)="confirmRemoveUnit(u)">
                  <nz-icon nzType="delete" />
                </button>
              </span>
            }
          </div>
        }

        <!-- Tài liệu chưa thuộc Unit nằm ngay trong mục lục, không cần cột riêng -->
        <div class="unit-card is-none" role="button" tabindex="0"
             [attr.aria-selected]="activeUnitId() === null" (click)="selectUnit(null)"
             (keydown.enter)="selectUnit(null)" (keydown.space)="$event.preventDefault(); selectUnit(null)">
          <span class="unit-no">?</span>
          <span class="unit-text">
            <span class="unit-lab">Ngoài mục lục</span>
            <span class="unit-name">Chưa thuộc Unit</span>
            <span class="unit-meta">{{ unassignedCount() }} tài liệu</span>
          </span>
        </div>
      </div>
    </nz-spin>

    <!-- Danh sách bài học của Unit đang chọn -->
    <nz-card class="lessons-card">
      <div class="lessons-head">
        <div class="lessons-title">{{ activeUnitTitle() }}</div>
        @if (canManage()) {
          <button nz-button nzSize="small" (click)="openCreateMaterial(activeUnitId())">
            <nz-icon nzType="plus" /> Thêm tài liệu
          </button>
        }
      </div>

      <nz-spin [nzSpinning]="materialsLoading()">
        <div class="lessons">
          @for (m of visibleMaterials(); track m.id) {
            <div class="lesson">
              <span class="lesson-ico" [class]="iconClass(m)"><nz-icon [nzType]="iconType(m)" /></span>
              <span class="lesson-text">
                <span class="lesson-name">{{ m.title }}</span>
                <span class="lesson-meta">{{ m.code }} · {{ sourceLabel(m) }}</span>
              </span>
              <span class="lesson-actions">
                @if (m.examCount > 0) {
                  <button class="exam-badge" type="button" (click)="openExams(m)"
                          nz-tooltip nzTooltipTitle="Xem và giao các đề sinh từ tài liệu này">{{ m.examCount }} đề</button>
                } @else {
                  <nz-tag>Chưa có đề</nz-tag>
                }
                <button nz-button nzSize="small" (click)="openMaterial(m)">
                  {{ m.source === MaterialSource.ExternalUrl ? 'Mở liên kết' : 'Xem' }}
                </button>
                @if (canManage()) {
                  <button nz-button nzSize="small" (click)="openAssign(m)">Giao cho lớp</button>
                  <button nz-button nzSize="small" nzType="primary" nzGhost (click)="openGenerate(m)">
                    <nz-icon nzType="thunderbolt" /> Sinh đề
                  </button>
                  <button nz-button nzSize="small" nzType="text" nz-dropdown [nzDropdownMenu]="more"
                          aria-label="Thao tác khác"><nz-icon nzType="more" /></button>
                  <nz-dropdown-menu #more="nzDropdownMenu">
                    <ul nz-menu>
                      <li nz-menu-item (click)="download(m)"><nz-icon nzType="download" /> Tải xuống</li>
                      <li nz-menu-item (click)="openEditMaterial(m)"><nz-icon nzType="edit" /> Sửa</li>
                      <li nz-menu-item nzDanger (click)="confirmRemoveMaterial(m)"><nz-icon nzType="delete" /> Xóa</li>
                    </ul>
                  </nz-dropdown-menu>
                }
              </span>
            </div>
          } @empty {
            @if (!materialsLoading()) {
              <nz-empty class="lessons-empty" nzNotFoundContent="Chưa có tài liệu nào trong mục này." />
            }
          }
        </div>
      </nz-spin>
    </nz-card>

    <!-- Modal Unit -->
    <nz-modal [nzVisible]="unitModalOpen()" [nzTitle]="editingUnit() ? 'Sửa Unit' : 'Thêm Unit'"
              [nzOkLoading]="saving()" (nzOnOk)="saveUnit()" (nzOnCancel)="unitModalOpen.set(false)">
      <form *nzModalContent nz-form nzLayout="vertical" [formGroup]="unitForm">
        <nz-form-item>
          <nz-form-label>Kiểu</nz-form-label>
          <nz-form-control>
            <nz-radio-group formControlName="kind">
              <label nz-radio-button [nzValue]="Kind.Unit">Unit</label>
              <label nz-radio-button [nzValue]="Kind.Review">Review</label>
            </nz-radio-group>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label [nzRequired]="unitForm.value.kind === Kind.Unit">Tên chủ đề</nz-form-label>
          <nz-form-control nzExtra="Review được để trống — hệ thống hiển thị “Review 1”, “Review 2”…">
            <input nz-input formControlName="name" placeholder="vd: Our experiences" />
          </nz-form-control>
        </nz-form-item>
      </form>
    </nz-modal>

    <app-document-preview />

    <app-material-form-modal
      [visible]="materialFormOpen()" [editing]="editingMaterial()" [folderId]="folderId()"
      [units]="units()"
      (closed)="materialFormOpen.set(false)"
      (saved)="materialFormOpen.set(false); reloadAfterMaterialChange()" />

    <app-assign-to-class-modal
      [visible]="assignOpen()" kind="material"
      [targetId]="assignTarget()?.id ?? null" [targetTitle]="assignTarget()?.title ?? ''"
      (closed)="assignOpen.set(false)" (assigned)="assignOpen.set(false)" />

    <app-exam-generate-modal
      [visible]="generateOpen()" [material]="generateTarget()"
      (closed)="generateOpen.set(false)" (generated)="generateOpen.set(false); reloadAfterMaterialChange()" />

    <app-exams-of-material-modal
      [visible]="examsOpen()" [material]="examsTarget()"
      (closed)="examsOpen.set(false)" (changed)="reloadAfterMaterialChange()" />
  `,
  styles: `
    .hero { position: relative; border-radius: 16px; overflow: hidden; margin-bottom: 18px;
      border: 1px solid var(--hs-border); background: var(--hs-surface); }
    .hero-bg { position: absolute; inset: 0; background-size: cover; background-position: center;
      filter: blur(24px); transform: scale(1.2); opacity: .35; }
    .hero-overlay { position: absolute; inset: 0;
      background: linear-gradient(120deg, var(--hs-primary-weak, #eef0fe) 0%, transparent 70%); }
    .hero-inner { position: relative; display: flex; align-items: center; gap: 14px; padding: 18px; flex-wrap: wrap; }
    .hero-home { flex: 0 0 auto; }
    .hero-text { flex: 1; min-width: 0; }
    .hero-crumb { font-size: 11.5px; font-weight: 800; text-transform: uppercase;
      color: var(--hs-primary, #4f46e5); }
    .hero-title { margin: 2px 0 0; font-size: 24px; font-weight: 800; letter-spacing: 0; text-wrap: balance; }
    .hero-meta { font-size: 12.5px; color: var(--hs-text-muted); }

    .toc-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .toc-head h3 { margin: 0; font-size: 12.5px; font-weight: 800; letter-spacing: .6px;
      text-transform: uppercase; color: var(--hs-text-muted); }
    .toc-head .rule { flex: 1; height: 1px; background: var(--hs-border); }

    .toc { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; margin-bottom: 18px; }
    .unit-card { display: grid; grid-template-columns: 40px minmax(0, 1fr);
      align-items: center; gap: 9px 11px; text-align: left; cursor: pointer;
      padding: 11px 12px; border-radius: 10px; border: 1px solid var(--hs-border-strong, #cbcee4);
      background: var(--hs-surface); color: inherit; }
    .unit-card:hover, .unit-card:focus-visible { border-color: var(--hs-primary, #4f46e5); }
    .unit-card[aria-selected="true"] { border-color: var(--hs-primary, #4f46e5);
      box-shadow: 0 0 0 2px var(--hs-primary-weak, #eef0fe) inset; }
    .unit-no { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center;
      font-weight: 800; font-size: 15px; background: var(--hs-primary-weak, #eef0fe); color: var(--hs-primary, #4f46e5); }
    .unit-card.is-review .unit-no { background: #fdf3e3; color: #b45309; font-size: 13px; }
    .unit-text { display: block; min-width: 0; }
    .unit-lab { display: block; font-size: 10px; font-weight: 800;
      text-transform: uppercase; color: var(--hs-text-muted); }
    .unit-name { display: block; font-size: 13.5px; font-weight: 700; line-height: 1.28; overflow-wrap: anywhere; }
    .unit-meta { display: block; font-size: 11.5px; color: var(--hs-text-muted); margin-top: 3px; }
    .unit-tools { grid-column: 1 / -1; display: flex; align-items: center; justify-content: flex-end; gap: 2px;
      padding-top: 8px; border-top: 1px solid var(--hs-border); }

    .lessons-card :where(.ant-card-body) { padding: 0; }
    .lessons-head { display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 14px 16px; border-bottom: 1px solid var(--hs-border); flex-wrap: wrap; }
    .lessons-title { font-weight: 750; font-size: 15px; }
    .lessons { display: flex; flex-direction: column; }
    .lessons-empty { padding: 28px 0; }
    .lesson { display: flex; align-items: center; gap: 13px; padding: 12px 16px;
      border-bottom: 1px solid var(--hs-border); }
    .lesson:last-child { border-bottom: 0; }
    .lesson:hover { background: var(--hs-surface-2, #f7f8fd); }
    .lesson-ico { width: 40px; height: 40px; flex: 0 0 40px; border-radius: 10px; display: grid; place-items: center;
      font-size: 18px; background: var(--hs-surface-3, #edeff8); color: var(--hs-text-muted); }
    .lesson-ico.ico-pdf { background: #fbebeb; color: #c62828; }
    .lesson-ico.ico-doc { background: var(--hs-primary-weak, #eef0fe); color: var(--hs-primary, #4f46e5); }
    .lesson-ico.ico-link { background: #e6f5ec; color: #15803d; }
    .lesson-text { flex: 1; min-width: 0; }
    .lesson-name { display: block; font-weight: 700; font-size: 14.5px; overflow-wrap: anywhere; }
    .lesson-meta { display: block; font-size: 12px; color: var(--hs-text-muted); }
    .lesson-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }

    .exam-badge { border: 0; cursor: pointer; font-size: 12px; font-weight: 700; line-height: 22px;
      padding: 0 10px; border-radius: 999px; background: var(--hs-primary-weak, #eef0fe); color: var(--hs-primary, #4f46e5); }
    .exam-badge:hover { background: var(--hs-primary, #4f46e5); color: #fff; }

    @media (max-width: 640px) {
      .hero-title { font-size: 20px; }
      .toc { grid-template-columns: 1fr; }
      .lesson { flex-wrap: wrap; }
      .lesson-actions { width: 100%; justify-content: flex-start; }
    }
  `
})
export class FolderDetailPage {
  private readonly auth = inject(AuthService);
  private readonly materialsService = inject(MaterialsService);
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
  /** Tài liệu chưa thuộc Unit — hiện khi chọn thẻ "Ngoài mục lục". */
  protected readonly unassigned = signal<Material[]>([]);
  protected readonly unitMaterials = signal<Material[]>([]);
  protected readonly loading = signal(false);
  protected readonly materialsLoading = signal(false);
  protected readonly saving = signal(false);

  /** Unit đang chọn; null = mục "Chưa thuộc Unit". */
  protected readonly activeUnitId = computed(() => this.unitId());
  protected readonly unassignedCount = computed(() => this.unassigned().length);

  protected readonly visibleMaterials = computed(() =>
    this.activeUnitId() === null ? this.unassigned() : this.unitMaterials());

  protected readonly activeUnitTitle = computed(() => {
    const id = this.activeUnitId();
    if (id === null) return 'Tài liệu chưa thuộc Unit';
    const u = this.units().find(x => x.id === id);
    if (!u) return 'Tài liệu';
    return u.kind === MaterialUnitKind.Review
      ? `Review ${u.unitNo}${u.name ? ': ' + u.name : ''}`
      : `Unit ${u.unitNo}${u.name ? ': ' + u.name : ''}`;
  });

  protected readonly heroBg = computed(() => {
    const cid = this.folder()?.coverFileId;
    return cid ? `url(${this.filesService.downloadUrl(cid)})` : '';
  });

  // Modal Unit
  protected readonly unitModalOpen = signal(false);
  protected readonly editingUnit = signal<MaterialUnit | null>(null);
  protected readonly unitForm = new FormGroup({
    kind: new FormControl(MaterialUnitKind.Unit, { nonNullable: true }),
    name: new FormControl<string | null>(null)
  });

  // Modal tài liệu / giao lớp / sinh đề / danh sách đề
  protected readonly materialFormOpen = signal(false);
  protected readonly editingMaterial = signal<Material | null>(null);
  protected readonly assignOpen = signal(false);
  protected readonly assignTarget = signal<Material | null>(null);
  protected readonly generateOpen = signal(false);
  protected readonly generateTarget = signal<Material | null>(null);
  protected readonly examsOpen = signal(false);
  protected readonly examsTarget = signal<Material | null>(null);

  private readonly preview = viewChild.required(DocumentPreview);
  private readonly materialForm = viewChild.required(MaterialFormModal);
  private readonly assign = viewChild.required(AssignToClassModal);
  private readonly generate = viewChild.required(ExamGenerateModal);
  private readonly examsModal = viewChild.required(ExamsOfMaterialModal);

  constructor() {
    // Đổi bộ (deep-link/F5) → nạp bộ + units + tài liệu ngoài unit.
    effect(() => {
      const fid = this.folderId();
      untracked(() => { if (fid) this.loadFolderContext(fid); });
    });

    // Đổi unit đang chọn → nạp danh sách bài học tương ứng.
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

  /** Chọn Unit (null = mục chưa thuộc Unit) — giữ trên URL để F5/back đúng vị trí. */
  protected selectUnit(unitId: string | null): void {
    this.router.navigate([], { queryParams: { unitId }, queryParamsHandling: 'merge' });
  }

  // ---- Hiển thị ----

  protected iconType(m: Material): string {
    if (m.source === MaterialSource.ExternalUrl) return 'link';
    const ext = (m.fileName ?? '').toLowerCase();
    if (ext.endsWith('.pdf')) return 'file-pdf';
    if (ext.endsWith('.doc') || ext.endsWith('.docx')) return 'file-word';
    if (/\.(png|jpe?g|gif|webp)$/.test(ext)) return 'file-image';
    return 'file-text';
  }

  protected iconClass(m: Material): string {
    if (m.source === MaterialSource.ExternalUrl) return 'ico-link';
    const ext = (m.fileName ?? '').toLowerCase();
    if (ext.endsWith('.pdf')) return 'ico-pdf';
    if (ext.endsWith('.doc') || ext.endsWith('.docx')) return 'ico-doc';
    return '';
  }

  protected sourceLabel(m: Material): string {
    return m.source === MaterialSource.ExternalUrl ? 'Đường dẫn ngoài' : (m.fileName ?? 'File trên server');
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

  /** Nạp lại mọi thứ phụ thuộc tài liệu sau CRUD (đếm trên mục lục + danh sách đang mở). */
  protected reloadAfterMaterialChange(): void {
    const fid = this.folderId();
    if (!fid) return;
    this.loadFolderContext(fid);
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

  /** Popconfirm không hoạt động tốt trong thẻ Unit (click lồng nhau) ⇒ dùng modal xác nhận. */
  protected confirmRemoveUnit(u: MaterialUnit): void {
    this.modal.confirm({
      nzTitle: 'Xóa Unit này?',
      nzContent: 'Unit còn tài liệu bên trong sẽ không xóa được.',
      nzOkDanger: true,
      nzOnOk: () => this.removeUnit(u)
    });
  }

  private removeUnit(u: MaterialUnit): void {
    this.materialsService.deleteUnit(u.id).subscribe({
      next: () => {
        this.message.success('Đã xóa Unit.');
        if (this.unitId() === u.id) this.selectUnit(null);
        this.loadUnits(this.folderId()!);
      },
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

  // ---- Tài liệu ----

  protected openCreateMaterial(unitId: string | null): void {
    this.editingMaterial.set(null);
    this.materialForm().open(unitId);
    this.materialFormOpen.set(true);
  }

  protected openEditMaterial(m: Material): void {
    this.editingMaterial.set(m);
    this.materialForm().open();
    this.materialFormOpen.set(true);
  }

  protected openAssign(m: Material): void {
    this.assignTarget.set(m);
    this.assign().open();
    this.assignOpen.set(true);
  }

  protected openGenerate(m: Material): void {
    this.generateTarget.set(m);
    this.generate().open();
    this.generateOpen.set(true);
  }

  protected openExams(m: Material): void {
    this.examsTarget.set(m);
    this.examsModal().open();
    this.examsOpen.set(true);
  }

  protected confirmRemoveMaterial(m: Material): void {
    this.modal.confirm({
      nzTitle: 'Xóa tài liệu này?',
      nzContent: m.title,
      nzOkDanger: true,
      nzOnOk: () => this.removeMaterial(m)
    });
  }

  private removeMaterial(m: Material): void {
    this.materialsService.delete(m.id).subscribe({
      next: () => { this.message.success('Đã xóa tài liệu.'); this.reloadAfterMaterialChange(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ?? 'Xóa thất bại.')
    });
  }

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
}
