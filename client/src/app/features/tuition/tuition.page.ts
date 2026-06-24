import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { BranchesService } from '../../core/branches.service';
import { toDateOnlyOrNull } from '../../core/date-util';
import { GradesService } from '../../core/grades.service';
import {
  Branch, Grade, Subject, TeacherProfile, TuitionBill, TuitionStudentListItem,
  TUITION_STATUS_COLORS, TUITION_STATUS_LABELS
} from '../../core/models';
import { SubjectsService } from '../../core/subjects.service';
import { TeachersService } from '../../core/teachers.service';
import { TuitionService } from '../../core/tuition.service';
import { ColumnDef, ColumnSettings } from '../../shared/column-settings';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-tuition-page',
  imports: [
    CurrencyPipe, DatePipe, FormsModule, ReactiveFormsModule, PageHeader, ColumnSettings,
    NzButtonModule, NzDatePickerModule, NzFormModule, NzIconModule, NzInputModule,
    NzInputNumberModule, NzModalModule, NzSelectModule, NzTableModule, NzTagModule
  ],
  template: `
    <app-page-header title="Học phí" subtitle="Quản lý học phí theo học viên" icon="dollar" />

    <div class="filters">
      <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Cơ sở" [(ngModel)]="branchId">
        @for (b of branches(); track b.id) { <nz-option [nzValue]="b.id" [nzLabel]="b.name" /> }
      </nz-select>
      <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Môn học" [(ngModel)]="subjectId">
        @for (s of subjects(); track s.id) { <nz-option [nzValue]="s.id" [nzLabel]="s.name" /> }
      </nz-select>
      <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Khối" [(ngModel)]="gradeId">
        @for (g of grades(); track g.id) { <nz-option [nzValue]="g.id" [nzLabel]="g.name" /> }
      </nz-select>
      <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Giáo viên" [(ngModel)]="teacherProfileId">
        @for (t of teachers(); track t.id) { <nz-option [nzValue]="t.id" [nzLabel]="t.fullName" /> }
      </nz-select>
      <input nz-input placeholder="Tên, mã, SĐT" [(ngModel)]="search" (keyup.enter)="applyFilters()" />
      <nz-date-picker [(ngModel)]="periodDate" nzMode="month" />
      <nz-date-picker [(ngModel)]="dueDate" nzPlaceHolder="Hạn đóng" />
    </div>
    <div class="filter-actions">
      <button nz-button nzType="primary" (click)="applyFilters()"><nz-icon nzType="search" /> Tìm kiếm</button>
      <button nz-button (click)="resetFilters()"><nz-icon nzType="reload" /> Đặt lại</button>
      <span class="spacer"></span>
      <app-column-settings #cols storageKey="hs-cols-tuition" [columns]="COLUMNS" />
    </div>

    <nz-table #table [nzData]="items()" [nzLoading]="loading()" [nzFrontPagination]="false"
      [nzPageIndex]="page()" [nzPageSize]="pageSize()" [nzTotal]="total()"
      (nzPageIndexChange)="page.set($event); load()" [nzScroll]="{ x: '900px' }">
      <thead><tr>
        <th nzWidth="64px" style="white-space: nowrap">STT</th>
        @for (col of cols.visibleColumns(); track col.key) { <th>{{ col.label }}</th> }
      </tr></thead>
      <tbody>
        @for (row of table.data; track row.studentId; let i = $index) {
          <tr class="clickable" (click)="openBill(row)">
            <td>{{ (page() - 1) * pageSize() + i + 1 }}</td>
            @for (col of cols.visibleColumns(); track col.key) {
              <td>
                @switch (col.key) {
                  @case ('code') { {{ row.studentCode }} }
                  @case ('name') { {{ row.studentName }} }
                  @case ('period') { {{ row.periodMonth }}/{{ row.periodYear }} }
                  @case ('dueDate') { {{ row.dueDate | date:'dd/MM/yyyy' }} }
                  @case ('total') { {{ row.totalAmount | currency:'VND' }} }
                  @case ('paid') { {{ row.paidAmount | currency:'VND' }} }
                  @case ('remaining') { {{ row.remainingAmount | currency:'VND' }} }
                  @case ('status') { <nz-tag [nzColor]="statusColors[row.status]">{{ statusLabels[row.status] }}</nz-tag> }
                }
              </td>
            }
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal [nzVisible]="billOpen()" nzTitle="Chi tiết học phí" [nzWidth]="900"
      (nzOnCancel)="billOpen.set(false)" (nzOnOk)="pay()">
      <ng-container *nzModalContent>
        @if (bill(); as b) {
          <div class="bill-head">
            <div><b>Học viên</b><span>{{ b.studentCode }} · {{ b.studentName }}</span></div>
            <div><b>Kỳ</b><span>{{ b.periodMonth }}/{{ b.periodYear }}</span></div>
            <div><b>Hạn đóng</b><span>{{ b.dueDate | date:'dd/MM/yyyy' }}</span></div>
          </div>
          <nz-table [nzData]="b.classes" [nzFrontPagination]="false" nzSize="small">
            <thead><tr><th>Mã lớp</th><th>Lớp</th><th>Giáo viên</th><th>Môn</th><th>Khối</th><th>Học phí</th></tr></thead>
            <tbody>
              @for (c of b.classes; track c.classId) {
                <tr><td>{{ c.classCode }}</td><td>{{ c.className }}</td><td>{{ c.teacherName || '—' }}</td><td>{{ c.subjectName || '—' }}</td><td>{{ c.gradeName || '—' }}</td><td>{{ c.tuitionFee | currency:'VND' }}</td></tr>
              }
            </tbody>
          </nz-table>
          <form nz-form [formGroup]="payForm" nzLayout="vertical" class="pay-form">
            <nz-form-item><nz-form-label>Giảm giá</nz-form-label><nz-form-control><nz-input-number formControlName="discountAmount" [nzMin]="0" /></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label>Số tiền đóng</nz-form-label><nz-form-control><nz-input-number formControlName="paidAmount" [nzMin]="0" /></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label>Ghi chú</nz-form-label><nz-form-control><input nz-input formControlName="note" /></nz-form-control></nz-form-item>
          </form>
          <div class="totals">
            <span>Tổng: <b>{{ b.totalAmount | currency:'VND' }}</b></span>
            <span>Giảm: <b>{{ payForm.value.discountAmount || 0 | currency:'VND' }}</b></span>
            <span>Đã đóng: <b>{{ payForm.value.paidAmount || 0 | currency:'VND' }}</b></span>
          </div>
          <button nz-button (click)="downloadBill()"><nz-icon nzType="download" /> Tải bill</button>
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .filters { display: grid; grid-template-columns: repeat(7, minmax(130px, 1fr)); gap: 10px; margin-bottom: 10px; }
    .filter-actions { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; }
    .filter-actions .spacer { flex: 1; }
    .clickable { cursor: pointer; }
    .bill-head { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; }
    .bill-head div { border: 1px solid var(--hs-border); border-radius: 8px; padding: 10px; }
    .bill-head b { display: block; color: var(--hs-text-muted); font-size: 12px; margin-bottom: 4px; }
    .pay-form { display: grid; grid-template-columns: 180px 180px 1fr; gap: 12px; margin-top: 12px; }
    .totals { display: flex; gap: 18px; justify-content: flex-end; margin: 12px 0; }
    @media (max-width: 900px) { .filters, .bill-head, .pay-form { grid-template-columns: 1fr; } .totals { flex-direction: column; } }
  `
})
export class TuitionPage {
  private readonly tuitionService = inject(TuitionService);
  private readonly branchesService = inject(BranchesService);
  private readonly subjectsService = inject(SubjectsService);
  private readonly gradesService = inject(GradesService);
  private readonly teachersService = inject(TeachersService);
  private readonly message = inject(NzMessageService);

