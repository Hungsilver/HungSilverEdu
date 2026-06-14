import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, viewChild } from '@angular/core';
import * as echarts from 'echarts/core';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { BarChart, LineChart, RadarChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart, BarChart, RadarChart,
  GridComponent, TooltipComponent, LegendComponent, TitleComponent,
  CanvasRenderer
]);

/** Bao bọc ECharts theo kiểu signal (zoneless): truyền option qua [option]. */
@Component({
  selector: 'app-chart',
  template: `<div #host class="chart-host"></div>`,
  styles: `
    :host { display: block; width: 100%; }
    .chart-host { width: 100%; height: 100%; min-height: 280px; }
  `
})
export class Chart {
  readonly option = input.required<EChartsCoreOption>();
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private instance?: ECharts;
  private resizeObserver?: ResizeObserver;

  constructor() {
    afterNextRender(() => {
      this.instance = echarts.init(this.host().nativeElement);
      this.instance.setOption(this.option());
      this.resizeObserver = new ResizeObserver(() => this.instance?.resize());
      this.resizeObserver.observe(this.host().nativeElement);
    });

    effect(() => {
      const opt = this.option();
      this.instance?.setOption(opt, true);
    });

    inject(DestroyRef).onDestroy(() => {
      this.resizeObserver?.disconnect();
      this.instance?.dispose();
    });
  }
}
