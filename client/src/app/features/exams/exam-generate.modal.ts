import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnDestroy, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { ExamService } from '../../core/exam.service';
import { MaterialsService } from '../../core/materials.service';
import { ExamGenerationMode, ExamGenerationResult, GenerateExamRequest, Material } from '../../core/models';

/** AI đọc file nào để lấy câu hỏi — tách bạch với "đề gắn vào tài liệu nào". */
type QuestionSource = 'self' | 'other' | 'upload';

const GENERATION_EXTENSIONS = ['.pdf', '.doc', '.docx', '.odt', '.rtf', '.txt'];

/**
 * Tạo đề bằng AI từ một tài liệu. Đề LUÔN gắn vào tài liệu đang đứng (để nằm đúng chỗ trong Kho),
 * nhưng nguồn câu hỏi cho AI đọc thì chọn được:
 *
 * - `self`   — chính tài liệu này (file đã có sẵn phần bài tập rõ ràng)
 * - `other`  — một tài liệu KHÁC trong cùng bộ (vd file bài tập riêng đã có trong kho)
 * - `upload` — tải lên file chỉ chứa câu hỏi, dùng một lần, KHÔNG nhập kho
 *
 * File bài học thường lẫn cả lý thuyết lẫn bài tập nên AI dễ bắt nhầm phần lý thuyết thành câu hỏi;
 * trỏ đúng phần bài tập cho AI đọc sẽ chính xác hơn hẳn.
 */
