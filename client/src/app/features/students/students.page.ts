import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { AuthService } from '../../core/auth.service';
import { BranchesService } from '../../core/branches.service';
import { toDateOnlyOrNull } from '../../core/date-util';
import { GradesService } from '../../core/grades.service';
import { Branch, Grade, Student, StudentRequest, Subject, TeacherProfile } from '../../core/models';
import { StudentsService } from '../../core/students.service';
import { SubjectsService } from '../../core/subjects.service';
import { TeachersService } from '../../core/teachers.service';
import { ColumnDef, ColumnSettings } from '../../shared/column-settings';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-students-page',
  imports: [
    DatePipe, DecimalPipe, FormsModule, ReactiveFormsModule, PageHeader, ColumnSettings,
    NzButtonModule, NzDatePickerModule, NzFormModule, NzIconModule, NzInputModule,
    NzModalModule, NzPopconfirmModule, NzPopoverModule, NzSelectModule, NzTableModule, NzTooltipModule
  ],
  template: `
    <app-page-header title="Học viên" subtitle="Hồ sơ học viên và lớp đang theo học" icon="idcard">
      @if (auth.isAdmin()) {
        <button nz-button nzType="primary" (click)="openForm()"><nz-icon nzType="plus" /> Thêm học viên</button>
      }
    </app-page-header>

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
      <input nz-input placeholder="Tên, mã, SĐT học viên, SĐT phụ huynh" [(ngModel)]="search" (keyup.enter)="applyFilters()" />
    </div>
    <div class="filter-actions">
      <button nz-button nzType="primary" (click)="applyFilters()"><nz-icon nzType="search" /> Tìm kiếm</button>
      <button nz-button (click)="resetFilters()"><nz-icon nzType="reload" /> Đặt lại</button>
      <span class="spacer"></span>
      <app-column-settings #cols storageKey="hs-cols-students" [columns]="COLUMNS" />
    </div>

    <nz-table #table [nzData]="students()" [nzLoading]="loading()" [nzFrontPagination]="false"
      [nzPageIndex]="page()" [nzPageSize]="pageSize()" [nzTotal]="total()"
      (nzPageIndexChange)="page.set($event); load()" [nzScroll]="{ x: '1160px' }">
      <thead><tr>
        <th nzWidth="64px" style="white-space: nowrap">STT</th>
        @for (col of cols.visibleColumns(); track col.key) { <th>{{ col.label }}</th> }
        <th>Thao tác</th>
      </tr></thead>
      <tbody>
        @for (s of table.data; track s.id; let i = $index) {
          <tr class="clickable" (click)="openDetail(s)">
            <td>{{ (page() - 1) * pageSize() + i + 1 }}</td>
            @for (col of cols.visibleColumns(); track col.key) {
              <td>
                @switch (col.key) {
                  @case ('code') { {{ s.studentCode }} }
                  @case ('name') { {{ s.fullName }} }
                  @case ('phone') { {{ s.phone || '—' }} }
                  @case ('parentPhone') { {{ s.parentPhone || '—' }} }
                  @case ('dob') { {{ s.dateOfBirth | date:'dd/MM/yyyy' }} }
                  @case ('email') { {{ s.email || '—' }} }
                  @case ('note') { {{ s.note || '—' }} }
                  @case ('classes') {
                    @if (!s.classes || s.classes.length === 0) {
                      <span class="muted">Chưa có lớp</span>
                    } @else {
                      <span nz-popover nzPopoverTrigger="hover" nzPopoverTitle="Lớp đang theo học"
                            [nzPopoverContent]="classPopContent" class="classes-badge">
                        {{ s.classes.length === 1 ? s.classes[0].className : (s.classes.length + ' lớp') }}
                      </span>
                      <ng-template #classPopContent>
                        <div class="pop-class-list">
                          @for (c of s.classes; track c.classId) {
                            <div>{{ c.className }}</div>
                          }
                        </div>
                      </ng-template>
                    }
                  }
                }
              </td>
            }
            <td (click)="$event.stopPropagation()">
              <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Sửa học viên" aria-label="Sửa học viên" (click)="openForm(s)"><nz-icon nzType="edit" /></button>
              <button nz-button nzType="link" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa học viên" aria-label="Xóa học viên"
                nz-popconfirm nzPopconfirmTitle="Xóa học viên?" (nzOnConfirm)="deleteStudent(s)"><nz-icon nzType="delete" /></button>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal [nzVisible]="modalOpen()" [nzTitle]="editing() ? 'Sửa học viên' : 'Thêm học viên'" [nzWidth]="680"
      (nzOnCancel)="modalOpen.set(false)" (nzOnOk)="save()">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div class="form-grid">
            <nz-form-item><nz-form-label>Mã học viên</nz-form-label><nz-form-control><input nz-input formControlName="studentCode" placeholder="Trống để tự sinh" /></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label nzRequired>Tên học viên</nz-form-label><nz-form-control><input nz-input formControlName="fullName" /></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label>SĐT</nz-form-label><nz-form-control><input nz-input formControlName="phone" /></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label>SĐT phụ huynh</nz-form-label><nz-form-control><input nz-input formControlName="parentPhone" /></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label>Ngày sinh</nz-form-label><nz-form-control><nz-date-picker formControlName="dateOfBirth" /></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label>Email</nz-form-label><nz-form-control><input nz-input formControlName="email" /></nz-form-control></nz-form-item>
          </div>
          <nz-form-item><nz-form-label>Địa chỉ</nz-form-label><nz-form-control><input nz-input formControlName="address" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Ghi chú</nz-form-label><nz-form-control><textarea nz-input formControlName="note" rows="3"></textarea></nz-form-control></nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="detailOpen()" nzTitle="Chi tiết học viên" [nzWidth]="860" [nzFooter]="null" (nzOnCancel)="detailOpen.set(false)">
      <ng-container *nzModalContent>
        @if (detail(); as s) {
          <div class="detail">
            <div><b>Mã HV</b><span>{{ s.studentCode }}</span></div>
            <div><b>Học viên</b><span>{{ s.fullName }}</span></div>
            <div><b>SĐT PH</b><span>{{ s.parentPhone || '—' }}</span></div>
          </div>
          <nz-table [nzData]="s.classes" [nzFrontPagination]="false" nzSize="small">
            <thead><tr><th>Mã lớp</th><th>Lớp</th><th>Giáo viên</th><th>Môn</th><th>Khối</th><th>Cơ sở</th><th>Học phí</th></tr></thead>
            <tbody>
              @for (c of s.classes; track c.classId) {
                <tr><td>{{ c.classCode }}</td><td>{{ c.className }}</td><td>{{ c.teacherName || '—' }}</td><td>{{ c.subjectName || '—' }}</td><td>{{ c.gradeName || '—' }}</td><td>{{ c.branchName || '—' }}</td><td>{{ c.tuitionFee | number:'1.0-0' }}</td></tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .filters { display: grid; grid-template-columns: repeat(5, minmax(150px, 1fr)); gap: 10px; margin-bottom: 10px; }
    .filter-actions { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; }
    .filter-actions .spacer { flex: 1; }
    .clickable { cursor: pointer; }
    .classes-badge { cursor: default; color: var(--hs-primary, #1890ff); }
    .pop-class-list { min-width: 140px; }
    .pop-class-list div { padding: 3px 0; border-bottom: 1px solid var(--hs-border); font-size: 13px; }
    .pop-class-list div:last-child { border-bottom: none; }
    .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 16px; }
    .detail { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; }
    .detail div { border: 1px solid var(--hs-border); border-radius: 8px; padding: 10px; }
    .detail b { display: block; color: var(--hs-text-muted); font-size: 12px; margin-bottom: 4px; }
    @media (max-width: 900px) { .filters, .form-grid, .detail { grid-template-columns: 1fr; } }
  `
})
export class StudentsPage {
  private readonly studentsService = inject(StudentsService);
  private readonly branchesService = inject(BranchesService);
  private readonly subjectsService = inject(SubjectsService);
  private readonly gradesService = inject(GradesService);
  private readonly teachersService = inject(TeachersService);
  private readonly message = inject(NzMessageService);
  protected readonly auth = inject(AuthService);

