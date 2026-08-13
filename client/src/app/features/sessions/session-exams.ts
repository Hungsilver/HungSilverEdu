import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ExamService } from '../../core/exam.service';
import { ScreenService } from '../../core/screen.service';
import {
  EXAM_ATTEMPT_STATUS_LABELS, ExamAssignment, ExamDeliveryMode, ExamListItem, ExamReport
} from '../../core/models';

/**
 * Section "Bài tập": GV giao đề (trên lớp / về nhà, có thể không giới hạn giờ), theo dõi nộp bài
 * per-student (polling nhẹ khi còn lượt Open) và mở bài làm từng HS. Dùng ở 2 nơi:
 * màn hình buổi học (sessionId có — lượt giao gắn buổi) và trang chi tiết lớp (sessionId null — mọi lượt của lớp).
 */
@Component({
  selector: 'app-session-exams',
  imports: [
    DatePipe, NgTemplateOutlet, FormsModule, RouterLink,
    NzButtonModule, NzCardModule, NzCheckboxModule, NzDatePickerModule, NzEmptyModule, NzIconModule,
    NzInputNumberModule, NzModalModule, NzPopconfirmModule, NzRadioModule, NzSelectModule, NzSpinModule,
    NzTableModule, NzTagModule, NzTooltipModule
  ],
  template: `
    <nz-card class="mt" [nzTitle]="cardTitle()" [nzExtra]="extra">
      <ng-template #extra>
        <div class="card-actions">
          <button nz-button nzSize="small" (click)="reload()" [nzLoading]="loading()" nz-tooltip nzTooltipTitle="Làm mới">
            <nz-icon nzType="reload" />
          </button>
          <span nz-tooltip [nzTooltipTitle]="subjectId() ? '' : 'Lớp chưa gán môn học — vào Lớp học để gán môn trước'">
            <button nz-button nzType="primary" nzSize="small" [disabled]="!subjectId()" (click)="openAssign()">
              <nz-icon nzType="send" /> Giao bài tập
            </button>
          </span>
        </div>
      </ng-template>

      @if (assignments().length === 0) {
        <nz-empty [nzNotFoundContent]="emptyText()" />
      } @else if (screen.isMobile()) {
        <!-- Mobile: card cho từng lượt giao -->
        <div class="asg-cards">
          @for (a of assignments(); track a.id) {
            <div class="asg-card">
              <div class="asg-head">
                <strong>{{ a.examTitle || 'Đề' }}</strong>
                <nz-tag [nzColor]="a.status === 'Open' ? 'processing' : 'default'">{{ a.status === 'Open' ? 'Đang mở' : 'Đã đóng' }}</nz-tag>
              </div>
              <div class="muted">{{ modeLabel(a.mode) }} · {{ durationLabel(a) }}</div>
              <div class="muted">Mở {{ a.openAt | date: 'HH:mm dd/MM' }}@if (a.closeAt) { · Hạn nộp {{ a.closeAt | date: 'HH:mm dd/MM' }}}</div>
              <div class="asg-sub">Đã nộp <strong>{{ a.submittedCount }}/{{ a.totalStudents }}</strong></div>
              <div class="asg-actions">
                <button nz-button nzSize="small" (click)="toggleExpand(a)">
                  <nz-icon [nzType]="expandedId() === a.id ? 'up' : 'down'" /> Kết quả
                </button>
                <a nz-button nzSize="small" [routerLink]="['/exams/assignments', a.id, 'report']"><nz-icon nzType="bar-chart" /> Báo cáo</a>
                @if (a.status === 'Open') {
                  <button nz-button nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Đóng lượt giao này?" (nzOnConfirm)="close(a)">Đóng</button>
                }
              </div>
              @if (expandedId() === a.id) {
                <ng-container *ngTemplateOutlet="studentList; context: { $implicit: a }" />
              }
            </div>
          }
        </div>
      } @else {
        <!-- Desktop: bảng lượt giao + expand kết quả -->
        <nz-table #t [nzData]="assignments()" [nzFrontPagination]="false" nzSize="small" [nzScroll]="{ x: '760px' }">
          <thead>
            <tr>
              <th nzWidth="40px"></th>
              <th>Tên đề</th>
              <th nzWidth="110px">Hình thức</th>
              <th nzWidth="210px">Thời gian</th>
              <th nzWidth="100px">Đã nộp</th>
              <th nzWidth="100px">Trạng thái</th>
              <th nzWidth="190px"></th>
            </tr>
          </thead>
          <tbody>
            @for (a of t.data; track a.id) {
              <tr>
                <td [nzExpand]="expandedId() === a.id" (nzExpandChange)="toggleExpand(a)"></td>
                <td>{{ a.examTitle || 'Đề' }}</td>
                <td>{{ modeLabel(a.mode) }}</td>
                <td>
                  <div>{{ durationLabel(a) }}</div>
                  <div class="muted small">Mở {{ a.openAt | date: 'HH:mm dd/MM' }}@if (a.closeAt) { · Hạn {{ a.closeAt | date: 'HH:mm dd/MM' }}}</div>
                </td>
                <td><strong>{{ a.submittedCount }}/{{ a.totalStudents }}</strong></td>
                <td><nz-tag [nzColor]="a.status === 'Open' ? 'processing' : 'default'">{{ a.status === 'Open' ? 'Đang mở' : 'Đã đóng' }}</nz-tag></td>
                <td>
                  <a nz-button nzType="link" nzSize="small" [routerLink]="['/exams/assignments', a.id, 'report']"><nz-icon nzType="bar-chart" /> Báo cáo</a>
                  @if (a.status === 'Open') {
                    <button nz-button nzType="link" nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Đóng lượt giao này?" (nzOnConfirm)="close(a)">Đóng</button>
                  }
                </td>
              </tr>
              <tr [nzExpand]="expandedId() === a.id">
                <ng-container *ngTemplateOutlet="studentList; context: { $implicit: a }" />
              </tr>
            }
          </tbody>
        </nz-table>
      }

      <!-- Kết quả per-student của một lượt giao (dùng chung desktop expand + mobile card) -->
      <ng-template #studentList let-a>
        @if (reportLoadingId() === a.id) {
          <div class="center"><nz-spin nzSimple nzSize="small" /></div>
        } @else if (reports()[a.id]; as rep) {
          <div class="students">
            @for (s of rep.students; track s.studentId) {
              <div class="student-row">
                <span class="s-name">{{ s.fullName }}</span>
                @if (s.status === 'Submitted' || s.status === 'AutoSubmitted') {
                  <nz-tag nzColor="success">{{ attemptLabels[s.status] }}</nz-tag>
                  <span class="s-score">{{ s.score }}/{{ rep.totalPoints }}đ</span>
                  <span class="muted small">{{ s.submittedAt | date: 'HH:mm dd/MM' }}</span>
                  @if (s.attemptId) {
                    <a nz-button nzType="link" nzSize="small" [routerLink]="['/exams/attempts', s.attemptId, 'review']">
                      <nz-icon nzType="file-search" /> Xem bài làm
                    </a>
                  }
                } @else if (s.status === 'InProgress') {
                  <nz-tag nzColor="processing">Đang làm</nz-tag>
                } @else {
                  <nz-tag>Chưa làm</nz-tag>
                }
              </div>
            } @empty { <p class="muted">Lớp chưa có học viên.</p> }
          </div>
        }
      </ng-template>
    </nz-card>

    <!-- Modal Giao bài tập -->
    <nz-modal [nzVisible]="assignOpen()" nzTitle="Giao bài tập cho lớp" [nzOkLoading]="assigning()"
      nzOkText="Giao bài" (nzOnOk)="doAssign()" (nzOnCancel)="assignOpen.set(false)" [nzWidth]="560">
      <ng-container *nzModalContent>
        <div class="form-block">
          <label class="lbl">Chọn đề (đã phát hành@if (subjectName()) { , môn {{ subjectName() }}})</label>
          <nz-select class="full" nzShowSearch nzPlaceHolder="Tìm theo tên đề..." [nzLoading]="examsLoading()"
            [(ngModel)]="selExamId" (ngModelChange)="onExamChange($event)">
            @for (e of examOptions(); track e.id) {
              <nz-option [nzValue]="e.id" [nzLabel]="e.title + ' (' + e.questionCount + ' câu · ' + e.durationMinutes + 'ʼ)'" />
            }
          </nz-select>
          @if (!examsLoading() && examOptions().length === 0) {
            <p class="muted small">Môn này chưa có đề nào đã phát hành — vào Kho tài liệu → nút "Đề" để tạo và phát hành.</p>
          }
        </div>

        <div class="form-block">
          <label class="lbl">Hình thức</label>
          <nz-radio-group [(ngModel)]="mode" nzButtonStyle="solid">
            <label nz-radio-button nzValue="InClass">Làm trên lớp</label>
            <label nz-radio-button nzValue="Homework">Làm ở nhà</label>
          </nz-radio-group>
        </div>

        @if (mode === 'Homework') {
          <div class="form-block">
            <label nz-checkbox [(ngModel)]="noTimeLimit">Không giới hạn thời gian làm bài</label>
          </div>
        }

        @if (!noTimeLimit || mode === 'InClass') {
          <div class="form-block">
            <label class="lbl">Thời gian làm bài (phút)</label>
            <nz-input-number [(ngModel)]="duration" [nzMin]="1" [nzMax]="600" />
          </div>
        }

        @if (mode === 'Homework') {
          <div class="form-block">
            <label class="lbl">Mở làm bài từ</label>
            <nz-date-picker class="full" nzShowTime nzFormat="HH:mm dd/MM/yyyy" [(ngModel)]="openAt" />
          </div>
          <div class="form-block">
            <label class="lbl">Hạn nộp @if (noTimeLimit) { <nz-tag nzColor="orange">bắt buộc</nz-tag> }</label>
            <nz-date-picker class="full" nzShowTime nzFormat="HH:mm dd/MM/yyyy" [(ngModel)]="closeAt"
              nzPlaceHolder="Chọn hạn nộp" />
          </div>
        } @else {
          <p class="muted small">Đề mở ngay khi giao — học viên vào Cổng học viên bấm "Làm bài", hết giờ hệ thống tự nộp. Bấm "Đóng" khi muốn dừng nhận bài mới.</p>
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .mt { margin-top: 16px; }
    .card-actions { display: flex; gap: 8px; align-items: center; }
    .center { text-align: center; padding: 12px; }
    .muted { color: var(--hs-text-muted); }
    .small { font-size: 12px; }
    .asg-cards { display: flex; flex-direction: column; gap: 12px; }
    .asg-card { border: 1px solid var(--hs-border); border-radius: var(--hs-radius); padding: 12px; display: flex; flex-direction: column; gap: 4px; }
    .asg-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .asg-actions { display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
    .students { display: flex; flex-direction: column; gap: 4px; padding: 4px 0; }
    .student-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 2px 0; }
    .student-row .s-name { min-width: 140px; font-weight: 500; }
    .student-row .s-score { font-weight: 600; }
    .form-block { margin-bottom: 14px; }
    .form-block .lbl { display: block; margin-bottom: 6px; font-weight: 500; }
    .full { width: 100%; }
  `
})
export class SessionExams implements OnInit {
  private readonly examService = inject(ExamService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly screen = inject(ScreenService);

  /** Có giá trị ⇒ chỉ lượt giao gắn buổi này; null ⇒ mọi lượt giao của lớp (trang chi tiết lớp). */
  readonly sessionId = input<string | null>(null);
  readonly classId = input.required<string>();
  readonly subjectId = input<string | null>(null);
  readonly subjectName = input<string | null>(null);
  readonly cardTitle = input('Bài tập');
  readonly emptyText = input('Buổi này chưa giao bài tập nào');

  protected readonly attemptLabels = EXAM_ATTEMPT_STATUS_LABELS;
  protected readonly loading = signal(false);
  protected readonly assignments = signal<ExamAssignment[]>([]);
  protected readonly expandedId = signal<string | null>(null);
  protected readonly reports = signal<Record<string, ExamReport>>({});
  protected readonly reportLoadingId = signal<string | null>(null);

  // Modal giao bài
  protected readonly assignOpen = signal(false);
  protected readonly assigning = signal(false);
  protected readonly examsLoading = signal(false);
  protected readonly examOptions = signal<ExamListItem[]>([]);
  protected selExamId: string | null = null;
  protected mode: ExamDeliveryMode = 'InClass';
  protected duration = 60;
  protected noTimeLimit = false;
  protected openAt: Date = new Date();
  protected closeAt: Date | null = null;

  /** Polling nhẹ để GV thấy bài nộp "ngay" khi HS làm trên lớp — chỉ khi còn lượt Open. */
  private static readonly PollMs = 20_000;

  ngOnInit(): void {
    this.reload();
    const timer = setInterval(() => {
      if (this.assignments().some(a => a.status === 'Open')) this.reload(true);
    }, SessionExams.PollMs);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  protected reload(silent = false): void {
    if (!silent) this.loading.set(true);
    const sessionId = this.sessionId();
    const source$ = sessionId
      ? this.examService.listBySession(sessionId)
      : this.examService.listByClass(this.classId());
    source$.subscribe({
      next: list => {
        this.assignments.set(list);
        this.loading.set(false);
        const expanded = this.expandedId();
        if (expanded) this.loadReport(expanded, true);
      },
      error: () => this.loading.set(false)
    });
  }

  protected toggleExpand(a: ExamAssignment): void {
    if (this.expandedId() === a.id) { this.expandedId.set(null); return; }
    this.expandedId.set(a.id);
    this.loadReport(a.id, false);
  }

  private loadReport(assignmentId: string, silent: boolean): void {
    if (!silent) this.reportLoadingId.set(assignmentId);
    this.examService.report(assignmentId).subscribe({
      next: rep => {
        this.reports.update(m => ({ ...m, [assignmentId]: rep }));
        if (this.reportLoadingId() === assignmentId) this.reportLoadingId.set(null);
      },
      error: () => { if (this.reportLoadingId() === assignmentId) this.reportLoadingId.set(null); }
    });
  }

  protected close(a: ExamAssignment): void {
    this.examService.closeAssignment(a.id).subscribe({
      next: () => { this.message.success('Đã đóng lượt giao.'); this.reload(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message)
    });
  }

  protected modeLabel(mode: ExamDeliveryMode): string {
    return mode === 'InClass' ? 'Trên lớp' : 'Về nhà';
  }

  protected durationLabel(a: ExamAssignment): string {
    return a.durationMinutes !== null ? `${a.durationMinutes} phút` : 'Không giới hạn';
  }

  // ---- Modal giao bài ----

  protected openAssign(): void {
    this.selExamId = null;
    this.mode = 'InClass';
    this.duration = 60;
    this.noTimeLimit = false;
    this.openAt = new Date();
    this.closeAt = null;
    this.assignOpen.set(true);
    this.loadExamOptions();
  }

  private loadExamOptions(): void {
    const subjectId = this.subjectId();
    if (!subjectId) return;
    this.examsLoading.set(true);
    this.examService.list({ subjectId, status: 'Published' }, 1, 100).subscribe({
      next: r => { this.examOptions.set(r.items); this.examsLoading.set(false); },
      error: () => this.examsLoading.set(false)
    });
  }

  protected onExamChange(examId: string | null): void {
    const exam = this.examOptions().find(e => e.id === examId);
    if (exam) this.duration = exam.durationMinutes;
  }

  protected doAssign(): void {
    if (!this.selExamId) { this.message.warning('Chọn đề cần giao.'); return; }
    const unlimited = this.mode === 'Homework' && this.noTimeLimit;
    if (unlimited && !this.closeAt) { this.message.warning('Bài không giới hạn thời gian bắt buộc phải có hạn nộp.'); return; }
    const openAt = this.mode === 'InClass' ? new Date() : (this.openAt ?? new Date());
    const closeAt = this.mode === 'InClass' ? null : this.closeAt;
    if (closeAt && closeAt <= openAt) { this.message.warning('Hạn nộp phải sau thời điểm mở.'); return; }

    this.assigning.set(true);
    this.examService.assign(this.selExamId, {
      classId: this.classId(),
      classSessionId: this.sessionId(),
      mode: this.mode,
      durationMinutes: unlimited ? null : this.duration,
      openAt: openAt.toISOString(),
      closeAt: closeAt ? closeAt.toISOString() : null,
      noTimeLimit: unlimited
    }).subscribe({
      next: () => {
        this.assigning.set(false);
        this.assignOpen.set(false);
        this.message.success('Đã giao bài tập cho lớp.');
        this.reload();
      },
      error: (err: HttpErrorResponse) => {
        this.assigning.set(false);
        this.message.error(err.error?.message ?? err.message ?? 'Giao bài thất bại.');
      }
    });
  }
}
