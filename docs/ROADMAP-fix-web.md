# Roadmap — "Fix web" theo yêu cầu khách hàng

> Lập 2026-06-15. Nguồn: yêu cầu của chủ trung tâm. Quyết định phạm vi đã chốt (xem mục **Quyết định**).
> Tài liệu kiến trúc: [`../ARCHITECTURE.md`](../ARCHITECTURE.md). Hướng dẫn dùng: [`HUONG-DAN-SU-DUNG.md`](./HUONG-DAN-SU-DUNG.md).

## Quyết định đã chốt với khách
1. **Import Excel** = nhập **học viên vào 1 lớp** (không phải danh sách lớp).
2. **Nộp bài** = **cả hai chiều**: học sinh tự nộp trên Portal + giáo viên đối soát/chỉnh → **mọi HS cần tài khoản**.
3. **Menu giáo viên** = chỉ **Lớp học + Học liệu** (học viên xem trong từng lớp). Nhật ký/Báo cáo/Đánh giá truy cập trong lớp/buổi.
4. **Phân loại học liệu** = **danh mục tự định nghĩa** (admin tự tạo).

## Hiện trạng (đã xác minh ở backend)
- ✅ ĐÃ CÓ: lịch/buổi học (CRUD + sinh từ slot), **phân quyền GV theo lớp đã enforce ở API** (ClassAccessGuard), điểm thưởng/phạt (`PointEntry`, reason text tự do), học liệu cơ bản (gắn 1 `ClassId`, enum type Pdf/Video/Vocabulary/Test/Homework).
- ❌ CHƯA CÓ: entity Assignment/Submission (bài tập hiện chỉ là enum `HomeworkStatus` trên `StudentSessionRecord`), thư viện Excel, danh mục/khối học liệu, danh sách lý do điểm sẵn.

---

## Các đợt triển khai

### Đợt 1 — Lấy "Lớp học" làm trung tâm + menu GV tối giản  *(yêu cầu 1b, 1c, 3)* — M
- **FE menu:** role `Teacher` chỉ còn **Lớp học + Học liệu**; Admin giữ nguyên.
- **Chi tiết lớp = hub:** khối **Học viên** (thông tin + điểm thưởng/phạt theo HS), **Lịch cố định** (khung giờ + buổi học, bấm mở buổi — đã có, đảm bảo bấm được), **Tình hình** (chuyên cần/BTVN/điểm tổng hợp).
- **BE:** endpoint tổng hợp `GET /api/classes/{id}/overview` (mỗi HS: số dư điểm thưởng/phạt, chuyên cần, tỉ lệ BTVN).
- **Lưu ý:** đưa lối "Đánh giá tháng" vào trong chi tiết lớp để GV không mất chức năng khi ẩn menu.

### Đợt 2 — Lịch học  *(2a, 2b)* — S–M (FE)
- Bấm ngày trống → modal **tạo buổi** (chọn lớp/giờ/chủ đề; dùng API có sẵn).
- Bấm 1 ngày → drawer **"Lịch ngày…"** liệt kê **mọi buổi** (Admin: cả trung tâm; GV: lớp mình), mỗi dòng mở buổi.

### Đợt 3 — Thư viện học liệu theo danh mục tự định nghĩa  *(5a, 5b)* — M–L
- **BE:** entity **MaterialCategory** (admin tạo: tên/mô tả/thứ tự); thêm `CategoryId` cho học liệu, cho phép học liệu thuộc **thư viện chung** (ClassId tùy chọn). Migration + CRUD + lọc theo danh mục.
- **FE:** trang Học liệu dạng **thư viện theo danh mục** + bộ lọc; vẫn xem theo lớp.
- Nền cho Đợt 4 (nguồn giao bài).

### Đợt 4 — Giao bài & nộp bài (2 chiều) + báo cáo tích cực  *(4a, 4b, 4c)* — L (lớn nhất)
- **Tiền đề:** tài khoản cho mọi HS (ghép với Đợt 6 — import tạo luôn tài khoản).
- **BE:** entity **Assignment** (gắn `MaterialId`, hạn nộp) + **Submission** (status ChưaNộp/ĐãNộp/Muộn, ngày nộp, file/link, ghi chú); **tự tính "Muộn"**. Endpoints GV tạo/đối soát + HS Portal nộp. Migration.
- **FE:** "Giao bài" trong buổi học (chọn học liệu + hạn); bảng theo dõi nộp tự cập nhật; Portal HS xem & nộp; báo cáo tự gắn nhãn **tích cực/không tích cực** theo điểm.

### Đợt 5 — Điểm thưởng/phạt thao tác nhanh  *(4d)* — M
- **BE:** danh sách **lý do cấu hình sẵn** (reward/penalty, có điểm mặc định) ở Settings phân tầng.
- **FE:** mỗi HS trên bảng buổi học có **nút bấm nhanh theo từng lý do** (1 chạm = cộng/trừ ngay) + nút "+/− tùy ý".

### Đợt 6 — Import Excel học viên vào lớp  *(1a)* — M
- **BE:** ClosedXML + `POST /api/classes/{id}/import-students` (đọc → validate → xem trước → xác nhận → tạo HS + ghi danh + **tạo tài khoản HS**). File mẫu tải về.
- **FE:** "Nhập từ Excel" trong lớp → tải mẫu → up → bảng xem trước → xác nhận.

### Sau cùng — AI chấm phát âm  *(5c)*
- Spike riêng: thu âm trên Portal → API chấm phát âm (vd Azure Pronunciation Assessment). Khảo sát sau.

---

## Thứ tự thực hiện
**1 → 6 → 3 → 4 → (2 và 5 xen kẽ).**
Đợt 6 sớm để có **tài khoản HS** (tiền đề Đợt 4); Đợt 3 là nền Đợt 4; Đợt 2 & 5 độc lập.

## Tiến độ
- [x] Đợt 1 — Lớp làm trung tâm + menu GV ✅ (2026-06-15)
- [x] Đợt 2 — Lịch học ✅ (2026-06-15)
- [x] Đợt 3 — Thư viện học liệu theo danh mục ✅ (2026-06-15)
- [x] Đợt 4 — Giao bài & nộp bài ✅ (2026-06-15)
- [x] Đợt 5 — Điểm thưởng/phạt nhanh ✅ (2026-06-15)
- [x] Đợt 6 — Import Excel học viên ✅ (2026-06-15)
- [ ] (Sau) AI chấm phát âm
