# HungSilver — Hệ thống quản lý trung tâm tiếng Anh

Phần mềm web giúp **trung tâm/giáo viên tiếng Anh** quản lý toàn bộ hoạt động dạy–học trên một nơi duy nhất:
học sinh, lớp học, lịch học, điểm danh từng buổi, điểm thưởng, tiến bộ học tập, học phí, báo cáo phụ huynh
và thông báo — thay cho sổ sách giấy và file Excel rời rạc.

> Luồng sử dụng chính: **Tổng quan → Học sinh → Lớp học → Buổi học → Báo cáo & Thông báo**.

---

## 1. Hệ thống làm được gì (chức năng)

**Dạy & học hằng ngày**
- **Quản lý học sinh:** hồ sơ cá nhân (họ tên, ngày sinh, trường, phụ huynh, SĐT, địa chỉ…) + hồ sơ học tập (trình độ, giáo trình, mục tiêu, điểm đầu vào).
- **Quản lý lớp học & ghi danh:** mỗi lớp có giáo viên phụ trách, sĩ số tối đa, giáo trình; xem danh sách học sinh, **sĩ số / điểm trung bình lớp / tỷ lệ chuyên cần** tự tính.
- **Lịch học:** xem theo **tháng** (như Google Calendar) hoặc **tuần**; khai báo khung giờ lặp tuần và **sinh buổi học tự động** cho cả khoảng thời gian.
- **Module buổi học (dùng nhiều nhất):** một màn nhập liệu nhanh cho cả lớp — **điểm danh** (có mặt / đi muộn / vắng có phép / không phép), **bài tập về nhà**, **thái độ**, **điểm thưởng/phạt** (tự cộng dồn, có mốc **quy đổi** quà/giảm học phí) và **ghi chú** từng học sinh; "Lưu tất cả" một lần.
- **Nhật ký giáo viên:** ghi nội dung đã dạy, hoạt động, khó khăn, ghi chú cho buổi sau.

**Theo dõi & báo cáo**
- **Hồ sơ tiến bộ học tập:** thống kê chuyên cần, hoàn thành bài tập, điểm thưởng và **6 kỹ năng** (Nghe/Nói/Đọc/Viết/Ngữ pháp/Từ vựng) — kèm **biểu đồ radar + đường tiến bộ điểm số**.
- **Dashboard:** số liệu tổng quan (lịch hôm nay, tổng học sinh/lớp, học phí sắp đến hạn, vắng gần đây, chưa làm bài, **top 10 tích cực**, học sinh cần theo dõi) + biểu đồ (chuyên cần theo tháng, tỷ lệ hoàn thành bài tập, điểm thưởng theo lớp, tăng trưởng điểm).
- **Báo cáo tự động:** một nút sinh **báo cáo buổi học** và **báo cáo phụ huynh theo tháng** (đi học, bài tập, điểm thưởng, nhận xét, đề xuất) — xem trước, sao chép, gửi.
- **Đánh giá hàng tháng & xếp hạng:** chấm 5 tiêu chí → xếp hạng (Xuất sắc/Tốt/Đạt/Cần cố gắng); **Bảng vàng** tuần (top điểm thưởng, chuyên cần, hoàn thành bài tập).
- **Cảnh báo tự động:** vắng 3 buổi liên tiếp, không làm bài 3 lần liên tiếp, điểm giảm mạnh, học phí quá hạn.

**Vận hành trung tâm**
- **Học phí:** theo tháng/học sinh, trạng thái **tự tính** (🟢 đã đóng / 🟡 sắp đến hạn / 🔴 quá hạn), đánh dấu đã đóng.
- **Kho tài liệu:** theo lớp — lưu **link ngoài** (Google Drive/YouTube…) hoặc **upload file lên server** (do quản trị viên cấu hình).
- **Thông báo:** soạn một lần, gửi qua **Email** (tự động), **Zalo/Messenger** (tạo sẵn nội dung để gửi nhanh); dùng cho lịch học, nghỉ học, báo cáo, học phí, bài tập.
- **Portal học sinh:** học sinh đăng nhập xem tiến độ, điểm thưởng và lịch học của **chính mình**.
- **Cấu hình hệ thống:** thiết lập phân tầng (toàn hệ thống → theo lớp → theo người dùng): chế độ lưu file, mốc nhắc học phí, ngưỡng cảnh báo, múi giờ…

---

## 2. Lợi ích khi dùng web

