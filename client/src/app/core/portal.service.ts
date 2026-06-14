import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PortalProfile } from './models';

@Injectable({ providedIn: 'root' })
export class PortalService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/portal`;

  me(): Observable<PortalProfile> {
    return this.http.get<PortalProfile>(`${this.apiUrl}/me`);
  }
}
