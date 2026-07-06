import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { ExamOption, ExamPair, ExamQuestion, ExamQuestionType, UpsertQuestionRequest } from '../../core/models';

/**
 * Editor 4 loại câu hỏi dùng chung (trang Duyệt đề + tab Ngân hàng câu hỏi).
 * Điểm KHÔNG nhập tay — hệ thống luôn chia đều trên tổng điểm đề (đồng bộ đề AI sinh).
 */

/** Câu hỏi ở dạng có thể sửa (đã parse từ JSON lưu trữ). */
export interface EditQuestion {
  id: string | null;
  groupId: string | null;
  type: ExamQuestionType;
  stem: string;
  options: ExamOption[];       // SingleChoice + Matching (cột trái)
  optionsRight: ExamOption[];  // Matching (cột phải)
  answerKey: string;           // SingleChoice
  trueFalse: boolean;          // TrueFalse
  blanks: string[];            // FillBlank (mỗi ô = "a/b")
  wordBox: string;             // FillBlank hộp từ (ngăn bởi ",")
  pairs: ExamPair[];           // Matching
  explanation: string;
}

/** Bản hiển thị 1 câu (options đánh dấu đáp án đúng + tóm tắt đáp án). */
export interface QView {
  q: ExamQuestion;
  options: { key: string; text: string; correct: boolean }[];
  answerSummary: string;
}

/** Câu hỏi trắc nghiệm mới, trống. */
export function emptyEditQuestion(): EditQuestion {
  return {
    id: null, groupId: null, type: 'SingleChoice', stem: '',
    options: [{ key: 'A', text: '' }, { key: 'B', text: '' }], optionsRight: [],
    answerKey: 'A', trueFalse: true, blanks: [''], wordBox: '', pairs: [], explanation: ''
  };
}

/** Parse OptionsJson/AnswerJson của 1 câu thành dạng sửa được. JSON hỏng ⇒ để trống cho GV nhập lại. */
export function toEditQuestion(q: ExamQuestion): EditQuestion {
  const e: EditQuestion = {
    id: q.id, groupId: q.groupId, type: q.type, stem: q.stem,
    options: [], optionsRight: [], answerKey: '', trueFalse: true, blanks: [], wordBox: '', pairs: [],
    explanation: q.explanation ?? ''
  };
  try {
    if (q.type === 'SingleChoice') {
      e.options = q.optionsJson ? JSON.parse(q.optionsJson) : [];
      e.answerKey = JSON.parse(q.answerJson).key ?? '';
    } else if (q.type === 'TrueFalse') {
      e.trueFalse = !!JSON.parse(q.answerJson).value;
    } else if (q.type === 'FillBlank') {
      const opt = q.optionsJson ? JSON.parse(q.optionsJson) : {};
      e.wordBox = (opt.wordBox ?? []).join(', ');
      e.blanks = ((JSON.parse(q.answerJson).blanks ?? []) as string[][]).map(b => b.join(' / '));
      if (e.blanks.length === 0) e.blanks = [''];
    } else if (q.type === 'Matching') {
      const opt = q.optionsJson ? JSON.parse(q.optionsJson) : {};
      e.options = opt.left ?? [];
      e.optionsRight = opt.right ?? [];
      const pairs = JSON.parse(q.answerJson).pairs ?? {};
      e.pairs = Object.entries(pairs).map(([left, right]) => ({ left, right: right as string }));
    }
  } catch { /* JSON hỏng — để GV nhập lại */ }
  return e;
}

/** Map dạng sửa → request gửi server (server dựng lại OptionsJson/AnswerJson qua ExamQuestionFactory). */
export function toUpsertRequest(e: EditQuestion): UpsertQuestionRequest {
  return {
    groupId: e.groupId,
    type: e.type,
    stem: e.stem.trim(),
    options: (e.type === 'SingleChoice' || e.type === 'Matching') ? e.options : null,
    optionsRight: e.type === 'Matching' ? e.optionsRight : null,
    answerKey: e.type === 'SingleChoice' ? e.answerKey : (e.type === 'TrueFalse' ? String(e.trueFalse) : null),
    answerBlanks: e.type === 'FillBlank' ? e.blanks.filter(b => b.trim()) : null,
    wordBox: e.type === 'FillBlank' && e.wordBox.trim() ? e.wordBox.split(',').map(x => x.trim()).filter(Boolean) : null,
    answerPairs: e.type === 'Matching' ? e.pairs : null,
    explanation: e.explanation.trim() || null
  };
}

