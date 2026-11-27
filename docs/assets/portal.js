import {resourcePages, studentPages, categories, importance, cohorts, curricula, sampleNotices} from './portal-data.js?v=015';
import {checkFile, extractText, getAttachment, removeAttachment, saveAttachment, suggestNotice} from './portal-files.js?v=015';
import {createEditorial, validEditorial} from './editorial.js?v=016';

const el = id => document.getElementById(id);
const editorial = createEditorial(el('editorial'));
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const categoryLabel = value => categories.find(([key]) => key === value)?.[1] || 'Thông báo chung';
const dateLabel = date => date ? date.split('-').reverse().join('/') : 'Không nêu';
const option = (value, title, selected) =>
  `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(title)}</option>`;
const routeLink = (id, text, current) =>
  `<a href="#${esc(id)}" ${id === current ? 'aria-current="page"' : ''}>${esc(text)}</a>`;
const heading = title => `<h2 id="pageTitle" tabindex="-1">${esc(title)}</h2>`;
const card = (title, body) => `<article class="card">${heading(title)}${body}</article>`;
const pending = 'Nội dung sẽ được bổ sung tại đây.';
const previewHint = 'Dữ liệu thử lưu trên trình duyệt này. Chỉ dùng thông tin giả lập.';
const navStorage = 'pna-portal-navigation-v1';
const noticeStorage = 'pna-portal-notices-v1';
const notices = () => [...read(noticeStorage, []), ...sampleNotices];
const mediaUrls = new Set();
let session = {role: 'guest', uid: null};
let conductMode = 'student';
let previousRoute = '';
let renderId = 0;
let renderedAdminUid = null;

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function studentKey() { return 'pna-portal-student-v1:' + session.uid; }
function studentData() { return read(studentKey(), {}); }
function saveStudent(data) { localStorage.setItem(studentKey(), JSON.stringify(data)); }
function admin() { return session.role === 'admin'; }
function studentAccess() { return ['student', 'advisor', 'admin'].includes(session.role) && !!session.uid; }
function resourceItems() { return [...resourcePages, ...read(navStorage, []).map(item => [item.id, item.title])]; }

function report(message, error = false) {
  const feedback = el('feedback');
  feedback.hidden = !message;
  feedback.textContent = message;
  feedback.classList.toggle('error', error);
}

function renderNav(route) {
  const resources = resourceItems().map(([id, title]) => routeLink(id, title, route)).join('');
  const students = studentPages.map(([id, title]) => routeLink(id, title, route)).join('');
  el('navigation').innerHTML = `
    <div class="nav-group">
      <h2><a href="#home" ${route === 'home' ? 'aria-current="page"' : ''}><span aria-hidden="true">⌂</span> TRANG CHỦ</a></h2>
      <div class="nav-items">${resources}</div>
    </div>
    <div class="nav-group">
      <h2><span><span aria-hidden="true">▤</span> HỒ SƠ SINH VIÊN</span></h2>
      <div class="nav-items">${students}</div>
    </div>`;
}

function noticeMeta(item) {
  return `<div class="metadata"><span>Thời hạn: <strong>${esc(dateLabel(item.deadline))}</strong></span>
    <span>Mức độ: <strong>${esc(item.level)}</strong></span></div>`;
}

function announcementCard(item) {
  return `<article class="announcement">
    ${item.image ? `<img data-image="${esc(item.image.key)}" alt="" hidden>` : ''}
    <div class="announcement-content">
      <span class="category">${esc(categoryLabel(item.category))}</span>
      <h3><a href="#notice/${esc(item.id)}">${esc(item.title)}</a></h3>
      ${noticeMeta(item)}
      ${item.summary ? `<p class="muted">${esc(item.summary)}</p>` : ''}
    </div></article>`;
}

function archiveCards(items) {
  return categories.map(([key, label]) => {
    const count = items.filter(item => item.category === key).length;
    return `<a class="archive-link" href="#archive/${key}">${label}<small>${count} thông báo</small></a>`;
  }).join('');
}

function home() {
  const items = notices();
  return `<section class="card" aria-labelledby="pageTitle">
      ${heading('Thông báo mới')}
      <div class="announcement-grid">${items.slice(0, 6).map(announcementCard).join('')}</div>
    </section>
    <section class="card" aria-labelledby="archiveTitle">
      <h2 id="archiveTitle">Kho thông báo</h2>
      <div class="archive-grid">${archiveCards(items)}</div>
    </section>`;
}

