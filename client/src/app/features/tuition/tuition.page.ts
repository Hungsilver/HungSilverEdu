import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../core/auth.service';
import { toDateOnly } from '../../core/date-util';
import { ScreenService } from '../../core/screen.service';
import {
  CreateTuitionInvoiceRequest, Student, TuitionInvoice,
  TUITION_STATUS_COLORS, TUITION_STATUS_LABELS
} from '../../core/models';
import { StudentsService } from '../../core/students.service';
import { TuitionService } from '../../core/tuition.service';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-tuition-page',
  imports: [
    FormsModule, ReactiveFormsModule, CurrencyPipe, DatePipe,
    NzTableModule, NzButtonModule, NzIconModule, NzTagModule, NzSelectModule,
    NzModalModule, NzFormModule, NzInputModule, NzInputNumberModule, NzDatePickerModule, NzPopconfirmModule, PageHeader,
    NzCardModule, NzPaginationModule
  ],
  template: `
    <app-page-header title="Học phí" subtitle="Hóa đơn theo tháng & trạng thái đóng" icon="dollar">
      @if (auth.isAdmin()) {
        <button nz-button nzType="primary" (click)="openCreate()"><nz-icon nzType="plus" /> Tạo hóa đơn</button>
      }
    </app-page-header>

    @if (screen.isMobile()) {
      <div class="mobile-card-list">
        @for (t of invoices(); track t.id) {
          <nz-card>
            <div class="card-header">
              <span class="card-title">{{ t.studentName }}</span>
              <nz-tag [nzColor]="statusColors[t.status]">{{ statusLabels[t.status] }}</nz-tag>
            </div>
            <div class="card-field"><span class="label">Kỳ</span><span>{{ t.periodMonth }}/{{ t.periodYear }}</span></div>
            <div class="card-field"><span class="label">Số tiền</span><span>{{ t.amount | currency: 'VND' }}</span></div>
            <div class="card-field"><span class="label">Hạn đóng</span><span>{{ t.dueDate | date: 'dd/MM/yyyy' }}</span></div>
            @if (auth.isAdmin()) {
              <div class="card-actions">
                @if (!t.paidOn) {
                  <button nz-button nzSize="small" (click)="markPaid(t)">Đã đóng</button>
                  <button nz-button nzSize="small" (click)="openEdit(t)"><nz-icon nzType="edit" /> Sửa</button>
                }
                <button nz-button nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Xóa hóa đơn này?" (nzOnConfirm)="remove(t)"><nz-icon nzType="delete" /> Xóa</button>
              </div>
            }
          </nz-card>
        }
      </div>
      <nz-pagination class="mobile-pagination" [nzPageIndex]="page()" [nzTotal]="total()" [nzPageSize]="pageSize()" (nzPageIndexChange)="onPageChange($event)" />
    } @else {
      <nz-table #table [nzData]="invoices()" [nzLoading]="loading()" [nzFrontPagination]="false"
        [nzTotal]="total()" [nzPageIndex]="page()" [nzPageSize]="pageSize()"
        (nzPageIndexChange)="onPageChange($event)" [nzScroll]="{ x: '720px' }">
        <thead>
          <tr>
            <th nzLeft>Học sinh</th><th>Kỳ</th><th>Số tiền</th><th>Hạn đóng</th><th>Trạng thái</th>
            @if (auth.isAdmin()) { <th nzRight>Thao tác</th> }
          </tr>
        </thead>
        <tbody>
          @for (t of table.data; track t.id) {
            <tr>
              <td nzLeft>{{ t.studentName }}</td>
              <td>{{ t.periodMonth }}/{{ t.periodYear }}</td>
              <td>{{ t.amount | currency: 'VND' }}</td>
              <td>{{ t.dueDate | date: 'dd/MM/yyyy' }}</td>
              <td><nz-tag [nzColor]="statusColors[t.status]">{{ statusLabels[t.status] }}</nz-tag></td>
              @if (auth.isAdmin()) {
                <td nzRight>
                  @if (!t.paidOn) {
                    <button nz-button nzType="link" nzSize="small" (click)="markPaid(t)">Đã đóng</button>
                    <button nz-button nzType="link" nzSize="small" (click)="openEdit(t)"><nz-icon nzType="edit" /></button>
                  }
                  <button nz-button nzType="link" nzSize="small" nzDanger
                          nz-popconfirm nzPopconfirmTitle="Xóa hóa đơn này?" (nzOnConfirm)="remove(t)"><nz-icon nzType="delete" /></button>
                </td>
              }
            </tr>
          }
        </tbody>
      </nz-table>
    }

    <nz-modal [nzVisible]="modalOpen()" [nzTitle]="editing() ? 'Sửa hóa đơn' : 'Tạo hóa đơn học phí'"
      [nzOkLoading]="saving()" [nzOkDisabled]="form.invalid" (nzOnOk)="save()" (nzOnCancel)="modalOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          @if (!editing()) {
            <nz-form-item><nz-form-label nzRequired>Học sinh</nz-form-label>
              <nz-form-control nzErrorTip="Chọn học sinh">
                <nz-select formControlName="studentId" nzShowSearch nzPlaceHolder="Chọn học sinh" class="full">
                  @for (s of students(); track s.id) { <nz-option [nzValue]="s.id" [nzLabel]="s.fullName" /> }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item><nz-form-label nzRequired>Kỳ (tháng/năm)</nz-form-label>
              <nz-form-control>
                <nz-input-number formControlName="periodMonth" [nzMin]="1" [nzMax]="12" nzPlaceHolder="Tháng" />
                <nz-input-number formControlName="periodYear" [nzMin]="2000" [nzMax]="2100" nzPlaceHolder="Năm" class="ml" />
              </nz-form-control>
            </nz-form-item>
          }
          <nz-form-item><nz-form-label nzRequired>Số tiền</nz-form-label>
            <nz-form-control><nz-input-number formControlName="amount" [nzMin]="0" [nzStep]="100000" class="full" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label nzRequired>Hạn đóng</nz-form-label>
            <nz-form-control><nz-date-picker formControlName="dueDate" nzFormat="dd/MM/yyyy" class="full" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Ghi chú</nz-form-label>
            <nz-form-control><input nz-input formControlName="note" /></nz-form-control></nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .full { width: 100%; }
    .ml { margin-left: 8px; }
  `
})
export class TuitionPage {
  protected readonly auth = inject(AuthService);
  protected readonly screen = inject(ScreenService);
  private readonly tuitionService = inject(TuitionService);
  private readonly studentsService = inject(StudentsService);
  private readonly message = inject(NzMessageService);

