import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzUploadModule, NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import { FilesService } from '../../core/files.service';
import { MaterialsService } from '../../core/materials.service';
import {
  CreateMaterialRequest, Grade, Material, MaterialSource, MaterialUnit, MaterialUploadPolicy,
  MaterialUploadSource, Subject, UpdateMaterialRequest
} from '../../core/models';
import { SettingsService } from '../../core/settings.service';
import { AvatarCropModal } from '../../shared/avatar-crop-modal';

/**
 * Form thêm/sửa tài liệu — DÙNG CHUNG cho tài liệu trong bộ và tài liệu chung
 * (trước đây là hai bản sao gần như giống hệt ở folder-detail và general-materials).
 *
 * Hình dạng form phụ thuộc cấu hình "Cách nạp tài liệu": chỉ bật một cách ⇒ ẩn hẳn phần chọn nguồn;
 * bật cả hai ⇒ hiện thanh chọn với cách mặc định đã cấu hình.
 */
@Component({
  selector: 'app-material-form-modal',
  imports: [
    ReactiveFormsModule, NzModalModule, NzFormModule, NzInputModule, NzSelectModule, NzRadioModule,
    NzUploadModule, NzButtonModule, NzIconModule, NzAlertModule, AvatarCropModal
  ],
  template: `
    <nz-modal
      [nzVisible]="visible"
      [nzTitle]="editing ? 'Sửa tài liệu' : 'Thêm tài liệu'"
      [nzOkLoading]="saving()"
      [nzOkDisabled]="form.invalid"
      [nzWidth]="580"
      (nzOnOk)="save()"
      (nzOnCancel)="close()">
      <form *nzModalContent nz-form nzLayout="vertical" [formGroup]="form">
        @if (editing; as m) {
          <nz-form-item>
            <nz-form-label>Mã tài liệu</nz-form-label>
            <nz-form-control><input nz-input [value]="m.code" disabled /></nz-form-control>
          </nz-form-item>
        }

        <nz-form-item>
          <nz-form-label nzRequired>Tên tài liệu</nz-form-label>
          <nz-form-control nzErrorTip="Nhập tên tài liệu">
            <input nz-input formControlName="title" placeholder="vd: Unit 5 — Vocabulary" />
          </nz-form-control>
        </nz-form-item>

        <!-- Tài liệu trong bộ kế thừa Môn/Khối từ bộ nên không hỏi lại. -->
        @if (!folderId) {
          <nz-form-item>
            <nz-form-label nzRequired>Môn học</nz-form-label>
            <nz-form-control nzErrorTip="Chọn môn học">
              <nz-select formControlName="subjectId" nzShowSearch nzPlaceHolder="Chọn môn học">
                @for (s of subjects; track s.id) { <nz-option [nzValue]="s.id" [nzLabel]="s.name" /> }
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label>Khối</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="gradeBand" nzAllowClear nzShowSearch nzPlaceHolder="Chọn khối (tùy chọn)">
                @for (g of grades; track g.id) { <nz-option [nzValue]="g.name" [nzLabel]="g.name" /> }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        } @else {
          <nz-form-item>
            <nz-form-label>Thuộc Unit</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="unitId" nzAllowClear nzPlaceHolder="— Chưa thuộc Unit —">
                @for (u of units; track u.id) {
                  <nz-option [nzValue]="u.id" [nzLabel]="unitLabel(u)" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        }

        <!-- Chỉ bật một cách nạp ⇒ ẩn hẳn phần chọn nguồn cho gọn. -->
        @if (!policy().singleMode) {
          <nz-form-item>
            <nz-form-label>Nguồn tài liệu</nz-form-label>
            <nz-form-control>
              <nz-radio-group formControlName="source">
                <label nz-radio-button [nzValue]="Source.ServerFile">Tải file lên</label>
                <label nz-radio-button [nzValue]="Source.ExternalUrl">Dán đường dẫn</label>
              </nz-radio-group>
            </nz-form-control>
          </nz-form-item>
        }

        @if (form.value.source === Source.ExternalUrl) {
          <nz-form-item>
            <nz-form-label nzRequired>Đường dẫn</nz-form-label>
            <nz-form-control nzErrorTip="Nhập đường dẫn tài liệu">
              <input nz-input formControlName="url" placeholder="https://drive.google.com/..." />
            </nz-form-control>
          </nz-form-item>
        } @else {
          <nz-form-item>
            <nz-form-label nzRequired>File tài liệu</nz-form-label>
            <nz-form-control>
              <nz-upload nzType="drag" [nzCustomRequest]="customUpload" [nzLimit]="1" [nzShowUploadList]="false">
                <p class="ant-upload-drag-icon"><nz-icon nzType="inbox" /></p>
                <p class="ant-upload-text">Kéo thả file vào đây hoặc bấm để chọn</p>
                <p class="ant-upload-hint">PDF, Word, ảnh…</p>
              </nz-upload>
              @if (uploadedFileName()) {
                <div class="uploaded"><nz-icon nzType="paper-clip" /> {{ uploadedFileName() }}</div>
              }
            </nz-form-control>
          </nz-form-item>
        }

        @if (showCover) {
          <nz-form-item>
            <nz-form-label>Ảnh bìa</nz-form-label>
            <nz-form-control>
              @if (coverFileId(); as cid) {
                <div class="cover-preview">
                  <img [src]="filesService.downloadUrl(cid)" alt="Ảnh bìa" />
                  <button nz-button nzSize="small" nzDanger type="button" (click)="coverFileId.set(null)">
                    <nz-icon nzType="delete" /> Xóa ảnh
                  </button>
                </div>
              }
              <nz-upload nzAccept=".jpg,.jpeg,.png,.gif,.webp" [nzShowUploadList]="false" [nzBeforeUpload]="beforeCoverUpload">
                <button nz-button type="button" [nzLoading]="coverUploading()">
                  <nz-icon nzType="picture" /> {{ coverFileId() ? 'Đổi ảnh bìa' : 'Chọn ảnh bìa (16:9)' }}
                </button>
              </nz-upload>
            </nz-form-control>
          </nz-form-item>
        }

        <nz-form-item>
          <nz-form-label>Mô tả</nz-form-label>
          <nz-form-control><input nz-input formControlName="description" /></nz-form-control>
        </nz-form-item>
      </form>
    </nz-modal>

    <app-avatar-crop-modal
      [visible]="coverCropVisible()" [imageFile]="coverSourceFile()"
      [aspectRatio]="16 / 9" [roundCropper]="false" [resizeToWidth]="1280"
      title="Cắt ảnh bìa" outputFileName="cover.png"
      (cropped)="onCoverCropped($event)" (cancelled)="coverCropVisible.set(false)" />
  `,
  styles: `
    nz-select, nz-radio-group { width: 100%; }
    .uploaded { margin-top: 8px; font-size: 13px; color: var(--hs-text-muted); }
    .cover-preview { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .cover-preview img { width: 160px; aspect-ratio: 16/9; object-fit: cover; border-radius: 8px; border: 1px solid var(--hs-border); }
  `
})
export class MaterialFormModal {
  private readonly fb = inject(FormBuilder);
  private readonly materialsService = inject(MaterialsService);
  private readonly settingsService = inject(SettingsService);
  private readonly message = inject(NzMessageService);
  protected readonly filesService = inject(FilesService);

