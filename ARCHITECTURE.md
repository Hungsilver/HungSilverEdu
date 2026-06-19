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

**Patterns chủ đạo:** Result pattern (không ném exception cho luồng nghiệp vụ) · generic `Repository<T>` CRUD chung · **soft delete trên MỌI bảng** (global query filter + interceptor) · Unit of Work · Options pattern · AutoMapper. **Lưu ý:** mọi **bảng nghiệp vụ mới (§15) KHÔNG dùng khóa ngoại** — chỉ cột `Guid` + index, toàn vẹn kiểm ở tầng app (bảng nền Product/RefreshToken vẫn giữ FK).

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
│       ├── HungSilver.Application/     # interface, DTO, validator, ProductService
│       ├── HungSilver.Infrastructure/  # EF Core, Identity, JWT, Google, Repository, Seeder
│       └── HungSilver.WebApi/          # Controllers, middleware, Program.cs, config
│   └── tests/HungSilver.UnitTests/     # xUnit + SQLite in-memory
└── client/
    ├── Dockerfile              # node:22 build → nginx:alpine
    ├── nginx.conf              # SPA fallback + proxy /api → http://api:8080
    ├── proxy.conf.json         # dev: /api → http://localhost:5000
    └── src/app/
        ├── core/               # services, interceptor, guards, models (singleton)
        ├── features/           # auth (login/register), products, admin/users
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
- `Entities/Product.cs` — entity demo: `Name, Sku, Description?, Price, IsActive`.
- `Entities/RefreshToken.cs` — `UserId, TokenHash (SHA-256), ExpiresAt, RevokedAt?, ReplacedByTokenHash?`; `IsActive => RevokedAt == null && now < ExpiresAt`. **Chỉ lưu hash**, token gốc ở cookie client.

### 3.2 Application (`HungSilver.Application`) — interface + use case, không chạm EF/HTTP
- `Abstractions/IRepository.cs` — hợp đồng CRUD generic (`GetByIdAsync, FindAsync, AnyAsync, GetPagedAsync, AddAsync, Update, SoftDelete, RestoreAsync`). Tham số `includeDeleted` để bỏ qua query filter.
- `Abstractions/IUnitOfWork.cs` — `SaveChangesAsync`.
- `Abstractions/ICurrentUser.cs` — `UserId?, Email?, IsAuthenticated, IsInRole(role)` (đọc từ ClaimsPrincipal).
- `Abstractions/IJwtTokenService.cs` — `CreateAccessToken, CreateRefreshToken, HashToken` + record `AccessTokenResult`.
- `Abstractions/IGoogleAuthVerifier.cs` — `VerifyAsync(idToken)` → `GoogleUserInfo`.
- `Auth/` — `IAuthService`, `AuthDtos` (`RegisterRequest, LoginRequest, GoogleLoginRequest, UserDto, AuthTokens`), `AuthValidators` (FluentValidation: password ≥8, có hoa/thường/số).
- `Products/` — `IProductService` + **`ProductService`** (use case duy nhất hiện thực ngay tại Application vì chỉ cần `IRepository`/`IUnitOfWork`), `ProductDtos`, `ProductValidators`.
- `Users/` — `IUserAdminService`, `UserAdminDtos` (`UserListItemDto, AssignRolesRequest`).
- `Common/Models/` — `PagedRequest` (Page, PageSize clamp 1..100, Search, SortBy, SortDesc), `PagedResult<T>` (Items, Page, PageSize, TotalCount, TotalPages tính sẵn, có `.Map()`).
- `Common/ValidationExtensions.cs` — `ValidationResult.ToError(code)` gộp message.
- `DependencyInjection.cs` — `AddApplication()`: đăng ký validators (quét assembly) + `IProductService`.

