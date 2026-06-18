import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzTableModule } from 'ng-zorro-antd/table';
import {
  AttendanceStatus, AttitudeStatus, ATTITUDE_LABELS, HomeworkStatus, HOMEWORK_LABELS,
  PointType, SaveAttendanceRow, SessionSheet, SessionStudentRow
} from '../../core/models';
import { ScreenService } from '../../core/screen.service';
import { SessionsService } from '../../core/sessions.service';
import { SettingsService } from '../../core/settings.service';
import { PageHeader } from '../../shared/page-header';

interface PointReason { label: string; points: number; }

@Component({
  selector: 'app-session-page',
  imports: [
    FormsModule, RouterLink, DatePipe,
    NzTableModule, NzCardModule, NzRadioModule, NzSelectModule, NzInputModule, NzButtonModule, NzIconModule,
    NzTagModule, NzModalModule, NzInputNumberModule, PageHeader
  ],
  template: `
    @if (sheet(); as s) {
      <app-page-header
        [title]="s.className + ' · Buổi ' + s.sessionNumber"
        [subtitle]="(s.sessionDate | date: 'EEEE, dd/MM/yyyy') + (s.topic ? ' · ' + s.topic : '')"
        icon="schedule">
        <div class="links">
          <a nz-button nzType="default" [routerLink]="['/sessions', s.sessionId, 'journal']"><nz-icon nzType="read" /> Nhật ký</a>
          <a nz-button nzType="default" [routerLink]="['/sessions', s.sessionId, 'report']"><nz-icon nzType="file-text" /> Báo cáo</a>
        </div>
      </app-page-header>

      <div class="bulk-actions">
        <button nz-button nzSize="small" (click)="markAllPresent()">Tất cả Có mặt</button>
        <button nz-button nzSize="small" (click)="markAllHomework()">Tất cả BTVN Hoàn thành</button>
        <span class="muted counter">Có mặt: {{ presentCount() }}/{{ rows().length }}</span>
      </div>

      @if (screen.isMobile()) {
        <div class="mobile-card-list">
          @for (row of rows(); track row.studentId) {
            <nz-card [nzBordered]="true" nzSize="small">
              <div class="card-header">
                <span class="card-title"><a [routerLink]="['/students', row.studentId]">{{ row.fullName }}</a></span>
                <nz-tag [nzColor]="row.rewardBalance >= 0 ? 'gold' : 'red'">{{ row.rewardBalance }}</nz-tag>
              </div>
              <div class="card-field-block">
                <label class="field-label">Điểm danh</label>
                <nz-radio-group [(ngModel)]="row.attendance" nzButtonStyle="solid" nzSize="small" class="full">
                  <label nz-radio-button [nzValue]="AttendanceStatus.Present">Có mặt</label>
                  <label nz-radio-button [nzValue]="AttendanceStatus.Late">Muộn</label>
                  <label nz-radio-button [nzValue]="AttendanceStatus.ExcusedAbsence">Vắng P</label>
                  <label nz-radio-button [nzValue]="AttendanceStatus.UnexcusedAbsence">Vắng KP</label>
                </nz-radio-group>
              </div>
              <div class="card-field-block">
                <label class="field-label">BTVN</label>
                <nz-select [(ngModel)]="row.homework" nzSize="small" class="full">
                  <nz-option [nzValue]="HomeworkStatus.NotAssigned" nzLabel="Không giao" />
                  <nz-option [nzValue]="HomeworkStatus.CompletedWell" nzLabel="Hoàn thành tốt" />
                  <nz-option [nzValue]="HomeworkStatus.Completed" nzLabel="Hoàn thành" />
                  <nz-option [nzValue]="HomeworkStatus.NotCompleted" nzLabel="Chưa hoàn thành" />
                </nz-select>
              </div>
              <div class="card-field-block">
                <label class="field-label">Thái độ</label>
                <nz-select [(ngModel)]="row.attitude" nzSize="small" class="full">
                  <nz-option [nzValue]="AttitudeStatus.Positive" nzLabel="Tích cực" />
                  <nz-option [nzValue]="AttitudeStatus.Normal" nzLabel="Bình thường" />
                  <nz-option [nzValue]="AttitudeStatus.Unfocused" nzLabel="Chưa tập trung" />
                </nz-select>
              </div>
              <div class="card-actions">
                <div class="bal">
                  <button nz-button nzSize="small" nzShape="circle" (click)="openPoint(row, PointType.Penalty)"><nz-icon nzType="minus" /></button>
                  <nz-tag [nzColor]="row.rewardBalance >= 0 ? 'gold' : 'red'">{{ row.rewardBalance }}</nz-tag>
                  <button nz-button nzSize="small" nzShape="circle" nzType="primary" (click)="openPoint(row, PointType.Reward)"><nz-icon nzType="plus" /></button>
                </div>
                <div class="quick">
                  @for (r of rewardReasons(); track r.label) {
                    <button nz-button nzSize="small" class="chip reward" (click)="quickAdd(row, PointType.Reward, r)">+{{ r.points }} {{ r.label }}</button>
                  }
                  @for (r of penaltyReasons(); track r.label) {
                    <button nz-button nzSize="small" nzDanger class="chip" (click)="quickAdd(row, PointType.Penalty, r)">−{{ r.points }} {{ r.label }}</button>
                  }
                </div>
              </div>
              <div class="card-field-block">
                <input nz-input nzSize="small" [(ngModel)]="row.personalNote" placeholder="Ghi chú..." class="full" />
              </div>
            </nz-card>
          }
        </div>
      } @else {
        <nz-table [nzData]="rows()" [nzFrontPagination]="false" nzSize="small" [nzScroll]="{ x: '1240px' }">
          <thead>
            <tr>
              <th nzLeft nzWidth="160px">Học viên</th>
              <th nzWidth="300px">Điểm danh</th>
              <th nzWidth="150px">BTVN</th>
              <th nzWidth="140px">Thái độ</th>
              <th nzWidth="290px">Điểm thưởng/phạt</th>
              <th nzWidth="200px">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.studentId) {
              <tr>
                <td nzLeft><a [routerLink]="['/students', row.studentId]">{{ row.fullName }}</a></td>
                <td>
                  <nz-radio-group [(ngModel)]="row.attendance" nzButtonStyle="solid" nzSize="small">
                    <label nz-radio-button [nzValue]="AttendanceStatus.Present">Có mặt</label>
                    <label nz-radio-button [nzValue]="AttendanceStatus.Late">Muộn</label>
                    <label nz-radio-button [nzValue]="AttendanceStatus.ExcusedAbsence">Vắng P</label>
                    <label nz-radio-button [nzValue]="AttendanceStatus.UnexcusedAbsence">Vắng KP</label>
                  </nz-radio-group>
                </td>
                <td>
                  <nz-select [(ngModel)]="row.homework" nzSize="small" class="full">
                    <nz-option [nzValue]="HomeworkStatus.NotAssigned" nzLabel="Không giao" />
                    <nz-option [nzValue]="HomeworkStatus.CompletedWell" nzLabel="Hoàn thành tốt" />
                    <nz-option [nzValue]="HomeworkStatus.Completed" nzLabel="Hoàn thành" />
                    <nz-option [nzValue]="HomeworkStatus.NotCompleted" nzLabel="Chưa hoàn thành" />
                  </nz-select>
                </td>
                <td>
                  <nz-select [(ngModel)]="row.attitude" nzSize="small" class="full">
                    <nz-option [nzValue]="AttitudeStatus.Positive" nzLabel="Tích cực" />
                    <nz-option [nzValue]="AttitudeStatus.Normal" nzLabel="Bình thường" />
                    <nz-option [nzValue]="AttitudeStatus.Unfocused" nzLabel="Chưa tập trung" />
                  </nz-select>
                </td>
                <td>
                  <div class="points">
                    <div class="bal">
                      <button nz-button nzSize="small" nzShape="circle" (click)="openPoint(row, PointType.Penalty)"><nz-icon nzType="minus" /></button>
                      <nz-tag [nzColor]="row.rewardBalance >= 0 ? 'gold' : 'red'">{{ row.rewardBalance }}</nz-tag>
                      <button nz-button nzSize="small" nzShape="circle" nzType="primary" (click)="openPoint(row, PointType.Reward)"><nz-icon nzType="plus" /></button>
                    </div>
                    <div class="quick">
                      @for (r of rewardReasons(); track r.label) {
                        <button nz-button nzSize="small" class="chip reward" (click)="quickAdd(row, PointType.Reward, r)">+{{ r.points }} {{ r.label }}</button>
                      }
                      @for (r of penaltyReasons(); track r.label) {
                        <button nz-button nzSize="small" nzDanger class="chip" (click)="quickAdd(row, PointType.Penalty, r)">−{{ r.points }} {{ r.label }}</button>
                      }
                    </div>
                  </div>
                </td>
                <td><input nz-input nzSize="small" [(ngModel)]="row.personalNote" placeholder="Ghi chú..." /></td>
              </tr>
            }
          </tbody>
        </nz-table>
      }

      <div class="save-bar">
        <button nz-button nzType="primary" nzSize="large" [nzLoading]="saving()" (click)="saveAll()">
          <nz-icon nzType="save" /> Lưu tất cả
        </button>
      </div>
    }

    <nz-modal [nzVisible]="pointOpen()" [nzTitle]="pointType() === PointType.Reward ? 'Cộng điểm thưởng' : 'Trừ điểm (phạt)'"
      [nzOkLoading]="busy()" (nzOnOk)="addPoint()" (nzOnCancel)="pointOpen.set(false)">
      <ng-container *nzModalContent>
        <p><strong>{{ pointTarget()?.fullName }}</strong></p>
        <div class="presets">
          @for (r of presets(); track r) {
            <button nz-button nzSize="small" (click)="pointReason = r">{{ r }}</button>
          }
        </div>
        <nz-input-number [(ngModel)]="pointValue" [nzMin]="1" [nzMax]="10" class="full mt" />
        <input nz-input [(ngModel)]="pointReason" placeholder="Lý do" class="mt" />
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .links { display: flex; gap: 8px; flex-wrap: wrap; }
    .bulk-actions { display: flex; gap: 8px; align-items: center; margin: 12px 0; flex-wrap: wrap; }
    .counter { margin-left: auto; }
    .full { width: 100%; }
    .mt { margin-top: 8px; }
    .points { display: flex; flex-direction: column; gap: 6px; }
    .bal { display: flex; align-items: center; gap: 6px; }
    .quick { display: flex; flex-wrap: wrap; gap: 4px; }
    .quick .chip { font-size: 11px; padding: 0 8px; height: 22px; line-height: 20px; }
    .quick .chip.reward { color: #16a34a; border-color: #16a34a; }
    .presets { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
    .save-bar { position: sticky; bottom: 0; background: var(--hs-surface); padding: 12px 0; margin-top: 12px; border-top: 1px solid var(--hs-border); text-align: right; }
    .muted { color: var(--hs-text-muted); }
    .mobile-card-list { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .card-title { font-weight: 600; font-size: 15px; }
    .card-field-block { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
    .card-field-block .field-label { font-size: 12px; color: var(--hs-text-muted); font-weight: 500; }
    .card-actions { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
  `
})
export class SessionPage implements OnInit {
  readonly id = input.required<string>();

