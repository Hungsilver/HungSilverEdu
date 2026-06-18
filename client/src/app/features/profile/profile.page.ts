import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzUploadModule, NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import { AuthService } from '../../core/auth.service';
import { ProfileService } from '../../core/profile.service';
import { ROLE_ADMIN, ROLE_TEACHER } from '../../core/models';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-profile-page',
  imports: [
    FormsModule,
    NzCardModule, NzAvatarModule, NzButtonModule, NzIconModule, NzUploadModule,
    NzFormModule, NzInputModule, NzTagModule, PageHeader
  ],
  template: `
    <app-page-header title="Trang cá nhân" subtitle="Thông tin tài khoản & ảnh đại diện" icon="user" />

    <div class="grid">
      <nz-card nzTitle="Thông tin cá nhân" [nzExtra]="infoExtra">
        <ng-template #infoExtra>
          @if (!editing()) {
            <button nz-button nzType="text" (click)="startEdit()">
              <nz-icon nzType="edit" /> Chỉnh sửa
            </button>
          }
        </ng-template>

        <div class="profile-top">
          <nz-avatar [nzSrc]="avatarUrl() ?? undefined" nzIcon="user" [nzSize]="96" />
          <div class="info">
            @if (editing()) {
              <nz-form-item>
                <nz-form-label>Họ tên</nz-form-label>
                <nz-form-control>
                  <input nz-input [(ngModel)]="editFullName" placeholder="Họ và tên" />
                </nz-form-control>
              </nz-form-item>
              <div class="field"><span class="label">Email</span> <span>{{ user()?.email }}</span></div>
              <nz-form-item>
                <nz-form-label>Số điện thoại</nz-form-label>
                <nz-form-control>
                  <input nz-input [(ngModel)]="editPhoneNumber" placeholder="Số điện thoại" />
                </nz-form-control>
              </nz-form-item>
              <div class="edit-actions">
                <button nz-button nzType="primary" [nzLoading]="saveBusy()" (click)="saveProfile()">Lưu</button>
                <button nz-button (click)="cancelEdit()">Hủy</button>
              </div>
            } @else {
              <div class="name">{{ user()?.fullName || user()?.email }}</div>
              <div class="field"><nz-icon nzType="mail" /> {{ user()?.email }}</div>
              <div class="field"><nz-icon nzType="phone" /> {{ user()?.phoneNumber || 'Chưa cập nhật' }}</div>
              <div class="roles">
                @for (r of user()?.roles ?? []; track r) {
                  <nz-tag nzColor="blue">{{ roleLabel(r) }}</nz-tag>
                }
              </div>
            }
            <nz-upload [nzCustomRequest]="uploadAvatar" [nzShowUploadList]="false" nzAccept="image/*" class="up">
              <button nz-button [nzLoading]="avatarBusy()">
                <nz-icon nzType="upload" /> Đổi ảnh đại diện
              </button>
            </nz-upload>
            <div class="hint muted">Ảnh JPG/PNG, tối đa 10MB. Ảnh được lưu trên máy chủ.</div>
          </div>
        </div>
      </nz-card>

      <nz-card nzTitle="Đổi mật khẩu">
        @if (!pwExpanded()) {
          <button nz-button nzType="default" (click)="pwExpanded.set(true)">
            <nz-icon nzType="lock" /> Đổi mật khẩu
          </button>
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
            <div class="pw-actions">
              <button nz-button nzType="primary" [nzLoading]="pwBusy()" (click)="changePassword()">
                Đổi mật khẩu
              </button>
              <button nz-button (click)="pwExpanded.set(false)">Hủy</button>
            </div>
          </form>
        }
      </nz-card>
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
    .profile-top { display: flex; gap: 20px; align-items: flex-start; }
    .info { display: flex; flex-direction: column; gap: 6px; flex: 1; }
    .name { font-size: 18px; font-weight: 600; }
    .field { display: flex; align-items: center; gap: 6px; color: var(--hs-text-muted); }
    .label { font-weight: 500; min-width: 50px; }
    .roles { margin: 4px 0; }
    .up { margin-top: 8px; }
    .hint { font-size: 12px; }
    .muted { color: var(--hs-text-muted); }
    .edit-actions, .pw-actions { display: flex; gap: 8px; margin-top: 4px; }
    .pw-form button { margin-top: 4px; }
    @media (max-width: 767px) {
      .grid { grid-template-columns: 1fr; }
      .profile-top { flex-direction: column; align-items: center; text-align: center; }
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

  protected uploadAvatar = (item: NzUploadXHRArgs): Subscription => {
    this.avatarBusy.set(true);
    return this.profileService.uploadAvatar(item.file as unknown as File).subscribe({
      next: user => {
        this.avatarBusy.set(false);
        this.auth.updateCurrentUser(user);
        item.onSuccess?.(user, item.file, null as never);
        this.message.success('Đã cập nhật ảnh đại diện.');
      },
      error: (e: HttpErrorResponse) => {
        this.avatarBusy.set(false);
        item.onError?.(e as never, item.file);
        this.message.error(e.error?.message ?? e.message ?? 'Tải ảnh thất bại.');
      }
    });
  };

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
