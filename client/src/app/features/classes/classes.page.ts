import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { BranchesService } from '../../core/branches.service';
import { ClassesService } from '../../core/classes.service';
import { toDateOnlyOrNull } from '../../core/date-util';
import { GradesService } from '../../core/grades.service';
import {
  Branch, BranchRequest, ClassDetail, ClassImportClassPreview, ClassImportPreview,
  ClassImportStudentPreview, ClassListItem, ClassRequest, Grade, GradeRequest,
  RosterItem, Subject, SubjectRequest, TeacherProfile
} from '../../core/models';
import { SubjectsService } from '../../core/subjects.service';
import { TeachersService } from '../../core/teachers.service';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-classes-page',
  imports: [
    DecimalPipe, FormsModule, ReactiveFormsModule, PageHeader,
    NzButtonModule, NzCheckboxModule, NzDatePickerModule, NzEmptyModule, NzFormModule, NzIconModule,
    NzInputModule, NzInputNumberModule, NzModalModule, NzPopconfirmModule, NzSelectModule,
    NzTableModule, NzTabsModule, NzTagModule, NzUploadModule
  ],
  template: `
    <app-page-header title="Lớp học" subtitle="Quản lý lớp, danh mục và import Excel" icon="book">
      <button nz-button nzType="primary" (click)="openClassForm()"><nz-icon nzType="plus" /> Thêm lớp</button>
      <button nz-button (click)="openImportModal()"><nz-icon nzType="file-excel" /> Import Excel</button>
      <button nz-button (click)="exportClasses()"><nz-icon nzType="download" /> Export Excel</button>
    </app-page-header>

    <nz-tabs class="module-tabs" nzType="line">
      <nz-tab nzTitle="Lớp học">
        <div class="filters">
          <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Cơ sở" [(ngModel)]="branchId" (ngModelChange)="loadClasses()">
            @for (b of branches(); track b.id) { <nz-option [nzValue]="b.id" [nzLabel]="b.name" /> }
          </nz-select>
          <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Môn học" [(ngModel)]="subjectId" (ngModelChange)="loadClasses()">
            @for (s of subjects(); track s.id) { <nz-option [nzValue]="s.id" [nzLabel]="s.name" /> }
          </nz-select>
          <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Khối" [(ngModel)]="gradeId" (ngModelChange)="loadClasses()">
            @for (g of grades(); track g.id) { <nz-option [nzValue]="g.id" [nzLabel]="g.name" /> }
          </nz-select>
          <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Giáo viên" [(ngModel)]="teacherProfileId" (ngModelChange)="loadClasses()">
            @for (t of teachers(); track t.id) { <nz-option [nzValue]="t.id" [nzLabel]="t.fullName" /> }
          </nz-select>
          <input nz-input placeholder="Mã lớp, tên lớp, giáo viên" [(ngModel)]="search" (ngModelChange)="onSearch()" />
        </div>

        <nz-table #classTable [nzData]="classes()" [nzLoading]="loading()" [nzFrontPagination]="false"
          [nzPageIndex]="page()" [nzPageSize]="pageSize()" [nzTotal]="total()"
          (nzPageIndexChange)="page.set($event); loadClasses()" [nzScroll]="{ x: '1100px' }">
          <thead>
            <tr>
              <th>STT</th>
              <th>Mã lớp</th>
              <th>Tên lớp</th>
              <th>Giáo viên</th>
              <th>Môn học</th>
              <th>Khối</th>
              <th>Mã cơ sở</th>
              <th>Tên cơ sở</th>
              <th>Học phí</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            @for (c of classTable.data; track c.id; let i = $index) {
              <tr class="clickable" (click)="openClassDetail(c)">
                <td>{{ (page() - 1) * pageSize() + i + 1 }}</td>
                <td>{{ c.classCode }}</td>
                <td>{{ c.name }}</td>
                <td>{{ c.teacherName || '—' }}</td>
                <td>{{ c.subjectName || '—' }}</td>
                <td>{{ c.gradeName || '—' }}</td>
                <td>{{ c.branchCode || '—' }}</td>
                <td>{{ c.branchName || '—' }}</td>
                <td>{{ c.tuitionFee | number:'1.0-0' }}</td>
                <td (click)="$event.stopPropagation()">
                  <button nz-button nzType="link" nzSize="small" (click)="openClassForm(c)"><nz-icon nzType="edit" /></button>
                  <button nz-button nzType="link" nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Xóa lớp này?"
                    (nzOnConfirm)="deleteClass(c)"><nz-icon nzType="delete" /></button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-tab>

      <nz-tab nzTitle="Danh mục">
        <div class="catalog-grid">
          <section>
            <h3>Môn học</h3>
            <form nz-form nzLayout="inline">
              <input nz-input placeholder="Tên môn" [(ngModel)]="subjectName" name="subjectName" />
              <nz-input-number [(ngModel)]="subjectIndex" name="subjectIndex" [nzMin]="0" nzPlaceHolder="Thứ tự" />
              <button nz-button nzType="primary" (click)="saveSubject()">{{ editingSubject() ? 'Cập nhật' : 'Thêm' }}</button>
              @if (editingSubject()) { <button nz-button (click)="resetSubject()">Hủy</button> }
            </form>
            <nz-table [nzData]="subjects()" [nzFrontPagination]="false" nzSize="small">
              <thead><tr><th>STT</th><th>Mã</th><th>Tên</th><th>Thao tác</th></tr></thead>
              <tbody>
                @for (s of subjects(); track s.id; let i = $index) {
                  <tr><td>{{ i + 1 }}</td><td>{{ s.code }}</td><td>{{ s.name }}</td><td>
                    <button nz-button nzType="link" nzSize="small" (click)="editSubject(s)">Sửa</button>
                    <button nz-button nzType="link" nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Xóa môn?"
                      (nzOnConfirm)="deleteSubject(s)">Xóa</button>
                  </td></tr>
                }
              </tbody>
            </nz-table>
          </section>

          <section>
            <h3>Khối</h3>
            <form nz-form nzLayout="inline">
              <input nz-input placeholder="Tên khối" [(ngModel)]="gradeName" name="gradeName" />
              <nz-input-number [(ngModel)]="gradeIndex" name="gradeIndex" [nzMin]="0" nzPlaceHolder="Thứ tự" />
              <button nz-button nzType="primary" (click)="saveGrade()">{{ editingGrade() ? 'Cập nhật' : 'Thêm' }}</button>
              @if (editingGrade()) { <button nz-button (click)="resetGrade()">Hủy</button> }
            </form>
            <nz-table [nzData]="grades()" [nzFrontPagination]="false" nzSize="small">
              <thead><tr><th>STT</th><th>Mã</th><th>Tên</th><th>Thao tác</th></tr></thead>
              <tbody>
                @for (g of grades(); track g.id; let i = $index) {
                  <tr><td>{{ i + 1 }}</td><td>{{ g.code }}</td><td>{{ g.name }}</td><td>
                    <button nz-button nzType="link" nzSize="small" (click)="editGrade(g)">Sửa</button>
                    <button nz-button nzType="link" nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Xóa khối?"
                      (nzOnConfirm)="deleteGrade(g)">Xóa</button>
                  </td></tr>
                }
              </tbody>
            </nz-table>
          </section>

          <section>
            <h3>Cơ sở</h3>
            <form nz-form nzLayout="inline">
              <input nz-input placeholder="Tên cơ sở" [(ngModel)]="branchName" name="branchName" />
              <nz-input-number [(ngModel)]="branchIndex" name="branchIndex" [nzMin]="0" nzPlaceHolder="Thứ tự" />
              <button nz-button nzType="primary" (click)="saveBranch()">{{ editingBranch() ? 'Cập nhật' : 'Thêm' }}</button>
              @if (editingBranch()) { <button nz-button (click)="resetBranch()">Hủy</button> }
            </form>
            <nz-table [nzData]="branches()" [nzFrontPagination]="false" nzSize="small">
              <thead><tr><th>STT</th><th>Mã</th><th>Tên</th><th>Thao tác</th></tr></thead>
              <tbody>
                @for (b of branches(); track b.id; let i = $index) {
                  <tr><td>{{ i + 1 }}</td><td>{{ b.code }}</td><td>{{ b.name }}</td><td>
                    <button nz-button nzType="link" nzSize="small" (click)="editBranch(b)">Sửa</button>
                    <button nz-button nzType="link" nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Xóa cơ sở?"
                      (nzOnConfirm)="deleteBranch(b)">Xóa</button>
                  </td></tr>
                }
              </tbody>
            </nz-table>
          </section>
        </div>
      </nz-tab>

      <nz-tab nzTitle="Cấu hình">
        <nz-empty nzNotFoundContent="Chưa có cấu hình" />
      </nz-tab>
    </nz-tabs>

    <nz-modal [nzVisible]="classModalOpen()" [nzTitle]="editingClass() ? 'Sửa lớp' : 'Thêm lớp'" [nzWidth]="720"
      (nzOnCancel)="classModalOpen.set(false)" (nzOnOk)="saveClass()">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="classForm" nzLayout="vertical">
          <div class="form-grid">
            <nz-form-item><nz-form-label>Mã lớp</nz-form-label><nz-form-control><input nz-input formControlName="classCode" placeholder="Trống để tự sinh" /></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label nzRequired>Tên lớp</nz-form-label><nz-form-control><input nz-input formControlName="name" /></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label nzRequired>Giáo viên</nz-form-label><nz-form-control><nz-select formControlName="teacherProfileId" nzShowSearch>@for (t of teachers(); track t.id) { <nz-option [nzValue]="t.id" [nzLabel]="t.fullName" /> }</nz-select></nz-form-control></nz-form-item>
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

    <nz-modal [nzVisible]="detailOpen()" nzTitle="Chi tiết lớp" [nzWidth]="980" [nzFooter]="null" (nzOnCancel)="detailOpen.set(false)">
      <ng-container *nzModalContent>
        @if (detail(); as d) {
          <div class="detail-grid">
            <div><b>Mã lớp</b><span>{{ d.classCode }}</span></div>
            <div><b>Tên lớp</b><span>{{ d.name }}</span></div>
            <div><b>Giáo viên</b><span>{{ d.teacherName || '—' }}</span></div>
            <div><b>Môn / Khối</b><span>{{ d.subjectName || '—' }} / {{ d.gradeName || '—' }}</span></div>
            <div><b>Cơ sở</b><span>{{ d.branchCode || '—' }} · {{ d.branchName || '—' }}</span></div>
            <div><b>Học phí</b><span>{{ d.tuitionFee | number:'1.0-0' }}</span></div>
          </div>
          <div class="detail-actions">
            <button nz-button nzType="primary" (click)="openStudentInClass()"><nz-icon nzType="plus" /> Thêm học viên</button>
          </div>
          <nz-table [nzData]="roster()" [nzFrontPagination]="false" nzSize="small">
            <thead><tr><th>Mã HV</th><th>Học viên</th><th>SĐT</th><th>SĐT PH</th><th>Ghi chú</th><th></th></tr></thead>
            <tbody>
              @for (r of roster(); track r.enrollmentId) {
                <tr>
                  <td>{{ r.studentCode }}</td><td>{{ r.fullName }}</td><td>{{ r.phone || '—' }}</td><td>{{ r.parentPhone || '—' }}</td><td>{{ r.note || '—' }}</td>
                  <td><button nz-button nzType="link" nzDanger nz-popconfirm nzPopconfirmTitle="Xóa khỏi lớp?" (nzOnConfirm)="withdrawStudent(r)">Xóa</button></td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="studentModalOpen()" nzTitle="Thêm học viên vào lớp" [nzWidth]="560"
      (nzOnCancel)="studentModalOpen.set(false)" (nzOnOk)="saveStudentInClass()">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="studentForm" nzLayout="vertical">
          <nz-form-item><nz-form-label>Mã học viên</nz-form-label><nz-form-control><input nz-input formControlName="studentCode" placeholder="Trống để tự sinh" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label nzRequired>Tên học viên</nz-form-label><nz-form-control><input nz-input formControlName="fullName" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>SĐT học viên</nz-form-label><nz-form-control><input nz-input formControlName="phone" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>SĐT phụ huynh</nz-form-label><nz-form-control><input nz-input formControlName="parentPhone" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Email</nz-form-label><nz-form-control><input nz-input formControlName="email" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Ghi chú</nz-form-label><nz-form-control><textarea nz-input formControlName="note" rows="3"></textarea></nz-form-control></nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="importOpen()" nzTitle="Import lớp học" [nzWidth]="1080"
      (nzOnCancel)="importOpen.set(false)" [nzOkText]="importPreview() ? 'Xác nhận import' : null"
      [nzOkDisabled]="!importPreview()" (nzOnOk)="commitImport()">
      <ng-container *nzModalContent>
        <div style="margin-bottom:14px;display:flex;gap:12px;align-items:center">
          <button nz-button (click)="downloadImportTemplate()"><nz-icon nzType="download" /> Tải file mẫu</button>
          <nz-upload [nzShowUploadList]="false" [nzBeforeUpload]="beforeImportUpload">
            <button nz-button nzType="primary"><nz-icon nzType="upload" /> Chọn file Excel</button>
          </nz-upload>
        </div>
        @if (importPreview(); as p) {
          <div class="import-grid">
            <nz-table [nzData]="p.classes" [nzFrontPagination]="false" nzSize="small">
              <thead><tr><th>Lớp</th><th>Giáo viên</th><th>Lỗi</th></tr></thead>
              <tbody>
                @for (c of p.classes; track c.previewId) {
                  <tr [class.selected]="selectedImportClass() === c.previewId" (click)="selectedImportClass.set(c.previewId)">
                    <td>{{ c.classCode || 'Tự sinh' }} · {{ c.name }}</td><td>{{ c.teacherName || '—' }}</td><td>{{ c.error || '—' }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
            <nz-table [nzData]="selectedImportStudents()" [nzFrontPagination]="false" nzSize="small">
              <thead><tr><th>Dòng</th><th>Mã HV</th><th>Học viên</th><th>SĐT PH</th><th>Lỗi</th></tr></thead>
              <tbody>
                @for (s of selectedImportStudents(); track s.rowNumber) {
                  <tr><td>{{ s.rowNumber }}</td><td>{{ s.studentCode || 'Tự sinh' }}</td><td>{{ s.fullName }}</td><td>{{ s.parentPhone || '—' }}</td><td>{{ s.error || '—' }}</td></tr>
                }
              </tbody>
            </nz-table>
          </div>
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .module-tabs { margin-top: 4px; }
    .filters { display: grid; grid-template-columns: repeat(5, minmax(150px, 1fr)); gap: 10px; margin-bottom: 14px; }
    .clickable { cursor: pointer; }
    .catalog-grid { display: grid; grid-template-columns: repeat(3, minmax(260px, 1fr)); gap: 16px; }
    section { border: 1px solid var(--hs-border); border-radius: 8px; padding: 14px; }
    section h3 { margin: 0 0 12px; font-size: 16px; }
    form[nz-form] { gap: 8px; margin-bottom: 12px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 16px; }
    .full { width: 100%; }
    .detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; }
    .detail-grid div { border: 1px solid var(--hs-border); border-radius: 8px; padding: 10px; }
    .detail-grid b { display: block; color: var(--hs-text-muted); font-size: 12px; margin-bottom: 4px; }
    .detail-actions { margin-bottom: 12px; }
    .import-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .selected td { background: var(--hs-surface-2); }
    @media (max-width: 900px) {
      .filters, .catalog-grid, .form-grid, .detail-grid, .import-grid { grid-template-columns: 1fr; }
    }
  `
})
export class ClassesPage {
  private readonly classesService = inject(ClassesService);
  private readonly branchesService = inject(BranchesService);
  private readonly subjectsService = inject(SubjectsService);
  private readonly gradesService = inject(GradesService);
  private readonly teachersService = inject(TeachersService);
  private readonly message = inject(NzMessageService);

  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly subjects = signal<Subject[]>([]);
  protected readonly grades = signal<Grade[]>([]);
  protected readonly teachers = signal<TeacherProfile[]>([]);
  protected readonly loading = signal(false);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);

  protected search = '';
  protected branchId: string | null = null;
  protected subjectId: string | null = null;
  protected gradeId: string | null = null;
  protected teacherProfileId: string | null = null;
  private searchTimer?: ReturnType<typeof setTimeout>;

  protected readonly classModalOpen = signal(false);
  protected readonly editingClass = signal<ClassListItem | null>(null);
  protected readonly classForm = new FormGroup({
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

  protected readonly detailOpen = signal(false);
  protected readonly detail = signal<ClassDetail | null>(null);
  protected readonly roster = signal<RosterItem[]>([]);

  protected readonly studentModalOpen = signal(false);
  protected readonly studentForm = new FormGroup({
    studentCode: new FormControl<string | null>(null),
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl<string | null>(null),
    parentPhone: new FormControl<string | null>(null),
    email: new FormControl<string | null>(null),
    note: new FormControl<string | null>(null)
  });

  protected readonly importOpen = signal(false);
  protected readonly importPreview = signal<ClassImportPreview | null>(null);
  protected readonly selectedImportClass = signal<string | null>(null);
  protected readonly selectedImportStudents = computed(() => {
    const id = this.selectedImportClass();
    return this.importPreview()?.students.filter(s => s.previewClassId === id) ?? [];
  });

  protected readonly editingSubject = signal<Subject | null>(null);
  protected subjectName = '';
  protected subjectIndex = 0;
  protected readonly editingGrade = signal<Grade | null>(null);
  protected gradeName = '';
  protected gradeIndex = 0;
  protected readonly editingBranch = signal<Branch | null>(null);
  protected branchName = '';
  protected branchIndex = 0;

  constructor() {
    this.loadLookups();
    this.loadClasses();
  }

  protected loadClasses(): void {
    this.loading.set(true);
    this.classesService.getPaged({
      page: this.page(), pageSize: this.pageSize(), search: this.search,
      branchId: this.branchId ?? undefined, subjectId: this.subjectId ?? undefined,
      gradeId: this.gradeId ?? undefined, teacherProfileId: this.teacherProfileId ?? undefined
    }).subscribe({
      next: r => { this.classes.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected onSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.loadClasses(); }, 250);
  }

  private loadLookups(): void {
    this.branchesService.getAll().subscribe(x => this.branches.set(x));
    this.subjectsService.getAll().subscribe(x => this.subjects.set(x));
    this.gradesService.getAll().subscribe(x => this.grades.set(x));
    this.teachersService.getPaged({ page: 1, pageSize: 500 }).subscribe(x => this.teachers.set(x.items));
  }

  protected openClassForm(item?: ClassListItem): void {
    this.editingClass.set(item ?? null);
    this.classForm.reset({
      classCode: item?.classCode ?? null,
      name: item?.name ?? '',
      teacherProfileId: item?.teacherProfileId ?? '',
      branchId: item?.branchId ?? null,
      subjectId: item?.subjectId ?? null,
      gradeId: item?.gradeId ?? null,
      tuitionFee: item?.tuitionFee ?? 0,
      maxCapacity: item?.maxCapacity ?? 20,
      schedule: null,
      startDate: null,
      isActive: item?.isActive ?? true
    });
    this.classModalOpen.set(true);
  }

  protected saveClass(): void {
    if (this.classForm.invalid) return;
    const v = this.classForm.getRawValue();
    const request: ClassRequest = {
      classCode: v.classCode || null,
      name: v.name,
      teacherProfileId: v.teacherProfileId,
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
    const editing = this.editingClass();
    const op = editing ? this.classesService.update(editing.id, request) : this.classesService.create(request);
    op.subscribe({
      next: () => { this.message.success('Đã lưu lớp.'); this.classModalOpen.set(false); this.loadClasses(); this.loadLookups(); },
      error: err => this.showError(err, 'Lưu lớp thất bại.')
    });
  }

  protected deleteClass(c: ClassListItem): void {
    this.classesService.delete(c.id).subscribe({
      next: () => { this.message.success('Đã xóa lớp.'); this.loadClasses(); },
      error: err => this.showError(err, 'Xóa lớp thất bại.')
    });
  }

  protected openClassDetail(c: ClassListItem): void {
    this.classesService.getById(c.id).subscribe(x => this.detail.set(x));
    this.classesService.getRoster(c.id).subscribe(x => this.roster.set(x));
    this.detailOpen.set(true);
  }

  protected openStudentInClass(): void {
    this.studentForm.reset({ studentCode: null, fullName: '', phone: null, parentPhone: null, email: null, note: null });
    this.studentModalOpen.set(true);
  }

  protected saveStudentInClass(): void {
    const d = this.detail();
    if (!d || this.studentForm.invalid) return;
    const v = this.studentForm.getRawValue();
    this.classesService.createStudent(d.id, { ...v, createAccount: false }).subscribe({
      next: () => { this.message.success('Đã thêm học viên.'); this.studentModalOpen.set(false); this.openClassDetail({ ...d, currentSize: d.currentSize } as ClassListItem); },
      error: err => this.showError(err, 'Thêm học viên thất bại.')
    });
  }

  protected withdrawStudent(r: RosterItem): void {
    const d = this.detail();
    if (!d) return;
    this.classesService.withdraw(d.id, r.studentId).subscribe({
      next: () => { this.message.success('Đã xóa khỏi lớp.'); this.openClassDetail({ ...d, currentSize: d.currentSize } as ClassListItem); },
      error: err => this.showError(err, 'Xóa học viên khỏi lớp thất bại.')
    });
  }

  protected openImportModal(): void {
    this.importPreview.set(null);
    this.selectedImportClass.set(null);
    this.importOpen.set(true);
  }

  protected exportClasses(): void {
    this.classesService.exportClasses({
      search: this.search || undefined,
      branchId: this.branchId ?? undefined,
      subjectId: this.subjectId ?? undefined,
      gradeId: this.gradeId ?? undefined,
      teacherProfileId: this.teacherProfileId ?? undefined
    }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'danh-sach-lop.xlsx'; a.click();
        URL.revokeObjectURL(url);
      },
      error: err => this.showError(err, 'Export thất bại.')
    });
  }

  protected downloadImportTemplate(): void {
    this.classesService.downloadClassImportTemplate().subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'mau-import-lop-hoc.xlsx'; a.click();
      URL.revokeObjectURL(url);
    });
  }

  protected readonly beforeImportUpload = (file: NzUploadFile): boolean => {
    const raw = file as unknown as File;
    this.classesService.importClassesPreview(raw).subscribe({
      next: p => {
        this.importPreview.set(p);
        this.selectedImportClass.set(p.classes[0]?.previewId ?? null);
        this.importOpen.set(true);
      },
      error: err => this.showError(err, 'Không đọc được file import.')
    });
    return false;
  };

  protected commitImport(): void {
    const preview = this.importPreview();
    if (!preview) return;
    this.classesService.importClassesCommit({ classes: preview.classes, students: preview.students }).subscribe({
      next: r => {
        this.message.success(`Đã tạo ${r.classesCreated} lớp, ${r.studentsCreated} học viên.`);
        this.importOpen.set(false);
        this.loadClasses();
        this.loadLookups();
      },
      error: err => this.showError(err, 'Import thất bại.')
    });
  }

  protected saveSubject(): void {
    const req: SubjectRequest = { name: this.subjectName.trim(), description: null, indexOrder: this.subjectIndex, isActive: true };
    if (!req.name) return;
    const editing = this.editingSubject();
    const op = editing ? this.subjectsService.update(editing.id, req) : this.subjectsService.create(req);
    op.subscribe({ next: () => { this.resetSubject(); this.loadLookups(); }, error: err => this.showError(err, 'Lưu môn thất bại.') });
  }
  protected editSubject(s: Subject): void { this.editingSubject.set(s); this.subjectName = s.name; this.subjectIndex = s.indexOrder; }
  protected resetSubject(): void { this.editingSubject.set(null); this.subjectName = ''; this.subjectIndex = 0; }
  protected deleteSubject(s: Subject): void { this.subjectsService.delete(s.id).subscribe({ next: () => this.loadLookups(), error: err => this.showError(err, 'Xóa môn thất bại.') }); }

  protected saveGrade(): void {
    const req: GradeRequest = { name: this.gradeName.trim(), indexOrder: this.gradeIndex, isActive: true };
    if (!req.name) return;
    const editing = this.editingGrade();
    const op = editing ? this.gradesService.update(editing.id, req) : this.gradesService.create(req);
    op.subscribe({ next: () => { this.resetGrade(); this.loadLookups(); }, error: err => this.showError(err, 'Lưu khối thất bại.') });
  }
  protected editGrade(g: Grade): void { this.editingGrade.set(g); this.gradeName = g.name; this.gradeIndex = g.indexOrder; }
  protected resetGrade(): void { this.editingGrade.set(null); this.gradeName = ''; this.gradeIndex = 0; }
  protected deleteGrade(g: Grade): void { this.gradesService.delete(g.id).subscribe({ next: () => this.loadLookups(), error: err => this.showError(err, 'Xóa khối thất bại.') }); }

  protected saveBranch(): void {
    const req: BranchRequest = { name: this.branchName.trim(), address: null, phone: null, indexOrder: this.branchIndex, isActive: true };
    if (!req.name) return;
    const editing = this.editingBranch();
    const op = editing ? this.branchesService.update(editing.id, req) : this.branchesService.create(req);
    op.subscribe({ next: () => { this.resetBranch(); this.loadLookups(); }, error: err => this.showError(err, 'Lưu cơ sở thất bại.') });
  }
  protected editBranch(b: Branch): void { this.editingBranch.set(b); this.branchName = b.name; this.branchIndex = b.indexOrder; }
  protected resetBranch(): void { this.editingBranch.set(null); this.branchName = ''; this.branchIndex = 0; }
  protected deleteBranch(b: Branch): void { this.branchesService.delete(b.id).subscribe({ next: () => this.loadLookups(), error: err => this.showError(err, 'Xóa cơ sở thất bại.') }); }

  private showError(err: HttpErrorResponse, fallback: string): void {
    this.message.error(err.error?.message ?? err.message ?? fallback);
  }
}
