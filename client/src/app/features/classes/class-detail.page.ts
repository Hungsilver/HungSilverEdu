import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
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
import { NzUploadModule, NzUploadFile } from 'ng-zorro-antd/upload';
import { AuthService } from '../../core/auth.service';
import { ClassesService } from '../../core/classes.service';
import {
  Assignment, CalendarSession, ClassDetail, ClassStudentOverview, CreateAssignmentRequest, Material,
  RosterItem, ScheduleSlot, Student, StudentImportPreview, StudentImportResult, SubmissionStatus,
  SubmissionStatusInfo, SUBMISSION_STATUS_LABELS, Warnings, WEEKDAY_LABELS
} from '../../core/models';
import { AssignmentsService } from '../../core/assignments.service';
import { MaterialsService } from '../../core/materials.service';
import { ScheduleService } from '../../core/schedule.service';
import { toDateOnly, toTimeOnly } from '../../core/date-util';
import { StudentsService } from '../../core/students.service';
import { WarningsService } from '../../core/warnings.service';
import { ScreenService } from '../../core/screen.service';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-class-detail-page',
  imports: [
    FormsModule, RouterLink, DatePipe,
    NzCardModule, NzGridModule, NzStatisticModule, NzTableModule, NzButtonModule, NzIconModule,
    NzSelectModule, NzTagModule, NzModalModule, NzDatePickerModule, NzInputModule, NzFormModule,
    NzPopconfirmModule, NzTimePickerModule, NzUploadModule, NzCheckboxModule, NzAlertModule, PageHeader
  ],
  template: `
    <a routerLink="/classes" class="back"><nz-icon nzType="arrow-left" /> Danh sách lớp</a>

    @if (detail(); as c) {
      <app-page-header [title]="c.name" subtitle="Chi tiết lớp học" icon="book">
        <div class="actions">
          <a nz-button routerLink="/evaluations"><nz-icon nzType="audit" /> Đánh giá tháng</a>
          <button nz-button nzType="primary" (click)="openCreateSession()"><nz-icon nzType="plus" /> Tạo buổi học</button>
          @if (canManage()) {
            <button nz-button (click)="generateOpen.set(true)"><nz-icon nzType="calendar" /> Sinh buổi theo lịch</button>
            <button nz-button (click)="openImport()"><nz-icon nzType="file-text" /> Nhập Excel</button>
          }
        </div>
      </app-page-header>

      @if (c.subjectName || c.gradeBand) {
        <div class="tags-line">
          @if (c.subjectName) { <nz-tag nzColor="blue"><nz-icon nzType="book" /> {{ c.subjectName }}</nz-tag> }
          @if (c.gradeBand) { <nz-tag nzColor="geekblue">{{ c.gradeBand }}</nz-tag> }
        </div>
      }

      <nz-row [nzGutter]="[16, 16]">
        <nz-col [nzXs]="8"><nz-card><nz-statistic [nzValue]="c.currentSize" [nzSuffix]="'/' + c.maxCapacity" nzTitle="Sĩ số" /></nz-card></nz-col>
        <nz-col [nzXs]="8"><nz-card><nz-statistic [nzValue]="c.averageScore ?? 0" nzTitle="Điểm TB lớp" /></nz-card></nz-col>
        <nz-col [nzXs]="8"><nz-card><nz-statistic [nzValue]="c.attendanceRate" nzSuffix="%" nzTitle="Chuyên cần" /></nz-card></nz-col>
      </nz-row>

      <nz-row [nzGutter]="[16, 16]" class="mt">
        <nz-col [nzXs]="24" [nzLg]="14">
          <nz-card nzTitle="Danh sách học viên">
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
              }
            </div>
            @if (screen.isMobile()) {
              <div class="mobile-card-list">
                @for (r of roster(); track r.studentId) {
                  <nz-card>
                    <div class="card-header">
                      <a class="card-title" [routerLink]="['/students', r.studentId]">{{ r.fullName }}</a>
                    </div>
                    <div class="card-field"><span class="label">SĐT PH</span><span>{{ r.parentPhone || '—' }}</span></div>
                    <div class="card-field"><span class="label">Điểm thưởng</span>
                      <span>@if (ov(r.studentId); as o) { <nz-tag [nzColor]="o.rewardBalance >= 0 ? 'gold' : 'red'">{{ o.rewardBalance }}</nz-tag> } @else { — }</span>
                    </div>
                    <div class="card-field"><span class="label">Chuyên cần</span><span>{{ ov(r.studentId)?.attendanceRate ?? 0 }}%</span></div>
                    <div class="card-field"><span class="label">BTVN</span><span>{{ ov(r.studentId)?.homeworkRate ?? 0 }}%</span></div>
                    <div class="card-actions">
                      @if (r.userId) {
                        <button nz-button nzSize="small" (click)="openResetPassword(r)"><nz-icon nzType="key" /> Đổi MK</button>
                      } @else {
                        <span class="muted" style="font-size:12px">Chưa có TK</span>
                      }
                      @if (canManage()) {
                        <button nz-button nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Xóa khỏi lớp?" (nzOnConfirm)="withdraw(r)">Xóa</button>
                      }
                    </div>
                  </nz-card>
                }
              </div>
            } @else {
              <nz-table #rt [nzData]="roster()" [nzFrontPagination]="false" nzSize="small" [nzScroll]="{ x: '620px' }">
                <thead><tr>
                  <th nzLeft>Họ tên</th><th>SĐT phụ huynh</th>
                  <th>Điểm thưởng</th><th>Chuyên cần</th><th>BTVN</th>
                  <th nzRight>Thao tác</th>
                </tr></thead>
                <tbody>
                  @for (r of rt.data; track r.studentId) {
                    <tr>
                      <td nzLeft><a [routerLink]="['/students', r.studentId]">{{ r.fullName }}</a></td>
                      <td>{{ r.parentPhone || '—' }}</td>
                      <td>
                        @if (ov(r.studentId); as o) {
                          <nz-tag [nzColor]="o.rewardBalance >= 0 ? 'gold' : 'red'">{{ o.rewardBalance }}</nz-tag>
                        } @else { <span class="muted">—</span> }
                      </td>
                      <td>{{ ov(r.studentId)?.attendanceRate ?? 0 }}%</td>
                      <td>{{ ov(r.studentId)?.homeworkRate ?? 0 }}%</td>
                      <td nzRight>
                        @if (r.userId) {
                          <button nz-button nzType="link" nzSize="small" (click)="openResetPassword(r)">
                            <nz-icon nzType="key" /> Đổi MK
                          </button>
                        } @else {
                          <span class="muted no-acc">Chưa có TK</span>
                        }
                        @if (canManage()) {
                          <button nz-button nzType="link" nzSize="small" nzDanger
                                  nz-popconfirm nzPopconfirmTitle="Xóa khỏi lớp?" (nzOnConfirm)="withdraw(r)">Xóa</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            }
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

          @if (canManage()) {
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

      <nz-card nzTitle="Bài tập" class="mt">
        <button nz-button nzType="primary" class="mb" (click)="openAssignment()"><nz-icon nzType="plus" /> Giao bài</button>
        @if (screen.isMobile()) {
          <div class="mobile-card-list">
            @for (a of assignments(); track a.id) {
              <nz-card>
                <div class="card-header">
                  <span class="card-title">{{ a.title }}</span>
                  <span>{{ a.submittedCount }}/{{ a.totalCount }}</span>
                </div>
                <div class="card-field"><span class="label">Học liệu</span><span>{{ a.materialTitle || '—' }}</span></div>
                <div class="card-field"><span class="label">Hạn nộp</span><span>{{ a.dueDate ? (a.dueDate | date: 'dd/MM/yyyy') : '—' }}</span></div>
                <div class="card-actions">
                  <button nz-button nzSize="small" (click)="openSubmissions(a)">Xem nộp</button>
                  <button nz-button nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Xóa bài tập?" (nzOnConfirm)="deleteAssignment(a)"><nz-icon nzType="delete" /> Xóa</button>
                </div>
              </nz-card>
            } @empty {
              <span class="muted">Chưa giao bài nào.</span>
            }
          </div>
        } @else {
          <nz-table #at [nzData]="assignments()" [nzFrontPagination]="false" nzSize="small" [nzScroll]="{ x: '560px' }">
            <thead><tr><th nzLeft>Tiêu đề</th><th>Học liệu</th><th>Hạn nộp</th><th>Đã nộp</th><th nzRight></th></tr></thead>
            <tbody>
              @for (a of at.data; track a.id) {
                <tr>
                  <td nzLeft>{{ a.title }}</td>
                  <td>{{ a.materialTitle || '—' }}</td>
                  <td>{{ a.dueDate ? (a.dueDate | date: 'dd/MM/yyyy') : '—' }}</td>
                  <td>{{ a.submittedCount }}/{{ a.totalCount }}</td>
                  <td nzRight>
                    <button nz-button nzType="link" nzSize="small" (click)="openSubmissions(a)">Xem nộp</button>
                    <button nz-button nzType="link" nzSize="small" nzDanger
                            nz-popconfirm nzPopconfirmTitle="Xóa bài tập?" (nzOnConfirm)="deleteAssignment(a)"><nz-icon nzType="delete" /></button>
                  </td>
                </tr>
              } @empty { <tr><td colspan="5"><span class="muted">Chưa giao bài nào.</span></td></tr> }
            </tbody>
          </nz-table>
        }
      </nz-card>

      <!-- Cảnh báo của lớp (gộp từ trang Cảnh báo — Đợt 7) -->
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
    }

    <!-- Giao bài tập -->
    <nz-modal [nzVisible]="assignOpen()" nzTitle="Giao bài tập" [nzOkLoading]="assignBusy()"
      (nzOnOk)="createAssignment()" (nzOnCancel)="assignOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical">
          <nz-form-item><nz-form-label nzRequired>Tiêu đề</nz-form-label>
            <nz-form-control><input nz-input [(ngModel)]="aTitle" name="t" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Học liệu (nguồn bài)</nz-form-label>
            <nz-form-control>
              <nz-select [(ngModel)]="aMaterialId" name="m" nzAllowClear nzShowSearch nzPlaceHolder="Chọn học liệu" class="full">
                @for (m of materials(); track m.id) { <nz-option [nzValue]="m.id" [nzLabel]="m.title" /> }
              </nz-select>
            </nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Buổi học (tùy chọn)</nz-form-label>
            <nz-form-control>
              <nz-select [(ngModel)]="aSessionId" name="s" nzAllowClear nzPlaceHolder="Gắn buổi học" class="full">
                @for (s of sessions(); track s.id) { <nz-option [nzValue]="s.id" [nzLabel]="'Buổi ' + s.sessionNumber" /> }
              </nz-select>
            </nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Hạn nộp</nz-form-label>
            <nz-form-control><nz-date-picker [(ngModel)]="aDueDate" name="d" nzFormat="dd/MM/yyyy" class="full" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Hướng dẫn</nz-form-label>
            <nz-form-control><textarea nz-input [(ngModel)]="aInstructions" name="i" rows="2"></textarea></nz-form-control></nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <!-- Tình hình nộp bài -->
    <nz-modal [nzVisible]="subsOpen()" [nzTitle]="'Tình hình nộp: ' + (currentAssignment()?.title || '')"
      [nzFooter]="null" (nzOnCancel)="subsOpen.set(false)" [nzWidth]="560">
      <ng-container *nzModalContent>
        <nz-table [nzData]="submissions()" [nzFrontPagination]="false" nzSize="small">
          <thead><tr><th>Học sinh</th><th>Trạng thái</th><th>Ngày nộp</th></tr></thead>
          <tbody>
            @for (s of submissions(); track s.studentId) {
              <tr>
                <td>{{ s.fullName }} @if (s.link) { <a [href]="s.link" target="_blank" class="muted">(link)</a> }</td>
                <td>
                  <nz-select [ngModel]="s.status" (ngModelChange)="setStatus(s, $event)" nzSize="small" class="st">
                    @for (st of statuses; track st) { <nz-option [nzValue]="st" [nzLabel]="statusLabels[st]" /> }
                  </nz-select>
                </td>
                <td>{{ s.submittedOn ? (s.submittedOn | date: 'dd/MM') : '—' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </ng-container>
    </nz-modal>

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
            <label nz-checkbox [(ngModel)]="sCreateAccount" name="sca">Tạo tài khoản đăng nhập cho học sinh</label>
          </nz-form-item>
          @if (sCreateAccount) {
            <div nz-row [nzGutter]="12">
              <div nz-col [nzSpan]="12">
                <nz-form-item><nz-form-label nzRequired>Tên đăng nhập</nz-form-label>
                  <nz-form-control><input nz-input [(ngModel)]="sUserName" name="su" placeholder="vd: hs_an" autocomplete="off" /></nz-form-control></nz-form-item>
              </div>
              <div nz-col [nzSpan]="12">
                <nz-form-item><nz-form-label nzRequired>Mật khẩu</nz-form-label>
                  <nz-form-control><input nz-input [(ngModel)]="sPassword" name="sp" type="text" placeholder="tối thiểu 8 ký tự" autocomplete="new-password" /></nz-form-control></nz-form-item>
              </div>
            </div>
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
    .back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .tags-line { margin: -4px 0 12px; display: flex; gap: 8px; flex-wrap: wrap; }
    .mt { margin-top: 16px; }
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
    .mb { margin-bottom: 12px; }
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
  `
})
export class ClassDetailPage implements OnInit {
  readonly id = input.required<string>();

