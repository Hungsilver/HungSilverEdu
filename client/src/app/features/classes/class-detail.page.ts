import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
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
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzTimePickerModule } from 'ng-zorro-antd/time-picker';
import { NzUploadModule, NzUploadFile } from 'ng-zorro-antd/upload';
import { AuthService } from '../../core/auth.service';
import { ClassesService } from '../../core/classes.service';
import {
  CalendarSession, ClassDetail, ClassStudentOverview, RosterItem, ScheduleSlot, Student,
  StudentImportPreview, StudentImportResult, TuitionInvoice, Warnings, WEEKDAY_LABELS
} from '../../core/models';
import { ScheduleService } from '../../core/schedule.service';
import { toDateOnly, toTimeOnly } from '../../core/date-util';
import { StudentsService } from '../../core/students.service';
import { TuitionService } from '../../core/tuition.service';
import { WarningsService } from '../../core/warnings.service';
import { ScreenService } from '../../core/screen.service';
import { ClassFormModal } from './class-form-modal';
import { PageHeader } from '../../shared/page-header';
import { StudentHomeworkModal } from '../../shared/student-homework-modal';
import { SessionExams } from '../sessions/session-exams';
import { SessionMaterials } from '../sessions/session-materials';

@Component({
  selector: 'app-class-detail-page',
  imports: [
    FormsModule, RouterLink, DatePipe, DecimalPipe,
    NzCardModule, NzGridModule, NzStatisticModule, NzTableModule, NzButtonModule, NzIconModule,
    NzSelectModule, NzTagModule, NzModalModule, NzDatePickerModule, NzInputModule, NzFormModule,
    NzPopconfirmModule, NzTimePickerModule, NzUploadModule, NzCheckboxModule, NzAlertModule,
    NzTabsModule, NzDescriptionsModule, NzTooltipModule, PageHeader, ClassFormModal,
    SessionExams, SessionMaterials, StudentHomeworkModal
  ],
  template: `
    <a routerLink="/classes" class="back"><nz-icon nzType="arrow-left" /> Danh sách lớp</a>

    @if (detail(); as c) {
      <app-page-header [title]="c.name" subtitle="Chi tiết lớp học" icon="book">
        <div class="actions">
          @if (canManage()) {
            <button nz-button (click)="classEditOpen.set(true)"><nz-icon nzType="edit" /> Sửa lớp</button>
          }
          <a nz-button routerLink="/evaluations"><nz-icon nzType="audit" /> Đánh giá tháng</a>
          <button nz-button nzType="primary" (click)="openCreateSession()"><nz-icon nzType="plus" /> Tạo buổi học</button>
          @if (canManage()) {
            <button nz-button (click)="generateOpen.set(true)"><nz-icon nzType="calendar" /> Sinh buổi theo lịch</button>
            <button nz-button (click)="openImport()"><nz-icon nzType="file-text" /> Nhập Excel</button>
          }
        </div>
      </app-page-header>

      <app-class-form-modal [(open)]="classEditOpen" [classId]="id()" (saved)="onClassEdited()" />

      <nz-tabs nzType="line" class="detail-tabs">

        <!-- Tab 1: Thông tin cơ bản -->
        <nz-tab nzTitle="Thông tin cơ bản">
          @if (c.subjectName || c.gradeBand) {
            <div class="tags-line">
              @if (c.subjectName) { <nz-tag nzColor="blue"><nz-icon nzType="book" /> {{ c.subjectName }}</nz-tag> }
              @if (c.gradeBand) { <nz-tag nzColor="geekblue">{{ c.gradeBand }}</nz-tag> }
            </div>
          }
          <nz-row [nzGutter]="[16, 16]" class="mb">
            <nz-col [nzXs]="8"><nz-card><nz-statistic [nzValue]="c.currentSize" [nzSuffix]="'/' + c.maxCapacity" nzTitle="Sĩ số" /></nz-card></nz-col>
            <nz-col [nzXs]="8"><nz-card><nz-statistic [nzValue]="c.averageScore ?? 0" nzTitle="Điểm TB lớp" /></nz-card></nz-col>
            <nz-col [nzXs]="8"><nz-card><nz-statistic [nzValue]="c.attendanceRate" nzSuffix="%" nzTitle="Chuyên cần" /></nz-card></nz-col>
          </nz-row>
          <nz-card>
            <nz-descriptions nzBordered [nzColumn]="{ xs: 1, sm: 2, lg: 3 }">
              <nz-descriptions-item nzTitle="Mã lớp">{{ c.classCode }}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Tên lớp">{{ c.name }}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Giáo viên">{{ c.teacherName || '—' }}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Môn học">{{ c.subjectName || '—' }}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Khối">{{ c.gradeName || '—' }}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Cơ sở">{{ c.branchName || c.branchCode || '—' }}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Học phí">{{ c.tuitionFee | number:'1.0-0' }} đ</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Lịch học">{{ c.schedule || '—' }}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Trạng thái">
                <nz-tag [nzColor]="c.isActive ? 'green' : 'red'">{{ c.isActive ? 'Đang mở' : 'Đã đóng' }}</nz-tag>
              </nz-descriptions-item>
            </nz-descriptions>
          </nz-card>

          <!-- Cảnh báo -->
          <nz-card class="mt" [nzTitle]="warnTitle">
            <ng-template #warnTitle>
              <nz-icon nzType="warning" /> Cảnh báo của lớp
              @if (warnings(); as w) { @if (warnTotal(w) > 0) { <nz-tag nzColor="red" class="ml">{{ warnTotal(w) }}</nz-tag> } }
            </ng-template>
            @if (warnings(); as w) {
              @if (warnTotal(w) === 0) {
                <p class="muted">Không có cảnh báo nào. 👍</p>
              } @else {
                @for (grp of warnGroups(w); track grp.label) {
                  @if (grp.items.length) {
                    <div class="warn-group">
                      <div class="warn-head"><nz-icon [nzType]="grp.icon" /> {{ grp.label }} <span class="muted">({{ grp.items.length }})</span></div>
                      @for (it of grp.items; track it.studentId + it.detail) {
                        <div class="warn-item">
                          <a [routerLink]="['/students', it.studentId]">{{ it.studentName }}</a>
                          <span class="muted"> — {{ it.detail }}</span>
                        </div>
                      }
                    </div>
                  }
                }
              }
            } @else { <p class="muted">Đang tải…</p> }
          </nz-card>
        </nz-tab>

        <!-- Tab 2: Lịch học -->
        <nz-tab nzTitle="Lịch học">
          @if (canManage()) {
            <nz-card nzTitle="Khung giờ lặp tuần">
              @for (slot of slots(); track slot.id) {
                <div class="row-item">
                  <span>{{ weekdays[slot.dayOfWeek] }} · {{ slot.startTime }}–{{ slot.endTime }}</span>
                  <button nz-button nzType="link" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa khung giờ" aria-label="Xóa khung giờ" (click)="removeSlot(slot)"><nz-icon nzType="delete" /></button>
                </div>
              } @empty { <p class="muted">Chưa có khung giờ.</p> }
              <div class="slot-add">
                <nz-select class="wk" [(ngModel)]="slotDay">
                  @for (d of [1,2,3,4,5,6,0]; track d) { <nz-option [nzValue]="d" [nzLabel]="weekdays[d]" /> }
                </nz-select>
                <nz-time-picker [(ngModel)]="slotStart" nzFormat="HH:mm" />
                <nz-time-picker [(ngModel)]="slotEnd" nzFormat="HH:mm" />
                <button nz-button nzType="dashed" (click)="addSlot()">Thêm khung giờ</button>
              </div>
            </nz-card>
          } @else {
            <nz-card nzTitle="Khung giờ lặp tuần">
              @for (slot of slots(); track slot.id) {
                <div class="row-item">
                  <span>{{ weekdays[slot.dayOfWeek] }} · {{ slot.startTime }}–{{ slot.endTime }}</span>
                </div>
              } @empty { <p class="muted">Chưa có khung giờ.</p> }
            </nz-card>
          }
        </nz-tab>

        <!-- Tab 3: Buổi học -->
        <nz-tab nzTitle="Buổi học">
          <nz-card nzTitle="Danh sách buổi học">
            @for (s of sessions(); track s.id) {
              <div class="row-item">
                <a [routerLink]="['/sessions', s.id]">Buổi {{ s.sessionNumber }} · {{ s.sessionDate | date: 'dd/MM/yyyy' }}</a>
                @if (s.status === 'Cancelled') { <nz-tag nzColor="red">Hủy</nz-tag> }
                @else if (s.status === 'Completed') { <nz-tag nzColor="green">Xong</nz-tag> }
                @else { <nz-tag>Lên lịch</nz-tag> }
              </div>
            } @empty { <p class="muted">Chưa có buổi học.</p> }
          </nz-card>

          <!-- Bài tập = ĐỀ tương tác (HS làm trực tiếp, tự chấm) + Tài liệu giao cho lớp — dùng chung component với màn buổi học. -->
          <app-session-exams [classId]="id()" [subjectId]="c.subjectId" [subjectName]="c.subjectName"
            cardTitle="Bài tập (đề đã giao)" emptyText="Lớp này chưa được giao đề nào" />

          <app-session-materials [classId]="id()" [subjectId]="c.subjectId" [subjectName]="c.subjectName"
            cardTitle="Tài liệu đã giao" emptyText="Lớp này chưa được giao tài liệu nào" />
        </nz-tab>

        <!-- Tab 4: Học viên -->
        <nz-tab nzTitle="Học viên">
          <div class="enroll-row">
            <button nz-button nzType="primary" (click)="openCreateStudent()">
              <nz-icon nzType="user-add" /> Tạo học sinh
            </button>
            @if (canManage()) {
              <nz-select class="enroll-select" nzShowSearch nzPlaceHolder="Chọn học viên để thêm"
                [(ngModel)]="enrollStudentId">
                @for (s of enrollableStudents(); track s.id) {
                  <nz-option [nzValue]="s.id" [nzLabel]="s.fullName" />
                }
              </nz-select>
              <button nz-button [disabled]="!enrollStudentId" (click)="enroll()">Thêm vào lớp</button>
              <button nz-button (click)="openImport()"><nz-icon nzType="file-text" /> Nhập Excel</button>
            }
          </div>

          @if (screen.isMobile()) {
            <div class="mobile-card-list">
              @for (r of roster(); track r.studentId) {
                <nz-card>
                  <div class="card-header">
                    <a class="card-title" (click)="openStudentDetail(r)" style="cursor:pointer">{{ r.fullName }}</a>
                  </div>
                  <div class="card-field"><span class="label">Mã HV</span><span>{{ r.studentCode }}</span></div>
                  <div class="card-field"><span class="label">SĐT PH</span><span>{{ r.parentPhone || '—' }}</span></div>
                  <div class="card-field"><span class="label">Điểm thưởng</span>
                    <span>@if (ov(r.studentId); as o) { <nz-tag [nzColor]="o.rewardBalance >= 0 ? 'gold' : 'red'">{{ o.rewardBalance }}</nz-tag> } @else { — }</span>
                  </div>
                  <div class="card-field"><span class="label">Chuyên cần</span><span>{{ ov(r.studentId)?.attendanceRate ?? 0 }}%</span></div>
                  <div class="card-actions">
                    <button nz-button nzSize="small" (click)="openHomework(r)"><nz-icon nzType="file-search" /> BTVN</button>
                    @if (r.userId) {
                      <button nz-button nzSize="small" (click)="openResetPassword(r)"><nz-icon nzType="key" /> Đổi MK</button>
                    }
                    @if (canManage()) {
                      <button nz-button nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa khỏi lớp" aria-label="Xóa khỏi lớp" nz-popconfirm nzPopconfirmTitle="Xóa khỏi lớp?" (nzOnConfirm)="withdraw(r)"><nz-icon nzType="delete" /></button>
                    }
                  </div>
                </nz-card>
              }
            </div>
          } @else {
            <nz-table #rt [nzData]="roster()" [nzFrontPagination]="false" nzSize="small" [nzScroll]="{ x: '680px' }">
              <thead><tr>
                <th nzLeft>Họ tên</th><th>Mã HV</th><th>SĐT phụ huynh</th>
                <th>Điểm thưởng</th><th>Chuyên cần</th><th>BTVN</th>
                <th nzRight>Thao tác</th>
              </tr></thead>
              <tbody>
                @for (r of rt.data; track r.studentId) {
                  <tr>
                    <td nzLeft>
                      <a (click)="openStudentDetail(r)" style="cursor:pointer">{{ r.fullName }}</a>
                    </td>
                    <td>{{ r.studentCode }}</td>
                    <td>{{ r.parentPhone || '—' }}</td>
                    <td>
                      @if (ov(r.studentId); as o) {
                        <nz-tag [nzColor]="o.rewardBalance >= 0 ? 'gold' : 'red'">{{ o.rewardBalance }}</nz-tag>
                      } @else { <span class="muted">—</span> }
                    </td>
                    <td>{{ ov(r.studentId)?.attendanceRate ?? 0 }}%</td>
                    <td>{{ ov(r.studentId)?.homeworkRate ?? 0 }}%</td>
                    <td nzRight>
                      <button nz-button nzType="link" nzSize="small" (click)="openHomework(r)">
                        <nz-icon nzType="file-search" /> BTVN
                      </button>
                      @if (r.userId) {
                        <button nz-button nzType="link" nzSize="small" (click)="openResetPassword(r)">
                          <nz-icon nzType="key" /> Đổi MK
                        </button>
                      } @else {
                        <span class="muted no-acc">Chưa có TK</span>
                      }
                      @if (canManage()) {
                        <button nz-button nzType="link" nzSize="small" nzDanger nz-tooltip nzTooltipTitle="Xóa khỏi lớp" aria-label="Xóa khỏi lớp"
                                nz-popconfirm nzPopconfirmTitle="Xóa khỏi lớp?" (nzOnConfirm)="withdraw(r)"><nz-icon nzType="delete" /></button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
        </nz-tab>

      </nz-tabs>
    }

    <!-- Popup chi tiết học viên -->
    <nz-modal [nzVisible]="studentDetailOpen()" [nzTitle]="studentDetailTitle()" [nzWidth]="720"
      [nzFooter]="null" (nzOnCancel)="studentDetailOpen.set(false)">
      <ng-container *nzModalContent>
        @if (selectedRosterItem(); as r) {
          <nz-tabs nzType="line">
            <nz-tab nzTitle="Thông tin cơ bản">
              @if (studentDetailData(); as s) {
                <nz-descriptions nzBordered [nzColumn]="{ xs: 1, sm: 2 }">
                  <nz-descriptions-item nzTitle="Mã học viên">{{ s.studentCode }}</nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Họ tên">{{ s.fullName }}</nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Ngày sinh">{{ s.dateOfBirth || '—' }}</nz-descriptions-item>
                  <nz-descriptions-item nzTitle="SĐT">{{ s.phone || '—' }}</nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Phụ huynh">{{ s.parentName || '—' }}</nz-descriptions-item>
                  <nz-descriptions-item nzTitle="SĐT phụ huynh">{{ s.parentPhone || '—' }}</nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Email">{{ s.email || '—' }}</nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Trình độ">{{ s.englishLevel || '—' }}</nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Mục tiêu" [nzSpan]="2">{{ s.learningGoal || '—' }}</nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Ghi chú" [nzSpan]="2">{{ s.note || '—' }}</nz-descriptions-item>
                </nz-descriptions>
              } @else {
                <p class="muted">Đang tải…</p>
              }
            </nz-tab>

            <nz-tab nzTitle="Tình hình học tập">
              @if (ov(r.studentId); as o) {
                <nz-descriptions nzBordered [nzColumn]="2">
                  <nz-descriptions-item nzTitle="Chuyên cần">{{ o.attendanceRate }}%</nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Hoàn thành BTVN">{{ o.homeworkRate }}%</nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Điểm thưởng">
                    <nz-tag [nzColor]="o.rewardBalance >= 0 ? 'gold' : 'red'">{{ o.rewardBalance }}</nz-tag>
                  </nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Số buổi học">{{ o.totalRecords }}</nz-descriptions-item>
                </nz-descriptions>
                <div class="study-actions">
                  <button nz-button nzType="primary" (click)="openHomework(r)">
                    <nz-icon nzType="file-search" /> Xem chi tiết bài tập về nhà
                  </button>
                </div>
              } @else {
                <p class="muted">Chưa có dữ liệu tình hình học tập.</p>
              }
            </nz-tab>

            <nz-tab nzTitle="Học phí">
              @if (studentTuition().length > 0) {
                <nz-table [nzData]="studentTuition()" [nzFrontPagination]="false" nzSize="small">
                  <thead><tr><th>Tháng</th><th>Số tiền</th><th>Đã thanh toán</th><th>Trạng thái</th><th>Hạn</th></tr></thead>
                  <tbody>
                    @for (inv of studentTuition(); track inv.id) {
                      <tr>
                        <td>{{ inv.periodMonth }}/{{ inv.periodYear }}</td>
                        <td>{{ inv.amount | number:'1.0-0' }} đ</td>
                        <td>{{ inv.paidAmount | number:'1.0-0' }} đ</td>
                        <td>
                          @if (inv.status === 'Paid') { <nz-tag nzColor="green">Đã đóng</nz-tag> }
                          @else if (inv.status === 'Overdue') { <nz-tag nzColor="red">Quá hạn</nz-tag> }
                          @else { <nz-tag>Chưa đóng</nz-tag> }
                        </td>
                        <td>{{ inv.dueDate | date: 'dd/MM/yyyy' }}</td>
                      </tr>
                    }
                  </tbody>
                </nz-table>
              } @else {
                <p class="muted">Không có hóa đơn học phí trong lớp này.</p>
              }
            </nz-tab>
          </nz-tabs>
        }
      </ng-container>
    </nz-modal>

    <app-student-homework-modal [(open)]="homeworkOpen"
      [studentId]="homeworkStudentId()" [studentName]="homeworkStudentName()" [classId]="id()" />

    <!-- Nhập học viên từ Excel -->
    <nz-modal [nzVisible]="importOpen()" nzTitle="Nhập học viên từ Excel" [nzWidth]="680" [nzFooter]="null" (nzOnCancel)="importOpen.set(false)">
      <ng-container *nzModalContent>
        <div class="imp-bar">
          <button nz-button (click)="downloadTemplate()"><nz-icon nzType="file-text" /> Tải file mẫu</button>
          <nz-upload [nzBeforeUpload]="beforeUpload" [nzShowUploadList]="false" nzAccept=".xlsx">
            <button nz-button nzType="primary"><nz-icon nzType="link" /> Chọn file Excel</button>
          </nz-upload>
          <label nz-checkbox [(ngModel)]="createAccounts">Tạo tài khoản đăng nhập cho HS</label>
        </div>
        @if (importPreview(); as p) {
          <p class="muted">Hợp lệ: <strong>{{ p.validCount }}</strong> · Lỗi: <strong>{{ p.invalidCount }}</strong></p>
          <nz-table [nzData]="p.rows" [nzFrontPagination]="false" nzSize="small" [nzScroll]="{ y: '240px' }">
            <thead><tr><th>Dòng</th><th>Họ tên</th><th>SĐT PH</th><th>Trạng thái</th></tr></thead>
            <tbody>
              @for (r of p.rows; track r.rowNumber) {
                <tr>
                  <td>{{ r.rowNumber }}</td>
                  <td>{{ r.fullName || '—' }}</td>
                  <td>{{ r.parentPhone || '—' }}</td>
                  <td>
                    @if (r.isValid) { <nz-tag nzColor="green">OK</nz-tag> }
                    @else { <nz-tag nzColor="red">{{ r.error }}</nz-tag> }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
          <div class="imp-actions">
            <button nz-button nzType="primary" [nzLoading]="importBusy()" [disabled]="p.validCount === 0" (click)="doImport()">
              Nhập {{ p.validCount }} học viên
            </button>
          </div>
        }
        @if (importResult(); as res) {
          <nz-alert nzType="success" class="mt"
            [nzMessage]="'Đã nhập ' + res.created + ' học viên'
              + (res.accountsCreated ? (' · tạo ' + res.accountsCreated + ' tài khoản') : '')
              + (res.skipped ? (' · bỏ qua ' + res.skipped + ' dòng lỗi') : '') + '.'" />
        }
      </ng-container>
    </nz-modal>

    <!-- Tạo học sinh (+ tài khoản) -->
    <nz-modal [nzVisible]="studentOpen()" nzTitle="Tạo học sinh trong lớp" [nzOkLoading]="studentBusy()"
      nzOkText="Tạo" (nzOnOk)="createStudent()" (nzOnCancel)="studentOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical">
          <nz-form-item><nz-form-label nzRequired>Họ tên học sinh</nz-form-label>
            <nz-form-control><input nz-input [(ngModel)]="sFullName" name="sn" /></nz-form-control></nz-form-item>
          <div nz-row [nzGutter]="12">
            <div nz-col [nzSpan]="12">
              <nz-form-item><nz-form-label>Phụ huynh</nz-form-label>
                <nz-form-control><input nz-input [(ngModel)]="sParentName" name="spn" /></nz-form-control></nz-form-item>
            </div>
            <div nz-col [nzSpan]="12">
              <nz-form-item><nz-form-label>SĐT phụ huynh</nz-form-label>
                <nz-form-control><input nz-input [(ngModel)]="sParentPhone" name="spp" /></nz-form-control></nz-form-item>
            </div>
          </div>
          <nz-form-item>
            <label nz-checkbox [(ngModel)]="sCreateAccount" name="sca">Cấp tài khoản đăng nhập cho học sinh</label>
          </nz-form-item>
          @if (sCreateAccount) {
            <nz-form-item>
              <nz-form-label>Mật khẩu (tùy chọn)</nz-form-label>
              <nz-form-control>
                <input nz-input [(ngModel)]="sPassword" name="sp" type="text" placeholder="Trống = mật khẩu mặc định" autocomplete="new-password" />
              </nz-form-control>
              <div class="acc-hint">Tên đăng nhập = Mã học viên (tự sinh). Học sinh bị buộc đổi mật khẩu ở lần đăng nhập đầu.</div>
            </nz-form-item>
          }
        </form>
      </ng-container>
    </nz-modal>

    <!-- Đổi mật khẩu học sinh -->
    <nz-modal [nzVisible]="resetOpen()" [nzTitle]="'Đổi mật khẩu: ' + (resetTarget()?.fullName || '')"
      [nzOkLoading]="resetBusy()" nzOkText="Đổi mật khẩu" (nzOnOk)="resetPassword()" (nzOnCancel)="resetOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical">
          <nz-form-item><nz-form-label nzRequired>Mật khẩu mới</nz-form-label>
            <nz-form-control>
              <input nz-input [(ngModel)]="newPassword" name="np" type="text" placeholder="tối thiểu 8 ký tự" autocomplete="new-password" />
            </nz-form-control></nz-form-item>
          <p class="muted">Cung cấp mật khẩu mới này cho học sinh để đăng nhập.</p>
        </form>
      </ng-container>
    </nz-modal>

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
    .acc-hint { color: var(--hs-text-muted); font-size: 12px; margin-top: 4px; }
    .back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .tags-line { margin: 0 0 12px; display: flex; gap: 8px; flex-wrap: wrap; }
    .detail-tabs { margin-top: 4px; }
    .mt { margin-top: 16px; }
    .mb { margin-bottom: 16px; }
    .ml { margin-left: 8px; }
    .warn-group { padding: 6px 0; border-bottom: 1px solid var(--hs-border); }
    .warn-group:last-child { border-bottom: none; }
    .warn-head { font-weight: 600; margin-bottom: 4px; }
    .warn-item { font-size: 13px; padding: 2px 0 2px 22px; }
    .enroll-row { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .enroll-select { min-width: 220px; flex: 1; }
    .row-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--hs-border); }
    .row-item:last-child { border-bottom: none; }
    .slot-add { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
    .wk { min-width: 110px; }
    .full { width: 100%; }
    .mb-form { margin-bottom: 12px; }
    .st { min-width: 110px; }
    .muted { color: var(--hs-text-muted); }
    .imp-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
    .imp-actions { margin-top: 12px; text-align: right; }
    .no-acc { font-size: 12px; }
    .mobile-card-list { display: flex; flex-direction: column; gap: 8px; }
    .mobile-card-list nz-card { border-radius: 8px; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .card-title { font-weight: 600; font-size: 14px; }
    .card-field { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--hs-border); font-size: 13px; }
    .card-field:last-of-type { border-bottom: none; }
    .card-field .label { color: var(--hs-text-muted); }
    .card-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; align-items: center; }
    .study-actions { display: flex; justify-content: flex-end; margin-top: 12px; }
    @media (max-width: 768px) {
      .enroll-row { flex-direction: column; }
      .enroll-select { min-width: 100%; }
    }
  `
})
export class ClassDetailPage implements OnInit {
  readonly id = input.required<string>();

