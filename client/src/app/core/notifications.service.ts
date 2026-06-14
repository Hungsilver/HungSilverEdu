import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateNotificationRequest, NotificationResult } from './models';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/notifications`;

  send(request: CreateNotificationRequest): Observable<NotificationResult> {
    return this.http.post<NotificationResult>(this.apiUrl, request);
  }
}
