import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Warnings } from './models';

@Injectable({ providedIn: 'root' })
export class WarningsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/warnings`;

  getWarnings(classId?: string): Observable<Warnings> {
    let params = new HttpParams();
    if (classId) params = params.set('classId', classId);
    return this.http.get<Warnings>(this.apiUrl, { params });
  }
}
