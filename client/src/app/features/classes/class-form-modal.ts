import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { AuthService } from '../../core/auth.service';
import { BranchesService } from '../../core/branches.service';
import { ClassesService } from '../../core/classes.service';
import { toDateOnlyOrNull } from '../../core/date-util';
import { GradesService } from '../../core/grades.service';
import { Branch, ClassRequest, Grade, Subject, TeacherProfile } from '../../core/models';
import { SubjectsService } from '../../core/subjects.service';
import { TeachersService } from '../../core/teachers.service';

/**
 * Modal thêm/sửa lớp dùng chung cho trang danh sách lớp và trang chi tiết lớp.
 * `open` two-way; `classId` null = thêm mới, có giá trị = sửa (tự nạp chi tiết); phát `(saved)` sau khi lưu.
 */
@Component({
  selector: 'app-class-form-modal',
  imports: [
    ReactiveFormsModule, NzButtonModule, NzCheckboxModule, NzDatePickerModule, NzFormModule,
    NzInputModule, NzInputNumberModule, NzModalModule, NzSelectModule
  ],
  template: `
    <nz-modal [nzVisible]="open()" [nzTitle]="classId() ? 'Sửa lớp' : 'Thêm lớp'" [nzWidth]="720"
      (nzOnCancel)="open.set(false)" (nzOnOk)="save()" [nzOkLoading]="saving()">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div class="form-grid">
            <nz-form-item><nz-form-label>Mã lớp</nz-form-label><nz-form-control><input nz-input formControlName="classCode" placeholder="Trống để tự sinh" /></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label nzRequired>Tên lớp</nz-form-label><nz-form-control><input nz-input formControlName="name" /></nz-form-control></nz-form-item>
            @if (auth.isAdmin()) {
            <nz-form-item><nz-form-label nzRequired>Giáo viên</nz-form-label><nz-form-control><nz-select formControlName="teacherProfileId" nzShowSearch>@for (t of teachers(); track t.id) { <nz-option [nzValue]="t.id" [nzLabel]="t.fullName" /> }</nz-select></nz-form-control></nz-form-item>
            }
            <nz-form-item><nz-form-label>Cơ sở</nz-form-label><nz-form-control><nz-select formControlName="branchId" nzAllowClear nzShowSearch>@for (b of branches(); track b.id) { <nz-option [nzValue]="b.id" [nzLabel]="b.name" /> }</nz-select></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label>Môn học</nz-form-label><nz-form-control><nz-select formControlName="subjectId" nzAllowClear nzShowSearch>@for (s of subjects(); track s.id) { <nz-option [nzValue]="s.id" [nzLabel]="s.name" /> }</nz-select></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label>Khối</nz-form-label><nz-form-control><nz-select formControlName="gradeId" nzAllowClear nzShowSearch>@for (g of grades(); track g.id) { <nz-option [nzValue]="g.id" [nzLabel]="g.name" /> }</nz-select></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label>Học phí</nz-form-label><nz-form-control><nz-input-number formControlName="tuitionFee" [nzMin]="0" class="full" /></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label>Sĩ số tối đa</nz-form-label><nz-form-control><nz-input-number formControlName="maxCapacity" [nzMin]="1" class="full" /></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label>Ngày bắt đầu</nz-form-label><nz-form-control><nz-date-picker formControlName="startDate" class="full" /></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label>Lịch học</nz-form-label><nz-form-control><input nz-input formControlName="schedule" /></nz-form-control></nz-form-item>
          </div>
          <label nz-checkbox formControlName="isActive">Đang mở</label>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 16px; }
    .full { width: 100%; }
    @media (max-width: 900px) { .form-grid { grid-template-columns: 1fr; } }
  `
})
export class ClassFormModal {
  private readonly classesService = inject(ClassesService);
  private readonly branchesService = inject(BranchesService);
  private readonly subjectsService = inject(SubjectsService);
  private readonly gradesService = inject(GradesService);
  private readonly teachersService = inject(TeachersService);
  private readonly message = inject(NzMessageService);
  protected readonly auth = inject(AuthService);

