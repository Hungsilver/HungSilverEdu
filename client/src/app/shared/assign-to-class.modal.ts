import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ClassesService } from '../core/classes.service';
import { ExamService } from '../core/exam.service';
import { MaterialsService } from '../core/materials.service';
import { ScheduleService } from '../core/schedule.service';
import { AssignExamRequest, AssignMaterialRequest, ClassListItem, ExamDeliveryMode } from '../core/models';

/** Đối tượng cần giao: tài liệu (học viên đọc) hoặc đề (học viên làm bài, tự chấm). */
export type AssignKind = 'material' | 'exam';

/** Một buổi học để gắn lượt giao (tùy chọn) — chỉ nạp khi đã chọn lớp. */
interface SessionOption { id: string; label: string; }

/**
 * Giao TÀI LIỆU hoặc ĐỀ cho lớp — dùng chung ở Kho tài liệu, màn Đề & Bài tập,
 * màn buổi học và trang chi tiết lớp (truyền sẵn `classId`/`sessionId` khi có ngữ cảnh).
 *
 * Ràng buộc nghiệp vụ phản ánh ngay trên UI để không phải chờ lỗi từ server:
 * bài làm trên lớp bắt buộc có thời gian làm; "không giới hạn thời gian" chỉ dành cho bài về nhà
 * và bắt buộc có hạn nộp.
 */
@Component({
  selector: 'app-assign-to-class-modal',
  imports: [
    FormsModule, NzModalModule, NzFormModule, NzSelectModule, NzRadioModule, NzDatePickerModule,
    NzInputModule, NzInputNumberModule, NzCheckboxModule, NzButtonModule, NzIconModule, NzAlertModule
  ],
  template: `
    <nz-modal
      [nzVisible]="visible"
      [nzTitle]="kind === 'exam' ? 'Giao đề cho lớp' : 'Giao tài liệu cho lớp'"
      [nzOkText]="'Giao'"
      [nzOkLoading]="submitting()"
      [nzWidth]="560"
      (nzOnCancel)="close()"
      (nzOnOk)="submit()">
      <div *nzModalContent>
        <nz-alert
          nzType="info"
          [nzMessage]="(kind === 'exam' ? 'Đề: ' : 'Tài liệu: ') + (targetTitle || '')"
          [nzDescription]="kind === 'exam'
            ? 'Học viên làm trực tiếp trên hệ thống, bài được chấm tự động.'
            : 'Học viên đọc trong Portal, hệ thống ghi nhận ai đã xem.'"
          style="margin-bottom:16px" />

        <nz-form-item>
          <nz-form-label nzRequired>Lớp nhận</nz-form-label>
          <nz-form-control>
            <nz-select [(ngModel)]="classId" (ngModelChange)="onClassChange()" nzPlaceHolder="Chọn lớp" nzShowSearch>
              @for (c of classes(); track c.id) {
                <nz-option [nzValue]="c.id" [nzLabel]="c.name + ' · ' + c.currentSize + ' học viên'" />
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label>Gắn vào buổi học</nz-form-label>
          <nz-form-control nzExtra="Bỏ trống nếu giao cho cả lớp, không gắn buổi cụ thể.">
            <nz-select [(ngModel)]="sessionId" nzAllowClear nzPlaceHolder="— Không gắn buổi —" [nzDisabled]="!classId">
              @for (s of sessions(); track s.id) {
                <nz-option [nzValue]="s.id" [nzLabel]="s.label" />
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>

        @if (kind === 'exam') {
          <nz-form-item>
            <nz-form-label>Hình thức</nz-form-label>
            <nz-form-control>
              <nz-radio-group [(ngModel)]="mode" (ngModelChange)="onModeChange()">
                <label nz-radio-button nzValue="InClass">Làm trên lớp</label>
                <label nz-radio-button nzValue="Homework">Bài tập về nhà</label>
              </nz-radio-group>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzRequired>Mở lúc</nz-form-label>
            <nz-form-control>
              <nz-date-picker [(ngModel)]="openAt" nzShowTime nzFormat="dd/MM/yyyy HH:mm" style="width:100%" />
            </nz-form-control>
          </nz-form-item>

          @if (mode === 'Homework') {
            <nz-form-item>
              <nz-form-label [nzRequired]="noTimeLimit">Hạn nộp</nz-form-label>
              <nz-form-control [nzExtra]="noTimeLimit ? 'Bắt buộc khi không giới hạn thời gian làm bài.' : ''">
                <nz-date-picker [(ngModel)]="closeAt" nzShowTime nzFormat="dd/MM/yyyy HH:mm" style="width:100%" />
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-control>
                <label nz-checkbox [(ngModel)]="noTimeLimit">Không giới hạn thời gian làm bài</label>
              </nz-form-control>
            </nz-form-item>
          }

          @if (!noTimeLimit) {
            <nz-form-item>
              <nz-form-label>Thời gian làm (phút)</nz-form-label>
              <nz-form-control nzExtra="Bỏ trống ⇒ dùng thời lượng mặc định của đề.">
                <nz-input-number [(ngModel)]="durationMinutes" [nzMin]="1" [nzMax]="300" style="width:150px" />
              </nz-form-control>
            </nz-form-item>
          }
        } @else {
          <nz-form-item>
            <nz-form-label>Ghi chú cho học viên</nz-form-label>
            <nz-form-control>
              <textarea nz-input rows="3" [(ngModel)]="note" maxlength="1000"
                        placeholder="vd: Đọc trước phần Vocabulary trước buổi sau."></textarea>
            </nz-form-control>
          </nz-form-item>
        }
      </div>
    </nz-modal>
  `
})
export class AssignToClassModal {
  private readonly classesService = inject(ClassesService);
  private readonly scheduleService = inject(ScheduleService);
  private readonly materialsService = inject(MaterialsService);
  private readonly examService = inject(ExamService);
  private readonly message = inject(NzMessageService);

