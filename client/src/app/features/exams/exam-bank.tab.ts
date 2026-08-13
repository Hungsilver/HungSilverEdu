import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ExamService } from '../../core/exam.service';
import { MaterialsService } from '../../core/materials.service';
import { ExamListItem, Grade, Material, Subject } from '../../core/models';
import { AssignToClassModal } from '../../shared/assign-to-class.modal';
import { PAGE_SIZE_OPTIONS } from '../../shared/table';
import { ExamGenerateModal } from './exam-generate.modal';

/** Bộ lọc trạng thái hiển thị dạng thanh chọn — gộp trạng thái đề và "đang giao" cho gọn. */
type StatusFilter = 'all' | 'draft' | 'published' | 'assigned';

/**
 * Tab "Bộ đề" — mọi đề của trung tâm ở một chỗ, thay cho việc phải đi
 * Kho → Môn → Bộ → Unit → Tài liệu mới thấy đề.
 */
@Component({
  selector: 'app-exam-bank-tab',
  imports: [
    FormsModule,
    NzButtonModule, NzCardModule, NzEmptyModule, NzIconModule, NzInputModule, NzPaginationModule,
    NzPopconfirmModule, NzRadioModule, NzSelectModule, NzSpinModule, NzTableModule, NzTagModule, NzTooltipModule,
    AssignToClassModal, ExamGenerateModal
  ],
  template: `
    <div class="filters">
      <nz-radio-group [(ngModel)]="status" (ngModelChange)="applyFilters()">
        <label nz-radio-button value="all">Tất cả</label>
        <label nz-radio-button value="draft">Nháp</label>
        <label nz-radio-button value="published">Đã phát hành</label>
        <label nz-radio-button value="assigned">Đang giao</label>
      </nz-radio-group>

      <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Môn học" [(ngModel)]="subjectId">
        @for (s of subjects(); track s.id) { <nz-option [nzValue]="s.id" [nzLabel]="s.name" /> }
      </nz-select>
      <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Khối" [(ngModel)]="gradeBand">
        @for (g of grades(); track g.id) { <nz-option [nzValue]="g.name" [nzLabel]="g.name" /> }
      </nz-select>
      <input nz-input placeholder="Tên đề" [(ngModel)]="search" (keyup.enter)="applyFilters()" />
    </div>

    <div class="filter-actions">
      <button nz-button nzType="primary" (click)="applyFilters()"><nz-icon nzType="search" /> Tìm kiếm</button>
      <button nz-button (click)="resetFilters()"><nz-icon nzType="reload" /> Đặt lại</button>
      <span class="spacer"></span>
      <button nz-button nzType="primary" (click)="openPickMaterial()">
        <nz-icon nzType="plus" /> Tạo đề mới
      </button>
    </div>

    <nz-card>
      <nz-spin [nzSpinning]="loading()">
        <nz-table [nzData]="exams()" nzSize="middle" [nzShowPagination]="false" [nzScroll]="{ x: '980px' }">
          <thead>
            <tr>
              <th>Tên đề</th>
              <th>Nguồn</th>
              <th class="num" style="width:70px">Câu</th>
              <th class="num" style="width:96px">Thời gian</th>
              <th style="width:130px">Trạng thái</th>
              <th style="width:96px">Đã giao</th>
              <th style="width:130px">Người tạo</th>
              <th style="width:230px"></th>
            </tr>
          </thead>
          <tbody>
            @for (e of exams(); track e.id) {
              <tr>
                <td>
                  <b>{{ e.title }}</b>
                  <div class="sub">{{ e.subjectName || '—' }}@if (e.gradeBand) { · Khối {{ e.gradeBand }} }</div>
                </td>
                <td class="sub">{{ e.materialTitle || 'Ghép từ ngân hàng câu hỏi' }}</td>
                <td class="num">{{ e.questionCount }}</td>
                <td class="num">{{ e.durationMinutes }} phút</td>
                <td>
                  @if (e.status === 'Published') {
                    <nz-tag nzColor="success">Đã phát hành</nz-tag>
                  } @else {
                    <nz-tag>Nháp</nz-tag>
                  }
                </td>
                <td>
                  @if (e.assignmentCount > 0) {
                    <nz-tag nzColor="blue">{{ e.assignmentCount }} lớp</nz-tag>
                  } @else { <span class="sub">—</span> }
                </td>
                <td class="sub">{{ e.createdByName || '—' }}</td>
                <td class="actions">
                  <button nz-button nzSize="small" (click)="openExam(e)">Duyệt</button>
                  @if (e.status === 'Published') {
                    <button nz-button nzSize="small" nzType="primary" (click)="openAssign(e)">Giao lớp</button>
                  } @else {
                    <button nz-button nzSize="small" disabled
                            nz-tooltip nzTooltipTitle="Phải phát hành đề trước khi giao">Giao lớp</button>
                  }
                  <button nz-button nzSize="small" nzType="text" nz-tooltip nzTooltipTitle="Nhân bản"
                          nz-popconfirm nzPopconfirmTitle="Nhân bản đề này thành bản nháp mới?"
                          (nzOnConfirm)="duplicate(e)"><nz-icon nzType="copy" /></button>
                  <button nz-button nzSize="small" nzType="text" nzDanger nz-tooltip nzTooltipTitle="Xóa"
                          nz-popconfirm nzPopconfirmTitle="Xóa đề này?" (nzOnConfirm)="remove(e)">
                    <nz-icon nzType="delete" />
                  </button>
                </td>
              </tr>
            } @empty {
              @if (!loading()) {
                <tr><td colspan="8"><nz-empty nzNotFoundContent="Không có đề nào khớp bộ lọc." /></td></tr>
              }
            }
          </tbody>
        </nz-table>
      </nz-spin>
    </nz-card>

    @if (total() > 0) {
      <nz-pagination class="pager" [nzPageIndex]="page()" [nzPageSize]="pageSize()" [nzTotal]="total()"
        nzShowSizeChanger [nzPageSizeOptions]="PAGE_SIZES"
        (nzPageIndexChange)="page.set($event); load()"
        (nzPageSizeChange)="pageSize.set($event); page.set(1); load()" />
    }

    <!-- Tạo đề mới: chọn tài liệu nguồn trước rồi mở cửa sổ sinh đề -->
    <div class="pick-overlay" [class.is-open]="pickOpen()">
      <div class="pick-panel">
        <div class="pick-head">
          <b>Chọn tài liệu nguồn</b>
          <button nz-button nzType="text" (click)="pickOpen.set(false)" aria-label="Đóng"><nz-icon nzType="close" /></button>
        </div>
        <nz-select
          class="pick-select" nzShowSearch nzServerSearch nzPlaceHolder="Gõ tên tài liệu để tìm"
          [nzShowArrow]="false" [nzFilterOption]="filterNone"
          [(ngModel)]="pickedMaterialId" (nzOnSearch)="searchMaterials($event)">
          @for (m of pickOptions(); track m.id) {
            <nz-option [nzValue]="m.id" [nzLabel]="m.code + ' — ' + m.title" />
          }
        </nz-select>
        <div class="pick-foot">
          <button nz-button (click)="pickOpen.set(false)">Hủy</button>
          <button nz-button nzType="primary" [disabled]="!pickedMaterialId" (click)="startGenerate()">Tiếp tục</button>
        </div>
      </div>
    </div>

    <app-assign-to-class-modal
      [visible]="assignOpen()" kind="exam"
      [targetId]="assignTarget()?.id ?? null" [targetTitle]="assignTarget()?.title ?? ''"
      (closed)="assignOpen.set(false)" (assigned)="assignOpen.set(false); load()" />

    <app-exam-generate-modal
      [visible]="generateOpen()" [material]="generateTarget()"
      (closed)="generateOpen.set(false)" (generated)="generateOpen.set(false); load()" />
  `,
  styles: `
    .filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; align-items: center; }
    .filters nz-select, .filters input { min-width: 180px; flex: 1; max-width: 260px; }
    .filter-actions { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
    .filter-actions .spacer { flex: 1; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .sub { color: var(--hs-text-muted); font-size: 12.5px; }
    .actions { display: flex; gap: 6px; justify-content: flex-end; }
    .pager { display: flex; justify-content: center; margin-top: 16px; }

    .pick-overlay { position: fixed; inset: 0; background: rgba(15, 16, 28, .45); z-index: 1000;
      display: none; align-items: center; justify-content: center; padding: 16px; }
    .pick-overlay.is-open { display: flex; }
    .pick-panel { background: var(--hs-surface); border-radius: 12px; padding: 18px; width: min(520px, 100%);
      box-shadow: 0 12px 40px rgba(0, 0, 0, .25); }
    .pick-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .pick-select { width: 100%; }
    .pick-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

    @media (max-width: 575px) { .filters nz-select, .filters input { max-width: none; width: 100%; } }
  `
})
export class ExamBankTab {
  private readonly examService = inject(ExamService);
  private readonly materialsService = inject(MaterialsService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);

