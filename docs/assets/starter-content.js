import {cohorts} from './portal-data.js?v=015';

const heading = value => ['heading', value];
const text = value => ['text', value];
const list = (...lines) => ['list', lines.join('\n')];
const note = value => ['callout', value];

const content = {
  regulations: [
    text('Trước khi đăng ký học, xin điều chỉnh tiến độ hoặc nộp hồ sơ rèn luyện, hãy xác định văn bản áp dụng cho khóa của mình.'),
    heading('Đọc và đối chiếu văn bản'),
    list('Kiểm tra số, ngày ban hành, cơ quan ban hành và ngày có hiệu lực.',
      'Đọc phạm vi áp dụng theo khóa, ngành và hình thức đào tạo.',
      'Kiểm tra các văn bản sửa đổi, thay thế hoặc hướng dẫn thực hiện.',
      'Lưu bản gốc và ghi lại điều, khoản cần hỏi cố vấn.'),
    heading('Các nhóm văn bản cần tra'),
    list('Quy chế đào tạo và hướng dẫn đăng ký học phần, học lại, cải thiện.',
      'Quy định đánh giá kết quả rèn luyện và hướng dẫn nộp minh chứng.',
      'Thông báo từng học kỳ về học phí, lịch đăng ký và thời hạn giải quyết.'),
    note('Khi hai tài liệu có thông tin khác nhau, gửi cả hai nguồn cho cố vấn hoặc bộ phận phụ trách để xác nhận văn bản áp dụng.'),
  ],
  curriculum: [
    text('Chọn chương trình theo khóa tuyển sinh trước khi đánh dấu tiến độ. Các nhóm dưới đây là khung đối chiếu đang dùng trong PNA.'),
    heading('Khóa tuyển sinh và chương trình'),
    list(...Object.entries(cohorts).map(([cohort, year]) => 'Khóa ' + cohort + ' · CTĐT ' + year)),
    heading('Rà soát theo học kỳ'),
    list('Mở Quản lý học phần trong Hồ sơ sinh viên và chọn khóa tuyển sinh.',
      'Đối chiếu mã học phần, tên, số tín chỉ và học kỳ dự kiến với chương trình do đơn vị đào tạo ban hành.',
      'Ghi lại học phần bắt buộc, nhóm tự chọn, học phần chưa tích lũy và học phần cần học lại hoặc cải thiện.'),
    note('Danh mục học phần chính thức sẽ được bổ sung theo từng ngành và phiên bản chương trình.'),
  ],
  forms: [
    text('Dùng các mẫu nội dung dưới đây để chuẩn bị yêu cầu gửi cố vấn. Nếu thông báo của đơn vị có biểu mẫu riêng, điền theo biểu mẫu đó.'),
    heading('Mẫu đề nghị tư vấn học phần'),
    text('Tiêu đề: Đề nghị tư vấn [học lại / học cải thiện / tiến độ]\nHọ tên, mã sinh viên, lớp:\nMã và tên học phần, học kỳ:\nVấn đề cần xác nhận:\nThời hạn trong thông báo (nếu có):\nTệp đính kèm (nếu có):'),
    heading('Bảng kê minh chứng rèn luyện'),
    text('Tên hoạt động:\nNgày tham gia và đơn vị tổ chức:\nVai trò / kết quả:\nTiêu chí tự đánh giá:\nTên tệp hoặc đường dẫn minh chứng:'),
    note('Gửi biểu mẫu có thông tin cá nhân qua kênh được đơn vị chỉ định.'),
  ],
  procedures: [
    heading('Hỏi về đăng ký học lại hoặc cải thiện'),
    list('Xem thông báo của học kỳ và ghi lại hạn đăng ký.',
      'Đối chiếu mã học phần và kết quả đã ghi nhận.',
      'Chuẩn bị mã sinh viên, lớp, mã học phần và câu hỏi cụ thể.',
      'Gửi theo kênh nêu trong thông báo, rồi lưu xác nhận để theo dõi.'),
    heading('Chuẩn bị kê khai rèn luyện'),
    list('Tập hợp minh chứng theo từng hoạt động và kỳ đánh giá.',
      'Ghi rõ thời gian, vai trò, kết quả và tiêu chí liên quan.',
      'Rà soát hồ sơ trước khi gửi và theo dõi phản hồi của lớp hoặc cố vấn.'),
    note('Thời hạn và nơi nộp xác định theo thông báo của từng đợt.'),
  ],
  contacts: [
    text('Chọn đầu mối theo nội dung cần hỏi. Khi gửi yêu cầu, nêu khóa, lớp và vấn đề để người nhận dễ chuyển đúng nơi xử lý.'),
    heading('Cố vấn học tập của lớp'),
    text('Trao đổi về kế hoạch học tập, học phần chưa tích lũy, học lại và tiến độ. Xem thông tin liên hệ trong kênh chính thức của lớp.'),
    heading('Đầu mối đào tạo hoặc công tác sinh viên'),
    text('Hỏi về đăng ký học phần, hồ sơ hành chính, học phí hoặc kết quả rèn luyện qua địa chỉ ghi trong thông báo tương ứng.'),
    heading('Ban cán sự và đầu mối đoàn thể'),
    text('Hỏi về hoạt động, thông tin phối hợp của lớp và rà soát minh chứng theo phân công từng đợt.'),
  ],
};

export function starterContent(pageId) {
  return (Object.hasOwn(content, pageId) ? content[pageId] : []).map(([type, value], index) => ({
    id: '00000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'), type, value, url: '', view: 'table',
  }));
}
