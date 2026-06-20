import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { AuthService } from '../../core/auth.service';
import { ProfileService } from '../../core/profile.service';
import { ROLE_ADMIN, ROLE_TEACHER } from '../../core/models';
import { PageHeader } from '../../shared/page-header';
import { AvatarCropModal } from '../../shared/avatar-crop-modal';

@Component({
  selector: 'app-profile-page',
  imports: [
    FormsModule,
    NzCardModule, NzAvatarModule, NzButtonModule, NzIconModule, NzUploadModule,
    NzFormModule, NzInputModule, NzTagModule, NzTooltipModule, PageHeader, AvatarCropModal
  ],
  template: `
    <app-page-header title="Trang cá nhân" subtitle="Thông tin tài khoản & ảnh đại diện" icon="user" />

    <div class="profile">
      <!-- Hero: avatar (badge camera) + định danh -->
      <nz-card class="hero">
        <div class="hero-inner">
          <div class="avatar-wrap">
            <nz-upload
              class="avatar-upload"
              [nzShowUploadList]="false"
              nzAccept="image/*"
              [nzBeforeUpload]="onBeforeUpload"
            >
              <span
                class="avatar-btn"
                nz-tooltip
                nzTooltipTitle="Đổi ảnh đại diện"
                aria-label="Đổi ảnh đại diện"
              >
                <nz-avatar [nzSrc]="avatarUrl() ?? undefined" nzIcon="user" [nzSize]="104" />
                <span class="avatar-overlay"><nz-icon nzType="camera" /></span>
                @if (avatarBusy()) {
                  <span class="avatar-loading"><nz-icon nzType="loading" nzSpin /></span>
                }
              </span>
            </nz-upload>
            <span class="cam" aria-hidden="true"><nz-icon nzType="camera" /></span>
          </div>

          <div class="hero-info">
            <div class="hero-name">{{ user()?.fullName || user()?.email }}</div>
            <div class="hero-mail"><nz-icon nzType="mail" /> {{ user()?.email }}</div>
            <div class="hero-roles">
              @for (r of user()?.roles ?? []; track r) {
                <nz-tag nzColor="blue">{{ roleLabel(r) }}</nz-tag>
              }
            </div>
          </div>
        </div>
      </nz-card>

      <!-- Thông tin cá nhân -->
      <nz-card nzTitle="Thông tin cá nhân" [nzExtra]="infoExtra">
        <ng-template #infoExtra>
          @if (!editing()) {
            <button nz-button nzType="text" (click)="startEdit()">
              <nz-icon nzType="edit" /> Chỉnh sửa
            </button>
          }
        </ng-template>

        @if (editing()) {
          <form nz-form nzLayout="vertical" class="edit-form">
            <nz-form-item>
              <nz-form-label>Họ tên</nz-form-label>
              <nz-form-control>
                <input nz-input name="fn" [(ngModel)]="editFullName" placeholder="Họ và tên" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>Số điện thoại</nz-form-label>
              <nz-form-control>
                <input nz-input name="ph" [(ngModel)]="editPhoneNumber" placeholder="Số điện thoại" />
              </nz-form-control>
            </nz-form-item>
            <div class="actions">
              <button nz-button nzType="primary" [nzLoading]="saveBusy()" (click)="saveProfile()">Lưu</button>
              <button nz-button (click)="cancelEdit()">Hủy</button>
            </div>
          </form>
        } @else {
          <ul class="fields">
            <li>
              <span class="k">Họ tên</span>
              <span class="v">{{ user()?.fullName || 'Chưa cập nhật' }}</span>
            </li>
            <li>
              <span class="k">Email</span>
              <span class="v">{{ user()?.email }}</span>
            </li>
            <li>
              <span class="k">Số điện thoại</span>
              <span class="v">{{ user()?.phoneNumber || 'Chưa cập nhật' }}</span>
            </li>
          </ul>
        }
      </nz-card>

      <!-- Bảo mật -->
      <nz-card nzTitle="Bảo mật">
        @if (!pwExpanded()) {
          <div class="sec-row">
            <div class="sec-text">
              <div class="sec-title">Mật khẩu đăng nhập</div>
              <div class="sec-sub muted">Nên dùng mật khẩu mạnh, tối thiểu 8 ký tự.</div>
            </div>
            <button nz-button nzType="default" (click)="pwExpanded.set(true)">
              <nz-icon nzType="lock" /> Đổi mật khẩu
            </button>
          </div>
        } @else {
          <form nz-form nzLayout="vertical" class="pw-form">
            <nz-form-item>
              <nz-form-label nzRequired>Mật khẩu hiện tại</nz-form-label>
              <nz-form-control>
                <input nz-input type="password" [(ngModel)]="currentPassword" name="cur" autocomplete="current-password" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>Mật khẩu mới</nz-form-label>
              <nz-form-control>
                <input nz-input type="password" [(ngModel)]="newPassword" name="new" autocomplete="new-password" placeholder="tối thiểu 8 ký tự" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>Nhập lại mật khẩu mới</nz-form-label>
              <nz-form-control>
                <input nz-input type="password" [(ngModel)]="confirmPassword" name="cf" autocomplete="new-password" />
              </nz-form-control>
            </nz-form-item>
            <div class="actions">
              <button nz-button nzType="primary" [nzLoading]="pwBusy()" (click)="changePassword()">
                Đổi mật khẩu
              </button>
              <button nz-button (click)="pwExpanded.set(false)">Hủy</button>
            </div>
          </form>
        }
      </nz-card>
    </div>

    <app-avatar-crop-modal
      [visible]="cropModalVisible()"
      [imageFile]="selectedFile()"
      (cropped)="onCropped($event)"
      (cancelled)="onCropCancelled()"
    />
  `,
  styles: `
    .profile { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

    /* Hero */
    .hero-inner { display: flex; align-items: center; gap: 24px; }
    .avatar-wrap { position: relative; width: 104px; height: 104px; flex: 0 0 104px; }
    .avatar-upload { display: block; line-height: 0; }
    .avatar-btn {
      display: block; position: relative; cursor: pointer;
      width: 104px; height: 104px; border-radius: 50%;
    }
    .avatar-overlay {
      position: absolute; inset: 0; border-radius: 50%;
      display: grid; place-items: center; font-size: 24px; color: #fff;
      background: rgba(0, 0, 0, 0.45); opacity: 0; transition: opacity 0.15s ease;
    }
    .avatar-wrap:hover .avatar-overlay { opacity: 1; }
    .avatar-loading {
      position: absolute; inset: 0; border-radius: 50%;
      display: grid; place-items: center; font-size: 26px; color: #fff;
      background: rgba(0, 0, 0, 0.5);
    }
    .cam {
      position: absolute; right: 2px; bottom: 2px; width: 32px; height: 32px;
      border-radius: 50%; background: var(--hs-primary); color: #fff;
      display: grid; place-items: center; font-size: 16px;
      border: 2px solid var(--hs-surface); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
      pointer-events: none;
    }
    .hero-info { min-width: 0; }
    .hero-name { font-size: 20px; font-weight: 700; line-height: 1.25; word-break: break-word; }
    .hero-mail { display: flex; align-items: center; gap: 6px; color: var(--hs-text-muted); margin-top: 4px; word-break: break-word; }
    .hero-roles { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }

    /* Thông tin cá nhân */
    .fields { list-style: none; margin: 0; padding: 0; }
    .fields li {
      display: flex; justify-content: space-between; gap: 16px;
      padding: 11px 0; border-bottom: 1px solid var(--hs-border);
    }
    .fields li:last-child { border-bottom: none; }
    .fields .k { color: var(--hs-text-muted); }
    .fields .v { font-weight: 500; text-align: right; word-break: break-word; }

    /* Bảo mật */
    .sec-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .sec-title { font-weight: 600; }
    .sec-sub { font-size: 13px; margin-top: 2px; }
    .muted { color: var(--hs-text-muted); }

    .actions { display: flex; gap: 8px; margin-top: 8px; }

    @media (max-width: 575px) {
      .hero-inner { flex-direction: column; text-align: center; gap: 16px; }
      .hero-mail, .hero-roles { justify-content: center; }
      .fields li { flex-direction: column; gap: 2px; }
      .fields .v { text-align: left; }
    }
  `
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly message = inject(NzMessageService);

  protected readonly user = this.auth.currentUser;
  protected readonly avatarUrl = computed(() => this.auth.currentUser()?.avatarUrl ?? null);

  protected readonly avatarBusy = signal(false);
  protected readonly pwBusy = signal(false);
  protected readonly cropModalVisible = signal(false);
  protected readonly selectedFile = signal<File | null>(null);

  // Inline edit
  protected readonly editing = signal(false);
  protected readonly saveBusy = signal(false);
  protected editFullName = '';
  protected editPhoneNumber = '';

  // Password collapsible
  protected readonly pwExpanded = signal(false);
  protected currentPassword = '';
  protected newPassword = '';
  protected confirmPassword = '';

  protected roleLabel(role: string): string {
    if (role === ROLE_ADMIN) return 'Quản trị viên';
    if (role === ROLE_TEACHER) return 'Giáo viên';
    return 'Học sinh';
  }

  protected startEdit(): void {
    this.editFullName = this.user()?.fullName ?? '';
    this.editPhoneNumber = this.user()?.phoneNumber ?? '';
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
  }

  protected saveProfile(): void {
    this.saveBusy.set(true);
    this.profileService.updateProfile({
      fullName: this.editFullName || null,
      phoneNumber: this.editPhoneNumber || null
    }).subscribe({
      next: user => {
        this.saveBusy.set(false);
        this.auth.updateCurrentUser(user);
        this.editing.set(false);
        this.message.success('Đã cập nhật thông tin.');
      },
      error: (e: HttpErrorResponse) => {
        this.saveBusy.set(false);
        this.message.error(e.error?.message ?? e.message ?? 'Cập nhật thất bại.');
      }
    });
  }

  protected onBeforeUpload = (file: NzUploadFile): false => {
    this.selectedFile.set(file.originFileObj ?? file as unknown as File);
    this.cropModalVisible.set(true);
    return false;
  };

  protected onCropped(file: File): void {
    this.cropModalVisible.set(false);
    this.selectedFile.set(null);
    this.avatarBusy.set(true);
    this.profileService.uploadAvatar(file).subscribe({
      next: user => {
        this.avatarBusy.set(false);
        this.auth.updateCurrentUser(user);
        this.message.success('Đã cập nhật ảnh đại diện.');
      },
      error: (e: HttpErrorResponse) => {
        this.avatarBusy.set(false);
        this.message.error(e.error?.message ?? e.message ?? 'Tải ảnh thất bại.');
      }
    });
  }

  protected onCropCancelled(): void {
    this.cropModalVisible.set(false);
    this.selectedFile.set(null);
  }

  protected changePassword(): void {
    if (!this.currentPassword) { this.message.warning('Nhập mật khẩu hiện tại.'); return; }
    if (!this.newPassword) { this.message.warning('Nhập mật khẩu mới.'); return; }
    if (this.newPassword !== this.confirmPassword) { this.message.warning('Mật khẩu nhập lại không khớp.'); return; }

    this.pwBusy.set(true);
    this.profileService.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.pwBusy.set(false);
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.pwExpanded.set(false);
        this.message.success('Đã đổi mật khẩu.');
      },
      error: (e: HttpErrorResponse) => {
        this.pwBusy.set(false);
        this.message.error(e.error?.message ?? e.message ?? 'Đổi mật khẩu thất bại.');
      }
    });
  }
}
