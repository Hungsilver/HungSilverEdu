import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserDto } from './models';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/profile`;

  /** Upload ảnh đại diện lên server; trả về thông tin user mới (đã có avatarUrl). */
  uploadAvatar(file: File): Observable<UserDto> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<UserDto>(`${this.apiUrl}/avatar`, form);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/password`, { currentPassword, newPassword });
  }
}
