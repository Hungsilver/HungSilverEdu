import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimePickerModule } from 'ng-zorro-antd/time-picker';
import { AuthService } from '../../core/auth.service';
import { ClassesService } from '../../core/classes.service';
import { CalendarSession, ClassDetail, RosterItem, ScheduleSlot, Student, WEEKDAY_LABELS } from '../../core/models';
import { ScheduleService } from '../../core/schedule.service';
import { StudentsService } from '../../core/students.service';

@Component({
  selector: 'app-class-detail-page',
  imports: [
    FormsModule, RouterLink, DatePipe,
    NzCardModule, NzGridModule, NzStatisticModule, NzTableModule, NzButtonModule, NzIconModule,
    NzSelectModule, NzTagModule, NzModalModule, NzDatePickerModule, NzInputModule, NzFormModule,
    NzPopconfirmModule, NzTimePickerModule
  ],
  template: `
    <a routerLink="/classes" class="back"><nz-icon nzType="arrow-left" /> Danh sách lớp</a>

    @if (detail(); as c) {
      <div class="page-header">
        <h2>{{ c.name }}</h2>
        <div class="actions">
          <button nz-button nzType="primary" (click)="openCreateSession()"><nz-icon nzType="plus" /> Tạo buổi học</button>
          @if (auth.isAdmin()) {
            <button nz-button (click)="generateOpen.set(true)"><nz-icon nzType="calendar" /> Sinh buổi theo lịch</button>
          }
        </div>
      </div>

      <nz-row [nzGutter]="[16, 16]">
        <nz-col [nzXs]="8"><nz-card><nz-statistic [nzValue]="c.currentSize" [nzSuffix]="'/' + c.maxCapacity" nzTitle="Sĩ số" /></nz-card></nz-col>
        <nz-col [nzXs]="8"><nz-card><nz-statistic [nzValue]="c.averageScore ?? 0" nzTitle="Điểm TB lớp" /></nz-card></nz-col>
        <nz-col [nzXs]="8"><nz-card><nz-statistic [nzValue]="c.attendanceRate" nzSuffix="%" nzTitle="Chuyên cần" /></nz-card></nz-col>
      </nz-row>

      <nz-row [nzGutter]="[16, 16]" class="mt">
        <nz-col [nzXs]="24" [nzLg]="14">
          <nz-card nzTitle="Danh sách học viên">
            @if (auth.isAdmin()) {
              <div class="enroll-row">
                <nz-select class="enroll-select" nzShowSearch nzPlaceHolder="Chọn học viên để thêm"
                  [(ngModel)]="enrollStudentId">
                  @for (s of enrollableStudents(); track s.id) {
                    <nz-option [nzValue]="s.id" [nzLabel]="s.fullName" />
                  }
                </nz-select>
                <button nz-button nzType="primary" [disabled]="!enrollStudentId" (click)="enroll()">Thêm vào lớp</button>
              </div>
            }
            <nz-table #rt [nzData]="roster()" [nzFrontPagination]="false" nzSize="small" [nzScroll]="{ x: '480px' }">
              <thead><tr><th nzLeft>Họ tên</th><th>SĐT phụ huynh</th><th>Ngày ghi danh</th>@if (auth.isAdmin()) {<th nzRight></th>}</tr></thead>
              <tbody>
                @for (r of rt.data; track r.studentId) {
                  <tr>
                    <td nzLeft><a [routerLink]="['/students', r.studentId]">{{ r.fullName }}</a></td>
                    <td>{{ r.parentPhone || '—' }}</td>
                    <td>{{ r.enrolledOn | date: 'dd/MM/yyyy' }}</td>
                    @if (auth.isAdmin()) {
                      <td nzRight>
                        <button nz-button nzType="link" nzSize="small" nzDanger
                                nz-popconfirm nzPopconfirmTitle="Xóa khỏi lớp?" (nzOnConfirm)="withdraw(r)">Xóa</button>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-card>
        </nz-col>

        <nz-col [nzXs]="24" [nzLg]="10">
          <nz-card nzTitle="Buổi học">
            @for (s of sessions(); track s.id) {
              <div class="row-item">
                <a [routerLink]="['/sessions', s.id]">Buổi {{ s.sessionNumber }} · {{ s.sessionDate | date: 'dd/MM' }}</a>
                @if (s.status === 'Cancelled') { <nz-tag nzColor="red">Hủy</nz-tag> }
                @else if (s.status === 'Completed') { <nz-tag nzColor="green">Xong</nz-tag> }
                @else { <nz-tag>Lên lịch</nz-tag> }
              </div>
            } @empty { <p class="muted">Chưa có buổi học.</p> }
          </nz-card>

          @if (auth.isAdmin()) {
            <nz-card nzTitle="Khung giờ lặp tuần" class="mt">
              @for (slot of slots(); track slot.id) {
                <div class="row-item">
                  <span>{{ weekdays[slot.dayOfWeek] }} · {{ slot.startTime }}–{{ slot.endTime }}</span>
                  <button nz-button nzType="link" nzSize="small" nzDanger (click)="removeSlot(slot)"><nz-icon nzType="delete" /></button>
                </div>
              } @empty { <p class="muted">Chưa có khung giờ.</p> }
              <div class="slot-add">
                <nz-select class="wk" [(ngModel)]="slotDay">
                  @for (d of [1,2,3,4,5,6,0]; track d) { <nz-option [nzValue]="d" [nzLabel]="weekdays[d]" /> }
                </nz-select>
                <nz-time-picker [(ngModel)]="slotStart" nzFormat="HH:mm" />
                <nz-time-picker [(ngModel)]="slotEnd" nzFormat="HH:mm" />
                <button nz-button nzType="dashed" (click)="addSlot()">Thêm</button>
              </div>
            </nz-card>
          }
        </nz-col>
      </nz-row>
    }

    <!-- Tạo buổi học -->
    <nz-modal [nzVisible]="createOpen()" nzTitle="Tạo buổi học" [nzOkLoading]="busy()" (nzOnOk)="createSession()" (nzOnCancel)="createOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical">
          <nz-form-item><nz-form-label nzRequired>Ngày</nz-form-label>
            <nz-form-control><nz-date-picker [(ngModel)]="newDate" name="d" nzFormat="dd/MM/yyyy" class="full" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Chủ đề</nz-form-label>
            <nz-form-control><input nz-input [(ngModel)]="newTopic" name="t" /></nz-form-control></nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <!-- Sinh buổi theo lịch -->
    <nz-modal [nzVisible]="generateOpen()" nzTitle="Sinh buổi theo khung giờ" [nzOkLoading]="busy()" (nzOnOk)="generate()" (nzOnCancel)="generateOpen.set(false)">
      <ng-container *nzModalContent>
        <p>Chọn khoảng ngày để sinh buổi học từ khung giờ lặp tuần:</p>
        <nz-range-picker [(ngModel)]="genRange" nzFormat="dd/MM/yyyy" class="full" />
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .mt { margin-top: 16px; }
    .enroll-row { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .enroll-select { min-width: 220px; flex: 1; }
    .row-item { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
    .row-item:last-child { border-bottom: none; }
    .slot-add { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
    .wk { min-width: 110px; }
    .full { width: 100%; }
    .muted { color: rgba(0,0,0,0.45); }
  `
})
export class ClassDetailPage implements OnInit {
  readonly id = input.required<string>();

