import { Directive, ElementRef, HostListener, inject } from '@angular/core';

/**
 * Kéo (grab) để cuộn ngang bảng ng-zorro.
 *
 * Bấm-giữ rồi rê chuột/ngón tay trên header hoặc thân bảng để trượt sang trái–phải
 * xem hết cột, thay vì phải nhắm thanh cuộn mỏng dưới đáy. Chỉ pan NGANG; cuộn dọc,
 * sticky header và phân trang giữ nguyên.
 *
 * Gắn trên thẻ bảng:  <nz-table appTableDragScroll ...>
 *
 * - Khi có nzScroll.y, ng-zorro tách header (.ant-table-header) và thân (.ant-table-body)
 *   nhưng đồng bộ cuộn ngang ⇒ chỉ cần đặt scrollLeft của thân là header trượt theo,
 *   nên kéo ở header cũng pan được. Khi chỉ có nzScroll.x thì phần tử cuộn là
 *   .ant-table-content.
 * - Bỏ qua khi bấm trúng phần tử tương tác (nút/link/ô nhập/select/checkbox/popconfirm)
 *   để không phá click mở chi tiết, chọn quyền, chọn-tất-cả...
 * - Sau khi đã kéo, chặn đúng cú click kế tiếp để không vô tình mở modal chi tiết.
 */
@Directive({
  selector: '[appTableDragScroll]',
  standalone: true,
  host: { class: 'hs-drag-scroll' }
})
export class TableDragScroll {
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  private scroller: HTMLElement | null = null;
  private startX = 0;
  private startScrollLeft = 0;
  private dragging = false;
  private moved = false;
  private pointerId = -1;

  @HostListener('pointerdown', ['$event'])
  protected onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return; // chỉ chuột trái / chạm
    const target = e.target as HTMLElement;
    // Giữ nguyên hành vi của phần tử tương tác trong bảng.
    if (target.closest('button, a, input, textarea, label, .ant-select, .ant-checkbox, .ant-switch, .ant-radio, [nz-popconfirm]')) return;

    const table = target.closest('.ant-table');
    const scroller =
      table?.querySelector<HTMLElement>('.ant-table-body') ??
      table?.querySelector<HTMLElement>('.ant-table-content') ??
      null;
    // Không có gì để cuộn ngang ⇒ không chiếm sự kiện.
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;

    this.scroller = scroller;
    this.startX = e.clientX;
    this.startScrollLeft = scroller.scrollLeft;
    this.dragging = true;
    this.moved = false;
    this.pointerId = e.pointerId;
    // KHÔNG setPointerCapture ở đây: khi một phần tử đang giữ pointer capture, trình duyệt
    // đổi target của sự kiện 'click' kế tiếp sang chính phần tử đó (bảng) thay vì <tr>,
    // khiến (click)="openDetail(...)" trên dòng KHÔNG bao giờ chạy. Chỉ chiếm con trỏ khi
    // người dùng đã thực sự kéo (vượt ngưỡng) — xem onPointerMove.
  }

  @HostListener('pointermove', ['$event'])
  protected onPointerMove(e: PointerEvent): void {
    if (!this.dragging || !this.scroller) return;
    const dx = e.clientX - this.startX;
    if (!this.moved && Math.abs(dx) <= 4) return; // ngưỡng để click vẫn là click
    if (!this.moved) {
      // Bắt đầu kéo thật ⇒ giờ mới chiếm con trỏ để tiếp tục nhận pointermove kể cả khi
      // rê ra ngoài bảng; cú click sinh ra sau đó sẽ bị nuốt trong endDrag().
      this.moved = true;
      this.host.classList.add('hs-dragging');
      if (this.pointerId >= 0) this.host.setPointerCapture?.(this.pointerId);
    }
    this.scroller.scrollLeft = this.startScrollLeft - dx;
    e.preventDefault();
  }

  @HostListener('pointerup')
  protected onPointerUp(): void {
    this.endDrag();
  }

  @HostListener('pointercancel')
  protected onPointerCancel(): void {
    this.endDrag();
  }

  private endDrag(): void {
    if (!this.dragging) return;
    const wasMoved = this.moved;
    this.dragging = false;
    this.moved = false;
    this.scroller = null;
    this.host.classList.remove('hs-dragging');
    if (this.pointerId >= 0) {
      // Chỉ nhả khi đang thực sự giữ capture (chỉ xảy ra khi đã kéo) — gọi release lúc
      // không giữ sẽ ném InvalidPointerId trên cú click thường.
      if (this.host.hasPointerCapture?.(this.pointerId)) this.host.releasePointerCapture(this.pointerId);
      this.pointerId = -1;
    }
    // Đã kéo ⇒ nuốt cú click kế tiếp để không mở modal chi tiết ngoài ý muốn.
    if (wasMoved) {
      const suppress = (ev: Event) => ev.stopPropagation();
      this.host.addEventListener('click', suppress, { capture: true, once: true });
      // Dọn listener nếu vì lý do nào đó không có click phát sinh.
      setTimeout(() => this.host.removeEventListener('click', suppress, true), 0);
    }
  }
}
