export const resourcePages = [
  ['regulations', 'Quy chế, quy định'],
  ['curriculum', 'Chương trình đào tạo'],
  ['forms', 'Biểu mẫu'],
  ['procedures', 'Quy trình, thủ tục'],
  ['contacts', 'Thông tin liên hệ'],
];

export const studentPages = [
  ['profile', 'Thông tin cá nhân'],
  ['courses', 'Quản lý học phần'],
  ['conduct', 'Đánh giá rèn luyện'],
  ['activities', 'Hoạt động đoàn thể'],
  ['other', 'Hoạt động khác'],
];

export const categories = [
  ['tuition', 'Học phí'],
  ['academic', 'Học tập'],
  ['activity', 'Hoạt động'],
  ['conduct', 'Rèn luyện'],
  ['general', 'Thông báo chung'],
];

export const importance = ['Bình thường', 'Quan trọng', 'Khẩn'];
export const cohorts = {2305: '2023', 2405: '2023', 2505: '2025', 2605: '2025'};

export const curricula = {
  2023: [
    ['M23-01', 'Nhập môn ngành', 1], ['M23-02', 'Kỹ năng học tập đại học', 1],
    ['M23-03', 'Phương pháp nghiên cứu', 2], ['M23-04', 'Kỹ năng thuyết trình', 2, true],
  ],
  2025: [
    ['M25-01', 'Nhập môn ngành', 1], ['M25-02', 'Kỹ năng số', 1],
    ['M25-03', 'Phương pháp nghiên cứu', 2], ['M25-04', 'Kỹ năng làm việc nhóm', 2, true],
  ],
};

export const sampleNotices = [
  {
    id: 'sample-tuition', category: 'tuition', level: 'Quan trọng', deadline: '',
    title: 'Mẫu thông báo kiểm tra học phí',
    summary: 'Minh họa cách thông báo học phí được trình bày và đưa vào kho.',
    body: 'Đây là thông báo minh họa. Khi có thông báo chính thức, nội dung sẽ nêu đối tượng áp dụng, hạn xử lý và nơi kiểm tra nghĩa vụ học phí.',
  },
  {
    id: 'sample-activity', category: 'activity', level: 'Bình thường', deadline: '',
    title: 'Mẫu thông báo hoạt động sinh viên',
    summary: 'Minh họa cách giới thiệu hoạt động và hướng dẫn đăng ký.',
    body: 'Đây là thông báo minh họa. Thông báo chính thức có thể bổ sung thời gian, địa điểm và cách đăng ký tham gia.',
  },
];
