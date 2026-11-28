/* Bộ thủ tục mặc định của Cổng Thủ tục sinh viên (PNA).
   Căn cứ: Quy chế đào tạo trình độ đại học của Học viện Hành chính và Quản trị công
   ban hành kèm Quyết định số 2567-QĐ/HVHCQTC ngày 09/3/2026 (áp dụng từ khóa trúng tuyển năm 2026).
   Quản trị viên sửa trên giao diện (lưu ở pna_tt_settings/thutuc); tệp này chỉ là bộ khởi tạo.
   Trường nhập: k (mã), label, type: text|textarea|date|number|select|table, req, opts (select), cols (table), hint */
export const QC = "Quy chế đào tạo trình độ đại học (QĐ 2567-QĐ/HVHCQTC ngày 09/3/2026)";

export const STEP_ROLES = {
  cvht: { name: "Cố vấn học tập", act: "Xác nhận", sign: "XÁC NHẬN CỦA CỐ VẤN HỌC TẬP" },
  khoa: { name: "Lãnh đạo Khoa", act: "Duyệt", sign: "Ý KIẾN CỦA LÃNH ĐẠO KHOA" },
  qldt: { name: "Ban Quản lý đào tạo", act: "Tiếp nhận", sign: "TIẾP NHẬN CỦA BAN QUẢN LÝ ĐÀO TẠO" }
};

const HK = { k: "hocKy", label: "Học kỳ, năm học", type: "text", req: true, hint: "Ví dụ: Học kỳ II, năm học 2026–2027" };
const HP_COLS = ["Mã học phần", "Tên học phần", "Số tín chỉ", "Ghi chú"];

