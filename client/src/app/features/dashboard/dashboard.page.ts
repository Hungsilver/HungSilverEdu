import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EChartsCoreOption } from 'echarts/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DashboardService } from '../../core/dashboard.service';
import { DashboardCharts, DashboardSummary } from '../../core/models';
import { Chart } from '../../shared/chart';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink, DatePipe, CurrencyPipe,
    NzGridModule, NzCardModule, NzStatisticModule, NzListModule, NzTagModule, NzIconModule, NzEmptyModule,
    Chart
  ],
  template: `
    <h2>Tổng quan</h2>

    <nz-row [nzGutter]="[16, 16]">
      <nz-col [nzXs]="12" [nzSm]="12" [nzLg]="6">
        <nz-card><nz-statistic [nzValue]="summary()?.totalActiveStudents ?? 0" nzTitle="Học sinh đang học" /></nz-card>
      </nz-col>
      <nz-col [nzXs]="12" [nzSm]="12" [nzLg]="6">
        <nz-card><nz-statistic [nzValue]="summary()?.totalClasses ?? 0" nzTitle="Tổng số lớp" /></nz-card>
      </nz-col>
      <nz-col [nzXs]="12" [nzSm]="12" [nzLg]="6">
        <nz-card><nz-statistic [nzValue]="summary()?.sessionsToday ?? 0" nzTitle="Buổi học hôm nay" /></nz-card>
      </nz-col>
      <nz-col [nzXs]="12" [nzSm]="12" [nzLg]="6">
        <nz-card><nz-statistic [nzValue]="summary()?.tuitionDueSoon?.length ?? 0" nzTitle="Học phí sắp đến hạn" /></nz-card>
      </nz-col>
    </nz-row>

    <nz-row [nzGutter]="[16, 16]" class="mt">
      <nz-col [nzXs]="24" [nzLg]="12">
        <nz-card nzTitle="Tỷ lệ chuyên cần theo tháng (%)"><app-chart [option]="attendanceOption()" /></nz-card>
      </nz-col>
      <nz-col [nzXs]="24" [nzLg]="12">
        <nz-card nzTitle="Tỷ lệ hoàn thành bài tập (%)"><app-chart [option]="homeworkOption()" /></nz-card>
      </nz-col>
      <nz-col [nzXs]="24" [nzLg]="12">
        <nz-card nzTitle="Điểm thưởng theo lớp"><app-chart [option]="rewardOption()" /></nz-card>
      </nz-col>
      <nz-col [nzXs]="24" [nzLg]="12">
        <nz-card nzTitle="Tăng trưởng điểm kiểm tra"><app-chart [option]="growthOption()" /></nz-card>
      </nz-col>
    </nz-row>

    <nz-row [nzGutter]="[16, 16]" class="mt">
      <nz-col [nzXs]="24" [nzLg]="8">
        <nz-card nzTitle="Lịch học hôm nay">
          @for (s of summary()?.todaySchedule ?? []; track s.sessionId) {
            <div class="row-item">
              <a [routerLink]="['/sessions', s.sessionId]">{{ s.className }}</a>
              <span class="muted">{{ s.startTime }}</span>
            </div>
          } @empty { <nz-empty nzNotFoundContent="Không có buổi học" /> }
        </nz-card>
      </nz-col>
      <nz-col [nzXs]="24" [nzLg]="8">
        <nz-card nzTitle="Top học sinh tích cực">
          @for (t of summary()?.topStudents ?? []; track t.studentId) {
            <div class="row-item">
              <a [routerLink]="['/students', t.studentId]">{{ t.studentName }}</a>
              <nz-tag nzColor="gold">{{ t.rewardBalance }} điểm</nz-tag>
            </div>
          } @empty { <nz-empty nzNotFoundContent="Chưa có dữ liệu" /> }
        </nz-card>
      </nz-col>
      <nz-col [nzXs]="24" [nzLg]="8">
        <nz-card nzTitle="Học sinh cần theo dõi">
          @for (a of summary()?.needAttention ?? []; track a.studentId) {
            <div class="row-item">
              <a [routerLink]="['/students', a.studentId]">{{ a.studentName }}</a>
              <nz-tag nzColor="red">{{ a.reason }}</nz-tag>
            </div>
          } @empty { <nz-empty nzNotFoundContent="Không có" /> }
        </nz-card>
      </nz-col>
      <nz-col [nzXs]="24" [nzLg]="8">
        <nz-card nzTitle="Vắng học gần đây">
          @for (a of summary()?.recentAbsentees ?? []; track $index) {
            <div class="row-item">
              <span>{{ a.studentName }} <span class="muted">({{ a.className }})</span></span>
              <span class="muted">{{ a.sessionDate | date: 'dd/MM' }}</span>
            </div>
          } @empty { <nz-empty nzNotFoundContent="Không có" /> }
        </nz-card>
      </nz-col>
      <nz-col [nzXs]="24" [nzLg]="8">
        <nz-card nzTitle="Chưa làm bài tập">
          @for (m of summary()?.missingHomework ?? []; track $index) {
            <div class="row-item">
              <span>{{ m.studentName }} <span class="muted">({{ m.className }})</span></span>
              <span class="muted">{{ m.sessionDate | date: 'dd/MM' }}</span>
            </div>
          } @empty { <nz-empty nzNotFoundContent="Không có" /> }
        </nz-card>
      </nz-col>
      <nz-col [nzXs]="24" [nzLg]="8">
        <nz-card nzTitle="Học phí sắp đến hạn">
          @for (t of summary()?.tuitionDueSoon ?? []; track $index) {
            <div class="row-item">
              <a [routerLink]="['/students', t.studentId]">{{ t.studentName }}</a>
              <span class="muted">{{ t.amount | currency: 'VND' }} · {{ t.dueDate | date: 'dd/MM' }}</span>
            </div>
          } @empty { <nz-empty nzNotFoundContent="Không có" /> }
        </nz-card>
      </nz-col>
    </nz-row>
  `,
  styles: `
    .mt { margin-top: 16px; }
    .row-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
    .row-item:last-child { border-bottom: none; }
    .muted { color: rgba(0,0,0,0.45); font-size: 12px; }
  `
})
export class DashboardPage {
  private readonly dashboardService = inject(DashboardService);

  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly charts = signal<DashboardCharts | null>(null);

