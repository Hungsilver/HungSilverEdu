import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ExamService } from '../../core/exam.service';
import { EXAM_STATUS_LABELS, ExamGenerationMode, ExamGenerationResult, ExamListItem, GenerateExamRequest } from '../../core/models';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-exam-list-page',
  imports: [
    FormsModule, DatePipe, RouterLink,
    NzTableModule, NzButtonModule, NzIconModule, NzTagModule, NzModalModule, NzFormModule, NzInputModule,
    NzInputNumberModule, NzRadioModule, NzSwitchModule, NzSpinModule, NzAlertModule, NzPopconfirmModule, PageHeader
  ],
  template: `
    <app-page-header [title]="headerTitle()" subtitle="Bộ đề trắc nghiệm sinh từ tài liệu" icon="file-text">
      <a nz-button routerLink="/materials"><nz-icon nzType="arrow-left" /> Kho tài liệu</a>
      <button nz-button nzType="primary" (click)="openGenerate()"><nz-icon nzType="robot" /> Tạo đề bằng AI</button>
    </app-page-header>

    <nz-table #table [nzData]="exams()" [nzLoading]="loading()" [nzFrontPagination]="false">
      <thead>
        <tr><th>Tên đề</th><th>Trạng thái</th><th>Số câu</th><th>Thời gian</th><th>Nguồn</th><th>Ngày tạo</th><th nzRight>Thao tác</th></tr>
      </thead>
      <tbody>
        @for (e of table.data; track e.id) {
          <tr class="row" (click)="open(e)">
            <td>{{ e.title }}</td>
            <td><nz-tag [nzColor]="e.status === 'Published' ? 'success' : 'default'">{{ statusLabels[e.status] }}</nz-tag></td>
            <td>{{ e.questionCount }}</td>
            <td>{{ e.durationMinutes }}'</td>
            <td>{{ e.source === 'Extracted' ? 'Trích xuất' : (e.source === 'Generated' ? 'AI sinh mới' : 'Thủ công') }}</td>
            <td>{{ e.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
            <td nzRight (click)="$event.stopPropagation()">
              <button nz-button nzType="link" nzSize="small" (click)="open(e)"><nz-icon nzType="edit" /> Duyệt</button>
              <button nz-button nzType="link" nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Xóa đề này?"
                      (nzOnConfirm)="remove(e)"><nz-icon nzType="delete" /></button>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
    @if (!loading() && exams().length === 0) {
      <p class="muted">Chưa có đề nào. Bấm <strong>Tạo đề bằng AI</strong> để phân tích tài liệu.</p>
    }

    <!-- Modal tạo đề -->
    <nz-modal [nzVisible]="genOpen()" nzTitle="Tạo đề bằng AI" [nzMaskClosable]="false" [nzClosable]="!generating()"
      [nzFooter]="genFooter" (nzOnCancel)="generating() ? null : genOpen.set(false)">
      <ng-container *nzModalContent>
        @if (generating()) {
          <div class="gen-loading">
            <nz-spin nzSimple />
            <p>{{ generationStatus() }}</p>
          </div>
        } @else {
          <form nz-form nzLayout="vertical">
            <nz-form-item>
              <nz-form-label>Chế độ</nz-form-label>
              <nz-form-control>
                <nz-radio-group [(ngModel)]="mode" name="mode">
                  <label nz-radio-button nzValue="Extract">Trích xuất đề có sẵn</label>
                  <label nz-radio-button nzValue="Generate">Sinh câu hỏi mới</label>
                </nz-radio-group>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>Tên đề</nz-form-label>
              <nz-form-control><input nz-input [(ngModel)]="title" name="title" placeholder="Để trống = tự đặt theo tài liệu" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>Thời gian làm bài (phút)</nz-form-label>
              <nz-form-control><nz-input-number [(ngModel)]="durationMinutes" name="dur" [nzMin]="1" [nzMax]="300" /></nz-form-control>
            </nz-form-item>
            @if (mode === 'Generate') {
              <nz-form-item>
                <nz-form-label>Số câu mong muốn</nz-form-label>
                <nz-form-control><nz-input-number [(ngModel)]="maxQuestions" name="mq" [nzMin]="1" [nzMax]="100" /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>Độ khó</nz-form-label>
                <nz-form-control><input nz-input [(ngModel)]="difficulty" name="diff" placeholder="vd: trung bình" /></nz-form-control>
              </nz-form-item>
            }
            <nz-form-item>
              <nz-form-control>
                <nz-switch [(ngModel)]="verify" name="verify" />
                <span class="verify-label">Đối chiếu lại với tài liệu gốc bằng AI (chính xác hơn, tốn thêm 1 lượt)</span>
              </nz-form-control>
            </nz-form-item>
          </form>
        }
      </ng-container>
      <ng-template #genFooter>
        <button nz-button (click)="genOpen.set(false)" [disabled]="generating()">Đóng</button>
        <button nz-button nzType="primary" [nzLoading]="generating()" (click)="generate()">Tạo đề</button>
      </ng-template>
    </nz-modal>
  `,
  styles: `
    .row { cursor: pointer; }
    .muted { color: var(--hs-text-muted); margin-top: 12px; }
    .gen-loading { text-align: center; padding: 24px; }
    .gen-loading p { margin-top: 12px; color: var(--hs-text-muted); }
    .verify-label { color: var(--hs-text-muted); font-size: 13px; margin-left: 8px; }
  `
})
export class ExamListPage implements OnInit, OnDestroy {
  private readonly examService = inject(ExamService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);

