/* =====================================================================
   MẪU VĂN BẢN dùng chung (PNA): biên bản họp các loại, đơn không có mẫu trong Quy chế, văn bản cá nhân.
   Dùng ở: Tạo văn bản ghi chú (kho tài liệu), Biên bản họp của lớp (sv-bb), Sổ tay sinh viên.
   mau(id, ctx) → HTML; ctx = { tieuDe, lop, khoa ("Khoa Luật"), chiDoan, hoTen, mssv, ngaySinh, sdt, ngay (Date) }.
   Thể thức: văn bản của lớp, đơn theo Học viện Hành chính và Quản trị công (HVCTQG HCM · ĐẢNG CỘNG SẢN VIỆT NAM);
   văn bản Đoàn, Hội theo đầu văn bản của Đoàn TNCS Hồ Chí Minh, Hội Sinh viên Việt Nam.
   ===================================================================== */
const e = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const D = "…………………………";
const ngayStr = d => { d = d || new Date(); return `Hà Nội, ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`; };
const TB = 'style="width:100%;border:0;border-collapse:collapse;margin-bottom:12px"', TD = w => `style="border:0;text-align:center;vertical-align:top;width:${w}%"`;
/* Đầu văn bản */
function head(kind, c) {
  const lop = e(c.lop || "………"), khoa = e((c.khoa || "Khoa Luật").toUpperCase());
  if (kind === "doan") return `<table ${TB}><tr><td ${TD(48)}>ĐOÀN HỌC VIỆN HÀNH CHÍNH VÀ QUẢN TRỊ CÔNG<br>LIÊN CHI ĐOÀN ${khoa}<br><b>BCH CHI ĐOÀN ${e(c.chiDoan || c.lop || "………")}</b><br>***</td><td ${TD(52)}><b><u>ĐOÀN TNCS HỒ CHÍ MINH</u></b><br><br><i>${ngayStr(c.ngay)}</i></td></tr></table>`;
  if (kind === "hoi") return `<table ${TB}><tr><td ${TD(48)}>HỘI SINH VIÊN HỌC VIỆN<br>HÀNH CHÍNH VÀ QUẢN TRỊ CÔNG<br><b>CHI HỘI ${e(c.chiDoan || c.lop || "………")}</b><br>***</td><td ${TD(52)}><b><u>HỘI SINH VIÊN VIỆT NAM</u></b><br><br><i>${ngayStr(c.ngay)}</i></td></tr></table>`;
  if (kind === "lop") return `<table ${TB}><tr><td ${TD(48)}>HỌC VIỆN HÀNH CHÍNH<br>VÀ QUẢN TRỊ CÔNG<br><b>${khoa}</b><br><b>LỚP: ${lop}</b><br>*</td><td ${TD(52)}><b><u>ĐẢNG CỘNG SẢN VIỆT NAM</u></b><br><br><i>${ngayStr(c.ngay)}</i></td></tr></table>`;
  return `<table ${TB}><tr><td ${TD(48)}>HỌC VIỆN CHÍNH TRỊ QUỐC GIA<br>HỒ CHÍ MINH<br><b>HỌC VIỆN HÀNH CHÍNH<br>VÀ QUẢN TRỊ CÔNG</b><br>*</td><td ${TD(52)}><b><u>ĐẢNG CỘNG SẢN VIỆT NAM</u></b><br><br><i>${ngayStr(c.ngay)}</i></td></tr></table>`;
}
const sig = (a, b) => `<table ${TB}><tr><td ${TD(50)}><b>${a[0]}</b><br><i>${a[1] || "(Ký, ghi rõ họ tên)"}</i><br><br><br><br>${a[2] || ""}</td><td ${TD(50)}><b>${b[0]}</b><br><i>${b[1] || "(Ký, ghi rõ họ tên)"}</i><br><br><br><br>${b[2] || ""}</td></tr></table>`;
const h1 = (t, sub) => `<p style="text-align:center;margin:14px 0 2px"><b>${t}</b></p>${sub ? `<p style="text-align:center;margin:0 0 10px"><b>${sub}</b></p>` : ""}`;
/* Biên bản họp: khung chung */
function bienBan(kind, ten, c, opt = {}) {
  return head(kind, c) + h1("BIÊN BẢN " + ten, "Về việc: " + e(c.tieuDe || D)) +
    `<p><b>I. Thời gian:</b> Cuộc họp bắt đầu vào hồi ……… giờ ……… phút, ngày ……/……/………</p>
<p><b>II. Địa điểm:</b> ${D}</p>
<p><b>III. Thành phần:</b></p><p>- ${opt.thanhPhan || "Cố vấn học tập; Ban cán sự lớp; toàn thể sinh viên trong lớp"}.</p>
<p>- Tổng số: ……… người; có mặt: ……… người; vắng: ……… người (có lý do: ………; không lý do: ………).</p>
<p>- Chủ ${opt.chuTri ? "trì" : "tọa"}: ${D}  Thư ký: ${D}</p>
<p><b>IV. Nội dung:</b></p><p>1. ${D}</p><p>2. ${D}</p><p>3. ${D}</p>
<p><b>V. Ý kiến thảo luận:</b></p><p>- ${D}</p>
<p><b>VI. Kết luận${opt.bieuQuyet ? ", biểu quyết" : ""}:</b></p><p>- ${D}</p>${opt.bieuQuyet ? `<p>- Kết quả biểu quyết: tán thành ……/……; không tán thành ……/……; ý kiến khác ……/…… .</p>` : ""}
<p>Cuộc họp kết thúc vào hồi ……… giờ ……… phút cùng ngày. Biên bản đã được thông qua trước toàn thể cuộc họp.</p>` +
    sig(["THƯ KÝ"], opt.ky || ["CHỦ TỌA"]);
}
/* Đơn không có mẫu trong Quy chế: khung chung */
function don(ten, kinhGui, c, body, extra) {
  return head("hv", c) + h1(ten) + `<table ${TB}><tr><td style="border:0;width:22%;vertical-align:top;text-align:right"><b>Kính gửi:</b></td><td style="border:0">${kinhGui.map((k, i) => `- ${k}${i < kinhGui.length - 1 ? ";" : "."}`).join("<br>")}</td></tr></table>
<p>Họ và tên sinh viên: <b>${e(c.hoTen || D)}</b>   Mã số sinh viên: <b>${e(c.mssv || D)}</b></p>
<p>Ngày sinh: ${e(c.ngaySinh || D)}   Lớp: ${e(c.lop || D)}   Khoa: ${e(c.khoa || "Khoa Luật")}</p>
<p>Điện thoại liên hệ: ${e(c.sdt || D)}   Email: ${D}</p>${body}
<p>Em xin cam đoan những nội dung trên là đúng sự thật và chịu trách nhiệm về nội dung đã trình bày.</p><p>Em xin trân trọng cảm ơn.</p>` +
    sig(extra || ["XÁC NHẬN CỦA CỐ VẤN HỌC TẬP"], ["NGƯỜI LÀM ĐƠN", "(Ký, ghi rõ họ tên)", e(c.hoTen || "")]);
}
const KG = c => ["Ban Quản lý đào tạo", e(c.khoa || "Khoa Luật"), "Cố vấn học tập lớp " + e(c.lop || "………")];

