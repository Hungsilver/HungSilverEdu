import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Leaderboard, MonthlyEvaluation, UpsertEvaluationRequest } from './models';

@Injectable({ providedIn: 'root' })
export class EvaluationsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getByClassMonth(classId: string, year: number, month: number): Observable<MonthlyEvaluation[]> {
    const params = new HttpParams().set('classId', classId).set('year', year).set('month', month);
    return this.http.get<MonthlyEvaluation[]>(`${this.base}/evaluations`, { params });
  }

  getByStudent(studentId: string): Observable<MonthlyEvaluation[]> {
    return this.http.get<MonthlyEvaluation[]>(`${this.base}/evaluations/students/${studentId}`);
  }

  upsert(request: UpsertEvaluationRequest): Observable<MonthlyEvaluation> {
    return this.http.put<MonthlyEvaluation>(`${this.base}/evaluations`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/evaluations/${id}`);
  }

  getLeaderboard(classId?: string): Observable<Leaderboard> {
    let params = new HttpParams();
    if (classId) params = params.set('classId', classId);
    return this.http.get<Leaderboard>(`${this.base}/leaderboard`, { params });
  }
}
