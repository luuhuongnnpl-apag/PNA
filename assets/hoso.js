/* =====================================================================
   HỒ SƠ SINH VIÊN THEO VÒNG ĐỜI — Hệ thống cố vấn học tập (PNA)
   Mỗi sinh viên một hồ sơ từ khi nhập học đến khi tốt nghiệp hoặc chấm dứt học tập:
   thông tin chung, lớp – khóa – ngành – chương trình đào tạo, trạng thái học tập,
   sự kiện (nghỉ học tạm thời, trở lại, thôi học, cán sự, khen thưởng, kỷ luật…),
   kết quả rèn luyện từng học kỳ, hoạt động, đơn thủ tục (dịch vụ công), ghi chú nội bộ của CVHT.
   Firestore: pna_hoso/{mssv} (+ /noibo/{id}: ghi chú chỉ cán bộ xem) · pna_lop/{mã lớp} · pna_ctdt/{mã}
   Dữ liệu cá nhân KHÔNG đưa lên kho mã GitHub: quản trị nhập tệp JSON ở trang “Nhập dữ liệu sinh viên”.
   ===================================================================== */
import { doc, getDoc, setDoc, addDoc, deleteDoc, collection, getDocs, query, where, writeBatch } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { THU_TUC } from "./thutuc-data.js?v=20261128v";

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
  let ctdts = [];
  if (isAdmin()) { try { (await getDocs(collection(db, "pna_ctdt"))).forEach(d => ctdts.push({ id: d.id, ...d.data() })); } catch (e) {} }
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
    <td>${chip(s.trangThai)}</td><td class="c">${d ? (d.diem ?? "—") : ""}</td><td>${d ? xlChip(d.xepLoai) : ""}</td><td class="c">${s.email ? "✓" : ""}</td></tr>`; }).join("");
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
    <div class="tbl-wrap"><table class="adm-table ftbl hs-tbl"><thead><tr><th class="c">STT</th><th>Mã SV</th><th>Họ và tên</th><th>Ngày sinh</th><th>Điện thoại</th><th>Trạng thái</th><th class="c">ĐRL</th><th>Xếp loại${kLast ? `<br><small>${esc(kyName(kLast))}</small>` : ""}</th><th class="c">Tài khoản</th></tr></thead><tbody>${rows || `<tr><td colspan="9" class="muted">Chưa có sinh viên.</td></tr>`}</tbody></table></div>`,
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
const xepLoai = d => d == null ? "KĐG" : d >= 90 ? "Xuất sắc" : d >= 80 ? "Tốt" : d >= 65 ? "Khá" : d >= 50 ? "Trung bình" : d >= 35 ? "Yếu" : "Kém";
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