/** Parse 1 câu thành bản hiển thị (options đánh dấu đúng + tóm tắt đáp án). */
export function buildQuestionView(q: ExamQuestion): QView {
  const options: { key: string; text: string; correct: boolean }[] = [];
  let answerSummary = '';
  try {
    if (q.type === 'SingleChoice') {
      const opts = q.optionsJson ? JSON.parse(q.optionsJson) as ExamOption[] : [];
      const key = (JSON.parse(q.answerJson).key ?? '') as string;
      for (const o of opts) options.push({ key: o.key, text: o.text, correct: o.key === key });
      answerSummary = key;
    } else if (q.type === 'TrueFalse') {
      answerSummary = JSON.parse(q.answerJson).value ? 'Đúng' : 'Sai';
    } else if (q.type === 'FillBlank') {
      const blanks = (JSON.parse(q.answerJson).blanks ?? []) as string[][];
      answerSummary = blanks.map((b, i) => `Ô${i + 1}: ${b.join(' / ')}`).join('  •  ');
    } else if (q.type === 'Matching') {
      const pairs = (JSON.parse(q.answerJson).pairs ?? {}) as Record<string, string>;
      answerSummary = Object.entries(pairs).map(([l, r]) => `${l}→${r}`).join(', ');
    }
  } catch { /* JSON hỏng — hiển thị rỗng, GV sửa lại */ }
  return { q, options, answerSummary };
}

/**
 * Form sửa 1 câu hỏi — đặt bên trong nz-modal của trang chủ quản. Mutate trực tiếp object
 * `question` qua ngModel (host giữ nút OK và tự gọi `toUpsertRequest`).
 */