  /** two-way: trạng thái mở modal. */
  readonly open = model(false);
  /** null = thêm mới; có giá trị = sửa lớp này. */
  readonly classId = input<string | null>(null);
  /** phát ra sau khi lưu thành công (parent reload). */
  readonly saved = output<void>();

  protected readonly branches = signal<Branch[]>([]);
  protected readonly subjects = signal<Subject[]>([]);
  protected readonly grades = signal<Grade[]>([]);
  protected readonly teachers = signal<TeacherProfile[]>([]);
  protected readonly saving = signal(false);

  private readonly EMPTY_GUID = '00000000-0000-0000-0000-000000000000';
  private defaultTeacherId(): string { return this.auth.isAdmin() ? '' : this.EMPTY_GUID; }

  protected readonly form = new FormGroup({
    classCode: new FormControl<string | null>(null),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    teacherProfileId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    branchId: new FormControl<string | null>(null),
    subjectId: new FormControl<string | null>(null),
    gradeId: new FormControl<string | null>(null),
    tuitionFee: new FormControl(0, { nonNullable: true }),
    maxCapacity: new FormControl(20, { nonNullable: true }),
    schedule: new FormControl<string | null>(null),
    startDate: new FormControl<Date | null>(null),
    isActive: new FormControl(true, { nonNullable: true })
  });

  constructor() {
    this.loadLookups();
    // Mỗi lần modal mở: nạp lại dữ liệu form theo classId (thêm mới → reset rỗng; sửa → fetch chi tiết).
    effect(() => {
      if (!this.open()) return;
      this.populate(this.classId());
    });
  }

  private loadLookups(): void {
    this.branchesService.getAll().subscribe(x => this.branches.set(x));
    this.subjectsService.getAll().subscribe(x => this.subjects.set(x));
    this.gradesService.getAll().subscribe(x => this.grades.set(x));
    this.teachersService.getPaged({ page: 1, pageSize: 500 }).subscribe(x => this.teachers.set(x.items));
  }

  private populate(id: string | null): void {
    if (!id) {
      this.form.reset({
        classCode: null, name: '', teacherProfileId: this.defaultTeacherId(),
        branchId: null, subjectId: null, gradeId: null,
        tuitionFee: 0, maxCapacity: 20, schedule: null, startDate: null, isActive: true
      });
      return;
    }
    this.classesService.getById(id).subscribe(d => {
      this.form.reset({
        classCode: d.classCode ?? null,
        name: d.name,
        teacherProfileId: d.teacherProfileId ?? this.defaultTeacherId(),
        branchId: d.branchId ?? null,
        subjectId: d.subjectId ?? null,
        gradeId: d.gradeId ?? null,
        tuitionFee: d.tuitionFee,
        maxCapacity: d.maxCapacity,
        schedule: d.schedule ?? null,
        startDate: d.startDate ? new Date(d.startDate) : null,
        isActive: d.isActive
      });
    });
  }

  protected save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const request: ClassRequest = {
      classCode: v.classCode || null,
      name: v.name,
      teacherProfileId: this.auth.isAdmin() ? v.teacherProfileId : this.EMPTY_GUID,
      branchId: v.branchId || null,
      subjectId: v.subjectId || null,
      gradeId: v.gradeId || null,
      tuitionFee: v.tuitionFee,
      curriculumId: null,
      maxCapacity: v.maxCapacity,
      schedule: v.schedule,
      startDate: toDateOnlyOrNull(v.startDate),
      isActive: v.isActive
    };
    const id = this.classId();
    const op = id ? this.classesService.update(id, request) : this.classesService.create(request);
    this.saving.set(true);
    op.subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success('Đã lưu lớp.');
        this.open.set(false);
        this.saved.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.message.error(err.error?.message ?? err.message ?? 'Lưu lớp thất bại.');
      }
    });
  }
}
