/* Đồng bộ Firebase cho PNA (PNA_SYNC) — chạy trong GitHub Actions (xem .github/workflows/dong-bo-firebase.yml).
   1. Công bố khóa công khai data/khoa-ma-hoa.pem (từ khóa riêng của tài khoản dịch vụ) để mã hóa gói dữ liệu.
   2. Đăng firestore.rules nếu khác bản đang chạy.
   3. Giải mã, nhập từng gói data/inbox/*.enc vào Firestore; nhập xong xóa gói, ghi nhật ký (không ghi dữ liệu cá nhân).
   Gói: {v:1, alg:"RSA-OAEP-256+A256GCM", k, iv, tag, d} (base64). Nội dung sau giải mã là JSON:
     - {loai:"pna-hoso-sv", lops:[…], sinhVien:[…], nguon:[…]}  → hồ sơ sinh viên (gộp, không trùng)
     - {loai:"pna-firestore", ops:[{op:"set"|"merge"|"delete", path:"bộ/sưu/tập/id", data:{…}}]}  → ghi tùy ý
   Chạy thử cục bộ: FAKE_DB=/đường/dẫn/fake-admin.mjs FIREBASE_SERVICE_ACCOUNT="$(cat sa.json)" node tools/dongbo.mjs */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const P = (...a) => path.join(ROOT, ...a);
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
if (!sa.private_key) { console.error("Thiếu FIREBASE_SERVICE_ACCOUNT"); process.exit(1); }
const now = () => new Date().toISOString();
const LOG = P("data", "dong-bo-nhat-ky.md");
const log = [];
const note = s => { console.log(s); log.push(`- ${now().slice(0, 16).replace("T", " ")} UTC — ${s}`); };

/* ---------- Firestore (thật hoặc giả lập để chạy thử) ---------- */
let db, rulesApi;
if (process.env.FAKE_DB) ({ db, rulesApi } = await import(process.env.FAKE_DB).then(m => m.make()));
else {
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const { getSecurityRules } = await import("firebase-admin/security-rules");
  initializeApp({ credential: cert(sa), projectId: sa.project_id });
  db = getFirestore(); rulesApi = getSecurityRules();
}

/* ---------- 1. Khóa công khai ---------- */
const pub = crypto.createPublicKey(sa.private_key).export({ type: "spki", format: "pem" });
const pubPath = P("data", "khoa-ma-hoa.pem");
if (!fs.existsSync(pubPath) || fs.readFileSync(pubPath, "utf8") !== pub) { fs.writeFileSync(pubPath, pub); note("Công bố khóa công khai mã hóa (data/khoa-ma-hoa.pem)."); }

/* ---------- 2. Quy tắc bảo mật ---------- */
try {
  const src = fs.readFileSync(P("firestore.rules"), "utf8");
  let cur = ""; try { cur = (await rulesApi.getFirestoreRuleset()).source[0].content; } catch (e) {}
  if (cur.trim() !== src.trim()) { await rulesApi.releaseFirestoreRulesetFromSource(src); note("Đã đăng firestore.rules mới."); }
  else console.log("firestore.rules không đổi.");
} catch (e) { note("LỖI đăng firestore.rules: " + (e.message || e)); process.exitCode = 1; }

