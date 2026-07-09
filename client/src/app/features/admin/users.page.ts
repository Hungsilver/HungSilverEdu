import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ROLE_ADMIN, ROLE_TEACHER, ROLE_USER, UserListItem } from '../../core/models';
import { AuthService } from '../../core/auth.service';
import { ScreenService } from '../../core/screen.service';
import { UsersService } from '../../core/users.service';
import { ColumnDef, ColumnSettings } from '../../shared/column-settings';
import { PageHeader } from '../../shared/page-header';
import { PAGE_SIZE_OPTIONS, TABLE_SCROLL_Y } from '../../shared/table';
import { TableDragScroll } from '../../shared/table-drag-scroll.directive';

@Component({
  selector: 'app-users-page',
  imports: [
    FormsModule, DatePipe, ColumnSettings, TableDragScroll,
    NzTableModule, NzButtonModule, NzCheckboxModule, NzIconModule, NzInputModule,
    NzTagModule, NzSelectModule, NzPopconfirmModule, NzModalModule, NzFormModule, NzAlertModule, NzCardModule, NzPaginationModule,
    NzTooltipModule, PageHeader
  ],
  template: `
    <app-page-header title="Quản lý người dùng" subtitle="Tài khoản & phân quyền" icon="team">
      <input nz-input placeholder="Tìm theo tài khoản, email hoặc tên..." class="search"
             [ngModel]="search()" (ngModelChange)="search.set($event)" (keyup.enter)="applyFilters()" />
      <button nz-button (click)="applyFilters()"><nz-icon nzType="search" /> Tìm kiếm</button>
      <button nz-button nzType="primary" (click)="openCreate()">
        <nz-icon nzType="user-add" /> Tạo tài khoản
      </button>
    </app-page-header>

    @if (screen.isMobile()) {
      <div class="mobile-card-list">
        @for (user of users(); track user.id) {
          <nz-card>
            <div class="card-header">
              <span class="card-title" [class.text-deleted]="user.isDeleted">{{ user.userName }}</span>
              @if (user.linkedType === 'Student') { <nz-tag>HS</nz-tag> }
              @else if (user.linkedType === 'Teacher') { <nz-tag>GV</nz-tag> }
              @if (user.isDeleted) { <nz-tag nzColor="red">Đã xóa</nz-tag> }
              @else if (user.isLocked) { <nz-tag nzColor="orange">Đã khóa</nz-tag> }
              @else { <nz-tag nzColor="green">Hoạt động</nz-tag> }
            </div>
            <div class="card-field"><span class="label">Email</span><span>{{ user.email }}</span></div>
            <div class="card-field"><span class="label">Họ tên</span><span>{{ user.fullName }}</span></div>
            <div class="card-field"><span class="label">SĐT</span><span>{{ user.phoneNumber }}</span></div>
            <div class="card-field-block">
              <span class="label">Quyền</span>
              <nz-select
                [ngModel]="user.roles"
                (ngModelChange)="assignRoles(user, $event)"
                nzMode="multiple"
                nzPlaceHolder="Chọn quyền"
                [nzDisabled]="user.isDeleted || user.id === currentUserId"
                style="width:100%">
                <nz-option [nzValue]="ROLE_ADMIN" nzLabel="Quản trị viên" />
                <nz-option [nzValue]="ROLE_TEACHER" nzLabel="Giáo viên" />
                <nz-option [nzValue]="ROLE_USER" nzLabel="Học sinh" />
              </nz-select>
            </div>
            <div class="card-field"><span class="label">Ngày tạo</span><span>{{ user.createdAt | date: 'dd/MM/yyyy' }}</span></div>
            <div class="card-actions">
              @if (!user.isDeleted) {
                <button nz-button nzSize="small" (click)="openEdit(user)" aria-label="Sửa thông tin">
                  <nz-icon nzType="edit" /> Sửa
                </button>
                <button nz-button nzSize="small" [disabled]="user.id === currentUserId"
                        (click)="openReset(user)" aria-label="Đặt lại mật khẩu">
                  <nz-icon nzType="key" /> Mật khẩu
                </button>
                @if (user.isLocked) {
                  <button nz-button nzSize="small" (click)="setLocked(user, false)" aria-label="Mở khóa đăng nhập">
                    <nz-icon nzType="unlock" /> Mở khóa
                  </button>
                } @else {
                  <button nz-button nzSize="small" [disabled]="user.id === currentUserId" aria-label="Khóa đăng nhập"
                          nz-popconfirm nzPopconfirmTitle="Khóa đăng nhập? Mọi phiên hiện tại sẽ bị thu hồi."
                          (nzOnConfirm)="setLocked(user, true)">
                    <nz-icon nzType="lock" /> Khóa
                  </button>
                }
                <button nz-button nzSize="small" nzDanger [disabled]="user.id === currentUserId"
                        nz-tooltip nzTooltipTitle="Xóa người dùng" aria-label="Xóa người dùng"
                        nz-popconfirm nzPopconfirmTitle="Xóa mềm người dùng này?" (nzOnConfirm)="remove(user)">
                  <nz-icon nzType="delete" />
                </button>
              } @else {
                <button nz-button nzSize="small" (click)="restore(user)"><nz-icon nzType="undo" /> Khôi phục</button>
              }
            </div>
          </nz-card>
        }
      </div>
      <nz-pagination class="mobile-pagination" [nzPageIndex]="page()" [nzTotal]="total()" [nzPageSize]="pageSize()" (nzPageIndexChange)="onPageChange($event)" />
    } @else {
      <div class="table-toolbar">
        <span class="spacer"></span>
        <app-column-settings #cols storageKey="hs-cols-users" [columns]="COLUMNS" />
      </div>
      <nz-table
        #table
        appTableDragScroll
        [nzData]="users()"
        [nzLoading]="loading()"
        [nzFrontPagination]="false"
        [nzTotal]="total()"
        [nzPageIndex]="page()"
        [nzPageSize]="pageSize()"
        nzShowSizeChanger
        [nzPageSizeOptions]="PAGE_SIZE_OPTIONS"
        (nzPageIndexChange)="onPageChange($event)"
        (nzPageSizeChange)="pageSize.set($event); onPageChange(1)"
        [nzScroll]="{ x: '1280px', y: scrollY }">
        <thead>
          <tr>
            <th nzWidth="64px" style="white-space: nowrap">STT</th>
            @for (col of cols.visibleColumns(); track col.key) { <th>{{ col.label }}</th> }
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          @for (user of table.data; track user.id; let i = $index) {
            <tr>
              <td>{{ (page() - 1) * pageSize() + i + 1 }}</td>
              @for (col of cols.visibleColumns(); track col.key) {
                <td>
                  @switch (col.key) {
                    @case ('account') {
                      <strong [class.text-deleted]="user.isDeleted">{{ user.userName }}</strong>
                      @if (user.linkedType === 'Student') { <nz-tag class="linked-tag" nz-tooltip nzTooltipTitle="Liên kết hồ sơ Học sinh">HS</nz-tag> }
                      @else if (user.linkedType === 'Teacher') { <nz-tag class="linked-tag" nz-tooltip nzTooltipTitle="Liên kết hồ sơ Giáo viên">GV</nz-tag> }
                    }
                    @case ('email') { {{ user.email }} }
                    @case ('fullName') { {{ user.fullName }} }
                    @case ('phone') { {{ user.phoneNumber }} }
                    @case ('roles') {
                      <nz-select
                        [ngModel]="user.roles"
                        (ngModelChange)="assignRoles(user, $event)"
                        nzMode="multiple"
                        nzPlaceHolder="Chọn quyền"
                        [nzDisabled]="user.isDeleted || user.id === currentUserId"
                        class="roles-select">
                        <nz-option [nzValue]="ROLE_ADMIN" nzLabel="Quản trị viên" />
                        <nz-option [nzValue]="ROLE_TEACHER" nzLabel="Giáo viên" />
                        <nz-option [nzValue]="ROLE_USER" nzLabel="Học sinh" />
                      </nz-select>
                    }
                    @case ('status') {
                      @if (user.isDeleted) { <nz-tag nzColor="red">Đã xóa</nz-tag> }
                      @else if (user.isLocked) { <nz-tag nzColor="orange">Đã khóa</nz-tag> }
                      @else { <nz-tag nzColor="green">Hoạt động</nz-tag> }
                    }
                    @case ('createdAt') { {{ user.createdAt | date: 'dd/MM/yyyy HH:mm' }} }
                  }
                </td>
              }
              <td class="actions-cell">
                @if (!user.isDeleted) {
                  <button nz-button nzType="link" nzSize="small"
                          nz-tooltip nzTooltipTitle="Sửa thông tin" aria-label="Sửa thông tin"
                          (click)="openEdit(user)">
                    <nz-icon nzType="edit" />
                  </button>
                  <button nz-button nzType="link" nzSize="small"
                          [disabled]="user.id === currentUserId"
                          nz-tooltip nzTooltipTitle="Đặt lại mật khẩu" aria-label="Đặt lại mật khẩu"
                          (click)="openReset(user)">
                    <nz-icon nzType="key" />
                  </button>
                  @if (user.isLocked) {
                    <button nz-button nzType="link" nzSize="small"
                            nz-tooltip nzTooltipTitle="Mở khóa đăng nhập" aria-label="Mở khóa đăng nhập"
                            (click)="setLocked(user, false)">
                      <nz-icon nzType="unlock" />
                    </button>
                  } @else {
                    <button nz-button nzType="link" nzSize="small"
                            [disabled]="user.id === currentUserId"
                            nz-tooltip nzTooltipTitle="Khóa đăng nhập" aria-label="Khóa đăng nhập"
                            nz-popconfirm nzPopconfirmTitle="Khóa đăng nhập? Mọi phiên hiện tại sẽ bị thu hồi."
                            (nzOnConfirm)="setLocked(user, true)">
                      <nz-icon nzType="lock" />
                    </button>
                  }
                  <button nz-button nzType="link" nzSize="small" nzDanger
                          [disabled]="user.id === currentUserId"
                          nz-tooltip nzTooltipTitle="Xóa người dùng" aria-label="Xóa người dùng"
                          nz-popconfirm nzPopconfirmTitle="Xóa mềm người dùng này? Mọi phiên đăng nhập sẽ bị thu hồi."
                          (nzOnConfirm)="remove(user)">
                    <nz-icon nzType="delete" />
                  </button>
                } @else {
                  <button nz-button nzType="link" nzSize="small" (click)="restore(user)">
                    <nz-icon nzType="undo" />
                    Khôi phục
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    }

    <!-- Tạo tài khoản Quản trị viên. Tài khoản Giáo viên/Học sinh cấp ở trang tương ứng (tên đăng nhập = mã). -->
    <nz-modal [nzVisible]="createOpen()" nzTitle="Tạo tài khoản quản trị" [nzOkLoading]="createBusy()"
      nzOkText="Tạo" (nzOnOk)="submitCreate()" (nzOnCancel)="createOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical">
          <nz-alert nzType="info" nzShowIcon class="hint-alert"
            nzMessage="Trang này chỉ tạo tài khoản Quản trị viên. Tài khoản Giáo viên cấp ở trang Giáo viên, Học sinh ở trang Học viên (tên đăng nhập = mã)." />
          <nz-form-item>
            <nz-form-label nzRequired>Tên đăng nhập</nz-form-label>
            <nz-form-control>
              <input nz-input [(ngModel)]="cUserName" name="u" placeholder="vd: gv_lan" autocomplete="off" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>Họ tên</nz-form-label>
            <nz-form-control><input nz-input [(ngModel)]="cFullName" name="f" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>Email (tùy chọn)</nz-form-label>
            <nz-form-control><input nz-input [(ngModel)]="cEmail" name="e" type="email" placeholder="bỏ trống nếu không có" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>Mật khẩu</nz-form-label>
            <nz-form-control>
              <input nz-input [(ngModel)]="cPassword" name="p" type="text" placeholder="tối thiểu 8 ký tự" autocomplete="new-password" />
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <!-- Admin sửa thông tin cơ bản của tài khoản. -->
    <nz-modal [nzVisible]="editOpen()" nzTitle="Sửa thông tin tài khoản" [nzOkLoading]="editBusy()"
      nzOkText="Lưu" (nzOnOk)="submitEdit()" (nzOnCancel)="editOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical">
          @if (editUser()?.linkedType) {
            <nz-alert nzType="info" nzShowIcon class="hint-alert"
              nzMessage="Tài khoản liên kết hồ sơ Học sinh/Giáo viên: tên đăng nhập = mã hồ sơ, không đổi được ở đây." />
          }
          <nz-form-item>
            <nz-form-label nzRequired>Tên đăng nhập</nz-form-label>
            <nz-form-control>
              <input nz-input [(ngModel)]="eUserName" name="eu" [disabled]="!!editUser()?.linkedType" autocomplete="off" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>Họ tên</nz-form-label>
            <nz-form-control><input nz-input [(ngModel)]="eFullName" name="ef" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>Email</nz-form-label>
            <nz-form-control><input nz-input [(ngModel)]="eEmail" name="ee" type="email" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>Số điện thoại</nz-form-label>
            <nz-form-control><input nz-input [(ngModel)]="ePhone" name="ep" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <!-- Admin đổi/đặt lại mật khẩu tài khoản. -->
    <nz-modal [nzVisible]="resetOpen()" [nzTitle]="'Đặt lại mật khẩu — ' + (resetUser()?.userName ?? '')"
      [nzOkLoading]="resetBusy()" nzOkText="Đặt lại" (nzOnOk)="submitReset()" (nzOnCancel)="resetOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical">
          <nz-alert nzType="warning" nzShowIcon class="hint-alert"
            nzMessage="Mọi phiên đăng nhập hiện tại của tài khoản sẽ bị thu hồi." />
          <nz-form-item>
            <nz-form-label>Mật khẩu mới</nz-form-label>
            <nz-form-control nzExtra="Bỏ trống để dùng mật khẩu mặc định của hệ thống.">
              <input nz-input [(ngModel)]="rPassword" name="rp" type="text"
                     placeholder="tối thiểu 8 ký tự, có hoa/thường/số" autocomplete="new-password" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-control>
              <label nz-checkbox [(ngModel)]="rMustChange" name="rm">Bắt buộc đổi mật khẩu ở lần đăng nhập kế tiếp</label>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .search {
      width: 260px;
    }

    .roles-select {
      min-width: 160px;
    }

    .linked-tag { margin-left: 6px; }
    .actions-cell { white-space: nowrap; }

    .table-toolbar { display: flex; align-items: center; margin-bottom: 12px; }
    .table-toolbar .spacer { flex: 1; }

    .full { width: 100%; }
    .hint-alert { margin-bottom: 14px; }

    .mobile-card-list { display: flex; flex-direction: column; gap: 12px; padding: 8px 0; }
    .mobile-card-list nz-card { border-radius: 8px; }
    .card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .card-title { font-weight: 600; font-size: 15px; flex: 1; }
    .card-field { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 13px; }
    .card-field-block { display: flex; flex-direction: column; gap: 4px; padding: 6px 0; font-size: 13px; }
    .label { color: #8c8c8c; min-width: 72px; }
    .card-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .mobile-pagination { margin-top: 16px; text-align: center; }
  `
})
export class UsersPage {
  protected readonly ROLE_ADMIN = ROLE_ADMIN;
  protected readonly ROLE_TEACHER = ROLE_TEACHER;
  protected readonly ROLE_USER = ROLE_USER;

