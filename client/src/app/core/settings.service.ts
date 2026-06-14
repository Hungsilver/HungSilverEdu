import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppSetting, EffectiveSettings, SettingScope, UpsertSettingRequest } from './models';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/settings`;

  getEffective(classId?: string): Observable<EffectiveSettings> {
    let params = new HttpParams();
    if (classId) params = params.set('classId', classId);
    return this.http.get<EffectiveSettings>(`${this.apiUrl}/effective`, { params });
  }

  getScope(scope: SettingScope, scopeId?: string): Observable<AppSetting[]> {
    let params = new HttpParams();
    if (scopeId) params = params.set('scopeId', scopeId);
    return this.http.get<AppSetting[]>(`${this.apiUrl}/scope/${scope}`, { params });
  }

  upsert(request: UpsertSettingRequest): Observable<AppSetting> {
    return this.http.put<AppSetting>(this.apiUrl, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
