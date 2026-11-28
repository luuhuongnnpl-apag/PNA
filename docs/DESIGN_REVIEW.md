# PNA — Khung trải nghiệm và phương thức phát triển từng trang

Preview 0.1.2, không phải Foundation đã nghiệm thu.

## Tham chiếu trong hệ sinh thái
Đã đọc PND index.html và assets/pnd.css; PNL README.md và assets/pnl-shell.css; PN Work README.md. Kế thừa nguyên tắc thanh trên, băng giới thiệu, danh mục chức năng, khung nội dung và công cụ theo ngữ cảnh; màu navy #254b73, navy đậm #193553, nền xám sáng; xanh ngọc cho PNA, không sao chép logo, thương hiệu hoặc quyền/dữ liệu của ứng dụng khác. PNL sử dụng khuôn học phần chung và kiểm tra trước khi đăng; PN Work dùng một nguồn dữ liệu, nhiều bộ lọc. PNA riêng Firebase và không chia sẻ quyền mặc nhiên.

## Cấu trúc
- Lớp dùng chung: app shell, điều hướng, thông tin trang, tài liệu, tiếp nhận nguồn, thông báo, tìm kiếm, tài khoản, phân quyền, audit. Tính năng chưa có backend được ghi rõ.
- Quản trị nền tảng: tổ chức, vòng đời, đa khóa, sinh viên, vai trò/ủy nhiệm.
- Các phân hệ mở rộng: campaign/workflow, rèn luyện, cá nhân, phản hồi, báo cáo, AI. Registry modules.js điều khiển danh mục và mô tả trang, URL hash riêng, shell.css dùng chung, demo.js giữ logic thử. Chuyển từng trang sang component/module React TypeScript trong Foundation; không coi bản tĩnh là kiến trúc production.

## Danh mục và mô tả
### Không gian dùng chung\n- Tổng quan (#home): Điểm vào chung: việc cần xử lý, thông tin mới, phạm vi quản lý và đường dẫn nhanh. [demo]
- Kênh thông tin (#live): Thông báo, nhiệm vụ, sự kiện, phân bổ đối tượng và theo dõi đã đọc. [đang thiết kế]
- Kho tài liệu (#docs): Tải lên, tải xuống, phiên bản và phạm vi truy cập theo vai trò. [demo]
- Kho tri thức (#knowledge): Quy định, FAQ, hướng dẫn, hiệu lực và phiên bản áp dụng. [đang thiết kế]
- Tiếp nhận thông tin (#news): Nhập URL và yêu cầu xử lý; dự thảo, kiểm duyệt và phát hành. [demo]

### Quản trị nền tảng\n- Quản trị hệ thống (#governance): Cơ cấu tổ chức, chủ thể, thẩm quyền, phân công và nhiệm kỳ. [đang thiết kế]
- Quản trị vòng đời (#life): Khóa tuyển sinh, ngành, lớp, năm học, học kỳ và tiến trình cá nhân. [demo]
- Hồ sơ sinh viên (#students): Một định danh xuyên suốt, biến động, học tập và dữ liệu được phân quyền. [đang thiết kế]
- Phân quyền & cộng tác (#access): Vai trò, phạm vi, thời hạn, ủy nhiệm, kiểm tra và thu hồi quyền. [đang thiết kế]

### Nghiệp vụ & phát triển\n- Đợt nghiệp vụ (#campaigns): Tạo đợt, biểu mẫu, đối tượng, luồng, kết quả và tái sử dụng. [đang thiết kế]
- Xét điểm rèn luyện (#flow): Phiếu tự đánh giá, BCS xét duyệt, cố vấn hoặc tự động theo điều kiện. [demo]
- Không gian cá nhân (#personal): Hành trình, mục tiêu, kế hoạch, nhiệm vụ và hồ sơ năng lực. [đang thiết kế]
- Phản hồi & hỗ trợ (#feedback): Tiếp nhận kiến nghị, điều phối, hồ sơ hỗ trợ và phản hồi kết quả. [đang thiết kế]
- Báo cáo & lịch sử (#reports): Tổng hợp, xuất báo cáo, nhật ký và ảnh chụp dữ liệu theo thời điểm. [đang thiết kế]
- Trợ lý cố vấn (#ai): Truy xuất tri thức có căn cứ, dẫn nguồn và chuyển chuyên gia khi cần. [đang thiết kế]

## Chu kỳ thực hiện từng trang
1. Mô tả mục tiêu, chủ thể, dữ liệu, thao tác, quyền theo phạm vi/thời hạn, ngoại lệ, liên kết và tiêu chí nghiệm thu.
2. Dựng trang demo trên cùng khung, ghi trạng thái và dữ liệu giả lập.
3. Kiểm thử logic, trình duyệt desktop/mobile, điều hướng, quyền khi backend sẵn sàng. Chỉ công bố bản thử khi qua kiểm tra tương ứng; rollback bằng revert nếu lỗi.
4. Người dùng trải nghiệm, phản hồi; cập nhật đặc tả và mã nguồn. Không tự ghi nhận đã nghiệm thu.

Thứ tự đề xuất: 01 tổng quan/khung; 02 quản trị hệ thống; 03 vòng đời & đa khóa; 04 phân quyền; 05 kho tài liệu và tiếp nhận nguồn; 06 hồ sơ sinh viên; 07 luồng rèn luyện, tiếp theo theo Blueprint. Tài liệu và tiếp nhận nguồn là tiện ích xuyên suốt, không đợi tới cuối.

## Kiểm tra lần này
Đối chiếu ID duy nhất, đủ 15 trang, các ID được logic tham chiếu, các link điều hướng có đích, giữ logic demo trước. Chưa chạy browser, chưa kiểm thử Firebase, chưa xác minh deploy. Không dùng dữ liệu thật.
