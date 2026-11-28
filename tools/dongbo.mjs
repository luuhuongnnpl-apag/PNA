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
const inbox = P("data", "inbox");
const files = fs.existsSync(inbox) ? fs.readdirSync(inbox).filter(f => f.endsWith(".enc")).sort() : [];
for (const f of files) {
  try {
    const data = open(JSON.parse(fs.readFileSync(path.join(inbox, f), "utf8")));
    const by = "dong-bo:" + (data.nguoiGui || "claude");
    const kq = data.loai === "pna-hoso-sv" ? await importHoso(data, by) : data.loai === "pna-firestore" ? await importOps(data) : (() => { throw new Error("Loại gói không hỗ trợ: " + data.loai); })();
    await db.doc("pna_sync/" + f.replace(/[^\w.-]/g, "_")).set({ tep: f, loai: data.loai, moTa: data.moTa || "", ketQua: kq, at: now() });
    fs.unlinkSync(path.join(inbox, f));
    note(`Nhập ${f}: ${data.moTa ? data.moTa + " — " : ""}${kq}.`);
  } catch (e) { note(`LỖI nhập ${f}: ${e.message || e}`); process.exitCode = 1; }
}
if (!files.length) console.log("Không có gói dữ liệu mới.");

if (log.length) {
  const head = "# Nhật ký đồng bộ Firebase (tự động)\n\n";
  const old = fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").replace(head, "") : "";
  fs.writeFileSync(LOG, head + log.join("\n") + "\n" + old);
}