  protected readonly statusLabels = TUITION_STATUS_LABELS;
  protected readonly statusColors = TUITION_STATUS_COLORS;

  protected readonly invoices = signal<TuitionInvoice[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly loading = signal(false);
  protected readonly students = signal<Student[]>([]);

  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<TuitionInvoice | null>(null);

  protected readonly form = new FormGroup({
    studentId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    periodMonth: new FormControl(1, { nonNullable: true, validators: [Validators.required] }),
    periodYear: new FormControl(new Date().getFullYear(), { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    dueDate: new FormControl<Date | null>(null, { validators: [Validators.required] }),
    note: new FormControl<string | null>(null)
  });

  constructor() {
    this.load();
    if (this.auth.isAdmin()) this.studentsService.getPaged({ page: 1, pageSize: 200 }).subscribe(r => this.students.set(r.items));
  }

  protected load(): void {
    this.loading.set(true);
    this.tuitionService.getPaged(this.page(), this.pageSize()).subscribe({
      next: r => { this.invoices.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected onPageChange(p: number): void { this.page.set(p); this.load(); }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ studentId: '', periodMonth: new Date().getMonth() + 1, periodYear: new Date().getFullYear(), amount: 0, dueDate: null, note: null });
    this.form.controls.studentId.enable();
    this.modalOpen.set(true);
  }

  protected openEdit(t: TuitionInvoice): void {
    this.editing.set(t);
    this.form.reset({ studentId: t.studentId, periodMonth: t.periodMonth, periodYear: t.periodYear, amount: t.amount, dueDate: new Date(t.dueDate), note: t.note });
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const dueDate = toDateOnly(v.dueDate!);
    const editing = this.editing();
    const op = editing
      ? this.tuitionService.update(editing.id, { amount: v.amount, dueDate, note: v.note })
      : this.tuitionService.create({ studentId: v.studentId, classId: null, periodYear: v.periodYear, periodMonth: v.periodMonth, amount: v.amount, dueDate, note: v.note } as CreateTuitionInvoiceRequest);
    this.saving.set(true);
    op.subscribe({
      next: () => { this.saving.set(false); this.modalOpen.set(false); this.message.success('Đã lưu hóa đơn.'); this.load(); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message ??'Lưu thất bại.'); }
    });
  }

  protected markPaid(t: TuitionInvoice): void {
    this.tuitionService.markPaid(t.id, null).subscribe({
      next: () => { this.message.success('Đã ghi nhận đóng học phí.'); this.load(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ??'Thất bại.')
    });
  }

  protected remove(t: TuitionInvoice): void {
    this.tuitionService.delete(t.id).subscribe({
      next: () => { this.message.success('Đã xóa.'); this.load(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ??'Xóa thất bại.')
    });
  }
}
