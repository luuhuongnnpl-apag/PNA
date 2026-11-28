/* =====================================================================
   BỐ CỤC TRANG — 3 cột: trái (Danh mục, Tổng quan, Công cụ, Liên kết) · giữa (nội dung) ·
   phải (Thủ tục sinh viên, Hồ sơ sinh viên). Quản trị viên kéo thả các ô:
   - Kéo trực tiếp: giữ chuột vào tiêu đề ô (biểu tượng ⠿), kéo sang vị trí mới → tự lưu cho mọi người.
   - Hoặc CÔNG CỤ → “Sắp xếp bố cục trang” để sắp nhiều ô rồi lưu một lần.
   Lưu: pna_settings/layout { L:[ô…], R:[ô…] }. Ô nhận diện bằng data-box hoặc id (#ttBox, #hsBox).
   ===================================================================== */
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const P = window.PNA;
const $ = s => document.querySelector(s);
const CACHE = "pna_layout2";
const COLS = { L: "#toolsCol", R: "#colR" };
const keyOf = el => (el && (el.dataset.box || el.id)) || "";
const boxes = col => [...$(COLS[col]).children].filter(keyOf);
const snapshot = () => ({ L: boxes("L").map(keyOf), R: boxes("R").map(keyOf) });
const findBox = k => document.querySelector(`#toolsCol>[data-box="${k}"],#colR>[data-box="${k}"]`) || (/^[\w-]+$/.test(k) ? document.querySelector(`#toolsCol>#${k},#colR>#${k}`) : null);
const wide = () => !matchMedia("(max-width:1000px)").matches;

const DEFAULT = { L: ["nav", "tongquan", "congcu", "lienket"], R: ["ttBox", "hsBox", "donvi"] };
let saved = null, arranging = false, live = false, before = null, dragEl = null;

function syncCols() { $("#layout").classList.toggle("has-r", arranging || live || boxes("R").length > 0); }
const cur = () => { const c = saved || DEFAULT; return [...(c.L || []), ...(c.R || [])].includes("donvi") ? c : { L: c.L || [], R: [...(c.R || []), "donvi"] }; };

/* Đặt các ô theo bố cục; chỉ động vào DOM khi thứ tự đang khác (tránh vòng lặp với MutationObserver) */
function apply(lay) {
  if (!lay || arranging || live) return;
  for (const c of ["L", "R"]) {
    const want = (lay[c] || []).map(findBox).filter(Boolean);
    const col = $(COLS[c]);
    const have = [...col.children].filter(el => want.includes(el));
    if (have.length === want.length && have.every((el, i) => el === want[i])) continue;
    want.forEach(el => col.appendChild(el));
  }
  syncCols();
}
function load() {
  try { saved = JSON.parse(localStorage.getItem(CACHE) || "null"); } catch (e) { saved = null; }
  apply(cur());
  getDoc(doc(P.db, "pna_settings", "layout")).then(s => {
    saved = s.exists() ? { L: s.data().L || [], R: s.data().R || [] } : null;
    try { saved ? localStorage.setItem(CACHE, JSON.stringify(saved)) : localStorage.removeItem(CACHE); } catch (e) {}
    apply(cur());
  }).catch(e => console.warn("Bố cục", e.message));
}
/* Ô chèn sau (Thủ tục sinh viên, Hồ sơ sinh viên) → đưa về đúng chỗ */
const mo = new MutationObserver(() => { if (!arranging && !live) apply(cur()); else syncCols(); });
Object.values(COLS).forEach(s => mo.observe($(s), { childList: true }));

async function persist(lay, quiet) {
  await setDoc(doc(P.db, "pna_settings", "layout"), { ...lay, updated: new Date().toISOString(), by: (P.user && P.user.email) || "" });
  saved = lay; try { localStorage.setItem(CACHE, JSON.stringify(lay)); } catch (e) {}
  if (!quiet) P.toast("Đã lưu bố cục cho mọi người.", "ok");
}

