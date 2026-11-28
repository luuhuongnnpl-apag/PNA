/* =====================================================================
   CỔNG THỦ TỤC SINH VIÊN — Hệ thống cố vấn học tập (PNA)
   Sinh viên (tài khoản do cố vấn học tập cấp) lập đơn trực tuyến, ký điện tử,
   gửi cố vấn học tập; đơn đi qua các bước duyệt cấu hình theo từng thủ tục.
   Firestore: pna_tt_settings/{thutuc|nguoiduyet} · pna_lop/{mã lớp} · pna_sv/{email}
              pna_don/{id} (+ /tep/{id}: tệp minh chứng) · pna_chuky/{email}
   Chữ ký: chữ ký điện tử nội bộ (hình chữ ký + tài khoản đăng nhập + thời điểm + mã băm nội dung);
   không thay thế chữ ký số do tổ chức cung cấp dịch vụ chứng thực cấp. Có ô gắn bản PDF đã ký số.
   ===================================================================== */
import { doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, collection, getDocs, query, where, writeBatch } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { THU_TUC, STEP_ROLES, TT_VER, HV, KHOA_QL, MAU_QC } from "./thutuc-data.js?v=20261128x";

const P = window.PNA;
const db = P.db, esc = P.esc;
const $ = s => document.querySelector(s);
const MAX_FILES = 5, MAX_FILE_B64 = 900000;   // mỗi tệp một bản ghi Firestore (< 1 MB)

/* ---------- Trạng thái ---------- */
const ST = {
  "cho-duyet": ["Đang xử lý", "#1d4ed8", "#e0ecff"],
  "bo-sung": ["Cần bổ sung", "#b45309", "#fdf1dc"],
  "da-duyet": ["Đã duyệt", "#15803d", "#e3f4e8"],
  "tu-choi": ["Không duyệt", "#b3261e", "#fbe6e4"],
  "rut": ["Đã rút", "#5f6672", "#eef0f3"]
};
const ACT = { nop: "Nộp đơn", "gui-lai": "Bổ sung, gửi lại", duyet: "Đồng ý", "bo-sung": "Yêu cầu bổ sung", "tu-choi": "Không duyệt", rut: "Rút đơn", "ky-so": "Gắn bản đã ký số" };
let CFG = null;          // danh sách thủ tục đang dùng
let ND = { khoa: [], qldt: [] };   // người duyệt các bước Khoa, Ban QLĐT (email)
let ME = { email: "", sv: null, lops: [], saved: null };
let loadKey = null, loadP = null, pendingN = 0;

const myEmail = () => (P.user && !P.user.isAnonymous && P.user.email || "").toLowerCase();
const isAdmin = () => P.isAdmin;
const isCvhtRole = () => !!(P.acct && P.acct.role === "cvht" && !P.acct.disabled);
const isCvht = () => isCvhtRole() || ME.lops.length > 0;
const ndRoles = () => ["khoa", "qldt"].filter(k => (ND[k] || []).includes(myEmail()));
const isApprover = () => isAdmin() || isCvht() || ndRoles().length > 0;
const ttOf = key => (CFG || THU_TUC).find(t => t.key === key);
const fmtDT = s => { if (!s) return ""; const d = new Date(s); return isNaN(d) ? String(s) : d.toLocaleDateString("vi-VN") + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); };
const fmtD = s => { if (!s) return ""; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s); };
const stChip = d => { const s = ST[d.status] || ST["cho-duyet"]; return `<span class="tt-st" style="color:${s[1]};background:${s[2]}">${s[0]}</span>`; };
const stepName = r => (STEP_ROLES[r] || { name: r }).name;
function navRow() { return `<div class="nav-row"><button type="button" class="pill" data-back>QUAY LẠI</button><button type="button" class="pill home-pill" data-go="tt">THỦ TỤC SINH VIÊN</button></div>`; }
function page(title, body) { $("#main").innerHTML = `<section class="box tt-page"><h2 class="box-title">${title}</h2>${body}</section>${navRow()}`; window.scrollTo(0, 0); }
async function sha(text) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
const newMa = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return "HS" + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(); };
const contentOf = d => JSON.stringify({ ma: d.ma, tt: d.tt, sv: { mssv: d.sv.mssv, hoTen: d.sv.hoTen, lop: d.sv.lop }, data: d.data, lyDo: d.lyDo, links: d.links || [], created: d.created });

/* ---------- Nạp dữ liệu theo người dùng ---------- */
function load(force) {
  const who = myEmail() + "|" + (P.acct ? P.acct.role : "") + "|" + isAdmin();
  if (!force && loadKey === who && loadP) return loadP;
  loadKey = who;
  return (loadP = loadNow());
}
async function loadNow() {
  try { const s = await getDoc(doc(db, "pna_tt_settings", "thutuc")); CFG = s.exists() && Array.isArray(s.data().list) && s.data().ver === TT_VER ? s.data().list : THU_TUC.map(t => ({ ...t, active: true })); }
  catch (e) { CFG = THU_TUC.map(t => ({ ...t, active: true })); }
  try { const s = await getDoc(doc(db, "pna_tt_settings", "nguoiduyet")); ND = s.exists() ? { khoa: s.data().khoa || [], qldt: s.data().qldt || [] } : { khoa: [], qldt: [] }; } catch (e) {}
  ME = { email: myEmail(), sv: null, lops: [], saved: null };
  if (ME.email) {
    try { const s = await getDoc(doc(db, "pna_sv", ME.email)); if (s.exists()) ME.sv = s.data(); } catch (e) {}
    try { (await getDocs(query(collection(db, "pna_lop"), where("cvht", "array-contains", ME.email)))).forEach(d => ME.lops.push({ id: d.id, ...d.data() })); } catch (e) {}
  }
  pendingN = 0;
  if (isApprover()) try { pendingN = (await fetchDons("duyet")).filter(mustAct).length; } catch (e) {}
  renderBox();
}
function mustAct(d) {
  if (d.status !== "cho-duyet") return false;
  if (d.stepRole === "cvht") return (d.cvht || []).includes(myEmail()) || isAdmin();
  return ndRoles().includes(d.stepRole) || isAdmin();
}
async function fetchDons(kind) {
  const out = {}, put = snap => snap.forEach(x => out[x.id] = { id: x.id, ...x.data() });
  if (kind === "cua-toi") { put(await getDocs(query(collection(db, "pna_don"), where("sv.email", "==", myEmail())))); }
  else if (isAdmin() || ndRoles().length) put(await getDocs(collection(db, "pna_don")));
  else if (isCvht()) put(await getDocs(query(collection(db, "pna_don"), where("cvht", "array-contains", myEmail()))));
  return Object.values(out).sort((a, b) => String(b.updated || b.created).localeCompare(String(a.updated || a.created)));
}

/* ---------- Khung bên phải ---------- */
function renderBox() {
  const col = $("#toolsCol"); if (!col) return;
  let box = $("#ttBox");
  if (!box) { box = document.createElement("section"); box.className = "sbox"; box.id = "ttBox"; const first = col.querySelector(".sbox"); first ? first.after(box) : col.prepend(box); }
  const list = (CFG || THU_TUC).filter(t => t.active !== false);
  const acts = [];
  if (ME.sv) acts.push(`<button type="button" class="sbtn" data-go="tt-cua-toi">Đơn của tôi</button>`);
  if (isApprover()) acts.push(`<button type="button" class="sbtn primary" data-go="tt-duyet">Đơn cần xử lý${pendingN ? ` <span class="tt-n">${pendingN}</span>` : ""}</button>`);
  if (isCvht() || isAdmin()) acts.push(`<button type="button" class="sbtn" data-go="tt-lop">Lớp & tài khoản sinh viên</button>`);
  if (isAdmin()) acts.push(`<button type="button" class="sbtn" data-go="tt-cau-hinh">Cấu hình thủ tục, người duyệt</button>`);
  box.innerHTML = `<h3 class="sbox-title">THỦ TỤC SINH VIÊN</h3>
    <p class="muted" style="margin:-4px 0 10px">Lập đơn trực tuyến, ký điện tử và gửi cố vấn học tập phê duyệt.</p>
    <div class="tt-links">${list.slice(0, 7).map(t => `<a href="#tt/${esc(t.key)}"><span class="tt-dot"></span>${esc(t.ten)}</a>`).join("")}</div>
    <button type="button" class="sbtn" data-go="tt" style="margin-top:8px">Tất cả thủ tục (${list.length})</button>${acts.join("")}`;
}

/* ---------- Danh mục thủ tục ---------- */
function renderCatalog() {
  const list = (CFG || THU_TUC).filter(t => t.active !== false || isAdmin());
  const groups = {};
  list.forEach(t => (groups[t.nhom || "Khác"] = groups[t.nhom || "Khác"] || []).push(t));
  const who = !myEmail() ? `<p class="tt-note">Sinh viên đăng nhập bằng tài khoản do cố vấn học tập cấp để lập đơn. <button type="button" class="linkish" data-login>Đăng nhập</button></p>`
    : ME.sv ? `<p class="tt-note">Xin chào <b>${esc(ME.sv.hoTen)}</b> — lớp ${esc(ME.sv.lop)}. Chọn thủ tục cần làm. <a href="#tt-cua-toi">Xem đơn đã gửi</a></p>`
    : isApprover() ? `<p class="tt-note">Bạn đang đăng nhập với vai trò người duyệt. <a href="#tt-duyet">Đơn cần xử lý</a></p>`
    : `<p class="tt-note">Tài khoản này chưa có hồ sơ sinh viên. Liên hệ cố vấn học tập để được cấp.</p>`;
  page("Thủ tục sinh viên", who + Object.entries(groups).map(([g, ts]) => `<h3 class="tt-h3">${esc(g)}</h3><div class="tt-cards">${ts.map(t => `
    <a class="tt-card${t.active === false ? " off" : ""}" href="#tt/${esc(t.key)}"><b>${esc(t.ten)}</b>
      <span class="tt-flow">${(t.steps || []).map(stepName).map(esc).join(" → ") || "—"}</span>
      ${t.canCu ? `<small>${esc(t.canCu)}</small>` : ""}${t.active === false ? `<small><i>Đang tắt</i></small>` : ""}</a>`).join("")}</div>`).join(""));
}

