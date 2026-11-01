import test from 'node:test';
import assert from 'node:assert/strict';

test('댓글·답글과 일정 알림을 열고 일정 알림 저장 실패를 재시도한다', async () => {
  const values = new Map([['geonjukong-auth', JSON.stringify({ user: { id: 'u1', email: 'one@example.com' }, access_token: 'session', expires_at: Date.now() + 3600000 })]]);
  const listeners = new Map(), reads = [];
  const app = { innerHTML: '' }, toast = { textContent: '', classList: { add() {}, remove() {} } };
  const editor = { innerHTML: '', open: false, scrollTop: 0, addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; } };
  globalThis.window = { APP_CONFIG: { supabaseUrl: 'https://example.test', supabaseAnonKey: 'public' }, addEventListener() {}, scrollTo() {} };
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  globalThis.document = { hidden: false, activeElement: { matches: () => false }, querySelector: s => ({ '#app': app, '#editor': editor, '#toast': toast })[s] || null, querySelectorAll: () => [], addEventListener: (type, fn) => listeners.set(type, fn) };
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  globalThis.sessionStorage = localStorage;
  globalThis.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: '#home' };
  globalThis.history = { replaceState() {} };
  const oldInterval = globalThis.setInterval, oldFormData = globalThis.FormData;
  globalThis.setInterval = () => 0;
  globalThis.FormData = class { constructor(form) { this.entries = Object.entries(form._data || {}); } [Symbol.iterator]() { return this.entries[Symbol.iterator](); } };
  const { repository } = await import('../src/backend.js');
  const { google } = await import('../src/google.js');
  const post = { id: 'post', kind: 'post', author_id: 'u1', created_at: '2026-01-01T00:00:00Z', data: { title: 'Our post', date: '2026-01-01', text: 'text' } };
  const comment = { id: 'comment', kind: 'comment', author_id: 'u2', created_at: '2026-01-02T00:00:00Z', data: { postId: 'post', text: 'comment text' } };
  const reply = { id: 'reply', kind: 'comment', author_id: 'u2', created_at: '2026-01-03T00:00:00Z', data: { postId: 'post', replyTo: 'comment', text: 'reply text' } };
  const eventNotice = { id: 'notice', kind: 'event_notice', author_id: 'u2', created_at: '2026-01-04T00:00:00Z', data: { title: 'Partner event', text: 'Partner event', date: '2027-02-12', eventId: 'event2' } };
  const rows = [post, comment, reply, eventNotice]; let attempts = 0, failBulk = true;
  Object.assign(repository, {
    members: async () => [{ email: 'one@example.com' }, { email: 'two@example.com' }], list: async () => [...rows], readAt: async () => [], notificationReads: async () => reads.map(record_id => ({ record_id })), coupleSettings: async () => ({}),
    markNotificationRead: async (_user, id) => { reads.push(id); },
    markNotificationsRead: async (_user, ids) => { if (failBulk) throw new Error('읽음 저장 실패'); reads.push(...ids); },
    saveCalendarNotice: async (user, notice) => { attempts++; if (attempts === 1) throw new Error('offline'); rows.push({ id: notice.id, kind: 'event_notice', author_id: user, data: { title: notice.title, date: notice.date, text: notice.title, eventId: notice.eventId }, created_at: new Date().toISOString() }); }
  });
  google.prepare = async () => {}; google.restore = async () => {}; google.events = async () => [];
  google.event = async () => ({ data: { date: '2027-03-12' } });
  google.saveEvent = async () => ({ id: 'new-google-event' });
  const click = dataset => listeners.get('click')({ target: { closest: () => ({ dataset }) } });
  try {
    await import('../src/app.js?notifications-test');
    for (let i = 0; i < 50 && !app.innerHTML.includes('notification-dot'); i++) await new Promise(resolve => setTimeout(resolve, 1));
    assert.match(app.innerHTML, /notification-dot/);
    await click({ action: 'notice-list' });
    assert.match(editor.innerHTML, /새 댓글/); assert.match(editor.innerHTML, /새 답글/); assert.match(editor.innerHTML, /새 일정/);
    assert.doesNotMatch(editor.innerHTML, /data-id="post"/);
    await click({ action: 'notice-open', id: 'reply' });
    assert.deepEqual(reads, ['reply']); assert.match(editor.innerHTML, /Our post/); assert.match(editor.innerHTML, /reply text/);
    await click({ action: 'notice-list' }); await click({ action: 'notice-open', id: 'notice' });
    assert.deepEqual(reads, ['reply', 'notice']); assert.equal(editor.open, false); assert.match(app.innerHTML, /2027년/); assert.match(app.innerHTML, /3월/);
    const error = { textContent: '' }, button = { textContent: 'save', isConnected: true };
    const form = { id: 'record-form', dataset: { kind: 'event', id: '' }, _data: { title: 'New event', date: '2027-02-12', text: '' }, querySelector: s => s === '[type="submit"]' ? button : error };
    await listeners.get('submit')({ target: form, preventDefault() {} });
    assert.equal(attempts, 1); assert.match(app.innerHTML, /상대방에게 알림을 전달하지 못했어요/);
    assert.equal(JSON.parse(values.get('geonjukong-pending-calendar-notices:u1')).length, 1);
    await click({ action: 'refresh' });
    assert.equal(attempts, 2); assert.equal(values.has('geonjukong-pending-calendar-notices:u1'), false);
    assert.equal(rows.filter(row => row.kind === 'event_notice' && row.data.eventId === 'new-google-event').length, 1);
    assert.doesNotMatch(app.innerHTML, /상대방에게 알림을 전달하지 못했어요/);
    assert.deepEqual(reads, ['reply', 'notice']);
    form.dataset.id = 'existing-event';
    await listeners.get('submit')({ target: form, preventDefault() {} });
    assert.equal(attempts, 2);
    assert.equal(values.has('geonjukong-pending-calendar-notices:u1'), false);
    await click({ action: 'notice-list' }); await click({ action: 'notice-read-all' });
    assert.match(toast.textContent, /읽음 저장 실패/); assert.match(app.innerHTML, /notification-dot/);
    failBulk = false; await click({ action: 'notice-read-all' });
    assert.deepEqual(reads, ['reply', 'notice', 'comment']); assert.doesNotMatch(app.innerHTML, /notification-dot/);
    assert.doesNotMatch(editor.innerHTML, /모두 읽음/);
  } finally { globalThis.setInterval = oldInterval; globalThis.FormData = oldFormData; }
});