  protected readonly auth = inject(AuthService);
  protected readonly screen = inject(ScreenService);
  private readonly classesService = inject(ClassesService);
  private readonly scheduleService = inject(ScheduleService);
  private readonly studentsService = inject(StudentsService);
  private readonly warningsService = inject(WarningsService);
  private readonly tuitionService = inject(TuitionService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);
  protected readonly canManage = computed(() => this.auth.isAdmin() || this.auth.isTeacher());

  // Modal sửa lớp dùng chung (class-form-modal).
  protected readonly classEditOpen = signal(false);

  protected readonly weekdays = WEEKDAY_LABELS;

  protected readonly detail = signal<ClassDetail | null>(null);
  protected readonly roster = signal<RosterItem[]>([]);
  protected readonly overview = signal<ClassStudentOverview[]>([]);
  protected readonly sessions = signal<CalendarSession[]>([]);
  protected readonly slots = signal<ScheduleSlot[]>([]);
  protected readonly allStudents = signal<Student[]>([]);
  protected readonly warnings = signal<Warnings | null>(null);
  protected readonly busy = signal(false);

  protected warnTotal(w: Warnings): number {
    return w.consecutiveAbsences.length + w.missedHomework.length + w.scoreDrop.length + w.tuitionOverdue.length;
  }

