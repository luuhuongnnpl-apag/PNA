# PNA – Public Demo V0.1 (bản ý tưởng tách biệt)

Không thay thế Foundation, không có kết nối Firebase hay dữ liệu thật. Dùng nhánh riêng để xem giao diện và lấy phản hồi trước khi hoàn thiện V0.1. Public Demo chỉ dùng dữ liệu tổng hợp giả lập. Mọi thao tác tệp chỉ trong bộ nhớ phiên; chuyển vai trò không xác thực. Không dùng điểm mẫu làm biểu điểm chính thức.

## Yêu cầu bổ sung: kho tài liệu xuyên hệ thống
- Tất cả vai trò có không gian tài liệu, tải lên/tải xuống theo quyền và phạm vi: cá nhân, lớp, khóa, tổ chức, nghiệp vụ; quyền xem danh mục, đọc tệp, tải xuống, tải lên, sửa, duyệt, phát hành, xóa độc lập. Không mặc định quyền ban cán sự xem hồ sơ nhạy cảm.
- Dữ liệu metadata Firestore: documents, documentVersions, documentGrants, documentAudit; Storage private by default; backend xác minh người dùng, assignment có hiệu lực, phạm vi và từng hành động; không dùng URL tải công khai dài hạn cho tệp riêng. Kiểm tra kích thước/định dạng, mã độc, nguồn gốc, checksum, thời hạn lưu. Tài liệu liên kết quy định, đợt nghiệp vụ, hồ sơ hoặc kế hoạch; giữ phiên bản. Thao tác phát hành có bước kiểm duyệt.

## Yêu cầu bổ sung: tiếp nhận tin tự động từ link + yêu cầu
- Người có quyền nhập URL nguồn và yêu cầu (tóm tắt, trích thời hạn/đối tượng/thủ tục/tệp, phân loại). Một lần hoặc theo dõi định kỳ theo cấu hình được phép. Lấy dữ liệu công khai hoặc được ủy quyền; không vượt đăng nhập, điều khoản, robots hoặc giới hạn truy cập.
- Backend job: xác thực URL HTTPS, chống SSRF (DNS/IP, redirect, private/link-local/metadata, giới hạn host/port, timeout/dung lượng), sanitize, trích xuất, lưu nguồn và thời điểm, hash chống trùng, phiên bản, trích dẫn, cảnh báo thiếu dữ liệu. Nội dung nguồn là dữ liệu không tin cậy; không thực thi hướng dẫn trong nguồn; AI không tự công bố. Dùng hàng đợi job, retry giới hạn, audit, phân bổ đối tượng dự kiến và người có quyền duyệt trước phát hành. Tài liệu tải về chỉ lưu khi được phép, kiểm tra mã độc. Mặc định chưa bật thu thập định kỳ hay dịch vụ trả phí.
- Thực thể đề xuất: sources, ingestionJobs, sourceSnapshots, contentDrafts, publicationApprovals; liên kết Knowledge, Live, Distribution, Workflow, Document Library.

## Luồng rèn luyện mẫu
Sinh viên nộp phiếu → BCS được phân công xét duyệt (cấm tự duyệt ở backend) → cố vấn duyệt hoặc tự động theo chính sách có hiệu lực → tổng hợp dự kiến → phản hồi → chốt đúng thẩm quyền. Lưu phiên bản phiếu/quy định, audit, idempotency, phân tách nhiệm vụ và quyền theo bước. Tự động mặc định tắt; ngoại lệ chuyển cố vấn. Demo chỉ mô phỏng một phiếu; bước chốt là minh họa, không tạo kết quả chính thức.

## Kiểm thử
15 assertions logic transition/visibility đã chạy trong môi trường tạo mã. Chưa chạy trình duyệt, kiểm thử bảo mật Firebase, build Foundation hay kiểm thử quyền máy chủ. Không đánh dấu V0.1 Foundation hoàn thành.

## Đưa demo tĩnh lên GitHub Pages
Chọn Settings > Pages > Deploy from a branch > preview/demo-v0.1 > /docs. Chỉ dùng dữ liệu giả lập. Không triển khai production hoặc bật dịch vụ trả phí. Nếu sử dụng Firebase Hosting thì triển khai riêng preview channel sau khi xác minh quyền và cấu hình.
