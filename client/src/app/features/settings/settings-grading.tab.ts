import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { PointReason, PointReasonRequest, PointReasonType, SETTING_KEYS, SettingScope, UpsertSettingRequest } from '../../core/models';
import { PointReasonsService } from '../../core/point-reasons.service';
import { SettingsService } from '../../core/settings.service';

/** Học phí &amp; cảnh báo + danh sách lý do cộng/trừ điểm dùng ở màn điểm danh buổi học. */
@Component({
  selector: 'app-settings-grading-tab',
  imports: [
    FormsModule, NzCardModule, NzFormModule, NzInputModule, NzInputNumberModule, NzButtonModule,
    NzIconModule, NzTableModule, NzTagModule, NzPopconfirmModule, NzTooltipModule
  ],
  template: `
    <div class="grid">
      <nz-card nzTitle="Học phí &amp; cảnh báo">
        <nz-form-item>
          <nz-form-label>Báo "sắp đến hạn" trước (ngày)</nz-form-label>
          <nz-form-control nzExtra="Hóa đơn còn trong khoảng này sẽ đổi trạng thái sang Sắp đến hạn.">
            <nz-input-number [(ngModel)]="dueSoonDays" [nzMin]="0" [nzMax]="365" [nzStep]="1" style="width:140px" />
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label>Ngưỡng cảnh báo điểm giảm mạnh</nz-form-label>
          <nz-form-control nzExtra="Điểm tháng này thấp hơn tháng trước quá ngưỡng sẽ sinh cảnh báo.">
            <nz-input-number [(ngModel)]="scoreDrop" [nzMin]="0" [nzMax]="10" [nzStep]="0.5" style="width:140px" />
          </nz-form-control>
        </nz-form-item>

        <div class="actions">
          <button nz-button nzType="primary" [nzLoading]="saving()" (click)="save()">Lưu</button>
        </div>
      </nz-card>

      <nz-card nzTitle="Lý do cộng điểm">
        <div class="row-form">
          <input nz-input placeholder="vd: Phát biểu tốt" [(ngModel)]="rewardLabel" (keyup.enter)="saveReason(PointReasonType.Reward)" />
          <nz-input-number [(ngModel)]="rewardPoints" [nzMin]="1" [nzMax]="10" style="width:92px" />
          <button nz-button nzType="primary" (click)="saveReason(PointReasonType.Reward)">
            {{ editingReward() ? 'Cập nhật' : 'Thêm' }}
          </button>
          @if (editingReward()) {
            <button nz-button (click)="resetReason(PointReasonType.Reward)">Hủy</button>
          }
        </div>
        <nz-table [nzData]="rewardReasons()" nzSize="small" [nzShowPagination]="false" [nzScroll]="{ y: '260px' }">
          <tbody>
            @for (r of rewardReasons(); track r.id) {
              <tr>
                <td>{{ r.label }}</td>
                <td style="width:70px"><nz-tag nzColor="success">+{{ r.points }}</nz-tag></td>
                <td class="row-actions">
                  <button nz-button nzType="text" nzSize="small" nz-tooltip="Sửa" (click)="editReason(r, PointReasonType.Reward)">
                    <nz-icon nzType="edit" />
                  </button>
                  <button nz-button nzType="text" nzSize="small" nzDanger nz-tooltip="Xóa"
                          nz-popconfirm nzPopconfirmTitle="Xóa lý do này?" (nzOnConfirm)="deleteReason(r.id)">
                    <nz-icon nzType="delete" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card nzTitle="Lý do trừ điểm">
        <div class="row-form">
          <input nz-input placeholder="vd: Không làm bài tập" [(ngModel)]="penaltyLabel" (keyup.enter)="saveReason(PointReasonType.Penalty)" />
          <nz-input-number [(ngModel)]="penaltyPoints" [nzMin]="1" [nzMax]="10" style="width:92px" />
          <button nz-button nzType="primary" (click)="saveReason(PointReasonType.Penalty)">
            {{ editingPenalty() ? 'Cập nhật' : 'Thêm' }}
          </button>
          @if (editingPenalty()) {
            <button nz-button (click)="resetReason(PointReasonType.Penalty)">Hủy</button>
          }
        </div>
        <nz-table [nzData]="penaltyReasons()" nzSize="small" [nzShowPagination]="false" [nzScroll]="{ y: '260px' }">
          <tbody>
            @for (r of penaltyReasons(); track r.id) {
              <tr>
                <td>{{ r.label }}</td>
                <td style="width:70px"><nz-tag nzColor="error">−{{ r.points }}</nz-tag></td>
                <td class="row-actions">
                  <button nz-button nzType="text" nzSize="small" nz-tooltip="Sửa" (click)="editReason(r, PointReasonType.Penalty)">
                    <nz-icon nzType="edit" />
                  </button>
                  <button nz-button nzType="text" nzSize="small" nzDanger nz-tooltip="Xóa"
                          nz-popconfirm nzPopconfirmTitle="Xóa lý do này?" (nzOnConfirm)="deleteReason(r.id)">
                    <nz-icon nzType="delete" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .row-form { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .row-form input[nz-input] { flex: 1; min-width: 150px; }
    .row-actions { text-align: right; white-space: nowrap; width: 96px; }
    .actions { display: flex; justify-content: flex-end; }
    @media (max-width: 575px) { .row-form { flex-direction: column; } .row-form input[nz-input] { width: 100%; } }
  `
})
export class SettingsGradingTab implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly pointReasonsService = inject(PointReasonsService);
  private readonly message = inject(NzMessageService);

  protected readonly PointReasonType = PointReasonType;
  protected readonly saving = signal(false);

  protected dueSoonDays = 7;
  protected scoreDrop = 1.5;

  protected readonly rewardReasons = signal<PointReason[]>([]);
  protected readonly penaltyReasons = signal<PointReason[]>([]);
  protected readonly editingReward = signal<PointReason | null>(null);
  protected readonly editingPenalty = signal<PointReason | null>(null);
  protected rewardLabel = '';
  protected rewardPoints = 1;
  protected penaltyLabel = '';
  protected penaltyPoints = 1;

  ngOnInit(): void {
    this.settingsService.getEffective().subscribe(res => {
      const v = res.values;
      if (v[SETTING_KEYS.tuitionDueSoonDays]) this.dueSoonDays = Number(v[SETTING_KEYS.tuitionDueSoonDays]);
      if (v[SETTING_KEYS.warningScoreDrop]) this.scoreDrop = Number(v[SETTING_KEYS.warningScoreDrop]);
    });
    this.loadReasons();
  }

  private loadReasons(): void {
    this.pointReasonsService.getAll().subscribe(all => {
      this.rewardReasons.set(all.filter(r => r.type === PointReasonType.Reward));
      this.penaltyReasons.set(all.filter(r => r.type === PointReasonType.Penalty));
    });
  }

  private fail = (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message);

  protected save(): void {
    const sys = (key: string, value: string): UpsertSettingRequest =>
      ({ key, value, scope: SettingScope.System, scopeId: null, dataType: null, description: null });

    this.saving.set(true);
    forkJoin([
      this.settingsService.upsert(sys(SETTING_KEYS.tuitionDueSoonDays, String(this.dueSoonDays))),
      this.settingsService.upsert(sys(SETTING_KEYS.warningScoreDrop, String(this.scoreDrop)))
    ]).subscribe({
      next: () => { this.saving.set(false); this.message.success('Đã lưu cấu hình học phí & cảnh báo.'); },
      error: err => { this.saving.set(false); this.fail(err); }
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
    const label = (isReward ? this.rewardLabel : this.penaltyLabel).trim();
    const points = isReward ? this.rewardPoints : this.penaltyPoints;
    if (!label) return;

    const editing = isReward ? this.editingReward() : this.editingPenalty();
    const req: PointReasonRequest = { label, points, type, indexOrder: editing?.indexOrder ?? 0, isActive: true };
    const op = editing
      ? this.pointReasonsService.update(editing.id, req)
      : this.pointReasonsService.create(req);

    op.subscribe({
      next: () => { this.resetReason(type); this.loadReasons(); this.message.success('Đã lưu.'); },
      error: this.fail
    });
  }

  protected deleteReason(id: string): void {
    this.pointReasonsService.delete(id).subscribe({
      next: () => { this.loadReasons(); this.message.success('Đã xóa.'); },
      error: this.fail
    });
  }
}
