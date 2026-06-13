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

## CI/CD (GitHub Actions → VPS)

Hai workflow trong `.github/workflows/`:

- **`ci.yml`** — chạy trên mọi `push` (dev, master) và `pull_request`: build + test server (.NET 10) và client (Angular 21) song song.
- **`cd.yml`** — chạy khi push/merge vào **`master`** (hoặc bấm Run thủ công): build 2 image rồi push lên **GHCR** (`ghcr.io/<owner>/hungsilver-api`, `…-client`), sau đó SSH vào VPS `pull` image và `up -d` bằng `docker-compose.prod.yml`.

Khác biệt compose: `docker-compose.yml` **build từ source** (dùng local / fallback); `docker-compose.prod.yml` **kéo image** từ GHCR (VPS không phải compile).

### GitHub Secrets cần tạo (Settings → Secrets and variables → Actions)

| Secret | Bắt buộc | Giá trị |
|---|---|---|
| `VPS_HOST` | ✅ | IP công khai của VPS |
| `VPS_USER` | ✅ | User SSH (vd `deploy` hoặc `root`) |
| `VPS_SSH_KEY` | ✅ | **Private key** SSH (toàn bộ nội dung OpenSSH) |
| `VPS_PORT` | ⬜ | Cổng SSH nếu khác `22` |
| `GHCR_PAT` | ✅* | PAT (classic) scope `read:packages` để VPS pull image |

`GITHUB_TOKEN` (dùng ở job build-push) là tự động, **không cần tạo**.
\*Có thể bỏ `GHCR_PAT` nếu đặt 2 package GHCR ở chế độ **Public** (khi đó xóa bước `docker login` trong `cd.yml`).

### Chuẩn bị VPS Ubuntu (làm 1 lần)

```bash
# 1. Cài Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER          # logout/login lại

# 2. Thư mục deploy + .env chứa secret thật (KHÔNG commit)
sudo mkdir -p /opt/hungsilver && sudo chown $USER /opt/hungsilver
cd /opt/hungsilver
cp <repo>/.env.example .env
nano .env   # set POSTGRES_PASSWORD, JWT_SECRET (>=32 ký tự), GHCR_OWNER=<owner thường>, IMAGE_TAG=latest, HTTP_PORT=80

# 3. SSH key cho CI: thêm public key vào ~/.ssh/authorized_keys của VPS_USER,
#    bỏ private key vào secret VPS_SSH_KEY.

# 4. Mở firewall
sudo ufw allow 80,22/tcp
```

Sau đó mỗi lần push vào `master` sẽ tự build → push GHCR → deploy. App ở `http://<ip-vps>`.

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
