import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AiCredential, SaveAiCredentialRequest, ValidateAiKeyResult } from './models';

/**
 * Cấu hình API Key Google Gemini theo tài khoản hiện tại.
 * Mọi thao tác đều áp lên user đang đăng nhập (BE lấy từ JWT) — không truyền userId.
 */
@Injectable({ providedIn: 'root' })
export class AiCredentialService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/ai-credential`;

  /** Trạng thái key hiện tại (đã che, không lộ key thô). */
  get(): Observable<AiCredential> {
    return this.http.get<AiCredential>(this.apiUrl);
  }

  /** Lưu/cập nhật key (BE mã hóa khi lưu, chỉ giữ 4 ký tự cuối để hiển thị). */
  save(request: SaveAiCredentialRequest): Observable<AiCredential> {
    return this.http.put<AiCredential>(this.apiUrl, request);
  }

  /** Kiểm tra live key đang lưu với Google Gemini (cập nhật lastValidatedAt/isValid). */
  validate(): Observable<ValidateAiKeyResult> {
    return this.http.post<ValidateAiKeyResult>(`${this.apiUrl}/validate`, {});
  }

  /** Xóa mềm cấu hình key. */
  remove(): Observable<void> {
    return this.http.delete<void>(this.apiUrl);
  }
}
