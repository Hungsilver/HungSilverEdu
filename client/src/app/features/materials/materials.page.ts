import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzUploadModule, NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import { ClassesService } from '../../core/classes.service';
import { FilesService } from '../../core/files.service';
import { MaterialsService } from '../../core/materials.service';
import {
  ApiProblem, ClassListItem, CreateMaterialRequest, FileStorageMode, Material, MaterialSource,
  MaterialType, MATERIAL_TYPE_LABELS
} from '../../core/models';
import { SettingsService } from '../../core/settings.service';

@Component({
  selector: 'app-materials-page',
  imports: [
    FormsModule, ReactiveFormsModule,
    NzTableModule, NzButtonModule, NzIconModule, NzTagModule, NzSelectModule,
    NzModalModule, NzFormModule, NzInputModule, NzPopconfirmModule, NzUploadModule
  ],
  template: `
    <div class="page-header">
      <h2>Kho tài liệu</h2>
      <div class="actions">
        <nz-select class="cls" nzShowSearch nzPlaceHolder="Chọn lớp" [(ngModel)]="classId" (ngModelChange)="loadMaterials()">
          @for (c of classes(); track c.id) { <nz-option [nzValue]="c.id" [nzLabel]="c.name" /> }
        </nz-select>
        <button nz-button nzType="primary" [disabled]="!classId" (click)="openCreate()"><nz-icon nzType="plus" /> Thêm tài liệu</button>
      </div>
    </div>

    @if (classId) {
      <nz-table #table [nzData]="materials()" [nzLoading]="loading()" [nzFrontPagination]="false" [nzScroll]="{ x: '560px' }">
        <thead><tr><th nzLeft>Tiêu đề</th><th>Loại</th><th>Mô tả</th><th nzRight>Thao tác</th></tr></thead>
        <tbody>
          @for (m of table.data; track m.id) {
            <tr>
              <td nzLeft>{{ m.title }}</td>
              <td><nz-tag>{{ typeLabels[m.type] }}</nz-tag></td>
              <td>{{ m.description || '—' }}</td>
              <td nzRight>
                <a nz-button nzType="link" nzSize="small" [href]="m.downloadUrl" target="_blank"><nz-icon nzType="eye" /> Mở</a>
                <button nz-button nzType="link" nzSize="small" (click)="openEdit(m)"><nz-icon nzType="edit" /></button>
                <button nz-button nzType="link" nzSize="small" nzDanger
                        nz-popconfirm nzPopconfirmTitle="Xóa tài liệu này?" (nzOnConfirm)="remove(m)"><nz-icon nzType="delete" /></button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    } @else {
      <p class="muted">Chọn một lớp để xem kho tài liệu.</p>
    }

    <nz-modal [nzVisible]="modalOpen()" [nzTitle]="editing() ? 'Sửa tài liệu' : 'Thêm tài liệu'"
      [nzOkLoading]="saving()" [nzOkDisabled]="form.invalid" (nzOnOk)="save()" (nzOnCancel)="modalOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item><nz-form-label nzRequired>Tiêu đề</nz-form-label>
            <nz-form-control nzErrorTip="Nhập tiêu đề"><input nz-input formControlName="title" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label nzRequired>Loại</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="type" class="full">
                @for (t of types; track t) { <nz-option [nzValue]="t" [nzLabel]="typeLabels[t]" /> }
              </nz-select>
            </nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label nzRequired>Nguồn</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="source" class="full">
                <nz-option [nzValue]="MaterialSource.ExternalUrl" nzLabel="Liên kết (URL)" />
                @if (serverUploadAllowed()) { <nz-option [nzValue]="MaterialSource.ServerFile" nzLabel="Tải file lên server" /> }
              </nz-select>
            </nz-form-control></nz-form-item>

          @if (form.value.source === MaterialSource.ExternalUrl) {
            <nz-form-item><nz-form-label nzRequired>Đường dẫn (URL)</nz-form-label>
              <nz-form-control><input nz-input formControlName="url" placeholder="https://..." /></nz-form-control></nz-form-item>
          } @else {
            <nz-form-item><nz-form-label nzRequired>File</nz-form-label>
              <nz-form-control>
                <nz-upload [nzCustomRequest]="customUpload" [nzLimit]="1" nzAccept="*">
                  <button nz-button type="button"><nz-icon nzType="link" /> Chọn file</button>
                </nz-upload>
                @if (uploadedFileName()) { <span class="muted">Đã tải: {{ uploadedFileName() }}</span> }
              </nz-form-control></nz-form-item>
          }

          <nz-form-item><nz-form-label>Mô tả</nz-form-label>
            <nz-form-control><input nz-input formControlName="description" /></nz-form-control></nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .cls { min-width: 200px; }
    .full { width: 100%; }
    .muted { color: rgba(0,0,0,0.45); margin-left: 8px; }
  `
})
export class MaterialsPage {
  private readonly materialsService = inject(MaterialsService);
  private readonly classesService = inject(ClassesService);
  private readonly filesService = inject(FilesService);
  private readonly settingsService = inject(SettingsService);
  private readonly message = inject(NzMessageService);

