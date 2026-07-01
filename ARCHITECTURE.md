# HungSilver — Tài liệu kiến trúc & vận hành

> **Mục đích file này:** Là "bản đồ" duy nhất để hiểu toàn bộ project. Trước khi làm một task,
> Claude Code (hoặc dev) chỉ cần đọc file này thay vì truy vết lại từ source. **Mỗi thay đổi
> đáng kể về kiến trúc/luồng/chức năng phải được cập nhật vào đây** (xem mục [Changelog](#16-changelog)).
>
> Cập nhật lần đầu: 2026-06-13. Tương ứng commit gốc `481dc3e Initial commit`.

---

## 1. Tổng quan

**Hệ thống quản lý trung tâm dạy tiếng Anh ("HungSilver")** — xây trên base full-stack Clean Architecture, sẵn sàng chạy thật trên VPS. Domain nghiệp vụ (14 module, làm theo giai đoạn) mô tả ở **[§15](#15-domain-nghiệp-vụ-trung-tâm-tiếng-anh-giai-đoạn-1)**; phần dưới (§3–§14) là hạ tầng nền dùng chung.

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Backend | **.NET 10** Web API, Clean Architecture 4 tầng | SDK pin `10.0.100` (`server/global.json`) |
| Frontend | **Angular 21** standalone + signals + **zoneless** | UI: **ng-zorro-antd 21**, i18n tiếng Việt |
| Database | **PostgreSQL 18** (Npgsql EF Core) | Dev qua Docker cổng **5433** |
| Auth | ASP.NET Core Identity + **JWT access 15'** + **refresh token rotation** (HttpOnly cookie) + **Google Login** |
| Phân quyền | Role `Admin` / `Teacher` / `User`(=học sinh); policy `AdminOnly` + `TeacherOrAdmin`; phân quyền theo lớp ở service (client: route guards) |
| Mapping | **AutoMapper 14.x** cho entity↔DTO phẳng (DTO tổng hợp map tay) |
| API docs | **Scalar** UI tại `/scalar/v1` (chỉ Development) |
| Logging | **Serilog** (console) + request logging |

**Patterns chủ đạo:** Result pattern (không ném exception cho luồng nghiệp vụ) · generic `Repository<T>` CRUD chung · **soft delete trên MỌI bảng** (global query filter + interceptor) · Unit of Work · Options pattern · AutoMapper. **Lưu ý:** mọi **bảng nghiệp vụ mới (§15) KHÔNG dùng khóa ngoại** — chỉ cột `Guid` + index, toàn vẹn kiểm ở tầng app (bảng nền RefreshToken vẫn giữ FK).

**Thư mục gốc:** `E:\MyProject` · branch chính `master`, branch dev `dev` · git user `Hungsilver`.

---

## 2. Cấu trúc thư mục

```
E:\MyProject\
├── ARCHITECTURE.md             # ← FILE NÀY
├── README.md                   # hướng dẫn dev/deploy (người đọc)
├── docker-compose.yml          # full stack build tại chỗ (postgres + api + client)
├── docker-compose.dev.yml      # dev: CHỈ PostgreSQL 18 (cổng 5433)
├── docker-compose.prod.yml     # prod: KÉO image từ GHCR (CD scp lên /opt/hungsilver)
├── .env / .env.example         # secrets (KHÔNG commit .env)
├── .github/workflows/
│   ├── ci.yml                  # build + test server & client (push dev/master, PR)
│   └── cd.yml                  # build→push GHCR→deploy VPS (push master)
├── server/
│   ├── HungSilver.slnx         # solution (định dạng .slnx mới)
│   ├── global.json             # pin SDK .NET 10.0.100
│   ├── Dockerfile              # multi-stage: sdk:10.0 build → aspnet:10.0 (cổng 8080)
│   └── src/
│       ├── HungSilver.Domain/          # tầng trong cùng — không phụ thuộc gì
│       ├── HungSilver.Application/     # interface, DTO, validator, use case (Students/Subjects/…)
│       ├── HungSilver.Infrastructure/  # EF Core, Identity, JWT, Google, Repository, Seeder
│       └── HungSilver.WebApi/          # Controllers, middleware, Program.cs, config
│   └── tests/HungSilver.UnitTests/     # xUnit + SQLite in-memory
└── client/
    ├── Dockerfile              # node:22 build → nginx:alpine
    ├── nginx.conf              # SPA fallback + proxy /api → http://api:8080
    ├── proxy.conf.json         # dev: /api → http://localhost:5000
    └── src/app/
        ├── core/               # services, interceptor, guards, models (singleton)
        ├── features/           # auth, classes, students, teachers, tuition, admin/users…
        ├── layout/shell.ts     # khung sider + header sau khi đăng nhập
        └── shared/             # google-signin-button
```

---

## 3. Kiến trúc Backend — Clean Architecture 4 tầng

**Quy tắc phụ thuộc (chỉ hướng vào trong):**
`WebApi → Infrastructure → Application → Domain`. Tầng trong **không biết** tầng ngoài.

### 3.1 Domain (`HungSilver.Domain`) — không phụ thuộc package ngoài
- `Common/BaseEntity.cs` — base cho mọi entity nghiệp vụ: `Id` (Guid), audit (`CreatedAt`/`UpdatedAt`), soft delete (`IsDeleted`/`DeletedAt`). Implement `IAuditable` + `ISoftDeletable`.
- `Common/IAuditable.cs`, `Common/ISoftDeletable.cs` — interface marker, driver cho interceptor & query filter.
- `Common/AppRoles.cs` — hằng `Admin`, `User`, mảng `All`.
- `Common/Results/Result.cs` — **Result pattern**: `Result` và `Result<T>`. `Success()/Failure(error)`; ép kiểu ngầm `T → Result<T>`. Truy cập `.Value` khi failure sẽ ném (lỗi lập trình).
- `Common/Results/Error.cs` — `record Error(Code, Message, ErrorType)`. `ErrorType`: `Failure, Validation, NotFound, Conflict, Unauthorized, Forbidden`. Factory: `Error.NotFound(...)`, `Error.Conflict(...)`, …
- `Entities/RefreshToken.cs` — `UserId, TokenHash (SHA-256), ExpiresAt, RevokedAt?, ReplacedByTokenHash?`; `IsActive => RevokedAt == null && now < ExpiresAt`. **Chỉ lưu hash**, token gốc ở cookie client.

### 3.2 Application (`HungSilver.Application`) — interface + use case, không chạm EF/HTTP
- `Abstractions/IRepository.cs` — hợp đồng CRUD generic (`GetByIdAsync, FindAsync, AnyAsync, GetPagedAsync, AddAsync, Update, SoftDelete, RestoreAsync`). Tham số `includeDeleted` để bỏ qua query filter.
- `Abstractions/IUnitOfWork.cs` — `SaveChangesAsync`.
- `Abstractions/ICurrentUser.cs` — `UserId?, Email?, IsAuthenticated, IsInRole(role)` (đọc từ ClaimsPrincipal).
- `Abstractions/IJwtTokenService.cs` — `CreateAccessToken, CreateRefreshToken, HashToken` + record `AccessTokenResult`.
- `Abstractions/IGoogleAuthVerifier.cs` — `VerifyAsync(idToken)` → `GoogleUserInfo`.
- `Auth/` — `IAuthService`, `AuthDtos` (`RegisterRequest, LoginRequest, GoogleLoginRequest, UserDto, AuthTokens`), `AuthValidators` (FluentValidation: password ≥8, có hoa/thường/số).
- `Users/` — `IUserAdminService`, `UserAdminDtos` (`UserListItemDto, AssignRolesRequest`).
- `Common/Models/` — `PagedRequest` (Page, PageSize clamp 1..100, Search, SortBy, SortDesc), `PagedResult<T>` (Items, Page, PageSize, TotalCount, TotalPages tính sẵn, có `.Map()`).
- `Common/ValidationExtensions.cs` — `ValidationResult.ToError(code)` gộp message.
- `DependencyInjection.cs` — `AddApplication()`: đăng ký validators (quét assembly) + AutoMapper + các service Application (Students/Subjects/Grades/Branches/PointReasons/Materials/Journals…).

### 3.3 Infrastructure (`HungSilver.Infrastructure`) — EF Core, Identity, hiện thực
- `Persistence/AppDbContext.cs` — kế thừa `IdentityDbContext<AppUser, AppRole, Guid>`. `DbSet<RefreshToken>` + DbSet các entity nghiệp vụ (§15). **`OnModelCreating` tự gắn global query filter `IsDeleted == false` cho MỌI entity `ISoftDeletable`** (kể cả bảng Users) bằng reflection + expression.
- `Persistence/Repositories/Repository.cs` — hiện thực `IRepository<T>`. `Query(includeDeleted)` chọn có/không `IgnoreQueryFilters()`. `SoftDelete` = `Remove()` (interceptor sẽ đổi thành UPDATE). `ApplySort` build OrderBy động qua reflection theo `sortBy` (fallback `CreatedAt desc`). **`FindAsync` cũng mặc định `OrderByDescending(CreatedAt)`** (mới nhất trước, đồng bộ `GetPagedAsync`) — caller cần thứ tự khác (vd danh mục theo `IndexOrder`) tự sắp lại sau khi nhận list.
- `Persistence/Interceptors/AuditSaveChangesInterceptor.cs` — **trái tim của audit + soft delete**: `Added→CreatedAt`; `Modified→UpdatedAt`; `Deleted + ISoftDeletable → chuyển state về Modified, set IsDeleted=true, DeletedAt=now`. Dùng `DateTime.Now` (giờ local). Đăng ký **Singleton**.
- `Persistence/UnitOfWork.cs` — wrap `context.SaveChangesAsync`.
- `Persistence/DbSeeder.cs` — `MigrateAndSeedAsync`: chạy `Database.MigrateAsync()` + seed roles (`Admin`,`Teacher`,`User`) + Settings mặc định (`FileStorage.Mode=Server`) + **auto-seed admin** nếu chưa có ai role Admin VÀ có config `Admin:Username`/`Admin:Password` (env `Admin__Username`/`Admin__Password`). **Không seed dữ liệu demo** (admin tự tạo GV; GV tự tạo lớp & HS). Gọi 1 lần lúc app khởi động.
- `Identity/AppUser.cs` — `IdentityUser<Guid>` + `FullName?, AvatarUrl?` + audit + soft delete.
- `Identity/AppRole.cs` — `IdentityRole<Guid>`.
- `Auth/AuthService.cs` — hiện thực `IAuthService` (cần `UserManager`/`SignInManager` nên ở Infrastructure). Xem [§5](#5-luồng-xác-thực-authentication).
- `Auth/JwtTokenService.cs` — tạo JWT HS256 (claims `sub, email, name, jti, role[]`); refresh token = 64 byte random base64; hash = SHA-256 hex.
- `Auth/GoogleAuthVerifier.cs` — verify Google ID token qua `Google.Apis.Auth` (`GoogleJsonWebSignature.ValidateAsync`, audience = ClientId). Chưa cấu hình ClientId → trả lỗi `Google.NotConfigured`.
- `Auth/AuthOptions.cs` — `JwtOptions` (Issuer, Audience, Secret, AccessTokenMinutes=15, RefreshTokenDays=7), `GoogleOptions` (ClientId), `AuthFeatureOptions` (`AllowRegistration`, mặc định **false** — khóa đăng ký).
- `Account/ProfileService.cs` — trang cá nhân: upload ảnh đại diện (qua `IFileService`, bỏ qua FileStorage.Mode) + tự đổi mật khẩu. `Students/StudentAccountService.cs` — GV tạo HS + tài khoản trong lớp (guard theo lớp) + đổi mật khẩu HS (guard theo HS).
- `Services/CurrentUser.cs` — đọc claim từ `IHttpContextAccessor`.
- `Users/UserAdminService.cs` — quản trị user: list (kèm user đã xóa để khôi phục), gán role, soft delete (kèm thu hồi refresh token), restore. **Guard "admin cuối cùng"** + **không tự xóa chính mình**.
- `DependencyInjection.cs` — `AddInfrastructure(config)`: Options, `AppDbContext` (Npgsql + interceptor), IdentityCore (password ≥8, unique email, lockout 5 lần/5'), repo/UoW/các service.

### 3.4 WebApi (`HungSilver.WebApi`) — Controllers + cấu hình host
- `Program.cs` — pipeline (xem [§4](#4-program-cs--pipeline-khởi-động)).
- `Controllers/AuthController.cs`, `UsersController.cs`, `ClassesController.cs`, … — xem [§8](#8-api-endpoints).
- `Common/ResultExtensions.cs` — **map `Result`/`Error` → HTTP**: Success→`Ok`/`NoContent`; Error theo `ErrorType` → 400/404/409/401/403/500 dạng `ProblemDetails`.
- `Common/ApiResponse.cs` — **API Response Wrapper**: `ApiResponse<T>` (`Data, IsSuccess, Message, StatusCode`) + factory `Ok(data, status)`, `Fail(message, status)`.
- `Common/ApiResponseWrapperFilter.cs` — **IResultFilter** bọc mọi response MVC trong `ApiResponse`. Skip `FileResult` (download). `ProblemDetails` → `Fail`; `ObjectResult` → `Ok`; `NoContentResult` → `Ok(null, 204)` HTTP 200.
- `Common/GlobalExceptionHandler.cs` — exception chưa bắt → log + `ApiResponse.Fail(…, 500)`, không lộ stack trace.

---

## 4. Program.cs — pipeline khởi động

Thứ tự trong `server/src/HungSilver.WebApi/Program.cs`:
1. Serilog (đọc config + console).
2. `AddApplication()` + `AddInfrastructure(config)`.
3. Đọc `JwtOptions`, **validate Secret ≥ 32 ký tự** (else ném khi khởi động).
4. **JWT Bearer**: validate issuer/audience/lifetime/signing key, `ClockSkew=30s`, `NameClaimType="sub"`, `RoleClaimType="role"`, `MapInboundClaims=false` (giữ nguyên tên claim).
5. **Authorization**: policy `AdminOnly` = `RequireRole(Admin)`.
6. **CORS** policy `Client`: origins từ `Cors:Origins`, `AllowCredentials()` (cần cho cookie refresh).
7. Controllers + OpenAPI + HealthChecks (`AddDbContextCheck`).
8. `ExceptionHandler` + `ProblemDetails`.
9. Middleware: `UseExceptionHandler` → `UseSerilogRequestLogging` → (Dev: OpenAPI + Scalar) → `UseCors` → `UseAuthentication` → `UseAuthorization` → `MapControllers` + `MapHealthChecks("/health")`.
10. **`await DbSeeder.MigrateAndSeedAsync(app.Services)`** trước `app.Run()`.

---

## 5. Luồng xác thực (Authentication)

**Chiến lược token (quan trọng):**
- **Access token** (JWT, 15') → trả trong **body** response → client giữ **trong memory (signal)**, KHÔNG localStorage (chống XSS).
- **Refresh token** (random 64 byte, 7 ngày) → set vào **HttpOnly cookie** `hs_refresh`, `Path=/api/auth`, `SameSite=Lax`, `Secure` ở Production. JS không đọc được. DB chỉ lưu **SHA-256 hash**.

`AuthService` (`Infrastructure/Auth/AuthService.cs`) các luồng:

| Luồng | Tóm tắt |
|---|---|
| **Register** | Validate → check email trùng (kể cả user đã xóa mềm, qua `IgnoreQueryFilters`) → `CreateAsync` → gán role `User` → phát token. |
| **Login** | Validate → `FindByEmailAsync` (qua query filter ⇒ user đã xóa coi như không tồn tại) → `CheckPasswordSignInAsync(lockoutOnFailure:true)` → xử lý `IsLockedOut` → phát token. |
| **GoogleLogin** | `GoogleAuthVerifier.VerifyAsync` → tìm theo external login → nếu chưa có thì tìm theo email → nếu chưa có thì tạo user (`EmailConfirmed=true`, role `User`) → `AddLoginAsync(Google)` → phát token. |
| **Refresh (rotation)** | Hash token từ cookie → tìm `RefreshToken` active → **thu hồi token cũ ngay** (`RevokedAtUtc=now`) → phát cặp mới → set `ReplacedByTokenHash`. Token không hợp lệ/đã dùng → 401. |
| **Logout** | Thu hồi refresh token (nếu còn) + `Response.Cookies.Delete`. Best-effort. |
| **GetMe** | `/api/auth/me` đọc `sub` từ JWT → trả `UserDto`. |

`IssueTokensAsync`: lấy roles → tạo access token → tạo refresh token → lưu bản ghi `RefreshToken` (hash) → trả `AuthTokens(access, refresh, user)`.

**Client phía tương ứng** (`core/auth.service.ts`):
- `accessToken`/`currentUser` là **signal**; `isLoggedIn`/`isAdmin` là **computed**.
- `provideAppInitializer(() => tryRestoreSession())` — lúc app khởi động gọi `/auth/refresh`; cookie còn hạn ⇒ tự đăng nhập lại (guards cần biết trạng thái trước khi render).
- `auth.interceptor.ts` — gắn `Bearer` vào mọi request; gặp **401** (không phải endpoint `/auth/`) → **single-flight refresh** (nhiều 401 đồng thời chỉ refresh 1 lần qua `shareReplay`) → retry; refresh fail → `clearSession` + về `/login`.

---

## 6. Phân quyền (Authorization)

- **Roles:** `Admin`, `Teacher`, `User`=học sinh (`AppRoles`). Seed sẵn 3 role; **tài khoản admin tự tạo khi khởi động** nếu chưa có + config `Admin:Username`/`Admin:Password` (dev: `admin`/`Admin@a1`). **Đăng nhập chấp nhận username HOẶC email** (`AuthService.LoginAsync`). **Đăng ký tự do bị khóa** (`AuthFeatureOptions.AllowRegistration=false`) — chỉ Admin tạo tài khoản Admin/GV; GV tạo tài khoản học sinh.
- **Server:**
  - `[Authorize]` mặc định; `TeacherOrAdmin` cho nghiệp vụ vận hành (lớp/học sinh/lịch/học phí/học liệu/thông báo/đánh giá/cảnh báo). `AdminOnly` giữ cho cấu hình quan trọng và thao tác tài khoản nhạy cảm (`SettingsController` ghi/xem raw scope; `UsersController` tạo/gán role/xóa/khôi phục; liên kết tài khoản HS).
  - **Phân quyền theo dòng (row-level) qua `ClassAccessGuard`** (keystone, gọi bởi mọi service vận hành): **Admin toàn quyền** (`GetTeacherScopeIdAsync`→`null`, không lọc); **Giáo viên chỉ thấy/sửa dữ liệu lớp mình phụ trách** (`TeacherProfile` liên kết qua `UserId` → `ClassRoom.TeacherProfileId`) và học sinh đang ghi danh active các lớp đó. GV chưa liên kết hồ sơ → scope `Guid.Empty` ⇒ thấy rỗng. `EnsureCanAccessClassAsync`/`EnsureCanAccessStudentAsync` trả **NotFound** cho lớp/HS ngoài phạm vi (không lộ tồn tại). GV tạo/sửa lớp bị **ép `TeacherProfileId` = chính mình** (server-authoritative); **đổi GV phụ trách + tạo HS "trần" + import hàng loạt LỚP** chỉ Admin.
  - **Ghi danh mục/cấu hình dùng chung → AdminOnly:** POST/PUT/DELETE của `Subjects/Grades/Branches` (Môn/Khối/Cơ sở) và quản lý hồ sơ `Teachers` + liên kết tài khoản; **GET vẫn `TeacherOrAdmin`** để GV đọc khi lọc/hiển thị.
  - `ProfileController` (`api/profile`) `[Authorize]` mọi role: `PUT /api/profile` (cập nhật họ tên + SĐT), `POST avatar`, `PUT password`. `FilesController` upload `[Authorize]` (**mọi user đã đăng nhập**, rate-limit 30/phút/user, quota/user); download `[AllowAnonymous]` nhưng **phân tầng theo `Visibility`** trong code (Public ẩn danh / Authenticated cần đăng nhập / Restricted = uploader|Teacher|Admin) + ETag/Cache-Control/nosniff/304.
- **Client (guards `core/guards.ts`):**
  - `authGuard` — chưa đăng nhập → `/login`.
  - `guestGuard` — đã đăng nhập thì chặn vào lại `/login`. (Route `/register` đã gỡ — đăng ký bị khóa.)
  - `roleGuard` — đọc `route.data.roles`, dùng cho `admin/users` (`{ roles: [ROLE_ADMIN] }`).
  - `/profile` (trang cá nhân) mở cho mọi role đã đăng nhập; link trong dropdown user ở `shell.ts`.

**Business guard quan trọng** (`UserAdminService`): không gỡ/không xóa **admin cuối cùng** (`EnsureNotLastAdminAsync`); **không tự xóa tài khoản của chính mình** (`CannotDeleteSelf`); xóa user ⇒ **thu hồi mọi refresh token** đang active của user đó.

---

## 7. Database & EF Core

- **Provider:** Npgsql (PostgreSQL 18). Connection string key `ConnectionStrings:Default`.
- **DbContext:** `AppDbContext : IdentityDbContext<AppUser, AppRole, Guid>`.
- **Bảng:** Identity (`AspNetUsers/Roles/UserRoles/UserClaims/UserLogins/UserTokens/RoleClaims`) + `RefreshTokens` + các bảng nghiệp vụ (§15).
- **Soft delete toàn cục:** global query filter `IsDeleted == false` auto cho mọi `ISoftDeletable` ⇒ query mặc định không thấy bản ghi đã xóa; dùng `IgnoreQueryFilters()` / `includeDeleted=true` để xem/khôi phục.
- **Migrations:** `Infrastructure/Migrations/` — hiện có `20260612095713_InitialCreate`. Tự apply khi khởi động (DbSeeder). Tạo migration mới:
  ```powershell
  cd server
  dotnet tool run dotnet-ef -- migrations add <Tên> --project src/HungSilver.Infrastructure --startup-project src/HungSilver.WebApi
  ```
  > Lưu ý: README nhắc `dotnet-ef` là local tool ở `server/.config/dotnet-tools.json` — file manifest này **chưa tồn tại** trong repo hiện tại; nếu lệnh báo thiếu tool thì `dotnet new tool-manifest` + `dotnet tool install dotnet-ef`.
- **Cấu hình entity:** RefreshToken (`TokenHash`≤128 + index, FK `UserId`→AppUser cascade); các entity nghiệp vụ cấu hình ở `Persistence/Configurations/` (length/precision/index, không FK).

---

## 8. API endpoints

Base path `/api`. Lỗi luôn dạng `ProblemDetails { status, title=Error.Code, detail=Error.Message }`.

| Endpoint | Method | Quyền | Mô tả |
|---|---|---|---|
| `/api/auth/register` | POST | Public | **Bị khóa** mặc định (`AllowRegistration=false`) → 403; bật lại qua config |
| `/api/auth/login` | POST | Public | Đăng nhập bằng **username hoặc email** (có lockout) |
| `/api/auth/google` | POST | Public | Đăng nhập Google; chặn **tự tạo tài khoản mới** khi đăng ký khóa |
| `/api/auth/refresh` | POST | Cookie | Refresh rotation (đọc cookie `hs_refresh`) |
| `/api/auth/logout` | POST | Cookie | Thu hồi + xóa cookie → 204 |
| `/api/auth/me` | GET | User | Thông tin user hiện tại |
| `/api/profile/avatar` | POST | User | Upload ảnh đại diện (lưu server) → trả `UserDto` |
| `/api/profile/password` | PUT | User | Tự đổi mật khẩu (`{currentPassword,newPassword}`) |
| `/api/ai-credential` | GET/PUT/DELETE | User | Cấu hình API Key Gemini của **chính mình** (đã che) — xem §15.13 |
| `/api/ai-credential/validate` | POST | User | Kiểm tra live key đang lưu với Google |
| `/api/materials/by-subject` | GET | Teacher/Admin | Tài liệu theo Môn (lưới phân trang) |
| `/api/exams` · `/generate/{materialId}` · `/generation-jobs/{jobId}` | GET · POST · GET | Teacher/Admin | Danh sách đề (theo môn/tài liệu, paged) · bắt đầu job sinh đề bằng AI · poll trạng thái job |
| `/api/exams/{id}` (+`/publish`,`/questions*`) | GET/PUT/DELETE/POST | Teacher/Admin | Chi tiết/sửa/xóa/phát hành đề + CRUD câu hỏi — xem §15.14 |
| `/api/exams/{id}/assign` (+`/assignments`,`/assignments/{id}/close\|report`) | POST/GET | Teacher/Admin | Giao đề cho lớp (hẹn giờ), xem/đóng lượt giao, **báo cáo kết quả** — xem §15.15–16 |
| `/api/portal/exams` (+`/{id}/start`, `/attempts/{id}/answer\|submit\|review`) | GET/POST/PUT | User | HS làm đề hẹn giờ, tự chấm, xem lại — xem §15.15 |
| `/api/users` | GET | **Admin** | List user (kèm đã xóa), tìm theo email/tên |
| `/api/users` | POST | **Admin** | Tạo tài khoản Admin/Giáo viên (`CreateUserRequest`) |
| `/api/users/{id}/roles` | PUT | **Admin** | Gán role (body `{roles:[]}`) |
| `/api/users/{id}` | DELETE | **Admin** | Xóa mềm (+ thu hồi token) |
| `/api/users/{id}/restore` | POST | **Admin** | Khôi phục |
| `/api/classes/{id}/students` | POST | Teacher/Admin | GV tạo HS trong lớp (+ tài khoản nếu chọn) |
| `/api/students/{id}/account*` | POST/DELETE | Teacher/Admin | Cấp/đặt lại MK/khóa/gỡ tài khoản HS (guard theo lớp) — xem §15.11 |
| `/health` | GET | Public | Health check (kèm DbContext) |
| `/scalar/v1` | GET | Dev only | UI tài liệu API |

**Mapping status** (`ResultExtensions`): Validation→400, NotFound→404, Conflict→409, Unauthorized→401, Forbidden→403, Failure→500.

**API Response Wrapper**: mọi response từ controller được `ApiResponseWrapperFilter` bọc trong `{ data, isSuccess, message, statusCode }`. Ngoại lệ: `FileResult` (download), health check, OpenAPI/Scalar (nằm ngoài MVC pipeline). FE `apiResponseInterceptor` tự unwrap `data` từ wrapper.

---

## 9. Frontend (Angular 21)

- **Bootstrap:** `main.ts` → `bootstrapApplication(App, appConfig)`. **Zoneless** (Angular 21 mặc định, không Zone.js), standalone components, **signals** xuyên suốt.
- **`app.config.ts`:** providers — router, **HttpClient + apiResponseInterceptor + authInterceptor**, ng-zorro i18n `vi_VN`, đăng ký icon, `LOCALE_ID='vi'`, `provideAppInitializer(tryRestoreSession)`.
- **Routing (`app.routes.ts`):** lazy `loadComponent`. `/login` (guestGuard) ngoài shell; còn lại nằm trong `Shell` (authGuard): `/classes`, `/students`, `/teachers`, `/tuition`, `/admin/users` (roleGuard Admin)… `**` → `/`.
- **`core/` (singleton):**
  - `auth.service.ts` — phiên đăng nhập (xem §5).
  - `auth.interceptor.ts` — Bearer + single-flight refresh on 401.
  - `guards.ts` — authGuard/guestGuard/roleGuard.
  - `models.ts` — interface DTO khớp backend (`UserDto, AuthResponse, PagedResult<T>, ClassListItem, Student, UserListItem, ApiProblem`…) + hằng `ROLE_ADMIN/TEACHER/USER`.
  - `classes.service.ts`, `students.service.ts`, `users.service.ts`… — gọi REST (`HttpParams`).
- **`features/`:**
  - `auth/login.page.ts`, `auth/register.page.ts` — Reactive Forms + ng-zorro card, hiển thị `ApiProblem.detail` khi lỗi.
  - `admin/users.page.ts` — bảng user, multi-select gán role inline, xóa mềm/khôi phục; chặn thao tác lên chính mình (`currentUserId`).
- **`layout/shell.ts`** — `nz-layout` **sider sáng** (menu theo role, item active nền indigo nhạt + thanh nhấn trái) + brand block (badge gradient) + header có **nút bật/tắt dark mode** + avatar/dropdown Đăng xuất; drawer mobile (<992px).
- **`shared/google-signin-button.ts`** — load Google Identity Services động, render nút, emit `credential` (ID token). Chưa cấu hình `googleClientId` → hiện ghi chú, ẩn nút.

**Design system "Indigo học thuật" (2026-06-15):**
- **Theme ng-zorro qua CSS variables:** `angular.json` import `ng-zorro-antd.variable.min.css`; `app.config.ts` `provideNzConfig({ theme })` (primary `#4F46E5`, success `#16A34A`, warning `#F59E0B`, error `#DC2626`, info `#4F46E5`) → `NzConfigService` tự `registerTheme` recolor toàn bộ component. Đổi màu chỉ ở 2 chỗ này.
- **Token riêng `--hs-*`** trong `src/styles.scss` (surface/border/text/radius/shadow/sidebar) + override `.ant-*` (card bo góc 12px + shadow, table header, tag pill, modal…) ⇒ mọi trang đẹp lên tự động. **Dark mode**: `body.theme-dark` ghi đè token + nhóm `--ant-*` cốt lõi; toggle qua `core/theme.service.ts` (signal `isDark`, lưu `localStorage('hs-theme')`).
- **Font** Be Vietnam Pro (`index.html` Google Fonts).
- **Component dùng chung:** `shared/page-header.ts` (badge icon + title/subtitle + slot actions — dùng ở mọi trang feature) và `shared/stat-card.ts` (badge icon màu + số liệu — Dashboard). Màu chart ECharts khớp palette (`#4F46E5/#16A34A/#F59E0B/#7C3AED`).
- **Tiện ích bảng danh sách dùng chung (2026-06-24):** `shared/column-settings.ts` — nút bánh răng → popup "Chỉnh sửa cột" (kéo-thả ẩn/hiện + đổi thứ tự bằng `@angular/cdk/drag-drop`, lưu localStorage `hs-cols-*`, mặc định hiện tất cả); bảng render cột data-driven qua `cols.visibleColumns()` + `@switch` (STT/Thao tác cố định). Áp cho 5 màn: Học viên, Giáo viên, Lớp học, Học phí, Quản lý người dùng. **Lọc theo nút "Tìm kiếm"**: các màn này bỏ gọi API on-change/debounce → chỉ gọi khi bấm **Tìm kiếm** (hoặc Enter ở ô tìm) + nút **Đặt lại**, giảm tải server.
- **Environments:** `apiUrl='/api'` cả dev/prod; `googleClientId` để trống mặc định. Dev: ng serve proxy `/api`→`:5000` (`proxy.conf.json`). Prod: nginx proxy `/api`→`http://api:8080`.

---

## 10. Cấu hình & biến môi trường

`appsettings.json` (mặc định) ← `appsettings.Development.json` (dev) ← **biến môi trường** (prod, format `Section__Key`).

| Config | Env (Docker) | .env | Ghi chú |
|---|---|---|---|
| `ConnectionStrings:Default` | `ConnectionStrings__Default` | (ghép từ `POSTGRES_PASSWORD`) | Dev: `localhost:5433` |
| `Jwt:Secret` | `Jwt__Secret` | `JWT_SECRET` | **Bắt buộc ≥32 ký tự**, app ném nếu thiếu |
| `Jwt:AccessTokenMinutes` / `RefreshTokenDays` | — | — | 15' / 7 ngày |
| `Google:ClientId` | `Google__ClientId` | `GOOGLE_CLIENT_ID` | Trống ⇒ ẩn Google Login |
| `Cors:Origins` | `Cors__Origins__0` | — | Dev: `http://localhost:4200` |
| `FileStorage:*` | `FileStorage__*` | — | `RootPath=/app/uploads` (volume prod), `MaxSizeBytes` 20MB, `PerUserQuotaBytes` 200MB, `CleanupRetentionDays` 30, `OrphanGracePeriodHours` 24 (file upload không gắn vào đâu sau 24h ⇒ rác), `AllowedExtensions` (đuôi cơ bản); mode `Server` (DbSeeder) |
| `Ai:Gemini:BaseUrl` / `DefaultModel` | `Ai__Gemini__*` | — | Endpoint Google Generative Language + model mặc định (`gemini-2.5-flash`) — xem §15.13 |
| `DataProtection:KeysPath` | `DataProtection__KeysPath` | — | Thư mục lưu khóa mã hóa key AI; **trống ⇒ mặc định `<FileStorage:RootPath>/dpkeys`** (đi cùng volume uploads). ⚠️ Mất thư mục ⇒ key đã lưu không giải mã được |
| `DocumentConversion:SofficePath` | `DocumentConversion__SofficePath` | — | Đường dẫn `soffice` (LibreOffice) để convert Word→PDF khi sinh đề; **trống ⇒ dùng PATH** (image API đã cài) — xem §15.14 |
| — | `HTTP_PORT` | `HTTP_PORT` | cổng public client (nginx), mặc định 80 |
| — | `GHCR_OWNER`, `IMAGE_TAG` | — | chỉ cho `docker-compose.prod.yml` |

**Dev hiện tại** (`appsettings.Development.json`): Postgres `localhost:5433/hungsilver` user `hungsilver` pass `16062001`; Jwt secret dev-only. ⚠️ Google ClientId phải điền **2 chỗ**: `client/src/environments/*.ts` (`googleClientId`) **và** backend (`Google__ClientId`).

---

## 11. Chạy dev / build / test

> Máy này dùng **.NET 10 SDK cách ly tại `E:\dotnet10`** (không đụng .NET 6/9 hệ thống). Kích hoạt: `. E:\dotnet10\use-dotnet10.ps1`. Postgres native của máy chiếm 5432 ⇒ Postgres dev dùng **5433**.

```powershell
# 1. DB dev (PostgreSQL 18, cổng 5433)
docker compose -f docker-compose.dev.yml up -d

# 2. Backend → http://localhost:5000 (Scalar: /scalar/v1). Migrations+seed tự chạy.
cd server/src/HungSilver.WebApi ; dotnet run --launch-profile http

# 3. Frontend → http://localhost:4200 (proxy /api → :5000)
cd client ; npm start
```
Tài khoản admin: **tự tạo khi khởi động** nếu chưa có admin + có config `Admin:Username`/`Admin:Password` (dev: `admin` / `Admin@a1` — đổi ngay sau lần đăng nhập đầu).

**Test:** server `dotnet test server/HungSilver.slnx`; client `npm test -- --watch=false` (Vitest + jsdom).

**Tests hiện có:** `RepositorySoftDeleteTests` (SQLite in-memory: audit timestamps, soft delete ẩn khỏi query, restore, paging includeDeleted) + `ResultTests`.

---

## 12. Build & Deploy

- **`server/Dockerfile`** — `sdk:10.0` build → `aspnet:10.0`, lắng nghe **8080**.
- **`client/Dockerfile`** — `node:22` build → `nginx:alpine` (static + proxy `/api`→`api:8080`).
- **Full stack tại chỗ:** `cp .env.example .env` (đổi `JWT_SECRET`, `POSTGRES_PASSWORD`…) → `docker compose up -d --build`. Mở `http://<ip>:HTTP_PORT`.
- **LibreOffice trong image API** (`server/Dockerfile`): cài `libreoffice-writer` + `fonts-liberation`/`fonts-noto-core` để **convert Word→PDF** cho tính năng sinh đề AI (§15.14) — Gemini đọc PDF bằng vision. Tăng ~300MB image. Dev Windows: cài LibreOffice + để `soffice` trên PATH (hoặc set `DocumentConversion:SofficePath`).
- **Prod qua GHCR:** `docker-compose.prod.yml` kéo image `ghcr.io/<GHCR_OWNER>/hungsilver-{api,client}:<IMAGE_TAG>`.
- **File upload (bền vững):** service `api` mount volume **`hungsilver_uploads:/app/uploads`** (cả `docker-compose.yml` & `.prod.yml`) ⇒ file KHÔNG mất khi deploy lại image; backup volume này cùng `hungsilver_pgdata`. **`client/nginx.conf`** đặt `client_max_body_size 25m` cho `/api/` (mặc định nginx 1MB sẽ chặn upload); đổi nginx.conf phải **rebuild lại client image** mới có hiệu lực.
- **HTTPS:** cookie refresh `Secure` ở Production ⇒ cần TLS (Caddy/nginx + Let's Encrypt, hoặc Cloudflare) trỏ về client.
- **Deploy có HTTPS sẵn (`docker-compose.https.yml` + `Caddyfile`):** build tại VPS + service **Caddy** (cổng 80/443) làm reverse proxy `reverse_proxy client:80`; client **không** publish cổng ra host. **Domain sau Cloudflare proxy** ⇒ dùng **Cloudflare Origin Certificate** (mount `./certs/{origin-cert,origin-key}.pem`, KHÔNG commit — `.gitignore`) + SSL mode **Full (strict)**; trình duyệt thấy cert edge của Cloudflare. (Nếu trỏ thẳng VPS — DNS only — đổi `Caddyfile` về global `{ email … }` để Caddy auto Let's Encrypt.) Chạy: `docker compose -f docker-compose.https.yml up -d --build`. API không cần `ForwardedHeaders` vì cookie `Secure` set theo môi trường (Production), không theo `Request.IsHttps`.

---

## 13. CI/CD (GitHub Actions)

- **`ci.yml`** (push `dev`/`master`, PR, manual): job **server** (setup SDK theo `global.json` → restore/build/test slnx) + job **client** (Node 22 → `npm ci`/build/test). Concurrency hủy run cũ.
- **`cd.yml`** (push `master`): matrix build & push 2 image (api/client) lên **GHCR** (cache gha) → job **deploy** scp `docker-compose.prod.yml` lên VPS (`/opt/hungsilver`) → SSH `docker login ghcr.io` + `compose pull` + `up -d` + prune.
- **Secrets cần:** `VPS_HOST/USER/SSH_KEY/PORT`, `GHCR_PAT` (+ `GITHUB_TOKEN` sẵn có).
- **⚠ Tạm tắt auto-trigger (2026-06-18):** khối `push`/`pull_request` ở cả 2 file đang được **comment**, chỉ còn `workflow_dispatch` (chạy tay) — để tránh mail thông báo của GitHub; build/test/deploy làm thủ công. Bật lại = bỏ comment phần `on:`.

---

## 14. Hướng dẫn mở rộng (công thức cho task mới)

**Thêm entity CRUD mới (vd `Category`):**
1. `Domain/Entities/Category.cs : BaseEntity` (tự có Id/audit/soft delete).
2. `AppDbContext`: thêm `DbSet<Category>` + cấu hình `OnModelCreating` (query filter tự áp).
3. Tạo migration (xem §7).
4. `Application`: `CategoryDtos`, `CategoryValidators`, `ICategoryService` + service (inject `IRepository<Category>`, `IUnitOfWork`) — **không cần viết repository riêng**, đăng ký ở `Application/DependencyInjection`.
5. `WebApi/Controllers/CategoriesController` — gọi service, `.ToActionResult()`, gắn `[Authorize]`/`[Authorize(Policy="AdminOnly")]`.
6. Client: `models.ts` thêm interface, `core/categories.service.ts`, page trong `features/`, route + (nếu cần) guard. **UI page bắt buộc dựng bằng ng-zorro-antd** (`Nz*Module`: card/form/table/modal/button…), theo đúng mẫu các page sẵn có (`students.page.ts`, `users.page.ts`).

**Thêm endpoint:** trả `Result`/`Result<T>` ở service, controller chỉ map `.ToActionResult()`. Lỗi nghiệp vụ ⇒ `Error.<Type>(code,message)` (đừng ném exception).

**Quy ước:**
- Đổi/ghi DB: thao tác qua `IRepository<T>` + `IUnitOfWork.SaveChangesAsync` (vd Students/Subjects) hoặc trực tiếp `AppDbContext` khi cần join/aggregate hoặc Identity (Classes/Auth/UserAdmin).
- Xóa = soft delete; muốn thấy bản ghi đã xóa ⇒ `includeDeleted=true`/`IgnoreQueryFilters()`.
- Mọi message lỗi/UI dùng **tiếng Việt** (đồng bộ codebase).
- Comment code tiếng Việt, súc tích, đúng mật độ như file xung quanh.
- **FE — UI bắt buộc dùng ng-zorro-antd** (`Nz*Module`): không viết HTML/CSS UI thuần thay thế, không thêm thư viện UI khác. Icon đăng ký qua ng-zorro (`NzIconModule`), i18n `vi_VN`. Component standalone + signals + zoneless (xem §9).

---

## 15. Domain nghiệp vụ trung tâm tiếng Anh (Giai đoạn 1)

> Từ 2026-06-14 project mở rộng thành hệ thống quản lý trung tâm dạy tiếng Anh (14 module). **Schema thiết kế đầy đủ ngay từ đầu**; Giai đoạn 1 hiện thực phần lõi. Bám pattern nền (§3–§14) trừ các điểm khác biệt dưới đây.

### 15.1 Quy ước riêng
- **3 role:** `Admin` (toàn quyền + cấu hình/tài khoản quan trọng), `Teacher` (CRUD nghiệp vụ trong phạm vi lớp của tài khoản giáo viên liên kết), `User` = **học sinh** (portal xem-chỉ-đọc → GĐ2). Policy `TeacherOrAdmin` (Program.cs).
- **KHÔNG khóa ngoại** trên mọi bảng nghiệp vụ mới: chỉ `Guid` + index; join thủ công trong service Infrastructure; tồn tại tham chiếu validate ở tầng app (`IUserDirectory`, `IClassAccessGuard`).
- **Quan hệ hiện hành phải cleanup khi parent soft-delete:** không để bảng nối/trạng thái "đang hiệu lực" tiếp tục active nếu parent đã bị xóa mềm. `ICurrentRelationCleanupService` xử lý các ca chung: soft-delete `Enrollment` active + set `IsActive=false`/`WithdrawnOn`, **xóa lớp luôn được phép** và tự rút sạch **mọi** enrollment active của lớp (không chặn khi còn học sinh đang học), unlink `Student.UserId`/`TeacherProfile.UserId` khi xóa user, null `Assignment.MaterialId` khi xóa học liệu, và chặn xóa `MaterialCategory` còn học liệu đang dùng. Lịch sử phát sinh thật (điểm danh, điểm, học phí, báo cáo) vẫn giữ.
- **AutoMapper 14.x**: map entity↔DTO phẳng (Student/Setting/Journal…); DTO tổng hợp có field computed (ClassDto, Dashboard…) map tay. `AddAutoMapper(assembly)` ở `Application/DependencyInjection`. 14.0.0 dính advisory **GHSA-rvv3-g6hj-g44x** (đã suppress đúng advisory ở `server/Directory.Build.props`).
- **Enum serialize string** toàn API (`JsonStringEnumConverter` ở Program.cs).
- **Phân quyền nghiệp vụ** (`Application/Common/ClassAccessGuard`): Admin truy cập toàn bộ dữ liệu vận hành; Teacher truy cập theo lớp gắn với tài khoản giáo viên (`ClassRoom.TeacherId` = `AppUser.Id` liên kết từ `TeacherProfile.UserId`); User chỉ portal riêng. Các cấu hình/tài khoản nhạy cảm vẫn chặn bằng `AdminOnly`.

### 15.2 Entities (`Domain/Entities`, đều `BaseEntity`, không FK) + enums (`Domain/Enums`)
`Student`, `TeacherProfile`, `GradeCategory`, `Branch`, `Subject`, `Curriculum`, `ClassRoom`(→bảng `Classes`), `Enrollment`, `ClassScheduleSlot`, `ClassSession`, `StudentSessionRecord`, `PointEntry`, `RewardRedemption`, `TeacherJournal`, `SessionReport`, `StudentAssessment`(6 kỹ năng), `MonthlyEvaluation`, `MonthlyParentReport`, `TuitionInvoice`, `LearningMaterial`, `StoredFile`, `Notification`, `NotificationDelivery`, `AppSetting`. EF config gom ở `Infrastructure/Persistence/Configurations/` (chỉ length/precision/index), gọi `ApplyConfigurationsFromAssembly` trước vòng lặp global soft-delete.
- **Index duy nhất bất biến (không phải FK):** `Submission(AssignmentId, StudentId)` unique; `Enrollment(StudentId, ClassId)` **partial unique** lọc `WHERE "IsActive" AND NOT "IsDeleted"` (chỉ chặn ghi danh **đang hiệu lực**, cho phép ghi danh lại sau khi rút/xóa mềm — migration `AddEnrollmentActiveUniqueIndex`). Filter dùng cú pháp chung hợp lệ cả Postgres lẫn SQLite. Service vẫn kiểm trước để trả lỗi nghiệp vụ, đồng thời bắt `DbUpdateException` làm lưới an toàn cho đua check-then-insert.
- **Query roster/sĩ số hiện hành:** phải tính theo `Enrollment` chưa xóa mềm + `IsActive=true` + học sinh/lớp còn sống; dùng helper cleanup/query chung thay vì count trực tiếp `Enrollments` khi hiển thị sĩ số, giao bài, học phí, thông báo, dashboard, cảnh báo.

### 15.3 Services (vị trí theo quy tắc §3)
- **Application** (IRepository): `Students/StudentService`, `Journals/TeacherJournalService`, `Common/ClassAccessGuard`.
- **Infrastructure** (AppDbContext join/aggregate): `Classes/ClassService`, `Schedule/ScheduleService`, `Sessions/SessionService`, `Dashboard/DashboardService`, `Reports/SessionReportService`, `Settings/SettingsService`, `Services/UserDirectory`, `Storage/{LocalDiskFileStorage,FileService}`, `Notifications/*`.
- **Cấu hình phân tầng (Settings):** `ISettingsResolver`/`ISettingsService` (1 impl `SettingsService`). Giải theo **User → Class → Role → System → Default**. `SettingKeys`: `FileStorage.Mode`, `Tuition.DueSoonDays`, `Warning.ScoreDropThreshold`, `Center.TimeZone`.
- **Module upload file (`Storage/`):** `IFileStorage` (local disk, `FileStorageOptions`) + setting `FileStorage.Mode` (`Server`|`ExternalUrl`; mặc định **Server**) — `FileService` từ chối upload khi mode=`ExternalUrl`. **Validate**: dung lượng (`MaxSizeBytes` 20MB), **allowlist phần mở rộng** (`AllowedExtensions` — loại cơ bản: ảnh/pdf/office/txt/csv/zip), **chữ ký nội dung magic-byte** (`FileSignatureValidator` — chống đổi đuôi giả mạo), **hạn mức/user** (`PerUserQuotaBytes` 200MB, miễn Admin); **dedup theo SHA-256** (file trùng nội dung dùng lại 1 bản vật lý). `StoredFile` thêm cột `Sha256` + `Visibility`. **Tải xuống phân tầng** theo `Visibility`: `Public` (ẩn danh, ảnh đại diện) / `Authenticated` (mặc định upload, cần đăng nhập) / `Restricted` (uploader hoặc Teacher/Admin) — kèm ETag + Cache-Control + `nosniff`, hỗ trợ 304. **Dọn rác:** `FileCleanupService` (BackgroundService, 24h/lần) **2 pha**: (1) **mark** — `ReconcileOrphansCoreAsync` dò file rác = `StoredFile` đang sống mà **không còn ai tham chiếu** (gom mọi `LearningMaterial.StoredFileId` + Guid trong `AppUser.AvatarUrl`, bằng `IgnoreQueryFilters` để giữ cả tham chiếu từ bản ghi đã xóa mềm — bảo thủ) và đã quá hạn ân hạn `OrphanGracePeriodHours` (mặc định 24h) → đánh dấu xóa mềm; (2) **sweep** — hard-delete file vật lý đã xóa mềm quá `CleanupRetentionDays` (refcount theo StoragePath). _Lưu ý: nếu sau này thêm rich-text nhúng `<img src="/api/files/{id}">`, phải bổ sung quét các field content vào tập tham chiếu._
- **Thông báo:** `INotificationSender`/`INotificationDispatcher`; Email thật (MailKit, `SmtpOptions`); Zalo/Messenger stub → `Manual` (GĐ2 tích hợp API). `DispatchAsync` trả `DispatchOutcome(Status, Error)` — khi Email gửi lỗi (SMTP) thì lý do lỗi được lưu vào `NotificationDelivery.ErrorMessage` để chẩn đoán.
- **Điểm thưởng** = sổ cái `PointEntry`; số dư = SUM(reward) − SUM(penalty) − SUM(redeem). Quy đổi = `RewardRedemption`.

### 15.4 Endpoints mới (mặc định `TeacherOrAdmin`; ghi `Admin` nếu đánh dấu)
- `/api/students` CRUD · `/api/students/{id}/progress` · `/api/students/{id}/redeem` · `/api/students/{id}/link-user` **Admin**.
- `/api/classes` CRUD · `/{id}/roster` · `/{id}/teacher` · `/{id}/enroll` · `DELETE /{id}/students/{sid}`.
- `/api/schedule?from&to[&classId]` · `/classes/{id}/slots` GET, `/slots` POST/DELETE · `/classes/{id}/generate-sessions` · `/sessions` POST · `/sessions/{id}/cancel`.
- `/api/sessions/{id}/sheet` · `/{id}/attendance` PUT(bulk) · `/{id}/points` POST · `DELETE /points/{entryId}` · `/{id}/journal` GET/PUT · `/{id}/report/generate` POST.
- `/api/dashboard/summary` · `/charts`.
- `/api/settings/effective` · `/scope/{scope}` **Admin** · PUT/DELETE **Admin**.
- `/api/files` POST (upload, mọi user đã đăng nhập, mode=Server) · `/{id}` GET (tải, phân tầng theo Visibility).

### 15.6 Import lớp học từ Excel (`ClassImportService`)
- Sheet "Nhập liệu" 13 cột: Cơ sở · Mã HV · Tên HV · Ngày sinh · Mã lớp · Tên lớp · Môn · Khối · Giáo viên · **Học phí** · SĐT PH · SĐT HV · Ghi chú (sheet "Danh mục" làm dropdown). Học phí đọc từ cột (parse bỏ dấu phân tách nghìn).
- **Chống trùng tên lớp theo cơ sở:** lớp mới (không khớp mã lớp) trùng TÊN trong cùng CƠ SỞ với lớp đang sống → preview gắn `DuplicateClassId` + báo đỏ; FE cho chọn **"Dùng lớp đã có"** (ghi danh HS vào lớp cũ, set `ExistingClassId`) hoặc đổi tên để tạo mới (re-check qua `ExistingClasses` trả trong preview). Commit revalidate + enforce trùng tên+cơ sở (DB + trong cùng file) như lưới an toàn.
- Danh sách lớp hiển thị **sĩ số** (`CurrentSize`); trang chi tiết lớp có nút **Sửa lớp** dùng chung component `class-form-modal` với trang danh sách.

### 15.5 Migration & seed
Migration `AddTeachingDomain` tạo toàn bộ bảng (**0 FK** — đã kiểm). DbSeeder thêm: role Teacher, GV demo `teacher@hungsilver.local`/`Teacher@12345`, Curriculum/ClassRoom "Movers A"/3 Students/Enrollment/Slot/Session demo, `AppSetting` mặc định. appsettings thêm section `Seed.Teacher*`, `FileStorage`, `Smtp`.

### 15.6 Frontend (Giai đoạn 1)
- Pages `features/{dashboard, students(+detail), classes(+detail), schedule, sessions(+journal,+report), settings, placeholder}`; services `core/{students,classes,sessions,schedule,dashboard,settings,files}.service.ts`; `auth.service` thêm `isTeacher/isStudent`.
- **Biểu đồ: ECharts** wrapper `shared/chart.ts` (signal/zoneless). **Lịch:** `nz-calendar` (tháng) + lưới CSS (tuần). **Nav** `shell.ts` responsive (sider → `nz-drawer` mobile). Route param → component input qua `withComponentInputBinding()`. **UI responsive bắt buộc** (375px + desktop).

### 15.7 Giai đoạn 2 (đã hiện thực)
- **Học phí** (`Tuition*`): CRUD + đánh dấu đã đóng, status tính lại theo `DueDate/PaidOn` + `DueSoonDays`.
- **Kho tài liệu** (`Material*`): link ngoài hoặc file server (`StoredFile`/`IFileStorage`), theo lớp.
- **Đánh giá tháng** (`Evaluation*`): 5 tiêu chí → rank tự tính; **Bảng vàng** tuần (top điểm thưởng/chuyên cần/BTVN).
- **Báo cáo phụ huynh** (`ParentReportService`): sinh nội dung tháng (đi học/BTVN/điểm/nhận xét) qua template.
- **Thông báo** (`NotificationService`): tạo + gửi theo kênh — Email gửi thật (nếu HS có tài khoản email), Zalo/Messenger → `Manual` (copy gửi tay).
- **Cảnh báo** (`WarningsService`): tổng hợp 3 buổi vắng/thiếu BTVN liên tiếp, điểm giảm ≥ ngưỡng, học phí quá hạn. "3 buổi liên tiếp" xét theo **từng (HS, lớp)** (không trộn lẫn HS học nhiều lớp), **bỏ buổi đã hủy**, mỗi HS chỉ cảnh báo **một lần** dù dính ở nhiều lớp.
- **Portal học sinh** (`PortalService`, route `/portal` role `User`): xem hồ sơ/tiến độ/lịch của chính mình; Admin liên kết tài khoản qua `PUT /api/students/{id}/link-user` (`Student.UserId`) — **chặn 1 tài khoản liên kết >1 HS** (trả `Conflict`). `roleGuard` điều hướng HS về `/portal`.
- **Còn lại (tương lai):** job nền tự nhắc học phí/cảnh báo (hiện tính khi đọc); tích hợp API Zalo OA/Messenger thật (hiện stub `Manual`).

**Endpoints GĐ2 thêm:** `/api/tuition*`, `/api/materials*`, `/api/evaluations*` + `/api/leaderboard`, `/api/students/{id}/parent-report`, `/api/notifications`, `/api/warnings`, `/api/portal/me`, `/api/students/{id}/link-user`.

### 15.8 Đợt 7 — Môn/Khối, import lớp, gộp cảnh báo (đã hiện thực)
- **Phân loại lớp Môn → Khối → Lớp:** entity mới `Subject` (Admin CRUD, **không FK**) + `ClassRoom` thêm `SubjectId` (Guid?) & `GradeBand` (string?); `LearningMaterial` thêm `GradeBand`. Migration `AddSubjectAndClassTaxonomy` (0 FK). **Khối là danh sách chuẩn** lưu ở Settings key `Class.GradeBands` (mặc định trong `SettingKeys.Defaults` ⇒ có sẵn qua `GetEffectiveAllAsync` dù DB cũ chưa seed; sửa ở trang **Cấu hình**). FE trang **Lớp học** điều hướng 3 mức qua query param (`?subjectId=&gradeBand=&view=all`) + breadcrumb; có lối "Tất cả lớp" và nhóm "Chưa phân khối". Form tạo/sửa lớp thêm chọn Môn + Khối. Học liệu lọc/ gắn theo Khối.
- **Import danh sách LỚP từ Excel** (song song import học viên): `IClassImportService`/`ClassImportService` (ClosedXML, mirror `StudentImportService`) — cột `Tên lớp | Môn | Khối | Giáo viên (email/username) | Sĩ số | Ngày khai giảng | Giáo trình`; validate Môn/GV tồn tại. Endpoints `GET /api/classes/import-classes-template`, `POST /api/classes/import-classes/preview` + `POST /api/classes/import-classes` (**AdminOnly**). UI nút "Nhập Excel lớp" ở mức Môn.
- **Giáo viên xem lịch lớp mình (mục 3b):** chỉ đổi FE — route `/schedule` `adminOnly` → `teacherOrAdmin` + thêm menu "Lịch học" cho GV. Backend `ScheduleService.GetRangeAsync` đã tự lọc theo `TeacherScopeId` (không đổi).
- **Gộp Cảnh báo vào Lớp & Học sinh (mục 6):** `WarningsController`/`WarningsService` thêm filter `studentId` (scope theo HS qua `EnsureCanAccessStudentAsync`). Chi tiết lớp có card "Cảnh báo của lớp" (gọi `?classId=`); chi tiết HS có panel cảnh báo (`?studentId=`). **Giữ nguyên** trang `/warnings` tổng cho Admin.
- **Quản lý Môn:** `SubjectsController` (`/api/subjects` GET TeacherOrAdmin; POST/PUT/DELETE AdminOnly) + `ISubjectService`/`SubjectService` (Application, dùng `IRepository`); UI modal "Quản lý môn" ở mức Môn.

**Endpoints Đợt 7 thêm:** `/api/subjects` (CRUD), `/api/classes/import-classes*` (template/preview/commit), `GET /api/classes?subjectId&gradeBand`, `GET /api/materials/library?gradeBand`, `GET /api/warnings?studentId`.

### 15.9 Redesign module Lớp học/Giáo viên/Học viên/Học phí (2026-06-21)
- **Danh mục CRUD riêng:** `Subject`, `GradeCategory`, `Branch`. `GradeCategory` seed mặc định `Mầm non`, `1..12`, `Khác` trong `DbSeeder`; xóa danh mục bị chặn nếu còn lớp tham chiếu.
- **Giáo viên tách hồ sơ:** entity `TeacherProfile` là nguồn nghiệp vụ chính (`TeacherCode`, thông tin cá nhân, `UserId?` liên kết 1-1 với tài khoản role Teacher). Endpoint `/api/teachers` CRUD hồ sơ + `POST /api/teachers/accounts` tạo tài khoản giáo viên và liên kết hồ sơ có sẵn hoặc tạo hồ sơ mới.
- **Lớp học snapshot danh mục:** `ClassRoom` thêm `ClassCode` unique (tự sinh `LH...` nếu trống), `TeacherProfileId`, `TeacherName`, `SubjectName`, `GradeId/GradeName`, `BranchCode/BranchName`, `TuitionFee`. Khi tạo/sửa lớp service validate id danh mục và snapshot tên để lớp cũ không đổi theo danh mục mới.
- **Học viên & học phí:** `Student` thêm `Email`, `Note`, mã học viên cho phép nhập tay hoặc tự sinh; UI Học viên bỏ luồng "Hiện đã xóa". `TuitionInvoice` thêm `DiscountAmount`, `PaidAmount`, trạng thái `Partial`; API `/api/tuition/students` quản lý theo học viên, bill lấy học phí từ các lớp đang học và ghi nhận giảm giá/đã đóng/còn thiếu.
- **Import Excel lớp + học viên:** template `/api/classes/import-classes-template` có sheet chính + sheet phụ `CoSo`, `MonHoc`, `Khoi`, `GiaoVien`, `LopHienCo`; preview trả 2 danh sách `classes/students`, commit nhận preview đã chỉnh sửa để tạo lớp, học viên và ghi danh.
- **FE:** `/classes` gồm 3 vùng Lớp học/Danh mục/Cấu hình, modal chi tiết lớp + roster + tạo học viên; `/teachers` quản lý hồ sơ/tài khoản giáo viên; `/students` filter theo danh mục/giáo viên; `/tuition` theo học viên + bill tải HTML.

### 15.10 Mã giáo viên theo cơ sở + mã học viên ở Học phí (2026-06-24)
- **Prefix mã giáo viên theo cơ sở:** `TeacherProfile` thêm `BranchId` (cơ sở **tạo mã**/cơ sở chính — không FK, có index); `Branch` thêm `TeacherCodePrefix`. `TeacherService.NextTeacherCodeAsync(requested, fullName, branchId)` giải prefix: có cơ sở → `Branch.TeacherCodePrefix` (trống → `NameCodeGenerator.PascalCompact(tên cơ sở) + "@"`, vd "Đông Thọ" → `DongTho@`); không cơ sở → fallback setting `Center.CodePrefix`. `GenerateTeacherCode` nay **bỏ dấu `-` cứng** — prefix tự mang dấu phân tách ⇒ mã dạng **`DongTho@TrangNTT0`**. Mã là **định danh cố định** (GV dạy thêm cơ sở khác qua gán lớp, không đổi mã). Mã **giữ nguyên hoa/thường**, kiểm trùng **không phân biệt hoa/thường** (đồng bộ Create thủ công + Update). **Giữ 2 định dạng:** đường tạo qua module Người dùng (`UserAdminService`) vẫn sinh `GV{base36}` ngẫu nhiên.
- **Cấu hình & UI:** trang **Cấu hình hệ thống** (`settings.page.ts`) thêm mục **"Tiền tố mã giáo viên theo cơ sở"** (liệt kê cơ sở + ô nhập prefix, lưu qua `Branch` update; placeholder gợi ý mặc định theo tên). Form Thêm/Sửa GV + tạo tài khoản GV (`teachers.page.ts`) thêm ô chọn **Cơ sở**; `TeacherProfileDto` thêm `BranchId/BranchName`.
- **Học phí — mã học viên:** `TuitionInvoiceDto` thêm `StudentCode` (nạp trong `ToDtosAsync`); bảng `/tuition` thêm cột **"Mã HV"** (dữ liệu danh sách đã có sẵn `StudentCode`).
- **Migration:** `TeacherBranchAndCodePrefix` (`Branches.TeacherCodePrefix` varchar(30) + `TeacherProfiles.BranchId` uuid + index — đều nullable, 0 FK).

### 15.11 Tài khoản đăng nhập HS & GV — gom về một cơ chế (2026-06-25)
- **Nguyên tắc:** mỗi `Student`/`TeacherProfile` ↔ tối đa **một** `AppUser`; **tên đăng nhập = mã** (`StudentCode`/`TeacherCode`, tự sinh, ổn định). Đăng nhập vẫn chấp nhận username **hoặc** email (`AuthService.LoginAsync`).
- **Service thống nhất** `IAccountProvisioningService` (`Application/Accounts`) / `AccountProvisioningService` (`Infrastructure/Accounts`) là **nguồn sự thật duy nhất** cho vòng đời tài khoản: cấp (`ProvisionStudent/TeacherAsync`), cấp hàng loạt (`Provision*sAsync`), đặt lại mật khẩu (`Reset*PasswordAsync`), khóa/mở (`Set*LockedAsync` qua Identity lockout), gỡ/liên kết (`Unlink/LinkStudentAsync`). Các luồng cũ (`StudentAccountService.CreateInClassAsync`, `TeacherService.CreateAccountAsync`, `StudentImportService`, `StudentService.LinkUserAsync`) **gọi service này** thay cho logic riêng ⇒ xóa mọi điểm không nhất quán (username/mật khẩu/email-ảo/1-1).
- **Mật khẩu mặc định cấu hình được** (Settings `Account.DefaultPassword`, mặc định `Hocvien@123`) + cờ **`AppUser.MustChangePassword`**: tài khoản vừa cấp/đặt lại bị **buộc đổi mật khẩu ở lần đăng nhập đầu**. `UserDto.MustChangePassword` đổ ra FE; `ProfileService.ChangePasswordAsync` gỡ cờ + thu hồi refresh token. FE: `mustChangePasswordGuard` ép sang màn `/must-change-password` trước khi vào hệ thống.
- **Email ảo** (Identity bắt `RequireUniqueEmail`): một quy tắc `sanitize(mã)@{Account.LocalEmailDomain}` (mặc định `hs.local`), fallback theo GUID nếu trùng — thay 3 domain cũ.
- **1-1 chặt ở DB:** partial unique index trên `Student.UserId` (đồng bộ `TeacherProfile.UserId` đã có) lọc `WHERE "UserId" IS NOT NULL AND NOT "IsDeleted"` — migration `AddAccountProvisioning` (+ cột `MustChangePassword`). App vẫn kiểm trước + bắt `DbUpdateException` làm lưới an toàn.
- **Trang Người dùng** (`UserAdminService.CreateUserAsync`) **chỉ tạo tài khoản Admin** (bỏ nhánh tạo GV `GV{base36}` lệch chuẩn); GV cấp ở trang Giáo viên, HS ở trang Học viên.
- **DTO trạng thái:** `StudentDto`/`RosterItemDto`/`TeacherProfileDto` thêm `UserName`/`IsLocked`/`MustChangePassword` (nạp qua `IUserDirectory.GetAccountInfosAsync`). FE: cột **"Tài khoản"** (badge Đã cấp/Chưa cấp/Đã khóa) + nút **Quản lý tài khoản** (cấp/đặt lại/khóa/gỡ/liên kết) + **cấp hàng loạt** (checkbox) ở trang Học viên & Giáo viên.
- **Endpoint mới:** HS (`TeacherOrAdmin`, guard theo lớp) `POST /api/students/{id}/account`, `/account/reset-password`, `/account/lock`, `DELETE /account`, `POST /api/students/accounts/provision`; giữ `PUT /students/{id}/link-user` (Admin). GV (`AdminOnly`) `POST /api/teachers/{id}/account`, `/account/reset-password`, `/account/lock`, `POST /api/teachers/accounts/provision`. Bỏ `PUT /students/{id}/password` cũ.

### 15.12 Lịch học — bộ lọc theo role + view Ngày (Cơ sở → Ca) + lịch học viên (2026-06-26)
- **View Ngày (mặc định) nhóm Cơ sở → Ca → lớp** (kiểu bản in nghiệp vụ), giữ Tuần/Tháng. Mỗi dòng lớp hiển thị *tên lớp · giáo viên · giờ*; buổi `Cancelled` gạch ngang; click → `/sessions/{id}`. Lớp không cơ sở gom nhóm **"Chưa phân cơ sở"** (xếp cuối); buổi không khớp Ca/không có giờ → **"Chưa xếp giờ"** (xếp cuối).
- **"Ca" cấu hình được theo từng Cơ sở — KHÔNG đổi schema.** Lưu ở Settings key **`Schedule.Shifts`** (System, `DataType=Json`): `{ "default": [{name,from,to}], "byBranch": { "<branchId>": [...] } }`. Mỗi buổi xếp Ca theo **giờ bắt đầu** (`from <= start < to`); cơ sở có override dùng `byBranch[branchId]`, còn lại dùng `default`. Tính **ở server** qua helper thuần `Application/Schedule/ShiftResolver.cs` (fail-safe: JSON sai/giờ thiếu ⇒ "chưa xếp"; thứ tự Ca = vị trí trong mảng → `ShiftOrder`). `DbSeeder` seed sẵn 1 row mặc định (idempotent); resolver vẫn fallback `SettingKeys.Defaults` nếu thiếu row ⇒ chạy đúng trên DB cũ.
- **Làm giàu `CalendarSessionDto`**: thêm `TeacherProfileId/TeacherName`, `BranchId/BranchName/BranchCode`, `SubjectName`, `GradeName` (snapshot từ `Classes`, vẫn **1 join**) + `ShiftName/ShiftOrder` (tính trong bộ nhớ sau khi materialize). Sắp xếp `(SessionDate, ShiftOrder, StartTime)`.
- **Bộ lọc theo role**: `GET /api/schedule` thêm `branchId/subjectId/gradeId/teacherProfileId` (áp thẳng lên `Classes`). **Admin** đủ 4 lọc; **Giáo viên** auto-scope lớp mình (server **bỏ qua** `teacherProfileId` truyền vào, FE ẩn lọc Giáo viên); FE thêm tìm kiếm client-side (tên lớp/GV/môn).
- **Lịch học viên (role User)** — endpoint riêng, **không động `ClassAccessGuard`**: `GET /api/portal/schedule?from&to` → `PortalService.GetScheduleRangeAsync` (lấy `Student` theo `UserId` → `classIds` enrollment active → join + làm giàu + xếp Ca, trả cùng `CalendarSessionDto`). Trang Portal thêm card **"Lịch của tôi"** (Ngày/Tuần, chỉ-đọc, không link sang `/sessions`). Bao gồm cả buổi `Cancelled`.
- **Màn Cấu hình** thêm mục **"Khung Ca học"**: bảng Ca mặc định (thêm/xóa dòng: tên, giờ bắt đầu/kết thúc) + override theo cơ sở (chọn cơ sở; trống = dùng mặc định); validate `HH:mm` + kết thúc > bắt đầu, lưu JSON `Schedule.Shifts`.
- **Phòng (Room) & Online — CHỈ tài liệu hóa, chưa hiện thực** (theo yêu cầu khách hàng, để dành tương lai; **không** đổi schema đợt này ⇒ view Ngày tạm chưa hiện phòng/đánh dấu online):
  - **Online**: thêm `bool IsOnline` cấp **`ClassRoom`** (online là thuộc tính chuẩn của lớp), đổ ra `CalendarSessionDto` để FE gắn nhãn 🌐. Ripple nhỏ sang Class module (ClassDto/Create/Update + form lớp). Tùy chọn tương lai: `bool? IsOnlineOverride` cấp buổi (hiệu lực = override ?? class).
  - **Phòng**: *Pha 1* cột text tự do `RoomName` (snapshot) trên `ClassScheduleSlot` + `ClassSession` (GenerateSessions copy từ slot) để hiển thị như bản in; *Pha 2* entity `Room` theo cơ sở (Guid, **0 FK**, index) + `RoomId` + **chống trùng phòng/giờ** (kiểm app-layer cùng ngày, bỏ buổi `Cancelled`). Tất cả nullable, 0 FK; toàn vẹn kiểm app-layer.
- **Lưu ý**: buổi của **lớp đã xóa mềm** tự biến mất khỏi lịch (global query filter áp cả 2 vế join) — đúng ý, hiện lại khi khôi phục lớp.

### 15.13 Tích hợp AI — cấu hình API Key Gemini theo tài khoản (2026-06-30)
- **Phạm vi đợt này:** mỗi tài khoản (**mọi vai trò**) tự dán **API Key Google Gemini** của riêng mình; đợt này **chỉ làm phần cấu hình key** (lưu/che/kiểm tra/xóa). Tính năng AI thật (tạo đề/bài tập, tóm tắt buổi học, báo cáo phụ huynh, chatbot) làm sau — đã chừa **seam** `IAiCredentialResolver.GetApiKeyForUserAsync(userId)` để các tính năng đó lấy key đã giải mã mà không chạm bảng/mã hóa.
- **Entity** `UserAiCredential : BaseEntity` (`Domain/Entities`, **0 FK**): `UserId` (**partial unique 1-1** `WHERE "UserId" IS NOT NULL AND NOT "IsDeleted"` — mirror `Student.UserId`), `Provider` (mặc định `Gemini`), `ApiKeyEncrypted`, `KeyLast4`, `Model`, `LastValidatedAt`, `IsValid`. DbSet `AppDbContext.AiCredentials`; migration `AddUserAiCredential`.
- **Mã hóa khi lưu (tiện ích mới của repo):** abstraction `ISecretProtector` (`Application/Abstractions`) + impl `DataProtectionSecretProtector` (`Infrastructure/Security`) dùng **ASP.NET Core Data Protection** (purpose `HungSilver.AiCredential.v1`). DI: `AddDataProtection().SetApplicationName("HungSilver").PersistKeysToFileSystem(<dpKeysPath>)`; `dpKeysPath` đọc từ `DataProtection:KeysPath`, **trống ⇒ mặc định `<FileStorage:RootPath>/dpkeys`** ⇒ đi cùng volume `hungsilver_uploads` (không thêm volume mới). ⚠️ Mất thư mục khóa ⇒ mọi key đã lưu không giải mã được (user phải nhập lại).
- **Gọi Gemini (typed HttpClient ĐẦU TIÊN của repo):** `IGeminiClient` (`Application/AiCredentials`) + `GeminiClient`/`GeminiOptions` (`Infrastructure/Ai`, section `Ai:Gemini`). `AddHttpClient<IGeminiClient, GeminiClient>` (BaseUrl + timeout 15s). `ValidateKeyAsync` gọi nhẹ `GET v1beta/models?key=…` → 200 ⇒ hợp lệ; 400/401/403 ⇒ `Error.Validation`; lỗi mạng/timeout ⇒ `Error.Failure` (bắt lỗi, **không ném**).
- **Service** `AiCredentialService` (`Infrastructure/AiCredentials`) hiện thực cả `IAiCredentialService` (Get / Save **upsert theo UserId** / Validate live / Delete soft-delete) **và** `IAiCredentialResolver`. **Hand-map** DTO (giải mã + che): DTO chỉ trả `MaskedKey` dạng `••••••••<last4>`, **không bao giờ** trả key thô. Đăng ký 1 instance, forward 2 interface (mirror `SettingsService`). Xóa user dọn luôn key (`CurrentRelationCleanupService.UnlinkUserRelationsAsync`).
- **Controller** `AiCredentialController` (`/api/ai-credential`, `[Authorize]` mọi vai trò) thao tác trên `ICurrentUser.UserId` — **không cho sửa key người khác**. GET / PUT (`{apiKey,model}`) / POST `validate` / DELETE.
- **FE:** `core/ai-credential.service.ts` + card **"Tích hợp AI — Google Gemini"** trên `/profile` (mọi vai trò vào được): chưa có key ⇒ ô paste key (`nz-input` password) + `nz-select` model + link tạo key tại `aistudio.google.com/apikey` + **Lưu**; đã có key ⇒ key đã che + `nz-tag` trạng thái (Hợp lệ/Không hợp lệ/Chưa kiểm tra) + **Kiểm tra** / **Đổi key** / **Xóa** (`nz-popconfirm`). Icon mới `robot`, `check-circle`. Responsive 375px.

### 15.14 Tạo đề trắc nghiệm từ tài liệu bằng AI — Pha 1 (2026-07-01)

> **Chức năng cốt lõi:** GV upload tài liệu (PDF/Word) → Gemini **bóc tách/sinh** bộ đề trắc nghiệm → GV **duyệt/sửa cạnh
> bản gốc** → phát hành. Kho tài liệu thêm trục **quản lý theo Môn**. (Pha 2: gửi lớp + làm bài hẹn giờ + tự chấm; Pha 3:
> báo cáo trực quan — **chưa hiện thực**.)

- **Lõi sinh đề (bám sát tài liệu):** mọi tài liệu **chuẩn hóa về PDF** rồi cho Gemini đọc bằng **vision** (giữ gạch
  chân/ảnh/bố cục — text thuần làm sai câu "underlined"/biển báo). `IDocumentToPdfConverter`/`LibreOfficeDocumentConverter`
  (PDF passthrough; Word→PDF qua **LibreOffice headless**, profile riêng mỗi lần) + `IExamSourceProvider`. `IGeminiClient.GenerateContentAsync`
  gọi `generateContent` với `generationConfig.responseSchema` (ép JSON, `propertyOrdering`) + **retry backoff** 429/5xx/timeout
  (CTS ~120s; typed-client Timeout=Infinite, mỗi lệnh tự đặt CTS). Prompt Extract (giữ nguyên văn + số thứ tự + đáp án đã
  đánh dấu) / Generate (sinh mới theo chủ đề).
- **Kiểm chứng 3 lớp:** **L1 code** (`ExamQuestionFactory` validate cấu trúc + đáp án∈lựa chọn ⇒ **bỏ câu hỏng**; kiểm lỗ
  hổng `SourceNumber` báo "nghi thiếu câu"); **L2 AI đối chiếu** bản trích vs PDF gốc (best-effort, thêm cảnh báo); **L3 GV
  duyệt** cạnh PDF gốc. Chỉ 4 loại tự chấm: `SingleChoice`/`TrueFalse`/`FillBlank`(accept-list "/")/`Matching`.
- **Entities (0 FK):** `Exam` (Draft/Published, MaterialId + SubjectId snapshot, DurationMinutes, TotalPoints=10, GenSource),
  `ExamQuestionGroup` (ngữ liệu chung: Section/ExerciseLabel/Instruction/Passage), `ExamQuestion` (Type, Stem, `OptionsJson`,
  `AnswerJson`, Explanation, Points, SourceNumber). `LearningMaterial` +`SubjectId/SubjectName`. Migration `AddExamAuthoring`.
  Cột JSON: SingleChoice `[{key,text}]`+`{key}`; TrueFalse `{value}`; FillBlank `{blanks,wordBox}`+`{blanks:[[..]]}`; Matching `{left,right}`+`{pairs}`.
- **Service/API:** `ExamGenerationService` (Infrastructure, orchestrate §A) + `ExamGenerationJobService` (**in-memory background queue**,
  xử lý tuần tự; job giữ ~2h, mất khi app restart; tránh Cloudflare/proxy timeout cho request AI dài) + `ExamService` (Application:
  paged theo môn/tài liệu, detail kèm `SourceFileUrl`, sửa đề/câu qua `ExamQuestionFactory` dùng chung, publish, soft-delete cascade con) +
  `MaterialService.GetPagedBySubjectAsync`. `ExamsController` (`/api/exams`, `[Authorize(TeacherOrAdmin)]`): `POST /generate/{materialId}`
  trả `{jobId,status,pollAfterSeconds}` nhanh; `GET /generation-jobs/{jobId}` trả `Queued/Running/Succeeded/Failed` + result khi xong. `MaterialsController` `by-subject`.
- **FE:** `core/exam.service.ts`; Kho tài liệu thêm mode **"Theo môn"** (lưới phân trang + nút **Đề**); `features/exams/exam-list.page.ts`
  (bảng đề + modal "Tạo đề bằng AI" Extract/Generate, start job + polling trạng thái) → `exam-detail.page.ts` (**PDF gốc song song** tải qua HttpClient
  blob để đính token + trình sửa đầy đủ 4 loại câu + giải thích + **Lưu vào bộ đề**). Responsive.
- **Triển khai:** image API cài **LibreOffice** (`server/Dockerfile`); config `DocumentConversion` (SofficePath trống=PATH). Sinh đề
  chạy nền qua job/polling; GV cần cấu hình API Key Gemini ở `/profile` trước (lỗi `Ai.KeyMissing` nếu thiếu).

### 15.15 Giao đề + làm bài hẹn giờ + tự chấm (Pha 2 — 2026-07-01)

- **Entities (0 FK):** `ExamAssignment` (giao đề cho lớp: ExamId+ExamTitle snapshot, ClassId, ClassSessionId?, Mode
  InClass/Homework, DurationMinutes, OpenAt/CloseAt, Status Open/Closed), `ExamAttempt` (lượt làm 1 HS: StartedAt/SubmittedAt,
  Score/CorrectCount/TotalCount, **unique (ExamAssignmentId, StudentId)**), `ExamAttemptAnswer` (đáp án từng câu: ResponseJson,
  IsCorrect, AwardedPoints, **unique (AttemptId, QuestionId)**). Migration `AddExamDelivery`.
- **Tự chấm** `ExamGrader` (Application, thuần): so `ResponseJson` vs `AnswerJson` theo loại → `(đúng, tỉ lệ [0..1])`;
  Matching/FillBlank **chấm từng phần**, FillBlank chuẩn hóa trim+lower + accept-list "/". Điểm = Σ(`Points`×tỉ lệ) trên thang 10.
- **GV giao đề** `ExamAssignmentService` (mirror `AssignmentService`): chỉ giao đề **Published**, access-guard lớp, validate buổi
  cùng lớp; đổi OpenAt/CloseAt (FE gửi ISO UTC) về giờ local server (`DateTime.Now`). `POST /api/exams/{id}/assign`, `GET .../assignments`, `POST .../assignments/{id}/close`.
- **HS làm bài** `ExamTakingService` (**server-authoritative**): `GetMyExams` (đề Open theo lớp + trạng thái lượt); `Start`
  (tạo/hồi phục attempt, `ExpiresAt=StartedAt+Duration`, trả câu **KHÔNG kèm đáp án/giải thích**); `SaveAnswer` (autosave, chặn sau
  hết giờ+grace); `Submit` (**tự chấm** → Score/10; quá giờ ⇒ `AutoSubmitted`, chấm phần đã lưu; **idempotent**); `Review` (**chỉ
  sau nộp**: đáp án đúng + giải thích + đúng/sai từng câu). Unique index + catch `DbUpdateException` cho đua tạo attempt/answer.
  `/api/portal/exams*` (`[Authorize]`, guard `Student.UserId`+enrollment).
- **FE:** GV `exam-detail` thêm **"Giao cho lớp"** (modal lớp/hình thức/thời gian/mở-đóng dùng `nz-date-picker`) + danh sách "Đã
  giao" (đếm đã nộp, nút Đóng). HS Portal thêm card **"Đề của tôi"** + `exam-take.page` (đồng hồ đếm ngược đồng bộ `ExpiresAt`, **tự
  nộp khi hết giờ**, autosave mỗi câu, khôi phục bài dở, thanh tiến độ) + `exam-review.page` (điểm + đáp án mình vs đúng + giải thích).

### 15.16 Báo cáo trực quan cho giáo viên (Pha 3 — 2026-07-01)

- **BE** `ExamReportService` (chỉ đọc, access-guard lớp): theo `ExamAssignmentId` tổng hợp — danh sách **per-student**
  (điểm/trạng thái: chưa làm / đang làm / đã nộp / hết giờ), **điểm TB lớp**, **phân bố điểm** (5 khoảng /10), **item analysis**
  (% đúng từng câu trên các lượt đã nộp, dùng `ExamAttemptAnswer.IsCorrect`). `GET /api/exams/assignments/{id}/report`
  (`TeacherOrAdmin`). Không migration.
- **FE** `features/exams/exam-report.page.ts`: 4 thẻ số (đã nộp / TB lớp / cao nhất / câu khó nhất) + **ECharts** (`shared/chart.ts`):
  bar **phân bố điểm** + bar **% đúng theo câu** (đỏ <50% / cam <75% / xanh — nhận diện câu khó) + **bảng học viên** (điểm, giờ nộp).
  Vào từ nút **"Báo cáo"** ở mỗi lượt giao trong `exam-detail`.

---

## 16. Changelog

> Ghi lại mỗi thay đổi đáng kể (entity/endpoint/luồng/config/hạ tầng) theo định dạng: `ngày — mô tả — file chính`.

- **2026-07-02** — **Fix 504 Cloudflare khi tạo đề AI**: đổi `POST /api/exams/generate/{materialId}` từ luồng HTTP đồng bộ sang **job nền in-memory** (`ExamGenerationJobService`, worker tuần tự; job giữ ~2h, mất khi app restart) trả `jobId` ngay; thêm `GET /api/exams/generation-jobs/{jobId}` để polling `Queued/Running/Succeeded/Failed` và nhận `ExamGenerationResult` khi xong. FE `exam-list.page` start job + poll mỗi `pollAfterSeconds`, giữ modal trạng thái rồi điều hướng sang đề nháp khi thành công. Không migration. Build BE/FE sạch; thêm test `ExamGenerationJobServiceTests`. — `server/src/HungSilver.Application/Exams/{IExamGenerationService,ExamGenerationDtos}.cs`, `server/src/HungSilver.Infrastructure/Exams/ExamGenerationJobService.cs`, `server/src/HungSilver.Infrastructure/DependencyInjection.cs`, `server/src/HungSilver.WebApi/Controllers/ExamsController.cs`, `client/src/app/core/{models,exam.service}.ts`, `client/src/app/features/exams/exam-list.page.ts`, `server/tests/HungSilver.UnitTests/ExamGenerationJobServiceTests.cs`, `ARCHITECTURE.md`.
- **2026-07-01** — **Đề AI Pha 3: báo cáo trực quan cho GV** (xem §15.16): `ExamReportService` (chỉ đọc, access-guard lớp) tổng hợp per-student + điểm TB lớp + phân bố điểm (5 khoảng /10) + item analysis (% đúng/câu) qua `GET /api/exams/assignments/{id}/report`; FE `exam-report.page` (ECharts: bar phân bố + bar %đúng đổi màu theo độ khó + bảng học viên), vào từ nút "Báo cáo" ở `exam-detail`. Hoàn tất 3 pha tính năng Đề AI. Build BE/FE sạch, **64/64 test BE**. — `server/src/HungSilver.Application/Exams/{ExamReportDtos,IExamReportService}.cs`, `server/src/HungSilver.Infrastructure/Exams/ExamReportService.cs`, `server/src/HungSilver.{WebApi/Controllers/ExamsController,Infrastructure/DependencyInjection}.cs`, `client/src/app/{core/{models,exam.service}.ts,features/exams/{exam-report,exam-detail}.page.ts,app.routes.ts}`, `ARCHITECTURE.md`.
- **2026-07-01** — **Đề AI Pha 2: giao đề + làm bài hẹn giờ + tự chấm** (xem §15.15): entities `ExamAssignment`/`ExamAttempt`/`ExamAttemptAnswer` (0 FK, unique 1 lượt/HS, migration `AddExamDelivery`); `ExamGrader` tự chấm 4 loại (Matching/FillBlank chấm từng phần, chuẩn hóa accept-list); `ExamAssignmentService` giao đề Published cho lớp (hẹn giờ, InClass/Homework, đổi ISO UTC→local); `ExamTakingService` **server-authoritative** (start không lộ đáp án, autosave, submit tự chấm /10 + quá giờ AutoSubmitted, review sau nộp) qua `/api/portal/exams*` + `/api/exams/{id}/assign*`. FE: GV `exam-detail` +"Giao cho lớp"; HS Portal card "Đề của tôi" + `exam-take` (đồng hồ đếm ngược tự nộp, autosave, khôi phục bài dở) + `exam-review` (đáp án+giải thích). Build BE/FE sạch, **64/64 test BE** (+7 `ExamGraderTests`). — `server/src/HungSilver.Domain/Entities/{ExamAssignment,ExamAttempt,ExamAttemptAnswer}.cs`, `server/src/HungSilver.Application/Exams/{ExamGrader,ExamTakingDtos,ExamAssignmentDtos,IExamAssignmentService,IExamTakingService,ExamEnums↔Domain}.cs`, `server/src/HungSilver.Infrastructure/Exams/{ExamAssignmentService,ExamTakingService}.cs`, migration `*AddExamDelivery*`, `server/src/HungSilver.WebApi/Controllers/{ExamsController,PortalExamsController}.cs`, `client/src/app/{core/{models,portal.service,exam.service}.ts,features/{portal/{portal,exam-take,exam-review},exams/exam-detail}.page.ts,app.routes.ts,app.config.ts}`, `server/tests/HungSilver.UnitTests/ExamGraderTests.cs`, `ARCHITECTURE.md`.
- **2026-07-01** — **Tạo đề trắc nghiệm từ tài liệu bằng AI — Pha 1** (xem §15.14): Kho tài liệu thêm trục **theo Môn** (`LearningMaterial.SubjectId`, lưới phân trang `/api/materials/by-subject`); entity `Exam`/`ExamQuestionGroup`/`ExamQuestion` (0 FK, JSON options/answer, migration `AddExamAuthoring`); **lõi sinh đề** chuẩn hóa mọi tài liệu (PDF/Word) về **PDF → Gemini vision** (`IDocumentToPdfConverter`/`LibreOfficeDocumentConverter`/`IExamSourceProvider`), `IGeminiClient.GenerateContentAsync` ép `responseSchema` + retry backoff (CTS 120s), `ExamGenerationService` **kiểm chứng 3 lớp** (code `ExamQuestionFactory` validate + lỗ hổng số thứ tự → AI đối chiếu → GV duyệt cạnh PDF gốc). `ExamService` CRUD/publish + `ExamsController` (`/api/exams`). FE: mode "Theo môn" + `exam-list`/`exam-detail` (PDF gốc song song, sửa 4 loại câu, phát hành). `server/Dockerfile` +LibreOffice; config `DocumentConversion`. Build BE/FE sạch, **57/57 test BE** (+4 `ExamGenerationServiceTests`: bỏ câu hỏng, chia đều điểm/10, lỗ hổng số thứ tự, thiếu key). — `server/src/HungSilver.Domain/Entities/{Exam,ExamQuestionGroup,ExamQuestion,LearningMaterial}.cs`, `server/src/HungSilver.Application/{Abstractions/{IDocumentToPdfConverter,IExamSourceProvider},AiCredentials/{IGeminiClient,IAiCredentialResolver},Exams/*,Materials/*}.cs`, `server/src/HungSilver.Infrastructure/{Ai/GeminiClient,AiCredentials/AiCredentialService,Documents/*,Exams/ExamGenerationService,DependencyInjection}.cs`, migration `*AddExamAuthoring*`, `server/src/HungSilver.WebApi/{Controllers/{Exams,Materials}Controller.cs,appsettings.json}`, `server/Dockerfile`, `client/src/app/{core/{models,materials.service,exam.service}.ts,features/{materials/materials,exams/{exam-list,exam-detail}}.page.ts,app.routes.ts}`, `server/tests/HungSilver.UnitTests/ExamGenerationServiceTests.cs`, `ARCHITECTURE.md`.
- **2026-06-30** — **Tích hợp AI: cấu hình API Key Google Gemini theo tài khoản** (xem §15.13): entity mới `UserAiCredential` (0 FK, partial unique 1-1 `UserId`, migration `AddUserAiCredential`); **mã hóa khi lưu** bằng ASP.NET Core Data Protection (`ISecretProtector`/`DataProtectionSecretProtector`, khóa persist dưới `<FileStorage:RootPath>/dpkeys` ⇒ đi cùng volume uploads, không thêm volume mới); **typed HttpClient đầu tiên của repo** `IGeminiClient`/`GeminiClient` (`AddHttpClient`, validate qua `GET v1beta/models?key=`); `AiCredentialService` (Get/Save upsert/Validate/Delete) đồng thời là `IAiCredentialResolver` (**seam** cho tính năng AI tương lai); DTO chỉ trả key **đã che** `••••••••<last4>`. Controller `/api/ai-credential` (`[Authorize]` mọi vai trò, chỉ thao tác trên chính mình). FE: `ai-credential.service.ts` + card "Tích hợp AI — Google Gemini" trên `/profile` (paste/che/kiểm tra/đổi/xóa; icon `robot`/`check-circle`; responsive). Config `Ai:Gemini` + `DataProtection:KeysPath`. Build BE/FE sạch, **53/53 test BE** (+6 `AiCredentialServiceTests`: mã hóa+che, upsert 1-1, xóa mềm tạo lại, index chặn 2 key sống, validate cập nhật trạng thái). — `server/src/HungSilver.Domain/Entities/UserAiCredential.cs`, `server/src/HungSilver.Application/{Abstractions/ISecretProtector,AiCredentials/*}.cs`, `server/src/HungSilver.Infrastructure/{Security/DataProtectionSecretProtector,Ai/{GeminiClient,GeminiOptions},AiCredentials/AiCredentialService,Common/CurrentRelationCleanupService,Persistence/{AppDbContext,Configurations/UserAiCredentialConfigurations},DependencyInjection}.cs`, migration `*AddUserAiCredential*`, `server/src/HungSilver.WebApi/{Controllers/AiCredentialController.cs,appsettings.json}`, `client/src/app/{core/{models,ai-credential.service}.ts,features/profile/profile.page.ts,app.config.ts}`, `server/tests/HungSilver.UnitTests/AiCredentialServiceTests.cs`, `ARCHITECTURE.md`.
- **2026-06-28** — **Fix: "Khung giờ lặp tuần" mất chữ Thứ khi hiển thị** (BE-only): card Lịch học của chi tiết lớp hiển thị `WEEKDAY_LABELS[slot.dayOfWeek]` theo **số** (0–6), nhưng `ScheduleSlotDto.DayOfWeek`/`CreateSlotRequest.DayOfWeek` để kiểu enum `DayOfWeek` ⇒ `JsonStringEnumConverter` toàn cục serialize thành **chuỗi** (`"Monday"`) ⇒ FE tra `WEEKDAY_LABELS["Monday"]` = undefined → mất Thứ (tạo vẫn chạy do converter chấp nhận số khi đọc). Sửa: 2 record DTO đổi `DayOfWeek` → `int` (0–6, khớp `Date.getDay()` + model FE `dayOfWeek: number`); `ScheduleService` cast `(int)s.DayOfWeek` ở projection EF/khi trả DTO và `(DayOfWeek)request.DayOfWeek` khi gán entity. FE/DB/migration không đổi; entity vẫn lưu enum (integer). — `server/src/HungSilver.Application/Schedule/ScheduleDtos.cs`, `server/src/HungSilver.Infrastructure/Schedule/ScheduleService.cs`, `ARCHITECTURE.md`.
- **2026-06-28** — **Fix: không click được vào chi tiết các bảng + lỗi `<svg> tag not found`** (FE-only, 2 lỗi độc lập): (1) **Chặn click row** — directive `appTableDragScroll` gọi `setPointerCapture` ngay trên `pointerdown`; khi bảng có tràn ngang (`nzScroll.x`), trình duyệt đổi target của `click` kế tiếp sang chính `<nz-table>` thay vì `<tr>` ⇒ `(click)="openDetail(...)"` trên dòng không bao giờ chạy. Sửa: chỉ `setPointerCapture` **khi đã thực sự kéo** (vượt ngưỡng 4px trong `pointermove`), và `endDrag` chỉ release khi `hasPointerCapture` (tránh `InvalidPointerId` trên click thường) ⇒ click thường về lại `<tr>`, kéo-cuộn vẫn mượt + vẫn nuốt đúng 1 click sau kéo. (2) **`<svg> tag not found`** — 16 icon dùng trong template (`search, user-add, download, key, unlock, disconnect, left, right, safety, holder, insert-row-right, zoom-in, zoom-out, user-delete, close-circle, fall`) chưa đăng ký ở `provideNzIcons` ⇒ ant-design-icons ném lỗi + icon không hiện; đã import + đăng ký đủ. Build FE sạch. — `client/src/app/shared/table-drag-scroll.directive.ts`, `client/src/app/app.config.ts`, `ARCHITECTURE.md`.
- **2026-06-27** — **UI: khung cố định + gọn & bảng cuộn thân + chọn pageSize + kéo-cuộn ngang** (FE-only): `shell.ts`/`styles.scss` đổi `.app-layout` từ `min-height:100vh` → `height:100vh; overflow:hidden` ⇒ **sider + header cố định khi cuộn**, chỉ vùng `.app-content` cuộn (`flex:1; min-height:0; overflow:auto`); thu gọn khung ("Gọn vừa"): header 64→52px, lề content `margin` 16→12 + `padding` 20→16; menu sider tự cuộn (brand cố định, `.app-nav` overflow). 5 trang danh sách chính (Học viên/Giáo viên/Lớp học/Học phí/Người dùng) thêm `nzShowSizeChanger` + `nzPageSizeOptions=[10,20,50,100]` (mặc định 10, ≤100 khớp clamp `PagedRequest`) + `nzScroll.y` (`calc(100vh - 330px)`: header cột dính, thân cuộn) + directive mới **`appTableDragScroll`** (kéo "grab" trên header/thân để cuộn ngang xem hết cột thay thanh cuộn mỏng; guard phần tử tương tác + nuốt click sau khi kéo để không mở nhầm chi tiết). Hằng dùng chung `shared/table.ts`. Build FE sạch. — `client/src/app/layout/shell.ts`, `client/src/styles.scss`, `client/src/app/shared/{table.ts,table-drag-scroll.directive.ts}`, `client/src/app/features/{students/students,teachers/teachers,classes/classes,tuition/tuition,admin/users}.page.ts`, `ARCHITECTURE.md`.
- **2026-06-26** — **Lịch học: bộ lọc theo role + view Ngày (Cơ sở → Ca) + lịch học viên** (xem §15.12): thêm view **Ngày** mặc định nhóm **Cơ sở → Ca → lớp** (giữ Tuần/Tháng); bộ lọc `branchId/subjectId/gradeId/teacherProfileId` ở `GET /api/schedule` (Admin đủ lọc, GV auto-scope + bỏ qua filter GV); khái niệm **"Ca" cấu hình theo cơ sở** lưu Settings `Schedule.Shifts` (`{default, byBranch}`, **0 migration**) + helper thuần `ShiftResolver` (xếp Ca theo giờ bắt đầu, fail-safe); làm giàu `CalendarSessionDto` (teacher/branch/subject/grade + shiftName/shiftOrder, vẫn 1 join). **Lịch học viên** qua `GET /api/portal/schedule` (`PortalService.GetScheduleRangeAsync`, scope theo enrollment active, không động `ClassAccessGuard`) + card "Lịch của tôi" (Ngày/Tuần) ở Portal. Màn Cấu hình thêm mục **"Khung Ca học"** (default + override theo cơ sở). **Phòng & Online: chỉ tài liệu hóa thiết kế** cho tương lai (không đổi schema). `DbSeeder` seed `Schedule.Shifts` (idempotent, `DataType=Json`). Build BE/FE sạch (0 lỗi). — `server/src/HungSilver.Application/{Schedule/{ScheduleDtos,IScheduleService,ShiftResolver},Settings/SettingKeys,Portal/IPortalService}.cs`, `server/src/HungSilver.Infrastructure/{Schedule/ScheduleService,Portal/PortalService,Persistence/DbSeeder}.cs`, `server/src/HungSilver.WebApi/Controllers/{Schedule,Portal}Controller.cs`, `client/src/app/core/{models,schedule.service,portal.service}.ts`, `client/src/app/features/{schedule/schedule.page,portal/portal.page,settings/settings.page}.ts`, `ARCHITECTURE.md`.
- **2026-06-25** — **Mỗi HS/GV một tài khoản — gom vòng đời tài khoản về một cơ chế** (xem §15.11): thêm `IAccountProvisioningService`/`AccountProvisioningService` làm nguồn sự thật duy nhất (cấp/cấp hàng loạt/đặt lại MK/khóa-mở/gỡ-liên kết); **tên đăng nhập = mã** (StudentCode/TeacherCode); mật khẩu mặc định cấu hình (`Account.DefaultPassword`) + cờ `AppUser.MustChangePassword` **buộc đổi lần đầu** (guard FE `/must-change-password`); email ảo 1 quy tắc (`Account.LocalEmailDomain`). Partial unique index `Student.UserId` (đồng bộ TeacherProfile) + cột `MustChangePassword` — migration `AddAccountProvisioning`. Refactor `StudentAccountService`/`TeacherService`/`StudentImportService`/`StudentService.LinkUserAsync` gọi service chung; `UserAdminService` chỉ tạo Admin. DTO HS/GV/roster thêm `UserName`/`IsLocked`/`MustChangePassword`; FE trang Học viên & Giáo viên thêm cột Tài khoản + modal quản lý + cấp hàng loạt; trang Người dùng chỉ tạo Admin; Settings thêm mục Tài khoản. Build BE/FE sạch, **47/47 test BE** (+4 `AccountLinkUniqueIndexTests`). — `server/src/HungSilver.Application/Accounts/*`, `server/src/HungSilver.Infrastructure/Accounts/AccountProvisioningService.cs`, `server/src/HungSilver.Infrastructure/{Identity/AppUser,Auth/AuthService,Account/ProfileService,Students/{StudentAccountService,StudentImportService},Teachers/TeacherService,Users/UserAdminService,Services/UserDirectory,Classes/ClassService,Persistence/Configurations/StudentConfigurations}.cs`, `server/src/HungSilver.Application/{Auth/AuthDtos,Students/{StudentService,StudentDtos,IStudentAccountService},Teachers/{TeacherDtos,TeacherValidators,ITeacherService},Classes/ClassDtos,Settings/SettingKeys,Abstractions/IUserDirectory}.cs`, `server/src/HungSilver.WebApi/Controllers/{Students,Teachers}Controller.cs`, migration `*AddAccountProvisioning*`, `client/src/app/{core/{models,guards,students.service,teachers.service}.ts,app.routes.ts,features/{auth/must-change-password.page,students/students.page,teachers/teachers.page,classes/class-detail.page,admin/users.page,settings/settings.page}.ts}`, `server/tests/HungSilver.UnitTests/{AccountLinkUniqueIndexTests,CurrentRelationCleanupTests}.cs`, `ARCHITECTURE.md`.
- **2026-06-25** — **Nút "Quay lại" cho trang Buổi học** (`/sessions/:id`): trang Buổi học mở được từ 2 lối vào (Lịch học `/schedule` và chi tiết Lớp học `/classes/:id` → tab Buổi học) nhưng thiếu nút back. Thêm nút `Quay lại` (icon `arrow-left`, `class="back"` đồng bộ các trang chi tiết khác) gọi `goBack()` dùng `Location.back()` để về đúng trang trước đó; fallback `router.navigate(['/schedule'])` khi không có lịch sử (mở trực tiếp/refresh). Chỉ sửa FE 1 file. — `client/src/app/features/sessions/session.page.ts`, `ARCHITECTURE.md`.
- **2026-06-24** — **Mã giáo viên theo cơ sở + mã học viên ở Học phí** (xem §15.10): `TeacherProfile` thêm `BranchId` (cơ sở tạo mã), `Branch` thêm `TeacherCodePrefix`; `NextTeacherCodeAsync` lấy prefix theo cơ sở (trống → `PascalCompact(tên)+"@"`), `GenerateTeacherCode` bỏ dấu `-` ⇒ mã `DongTho@TrangNTT0`; mã giữ nguyên hoa/thường, kiểm trùng case-insensitive; đường tạo qua module Người dùng giữ `GV{base36}`. Trang Cấu hình thêm mục "Tiền tố mã giáo viên theo cơ sở"; form GV thêm chọn Cơ sở. `TuitionInvoiceDto` thêm `StudentCode`, bảng `/tuition` thêm cột "Mã HV". Migration `TeacherBranchAndCodePrefix` (0 FK). Build BE/FE sạch, **43/43 test BE** (+ `NameCodeGeneratorTests`). — `server/src/HungSilver.Domain/{Entities/{Branch,TeacherProfile}.cs,Common/NameCodeGenerator.cs}`, `server/src/HungSilver.Infrastructure/{Teachers/TeacherService.cs,Tuition/TuitionService.cs,Persistence/Configurations/ClassConfigurations.cs,Migrations/*TeacherBranchAndCodePrefix*}`, `server/src/HungSilver.Application/{Teachers/TeacherDtos.cs,Branches/{BranchDtos,BranchService,BranchValidators}.cs,Tuition/TuitionDtos.cs,Settings/SettingKeys.cs}`, `client/src/app/{core/models.ts,features/{teachers/teachers.page,settings/settings.page,tuition/tuition.page,classes/classes.page}.ts}`, `server/tests/HungSilver.UnitTests/NameCodeGeneratorTests.cs`, `ARCHITECTURE.md`.
- **2026-06-24** — **Cho phép xóa lớp kể cả khi còn học sinh đang học**: bỏ chặn `Conflict "Class.HasStudents"` trong `ClassService.DeleteAsync`; thay bằng `ICurrentRelationCleanupService.SoftDeleteActiveEnrollmentsForClassAsync` rút sạch **mọi** enrollment active của lớp (`IsActive=false`/`WithdrawnOn`, đối xứng với rút theo học sinh) rồi mới dọn quan hệ hiện hành + soft-delete lớp ⇒ không còn enrollment active mồ côi. Gỡ 2 method nay dư thừa (`SoftDeleteInvalidActiveEnrollmentsForClassAsync`, `HasValidActiveEnrollmentsForClassAsync`). Thêm test `DeleteClass_WithActiveValidStudents_SucceedsAndWithdrawsEnrollments`. — `server/src/HungSilver.Application/Common/ICurrentRelationCleanupService.cs`, `server/src/HungSilver.Infrastructure/Common/CurrentRelationCleanupService.cs`, `server/src/HungSilver.Infrastructure/Classes/ClassService.cs`, `server/tests/HungSilver.UnitTests/CurrentRelationCleanupTests.cs`, `ARCHITECTURE.md`.
- **2026-06-24** — **Nâng cấp Lớp học + tiện ích danh sách dùng chung + gỡ Products** (xem §15.6, §9): import Excel lớp thêm cột **Học phí** (đọc giá trị) + **chống trùng tên lớp theo cơ sở** (preview báo đỏ, chọn "dùng lớp đã có"/đổi tên; commit enforce); danh sách lớp hiện **sĩ số**; chi tiết lớp thêm nút **Sửa lớp** (tách `class-form-modal` dùng chung). Thêm `shared/column-settings.ts` (**Chỉnh sửa cột** kéo-thả ẩn/hiện + thứ tự, lưu localStorage, `@angular/cdk/drag-drop`) + **lọc theo nút Tìm kiếm** (bỏ gọi API on-change) cho 5 màn (Học viên/Giáo viên/Lớp học/Học phí/Quản lý người dùng). **Gỡ sạch module demo Products** (entity/DbSet/service/controller/FE/route + migration `RemoveProductsDemo` idempotent `DROP TABLE IF EXISTS`; test Repository chuyển sang entity `Branch`). Build BE/FE sạch, **36/36 test BE** + FE test xanh. — `server/src/HungSilver.Infrastructure/Classes/ClassImportService.cs`, `server/src/HungSilver.Application/Classes/ClassImportDtos.cs`, `server/src/HungSilver.Infrastructure/Migrations/*RemoveProductsDemo*`, `client/src/app/shared/column-settings.ts`, `client/src/app/features/classes/{classes.page,class-detail.page,class-form-modal}.ts`, `client/src/app/features/{students,teachers,tuition,admin}/*.page.ts`, `client/package.json`, `ARCHITECTURE.md`.
- **2026-06-24** — **Chuẩn hóa thứ tự lấy dữ liệu: mặc định "mới nhất lên đầu"**: `Repository<T>.FindAsync` nay mặc định `OrderByDescending(CreatedAt)` (đồng bộ `GetPagedAsync`) ⇒ mọi list lấy qua repo generic đều tất định, mới nhất trước; caller cần thứ tự khác (danh mục theo `IndexOrder`, học liệu theo CreatedAt) vẫn re-sort sau nên không đổi hành vi. `EvaluationService.GetByClassMonthAsync` (lưới đánh giá lớp/tháng, trước đây không sắp) sắp theo **tên học sinh** (đồng nhất roster). **Giữ nguyên** các thứ tự nghiệp vụ có chủ đích (lịch theo ngày/giờ, roster theo tên, học phí theo hạn, sổ điểm/portal theo thời gian, đánh giá-theo-HS theo kỳ) và thứ tự thủ công `IndexOrder` của bảng danh mục. Thêm test `FindAsync_ReturnsNewestCreatedFirst`. — `server/src/HungSilver.Infrastructure/{Persistence/Repositories/Repository,Evaluations/EvaluationService}.cs`, `server/tests/HungSilver.UnitTests/RepositorySoftDeleteTests.cs`, `ARCHITECTURE.md`.
- **2026-06-21** — **Chuẩn hóa cleanup quan hệ hiện hành khi soft-delete parent**: thêm `ICurrentRelationCleanupService`/`CurrentRelationCleanupService`; xóa học sinh soft-delete mọi `Enrollment` active liên quan (`IsActive=false`, `WithdrawnOn`), xóa lớp tự dọn enrollment active mồ côi rồi chỉ chặn nếu còn học sinh sống đang học; sĩ số/roster/giao bài/học phí/thông báo/dashboard/cảnh báo dùng query enrollment hợp lệ thay vì count thô. Xóa user unlink `Student.UserId`/`TeacherProfile.UserId` và vẫn revoke refresh token; xóa học liệu null `Assignment.MaterialId`; xóa danh mục học liệu còn được dùng trả `Conflict`. Không thêm FK/migration, giữ lịch sử phát sinh. **27/27 test BE** (+5 test mới `CurrentRelationCleanupTests`). — `server/src/HungSilver.Application/Common/ICurrentRelationCleanupService.cs`, `server/src/HungSilver.Infrastructure/Common/CurrentRelationCleanupService.cs`, `server/src/HungSilver.{Application,Infrastructure}/**/*Service.cs`, `server/tests/HungSilver.UnitTests/CurrentRelationCleanupTests.cs`, `ARCHITECTURE.md`.

- **2026-06-21** — **Redesign đúng logic mới cho Lớp học/Giáo viên/Học viên/Học phí**: thêm `GradeCategory` seed `Mầm non, 1..12, Khác`; thêm `TeacherProfile` và luồng liên kết 1-1 tài khoản role Teacher; `ClassRoom` chuyển sang `ClassCode`, `TeacherProfileId`, snapshot tên giáo viên/môn/khối/cơ sở và `TuitionFee`; `Student` thêm `Email/Note`, bỏ logic `EntryScore` khỏi luồng mới; học phí quản lý theo học viên với bill từ các lớp đang học, giảm giá/đã đóng/còn thiếu; import Excel lớp+học viên có template sheet phụ, preview 2 cột và commit preview đã chỉnh sửa. FE làm lại `/classes`, thêm `/teachers`, làm lại `/students` và `/tuition` theo ng-zorro. — `server/src/HungSilver.Domain/Entities/{GradeCategory,TeacherProfile,ClassRoom,Student,TuitionInvoice}.cs`, `server/src/HungSilver.Application/{Classes,Grades,Students,Teachers,Tuition}`, `server/src/HungSilver.Infrastructure/{Classes,Grades,Students,Teachers,Tuition,Persistence}`, `server/src/HungSilver.WebApi/Controllers/{Classes,Grades,Students,Teachers,Tuition}Controller.cs`, `client/src/app/{core,features/{classes,teachers,students,tuition},layout,app.routes.ts}`, `ARCHITECTURE.md`.
- **2026-06-21** — **Mở quyền Teacher toàn quyền CRUD nghiệp vụ vận hành**: `TeacherOrAdmin` được tạo/sửa/xóa/khôi phục lớp, học viên, học phí, khung lịch, sinh buổi, môn, cơ sở, danh mục học liệu, import lớp/học viên; `ClassAccessGuard` đổi semantics để Admin/Teacher cùng truy cập toàn bộ dữ liệu vận hành thay vì Teacher chỉ lớp mình. Giữ `AdminOnly` cho cấu hình/tài khoản quan trọng: ghi/xem raw Settings, tạo/gán role/xóa/khôi phục user, liên kết tài khoản học sinh. FE mở các nút CRUD tương ứng cho Teacher, nhưng vẫn giấu màn người dùng/cấu hình và khối liên kết tài khoản HS. — `server/src/HungSilver.Application/Common/{ClassAccessGuard,IClassAccessGuard}.cs`, `server/src/HungSilver.WebApi/Controllers/{Classes,Students,Tuition,Schedule,Subjects,MaterialCategories,Branches,Users,Settings}Controller.cs`, `client/src/app/features/{classes,students,tuition,materials}/*.page.ts`, `ARCHITECTURE.md`.
- **2026-06-20** — **Hoàn tất các mục hoãn của đợt rà soát (B4, B7, C4)**: (**B4**) **partial unique index** `Enrollment(StudentId, ClassId)` lọc `WHERE "IsActive" AND NOT "IsDeleted"` (migration `AddEnrollmentActiveUniqueIndex`) — DB chặn ghi danh trùng đang hiệu lực, vẫn cho ghi danh lại sau khi rút/xóa mềm; filter cú pháp chung hợp lệ cả Postgres lẫn SQLite (`EnsureCreated` test không vỡ); `ClassService.EnrollAsync` bắt `DbUpdateException` → trả `Conflict` thân thiện (lưới an toàn cho đua check-then-insert). (**B7**) **chống user-enumeration qua kênh thời gian** ở `AuthService.LoginAsync`: khi không tìm thấy tài khoản vẫn băm 1 mật khẩu "mồi" (`DummyPasswordHash`) để thời gian phản hồi không tiết lộ username tồn tại hay không (message sai-thông-tin vốn đã đồng nhất; **giữ** message khóa tài khoản vì giá trị UX cao). (**C4**) helper dùng chung `core/date-util.ts` (`toDateOnly`/`toDateOnlyOrNull`/`toTimeOnly`) chuẩn hóa format `yyyy-MM-dd`/`HH:mm:ss` theo **giờ địa phương**, thay 5 hàm `iso/toIso/toIsoDate/time` trùng lặp ở `students|classes|class-detail|tuition|schedule`. Build BE/FE sạch; **22/22 test BE** (+3 test `EnrollmentUniqueIndexTests`) + FE test xanh. — `server/src/HungSilver.Infrastructure/{Persistence/Configurations/StudentConfigurations,Classes/ClassService,Auth/AuthService}.cs`, `server/src/HungSilver.Infrastructure/Migrations/*AddEnrollmentActiveUniqueIndex*`, `server/tests/HungSilver.UnitTests/EnrollmentUniqueIndexTests.cs`, `client/src/app/core/date-util.ts`, `client/src/app/features/{students,classes,tuition,schedule}/*.page.ts`, `ARCHITECTURE.md`.
- **2026-06-20** — **Rà soát & sửa bug tồn đọng (audit toàn module)**: (**A1**) bỏ `DateOnly.FromDateTime(...)` trong predicate EF `Where` (Npgsql không dịch được → vỡ trên Postgres, SQLite test che mất) — lọc theo khoảng `DateTime` ở `EvaluationService` (Bảng vàng tuần) & `ParentReportService` (điểm thưởng tháng). (**A2**) Import học viên Excel: gộp `Add(Student)+Add(Enrollment)` rồi `SaveChanges` **một lần**/dòng (Id `BaseEntity` sinh sẵn), tạo tài khoản best-effort tách riêng ⇒ không còn HS mồ côi/đếm sai. (**A3**) Sinh báo cáo **idempotent** (upsert theo khóa logic) ở `SessionReportService` (buổi+loại) & `ParentReportService` (HS+năm+tháng) — bấm "Tạo lại" không nhân bản. (**A4**) Cảnh báo "3 buổi liên tiếp" xét theo **(HS, lớp)**, bỏ buổi `Cancelled`, mỗi HS cảnh báo 1 lần. (**A5**) Đổi mật khẩu (`ProfileService.ChangePasswordAsync`) **thu hồi mọi refresh token** đang hoạt động. (**A6**) `LinkUserAsync` chặn 1 tài khoản liên kết >1 HS (`Conflict`). (**A7**) `INotificationDispatcher.DispatchAsync` trả `DispatchOutcome(Status, Error)` → lưu `ErrorMessage` khi Email lỗi. (**A8**) `auth.interceptor` chỉ đăng xuất khi **bản thân refresh lỗi** (catch refresh tách trước `switchMap`), không đá về `/login` khi request retry gặp 5xx. (**B1**) phát hiện tái dùng refresh token đã thu hồi → thu hồi cả "họ" token (token-theft). (**B2**) validate `ClassId` tồn tại khi tạo hóa đơn học phí. (**B3**) thêm guard phòng thủ chiều sâu (`EnsureCanAccess*Async`) cho thao tác ghi `StudentService`/`ClassService` (vẫn AdminOnly). (**B5**) chống đua check-then-insert `Submission(AssignmentId, StudentId)` ở `AssignmentService.SetStatusAsync` & `PortalService.SubmitAssignmentAsync` (bắt `DbUpdateException` → reload-update). (**B6**) `LocalDiskFileStorage.ResolvePath` rào path-traversal (path phải nằm trong root). (**C1**) `materials.page` `customUpload` trả subscription thật; (**C2**) `portal.page` nộp bài dùng `switchMap` thay nested subscribe; (**C3**) `dashboard.page` dùng `forkJoin`. Build BE/FE sạch; **19/19 test BE** (+4 test mới `ReportAndWarningsTests`: A3 idempotent, A4 per-class/cancelled) + FE test xanh. _B4 (unique index lọc cho `Enrollment`) & B7 (chống enumeration đăng nhập) ban đầu hoãn, đã hoàn tất ở mục changelog kế trên._ — `server/src/HungSilver.Infrastructure/{Evaluations,Reports,Students,Warnings,Account,Notifications,Classes,Assignments,Portal,Tuition,Auth,Storage}/*`, `server/src/HungSilver.Application/{Students/StudentService,Abstractions/INotificationSender}.cs`, `server/tests/HungSilver.UnitTests/ReportAndWarningsTests.cs`, `client/src/app/core/auth.interceptor.ts`, `client/src/app/features/{materials,portal,dashboard}/*.page.ts`, `ARCHITECTURE.md`.
- **2026-06-20** — **GC file rác (orphan file)** (xem §15.3): `FileCleanupService` thêm pha "mark" `ReconcileOrphansCoreAsync` — định kỳ dò `StoredFile` đang sống mà không còn ai tham chiếu (gom `LearningMaterial.StoredFileId` + Guid trong `AppUser.AvatarUrl`, dùng `IgnoreQueryFilters` để bảo thủ với bản ghi đã xóa mềm) và đã quá hạn ân hạn `OrphanGracePeriodHours` (mặc định **24h**) → đánh dấu xóa mềm; pha "sweep" 30-ngày sẵn có xóa vật lý. Bắt cả file upload bị bỏ rơi lẫn file cũ bị thay (đổi avatar/đổi `StoredFileId`). Thêm option `FileStorageOptions.OrphanGracePeriodHours` + appsettings. Logic tách static để test được; 5 unit test (orphan quá hạn bị đánh dấu, file còn tham chiếu/còn trong ân hạn/được bản ghi đã xóa mềm trỏ tới → giữ lại). Không sửa service nghiệp vụ, không thêm endpoint/UI. — `server/src/HungSilver.Infrastructure/Storage/{FileCleanupService,FileStorageOptions}.cs`, `server/src/HungSilver.WebApi/appsettings.json`, `server/tests/HungSilver.UnitTests/FileCleanupReconcileTests.cs`, `ARCHITECTURE.md`.
- **2026-06-19** — **Hạ tầng deploy HTTPS cho VPS** (xem §12): thêm `docker-compose.https.yml` (build tại VPS, full stack postgres+api+client+**Caddy**) + `Caddyfile` — Caddy reverse proxy về `client:80`; client bỏ publish cổng host; thêm env `Cors__Origins__0=https://h-edutech.io.vn` + `TZ=Asia/Ho_Chi_Minh`; `server/Dockerfile` thêm `tzdata`. **Domain sau Cloudflare proxy** ⇒ dùng **Cloudflare Origin Certificate** (mount `./certs`, ignore `certs/`+`*.pem`) + SSL Full (strict), thay cho Let's Encrypt. Không đổi code BE/FE. — `docker-compose.https.yml`, `Caddyfile`, `server/Dockerfile`, `.gitignore`, `ARCHITECTURE.md`.
- **2026-06-18** — **Hoàn thiện & hardening module upload file** (xem §15.3): mở quyền upload cho **mọi user đã đăng nhập** (`FilesController` `TeacherOrAdmin`→`[Authorize]`); allowlist **phần mở rộng** + validate **magic-byte** (`FileSignatureValidator`); **hạn mức/user** + **rate-limit** 30/phút (`AddRateLimiter` policy `upload`); **dedup SHA-256** + cột `StoredFile.Sha256`/`Visibility` (migration `AddStoredFileHardening`, backfill `Visibility=Public` giữ hành vi ảnh đại diện); **tải xuống phân tầng** (Public/Authenticated/Restricted) + ETag/Cache-Control/nosniff/304; **dọn file vật lý** quá hạn (`FileCleanupService`); fallback `SettingKeys` mode=`Server`. **Hạ tầng VPS:** volume `hungsilver_uploads:/app/uploads` (sửa mất file khi deploy) + `client_max_body_size 25m` ở nginx (sửa 413). FE: `files.service` thêm hằng `ACCEPT_ATTR`/`MAX_UPLOAD_BYTES`/`validate()` + `download()` (blob, kèm Bearer); enum `FileVisibility`. Build BE/FE sạch. — `server/src/**` (`Domain/{Entities/StoredFile,Enums/StoredFileEnums}`, `Application/Files/IFileService`, `Infrastructure/Storage/{FileService,FileSignatureValidator,FileCleanupService,FileStorageOptions}`, `Controllers/FilesController`, `Program.cs`, migration), `client/src/app/core/{files.service,models}.ts`, `docker-compose*.yml`, `client/nginx.conf`, `appsettings.json`, `ARCHITECTURE.md`.
- **2026-06-18** — **Fix web Đợt 7** (xem §15.8): entity `Subject` (Môn, Admin CRUD, 0 FK) + `ClassRoom.SubjectId/GradeBand` + `LearningMaterial.GradeBand` (migration `AddSubjectAndClassTaxonomy`); Khối = danh sách chuẩn ở Settings `Class.GradeBands`. FE trang Lớp học điều hướng **Môn → Khối → Lớp** (query param + breadcrumb) + quản lý Môn + chọn Môn/Khối khi tạo lớp. **Import danh sách LỚP từ Excel** (`ClassImportService`, endpoints `/api/classes/import-classes*`). **GV xem lịch lớp mình** (mở route `/schedule` cho Teacher + menu). **Gộp cảnh báo** vào chi tiết Lớp (`?classId=`) & Học sinh (`?studentId=`, thêm filter ở `WarningsService`) — giữ trang `/warnings` tổng. Học liệu lọc/gắn theo Khối. Build BE/FE sạch, 10/10 test BE + FE test xanh. — `server/src/**` (`Domain/Entities/{Subject,ClassRoom,LearningMaterial}`, `Application/{Subjects,Classes,Materials,Settings,Warnings}`, `Infrastructure/{Classes/ClassImportService,Warnings,Classes/ClassService}`, `Controllers/{Subjects,Classes,Materials,Warnings}`, migration), `client/src/app/**` (`core/{models,classes,subjects,warnings,materials,settings}.service`, `features/{classes,students/student-detail,materials,schedule,settings}`, `layout/shell`, `app.routes`), `ARCHITECTURE.md`.
- **2026-06-13** — Khởi tạo tài liệu kiến trúc từ commit gốc `481dc3e`. Phản ánh trạng thái base: Auth (JWT + refresh rotation + Google), Products CRUD + soft delete, Users admin, CI/CD GHCR→VPS. — `ARCHITECTURE.md`.
- **2026-06-14** — Thêm quy ước bắt buộc: FE phải dùng ng-zorro-antd cho mọi UI (không HTML/CSS thuần, không thư viện UI khác); ghi rõ ở §14 (công thức task mới + Quy ước). — `ARCHITECTURE.md`, `CLAUDE.md`.
- **2026-06-14** — **Giai đoạn 1 hệ thống quản lý trung tâm tiếng Anh** (xem §15): 20 entity nghiệp vụ **không FK** + migration `AddTeachingDomain`; role `Teacher` + policy `TeacherOrAdmin` + phân quyền theo lớp; cấu hình phân tầng (Settings) + upload 2 chế độ (`IFileStorage`); AutoMapper 14.x (enum serialize string); Email scaffold (MailKit), Zalo/Messenger stub; FE: dashboard/students/classes/schedule/sessions/settings + ECharts + nav responsive. — `server/src/**`, `client/src/app/**`, `ARCHITECTURE.md`.
- **2026-06-14** — **Giai đoạn 2** (xem §15.7): Học phí, Kho tài liệu, Đánh giá tháng + Bảng vàng, Báo cáo phụ huynh, Thông báo (Email thật + Zalo/Messenger Manual), Cảnh báo, Portal học sinh (role User) + liên kết tài khoản. Build BE/FE sạch, 10/10 test, smoke test API PASS. — `server/src/**` (`Tuition/Materials/Evaluations/Reports/Notifications/Warnings/Portal`), `client/src/app/features/**`, `ARCHITECTURE.md`.
- **2026-06-15** — Thêm tài liệu hướng dẫn sử dụng cho người dùng cuối (mô tả chức năng theo màn hình + luồng công việc theo vai trò). — `docs/HUONG-DAN-SU-DUNG.md`.
- **2026-06-18** — Tạm comment auto-trigger (`push`/`pull_request`) của `ci.yml` & `cd.yml`, giữ `workflow_dispatch` để tránh mail thông báo của GitHub; build/deploy tay. — `.github/workflows/ci.yml`, `.github/workflows/cd.yml`, `ARCHITECTURE.md`.
- **2026-06-15** — **Fix web Đợt 6** (import Excel học viên): gói **ClosedXML** + `IStudentImportService` (đọc .xlsx → validate từng dòng → xem trước → tạo HS + ghi danh + tùy chọn tạo tài khoản HS role User). Endpoints `GET /api/classes/import-template`, `POST /api/classes/{id}/import-students/preview`, `POST /api/classes/{id}/import-students` (AdminOnly). FE: nút "Nhập Excel" trong chi tiết lớp → tải mẫu → chọn file → bảng xem trước (đánh dấu dòng lỗi) → xác nhận. Không cần migration. — `server/.../Students/StudentImportService.cs`, `server/.../Controllers/ClassesController.cs`, `client/.../features/classes/class-detail.page.ts`.
- **2026-06-15** — **Fix web Đợt 4** (giao bài & nộp bài 2 chiều): entity `Assignment` (gắn `MaterialId` + `ClassSessionId` + `DueDate`) + `Submission` (enum `SubmissionStatus` ChưaNộp/ĐãNộp/Muộn, tự tính "Muộn" theo hạn) — migration `AddAssignments`. Endpoints `/api/assignments` (CRUD + `/{id}/submissions` GET/PUT theo HS, TeacherOrAdmin) + Portal HS `/api/portal/assignments` GET, `POST /{id}/submit`. FE: chi tiết lớp có thẻ **Bài tập** (giao bài chọn học liệu + hạn, xem & chỉnh trạng thái nộp); Portal HS nộp bài (đánh dấu + link). — `server/.../{Assignments,Portal}/*`, `server/.../Entities/{Assignment,Submission}.cs`, `client/.../features/{classes/class-detail,portal/portal}.page.ts`.
- **2026-06-15** — **Fix web Đợt 3** (thư viện học liệu): entity `MaterialCategory` (admin tự định nghĩa) + `LearningMaterial.ClassId` thành **nullable** + thêm `CategoryId` (migration `AddMaterialLibrary`). Học liệu có thể thuộc lớp HOẶC thư viện chung theo danh mục. Endpoints: `GET /api/materials/library?categoryId&type`, CRUD `/api/material-categories` (đọc TeacherOrAdmin, ghi AdminOnly). FE Học liệu thêm chế độ **Thư viện** + lọc danh mục/loại + quản lý danh mục. — `server/.../Materials/*`, `server/.../Entities/{LearningMaterial,MaterialCategory}.cs`, `client/.../features/materials/materials.page.ts`.
- **2026-06-15** — **Fix web Đợt 2 + Đợt 5**: Lịch học — bấm 1 ngày mở drawer liệt kê mọi buổi trong ngày + nút "Tạo buổi học tại ngày" (modal chọn lớp/giờ/chủ đề, dùng `POST /schedule/sessions`). Điểm thưởng/phạt — nút bấm nhanh theo **lý do cấu hình sẵn** trên bảng buổi học (1 chạm = cộng/trừ ngay); lý do lưu ở Settings (`Points.RewardReasons`/`Points.PenaltyReasons`, không cần đổi backend nhờ `GetEffectiveAllAsync` trả mọi key). — `client/src/app/features/{schedule/schedule.page.ts,sessions/session.page.ts,settings/settings.page.ts}`.
- **2026-06-15** — **Fix web Đợt 1** (xem `docs/ROADMAP-fix-web.md`): menu FE giáo viên thu gọn còn **Lớp học + Học liệu** (route `dashboard/students/schedule/tuition/notifications/warnings` → AdminOnly; `roleGuard` đưa GV về `/classes`); chi tiết lớp hiển thị **tình hình học tập từng HS** (điểm thưởng/phạt + chuyên cần + BTVN) qua endpoint mới `GET /api/classes/{id}/overview` (`ClassStudentOverviewDto`); thêm lối "Đánh giá tháng" trong chi tiết lớp. — `server/.../Classes/*`, `client/src/app/{layout/shell.ts,core/guards.ts,app.routes.ts,features/classes/class-detail.page.ts}`.
- **2026-06-15** — **Redesign giao diện "Indigo học thuật"** (xem §9): theme ng-zorro qua CSS-variable build + `provideNzConfig`; design system token `--hs-*` (light + **dark mode** lưu localStorage); font Be Vietnam Pro; **sidebar sáng** + brand + nút dark mode; **Login/Register split-screen**; shared `page-header`/`stat-card` áp cho toàn bộ trang; màu chart khớp palette. Build prod + test xanh. — `client/angular.json`, `client/src/index.html`, `client/src/app/{app.config.ts,layout/shell.ts,core/theme.service.ts,shared/*,features/**}`, `client/src/styles.scss`, `ARCHITECTURE.md`.
- **2026-06-16** — **Chuẩn hóa tài khoản/phân quyền cho vận hành thật** (không migration mới): (1) **Đăng nhập bằng username** — `LoginAsync` tìm `FindByNameAsync` rồi fallback email; bỏ ràng buộc email ở `LoginRequestValidator`; token chịu được Email null (`Email ?? UserName`). (2) **Khóa đăng ký** qua cờ `AuthFeatureOptions.AllowRegistration=false` (section `Auth`) — `RegisterAsync` + Google tự-tạo-tài-khoản trả `Forbidden`; FE bỏ route `/register`, login bỏ link Đăng ký + nút Google. (3) **Admin tạo tài khoản Admin/Giáo viên** — `POST /api/users` (`CreateUserRequest`, AdminOnly) + UI modal trong `admin/users`. (4) **Giáo viên tạo học sinh + tài khoản theo lớp** — `POST /api/classes/{id}/students` (`IStudentAccountService`, TeacherOrAdmin + class guard) + UI trong chi tiết lớp; **đổi mật khẩu HS** `PUT /api/students/{id}/password` (guard `EnsureCanAccessStudentAsync`). (5) **Trang cá nhân** `/profile` — upload **ảnh đại diện** (`POST /api/profile/avatar`, lưu server bỏ qua FileStorage.Mode) + **tự đổi mật khẩu** (`PUT /api/profile/password`); `FilesController.Download` thêm `[AllowAnonymous]` để `<img>`/avatar tải được (id là GUID; upload vẫn cần quyền). (6) **Seed sạch dùng thật** — `DbSeeder` chỉ tạo 1 admin (`admin`/`admin@gmail.com`/`Admin@1a`) + Settings (`FileStorage.Mode=Server`), bỏ toàn bộ demo (GV/Products/lớp/HS). Build BE/FE sạch. — `server/src/**` (`Auth`, `Users`, `Account`, `Students/StudentAccountService`, `Controllers/{Users,Classes,Students,Profile,Files}`, `Persistence/DbSeeder`), `client/src/app/**` (`core/{auth,users,classes,students,profile}.service`, `features/{auth/login,admin/users,classes/class-detail,profile}`, `layout/shell`, `app.routes`), `ARCHITECTURE.md`.
- **2026-06-17** — Đổi **mật khẩu admin mặc định** khi seed: `Admin@1a` → `Admin@a1` (chỉ áp dụng cho DB seed mới; DB đã có admin thì seeder không ghi đè — phải reset thủ công). — `server/src/HungSilver.WebApi/appsettings.json`, `server/src/HungSilver.Infrastructure/Auth/AuthOptions.cs`, `ARCHITECTURE.md`.
- **2026-06-17** — **Bỏ tự tạo tài khoản admin khi khởi động.** `DbSeeder` chỉ còn seed role + settings; admin tạo **thủ công bằng SQL** (`server/scripts/create-admin.sql` — idempotent, hash PBKDF2 của `Admin@a1`). Gỡ `SeedOptions` (class + đăng ký DI + section `Seed` trong appsettings) và biến `Seed__Admin*`/`ADMIN_*` rác trong `docker-compose*.yml` + `.env.example`. Build BE sạch. — `server/src/HungSilver.Infrastructure/{Persistence/DbSeeder,Auth/AuthOptions,DependencyInjection}.cs`, `server/src/HungSilver.WebApi/appsettings.json`, `server/scripts/create-admin.sql`, `docker-compose.yml`, `docker-compose.prod.yml`, `.env.example`, `ARCHITECTURE.md`.
- **2026-06-17** — **Gỡ `create-admin.sql` khỏi git** (`git rm --cached` + `.gitignore`) để không lộ tài khoản admin trên repo — file giữ local, chạy tay trên VPS. Thêm `server/scripts/reset-db.sql` (xóa sạch DB: `DROP SCHEMA public CASCADE`). Lịch sử cũ giữ nguyên (không force-push) ⇒ đổi mật khẩu admin sau lần đăng nhập đầu. — `.gitignore`, `server/scripts/reset-db.sql`, `ARCHITECTURE.md`.
- **2026-06-17** — **(TẠM THỜI) seed lại admin khi khởi chạy đầu** để bootstrap sau khi wipe DB: `DbSeeder` tạo `admin`/`Admin@a1` (hardcode, chỉ khi chưa có). **Sẽ gỡ ở commit kế** sau khi đã tạo xong; nhớ đổi mật khẩu sau đăng nhập đầu. — `server/src/HungSilver.Infrastructure/Persistence/DbSeeder.cs`, `ARCHITECTURE.md`.
- **2026-06-17** — **Redesign trang cá nhân**: `UserDto` thêm `PhoneNumber`; `PUT /api/profile` (cập nhật họ tên + SĐT); FE inline edit họ tên/SĐT + thu gọn form đổi mật khẩu (ẩn sau nút bấm). — `server/.../Auth/AuthDtos.cs`, `server/.../Account/{IProfileService,ProfileService}.cs`, `server/.../Auth/AuthService.cs`, `server/.../Controllers/ProfileController.cs`, `client/src/app/core/{models.ts,profile.service.ts}`, `client/src/app/features/profile/profile.page.ts`, `ARCHITECTURE.md`.
- **2026-06-17** — **Dọn dẹp sau bootstrap**: gỡ khối seed admin tạm trong `DbSeeder` (về lại chỉ seed role + settings); xóa script SQL dư thừa `server/scripts/reset-db.sql` + gỡ mục `.gitignore`/ghi chú `.env.example` trỏ tới `create-admin.sql`. Admin đã tạo xong từ bước bootstrap; tạo lại thủ công khi cần. — `server/src/HungSilver.Infrastructure/Persistence/DbSeeder.cs`, `.gitignore`, `.env.example`, `ARCHITECTURE.md`.
- **2026-06-18** — **Đổi DateTime.UtcNow → DateTime.Now + Rename properties**: bỏ hậu tố `Utc` khỏi mọi property audit/timestamp (`CreatedAtUtc`→`CreatedAt`, `UpdatedAtUtc`→`UpdatedAt`, `DeletedAtUtc`→`DeletedAt`, `ExpiresAtUtc`→`ExpiresAt`, `RevokedAtUtc`→`RevokedAt`, `GeneratedAtUtc`→`GeneratedAt`, `SentAtUtc`→`SentAt`). Dùng `DateTime.Now` (giờ local) thay vì `DateTime.UtcNow`; xóa mọi hack `AddHours(7)`/`ConvertTimeFromUtc`. Thêm `Npgsql.EnableLegacyTimestampBehavior=true`. Migration `RenameUtcColumns` rename cột DB. — `server/src/**` (Domain, Application, Infrastructure, WebApi), `client/src/app/core/models.ts`, `ARCHITECTURE.md`.
- **2026-06-20** — **Avatar crop modal (Facebook-style)**: FE thêm `ngx-image-cropper` + component `AvatarCropModal` (shared) — chọn ảnh → modal crop hình tròn + zoom slider → upload blob đã crop. Không đổi backend. — `client/package.json`, `client/src/app/shared/avatar-crop-modal.ts`, `client/src/app/features/profile/profile.page.ts`.
- **2026-06-20** — **Thiết kế lại trang cá nhân + badge camera đổi avatar tại chỗ**: bố cục mới 1 cột gọn (`max-width:720px`) gồm **hero** (avatar + tên + email + role) → **Thông tin cá nhân** (danh sách `label·value`, inline edit) → **Bảo mật**. Nút đổi avatar chuyển thành **badge camera kiểu Facebook** gắn ở góc avatar (toàn vùng avatar click được qua `nz-upload` + overlay hover + spinner khi tải); tái dùng nguyên luồng crop/căn chỉnh + upload sẵn có (không đổi API/service). Crop modal: thêm hint "kéo để di chuyển", nền `--hs-surface-2` (an toàn dark mode), reset zoom 100% khi chọn ảnh mới (`effect`). Đăng ký icon `camera`/`loading`. Responsive 375px. Build FE sạch. — `client/src/app/features/profile/profile.page.ts`, `client/src/app/shared/avatar-crop-modal.ts`, `client/src/app/app.config.ts`, `ARCHITECTURE.md`.
- **2026-06-18** — **API Response Wrapper toàn cục**: mọi response MVC bọc trong `ApiResponse<T>` (`data, isSuccess, message, statusCode`) qua `ApiResponseWrapperFilter` (IResultFilter). `GlobalExceptionHandler` trả `ApiResponse.Fail` thay vì `ProblemDetails`. FE: `apiResponseInterceptor` unwrap `body.data`, error handler đổi từ `(err.error as ApiProblem)?.detail` → `err.error?.message ?? err.message`. — `server/src/HungSilver.WebApi/Common/{ApiResponse,ApiResponseWrapperFilter,GlobalExceptionHandler}.cs`, `server/src/HungSilver.WebApi/Program.cs`, `client/src/app/core/{api-response.interceptor.ts,models.ts}`, `client/src/app/app.config.ts`, `client/src/app/features/**`.
- **2026-06-23** — **Cải thiện module Cấu hình & Import Excel**: (1) **Bỏ cấu hình múi giờ** khỏi trang Settings (hệ thống cứng Asia/Ho_Chi_Minh qua TZ env); bỏ `Class.GradeBands` textarea (thay bằng GradeCategory CRUD đã có). (2) **Lý do cộng/trừ điểm → entity CRUD**: thêm `PointReason` (`Label, Points, PointReasonType, IndexOrder, IsActive`) + service + controller `/api/point-reasons` (GET TeacherOrAdmin, POST/PUT/DELETE AdminOnly) + migration `AddPointReasons`; seed 10 lý do mẫu; trang Settings hiển thị CRUD 2 danh sách Cộng/Trừ; session.page đọc từ API thay vì Settings. (3) **Import Excel lớp học**: template gộp 5 sheet lookup → 1 sheet "Danh mục" (Khối A / Môn học B / Giáo viên C / Cơ sở D / Lớp hiện có E); sheet chính đổi thành "Nhập liệu"; header màu indigo #4F46E5 + trắng (Nhập liệu) / vàng #FFFFC8 (Danh mục); cột cố định; cơ sở hiển thị chỉ tên (bỏ mã). — `server/src/HungSilver.Domain/Entities/PointReason.cs`, `server/src/HungSilver.Domain/Enums/PointEnums.cs`, `server/src/HungSilver.Application/PointReasons/`, `server/src/HungSilver.Application/{DependencyInjection,Settings/SettingKeys}.cs`, `server/src/HungSilver.Infrastructure/{Persistence/{AppDbContext,DbSeeder},Classes/ClassImportService}.cs`, `server/src/HungSilver.WebApi/Controllers/PointReasonsController.cs`, migration `AddPointReasons`, `client/src/app/core/{models,point-reasons.service}.ts`, `client/src/app/features/{settings/settings.page,sessions/session.page}.ts`, `ARCHITECTURE.md`.
- **2026-06-22** — **Nâng cấp module Lớp học** (4 nhóm): **(1) Danh mục**: đổi `SortOrder`→`IndexOrder` trên 3 entity `GradeCategory`/`Branch`/`Subject` + migration `RenameSortOrderToIndexOrder`; mã Khối/Cơ sở/Môn học tự sinh từ name-slug (`NameCodeGenerator.SlugCode`) — form FE ẩn ô nhập mã. **(2) Sinh mã theo rule khách hàng**: tạo `NameCodeGenerator` (`RemoveDiacritics` NFD + đặc biệt `đ/Đ`): học viên `2K{khối}{TEN}{VT}{n}`, giáo viên `{prefix}-{Ten}{VT}{n}` (prefix từ Setting `Center.CodePrefix`, mặc định `HV`); loop counter 0→99 kiểm trùng, fallback `UniqueCodeGenerator`. Cập nhật tất cả call-site: `StudentService`, `StudentAccountService`, `StudentImportService`, `ClassImportService`, `TeacherService`. **(3) Excel export 2 sheet**: sheet **Data** (bỏ cột mã GV, gộp cơ sở thành 1 cột) + sheet **Danh mục** (Khối/GV/Lớp/Cơ sở/Môn học, header nền vàng `#FFFFC8`). Template import: GiaoVien lookup chỉ hiện tên (bỏ mã). **(4) Chi tiết lớp 4 tab**: `nz-tabset` — Thông tin cơ bản (stat + `nz-descriptions` + cảnh báo) | Lịch học (schedule slots) | Buổi học (sessions + bài tập) | Học viên (roster + import + popup chi tiết HS 3 sub-tab: Thông tin cơ bản / Tình hình học tập / Học phí trong lớp). Build BE + FE sạch. — `server/src/HungSilver.Domain/Common/NameCodeGenerator.cs` (mới), `server/src/HungSilver.Domain/Entities/{GradeCategory,Branch,Subject}.cs`, `server/src/HungSilver.Application/{Grades,Branches,Subjects}/{*Dtos,*Service,*Validators}.cs`, `server/src/HungSilver.Application/Settings/SettingKeys.cs`, `server/src/HungSilver.Application/Students/StudentService.cs`, `server/src/HungSilver.Infrastructure/{Students/{StudentAccountService,StudentImportService},Classes/{ClassImportService,ClassService},Teachers/TeacherService,Persistence/{DbSeeder,Configurations/ClassConfigurations}}.cs`, migration `20260622080341_RenameSortOrderToIndexOrder`, `client/src/app/core/models.ts`, `client/src/app/features/classes/{classes.page,class-detail.page}.ts`.
- **2026-06-23** — **Phân quyền theo Giáo viên toàn hệ thống (đảo lại "Teacher toàn quyền" của 2026-06-21)**: hiện thực 3 method `ClassAccessGuard` (trước là stub) — `GetTeacherScopeIdAsync` tra `TeacherProfile` theo `UserId` (Admin→null, GV→Id hồ sơ, chưa liên kết→`Guid.Empty`), `EnsureCanAccessClassAsync` chặn lớp ngoài phạm vi (NotFound), `EnsureCanAccessStudentAsync` kiểm HS ghi danh active lớp của GV. Một thay đổi keystone này **tự kích hoạt scope** ở Dashboard/Tuition/Warnings/Schedule/Sessions/Materials/Students/Evaluations/Notifications (các service đã sẵn gọi guard). Vá điểm bypass: `TuitionService` CRUD theo invoiceId kiểm `EnsureCanAccessStudentAsync`; `StudentService.CreateAsync` (HS "trần") chỉ Admin; `ClassService` Create/Update **ép `TeacherProfileId`=scope**, `AssignTeacher`→Admin. Siết ghi danh mục/cấu hình về **AdminOnly** (`Subjects/Grades/Branches/Teachers` write + bulk class-import); GET giữ TeacherOrAdmin. Sửa kèm: tỉ lệ chuyên cần `BuildClassDtoAsync` đếm `Present||Late` (khớp overview); `ClassImportService.CommitAsync` bọc **transaction** + **revalidate** Branch/Subject/Grade/Teacher server-side (không tin client). FE: `classes.page` ẩn tab Danh mục/dropdown+filter GV (server gán self qua `Guid.Empty`), bảng lớp **responsive card** mobile (`ScreenService`); `students.page` ẩn nút "Thêm học viên" cho GV. **31/31 test BE** (+4 `ClassAccessGuardTests`), build BE+FE sạch. — `server/src/HungSilver.Application/Common/ClassAccessGuard.cs`, `server/src/HungSilver.Application/Students/StudentService.cs`, `server/src/HungSilver.Infrastructure/{Classes/{ClassService,ClassImportService},Tuition/TuitionService}.cs`, `server/src/HungSilver.WebApi/Controllers/{Classes,Subjects,Grades,Branches,Teachers}Controller.cs`, `client/src/app/features/{classes/classes.page,students/students.page}.ts`, `server/tests/HungSilver.UnitTests/ClassAccessGuardTests.cs`, `ARCHITECTURE.md`.
- **2026-06-23** — **Import Excel lớp: sửa trực tiếp preview trước khi import** (FE-only). Modal import chuyển 2 bảng read-only → **bảng sửa được tại chỗ** (master-detail dọc): lớp sửa Tên/Giáo viên/Môn/Khối/Cơ sở/Học phí (dropdown lấy từ **danh mục thật** đã nạp ⇒ tránh tham chiếu rác), học viên sửa Mã/Họ tên/Ngày sinh/SĐT/Ghi chú + đổi lớp đích; lớp `existingClassId` hiển thị read-only ("Lớp đã có"). `revalidateImport()` chấm hợp lệ tức thì (mirror logic server) + đếm hợp lệ/lỗi qua computed; tag lỗi có tooltip; xoá dòng/lớp (xoá lớp kéo theo HS). Commit gửi bản đã sửa; **server vẫn revalidate theo Id + transaction** (đã có) làm lưới an toàn; báo `Skipped`/`Errors` khi bỏ qua dòng lỗi. Build FE sạch. — `client/src/app/features/classes/classes.page.ts`, `ARCHITECTURE.md`.
- **2026-06-24** — **Giữ số 0 đầu trong cột SĐT khi import Excel**: template import học viên vào lớp và import lớp kèm học viên định dạng các cột `SĐT` là text (`@`) + ghi ô mẫu bằng chuỗi, tránh Excel tự chuyển sang number làm mất số `0` đầu; thêm test mở workbook thật để kiểm tra format/value. Không đổi schema/API. — `server/src/HungSilver.Infrastructure/{Students/StudentImportService.cs,Classes/ClassImportService.cs}`, `server/tests/HungSilver.UnitTests/ClassExcelStyleTests.cs`, `ARCHITECTURE.md`.