/* ---------- 3. Gói dữ liệu ---------- */
function open(pkg) {
  const k = crypto.privateDecrypt({ key: sa.private_key, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(pkg.k, "base64"));
  const dc = crypto.createDecipheriv("aes-256-gcm", k, Buffer.from(pkg.iv, "base64"));
  dc.setAuthTag(Buffer.from(pkg.tag, "base64"));
  return JSON.parse(Buffer.concat([dc.update(Buffer.from(pkg.d, "base64")), dc.final()]).toString("utf8"));
}
async function commitAll(writes) {   // writes: [ref, data, merge|null(=delete)]
  for (let i = 0; i < writes.length; i += 400) {
    const bt = db.batch();
    writes.slice(i, i + 400).forEach(([ref, data, merge]) => data === null ? bt.delete(ref) : bt.set(ref, data, merge ? { merge: true } : {}));
    await bt.commit();
  }
}
async function importHoso(data, by) {
  const at = now(), oldL = {}, oldS = {}, cv = {}, w = [];
  (await db.collection("pna_lop").get()).forEach(d => oldL[d.id] = d.data());
  (await db.collection("pna_hoso").get()).forEach(d => oldS[d.id] = d.data());
  for (const l of data.lops || []) {
    const o = oldL[l.id] || {};
    cv[l.id] = (o.cvht && o.cvht.length) ? o.cvht : (l.cvht || []);
    w.push([db.doc("pna_lop/" + l.id), { ten: o.ten || l.ten || "", nganh: l.nganh || o.nganh || "", khoa: l.khoa || o.khoa || "", he: l.he || "", cvht: cv[l.id], bcs: l.bcs || [], siSo: l.siSo || 0, ghiChu: l.ghiChu || "", updated: at }, true]);
  }
  const key = e => [e.loai, e.soQD, e.ngay, e.namHoc, e.noiDung].join("|");
  let moi = 0;
  for (const s of data.sinhVien || []) {
    const o = oldS[s.mssv] || {};
    const evs = (o.suKien || []).slice(), seen = new Set(evs.map(key)); let added = 0;
    (s.suKien || []).forEach(e => { if (!seen.has(key(e))) { evs.push(e); seen.add(key(e)); added++; } });
    const rec = { mssv: s.mssv, hoTen: s.hoTen, ten: s.ten, ngaySinh: s.ngaySinh || o.ngaySinh || "", lop: s.lop, nganh: s.nganh, khoa: s.khoa, he: s.he || "",
      cvht: cv[s.lop] || oldL[s.lop]?.cvht || o.cvht || [], drl: { ...(o.drl || {}), ...(s.drl || {}) }, suKien: evs,
      trangThai: !o.trangThai || added ? s.trangThai : o.trangThai,
      sdt: s.sdt || o.sdt || "", chucVu: s.chucVu || o.chucVu || "", chucVuNam: s.chucVuNam || o.chucVuNam || "",
      nguon: [...new Set([...(o.nguon || []), ...(data.nguon || [])])], updated: at, by };
    if (!o.mssv) { rec.created = at; moi++; }
    w.push([db.doc("pna_hoso/" + s.mssv), rec, true]);
  }
  await commitAll(w);
  return `${(data.lops || []).length} lớp, ${(data.sinhVien || []).length} hồ sơ (${moi} mới)`;
}
async function importOps(data) {
  const w = (data.ops || []).map(o => {
    if (!/^[^/]+(\/[^/]+\/[^/]+)*\/[^/]+$/.test(o.path) || o.path.split("/").length % 2) throw new Error("Đường dẫn tài liệu không hợp lệ: " + o.path);
    return [db.doc(o.path), o.op === "delete" ? null : o.data, o.op === "merge"];
  });
  await commitAll(w);
  return `${w.length} thao tác ghi`;
}
/* Chẩn đoán (không ghi dữ liệu cá nhân vào nhật ký) */
async function chanDoan(data) {
  const out = [];
  const cfg = fs.readFileSync(P("config.js"), "utf8"), key = (cfg.match(/apiKey:\s*"([^"]+)"/) || [])[1];
  if ((data.viec || []).includes("bat-dang-nhap-email") && !process.env.FAKE_DB) {
    try {
      const { cert } = await import("firebase-admin/app");
      const tok = (await cert(sa).getAccessToken()).access_token;
      const r = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${sa.project_id}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired`, { method: "PATCH", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify({ signIn: { email: { enabled: true, passwordRequired: true } } }) });
      const j = await r.json();
      out.push("Bật đăng nhập Email/Mật khẩu: " + (r.ok ? "THÀNH CÔNG (email.enabled=" + (j.signIn && j.signIn.email && j.signIn.email.enabled) + ")" : "LỖI " + r.status + " " + JSON.stringify(j.error && (j.error.message || j.error))));
    } catch (e) { out.push("Bật đăng nhập Email/Mật khẩu: lỗi " + e.message); }
  }
  if ((data.viec || []).includes("dang-ky")) {
    const em = "chandoan-" + Date.now() + "@taikhoan.pna";
    try {
      const r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + key, { method: "POST", headers: { "Content-Type": "application/json", Referer: "https://luuhuongnnpl-apag.github.io/PNA/", Origin: "https://luuhuongnnpl-apag.github.io" }, body: JSON.stringify({ email: em, password: "Thu12345678", returnSecureToken: true }) });
      const j = await r.json();
      out.push("Tạo tài khoản thử (email/mật khẩu): " + (r.ok ? "THÀNH CÔNG" : "LỖI " + r.status + " " + JSON.stringify(j.error && (j.error.message || j.error))));
      if (r.ok && !process.env.FAKE_DB) { const { getAuth } = await import("firebase-admin/auth"); await getAuth().deleteUser(j.localId); out.push("Đã xóa tài khoản thử."); }
    } catch (e) { out.push("Tạo tài khoản thử: lỗi gọi " + e.message); }
  }
  if ((data.viec || []).includes("cong-khai-tat-ca")) {
    // 28/11/2026: toàn bộ tài liệu, thư mục chuyển mức Công khai (giữ nguyên mục Mật)
    const w = [];
    for (const c of ["pna_items", "pna_catalog", "pna_tree"]) (await db.collection(c).get()).forEach(d => { const x = d.data(); if (x.access !== "mat" && x.access !== "cong-khai" && !(c === "pna_tree" && !x.access && x.parent)) w.push([d.ref, { access: "cong-khai" }, true]); });
    await commitAll(w); out.push(`Chuyển Công khai: ${w.length} tài liệu/thư mục`);
  }
  if ((data.viec || []).includes("dem")) {
    const cnt = async c => { let n = 0; (await db.collection(c).get()).forEach(() => n++); return n; };
    out.push(`Đếm: pna_accounts ${await cnt("pna_accounts")}, pna_sv ${await cnt("pna_sv")}, pna_hoso ${await cnt("pna_hoso")}, pna_lop ${await cnt("pna_lop")}, pna_ctdt ${await cnt("pna_ctdt")}`);
    if (!process.env.FAKE_DB) { const { getAuth } = await import("firebase-admin/auth"); const l = await getAuth().listUsers(1000); out.push(`Authentication: ${l.users.length} người dùng, ${l.users.filter(u => (u.email || "").endsWith("@taikhoan.pna")).length} tài khoản tên đăng nhập; nhà cung cấp: ${[...new Set(l.users.flatMap(u => u.providerData.map(p => p.providerId)))].join(", ")}`); }
  }
  if ((data.viec || []).includes("nhat-ky")) {
    const acts = []; (await db.collection("pna_activity").get()).forEach(d => acts.push(d.data()));
    acts.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    acts.filter(a => /^(SV_|LOP_|HOSO|DRL)/.test(a.action || "")).slice(0, 15).forEach(a => out.push(`HĐ ${a.at} ${a.action}: ${String(a.detail || "").slice(0, 160)}`));
  }
  return out.join(" ‖ ");
}
const inbox = P("data", "inbox");
const files = fs.existsSync(inbox) ? fs.readdirSync(inbox).filter(f => f.endsWith(".enc")).sort() : [];
for (const f of files) {
  try {
    const data = open(JSON.parse(fs.readFileSync(path.join(inbox, f), "utf8")));
    const by = "dong-bo:" + (data.nguoiGui || "claude");
    const kq = data.loai === "pna-hoso-sv" ? await importHoso(data, by) : data.loai === "pna-firestore" ? await importOps(data) : data.loai === "pna-chan-doan" ? await chanDoan(data) : (() => { throw new Error("Loại gói không hỗ trợ: " + data.loai); })();
    await db.doc("pna_sync/" + f.replace(/[^\w.-]/g, "_")).set({ tep: f, loai: data.loai, moTa: data.moTa || "", ketQua: kq, at: now() });
    fs.unlinkSync(path.join(inbox, f));
    note(`Nhập ${f}: ${data.moTa ? data.moTa + " — " : ""}${kq}.`);
  } catch (e) { note(`LỖI nhập ${f}: ${e.message || e}`); process.exitCode = 1; }
}
if (!files.length) console.log("Không có gói dữ liệu mới.");

/* ---------- 4. Yêu cầu đặt lại mật khẩu (pna_yeucau_tk) ----------
   Người gửi phải là quản trị viên hoặc cố vấn học tập của sinh viên đó; chỉ áp dụng cho tài khoản tên đăng nhập (@taikhoan.pna)
   không phải quản trị viên. Áp dụng xong xóa trường matKhau. Nhật ký không ghi tên tài khoản. */
const SUPER = ["luuhuong.dhnv@gmail.com", "luuhuong.nnpl@gmail.com"];
try {
  const snap = await db.collection("pna_yeucau_tk").where("tt", "==", "cho").get(); const reqs = [];
  snap.forEach(d => reqs.push({ ref: d.ref, ...d.data() }));
  if (reqs.length) {
    const authAdm = process.env.FAKE_DB ? (await import(process.env.FAKE_DB)).fakeAuth() : (await import("firebase-admin/auth")).getAuth();
    const FV = process.env.FAKE_DB ? { delete: () => null } : (await import("firebase-admin/firestore")).FieldValue;
    let ok = 0, bad = 0;
    for (const r of reqs) {
      let kq = "", tt = "loi";
      try {
        const em = String(r.email || "").toLowerCase(), by = String(r.by || "").toLowerCase();
        if (!em.endsWith("@taikhoan.pna")) throw new Error("chỉ đặt lại được tài khoản tên đăng nhập");
        if (String(r.matKhau || "").length < 6) throw new Error("mật khẩu quá ngắn");
        const accBy = (await db.doc("pna_accounts/" + by).get()).data() || {}, accEm = (await db.doc("pna_accounts/" + em).get()).data() || {};
        const admin = SUPER.includes(by) || (accBy.role === "quan-tri" && !accBy.disabled);
        const sv = (await db.doc("pna_sv/" + em).get()).data();
        const cvht = !accBy.disabled && accBy.role === "cvht" && sv && (sv.cvht || []).includes(by) && (accEm.role || "sinh-vien") === "sinh-vien";
        if (!admin && !cvht) throw new Error("người gửi không có quyền với tài khoản này");
        if (accEm.role === "quan-tri" && !SUPER.includes(by)) throw new Error("không đặt lại mật khẩu tài khoản quản trị");
        try { const u = await authAdm.getUserByEmail(em); await authAdm.updateUser(u.uid, { password: String(r.matKhau) }); kq = "Đã đặt mật khẩu mới"; }
        catch (e) { if (String(e.code || e.message).includes("user-not-found")) { await authAdm.createUser({ email: em, password: String(r.matKhau) }); kq = "Tài khoản chưa có trong hệ thống đăng nhập — đã tạo mới với mật khẩu này"; } else throw e; }
        tt = "xong"; ok++;
      } catch (e) { kq = e.message || String(e); bad++; }
      await r.ref.set({ tt, ketQua: kq, xong: now(), matKhau: FV.delete() }, { merge: true });
    }
    note(`Đặt lại mật khẩu: ${ok} tài khoản thành công${bad ? `, ${bad} yêu cầu bị từ chối/lỗi` : ""}.`);
  }
} catch (e) { note("LỖI xử lý yêu cầu đặt lại mật khẩu: " + (e.message || e)); process.exitCode = 1; }

if (log.length) {
  const head = "# Nhật ký đồng bộ Firebase (tự động)\n\n";
  const old = fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").replace(head, "") : "";
  fs.writeFileSync(LOG, head + log.join("\n") + "\n" + old);
}
