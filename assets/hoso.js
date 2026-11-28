/* =====================================================================
   HỒ SƠ SINH VIÊN THEO VÒNG ĐỜI — Hệ thống cố vấn học tập (PNA)
   Mỗi sinh viên một hồ sơ từ khi nhập học đến khi tốt nghiệp hoặc chấm dứt học tập:
   thông tin chung, lớp – khóa – ngành – chương trình đào tạo, trạng thái học tập,
   sự kiện (nghỉ học tạm thời, trở lại, thôi học, cán sự, khen thưởng, kỷ luật…),
   kết quả rèn luyện từng học kỳ, hoạt động, đơn thủ tục (dịch vụ công), ghi chú nội bộ của CVHT.
   Firestore: pna_hoso/{mssv} (+ /noibo/{id}: ghi chú chỉ cán bộ xem) · pna_lop/{mã lớp} · pna_ctdt/{mã}
   Dữ liệu cá nhân KHÔNG đưa lên kho mã GitHub: quản trị nhập tệp JSON ở trang “Nhập dữ liệu sinh viên”.
   ===================================================================== */
import { doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, collectionGroup, getDocs, query, where, writeBatch } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { THU_TUC } from "./thutuc-data.js?v=20261128w";

const P = window.PNA, db = P.db, esc = P.esc;
const $ = s => document.querySelector(s);
const vi = new Intl.Collator("vi");

/* ---------- Danh mục ---------- */
const TT = {
  "dang-hoc": ["Đang học", "#1b6e3a", "#e3f4e8"],
  "nghi-tam-thoi": ["Nghỉ học tạm thời", "#92400e", "#fef3c7"],
  "thoi-hoc": ["Thôi học", "#475569", "#e2e8f0"],
  "buoc-thoi-hoc": ["Buộc thôi học", "#b3261e", "#fbe6e4"],
  "chuyen-di": ["Đã chuyển đi", "#475569", "#e2e8f0"],
  "tot-nghiep": ["Đã tốt nghiệp", "#1d4ed8", "#e0ecff"]
};
const SK = {
  "nhap-hoc": ["Nhập học", "dang-hoc"], "nghi-tam-thoi": ["Nghỉ học tạm thời / bảo lưu", "nghi-tam-thoi"], "tro-lai": ["Trở lại học / tiếp tục học", "dang-hoc"],
  "thoi-hoc": ["Thôi học", "thoi-hoc"], "buoc-thoi-hoc": ["Buộc thôi học", "buoc-thoi-hoc"], "chuyen": ["Chuyển lớp / ngành / nơi học", ""],
  "canh-bao": ["Cảnh báo kết quả học tập", ""], "can-su": ["Cán sự lớp, chi đoàn, hội", ""], "khen-thuong": ["Khen thưởng", ""], "hoc-bong": ["Học bổng", ""],
  "ky-luat": ["Kỷ luật", ""], "hoat-dong": ["Hoạt động, tình nguyện, NCKH", ""], "hoc-vu": ["Học vụ (học lại, cải thiện, hoãn thi…)", ""],
  "tot-nghiep": ["Tốt nghiệp", "tot-nghiep"], "khac": ["Khác", ""]
};
const XL = ["Xuất sắc", "Tốt", "Khá", "Trung bình", "Yếu", "Kém", "KĐG"];
const XL_C = { "Xuất sắc": "#1d4ed8", "Tốt": "#1b6e3a", "Khá": "#0f766e", "Trung bình": "#92400e", "Yếu": "#b3261e", "Kém": "#7f1d1d", "KĐG": "#64748b" };
const SO_NAM = 4;
const chip = st => { const t = TT[st] || TT["dang-hoc"]; return `<span class="hs-chip" style="color:${t[1]};background:${t[2]}">${t[0]}</span>`; };
const xlChip = x => x ? `<span class="hs-xl" style="color:${XL_C[x] || "#334155"}">${esc(x)}</span>` : "";
const fmtD = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || ""); };
const isoD = s => { s = String(s || "").trim(); let m; if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s))) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""; };
const nowISO = () => new Date().toISOString();

/* Học kỳ: khóa "2023" → 2023-2024_1, 2023-2024_2, … (4 năm). Học kỳ I từ tháng 8. */
const kyName = k => { const [y, h] = k.split("_"); return `HK ${h === "1" ? "I" : h === "2" ? "II" : h} · ${y.replace("-", "–")}`; };
function kyList(khoa) { const y0 = +khoa || 0, out = []; if (!y0) return out; for (let i = 0; i < SO_NAM; i++) out.push(`${y0 + i}-${y0 + i + 1}_1`, `${y0 + i}-${y0 + i + 1}_2`); return out; }
function kyNow() { const d = new Date(), y = d.getFullYear(), m = d.getMonth() + 1; return m >= 8 ? `${y}-${y + 1}_1` : `${y - 1}-${y}_2`; }
function namThu(khoa) { const d = new Date(), y = d.getFullYear() - (d.getMonth() + 1 >= 8 ? 0 : 1); const n = y - (+khoa) + 1; return n >= 1 ? n : 0; }
const lastDrl = s => { const ks = Object.keys(s.drl || {}).sort(); const k = ks[ks.length - 1]; return k ? { k, ...s.drl[k] } : null; };

/* ---------- Quyền ---------- */
let ME = null;
const myEmail = () => (P.user && !P.user.isAnonymous && P.user.email || "").toLowerCase();
const isAdmin = () => P.isAdmin;
async function loadMe(force) {
  const em = myEmail();
  if (ME && ME.email === em && !force) return ME;
  ME = { email: em, sv: null, lops: [], khoa: false, all: null };
  if (!em) return ME;
  const jobs = [
    getDoc(doc(db, "pna_sv", em)).then(s => { if (s.exists()) ME.sv = s.data(); }).catch(() => {}),
    getDocs(query(collection(db, "pna_lop"), where("cvht", "array-contains", em))).then(q => q.forEach(d => ME.lops.push({ id: d.id, ...d.data() }))).catch(() => {}),
    getDoc(doc(db, "pna_tt_settings", "nguoiduyet")).then(s => { if (s.exists()) ME.khoa = (s.data().khoa || []).includes(em); }).catch(() => {})
  ];
  await Promise.all(jobs);
  return ME;
}
const isCvht = () => !!(ME && ME.lops.length) || !!(P.acct && P.acct.role === "cvht");
const isStaff = () => isAdmin() || (ME && ME.khoa) || isCvht();
const canEdit = s => isAdmin() || (ME && s && (s.cvht || []).includes(ME.email));
const seeAll = () => isAdmin() || (ME && ME.khoa);

/* ---------- Dữ liệu ---------- */
let LOPS = null, ALL = null;
async function loadLops(force) {
  if (LOPS && !force) return LOPS;
  const out = [];
  if (seeAll()) (await getDocs(collection(db, "pna_lop"))).forEach(d => out.push({ id: d.id, ...d.data() }));
  else (ME.lops || []).forEach(l => out.push(l));
  LOPS = out.sort((a, b) => b.id.slice(0, 2).localeCompare(a.id.slice(0, 2)) || a.id.localeCompare(b.id));
  return LOPS;
}
async function loadHoso(force) {
  if (ALL && !force) return ALL;
  const out = {};
  const q = seeAll() ? collection(db, "pna_hoso") : query(collection(db, "pna_hoso"), where("cvht", "array-contains", ME.email));
  (await getDocs(q)).forEach(d => out[d.id] = { id: d.id, ...d.data() });
  ALL = out; return ALL;
}
const reset = () => { LOPS = null; ALL = null; };

/* ---------- Khung trang ---------- */
function page(title, body, crumbs) {
  $("#main").innerHTML = `<section class="box hs-page"><h2 class="box-title">${title}</h2>${crumbs ? `<div class="crumbs"><a data-home>Trang chủ</a>${crumbs.map(([h, t]) => `<span class="sep">/</span>${h ? `<a href="#${esc(h)}">${esc(t)}</a>` : `<span>${esc(t)}</span>`}`).join("")}</div>` : ""}${body}</section>`;
  window.scrollTo(0, 0);
}
const deny = t => page(t, `<p class="empty">${myEmail() ? "Tài khoản này chưa được giao quản lý hồ sơ sinh viên." : `Hãy <button type="button" class="linkish" data-login>đăng nhập</button> để xem hồ sơ sinh viên.`}</p>`);
const fail = e => page("Hồ sơ sinh viên", `<p class="err">Không tải được dữ liệu: ${esc(e.message || e)}</p>`);

/* ---------- Danh sách lớp ---------- */
async function renderHome() {
  await loadMe();
  if (ME.sv && !isStaff()) return location.hash = "sv/" + encodeURIComponent(ME.sv.mssv);
  if (!isStaff()) return deny("Hồ sơ sinh viên");
  let lops, all;
  try { [lops, all] = await Promise.all([loadLops(), loadHoso()]); } catch (e) { return fail(e); }
  const svs = Object.values(all);
  const by = {}; svs.forEach(s => (by[s.lop] = by[s.lop] || []).push(s));
  const groups = {}; lops.forEach(l => (groups[l.khoa || "Khác"] = groups[l.khoa || "Khác"] || []).push(l));
  const card = l => {
    const list = by[l.id] || [], n = list.length, nghi = list.filter(s => s.trangThai && s.trangThai !== "dang-hoc").length;
    const mine = (l.cvht || []).includes(ME.email);
    return `<a class="hs-lop${mine ? " mine" : ""}" href="#sv/lop/${esc(l.id)}"><b>${esc(l.id)}</b><span>${esc(l.ten || "")}</span>
      <small>${esc(l.nganh || "—")} · ${n} sinh viên${nghi ? ` · ${nghi} không đang học` : ""}</small>
      <small class="hs-cv">${(l.cvht || []).length ? "CVHT: " + esc(l.cvht.map(P.showName).join(", ")) : "Chưa gán cố vấn học tập"}</small>${mine ? `<em>Lớp của tôi</em>` : ""}</a>`;
  };
  const tools = isAdmin() ? `<div class="page-tools"><button type="button" data-go="sv-nhap">⤓ Nhập dữ liệu sinh viên</button><button type="button" data-go="sv-ctdt">Chương trình đào tạo</button><button type="button" data-go="tt-lop">Lớp & tài khoản sinh viên</button></div>` : "";
  const stat = TT_STAT(svs);
  page("Hồ sơ sinh viên", `${tools}
    <div class="hs-stats">${stat}</div>
    <div class="hs-search"><input type="search" id="hsQ" placeholder="Tìm sinh viên theo mã, họ tên, số điện thoại…" autocomplete="off"><div id="hsQOut"></div></div>
    ${Object.keys(groups).sort().reverse().map(k => `<h3 class="hs-sub">Khóa trúng tuyển ${esc(k)}${+k ? ` · năm thứ ${namThu(k)}` : ""}</h3><div class="hs-lops">${groups[k].map(card).join("")}</div>`).join("") || `<p class="empty">Chưa có lớp nào.${isAdmin() ? " Bấm “Nhập dữ liệu sinh viên”." : ""}</p>`}`, [[null, "Hồ sơ sinh viên"]]);
  bindSearch(svs);
}
function TT_STAT(svs) {
  const c = {}; svs.forEach(s => c[s.trangThai || "dang-hoc"] = (c[s.trangThai || "dang-hoc"] || 0) + 1);
  return `<div><b>${svs.length}</b><span>Sinh viên</span></div>` + Object.keys(TT).filter(k => c[k]).map(k => `<div><b style="color:${TT[k][1]}">${c[k]}</b><span>${TT[k][0]}</span></div>`).join("");
}
function bindSearch(svs) {
  const inp = $("#hsQ"); if (!inp) return;
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
  inp.oninput = () => {
    const q = norm(inp.value.trim());
    const hit = q.length < 2 ? [] : svs.filter(s => norm(s.mssv + " " + s.hoTen + " " + (s.sdt || "")).includes(q)).slice(0, 30);
    $("#hsQOut").innerHTML = hit.length ? `<div class="hs-hits">${hit.map(s => `<a href="#sv/${esc(s.mssv)}"><b>${esc(s.hoTen)}</b> <span>${esc(s.mssv)} · ${esc(s.lop)}</span> ${chip(s.trangThai)}</a>`).join("")}</div>` : (q.length >= 2 ? `<p class="muted">Không thấy sinh viên phù hợp.</p>` : "");
  };
}

