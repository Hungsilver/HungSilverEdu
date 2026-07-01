import { Component, OnInit, inject, input, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { RouterLink } from '@angular/router';
import { PortalService } from '../../core/portal.service';
import { EXAM_TYPE_LABELS, PortalReview, PortalReviewQuestion } from '../../core/models';
import { PageHeader } from '../../shared/page-header';

interface RView {
  q: PortalReviewQuestion;
  options: { key: string; text: string; correct: boolean; chosen: boolean }[];
  correctText: string;
  yourText: string;
}

interface Section { title: string | null; passage: string | null; items: RView[]; }

@Component({
  selector: 'app-exam-review-page',
  imports: [NzCardModule, NzButtonModule, NzIconModule, NzTagModule, NzResultModule, NzSpinModule, RouterLink, PageHeader],
  template: `
    <app-page-header title="Xem lại bài làm" subtitle="Đáp án đúng + giải thích" icon="file-search">
      <a nz-button routerLink="/portal"><nz-icon nzType="arrow-left" /> Về trang chính</a>
    </app-page-header>

    @if (loading()) {
      <div class="center"><nz-spin nzSimple /></div>
    } @else if (review(); as r) {
      <nz-result [nzStatus]="r.score >= r.totalPoints / 2 ? 'success' : 'warning'"
        [nzTitle]="'Điểm: ' + r.score + ' / ' + r.totalPoints"
        [nzSubTitle]="'Đúng ' + r.correctCount + '/' + r.totalCount + ' câu · ' + statusText(r.status)">
      </nz-result>

      <div class="questions">
        @for (sec of sections(); track $index) {
          @if (sec.title || sec.passage) {
            <nz-card class="group-card" [nzTitle]="sec.title || 'Ngữ liệu'">
              @if (sec.passage) { <p class="passage">{{ sec.passage }}</p> }
            </nz-card>
          }
          @for (v of sec.items; track v.q.id) {
            <nz-card class="q-card" [class.wrong]="v.q.isCorrect === false" [class.ok]="v.q.isCorrect === true">
              <div class="q-head">
                <span class="q-no">{{ v.q.orderNo + 1 }}.</span>
                <nz-tag>{{ typeLabels[v.q.type] }}</nz-tag>
                @if (v.q.isCorrect === true) { <nz-tag nzColor="success"><nz-icon nzType="check" /> Đúng</nz-tag> }
                @else if (v.q.isCorrect === false) { <nz-tag nzColor="error"><nz-icon nzType="close" /> Sai</nz-tag> }
                <span class="pts">{{ v.q.awardedPoints }}/{{ v.q.points }}đ</span>
              </div>
              <div class="q-stem">{{ v.q.stem }}</div>

              @if (v.options.length) {
                <ul class="opts">
                  @for (o of v.options; track o.key) {
                    <li [class.correct]="o.correct" [class.chosen-wrong]="o.chosen && !o.correct">
                      <strong>{{ o.key }}.</strong> {{ o.text }}
                      @if (o.correct) { <nz-icon nzType="check" class="c" /> }
                      @if (o.chosen && !o.correct) { <nz-icon nzType="close" class="x" /> }
                    </li>
                  }
                </ul>
              } @else {
                <div class="your"><strong>Bạn trả lời:</strong> {{ v.yourText }}</div>
              }
              <div class="answer"><strong>Đáp án đúng:</strong> {{ v.correctText }}</div>
              @if (v.q.explanation) { <div class="expl"><strong>Giải thích:</strong> {{ v.q.explanation }}</div> }
            </nz-card>
          }
        }
      </div>
    } @else {
      <p class="muted">Không tải được bài làm.</p>
    }
  `,
  styles: `
    .center { text-align: center; padding: 48px; }
    .questions { display: flex; flex-direction: column; gap: 12px; }
    .group-card { background: var(--hs-surface-alt, #f5f7ff); }
    .passage { white-space: pre-wrap; margin: 0; }
    .q-card.wrong { border-left: 3px solid #DC2626; }
    .q-card.ok { border-left: 3px solid #16A34A; }
    .q-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .q-no { font-weight: 700; }
    .pts { margin-left: auto; color: var(--hs-text-muted); }
    .q-stem { font-weight: 500; white-space: pre-wrap; }
    .opts { list-style: none; margin: 8px 0 0; padding: 0; }
    .opts li { padding: 4px 8px; border-radius: var(--hs-radius-sm); }
    .opts li.correct { background: rgba(22,163,74,0.12); color: #16A34A; }
    .opts li.chosen-wrong { background: rgba(220,38,38,0.1); color: #DC2626; }
    .opts .c { margin-left: 6px; color: #16A34A; }
    .opts .x { margin-left: 6px; color: #DC2626; }
    .your { margin-top: 8px; }
    .answer { margin-top: 6px; }
    .expl { margin-top: 4px; color: var(--hs-text-muted); }
    .muted { color: var(--hs-text-muted); }
  `
})
export class ExamReviewPage implements OnInit {
  private readonly portal = inject(PortalService);

  readonly attemptId = input.required<string>();

  protected readonly typeLabels = EXAM_TYPE_LABELS;
  protected readonly loading = signal(true);
  protected readonly review = signal<PortalReview | null>(null);
  protected readonly sections = signal<Section[]>([]);

  ngOnInit(): void {
    this.portal.reviewExam(this.attemptId()).subscribe({
      next: r => { this.review.set(r); this.buildSections(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected statusText(s: string): string {
    return s === 'AutoSubmitted' ? 'hết giờ tự nộp' : 'đã nộp';
  }

  private buildSections(r: PortalReview): void {
    const byGroup = new Map<string | null, RView[]>();
    for (const q of r.questions) {
      const key = q.groupId ?? null;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(this.buildView(q));
    }
    const sections: Section[] = [];
    for (const g of r.groups) {
      const items = byGroup.get(g.id);
      if (items?.length) { sections.push({ title: g.exerciseLabel || g.section, passage: g.passage, items }); byGroup.delete(g.id); }
    }
    const ungrouped = byGroup.get(null);
    if (ungrouped?.length) sections.push({ title: null, passage: null, items: ungrouped });
    this.sections.set(sections);
  }

  private buildView(q: PortalReviewQuestion): RView {
    const options: RView['options'] = [];
    let correctText = '';
    let yourText = '(chưa trả lời)';
    try {
      const ans = JSON.parse(q.answerJson);
      const resp = q.responseJson ? JSON.parse(q.responseJson) : null;
      if (q.type === 'SingleChoice') {
        const opts = q.optionsJson ? JSON.parse(q.optionsJson) as { key: string; text: string }[] : [];
        const ck = ans.key ?? ''; const yk = resp?.key ?? '';
        for (const o of opts) options.push({ key: o.key, text: o.text, correct: o.key === ck, chosen: o.key === yk });
        correctText = ck; yourText = yk || '(chưa trả lời)';
      } else if (q.type === 'TrueFalse') {
        correctText = ans.value ? 'Đúng' : 'Sai';
        yourText = resp ? (resp.value ? 'Đúng' : 'Sai') : '(chưa trả lời)';
      } else if (q.type === 'FillBlank') {
        const acc = (ans.blanks ?? []) as string[][];
        correctText = acc.map((b, i) => `Ô${i + 1}: ${b.join(' / ')}`).join('   ');
        const your = (resp?.blanks ?? []) as string[];
        yourText = your.length ? your.map((x, i) => `Ô${i + 1}: ${x || '—'}`).join('   ') : '(chưa trả lời)';
      } else if (q.type === 'Matching') {
        const cp = (ans.pairs ?? {}) as Record<string, string>;
        correctText = Object.entries(cp).map(([l, r]) => `${l}→${r}`).join(', ');
        const yp = (resp?.pairs ?? {}) as Record<string, string>;
        const yEntries = Object.entries(yp).filter(([, r]) => r);
        yourText = yEntries.length ? yEntries.map(([l, r]) => `${l}→${r}`).join(', ') : '(chưa trả lời)';
      }
    } catch { /* JSON hỏng — hiển thị trống */ }
    return { q, options, correctText, yourText };
  }
}
