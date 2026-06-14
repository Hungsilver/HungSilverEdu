import { DatePipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCalendarModule } from 'ng-zorro-antd/calendar';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CalendarSession, WEEKDAY_LABELS } from '../../core/models';
import { ScheduleService } from '../../core/schedule.service';

@Component({
  selector: 'app-schedule-page',
  imports: [
    FormsModule, RouterLink, DatePipe,
    NzCalendarModule, NzBadgeModule, NzRadioModule, NzButtonModule, NzIconModule, NzTagModule
  ],
  template: `
    <div class="page-header">
      <h2>Lịch học</h2>
      <nz-radio-group [ngModel]="mode()" (ngModelChange)="onMode($event)" nzButtonStyle="solid">
        <label nz-radio-button nzValue="month">Tháng</label>
        <label nz-radio-button nzValue="week">Tuần</label>
      </nz-radio-group>
    </div>

    @if (mode() === 'month') {
      <nz-calendar [(nzValue)]="monthValue" (nzPanelChange)="onPanelChange($event)">
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
            <div class="day-head">{{ weekdays[d.date.getDay()] }}<br /><span class="muted">{{ d.date | date: 'dd/MM' }}</span></div>
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
  `,
  styles: `
    .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .cell { display: flex; flex-direction: column; gap: 2px; }
    .ev { font-size: 11px; padding: 1px 4px; background: #e6f4ff; border-radius: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ev.cancelled, .day-ev.cancelled { text-decoration: line-through; opacity: 0.6; }
    .week-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .flip { transform: rotate(180deg); }
    .week-grid { display: grid; grid-template-columns: repeat(7, minmax(120px, 1fr)); gap: 8px; overflow-x: auto; }
    .day-col { background: #fafafa; border-radius: 6px; padding: 8px; min-height: 160px; }
    .day-head { text-align: center; font-weight: 600; margin-bottom: 8px; }
    .day-ev { display: flex; flex-direction: column; background: #e6f4ff; border-radius: 4px; padding: 4px 6px; margin-bottom: 6px; font-size: 12px; }
    .day-ev small { color: rgba(0,0,0,0.45); }
    .empty { text-align: center; color: rgba(0,0,0,0.25); }
    .muted { color: rgba(0,0,0,0.45); }
  `
})
export class SchedulePage {
  private readonly scheduleService = inject(ScheduleService);
  protected readonly weekdays = WEEKDAY_LABELS;

  protected readonly mode = signal<'month' | 'week'>('month');
  protected monthValue = new Date();
  protected readonly anchor = signal<Date>(new Date());
  protected readonly sessionsByDate = signal<Record<string, CalendarSession[]>>({});

  protected readonly weekStart = signal<Date>(startOfWeek(new Date()));
  protected readonly weekEnd = signal<Date>(addDays(startOfWeek(new Date()), 6));
  protected readonly weekDays = signal<{ date: Date; iso: string }[]>([]);

  constructor() {
    this.loadMonth(this.monthValue);
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

  protected sessionsOn(date: Date): CalendarSession[] {
    return this.sessionsByDate()[iso(date)] ?? [];
  }

  protected daySessions(isoDate: string): CalendarSession[] {
    return this.sessionsByDate()[isoDate] ?? [];
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
      return { date: d, iso: iso(d) };
    }));
    this.fetch(start, end);
  }

  private fetch(from: Date, to: Date): void {
    this.scheduleService.getRange(iso(from), iso(to)).subscribe(list => {
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
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
