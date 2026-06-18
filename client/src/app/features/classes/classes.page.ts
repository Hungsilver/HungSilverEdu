import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzUploadModule, NzUploadFile } from 'ng-zorro-antd/upload';
import { AuthService } from '../../core/auth.service';
import { ClassesService } from '../../core/classes.service';
import { ScreenService } from '../../core/screen.service';
import { SettingsService } from '../../core/settings.service';
import { SubjectsService } from '../../core/subjects.service';
import {
  ClassImportPreview, ClassImportResult, ClassListItem, ClassRequest, ROLE_ADMIN, ROLE_TEACHER,
  Subject, UserListItem
} from '../../core/models';
import { UsersService } from '../../core/users.service';
import { PageHeader } from '../../shared/page-header';

const NO_BAND = '__none__';

@Component({
  selector: 'app-classes-page',
  imports: [
    FormsModule, ReactiveFormsModule, RouterLink,
    NzTableModule, NzButtonModule, NzIconModule, NzInputModule, NzTagModule, NzSelectModule,
    NzModalModule, NzFormModule, NzInputNumberModule, NzSwitchModule, NzDatePickerModule,
    NzPopconfirmModule, NzCheckboxModule, NzCardModule, NzPaginationModule, NzBreadCrumbModule,
    NzEmptyModule, NzUploadModule, NzAlertModule, PageHeader
  ],
  template: `
    <app-page-header title="Lớp học" [subtitle]="headerSubtitle()" icon="book">
      <div class="actions">
        @if (level() === 'subjects') {
          @if (auth.isAdmin()) {
            <button nz-button (click)="openSubjectManager()"><nz-icon nzType="appstore" /> Quản lý môn</button>
            <button nz-button (click)="openClassImport()"><nz-icon nzType="file-excel" /> Nhập Excel lớp</button>
          }
        } @else if (level() !== 'grades') {
          <input nz-input placeholder="Tìm theo tên lớp..." class="search"
                 [ngModel]="search()" (ngModelChange)="onSearch($event)" />
          @if (auth.isAdmin()) {
            <label nz-checkbox [ngModel]="includeDeleted()" (ngModelChange)="onIncludeDeleted($event)">Hiện đã xóa</label>
            <button nz-button nzType="primary" (click)="openCreate()"><nz-icon nzType="plus" /> Thêm lớp</button>
          }
        }
      </div>
    </app-page-header>

    @if (level() !== 'subjects') {
      <nz-breadcrumb class="crumb">
        <nz-breadcrumb-item><a (click)="goSubjects()">Môn học</a></nz-breadcrumb-item>
        @if (view() === 'all') {
          <nz-breadcrumb-item>Tất cả lớp</nz-breadcrumb-item>
        } @else {
          <nz-breadcrumb-item><a (click)="openSubjectId(subjectId())">{{ currentSubjectName() }}</a></nz-breadcrumb-item>
          @if (gradeBand()) { <nz-breadcrumb-item>{{ gradeLabel(gradeBand()!) }}</nz-breadcrumb-item> }
        }
      </nz-breadcrumb>
    }

    @switch (level()) {
      @case ('subjects') {
        <div class="tile-grid">
          @for (s of visibleSubjects(); track s.id) {
            <nz-card class="tile" (click)="openSubject(s)">
              <span class="tile-badge"><nz-icon nzType="book" /></span>
              <div class="tile-name">{{ s.name }}</div>
              <div class="tile-sub">{{ s.classCount }} lớp</div>
            </nz-card>
          }
          <nz-card class="tile tile-all" (click)="openAll()">
            <span class="tile-badge alt"><nz-icon nzType="appstore" /></span>
            <div class="tile-name">Tất cả lớp</div>
            <div class="tile-sub">Xem toàn bộ</div>
          </nz-card>
        </div>
        @if (subjects().length === 0 && auth.isAdmin()) {
          <p class="muted">Chưa có môn học. Bấm <strong>Quản lý môn</strong> để thêm.</p>
        }
      }
      @case ('grades') {
        <div class="tile-grid">
          @for (g of gradeGroups(); track g.key) {
            <nz-card class="tile" (click)="openGrade(g.key)">
              <span class="tile-badge"><nz-icon nzType="apartment" /></span>
              <div class="tile-name">{{ g.label }}</div>
              <div class="tile-sub">{{ g.count }} lớp</div>
            </nz-card>
          } @empty {
            <nz-empty nzNotFoundContent="Môn này chưa có lớp nào." />
          }
        </div>
      }
      @default {
        @if (screen.isMobile()) {
          <div class="mobile-card-list">
            @for (c of displayedClasses(); track c.id) {
              <nz-card>
                <div class="card-header">
                  <a class="card-title" [routerLink]="['/classes', c.id]" [class.text-deleted]="c.isDeleted">{{ c.name }}</a>
                  @if (c.isDeleted) { <nz-tag nzColor="red">Đã xóa</nz-tag> }
                  @else if (c.isActive) { <nz-tag nzColor="green">Đang mở</nz-tag> }
                  @else { <nz-tag>Đóng</nz-tag> }
                </div>
                <div class="card-field"><span class="label">Môn / Khối</span><span>{{ c.subjectName || '—' }}@if (c.gradeBand) { · {{ c.gradeBand }} }</span></div>
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
            } @empty { <nz-empty nzNotFoundContent="Chưa có lớp nào." /> }
          </div>
        } @else {
          <nz-table #table [nzData]="displayedClasses()" [nzLoading]="loading()" [nzFrontPagination]="false"
            [nzShowPagination]="false" [nzScroll]="{ x: '760px' }">
            <thead>
              <tr>
                <th nzLeft>Tên lớp</th>
                <th>Môn</th>
                <th>Khối</th>
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
                  <td>{{ c.subjectName || '—' }}</td>
                  <td>{{ c.gradeBand || '—' }}</td>
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
          @if (displayedClasses().length === 0) { <nz-empty nzNotFoundContent="Chưa có lớp nào." /> }
        }
        @if (view() === 'all') {
          <nz-pagination class="pager" [nzPageIndex]="page()" [nzTotal]="total()" [nzPageSize]="pageSize()"
            (nzPageIndexChange)="onPageChange($event)" />
        }
      }
    }

    <!-- Thêm/sửa lớp -->
    <nz-modal [nzVisible]="modalOpen()" [nzTitle]="editing() ? 'Sửa lớp' : 'Thêm lớp'"
      [nzOkLoading]="saving()" [nzOkDisabled]="form.invalid" (nzOnOk)="save()" (nzOnCancel)="closeModal()">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired>Tên lớp</nz-form-label>
            <nz-form-control nzErrorTip="Vui lòng nhập tên lớp"><input nz-input formControlName="name" /></nz-form-control>
          </nz-form-item>
          <div nz-row [nzGutter]="12">
            <div nz-col [nzXs]="24" [nzSm]="12">
              <nz-form-item>
                <nz-form-label>Môn học</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="subjectId" nzAllowClear nzShowSearch nzPlaceHolder="Chọn môn" class="full">
                    @for (s of subjects(); track s.id) { <nz-option [nzValue]="s.id" [nzLabel]="s.name" /> }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzXs]="24" [nzSm]="12">
              <nz-form-item>
                <nz-form-label>Khối</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="gradeBand" nzAllowClear nzShowSearch nzPlaceHolder="Chọn khối" class="full">
                    @for (b of gradeBands(); track b) { <nz-option [nzValue]="b" [nzLabel]="b" /> }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            </div>
          </div>
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

    <!-- Quản lý môn học -->
    <nz-modal [nzVisible]="subjectModalOpen()" nzTitle="Quản lý môn học" [nzWidth]="640" [nzFooter]="null"
      (nzOnCancel)="subjectModalOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="inline" class="subj-form">
          <input nz-input [(ngModel)]="subName" name="sjn" placeholder="Tên môn" class="sj-name" />
          <nz-input-number [(ngModel)]="subSort" name="sjo" [nzMin]="0" nzPlaceHolder="Thứ tự" />
          <button nz-button nzType="primary" (click)="saveSubject()">
            {{ editingSubject() ? 'Cập nhật' : 'Thêm' }}
          </button>
          @if (editingSubject()) { <button nz-button (click)="resetSubjectForm()">Hủy</button> }
        </form>
        <nz-table [nzData]="subjects()" [nzFrontPagination]="false" nzSize="small" class="mt">
          <thead><tr><th>Môn</th><th>Số lớp</th><th>Thứ tự</th><th nzRight></th></tr></thead>
          <tbody>
            @for (s of subjects(); track s.id) {
              <tr>
                <td>{{ s.name }}</td>
                <td>{{ s.classCount }}</td>
                <td>{{ s.sortOrder }}</td>
                <td nzRight>
                  <button nz-button nzType="link" nzSize="small" (click)="editSubject(s)"><nz-icon nzType="edit" /></button>
                  <button nz-button nzType="link" nzSize="small" nzDanger
                          nz-popconfirm nzPopconfirmTitle="Xóa môn này?" (nzOnConfirm)="deleteSubject(s)">
                    <nz-icon nzType="delete" />
                  </button>
                </td>
              </tr>
            } @empty { <tr><td colspan="4"><span class="muted">Chưa có môn nào.</span></td></tr> }
          </tbody>
        </nz-table>
      </ng-container>
    </nz-modal>

    <!-- Nhập danh sách lớp từ Excel -->
    <nz-modal [nzVisible]="importOpen()" nzTitle="Nhập danh sách lớp từ Excel" [nzWidth]="720" [nzFooter]="null"
      (nzOnCancel)="importOpen.set(false)">
      <ng-container *nzModalContent>
        <div class="imp-bar">
          <button nz-button (click)="downloadClassTemplate()"><nz-icon nzType="file-excel" /> Tải file mẫu</button>
          <nz-upload [nzBeforeUpload]="beforeUploadClasses" [nzShowUploadList]="false" nzAccept=".xlsx">
            <button nz-button nzType="primary"><nz-icon nzType="upload" /> Chọn file Excel</button>
          </nz-upload>
        </div>
        <p class="muted">Cột: Tên lớp · Môn · Khối · Giáo viên (email/username) · Sĩ số · Ngày khai giảng · Giáo trình.</p>

        @if (importPreview(); as p) {
          <p class="muted">Hợp lệ: <strong>{{ p.validCount }}</strong> · Lỗi: <strong>{{ p.invalidCount }}</strong></p>
          <nz-table [nzData]="p.rows" [nzFrontPagination]="false" nzSize="small" [nzScroll]="{ y: '260px', x: '560px' }">
            <thead><tr><th>Dòng</th><th>Tên lớp</th><th>Môn</th><th>Khối</th><th>GV</th><th>Trạng thái</th></tr></thead>
            <tbody>
              @for (r of p.rows; track r.rowNumber) {
                <tr>
                  <td>{{ r.rowNumber }}</td>
                  <td>{{ r.name || '—' }}</td>
                  <td>{{ r.subjectName || '—' }}</td>
                  <td>{{ r.gradeBand || '—' }}</td>
                  <td>{{ r.teacher || '—' }}</td>
                  <td>
                    @if (r.isValid) { <nz-tag nzColor="green">OK</nz-tag> }
                    @else { <nz-tag nzColor="red">{{ r.error }}</nz-tag> }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
          <div class="imp-actions">
            <button nz-button nzType="primary" [nzLoading]="importBusy()" [disabled]="p.validCount === 0" (click)="doClassImport()">
              Nhập {{ p.validCount }} lớp
            </button>
          </div>
        }

        @if (importResult(); as res) {
          <nz-alert nzType="success" class="mt"
            [nzMessage]="'Đã nhập ' + res.created + ' lớp' + (res.skipped ? (' · bỏ qua ' + res.skipped + ' dòng lỗi') : '') + '.'" />
          @if (res.errors.length) {
            <ul class="err-list">@for (e of res.errors; track e) { <li>{{ e }}</li> }</ul>
          }
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .search { width: 240px; max-width: 60vw; }
    .full { width: 100%; }
    .crumb { margin-bottom: 16px; }
    .crumb a { cursor: pointer; }
    .muted { color: var(--hs-text-muted); }
    .pager { margin-top: 16px; text-align: right; }
    .mt { margin-top: 16px; }

    .tile-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
    .tile { cursor: pointer; text-align: center; transition: transform .12s, box-shadow .12s; }
    .tile:hover { transform: translateY(-2px); box-shadow: var(--hs-shadow); }
    .tile-badge {
      width: 44px; height: 44px; border-radius: 12px; margin: 4px auto 10px;
      display: grid; place-items: center; font-size: 22px; color: #fff;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
    }
    .tile-badge.alt { background: linear-gradient(135deg, #16a34a, #0ea5e9); }
    .tile-name { font-weight: 600; font-size: 15px; }
    .tile-sub { color: var(--hs-text-muted); font-size: 13px; margin-top: 2px; }

    .subj-form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .sj-name { width: 200px; }
    .imp-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
    .imp-actions { margin-top: 12px; text-align: right; }
    .err-list { margin-top: 8px; color: var(--hs-text-muted); font-size: 13px; }

    .mobile-card-list { display: flex; flex-direction: column; gap: 12px; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .card-title { font-weight: 600; }
    .card-field { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--hs-border); font-size: 13px; }
    .card-field:last-of-type { border-bottom: none; }
    .card-field .label { color: var(--hs-text-muted); }
    .card-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
    .text-deleted { text-decoration: line-through; color: var(--hs-text-muted); }
  `
})
export class ClassesPage {
  protected readonly auth = inject(AuthService);
  protected readonly screen = inject(ScreenService);
  private readonly classesService = inject(ClassesService);
  private readonly subjectsService = inject(SubjectsService);
  private readonly settingsService = inject(SettingsService);
  private readonly usersService = inject(UsersService);
  private readonly message = inject(NzMessageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // ----- Điều hướng Môn → Khối → Lớp (qua query params) -----
  protected readonly subjectId = signal<string | null>(null);
  protected readonly gradeBand = signal<string | null>(null);
  protected readonly view = signal<string | null>(null);

  protected readonly level = computed<'subjects' | 'grades' | 'classes'>(() => {
    if (this.view() === 'all') return 'classes';
    if (!this.subjectId()) return 'subjects';
    if (!this.gradeBand()) return 'grades';
    return 'classes';
  });

  // ----- Dữ liệu -----
  protected readonly subjects = signal<Subject[]>([]);
  protected readonly gradeBands = signal<string[]>([]);
  protected readonly subjectClasses = signal<ClassListItem[]>([]); // toàn bộ lớp của môn đang chọn
  protected readonly allClasses = signal<ClassListItem[]>([]);      // chế độ "Tất cả lớp" (phân trang server)
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly search = signal('');
  protected readonly includeDeleted = signal(false);
  protected readonly loading = signal(false);
  protected readonly teachers = signal<UserListItem[]>([]);
  private loadedSubjectId: string | null = null;

  // ----- Modal lớp -----
  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<ClassListItem | null>(null);
  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    subjectId: new FormControl<string | null>(null),
    gradeBand: new FormControl<string | null>(null),
    teacherId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    maxCapacity: new FormControl(15, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    schedule: new FormControl<string | null>(null),
    startDate: new FormControl<Date | null>(null),
    isActive: new FormControl(true, { nonNullable: true })
  });

