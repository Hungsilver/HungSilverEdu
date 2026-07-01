import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PortalService } from '../../core/portal.service';
import { EXAM_TYPE_LABELS, PortalAttempt, PortalQuestion } from '../../core/models';
import { PageHeader } from '../../shared/page-header';

interface TakeQ {
  q: PortalQuestion;
  options: { key: string; text: string }[]; // SingleChoice, hoặc cột trái của Matching
  right: { key: string; text: string }[];    // cột phải của Matching
  blankCount: number;                          // FillBlank
  wordBox: string[];                           // FillBlank (gợi ý)
}

interface Section { title: string | null; passage: string | null; items: TakeQ[]; }

@Component({
  selector: 'app-exam-take-page',
  imports: [
    FormsModule,
    NzCardModule, NzButtonModule, NzIconModule, NzTagModule, NzRadioModule, NzInputModule, NzSelectModule,
    NzProgressModule, NzModalModule, NzAlertModule, NzSpinModule, PageHeader
  ],
  template: `
    @if (loading()) {
      <div class="center"><nz-spin nzSimple /></div>
    } @else if (attempt(); as a) {
      <app-page-header [title]="a.examTitle" subtitle="Làm bài — chọn đáp án, hệ thống tự lưu" icon="form">
        <div class="timer" [class.warn]="remaining() <= 60">
          <nz-icon nzType="clock-circle" /> {{ mmss() }}
        </div>
        <button nz-button nzType="primary" (click)="confirmSubmit()"><nz-icon nzType="check" /> Nộp bài</button>
      </app-page-header>

      <nz-progress [nzPercent]="answeredPercent()" nzSize="small" [nzShowInfo]="true"
        [nzFormat]="progressFormat" nzStatus="active" />

      <div class="questions">
        @for (sec of sections(); track $index) {
          @if (sec.title || sec.passage) {
            <nz-card class="group-card" [nzTitle]="sec.title || 'Ngữ liệu'">
              @if (sec.passage) { <p class="passage">{{ sec.passage }}</p> }
            </nz-card>
          }
          @for (v of sec.items; track v.q.id) {
            <nz-card class="q-card">
              <div class="q-head">
                <span class="q-no">{{ v.q.orderNo + 1 }}.</span>
                <nz-tag>{{ typeLabels[v.q.type] }}</nz-tag>
                <span class="q-stem">{{ v.q.stem }}</span>
              </div>

              @switch (v.q.type) {
                @case ('SingleChoice') {
                  <nz-radio-group class="opts" [(ngModel)]="answers[v.q.id]" (ngModelChange)="onAnswer(v.q)">
                    @for (o of v.options; track o.key) {
                      <label nz-radio [nzValue]="o.key"><strong>{{ o.key }}.</strong> {{ o.text }}</label>
                    }
                  </nz-radio-group>
                }
                @case ('TrueFalse') {
                  <nz-radio-group [(ngModel)]="answers[v.q.id]" (ngModelChange)="onAnswer(v.q)">
                    <label nz-radio-button [nzValue]="true">Đúng</label>
                    <label nz-radio-button [nzValue]="false">Sai</label>
                  </nz-radio-group>
                }
                @case ('FillBlank') {
                  @if (v.wordBox.length) {
                    <div class="wordbox">Hộp từ: @for (w of v.wordBox; track w) { <nz-tag>{{ w }}</nz-tag> }</div>
                  }
                  @for (i of blanks(v.blankCount); track i) {
                    <div class="blank-row">
                      <span>Ô {{ i + 1 }}</span>
                      <input nz-input [(ngModel)]="answers[v.q.id][i]" (ngModelChange)="onAnswer(v.q)" [ngModelOptions]="{standalone:true}" />
                    </div>
                  }
                }
                @case ('Matching') {
                  @for (l of v.options; track l.key) {
                    <div class="match-row">
                      <span class="ml"><strong>{{ l.key }}.</strong> {{ l.text }}</span>
                      <nz-select class="mr" nzPlaceHolder="Chọn" [(ngModel)]="answers[v.q.id][l.key]"
                        (ngModelChange)="onAnswer(v.q)" [ngModelOptions]="{standalone:true}" nzAllowClear>
                        @for (r of v.right; track r.key) { <nz-option [nzValue]="r.key" [nzLabel]="r.key + '. ' + r.text" /> }
                      </nz-select>
                    </div>
                  }
                }
              }
            </nz-card>
          }
        }
      </div>

      <div class="footer">
        <button nz-button nzType="primary" nzSize="large" (click)="confirmSubmit()"><nz-icon nzType="check" /> Nộp bài</button>
      </div>
    } @else {
      <nz-alert nzType="error" nzMessage="Không mở được đề. Có thể chưa đến giờ, đã hết hạn, hoặc bạn đã nộp." nzShowIcon />
      <button nz-button class="back" (click)="router.navigate(['/portal'])"><nz-icon nzType="arrow-left" /> Về trang chính</button>
    }
  `,
  styles: `
    .center { text-align: center; padding: 48px; }
    .timer { font-weight: 700; font-size: 18px; color: var(--hs-primary); display: flex; align-items: center; gap: 6px; }
    .timer.warn { color: #DC2626; }
    .questions { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
    .group-card { background: var(--hs-surface-alt, #f5f7ff); }
    .passage { white-space: pre-wrap; margin: 0; }
    .q-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
    .q-no { font-weight: 700; }
    .q-stem { font-weight: 500; white-space: pre-wrap; }
    .opts { display: flex; flex-direction: column; gap: 6px; }
    .wordbox { margin-bottom: 8px; color: var(--hs-text-muted); }
    .blank-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .blank-row span { min-width: 40px; }
    .blank-row input { max-width: 320px; }
    .match-row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
    .match-row .ml { flex: 1; }
    .match-row .mr { min-width: 160px; }
    .footer { margin: 24px 0; text-align: center; }
    .back { margin-top: 12px; }
    @media (max-width: 575px) { .match-row { flex-direction: column; align-items: stretch; } .match-row .mr { width: 100%; } }
  `
})
export class ExamTakePage implements OnInit, OnDestroy {
  private readonly portal = inject(PortalService);
  protected readonly router = inject(Router);
  private readonly modal = inject(NzModalService);