/* ---------- Hồ sơ một sinh viên ---------- */
async function renderSv(mssv) {
  await loadMe();
  const own = ME.sv && ME.sv.mssv === mssv;
  if (!isStaff() && !own) return deny("Hồ sơ sinh viên");
  let s, lop = null, ct = null, notes = [], dons = [];
  try { const d = await getDoc(doc(db, "pna_hoso", mssv)); if (!d.exists()) return page("Hồ sơ " + esc(mssv), `<p class="empty">${own ? "Hồ sơ của bạn chưa được nhập vào hệ thống. Liên hệ cố vấn học tập." : "Không tìm thấy hồ sơ hoặc bạn không quản lý sinh viên này."}</p>`, isStaff() ? [["sv", "Hồ sơ sinh viên"], [null, mssv]] : null); s = { id: d.id, ...d.data() }; }
  catch (e) { return page("Hồ sơ " + esc(mssv), `<p class="empty">Bạn không có quyền xem hồ sơ này.</p>`); }
  const edit = canEdit(s);
  await Promise.all([
    getDoc(doc(db, "pna_lop", s.lop)).then(x => { if (x.exists()) lop = x.data(); }).catch(() => {}),
    edit ? getDocs(collection(db, "pna_hoso", mssv, "noibo")).then(q => q.forEach(x => notes.push({ id: x.id, ...x.data() }))).catch(() => {}) : null,
    loadDons(s, own).then(x => dons = x).catch(() => {})
  ]);
  const ctId = s.ctdt || (lop && lop.ctdt);
  if (ctId) { try { const x = await getDoc(doc(db, "pna_ctdt", ctId)); if (x.exists()) ct = { id: x.id, ...x.data() }; } catch (e) {} }
  const ks = kyList(s.khoa), cur = kyNow(), sk = (s.suKien || []).slice().sort((a, b) => String(a.ngay || a.namHoc || "").localeCompare(String(b.ngay || b.namHoc || "")));
  const kyOf = e => { if (e.ngay) { const [y, m] = e.ngay.split("-").map(Number); return m >= 8 ? `${y}-${y + 1}_1` : `${y - 1}-${y}_2`; } return e.namHoc ? e.namHoc + "_1" : ""; };
  /* Hành trình: từng năm học, 2 học kỳ, kết quả rèn luyện và sự kiện */
  const years = [];
  for (let i = 0; i < ks.length; i += 2) years.push([ks[i], ks[i + 1]]);
  const cell = k => { const d = (s.drl || {})[k], ev = sk.filter(e => kyOf(e) === k); const past = k <= cur;
    return `<div class="hs-ky${k === cur ? " now" : ""}${past ? "" : " fut"}"><div class="hs-kyh">${esc(kyName(k).split(" · ")[0])}${k === cur ? " <em>hiện tại</em>" : ""}</div>
      ${d ? `<div class="hs-kyd">Rèn luyện: <b>${d.diem ?? "—"}</b> ${xlChip(d.xepLoai)}${d.ghiChu ? `<small>${esc(d.ghiChu)}</small>` : ""}</div>` : past ? `<div class="hs-kyd muted">Chưa có kết quả rèn luyện</div>` : ""}
      ${ev.map(e => `<div class="hs-kye">• ${esc((SK[e.loai] || SK.khac)[0])}${e.soQD ? " — QĐ " + esc(e.soQD) : ""}</div>`).join("")}</div>`; };
  const journey = years.map(([a, b], i) => `<div class="hs-year"><div class="hs-yh">Năm thứ ${i + 1}<small>${esc(a.split("_")[0].replace("-", "–"))}</small></div>${cell(a)}${cell(b)}</div>`).join("");
  const info = [["Mã sinh viên", s.mssv], ["Ngày sinh", fmtD(s.ngaySinh)], ["Lớp", s.lop + (lop && lop.ten ? " — " + lop.ten : "")], ["Ngành", s.nganh], ["Khóa", s.khoa ? s.khoa + (namThu(s.khoa) ? ` (năm thứ ${namThu(s.khoa)})` : "") : ""], ["Hệ đào tạo", s.he],
    ["Chức vụ", s.chucVu ? s.chucVu + (s.chucVuNam ? " (" + s.chucVuNam.replace("-", "–") + ")" : "") : ""], ["Điện thoại", s.sdt], ["Email liên hệ", s.emailLienHe], ["Quê quán", s.queQuan], ["Tài khoản PNA", s.email ? P.showName(s.email) : "Chưa cấp"], ["Cố vấn học tập", (s.cvht || []).map(P.showName).join(", ") || "Chưa gán"]];
  const ttLinks = THU_TUC.filter(t => t.active !== false);
  const donRows = dons.map(d => `<tr class="tt-row" data-go="tt-don/${esc(d.id)}"><td><b>${esc(d.ma || "")}</b></td><td>${esc(d.ttTen || "")}</td><td>${esc(fmtD(String(d.created || "").slice(0, 10)))}</td><td>${esc(({ "cho-duyet": "Đang xử lý", "bo-sung": "Cần bổ sung", "da-duyet": "Đã duyệt", "tu-choi": "Không duyệt", "rut": "Đã rút" })[d.status] || d.status || "")}</td></tr>`).join("");
  const plan = ct && Array.isArray(ct.keHoach) && ct.keHoach.length ? (() => { const g = {}; ct.keHoach.forEach(h => (g[h.hk] = g[h.hk] || []).push(h)); return `<div class="hs-plan">${Object.keys(g).sort((a, b) => +a - +b).map(k => `<details${+k === Math.min(SO_NAM * 2, (namThu(s.khoa) - 1) * 2 + (cur.endsWith("_1") ? 1 : 2)) ? " open" : ""}><summary>Học kỳ ${esc(k)} · ${g[k].reduce((n, h) => n + (+h.tc || 0), 0)} tín chỉ</summary><table class="adm-table"><tbody>${g[k].map(h => `<tr><td>${esc(h.ma || "")}</td><td>${esc(h.ten)}</td><td class="c">${esc(h.tc || "")}</td><td>${esc(h.loai || "")}</td></tr>`).join("")}</tbody></table></details>`).join("")}</div>`; })() : "";
  page(esc(s.hoTen), `
    <div class="hs-head"><div class="hs-av">${esc((s.ten || s.hoTen || "?").slice(0, 1))}</div><div><div class="hs-name">${esc(s.hoTen)} ${chip(s.trangThai)}</div><div class="muted">${esc(s.mssv)} · Lớp ${esc(s.lop)} · ${esc(s.nganh || "")} · Khóa ${esc(s.khoa || "")}</div></div>
      ${edit ? `<div class="hs-act"><button type="button" class="btn" id="svEdit">✎ Sửa thông tin</button><button type="button" class="btn primary" id="svEv">＋ Ghi nhận sự kiện</button></div>` : ""}</div>
    <div class="hs-info">${info.map(([a, b]) => `<div><span>${a}</span><b>${esc(b || "—")}</b></div>`).join("")}</div>
    <h3 class="hs-sub">Hành trình học tập</h3><div class="hs-journey">${journey || `<p class="muted">Chưa xác định khóa học.</p>`}</div>
    <div class="hs-two">
      <div class="sbox"><h3 class="sbox-title">QUÁ TRÌNH — SỰ KIỆN</h3>${sk.length ? `<ol class="tt-hist hs-ev">${sk.slice().reverse().map((e, i) => `<li><b>${esc((SK[e.loai] || SK.khac)[0])}</b> <span class="muted">${esc(e.ngay ? fmtD(e.ngay) : (e.namHoc || "").replace("-", "–"))}</span><br>${esc(e.noiDung || "")}${e.nguon ? `<br><small class="muted">Nguồn: ${esc(e.nguon)}</small>` : ""}${edit ? ` <button type="button" class="linkish" data-evdel="${sk.length - 1 - i}">Xóa</button>` : ""}</li>`).join("")}</ol>` : `<p class="muted">Chưa có sự kiện.</p>`}</div>
      <div class="sbox"><h3 class="sbox-title">KẾT QUẢ RÈN LUYỆN</h3>${Object.keys(s.drl || {}).length ? `<table class="adm-table"><thead><tr><th>Học kỳ</th><th class="c">Điểm</th><th>Xếp loại</th></tr></thead><tbody>${Object.keys(s.drl).sort().reverse().map(k => `<tr><td>${esc(kyName(k))}${s.drl[k].ghiChu ? `<br><small class="muted">${esc(s.drl[k].ghiChu)}</small>` : ""}</td><td class="c">${s.drl[k].diem ?? "—"}</td><td>${xlChip(s.drl[k].xepLoai)}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">Chưa có kết quả.</p>`}
        ${edit ? `<button type="button" class="sbtn" id="svDrl">Nhập / sửa kết quả rèn luyện</button>` : ""}</div>
    </div>
    <div class="hs-two">
      <div class="sbox"><h3 class="sbox-title">CHƯƠNG TRÌNH ĐÀO TẠO</h3>${ct ? `<p style="margin:0 0 8px"><b>${esc(ct.ten || ct.id)}</b>${ct.tongTC ? ` · ${esc(ct.tongTC)} tín chỉ` : ""}${ct.link ? ` · <a href="${esc(ct.link)}" target="_blank" rel="noopener">Văn bản CTĐT ↗</a>` : ""}</p>${plan}` : `<p class="muted">Chưa gán chương trình đào tạo cho lớp ${esc(s.lop)}.${isAdmin() ? ` Gán ở <a href="#sv/lop/${esc(s.lop)}">trang lớp</a>.` : ""}</p>`}</div>
      <div class="sbox"><h3 class="sbox-title">THỦ TỤC — DỊCH VỤ CÔNG</h3>${donRows ? `<div class="tbl-wrap"><table class="adm-table"><tbody>${donRows}</tbody></table></div>` : `<p class="muted">Chưa có đơn nào.</p>`}
        ${own ? `<div class="tt-links" style="margin-top:8px">${ttLinks.map(t => `<a href="#tt/${esc(t.key)}"><span class="tt-dot"></span>${esc(t.ten)}</a>`).join("")}</div>` : ""}</div>
    </div>
    ${edit ? `<div class="sbox hs-noibo"><h3 class="sbox-title">GHI CHÚ CỦA CỐ VẤN HỌC TẬP <small class="muted">(chỉ cán bộ xem)</small></h3>
      ${notes.sort((a, b) => String(b.at).localeCompare(String(a.at))).map(n => `<div class="hs-note"><small class="muted">${esc(fmtD(String(n.at).slice(0, 10)))} · ${esc(P.showName(n.by || ""))}</small><p>${esc(n.noiDung)}</p><button type="button" class="linkish" data-notedel="${esc(n.id)}">Xóa</button></div>`).join("") || `<p class="muted">Chưa có ghi chú.</p>`}
      <textarea id="noteIn" rows="2" class="fld-sel" placeholder="Ghi chú tình hình học tập, gia đình, tư vấn đã thực hiện…"></textarea><button type="button" class="btn" id="noteAdd" style="margin-top:6px">Lưu ghi chú</button></div>` : ""}`,
    isStaff() ? [["sv", "Hồ sơ sinh viên"], ["sv/lop/" + s.lop, s.lop], [null, s.hoTen]] : null);
  if (!edit) return;
  const save = async (patch, msg) => { await setDoc(doc(db, "pna_hoso", s.mssv), { ...patch, updated: nowISO(), by: myEmail() }, { merge: true }); P.logAct("HOSO", s.mssv + " · " + msg); reset(); P.toast("Đã lưu.", "ok"); renderSv(s.mssv); };
  $("#svEv").onclick = () => evDialog(s, save);
  $("#svEdit").onclick = () => editDialog(s, save);
  $("#svDrl").onclick = () => drlDialog(s, save);
  document.querySelectorAll("[data-evdel]").forEach(b => b.onclick = async () => {
    const i = +b.dataset.evdel; if (!await P.ask("Xóa sự kiện “" + ((SK[sk[i].loai] || SK.khac)[0]) + "” khỏi hồ sơ?")) return;
    const list = sk.filter((_, j) => j !== i); try { await save({ suKien: list }, "xóa sự kiện"); } catch (e) { P.toast(e.message, "err"); }
  });
  $("#noteAdd").onclick = async () => { const t = $("#noteIn").value.trim(); if (!t) return; try { await addDoc(collection(db, "pna_hoso", s.mssv, "noibo"), { noiDung: t, at: nowISO(), by: myEmail() }); renderSv(s.mssv); } catch (e) { P.toast("Chưa lưu được: " + e.message, "err"); } };
  document.querySelectorAll("[data-notedel]").forEach(b => b.onclick = async () => { if (!await P.ask("Xóa ghi chú này?")) return; try { await deleteDoc(doc(db, "pna_hoso", s.mssv, "noibo", b.dataset.notedel)); renderSv(s.mssv); } catch (e) { P.toast(e.message, "err"); } });
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
    <label class="fld"><span>Kế hoạch đào tạo — mỗi dòng một học phần: <code>Học kỳ | Mã HP | Tên học phần | Số TC | Bắt buộc/Tự chọn</code></span><textarea data-f="keHoach" rows="8">${esc((c.keHoach || []).map(h => [h.hk, h.ma, h.ten, h.tc, h.loai].join(" | ")).join("\n"))}</textarea></label>
    ${a ? `<div class="dlg-act" style="justify-content:flex-start"><button type="button" class="btn primary" data-ctsave>Lưu</button>${c.id ? `<button type="button" class="btn danger" data-ctdel>Xóa</button>` : ""}</div>` : ""}</details>`;
  page("Chương trình đào tạo", `<p class="tt-note">Mỗi lớp gắn một chương trình đào tạo (ở trang lớp). Hồ sơ sinh viên hiện kế hoạch học tập theo học kỳ để cố vấn tư vấn đăng ký học phần, học lại, học cải thiện, học vượt.</p>
    <div id="ctList">${list.map(card).join("")}${a ? card({}, list.length) : ""}</div><p class="err" id="ctErr"></p>`, [["sv", "Hồ sơ sinh viên"], [null, "Chương trình đào tạo"]]);
  if (!a) return;
  document.querySelectorAll("[data-ctsave]").forEach(b => b.onclick = async () => {
    const det = b.closest("details"), f = k => det.querySelector(`[data-f="${k}"]`).value.trim();
    const id = f("id").toUpperCase().replace(/\s+/g, "-");
    if (!/^[A-Z0-9._-]{2,40}$/.test(id)) return $("#ctErr").textContent = "Mã CTĐT gồm chữ không dấu, số, dấu gạch.";
    const keHoach = f("keHoach").split(/\n+/).map(x => x.split("|").map(c => c.trim())).filter(r => r.length >= 3 && r[2]).map(r => ({ hk: r[0], ma: r[1], ten: r[2], tc: r[3] || "", loai: r[4] || "" }));
    try { await setDoc(doc(db, "pna_ctdt", id), { ten: f("ten"), nganh: f("nganh"), khoa: f("khoa").split(/[,;\s]+/).filter(Boolean), tongTC: f("tongTC"), link: f("link"), keHoach, updated: nowISO(), by: myEmail() }); P.toast("Đã lưu " + id + ".", "ok"); renderCtdt(); }
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
  if (h.startsWith("sv/")) return renderSv(decodeURIComponent(h.slice(3)));
  renderHome();
}
document.addEventListener("pna:auth", async () => {
  await loadMe(true); reset(); renderBox();
  const h = decodeURIComponent(location.hash.slice(1)); if (h === "sv" || h.startsWith("sv/") || h.startsWith("sv-")) route(h);
});
window.PNA_SV = { route, reload: () => { reset(); return loadMe(true); } };