  // ----- Modal quản lý môn -----
  protected readonly subjectModalOpen = signal(false);
  protected readonly editingSubject = signal<Subject | null>(null);
  protected subName = '';
  protected subSort = 0;

  // ----- Modal nhập Excel lớp -----
  protected readonly importOpen = signal(false);
  protected readonly importBusy = signal(false);
  protected readonly importPreview = signal<ClassImportPreview | null>(null);
  protected readonly importResult = signal<ClassImportResult | null>(null);
  private importFile: File | null = null;

  private searchDebounce?: ReturnType<typeof setTimeout>;

  protected readonly currentSubjectName = computed(() =>
    this.subjects().find(s => s.id === this.subjectId())?.name ?? 'Môn');

  // Admin thấy mọi môn; Giáo viên chỉ thấy môn có lớp của mình.
  protected readonly visibleSubjects = computed(() =>
    this.auth.isAdmin() ? this.subjects() : this.subjects().filter(s => s.classCount > 0));

  protected readonly headerSubtitle = computed(() => {
    switch (this.level()) {
      case 'subjects': return 'Chọn môn học';
      case 'grades': return `${this.currentSubjectName()} · chọn khối`;
      default: return this.view() === 'all' ? 'Tất cả lớp' : `${this.currentSubjectName()} · ${this.gradeBand() ? this.gradeLabel(this.gradeBand()!) : ''}`;
    }
  });