  protected warnGroups(w: Warnings) {
    return [
      { label: 'Vắng liên tiếp', icon: 'user-delete', items: w.consecutiveAbsences },
      { label: 'Không làm BTVN', icon: 'close-circle', items: w.missedHomework },
      { label: 'Điểm giảm', icon: 'fall', items: w.scoreDrop },
      { label: 'Học phí quá hạn', icon: 'dollar', items: w.tuitionOverdue }
    ];
  }

  private readonly overviewMap = computed(() => new Map(this.overview().map(o => [o.studentId, o])));
  protected ov(studentId: string): ClassStudentOverview | undefined {
    return this.overviewMap().get(studentId);
  }

  // Import Excel học viên
  protected readonly importOpen = signal(false);
  protected readonly importBusy = signal(false);
  protected readonly importPreview = signal<StudentImportPreview | null>(null);
  protected readonly importResult = signal<StudentImportResult | null>(null);
  protected createAccounts = false;
  private importFile: File | null = null;

  // Tạo học sinh (+ tài khoản) trong lớp
  protected readonly studentOpen = signal(false);
  protected readonly studentBusy = signal(false);
  protected sFullName = '';
  protected sParentName = '';
  protected sParentPhone = '';
  protected sCreateAccount = false;
  protected sPassword = '';

