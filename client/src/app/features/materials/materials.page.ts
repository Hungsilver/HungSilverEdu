import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { GradesService } from '../../core/grades.service';
import { Grade, Subject } from '../../core/models';
import { SubjectsService } from '../../core/subjects.service';
import { PageHeader } from '../../shared/page-header';
import { GeneralMaterialsTab } from './general-materials.tab';
import { SubjectMaterialsTab } from './subject-materials.tab';

/** Thứ tự tab cố định — map giữa nzSelectedIndex và query param ?tab= (share URL/back giữ đúng tab). */
const TAB_KEYS = ['subject', 'general'] as const;

/**
 * Kho tài liệu — shell 2 tab, trạng thái điều hướng nằm trên URL:
 * Tài liệu môn học (Môn → Bộ → Unit → Tài liệu, ?subjectId=&folderId=) · Tài liệu chung (không thuộc bộ).
 *
 * Danh mục "Loại tài liệu" đã bỏ; Ngân hàng câu hỏi chuyển sang module Đề &amp; Bài tập.
 */
@Component({
  selector: 'app-materials-page',
  imports: [NzTabsModule, PageHeader, SubjectMaterialsTab, GeneralMaterialsTab],
  template: `
    <app-page-header
      title="Kho tài liệu"
      subtitle="Tài liệu môn học theo bộ (Môn → Bộ → Unit) và tài liệu chung"
      icon="read" />

    <nz-tabs class="module-tabs" nzType="line" [nzSelectedIndex]="tabIndex()" (nzSelectedIndexChange)="onTabChange($event)">
      <nz-tab nzTitle="Tài liệu môn học">
        <app-subject-materials-tab
          [subjectId]="subjectIdParam() ?? null" [folderId]="folderIdParam() ?? null"
          [grades]="grades()" />
      </nz-tab>

      <nz-tab nzTitle="Tài liệu chung">
        <ng-template nz-tab>
          <app-general-materials-tab [subjects]="subjects()" [grades]="grades()" />
        </ng-template>
      </nz-tab>
    </nz-tabs>
  `
})
export class MaterialsPage {
  private readonly subjectsService = inject(SubjectsService);
  private readonly gradesService = inject(GradesService);
  private readonly router = inject(Router);

  // Query param (withComponentInputBinding chỉ bind vào component của route — truyền xuống tab con).
  readonly tab = input<string | undefined>();
  readonly subjectIdParam = input<string | undefined>(undefined, { alias: 'subjectId' });
  readonly folderIdParam = input<string | undefined>(undefined, { alias: 'folderId' });

  protected readonly tabIndex = computed(() => {
    const i = TAB_KEYS.indexOf((this.tab() ?? 'subject') as (typeof TAB_KEYS)[number]);
    return i < 0 ? 0 : i;
  });

  protected readonly subjects = signal<Subject[]>([]);
  protected readonly grades = signal<Grade[]>([]);

  constructor() {
    this.subjectsService.getAll().subscribe(s => this.subjects.set(s));
    this.gradesService.getAll().subscribe(g => this.grades.set(g));
  }

  /** Đổi tab ⇒ đẩy lên URL (giữ subjectId/folderId — quay lại tab môn học khôi phục đúng vị trí). */
  protected onTabChange(index: number): void {
    this.router.navigate([], { queryParams: { tab: TAB_KEYS[index] ?? 'subject' }, queryParamsHandling: 'merge' });
  }
}
