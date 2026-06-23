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
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { toDateOnlyOrNull } from '../../core/date-util';
import { ClassListItem, CreateTeacherAccountRequest, TeacherProfile, TeacherRequest, UnlinkedUser } from '../../core/models';
import { TeachersService } from '../../core/teachers.service';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-teachers-page',
  imports: [
    FormsModule, ReactiveFormsModule, PageHeader,
    NzButtonModule, NzDatePickerModule, NzFormModule, NzIconModule, NzInputModule,
    NzModalModule, NzPopconfirmModule, NzSelectModule, NzTableModule, NzTagModule, NzTooltipModule
  ],
  template: `
    <app-page-header title="Giáo viên" subtitle="Hồ sơ giáo viên và tài khoản đăng nhập" icon="team">
      <input nz-input placeholder="Tìm mã, tên, SĐT" class="search" [(ngModel)]="search" (ngModelChange)="onSearch()" />
      <button nz-button nzType="primary" (click)="openForm()"><nz-icon nzType="plus" /> Thêm giáo viên</button>
      <button nz-button (click)="openAccountForm()"><nz-icon nzType="user-add" /> Tạo tài khoản GV</button>
    </app-page-header>

    <nz-table #table [nzData]="teachers()" [nzLoading]="loading()" [nzFrontPagination]="false"
      [nzPageIndex]="page()" [nzPageSize]="pageSize()" [nzTotal]="total()"
      (nzPageIndexChange)="page.set($event); load()">
      <thead><tr><th>STT</th><th>Mã GV</th><th>Giáo viên</th><th>SĐT</th><th>Email</th><th>Tài khoản</th><th>Lớp</th><th>Thao tác</th></tr></thead>
      <tbody>
        @for (t of table.data; track t.id; let i = $index) {
          <tr class="clickable" (click)="openDetail(t)">
            <td>{{ (page() - 1) * pageSize() + i + 1 }}</td>
            <td>{{ t.teacherCode }}</td>
            <td>{{ t.fullName }}</td>
            <td>{{ t.phone || '—' }}</td>
            <td>{{ t.email || '—' }}</td>
            <td>@if (t.userName) { <nz-tag nzColor="green">{{ t.userName }}</nz-tag> } @else { <nz-tag>Chưa gắn</nz-tag> }</td>
            <td>{{ t.classCount }}</td>
            <td (click)="$event.stopPropagation()">
              <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Sửa giáo viên" aria-label="Sửa giáo viên" (click)="openForm(t)"><nz-icon nzType="edit" /></button>
              <button nz-button nzType="link" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa giáo viên" aria-label="Xóa giáo viên"
                nz-popconfirm nzPopconfirmTitle="Xóa giáo viên?" (nzOnConfirm)="deleteTeacher(t)"><nz-icon nzType="delete" /></button>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal [nzVisible]="modalOpen()" [nzTitle]="editing() ? 'Sửa giáo viên' : 'Thêm giáo viên'"
      (nzOnCancel)="modalOpen.set(false)" (nzOnOk)="save()">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <nz-form-item><nz-form-label>Mã GV</nz-form-label><nz-form-control><input nz-input formControlName="teacherCode" placeholder="Trống để tự sinh" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label nzRequired>Họ tên</nz-form-label><nz-form-control><input nz-input formControlName="fullName" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>SĐT</nz-form-label><nz-form-control><input nz-input formControlName="phone" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Email</nz-form-label><nz-form-control><input nz-input formControlName="email" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Ngày sinh</nz-form-label><nz-form-control><nz-date-picker formControlName="dateOfBirth" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Địa chỉ</nz-form-label><nz-form-control><input nz-input formControlName="address" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Ghi chú</nz-form-label><nz-form-control><textarea nz-input rows="3" formControlName="note"></textarea></nz-form-control></nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="accountOpen()" nzTitle="Tạo tài khoản giáo viên" [nzWidth]="620"
      (nzOnCancel)="accountOpen.set(false)" (nzOnOk)="createAccount()">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="accountForm" nzLayout="vertical">
          <nz-form-item><nz-form-label>Hồ sơ giáo viên có sẵn</nz-form-label><nz-form-control>
            <nz-select formControlName="teacherProfileId" nzAllowClear nzShowSearch nzPlaceHolder="Chọn nếu tài khoản thuộc giáo viên đã có">
              @for (t of unlinkedTeachers(); track t.id) { <nz-option [nzValue]="t.id" [nzLabel]="t.fullName" /> }
            </nz-select>
          </nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Họ tên giáo viên mới</nz-form-label><nz-form-control><input nz-input formControlName="fullName" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>SĐT</nz-form-label><nz-form-control><input nz-input formControlName="phone" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Tên đăng nhập</nz-form-label><nz-form-control><input nz-input formControlName="userName" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Email đăng nhập</nz-form-label><nz-form-control><input nz-input formControlName="loginEmail" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Mật khẩu</nz-form-label><nz-form-control><input nz-input type="password" formControlName="password" /></nz-form-control></nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="detailOpen()" nzTitle="Chi tiết giáo viên" [nzWidth]="860" [nzFooter]="null" (nzOnCancel)="detailOpen.set(false)">
      <ng-container *nzModalContent>
        @if (detailTeacher(); as t) {
          <div class="detail">
            <div><b>Mã GV</b><span>{{ t.teacherCode }}</span></div>
            <div><b>Họ tên</b><span>{{ t.fullName }}</span></div>
            <div><b>Tài khoản</b><span>
              @if (t.userName) {
                {{ t.userName }}
                <button nz-button nzType="link" nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Gỡ tài khoản khỏi giáo viên?"
                  (nzOnConfirm)="unlinkAccount(t)">Gỡ</button>
              } @else {
                @if (linkingAccount()) {
                  <nz-select style="width: 220px" nzShowSearch nzPlaceHolder="Chọn tài khoản" [(ngModel)]="selectedUserId">
                    @for (u of unlinkedUsers(); track u.id) { <nz-option [nzValue]="u.id" [nzLabel]="u.userName + (u.fullName ? ' — ' + u.fullName : '')" /> }
                  </nz-select>
                  <button nz-button nzType="primary" nzSize="small" [disabled]="!selectedUserId" (click)="confirmLink(t)">Xác nhận</button>
                  <button nz-button nzSize="small" (click)="linkingAccount.set(false)">Hủy</button>
                } @else {
                  Chưa gắn
                  <button nz-button nzType="link" nzSize="small" (click)="startLinking()">Gắn tài khoản</button>
                }
              }
            </span></div>
          </div>
          <nz-table [nzData]="detailClasses()" [nzFrontPagination]="false" nzSize="small">
            <thead><tr><th>Mã lớp</th><th>Lớp</th><th>Môn</th><th>Khối</th><th>Cơ sở</th></tr></thead>
            <tbody>
              @for (c of detailClasses(); track c.id) {
                <tr><td>{{ c.classCode }}</td><td>{{ c.name }}</td><td>{{ c.subjectName || '—' }}</td><td>{{ c.gradeName || '—' }}</td><td>{{ c.branchName || '—' }}</td></tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .search { width: 260px; }
    .clickable { cursor: pointer; }
    .detail { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; }
    .detail div { border: 1px solid var(--hs-border); border-radius: 8px; padding: 10px; }
    .detail b { display: block; color: var(--hs-text-muted); font-size: 12px; margin-bottom: 4px; }
  `
})
export class TeachersPage {
  private readonly service = inject(TeachersService);
  private readonly message = inject(NzMessageService);