function archive(key) {
  const items = notices().filter(item => item.category === key);
  const result = items.length ? `<div class="announcement-grid">${items.map(announcementCard).join('')}</div>` :
    '<p class="muted">Chưa có thông báo trong mục này.</p>';
  return card(categoryLabel(key), `<p><a href="#home">Về kho thông báo</a></p>${result}`);
}

function fileButton(file, text) {
  return file ? `<button class="secondary" type="button" data-download="${esc(file.key)}"
    data-filename="${esc(file.name)}">${esc(text || file.name)}</button>` : '';
}

function notice(id) {
  const item = notices().find(entry => entry.id === id);
  if (!item) return missing();
  return card(item.title, `<p><a href="#archive/${esc(item.category)}">${esc(categoryLabel(item.category))}</a></p>
    ${noticeMeta(item)}
    ${item.image ? `<img class="notice-image" data-image="${esc(item.image.key)}" alt="Ảnh minh họa thông báo" hidden>` : ''}
    <h3>Tóm tắt</h3><p>${esc(item.summary || 'Chưa có tóm tắt.')}</p>
    <h3>Toàn văn</h3><p class="notice-body">${esc(item.body || 'Xem tệp đính kèm để đọc toàn văn.')}</p>
    ${fileButton(item.file, 'Tải tệp gốc')}`);
}

function missing() {
  return card('Không tìm thấy trang', '<a href="#home">Về trang chủ</a>');
}

function resource(id, title) {
  const custom = read(navStorage, []).find(item => item.id === id);
  const body = custom?.body || pending;
  const curriculumInfo = id === 'curriculum' ? `<ul>${Object.entries(cohorts).map(([cohort, year]) =>
    `<li>Khóa ${cohort} · CTĐT ${year}</li>`).join('')}</ul>` : '';
  return card(title, `<p class="notice-body muted">${esc(body)}</p>${curriculumInfo}`);
}

function locked(title) {
  const message = session.uid ? 'Tài khoản này chưa được cấp quyền xem hồ sơ.' : 'Đăng nhập để mở hồ sơ sinh viên.';
  return card(title, `<p>${message}</p>`);
}

function profile() {
  const data = studentData().profile || {};
  const fields = [
    ['name', 'Họ và tên', data.name],
    ['code', 'Mã sinh viên', data.code],
    ['className', 'Lớp hành chính', data.className],
    ['program', 'Ngành đào tạo', data.program],
  ].map(([name, title, value]) => `<label>${title}<input name="${name}" maxlength="120" value="${esc(value)}"></label>`).join('');
  return card('Thông tin cá nhân', `<p class="muted">${previewHint}</p>
    <form id="profileForm" class="form-grid">${fields}
      <label>Khóa tuyển sinh<select name="cohort">
        ${option('', 'Chọn khóa', data.cohort)}
        ${Object.keys(cohorts).map(key => option(key, key, data.cohort)).join('')}
      </select></label>
      <label class="span">Ghi chú<textarea name="note" maxlength="1500">${esc(data.note)}</textarea></label>
      <div class="actions span"><button>Lưu thông tin</button>
        <button type="button" class="secondary danger" id="deleteProfile" ${Object.keys(data).length ? '' : 'hidden'}>Xóa thông tin</button>
      </div>
    </form>`);
}

function courses(cohort) {
  const data = studentData();
  const year = cohorts[cohort];
  const terms = year ? [...new Set(curricula[year].map(course => course[2]))] : [];
  const blocks = year ? terms.map(term => `
    <h3>Học kỳ ${term}</h3>
    <div class="table-scroll"><table class="course-table" aria-label="Học kỳ ${term}">
      <thead><tr><th scope="col">Học phần</th><th scope="col">Tích lũy</th><th scope="col">Học lại</th><th scope="col">Cải thiện</th><th scope="col">Điểm /10</th></tr></thead>
      <tbody>${curricula[year].filter(course => course[2] === term).map(([id, title, , elective]) => {
        const saved = data.courses?.[year]?.[id] || {};
        return `<tr><th scope="row">${elective ? `<em>${title} · tự chọn</em>` : title}</th>
          <td><select name="${id}-status" aria-label="Tích lũy: ${title}">
            ${option('', 'Chưa ghi nhận', saved.status)}${option('passed', 'Đã tích lũy', saved.status)}
            ${option('pending', 'Chưa tích lũy', saved.status)}</select></td>
          <td><input type="checkbox" name="${id}-retake" aria-label="Đang học lại: ${title}" ${saved.retake ? 'checked' : ''}></td>
          <td><input type="checkbox" name="${id}-improve" aria-label="Học cải thiện: ${title}" ${saved.improve ? 'checked' : ''}></td>
          <td><input type="number" min="0" max="10" step=".01" name="${id}-score" value="${esc(saved.score)}" aria-label="Điểm: ${title}"></td></tr>`;
      }).join('')}</tbody></table></div>`).join('') : '<p class="muted">Chọn khóa để xem các học phần theo học kỳ.</p>';
  return card('Quản lý học phần', `<p class="muted">Danh sách minh họa theo khung CTĐT 2023 và 2025. ${previewHint}</p>
    <form id="courseForm" class="course-form">
      <label>Khóa tuyển sinh<select id="courseCohort" name="cohort">
        ${option('', 'Chọn khóa', cohort)}
        ${Object.entries(cohorts).map(([key, mapped]) => option(key, key + ' · CTĐT ' + mapped, cohort)).join('')}
      </select></label>
      ${blocks}
      ${year ? '<div class="actions"><button>Lưu tiến độ học phần</button></div>' : ''}
    </form>`);
}

