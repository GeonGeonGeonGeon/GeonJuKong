import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostDraft, readPostDraft } from '../src/post-drafts.js';

function device() {
  const values = new Map(), blobs = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const files = { putFile: async (id, file) => { blobs.set(id, { blob: new Blob([file], { type: file.type }) }); }, file: async id => blobs.get(id), removeFile: async id => blobs.delete(id) };
  return { values, blobs, storage, files };
}
const fields = { date: '2026-11-09', title: 'A <draft>', text: 'First line\nSecond line' };
const scope = (user, mode = 'demo', target = '') => ({ user, mode, target });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('device drafts isolate users, modes and create/edit targets and retain ordered originals', async () => {
  const d = device();
  const scopes = [scope('isolation'), scope('other'), scope('isolation', 'live'), scope('isolation', 'demo', 'edit-one'), scope('isolation', 'demo', 'edit-two')];
  for (const [index, owner] of scopes.entries()) createPostDraft(owner, d).capture({ ...fields, title: String(index) }, [], `version-${index}`);
  for (const [index, owner] of scopes.entries()) assert.equal(readPostDraft(owner, d.storage).fields.title, String(index));
  const draft = createPostDraft(scopes[3], d);
  const existing = { key: 'saved:photo', metadata: { id: 'original', source: 'drive', name: 'saved.jpg', type: 'image/jpeg', thumbnail: { id: 'thumb' } } };
  draft.capture(fields, [{ key: 'video', file: new File(['movie'], 'video.mov', { type: 'video/quicktime', lastModified: 123 }) }, existing], 'original-version');
  const restored = await createPostDraft(scopes[3], d).restore();
  assert.deepEqual(restored.fields, fields); assert.equal(restored.version, 'original-version');
  assert.equal(await restored.entries[0].file.text(), 'movie');
  assert.equal(restored.entries[0].file.name, 'video.mov'); assert.equal(restored.entries[0].file.lastModified, 123);
  assert.deepEqual(restored.entries[1], existing); assert.deepEqual(restored.missing, []);
  const { createPostDraft: afterReload } = await import('../src/post-drafts.js?new-page');
  const persisted = await afterReload(scopes[3], d).restore();
  assert.equal(await persisted.entries[0].file.text(), 'movie'); assert.deepEqual(persisted.entries[1], existing);
  await draft.discard();
  assert.equal(readPostDraft(scopes[3], d.storage), null); assert.equal(d.blobs.size, 0);
  assert.equal(readPostDraft(scopes[4], d.storage).fields.title, '4');
});

test('text commits synchronously and immediate close/reentry waits for pending attachments; deletion cleans late writes', async () => {
  const d = device(); let finish;
  d.files.putFile = (id, file) => new Promise(resolve => { finish = () => { d.blobs.set(id, { blob: file }); resolve(); }; });
  const owner = scope('immediate');
  const draft = createPostDraft(owner, d);
  const status = draft.capture(fields, [{ key: 'photo', file: new File(['photo'], 'new.png', { type: 'image/png' }) }]);
  assert.match(status, /신규 첨부 저장 중/); assert.deepEqual(readPostDraft(owner, d.storage).fields, fields);
  const restored = createPostDraft(owner, d).restore();
  finish(); assert.equal((await restored).entries[0].file.name, 'new.png');
  await draft.discard(true); assert.equal(d.blobs.size, 0); assert.equal(readPostDraft(owner, d.storage), null);
  const late = createPostDraft(scope('late'), d);
  late.capture(fields, [{ key: 'late', file: new File(['late'], 'late.png', { type: 'image/png' }) }]);
  const deleting = late.discard(); finish(); await deleting;
  assert.equal(d.blobs.size, 0); assert.equal(readPostDraft(scope('late'), d.storage), null);
});

