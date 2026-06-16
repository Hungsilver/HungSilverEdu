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
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ApiProblem, ROLE_ADMIN, ROLE_TEACHER, ROLE_USER, UserListItem } from '../../core/models';
import { AuthService } from '../../core/auth.service';
import { UsersService } from '../../core/users.service';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-users-page',
  imports: [
    FormsModule, DatePipe,
    NzTableModule, NzButtonModule, NzIconModule, NzInputModule,
    NzTagModule, NzSelectModule, NzPopconfirmModule, NzModalModule, NzFormModule, PageHeader
  ],
  template: `
    <app-page-header title="Quản lý người dùng" subtitle="Tài khoản & phân quyền" icon="team">
      <input nz-input placeholder="Tìm theo email hoặc tên..." class="search"
             [ngModel]="search()" (ngModelChange)="onSearch($event)" />
      <button nz-button nzType="primary" (click)="openCreate()">
        <nz-icon nzType="user-add" /> Tạo tài khoản
      </button>
    </app-page-header>

    <nz-table
      #table
      [nzData]="users()"
      [nzLoading]="loading()"
      [nzFrontPagination]="false"
      [nzTotal]="total()"
      [nzPageIndex]="page()"
      [nzPageSize]="pageSize()"
      (nzPageIndexChange)="onPageChange($event)"
      [nzScroll]="{ x: '760px' }">
      <thead>
        <tr>
          <th>Tài khoản</th>
          <th>Email</th>
          <th>Họ tên</th>
          <th>Quyền</th>
          <th>Trạng thái</th>
          <th>Ngày tạo</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
        @for (user of table.data; track user.id) {
          <tr>
            <td [class.text-deleted]="user.isDeleted"><strong>{{ user.userName }}</strong></td>
            <td>{{ user.email }}</td>
            <td>{{ user.fullName }}</td>
            <td>
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
            </td>
            <td>
              @if (user.isDeleted) {
                <nz-tag nzColor="red">Đã xóa</nz-tag>
              } @else {
                <nz-tag nzColor="green">Hoạt động</nz-tag>
              }
            </td>
            <td>{{ user.createdAtUtc | date: 'dd/MM/yyyy HH:mm' }}</td>
            <td>
              @if (!user.isDeleted) {
                <button nz-button nzType="link" nzSize="small" nzDanger
                        [disabled]="user.id === currentUserId"
                        nz-popconfirm nzPopconfirmTitle="Xóa mềm người dùng này? Mọi phiên đăng nhập sẽ bị thu hồi."
                        (nzOnConfirm)="remove(user)">
                  <nz-icon nzType="delete" />
                  Xóa
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

    <!-- Tạo tài khoản Admin/Giáo viên -->
    <nz-modal [nzVisible]="createOpen()" nzTitle="Tạo tài khoản" [nzOkLoading]="createBusy()"
      nzOkText="Tạo" (nzOnOk)="submitCreate()" (nzOnCancel)="createOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>Vai trò</nz-form-label>
            <nz-form-control>
              <nz-select [(ngModel)]="cRole" name="role" class="full">
                <nz-option [nzValue]="ROLE_TEACHER" nzLabel="Giáo viên" />
                <nz-option [nzValue]="ROLE_ADMIN" nzLabel="Quản trị viên" />
              </nz-select>
            </nz-form-control>
          </nz-form-item>
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

    .full { width: 100%; }
  `
})
export class UsersPage {
  protected readonly ROLE_ADMIN = ROLE_ADMIN;
  protected readonly ROLE_TEACHER = ROLE_TEACHER;
  protected readonly ROLE_USER = ROLE_USER;

  private readonly usersService = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);

  protected readonly currentUserId = this.auth.currentUser()?.id;

  protected readonly users = signal<UserListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly search = signal('');
  protected readonly loading = signal(false);

  // Tạo tài khoản mới
  protected readonly createOpen = signal(false);
  protected readonly createBusy = signal(false);
  protected cRole = ROLE_TEACHER;
  protected cUserName = '';
  protected cFullName = '';
  protected cEmail = '';
  protected cPassword = '';

  private searchDebounce?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
  }

  protected openCreate(): void {
    this.cRole = ROLE_TEACHER;
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
        this.message.error((err.error as ApiProblem | null)?.detail ?? 'Tạo tài khoản thất bại.');
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

  protected onSearch(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 350);
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
        this.message.error((err.error as ApiProblem | null)?.detail ?? 'Cập nhật quyền thất bại.');
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
        this.message.error((err.error as ApiProblem | null)?.detail ?? 'Xóa thất bại.')
    });
  }

  protected restore(user: UserListItem): void {
    this.usersService.restore(user.id).subscribe({
      next: () => {
        this.message.success(`Đã khôi phục ${user.email}.`);
        this.load();
      },
      error: (err: HttpErrorResponse) =>
        this.message.error((err.error as ApiProblem | null)?.detail ?? 'Khôi phục thất bại.')
    });
  }
}
