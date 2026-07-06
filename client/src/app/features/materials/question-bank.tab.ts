import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ExamService } from '../../core/exam.service';
import { MaterialsService } from '../../core/materials.service';
import {
  EXAM_STATUS_LABELS, EXAM_TYPE_LABELS, ExamListItem, ExamQuestion, ExamQuestionBankItem, ExamQuestionType,
  ExamStatus, Grade, Material, Subject
} from '../../core/models';
import { ScreenService } from '../../core/screen.service';
import { PAGE_SIZE_OPTIONS, TABLE_SCROLL_Y } from '../../shared/table';
import { TableDragScroll } from '../../shared/table-drag-scroll.directive';
import {
  EditQuestion, QView, QuestionEditorForm, buildQuestionView, emptyEditQuestion, toEditQuestion, toUpsertRequest
} from '../exams/question-editor';

/**
 * Tab "Quản lí câu hỏi" — Ngân hàng câu hỏi: mọi câu từ mọi đề (AI trích/sinh + soạn tay),
 * lọc/tìm kiếm, CRUD từng câu, chọn nhiều (giữ qua trang) → tạo đề mới. Đề mới là bản COPY
 * (Draft, nguồn "Thủ công") → duyệt/phát hành/giao lớp theo luồng sẵn có.
 */