const statuses = {submitted: 'Chờ ban cán sự', reviewed: 'Chờ cố vấn', approved: 'Đã phê duyệt'};
const criteria = [
  ['learning', 'Ý thức và kết quả học tập', 20],
  ['rules', 'Chấp hành nội quy, quy chế', 25],
  ['participation', 'Tham gia hoạt động và phong trào', 20],
  ['citizenship', 'Trách nhiệm công dân', 25],
  ['contribution', 'Đóng góp cho lớp và thành tích', 10],
];
const total = scores => criteria.reduce((sum, [key]) => sum + Number(scores?.[key] || 0), 0);
const conductLabels = [['student', 'Sinh viên'], ['officer', 'Ban cán sự'], ['advisor', 'Cố vấn học tập']];

function conduct() {
  const data = studentData();
  const records = data.conduct || [];
  const reviewMode = session.role === 'advisor' ? 'advisor' : admin() ? conductMode : 'student';
  const modePicker = admin() ? `<label>Thử luồng theo vai trò<select id="conductMode">
    ${conductLabels.map(([key, label]) => option(key, label, reviewMode)).join('')}</select></label>` : '';
  const steps = `<ol class="flow" aria-label="Luồng xử lý">
    ${conductLabels.map(([key, label]) => `<li ${key === reviewMode ? 'aria-current="step"' : ''}>${label}</li>`).join('')}
  </ol>`;
  const results = records.filter(record => record.status === 'approved');
  const statistics = reviewMode === 'advisor' ? `<section><h3>Thống kê và ghi chú tổng</h3>
    <p>Đã phê duyệt ${results.length}/${records.length} phiếu · Điểm trung bình: <strong>${results.length ?
      (results.reduce((sum, record) => sum + total(record.reviewScores), 0) / results.length).toFixed(1) : '—'}</strong></p>
    <form id="conductSummaryForm" class="form-grid">
      <label class="span">Ghi chú tổng<textarea name="summary" maxlength="3000">${esc(data.conductSummary)}</textarea></label>
      <div class="span"><button>Lưu ghi chú tổng</button></div>
    </form></section>` : '';
  const rows = records.map(record => {
    const selectable = reviewMode === 'advisor' && record.status === 'reviewed';
    const contents = [
      `<h3>${esc(record.student || 'Sinh viên mẫu')} · ${esc(record.term)}</h3>`,
      `<p><strong>${statuses[record.status]}</strong> · Tự đánh giá <strong>${total(record.scores)}/100</strong>
        ${record.reviewScores ? ` · Rà soát <strong>${total(record.reviewScores)}/100</strong>` : ''}</p>`,
      record.achievements ? `<p class="notice-body">${esc(record.achievements)}</p>` : '',
      record.reviewNote ? `<p class="notice-body">Ghi chú rà soát: ${esc(record.reviewNote)}</p>` : '',
      fileButton(record.evidence, 'Tải minh chứng'),
    ].join('');
    if (reviewMode === 'officer' && record.status === 'submitted') {
      return `<article class="card">${contents}
        <form class="form-grid review-form" data-id="${esc(record.id)}">
          ${scoreFields(record.scores)}
          <label class="span">Ghi chú rà soát<textarea name="note" maxlength="2000"></textarea></label>
          <div class="span"><button>Chuyển cố vấn phê duyệt</button></div>
        </form></article>`;
    }
    return `<article class="card">${contents}${selectable ?
      `<label class="inline"><input form="approveForm" name="selected" type="checkbox" value="${esc(record.id)}">Chọn phiếu</label>` : ''}
      ${reviewMode === 'student' && record.status === 'submitted' ?
        `<button type="button" class="secondary" data-edit-conduct="${esc(record.id)}">Sửa phiếu</button>` : ''}
      </article>`;
  }).join('');
  const actions = reviewMode === 'advisor' && records.some(record => record.status === 'reviewed') ?
    '<form id="approveForm" class="actions"><button value="selected">Phê duyệt đã chọn</button><button value="all" class="secondary">Phê duyệt tất cả phiếu chờ</button></form>' : '';
  return `<section class="card">${heading('Đánh giá rèn luyện')}<p class="muted">Mẫu kê khai tạm. ${previewHint}</p>
    ${modePicker}${steps}
    ${reviewMode === 'student' ? conductForm() : ''}
    ${actions}${statistics}
    </section>${rows || '<p class="muted">Chưa có phiếu rèn luyện.</p>'}`;
}

