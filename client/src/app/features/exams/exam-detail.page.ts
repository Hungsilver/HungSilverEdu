import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ClassesService } from '../../core/classes.service';
import { ExamService } from '../../core/exam.service';
import {
  AssignExamRequest, ClassListItem, EXAM_TYPE_LABELS, ExamAssignment, ExamDeliveryMode, ExamDetail, ExamOption,
  ExamPair, ExamQuestion, ExamQuestionType, UpsertQuestionRequest
} from '../../core/models';
import { PageHeader } from '../../shared/page-header';

/** Câu hỏi ở dạng có thể sửa (đã parse từ JSON lưu trữ). */
interface EditQuestion {
  id: string | null;
  groupId: string | null;
  type: ExamQuestionType;
  stem: string;
  options: ExamOption[];       // SingleChoice + Matching (cột trái)
  optionsRight: ExamOption[];  // Matching (cột phải)
  answerKey: string;           // SingleChoice
  trueFalse: boolean;          // TrueFalse
  blanks: string[];            // FillBlank (mỗi ô = "a/b")
  wordBox: string;             // FillBlank hộp từ (ngăn bởi ",")
  pairs: ExamPair[];           // Matching
  explanation: string;
  points: number | null;
}

interface QView {
  q: ExamQuestion;
  options: { key: string; text: string; correct: boolean }[];
  answerSummary: string;
}

interface Section {
  groupId: string | null;
  title: string | null;
  passage: string | null;
  items: QView[];
}

