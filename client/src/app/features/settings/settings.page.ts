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
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FileStorageMode, SettingScope, UpsertSettingRequest } from '../../core/models';
import { SettingsService } from '../../core/settings.service';
import { PageHeader } from '../../shared/page-header';

const KEY_FILE_MODE = 'FileStorage.Mode';
const KEY_DUE_SOON = 'Tuition.DueSoonDays';
const KEY_SCORE_DROP = 'Warning.ScoreDropThreshold';
const KEY_TIMEZONE = 'Center.TimeZone';
const KEY_REWARD_REASONS = 'Points.RewardReasons';
const KEY_PENALTY_REASONS = 'Points.PenaltyReasons';
const KEY_GRADE_BANDS = 'Class.GradeBands';

@Component({
  selector: 'app-settings-page',
  imports: [
    FormsModule, NzCardModule, NzFormModule, NzInputModule, NzInputNumberModule,
    NzSelectModule, NzButtonModule, NzIconModule, PageHeader
  ],
  template: `
    <app-page-header title="Cấu hình hệ thống" subtitle="Thiết lập phân tầng toàn hệ thống" icon="setting" />
    <nz-card>
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

        <nz-form-item>
          <nz-form-label>Múi giờ trung tâm</nz-form-label>
          <nz-form-control><input nz-input [(ngModel)]="timeZone" name="tz" class="field" placeholder="Asia/Ho_Chi_Minh" /></nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label>Danh sách Khối (mỗi dòng 1 khối — dùng cho lớp &amp; học liệu)</nz-form-label>
          <nz-form-control>
            <textarea nz-input [(ngModel)]="gradeBands" name="gb" rows="4" class="field"
              placeholder="Khối 6&#10;Khối 7&#10;Khối 8"></textarea>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label>Lý do cộng điểm (mỗi dòng: Nhãn=điểm)</nz-form-label>
          <nz-form-control>
            <textarea nz-input [(ngModel)]="rewardReasons" name="rr" rows="4" class="field"
              placeholder="Trả lời đúng=1&#10;Hoạt động nhóm=1&#10;Thành tích xuất sắc=2"></textarea>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label>Lý do trừ điểm (mỗi dòng: Nhãn=điểm)</nz-form-label>
          <nz-form-control>
            <textarea nz-input [(ngModel)]="penaltyReasons" name="pr" rows="4" class="field"
              placeholder="Nói chuyện riêng=1&#10;Không làm bài=1&#10;Vi phạm nội quy=2"></textarea>
          </nz-form-control>
        </nz-form-item>

        <button nz-button nzType="primary" [nzLoading]="saving()" (click)="save()"><nz-icon nzType="save" /> Lưu cấu hình</button>
      </form>
    </nz-card>
  `,
  styles: `.field { width: 100%; max-width: 360px; }`
})
export class SettingsPage implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly message = inject(NzMessageService);

  protected readonly FileStorageMode = FileStorageMode;
  protected readonly saving = signal(false);

  protected fileMode: FileStorageMode = FileStorageMode.ExternalUrl;
  protected dueSoonDays = 7;
  protected scoreDrop = 1.5;
  protected timeZone = 'Asia/Ho_Chi_Minh';
  protected rewardReasons = '';
  protected penaltyReasons = '';
  protected gradeBands = '';

  ngOnInit(): void {
    this.settingsService.getEffective().subscribe(res => {
      const v = res.values;
      if (v[KEY_FILE_MODE]) this.fileMode = v[KEY_FILE_MODE] as FileStorageMode;
      if (v[KEY_DUE_SOON]) this.dueSoonDays = Number(v[KEY_DUE_SOON]);
      if (v[KEY_SCORE_DROP]) this.scoreDrop = Number(v[KEY_SCORE_DROP]);
      if (v[KEY_TIMEZONE]) this.timeZone = v[KEY_TIMEZONE];
      if (v[KEY_REWARD_REASONS]) this.rewardReasons = v[KEY_REWARD_REASONS];
      if (v[KEY_PENALTY_REASONS]) this.penaltyReasons = v[KEY_PENALTY_REASONS];
      if (v[KEY_GRADE_BANDS]) this.gradeBands = v[KEY_GRADE_BANDS];
    });
  }

  protected save(): void {
    const sys = (key: string, value: string): UpsertSettingRequest =>
      ({ key, value, scope: SettingScope.System, scopeId: null, dataType: null, description: null });

    this.saving.set(true);
    forkJoin([
      this.settingsService.upsert(sys(KEY_FILE_MODE, this.fileMode)),
      this.settingsService.upsert(sys(KEY_DUE_SOON, String(this.dueSoonDays))),
      this.settingsService.upsert(sys(KEY_SCORE_DROP, String(this.scoreDrop))),
      this.settingsService.upsert(sys(KEY_TIMEZONE, this.timeZone)),
      this.settingsService.upsert(sys(KEY_REWARD_REASONS, this.rewardReasons)),
      this.settingsService.upsert(sys(KEY_PENALTY_REASONS, this.penaltyReasons)),
      this.settingsService.upsert(sys(KEY_GRADE_BANDS, this.gradeBands))
    ]).subscribe({
      next: () => { this.saving.set(false); this.message.success('Đã lưu cấu hình.'); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message); }
    });
  }
}
