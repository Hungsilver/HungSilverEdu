import { Component, computed, input, output, signal } from '@angular/core';
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
      nzTitle="Chỉnh sửa ảnh đại diện"
      [nzFooter]="footerTpl"
      (nzOnCancel)="onCancel()"
      [nzWidth]="520"
      nzCentered
    >
      <ng-container *nzModalContent>
        <div class="crop-area">
          <image-cropper
            [imageFile]="imageFile() ?? undefined"
            [aspectRatio]="1"
            [roundCropper]="true"
            [maintainAspectRatio]="true"
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
      background: #f0f0f0;
      border-radius: 8px;
      overflow: hidden;
      min-height: 300px;
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
  `
})
export class AvatarCropModal {
  readonly visible = input(false);
  readonly imageFile = input<File | null>(null);
  readonly cropped = output<File>();
  readonly cancelled = output<void>();

  protected readonly zoomLevel = signal(100);
  protected readonly croppedBlob = signal<Blob | null>(null);
  protected readonly transform = computed<ImageTransform>(() => ({ scale: this.zoomLevel() / 100 }));

  protected readonly zoomFormatter = (value: number): string => `${value}%`;

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
    const file = new File([blob], 'avatar.png', { type: 'image/png' });
    this.cropped.emit(file);
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}
