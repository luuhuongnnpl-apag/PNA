const maxFileBytes = 10 * 1024 * 1024;
let database;
function openFiles() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('pna-preview-files', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}

async function accessFile(mode, operation) {
  const db = await openFiles();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', mode);
    const result = operation(transaction.objectStore('files'));
    transaction.oncomplete = () => resolve(result.result);
    transaction.onabort = () => reject(transaction.error || new Error('Không thể lưu tệp.'));
    transaction.onerror = () => reject(transaction.error);
  });
}

export function checkFile(file) {
  if (file?.size > maxFileBytes) throw new Error('Mỗi tệp tối đa 10 MB.');
}

export async function saveAttachment(file, scope) {
  if (!file?.name) return null;
  checkFile(file);
  const key = scope + '/' + crypto.randomUUID();
  await accessFile('readwrite', store => store.put(file, key));
  return {key, name: file.name};
}

export function getAttachment(key) {
  return accessFile('readonly', store => store.get(key));
}

export function removeAttachment(file) {
  if (!file) return Promise.resolve();
  return accessFile('readwrite', store => store.delete(file.key));
}

let mammoth;
function loadMammoth() {
  if (!mammoth) mammoth = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.11.0/mammoth.browser.min.js';
    script.onload = () => resolve(window.mammoth);
    script.onerror = () => reject(new Error('Không tải được bộ đọc Word.'));
    document.head.append(script);
  }).catch(error => { mammoth = null; throw error; });
  return mammoth;
}

export async function extractText(file) {
  checkFile(file);
  const extension = file.name.toLowerCase().split('.').at(-1);
  if (['txt', 'md'].includes(extension)) return (await file.text()).trim();
  if (extension === 'docx') {
    const reader = await loadMammoth();
    const result = await reader.extractRawText({arrayBuffer: await file.arrayBuffer()});
    return result.value.trim();
  }
  if (extension === 'pdf') {
    const base = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/build/';
    const reader = await import(base + 'pdf.mjs');
    reader.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.mjs';
    const pdf = await reader.getDocument({data: await file.arrayBuffer(), isEvalSupported: false}).promise;
    try {
      const pages = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number);
        const text = await page.getTextContent();
        pages.push(text.items.map(item => (item.str || '') + (item.hasEOL ? '\n' : ' ')).join('').trim());
      }
      return pages.join('\n\n').trim();
    } finally {
      await pdf.destroy();
    }
  }
  return '';
}

export function suggestNotice(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const title = lines.find(line => /^(thông báo|quyết định|kế hoạch|công văn)\b/iu.test(line)) || lines[0] || '';
  const remaining = lines.filter(line => line !== title).join(' ') || title;
  const summary = remaining.length > 350 ? remaining.slice(0, 347).replace(/\s+\S*$/, '') + '…' : remaining;
  const date = text.match(/(?:thời hạn|hạn chót|trước ngày|chậm nhất)[^\n\d]{0,45}(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/iu);
  let deadline = '';
  if (date) {
    const iso = [date[3], date[2].padStart(2, '0'), date[1].padStart(2, '0')].join('-');
    const parsed = new Date(iso + 'T00:00:00Z');
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso) deadline = iso;
  }
  const category = /học phí/iu.test(title) ? 'tuition' : /hoạt động|đoàn thể/iu.test(title) ? 'activity' :
    /rèn luyện/iu.test(title) ? 'conduct' : /học phần|đào tạo|học kỳ/iu.test(title) ? 'academic' : 'general';
  const level = /(?:^|\s)(khẩn|hỏa tốc)(?:\s|$)/iu.test(text) ? 'Khẩn' :
    deadline || /quan trọng/iu.test(text) ? 'Quan trọng' : 'Bình thường';
  return {title: title.slice(0, 160), summary, deadline, category, level};
}
