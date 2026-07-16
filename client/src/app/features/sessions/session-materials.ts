import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, switchMap } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { MaterialsService } from '../../core/materials.service';
import { ScreenService } from '../../core/screen.service';
import { DocumentPreview } from '../../shared/document-preview';
import { Material, MaterialAssignment, MaterialAssignmentViewer } from '../../core/models';

/**
 * Section "Tài liệu": GV giao tài liệu trong Kho cho lớp để học viên xem ở Portal, theo dõi "đã xem x/y"
 * per-student. Dùng ở 2 nơi: màn hình buổi học (sessionId có — lượt giao gắn buổi) và trang chi tiết lớp
 * (sessionId null — mọi lượt của lớp). Không polling như section Bài tập — trạng thái xem không cần realtime.
 */
@Component({
  selector: 'app-session-materials',
  imports: [
    DatePipe, NgTemplateOutlet, FormsModule,
    NzButtonModule, NzCardModule, NzCheckboxModule, NzEmptyModule, NzIconModule, NzInputModule,
    NzModalModule, NzPopconfirmModule, NzSelectModule, NzSpinModule, NzTableModule, NzTagModule, NzTooltipModule,
    DocumentPreview
  ],
  template: `
    <nz-card class="mt" [nzTitle]="cardTitle()" [nzExtra]="extra">
      <ng-template #extra>
        <div class="card-actions">
          <button nz-button nzSize="small" (click)="reload()" [nzLoading]="loading()" nz-tooltip nzTooltipTitle="Làm mới">
            <nz-icon nzType="reload" />
          </button>
          <button nz-button nzType="primary" nzSize="small" (click)="openAssign()">
            <nz-icon nzType="book" /> Giao tài liệu
          </button>
        </div>
      </ng-template>

      @if (assignments().length === 0) {
        <nz-empty [nzNotFoundContent]="emptyText()" />
      } @else if (screen.isMobile()) {
        <!-- Mobile: card cho từng lượt giao -->
        <div class="asg-cards">
          @for (a of assignments(); track a.id) {
            <div class="asg-card">
              <div class="asg-head">
                <strong>{{ a.materialTitle }}</strong>
                @if (a.materialDeleted) { <nz-tag nzColor="red">Đã xóa khỏi kho</nz-tag> }
              </div>
              @if (a.note) { <div class="muted">{{ a.note }}</div> }
              <div class="muted small">Giao {{ a.createdAt | date: 'HH:mm dd/MM' }}</div>
              <div class="asg-sub">Đã xem <strong>{{ a.viewedCount }}/{{ a.totalStudents }}</strong></div>
              <div class="asg-actions">
                <button nz-button nzSize="small" (click)="toggleExpand(a)">
                  <nz-icon [nzType]="expandedId() === a.id ? 'up' : 'down'" /> Chi tiết
                </button>
                <button nz-button nzSize="small" [disabled]="a.materialDeleted" (click)="view(a)">
                  <nz-icon nzType="eye" /> Xem
                </button>
                <button nz-button nzSize="small" nzDanger nz-popconfirm nzPopconfirmTitle="Thu hồi tài liệu đã giao?"
                  (nzOnConfirm)="remove(a)">Thu hồi</button>
              </div>
              @if (expandedId() === a.id) {
                <ng-container *ngTemplateOutlet="viewerList; context: { $implicit: a }" />
              }
            </div>
          }
        </div>
      } @else {
        <!-- Desktop: bảng lượt giao + expand trạng thái xem -->
        <nz-table #t [nzData]="assignments()" [nzFrontPagination]="false" nzSize="small" [nzScroll]="{ x: '720px' }">
          <thead>
            <tr>
              <th nzWidth="40px"></th>
              <th>Tên tài liệu</th>
              <th>Ghi chú</th>
              <th nzWidth="100px">Đã xem</th>
              <th nzWidth="130px">Ngày giao</th>
              <th nzWidth="170px"></th>
            </tr>
          </thead>
          <tbody>
            @for (a of t.data; track a.id) {
              <tr>
                <td [nzExpand]="expandedId() === a.id" (nzExpandChange)="toggleExpand(a)"></td>
                <td>
                  {{ a.materialTitle }}
                  @if (a.materialDeleted) { <nz-tag nzColor="red">Đã xóa khỏi kho</nz-tag> }
                </td>
                <td class="muted">{{ a.note || '—' }}</td>
                <td><strong>{{ a.viewedCount }}/{{ a.totalStudents }}</strong></td>
                <td>{{ a.createdAt | date: 'HH:mm dd/MM/yyyy' }}</td>
                <td>
                  <button nz-button nzType="link" nzSize="small" [disabled]="a.materialDeleted" (click)="view(a)">
                    <nz-icon nzType="eye" /> Xem
                  </button>
                  <button nz-button nzType="link" nzSize="small" nzDanger nz-popconfirm
                    nzPopconfirmTitle="Thu hồi tài liệu đã giao?" (nzOnConfirm)="remove(a)">Thu hồi</button>
                </td>
              </tr>
              <tr [nzExpand]="expandedId() === a.id">
                <ng-container *ngTemplateOutlet="viewerList; context: { $implicit: a }" />
              </tr>
            }
          </tbody>
        </nz-table>
      }

      <!-- Trạng thái xem per-student (dùng chung desktop expand + mobile card) -->
      <ng-template #viewerList let-a>
        @if (viewersLoadingId() === a.id) {
          <div class="center"><nz-spin nzSimple nzSize="small" /></div>
        } @else if (viewers()[a.id]; as list) {
          <div class="students">
            @for (v of list; track v.studentId) {
              <div class="student-row">
                <span class="s-name">{{ v.fullName }}</span>
                @if (v.viewedAt) {
                  <nz-tag nzColor="success">Đã xem {{ v.viewedAt | date: 'HH:mm dd/MM' }}</nz-tag>
                } @else {
                  <nz-tag>Chưa xem</nz-tag>
                }
                @if (!v.isActive) { <nz-tag nzColor="orange">Đã rời lớp</nz-tag> }
              </div>
            } @empty { <p class="muted">Lớp chưa có học viên.</p> }
          </div>
        }
      </ng-template>
    </nz-card>

    <!-- Modal Giao tài liệu -->
    <nz-modal [nzVisible]="assignOpen()" nzTitle="Giao tài liệu cho lớp" [nzOkLoading]="assigning()"
      nzOkText="Giao tài liệu" (nzOnOk)="doAssign()" (nzOnCancel)="assignOpen.set(false)" [nzWidth]="560">
      <ng-container *nzModalContent>
        <div class="form-block">
          <label class="lbl">Chọn tài liệu trong Kho</label>
          <nz-select class="full" nzShowSearch nzServerSearch nzPlaceHolder="Gõ để tìm theo mã/tên tài liệu..."
            [nzLoading]="materialsLoading()" [(ngModel)]="selMaterialId" (nzOnSearch)="searchMaterials($event)">
            @for (m of materialOptions(); track m.id) {
              <nz-option [nzValue]="m.id" [nzLabel]="m.code + ' · ' + m.title" />
            }
          </nz-select>
          @if (subjectId()) {
            <label nz-checkbox class="chk" [(ngModel)]="onlySubject" (ngModelChange)="searchMaterials(lastSearch)">
              Chỉ tài liệu môn của lớp@if (subjectName()) { ({{ subjectName() }})}
            </label>
          }
        </div>

        <div class="form-block">
          <label class="lbl">Ghi chú cho học viên (tùy chọn)</label>
          <textarea nz-input [(ngModel)]="note" rows="3" maxlength="1000"
            placeholder="Ví dụ: Đọc trước Unit 5, ghi lại từ mới..."></textarea>
        </div>

        <p class="muted small">Học viên của lớp sẽ thấy tài liệu trong Cổng học viên; hệ thống ghi nhận ai đã mở xem.</p>
      </ng-container>
    </nz-modal>

    <app-document-preview />
  `,
  styles: `
    .mt { margin-top: 16px; }
    .card-actions { display: flex; gap: 8px; align-items: center; }
    .center { text-align: center; padding: 12px; }
    .muted { color: var(--hs-text-muted); }
    .small { font-size: 12px; }
    .asg-cards { display: flex; flex-direction: column; gap: 12px; }
    .asg-card { border: 1px solid var(--hs-border); border-radius: var(--hs-radius); padding: 12px; display: flex; flex-direction: column; gap: 4px; }
    .asg-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .asg-actions { display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
    .students { display: flex; flex-direction: column; gap: 4px; padding: 4px 0; }
    .student-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 2px 0; }
    .student-row .s-name { min-width: 140px; font-weight: 500; }
    .form-block { margin-bottom: 14px; }
    .form-block .lbl { display: block; margin-bottom: 6px; font-weight: 500; }
    .form-block .chk { margin-top: 8px; }
    .full { width: 100%; }
  `
})
export class SessionMaterials implements OnInit {
  private readonly materialsService = inject(MaterialsService);
  private readonly message = inject(NzMessageService);
  private readonly preview = viewChild.required(DocumentPreview);
  protected readonly screen = inject(ScreenService);

