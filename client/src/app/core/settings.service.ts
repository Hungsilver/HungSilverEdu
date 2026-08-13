import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AppSetting, EffectiveSettings, MaterialUploadPolicy, MaterialUploadSource,
  SETTING_KEYS, SettingScope, UpsertSettingRequest
} from './models';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/settings`;

  /** Cache cấu hình hiệu lực toàn hệ thống — nhiều màn cùng cần, tránh gọi lại mỗi lần mở form. */
  private effective$?: Observable<EffectiveSettings>;

  getEffective(classId?: string): Observable<EffectiveSettings> {
    let params = new HttpParams();
    if (classId) params = params.set('classId', classId);
    return this.http.get<EffectiveSettings>(`${this.apiUrl}/effective`, { params });
  }

  /** Cấu hình hệ thống (không theo lớp) dùng chung, chỉ gọi API một lần cho tới khi có thay đổi. */
  getEffectiveCached(): Observable<EffectiveSettings> {
    this.effective$ ??= this.getEffective().pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.effective$;
  }

  /**
   * Cách nạp tài liệu đang được phép. Chỉ bật 1 cách ⇒ `singleMode` = true, form ẩn hẳn phần chọn nguồn.
   * Fallback an toàn: thiếu cấu hình thì coi như cho phép cả hai (giống mặc định của server).
   */
  getUploadPolicy(): Observable<MaterialUploadPolicy> {
    return this.getEffectiveCached().pipe(map(s => {
      const allowServerUpload = parseBool(s.values[SETTING_KEYS.allowServerUpload], true);
      const allowExternalUrl = parseBool(s.values[SETTING_KEYS.allowExternalUrl], true);
      const configured = s.values[SETTING_KEYS.defaultSource] === MaterialUploadSource.ExternalUrl
        ? MaterialUploadSource.ExternalUrl
        : MaterialUploadSource.ServerFile;

      // Cách mặc định phải nằm trong nhóm đang bật (server đã chặn, đây là lưới an toàn cho dữ liệu cũ).
      const defaultSource = (configured === MaterialUploadSource.ServerFile && allowServerUpload)
        || (configured === MaterialUploadSource.ExternalUrl && allowExternalUrl)
        ? configured
        : (allowServerUpload ? MaterialUploadSource.ServerFile : MaterialUploadSource.ExternalUrl);

      return {
        allowServerUpload,
        allowExternalUrl,
        defaultSource,
        singleMode: allowServerUpload !== allowExternalUrl
      };
    }));
  }

  getScope(scope: SettingScope, scopeId?: string): Observable<AppSetting[]> {
    let params = new HttpParams();
    if (scopeId) params = params.set('scopeId', scopeId);
    return this.http.get<AppSetting[]>(`${this.apiUrl}/scope/${scope}`, { params });
  }

  upsert(request: UpsertSettingRequest): Observable<AppSetting> {
    return this.http.put<AppSetting>(this.apiUrl, request).pipe(tap(() => this.invalidate()));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(tap(() => this.invalidate()));
  }

  /** Xóa cache sau khi ghi cấu hình để màn khác đọc được giá trị mới. */
  invalidate(): void {
    this.effective$ = undefined;
  }
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === null || raw === '') return fallback;
  return raw.trim().toLowerCase() === 'true';
}
