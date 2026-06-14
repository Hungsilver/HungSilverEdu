import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PortalProfile } from '../../core/models';
import { PortalService } from '../../core/portal.service';

@Component({
  selector: 'app-portal-page',
  imports: [DatePipe, NzCardModule, NzGridModule, NzStatisticModule, NzTagModule, NzAlertModule, NzEmptyModule],
  template: `
    <h2>Trang của tôi</h2>

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

      <nz-card nzTitle="Lịch học sắp tới" class="mt">
        @for (s of p.upcomingSessions; track s.sessionId) {
          <div class="row-item">
            <span>{{ s.className }} @if (s.topic) { <span class="muted">· {{ s.topic }}</span> }</span>
            <span class="muted">{{ s.sessionDate | date: 'dd/MM/yyyy' }} {{ s.startTime ? s.startTime.substring(0,5) : '' }}</span>
          </div>
        } @empty { <nz-empty nzNotFoundContent="Chưa có lịch học" /> }
      </nz-card>
    }
  `,
  styles: `
    .mt { margin-top: 16px; }
    .row-item { display: flex; justify-content: space-between; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
    .row-item:last-child { border-bottom: none; }
    .muted { color: rgba(0,0,0,0.45); }
  `
})
export class PortalPage {
  private readonly portalService = inject(PortalService);
  protected readonly profile = signal<PortalProfile | null>(null);
  protected readonly notLinked = signal(false);

  constructor() {
    this.portalService.me().subscribe({
      next: p => this.profile.set(p),
      error: () => this.notLinked.set(true)
    });
  }
}
