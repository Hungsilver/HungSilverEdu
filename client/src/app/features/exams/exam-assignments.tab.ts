import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ClassesService } from '../../core/classes.service';
import { ExamService } from '../../core/exam.service';
import { ClassListItem, ExamAssignment, ExamAssignmentStatus } from '../../core/models';
import { PAGE_SIZE_OPTIONS } from '../../shared/table';

/**
 * Tab "Đã giao cho lớp" — mọi lượt giao trong phạm vi người dùng
 * (Admin thấy tất cả, giáo viên chỉ thấy lớp mình phụ trách).
 */
@Component({
  selector: 'app-exam-assignments-tab',
  imports: [
    DatePipe, FormsModule,
    NzButtonModule, NzCardModule, NzEmptyModule, NzIconModule, NzInputModule, NzPaginationModule,
    NzPopconfirmModule, NzSelectModule, NzSpinModule, NzTableModule, NzTagModule
  ],
  template: `
    <div class="filters">
      <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Lớp" [(ngModel)]="classId">
        @for (c of classes(); track c.id) { <nz-option [nzValue]="c.id" [nzLabel]="c.name" /> }
      </nz-select>
      <nz-select nzAllowClear nzPlaceHolder="Trạng thái" [(ngModel)]="status">
        <nz-option nzValue="Open" nzLabel="Đang mở" />
        <nz-option nzValue="Closed" nzLabel="Đã đóng" />
      </nz-select>
      <input nz-input placeholder="Tên đề" [(ngModel)]="search" (keyup.enter)="applyFilters()" />
      <button nz-button nzType="primary" (click)="applyFilters()"><nz-icon nzType="search" /> Tìm kiếm</button>
      <button nz-button (click)="resetFilters()"><nz-icon nzType="reload" /> Đặt lại</button>
    </div>

    <nz-card>
      <nz-spin [nzSpinning]="loading()">
        <nz-table [nzData]="items()" nzSize="middle" [nzShowPagination]="false" [nzScroll]="{ x: '920px' }">
          <thead>
            <tr>
              <th>Đề</th>
              <th style="width:120px">Lớp</th>
              <th style="width:150px">Hình thức</th>
              <th style="width:220px">Mở / Hạn nộp</th>
              <th style="width:110px">Đã nộp</th>
              <th style="width:120px">Trạng thái</th>
              <th style="width:180px"></th>
            </tr>
          </thead>
          <tbody>
            @for (a of items(); track a.id) {
              <tr>
                <td><b>{{ a.examTitle || 'Đề' }}</b></td>
                <td>{{ a.className }}</td>
                <td>
                  {{ a.mode === 'InClass' ? 'Trên lớp' : 'Về nhà' }}
                  <div class="sub">{{ a.durationMinutes ? a.durationMinutes + ' phút' : 'Không giới hạn' }}</div>
                </td>
                <td class="sub">
                  {{ a.openAt | date: 'dd/MM/yyyy HH:mm' }}
                  @if (a.closeAt) { → {{ a.closeAt | date: 'dd/MM/yyyy HH:mm' }} }
                </td>
                <td><b>{{ a.submittedCount }}</b><span class="sub">/{{ a.totalStudents }}</span></td>
                <td>
                  @if (a.status === 'Open') {
                    <nz-tag nzColor="success">Đang mở</nz-tag>
                  } @else {
                    <nz-tag>Đã đóng</nz-tag>
                  }
                </td>
                <td class="actions">
                  <button nz-button nzSize="small" (click)="openReport(a)">Báo cáo</button>
                  @if (a.status === 'Open') {
                    <button nz-button nzSize="small" nzDanger
                            nz-popconfirm nzPopconfirmTitle="Đóng lượt giao này? Học viên chưa làm sẽ không vào được nữa."
                            (nzOnConfirm)="close(a)">Đóng</button>
                  }
                </td>
              </tr>
            } @empty {
              @if (!loading()) {
                <tr><td colspan="7"><nz-empty nzNotFoundContent="Chưa có lượt giao nào." /></td></tr>
              }
            }
          </tbody>
        </nz-table>
      </nz-spin>
    </nz-card>

    @if (total() > 0) {
      <nz-pagination class="pager" [nzPageIndex]="page()" [nzPageSize]="pageSize()" [nzTotal]="total()"
        nzShowSizeChanger [nzPageSizeOptions]="PAGE_SIZES"
        (nzPageIndexChange)="page.set($event); load()"
        (nzPageSizeChange)="pageSize.set($event); page.set(1); load()" />
    }
  `,
  styles: `
    .filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
    .filters nz-select, .filters input { min-width: 180px; flex: 1; max-width: 250px; }
    .sub { color: var(--hs-text-muted); font-size: 12.5px; }
    .actions { display: flex; gap: 6px; justify-content: flex-end; }
    .pager { display: flex; justify-content: center; margin-top: 16px; }
    @media (max-width: 575px) { .filters nz-select, .filters input { max-width: none; width: 100%; } }
  `
})
export class ExamAssignmentsTab {
  private readonly examService = inject(ExamService);
  private readonly classesService = inject(ClassesService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);

  protected readonly PAGE_SIZES = PAGE_SIZE_OPTIONS;

  protected readonly items = signal<ExamAssignment[]>([]);
  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly total = signal(0);

  protected classId: string | null = null;
  protected status: ExamAssignmentStatus | null = null;
  protected search = '';

  constructor() {
    this.classesService.getPaged({ page: 1, pageSize: 200 }).subscribe(r => this.classes.set(r.items));
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.examService.listAssignmentsPaged(
      { classId: this.classId, status: this.status, search: this.search },
      this.page(), this.pageSize()
    ).subscribe({
      next: r => { this.items.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  protected resetFilters(): void {
    this.classId = null;
    this.status = null;
    this.search = '';
    this.applyFilters();
  }

  protected openReport(a: ExamAssignment): void {
    this.router.navigate(['/exams/assignments', a.id, 'report']);
  }

  protected close(a: ExamAssignment): void {
    this.examService.closeAssignment(a.id).subscribe({
      next: () => { this.message.success('Đã đóng lượt giao.'); this.load(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message)
    });
  }
}
