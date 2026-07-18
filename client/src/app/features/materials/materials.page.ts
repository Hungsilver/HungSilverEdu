import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { AuthService } from '../../core/auth.service';
import { GradesService } from '../../core/grades.service';
import { MaterialsService } from '../../core/materials.service';
import { FileStorageMode, Grade, MaterialCategory, Subject } from '../../core/models';
import { SettingsService } from '../../core/settings.service';
import { SubjectsService } from '../../core/subjects.service';
import { PageHeader } from '../../shared/page-header';
import { GeneralMaterialsTab } from './general-materials.tab';
import { MaterialsCatalogTab } from './materials-catalog.tab';
import { QuestionBankTab } from './question-bank.tab';
import { SubjectMaterialsTab } from './subject-materials.tab';

/** Thứ tự tab cố định — map giữa nzSelectedIndex và query param ?tab= (share URL/back giữ đúng tab). */
const TAB_KEYS = ['subject', 'general', 'catalog', 'questions'] as const;

/**
 * Kho tài liệu — shell 4 tab, trạng thái điều hướng nằm trên URL:
 * Tài liệu môn học (Môn → Bộ → Tài liệu, ?subjectId=&folderId=) · Tài liệu chung (không thuộc bộ)
 * · Danh mục (Loại tài liệu) · Quản lí câu hỏi (ngân hàng câu hỏi).
 */
@Component({
  selector: 'app-materials-page',
  imports: [
    NzTabsModule, PageHeader,
    SubjectMaterialsTab, GeneralMaterialsTab, MaterialsCatalogTab, QuestionBankTab
  ],
  template: `
    <app-page-header title="Kho tài liệu" subtitle="Tài liệu môn học theo bộ (Môn → Bộ → Tài liệu) và tài liệu chung" icon="link" />

    <nz-tabs class="module-tabs" nzType="line" [nzSelectedIndex]="tabIndex()" (nzSelectedIndexChange)="onTabChange($event)">
      <nz-tab nzTitle="Tài liệu môn học">
        <app-subject-materials-tab
          [subjectId]="subjectIdParam() ?? null" [folderId]="folderIdParam() ?? null"
          [grades]="grades()" />
      </nz-tab>

      <nz-tab nzTitle="Tài liệu chung">
        <ng-template nz-tab>
          <app-general-materials-tab
            [subjects]="subjects()" [grades]="grades()" [categories]="categories()"
            [serverUploadAllowed]="serverUploadAllowed()" />
        </ng-template>
      </nz-tab>

      @if (canManage()) {
        <nz-tab nzTitle="Danh mục">
          <ng-template nz-tab>
            <app-materials-catalog-tab (changed)="loadLookups()" />
          </ng-template>
        </nz-tab>
        <nz-tab nzTitle="Quản lí câu hỏi">
          <!-- Lazy: chỉ khởi tạo (và gọi API ngân hàng câu hỏi) khi GV mở tab. -->
          <ng-template nz-tab>
            <app-question-bank-tab [subjects]="subjects()" [grades]="grades()" />
          </ng-template>
        </nz-tab>
      }
    </nz-tabs>
  `
})
export class MaterialsPage {
  private readonly auth = inject(AuthService);
  private readonly subjectsService = inject(SubjectsService);
  private readonly gradesService = inject(GradesService);
  private readonly materialsService = inject(MaterialsService);
  private readonly settingsService = inject(SettingsService);
  private readonly router = inject(Router);

  // Query param (withComponentInputBinding chỉ bind vào component của route — truyền xuống tab con).
  readonly tab = input<string | undefined>();
  readonly subjectIdParam = input<string | undefined>(undefined, { alias: 'subjectId' });
  readonly folderIdParam = input<string | undefined>(undefined, { alias: 'folderId' });

  protected readonly canManage = computed(() => this.auth.isAdmin() || this.auth.isTeacher());
  protected readonly tabIndex = computed(() => {
    const i = TAB_KEYS.indexOf((this.tab() ?? 'subject') as (typeof TAB_KEYS)[number]);
    return i < 0 ? 0 : i;
  });

  protected readonly subjects = signal<Subject[]>([]);
  protected readonly grades = signal<Grade[]>([]);
  protected readonly categories = signal<MaterialCategory[]>([]);
  protected readonly serverUploadAllowed = signal(false);

  constructor() {
    this.loadLookups();
    this.settingsService.getEffective().subscribe(s =>
      this.serverUploadAllowed.set(s.values['FileStorage.Mode'] === FileStorageMode.Server));
  }

  /** Nạp dữ liệu dropdown (môn/khối/loại) — gọi lại khi tab Danh mục thay đổi. */
  protected loadLookups(): void {
    this.subjectsService.getAll().subscribe(s => this.subjects.set(s));
    this.gradesService.getAll().subscribe(g => this.grades.set(g));
    this.materialsService.getCategories().subscribe(c => this.categories.set(c));
  }

  /** Đổi tab ⇒ đẩy lên URL (giữ subjectId/folderId — quay lại tab môn học khôi phục đúng vị trí). */
  protected onTabChange(index: number): void {
    this.router.navigate([], { queryParams: { tab: TAB_KEYS[index] ?? 'subject' }, queryParamsHandling: 'merge' });
  }
}
