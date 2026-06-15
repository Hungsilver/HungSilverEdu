import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ClassesService } from '../../core/classes.service';
import { EvaluationsService } from '../../core/evaluations.service';
import {
  ApiProblem, ClassListItem, EVAL_RANK_COLORS, EVAL_RANK_LABELS, Leaderboard,
  MonthlyEvaluation, RosterItem
} from '../../core/models';
import { PageHeader } from '../../shared/page-header';

interface EvalRow { studentId: string; fullName: string; eval: MonthlyEvaluation | null; }

@Component({
  selector: 'app-evaluations-page',
  imports: [
    FormsModule, ReactiveFormsModule,
    NzTableModule, NzButtonModule, NzIconModule, NzTagModule, NzSelectModule, NzDatePickerModule,
    NzModalModule, NzFormModule, NzInputModule, NzInputNumberModule, NzCardModule, NzGridModule, PageHeader
  ],
  template: `
    <app-page-header title="Đánh giá hàng tháng" subtitle="Chấm điểm tháng & bảng vàng" icon="audit" />

    <nz-card nzTitle="🏆 Bảng vàng tuần này" class="mb">
      <nz-row [nzGutter]="[16, 16]">
        <nz-col [nzXs]="24" [nzMd]="8">
          <h4>Điểm thưởng</h4>
          @for (e of leaderboard()?.topReward ?? []; track e.studentId) {
            <div class="row-item">{{ e.studentName }} <nz-tag nzColor="gold">{{ e.value }}</nz-tag></div>
          } @empty { <span class="muted">—</span> }
        </nz-col>
        <nz-col [nzXs]="24" [nzMd]="8">
          <h4>Chuyên cần</h4>
          @for (e of leaderboard()?.topAttendance ?? []; track e.studentId) {
            <div class="row-item">{{ e.studentName }} <nz-tag nzColor="green">{{ e.value }}%</nz-tag></div>
          } @empty { <span class="muted">—</span> }
        </nz-col>
        <nz-col [nzXs]="24" [nzMd]="8">
          <h4>Hoàn thành BTVN</h4>
          @for (e of leaderboard()?.topHomework ?? []; track e.studentId) {
            <div class="row-item">{{ e.studentName }} <nz-tag nzColor="blue">{{ e.value }}%</nz-tag></div>
          } @empty { <span class="muted">—</span> }
        </nz-col>
      </nz-row>
    </nz-card>

    <div class="filters">
      <nz-select class="cls" nzShowSearch nzPlaceHolder="Chọn lớp" [(ngModel)]="classId" (ngModelChange)="onClassChange()">
        @for (c of classes(); track c.id) { <nz-option [nzValue]="c.id" [nzLabel]="c.name" /> }
      </nz-select>
      <nz-date-picker nzMode="month" [(ngModel)]="period" (ngModelChange)="loadEvals()" nzFormat="MM/yyyy" />
    </div>

    @if (classId) {
      <nz-table [nzData]="rows()" [nzFrontPagination]="false" nzSize="small" [nzScroll]="{ x: '760px' }">
        <thead>
          <tr><th nzLeft>Học sinh</th><th>Chuyên cần</th><th>Bài tập</th><th>Thái độ</th><th>Từ vựng</th><th>Ngữ pháp</th><th>Tổng</th><th>Xếp hạng</th><th nzRight></th></tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.studentId) {
            <tr>
              <td nzLeft>{{ r.fullName }}</td>
              <td>{{ r.eval?.attendanceScore ?? '—' }}</td>
              <td>{{ r.eval?.homeworkScore ?? '—' }}</td>
              <td>{{ r.eval?.attitudeScore ?? '—' }}</td>
              <td>{{ r.eval?.vocabularyScore ?? '—' }}</td>
              <td>{{ r.eval?.grammarScore ?? '—' }}</td>
              <td>{{ r.eval ? r.eval.total : '—' }}</td>
              <td>@if (r.eval) { <nz-tag [nzColor]="rankColors[r.eval.rank]">{{ rankLabels[r.eval.rank] }}</nz-tag> }</td>
              <td nzRight><button nz-button nzType="link" nzSize="small" (click)="openEdit(r)"><nz-icon nzType="edit" /> Đánh giá</button></td>
            </tr>
          }
        </tbody>
      </nz-table>
    } @else { <p class="muted">Chọn lớp và tháng để đánh giá.</p> }

    <nz-modal [nzVisible]="modalOpen()" nzTitle="Đánh giá học sinh" [nzOkLoading]="saving()" [nzOkDisabled]="form.invalid"
      (nzOnOk)="save()" (nzOnCancel)="modalOpen.set(false)">
      <ng-container *nzModalContent>
        <p><strong>{{ editingName() }}</strong> — {{ period.getMonth() + 1 }}/{{ period.getFullYear() }}</p>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-row [nzGutter]="12">
            <nz-col [nzXs]="12"><nz-form-item><nz-form-label>Chuyên cần /10</nz-form-label><nz-form-control><nz-input-number formControlName="attendanceScore" [nzMin]="0" [nzMax]="10" class="full" /></nz-form-control></nz-form-item></nz-col>
            <nz-col [nzXs]="12"><nz-form-item><nz-form-label>Bài tập /10</nz-form-label><nz-form-control><nz-input-number formControlName="homeworkScore" [nzMin]="0" [nzMax]="10" class="full" /></nz-form-control></nz-form-item></nz-col>
            <nz-col [nzXs]="12"><nz-form-item><nz-form-label>Thái độ /10</nz-form-label><nz-form-control><nz-input-number formControlName="attitudeScore" [nzMin]="0" [nzMax]="10" class="full" /></nz-form-control></nz-form-item></nz-col>
            <nz-col [nzXs]="12"><nz-form-item><nz-form-label>Từ vựng /10</nz-form-label><nz-form-control><nz-input-number formControlName="vocabularyScore" [nzMin]="0" [nzMax]="10" class="full" /></nz-form-control></nz-form-item></nz-col>
            <nz-col [nzXs]="12"><nz-form-item><nz-form-label>Ngữ pháp /10</nz-form-label><nz-form-control><nz-input-number formControlName="grammarScore" [nzMin]="0" [nzMax]="10" class="full" /></nz-form-control></nz-form-item></nz-col>
            <nz-col [nzXs]="24"><nz-form-item><nz-form-label>Nhận xét</nz-form-label><nz-form-control><textarea nz-input formControlName="comment" rows="2"></textarea></nz-form-control></nz-form-item></nz-col>
          </nz-row>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .mb { margin-bottom: 16px; }
    .filters { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .cls { min-width: 200px; }
    .row-item { display: flex; justify-content: space-between; padding: 4px 0; }
    .full { width: 100%; }
    .muted { color: var(--hs-text-muted); }
  `
})
export class EvaluationsPage {
  private readonly classesService = inject(ClassesService);
  private readonly evaluationsService = inject(EvaluationsService);
  private readonly message = inject(NzMessageService);

