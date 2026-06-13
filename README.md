# HungSilver — Base project .NET 10 + Angular 21

Project base full-stack sẵn sàng chạy thực tế trên VPS:

- **Backend**: .NET 10 Web API, Clean Architecture 4 tầng (Domain / Application / Infrastructure / WebApi)
- **Frontend**: Angular 21 (standalone, signals, zoneless) + ng-zorro-antd
- **Database**: PostgreSQL 18 (Docker)
- **Auth**: ASP.NET Core Identity + JWT (access token 15') + refresh token rotation (HttpOnly cookie) + Google Login
- **Phân quyền**: Role `Admin` / `User`, policy `AdminOnly`, route guard phía client
- **Patterns**: Result pattern (không ném exception cho luồng nghiệp vụ), generic `Repository<T>` CRUD chung, **soft delete trên mọi bảng** (global query filter + interceptor)

## Cấu trúc

```
├── docker-compose.yml          # Full stack: postgres + api + client (VPS)
├── docker-compose.dev.yml      # Dev: chỉ PostgreSQL 18 (cổng 5433)
├── .env.example                # Mẫu secrets — copy thành .env
├── server/
│   ├── HungSilver.slnx
│   ├── global.json             # pin .NET SDK 10
│   ├── src/
│   │   ├── HungSilver.Domain/          # Entities, BaseEntity, ISoftDeletable, Result/Error
│   │   ├── HungSilver.Application/     # Interfaces, DTOs, validators, ProductService
│   │   ├── HungSilver.Infrastructure/  # EF Core + Npgsql, Identity, JWT, Google, Repository, Seeder
│   │   └── HungSilver.WebApi/          # Controllers, middleware, cấu hình
│   └── tests/HungSilver.UnitTests/
└── client/                     # Angular 21 + ng-zorro (login, register, products, admin users)
```

## Dev trên máy này

Máy dùng .NET 10 SDK **cách ly** tại `E:\dotnet10` (không ảnh hưởng dotnet 6/9 của hệ thống):

```powershell
# 1. Kích hoạt SDK 10 cho phiên shell hiện tại
. E:\dotnet10\use-dotnet10.ps1

# 2. Database dev (PostgreSQL 18, cổng 5433 — vì 5432 đã có Postgres khác của máy)
docker compose -f docker-compose.dev.yml up -d

# 3. Backend (http://localhost:5000, Scalar API docs: /scalar/v1)
cd server/src/HungSilver.WebApi
dotnet run --launch-profile http

# 4. Frontend (http://localhost:4200, proxy /api -> :5000)
cd client
npm start
```

Migrations + seed tự chạy khi API khởi động. Tài khoản admin mặc định (dev):
`admin@hungsilver.local` / `Admin@12345`.

Tạo migration mới (dotnet-ef là local tool, đã có trong `server/.config/dotnet-tools.json`):

```powershell
cd server
dotnet tool run dotnet-ef -- migrations add <TenMigration> --project src/HungSilver.Infrastructure --startup-project src/HungSilver.WebApi
```

## Google Login

1. Vào [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create Credentials → **OAuth client ID** → loại **Web application**.
2. Authorized JavaScript origins: thêm `http://localhost:4200` (dev) và domain thật (prod).
3. Copy Client ID, điền vào **2 chỗ**:
   - `client/src/environments/environment.development.ts` và `environment.ts` → `googleClientId`
   - `.env` → `GOOGLE_CLIENT_ID` (backend dùng để validate ID token)

Chưa cấu hình thì nút Google tự ẩn, login thường vẫn hoạt động bình thường.

## Deploy VPS

```bash
# Trên VPS đã cài Docker + Docker Compose
cp .env.example .env
nano .env          # đổi POSTGRES_PASSWORD, JWT_SECRET (bắt buộc), admin, Google ClientId
docker compose up -d --build
```

Mở `http://<ip-vps>` (hoặc cổng `HTTP_PORT` trong .env).

**Lưu ý HTTPS**: ở Production, refresh cookie được set `Secure` — đăng nhập chỉ duy trì
được qua **HTTPS**. Khuyến nghị đặt reverse proxy có TLS (Caddy/nginx + Let's Encrypt,
hoặc Cloudflare) trước cổng của client. Khi đó chỉ cần trỏ proxy về `HTTP_PORT`.

## API chính

| Endpoint | Method | Quyền | Mô tả |
|---|---|---|---|
| `/api/auth/register` `/login` `/google` | POST | Public | Đăng ký / đăng nhập / Google |
| `/api/auth/refresh` `/logout` | POST | Cookie | Refresh rotation / thu hồi |
| `/api/auth/me` | GET | User | Thông tin user hiện tại |
| `/api/products` (+`/{id}`, `/restore`) | CRUD | GET: User, còn lại: Admin | Demo repository + soft delete |
| `/api/users` (+roles, delete, restore) | * | Admin | Quản lý user, gán role |
| `/health` | GET | Public | Health check |

## Quy ước quan trọng

- **Soft delete**: mọi entity implement `ISoftDeletable` (gồm cả Users). `Remove()` được interceptor chuyển thành `UPDATE IsDeleted = true`; query mặc định tự lọc bản ghi đã xóa; dùng `includeDeleted`/`IgnoreQueryFilters` khi cần xem/khôi phục.
- **Result pattern**: service trả `Result`/`Result<T>` với `Error(Code, Message, Type)`; `ResultExtensions.ToActionResult()` map sang HTTP status + ProblemDetails.
- **Thêm entity mới**: kế thừa `BaseEntity` → có ngay Id/audit/soft-delete + dùng được `IRepository<T>` không cần viết repository riêng.
- **Token**: access token chỉ giữ trong memory phía client (không localStorage); refresh token nằm trong HttpOnly cookie path `/api/auth`.