  protected readonly teachers = signal<TeacherProfile[]>([]);
  protected readonly loading = signal(false);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly total = signal(0);
  protected search = '';
  private timer?: ReturnType<typeof setTimeout>;

  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<TeacherProfile | null>(null);
  protected readonly form = new FormGroup({
    teacherCode: new FormControl<string | null>(null),
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl<string | null>(null),
    email: new FormControl<string | null>(null),
    dateOfBirth: new FormControl<Date | null>(null),
    address: new FormControl<string | null>(null),
    note: new FormControl<string | null>(null)
  });

  protected readonly accountOpen = signal(false);
  protected readonly accountForm = new FormGroup({
    teacherProfileId: new FormControl<string | null>(null),
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl<string | null>(null),
    userName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    loginEmail: new FormControl<string | null>(null),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  protected readonly detailOpen = signal(false);
  protected readonly detailTeacher = signal<TeacherProfile | null>(null);
  protected readonly detailClasses = signal<ClassListItem[]>([]);
  protected readonly unlinkedTeachers = signal<TeacherProfile[]>([]);
  protected readonly linkingAccount = signal(false);
  protected readonly unlinkedUsers = signal<UnlinkedUser[]>([]);
  protected selectedUserId: string | null = null;

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.getPaged({ page: this.page(), pageSize: this.pageSize(), search: this.search }).subscribe({
      next: r => { this.teachers.set(r.items); this.unlinkedTeachers.set(r.items.filter(t => !t.userId)); this.total.set(r.totalCount); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected onSearch(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.page.set(1); this.load(); }, 250);
  }

  protected openForm(t?: TeacherProfile): void {
    this.editing.set(t ?? null);
    this.form.reset({
      teacherCode: t?.teacherCode ?? null,
      fullName: t?.fullName ?? '',
      phone: t?.phone ?? null,
      email: t?.email ?? null,
      dateOfBirth: t?.dateOfBirth ? new Date(t.dateOfBirth) : null,
      address: t?.address ?? null,
      note: t?.note ?? null
    });
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const req: TeacherRequest = {
      teacherCode: v.teacherCode,
      fullName: v.fullName,
      phone: v.phone,
      email: v.email,
      dateOfBirth: toDateOnlyOrNull(v.dateOfBirth),
      address: v.address,
      note: v.note,
      userId: this.editing()?.userId ?? null,
      isActive: true
    };
    const editing = this.editing();
    const op = editing ? this.service.update(editing.id, { ...req, teacherCode: req.teacherCode || editing.teacherCode }) : this.service.create(req);
    op.subscribe({ next: () => { this.message.success('Đã lưu giáo viên.'); this.modalOpen.set(false); this.load(); }, error: err => this.showError(err, 'Lưu thất bại.') });
  }

  protected openAccountForm(): void {
    this.accountForm.reset({ teacherProfileId: null, fullName: '', phone: null, userName: '', loginEmail: null, password: '' });
    this.accountOpen.set(true);
  }

  protected createAccount(): void {
    if (this.accountForm.invalid) return;
    const v = this.accountForm.getRawValue();
    const req: CreateTeacherAccountRequest = {
      teacherProfileId: v.teacherProfileId,
      teacherCode: null,
      fullName: v.fullName,
      phone: v.phone,
      email: null,
      dateOfBirth: null,
      address: null,
      note: null,
      userName: v.userName,
      loginEmail: v.loginEmail,
      password: v.password
    };
    this.service.createAccount(req).subscribe({
      next: () => { this.message.success('Đã tạo tài khoản giáo viên.'); this.accountOpen.set(false); this.load(); },
      error: err => this.showError(err, 'Tạo tài khoản thất bại.')
    });
  }

  protected openDetail(t: TeacherProfile): void {
    this.service.getById(t.id).subscribe({
      next: d => { this.detailTeacher.set(d.teacher); this.detailClasses.set(d.classes); this.detailOpen.set(true); },
      error: err => this.showError(err, 'Không tải được chi tiết.')
    });
  }

  protected startLinking(): void {
    this.linkingAccount.set(true);
    this.selectedUserId = null;
    this.service.getUnlinkedUsers().subscribe({
      next: users => this.unlinkedUsers.set(users),
      error: err => this.showError(err, 'Không tải được danh sách tài khoản.')
    });
  }

  protected confirmLink(t: TeacherProfile): void {
    if (!this.selectedUserId) return;
    this.service.linkAccount(t.id, this.selectedUserId).subscribe({
      next: updated => {
        this.message.success('Đã gắn tài khoản.');
        this.detailTeacher.set(updated);
        this.linkingAccount.set(false);
        this.load();
      },
      error: err => this.showError(err, 'Gắn tài khoản thất bại.')
    });
  }

  protected unlinkAccount(t: TeacherProfile): void {
    this.service.unlinkAccount(t.id).subscribe({
      next: updated => {
        this.message.success('Đã gỡ tài khoản.');
        this.detailTeacher.set(updated);
        this.load();
      },
      error: err => this.showError(err, 'Gỡ tài khoản thất bại.')
    });
  }

  protected deleteTeacher(t: TeacherProfile): void {
    this.service.delete(t.id).subscribe({ next: () => { this.message.success('Đã xóa giáo viên.'); this.load(); }, error: err => this.showError(err, 'Xóa thất bại.') });
  }

  private showError(err: HttpErrorResponse, fallback: string): void {
    this.message.error(err.error?.message ?? err.message ?? fallback);
  }
}
