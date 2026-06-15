import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ApiProblem } from '../../core/models';
import { SessionsService } from '../../core/sessions.service';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-session-report-page',
  imports: [RouterLink, NzCardModule, NzButtonModule, NzIconModule, NzAlertModule, PageHeader],
  template: `
    <a [routerLink]="['/sessions', id()]" class="back"><nz-icon nzType="arrow-left" /> Về buổi học</a>
    <app-page-header title="Báo cáo buổi học" subtitle="Sinh báo cáo tự động để gửi phụ huynh" icon="file-text" />

    <button nz-button nzType="primary" [nzLoading]="loading()" (click)="generate()">
      <nz-icon nzType="file-text" /> Tạo báo cáo buổi học
    </button>

    @if (content()) {
      <nz-card class="mt">
        <pre class="report">{{ content() }}</pre>
        <div class="actions">
          <button nz-button (click)="copy()"><nz-icon nzType="copy" /> Sao chép nội dung</button>
          <button nz-button nzType="default" disabled><nz-icon nzType="mail" /> Gửi Email (Giai đoạn 2)</button>
        </div>
        <nz-alert nzType="info" class="mt"
          nzMessage="Zalo/Messenger: sao chép nội dung và dán thủ công. Gửi tự động qua Email/Zalo/Messenger sẽ có ở Giai đoạn 2." />
      </nz-card>
    }
  `,
  styles: `
    .back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px; }
    .mt { margin-top: 16px; }
    .report { white-space: pre-wrap; font-family: inherit; background: var(--hs-surface-2); border: 1px solid var(--hs-border); padding: 16px; border-radius: 8px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  `
})
export class SessionReportPage {
  readonly id = input.required<string>();
  private readonly sessionsService = inject(SessionsService);
  private readonly message = inject(NzMessageService);

  protected readonly loading = signal(false);
  protected readonly content = signal<string>('');

  protected generate(): void {
    this.loading.set(true);
    this.sessionsService.generateReport(this.id()).subscribe({
      next: r => { this.loading.set(false); this.content.set(r.content); },
      error: (err: HttpErrorResponse) => { this.loading.set(false); this.message.error((err.error as ApiProblem | null)?.detail ?? 'Tạo báo cáo thất bại.'); }
    });
  }

  protected copy(): void {
    navigator.clipboard.writeText(this.content()).then(
      () => this.message.success('Đã sao chép.'),
      () => this.message.error('Không sao chép được.')
    );
  }
}
