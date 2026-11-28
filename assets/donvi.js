/* =====================================================================
   Ô "THÔNG TIN CÁC ĐƠN VỊ" (cột phải trang chủ) — bảng trắng quản trị viên tự gõ, sửa, lưu.
   Lưu: pna_settings/donvi { html, updated, by }. Mọi người xem; quản trị viên bấm ✎ Sửa để soạn trực tiếp.
   Nội dung khởi tạo: danh sách đơn vị theo cổng thông tin apag.edu.vn (28/11/2026).
   ===================================================================== */
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const P = window.PNA;
const $ = s => document.querySelector(s);
const CACHE = "pna_donvi";
const DEF = `<p><b>Học viện Hành chính và Quản trị công</b><br>Trụ sở chính: 77 Nguyễn Chí Thanh, phường Giảng Võ, Hà Nội · ĐT (024) 38343223 · hanhchinhvaquantricong@apag.edu.vn</p>
<p><b>Cơ sở đào tạo tại Hà Nội</b>: 36 Xuân La và 371 Nguyễn Hoàng Tôn, phường Xuân Đỉnh.</p>
<p><b>Đơn vị chức năng</b></p><ul><li>Ban Quản lý đào tạo — phòng 101, tòa nhà A (23 tầng)</li><li>Ban Tổ chức cán bộ</li><li>Ban Kế hoạch - Tài chính</li><li>Ban Quản lý khoa học và Hợp tác quốc tế</li><li>Văn phòng</li></ul>
<p><b>Khoa, trung tâm</b></p><ul><li>Khoa Luật</li><li>Khoa Hành chính học</li><li>Khoa Quản trị nhân lực</li><li>Khoa Lưu trữ và Quản trị văn phòng</li><li>Khoa Quản lý phát triển xã hội</li><li>Khoa Kinh tế</li><li>Khoa Khoa học liên ngành - Ngoại ngữ - Tin học</li><li>Trung tâm Khảo thí và Đảm bảo chất lượng đào tạo</li><li>Trung tâm Thông tin - Thư viện</li><li>Tạp chí Quản lý nhà nước</li></ul>
<p><b>Đoàn thể</b>: Đoàn Thanh niên, Hội sinh viên Học viện.</p>
<p><b>Phân hiệu</b>: TP. Hồ Chí Minh (10 đường 3 Tháng 2, phường Hòa Hưng) · TP. Đà Nẵng (749 Trần Hưng Đạo, phường Điện Bàn Đông) · tỉnh Đắk Lắk (02 Trương Quang Tuân, phường Tân Lập).</p>
<p><i>Nguồn: apag.edu.vn. Quản trị viên bổ sung phòng làm việc, điện thoại, email, giờ tiếp sinh viên.</i></p>`;

/* Chỉ giữ thẻ định dạng an toàn */
const OK = new Set(["B", "STRONG", "I", "EM", "U", "P", "BR", "UL", "OL", "LI", "A", "H4", "DIV", "SPAN", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH"]);
function clean(html) {
  const d = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html").body.firstChild;
  (function walk(n) {
    [...n.childNodes].forEach(c => {
      if (c.nodeType === 3) return;
      if (c.nodeType !== 1 || !OK.has(c.tagName)) { if (c.nodeType === 1 && !/^(SCRIPT|STYLE|IFRAME|OBJECT)$/.test(c.tagName)) { walk(c); c.replaceWith(...c.childNodes); } else c.remove(); return; }
      [...c.attributes].forEach(a => { if (!(c.tagName === "A" && a.name === "href" && /^(https?:|mailto:|tel:|#)/i.test(a.value))) c.removeAttribute(a.name); });
      if (c.tagName === "A") { c.setAttribute("target", "_blank"); c.setAttribute("rel", "noopener"); }
      walk(c);
    });
  })(d);
  return d.innerHTML.trim();
}

let html = null;
function box() {
  let b = $("#dvBox");
  if (!b) { b = document.createElement("section"); b.className = "sbox"; b.id = "dvBox"; b.dataset.box = "donvi"; ($("#colR") || $("#toolsCol")).appendChild(b); }
  return b;
}
function draw() {
  const b = box();
  b.innerHTML = `<h3 class="sbox-title">THÔNG TIN CÁC ĐƠN VỊ</h3><div class="dv-body">${html || DEF}</div>
    ${P.isAdmin ? `<button type="button" class="sbtn" data-dvedit>✎ Sửa thông tin</button>` : ""}`;
  const e = b.querySelector("[data-dvedit]"); if (e) e.onclick = edit;
}
function edit() {
  const b = box(), body = b.querySelector(".dv-body");
  body.contentEditable = "true"; body.classList.add("dv-edit"); body.focus();
  b.querySelector("[data-dvedit]").remove();
  const bar = document.createElement("div"); bar.className = "dv-bar";
  bar.innerHTML = `<button type="button" data-c="bold" title="Đậm"><b>B</b></button><button type="button" data-c="italic" title="Nghiêng"><i>I</i></button><button type="button" data-c="insertUnorderedList" title="Danh sách">•</button><button type="button" data-c="createLink" title="Gắn liên kết">🔗</button>
    <span></span><button type="button" class="btn" data-x>Hủy</button><button type="button" class="btn primary" data-s>Lưu</button>`;
  body.before(bar);
  bar.querySelectorAll("[data-c]").forEach(x => x.onmousedown = ev => { ev.preventDefault(); const c = x.dataset.c; if (c === "createLink") { const u = prompt("Đường liên kết (https://…, mailto:, tel:)"); if (u) document.execCommand(c, false, u); } else document.execCommand(c); });
  bar.querySelector("[data-x]").onclick = draw;
  bar.querySelector("[data-s]").onclick = async () => {
    const h = clean(body.innerHTML);
    try { await setDoc(doc(P.db, "pna_settings", "donvi"), { html: h, updated: new Date().toISOString(), by: (P.user && P.user.email) || "" }); html = h; try { localStorage.setItem(CACHE, h); } catch (e) {} P.logAct("DONVI_SAVE", ""); P.toast("Đã lưu thông tin các đơn vị.", "ok"); draw(); }
    catch (e) { P.toast("Chưa lưu được: " + e.message, "err"); }
  };
}
try { html = localStorage.getItem(CACHE); } catch (e) {}
draw();
getDoc(doc(P.db, "pna_settings", "donvi")).then(s => { if (s.exists() && s.data().html) { html = s.data().html; try { localStorage.setItem(CACHE, html); } catch (e) {} } draw(); }).catch(() => {});
document.addEventListener("pna:auth", () => { if (!document.querySelector(".dv-edit")) draw(); });