/* ---------- Chữ ký ---------- */
function sigPad(host, saved) {
  host.innerHTML = `<div class="sig-wrap"><canvas class="sig-cv"></canvas><span class="sig-ph">Ký vào đây (chuột, bút cảm ứng hoặc ngón tay)</span></div>
    <div class="sig-act"><button type="button" class="btn" data-sigclear>Xóa, ký lại</button>${saved ? `<button type="button" class="btn" data-sigsaved>Dùng chữ ký đã lưu</button>` : ""}
    <label class="fld chk inline"><input type="checkbox" class="sig-keep"${saved ? "" : " checked"}><span>Lưu làm chữ ký mẫu cho lần sau</span></label></div>`;
  const cv = host.querySelector("canvas"), ph = host.querySelector(".sig-ph"), ctx = cv.getContext("2d");
  let strokes = 0, box = null, img = null;
  const fit = () => { const w = Math.min(host.clientWidth || 460, 520), r = window.devicePixelRatio || 1; cv.width = w * r; cv.height = 170 * r; cv.style.width = w + "px"; cv.style.height = "170px"; ctx.setTransform(r, 0, 0, r, 0, 0); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 2.4; ctx.strokeStyle = "#0b2a6b"; };
  fit();
  let down = false, last = null;
  const pt = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const grow = ([x, y]) => { box = box ? [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)] : [x, y, x, y]; };
  cv.addEventListener("pointerdown", e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); down = true; last = pt(e); grow(last); ph.hidden = true; img = null; ctx.beginPath(); ctx.arc(last[0], last[1], 1.1, 0, 7); ctx.fillStyle = "#0b2a6b"; ctx.fill(); strokes++; });
  cv.addEventListener("pointermove", e => { if (!down) return; const p = pt(e); ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); last = p; grow(p); });
  const up = () => { down = false; };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  cv.style.touchAction = "none";
  const clear = () => { ctx.clearRect(0, 0, cv.width, cv.height); strokes = 0; box = null; img = null; ph.hidden = false; };
  host.querySelector("[data-sigclear]").onclick = clear;
  const useSaved = () => { clear(); const i = new Image(); i.onload = () => { const w = parseFloat(cv.style.width), h = 170, s = Math.min((w - 20) / i.width, (h - 20) / i.height, 1.6); ctx.drawImage(i, (w - i.width * s) / 2, (h - i.height * s) / 2, i.width * s, i.height * s); }; i.src = saved; img = saved; ph.hidden = true; };
  if (saved) host.querySelector("[data-sigsaved]").onclick = useSaved;
  return {
    empty: () => !img && (!strokes || !box || (box[2] - box[0] < 12 && box[3] - box[1] < 12)),
    keep: () => host.querySelector(".sig-keep").checked,
    get() {
      if (img) return img;
      if (this.empty()) return null;
      const r = window.devicePixelRatio || 1, pad = 6;
      const x = Math.max(0, box[0] - pad) * r, y = Math.max(0, box[1] - pad) * r, w = Math.min(cv.width - x, (box[2] - box[0] + pad * 2) * r), h = Math.min(cv.height - y, (box[3] - box[1] + pad * 2) * r);
      const H = 90, W = Math.max(1, Math.round(w * H / h)), o = document.createElement("canvas");
      o.width = Math.min(W, 360); o.height = Math.round(H * o.width / W);
      o.getContext("2d").drawImage(cv, x, y, w, h, 0, 0, o.width, o.height);
      return o.toDataURL("image/png");
    }
  };
}
async function savedSig() {
  if (ME.saved !== null) return ME.saved;
  try { const s = await getDoc(doc(db, "pna_chuky", myEmail())); ME.saved = s.exists() ? s.data().img : ""; } catch (e) { ME.saved = ""; }
  return ME.saved;
}
async function keepSig(pad, img) { if (pad.keep() && img && img !== ME.saved) try { await setDoc(doc(db, "pna_chuky", myEmail()), { img, updated: new Date().toISOString() }); ME.saved = img; } catch (e) {} }

