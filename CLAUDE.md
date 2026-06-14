# HungSilver

**Trước khi làm bất kỳ task nào, hãy đọc [`ARCHITECTURE.md`](./ARCHITECTURE.md)** — đó là bản đồ đầy đủ
về kiến trúc, luồng hoạt động và chức năng của project (backend .NET 10 Clean Architecture + frontend
Angular 21). Đọc file đó là đủ, không cần truy vết lại từ source.

**Sau khi thay đổi đáng kể** (entity/endpoint/luồng/config/hạ tầng), **cập nhật `ARCHITECTURE.md`** —
nội dung liên quan ở phần tương ứng và thêm 1 dòng vào mục **§15 Changelog**.

Quy ước: code & message dùng tiếng Việt; lỗi nghiệp vụ trả Result/Error (không ném exception);
xóa = soft delete.

**FE (Angular):** mọi thành phần giao diện **bắt buộc dùng ng-zorro-antd** (`Nz*Module`) — không
viết HTML/CSS UI thuần thay thế, không thêm thư viện UI khác. Icon đăng ký qua ng-zorro, i18n `vi_VN`.