@Component({
  selector: 'app-exam-generate-modal',
  imports: [
    FormsModule, NzModalModule, NzFormModule, NzInputModule, NzInputNumberModule, NzSelectModule,
    NzRadioModule, NzSwitchModule, NzUploadModule, NzButtonModule, NzIconModule, NzAlertModule, NzSpinModule
  ],
  template: `
    <nz-modal
      [nzVisible]="visible"
      nzTitle="Tạo đề bằng AI"
      [nzWidth]="600"
      [nzOkText]="running() ? 'Đang tạo…' : 'Bắt đầu tạo đề'"
      [nzOkLoading]="running()"
      [nzCancelText]="running() ? 'Chạy nền, đóng cửa sổ' : 'Hủy'"
      (nzOnOk)="start()"
      (nzOnCancel)="close()">
      <div *nzModalContent>
        @if (running()) {
          <div class="running">
            <nz-spin nzSimple />
            <div class="running-text">{{ status() }}</div>
            <p class="hint">Quá trình chạy nền — bạn có thể đóng cửa sổ, đề sẽ nằm trong mục Đề &amp; Bài tập khi xong.</p>
          </div>
        } @else {
          <nz-alert
            nzType="info"
            [nzMessage]="'Đề sẽ gắn vào tài liệu: ' + (material?.title ?? '')"
            style="margin-bottom:16px" />

          <nz-form-item>
            <nz-form-label>AI đọc file nào để lấy câu hỏi?</nz-form-label>
            <nz-form-control nzExtra="File bài học thường lẫn cả lý thuyết lẫn bài tập — trỏ AI sang đúng phần bài tập sẽ chính xác hơn.">
              <nz-radio-group [(ngModel)]="questionSource" (ngModelChange)="onSourceChange()" class="src-group">
                <label nz-radio [nzValue]="'self'">
                  <b>Chính tài liệu này</b>
                  <span class="src-desc">Dùng khi file đã có sẵn phần bài tập rõ ràng.</span>
                </label>
                <label nz-radio [nzValue]="'other'" [nzDisabled]="!material?.folderId">
                  <b>Một tài liệu khác trong bộ</b>
                  <span class="src-desc">
                    {{ material?.folderId ? 'Ví dụ file bài tập riêng đã có trong kho.' : 'Chỉ dùng được với tài liệu thuộc một bộ.' }}
                  </span>
                </label>
                <label nz-radio [nzValue]="'upload'">
                  <b>Tải lên file chỉ có phần câu hỏi</b>
                  <span class="src-desc">File này KHÔNG lưu vào kho — chỉ dùng một lần để AI đọc.</span>
                </label>
              </nz-radio-group>
            </nz-form-control>
          </nz-form-item>

          @if (questionSource === 'other') {
            <nz-form-item>
              <nz-form-label nzRequired>Tài liệu chứa câu hỏi</nz-form-label>
              <nz-form-control nzErrorTip="Chọn tài liệu chứa câu hỏi">
                <nz-select [(ngModel)]="questionSourceMaterialId" nzShowSearch nzPlaceHolder="Chọn tài liệu trong cùng bộ">
                  @for (m of siblings(); track m.id) {
                    <nz-option [nzValue]="m.id" [nzLabel]="m.title" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          }

          @if (questionSource === 'upload') {
            <nz-form-item>
              <nz-form-control>
                <nz-upload nzType="drag" [nzBeforeUpload]="beforeUpload" [nzShowUploadList]="false"
                           nzAccept=".pdf,.doc,.docx,.odt,.rtf,.txt">
                  <p class="ant-upload-drag-icon"><nz-icon nzType="inbox" /></p>
                  <p class="ant-upload-text">Chọn file chỉ chứa bài tập / câu hỏi</p>
                  <p class="ant-upload-hint">PDF, Word, Text · dùng một lần, không lưu vào kho</p>
                </nz-upload>
                @if (uploadFileName()) {
                  <div class="picked"><nz-icon nzType="paper-clip" /> {{ uploadFileName() }}</div>
                }
              </nz-form-control>
            </nz-form-item>
          }

          <nz-form-item>
            <nz-form-label>Cách làm đề</nz-form-label>
            <nz-form-control [nzExtra]="mode === 'Extract'
              ? 'Giữ nguyên văn câu hỏi và đáp án đã có sẵn trong tài liệu.'
              : 'AI soạn câu hỏi mới theo chủ đề của tài liệu — dùng khi tài liệu không sẵn câu hỏi.'">
              <nz-radio-group [(ngModel)]="mode">
                <label nz-radio-button nzValue="Extract">Bóc tách từ tài liệu</label>
                <label nz-radio-button nzValue="Generate">AI soạn đề mới</label>
              </nz-radio-group>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label>Tên đề</nz-form-label>
            <nz-form-control nzExtra="Bỏ trống ⇒ lấy theo tên tài liệu/file nguồn.">
              <input nz-input [(ngModel)]="title" placeholder="vd: Unit 5 — Vocabulary check" />
            </nz-form-control>
          </nz-form-item>

          <div class="two-col">
            <nz-form-item>
              <nz-form-label>Thời gian làm (phút)</nz-form-label>
              <nz-form-control>
                <nz-input-number [(ngModel)]="durationMinutes" [nzMin]="1" [nzMax]="300" style="width:100%" />
              </nz-form-control>
            </nz-form-item>

            @if (mode === 'Generate') {
              <nz-form-item>
                <nz-form-label>Số câu tối đa</nz-form-label>
                <nz-form-control>
                  <nz-input-number [(ngModel)]="maxQuestions" [nzMin]="1" [nzMax]="100" style="width:100%" />
                </nz-form-control>
              </nz-form-item>
            }
          </div>

          @if (mode === 'Generate') {
            <nz-form-item>
              <nz-form-label>Độ khó</nz-form-label>
              <nz-form-control>
                <input nz-input [(ngModel)]="difficulty" placeholder="vd: trung bình" />
              </nz-form-control>
            </nz-form-item>
          }

          <nz-form-item>
            <nz-form-label>Đối chiếu lại với bản gốc</nz-form-label>
            <nz-form-control nzExtra="AI kiểm tra chéo bản trích so với tài liệu — chậm hơn nhưng an toàn hơn.">
              <nz-switch [(ngModel)]="verify" />
            </nz-form-control>
          </nz-form-item>
        }
      </div>
    </nz-modal>
  `,
  styles: `
    nz-select, nz-radio-group:not(.src-group) { width: 100%; }
    .src-group { display: flex; flex-direction: column; gap: 10px; }
    .src-group label { display: flex; align-items: flex-start; white-space: normal; }
    .src-desc { display: block; font-size: 12.5px; color: var(--hs-text-muted); line-height: 1.5; }
    .picked { margin-top: 8px; font-size: 13px; color: var(--hs-text-muted); }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .running { text-align: center; padding: 26px 0; }
    .running-text { margin-top: 14px; font-weight: 650; }
    .hint { margin-top: 8px; font-size: 12.5px; color: var(--hs-text-muted); }
    @media (max-width: 575px) { .two-col { grid-template-columns: 1fr; } }
  `
})
export class ExamGenerateModal implements OnDestroy {
  private readonly examService = inject(ExamService);
  private readonly materialsService = inject(MaterialsService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);

  @Input() visible = false;
  /** Tài liệu đề sẽ gắn vào. */
  @Input() material: Material | null = null;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly generated = new EventEmitter<ExamGenerationResult>();

  protected readonly running = signal(false);
  protected readonly status = signal('');
  protected readonly siblings = signal<Material[]>([]);
  protected readonly uploadFileName = signal<string | null>(null);

  protected questionSource: QuestionSource = 'self';
  protected questionSourceMaterialId: string | null = null;
  protected mode: ExamGenerationMode = 'Extract';
  protected title = '';
  protected durationMinutes = 60;
  protected maxQuestions = 20;
  protected difficulty = '';
  protected verify = true;

  private uploadFile: File | null = null;
  private pollTimer: number | null = null;

  /** Gọi từ component cha ngay trước khi bật `visible`. */
  open(): void {
    this.clearPollTimer();
    this.running.set(false);
    this.status.set('');
    this.questionSource = 'self';
    this.questionSourceMaterialId = null;
    this.mode = 'Extract';
    this.title = '';
    this.durationMinutes = 60;
    this.maxQuestions = 20;
    this.difficulty = '';
    this.verify = true;
    this.uploadFile = null;
    this.uploadFileName.set(null);
    this.siblings.set([]);
  }