  protected readonly statusLabels = TUITION_STATUS_LABELS;
  protected readonly statusColors = TUITION_STATUS_COLORS;
  protected readonly items = signal<TuitionStudentListItem[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly subjects = signal<Subject[]>([]);
  protected readonly grades = signal<Grade[]>([]);
  protected readonly teachers = signal<TeacherProfile[]>([]);
  protected readonly loading = signal(false);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly total = signal(0);
  protected search = '';
  protected branchId: string | null = null;
  protected subjectId: string | null = null;
  protected gradeId: string | null = null;
  protected teacherProfileId: string | null = null;
  protected periodDate = new Date();
  protected dueDate: Date | null = new Date();

  // Cột cấu hình được (STT cố định đầu).
  protected readonly COLUMNS: ColumnDef[] = [
    { key: 'code', label: 'Mã HV' },
    { key: 'name', label: 'Tên học viên' },
    { key: 'period', label: 'Kỳ' },
    { key: 'dueDate', label: 'Hạn đóng' },
    { key: 'total', label: 'Tổng' },
    { key: 'paid', label: 'Đã đóng' },
    { key: 'remaining', label: 'Còn thiếu' },
    { key: 'status', label: 'Trạng thái' }
  ];

  protected readonly billOpen = signal(false);
  protected readonly bill = signal<TuitionBill | null>(null);
  protected readonly payForm = new FormGroup({
    discountAmount: new FormControl(0, { nonNullable: true }),
    paidAmount: new FormControl(0, { nonNullable: true }),
    note: new FormControl<string | null>(null)
  });

  constructor() {
    this.loadLookups();
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.tuitionService.getStudents({
      page: this.page(), pageSize: this.pageSize(), search: this.search,
      periodYear: this.periodDate.getFullYear(), periodMonth: this.periodDate.getMonth() + 1,
      dueDate: toDateOnlyOrNull(this.dueDate),
      branchId: this.branchId ?? undefined, subjectId: this.subjectId ?? undefined,
      gradeId: this.gradeId ?? undefined, teacherProfileId: this.teacherProfileId ?? undefined
    }).subscribe({
      next: r => { this.items.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  protected resetFilters(): void {
    this.search = '';
    this.branchId = null;
    this.subjectId = null;
    this.gradeId = null;
    this.teacherProfileId = null;
    this.periodDate = new Date();
    this.dueDate = new Date();
    this.page.set(1);
    this.load();
  }

  private loadLookups(): void {
    this.branchesService.getAll().subscribe(x => this.branches.set(x));
    this.subjectsService.getAll().subscribe(x => this.subjects.set(x));
    this.gradesService.getAll().subscribe(x => this.grades.set(x));
    this.teachersService.getPaged({ page: 1, pageSize: 500 }).subscribe(x => this.teachers.set(x.items));
  }

  protected openBill(row: TuitionStudentListItem): void {
    this.tuitionService.getBill(row.studentId, row.periodYear, row.periodMonth, row.dueDate).subscribe({
      next: b => {
        this.bill.set(b);
        this.payForm.reset({ discountAmount: b.discountAmount, paidAmount: b.paidAmount || Math.max(0, b.totalAmount - b.discountAmount), note: null });
        this.billOpen.set(true);
      },
      error: err => this.showError(err, 'Không tải được bill.')
    });
  }

  protected pay(): void {
    const b = this.bill();
    if (!b) return;
    const v = this.payForm.getRawValue();
    this.tuitionService.payStudent(b.studentId, {
      periodYear: b.periodYear,
      periodMonth: b.periodMonth,
      dueDate: b.dueDate,
      discountAmount: v.discountAmount,
      paidAmount: v.paidAmount,
      note: v.note
    }).subscribe({
      next: updated => { this.bill.set(updated); this.message.success('Đã ghi nhận thanh toán.'); this.load(); },
      error: err => this.showError(err, 'Thanh toán thất bại.')
    });
  }

  protected downloadBill(): void {
    const b = this.bill();
    if (!b) return;
    const rows = b.classes.map(c => `<tr><td>${c.classCode}</td><td>${c.className}</td><td>${c.tuitionFee.toLocaleString('vi-VN')}</td></tr>`).join('');
    const html = `<!doctype html><meta charset="utf-8"><title>Bill học phí</title><h2>Bill học phí</h2><p>${b.studentCode} - ${b.studentName}</p><p>Kỳ ${b.periodMonth}/${b.periodYear}</p><table border="1" cellspacing="0" cellpadding="6"><tr><th>Mã lớp</th><th>Lớp</th><th>Học phí</th></tr>${rows}</table><p>Tổng: ${b.totalAmount.toLocaleString('vi-VN')}</p><p>Giảm giá: ${(this.payForm.value.discountAmount || 0).toLocaleString('vi-VN')}</p><p>Đã đóng: ${(this.payForm.value.paidAmount || 0).toLocaleString('vi-VN')}</p>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `bill-${b.studentCode}-${b.periodMonth}-${b.periodYear}.html`; a.click();
    URL.revokeObjectURL(url);
  }

  private showError(err: HttpErrorResponse, fallback: string): void {
    this.message.error(err.error?.message ?? err.message ?? fallback);
  }
}
