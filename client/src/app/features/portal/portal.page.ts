import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CalendarSession, PortalAssignment, PortalExam, PortalProfile, SUBMISSION_STATUS_COLORS, SUBMISSION_STATUS_LABELS, WEEKDAY_LABELS
} from '../../core/models';
import { PortalService } from '../../core/portal.service';
import { toDateOnly } from '../../core/date-util';
import { PageHeader } from '../../shared/page-header';

/** Một ngày trong "Lịch của tôi" của học sinh (đã gom buổi theo ngày, kèm nhãn Ca). */
interface MyDay { iso: string; label: string; sessions: CalendarSession[]; }

@Component({
  selector: 'app-portal-page',
  imports: [
    DatePipe, FormsModule,
    NzCardModule, NzGridModule, NzStatisticModule, NzTagModule, NzAlertModule, NzEmptyModule,
    NzButtonModule, NzModalModule, NzInputModule, NzFormModule, NzIconModule, NzRadioModule, NzDatePickerModule, RouterLink, PageHeader
  ],
  template: `
    <app-page-header title="Trang của tôi" subtitle="Tiến độ & lịch học của bạn" icon="solution" />

    @if (notLinked()) {
      <nz-alert nzType="warning" nzMessage="Tài khoản của bạn chưa được liên kết với hồ sơ học sinh. Vui lòng liên hệ trung tâm." />
    } @else if (profile(); as p) {
      <nz-card [nzTitle]="p.fullName">
        <p>Trình độ: <strong>{{ p.englishLevel || '—' }}</strong></p>
        <p>Mục tiêu: <strong>{{ p.learningGoal || '—' }}</strong></p>
      </nz-card>

      <nz-row [nzGutter]="[16, 16]" class="mt">
        <nz-col [nzXs]="12" [nzMd]="6"><nz-card><nz-statistic [nzValue]="p.attendedSessions" [nzSuffix]="'/' + p.totalSessions" nzTitle="Buổi đi học" /></nz-card></nz-col>
        <nz-col [nzXs]="12" [nzMd]="6"><nz-card><nz-statistic [nzValue]="p.homeworkCompleted" nzTitle="BTVN hoàn thành" /></nz-card></nz-col>
        <nz-col [nzXs]="12" [nzMd]="6"><nz-card><nz-statistic [nzValue]="p.rewardBalance" nzTitle="Điểm thưởng" /></nz-card></nz-col>
        <nz-col [nzXs]="12" [nzMd]="6"><nz-card><nz-statistic [nzValue]="p.totalSessions" nzTitle="Tổng buổi" /></nz-card></nz-col>
      </nz-row>

      <nz-card nzTitle="Bài tập của tôi" class="mt">
        @for (a of assignments(); track a.id) {
          <div class="asg">
            <div class="asg-main">
              <strong>{{ a.title }}</strong>
              <span class="muted">{{ a.className }}@if (a.dueDate) { · Hạn: {{ a.dueDate | date: 'dd/MM/yyyy' }} }</span>
              @if (a.materialUrl) { <a [href]="a.materialUrl" target="_blank" class="muted">· Tài liệu</a> }
            </div>
            <nz-tag [nzColor]="statusColors[a.status]">{{ statusLabels[a.status] }}</nz-tag>
            <button nz-button nzSize="small" (click)="openSubmit(a)"><nz-icon nzType="check" /> Nộp</button>
          </div>
        } @empty { <nz-empty nzNotFoundContent="Chưa có bài tập" /> }
      </nz-card>

      <nz-card nzTitle="Đề của tôi" class="mt">
        @for (e of exams(); track e.assignmentId) {
          <div class="asg">
            <div class="asg-main">
              <strong>{{ e.examTitle }}</strong>
              <span class="muted">{{ e.className }} · {{ e.mode === 'InClass' ? 'Trên lớp' : 'Về nhà' }} · {{ e.durationMinutes }}'
                @if (e.closeAt) { · Hạn: {{ e.closeAt | date: 'dd/MM HH:mm' }} }
              </span>
            </div>
            @if (e.attemptStatus === 'Submitted' || e.attemptStatus === 'AutoSubmitted') {
              <nz-tag nzColor="success">{{ e.score }}/{{ e.totalPoints }}đ</nz-tag>
              <a nz-button nzSize="small" [routerLink]="['/portal/attempts', e.attemptId, 'review']"><nz-icon nzType="file-search" /> Xem lại</a>
            } @else if (e.isOpen) {
              <nz-tag nzColor="processing">{{ e.attemptStatus === 'InProgress' ? 'Đang làm' : 'Chưa làm' }}</nz-tag>
              <a nz-button nzType="primary" nzSize="small" [routerLink]="['/portal/exams', e.assignmentId]"><nz-icon nzType="form" /> Làm bài</a>
            } @else {
              <span class="muted">Mở lúc {{ e.openAt | date: 'dd/MM HH:mm' }}</span>
            }
          </div>
        } @empty { <nz-empty nzNotFoundContent="Chưa có đề nào" /> }
      </nz-card>

      <nz-card nzTitle="Lịch của tôi" class="mt">
        <div class="sched-toolbar">
          <nz-radio-group [ngModel]="myMode()" (ngModelChange)="onMyMode($event)" nzButtonStyle="solid" nzSize="small">
            <label nz-radio-button nzValue="day">Ngày</label>
            <label nz-radio-button nzValue="week">Tuần</label>
          </nz-radio-group>
          <button nz-button nzSize="small" (click)="shiftMy(-1)" aria-label="Lùi"><nz-icon nzType="left" /></button>
          <button nz-button nzSize="small" (click)="myToday()">Hôm nay</button>
          <button nz-button nzSize="small" (click)="shiftMy(1)" aria-label="Tiến"><nz-icon nzType="right" /></button>
          <span class="muted">{{ myRangeLabel() }}</span>
        </div>

        @for (g of myGroups(); track g.iso) {
          <div class="sched-day">
            <div class="sched-day-head">{{ g.label }}</div>
            @for (s of g.sessions; track s.id) {
              <div class="row-item" [class.cancelled]="s.status === 'Cancelled'">
                <span>
                  <strong>{{ timeRange(s) || '—' }}</strong> · {{ s.className }}
                  @if (s.teacherName) { <span class="muted">— {{ s.teacherName }}</span> }
                  @if (s.topic) { <span class="muted">· {{ s.topic }}</span> }
                </span>
                <span class="muted">
                  @if (s.shiftName) { {{ s.shiftName }} }
                  @if (s.status === 'Cancelled') { · Hủy }
                </span>
              </div>
            }
          </div>
        } @empty { <nz-empty nzNotFoundContent="Không có buổi học trong khoảng này" /> }
      </nz-card>
    }

    <!-- Nộp bài -->
    <nz-modal [nzVisible]="submitOpen()" [nzTitle]="'Nộp bài: ' + (current()?.title || '')" [nzOkLoading]="busy()"
      (nzOnOk)="submit()" (nzOnCancel)="submitOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical">
          <nz-form-item><nz-form-label>Link bài làm (Google Drive/ảnh…)</nz-form-label>
            <nz-form-control><input nz-input [(ngModel)]="link" name="l" placeholder="https://..." /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Ghi chú</nz-form-label>
            <nz-form-control><textarea nz-input [(ngModel)]="note" name="n" rows="2"></textarea></nz-form-control></nz-form-item>
          <p class="muted">Bấm "OK" để đánh dấu đã nộp. Nộp sau hạn sẽ ghi nhận là "Muộn".</p>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .mt { margin-top: 16px; }
    .row-item { display: flex; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--hs-border); flex-wrap: wrap; }
    .row-item:last-child { border-bottom: none; }
    .row-item.cancelled { text-decoration: line-through; opacity: 0.6; }
    .muted { color: var(--hs-text-muted); }
    .asg { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--hs-border); flex-wrap: wrap; }
    .asg:last-child { border-bottom: none; }
    .asg-main { flex: 1; min-width: 180px; display: flex; flex-direction: column; }
    .sched-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .sched-day { margin-bottom: 12px; }
    .sched-day:last-child { margin-bottom: 0; }
    .sched-day-head { font-weight: 600; color: var(--hs-primary); margin-bottom: 4px; }
  `
})
export class PortalPage {
  private readonly portalService = inject(PortalService);
  private readonly message = inject(NzMessageService);
  protected readonly profile = signal<PortalProfile | null>(null);
  protected readonly notLinked = signal(false);
  protected readonly assignments = signal<PortalAssignment[]>([]);
  protected readonly exams = signal<PortalExam[]>([]);

