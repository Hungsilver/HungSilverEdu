import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCalendarModule } from 'ng-zorro-antd/calendar';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimePickerModule } from 'ng-zorro-antd/time-picker';
import { ClassesService } from '../../core/classes.service';
import { CalendarSession, ClassListItem, WEEKDAY_LABELS } from '../../core/models';
import { ScheduleService } from '../../core/schedule.service';
import { toDateOnly, toTimeOnly } from '../../core/date-util';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-schedule-page',
  imports: [
    FormsModule, RouterLink, DatePipe,
    NzCalendarModule, NzBadgeModule, NzRadioModule, NzButtonModule, NzIconModule, NzTagModule,
    NzDrawerModule, NzModalModule, NzSelectModule, NzTimePickerModule, NzFormModule, NzInputModule, PageHeader
  ],
  template: `
    <app-page-header title="Lịch học" subtitle="Bấm vào một ngày để xem & tạo buổi học" icon="calendar">
      <nz-radio-group [ngModel]="mode()" (ngModelChange)="onMode($event)" nzButtonStyle="solid">
        <label nz-radio-button nzValue="month">Tháng</label>
        <label nz-radio-button nzValue="week">Tuần</label>
      </nz-radio-group>
    </app-page-header>

    @if (mode() === 'month') {
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

    <!-- Drawer: toàn bộ lịch trong ngày -->
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
    .cell { display: flex; flex-direction: column; gap: 2px; }
    .ev { font-size: 11px; padding: 1px 4px; background: var(--hs-primary-weak); color: var(--hs-primary); border-radius: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ev.cancelled, .day-ev.cancelled { text-decoration: line-through; opacity: 0.6; }
    .week-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .flip { transform: rotate(180deg); }
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
  `
})
export class SchedulePage {
  private readonly scheduleService = inject(ScheduleService);
  private readonly classesService = inject(ClassesService);
  private readonly message = inject(NzMessageService);
  protected readonly weekdays = WEEKDAY_LABELS;

  protected readonly mode = signal<'month' | 'week'>('month');
  protected monthValue = new Date();
  protected readonly anchor = signal<Date>(new Date());
  protected readonly sessionsByDate = signal<Record<string, CalendarSession[]>>({});

  protected readonly weekStart = signal<Date>(startOfWeek(new Date()));
  protected readonly weekEnd = signal<Date>(addDays(startOfWeek(new Date()), 6));
  protected readonly weekDays = signal<{ date: Date; iso: string }[]>([]);

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

  constructor() {
    this.loadMonth(this.monthValue);
    this.classesService.getPaged({ page: 1, pageSize: 200 }).subscribe(r => this.classes.set(r.items));
  }

  protected onMode(value: 'month' | 'week'): void {
    this.mode.set(value);
    this.onModeChange();
  }

  protected onModeChange(): void {
    if (this.mode() === 'week') this.rebuildWeek(this.anchor());
    else this.loadMonth(this.monthValue);
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

  private reloadCurrent(): void {
    if (this.mode() === 'week') this.rebuildWeek(this.anchor());
    else this.loadMonth(this.monthValue);
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
    this.scheduleService.getRange(toDateOnly(from), toDateOnly(to)).subscribe(list => {
      const map: Record<string, CalendarSession[]> = {};
      for (const s of list) (map[s.sessionDate] ??= []).push(s);
      this.sessionsByDate.set(map);
    });
  }
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
