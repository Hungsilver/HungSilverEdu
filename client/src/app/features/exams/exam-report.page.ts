import { Location } from '@angular/common';
import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ExamService } from '../../core/exam.service';
import { EXAM_ATTEMPT_STATUS_LABELS, ExamReport } from '../../core/models';
import { Chart } from '../../shared/chart';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-exam-report-page',
  imports: [
    DatePipe, NzCardModule, NzGridModule, NzStatisticModule, NzTableModule, NzTagModule, NzButtonModule,
    NzIconModule, NzSpinModule, NzEmptyModule, Chart, PageHeader
  ],
  template: `
    <app-page-header [title]="report()?.examTitle || 'Báo cáo'"
      [subtitle]="report()?.className ? ('Lớp ' + report()!.className) : 'Kết quả làm đề'" icon="bar-chart">
      <button nz-button (click)="back()"><nz-icon nzType="arrow-left" /> Quay lại</button>
    </app-page-header>

    @if (loading()) {
      <div class="center"><nz-spin nzSimple /></div>
    } @else if (report(); as r) {
      <nz-row [nzGutter]="[16, 16]">
        <nz-col [nzXs]="12" [nzMd]="6"><nz-card><nz-statistic [nzValue]="r.submittedCount" [nzSuffix]="'/' + r.totalStudents" nzTitle="Đã nộp" /></nz-card></nz-col>
        <nz-col [nzXs]="12" [nzMd]="6"><nz-card><nz-statistic [nzValue]="r.averageScore ?? '—'" [nzSuffix]="'/' + r.totalPoints" nzTitle="Điểm TB lớp" /></nz-card></nz-col>
        <nz-col [nzXs]="12" [nzMd]="6"><nz-card><nz-statistic [nzValue]="highest()" nzTitle="Điểm cao nhất" /></nz-card></nz-col>
        <nz-col [nzXs]="12" [nzMd]="6"><nz-card><nz-statistic [nzValue]="hardestLabel()" nzTitle="Câu khó nhất" /></nz-card></nz-col>
      </nz-row>

      <nz-row [nzGutter]="[16, 16]" class="mt">
        <nz-col [nzXs]="24" [nzMd]="12">
          <nz-card nzTitle="Phân bố điểm">
            @if (r.submittedCount) { <app-chart [option]="distOption()" /> }
            @else { <nz-empty nzNotFoundContent="Chưa có ai nộp bài" /> }
          </nz-card>
        </nz-col>
        <nz-col [nzXs]="24" [nzMd]="12">
          <nz-card nzTitle="Tỉ lệ đúng theo câu (câu thấp = khó)">
            @if (r.itemStats.length && r.submittedCount) { <app-chart [option]="itemOption()" /> }
            @else { <nz-empty nzNotFoundContent="Chưa có dữ liệu" /> }
          </nz-card>
        </nz-col>
      </nz-row>

      <nz-card nzTitle="Kết quả từng học viên" class="mt">
        <nz-table #t [nzData]="r.students" [nzFrontPagination]="false" [nzScroll]="{ x: '520px' }">
          <thead><tr><th>Học viên</th><th>Trạng thái</th><th>Điểm</th><th>Nộp lúc</th></tr></thead>
          <tbody>
            @for (s of t.data; track s.studentId) {
              <tr>
                <td>{{ s.fullName }}</td>
                <td>
                  @if (s.status === 'Submitted' || s.status === 'AutoSubmitted') { <nz-tag nzColor="success">{{ statusLabels[s.status] }}</nz-tag> }
                  @else if (s.status === 'InProgress') { <nz-tag nzColor="processing">Đang làm</nz-tag> }
                  @else { <nz-tag>Chưa làm</nz-tag> }
                </td>
                <td>{{ s.score !== null ? (s.score + '/' + r.totalPoints) : '—' }}</td>
                <td>{{ s.submittedAt ? (s.submittedAt | date: 'dd/MM HH:mm') : '—' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    } @else {
      <p class="muted">Không tải được báo cáo.</p>
    }
  `,
  styles: `
    .center { text-align: center; padding: 48px; }
    .mt { margin-top: 16px; }
    .muted { color: var(--hs-text-muted); }
  `
})
export class ExamReportPage implements OnInit {
  private readonly examService = inject(ExamService);
  private readonly location = inject(Location);

  readonly assignmentId = input.required<string>();

  protected readonly statusLabels = EXAM_ATTEMPT_STATUS_LABELS;
  protected readonly loading = signal(true);
  protected readonly report = signal<ExamReport | null>(null);

  protected readonly highest = computed(() => {
    const scores = (this.report()?.students ?? []).map(s => s.score).filter((x): x is number => x !== null);
    return scores.length ? Math.max(...scores) : '—';
  });

  protected readonly hardestLabel = computed(() => {
    const items = (this.report()?.itemStats ?? []).filter(i => i.answeredCount > 0);
    if (!items.length) return '—';
    const hardest = items.reduce((a, b) => (b.correctPercent < a.correctPercent ? b : a));
    return 'Câu ' + (hardest.sourceNumber ?? hardest.orderNo + 1);
  });

  protected readonly distOption = computed<EChartsCoreOption>(() => {
    const d = this.report()?.distribution ?? [];
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 36, right: 16, top: 16, bottom: 28 },
      xAxis: { type: 'category', data: d.map(b => b.label) },
      yAxis: { type: 'value', minInterval: 1 },
      series: [{ type: 'bar', barWidth: '55%', data: d.map(b => b.count), itemStyle: { color: '#4F46E5', borderRadius: [4, 4, 0, 0] } }]
    };
  });

  protected readonly itemOption = computed<EChartsCoreOption>(() => {
    const items = this.report()?.itemStats ?? [];
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => `${v}%` },
      grid: { left: 40, right: 16, top: 16, bottom: 28 },
      xAxis: { type: 'category', data: items.map(s => 'C' + (s.sourceNumber ?? s.orderNo + 1)) },
      yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
      series: [{
        type: 'bar',
        data: items.map(s => s.correctPercent),
        itemStyle: {
          borderRadius: [3, 3, 0, 0],
          color: (p: { value: number }) => (p.value < 50 ? '#DC2626' : p.value < 75 ? '#F59E0B' : '#16A34A')
        }
      }]
    };
  });

  ngOnInit(): void {
    this.examService.report(this.assignmentId()).subscribe({
      next: r => { this.report.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected back(): void {
    this.location.back();
  }
}
