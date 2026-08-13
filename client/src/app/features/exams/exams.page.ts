import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { GradesService } from '../../core/grades.service';
import { Grade, Subject } from '../../core/models';
import { SubjectsService } from '../../core/subjects.service';
import { PageHeader } from '../../shared/page-header';
import { ExamAssignmentsTab } from './exam-assignments.tab';
import { ExamBankTab } from './exam-bank.tab';
import { QuestionBankTab } from './question-bank.tab';

/** Thứ tự tab cố định — map giữa nzSelectedIndex và query param ?tab=. */
const TAB_KEYS = ['bank', 'assignments', 'questions'] as const;

/**
 * Đề &amp; Bài tập — module riêng ngang hàng Kho tài liệu, gom toàn bộ vòng đời của đề:
 * Bộ đề (sinh/duyệt/phát hành) · Đã giao cho lớp (theo dõi nộp bài) · Ngân hàng câu hỏi (trộn đề thủ công).
 */
@Component({
  selector: 'app-exams-page',
  imports: [NzTabsModule, PageHeader, ExamBankTab, ExamAssignmentsTab, QuestionBankTab],
  template: `
    <app-page-header
      title="Đề & Bài tập"
      subtitle="Sinh đề từ tài liệu, duyệt, phát hành và giao cho lớp"
      icon="file-done" />

    <nz-tabs class="module-tabs" nzType="line" [nzSelectedIndex]="tabIndex()" (nzSelectedIndexChange)="onTabChange($event)">
      <nz-tab nzTitle="Bộ đề">
        <app-exam-bank-tab [subjects]="subjects()" [grades]="grades()" [materialId]="materialIdParam() ?? null" />
      </nz-tab>

      <nz-tab nzTitle="Đã giao cho lớp">
        <ng-template nz-tab><app-exam-assignments-tab /></ng-template>
      </nz-tab>

      <nz-tab nzTitle="Ngân hàng câu hỏi">
        <!-- Lazy: chỉ gọi API ngân hàng câu hỏi khi giáo viên mở tab. -->
        <ng-template nz-tab>
          <app-question-bank-tab [subjects]="subjects()" [grades]="grades()" />
        </ng-template>
      </nz-tab>
    </nz-tabs>
  `
})
export class ExamsPage {
  private readonly subjectsService = inject(SubjectsService);
  private readonly gradesService = inject(GradesService);
  private readonly router = inject(Router);

  readonly tab = input<string | undefined>();
  readonly materialIdParam = input<string | undefined>(undefined, { alias: 'materialId' });

  protected readonly tabIndex = computed(() => {
    const i = TAB_KEYS.indexOf((this.tab() ?? 'bank') as (typeof TAB_KEYS)[number]);
    return i < 0 ? 0 : i;
  });

  protected readonly subjects = signal<Subject[]>([]);
  protected readonly grades = signal<Grade[]>([]);

  constructor() {
    this.subjectsService.getAll().subscribe(s => this.subjects.set(s));
    this.gradesService.getAll().subscribe(g => this.grades.set(g));
  }

  protected onTabChange(index: number): void {
    this.router.navigate([], { queryParams: { tab: TAB_KEYS[index] ?? 'bank' }, queryParamsHandling: 'merge' });
  }
}
