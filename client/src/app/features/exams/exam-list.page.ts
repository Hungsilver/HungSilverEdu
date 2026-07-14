import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
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
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { ExamService } from '../../core/exam.service';
import { EXAM_STATUS_LABELS, ExamGenerationMode, ExamGenerationResult, ExamListItem, GenerateExamRequest } from '../../core/models';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-exam-list-page',
  imports: [
    FormsModule, DatePipe, RouterLink,
    NzTableModule, NzButtonModule, NzIconModule, NzTagModule, NzModalModule, NzFormModule, NzInputModule,
    NzInputNumberModule, NzRadioModule, NzSwitchModule, NzSpinModule, NzAlertModule, NzPopconfirmModule,
    NzUploadModule, PageHeader
  ],
  template: `
    <app-page-header [title]="headerTitle()" subtitle="Bộ đề trắc nghiệm sinh từ tài liệu" icon="file-text">
      <a nz-button routerLink="/materials" [queryParams]="backParams()"><nz-icon nzType="arrow-left" /> Kho tài liệu</a>
      <button nz-button (click)="openUploadGenerate()"><nz-icon nzType="upload" /> Tạo đề từ file upload</button>
      <button nz-button nzType="primary" (click)="openGenerate()"><nz-icon nzType="robot" /> Tạo đề bằng AI</button>
    </app-page-header>

    <nz-table #table [nzData]="exams()" [nzLoading]="loading()" [nzFrontPagination]="false">
      <thead>
        <tr><th>Tên đề</th><th>Trạng thái</th><th>Số câu</th><th>Thời gian</th><th>Nguồn</th><th>Người tạo</th><th>Ngày tạo</th><th nzRight>Thao tác</th></tr>
      </thead>
      <tbody>
        @for (e of table.data; track e.id) {
          <tr class="row" (click)="open(e)">
            <td>{{ e.title }}</td>
            <td><nz-tag [nzColor]="e.status === 'Published' ? 'success' : 'default'">{{ statusLabels[e.status] }}</nz-tag></td>
            <td>{{ e.questionCount }}</td>
            <td>{{ e.durationMinutes }}'</td>
            <td>{{ e.source === 'Extracted' ? 'Trích xuất' : (e.source === 'Generated' ? 'AI sinh mới' : 'Thủ công') }}</td>
            <td>{{ e.createdByName || '—' }}</td>
            <td>{{ e.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
            <td nzRight (click)="$event.stopPropagation()">
              <button nz-button nzType="link" nzSize="small" (click)="open(e)"><nz-icon nzType="edit" /> Duyệt</button>
              <button nz-button nzType="link" nzSize="small" nz-popconfirm nzPopconfirmTitle="Tạo bản sao Draft của đề này?"
                      (nzOnConfirm)="duplicate(e)"><nz-icon nzType="copy" /> Nhân bản</button>
              <button nz-button nzType="link" nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Xóa đề này?"
                      (nzOnConfirm)="remove(e)"><nz-icon nzType="delete" /></button>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
    @if (!loading() && exams().length === 0) {
      <p class="muted">Chưa có đề nào. Bấm <strong>Tạo đề bằng AI</strong> hoặc <strong>Tạo đề từ file upload</strong> để bắt đầu.</p>
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

    <!-- Modal upload file mới rồi tạo đề -->
    <nz-modal [nzVisible]="uploadOpen()" nzTitle="Tạo đề từ file upload" [nzMaskClosable]="false" [nzClosable]="!generating()"
      [nzFooter]="uploadFooter" (nzOnCancel)="generating() ? null : uploadOpen.set(false)">
      <ng-container *nzModalContent>
        @if (generating()) {
          <div class="gen-loading">
            <nz-spin nzSimple />
            <p>{{ generationStatus() }}</p>
          </div>
        } @else {
          <form nz-form nzLayout="vertical">
            <nz-form-item>
              <nz-form-label nzRequired>File đề</nz-form-label>
              <nz-form-control>
                <nz-upload nzAccept=".pdf,.doc,.docx,.odt,.rtf,.txt" [nzBeforeUpload]="beforeExamUpload" [nzShowUploadList]="false">
                  <button nz-button type="button"><nz-icon nzType="upload" /> Chọn file</button>
                </nz-upload>
                @if (uploadFileName()) { <span class="file-name">{{ uploadFileName() }}</span> }
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>Chế độ</nz-form-label>
              <nz-form-control>
                <nz-radio-group [(ngModel)]="uploadMode" name="uploadMode">
                  <label nz-radio-button nzValue="Extract">Trích xuất đề có sẵn</label>
                  <label nz-radio-button nzValue="Generate">Sinh câu hỏi mới</label>
                </nz-radio-group>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>Tên đề</nz-form-label>
              <nz-form-control><input nz-input [(ngModel)]="uploadExamTitle" name="uploadExamTitle" placeholder="Để trống = tự đặt theo tên file" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>Thời gian làm bài (phút)</nz-form-label>
              <nz-form-control><nz-input-number [(ngModel)]="uploadDurationMinutes" name="uploadDur" [nzMin]="1" [nzMax]="300" /></nz-form-control>
            </nz-form-item>
            @if (uploadMode === 'Generate') {
              <nz-form-item>
                <nz-form-label>Số câu mong muốn</nz-form-label>
                <nz-form-control><nz-input-number [(ngModel)]="uploadMaxQuestions" name="uploadMq" [nzMin]="1" [nzMax]="100" /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>Độ khó</nz-form-label>
                <nz-form-control><input nz-input [(ngModel)]="uploadDifficulty" name="uploadDiff" placeholder="vd: trung bình" /></nz-form-control>
              </nz-form-item>
            }
            <nz-form-item>
              <nz-form-control>
                <nz-switch [(ngModel)]="uploadVerify" name="uploadVerify" />
                <span class="verify-label">Đối chiếu lại với tài liệu gốc bằng AI</span>
              </nz-form-control>
            </nz-form-item>
          </form>
        }
      </ng-container>
      <ng-template #uploadFooter>
        <button nz-button (click)="uploadOpen.set(false)" [disabled]="generating()">Đóng</button>
        <button nz-button nzType="primary" [nzLoading]="generating()" (click)="generateFromUpload()">Tạo đề</button>
      </ng-template>
    </nz-modal>
  `,
  styles: `
    .row { cursor: pointer; }
    .muted { color: var(--hs-text-muted); margin-top: 12px; }
    .gen-loading { text-align: center; padding: 24px; }
    .gen-loading p { margin-top: 12px; color: var(--hs-text-muted); }
    .verify-label { color: var(--hs-text-muted); font-size: 13px; margin-left: 8px; }
    .file-name { margin-left: 8px; color: var(--hs-text-muted); }
  `
})
export class ExamListPage implements OnInit, OnDestroy {
  private readonly examService = inject(ExamService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);

