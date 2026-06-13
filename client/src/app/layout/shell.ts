import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    NzLayoutModule, NzMenuModule, NzIconModule, NzAvatarModule, NzDropDownModule
  ],
  template: `
    <nz-layout class="shell">
      <nz-sider nzCollapsible [nzWidth]="220">
        <div class="logo">HungSilver</div>
        <ul nz-menu nzTheme="dark" nzMode="inline">
          <li nz-menu-item routerLink="/products" routerLinkActive="ant-menu-item-selected">
            <nz-icon nzType="shopping" />
            <span>Sản phẩm</span>
          </li>
          @if (auth.isAdmin()) {
            <li nz-menu-item routerLink="/admin/users" routerLinkActive="ant-menu-item-selected">
              <nz-icon nzType="team" />
              <span>Quản lý người dùng</span>
            </li>
          }
        </ul>
      </nz-sider>
      <nz-layout>
        <nz-header class="header">
          <span></span>
          <span class="user" nz-dropdown [nzDropdownMenu]="userMenu" nzTrigger="click">
            <nz-avatar [nzSrc]="auth.currentUser()?.avatarUrl ?? undefined" nzIcon="user" nzSize="small" />
            {{ auth.currentUser()?.fullName || auth.currentUser()?.email }}
            <nz-icon nzType="down" />
          </span>
          <nz-dropdown-menu #userMenu="nzDropdownMenu">
            <ul nz-menu>
              <li nz-menu-item (click)="auth.logout()">
                <nz-icon nzType="logout" />
                Đăng xuất
              </li>
            </ul>
          </nz-dropdown-menu>
        </nz-header>
        <nz-content class="content">
          <router-outlet />
        </nz-content>
      </nz-layout>
    </nz-layout>
  `,
  styles: `
    .shell {
      min-height: 100vh;
    }

    .logo {
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: 1px;
    }

    .header {
      background: #fff;
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .user {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .content {
      margin: 24px;
      padding: 24px;
      background: #fff;
      border-radius: 8px;
    }
  `
})
export class Shell {
  protected readonly auth = inject(AuthService);
}
