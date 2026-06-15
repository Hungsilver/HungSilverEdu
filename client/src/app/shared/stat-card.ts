import { Component, computed, input } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';

/** Thẻ số liệu tổng quan: badge icon màu + tiêu đề + giá trị. Dùng cho Dashboard và các khối tổng hợp. */
@Component({
  selector: 'app-stat-card',
  imports: [NzCardModule, NzIconModule],
  template: `
    <nz-card class="stat">
      <div class="stat-row">
        <span class="stat-badge" [style.background]="tint()" [style.color]="color()">
          <nz-icon [nzType]="icon()" />
        </span>
        <div class="stat-body">
          <div class="stat-title">{{ title() }}</div>
          <div class="stat-value">{{ value() }}</div>
        </div>
      </div>
    </nz-card>
  `,
  styles: `
    .stat-row { display: flex; align-items: center; gap: 14px; }
    .stat-badge {
      width: 48px; height: 48px; flex: 0 0 48px; border-radius: 14px;
      display: grid; place-items: center; font-size: 24px;
    }
    .stat-body { min-width: 0; }
    .stat-title { color: var(--hs-text-muted); font-size: 13px; line-height: 1.3; }
    .stat-value { color: var(--hs-heading); font-size: 26px; font-weight: 700; line-height: 1.25; }
    @media (max-width: 575px) {
      .stat-badge { width: 40px; height: 40px; flex-basis: 40px; font-size: 20px; }
      .stat-value { font-size: 22px; }
    }
  `
})
export class StatCard {
  readonly title = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input.required<string>();
  readonly color = input<string>('#4f46e5');

  /** Nền badge = màu chính pha loãng (~12% alpha). */
  protected readonly tint = computed(() => `${this.color()}1f`);
}