function scoreFields(scores = {}) {
  return criteria.map(([key, label, max]) => `<label>${label} (tối đa ${max})
    <input name="${key}" type="number" min="0" max="${max}" step="1" required value="${esc(scores[key] ?? 0)}">
    </label>`).join('');
}

function conductForm(record = {}) {
  return `<form id="conductForm" class="form-grid" data-id="${esc(record.id)}">
    <label>Tên hiển thị thử<input name="student" maxlength="120" required value="${esc(record.student)}"></label>
    <label>Học kỳ / năm học<input name="term" maxlength="80" required placeholder="HK1 · 2026–2027" value="${esc(record.term)}"></label>
    ${scoreFields(record.scores)}
    <label class="span">Kê khai thành tích<textarea name="achievements" maxlength="5000">${esc(record.achievements)}</textarea></label>
    <label class="span">Minh chứng ${record.evidence ? '(đang có tệp: ' + esc(record.evidence.name) + ')' : ''}
      <input type="file" name="evidence" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.txt"></label>
    <div class="actions span"><button>Gửi ban cán sự rà soát</button></div>
  </form>`;
}

function activities(route) {
  const title = route === 'activities' ? 'Hoạt động đoàn thể' : 'Hoạt động khác';
  const items = studentData()[route] || [];
  const rows = items.map(item => `<div class="doc"><div><strong>${esc(item.title)}</strong>
    <div>${esc(dateLabel(item.date))} ${item.points ? ' · +' + esc(item.points) + ' điểm' : ''}</div>
    <p class="notice-body">${esc(item.note)}</p>${fileButton(item.file, 'Tải minh chứng')}</div>
    <div class="actions"><button type="button" class="secondary" data-edit-activity="${esc(item.id)}">Sửa</button>
      <button type="button" class="secondary danger" data-delete-activity="${esc(item.id)}">Xóa</button></div></div>`).join('');
  return card(title, `<p class="muted">${previewHint}</p>${activityForm()}
    <h3>Hoạt động đã ghi nhận</h3>${rows || '<p class="muted">Chưa có hoạt động.</p>'}`);
}

function activityForm(item = {}) {
  return `<form id="activityForm" class="form-grid" data-id="${esc(item.id)}">
    <label>Tên hoạt động<input name="title" maxlength="160" required value="${esc(item.title)}"></label>
    <label>Ngày tham gia<input name="date" type="date" required value="${esc(item.date)}"></label>
    <label>Điểm cộng (nếu có)<input name="points" type="number" min="0" max="100" step=".1" value="${esc(item.points)}"></label>
    <label>Thành tích, giấy khen hoặc ghi chú<textarea name="note" maxlength="2500">${esc(item.note)}</textarea></label>
    <label class="span">Minh chứng ${item.file ? '(đang có tệp: ' + esc(item.file.name) + ')' : ''}
      <input type="file" name="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.txt"></label>
    <div class="actions span"><button>Lưu hoạt động</button></div>
  </form>`;
}