@Component({
  selector: 'app-question-bank-tab',
  imports: [
    FormsModule, RouterLink,
    NzButtonModule, NzCardModule, NzCheckboxModule, NzFormModule, NzIconModule, NzInputModule, NzInputNumberModule,
    NzModalModule, NzPaginationModule, NzPopconfirmModule, NzSelectModule, NzTableModule, NzTagModule, NzTooltipModule,
    TableDragScroll, QuestionEditorForm
  ],
  template: `
    <div class="filters">
      <input nz-input placeholder="Nội dung câu hỏi, tên đề, mã/tên tài liệu" [(ngModel)]="search" (keyup.enter)="applyFilters()" />
      <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Môn học" [(ngModel)]="subjectId" (ngModelChange)="onScopeChange()">
        @for (s of subjects(); track s.id) { <nz-option [nzValue]="s.id" [nzLabel]="s.name" /> }
      </nz-select>
      <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Khối" [(ngModel)]="gradeBand">
        @for (g of grades(); track g.id) { <nz-option [nzValue]="g.name" [nzLabel]="g.name" /> }
      </nz-select>
      <nz-select nzAllowClear nzShowSearch nzServerSearch nzPlaceHolder="Tài liệu"
        [(ngModel)]="materialId" (nzOnSearch)="searchMaterials($event)" (ngModelChange)="onScopeChange()">
        @for (m of materialOptions(); track m.id) { <nz-option [nzValue]="m.id" [nzLabel]="m.code + ' — ' + m.title" /> }
      </nz-select>
      <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Đề nguồn" [(ngModel)]="examId"
        [nzDisabled]="!subjectId && !materialId" nz-tooltip
        [nzTooltipTitle]="!subjectId && !materialId ? 'Chọn Môn hoặc Tài liệu trước để lọc theo đề' : null">
        @for (e of examOptions(); track e.id) { <nz-option [nzValue]="e.id" [nzLabel]="e.title" /> }
      </nz-select>
      <nz-select nzAllowClear nzPlaceHolder="Loại câu" [(ngModel)]="type">
        @for (t of typeKeys; track t) { <nz-option [nzValue]="t" [nzLabel]="typeLabels[t]" /> }
      </nz-select>
      <nz-select nzAllowClear nzPlaceHolder="Trạng thái đề" [(ngModel)]="examStatus">
        <nz-option nzValue="Draft" [nzLabel]="statusLabels.Draft" />
        <nz-option nzValue="Published" [nzLabel]="statusLabels.Published" />
      </nz-select>
    </div>
    <div class="filter-actions">
      <button nz-button nzType="primary" (click)="applyFilters()"><nz-icon nzType="search" /> Tìm kiếm</button>
      <button nz-button (click)="resetFilters()"><nz-icon nzType="reload" /> Đặt lại</button>
      <span class="spacer"></span>
      @if (total() > 0) {
        <button nz-button (click)="selectAllMatching()" [nzLoading]="selectingAll()">
          <nz-icon nzType="check-square" /> Chọn tất cả {{ total() }} câu
        </button>
      }
      <button nz-button (click)="openAdd()"><nz-icon nzType="plus" /> Thêm câu hỏi</button>
    </div>

    @if (screen.isMobile()) {
      <div class="mobile-card-list">
        @for (q of items(); track q.questionId) {
          <nz-card>
            <div class="card-header">
              <label nz-checkbox [ngModel]="selected().has(q.questionId)" (ngModelChange)="toggle(q, $event)"></label>
              <span class="card-title" (click)="openView(q)">{{ q.stem }}</span>
            </div>
            <div class="card-field"><span class="label">Loại</span><nz-tag [nzColor]="typeColors[q.type]">{{ typeLabels[q.type] }}</nz-tag></div>
            <div class="card-field"><span class="label">Đề nguồn</span>
              <a [routerLink]="['/exams', q.examId]">{{ q.examTitle }}</a>
              <nz-tag [nzColor]="q.examStatus === 'Published' ? 'success' : 'default'">{{ statusLabels[q.examStatus] }}</nz-tag>
            </div>
            <div class="card-field"><span class="label">Tài liệu</span><span>{{ q.materialCode ? q.materialCode + ' — ' + (q.materialTitle || '') : '—' }}</span></div>
            <div class="card-field"><span class="label">Môn / Khối</span><span>{{ q.subjectName || '—' }} / {{ q.gradeBand || '—' }}</span></div>
            <div class="card-actions">
              <button nz-button nzSize="small" (click)="openView(q)"><nz-icon nzType="eye" /> Xem</button>
              <button nz-button nzSize="small" (click)="openEdit(q)"><nz-icon nzType="edit" /> Sửa</button>
              <button nz-button nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Xóa câu hỏi này khỏi đề nguồn?" (nzOnConfirm)="remove(q)"><nz-icon nzType="delete" /> Xóa</button>
            </div>
          </nz-card>
        } @empty { <p class="muted">Chưa có câu hỏi nào khớp bộ lọc.</p> }
      </div>
      @if (total() > pageSize()) {
        <nz-pagination class="pager" [nzPageIndex]="page()" [nzPageSize]="pageSize()" [nzTotal]="total()"
          (nzPageIndexChange)="page.set($event); load()" />
      }
    } @else {
      <nz-table #table appTableDragScroll [nzData]="items()" [nzLoading]="loading()" [nzFrontPagination]="false"
        [nzPageIndex]="page()" [nzPageSize]="pageSize()" [nzTotal]="total()"
        nzShowSizeChanger [nzPageSizeOptions]="PAGE_SIZE_OPTIONS"
        (nzPageIndexChange)="page.set($event); load()"
        (nzPageSizeChange)="pageSize.set($event); page.set(1); load()"
        [nzScroll]="{ x: '1200px', y: scrollY }">
        <thead><tr>
          <th nzWidth="44px" [nzChecked]="allPageChecked()" [nzIndeterminate]="somePageChecked()" (nzCheckedChange)="togglePage($event)"></th>
          <th nzWidth="56px" style="white-space: nowrap">STT</th>
          <th nzWidth="110px">Loại</th>
          <th>Câu hỏi</th>
          <th nzWidth="220px">Đề nguồn</th>
          <th nzWidth="200px">Tài liệu</th>
          <th nzWidth="110px">Môn</th>
          <th nzWidth="90px">Khối</th>
          <th nzWidth="70px">Điểm</th>
          <th nzRight nzWidth="132px">Thao tác</th>
        </tr></thead>
        <tbody>
          @for (q of table.data; track q.questionId; let i = $index) {
            <tr>
              <td [nzChecked]="selected().has(q.questionId)" (nzCheckedChange)="toggle(q, $event)"></td>
              <td>{{ (page() - 1) * pageSize() + i + 1 }}</td>
              <td><nz-tag [nzColor]="typeColors[q.type]">{{ typeLabels[q.type] }}</nz-tag></td>
              <td class="stem" (click)="openView(q)" nz-tooltip nzTooltipTitle="Bấm để xem chi tiết">{{ q.stem }}</td>
              <td>
                <a [routerLink]="['/exams', q.examId]">{{ q.examTitle }}</a>
                <nz-tag class="ml4" [nzColor]="q.examStatus === 'Published' ? 'success' : 'default'">{{ statusLabels[q.examStatus] }}</nz-tag>
              </td>
              <td>{{ q.materialCode ? q.materialCode + ' — ' + (q.materialTitle || '') : '—' }}</td>
              <td>{{ q.subjectName || '—' }}</td>
              <td>{{ q.gradeBand || '—' }}</td>
              <td>{{ q.points }}</td>
              <td nzRight>
                <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Xem chi tiết" aria-label="Xem chi tiết" (click)="openView(q)"><nz-icon nzType="eye" /></button>
                <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Sửa câu hỏi" aria-label="Sửa câu hỏi" (click)="openEdit(q)"><nz-icon nzType="edit" /></button>
                <button nz-button nzType="link" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa câu hỏi" aria-label="Xóa câu hỏi"
                  nz-popconfirm nzPopconfirmTitle="Xóa câu hỏi này khỏi đề nguồn?" (nzOnConfirm)="remove(q)"><nz-icon nzType="delete" /></button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    }

    <!-- Thanh chọn nổi: hiện khi có câu được chọn -->
    @if (selected().size > 0) {
      <div class="sel-bar">
        <span><strong>{{ selected().size }}</strong> câu đã chọn</span>
        <button nz-button nzType="primary" (click)="openCreateExam()"><nz-icon nzType="file-add" /> Tạo đề từ câu đã chọn</button>
        <button nz-button (click)="clearSelection()">Bỏ chọn</button>
      </div>
    }

    <!-- Modal tạo đề từ câu đã chọn -->
    <nz-modal [nzVisible]="createOpen()" nzTitle="Tạo đề từ câu đã chọn" [nzOkLoading]="saving()"
      nzOkText="Tạo đề" (nzOnOk)="createExam()" (nzOnCancel)="createOpen.set(false)">
      <ng-container *nzModalContent>
        <p class="muted">Sẽ tạo đề <strong>Nháp</strong> gồm <strong>{{ selected().size }}</strong> câu (bản sao — đề nguồn không đổi),
          câu xếp theo thứ tự bạn chọn, điểm chia đều /10. Tạo xong sẽ mở trang duyệt đề để phát hành &amp; giao lớp.</p>
        <form nz-form nzLayout="vertical">
          <nz-form-item><nz-form-label nzRequired>Tên đề</nz-form-label>
            <nz-form-control><input nz-input [(ngModel)]="cTitle" name="ct" placeholder="VD: Đề ôn tập giữa kỳ" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Môn học</nz-form-label>
            <nz-form-control><nz-select class="full" nzAllowClear nzShowSearch [(ngModel)]="cSubjectId" name="cs" nzPlaceHolder="Tự suy từ đề nguồn nếu bỏ trống">
              @for (s of subjects(); track s.id) { <nz-option [nzValue]="s.id" [nzLabel]="s.name" /> }
            </nz-select></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Khối</nz-form-label>
            <nz-form-control><nz-select class="full" nzAllowClear nzShowSearch [(ngModel)]="cGradeBand" name="cg" nzPlaceHolder="Tùy chọn">
              @for (g of grades(); track g.id) { <nz-option [nzValue]="g.name" [nzLabel]="g.name" /> }
            </nz-select></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Thời gian làm bài (phút)</nz-form-label>
            <nz-form-control><nz-input-number [(ngModel)]="cDuration" name="cd" [nzMin]="1" [nzMax]="300" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Mô tả</nz-form-label>
            <nz-form-control><textarea nz-input [(ngModel)]="cDescription" name="cde" rows="2"></textarea></nz-form-control></nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <!-- Modal xem chi tiết câu hỏi -->
    @if (view(); as v) {
      <nz-modal [nzVisible]="true" nzTitle="Chi tiết câu hỏi" [nzFooter]="null" (nzOnCancel)="view.set(null)">
        <ng-container *nzModalContent>
          <div class="v-head">
            <nz-tag [nzColor]="typeColors[v.q.type]">{{ typeLabels[v.q.type] }}</nz-tag>
            <span class="v-stem">{{ v.q.stem }}</span>
          </div>
          @if (v.options.length) {
            <ul class="opts">
              @for (o of v.options; track o.key) {
                <li [class.correct]="o.correct"><strong>{{ o.key }}.</strong> {{ o.text }}
                  @if (o.correct) { <nz-icon nzType="check" class="ok" /> }
                </li>
              }
            </ul>
          }
          <div class="answer"><strong>Đáp án:</strong> {{ v.answerSummary }}</div>
          @if (v.q.explanation) { <div class="expl"><strong>Giải thích:</strong> {{ v.q.explanation }}</div> }
          @if (viewItem(); as it) {
            <div class="expl"><strong>Đề nguồn:</strong> <a [routerLink]="['/exams', it.examId]">{{ it.examTitle }}</a>
              @if (it.materialCode) { · <strong>Tài liệu:</strong> {{ it.materialCode }} — {{ it.materialTitle }} }
            </div>
          }
        </ng-container>
      </nz-modal>
    }

    <!-- Modal sửa câu hỏi -->
    @if (edit(); as e) {
      <nz-modal [nzVisible]="true" nzTitle="Sửa câu hỏi" nzWidth="640px"
        [nzOkLoading]="saving()" (nzOnOk)="saveEdit()" (nzOnCancel)="edit.set(null)">
        <ng-container *nzModalContent>
          <app-question-editor [question]="e" />
        </ng-container>
      </nz-modal>
    }

    <!-- Modal thêm câu hỏi vào 1 đề Nháp -->
    @if (addEdit(); as e) {
      <nz-modal [nzVisible]="true" nzTitle="Thêm câu hỏi vào đề" nzWidth="640px"
        [nzOkLoading]="saving()" [nzOkDisabled]="!addExamId" (nzOnOk)="saveAdd()" (nzOnCancel)="addEdit.set(null)">
        <ng-container *nzModalContent>
          <form nz-form nzLayout="vertical">
            <nz-form-item><nz-form-label>Môn học (để lọc đề)</nz-form-label>
              <nz-form-control><nz-select class="full" nzShowSearch [(ngModel)]="addSubjectId" name="as" nzPlaceHolder="Chọn môn" (ngModelChange)="loadAddExams()">
                @for (s of subjects(); track s.id) { <nz-option [nzValue]="s.id" [nzLabel]="s.name" /> }
              </nz-select></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label nzRequired>Đề đích (chỉ đề Nháp sửa được)</nz-form-label>
              <nz-form-control><nz-select class="full" nzShowSearch [(ngModel)]="addExamId" name="ae" nzPlaceHolder="Chọn đề Nháp"
                  [nzDisabled]="!addSubjectId">
                @for (x of addExamOptions(); track x.id) { <nz-option [nzValue]="x.id" [nzLabel]="x.title" /> }
              </nz-select></nz-form-control></nz-form-item>
          </form>
          <app-question-editor [question]="e" />
        </ng-container>
      </nz-modal>
    }
  `,
  styles: `
    .filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .filters input, .filters nz-select { min-width: 180px; flex: 1; max-width: 300px; }
    .filter-actions { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
    .filter-actions .spacer { flex: 1; }
    .full { width: 100%; }
    .muted { color: var(--hs-text-muted); }
    .ml4 { margin-left: 4px; }
    .stem { cursor: pointer; max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pager { display: flex; justify-content: center; margin-top: 12px; }
    .mobile-card-list { display: flex; flex-direction: column; gap: 12px; }
    .card-header { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
    .card-title { font-weight: 600; flex: 1; cursor: pointer; }
    .card-field { display: flex; gap: 8px; margin-bottom: 4px; align-items: center; flex-wrap: wrap; }
    .card-field .label { color: var(--hs-text-muted); min-width: 84px; }
    .card-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
    .sel-bar { position: sticky; bottom: 8px; z-index: 10; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
      background: var(--hs-surface, #fff); border: 1px solid var(--hs-border); border-radius: var(--hs-radius);
      box-shadow: 0 4px 16px rgba(0,0,0,0.12); padding: 10px 16px; margin-top: 12px; }
    .v-head { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
    .v-stem { font-weight: 500; white-space: pre-wrap; }
    .opts { list-style: none; margin: 8px 0 0; padding: 0; }
    .opts li { padding: 4px 8px; border-radius: var(--hs-radius-sm); }
    .opts li.correct { background: rgba(22,163,74,0.12); color: #16A34A; }
    .opts .ok { margin-left: 6px; }
    .answer { margin-top: 8px; }
    .expl { margin-top: 4px; color: var(--hs-text-muted); }
    @media (max-width: 575px) { .filters input, .filters nz-select { max-width: none; width: 100%; } }
  `
})
export class QuestionBankTab {
  protected readonly screen = inject(ScreenService);
  private readonly examService = inject(ExamService);
  private readonly materialsService = inject(MaterialsService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);