  readonly materialId = input.required<string>();
  readonly title2 = input<string>('', { alias: 'title' });
  // Ngữ cảnh Kho tài liệu (query param) — để nút back quay về đúng tab/bộ đang xem.
  readonly tab = input<string | undefined>();
  readonly subjectId = input<string | undefined>();
  readonly folderId = input<string | undefined>();

  /** Query params cho nút back — chỉ gồm param có giá trị (không có ⇒ về mặc định /materials). */
  protected readonly backParams = computed(() => {
    const p: Record<string, string> = {};
    const tab = this.tab();
    const subjectId = this.subjectId();
    const folderId = this.folderId();
    if (tab) p['tab'] = tab;
    if (subjectId) p['subjectId'] = subjectId;
    if (folderId) p['folderId'] = folderId;
    return p;
  });

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

  protected readonly uploadOpen = signal(false);
  protected readonly uploadFileName = signal<string | null>(null);
  private uploadFile: File | null = null;
  protected uploadExamTitle = '';
  protected uploadMode: ExamGenerationMode = 'Extract';
  protected uploadDurationMinutes = 60;
  protected uploadMaxQuestions = 20;
  protected uploadDifficulty = '';
  protected uploadVerify = true;

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
    // Mang theo ngữ cảnh Kho tài liệu để chuỗi back exam-detail → exam-list → /materials giữ đúng tab/bộ.
    this.router.navigate(['/exams', e.id], { queryParams: { title: this.title2() || null, ...this.backParams() } });
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

