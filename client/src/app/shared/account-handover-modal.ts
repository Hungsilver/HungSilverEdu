import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { BulkProvisionItem } from '../core/models';

/**
 * Bảng bàn giao sau khi cấp tài khoản — hiển thị tên đăng nhập VÀ mật khẩu vừa đặt để người quản lý
 * phát cho học viên/giáo viên. Mật khẩu chỉ có ở đây một lần: hệ thống không lưu và không đọc lại được.
 *
 * Dùng chung cho cấp đơn lẻ và cấp hàng loạt, ở trang Học viên, Giáo viên và Chi tiết lớp.
 */
@Component({
  selector: 'app-account-handover-modal',
  imports: [NzModalModule, NzTableModule, NzTagModule, NzButtonModule, NzIconModule, NzAlertModule],
  template: `
    <nz-modal
      [nzVisible]="visible"
      [nzTitle]="title"
      [nzWidth]="860"
      [nzFooter]="footer"
      (nzOnCancel)="close()">
      <div *nzModalContent>
        <nz-alert
          [nzType]="failedCount() > 0 ? 'warning' : 'success'"
          [nzMessage]="summary()"
          nzDescription="Mật khẩu chỉ hiện một lần tại đây. Người dùng bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên."
          style="margin-bottom:14px" />

        <nz-table [nzData]="items" nzSize="small" [nzShowPagination]="false" [nzScroll]="{ y: '420px' }">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th style="width:170px">Mã</th>
              <th style="width:190px">Tên đăng nhập</th>
              <th style="width:170px">Mật khẩu</th>
              <th style="width:200px">Kết quả</th>
            </tr>
          </thead>
          <tbody>
            @for (r of items; track r.id) {
              <tr>
                <td><b>{{ r.fullName || '—' }}</b></td>
                <td class="mono">{{ r.code || '—' }}</td>
                <td class="mono">{{ r.userName || '—' }}</td>
                <td class="mono">{{ r.password || '—' }}</td>
                <td>
                  @if (r.success) {
                    <nz-tag nzColor="success">Thành công</nz-tag>
                  } @else {
                    <nz-tag nzColor="error">{{ r.error || 'Thất bại' }}</nz-tag>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </div>
    </nz-modal>

    <ng-template #footer>
      <button nz-button (click)="copyAll()"><nz-icon nzType="copy" /> Copy tất cả</button>
      <button nz-button (click)="exportCsv()"><nz-icon nzType="download" /> Xuất Excel</button>
      <button nz-button (click)="print()"><nz-icon nzType="printer" /> In</button>
      <button nz-button nzType="primary" (click)="close()">Xong</button>
    </ng-template>
  `,
  styles: `
    .mono { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 12.5px; }
  `
})
export class AccountHandoverModal {
  private readonly message = inject(NzMessageService);

  @Input() visible = false;
  @Input() title = 'Bàn giao tài khoản';
  @Input() items: BulkProvisionItem[] = [];

  @Output() readonly closed = new EventEmitter<void>();

  protected readonly successCount = computed(() => this.items.filter(i => i.success).length);
  protected readonly failedCount = computed(() => this.items.filter(i => !i.success).length);

  protected readonly summary = computed(() => {
    const ok = this.items.filter(i => i.success).length;
    const bad = this.items.length - ok;
    return bad > 0
      ? `Cấp thành công ${ok} tài khoản, ${bad} trường hợp lỗi (xem cột Kết quả).`
      : `Đã cấp ${ok} tài khoản. Gửi thông tin dưới đây cho người dùng.`;
  });

  protected close(): void {
    this.closed.emit();
  }

  /** TSV để dán thẳng vào Excel/Sheets. */
  protected copyAll(): void {
    const text = ['Họ tên\tMã\tTên đăng nhập\tMật khẩu\tKết quả']
      .concat(this.items.map(r => [
        r.fullName ?? '', r.code ?? '', r.userName ?? '', r.password ?? '',
        r.success ? 'Thành công' : (r.error ?? 'Thất bại')
      ].join('\t')))
      .join('\n');

    navigator.clipboard?.writeText(text).then(
      () => this.message.success('Đã sao chép — dán thẳng vào Excel được.'),
      () => this.message.error('Trình duyệt không cho sao chép. Hãy dùng nút Xuất Excel.')
    );
  }

  /** CSV có BOM UTF-8 để Excel mở không lỗi tiếng Việt. */
  protected exportCsv(): void {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [['Họ tên', 'Mã', 'Tên đăng nhập', 'Mật khẩu', 'Kết quả']]
      .concat(this.items.map(r => [
        r.fullName ?? '', r.code ?? '', r.userName ?? '', r.password ?? '',
        r.success ? 'Thành công' : (r.error ?? 'Thất bại')
      ]))
      .map(cols => cols.map(esc).join(','))
      .join('\r\n');

    const blob = new Blob(['﻿' + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tai-khoan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected print(): void {
    const rows = this.items.map(r => `
      <tr>
        <td>${escapeHtml(r.fullName ?? '')}</td>
        <td>${escapeHtml(r.code ?? '')}</td>
        <td>${escapeHtml(r.userName ?? '')}</td>
        <td>${escapeHtml(r.password ?? '')}</td>
      </tr>`).join('');

    const win = window.open('', '_blank');
    if (!win) { this.message.warning('Trình duyệt chặn cửa sổ in.'); return; }
    win.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8">
      <title>${escapeHtml(this.title)}</title>
      <style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:13px}th{background:#f5f5f5}</style>
      </head><body><h2>${escapeHtml(this.title)}</h2>
      <table><thead><tr><th>Họ tên</th><th>Mã</th><th>Tên đăng nhập</th><th>Mật khẩu</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
    win.document.close();
    win.print();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
