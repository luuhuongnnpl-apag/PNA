/* Bộ thủ tục mặc định của Cổng Thủ tục sinh viên (PNA).
   - Điều kiện, thời hạn, trình tự: Quy chế đào tạo trình độ đại học của Học viện Hành chính và Quản trị công
     ban hành kèm Quyết định số 2567-QĐ/HVHCQTC ngày 09/3/2026.
   - Mẫu đơn: các Phụ lục của Quy chế đào tạo trình độ đại học ban hành kèm Quyết định số 1687/QĐ-HCQG ngày 24/5/2023
     của Học viện Hành chính Quốc gia; đổi tên cơ quan và thể thức (sau hợp nhất) theo Học viện Hành chính và Quản trị công.
   Quản trị viên sửa trên giao diện (lưu ở pna_tt_settings/thutuc); tệp này là bộ khởi tạo.
   Trường nhập: k, label, type: text|textarea|date|number|select|check|table, req, opts, cols, hint.
   Tên đơn vị theo cổng thông tin apag.edu.vn (28/11/2026): Khoa Khoa học liên ngành - Ngoại ngữ - Tin học (thay Khoa Ngoại ngữ - Tin học, Khoa Khoa học liên ngành).
   mau (bố cục in theo Phụ lục): pl, tieuDe2, them[] (dòng thông tin thêm), body[] (đoạn văn), sigs[] (khối ký), kiemTra, lyDo (true | false | "opt").
   Trong body: {mã trường} điền giá trị · {^mã} chữ in hoa · {#mã} bảng · {?mã} ô đánh dấu các lựa chọn · {lyDo} · {minhChung} · {KHOA} · {HV} · "!!" đầu dòng = tiêu đề giữa trang. */
export const TT_VER = "pl1687-2023-v2";
export const QC = "Quy chế đào tạo trình độ đại học (QĐ 2567-QĐ/HVHCQTC ngày 09/3/2026)";
export const MAU_QC = "Quy chế đào tạo trình độ đại học ban hành kèm Quyết định số 1687/QĐ-HCQG ngày 24/5/2023";
export const HV = "Học viện Hành chính và Quản trị công";
export const KHOA_QL = "Khoa Luật";

export const STEP_ROLES = {
  cvht: { name: "Cố vấn học tập", act: "Xác nhận", sign: "XÁC NHẬN CỦA CỐ VẤN HỌC TẬP" },
  khoa: { name: "Lãnh đạo Khoa", act: "Duyệt", sign: "Ý KIẾN CỦA LÃNH ĐẠO KHOA" },
  qldt: { name: "Ban Quản lý đào tạo", act: "Tiếp nhận", sign: "TIẾP NHẬN CỦA BAN QUẢN LÝ ĐÀO TẠO" }
};

const HK = { k: "hocKy", label: "Học kỳ, năm học", type: "text", req: true, hint: "Ví dụ: học kỳ II, năm học 2026–2027" };
const GD = "Giám đốc " + HV;
const KG3 = `${GD}; Ban Quản lý đào tạo; Khoa (quản lý sinh viên): {KHOA}`;
const SV = { t: "NGƯỜI LÀM ĐƠN", sub: "(Ký và ghi rõ họ tên)", role: "sv" };
const CV = { t: "XÁC NHẬN CỦA CỐ VẤN HỌC TẬP HOẶC KHOA QUẢN LÝ SINH VIÊN", role: "cvht" };
const QL = { t: "Ý KIẾN CỦA BAN QUẢN LÝ ĐÀO TẠO", role: "qldt" };
const TCTL = [{ k: "tcTL", label: "Số tín chỉ đã tích lũy", type: "number" }, { k: "gpa", label: "Điểm trung bình chung tích lũy (thang 4)", type: "text" }];
const TRUNG_TUYEN = [{ k: "namTT", label: "Năm trúng tuyển", type: "number", req: true }, { k: "nganhTT", label: "Ngành/chuyên ngành trúng tuyển", type: "text", req: true },
  { k: "toHop", label: "Tổ hợp xét tuyển", type: "text" }, { k: "phuongThuc", label: "Phương thức xét tuyển", type: "text" }, { k: "diemTT", label: "Tổng điểm xét tuyển (có ưu tiên)", type: "text" }];
const B_TRUNG_TUYEN = ["Trong kỳ tuyển sinh đại học hình thức đào tạo chính quy năm {namTT}, em đã trúng tuyển vào ngành/chuyên ngành {nganhTT}, cụ thể như sau:",
  "Tổ hợp xét tuyển: {toHop}; Phương thức xét tuyển: {phuongThuc}.", "Tổng điểm xét tuyển (có ưu tiên): {diemTT} điểm."];
const MC = ["* Các minh chứng trong hồ sơ kèm theo:", "{minhChung}"];
const CAM_ON = "Em xin trân trọng cảm ơn.";