  protected readonly auth = inject(AuthService);
  protected readonly screen = inject(ScreenService);
  private readonly classesService = inject(ClassesService);
  private readonly scheduleService = inject(ScheduleService);
  private readonly studentsService = inject(StudentsService);
  private readonly assignmentsService = inject(AssignmentsService);
  private readonly materialsService = inject(MaterialsService);
  private readonly warningsService = inject(WarningsService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);
  protected readonly canManage = computed(() => this.auth.isAdmin() || this.auth.isTeacher());

  protected readonly weekdays = WEEKDAY_LABELS;
  protected readonly statuses = [SubmissionStatus.NotSubmitted, SubmissionStatus.Submitted, SubmissionStatus.Late];
  protected readonly statusLabels = SUBMISSION_STATUS_LABELS;

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

  // Bài tập & nộp bài
  protected readonly assignments = signal<Assignment[]>([]);
  protected readonly materials = signal<Material[]>([]);
  protected readonly submissions = signal<SubmissionStatusInfo[]>([]);
  protected readonly currentAssignment = signal<Assignment | null>(null);
  protected readonly assignOpen = signal(false);
  protected readonly assignBusy = signal(false);
  protected readonly subsOpen = signal(false);
  protected aTitle = '';
  protected aMaterialId: string | null = null;
  protected aSessionId: string | null = null;
  protected aDueDate: Date | null = null;
  protected aInstructions = '';

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
  protected sUserName = '';
  protected sPassword = '';