  /** Danh mục nhận từ trang cha (đã nạp qua loadLookups — không gọi API trùng). */
  readonly subjects = input<Subject[]>([]);
  readonly grades = input<Grade[]>([]);

  protected readonly typeLabels = EXAM_TYPE_LABELS;
  protected readonly statusLabels = EXAM_STATUS_LABELS;
  protected readonly typeKeys = Object.keys(EXAM_TYPE_LABELS) as ExamQuestionType[];
  protected readonly typeColors: Record<ExamQuestionType, string> = {
    SingleChoice: 'blue', TrueFalse: 'green', FillBlank: 'orange', Matching: 'purple'
  };
  protected readonly PAGE_SIZE_OPTIONS = PAGE_SIZE_OPTIONS;
  protected readonly scrollY = TABLE_SCROLL_Y;

  // Bộ lọc — chỉ áp khi bấm "Tìm kiếm" (pattern chuẩn students/materials)
  protected search = '';
  protected subjectId: string | null = null;
  protected gradeBand: string | null = null;
  protected materialId: string | null = null;
  protected examId: string | null = null;
  protected type: ExamQuestionType | null = null;
  protected examStatus: ExamStatus | null = null;

  protected readonly materialOptions = signal<Material[]>([]);
  protected readonly examOptions = signal<ExamListItem[]>([]);

