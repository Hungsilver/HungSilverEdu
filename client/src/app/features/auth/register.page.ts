import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { ApiProblem } from '../../core/models';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register-page',
  imports: [
    ReactiveFormsModule, RouterLink,
    NzCardModule, NzFormModule, NzInputModule, NzButtonModule, NzAlertModule
  ],
  template: `
    <div class="auth-page">
      <nz-card class="auth-card" nzTitle="Đăng ký tài khoản">
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
        <p class="login-link">
          Đã có tài khoản? <a routerLink="/login">Đăng nhập</a>
        </p>
      </nz-card>
    </div>
  `,
  styles: `
    .error-alert {
      display: block;
      margin-bottom: 16px;
    }

    .login-link {
      text-align: center;
      margin: 16px 0 0;
    }
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
        this.error.set((err.error as ApiProblem | null)?.detail ?? 'Đăng ký thất bại, thử lại sau.');
      }
    });
  }
}
