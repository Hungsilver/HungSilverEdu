import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, model, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { EXAM_ATTEMPT_STATUS_LABELS, ExamAttemptStatus, StudentHomework } from '../core/models';
import { ExamService } from '../core/exam.service';

@Component({
  selector: 'app-student-homework-modal',
  imports: [
    DatePipe, DecimalPipe, RouterLink,
    NzButtonModule, NzEmptyModule, NzIconModule, NzModalModule, NzSpinModule, NzTableModule, NzTagModule
  ],
  template: `
    <nz-modal [nzVisible]="open()" [nzTitle]="title()" [nzWidth]="980" [nzFooter]="null" (nzOnCancel)="open.set(false)">
      <ng-container *nzModalContent>
        @if (loading()) {
          <div class="center"><nz-spin nzSimple /></div>
        } @else if (items().length === 0) {
          <nz-empty nzNotFoundContent="Chưa có bài tập về nhà nào" />
        } @else {
          <div class="summary">
            <div><b>{{ doneCount() }}</b><span>Đã nộp</span></div>
            <div><b>{{ doingCount() }}</b><span>Đang làm</span></div>
            <div><b>{{ missingCount() }}</b><span>Chưa làm</span></div>
          </div>

          <nz-table #t [nzData]="items()" [nzFrontPagination]="false" nzSize="small" [nzScroll]="{ x: '900px' }">
            <thead>
              <tr>
                <th>Bài tập</th>
                <th nzWidth="150px">Lớp/Buổi</th>
                <th nzWidth="170px">Thời gian</th>
                <th nzWidth="125px">Trạng thái</th>
                <th nzWidth="100px">Điểm</th>
                <th nzWidth="145px">Nộp lúc</th>
                <th nzWidth="170px"></th>
              </tr>
            </thead>
            <tbody>
              @for (h of t.data; track h.assignmentId) {
                <tr>
                  <td>
                    <strong>{{ h.examTitle }}</strong>
                    @if (h.assignmentStatus === 'Closed') { <nz-tag>Đã đóng</nz-tag> }
                  </td>
                  <td>
                    <div>{{ h.className }}</div>
                    @if (h.sessionNumber || h.sessionDate) {
                      <div class="muted small">
                        @if (h.sessionNumber) { Buổi {{ h.sessionNumber }} }
                        @if (h.sessionDate) { · {{ h.sessionDate | date:'dd/MM/yyyy' }} }
                      </div>
                    }
                  </td>
                  <td>
                    <div>{{ durationLabel(h) }}</div>
                    <div class="muted small">Mở {{ h.openAt | date:'HH:mm dd/MM' }}</div>
                    @if (h.closeAt) {
                      <div class="muted small">Hạn {{ h.closeAt | date:'HH:mm dd/MM' }}</div>
                    }
                  </td>
                  <td><nz-tag [nzColor]="statusColor(h)">{{ statusLabel(h) }}</nz-tag></td>
                  <td>{{ h.score !== null ? ((h.score | number:'1.0-2') + '/' + h.totalPoints) : '—' }}</td>
                  <td>{{ h.submittedAt ? (h.submittedAt | date:'HH:mm dd/MM') : '—' }}</td>
                  <td>
                    @if (h.attemptId && h.attemptStatus && h.attemptStatus !== 'InProgress') {
                      <a nz-button nzType="link" nzSize="small" [routerLink]="['/exams/attempts', h.attemptId, 'review']">
                        <nz-icon nzType="file-search" /> Xem bài làm
                      </a>
                    }
                    <a nz-button nzType="link" nzSize="small" [routerLink]="['/exams/assignments', h.assignmentId, 'report']">
                      <nz-icon nzType="bar-chart" /> Báo cáo
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .center { text-align: center; padding: 40px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; }
    .summary div { border: 1px solid var(--hs-border); border-radius: 8px; padding: 10px; background: var(--hs-surface); }
    .summary b { display: block; font-size: 20px; line-height: 1.2; }
    .summary span { color: var(--hs-text-muted); font-size: 12px; }
    .muted { color: var(--hs-text-muted); }
    .small { font-size: 12px; }
    @media (max-width: 640px) { .summary { grid-template-columns: 1fr; } }
  `
})
export class StudentHomeworkModal {
  private readonly examService = inject(ExamService);

  readonly open = model(false);
  readonly studentId = input<string | null>(null);
  readonly studentName = input<string | null>(null);
  readonly classId = input<string | null>(null);

  protected readonly loading = signal(false);
  protected readonly items = signal<StudentHomework[]>([]);

  protected readonly title = () => {
    const name = this.studentName();
    return name ? `Bài tập về nhà: ${name}` : 'Bài tập về nhà';
  };

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const studentId = this.studentId();
      const classId = this.classId();
      if (!isOpen || !studentId) return;
      this.load(studentId, classId);
    });
  }

  protected doneCount(): number {
    return this.items().filter(x => x.attemptStatus === 'Submitted' || x.attemptStatus === 'AutoSubmitted').length;
  }

  protected doingCount(): number {
    return this.items().filter(x => x.attemptStatus === 'InProgress').length;
  }

  protected missingCount(): number {
    return this.items().filter(x => !x.attemptStatus).length;
  }

  protected durationLabel(h: StudentHomework): string {
    return h.durationMinutes !== null ? `${h.durationMinutes} phút` : 'Không giới hạn';
  }

  protected statusLabel(h: StudentHomework): string {
    if (h.attemptStatus) return EXAM_ATTEMPT_STATUS_LABELS[h.attemptStatus];
    if (h.closeAt && new Date(h.closeAt).getTime() < Date.now()) return 'Quá hạn';
    return 'Chưa làm';
  }

  protected statusColor(h: StudentHomework): string {
    if (h.attemptStatus === 'Submitted' || h.attemptStatus === 'AutoSubmitted') return 'success';
    if (h.attemptStatus === 'InProgress') return 'processing';
    if (h.closeAt && new Date(h.closeAt).getTime() < Date.now()) return 'error';
    return 'default';
  }

  private load(studentId: string, classId: string | null): void {
    this.loading.set(true);
    this.examService.studentHomework(studentId, classId).subscribe({
      next: items => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.loading.set(false);
      }
    });
  }
}