  // Đổi mật khẩu học sinh
  protected readonly resetOpen = signal(false);
  protected readonly resetBusy = signal(false);
  protected readonly resetTarget = signal<RosterItem | null>(null);
  protected newPassword = '';

  // Popup chi tiết học viên
  protected readonly studentDetailOpen = signal(false);
  protected readonly selectedRosterItem = signal<RosterItem | null>(null);
  protected readonly studentDetailData = signal<Student | null>(null);
  protected readonly studentTuition = signal<TuitionInvoice[]>([]);
  protected readonly homeworkOpen = signal(false);
  protected readonly homeworkStudentId = signal<string | null>(null);
  protected readonly homeworkStudentName = signal<string | null>(null);
  protected readonly studentDetailTitle = computed(() => {
    const r = this.selectedRosterItem();
    return r ? `Chi tiết: ${r.fullName}` : 'Chi tiết học viên';
  });

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
    if (this.canManage()) {
      this.studentsService.getPaged({ page: 1, pageSize: 200 }).subscribe(r => this.allStudents.set(r.items));
    }
  }

  /** Sau khi sửa lớp ở modal dùng chung → nạp lại chi tiết. */
  protected onClassEdited(): void {
    this.reload();
  }

  private reload(): void {
    const id = this.id();
    this.classesService.getById(id).subscribe(c => this.detail.set(c));
    this.classesService.getRoster(id).subscribe(r => this.roster.set(r));
    this.classesService.getOverview(id).subscribe(o => this.overview.set(o));
    const from = new Date(); from.setDate(from.getDate() - 30);
    const to = new Date(); to.setDate(to.getDate() + 60);
    this.scheduleService.getRange(toDateOnly(from), toDateOnly(to), id).subscribe(s => this.sessions.set(s));
    if (this.canManage()) this.scheduleService.getSlots(id).subscribe(s => this.slots.set(s));
    this.warningsService.getWarnings(id).subscribe(w => this.warnings.set(w));
  }

  // ---- Popup chi tiết học viên ----
  protected openStudentDetail(r: RosterItem): void {
    this.selectedRosterItem.set(r);
    this.studentDetailData.set(null);
    this.studentTuition.set([]);
    this.studentDetailOpen.set(true);
    this.studentsService.getById(r.studentId).subscribe(s => this.studentDetailData.set(s));
    const classId = this.id();
    this.tuitionService.getByStudent(r.studentId).subscribe(invs => {
      this.studentTuition.set(invs.filter(inv => inv.classId === classId));
    });
  }

  protected openHomework(r: RosterItem): void {
    this.homeworkStudentId.set(r.studentId);
    this.homeworkStudentName.set(r.fullName);
    this.homeworkOpen.set(true);
  }

  // ---- Import Excel ----
  protected openImport(): void {
    this.importFile = null;
    this.importPreview.set(null);
    this.importResult.set(null);
    this.createAccounts = false;
    this.importOpen.set(true);
  }

  protected downloadTemplate(): void {
    this.classesService.downloadImportTemplate().subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mau-hoc-vien.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  protected beforeUpload = (file: NzUploadFile): boolean => {
    this.importFile = file as unknown as File;
    this.importResult.set(null);
    this.classesService.importPreview(this.id(), this.importFile).subscribe({
      next: p => this.importPreview.set(p),
      error: (e: HttpErrorResponse) => this.message.error(e.error?.message ?? e.message ?? 'Đọc file thất bại.')
    });
    return false;
  };

  protected doImport(): void {
    if (!this.importFile) return;
    this.importBusy.set(true);
    this.classesService.importCommit(this.id(), this.importFile, this.createAccounts).subscribe({
      next: res => {
        this.importBusy.set(false);
        this.importResult.set(res);
        this.importPreview.set(null);
        this.message.success(`Đã nhập ${res.created} học viên.`);
        this.reloadPublic();
      },
      error: (e: HttpErrorResponse) => { this.importBusy.set(false); this.message.error(e.error?.message ?? e.message ?? 'Nhập thất bại.'); }
    });
  }

  private reloadPublic(): void {
    const id = this.id();
    this.classesService.getRoster(id).subscribe(r => this.roster.set(r));
    this.classesService.getOverview(id).subscribe(o => this.overview.set(o));
  }

  // ---- Tạo học sinh + tài khoản ----
  protected openCreateStudent(): void {
    this.sFullName = '';
    this.sParentName = '';
    this.sParentPhone = '';
    this.sCreateAccount = false;
    this.sPassword = '';
    this.studentOpen.set(true);
  }

  protected createStudent(): void {
    if (!this.sFullName.trim()) { this.message.warning('Nhập họ tên học sinh.'); return; }
    this.studentBusy.set(true);
    this.classesService.createStudent(this.id(), {
      fullName: this.sFullName.trim(),
      parentName: this.sParentName.trim() || null,
      parentPhone: this.sParentPhone.trim() || null,
      createAccount: this.sCreateAccount,
      password: this.sCreateAccount ? (this.sPassword || null) : null
    }).subscribe({
      next: res => {
        this.studentBusy.set(false);
        this.studentOpen.set(false);
        if (res.accountCreated) this.message.success(`Đã tạo học sinh + tài khoản "${res.userName}".`);
        else if (res.accountError) this.message.warning(`Đã tạo học sinh nhưng chưa cấp được tài khoản: ${res.accountError}`);
        else this.message.success('Đã tạo học sinh.');
        this.reloadPublic();
      },
      error: (e: HttpErrorResponse) => { this.studentBusy.set(false); this.message.error(e.error?.message ?? e.message ?? 'Tạo học sinh thất bại.'); }
    });
  }

  // ---- Đổi mật khẩu học sinh ----
  protected openResetPassword(r: RosterItem): void {
    this.resetTarget.set(r);
    this.newPassword = '';
    this.resetOpen.set(true);
  }

  protected resetPassword(): void {
    const r = this.resetTarget();
    if (!r) return;
    if (!this.newPassword) { this.message.warning('Nhập mật khẩu mới.'); return; }
    this.resetBusy.set(true);
    this.studentsService.resetPassword(r.studentId, this.newPassword).subscribe({
      next: () => { this.resetBusy.set(false); this.resetOpen.set(false); this.message.success('Đã đổi mật khẩu học sinh.'); },
      error: (e: HttpErrorResponse) => { this.resetBusy.set(false); this.message.error(e.error?.message ?? e.message ?? 'Đổi mật khẩu thất bại.'); }
    });
  }

  protected enroll(): void {
    if (!this.enrollStudentId) return;
    this.classesService.enroll(this.id(), this.enrollStudentId).subscribe({
      next: () => { this.message.success('Đã thêm vào lớp.'); this.enrollStudentId = null; this.reload(); },
      error: (e: HttpErrorResponse) => this.message.error(e.error?.message ?? e.message ?? 'Thêm thất bại.')
    });
  }

  protected withdraw(r: RosterItem): void {
    this.classesService.withdraw(this.id(), r.studentId).subscribe({
      next: () => { this.message.success('Đã xóa khỏi lớp.'); this.reload(); },
      error: (e: HttpErrorResponse) => this.message.error(e.error?.message ?? e.message ?? 'Thất bại.')
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
      classId: this.id(), sessionDate: toDateOnly(this.newDate), startTime: null, endTime: null,
      topic: this.newTopic || null, sessionNumber: null
    }).subscribe({
      next: s => { this.busy.set(false); this.createOpen.set(false); this.router.navigate(['/sessions', s.id]); },
      error: (e: HttpErrorResponse) => { this.busy.set(false); this.message.error(e.error?.message ?? e.message ?? 'Tạo thất bại.'); }
    });
  }

  protected generate(): void {
    if (this.genRange.length !== 2) { this.message.warning('Chọn khoảng ngày.'); return; }
    this.busy.set(true);
    this.scheduleService.generateSessions(this.id(), { fromDate: toDateOnly(this.genRange[0]), toDate: toDateOnly(this.genRange[1]) }).subscribe({
      next: count => { this.busy.set(false); this.generateOpen.set(false); this.message.success(`Đã sinh ${count} buổi học.`); this.reload(); },
      error: (e: HttpErrorResponse) => { this.busy.set(false); this.message.error(e.error?.message ?? e.message ?? 'Sinh buổi thất bại.'); }
    });
  }

  protected addSlot(): void {
    if (!this.slotStart || !this.slotEnd) { this.message.warning('Chọn giờ bắt đầu và kết thúc.'); return; }
    this.scheduleService.addSlot({
      classId: this.id(), dayOfWeek: this.slotDay, startTime: toTimeOnly(this.slotStart), endTime: toTimeOnly(this.slotEnd)
    }).subscribe({
      next: () => { this.message.success('Đã thêm khung giờ.'); this.slotStart = null; this.slotEnd = null; this.reload(); },
      error: (e: HttpErrorResponse) => this.message.error(e.error?.message ?? e.message ?? 'Thất bại.')
    });
  }

  protected removeSlot(slot: ScheduleSlot): void {
    this.scheduleService.removeSlot(slot.id).subscribe({
      next: () => { this.message.success('Đã xóa khung giờ.'); this.reload(); },
      error: (e: HttpErrorResponse) => this.message.error(e.error?.message ?? e.message ?? 'Thất bại.')
    });
  }
}