  protected readonly AttendanceStatus = AttendanceStatus;
  protected readonly HomeworkStatus = HomeworkStatus;
  protected readonly AttitudeStatus = AttitudeStatus;
  protected readonly PointType = PointType;
  protected readonly homeworkLabels = HOMEWORK_LABELS;
  protected readonly attitudeLabels = ATTITUDE_LABELS;

  protected readonly screen = inject(ScreenService);
  private readonly sessionsService = inject(SessionsService);
  private readonly settingsService = inject(SettingsService);
  private readonly message = inject(NzMessageService);

  protected readonly sheet = signal<SessionSheet | null>(null);
  protected readonly rows = signal<SessionStudentRow[]>([]);
  protected readonly saving = signal(false);

  // Lý do cộng/trừ điểm cấu hình sẵn (Settings) → nút bấm nhanh 1 chạm.
  protected readonly rewardReasons = signal<PointReason[]>(DEFAULT_REWARD_REASONS);
  protected readonly penaltyReasons = signal<PointReason[]>(DEFAULT_PENALTY_REASONS);
  // Là method (không phải computed) để cập nhật ngay khi sửa từng dòng (row được mutate tại chỗ).
  protected presentCount(): number {
    return this.rows().filter(r => r.attendance === AttendanceStatus.Present || r.attendance === AttendanceStatus.Late).length;
  }

