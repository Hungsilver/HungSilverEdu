import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register-page',
  imports: [
    ReactiveFormsModule, RouterLink,
    NzFormModule, NzInputModule, NzButtonModule, NzAlertModule, NzIconModule
  ],
  template: `
    <div class="auth-page">
      <div class="auth-brand">
        <div class="brand-logo">
          <span class="brand-badge"><nz-icon nzType="read" /></span>
          H-edu
        </div>
        <div class="brand-title">Bắt đầu quản lý trung tâm hiệu quả hơn</div>
        <div class="brand-sub">
          Tạo tài khoản để truy cập hệ thống quản lý dạy–học: lớp học, học sinh,
          buổi học, báo cáo và thông báo.
        </div>
        <div class="brand-points">
          <span><nz-icon nzType="check" /> Một nơi duy nhất, hết rời rạc</span>
          <span><nz-icon nzType="check" /> Truy cập trên máy tính &amp; điện thoại</span>
          <span><nz-icon nzType="check" /> Tạo động lực học sinh bằng điểm thưởng</span>
        </div>
      </div>

      <div class="auth-form-col">
        <div class="auth-card">
          <h1 class="auth-heading">Đăng ký tài khoản</h1>
          <p class="auth-subheading">Điền thông tin để tạo tài khoản mới</p>
          @if (error()) {
            <nz-alert nzType="error" [nzMessage]="error()" nzShowIcon class="error-alert" />
          }
          <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
            <nz-form-item>
              <nz-form-label nzRequired>Họ tên</nz-form-label>
              <nz-form-control nzErrorTip="Vui lòng nhập họ tên">
                <input nz-input formControlName="fullName" placeholder="Nguyễn Văn A" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>Email</nz-form-label>
              <nz-form-control nzErrorTip="Email không hợp lệ">
                <input nz-input formControlName="email" type="email" placeholder="email@example.com" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>Mật khẩu</nz-form-label>
              <nz-form-control nzErrorTip="Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số">
                <input nz-input formControlName="password" type="password" placeholder="Mật khẩu" />
              </nz-form-control>
            </nz-form-item>
            <button nz-button nzType="primary" nzBlock [nzLoading]="loading()" [disabled]="form.invalid">
              Đăng ký
            </button>
          </form>
          <p class="register-link">
            Đã có tài khoản? <a routerLink="/login">Đăng nhập</a>
          </p>
        </div>
      </div>
    </div>
  `
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  // Khớp rule RegisterRequestValidator phía backend: ≥8 ký tự, có hoa, thường, số.
  protected readonly form = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)]
    })
  });

  protected submit(): void {
    if (this.form.invalid) return;
    const { fullName, email, password } = this.form.getRawValue();

    this.loading.set(true);
    this.error.set(null);
    this.auth.register(email, password, fullName).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(err.error?.message ?? err.message ?? 'Đăng ký thất bại, thử lại sau.');
      }
    });
  }
}
