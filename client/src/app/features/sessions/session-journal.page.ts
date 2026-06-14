import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ApiProblem, UpsertJournalRequest } from '../../core/models';
import { SessionsService } from '../../core/sessions.service';

@Component({
  selector: 'app-session-journal-page',
  imports: [FormsModule, RouterLink, NzCardModule, NzFormModule, NzInputModule, NzButtonModule, NzIconModule],
  template: `
    <a [routerLink]="['/sessions', id()]" class="back"><nz-icon nzType="arrow-left" /> Về buổi học</a>
    <h2>Nhật ký giảng dạy</h2>
    <nz-card>
      <form nz-form nzLayout="vertical">
        <nz-form-item><nz-form-label>Nội dung đã dạy</nz-form-label>
          <nz-form-control><textarea nz-input [(ngModel)]="model.contentTaught" name="c" rows="3"></textarea></nz-form-control></nz-form-item>
        <nz-form-item><nz-form-label>Hoạt động lớp học</nz-form-label>
          <nz-form-control><textarea nz-input [(ngModel)]="model.activities" name="a" rows="3"></textarea></nz-form-control></nz-form-item>
        <nz-form-item><nz-form-label>Khó khăn gặp phải</nz-form-label>
          <nz-form-control><textarea nz-input [(ngModel)]="model.difficulties" name="d" rows="2"></textarea></nz-form-control></nz-form-item>
        <nz-form-item><nz-form-label>Ghi chú cho buổi sau</nz-form-label>
          <nz-form-control><textarea nz-input [(ngModel)]="model.notesForNextSession" name="n" rows="2"></textarea></nz-form-control></nz-form-item>
        <button nz-button nzType="primary" [nzLoading]="saving()" (click)="save()"><nz-icon nzType="save" /> Lưu nhật ký</button>
      </form>
    </nz-card>
  `,
  styles: `.back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px; }`
})
export class SessionJournalPage implements OnInit {
  readonly id = input.required<string>();
  private readonly sessionsService = inject(SessionsService);
  private readonly message = inject(NzMessageService);

  protected readonly saving = signal(false);
  protected model: UpsertJournalRequest = { contentTaught: null, activities: null, difficulties: null, notesForNextSession: null };

  ngOnInit(): void {
    this.sessionsService.getJournal(this.id()).subscribe({
      next: j => { if (j) this.model = { contentTaught: j.contentTaught, activities: j.activities, difficulties: j.difficulties, notesForNextSession: j.notesForNextSession }; }
    });
  }

  protected save(): void {
    this.saving.set(true);
    this.sessionsService.saveJournal(this.id(), this.model).subscribe({
      next: () => { this.saving.set(false); this.message.success('Đã lưu nhật ký.'); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.message.error((err.error as ApiProblem | null)?.detail ?? 'Lưu thất bại.'); }
    });
  }
}
