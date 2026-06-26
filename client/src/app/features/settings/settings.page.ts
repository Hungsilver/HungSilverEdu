import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { Branch, BranchRequest, FileStorageMode, PointReason, PointReasonRequest, PointReasonType, SettingScope, UpsertSettingRequest } from '../../core/models';
import { BranchesService } from '../../core/branches.service';
import { PointReasonsService } from '../../core/point-reasons.service';
import { SettingsService } from '../../core/settings.service';
import { PageHeader } from '../../shared/page-header';

const KEY_FILE_MODE = 'FileStorage.Mode';
const KEY_DUE_SOON = 'Tuition.DueSoonDays';
const KEY_SCORE_DROP = 'Warning.ScoreDropThreshold';
const KEY_ACC_PWD = 'Account.DefaultPassword';
const KEY_ACC_DOMAIN = 'Account.LocalEmailDomain';
const KEY_SHIFTS = 'Schedule.Shifts';

/** Một dòng "Ca" trong trình soạn khung Ca (tên + giờ bắt đầu/kết thúc dạng "HH:mm"). */
interface BandRow { name: string; from: string; to: string; }

@Component({
  selector: 'app-settings-page',
  imports: [
    FormsModule, NzCardModule, NzFormModule, NzInputModule, NzInputNumberModule,
    NzSelectModule, NzButtonModule, NzIconModule, NzTableModule, NzTagModule,
    NzDividerModule, NzPopconfirmModule, NzTooltipModule, PageHeader
  ],
  template: `
    <app-page-header title="Cấu hình hệ thống" subtitle="Thiết lập phân tầng toàn hệ thống" icon="setting" />

    <!-- Cài đặt chung -->
    <nz-card nzTitle="Cài đặt chung" style="margin-bottom:16px">
      <form nz-form nzLayout="vertical">
        <nz-form-item>
          <nz-form-label>Chế độ lưu file</nz-form-label>
          <nz-form-control>
            <nz-select [(ngModel)]="fileMode" name="fm" class="field">
              <nz-option [nzValue]="FileStorageMode.ExternalUrl" nzLabel="Chỉ lưu link/URL ngoài" />
              <nz-option [nzValue]="FileStorageMode.Server" nzLabel="Upload trực tiếp lên server" />
            </nz-select>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label>Học phí "sắp đến hạn" trước (ngày)</nz-form-label>
          <nz-form-control><nz-input-number [(ngModel)]="dueSoonDays" name="ds" [nzMin]="1" class="field" /></nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label>Ngưỡng cảnh báo điểm giảm mạnh</nz-form-label>
          <nz-form-control><nz-input-number [(ngModel)]="scoreDrop" name="sd" [nzMin]="0" [nzStep]="0.5" class="field" /></nz-form-control>
        </nz-form-item>

        <button nz-button nzType="primary" [nzLoading]="saving()" (click)="save()">
          <nz-icon nzType="save" /> Lưu cấu hình
        </button>
      </form>
    </nz-card>

    <!-- Tài khoản đăng nhập (HS & GV) -->
    <nz-card nzTitle="Tài khoản đăng nhập" style="margin-bottom:16px">
      <p class="hint">
        Khi cấp/đặt lại tài khoản cho học sinh, giáo viên: tên đăng nhập là <b>mã</b> của họ;
        mật khẩu khởi tạo dùng giá trị dưới đây và <b>buộc đổi ở lần đăng nhập đầu</b>.
      </p>
      <form nz-form nzLayout="vertical">
        <nz-form-item>
          <nz-form-label>Mật khẩu mặc định khi cấp tài khoản</nz-form-label>
          <nz-form-control nzExtra="≥ 8 ký tự, có chữ hoa, chữ thường và số.">
            <input nz-input [(ngModel)]="accDefaultPassword" name="adp" class="field" placeholder="vd: Hocvien@123" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label>Tên miền email ảo</nz-form-label>
          <nz-form-control nzExtra="Dùng cho tài khoản không có email thật (Identity yêu cầu email duy nhất).">
            <input nz-input [(ngModel)]="accEmailDomain" name="aed" class="field" placeholder="vd: hs.local" />
          </nz-form-control>
        </nz-form-item>
        <button nz-button nzType="primary" [nzLoading]="savingAccount()" (click)="saveAccount()">
          <nz-icon nzType="save" /> Lưu cấu hình tài khoản
        </button>
      </form>
    </nz-card>

    <!-- Tiền tố mã giáo viên theo cơ sở -->
    <nz-card nzTitle="Tiền tố mã giáo viên theo cơ sở" style="margin-bottom:16px">
      <p class="hint">
        Để trống → tự lấy theo tên cơ sở (vd "Đông Thọ" → <code>DongTho&#64;</code>); mã GV sẽ là
        <code>DongTho&#64;TrangNTT0</code>. Prefix tự mang dấu phân tách của nó (vd <code>&#64;</code>, <code>-</code>).
      </p>
      <nz-table [nzData]="branches()" [nzShowPagination]="false" nzSize="small">
        <thead><tr><th>Cơ sở</th><th style="width:300px">Tiền tố mã GV</th><th style="width:90px">Thao tác</th></tr></thead>
        <tbody>
          @for (b of branches(); track b.id) {
            <tr>
              <td>{{ b.name }}</td>
              <td><input nz-input [(ngModel)]="b.teacherCodePrefix" [name]="'pfx-' + b.id"
                [placeholder]="'Mặc định: ' + defaultPrefix(b.name)" /></td>
              <td>
                <button nz-button nzType="link" nzSize="small" [nzLoading]="savingBranchId() === b.id"
                  (click)="saveBranchPrefix(b)"><nz-icon nzType="save" /> Lưu</button>
              </td>
            </tr>
          }
          @if (branches().length === 0) {
            <tr><td colspan="3" class="empty">Chưa có cơ sở nào.</td></tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <!-- Khung Ca học (nhóm lịch theo Ca) -->
    <nz-card nzTitle="Khung Ca học" style="margin-bottom:16px">
      <p class="hint">
        Định nghĩa các "Ca" theo giờ. Mỗi buổi học tự rơi vào Ca có khoảng <code>[bắt đầu, kết thúc)</code> chứa giờ vào lớp,
        dùng để nhóm trang Lịch học theo <b>Cơ sở → Ca</b>. Áp khung <b>Mặc định</b> cho mọi cơ sở; có thể tùy chỉnh riêng từng cơ sở.
      </p>
      <nz-form-item>
        <nz-form-label>Áp dụng cho</nz-form-label>
        <nz-form-control>
          <nz-select [ngModel]="shiftScope()" (ngModelChange)="shiftScope.set($event)" name="ssc" class="field">
            <nz-option nzValue="default" nzLabel="Mặc định (mọi cơ sở)" />
            @for (b of branches(); track b.id) { <nz-option [nzValue]="b.id" [nzLabel]="b.name" /> }
          </nz-select>
        </nz-form-control>
      </nz-form-item>
      @if (shiftScope() !== 'default') {
        <p class="hint">Để bảng trống = cơ sở này dùng khung <b>Mặc định</b>.</p>
      }
      <nz-table [nzData]="currentBands()" [nzShowPagination]="false" nzSize="small">
        <thead><tr><th>Tên Ca</th><th style="width:130px">Bắt đầu</th><th style="width:130px">Kết thúc</th><th style="width:70px"></th></tr></thead>
        <tbody>
          @for (row of currentBands(); track $index) {
            <tr>
              <td><input nz-input [(ngModel)]="row.name" [name]="'sn' + $index" placeholder="VD: Ca 1 sáng" /></td>
              <td><input nz-input [(ngModel)]="row.from" [name]="'sf' + $index" placeholder="07:00" /></td>
              <td><input nz-input [(ngModel)]="row.to" [name]="'st' + $index" placeholder="09:00" /></td>
              <td>
                <button nz-button nzType="link" nzDanger nzSize="small" aria-label="Xóa Ca"
                  (click)="removeBand($index)"><nz-icon nzType="delete" /></button>
              </td>
            </tr>
          }
          @if (currentBands().length === 0) {
            <tr><td colspan="4" class="empty">Chưa có Ca nào.</td></tr>
          }
        </tbody>
      </nz-table>
      <div style="margin-top:12px; display:flex; gap:8px">
        <button nz-button (click)="addBand()"><nz-icon nzType="plus" /> Thêm Ca</button>
        <button nz-button nzType="primary" [nzLoading]="savingShifts()" (click)="saveShifts()">
          <nz-icon nzType="save" /> Lưu khung Ca
        </button>
      </div>
    </nz-card>

    <!-- Lý do cộng điểm -->
    <nz-card nzTitle="Lý do cộng điểm" style="margin-bottom:16px">
      <form nz-form nzLayout="inline" style="margin-bottom:12px" (ngSubmit)="saveReason(PointReasonType.Reward)">
        <nz-form-item>
          <nz-form-control>
            <input nz-input [(ngModel)]="rewardLabel" name="rl" placeholder="Nhãn lý do" style="width:200px" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-control>
            <nz-input-number [(ngModel)]="rewardPoints" name="rp" [nzMin]="1" [nzMax]="10" style="width:80px" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <button nz-button nzType="primary" [disabled]="!rewardLabel.trim()" type="submit">
            <nz-icon [nzType]="editingReward() ? 'save' : 'plus'" />
            {{ editingReward() ? 'Cập nhật' : 'Thêm' }}
          </button>
          @if (editingReward()) {
            <button nz-button type="button" style="margin-left:8px" (click)="resetReason(PointReasonType.Reward)">Hủy</button>
          }
        </nz-form-item>
      </form>
      <nz-table [nzData]="rewardReasons()" [nzShowPagination]="false" nzSize="small">
        <thead><tr><th>Nhãn</th><th style="width:80px">Điểm</th><th style="width:100px">Thao tác</th></tr></thead>
        <tbody>
          @for (r of rewardReasons(); track r.id) {
            <tr>
              <td>{{ r.label }}</td>
              <td><nz-tag nzColor="success">+{{ r.points }}</nz-tag></td>
              <td>
                <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Sửa lý do" aria-label="Sửa lý do" (click)="editReason(r, PointReasonType.Reward)"><nz-icon nzType="edit" /></button>
                <button nz-button nzType="link" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa lý do" aria-label="Xóa lý do" nz-popconfirm
                  nzPopconfirmTitle="Xóa lý do này?" (nzOnConfirm)="deleteReason(r.id, PointReasonType.Reward)"><nz-icon nzType="delete" /></button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <!-- Lý do trừ điểm -->
    <nz-card nzTitle="Lý do trừ điểm">
      <form nz-form nzLayout="inline" style="margin-bottom:12px" (ngSubmit)="saveReason(PointReasonType.Penalty)">
        <nz-form-item>
          <nz-form-control>
            <input nz-input [(ngModel)]="penaltyLabel" name="pl" placeholder="Nhãn lý do" style="width:200px" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-control>
            <nz-input-number [(ngModel)]="penaltyPoints" name="pp" [nzMin]="1" [nzMax]="10" style="width:80px" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <button nz-button nzType="primary" [disabled]="!penaltyLabel.trim()" type="submit">
            <nz-icon [nzType]="editingPenalty() ? 'save' : 'plus'" />
            {{ editingPenalty() ? 'Cập nhật' : 'Thêm' }}
          </button>
          @if (editingPenalty()) {
            <button nz-button type="button" style="margin-left:8px" (click)="resetReason(PointReasonType.Penalty)">Hủy</button>
          }
        </nz-form-item>
      </form>
      <nz-table [nzData]="penaltyReasons()" [nzShowPagination]="false" nzSize="small">
        <thead><tr><th>Nhãn</th><th style="width:80px">Điểm</th><th style="width:100px">Thao tác</th></tr></thead>
        <tbody>
          @for (r of penaltyReasons(); track r.id) {
            <tr>
              <td>{{ r.label }}</td>
              <td><nz-tag nzColor="error">−{{ r.points }}</nz-tag></td>
              <td>
                <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Sửa lý do" aria-label="Sửa lý do" (click)="editReason(r, PointReasonType.Penalty)"><nz-icon nzType="edit" /></button>
                <button nz-button nzType="link" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa lý do" aria-label="Xóa lý do" nz-popconfirm
                  nzPopconfirmTitle="Xóa lý do này?" (nzOnConfirm)="deleteReason(r.id, PointReasonType.Penalty)"><nz-icon nzType="delete" /></button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
  styles: `
    .field { width: 100%; max-width: 360px; }
    .hint { color: var(--hs-text-muted); margin-bottom: 12px; }
    .hint code { background: var(--hs-fill, rgba(0,0,0,.04)); padding: 1px 5px; border-radius: 4px; }
    .empty { text-align: center; color: var(--hs-text-muted); }
  `
})
export class SettingsPage implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly pointReasonsService = inject(PointReasonsService);
  private readonly branchesService = inject(BranchesService);
  private readonly message = inject(NzMessageService);

  protected readonly FileStorageMode = FileStorageMode;
  protected readonly PointReasonType = PointReasonType;
  protected readonly saving = signal(false);

  // Tiền tố mã GV theo cơ sở
  protected readonly branches = signal<Branch[]>([]);
  protected readonly savingBranchId = signal<string | null>(null);

  // Khung Ca học: khung mặc định + override theo cơ sở.
  protected readonly savingShifts = signal(false);
  protected readonly shiftScope = signal<string>('default');
  protected readonly shiftDefault = signal<BandRow[]>([]);
  protected readonly shiftByBranch = signal<Record<string, BandRow[]>>({});
  protected readonly currentBands = computed<BandRow[]>(() => {
    const scope = this.shiftScope();
    return scope === 'default' ? this.shiftDefault() : (this.shiftByBranch()[scope] ?? []);
  });

  protected fileMode: FileStorageMode = FileStorageMode.ExternalUrl;
  protected dueSoonDays = 7;
  protected scoreDrop = 1.5;

  // Cấu hình tài khoản
  protected readonly savingAccount = signal(false);
  protected accDefaultPassword = 'Hocvien@123';
  protected accEmailDomain = 'hs.local';

  // Reward CRUD state
  protected readonly rewardReasons = signal<PointReason[]>([]);
  protected readonly editingReward = signal<PointReason | null>(null);
  protected rewardLabel = '';
  protected rewardPoints = 1;

  // Penalty CRUD state
  protected readonly penaltyReasons = signal<PointReason[]>([]);
  protected readonly editingPenalty = signal<PointReason | null>(null);
  protected penaltyLabel = '';
  protected penaltyPoints = 1;

  ngOnInit(): void {
    this.settingsService.getEffective().subscribe(res => {
      const v = res.values;
      if (v[KEY_FILE_MODE]) this.fileMode = v[KEY_FILE_MODE] as FileStorageMode;
      if (v[KEY_DUE_SOON]) this.dueSoonDays = Number(v[KEY_DUE_SOON]);
      if (v[KEY_SCORE_DROP]) this.scoreDrop = Number(v[KEY_SCORE_DROP]);
      if (v[KEY_ACC_PWD]) this.accDefaultPassword = v[KEY_ACC_PWD];
      if (v[KEY_ACC_DOMAIN]) this.accEmailDomain = v[KEY_ACC_DOMAIN];
      this.loadShifts(v[KEY_SHIFTS]);
    });
    this.loadReasons();
    this.branchesService.getAll(true).subscribe(x => this.branches.set(x));
  }

  // ---- Khung Ca học ----

  private loadShifts(raw: string | undefined): void {
    if (!raw) return;
    try {
      const cfg = JSON.parse(raw) as { default?: BandRow[]; byBranch?: Record<string, BandRow[]> };
      const toRows = (arr?: BandRow[]) => (arr ?? []).map(d => ({ name: d.name ?? '', from: d.from ?? '', to: d.to ?? '' }));
      this.shiftDefault.set(toRows(cfg.default));
      const byBranch: Record<string, BandRow[]> = {};
      for (const [bid, arr] of Object.entries(cfg.byBranch ?? {})) byBranch[bid] = toRows(arr);
      this.shiftByBranch.set(byBranch);
    } catch {
      // JSON hỏng → bỏ qua, giữ trống (server vẫn fallback về mặc định).
    }
  }

  private setBands(rows: BandRow[]): void {
    const scope = this.shiftScope();
    if (scope === 'default') this.shiftDefault.set(rows);
    else this.shiftByBranch.update(m => ({ ...m, [scope]: rows }));
  }

  protected addBand(): void {
    this.setBands([...this.currentBands(), { name: '', from: '', to: '' }]);
  }

  protected removeBand(index: number): void {
    this.setBands(this.currentBands().filter((_, i) => i !== index));
  }

  protected saveShifts(): void {
    const norm = this.buildShiftsConfig();
    if (norm === null) return; // có lỗi định dạng, đã báo

    const req: UpsertSettingRequest = {
      key: KEY_SHIFTS, value: JSON.stringify(norm), scope: SettingScope.System, scopeId: null, dataType: 'Json', description: null
    };
    this.savingShifts.set(true);
    this.settingsService.upsert(req).subscribe({
      next: () => { this.savingShifts.set(false); this.message.success('Đã lưu khung Ca.'); },
      error: (err: HttpErrorResponse) => { this.savingShifts.set(false); this.message.error(err.error?.message ?? err.message); }
    });
  }

  /** Chuẩn hóa + kiểm tra các Ca; trả null nếu có lỗi (đã hiện message). Bỏ dòng trống. */
  private buildShiftsConfig(): { default: BandRow[]; byBranch: Record<string, BandRow[]> } | null {
    const timeRe = /^([01]?\d|2[0-3]):[0-5]\d$/;
    const toBands = (rows: BandRow[], scopeLabel: string): BandRow[] | null => {
      const out: BandRow[] = [];
      for (const r of rows) {
        const name = (r.name ?? '').trim();
        const from = (r.from ?? '').trim();
        const to = (r.to ?? '').trim();
        if (!name && !from && !to) continue; // dòng trống → bỏ
        if (!name) { this.message.error(`[${scopeLabel}] Ca thiếu tên.`); return null; }
        if (!timeRe.test(from) || !timeRe.test(to)) { this.message.error(`[${scopeLabel}] Giờ Ca "${name}" phải dạng HH:mm.`); return null; }
        const nf = normTime(from), nt = normTime(to);
        if (nt <= nf) { this.message.error(`[${scopeLabel}] Ca "${name}": giờ kết thúc phải sau giờ bắt đầu.`); return null; }
        out.push({ name, from: nf, to: nt });
      }
      return out;
    };

    const def = toBands(this.shiftDefault(), 'Mặc định');
    if (def === null) return null;

    const byBranch: Record<string, BandRow[]> = {};
    const branchName = (id: string) => this.branches().find(b => b.id === id)?.name ?? 'Cơ sở';
    for (const [bid, rows] of Object.entries(this.shiftByBranch())) {
      const bands = toBands(rows, branchName(bid));
      if (bands === null) return null;
      if (bands.length) byBranch[bid] = bands;
    }
    return { default: def, byBranch };
  }

  // Prefix mặc định theo tên cơ sở (PascalCase liền + "@") — đồng bộ NameCodeGenerator.PascalCompact ở BE.
  protected defaultPrefix(name: string): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    const pascal = parts.map(p => {
      const ascii = p.replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .normalize('NFD').replace(/[^A-Za-z0-9]/g, '');
      return ascii ? ascii[0].toUpperCase() + ascii.slice(1).toLowerCase() : '';
    }).join('');
    return pascal + '@';
  }

  protected saveBranchPrefix(b: Branch): void {
    this.savingBranchId.set(b.id);
    const req: BranchRequest = {
      code: b.code,
      name: b.name,
      address: b.address,
      phone: b.phone,
      teacherCodePrefix: b.teacherCodePrefix?.trim() || null,
      indexOrder: b.indexOrder,
      isActive: b.isActive
    };
    this.branchesService.update(b.id, req).subscribe({
      next: updated => {
        this.branches.update(list => list.map(x => x.id === updated.id ? updated : x));
        this.savingBranchId.set(null);
        this.message.success('Đã lưu tiền tố mã GV.');
      },
      error: (err: HttpErrorResponse) => { this.savingBranchId.set(null); this.message.error(err.error?.message ?? err.message); }
    });
  }

  private loadReasons(): void {
    this.pointReasonsService.getAll().subscribe(all => {
      this.rewardReasons.set(all.filter(r => r.type === PointReasonType.Reward));
      this.penaltyReasons.set(all.filter(r => r.type === PointReasonType.Penalty));
    });
  }

  protected save(): void {
    const sys = (key: string, value: string): UpsertSettingRequest =>
      ({ key, value, scope: SettingScope.System, scopeId: null, dataType: null, description: null });

    this.saving.set(true);
    forkJoin([
      this.settingsService.upsert(sys(KEY_FILE_MODE, this.fileMode)),
      this.settingsService.upsert(sys(KEY_DUE_SOON, String(this.dueSoonDays))),
      this.settingsService.upsert(sys(KEY_SCORE_DROP, String(this.scoreDrop)))
    ]).subscribe({
      next: () => { this.saving.set(false); this.message.success('Đã lưu cấu hình.'); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message); }
    });
  }

  protected saveAccount(): void {
    const pwd = this.accDefaultPassword?.trim() ?? '';
    const strong = pwd.length >= 8 && /[a-z]/.test(pwd) && /[A-Z]/.test(pwd) && /\d/.test(pwd);
    if (!strong) { this.message.error('Mật khẩu mặc định cần ≥ 8 ký tự, có chữ hoa, chữ thường và số.'); return; }
    const domain = this.accEmailDomain?.trim() ?? '';
    if (!domain || !/^[a-z0-9.-]+$/i.test(domain)) { this.message.error('Tên miền email không hợp lệ (vd: hs.local).'); return; }

    const sys = (key: string, value: string): UpsertSettingRequest =>
      ({ key, value, scope: SettingScope.System, scopeId: null, dataType: null, description: null });

    this.savingAccount.set(true);
    forkJoin([
      this.settingsService.upsert(sys(KEY_ACC_PWD, pwd)),
      this.settingsService.upsert(sys(KEY_ACC_DOMAIN, domain))
    ]).subscribe({
      next: () => { this.savingAccount.set(false); this.message.success('Đã lưu cấu hình tài khoản.'); },
      error: (err: HttpErrorResponse) => { this.savingAccount.set(false); this.message.error(err.error?.message ?? err.message); }
    });
  }

  protected editReason(r: PointReason, type: PointReasonType): void {
    if (type === PointReasonType.Reward) {
      this.editingReward.set(r);
      this.rewardLabel = r.label;
      this.rewardPoints = r.points;
    } else {
      this.editingPenalty.set(r);
      this.penaltyLabel = r.label;
      this.penaltyPoints = r.points;
    }
  }

  protected resetReason(type: PointReasonType): void {
    if (type === PointReasonType.Reward) {
      this.editingReward.set(null);
      this.rewardLabel = '';
      this.rewardPoints = 1;
    } else {
      this.editingPenalty.set(null);
      this.penaltyLabel = '';
      this.penaltyPoints = 1;
    }
  }

  protected saveReason(type: PointReasonType): void {
    const isReward = type === PointReasonType.Reward;
    const label = isReward ? this.rewardLabel.trim() : this.penaltyLabel.trim();
    const points = isReward ? this.rewardPoints : this.penaltyPoints;
    if (!label) return;

    const editing = isReward ? this.editingReward() : this.editingPenalty();
    const req: PointReasonRequest = { label, points, type, indexOrder: editing?.indexOrder ?? 0, isActive: true };
    const op = editing
      ? this.pointReasonsService.update(editing.id, req)
      : this.pointReasonsService.create(req);

    op.subscribe({
      next: () => { this.resetReason(type); this.loadReasons(); this.message.success('Đã lưu.'); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message)
    });
  }

  protected deleteReason(id: string, type: PointReasonType): void {
    this.pointReasonsService.delete(id).subscribe({
      next: () => { this.loadReasons(); this.message.success('Đã xóa.'); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message)
    });
  }
}

/** Chuẩn hóa "H:mm"/"HH:mm" → "HH:mm" (giờ 2 chữ số) để so sánh & lưu nhất quán. */
function normTime(value: string): string {
  const [h, m] = value.split(':');
  return `${h.padStart(2, '0')}:${m}`;
}
