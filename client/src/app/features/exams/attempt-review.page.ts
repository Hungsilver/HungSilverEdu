import { Location } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ExamService } from '../../core/exam.service';
import { TeacherAttemptReview } from '../../core/models';
import { PageHeader } from '../../shared/page-header';
import { ExamReviewContent } from '../../shared/exam-review-content';

/** GV xem bài làm một học viên đã nộp: điểm + bài làm vs đáp án đúng + giải thích từng câu. */
@Component({
  selector: 'app-attempt-review-page',
  imports: [NzButtonModule, NzIconModule, NzSpinModule, NzTagModule, PageHeader, ExamReviewContent],
  template: `
    <button type="button" class="back" (click)="goBack()"><nz-icon nzType="arrow-left" /> Quay lại</button>

    @if (loading()) {
      <div class="center"><nz-spin nzSimple /></div>
    } @else if (data(); as d) {
      <app-page-header
        [title]="'Bài làm: ' + d.studentName"
        [subtitle]="d.review.examTitle"
        icon="file-search">
        <div class="score">
          <nz-tag [nzColor]="d.review.score >= d.review.totalPoints / 2 ? 'success' : 'warning'">
            {{ d.review.score }}/{{ d.review.totalPoints }}đ
          </nz-tag>
          <span class="muted">Đúng {{ d.review.correctCount }}/{{ d.review.totalCount }} câu · {{ statusText(d.review.status) }}</span>
        </div>
      </app-page-header>

      <app-exam-review-content [review]="d.review" />
    } @else {
      <p class="muted">Không tải được bài làm — học viên có thể chưa nộp.</p>
    }
  `,
  styles: `
    .back { border: 0; background: none; color: var(--hs-primary); cursor: pointer; padding: 0 0 8px; display: inline-flex; align-items: center; gap: 6px; }
    .center { text-align: center; padding: 48px; }
    .score { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .muted { color: var(--hs-text-muted); }
  `
})
export class AttemptReviewPage implements OnInit {
  private readonly examService = inject(ExamService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  readonly attemptId = input.required<string>();

  protected readonly loading = signal(true);
  protected readonly data = signal<TeacherAttemptReview | null>(null);

  ngOnInit(): void {
    this.examService.attemptReview(this.attemptId()).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected statusText(s: string): string {
    return s === 'AutoSubmitted' ? 'hết giờ tự nộp' : 'đã nộp';
  }

  protected goBack(): void {
    if (history.length > 1) this.location.back();
    else this.router.navigate(['/schedule']);
  }
}