- **Một nơi duy nhất, hết rời rạc:** thay sổ điểm danh giấy + nhiều file Excel bằng dữ liệu tập trung, truy cập mọi lúc trên máy tính/điện thoại (giao diện **responsive**).
- **Điểm danh & chấm buổi học siêu nhanh:** cả lớp trên một màn hình, lưu một lần — giảm thời gian giấy tờ sau giờ dạy.
- **Tiết kiệm thời gian báo cáo:** báo cáo buổi học và báo cáo phụ huynh tháng được **sinh tự động** chỉ với một nút.
- **Nhìn thấy tiến bộ thật:** biểu đồ năng lực 6 kỹ năng + tăng trưởng điểm giúp tư vấn lộ trình cho phụ huynh thuyết phục hơn.
- **Không bỏ sót việc quan trọng:** cảnh báo sớm học sinh vắng/bỏ bài/điểm giảm và **học phí sắp đến hạn / quá hạn**.
- **Tạo động lực học sinh:** điểm thưởng cộng dồn, quy đổi quà, **Bảng vàng** hằng tuần — rất hiệu quả với học sinh tiểu học/THCS.
- **Phù hợp trung tâm nhiều giáo viên:** mỗi giáo viên chỉ thấy và quản lý **lớp của mình**; quản trị viên thấy toàn bộ.
- **Giữ liên lạc với phụ huynh:** gửi báo cáo/thông báo qua Email, hoặc copy nhanh sang Zalo/Messenger.

**Theo từng vai trò:**
| Vai trò | Nhận được gì |
|---|---|
| **Chủ trung tâm / Quản trị** | Bức tranh toàn cảnh, quản lý lớp–học sinh–học phí, phân quyền giáo viên, cấu hình hệ thống |
| **Giáo viên** | Điểm danh/chấm bài nhanh, nhật ký, báo cáo & đánh giá — gọn trong các lớp mình phụ trách |
| **Phụ huynh** | Báo cáo tháng + thông báo rõ ràng, kịp thời |
| **Học sinh** | Portal xem tiến độ, điểm thưởng, lịch học của mình |

---

## 3. Phân quyền

- **Quản trị viên (Admin):** toàn quyền + cấu hình hệ thống.
- **Giáo viên (Teacher):** quản lý nghiệp vụ hằng ngày, chỉ trong **lớp của mình**.
- **Học sinh (User):** portal xem dữ liệu cá nhân (chỉ đọc).

Phân quyền được kiểm soát hai lớp: theo vai trò (policy `AdminOnly` / `TeacherOrAdmin`) và **theo dòng dữ liệu** (giáo viên chỉ truy cập lớp/học sinh thuộc lớp mình).

---

## 4. Công nghệ

