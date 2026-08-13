import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { AuthService } from '../../core/auth.service';
import { FilesService } from '../../core/files.service';
import { MaterialsService } from '../../core/materials.service';
import { Grade, Material, MaterialSource, Subject } from '../../core/models';
import { AssignToClassModal } from '../../shared/assign-to-class.modal';
import { DocumentPreview } from '../../shared/document-preview';
import { ExamGenerateModal } from '../exams/exam-generate.modal';
import { ExamsOfMaterialModal } from '../exams/exams-of-material.modal';
import { MaterialFormModal } from './material-form.modal';

/**
 * Tab "Tài liệu chung" — tài liệu tự do KHÔNG thuộc bộ nào (FolderId null): lưới thẻ có ảnh bìa.
 * Mỗi thẻ có badge số đề (bấm xem/giao từng đề), nút Giao cho lớp và nút Sinh đề bằng AI.
 */
@Component({
  selector: 'app-general-materials-tab',
  imports: [
    FormsModule,
    NzBadgeModule, NzButtonModule, NzCardModule, NzEmptyModule, NzIconModule, NzInputModule,
    NzPaginationModule, NzPopconfirmModule, NzSelectModule, NzSpinModule, NzTagModule, NzTooltipModule,
    DocumentPreview, MaterialFormModal, AssignToClassModal, ExamGenerateModal, ExamsOfMaterialModal
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
          <nz-card class="material-card" [nzCover]="cover">
            <div class="mc-head">
              <nz-tag>{{ m.code }}</nz-tag>
              @if (m.examCount > 0) {
                <button class="exam-badge" type="button" (click)="openExams(m)"
                        nz-tooltip nzTooltipTitle="Xem và giao các đề sinh từ tài liệu này">
                  {{ m.examCount }} đề
                </button>
              } @else {
                <nz-tag>Chưa có đề</nz-tag>
              }
            </div>
            <div class="mc-title" [title]="m.title">{{ m.title }}</div>
            <div class="mc-meta">{{ m.subjectName || '—' }} · Khối {{ m.gradeBand || '—' }}</div>
            @if (m.description) { <div class="mc-desc">{{ m.description }}</div> }

            <div class="mc-actions">
              <button nz-button nzSize="small" (click)="openMaterial(m)">
                {{ m.source === MaterialSource.ExternalUrl ? 'Mở liên kết' : 'Xem' }}
              </button>
              @if (canManage()) {
                <button nz-button nzSize="small" (click)="openAssign(m)">Giao cho lớp</button>
                <button nz-button nzSize="small" nzType="primary" nzGhost (click)="openGenerate(m)">
                  <nz-icon nzType="thunderbolt" /> Sinh đề
                </button>
                <button nz-button nzSize="small" nzType="text" nz-tooltip nzTooltipTitle="Tải xuống" (click)="download(m)">
                  <nz-icon nzType="download" />
                </button>
                <button nz-button nzSize="small" nzType="text" nz-tooltip nzTooltipTitle="Sửa" (click)="openEdit(m)">
                  <nz-icon nzType="edit" />
                </button>
                <button nz-button nzSize="small" nzType="text" nzDanger nz-tooltip nzTooltipTitle="Xóa"
                        nz-popconfirm nzPopconfirmTitle="Xóa tài liệu này?" (nzOnConfirm)="remove(m)">
                  <nz-icon nzType="delete" />
                </button>
              }
            </div>
          </nz-card>
          <ng-template #cover>
            @if (m.coverFileId) {
              <img class="mc-cover" [src]="filesService.downloadUrl(m.coverFileId)" [alt]="m.title" loading="lazy" />
            } @else {
              <div class="mc-cover-placeholder" aria-hidden="true"><nz-icon nzType="file-text" /></div>
            }
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

    <app-document-preview />

    <app-material-form-modal
      [visible]="formOpen()" [editing]="editing()" [folderId]="null"
      [subjects]="subjects()" [grades]="grades()" [showCover]="true"
      (closed)="formOpen.set(false)" (saved)="formOpen.set(false); load()" />

    <app-assign-to-class-modal
      [visible]="assignOpen()" kind="material"
      [targetId]="assignTarget()?.id ?? null" [targetTitle]="assignTarget()?.title ?? ''"
      (closed)="assignOpen.set(false)" (assigned)="assignOpen.set(false)" />

    <app-exam-generate-modal
      [visible]="generateOpen()" [material]="generateTarget()"
      (closed)="generateOpen.set(false)" (generated)="generateOpen.set(false); load()" />

    <app-exams-of-material-modal
      [visible]="examsOpen()" [material]="examsTarget()"
      (closed)="examsOpen.set(false)" (changed)="load()" />
  `,
  styles: `
    .filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .filters input, .filters nz-select { min-width: 200px; flex: 1; max-width: 320px; }
    .filter-actions { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
    .filter-actions .spacer { flex: 1; }
    .pager { display: flex; justify-content: center; margin-top: 16px; }

    .material-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; min-height: 120px; }
    .grid-empty { grid-column: 1 / -1; align-self: center; }
    .material-card { display: flex; flex-direction: column; }
    .mc-cover { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
    .mc-cover-placeholder { aspect-ratio: 16 / 9; display: grid; place-items: center; font-size: 40px;
      color: rgba(255, 255, 255, 0.92);
      background: linear-gradient(135deg, var(--hs-primary, #4f46e5) 0%, #818cf8 60%, #c7d2fe 100%); }
    .mc-head { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 6px; }
    .mc-title { font-weight: 650; line-height: 1.4; min-height: 2.8em;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .mc-meta { color: var(--hs-text-muted); font-size: 13px; margin-top: 4px; }
    .mc-desc { color: var(--hs-text-muted); font-size: 13px; margin-top: 4px;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .mc-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 12px; }

    .exam-badge { border: 0; cursor: pointer; font-size: 12px; font-weight: 700; line-height: 20px;
      padding: 0 9px; border-radius: 999px; background: var(--hs-primary-weak, #eef0fe); color: var(--hs-primary, #4f46e5); }
    .exam-badge:hover { background: var(--hs-primary, #4f46e5); color: #fff; }

    @media (max-width: 575px) { .filters input, .filters nz-select { max-width: none; width: 100%; } }
  `
})
export class GeneralMaterialsTab {
  private readonly auth = inject(AuthService);
  private readonly materialsService = inject(MaterialsService);
  protected readonly filesService = inject(FilesService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);

  readonly subjects = input<Subject[]>([]);
  readonly grades = input<Grade[]>([]);

  protected readonly canManage = () => this.auth.isAdmin() || this.auth.isTeacher();
  protected readonly MaterialSource = MaterialSource;
  /** Bội số của 1/2/3/4 cột để lưới không hụt hàng (server clamp pageSize ≤ 100). */
  protected readonly GRID_PAGE_SIZES = [12, 24, 48, 96];

  protected readonly materials = signal<Material[]>([]);
  protected readonly loading = signal(false);

  // Bộ lọc — chỉ áp khi bấm "Tìm kiếm"
  protected search = '';
  protected subjectId: string | null = null;
  protected gradeBand: string | null = null;

  protected readonly page = signal(1);
  protected readonly pageSize = signal(12);
  protected readonly total = signal(0);

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Material | null>(null);
  protected readonly assignOpen = signal(false);
  protected readonly assignTarget = signal<Material | null>(null);
  protected readonly generateOpen = signal(false);
  protected readonly generateTarget = signal<Material | null>(null);
  protected readonly examsOpen = signal(false);
  protected readonly examsTarget = signal<Material | null>(null);

  private readonly preview = viewChild.required(DocumentPreview);
  private readonly form = viewChild.required(MaterialFormModal);
  private readonly assign = viewChild.required(AssignToClassModal);
  private readonly generate = viewChild.required(ExamGenerateModal);
  private readonly examsModal = viewChild.required(ExamsOfMaterialModal);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.materialsService.getPaged({
      search: this.search, subjectId: this.subjectId, gradeBand: this.gradeBand,
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
    this.gradeBand = null;
    this.applyFilters();
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form().open();
    this.formOpen.set(true);
  }

  protected openEdit(m: Material): void {
    this.editing.set(m);
    this.form().open();
    this.formOpen.set(true);
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
