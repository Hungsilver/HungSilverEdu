import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  PortalAssignment, PortalProfile, SUBMISSION_STATUS_COLORS, SUBMISSION_STATUS_LABELS
} from '../../core/models';
import { PortalService } from '../../core/portal.service';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-portal-page',
  imports: [
    DatePipe, FormsModule,
    NzCardModule, NzGridModule, NzStatisticModule, NzTagModule, NzAlertModule, NzEmptyModule,
    NzButtonModule, NzModalModule, NzInputModule, NzFormModule, NzIconModule, PageHeader
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

      <nz-card nzTitle="Lịch học sắp tới" class="mt">
        @for (s of p.upcomingSessions; track s.sessionId) {
          <div class="row-item">
            <span>{{ s.className }} @if (s.topic) { <span class="muted">· {{ s.topic }}</span> }</span>
            <span class="muted">{{ s.sessionDate | date: 'dd/MM/yyyy' }} {{ s.startTime ? s.startTime.substring(0,5) : '' }}</span>
          </div>
        } @empty { <nz-empty nzNotFoundContent="Chưa có lịch học" /> }
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
    .row-item { display: flex; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--hs-border); }
    .row-item:last-child { border-bottom: none; }
    .muted { color: var(--hs-text-muted); }
    .asg { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--hs-border); flex-wrap: wrap; }
    .asg:last-child { border-bottom: none; }
    .asg-main { flex: 1; min-width: 180px; display: flex; flex-direction: column; }
  `
})
export class PortalPage {
  private readonly portalService = inject(PortalService);
  private readonly message = inject(NzMessageService);
  protected readonly profile = signal<PortalProfile | null>(null);
  protected readonly notLinked = signal(false);
  protected readonly assignments = signal<PortalAssignment[]>([]);

  protected readonly statusLabels = SUBMISSION_STATUS_LABELS;
  protected readonly statusColors = SUBMISSION_STATUS_COLORS;

  protected readonly submitOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly current = signal<PortalAssignment | null>(null);
  protected link = '';
  protected note = '';

  constructor() {
    this.portalService.me().subscribe({
      next: p => this.profile.set(p),
      error: () => this.notLinked.set(true)
    });
    this.portalService.assignments().subscribe({ next: a => this.assignments.set(a) });
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
