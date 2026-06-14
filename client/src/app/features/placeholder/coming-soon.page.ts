import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzResultModule } from 'ng-zorro-antd/result';

@Component({
  selector: 'app-coming-soon-page',
  imports: [NzResultModule],
  template: `
    <nz-result nzStatus="info" [nzTitle]="title" nzSubTitle="Tính năng đang được phát triển (Giai đoạn 2).">
    </nz-result>
  `
})
export class ComingSoonPage {
  private readonly route = inject(ActivatedRoute);
  protected readonly title = (this.route.snapshot.data['title'] as string) ?? 'Sắp ra mắt';
}
