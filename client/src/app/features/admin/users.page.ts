import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
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
    NzTableModule, NzButtonModule, NzIconModule, NzInputModule,
    NzTagModule, NzSelectModule, NzPopconfirmModule, NzModalModule, NzFormModule, NzAlertModule, NzCardModule, NzPaginationModule,
    NzTooltipModule, PageHeader
  ],
  template: `
    <app-page-header title="Quản lý người dùng" subtitle="Tài khoản & phân quyền" icon="team">
      <input nz-input placeholder="Tìm theo email hoặc tên..." class="search"
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
              @if (user.isDeleted) { <nz-tag nzColor="red">Đã xóa</nz-tag> }
              @else { <nz-tag nzColor="green">Hoạt động</nz-tag> }
            </div>
            <div class="card-field"><span class="label">Email</span><span>{{ user.email }}</span></div>
            <div class="card-field"><span class="label">Họ tên</span><span>{{ user.fullName }}</span></div>
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
        [nzScroll]="{ x: '1080px', y: scrollY }">
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
                    @case ('account') { <strong [class.text-deleted]="user.isDeleted">{{ user.userName }}</strong> }
                    @case ('email') { {{ user.email }} }
                    @case ('fullName') { {{ user.fullName }} }
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
                      @else { <nz-tag nzColor="green">Hoạt động</nz-tag> }
                    }
                    @case ('createdAt') { {{ user.createdAt | date: 'dd/MM/yyyy HH:mm' }} }
                  }
                </td>
              }
              <td>
                @if (!user.isDeleted) {
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
  `,
  styles: `
    .search {
      width: 260px;
    }

    .roles-select {
      min-width: 160px;
    }

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
    .card-actions { display: flex; gap: 8px; margin-top: 10px; }
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
