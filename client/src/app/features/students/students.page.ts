import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../core/auth.service';
import { ScreenService } from '../../core/screen.service';
import { Student, StudentRequest } from '../../core/models';
import { StudentsService } from '../../core/students.service';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-students-page',
  imports: [
    FormsModule, ReactiveFormsModule, RouterLink,
    NzTableModule, NzButtonModule, NzIconModule, NzInputModule, NzTagModule, NzGridModule,
    NzModalModule, NzFormModule, NzInputNumberModule, NzSwitchModule, NzDatePickerModule,
    NzPopconfirmModule, NzCheckboxModule, NzCardModule, NzPaginationModule, PageHeader
  ],
  template: `
    <app-page-header title="Học viên" subtitle="Hồ sơ & tiến độ học sinh" icon="idcard">
      <div class="actions">
        <input nz-input placeholder="Tìm theo tên / SĐT..." class="search"
               [ngModel]="search()" (ngModelChange)="onSearch($event)" />
        @if (auth.isAdmin()) {
          <label nz-checkbox [ngModel]="includeDeleted()" (ngModelChange)="onIncludeDeleted($event)">Hiện đã xóa</label>
          <button nz-button nzType="primary" (click)="openCreate()"><nz-icon nzType="plus" /> Thêm học viên</button>
        }
      </div>
    </app-page-header>

    @if (screen.isMobile()) {
      <div class="mobile-card-list">
        @for (s of students(); track s.id) {
          <nz-card>
            <div class="card-header">
              <a class="card-title" [routerLink]="['/students', s.id]" [class.text-deleted]="s.isDeleted">{{ s.fullName }}</a>
              @if (s.isDeleted) { <nz-tag nzColor="red">Đã xóa</nz-tag> }
              @else if (s.isActive) { <nz-tag nzColor="green">Đang học</nz-tag> }
              @else { <nz-tag>Ngừng</nz-tag> }
            </div>
            <div class="card-field"><span class="label">Trình độ</span><span>{{ s.englishLevel || '—' }}</span></div>
            <div class="card-field"><span class="label">Mục tiêu</span><span>{{ s.learningGoal || '—' }}</span></div>
            <div class="card-field"><span class="label">SĐT PH</span><span>{{ s.parentPhone || '—' }}</span></div>
            @if (auth.isAdmin()) {
              <div class="card-actions">
                @if (!s.isDeleted) {
                  <button nz-button nzSize="small" (click)="openEdit(s)"><nz-icon nzType="edit" /> Sửa</button>
                  <button nz-button nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Xóa mềm học viên này?" (nzOnConfirm)="remove(s)"><nz-icon nzType="delete" /> Xóa</button>
                } @else {
                  <button nz-button nzSize="small" (click)="restore(s)"><nz-icon nzType="undo" /> Khôi phục</button>
                }
              </div>
            }
          </nz-card>
        }
      </div>
      <nz-pagination class="mobile-pagination" [nzPageIndex]="page()" [nzTotal]="total()" [nzPageSize]="pageSize()" (nzPageIndexChange)="onPageChange($event)" />
    } @else {
      <nz-table #table [nzData]="students()" [nzLoading]="loading()" [nzFrontPagination]="false"
        [nzTotal]="total()" [nzPageIndex]="page()" [nzPageSize]="pageSize()"
        (nzPageIndexChange)="onPageChange($event)" [nzScroll]="{ x: '720px' }">
        <thead>
          <tr>
            <th nzLeft>Họ tên</th>
            <th>Trình độ</th>
            <th>Mục tiêu</th>
            <th>SĐT phụ huynh</th>
            <th>Trạng thái</th>
            @if (auth.isAdmin()) { <th nzRight class="actions-col">Thao tác</th> }
          </tr>
        </thead>
        <tbody>
          @for (s of table.data; track s.id) {
            <tr>
              <td nzLeft [class.text-deleted]="s.isDeleted"><a [routerLink]="['/students', s.id]">{{ s.fullName }}</a></td>
              <td>{{ s.englishLevel || '—' }}</td>
              <td>{{ s.learningGoal || '—' }}</td>
              <td>{{ s.parentPhone || '—' }}</td>
              <td>
                @if (s.isDeleted) { <nz-tag nzColor="red">Đã xóa</nz-tag> }
                @else if (s.isActive) { <nz-tag nzColor="green">Đang học</nz-tag> }
                @else { <nz-tag>Ngừng</nz-tag> }
              </td>
              @if (auth.isAdmin()) {
                <td nzRight>
                  @if (!s.isDeleted) {
                    <button nz-button nzType="link" nzSize="small" (click)="openEdit(s)"><nz-icon nzType="edit" /></button>
                    <button nz-button nzType="link" nzSize="small" nzDanger
                            nz-popconfirm nzPopconfirmTitle="Xóa mềm học viên này?" (nzOnConfirm)="remove(s)">
                      <nz-icon nzType="delete" />
                    </button>
                  } @else {
                    <button nz-button nzType="link" nzSize="small" (click)="restore(s)"><nz-icon nzType="undo" /> Khôi phục</button>
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </nz-table>
    }

    <nz-modal [nzVisible]="modalOpen()" [nzTitle]="editing() ? 'Sửa học viên' : 'Thêm học viên'"
      [nzOkLoading]="saving()" [nzOkDisabled]="form.invalid" (nzOnOk)="save()" (nzOnCancel)="closeModal()" [nzWidth]="640">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-row [nzGutter]="12">
            <nz-col [nzXs]="24" [nzSm]="12">
              <nz-form-item>
                <nz-form-label nzRequired>Họ tên</nz-form-label>
                <nz-form-control nzErrorTip="Vui lòng nhập tên"><input nz-input formControlName="fullName" /></nz-form-control>
              </nz-form-item>
            </nz-col>
            <nz-col [nzXs]="24" [nzSm]="12">
              <nz-form-item><nz-form-label>Ngày sinh</nz-form-label>
                <nz-form-control><nz-date-picker formControlName="dateOfBirth" nzFormat="dd/MM/yyyy" class="full" /></nz-form-control>
              </nz-form-item>
            </nz-col>
            <nz-col [nzXs]="24" [nzSm]="12">
              <nz-form-item><nz-form-label>SĐT học sinh</nz-form-label>
                <nz-form-control><input nz-input formControlName="phone" /></nz-form-control></nz-form-item>
            </nz-col>
            <nz-col [nzXs]="24" [nzSm]="12">
              <nz-form-item><nz-form-label>Trường</nz-form-label>
                <nz-form-control><input nz-input formControlName="school" /></nz-form-control></nz-form-item>
            </nz-col>
            <nz-col [nzXs]="24" [nzSm]="12">
              <nz-form-item><nz-form-label>Phụ huynh</nz-form-label>
                <nz-form-control><input nz-input formControlName="parentName" /></nz-form-control></nz-form-item>
            </nz-col>
            <nz-col [nzXs]="24" [nzSm]="12">
              <nz-form-item><nz-form-label>SĐT phụ huynh</nz-form-label>
                <nz-form-control><input nz-input formControlName="parentPhone" /></nz-form-control></nz-form-item>
            </nz-col>
            <nz-col [nzXs]="24" [nzSm]="12">
              <nz-form-item><nz-form-label>Trình độ</nz-form-label>
                <nz-form-control><input nz-input formControlName="englishLevel" placeholder="VD: Movers" /></nz-form-control></nz-form-item>
            </nz-col>
            <nz-col [nzXs]="24" [nzSm]="12">
              <nz-form-item><nz-form-label>Điểm đầu vào</nz-form-label>
                <nz-form-control><nz-input-number formControlName="entryScore" [nzMin]="0" class="full" /></nz-form-control></nz-form-item>
            </nz-col>
            <nz-col [nzXs]="24">
              <nz-form-item><nz-form-label>Mục tiêu học tập</nz-form-label>
                <nz-form-control><input nz-input formControlName="learningGoal" placeholder="VD: IELTS 6.5" /></nz-form-control></nz-form-item>
            </nz-col>
            <nz-col [nzXs]="24">
              <nz-form-item><nz-form-label>Địa chỉ</nz-form-label>
                <nz-form-control><input nz-input formControlName="address" /></nz-form-control></nz-form-item>
            </nz-col>
            <nz-col [nzXs]="24">
              <nz-form-item><nz-form-label>Đang học</nz-form-label>
                <nz-form-control><nz-switch formControlName="isActive" /></nz-form-control></nz-form-item>
            </nz-col>
          </nz-row>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .search { width: 240px; max-width: 60vw; }
    .full { width: 100%; }
    .mobile-card-list { display: flex; flex-direction: column; gap: 12px; padding: 12px; }
    .card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .card-title { font-weight: 600; flex: 1; }
    .card-field { display: flex; gap: 8px; margin-bottom: 4px; font-size: 13px; }
    .card-field .label { color: #888; min-width: 72px; }
    .card-actions { display: flex; gap: 8px; margin-top: 10px; }
    .mobile-pagination { display: flex; justify-content: center; padding: 12px 0; }
  `
})
export class StudentsPage {
  protected readonly auth = inject(AuthService);
  protected readonly screen = inject(ScreenService);
  private readonly studentsService = inject(StudentsService);
  private readonly message = inject(NzMessageService);