/* ---------- Trang lớp ---------- */
async function renderLop(id) {
  await loadMe();
  if (!isStaff()) return deny("Lớp " + id);
  let lops, all;
  try { [lops, all] = await Promise.all([loadLops(), loadHoso()]); } catch (e) { return fail(e); }
  const l = lops.find(x => x.id === id);
  if (!l) return page("Lớp " + esc(id), `<p class="empty">Không tìm thấy lớp hoặc bạn không phải cố vấn học tập của lớp này.</p>`, [["sv", "Hồ sơ sinh viên"], [null, id]]);
  const svs = Object.values(all).filter(s => s.lop === id).sort((a, b) => vi.compare(a.ten || "", b.ten || "") || vi.compare(a.hoTen, b.hoTen));
  const edit = canEdit(l);
  const ks = [...new Set(svs.flatMap(s => Object.keys(s.drl || {})))].sort();
  const kLast = ks[ks.length - 1];
  const dist = {}; if (kLast) svs.forEach(s => { const x = (s.drl || {})[kLast]; if (x && x.xepLoai) dist[x.xepLoai] = (dist[x.xepLoai] || 0) + 1; });
  let ctdts = [], lopCt = null;
  if (isAdmin()) { try { (await getDocs(collection(db, "pna_ctdt"))).forEach(d => ctdts.push({ id: d.id, ...d.data() })); } catch (e) {} lopCt = ctdts.find(c => c.id === l.ctdt) || null; }
  else if (l.ctdt) { try { const x = await getDoc(doc(db, "pna_ctdt", l.ctdt)); if (x.exists()) lopCt = { id: x.id, ...x.data() }; } catch (e) {} }
  const bcs = (l.bcs || []).map(b => `<li><b>${esc(b.chucVu)}</b>: <a href="#sv/${esc(b.mssv)}">${esc(b.hoTen)}</a>${b.sdt ? ` · <a href="tel:${esc(b.sdt)}">${esc(b.sdt)}</a>` : ""}</li>`).join("");
  const adminBox = isAdmin() ? `<details class="more"><summary>Gán cố vấn học tập, chương trình đào tạo (quản trị)</summary>
      <div class="grid2"><label class="fld"><span>Email cố vấn học tập (cách nhau dấu phẩy)</span><input id="lopCv" value="${esc((l.cvht || []).join(", "))}"></label>
      <label class="fld"><span>Chương trình đào tạo áp dụng</span><select id="lopCt"><option value="">— Chưa gán —</option>${ctdts.map(c => `<option value="${esc(c.id)}"${c.id === l.ctdt ? " selected" : ""}>${esc(c.id)} — ${esc(c.ten || "")}</option>`).join("")}</select></label>
      <label class="fld"><span>Tên lớp</span><input id="lopTen" value="${esc(l.ten || "")}"></label><label class="fld"><span>Ngành</span><input id="lopNganh" value="${esc(l.nganh || "")}"></label></div>
      <div class="dlg-act" style="justify-content:flex-start"><button type="button" class="btn primary" id="lopSave">Lưu và đồng bộ hồ sơ của lớp</button></div><p class="err" id="lopErr"></p></details>` : "";
  const drlBox = edit ? `<details class="more"><summary>Nhập kết quả rèn luyện học kỳ cho cả lớp</summary>
      <p class="muted">Dán từ Excel, mỗi dòng: <b>Mã SV · Điểm · Xếp loại · Ghi chú</b> (xếp loại để trống thì tự tính theo điểm).</p>
      <label class="fld" style="max-width:260px"><span>Học kỳ</span><select id="drlKy">${kyList(l.khoa).map(k => `<option value="${k}"${k === kyNow() ? " selected" : ""}>${kyName(k)}</option>`).join("")}</select></label>
      <textarea id="drlPaste" rows="5" class="fld-sel" placeholder="2505TTRA001	85	Tốt"></textarea>
      <div class="dlg-act" style="justify-content:flex-start"><button type="button" class="btn primary" id="drlGo">Cập nhật kết quả rèn luyện</button></div><p class="err" id="drlErr"></p></details>` : "";
  const rows = svs.map((s, i) => { const d = kLast && (s.drl || {})[kLast]; return `<tr class="tt-row" data-go="sv/${esc(s.mssv)}" data-st="${esc(s.trangThai || "dang-hoc")}" data-q="${esc((s.mssv + " " + s.hoTen + " " + (s.sdt || "")).toLowerCase())}">
    <td class="c">${i + 1}</td><td><b>${esc(s.mssv)}</b></td><td>${esc(s.hoTen)}${s.chucVu ? `<br><small class="hs-cs">${esc(s.chucVu)}</small>` : ""}</td><td>${esc(fmtD(s.ngaySinh))}</td><td>${esc(s.sdt || "")}</td>
    <td>${chip(s.trangThai)}</td><td class="c">${d ? (d.diem ?? "—") : ""}</td><td>${d ? xlChip(d.xepLoai) : ""}</td><td class="c">${s.email ? "✓" : ""}</td>${lopCt ? (() => { const t = tienDo(lopCt, s.hocTap); return `<td class="c">${t.qua}/${t.tong}${t.chua ? `<br><small style="color:#b3261e">${t.chua} HP chưa qua</small>` : ""}</td>`; })() : ""}</tr>`; }).join("");
  const hasAcc = svs.filter(s => s.email).length;
  page(`Lớp ${esc(l.id)}${l.ten ? " — " + esc(l.ten) : ""}`, `
    <div class="hs-info">${[["Ngành", l.nganh], ["Khóa trúng tuyển", l.khoa ? l.khoa + (namThu(l.khoa) ? " (năm thứ " + namThu(l.khoa) + ")" : "") : ""], ["Hệ đào tạo", l.he], ["Cố vấn học tập", (l.cvht || []).map(P.showName).join(", ") || "Chưa gán"], ["Chương trình đào tạo", l.ctdt || "Chưa gán"], ["Sĩ số", svs.length + " sinh viên · " + hasAcc + " đã có tài khoản"]].map(([a, b]) => `<div><span>${a}</span><b>${esc(b || "—")}</b></div>`).join("")}</div>
    ${l.ghiChu ? `<p class="tt-note">${esc(l.ghiChu)}</p>` : ""}
    <div class="hs-two">
      <div class="sbox"><h3 class="sbox-title">BAN CÁN SỰ LỚP</h3>${bcs ? `<ul class="hs-bcs">${bcs}</ul>` : `<p class="muted">Chưa có.</p>`}</div>
      <div class="sbox"><h3 class="sbox-title">RÈN LUYỆN ${kLast ? esc(kyName(kLast).toUpperCase()) : ""}</h3>${kLast ? `<div class="hs-dist">${XL.filter(x => dist[x]).map(x => `<div><b style="color:${XL_C[x]}">${dist[x]}</b><span>${x}</span></div>`).join("")}</div>` : `<p class="muted">Chưa có kết quả.</p>`}</div>
    </div>
    <div class="page-tools">${edit ? `<button type="button" id="lopAcc">Cấp tài khoản cho sinh viên chưa có (${svs.length - hasAcc})</button>` : ""}<button type="button" id="lopCsv">⤓ Xuất danh sách (Excel)</button></div>
    ${adminBox}${drlBox}
    <div class="hs-filter"><input type="search" id="lopQ" placeholder="Lọc theo mã, tên, số điện thoại…"><select id="lopSt"><option value="">Mọi trạng thái</option>${Object.keys(TT).map(k => `<option value="${k}">${TT[k][0]}</option>`).join("")}</select></div>
    <div class="tbl-wrap"><table class="adm-table ftbl hs-tbl"><thead><tr><th class="c">STT</th><th>Mã SV</th><th>Họ và tên</th><th>Ngày sinh</th><th>Điện thoại</th><th>Trạng thái</th><th class="c">ĐRL</th><th>Xếp loại${kLast ? `<br><small>${esc(kyName(kLast))}</small>` : ""}</th><th class="c">Tài khoản</th>${lopCt ? `<th class="c">TC đã qua</th>` : ""}</tr></thead><tbody>${rows || `<tr><td colspan="10" class="muted">Chưa có sinh viên.</td></tr>`}</tbody></table></div>`,
    [["sv", "Hồ sơ sinh viên"], [null, l.id]]);
  const filt = () => { const q = $("#lopQ").value.trim().toLowerCase(), st = $("#lopSt").value; document.querySelectorAll(".hs-tbl tbody tr[data-q]").forEach(tr => tr.hidden = (q && !tr.dataset.q.includes(q)) || (st && tr.dataset.st !== st)); };
  $("#lopQ").oninput = filt; $("#lopSt").onchange = filt;
  $("#lopCsv").onclick = () => csv(`DS_${l.id}.csv`, [["STT", "Mã SV", "Họ và tên", "Ngày sinh", "Điện thoại", "Chức vụ", "Trạng thái", ...ks.flatMap(k => ["ĐRL " + kyName(k), "Xếp loại " + kyName(k)])],
    ...svs.map((s, i) => [i + 1, s.mssv, s.hoTen, fmtD(s.ngaySinh), s.sdt || "", s.chucVu || "", (TT[s.trangThai] || TT["dang-hoc"])[0], ...ks.flatMap(k => { const d = (s.drl || {})[k] || {}; return [d.diem ?? "", d.xepLoai || ""]; })])]);
  if ($("#lopAcc")) $("#lopAcc").onclick = () => {
    const rows = svs.filter(s => !s.email && s.trangThai !== "thoi-hoc").map(s => [s.mssv, s.hoTen, fmtD(s.ngaySinh), s.sdt || ""].join("\t"));
    if (!rows.length) return P.toast("Tất cả sinh viên đã có tài khoản.");
    try { sessionStorage.setItem("pna_sv_prefill", JSON.stringify({ lop: l.id, text: rows.join("\n") })); } catch (e) {}
    location.hash = "tt-lop/" + l.id;
  };
  if ($("#lopSave")) $("#lopSave").onclick = async () => {
    const cvht = $("#lopCv").value.split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(s => s.includes("@")), ctdt = $("#lopCt").value, b = $("#lopSave"); b.disabled = true;
    try {
      await setDoc(doc(db, "pna_lop", l.id), { cvht, ctdt, ten: $("#lopTen").value.trim(), nganh: $("#lopNganh").value.trim(), updated: nowISO() }, { merge: true });
      await syncLop(l.id, { cvht, ctdt });
      P.logAct("LOP_SAVE", l.id); P.toast("Đã lưu lớp và đồng bộ " + svs.length + " hồ sơ.", "ok"); reset(); await loadMe(true); renderLop(l.id);
    } catch (e) { $("#lopErr").textContent = "Chưa lưu được: " + e.message; b.disabled = false; }
  };
  if ($("#drlGo")) $("#drlGo").onclick = async () => {
    const ky = $("#drlKy").value, err = $("#drlErr"); err.textContent = "";
    const lines = $("#drlPaste").value.split(/\n+/).map(x => x.split(/\t|;/).map(c => c.trim())).filter(r => r[0]);
    const bad = lines.filter(r => !all[r[0]] || all[r[0]].lop !== l.id);
    if (bad.length) return err.textContent = "Mã sinh viên không thuộc lớp: " + bad.map(r => r[0]).join(", ");
    const b = $("#drlGo"); b.disabled = true;
    try {
      for (const r of lines) { const diem = r[1] === "" || isNaN(+r[1]) ? null : +r[1]; await setDoc(doc(db, "pna_hoso", r[0]), { drl: { ...(all[r[0]].drl || {}), [ky]: { diem, xepLoai: r[2] || xepLoai(diem), ghiChu: r[3] || "", nguon: "Nhập tay — " + myEmail() } }, updated: nowISO(), by: myEmail() }, { merge: true }); }
      P.logAct("DRL_NHAP", l.id + " · " + ky + " · " + lines.length); P.toast("Đã cập nhật " + lines.length + " sinh viên.", "ok"); reset(); renderLop(l.id);
    } catch (e) { err.textContent = "Chưa lưu được: " + e.message; b.disabled = false; }
  };
}
const xepLoai = d => d == null ? "KĐG" : d >= 90 ? "Xuất sắc" : d >= 80 ? "Tốt" : d >= 70 ? "Khá" : d >= 50 ? "Trung bình" : "Yếu";   // TT 40/2026/TT-BGDĐT
async function syncLop(id, patch) {
  const snap = await getDocs(query(collection(db, "pna_hoso"), where("lop", "==", id))), refs = [];
  snap.forEach(d => refs.push(d.ref));
  for (let i = 0; i < refs.length; i += 400) { const bt = writeBatch(db); refs.slice(i, i + 400).forEach(r => bt.set(r, { ...patch, updated: nowISO() }, { merge: true })); await bt.commit(); }
  if (patch.cvht) {   // hồ sơ tài khoản (Thủ tục sinh viên) cũng phải đổi cố vấn
    const s2 = await getDocs(query(collection(db, "pna_sv"), where("lop", "==", id))), r2 = [];
    s2.forEach(d => r2.push(d.ref));
    for (let i = 0; i < r2.length; i += 400) { const bt = writeBatch(db); r2.slice(i, i + 400).forEach(r => bt.update(r, { cvht: patch.cvht })); await bt.commit(); }
  }
}
function csv(name, rows) {
  const t = "﻿" + rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], { type: "text/csv;charset=utf-8" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- Hồ sơ một sinh viên: 3 cột (thông tin · nội dung theo mục · tóm tắt) ----------
   Mục: HỌC TẬP (bảng tổng + theo học kỳ, nối cùng dữ liệu) · RÈN LUYỆN (phiếu theo TT 40/2026/TT-BGDĐT) ·
   PHONG TRÀO (sinh viên kê khai, ban cán sự / CVHT xác nhận) · THỦ TỤC – DỊCH VỤ CÔNG (đơn đã gửi, kết quả).
   Điểm: Quy chế đào tạo đại học của Học viện (QĐ 2567-QĐ/HVHCQTC ngày 09/3/2026), Điều 10, 11. */
const TABS = [["hoc-tap", "HỌC TẬP", "📘"], ["ren-luyen", "RÈN LUYỆN", "🏅"], ["phong-trao", "PHONG TRÀO", "🎯"], ["thu-tuc", "THỦ TỤC – DỊCH VỤ CÔNG", "📄"]];
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const r1 = x => Math.round(x * 10 + 1e-9) / 10, r2 = x => Math.round(x * 100 + 1e-9) / 100;
const numOf = v => (v === "" || v == null || isNaN(+v)) ? null : +v;
/* Điểm học phần: điểm cuối cùng do sinh viên/CVHT nhập (điểm thành phần đã có trên phần mềm đào tạo của Học viện).
   Dữ liệu cũ chỉ có điểm thành phần vẫn được tính: TX 10% + ĐK 30% + Thi 60% (Điều 10 khoản 1, 5). */
function diemHP(v) {
  if (!v) return null;
  const d = numOf(v.diem); if (d != null) return d;
  const tx = numOf(v.tx), dk = numOf(v.dk), thi = numOf(v.thi);
  if (thi == null) return null;
  if (tx == null && dk == null) return thi;
  return r1((tx || 0) * 0.1 + (dk || 0) * 0.3 + thi * 0.6);
}
const CHU = [[9, "A+", 4], [8.5, "A", 3.7], [8, "B+", 3.5], [7, "B", 3], [6.5, "C+", 2.5], [5.5, "C", 2], [5, "D+", 1.5], [4, "D", 1], [0, "F", 0]];
const chuOf = d => d == null ? null : CHU.find(c => d >= c[0]);
const hocLuc = g => g == null ? "" : g >= 3.6 ? "Xuất sắc" : g >= 3.2 ? "Giỏi" : g >= 2.5 ? "Khá" : g >= 2 ? "Trung bình" : g >= 1 ? "Yếu" : "Kém";
const trinhDo = tc => tc < 32 ? "Năm thứ nhất" : tc <= 65 ? "Năm thứ hai" : tc <= 98 ? "Năm thứ ba" : tc <= 130 ? "Năm thứ tư" : "Năm thứ năm";
const legacyPass = v => !!v && (v.tt === "qua" || v.tt === "cai-thien");
/* Một học phần đã đạt (tích lũy): có điểm ≥ 4,0 (học phần điều kiện: ≥ 5,0 — loại P), hoặc đánh dấu đạt kiểu cũ */
function datHP(h, v) {
  if (!v) return false;
  if (v.ctl) return false;
  const d = diemHP(v);
  if (d == null) return legacyPass(v);
  return h.loai === "DK" ? d >= 5 : d >= 4;
}
/* Tổng hợp theo học kỳ của CTĐT và tích lũy */
function hocTapTH(ct, ht) {
  ht = ht || {}; const plan = ct.keHoach || [], hk = {};
  let tcTL = 0, sum4 = 0, sum10 = 0, tcTLg = 0, chua = 0;
  for (const h of plan) {
    const v = ht[h.k], d = diemHP(v), tc = +h.tc || 0, H = hk[h.hk] = hk[h.hk] || { tc: 0, s4: 0, s10: 0, dat: 0, f: 0, n: 0 };
    if (h.loai === "DK") continue;
    if (d != null) { const c = chuOf(d); H.tc += tc; H.s4 += c[2] * tc; H.s10 += d * tc; H.n++; if (d < 4) { H.f += tc; chua++; } }
    else if (v && v.tt === "chua") chua++;
    if (datHP(h, v)) { tcTL += tc; H.dat += tc; if (d != null) { tcTLg += tc; sum4 += chuOf(d)[2] * tc; sum10 += d * tc; } }
  }
  Object.values(hk).forEach(H => { H.g4 = H.tc ? r2(H.s4 / H.tc) : null; H.g10 = H.tc ? r2(H.s10 / H.tc) : null; });
  const tong = +ct.tongTC || (ct.hocKy || []).reduce((n, h) => n + (+h.tc || 0), 0);
  return { hk, tcTL, tong, chua, g4: tcTLg ? r2(sum4 / tcTLg) : null, g10: tcTLg ? r2(sum10 / tcTLg) : null };
}
function tienDo(ct, ht) { const t = hocTapTH(ct, ht); return { qua: t.tcTL, chua: t.chua, tong: t.tong, g4: t.g4 }; }
const kyOfHk = (khoa, hk) => { const y = (+khoa || 0) + Math.floor((hk - 1) / 2); return `${y}-${y + 1}_${(hk - 1) % 2 + 1}`; };
const hkOfKy = (khoa, ky) => { const [y, n] = ky.split("_"); return (+y.split("-")[0] - (+khoa)) * 2 + (+n); };
const hkNow = khoa => { const n = namThu(khoa); return n ? Math.min(10, (n - 1) * 2 + (kyNow().endsWith("_1") ? 1 : 2)) : 0; };

/* Rèn luyện — Thông tư 40/2026/TT-BGDĐT (hiệu lực 30/6/2026): 5 nhóm, thang 100 */
let DRL_N = [
  ["n1", "Chấp hành pháp luật và nội quy, quy chế của nhà trường", 25],
  ["n2", "Tinh thần, thái độ trong học tập (tham gia học tập, NCKH, kỳ thi; vượt khó)", 20],
  ["n3", "Hoạt động chính trị - xã hội, văn hóa, văn nghệ, thể thao, tình nguyện, phòng chống tội phạm", 20],
  ["n4", "Trách nhiệm công dân trong quan hệ cộng đồng", 15],
  ["n5", "Cán bộ lớp, đoàn thể; thành tích NCKH, cuộc thi, khen thưởng", 20]];
let xlDrl = d => d == null ? "" : d >= 90 ? "Xuất sắc" : d >= 80 ? "Tốt" : d >= 70 ? "Khá" : d >= 50 ? "Trung bình" : "Yếu";

/* Phong trào: điểm gợi ý (tạm tính, chờ quy định chi tiết của Học viện) */
const HD_NHOM = { n3: "Chính trị - xã hội, văn hóa, văn nghệ, thể thao, tình nguyện", n4: "Công dân với cộng đồng (tuyên truyền, hoạt động xã hội được biểu dương)", n5: "Cán bộ lớp, đoàn thể; NCKH, cuộc thi, khen thưởng" };
const HD_CAP = { lop: ["Lớp / chi đoàn", 2], khoa: ["Khoa", 3], hv: ["Học viện", 4], ngoai: ["Ngoài Học viện (địa phương, toàn quốc)", 5] };
const HD_VT = { tg: ["Tham gia", 0], tc: ["Ban tổ chức / cán bộ", 2], giai: ["Đạt giải, được khen thưởng", 3] };
const HD_TT = { cho: ["Chờ xác nhận", "#92400e", "#fef3c7"], ok: ["Đã xác nhận", "#1b6e3a", "#e3f4e8"], no: ["Không xác nhận", "#b3261e", "#fbe6e4"] };
const hdDiem = a => (HD_CAP[a.cap] || [0, 0])[1] + (HD_VT[a.vaiTro] || [0, 0])[1];
const kyOfDate = d => { const m = /^(\d{4})-(\d{2})/.exec(d || ""); if (!m) return ""; const y = +m[1], mo = +m[2]; return mo >= 8 ? `${y}-${y + 1}_1` : `${y - 1}-${y}_2`; };
function hdTong(acts, ky) {
  const out = { n3: 0, n4: 0, n5: 0 };
  acts.filter(a => a.tt === "ok" && (!ky || a.ky === ky)).forEach(a => { if (out[a.nhom] != null) out[a.nhom] += hdDiem(a); });
  const mx = Object.fromEntries(DRL_N.map(([g, , m]) => [g, m]));
  out.n3 = Math.min(mx.n3, out.n3); out.n4 = Math.min(mx.n4, out.n4); out.n5 = Math.min(mx.n5, out.n5);
  return out;
}
const DON_TT = { "cho-duyet": "Đang xử lý", "bo-sung": "Cần bổ sung", "da-duyet": "Đã duyệt", "tu-choi": "Không duyệt", "rut": "Đã rút", "nhap": "Bản nháp" };

/* Trang hồ sơ chiếm toàn bộ chiều rộng (ẩn 2 cột bên của trang chủ) */
function fullPage(on) { document.body.classList.toggle("hs-full", !!on); }
window.addEventListener("hashchange", () => { const h = decodeURIComponent(location.hash.slice(1)); if (!(h.startsWith("sv/") && !h.startsWith("sv/lop/"))) fullPage(false); });

async function renderSv(mssv, tab) {
  await loadMe();
  const own = ME.sv && ME.sv.mssv === mssv;
  if (!isStaff() && !own) return deny("Hồ sơ sinh viên");
  let s, lop = null, ct = null, notes = [], dons = [], acts = [];
  try { const d = await getDoc(doc(db, "pna_hoso", mssv)); if (!d.exists()) return page("Hồ sơ " + esc(mssv), `<p class="empty">${own ? "Hồ sơ của bạn chưa được nhập vào hệ thống. Liên hệ cố vấn học tập." : "Không tìm thấy hồ sơ hoặc bạn không quản lý sinh viên này."}</p>`, isStaff() ? [["sv", "Hồ sơ sinh viên"], [null, mssv]] : null); s = { id: d.id, ...d.data() }; }
  catch (e) { return page("Hồ sơ " + esc(mssv), `<p class="empty">Bạn không có quyền xem hồ sơ này.</p>`); }
  const edit = canEdit(s), self = own || edit;
  await Promise.all([
    getDoc(doc(db, "pna_lop", s.lop)).then(x => { if (x.exists()) lop = x.data(); }).catch(() => {}),
    edit ? getDocs(collection(db, "pna_hoso", mssv, "noibo")).then(q => q.forEach(x => notes.push({ id: x.id, ...x.data() }))).catch(() => {}) : null,
    loadDons(s, own).then(x => dons = x).catch(() => {}),
    getDocs(collection(db, "pna_hoso", mssv, "hoatdong")).then(q => q.forEach(x => acts.push({ id: x.id, ...x.data() }))).catch(() => {})
  ]);
  const ctId = s.ctdt || (lop && lop.ctdt);
  if (ctId) { try { const x = await getDoc(doc(db, "pna_ctdt", ctId)); if (x.exists()) ct = { id: x.id, ...x.data() }; } catch (e) {} }
  tab = TABS.some(t => t[0] === tab) ? tab : "hoc-tap";
  const V = { s, lop, ct, notes, dons, acts, own, edit, self, tab, hk: null, view: "tong" };
  fullPage(true);
  drawSv(V);
}
function drawSv(V) {
  const { s, lop, ct, edit } = V; useKhung(s);
  const th = ct ? hocTapTH(ct, s.hocTap) : null;
  const lastK = Object.keys(s.drl || {}).sort().pop();
  const info = [["Mã sinh viên", s.mssv], ["Ngày sinh", fmtD(s.ngaySinh)], ["Lớp", s.lop + (lop && lop.ten ? " — " + lop.ten : "")], ["Ngành", s.nganh], ["Khóa", s.khoa ? s.khoa + (namThu(s.khoa) ? ` (năm thứ ${namThu(s.khoa)})` : "") : ""], ["Hệ đào tạo", s.he],
    ["Chức vụ", s.chucVu ? s.chucVu + (s.chucVuNam ? " (" + s.chucVuNam.replace("-", "–") + ")" : "") : ""], ["Điện thoại", s.sdt], ["Email liên hệ", s.emailLienHe], ["Quê quán", s.queQuan], ["Tài khoản", s.email ? P.showName(s.email) : "Chưa cấp"], ["Cố vấn học tập", (s.cvht || []).map(P.showName).join(", ") || "Chưa gán"]].filter(r => r[1]);
  const sk = (s.suKien || []).slice().sort((a, b) => String(b.ngay || b.namHoc || "").localeCompare(String(a.ngay || a.namHoc || "")));
  const left = `<div class="hs-card"><div class="hs-av">${esc((s.ten || s.hoTen || "?").slice(0, 1))}</div><div class="hs-name">${esc(s.hoTen)}</div><div>${chip(s.trangThai)}</div>
      <dl class="hs-dl">${info.map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join("")}</dl>
      ${edit ? `<div class="hs-act"><button type="button" class="btn sm" id="svEdit">✎ Sửa thông tin</button><button type="button" class="btn sm primary" id="svEv">＋ Sự kiện</button></div>` : ""}</div>
    <nav class="hs-tabs">${TABS.map(([k, n, ic]) => `<a href="#sv/${esc(s.mssv)}/${k}" class="${V.tab === k ? "on" : ""}"><span>${ic}</span>${n}</a>`).join("")}</nav>`;
  const yrs = []; const ks = kyList(s.khoa); for (let i = 0; i < ks.length; i += 2) yrs.push([ks[i], ks[i + 1]]);
  const mini = yrs.map(([a, b], i) => `<div class="hs-my"><b>Năm ${i + 1}</b>${[a, b].map(k => { const hk = hkOfKy(s.khoa, k), H = th && th.hk[hk], d = (s.drl || {})[k]; return `<span class="${k === kyNow() ? "now" : ""}" title="${esc(kyName(k))}">HK${ROMAN[hk]}: ${H && H.g4 != null ? H.g4.toFixed(2) : "—"} · ĐRL ${d && d.diem != null ? d.diem : "—"}</span>`; }).join("")}</div>`).join("");
  const right = `<div class="sbox"><h3 class="sbox-title">TÓM TẮT</h3>
      ${th ? `<div class="hs-kpi"><div><b>${th.tcTL}<small>/${th.tong}</small></b><span>Tín chỉ tích lũy</span></div><div><b>${th.g4 != null ? th.g4.toFixed(2) : "—"}</b><span>TBC tích lũy (thang 4)</span></div></div>
      <div class="hs-bar"><span style="width:${th.tong ? Math.min(100, th.tcTL * 100 / th.tong) : 0}%"></span></div>
      <p class="hs-sm">Học lực: <b>${hocLuc(th.g4) || "—"}</b> · Trình độ: <b>${trinhDo(th.tcTL)}</b>${th.chua ? `<br><span style="color:#b3261e">${th.chua} học phần chưa đạt — cần học lại</span>` : ""}</p>` : `<p class="muted">Chưa gán chương trình đào tạo.</p>`}
      <p class="hs-sm">Rèn luyện gần nhất: ${lastK ? `<b>${s.drl[lastK].diem ?? "—"}</b> ${xlChip(s.drl[lastK].xepLoai)} <small class="muted">(${esc(kyName(lastK))})</small>` : "—"}</p></div>
    <div class="sbox"><h3 class="sbox-title">HÀNH TRÌNH</h3><div class="hs-mini">${mini || `<p class="muted">—</p>`}</div></div>
    <div class="sbox"><h3 class="sbox-title">SỰ KIỆN</h3>${sk.length ? `<ol class="tt-hist hs-ev">${sk.slice(0, 12).map(e => { const i = (s.suKien || []).indexOf(e); return `<li><b>${esc((SK[e.loai] || SK.khac)[0])}</b> <span class="muted">${esc(e.ngay ? fmtD(e.ngay) : (e.namHoc || "").replace("-", "–"))}</span><br>${esc(e.noiDung || "")}${edit ? ` <button type="button" class="linkish" data-evdel="${i}">Xóa</button>` : ""}</li>`; }).join("")}</ol>` : `<p class="muted">Chưa có sự kiện.</p>`}</div>
    ${edit ? `<div class="sbox hs-noibo"><h3 class="sbox-title">GHI CHÚ CỦA CVHT <small class="muted">(chỉ cán bộ xem)</small></h3>
      ${V.notes.sort((a, b) => String(b.at).localeCompare(String(a.at))).map(n => `<div class="hs-note"><small class="muted">${esc(fmtD(String(n.at).slice(0, 10)))} · ${esc(P.showName(n.by || ""))}</small><p>${esc(n.noiDung)}</p><button type="button" class="linkish" data-notedel="${esc(n.id)}">Xóa</button></div>`).join("") || `<p class="muted">Chưa có ghi chú.</p>`}
      <textarea id="noteIn" rows="2" class="fld-sel" placeholder="Tình hình học tập, gia đình, tư vấn đã thực hiện…"></textarea><button type="button" class="btn sm" id="noteAdd" style="margin-top:6px">Lưu ghi chú</button></div>` : ""}`;
  const mid = V.tab === "ren-luyen" ? tabRL(V, th) : V.tab === "phong-trao" ? tabPT(V) : V.tab === "thu-tuc" ? tabTT(V) : tabHT(V, th);
  page(esc(s.hoTen), `<div class="hs3"><aside class="hs3-l">${left}</aside><section class="hs3-m">${mid}</section><aside class="hs3-r">${right}</aside></div>`,
    isStaff() ? [["sv", "Hồ sơ sinh viên"], ["sv/lop/" + s.lop, s.lop], [null, s.hoTen]] : null);
  bindSv(V);
}

/* ---- HỌC TẬP ---- */
function tabHT(V, th) {
  const { s, ct, self } = V;
  if (!ct) return `<div class="sbox"><h3 class="sbox-title">HỌC TẬP</h3><p class="muted">Chưa gán chương trình đào tạo cho lớp ${esc(s.lop)}.${isAdmin() ? ` Gán ở <a href="#sv/lop/${esc(s.lop)}">trang lớp</a>.` : ""}</p></div>`;
  const plan = ct.keHoach || [], ht = s.hocTap || {}, now = hkNow(s.khoa);
  const hks = [...new Set([...(ct.hocKy || []).map(h => +h.hk), ...plan.map(h => +h.hk)])].sort((a, b) => a - b);
  if (V.hk == null) V.hk = Math.max(1, Math.min(now || 1, hks[hks.length - 1] || 1));
  const byCode = {}; plan.forEach(h => { if (h.ma) byCode[h.ma] = h; });
  const inp = (h, f, v, w) => self ? `<input class="hs-in" data-k="${esc(h.k)}" data-f="${f}" value="${esc(v ?? "")}" inputmode="decimal"${w ? ` style="width:${w}px"` : ""}>` : esc(v ?? "");
  const ck = (h, f, v, t) => `<label class="hs-tick" title="${t}"><input type="checkbox" data-k="${esc(h.k)}" data-f="${f}"${v ? " checked" : ""}${self ? "" : " disabled"}></label>`;
  const rowsOf = hk => { let lastG = "", i = 0; return plan.filter(h => +h.hk === hk).map(h => {
    let g = ""; if ((h.nhom || "") !== lastG) { lastG = h.nhom || ""; if (lastG) g = `<tr class="hs-grp"><td></td><td colspan="11"><i>${esc(lastG)}</i></td></tr>`; }
    const v = ht[h.k] || {}, d = diemHP(v), c = chuOf(d), tc = h.loai === "TC", dk = h.loai === "DK";
    const st = d == null ? (legacyPass(v) ? ["Đạt", "ok"] : v.tt === "chua" ? ["Chưa đạt", "f"] : ["", ""]) : dk ? (d >= 5 ? ["Đạt (P)", "ok"] : ["Chưa đạt", "f"]) : d >= 4 ? ["Đạt", "ok"] : ["Chưa đạt (F)", "f"];
    const miss = !datHP(h, v) ? (h.tq || []).filter(cd => byCode[cd] && !datHP(byCode[cd], ht[byCode[cd].k]) && (+h.hk <= now + 1)) : [];
    return g + `<tr class="${tc ? "tc" : ""}${dk ? " dk" : ""}${st[1] ? " st-" + st[1] : ""}">
      <td class="c">${++i}</td><td class="hs-ma">${esc(h.ma || "—")}</td>
      <td class="hs-ten">${tc ? `<i>${esc(h.ten)}</i>` : esc(h.ten)}${dk ? ` <small class="muted">(điều kiện)</small>` : ""}${(h.tq || []).length ? `<br><small class="muted">Tiên quyết: ${esc(h.tq.join(", "))}</small>` : ""}${miss.length ? `<br><small class="hs-warn">⚠ Chưa đạt HP tiên quyết: ${esc(miss.map(cd => byCode[cd].ten).join("; "))}</small>` : ""}</td>
      <td class="c">${esc(h.tc)}</td>
      <td class="c hs-d">${self ? `<input class="hs-in b" data-k="${esc(h.k)}" data-f="diem" value="${esc(v.diem ?? (d ?? ""))}" inputmode="decimal" style="width:56px" title="Điểm học phần (thang 10)">` : (d ?? "")}</td>
      <td class="c"><b>${dk ? (d == null ? "" : d >= 5 ? "P" : "F") : c ? c[1] : ""}</b></td><td class="c">${!dk && c ? c[2].toFixed(1) : ""}</td>
      <td class="c hs-st ${st[1]}">${st[0]}</td>
      <td class="c">${ck(h, "ct", v.ct || v.tt === "cai-thien", "Đã học cải thiện")}</td><td class="c">${ck(h, "bs", v.bs, "Học lại / bổ sung")}</td><td class="c">${ck(h, "ctl", v.ctl, "Chưa tích lũy")}</td>
      <td>${self ? `<input class="hs-gc" data-k="${esc(h.k)}" data-f="gc" value="${esc(v.gc || "")}" placeholder="Ghi chú…">` : esc(v.gc || "")}</td></tr>`; }).join(""); };
  const head = `<thead><tr><th class="c" rowspan="2">STT</th><th rowspan="2">Mã HP</th><th rowspan="2">Tên học phần</th><th class="c" rowspan="2">TC</th><th class="c" rowspan="2">Điểm HP<br><small>(thang 10)</small></th><th class="c" colspan="2">Quy đổi</th><th class="c" rowspan="2">Tình trạng</th><th class="c" colspan="3">Đánh dấu</th><th rowspan="2">Ghi chú</th></tr>
    <tr><th class="c v">Chữ</th><th class="c v">Thang 4</th><th class="c v">Cải thiện</th><th class="c v">Học lại / bổ sung</th><th class="c v">Chưa tích lũy</th></tr></thead>`;
  const sumRow = hk => { const H = th.hk[hk] || {}; const k = kyOfHk(s.khoa, hk), d = (s.drl || {})[k];
    return `<div class="hs-hksum"><span>TB học kỳ: <b>${H.g4 != null ? H.g4.toFixed(2) : "—"}</b> (thang 4) · <b>${H.g10 != null ? H.g10.toFixed(2) : "—"}</b> (thang 10)</span><span>Học lực: <b>${hocLuc(H.g4) || "—"}</b></span><span>Tín chỉ đạt: <b>${H.dat || 0}</b>${H.f ? ` · <span style="color:#b3261e">${H.f} TC chưa đạt</span>` : ""}</span><span>Rèn luyện: <b>${d && d.diem != null ? d.diem : "—"}</b> ${d ? xlChip(d.xepLoai) : ""}</span></div>`; };
  const sec = (hk, open) => { const meta = (ct.hocKy || []).find(h => +h.hk === hk) || {}; const k = kyOfHk(s.khoa, hk);
    return `<details class="hs-hk${hk === now ? " now" : ""}"${open ? " open" : ""}><summary><b>Năm thứ ${Math.ceil(hk / 2)} · Học kỳ ${ROMAN[hk] || hk}</b> <span class="muted">${esc(k.split("_")[0].replace("-", "–"))} · ${esc(meta.tc || "")} tín chỉ${meta.ghiChu ? " · " + esc(meta.ghiChu) : ""}</span>${hk === now ? ` <em>học kỳ hiện tại</em>` : ""}<span class="hs-hkq">TB ${(th.hk[hk] || {}).g4 != null ? th.hk[hk].g4.toFixed(2) : "—"} · đạt ${(th.hk[hk] || {}).dat || 0} TC</span></summary>
      ${sumRow(hk)}<div class="tbl-wrap"><table class="adm-table hs-ct">${head}<tbody>${rowsOf(hk)}</tbody></table></div></details>`; };
  const body = V.view === "ky"
    ? `<div class="hs-kysel">${hks.map(hk => `<button type="button" class="${hk === V.hk ? "on" : ""}${hk === now ? " now" : ""}" data-hk="${hk}">HK ${ROMAN[hk]}<small>${esc(kyOfHk(s.khoa, hk).split("_")[0].replace("-", "–"))}</small></button>`).join("")}</div>${sec(V.hk, true)}`
    : hks.map(hk => sec(hk, true)).join("");
  return `<div class="sbox"><h3 class="sbox-title">HỌC TẬP — ${esc(ct.ten || ct.id)}</h3>
    <div class="hs-sw"><button type="button" data-htview="tong" class="${V.view === "tong" ? "on" : ""}">Bảng tổng toàn khóa</button><button type="button" data-htview="ky" class="${V.view === "ky" ? "on" : ""}">Xem theo học kỳ</button></div>
    <p class="muted hs-sm">${self ? "Chỉ nhập điểm học phần cuối cùng (thang 10) theo kết quả đã công bố trên phần mềm quản lý đào tạo của Học viện; dữ liệu tự lưu. " : ""}Quy đổi theo Điều 10, 11 Quy chế đào tạo đại học của Học viện (QĐ 2567-QĐ/HVHCQTC): A+ 4,0 · A 3,7 · B+ 3,5 · B 3,0 · C+ 2,5 · C 2,0 · D+ 1,5 · D 1,0 · F 0. Học phần <i>in nghiêng</i> là tự chọn; học phần điều kiện (GDTC, GDQP-AN) chỉ xét đạt (P ≥ 5,0), không tính điểm trung bình.</p>
    ${body}</div>`;
}

/* ---- RÈN LUYỆN ----
   Phiếu tự đánh giá theo khung Điều 17 Thông tư 40/2026/TT-BGDĐT (5 nhóm, 13 tiêu chí). Quy trình: sinh viên tự chấm từng
   tiêu chí, ghi minh chứng, gửi phiếu → CVHT (họp lớp cùng ban cán sự) đánh giá theo nhóm, chốt → Hội đồng Khoa/Học viện. */
let DRL_TC = {
  n1: [["1a", "Chấp hành chủ trương của Đảng, chính sách, pháp luật của Nhà nước và chỉ đạo của Bộ, ngành, cơ quan quản lý được áp dụng trong nhà trường"], ["1b", "Chấp hành nội quy, quy chế và các quy định khác của Học viện"]],
  n2: [["2a", "Ý thức, thái độ, trách nhiệm trong học tập và nghiên cứu khoa học"], ["2b", "Ý thức, trách nhiệm khi tham gia các kỳ thi, cuộc thi"], ["2c", "Tinh thần vượt khó, phấn đấu vươn lên trong học tập"]],
  n3: [["3a", "Tham gia các hoạt động rèn luyện về chính trị, xã hội, văn hóa, văn nghệ, thể thao (sinh viên khuyết tật được đánh giá phù hợp tình trạng sức khỏe)"], ["3b", "Tham gia hoạt động công ích, tình nguyện, công tác xã hội"], ["3c", "Tham gia tuyên truyền, phòng chống tội phạm và các tệ nạn xã hội"]],
  n4: [["4a", "Tuyên truyền chủ trương của Đảng, chính sách, pháp luật của Nhà nước trong cộng đồng"], ["4b", "Tham gia các hoạt động xã hội được ghi nhận, biểu dương, khen thưởng"]],
  n5: [["5a", "Đảm nhiệm công tác lớp, Đảng, Đoàn, Hội và tổ chức khác của Học viện (trách nhiệm, uy tín, kỹ năng tổ chức, hiệu quả)"], ["5b", "Hỗ trợ, tham gia tích cực các hoạt động chung của lớp, khoa, Học viện"], ["5c", "Thành tích trong nghiên cứu khoa học, cuộc thi, sáng kiến, khởi nghiệp hoặc hoạt động khác được khen thưởng"]]
};
let DRL_CC = "Điều 17 Thông tư số 40/2026/TT-BGDĐT ngày 15/5/2026 của Bộ trưởng Bộ Giáo dục và Đào tạo quy định về công tác sinh viên";
/* Khung đánh giá theo khóa (Công văn 2020-CV/HVHCQTC ngày 15/9/2026): sinh viên trúng tuyển 2023, 2024, 2025 đánh giá theo
   Quyết định 4185/QĐ-HCQG ngày 08/9/2023 (khung Thông tư 16/2015: 20 · 25 · 20 · 25 · 10; 6 mức xếp loại);
   khóa trúng tuyển từ 2026 theo Thông tư 40/2026/TT-BGDĐT (25 · 20 · 20 · 15 · 20; 5 mức). */
const KH_TT40 = { key: "tt40", N: DRL_N, TC: DRL_TC, CC: DRL_CC, xl: xlDrl, mucXL: "Xuất sắc 90–100 · Tốt 80 đến dưới 90 · Khá 70 đến dưới 80 · Trung bình 50 đến dưới 70 · Yếu dưới 50 (Điều 18 Thông tư 40/2026/TT-BGDĐT)" };
const KH_4185 = { key: "4185",
  N: [["n1", "Đánh giá về ý thức tham gia học tập", 20], ["n2", "Đánh giá về ý thức chấp hành nội quy, quy chế, quy định trong Học viện", 25],
    ["n3", "Đánh giá về ý thức tham gia các hoạt động chính trị, xã hội, văn hóa, văn nghệ, thể thao, phòng chống tội phạm và các tệ nạn xã hội", 20],
    ["n4", "Đánh giá về ý thức công dân trong quan hệ cộng đồng", 25], ["n5", "Đánh giá về ý thức và kết quả khi tham gia công tác cán bộ lớp, các đoàn thể, tổ chức trong Học viện hoặc người học đạt được thành tích đặc biệt trong học tập, rèn luyện", 10]],
  TC: {
    n1: [["1a", "Ý thức và thái độ trong học tập"], ["1b", "Ý thức và thái độ tham gia các câu lạc bộ học thuật, hoạt động học thuật, ngoại khóa, nghiên cứu khoa học"], ["1c", "Ý thức và thái độ tham gia các kỳ thi, cuộc thi"], ["1d", "Tinh thần vượt khó, phấn đấu vươn lên trong học tập"], ["1đ", "Kết quả học tập"]],
    n2: [["2a", "Ý thức chấp hành các văn bản chỉ đạo của ngành, của cơ quan chỉ đạo cấp trên được thực hiện trong Học viện"], ["2b", "Ý thức chấp hành các nội quy, quy chế và các quy định khác của Học viện"]],
    n3: [["3a", "Ý thức và hiệu quả tham gia các hoạt động rèn luyện về chính trị, xã hội, văn hóa, văn nghệ, thể thao"], ["3b", "Ý thức tham gia các hoạt động công ích, tình nguyện, công tác xã hội"], ["3c", "Tham gia tuyên truyền, phòng chống tội phạm và các tệ nạn xã hội"]],
    n4: [["4a", "Ý thức chấp hành và tham gia tuyên truyền các chủ trương của Đảng, chính sách, pháp luật của Nhà nước trong cộng đồng"], ["4b", "Ý thức tham gia các hoạt động xã hội có thành tích được ghi nhận, biểu dương, khen thưởng"], ["4c", "Có tinh thần chia sẻ, giúp đỡ người thân, người có khó khăn, hoạn nạn"]],
    n5: [["5a", "Ý thức, tinh thần, thái độ, uy tín và hiệu quả công việc khi được phân công quản lý lớp, các tổ chức Đảng, Đoàn, Hội và các tổ chức khác trong Học viện"], ["5b", "Kỹ năng tổ chức, quản lý lớp, quản lý các tổ chức trong Học viện"], ["5c", "Hỗ trợ và tham gia tích cực vào các hoạt động chung của lớp, tập thể, khoa và Học viện"], ["5d", "Đạt thành tích đặc biệt trong học tập, rèn luyện"]]
  },
  CC: "Quyết định số 4185/QĐ-HCQG ngày 08/9/2023 của Giám đốc Học viện Hành chính Quốc gia (áp dụng theo Công văn số 2020-CV/HVHCQTC ngày 15/9/2026 cho sinh viên trúng tuyển năm 2023, 2024, 2025)",
  xl: d => d == null ? "" : d >= 90 ? "Xuất sắc" : d >= 80 ? "Tốt" : d >= 65 ? "Khá" : d >= 50 ? "Trung bình" : d >= 35 ? "Yếu" : "Kém",
  mucXL: "Xuất sắc 90–100 · Tốt 80 đến dưới 90 · Khá 65 đến dưới 80 · Trung bình 50 đến dưới 65 · Yếu 35 đến dưới 50 · Kém dưới 35" };
const khungOf = s => (+s.khoa && +s.khoa <= 2025) ? KH_4185 : KH_TT40;
let KH = KH_TT40;
function useKhung(s) { KH = khungOf(s); DRL_N = KH.N; DRL_TC = KH.TC; DRL_CC = KH.CC; xlDrl = KH.xl; return KH; }
function tabRL(V, th) {
  const { s, edit, own, acts } = V; useKhung(s);
  const ks = kyList(s.khoa).filter(k => k <= kyNow());
  if (!V.ky || !ks.includes(V.ky)) V.ky = ks[ks.length - 1] || kyNow();
  const k = V.ky, hk = hkOfKy(s.khoa, k), H = th && th.hk[hk], tu = ((s.drlTu || {})[k]) || {}, off = (s.drl || {})[k] || {}, ch = off.chiTiet || {}, goiY = hdTong(acts, k);
  const tc = tu.c || {}, mc = tu.mc || {}, chot = off.diem != null, lock = !own || chot || (tu.gui && !V.rlSua);
  const nSum = (n, o) => { const x = DRL_TC[n].map(([c]) => numOf(o[c])).filter(v => v != null); return x.length ? x.reduce((p, q) => p + q, 0) : (numOf(tu[n]) ?? null); };
  const tuTot = DRL_N.reduce((t, [n]) => t + (nSum(n, tc) || 0), 0);
  const years = {}; Object.keys(s.drl || {}).forEach(x => { const y = x.split("_")[0]; (years[y] = years[y] || []).push(numOf(s.drl[x].diem)); });
  const yAvg = Object.entries(years).map(([y, a]) => { const v = a.filter(x => x != null); return [y, v.length ? r1(v.reduce((p, q) => p + q, 0) / v.length) : null]; }).sort();
  const yv = yAvg.map(x => x[1]).filter(x => x != null), toan = yv.length ? r1(yv.reduce((p, q) => p + q, 0) / yv.length) : null;
  const st = chot ? `<span class="hs-chip" style="color:#1b6e3a;background:#e3f4e8">Đã chốt: ${off.diem} điểm — ${esc(off.xepLoai || "")}</span>` : tu.gui ? `<span class="hs-chip" style="color:#1e40af;background:#e0e9fb">Đã gửi CVHT ${esc(fmtD(String(tu.guiAt || tu.at || "").slice(0, 10)))}</span>` : tu.at ? `<span class="hs-chip" style="color:#92400e;background:#fef3c7">Bản nháp — chưa gửi</span>` : `<span class="hs-chip" style="color:#6b7280;background:#eef0f3">Chưa tự đánh giá</span>`;
  const rows = DRL_N.map(([n, name, m], gi) => `<tr class="hs-rlg"><td><b>${gi + 1}. ${esc(name)}</b>${["n3", "n4", "n5"].includes(n) && goiY[n] ? `<br><small class="muted">Phong trào đã xác nhận gợi ý: ${goiY[n]} điểm</small>` : ""}</td><td class="c"><b>${m}</b></td>
      <td class="c"><b data-rlsum="${n}">${nSum(n, tc) ?? ""}</b></td><td></td>
      <td class="c">${edit && !chot ? `<input class="hs-in b" data-rl="cv" data-c="${n}" data-max="${m}" value="${esc(ch[n] ?? nSum(n, tc) ?? "")}" style="width:56px">` : `<b>${esc(ch[n] ?? "")}</b>`}</td></tr>` +
    DRL_TC[n].map(([c, t]) => `<tr class="hs-rlc"><td><span class="hs-rlk">${c}</span> ${esc(t)}</td><td class="c muted">≤ ${m}</td>
      <td class="c">${lock ? esc(tc[c] ?? "") : `<input class="hs-in" data-rlc="${c}" data-n="${n}" data-max="${m}" value="${esc(tc[c] ?? "")}" inputmode="decimal" style="width:52px">`}</td>
      <td>${lock ? `<small>${esc(mc[c] || "")}</small>` : `<input class="hs-gc" data-rlmc="${c}" value="${esc(mc[c] || "")}" placeholder="Minh chứng: hoạt động, giấy khen, link…">`}</td><td></td></tr>`).join("")).join("");
  return `<div class="sbox"><h3 class="sbox-title">RÈN LUYỆN — PHIẾU TỰ ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN</h3>
    <div class="hs-kysel">${ks.map(x => `<button type="button" data-ky="${x}" class="${x === k ? "on" : ""}">HK ${ROMAN[hkOfKy(s.khoa, x)]}<small>${esc(x.split("_")[0].replace("-", "–"))}</small></button>`).join("")}</div>
    <div class="hs-hksum"><span>${esc(kyName(k))}: ${st}</span><span>Học tập kỳ này: <b>${H && H.g4 != null ? H.g4.toFixed(2) : "—"}</b> (thang 4) · ${H ? hocLuc(H.g4) || "—" : "—"}</span><span>Phong trào đã xác nhận: <b>${goiY.n3 + goiY.n4 + goiY.n5}</b> điểm gợi ý</span></div>
    <ol class="hs-steps"><li class="${tu.at ? "ok" : "on"}">Sinh viên tự chấm từng tiêu chí, ghi minh chứng</li><li class="${tu.gui ? "ok" : tu.at ? "on" : ""}">Gửi phiếu cho ban cán sự lớp, cố vấn học tập</li><li class="${chot ? "ok" : tu.gui ? "on" : ""}">CVHT chủ trì họp lớp (BCS, BCH chi đoàn, chi hội) đánh giá, lập biên bản</li><li class="${chot ? "on" : ""}">Hội đồng cấp Khoa, cấp Học viện xét, công nhận</li></ol>
    <div class="tbl-wrap"><table class="adm-table hs-rl"><thead><tr><th>Nội dung, tiêu chí đánh giá</th><th class="c">Điểm tối đa</th><th class="c">Sinh viên tự đánh giá</th><th>Minh chứng, giải trình</th><th class="c">Lớp / CVHT đánh giá</th></tr></thead><tbody>
      ${rows}
      <tr class="hs-tot"><td><b>TỔNG ĐIỂM</b></td><td class="c"><b>100</b></td><td class="c"><b id="rlTu">${tuTot || ""}</b> <small id="rlTuXl">${tuTot ? xlDrl(tuTot) : ""}</small></td><td></td><td class="c"><b>${off.diem ?? ""}</b> ${xlChip(off.xepLoai)}</td></tr>
    </tbody></table></div>
    ${own && !chot ? (lock ? `<div class="dlg-act" style="justify-content:flex-start"><button type="button" class="btn" id="rlSua">✎ Sửa phiếu đã gửi</button><button type="button" class="btn" id="rlIn">🖨 In / lưu PDF phiếu</button></div>`
      : `<label class="fld"><span>Tự nhận xét, giải trình chung</span><textarea id="rlNote" rows="2" class="fld-sel">${esc(tu.gc || "")}</textarea></label>
      <div class="dlg-act" style="justify-content:flex-start"><button type="button" class="btn" id="rlNhap">Lưu nháp</button><button type="button" class="btn primary" id="rlGui">Gửi phiếu tự đánh giá</button>${tu.at ? `<button type="button" class="btn" id="rlIn">🖨 In / lưu PDF phiếu</button>` : ""}</div>`) : ""}
    ${own && chot ? `<div class="dlg-act" style="justify-content:flex-start"><button type="button" class="btn" id="rlIn">🖨 In / lưu PDF phiếu</button></div>` : ""}
    ${edit ? `${tu.gc ? `<p class="hs-sm"><b>Sinh viên tự nhận xét:</b> ${esc(tu.gc)}</p>` : ""}${!tu.gui && !chot ? `<p class="hs-warn hs-sm">Sinh viên chưa gửi phiếu tự đánh giá kỳ này.</p>` : ""}
      ${chot ? `<p class="hs-sm"><b>Nhận xét:</b> ${esc(off.ghiChu || "—")}</p><div class="dlg-act" style="justify-content:flex-start"><button type="button" class="btn" id="rlMo">Mở lại để sửa kết quả</button><button type="button" class="btn" id="rlIn">🖨 In / lưu PDF phiếu</button></div>`
        : `<div class="dlg-act" style="justify-content:flex-start"><label class="fld" style="flex:1;margin:0"><input id="rlCvNote" placeholder="Nhận xét của CVHT / tập thể lớp…" value="${esc(off.ghiChu || "")}"></label><button type="button" class="btn primary" id="rlCvSave">Chốt kết quả kỳ này</button>${tu.at ? `<button type="button" class="btn" id="rlIn">🖨 In phiếu</button>` : ""}</div>`}` : ""}
    <p class="muted hs-sm">Căn cứ: ${esc(DRL_CC)}. Điểm các tiêu chí trong một nhóm cộng lại không vượt mức tối đa của nhóm. Xếp loại: ${esc(KH.mucXL)}. Theo Công văn 2020-CV/HVHCQTC: sinh viên đạt điểm ở nhiều nội dung thì lấy mục điểm cao nhất; vi phạm ở nội dung nào thì không tính điểm nội dung đó; bị nhắc nhở bằng văn bản thì kết quả kỳ đó không quá loại khá; không tự đánh giá hoặc nộp phiếu không đúng hạn bị xếp loại yếu hoặc kém.</p>
    <h4 class="hs-h4">Kết quả rèn luyện các kỳ</h4>
    <table class="adm-table"><thead><tr><th>Học kỳ</th><th class="c">Tự đánh giá</th><th class="c">Kết quả</th><th>Xếp loại</th><th>Ghi chú</th></tr></thead><tbody>${[...new Set([...Object.keys(s.drl || {}), ...Object.keys(s.drlTu || {})])].sort().map(x => { const d = (s.drl || {})[x] || {}, t = (s.drlTu || {})[x] || {}, tt = DRL_N.reduce((n, [g]) => n + (DRL_TC[g].map(([c]) => numOf((t.c || {})[c]) || 0).reduce((p, q) => p + q, 0) || numOf(t[g]) || 0), 0); return `<tr><td>${esc(kyName(x))}</td><td class="c">${t.at ? tt : "—"}</td><td class="c">${d.diem ?? "—"}</td><td>${xlChip(d.xepLoai)}</td><td class="muted">${esc(d.ghiChu || "")}</td></tr>`; }).join("") || `<tr><td colspan="5" class="muted">Chưa có.</td></tr>`}</tbody></table>
    ${yAvg.length ? `<p class="hs-sm">${yAvg.map(([y, v]) => `Năm học ${esc(y.replace("-", "–"))}: <b>${v ?? "—"}</b> ${v != null ? xlChip(xlDrl(v)) : ""}`).join(" · ")}${toan != null ? ` · Toàn khóa (đến nay): <b>${toan}</b>` : ""}</p>` : ""}</div>`;
}
/* In phiếu tự đánh giá (cửa sổ in, lưu PDF được) */
function inPhieuRL(V) {
  useKhung(V.s); const { s } = V, k = V.ky, tu = ((s.drlTu || {})[k]) || {}, off = (s.drl || {})[k] || {}, tc = tu.c || {}, mc = tu.mc || {}, ch = off.chiTiet || {};
  const nSum = n => { const x = DRL_TC[n].map(([c]) => numOf(tc[c])).filter(v => v != null); return x.length ? x.reduce((p, q) => p + q, 0) : (numOf(tu[n]) ?? ""); };
  const tot = DRL_N.reduce((t, [n]) => t + (+nSum(n) || 0), 0), [y, n] = k.split("_");
  const w = window.open("", "_blank"); if (!w) return P.toast("Trình duyệt chặn cửa sổ in. Hãy cho phép cửa sổ bật lên.", "err");
  w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu tự đánh giá rèn luyện — ${esc(s.mssv)}</title><style>
    body{font:13pt "Times New Roman",serif;margin:18mm 16mm;color:#000}table{border-collapse:collapse;width:100%}td,th{border:1px solid #000;padding:4px 6px;vertical-align:top}th{font-weight:bold;text-align:center}
    .hd{display:grid;grid-template-columns:1fr 1fr;text-align:center;border:0}.hd td{border:0}.c{text-align:center}.g td{font-weight:bold}h1{font-size:14pt;text-align:center;margin:14px 0 4px}p{margin:4px 0}.sig{display:grid;grid-template-columns:1fr 1fr;text-align:center;margin-top:18px}
    @page{size:A4;margin:0}</style></head><body>
    <table class="hd"><tr><td>HỌC VIỆN CHÍNH TRỊ QUỐC GIA HỒ CHÍ MINH<br><b>HỌC VIỆN HÀNH CHÍNH VÀ QUẢN TRỊ CÔNG</b><br><b>KHOA LUẬT</b></td><td><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
    <h1>PHIẾU TỰ ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN CỦA SINH VIÊN</h1><p class="c">Học kỳ ${n === "1" ? "I" : "II"}, năm học ${esc(y.replace("-", " - "))}</p>
    <p>Họ và tên: <b>${esc(s.hoTen)}</b> &nbsp; Mã sinh viên: <b>${esc(s.mssv)}</b> &nbsp; Ngày sinh: ${esc(fmtD(s.ngaySinh))}</p><p>Lớp: ${esc(s.lop)} &nbsp; Ngành: ${esc(s.nganh || "")} &nbsp; Khóa: ${esc(s.khoa || "")}</p>
    <table><thead><tr><th style="width:46%">Nội dung, tiêu chí đánh giá</th><th>Điểm tối đa</th><th>SV tự đánh giá</th><th>Minh chứng</th><th>Lớp / CVHT đánh giá</th></tr></thead><tbody>
    ${DRL_N.map(([g, name, m], i) => `<tr class="g"><td>${i + 1}. ${esc(name)}</td><td class="c">${m}</td><td class="c">${nSum(g)}</td><td></td><td class="c">${ch[g] ?? ""}</td></tr>` + DRL_TC[g].map(([c, t]) => `<tr><td>${c}) ${esc(t)}</td><td></td><td class="c">${esc(tc[c] ?? "")}</td><td>${esc(mc[c] || "")}</td><td></td></tr>`).join("")).join("")}
    <tr class="g"><td>TỔNG CỘNG</td><td class="c">100</td><td class="c">${tot}</td><td></td><td class="c">${off.diem ?? ""}</td></tr></tbody></table>
    <p>Xếp loại tự đánh giá: <b>${xlDrl(tot)}</b>${off.diem != null ? ` · Kết quả lớp / CVHT: <b>${off.diem} — ${esc(off.xepLoai || "")}</b>` : ""}</p>${tu.gc ? `<p>Tự nhận xét: ${esc(tu.gc)}</p>` : ""}${off.ghiChu ? `<p>Nhận xét của CVHT: ${esc(off.ghiChu)}</p>` : ""}
    <p style="font-size:11pt"><i>Căn cứ: ${esc(DRL_CC)}.</i></p>
    <div class="sig"><div><b>CỐ VẤN HỌC TẬP</b><br><i>(Ký, ghi rõ họ tên)</i><br><br><br><br>${esc((s.cvht || []).map(P.showName).join(", "))}</div><div><i>Hà Nội, ngày ..... tháng ..... năm ${new Date().getFullYear()}</i><br><b>SINH VIÊN</b><br><i>(Ký, ghi rõ họ tên)</i><br><br><br><br>${esc(s.hoTen)}</div></div>
    <script>onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`);
  w.document.close();
}

/* ---- PHONG TRÀO ---- */
function tabPT(V) {
  const { s, own, edit, acts } = V;
  const bcs = V.bcsList;
  const row = (a, conf) => { const t = HD_TT[a.tt] || HD_TT.cho; return `<tr><td>${esc(fmtD(a.ngay))}</td><td><b>${esc(a.ten)}</b>${a.moTa ? `<br><small class="muted">${esc(a.moTa)}</small>` : ""}${a.minhChung ? `<br><a href="${esc(a.minhChung)}" target="_blank" rel="noopener">Minh chứng ↗</a>` : ""}${conf ? `<br><small>${esc(a.hoTen || a.mssv)} · ${esc(a.mssv)}</small>` : ""}</td>
    <td>${esc((HD_NHOM[a.nhom] || "").split("(")[0])}</td><td>${esc((HD_CAP[a.cap] || [""])[0])}</td><td>${esc((HD_VT[a.vaiTro] || [""])[0])}</td><td class="c">${hdDiem(a)}</td>
    <td><span class="hs-chip" style="color:${t[1]};background:${t[2]}">${t[0]}</span>${a.xn && a.xn.by ? `<br><small class="muted">${esc(P.showName(a.xn.by))}${a.xn.gc ? ": " + esc(a.xn.gc) : ""}</small>` : ""}</td>
    <td>${conf ? `<button type="button" class="btn sm primary" data-hdok="${esc(a.mssv)}|${esc(a.id)}">Xác nhận</button> <button type="button" class="btn sm" data-hdno="${esc(a.mssv)}|${esc(a.id)}">Không</button>` : (own && a.tt !== "ok") || isAdmin() ? `<button type="button" class="linkish" data-hddel="${esc(a.id)}">Xóa</button>` : (edit && a.tt === "cho") ? `<button type="button" class="btn sm primary" data-hdok="${esc(s.mssv)}|${esc(a.id)}">Xác nhận</button>` : ""}</td></tr>`; };
  const ky = {}; acts.forEach(a => (ky[a.ky || ""] = ky[a.ky || ""] || []).push(a));
  return `<div class="sbox"><h3 class="sbox-title">PHONG TRÀO — HOẠT ĐỘNG ĐÃ THAM GIA</h3>
    <p class="muted hs-sm">Sinh viên kê khai từng hoạt động; ban cán sự lớp hoặc cố vấn học tập xác nhận thì hoạt động mới được tính vào thành tích và gợi ý điểm rèn luyện (nhóm 3, 4, 5). Điểm tạm tính = cấp tổ chức (lớp 2 · khoa 3 · Học viện 4 · ngoài Học viện 5) + vai trò (tham gia 0 · ban tổ chức 2 · đạt giải/khen thưởng 3), cộng theo kỳ và không vượt mức tối đa của nhóm.</p>
    ${own ? `<details class="more"${acts.length ? "" : " open"}><summary>＋ Kê khai hoạt động mới</summary><div class="grid2">
      <label class="fld"><span>Tên hoạt động *</span><input id="hdTen" placeholder="Ví dụ: Tình nguyện Mùa hè xanh 2026"></label><label class="fld"><span>Ngày</span><input id="hdNgay" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
      <label class="fld"><span>Nhóm</span><select id="hdNhom">${Object.entries(HD_NHOM).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("")}</select></label>
      <label class="fld"><span>Cấp tổ chức</span><select id="hdCap">${Object.entries(HD_CAP).map(([k, n]) => `<option value="${k}">${esc(n[0])}</option>`).join("")}</select></label>
      <label class="fld"><span>Vai trò / kết quả</span><select id="hdVt">${Object.entries(HD_VT).map(([k, n]) => `<option value="${k}">${esc(n[0])}</option>`).join("")}</select></label>
      <label class="fld"><span>Link minh chứng (ảnh, giấy chứng nhận trên Drive…)</span><input id="hdMc" placeholder="https://"></label></div>
      <label class="fld"><span>Mô tả ngắn</span><input id="hdMt"></label><div class="dlg-act" style="justify-content:flex-start"><button type="button" class="btn primary" id="hdAdd">Gửi kê khai</button></div><p class="err" id="hdErr"></p></details>` : ""}
    ${Object.keys(ky).sort().reverse().map(k => { const g = hdTong(acts, k); return `<h4 class="hs-h4">${k ? esc(kyName(k)) : "Chưa xác định kỳ"} <small class="muted">— đã xác nhận: nhóm 3 ${g.n3} · nhóm 4 ${g.n4} · nhóm 5 ${g.n5} điểm</small></h4>
      <div class="tbl-wrap"><table class="adm-table hs-hd"><thead><tr><th>Ngày</th><th>Hoạt động</th><th>Nhóm</th><th>Cấp</th><th>Vai trò</th><th class="c">Điểm</th><th>Xác nhận</th><th></th></tr></thead><tbody>${ky[k].sort((a, b) => String(b.ngay).localeCompare(String(a.ngay))).map(a => row(a, false)).join("")}</tbody></table></div>`; }).join("") || `<p class="muted">Chưa kê khai hoạt động nào.</p>`}
    ${bcs ? `<h4 class="hs-h4">Hoạt động của lớp ${esc(s.lop)} chờ ban cán sự xác nhận (${bcs.length})</h4>${bcs.length ? `<div class="tbl-wrap"><table class="adm-table hs-hd"><thead><tr><th>Ngày</th><th>Hoạt động</th><th>Nhóm</th><th>Cấp</th><th>Vai trò</th><th class="c">Điểm</th><th>Trạng thái</th><th></th></tr></thead><tbody>${bcs.map(a => row(a, true)).join("")}</tbody></table></div>` : `<p class="muted">Không có kê khai nào đang chờ.</p>`}` : ""}</div>`;
}

/* ---- THỦ TỤC – DỊCH VỤ CÔNG ---- */
function tabTT(V) {
  const { dons, own } = V;
  const ttLinks = THU_TUC.filter(t => t.active !== false);
  return `<div class="sbox"><h3 class="sbox-title">THỦ TỤC — DỊCH VỤ CÔNG</h3>
    ${dons.length ? `<div class="tbl-wrap"><table class="adm-table"><thead><tr><th>Mã hồ sơ</th><th>Thủ tục</th><th>Ngày gửi</th><th>Trạng thái</th><th>Kết quả</th></tr></thead><tbody>${dons.map(d => { const last = (d.history || []).slice(-1)[0] || {}; return `<tr class="tt-row" data-go="tt-don/${esc(d.id)}"><td><b>${esc(d.ma || "")}</b></td><td>${esc(d.ttTen || "")}</td><td>${esc(fmtD(String(d.created || "").slice(0, 10)))}</td><td>${esc(DON_TT[d.status] || d.status || "")}${last.at ? `<br><small class="muted">${esc(fmtD(String(last.at).slice(0, 10)))}${last.note ? ": " + esc(last.note) : ""}</small>` : ""}</td><td>${d.banKySo ? `<a href="${esc(d.banKySo)}" target="_blank" rel="noopener">Bản ký số ↗</a>` : d.status === "da-duyet" ? "Đã duyệt — in tại trang đơn" : ""}</td></tr>`; }).join("")}</tbody></table></div>` : `<p class="muted">Chưa có hồ sơ thủ tục nào.</p>`}
    ${own ? `<h4 class="hs-h4">Lập đơn mới</h4><div class="tt-links">${ttLinks.map(t => `<a href="#tt/${esc(t.key)}"><span class="tt-dot"></span>${esc(t.ten)}</a>`).join("")}</div>` : ""}</div>`;
}

async function bindSv(V) {
  const { s, edit, own } = V;
  const rerender = () => drawSv(V);
  const saveDoc = async (patch, msg) => { await setDoc(doc(db, "pna_hoso", s.mssv), { ...patch, updated: nowISO(), by: myEmail() }, { merge: true }); P.logAct("HOSO", s.mssv + " · " + msg); ALL = null; };
  const save = async (patch, msg) => { await saveDoc(patch, msg); Object.assign(s, patch); P.toast("Đã lưu.", "ok"); rerender(); };
  document.querySelectorAll("[data-htview]").forEach(b => b.onclick = () => { V.view = b.dataset.htview; rerender(); });
  document.querySelectorAll("[data-hk]").forEach(b => b.onclick = () => { V.hk = +b.dataset.hk; rerender(); });
  document.querySelectorAll("[data-ky]").forEach(b => b.onclick = () => { V.ky = b.dataset.ky; rerender(); });
  /* Học tập: lưu từng ô */
  const putHT = async (k, f, val) => {
    const v = { ...((s.hocTap || {})[k] || {}), [f]: val, ...(f === "diem" ? { tx: "", dk: "", thi: "" } : {}), at: nowISO(), by: myEmail() };
    s.hocTap = { ...(s.hocTap || {}), [k]: v };
    try { await setDoc(doc(db, "pna_hoso", s.mssv), { hocTap: { [k]: v }, updated: nowISO(), by: myEmail() }, { merge: true }); ALL = null; } catch (e) { P.toast("Chưa lưu được: " + e.message, "err"); }
  };
  document.querySelectorAll(".hs-ct input").forEach(i => i.addEventListener("change", async () => {
    const f = i.dataset.f; let val;
    if (i.type === "checkbox") val = i.checked;
    else if (f === "gc") val = i.value.trim();
    else { const t = i.value.trim().replace(",", "."); if (t !== "" && (isNaN(+t) || +t < 0 || +t > 10)) { P.toast("Điểm từ 0 đến 10.", "err"); i.value = ""; return; } val = t === "" ? "" : +t; }
    await putHT(i.dataset.k, f, val);
    if (f !== "gc") { const y = window.scrollY; rerender(); window.scrollTo(0, y); }
  }));
  /* Rèn luyện */
  const rlVals = who => { const o = {}; let bad = false; document.querySelectorAll(`[data-rl="${who}"]`).forEach(i => { const t = i.value.trim(); if (t === "") return; const n = +t.replace(",", "."); if (isNaN(n) || n < 0 || n > +i.dataset.max) bad = true; o[i.dataset.c] = n; }); return bad ? null : o; };
  /* Phiếu tự đánh giá: cộng nhóm ngay khi gõ */
  const rlTuRead = () => { const c = {}, mc = {}, sums = {}; let bad = "";
    document.querySelectorAll("[data-rlc]").forEach(i => { const t = i.value.trim().replace(",", "."); if (t === "") return; const n = +t; if (isNaN(n) || n < 0) bad = "Điểm tiêu chí " + i.dataset.rlc + " không hợp lệ."; c[i.dataset.rlc] = n; sums[i.dataset.n] = (sums[i.dataset.n] || 0) + n; });
    document.querySelectorAll("[data-rlmc]").forEach(i => { if (i.value.trim()) mc[i.dataset.rlmc] = i.value.trim(); });
    DRL_N.forEach(([g, name, m]) => { if ((sums[g] || 0) > m) bad = bad || `Nhóm ${g.slice(1)} vượt mức tối đa ${m} điểm (đang ${sums[g]}).`; });
    return { c, mc, sums, bad }; };
  const rlTuShow = () => { const { sums, bad } = rlTuRead(); let t = 0;
    DRL_N.forEach(([g, , m]) => { const e = document.querySelector(`[data-rlsum="${g}"]`); if (e) { e.textContent = sums[g] != null ? sums[g] : ""; e.style.color = (sums[g] || 0) > m ? "#b3261e" : ""; } t += Math.min(sums[g] || 0, m); });
    if ($("#rlTu")) $("#rlTu").textContent = t || ""; if ($("#rlTuXl")) $("#rlTuXl").textContent = t ? xlDrl(t) : ""; return bad; };
  document.querySelectorAll("[data-rlc]").forEach(i => i.addEventListener("input", rlTuShow));
  const rlTuSave = async gui => {
    const { c, mc, sums, bad } = rlTuRead(); if (bad) return P.toast(bad, "err");
    if (gui) {
      const thieu = Object.values(DRL_TC).flat().filter(([cc]) => c[cc] == null).map(([cc]) => cc);
      if (thieu.length) return P.toast("Chấm đủ các tiêu chí trước khi gửi (còn thiếu: " + thieu.join(", ") + "). Tiêu chí không có thì ghi 0.", "err");
      const tot = DRL_N.reduce((n, [g]) => n + (sums[g] || 0), 0);
      if (!await P.ask(`Gửi phiếu tự đánh giá ${kyName(V.ky)}: ${tot} điểm — ${xlDrl(tot)} cho ban cán sự lớp và cố vấn học tập?`)) return;
    }
    const o = { khung: KH.key, c, mc, ...Object.fromEntries(DRL_N.map(([g]) => [g, sums[g] ?? null])), gc: ($("#rlNote") || {}).value ? $("#rlNote").value.trim() : "", at: nowISO(), gui: !!gui, ...(gui ? { guiAt: nowISO() } : {}) };
    try { V.rlSua = false; await save({ drlTu: { ...(s.drlTu || {}), [V.ky]: o } }, (gui ? "gửi" : "lưu nháp") + " phiếu tự đánh giá RL " + V.ky); } catch (e) { P.toast("Chưa lưu được: " + e.message, "err"); }
  };
  if ($("#rlNhap")) $("#rlNhap").onclick = () => rlTuSave(false);
  if ($("#rlGui")) $("#rlGui").onclick = () => rlTuSave(true);
  if ($("#rlSua")) $("#rlSua").onclick = () => { V.rlSua = true; rerender(); };
  document.querySelectorAll("#rlIn").forEach(b => b.onclick = () => inPhieuRL(V));
  if ($("#rlMo")) $("#rlMo").onclick = async () => {
    if (!await P.ask("Mở lại kết quả rèn luyện " + kyName(V.ky) + " để sửa? Kết quả đã chốt sẽ được gỡ cho tới khi chốt lại.")) return;
    const d = { ...(s.drl || {}) }; const old = d[V.ky] || {}; d[V.ky] = { chiTiet: old.chiTiet || {}, ghiChu: old.ghiChu || "", diem: null, xepLoai: "" };
    try { await save({ drl: d }, "mở lại RL " + V.ky); } catch (e) { P.toast("Chưa lưu được: " + e.message, "err"); }
  };
  if ($("#rlCvSave")) $("#rlCvSave").onclick = async () => {
    const o = rlVals("cv"); if (!o) return P.toast("Điểm mỗi nhóm không vượt mức tối đa.", "err");
    if (DRL_N.some(([c]) => o[c] == null)) return P.toast("Nhập đủ điểm 5 nhóm tiêu chí trước khi chốt.", "err");
    const tot = DRL_N.reduce((n, [c]) => n + (o[c] || 0), 0);
    if (!await P.ask(`Chốt kết quả rèn luyện ${kyName(V.ky)}: ${tot} điểm — ${xlDrl(tot)}?`)) return;
    try { await save({ drl: { ...(s.drl || {}), [V.ky]: { diem: tot, xepLoai: xlDrl(tot), chiTiet: o, ghiChu: $("#rlCvNote").value.trim(), nguon: "Phiếu đánh giá — " + myEmail() } } }, "chốt RL " + V.ky); } catch (e) { P.toast("Chưa lưu được: " + e.message, "err"); }
  };
  /* Phong trào */
  if ($("#hdAdd")) $("#hdAdd").onclick = async () => {
    const ten = $("#hdTen").value.trim(), ngay = $("#hdNgay").value; if (!ten) return $("#hdErr").textContent = "Nhập tên hoạt động.";
    const a = { ten, ngay, ky: kyOfDate(ngay), nhom: $("#hdNhom").value, cap: $("#hdCap").value, vaiTro: $("#hdVt").value, minhChung: $("#hdMc").value.trim(), moTa: $("#hdMt").value.trim(), tt: "cho", mssv: s.mssv, hoTen: s.hoTen, lop: s.lop, cvht: s.cvht || [], created: nowISO(), by: myEmail() };
    if (a.minhChung && !/^https?:\/\//i.test(a.minhChung)) return $("#hdErr").textContent = "Link minh chứng phải bắt đầu bằng https://";
    try { const r = await addDoc(collection(db, "pna_hoso", s.mssv, "hoatdong"), a); V.acts.push({ id: r.id, ...a }); P.toast("Đã gửi kê khai, chờ xác nhận.", "ok"); rerender(); } catch (e) { $("#hdErr").textContent = "Chưa gửi được: " + e.message; }
  };
  const xn = async (key, ok) => {
    const [m, id] = key.split("|"); let gc = "";
    if (!ok) { const r = await P.ask("Lý do không xác nhận (sinh viên sẽ thấy):", { title: "KHÔNG XÁC NHẬN HOẠT ĐỘNG", input: "Lý do", ok: "Gửi" }); if (r === null || r === false) return; gc = String(r).trim(); }
    const patch = { tt: ok ? "ok" : "no", xn: { by: myEmail(), at: nowISO(), gc } };
    try { await updateDoc(doc(db, "pna_hoso", m, "hoatdong", id), patch);
      [V.acts, V.bcsList || []].forEach(L => L.forEach(a => { if (a.id === id) Object.assign(a, patch); }));
      if (V.bcsList) V.bcsList = V.bcsList.filter(a => a.tt === "cho"); P.toast(ok ? "Đã xác nhận." : "Đã trả lại.", "ok"); rerender(); } catch (e) { P.toast("Chưa lưu được: " + e.message, "err"); }
  };
  document.querySelectorAll("[data-hdok]").forEach(b => b.onclick = () => xn(b.dataset.hdok, true));
  document.querySelectorAll("[data-hdno]").forEach(b => b.onclick = () => xn(b.dataset.hdno, false));
  document.querySelectorAll("[data-hddel]").forEach(b => b.onclick = async () => { if (!await P.ask("Xóa kê khai này?")) return; try { await deleteDoc(doc(db, "pna_hoso", s.mssv, "hoatdong", b.dataset.hddel)); V.acts = V.acts.filter(a => a.id !== b.dataset.hddel); rerender(); } catch (e) { P.toast(e.message, "err"); } });
  /* Ban cán sự: tải kê khai chờ của lớp (một lần) */
  if (V.tab === "phong-trao" && own && s.chucVu && !V.bcsList) {
    try { const q = await getDocs(query(collectionGroup(db, "hoatdong"), where("lop", "==", s.lop), where("tt", "==", "cho"))); V.bcsList = []; q.forEach(d => { const a = { id: d.id, ...d.data() }; if (a.mssv !== s.mssv) V.bcsList.push(a); }); rerender(); return; } catch (e) { V.bcsList = []; console.warn("BCS", e.message); }
  }
  if (!edit) return;
  if ($("#svEv")) $("#svEv").onclick = () => evDialog(s, async (p, m) => { await saveDoc(p, m); Object.assign(s, p); P.toast("Đã lưu.", "ok"); rerender(); });
  if ($("#svEdit")) $("#svEdit").onclick = () => editDialog(s, async (p, m) => { await saveDoc(p, m); Object.assign(s, p); P.toast("Đã lưu.", "ok"); rerender(); });
  document.querySelectorAll("[data-evdel]").forEach(b => b.onclick = async () => {
    const i = +b.dataset.evdel, e = (s.suKien || [])[i]; if (!e || !await P.ask("Xóa sự kiện “" + ((SK[e.loai] || SK.khac)[0]) + "” khỏi hồ sơ?")) return;
    try { await save({ suKien: s.suKien.filter((_, j) => j !== i) }, "xóa sự kiện"); } catch (x) { P.toast(x.message, "err"); }
  });
  if ($("#noteAdd")) $("#noteAdd").onclick = async () => { const t = $("#noteIn").value.trim(); if (!t) return; try { const r = await addDoc(collection(db, "pna_hoso", s.mssv, "noibo"), { noiDung: t, at: nowISO(), by: myEmail() }); V.notes.push({ id: r.id, noiDung: t, at: nowISO(), by: myEmail() }); rerender(); } catch (e) { P.toast("Chưa lưu được: " + e.message, "err"); } };
  document.querySelectorAll("[data-notedel]").forEach(b => b.onclick = async () => { if (!await P.ask("Xóa ghi chú này?")) return; try { await deleteDoc(doc(db, "pna_hoso", s.mssv, "noibo", b.dataset.notedel)); V.notes = V.notes.filter(n => n.id !== b.dataset.notedel); rerender(); } catch (e) { P.toast(e.message, "err"); } });
}

async function loadDons(s, own) {
  const out = [];
  let q;
  if (own) q = query(collection(db, "pna_don"), where("sv.email", "==", myEmail()));
  else if (isAdmin()) q = query(collection(db, "pna_don"), where("sv.mssv", "==", s.mssv));
  else if ((s.cvht || []).includes(myEmail())) q = query(collection(db, "pna_don"), where("cvht", "array-contains", myEmail()));
  else return out;
  (await getDocs(q)).forEach(d => { const x = d.data(); if (x.sv && x.sv.mssv === s.mssv) out.push({ id: d.id, ...x }); });
  return out.sort((a, b) => String(b.created).localeCompare(String(a.created)));
}

/* ---------- Hộp thoại (dùng #dlgConfirm của khung) ---------- */
function formDlg(title, html, onOk) {
  const dlg = $("#dlgConfirm"), yes = $("#cfYes"), no = $("#cfNo");
  $("#cfTitle").textContent = title; $("#cfMsg").textContent = "";
  $("#cfInputWrap").hidden = true; $("#cfSelect").hidden = true; $("#cfExtra").innerHTML = `<div class="hs-form">${html}</div><p class="err" id="hsErr"></p>`;
  yes.textContent = "Lưu"; dlg.onclose = null;
  const close = () => { yes.onclick = no.onclick = dlg.onclose = null; dlg.close(); $("#cfExtra").innerHTML = ""; yes.textContent = "Đồng ý"; };
  no.onclick = close;
  yes.onclick = async () => { yes.disabled = true; try { if (await onOk() !== false) close(); } catch (e) { $("#hsErr").textContent = "Chưa lưu được: " + e.message; } finally { yes.disabled = false; } };
  dlg.showModal();
}
function evDialog(s, save) {
  formDlg("GHI NHẬN SỰ KIỆN — " + s.hoTen.toUpperCase(), `
    <label class="fld"><span>Loại sự kiện</span><select id="evLoai">${Object.keys(SK).map(k => `<option value="${k}">${SK[k][0]}</option>`).join("")}</select></label>
    <div class="grid2"><label class="fld"><span>Ngày</span><input id="evNgay" type="date" value="${new Date().toISOString().slice(0, 10)}"></label><label class="fld"><span>Số quyết định / văn bản</span><input id="evQd" placeholder="Ví dụ: 1118-QĐ/HVHCQTC"></label></div>
    <label class="fld"><span>Nội dung</span><textarea id="evNd" rows="3"></textarea></label>
    <label class="fld chk"><input type="checkbox" id="evSt"><span id="evStL">Cập nhật trạng thái</span></label>`, async () => {
    const loai = $("#evLoai").value, ngay = $("#evNgay").value, ev = { loai, ngay, soQD: $("#evQd").value.trim(), noiDung: $("#evNd").value.trim() || SK[loai][0], nguon: "Ghi nhận bởi " + myEmail(), at: nowISO() };
    const patch = { suKien: (s.suKien || []).concat(ev) };
    if ($("#evSt").checked && SK[loai][1]) patch.trangThai = SK[loai][1];
    await save(patch, "sự kiện " + loai);
  });
  const upd = () => { const st = SK[$("#evLoai").value][1]; $("#evSt").disabled = !st; $("#evSt").checked = !!st; $("#evStL").textContent = st ? "Chuyển trạng thái sang “" + TT[st][0] + "”" : "Sự kiện này không đổi trạng thái học tập"; };
  $("#evLoai").onchange = upd; upd();
}
function editDialog(s, save) {
  const a = isAdmin();
  formDlg("THÔNG TIN SINH VIÊN", `
    <div class="grid2">
      <label class="fld"><span>Họ và tên</span><input id="edHt" value="${esc(s.hoTen)}"${a ? "" : " disabled"}></label>
      <label class="fld"><span>Ngày sinh</span><input id="edNs" type="date" value="${esc(s.ngaySinh || "")}"${a ? "" : " disabled"}></label>
      <label class="fld"><span>Điện thoại</span><input id="edSdt" value="${esc(s.sdt || "")}"></label>
      <label class="fld"><span>Email liên hệ</span><input id="edEm" value="${esc(s.emailLienHe || "")}"></label>
      <label class="fld"><span>Quê quán</span><input id="edQq" value="${esc(s.queQuan || "")}"></label>
      <label class="fld"><span>Trạng thái</span><select id="edTt">${Object.keys(TT).map(k => `<option value="${k}"${k === (s.trangThai || "dang-hoc") ? " selected" : ""}>${TT[k][0]}</option>`).join("")}</select></label>
      <label class="fld"><span>Chức vụ (cán sự)</span><input id="edCv" value="${esc(s.chucVu || "")}" placeholder="Lớp trưởng, Lớp phó, Bí thư chi đoàn…"></label>
      <label class="fld"><span>Năm học giữ chức vụ</span><input id="edCvn" value="${esc(s.chucVuNam || "")}" placeholder="2026-2027"></label>
    </div>${a ? "" : `<p class="muted">Họ tên, ngày sinh, lớp do quản trị viên sửa theo dữ liệu đào tạo.</p>`}`, async () => {
    const p = { sdt: $("#edSdt").value.trim(), emailLienHe: $("#edEm").value.trim(), queQuan: $("#edQq").value.trim(), trangThai: $("#edTt").value, chucVu: $("#edCv").value.trim(), chucVuNam: $("#edCvn").value.trim() };
    if (a) { p.hoTen = $("#edHt").value.trim() || s.hoTen; p.ten = p.hoTen.split(" ").pop(); p.ngaySinh = $("#edNs").value; }
    await save(p, "sửa thông tin");
  });
}
function drlDialog(s, save) {
  const ks = kyList(s.khoa).filter(k => k <= kyNow());
  formDlg("KẾT QUẢ RÈN LUYỆN — " + s.hoTen.toUpperCase(), `
    <label class="fld"><span>Học kỳ</span><select id="dKy">${ks.map(k => `<option value="${k}"${k === kyNow() ? " selected" : ""}>${kyName(k)}</option>`).join("")}</select></label>
    <div class="grid2"><label class="fld"><span>Điểm</span><input id="dDiem" type="number" min="0" max="100"></label><label class="fld"><span>Xếp loại (để trống: tự tính)</span><select id="dXl"><option value="">—</option>${XL.map(x => `<option>${x}</option>`).join("")}</select></label></div>
    <label class="fld"><span>Ghi chú</span><input id="dGc"></label>`, async () => {
    const k = $("#dKy").value, v = $("#dDiem").value, diem = v === "" ? null : +v;
    if (diem != null && (diem < 0 || diem > 100)) { $("#hsErr").textContent = "Điểm từ 0 đến 100."; return false; }
    await save({ drl: { ...(s.drl || {}), [k]: { diem, xepLoai: $("#dXl").value || xepLoai(diem), ghiChu: $("#dGc").value.trim(), nguon: "Nhập tay — " + myEmail() } } }, "rèn luyện " + k);
  });
  const fill = () => { const d = (s.drl || {})[$("#dKy").value] || {}; $("#dDiem").value = d.diem ?? ""; $("#dXl").value = d.xepLoai || ""; $("#dGc").value = d.ghiChu || ""; };
  $("#dKy").onchange = fill; fill();
}

/* ---------- Nhập dữ liệu (quản trị) ---------- */
async function renderNhap() {
  await loadMe();
  if (!isAdmin()) return deny("Nhập dữ liệu sinh viên");
  page("Nhập dữ liệu sinh viên", `
    <p class="tt-note">Chọn tệp <b>.json</b> hồ sơ sinh viên (do trợ lý lập từ danh sách của Học viện). Dữ liệu chỉ lưu trên Firestore của hệ thống, không đưa lên kho mã GitHub.
    Nhập lại nhiều lần không bị trùng: thông tin chung được cập nhật, kết quả rèn luyện và sự kiện được cộng dồn; cố vấn học tập đã gán trên hệ thống được giữ nguyên.</p>
    <label class="drop" id="nhDrop"><input type="file" id="nhFile" accept=".json,application/json" hidden><b>Bấm để chọn tệp hoặc kéo thả tệp .json vào đây</b></label>
    <div id="nhOut"></div>`, [["sv", "Hồ sơ sinh viên"], [null, "Nhập dữ liệu"]]);
  const take = async f => {
    let data; try { data = JSON.parse(await f.text()); } catch (e) { return $("#nhOut").innerHTML = `<p class="err">Tệp không đúng định dạng JSON.</p>`; }
    if (!data || data.loai !== "pna-hoso-sv" || !Array.isArray(data.sinhVien)) return $("#nhOut").innerHTML = `<p class="err">Không phải tệp hồ sơ sinh viên PNA.</p>`;
    const st = {}; data.sinhVien.forEach(s => st[s.trangThai] = (st[s.trangThai] || 0) + 1);
    $("#nhOut").innerHTML = `<div class="sbox" style="margin-top:12px"><h3 class="sbox-title">XEM TRƯỚC</h3>
      <p><b>${data.lops.length}</b> lớp · <b>${data.sinhVien.length}</b> sinh viên · ${Object.keys(st).map(k => `${(TT[k] || [k])[0]}: ${st[k]}`).join(" · ")}</p>
      <p class="muted">Nguồn: ${(data.nguon || []).map(esc).join("; ")}</p>
      ${(data.ghiChuNhap || []).length ? `<p><b>Lưu ý khi đối chiếu:</b></p><ul>${data.ghiChuNhap.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      <div class="tbl-wrap"><table class="adm-table"><thead><tr><th>Lớp</th><th>Tên</th><th class="c">Sĩ số</th><th>Cố vấn học tập</th></tr></thead><tbody>${data.lops.map(l => `<tr><td><b>${esc(l.id)}</b></td><td>${esc(l.ten)}</td><td class="c">${l.siSo}</td><td>${esc((l.cvht || []).join(", "))}</td></tr>`).join("")}</tbody></table></div>
      <div class="dlg-act" style="justify-content:flex-start"><button type="button" class="btn primary" id="nhGo">Nhập vào hệ thống</button></div><p class="muted" id="nhMsg"></p></div>`;
    $("#nhGo").onclick = () => doImport(data);
  };
  $("#nhFile").onchange = e => e.target.files[0] && take(e.target.files[0]);
  const dz = $("#nhDrop");
  dz.addEventListener("dragover", e => { e.preventDefault(); e.stopPropagation(); dz.classList.add("drag"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
  dz.addEventListener("drop", e => { e.preventDefault(); e.stopPropagation(); dz.classList.remove("drag"); const f = e.dataTransfer.files[0]; if (f) take(f); });
}
async function doImport(data) {
  const btn = $("#nhGo"), msg = t => $("#nhMsg").textContent = t; btn.disabled = true;
  try {
    msg("Đang đọc dữ liệu hiện có…");
    const oldL = {}; (await getDocs(collection(db, "pna_lop"))).forEach(d => oldL[d.id] = d.data());
    const oldS = {}; (await getDocs(collection(db, "pna_hoso"))).forEach(d => oldS[d.id] = d.data());
    const at = nowISO(), by = myEmail(), cv = {};
    let bt = writeBatch(db), n = 0;
    const flush = async () => { if (n) { await bt.commit(); bt = writeBatch(db); n = 0; } };
    for (const l of data.lops) {
      const o = oldL[l.id] || {};
      cv[l.id] = (o.cvht && o.cvht.length) ? o.cvht : (l.cvht || []);
      bt.set(doc(db, "pna_lop", l.id), { ten: o.ten || l.ten || "", nganh: l.nganh || o.nganh || "", khoa: l.khoa || o.khoa || "", he: l.he || "", cvht: cv[l.id], bcs: l.bcs || [], siSo: l.siSo || 0, ghiChu: l.ghiChu || "", updated: at }, { merge: true }); n++;
    }
    await flush();
    let i = 0;
    for (const s of data.sinhVien) {
      const o = oldS[s.mssv] || {};
      const key = e => [e.loai, e.soQD, e.ngay, e.namHoc, e.noiDung].join("|");
      const evs = (o.suKien || []).slice(); const seen = new Set(evs.map(key)); let added = 0;
      (s.suKien || []).forEach(e => { if (!seen.has(key(e))) { evs.push(e); seen.add(key(e)); added++; } });
      const rec = { mssv: s.mssv, hoTen: s.hoTen, ten: s.ten, ngaySinh: s.ngaySinh || o.ngaySinh || "", lop: s.lop, nganh: s.nganh, khoa: s.khoa, he: s.he || "",
        cvht: cv[s.lop] || o.cvht || [], drl: { ...(o.drl || {}), ...(s.drl || {}) }, suKien: evs,
        trangThai: !o.trangThai || added ? s.trangThai : o.trangThai,
        sdt: s.sdt || o.sdt || "", chucVu: s.chucVu || o.chucVu || "", chucVuNam: s.chucVuNam || o.chucVuNam || "",
        nguon: [...new Set([...(o.nguon || []), ...(data.nguon || [])])], updated: at, by };
      if (!o.mssv) rec.created = at;
      bt.set(doc(db, "pna_hoso", s.mssv), rec, { merge: true }); n++;
      if (n >= 400) { msg(`Đang ghi ${++i * 400 > data.sinhVien.length ? data.sinhVien.length : i * 400}/${data.sinhVien.length}…`); await flush(); }
    }
    await flush();
    P.logAct("HOSO_NHAP", data.lops.length + " lớp · " + data.sinhVien.length + " sinh viên");
    reset(); await loadMe(true);
    msg(""); P.toast(`Đã nhập ${data.sinhVien.length} hồ sơ, ${data.lops.length} lớp.`, "ok");
    location.hash = "sv";
  } catch (e) { msg("Chưa nhập xong: " + e.message); btn.disabled = false; }
}

/* ---------- Chương trình đào tạo (quản trị) ---------- */
async function renderCtdt() {
  await loadMe();
  if (!isStaff()) return deny("Chương trình đào tạo");
  const list = []; try { (await getDocs(collection(db, "pna_ctdt"))).forEach(d => list.push({ id: d.id, ...d.data() })); } catch (e) { return fail(e); }
  const a = isAdmin();
  const card = (c, i) => `<details class="more" data-i="${i}"${c.id ? "" : " open"}><summary>${c.id ? `<b>${esc(c.id)}</b> — ${esc(c.ten || "")}` : "＋ Thêm chương trình đào tạo"}</summary>
    <div class="grid2"><label class="fld"><span>Mã CTĐT</span><input data-f="id" value="${esc(c.id || "")}"${c.id ? " disabled" : ""} placeholder="LUAT-2023"></label><label class="fld"><span>Tên chương trình</span><input data-f="ten" value="${esc(c.ten || "")}" placeholder="Cử nhân Luật — áp dụng từ khóa 2023"></label>
    <label class="fld"><span>Ngành</span><input data-f="nganh" value="${esc(c.nganh || "")}"></label><label class="fld"><span>Áp dụng cho khóa (cách nhau dấu phẩy)</span><input data-f="khoa" value="${esc((c.khoa || []).join(", "))}"></label>
    <label class="fld"><span>Tổng số tín chỉ</span><input data-f="tongTC" value="${esc(c.tongTC || "")}"></label><label class="fld"><span>Đường link văn bản CTĐT (kho tài liệu / Drive)</span><input data-f="link" value="${esc(c.link || "")}"></label></div>
    <label class="fld"><span>Số tín chỉ từng học kỳ (cách nhau dấu phẩy, theo thứ tự HK I, II, …)</span><input data-f="hocKy" value="${esc((c.hocKy || []).map(h => h.tc).join(", "))}"></label>
    <label class="fld"><span>Kế hoạch đào tạo — mỗi dòng một học phần: <code>Học kỳ | Mã HP | Tên học phần | Số TC | Loại (BB bắt buộc / TC tự chọn / DK điều kiện) | Nhóm tự chọn | Mã HP tiên quyết | Ghi chú</code></span><textarea data-f="keHoach" rows="10">${esc((c.keHoach || []).map(h => [h.hk, h.ma, h.ten, h.tc, h.loai, h.nhom || "", (h.tq || []).join(" "), h.ghiChu || ""].join(" | ").replace(/( \| )+$/, "")).join("\n"))}</textarea></label>
    ${a ? `<div class="dlg-act" style="justify-content:flex-start"><button type="button" class="btn primary" data-ctsave>Lưu</button>${c.id ? `<button type="button" class="btn danger" data-ctdel>Xóa</button>` : ""}</div>` : ""}</details>`;
  page("Chương trình đào tạo", `<p class="tt-note">Mỗi lớp gắn một chương trình đào tạo (ở trang lớp). Hồ sơ sinh viên hiện kế hoạch học tập theo học kỳ để cố vấn tư vấn đăng ký học phần, học lại, học cải thiện, học vượt.</p>
    <div id="ctList">${list.map(card).join("")}${a ? card({}, list.length) : ""}</div><p class="err" id="ctErr"></p>`, [["sv", "Hồ sơ sinh viên"], [null, "Chương trình đào tạo"]]);
  if (!a) return;
  document.querySelectorAll("[data-ctsave]").forEach(b => b.onclick = async () => {
    const det = b.closest("details"), f = k => det.querySelector(`[data-f="${k}"]`).value.trim();
    const id = f("id").toUpperCase().replace(/\s+/g, "-");
    if (!/^[A-Z0-9._-]{2,40}$/.test(id)) return $("#ctErr").textContent = "Mã CTĐT gồm chữ không dấu, số, dấu gạch.";
    const slug = t => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    const old = list.find(x => x.id === id) || {};
    const keHoach = f("keHoach").split(/\n+/).map(x => x.split("|").map(c => c.trim())).filter(r => r.length >= 3 && r[2]).map(r => {
      const loai = /^t/i.test(r[4] || "") ? "TC" : /^(d|đ)/i.test(r[4] || "") ? "DK" : "BB";
      const same = (old.keHoach || []).find(o => String(o.hk) === String(+r[0] || r[0]) && o.ten === r[2] && !o.ma);   // giữ khóa cũ để không mất tiến độ đã đánh dấu
      return { hk: +r[0] || r[0], ma: r[1], ten: r[2], tc: +r[3] || 0, loai, nhom: r[5] || "", tq: (r[6] || "").split(/[,;\s]+/).filter(Boolean), ghiChu: r[7] || "", k: r[1] || (same && same.k) || `hk${r[0]}-${slug(r[2])}` };
    });
    const hocKy = f("hocKy").split(/[,;\s]+/).filter(Boolean).map((t, i) => ({ hk: i + 1, tc: +t || 0, ghiChu: ((old.hocKy || [])[i] || {}).ghiChu || "" }));
    const { id: _x, ...keep } = old;
    try { await setDoc(doc(db, "pna_ctdt", id), { ...keep, ten: f("ten"), nganh: f("nganh"), khoa: f("khoa").split(/[,;\s]+/).filter(Boolean), tongTC: f("tongTC"), link: f("link"), hocKy, keHoach, updated: nowISO(), by: myEmail() }); P.toast("Đã lưu " + id + ".", "ok"); renderCtdt(); }
    catch (e) { $("#ctErr").textContent = "Chưa lưu được: " + e.message; }
  });
  document.querySelectorAll("[data-ctdel]").forEach(b => b.onclick = async () => {
    const id = b.closest("details").querySelector('[data-f="id"]').value; if (!await P.ask("Xóa chương trình đào tạo " + id + "?")) return;
    try { await deleteDoc(doc(db, "pna_ctdt", id)); renderCtdt(); } catch (e) { P.toast(e.message, "err"); }
  });
}

/* ---------- Ô bên cột ---------- */
async function renderBox() {
  const col = $("#toolsCol"); if (!col) return;
  let box = $("#hsBox");
  if (!box) { box = document.createElement("section"); box.className = "sbox"; box.id = "hsBox"; const tt = $("#ttBox"); tt && tt.parentNode ? tt.after(box) : col.appendChild(box); }
  await loadMe();
  if (!isStaff() && !ME.sv) { box.hidden = true; return; }
  box.hidden = false;
  const lops = isStaff() ? (ME.lops || []) : [];
  box.innerHTML = `<h3 class="sbox-title">HỒ SƠ SINH VIÊN</h3>
    ${ME.sv && !isStaff() ? `<p class="muted" style="margin:-4px 0 10px">Hành trình học tập, rèn luyện, đơn đã gửi.</p><button type="button" class="sbtn primary" data-go="sv/${esc(ME.sv.mssv)}">Hồ sơ của tôi</button>` : `
    <p class="muted" style="margin:-4px 0 10px">Quản lý sinh viên theo vòng đời: lớp, CTĐT, rèn luyện, sự kiện, thủ tục.</p>
    ${lops.length ? `<div class="tt-links">${lops.sort((a, b) => a.id.localeCompare(b.id)).map(l => `<a href="#sv/lop/${esc(l.id)}"><span class="tt-dot"></span>Lớp ${esc(l.id)}${l.ten ? " — " + esc(l.ten) : ""}</a>`).join("")}</div>` : ""}
    <button type="button" class="sbtn${lops.length ? "" : " primary"}" data-go="sv" style="margin-top:8px">${seeAll() ? "Tất cả lớp – tìm sinh viên" : "Danh sách lớp"}</button>
    ${isAdmin() ? `<button type="button" class="sbtn" data-go="sv-nhap">Nhập dữ liệu sinh viên</button><button type="button" class="sbtn" data-go="sv-ctdt">Chương trình đào tạo</button>` : ""}`}`;
}

/* ---------- Định tuyến ---------- */
async function route(h) {
  if (!P.authReady) { $("#main").innerHTML = `<p class="empty">Đang tải…</p>`; return; }
  if (h === "sv") return renderHome();
  if (h === "sv-nhap") return renderNhap();
  if (h === "sv-ctdt") return renderCtdt();
  if (h.startsWith("sv/lop/")) return renderLop(decodeURIComponent(h.slice(7)));
  if (h.startsWith("sv/")) { const [m, t] = h.slice(3).split("/"); return renderSv(decodeURIComponent(m), t); }
  renderHome();
}
document.addEventListener("pna:auth", async () => {
  await loadMe(true); reset(); renderBox();
  const h = decodeURIComponent(location.hash.slice(1)); if (h === "sv" || h.startsWith("sv/") || h.startsWith("sv-")) route(h);
});
window.PNA_SV = { route, reload: () => { reset(); return loadMe(true); } };
