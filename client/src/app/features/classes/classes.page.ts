import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../core/auth.service';
import { ScreenService } from '../../core/screen.service';
import { ClassesService } from '../../core/classes.service';
import { ClassListItem, ClassRequest, ROLE_ADMIN, ROLE_TEACHER, UserListItem } from '../../core/models';
import { UsersService } from '../../core/users.service';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-classes-page',
  imports: [
    FormsModule, ReactiveFormsModule, RouterLink,
    NzTableModule, NzButtonModule, NzIconModule, NzInputModule, NzTagModule, NzSelectModule,
    NzModalModule, NzFormModule, NzInputNumberModule, NzSwitchModule, NzDatePickerModule,
    NzPopconfirmModule, NzCheckboxModule, NzCardModule, NzPaginationModule, PageHeader
  ],
  template: `
    <app-page-header title="Lớp học" subtitle="Danh sách lớp & phân công giáo viên" icon="book">
      <div class="actions">
        <input nz-input placeholder="Tìm theo tên lớp..." class="search"
               [ngModel]="search()" (ngModelChange)="onSearch($event)" />
        @if (auth.isAdmin()) {
          <label nz-checkbox [ngModel]="includeDeleted()" (ngModelChange)="onIncludeDeleted($event)">Hiện đã xóa</label>
          <button nz-button nzType="primary" (click)="openCreate()"><nz-icon nzType="plus" /> Thêm lớp</button>
        }
      </div>
    </app-page-header>

    @if (screen.isMobile()) {
      <div class="mobile-card-list">
        @for (c of classes(); track c.id) {
          <nz-card>
            <div class="card-header">
              <a class="card-title" [routerLink]="['/classes', c.id]" [class.text-deleted]="c.isDeleted">{{ c.name }}</a>
              @if (c.isDeleted) { <nz-tag nzColor="red">Đã xóa</nz-tag> }
              @else if (c.isActive) { <nz-tag nzColor="green">Đang mở</nz-tag> }
              @else { <nz-tag>Đóng</nz-tag> }
            </div>
            <div class="card-field"><span class="label">Giáo viên</span><span>{{ c.teacherName || '—' }}</span></div>
            <div class="card-field"><span class="label">Sĩ số</span><span>{{ c.currentSize }}/{{ c.maxCapacity }}</span></div>
            @if (auth.isAdmin()) {
              <div class="card-actions">
                @if (!c.isDeleted) {
                  <button nz-button nzSize="small" (click)="openEdit(c)"><nz-icon nzType="edit" /> Sửa</button>
                  <button nz-button nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Xóa mềm lớp này?" (nzOnConfirm)="remove(c)"><nz-icon nzType="delete" /> Xóa</button>
                } @else {
                  <button nz-button nzSize="small" (click)="restore(c)"><nz-icon nzType="undo" /> Khôi phục</button>
                }
              </div>
            }
          </nz-card>
        }
      </div>
      <nz-pagination class="mobile-pagination" [nzPageIndex]="page()" [nzTotal]="total()" [nzPageSize]="pageSize()" (nzPageIndexChange)="onPageChange($event)" />
    } @else {
      <nz-table #table [nzData]="classes()" [nzLoading]="loading()" [nzFrontPagination]="false"
        [nzTotal]="total()" [nzPageIndex]="page()" [nzPageSize]="pageSize()"
        (nzPageIndexChange)="onPageChange($event)" [nzScroll]="{ x: '640px' }">
        <thead>
          <tr>
            <th nzLeft>Tên lớp</th>
            <th>Giáo viên</th>
            <th>Sĩ số</th>
            <th>Trạng thái</th>
            @if (auth.isAdmin()) { <th nzRight class="actions-col">Thao tác</th> }
          </tr>
        </thead>
        <tbody>
          @for (c of table.data; track c.id) {
            <tr>
              <td nzLeft [class.text-deleted]="c.isDeleted"><a [routerLink]="['/classes', c.id]">{{ c.name }}</a></td>
              <td>{{ c.teacherName || '—' }}</td>
              <td>{{ c.currentSize }}/{{ c.maxCapacity }}</td>
              <td>
                @if (c.isDeleted) { <nz-tag nzColor="red">Đã xóa</nz-tag> }
                @else if (c.isActive) { <nz-tag nzColor="green">Đang mở</nz-tag> }
                @else { <nz-tag>Đóng</nz-tag> }
              </td>
              @if (auth.isAdmin()) {
                <td nzRight>
                  @if (!c.isDeleted) {
                    <button nz-button nzType="link" nzSize="small" (click)="openEdit(c)"><nz-icon nzType="edit" /></button>
                    <button nz-button nzType="link" nzSize="small" nzDanger
                            nz-popconfirm nzPopconfirmTitle="Xóa mềm lớp này?" (nzOnConfirm)="remove(c)">
                      <nz-icon nzType="delete" />
                    </button>
                  } @else {
                    <button nz-button nzType="link" nzSize="small" (click)="restore(c)"><nz-icon nzType="undo" /> Khôi phục</button>
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </nz-table>
    }

    <nz-modal [nzVisible]="modalOpen()" [nzTitle]="editing() ? 'Sửa lớp' : 'Thêm lớp'"
      [nzOkLoading]="saving()" [nzOkDisabled]="form.invalid" (nzOnOk)="save()" (nzOnCancel)="closeModal()">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired>Tên lớp</nz-form-label>
            <nz-form-control nzErrorTip="Vui lòng nhập tên lớp"><input nz-input formControlName="name" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>Giáo viên</nz-form-label>
            <nz-form-control nzErrorTip="Chọn giáo viên">
              <nz-select formControlName="teacherId" nzPlaceHolder="Chọn giáo viên" class="full" nzShowSearch>
                @for (t of teachers(); track t.id) {
                  <nz-option [nzValue]="t.id" [nzLabel]="(t.fullName || t.email)" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>Sĩ số tối đa</nz-form-label>
            <nz-form-control><nz-input-number formControlName="maxCapacity" [nzMin]="1" class="full" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>Lịch học (mô tả)</nz-form-label>
            <nz-form-control><input nz-input formControlName="schedule" placeholder="VD: Thứ 2, 4 - 19:00" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>Ngày khai giảng</nz-form-label>
            <nz-form-control><nz-date-picker formControlName="startDate" nzFormat="dd/MM/yyyy" class="full" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>Đang mở</nz-form-label>
            <nz-form-control><nz-switch formControlName="isActive" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .search { width: 240px; max-width: 60vw; }
    .full { width: 100%; }
  `
})
export class ClassesPage {
  protected readonly auth = inject(AuthService);
  protected readonly screen = inject(ScreenService);
  private readonly classesService = inject(ClassesService);
  private readonly usersService = inject(UsersService);
  private readonly message = inject(NzMessageService);

  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly search = signal('');
  protected readonly includeDeleted = signal(false);
  protected readonly loading = signal(false);
  protected readonly teachers = signal<UserListItem[]>([]);

  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<ClassListItem | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    teacherId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    maxCapacity: new FormControl(15, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    schedule: new FormControl<string | null>(null),
    startDate: new FormControl<Date | null>(null),
    isActive: new FormControl(true, { nonNullable: true })
  });

  private searchDebounce?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
    if (this.auth.isAdmin()) this.loadTeachers();
  }

  private loadTeachers(): void {
    this.usersService.getPaged(1, 200).subscribe({
      next: r => this.teachers.set(r.items.filter(u => !u.isDeleted && (u.roles.includes(ROLE_TEACHER) || u.roles.includes(ROLE_ADMIN))))
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.classesService.getPaged({
      page: this.page(), pageSize: this.pageSize(),
      search: this.search() || undefined, includeDeleted: this.includeDeleted()
    }).subscribe({
      next: r => { this.classes.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
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
    this.form.reset({ name: '', teacherId: '', maxCapacity: 15, schedule: null, startDate: null, isActive: true });
    this.modalOpen.set(true);
  }

  protected openEdit(c: ClassListItem): void {
    this.editing.set(c);
    // Lấy chi tiết để có schedule/startDate.
    this.classesService.getById(c.id).subscribe(detail => {
      this.form.reset({
        name: detail.name, teacherId: detail.teacherId, maxCapacity: detail.maxCapacity,
        schedule: detail.schedule, startDate: detail.startDate ? new Date(detail.startDate) : null, isActive: detail.isActive
      });
    });
    this.modalOpen.set(true);
  }

  protected closeModal(): void { this.modalOpen.set(false); }

  protected save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const request: ClassRequest = {
      name: v.name, teacherId: v.teacherId, curriculumId: null, maxCapacity: v.maxCapacity,
      schedule: v.schedule, startDate: toIsoDate(v.startDate), isActive: v.isActive
    };
    const editing = this.editing();
    const op = editing ? this.classesService.update(editing.id, request) : this.classesService.create(request);
    this.saving.set(true);
    op.subscribe({
      next: () => { this.saving.set(false); this.modalOpen.set(false); this.message.success(editing ? 'Đã cập nhật lớp.' : 'Đã thêm lớp.'); this.load(); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message ??'Lưu thất bại.'); }
    });
  }

  protected remove(c: ClassListItem): void {
    this.classesService.delete(c.id).subscribe({
      next: () => { this.message.success('Đã xóa (mềm).'); this.load(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ??'Xóa thất bại.')
    });
  }

  protected restore(c: ClassListItem): void {
    this.classesService.restore(c.id).subscribe({
      next: () => { this.message.success('Đã khôi phục.'); this.load(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ??'Khôi phục thất bại.')
    });
  }
}

function toIsoDate(d: Date | null): string | null {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