  protected readonly MaterialSource = MaterialSource;
  protected readonly typeLabels = MATERIAL_TYPE_LABELS;
  protected readonly types = [MaterialType.Pdf, MaterialType.Video, MaterialType.Vocabulary, MaterialType.Test, MaterialType.Homework];

  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly materials = signal<Material[]>([]);
  protected readonly loading = signal(false);
  protected readonly serverUploadAllowed = signal(false);
  protected classId: string | null = null;

  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Material | null>(null);
  protected readonly uploadedFileId = signal<string | null>(null);
  protected readonly uploadedFileName = signal<string | null>(null);

  protected readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    type: new FormControl(MaterialType.Pdf, { nonNullable: true }),
    source: new FormControl(MaterialSource.ExternalUrl, { nonNullable: true }),
    url: new FormControl<string | null>(null),
    description: new FormControl<string | null>(null)
  });

  constructor() {
    this.classesService.getPaged({ page: 1, pageSize: 200 }).subscribe(r => this.classes.set(r.items));
    this.settingsService.getEffective().subscribe(s =>
      this.serverUploadAllowed.set(s.values['FileStorage.Mode'] === FileStorageMode.Server));
  }

  protected loadMaterials(): void {
    if (!this.classId) return;
    this.loading.set(true);
    this.materialsService.getByClass(this.classId).subscribe({
      next: m => { this.materials.set(m); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.uploadedFileId.set(null);
    this.uploadedFileName.set(null);
    this.form.reset({ title: '', type: MaterialType.Pdf, source: MaterialSource.ExternalUrl, url: null, description: null });
    this.modalOpen.set(true);
  }

  protected openEdit(m: Material): void {
    this.editing.set(m);
    this.uploadedFileId.set(m.storedFileId);
    this.uploadedFileName.set(m.storedFileId ? 'file hiện tại' : null);
    this.form.reset({ title: m.title, type: m.type, source: m.source, url: m.url, description: m.description });
    this.modalOpen.set(true);
  }

  protected customUpload = (item: NzUploadXHRArgs): Subscription => {
    this.filesService.upload(item.file as unknown as File).subscribe({
      next: f => {
        this.uploadedFileId.set(f.id);
        this.uploadedFileName.set(f.fileName);
        item.onSuccess?.(f, item.file, null as never);
        this.message.success('Đã tải file lên.');
      },
      error: (e: HttpErrorResponse) => {
        item.onError?.(e as never, item.file);
        this.message.error((e.error as ApiProblem | null)?.detail ?? 'Tải file thất bại.');
      }
    });
    return new Subscription();
  };

  protected save(): void {
    if (this.form.invalid || !this.classId) return;
    const v = this.form.getRawValue();
    if (v.source === MaterialSource.ServerFile && !this.uploadedFileId()) { this.message.warning('Vui lòng tải file lên.'); return; }
    if (v.source === MaterialSource.ExternalUrl && !v.url) { this.message.warning('Vui lòng nhập URL.'); return; }

    const body = {
      title: v.title, type: v.type, source: v.source,
      url: v.source === MaterialSource.ExternalUrl ? v.url : null,
      storedFileId: v.source === MaterialSource.ServerFile ? this.uploadedFileId() : null,
      description: v.description
    };
    const editing = this.editing();
    const op = editing
      ? this.materialsService.update(editing.id, body)
      : this.materialsService.create({ classId: this.classId, ...body } as CreateMaterialRequest);

    this.saving.set(true);
    op.subscribe({
      next: () => { this.saving.set(false); this.modalOpen.set(false); this.message.success('Đã lưu tài liệu.'); this.loadMaterials(); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error((err.error as ApiProblem | null)?.detail ?? 'Lưu thất bại.'); }
    });
  }

  protected remove(m: Material): void {
    this.materialsService.delete(m.id).subscribe({
      next: () => { this.message.success('Đã xóa.'); this.loadMaterials(); },
      error: (err: HttpErrorResponse) => this.message.error((err.error as ApiProblem | null)?.detail ?? 'Xóa thất bại.')
    });
  }
}
