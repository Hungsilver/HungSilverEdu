import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EChartsCoreOption } from 'echarts/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../core/auth.service';
import { ApiProblem, ROLE_USER, RewardTier, REWARD_TIER_LABELS, SKILLS, Student, StudentProgress, UserListItem } from '../../core/models';
import { StudentsService } from '../../core/students.service';
import { UsersService } from '../../core/users.service';
import { Chart } from '../../shared/chart';

@Component({
  selector: 'app-student-detail-page',
  imports: [
    RouterLink, DatePipe, FormsModule,
    NzCardModule, NzGridModule, NzStatisticModule, NzDescriptionsModule, NzButtonModule, NzIconModule,
    NzModalModule, NzDatePickerModule, NzSelectModule, NzTagModule, Chart
  ],
  template: `
    <a routerLink="/students" class="back"><nz-icon nzType="arrow-left" /> Danh sách học viên</a>

    @if (student(); as s) {
      <h2>{{ s.fullName }}</h2>
      <nz-row [nzGutter]="[16, 16]">
        <nz-col [nzXs]="24" [nzLg]="12">
          <nz-card nzTitle="Hồ sơ">
            <nz-descriptions nzBordered [nzColumn]="1" nzSize="small">
              <nz-descriptions-item nzTitle="Ngày sinh">{{ s.dateOfBirth ? (s.dateOfBirth | date: 'dd/MM/yyyy') : '—' }}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Trường">{{ s.school || '—' }}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="SĐT">{{ s.phone || '—' }}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Phụ huynh">{{ s.parentName || '—' }} ({{ s.parentPhone || '—' }})</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Trình độ">{{ s.englishLevel || '—' }}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Mục tiêu">{{ s.learningGoal || '—' }}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Điểm đầu vào">{{ s.entryScore ?? '—' }}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Địa chỉ">{{ s.address || '—' }}</nz-descriptions-item>
            </nz-descriptions>
          </nz-card>
        </nz-col>

        <nz-col [nzXs]="24" [nzLg]="12">
          <nz-row [nzGutter]="[16, 16]">
            <nz-col [nzXs]="12"><nz-card><nz-statistic [nzValue]="prog()?.attendedSessions ?? 0" [nzSuffix]="'/' + (prog()?.totalSessions ?? 0)" nzTitle="Buổi đi học" /></nz-card></nz-col>
            <nz-col [nzXs]="12"><nz-card><nz-statistic [nzValue]="prog()?.homeworkCompleted ?? 0" nzTitle="BTVN hoàn thành" /></nz-card></nz-col>
            <nz-col [nzXs]="12"><nz-card><nz-statistic [nzValue]="prog()?.rewardBalance ?? 0" nzTitle="Điểm thưởng" /></nz-card></nz-col>
            <nz-col [nzXs]="12"><nz-card><nz-statistic [nzValue]="prog()?.penaltyPoints ?? 0" nzTitle="Điểm phạt" /></nz-card></nz-col>
          </nz-row>
          @if (canManage()) {
            <nz-card nzTitle="Quy đổi điểm thưởng" class="mt">
              @for (tier of tiers; track tier) {
                <button nz-button nzSize="small" class="redeem-btn" (click)="redeem(tier)">
                  <nz-icon nzType="gift" /> {{ tierLabels[tier] }}
                </button>
              }
            </nz-card>
            <nz-card nzTitle="Báo cáo phụ huynh" class="mt">
              <button nz-button (click)="reportOpen.set(true)"><nz-icon nzType="file-text" /> Tạo báo cáo tháng</button>
            </nz-card>
            <nz-card nzTitle="Tài khoản học sinh" class="mt">
              @if (s.userId) {
                <nz-tag nzColor="green">Đã liên kết tài khoản (portal)</nz-tag>
              } @else {
                <div class="report-bar">
                  <nz-select class="link-select" nzShowSearch nzPlaceHolder="Chọn tài khoản học sinh" [(ngModel)]="linkUserId">
                    @for (u of users(); track u.id) { <nz-option [nzValue]="u.id" [nzLabel]="(u.fullName || u.email)" /> }
                  </nz-select>
                  <button nz-button nzType="primary" [disabled]="!linkUserId" (click)="link()">Liên kết</button>
                </div>
              }
            </nz-card>
          }
        </nz-col>

        <nz-col [nzXs]="24" [nzLg]="12">
          <nz-card nzTitle="Biểu đồ năng lực (6 kỹ năng)">
            @if (prog()?.latestSkills) { <app-chart [option]="radarOption()" /> }
            @else { <p class="muted">Chưa có dữ liệu đánh giá.</p> }
          </nz-card>
        </nz-col>
        <nz-col [nzXs]="24" [nzLg]="12">
          <nz-card nzTitle="Tiến bộ điểm số">
            @if ((prog()?.scoreTrend?.length ?? 0) > 0) { <app-chart [option]="trendOption()" /> }
            @else { <p class="muted">Chưa có dữ liệu kiểm tra.</p> }
          </nz-card>
        </nz-col>
      </nz-row>
    }

    <nz-modal [nzVisible]="reportOpen()" nzTitle="Báo cáo phụ huynh theo tháng" [nzFooter]="null"
      (nzOnCancel)="reportOpen.set(false)" [nzWidth]="560">
      <ng-container *nzModalContent>
        <div class="report-bar">
          <nz-date-picker nzMode="month" [(ngModel)]="reportPeriod" nzFormat="MM/yyyy" />
          <button nz-button nzType="primary" [nzLoading]="reportLoading()" (click)="genReport()"><nz-icon nzType="file-text" /> Tạo</button>
          @if (reportContent()) { <button nz-button (click)="copyReport()"><nz-icon nzType="copy" /> Sao chép</button> }
        </div>
        @if (reportContent()) { <pre class="report">{{ reportContent() }}</pre> }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px; }
    .mt { margin-top: 16px; }
    .redeem-btn { margin: 0 8px 8px 0; }
    .muted { color: rgba(0,0,0,0.45); }
    .report-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .link-select { min-width: 220px; flex: 1; }
    .report { white-space: pre-wrap; font-family: inherit; background: #fafafa; padding: 12px; border-radius: 6px; }
  `
})
export class StudentDetailPage implements OnInit {
  readonly id = input.required<string>();