  // Đổi mật khẩu học sinh
  protected readonly resetOpen = signal(false);
  protected readonly resetBusy = signal(false);
  protected readonly resetTarget = signal<RosterItem | null>(null);
  protected newPassword = '';

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
    this.loadAssignments();
    this.loadMaterials();
  }

  private loadAssignments(): void {
    this.assignmentsService.getByClass(this.id()).subscribe(a => this.assignments.set(a));
  }

  /** Học liệu chọn được khi giao bài = học liệu của lớp + thư viện chung. */
  private loadMaterials(): void {
    this.materialsService.getByClass(this.id()).subscribe(cls => {
      this.materialsService.getLibrary().subscribe(lib => this.materials.set([...cls, ...lib]));
    });
  }

  protected openAssignment(): void {
    this.aTitle = '';
    this.aMaterialId = null;
    this.aSessionId = null;
    this.aDueDate = null;
    this.aInstructions = '';
    this.assignOpen.set(true);
  }

  protected createAssignment(): void {
    if (!this.aTitle.trim()) { this.message.warning('Nhập tiêu đề bài tập.'); return; }
    const request: CreateAssignmentRequest = {
      classId: this.id(),
      classSessionId: this.aSessionId,
      materialId: this.aMaterialId,
      title: this.aTitle.trim(),
      instructions: this.aInstructions || null,
      dueDate: this.aDueDate ? toDateOnly(this.aDueDate) : null
    };
    this.assignBusy.set(true);
    this.assignmentsService.create(request).subscribe({
      next: () => { this.assignBusy.set(false); this.assignOpen.set(false); this.message.success('Đã giao bài.'); this.loadAssignments(); },
      error: (e: HttpErrorResponse) => { this.assignBusy.set(false); this.message.error(e.error?.message ?? e.message ?? 'Giao bài thất bại.'); }
    });
  }

  protected deleteAssignment(a: Assignment): void {
    this.assignmentsService.delete(a.id).subscribe({
      next: () => { this.message.success('Đã xóa bài tập.'); this.loadAssignments(); },
      error: (e: HttpErrorResponse) => this.message.error(e.error?.message ?? e.message ?? 'Xóa thất bại.')
    });
  }

  protected openSubmissions(a: Assignment): void {
    this.currentAssignment.set(a);
    this.submissions.set([]);
    this.assignmentsService.getSubmissions(a.id).subscribe(s => this.submissions.set(s));
    this.subsOpen.set(true);
  }

  protected setStatus(s: SubmissionStatusInfo, status: SubmissionStatus): void {
    const a = this.currentAssignment();
    if (!a) return;
    this.assignmentsService.setStatus(a.id, s.studentId, status).subscribe({
      next: () => {
        this.submissions.set(this.submissions().map(x => x.studentId === s.studentId ? { ...x, status } : x));
        this.loadAssignments();
      },
      error: (e: HttpErrorResponse) => this.message.error(e.error?.message ?? e.message ?? 'Cập nhật thất bại.')
    });
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

  /** Chọn file → xem trước (không upload tự động). */
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
    // làm mới roster + tình hình sau khi nhập
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
    this.sUserName = '';
    this.sPassword = '';
    this.studentOpen.set(true);
  }

  protected createStudent(): void {
    if (!this.sFullName.trim()) { this.message.warning('Nhập họ tên học sinh.'); return; }
    if (this.sCreateAccount) {
      if (!this.sUserName.trim()) { this.message.warning('Nhập tên đăng nhập.'); return; }
      if (!this.sPassword) { this.message.warning('Nhập mật khẩu.'); return; }
    }
    this.studentBusy.set(true);
    this.classesService.createStudent(this.id(), {
      fullName: this.sFullName.trim(),
      parentName: this.sParentName.trim() || null,
      parentPhone: this.sParentPhone.trim() || null,
      createAccount: this.sCreateAccount,
      userName: this.sCreateAccount ? this.sUserName.trim() : null,
      password: this.sCreateAccount ? this.sPassword : null
    }).subscribe({
      next: res => {
        this.studentBusy.set(false);
        this.studentOpen.set(false);
        this.message.success(res.accountCreated
          ? `Đã tạo học sinh + tài khoản "${res.userName}".`
          : 'Đã tạo học sinh.');
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
