import { DatePipe, DecimalPipe } from '@angular/common';
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
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../core/auth.service';
import { ROLE_USER, RewardTier, REWARD_TIER_LABELS, SKILLS, Student, StudentProgress, TuitionInvoice, TUITION_STATUS_COLORS, TUITION_STATUS_LABELS, UserListItem, Warnings } from '../../core/models';
import { StudentsService } from '../../core/students.service';
import { TuitionService } from '../../core/tuition.service';
import { UsersService } from '../../core/users.service';
import { WarningsService } from '../../core/warnings.service';
import { Chart } from '../../shared/chart';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-student-detail-page',
  imports: [
    RouterLink, DatePipe, DecimalPipe, FormsModule,
    NzCardModule, NzGridModule, NzStatisticModule, NzDescriptionsModule, NzButtonModule, NzIconModule,
    NzModalModule, NzDatePickerModule, NzSelectModule, NzSpinModule, NzTableModule, NzTabsModule, NzTagModule,
    Chart, PageHeader
  ],
  template: `
    <a routerLink="/students" class="back"><nz-icon nzType="arrow-left" /> Danh sách học viên</a>

    @if (student(); as s) {
      <app-page-header [title]="s.fullName" subtitle="Hồ sơ & tiến độ học tập" icon="idcard" />
      <nz-tabs class="module-tabs" nzType="line" (nzSelectedIndexChange)="onTabChange($event)">

        <nz-tab nzTitle="Thông tin cơ bản">
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
              }
              @if (auth.isAdmin()) {
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

            @if (warnings(); as w) {
              @if (warnTotal(w) > 0) {
                <nz-col [nzXs]="24">
                  <nz-card [nzTitle]="warnTitle">
                    <ng-template #warnTitle><nz-icon nzType="warning" /> Cảnh báo <nz-tag nzColor="red" class="ml">{{ warnTotal(w) }}</nz-tag></ng-template>
                    @for (grp of warnGroups(w); track grp.label) {
                      @if (grp.items.length) {
                        <div class="warn-item">
                          <nz-icon [nzType]="grp.icon" /> <strong>{{ grp.label }}:</strong>
                          @for (it of grp.items; track it.detail) { <span class="muted"> {{ it.detail }};</span> }
                        </div>
                      }
                    }
                  </nz-card>
                </nz-col>
              }
            }
          </nz-row>
        </nz-tab>

        <nz-tab nzTitle="Lớp đang theo học">
          @if (s.classes.length === 0) {
            <p class="muted">Học viên chưa tham gia lớp nào.</p>
          } @else {
            <nz-table [nzData]="s.classes" [nzFrontPagination]="false" nzSize="small" [nzScroll]="{ x: '640px' }">
              <thead>
                <tr>
                  <th>Mã lớp</th><th>Tên lớp</th><th>Giáo viên</th><th>Môn học</th>
                  <th>Khối</th><th>Cơ sở</th><th>Học phí</th><th>Ngày đăng ký</th>
                </tr>
              </thead>
              <tbody>
                @for (c of s.classes; track c.classId) {
                  <tr>
                    <td>{{ c.classCode }}</td>
                    <td>{{ c.className }}</td>
                    <td>{{ c.teacherName || '—' }}</td>
                    <td>{{ c.subjectName || '—' }}</td>
                    <td>{{ c.gradeName || '—' }}</td>
                    <td>{{ c.branchName || '—' }}</td>
                    <td>{{ c.tuitionFee | number:'1.0-0' }}</td>
                    <td>{{ c.enrolledOn | date:'dd/MM/yyyy' }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
        </nz-tab>

        <nz-tab nzTitle="Học phí">
          <nz-spin [nzSpinning]="tuitionLoading()">
            @if (tuitionInvoices().length === 0 && !tuitionLoading()) {
              <p class="muted">Chưa có hóa đơn học phí.</p>
            } @else {
              <nz-table [nzData]="tuitionInvoices()" [nzFrontPagination]="false" nzSize="small" [nzScroll]="{ x: '760px' }">
                <thead>
                  <tr>
                    <th>Kỳ</th><th>Hạn đóng</th><th>Số tiền</th><th>Giảm giá</th>
                    <th>Đã đóng</th><th>Trạng thái</th><th>Ngày đóng</th>
                  </tr>
                </thead>
                <tbody>
                  @for (inv of tuitionInvoices(); track inv.id) {
                    <tr>
                      <td>{{ inv.periodMonth }}/{{ inv.periodYear }}</td>
                      <td>{{ inv.dueDate | date:'dd/MM/yyyy' }}</td>
                      <td>{{ inv.amount | number:'1.0-0' }}</td>
                      <td>{{ inv.discountAmount | number:'1.0-0' }}</td>
                      <td>{{ inv.paidAmount | number:'1.0-0' }}</td>
                      <td><nz-tag [nzColor]="statusColors[inv.status]">{{ statusLabels[inv.status] }}</nz-tag></td>
                      <td>{{ inv.paidOn ? (inv.paidOn | date:'dd/MM/yyyy') : '—' }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            }
          </nz-spin>
        </nz-tab>

      </nz-tabs>
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
    .module-tabs { margin-top: 4px; }
    .mt { margin-top: 16px; }
    .redeem-btn { margin: 0 8px 8px 0; }
    .muted { color: var(--hs-text-muted); }
    .ml { margin-left: 8px; }
    .warn-item { padding: 4px 0; font-size: 13px; }
    .report-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .link-select { min-width: 220px; flex: 1; }
    .report { white-space: pre-wrap; font-family: inherit; background: var(--hs-surface-2); border: 1px solid var(--hs-border); padding: 12px; border-radius: 8px; }
  `
})
export class StudentDetailPage implements OnInit {
  readonly id = input.required<string>();