/* ---------- Kéo trực tiếp bằng tiêu đề ô (quản trị) ---------- */
const HANDLE = "#toolsCol>*>.sbox-title,#colR>*>.sbox-title,#toolsCol>*>.sec-title,#colR>*>.sec-title";
function markHandles() {
  const on = !!P.isAdmin;
  document.body.classList.toggle("can-arrange", on);
  document.querySelectorAll(HANDLE).forEach(h => { if (on) h.title = "Giữ chuột và kéo để đổi vị trí ô này"; else h.removeAttribute("title"); });
}
document.addEventListener("mousedown", e => {
  if (arranging || !P.isAdmin || !wide()) return;
  const h = e.target.closest && e.target.closest(HANDLE); if (!h) return;
  h.parentElement.draggable = true;
});
document.addEventListener("mouseup", () => { if (!arranging && !dragEl) document.querySelectorAll("#toolsCol>*,#colR>*").forEach(el => el.draggable = false); });

document.addEventListener("dragstart", e => {
  const el = e.target.closest && e.target.closest("#toolsCol>*,#colR>*");
  if (!el || !keyOf(el) || !el.draggable || !(arranging || P.isAdmin)) return;
  if (!arranging) { before = snapshot(); live = true; document.body.classList.add("arr-live"); syncCols(); }
  dragEl = el; el.classList.add("arr-drag");
  e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "pna-box");
  e.stopPropagation();
}, true);
document.addEventListener("dragend", async () => {
  if (!dragEl) return;
  dragEl.classList.remove("arr-drag"); if (!arranging) dragEl.draggable = false; dragEl = null;
  if (live) {
    live = false; document.body.classList.remove("arr-live"); syncCols();
    const now = snapshot();
    if (JSON.stringify(now) !== JSON.stringify(before)) { try { await persist(now); } catch (e) { P.toast("Chưa lưu được bố cục: " + e.message, "err"); apply(before); } }
  }
}, true);
for (const sel of Object.values(COLS)) {
  const col = $(sel);
  col.addEventListener("dragover", e => {
    if (!dragEl) return;
    e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move";
    const next = [...col.children].filter(el => el !== dragEl && keyOf(el)).find(el => { const r = el.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
    if (next) { if (dragEl.nextElementSibling !== next || dragEl.parentNode !== col) col.insertBefore(dragEl, next); }
    else if (col.lastElementChild !== dragEl) col.appendChild(dragEl);
  });
  col.addEventListener("drop", e => { if (dragEl) { e.preventDefault(); e.stopPropagation(); } });
}

/* ---------- Chế độ sắp xếp nhiều ô ---------- */
function setDrag(on) { document.querySelectorAll("#toolsCol>*,#colR>*").forEach(el => { if (keyOf(el)) el.draggable = on; }); }
function start() {
  if (!P.isAdmin) return;
  if (!wide()) { P.toast("Hãy sắp xếp bố cục trên màn hình máy tính (rộng hơn 1000 px).", "err"); return; }
  before = snapshot(); arranging = true;
  document.body.classList.add("arrange"); $("#arrBar").hidden = false; setDrag(true); syncCols();
  window.scrollTo({ top: $("#layout").offsetTop - 10, behavior: "smooth" });
}
function stop() { arranging = false; document.body.classList.remove("arrange"); $("#arrBar").hidden = true; setDrag(false); syncCols(); }
function place(lay) { const a = arranging; arranging = false; apply(lay); arranging = a; syncCols(); }

$("#btnLayout").addEventListener("click", start);
$("#arrCancel").addEventListener("click", () => { place(before); stop(); });
$("#arrReset").addEventListener("click", () => place(DEFAULT));
$("#arrSave").addEventListener("click", async () => {
  const btn = $("#arrSave"); btn.disabled = true;
  try { await persist(snapshot()); stop(); } catch (e) { P.toast("Chưa lưu được bố cục: " + e.message, "err"); }
  finally { btn.disabled = false; }
});
document.addEventListener("keydown", e => { if (arranging && e.key === "Escape") { place(before); stop(); } });
document.addEventListener("pna:auth", () => { markHandles(); if (arranging && !P.isAdmin) { place(before); stop(); } });

load();