  protected openUploadGenerate(): void {
    this.clearPollTimer();
    this.uploadFile = null;
    this.uploadFileName.set(null);
    this.uploadExamTitle = '';
    this.uploadMode = 'Extract';
    this.uploadDurationMinutes = 60;
    this.uploadMaxQuestions = 20;
    this.uploadDifficulty = '';
    this.uploadVerify = true;
    this.generationStatus.set('Đang gửi yêu cầu sinh đề...');
    this.uploadOpen.set(true);
  }

  protected beforeExamUpload = (file: NzUploadFile): false => {
    const f = file as unknown as File;
    const ext = this.extensionOf(f.name);
    if (!['.pdf', '.doc', '.docx', '.odt', '.rtf', '.txt'].includes(ext)) {
      this.message.warning('Chỉ hỗ trợ file PDF/Word/Text để tạo đề.');
      return false;
    }
    this.uploadFile = f;
    this.uploadFileName.set(f.name);
    if (!this.uploadExamTitle.trim())
      this.uploadExamTitle = this.fileNameWithoutExtension(f.name);
    return false;
  };

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

  protected generateFromUpload(): void {
    if (this.generating()) return;
    if (!this.uploadFile) { this.message.warning('Chọn file đề.'); return; }

    const form = new FormData();
    form.append('file', this.uploadFile);
    form.append('mode', this.uploadMode);
    if (this.uploadExamTitle.trim()) form.append('examTitle', this.uploadExamTitle.trim());
    form.append('durationMinutes', String(this.uploadDurationMinutes));
    if (this.uploadMode === 'Generate') {
      form.append('maxQuestions', String(this.uploadMaxQuestions));
      if (this.uploadDifficulty.trim()) form.append('difficulty', this.uploadDifficulty.trim());
    }
    form.append('verify', String(this.uploadVerify));

    this.generating.set(true);
    this.generationStatus.set('Đã upload file, đang chờ AI xử lý...');
    this.examService.startGenerationFromUpload(this.materialId(), form).subscribe({
      next: job => this.schedulePoll(job.jobId, job.pollAfterSeconds),
      error: (err: HttpErrorResponse) => {
        this.generating.set(false);
        this.message.error(err.error?.message ?? err.message ?? 'Tạo đề từ file upload thất bại.');
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
          this.uploadOpen.set(false);
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

  private extensionOf(fileName: string): string {
    const i = fileName.lastIndexOf('.');
    return i >= 0 ? fileName.slice(i).toLowerCase() : '';
  }

  private fileNameWithoutExtension(fileName: string): string {
    const dot = fileName.lastIndexOf('.');
    return (dot > 0 ? fileName.slice(0, dot) : fileName).trim();
  }

  protected remove(e: ExamListItem): void {
    this.examService.delete(e.id).subscribe({
      next: () => { this.message.success('Đã xóa đề.'); this.load(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ?? 'Xóa thất bại.')
    });
  }

  /** Nhân bản nguyên trạng thành đề Draft mới — đường chỉnh sửa khi đề gốc đã giao cho lớp. */
  protected duplicate(e: ExamListItem): void {
    this.examService.duplicate(e.id).subscribe({
      next: r => { this.message.success('Đã tạo bản sao — chỉnh sửa trên đề mới.'); this.router.navigate(['/exams', r.examId]); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ?? 'Nhân bản thất bại.')
    });
  }
}