  protected readonly pointOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly pointTarget = signal<SessionStudentRow | null>(null);
  protected readonly pointType = signal<PointType>(PointType.Reward);
  protected pointValue = 1;
  protected pointReason = '';

  protected readonly presets = computed(() =>
    (this.pointType() === PointType.Reward ? this.rewardReasons() : this.penaltyReasons()).map(r => r.label));

  ngOnInit(): void {
    this.reload();
    this.loadReasons();
  }

  private loadReasons(): void {
    this.settingsService.getEffective().subscribe(s => {
      const reward = parseReasons(s.values['Points.RewardReasons']);
      const penalty = parseReasons(s.values['Points.PenaltyReasons']);
      if (reward.length) this.rewardReasons.set(reward);
      if (penalty.length) this.penaltyReasons.set(penalty);
    });
  }

  /** Cộng/trừ điểm 1 chạm theo lý do cấu hình sẵn (cập nhật số dư cục bộ, không mất chỉnh sửa điểm danh chưa lưu). */
  protected quickAdd(row: SessionStudentRow, type: PointType, r: PointReason): void {
    this.sessionsService.addPoint(this.id(), { studentId: row.studentId, type, points: r.points, reason: r.label }).subscribe({
      next: entry => {
        const delta = entry.type === PointType.Reward ? entry.points : -entry.points;
        this.rows.set(this.rows().map(x => x.studentId === row.studentId
          ? { ...x, rewardBalance: x.rewardBalance + delta, points: [...x.points, entry] }
          : x));
        this.message.success(`${type === PointType.Reward ? '+' : '−'}${r.points} ${r.label}`);
      },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ??'Ghi điểm thất bại.')
    });
  }

  private reload(): void {
    this.sessionsService.getSheet(this.id()).subscribe({
      next: s => { this.sheet.set(s); this.rows.set(s.rows.map(r => ({ ...r }))); }
    });
  }

  protected markAllPresent(): void {
    this.rows.set(this.rows().map(r => ({ ...r, attendance: AttendanceStatus.Present })));
  }

  protected markAllHomework(): void {
    this.rows.set(this.rows().map(r => ({ ...r, homework: HomeworkStatus.Completed })));
  }

  protected saveAll(): void {
    const entries: SaveAttendanceRow[] = this.rows().map(r => ({
      studentId: r.studentId, attendance: r.attendance, homework: r.homework,
      attitude: r.attitude, personalNote: r.personalNote
    }));
    this.saving.set(true);
    this.sessionsService.saveAttendance(this.id(), entries).subscribe({
      next: () => { this.saving.set(false); this.message.success('Đã lưu buổi học.'); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message ??'Lưu thất bại.'); }
    });
  }

  protected openPoint(row: SessionStudentRow, type: PointType): void {
    this.pointTarget.set(row);
    this.pointType.set(type);
    this.pointValue = 1;
    this.pointReason = '';
    this.pointOpen.set(true);
  }

  protected addPoint(): void {
    const target = this.pointTarget();
    if (!target) return;
    if (!this.pointReason.trim()) { this.message.warning('Nhập lý do.'); return; }
    this.busy.set(true);
    this.sessionsService.addPoint(this.id(), {
      studentId: target.studentId, type: this.pointType(), points: this.pointValue, reason: this.pointReason.trim()
    }).subscribe({
      next: entry => {
        this.busy.set(false);
        this.pointOpen.set(false);
        this.message.success('Đã ghi điểm.');
        // Cập nhật cục bộ để không mất các chỉnh sửa điểm danh chưa lưu.
        const delta = entry.type === PointType.Reward ? entry.points : -entry.points;
        this.rows.set(this.rows().map(r => r.studentId === target.studentId
          ? { ...r, rewardBalance: r.rewardBalance + delta, points: [...r.points, entry] }
          : r));
      },
      error: (err: HttpErrorResponse) => { this.busy.set(false); this.message.error(err.error?.message ?? err.message ??'Ghi điểm thất bại.'); }
    });
  }
}

const DEFAULT_REWARD_REASONS: PointReason[] = [
  { label: 'Trả lời đúng', points: 1 },
  { label: 'Hoạt động nhóm', points: 1 },
  { label: 'Thành tích xuất sắc', points: 2 }
];
const DEFAULT_PENALTY_REASONS: PointReason[] = [
  { label: 'Nói chuyện riêng', points: 1 },
  { label: 'Không làm bài', points: 1 },
  { label: 'Vi phạm nội quy', points: 2 }
];

/** Phân tích cấu hình lý do: mỗi dòng "Nhãn=điểm" (thiếu điểm ⇒ mặc định 1). */
function parseReasons(raw: string | undefined): PointReason[] {
  if (!raw) return [];
  return raw.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const idx = line.lastIndexOf('=');
      if (idx < 0) return { label: line, points: 1 };
      const label = line.slice(0, idx).trim();
      const points = parseInt(line.slice(idx + 1).trim(), 10);
      return { label: label || line, points: Number.isFinite(points) && points > 0 ? points : 1 };
    })
    .filter(r => r.label.length > 0);
}