function adminContent() {
  el('adminContent').innerHTML = `
    <details class="admin-section">
      <summary>Danh mục hiển thị thử trên trình duyệt</summary>
      <form id="navForm" class="form-grid">
        <label>Tên mục<input name="title" required maxlength="100"></label>
        <label>Nội dung trang<textarea name="body" maxlength="5000"></textarea></label>
        <div class="span"><button>Thêm mục</button></div>
      </form>
      ${read(navStorage, []).map(item => `<div class="doc"><a href="#${esc(item.id)}">${esc(item.title)}</a>
        <button type="button" class="secondary danger" data-remove-nav="${esc(item.id)}">Gỡ mục</button></div>`).join('')}
    </details>
    <section class="admin-section">
      <h3>Thông báo</h3>
      <p class="muted">Thông báo bạn thêm trong bản thử sẽ xuất hiện ở trang chủ và kho trên trình duyệt hiện tại.</p>
      <form id="noticeForm" class="form-grid">
        <label>Tệp văn bản<input name="file" type="file" accept=".pdf,.docx,.txt,.md"></label>
        <label>Ảnh minh họa<input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>
        <div class="span"><button type="button" class="secondary" id="extractNotice">Đọc tệp và điền gợi ý</button></div>
        <label class="span">Tên văn bản<input name="title" required maxlength="160"></label>
        <label>Loại thông báo<select name="category">${categories.map(([key, label]) => option(key, label, 'general')).join('')}</select></label>
        <label>Mức độ quan trọng<select name="level">${importance.map(label => option(label, label)).join('')}</select></label>
        <label>Thời hạn xử lý<input name="deadline" type="date"></label>
        <label class="span">Tóm tắt<textarea name="summary" maxlength="1200"></textarea></label>
        <label class="span">Toàn văn<textarea name="body" maxlength="180000"></textarea></label>
        <div class="span"><button>Lưu thông báo thử</button></div>
      </form>
      ${read(noticeStorage, []).map(item => `<div class="doc"><a href="#notice/${esc(item.id)}">${esc(item.title)}</a>
        <button type="button" class="secondary danger" data-remove-notice="${esc(item.id)}">Gỡ thông báo</button></div>`).join('')}
    </section>`;
}

function currentRoute() { return location.hash.slice(1) || 'home'; }

function render({focus = false, cohort} = {}) {
  const token = ++renderId;
  const route = currentRoute();
  const routeChanged = route !== previousRoute;
  previousRoute = route;
  if (routeChanged) report('');
  for (const url of mediaUrls) URL.revokeObjectURL(url);
  mediaUrls.clear();
  renderNav(route);
  const content = el('content');
  const showAdmin = route === 'admin' && admin();
  el('admin').hidden = !showAdmin;
  content.hidden = showAdmin;
  el('adminButton').hidden = !admin();
  el('adminButton').setAttribute('aria-pressed', String(showAdmin));
  if (showAdmin) {
    content.replaceChildren();
    if (renderedAdminUid !== session.uid || routeChanged) {
      editorial.open(session.uid, read(navStorage, []));
      adminContent();
    }
    renderedAdminUid = session.uid;
    if (focus) el('adminTitle').focus();
    return;
  }
  if (renderedAdminUid && !admin()) {
    editorial.close();
    el('adminContent').replaceChildren();
    el('grantForm').reset();
    el('builderStatus').textContent = '';
    renderedAdminUid = null;
  }
  const resourceItem = resourceItems().find(([id]) => id === route);
  const studentItem = studentPages.find(([id]) => id === route);
  if (route === 'home') content.innerHTML = home();
  else if (route.startsWith('archive/') && categories.some(([id]) => id === route.slice(8))) content.innerHTML = archive(route.slice(8));
  else if (route.startsWith('notice/')) content.innerHTML = notice(route.slice(7));
  else if (resourceItem) content.innerHTML = resource(...resourceItem);
  else if (studentItem && !studentAccess()) content.innerHTML = locked(studentItem[1]);
  else if (route === 'profile') content.innerHTML = profile();
  else if (route === 'courses') content.innerHTML = courses(cohort ?? studentData().courseCohort ?? studentData().profile?.cohort ?? '');
  else if (route === 'conduct') content.innerHTML = conduct();
  else if (route === 'activities' || route === 'other') content.innerHTML = activities(route);
  else if (route === 'admin') content.innerHTML = locked('Quản trị');
  else content.innerHTML = missing();
  if (focus) el('pageTitle').focus();
  for (const img of content.querySelectorAll('[data-image]')) {
    getAttachment(img.dataset.image).then(blob => {
      if (!blob || renderId !== token || !img.isConnected) return;
      const url = URL.createObjectURL(blob);
      mediaUrls.add(url);
      img.src = url;
      img.hidden = false;
    }).catch(() => {});
  }
}

function fields(form) {
  return Object.fromEntries([...new FormData(form)].map(([key, value]) =>
    [key, typeof value === 'string' ? value.trim() : value]));
}

function requireText(value) {
  if (!value) throw new Error('Hãy điền các trường bắt buộc.');
  return value;
}

function checkedScores(input) {
  return Object.fromEntries(criteria.map(([key, , maximum]) => {
    const score = Number(input[key]);
    if (input[key] === '' || !Number.isInteger(score) || score < 0 || score > maximum) {
      throw new Error('Kiểm tra lại điểm theo giới hạn của từng tiêu chí.');
    }
    return [key, score];
  }));
}