  protected readonly items = signal<ExamQuestionBankItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly total = signal(0);

  /** Chọn nhiều — GIỮ QUA TRANG; insertion-order của Set = thứ tự câu trong đề mới. */
  protected readonly selected = signal<Set<string>>(new Set());
  protected readonly selectingAll = signal(false);
  protected readonly allPageChecked = computed(() =>
    this.items().length > 0 && this.items().every(q => this.selected().has(q.questionId)));
  protected readonly somePageChecked = computed(() =>
    !this.allPageChecked() && this.items().some(q => this.selected().has(q.questionId)));

  protected readonly saving = signal(false);

  // Modal tạo đề từ câu đã chọn
  protected readonly createOpen = signal(false);
  protected cTitle = '';
  protected cSubjectId: string | null = null;
  protected cGradeBand: string | null = null;
  protected cDuration = 60;
  protected cDescription = '';

  // Modal xem / sửa / thêm câu
  protected readonly view = signal<QView | null>(null);
  protected readonly viewItem = signal<ExamQuestionBankItem | null>(null);
  protected readonly edit = signal<EditQuestion | null>(null);
  private editItem: ExamQuestionBankItem | null = null;
  protected readonly addEdit = signal<EditQuestion | null>(null);
  protected addSubjectId: string | null = null;
  protected addExamId: string | null = null;
  protected readonly addExamOptions = signal<ExamListItem[]>([]);

