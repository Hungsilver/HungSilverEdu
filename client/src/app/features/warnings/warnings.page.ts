import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ClassesService } from '../../core/classes.service';
import { ClassListItem, Warnings } from '../../core/models';
import { WarningsService } from '../../core/warnings.service';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-warnings-page',
  imports: [NgTemplateOutlet, FormsModule, RouterLink, NzCardModule, NzGridModule, NzIconModule, NzTagModule, NzSelectModule, NzEmptyModule, PageHeader],
  template: `
    <app-page-header title="Cảnh báo" subtitle="Học sinh cần chú ý sớm" icon="warning">
      <nz-select class="cls" nzAllowClear nzShowSearch nzPlaceHolder="Tất cả lớp" [(ngModel)]="classId" (ngModelChange)="load()">
        @for (c of classes(); track c.id) { <nz-option [nzValue]="c.id" [nzLabel]="c.name" /> }
      </nz-select>
    </app-page-header>

    <nz-row [nzGutter]="[16, 16]">
      <nz-col [nzXs]="24" [nzLg]="12">
        <nz-card nzTitle="⚠️ Vắng 3 buổi liên tiếp">
          <ng-container [ngTemplateOutlet]="list" [ngTemplateOutletContext]="{ items: warnings()?.consecutiveAbsences }" />
        </nz-card>
      </nz-col>
      <nz-col [nzXs]="24" [nzLg]="12">
        <nz-card nzTitle="⚠️ Không làm BTVN 3 buổi liên tiếp">
          <ng-container [ngTemplateOutlet]="list" [ngTemplateOutletContext]="{ items: warnings()?.missedHomework }" />
        </nz-card>
      </nz-col>
      <nz-col [nzXs]="24" [nzLg]="12">
        <nz-card nzTitle="⚠️ Điểm giảm mạnh">
          <ng-container [ngTemplateOutlet]="list" [ngTemplateOutletContext]="{ items: warnings()?.scoreDrop }" />
        </nz-card>
      </nz-col>
      <nz-col [nzXs]="24" [nzLg]="12">
        <nz-card nzTitle="⚠️ Học phí quá hạn">
          <ng-container [ngTemplateOutlet]="list" [ngTemplateOutletContext]="{ items: warnings()?.tuitionOverdue }" />
        </nz-card>
      </nz-col>
    </nz-row>

    <ng-template #list let-items="items">
      @for (w of items ?? []; track w.studentId + w.detail) {
        <div class="row-item">
          <a [routerLink]="['/students', w.studentId]">{{ w.studentName }}</a>
          <nz-tag nzColor="red">{{ w.detail }}</nz-tag>
        </div>
      } @empty { <nz-empty nzNotFoundContent="Không có cảnh báo" /> }
    </ng-template>
  `,
  styles: `
    .cls { min-width: 200px; }
    .row-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--hs-border); }
    .row-item:last-child { border-bottom: none; }
  `
})
export class WarningsPage {
  private readonly warningsService = inject(WarningsService);
  private readonly classesService = inject(ClassesService);

  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly warnings = signal<Warnings | null>(null);
  protected classId: string | null = null;

  constructor() {
    this.classesService.getPaged({ page: 1, pageSize: 200 }).subscribe(r => this.classes.set(r.items));
    this.load();
  }

  protected load(): void {
    this.warningsService.getWarnings(this.classId ?? undefined).subscribe(w => this.warnings.set(w));
  }
}