  protected readonly gradeGroups = computed(() => {
    const order = this.gradeBands();
    const counts = new Map<string, number>();
    for (const c of this.subjectClasses()) {
      const key = c.gradeBand && c.gradeBand.trim() ? c.gradeBand : NO_BAND;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const groups = [...counts.entries()].map(([key, count]) => ({
      key, count, label: key === NO_BAND ? 'Chưa phân khối' : key
    }));
    groups.sort((a, b) => {
      if (a.key === NO_BAND) return 1;
      if (b.key === NO_BAND) return -1;
      const ia = order.indexOf(a.key), ib = order.indexOf(b.key);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    return groups;
  });

  protected readonly displayedClasses = computed(() => {
    if (this.view() === 'all') return this.allClasses();
    const gb = this.gradeBand();
    const term = this.search().trim().toLowerCase();
    return this.subjectClasses().filter(c => {
      const key = c.gradeBand && c.gradeBand.trim() ? c.gradeBand : NO_BAND;
      if (gb && key !== gb) return false;
      if (term && !c.name.toLowerCase().includes(term)) return false;
      return true;
    });
  });

  constructor() {
    this.loadSubjects();
    this.loadGradeBands();
    if (this.auth.isAdmin()) this.loadTeachers();

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(pm => {
      this.subjectId.set(pm.get('subjectId'));
      this.gradeBand.set(pm.get('gradeBand'));
      this.view.set(pm.get('view'));
      this.onRouteChanged();
    });
  }

  private onRouteChanged(): void {
    if (this.view() === 'all') {
      this.loadAllClasses();
      return;
    }
    const sid = this.subjectId();
    if (sid && this.level() !== 'subjects' && sid !== this.loadedSubjectId) {
      this.loadSubjectClasses(sid);
    }
  }

  private loadSubjects(): void {
    this.subjectsService.getAll().subscribe(s => this.subjects.set(s));
  }

  private loadGradeBands(): void {
    this.settingsService.getEffective().subscribe(eff => {
      const raw = eff.values?.['Class.GradeBands'] ?? '';
      this.gradeBands.set(raw.split(/[\n,]/).map(x => x.trim()).filter(Boolean));
    });
  }

  private loadTeachers(): void {
    this.usersService.getPaged(1, 200).subscribe({
      next: r => this.teachers.set(r.items.filter(u => !u.isDeleted && (u.roles.includes(ROLE_TEACHER) || u.roles.includes(ROLE_ADMIN))))
    });
  }

  private loadSubjectClasses(subjectId: string): void {
    this.loading.set(true);
    this.classesService.getPaged({ page: 1, pageSize: 500, subjectId, includeDeleted: this.includeDeleted() }).subscribe({
      next: r => { this.subjectClasses.set(r.items); this.loadedSubjectId = subjectId; this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  private loadAllClasses(): void {
    this.loading.set(true);
    this.classesService.getPaged({
      page: this.page(), pageSize: this.pageSize(),
      search: this.search() || undefined, includeDeleted: this.includeDeleted()
    }).subscribe({
      next: r => { this.allClasses.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  // ----- Điều hướng -----
  protected goSubjects(): void { this.loadSubjects(); this.navigate({}); }
  protected openSubject(s: Subject): void { this.search.set(''); this.navigate({ subjectId: s.id }); }
  protected openSubjectId(id: string | null): void { if (id) this.navigate({ subjectId: id }); }
  protected openGrade(key: string): void { this.navigate({ subjectId: this.subjectId(), gradeBand: key }); }
  protected openAll(): void { this.search.set(''); this.page.set(1); this.navigate({ view: 'all' }); }

  private navigate(queryParams: Record<string, string | null>): void {
    this.router.navigate([], { relativeTo: this.route, queryParams });
  }

  protected gradeLabel(key: string): string { return key === NO_BAND ? 'Chưa phân khối' : key; }

  protected onSearch(value: string): void {
    this.search.set(value);
    if (this.view() === 'all') {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => { this.page.set(1); this.loadAllClasses(); }, 350);
    }
  }

  protected onIncludeDeleted(value: boolean): void {
    this.includeDeleted.set(value);
    this.page.set(1);
    if (this.view() === 'all') this.loadAllClasses();
    else if (this.subjectId()) this.loadSubjectClasses(this.subjectId()!);
  }

  protected onPageChange(p: number): void { this.page.set(p); this.loadAllClasses(); }

  // ----- CRUD lớp -----
  protected openCreate(): void {
    this.editing.set(null);
    const sid = this.view() === 'all' ? null : this.subjectId();
    const gb = this.gradeBand() && this.gradeBand() !== NO_BAND ? this.gradeBand() : null;
    this.form.reset({ name: '', subjectId: sid, gradeBand: gb, teacherId: '', maxCapacity: 15, schedule: null, startDate: null, isActive: true });
    this.modalOpen.set(true);
  }

  protected openEdit(c: ClassListItem): void {
    this.editing.set(c);
    this.classesService.getById(c.id).subscribe(detail => {
      this.form.reset({
        name: detail.name, subjectId: detail.subjectId, gradeBand: detail.gradeBand, teacherId: detail.teacherId,
        maxCapacity: detail.maxCapacity, schedule: detail.schedule,
        startDate: detail.startDate ? new Date(detail.startDate) : null, isActive: detail.isActive
      });
    });
    this.modalOpen.set(true);
  }

  protected closeModal(): void { this.modalOpen.set(false); }

  protected save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const request: ClassRequest = {
      name: v.name, teacherId: v.teacherId, subjectId: v.subjectId || null, gradeBand: v.gradeBand || null,
      curriculumId: null, maxCapacity: v.maxCapacity, schedule: v.schedule, startDate: toIsoDate(v.startDate), isActive: v.isActive
    };
    const editing = this.editing();
    const op = editing ? this.classesService.update(editing.id, request) : this.classesService.create(request);
    this.saving.set(true);
    op.subscribe({
      next: () => { this.saving.set(false); this.modalOpen.set(false); this.message.success(editing ? 'Đã cập nhật lớp.' : 'Đã thêm lớp.'); this.refresh(); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message ?? 'Lưu thất bại.'); }
    });
  }

  protected remove(c: ClassListItem): void {
    this.classesService.delete(c.id).subscribe({
      next: () => { this.message.success('Đã xóa (mềm).'); this.refresh(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ?? 'Xóa thất bại.')
    });
  }

  protected restore(c: ClassListItem): void {
    this.classesService.restore(c.id).subscribe({
      next: () => { this.message.success('Đã khôi phục.'); this.refresh(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ?? 'Khôi phục thất bại.')
    });
  }

  /** Làm mới danh sách theo mức hiện tại + cập nhật số lớp của môn. */
  private refresh(): void {
    this.loadSubjects();
    if (this.view() === 'all') this.loadAllClasses();
    else if (this.subjectId()) this.loadSubjectClasses(this.subjectId()!);
  }

  // ----- Quản lý môn -----
  protected openSubjectManager(): void { this.resetSubjectForm(); this.subjectModalOpen.set(true); }

  protected resetSubjectForm(): void { this.editingSubject.set(null); this.subName = ''; this.subSort = 0; }

  protected editSubject(s: Subject): void { this.editingSubject.set(s); this.subName = s.name; this.subSort = s.sortOrder; }

  protected saveSubject(): void {
    if (!this.subName.trim()) { this.message.warning('Nhập tên môn.'); return; }
    const req = { name: this.subName.trim(), description: null, sortOrder: this.subSort ?? 0, isActive: true };
    const editing = this.editingSubject();
    const op = editing ? this.subjectsService.update(editing.id, req) : this.subjectsService.create(req);
    op.subscribe({
      next: () => { this.message.success(editing ? 'Đã cập nhật môn.' : 'Đã thêm môn.'); this.resetSubjectForm(); this.loadSubjects(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ?? 'Lưu môn thất bại.')
    });
  }

  protected deleteSubject(s: Subject): void {
    this.subjectsService.delete(s.id).subscribe({
      next: () => { this.message.success('Đã xóa môn.'); this.loadSubjects(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ?? 'Xóa môn thất bại.')
    });
  }

  // ----- Nhập Excel lớp -----
  protected openClassImport(): void {
    this.importFile = null;
    this.importPreview.set(null);
    this.importResult.set(null);
    this.importOpen.set(true);
  }

  protected downloadClassTemplate(): void {
    this.classesService.downloadClassImportTemplate().subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mau-danh-sach-lop.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  protected beforeUploadClasses = (file: NzUploadFile): boolean => {
    this.importFile = file as unknown as File;
    this.importResult.set(null);
    this.classesService.importClassesPreview(this.importFile).subscribe({
      next: p => this.importPreview.set(p),
      error: (e: HttpErrorResponse) => this.message.error(e.error?.message ?? e.message ?? 'Đọc file thất bại.')
    });
    return false;
  };

  protected doClassImport(): void {
    if (!this.importFile) return;
    this.importBusy.set(true);
    this.classesService.importClassesCommit(this.importFile).subscribe({
      next: res => {
        this.importBusy.set(false);
        this.importResult.set(res);
        this.importPreview.set(null);
        this.message.success(`Đã nhập ${res.created} lớp.`);
        this.refresh();
      },
      error: (e: HttpErrorResponse) => { this.importBusy.set(false); this.message.error(e.error?.message ?? e.message ?? 'Nhập thất bại.'); }
    });
  }
}

function toIsoDate(d: Date | null): string | null {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
