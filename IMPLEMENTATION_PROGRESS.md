# HungSilver — Tiến độ triển khai (file khôi phục phiên)

> **Mục đích:** Nếu session bị xóa/mất, đọc lại **file này** + **file plan** + **code hiện có** để tiếp tục công việc chính xác 100%.
> Cập nhật file này mỗi khi hoàn thành một task.
> **Cập nhật lần cuối:** ✅ GIAI ĐOẠN 1 HOÀN TẤT (Task #1–10). Backend build sạch + 10/10 unit test pass + API smoke test PASS. Frontend `npm run build` sạch (không warning). AutoMapper verify chạy runtime OK. Enum serialize STRING.
>
> **Cách chạy:** Backend `dotnet run` (Development, ASPNETCORE_URLS=http://localhost:5000); Frontend `cd client && npm start` (proxy /api → :5000). Login admin `admin@hungsilver.local`/`Admin@12345`, teacher `teacher@hungsilver.local`/`Teacher@12345`. DB tables KHÔNG có FK (đã kiểm migration). CÒN LẠI: kiểm thử UI/responsive trên trình duyệt (375px + desktop) + các module Giai đoạn 2.

## 0. Con trỏ tài liệu
- **Plan đầy đủ (đã duyệt):** `C:\Users\Administrator\.claude\plans\https-docs-google-com-document-d-1tez0fi-async-thimble.md`
- **Yêu cầu gốc:** Google Doc `1tEZ0FiQlipVazXV9EfX9NcJt-fWhrgY7HdJpnle0-j8` (hệ thống quản lý trung tâm tiếng Anh, 14 module).
- **Memory:** `C:\Users\Administrator\.claude\projects\E--MyProject\memory\` → `hungsilver-build-conventions.md`, `responsive-ui-mandatory.md`.

## 1. Quyết định/Rule đã chốt với user (BẮT BUỘC)
1. MVP theo giai đoạn nhưng **schema đầy đủ 14 module ngay từ đầu**.
2. **3 role:** `Admin` (toàn quyền + cấu hình hệ thống), `Teacher` (chỉ lớp của mình), `User` = **học sinh** (portal xem-chỉ-đọc làm ở GĐ2). Mỗi `ClassRoom` có `TeacherId`.
3. **AutoMapper v14.x** map entity↔DTO (KHÔNG ToDto thủ công). Đã pin 14.0.0. **Vuln GHSA-rvv3-g6hj-g44x** (DoS đệ quy) — user chọn GIỮ 14.0.0; đã suppress đúng advisory này trong `server/Directory.Build.props` qua `NuGetAuditSuppress`.
4. **Bảng MỚI KHÔNG có khóa ngoại (FK):** chỉ cột `Guid` + index; toàn vẹn ở app layer; join thủ công trong service Infrastructure.
5. **Cấu hình phân tầng (Settings)** key-value scope System→Role→Class→User (override cụ thể nhất thắng).
6. **Upload file 2 chế độ** do Admin cấu hình qua setting `FileStorage.Mode` (`Server`|`ExternalUrl`) + abstraction `IFileStorage`.
7. **Thông báo:** Email (SMTP/MailKit) thật; Zalo/Messenger tạo text copy thủ công (API thật để GĐ2).
8. **Biểu đồ:** ECharts (wrapper signal tự viết `shared/chart.ts`).
9. **UI responsive mobile bắt buộc** (375px + desktop) mỗi lần sửa giao diện.

## 2. Sự thật kỹ thuật (môi trường)
- .NET SDK: `dotnet` = **10.0.301** (thỏa global.json 10.0.100 + latestFeature). Build OK bằng `dotnet`.
- Solution: `E:\MyProject\server\HungSilver.slnx`. 4 project: Domain/Application/Infrastructure/WebApi + tests.
- `server/Directory.Build.props`: net10.0, Nullable+ImplicitUsings enable, TreatWarningsAsErrors=false.
- **DB dev (appsettings.Development.json):** `Host=localhost;Port=5432;Database=hungsilver;Username=postgres;Password=16062001` (Postgres native ở 5432, KHÔNG phải 5433). Jwt:Secret dev đã có (64 ký tự).
- Migration design-time cần `$env:ASPNETCORE_ENVIRONMENT="Development"`.
- Frontend: `E:\MyProject\client` (Angular 21, ng-zorro, signals/zoneless, vi_VN). API base `/api` (dev proxy → :5000).

## 3. Pattern bám theo (file tham chiếu đã đọc)
- Result pattern: `Domain/Common/Results/{Result,Error}.cs` (Error.Forbidden→403 qua `WebApi/Common/ResultExtensions.cs` `.ToActionResult()`).
- Generic repo: `Application/Abstractions/IRepository.cs` + `Infrastructure/Persistence/Repositories/Repository.cs` (open-generic đã đăng ký). `IUnitOfWork`.
- `PagedRequest`/`PagedResult<T>` ở `Application/Common/Models`. `PagedResult.Map(selector)`.
- `ValidationExtensions.ToError("Code")` cho FluentValidation.
- CRUD Application mẫu: `Application/Products/ProductService.cs`. Join/aggregate Infrastructure mẫu: `Infrastructure/Users/UserAdminService.cs`.
- `ICurrentUser` (UserId/Email/IsInRole). `AppRoles` (Admin/Teacher/User). Policies: `AdminOnly`, `TeacherOrAdmin` (đã thêm ở Program.cs).
- DbContext: `Infrastructure/Persistence/AppDbContext.cs` — global soft-delete filter loop PHẢI ở cuối OnModelCreating; `ApplyConfigurationsFromAssembly` gọi trước loop đó.

## 4. Tiến độ TASK (10 task)
- [x] **#1 Domain enums + entities** — DONE. `Domain/Enums/*` (8 file), `Domain/Entities/*` (21 entity). Build Domain OK.
- [x] **#2 Packages + Roles + Policy + AutoMapper DI** — DONE. AutoMapper 14.* (Application.csproj), MailKit 4.* (Infrastructure.csproj). AppRoles +Teacher. Program.cs +TeacherOrAdmin. Application/DependencyInjection.cs +AddAutoMapper(assembly) + đăng ký IStudentService/IClassAccessGuard/ITeacherJournalService.
- [x] **#3 EF DbContext + Configurations (không FK)** — DONE. AppDbContext +20 DbSet. `Infrastructure/Persistence/Configurations/*` (7 file, chỉ length/precision/index, KHÔNG FK). ClassRoom→ToTable("Classes").
- [x] **#4 Settings + File storage** — DONE.
  - Application: `Common/IClassAccessGuard.cs`+`ClassAccessGuard.cs` (scope class + student), `Abstractions/IUserDirectory.cs`, `Abstractions/IFileStorage.cs`, `Settings/{SettingKeys,SettingsDtos,ISettingsResolver,ISettingsService,SettingsProfile}.cs`, `Files/IFileService.cs`.
  - Infrastructure: `Services/UserDirectory.cs`, `Storage/{FileStorageOptions,LocalDiskFileStorage,FileService}.cs`, `Settings/SettingsService.cs` (impl cả ISettingsService+ISettingsResolver).
  - WebApi: `Controllers/{SettingsController,FilesController}.cs`.
  - DI Infrastructure: +Configure<FileStorageOptions>, +IUserDirectory, +IFileStorage, +IFileService, +SettingsService (forward 2 interface).
- [~] **#5 Students + Classes + Enrollment** — ĐANG LÀM.
  - Students: DONE — `Application/Students/{StudentDtos,StudentValidators,StudentProfile,StudentService(+IStudentService)}.cs`, `WebApi/Controllers/StudentsController.cs`. (List scope theo lớp cho teacher; CRUD AdminOnly; GET/{id} scope qua guard).
  - Classes/Enrollment: ĐANG VIẾT — đã có `Application/Classes/ClassDtos.cs`. CÒN LẠI: `Application/Classes/ClassValidators.cs`, `Application/Classes/IClassService.cs`, `Infrastructure/Classes/ClassService.cs` (impl: GetPaged scope teacher, GetById+BuildClassDto computed CurrentSize/AverageScore(latest Periodic)/AttendanceRate, Create/Update/Delete(chặn còn HS)/Restore, AssignTeacher(validate role Teacher/Admin), GetRoster(scope), Enroll(capacity+dup check), Withdraw), `WebApi/Controllers/ClassesController.cs`. Đăng ký `IClassService→ClassService` trong Infrastructure DI.
- [ ] **#6 Schedule + Sessions + Journal** — `Application/Schedule`, `Application/Sessions`, `Application/Journals/{ITeacherJournalService(+impl)}`. Schedule: month/week, slot CRUD, generate-sessions, create/cancel. Sessions: GetSessionSheet, SaveAttendance(bulk upsert), AddPoint/RemovePoint, GetStudentProgress (route `~/api/students/{id}/progress` trong SessionsController), Redeem. Journal upsert 1:1. Controllers + DI. (ITeacherJournalService đã được tham chiếu trong Application DI — impl ở Application/Journals).
- [ ] **#7 Dashboard + Session report + Notification scaffold** — DashboardService (summary+charts, scope), SessionReportService (+template renderer), INotificationSender/INotificationDispatcher + EmailNotificationSender(MailKit, SmtpOptions) + Zalo/Messenger stub. Controllers + DI + SmtpOptions config.
- [ ] **#8 DbSeeder + Migration + build** — SeedOptions +Teacher*; seed GV demo+Curriculum+Class+Students+Enrollment+Slot+Session+AppSetting(FileStorage.Mode=ExternalUrl). appsettings +Smtp +FileStorage section. `dotnet ef migrations add AddTeachingDomain` (project Infrastructure, startup WebApi, output-dir Migrations) — kiểm tra KHÔNG có FK. `dotnet build` sạch.
- [ ] **#9 Frontend core + nav + shared** — models.ts (roles/enums/interfaces), services, app.routes.ts, shell.ts (responsive drawer), app.config.ts icons, auth.service isTeacher/isStudent, shared/chart.ts (ECharts) + shared/file-input.ts, `npm i echarts`.
- [ ] **#10 Frontend pages** — dashboard, students(list+detail), classes(list+detail), schedule(month nz-calendar + week grid), sessions(màn nhập liệu + journal + report), settings(admin), coming-soon. Responsive 375px/1280px. npm build + smoke test.

## GIAI ĐOẠN 2 (đang làm)
- [x] **Học phí (Tuition)** — `Application/Tuition`, `Infrastructure/Tuition/TuitionService` (status tính lại + scope teacher), `TuitionController`; FE `tuition.page` + service. DONE, build sạch.
- [x] **Kho tài liệu (Materials)** — `Application/Materials/MaterialService` (URL/ServerFile), `MaterialsController`; FE `materials.page` (nz-upload theo FileStorage.Mode). DONE.
- [x] **Đánh giá tháng + Bảng vàng** — `Application/Evaluations` + `Infrastructure/Evaluations/EvaluationService` (rank tự tính, leaderboard tuần), `EvaluationsController`; FE `evaluations.page`. DONE.
- [ ] **#14 Báo cáo phụ huynh + Thông báo** — chưa làm.
- [ ] **#15 Cảnh báo + Portal học sinh** — chưa làm.
- Nav: Học phí/Kho tài liệu/Đánh giá đã chuyển ra menu chính (Teacher+Admin); submenu "Sắp ra mắt" còn Thông báo/Cảnh báo.

## 5. Cách tiếp tục nếu mất session
1. Đọc file này + plan file (mục 0).
2. `git status` / liệt kê `server/src/**` để xác nhận file nào đã tạo.
3. Tiếp tục từ task `[~]`/`[ ]` đầu tiên theo spec mục 4 + plan.
4. Build kiểm tra: `dotnet build E:\MyProject\server\HungSilver.slnx`. (Solution CHƯA build sạch tới khi xong #5/#6 vì Application DI tham chiếu IStudentService/IClassAccessGuard/ITeacherJournalService.)
5. Quy ước: KHÔNG FK ở bảng mới; dùng AutoMapper cho entity↔DTO đơn giản, map tay cho DTO tổng hợp (computed); UI responsive.

## 6. Lệch so với plan / lưu ý phát sinh
- DB port thực tế **5432** (không phải 5433 như plan giả định).
- AutoMapper 14.0.0 có vuln → đã suppress đúng advisory (user đồng ý giữ 14.x).
- Student progress endpoint đặt ở SessionsController route tuyệt đối `~/api/students/{id}/progress` để StudentsController không phụ thuộc SessionService.
- Mapping: AutoMapper cho DTO phẳng (Student/Setting...); map tay cho ClassDto/Dashboard (có field computed).