test('quota and missing files report actual recovery state, and successful saves cannot be revived by cleanup errors', async () => {
  const d = device(), messages = [], owner = scope('quota');
  d.files.putFile = async () => { throw new Error('QuotaExceededError'); };
  const draft = createPostDraft(owner, { ...d, onStatus: message => messages.push(message) });
  draft.capture(fields, [{ key: 'missing', file: new File(['photo'], 'missing.png', { type: 'image/png' }) }]);
  await tick(); assert.match(messages.at(-1), /텍스트 초안은 기기에 저장됐지만 신규 첨부를 저장하지 못/);
  const restored = await createPostDraft(owner, d).restore();
  assert.deepEqual(restored.fields, fields); assert.deepEqual(restored.missing, ['missing.png']); assert.equal(restored.entries.length, 0);
  const failed = createPostDraft(scope('text-quota'), { ...d, storage: { ...d.storage, setItem() { throw new Error('quota'); } } });
  assert.match(failed.capture(fields, []), /기기 초안을 저장하지 못/); assert.equal(readPostDraft(scope('text-quota'), d.storage), null);
  let retryWrite = false;
  const retryMessages = [];
  const retry = createPostDraft(scope('file-retry'), { ...d, onStatus: message => retryMessages.push(message), files: { ...d.files, putFile: async (id, file) => { if (!retryWrite) throw new Error('quota'); d.blobs.set(id, { blob: file }); } } });
  const entries = [{ key: 'retry', file: new File(['retry'], 'retry.png', { type: 'image/png' }) }];
  retry.capture(fields, entries); await tick(); assert.match(retryMessages.at(-1), /신규 첨부를 저장하지 못/);
  retryWrite = true; retry.capture(fields, entries); await tick(); assert.match(retryMessages.at(-1), /이 기기에 초안을 저장했어요/);
  await retry.discard();
  const denied = createPostDraft(scope('delete-denied'), { ...d, storage: { ...d.storage, removeItem() { throw new Error('denied'); } } });
  denied.capture(fields, []); await assert.rejects(denied.discard(), /초안을 삭제하지 못/);
  assert.deepEqual(readPostDraft(scope('delete-denied'), d.storage).fields, fields);
  d.files.removeFile = async () => { throw new Error('cleanup'); };
  await assert.rejects(draft.discard(true), /일기는 저장됐고 초안 안내도 정리/);
  assert.equal(readPostDraft(owner, d.storage), null);
  const marker = createPostDraft(scope('remove-denied'), { ...d, storage: { ...d.storage, removeItem() { throw new Error('denied'); } } });
  marker.capture(fields, []); await marker.discard(true);
  assert.equal(readPostDraft(scope('remove-denied'), d.storage), null);
});

