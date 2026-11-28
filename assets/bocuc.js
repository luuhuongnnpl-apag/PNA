/* =====================================================================
   BỐ CỤC TRANG — kéo thả các ô (Danh mục, Tổng quan, Công cụ, Liên kết, Thủ tục sinh viên…)
   giữa cột trái và cột phải. Quản trị viên bấm “Sắp xếp bố cục trang”, kéo thả rồi
   “Lưu cho mọi người” → pna_settings/layout { L:[ô…], R:[ô…] }. Mọi người dùng bố cục đã lưu.
   Mỗi ô nhận diện bằng data-box (hoặc id, ví dụ #ttBox do thutuc.js tạo).
   ===================================================================== */
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const P = window.PNA;
const $ = s => document.querySelector(s);
const CACHE = "pna_layout";
const COLS = { L: "#toolsCol", R: "#colR" };
const keyOf = el => el.dataset.box || el.id || "";
const boxes = col => [...$(COLS[col]).children].filter(keyOf);
const snapshot = () => ({ L: boxes("L").map(keyOf), R: boxes("R").map(keyOf) });
const findBox = k => document.querySelector(`#toolsCol>[data-box="${k}"],#colR>[data-box="${k}"]`) || (/^[\w-]+$/.test(k) ? document.querySelector(`#toolsCol>#${k},#colR>#${k}`) : null);

const DEFAULT = snapshot();          // bố cục gốc trong index.html (trước khi thutuc.js chèn ô)
let saved = null, arranging = false, before = null, dragEl = null;

function syncCols() { $("#layout").classList.toggle("has-r", arranging || boxes("R").length > 0); }

/* Đặt các ô theo bố cục; chỉ động vào DOM khi thứ tự đang khác (tránh vòng lặp với MutationObserver) */
function apply(lay) {
  if (!lay || arranging) return;
  for (const c of ["L", "R"]) {
    const want = (lay[c] || []).map(findBox).filter(Boolean);
    const col = $(COLS[c]);
    const cur = [...col.children].filter(el => want.includes(el));
    if (cur.length === want.length && cur.every((el, i) => el === want[i])) continue;
    want.forEach(el => col.appendChild(el));
  }
  syncCols();
}

function load() {
  try { saved = JSON.parse(localStorage.getItem(CACHE) || "null"); } catch (e) { saved = null; }
  apply(saved);
  getDoc(doc(P.db, "pna_settings", "layout")).then(s => {
    saved = s.exists() ? { L: s.data().L || [], R: s.data().R || [] } : null;
    try { saved ? localStorage.setItem(CACHE, JSON.stringify(saved)) : localStorage.removeItem(CACHE); } catch (e) {}
    apply(saved || DEFAULT);
  }).catch(e => console.warn("Bố cục", e.message));
}

/* Ô mới chèn sau (ví dụ Thủ tục sinh viên) → đưa về đúng chỗ */
const mo = new MutationObserver(() => { if (!arranging && saved) apply(saved); else syncCols(); });
Object.values(COLS).forEach(s => mo.observe($(s), { childList: true }));

/* ---------- Chế độ sắp xếp ---------- */
function setDrag(on) { document.querySelectorAll("#toolsCol>*,#colR>*").forEach(el => { if (keyOf(el)) el.draggable = on; }); }
function start() {
  if (!P.isAdmin) return;
  if (matchMedia("(max-width:1000px)").matches) { P.toast("Hãy sắp xếp bố cục trên màn hình máy tính (rộng hơn 1000 px).", "err"); return; }
  before = snapshot(); arranging = true;
  document.body.classList.add("arrange"); $("#arrBar").hidden = false; setDrag(true); syncCols();
  window.scrollTo({ top: $("#layout").offsetTop - 10, behavior: "smooth" });
}
function stop() {
  arranging = false; document.body.classList.remove("arrange"); $("#arrBar").hidden = true; setDrag(false); syncCols();
}
function place(lay) { arranging = false; apply(lay); arranging = true; syncCols(); }

document.addEventListener("dragstart", e => {
  if (!arranging) return;
  const el = e.target.closest && e.target.closest("#toolsCol>*,#colR>*");
  if (!el || !keyOf(el)) return;
  dragEl = el; el.classList.add("arr-drag");
  e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "pna-box");
  e.stopPropagation();
}, true);
document.addEventListener("dragend", () => { if (dragEl) dragEl.classList.remove("arr-drag"); dragEl = null; }, true);
for (const sel of Object.values(COLS)) {
  const col = $(sel);
  col.addEventListener("dragover", e => {
    if (!arranging || !dragEl) return;
    e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move";
    const next = [...col.children].filter(el => el !== dragEl && keyOf(el)).find(el => { const r = el.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
    if (next) { if (dragEl.nextElementSibling !== next || dragEl.parentNode !== col) col.insertBefore(dragEl, next); }
    else if (col.lastElementChild !== dragEl) col.appendChild(dragEl);
  });
  col.addEventListener("drop", e => { if (arranging && dragEl) { e.preventDefault(); e.stopPropagation(); } });
}

$("#btnLayout").addEventListener("click", start);
$("#arrCancel").addEventListener("click", () => { place(before); stop(); });
$("#arrReset").addEventListener("click", () => {
  const all = snapshot(), def = { L: DEFAULT.L.slice(), R: [] };
  [...all.L, ...all.R].forEach(k => { if (!def.L.includes(k)) def.L.splice(k === "ttBox" ? Math.min(2, def.L.length) : def.L.length, 0, k); });
  place(def);
});
$("#arrSave").addEventListener("click", async () => {
  const lay = snapshot(), btn = $("#arrSave"); btn.disabled = true;
  try {
    await setDoc(doc(P.db, "pna_settings", "layout"), { ...lay, updated: new Date().toISOString(), by: (P.user && P.user.email) || "" });
    saved = lay; try { localStorage.setItem(CACHE, JSON.stringify(lay)); } catch (e) {}
    stop(); P.toast("Đã lưu bố cục cho mọi người.", "ok");
  } catch (e) { P.toast("Chưa lưu được bố cục: " + e.message, "err"); }
  finally { btn.disabled = false; }
});
document.addEventListener("keydown", e => { if (arranging && e.key === "Escape") { place(before); stop(); } });
document.addEventListener("pna:auth", () => { if (arranging && !P.isAdmin) { place(before); stop(); } });

load();
