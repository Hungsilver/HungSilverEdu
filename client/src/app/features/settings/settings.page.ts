import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
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
import { FileStorageMode, PointReason, PointReasonRequest, PointReasonType, SettingScope, UpsertSettingRequest } from '../../core/models';
import { PointReasonsService } from '../../core/point-reasons.service';
import { SettingsService } from '../../core/settings.service';
import { PageHeader } from '../../shared/page-header';

const KEY_FILE_MODE = 'FileStorage.Mode';
const KEY_DUE_SOON = 'Tuition.DueSoonDays';
const KEY_SCORE_DROP = 'Warning.ScoreDropThreshold';

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
  styles: `.field { width: 100%; max-width: 360px; }`
})
export class SettingsPage implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly pointReasonsService = inject(PointReasonsService);
  private readonly message = inject(NzMessageService);

  protected readonly FileStorageMode = FileStorageMode;
  protected readonly PointReasonType = PointReasonType;
  protected readonly saving = signal(false);

  protected fileMode: FileStorageMode = FileStorageMode.ExternalUrl;
  protected dueSoonDays = 7;
  protected scoreDrop = 1.5;

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
    });
    this.loadReasons();
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