  protected readonly rankLabels = EVAL_RANK_LABELS;
  protected readonly rankColors = EVAL_RANK_COLORS;

  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly roster = signal<RosterItem[]>([]);
  protected readonly evals = signal<MonthlyEvaluation[]>([]);
  protected readonly leaderboard = signal<Leaderboard | null>(null);
  protected classId: string | null = null;
  protected period = new Date();

  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editingName = signal('');
  private editingStudentId = '';

  protected readonly rows = computed<EvalRow[]>(() => {
    const map = new Map(this.evals().map(e => [e.studentId, e]));
    return this.roster().map(r => ({ studentId: r.studentId, fullName: r.fullName, eval: map.get(r.studentId) ?? null }));
  });

  protected readonly form = new FormGroup({
    attendanceScore: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
    homeworkScore: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
    attitudeScore: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
    vocabularyScore: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
    grammarScore: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
    comment: new FormControl<string | null>(null)
  });

  constructor() {
    this.classesService.getPaged({ page: 1, pageSize: 200 }).subscribe(r => this.classes.set(r.items));
    this.evaluationsService.getLeaderboard().subscribe(l => this.leaderboard.set(l));
  }

  protected onClassChange(): void {
    if (!this.classId) return;
    this.classesService.getRoster(this.classId).subscribe(r => this.roster.set(r));
    this.evaluationsService.getLeaderboard(this.classId).subscribe(l => this.leaderboard.set(l));
    this.loadEvals();
  }

  protected loadEvals(): void {
    if (!this.classId) return;
    this.evaluationsService.getByClassMonth(this.classId, this.period.getFullYear(), this.period.getMonth() + 1)
      .subscribe(e => this.evals.set(e));
  }

  protected openEdit(r: EvalRow): void {
    this.editingStudentId = r.studentId;
    this.editingName.set(r.fullName);
    this.form.reset({
      attendanceScore: r.eval?.attendanceScore ?? 0,
      homeworkScore: r.eval?.homeworkScore ?? 0,
      attitudeScore: r.eval?.attitudeScore ?? 0,
      vocabularyScore: r.eval?.vocabularyScore ?? 0,
      grammarScore: r.eval?.grammarScore ?? 0,
      comment: r.eval?.comment ?? null
    });
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid || !this.classId) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.evaluationsService.upsert({
      studentId: this.editingStudentId, classId: this.classId,
      year: this.period.getFullYear(), month: this.period.getMonth() + 1,
      attendanceScore: v.attendanceScore, homeworkScore: v.homeworkScore, attitudeScore: v.attitudeScore,
      vocabularyScore: v.vocabularyScore, grammarScore: v.grammarScore, comment: v.comment
    }).subscribe({
      next: () => { this.saving.set(false); this.modalOpen.set(false); this.message.success('Đã lưu đánh giá.'); this.loadEvals(); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error((err.error as ApiProblem | null)?.detail ?? 'Lưu thất bại.'); }
    });
  }
}