  ngOnDestroy(): void {
    this.clearPollTimer();
  }

  protected close(): void {
    this.closed.emit();
  }

  /** Chọn "tài liệu khác trong bộ" ⇒ nạp danh sách tài liệu cùng bộ (bỏ chính nó và bỏ link ngoài). */
  protected onSourceChange(): void {
    if (this.questionSource !== 'other' || !this.material?.folderId || this.siblings().length > 0) return;

    this.materialsService.getPaged({ folderId: this.material.folderId, page: 1, pageSize: 100 }).subscribe(r =>
      this.siblings.set(r.items.filter(m => m.id !== this.material?.id && m.source === 'ServerFile')));
  }

  protected readonly beforeUpload = (file: NzUploadFile): false => {
    const f = file as unknown as File;
    const ext = extensionOf(f.name);
    if (!GENERATION_EXTENSIONS.includes(ext)) {
      this.message.warning('Chỉ hỗ trợ file PDF/Word/Text để tạo đề.');
      return false;
    }
    this.uploadFile = f;
    this.uploadFileName.set(f.name);
    if (!this.title.trim()) this.title = fileNameWithoutExtension(f.name);
    return false;
  };

  protected start(): void {
    if (this.running() || !this.material) return;

    if (this.questionSource === 'other' && !this.questionSourceMaterialId) {
      this.message.warning('Chọn tài liệu chứa câu hỏi.');
      return;
    }
    if (this.questionSource === 'upload' && !this.uploadFile) {
      this.message.warning('Chọn file chứa câu hỏi.');
      return;
    }

    this.running.set(true);
    this.status.set('Đã đưa vào hàng đợi, đang chờ AI xử lý…');

    if (this.questionSource === 'upload') {
      const form = new FormData();
      form.append('file', this.uploadFile!);
      form.append('mode', this.mode);
      if (this.title.trim()) form.append('examTitle', this.title.trim());
      form.append('durationMinutes', String(this.durationMinutes));
      if (this.mode === 'Generate') {
        form.append('maxQuestions', String(this.maxQuestions));
        if (this.difficulty.trim()) form.append('difficulty', this.difficulty.trim());
      }
      form.append('verify', String(this.verify));

      this.examService.startGenerationFromUpload(this.material.id, form).subscribe({
        next: job => this.schedulePoll(job.jobId, job.pollAfterSeconds),
        error: (err: HttpErrorResponse) => this.failStart(err)
      });
      return;
    }

    const req: GenerateExamRequest = {
      mode: this.mode,
      title: this.title.trim() || null,
      durationMinutes: this.durationMinutes,
      maxQuestions: this.mode === 'Generate' ? this.maxQuestions : null,
      difficulty: this.mode === 'Generate' ? (this.difficulty.trim() || null) : null,
      instructions: null,
      verify: this.verify,
      questionSourceMaterialId: this.questionSource === 'other' ? this.questionSourceMaterialId : null
    };

    this.examService.startGeneration(this.material.id, req).subscribe({
      next: job => this.schedulePoll(job.jobId, job.pollAfterSeconds),
      error: (err: HttpErrorResponse) => this.failStart(err)
    });
  }

  private failStart(err: HttpErrorResponse): void {
    this.running.set(false);
    this.message.error(err.error?.message ?? err.message ?? 'Tạo đề thất bại.');
  }

  private schedulePoll(jobId: string, delaySeconds: number): void {
    this.clearPollTimer();
    this.pollTimer = window.setTimeout(() => this.pollJob(jobId), Math.max(1, delaySeconds || 2) * 1000);
  }

  private pollJob(jobId: string): void {
    this.examService.getGenerationJob(jobId).subscribe({
      next: job => {
        if (job.status === 'Queued') {
          this.status.set('Đang chờ xử lý. Giữ cửa sổ này mở thêm một lát.');
          this.schedulePoll(jobId, job.pollAfterSeconds);
          return;
        }
        if (job.status === 'Running') {
          this.status.set('AI đang đọc tài liệu và tạo câu hỏi. Việc này có thể mất vài phút.');
          this.schedulePoll(jobId, job.pollAfterSeconds);
          return;
        }

        this.running.set(false);
        this.clearPollTimer();

        if (job.status === 'Succeeded' && job.result) {
          this.reportResult(job.result);
          this.generated.emit(job.result);
          this.close();
          this.router.navigate(['/exams', job.result.examId]);
          return;
        }
        this.message.error(job.errorMessage ?? 'Tạo đề thất bại.');
      },
      error: (err: HttpErrorResponse) => {
        this.running.set(false);
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
    if (r.droppedCount > 0) msg += ` Bỏ ${r.droppedCount} câu không tự chấm được.`;
    this.message.success(msg);
    for (const w of r.warnings) this.message.warning(w, { nzDuration: 8000 });
  }
}

function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i >= 0 ? fileName.slice(i).toLowerCase() : '';
}

function fileNameWithoutExtension(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return (i > 0 ? fileName.slice(0, i) : fileName).trim();
}
