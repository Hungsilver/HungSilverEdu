-- =====================================================================
--  Tạo tài khoản ADMIN thủ công cho HungSilver
-- =====================================================================
--  DbSeeder KHÔNG còn tự tạo admin (chỉ seed role + settings). Dùng file
--  này để tạo admin bằng tay sau khi deploy.
--
--  Chạy SAU khi app đã khởi động ít nhất 1 lần (migrations + seed role đã
--  chạy ⇒ bảng AspNetUsers/AspNetRoles tồn tại). An toàn chạy lại nhiều
--  lần (idempotent): đã có thì bỏ qua.
--
--      Tài khoản : admin
--      Mật khẩu  : Admin@a1     ← ĐỔI NGAY sau lần đăng nhập đầu (trang Cá nhân)
--      Email     : admin@gmail.com
--      Role      : Admin
--
--  PasswordHash dưới đây là PBKDF2-HMACSHA512, 100000 vòng (định dạng
--  ASP.NET Core Identity v3) của chuỗi "Admin@a1". Đổi mật khẩu ⇒ phải
--  sinh hash khác (đăng nhập rồi đổi ở trang Cá nhân là cách đơn giản nhất).
--  Yêu cầu PostgreSQL >= 13 (hàm gen_random_uuid() có sẵn).
-- =====================================================================

-- 1) Đảm bảo role Admin tồn tại
INSERT INTO "AspNetRoles" ("Id", "Name", "NormalizedName", "ConcurrencyStamp")
SELECT gen_random_uuid(), 'Admin', 'ADMIN', gen_random_uuid()::text
WHERE NOT EXISTS (SELECT 1 FROM "AspNetRoles" WHERE "NormalizedName" = 'ADMIN');

-- 2) Tạo tài khoản admin (bỏ qua nếu username 'admin' đã tồn tại)
INSERT INTO "AspNetUsers" (
    "Id", "UserName", "NormalizedUserName", "Email", "NormalizedEmail", "EmailConfirmed",
    "PasswordHash", "SecurityStamp", "ConcurrencyStamp",
    "PhoneNumberConfirmed", "TwoFactorEnabled", "LockoutEnabled", "AccessFailedCount",
    "FullName", "CreatedAtUtc", "IsDeleted"
)
SELECT
    gen_random_uuid(), 'admin', 'ADMIN', 'admin@gmail.com', 'ADMIN@GMAIL.COM', true,
    'AQAAAAIAAYagAAAAEO8aTOewBI0HHYsUlSG5XuEGR/eR849CvC03eH4toJ5e2gUOGjIblTWDlTAJ89pDFg==',
    gen_random_uuid()::text, gen_random_uuid()::text,
    false, false, true, 0,
    'Quản trị viên', now() AT TIME ZONE 'utc', false
WHERE NOT EXISTS (SELECT 1 FROM "AspNetUsers" WHERE "NormalizedUserName" = 'ADMIN');

-- 3) Gán role Admin cho tài khoản admin (bỏ qua nếu đã gán)
INSERT INTO "AspNetUserRoles" ("UserId", "RoleId")
SELECT u."Id", r."Id"
FROM "AspNetUsers" u
JOIN "AspNetRoles" r ON r."NormalizedName" = 'ADMIN'
WHERE u."NormalizedUserName" = 'ADMIN'
  AND NOT EXISTS (
        SELECT 1 FROM "AspNetUserRoles" ur WHERE ur."UserId" = u."Id" AND ur."RoleId" = r."Id"
  );

-- ---------------------------------------------------------------------
-- (TÙY CHỌN) Reset mật khẩu admin đã tồn tại về Admin@a1, gỡ khóa đăng nhập:
-- ---------------------------------------------------------------------
-- UPDATE "AspNetUsers"
-- SET "PasswordHash"    = 'AQAAAAIAAYagAAAAEO8aTOewBI0HHYsUlSG5XuEGR/eR849CvC03eH4toJ5e2gUOGjIblTWDlTAJ89pDFg==',
--     "AccessFailedCount" = 0,
--     "LockoutEnd"        = NULL,
--     "SecurityStamp"     = gen_random_uuid()::text
-- WHERE "NormalizedUserName" = 'ADMIN';
