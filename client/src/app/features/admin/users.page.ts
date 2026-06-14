import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ApiProblem, ROLE_ADMIN, ROLE_TEACHER, ROLE_USER, UserListItem } from '../../core/models';
import { AuthService } from '../../core/auth.service';
import { UsersService } from '../../core/users.service';

@Component({
  selector: 'app-users-page',
  imports: [
    FormsModule, DatePipe,
    NzTableModule, NzButtonModule, NzIconModule, NzInputModule,
    NzTagModule, NzSelectModule, NzPopconfirmModule
  ],
  template: `
    <div class="page-header">
      <h2>Quản lý người dùng</h2>
      <input nz-input placeholder="Tìm theo email hoặc tên..." class="search"
             [ngModel]="search()" (ngModelChange)="onSearch($event)" />
    </div>

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
            <td [class.text-deleted]="user.isDeleted">{{ user.email }}</td>
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
  `,
  styles: `
    .search {
      width: 260px;
    }

    .roles-select {
      min-width: 160px;
    }
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

  private searchDebounce?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
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
