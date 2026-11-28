# Hệ thống cố vấn học tập (PNA) — Kế hoạch tổng thể

Cập nhật 28/11/2026: thay bản kế hoạch 27/11 (React + TypeScript, Cloud Functions/Storage) bằng mô hình PND đã chạy thực tế.

## 1. Định vị
- Tên nội bộ: PNA. Tên hiển thị: **Hệ thống cố vấn học tập**; logo riêng; không gắn thương hiệu Phúc Nguyên.
- Công cụ hỗ trợ cố vấn học tập (CVHT) và sinh viên Khoa Luật; không phải cổng thông tin chính thức của Học viện khi chưa được cho phép.
- Người dùng: quản trị viên (chủ hệ thống), CVHT, cán bộ lớp, sinh viên, khách.

## 2. Kiến trúc (giống PND, gói Spark miễn phí)
| Thành phần | Lựa chọn |
|---|---|
| Giao diện | Web tĩnh HTML/CSS/JS thuần trên GitHub Pages (`luuhuongnnpl-apag.github.io/PNA/`), khung sao chép PND |
| Tệp | Google Drive: `PNA - Hệ thống cố vấn học tập/<Danh mục>/<Nhóm>/<Thẻ>/tệp` |
| Dữ liệu | Firestore của **dự án Firebase riêng PNA**, tiền tố `pna_` |
| Đăng nhập | Firebase Auth: Google, tên đăng nhập/mật khẩu, mã truy cập dùng chung (như mã lớp) |
| AI | Gemini qua Firebase AI Logic + App Check, chỉ trả lời trong phạm vi tài liệu người dùng được xem |
| Không dùng | Cloud Functions, Cloud Storage, máy chủ riêng, API trả phí |

## 3. Nhập liệu và quản trị (giống PND)
- Tải lên vào đúng thư mục Drive, thêm đường link, tạo văn bản ghi chú, ghi âm cuộc họp; quét Drive đối chiếu hai chiều, giữ thông tin đã nhập tay.
- Sửa thông tin tài liệu (ban hành, hiệu lực, ghi chú, mức truy cập, ★ Thông dụng); di chuyển, đổi tên, xóa; quản lý thư mục và Bộ sưu tập.
- Mức truy cập: Công khai · Nội bộ · Hạn chế · Mật. Vai trò do quản trị tự bật/tắt quyền (xem, tải về, tải lên, sửa, di chuyển, xóa, thư mục, ghi chú, AI) theo danh mục; quy tắc Firestore chặn giống giao diện.
- Gợi ý vai trò cho PNA: Khách · Sinh viên (`xem`) · Cán bộ lớp (`xem-rong`) · CVHT (`bien-muc`, theo danh mục) · Quản trị (`quan-tri`).

## 4. Danh mục cấp 1
Quy chế – quy định đào tạo · Chương trình đào tạo · Kế hoạch – lịch học vụ · Biểu mẫu – thủ tục · Thông báo · Hồ sơ lớp – khóa · Kỹ năng – hướng nghiệp · Tài liệu khác · Chờ phân loại (chỉ quản trị).

## 5. Lộ trình triển khai từng phần
| Phần | Nội dung | Trạng thái |
|---|---|---|
| 1 | Kho tài liệu CVHT theo khung PND: giao diện, danh mục, nhập liệu, phân quyền, mã truy cập, Hỏi AI | Đã cấu hình Firebase academic-advising-center, Drive (28/11); Hỏi AI chờ App Check |
| 2 | Nạp nội dung: quy chế đào tạo, CTĐT, kế hoạch năm học, biểu mẫu hiện hành (kiểm tra hiệu lực văn bản) | Chưa làm |
| 3 | Lớp – khóa: danh sách lớp CVHT phụ trách, cán bộ lớp, thông báo theo lớp kèm xác nhận đã đọc | Chưa làm — cần duyệt quy chế dữ liệu sinh viên |
| 4 | Lịch học vụ và nhắc việc (đăng ký học phần, thi, học bổng, rèn luyện) theo khóa | Chưa làm |
| 5 | Biểu mẫu trực tuyến: đơn, khảo sát, góp ý; CVHT tiếp nhận và phản hồi | Chưa làm |
| 6 | Sổ tay sinh viên: mục tiêu, kế hoạch học tập cá nhân, tự đánh giá (riêng tư mặc định) | Chưa làm |
| 7 | Báo cáo CVHT theo học kỳ, nhật ký tư vấn; liên thông PNL/PND chỉ đọc qua liên kết | Chưa làm |

## 6. Nguyên tắc dữ liệu
- Chưa đưa dữ liệu cá nhân, điểm số sinh viên thật lên hệ thống trước khi có phần 3 được duyệt và kiểm thử quy tắc.
- Không lưu mật khẩu, khóa bí mật, hồ sơ sinh viên trong GitHub; `config.js` chỉ chứa khóa công khai.
- Mọi thao tác quản trị ghi nhật ký `pna_activity`; xóa đưa vào thùng rác Drive trước.
