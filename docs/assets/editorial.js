import {resourcePages} from './portal-data.js?v=016';

const blockTypes = {heading: 'Tiêu đề', text: 'Đoạn văn', list: 'Danh sách', callout: 'Ghi chú', link: 'Liên kết', collection: 'Cơ sở dữ liệu'};
const fieldTypes = {text: 'Văn bản', number: 'Số', date: 'Ngày', select: 'Lựa chọn'};
const emptyDraft = () => ({version: 1, pages: [], collections: []});
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);
const id = () => crypto.randomUUID();
const text = (value, maximum) => typeof value === 'string' && value.length <= maximum;
const items = (value, limit, validate) => Array.isArray(value) && value.length <= limit &&
  value.every(item => item && validate(item)) && new Set(value.map(item => item.id)).size === value.length;
const resourceIds = new Set(resourcePages.map(([key]) => key));
const byteSize = value => new TextEncoder().encode(JSON.stringify(value)).length;
const block = (type, value = '') => ({id: id(), type, value, url: '', view: 'table'});
const starterBlocks = template => template === 'guide' ?
  [block('heading', 'Đối tượng áp dụng'), block('text'), block('heading', 'Các bước thực hiện'), block('list'), block('callout')] : [];

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validValue(field, value) {
  return value === '' || (text(value, 500) && (
    field.type === 'text' || (field.type === 'number' && value.trim() !== '' && Number.isFinite(Number(value))) ||
    (field.type === 'date' && validDate(value)) || (field.type === 'select' && field.choices.includes(value))
  ));
}

function validBlocks(blocks) {
  return items(blocks, 60, item => uuid(item.id) && Object.hasOwn(blockTypes, item.type) &&
    text(item.value, 5000) && text(item.url, 2000) && ['table', 'cards'].includes(item.view));
}

export function validEditorial(draft) {
  if (!draft || draft.version !== 1 ||
      !items(draft.pages, 100, page => (uuid(page.id) || resourceIds.has(page.id)) &&
        text(page.title, 120) && (page.parent === '' || uuid(page.parent) || resourceIds.has(page.parent)) &&
        ['draft', 'ready'].includes(page.status) && validBlocks(page.blocks)) ||
      !items(draft.collections, 20, collection => uuid(collection.id) && text(collection.title, 120) &&
        items(collection.fields, 15, field => uuid(field.id) && text(field.title, 80) &&
          Object.hasOwn(fieldTypes, field.type) && Array.isArray(field.choices) && field.choices.length <= 15 &&
          field.choices.every(choice => text(choice, 80) && choice.trim()) &&
          new Set(field.choices).size === field.choices.length && (field.type !== 'select' || field.choices.length > 0)) &&
        items(collection.rows, 100, row => uuid(row.id) && text(row.title, 120) && validBlocks(row.blocks) &&
          row.values && typeof row.values === 'object' && !Array.isArray(row.values) &&
          Object.entries(row.values).every(([key, value]) => {
            const field = collection.fields.find(property => property.id === key);
            return field && validValue(field, value);
          })))) return false;
  const nodes = new Map(draft.pages.map(page => [page.id, page]));
  for (const page of draft.pages) {
    if (resourceIds.has(page.id) && page.parent) return false;
    const seen = new Set([page.id]);
    let parent = page.parent;
    while (parent) {
      if (seen.has(parent) || (!nodes.has(parent) && !resourceIds.has(parent))) return false;
      seen.add(parent);
      parent = nodes.get(parent)?.parent || '';
    }
  }
  return byteSize(draft) <= 350000;
}

const html = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[character]);
const option = (value, label, selected) => `<option value="${html(value)}" ${value === selected ? 'selected' : ''}>${html(label)}</option>`;
const options = (list, current) => list.map(([value, label]) => option(value, label, current)).join('');
const control = (action, label, value = '', extra = '') =>
  `<button type="button" class="secondary" data-editor="${action}" data-item="${html(value)}" ${extra}>${html(label)}</button>`;
const previewText = value => `<p class="notice-body">${html(value)}</p>`;
function https(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {}
  return '';
}
const shown = title => title.trim() || 'Chưa đặt tên';

