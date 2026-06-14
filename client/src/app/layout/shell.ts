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

@Component({
  selector: 'app-shell',
  imports: [
    NgTemplateOutlet, RouterOutlet, RouterLink, RouterLinkActive,
    NzLayoutModule, NzMenuModule, NzIconModule, NzAvatarModule, NzDropDownModule,
    NzDrawerModule, NzButtonModule
  ],
  template: `
    <ng-template #menu>
      <ul nz-menu nzTheme="dark" nzMode="inline">
        <li nz-menu-item routerLink="/dashboard" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
          <nz-icon nzType="dashboard" />
          <span>Tổng quan</span>
        </li>
        <li nz-menu-item routerLink="/students" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
          <nz-icon nzType="idcard" />
          <span>Học viên</span>
        </li>
        <li nz-menu-item routerLink="/classes" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
          <nz-icon nzType="book" />
          <span>Lớp học</span>
        </li>
        <li nz-menu-item routerLink="/schedule" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
          <nz-icon nzType="calendar" />
          <span>Lịch học</span>
        </li>
        <li nz-menu-item routerLink="/tuition" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
          <nz-icon nzType="dollar" />
          <span>Học phí</span>
        </li>
        <li nz-menu-item routerLink="/materials" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
          <nz-icon nzType="link" />
          <span>Kho tài liệu</span>
        </li>
        <li nz-menu-item routerLink="/evaluations" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
          <nz-icon nzType="audit" />
          <span>Đánh giá hàng tháng</span>
        </li>
        @if (auth.isAdmin()) {
          <li nz-menu-item routerLink="/admin/users" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="team" />
            <span>Quản lý người dùng</span>
          </li>
          <li nz-menu-item routerLink="/settings" routerLinkActive="ant-menu-item-selected" (click)="closeDrawer()">
            <nz-icon nzType="setting" />
            <span>Cấu hình hệ thống</span>
          </li>
          <li nz-submenu nzTitle="Sắp ra mắt" nzIcon="appstore">
            <ul>
              <li nz-menu-item routerLink="/notifications" (click)="closeDrawer()"><nz-icon nzType="bell" /><span>Thông báo</span></li>
              <li nz-menu-item routerLink="/warnings" (click)="closeDrawer()"><nz-icon nzType="warning" /><span>Cảnh báo</span></li>
            </ul>
          </li>
        }
      </ul>
    </ng-template>

    <nz-layout class="shell">
      @if (!isMobile()) {
        <nz-sider nzCollapsible [nzWidth]="220">
          <div class="logo">HungSilver</div>
          <ng-container [ngTemplateOutlet]="menu" />
        </nz-sider>
      }
      <nz-layout>
        <nz-header class="header">
          @if (isMobile()) {
            <button nz-button nzType="text" class="hamburger" (click)="drawerOpen.set(true)">
              <nz-icon nzType="menu" />
            </button>
          } @else {
            <span></span>
          }
          <span class="user" nz-dropdown [nzDropdownMenu]="userMenu" nzTrigger="click">
            <nz-avatar [nzSrc]="auth.currentUser()?.avatarUrl ?? undefined" nzIcon="user" nzSize="small" />
            <span class="user-name">{{ auth.currentUser()?.fullName || auth.currentUser()?.email }}</span>
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

    <nz-drawer
      [nzVisible]="drawerOpen()"
      nzPlacement="left"
      [nzClosable]="false"
      [nzWidth]="240"
      nzWrapClassName="nav-drawer"
      (nzOnClose)="drawerOpen.set(false)">
      <ng-container *nzDrawerContent>
        <div class="logo logo-drawer">HungSilver</div>
        <ng-container [ngTemplateOutlet]="menu" />
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .shell { min-height: 100vh; }
    .logo {
      height: 64px; display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 18px; font-weight: 600; letter-spacing: 1px;
    }
    .logo-drawer { background: #001529; }
    .header {
      background: #fff; padding: 0 16px; display: flex; align-items: center; justify-content: space-between;
    }
    .hamburger { font-size: 20px; }
    .user { cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
    .content { margin: 16px; padding: 16px; background: #fff; border-radius: 8px; }
    @media (max-width: 575px) {
      .user-name { display: none; }
      .content { margin: 8px; padding: 12px; }
    }
    :host ::ng-deep .nav-drawer .ant-drawer-body { padding: 0; background: #001529; }
  `
})
export class Shell {
  protected readonly auth = inject(AuthService);
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
