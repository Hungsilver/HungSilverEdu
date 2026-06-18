import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    NzFormModule, NzInputModule, NzButtonModule,
    NzAlertModule, NzIconModule
  ],
  template: `
    <div class="auth-page">
      <div class="auth-brand">
        <div class="brand-logo">
          <span class="brand-badge"><nz-icon nzType="read" /></span>
          H-edu
        </div>
        <div class="brand-title">Quản lý trung tâm tiếng Anh, gọn trong một nơi</div>
        <div class="brand-sub">
          Học sinh, lớp học, điểm danh, điểm thưởng, học phí và báo cáo phụ huynh —
          thay cho sổ sách giấy và file Excel rời rạc.
        </div>
        <div class="brand-points">
          <span><nz-icon nzType="check" /> Điểm danh &amp; chấm buổi học siêu nhanh</span>
          <span><nz-icon nzType="check" /> Báo cáo phụ huynh tự động hằng tháng</span>
          <span><nz-icon nzType="check" /> Theo dõi tiến bộ 6 kỹ năng bằng biểu đồ</span>
        </div>
      </div>

      <div class="auth-form-col">
        <div class="auth-card">
          <h1 class="auth-heading">Đăng nhập</h1>
          <p class="auth-subheading">Chào mừng trở lại — đăng nhập để tiếp tục</p>
          @if (error()) {
            <nz-alert nzType="error" [nzMessage]="error()" nzShowIcon class="error-alert" />
          }
          <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
            <nz-form-item>
              <nz-form-label nzRequired>Tài khoản</nz-form-label>
              <nz-form-control nzErrorTip="Vui lòng nhập tài khoản">
                <nz-input-group nzPrefixIcon="user">
                  <input nz-input formControlName="email" type="text" placeholder="Tên đăng nhập hoặc email" />
                </nz-input-group>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>Mật khẩu</nz-form-label>
              <nz-form-control nzErrorTip="Vui lòng nhập mật khẩu">
                <nz-input-group nzPrefixIcon="lock">
                  <input nz-input formControlName="password" type="password" placeholder="Mật khẩu" />
                </nz-input-group>
              </nz-form-control>
            </nz-form-item>
            <button nz-button nzType="primary" nzBlock [nzLoading]="loading()" [disabled]="form.invalid">
              Đăng nhập
            </button>
          </form>
          <p class="contact-hint">
            Chưa có tài khoản? Liên hệ quản trị viên trung tâm để được cấp.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: `
    .contact-hint { margin-top: 16px; text-align: center; color: var(--hs-text-muted); font-size: 13px; }
  `
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  protected submit(): void {
    if (this.form.invalid) return;
    const { email, password } = this.form.getRawValue();

    this.loading.set(true);
    this.error.set(null);
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(err.error?.message ?? err.message ?? 'Đăng nhập thất bại, thử lại sau.');
      }
    });
  }
}
