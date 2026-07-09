import { Component, OnInit, inject, input, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { RouterLink } from '@angular/router';
import { PortalService } from '../../core/portal.service';
import { PortalReview } from '../../core/models';
import { PageHeader } from '../../shared/page-header';
import { ExamReviewContent } from '../../shared/exam-review-content';

@Component({
  selector: 'app-exam-review-page',
  imports: [NzButtonModule, NzIconModule, NzResultModule, NzSpinModule, RouterLink, PageHeader, ExamReviewContent],
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

      <app-exam-review-content [review]="r" />
    } @else {
      <p class="muted">Không tải được bài làm.</p>
    }
  `,
  styles: `
    .center { text-align: center; padding: 48px; }
    .muted { color: var(--hs-text-muted); }
  `
})
export class ExamReviewPage implements OnInit {
  private readonly portal = inject(PortalService);

  readonly attemptId = input.required<string>();

  protected readonly loading = signal(true);
  protected readonly review = signal<PortalReview | null>(null);

  ngOnInit(): void {
    this.portal.reviewExam(this.attemptId()).subscribe({
      next: r => { this.review.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected statusText(s: string): string {
    return s === 'AutoSubmitted' ? 'hết giờ tự nộp' : 'đã nộp';
  }
}
