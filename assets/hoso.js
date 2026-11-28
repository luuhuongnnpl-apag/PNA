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
import { THU_TUC, KHOA_QL } from "./thutuc-data.js?v=20261128y";
const KHOA_TEN = KHOA_QL.replace(/^Khoa\s+/i, "").toUpperCase();

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
/* Ban quản trị lớp: quyền p (hs, pt, bbh, don) trong phạm vi lớp của tài khoản (lớp sinh viên + lops quản trị gán) */
const myLopsH = () => [...(ME && ME.sv ? [ME.sv.lop] : []), ...((P.acct && P.acct.lops) || [])];
const bq = (lop, p) => isAdmin() || (!!P.acct && !!(P.can && P.can(p)) && myLopsH().includes(lop));
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
  let lops, all;
  if (!isStaff()) {
    if (!bq(id, "hs")) return deny("Lớp " + id);
    try { const x = await getDoc(doc(db, "pna_lop", id)); lops = x.exists() ? [{ id: x.id, ...x.data() }] : []; all = {}; (await getDocs(query(collection(db, "pna_hoso"), where("lop", "==", id)))).forEach(d => all[d.id] = { id: d.id, ...d.data() }); } catch (e) { return fail(e); }
  } else try { [lops, all] = await Promise.all([loadLops(), loadHoso()]); } catch (e) { return fail(e); }
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
  /* Hoạt động phong trào của lớp (đã xác nhận / chờ) */
  const hd = {};
  try {
    const qs = isAdmin() || !isStaff() ? [query(collectionGroup(db, "hoatdong"), where("lop", "==", id))] : [query(collectionGroup(db, "hoatdong"), where("cvht", "array-contains", ME.email))];
    for (const q of qs) (await getDocs(q)).forEach(d => { const a = d.data(); if (a.lop !== id) return; const o = hd[a.mssv] = hd[a.mssv] || { ok: 0, cho: 0 }; if (a.tt === "ok") o.ok++; else if (a.tt === "cho") o.cho++; });
  } catch (e) { console.warn("hoạt động lớp", e.message); }
  /* Thống kê học tập, rèn luyện theo học kỳ */
  const TH = {}; if (lopCt) svs.forEach(s => TH[s.mssv] = hocTapTH(lopCt, s.hocTap));
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const kyRows = kyList(l.khoa).filter(k => k <= kyNow()).map(k => {
    const hk = hkOfKy(l.khoa, k), g = svs.map(s => TH[s.mssv] && TH[s.mssv].hk[hk] && TH[s.mssv].hk[hk].g4).filter(x => x != null);
    const dr = svs.map(s => (s.drl || {})[k]).filter(x => x && x.diem != null), c = {}; dr.forEach(x => { const t = x.xepLoai || ""; c[t] = (c[t] || 0) + 1; });
    const hl = {}; g.forEach(x => { const t = hocLuc(x); hl[t] = (hl[t] || 0) + 1; });
    return { k, hk, g: avg(g), ng: g.length, d: avg(dr.map(x => +x.diem)), nd: dr.length, c, hl };
  });
  const rows = svs.map((s, i) => { const d = kLast && (s.drl || {})[kLast], th = TH[s.mssv], h = hd[s.mssv] || { ok: 0, cho: 0 }; return `<tr class="tt-row" data-go="sv/${esc(s.mssv)}" data-st="${esc(s.trangThai || "dang-hoc")}" data-q="${esc((s.mssv + " " + s.hoTen + " " + (s.sdt || "")).toLowerCase())}">
    <td class="c">${i + 1}</td><td><b>${esc(s.mssv)}</b></td><td>${esc(s.hoTen)}${s.chucVu ? `<br><small class="hs-cs">${esc(s.chucVu)}</small>` : ""}</td><td>${esc(fmtD(s.ngaySinh))}</td><td>${esc(s.sdt || "")}</td>
    <td>${chip(s.trangThai)}</td><td class="c">${d ? (d.diem ?? "—") : ""}</td><td>${d ? xlChip(d.xepLoai) : ""}</td><td class="c">${s.email ? "✓" : ""}</td>${lopCt ? `<td class="c"><b>${th && th.g4 != null ? th.g4.toFixed(2) : "—"}</b>${th && th.g4 != null ? `<br><small>${esc(hocLuc(th.g4))}</small>` : ""}</td>` : ""}<td class="c">${h.ok ? `<b>${h.ok}</b>` : "—"}${h.cho ? `<br><small class="muted">${h.cho} chờ xác nhận</small>` : ""}</td>${lopCt ? (() => { const t = tienDo(lopCt, s.hocTap); return `<td class="c">${t.qua}/${t.tong}${t.chua ? `<br><small style="color:#b3261e">${t.chua} HP chưa qua</small>` : ""}</td>`; })() : ""}</tr>`; }).join("");
  const hasAcc = svs.filter(s => s.email).length;
  page(`Lớp ${esc(l.id)}${l.ten ? " — " + esc(l.ten) : ""}`, `
    <div class="hs-info">${[["Ngành", l.nganh], ["Khóa trúng tuyển", l.khoa ? l.khoa + (namThu(l.khoa) ? " (năm thứ " + namThu(l.khoa) + ")" : "") : ""], ["Hệ đào tạo", l.he], ["Cố vấn học tập", (l.cvht || []).map(P.showName).join(", ") || "Chưa gán"], ["Chương trình đào tạo", l.ctdt || "Chưa gán"], ["Sĩ số", svs.length + " sinh viên · " + hasAcc + " đã có tài khoản"]].map(([a, b]) => `<div><span>${a}</span><b>${esc(b || "—")}</b></div>`).join("")}</div>
    ${l.ghiChu ? `<p class="tt-note">${esc(l.ghiChu)}</p>` : ""}
    <div class="hs-two hs-two-w">
      <div class="sbox"><h3 class="sbox-title">BAN CÁN SỰ LỚP</h3>${bcs ? `<ul class="hs-bcs">${bcs}</ul>` : `<p class="muted">Chưa có.</p>`}</div>
      <div class="sbox"><h3 class="sbox-title">HỌC TẬP – RÈN LUYỆN THEO HỌC KỲ</h3>${kyRows.length ? `<div class="tbl-wrap"><table class="adm-table hs-kyst"><thead><tr><th>Học kỳ</th><th class="c">TB học kỳ lớp<br><small>(thang 4)</small></th><th>Học lực</th><th class="c">ĐRL TB lớp</th><th>Xếp loại rèn luyện</th></tr></thead><tbody>
        ${kyRows.map(r => `<tr><td><b>HK ${ROMAN[r.hk]}</b> <small class="muted">${esc(kyName(r.k))}</small></td><td class="c"><b>${r.g != null ? r.g.toFixed(2) : "—"}</b>${r.ng ? `<br><small class="muted">${r.ng} SV có điểm</small>` : ""}</td>
          <td><small>${["Xuất sắc", "Giỏi", "Khá", "Trung bình", "Yếu", "Kém"].filter(x => r.hl[x]).map(x => `${x} ${r.hl[x]}`).join(" · ") || "—"}</small></td>
          <td class="c"><b>${r.d != null ? r.d.toFixed(1) : "—"}</b>${r.nd ? `<br><small class="muted">${r.nd} SV</small>` : ""}</td>
          <td><small>${XL.filter(x => r.c[x]).map(x => `<b style="color:${XL_C[x]}">${x} ${r.c[x]}</b>`).join(" · ") || "—"}</small></td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">Chưa có học kỳ.</p>`}</div>
    </div>
    <div class="page-tools">${edit ? `<button type="button" id="lopAcc">Cấp tài khoản cho sinh viên chưa có (${svs.length - hasAcc})</button>` : ""}<button type="button" id="lopCsv">⤓ Xuất danh sách (Excel)</button></div>
    <p><a class="pill" href="#sv-bbh/${esc(id)}">📋 Biên bản họp lớp đánh giá rèn luyện (Phụ lục 02)</a></p>${adminBox}${drlBox}
    <div class="hs-filter"><input type="search" id="lopQ" placeholder="Lọc theo mã, tên, số điện thoại…"><select id="lopSt"><option value="">Mọi trạng thái</option>${Object.keys(TT).map(k => `<option value="${k}">${TT[k][0]}</option>`).join("")}</select></div>
    <div class="tbl-wrap"><table class="adm-table ftbl hs-tbl"><thead><tr><th class="c">STT</th><th>Mã SV</th><th>Họ và tên</th><th>Ngày sinh</th><th>Điện thoại</th><th>Trạng thái</th><th class="c">ĐRL</th><th>Xếp loại${kLast ? `<br><small>${esc(kyName(kLast))}</small>` : ""}</th><th class="c">Tài khoản</th>${lopCt ? `<th class="c">TBC tích lũy<br><small>(thang 4)</small></th>` : ""}<th class="c">Hoạt động<br><small>đã xác nhận</small></th>${lopCt ? `<th class="c">TC đã qua</th>` : ""}</tr></thead><tbody>${rows || `<tr><td colspan="12" class="muted">Chưa có sinh viên.</td></tr>`}</tbody></table></div>`,
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
  if (!isStaff() && !own && !(P.can && P.can("hs") && myLopsH().length)) return deny("Hồ sơ sinh viên");
  let s, lop = null, ct = null, notes = [], dons = [], acts = [], mc = [];
  try { const d = await getDoc(doc(db, "pna_hoso", mssv)); if (!d.exists()) return page("Hồ sơ " + esc(mssv), `<p class="empty">${own ? "Hồ sơ của bạn chưa được nhập vào hệ thống. Liên hệ cố vấn học tập." : "Không tìm thấy hồ sơ hoặc bạn không quản lý sinh viên này."}</p>`, isStaff() ? [["sv", "Hồ sơ sinh viên"], [null, mssv]] : null); s = { id: d.id, ...d.data() }; }
  catch (e) { return page("Hồ sơ " + esc(mssv), `<p class="empty">Bạn không có quyền xem hồ sơ này.</p>`); }
  if (!isStaff() && !own && !bq(s.lop, "hs")) return deny("Hồ sơ sinh viên");
  const edit = canEdit(s), self = own || edit;
  await Promise.all([
    getDoc(doc(db, "pna_lop", s.lop)).then(x => { if (x.exists()) lop = x.data(); }).catch(() => {}),
    edit ? getDocs(collection(db, "pna_hoso", mssv, "noibo")).then(q => q.forEach(x => notes.push({ id: x.id, ...x.data() }))).catch(() => {}) : null,
    loadDons(s, own).then(x => dons = x).catch(() => {}),
    getDocs(collection(db, "pna_hoso", mssv, "hoatdong")).then(q => q.forEach(x => acts.push({ id: x.id, ...x.data() }))).catch(() => {}),
    getDocs(collection(db, "pna_hoso", mssv, "minhchung")).then(q => q.forEach(x => mc.push({ id: x.id, ...x.data() }))).catch(() => {})
  ]);
  const ctId = s.ctdt || (lop && lop.ctdt);
  if (ctId) { try { const x = await getDoc(doc(db, "pna_ctdt", ctId)); if (x.exists()) ct = { id: x.id, ...x.data() }; } catch (e) {} }
  tab = TABS.some(t => t[0] === tab) ? tab : "hoc-tap";
  const V = { s, lop, ct, notes, dons, acts, mc, own, edit, self, tab, hk: null, view: "tong" };
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
   Khung theo khóa (Công văn 2020-CV/HVHCQTC ngày 15/9/2026):
   - Khóa trúng tuyển 2023–2025: Phiếu đánh giá kết quả rèn luyện của sinh viên — Phụ lục 01 kèm Quyết định 4185/QĐ-HCQG
     ngày 08/9/2023 (5 mục 20 · 25 · 20 · 25 · 10; chọn mức điểm từng tiêu chí; mục II trừ điểm theo số lần vi phạm).
   - Khóa trúng tuyển từ 2026: Điều 17 Thông tư 40/2026/TT-BGDĐT (25 · 20 · 20 · 15 · 20; 13 tiêu chí, tự chấm trong mức nhóm).
   Quy trình: SV tự chấm, ghi và tải minh chứng → gửi phiếu → ban cán sự lớp, BCH chi đoàn tổng hợp biên bản họp lớp
   (Phụ lục 02) → CVHT ký, chốt → Hội đồng cấp Khoa, Học viện. Mục tiêu chí loại: so (gõ điểm) · chon (một mức) · cong (cộng các ô) · tru (trừ theo số lần). */
const O = (t, d) => [t, d];
let DRL_TC = {
  n1: [["1a", "Chấp hành chủ trương của Đảng, chính sách, pháp luật của Nhà nước và chỉ đạo của Bộ, ngành, cơ quan quản lý được áp dụng trong nhà trường"], ["1b", "Chấp hành nội quy, quy chế và các quy định khác của Học viện"]],
  n2: [["2a", "Ý thức, thái độ, trách nhiệm trong học tập và nghiên cứu khoa học"], ["2b", "Ý thức, trách nhiệm khi tham gia các kỳ thi, cuộc thi"], ["2c", "Tinh thần vượt khó, phấn đấu vươn lên trong học tập"]],
  n3: [["3a", "Tham gia các hoạt động rèn luyện về chính trị, xã hội, văn hóa, văn nghệ, thể thao (sinh viên khuyết tật được đánh giá phù hợp tình trạng sức khỏe)"], ["3b", "Tham gia hoạt động công ích, tình nguyện, công tác xã hội"], ["3c", "Tham gia tuyên truyền, phòng chống tội phạm và các tệ nạn xã hội"]],
  n4: [["4a", "Tuyên truyền chủ trương của Đảng, chính sách, pháp luật của Nhà nước trong cộng đồng"], ["4b", "Tham gia các hoạt động xã hội được ghi nhận, biểu dương, khen thưởng"]],
  n5: [["5a", "Đảm nhiệm công tác lớp, Đảng, Đoàn, Hội và tổ chức khác của Học viện (trách nhiệm, uy tín, kỹ năng tổ chức, hiệu quả)"], ["5b", "Hỗ trợ, tham gia tích cực các hoạt động chung của lớp, khoa, Học viện"], ["5c", "Thành tích trong nghiên cứu khoa học, cuộc thi, sáng kiến, khởi nghiệp hoặc hoạt động khác được khen thưởng"]]
};
let DRL_CC = "Điều 17 Thông tư số 40/2026/TT-BGDĐT ngày 15/5/2026 của Bộ trưởng Bộ Giáo dục và Đào tạo quy định về công tác sinh viên";
const KH_TT40 = { key: "tt40", N: DRL_N, CC: DRL_CC, xl: xlDrl, tieuDe: "PHIẾU TỰ ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN CỦA SINH VIÊN",
  PH: Object.fromEntries(DRL_N.map(([g, , m]) => [g, DRL_TC[g].map(([k, t]) => ({ k, t, max: m, type: "so" }))])),
  mucXL: "Xuất sắc 90–100 · Tốt 80 đến dưới 90 · Khá 70 đến dưới 80 · Trung bình 50 đến dưới 70 · Yếu dưới 50 (Điều 18 Thông tư 40/2026/TT-BGDĐT)" };
const VANG5 = [O("Tham gia và chấp hành tốt các hoạt động", 5), O("Vắng 01 buổi không có lý do", 3), O("Vắng 02 buổi không có lý do", 2), O("Vắng từ 02 buổi trở lên không có lý do hoặc không tham gia", 0)];
const KH_4185 = { key: "4185", tieuDe: "PHIẾU ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN CỦA SINH VIÊN", pl: "Phụ lục 01",
  N: [["n1", "Ý thức tham gia học tập (căn cứ vào số tín chỉ trong 01 học kỳ ≥ số tín chỉ tối thiểu theo quy định của Học viện)", 20],
    ["n2", "Chấp hành tốt nội quy, quy chế và các quy định khác được áp dụng trong Học viện", 25],
    ["n3", "Đánh giá về ý thức và kết quả tham gia các hoạt động chính trị, xã hội, văn hóa, văn nghệ, thể thao, phòng chống tệ nạn xã hội", 20],
    ["n4", "Đánh giá về ý thức công dân trong quan hệ cộng đồng", 25],
    ["n5", "Đánh giá về ý thức và kết quả tham gia Ban cán sự lớp, BCH Đoàn, Ban chủ nhiệm các Ban, CLB, Đội, Hội, Nhóm được thành lập theo quy định", 10]],
  PH: {
    n1: [{ k: "1.1", t: "Ý thức và thái độ học tập (ý thức chuyên cần)", max: 6, type: "chon", opts: [O("Điểm TB đánh giá thường xuyên học kỳ ≥ 9", 6), O("Điểm TB đánh giá thường xuyên học kỳ từ 7 đến cận 9", 5), O("Điểm TB đánh giá thường xuyên học kỳ từ 5 đến cận 7", 4), O("Điểm TB đánh giá thường xuyên học kỳ từ 4 đến cận 5", 2), O("Điểm TB đánh giá thường xuyên học kỳ từ 01 đến cận 04", 1)] },
      { k: "1.2", t: "Ý thức và thái độ tham gia các hoạt động học thuật, hoạt động NCKH, thi Olympic các cấp và các cuộc thi chuyên môn nghiệp vụ từ cấp Khoa trở lên", max: 6, type: "cong", opts: [O("Tham gia đầy đủ hoạt động, sự kiện liên quan đến NCKH, học thuật, chuyên môn", 2), O("Có công bố khoa học tại Hội nghị hoặc tạp chí khoa học chuyên ngành hoặc tham gia các cuộc thi SV NCKH, Olympic…", 2), O("Đạt giải trong các cuộc thi SV NCKH, Olympic", 2)] },
      { k: "1.3", t: "Xếp loại học tập học kỳ (căn cứ vào điểm trung bình chung học tập (TBCHT) lần 1)", max: 8, type: "chon", opts: [O("Loại Xuất sắc", 8), O("Loại Giỏi", 7), O("Loại Khá", 6), O("Loại Trung bình", 4), O("Loại Yếu nhưng chưa bị cảnh báo kết quả học tập", 2), O("Loại Yếu nhưng bị cảnh báo kết quả học tập lần 1", 1)] }],
    n2: [{ k: "2.1", t: "Phần cộng điểm", max: 25, type: "cong", opts: [O("Chấp hành tốt, không vi phạm", 25)] },
      { k: "2.2", t: "Phần trừ điểm: Sinh viên vi phạm một số lỗi trong nội quy, quy chế, quy định (ghi số lần/buổi vi phạm)", max: 0, type: "tru", opts: [
        O("Không tham gia học tập đầy đủ, nghiêm túc nghị quyết, nội quy, quy chế, tuần sinh hoạt công dân - sinh viên (các chuyên đề sinh hoạt sinh viên đầu khóa, đầu năm, cuối khóa) hoặc bài thu hoạch không đạt (điểm trung bình chung < 5) — trừ 10 điểm", -10),
        O("Nghỉ không lý do các chuyên đề “tuần sinh hoạt công dân - sinh viên” đầu khóa, đầu năm, cuối khóa — trừ 3 điểm/1 buổi", -3),
        O("Không tham gia các buổi sinh hoạt lớp, họp, hội nghị, giao ban, tập huấn và các hoạt động khác do Học viện yêu cầu — trừ 5 điểm/1 buổi", -5),
        O("Không đeo thẻ sinh viên đến Học viện, không mặc đồng phục thể thao trong giờ học GDTC, hút thuốc, xả rác bừa bãi nơi công cộng, vi phạm một trong những điều sinh viên không được làm — trừ 5 điểm/1 lần", -5),
        O("Vi phạm các quy định khu giảng đường, thư viện; không chấp hành các quy định nơi cư trú và làm các thủ tục khi thay đổi chỗ ở theo quy định — trừ 5 điểm/1 lần (vi phạm mức độ nặng xử lý theo quy chế)", -5),
        O("Chậm đóng học phí, lệ phí, bảo hiểm y tế bắt buộc, tiền nội trú, các khoản thu theo quy định của Học viện hoặc chậm nộp các loại giấy tờ, hồ sơ, văn bằng, chứng chỉ cho Học viện (chưa có quyết định đình chỉ học có thời hạn) — trừ 5 điểm/1 lần", -5),
        O("Bị khiển trách, nhắc nhở trong phòng thi — trừ 5 điểm/1 lần", -5),
        O("Vi phạm quy chế thi ở mức cảnh cáo hoặc trừ điểm thi nhưng chưa đến mức bị đình chỉ thi — trừ 10 điểm/1 lần", -10),
        O("Vi phạm quy chế thi bị lập biên bản đình chỉ thi — trừ 20 điểm/1 lần", -20)] }],
    n3: [{ k: "3.1", t: "Tham gia đầy đủ, tích cực các hoạt động chính trị, xã hội, các hoạt động tại giảng đường: nghe thời sự, học nghị quyết, tham gia các phong trào đoàn, hội…", max: 5, type: "chon", opts: VANG5 },
      { k: "3.2", t: "Ý thức tham gia các hoạt động văn hóa, văn nghệ, thể thao do Học viện/Phân viện, các tổ chức đoàn thể phát động", max: 5, type: "chon", opts: [O("Tham gia đầy đủ, có hiệu quả các hoạt động lớp hoặc các đơn vị tổ chức ghi nhận", 5), O("Tham gia có hiệu quả từ 50% các hoạt động trở lên được lớp hoặc đơn vị tổ chức ghi nhận", 3), O("Tích cực vận động mọi người tham gia hoặc hưởng ứng tích cực các phong trào", 2), O("Vắng trên 50% số buổi của các hoạt động", 1), O("Không tham gia", 0)] },
      { k: "3.3", t: "Tham gia các câu lạc bộ, Đội, Nhóm được tổ chức theo quy định (ngoài học thuật, NCKH)", max: 5, type: "chon", opts: [O("Tham gia đầy đủ, có hiệu quả các hoạt động", 5), O("Tham gia tích cực, có hiệu quả từ 01 hoạt động trở lên", 3), O("Là thành viên tích cực hưởng ứng các hoạt động", 2), O("Vắng trên 50% số buổi của các hoạt động", 1), O("Không tham gia", 0)] },
      { k: "3.4", t: "Tham gia tuyên truyền, phòng chống tội phạm và các TNXH", max: 3, type: "chon", opts: [O("Tham gia tích cực nhiều hoạt động hoặc có ý thức tố giác các TNXH", 3), O("Tham gia một hoạt động đạt hiệu quả", 2), O("Có ý thức tham gia hoặc hưởng ứng các hoạt động tuyên truyền phòng, chống TNXH", 1), O("Bị nhắc nhở 1 lần do vi phạm các TNXH (chưa đến mức xử lý kỷ luật)", 0)] },
      { k: "3.5", t: "Được khen thưởng, biểu dương trong các hoạt động tại mục III", max: 2, type: "cong", opts: [O("Được khen thưởng, biểu dương", 2)] }],
    n4: [{ k: "4.1", t: "Ý thức chấp hành và tham gia tuyên truyền các chủ trương, đường lối của Đảng, chính sách pháp luật của Nhà nước, quy định nơi cư trú, giữ gìn an ninh - trật tự, an toàn giao thông, quy định trong cộng đồng", max: 10, type: "chon", opts: [O("Chấp hành đúng và tham gia tuyên truyền tốt, được khen thưởng", 10), O("Chấp hành đúng và tham gia tuyên truyền tốt", 8), O("Chấp hành đúng các quy định", 5), O("Bị nhắc nhở, lập biên bản do vi phạm các quy định", 0)] },
      { k: "4.2", t: "Tham gia các hoạt động nhân đạo, từ thiện vì cộng đồng, phong trào thanh niên tình nguyện, phong trào giúp đỡ nhân dân và bạn bè khi gặp thiên tai, khó khăn, hoạn nạn", max: 10, type: "chon", opts: [O("Tích cực, nhiệt tình tham gia các hoạt động đạt hiệu quả được Học viện, các tổ chức khen thưởng", 10), O("Tham gia tích cực các hoạt động được lớp hoặc tập thể ghi nhận", 8), O("Có ý thức tham gia hoặc hưởng ứng các hoạt động", 5), O("Tham gia các hoạt động nhưng gây mất đoàn kết", 0), O("Không tham gia", 0)] },
      { k: "4.3", t: "Ý thức xây dựng mối quan hệ đoàn kết với bạn bè và tập thể; xây dựng, bảo vệ cảnh quan giảng đường, nơi cư trú văn minh, sạch đẹp, văn hóa học đường", max: 5, type: "chon", opts: [O("Có ý thức xây dựng tập thể lớp đoàn kết, giữ gìn giảng đường, nơi cư trú văn minh, sạch đẹp, thực hiện tốt văn hóa học đường", 5), O("Bị nhắc nhở hoặc kiểm điểm 1 lần", 1), O("Bị nhắc nhở hoặc kiểm điểm 2 lần", 0)] }],
    n5: [{ k: "5.1a", t: "BCS lớp, BCH các tổ chức Đảng, Đoàn thanh niên, Hội sinh viên, chi bộ sinh viên, các CLB và các tổ chức khác: ý thức, tinh thần, thái độ, uy tín và hiệu quả công việc khi được phân công nhiệm vụ", max: 7, type: "chon", opts: [
        O("Lớp trưởng, Lớp phó; Bí thư, Phó Bí thư chi đoàn, liên chi đoàn; Ủy viên BCH liên chi, BCH Đoàn, Hội sinh viên; Chủ nhiệm, Phó Chủ nhiệm các Ban, CLB, Hội, Đội; Bí thư, Phó Bí thư chi bộ sinh viên — Hoàn thành xuất sắc nhiệm vụ", 7),
        O("(Nhóm trên) — Hoàn thành tốt nhiệm vụ", 6), O("(Nhóm trên) — Hoàn thành nhiệm vụ", 4), O("(Nhóm trên) — Không hoàn thành nhiệm vụ", 0),
        O("Ủy viên BCH chi đoàn; Chi ủy viên chi bộ sinh viên, thành viên đội TN xung kích, Tổ trưởng, tổ phó các lớp; Ủy viên các Ban, CLB, Đội — Hoàn thành xuất sắc nhiệm vụ", 6),
        O("(Nhóm trên) — Hoàn thành tốt nhiệm vụ", 5), O("(Nhóm trên) — Hoàn thành nhiệm vụ", 3), O("(Nhóm trên) — Không hoàn thành nhiệm vụ", 0)] },
      { k: "5.1b", t: "Kỹ năng tổ chức, quản lý lớp, các tổ chức Đảng, Đoàn, Hội, KTX, Ban, CLB, Đội, nhóm đạt kết quả tốt, không có sinh viên/thành viên vi phạm, tham gia tích cực các hoạt động chung", max: 3, type: "chon", opts: [O("Cấp trưởng: Liên chi đoàn, lớp sinh viên, lớp học phần, chi đoàn, chi bộ, chi hội, Chủ nhiệm các CLB, Đội", 3), O("Cấp phó: Liên chi đoàn, lớp sinh viên, chi đoàn, chi bộ, chi hội, các CLB, Đội", 2), O("Ủy viên: BCH Đoàn, Hội, CLB, Đội", 1)] },
      { k: "5.2a", t: "Tất cả sinh viên trong lớp: tham gia đầy đủ các hoạt động, sinh hoạt của lớp, khoa, Học viện, có ý kiến tham gia xây dựng tập thể vững mạnh (trừ đối tượng ở tiểu mục 1)", max: 3, type: "cong", opts: [O("Có", 3)] },
      { k: "5.2b", t: "Sinh viên đạt được các thành tích đặc biệt trong học tập, rèn luyện, dũng cảm cứu người được cấp giấy chứng nhận hoặc có giấy khen", max: 7, type: "chon", opts: [O("Được khen thưởng từ cấp Học viện trở lên", 7), O("Đạt khen thưởng từ cấp Khoa trở lên", 5)] }]
  },
  CC: "Phụ lục 01 kèm Quyết định số 4185/QĐ-HCQG ngày 08/9/2023 của Giám đốc Học viện Hành chính Quốc gia (áp dụng theo Công văn số 2020-CV/HVHCQTC ngày 15/9/2026 cho sinh viên trúng tuyển năm 2023, 2024, 2025)",
  xl: d => d == null ? "" : d >= 90 ? "Xuất sắc" : d >= 80 ? "Tốt" : d >= 65 ? "Khá" : d >= 50 ? "Trung bình" : d >= 35 ? "Yếu" : "Kém",
  mucXL: "Xuất sắc 90–100 · Tốt 80 đến dưới 90 · Khá 65 đến dưới 80 · Trung bình 50 đến dưới 65 · Yếu 35 đến dưới 50 · Kém dưới 35",
  ghiChu: ["Những sinh viên đạt điểm ở nhiều nội dung thì lấy nội dung ở mục điểm cao nhất.", "Sinh viên vi phạm trên các mức được quy định ở nội dung nào thì điểm rèn luyện ở nội dung đó không được tính.", "Sinh viên bị Học viện và các đơn vị chức năng thông báo, nhắc nhở bằng văn bản hoặc bị đình chỉ học có thời hạn không quá 30 ngày, điểm loại rèn luyện kỳ học không vượt quá loại khá.", "Sinh viên không thực hiện đánh giá hoặc nộp phiếu tự đánh giá không đúng hạn sẽ bị xếp loại rèn luyện loại yếu, kém."] };
const khungOf = s => (+s.khoa && +s.khoa <= 2025) ? KH_4185 : KH_TT40;
let KH = KH_TT40;
function useKhung(s) { KH = khungOf(s); DRL_N = KH.N; DRL_CC = KH.CC; xlDrl = KH.xl; return KH; }
/* Điểm một tiêu chí theo câu trả lời a */
function itemPts(it, v) {
  if (v == null || v === "") return null;
  if (it.type === "so") return numOf(v);
  if (it.type === "chon") { const o = it.opts[+v]; return o ? o[1] : null; }
  if (it.type === "cong") { const a = Array.isArray(v) ? v : []; return a.length ? Math.min(it.max, a.reduce((n, i) => n + ((it.opts[i] || [0, 0])[1]), 0)) : 0; }
  if (it.type === "tru") { const a = Array.isArray(v) ? v : []; return a.reduce((n, c, i) => n + (numOf(c) || 0) * ((it.opts[i] || [0, 0])[1]), 0); }
  return null;
}
/* Tổng theo mục (chặn trong 0..tối đa) và tổng phiếu */
function phieuSum(K, a) {
  const n = {}; let tot = 0, any = false;
  K.N.forEach(([g, , m]) => { let x = 0, has = false; (K.PH[g] || []).forEach(it => { const p = itemPts(it, a[it.k]); if (p != null) { x += p; has = true; } }); n[g] = has ? Math.max(0, Math.min(m, x)) : null; if (has) { any = true; tot += n[g]; } });
  return { n, tot: any ? tot : null };
}
const tuAns = tu => tu.a || tu.c || {};
/* Minh chứng tải lên: pna_hoso/{mssv}/minhchung/{id} (thông tin) + mcdata/{id} (nội dung base64) */
const MC_MAX = 900000;
async function mcFileData(file) {
  if (file.type.startsWith("image/")) {
    const url = URL.createObjectURL(file);
    try {
      const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      let q = 0.8, max = 1800, out;
      for (let k = 0; k < 6; k++) { const sc = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); out = c.toDataURL("image/jpeg", q); if (out.length < MC_MAX) break; q -= 0.12; max = Math.round(max * 0.8); }
      return { ten: file.name.replace(/\.\w+$/, "") + ".jpg", loai: "image/jpeg", data: out };
    } finally { URL.revokeObjectURL(url); }
  }
  const data = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
  if (data.length > MC_MAX) throw new Error(`Tệp “${file.name}” quá lớn (tối đa khoảng 650 KB). Hãy nén PDF, chụp ảnh hoặc gửi đường link Google Drive.`);
  return { ten: file.name, loai: file.type || "application/octet-stream", data };
}
async function mcUpload(mssv, ky, muc, files) {
  const out = [];
  for (const f of files) {
    const x = await mcFileData(f), ref = doc(collection(db, "pna_hoso", mssv, "minhchung"));
    const meta = { ky, muc, ten: x.ten, loai: x.loai, size: x.data.length, by: myEmail(), at: nowISO() };
    await setDoc(doc(db, "pna_hoso", mssv, "mcdata", ref.id), { data: x.data, by: myEmail() });
    await setDoc(ref, meta); out.push({ id: ref.id, ...meta });
  }
  return out;
}
async function mcOpen(mssv, id, ten) {
  try {
    const x = await getDoc(doc(db, "pna_hoso", mssv, "mcdata", id)); if (!x.exists()) return P.toast("Không tìm thấy tệp.", "err");
    const blob = await (await fetch(x.data().data)).blob(), url = URL.createObjectURL(blob), w = window.open(url, "_blank");
    if (!w) { const a = document.createElement("a"); a.href = url; a.download = ten || "minh-chung"; a.click(); }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { P.toast("Không mở được tệp: " + e.message, "err"); }
}
async function mcDel(mssv, id) { await deleteDoc(doc(db, "pna_hoso", mssv, "mcdata", id)); await deleteDoc(doc(db, "pna_hoso", mssv, "minhchung", id)); }
const mcChips = (V, muc, canDel) => (V.mc || []).filter(f => f.muc === muc).map(f => `<span class="mc-chip"><a href="#" data-mcopen="${esc(f.id)}" data-mcten="${esc(f.ten)}">📎 ${esc(f.ten)}</a>${canDel ? `<button type="button" class="linkish" data-mcdel="${esc(f.id)}" title="Xóa tệp">✕</button>` : ""}</span>`).join("");

function tabRL(V, th) {
  const { s, edit, own, acts } = V; const K = useKhung(s);
  const ks = kyList(s.khoa).filter(k => k <= kyNow());
  if (!V.ky || !ks.includes(V.ky)) V.ky = ks[ks.length - 1] || kyNow();
  const k = V.ky, hk = hkOfKy(s.khoa, k), H = th && th.hk[hk], tu = ((s.drlTu || {})[k]) || {}, off = (s.drl || {})[k] || {}, ch = off.chiTiet || {}, goiY = hdTong(acts, k);
  const a = tuAns(tu), mc = tu.mc || {}, chot = off.diem != null, lock = !own || chot || (tu.gui && !V.rlSua);
  const S = phieuSum(K, a), tuTot = S.tot;
  const years = {}; Object.keys(s.drl || {}).forEach(x => { const y = x.split("_")[0]; (years[y] = years[y] || []).push(numOf(s.drl[x].diem)); });
  const yAvg = Object.entries(years).map(([y, arr]) => { const v = arr.filter(x => x != null); return [y, v.length ? r1(v.reduce((p, q) => p + q, 0) / v.length) : null]; }).sort();
  const yv = yAvg.map(x => x[1]).filter(x => x != null), toan = yv.length ? r1(yv.reduce((p, q) => p + q, 0) / yv.length) : null;
  const st = chot ? `<span class="hs-chip" style="color:#1b6e3a;background:#e3f4e8">Đã chốt: ${off.diem} điểm — ${esc(off.xepLoai || "")}</span>` : tu.gui ? `<span class="hs-chip" style="color:#1e40af;background:#e0e9fb">Đã gửi ${esc(fmtD(String(tu.guiAt || tu.at || "").slice(0, 10)))}</span>` : tu.at ? `<span class="hs-chip" style="color:#92400e;background:#fef3c7">Bản nháp — chưa gửi</span>` : `<span class="hs-chip" style="color:#6b7280;background:#eef0f3">Chưa tự đánh giá</span>`;
  const ctrl = it => {
    const v = a[it.k];
    if (it.type === "so") return "";
    if (it.type === "chon") return lock ? (v !== undefined && v !== "" && it.opts[+v] ? `<div class="rl-pick">☒ ${esc(it.opts[+v][0])}</div>` : "") : `<select class="rl-sel" data-rlc="${esc(it.k)}"><option value="">— Chọn mức —</option>${it.opts.map(([t, d], i) => `<option value="${i}"${String(v) === String(i) ? " selected" : ""}>${esc(t)} (${d} điểm)</option>`).join("")}</select>`;
    if (it.type === "cong") { const arr = Array.isArray(v) ? v : []; return `<div class="rl-opts">${it.opts.map(([t, d], i) => `<label class="rl-ck"><input type="checkbox" data-rlck="${esc(it.k)}" value="${i}"${arr.includes(i) ? " checked" : ""}${lock ? " disabled" : ""}> ${esc(t)} <b>(${d})</b></label>`).join("")}</div>`; }
    if (it.type === "tru") { const arr = Array.isArray(v) ? v : []; return `<div class="rl-opts">${it.opts.map(([t], i) => `<label class="rl-tru"><input type="number" min="0" step="1" data-rltru="${esc(it.k)}" data-i="${i}" value="${esc(arr[i] || "")}"${lock ? " disabled" : ""} placeholder="0"> <span>${esc(t)}</span></label>`).join("")}</div>`; }
    return "";
  };
  const rows = K.N.map(([g, name, m], gi) => `<tr class="hs-rlg"><td><b>${ROMAN[gi + 1]}. ${esc(name)}</b>${["n3", "n4", "n5"].includes(g) && goiY[g] ? `<br><small class="muted">Phong trào đã xác nhận gợi ý: ${goiY[g]} điểm</small>` : ""}</td><td class="c"><b>0–${m}</b></td>
      <td class="c"><b data-rlsum="${g}">${S.n[g] ?? ""}</b></td>
      <td class="c">${edit && !chot ? `<input class="hs-in b" data-rl="cv" data-c="${g}" data-max="${m}" value="${esc(ch[g] ?? S.n[g] ?? "")}" style="width:56px">` : `<b>${esc(ch[g] ?? "")}</b>`}</td><td></td></tr>` +
    (K.PH[g] || []).map(it => { const p = itemPts(it, a[it.k]); return `<tr class="hs-rlc"><td><span class="hs-rlk">${esc(it.k)}</span> ${esc(it.t)}${ctrl(it)}</td><td class="c muted">${it.type === "tru" ? "trừ" : it.type === "so" ? "≤ " + it.max : it.max}</td>
      <td class="c">${it.type === "so" ? (lock ? esc(a[it.k] ?? "") : `<input class="hs-in" data-rlso="${esc(it.k)}" data-n="${g}" value="${esc(a[it.k] ?? "")}" inputmode="decimal" style="width:52px">`) : `<span data-rlpt="${esc(it.k)}">${p ?? ""}</span>`}</td><td></td>
      <td class="rl-mc">${lock ? `<small>${esc(mc[it.k] || "")}</small>` : `<input class="hs-gc" data-rlmc="${esc(it.k)}" value="${esc(mc[it.k] || "")}" placeholder="Minh chứng, link Drive…">`}
        <div class="mc-list" data-mclist="${esc(k + ":" + it.k)}">${mcChips(V, k + ":" + it.k, !lock)}</div>${lock ? "" : `<label class="mc-up" title="Tải tệp minh chứng (ảnh, PDF)">📎 Tải tệp<input type="file" multiple accept="image/*,application/pdf" data-mcup="${esc(k + ":" + it.k)}" hidden></label>`}</td></tr>`; }).join("")).join("");
  return `<div class="sbox"><h3 class="sbox-title">RÈN LUYỆN — ${esc(K.tieuDe)}</h3>
    <div class="hs-kysel">${ks.map(x => `<button type="button" data-ky="${x}" class="${x === k ? "on" : ""}">HK ${ROMAN[hkOfKy(s.khoa, x)]}<small>${esc(x.split("_")[0].replace("-", "–"))}</small></button>`).join("")}</div>
    <div class="hs-hksum"><span>${esc(kyName(k))}: ${st}</span><span>Học tập kỳ này: <b>${H && H.g4 != null ? H.g4.toFixed(2) : "—"}</b> (thang 4) · ${H ? hocLuc(H.g4) || "—" : "—"}</span><span>Phong trào đã xác nhận: <b>${goiY.n3 + goiY.n4 + goiY.n5}</b> điểm gợi ý</span>
      ${(own && bq(s.lop, "bbh")) || edit ? `<span><a class="pill sm" href="#sv-bbh/${esc(s.lop)}/${esc(k)}">📋 Biên bản họp lớp ${esc(s.lop)}</a></span>` : ""}</div>
    <ol class="hs-steps"><li class="${tu.at ? "ok" : "on"}">Sinh viên tự đánh giá từng tiêu chí, ghi và tải minh chứng</li><li class="${tu.gui ? "ok" : tu.at ? "on" : ""}">Gửi phiếu cho ban cán sự lớp</li><li class="${chot ? "ok" : tu.gui ? "on" : ""}">BCS, BCH chi đoàn tổng hợp biên bản họp lớp, trình CVHT ký</li><li class="${chot ? "on" : ""}">Hội đồng cấp Khoa, cấp Học viện xét, công nhận</li></ol>
    <div class="tbl-wrap"><table class="adm-table hs-rl"><thead><tr><th>Nội dung đánh giá</th><th class="c">Thang điểm</th><th class="c">Điểm SV tự đánh giá</th><th class="c">Điểm lớp đánh giá</th><th>Ghi chú (minh chứng các hoạt động)</th></tr></thead><tbody>
      ${rows}
      <tr class="hs-tot"><td><b>TỔNG CỘNG</b></td><td class="c"><b>100</b></td><td class="c"><b id="rlTu">${tuTot ?? ""}</b> <small id="rlTuXl">${tuTot != null ? xlDrl(tuTot) : ""}</small></td><td class="c"><b>${off.diem ?? ""}</b> ${xlChip(off.xepLoai)}</td><td></td></tr>
    </tbody></table></div>
    ${own && !chot ? (lock ? `<div class="dlg-act" style="justify-content:flex-start"><button type="button" class="btn" id="rlSua">✎ Sửa phiếu đã gửi</button><button type="button" class="btn" id="rlIn">🖨 In / lưu PDF phiếu</button></div>`
      : `<label class="fld"><span>Tự nhận xét, giải trình chung</span><textarea id="rlNote" rows="2" class="fld-sel">${esc(tu.gc || "")}</textarea></label>
      <div class="dlg-act" style="justify-content:flex-start"><button type="button" class="btn" id="rlNhap">Lưu nháp</button><button type="button" class="btn primary" id="rlGui">Gửi phiếu tự đánh giá</button>${tu.at ? `<button type="button" class="btn" id="rlIn">🖨 In / lưu PDF phiếu</button>` : ""}</div>`) : ""}
    ${own && chot ? `<div class="dlg-act" style="justify-content:flex-start"><button type="button" class="btn" id="rlIn">🖨 In / lưu PDF phiếu</button></div>` : ""}
    ${edit ? `${tu.gc ? `<p class="hs-sm"><b>Sinh viên tự nhận xét:</b> ${esc(tu.gc)}</p>` : ""}${!tu.gui && !chot ? `<p class="hs-warn hs-sm">Sinh viên chưa gửi phiếu tự đánh giá kỳ này.</p>` : ""}
      ${chot ? `<p class="hs-sm"><b>Nhận xét:</b> ${esc(off.ghiChu || "—")}</p><div class="dlg-act" style="justify-content:flex-start"><button type="button" class="btn" id="rlMo">Mở lại để sửa kết quả</button><button type="button" class="btn" id="rlIn">🖨 In / lưu PDF phiếu</button></div>`
        : `<div class="dlg-act" style="justify-content:flex-start"><label class="fld" style="flex:1;margin:0"><input id="rlCvNote" placeholder="Nhận xét của CVHT / tập thể lớp…" value="${esc(off.ghiChu || "")}"></label><button type="button" class="btn primary" id="rlCvSave">Chốt kết quả riêng sinh viên này</button>${tu.at ? `<button type="button" class="btn" id="rlIn">🖨 In phiếu</button>` : ""}</div>`}` : ""}
    <p class="muted hs-sm">Căn cứ: ${esc(DRL_CC)}. Xếp loại: ${esc(K.mucXL)}.${(K.ghiChu || []).length ? " " + K.ghiChu.map(esc).join(" ") : ""} Tệp minh chứng: ảnh hoặc PDF, mỗi tệp dưới khoảng 650 KB; tệp lớn hơn gửi đường link Google Drive.</p>
    <h4 class="hs-h4">Kết quả rèn luyện các kỳ</h4>
    <table class="adm-table"><thead><tr><th>Học kỳ</th><th class="c">Tự đánh giá</th><th class="c">Kết quả</th><th>Xếp loại</th><th>Ghi chú</th></tr></thead><tbody>${[...new Set([...Object.keys(s.drl || {}), ...Object.keys(s.drlTu || {})])].sort().map(x => { const d = (s.drl || {})[x] || {}, t = (s.drlTu || {})[x] || {}, tt = t.at ? (t.tong ?? phieuSum(K, tuAns(t)).tot) : null; return `<tr><td>${esc(kyName(x))}</td><td class="c">${tt ?? "—"}</td><td class="c">${d.diem ?? "—"}</td><td>${xlChip(d.xepLoai)}</td><td class="muted">${esc(d.ghiChu || "")}</td></tr>`; }).join("") || `<tr><td colspan="5" class="muted">Chưa có.</td></tr>`}</tbody></table>
    ${yAvg.length ? `<p class="hs-sm">${yAvg.map(([y, v]) => `Năm học ${esc(y.replace("-", "–"))}: <b>${v ?? "—"}</b> ${v != null ? xlChip(xlDrl(v)) : ""}`).join(" · ")}${toan != null ? ` · Toàn khóa (đến nay): <b>${toan}</b>` : ""}</p>` : ""}</div>`;
}
/* Phần đầu văn bản lớp/khoa (Phụ lục 01, 02) */
const hdKhoa = (lop, made) => `<table class="hd"><tr><td>HỌC VIỆN HÀNH CHÍNH<br>VÀ QUẢN TRỊ CÔNG<br><b>KHOA: ${esc(KHOA_TEN)}</b>${lop ? `<br><b>LỚP: ${esc(lop)}</b>` : ""}<br>*</td><td><b><u>ĐẢNG CỘNG SẢN VIỆT NAM</u></b><br><br><i>Hà Nội, ngày ${made ? made.getDate() : "....."} tháng ${made ? made.getMonth() + 1 : "....."} năm ${made ? made.getFullYear() : "......."}</i></td></tr></table>`;
const PRINT_CSS = `body{font:13pt "Times New Roman",serif;margin:16mm 14mm 16mm 22mm;color:#000}table{border-collapse:collapse;width:100%}td,th{border:1px solid #000;padding:3px 5px;vertical-align:top}th{text-align:center}
  .hd td{border:0;text-align:center;width:50%;font-size:12.5pt}.c{text-align:center}.g td{font-weight:bold;background:#f3f3f3}h1{font-size:14pt;text-align:center;margin:12px 0 2px}p{margin:3px 0}.sig{display:grid;text-align:center;margin-top:14px}.sig img{max-height:60px}.small{font-size:11pt}
  .op td:first-child{padding-left:18px}.x{font-weight:bold}@page{size:A4;margin:0}@media print{.noprint{display:none}}`;
function printWin(title, html) {
  const w = window.open("", "_blank"); if (!w) return P.toast("Trình duyệt chặn cửa sổ in. Hãy cho phép cửa sổ bật lên.", "err");
  w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>${html}<script>onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`); w.document.close();
}
/* In phiếu (Phụ lục 01 — khóa 2023–2025; phiếu theo TT 40/2026 — khóa 2026) */
function inPhieuRL(V) {
  const K = useKhung(V.s), { s } = V, k = V.ky, tu = ((s.drlTu || {})[k]) || {}, off = (s.drl || {})[k] || {}, a = tuAns(tu), mc = tu.mc || {}, ch = off.chiTiet || {}, S = phieuSum(K, a), [y, n] = k.split("_");
  const nf = (V.mc || []).filter(f => f.ky === k);
  const row = it => {
    const p = itemPts(it, a[it.k]), files = nf.filter(f => f.muc === k + ":" + it.k).map(f => f.ten);
    const note = [mc[it.k] || "", files.length ? "Tệp: " + files.join(", ") : ""].filter(Boolean).join("; ");
    let h = `<tr><td class="c">${esc(it.k)}</td><td>${esc(it.t)}</td><td class="c">${it.type === "tru" ? "" : it.max}</td><td class="c">${it.type === "so" ? esc(a[it.k] ?? "") : (it.opts && it.type !== "chon" ? "" : (p ?? ""))}</td><td></td><td class="small">${esc(note)}</td></tr>`;
    if (it.opts) h += it.opts.map(([t, d], i) => { const v = a[it.k]; const sel = it.type === "chon" ? String(v) === String(i) : it.type === "cong" ? (Array.isArray(v) && v.includes(i)) : (Array.isArray(v) && numOf(v[i])); const pt = it.type === "tru" ? (sel ? `${d} × ${v[i]}` : "") : sel ? d : ""; return `<tr class="op"><td class="c">${it.type === "tru" ? "-" : "–"}</td><td${sel ? ' class="x"' : ""}>${sel ? "☒" : "☐"} ${esc(t)}</td><td class="c">${it.type === "tru" ? "" : d}</td><td class="c">${pt}</td><td></td><td></td></tr>`; }).join("");
    return h;
  };
  const body = K.N.map(([g, name, m], i) => `<tr class="g"><td class="c">${ROMAN[i + 1]}</td><td>${esc(name)}</td><td class="c">0–${m} điểm</td><td class="c">${S.n[g] ?? ""}</td><td class="c">${ch[g] ?? ""}</td><td></td></tr>` + (K.PH[g] || []).map(row).join("")).join("");
  printWin("Phieu_RL_" + s.mssv, `${K.pl ? `<p class="small"><i>${esc(K.pl)}</i></p>` : ""}${hdKhoa("", null)}
    <h1>${esc(K.tieuDe)}</h1>${K.key === "4185" ? `<p class="c small"><i>(Kèm theo Quyết định số 4185/QĐ-HCQG ngày 08 tháng 9 năm 2023 của Giám đốc Học viện Hành chính Quốc gia)</i></p>` : `<p class="c small"><i>(Theo Điều 17 Thông tư số 40/2026/TT-BGDĐT ngày 15/5/2026)</i></p>`}
    <p>Họ và tên: <b>${esc(s.hoTen)}</b> &nbsp; Mã sinh viên: <b>${esc(s.mssv)}</b> &nbsp; Ngày sinh: ${esc(fmtD(s.ngaySinh))}</p>
    <p>Lớp: ${esc(s.lop)} &nbsp; Ngành/chuyên ngành: ${esc(s.nganh || "")}</p><p>Năm trúng tuyển: ${esc(s.khoa || "")} &nbsp; Số điện thoại: ${esc(s.sdt || "")}</p>
    <p>Khoa (đơn vị quản lý sinh viên): ${esc(KHOA_QL)}</p><p>Đánh giá kết quả rèn luyện học kỳ ${n === "1" ? "I" : "II"} năm học ${esc(y.replace("-", " - "))}</p>
    <table><thead><tr><th>TT</th><th style="width:48%">Nội dung đánh giá</th><th>Thang điểm</th><th>Điểm SV tự đánh giá</th><th>Điểm lớp đánh giá</th><th>Ghi chú (minh chứng các hoạt động)</th></tr></thead><tbody>${body}
    <tr class="g"><td></td><td>Tổng cộng</td><td class="c">100 điểm</td><td class="c">${S.tot ?? ""}</td><td class="c">${off.diem ?? ""}</td><td></td></tr></tbody></table>
    ${(K.ghiChu || []).length ? `<p class="small"><b>Ghi chú:</b> ${K.ghiChu.map(esc).join(" ")} Xếp loại: ${esc(K.mucXL)}.</p>` : `<p class="small">Xếp loại: ${esc(K.mucXL)}.</p>`}
    ${tu.gc ? `<p>Tự nhận xét: ${esc(tu.gc)}</p>` : ""}
    <p>Sinh viên tự đánh giá, xếp loại: <b>${S.tot != null ? esc(xlDrl(S.tot)) : "……………"}</b> &nbsp;&nbsp; Lớp đánh giá, xếp loại: <b>${esc(off.xepLoai || "……………")}</b></p>
    <div class="sig" style="grid-template-columns:1fr 1fr"><div><b>T/M LỚP<br>LỚP TRƯỞNG</b><br><br><br><br></div><div><i>Hà Nội, ngày ..... tháng ..... năm ${new Date().getFullYear()}</i><br><b>SINH VIÊN</b><br><br><br><br>${esc(s.hoTen)}</div></div>`);
}

/* ---- PHONG TRÀO ---- */
function tabPT(V) {
  const { s, own, edit, acts } = V;
  const bcs = V.bcsList;
  const row = (a, conf) => { const t = HD_TT[a.tt] || HD_TT.cho; return `<tr><td>${esc(fmtD(a.ngay))}</td><td><b>${esc(a.ten)}</b>${a.moTa ? `<br><small class="muted">${esc(a.moTa)}</small>` : ""}${a.minhChung ? `<br><a href="${esc(a.minhChung)}" target="_blank" rel="noopener">Minh chứng ↗</a>` : ""}${a.nTep ? ` <a href="#" data-hdmc="${esc(a.mssv || s.mssv)}|${esc(a.id)}">📎 ${a.nTep} tệp</a>` : ""}${conf ? `<br><small>${esc(a.hoTen || a.mssv)} · ${esc(a.mssv)}</small>` : ""}</td>
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
      <label class="fld"><span>Link minh chứng (ảnh, giấy chứng nhận trên Drive…)</span><input id="hdMc" placeholder="https://"></label>
      <label class="fld"><span>Hoặc tải tệp minh chứng (ảnh, PDF; mỗi tệp dưới khoảng 650 KB)</span><input type="file" id="hdFiles" multiple accept="image/*,application/pdf"></label></div>
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
  const K = KH;
  const itemOf = key => { for (const g of Object.keys(K.PH)) { const it = K.PH[g].find(x => x.k === key); if (it) return [g, it]; } return [null, null]; };
  /* Đọc phiếu đang nhập */
  const rlRead = () => {
    const a = {}, mc = {}; let bad = "";
    document.querySelectorAll("[data-rlso]").forEach(i => { const t = i.value.trim().replace(",", "."); if (t === "") return; const n = +t; if (isNaN(n) || n < 0) bad = "Điểm tiêu chí " + i.dataset.rlso + " không hợp lệ."; a[i.dataset.rlso] = n; });
    document.querySelectorAll("[data-rlc]").forEach(i => { if (i.value !== "") a[i.dataset.rlc] = +i.value; });
    document.querySelectorAll("[data-rlck]").forEach(i => { const k = i.dataset.rlck; a[k] = a[k] || []; if (i.checked) a[k].push(+i.value); });
    document.querySelectorAll("[data-rltru]").forEach(i => { const k = i.dataset.rltru; a[k] = a[k] || []; const n = Math.max(0, Math.floor(+i.value || 0)); a[k][+i.dataset.i] = n || ""; });
    Object.keys(a).forEach(k => { if (Array.isArray(a[k]) && !a[k].some(x => x !== "" && x != null)) { const [, it] = itemOf(k); if (it && it.type === "tru") a[k] = []; } });
    document.querySelectorAll("[data-rlmc]").forEach(i => { if (i.value.trim()) mc[i.dataset.rlmc] = i.value.trim(); });
    if (K.key === "tt40") K.N.forEach(([g, , m]) => { const x = (K.PH[g] || []).reduce((n, it) => n + (numOf(a[it.k]) || 0), 0); if (x > m) bad = bad || `Nhóm ${g.slice(1)} vượt mức tối đa ${m} điểm (đang ${x}).`; });
    return { a, mc, bad, S: phieuSum(K, a) };
  };
  const rlShow = () => { const { a, S } = rlRead();
    K.N.forEach(([g]) => { const e = document.querySelector(`[data-rlsum="${g}"]`); if (e) e.textContent = S.n[g] ?? ""; });
    document.querySelectorAll("[data-rlpt]").forEach(e => { const [, it] = itemOf(e.dataset.rlpt); const p = it ? itemPts(it, a[it.k]) : null; e.textContent = p ?? ""; });
    if ($("#rlTu")) $("#rlTu").textContent = S.tot ?? ""; if ($("#rlTuXl")) $("#rlTuXl").textContent = S.tot != null ? xlDrl(S.tot) : ""; };
  document.querySelectorAll("[data-rlso],[data-rltru]").forEach(i => i.addEventListener("input", rlShow));
  document.querySelectorAll("[data-rlc],[data-rlck]").forEach(i => i.addEventListener("change", rlShow));
  /* Phiếu gửi: bản tóm tắt cho ban cán sự, CVHT tổng hợp biên bản họp lớp */
  const phieuRef = () => doc(db, "pna_drl_phieu", `${s.lop}_${V.ky}_${s.mssv}`);
  const rlSave = async gui => {
    const { a, mc, bad, S } = rlRead(); if (bad) return P.toast(bad, "err");
    if (gui) {
      const thieu = Object.values(K.PH).flat().filter(it => (it.type === "so" || it.type === "chon") && (a[it.k] === undefined || a[it.k] === "")).map(it => it.k);
      if (thieu.length) return P.toast("Đánh giá đủ các tiêu chí trước khi gửi (còn thiếu: " + thieu.join(", ") + "). Tiêu chí không có thì ghi 0 hoặc chọn mức thấp nhất.", "err");
      if (!await P.ask(`Gửi phiếu tự đánh giá ${kyName(V.ky)}: ${S.tot} điểm — ${xlDrl(S.tot)} cho ban cán sự lớp và cố vấn học tập?`)) return;
    }
    const now = nowISO(), o = { khung: K.key, a, mc, ...S.n, tong: S.tot, gc: $("#rlNote") ? $("#rlNote").value.trim() : "", at: now, gui: !!gui, ...(gui ? { guiAt: now } : {}) };
    try {
      V.rlSua = false;
      await updateDoc(doc(db, "pna_hoso", s.mssv), { ["drlTu." + V.ky]: o, updated: now, by: myEmail() }); P.logAct("HOSO", s.mssv + " · " + (gui ? "gửi" : "lưu nháp") + " phiếu RL " + V.ky); ALL = null;
      s.drlTu = { ...(s.drlTu || {}), [V.ky]: o };
      try { await setDoc(phieuRef(), { mssv: s.mssv, hoTen: s.hoTen, ngaySinh: s.ngaySinh || "", lop: s.lop, ky: V.ky, khung: K.key, tong: S.tot, xl: S.tot != null ? xlDrl(S.tot) : "", n: S.n, gui: !!gui, gc: o.gc, nTep: (V.mc || []).filter(f => f.ky === V.ky).length, at: now }); } catch (e) { console.warn("phiếu tóm tắt", e.message); }
      P.toast(gui ? "Đã gửi phiếu tự đánh giá." : "Đã lưu nháp.", "ok"); rerender();
    } catch (e) { P.toast("Chưa lưu được: " + e.message, "err"); }
  };
  if ($("#rlNhap")) $("#rlNhap").onclick = () => rlSave(false);
  if ($("#rlGui")) $("#rlGui").onclick = () => rlSave(true);
  if ($("#rlSua")) $("#rlSua").onclick = async () => { V.rlSua = true; try { await setDoc(phieuRef(), { gui: false, at: nowISO() }, { merge: true }); } catch (e) {} rerender(); };
  document.querySelectorAll("#rlIn").forEach(b => b.onclick = () => inPhieuRL(V));
  /* Minh chứng: tải tệp, mở, xóa */
  const mcRefresh = muc => { const box = document.querySelector(`[data-mclist="${CSS.escape(muc)}"]`); if (box) box.innerHTML = mcChips(V, muc, true); bindMc(); };
  const bindMc = () => {
    document.querySelectorAll("[data-mcopen]").forEach(x => x.onclick = e => { e.preventDefault(); mcOpen(s.mssv, x.dataset.mcopen, x.dataset.mcten); });
    document.querySelectorAll("[data-mcdel]").forEach(x => x.onclick = async () => { const f = (V.mc || []).find(m => m.id === x.dataset.mcdel); if (!f || !await P.ask("Xóa tệp minh chứng “" + f.ten + "”?")) return; try { await mcDel(s.mssv, f.id); V.mc = V.mc.filter(m => m.id !== f.id); mcRefresh(f.muc); } catch (e) { P.toast(e.message, "err"); } });
  };
  bindMc();
  document.querySelectorAll("[data-mcup]").forEach(inp => inp.onchange = async () => {
    const files = [...inp.files]; inp.value = ""; if (!files.length) return;
    const muc = inp.dataset.mcup, lab = inp.closest(".mc-up"); lab.classList.add("busy");
    try { const added = await mcUpload(s.mssv, muc.split(":")[0], muc, files); V.mc = [...(V.mc || []), ...added]; mcRefresh(muc); P.toast("Đã tải " + added.length + " tệp minh chứng.", "ok"); }
    catch (e) { P.toast("Chưa tải được: " + e.message, "err"); } finally { lab.classList.remove("busy"); }
  });
  if ($("#rlMo")) $("#rlMo").onclick = async () => {
    if (!await P.ask("Mở lại kết quả rèn luyện " + kyName(V.ky) + " để sửa? Kết quả đã chốt sẽ được gỡ cho tới khi chốt lại.")) return;
    const d = { ...(s.drl || {}) }; const old = d[V.ky] || {}; d[V.ky] = { chiTiet: old.chiTiet || {}, ghiChu: old.ghiChu || "", diem: null, xepLoai: "" };
    try { await save({ drl: d }, "mở lại RL " + V.ky); } catch (e) { P.toast("Chưa lưu được: " + e.message, "err"); }
  };
  if ($("#rlCvSave")) $("#rlCvSave").onclick = async () => {
    const o = rlVals("cv"); if (!o) return P.toast("Điểm mỗi mục không vượt mức tối đa.", "err");
    if (DRL_N.some(([c]) => o[c] == null)) return P.toast("Nhập đủ điểm 5 mục trước khi chốt.", "err");
    const tot = DRL_N.reduce((n, [c]) => n + (o[c] || 0), 0);
    if (!await P.ask(`Chốt kết quả rèn luyện ${kyName(V.ky)}: ${tot} điểm — ${xlDrl(tot)}?`)) return;
    try { await save({ drl: { ...(s.drl || {}), [V.ky]: { diem: tot, xepLoai: xlDrl(tot), chiTiet: o, ghiChu: $("#rlCvNote").value.trim(), nguon: "Phiếu đánh giá — " + myEmail() } } }, "chốt RL " + V.ky); } catch (e) { P.toast("Chưa lưu được: " + e.message, "err"); }
  };
  /* Phong trào */
  if ($("#hdAdd")) $("#hdAdd").onclick = async () => {
    const ten = $("#hdTen").value.trim(), ngay = $("#hdNgay").value; if (!ten) return $("#hdErr").textContent = "Nhập tên hoạt động.";
    const a = { ten, ngay, ky: kyOfDate(ngay), nhom: $("#hdNhom").value, cap: $("#hdCap").value, vaiTro: $("#hdVt").value, minhChung: $("#hdMc").value.trim(), moTa: $("#hdMt").value.trim(), tt: "cho", mssv: s.mssv, hoTen: s.hoTen, lop: s.lop, cvht: s.cvht || [], created: nowISO(), by: myEmail() };
    if (a.minhChung && !/^https?:\/\//i.test(a.minhChung)) return $("#hdErr").textContent = "Link minh chứng phải bắt đầu bằng https://";
    const files = [...($("#hdFiles") || { files: [] }).files]; $("#hdAdd").disabled = true;
    try {
      const r = await addDoc(collection(db, "pna_hoso", s.mssv, "hoatdong"), a);
      if (files.length) { const added = await mcUpload(s.mssv, a.ky, "hd:" + r.id, files); V.mc = [...(V.mc || []), ...added]; a.nTep = added.length; await updateDoc(r, { nTep: added.length }); }
      V.acts.push({ id: r.id, ...a }); P.toast("Đã gửi kê khai, chờ xác nhận.", "ok"); rerender();
    } catch (e) { $("#hdErr").textContent = "Chưa gửi được: " + e.message; $("#hdAdd").disabled = false; }
  };
  const xn = async (key, ok) => {
    const [m, id] = key.split("|"); let gc = "";
    if (!ok) { const r = await P.ask("Lý do không xác nhận (sinh viên sẽ thấy):", { title: "KHÔNG XÁC NHẬN HOẠT ĐỘNG", input: "Lý do", ok: "Gửi" }); if (r === null || r === false) return; gc = String(r).trim(); }
    const patch = { tt: ok ? "ok" : "no", xn: { by: myEmail(), at: nowISO(), gc } };
    try { await updateDoc(doc(db, "pna_hoso", m, "hoatdong", id), patch);
      [V.acts, V.bcsList || []].forEach(L => L.forEach(a => { if (a.id === id) Object.assign(a, patch); }));
      if (V.bcsList) V.bcsList = V.bcsList.filter(a => a.tt === "cho"); P.toast(ok ? "Đã xác nhận." : "Đã trả lại.", "ok"); rerender(); } catch (e) { P.toast("Chưa lưu được: " + e.message, "err"); }
  };
  document.querySelectorAll("[data-hdmc]").forEach(b => b.onclick = async e => {
    e.preventDefault(); const [m, id] = b.dataset.hdmc.split("|");
    try { const L = []; (await getDocs(query(collection(db, "pna_hoso", m, "minhchung"), where("muc", "==", "hd:" + id)))).forEach(d => L.push({ id: d.id, ...d.data() }));
      if (L.length === 1) return mcOpen(m, L[0].id, L[0].ten);
      const dl = document.createElement("dialog"); dl.className = "dlg"; dl.innerHTML = `<div class="dlg-in"><h3>TỆP MINH CHỨNG</h3>${L.map(f => `<p><a href="#" data-o="${esc(f.id)}" data-t="${esc(f.ten)}">📎 ${esc(f.ten)}</a></p>`).join("") || "<p class='muted'>Không có tệp.</p>"}<div class="dlg-act"><button type="button" class="btn primary" data-x>Đóng</button></div></div>`;
      document.body.appendChild(dl); dl.showModal(); dl.addEventListener("close", () => dl.remove()); dl.querySelector("[data-x]").onclick = () => dl.close();
      dl.querySelectorAll("[data-o]").forEach(x => x.onclick = ev => { ev.preventDefault(); mcOpen(m, x.dataset.o, x.dataset.t); });
    } catch (x) { P.toast("Không mở được tệp: " + x.message, "err"); }
  });
  document.querySelectorAll("[data-hdok]").forEach(b => b.onclick = () => xn(b.dataset.hdok, true));
  document.querySelectorAll("[data-hdno]").forEach(b => b.onclick = () => xn(b.dataset.hdno, false));
  document.querySelectorAll("[data-hddel]").forEach(b => b.onclick = async () => { if (!await P.ask("Xóa kê khai này?")) return; try { await deleteDoc(doc(db, "pna_hoso", s.mssv, "hoatdong", b.dataset.hddel)); V.acts = V.acts.filter(a => a.id !== b.dataset.hddel); rerender(); } catch (e) { P.toast(e.message, "err"); } });
  /* Ban cán sự: tải kê khai chờ của lớp (một lần) */
  if (V.tab === "phong-trao" && own && bq(s.lop, "pt") && !V.bcsList) {
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
    ${ME.sv && !isStaff() ? `<p class="muted" style="margin:-4px 0 10px">Hành trình học tập, rèn luyện, đơn đã gửi.</p><button type="button" class="sbtn primary" data-go="sv/${esc(ME.sv.mssv)}">Hồ sơ của tôi</button>
      ${bq(ME.sv.lop, "hs") ? `<button type="button" class="sbtn" data-go="sv/lop/${esc(ME.sv.lop)}">Lớp ${esc(ME.sv.lop)} (ban quản trị)</button>` : ""}${bq(ME.sv.lop, "bbh") ? `<button type="button" class="sbtn" data-go="sv-bbh/${esc(ME.sv.lop)}">Biên bản họp lớp</button>` : ""}` : `
    <p class="muted" style="margin:-4px 0 10px">Quản lý sinh viên theo vòng đời: lớp, CTĐT, rèn luyện, sự kiện, thủ tục.</p>
    ${lops.length ? `<div class="tt-links">${lops.sort((a, b) => a.id.localeCompare(b.id)).map(l => `<a href="#sv/lop/${esc(l.id)}"><span class="tt-dot"></span>Lớp ${esc(l.id)}${l.ten ? " — " + esc(l.ten) : ""}</a>`).join("")}</div>` : ""}
    <button type="button" class="sbtn${lops.length ? "" : " primary"}" data-go="sv" style="margin-top:8px">${seeAll() ? "Tất cả lớp – tìm sinh viên" : "Danh sách lớp"}</button>
    ${isAdmin() ? `<button type="button" class="sbtn" data-go="sv-nhap">Nhập dữ liệu sinh viên</button><button type="button" class="sbtn" data-go="sv-ctdt">Chương trình đào tạo</button>` : ""}`}`;
}

/* ---------- Định tuyến ---------- */
/* ---------- BIÊN BẢN HỌP LỚP đánh giá kết quả rèn luyện (Phụ lục 02, Công văn 2020-CV/HVHCQTC) ----------
   pna_bbh/{lớp}_{kỳ}: { lop, ky, tt nhap|trinh|tra-lai|da-ky, ds[] (danh sách lớp do CVHT nạp), hop{…}, rows{mssv:{lop, bq, gc}},
   lt{email, ten, sig, at} (lớp trưởng/BCS ký trình), cv{…} (CVHT ký), traLai }. Phiếu SV: pna_drl_phieu/{lớp}_{kỳ}_{mssv}.
   Ban cán sự, BCH chi đoàn (sinh viên có chức vụ trong hồ sơ, cùng lớp) lập, trình; CVHT ký, chốt → ghi drl vào hồ sơ từng sinh viên. */
const BBH_TT = { nhap: ["Đang lập", "#92400e", "#fef3c7"], trinh: ["Đã trình CVHT", "#1e40af", "#e0e9fb"], "tra-lai": ["CVHT trả lại", "#b3261e", "#fbe6e4"], "da-ky": ["CVHT đã ký, chốt", "#1b6e3a", "#e3f4e8"] };
function sigMini(host, saved) {
  host.innerHTML = `<div class="sig-wrap"><canvas class="sig-cv"></canvas></div><div class="sig-act"><button type="button" class="btn sm" data-c>Ký lại</button>${saved ? `<button type="button" class="btn sm" data-s>Dùng chữ ký đã lưu</button>` : ""}</div>`;
  const cv = host.querySelector("canvas"), ctx = cv.getContext("2d"), r = window.devicePixelRatio || 1, w = Math.min(host.clientWidth || 420, 460);
  cv.width = w * r; cv.height = 140 * r; cv.style.width = w + "px"; cv.style.height = "140px"; ctx.setTransform(r, 0, 0, r, 0, 0); ctx.lineWidth = 2.3; ctx.lineCap = "round"; ctx.strokeStyle = "#0b2a6b"; cv.style.touchAction = "none";
  let down = false, last = null, n = 0, img = null;
  const pt = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  cv.onpointerdown = e => { down = true; last = pt(e); img = null; n++; cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => { if (!down) return; const p = pt(e); ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...p); ctx.stroke(); last = p; n++; };
  cv.onpointerup = () => down = false;
  host.querySelector("[data-c]").onclick = () => { ctx.clearRect(0, 0, cv.width, cv.height); n = 0; img = null; };
  if (saved) host.querySelector("[data-s]").onclick = () => { ctx.clearRect(0, 0, cv.width, cv.height); const i = new Image(); i.onload = () => { const sc = Math.min((w - 20) / i.width, 120 / i.height, 1.5); ctx.drawImage(i, (w - i.width * sc) / 2, (140 - i.height * sc) / 2, i.width * sc, i.height * sc); }; i.src = saved; img = saved; };
  return { get: () => img || (n > 3 ? cv.toDataURL("image/png") : null) };
}
async function signDialog(title) {
  let saved = ""; try { const x = await getDoc(doc(db, "pna_chuky", myEmail())); saved = x.exists() ? x.data().img || "" : ""; } catch (e) {}
  return new Promise(res => {
    const dl = document.createElement("dialog"); dl.className = "dlg";
    dl.innerHTML = `<div class="dlg-in"><h3>${esc(title)}</h3><div id="sgPad"></div><p class="err" id="sgErr"></p><div class="dlg-act"><button type="button" class="btn" data-x>Hủy</button><button type="button" class="btn primary" data-ok>Ký</button></div></div>`;
    document.body.appendChild(dl); dl.showModal(); const pad = sigMini(dl.querySelector("#sgPad"), saved);
    const end = v => { dl.close(); dl.remove(); res(v); };
    dl.querySelector("[data-x]").onclick = () => end(null);
    dl.querySelector("[data-ok]").onclick = () => { const g = pad.get(); if (!g) return dl.querySelector("#sgErr").textContent = "Hãy ký vào ô."; if (!saved) setDoc(doc(db, "pna_chuky", myEmail()), { img: g, updated: nowISO() }).catch(() => {}); end(g); };
  });
}
async function renderBBH(lopId, ky) {
  await loadMe();
  let l = null; try { const x = await getDoc(doc(db, "pna_lop", lopId)); if (x.exists()) l = { id: x.id, ...x.data() }; } catch (e) {}
  if (!l) return page("Biên bản họp lớp", `<p class="empty">Không tìm thấy lớp ${esc(lopId)}.</p>`);
  const cv = isAdmin() || (l.cvht || []).includes(myEmail());
  let bcs = false, meHs = null;
  if (!cv && bq(lopId, "bbh")) { bcs = true; if (ME.sv) { try { const x = await getDoc(doc(db, "pna_hoso", ME.sv.mssv)); if (x.exists()) meHs = x.data(); } catch (e) {} } }
  if (!cv && !bcs) return page("Biên bản họp lớp", `<p class="empty">Chỉ ban cán sự lớp, BCH chi đoàn được giao quyền và cố vấn học tập của lớp ${esc(lopId)} dùng chức năng này.</p>`);
  const K = khungOf({ khoa: l.khoa }), ks = kyList(l.khoa).filter(k => k <= kyNow());
  if (!ky || !ks.includes(ky)) ky = ks.length > 1 ? ks[ks.length - 2] : ks[0] || kyNow();
  const id = `${lopId}_${ky}`;
  let B = null, ph = {};
  try { const x = await getDoc(doc(db, "pna_bbh", id)); if (x.exists()) B = x.data(); } catch (e) {}
  try { (await getDocs(query(collection(db, "pna_drl_phieu"), where("lop", "==", lopId), where("ky", "==", ky)))).forEach(d => { const p = d.data(); ph[p.mssv] = p; }); } catch (e) { console.warn("phiếu", e.message); }
  B = B || { lop: lopId, ky, tt: "nhap", ds: [], hop: {}, rows: {} };
  const map = {}; (B.ds || []).forEach(r => map[r.mssv] = { ...r }); Object.values(ph).forEach(p => { map[p.mssv] = { ...(map[p.mssv] || {}), mssv: p.mssv, hoTen: map[p.mssv] && map[p.mssv].hoTen || p.hoTen, ngaySinh: (map[p.mssv] || {}).ngaySinh || p.ngaySinh }; });
  const list = Object.values(map).sort((a, b) => vi.compare(String(a.hoTen || "").split(" ").pop(), String(b.hoTen || "").split(" ").pop()) || vi.compare(a.hoTen || "", b.hoTen || ""));
  const tt = B.tt || "nhap", canEditB = tt !== "da-ky" && (cv || (bcs && ["nhap", "tra-lai"].includes(tt))), H = B.hop || {};
  const tuOf = m => ph[m] && ph[m].gui ? ph[m].tong : null;
  const lopOf = m => { const r = (B.rows || {})[m] || {}; return r.lop !== undefined && r.lop !== "" ? numOf(r.lop) : tuOf(m); };
  const xlOf = v => v == null ? "Không ĐG" : K.xl(v);
  const cnt = {}; list.forEach(r => { const x = xlOf(lopOf(r.mssv)); cnt[x] = (cnt[x] || 0) + 1; });
  const ttc = BBH_TT[tt] || BBH_TT.nhap, inp = (k, v, ph2, w) => canEditB ? `<input class="hs-gc" data-hop="${k}" value="${esc(v || "")}" placeholder="${esc(ph2 || "")}"${w ? ` style="max-width:${w}px"` : ""}>` : `<b>${esc(v || "………")}</b>`;
  page(`Biên bản họp lớp ${esc(lopId)} — ${esc(kyName(ky))}`, `
    <div class="hs-kysel">${ks.map(x => `<a class="${x === ky ? "on" : ""}" href="#sv-bbh/${esc(lopId)}/${x}">${esc(kyName(x))}</a>`).join("")}</div>
    <div class="hs-hksum"><span>Trạng thái: <span class="hs-chip" style="color:${ttc[1]};background:${ttc[2]}">${ttc[0]}</span></span><span>Phiếu đã gửi: <b>${Object.values(ph).filter(p => p.gui).length}</b>/${list.length || "—"}</span><span>Khung đánh giá: ${K.key === "4185" ? "QĐ 4185/QĐ-HCQG (khóa 2023–2025)" : "TT 40/2026/TT-BGDĐT"}</span>
      ${B.traLai ? `<span class="hs-warn">CVHT trả lại: ${esc(B.traLai)}</span>` : ""}</div>
    ${cv && tt !== "da-ky" ? `<p><button type="button" class="btn" id="bbNap">⟳ Nạp danh sách lớp, điểm học tập từ hồ sơ</button> <small class="muted">Sinh viên chưa gửi phiếu vẫn có tên trong biên bản (xếp “Không ĐG” nếu không nhập điểm lớp).</small></p>` : ""}
    <details class="more" open><summary>Thông tin cuộc họp</summary><div class="grid2">
      <label class="fld"><span>Bắt đầu hồi (giờ)</span>${inp("batDau", H.batDau, "8h00")}</label><label class="fld"><span>Ngày họp</span>${inp("ngay", H.ngay, "dd/mm/yyyy")}</label>
      <label class="fld"><span>Địa điểm</span>${inp("diaDiem", H.diaDiem, "Phòng…")}</label><label class="fld"><span>Tổng số người dự họp</span>${inp("soDu", H.soDu, "")}</label>
      <label class="fld"><span>Vắng họp (người)</span>${inp("vang", H.vang, "")}</label><label class="fld"><span>Lý do vắng họp</span>${inp("lyDoVang", H.lyDoVang, "")}</label>
      <label class="fld"><span>Chủ tọa</span>${inp("chuToa", H.chuToa, "CVHT …")}</label><label class="fld"><span>Thư ký</span>${inp("thuKy", H.thuKy, "")}</label>
      <label class="fld"><span>Lớp trưởng</span>${inp("lopTruong", H.lopTruong, "")}</label><label class="fld"><span>Kết thúc hồi</span>${inp("ketThuc", H.ketThuc, "9h30")}</label></div></details>
    <div class="tbl-wrap"><table class="adm-table bbh-t"><thead><tr><th>STT</th><th>Mã số SV</th><th>Họ và tên</th><th>Ngày sinh</th><th class="c">Điểm HT HK</th><th class="c">KQRL SV tự đánh giá</th><th class="c">KQRL lớp đánh giá</th><th>Xếp loại</th><th class="c">Biểu quyết</th><th>Ghi chú</th></tr></thead><tbody>
    ${list.map((r, i) => { const p = ph[r.mssv], R = (B.rows || {})[r.mssv] || {}, lv = lopOf(r.mssv); return `<tr><td class="c">${i + 1}</td><td>${esc(r.mssv)}</td><td>${esc(r.hoTen || "")}</td><td>${esc(fmtD(r.ngaySinh))}</td><td class="c">${r.diemHT ?? ""}</td>
      <td class="c">${p ? (p.gui ? `<b>${p.tong ?? ""}</b>` : `<small class="muted">nháp</small>`) : `<small class="hs-warn">chưa gửi</small>`}${p && p.nTep ? `<br><small>📎 ${p.nTep}</small>` : ""}</td>
      <td class="c">${canEditB ? `<input class="hs-in b" data-bl="${esc(r.mssv)}" value="${esc(R.lop ?? (tuOf(r.mssv) ?? ""))}" style="width:52px" inputmode="decimal">` : `<b>${lv ?? ""}</b>`}</td>
      <td data-bx="${esc(r.mssv)}">${xlChip(xlOf(lv))}</td>
      <td class="c">${canEditB ? `<input class="hs-in" data-bq="${esc(r.mssv)}" value="${esc(R.bq ?? "100%")}" style="width:60px">` : esc(R.bq ?? "")}</td>
      <td>${canEditB ? `<input class="hs-gc" data-bg="${esc(r.mssv)}" value="${esc(R.gc || "")}" placeholder="Minh chứng (XS, Tốt, TB, Yếu, Kém)…">` : esc(R.gc || "")}${cv ? ` <a href="#sv/${esc(r.mssv)}/ren-luyen" class="linkish">phiếu ↗</a>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="10" class="muted">Chưa có danh sách. ${cv ? "Bấm “Nạp danh sách lớp…”." : "Chờ sinh viên gửi phiếu hoặc cố vấn học tập nạp danh sách lớp."}</td></tr>`}
    </tbody></table></div>
    <p class="hs-sm">Tổng số: <b>${list.length}</b> sinh viên. Trong đó: ${["Xuất sắc", "Tốt", "Khá", "Trung bình", "Yếu", "Kém", "Không ĐG"].filter(x => K.key === "4185" || x !== "Kém").map(x => `${x}: <b>${cnt[x] || 0}</b>`).join(" · ")}</p>
    <div class="bbh-sig"><div><b>LỚP TRƯỞNG</b>${B.lt && B.lt.sig ? `<img src="${B.lt.sig}" alt=""><small>${esc(B.lt.ten || "")} · ${esc(fmtD(String(B.lt.at).slice(0, 10)))}</small>` : `<small class="muted">(chưa ký)</small>`}</div>
      <div><b>CỐ VẤN HỌC TẬP</b>${B.cv && B.cv.sig ? `<img src="${B.cv.sig}" alt=""><small>${esc(B.cv.ten || "")} · ${esc(fmtD(String(B.cv.at).slice(0, 10)))}</small>` : `<small class="muted">(chưa ký)</small>`}</div></div>
    <div class="dlg-act" style="justify-content:flex-start;flex-wrap:wrap">
      ${canEditB ? `<button type="button" class="btn" id="bbSave">Lưu</button>` : ""}
      ${bcs && canEditB ? `<button type="button" class="btn primary" id="bbTrinh">Ký và trình CVHT</button>` : ""}
      ${cv && tt !== "da-ky" ? `${tt === "trinh" ? `<button type="button" class="btn" id="bbTra">Trả lại BCS</button>` : ""}<button type="button" class="btn primary" id="bbKy">Ký, chốt kết quả rèn luyện</button>` : ""}
      ${cv && tt === "da-ky" ? `<button type="button" class="btn" id="bbMo">Mở lại để sửa</button>` : ""}
      <button type="button" class="btn" id="bbIn">🖨 In / lưu PDF biên bản</button></div>
    <p class="muted hs-sm">Theo Công văn 2020-CV/HVHCQTC: sinh viên tự đánh giá, gửi bản tự đánh giá cho ban cán sự lớp; cố vấn học tập chủ trì họp lớp (BCS, BCH chi đoàn, chi hội) đánh giá và gửi biên bản lên Hội đồng cấp Khoa. Khi CVHT ký, chốt, kết quả lớp đánh giá được ghi vào hồ sơ rèn luyện từng sinh viên. ${esc(K.mucXL)}.</p>`,
    cv ? [["sv", "Hồ sơ sinh viên"], ["sv/lop/" + lopId, lopId], [null, "Biên bản họp lớp"]] : null);
  /* Tự tính xếp loại khi gõ điểm lớp */
  document.querySelectorAll("[data-bl]").forEach(i => i.addEventListener("input", () => { const v = i.value.trim() === "" ? null : numOf(i.value.trim().replace(",", ".")); const c = document.querySelector(`[data-bx="${CSS.escape(i.dataset.bl)}"]`); if (c) c.innerHTML = xlChip(xlOf(v)); }));
  const collect = () => {
    const hop = { ...H }; document.querySelectorAll("[data-hop]").forEach(i => hop[i.dataset.hop] = i.value.trim());
    const rows = { ...(B.rows || {}) }; let bad = "";
    list.forEach(r => { const g = s => document.querySelector(`[data-${s}="${CSS.escape(r.mssv)}"]`); const lv = g("bl") ? g("bl").value.trim().replace(",", ".") : "";
      if (lv !== "" && (isNaN(+lv) || +lv < 0 || +lv > 100)) bad = "Điểm lớp đánh giá của " + r.mssv + " phải từ 0 đến 100.";
      rows[r.mssv] = { lop: lv === "" ? "" : +lv, bq: g("bq") ? g("bq").value.trim() : "", gc: g("bg") ? g("bg").value.trim() : "" }; });
    return { hop, rows, bad };
  };
  const ref = doc(db, "pna_bbh", id), base = () => ({ lop: lopId, ky, updated: nowISO(), by: myEmail() });
  const write = async (extra, msg) => { const c = collect(); if (c.bad) { P.toast(c.bad, "err"); return false; } await setDoc(ref, { ...base(), hop: c.hop, rows: c.rows, ...(B.ds ? {} : { ds: [] }), ...extra }, { merge: true }); P.logAct("BBH", id + " · " + msg); return true; };
  if ($("#bbSave")) $("#bbSave").onclick = async () => { try { if (await write({ tt: tt === "tra-lai" && !cv ? "nhap" : tt }, "lưu")) { P.toast("Đã lưu biên bản.", "ok"); renderBBH(lopId, ky); } } catch (e) { P.toast("Chưa lưu được: " + e.message, "err"); } };
  if ($("#bbTrinh")) $("#bbTrinh").onclick = async () => {
    const sig = await signDialog("LỚP TRƯỞNG / BAN CÁN SỰ KÝ TRÌNH CVHT"); if (!sig) return;
    try { if (await write({ tt: "trinh", lt: { email: myEmail(), ten: (meHs && meHs.hoTen) || (ME.sv && ME.sv.hoTen) || (P.acct && P.acct.name) || myEmail(), chucVu: (meHs && meHs.chucVu) || "", sig, at: nowISO() } }, "trình CVHT")) { P.toast("Đã ký và trình cố vấn học tập.", "ok"); renderBBH(lopId, ky); } } catch (e) { P.toast("Chưa trình được: " + e.message, "err"); }
  };
  if ($("#bbTra")) $("#bbTra").onclick = async () => { const r = await P.ask("Lý do trả lại (ban cán sự sẽ thấy):", { title: "TRẢ LẠI BIÊN BẢN", input: "Lý do", ok: "Trả lại" }); if (r === null || r === false) return; try { await setDoc(ref, { ...base(), tt: "tra-lai", traLai: String(r).trim() }, { merge: true }); renderBBH(lopId, ky); } catch (e) { P.toast(e.message, "err"); } };
  if ($("#bbMo")) $("#bbMo").onclick = async () => { if (!await P.ask("Mở lại biên bản để sửa? Kết quả đã ghi vào hồ sơ giữ nguyên cho tới khi ký, chốt lại.")) return; try { await setDoc(ref, { ...base(), tt: "nhap" }, { merge: true }); renderBBH(lopId, ky); } catch (e) { P.toast(e.message, "err"); } };
  if ($("#bbNap")) $("#bbNap").onclick = async () => {
    try {
      const all = Object.values(await loadHoso(true)).filter(x => x.lop === lopId && !["thoi-hoc", "buoc-thoi-hoc", "chuyen-di", "tot-nghiep"].includes(x.trangThai || ""));
      let ct = null; if (l.ctdt) { try { const x = await getDoc(doc(db, "pna_ctdt", l.ctdt)); if (x.exists()) ct = x.data(); } catch (e) {} }
      const hkI = hkOfKy(l.khoa, ky);
      const ds = all.map(x => { const t = ct ? hocTapTH(ct, x.hocTap) : null, Hk = t && t.hk[hkI]; return { mssv: x.mssv, hoTen: x.hoTen, ngaySinh: x.ngaySinh || "", diemHT: Hk && Hk.g4 != null ? Hk.g4.toFixed(2) : "" }; });
      await setDoc(ref, { ...base(), ds, ...(B.tt ? {} : { tt: "nhap" }) }, { merge: true }); P.toast("Đã nạp " + ds.length + " sinh viên.", "ok"); renderBBH(lopId, ky);
    } catch (e) { P.toast("Chưa nạp được: " + e.message, "err"); }
  };
  if ($("#bbKy")) $("#bbKy").onclick = async () => {
    const c = collect(); if (c.bad) return P.toast(c.bad, "err");
    const items = list.map(r => { const R = c.rows[r.mssv] || {}, v = R.lop !== "" && R.lop != null ? R.lop : tuOf(r.mssv); return { r, v, R }; }).filter(x => x.v != null);
    if (!await P.ask(`Ký và chốt biên bản: ghi kết quả rèn luyện ${kyName(ky)} cho ${items.length} sinh viên (${list.length - items.length} sinh viên không đánh giá)?`)) return;
    const sig = await signDialog("CỐ VẤN HỌC TẬP KÝ BIÊN BẢN"); if (!sig) return;
    try {
      await setDoc(ref, { ...base(), hop: c.hop, rows: c.rows, tt: "da-ky", traLai: "", cv: { email: myEmail(), ten: (P.acct && P.acct.name) || myEmail(), sig, at: nowISO() } }, { merge: true });
      for (let i = 0; i < items.length; i += 400) {
        const bt = writeBatch(db);
        items.slice(i, i + 400).forEach(({ r, v, R }) => { const p = ph[r.mssv]; bt.set(doc(db, "pna_hoso", r.mssv), { drl: { [ky]: { diem: v, xepLoai: K.xl(v), chiTiet: (p && p.n) || {}, ghiChu: R.gc || "", nguon: "Biên bản họp lớp " + lopId } }, updated: nowISO(), by: myEmail() }, { merge: true }); });
        await bt.commit();
      }
      P.logAct("BBH_KY", id + " · " + items.length + " SV"); ALL = null; P.toast("Đã ký, chốt và ghi kết quả vào hồ sơ " + items.length + " sinh viên.", "ok"); renderBBH(lopId, ky);
    } catch (e) { P.toast("Chưa chốt được: " + e.message, "err"); }
  };
  $("#bbIn").onclick = () => {
    const [y, n] = ky.split("_"), dot = "…………………", kq = list.map((r, i) => { const R = (B.rows || {})[r.mssv] || {}, v = lopOf(r.mssv), p = ph[r.mssv]; return `<tr><td class="c">${i + 1}</td><td>${esc(r.mssv)}</td><td>${esc(r.hoTen || "")}</td><td class="c">${esc(fmtD(r.ngaySinh))}</td><td class="c">${esc(r.diemHT ?? "")}</td><td class="c">${p && p.gui ? p.tong ?? "" : ""}</td><td class="c">${v ?? ""}</td><td class="c">${esc(xlOf(v))}</td><td class="c">${esc(R.bq || "")}</td><td class="small">${esc(R.gc || "")}</td></tr>`; }).join("");
    const sg = (t, x, name) => `<div><b>${t}</b><br>${x && x.sig ? `<img src="${x.sig}" alt="">` : "<br><br><br>"}<br>${esc(name || (x && x.ten) || "")}</div>`;
    printWin("BBH_" + id, `<p class="small"><i>Phụ lục 02</i></p>${hdKhoa(lopId, null)}
      <h1>BIÊN BẢN HỌP LỚP ${esc(lopId)}</h1><p class="c"><b>Về việc đánh giá kết quả rèn luyện học kỳ ${n === "1" ? "I" : "II"} năm học: ${esc(y.replace("-", " - "))}</b></p>
      <p>I. Thời gian: Cuộc họp bắt đầu vào hồi: ${esc(H.batDau || dot)} ngày: ${esc(H.ngay || dot)}</p><p>II. Địa điểm: ${esc(H.diaDiem || dot)}</p>
      <p>III. Thành phần:</p><p>- Cố vấn học tập;</p><p>- Ban cán sự lớp, Ban chấp hành chi đoàn, toàn thể sinh viên trong lớp.</p>
      <p>- Tổng số người dự họp: ${esc(H.soDu || dot)} người</p><p>Vắng họp: ${esc(H.vang || dot)} người, lý do vắng họp: ${esc(H.lyDoVang || dot)}</p>
      <p>Chủ tọa: ${esc(H.chuToa || dot)}</p><p>Thư ký: ${esc(H.thuKy || dot)}</p>
      <p>IV. Nội dung</p><p>1. Lớp trưởng báo cáo kết quả tổng hợp phiếu đánh giá kết quả rèn luyện của sinh viên trong lớp.</p>
      <p>2. Cố vấn học tập triển khai các văn bản hướng dẫn đánh giá kết quả rèn luyện, căn cứ vào báo cáo của Ban cán sự lớp triển khai các bước trong quy trình đánh giá kết quả rèn luyện của sinh viên trong lớp.</p>
      <p>3. Kết quả rèn luyện của các thành viên trong lớp:</p><p>Căn cứ phiếu tự đánh giá kết quả rèn luyện của các thành viên trong lớp, ý kiến nhận xét, đánh giá của Cố vấn học tập, Ban cán sự lớp, BCH chi đoàn, đối chiếu với quy chế của Bộ Giáo dục và Đào tạo và quy định của Học viện, tập thể lớp nhất trí thông qua kết quả rèn luyện của các thành viên trong lớp như sau:</p>
      <table><thead><tr><th>STT</th><th>Mã số SV</th><th>Họ và tên</th><th>Ngày sinh</th><th>Điểm HT ${esc(kyName(ky))}</th><th>KQRL SV tự đánh giá</th><th>KQRL lớp đánh giá</th><th>Xếp loại</th><th>Biểu quyết</th><th>Ghi chú (kèm theo MC đối với SV xếp loại Xuất sắc, Tốt, TB, Yếu, Kém)</th></tr></thead><tbody>${kq}</tbody></table>
      <p>Tổng số: ${list.length} sinh viên. Trong đó: ${["Xuất sắc", "Tốt", "Khá", "Trung bình", "Yếu", "Kém", "Không ĐG"].map(x => `${x}: ${cnt[x] || 0}`).join("; ")} sinh viên.</p>
      <p>Cuộc họp kết thúc vào hồi ${esc(H.ketThuc || dot)}, ngày ${esc(H.ngay || dot)}.</p>
      <div class="sig" style="grid-template-columns:1fr 1fr 1fr">${sg("CỐ VẤN HỌC TẬP", B.cv)}${sg("LỚP TRƯỞNG", B.lt, H.lopTruong)}${sg("THƯ KÝ", null, H.thuKy)}</div>`);
  };
}

async function route(h) {
  if (!P.authReady) { $("#main").innerHTML = `<p class="empty">Đang tải…</p>`; return; }
  if (h === "sv") return renderHome();
  if (h === "sv-nhap") return renderNhap();
  if (h.startsWith("sv-bbh/")) { const [, l, k] = h.split("/"); return renderBBH(decodeURIComponent(l || ""), k); }
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