### 3.3 Infrastructure (`HungSilver.Infrastructure`) — EF Core, Identity, hiện thực
- `Persistence/AppDbContext.cs` — kế thừa `IdentityDbContext<AppUser, AppRole, Guid>`. `DbSet<Product>`, `DbSet<RefreshToken>`. **`OnModelCreating` tự gắn global query filter `IsDeleted == false` cho MỌI entity `ISoftDeletable`** (kể cả bảng Users) bằng reflection + expression.
- `Persistence/Repositories/Repository.cs` — hiện thực `IRepository<T>`. `Query(includeDeleted)` chọn có/không `IgnoreQueryFilters()`. `SoftDelete` = `Remove()` (interceptor sẽ đổi thành UPDATE). `ApplySort` build OrderBy động qua reflection theo `sortBy` (fallback `CreatedAt desc`).
- `Persistence/Interceptors/AuditSaveChangesInterceptor.cs` — **trái tim của audit + soft delete**: `Added→CreatedAt`; `Modified→UpdatedAt`; `Deleted + ISoftDeletable → chuyển state về Modified, set IsDeleted=true, DeletedAt=now`. Dùng `DateTime.Now` (giờ local). Đăng ký **Singleton**.
- `Persistence/UnitOfWork.cs` — wrap `context.SaveChangesAsync`.
- `Persistence/DbSeeder.cs` — `MigrateAndSeedAsync`: chạy `Database.MigrateAsync()` + seed roles (`Admin`,`Teacher`,`User`) + Settings mặc định (`FileStorage.Mode=Server`). **KHÔNG tự tạo tài khoản admin** — tạo thủ công khi cần. **Không seed dữ liệu demo** (admin tự tạo GV; GV tự tạo lớp & HS). Gọi 1 lần lúc app khởi động.
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
- `Controllers/AuthController.cs`, `ProductsController.cs`, `UsersController.cs` — xem [§8](#8-api-endpoints).
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

- **Roles:** `Admin`, `Teacher`, `User`=học sinh (`AppRoles`). Seed sẵn 3 role; **tài khoản admin tạo thủ công** (đăng nhập bằng username `admin`). **Đăng nhập chấp nhận username HOẶC email** (`AuthService.LoginAsync`). **Đăng ký tự do bị khóa** (`AuthFeatureOptions.AllowRegistration=false`) — chỉ Admin tạo tài khoản Admin/GV; GV tạo tài khoản học sinh.
- **Server:**
  - `[Authorize]` mặc định; `[Authorize(Policy="AdminOnly")]` cho `UsersController` (gồm `POST /api/users` tạo tài khoản); `TeacherOrAdmin` cho lớp/học sinh — thao tác theo phạm vi qua `IClassAccessGuard`.
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
- **Bảng:** Identity (`AspNetUsers/Roles/UserRoles/UserClaims/UserLogins/UserTokens/RoleClaims`) + `Products` + `RefreshTokens`.
- **Soft delete toàn cục:** global query filter `IsDeleted == false` auto cho mọi `ISoftDeletable` ⇒ query mặc định không thấy bản ghi đã xóa; dùng `IgnoreQueryFilters()` / `includeDeleted=true` để xem/khôi phục.
- **Migrations:** `Infrastructure/Migrations/` — hiện có `20260612095713_InitialCreate`. Tự apply khi khởi động (DbSeeder). Tạo migration mới:
  ```powershell
  cd server
  dotnet tool run dotnet-ef -- migrations add <Tên> --project src/HungSilver.Infrastructure --startup-project src/HungSilver.WebApi
  ```
  > Lưu ý: README nhắc `dotnet-ef` là local tool ở `server/.config/dotnet-tools.json` — file manifest này **chưa tồn tại** trong repo hiện tại; nếu lệnh báo thiếu tool thì `dotnet new tool-manifest` + `dotnet tool install dotnet-ef`.
- **Cấu hình entity:** Product (`Name`≤200, `Sku`≤50 + index, `Description`≤2000, `Price` precision 18,2); RefreshToken (`TokenHash`≤128 + index, FK `UserId`→AppUser cascade).

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
| `/api/products` | GET | User | Phân trang/tìm kiếm; `includeDeleted` chỉ Admin |
| `/api/products/{id}` | GET | User | Chi tiết |
| `/api/products` | POST | **Admin** | Tạo (check trùng SKU) |
| `/api/products/{id}` | PUT | **Admin** | Sửa |
| `/api/products/{id}` | DELETE | **Admin** | Xóa mềm |
| `/api/products/{id}/restore` | POST | **Admin** | Khôi phục |
| `/api/users` | GET | **Admin** | List user (kèm đã xóa), tìm theo email/tên |
| `/api/users` | POST | **Admin** | Tạo tài khoản Admin/Giáo viên (`CreateUserRequest`) |
| `/api/users/{id}/roles` | PUT | **Admin** | Gán role (body `{roles:[]}`) |
| `/api/users/{id}` | DELETE | **Admin** | Xóa mềm (+ thu hồi token) |
| `/api/users/{id}/restore` | POST | **Admin** | Khôi phục |
| `/api/classes/{id}/students` | POST | Teacher/Admin | GV tạo HS trong lớp (+ tài khoản nếu chọn) |
| `/api/students/{id}/password` | PUT | Teacher/Admin | Đổi mật khẩu HS (guard theo lớp) |
| `/health` | GET | Public | Health check (kèm DbContext) |
| `/scalar/v1` | GET | Dev only | UI tài liệu API |

**Mapping status** (`ResultExtensions`): Validation→400, NotFound→404, Conflict→409, Unauthorized→401, Forbidden→403, Failure→500.

**API Response Wrapper**: mọi response từ controller được `ApiResponseWrapperFilter` bọc trong `{ data, isSuccess, message, statusCode }`. Ngoại lệ: `FileResult` (download), health check, OpenAPI/Scalar (nằm ngoài MVC pipeline). FE `apiResponseInterceptor` tự unwrap `data` từ wrapper.

---

## 9. Frontend (Angular 21)

- **Bootstrap:** `main.ts` → `bootstrapApplication(App, appConfig)`. **Zoneless** (Angular 21 mặc định, không Zone.js), standalone components, **signals** xuyên suốt.
- **`app.config.ts`:** providers — router, **HttpClient + apiResponseInterceptor + authInterceptor**, ng-zorro i18n `vi_VN`, đăng ký icon, `LOCALE_ID='vi'`, `provideAppInitializer(tryRestoreSession)`.
- **Routing (`app.routes.ts`):** lazy `loadComponent`. `/login`,`/register` (guestGuard) ngoài shell; còn lại nằm trong `Shell` (authGuard): `/products`, `/admin/users` (roleGuard Admin). `**` → `/`.
- **`core/` (singleton):**
  - `auth.service.ts` — phiên đăng nhập (xem §5).
  - `auth.interceptor.ts` — Bearer + single-flight refresh on 401.
  - `guards.ts` — authGuard/guestGuard/roleGuard.
  - `models.ts` — interface DTO khớp backend (`UserDto, AuthResponse, PagedResult<T>, Product, ProductRequest, UserListItem, ApiProblem`) + hằng `ROLE_ADMIN/USER`.
  - `products.service.ts`, `users.service.ts` — gọi REST (`HttpParams`).
- **`features/`:**
  - `auth/login.page.ts`, `auth/register.page.ts` — Reactive Forms + ng-zorro card, hiển thị `ApiProblem.detail` khi lỗi.
  - `products/products.page.ts` — bảng phân trang server-side, search debounce 350ms, modal thêm/sửa, popconfirm xóa mềm, khôi phục; nút ghi chỉ hiện cho Admin; checkbox "Hiện bản ghi đã xóa" (Admin).
  - `admin/users.page.ts` — bảng user, multi-select gán role inline, xóa mềm/khôi phục; chặn thao tác lên chính mình (`currentUserId`).
- **`layout/shell.ts`** — `nz-layout` **sider sáng** (menu theo role, item active nền indigo nhạt + thanh nhấn trái) + brand block (badge gradient) + header có **nút bật/tắt dark mode** + avatar/dropdown Đăng xuất; drawer mobile (<992px).
- **`shared/google-signin-button.ts`** — load Google Identity Services động, render nút, emit `credential` (ID token). Chưa cấu hình `googleClientId` → hiện ghi chú, ẩn nút.

**Design system "Indigo học thuật" (2026-06-15):**
- **Theme ng-zorro qua CSS variables:** `angular.json` import `ng-zorro-antd.variable.min.css`; `app.config.ts` `provideNzConfig({ theme })` (primary `#4F46E5`, success `#16A34A`, warning `#F59E0B`, error `#DC2626`, info `#4F46E5`) → `NzConfigService` tự `registerTheme` recolor toàn bộ component. Đổi màu chỉ ở 2 chỗ này.
- **Token riêng `--hs-*`** trong `src/styles.scss` (surface/border/text/radius/shadow/sidebar) + override `.ant-*` (card bo góc 12px + shadow, table header, tag pill, modal…) ⇒ mọi trang đẹp lên tự động. **Dark mode**: `body.theme-dark` ghi đè token + nhóm `--ant-*` cốt lõi; toggle qua `core/theme.service.ts` (signal `isDark`, lưu `localStorage('hs-theme')`).
- **Font** Be Vietnam Pro (`index.html` Google Fonts).
- **Component dùng chung:** `shared/page-header.ts` (badge icon + title/subtitle + slot actions — dùng ở mọi trang feature) và `shared/stat-card.ts` (badge icon màu + số liệu — Dashboard). Màu chart ECharts khớp palette (`#4F46E5/#16A34A/#F59E0B/#7C3AED`).
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
| `FileStorage:*` | `FileStorage__*` | — | `RootPath=/app/uploads` (volume prod), `MaxSizeBytes` 20MB, `PerUserQuotaBytes` 200MB, `CleanupRetentionDays` 30, `AllowedExtensions` (đuôi cơ bản); mode `Server` (DbSeeder) |
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
Tài khoản admin: **tạo thủ công** khi cần (mặc định `admin` / `Admin@a1` — đổi ngay sau lần đăng nhập đầu). DbSeeder chỉ seed role + settings, không tạo admin.

**Test:** server `dotnet test server/HungSilver.slnx`; client `npm test -- --watch=false` (Vitest + jsdom).

**Tests hiện có:** `RepositorySoftDeleteTests` (SQLite in-memory: audit timestamps, soft delete ẩn khỏi query, restore, paging includeDeleted) + `ResultTests`.

---

## 12. Build & Deploy

- **`server/Dockerfile`** — `sdk:10.0` build → `aspnet:10.0`, lắng nghe **8080**.
- **`client/Dockerfile`** — `node:22` build → `nginx:alpine` (static + proxy `/api`→`api:8080`).
- **Full stack tại chỗ:** `cp .env.example .env` (đổi `JWT_SECRET`, `POSTGRES_PASSWORD`…) → `docker compose up -d --build`. Mở `http://<ip>:HTTP_PORT`.
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
6. Client: `models.ts` thêm interface, `core/categories.service.ts`, page trong `features/`, route + (nếu cần) guard. **UI page bắt buộc dựng bằng ng-zorro-antd** (`Nz*Module`: card/form/table/modal/button…), theo đúng mẫu các page sẵn có (`products.page.ts`, `users.page.ts`).

**Thêm endpoint:** trả `Result`/`Result<T>` ở service, controller chỉ map `.ToActionResult()`. Lỗi nghiệp vụ ⇒ `Error.<Type>(code,message)` (đừng ném exception).

**Quy ước:**
- Đổi/ghi DB: thao tác qua `IRepository<T>` + `IUnitOfWork.SaveChangesAsync` (Product) hoặc trực tiếp `AppDbContext` khi cần Identity (Auth/UserAdmin).
- Xóa = soft delete; muốn thấy bản ghi đã xóa ⇒ `includeDeleted=true`/`IgnoreQueryFilters()`.
- Mọi message lỗi/UI dùng **tiếng Việt** (đồng bộ codebase).
- Comment code tiếng Việt, súc tích, đúng mật độ như file xung quanh.
- **FE — UI bắt buộc dùng ng-zorro-antd** (`Nz*Module`): không viết HTML/CSS UI thuần thay thế, không thêm thư viện UI khác. Icon đăng ký qua ng-zorro (`NzIconModule`), i18n `vi_VN`. Component standalone + signals + zoneless (xem §9).

---

## 15. Domain nghiệp vụ trung tâm tiếng Anh (Giai đoạn 1)

> Từ 2026-06-14 project mở rộng thành hệ thống quản lý trung tâm dạy tiếng Anh (14 module). **Schema thiết kế đầy đủ ngay từ đầu**; Giai đoạn 1 hiện thực phần lõi. Bám pattern nền (§3–§14) trừ các điểm khác biệt dưới đây.

### 15.1 Quy ước riêng
- **3 role:** `Admin` (toàn quyền + cấu hình hệ thống), `Teacher` (chỉ lớp của mình), `User` = **học sinh** (portal xem-chỉ-đọc → GĐ2). Policy `TeacherOrAdmin` (Program.cs).
- **KHÔNG khóa ngoại** trên mọi bảng nghiệp vụ mới: chỉ `Guid` + index; join thủ công trong service Infrastructure; tồn tại tham chiếu validate ở tầng app (`IUserDirectory`, `IClassAccessGuard`).
- **AutoMapper 14.x**: map entity↔DTO phẳng (Student/Setting/Journal…); DTO tổng hợp có field computed (ClassDto, Dashboard…) map tay. `AddAutoMapper(assembly)` ở `Application/DependencyInjection`. 14.0.0 dính advisory **GHSA-rvv3-g6hj-g44x** (đã suppress đúng advisory ở `server/Directory.Build.props`).
- **Enum serialize string** toàn API (`JsonStringEnumConverter` ở Program.cs).
- **Phân quyền theo dòng** (`Application/Common/ClassAccessGuard`): Admin mọi lớp; Teacher chỉ lớp `TeacherId==mình`; truy cập học sinh giới hạn theo enrollment lớp của mình.

### 15.2 Entities (`Domain/Entities`, đều `BaseEntity`, không FK) + enums (`Domain/Enums`)
`Student`, `Curriculum`, `ClassRoom`(→bảng `Classes`), `Enrollment`, `ClassScheduleSlot`, `ClassSession`, `StudentSessionRecord`, `PointEntry`, `RewardRedemption`, `TeacherJournal`, `SessionReport`, `StudentAssessment`(6 kỹ năng), `MonthlyEvaluation`, `MonthlyParentReport`, `TuitionInvoice`, `LearningMaterial`, `StoredFile`, `Notification`, `NotificationDelivery`, `AppSetting`. EF config gom ở `Infrastructure/Persistence/Configurations/` (chỉ length/precision/index), gọi `ApplyConfigurationsFromAssembly` trước vòng lặp global soft-delete.

### 15.3 Services (vị trí theo quy tắc §3)
- **Application** (IRepository): `Students/StudentService`, `Journals/TeacherJournalService`, `Common/ClassAccessGuard`.
- **Infrastructure** (AppDbContext join/aggregate): `Classes/ClassService`, `Schedule/ScheduleService`, `Sessions/SessionService`, `Dashboard/DashboardService`, `Reports/SessionReportService`, `Settings/SettingsService`, `Services/UserDirectory`, `Storage/{LocalDiskFileStorage,FileService}`, `Notifications/*`.
- **Cấu hình phân tầng (Settings):** `ISettingsResolver`/`ISettingsService` (1 impl `SettingsService`). Giải theo **User → Class → Role → System → Default**. `SettingKeys`: `FileStorage.Mode`, `Tuition.DueSoonDays`, `Warning.ScoreDropThreshold`, `Center.TimeZone`.
- **Module upload file (`Storage/`):** `IFileStorage` (local disk, `FileStorageOptions`) + setting `FileStorage.Mode` (`Server`|`ExternalUrl`; mặc định **Server**) — `FileService` từ chối upload khi mode=`ExternalUrl`. **Validate**: dung lượng (`MaxSizeBytes` 20MB), **allowlist phần mở rộng** (`AllowedExtensions` — loại cơ bản: ảnh/pdf/office/txt/csv/zip), **chữ ký nội dung magic-byte** (`FileSignatureValidator` — chống đổi đuôi giả mạo), **hạn mức/user** (`PerUserQuotaBytes` 200MB, miễn Admin); **dedup theo SHA-256** (file trùng nội dung dùng lại 1 bản vật lý). `StoredFile` thêm cột `Sha256` + `Visibility`. **Tải xuống phân tầng** theo `Visibility`: `Public` (ẩn danh, ảnh đại diện) / `Authenticated` (mặc định upload, cần đăng nhập) / `Restricted` (uploader hoặc Teacher/Admin) — kèm ETag + Cache-Control + `nosniff`, hỗ trợ 304. **Dọn rác:** `FileCleanupService` (BackgroundService) hard-delete file vật lý đã xóa mềm quá `CleanupRetentionDays` (refcount theo StoragePath).
- **Thông báo:** `INotificationSender`/`INotificationDispatcher`; Email thật (MailKit, `SmtpOptions`); Zalo/Messenger stub → `Manual` (GĐ2 tích hợp API).
- **Điểm thưởng** = sổ cái `PointEntry`; số dư = SUM(reward) − SUM(penalty) − SUM(redeem). Quy đổi = `RewardRedemption`.

### 15.4 Endpoints mới (mặc định `TeacherOrAdmin`; ghi `Admin` nếu đánh dấu)
- `/api/students` CRUD (list/detail scope; tạo/sửa/xóa/restore **Admin**) · `/api/students/{id}/progress` · `/api/students/{id}/redeem`.
- `/api/classes` CRUD (**Admin**) · `/{id}/roster` · `/{id}/teacher` **Admin** · `/{id}/enroll` **Admin** · `DELETE /{id}/students/{sid}` **Admin**.
- `/api/schedule?from&to[&classId]` · `/classes/{id}/slots` GET, `/slots` POST/DELETE **Admin** · `/classes/{id}/generate-sessions` **Admin** · `/sessions` POST · `/sessions/{id}/cancel`.
- `/api/sessions/{id}/sheet` · `/{id}/attendance` PUT(bulk) · `/{id}/points` POST · `DELETE /points/{entryId}` · `/{id}/journal` GET/PUT · `/{id}/report/generate` POST.
- `/api/dashboard/summary` · `/charts`.
- `/api/settings/effective` · `/scope/{scope}` · PUT · DELETE.
- `/api/files` POST (upload, mọi user đã đăng nhập, mode=Server) · `/{id}` GET (tải, phân tầng theo Visibility).

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
- **Cảnh báo** (`WarningsService`): tổng hợp 3 buổi vắng/thiếu BTVN liên tiếp, điểm giảm ≥ ngưỡng, học phí quá hạn.
- **Portal học sinh** (`PortalService`, route `/portal` role `User`): xem hồ sơ/tiến độ/lịch của chính mình; Admin liên kết tài khoản qua `PUT /api/students/{id}/link-user` (`Student.UserId`). `roleGuard` điều hướng HS về `/portal`.
- **Còn lại (tương lai):** job nền tự nhắc học phí/cảnh báo (hiện tính khi đọc); tích hợp API Zalo OA/Messenger thật (hiện stub `Manual`).

**Endpoints GĐ2 thêm:** `/api/tuition*`, `/api/materials*`, `/api/evaluations*` + `/api/leaderboard`, `/api/students/{id}/parent-report`, `/api/notifications`, `/api/warnings`, `/api/portal/me`, `/api/students/{id}/link-user`.

### 15.8 Đợt 7 — Môn/Khối, import lớp, gộp cảnh báo (đã hiện thực)
- **Phân loại lớp Môn → Khối → Lớp:** entity mới `Subject` (Admin CRUD, **không FK**) + `ClassRoom` thêm `SubjectId` (Guid?) & `GradeBand` (string?); `LearningMaterial` thêm `GradeBand`. Migration `AddSubjectAndClassTaxonomy` (0 FK). **Khối là danh sách chuẩn** lưu ở Settings key `Class.GradeBands` (mặc định trong `SettingKeys.Defaults` ⇒ có sẵn qua `GetEffectiveAllAsync` dù DB cũ chưa seed; sửa ở trang **Cấu hình**). FE trang **Lớp học** điều hướng 3 mức qua query param (`?subjectId=&gradeBand=&view=all`) + breadcrumb; có lối "Tất cả lớp" và nhóm "Chưa phân khối". Form tạo/sửa lớp thêm chọn Môn + Khối. Học liệu lọc/ gắn theo Khối.
- **Import danh sách LỚP từ Excel** (song song import học viên): `IClassImportService`/`ClassImportService` (ClosedXML, mirror `StudentImportService`) — cột `Tên lớp | Môn | Khối | Giáo viên (email/username) | Sĩ số | Ngày khai giảng | Giáo trình`; validate Môn/GV tồn tại. Endpoints `GET /api/classes/import-classes-template`, `POST /api/classes/import-classes/preview` + `POST /api/classes/import-classes` (**AdminOnly**). UI nút "Nhập Excel lớp" ở mức Môn.
- **Giáo viên xem lịch lớp mình (mục 3b):** chỉ đổi FE — route `/schedule` `adminOnly` → `teacherOrAdmin` + thêm menu "Lịch học" cho GV. Backend `ScheduleService.GetRangeAsync` đã tự lọc theo `TeacherScopeId` (không đổi).
- **Gộp Cảnh báo vào Lớp & Học sinh (mục 6):** `WarningsController`/`WarningsService` thêm filter `studentId` (scope theo HS qua `EnsureCanAccessStudentAsync`). Chi tiết lớp có card "Cảnh báo của lớp" (gọi `?classId=`); chi tiết HS có panel cảnh báo (`?studentId=`). **Giữ nguyên** trang `/warnings` tổng cho Admin.
- **Quản lý Môn:** `SubjectsController` (`/api/subjects` GET TeacherOrAdmin; POST/PUT/DELETE AdminOnly) + `ISubjectService`/`SubjectService` (Application, dùng `IRepository`); UI modal "Quản lý môn" ở mức Môn.

**Endpoints Đợt 7 thêm:** `/api/subjects` (CRUD), `/api/classes/import-classes*` (template/preview/commit), `GET /api/classes?subjectId&gradeBand`, `GET /api/materials/library?gradeBand`, `GET /api/warnings?studentId`.

---

## 16. Changelog

> Ghi lại mỗi thay đổi đáng kể (entity/endpoint/luồng/config/hạ tầng) theo định dạng: `ngày — mô tả — file chính`.

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
- **2026-06-18** — **API Response Wrapper toàn cục**: mọi response MVC bọc trong `ApiResponse<T>` (`data, isSuccess, message, statusCode`) qua `ApiResponseWrapperFilter` (IResultFilter). `GlobalExceptionHandler` trả `ApiResponse.Fail` thay vì `ProblemDetails`. FE: `apiResponseInterceptor` unwrap `body.data`, error handler đổi từ `(err.error as ApiProblem)?.detail` → `err.error?.message ?? err.message`. — `server/src/HungSilver.WebApi/Common/{ApiResponse,ApiResponseWrapperFilter,GlobalExceptionHandler}.cs`, `server/src/HungSilver.WebApi/Program.cs`, `client/src/app/core/{api-response.interceptor.ts,models.ts}`, `client/src/app/app.config.ts`, `client/src/app/features/**`.
