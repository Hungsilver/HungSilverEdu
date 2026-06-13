import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { ApiProblem } from '../../core/models';
import { AuthService } from '../../core/auth.service';
import { GoogleSigninButton } from '../../shared/google-signin-button';

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule, RouterLink, GoogleSigninButton,
    NzCardModule, NzFormModule, NzInputModule, NzButtonModule,
    NzAlertModule, NzIconModule, NzDividerModule
  ],
  template: `
    <div class="auth-page">
      <nz-card class="auth-card" nzTitle="Đăng nhập HungSilver">
        @if (error()) {
          <nz-alert nzType="error" [nzMessage]="error()" nzShowIcon class="error-alert" />
        }
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <nz-form-item>
            <nz-form-label nzRequired>Email</nz-form-label>
            <nz-form-control nzErrorTip="Email không hợp lệ">
              <nz-input-group nzPrefixIcon="user">
                <input nz-input formControlName="email" type="email" placeholder="email@example.com" />
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
        <nz-divider nzText="hoặc" nzPlain />
        <app-google-signin-button (credential)="googleLogin($event)" />
        <p class="register-link">
          Chưa có tài khoản? <a routerLink="/register">Đăng ký</a>
        </p>
      </nz-card>
    </div>
  `,
  styles: `
    .error-alert {
      display: block;
      margin-bottom: 16px;
    }

    .register-link {
      text-align: center;
      margin: 16px 0 0;
    }
  `
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
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
        this.error.set((err.error as ApiProblem | null)?.detail ?? 'Đăng nhập thất bại, thử lại sau.');
      }
    });
  }

  protected googleLogin(idToken: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.auth.googleLogin(idToken).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set((err.error as ApiProblem | null)?.detail ?? 'Đăng nhập Google thất bại.');
      }
    });
  }
}
