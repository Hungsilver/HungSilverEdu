# HungSilver — Hướng dẫn sử dụng

> Tài liệu này dành cho **người dùng cuối** (chủ trung tâm, quản trị viên, giáo viên, học sinh/phụ huynh).

**HungSilver** là ứng dụng web giúp trung tâm/giáo viên tiếng Anh quản lý toàn bộ hoạt động dạy–học
ở một nơi: học sinh, lớp, lịch, điểm danh từng buổi, điểm thưởng, tiến bộ học tập, học phí, báo cáo
phụ huynh và thông báo — thay cho sổ giấy và file Excel rời rạc.

- **Truy cập:** trình duyệt máy tính hoặc điện thoại (giao diện responsive, tiếng Việt).
- **Luồng chính:** **Tổng quan → Học viên → Lớp học → Lịch/Buổi học → Báo cáo & Thông báo**.

---

## Mục lục
1. [Vai trò người dùng](#1-vai-trò-người-dùng)
2. [Đăng nhập / Đăng xuất](#2-đăng-nhập--đăng-xuất)
3. [Toàn bộ chức năng theo màn hình](#3-toàn-bộ-chức-năng-theo-màn-hình)
4. [Hướng dẫn theo luồng công việc](#4-hướng-dẫn-theo-luồng-công-việc)
5. [Cấu hình tính năng (Admin)](#5-cấu-hình-tính-năng-admin)
6. [Câu hỏi thường gặp & lưu ý](#6-câu-hỏi-thường-gặp--lưu-ý)

---

## 1. Vai trò người dùng

| Vai trò | Thấy gì | Quyền |
|---|---|---|
| **Quản trị viên (Admin)** | Toàn bộ menu + Quản lý người dùng + Cấu hình hệ thống | Toàn quyền: tạo/sửa/xóa học sinh, lớp, học phí, phân công giáo viên… |
| **Giáo viên (Teacher)** | Nghiệp vụ hằng ngày — **chỉ trong lớp mình phụ trách** | Điểm danh, chấm bài, nhật ký, báo cáo, đánh giá; **không** tạo/xóa lớp–học sinh, không cấu hình hệ thống |
| **Học sinh (User)** | Chỉ **"Trang của tôi" (Portal)** | Xem hồ sơ, tiến độ, điểm thưởng, lịch học của **chính mình** (chỉ đọc) |

> Phân quyền 2 lớp: theo **vai trò** + theo **dòng dữ liệu** (giáo viên chỉ truy cập được lớp/học sinh
> thuộc lớp mình).

**Tài khoản demo (seed sẵn khi chạy lần đầu):**

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Quản trị viên | `admin@hungsilver.local` | `Admin@12345` |
| Giáo viên | `teacher@hungsilver.local` | `Teacher@12345` |

Kèm dữ liệu mẫu: lớp **Movers A**, 3 học sinh, khung giờ + buổi học demo.

---

## 2. Đăng nhập / Đăng xuất

1. Mở web → trang **Đăng nhập**. Nhập email + mật khẩu, hoặc bấm nút **Google** (nếu đã cấu hình).
   Có thể tự **Đăng ký** tài khoản mới (mặc định là vai trò Học sinh).
2. Sau đăng nhập: menu ở **bên trái** (trên điện thoại bấm icon ☰ để mở), góc phải có avatar →
   bấm để **Đăng xuất**.
3. Phiên đăng nhập tự duy trì; khi hết hạn sẽ tự đăng nhập lại nếu phiên còn hiệu lực.

---

## 3. Toàn bộ chức năng theo màn hình

### Tổng quan (Dashboard)
Bức tranh nhanh trong ngày + biểu đồ:
- **Số liệu:** lịch hôm nay, tổng học sinh/lớp, học phí sắp đến hạn, vắng gần đây, chưa làm bài,
  **Top 10 tích cực**, học sinh cần theo dõi.
- **Biểu đồ:** chuyên cần theo tháng, tỷ lệ hoàn thành bài tập, điểm thưởng theo lớp, tăng trưởng điểm.

### Học viên (Students)
- Danh sách học sinh (tìm kiếm, phân trang). Giáo viên chỉ thấy học sinh thuộc lớp mình.
- **Hồ sơ học sinh** (mở chi tiết): thông tin cá nhân (họ tên, ngày sinh, trường, phụ huynh, SĐT,
  địa chỉ) + hồ sơ học tập (trình độ, giáo trình, mục tiêu, điểm đầu vào).
- **Tiến độ học tập:** chuyên cần, hoàn thành bài tập, điểm thưởng, **6 kỹ năng**
  (Nghe/Nói/Đọc/Viết/Ngữ pháp/Từ vựng) — **biểu đồ radar + đường tiến bộ điểm**.
- **Quy đổi điểm thưởng** thành quà/giảm học phí.
- *(Admin)* Tạo/sửa/xóa (xóa mềm — khôi phục được) học sinh; **liên kết tài khoản** để học sinh
  đăng nhập Portal.

### Lớp học (Classes)
- Danh sách lớp; mỗi lớp có giáo viên phụ trách, sĩ số tối đa, giáo trình.
- **Chi tiết lớp:** danh sách học sinh + **sĩ số / điểm trung bình lớp / tỷ lệ chuyên cần** tự tính.
- *(Admin)* Tạo/sửa lớp, **phân công giáo viên**, **ghi danh / gỡ học sinh** khỏi lớp.

### Lịch học (Schedule)
- Xem lịch theo **tháng** (kiểu Google Calendar) hoặc **tuần**.
- *(Admin)* Khai báo **khung giờ lặp tuần** cho lớp và **sinh buổi học tự động** cho cả khoảng thời gian;
  tạo/hủy buổi lẻ.
- Bấm vào một buổi để vào **màn hình buổi học**.

### Buổi học (Session) — *màn dùng nhiều nhất*
Một màn nhập liệu nhanh cho **cả lớp**, bấm **"Lưu tất cả"** một lần:
- **Điểm danh:** Có mặt / Đi muộn / Vắng có phép / Vắng không phép.
- **Bài tập về nhà**, **thái độ**, **ghi chú** từng học sinh.
- **Điểm thưởng/phạt:** cộng dồn theo sổ cái (số dư = thưởng − phạt − đã quy đổi).
- **Nhật ký giáo viên:** nội dung đã dạy, hoạt động, khó khăn, ghi chú cho buổi sau.
- **Sinh báo cáo buổi học:** một nút tạo báo cáo, xem trước/sao chép.

### Học phí (Tuition)
- Học phí theo **tháng × học sinh**; trạng thái **tự tính**: 🟢 đã đóng / 🟡 sắp đến hạn / 🔴 quá hạn.
- **Đánh dấu đã đóng**. *(Admin)* tạo/sửa hóa đơn học phí.

### Kho tài liệu (Materials)
- Tài liệu **theo lớp**: lưu **link ngoài** (Google Drive/YouTube…) hoặc **upload file lên server**
  (tùy cấu hình của Admin).

### Đánh giá hàng tháng (Evaluations)
- Chấm **5 tiêu chí** → tự xếp hạng **Xuất sắc / Tốt / Đạt / Cần cố gắng**.
- **Bảng vàng** tuần: top điểm thưởng, chuyên cần, hoàn thành bài tập.

### Thông báo (Notifications)
- Soạn một lần, gửi theo kênh: **Email** (tự động nếu đã cấu hình SMTP và học sinh có email),
  **Zalo/Messenger** (tạo sẵn nội dung để **copy gửi tay**).
- Dùng cho: lịch học, nghỉ học, báo cáo, học phí, bài tập.
- **Báo cáo phụ huynh theo tháng** (từ hồ sơ học sinh): sinh nội dung đi học/bài tập/điểm/nhận xét/đề xuất
  → xem trước, sao chép, gửi.

### Cảnh báo (Warnings)
Tự tổng hợp học sinh cần chú ý:
- Vắng **3 buổi liên tiếp**, không làm bài **3 lần liên tiếp**, **điểm giảm mạnh** (≥ ngưỡng),
  **học phí quá hạn**.

### Quản lý người dùng — *(chỉ Admin)*
- Danh sách tài khoản (kèm tài khoản đã xóa để khôi phục), tìm theo email/tên.
- **Gán vai trò** (Admin/Teacher/User), **xóa mềm / khôi phục**.
- Bảo vệ: không xóa **admin cuối cùng**, **không tự xóa chính mình**; xóa user sẽ thu hồi mọi phiên
  đăng nhập của họ.

### Cấu hình hệ thống — *(chỉ Admin)*
Thiết lập **phân tầng** (Toàn hệ thống → theo Lớp → theo Người dùng):
- **Chế độ lưu file** (`ExternalUrl` chỉ lưu link / `Server` cho phép upload),
- **Mốc nhắc học phí** (số ngày coi là "sắp đến hạn"),
- **Ngưỡng cảnh báo điểm giảm**, **múi giờ trung tâm**…

### Trang của tôi (Portal) — *(chỉ Học sinh)*
Học sinh đăng nhập xem **tiến độ, điểm thưởng, lịch học của chính mình** (chỉ đọc).

---

## 4. Hướng dẫn theo luồng công việc

### Quản trị viên — thiết lập ban đầu
1. **Quản lý người dùng** → tạo/gán vai trò cho giáo viên.
2. **Lớp học** → tạo lớp, **phân công giáo viên**, chọn giáo trình/sĩ số.
3. **Học viên** → thêm học sinh → **ghi danh** vào lớp; (tùy chọn) **liên kết tài khoản** để học sinh
   dùng Portal.
4. **Lịch học** → khai báo **khung giờ tuần** của lớp → **sinh buổi học tự động**.
5. **Cấu hình hệ thống** → chọn chế độ lưu file, mốc nhắc học phí, ngưỡng cảnh báo, múi giờ.
6. **Học phí** → tạo hóa đơn tháng cho học sinh.

### Giáo viên — luồng hằng ngày
1. **Tổng quan** → xem lịch & việc cần làm hôm nay.
2. **Lịch học** → bấm vào buổi học của lớp mình.
3. Trong **Buổi học**: điểm danh + bài tập + thái độ + **điểm thưởng/phạt** + ghi chú → **Lưu tất cả**.
4. Ghi **Nhật ký giáo viên** → bấm **Sinh báo cáo buổi học** nếu cần gửi.
5. Cuối tháng: **Đánh giá hàng tháng** + mở hồ sơ học sinh → **Báo cáo phụ huynh** → **Thông báo**
   (Email/Zalo).
6. Theo dõi **Cảnh báo** để xử lý sớm học sinh vắng/bỏ bài/điểm giảm.

### Học sinh / Phụ huynh
- Đăng nhập bằng tài khoản được trung tâm cấp → vào **Trang của tôi** để xem tiến độ, điểm thưởng,
  lịch học.

---

## 5. Cấu hình tính năng (Admin)

- **Upload tài liệu:** *Cấu hình hệ thống* → chọn `ExternalUrl` (chỉ lưu link, mặc định) hoặc `Server`
  (cho phép upload file lên máy chủ).
- **Gửi Email thật:** điền section `Smtp` (Host/Port/User/Password/FromEmail) ở cấu hình backend.
  Chưa cấu hình thì email báo "chưa cấu hình"; Zalo/Messenger luôn cho tạo nội dung để gửi tay.
- **Google Login:** tạo OAuth Client ID ở Google Cloud Console, thêm origin của web; điền
  `googleClientId` (frontend) **và** `Google__ClientId` (backend). Chưa cấu hình thì nút Google tự ẩn.

---

## 6. Câu hỏi thường gặp & lưu ý

- **Xóa nhầm có khôi phục được không?** Có — mọi nơi đều **xóa mềm**; Admin xem được bản ghi đã xóa và
  bấm khôi phục.
- **Báo cáo có phải gõ tay không?** Không — báo cáo buổi học và báo cáo phụ huynh tháng sinh bằng **một nút**.
- **Tại sao cảnh báo/học phí cập nhật khi mở màn hình?** Trạng thái được **tính lúc xem** (chưa có job
  nền tự nhắc — dự kiến tương lai).
- **Zalo/Messenger gửi tự động chưa?** Hiện ở chế độ "Manual" (tạo sẵn nội dung, gửi tay); tích hợp API
  thật là kế hoạch tương lai.
- **Khi triển khai thật (Production):** cần **HTTPS** để giữ phiên đăng nhập (cookie refresh đặt `Secure`).