  protected readonly attendanceOption = computed<EChartsCoreOption>(() =>
    lineOption(this.charts()?.attendanceByMonth.map(x => x.month) ?? [], this.charts()?.attendanceByMonth.map(x => x.rate) ?? [], '#1890ff'));

  protected readonly homeworkOption = computed<EChartsCoreOption>(() =>
    barOption(this.charts()?.homeworkByMonth.map(x => x.month) ?? [], this.charts()?.homeworkByMonth.map(x => x.rate) ?? [], '#52c41a'));

  protected readonly rewardOption = computed<EChartsCoreOption>(() =>
    barOption(this.charts()?.rewardPointsByClass.map(x => x.className) ?? [], this.charts()?.rewardPointsByClass.map(x => x.points) ?? [], '#faad14'));

  protected readonly growthOption = computed<EChartsCoreOption>(() =>
    lineOption(this.charts()?.testScoreGrowth.map(x => x.month) ?? [], this.charts()?.testScoreGrowth.map(x => x.averageScore) ?? [], '#722ed1'));

  constructor() {
    this.dashboardService.getSummary().subscribe(s => this.summary.set(s));
    this.dashboardService.getCharts().subscribe(c => this.charts.set(c));
  }
}

function lineOption(categories: string[], data: number[], color: string): EChartsCoreOption {
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 16, top: 24, bottom: 28 },
    xAxis: { type: 'category', data: categories },
    yAxis: { type: 'value' },
    series: [{ type: 'line', data, smooth: true, itemStyle: { color }, areaStyle: { opacity: 0.1 } }]
  };
}

function barOption(categories: string[], data: number[], color: string): EChartsCoreOption {
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 16, top: 24, bottom: 28 },
    xAxis: { type: 'category', data: categories },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data, itemStyle: { color } }]
  };
}
