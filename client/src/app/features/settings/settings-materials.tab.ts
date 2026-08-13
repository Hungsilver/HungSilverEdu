import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { MaterialUploadSource, SETTING_KEYS, SettingScope, UpsertSettingRequest } from '../../core/models';
import { SettingsService } from '../../core/settings.service';

/**
 * Cách nạp tài liệu vào Kho. Bật cách nào thì form thêm tài liệu hiện đúng cách đó;
 * chỉ bật một cách ⇒ form ẩn hẳn phần chọn nguồn cho gọn. Không được tắt cả hai.
 */
@Component({
  selector: 'app-settings-materials-tab',
  imports: [
    FormsModule, NzCardModule, NzFormModule, NzCheckboxModule, NzRadioModule,
    NzButtonModule, NzIconModule, NzAlertModule
  ],
  template: `
    <nz-card nzTitle="Cách nạp tài liệu" class="cfg-card">
      <p class="hint">
        Người dùng chỉ thấy những cách được bật ở đây khi thêm tài liệu vào Kho.
        Bật cả hai sẽ có thanh chọn nguồn; chỉ bật một thì form gọn lại còn đúng một ô.
      </p>

      <div class="opt">
        <label nz-checkbox [(ngModel)]="allowServerUpload">
          <b>Tải file lên server</b>
        </label>
        <span class="opt-desc">PDF, Word, ảnh… Cần bật nếu muốn sinh đề bằng AI từ tài liệu trong Kho.</span>
      </div>

      <div class="opt">
        <label nz-checkbox [(ngModel)]="allowExternalUrl">
          <b>Dán đường dẫn ngoài</b>
        </label>
        <span class="opt-desc">Google Drive, YouTube, trang web… hệ thống chỉ lưu liên kết.</span>
      </div>

      @if (bothEnabled()) {
        <nz-form-item style="margin-top:14px">
          <nz-form-label>Cách chọn sẵn khi thêm tài liệu</nz-form-label>
          <nz-form-control>
            <nz-radio-group [(ngModel)]="defaultSource">
              <label nz-radio-button [nzValue]="Source.ServerFile">Tải file lên</label>
              <label nz-radio-button [nzValue]="Source.ExternalUrl">Dán đường dẫn</label>
            </nz-radio-group>
          </nz-form-control>
        </nz-form-item>
      }

      @if (!allowServerUpload && !allowExternalUrl) {
        <nz-alert nzType="error" nzMessage="Phải bật ít nhất một cách nạp tài liệu." style="margin-top:12px" />
      }

      @if (!allowServerUpload) {
        <nz-alert
          nzType="warning"
          nzMessage="Đang tắt tải file lên server"
          nzDescription="Tài liệu mới chỉ nhận đường dẫn ngoài. Sinh đề bằng AI vẫn dùng được qua tùy chọn “Tải lên file chỉ có câu hỏi” trong cửa sổ tạo đề (file đó không nhập kho)."
          style="margin-top:12px" />
      }

      <div class="cfg-actions">
        <button nz-button nzType="primary" [nzLoading]="saving()" [disabled]="!valid()" (click)="save()">Lưu</button>
      </div>
    </nz-card>
  `,
  styles: `
    .cfg-card { max-width: 680px; }
    .hint { color: var(--hs-text-muted); font-size: 13px; margin: 0 0 16px; }
    .opt { padding: 10px 0; border-top: 1px solid var(--hs-border); }
    .opt:first-of-type { border-top: 0; }
    .opt-desc { display: block; margin-left: 24px; font-size: 12.5px; color: var(--hs-text-muted); }
    .cfg-actions { display: flex; justify-content: flex-end; margin-top: 18px; }
  `
})
export class SettingsMaterialsTab implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly message = inject(NzMessageService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly Source = MaterialUploadSource;
  protected readonly saving = signal(false);

  protected allowServerUpload = true;
  protected allowExternalUrl = true;
  protected defaultSource: MaterialUploadSource = MaterialUploadSource.ServerFile;

  // Getter chứ không phải computed: giá trị đến từ ngModel (không phải signal) nên computed sẽ không tính lại.
  protected bothEnabled(): boolean { return this.allowServerUpload && this.allowExternalUrl; }
  protected valid(): boolean { return this.allowServerUpload || this.allowExternalUrl; }

  ngOnInit(): void {
    this.settingsService.getUploadPolicy().subscribe(p => {
      this.allowServerUpload = p.allowServerUpload;
      this.allowExternalUrl = p.allowExternalUrl;
      this.defaultSource = p.defaultSource;
      this.cdr.markForCheck();
    });
  }

  protected save(): void {
    if (!this.allowServerUpload && !this.allowExternalUrl) {
      this.message.error('Phải bật ít nhất một cách nạp tài liệu.');
      return;
    }

    // Cách mặc định phải nằm trong nhóm đang bật (server cũng chặn — đây là chỉnh cho êm).
    let source = this.defaultSource;
    if (source === MaterialUploadSource.ServerFile && !this.allowServerUpload) source = MaterialUploadSource.ExternalUrl;
    if (source === MaterialUploadSource.ExternalUrl && !this.allowExternalUrl) source = MaterialUploadSource.ServerFile;

    const sys = (key: string, value: string): UpsertSettingRequest =>
      ({ key, value, scope: SettingScope.System, scopeId: null, dataType: null, description: null });

    // Lưu TUẦN TỰ: server chặn "tắt cả hai" bằng cách đọc giá trị khóa còn lại,
    // gửi song song có thể đọc phải trạng thái cũ và từ chối oan.
    this.saving.set(true);
    const finish = () => {
      this.saving.set(false);
      this.defaultSource = source;
      this.message.success('Đã lưu cách nạp tài liệu.');
    };
    const fail = (err: HttpErrorResponse) => {
      this.saving.set(false);
      this.message.error(err.error?.message ?? err.message);
    };

    // Bật trước, tắt sau — tránh thời điểm trung gian cả hai cùng tắt.
    const first = this.allowServerUpload ? SETTING_KEYS.allowServerUpload : SETTING_KEYS.allowExternalUrl;
    const second = first === SETTING_KEYS.allowServerUpload ? SETTING_KEYS.allowExternalUrl : SETTING_KEYS.allowServerUpload;
    const valueOf = (key: string) =>
      String(key === SETTING_KEYS.allowServerUpload ? this.allowServerUpload : this.allowExternalUrl);

    this.settingsService.upsert(sys(first, valueOf(first))).subscribe({
      next: () => this.settingsService.upsert(sys(second, valueOf(second))).subscribe({
        next: () => this.settingsService.upsert(sys(SETTING_KEYS.defaultSource, source)).subscribe({ next: finish, error: fail }),
        error: fail
      }),
      error: fail
    });
  }
}
