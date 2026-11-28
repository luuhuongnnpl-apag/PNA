/* Mã hóa một tệp JSON thành gói dữ liệu cho data/inbox (chỉ GitHub Actions giải mã được).
   node tools/mahoa.mjs <tệp.json> [mô tả ngắn]  → data/inbox/<thời điểm>-<tên>.enc
   Tệp JSON: {loai:"pna-hoso-sv", …} hoặc {loai:"pna-firestore", ops:[…]} (xem tools/dongbo.mjs). */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [src, moTa = ""] = process.argv.slice(2);
if (!src) { console.error("Cách dùng: node tools/mahoa.mjs <tệp.json> [mô tả]"); process.exit(1); }
const pemPath = path.join(ROOT, "data", "khoa-ma-hoa.pem");
if (!fs.existsSync(pemPath)) { console.error("Chưa có data/khoa-ma-hoa.pem (GitHub Actions tạo sau khi có secret FIREBASE_SERVICE_ACCOUNT)."); process.exit(2); }
const data = JSON.parse(fs.readFileSync(src, "utf8"));
if (moTa) data.moTa = moTa;
const key = crypto.randomBytes(32), iv = crypto.randomBytes(12);
const c = crypto.createCipheriv("aes-256-gcm", key, iv);
const d = Buffer.concat([c.update(JSON.stringify(data), "utf8"), c.final()]);
const k = crypto.publicEncrypt({ key: fs.readFileSync(pemPath, "utf8"), padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, key);
const name = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "-" + path.basename(src).replace(/\.json$/i, "").replace(/[^\w.-]/g, "_") + ".enc";
fs.mkdirSync(path.join(ROOT, "data", "inbox"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "data", "inbox", name), JSON.stringify({ v: 1, alg: "RSA-OAEP-256+A256GCM", k: k.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), d: d.toString("base64") }));
console.log("data/inbox/" + name);