@Component({
  selector: 'app-exam-detail-page',
  imports: [
    FormsModule,
    NzCardModule, NzButtonModule, NzIconModule, NzTagModule, NzModalModule, NzFormModule, NzInputModule,
    NzInputNumberModule, NzRadioModule, NzSelectModule, NzDatePickerModule, NzSpinModule, NzAlertModule, NzPopconfirmModule, PageHeader
  ],
  template: `
    <app-page-header [title]="detail()?.title || 'Duyệt đề'" subtitle="Duyệt & chỉnh sửa trước khi phát hành" icon="file-text">
      <button nz-button (click)="back()"><nz-icon nzType="arrow-left" /> Quay lại</button>
      @if (detail(); as d) {
        <button nz-button (click)="openMeta()"><nz-icon nzType="edit" /> Sửa thông tin</button>
        <button nz-button nzType="primary" (click)="addQuestion()"><nz-icon nzType="plus" /> Thêm câu</button>
        @if (d.status === 'Draft') {
          <button nz-button nzType="primary" nz-popconfirm nzPopconfirmTitle="Phát hành đề vào bộ đề?"
                  (nzOnConfirm)="publish()"><nz-icon nzType="check-circle" /> Lưu vào bộ đề</button>
        } @else {
          <nz-tag nzColor="success">Đã phát hành</nz-tag>
          <button nz-button nzType="primary" (click)="openAssign()"><nz-icon nzType="send" /> Giao cho lớp</button>
        }
      }
    </app-page-header>

    @if (loading()) {
      <div class="center"><nz-spin nzSimple /></div>
    } @else if (detail(); as d) {
      <div class="meta">
        <nz-tag>{{ d.questionCount() }} câu</nz-tag>
        <nz-tag>{{ d.durationMinutes }}'</nz-tag>
        <nz-tag>Thang điểm {{ d.totalPoints }}</nz-tag>
      </div>

      @if (d.status === 'Published' && assignments().length) {
        <nz-card class="assign-card" nzTitle="Đã giao cho lớp" nzSize="small">
          @for (a of assignments(); track a.id) {
            <div class="asg-row">
              <span>{{ a.className }} · {{ a.mode === 'InClass' ? 'Trên lớp' : 'Về nhà' }} · {{ a.durationMinutes }}'</span>
              <span class="muted">{{ a.submittedCount }}/{{ a.totalStudents }} đã nộp</span>
              <nz-tag [nzColor]="a.status === 'Open' ? 'processing' : 'default'">{{ a.status === 'Open' ? 'Đang mở' : 'Đã đóng' }}</nz-tag>
              <button nz-button nzSize="small" (click)="openReport(a)"><nz-icon nzType="bar-chart" /> Báo cáo</button>
              @if (a.status === 'Open') {
                <button nz-button nzSize="small" nz-popconfirm nzPopconfirmTitle="Đóng lượt giao này?" (nzOnConfirm)="closeAssignment(a)">Đóng</button>
              }
            </div>
          }
        </nz-card>
      }

      <div class="split" [class.no-pdf]="!pdfUrl()">
        @if (pdfUrl(); as url) {
          <div class="pdf">
            <iframe [src]="url" title="Tài liệu gốc"></iframe>
          </div>
        }
        <div class="questions">
          @for (sec of sections(); track sec.groupId ?? $index) {
            @if (sec.title || sec.passage) {
              <nz-card class="group-card" [nzTitle]="sec.title || 'Ngữ liệu'">
                @if (sec.passage) { <p class="passage">{{ sec.passage }}</p> }
              </nz-card>
            }
            @for (v of sec.items; track v.q.id) {
              <nz-card class="q-card">
                <div class="q-head">
                  <span class="q-no">{{ v.q.sourceNumber ?? (v.q.orderNo + 1) }}.</span>
                  <nz-tag>{{ typeLabels[v.q.type] }}</nz-tag>
                  <span class="q-stem">{{ v.q.stem }}</span>
                  <span class="spacer"></span>
                  <button nz-button nzType="link" nzSize="small" (click)="editQuestion(v.q)"><nz-icon nzType="edit" /></button>
                  <button nz-button nzType="link" nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Xóa câu này?"
                          (nzOnConfirm)="removeQuestion(v.q)"><nz-icon nzType="delete" /></button>
                </div>
                @if (v.options.length) {
                  <ul class="opts">
                    @for (o of v.options; track o.key) {
                      <li [class.correct]="o.correct"><strong>{{ o.key }}.</strong> {{ o.text }}
                        @if (o.correct) { <nz-icon nzType="check" class="ok" /> }
                      </li>
                    }
                  </ul>
                }
                <div class="answer"><strong>Đáp án:</strong> {{ v.answerSummary }}</div>
                @if (v.q.explanation) { <div class="expl"><strong>Giải thích:</strong> {{ v.q.explanation }}</div> }
              </nz-card>
            }
          }
          @if (allQuestions().length === 0) { <p class="muted">Đề chưa có câu hỏi. Bấm "Thêm câu".</p> }
        </div>
      </div>
    }

    <!-- Modal sửa thông tin đề -->
    <nz-modal [nzVisible]="metaOpen()" nzTitle="Thông tin đề" [nzOkLoading]="saving()" (nzOnOk)="saveMeta()" (nzOnCancel)="metaOpen.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical">
          <nz-form-item><nz-form-label nzRequired>Tên đề</nz-form-label>
            <nz-form-control><input nz-input [(ngModel)]="mTitle" name="t" /></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Mô tả</nz-form-label>
            <nz-form-control><textarea nz-input [(ngModel)]="mDescription" name="d" rows="2"></textarea></nz-form-control></nz-form-item>
          <nz-form-item><nz-form-label>Thời gian (phút)</nz-form-label>
            <nz-form-control><nz-input-number [(ngModel)]="mDuration" name="dur" [nzMin]="1" [nzMax]="300" /></nz-form-control></nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <!-- Modal sửa/thêm câu hỏi -->
    @if (edit(); as e) {
      <nz-modal [nzVisible]="true" [nzTitle]="e.id ? 'Sửa câu hỏi' : 'Thêm câu hỏi'" nzWidth="640px"
        [nzOkLoading]="saving()" (nzOnOk)="saveQuestion()" (nzOnCancel)="edit.set(null)">
        <ng-container *nzModalContent>
          <form nz-form nzLayout="vertical">
            <nz-form-item><nz-form-label>Loại</nz-form-label>
              <nz-form-control>
                <nz-radio-group [(ngModel)]="e.type" name="type" (ngModelChange)="onTypeChange(e)">
                  <label nz-radio-button nzValue="SingleChoice">Trắc nghiệm</label>
                  <label nz-radio-button nzValue="TrueFalse">Đúng/Sai</label>
                  <label nz-radio-button nzValue="FillBlank">Điền từ</label>
                  <label nz-radio-button nzValue="Matching">Nối</label>
                </nz-radio-group>
              </nz-form-control></nz-form-item>

            <nz-form-item><nz-form-label nzRequired>Nội dung câu hỏi</nz-form-label>
              <nz-form-control><textarea nz-input [(ngModel)]="e.stem" name="stem" rows="2"></textarea></nz-form-control></nz-form-item>

            @switch (e.type) {
              @case ('SingleChoice') {
                <nz-form-item><nz-form-label>Lựa chọn (chọn đáp án đúng)</nz-form-label>
                  <nz-form-control>
                    <nz-radio-group [(ngModel)]="e.answerKey" name="ak" class="opt-radio">
                      @for (o of e.options; track $index) {
                        <div class="opt-row">
                          <label nz-radio [nzValue]="o.key"></label>
                          <input nz-input class="k" [(ngModel)]="o.key" [ngModelOptions]="{standalone:true}" placeholder="A" />
                          <input nz-input [(ngModel)]="o.text" [ngModelOptions]="{standalone:true}" placeholder="Nội dung" />
                          <button nz-button nzType="text" nzDanger (click)="e.options.splice($index,1)"><nz-icon nzType="minus" /></button>
                        </div>
                      }
                    </nz-radio-group>
                    <button nz-button nzSize="small" (click)="e.options.push({key:'',text:''})"><nz-icon nzType="plus" /> Thêm lựa chọn</button>
                  </nz-form-control></nz-form-item>
              }
              @case ('TrueFalse') {
                <nz-form-item><nz-form-label>Đáp án đúng</nz-form-label>
                  <nz-form-control>
                    <nz-radio-group [(ngModel)]="e.trueFalse" name="tf">
                      <label nz-radio-button [nzValue]="true">Đúng</label>
                      <label nz-radio-button [nzValue]="false">Sai</label>
                    </nz-radio-group>
                  </nz-form-control></nz-form-item>
              }
              @case ('FillBlank') {
                <nz-form-item><nz-form-label>Đáp án từng ô (ngăn cách các đáp án chấp nhận bằng "/")</nz-form-label>
                  <nz-form-control>
                    @for (b of e.blanks; track $index) {
                      <div class="opt-row">
                        <span class="blank-no">Ô {{ $index + 1 }}</span>
                        <input nz-input [(ngModel)]="e.blanks[$index]" [ngModelOptions]="{standalone:true}" placeholder="mental / tinh thần" />
                        <button nz-button nzType="text" nzDanger (click)="e.blanks.splice($index,1)"><nz-icon nzType="minus" /></button>
                      </div>
                    }
                    <button nz-button nzSize="small" (click)="e.blanks.push('')"><nz-icon nzType="plus" /> Thêm ô</button>
                  </nz-form-control></nz-form-item>
                <nz-form-item><nz-form-label>Hộp từ (tùy chọn, ngăn bởi ",")</nz-form-label>
                  <nz-form-control><input nz-input [(ngModel)]="e.wordBox" name="wb" /></nz-form-control></nz-form-item>
              }
              @case ('Matching') {
                <nz-form-item><nz-form-label>Cột trái / Cột phải / Cặp nối</nz-form-label>
                  <nz-form-control>
                    <div class="match-cols">
                      <div>
                        <div class="col-h">Cột trái</div>
                        @for (o of e.options; track $index) {
                          <div class="opt-row">
                            <input nz-input class="k" [(ngModel)]="o.key" [ngModelOptions]="{standalone:true}" placeholder="1" />
                            <input nz-input [(ngModel)]="o.text" [ngModelOptions]="{standalone:true}" placeholder="..." />
                            <button nz-button nzType="text" nzDanger (click)="e.options.splice($index,1)"><nz-icon nzType="minus" /></button>
                          </div>
                        }
                        <button nz-button nzSize="small" (click)="e.options.push({key:'',text:''})"><nz-icon nzType="plus" /></button>
                      </div>
                      <div>
                        <div class="col-h">Cột phải</div>
                        @for (o of e.optionsRight; track $index) {
                          <div class="opt-row">
                            <input nz-input class="k" [(ngModel)]="o.key" [ngModelOptions]="{standalone:true}" placeholder="a" />
                            <input nz-input [(ngModel)]="o.text" [ngModelOptions]="{standalone:true}" placeholder="..." />
                            <button nz-button nzType="text" nzDanger (click)="e.optionsRight.splice($index,1)"><nz-icon nzType="minus" /></button>
                          </div>
                        }
                        <button nz-button nzSize="small" (click)="e.optionsRight.push({key:'',text:''})"><nz-icon nzType="plus" /></button>
                      </div>
                    </div>
                    <div class="col-h">Cặp nối (key trái → key phải)</div>
                    @for (p of e.pairs; track $index) {
                      <div class="opt-row">
                        <input nz-input class="k" [(ngModel)]="p.left" [ngModelOptions]="{standalone:true}" placeholder="1" />
                        <span>→</span>
                        <input nz-input class="k" [(ngModel)]="p.right" [ngModelOptions]="{standalone:true}" placeholder="a" />
                        <button nz-button nzType="text" nzDanger (click)="e.pairs.splice($index,1)"><nz-icon nzType="minus" /></button>
                      </div>
                    }
                    <button nz-button nzSize="small" (click)="e.pairs.push({left:'',right:''})"><nz-icon nzType="plus" /> Thêm cặp</button>
                  </nz-form-control></nz-form-item>
              }
            }

            <nz-form-item><nz-form-label>Giải thích (vì sao đúng)</nz-form-label>
              <nz-form-control><textarea nz-input [(ngModel)]="e.explanation" name="ex" rows="2"></textarea></nz-form-control></nz-form-item>
          </form>
        </ng-container>
      </nz-modal>
    }

    <!-- Modal giao đề cho lớp -->
    @if (assignOpen()) {
      <nz-modal [nzVisible]="true" nzTitle="Giao đề cho lớp" [nzOkLoading]="assigning()" (nzOnOk)="doAssign()" (nzOnCancel)="assignOpen.set(false)">
        <ng-container *nzModalContent>
          <form nz-form nzLayout="vertical">
            <nz-form-item><nz-form-label nzRequired>Lớp</nz-form-label>
              <nz-form-control><nz-select class="full" nzShowSearch [(ngModel)]="asgClassId" name="cls" nzPlaceHolder="Chọn lớp">
                @for (c of classes(); track c.id) { <nz-option [nzValue]="c.id" [nzLabel]="c.name" /> }
              </nz-select></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label>Hình thức</nz-form-label>
              <nz-form-control><nz-radio-group [(ngModel)]="asgMode" name="mode">
                <label nz-radio-button nzValue="InClass">Trên lớp</label>
                <label nz-radio-button nzValue="Homework">Về nhà</label>
              </nz-radio-group></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label>Thời gian làm (phút)</nz-form-label>
              <nz-form-control><nz-input-number [(ngModel)]="asgDuration" name="dur" [nzMin]="1" [nzMax]="300" /></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label nzRequired>Mở lúc</nz-form-label>
              <nz-form-control><nz-date-picker class="full" [(ngModel)]="asgOpenAt" name="open" nzShowTime nzFormat="dd/MM/yyyy HH:mm" /></nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label>Hạn nộp (tùy chọn)</nz-form-label>
              <nz-form-control><nz-date-picker class="full" [(ngModel)]="asgCloseAt" name="close" nzShowTime nzFormat="dd/MM/yyyy HH:mm" /></nz-form-control></nz-form-item>
          </form>
        </ng-container>
      </nz-modal>
    }
  `,
  styles: `
    .center { text-align: center; padding: 48px; }
    .meta { display: flex; gap: 8px; margin-bottom: 12px; }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
    .split.no-pdf { grid-template-columns: 1fr; }
    .pdf { position: sticky; top: 0; height: calc(100vh - 200px); }
    .pdf iframe { width: 100%; height: 100%; border: 1px solid var(--hs-border); border-radius: var(--hs-radius); }
    .questions { display: flex; flex-direction: column; gap: 12px; }
    .group-card { background: var(--hs-surface-alt, #f5f7ff); }
    .passage { white-space: pre-wrap; margin: 0; }
    .q-card .q-head { display: flex; align-items: center; gap: 8px; }
    .q-no { font-weight: 700; }
    .q-stem { font-weight: 500; white-space: pre-wrap; }
    .spacer { flex: 1; }
    .opts { list-style: none; margin: 8px 0 0; padding: 0; }
    .opts li { padding: 4px 8px; border-radius: var(--hs-radius-sm); }
    .opts li.correct { background: rgba(22,163,74,0.12); color: #16A34A; }
    .opts .ok { margin-left: 6px; }
    .answer { margin-top: 8px; }
    .expl { margin-top: 4px; color: var(--hs-text-muted); }
    .muted { color: var(--hs-text-muted); }
    .opt-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .opt-row .k { max-width: 64px; }
    .opt-radio { display: block; }
    .blank-no { min-width: 48px; }
    .match-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .col-h { font-weight: 600; margin: 8px 0 4px; }
    .assign-card { margin-bottom: 12px; }
    .asg-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--hs-border); flex-wrap: wrap; }
    .asg-row:last-child { border-bottom: none; }
    .full { width: 100%; }
    @media (max-width: 991px) { .split { grid-template-columns: 1fr; } .pdf { height: 60vh; position: static; } }
  `
})
export class ExamDetailPage implements OnInit, OnDestroy {
  private readonly examService = inject(ExamService);
  private readonly classesService = inject(ClassesService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly sanitizer = inject(DomSanitizer);
  private objectUrl: string | null = null;

  readonly id = input.required<string>();

  protected readonly typeLabels = EXAM_TYPE_LABELS;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  private readonly detailRaw = signal<ExamDetail | null>(null);
  protected readonly detail = computed(() => {
    const d = this.detailRaw();
    return d ? { ...d, questionCount: () => d.questions.length } : null;
  });
  protected readonly allQuestions = computed(() => this.detailRaw()?.questions ?? []);
  protected readonly sections = signal<Section[]>([]);
  protected readonly pdfUrl = signal<SafeResourceUrl | null>(null);

  // Sửa thông tin đề
  protected readonly metaOpen = signal(false);
  protected mTitle = '';
  protected mDescription = '';
  protected mDuration = 60;

  // Sửa/thêm câu hỏi
  protected readonly edit = signal<EditQuestion | null>(null);

  // Giao đề cho lớp
  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly assignments = signal<ExamAssignment[]>([]);
  protected readonly assignOpen = signal(false);
  protected readonly assigning = signal(false);
  protected asgClassId: string | null = null;
  protected asgMode: ExamDeliveryMode = 'InClass';
  protected asgDuration = 60;
  protected asgOpenAt: Date | null = null;
  protected asgCloseAt: Date | null = null;

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.examService.detail(this.id()).subscribe({
      next: d => {
        this.detailRaw.set(d);
        this.buildSections(d);
        this.loadPdf(d.sourceFileUrl);
        if (d.status === 'Published') this.loadAssignments();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  /** Tải PDF gốc dạng blob (qua HttpClient để đính kèm token) rồi tạo object URL cho iframe. */
  private loadPdf(url: string | null): void {
    if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
    this.pdfUrl.set(null);
    if (!url) return;
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: blob => {
        this.objectUrl = URL.createObjectURL(blob);
        this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
      },
      error: () => this.pdfUrl.set(null)
    });
  }

  ngOnDestroy(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }

  private buildSections(d: ExamDetail): void {
    const byGroup = new Map<string | null, QView[]>();
    for (const q of d.questions) {
      const key = q.groupId ?? null;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(this.buildView(q));
    }
    const sections: Section[] = [];
    for (const g of d.groups) {
      const items = byGroup.get(g.id);
      if (items?.length) {
        sections.push({ groupId: g.id, title: g.exerciseLabel || g.section, passage: g.passage, items });
        byGroup.delete(g.id);
      }
    }
    const ungrouped = byGroup.get(null);
    if (ungrouped?.length) sections.push({ groupId: null, title: null, passage: null, items: ungrouped });
    this.sections.set(sections);
  }

  private buildView(q: ExamQuestion): QView {
    const options: { key: string; text: string; correct: boolean }[] = [];
    let answerSummary = '';
    try {
      if (q.type === 'SingleChoice') {
        const opts = q.optionsJson ? JSON.parse(q.optionsJson) as ExamOption[] : [];
        const key = (JSON.parse(q.answerJson).key ?? '') as string;
        for (const o of opts) options.push({ key: o.key, text: o.text, correct: o.key === key });
        answerSummary = key;
      } else if (q.type === 'TrueFalse') {
        answerSummary = JSON.parse(q.answerJson).value ? 'Đúng' : 'Sai';
      } else if (q.type === 'FillBlank') {
        const blanks = (JSON.parse(q.answerJson).blanks ?? []) as string[][];
        answerSummary = blanks.map((b, i) => `Ô${i + 1}: ${b.join(' / ')}`).join('  •  ');
      } else if (q.type === 'Matching') {
        const pairs = (JSON.parse(q.answerJson).pairs ?? {}) as Record<string, string>;
        answerSummary = Object.entries(pairs).map(([l, r]) => `${l}→${r}`).join(', ');
      }
    } catch { /* JSON hỏng — hiển thị rỗng, GV sửa lại */ }
    return { q, options, answerSummary };
  }

  protected back(): void {
    const d = this.detailRaw();
    if (d?.materialId) this.router.navigate(['/materials', d.materialId, 'exams']);
    else this.router.navigate(['/materials']);
  }

  // ---- Sửa thông tin đề ----
  protected openMeta(): void {
    const d = this.detailRaw();
    if (!d) return;
    this.mTitle = d.title;
    this.mDescription = d.description ?? '';
    this.mDuration = d.durationMinutes;
    this.metaOpen.set(true);
  }

  protected saveMeta(): void {
    if (!this.mTitle.trim()) { this.message.warning('Nhập tên đề.'); return; }
    this.saving.set(true);
    this.examService.update(this.id(), {
      title: this.mTitle.trim(),
      description: this.mDescription.trim() || null,
      gradeBand: this.detailRaw()?.gradeBand ?? null,
      durationMinutes: this.mDuration
    }).subscribe({
      next: d => { this.saving.set(false); this.metaOpen.set(false); this.detailRaw.set(d); this.buildSections(d); this.message.success('Đã lưu.'); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message); }
    });
  }

  // ---- Sửa/thêm câu hỏi ----
  protected addQuestion(): void {
    this.edit.set({
      id: null, groupId: null, type: 'SingleChoice', stem: '',
      options: [{ key: 'A', text: '' }, { key: 'B', text: '' }], optionsRight: [],
      answerKey: 'A', trueFalse: true, blanks: [''], wordBox: '', pairs: [], explanation: '', points: null
    });
  }

  protected editQuestion(q: ExamQuestion): void {
    const e: EditQuestion = {
      id: q.id, groupId: q.groupId, type: q.type, stem: q.stem,
      options: [], optionsRight: [], answerKey: '', trueFalse: true, blanks: [], wordBox: '', pairs: [],
      explanation: q.explanation ?? '', points: q.points
    };
    try {
      if (q.type === 'SingleChoice') {
        e.options = q.optionsJson ? JSON.parse(q.optionsJson) : [];
        e.answerKey = JSON.parse(q.answerJson).key ?? '';
      } else if (q.type === 'TrueFalse') {
        e.trueFalse = !!JSON.parse(q.answerJson).value;
      } else if (q.type === 'FillBlank') {
        const opt = q.optionsJson ? JSON.parse(q.optionsJson) : {};
        e.wordBox = (opt.wordBox ?? []).join(', ');
        e.blanks = ((JSON.parse(q.answerJson).blanks ?? []) as string[][]).map(b => b.join(' / '));
        if (e.blanks.length === 0) e.blanks = [''];
      } else if (q.type === 'Matching') {
        const opt = q.optionsJson ? JSON.parse(q.optionsJson) : {};
        e.options = opt.left ?? [];
        e.optionsRight = opt.right ?? [];
        const pairs = JSON.parse(q.answerJson).pairs ?? {};
        e.pairs = Object.entries(pairs).map(([left, right]) => ({ left, right: right as string }));
      }
    } catch { /* JSON hỏng — để GV nhập lại */ }
    this.edit.set(e);
  }

  protected onTypeChange(e: EditQuestion): void {
    if (e.type === 'SingleChoice' && e.options.length === 0) e.options = [{ key: 'A', text: '' }, { key: 'B', text: '' }];
    if (e.type === 'FillBlank' && e.blanks.length === 0) e.blanks = [''];
  }

  protected saveQuestion(): void {
    const e = this.edit();
    if (!e) return;
    if (!e.stem.trim()) { this.message.warning('Nhập nội dung câu hỏi.'); return; }

    const req: UpsertQuestionRequest = {
      groupId: e.groupId,
      type: e.type,
      stem: e.stem.trim(),
      options: (e.type === 'SingleChoice' || e.type === 'Matching') ? e.options : null,
      optionsRight: e.type === 'Matching' ? e.optionsRight : null,
      answerKey: e.type === 'SingleChoice' ? e.answerKey : (e.type === 'TrueFalse' ? String(e.trueFalse) : null),
      answerBlanks: e.type === 'FillBlank' ? e.blanks.filter(b => b.trim()) : null,
      wordBox: e.type === 'FillBlank' && e.wordBox.trim() ? e.wordBox.split(',').map(x => x.trim()).filter(Boolean) : null,
      answerPairs: e.type === 'Matching' ? e.pairs : null,
      explanation: e.explanation.trim() || null,
      points: e.points
    };

    this.saving.set(true);
    const op = e.id
      ? this.examService.updateQuestion(this.id(), e.id, req)
      : this.examService.addQuestion(this.id(), req);
    op.subscribe({
      next: () => { this.saving.set(false); this.edit.set(null); this.message.success('Đã lưu câu hỏi.'); this.load(); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error(err.error?.message ?? err.message ?? 'Lưu thất bại.'); }
    });
  }

  protected removeQuestion(q: ExamQuestion): void {
    this.examService.deleteQuestion(this.id(), q.id).subscribe({
      next: () => { this.message.success('Đã xóa câu.'); this.load(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ?? 'Xóa thất bại.')
    });
  }

  protected publish(): void {
    this.examService.publish(this.id()).subscribe({
      next: () => { this.message.success('Đã phát hành đề.'); this.load(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message ?? 'Phát hành thất bại.')
    });
  }

  // ---- Giao đề cho lớp ----

  private loadAssignments(): void {
    this.examService.listAssignments(this.id()).subscribe({ next: a => this.assignments.set(a), error: () => { /* im lặng */ } });
  }

  protected openAssign(): void {
    this.asgClassId = null;
    this.asgMode = 'InClass';
    this.asgDuration = this.detailRaw()?.durationMinutes ?? 60;
    this.asgOpenAt = new Date();
    this.asgCloseAt = null;
    if (this.classes().length === 0)
      this.classesService.getPaged({ page: 1, pageSize: 200 }).subscribe(r => this.classes.set(r.items));
    this.assignOpen.set(true);
  }

  protected doAssign(): void {
    if (!this.asgClassId) { this.message.warning('Chọn lớp.'); return; }
    if (!this.asgOpenAt) { this.message.warning('Chọn thời gian mở.'); return; }
    const req: AssignExamRequest = {
      classId: this.asgClassId,
      classSessionId: null,
      mode: this.asgMode,
      durationMinutes: this.asgDuration,
      openAt: this.asgOpenAt.toISOString(),
      closeAt: this.asgCloseAt ? this.asgCloseAt.toISOString() : null
    };
    this.assigning.set(true);
    this.examService.assign(this.id(), req).subscribe({
      next: () => { this.assigning.set(false); this.assignOpen.set(false); this.message.success('Đã giao đề cho lớp.'); this.loadAssignments(); },
      error: (err: HttpErrorResponse) => { this.assigning.set(false); this.message.error(err.error?.message ?? err.message ?? 'Giao đề thất bại.'); }
    });
  }

  protected closeAssignment(a: ExamAssignment): void {
    this.examService.closeAssignment(a.id).subscribe({
      next: () => { this.message.success('Đã đóng lượt giao.'); this.loadAssignments(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message)
    });
  }

  protected openReport(a: ExamAssignment): void {
    this.router.navigate(['/exams/assignments', a.id, 'report']);
  }
}
