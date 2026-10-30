import test from 'node:test';
import assert from 'node:assert/strict';

test('저장 후 조회 실패가 댓글 중복을 유발하지 않고 권한과 연결 경고를 표시한다', async () => {
  const values = new Map([['geonjukong-auth', JSON.stringify({ user: { id: 'u1', email: 'one@example.com' }, access_token: 'session', expires_at: Date.now() + 3600000 })]]);
  const listeners = new Map();
  const app = { innerHTML: '' }, editor = { innerHTML: '', open: false, scrollTop: 42, addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; } }, toast = { textContent: '', classList: { add() {}, remove() {} } };
  globalThis.window = { APP_CONFIG: { supabaseUrl: 'https://example.test', supabaseAnonKey: 'public' }, addEventListener() {}, scrollTo() {} };
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  globalThis.document = { hidden: false, activeElement: { matches: () => false }, querySelector: s => ({ '#app': app, '#editor': editor, '#toast': toast })[s] || null, querySelectorAll: () => [], addEventListener: (type, fn) => listeners.set(type, fn) };
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  globalThis.sessionStorage = localStorage;
  globalThis.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: '#diary' };
  globalThis.history = { replaceState() {} };
  const oldInterval = globalThis.setInterval, oldFormData = globalThis.FormData; globalThis.setInterval = () => 0;
  globalThis.FormData = class { constructor(form) { this.entries = Object.entries(form.values || {}); } [Symbol.iterator]() { return this.entries[Symbol.iterator](); } };
  const { repository, auth } = await import('../src/backend.js');
  const { google } = await import('../src/google.js');
  const warning = Object.getOwnPropertyDescriptor(auth, 'googleWarning');
  Object.defineProperty(auth, 'googleWarning', { configurable: true, get: () => 'Google connection warning' });
  const post = { id: 'p', kind: 'post', author_id: 'u2', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', data: { title: 'Shared post', date: '2026-01-01', text: 'x', space: 'board' } };
  const comments = []; let failList = false;
  Object.assign(repository, {
    members: async () => [{ email: 'one@example.com' }, { email: 'two@example.com' }],
    list: async () => { if (failList) { failList = false; throw new Error('network'); } return [post, ...comments]; },
    readAt: async () => [], notificationReads: async () => [], coupleSettings: async () => ({}),
    save: async (_mode, _user, kind, data) => { const row = { id: `c${comments.length}`, kind, author_id: 'u1', created_at: new Date().toISOString(), data }; comments.push(row); failList = true; return row; }
  });
  google.restore = async () => {}; google.events = async () => []; google.prepare = async () => {};
  try {
    await import('../src/app.js?reliability');
    for (let i = 0; i < 50 && !app.innerHTML.includes('data-id="p"'); i++) await new Promise(resolve => setTimeout(resolve, 1));
    assert.match(app.innerHTML, /Google connection warning/);
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'open-post', id: 'p' } }) } });
    assert.match(editor.innerHTML, /data-action="edit"/);
    assert.doesNotMatch(editor.innerHTML, /data-action="delete"/);
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'edit', id: 'p' } }) } });
    assert.match(editor.innerHTML, /data-version="2026-01-02T00:00:00Z"/);
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'open-post', id: 'p' } }) } });
    editor.scrollTop = 42;
    const error = { textContent: '' }, button = { textContent: 'send', isConnected: true };
    const form = { id: 'comment-form', dataset: { post: 'p' }, elements: { text: { value: 'saved comment' } }, querySelector: s => s === '[type="submit"]' ? button : error };
    await listeners.get('submit')({ target: form, preventDefault() {} });
    assert.equal(comments.length, 1); assert.equal(form.elements.text.value, '');
    assert.match(editor.innerHTML, /saved comment/); assert.equal(editor.open, true); assert.equal(editor.scrollTop, 42);
    assert.match(app.innerHTML, /댓글은 저장됐지만/);

    let savedCount = 0, notified = 0;
    const savedRows = [];
    repository.save = async (_mode, _user, kind, data) => {
      const row = { id: `saved-${++savedCount}`, kind, author_id: 'u1', created_at: new Date().toISOString(), data };
      savedRows.push(row); failList = true; return row;
    };
    repository.list = async () => { if (failList) { failList = false; throw new Error('network'); } return [post, ...comments, ...savedRows]; };
    repository.saveCalendarNotice = async () => {};
    repository.notify = async () => { notified++; };
    const recordForm = (kind, values) => ({ id: 'record-form', dataset: { kind, id: '' }, values, elements: { files: { files: [] } }, querySelector: s => s === '[type="submit"]' ? { textContent: 'save', isConnected: true } : { textContent: '' } });
    editor.open = true;
    await listeners.get('submit')({ target: recordForm('post', { title: 'saved post', date: '2026-01-01', text: 'body' }), preventDefault() {} });
    assert.equal(savedCount, 1); assert.equal(editor.open, false);
    assert.match(app.innerHTML, /saved post/); assert.match(app.innerHTML, /기록은 저장됐지만/); assert.match(toast.textContent, /기록은 저장됐어요/);

    google.saveEvent = async () => { failList = true; return { id: 'event-1' }; };
    editor.open = true;
    await listeners.get('submit')({ target: recordForm('event', { title: 'saved event', date: '2026-01-01', text: '' }), preventDefault() {} });
    assert.equal(editor.open, false); assert.match(app.innerHTML, /기록은 저장됐지만/); assert.match(toast.textContent, /기록은 저장됐어요/);

    google.saveEvent = async () => ({ id: 'event-2' });
    google.events = async () => { throw new Error('calendar unavailable'); };
    google.upcomingEvents = async () => [];
    editor.open = true;
    await listeners.get('submit')({ target: recordForm('event', { title: 'saved event 2', date: '2026-01-01', text: '' }), preventDefault() {} });
    assert.equal(editor.open, false); assert.match(app.innerHTML, /일정은 저장됐지만 캘린더를 갱신하지 못했어요/);

    repository.markRead = async () => { throw new Error('read failure'); };
    const message = { value: 'saved message' };
    const chatForm = { id: 'chat-form', elements: { message }, querySelector: s => s === '[type="submit"]' ? { textContent: 'send', isConnected: true } : null };
    await listeners.get('submit')({ target: chatForm, preventDefault() {} });
    assert.equal(savedCount, 2); assert.equal(message.value, ''); assert.equal(notified, 1);
    assert.match(app.innerHTML, /메시지는 전송됐지만/); assert.match(toast.textContent, /메시지는 전송됐어요/);
  } finally { globalThis.setInterval = oldInterval; globalThis.FormData = oldFormData; Object.defineProperty(auth, 'googleWarning', warning); }
});