  protected readonly auth = inject(AuthService);
  private readonly classesService = inject(ClassesService);
  private readonly scheduleService = inject(ScheduleService);
  private readonly studentsService = inject(StudentsService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);

  protected readonly weekdays = WEEKDAY_LABELS;

  protected readonly detail = signal<ClassDetail | null>(null);
  protected readonly roster = signal<RosterItem[]>([]);
  protected readonly sessions = signal<CalendarSession[]>([]);
  protected readonly slots = signal<ScheduleSlot[]>([]);
  protected readonly allStudents = signal<Student[]>([]);
  protected readonly busy = signal(false);

  protected readonly enrollableStudents = computed(() => {
    const enrolled = new Set(this.roster().map(r => r.studentId));
    return this.allStudents().filter(s => !enrolled.has(s.id));
  });

  protected enrollStudentId: string | null = null;
  protected createOpen = signal(false);
  protected generateOpen = signal(false);
  protected newDate: Date | null = null;
  protected newTopic = '';
  protected genRange: Date[] = [];
  protected slotDay = 1;
  protected slotStart: Date | null = null;
  protected slotEnd: Date | null = null;

  ngOnInit(): void {
    this.reload();
    if (this.auth.isAdmin()) {
      this.studentsService.getPaged({ page: 1, pageSize: 200 }).subscribe(r => this.allStudents.set(r.items));
    }
  }