export const THU_TUC = [
  {
    key: "nghi-hoc-tam-thoi", nhom: "Học vụ", ten: "Nghỉ học tạm thời và bảo lưu kết quả học tập",
    tieuDe: "ĐƠN ĐỀ NGHỊ NGHỈ HỌC TẠM THỜI VÀ BẢO LƯU KẾT QUẢ HỌC TẬP",
    kinhGui: "Giám đốc Học viện Hành chính và Quản trị công; Ban Quản lý đào tạo; Lãnh đạo Khoa",
    canCu: "Khoản 1, 2, 3 Điều 53 " + QC,
    huongDan: "Được nghỉ khi: (a) điều động vào lực lượng vũ trang; (b) được điều động đại diện quốc gia dự thi, giải đấu quốc tế hoặc thực hiện nhiệm vụ quốc gia, quốc tế; (c) ốm, thai sản, tai nạn phải điều trị dài ngày có chứng nhận của cơ sở khám bệnh, chữa bệnh; (d) lý do cá nhân khác nhưng đã học tối thiểu 01 học kỳ ở Học viện và không thuộc diện bị xem xét buộc thôi học hoặc kỷ luật. Nghỉ vì lý do cá nhân không quá 01 năm và được tính vào thời gian học chính thức. Giám đốc Học viện xem xét, quyết định.",
    minhChung: "Bản sao chứng thực Lệnh gọi nhập ngũ/tham gia nghĩa vụ công an; hoặc Quyết định điều động; hoặc Giấy chứng sinh/giấy chứng nhận điều trị bệnh, tai nạn (tùy trường hợp).",
    steps: ["cvht", "khoa"],
    fields: [
      { k: "truongHop", label: "Trường hợp nghỉ học", type: "select", req: true, opts: ["Được điều động vào lực lượng vũ trang", "Được điều động đại diện quốc gia / thực hiện nhiệm vụ quốc gia, quốc tế", "Ốm, thai sản hoặc tai nạn phải điều trị thời gian dài", "Lý do cá nhân khác (đã học tối thiểu 01 học kỳ)"] },
      { k: "tuHocKy", label: "Nghỉ từ học kỳ, năm học", type: "text", req: true, hint: "Ví dụ: Học kỳ I, năm học 2026–2027" },
      { k: "thoiGian", label: "Thời gian đề nghị nghỉ", type: "text", req: true, hint: "Ví dụ: 01 học kỳ / 12 tháng / theo thời gian điều trị" }
    ]
  },
  {
    key: "tro-lai-hoc", nhom: "Học vụ", ten: "Trở lại học sau thời gian nghỉ học tạm thời",
    tieuDe: "ĐƠN ĐỀ NGHỊ TRỞ LẠI HỌC TIẾP",
    kinhGui: "Giám đốc Học viện Hành chính và Quản trị công; Ban Quản lý đào tạo; Lãnh đạo Khoa",
    canCu: "Điểm a, b khoản 4 Điều 53 " + QC,
    huongDan: "Gửi đơn ít nhất 02 tuần trước khi bắt đầu học kỳ mới và trước khi hết thời gian nghỉ ghi trong quyết định. Trường hợp nghỉ do điều động vào lực lượng vũ trang: gửi trong vòng 15 ngày kể từ ngày có quyết định xuất ngũ. Quá 30 ngày làm việc kể từ ngày hết thời gian nghỉ mà không gửi đơn thì bị coi là tự ý bỏ học (điểm d khoản 4 Điều 53).",
    minhChung: "Bản sao chứng thực Quyết định xuất ngũ; hoặc Quyết định điều động và báo cáo kết quả có xác nhận của cơ quan điều động; hoặc Giấy chứng sinh/giấy ra viện; Giấy xác nhận của chính quyền/công an địa phương về việc chấp hành quy định và hoàn thành nghĩa vụ công dân nơi cư trú.",
    steps: ["cvht", "khoa"],
    fields: [
      { k: "soQD", label: "Quyết định cho nghỉ học tạm thời (số, ngày)", type: "text", req: true },
      { k: "hetHan", label: "Ngày hết thời gian nghỉ theo quyết định", type: "date", req: true },
      { ...HK, k: "hocKyTroLai", label: "Xin trở lại học từ học kỳ, năm học" }
    ]
  },
  {
    key: "gia-han-nghi", nhom: "Học vụ", ten: "Tiếp tục nghỉ học tạm thời (gia hạn)",
    tieuDe: "ĐƠN ĐỀ NGHỊ TIẾP TỤC ĐƯỢC NGHỈ HỌC TẠM THỜI",
    kinhGui: "Giám đốc Học viện Hành chính và Quản trị công; Ban Quản lý đào tạo; Lãnh đạo Khoa",
    canCu: "Điểm c khoản 4 và điểm d khoản 2 Điều 53 " + QC,
    huongDan: "Gửi trong 30 ngày làm việc kể từ ngày hết thời gian nghỉ ghi trong quyết định, khi vì lý do chính đáng chưa thể trở lại học; tổng thời gian nghỉ vì lý do cá nhân không vượt quá 01 năm.",
    minhChung: "Giấy tờ chứng minh lý do chính đáng chưa thể trở lại học.",
    steps: ["cvht", "khoa"],
    fields: [
      { k: "soQD", label: "Quyết định cho nghỉ học tạm thời (số, ngày)", type: "text", req: true },
      { k: "hetHan", label: "Ngày hết thời gian nghỉ theo quyết định", type: "date", req: true },
      { k: "thoiGian", label: "Thời gian đề nghị nghỉ thêm", type: "text", req: true }
    ]
  },
  {
    key: "thoi-hoc", nhom: "Học vụ", ten: "Thôi học",
    tieuDe: "ĐƠN ĐỀ NGHỊ THÔI HỌC",
    kinhGui: "Giám đốc Học viện Hành chính và Quản trị công; Ban Quản lý đào tạo; Lãnh đạo Khoa",
    canCu: "Khoản 5, 6 Điều 53 " + QC,
    huongDan: "Được xin thôi học vì lý do cá nhân, trừ trường hợp đang bị xem xét buộc thôi học hoặc xem xét kỷ luật. Sinh viên đã thôi học muốn quay lại phải dự tuyển đầu vào như thí sinh khác. Cố vấn học tập sẽ trao đổi trực tiếp với sinh viên trước khi xác nhận.",
    minhChung: "",
    steps: ["cvht", "khoa"],
    fields: [
      { k: "tuNgay", label: "Xin thôi học từ ngày", type: "date", req: true },
      { k: "camKet", label: "Gia đình đã được thông báo và đồng ý", type: "select", req: true, opts: ["Có", "Không"] }
    ]
  },
  {
    key: "dieu-chinh-hoc-phan", nhom: "Đăng ký học tập", ten: "Đăng ký thêm, đổi hoặc rút bớt học phần (trường hợp đặc biệt)",
    tieuDe: "ĐƠN ĐỀ NGHỊ ĐIỀU CHỈNH ĐĂNG KÝ HỌC PHẦN",
    kinhGui: "Ban Quản lý đào tạo; Lãnh đạo Khoa",
    canCu: "Điều 9 và bước 5 Phụ lục 03 " + QC,
    huongDan: "Thời hạn: 02 tuần đầu học kỳ chính, 01 tuần đầu học kỳ phụ. Khối lượng học kỳ chính từ 15 đến 26 tín chỉ (không tính Giáo dục thể chất, Giáo dục quốc phòng – an ninh); sinh viên bị xếp học lực yếu, kém hoặc bị cảnh báo học tập ở học kỳ trước chỉ được đăng ký tối đa 15 tín chỉ (điểm c khoản 1 Điều 9).",
    minhChung: "",
    steps: ["cvht", "khoa"],
    fields: [
      HK,
      { k: "them", label: "Học phần đăng ký thêm / đổi sang", type: "table", cols: HP_COLS },
      { k: "rut", label: "Học phần xin rút / đổi đi", type: "table", cols: HP_COLS },
      { k: "tongTC", label: "Tổng số tín chỉ của học kỳ sau điều chỉnh", type: "number", req: true }
    ]
  },
  {
    key: "hoc-lai-cai-thien", nhom: "Đăng ký học tập", ten: "Học lại, học cải thiện điểm, học vượt, học phần thay thế",
    tieuDe: "ĐƠN ĐĂNG KÝ HỌC LẠI, HỌC CẢI THIỆN ĐIỂM",
    kinhGui: "Ban Quản lý đào tạo; Lãnh đạo Khoa",
    canCu: "Điều 13 và bước 6, 7 Phụ lục 03 " + QC,
    huongDan: "Điểm F: thi lại 01 lần tại kỳ thi phụ kế tiếp, không đạt thì đăng ký học lại. Điểm D, D+: được học lại hoặc học phần tương đương, thay thế để cải thiện; điểm chính thức là điểm cao nhất; việc học, thi cải thiện thực hiện trong thời gian đào tạo chuẩn. Sinh viên đã hết thời gian đào tạo chuẩn còn nợ học phần gửi đơn chậm nhất 02 tuần trước học kỳ mới để được xếp lớp.",
    minhChung: "",
    steps: ["cvht"],
    fields: [
      HK,
      { k: "loai", label: "Hình thức", type: "select", req: true, opts: ["Học lại (điểm F)", "Học cải thiện điểm (D, D+)", "Học vượt", "Học phần thay thế / tương đương", "Đã hết thời gian đào tạo chuẩn, xin học để xếp lớp"] },
      { k: "hocPhan", label: "Học phần đăng ký", type: "table", cols: ["Mã học phần", "Tên học phần", "Số tín chỉ", "Điểm đã đạt"] }
    ]
  },
  {
    key: "hoan-thi", nhom: "Thi, kiểm tra", ten: "Hoãn thi kết thúc học phần",
    tieuDe: "ĐƠN XIN HOÃN THI KẾT THÚC HỌC PHẦN",
    kinhGui: "Trung tâm Khảo thí và Đảm bảo chất lượng đào tạo; Lãnh đạo Khoa",
    canCu: "Khoản 5 Điều 13 " + QC + " và quy định về tổ chức thi kết thúc học phần của Học viện",
    huongDan: "Học phần được hoãn thi nhận điểm I (chưa hoàn thiện) cho đến khi dự thi bổ sung. Điều kiện, thời hạn nộp đơn theo quy định về tổ chức thi của Học viện.",
    minhChung: "Giấy tờ chứng minh lý do (giấy khám, điều trị; quyết định cử đi công tác, thi đấu…).",
    steps: ["cvht", "khoa"],
    fields: [
      HK,
      { k: "hocPhan", label: "Học phần xin hoãn thi", type: "table", cols: ["Tên học phần", "Số tín chỉ", "Điểm thường xuyên", "Điểm định kỳ", "Giờ/ngày thi"] }
    ]
  },
  {
    key: "phuc-khao", nhom: "Thi, kiểm tra", ten: "Phúc khảo bài thi kết thúc học phần",
    tieuDe: "ĐƠN ĐỀ NGHỊ PHÚC KHẢO BÀI THI",
    kinhGui: "Trung tâm Khảo thí và Đảm bảo chất lượng đào tạo",
    canCu: "Khoản 5 Điều 13 " + QC + " và quy định về tổ chức thi kết thúc học phần của Học viện",
    huongDan: "Thời hạn, lệ phí phúc khảo theo thông báo của Trung tâm Khảo thí và Đảm bảo chất lượng đào tạo.",
    minhChung: "",
    steps: ["cvht"],
    fields: [
      HK,
      { k: "hocPhan", label: "Bài thi đề nghị phúc khảo", type: "table", cols: ["Tên học phần", "Ngày thi", "Phòng thi / SBD", "Điểm đã công bố"] }
    ]
  },
  {
    key: "cong-nhan-tin-chi", nhom: "Công nhận, chuyển đổi", ten: "Công nhận kết quả học tập và chuyển đổi tín chỉ",
    tieuDe: "ĐƠN ĐỀ NGHỊ CÔNG NHẬN KẾT QUẢ HỌC TẬP VÀ CHUYỂN ĐỔI TÍN CHỈ",
    kinhGui: "Giám đốc Học viện Hành chính và Quản trị công; Ban Quản lý đào tạo",
    canCu: "Điều 18 và Phụ lục 07 " + QC,
    huongDan: "Nộp hồ sơ ít nhất 30 ngày trước thời điểm tổ chức đăng ký học phần theo kế hoạch đào tạo. Mang bản chính để đối chiếu khi Ban Quản lý đào tạo yêu cầu.",
    minhChung: "Bản sao có chứng thực chứng chỉ ngoại ngữ, công nghệ thông tin; bản sao có chứng thực bằng tốt nghiệp trung cấp, cao đẳng, đại học trở lên; tài liệu phục vụ đánh giá, đối sánh (bảng điểm, đề cương học phần…).",
    steps: ["cvht", "khoa"],
    fields: [
      { k: "hocPhan", label: "Học phần đề nghị công nhận", type: "table", cols: ["Học phần trong CTĐT của Học viện", "Số tín chỉ", "Học phần/chứng chỉ đã tích lũy", "Nơi cấp"] }
    ]
  },
  {
    key: "chuyen-nganh", nhom: "Công nhận, chuyển đổi", ten: "Chuyển chương trình, ngành đào tạo hoặc nơi học trong Học viện",
    tieuDe: "ĐƠN ĐỀ NGHỊ CHUYỂN CHƯƠNG TRÌNH, NGÀNH ĐÀO TẠO HOẶC NƠI HỌC",
    kinhGui: "Giám đốc Học viện Hành chính và Quản trị công; Ban Quản lý đào tạo",
    canCu: "Khoản 1 Điều 54 " + QC,
    huongDan: "Điều kiện: không ở trình độ năm thứ nhất hoặc năm cuối khóa; không thuộc diện bị xem xét buộc thôi học; còn đủ thời gian học tập; đáp ứng điều kiện trúng tuyển của chương trình, ngành hoặc nơi chuyển đến trong cùng khóa tuyển sinh; nơi chuyển đến còn đủ năng lực đào tạo. Gửi đơn ít nhất 02 tuần trước khi bắt đầu học kỳ mới.",
    minhChung: "",
    steps: ["cvht", "khoa"],
    fields: [
      { k: "loai", label: "Đề nghị chuyển", type: "select", req: true, opts: ["Chuyển chương trình đào tạo", "Chuyển ngành đào tạo", "Chuyển nơi học (Học viện ↔ Phân hiệu)"] },
      { k: "noiDen", label: "Chương trình / ngành / nơi học chuyển đến", type: "text", req: true },
      { ...HK, k: "hocKyChuyen", label: "Từ học kỳ, năm học" }
    ]
  },
  {
    key: "hai-chuong-trinh", nhom: "Công nhận, chuyển đổi", ten: "Đăng ký học cùng lúc hai chương trình",
    tieuDe: "ĐƠN ĐĂNG KÝ HỌC CÙNG LÚC HAI CHƯƠNG TRÌNH",
    kinhGui: "Ban Quản lý đào tạo; Lãnh đạo Khoa",
    canCu: "Điều 35 " + QC,
    huongDan: "Điều kiện: từ năm thứ hai của chương trình thứ nhất; đã tích lũy tối thiểu 25% khối lượng chương trình thứ nhất; điểm trung bình tích lũy từ khá trở lên và đáp ứng ngưỡng chất lượng của chương trình thứ hai, hoặc từ trung bình và đáp ứng điều kiện trúng tuyển chương trình thứ hai. Kế hoạch học tập lập theo hướng dẫn của cố vấn học tập; chương trình thứ hai học 03–13 tín chỉ mỗi học kỳ chính, tối đa 13 tín chỉ học kỳ phụ. Sinh viên vẫn đăng ký trên hệ thống quản lý đào tạo theo quy định.",
    minhChung: "Bảng điểm tích lũy chương trình thứ nhất.",
    steps: ["cvht"],
    fields: [
      { k: "ct2", label: "Chương trình thứ hai đăng ký", type: "text", req: true },
      { k: "tichLuy", label: "Số tín chỉ đã tích lũy / tổng tín chỉ chương trình thứ nhất", type: "text", req: true },
      { k: "dtb", label: "Điểm trung bình tích lũy (thang 4)", type: "number", req: true },
      { k: "keHoach", label: "Kế hoạch học tập dự kiến", type: "textarea" }
    ]
  },
  {
    key: "don-khac", nhom: "Khác", ten: "Đơn đề nghị khác",
    tieuDe: "ĐƠN ĐỀ NGHỊ",
    kinhGui: "Cố vấn học tập; Lãnh đạo Khoa",
    canCu: "",
    huongDan: "Dùng cho các đề nghị chưa có thủ tục riêng. Ghi rõ nội dung đề nghị và lý do.",
    minhChung: "",
    steps: ["cvht"],
    fields: [
      { k: "veViec", label: "Về việc", type: "text", req: true },
      { k: "noiDung", label: "Nội dung đề nghị", type: "textarea", req: true }
    ]
  }
];
