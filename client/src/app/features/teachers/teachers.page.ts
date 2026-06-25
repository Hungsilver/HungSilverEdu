import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
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
import { BranchesService } from '../../core/branches.service';
import { toDateOnlyOrNull } from '../../core/date-util';
import { Branch, ClassListItem, CreateTeacherAccountRequest, TeacherProfile, TeacherRequest, UnlinkedUser } from '../../core/models';
import { TeachersService } from '../../core/teachers.service';
import { ColumnDef, ColumnSettings } from '../../shared/column-settings';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-teachers-page',
  imports: [
    FormsModule, ReactiveFormsModule, PageHeader, ColumnSettings,
    NzAlertModule, NzButtonModule, NzCheckboxModule, NzDatePickerModule, NzFormModule, NzIconModule, NzInputModule,
    NzModalModule, NzPopconfirmModule, NzSelectModule, NzTableModule, NzTagModule, NzTooltipModule
  ],
  template: `
    <app-page-header title="Giáo viên" subtitle="Hồ sơ giáo viên và tài khoản đăng nhập" icon="team">
      <input nz-input placeholder="Tìm mã, tên, SĐT" class="search" [(ngModel)]="search" (keyup.enter)="applyFilters()" />
      <button nz-button (click)="applyFilters()"><nz-icon nzType="search" /> Tìm kiếm</button>
      @if (selectedCount() > 0) {
        <button nz-button (click)="bulkProvision()" [nzLoading]="bulkBusy()"><nz-icon nzType="key" /> Cấp tài khoản ({{ selectedCount() }})</button>
      }
      <button nz-button nzType="primary" (click)="openForm()"><nz-icon nzType="plus" /> Thêm giáo viên</button>
      <button nz-button (click)="openAccountForm()"><nz-icon nzType="user-add" /> Tạo tài khoản GV</button>
    </app-page-header>

    <div class="table-toolbar">
      <span class="spacer"></span>
      <app-column-settings #cols storageKey="hs-cols-teachers" [columns]="COLUMNS" />
    </div>

    <nz-table #table [nzData]="teachers()" [nzLoading]="loading()" [nzFrontPagination]="false"
      [nzPageIndex]="page()" [nzPageSize]="pageSize()" [nzTotal]="total()"
      (nzPageIndexChange)="page.set($event); load()">
      <thead><tr>
        <th nzWidth="44px" nzShowCheckbox [nzChecked]="allChecked()" [nzIndeterminate]="someChecked()"
            (nzCheckedChange)="checkAll($event)" nz-tooltip nzTooltipTitle="Chọn GV chưa có tài khoản"></th>
        <th nzWidth="64px" style="white-space: nowrap">STT</th>
        @for (col of cols.visibleColumns(); track col.key) { <th>{{ col.label }}</th> }
        <th>Thao tác</th>
      </tr></thead>
      <tbody>
        @for (t of table.data; track t.id; let i = $index) {
          <tr class="clickable" (click)="openDetail(t)">
            <td (click)="$event.stopPropagation()" nzShowCheckbox [nzDisabled]="!!t.userName"
                [nzChecked]="checked().has(t.id)" (nzCheckedChange)="toggleChecked(t.id, $event)"></td>
            <td>{{ (page() - 1) * pageSize() + i + 1 }}</td>
            @for (col of cols.visibleColumns(); track col.key) {
              <td>
                @switch (col.key) {
                  @case ('code') { {{ t.teacherCode }} }
                  @case ('name') { {{ t.fullName }} }
                  @case ('phone') { {{ t.phone || '—' }} }
                  @case ('email') { {{ t.email || '—' }} }
                  @case ('account') {
                    @if (!t.userName) { <nz-tag>Chưa gắn</nz-tag> }
                    @else if (t.isLocked) { <nz-tag nzColor="error" nz-tooltip [nzTooltipTitle]="t.userName">Đã khóa</nz-tag> }
                    @else {
                      <nz-tag nzColor="success">{{ t.userName }}</nz-tag>
                      @if (t.mustChangePassword) { <nz-tag nzColor="warning" nz-tooltip nzTooltipTitle="Chưa đổi mật khẩu lần đầu">!</nz-tag> }
                    }
                  }
                  @case ('classes') { {{ t.classCount }} }
                }
              </td>
            }
            <td (click)="$event.stopPropagation()">
              <button nz-button nzType="link" nzSize="small" nz-tooltip nzTooltipTitle="Quản lý tài khoản" aria-label="Quản lý tài khoản" (click)="openAccount(t)"><nz-icon nzType="key" /></button>
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
          <nz-form-item><nz-form-label>Cơ sở (sinh mã)</nz-form-label><nz-form-control>
            <nz-select formControlName="branchId" nzAllowClear nzShowSearch nzPlaceHolder="Trống → prefix mặc định toàn hệ thống">
              @for (b of branches(); track b.id) { <nz-option [nzValue]="b.id" [nzLabel]="b.name" /> }
            </nz-select>
          </nz-form-control></nz-form-item>
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
        <nz-alert nzType="info" nzShowIcon class="acc-alert"
          nzMessage="Tên đăng nhập = Mã giáo viên (tự sinh). Mật khẩu để trống sẽ dùng mật khẩu mặc định; giáo viên bị buộc đổi ở lần đăng nhập đầu." />
        <form nz-form [formGroup]="accountForm" nzLayout="vertical">
          <nz-form-item><nz-form-label>Hồ sơ giáo viên có sẵn</nz-form-label><nz-form-control>
            <nz-select formControlName="teacherProfileId" nzAllowClear nzShowSearch nzPlaceHolder="Chọn nếu tài khoản thuộc giáo viên đã có">
              @for (t of unlinkedTeachers(); track t.id) { <nz-option [nzValue]="t.id" [nzLabel]="t.fullName" /> }
            </nz-select>
          </nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Họ tên giáo viên mới</nz-form-label><nz-form-control><input nz-input formControlName="fullName" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Cơ sở (sinh mã)</nz-form-label><nz-form-control>
            <nz-select formControlName="branchId" nzAllowClear nzShowSearch nzPlaceHolder="Trống → prefix mặc định toàn hệ thống">
              @for (b of branches(); track b.id) { <nz-option [nzValue]="b.id" [nzLabel]="b.name" /> }
            </nz-select>
          </nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>SĐT</nz-form-label><nz-form-control><input nz-input formControlName="phone" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Email đăng nhập (tùy chọn)</nz-form-label><nz-form-control><input nz-input formControlName="loginEmail" placeholder="Trống → email ảo theo mã" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Mật khẩu (tùy chọn)</nz-form-label><nz-form-control><input nz-input type="text" formControlName="password" placeholder="Trống = mật khẩu mặc định" /></nz-form-control></nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="accountManageOpen()" nzTitle="Tài khoản đăng nhập" [nzWidth]="520" [nzFooter]="null" (nzOnCancel)="accountManageOpen.set(false)">
      <ng-container *nzModalContent>
        @if (accountTeacher(); as t) {
          <div class="acc-head"><div><b>Giáo viên</b><span>{{ t.fullName }} · {{ t.teacherCode }}</span></div></div>
          @if (!t.userName) {
            <nz-alert nzType="info" nzShowIcon class="acc-alert"
              [nzMessage]="'Cấp tài khoản: tên đăng nhập = Mã GV (' + t.teacherCode + '). Mật khẩu trống = mặc định; bắt đổi lần đầu.'" />
            <div class="acc-row">
              <input nz-input type="text" placeholder="Mật khẩu (trống = mặc định)" [(ngModel)]="accPassword" />
              <button nz-button nzType="primary" [nzLoading]="accBusy()" (click)="provision(t)"><nz-icon nzType="key" /> Cấp tài khoản</button>
            </div>
          } @else {
            <div class="acc-status">
              <span>Tên đăng nhập: <b>{{ t.userName }}</b></span>
              @if (t.isLocked) { <nz-tag nzColor="error">Đã khóa</nz-tag> } @else { <nz-tag nzColor="success">Đang hoạt động</nz-tag> }
              @if (t.mustChangePassword) { <nz-tag nzColor="warning">Chưa đổi mật khẩu lần đầu</nz-tag> }
            </div>
            <div class="acc-row">
              <input nz-input type="text" placeholder="Mật khẩu mới (trống = mặc định)" [(ngModel)]="accPassword" />
              <button nz-button [nzLoading]="accBusy()" (click)="resetPassword(t)"><nz-icon nzType="reload" /> Đặt lại mật khẩu</button>
            </div>
            <div class="acc-actions">
              @if (t.isLocked) {
                <button nz-button [nzLoading]="accBusy()" (click)="setLocked(t, false)"><nz-icon nzType="unlock" /> Mở khóa</button>
              } @else {
                <button nz-button nzDanger [nzLoading]="accBusy()" (click)="setLocked(t, true)"><nz-icon nzType="lock" /> Khóa đăng nhập</button>
              }
              <button nz-button nzDanger nz-popconfirm nzPopconfirmTitle="Gỡ liên kết tài khoản khỏi giáo viên? (Tài khoản không bị xóa)"
                (nzOnConfirm)="unlinkAccount(t)" [nzLoading]="accBusy()"><nz-icon nzType="disconnect" /> Gỡ tài khoản</button>
            </div>
          }
        }
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="detailOpen()" nzTitle="Chi tiết giáo viên" [nzWidth]="860" [nzFooter]="null" (nzOnCancel)="detailOpen.set(false)">
      <ng-container *nzModalContent>
        @if (detailTeacher(); as t) {
          <div class="detail">
            <div><b>Mã GV</b><span>{{ t.teacherCode }}</span></div>
            <div><b>Họ tên</b><span>{{ t.fullName }}</span></div>
            <div><b>Cơ sở</b><span>{{ t.branchName || '—' }}</span></div>
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
    .table-toolbar { display: flex; align-items: center; margin-bottom: 12px; }
    .table-toolbar .spacer { flex: 1; }
    .clickable { cursor: pointer; }
    .detail { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; }
    .detail div { border: 1px solid var(--hs-border); border-radius: 8px; padding: 10px; }
    .detail b { display: block; color: var(--hs-text-muted); font-size: 12px; margin-bottom: 4px; }
    .acc-alert { margin-bottom: 12px; }
    .acc-head div { border: 1px solid var(--hs-border); border-radius: 8px; padding: 10px; margin-bottom: 12px; }
    .acc-head b { display: block; color: var(--hs-text-muted); font-size: 12px; margin-bottom: 4px; }
    .acc-row { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
    .acc-row input { flex: 1; }
    .acc-status { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
    .acc-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  `
})
export class TeachersPage {
  private readonly service = inject(TeachersService);
  private readonly branchesService = inject(BranchesService);
  private readonly message = inject(NzMessageService);