@Component({
  selector: 'app-question-editor',
  imports: [FormsModule, NzButtonModule, NzFormModule, NzIconModule, NzInputModule, NzRadioModule],
  template: `
    @if (question(); as e) {
      <form nz-form nzLayout="vertical">
        <nz-form-item><nz-form-label>Loại</nz-form-label>
          <nz-form-control>
            <nz-radio-group [(ngModel)]="e.type" name="type" (ngModelChange)="onTypeChange(e)">
              <label nz-radio-button nzValue="SingleChoice">Trắc nghiệm</label>
              <label nz-radio-button nzValue="TrueFalse">Đúng/Sai</label>
              <label nz-radio-button nzValue="FillBlank">Điền từ</label>
              <label nz-radio-button nzValue="Matching">Nối</label>
            </nz-radio-group>
          </nz-form-control></nz-form-item>

        <nz-form-item><nz-form-label nzRequired>Nội dung câu hỏi</nz-form-label>
          <nz-form-control><textarea nz-input [(ngModel)]="e.stem" name="stem" rows="2"></textarea></nz-form-control></nz-form-item>

        @switch (e.type) {
          @case ('SingleChoice') {
            <nz-form-item><nz-form-label>Lựa chọn (chọn đáp án đúng)</nz-form-label>
              <nz-form-control>
                <nz-radio-group [(ngModel)]="e.answerKey" name="ak" class="opt-radio">
                  @for (o of e.options; track $index) {
                    <div class="opt-row">
                      <label nz-radio [nzValue]="o.key"></label>
                      <input nz-input class="k" [(ngModel)]="o.key" [ngModelOptions]="{standalone:true}" placeholder="A" />
                      <input nz-input [(ngModel)]="o.text" [ngModelOptions]="{standalone:true}" placeholder="Nội dung" />
                      <button nz-button nzType="text" nzDanger (click)="e.options.splice($index,1)"><nz-icon nzType="minus" /></button>
                    </div>
                  }
                </nz-radio-group>
                <button nz-button nzSize="small" (click)="e.options.push({key:'',text:''})"><nz-icon nzType="plus" /> Thêm lựa chọn</button>
              </nz-form-control></nz-form-item>
          }
          @case ('TrueFalse') {
            <nz-form-item><nz-form-label>Đáp án đúng</nz-form-label>
              <nz-form-control>
                <nz-radio-group [(ngModel)]="e.trueFalse" name="tf">
                  <label nz-radio-button [nzValue]="true">Đúng</label>
                  <label nz-radio-button [nzValue]="false">Sai</label>
                </nz-radio-group>
              </nz-form-control></nz-form-item>
          }
          @case ('FillBlank') {
            <nz-form-item><nz-form-label>Đáp án từng ô (ngăn cách các đáp án chấp nhận bằng "/")</nz-form-label>
              <nz-form-control>
                @for (b of e.blanks; track $index) {
                  <div class="opt-row">
                    <span class="blank-no">Ô {{ $index + 1 }}</span>
                    <input nz-input [(ngModel)]="e.blanks[$index]" [ngModelOptions]="{standalone:true}" placeholder="mental / tinh thần" />
                    <button nz-button nzType="text" nzDanger (click)="e.blanks.splice($index,1)"><nz-icon nzType="minus" /></button>
                  </div>
                }
                <button nz-button nzSize="small" (click)="e.blanks.push('')"><nz-icon nzType="plus" /> Thêm ô</button>
              </nz-form-control></nz-form-item>
            <nz-form-item><nz-form-label>Hộp từ (tùy chọn, ngăn bởi ",")</nz-form-label>
              <nz-form-control><input nz-input [(ngModel)]="e.wordBox" name="wb" /></nz-form-control></nz-form-item>
          }
          @case ('Matching') {
            <nz-form-item><nz-form-label>Cột trái / Cột phải / Cặp nối</nz-form-label>
              <nz-form-control>
                <div class="match-cols">
                  <div>
                    <div class="col-h">Cột trái</div>
                    @for (o of e.options; track $index) {
                      <div class="opt-row">
                        <input nz-input class="k" [(ngModel)]="o.key" [ngModelOptions]="{standalone:true}" placeholder="1" />
                        <input nz-input [(ngModel)]="o.text" [ngModelOptions]="{standalone:true}" placeholder="..." />
                        <button nz-button nzType="text" nzDanger (click)="e.options.splice($index,1)"><nz-icon nzType="minus" /></button>
                      </div>
                    }
                    <button nz-button nzSize="small" (click)="e.options.push({key:'',text:''})"><nz-icon nzType="plus" /></button>
                  </div>
                  <div>
                    <div class="col-h">Cột phải</div>
                    @for (o of e.optionsRight; track $index) {
                      <div class="opt-row">
                        <input nz-input class="k" [(ngModel)]="o.key" [ngModelOptions]="{standalone:true}" placeholder="a" />
                        <input nz-input [(ngModel)]="o.text" [ngModelOptions]="{standalone:true}" placeholder="..." />
                        <button nz-button nzType="text" nzDanger (click)="e.optionsRight.splice($index,1)"><nz-icon nzType="minus" /></button>
                      </div>
                    }
                    <button nz-button nzSize="small" (click)="e.optionsRight.push({key:'',text:''})"><nz-icon nzType="plus" /></button>
                  </div>
                </div>
                <div class="col-h">Cặp nối (key trái → key phải)</div>
                @for (p of e.pairs; track $index) {
                  <div class="opt-row">
                    <input nz-input class="k" [(ngModel)]="p.left" [ngModelOptions]="{standalone:true}" placeholder="1" />
                    <span>→</span>
                    <input nz-input class="k" [(ngModel)]="p.right" [ngModelOptions]="{standalone:true}" placeholder="a" />
                    <button nz-button nzType="text" nzDanger (click)="e.pairs.splice($index,1)"><nz-icon nzType="minus" /></button>
                  </div>
                }
                <button nz-button nzSize="small" (click)="e.pairs.push({left:'',right:''})"><nz-icon nzType="plus" /> Thêm cặp</button>
              </nz-form-control></nz-form-item>
          }
        }

        <nz-form-item><nz-form-label>Giải thích (vì sao đúng)</nz-form-label>
          <nz-form-control><textarea nz-input [(ngModel)]="e.explanation" name="ex" rows="2"></textarea></nz-form-control></nz-form-item>
      </form>
    }
  `,
  styles: `
    .opt-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .opt-row .k { max-width: 64px; }
    .opt-radio { display: block; }
    .blank-no { min-width: 48px; }
    .match-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .col-h { font-weight: 600; margin: 8px 0 4px; }
    @media (max-width: 575px) { .match-cols { grid-template-columns: 1fr; } }
  `
})
export class QuestionEditorForm {
  readonly question = input.required<EditQuestion>();

  protected onTypeChange(e: EditQuestion): void {
    if (e.type === 'SingleChoice' && e.options.length === 0) e.options = [{ key: 'A', text: '' }, { key: 'B', text: '' }];
    if (e.type === 'FillBlank' && e.blanks.length === 0) e.blanks = [''];
  }
}