  private reload(): void {
    const id = this.id();
    this.classesService.getById(id).subscribe(c => this.detail.set(c));
    this.classesService.getRoster(id).subscribe(r => this.roster.set(r));
    const from = new Date(); from.setDate(from.getDate() - 30);
    const to = new Date(); to.setDate(to.getDate() + 60);
    this.scheduleService.getRange(iso(from), iso(to), id).subscribe(s => this.sessions.set(s));
    if (this.auth.isAdmin()) this.scheduleService.getSlots(id).subscribe(s => this.slots.set(s));
  }

  protected enroll(): void {
    if (!this.enrollStudentId) return;
    this.classesService.enroll(this.id(), this.enrollStudentId).subscribe({
      next: () => { this.message.success('Đã thêm vào lớp.'); this.enrollStudentId = null; this.reload(); },
      error: (e: HttpErrorResponse) => this.message.error(e.error?.detail ?? 'Thêm thất bại.')
    });
  }

  protected withdraw(r: RosterItem): void {
    this.classesService.withdraw(this.id(), r.studentId).subscribe({
      next: () => { this.message.success('Đã xóa khỏi lớp.'); this.reload(); },
      error: (e: HttpErrorResponse) => this.message.error(e.error?.detail ?? 'Thất bại.')
    });
  }

  protected openCreateSession(): void {
    this.newDate = new Date();
    this.newTopic = '';
    this.createOpen.set(true);
  }

  protected createSession(): void {
    if (!this.newDate) { this.message.warning('Chọn ngày.'); return; }
    this.busy.set(true);
    this.scheduleService.createSession({
      classId: this.id(), sessionDate: iso(this.newDate), startTime: null, endTime: null,
      topic: this.newTopic || null, sessionNumber: null
    }).subscribe({
      next: s => { this.busy.set(false); this.createOpen.set(false); this.router.navigate(['/sessions', s.id]); },
      error: (e: HttpErrorResponse) => { this.busy.set(false); this.message.error(e.error?.detail ?? 'Tạo thất bại.'); }
    });
  }

  protected generate(): void {
    if (this.genRange.length !== 2) { this.message.warning('Chọn khoảng ngày.'); return; }
    this.busy.set(true);
    this.scheduleService.generateSessions(this.id(), { fromDate: iso(this.genRange[0]), toDate: iso(this.genRange[1]) }).subscribe({
      next: count => { this.busy.set(false); this.generateOpen.set(false); this.message.success(`Đã sinh ${count} buổi học.`); this.reload(); },
      error: (e: HttpErrorResponse) => { this.busy.set(false); this.message.error(e.error?.detail ?? 'Sinh buổi thất bại.'); }
    });
  }

  protected addSlot(): void {
    if (!this.slotStart || !this.slotEnd) { this.message.warning('Chọn giờ bắt đầu và kết thúc.'); return; }
    this.scheduleService.addSlot({
      classId: this.id(), dayOfWeek: this.slotDay, startTime: time(this.slotStart), endTime: time(this.slotEnd)
    }).subscribe({
      next: () => { this.message.success('Đã thêm khung giờ.'); this.slotStart = null; this.slotEnd = null; this.reload(); },
      error: (e: HttpErrorResponse) => this.message.error(e.error?.detail ?? 'Thất bại.')
    });
  }

  protected removeSlot(slot: ScheduleSlot): void {
    this.scheduleService.removeSlot(slot.id).subscribe({
      next: () => { this.message.success('Đã xóa khung giờ.'); this.reload(); },
      error: (e: HttpErrorResponse) => this.message.error(e.error?.detail ?? 'Thất bại.')
    });
  }
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function time(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
}
