/**
 * Hằng dùng chung cho các bảng danh sách (nz-table).
 * Giữ một nơi để chuẩn hóa & dễ tinh chỉnh sau.
 */

/** Tùy chọn số dòng/trang cho thanh phân trang (nzPageSizeOptions). */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Chiều cao tối đa thân bảng (nzScroll.y) để cuộn dọc + giữ header cột dính.
 * Trừ hao khung cố định (header) + lề/padding nội dung + page-header + bộ lọc + thanh phân trang.
 */
export const TABLE_SCROLL_Y = 'calc(100vh - 330px)';