  private readonly studentsService = inject(StudentsService);
  private readonly usersService = inject(UsersService);
  private readonly warningsService = inject(WarningsService);
  private readonly tuitionService = inject(TuitionService);
  protected readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);

  protected readonly tuitionInvoices = signal<TuitionInvoice[]>([]);
  protected readonly tuitionLoading = signal(false);
  protected readonly tuitionLoaded = signal(false);
  protected readonly statusColors = TUITION_STATUS_COLORS;
  protected readonly statusLabels = TUITION_STATUS_LABELS;

  protected readonly warnings = signal<Warnings | null>(null);

  protected warnTotal(w: Warnings): number {
    return w.consecutiveAbsences.length + w.missedHomework.length + w.scoreDrop.length + w.tuitionOverdue.length;
  }

  protected warnGroups(w: Warnings) {
    return [
      { label: 'Vắng liên tiếp', icon: 'user-delete', items: w.consecutiveAbsences },
      { label: 'Không làm BTVN', icon: 'close-circle', items: w.missedHomework },
      { label: 'Điểm giảm', icon: 'fall', items: w.scoreDrop },
      { label: 'Học phí quá hạn', icon: 'dollar', items: w.tuitionOverdue }
    ];
  }

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
      series: [{ type: 'line', smooth: true, data: trend.map(t => t.overall ?? 0), itemStyle: { color: '#4f46e5' } }]
    };
  });

  ngOnInit(): void {
    this.reload();
    if (this.auth.isAdmin()) {
      this.usersService.getPaged(1, 200).subscribe(r =>
        this.users.set(r.items.filter(u => !u.isDeleted && u.roles.includes(ROLE_USER))));
    }
  }

  protected onTabChange(idx: number): void {
    if (idx === 2 && !this.tuitionLoaded()) {
      this.tuitionLoading.set(true);
      this.tuitionService.getByStudent(this.id()).subscribe({
        next: inv => { this.tuitionInvoices.set(inv); this.tuitionLoading.set(false); this.tuitionLoaded.set(true); },
        error: () => this.tuitionLoading.set(false)
      });
    }
  }

  protected link(): void {
    if (!this.linkUserId) return;
    this.studentsService.linkUser(this.id(), this.linkUserId).subscribe({
      next: () => { this.message.success('Đã liên kết tài khoản.'); this.linkUserId = null; this.reload(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ??'Liên kết thất bại.')
    });
  }

  private reload(): void {
    const id = this.id();
    this.studentsService.getById(id).subscribe({ next: s => this.student.set(s) });
    this.studentsService.getProgress(id).subscribe({ next: p => this.prog.set(p) });
    this.warningsService.getStudentWarnings(id).subscribe({ next: w => this.warnings.set(w) });
  }

  protected redeem(tier: RewardTier): void {
    this.studentsService.redeem(this.id(), { tier, note: null }).subscribe({
      next: () => { this.message.success('Đã quy đổi điểm thưởng.'); this.reload(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ??'Quy đổi thất bại.')
    });
  }

  protected genReport(): void {
    this.reportLoading.set(true);
    this.studentsService.generateParentReport(this.id(), this.reportPeriod.getFullYear(), this.reportPeriod.getMonth() + 1).subscribe({
      next: r => { this.reportLoading.set(false); this.reportContent.set(r.content); },
      error: (err: HttpErrorResponse) => { this.reportLoading.set(false); this.message.error(err.error?.message ?? err.message ??'Tạo báo cáo thất bại.'); }
    });
  }

  protected copyReport(): void {
    navigator.clipboard.writeText(this.reportContent()).then(
      () => this.message.success('Đã sao chép.'),
      () => this.message.error('Không sao chép được.')
    );
  }
}