  protected readonly teachers = signal<TeacherProfile[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly loading = signal(false);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly total = signal(0);
  protected search = '';

  // Cột cấu hình được (ngoài STT & Thao tác cố định).
  protected readonly COLUMNS: ColumnDef[] = [
    { key: 'code', label: 'Mã GV' },
    { key: 'name', label: 'Giáo viên' },
    { key: 'phone', label: 'SĐT' },
    { key: 'email', label: 'Email' },
    { key: 'account', label: 'Tài khoản' },
    { key: 'classes', label: 'Lớp' }
  ];

  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<TeacherProfile | null>(null);
  protected readonly form = new FormGroup({
    teacherCode: new FormControl<string | null>(null),
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    branchId: new FormControl<string | null>(null),
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
    branchId: new FormControl<string | null>(null),
    phone: new FormControl<string | null>(null),
    loginEmail: new FormControl<string | null>(null),
    password: new FormControl<string | null>(null)
  });

  protected readonly detailOpen = signal(false);
  protected readonly detailTeacher = signal<TeacherProfile | null>(null);
  protected readonly detailClasses = signal<ClassListItem[]>([]);
  protected readonly unlinkedTeachers = signal<TeacherProfile[]>([]);
  protected readonly linkingAccount = signal(false);
  protected readonly unlinkedUsers = signal<UnlinkedUser[]>([]);
  protected selectedUserId: string | null = null;

  // Chọn nhiều để cấp tài khoản hàng loạt (chỉ GV chưa có tài khoản).
  protected readonly checked = signal<Set<string>>(new Set());
  protected readonly bulkBusy = signal(false);
  protected readonly selectedCount = computed(() => this.checked().size);
  protected provisionable(): TeacherProfile[] { return this.teachers().filter(t => !t.userName); }
  protected allChecked(): boolean { const p = this.provisionable(); return p.length > 0 && p.every(t => this.checked().has(t.id)); }
  protected someChecked(): boolean { const p = this.provisionable(); const c = this.checked(); return p.some(t => c.has(t.id)) && !this.allChecked(); }

  // Modal quản lý tài khoản 1 giáo viên.
  protected readonly accountManageOpen = signal(false);
  protected readonly accountTeacher = signal<TeacherProfile | null>(null);
  protected readonly accBusy = signal(false);
  protected accPassword = '';

  constructor() {
    this.load();
    this.branchesService.getAll().subscribe(x => this.branches.set(x));
  }

  protected load(): void {
    this.loading.set(true);
    this.service.getPaged({ page: this.page(), pageSize: this.pageSize(), search: this.search }).subscribe({
      next: r => { this.teachers.set(r.items); this.unlinkedTeachers.set(r.items.filter(t => !t.userId)); this.total.set(r.totalCount); this.checked.set(new Set()); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  protected openForm(t?: TeacherProfile): void {
    this.editing.set(t ?? null);
    this.form.reset({
      teacherCode: t?.teacherCode ?? null,
      fullName: t?.fullName ?? '',
      branchId: t?.branchId ?? null,
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
      branchId: v.branchId,
      isActive: true
    };
    const editing = this.editing();
    const op = editing ? this.service.update(editing.id, { ...req, teacherCode: req.teacherCode || editing.teacherCode }) : this.service.create(req);
    op.subscribe({ next: () => { this.message.success('Đã lưu giáo viên.'); this.modalOpen.set(false); this.load(); }, error: err => this.showError(err, 'Lưu thất bại.') });
  }

  protected openAccountForm(): void {
    this.accountForm.reset({ teacherProfileId: null, fullName: '', branchId: null, phone: null, loginEmail: null, password: null });
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
      branchId: v.branchId,
      loginEmail: v.loginEmail,
      password: v.password || null
    };
    this.service.createAccount(req).subscribe({
      next: () => { this.message.success('Đã tạo tài khoản giáo viên (mật khẩu mặc định nếu để trống).'); this.accountOpen.set(false); this.load(); },
      error: err => this.showError(err, 'Tạo tài khoản thất bại.')
    });
  }

  // ---------------- Chọn nhiều + cấp hàng loạt ----------------
  protected toggleChecked(id: string, val: boolean): void {
    const next = new Set(this.checked());
    if (val) next.add(id); else next.delete(id);
    this.checked.set(next);
  }
  protected checkAll(val: boolean): void {
    const next = new Set(this.checked());
    for (const t of this.provisionable()) { if (val) next.add(t.id); else next.delete(t.id); }
    this.checked.set(next);
  }
  protected bulkProvision(): void {
    const ids = [...this.checked()];
    if (ids.length === 0) return;
    this.bulkBusy.set(true);
    this.service.bulkProvision(ids).subscribe({
      next: r => {
        this.bulkBusy.set(false);
        if (r.failed === 0) this.message.success(`Đã cấp tài khoản cho ${r.succeeded} giáo viên.`);
        else this.message.warning(`Cấp ${r.succeeded} thành công, ${r.failed} thất bại.`);
        this.load();
      },
      error: err => { this.bulkBusy.set(false); this.showError(err, 'Cấp tài khoản hàng loạt thất bại.'); }
    });
  }

  // ---------------- Quản lý tài khoản 1 giáo viên ----------------
  protected openAccount(t: TeacherProfile): void {
    this.accountTeacher.set(t);
    this.accPassword = '';
    this.accountManageOpen.set(true);
  }
  private refreshAccountTeacher(id: string): void {
    this.service.getById(id).subscribe(d => this.accountTeacher.set(d.teacher));
    this.load();
  }
  protected provision(t: TeacherProfile): void {
    this.accBusy.set(true);
    this.service.provisionAccount(t.id, { password: this.accPassword || null }).subscribe({
      next: r => { this.accBusy.set(false); this.message.success(`Đã cấp tài khoản "${r.userName}".`); this.accPassword = ''; this.refreshAccountTeacher(t.id); },
      error: err => { this.accBusy.set(false); this.showError(err, 'Cấp tài khoản thất bại.'); }
    });
  }
  protected resetPassword(t: TeacherProfile): void {
    this.accBusy.set(true);
    this.service.resetPassword(t.id, this.accPassword || null).subscribe({
      next: () => { this.accBusy.set(false); this.message.success('Đã đặt lại mật khẩu (GV sẽ phải đổi ở lần đăng nhập tới).'); this.accPassword = ''; this.refreshAccountTeacher(t.id); },
      error: err => { this.accBusy.set(false); this.showError(err, 'Đặt lại mật khẩu thất bại.'); }
    });
  }
  protected setLocked(t: TeacherProfile, locked: boolean): void {
    this.accBusy.set(true);
    this.service.setLocked(t.id, locked).subscribe({
      next: () => { this.accBusy.set(false); this.message.success(locked ? 'Đã khóa đăng nhập.' : 'Đã mở khóa.'); this.refreshAccountTeacher(t.id); },
      error: err => { this.accBusy.set(false); this.showError(err, 'Thao tác thất bại.'); }
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
    this.accBusy.set(true);
    this.service.unlinkAccount(t.id).subscribe({
      next: updated => {
        this.accBusy.set(false);
        this.message.success('Đã gỡ tài khoản.');
        if (this.detailTeacher()?.id === t.id) this.detailTeacher.set(updated);
        if (this.accountTeacher()?.id === t.id) this.accountTeacher.set(updated);
        this.load();
      },
      error: err => { this.accBusy.set(false); this.showError(err, 'Gỡ tài khoản thất bại.'); }
    });
  }

  protected deleteTeacher(t: TeacherProfile): void {
    this.service.delete(t.id).subscribe({ next: () => { this.message.success('Đã xóa giáo viên.'); this.load(); }, error: err => this.showError(err, 'Xóa thất bại.') });
  }

  private showError(err: HttpErrorResponse, fallback: string): void {
    this.message.error(err.error?.message ?? err.message ?? fallback);
  }
}
