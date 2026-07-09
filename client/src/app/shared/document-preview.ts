import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { FilesService } from '../core/files.service';

/** Đuôi file xem được qua endpoint /preview (PDF inline; Word/ODT/RTF/TXT server chuyển PDF). */
const PREVIEWABLE_EXTS = ['.pdf', '.doc', '.docx', '.odt', '.rtf', '.txt'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

export interface DocumentPreviewOptions {
  /** Id file trên server (StoredFile) — cách mở thông thường. */
  fileId?: string;
  /** URL preview PDF trực tiếp (vd SourceFilePreviewUrl của đề) — dùng thay fileId. */
  previewUrl?: string;
  /** URL tải file gốc khi mở bằng previewUrl. */
  downloadUrl?: string;
  title: string;
  /** Tên file gốc — dùng suy loại hiển thị (pdf/ảnh/khác) và đặt tên khi tải xuống. */
  fileName?: string | null;
}

/**
 * Trình xem tài liệu FULL MÀN HÌNH dùng chung (nút con mắt ở Kho tài liệu...):
 * PDF/Word/ODT/RTF/TXT xem qua /api/files/{id}/preview (iframe PDF), ảnh xem trực tiếp (img),
 * loại khác hiện thông báo + nút tải xuống. Nhúng `<app-document-preview />` rồi gọi `open(...)`.
 */
@Component({
  selector: 'app-document-preview',
  imports: [NzAlertModule, NzButtonModule, NzIconModule, NzModalModule, NzSpinModule],
  template: `
    <nz-modal [nzVisible]="visible()" [nzTitle]="headerTpl" [nzFooter]="null" [nzWidth]="'100vw'"
      nzWrapClassName="hs-modal-fullscreen" (nzOnCancel)="close()">
      <ng-template #headerTpl>
        <div class="dp-header">
          <span class="dp-title">{{ title() }}</span>
          <button nz-button nzSize="small" (click)="download()"><nz-icon nzType="download" /> Tải xuống</button>
        </div>
      </ng-template>
      <ng-container *nzModalContent>
        @if (loading()) {
          <div class="dp-center"><nz-spin nzSimple /></div>
        } @else if (error()) {
          <div class="dp-center dp-error">
            <nz-alert nzType="warning" [nzMessage]="error()" nzShowIcon />
            <button nz-button nzType="primary" (click)="download()"><nz-icon nzType="download" /> Tải xuống</button>
          </div>
        } @else if (frameUrl(); as url) {
          <iframe class="dp-frame" [src]="url" title="Xem tài liệu"></iframe>
        } @else if (imageUrl(); as img) {
          <div class="dp-image-wrap"><img class="dp-image" [src]="img" [alt]="title()" /></div>
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .dp-header { display: flex; align-items: center; gap: 12px; padding-right: 24px; min-width: 0; }
    .dp-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dp-center { flex: 1; display: grid; place-items: center; gap: 12px; align-content: center; padding: 24px; }
    .dp-error { text-align: center; }
    .dp-frame { flex: 1; width: 100%; border: 0; }
    .dp-image-wrap { flex: 1; overflow: auto; display: flex; align-items: flex-start; justify-content: center; background: #1f1f1f; }
    .dp-image { max-width: 100%; height: auto; }
  `
})
export class DocumentPreview {
  private readonly filesService = inject(FilesService);
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly visible = signal(false);
  protected readonly title = signal('Xem tài liệu');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly frameUrl = signal<SafeResourceUrl | null>(null);
  protected readonly imageUrl = signal<string | null>(null);

  private opts: DocumentPreviewOptions | null = null;
  private objectUrl: string | null = null;
  private requestId = 0;

  constructor() {
    this.destroyRef.onDestroy(() => this.revokeUrl());
  }

  /** Mở trình xem full màn hình cho một file đã lưu trên server. */
  open(opts: DocumentPreviewOptions): void {
    this.opts = opts;
    this.revokeUrl();
    this.title.set(opts.title);
    this.visible.set(true);
    this.loading.set(true);
    this.error.set(null);
    this.frameUrl.set(null);
    this.imageUrl.set(null);
    const requestId = ++this.requestId;

    // Mở theo URL preview trực tiếp (luôn là PDF do server trả) — vd tài liệu gốc của đề.
    if (opts.previewUrl) {
      this.http.get(opts.previewUrl, { responseType: 'blob' }).subscribe({
        next: blob => {
          if (requestId !== this.requestId || !this.visible()) return;
          this.objectUrl = URL.createObjectURL(blob);
          this.frameUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
          this.loading.set(false);
        },
        error: async err => {
          if (requestId !== this.requestId || !this.visible()) return;
          this.loading.set(false);
          this.error.set(await this.filesService.errorMessage(err, 'Không xem trước được tài liệu này.'));
        }
      });
      return;
    }

    const fileId = opts.fileId;
    if (!fileId) {
      this.loading.set(false);
      this.error.set('Thiếu nguồn tài liệu để hiển thị.');
      return;
    }

    const ext = this.extOf(opts.fileName ?? opts.title);
    if (IMAGE_EXTS.includes(ext)) {
      // Ảnh: endpoint /preview không nhận — tải blob thường rồi hiển thị trực tiếp.
      this.filesService.downloadBlob(fileId).subscribe({
        next: blob => {
          if (requestId !== this.requestId || !this.visible()) return;
          this.objectUrl = URL.createObjectURL(blob);
          this.imageUrl.set(this.objectUrl);
          this.loading.set(false);
        },
        error: async err => {
          if (requestId !== this.requestId || !this.visible()) return;
          this.loading.set(false);
          this.error.set(await this.filesService.errorMessage(err, 'Không xem được tài liệu này.'));
        }
      });
      return;
    }

    if (!PREVIEWABLE_EXTS.includes(ext)) {
      this.loading.set(false);
      this.error.set('File này chưa hỗ trợ xem trực tiếp. Vui lòng tải xuống để mở.');
      return;
    }

    this.filesService.preview(fileId).subscribe({
      next: blob => {
        if (requestId !== this.requestId || !this.visible()) return;
        this.objectUrl = URL.createObjectURL(blob);
        this.frameUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
        this.loading.set(false);
      },
      error: async err => {
        if (requestId !== this.requestId || !this.visible()) return;
        this.loading.set(false);
        this.error.set(await this.filesService.errorMessage(err, 'Không xem trước được tài liệu này.'));
      }
    });
  }

  protected close(): void {
    this.requestId++;
    this.visible.set(false);
    this.loading.set(false);
    this.error.set(null);
    this.frameUrl.set(null);
    this.imageUrl.set(null);
    this.revokeUrl();
  }

  protected download(): void {
    if (!this.opts) return;
    if (this.opts.fileId) {
      this.filesService.download(this.opts.fileId, this.opts.fileName ?? this.opts.title);
      return;
    }
    if (!this.opts.downloadUrl) return;
    const fileName = this.opts.fileName ?? this.opts.title;
    this.http.get(this.opts.downloadUrl, { responseType: 'blob' }).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  private extOf(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot).toLowerCase() : '';
  }

  private revokeUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
