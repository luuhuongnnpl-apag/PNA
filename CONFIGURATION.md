# Hệ thống cố vấn học tập (PNA) — GitHub Pages + Firebase riêng + Google Drive

Khung giao diện, cách nhập liệu và quản trị sao chép từ Phúc Nguyên Digital (PND, repo `PN-degital`, bản 14/11/2026). Tên hiển thị: **Hệ thống cố vấn học tập**, logo riêng (`assets/logo.png`). Không dùng chung dữ liệu với PND/PNL/PNW.

## Mã nguồn
- `index.html` — khung trang, hộp thoại · `assets/pna.css` — giao diện · `assets/pna.js` — toàn bộ chức năng (Firebase JS SDK 12.0.0)
- `config.js` — cấu hình công khai (Firebase dự án PNA, email quản trị, khóa Drive, App Check, liên kết)
- `firestore.rules` — quy tắc bảo mật của dự án PNA (toàn bộ tệp, tiền tố collection `pna_`)

## Cài đặt một lần (dự án Firebase PNA)
1. Firebase Console → dự án PNA → Project settings → Your apps → thêm **Web app** → sao chép khối `firebaseConfig` vào `FIREBASE` trong `config.js`.
2. Authentication → Sign-in method: bật **Google** và **Email/Password**; Settings → Authorized domains: thêm `luuhuongnnpl-apag.github.io`.
3. Firestore Database → tạo (chế độ production) → Rules: dán `firestore.rules` → Publish.
4. Google Cloud Console (cùng dự án) → APIs & Services: bật **Google Drive API**, **Google Picker API**; OAuth consent screen (External); Credentials → tạo **OAuth client ID** (Web, Authorized JavaScript origins `https://luuhuongnnpl-apag.github.io`) → dán vào `CLIENT_ID`; tạo **API key** giới hạn HTTP referrer `luuhuongnnpl-apag.github.io/*`, chỉ Drive API → dán vào `DRIVE_KEY`.
5. (Tùy chọn) Hỏi AI: Firebase AI Logic (Gemini Developer API) + App Check reCAPTCHA Enterprise → dán khóa site vào `APPCHECK_SITE_KEY`.
6. Mở web, đăng nhập Google bằng tài khoản quản trị → **Khởi tạo cây thư mục** (tạo `PNA - Hệ thống cố vấn học tập` trên Drive của `DRIVE_OWNER`).

## Cây thư mục Google Drive = bộ khung của web
```
PNA - Hệ thống cố vấn học tập / <Danh mục> / <Nhóm> / <Thẻ> / tệp…
```
Danh mục cấp 1 mặc định: Quy chế – quy định đào tạo · Chương trình đào tạo · Kế hoạch – lịch học vụ · Biểu mẫu – thủ tục · Thông báo · Hồ sơ lớp – khóa · Kỹ năng – hướng nghiệp · Tài liệu khác · Chờ phân loại (chỉ quản trị thấy). Quản trị thêm, đổi tên, sắp xếp Bộ sưu tập ngay trên giao diện.

## Chức năng quản trị (đăng nhập Google bằng email trong `ADMIN_EMAILS`)
- **Quét Google Drive**: đọc lại toàn bộ cây, cập nhật chỉ mục Firestore. Không sửa, không di chuyển, không xóa tệp trên Drive. Thông tin đã nhập (cơ quan ban hành, hiệu lực…) được giữ.
- **Tải lên**: chọn danh mục và thư mục (có thể tạo thư mục con mới), tải tệp lên đúng thư mục Drive hoặc nhập đường link, điền ghi chú, đánh dấu ★ Thông dụng.
- **Sửa** ở từng dòng bảng tài liệu: thông tin ban hành, hiệu lực, ★.
- **Mở chia sẻ xem tài liệu**: đặt "Bất kỳ ai có đường liên kết đều xem được" cho các tệp đã xếp danh mục (cần để người dùng mã mở được tệp). Chỉ chạy khi quản trị bấm và xác nhận.
- **Quản lý mã tài khoản** (ô Dữ liệu): cấp mã, số người, hạn dùng, danh mục được xem; sửa, xóa — như mã lớp của PNL.
- **Tìm kiếm**: theo tên và ghi chú; khi quản trị đã kết nối Drive thì tìm cả trong nội dung tệp.

## Người dùng mã tài khoản
Đăng nhập → tab Mã tài khoản → nhập mã. Xem được các danh mục mã cho phép, tới hết hạn mã. Mỗi trình duyệt tính một lượt.

## Hỏi AI
Gemini (Firebase AI Logic, Gemini Developer API — hạn mức miễn phí của dự án), bảo vệ bằng App Check (Fraud Defense/reCAPTCHA). Trợ lý trả lời dựa trên danh mục tài liệu người dùng được xem.

## Firestore
`pna_settings` (root, thongdung) · `pna_tree` · `pna_items` · `pna_ma/{mã}/luot/{uid}` · `pna_users/{uid}` · `pna_activity`.
Quy tắc: cây thư mục và cấu hình công khai; tài liệu chỉ đọc được khi mã còn hạn và có quyền danh mục; mọi ghi chỉ quản trị (trừ lượt dùng mã của chính người dùng).

## Firestore (dự án PNA)
`pna_settings` (root, thongdung, roles) · `pna_tree` · `pna_items` · `pna_catalog` · `pna_accounts/{email}` · `pna_ma/{mã}/luot/{uid}` · `pna_users/{uid}` · `pna_activity`.

## Phân quyền (10/11/2026)
**Mức truy cập tài liệu** (trường `access` của `pna_items`, đặt riêng từng tài liệu hoặc mặc định theo thư mục trong `pna_tree.access`):
Công khai (`cong-khai`) · Nội bộ (`noi-bo`, mặc định) · Hạn chế (`han-che`) · Mật (`mat`, chỉ quản trị).

**Vai trò** (dùng chung cho tài khoản `pna_accounts/{email}` và mã truy cập `pna_ma/{mã}`):
| Vai trò | Xem | Tải về | Tải lên, quản lý |
|---|---|---|---|
| Khách (chưa đăng nhập) | Công khai | — | — |
| `xem` Độc giả | Công khai, Nội bộ | — | — |
| `xem-rong` Độc giả mở rộng | Công khai, Nội bộ, Hạn chế | — | — |
| `chuyen-muc` Người dùng chuyên mục | Công khai, Nội bộ, Hạn chế (theo danh mục) | ✓ | — |
| `bien-muc` Thủ thư / Biên mục | Công khai, Nội bộ, Hạn chế | ✓ | ✓ |
| `quan-tri` Quản trị hệ thống | Tất cả, kể cả Mật | ✓ | ✓ + cấp tài khoản |

- Tài khoản tên đăng nhập: Firebase Email/Mật khẩu với email `<tên>@taikhoan.pna`; tài khoản Google: đăng nhập Google bằng email đã cấp.
- Thủ thư muốn tải tệp lên cần tài khoản Google có quyền chỉnh sửa thư mục PNA trên Drive (tick “Cấp quyền chỉnh sửa thư mục PNA” khi cấp tài khoản).
- Chặn tải về là chặn trên giao diện web (ẩn nút mở/tải, che nút mở rộng của khung xem trước); ai đã có đường link Drive vẫn mở được tệp.
- Quy tắc bảo mật: `firestore.rules` — dán nguyên tệp vào Firebase Console (dự án PNA) → Firestore → Rules → Publish.