  readonly materialId = input.required<string>();
  readonly title2 = input<string>('', { alias: 'title' });

  protected readonly statusLabels = EXAM_STATUS_LABELS;
  protected readonly exams = signal<ExamListItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly headerTitle = signal('Bộ đề của tài liệu');

  // Form tạo đề
  protected readonly genOpen = signal(false);
  protected readonly generating = signal(false);
  protected readonly generationStatus = signal('Đang gửi yêu cầu sinh đề...');
  protected mode: ExamGenerationMode = 'Extract';
  protected title = '';
  protected durationMinutes = 60;
  protected maxQuestions = 20;
  protected difficulty = '';
  protected verify = true;

  ngOnInit(): void {
    const t = this.title2();
    if (t) this.headerTitle.set(t);
    this.load();
  }

  ngOnDestroy(): void {
    this.clearPollTimer();
  }

  protected load(): void {
    this.loading.set(true);
    this.examService.listByMaterial(this.materialId()).subscribe({
      next: r => { this.exams.set(r.items); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected open(e: ExamListItem): void {
    this.router.navigate(['/exams', e.id]);
  }

  protected openGenerate(): void {
    this.clearPollTimer();
    this.mode = 'Extract';
    this.title = '';
    this.durationMinutes = 60;
    this.maxQuestions = 20;
    this.difficulty = '';
    this.verify = true;
    this.generationStatus.set('Đang gửi yêu cầu sinh đề...');
    this.genOpen.set(true);
  }

  protected generate(): void {
    if (this.generating()) return;
    const req: GenerateExamRequest = {
      mode: this.mode,
      title: this.title.trim() || null,
      durationMinutes: this.durationMinutes,
      maxQuestions: this.mode === 'Generate' ? this.maxQuestions : null,
      difficulty: this.mode === 'Generate' ? (this.difficulty.trim() || null) : null,
      instructions: null,
      verify: this.verify
    };
    this.generating.set(true);
    this.generationStatus.set('Đã đưa vào hàng đợi, đang chờ AI xử lý...');
    this.examService.startGeneration(this.materialId(), req).subscribe({
      next: job => {
        this.schedulePoll(job.jobId, job.pollAfterSeconds);
      },
      error: (err: HttpErrorResponse) => {
        this.generating.set(false);
        this.message.error(err.error?.message ?? err.message ?? 'Tạo đề thất bại.');
      }
    });
  }

  private pollTimer: number | null = null;

  private schedulePoll(jobId: string, delaySeconds: number): void {
    this.clearPollTimer();
    const delayMs = Math.max(1, delaySeconds || 2) * 1000;
    this.pollTimer = window.setTimeout(() => this.pollJob(jobId), delayMs);
  }

  private pollJob(jobId: string): void {
    this.examService.getGenerationJob(jobId).subscribe({
      next: job => {
        if (job.status === 'Queued') {
          this.generationStatus.set('Đang chờ xử lý. Bạn giữ cửa sổ này mở thêm một lát.');
          this.schedulePoll(jobId, job.pollAfterSeconds);
          return;
        }
        if (job.status === 'Running') {
          this.generationStatus.set('AI đang phân tích tài liệu và tạo câu hỏi. Việc này có thể mất vài phút.');
          this.schedulePoll(jobId, job.pollAfterSeconds);
          return;
        }
        this.generating.set(false);
        this.clearPollTimer();
        if (job.status === 'Succeeded' && job.result) {
          this.genOpen.set(false);
          this.reportResult(job.result);
          this.router.navigate(['/exams', job.result.examId]);
          return;
        }
        this.message.error(job.errorMessage ?? 'Tạo đề thất bại.');
      },
      error: (err: HttpErrorResponse) => {
        this.generating.set(false);
        this.clearPollTimer();
        this.message.error(err.error?.message ?? err.message ?? 'Không lấy được trạng thái tạo đề.');
      }
    });
  }

  private clearPollTimer(): void {
    if (this.pollTimer !== null) {
      window.clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private reportResult(r: ExamGenerationResult): void {
    let msg = `Đã tạo đề nháp với ${r.questionCount} câu.`;
    if (r.droppedCount > 0) msg += ` Bỏ ${r.droppedCount} câu không hợp lệ.`;
    this.message.success(msg);
    for (const w of r.warnings) this.message.warning(w, { nzDuration: 8000 });
  }

  protected remove(e: ExamListItem): void {
    this.examService.delete(e.id).subscribe({
      next: () => { this.message.success('Đã xóa đề.'); this.load(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ?? 'Xóa thất bại.')
    });
  }
}
