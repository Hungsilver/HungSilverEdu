import { NgTemplateOutlet } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-shell',
  imports: [
    NgTemplateOutlet, RouterOutlet, RouterLink, RouterLinkActive,
    NzLayoutModule, NzMenuModule, NzIconModule, NzAvatarModule, NzDropDownModule,
    NzDrawerModule, NzButtonModule
  ],
  template: `
    <ng-template #brand>
      <div class="brand">
        <span class="brand-badge"><nz-icon nzType="read" /></span>
        <span class="brand-name">H-edu</span>
      </div>
    </ng-template>

    <ng-template #menu>
      <ul nz-menu nzMode="inline" class="app-nav">
        @if (auth.isAdmin()) {
          <li nz-menu-item routerLink="/dashboard" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="dashboard" /><span>Tổng quan</span>
          </li>
          <li nz-menu-item routerLink="/students" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="idcard" /><span>Học viên</span>
          </li>
          <li nz-menu-item routerLink="/classes" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="book" /><span>Lớp học</span>
          </li>
          <li nz-menu-item routerLink="/teachers" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="team" /><span>Giáo viên</span>
          </li>
          <li nz-menu-item routerLink="/schedule" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="calendar" /><span>Lịch học</span>
          </li>
          <li nz-menu-item routerLink="/tuition" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="dollar" /><span>Học phí</span>
          </li>
          <li nz-menu-item routerLink="/materials" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="link" /><span>Kho tài liệu</span>
          </li>
          <li nz-menu-item routerLink="/evaluations" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="audit" /><span>Đánh giá hàng tháng</span>
          </li>
          <li nz-menu-item routerLink="/notifications" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="bell" /><span>Thông báo</span>
          </li>
          <li nz-menu-item routerLink="/warnings" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="warning" /><span>Cảnh báo</span>
          </li>
          <li nz-menu-item routerLink="/admin/users" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="team" /><span>Quản lý người dùng</span>
          </li>
          <li nz-menu-item routerLink="/settings" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="setting" /><span>Cấu hình hệ thống</span>
          </li>
        } @else if (auth.isTeacher()) {
          <li nz-menu-item routerLink="/dashboard" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="dashboard" /><span>Tổng quan</span>
          </li>
          <li nz-menu-item routerLink="/students" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="idcard" /><span>Học viên</span>
          </li>
          <li nz-menu-item routerLink="/classes" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="book" /><span>Lớp học</span>
          </li>
          <li nz-menu-item routerLink="/teachers" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="team" /><span>Giáo viên</span>
          </li>
          <li nz-menu-item routerLink="/schedule" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="calendar" /><span>Lịch học</span>
          </li>
          <li nz-menu-item routerLink="/tuition" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="dollar" /><span>Học phí</span>
          </li>
          <li nz-menu-item routerLink="/materials" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="link" /><span>Kho tài liệu</span>
          </li>
          <li nz-menu-item routerLink="/evaluations" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="audit" /><span>Đánh giá hàng tháng</span>
          </li>
          <li nz-menu-item routerLink="/notifications" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="bell" /><span>Thông báo</span>
          </li>
          <li nz-menu-item routerLink="/warnings" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="warning" /><span>Cảnh báo</span>
          </li>
        }
        @if (auth.isStudent()) {
          <li nz-menu-item routerLink="/portal" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="solution" /><span>Trang của tôi</span>
          </li>
        }
      </ul>
    </ng-template>

    <nz-layout class="app-layout">
      @if (!isMobile()) {
        <nz-sider class="app-sider" nzCollapsible [nzWidth]="220">
          <ng-container [ngTemplateOutlet]="brand" />
          <ng-container [ngTemplateOutlet]="menu" />
        </nz-sider>
      }
      <nz-layout>
        <nz-header class="app-header header">
          @if (isMobile()) {
            <button nz-button nzType="text" class="hamburger" (click)="drawerOpen.set(true)">
              <nz-icon nzType="menu" />
            </button>
          } @else {
            <span></span>
          }
          <div class="header-right">
            <button
              nz-button nzType="text" class="theme-toggle"
              [class.active]="theme.isDark()"
              (click)="theme.toggle()"
              [attr.aria-label]="theme.isDark() ? 'Chuyển chế độ sáng' : 'Chuyển chế độ tối'">
              <nz-icon nzType="bulb" />
            </button>
            <span class="user" nz-dropdown [nzDropdownMenu]="userMenu" nzTrigger="click">
              <nz-avatar [nzSrc]="auth.currentUser()?.avatarUrl ?? undefined" nzIcon="user" nzSize="small" />
              <span class="user-name">{{ auth.currentUser()?.fullName || auth.currentUser()?.email }}</span>
              <nz-icon nzType="down" />
            </span>
          </div>
          <nz-dropdown-menu #userMenu="nzDropdownMenu">
            <ul nz-menu>
              <li nz-menu-item routerLink="/profile">
                <nz-icon nzType="user" />
                Trang cá nhân
              </li>
              <li nz-menu-divider></li>
              <li nz-menu-item (click)="auth.logout()">
                <nz-icon nzType="logout" />
                Đăng xuất
              </li>
            </ul>
          </nz-dropdown-menu>
        </nz-header>
        <nz-content class="app-content content">
          <router-outlet />
        </nz-content>
      </nz-layout>
    </nz-layout>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      nzPlacement="left"
      [nzClosable]="false"
      [nzWidth]="240"
      nzWrapClassName="nav-drawer"
      (nzOnClose)="drawerOpen.set(false)">
      <ng-container *nzDrawerContent>
        <ng-container [ngTemplateOutlet]="brand" />
        <ng-container [ngTemplateOutlet]="menu" />
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    /* Khung full-height: trang KHÔNG cuộn ⇒ sider & header đứng yên, chỉ vùng nội dung cuộn */
    .app-layout { height: 100vh; overflow: hidden; }

    .brand {
      height: 52px; display: flex; align-items: center; gap: 10px;
      padding: 0 20px; color: var(--hs-heading); font-weight: 700;
      font-size: 18px; letter-spacing: 0.3px;
    }
    .brand-badge {
      width: 34px; height: 34px; border-radius: 10px; flex: 0 0 34px;
      display: grid; place-items: center; font-size: 18px;
      color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed);
    }
    /* Khi sider thu gọn (80px): ẩn tên, căn giữa badge */
    :host ::ng-deep .ant-layout-sider-collapsed .brand { padding: 0; justify-content: center; }
    :host ::ng-deep .ant-layout-sider-collapsed .brand-name { display: none; }

    /* Sider full-height: brand cố định trên, menu tự cuộn khi dài (chừa chỗ nút thu gọn) */
    :host ::ng-deep .app-sider .ant-layout-sider-children { display: flex; flex-direction: column; padding-bottom: 48px; }
    .app-nav { flex: 1 1 auto; min-height: 0; overflow-y: auto; }

    .header {
      height: 52px; line-height: 52px; flex: 0 0 auto;
      padding: 0 16px; display: flex; align-items: center; justify-content: space-between;
    }
    .header-right { display: flex; align-items: center; gap: 8px; }
    .hamburger { font-size: 20px; }
    .theme-toggle { font-size: 18px; color: var(--hs-text-muted); }
    .theme-toggle.active { color: #f59e0b; }
    .user { cursor: pointer; display: inline-flex; align-items: center; gap: 8px; color: var(--hs-text); }

    /* Vùng nội dung là phần cuộn duy nhất (min-height:0 để flex item cuộn được) */
    .content { margin: 12px; padding: 16px; flex: 1; min-height: 0; overflow: auto; }

    @media (max-width: 575px) {
      .user-name { display: none; }
      .content { margin: 8px; padding: 14px; }
    }

    :host ::ng-deep .nav-drawer .ant-drawer-body { padding: 0; background: var(--hs-sidebar-bg); }
  `
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly isMobile = signal(false);
  protected readonly drawerOpen = signal(false);

  constructor() {
    this.updateSize();
  }

  @HostListener('window:resize')
  protected updateSize(): void {
    const mobile = window.innerWidth < 992;
    this.isMobile.set(mobile);
    if (!mobile) this.drawerOpen.set(false);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }
}