  protected readonly statusLabels = SUBMISSION_STATUS_LABELS;
  protected readonly statusColors = SUBMISSION_STATUS_COLORS;

  protected readonly submitOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly current = signal<PortalAssignment | null>(null);
  protected link = '';
  protected note = '';

  // "Lịch của tôi" — xem theo Ngày/Tuần các lớp đang học.
  private readonly weekdays = WEEKDAY_LABELS;
  protected readonly myMode = signal<'day' | 'week'>('week');
  protected readonly myAnchor = signal<Date>(startOfDay(new Date()));
  protected readonly mySchedule = signal<CalendarSession[]>([]);

  protected readonly myGroups = computed<MyDay[]>(() => {
    const byDate = new Map<string, CalendarSession[]>();
    for (const s of this.mySchedule()) {
      const list = byDate.get(s.sessionDate) ?? [];
      list.push(s);
      byDate.set(s.sessionDate, list);
    }
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([iso, sessions]) => {
        const d = parseIso(iso);
        return { iso, label: `${this.weekdays[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, sessions };
      });
  });

  protected readonly myRangeLabel = computed(() => {
    const a = this.myAnchor();
    if (this.myMode() === 'day')
      return `${pad(a.getDate())}/${pad(a.getMonth() + 1)}/${a.getFullYear()}`;
    const start = startOfWeek(a);
    const end = addDays(start, 6);
    return `${pad(start.getDate())}/${pad(start.getMonth() + 1)} – ${pad(end.getDate())}/${pad(end.getMonth() + 1)}/${end.getFullYear()}`;
  });

  constructor() {
    this.portalService.me().subscribe({
      next: p => this.profile.set(p),
      error: () => this.notLinked.set(true)
    });
    this.portalService.assignments().subscribe({ next: a => this.assignments.set(a) });
    this.portalService.myExams().subscribe({ next: e => this.exams.set(e), error: () => { /* im lặng */ } });
    this.fetchMySchedule();
  }

  protected onMyMode(mode: 'day' | 'week'): void {
    this.myMode.set(mode);
    this.fetchMySchedule();
  }

  protected shiftMy(delta: number): void {
    const step = this.myMode() === 'day' ? delta : delta * 7;
    this.myAnchor.set(addDays(this.myAnchor(), step));
    this.fetchMySchedule();
  }

  protected myToday(): void {
    this.myAnchor.set(startOfDay(new Date()));
    this.fetchMySchedule();
  }

  protected timeRange(s: CalendarSession): string {
    const f = (t: string | null) => (t ? t.substring(0, 5) : '');
    if (!s.startTime && !s.endTime) return '';
    return s.endTime ? `${f(s.startTime)}–${f(s.endTime)}` : f(s.startTime);
  }

  private fetchMySchedule(): void {
    const a = this.myAnchor();
    const from = this.myMode() === 'day' ? a : startOfWeek(a);
    const to = this.myMode() === 'day' ? a : addDays(startOfWeek(a), 6);
    this.portalService.schedule(toDateOnly(from), toDateOnly(to)).pipe(
      catchError(() => EMPTY)
    ).subscribe(list => this.mySchedule.set(list));
  }

  protected openSubmit(a: PortalAssignment): void {
    this.current.set(a);
    this.link = a.link ?? '';
    this.note = '';
    this.submitOpen.set(true);
  }

  protected submit(): void {
    const a = this.current();
    if (!a) return;
    this.busy.set(true);
    this.portalService.submit(a.id, { link: this.link || null, note: this.note || null }).pipe(
      tap(() => {
        this.busy.set(false);
        this.submitOpen.set(false);
        this.message.success('Đã nộp bài.');
      }),
      // Nộp đã xong: refetch danh sách; nếu refetch lỗi thì im lặng, không báo "nộp thất bại".
      switchMap(() => this.portalService.assignments().pipe(catchError(() => EMPTY)))
    ).subscribe({
      next: x => this.assignments.set(x),
      error: (e: HttpErrorResponse) => { this.busy.set(false); this.message.error(e.error?.message ?? e.message ?? 'Nộp bài thất bại.'); }
    });
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Thứ 2 = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
