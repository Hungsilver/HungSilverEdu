import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { StoredFile } from './models';

/** Phần mở rộng được phép — khớp FileStorage.AllowedExtensions ở backend. */
export const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.zip'
];

/** Chuỗi cho thuộc tính nzAccept / input[accept]. */
export const ACCEPT_ATTR = ALLOWED_EXTENSIONS.join(',');

/** Dung lượng tối đa mỗi file (20MB) — khớp FileStorage.MaxSizeBytes. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

@Injectable({ providedIn: 'root' })
export class FilesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/files`;

  /** Upload file. Mọi user đã đăng nhập đều gọi được; chỉ thành công khi Admin đặt FileStorage.Mode = Server. */
  upload(file: File): Observable<StoredFile> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<StoredFile>(this.apiUrl, form);
  }

  /** URL trực tiếp — chỉ dùng cho file công khai (ảnh đại diện hiển thị qua thẻ &lt;img&gt;). */
  downloadUrl(id: string): string {
    return `${this.apiUrl}/${id}`;
  }

  /**
   * Tải file cần xác thực về máy (gửi kèm Bearer qua interceptor) — dùng cho file Authenticated/Restricted.
   * Subscribe một lần bên trong để tránh gọi API hai lần.
   */
  download(id: string, fileName?: string): void {
    this.http.get(`${this.apiUrl}/${id}`, { responseType: 'blob' }).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName ?? id;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  /** Kiểm tra phía client trước khi upload. Trả message lỗi tiếng Việt, hoặc null nếu hợp lệ. */
  validate(file: File): string | null {
    const dot = file.name.lastIndexOf('.');
    const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
    if (!ALLOWED_EXTENSIONS.includes(ext))
      return `Không cho phép loại file "${ext || file.name}".`;
    if (file.size > MAX_UPLOAD_BYTES)
      return `File vượt quá ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.`;
    return null;
  }
}
