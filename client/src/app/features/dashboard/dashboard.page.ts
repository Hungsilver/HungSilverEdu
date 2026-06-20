import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EChartsCoreOption } from 'echarts/core';
import { forkJoin } from 'rxjs';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DashboardService } from '../../core/dashboard.service';
import { DashboardCharts, DashboardSummary } from '../../core/models';
import { Chart } from '../../shared/chart';
import { PageHeader } from '../../shared/page-header';
import { StatCard } from '../../shared/stat-card';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink, DatePipe, CurrencyPipe,
    NzGridModule, NzCardModule, NzListModule, NzTagModule, NzIconModule, NzEmptyModule,
    Chart, PageHeader, StatCard
  ],
  template: `
    <app-page-header title="Tổng quan" subtitle="Bức tranh nhanh của trung tâm hôm nay" icon="dashboard" />

    <nz-row [nzGutter]="[16, 16]">
      <nz-col [nzXs]="12" [nzSm]="12" [nzLg]="6">
        <app-stat-card title="Học sinh đang học" [value]="summary()?.totalActiveStudents ?? 0" icon="idcard" color="#4f46e5" />
      </nz-col>
      <nz-col [nzXs]="12" [nzSm]="12" [nzLg]="6">
        <app-stat-card title="Tổng số lớp" [value]="summary()?.totalClasses ?? 0" icon="book" color="#16a34a" />
      </nz-col>
      <nz-col [nzXs]="12" [nzSm]="12" [nzLg]="6">
        <app-stat-card title="Buổi học hôm nay" [value]="summary()?.sessionsToday ?? 0" icon="calendar" color="#7c3aed" />
      </nz-col>
      <nz-col [nzXs]="12" [nzSm]="12" [nzLg]="6">
        <app-stat-card title="Học phí sắp đến hạn" [value]="summary()?.tuitionDueSoon?.length ?? 0" icon="dollar" color="#f59e0b" />
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
    .row-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--hs-border); }
    .row-item:last-child { border-bottom: none; }
    .muted { color: var(--hs-text-muted); font-size: 12px; }
  `
})
export class DashboardPage {
  private readonly dashboardService = inject(DashboardService);

  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly charts = signal<DashboardCharts | null>(null);

  protected readonly attendanceOption = computed<EChartsCoreOption>(() =>
    lineOption(this.charts()?.attendanceByMonth.map(x => x.month) ?? [], this.charts()?.attendanceByMonth.map(x => x.rate) ?? [], '#4f46e5'));

  protected readonly homeworkOption = computed<EChartsCoreOption>(() =>
    barOption(this.charts()?.homeworkByMonth.map(x => x.month) ?? [], this.charts()?.homeworkByMonth.map(x => x.rate) ?? [], '#16a34a'));

  protected readonly rewardOption = computed<EChartsCoreOption>(() =>
    barOption(this.charts()?.rewardPointsByClass.map(x => x.className) ?? [], this.charts()?.rewardPointsByClass.map(x => x.points) ?? [], '#f59e0b'));

  protected readonly growthOption = computed<EChartsCoreOption>(() =>
    lineOption(this.charts()?.testScoreGrowth.map(x => x.month) ?? [], this.charts()?.testScoreGrowth.map(x => x.averageScore) ?? [], '#7c3aed'));

  constructor() {
    // Hai request độc lập → tải song song, hiển thị cùng lúc.
    forkJoin({
      summary: this.dashboardService.getSummary(),
      charts: this.dashboardService.getCharts()
    }).subscribe(({ summary, charts }) => {
      this.summary.set(summary);
      this.charts.set(charts);
    });
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