export const THU_TUC = [
  {
    key: "dang-ky-hoc-phan", nhom: "Đăng ký học tập", ten: "Đăng ký học phần (trường hợp đặc biệt)",
    tieuDe: "ĐƠN ĐĂNG KÝ HỌC PHẦN",
    kinhGui: "Ban Quản lý đào tạo; Khoa (quản lý sinh viên): {KHOA}",
    canCu: "Điều 9 " + QC,
    huongDan: "Thời hạn: 02 tuần đầu học kỳ chính, 01 tuần đầu học kỳ phụ. Khối lượng học kỳ chính từ 15 đến 26 tín chỉ (không tính Giáo dục thể chất, Giáo dục quốc phòng – an ninh); sinh viên bị xếp học lực yếu, kém hoặc bị cảnh báo học tập ở học kỳ trước chỉ được đăng ký tối đa 15 tín chỉ (điểm c khoản 1 Điều 9).",
    minhChung: "",
    steps: ["cvht"],
    fields: [HK, { k: "hocPhan", label: "Các học phần đăng ký", type: "table", req: true, cols: ["Mã học phần", "Tên học phần", "Số tín chỉ", "Lớp học phần đăng ký", "Học kỳ", "Ghi chú"] }, { k: "tongTC", label: "Tổng số tín chỉ đăng ký", type: "number", req: true }],
    mau: { pl: "Phụ lục 1", lyDo: false, body: ["Đăng ký học các học phần sau đây ({hocKy}):", "{#hocPhan}", "Tổng số tín chỉ đăng ký: {tongTC}", "Kính đề nghị Ban Quản lý đào tạo tạo điều kiện giúp em hoàn thành chương trình học. Em xin cam đoan thực hiện đúng quy định của Học viện./."], sigs: [{ t: "BAN QLĐT", sub: "(Duyệt)", role: "qldt" }, { t: "Ý KIẾN CỦA KHOA HOẶC CỐ VẤN HỌC TẬP", role: "cvht" }, { t: "SINH VIÊN", sub: "(Ký và ghi rõ họ và tên)", role: "sv" }] }
  },
  {
    key: "hoc-lai-cai-thien", nhom: "Đăng ký học tập", ten: "Đăng ký học lại, học cải thiện điểm học phần",
    tieuDe: "ĐƠN ĐĂNG KÝ HỌC LẠI, HỌC CẢI THIỆN ĐIỂM HỌC PHẦN",
    kinhGui: "Ban Quản lý đào tạo; Khoa (quản lý sinh viên): {KHOA}",
    canCu: "Điều 13 và Quy chế đào tạo trình độ đại học (QĐ 2567-QĐ/HVHCQTC ngày 09/3/2026)",
    huongDan: "Điểm F: thi lại 01 lần tại kỳ thi phụ kế tiếp, không đạt thì đăng ký học lại. Điểm D, D+: được học lại hoặc học phần tương đương, thay thế để cải thiện; điểm chính thức là điểm cao nhất; việc học, thi cải thiện thực hiện trong thời gian đào tạo chuẩn. Sinh viên đã hết thời gian đào tạo chuẩn còn nợ học phần gửi đơn chậm nhất 02 tuần trước học kỳ mới để được xếp lớp.",
    minhChung: "",
    steps: ["cvht"],
    fields: [HK, { k: "hocPhan", label: "Các học phần đăng ký học lại, học cải thiện (ghi x vào cột tương ứng)", type: "table", req: true, cols: ["Mã học phần", "Tên học phần", "Số tín chỉ", "Lớp học phần đăng ký", "Học kỳ", "Học lại", "Học cải thiện", "Ghi chú"] }, { k: "tongTC", label: "Tổng số tín chỉ đăng ký học lại, học cải thiện điểm", type: "number", req: true }],
    mau: { pl: "Phụ lục 1", lyDo: false, body: ["Đăng ký học lại, học cải thiện điểm đối với các học phần sau đây ({hocKy}):", "{#hocPhan}", "Tổng số tín chỉ đăng ký học lại, học cải thiện điểm: {tongTC}", "Kính đề nghị Ban Quản lý đào tạo tạo điều kiện giúp em hoàn thành chương trình học. Em xin cam đoan thực hiện đúng quy định của Học viện./."], sigs: [{ t: "BAN QLĐT", sub: "(Duyệt)", role: "qldt" }, { t: "Ý KIẾN CỦA KHOA HOẶC CỐ VẤN HỌC TẬP", role: "cvht" }, { t: "SINH VIÊN", sub: "(Ký và ghi rõ họ và tên)", role: "sv" }] }
  },
  {
    key: "rut-hoc-phan", nhom: "Đăng ký học tập", ten: "Rút bớt học phần đã đăng ký",
    tieuDe: "ĐƠN ĐỀ NGHỊ RÚT HỌC PHẦN",
    kinhGui: "Ban Quản lý đào tạo",
    canCu: "Điều 9 " + QC,
    huongDan: "Thời hạn: 02 tuần đầu học kỳ chính, 01 tuần đầu học kỳ phụ. Khối lượng học kỳ chính từ 15 đến 26 tín chỉ (không tính Giáo dục thể chất, Giáo dục quốc phòng – an ninh); sinh viên bị xếp học lực yếu, kém hoặc bị cảnh báo học tập ở học kỳ trước chỉ được đăng ký tối đa 15 tín chỉ (điểm c khoản 1 Điều 9).",
    minhChung: "",
    steps: ["cvht"],
    fields: [{ k: "dot", label: "Đợt đăng ký", type: "text" }, HK, { k: "tongDK", label: "Tổng số tín chỉ đã đăng ký", type: "number", req: true }, { k: "daDK", label: "Các học phần đã đăng ký", type: "table", req: true, cols: ["Tên lớp học phần", "Tên học phần", "Mã học phần", "Số tín chỉ"] }, { k: "rut", label: "Các học phần xin rút", type: "table", req: true, cols: ["Tên lớp học phần", "Tên học phần", "Mã học phần", "Số tín chỉ"] }],
    mau: { pl: "Phụ lục 2", tieuDe2: "{hocKy}", body: ["Đợt {dot}, {hocKy}, em đã đăng ký học tổng số {tongDK} tín chỉ các học phần sau:", "{#daDK}", "Vì lý do: {lyDo}", "Em làm đơn này kính đề nghị Ban Quản lý đào tạo cho phép em được rút các học phần sau:", "{#rut}", "Em cam đoan và chịu trách nhiệm về nội dung được ghi trong đơn./."], sigs: [{ t: "BAN QLĐT", sub: "(Ký, ghi rõ họ và tên)", role: "qldt" }, { t: "CỐ VẤN HỌC TẬP", sub: "(Ký, ghi rõ họ và tên)", role: "cvht" }, { t: "NGƯỜI LÀM ĐƠN", sub: "(Ký, ghi rõ họ và tên)", role: "sv" }] }
  },
  {
    key: "hoan-thi", nhom: "Thi, kiểm tra", ten: "Hoãn thi kết thúc học phần",
    tieuDe: "ĐƠN XIN HOÃN THI KẾT THÚC HỌC PHẦN",
    kinhGui: "Trung tâm Khảo thí và Đảm bảo chất lượng đào tạo; Khoa (quản lý sinh viên): {KHOA}",
    canCu: "Khoản 5 Điều 13 Quy chế đào tạo trình độ đại học (QĐ 2567-QĐ/HVHCQTC ngày 09/3/2026) và quy định về tổ chức thi kết thúc học phần của Học viện",
    huongDan: "Học phần được hoãn thi nhận điểm I (chưa hoàn thiện) cho đến khi dự thi bổ sung. Điều kiện, thời hạn nộp đơn theo quy định về tổ chức thi của Học viện.",
    minhChung: "Giấy tờ chứng minh lý do (giấy khám, điều trị; quyết định cử đi công tác, thi đấu…).",
    steps: ["cvht", "khoa"],
    fields: [HK, { k: "hocPhan", label: "Học phần xin hoãn thi", type: "table", req: true, cols: ["Tên học phần", "Số tín chỉ", "Điểm thường xuyên", "Điểm định kỳ", "Giờ/ngày thi"] }],
    mau: { pl: "", body: ["Em làm đơn này kính đề nghị Trung tâm Khảo thí và Đảm bảo chất lượng đào tạo cho phép em được hoãn thi kết thúc các học phần sau ({hocKy}):", "{#hocPhan}", "Lý do: {lyDo}", ...MC, "Em xin cam đoan những thông tin trên là đúng sự thật và thực hiện đúng quy định của Học viện.", CAM_ON], sigs: [CV, SV] }
  },
  {
    key: "phuc-khao", nhom: "Thi, kiểm tra", ten: "Phúc khảo bài thi kết thúc học phần",
    tieuDe: "ĐƠN ĐỀ NGHỊ PHÚC KHẢO BÀI THI",
    kinhGui: "Trung tâm Khảo thí và Đảm bảo chất lượng đào tạo",
    canCu: "Khoản 5 Điều 13 Quy chế đào tạo trình độ đại học (QĐ 2567-QĐ/HVHCQTC ngày 09/3/2026) và quy định về tổ chức thi kết thúc học phần của Học viện",
    huongDan: "Thời hạn, lệ phí phúc khảo theo thông báo của Trung tâm Khảo thí và Đảm bảo chất lượng đào tạo.",
    minhChung: "",
    steps: ["cvht"],
    fields: [HK, { k: "hocPhan", label: "Bài thi đề nghị phúc khảo", type: "table", req: true, cols: ["Tên học phần", "Ngày thi", "Phòng thi / SBD", "Điểm đã công bố"] }],
    mau: { pl: "", body: ["Em làm đơn này kính đề nghị Trung tâm Khảo thí và Đảm bảo chất lượng đào tạo phúc khảo bài thi kết thúc các học phần sau ({hocKy}):", "{#hocPhan}", "Lý do: {lyDo}", "Em xin cam đoan thực hiện đúng quy định về phúc khảo của Học viện.", CAM_ON], sigs: [CV, SV] }
  },
  {
    key: "dang-ky-khoa-luan", nhom: "Khóa luận, tốt nghiệp", ten: "Đăng ký làm khóa luận tốt nghiệp",
    tieuDe: "ĐƠN ĐĂNG KÝ LÀM ĐỒ ÁN/KHÓA LUẬN TỐT NGHIỆP",
    kinhGui: "" + GD + "; Ban Quản lý đào tạo; {KHOA}",
    canCu: MAU_QC + ", Phụ lục 3 (mẫu đơn)",
    huongDan: "Đăng ký khi đáp ứng điều kiện làm khóa luận tốt nghiệp theo Quy chế và kế hoạch của Khoa. Ghi rõ giảng viên hướng dẫn, tên đề tài dự kiến.",
    minhChung: "Bảng điểm tích lũy (nếu Khoa yêu cầu).",
    steps: ["cvht", "khoa"],
    fields: [...TCTL, { k: "gvhd", label: "Giảng viên hướng dẫn", type: "text", req: true }, { k: "tenDeTai", label: "Tên đề tài", type: "textarea", req: true }],
    mau: { pl: "Phụ lục 3", lyDo: false, them: ["Tổng số tín chỉ đã tích lũy: {tcTL}", "Điểm trung bình chung tích lũy (theo thang điểm 4): {gpa}"], body: ["Đối chiếu với tiêu chuẩn, điều kiện quy định người học được đăng ký làm khóa luận tốt nghiệp, em đã đủ điều kiện đăng ký thực hiện đồ án/khóa luận tốt nghiệp. Vậy, em làm đơn này kính đề nghị Giám đốc Học viện, Ban Quản lý đào tạo và {KHOA} cho phép em được đăng ký làm đồ án/khóa luận tốt nghiệp.", "Giảng viên hướng dẫn: {gvhd}", "Tên đề tài: {tenDeTai}", "Em cam kết thực hiện nghiêm túc và đầy đủ các quy định làm đồ án/khóa luận tốt nghiệp của Học viện.", "Xin trân trọng cảm ơn!"], sigs: [{ t: "Ý KIẾN CỦA NGƯỜI HƯỚNG DẪN" }, { t: "NGƯỜI LÀM ĐƠN", sub: "(Ký và ghi rõ họ tên)", role: "sv" }, { t: "XÁC NHẬN CỦA {^KHOA}", role: "khoa" }] }
  },
  {
    key: "doi-ten-de-tai", nhom: "Khóa luận, tốt nghiệp", ten: "Thay đổi tên đề tài khóa luận tốt nghiệp",
    tieuDe: "ĐƠN ĐỀ NGHỊ THAY ĐỔI TÊN ĐỀ TÀI ĐỒ ÁN/KHÓA LUẬN TỐT NGHIỆP",
    kinhGui: "" + GD + "; Ban Quản lý đào tạo; {KHOA}",
    canCu: MAU_QC + ", Phụ lục 4 (mẫu đơn)",
    huongDan: "Gửi đơn trong thời hạn Khoa cho phép điều chỉnh đề tài; có ý kiến đồng ý của người hướng dẫn.",
    minhChung: "",
    steps: ["cvht", "khoa"],
    fields: [{ k: "tenCu", label: "Tên đề tài khóa luận tốt nghiệp (đã đăng ký)", type: "textarea", req: true }, { k: "gvhd", label: "Giảng viên hướng dẫn", type: "text", req: true }, { k: "tenMoi", label: "Tên đề tài khóa luận tốt nghiệp (mới)", type: "textarea", req: true }],
    mau: { pl: "Phụ lục 4", body: ["Tên đề tài khóa luận tốt nghiệp: {tenCu}", "Giảng viên hướng dẫn: {gvhd}", "Em xin được thay đổi đề tài khóa luận tốt nghiệp như sau:", "Tên đề tài khóa luận tốt nghiệp (mới): {tenMoi}", "Lý do thay đổi: {lyDo}", "Vì vậy, em làm đơn này kính đề nghị Giám đốc Học viện, Ban Quản lý đào tạo, {KHOA} xem xét và tạo điều kiện cho em được thay đổi đề tài khóa luận tốt nghiệp.", "Em cam kết thực hiện nghiêm túc và đầy đủ các quy định thực hiện khóa luận tốt nghiệp của Học viện.", "Xin trân trọng cảm ơn!"], sigs: [{ t: "Ý KIẾN CỦA NGƯỜI HƯỚNG DẪN" }, { t: "NGƯỜI LÀM ĐƠN", sub: "(Ký và ghi rõ họ tên)", role: "sv" }, { t: "XÁC NHẬN CỦA {^KHOA}", role: "khoa" }] }
  },
  {
    key: "lam-lai-khoa-luan", nhom: "Khóa luận, tốt nghiệp", ten: "Đăng ký làm lại khóa luận tốt nghiệp",
    tieuDe: "ĐƠN ĐĂNG KÝ LÀM LẠI ĐỒ ÁN/KHÓA LUẬN TỐT NGHIỆP",
    kinhGui: "" + GD + "; Ban Quản lý đào tạo; {KHOA}",
    canCu: MAU_QC + ", Phụ lục 5 (mẫu đơn)",
    huongDan: "Dành cho sinh viên có đồ án/khóa luận tốt nghiệp bị điểm F; làm lại cùng các khóa học cùng hình thức đào tạo.",
    minhChung: "",
    steps: ["cvht", "khoa"],
    fields: [{ k: "dotDG", label: "Đợt đánh giá khóa luận bị điểm F (tháng … năm …)", type: "text", req: true }],
    mau: { pl: "Phụ lục 5", lyDo: false, body: ["Trong đợt đánh giá đồ án/khóa luận tốt nghiệp {dotDG}, đồ án/khóa luận tốt nghiệp của em bị điểm F.", "Vì vậy, em làm đơn này kính đề nghị Giám đốc Học viện, Ban Quản lý đào tạo, {KHOA} xem xét và tạo điều kiện cho em được làm lại đồ án/khóa luận tốt nghiệp với các khóa học cùng hình thức đào tạo.", "Em cam kết sẽ hoàn thành đúng thời gian và chấp hành đúng các quy định của Học viện về việc làm lại đồ án/khóa luận tốt nghiệp.", CAM_ON], sigs: [{ t: "XÁC NHẬN CỦA NGƯỜI HƯỚNG DẪN" }, { t: "NGƯỜI LÀM ĐƠN", sub: "(Ký và ghi rõ họ tên)", role: "sv" }, { t: "XÁC NHẬN CỦA {^KHOA}", role: "khoa" }] }
  },
  {
    key: "cong-nhan-tin-chi", nhom: "Công nhận, miễn học", ten: "Công nhận kết quả học tập, chuyển đổi tín chỉ (Tiếng Anh, Tiếng Pháp, Tin học cơ bản)",
    tieuDe: "ĐƠN ĐỀ NGHỊ CÔNG NHẬN KẾT QUẢ HỌC TẬP VÀ CHUYỂN ĐỔI TÍN CHỈ HỌC PHẦN {^mon} TRONG CHƯƠNG TRÌNH ĐÀO TẠO",
    kinhGui: "" + GD + "; Ban Quản lý đào tạo; Khoa Khoa học liên ngành - Ngoại ngữ - Tin học; Khoa (quản lý sinh viên): {KHOA}",
    canCu: "Điều 18 Quy chế đào tạo trình độ đại học (QĐ 2567-QĐ/HVHCQTC ngày 09/3/2026)",
    huongDan: "Nộp hồ sơ ít nhất 30 ngày trước thời điểm tổ chức đăng ký học phần theo kế hoạch đào tạo. Mang bản chính để đối chiếu khi Ban Quản lý đào tạo yêu cầu.",
    minhChung: "Bản sao có chứng thực chứng chỉ ngoại ngữ, công nghệ thông tin; bản sao có chứng thực bằng tốt nghiệp trung cấp, cao đẳng, đại học trở lên; tài liệu phục vụ đánh giá, đối sánh (bảng điểm, đề cương học phần…).",
    steps: ["cvht", "khoa"],
    fields: [{ k: "mon", label: "Học phần đề nghị công nhận", type: "select", req: true, opts: ["Tiếng Anh", "Tiếng Pháp", "Tin học cơ bản"] }, { k: "hocPhan", label: "Học phần cụ thể", type: "table", req: true, cols: ["Tên học phần", "Số tín chỉ", "Ghi chú"] }],
    mau: { pl: "Phụ lục 7, 8, 9", body: ["Em làm đơn này kính đề nghị Giám đốc Học viện và Ban Quản lý đào tạo, Khoa Khoa học liên ngành - Ngoại ngữ - Tin học xem xét và cho phép em được công nhận kết quả học tập và chuyển đổi tín chỉ học phần {mon} trong chương trình đào tạo. Cụ thể như sau:", "{#hocPhan}", "Lý do: {lyDo}", ...MC], sigs: [CV, SV, { t: "Ý KIẾN CỦA KHOA KHOA HỌC LIÊN NGÀNH - NGOẠI NGỮ - TIN HỌC" }, QL] }
  },
  {
    key: "mien-gdtc", nhom: "Công nhận, miễn học", ten: "Miễn học phần, miễn nội dung thực hành Giáo dục thể chất",
    tieuDe: "ĐƠN ĐỀ NGHỊ MIỄN HỌC PHẦN, MIỄN NỘI DUNG THỰC HÀNH GIÁO DỤC THỂ CHẤT",
    kinhGui: "" + GD + "; Ban Quản lý đào tạo; Khoa Khoa học liên ngành - Ngoại ngữ - Tin học; Khoa (quản lý sinh viên): {KHOA}",
    canCu: MAU_QC + ", Phụ lục 10 (mẫu đơn)",
    huongDan: "Sinh viên thống kê đầy đủ học phần hoặc nội dung thực hành xin miễn học; nộp kèm minh chứng (giấy xác nhận của cơ sở khám bệnh, chữa bệnh; chứng chỉ, kết quả đã học…).",
    minhChung: "Giấy xác nhận tình trạng sức khỏe của cơ sở khám bệnh, chữa bệnh; bảng điểm, chứng chỉ đã tích lũy (nếu có).",
    steps: ["cvht", "khoa"],
    fields: [{ k: "deNghi", label: "Đề nghị", type: "check", req: true, opts: ["Miễn học phần Giáo dục thể chất (GDTC).", "Miễn học nội dung thực hành và chuyển qua học nội dung lý luận, nguyên lý kỹ thuật của các môn thể thao trong học phần GDTC."] }, { k: "hocPhan", label: "Học phần hoặc nội dung thực hành xin miễn học", type: "table", req: true, cols: ["Học phần", "Tên nội dung học phần", "Số tín chỉ", "Điểm hệ 10", "Điểm chữ", "Điểm hệ 4", "Ghi chú"] }],
    mau: { pl: "Phụ lục 10", body: ["Em làm đơn này kính đề nghị Giám đốc Học viện và Ban Quản lý đào tạo, Khoa Khoa học liên ngành - Ngoại ngữ - Tin học xem xét và cho phép em được:", "{?deNghi}", "Với lý do: {lyDo}", "!!HỌC PHẦN HOẶC NỘI DUNG THỰC HÀNH XIN MIỄN HỌC", "{#hocPhan}", ...MC], sigs: [CV, SV, { t: "Ý KIẾN CỦA KHOA KHOA HỌC LIÊN NGÀNH - NGOẠI NGỮ - TIN HỌC" }, QL] }
  },
  {
    key: "mien-gdqp", nhom: "Công nhận, miễn học", ten: "Miễn, tạm hoãn học Giáo dục quốc phòng - An ninh",
    tieuDe: "ĐƠN ĐỀ NGHỊ MIỄN, TẠM HOÃN HỌC HỌC PHẦN GIÁO DỤC QUỐC PHÒNG - AN NINH",
    kinhGui: "" + GD + "; Ban Quản lý đào tạo; Khoa Khoa học liên ngành - Ngoại ngữ - Tin học; Khoa (quản lý sinh viên): {KHOA}",
    canCu: MAU_QC + ", Phụ lục 11 (mẫu đơn)",
    huongDan: "Sinh viên thống kê đầy đủ học phần, nội dung xin miễn, tạm hoãn học; nộp kèm minh chứng theo quy định về giáo dục quốc phòng và an ninh.",
    minhChung: "Minh chứng theo từng trường hợp (giấy xác nhận sức khỏe, chứng chỉ GDQP-AN đã có, quyết định, giấy tờ của cơ quan có thẩm quyền…).",
    steps: ["cvht", "khoa"],
    fields: [{ k: "deNghi", label: "Đề nghị", type: "check", req: true, opts: ["Miễn học môn Giáo dục quốc phòng - An ninh (GDQPAN).", "Miễn học, miễn thi học phần, nội dung trong chương trình GDQPAN.", "Miễn học các nội dung thực hành kỹ năng quân sự.", "Tạm hoãn học môn GDQPAN."] }, { k: "hocPhan", label: "Các học phần, nội dung xin miễn, tạm hoãn học", type: "table", req: true, cols: ["Học phần", "Tên nội dung học phần", "Số tín chỉ", "Điểm hệ 10", "Điểm hệ 4", "Ghi chú"] }],
    mau: { pl: "Phụ lục 11", body: ["Em làm đơn này kính đề nghị Giám đốc Học viện và Ban Quản lý đào tạo, Khoa Khoa học liên ngành - Ngoại ngữ - Tin học xem xét và cho phép em được:", "{?deNghi}", "Với lý do: {lyDo}", "!!CÁC HỌC PHẦN, NỘI DUNG XIN MIỄN, TẠM HOÃN HỌC GDQPAN", "{#hocPhan}", ...MC], sigs: [CV, SV, { t: "Ý KIẾN CỦA KHOA KHOA HỌC LIÊN NGÀNH - NGOẠI NGỮ - TIN HỌC" }, QL] }
  },
  {
    key: "xet-tot-nghiep", nhom: "Khóa luận, tốt nghiệp", ten: "Xét, công nhận tốt nghiệp sớm hoặc muộn so với kế hoạch",
    tieuDe: "ĐƠN ĐỀ NGHỊ XÉT, CÔNG NHẬN TỐT NGHIỆP",
    kinhGui: "" + GD + "; Hội đồng xét tốt nghiệp trình độ đại học năm {namTN}; Ban Quản lý đào tạo; Khoa quản lý sinh viên: {KHOA}",
    canCu: MAU_QC + ", Phụ lục 12 (mẫu đơn)",
    huongDan: "Đủ điều kiện tốt nghiệp: tích lũy đủ tín chỉ của chương trình; hoàn thành học phí; có chứng chỉ GDQP-AN, hoàn thành GDTC; đạt chuẩn ngoại ngữ, công nghệ thông tin theo chuẩn đầu ra. Nộp đơn theo đợt xét tốt nghiệp do Học viện thông báo.",
    minhChung: "Chứng chỉ GDQP-AN; chứng chỉ ngoại ngữ, tin học (nếu có).",
    steps: ["cvht", "khoa"],
    fields: [{ k: "nganhTN", label: "Ngành đào tạo", type: "text", req: true }, { k: "hinhThuc", label: "Hình thức đào tạo", type: "select", req: true, opts: ["chính quy", "vừa làm vừa học"] }, { k: "namTS", label: "Áp dụng cho sinh viên trúng tuyển năm", type: "number", req: true }, ...TCTL, { k: "loai", label: "Đề nghị xét tốt nghiệp", type: "check", req: true, opts: ["sớm", "muộn"] }, { k: "dot", label: "Đợt xét", type: "text", req: true }, { k: "namTN", label: "Năm xét tốt nghiệp", type: "number", req: true }],
    mau: { pl: "Phụ lục 12", tieuDe2: "(Dành cho sinh viên đề nghị được xét tốt nghiệp sớm hoặc muộn so với kế hoạch đào tạo)", lyDo: "opt", body: ["Hiện nay, em đã tích lũy đủ số tín chỉ theo quy định của chương trình đào tạo ngành {nganhTN} trình độ đại học hình thức đào tạo {hinhThuc} áp dụng cho sinh viên trúng tuyển năm {namTS}; đã đóng học phí đầy đủ và đã được cấp chứng chỉ GDQP-AN (có chứng chỉ kèm theo), hoàn thành học phần GDTC; đạt chuẩn năng lực ngoại ngữ bậc 3/6 theo Khung năng lực ngoại ngữ của Việt Nam và chuẩn kỹ năng sử dụng công nghệ thông tin cơ bản (kèm theo chứng chỉ - nếu có).", "Số tín chỉ tích lũy: {tcTL} TC. Điểm TBC tích lũy toàn khóa (hệ 4): {gpa}", "Nay em làm đơn này xin được xét, công nhận tốt nghiệp {?loai} so với Kế hoạch đào tạo của khóa học, vào đợt {dot} năm {namTN}.", "(Lý do xét tốt nghiệp muộn: {lyDo})", "Kính mong được sự chấp thuận của Hội đồng xét, công nhận tốt nghiệp năm {namTN}.", "Em xin trân trọng cảm ơn!"], sigs: [CV, SV] }
  },
  {
    key: "trao-doi", nhom: "Học tập khác", ten: "Đăng ký tham gia chương trình trao đổi",
    tieuDe: "ĐƠN ĐĂNG KÝ THAM GIA CHƯƠNG TRÌNH {^loai}",
    kinhGui: "" + GD + "; Ban Quản lý đào tạo; Khoa (quản lý sinh viên): {KHOA}",
    canCu: MAU_QC + ", Phụ lục 13 (mẫu đơn), Phụ lục 14 (bản cam kết)",
    huongDan: "Theo thông báo tuyển chọn sinh viên tham gia chương trình trao đổi của Học viện. Sinh viên được chọn ký thêm Bản cam kết khi tham gia chương trình trao đổi (Phụ lục 14).",
    minhChung: "Bảng điểm tích lũy; giấy tờ theo thông báo tuyển chọn.",
    steps: ["cvht", "khoa"],
    fields: [{ k: "loai", label: "Loại chương trình", type: "select", req: true, opts: ["trao đổi tín chỉ", "trao đổi theo thiết kế"] }, { k: "doiTac", label: "Tên cơ sở đào tạo đối tác", type: "text", req: true }, { k: "gpa", label: "Điểm trung bình chung tích lũy", type: "text", req: true }, { k: "thoiGian", label: "Học kỳ, năm học / thời gian tham gia", type: "text", req: true }, { k: "thongBao", label: "Thông báo tuyển chọn (số, ngày)", type: "text" }, { k: "hocPhan", label: "Học phần / chương trình đăng ký", type: "table", req: true, cols: ["Tên học phần / chương trình", "Số tín chỉ / ghi chú"] }],
    mau: { pl: "Phụ lục 13", cols: 3, tieuDe2: "TẠI {^doiTac}", lyDo: false, them: ["Điểm trung bình chung tích lũy: {gpa}"], body: ["Căn cứ thông báo về việc tuyển chọn sinh viên tham gia chương trình {loai} của Học viện, tôi có nguyện vọng đăng ký tham gia ({thoiGian}) tại {doiTac} như sau:", "{#hocPhan}", "Tôi cam đoan việc đăng ký tham gia chương trình {loai} tại {doiTac} là hoàn toàn tự nguyện và đồng ý với mọi nội dung trong Thông báo số {thongBao} của {HV} về việc tuyển chọn sinh viên tham gia chương trình trao đổi."], sigs: [{ t: "XÁC NHẬN CỦA KHOA", role: "khoa" }, { t: "CỐ VẤN HỌC TẬP", role: "cvht" }, { t: "NGƯỜI LÀM ĐƠN", role: "sv" }, { t: "Ý KIẾN CỦA BAN GIÁM ĐỐC" }, { t: "XÁC NHẬN BAN QUẢN LÝ ĐÀO TẠO", role: "qldt" }] }
  },
  {
    key: "hai-chuong-trinh", nhom: "Học tập khác", ten: "Đăng ký học cùng lúc hai chương trình",
    tieuDe: "ĐƠN ĐĂNG KÝ HỌC CÙNG LÚC HAI CHƯƠNG TRÌNH",
    kinhGui: "" + GD + "; Ban Quản lý đào tạo; Khoa (quản lý chương trình thứ hai): {khoa2}",
    canCu: "Điều 35 Quy chế đào tạo trình độ đại học (QĐ 2567-QĐ/HVHCQTC ngày 09/3/2026)",
    huongDan: "Điều kiện: từ năm thứ hai của chương trình thứ nhất; đã tích lũy tối thiểu 25% khối lượng chương trình thứ nhất; điểm trung bình tích lũy từ khá trở lên và đáp ứng ngưỡng chất lượng của chương trình thứ hai, hoặc từ trung bình và đáp ứng điều kiện trúng tuyển chương trình thứ hai. Kế hoạch học tập lập theo hướng dẫn của cố vấn học tập; chương trình thứ hai học 03–13 tín chỉ mỗi học kỳ chính, tối đa 13 tín chỉ học kỳ phụ. Sinh viên vẫn đăng ký trên hệ thống quản lý đào tạo theo quy định.",
    minhChung: "Bảng điểm tích lũy chương trình thứ nhất.",
    steps: ["cvht", "khoa"],
    fields: [{ k: "khoa2", label: "Khoa quản lý chương trình thứ hai", type: "text", req: true }, { k: "nganh2", label: "Ngành của chương trình đào tạo thứ hai", type: "text", req: true }, { k: "mocTinh", label: "Điểm TBC tích lũy tính đến (học kỳ, năm học)", type: "text", req: true }, { k: "gpa", label: "Điểm trung bình chung tích lũy", type: "text", req: true }],
    mau: { pl: "Phụ lục 15", lyDo: false, kiemTra: true, them: ["Khoa (quản lý chương trình đào tạo thứ nhất): {KHOA}", "Điểm trung bình chung tích lũy tính đến {mocTinh}: {gpa}"], body: ["Căn cứ Quy chế đào tạo trình độ đại học của {HV}, em nhận thấy có đủ điều kiện để theo học cùng lúc hai chương trình.", "Vì vậy, em làm đơn này kính mong Học viện cho phép em được theo học chương trình đào tạo thứ hai ngành: {nganh2}", "Em xin cam đoan chấp hành các quy định của Bộ Giáo dục và Đào tạo và của Học viện về việc học cùng lúc hai chương trình. Em xin hoàn toàn chịu trách nhiệm về quyết định của mình.", CAM_ON], sigs: [{ t: "Ý KIẾN CỦA CỐ VẤN HỌC TẬP", sub: "(Ghi rõ ý kiến, ký và ghi rõ họ tên)", role: "cvht" }, { t: "NGƯỜI LÀM ĐƠN", role: "sv" }, { t: "Ý KIẾN CỦA KHOA (QUẢN LÝ CHƯƠNG TRÌNH ĐÀO TẠO THỨ HAI)", role: "khoa" }] }
  },
  {
    key: "tiep-tuc-ct2", nhom: "Học tập khác", ten: "Tiếp tục học chương trình thứ hai",
    tieuDe: "ĐƠN ĐỀ NGHỊ TIẾP TỤC HỌC CHƯƠNG TRÌNH THỨ HAI",
    kinhGui: "" + GD + "; Ban Quản lý đào tạo; Khoa (quản lý chương trình thứ hai): {khoa2}",
    canCu: "Điều 35 Quy chế đào tạo trình độ đại học (QĐ 2567-QĐ/HVHCQTC ngày 09/3/2026)",
    huongDan: "Dành cho sinh viên đang học chương trình thứ hai đề nghị tiếp tục theo học khi đáp ứng điều kiện theo Quy chế.",
    minhChung: "Bảng điểm hai chương trình.",
    steps: ["cvht", "khoa"],
    fields: [{ k: "khoa2", label: "Khoa quản lý chương trình thứ hai", type: "text", req: true }, { k: "nganh2", label: "Chương trình đào tạo thứ hai thuộc ngành", type: "text", req: true }, { k: "moc1", label: "Mốc tính điểm chương trình thứ nhất (học kỳ, năm học)", type: "text", req: true }, { k: "gpa1", label: "Điểm TBC tích lũy chương trình thứ nhất", type: "text", req: true }, { k: "moc2", label: "Mốc tính điểm chương trình thứ hai (học kỳ, năm học)", type: "text", req: true }, { k: "gpa2", label: "Điểm TBC tích lũy chương trình thứ hai", type: "text", req: true }],
    mau: { pl: "Phụ lục 16", lyDo: false, kiemTra: true, them: ["Chương trình đào tạo thứ hai thuộc ngành: {nganh2}", "Điểm trung bình chung tích lũy chương trình thứ nhất tính đến {moc1}: {gpa1}", "Điểm trung bình chung tích lũy chương trình thứ hai tính đến {moc2}: {gpa2}"], body: ["Căn cứ Quy chế đào tạo trình độ đại học của {HV}, em có thể tiếp tục theo học chương trình thứ hai.", "Vì vậy, em làm đơn này kính đề nghị Học viện cho phép em được tiếp tục theo học chương trình đào tạo thứ hai.", "Em xin cam đoan chấp hành các quy định của Bộ Giáo dục và Đào tạo và của Học viện về việc học cùng lúc hai chương trình.", CAM_ON], sigs: [{ t: "Ý KIẾN CỦA CỐ VẤN HỌC TẬP", sub: "(Ghi rõ ý kiến, ký và ghi rõ họ tên)", role: "cvht" }, { t: "NGƯỜI LÀM ĐƠN", role: "sv" }] }
  },
  {
    key: "xet-tn-ct2", nhom: "Khóa luận, tốt nghiệp", ten: "Đăng ký xét tốt nghiệp chương trình đào tạo thứ hai",
    tieuDe: "ĐƠN ĐĂNG KÝ XÉT TỐT NGHIỆP",
    kinhGui: "" + GD + "; Ban Quản lý đào tạo; Khoa (quản lý chương trình thứ hai): {khoa2}",
    canCu: MAU_QC + ", Phụ lục 17 (mẫu đơn)",
    huongDan: "Dành cho sinh viên học chương trình đào tạo thứ hai đã đủ điều kiện xét tốt nghiệp.",
    minhChung: "",
    steps: ["cvht", "khoa"],
    fields: [{ k: "khoa2", label: "Khoa quản lý chương trình thứ hai", type: "text", req: true }, { k: "nganh2", label: "Chương trình đào tạo thứ hai thuộc ngành", type: "text", req: true }, { k: "dot", label: "Đợt xét", type: "text", req: true }, { k: "namTN", label: "Năm", type: "number", req: true }],
    mau: { pl: "Phụ lục 17", tieuDe2: "(Dành cho sinh viên học chương trình đào tạo thứ hai)", lyDo: false, them: ["Chương trình đào tạo thứ hai thuộc ngành: {nganh2}"], body: ["Căn cứ Quy chế đào tạo trình độ đại học của {HV}, em có đủ điều kiện để xét tốt nghiệp chương trình đào tạo thứ hai.", "Vì vậy, em làm đơn này đề nghị được xét công nhận tốt nghiệp đợt {dot} năm {namTN}.", CAM_ON], sigs: [{ t: "Ý KIẾN CỦA CỐ VẤN HỌC TẬP", sub: "(Ghi rõ ý kiến, ký và ghi rõ họ tên)", role: "cvht" }, { t: "NGƯỜI LÀM ĐƠN", role: "sv" }] }
  },
  {
    key: "nghi-hoc-tam-thoi", nhom: "Học vụ", ten: "Nghỉ học tạm thời",
    tieuDe: "ĐƠN ĐỀ NGHỊ NGHỈ HỌC TẠM THỜI",
    kinhGui: "" + GD + "; Ban Quản lý đào tạo; Khoa (quản lý sinh viên): {KHOA}",
    canCu: "Khoản 1, 2, 3 Điều 53 Quy chế đào tạo trình độ đại học (QĐ 2567-QĐ/HVHCQTC ngày 09/3/2026)",
    huongDan: "Được nghỉ khi: (a) điều động vào lực lượng vũ trang; (b) được điều động đại diện quốc gia dự thi, giải đấu quốc tế hoặc thực hiện nhiệm vụ quốc gia, quốc tế; (c) ốm, thai sản, tai nạn phải điều trị dài ngày có chứng nhận của cơ sở khám bệnh, chữa bệnh; (d) lý do cá nhân khác nhưng đã học tối thiểu 01 học kỳ ở Học viện và không thuộc diện bị xem xét buộc thôi học hoặc kỷ luật. Nghỉ vì lý do cá nhân không quá 01 năm và được tính vào thời gian học chính thức. Giám đốc Học viện xem xét, quyết định.",
    minhChung: "Bản sao chứng thực Lệnh gọi nhập ngũ/tham gia nghĩa vụ công an; hoặc Quyết định điều động; hoặc Giấy chứng sinh/giấy chứng nhận điều trị bệnh, tai nạn (tùy trường hợp).",
    steps: ["cvht", "khoa"],
    fields: [...TCTL, { k: "tuNgay", label: "Nghỉ học tạm thời từ ngày", type: "date", req: true }, { k: "denNgay", label: "Đến ngày", type: "date", req: true }, { k: "truongHop", label: "Lý do nghỉ học tạm thời", type: "check", req: true, opts: ["Được động viên vào lực lượng vũ trang", "Được cơ quan có thẩm quyền điều động, đại diện quốc gia tham dự các kỳ thi, giải đấu quốc tế", "Bị ốm, thai sản hoặc tai nạn có giấy xác nhận của cơ sở khám bệnh, chữa bệnh", "Lý do cá nhân"] }],
    mau: { pl: "Phụ lục 20", them: ["Số tín chỉ đã tích lũy: {tcTL}. Điểm trung bình chung tích lũy: {gpa}"], body: ["Em làm đơn này đề nghị Giám đốc Học viện, Ban Quản lý đào tạo, Khoa (quản lý sinh viên) cho phép em được nghỉ học tạm thời từ ngày {tuNgay} đến ngày {denNgay}.", "Lý do nghỉ học tạm thời:", "{?truongHop}", "Trình bày cụ thể: {lyDo}", "Minh chứng kèm theo:", "{minhChung}", "Em xin cam đoan lý do và hồ sơ nêu trên là đúng sự thực và em cam kết thực hiện đúng quy định của Học viện.", CAM_ON], sigs: [SV] }
  },
  {
    key: "tro-lai-hoc", nhom: "Học vụ", ten: "Trở lại học tập sau thời gian nghỉ học tạm thời",
    tieuDe: "ĐƠN ĐỀ NGHỊ TRỞ LẠI HỌC TẬP",
    kinhGui: "" + GD + "; Ban Quản lý đào tạo; Khoa (quản lý ngành/chuyên ngành đào tạo): {KHOA}",
    canCu: "Điểm a, b khoản 4 Điều 53 Quy chế đào tạo trình độ đại học (QĐ 2567-QĐ/HVHCQTC ngày 09/3/2026)",
    huongDan: "Gửi đơn ít nhất 02 tuần trước khi bắt đầu học kỳ mới và trước khi hết thời gian nghỉ ghi trong quyết định. Trường hợp nghỉ do điều động vào lực lượng vũ trang: gửi trong vòng 15 ngày kể từ ngày có quyết định xuất ngũ. Quá 30 ngày làm việc kể từ ngày hết thời gian nghỉ mà không gửi đơn thì bị coi là tự ý bỏ học (điểm d khoản 4 Điều 53).",
    minhChung: "Bản sao chứng thực Quyết định xuất ngũ; hoặc Quyết định điều động và báo cáo kết quả có xác nhận của cơ quan điều động; hoặc Giấy chứng sinh/giấy ra viện; Giấy xác nhận của chính quyền/công an địa phương về việc chấp hành quy định và hoàn thành nghĩa vụ công dân nơi cư trú.",
    steps: ["cvht", "khoa"],
    fields: [{ k: "tuNgay", label: "Được nghỉ học tạm thời từ ngày", type: "date", req: true }, { k: "denNgay", label: "Đến ngày", type: "date", req: true }, { k: "soQD", label: "Theo Quyết định số, ngày", type: "text", req: true }],
    mau: { pl: "Phụ lục 21", lyDo: false, kiemTra: true, body: ["Em đã được Học viện cho nghỉ học tạm thời từ ngày {tuNgay} đến ngày {denNgay} theo Quyết định số {soQD}.", "Em làm đơn này kính đề nghị Học viện cho phép em được trở lại học tập sau thời gian nghỉ học tạm thời.", "Minh chứng kèm theo:", "{minhChung}", "Em xin cam đoan hồ sơ nêu trên là đúng sự thực và em cam kết thực hiện đúng quy định của Học viện.", CAM_ON], sigs: [SV] }
  },
  {
    key: "gia-han-nghi", nhom: "Học vụ", ten: "Tiếp tục nghỉ học tạm thời (gia hạn)",
    tieuDe: "ĐƠN ĐỀ NGHỊ TIẾP TỤC NGHỈ HỌC TẠM THỜI",
    kinhGui: "" + GD + "; Ban Quản lý đào tạo; Khoa (quản lý sinh viên): {KHOA}",
    canCu: "Điểm c khoản 4 và điểm d khoản 2 Điều 53 Quy chế đào tạo trình độ đại học (QĐ 2567-QĐ/HVHCQTC ngày 09/3/2026)",
    huongDan: "Gửi trong 30 ngày làm việc kể từ ngày hết thời gian nghỉ ghi trong quyết định, khi vì lý do chính đáng chưa thể trở lại học; tổng thời gian nghỉ vì lý do cá nhân không vượt quá 01 năm.",
    minhChung: "Giấy tờ chứng minh lý do chính đáng chưa thể trở lại học.",
    steps: ["cvht", "khoa"],
    fields: [{ k: "tuNgay", label: "Được nghỉ học tạm thời từ ngày", type: "date", req: true }, { k: "denNgay", label: "Đến ngày", type: "date", req: true }, { k: "soQD", label: "Theo Quyết định số, ngày", type: "text", req: true }, { k: "thoiGian", label: "Thời gian đề nghị nghỉ thêm", type: "text", req: true }],
    mau: { pl: "", body: ["Em đã được Học viện cho nghỉ học tạm thời từ ngày {tuNgay} đến ngày {denNgay} theo Quyết định số {soQD}.", "Vì lý do: {lyDo}, em chưa thể trở lại học tập đúng thời hạn.", "Em làm đơn này kính đề nghị Học viện cho phép em được tiếp tục nghỉ học tạm thời thêm {thoiGian}.", "Minh chứng kèm theo:", "{minhChung}", "Em xin cam đoan lý do và hồ sơ nêu trên là đúng sự thực và em cam kết thực hiện đúng quy định của Học viện.", CAM_ON], sigs: [SV] }
  },
  {
    key: "thoi-hoc", nhom: "Học vụ", ten: "Thôi học",
    tieuDe: "ĐƠN ĐỀ NGHỊ THÔI HỌC",
    kinhGui: "" + GD + "; Ban Quản lý đào tạo; Khoa (quản lý sinh viên): {KHOA}",
    canCu: "Khoản 5, 6 Điều 53 Quy chế đào tạo trình độ đại học (QĐ 2567-QĐ/HVHCQTC ngày 09/3/2026)",
    huongDan: "Được xin thôi học vì lý do cá nhân, trừ trường hợp đang bị xem xét buộc thôi học hoặc xem xét kỷ luật. Sinh viên đã thôi học muốn quay lại phải dự tuyển đầu vào như thí sinh khác. Cố vấn học tập sẽ trao đổi trực tiếp với sinh viên trước khi xác nhận.",
    minhChung: "",
    steps: ["cvht", "khoa"],
    fields: [...TCTL],
    mau: { pl: "Phụ lục 22", them: ["Số tín chỉ đã tích lũy: {tcTL}. Điểm trung bình chung tích lũy: {gpa}"], body: ["Em làm đơn này đề nghị Giám đốc Học viện, Ban Quản lý đào tạo, Khoa (quản lý sinh viên) cho phép em được thôi học.", "Lý do thôi học: {lyDo}", "Em xin trân trọng cảm ơn./."], sigs: [SV] }
  },
  {
    key: "chuyen-nganh", nhom: "Chuyển đổi", ten: "Chuyển ngành, chuyên ngành, chương trình đào tạo",
    tieuDe: "ĐƠN ĐỀ NGHỊ CHUYỂN NGÀNH/CHUYÊN NGÀNH/CHƯƠNG TRÌNH ĐÀO TẠO",
    kinhGui: "" + GD + "; Ban Quản lý đào tạo; Khoa (quản lý ngành chuyển đi): {KHOA}; Khoa (quản lý ngành chuyển đến): {khoaDen}",
    canCu: "Khoản 1 Điều 54 Quy chế đào tạo trình độ đại học (QĐ 2567-QĐ/HVHCQTC ngày 09/3/2026)",
    huongDan: "Điều kiện: không ở trình độ năm thứ nhất hoặc năm cuối khóa; không thuộc diện bị xem xét buộc thôi học; còn đủ thời gian học tập; đáp ứng điều kiện trúng tuyển của chương trình, ngành hoặc nơi chuyển đến trong cùng khóa tuyển sinh; nơi chuyển đến còn đủ năng lực đào tạo. Gửi đơn ít nhất 02 tuần trước khi bắt đầu học kỳ mới.",
    minhChung: "Giấy báo trúng tuyển, kết quả xét tuyển.",
    steps: ["cvht", "khoa"],
    fields: [...TRUNG_TUYEN, { k: "nganhDi", label: "Chuyển từ ngành/chuyên ngành", type: "text", req: true }, { k: "nganhDen", label: "Sang ngành/chuyên ngành", type: "text", req: true }, { k: "khoaDen", label: "Thuộc Khoa (chuyển đến)", type: "text", req: true }],
    mau: { pl: "Phụ lục 23", body: [...B_TRUNG_TUYEN, "Em làm đơn này kính đề nghị Giám đốc Học viện, Ban Quản lý đào tạo, Khoa (quản lý ngành chuyển đi), Khoa (quản lý ngành chuyển đến) xem xét cho em được chuyển từ ngành/chuyên ngành {nganhDi} thuộc {KHOA} sang ngành/chuyên ngành {nganhDen} thuộc {khoaDen}.", "Lý do chuyển ngành/chuyên ngành: {lyDo}", "Kính mong Giám đốc Học viện, Ban Quản lý đào tạo, Khoa (quản lý ngành chuyển đi), Khoa (quản lý ngành chuyển đến) xem xét và giải quyết cho em được chuyển ngành/chuyên ngành.", "Em xin trân trọng cảm ơn./."], sigs: [{ t: "Ý KIẾN CỦA CỐ VẤN HỌC TẬP", role: "cvht" }, { t: "NGƯỜI LÀM ĐƠN", sub: "(Ký tên, ghi rõ họ tên)", role: "sv" }, { t: "Ý KIẾN CỦA KHOA QUẢN LÝ NGÀNH CHUYỂN ĐI", role: "khoa" }, { t: "Ý KIẾN CỦA BAN QUẢN LÝ ĐT", role: "qldt" }, { t: "Ý KIẾN CỦA KHOA QUẢN LÝ NGÀNH CHUYỂN ĐẾN" }] }
  },
  {
    key: "chuyen-dia-diem", nhom: "Chuyển đổi", ten: "Chuyển địa điểm học tập (trụ sở chính – phân hiệu)",
    tieuDe: "ĐƠN ĐỀ NGHỊ CHUYỂN ĐỊA ĐIỂM HỌC TẬP",
    kinhGui: "" + GD + "; Ban Quản lý đào tạo; Phân hiệu (nơi chuyển đi hoặc chuyển đến): {phanHieu}",
    canCu: "Khoản 1 Điều 54 Quy chế đào tạo trình độ đại học (QĐ 2567-QĐ/HVHCQTC ngày 09/3/2026)",
    huongDan: "Điều kiện: không ở trình độ năm thứ nhất hoặc năm cuối khóa; không thuộc diện bị xem xét buộc thôi học; còn đủ thời gian học tập; đáp ứng điều kiện trúng tuyển của chương trình, ngành hoặc nơi chuyển đến trong cùng khóa tuyển sinh; nơi chuyển đến còn đủ năng lực đào tạo. Gửi đơn ít nhất 02 tuần trước khi bắt đầu học kỳ mới.",
    minhChung: "Giấy báo trúng tuyển; giấy tờ chứng minh nơi cư trú (nếu có).",
    steps: ["cvht", "khoa"],
    fields: [{ k: "phanHieu", label: "Phân hiệu (nơi chuyển đi hoặc chuyển đến)", type: "text", req: true }, { k: "noiSinh", label: "Nơi sinh", type: "text", req: true }, { k: "thuongTru", label: "Nơi thường trú", type: "text", req: true }, { k: "noiO", label: "Nơi ở hiện tại", type: "text", req: true }, ...TRUNG_TUYEN, { k: "noiTT", label: "Trúng tuyển tại (trụ sở chính/phân hiệu)", type: "text", req: true }, { k: "chuyenTu", label: "Chuyển địa điểm học từ", type: "text", req: true, hint: "Ví dụ: trụ sở chính Hà Nội" }, { k: "chuyenVe", label: "Về", type: "text", req: true }],
    mau: { pl: "Phụ lục 24", them: ["Nơi sinh: {noiSinh}", "Nơi thường trú: {thuongTru}", "Nơi ở hiện tại: {noiO}"], body: ["Trong kỳ tuyển sinh đại học hình thức đào tạo chính quy năm {namTT}, em đã trúng tuyển vào ngành/chuyên ngành {nganhTT} tại {noiTT}, cụ thể như sau:", "Tổ hợp xét tuyển: {toHop}; Phương thức xét tuyển: {phuongThuc}.", "Tổng điểm xét tuyển (có ưu tiên): {diemTT} điểm.", "Em làm đơn này kính đề nghị Giám đốc Học viện, Ban Quản lý đào tạo, Phân hiệu (nơi chuyển đi hoặc chuyển đến) xem xét cho em được chuyển địa điểm học từ {chuyenTu} về {chuyenVe}.", "Lý do chuyển địa điểm học tập: {lyDo}", "Kính mong Giám đốc Học viện, Ban Quản lý đào tạo, Phân hiệu (nơi chuyển đi hoặc chuyển đến) xem xét và giải quyết cho em được chuyển địa điểm học tập.", "Em xin trân trọng cảm ơn./."], sigs: [{ t: "Ý KIẾN CỦA CỐ VẤN HỌC TẬP", role: "cvht" }, { t: "NGƯỜI LÀM ĐƠN", sub: "(Ký tên, ghi rõ họ tên)", role: "sv" }, { t: "Ý KIẾN CỦA LÃNH ĐẠO ĐỊA ĐIỂM HỌC TẬP CHUYỂN ĐI", role: "khoa" }, { t: "Ý KIẾN CỦA BAN QUẢN LÝ ĐT", role: "qldt" }, { t: "Ý KIẾN CỦA LÃNH ĐẠO ĐỊA ĐIỂM HỌC TẬP CHUYỂN ĐẾN" }] }
  },
  {
    key: "chuyen-co-so", nhom: "Chuyển đổi", ten: "Chuyển cơ sở đào tạo",
    tieuDe: "ĐƠN ĐỀ NGHỊ CHUYỂN CƠ SỞ ĐÀO TẠO",
    kinhGui: "" + GD + "; {thuTruong} (Thủ trưởng cơ sở đào tạo chuyển đến)",
    canCu: "Điều 54 " + QC,
    huongDan: "Điều kiện, hồ sơ chuyển cơ sở đào tạo theo Quy chế đào tạo của Học viện và quy định của cơ sở đào tạo chuyển đến.",
    minhChung: "Giấy báo trúng tuyển, kết quả xét tuyển; văn bản đồng ý tiếp nhận của cơ sở đào tạo chuyển đến (nếu có).",
    steps: ["cvht", "khoa"],
    fields: [{ k: "thuTruong", label: "Thủ trưởng cơ sở đào tạo chuyển đến (chức danh, tên cơ sở)", type: "text", req: true }, { k: "noiSinh", label: "Nơi sinh", type: "text", req: true }, { k: "thuongTru", label: "Nơi thường trú", type: "text", req: true }, { k: "noiO", label: "Nơi ở hiện tại", type: "text", req: true }, ...TRUNG_TUYEN, { k: "coSoDen", label: "Tên cơ sở đào tạo chuyển đến", type: "text", req: true }],
    mau: { pl: "Phụ lục 25", them: ["Nơi sinh: {noiSinh}", "Nơi thường trú: {thuongTru}", "Nơi ở hiện tại: {noiO}"], body: ["Trong kỳ tuyển sinh đại học hình thức đào tạo chính quy năm {namTT}, em đã trúng tuyển vào ngành/chuyên ngành {nganhTT} của {HV}, cụ thể như sau:", "Tổ hợp xét tuyển: {toHop}; Phương thức xét tuyển: {phuongThuc}.", "Tổng điểm xét tuyển (có ưu tiên): {diemTT} điểm.", "Nay em làm đơn này kính đề nghị Giám đốc {HV} xem xét cho em được chuyển sang {coSoDen}.", "Lý do chuyển cơ sở đào tạo: {lyDo}", "Kính mong Giám đốc {HV} và {thuTruong} xem xét và giải quyết cho em được chuyển cơ sở đào tạo.", "Em xin chân thành cảm ơn./."], sigs: [{ t: "NGƯỜI LÀM ĐƠN", sub: "(Ký tên, ghi rõ họ tên)", role: "sv" }, { t: "GIÁM ĐỐC {^HV}" }, { t: "THỦ TRƯỞNG CƠ SỞ ĐÀO TẠO CHUYỂN ĐẾN" }] }
  },
  {
    key: "chuyen-hinh-thuc", nhom: "Chuyển đổi", ten: "Chuyển hình thức đào tạo (chính quy sang vừa làm vừa học/từ xa)",
    tieuDe: "ĐƠN ĐỀ NGHỊ CHUYỂN HÌNH THỨC ĐÀO TẠO",
    kinhGui: "" + GD + "; Ban Quản lý đào tạo; Khoa (quản lý ngành/chuyên ngành/chương trình đào tạo hình thức chính quy): {KHOA}; Khoa (quản lý ngành/chuyên ngành/chương trình đào tạo hình thức vừa làm vừa học/từ xa): {khoaDen}",
    canCu: "Điều 54 " + QC,
    huongDan: "Điều kiện, thời hạn theo Quy chế đào tạo của Học viện.",
    minhChung: "Giấy báo trúng tuyển, kết quả xét tuyển.",
    steps: ["cvht", "khoa"],
    fields: [...TRUNG_TUYEN, { k: "nganhDi", label: "Chuyển từ ngành/chuyên ngành (hình thức chính quy)", type: "text", req: true }, { k: "nganhDen", label: "Sang ngành/chuyên ngành (hình thức vừa làm vừa học/từ xa)", type: "text", req: true }, { k: "khoaDen", label: "Khoa quản lý hình thức vừa làm vừa học/từ xa", type: "text", req: true }],
    mau: { pl: "Phụ lục 26", them: ["Ngành học hình thức chính quy: {nganhDi} thuộc {KHOA}"], body: [...B_TRUNG_TUYEN, "Em làm đơn này kính đề nghị Giám đốc Học viện, Ban Quản lý đào tạo, Khoa (quản lý ngành/chuyên ngành/chương trình đào tạo hình thức chính quy), Khoa (quản lý ngành/chuyên ngành/chương trình đào tạo hình thức vừa làm vừa học/từ xa) xem xét cho em được chuyển từ ngành/chuyên ngành {nganhDi} hình thức chính quy sang ngành/chuyên ngành {nganhDen} hình thức vừa làm vừa học/từ xa.", "Lý do chuyển hình thức đào tạo: {lyDo}", "Kính đề nghị Giám đốc Học viện, Ban Quản lý đào tạo, Khoa (quản lý ngành chuyển đi), Khoa (quản lý ngành chuyển đến) xem xét và giải quyết cho em được chuyển hình thức đào tạo.", "Em xin trân trọng cảm ơn./."], sigs: [{ t: "Ý KIẾN CỦA CỐ VẤN HỌC TẬP", role: "cvht" }, { t: "NGƯỜI LÀM ĐƠN", sub: "(Ký tên, ghi rõ họ tên)", role: "sv" }, { t: "Ý KIẾN CỦA KHOA QUẢN LÝ NGÀNH HÌNH THỨC CHÍNH QUY", role: "khoa" }, { t: "Ý KIẾN CỦA BAN QUẢN LÝ ĐT", role: "qldt" }, { t: "Ý KIẾN CỦA KHOA QUẢN LÝ NGÀNH HÌNH THỨC VLVH/TỪ XA" }] }
  },
  {
    key: "don-khac", nhom: "Khác", ten: "Đơn đề nghị khác",
    tieuDe: "ĐƠN ĐỀ NGHỊ",
    kinhGui: "Cố vấn học tập; Khoa (quản lý sinh viên): {KHOA}",
    canCu: "",
    huongDan: "Dùng cho các đề nghị chưa có thủ tục riêng. Ghi rõ nội dung đề nghị và lý do.",
    minhChung: "",
    steps: ["cvht"],
    fields: [{ k: "veViec", label: "Về việc", type: "text", req: true }, { k: "noiDung", label: "Nội dung đề nghị", type: "textarea", req: true }],
    mau: { pl: "", tieuDe2: "(V/v: {veViec})", body: ["Em làm đơn này kính đề nghị: {noiDung}", "Lý do: {lyDo}", ...MC, "Em xin cam đoan những thông tin trên là đúng sự thật.", CAM_ON], sigs: [CV, SV] }
  }
];