  private readonly usersService = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);
  protected readonly screen = inject(ScreenService);

  protected readonly currentUserId = this.auth.currentUser()?.id;

  protected readonly users = signal<UserListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly PAGE_SIZE_OPTIONS = PAGE_SIZE_OPTIONS;
  protected readonly scrollY = TABLE_SCROLL_Y;
  protected readonly search = signal('');
  protected readonly loading = signal(false);

  // Cột cấu hình được (Thao tác cố định cuối).
  protected readonly COLUMNS: ColumnDef[] = [
    { key: 'account', label: 'Tài khoản' },
    { key: 'email', label: 'Email' },
    { key: 'fullName', label: 'Họ tên' },
    { key: 'phone', label: 'SĐT' },
    { key: 'roles', label: 'Quyền' },
    { key: 'status', label: 'Trạng thái' },
    { key: 'createdAt', label: 'Ngày tạo' }
  ];

  // Tạo tài khoản mới
  protected readonly createOpen = signal(false);
  protected readonly createBusy = signal(false);
  protected cRole = ROLE_ADMIN;
  protected cUserName = '';
  protected cFullName = '';
  protected cEmail = '';
  protected cPassword = '';

  // Sửa thông tin cơ bản
  protected readonly editOpen = signal(false);
  protected readonly editBusy = signal(false);
  protected readonly editUser = signal<UserListItem | null>(null);
  protected eUserName = '';
  protected eFullName = '';
  protected eEmail = '';
  protected ePhone = '';

  // Đặt lại mật khẩu
  protected readonly resetOpen = signal(false);
  protected readonly resetBusy = signal(false);
  protected readonly resetUser = signal<UserListItem | null>(null);
  protected rPassword = '';
  protected rMustChange = true;

  constructor() {
    this.load();
  }

  protected openCreate(): void {
    this.cRole = ROLE_ADMIN;
    this.cUserName = '';
    this.cFullName = '';
    this.cEmail = '';
    this.cPassword = '';
    this.createOpen.set(true);
  }

  protected submitCreate(): void {
    if (!this.cUserName.trim()) { this.message.warning('Nhập tên đăng nhập.'); return; }
    if (!this.cPassword) { this.message.warning('Nhập mật khẩu.'); return; }

    this.createBusy.set(true);
    this.usersService.create({
      userName: this.cUserName.trim(),
      email: this.cEmail.trim() || null,
      password: this.cPassword,
      fullName: this.cFullName.trim() || null,
      role: this.cRole
    }).subscribe({
      next: u => {
        this.createBusy.set(false);
        this.createOpen.set(false);
        this.message.success(`Đã tạo tài khoản "${u.userName}".`);
        this.page.set(1);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.createBusy.set(false);
        this.message.error(err.error?.message ?? err.message ??'Tạo tài khoản thất bại.');
      }
    });
  }

  // ---------------- Sửa thông tin cơ bản ----------------
  protected openEdit(user: UserListItem): void {
    this.editUser.set(user);
    this.eUserName = user.userName;
    this.eFullName = user.fullName ?? '';
    this.eEmail = user.email;
    this.ePhone = user.phoneNumber ?? '';
    this.editOpen.set(true);
  }

  protected submitEdit(): void {
    const user = this.editUser();
    if (!user) return;
    if (!user.linkedType && !this.eUserName.trim()) { this.message.warning('Nhập tên đăng nhập.'); return; }
    if (!this.eEmail.trim()) { this.message.warning('Nhập email.'); return; }

    this.editBusy.set(true);
    this.usersService.update(user.id, {
      userName: user.linkedType ? null : this.eUserName.trim(),
      email: this.eEmail.trim(),
      fullName: this.eFullName.trim() || null,
      phoneNumber: this.ePhone.trim() || null
    }).subscribe({
      next: u => {
        this.editBusy.set(false);
        this.editOpen.set(false);
        this.message.success(`Đã cập nhật tài khoản "${u.userName}".`);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.editBusy.set(false);
        this.message.error(err.error?.message ?? err.message ?? 'Cập nhật thất bại.');
      }
    });
  }

  // ---------------- Đặt lại mật khẩu ----------------
  protected openReset(user: UserListItem): void {
    this.resetUser.set(user);
    this.rPassword = '';
    this.rMustChange = true;
    this.resetOpen.set(true);
  }

  protected submitReset(): void {
    const user = this.resetUser();
    if (!user) return;
    this.resetBusy.set(true);
    this.usersService.resetPassword(user.id, this.rPassword || null, this.rMustChange).subscribe({
      next: () => {
        this.resetBusy.set(false);
        this.resetOpen.set(false);
        this.message.success(this.rPassword
          ? `Đã đổi mật khẩu cho "${user.userName}".`
          : `Đã đặt lại mật khẩu mặc định cho "${user.userName}".`);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.resetBusy.set(false);
        this.message.error(err.error?.message ?? err.message ?? 'Đặt lại mật khẩu thất bại.');
      }
    });
  }

  // ---------------- Khóa / mở khóa ----------------
  protected setLocked(user: UserListItem, locked: boolean): void {
    this.usersService.setLocked(user.id, locked).subscribe({
      next: () => {
        this.message.success(locked ? `Đã khóa đăng nhập "${user.userName}".` : `Đã mở khóa "${user.userName}".`);
        this.load();
      },
      error: (err: HttpErrorResponse) =>
        this.message.error(err.error?.message ?? err.message ?? 'Thao tác thất bại.')
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.usersService.getPaged(this.page(), this.pageSize(), this.search() || undefined).subscribe({
      next: result => {
        this.users.set(result.items);
        this.total.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  protected applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected assignRoles(user: UserListItem, roles: string[]): void {
    this.usersService.assignRoles(user.id, roles).subscribe({
      next: () => {
        this.message.success(`Đã cập nhật quyền cho ${user.email}.`);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.message.error(err.error?.message ?? err.message ??'Cập nhật quyền thất bại.');
        this.load();
      }
    });
  }

  protected remove(user: UserListItem): void {
    this.usersService.softDelete(user.id).subscribe({
      next: () => {
        this.message.success(`Đã xóa (mềm) ${user.email}.`);
        this.load();
      },
      error: (err: HttpErrorResponse) =>
        this.message.error(err.error?.message ?? err.message ??'Xóa thất bại.')
    });
  }

  protected restore(user: UserListItem): void {
    this.usersService.restore(user.id).subscribe({
      next: () => {
        this.message.success(`Đã khôi phục ${user.email}.`);
        this.load();
      },
      error: (err: HttpErrorResponse) =>
        this.message.error(err.error?.message ?? err.message ??'Khôi phục thất bại.')
    });
  }
}