  protected readonly students = signal<Student[]>([]);
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

  // Cột cấu hình được (ngoài STT cố định đầu & Thao tác cố định cuối).
  protected readonly COLUMNS: ColumnDef[] = [
    { key: 'code', label: 'Mã học viên' },
    { key: 'name', label: 'Tên học viên' },
    { key: 'phone', label: 'SĐT' },
    { key: 'parentPhone', label: 'SĐT phụ huynh' },
    { key: 'dob', label: 'Ngày sinh' },
    { key: 'email', label: 'Email' },
    { key: 'note', label: 'Ghi chú' },
    { key: 'classes', label: 'Lớp đang theo học' }
  ];

  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Student | null>(null);
  protected readonly detailOpen = signal(false);
  protected readonly detail = signal<Student | null>(null);
  protected readonly form = new FormGroup({
    studentCode: new FormControl<string | null>(null),
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl<string | null>(null),
    parentPhone: new FormControl<string | null>(null),
    dateOfBirth: new FormControl<Date | null>(null),
    email: new FormControl<string | null>(null),
    address: new FormControl<string | null>(null),
    note: new FormControl<string | null>(null)
  });

  constructor() {
    this.loadLookups();
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.studentsService.getPaged({
      page: this.page(), pageSize: this.pageSize(), search: this.search,
      branchId: this.branchId ?? undefined, subjectId: this.subjectId ?? undefined,
      gradeId: this.gradeId ?? undefined, teacherProfileId: this.teacherProfileId ?? undefined
    }).subscribe({
      next: r => { this.students.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
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
    this.page.set(1);
    this.load();
  }

  private loadLookups(): void {
    this.branchesService.getAll().subscribe(x => this.branches.set(x));
    this.subjectsService.getAll().subscribe(x => this.subjects.set(x));
    this.gradesService.getAll().subscribe(x => this.grades.set(x));
    this.teachersService.getPaged({ page: 1, pageSize: 500 }).subscribe(x => this.teachers.set(x.items));
  }

  protected openForm(s?: Student): void {
    this.editing.set(s ?? null);
    this.form.reset({
      studentCode: s?.studentCode ?? null,
      fullName: s?.fullName ?? '',
      phone: s?.phone ?? null,
      parentPhone: s?.parentPhone ?? null,
      dateOfBirth: s?.dateOfBirth ? new Date(s.dateOfBirth) : null,
      email: s?.email ?? null,
      address: s?.address ?? null,
      note: s?.note ?? null
    });
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const req: StudentRequest = {
      studentCode: v.studentCode || null,
      fullName: v.fullName,
      dateOfBirth: toDateOnlyOrNull(v.dateOfBirth),
      school: null,
      gradeLevel: null,
      phone: v.phone,
      parentName: null,
      parentPhone: v.parentPhone,
      address: v.address,
      email: v.email,
      note: v.note,
      enrollmentDate: null,
      englishLevel: null,
      learningGoal: null,
      curriculum: null,
      isActive: true
    };
    const editing = this.editing();
    const op = editing ? this.studentsService.update(editing.id, req) : this.studentsService.create(req);
    op.subscribe({ next: () => { this.message.success('Đã lưu học viên.'); this.modalOpen.set(false); this.load(); }, error: err => this.showError(err, 'Lưu học viên thất bại.') });
  }

  protected openDetail(s: Student): void {
    this.studentsService.getById(s.id).subscribe({ next: x => { this.detail.set(x); this.detailOpen.set(true); }, error: err => this.showError(err, 'Không tải được chi tiết.') });
  }

  protected deleteStudent(s: Student): void {
    this.studentsService.delete(s.id).subscribe({ next: () => { this.message.success('Đã xóa học viên.'); this.load(); }, error: err => this.showError(err, 'Xóa thất bại.') });
  }

  private showError(err: HttpErrorResponse, fallback: string): void {
    this.message.error(err.error?.message ?? err.message ?? fallback);
  }
}
