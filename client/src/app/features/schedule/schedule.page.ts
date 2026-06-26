import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCalendarModule } from 'ng-zorro-antd/calendar';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimePickerModule } from 'ng-zorro-antd/time-picker';
import { AuthService } from '../../core/auth.service';
import { BranchesService } from '../../core/branches.service';
import { ClassesService } from '../../core/classes.service';
import { GradesService } from '../../core/grades.service';
import { SubjectsService } from '../../core/subjects.service';
import { TeachersService } from '../../core/teachers.service';
import { Branch, CalendarSession, ClassListItem, Grade, ScheduleFilter, Subject, TeacherProfile, WEEKDAY_LABELS } from '../../core/models';
import { ScheduleService } from '../../core/schedule.service';
import { toDateOnly, toTimeOnly } from '../../core/date-util';
import { PageHeader } from '../../shared/page-header';

/** Nhóm buổi học trong ngày theo Cơ sở → Ca (để hiển thị view Ngày kiểu bản in nghiệp vụ). */
interface ShiftGroup { key: number; name: string; sessions: CalendarSession[]; }
interface BranchGroup { key: string; name: string; none: boolean; shifts: ShiftGroup[]; }

@Component({
  selector: 'app-schedule-page',
  imports: [
    FormsModule, RouterLink, DatePipe,
    NzCalendarModule, NzBadgeModule, NzRadioModule, NzButtonModule, NzIconModule, NzTagModule,
    NzDrawerModule, NzModalModule, NzSelectModule, NzTimePickerModule, NzFormModule, NzInputModule,
    NzCardModule, NzEmptyModule, NzDatePickerModule, PageHeader
  ],
  template: `
    <app-page-header title="Lịch học" subtitle="Xem lịch theo ngày · tuần · tháng; lọc theo cơ sở, giáo viên, môn, khối" icon="calendar">
      <nz-radio-group [ngModel]="mode()" (ngModelChange)="onMode($event)" nzButtonStyle="solid">
        <label nz-radio-button nzValue="day">Ngày</label>
        <label nz-radio-button nzValue="week">Tuần</label>
        <label nz-radio-button nzValue="month">Tháng</label>
      </nz-radio-group>
    </app-page-header>

    <!-- Bộ lọc (hiển thị tùy role): áp cho cả 3 chế độ xem -->
    <div class="filters">
      <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Cơ sở"
        [ngModel]="branchId" (ngModelChange)="branchId = $event; applyFilters()">
        @for (b of branches(); track b.id) { <nz-option [nzValue]="b.id" [nzLabel]="b.name" /> }
      </nz-select>
      <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Môn học"
        [ngModel]="subjectId" (ngModelChange)="subjectId = $event; applyFilters()">
        @for (s of subjects(); track s.id) { <nz-option [nzValue]="s.id" [nzLabel]="s.name" /> }
      </nz-select>
      <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Khối"
        [ngModel]="gradeId" (ngModelChange)="gradeId = $event; applyFilters()">
        @for (g of grades(); track g.id) { <nz-option [nzValue]="g.id" [nzLabel]="g.name" /> }
      </nz-select>
      @if (auth.isAdmin()) {
        <nz-select nzAllowClear nzShowSearch nzPlaceHolder="Giáo viên"
          [ngModel]="teacherProfileId" (ngModelChange)="teacherProfileId = $event; applyFilters()">
          @for (t of teachers(); track t.id) { <nz-option [nzValue]="t.id" [nzLabel]="t.fullName" /> }
        </nz-select>
      }
      <input nz-input placeholder="Tìm lớp, giáo viên" [ngModel]="search()" (ngModelChange)="search.set($event)" />
      <button nz-button (click)="resetFilters()"><nz-icon nzType="reload" /> Đặt lại</button>
    </div>

    @if (mode() === 'day') {
      <div class="day-toolbar">
        <button nz-button (click)="shiftDay(-1)" aria-label="Ngày trước"><nz-icon nzType="left" /></button>
        <button nz-button (click)="goToday()">Hôm nay</button>
        <button nz-button (click)="shiftDay(1)" aria-label="Ngày sau"><nz-icon nzType="right" /></button>
        <nz-date-picker [ngModel]="dayAnchor()" (ngModelChange)="onPickDay($event)" nzFormat="dd/MM/yyyy" [nzAllowClear]="false" />
        <span class="day-label">{{ weekdays[dayAnchor().getDay()] }}, {{ dayAnchor() | date: 'dd/MM/yyyy' }}</span>
        <span class="spacer"></span>
        <button nz-button nzType="primary" (click)="openCreateForDay()"><nz-icon nzType="plus" /> Tạo buổi học</button>
      </div>

      @for (b of dayGroups(); track b.key) {
        <nz-card class="branch-card" [nzTitle]="b.name" nzSize="small">
          @for (sh of b.shifts; track sh.key) {
            <div class="shift-block">
              <div class="shift-head">{{ sh.name }}</div>
              @for (s of sh.sessions; track s.id) {
                <a class="sess" [routerLink]="['/sessions', s.id]" [class.cancelled]="s.status === 'Cancelled'">
                  <span class="sess-time">{{ timeRange(s) || '—' }}</span>
                  <span class="sess-main">
                    <span class="sess-name">{{ sessionLabel(s) }}</span>
                    @if (s.teacherName) { <span class="sess-teacher">— {{ s.teacherName }}</span> }
                    @if (s.topic) { <small class="muted"> · {{ s.topic }}</small> }
                  </span>
                  @if (s.status === 'Cancelled') { <nz-tag nzColor="red">Hủy</nz-tag> }
                  @else if (s.status === 'Completed') { <nz-tag nzColor="green">Xong</nz-tag> }
                </a>
              }
            </div>
          }
        </nz-card>
      } @empty {
        <nz-empty nzNotFoundContent="Không có buổi học phù hợp trong ngày." />
      }
    } @else if (mode() === 'month') {
      <nz-calendar [(nzValue)]="monthValue" (nzPanelChange)="onPanelChange($event)" (nzSelectChange)="openDay($event)">
        <ng-container *nzDateCell="let date">
          <div class="cell">
            @for (s of sessionsOn(date); track s.id) {
              <a class="ev" [routerLink]="['/sessions', s.id]"
                 [class.cancelled]="s.status === 'Cancelled'">
                {{ s.startTime ? (s.startTime.substring(0,5) + ' ') : '' }}{{ s.className }}
              </a>
            }
          </div>
        </ng-container>
      </nz-calendar>
    } @else {
      <div class="week-toolbar">
        <button nz-button (click)="shiftWeek(-1)"><nz-icon nzType="arrow-left" /></button>
        <button nz-button (click)="today()">Hôm nay</button>
        <button nz-button (click)="shiftWeek(1)"><nz-icon nzType="arrow-left" class="flip" /></button>
        <span class="muted">{{ weekStart() | date: 'dd/MM' }} – {{ weekEnd() | date: 'dd/MM/yyyy' }}</span>
      </div>
      <div class="week-grid">
        @for (d of weekDays(); track d.iso) {
          <div class="day-col">
            <div class="day-head" (click)="openDay(d.date)">
              {{ weekdays[d.date.getDay()] }}<br /><span class="muted">{{ d.date | date: 'dd/MM' }}</span>
            </div>
            @for (s of daySessions(d.iso); track s.id) {
              <a class="day-ev" [routerLink]="['/sessions', s.id]" [class.cancelled]="s.status === 'Cancelled'">
                <strong>{{ s.startTime ? s.startTime.substring(0,5) : '' }}</strong>
                <span>{{ s.className }}</span>
                @if (s.topic) { <small>{{ s.topic }}</small> }
              </a>
            } @empty { <div class="empty">—</div> }
          </div>
        }
      </div>
    }

    <!-- Drawer: toàn bộ lịch trong ngày (mở từ lịch tuần/tháng) -->
    <nz-drawer [nzVisible]="dayOpen()" nzPlacement="right" [nzWidth]="360"
      [nzTitle]="dayTitle()" (nzOnClose)="dayOpen.set(false)">
      <ng-container *nzDrawerContent>
        <button nz-button nzType="primary" nzBlock class="mb" (click)="openCreate()">
          <nz-icon nzType="plus" /> Tạo buổi học ngày này
        </button>
        @for (s of selectedDaySessions(); track s.id) {
          <a class="day-row" [routerLink]="['/sessions', s.id]" (click)="dayOpen.set(false)">
            <span class="t">{{ s.startTime ? s.startTime.substring(0,5) : '—' }}</span>
            <span class="n">{{ s.className }}@if (s.topic) { <small class="muted"> · {{ s.topic }}</small> }</span>
            @if (s.status === 'Cancelled') { <nz-tag nzColor="red">Hủy</nz-tag> }
            @else if (s.status === 'Completed') { <nz-tag nzColor="green">Xong</nz-tag> }
            @else { <nz-tag nzColor="blue">Lên lịch</nz-tag> }
          </a>
        } @empty { <p class="muted">Chưa có buổi học trong ngày.</p> }
      </ng-container>
    </nz-drawer>

    <!-- Modal: tạo buổi học tại ngày đã chọn -->
    <nz-modal [nzVisible]="createOpen()" nzTitle="Tạo buổi học" [nzOkLoading]="busy()"
      (nzOnOk)="createSession()" (nzOnCancel)="createOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical">
          <nz-form-item><nz-form-label nzRequired>Lớp</nz-form-label>
            <nz-form-control nzErrorTip="Chọn lớp">
              <nz-select [(ngModel)]="newClassId" name="c" nzShowSearch nzPlaceHolder="Chọn lớp" class="full">
                @for (c of classes(); track c.id) { <nz-option [nzValue]="c.id" [nzLabel]="c.name" /> }
              </nz-select>
            </nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Ngày</nz-form-label>
            <nz-form-control><input nz-input [value]="dayTitle()" disabled /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Giờ (bắt đầu – kết thúc)</nz-form-label>
            <nz-form-control>
              <nz-time-picker [(ngModel)]="newStart" name="s" nzFormat="HH:mm" />
              <nz-time-picker [(ngModel)]="newEnd" name="e" nzFormat="HH:mm" class="ml" />
            </nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Chủ đề</nz-form-label>
            <nz-form-control><input nz-input [(ngModel)]="newTopic" name="t" placeholder="VD: Unit 3 - Animals" /></nz-form-control></nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 14px; }
    .cell { display: flex; flex-direction: column; gap: 2px; }
    .ev { font-size: 11px; padding: 1px 4px; background: var(--hs-primary-weak); color: var(--hs-primary); border-radius: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ev.cancelled, .day-ev.cancelled, .sess.cancelled { text-decoration: line-through; opacity: 0.6; }
    .day-toolbar, .week-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .day-label { font-weight: 600; }
    .spacer { flex: 1; }
    .flip { transform: rotate(180deg); }
    .branch-card { margin-bottom: 14px; }
    .shift-block { margin-bottom: 10px; }
    .shift-block:last-child { margin-bottom: 0; }
    .shift-head { font-weight: 600; color: var(--hs-primary); margin: 4px 0 6px; }
    .sess { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; margin-bottom: 6px; background: var(--hs-surface-2); }
    .sess:hover { background: var(--hs-primary-weak); }
    .sess-time { font-weight: 600; min-width: 96px; white-space: nowrap; }
    .sess-main { flex: 1; min-width: 0; }
    .sess-teacher { color: var(--hs-text-muted); }
    .week-grid { display: grid; grid-template-columns: repeat(7, minmax(120px, 1fr)); gap: 8px; overflow-x: auto; }
    .day-col { background: var(--hs-surface-2); border: 1px solid var(--hs-border); border-radius: 8px; padding: 8px; min-height: 160px; }
    .day-head { text-align: center; font-weight: 600; margin-bottom: 8px; cursor: pointer; border-radius: 6px; }
    .day-head:hover { background: var(--hs-primary-weak); }
    .day-ev { display: flex; flex-direction: column; background: var(--hs-primary-weak); color: var(--hs-primary); border-radius: 6px; padding: 4px 6px; margin-bottom: 6px; font-size: 12px; }
    .day-ev small { color: var(--hs-text-muted); }
    .empty { text-align: center; color: var(--hs-text-muted); }
    .muted { color: var(--hs-text-muted); }
    .mb { margin-bottom: 16px; }
    .ml { margin-left: 8px; }
    .full { width: 100%; }
    .day-row { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--hs-border); }
    .day-row:last-child { border-bottom: none; }
    .day-row .t { font-weight: 600; min-width: 44px; }
    .day-row .n { flex: 1; min-width: 0; }
    @media (max-width: 575px) {
      .sess-time { min-width: 80px; }
    }
  `
})
export class SchedulePage {
  private readonly scheduleService = inject(ScheduleService);
  private readonly classesService = inject(ClassesService);
  private readonly branchesService = inject(BranchesService);
  private readonly subjectsService = inject(SubjectsService);
  private readonly gradesService = inject(GradesService);
  private readonly teachersService = inject(TeachersService);
  protected readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);
  protected readonly weekdays = WEEKDAY_LABELS;

  protected readonly mode = signal<'day' | 'week' | 'month'>('day');
  protected monthValue = new Date();
  protected readonly anchor = signal<Date>(new Date());
  protected readonly dayAnchor = signal<Date>(startOfDay(new Date()));
  protected readonly sessionsByDate = signal<Record<string, CalendarSession[]>>({});

  protected readonly weekStart = signal<Date>(startOfWeek(new Date()));
  protected readonly weekEnd = signal<Date>(addDays(startOfWeek(new Date()), 6));
  protected readonly weekDays = signal<{ date: Date; iso: string }[]>([]);

  // Danh mục cho bộ lọc (hiển thị tùy role).
  protected readonly branches = signal<Branch[]>([]);
  protected readonly subjects = signal<Subject[]>([]);
  protected readonly grades = signal<Grade[]>([]);
  protected readonly teachers = signal<TeacherProfile[]>([]);
  protected branchId: string | null = null;
  protected subjectId: string | null = null;
  protected gradeId: string | null = null;
  protected teacherProfileId: string | null = null;
  protected readonly search = signal('');

  // Lịch trong ngày + tạo buổi
  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly dayOpen = signal(false);
  protected readonly createOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly selectedDay = signal<Date | null>(null);
  protected newClassId: string | null = null;
  protected newStart: Date | null = null;
  protected newEnd: Date | null = null;
  protected newTopic = '';

  protected readonly selectedDaySessions = computed<CalendarSession[]>(() => {
    const d = this.selectedDay();
    return d ? this.sessionsByDate()[toDateOnly(d)] ?? [] : [];
  });

  protected readonly dayTitle = computed(() => {
    const d = this.selectedDay();
    return d ? `Lịch ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '';
  });

  /** Buổi học trong ngày đang xem (view Ngày), đã lọc theo ô tìm kiếm + nhóm Cơ sở → Ca. */
  protected readonly dayGroups = computed<BranchGroup[]>(() => {
    const iso = toDateOnly(this.dayAnchor());
    const all = this.sessionsByDate()[iso] ?? [];
    const term = this.search().trim().toLowerCase();
    const sessions = term
      ? all.filter(s =>
          s.className.toLowerCase().includes(term)
          || (s.teacherName?.toLowerCase().includes(term) ?? false)
          || (s.subjectName?.toLowerCase().includes(term) ?? false))
      : all;
    return groupByBranchShift(sessions);
  });

  constructor() {
    this.loadLookups();
    this.loadDay(this.dayAnchor());
    this.classesService.getPaged({ page: 1, pageSize: 200 }).subscribe(r => this.classes.set(r.items));
  }

  private loadLookups(): void {
    this.branchesService.getAll().subscribe(x => this.branches.set(x));
    this.subjectsService.getAll().subscribe(x => this.subjects.set(x));
    this.gradesService.getAll().subscribe(x => this.grades.set(x));
    if (this.auth.isAdmin())
      this.teachersService.getPaged({ page: 1, pageSize: 500 }).subscribe(x => this.teachers.set(x.items));
  }

  /** Bộ lọc gửi lên server (GV bỏ qua filter giáo viên — server tự scope theo lớp mình). */
  private currentFilter(): ScheduleFilter {
    return {
      branchId: this.branchId ?? undefined,
      subjectId: this.subjectId ?? undefined,
      gradeId: this.gradeId ?? undefined,
      teacherProfileId: this.auth.isAdmin() ? (this.teacherProfileId ?? undefined) : undefined
    };
  }

  protected applyFilters(): void {
    this.reloadCurrent();
  }

  protected resetFilters(): void {
    this.branchId = null;
    this.subjectId = null;
    this.gradeId = null;
    this.teacherProfileId = null;
    this.search.set('');
    this.reloadCurrent();
  }

  protected onMode(value: 'day' | 'week' | 'month'): void {
    this.mode.set(value);
    this.reloadCurrent();
  }

  protected onPanelChange(change: { date: Date; mode: string }): void {
    this.monthValue = change.date;
    this.loadMonth(change.date);
  }

  protected openDay(date: Date): void {
    this.selectedDay.set(date);
    this.dayOpen.set(true);
  }

  protected openCreate(): void {
    this.newClassId = null;
    this.newStart = null;
    this.newEnd = null;
    this.newTopic = '';
    this.createOpen.set(true);
  }

  protected openCreateForDay(): void {
    this.selectedDay.set(this.dayAnchor());
    this.openCreate();
  }

  protected createSession(): void {
    const day = this.selectedDay();
    if (!this.newClassId) { this.message.warning('Vui lòng chọn lớp.'); return; }
    if (!day) return;
    this.busy.set(true);
    this.scheduleService.createSession({
      classId: this.newClassId,
      sessionDate: toDateOnly(day),
      startTime: this.newStart ? toTimeOnly(this.newStart) : null,
      endTime: this.newEnd ? toTimeOnly(this.newEnd) : null,
      topic: this.newTopic || null,
      sessionNumber: null
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.createOpen.set(false);
        this.message.success('Đã tạo buổi học.');
        this.reloadCurrent();
      },
      error: () => { this.busy.set(false); this.message.error('Tạo buổi học thất bại.'); }
    });
  }

  protected sessionsOn(date: Date): CalendarSession[] {
    return this.sessionsByDate()[toDateOnly(date)] ?? [];
  }

  protected daySessions(isoDate: string): CalendarSession[] {
    return this.sessionsByDate()[isoDate] ?? [];
  }

  protected timeRange(s: CalendarSession): string {
    const f = (t: string | null) => (t ? t.substring(0, 5) : '');
    if (!s.startTime && !s.endTime) return '';
    return s.endTime ? `${f(s.startTime)}–${f(s.endTime)}` : f(s.startTime);
  }

  /** Nhãn lớp ưu tiên "Môn Khối" nếu tên lớp chưa thể hiện; mặc định dùng tên lớp. */
  protected sessionLabel(s: CalendarSession): string {
    return s.className;
  }

  private reloadCurrent(): void {
    if (this.mode() === 'day') this.loadDay(this.dayAnchor());
    else if (this.mode() === 'week') this.rebuildWeek(this.anchor());
    else this.loadMonth(this.monthValue);
  }

  private loadDay(date: Date): void {
    this.fetch(date, date);
  }

  protected shiftDay(delta: number): void {
    const d = addDays(this.dayAnchor(), delta);
    this.dayAnchor.set(d);
    this.loadDay(d);
  }

  protected goToday(): void {
    const d = startOfDay(new Date());
    this.dayAnchor.set(d);
    this.loadDay(d);
  }

  protected onPickDay(date: Date | null): void {
    if (!date) return;
    const d = startOfDay(date);
    this.dayAnchor.set(d);
    this.loadDay(d);
  }

  private loadMonth(date: Date): void {
    const from = new Date(date.getFullYear(), date.getMonth(), 1);
    const to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    this.fetch(from, to);
  }

  protected shiftWeek(delta: number): void {
    this.rebuildWeek(addDays(this.anchor(), delta * 7));
  }

  protected today(): void {
    this.rebuildWeek(new Date());
  }

  private rebuildWeek(date: Date): void {
    this.anchor.set(date);
    const start = startOfWeek(date);
    const end = addDays(start, 6);
    this.weekStart.set(start);
    this.weekEnd.set(end);
    this.weekDays.set(Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return { date: d, iso: toDateOnly(d) };
    }));
    this.fetch(start, end);
  }

  private fetch(from: Date, to: Date): void {
    this.scheduleService.getRange(toDateOnly(from), toDateOnly(to), undefined, this.currentFilter()).subscribe(list => {
      const map: Record<string, CalendarSession[]> = {};
      for (const s of list) (map[s.sessionDate] ??= []).push(s);
      this.sessionsByDate.set(map);
    });
  }
}

/** Nhóm các buổi theo Cơ sở → Ca, giữ thứ tự Ca (shiftOrder) và đẩy nhóm "Chưa phân cơ sở" xuống cuối. */
function groupByBranchShift(sessions: CalendarSession[]): BranchGroup[] {
  const NONE = '__none__';
  const branchMap = new Map<string, { name: string; order: string; shifts: Map<number, ShiftGroup> }>();

  for (const s of sessions) {
    const bKey = s.branchId ?? NONE;
    const bName = s.branchName ?? 'Chưa phân cơ sở';
    let branch = branchMap.get(bKey);
    if (!branch) {
      branch = { name: bName, order: s.branchCode ?? bName, shifts: new Map() };
      branchMap.set(bKey, branch);
    }
    let shift = branch.shifts.get(s.shiftOrder);
    if (!shift) {
      shift = { key: s.shiftOrder, name: s.shiftName ?? 'Chưa xếp giờ', sessions: [] };
      branch.shifts.set(s.shiftOrder, shift);
    }
    shift.sessions.push(s);
  }

  return [...branchMap.entries()]
    .map(([key, v]) => ({
      key,
      name: v.name,
      none: key === NONE,
      shifts: [...v.shifts.values()].sort((a, b) => a.key - b.key)
    }))
    .sort((a, b) => (a.none ? 1 : 0) - (b.none ? 1 : 0) || a.name.localeCompare(b.name, 'vi'));
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
