import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { ImageCroppedEvent, ImageCropperComponent, ImageTransform } from 'ngx-image-cropper';

@Component({
  selector: 'app-avatar-crop-modal',
  imports: [FormsModule, NzModalModule, NzButtonModule, NzIconModule, NzSliderModule, ImageCropperComponent],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="title()"
      [nzFooter]="footerTpl"
      (nzOnCancel)="onCancel()"
      [nzWidth]="modalWidth()"
      nzCentered
    >
      <ng-container *nzModalContent>
        <div class="crop-area" [class.cover-crop]="isCoverCrop()">
          <image-cropper
            [imageFile]="imageFile() ?? undefined"
            [aspectRatio]="aspectRatio()"
            [roundCropper]="roundCropper()"
            [resizeToWidth]="resizeToWidth()"
            [maintainAspectRatio]="true"
            [containWithinAspectRatio]="containWithinAspectRatio()"
            [onlyScaleDown]="true"
            backgroundColor="#ffffff"
            [transform]="transform()"
            format="png"
            output="blob"
            (imageCropped)="onImageCropped($event)"
          />
        </div>
        <div class="zoom-controls">
          <button nz-button nzType="text" nzSize="small" (click)="zoomOut()">
            <nz-icon nzType="zoom-out" />
          </button>
          <nz-slider
            class="zoom-slider"
            [ngModel]="zoomLevel()"
            (ngModelChange)="zoomLevel.set($event)"
            [nzMin]="50"
            [nzMax]="300"
            [nzStep]="5"
            [nzTipFormatter]="zoomFormatter"
          />
          <button nz-button nzType="text" nzSize="small" (click)="zoomIn()">
            <nz-icon nzType="zoom-in" />
          </button>
        </div>
        <p class="crop-hint">Kéo để di chuyển · dùng thanh trượt để phóng to / thu nhỏ.</p>
      </ng-container>

      <ng-template #footerTpl>
        <button nz-button (click)="onCancel()">Hủy</button>
        <button nz-button nzType="primary" [disabled]="!croppedBlob()" (click)="onSave()">Lưu</button>
      </ng-template>
    </nz-modal>
  `,
  styles: `
    .crop-area {
      display: flex;
      justify-content: center;
      background: var(--hs-surface-2);
      border-radius: 8px;
      overflow: hidden;
      min-height: 300px;
    }
    .crop-area image-cropper {
      width: 100%;
      height: 340px;
    }
    .crop-area.cover-crop {
      min-height: unset;
      aspect-ratio: 16 / 9;
    }
    .crop-area.cover-crop image-cropper {
      height: auto;
      aspect-ratio: 16 / 9;
    }
    .zoom-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      padding: 0 8px;
    }
    .zoom-slider {
      flex: 1;
    }
    .crop-hint {
      margin: 8px 0 0;
      text-align: center;
      font-size: 12px;
      color: var(--hs-text-muted);
    }
    @media (max-width: 640px) {
      .crop-area image-cropper {
        height: 300px;
      }
      .crop-area.cover-crop image-cropper {
        height: auto;
      }
    }
  `
})
export class AvatarCropModal {
  readonly visible = input(false);
  readonly imageFile = input<File | null>(null);
  // Tham số hóa để dùng chung (avatar tròn 1:1 mặc định; ảnh bìa tài liệu truyền 16/9 + vuông).
  readonly aspectRatio = input(1);
  readonly roundCropper = input(true);
  readonly title = input('Chỉnh sửa ảnh đại diện');
  readonly outputFileName = input('avatar.png');
  /** Bề rộng tối đa của ảnh kết quả (px); 0 = giữ nguyên. Ảnh bìa nên giới hạn để PNG không phình quá trần upload. */
  readonly resizeToWidth = input(0);
  readonly modalWidth = input(520);
  readonly containWithinAspectRatio = input(false);
  readonly cropped = output<File>();
  readonly cancelled = output<void>();

  protected readonly zoomLevel = signal(100);
  protected readonly croppedBlob = signal<Blob | null>(null);
  protected readonly transform = computed<ImageTransform>(() => ({ scale: this.zoomLevel() / 100 }));
  protected readonly isCoverCrop = computed(() => !this.roundCropper() && this.aspectRatio() > 1);

  protected readonly zoomFormatter = (value: number): string => `${value}%`;

  constructor() {
    // Mỗi lần chọn ảnh mới → đưa zoom về 100% và xóa kết quả crop cũ.
    effect(() => {
      this.imageFile();
      this.zoomLevel.set(100);
      this.croppedBlob.set(null);
    });
  }

  protected onImageCropped(event: ImageCroppedEvent): void {
    this.croppedBlob.set(event.blob ?? null);
  }

  protected zoomIn(): void {
    this.zoomLevel.update(v => Math.min(v + 10, 300));
  }

  protected zoomOut(): void {
    this.zoomLevel.update(v => Math.max(v - 10, 50));
  }

  protected onSave(): void {
    const blob = this.croppedBlob();
    if (!blob) return;
    const file = new File([blob], this.outputFileName(), { type: 'image/png' });
    this.cropped.emit(file);
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}
