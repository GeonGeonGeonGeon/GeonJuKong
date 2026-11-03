import test from 'node:test';
import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { dateKey } from '../src/core.js';

test('calendar thumbnails, ordered attachment editing, inline videos and feature entry points are connected', async () => {
  const today = dateKey(), listeners = new Map(), values = new Map([['geonjukong-seeded', '1']]);
  const savedFile = (id, name) => ({ id, name, source: 'local', type: 'image/jpeg', size: 5 });
  const original = { id: 'post', kind: 'post', author_id: 'demo-me', created_at: new Date().toISOString(), data: { title: 'Photo day', text: 'Our memory', date: today, files: [savedFile('old-a', 'old-a.jpg'), savedFile('old-b', 'old-b.jpg')] } };
  const rows = new Map([[original.id, original]]), blobs = new Map();
  const app = { innerHTML: '' }, draft = { innerHTML: '' }, error = { textContent: '' };
  const toast = { textContent: '', classList: { add() {}, remove() {} } };
  const editor = { innerHTML: '', open: false, scrollTop: 0, addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; } };
  let recordForm;
  globalThis.window = { APP_CONFIG: {}, addEventListener() {}, scrollTo() {} };
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  globalThis.document = {
    activeElement: { matches: () => false }, querySelectorAll: () => [],
    querySelector: selector => ({ '#app': app, '#editor': editor, '#toast': toast, '#record-form': recordForm, '#media-draft': editor.open && editor.innerHTML.includes('id="media-draft"') ? draft : null })[selector] || null,
    addEventListener: (type, listener) => listeners.set(type, listener)
  };
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  globalThis.sessionStorage = localStorage;
  globalThis.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: '#calendar' };
  globalThis.history = { replaceState() {} };
  const oldInterval = globalThis.setInterval, oldFormData = globalThis.FormData, oldFile = globalThis.File;
  globalThis.setInterval = () => 0;
  globalThis.File = File;
  globalThis.FormData = class {
    constructor(form) { this.values = Object.entries(form.values || {}); }
    get(key) { return this.values.find(([name]) => name === key)?.[1]; }
    has(key) { return this.values.some(([name]) => name === key); }
    [Symbol.iterator]() { return this.values[Symbol.iterator](); }
  };
  const { local } = await import('../src/storage.js');
  const originalLocal = { ...local };
  Object.assign(local, { list: async () => [...rows.values()], put: async row => rows.set(row.id, row), file: async id => blobs.get(id), putFile: async (id, blob) => blobs.set(id, { id, blob }) });
  const click = dataset => listeners.get('click')({ target: { closest: () => ({ dataset }) } });
  const choose = files => listeners.get('change')({ target: { name: 'files', files, value: 'chosen' } });
  try {
    await import('../src/app.js?feedback-integration');
    for (let i = 0; i < 30 && !app.innerHTML.includes('calendar-grid'); i++) await new Promise(resolve => setTimeout(resolve, 1));
    assert.match(app.innerHTML, /calendar-preview[^>]*><img data-file="old-a"/);
    assert.doesNotMatch(app.innerHTML, /data-view="chat"/);
    await click({ action: 'edit', id: 'post' });
    assert.match(draft.innerHTML, /media-order[^>]*>1<\/span>/);
    assert.match(draft.innerHTML, /media-order[^>]*>2<\/span>/);
    const third = new File(['third'], 'third.jpg', { type: 'image/jpeg' });
    const fourth = new File(['fourth'], 'fourth.png', { type: 'image/png' });
    choose([third]); choose([fourth]);
    assert.match(draft.innerHTML, /media-order[^>]*>4<\/span>/);
    assert.ok(draft.innerHTML.indexOf('third.jpg') < draft.innerHTML.indexOf('fourth.png'));
    await click({ action: 'media-earlier', index: '3' });
    await click({ action: 'media-remove', index: '0' });
    assert.doesNotMatch(draft.innerHTML, /old-a\.jpg/);
    assert.ok(draft.innerHTML.indexOf('fourth.png') < draft.innerHTML.indexOf('third.jpg'));
    const video = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
    choose([video]);
    assert.match(draft.innerHTML, /<video[^>]*controls playsinline/);
    assert.deepEqual(rows.get('post').data.files.map(file => file.id), ['old-a', 'old-b']);
    const submit = { textContent: 'save', isConnected: true };
    recordForm = { id: 'record-form', dataset: { kind: 'post', id: 'post' }, values: { title: 'Edited day', text: 'Updated', date: today }, elements: { files: { files: [] } }, querySelector: selector => selector === '[type="submit"]' ? submit : error };
    await listeners.get('submit')({ target: recordForm, preventDefault() {} });
    assert.equal(error.textContent, '');
    assert.equal(editor.open, false);
    const updated = rows.get('post');
    assert.deepEqual(updated.data.files.map(file => file.name), ['old-b.jpg', 'fourth.png', 'third.jpg', 'clip.mp4']);
    assert.equal(updated.data.files[0].id, 'old-b');
    assert.equal(blobs.size, 3);
    await click({ view: 'memories' });
    assert.match(app.innerHTML, /<video controls playsinline preload="metadata" data-file=/);
    await click({ action: 'open-post', id: 'post' });
    assert.match(editor.innerHTML, /<video controls playsinline preload="metadata" data-file=/);
    await click({ action: 'close' });
    await click({ view: 'bucket' });
    assert.match(app.innerHTML, /OUR BUCKET LIST/);
    await click({ action: 'bucket-new' });
    assert.match(editor.innerHTML, /id="bucket-form"/);
    await click({ action: 'close' });
    await click({ view: 'settings' });
    assert.match(app.innerHTML, /data-action="profile-edit"/);
    await click({ action: 'profile-edit' });
    assert.match(editor.innerHTML, /id="profile-form"/);
    await click({ action: 'profile-open', id: 'demo-partner' });
    assert.match(editor.innerHTML, /class="profile-detail"/);
    assert.doesNotMatch(editor.innerHTML, /data-action="profile-edit"/);
  } finally {
    Object.assign(local, originalLocal);
    globalThis.setInterval = oldInterval; globalThis.FormData = oldFormData;
    if (oldFile === undefined) delete globalThis.File; else globalThis.File = oldFile;
  }
});