  protected readonly students = signal<Student[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly search = signal('');
  protected readonly includeDeleted = signal(false);
  protected readonly loading = signal(false);

  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Student | null>(null);

  protected readonly form = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    dateOfBirth: new FormControl<Date | null>(null),
    phone: new FormControl<string | null>(null),
    school: new FormControl<string | null>(null),
    parentName: new FormControl<string | null>(null),
    parentPhone: new FormControl<string | null>(null),
    englishLevel: new FormControl<string | null>(null),
    entryScore: new FormControl<number | null>(null),
    learningGoal: new FormControl<string | null>(null),
    address: new FormControl<string | null>(null),
    isActive: new FormControl(true, { nonNullable: true })
  });

  private searchDebounce?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.studentsService.getPaged({
      page: this.page(), pageSize: this.pageSize(),
      search: this.search() || undefined, includeDeleted: this.includeDeleted()
    }).subscribe({
      next: r => { this.students.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => { this.page.set(1); this.load(); }, 350);
  }

  protected onIncludeDeleted(value: boolean): void { this.includeDeleted.set(value); this.page.set(1); this.load(); }
  protected onPageChange(p: number): void { this.page.set(p); this.load(); }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ isActive: true });
    this.modalOpen.set(true);
  }

  protected openEdit(s: Student): void {
    this.editing.set(s);
    this.form.reset({
      fullName: s.fullName,
      dateOfBirth: s.dateOfBirth ? new Date(s.dateOfBirth) : null,
      phone: s.phone, school: s.school, parentName: s.parentName, parentPhone: s.parentPhone,
      englishLevel: s.englishLevel, entryScore: s.entryScore, learningGoal: s.learningGoal,
      address: s.address, isActive: s.isActive
    });
    this.modalOpen.set(true);
  }

  protected closeModal(): void { this.modalOpen.set(false); }

  protected save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const request: StudentRequest = {
      fullName: v.fullName, dateOfBirth: toIsoDate(v.dateOfBirth), school: v.school, gradeLevel: null,
      phone: v.phone, parentName: v.parentName, parentPhone: v.parentPhone, address: v.address,
      enrollmentDate: null, englishLevel: v.englishLevel, learningGoal: v.learningGoal,
      entryScore: v.entryScore, curriculum: null, isActive: v.isActive
    };
    const editing = this.editing();
    const op = editing ? this.studentsService.update(editing.id, request) : this.studentsService.create(request);
    this.saving.set(true);
    op.subscribe({
      next: () => { this.saving.set(false); this.modalOpen.set(false); this.message.success(editing ? 'Đã cập nhật.' : 'Đã thêm học viên.'); this.load(); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message ??'Lưu thất bại.'); }
    });
  }

  protected remove(s: Student): void {
    this.studentsService.delete(s.id).subscribe({
      next: () => { this.message.success('Đã xóa (mềm).'); this.load(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ??'Xóa thất bại.')
    });
  }

  protected restore(s: Student): void {
    this.studentsService.restore(s.id).subscribe({
      next: () => { this.message.success('Đã khôi phục.'); this.load(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ??'Khôi phục thất bại.')
    });
  }
}

function toIsoDate(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