async function replaceFile(file, old, scope, write) {
  const replacement = await saveAttachment(file, scope);
  try { write(replacement || old || null); }
  catch (error) {
    await removeAttachment(replacement).catch(() => {});
    throw error;
  }
  if (replacement && old) await removeAttachment(old).catch(() => {});
}

async function saveConduct(form, input) {
  const uid = session.uid;
  const id = form.dataset.id;
  const data = studentData();
  const old = (data.conduct || []).find(item => item.id === id);
  if (id && old?.status !== 'submitted') throw new Error('Phiếu đã chuyển sang bước tiếp theo.');
  const record = {
    id: id || crypto.randomUUID(), student: requireText(input.student), term: requireText(input.term),
    scores: checkedScores(input), achievements: input.achievements, status: 'submitted',
  };
  await replaceFile(input.evidence, old?.evidence, uid, evidence => {
    if (!studentAccess() || session.uid !== uid) throw new Error('Phiên đăng nhập đã thay đổi.');
    const latest = studentData();
    const records = latest.conduct || [];
    if (id && records.find(item => item.id === id)?.status !== 'submitted') throw new Error('Phiếu đã chuyển bước.');
    latest.conduct = [{...record, evidence}, ...records.filter(item => item.id !== record.id)];
    saveStudent(latest);
  });
  return 'Đã chuyển phiếu đến bước rà soát trong bản thử.';
}

async function saveActivity(route, form, input) {
  const uid = session.uid;
  const id = form.dataset.id;
  const old = (studentData()[route] || []).find(item => item.id === id);
  const record = {id: id || crypto.randomUUID(), title: requireText(input.title), date: input.date,
    points: input.points, note: input.note};
  await replaceFile(input.file, old?.file, uid, file => {
    if (!studentAccess() || session.uid !== uid) throw new Error('Phiên đăng nhập đã thay đổi.');
    const data = studentData();
    data[route] = [{...record, file}, ...(data[route] || []).filter(item => item.id !== record.id)];
    saveStudent(data);
  });
  return 'Đã lưu hoạt động.';
}

async function saveNotice(input) {
  const uid = session.uid;
  const title = requireText(input.title);
  checkFile(input.file);
  checkFile(input.image);
  if (input.image?.name && !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(input.image.type)) {
    throw new Error('Chọn ảnh PNG, JPEG, WebP hoặc GIF.');
  }
  let file, image;
  try {
    file = await saveAttachment(input.file, 'notice');
    image = await saveAttachment(input.image, 'notice');
    if (!admin() || session.uid !== uid) throw new Error('Phiên quản trị đã thay đổi.');
    const record = {id: crypto.randomUUID(), title, image, file, summary: input.summary,
      body: input.body, category: input.category, level: input.level, deadline: input.deadline};
    localStorage.setItem(noticeStorage, JSON.stringify([record, ...read(noticeStorage, [])]));
  } catch (error) {
    await Promise.allSettled([removeAttachment(file), removeAttachment(image)]);
    throw error;
  }
  adminContent();
  return 'Đã lưu thông báo thử vào trang chủ và kho thông báo.';
}