  protected readonly Source = MaterialSource;

  @Input() visible = false;
  /** Tài liệu đang sửa; null = thêm mới. */
  @Input() editing: Material | null = null;
  /** Có giá trị ⇒ tài liệu thuộc bộ (Môn/Khối kế thừa từ bộ, form gọn). */
  @Input() folderId: string | null = null;
  @Input() units: MaterialUnit[] = [];
  @Input() subjects: Subject[] = [];
  @Input() grades: Grade[] = [];
  /** Ảnh bìa chỉ có ý nghĩa với lưới thẻ của tài liệu chung. */
  @Input() showCover = false;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<Material>();

  protected readonly saving = signal(false);
  protected readonly coverFileId = signal<string | null>(null);
  protected readonly coverUploading = signal(false);
  protected readonly coverCropVisible = signal(false);
  protected readonly coverSourceFile = signal<File | null>(null);
  protected readonly uploadedFileName = signal<string | null>(null);
  protected readonly policy = signal<MaterialUploadPolicy>({
    allowServerUpload: true, allowExternalUrl: true,
    defaultSource: MaterialUploadSource.ServerFile, singleMode: false
  });

  protected readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    subjectId: [null as string | null],
    gradeBand: [null as string | null],
    unitId: [null as string | null],
    source: [MaterialSource.ServerFile],
    url: [null as string | null],
    storedFileId: [null as string | null],
    description: [null as string | null]
  });

  /** Gọi từ component cha ngay trước khi bật `visible`. */
  open(preselectUnitId: string | null = null): void {
    const m = this.editing;
    this.uploadedFileName.set(m?.fileName ?? null);
    this.coverFileId.set(m?.coverFileId ?? null);

    this.form.reset({
      title: m?.title ?? '',
      subjectId: m?.subjectId ?? null,
      gradeBand: m?.gradeBand ?? null,
      unitId: m?.unitId ?? preselectUnitId,
      source: m?.source ?? MaterialSource.ServerFile,
      url: m?.url ?? null,
      storedFileId: m?.storedFileId ?? null,
      description: m?.description ?? null
    });

    // Tài liệu chung bắt buộc chọn Môn; tài liệu trong bộ kế thừa từ bộ nên bỏ ràng buộc.
    const subject = this.form.controls.subjectId;
    if (this.folderId) subject.clearValidators();
    else subject.setValidators(Validators.required);
    subject.updateValueAndValidity({ emitEvent: false });

    // Nạp cấu hình SAU khi reset: observable có cache nên lần mở thứ hai phát đồng bộ,
    // đặt trước reset sẽ bị reset ghi đè (và lần đầu thì ngược lại) — thứ tự này luôn đúng.
    this.settingsService.getUploadPolicy().subscribe(p => {
      this.policy.set(p);
      // Chỉ bật một cách ⇒ ép nguồn theo cấu hình. Thêm mới ⇒ chọn sẵn cách mặc định.
      // Đang SỬA và bật cả hai ⇒ giữ nguyên nguồn hiện tại của tài liệu.
      if (p.singleMode) this.form.patchValue({ source: asSource(p.defaultSource) });
      else if (!m) this.form.patchValue({ source: asSource(p.defaultSource) });
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected unitLabel(u: MaterialUnit): string {
    return u.kind === 'Review' ? `Review ${u.unitNo}` : `Unit ${u.unitNo}${u.name ? ': ' + u.name : ''}`;
  }

  protected readonly customUpload = (item: NzUploadXHRArgs): Subscription =>
    this.filesService.upload(item.file as unknown as File).subscribe({
      next: stored => {
        this.form.patchValue({ storedFileId: stored.id });
        this.uploadedFileName.set(stored.fileName);
        item.onSuccess?.(stored, item.file, null as never);
      },
      error: (err: HttpErrorResponse) => {
        this.message.error(err.error?.message ?? 'Tải file thất bại.');
        item.onError?.(err as never, item.file);
      }
    });

  protected readonly beforeCoverUpload = (file: unknown): boolean => {
    this.coverSourceFile.set(file as File);
    this.coverCropVisible.set(true);
    return false; // chặn upload mặc định — crop xong mới gửi
  };

  protected onCoverCropped(file: File): void {
    this.coverCropVisible.set(false);
    this.coverUploading.set(true);
    this.materialsService.uploadCover(file).subscribe({
      next: stored => { this.coverFileId.set(stored.id); this.coverUploading.set(false); },
      error: (err: HttpErrorResponse) => {
        this.coverUploading.set(false);
        this.message.error(err.error?.message ?? 'Tải ảnh bìa thất bại.');
      }
    });
  }

  protected save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();

    if (v.source === MaterialSource.ExternalUrl && !v.url?.trim()) {
      this.message.error('Nhập đường dẫn tài liệu.');
      return;
    }
    if (v.source === MaterialSource.ServerFile && !v.storedFileId) {
      this.message.error('Chọn file tài liệu.');
      return;
    }

    const body: CreateMaterialRequest & UpdateMaterialRequest = {
      subjectId: this.folderId ? null : v.subjectId,
      gradeBand: this.folderId ? null : v.gradeBand,
      title: v.title.trim(),
      source: v.source,
      url: v.source === MaterialSource.ExternalUrl ? v.url!.trim() : null,
      storedFileId: v.source === MaterialSource.ServerFile ? v.storedFileId : null,
      description: v.description?.trim() || null,
      coverFileId: this.coverFileId(),
      folderId: this.folderId,
      unitId: this.folderId ? v.unitId : null
    };

    const op = this.editing
      ? this.materialsService.update(this.editing.id, body)
      : this.materialsService.create(body);

    this.saving.set(true);
    op.subscribe({
      next: saved => {
        this.saving.set(false);
        this.message.success(this.editing ? 'Đã cập nhật tài liệu.' : 'Đã thêm tài liệu.');
        this.saved.emit(saved);
        this.close();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.message.error(err.error?.message ?? err.message);
      }
    });
  }
}

function asSource(s: MaterialUploadSource): MaterialSource {
  return s === MaterialUploadSource.ExternalUrl ? MaterialSource.ExternalUrl : MaterialSource.ServerFile;
}