  @Input() visible = false;
  @Input() kind: AssignKind = 'material';
  /** Id tài liệu hoặc id đề tùy `kind`. */
  @Input() targetId: string | null = null;
  @Input() targetTitle = '';
  /** Ngữ cảnh có sẵn (mở từ màn buổi học / chi tiết lớp) — khóa sẵn lớp/buổi. */
  @Input() presetClassId: string | null = null;
  @Input() presetSessionId: string | null = null;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly assigned = new EventEmitter<void>();

  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly sessions = signal<SessionOption[]>([]);
  protected readonly submitting = signal(false);

  protected classId: string | null = null;
  protected sessionId: string | null = null;
  protected mode: ExamDeliveryMode = 'InClass';
  protected openAt: Date | null = new Date();
  protected closeAt: Date | null = null;
  protected noTimeLimit = false;
  protected durationMinutes: number | null = null;
  protected note = '';

  /** Gọi từ component cha ngay trước khi bật `visible`. */
  open(): void {
    this.classId = this.presetClassId;
    this.sessionId = this.presetSessionId;
    this.mode = 'InClass';
    this.openAt = new Date();
    this.closeAt = null;
    this.noTimeLimit = false;
    this.durationMinutes = null;
    this.note = '';
    this.sessions.set([]);

    if (this.classes().length === 0) {
      this.classesService.getPaged({ page: 1, pageSize: 200 }).subscribe(r => this.classes.set(r.items));
    }
    if (this.classId) this.loadSessions(this.classId);
  }

  protected close(): void {
    this.closed.emit();
  }

  protected onClassChange(): void {
    this.sessionId = null;
    if (this.classId) this.loadSessions(this.classId);
    else this.sessions.set([]);
  }

  /** Bài làm trên lớp bắt buộc có giờ ⇒ tắt "không giới hạn" khi đổi về hình thức này. */
  protected onModeChange(): void {
    if (this.mode === 'InClass') this.noTimeLimit = false;
  }

  /** Buổi học quanh thời điểm hiện tại của lớp (±60 ngày) — đủ để gắn lượt giao mà không cần API mới. */
  private loadSessions(classId: string): void {
    const today = new Date();
    const from = new Date(today); from.setDate(from.getDate() - 60);
    const to = new Date(today); to.setDate(to.getDate() + 60);

    this.scheduleService.getRange(isoDate(from), isoDate(to), classId).subscribe({
      next: list => this.sessions.set(list.map(s => ({
        id: s.id,
        label: `${formatDate(s.sessionDate)}${s.startTime ? ' · ' + s.startTime.slice(0, 5) : ''}`
      }))),
      error: () => this.sessions.set([])
    });
  }

  protected submit(): void {
    if (!this.targetId) return;
    if (!this.classId) { this.message.error('Chọn lớp nhận.'); return; }

    if (this.kind === 'material') {
      this.run(this.materialsService.assign(this.targetId, {
        classId: this.classId,
        classSessionId: this.sessionId,
        note: this.note.trim() || null
      } satisfies AssignMaterialRequest), 'Đã giao tài liệu cho lớp.');
      return;
    }

    if (!this.openAt) { this.message.error('Chọn thời điểm mở đề.'); return; }
    if (this.noTimeLimit && !this.closeAt) { this.message.error('Bài không giới hạn thời gian phải có hạn nộp.'); return; }
    if (this.closeAt && this.closeAt <= this.openAt) { this.message.error('Hạn nộp phải sau thời điểm mở đề.'); return; }

    this.run(this.examService.assign(this.targetId, {
      classId: this.classId,
      classSessionId: this.sessionId,
      mode: this.mode,
      durationMinutes: this.noTimeLimit ? null : this.durationMinutes,
      openAt: this.openAt.toISOString(),
      closeAt: this.closeAt ? this.closeAt.toISOString() : null,
      noTimeLimit: this.noTimeLimit
    } satisfies AssignExamRequest), 'Đã giao đề cho lớp.');
  }

  private run(op: { subscribe: (o: { next: () => void; error: (e: HttpErrorResponse) => void }) => void }, okMessage: string): void {
    this.submitting.set(true);
    op.subscribe({
      next: () => {
        this.submitting.set(false);
        this.message.success(okMessage);
        this.assigned.emit();
        this.close();
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.message.error(err.error?.message ?? err.message);
      }
    });
  }
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