async function submit(form, button) {
  const input = fields(form);
  const route = currentRoute();
  const data = studentAccess() ? studentData() : {};
  if (route === 'admin' && admin()) {
    if (form.id === 'navForm') {
      const item = {id: 'page-' + crypto.randomUUID(), title: requireText(input.title), body: input.body};
      const items = [...read(navStorage, []), item];
      if (!safeNav(items)) throw new Error('Danh mục hỗ trợ tối đa 100 mục bổ sung.');
      localStorage.setItem(navStorage, JSON.stringify(items));
      adminContent();
      return 'Đã thêm mục vào Trang chủ trên trình duyệt này.';
    }
    if (form.id === 'noticeForm') return saveNotice(input);
  }
  if (!studentAccess()) return '';
  if (route === 'profile' && form.id === 'profileForm') {
    if (input.cohort !== data.profile?.cohort) data.courseCohort = input.cohort;
    data.profile = input;
    saveStudent(data);
    return 'Đã lưu thông tin cá nhân.';
  }
  if (route === 'courses' && form.id === 'courseForm') {
    const year = cohorts[input.cohort];
    if (!year) throw new Error('Chọn khóa tuyển sinh.');
    data.courseCohort = input.cohort;
    data.courses ||= {};
    data.courses[year] = Object.fromEntries(curricula[year].map(([id]) => [id, {
      status: input[id + '-status'], retake: input[id + '-retake'] === 'on',
      improve: input[id + '-improve'] === 'on', score: input[id + '-score'],
    }]));
    saveStudent(data);
    render({cohort: input.cohort});
    return 'Đã lưu tiến độ học phần.';
  }
  if (route === 'conduct') {
    const mode = session.role === 'advisor' ? 'advisor' : admin() ? conductMode : 'student';
    if (form.id === 'conductForm' && mode === 'student') return saveConduct(form, input);
    if (form.classList.contains('review-form') && mode === 'officer') {
      const record = data.conduct?.find(item => item.id === form.dataset.id && item.status === 'submitted');
      if (!record) throw new Error('Phiếu không còn ở bước rà soát.');
      Object.assign(record, {reviewScores: checkedScores(input), reviewNote: input.note, status: 'reviewed'});
      saveStudent(data);
      return 'Đã chuyển phiếu sang bước cố vấn phê duyệt.';
    }
    if (form.id === 'approveForm' && mode === 'advisor') {
      const selected = new Set(new FormData(form).getAll('selected'));
      const records = (data.conduct || []).filter(item =>
        item.status === 'reviewed' && (button?.value === 'all' || selected.has(item.id)));
      if (!records.length) throw new Error('Chọn ít nhất một phiếu đang chờ phê duyệt.');
      for (const record of records) record.status = 'approved';
      saveStudent(data);
      return 'Đã phê duyệt ' + records.length + ' phiếu trong bản thử.';
    }
    if (form.id === 'conductSummaryForm' && mode === 'advisor') {
      data.conductSummary = input.summary;
      saveStudent(data);
      return 'Đã lưu ghi chú tổng.';
    }
  }
  if (['activities', 'other'].includes(route) && form.id === 'activityForm') return saveActivity(route, form, input);
  return '';
}

const portalForms = new Set(['navForm', 'noticeForm', 'profileForm', 'courseForm', 'conductForm', 'approveForm',
  'conductSummaryForm', 'activityForm']);
document.addEventListener('submit', async event => {
  const form = event.target;
  if (!portalForms.has(form.id) && !form.classList.contains('review-form')) return;
  event.preventDefault();
  if (form.dataset.saving) return;
  form.dataset.saving = 'true';
  const route = currentRoute();
  const uid = session.uid;
  const buttons = [...form.querySelectorAll('button')];
  for (const button of buttons) button.disabled = true;
  try {
    const result = await submit(form, event.submitter);
    if (result && route === currentRoute() && uid === session.uid) {
      if (form.id !== 'courseForm') render();
      report(result);
    }
  } catch (error) {
    if (route === currentRoute() && uid === session.uid) report(error.message || 'Không lưu được thay đổi.', true);
  } finally {
    for (const button of buttons) button.disabled = false;
    delete form.dataset.saving;
  }
});

async function fillNotice(button) {
  const form = button.form;
  const file = form.elements.file.files[0];
  if (!file) throw new Error('Chọn tệp PDF, Word hoặc văn bản trước.');
  button.disabled = true;
  try {
    report('Đang đọc tệp…');
    const body = await extractText(file);
    if (!button.isConnected || currentRoute() !== 'admin' || !admin()) return;
    if (form.elements.file.files[0] !== file) {
      report('Tệp đã thay đổi. Chọn đọc tệp để cập nhật gợi ý.');
      return;
    }
    if (!body) throw new Error('Không tìm thấy văn bản có thể đọc. Hãy nhập thủ công hoặc dùng PDF có lớp chữ.');
    const suggestions = suggestNotice(body);
    for (const [key, value] of Object.entries(suggestions)) form.elements[key].value = value;
    form.elements.body.value = body.slice(0, 180000);
    report('Đã điền gợi ý. Kiểm tra nội dung và thời hạn trước khi lưu.');
  } finally { button.disabled = false; }
}

document.addEventListener('change', event => {
  if (event.target.id === 'courseCohort' && studentAccess()) render({cohort: event.target.value});
  if (event.target.id === 'conductMode' && admin()) {
    conductMode = event.target.value;
    render();
  }
  if (event.target.name === 'file' && event.target.form?.id === 'noticeForm' && event.target.files.length && admin()) {
    fillNotice(el('extractNotice')).catch(error => report(error.message, true));
  }
});

