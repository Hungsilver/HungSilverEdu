import { Component, input } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

/**
 * Tiêu đề trang dùng chung: badge icon + tiêu đề + mô tả, kèm slot nút hành động (ng-content).
 * Thay cụm `.page-header > h2 + .actions` lặp ở các trang để đồng nhất & responsive.
 */
@Component({
  selector: 'app-page-header',
  imports: [NzIconModule],
  template: `
    <div class="ph">
      <div class="ph-left">
        @if (icon()) {
          <span class="ph-badge"><nz-icon [nzType]="icon()!" /></span>
        }
        <div class="ph-text">
          <h2 class="ph-title">{{ title() }}</h2>
          @if (subtitle()) {
            <p class="ph-sub">{{ subtitle() }}</p>
          }
        </div>
      </div>
      <div class="ph-actions"><ng-content /></div>
    </div>
  `,
  styles: `
    .ph {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; flex-wrap: wrap; margin-bottom: 20px;
    }
    .ph-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .ph-badge {
      width: 44px; height: 44px; flex: 0 0 44px; border-radius: 12px;
      display: grid; place-items: center; font-size: 22px;
      background: var(--hs-primary-weak); color: var(--hs-primary);
    }
    .ph-text { min-width: 0; }
    .ph-title { margin: 0; font-size: 22px; font-weight: 700; line-height: 1.2; }
    .ph-sub { margin: 2px 0 0; color: var(--hs-text-muted); font-size: 13px; }
    .ph-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    @media (max-width: 575px) {
      .ph-actions { width: 100%; }
    }
  `
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly icon = input<string>();
}