- **Backend:** .NET 10 Web API, Clean Architecture 4 tầng · PostgreSQL (EF Core/Npgsql) · ASP.NET Identity + JWT (access 15') + refresh rotation (HttpOnly cookie) + Google Login · AutoMapper · gửi Email qua MailKit.
- **Frontend:** Angular 21 (standalone, signals, zoneless) + **ng-zorro-antd**, tiếng Việt, biểu đồ **ECharts**, responsive mobile.
- **Patterns:** Result pattern (không ném exception cho luồng nghiệp vụ), generic `Repository<T>`, **soft delete trên mọi bảng**, cấu hình phân tầng.
- API docs: **Scalar** tại `/scalar/v1` (chỉ Development).

> Chi tiết kiến trúc & luồng: xem [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## 5. Cấu trúc

```
├── docker-compose.yml          # Full stack: postgres + api + client (VPS)
├── docker-compose.dev.yml      # Dev: chỉ PostgreSQL
├── docker-compose.prod.yml     # Prod: kéo image từ GHCR
├── .env.example                # Mẫu secrets — copy thành .env
├── server/
│   ├── HungSilver.slnx · global.json (pin .NET SDK 10)
│   └── src/
│       ├── HungSilver.Domain/          # Entities, Enums, BaseEntity, Result/Error
│       ├── HungSilver.Application/      # Interfaces, DTOs, validators, AutoMapper profiles, services CRUD
│       ├── HungSilver.Infrastructure/   # EF Core + Npgsql, Identity, JWT, services join/aggregate, Seeder
│       └── HungSilver.WebApi/           # Controllers, middleware, cấu hình
└── client/                     # Angular 21 + ng-zorro (dashboard, students, classes, schedule, sessions, ...)
```

## 6. Chạy thử trên máy dev

```powershell
# 1. Database dev (PostgreSQL qua Docker). Kiểm tra cổng khớp ConnectionStrings:Default
#    trong server/src/HungSilver.WebApi/appsettings.Development.json
docker compose -f docker-compose.dev.yml up -d

# 2. Backend → http://localhost:5000 (Scalar API docs: /scalar/v1). Migrations + seed tự chạy.
cd server/src/HungSilver.WebApi
dotnet run --launch-profile http

# 3. Frontend → http://localhost:4200 (proxy /api -> :5000)
cd client
npm install
npm start
```

**Tài khoản demo (seed sẵn khi chạy lần đầu):**

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Quản trị viên | `admin@hungsilver.local` | `Admin@12345` |
| Giáo viên | `teacher@hungsilver.local` | `Teacher@12345` |

Kèm dữ liệu mẫu: lớp **Movers A**, 3 học sinh, khung giờ + buổi học demo.

Tạo migration mới:

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet ef migrations add <TenMigration> --project server/src/HungSilver.Infrastructure --startup-project server/src/HungSilver.WebApi
```

## 7. Cấu hình tính năng

- **Upload file (Kho tài liệu):** vào **Cấu hình hệ thống** chọn chế độ `ExternalUrl` (chỉ lưu link, mặc định) hoặc `Server` (cho upload file lên máy chủ).
- **Gửi Email:** điền section `Smtp` (Host/Port/User/Password/FromEmail) trong cấu hình backend. Chưa cấu hình thì email báo "chưa cấu hình"; Zalo/Messenger luôn cho phép tạo nội dung để gửi tay.
- **Google Login:** tạo OAuth Client ID (Web application) ở [Google Cloud Console](https://console.cloud.google.com/apis/credentials), thêm origin `http://localhost:4200` (dev) + domain thật; điền `googleClientId` vào `client/src/environments/*.ts` **và** `Google__ClientId` (backend). Chưa cấu hình thì nút Google tự ẩn.

## 8. Deploy VPS

```bash
# Trên VPS đã cài Docker + Docker Compose
cp .env.example .env
nano .env          # đổi POSTGRES_PASSWORD, JWT_SECRET (>=32 ký tự, bắt buộc), tài khoản seed, Google ClientId
docker compose up -d --build
```

Mở `http://<ip-vps>` (hoặc cổng `HTTP_PORT` trong `.env`).

**HTTPS:** ở Production refresh cookie được set `Secure` — phiên đăng nhập chỉ duy trì qua **HTTPS**. Khuyến nghị reverse proxy có TLS (Caddy/nginx + Let's Encrypt hoặc Cloudflare) trỏ về client.

## 9. CI/CD (GitHub Actions → VPS)

- **`ci.yml`** — chạy trên mọi `push` (dev, master) và PR: build + test server (.NET 10) và client (Angular 21).
- **`cd.yml`** — chạy khi push/merge vào **`master`**: build 2 image → push **GHCR** → SSH vào VPS `pull` + `up -d` bằng `docker-compose.prod.yml`.

**GitHub Secrets cần:** `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (private key OpenSSH), `VPS_PORT` (nếu khác 22), `GHCR_PAT` (scope `read:packages`, có thể bỏ nếu để package GHCR Public). `GITHUB_TOKEN` tự động.

Chuẩn bị VPS (làm 1 lần): cài Docker (`curl -fsSL https://get.docker.com | sh`), tạo `/opt/hungsilver` + `.env` (set `JWT_SECRET`, `POSTGRES_PASSWORD`, `GHCR_OWNER`, `IMAGE_TAG=latest`, `HTTP_PORT=80`), thêm SSH public key của CI, mở firewall `80,22/tcp`.

## 10. API chính

Base path `/api`. Lỗi trả `ProblemDetails { status, title, detail }`. Liệt kê đầy đủ ở Scalar `/scalar/v1`.

| Nhóm | Endpoint tiêu biểu | Quyền |
|---|---|---|
| Xác thực | `/auth/register` `/login` `/google` `/refresh` `/logout` `/me` | Public/Cookie/User |
| Học sinh | `/students` (CRUD) · `/students/{id}/progress` · `/redeem` · `/parent-report` · `/link-user` | Teacher/Admin (ghi: Admin) |
| Lớp học | `/classes` (CRUD) · `/roster` · `/teacher` · `/enroll` | Teacher/Admin (ghi: Admin) |
| Lịch học | `/schedule?from&to` · `/slots` · `/generate-sessions` · `/sessions` | Teacher/Admin |
| Buổi học | `/sessions/{id}/sheet` · `/attendance` · `/points` · `/journal` · `/report/generate` | Teacher/Admin |
| Dashboard | `/dashboard/summary` · `/charts` | Teacher/Admin |
| Học phí | `/tuition` (CRUD) · `/mark-paid` | Teacher/Admin (ghi: Admin) |
| Tài liệu | `/materials?classId` (CRUD) · `/files` (upload) | Teacher/Admin |
| Đánh giá | `/evaluations` · `/leaderboard` | Teacher/Admin |
| Thông báo | `/notifications` | Teacher/Admin |
| Cảnh báo | `/warnings` | Teacher/Admin |
| Portal HS | `/portal/me` | Học sinh |
| Cấu hình | `/settings/effective` · `/scope/{scope}` | Admin (lớp: GV) |
| Health | `/health` | Public |
