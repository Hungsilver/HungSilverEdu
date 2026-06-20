// Tiện ích chuyển đổi Date ↔ chuỗi DateOnly/TimeOnly cho API (backend dùng DateOnly `yyyy-MM-dd`,
// TimeOnly `HH:mm:ss`). Dùng lịch ĐỊA PHƯƠNG (getFullYear/getMonth/getDate…) thay vì toISOString
// (vốn quy về UTC) để ngày/giờ khớp đúng cái người dùng chọn, không lệch khi đổi múi giờ.

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Date → `yyyy-MM-dd` (DateOnly) theo giờ địa phương. */
export function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Như {@link toDateOnly} nhưng trả `null` khi chưa chọn ngày (form rỗng). */
export function toDateOnlyOrNull(d: Date | null | undefined): string | null {
  return d ? toDateOnly(d) : null;
}

/** Date → `HH:mm:ss` (TimeOnly) theo giờ địa phương. */
export function toTimeOnly(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}
