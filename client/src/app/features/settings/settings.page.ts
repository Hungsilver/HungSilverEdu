import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { PageHeader } from '../../shared/page-header';
import { SettingsAccountTab } from './settings-account.tab';
import { SettingsCatalogTab } from './settings-catalog.tab';
import { SettingsGradingTab } from './settings-grading.tab';
import { SettingsMaterialsTab } from './settings-materials.tab';
import { SettingsScheduleTab } from './settings-schedule.tab';

/** Thứ tự tab cố định — map giữa nzSelectedIndex và query param ?tab= (share URL/back giữ đúng tab). */
const TAB_KEYS = ['account', 'materials', 'catalog', 'schedule', 'grading'] as const;

/**
 * Cấu hình hệ thống — gom theo nhóm chức năng thay vì một trang cuộn dài.
 * Mỗi tab tự nạp dữ liệu và có nút Lưu riêng đúng phạm vi của nó.
 */
@Component({
  selector: 'app-settings-page',
  imports: [
    NzTabsModule, PageHeader,
    SettingsAccountTab, SettingsMaterialsTab, SettingsCatalogTab, SettingsScheduleTab, SettingsGradingTab
  ],
  template: `
    <app-page-header title="Cấu hình hệ thống" subtitle="Tài khoản, kho tài liệu, danh mục, lịch và điểm" icon="setting" />

    <nz-tabs class="module-tabs" nzType="line" [nzSelectedIndex]="tabIndex()" (nzSelectedIndexChange)="onTabChange($event)">
      <nz-tab nzTitle="Tài khoản">
        <ng-template nz-tab><app-settings-account-tab /></ng-template>
      </nz-tab>

      <nz-tab nzTitle="Kho tài liệu">
        <ng-template nz-tab><app-settings-materials-tab /></ng-template>
      </nz-tab>

      <nz-tab nzTitle="Danh mục">
        <ng-template nz-tab><app-settings-catalog-tab /></ng-template>
      </nz-tab>

      <nz-tab nzTitle="Lịch &amp; Ca học">
        <ng-template nz-tab><app-settings-schedule-tab /></ng-template>
      </nz-tab>

      <nz-tab nzTitle="Học phí &amp; Điểm">
        <ng-template nz-tab><app-settings-grading-tab /></ng-template>
      </nz-tab>
    </nz-tabs>
  `
})
export class SettingsPage {
  private readonly router = inject(Router);

  readonly tab = input<string | undefined>();

  protected readonly tabIndex = computed(() => {
    const i = TAB_KEYS.indexOf((this.tab() ?? 'account') as (typeof TAB_KEYS)[number]);
    return i < 0 ? 0 : i;
  });

  protected onTabChange(index: number): void {
    this.router.navigate([], { queryParams: { tab: TAB_KEYS[index] ?? 'account' }, queryParamsHandling: 'merge' });
  }
}
