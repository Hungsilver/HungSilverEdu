import { Component, EventEmitter, Input, Output, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ExamService } from '../../core/exam.service';
import { ExamListItem, Material } from '../../core/models';
import { AssignToClassModal } from '../../shared/assign-to-class.modal';

/**
 * Danh sách đề đã sinh từ MỘT tài liệu — mở từ badge "N đề" trong Kho tài liệu.
 * Cho duyệt hoặc giao ngay từng đề mà không phải đi vòng sang màn khác.
 */
@Component({
  selector: 'app-exams-of-material-modal',
  imports: [
    NzModalModule, NzTableModule, NzTagModule, NzButtonModule, NzIconModule,
    NzEmptyModule, NzSpinModule, NzTooltipModule, AssignToClassModal
  ],
  template: `
    <nz-modal
      [nzVisible]="visible"
      [nzTitle]="'Đề sinh từ: ' + (material?.title ?? '')"
      [nzWidth]="820"
      [nzFooter]="null"
      (nzOnCancel)="close()">
      <div *nzModalContent>
        <nz-spin [nzSpinning]="loading()">
          <nz-table [nzData]="exams()" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>Tên đề</th>
                <th style="width:70px" class="num">Câu</th>
                <th style="width:96px" class="num">Thời gian</th>
                <th style="width:130px">Trạng thái</th>
                <th style="width:100px">Đã giao</th>
                <th style="width:190px"></th>
              </tr>
            </thead>
            <tbody>
              @for (e of exams(); track e.id) {
                <tr>
                  <td><b>{{ e.title }}</b></td>
                  <td class="num">{{ e.questionCount }}</td>
                  <td class="num">{{ e.durationMinutes }} phút</td>
                  <td>
                    @if (e.status === 'Published') {
                      <nz-tag nzColor="success">Đã phát hành</nz-tag>
                    } @else {
                      <nz-tag>Nháp</nz-tag>
                    }
                  </td>
                  <td>
                    @if (e.assignmentCount > 0) {
                      <nz-tag nzColor="blue">{{ e.assignmentCount }} lớp</nz-tag>
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                  <td class="actions">
                    <button nz-button nzSize="small" (click)="openExam(e)">Duyệt</button>
                    @if (e.status === 'Published') {
                      <button nz-button nzSize="small" nzType="primary" (click)="openAssign(e)">Giao cho lớp</button>
                    } @else {
                      <button nz-button nzSize="small" disabled
                              nz-tooltip nzTooltipTitle="Phải phát hành đề trước khi giao">Giao cho lớp</button>
                    }
                  </td>
                </tr>
              } @empty {
                @if (!loading()) {
                  <tr><td colspan="6"><nz-empty nzNotFoundContent="Tài liệu này chưa có đề nào." /></td></tr>
                }
              }
            </tbody>
          </nz-table>
        </nz-spin>
      </div>
    </nz-modal>

    <app-assign-to-class-modal
      [visible]="assignOpen()" kind="exam"
      [targetId]="assignTarget()?.id ?? null" [targetTitle]="assignTarget()?.title ?? ''"
      (closed)="assignOpen.set(false)" (assigned)="onAssigned()" />
  `,
  styles: `
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .actions { display: flex; gap: 6px; justify-content: flex-end; }
    .muted { color: var(--hs-text-muted); }
  `
})
export class ExamsOfMaterialModal {
  private readonly examService = inject(ExamService);
  private readonly router = inject(Router);

  @Input() visible = false;
  @Input() material: Material | null = null;

  @Output() readonly closed = new EventEmitter<void>();
  /** Có thay đổi (giao đề) ⇒ cha nạp lại số liệu. */
  @Output() readonly changed = new EventEmitter<void>();

  protected readonly exams = signal<ExamListItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly assignOpen = signal(false);
  protected readonly assignTarget = signal<ExamListItem | null>(null);

  private readonly assign = viewChild.required(AssignToClassModal);

  /** Gọi từ component cha ngay trước khi bật `visible`. */
  open(): void {
    this.exams.set([]);
    if (!this.material) return;

    this.loading.set(true);
    this.examService.listByMaterial(this.material.id).subscribe({
      next: r => { this.exams.set(r.items); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected openExam(e: ExamListItem): void {
    this.close();
    this.router.navigate(['/exams', e.id]);
  }

  protected openAssign(e: ExamListItem): void {
    this.assignTarget.set(e);
    this.assign().open();
    this.assignOpen.set(true);
  }

  protected onAssigned(): void {
    this.assignOpen.set(false);
    this.changed.emit();
    this.open(); // nạp lại để cột "Đã giao" cập nhật
  }
}
