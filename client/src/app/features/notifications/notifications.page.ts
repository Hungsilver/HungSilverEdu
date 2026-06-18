import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ClassesService } from '../../core/classes.service';
import {
  ClassListItem, CreateNotificationRequest, DELIVERY_STATUS_COLORS, DELIVERY_STATUS_LABELS,
  NotificationChannel, NotificationDelivery, NotificationDeliveryStatus, NotificationTargetScope, NotificationType,
  NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_TYPE_LABELS, Student
} from '../../core/models';
import { NotificationsService } from '../../core/notifications.service';
import { ScreenService } from '../../core/screen.service';
import { StudentsService } from '../../core/students.service';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-notifications-page',
  imports: [
    FormsModule,
    NzCardModule, NzFormModule, NzInputModule, NzSelectModule, NzCheckboxModule, NzRadioModule,
    NzButtonModule, NzTableModule, NzTagModule, NzIconModule, PageHeader
  ],
  template: `
    <app-page-header title="Thông báo" subtitle="Soạn & gửi cho phụ huynh/học sinh" icon="bell" />
    <nz-card nzTitle="Soạn thông báo">
      <form nz-form nzLayout="vertical">
        <nz-form-item><nz-form-label nzRequired>Tiêu đề</nz-form-label>
          <nz-form-control><input nz-input [(ngModel)]="title" name="title" /></nz-form-control></nz-form-item>
        <nz-form-item><nz-form-label nzRequired>Nội dung</nz-form-label>
          <nz-form-control><textarea nz-input [(ngModel)]="content" name="content" rows="4"></textarea></nz-form-control></nz-form-item>
        <nz-form-item><nz-form-label>Loại</nz-form-label>
          <nz-form-control>
            <nz-select [(ngModel)]="type" name="type" class="w240">
              @for (t of types; track t) { <nz-option [nzValue]="t" [nzLabel]="typeLabels[t]" /> }
            </nz-select>
          </nz-form-control></nz-form-item>
        <nz-form-item><nz-form-label nzRequired>Kênh gửi</nz-form-label>
          <nz-form-control>
            <label nz-checkbox [(ngModel)]="chEmail" name="e">Email</label>
            <label nz-checkbox [(ngModel)]="chZalo" name="z" class="ml">Zalo</label>
            <label nz-checkbox [(ngModel)]="chMessenger" name="m" class="ml">Messenger</label>
          </nz-form-control></nz-form-item>
        <nz-form-item><nz-form-label>Phạm vi</nz-form-label>
          <nz-form-control>
            <nz-radio-group [(ngModel)]="scope" name="scope">
              <label nz-radio nzValue="All">Tất cả lớp của tôi</label>
              <label nz-radio nzValue="Class">Một lớp</label>
              <label nz-radio nzValue="Student">Một học sinh</label>
            </nz-radio-group>
          </nz-form-control></nz-form-item>
        @if (scope === 'Class') {
          <nz-form-item><nz-form-control>
            <nz-select [(ngModel)]="classId" name="cid" nzShowSearch nzPlaceHolder="Chọn lớp" class="w240">
              @for (c of classes(); track c.id) { <nz-option [nzValue]="c.id" [nzLabel]="c.name" /> }
            </nz-select></nz-form-control></nz-form-item>
        }
        @if (scope === 'Student') {
          <nz-form-item><nz-form-control>
            <nz-select [(ngModel)]="studentId" name="sid" nzShowSearch nzPlaceHolder="Chọn học sinh" class="w240">
              @for (s of students(); track s.id) { <nz-option [nzValue]="s.id" [nzLabel]="s.fullName" /> }
            </nz-select></nz-form-control></nz-form-item>
        }
        <button nz-button nzType="primary" [nzLoading]="sending()" (click)="send()"><nz-icon nzType="bell" /> Gửi thông báo</button>
      </form>
    </nz-card>

    @if (result().length > 0) {
      <nz-card nzTitle="Kết quả gửi" class="mt">
        @if (screen.isMobile()) {
          <div class="mobile-card-list">
            @for (d of result(); track d.id) {
              <nz-card>
                <div class="card-header">
                  <span class="card-title">{{ d.studentName }}</span>
                  <nz-tag [nzColor]="statusColors[d.status]">{{ statusLabels[d.status] }}</nz-tag>
                </div>
                <div class="card-field"><span class="label">Kênh</span><span>{{ channelLabels[d.channel] }}</span></div>
                @if (d.errorMessage) {
                  <div class="card-field"><span class="label">Lỗi</span><span class="muted">{{ d.errorMessage }}</span></div>
                }
                @if (d.status === Manual) {
                  <div class="card-actions">
                    <button nz-button nzSize="small" (click)="copy(d)"><nz-icon nzType="copy" /> Sao chép</button>
                  </div>
                }
              </nz-card>
            }
          </div>
        } @else {
          <nz-table [nzData]="result()" [nzFrontPagination]="false" nzSize="small" [nzScroll]="{ x: '600px' }">
            <thead><tr><th nzLeft>Học sinh</th><th>Kênh</th><th>Trạng thái</th><th nzRight></th></tr></thead>
            <tbody>
              @for (d of result(); track d.id) {
                <tr>
                  <td nzLeft>{{ d.studentName }}</td>
                  <td>{{ channelLabels[d.channel] }}</td>
                  <td>
                    <nz-tag [nzColor]="statusColors[d.status]">{{ statusLabels[d.status] }}</nz-tag>
                    @if (d.errorMessage) { <span class="muted">{{ d.errorMessage }}</span> }
                  </td>
                  <td nzRight>
                    @if (d.status === Manual) {
                      <button nz-button nzType="link" nzSize="small" (click)="copy(d)"><nz-icon nzType="copy" /> Sao chép</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </nz-card>
    }
  `,
  styles: `
    .w240 { width: 240px; max-width: 70vw; }
    .ml { margin-left: 12px; }
    .mt { margin-top: 16px; }
    .muted { color: var(--hs-text-muted); margin-left: 8px; font-size: 12px; }
    .mobile-card-list { display: flex; flex-direction: column; gap: 12px; }
    .mobile-card-list nz-card { border-radius: 8px; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .card-title { font-weight: 600; font-size: 15px; }
    .card-field { display: flex; gap: 8px; margin-bottom: 4px; font-size: 13px; }
    .card-field .label { color: var(--hs-text-muted); min-width: 40px; }
    .card-actions { margin-top: 8px; }
  `
})
export class NotificationsPage {
  private readonly notificationsService = inject(NotificationsService);
  private readonly classesService = inject(ClassesService);
  private readonly studentsService = inject(StudentsService);
  private readonly message = inject(NzMessageService);
  protected readonly screen = inject(ScreenService);

