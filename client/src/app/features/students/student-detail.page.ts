import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EChartsCoreOption } from 'echarts/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { AuthService } from '../../core/auth.service';
import { ApiProblem, RewardTier, REWARD_TIER_LABELS, SKILLS, Student, StudentProgress } from '../../core/models';
import { StudentsService } from '../../core/students.service';
import { Chart } from '../../shared/chart';

@Component({
  selector: 'app-student-detail-page',
  imports: [
    RouterLink, DatePipe,
    NzCardModule, NzGridModule, NzStatisticModule, NzDescriptionsModule, NzButtonModule, NzIconModule,
    Chart
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
  `,
  styles: `
    .back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px; }
    .mt { margin-top: 16px; }
    .redeem-btn { margin: 0 8px 8px 0; }
    .muted { color: rgba(0,0,0,0.45); }
  `
})
export class StudentDetailPage implements OnInit {
  readonly id = input.required<string>();

  private readonly studentsService = inject(StudentsService);
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);

  protected readonly tiers = [RewardTier.SmallGift, RewardTier.FreeMaterials, RewardTier.FeeDiscount];
  protected readonly tierLabels = REWARD_TIER_LABELS;
  protected readonly canManage = computed(() => this.auth.isAdmin() || this.auth.isTeacher());

  protected readonly student = signal<Student | null>(null);
  protected readonly prog = signal<StudentProgress | null>(null);

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
}