  /** Có giá trị ⇒ chỉ lượt giao gắn buổi này; null ⇒ mọi lượt giao của lớp (trang chi tiết lớp). */
  readonly sessionId = input<string | null>(null);
  readonly classId = input.required<string>();
  readonly subjectId = input<string | null>(null);
  readonly subjectName = input<string | null>(null);
  readonly cardTitle = input('Tài liệu');
  readonly emptyText = input('Buổi này chưa giao tài liệu nào');

  protected readonly loading = signal(false);
  protected readonly assignments = signal<MaterialAssignment[]>([]);
  protected readonly expandedId = signal<string | null>(null);
  protected readonly viewers = signal<Record<string, MaterialAssignmentViewer[]>>({});
  protected readonly viewersLoadingId = signal<string | null>(null);

  // Modal giao tài liệu
  protected readonly assignOpen = signal(false);
  protected readonly assigning = signal(false);
  protected readonly materialsLoading = signal(false);
  protected readonly materialOptions = signal<Material[]>([]);
  protected selMaterialId: string | null = null;
  protected onlySubject = true;
  protected note = '';
  protected lastSearch = '';
  private readonly materialSearch$ = new Subject<string>();

  constructor() {
    // Không distinctUntilChanged — toggle "Chỉ tài liệu môn của lớp" re-emit cùng chuỗi search để nạp lại.
    this.materialSearch$.pipe(
      debounceTime(300),
      switchMap(search => {
        this.materialsLoading.set(true);
        return this.materialsService.getPaged({
          page: 1, pageSize: 50, search,
          subjectId: this.onlySubject ? this.subjectId() : null
        });
      }),
      takeUntilDestroyed()
    ).subscribe({
      next: r => { this.materialOptions.set(r.items); this.materialsLoading.set(false); },
      error: () => this.materialsLoading.set(false)
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    const sessionId = this.sessionId();
    const source$ = sessionId
      ? this.materialsService.listAssignmentsBySession(sessionId)
      : this.materialsService.listAssignmentsByClass(this.classId());
    source$.subscribe({
      next: list => { this.assignments.set(list); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  protected toggleExpand(a: MaterialAssignment): void {
    if (this.expandedId() === a.id) { this.expandedId.set(null); return; }
    this.expandedId.set(a.id);
    this.viewersLoadingId.set(a.id);
    this.materialsService.assignmentViewers(a.id).subscribe({
      next: list => {
        this.viewers.update(m => ({ ...m, [a.id]: list }));
        if (this.viewersLoadingId() === a.id) this.viewersLoadingId.set(null);
      },
      error: () => { if (this.viewersLoadingId() === a.id) this.viewersLoadingId.set(null); }
    });
  }

  protected view(a: MaterialAssignment): void {
    if (a.source === 'ServerFile' && a.storedFileId) {
      this.preview().open({ fileId: a.storedFileId, title: a.materialTitle, fileName: a.fileName });
    } else if (a.url) {
      window.open(a.url, '_blank');
    } else {
      this.message.warning('Tài liệu không có nguồn để mở.');
    }
  }

  protected remove(a: MaterialAssignment): void {
    this.materialsService.removeAssignment(a.id).subscribe({
      next: () => { this.message.success('Đã thu hồi tài liệu.'); this.reload(); },
      error: (err: HttpErrorResponse) => this.message.error(err.error?.message ?? err.message)
    });
  }

  // ---- Modal giao tài liệu ----

  protected openAssign(): void {
    this.selMaterialId = null;
    this.note = '';
    this.onlySubject = !!this.subjectId();
    this.assignOpen.set(true);
    this.searchMaterials('');
  }

  protected searchMaterials(search: string): void {
    this.lastSearch = search;
    this.materialSearch$.next(search);
  }

  protected doAssign(): void {
    if (!this.selMaterialId) { this.message.warning('Chọn tài liệu cần giao.'); return; }
    this.assigning.set(true);
    this.materialsService.assign(this.selMaterialId, {
      classId: this.classId(),
      classSessionId: this.sessionId(),
      note: this.note.trim() || null
    }).subscribe({
      next: () => {
        this.assigning.set(false);
        this.assignOpen.set(false);
        this.message.success('Đã giao tài liệu cho lớp.');
        this.reload();
      },
      error: (err: HttpErrorResponse) => {
        this.assigning.set(false);
        this.message.error(err.error?.message ?? err.message ?? 'Giao tài liệu thất bại.');
      }
    });
  }
}