  protected readonly Manual = NotificationDeliveryStatus.Manual;
  protected readonly types = [NotificationType.Schedule, NotificationType.DayOff, NotificationType.Report, NotificationType.Tuition, NotificationType.Homework];
  protected readonly typeLabels = NOTIFICATION_TYPE_LABELS;
  protected readonly channelLabels = NOTIFICATION_CHANNEL_LABELS;
  protected readonly statusLabels = DELIVERY_STATUS_LABELS;
  protected readonly statusColors = DELIVERY_STATUS_COLORS;

  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly students = signal<Student[]>([]);
  protected readonly result = signal<NotificationDelivery[]>([]);
  protected readonly sending = signal(false);

  protected title = '';
  protected content = '';
  protected type = NotificationType.Schedule;
  protected chEmail = false;
  protected chZalo = true;
  protected chMessenger = false;
  protected scope: NotificationTargetScope = 'Class';
  protected classId: string | null = null;
  protected studentId: string | null = null;

  constructor() {
    this.classesService.getPaged({ page: 1, pageSize: 200 }).subscribe(r => this.classes.set(r.items));
    this.studentsService.getPaged({ page: 1, pageSize: 200 }).subscribe(r => this.students.set(r.items));
  }

  protected send(): void {
    if (!this.title.trim() || !this.content.trim()) { this.message.warning('Nhập tiêu đề và nội dung.'); return; }
    const channels: NotificationChannel[] = [];
    if (this.chEmail) channels.push(NotificationChannel.Email);
    if (this.chZalo) channels.push(NotificationChannel.Zalo);
    if (this.chMessenger) channels.push(NotificationChannel.Messenger);
    if (channels.length === 0) { this.message.warning('Chọn ít nhất một kênh.'); return; }

    const request: CreateNotificationRequest = {
      title: this.title.trim(), content: this.content.trim(), type: this.type, channels,
      scope: this.scope,
      classId: this.scope === 'Class' ? this.classId : null,
      studentId: this.scope === 'Student' ? this.studentId : null
    };

    this.sending.set(true);
    this.notificationsService.send(request).subscribe({
      next: r => { this.sending.set(false); this.result.set(r.deliveries); this.message.success(`Đã xử lý ${r.deliveries.length} lượt gửi.`); },
      error: (err: HttpErrorResponse) => { this.sending.set(false); this.message.error(err.error?.message ?? err.message ??'Gửi thất bại.'); }
    });
  }

  protected copy(d: NotificationDelivery): void {
    navigator.clipboard.writeText(d.renderedContent).then(
      () => this.message.success('Đã sao chép.'),
      () => this.message.error('Không sao chép được.')
    );
  }
}