document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button) return;
  try {
    const route = currentRoute();
    if (button.id === 'adminButton' && admin()) {
      location.hash = route === 'admin' ? 'home' : 'admin';
    } else if (button.id === 'extractNotice' && admin()) {
      await fillNotice(button);
    } else if (button.dataset.download) {
      const uid = session.uid;
      const blob = await getAttachment(button.dataset.download);
      if (!button.isConnected || route !== currentRoute() || uid !== session.uid) return;
      if (!blob) throw new Error('Tệp đính kèm hiện chỉ có trên thiết bị đã lưu tệp.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = button.dataset.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } else if (button.dataset.removeNav && admin() && confirm('Gỡ mục này khỏi Trang chủ?')) {
      const items = read(navStorage, []).filter(item => item.id !== button.dataset.removeNav);
      localStorage.setItem(navStorage, JSON.stringify(items));
      adminContent();
      render();
      report('Đã gỡ mục.');
    } else if (button.dataset.removeNotice && admin() && confirm('Gỡ thông báo thử này?')) {
      const items = read(noticeStorage, []);
      const item = items.find(entry => entry.id === button.dataset.removeNotice);
      localStorage.setItem(noticeStorage, JSON.stringify(items.filter(entry => entry !== item)));
      await Promise.allSettled([removeAttachment(item?.file), removeAttachment(item?.image)]);
      if (route !== currentRoute() || !admin()) return;
      adminContent();
      report('Đã gỡ thông báo.');
    } else if (button.id === 'deleteProfile' && studentAccess() && confirm('Xóa các trường thông tin cá nhân đã lưu?')) {
      const data = studentData();
      delete data.profile;
      saveStudent(data);
      render();
      report('Đã xóa thông tin cá nhân.');
    } else if (button.dataset.editConduct && studentAccess()) {
      const record = studentData().conduct?.find(item => item.id === button.dataset.editConduct);
      if (!record || record.status !== 'submitted') return;
      el('conductForm').outerHTML = conductForm(record);
      el('conductForm').elements.student.focus();
    } else if (button.dataset.editActivity && studentAccess()) {
      const item = studentData()[route]?.find(entry => entry.id === button.dataset.editActivity);
      if (!item) return;
      el('activityForm').outerHTML = activityForm(item);
      el('activityForm').elements.title.focus();
    } else if (button.dataset.deleteActivity && studentAccess() && confirm('Xóa hoạt động này?')) {
      const data = studentData();
      const item = data[route]?.find(entry => entry.id === button.dataset.deleteActivity);
      if (!item) return;
      data[route] = data[route].filter(entry => entry.id !== item.id);
      saveStudent(data);
      await removeAttachment(item.file).catch(() => {});
      if (route !== currentRoute() || !studentAccess()) return;
      render();
      report('Đã xóa hoạt động.');
    }
  } catch (error) { report(error.message || 'Không thể thực hiện thao tác.', true); }
});

const safeNav = items => Array.isArray(items) && items.length <= 100 && items.every(item =>
  item && /^page-[a-f0-9-]{36}$/.test(item.id) && typeof item.title === 'string' && item.title.length <= 100 &&
  typeof item.body === 'string' && item.body.length <= 5000) &&
  new Set(items.map(item => item.id)).size === items.length;

function layoutObject(raw) {
  try { return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}

window.PNA_LAYOUT = {
  read(existing) {
    if (!admin()) return null;
    const previous = layoutObject(existing);
    const legacy = previous?.type === 'pna-portal' ? previous.legacy : previous;
    return JSON.stringify({type: 'pna-portal', navigation: read(navStorage, []),
      legacy: legacy ?? read('pna-layout-v1', null), editorial: editorial.forCloud(previous?.editorial)});
  },
  saved(raw) { if (admin()) editorial.synced(layoutObject(raw)?.editorial); },
  load(raw) {
    if (!admin()) return false;
    const data = layoutObject(raw);
    if (data?.type !== 'pna-portal') {
      if (!data?.pages || typeof data.pages !== 'object') return false;
      localStorage.setItem('pna-layout-v1', raw);
      return true;
    }
    if (!safeNav(data.navigation) || (data.editorial != null && !validEditorial(data.editorial))) return false;
    localStorage.setItem(navStorage, JSON.stringify(data.navigation));
    editorial.open(session.uid, data.navigation);
    if (data.editorial) editorial.load(data.editorial);
    adminContent();
    render();
    return true;
  },
};
window.addEventListener('pna-auth', event => {
  const next = event.detail;
  if (session.role === next.role && session.uid === next.uid) return;
  if (session.uid !== next.uid || !next.uid) conductMode = 'student';
  session = next;
  render();
});
window.addEventListener('pna-auth-error', event => report(event.detail, true));
window.addEventListener('hashchange', () => render({focus: true}));
window.addEventListener('storage', event => {
  if ([navStorage, noticeStorage].includes(event.key)) render();
});
render();