  private readonly studentsService = inject(StudentsService);
  private readonly usersService = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);

  protected readonly users = signal<UserListItem[]>([]);
  protected linkUserId: string | null = null;

  protected readonly tiers = [RewardTier.SmallGift, RewardTier.FreeMaterials, RewardTier.FeeDiscount];
  protected readonly tierLabels = REWARD_TIER_LABELS;
  protected readonly canManage = computed(() => this.auth.isAdmin() || this.auth.isTeacher());

  protected readonly student = signal<Student | null>(null);
  protected readonly prog = signal<StudentProgress | null>(null);

  protected readonly reportOpen = signal(false);
  protected readonly reportLoading = signal(false);
  protected readonly reportContent = signal('');
  protected reportPeriod = new Date();

  protected readonly radarOption = computed<EChartsCoreOption>(() => {
    const sk = this.prog()?.latestSkills;
    return {
      tooltip: {},
      radar: { indicator: SKILLS.map(s => ({ name: s.label, max: 10 })) },
      series: [{
        type: 'radar',
        data: [{ value: SKILLS.map(s => (sk ? (sk[s.key] as number | null) ?? 0 : 0)), name: 'Kỹ năng' }]
      }]
    };
  });

  protected readonly trendOption = computed<EChartsCoreOption>(() => {
    const trend = this.prog()?.scoreTrend ?? [];
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 16, top: 24, bottom: 28 },
      xAxis: { type: 'category', data: trend.map(t => t.takenOn) },
      yAxis: { type: 'value' },
      series: [{ type: 'line', smooth: true, data: trend.map(t => t.overall ?? 0), itemStyle: { color: '#1890ff' } }]
    };
  });

  ngOnInit(): void {
    this.reload();
    if (this.auth.isAdmin()) {
      this.usersService.getPaged(1, 200).subscribe(r =>
        this.users.set(r.items.filter(u => !u.isDeleted && u.roles.includes(ROLE_USER))));
    }
  }

  protected link(): void {
    if (!this.linkUserId) return;
    this.studentsService.linkUser(this.id(), this.linkUserId).subscribe({
      next: () => { this.message.success('Đã liên kết tài khoản.'); this.linkUserId = null; this.reload(); },
      error: (err: HttpErrorResponse) => this.message.error((err.error as ApiProblem | null)?.detail ?? 'Liên kết thất bại.')
    });
  }

  private reload(): void {
    const id = this.id();
    this.studentsService.getById(id).subscribe({ next: s => this.student.set(s) });
    this.studentsService.getProgress(id).subscribe({ next: p => this.prog.set(p) });
  }

  protected redeem(tier: RewardTier): void {
    this.studentsService.redeem(this.id(), { tier, note: null }).subscribe({
      next: () => { this.message.success('Đã quy đổi điểm thưởng.'); this.reload(); },
      error: (err: HttpErrorResponse) => this.message.error((err.error as ApiProblem | null)?.detail ?? 'Quy đổi thất bại.')
    });
  }

  protected genReport(): void {
    this.reportLoading.set(true);
    this.studentsService.generateParentReport(this.id(), this.reportPeriod.getFullYear(), this.reportPeriod.getMonth() + 1).subscribe({
      next: r => { this.reportLoading.set(false); this.reportContent.set(r.content); },
      error: (err: HttpErrorResponse) => { this.reportLoading.set(false); this.message.error((err.error as ApiProblem | null)?.detail ?? 'Tạo báo cáo thất bại.'); }
    });
  }

  protected copyReport(): void {
    navigator.clipboard.writeText(this.reportContent()).then(
      () => this.message.success('Đã sao chép.'),
      () => this.message.error('Không sao chép được.')
    );
  }
}
