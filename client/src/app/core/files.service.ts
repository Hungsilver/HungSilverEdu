import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { StoredFile } from './models';

@Injectable({ providedIn: 'root' })
export class FilesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/files`;

  /** Chỉ thành công khi Admin cấu hình FileStorage.Mode = Server. */
  upload(file: File): Observable<StoredFile> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<StoredFile>(this.apiUrl, form);
  }

  downloadUrl(id: string): string {
    return `${this.apiUrl}/${id}`;
  }
}
