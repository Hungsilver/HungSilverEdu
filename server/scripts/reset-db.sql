-- =====================================================================
--  XÓA SẠCH dữ liệu database HungSilver  (KHÔNG HOÀN TÁC ĐƯỢC!)
-- =====================================================================
--  Dùng để reset toàn bộ DB trên VPS về trạng thái trắng. Sau khi chạy:
--    1) Khởi động lại API  ⇒ EF migrations tự tạo lại bảng + DbSeeder
--       seed role (Admin/Teacher/User) và settings mặc định.
--    2) Chạy create-admin.sql để tạo lại tài khoản admin.
--
--  >>> NÊN SAO LƯU TRƯỚC (chạy ở shell, KHÔNG trong psql):
--        pg_dump -U hungsilver -d hungsilver -F c -f backup_truoc_khi_xoa.dump
--
--  Cách chạy (database hungsilver):
--        psql -U hungsilver -d hungsilver -f reset-db.sql
--    hoặc qua Docker trên VPS:
--        docker compose -f docker-compose.prod.yml exec -T postgres \
--            psql -U hungsilver -d hungsilver < reset-db.sql
-- =====================================================================

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
ALTER SCHEMA public OWNER TO hungsilver;
GRANT ALL ON SCHEMA public TO hungsilver;
GRANT ALL ON SCHEMA public TO public;