  readonly subjects = input<Subject[]>([]);
  readonly grades = input<Grade[]>([]);
  /** Lọc sẵn theo tài liệu (mở từ badge "N đề" ở Kho tài liệu). */
  readonly materialId = input<string | null>(null);

  protected readonly PAGE_SIZES = PAGE_SIZE_OPTIONS;
  protected readonly filterNone = () => true;

  protected readonly exams = signal<ExamListItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly total = signal(0);

  protected status: StatusFilter = 'all';
  protected subjectId: string | null = null;
  protected gradeBand: string | null = null;
  protected search = '';

  protected readonly assignOpen = signal(false);
  protected readonly assignTarget = signal<ExamListItem | null>(null);
  protected readonly generateOpen = signal(false);
  protected readonly generateTarget = signal<Material | null>(null);

  // Chọn tài liệu nguồn cho "Tạo đề mới"
  protected readonly pickOpen = signal(false);
  protected readonly pickOptions = signal<Material[]>([]);
  protected pickedMaterialId: string | null = null;

  private readonly assign = viewChild.required(AssignToClassModal);
  private readonly generate = viewChild.required(ExamGenerateModal);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.examService.list({
      subjectId: this.subjectId,
      materialId: this.materialId(),
      gradeBand: this.gradeBand,
      status: this.status === 'draft' ? 'Draft' : this.status === 'published' ? 'Published' : null,
      search: this.search,
      assignedOnly: this.status === 'assigned'
    }, this.page(), this.pageSize()).subscribe({
      next: r => { this.exams.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  protected resetFilters(): void {
    this.status = 'all';
    this.subjectId = null;
    this.gradeBand = null;
    this.search = '';
    this.applyFilters();
  }

  protected openExam(e: ExamListItem): void {
    this.router.navigate(['/exams', e.id]);
  }

  protected openAssign(e: ExamListItem): void {
    this.assignTarget.set(e);
    this.assign().open();
    this.assignOpen.set(true);
  }

  protected duplicate(e: ExamListItem): void {
    this.examService.duplicate(e.id).subscribe({
      next: r => { this.message.success('Đã nhân bản thành đề nháp mới.'); this.router.navigate(['/exams', r.examId]); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message)
    });
  }

  protected remove(e: ExamListItem): void {
    this.examService.delete(e.id).subscribe({
      next: () => { this.message.success('Đã xóa đề.'); this.load(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message)
    });
  }

  // ---- Tạo đề mới: chọn tài liệu nguồn ----

  protected openPickMaterial(): void {
    this.pickedMaterialId = null;
    this.pickOptions.set([]);
    this.pickOpen.set(true);
    this.searchMaterials('');
  }

  protected searchMaterials(term: string): void {
    this.materialsService.getPaged({ search: term, page: 1, pageSize: 30 })
      .subscribe(r => this.pickOptions.set(r.items));
  }

  protected startGenerate(): void {
    const m = this.pickOptions().find(x => x.id === this.pickedMaterialId);
    if (!m) return;
    this.pickOpen.set(false);
    this.generateTarget.set(m);
    this.generate().open();
    this.generateOpen.set(true);
  }
}