test('app autosaves, restores and discards only post forms across navigation, accounts, failed saves and refresh failure', async t => {
  const d = device(), listeners = new Map(), windowListeners = new Map();
  d.storage.setItem('geonjukong-seeded', '1');
  const row = { id: 'owned', kind: 'post', author_id: 'demo-me', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T01:00:00Z', data: { title: 'Owned', date: '2026-11-01', text: 'Original', space: 'board', files: [{ id: 'saved-photo', source: 'local', type: 'image/png', name: 'saved.png' }] } };
  const foreign = { ...row, id: 'foreign', author_id: 'demo-partner', data: { ...row.data, space: undefined } };
  const rows = new Map([row, foreign].map(value => [value.id, value]));
  const app = { innerHTML: '' }, toast = { textContent: '', classList: { add() {}, remove() {} } };
  let form, notice, restoreButton, media, html = '', back, link, liveUser = null;
  const editorEvents = new Map();
  const editor = { open: false, scrollTop: 0, showModal() { this.open = true; }, close() { this.open = false; }, addEventListener: (name, fn) => editorEvents.set(name, fn), querySelectorAll: () => [] };
  Object.defineProperty(editor, 'innerHTML', { get: () => html, set(value) {
    html = value; form = null; notice = { textContent: '' }; restoreButton = { hidden: true }; media = { innerHTML: '' };
    const tag = value.match(/<form id="record-form"([^>]*)>/);
    if (!tag) return;
    const attr = name => tag[1].match(new RegExp(`data-${name}="([^"]*)"`))?.[1] || '';
    const elements = {};
    for (const name of ['date', 'title', 'text', 'time', 'postId']) {
      const escaped = value.match(new RegExp(`<input[^>]*name="${name}"[^>]*value="([^"]*)"`))?.[1] ?? (name === 'text' ? value.match(/<textarea[^>]*name="text"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] : '') ?? '';
      elements[name] = { name, value: escaped.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&') };
    }
    elements.files = { name: 'files', files: [], value: '' };
    const error = { textContent: '' }, button = { textContent: 'Save', isConnected: true };
    form = { id: 'record-form', dataset: { kind: attr('kind'), id: attr('id'), version: attr('version') }, elements, hidden: false, querySelector: selector => selector === '[type="submit"]' ? button : error, error };
    for (const element of Object.values(elements)) element.form = form;
  } });
  globalThis.window = { APP_CONFIG: { supabaseUrl: 'https://example.test', supabaseAnonKey: 'public' }, addEventListener: (name, fn) => windowListeners.set(name, fn), scrollTo() {}, GEONJUKONG_NATIVE: { active: true, onBack: async fn => { back = fn; }, listen: async fn => { link = fn; }, closeBrowser: async () => {} } };
  globalThis.document = { hidden: false, querySelector: selector => ({ '#app': app, '#editor': editor, '#toast': toast, '#record-form': form, '#post-draft-status': notice, '[data-action="draft-restore"]': restoreButton, '#media-draft': media })[selector] || null, querySelectorAll: () => [], addEventListener: (name, fn) => listeners.set(name, fn), activeElement: { matches: () => false } };
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  globalThis.localStorage = d.storage; globalThis.sessionStorage = d.storage;
  globalThis.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: '#memories' };
  globalThis.history = { replaceState() {} };
  const previousInterval = globalThis.setInterval, previousFormData = globalThis.FormData, previousError = console.error;
  globalThis.setInterval = () => 0; console.error = () => {};
  globalThis.FormData = class { constructor(target) { this.values = Object.entries(target.elements).filter(([name]) => name !== 'files' && (target.dataset.kind === 'event' || ['date', 'title', 'text'].includes(name))).map(([name, element]) => [name, element.value]); } [Symbol.iterator]() { return this.values[Symbol.iterator](); } };
  const { local } = await import('../src/storage.js');
  const { auth, repository } = await import('../src/backend.js');
  const { google } = await import('../src/google.js');
  const originals = [local, auth, repository, google].map(object => Object.getOwnPropertyDescriptors(object));
  let saveError = false, listError = false, failRefreshAfterSave = false, saves = 0;
  Object.assign(local, d.files, { list: async () => { if (listError) throw new Error('reload failed'); return [...rows.values()]; }, put: async value => rows.set(value.id, value), putIfVersion: async (value, version) => { if ((rows.get(value.id)?.updated_at || rows.get(value.id)?.created_at) !== version) return false; rows.set(value.id, value); return true; } });
  Object.defineProperty(auth, 'user', { configurable: true, get: () => liveUser });
  auth.callback = async () => {}; auth.logout = async () => { liveUser = null; return { remote: true }; };
  const save = repository.save;
  repository.save = async (...args) => { saves++; if (saveError) throw new Error('save failed'); const result = await save(...args); if (failRefreshAfterSave) listError = true; return result; };
  Object.assign(repository, { members: async () => [{ email: 'one' }, { email: 'two' }], list: async () => [...rows.values()], profiles: async () => [], bucketItems: async () => [], notificationReads: async () => [], coupleSettings: async () => ({ startDate: '2020-01-01' }) });
  Object.assign(google, { prepare: async () => {}, restore: async () => {}, events: async () => [], upcomingEvents: async () => [] });
  const click = dataset => listeners.get('click')({ target: { closest: () => ({ dataset }) } });
  const input = (name, value) => { form.elements[name].value = value; listeners.get('input')({ target: form.elements[name] }); };
  const fill = () => { for (const [name, value] of Object.entries(fields)) input(name, value); };
  const submit = async () => { const target = form; await listeners.get('submit')({ target, preventDefault() {} }); return target; };
  try {
    await import('../src/app.js?post-drafts');
    for (let i = 0; i < 40 && !app.innerHTML.includes('memory-grid all-memories'); i++) await tick();
    await t.test('input is durable before close, cancel/back and page lifecycle; reentry requires explicit resume', async () => {
      await click({ action: 'new', kind: 'post' }); fill();
      assert.deepEqual(readPostDraft(scope('demo-me')).fields, fields);
      await click({ action: 'close' }); assert.equal(editor.open, false); assert.match(app.innerHTML, /data-action="draft-open"/);
      assert.match(app.innerHTML, /이 계정으로 이 기기에 저장한 일기 초안이 있어요/);
      assert.match(app.innerHTML, /새 일기 이어 쓰기/);
      await click({ action: 'new', kind: 'post' }); assert.equal(form.hidden, true);
      assert.match(editor.innerHTML, /<h2 id="dialog-title">일기 쓰기<\/h2>/);
      assert.match(editor.innerHTML, /일기 이어 쓰기/); assert.match(editor.innerHTML, /일기 초안 삭제/);
      assert.match(notice.textContent, /이 기기에 저장한 일기 초안이 있어요/);
      await click({ action: 'draft-restore' }); assert.equal(form.hidden, false); assert.equal(form.elements.text.value, fields.text);
      assert.match(notice.textContent, /날짜·제목·본문과 첨부를 복원했어요/);
      input('text', 'Before pagehide'); windowListeners.get('pagehide')(); windowListeners.get('beforeunload')();
      document.hidden = true; listeners.get('visibilitychange')(); document.hidden = false;
      await back(); await click({ action: 'new', kind: 'post' }); await click({ action: 'draft-restore' });
      assert.equal(form.elements.text.value, 'Before pagehide');
      const originalText = form.elements.text.value;
      let prevented = false; editorEvents.get('cancel')({ preventDefault() { prevented = true; } });
      await tick(); assert.equal(prevented, true); assert.equal(editor.open, false);
      await click({ action: 'draft-open', id: '' }); await click({ action: 'draft-restore' }); assert.equal(form.elements.text.value, originalText);
    });
    await t.test('reload without a page lifecycle event restores both text and newly selected file bytes', async () => {
      const file = new File(['reload original'], 'reload.mov', { type: 'video/quicktime', lastModified: 987 });
      form.elements.files.files = [file]; listeners.get('change')({ target: form.elements.files });
      await tick(); editor.innerHTML = ''; editor.open = false;
      await import('../src/app.js?post-drafts-reload');
      for (let i = 0; i < 10; i++) await tick();
      await click({ action: 'new', kind: 'post' }); assert.equal(form.hidden, true);
      await click({ action: 'draft-restore' }); assert.equal(form.elements.text.value, 'Before pagehide');
      assert.match(media.innerHTML, /reload.mov/);
      const item = readPostDraft(scope('demo-me')).attachments[0];
      assert.equal(await d.blobs.get(item.fileId).blob.text(), 'reload original');
      await click({ action: 'media-remove', index: '0' }); await tick(); assert.equal(d.blobs.has(item.fileId), false);
    });
    await t.test('user switch and logout close the old form and leave other scopes untouched', async () => {
      await listeners.get('change')({ target: { id: 'demo-person', value: 'demo-partner' } });
      assert.equal(editor.open, false); assert.doesNotMatch(app.innerHTML, /data-action="draft-open"/);
      await click({ action: 'new', kind: 'post' }); assert.equal(form.hidden, false); fill(); input('title', 'Partner draft');
      await listeners.get('change')({ target: { id: 'demo-person', value: 'demo-me' } });
      await click({ action: 'new', kind: 'post' }); await click({ action: 'draft-restore' }); assert.equal(form.elements.text.value, 'Before pagehide');
      await click({ action: 'logout' }); assert.equal(editor.open, false);
      assert.equal(readPostDraft(scope('demo-partner')).fields.title, 'Partner draft');
      assert.equal(readPostDraft(scope('demo-me')).fields.text, 'Before pagehide');
    });
    await t.test('a live login with the same user ID cannot read or overwrite demo drafts', async () => {
      liveUser = { id: 'demo-me', email: 'one' }; await link('com.geonjukong.couple://auth/callback');
      await click({ action: 'new', kind: 'post' }); assert.equal(form.hidden, false); fill(); input('title', 'Live draft');
      await click({ action: 'logout' });
      assert.equal(readPostDraft(scope('demo-me', 'live')).fields.title, 'Live draft');
      assert.equal(readPostDraft(scope('demo-me')).fields.text, 'Before pagehide');
    });
    await t.test('failed saves retain input and files; resume preserves attachment order and uploaded files are reused', async () => {
      await click({ action: 'new', kind: 'post' }); await click({ action: 'draft-restore' }); fill();
      const file = new File(['new original'], 'new.png', { type: 'image/png', lastModified: 321 });
      form.elements.files.files = [file]; listeners.get('change')({ target: form.elements.files });
      saveError = true; const failedForm = await submit();
      assert.match(failedForm.error.textContent, /save failed/); assert.equal(editor.open, true); assert.equal(failedForm.inert, false);
      assert.equal(form.elements.text.value, fields.text); const count = d.blobs.size;
      await click({ action: 'close' }); await click({ action: 'new', kind: 'post' }); await click({ action: 'draft-restore' });
      assert.match(media.innerHTML, /new.png/); assert.equal(readPostDraft(scope('demo-me')).attachments[0].metadata.source, 'local');
      saveError = false; await submit(); assert.equal(d.blobs.size, count); assert.equal(readPostDraft(scope('demo-me')), null);
      assert.equal(readPostDraft(scope('demo-partner')).fields.title, 'Partner draft');
    });
    await t.test('edit versions and saved attachments survive restore, and foreign post editing stays denied', async () => {
      await click({ action: 'edit', id: 'owned' }); input('title', 'Editing');
      form.elements.files.files = [new File(['video'], 'new.mov', { type: 'video/quicktime' })]; listeners.get('change')({ target: form.elements.files });
      await click({ action: 'media-earlier', index: '1' }); await back();
      await click({ action: 'edit', id: 'owned' }); await click({ action: 'draft-restore' });
      assert.equal(form.dataset.version, '2026-11-01T01:00:00Z'); assert.equal(form.elements.title.value, 'Editing');
      assert.ok(media.innerHTML.indexOf('new.mov') < media.innerHTML.indexOf('saved.png'));
      rows.set(row.id, { ...row, updated_at: '2026-11-01T02:00:00Z' });
      const conflict = await submit(); assert.match(conflict.error.textContent, /수정되었거나 삭제/);
      assert.equal(form.elements.title.value, 'Editing'); assert.equal(readPostDraft(scope('demo-me', 'demo', 'owned')).version, '2026-11-01T01:00:00Z');
      await click({ action: 'draft-discard' }); assert.equal(form.elements.title.value, 'Owned'); assert.equal(readPostDraft(scope('demo-me', 'demo', 'owned')), null);
      await click({ action: 'close' }); await click({ action: 'edit', id: 'foreign' }); assert.equal(editor.open, false); assert.match(toast.textContent, /작성자만/);
    });
    await t.test('successful save clears only its draft even when the subsequent list refresh fails', async () => {
      await click({ action: 'new', kind: 'post' }); fill(); const before = saves;
      failRefreshAfterSave = true; await submit();
      assert.equal(saves, before + 1); assert.equal(editor.open, false); assert.equal(readPostDraft(scope('demo-me')), null);
      assert.match(app.innerHTML, /기록은 저장됐지만 최신 기록/);
      windowListeners.get('pagehide')(); windowListeners.get('beforeunload')(); assert.equal(readPostDraft(scope('demo-me')), null);
      await click({ action: 'new', kind: 'post' }); assert.equal(form.hidden, false); assert.equal(form.elements.title.value, '');
      assert.equal(saves, before + 1); listError = false; failRefreshAfterSave = false; await click({ action: 'close' });
    });
    await t.test('events and comments do not create post drafts', async () => {
      const count = d.values.size; await click({ action: 'new', kind: 'event' }); input('title', 'Event'); await back();
      await click({ action: 'new', kind: 'comment' }); input('text', 'Comment'); await back();
      assert.equal(d.values.size, count);
    });
    await t.test('a save resolving after login clears its original draft without closing or overwriting the new account screen', async () => {
      await click({ action: 'new', kind: 'post' }); fill();
      const previousSave = repository.save;
      let finish;
      repository.save = async () => new Promise(resolve => { finish = () => resolve({ ...row, id: 'late-saved', data: { ...row.data, title: 'Late result' } }); });
      const saving = submit();
      for (let i = 0; i < 10 && !finish; i++) await tick();
      liveUser = { id: 'different-live-user', email: 'two' }; await link('com.geonjukong.couple://auth/callback');
      const currentScreen = app.innerHTML;
      finish(); await saving;
      assert.equal(readPostDraft(scope('demo-me')), null); assert.equal(app.innerHTML, currentScreen); assert.equal(editor.open, false);
      assert.equal(readPostDraft(scope('demo-partner')).fields.title, 'Partner draft'); repository.save = previousSave;
    });
  } finally {
    [local, auth, repository, google].forEach((object, index) => Object.defineProperties(object, originals[index]));
    globalThis.setInterval = previousInterval; globalThis.FormData = previousFormData; console.error = previousError;
  }
});