  readonly assignmentId = input.required<string>();

  protected readonly typeLabels = EXAM_TYPE_LABELS;
  protected readonly loading = signal(true);
  protected readonly attempt = signal<PortalAttempt | null>(null);
  protected readonly sections = signal<Section[]>([]);
  protected readonly remaining = signal(0);
  protected answers: Record<string, any> = {};
  private timer?: ReturnType<typeof setInterval>;
  private submitting = false;

  ngOnInit(): void {
    this.portal.startExam(this.assignmentId()).subscribe({
      next: a => {
        this.attempt.set(a);
        this.initAnswers(a);
        this.buildSections(a);
        this.loading.set(false);
        this.startTimer();
      },
      error: () => this.loading.set(false)
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  protected blanks(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  protected mmss(): string {
    const s = this.remaining();
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  protected progressFormat = () => {
    const total = this.attempt()?.questions.length ?? 0;
    return `${this.answeredCount()}/${total}`;
  };

  protected answeredPercent(): number {
    const total = this.attempt()?.questions.length ?? 0;
    return total === 0 ? 0 : Math.round((this.answeredCount() / total) * 100);
  }

  private answeredCount(): number {
    const qs = this.attempt()?.questions ?? [];
    return qs.filter(q => this.hasAnswer(q)).length;
  }

  private hasAnswer(q: PortalQuestion): boolean {
    const a = this.answers[q.id];
    if (a === undefined || a === null) return false;
    if (q.type === 'FillBlank') return Array.isArray(a) && a.some((x: string) => (x ?? '').trim());
    if (q.type === 'Matching') return a && Object.values(a).some(v => v);
    if (q.type === 'TrueFalse') return typeof a === 'boolean';
    return !!a;
  }

  private initAnswers(a: PortalAttempt): void {
    for (const q of a.questions) {
      if (q.type === 'FillBlank') this.answers[q.id] = Array.from({ length: this.blankCount(q.optionsJson) }, () => '');
      else if (q.type === 'Matching') this.answers[q.id] = {};
      else this.answers[q.id] = null;
    }
    // Khôi phục đáp án đã lưu (làm dở).
    for (const saved of a.savedAnswers) {
      if (!saved.responseJson) continue;
      try {
        const r = JSON.parse(saved.responseJson);
        const q = a.questions.find(x => x.id === saved.questionId);
        if (!q) continue;
        if (q.type === 'SingleChoice') this.answers[q.id] = r.key ?? null;
        else if (q.type === 'TrueFalse') this.answers[q.id] = r.value ?? null;
        else if (q.type === 'FillBlank') this.answers[q.id] = r.blanks ?? this.answers[q.id];
        else if (q.type === 'Matching') this.answers[q.id] = r.pairs ?? {};
      } catch { /* bỏ qua bản lưu hỏng */ }
    }
  }

  private blankCount(optionsJson: string | null): number {
    if (!optionsJson) return 1;
    try { return JSON.parse(optionsJson).blanks ?? 1; } catch { return 1; }
  }

  private buildSections(a: PortalAttempt): void {
    const build = (q: PortalQuestion): TakeQ => {
      let options: { key: string; text: string }[] = [];
      let right: { key: string; text: string }[] = [];
      let blankCount = 0;
      let wordBox: string[] = [];
      try {
        if (q.type === 'SingleChoice') options = q.optionsJson ? JSON.parse(q.optionsJson) : [];
        else if (q.type === 'FillBlank') {
          const o = q.optionsJson ? JSON.parse(q.optionsJson) : {};
          blankCount = o.blanks ?? 1; wordBox = o.wordBox ?? [];
        } else if (q.type === 'Matching') {
          const o = q.optionsJson ? JSON.parse(q.optionsJson) : {};
          options = o.left ?? []; right = o.right ?? [];
        }
      } catch { /* JSON hỏng — hiển thị trống */ }
      return { q, options, right, blankCount, wordBox };
    };

    const byGroup = new Map<string | null, TakeQ[]>();
    for (const q of a.questions) {
      const key = q.groupId ?? null;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(build(q));
    }
    const sections: Section[] = [];
    for (const g of a.groups) {
      const items = byGroup.get(g.id);
      if (items?.length) { sections.push({ title: g.exerciseLabel || g.section, passage: g.passage, items }); byGroup.delete(g.id); }
    }
    const ungrouped = byGroup.get(null);
    if (ungrouped?.length) sections.push({ title: null, passage: null, items: ungrouped });
    this.sections.set(sections);
  }

  private startTimer(): void {
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  private tick(): void {
    const a = this.attempt();
    if (!a) return;
    const rem = Math.max(0, Math.floor((new Date(a.expiresAt).getTime() - Date.now()) / 1000));
    this.remaining.set(rem);
    if (rem <= 0) {
      if (this.timer) clearInterval(this.timer);
      this.doSubmit(true);
    }
  }

  protected onAnswer(q: PortalQuestion): void {
    const json = this.buildResponse(q);
    this.portal.saveExamAnswer(this.attempt()!.attemptId, { questionId: q.id, responseJson: json }).subscribe({ error: () => { /* im lặng; sẽ chấm phần đã lưu */ } });
  }

  private buildResponse(q: PortalQuestion): string {
    const a = this.answers[q.id];
    switch (q.type) {
      case 'SingleChoice': return JSON.stringify({ key: a ?? '' });
      case 'TrueFalse': return JSON.stringify({ value: !!a });
      case 'FillBlank': return JSON.stringify({ blanks: a ?? [] });
      case 'Matching': return JSON.stringify({ pairs: a ?? {} });
      default: return '{}';
    }
  }

  protected confirmSubmit(): void {
    this.modal.confirm({
      nzTitle: 'Nộp bài?',
      nzContent: 'Sau khi nộp sẽ không sửa được. Bạn chắc chắn?',
      nzOkText: 'Nộp bài',
      nzCancelText: 'Tiếp tục làm',
      nzOnOk: () => this.doSubmit(false)
    });
  }

  private doSubmit(auto: boolean): void {
    if (this.submitting) return;
    this.submitting = true;
    const attemptId = this.attempt()!.attemptId;
    this.portal.submitExam(attemptId).subscribe({
      next: () => this.router.navigate(['/portal/attempts', attemptId, 'review']),
      error: (e: HttpErrorResponse) => {
        this.submitting = false;
        if (!auto) this.modal.error({ nzTitle: 'Nộp thất bại', nzContent: e.error?.message ?? e.message });
        else this.router.navigate(['/portal/attempts', attemptId, 'review']);
      }
    });
  }
}
