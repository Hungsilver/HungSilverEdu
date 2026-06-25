import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService } from '../../core/auth.service';
import { ProfileService } from '../../core/profile.service';

/** Mật khẩu mạnh tối thiểu: ≥8 ký tự, có hoa/thường/số (khớp chính sách Identity). */
function strongPassword(control: AbstractControl): ValidationErrors | null {
  const v = control.value as string;
  if (!v) return null;
  const ok = v.length >= 8 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v);
  return ok ? null : { weak: true };
}

@Component({
  selector: 'app-must-change-password-page',
  imports: [ReactiveFormsModule, NzFormModule, NzInputModule, NzButtonModule, NzAlertModule, NzIconModule],
  template: `
    <div class="auth-page">
      <div class="auth-brand">
        <div class="brand-logo">
          <span class="brand-badge"><nz-icon nzType="safety" /></span>
          H-edu
        </div>
        <div class="brand-title">Đổi mật khẩu để bảo vệ tài khoản</div>
        <div class="brand-sub">
          Tài khoản của bạn vừa được cấp với mật khẩu tạm. Vui lòng đặt mật khẩu riêng
          trước khi sử dụng hệ thống.
        </div>
      </div>

      <div class="auth-form-col">
        <div class="auth-card">
          <h1 class="auth-heading">Đổi mật khẩu</h1>
          <p class="auth-subheading">Bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên</p>
          @if (error()) {
            <nz-alert nzType="error" [nzMessage]="error()" nzShowIcon class="error-alert" />
          }
          <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
            <nz-form-item>
              <nz-form-label nzRequired>Mật khẩu hiện tại (mật khẩu được cấp)</nz-form-label>
              <nz-form-control nzErrorTip="Vui lòng nhập mật khẩu hiện tại">
                <nz-input-group nzPrefixIcon="lock">
                  <input nz-input type="password" formControlName="currentPassword" placeholder="Mật khẩu được cấp" />
                </nz-input-group>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>Mật khẩu mới</nz-form-label>
              <nz-form-control [nzErrorTip]="newTip">
                <nz-input-group nzPrefixIcon="lock">
                  <input nz-input type="password" formControlName="newPassword" placeholder="≥ 8 ký tự, có hoa/thường/số" />
                </nz-input-group>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>Xác nhận mật khẩu mới</nz-form-label>
              <nz-form-control [nzErrorTip]="confirmTip">
                <nz-input-group nzPrefixIcon="lock">
                  <input nz-input type="password" formControlName="confirm" placeholder="Nhập lại mật khẩu mới" />
                </nz-input-group>
              </nz-form-control>
            </nz-form-item>
            <button nz-button nzType="primary" nzBlock [nzLoading]="loading()" [disabled]="form.invalid">
              Đổi mật khẩu &amp; tiếp tục
            </button>
          </form>
        </div>
      </div>
    </div>
  `
})
export class MustChangePasswordPage {
  private readonly profile = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, strongPassword] }),
    confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  }, { validators: ctrl => ctrl.get('newPassword')!.value === ctrl.get('confirm')!.value ? null : { mismatch: true } });

  protected readonly newTip = 'Mật khẩu cần ≥ 8 ký tự, có chữ hoa, chữ thường và số';
  protected readonly confirmTip = 'Mật khẩu xác nhận chưa khớp';

  constructor() {
    // Vào trang này mà không cần đổi (hoặc chưa đăng nhập) ⇒ về trang chủ.
    if (!this.auth.currentUser()?.mustChangePassword) {
      this.router.navigate(['/']);
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      if (this.form.errors?.['mismatch']) this.error.set('Mật khẩu xác nhận chưa khớp.');
      return;
    }
    const { currentPassword, newPassword } = this.form.getRawValue();

    this.loading.set(true);
    this.error.set(null);
    this.profile.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        // BE đã thu hồi mọi phiên ⇒ đăng nhập lại bằng mật khẩu mới.
        this.message.success('Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.');
        this.auth.clearSession();
        this.router.navigate(['/login']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(err.error?.message ?? err.message ?? 'Đổi mật khẩu thất bại, thử lại sau.');
      }
    });
  }
}
