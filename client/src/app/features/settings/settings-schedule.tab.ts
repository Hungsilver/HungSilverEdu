import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTimePickerModule } from 'ng-zorro-antd/time-picker';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { Branch, SETTING_KEYS, SettingScope, UpsertSettingRequest } from '../../core/models';
import { BranchesService } from '../../core/branches.service';
import { SettingsService } from '../../core/settings.service';

/** Một dòng "Ca" trong trình soạn khung Ca. Giờ giữ dạng "HH:mm" để khớp JSON server. */
interface BandRow { name: string; from: string; to: string; }

/**
 * Khung Ca học: khung mặc định toàn trung tâm + override riêng cho từng cơ sở.
 * Lưu JSON vào một khóa duy nhất <c>Schedule.Shifts</c>; buổi học xếp Ca theo giờ bắt đầu.
 */
@Component({
  selector: 'app-settings-schedule-tab',
  imports: [
    FormsModule, NzCardModule, NzFormModule, NzInputModule, NzSelectModule, NzButtonModule,
    NzIconModule, NzTableModule, NzTimePickerModule, NzTooltipModule, NzAlertModule
  ],
  template: `
    <nz-card class="cfg-card">
      <div class="head">
        <div>
          <div class="head-title">Khung Ca học</div>
          <div class="head-sub">Buổi học tự xếp vào Ca theo giờ bắt đầu.</div>
        </div>
        <nz-select [ngModel]="scope()" (ngModelChange)="scope.set($event)" style="min-width:230px">
          <nz-option nzValue="default" nzLabel="Khung mặc định (toàn trung tâm)" />
          @for (b of branches(); track b.id) {
            <nz-option [nzValue]="b.id" [nzLabel]="'Riêng cơ sở: ' + b.name" />
          }
        </nz-select>
      </div>

      @if (scope() !== 'default' && bands().length === 0) {
        <nz-alert
          nzType="info"
          nzMessage="Cơ sở này chưa có khung riêng — đang dùng khung mặc định."
          nzDescription="Thêm ca ở đây để đặt khung riêng; xóa hết ca sẽ quay lại dùng khung mặc định."
          style="margin-bottom:14px" />
      }

      <nz-table [nzData]="bands()" nzSize="small" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>Tên ca</th>
            <th style="width:150px">Bắt đầu</th>
            <th style="width:150px">Kết thúc</th>
            <th style="width:56px"></th>
          </tr>
        </thead>
        <tbody>
          @for (row of bands(); track $index) {
            <tr>
              <td>
                <input nz-input [ngModel]="row.name" (ngModelChange)="patch($index, { name: $event })" placeholder="vd: Ca 1 sáng" />
              </td>
              <td>
                <nz-time-picker
                  [ngModel]="toDate(row.from)" (ngModelChange)="patch($index, { from: toHhmm($event) })"
                  nzFormat="HH:mm" [nzMinuteStep]="5" [nzAllowEmpty]="false" style="width:100%" />
              </td>
              <td>
                <nz-time-picker
                  [ngModel]="toDate(row.to)" (ngModelChange)="patch($index, { to: toHhmm($event) })"
                  nzFormat="HH:mm" [nzMinuteStep]="5" [nzAllowEmpty]="false" style="width:100%" />
              </td>
              <td>
                <button nz-button nzType="text" nzSize="small" nzDanger nz-tooltip="Xóa ca" (click)="removeBand($index)">
                  <nz-icon nzType="delete" />
                </button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="4" class="empty">Chưa có ca nào.</td></tr>
          }
        </tbody>
      </nz-table>

      <div class="cfg-actions">
        <button nz-button (click)="addBand()"><nz-icon nzType="plus" /> Thêm ca</button>
        <button nz-button nzType="primary" [nzLoading]="saving()" (click)="save()">Lưu khung ca</button>
      </div>
    </nz-card>
  `,
  styles: `
    .cfg-card { max-width: 760px; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
    .head-title { font-weight: 700; font-size: 15px; }
    .head-sub { font-size: 12.5px; color: var(--hs-text-muted); }
    .empty { text-align: center; color: var(--hs-text-muted); padding: 18px 0; }
    .cfg-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
    @media (max-width: 575px) { .head nz-select { width: 100%; } }
  `
})
export class SettingsScheduleTab implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly branchesService = inject(BranchesService);
  private readonly message = inject(NzMessageService);

  protected readonly saving = signal(false);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly scope = signal<string>('default');
  private readonly defaultBands = signal<BandRow[]>([]);
  private readonly byBranch = signal<Record<string, BandRow[]>>({});

  protected readonly bands = computed<BandRow[]>(() => {
    const s = this.scope();
    return s === 'default' ? this.defaultBands() : (this.byBranch()[s] ?? []);
  });

  ngOnInit(): void {
    this.branchesService.getAll(true).subscribe(x => this.branches.set(x));
    this.settingsService.getEffective().subscribe(res => this.loadShifts(res.values[SETTING_KEYS.scheduleShifts]));
  }

  private loadShifts(raw: string | undefined): void {
    if (!raw) return;
    try {
      const cfg = JSON.parse(raw) as { default?: BandRow[]; byBranch?: Record<string, BandRow[]> };
      const toRows = (arr?: BandRow[]) => (arr ?? []).map(d => ({ name: d.name ?? '', from: d.from ?? '', to: d.to ?? '' }));
      this.defaultBands.set(toRows(cfg.default));
      const map: Record<string, BandRow[]> = {};
      for (const [bid, arr] of Object.entries(cfg.byBranch ?? {})) map[bid] = toRows(arr);
      this.byBranch.set(map);
    } catch {
      // JSON hỏng ⇒ giữ trống; server vẫn fallback về khung mặc định nên lịch không vỡ.
    }
  }

  private setBands(rows: BandRow[]): void {
    const s = this.scope();
    if (s === 'default') this.defaultBands.set(rows);
    else this.byBranch.update(m => ({ ...m, [s]: rows }));
  }

  protected patch(index: number, change: Partial<BandRow>): void {
    this.setBands(this.bands().map((r, i) => i === index ? { ...r, ...change } : r));
  }

  protected addBand(): void {
    this.setBands([...this.bands(), { name: '', from: '', to: '' }]);
  }

  protected removeBand(index: number): void {
    this.setBands(this.bands().filter((_, i) => i !== index));
  }

  /** "HH:mm" ⇄ Date cho nz-time-picker (ngày không dùng đến, chỉ lấy giờ/phút). */
  protected toDate(hhmm: string): Date | null {
    if (!/^\d{1,2}:\d{2}$/.test(hhmm ?? '')) return null;
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(2000, 0, 1, h, m, 0, 0);
    return d;
  }

  protected toHhmm(value: Date | null): string {
    if (!value) return '';
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }

  protected save(): void {
    const cfg = this.build();
    if (cfg === null) return;

    const req: UpsertSettingRequest = {
      key: SETTING_KEYS.scheduleShifts,
      value: JSON.stringify(cfg),
      scope: SettingScope.System,
      scopeId: null,
      dataType: 'Json',
      description: 'Khung Ca học (mặc định + theo cơ sở)'
    };
    this.saving.set(true);
    this.settingsService.upsert(req).subscribe({
      next: () => { this.saving.set(false); this.message.success('Đã lưu khung ca học.'); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message); }
    });
  }

  /** Chuẩn hóa + kiểm tra; trả null nếu có lỗi (đã hiện message). Bỏ dòng trống, bỏ cơ sở không có ca. */
  private build(): { default: BandRow[]; byBranch: Record<string, BandRow[]> } | null {
    const toBands = (rows: BandRow[], label: string): BandRow[] | null => {
      const out: BandRow[] = [];
      for (const r of rows) {
        const name = (r.name ?? '').trim();
        const from = (r.from ?? '').trim();
        const to = (r.to ?? '').trim();
        if (!name && !from && !to) continue;
        if (!name) { this.message.error(`[${label}] Ca chưa có tên.`); return null; }
        if (!from || !to) { this.message.error(`[${label}] Ca "${name}" thiếu giờ bắt đầu hoặc kết thúc.`); return null; }
        if (to <= from) { this.message.error(`[${label}] Ca "${name}": giờ kết thúc phải sau giờ bắt đầu.`); return null; }
        out.push({ name, from, to });
      }
      return out;
    };

    const def = toBands(this.defaultBands(), 'Mặc định');
    if (def === null) return null;

    const byBranch: Record<string, BandRow[]> = {};
    const branchName = (id: string) => this.branches().find(b => b.id === id)?.name ?? 'Cơ sở';
    for (const [bid, rows] of Object.entries(this.byBranch())) {
      const bands = toBands(rows, branchName(bid));
      if (bands === null) return null;
      if (bands.length) byBranch[bid] = bands;
    }
    return { default: def, byBranch };
  }
}