function collectionView(collection, mode, action) {
  if (!collection.rows.length) return '<p class="muted">Chưa có mục dữ liệu.</p>';
  const shownValue = (field, row) => {
    const value = row.values[field.id];
    return value && field.type === 'date' ? value.split('-').reverse().join('/') : value || '—';
  };
  const rowTitle = row => action ? control(action, shown(row.title), collection.id + '/' + row.id) : html(shown(row.title));
  if (mode === 'cards') return `<div class="archive-grid">${collection.rows.map(row =>
    `<article class="archive-link"><strong>${rowTitle(row)}</strong><dl>${collection.fields.map(field =>
      `<dt>${html(field.title)}</dt><dd>${html(shownValue(field, row))}</dd>`).join('')}</dl></article>`).join('')}</div>`;
  return `<div class="table-scroll"><table aria-label="${html(collection.title)}"><thead><tr>
    <th scope="col">Tên mục</th>${collection.fields.map(field => `<th scope="col">${html(field.title)}</th>`).join('')}
    </tr></thead><tbody>${collection.rows.map(row => `<tr><th scope="row">${rowTitle(row)}</th>${collection.fields.map(field =>
      `<td>${html(shownValue(field, row))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderBlocks(blocks, collections) {
  return blocks.map(item => {
    switch (item.type) {
      case 'heading': return item.value.trim() ? `<h4>${html(item.value)}</h4>` : '';
      case 'list': return `<ul>${item.value.split('\n').filter(line => line.trim()).map(line => `<li>${html(line)}</li>`).join('')}</ul>`;
      case 'callout': return item.value.trim() ? `<aside class="editor-callout">${previewText(item.value)}</aside>` : '';
      case 'link': {
        const url = https(item.url);
        return url ? `<p><a href="${html(url)}" target="_blank" rel="noopener noreferrer">${html(item.value || url)}</a></p>` : '';
      }
      case 'collection': {
        const collection = collections.find(entry => entry.id === item.value);
        return collection ? `<h4>${html(shown(collection.title))}</h4>${collectionView(collection, item.view, 'preview-row')}` : '';
      }
      default: return item.value.trim() ? previewText(item.value) : '';
    }
  }).join('');
}

export function createEditorial(host) {
  let key = null;
  let legacy = [];
  let panel = 'pages';
  let pageId = resourcePages[0][0];
  let collectionId = null;
  let rowId = null;
  let preview = false;
  let view = 'table';
  let message = '';

  function read() {
    try {
      const draft = JSON.parse(localStorage.getItem(key));
      return validEditorial(draft) ? draft : null;
    } catch { return null; }
  }

  function pages(draft) {
    const existing = new Map(draft.pages.map(page => [page.id, page]));
    const roots = resourcePages.map(([item, title]) =>
      existing.get(item) || {id: item, title, parent: '', status: 'draft', blocks: []});
    return roots.concat(draft.pages.filter(page => !resourceIds.has(page.id)));
  }

  function readDraft() {
    const draft = read();
    if (draft) return draft;
    return {...emptyDraft(), pages: legacy.filter(item => item && typeof item.id === 'string' &&
      uuid(item.id.slice(5)) && text(item.title, 120) && text(item.body, 5000)).slice(0, 100).map(item => ({
      id: item.id.slice(5), title: item.title, parent: '', status: 'draft',
      blocks: item.body.trim() ? [block('text', item.body)] : [],
    }))};
  }

  function stamp(value, error = false) {
    message = value;
    const status = host.querySelector('[data-editor-status]');
    if (status) {
      status.textContent = value;
      status.classList.toggle('error', error);
    }
  }

  function change(update, redraw = true) {
    if (!key) return false;
    const draft = readDraft();
    try {
      update(draft);
      if (!validEditorial(draft)) throw new Error('Kiểm tra định dạng trường hoặc giới hạn dung lượng bản nháp.');
      localStorage.setItem(key, JSON.stringify(draft));
      stamp('Đã lưu trên trình duyệt.');
      if (redraw) draw();
      return true;
    } catch (error) {
      stamp(error.message || 'Chưa lưu được bản nháp.', true);
      return false;
    }
  }

  function active(draft) {
    if (panel === 'data') return draft.collections.find(item => item.id === collectionId)?.rows.find(row => row.id === rowId);
    const page = pages(draft).find(item => item.id === pageId);
    if (page && !draft.pages.some(item => item.id === pageId)) draft.pages.push(page);
    return page;
  }

  function order(all) {
    const walk = (parent, depth) => all.filter(page => page.parent === parent)
      .flatMap(page => [[page, depth], ...walk(page.id, depth + 1)]);
    return walk('', 0);
  }

  function drawPages(draft) {
    const all = pages(draft);
    const ordered = order(all);
    const current = all.find(item => item.id === pageId) || all[0];
    pageId = current.id;
    const exclude = new Set([pageId]);
    for (const [page] of ordered) if (exclude.has(page.parent)) exclude.add(page.id);
    const allowed = ordered.filter(([page]) => !exclude.has(page.id));
    const choices = list => options(list.map(([page, depth]) =>
      [page.id, '  '.repeat(Math.min(depth, 6)) + shown(page.title)]), current.parent);
    const parentField = resourceIds.has(pageId) ? '' : `<label>Trang cha<select data-editor-page="parent">
      ${option('', 'Cấp Trang chủ', current.parent)}${choices(allowed)}</select></label>`;
    return `<form class="form-grid editorial-new" data-editor-form="new-page">
      <label>Tên trang mới<input name="title" required maxlength="120"></label>
      <label>Trang cha<select name="parent">${option('', 'Cấp Trang chủ', '')}${choices(ordered)}</select></label>
      <label>Mẫu trang<select name="template"><option value="blank">Trang trống</option><option value="guide">Hướng dẫn</option></select></label>
      <div class="actions"><button>Tạo trang</button></div>
    </form>
    <div class="editorial-workspace">
      <div class="editorial-tree" aria-label="Danh sách trang">${ordered.map(([page, depth]) =>
        `<div style="padding-inline-start:${Math.min(depth, 6) * 12}px">${control('open-page', shown(page.title), page.id,
          page.id === pageId ? 'aria-current="true"' : '')}</div>`).join('')}</div>
      <div>${preview ? previewPage(current, draft) : `
        <div class="form-grid">
          <label>Tên trang<input data-editor-page="title" maxlength="120" value="${html(current.title)}"></label>
          <label>Trạng thái<select data-editor-page="status">${options([['draft', 'Bản nháp'], ['ready', 'Sẵn sàng']], current.status)}</select></label>
          ${parentField}
        </div>
        ${editBlocks(current, draft)}
      `}</div>
    </div>`;
  }

  function previewPage(page, draft) {
    const children = panel === 'pages' ? pages(draft).filter(item => item.parent === page.id) : [];
    const body = renderBlocks(page.blocks, draft.collections);
    return `<article class="editorial-preview">
      <h4>${html(shown(page.title))}</h4>
      ${body || '<p class="muted">Trang chưa có nội dung.</p>'}
      ${children.length ? `<h4>Trang con</h4><div class="actions">${children.map(child =>
        control('open-page', shown(child.title), child.id)).join('')}</div>` : ''}
    </article>`;
  }

  function editBlocks(page, draft) {
    const list = page.blocks.map((item, index) => {
      let fields;
      if (item.type === 'collection') fields = `
        <label>Nguồn dữ liệu<select data-editor-block="value">${option('', 'Chọn cơ sở dữ liệu', item.value)}
          ${options(draft.collections.map(entry => [entry.id, shown(entry.title)]), item.value)}</select></label>
        <label>Kiểu hiển thị<select data-editor-block="view">${options([['table', 'Bảng'], ['cards', 'Thẻ']], item.view)}</select></label>`;
      else if (item.type === 'link') fields = `<label>Tên liên kết<input data-editor-block="value" maxlength="5000" value="${html(item.value)}"></label>
        <label>Địa chỉ HTTPS<input type="url" data-editor-block="url" maxlength="2000" value="${html(item.url)}"></label>`;
      else fields = `<label>${blockTypes[item.type]}${item.type === 'list' ? ' (mỗi dòng một mục)' : ''}
        <textarea data-editor-block="value" maxlength="5000" rows="${item.type === 'heading' ? '1' : '3'}">${html(item.value)}</textarea></label>`;
      return `<div class="editorial-block" data-block-id="${item.id}">
        ${fields}
        <div class="actions">${control('up', 'Lên', item.id, index === 0 ? 'disabled' : '')}
          ${control('down', 'Xuống', item.id, index === page.blocks.length - 1 ? 'disabled' : '')}
          ${control('remove', 'Bỏ khối', item.id)}</div></div>`;
    }).join('');
    return `<div class="editorial-blocks">${list}</div>
      <form class="actions" data-editor-form="add-block"><label>Loại khối<select name="type">
        ${options(Object.entries(blockTypes), 'text')}</select></label><button>Thêm khối</button></form>`;
  }

  function fieldInput(field, row) {
    const value = row.values[field.id] || '';
    return `<label>${html(field.title)}${field.type === 'select' ?
      `<select data-editor-value="${field.id}">${option('', 'Chưa chọn', value)}
      ${options(field.choices.map(choice => [choice, choice]), value)}</select>` :
      `<input data-editor-value="${field.id}" type="${fieldTypes[field.type] && field.type}" maxlength="500"
        ${field.type === 'number' ? 'step="any"' : ''} value="${html(value)}">`}</label>`;
  }

  function drawData(draft) {
    const collection = draft.collections.find(item => item.id === collectionId) || draft.collections[0];
    collectionId = collection?.id || null;
    const row = collection?.rows.find(item => item.id === rowId);
    const setup = `<form class="form-grid editorial-new" data-editor-form="new-collection">
      <label>Tên cơ sở dữ liệu mới<input name="title" maxlength="120" required></label>
      <div class="actions"><button>Tạo cơ sở dữ liệu</button></div></form>`;
    if (!collection) return setup;
    return `${setup}
      <div class="editorial-tools actions">${draft.collections.map(item =>
        control('open-collection', shown(item.title), item.id, item.id === collectionId ? 'aria-current="true"' : '')).join('')}</div>
      ${row ? `
        <div class="actions">${control('back-data', 'Về cơ sở dữ liệu')}</div>
        ${preview ? `<dl class="editorial-properties">${collection.fields.map(field =>
          `<dt>${html(field.title)}</dt><dd>${html(row.values[field.id] || '—')}</dd>`).join('')}</dl>${previewPage(row, draft)}` : `
          <div class="form-grid"><label>Tên mục<input data-editor-page="title" maxlength="120" value="${html(row.title)}"></label>
            ${collection.fields.map(field => fieldInput(field, row)).join('')}</div>${editBlocks(row, draft)}`}
      ` : `
        <details><summary>Thuộc tính của cơ sở dữ liệu</summary>
          <p class="muted">${collection.fields.map(field => html(field.title + ' · ' + fieldTypes[field.type])).join(' / ') || 'Chưa có thuộc tính.'}</p>
          <form class="form-grid editorial-new" data-editor-form="add-field">
            <label>Tên thuộc tính<input name="title" maxlength="80" required></label>
            <label>Kiểu dữ liệu<select name="type" data-editor-field>${options(Object.entries(fieldTypes), 'text')}</select></label>
            <label hidden>Danh sách lựa chọn (cách nhau bằng dấu phẩy)<input name="choices" maxlength="1200"></label>
            <div class="actions"><button>Thêm thuộc tính</button></div></form>
        </details>
        <form class="form-grid editorial-new" data-editor-form="new-row">
          <label>Tên mục mới<input name="title" maxlength="120" required></label>
          <div class="actions"><button>Thêm mục dữ liệu</button></div></form>
        <div class="actions editorial-tools">${control('view', 'Dạng bảng', 'table', `aria-pressed="${view === 'table'}"`)}
          ${control('view', 'Dạng thẻ', 'cards', `aria-pressed="${view === 'cards'}"`)}</div>
        ${collectionView(collection, view, 'open-row')}
      `}`;
  }

  function draw() {
    if (!key) return;
    const draft = readDraft();
    host.innerHTML = `<section class="admin-section editorial" aria-label="Soạn nội dung">
      <h3>Soạn nội dung</h3>
      <p class="muted">Tạo trang, xếp khối và xây cơ sở dữ liệu. Xem trước bản nháp trong Quản trị.</p>
      <div class="actions editorial-tools">
        ${control('panel', 'Trang', 'pages', `aria-pressed="${panel === 'pages'}"`)}
        ${control('panel', 'Cơ sở dữ liệu', 'data', `aria-pressed="${panel === 'data'}"`)}
        ${panel === 'pages' || rowId ? control('preview', preview ? 'Quay lại chỉnh sửa' : 'Xem trước') : ''}
      </div>
      ${panel === 'pages' ? drawPages(draft) : drawData(draft)}
      <p class="muted editorial-status" data-editor-status role="status">${html(message)}</p>
    </section>`;
  }

  function synced(draft) {
    if (!key || !draft) return;
    try { localStorage.setItem(key + ':cloud-base', JSON.stringify(draft)); }
    catch { stamp('Bản nháp đã đồng bộ nhưng trình duyệt không lưu được mốc đồng bộ.', true); }
  }

  function setControlValue(target) {
    if (!key || !target?.dataset) return;
    const {editorPage, editorBlock, editorValue} = target.dataset;
    if (editorPage || editorBlock || editorValue) change(draft => {
      const current = active(draft);
      if (!current) return;
      if (editorPage) {
        if (editorPage === 'title' && !target.value.trim()) throw new Error('Nhập tên để lưu thay đổi.');
        current[editorPage] = target.value;
      }
      if (editorBlock) current.blocks.find(item => item.id === target.closest('[data-block-id]').dataset.blockId)[editorBlock] = target.value;
      if (editorValue) current.values[editorValue] = target.value;
    }, false);
  }

  host.addEventListener('change', event => {
    const target = event.target;
    if (target.hasAttribute('data-editor-field')) target.form.elements.choices.closest('label').hidden = target.value !== 'select';
    if (target.tagName === 'SELECT') setControlValue(target);
  });
  host.addEventListener('input', event => {
    if (event.target.tagName !== 'SELECT' && !event.target.validity?.badInput) setControlValue(event.target);
  });

  host.addEventListener('submit', event => {
    const action = event.target.dataset.editorForm;
    if (!key || !action) return;
    event.preventDefault();
    const form = new FormData(event.target);
    const title = String(form.get('title') || '').trim();
    if (action !== 'add-block' && !title) { stamp('Nhập tên trước khi tạo.', true); return; }
    const nextId = id();
    const changed = change(draft => {
      const collection = draft.collections.find(item => item.id === collectionId);
      if (action === 'new-page') draft.pages.push({id: nextId, title, parent: form.get('parent'), status: 'draft', blocks: starterBlocks(form.get('template'))});
      if (action === 'new-collection') draft.collections.push({id: nextId, title, fields: [], rows: []});
      if (action === 'new-row') collection.rows.push({id: nextId, title, values: {}, blocks: []});
      if (action === 'add-field') {
        const type = form.get('type');
        const choices = [...new Set(String(form.get('choices')).split(',').map(choice => choice.trim()).filter(Boolean))];
        if (type === 'select' && !choices.length) throw new Error('Nhập ít nhất một lựa chọn.');
        if (collection.fields.some(field => field.title.toLowerCase() === title.toLowerCase())) throw new Error('Thuộc tính đã tồn tại.');
        collection.fields.push({id: nextId, title, type, choices: type === 'select' ? choices : []});
      }
      if (action === 'add-block') active(draft).blocks.push(block(form.get('type')));
    }, false);
    if (!changed) return;
    if (action === 'new-page') { pageId = nextId; preview = false; }
    if (action === 'new-collection') { collectionId = nextId; rowId = null; preview = false; }
    if (action === 'new-row') { rowId = nextId; preview = false; }
    draw();
  });

  host.addEventListener('click', event => {
    const button = event.target.closest('[data-editor]');
    if (!key || !button) return;
    const {editor: action, item} = button.dataset;
    if (['up', 'down', 'remove'].includes(action)) {
      change(draft => {
        const blocks = active(draft).blocks;
        const index = blocks.findIndex(entry => entry.id === item);
        if (index < 0) return;
        if (action === 'remove') blocks.splice(index, 1);
        else {
          const next = index + (action === 'down' ? 1 : -1);
          if (next >= 0 && next < blocks.length) [blocks[index], blocks[next]] = [blocks[next], blocks[index]];
        }
      });
      return;
    }
    if (action === 'panel') { panel = item; rowId = null; preview = false; }
    if (action === 'open-page') pageId = item;
    if (action === 'open-collection') { collectionId = item; rowId = null; preview = false; }
    if (['open-row', 'preview-row'].includes(action)) {
      [collectionId, rowId] = item.split('/');
      panel = 'data';
      preview = action === 'preview-row';
    }
    if (action === 'back-data') { rowId = null; preview = false; }
    if (action === 'view') view = item;
    if (action === 'preview') preview = !preview;
    draw();
  });

  return {
    open(uid, existingPages) {
      key = 'pna-editorial-v1:' + uid;
      legacy = existingPages;
      draw();
    },
    close() { key = null; legacy = []; message = ''; panel = 'pages'; pageId = resourcePages[0][0]; collectionId = rowId = null;
      preview = false; view = 'table'; host.replaceChildren(); },
    forCloud(remote) {
      if (!key) return remote ?? null;
      const local = read();
      if (!local) return remote ?? null;
      const remoteJSON = remote ? JSON.stringify(remote) : null;
      const baseline = localStorage.getItem(key + ':cloud-base');
      if (remoteJSON && remoteJSON !== baseline && remoteJSON !== JSON.stringify(local)) {
        throw new Error('Bản nháp Firebase đã thay đổi. Hãy tải bản đó trước khi ghi đè.');
      }
      return local;
    },
    synced,
    load(draft) {
      if (!key || !validEditorial(draft)) return false;
      localStorage.setItem(key, JSON.stringify(draft));
      synced(draft);
      stamp('Đã tải nội dung từ Firebase.');
      draw();
      return true;
    },
  };
}
