import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Component, OnInit, computed, input, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';

/** Định nghĩa 1 cột cấu hình được (ẩn/hiện + đổi vị trí). */
export interface ColumnDef {
  key: string;
  label: string;
}

/**
 * Nút bánh răng + popup "Chỉnh sửa cột" dùng chung cho các bảng danh sách.
 * Cho phép kéo-thả ẩn/hiện và đổi thứ tự cột; lưu localStorage theo `storageKey`. Mặc định hiện tất cả.
 * Component dùng `visibleColumns()` (qua biến tham chiếu template) để bảng render cột theo cấu hình.
 */
@Component({
  selector: 'app-column-settings',
  imports: [DragDropModule, NzButtonModule, NzDropDownModule, NzIconModule, NzMenuModule, NzModalModule, NzTooltipModule],
  template: `
    <button nz-button nz-dropdown [nzDropdownMenu]="menu" nzTrigger="click" nz-tooltip nzTooltipTitle="Tùy chọn cột" aria-label="Tùy chọn cột">
      <nz-icon nzType="setting" />
    </button>
    <nz-dropdown-menu #menu="nzDropdownMenu">
      <ul nz-menu>
        <li nz-menu-item (click)="openModal()"><nz-icon nzType="insert-row-right" /> Chỉnh sửa cột</li>
      </ul>
    </nz-dropdown-menu>

    <nz-modal [nzVisible]="modalOpen()" nzTitle="Chỉnh sửa cột hiển thị" [nzWidth]="640"
      (nzOnCancel)="modalOpen.set(false)" (nzOnOk)="apply()" nzOkText="Áp dụng">
      <ng-container *nzModalContent>
        <p class="cs-hint">Kéo thả cột giữa 2 cột bên dưới để ẩn/hiện; kéo lên/xuống để đổi thứ tự.</p>
        <div class="cs-grid" cdkDropListGroup>
          <div class="cs-pane">
            <div class="cs-pane-title">Hiển thị ({{ draftVisible().length }})</div>
            <div class="cs-list" cdkDropList [cdkDropListData]="draftVisible()" (cdkDropListDropped)="drop($event)">
              @for (c of draftVisible(); track c.key) {
                <div class="cs-item" cdkDrag><nz-icon nzType="holder" /> {{ c.label }}</div>
              } @empty { <div class="cs-empty">Chưa chọn cột nào</div> }
            </div>
          </div>
          <div class="cs-pane">
            <div class="cs-pane-title">Ẩn ({{ draftHidden().length }})</div>
            <div class="cs-list" cdkDropList [cdkDropListData]="draftHidden()" (cdkDropListDropped)="drop($event)">
              @for (c of draftHidden(); track c.key) {
                <div class="cs-item" cdkDrag><nz-icon nzType="holder" /> {{ c.label }}</div>
              } @empty { <div class="cs-empty">—</div> }
            </div>
          </div>
        </div>
        <button nz-button nzSize="small" (click)="resetDefault()"><nz-icon nzType="reload" /> Khôi phục mặc định</button>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .cs-hint { color: var(--hs-text-muted); font-size: 12px; margin: 0 0 12px; }
    .cs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .cs-pane { border: 1px solid var(--hs-border); border-radius: 8px; overflow: hidden; }
    .cs-pane-title { padding: 8px 12px; font-weight: 600; font-size: 13px; background: var(--hs-surface-2); border-bottom: 1px solid var(--hs-border); }
    .cs-list { min-height: 180px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
    .cs-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: 1px solid var(--hs-border); border-radius: 6px; background: var(--hs-surface); cursor: move; }
    .cs-empty { color: var(--hs-text-muted); font-size: 12px; text-align: center; padding: 16px 0; }
    .cdk-drag-preview { box-shadow: 0 4px 12px rgba(0,0,0,.18); border-radius: 6px; }
    .cdk-drag-placeholder { opacity: .4; }
    .cdk-drop-list-dragging .cs-item:not(.cdk-drag-placeholder) { transition: transform .15s ease; }
    @media (max-width: 600px) { .cs-grid { grid-template-columns: 1fr; } }
  `
})
export class ColumnSettings implements OnInit {
  /** Khóa localStorage riêng cho từng bảng, vd 'hs-cols-students'. */
  readonly storageKey = input.required<string>();
  /** Toàn bộ cột cấu hình được, theo thứ tự mặc định. */
  readonly columns = input.required<ColumnDef[]>();

  // Thứ tự key các cột đang hiển thị (đã lọc/sắp theo cấu hình).
  private readonly orderedKeys = signal<string[]>([]);
  protected readonly modalOpen = signal(false);
  protected readonly draftVisible = signal<ColumnDef[]>([]);
  protected readonly draftHidden = signal<ColumnDef[]>([]);

  /** Danh sách cột hiển thị theo đúng thứ tự — bảng dùng để render. */
  readonly visibleColumns = computed<ColumnDef[]>(() => {
    const cols = this.columns();
    return this.orderedKeys()
      .map(k => cols.find(c => c.key === k))
      .filter((c): c is ColumnDef => !!c);
  });

  ngOnInit(): void {
    const cols = this.columns();
    const saved = this.read();
    const keys = saved?.length ? saved.filter(k => cols.some(c => c.key === k)) : cols.map(c => c.key);
    this.orderedKeys.set(keys.length ? keys : cols.map(c => c.key));
  }

  protected openModal(): void {
    const cols = this.columns();
    const visible = this.orderedKeys()
      .map(k => cols.find(c => c.key === k))
      .filter((c): c is ColumnDef => !!c);
    const hidden = cols.filter(c => !this.orderedKeys().includes(c.key));
    this.draftVisible.set([...visible]);
    this.draftHidden.set([...hidden]);
    this.modalOpen.set(true);
  }

  protected drop(event: CdkDragDrop<ColumnDef[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    }
    // Gán lại tham chiếu để signal/computed cập nhật.
    this.draftVisible.set([...this.draftVisible()]);
    this.draftHidden.set([...this.draftHidden()]);
  }

  protected resetDefault(): void {
    this.draftVisible.set([...this.columns()]);
    this.draftHidden.set([]);
  }

  protected apply(): void {
    const keys = this.draftVisible().map(c => c.key);
    this.orderedKeys.set(keys);
    this.persist(keys);
    this.modalOpen.set(false);
  }

  private read(): string[] | null {
    try {
      const raw = localStorage.getItem(this.storageKey());
      return raw ? (JSON.parse(raw) as string[]) : null;
    } catch {
      return null;
    }
  }

  private persist(keys: string[]): void {
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(keys));
    } catch {
      // bỏ qua nếu trình duyệt chặn localStorage
    }
  }
}