  constructor() {
    this.searchMaterials('');
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.examService.listQuestions({
      search: this.search || undefined,
      subjectId: this.subjectId ?? undefined,
      gradeBand: this.gradeBand ?? undefined,
      materialId: this.materialId ?? undefined,
      examId: this.examId ?? undefined,
      type: this.type ?? undefined,
      examStatus: this.examStatus ?? undefined,
      page: this.page(), pageSize: this.pageSize()
    }).subscribe({
      next: r => { this.items.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected applyFilters(): void {
    this.page.set(1);
    // Đổi ngữ cảnh lọc ⇒ bỏ chọn để tránh trộn câu của bộ lọc cũ vào đề mới ngoài ý muốn.
    this.clearSelection();
    this.load();
  }

  protected resetFilters(): void {
    this.search = '';
    this.subjectId = null;
    this.gradeBand = null;
    this.materialId = null;
    this.examId = null;
    this.type = null;
    this.examStatus = null;
    this.examOptions.set([]);
    this.applyFilters();
  }

  /** Đổi Môn/Tài liệu ⇒ nạp lại danh sách đề cho bộ lọc "Đề nguồn". */
  protected onScopeChange(): void {
    this.examId = null;
    if (this.materialId) {
      this.examService.listByMaterial(this.materialId, 1, 50).subscribe(r => this.examOptions.set(r.items));
    } else if (this.subjectId) {
      this.examService.listBySubject(this.subjectId, null, 1, 50).subscribe(r => this.examOptions.set(r.items));
    } else {
      this.examOptions.set([]);
    }
  }

  protected searchMaterials(term: string): void {
    this.materialsService.getPaged({ search: term || null, page: 1, pageSize: 20 })
      .subscribe(r => this.materialOptions.set(r.items));
  }

  // ---- Chọn nhiều ----

  protected toggle(q: ExamQuestionBankItem, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) next.add(q.questionId); else next.delete(q.questionId);
    this.selected.set(next);
  }

  protected togglePage(checked: boolean): void {
    const next = new Set(this.selected());
    for (const q of this.items()) {
      if (checked) next.add(q.questionId); else next.delete(q.questionId);
    }
    this.selected.set(next);
  }

  /** Chọn toàn bộ kết quả khớp bộ lọc (không chỉ trang hiện tại) — server cap 1000. */
  protected selectAllMatching(): void {
    this.selectingAll.set(true);
    this.examService.listQuestionIds({
      search: this.search || undefined,
      subjectId: this.subjectId ?? undefined,
      gradeBand: this.gradeBand ?? undefined,
      materialId: this.materialId ?? undefined,
      examId: this.examId ?? undefined,
      type: this.type ?? undefined,
      examStatus: this.examStatus ?? undefined,
      page: 1, pageSize: 1
    }).subscribe({
      next: r => {
        const next = new Set(this.selected());
        for (const id of r.ids) next.add(id);
        this.selected.set(next);
        this.selectingAll.set(false);
        if (r.truncated) this.message.warning(`Chỉ chọn được ${r.ids.length} câu đầu (giới hạn hệ thống).`);
      },
      error: (err: HttpErrorResponse) => { this.selectingAll.set(false); this.message.error(err.error?.message ?? err.message); }
    });
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  // ---- Tạo đề từ câu đã chọn ----

  protected openCreateExam(): void {
    this.cTitle = '';
    this.cSubjectId = this.subjectId;
    this.cGradeBand = this.gradeBand;
    this.cDuration = 60;
    this.cDescription = '';
    this.createOpen.set(true);
  }

  protected createExam(): void {
    if (!this.cTitle.trim()) { this.message.warning('Nhập tên đề.'); return; }
    this.saving.set(true);
    this.examService.createFromQuestions({
      title: this.cTitle.trim(),
      description: this.cDescription.trim() || null,
      subjectId: this.cSubjectId,
      gradeBand: this.cGradeBand,
      durationMinutes: this.cDuration,
      questionIds: [...this.selected()]
    }).subscribe({
      next: r => {
        this.saving.set(false);
        this.createOpen.set(false);
        this.clearSelection();
        this.message.success(`Đã tạo đề nháp ${r.questionCount} câu — duyệt rồi phát hành & giao lớp.`);
        this.router.navigate(['/exams', r.examId]);
      },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message ?? 'Tạo đề thất bại.'); }
    });
  }

  // ---- Xem / Sửa / Xóa / Thêm ----

  private toExamQuestion(q: ExamQuestionBankItem): ExamQuestion {
    return {
      id: q.questionId, groupId: q.groupId, orderNo: q.orderNo, sourceNumber: null, type: q.type,
      stem: q.stem, optionsJson: q.optionsJson, answerJson: q.answerJson, explanation: q.explanation, points: q.points
    };
  }

  protected openView(q: ExamQuestionBankItem): void {
    this.viewItem.set(q);
    this.view.set(buildQuestionView(this.toExamQuestion(q)));
  }

  protected openEdit(q: ExamQuestionBankItem): void {
    const doOpen = () => {
      this.editItem = q;
      this.edit.set(toEditQuestion(this.toExamQuestion(q)));
    };
    if (q.examStatus === 'Published') {
      this.modal.confirm({
        nzTitle: 'Đề nguồn đã phát hành',
        nzContent: 'Sửa câu sẽ thay đổi trực tiếp đề gốc. Nếu đề đã giao cho lớp, hệ thống sẽ chặn — hãy dùng "Nhân bản đề". Tiếp tục sửa?',
        nzOkText: 'Tiếp tục',
        nzOnOk: doOpen
      });
    } else {
      doOpen();
    }
  }

  protected saveEdit(): void {
    const e = this.edit();
    const item = this.editItem;
    if (!e || !item) return;
    if (!e.stem.trim()) { this.message.warning('Nhập nội dung câu hỏi.'); return; }
    this.saving.set(true);
    this.examService.updateQuestion(item.examId, item.questionId, toUpsertRequest(e)).subscribe({
      next: () => { this.saving.set(false); this.edit.set(null); this.editItem = null; this.message.success('Đã lưu câu hỏi.'); this.load(); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message ?? 'Lưu thất bại.'); }
    });
  }

  protected remove(q: ExamQuestionBankItem): void {
    this.examService.deleteQuestion(q.examId, q.questionId).subscribe({
      next: () => {
        this.message.success('Đã xóa câu hỏi.');
        const next = new Set(this.selected());
        next.delete(q.questionId);
        this.selected.set(next);
        this.load();
      },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ?? 'Xóa thất bại.')
    });
  }

  protected openAdd(): void {
    this.addSubjectId = this.subjectId;
    this.addExamId = null;
    this.addExamOptions.set([]);
    if (this.addSubjectId) this.loadAddExams();
    this.addEdit.set(emptyEditQuestion());
  }

  /** Nạp danh sách đề NHÁP theo môn cho modal "Thêm câu hỏi" (đề đã giao bị BE chặn sửa). */
  protected loadAddExams(): void {
    this.addExamId = null;
    if (!this.addSubjectId) { this.addExamOptions.set([]); return; }
    this.examService.listBySubject(this.addSubjectId, 'Draft', 1, 50).subscribe(r => this.addExamOptions.set(r.items));
  }

  protected saveAdd(): void {
    const e = this.addEdit();
    if (!e || !this.addExamId) return;
    if (!e.stem.trim()) { this.message.warning('Nhập nội dung câu hỏi.'); return; }
    this.saving.set(true);
    this.examService.addQuestion(this.addExamId, toUpsertRequest(e)).subscribe({
      next: () => { this.saving.set(false); this.addEdit.set(null); this.message.success('Đã thêm câu vào đề.'); this.load(); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message ?? 'Thêm thất bại.'); }
    });
  }
}