export const MAU = [
  /* Biên bản họp */
  { id: "bb-lop", nhom: "Biên bản họp", ten: "Biên bản họp lớp (sinh hoạt lớp)", don: "lop", html: c => bienBan("lop", "HỌP LỚP " + e(c.lop || ""), c, { bieuQuyet: true }) },
  { id: "bb-bcs", nhom: "Biên bản họp", ten: "Biên bản họp ban cán sự lớp", don: "lop", html: c => bienBan("lop", "HỌP BAN CÁN SỰ LỚP " + e(c.lop || ""), c, { thanhPhan: "Cố vấn học tập; Ban cán sự lớp; BCH chi đoàn, chi hội (nếu có)" }) },
  { id: "bb-doan", nhom: "Biên bản họp", ten: "Biên bản sinh hoạt chi đoàn", don: "doan", html: c => bienBan("doan", "SINH HOẠT CHI ĐOÀN " + e(c.chiDoan || c.lop || ""), c, { thanhPhan: "Ban Chấp hành chi đoàn; toàn thể đoàn viên chi đoàn; đại biểu (nếu có)", chuTri: true, bieuQuyet: true, ky: ["T/M BAN CHẤP HÀNH", "BÍ THƯ"] }) },
  { id: "bb-bch-doan", nhom: "Biên bản họp", ten: "Biên bản họp Ban Chấp hành chi đoàn", don: "doan", html: c => bienBan("doan", "HỌP BAN CHẤP HÀNH CHI ĐOÀN " + e(c.chiDoan || c.lop || ""), c, { thanhPhan: "Ủy viên Ban Chấp hành chi đoàn", chuTri: true, bieuQuyet: true, ky: ["T/M BAN CHẤP HÀNH", "BÍ THƯ"] }) },
  { id: "bb-hoi", nhom: "Biên bản họp", ten: "Biên bản sinh hoạt chi hội sinh viên", don: "hoi", html: c => bienBan("hoi", "SINH HOẠT CHI HỘI " + e(c.chiDoan || c.lop || ""), c, { thanhPhan: "Ban Chấp hành chi hội; toàn thể hội viên chi hội", chuTri: true, bieuQuyet: true, ky: ["T/M BAN CHẤP HÀNH", "CHI HỘI TRƯỞNG"] }) },
  { id: "bb-binh-xet", nhom: "Biên bản họp", ten: "Biên bản họp bình xét (thi đua, khen thưởng, học bổng)", don: "lop", html: c => bienBan("lop", "HỌP BÌNH XÉT", c, { bieuQuyet: true }) },
  { id: "bb-nhom", nhom: "Biên bản họp", ten: "Biên bản họp nhóm, câu lạc bộ, đội", don: "lop", html: c => bienBan("lop", "HỌP", c, { thanhPhan: "Thành viên nhóm / câu lạc bộ / đội", bieuQuyet: true }) },
  /* Đơn, văn bản không có mẫu trong Quy chế */
  { id: "don-xin-phep", nhom: "Đơn, văn bản cá nhân", ten: "Đơn xin phép nghỉ học / vắng mặt", html: c => don("ĐƠN XIN PHÉP NGHỈ HỌC", ["Giảng viên học phần ………………………", "Cố vấn học tập lớp " + e(c.lop || "………")], c,
      `<p>Em làm đơn này xin phép được nghỉ học (vắng mặt) học phần: ${D}, buổi học ngày ……/……/……… (từ ngày ……/……/……… đến ngày ……/……/………).</p><p>Lý do: ${D}${D}</p><p>Em xin hứa sẽ chủ động học bù nội dung bài học và thực hiện đầy đủ các yêu cầu của học phần.</p><p>Minh chứng kèm theo (nếu có): ${D}</p>`) },
  { id: "don-xac-nhan", nhom: "Đơn, văn bản cá nhân", ten: "Đơn đề nghị xác nhận sinh viên", html: c => don("ĐƠN ĐỀ NGHỊ XÁC NHẬN SINH VIÊN", KG(c), c,
      `<p>Hiện em đang là sinh viên năm thứ ……… hệ chính quy của Học viện Hành chính và Quản trị công.</p><p>Em làm đơn này đề nghị Học viện xác nhận em là sinh viên đang học tập tại Học viện để: ${D} (bổ sung hồ sơ vay vốn, hưởng chế độ chính sách, tạm hoãn nghĩa vụ quân sự, …).</p><p>Số lượng giấy xác nhận đề nghị cấp: ……… bản.</p>`) },
  { id: "don-de-nghi", nhom: "Đơn, văn bản cá nhân", ten: "Đơn đề nghị (nội dung tự do)", html: c => don("ĐƠN ĐỀ NGHỊ", KG(c), c,
      `<p>Về việc: ${D}</p><p>Em làm đơn này kính đề nghị: ${D}${D}</p><p>Lý do: ${D}${D}</p><p>Tài liệu kèm theo (nếu có): ${D}</p>`) },
  { id: "don-the-sv", nhom: "Đơn, văn bản cá nhân", ten: "Đơn đề nghị cấp lại thẻ sinh viên", html: c => don("ĐƠN ĐỀ NGHỊ CẤP LẠI THẺ SINH VIÊN", ["Ban Quản lý đào tạo", "Văn phòng Học viện"], c,
      `<p>Em làm đơn này đề nghị Học viện cấp lại thẻ sinh viên cho em.</p><p>Lý do: ☐ Mất thẻ   ☐ Hỏng thẻ   ☐ Sai thông tin trên thẻ   ☐ Khác: ${D}</p><p>Thời điểm, hoàn cảnh: ${D}</p>`) },
  { id: "don-chinh-sach", nhom: "Đơn, văn bản cá nhân", ten: "Đơn đề nghị miễn, giảm học phí / hỗ trợ chi phí học tập", html: c => don("ĐƠN ĐỀ NGHỊ MIỄN, GIẢM HỌC PHÍ, HỖ TRỢ CHI PHÍ HỌC TẬP", ["Giám đốc Học viện Hành chính và Quản trị công", "Ban Kế hoạch - Tài chính", e(c.khoa || "Khoa Luật")], c,
      `<p>Thuộc đối tượng: ${D} (theo quy định hiện hành về miễn, giảm học phí, hỗ trợ chi phí học tập).</p><p>Em làm đơn này đề nghị được xem xét ☐ miễn  ☐ giảm học phí  ☐ hỗ trợ chi phí học tập, học kỳ ……… năm học ………………</p><p>Hồ sơ kèm theo: ${D}</p>`) },
  { id: "tuong-trinh", nhom: "Đơn, văn bản cá nhân", ten: "Bản tường trình", html: c => head("hv", c) + h1("BẢN TƯỜNG TRÌNH", "Về việc: " + e(c.tieuDe || D)) +
      `<p><b>Kính gửi:</b> Cố vấn học tập lớp ${e(c.lop || "………")}; ${e(c.khoa || "Khoa Luật")}.</p><p>Tên em là: <b>${e(c.hoTen || D)}</b>   Mã số sinh viên: ${e(c.mssv || D)}   Lớp: ${e(c.lop || D)}</p><p>Em xin tường trình sự việc như sau:</p><p>- Thời gian, địa điểm: ${D}</p><p>- Diễn biến sự việc: ${D}${D}</p><p>- Những người liên quan: ${D}</p><p>Em cam đoan những điều trình bày trên là đúng sự thật và xin chịu trách nhiệm.</p>` + sig([""], ["NGƯỜI TƯỜNG TRÌNH", "(Ký, ghi rõ họ tên)", e(c.hoTen || "")]) },
  { id: "kiem-diem", nhom: "Đơn, văn bản cá nhân", ten: "Bản kiểm điểm cá nhân", html: c => head("hv", c) + h1("BẢN KIỂM ĐIỂM CÁ NHÂN", e(c.tieuDe || "")) +
      `<p>Họ và tên: <b>${e(c.hoTen || D)}</b>   Mã số sinh viên: ${e(c.mssv || D)}   Lớp: ${e(c.lop || D)}</p><p><b>I. Ưu điểm</b></p><p>1. Về tư tưởng chính trị, đạo đức, lối sống: ${D}</p><p>2. Về học tập: ${D}</p><p>3. Về rèn luyện, tham gia hoạt động: ${D}</p><p><b>II. Hạn chế, khuyết điểm và nguyên nhân</b></p><p>${D}</p><p><b>III. Phương hướng, biện pháp khắc phục</b></p><p>${D}</p><p><b>IV. Tự xếp loại:</b> ${D}</p>` + sig(["Ý KIẾN CỦA TẬP THỂ LỚP"], ["NGƯỜI VIẾT KIỂM ĐIỂM", "(Ký, ghi rõ họ tên)", e(c.hoTen || "")]) },
  { id: "cam-ket", nhom: "Đơn, văn bản cá nhân", ten: "Giấy cam kết", html: c => head("hv", c) + h1("GIẤY CAM KẾT", "Về việc: " + e(c.tieuDe || D)) +
      `<p>Tên em là: <b>${e(c.hoTen || D)}</b>   Mã số sinh viên: ${e(c.mssv || D)}   Lớp: ${e(c.lop || D)}</p><p>Em xin cam kết:</p><p>1. ${D}</p><p>2. ${D}</p><p>Nếu vi phạm cam kết, em xin hoàn toàn chịu trách nhiệm và chấp hành hình thức xử lý theo quy định.</p>` + sig(["XÁC NHẬN CỦA CỐ VẤN HỌC TẬP"], ["NGƯỜI CAM KẾT", "(Ký, ghi rõ họ tên)", e(c.hoTen || "")]) },
  /* Ghi chép cá nhân */
  { id: "ghi-chep", nhom: "Ghi chép", ten: "Trang ghi chép trống", html: c => `<h3>${e(c.tieuDe || "Ghi chép")}</h3><p><i>${ngayStr(c.ngay)}</i></p><p></p>` },
  { id: "ke-hoach-hoc", nhom: "Ghi chép", ten: "Kế hoạch học tập học kỳ", html: c => `<h3>KẾ HOẠCH HỌC TẬP ${e(c.tieuDe || "HỌC KỲ …")}</h3><p><b>Mục tiêu:</b> TBC học kỳ ……… · số tín chỉ đăng ký ……… · rèn luyện ………</p><table border="1" style="width:100%;border-collapse:collapse"><tr><th>Học phần</th><th>Số TC</th><th>Mục tiêu điểm</th><th>Việc cần làm</th><th>Hạn</th></tr><tr><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td></tr></table><p><b>Hoạt động rèn luyện, phong trào dự kiến:</b> ${D}</p>` },
  { id: "ghi-hoc-phan", nhom: "Ghi chép", ten: "Ghi chép học phần, bài giảng", html: c => `<h3>${e(c.tieuDe || "Học phần: …")}</h3><p><i>${ngayStr(c.ngay)}</i> · Giảng viên: ${D}</p><p><b>1. Nội dung chính:</b></p><p>- </p><p><b>2. Khái niệm, căn cứ pháp lý cần nhớ:</b></p><p>- </p><p><b>3. Câu hỏi, bài tập:</b></p><p>- </p>` }
];
export const mauHTML = (id, ctx) => { const m = MAU.find(x => x.id === id); return m ? m.html(ctx || {}) : ""; };
export const mauOptions = (filter, sel) => {
  const g = {}; MAU.filter(m => !filter || filter(m)).forEach(m => (g[m.nhom] = g[m.nhom] || []).push(m));
  return Object.entries(g).map(([n, ms]) => `<optgroup label="${e(n)}">${ms.map(m => `<option value="${m.id}"${m.id === sel ? " selected" : ""}>${e(m.ten)}</option>`).join("")}</optgroup>`).join("");
};
/* Trình soạn thảo gọn (contenteditable) */
export function richEditor(host, html) {
  host.innerHTML = `<div class="rx-bar">${[["bold", "<b>B</b>", "Đậm"], ["italic", "<i>I</i>", "Nghiêng"], ["underline", "<u>U</u>", "Gạch chân"], ["h3", "H", "Tiêu đề"], ["insertUnorderedList", "•", "Danh sách"], ["insertOrderedList", "1.", "Danh sách số"], ["justifyCenter", "≡", "Căn giữa"], ["justifyLeft", "⇤", "Căn trái"], ["createLink", "🔗", "Liên kết"], ["undo", "↶", "Hoàn tác"]].map(([c, l, t]) => `<button type="button" data-rx="${c}" title="${t}">${l}</button>`).join("")}</div><div class="rx-body" contenteditable="true">${html || ""}</div>`;
  const body = host.querySelector(".rx-body");
  host.querySelectorAll("[data-rx]").forEach(b => b.onmousedown = ev => { ev.preventDefault(); const c = b.dataset.rx;
    if (c === "h3") document.execCommand("formatBlock", false, "h3");
    else if (c === "createLink") { const u = prompt("Đường liên kết (https://…)"); if (u && /^(https?:|mailto:|tel:)/i.test(u)) document.execCommand(c, false, u); }
    else document.execCommand(c); });
  return { get: () => body.innerHTML, set: h => body.innerHTML = h, body };
}
/* Làm sạch HTML trước khi lưu */
const OK = new Set(["B", "STRONG", "I", "EM", "U", "P", "BR", "UL", "OL", "LI", "A", "H2", "H3", "H4", "DIV", "SPAN", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH", "HR"]);
export function cleanHTML(html) {
  const d = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html").body.firstChild;
  (function walk(n) {
    [...n.childNodes].forEach(c => {
      if (c.nodeType === 3) return;
      if (c.nodeType !== 1 || !OK.has(c.tagName)) { if (c.nodeType === 1 && !/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED)$/.test(c.tagName)) { walk(c); c.replaceWith(...c.childNodes); } else c.remove(); return; }
      [...c.attributes].forEach(a => { const keep = (c.tagName === "A" && a.name === "href" && /^(https?:|mailto:|tel:|#)/i.test(a.value)) || (a.name === "style" && !/url\(|expression/i.test(a.value)) || (["border", "colspan", "rowspan"].includes(a.name)); if (!keep) c.removeAttribute(a.name); });
      if (c.tagName === "A") { c.setAttribute("target", "_blank"); c.setAttribute("rel", "noopener"); }
      walk(c);
    });
  })(d);
  return d.innerHTML.trim();
}
export const PRINT_CSS = `body{font:13pt/1.45 "Times New Roman",serif;margin:18mm 16mm 16mm 25mm;color:#000}table{border-collapse:collapse}td,th{padding:3px 5px;vertical-align:top}p{margin:4px 0;text-align:justify}h2,h3{font-size:13.5pt}@page{size:A4;margin:0}`;
export function printHTML(title, html) {
  const w = window.open("", "_blank"); if (!w) return false;
  w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${e(title)}</title><style>${PRINT_CSS}</style></head><body>${html}<script>onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`); w.document.close(); return true;
}
