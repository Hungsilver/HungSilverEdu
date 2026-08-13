import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { SETTING_KEYS, SettingScope, UpsertSettingRequest } from '../../core/models';
import { SettingsService } from '../../core/settings.service';

/**
 * Tài khoản & bảo mật: mật khẩu mặc định khi cấp tài khoản + cờ buộc đổi mật khẩu lần đầu.
 * "Tên miền email ảo" đã bỏ — tài khoản không có email thật thì để trống, đăng nhập bằng mã.
 */
@Component({
  selector: 'app-settings-account-tab',
  imports: [
    FormsModule, NzCardModule, NzFormModule, NzInputModule, NzButtonModule,
    NzIconModule, NzSwitchModule, NzAlertModule
  ],
  template: `
    <nz-card nzTitle="Tài khoản &amp; bảo mật" class="cfg-card">
      <nz-alert
        nzType="info"
        nzMessage="Áp dụng cho MỌI tài khoản mới: học viên, giáo viên và quản trị viên."
        nzDescription="Tên đăng nhập của học viên/giáo viên luôn là mã hồ sơ. Tài khoản không có email thật thì để trống email — hệ thống không sinh email ảo."
        style="margin-bottom:18px" />

      <nz-form-item>
        <nz-form-label>Mật khẩu mặc định khi cấp tài khoản</nz-form-label>
        <nz-form-control nzExtra="Tối thiểu 8 ký tự, có chữ hoa, chữ thường và số.">
          <nz-input-group [nzSuffix]="eye" style="max-width:360px">
            <input nz-input [type]="showPassword() ? 'text' : 'password'" [(ngModel)]="defaultPassword" />
          </nz-input-group>
          <ng-template #eye>
            <nz-icon
              [nzType]="showPassword() ? 'eye-invisible' : 'eye'"
              style="cursor:pointer"
              [title]="showPassword() ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
              (click)="showPassword.set(!showPassword())" />
          </ng-template>
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label>Bắt buộc đổi mật khẩu ở lần đăng nhập đầu</nz-form-label>
        <nz-form-control nzExtra="Máy chủ chặn thật: chưa đổi thì mọi thao tác đều bị từ chối, không chỉ ẩn ở giao diện.">
          <nz-switch [(ngModel)]="forceChange" />
        </nz-form-control>
      </nz-form-item>

      <div class="cfg-actions">
        <button nz-button nzType="primary" [nzLoading]="saving()" (click)="save()">Lưu</button>
      </div>
    </nz-card>
  `,
  styles: `
    .cfg-card { max-width: 680px; }
    .cfg-actions { display: flex; justify-content: flex-end; gap: 10px; }
  `
})
export class SettingsAccountTab implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly message = inject(NzMessageService);

  protected readonly saving = signal(false);
  protected readonly showPassword = signal(false);
  protected defaultPassword = 'Hocvien@123';
  protected forceChange = true;

  ngOnInit(): void {
    this.settingsService.getEffective().subscribe(res => {
      const v = res.values;
      if (v[SETTING_KEYS.defaultPassword]) this.defaultPassword = v[SETTING_KEYS.defaultPassword];
      if (v[SETTING_KEYS.forceChangePassword]) this.forceChange = v[SETTING_KEYS.forceChangePassword] === 'true';
    });
  }

  protected save(): void {
    const pwd = this.defaultPassword?.trim() ?? '';
    const strong = pwd.length >= 8 && /[a-z]/.test(pwd) && /[A-Z]/.test(pwd) && /\d/.test(pwd);
    if (!strong) {
      this.message.error('Mật khẩu mặc định cần ≥ 8 ký tự, có chữ hoa, chữ thường và số.');
      return;
    }

    const sys = (key: string, value: string): UpsertSettingRequest =>
      ({ key, value, scope: SettingScope.System, scopeId: null, dataType: null, description: null });

    this.saving.set(true);
    forkJoin([
      this.settingsService.upsert(sys(SETTING_KEYS.defaultPassword, pwd)),
      this.settingsService.upsert(sys(SETTING_KEYS.forceChangePassword, String(this.forceChange)))
    ]).subscribe({
      next: () => { this.saving.set(false); this.message.success('Đã lưu cấu hình tài khoản.'); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message); }
    });
  }
}