/* ---------- Trường nhập ---------- */
function fieldHTML(f, v) {
  const id = "ttf_" + f.k, req = f.req ? " required" : "", star = f.req ? ' <b class="req">*</b>' : "";
  if (f.type === "table") {
    const rows = Array.isArray(v) && v.length ? v : [f.cols.map(() => "")];
    return `<div class="fld tt-tbl" data-k="${esc(f.k)}" data-type="table"><span>${esc(f.label)}${star}</span>
      <div class="tbl-wrap"><table class="adm-table ftbl"><thead><tr>${f.cols.map(c => `<th>${esc(c)}</th>`).join("")}<th></th></tr></thead>
      <tbody>${rows.map(r => rowHTML(f.cols, r)).join("")}</tbody></table></div>
      <button type="button" class="btn" data-ttaddrow style="align-self:flex-start;margin-top:4px">＋ Thêm dòng</button></div>`;
  }
  const hint = f.hint ? `<small class="muted">${esc(f.hint)}</small>` : "";
  if (f.type === "textarea") return `<label class="fld" data-k="${esc(f.k)}"><span>${esc(f.label)}${star}</span><textarea id="${id}" rows="3"${req}>${esc(v || "")}</textarea>${hint}</label>`;
  if (f.type === "select" || f.type === "check") return `<label class="fld" data-k="${esc(f.k)}"><span>${esc(f.label)}${star}</span><select id="${id}"${req}><option value="">— Chọn —</option>${(f.opts || []).map(o => `<option${o === v ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>${hint}</label>`;
  const type = f.type === "date" ? "date" : f.type === "number" ? "number\" step=\"any" : "text";
  return `<label class="fld" data-k="${esc(f.k)}"><span>${esc(f.label)}${star}</span><input id="${id}" type="${type}" value="${esc(v || "")}"${req}>${hint}</label>`;
}
const rowHTML = (cols, r) => `<tr>${cols.map((c, i) => `<td><input aria-label="${esc(c)}" value="${esc(r[i] || "")}"></td>`).join("")}<td><button type="button" class="linkish" data-ttdelrow title="Xóa dòng">✕</button></td></tr>`;
function readFields(t, form) {
  const data = {}, miss = [];
  for (const f of t.fields || []) {
    if (f.type === "table") {
      const rows = [...form.querySelectorAll(`[data-k="${CSS.escape(f.k)}"] tbody tr`)].map(tr => [...tr.querySelectorAll("input")].map(i => i.value.trim())).filter(r => r.some(Boolean));
      data[f.k] = rows; if (f.req && !rows.length) miss.push(f.label);
    } else {
      const el = form.querySelector("#ttf_" + CSS.escape(f.k)); const v = el ? el.value.trim() : "";
      data[f.k] = v; if (f.req && !v) miss.push(f.label);
    }
  }
  return { data, miss };
}
/* Tệp minh chứng: ảnh nén lại; PDF giữ nguyên nếu đủ nhỏ */
async function fileToData(file) {
  if (file.type.startsWith("image/")) {
    const url = URL.createObjectURL(file);
    try {
      const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      let q = 0.78, max = 1600, out;
      for (let k = 0; k < 5; k++) {
        const s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        out = c.toDataURL("image/jpeg", q); if (out.length < MAX_FILE_B64) break; q -= 0.12; max = Math.round(max * 0.8);
      }
      return { ten: file.name.replace(/\.\w+$/, "") + ".jpg", loai: "image/jpeg", data: out };
    } finally { URL.revokeObjectURL(url); }
  }
  const data = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
  if (data.length > MAX_FILE_B64) throw new Error(`Tệp “${file.name}” quá lớn (tối đa khoảng 650 KB). Hãy nén PDF hoặc chụp ảnh, hoặc gửi đường link Google Drive.`);
  return { ten: file.name, loai: file.type || "application/octet-stream", data };
}

/* ---------- Lập đơn / bổ sung đơn ---------- */
async function renderForm(key, editId) {
  let t = ttOf(key), old = null;
  if (editId) {
    const s = await getDoc(doc(db, "pna_don", editId)); if (!s.exists()) return page("Không tìm thấy đơn", "");
    old = { id: s.id, ...s.data() }; t = { ...(ttOf(old.tt) || {}), ...old.form, key: old.tt, ten: old.ttTen };
  }
  if (!t) return page("Không tìm thấy thủ tục", `<p class="empty">Thủ tục này không còn hoặc đã đổi tên.</p>`);
  const info = `<div class="tt-info">
      ${t.canCu ? `<p><b>Căn cứ:</b> ${esc(t.canCu)}</p>` : ""}
      ${t.mau && t.mau.pl ? `<p><b>Mẫu đơn:</b> ${esc(t.mau.pl)} ${esc(MAU_QC)} (tên cơ quan, thể thức theo ${esc(HV)}).</p>` : ""}
      ${t.huongDan ? `<p><b>Điều kiện, thời hạn:</b> ${esc(t.huongDan)}</p>` : ""}
      ${t.minhChung ? `<p><b>Hồ sơ, minh chứng kèm theo:</b> ${esc(t.minhChung)}</p>` : ""}
      <p><b>Trình tự xử lý trên hệ thống:</b> Sinh viên nộp đơn → ${(t.steps || []).map(r => esc(stepName(typeof r === "string" ? r : r.role))).join(" → ")} → hoàn tất (in hoặc lưu PDF đơn đã duyệt).</p></div>`;
  if (!myEmail()) return page(esc(t.ten), info + `<p class="tt-note">Đăng nhập bằng tài khoản sinh viên do cố vấn học tập cấp để lập đơn. <button type="button" class="pill" data-login>Đăng nhập</button></p>`);
  if (!ME.sv) return page(esc(t.ten), info + `<p class="tt-note">Tài khoản <b>${esc(P.showName(myEmail()))}</b> chưa có hồ sơ sinh viên nên chưa lập đơn được. Liên hệ cố vấn học tập của lớp.</p>`);
  if (!editId && t.active === false) return page(esc(t.ten), info + `<p class="tt-note">Thủ tục này đang tạm dừng nhận đơn trực tuyến.</p>`);
  if (old && (old.sv.email !== myEmail() || old.status !== "bo-sung")) return go("tt-don/" + old.id);
  const sv = ME.sv, v = old ? old.data || {} : {}, lyMode = t.mau ? (t.mau.lyDo === undefined ? true : t.mau.lyDo) : true;
  const lastReq = old ? [...(old.history || [])].reverse().find(h => h.act === "bo-sung") : null;
  page(esc(t.ten), info + (lastReq ? `<p class="tt-warn"><b>Yêu cầu bổ sung của ${esc(lastReq.name || lastReq.by)}:</b> ${esc(lastReq.note || "")}</p>` : "") + `
    <form id="ttForm" class="tt-form" novalidate>
      <h3 class="tt-h3">1. Thông tin sinh viên</h3>
      <div class="tt-sv">${[["Họ và tên", sv.hoTen], ["Mã sinh viên", sv.mssv], ["Ngày sinh", fmtD(sv.ngaySinh)], ["Lớp", sv.lop], ["Ngành", sv.nganh || ""], ["Khóa", sv.khoa || ""]].map(([a, b]) => `<div><span>${a}</span><b>${esc(b || "—")}</b></div>`).join("")}</div>
      <div class="grid2" style="max-width:680px"><label class="fld"><span>Số điện thoại liên hệ <b class="req">*</b></span><input id="ttSdt" value="${esc(old ? old.sv.sdt || "" : sv.sdt || "")}" inputmode="tel"></label>
      <label class="fld"><span>Email liên hệ</span><input id="ttEmail" type="email" value="${esc(old ? old.sv.emailLH || "" : sv.emailLienHe || (String(sv.email || "").endsWith("@" + P.ACCT_DOMAIN) ? "" : sv.email || ""))}"></label></div>
      <h3 class="tt-h3">2. Nội dung đề nghị</h3>
      <div class="tt-fields">${(t.fields || []).map(f => fieldHTML(f, v[f.k])).join("")}</div>
      ${lyMode === false ? "" : `<label class="fld"><span>${lyMode === "opt" ? "Lý do (nếu có)" : "Lý do"}${lyMode === "opt" ? "" : ' <b class="req">*</b>'}</span><textarea id="ttLyDo" rows="3">${esc(old ? old.lyDo : "")}</textarea></label>`}
      <h3 class="tt-h3">3. Minh chứng kèm theo</h3>
      ${t.minhChung ? `<p class="muted" style="margin-top:-4px">${esc(t.minhChung)}</p>` : ""}
      <label class="fld"><span>Tải tệp (ảnh chụp hoặc PDF, tối đa ${MAX_FILES} tệp, mỗi tệp dưới khoảng 650 KB)</span><input type="file" id="ttFiles" multiple accept="image/*,application/pdf"></label>
      ${old && old.nTep ? `<p class="muted">Đơn đã có ${old.nTep} tệp đính kèm; tệp mới sẽ được thêm vào.</p>` : ""}
      <label class="fld"><span>Hoặc dán đường link (Google Drive…) — mỗi dòng một link</span><textarea id="ttLinks" rows="2">${esc(old ? (old.links || []).join("\n") : "")}</textarea></label>
      <h3 class="tt-h3">4. Cam đoan và ký đơn</h3>
      <label class="fld chk inline"><input type="checkbox" id="ttCamDoan"><span>Tôi cam đoan những thông tin trong đơn là đúng sự thật và chịu trách nhiệm trước Học viện về nội dung đã khai.</span></label>
      <div id="ttSig"></div>
      <p class="err" id="ttErr" role="alert"></p>
      <div class="dlg-act" style="justify-content:flex-start"><button type="button" class="btn" id="ttPreview">Xem trước đơn</button><button type="submit" class="btn primary" id="ttSend">${old ? "Gửi lại đơn đã bổ sung" : "Ký và gửi đơn"}</button></div>
    </form>`);
  const form = $("#ttForm"), pad = sigPad($("#ttSig"), await savedSig());
  const collect = () => {
    const { data, miss } = readFields(t, form);
    const lyDo = $("#ttLyDo") ? $("#ttLyDo").value.trim() : "", sdt = $("#ttSdt").value.trim(), emailLH = $("#ttEmail").value.trim();
    if (!sdt) miss.unshift("Số điện thoại liên hệ");
    if (!lyDo && lyMode === true) miss.push("Lý do");
    const links = $("#ttLinks").value.split(/\n+/).map(s => s.trim()).filter(Boolean);
    const bad = links.find(l => !/^https?:\/\//i.test(l));
    return { data, miss, lyDo, sdt, emailLH, links, bad };
  };
  const draft = (c, sig) => ({
    ma: old ? old.ma : "(cấp khi gửi)", tt: t.key, ttTen: t.ten, form: { tieuDe: t.tieuDe, kinhGui: t.kinhGui, canCu: t.canCu, fields: t.fields || [], ...(t.mau ? { mau: t.mau } : {}) },
    sv: { email: myEmail(), mssv: sv.mssv, hoTen: sv.hoTen, ngaySinh: sv.ngaySinh || "", lop: sv.lop, nganh: sv.nganh || "", khoa: sv.khoa || "", sdt: c.sdt, emailLH: c.emailLH },
    data: c.data, lyDo: c.lyDo, links: c.links, steps: (t.steps || []).map(r => typeof r === "string" ? { role: r, name: stepName(r) } : r),
    svSig: sig ? { img: sig, at: new Date().toISOString() } : null, history: [], status: "nhap", created: old ? old.created : new Date().toISOString()
  });
  $("#ttPreview").onclick = () => { const c = collect(); showSheetDialog(draft(c, pad.get())); };
  form.onsubmit = async e => {
    e.preventDefault();
    const err = $("#ttErr"); err.textContent = "";
    const c = collect();
    if (c.miss.length) return err.textContent = "Còn thiếu: " + c.miss.join(", ") + ".";
    if (c.bad) return err.textContent = "Đường link phải bắt đầu bằng http:// hoặc https:// (" + c.bad + ").";
    if (!$("#ttCamDoan").checked) return err.textContent = "Hãy đánh dấu ô cam đoan.";
    const sig = pad.get(); if (!sig) return err.textContent = "Hãy ký vào ô chữ ký.";
    const files = [...$("#ttFiles").files];
    if (files.length + (old ? old.nTep || 0 : 0) > MAX_FILES) return err.textContent = `Tối đa ${MAX_FILES} tệp đính kèm.`;
    const btn = $("#ttSend"); btn.disabled = true; btn.textContent = "Đang gửi…";
    try {
      const tep = []; for (const f of files) tep.push(await fileToData(f));
      const now = new Date().toISOString(), d = draft(c, sig);
      d.ma = old ? old.ma : newMa(); d.created = old ? old.created : now;
      const hash = (await sha(contentOf(d))).slice(0, 16).toUpperCase();
      d.svSig = { img: sig, at: now, hash };
      const entry = { at: now, by: myEmail(), name: sv.hoTen, role: "sv", act: old ? "gui-lai" : "nop", note: "", hash };
      if (!d.steps.length) throw new Error("Thủ tục chưa được cấu hình bước duyệt. Liên hệ quản trị viên.");
      let id;
      if (old) {
        id = old.id;
        await updateDoc(doc(db, "pna_don", id), { data: d.data, lyDo: d.lyDo, links: d.links, "sv": { ...old.sv, sdt: c.sdt, emailLH: c.emailLH }, svSig: d.svSig, status: "cho-duyet", step: 0, stepRole: old.steps[0].role, history: [...(old.history || []), entry], updated: now, nTep: (old.nTep || 0) + tep.length, hash });
      } else {
        Object.assign(d, { status: "cho-duyet", step: 0, stepRole: d.steps[0].role, history: [entry], lop: sv.lop, cvht: sv.cvht || [], updated: now, nTep: tep.length, hash });
        id = (await addDoc(collection(db, "pna_don"), d)).id;
      }
      for (const x of tep) await addDoc(collection(db, "pna_don", id, "tep"), { ...x, by: myEmail(), at: now });
      await keepSig(pad, sig);
      P.logAct(old ? "TT_GUI_LAI" : "TT_NOP", d.ma + " · " + t.ten);
      P.toast(old ? "Đã gửi lại đơn " + d.ma + "." : "Đã gửi đơn " + d.ma + " tới cố vấn học tập.");
      load(true);
      go("tt-don/" + id);
    } catch (x) { err.textContent = "Chưa gửi được: " + x.message; btn.disabled = false; btn.textContent = old ? "Gửi lại đơn đã bổ sung" : "Ký và gửi đơn"; }
  };
}

/* ---------- Mẫu đơn A4 (xem, in, lưu PDF) ---------- */
function cellVal(f, v) {
  if (f.type === "table") return Array.isArray(v) && v.length ? `<table class="a4-tbl"><thead><tr><th>TT</th>${f.cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${v.map((r, i) => `<tr><td>${i + 1}</td>${f.cols.map((c, j) => `<td>${esc(r[j] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "<i>(không có)</i>";
  return esc(f.type === "date" ? fmtD(v) : v || "");
}
const DOTS = "……………………";
/* Phần đầu đơn theo thể thức Học viện Hành chính và Quản trị công (sau hợp nhất) */
const headHTML = made => `<div class="a4-hd"><div class="a4-hl">HỌC VIỆN CHÍNH TRỊ QUỐC GIA<br>HỒ CHÍ MINH<br><b>HỌC VIỆN HÀNH CHÍNH<br>VÀ QUẢN TRỊ CÔNG</b><br><b>*</b></div>
  <div class="a4-hr"><b class="u">ĐẢNG CỘNG SẢN VIỆT NAM</b><i>Hà Nội, ngày ${made.getDate()} tháng ${made.getMonth() + 1} năm ${made.getFullYear()}</i></div></div>`;
function sheetHTML(d) {
  const fm = d.form || {}, sv = d.sv || {}, made = new Date(d.created || Date.now()), M = fm.mau, data = d.data || {};
  const sigBlock = (title, s, who, sub) => `<div class="a4-sig"><b>${esc(title)}</b><i>${sub ? esc(sub) : "(Ký và ghi rõ họ tên)"}</i>
    <div class="a4-sigimg">${s && s.img ? `<img src="${s.img}" alt="Chữ ký">` : ""}</div><b>${esc(who || "")}</b>
    ${s && s.at ? `<small>Ký điện tử lúc ${fmtDT(s.at)}${s.hash ? `<br>Mã xác thực: ${esc(s.hash)}` : ""}</small>` : ""}</div>`;
  const stepSig = (i, title, sub) => {
    const h = [...(d.history || [])].reverse().find(x => x.step === i && ["duyet", "tu-choi"].includes(x.act));
    const op = h ? `<p class="a4-op">${h.act === "duyet" ? "Đồng ý" : "Không đồng ý"}${h.note ? ": " + esc(h.note) : "."}</p>` : `<p class="a4-op muted">(Chưa xử lý)</p>`;
    return `<div class="a4-step">${sigBlock(title, h ? { img: h.sig, at: h.at, hash: h.hash } : null, h ? h.name : "", sub)}${op}</div>`;
  };
  const fOf = k => (fm.fields || []).find(f => f.k === k);
  const val = k => {
    if (k === "KHOA") return KHOA_QL; if (k === "HV") return HV; if (k === "GD") return "Giám đốc " + HV;
    if (k === "lyDo") return d.lyDo || "";
    const f = fOf(k), v = data[k]; if (v == null || v === "") return "";
    return f && f.type === "date" ? fmtD(v) : String(v);
  };
  const boxes = (k, block) => { const f = fOf(k) || { opts: [] }, v = data[k]; const items = (f.opts || []).map(o => `<span class="a4-box">${o === v ? "☒" : "☐"} ${esc(o)}</span>`); return block ? `<div class="a4-boxes">${items.join("")}</div>` : items.join(" "); };
  const mcHTML = () => { const n = d.nTep || 0, L = d.links || []; const rows = [...L.map(l => esc(l)), ...(n ? [n + " tệp minh chứng đính kèm (lưu trên hệ thống)"] : [])]; return rows.length ? `<ol class="a4-mc">${rows.map(r => `<li>${r}</li>`).join("")}</ol>` : `<p class="l">1. ${DOTS}</p>`; };
  const fill = str => esc(str).replace(/\{\^(\w+)\}/g, (m, k) => esc(val(k).toUpperCase()) || DOTS).replace(/\{\?(\w+)\}/g, (m, k) => boxes(k, false)).replace(/\{(\w+)\}/g, (m, k) => esc(val(k)) || DOTS);
  const para = p => {
    let m;
    if ((m = /^\{#(\w+)\}$/.exec(p))) { const f = fOf(m[1]); return f ? cellVal(f, data[m[1]]) : ""; }
    if ((m = /^\{\?(\w+)\}$/.exec(p))) return boxes(m[1], true);
    if (p === "{minhChung}") return mcHTML();
    if (p.startsWith("!!")) return `<p class="a4-sub">${fill(p.slice(2))}</p>`;
    if (/\{lyDo\}/.test(p) && !d.lyDo && M && M.lyDo === "opt") return "";
    return `<p>${fill(p)}</p>`;
  };
  const kg = String(fm.kinhGui || "").split(";").map(x => x.trim()).filter(Boolean).map(x => fill(x));
  const kgHTML = kg.length > 1 ? `<div class="a4-kg2"><b>Kính gửi:</b><div>${kg.map((x, i) => `<p>- ${x}${i < kg.length - 1 ? ";" : "."}</p>`).join("")}</div></div>` : `<p class="a4-kg"><b>Kính gửi:</b> ${kg[0] || ""}</p>`;
  const email = sv.emailLH || (String(sv.email || "").endsWith("@" + P.ACCT_DOMAIN) ? "" : sv.email || "");
  const svInfo = `<p class="l">Họ và tên sinh viên: <b>${esc(sv.hoTen)}</b>&emsp;Mã số sinh viên: <b>${esc(sv.mssv)}</b></p>
    <p class="l">Ngày sinh: ${esc(fmtD(sv.ngaySinh)) || DOTS}&emsp;Ngành: ${esc(sv.nganh || "") || DOTS}&emsp;Khoa: ${esc(KHOA_QL)}</p>
    <p class="l">Lớp: ${esc(sv.lop)}&emsp;Khóa học: ${esc(sv.khoa || "") || DOTS}</p>
    <p class="l">Điện thoại liên hệ: ${esc(sv.sdt || "") || DOTS}&emsp;Email: ${esc(email) || DOTS}</p>`;
  let body, sigs;
  if (M) {
    body = (M.them || []).map(x => `<p class="l">${fill(x)}</p>`).join("") + (M.body || []).map(para).join("");
    const steps = d.steps || [], used = new Set(), list = [];
    (M.sigs || []).forEach(g => {
      const t = fill(g.t).replace(/……………………/g, "");
      if (g.role === "sv") list.push(sigBlock(t, d.svSig, sv.hoTen, g.sub || "(Ký và ghi rõ họ tên)"));
      else { const i = g.role ? steps.findIndex(x => x.role === g.role) : -1;
        if (i >= 0) { used.add(i); list.push(stepSig(i, t, g.sub)); } else list.push(`<div class="a4-sig a4-blank"><b>${t}</b><i>${esc(g.sub || "(Ký và ghi rõ họ tên)")}</i><div class="a4-sigimg"></div></div>`); }
    });
    const extra = []; steps.forEach((st, i) => { if (!used.has(i)) extra.push(stepSig(i, (STEP_ROLES[st.role] || { sign: "Ý KIẾN CỦA " + st.name.toUpperCase() }).sign)); });
    if ((M.sigs || []).length === 1) list.unshift(...extra); else list.push(...extra);   // đơn chỉ có chữ ký người làm đơn: người làm đơn ở cuối (bên phải)
    sigs = `<div class="a4-sigs${M.cols === 3 || (list.length === 3 && [1, 3].includes((M.sigs || []).length)) ? " c3" : ""}">${list.join("")}</div>`;
    if (M.kiemTra) sigs += `<div class="a4-kt"><p class="a4-sub">Phần dành cho bộ phận kiểm tra, giải quyết</p><p>Họ tên người nhận đơn: ${DOTS}${DOTS}</p><p>Ngày nhận: ……/……/………… Ký tên: ${DOTS}</p><p>Họ tên người kiểm tra: ${DOTS}${DOTS}</p><p>Ngày trả kết quả: ……/……/…………</p><p>Kết quả: Đủ điều kiện ☐; Không đủ điều kiện ☐; Ký tên: ${DOTS}</p><p>Ý kiến khác: ${DOTS}${DOTS}${DOTS}</p><p>Ý kiến lãnh đạo Ban Quản lý đào tạo: ${DOTS}${DOTS} Ký tên: ${DOTS} ngày ……/……/…………</p></div>`;
  } else {
    body = `${fm.canCu ? `<p>Căn cứ ${esc(fm.canCu)},</p>` : ""}
    <p>Em làm đơn này kính đề nghị ${esc((fm.kinhGui || "").split(";")[0] || "Học viện")} xem xét, giải quyết nội dung sau:</p>
    ${(fm.fields || []).map(f => f.type === "table" ? `<p>- ${esc(f.label)}:</p>${cellVal(f, data[f.k])}` : `<p>- ${esc(f.label)}: ${cellVal(f, data[f.k])}</p>`).join("")}
    <p>- Lý do: ${esc(d.lyDo || "")}</p>
    ${(d.nTep || (d.links || []).length) ? `<p>- Hồ sơ kèm theo:</p>${mcHTML()}` : ""}
    <p>Em cam đoan những thông tin trên là đúng sự thật và xin chịu trách nhiệm trước Học viện. Kính mong được xem xét, giải quyết.</p>`;
    sigs = `<div class="a4-sigs">${(d.steps || []).map((st, i) => stepSig(i, (STEP_ROLES[st.role] || { sign: "Ý KIẾN CỦA " + st.name.toUpperCase() }).sign)).join("")}${sigBlock("NGƯỜI LÀM ĐƠN", d.svSig, sv.hoTen)}</div>`;
  }
  return `<article class="a4">${headHTML(made)}
    <h1>${fill(fm.tieuDe || d.ttTen || "ĐƠN ĐỀ NGHỊ")}</h1>${M && M.tieuDe2 ? `<p class="a4-t2">${fill(M.tieuDe2)}</p>` : ""}
    ${kgHTML}${svInfo}${body}${sigs}
    <footer class="a4-ft">Mã hồ sơ: <b>${esc(d.ma || "")}</b>${d.hash ? ` · Mã băm nội dung: ${esc(d.hash)}` : ""}${M && M.pl ? ` · Mẫu: ${esc(M.pl)} ${esc(MAU_QC)}` : ""} · Lập và ký điện tử trên Hệ thống cố vấn học tập. Chữ ký điện tử nội bộ gắn với tài khoản đăng nhập, thời điểm ký và mã băm nội dung; không thay thế chữ ký số khi văn bản bắt buộc ký số.</footer>
  </article>`;
}
function showSheetDialog(d) {
  let dlg = $("#ttDlg");
  if (!dlg) { dlg = document.createElement("dialog"); dlg.id = "ttDlg"; dlg.className = "dlg xwide"; document.body.append(dlg); }
  dlg.innerHTML = `<div class="dlg-in"><h3>XEM TRƯỚC ĐƠN</h3><div class="a4-host">${sheetHTML(d)}</div><div class="dlg-act"><button type="button" class="btn" id="ttDlgPrint">In / Lưu PDF</button><button type="button" class="btn primary" id="ttDlgClose">Đóng</button></div></div>`;
  $("#ttDlgClose").onclick = () => dlg.close();
  $("#ttDlgPrint").onclick = () => { dlg.close(); printSheet(sheetHTML(d), d.ma); };
  dlg.showModal();
}
function printSheet(html, ma) {
  let host = $("#ttPrintHost"); if (!host) { host = document.createElement("div"); host.id = "ttPrintHost"; document.body.append(host); }
  host.innerHTML = html; document.body.classList.add("tt-print");
  const t0 = document.title; document.title = "Don_" + (ma || "PNA");
  const done = () => { document.body.classList.remove("tt-print"); host.innerHTML = ""; document.title = t0; window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  setTimeout(() => window.print(), 60);
}

/* ---------- Xem đơn, xử lý ---------- */
async function renderDon(id) {
  let d;
  try { const s = await getDoc(doc(db, "pna_don", id)); if (!s.exists()) return page("Không tìm thấy đơn", `<p class="empty">Đơn không tồn tại hoặc đã bị xóa.</p>`); d = { id, ...s.data() }; }
  catch (e) { return page("Không mở được đơn", `<p class="empty">Bạn không có quyền xem đơn này hoặc chưa đăng nhập.</p>`); }
  const mine = d.sv && d.sv.email === myEmail(), act = mustAct(d) && !mine;
  const cur = d.status === "cho-duyet" && d.steps[d.step] ? `Bước ${d.step + 1}/${d.steps.length}: chờ <b>${esc(d.steps[d.step].name)}</b>` : "";
  const hist = (d.history || []).map(h => `<li><time>${fmtDT(h.at)}</time> <b>${esc(h.name || h.by)}</b> ${h.role && h.role !== "sv" ? `(${esc(stepName(h.role))})` : ""} — ${esc(ACT[h.act] || h.act)}${h.note ? `: <i>${esc(h.note)}</i>` : ""}${h.url ? ` <a href="${esc(h.url)}" target="_blank" rel="noopener">mở</a>` : ""}</li>`).join("");
  page(`${esc(d.ttTen)} <small class="tt-ma">${esc(d.ma)}</small>`, `
    <div class="tt-head">${stChip(d)} <span>${cur}</span> <span class="muted">Sinh viên: ${esc(d.sv.hoTen)} (${esc(d.sv.mssv)}) · Lớp ${esc(d.lop || d.sv.lop)} · Nộp ${fmtDT(d.created)}</span></div>
    <div class="tt-grid">
      <div class="a4-host" id="ttSheet">${sheetHTML(d)}</div>
      <aside class="tt-side">
        <div class="sbox"><h3 class="sbox-title">THAO TÁC</h3>
          <button type="button" class="sbtn" id="ttPrint">In / Lưu PDF đơn</button>
          ${mine && d.status === "bo-sung" ? `<button type="button" class="sbtn primary" data-go="tt-sua/${esc(d.id)}">Bổ sung và gửi lại</button>` : ""}
          ${mine && ["cho-duyet", "bo-sung"].includes(d.status) ? `<button type="button" class="sbtn" id="ttRut">Rút đơn</button>` : ""}
          ${d.banKySo ? `<a class="sbtn" href="${esc(d.banKySo)}" target="_blank" rel="noopener">Mở bản PDF đã ký số</a>` : ""}
          ${!mine && (isApprover()) && d.status === "da-duyet" ? `<button type="button" class="sbtn" id="ttKySo">Gắn bản PDF đã ký số</button>` : ""}
        </div>
        ${act ? `<div class="sbox tt-act"><h3 class="sbox-title">XỬ LÝ — ${esc(d.steps[d.step].name.toUpperCase())}</h3>
          <label class="fld"><span>Ý kiến</span><textarea id="ttNote" rows="3" placeholder="Ví dụ: Sinh viên thuộc lớp, thông tin đúng; đề nghị Khoa xem xét."></textarea></label>
          <div id="ttSig2"></div><p class="err" id="ttErr2" role="alert"></p>
          <button type="button" class="sbtn primary" data-ttdo="duyet">${esc((STEP_ROLES[d.steps[d.step].role] || { act: "Đồng ý" }).act)} và ký</button>
          <button type="button" class="sbtn" data-ttdo="bo-sung">Yêu cầu bổ sung</button>
          <button type="button" class="sbtn" data-ttdo="tu-choi" style="color:var(--err)">Không duyệt</button></div>` : ""}
        <div class="sbox"><h3 class="sbox-title">TỆP MINH CHỨNG</h3><div id="ttTep" class="muted">${d.nTep ? "Đang tải…" : "Không có tệp."}</div>
          ${(d.links || []).map(l => `<a class="tt-file" href="${esc(l)}" target="_blank" rel="noopener">🔗 ${esc(l.length > 48 ? l.slice(0, 45) + "…" : l)}</a>`).join("")}</div>
        <div class="sbox"><h3 class="sbox-title">QUÁ TRÌNH XỬ LÝ</h3><ol class="tt-hist">${hist}</ol></div>
      </aside></div>`);
  $("#ttPrint").onclick = () => printSheet(sheetHTML(d), d.ma);
  if (d.nTep) loadTep(d);
  const now = () => new Date().toISOString();
  const myName = () => (P.acct && P.acct.name) || (P.user && P.user.displayName) || P.showName(myEmail());
  if ($("#ttRut")) $("#ttRut").onclick = async () => {
    if (!await P.ask("Rút đơn " + d.ma + "? Đơn đã rút không xử lý tiếp; muốn đề nghị lại phải lập đơn mới.")) return;
    try { await updateDoc(doc(db, "pna_don", d.id), { status: "rut", stepRole: "", history: [...d.history, { at: now(), by: myEmail(), name: d.sv.hoTen, role: "sv", act: "rut", note: "" }], updated: now() }); P.toast("Đã rút đơn."); renderDon(d.id); }
    catch (e) { P.toast("Chưa rút được: " + e.message, "err"); }
  };
  if ($("#ttKySo")) $("#ttKySo").onclick = async () => {
    const url = (await P.ask("Bản PDF đơn đã ký số bằng ứng dụng ký số (VNPT SmartCA, Viettel CA…), tải lên Google Drive và chia sẻ cho người cần xem.", { title: "GẮN BẢN ĐÃ KÝ SỐ", input: "Đường link bản PDF", value: d.banKySo || "", ok: "Lưu" }) || "").trim();
    if (!url) return; if (!/^https?:\/\//i.test(url)) return P.toast("Đường link phải bắt đầu bằng https://", "err");
    try { await updateDoc(doc(db, "pna_don", d.id), { banKySo: url, updated: now() }); P.logAct("TT_KY_SO", d.ma); P.toast("Đã gắn bản ký số."); renderDon(d.id); }
    catch (e) { P.toast("Chưa lưu được: " + e.message, "err"); }
  };
  if (act) {
    const pad = sigPad($("#ttSig2"), await savedSig());
    document.querySelectorAll("[data-ttdo]").forEach(b => b.onclick = async () => {
      const what = b.dataset.ttdo, note = $("#ttNote").value.trim(), err = $("#ttErr2"); err.textContent = "";
      if (what !== "duyet" && !note) return err.textContent = what === "bo-sung" ? "Ghi rõ nội dung sinh viên cần bổ sung." : "Ghi rõ lý do không duyệt.";
      const sig = what === "bo-sung" ? null : pad.get();
      if (what !== "bo-sung" && !sig) return err.textContent = "Hãy ký vào ô chữ ký.";
      const label = what === "duyet" ? (STEP_ROLES[d.steps[d.step].role] || { act: "Đồng ý" }).act.toLowerCase() : what === "bo-sung" ? "yêu cầu bổ sung" : "không duyệt";
      if (!await P.ask(`Xác nhận ${label} đơn ${d.ma}?`)) return;
      const at = now(), role = d.steps[d.step].role, hash = (await sha(contentOf(d) + "|" + myEmail() + "|" + at + "|" + what)).slice(0, 16).toUpperCase();
      const entry = { at, by: myEmail(), name: myName(), role, step: d.step, act: what, note, hash, ...(sig ? { sig } : {}) };
      const next = what === "duyet" ? d.step + 1 : d.step;
      const done = what === "duyet" && next >= d.steps.length;
      const patch = { history: [...d.history, entry], updated: at,
        status: what === "duyet" ? (done ? "da-duyet" : "cho-duyet") : what,
        step: done ? d.step : next, stepRole: what === "duyet" && !done ? d.steps[next].role : "" };
      b.disabled = true;
      try { await updateDoc(doc(db, "pna_don", d.id), patch); if (sig) await keepSig(pad, sig); P.logAct("TT_" + what.toUpperCase(), d.ma); P.toast("Đã lưu: " + label + "."); load(true); renderDon(d.id); }
      catch (e) { err.textContent = "Chưa lưu được: " + e.message; b.disabled = false; }
    });
  }
}
async function loadTep(d) {
  const box = $("#ttTep");
  try {
    const snap = await getDocs(collection(db, "pna_don", d.id, "tep")), list = [];
    snap.forEach(x => list.push({ id: x.id, ...x.data() }));
    box.className = ""; box.innerHTML = list.length ? list.map((f, i) => `<button type="button" class="tt-file linkish" data-i="${i}">📎 ${esc(f.ten)}</button>`).join("") : "Không có tệp.";
    box.querySelectorAll("[data-i]").forEach(b => b.onclick = () => {
      const f = list[+b.dataset.i], bin = atob(f.data.split(",")[1]), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      window.open(URL.createObjectURL(new Blob([u8], { type: f.loai })), "_blank");
    });
  } catch (e) { box.textContent = "Không tải được tệp: " + e.message; }
}

/* ---------- Danh sách đơn ---------- */
async function renderList(kind) {
  if (!myEmail()) return page("Đơn", `<p class="tt-note">Hãy đăng nhập. <button type="button" class="pill" data-login>Đăng nhập</button></p>`);
  page(kind === "cua-toi" ? "Đơn của tôi" : "Đơn cần xử lý", `<p class="muted">Đang tải…</p>`);
  let list;
  try { list = await fetchDons(kind); } catch (e) { return page("Đơn", `<p class="empty">Không tải được danh sách: ${esc(e.message)}</p>`); }
  const tabs = kind === "duyet" ? [["cho", "Chờ tôi xử lý", list.filter(mustAct)], ["dang", "Đang xử lý", list.filter(d => d.status === "cho-duyet" || d.status === "bo-sung")], ["xong", "Đã kết thúc", list.filter(d => ["da-duyet", "tu-choi", "rut"].includes(d.status))], ["all", "Tất cả", list]] : [["all", "Tất cả", list]];
  const table = rows => rows.length ? `<div class="tbl-wrap"><table class="adm-table ftbl tt-list"><thead><tr><th>Mã hồ sơ</th><th>Thủ tục</th>${kind === "duyet" ? "<th>Sinh viên</th><th>Lớp</th>" : ""}<th>Ngày nộp</th><th>Trạng thái</th><th>Bước hiện tại</th></tr></thead><tbody>
    ${rows.map(d => `<tr data-go="tt-don/${esc(d.id)}" class="tt-row"><td><b>${esc(d.ma)}</b></td><td>${esc(d.ttTen)}</td>${kind === "duyet" ? `<td>${esc(d.sv.hoTen)}<br><small>${esc(d.sv.mssv)}</small></td><td>${esc(d.lop || "")}</td>` : ""}<td>${fmtDT(d.created)}</td><td>${stChip(d)}</td><td>${d.status === "cho-duyet" && d.steps[d.step] ? esc(d.steps[d.step].name) : "—"}</td></tr>`).join("")}</tbody></table></div>`
    : `<p class="empty">Không có đơn.</p>`;
  page(kind === "cua-toi" ? "Đơn của tôi" : "Đơn cần xử lý", (kind === "cua-toi" ? `<p><a class="pill" href="#tt">＋ Lập đơn mới</a></p>` : "") +
    (tabs.length > 1 ? `<div class="tabs tt-tabs">${tabs.map(([k, n, r], i) => `<button type="button" class="tab${i ? "" : " on"}" data-tttab="${k}">${n} (${r.length})</button>`).join("")}</div>` : "") +
    tabs.map(([k, , r], i) => `<div data-ttpane="${k}"${i ? " hidden" : ""}>${table(r)}</div>`).join(""));
  document.querySelectorAll("[data-tttab]").forEach(b => b.onclick = () => {
    document.querySelectorAll("[data-tttab]").forEach(x => x.classList.toggle("on", x === b));
    document.querySelectorAll("[data-ttpane]").forEach(p => p.hidden = p.dataset.ttpane !== b.dataset.tttab);
  });
}

/* ---------- Lớp & tài khoản sinh viên ---------- */
const normMssv = s => String(s || "").trim().replace(/\s+/g, "");
function parseDate(s) {
  s = String(s || "").trim(); let m;
  if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s))) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) return s;
  return "";
}
const pwFrom = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? m[3] + m[2] + m[1] : Math.random().toString(36).slice(2, 10); };
async function renderLop(sel) {
  if (!isCvht() && !isAdmin()) return page("Lớp & tài khoản sinh viên", `<p class="empty">Chỉ cố vấn học tập và quản trị viên dùng chức năng này.</p>`);
  let lops = ME.lops;
  if (isAdmin()) { lops = []; try { (await getDocs(collection(db, "pna_lop"))).forEach(d => lops.push({ id: d.id, ...d.data() })); } catch (e) {} }
  lops.sort((a, b) => a.id.localeCompare(b.id));
  const cur = lops.find(l => l.id === sel) || lops[0];
  const adminLop = isAdmin() ? `<details class="more" ${lops.length ? "" : "open"}><summary>Quản lý danh sách lớp (quản trị)</summary>
      <p class="muted">Mỗi lớp gắn một hoặc nhiều cố vấn học tập (email Google của giảng viên). Tài khoản cố vấn cấp ở <a href="#tai-khoan">Tài khoản & phân quyền</a> với loại “Cố vấn học tập”.</p>
      <div class="tbl-wrap"><table class="adm-table ftbl"><thead><tr><th>Mã lớp</th><th>Tên lớp</th><th>Ngành</th><th>Khóa</th><th>Email cố vấn học tập (cách nhau dấu phẩy)</th><th></th></tr></thead><tbody id="lopRows">
      ${lops.map(l => `<tr data-lop="${esc(l.id)}"><td><b>${esc(l.id)}</b></td><td><input value="${esc(l.ten || "")}" data-f="ten"></td><td><input value="${esc(l.nganh || "")}" data-f="nganh"></td><td><input value="${esc(l.khoa || "")}" data-f="khoa" style="width:70px"></td><td><input value="${esc((l.cvht || []).join(", "))}" data-f="cvht" style="min-width:260px"></td><td class="adm-table ftbl-act"><button type="button" class="btn" data-lopsave>Lưu</button><button type="button" class="btn" data-lopdel>Xóa</button></td></tr>`).join("")}
      <tr data-lop=""><td><input placeholder="VD: 2601LHOA" data-f="id"></td><td><input data-f="ten" placeholder="Tên lớp"></td><td><input data-f="nganh" placeholder="Luật"></td><td><input data-f="khoa" style="width:70px" placeholder="2026"></td><td><input data-f="cvht" placeholder="gv@gmail.com"></td><td><button type="button" class="btn primary" data-lopsave>Thêm lớp</button></td></tr>
      </tbody></table></div><p class="err" id="lopErr"></p></details>` : "";
  if (!cur) return page("Lớp & tài khoản sinh viên", adminLop + `<p class="empty">${isAdmin() ? "Chưa có lớp nào. Thêm lớp ở bảng trên." : "Bạn chưa được gắn làm cố vấn học tập của lớp nào. Liên hệ quản trị viên."}</p>`), bindLop(lops);
  let svs = [];
  try {
    // quy tắc bảo mật chỉ cho cố vấn đọc hồ sơ có tên mình trong trường cvht, nên truy vấn theo trường đó
    const q = isAdmin() ? query(collection(db, "pna_sv"), where("lop", "==", cur.id)) : query(collection(db, "pna_sv"), where("cvht", "array-contains", myEmail()));
    (await getDocs(q)).forEach(d => { if (d.data().lop === cur.id) svs.push({ id: d.id, ...d.data() }); });
  } catch (e) { P.toast("Không tải được danh sách sinh viên: " + e.message, "err"); }
  svs.sort((a, b) => String(a.mssv).localeCompare(String(b.mssv)));
  page("Lớp & tài khoản sinh viên", adminLop + `
    <div class="tt-head"><label class="fld" style="flex-direction:row;align-items:center;gap:8px">Lớp <select id="lopSel" class="fld-sel" style="width:auto">${lops.map(l => `<option value="${esc(l.id)}"${l.id === cur.id ? " selected" : ""}>${esc(l.id)}${l.ten ? " — " + esc(l.ten) : ""}</option>`).join("")}</select></label>
      <span class="muted">Cố vấn: ${esc((cur.cvht || []).join(", ") || "chưa gắn")} · ${svs.length} sinh viên</span></div>
    <details class="more" open><summary>Cấp tài khoản sinh viên</summary>
      <p class="muted">Dán danh sách từ Excel, mỗi dòng một sinh viên theo thứ tự cột: <b>Mã SV · Họ và tên · Ngày sinh (dd/mm/yyyy) · Số điện thoại · Gmail (không bắt buộc)</b>.
      Không có Gmail: tên đăng nhập là mã sinh viên, mật khẩu ban đầu là ngày sinh dạng <code>ddmmyyyy</code> (sinh viên đổi sau khi đăng nhập). Sinh viên quên mật khẩu: bấm <b>Đặt lại mật khẩu</b> ở dòng của sinh viên trong bảng dưới. Có Gmail: sinh viên bấm “Đăng nhập bằng Google”.</p>
      <textarea id="svPaste" rows="5" class="fld-sel" placeholder="2601LHOA001	Nguyễn Văn An	05/09/2008	0912345678"></textarea>
      <div class="dlg-act" style="justify-content:flex-start"><button type="button" class="btn primary" id="svCreate">Cấp tài khoản</button></div>
      <p class="err" id="svErr"></p><div id="svOut"></div></details>
    <div class="tbl-wrap"><table class="adm-table ftbl"><thead><tr><th>Mã SV</th><th>Họ và tên</th><th>Ngày sinh</th><th>Điện thoại</th><th>Đăng nhập bằng</th><th></th></tr></thead><tbody>
    ${svs.map(s => `<tr><td><b>${esc(s.mssv)}</b></td><td>${esc(s.hoTen)}</td><td>${esc(fmtD(s.ngaySinh))}</td><td>${esc(s.sdt || "")}</td><td>${esc(P.showName(s.id))}${s.id.endsWith("@" + P.ACCT_DOMAIN) ? "" : " <small class=\"muted\">(Google)</small>"}<span class="pw-st" data-pwst="${esc(s.id)}"></span></td><td style="white-space:nowrap"><button type="button" class="btn sm" data-svedit="${esc(s.id)}">✎ Sửa</button> ${s.id.endsWith("@" + P.ACCT_DOMAIN) ? `<button type="button" class="btn sm" data-svpw="${esc(s.id)}">Đặt lại mật khẩu</button> ` : ""}<button type="button" class="btn sm" data-svdel="${esc(s.id)}">Xóa</button></td></tr>`).join("") || `<tr><td colspan="6" class="muted">Chưa có sinh viên.</td></tr>`}
    </tbody></table></div>`);
  bindLop(lops);
  $("#lopSel").onchange = e => go("tt-lop/" + e.target.value);
  /* Danh sách chuyển sang từ trang lớp của Hồ sơ sinh viên */
  try { const pf = JSON.parse(sessionStorage.getItem("pna_sv_prefill") || "null"); if (pf && pf.lop === cur.id) { $("#svPaste").value = pf.text; sessionStorage.removeItem("pna_sv_prefill"); $("#svPaste").scrollIntoView({ block: "center" }); } } catch (e) {}
  /* Sửa thông tin tài khoản sinh viên, đặt lại mật khẩu khi sinh viên quên */
  P.pwResetStatus().then(rs => { const last = {}; rs.forEach(r => { if (!last[r.email]) last[r.email] = r; });
    document.querySelectorAll("[data-pwst]").forEach(x => { const r = last[x.dataset.pwst]; if (r) x.innerHTML = `<br><small class="${r.tt === "loi" ? "err" : "muted"}">${P.pwStText(r)}</small>`; }); });
  document.querySelectorAll("[data-svpw]").forEach(b => b.onclick = () => { const s = svs.find(x => x.id === b.dataset.svpw) || {}; P.pwResetDialog(s.id, s.hoTen, /^\d{4}-\d{2}-\d{2}$/.test(s.ngaySinh || "") ? pwFrom(s.ngaySinh) : "", () => renderLop(cur.id)); });
  document.querySelectorAll("[data-svedit]").forEach(b => b.onclick = () => {
    const s = svs.find(x => x.id === b.dataset.svedit); if (!s) return;
    const dl = document.createElement("dialog"); dl.className = "dlg";
    dl.innerHTML = `<form method="dialog" class="dlg-in"><h3>SỬA TÀI KHOẢN SINH VIÊN</h3>
      <p class="muted">Tên đăng nhập: <b>${esc(P.showName(s.id))}</b> · Mã SV ${esc(s.mssv)}</p>
      <div class="grid2"><label class="fld"><span>Họ và tên *</span><input id="seTen" value="${esc(s.hoTen || "")}"></label>
      <label class="fld"><span>Ngày sinh (dd/mm/yyyy)</span><input id="seNs" value="${esc(fmtD(s.ngaySinh))}"></label>
      <label class="fld"><span>Số điện thoại</span><input id="seSdt" value="${esc(s.sdt || "")}"></label></div>
      ${s.id.endsWith("@" + P.ACCT_DOMAIN) ? `<label class="fld chk inline"><input type="checkbox" id="sePwOn"><span>Đặt lại mật khẩu (sinh viên quên mật khẩu)</span></label>
      <label class="fld" id="sePwWrap" hidden><span>Mật khẩu mới</span><input id="sePw" autocomplete="off" value="${esc(/^\d{4}-\d{2}-\d{2}$/.test(s.ngaySinh || "") ? pwFrom(s.ngaySinh) : "")}"><small class="muted">Mặc định: ngày sinh ddmmyyyy. Áp dụng sau khoảng 5–15 phút.</small></label>` : `<p class="muted">Sinh viên đăng nhập bằng Google — mật khẩu do Google quản lý.</p>`}
      <p class="err" id="seErr"></p><div class="dlg-act"><button type="button" class="btn" data-x>Hủy</button><button type="submit" class="btn primary" id="seGo">Lưu</button></div></form>`;
    document.body.appendChild(dl); dl.showModal(); dl.addEventListener("close", () => dl.remove());
    dl.querySelector("[data-x]").onclick = () => dl.close();
    const on = dl.querySelector("#sePwOn"); if (on) on.onchange = () => dl.querySelector("#sePwWrap").hidden = !on.checked;
    dl.querySelector("form").onsubmit = async e => {
      e.preventDefault(); const err = dl.querySelector("#seErr"), btn = dl.querySelector("#seGo");
      const hoTen = dl.querySelector("#seTen").value.trim(), nsRaw = dl.querySelector("#seNs").value.trim(), ngaySinh = parseDate(nsRaw), sdt = dl.querySelector("#seSdt").value.trim();
      if (!hoTen) return err.textContent = "Nhập họ và tên.";
      if (nsRaw && !ngaySinh) return err.textContent = "Ngày sinh chưa đúng dạng dd/mm/yyyy.";
      btn.disabled = true;
      try {
        const at = new Date().toISOString();
        await setDoc(doc(db, "pna_sv", s.id), { hoTen, ngaySinh, sdt, cvht: cur.cvht || [], lop: cur.id, updated: at, by: myEmail() }, { merge: true });
        try { await setDoc(doc(db, "pna_accounts", s.id), { role: "sinh-vien", name: hoTen, updated: at }, { merge: true }); } catch (x) {}
        if (sdt !== (s.sdt || "")) { try { await setDoc(doc(db, "pna_hoso", s.mssv), { sdt, updated: at, by: myEmail() }, { merge: true }); } catch (x) {} }
        let msg = "Đã lưu thông tin " + hoTen + ".";
        if (on && on.checked) { await P.requestPwReset(s.id, dl.querySelector("#sePw").value.trim(), "CVHT đặt lại"); msg += " Đã gửi yêu cầu đặt lại mật khẩu (áp dụng sau khoảng 5–15 phút)."; }
        P.logAct("SV_EDIT", s.mssv); P.toast(msg, "ok"); dl.close(); renderLop(cur.id);
      } catch (x) { err.textContent = "Chưa lưu được: " + x.message; btn.disabled = false; }
    };
  });
  document.querySelectorAll("[data-svdel]").forEach(b => b.onclick = async () => {
    const em = b.dataset.svdel;
    if (!await P.ask("Xóa hồ sơ sinh viên " + P.showName(em) + "? Sinh viên sẽ không lập được đơn mới; các đơn cũ vẫn lưu.")) return;
    try { await deleteDoc(doc(db, "pna_sv", em)); try { await deleteDoc(doc(db, "pna_accounts", em)); } catch (e) {} P.logAct("SV_DEL", em); renderLop(cur.id); }
    catch (e) { P.toast("Chưa xóa được: " + e.message, "err"); }
  });
  $("#svCreate").onclick = async () => {
    const err = $("#svErr"), out = $("#svOut"); err.textContent = ""; out.innerHTML = "";
    const rows = $("#svPaste").value.split(/\n+/).map(l => l.split(/\t|;|,(?=\s*\S)/).map(x => x.trim())).filter(r => r[0]);
    if (!rows.length) return err.textContent = "Chưa có dòng nào.";
    const bad = rows.filter(r => !r[1]); if (bad.length) return err.textContent = "Thiếu họ tên ở dòng: " + bad.map(r => r[0]).join(", ");
    const btn = $("#svCreate"); btn.disabled = true; const res = [];
    for (const r of rows) {
      const mssv = normMssv(r[0]), hoTen = r[1], ngaySinh = parseDate(r[2]), sdt = r[3] || "", gmail = (r[4] || "").toLowerCase();
      const email = gmail && gmail.includes("@") ? gmail : P.toEmail(mssv), pw = gmail ? "" : pwFrom(ngaySinh);
      btn.textContent = `Đang cấp ${res.length + 1}/${rows.length}…`;
      try {
        let note = "";
        if (!gmail) { try { await P.createAuthUser(email, pw); } catch (e) { if (String(e.code || e.message).includes("email-already-in-use")) note = "tài khoản đã có, giữ mật khẩu cũ"; else throw e; } }
        const at = new Date().toISOString();
        await setDoc(doc(db, "pna_accounts", email), { role: "sinh-vien", name: hoTen, username: gmail ? "" : mssv, cats: ["*"], updated: at, by: myEmail() }, { merge: true });
        await setDoc(doc(db, "pna_sv", email), { email, mssv, hoTen, ngaySinh, sdt, lop: cur.id, nganh: cur.nganh || "", khoa: cur.khoa || "", cvht: cur.cvht || [], updated: at, by: myEmail() }, { merge: true });
        try { await setDoc(doc(db, "pna_hoso", mssv), { email, updated: at, by: myEmail() }, { merge: true }); } catch (e) {}   // gắn tài khoản vào hồ sơ vòng đời (nếu đã có)
        res.push([mssv, hoTen, gmail ? gmail + " (Google)" : mssv, note || (pw ? pw : ""), "✓"]);
      } catch (e) { res.push([mssv, hoTen, "", "", "Lỗi: " + (e.code || e.message)]); }
    }
    P.logAct("SV_CREATE", cur.id + " · " + res.filter(x => x[4] === "✓").length + " tài khoản");
    await renderLop(cur.id);   // làm mới danh sách lớp, rồi hiện kết quả
    $("#svOut").innerHTML = `<p><b>Kết quả</b> — sao chép bảng này gửi sinh viên (mật khẩu chỉ hiện một lần):</p><div class="tbl-wrap"><table class="adm-table ftbl" id="svRes"><thead><tr><th>Mã SV</th><th>Họ tên</th><th>Tên đăng nhập</th><th>Mật khẩu ban đầu</th><th></th></tr></thead><tbody>${res.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div><button type="button" class="btn" id="svCopy">Sao chép bảng</button>`;
    $("#svOut").closest("details").open = true; $("#svOut").scrollIntoView({ block: "center" });
    $("#svCopy").onclick = () => { navigator.clipboard.writeText(res.map(r => r.slice(0, 4).join("\t")).join("\n")); P.toast("Đã sao chép."); };
  };
}
function bindLop(lops) {
  document.querySelectorAll("[data-lopsave]").forEach(b => b.onclick = async () => {
    const tr = b.closest("tr"), f = k => (tr.querySelector(`[data-f="${k}"]`) || {}).value || "", err = $("#lopErr"); err.textContent = "";
    const id = (tr.dataset.lop || f("id")).trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9._-]{2,30}$/.test(id)) return err.textContent = "Mã lớp chỉ gồm chữ không dấu, số, dấu chấm, gạch (2–30 ký tự).";
    const cvht = f("cvht").split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(s => s.includes("@"));
    try {
      await setDoc(doc(db, "pna_lop", id), { ten: f("ten").trim(), nganh: f("nganh").trim(), khoa: f("khoa").trim(), cvht, updated: new Date().toISOString() }, { merge: true });
      // đồng bộ cố vấn vào hồ sơ sinh viên của lớp (để quy tắc bảo mật và danh sách đơn mới dùng đúng)
      const old = lops.find(l => l.id === id);
      if (old && JSON.stringify(old.cvht || []) !== JSON.stringify(cvht)) {
        const snap = await getDocs(query(collection(db, "pna_sv"), where("lop", "==", id))); const ops = [];
        snap.forEach(d => ops.push(d.ref));
        for (let i = 0; i < ops.length; i += 400) { const bt = writeBatch(db); ops.slice(i, i + 400).forEach(r => bt.update(r, { cvht })); await bt.commit(); }
        const s2 = await getDocs(query(collection(db, "pna_hoso"), where("lop", "==", id))), r2 = [];
        s2.forEach(d => r2.push(d.ref));
        for (let i = 0; i < r2.length; i += 400) { const bt = writeBatch(db); r2.slice(i, i + 400).forEach(r => bt.update(r, { cvht })); await bt.commit(); }
      }
      P.logAct("LOP_SAVE", id); P.toast("Đã lưu lớp " + id + "."); await load(true); renderLop(id);
    } catch (e) { err.textContent = "Chưa lưu được: " + e.message; }
  });
  document.querySelectorAll("[data-lopdel]").forEach(b => b.onclick = async () => {
    const id = b.closest("tr").dataset.lop;
    if (!await P.ask("Xóa lớp " + id + "? Hồ sơ sinh viên của lớp không bị xóa.")) return;
    try { await deleteDoc(doc(db, "pna_lop", id)); P.logAct("LOP_DEL", id); renderLop(); } catch (e) { P.toast("Chưa xóa được: " + e.message, "err"); }
  });
}

/* ---------- Cấu hình thủ tục, người duyệt (quản trị) ---------- */
const fieldsToText = fs => (fs || []).map(f => [f.k, f.label + (f.req ? " *" : ""), f.type || "text", (f.opts || f.cols || []).join("; "), f.hint || ""].join(" | ").replace(/( \| )+$/, "")).join("\n");
function textToFields(txt) {
  return txt.split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => {
    const [k, lab = "", type = "text", list = "", hint = ""] = l.split("|").map(s => s.trim());
    const req = /\*$/.test(lab), f = { k: k.replace(/[^\w-]/g, "") || "f" + Math.random().toString(36).slice(2, 6), label: lab.replace(/\s*\*$/, ""), type: ["text", "textarea", "date", "number", "select", "check", "table"].includes(type) ? type : "text", req };
    if (f.type === "select" || f.type === "check") f.opts = list.split(";").map(s => s.trim()).filter(Boolean);
    if (f.type === "table") f.cols = list.split(";").map(s => s.trim()).filter(Boolean);
    if (hint) f.hint = hint;
    return f;
  });
}
function renderConfig() {
  if (!isAdmin()) return page("Cấu hình thủ tục", `<p class="empty">Chỉ quản trị viên.</p>`);
  const list = (CFG || THU_TUC).map(t => ({ ...t }));
  const stepSel = (t, i) => `<select data-step="${i}" class="fld-sel" style="width:auto"><option value="">—</option>${Object.entries(STEP_ROLES).map(([k, r]) => `<option value="${k}"${(t.steps || [])[i] === k ? " selected" : ""}>${esc(r.name)}</option>`).join("")}</select>`;
  const card = (t, i) => `<details class="tt-cfg" data-i="${i}"><summary><b>${esc(t.ten || "(thủ tục mới)")}</b> <span class="muted">${esc(t.nhom || "")}</span> ${t.active === false ? '<span class="tt-st" style="background:#eef0f3">Đang tắt</span>' : ""}</summary>
    <div class="grid2">
      <label class="fld"><span>Tên thủ tục</span><input data-f="ten" value="${esc(t.ten || "")}"></label>
      <label class="fld"><span>Nhóm</span><input data-f="nhom" value="${esc(t.nhom || "")}"></label>
      <label class="fld"><span>Tên đơn (in hoa)</span><input data-f="tieuDe" value="${esc(t.tieuDe || "")}"></label>
      <label class="fld"><span>Kính gửi</span><input data-f="kinhGui" value="${esc(t.kinhGui || "")}"></label></div>
    <label class="fld"><span>Căn cứ</span><input data-f="canCu" value="${esc(t.canCu || "")}"></label>
    <label class="fld"><span>Điều kiện, thời hạn (hiện cho sinh viên)</span><textarea data-f="huongDan" rows="3">${esc(t.huongDan || "")}</textarea></label>
    <label class="fld"><span>Hồ sơ, minh chứng</span><textarea data-f="minhChung" rows="2">${esc(t.minhChung || "")}</textarea></label>
    <div class="fld"><span>Các bước duyệt theo thứ tự</span><div style="display:flex;gap:8px;flex-wrap:wrap">${[0, 1, 2].map(j => stepSel(t, j)).join("<span>→</span>")}</div></div>
    <label class="fld"><span>Trường nhập — mỗi dòng: <code>mã | Nhãn (thêm * nếu bắt buộc) | loại | lựa chọn hoặc cột, cách nhau “;” | gợi ý</code>. Loại: text, textarea, date, number, select, table.</span><textarea data-f="fields" rows="6" style="font-family:monospace;font-size:12.5px">${esc(fieldsToText(t.fields))}</textarea></label>
    <div class="adm-table ftbl-act"><label class="fld chk inline"><input type="checkbox" data-f="active"${t.active === false ? "" : " checked"}><span>Đang nhận đơn</span></label><button type="button" class="btn" data-cfgdel>Xóa thủ tục</button></div></details>`;
  page("Cấu hình thủ tục, người duyệt", `
    <div class="sbox" style="margin-bottom:14px"><h3 class="sbox-title">NGƯỜI DUYỆT CÁC BƯỚC</h3>
      <p class="muted">Bước “Cố vấn học tập” do cố vấn của lớp xử lý (gắn ở Lớp & tài khoản sinh viên). Ghi email đăng nhập Google của người duyệt hai bước còn lại, cách nhau dấu phẩy.</p>
      <label class="fld"><span>Lãnh đạo Khoa</span><input id="ndKhoa" value="${esc(ND.khoa.join(", "))}"></label>
      <label class="fld"><span>Ban Quản lý đào tạo (nếu dùng bước tiếp nhận)</span><input id="ndQldt" value="${esc(ND.qldt.join(", "))}"></label></div>
    <div id="cfgList">${list.map(card).join("")}</div>
    <div class="dlg-act" style="justify-content:flex-start;flex-wrap:wrap"><button type="button" class="btn" id="cfgAdd">＋ Thêm thủ tục</button><button type="button" class="btn" id="cfgReset">Khôi phục bộ mặc định</button><button type="button" class="btn primary" id="cfgSave">Lưu cấu hình</button></div>
    <p class="err" id="cfgErr"></p>`);
  const L = list;
  $("#cfgAdd").onclick = () => { L.push({ key: "tt-" + Date.now().toString(36), nhom: "Khác", ten: "", tieuDe: "ĐƠN ĐỀ NGHỊ", kinhGui: "Cố vấn học tập; Lãnh đạo Khoa", steps: ["cvht"], fields: [], active: true }); $("#cfgList").insertAdjacentHTML("beforeend", card(L[L.length - 1], L.length - 1)); $("#cfgList").lastElementChild.open = true; };
  $("#cfgList").addEventListener("click", e => { const b = e.target.closest("[data-cfgdel]"); if (!b) return; const det = b.closest("details"); L[+det.dataset.i]._del = true; det.remove(); });
  $("#cfgReset").onclick = async () => { if (!await P.ask("Thay toàn bộ cấu hình thủ tục bằng bộ mặc định (mẫu đơn theo Phụ lục Quy chế đào tạo, điều kiện theo Quy chế đào tạo 2026)? Các thay đổi đã lưu sẽ mất.")) return; CFG = THU_TUC.map(t => ({ ...t, active: true })); renderConfig(); };
  $("#cfgSave").onclick = async () => {
    const err = $("#cfgErr"); err.textContent = "";
    const out = [];
    document.querySelectorAll("#cfgList details").forEach(det => {
      const t = { ...L[+det.dataset.i] }, f = k => det.querySelector(`[data-f="${k}"]`);
      ["ten", "nhom", "tieuDe", "kinhGui", "canCu", "huongDan", "minhChung"].forEach(k => t[k] = f(k).value.trim());
      t.fields = textToFields(f("fields").value); t.active = f("active").checked;
      t.steps = [...det.querySelectorAll("[data-step]")].map(s => s.value).filter(Boolean);
      delete t._del; out.push(t);
    });
    const bad = out.find(t => !t.ten || !t.steps.length);
    if (bad) return err.textContent = "Mỗi thủ tục cần có tên và ít nhất một bước duyệt" + (bad.ten ? " (" + bad.ten + ")" : "") + ".";
    const em = id => $(id).value.split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(s => s.includes("@"));
    try {
      await setDoc(doc(db, "pna_tt_settings", "thutuc"), { list: out, ver: TT_VER, updated: new Date().toISOString(), by: myEmail() });
      await setDoc(doc(db, "pna_tt_settings", "nguoiduyet"), { khoa: em("#ndKhoa"), qldt: em("#ndQldt"), updated: new Date().toISOString() });
      P.logAct("TT_CONFIG", out.length + " thủ tục"); P.toast("Đã lưu cấu hình."); await load(true); renderConfig();
    } catch (e) { err.textContent = "Chưa lưu được: " + e.message; }
  };
}

/* ---------- Định tuyến ---------- */
const go = h => { if (location.hash.slice(1) === h) route(h); else location.hash = h; };
async function route(h) {
  await load();
  if (h === "tt") return renderCatalog();
  if (h.startsWith("tt/")) return renderForm(h.slice(3));
  if (h.startsWith("tt-sua/")) return renderForm(null, h.slice(7));
  if (h.startsWith("tt-don/")) return renderDon(h.slice(7));
  if (h === "tt-cua-toi") return renderList("cua-toi");
  if (h === "tt-duyet") return renderList("duyet");
  if (h === "tt-lop" || h.startsWith("tt-lop/")) return renderLop(h.slice(7));
  if (h === "tt-cau-hinh") return renderConfig();
  renderCatalog();
}
/* Thêm/xóa dòng bảng trong đơn; dòng bảng danh sách bấm để mở */
document.addEventListener("click", e => {
  const add = e.target.closest("[data-ttaddrow]");
  if (add) { const w = add.closest(".tt-tbl"), cols = [...w.querySelectorAll("thead th")].slice(0, -1).map(th => th.textContent); w.querySelector("tbody").insertAdjacentHTML("beforeend", rowHTML(cols, [])); return; }
  const del = e.target.closest("[data-ttdelrow]");
  if (del) { const tb = del.closest("tbody"); if (tb.rows.length > 1) del.closest("tr").remove(); else del.closest("tr").querySelectorAll("input").forEach(i => i.value = ""); return; }
});
document.addEventListener("pna:auth", () => { load(); });

window.PNA_TT = { route: h => route(h), reload: () => load(true) };
load().then(() => { const h = decodeURIComponent(location.hash.slice(1)); if (h === "tt" || h.startsWith("tt/") || h.startsWith("tt-")) route(h); });
