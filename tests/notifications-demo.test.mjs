import test from 'node:test';
import assert from 'node:assert/strict';

test('체험 모드에서 상대방 일정과 댓글 알림의 읽음 상태를 저장한다', async () => {
  const values = new Map([['geonjukong-seeded', '1']]), listeners = new Map();
  const app = { innerHTML: '' }, editor = { innerHTML: '', open: false, scrollTop: 0, addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; } }, toast = { textContent: '', classList: { add() {}, remove() {} } };
  globalThis.window = { APP_CONFIG: {}, addEventListener() {}, scrollTo() {} };
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  globalThis.document = { activeElement: { matches: () => false }, querySelector: s => ({ '#app': app, '#editor': editor, '#toast': toast })[s] || null, querySelectorAll: () => [], addEventListener: (type, fn) => listeners.set(type, fn) };
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  globalThis.sessionStorage = localStorage;
  globalThis.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: '#home' };
  globalThis.history = { replaceState() {} };
  const previousInterval = globalThis.setInterval; globalThis.setInterval = () => 0;
  const { local } = await import('../src/storage.js');
  local.list = async () => [
    { id: 'post', kind: 'post', author_id: 'demo-me', created_at: '2026-01-01T00:00:00Z', data: { title: 'Post', date: '2026-01-01' } },
    { id: 'comment', kind: 'comment', author_id: 'demo-partner', created_at: '2026-01-02T00:00:00Z', data: { postId: 'post', text: 'Comment' } },
    { id: 'event', kind: 'event', author_id: 'demo-partner', created_at: '2026-01-03T00:00:00Z', data: { title: 'Event', date: '2027-03-05' } },
    { id: 'mine', kind: 'event', author_id: 'demo-me', created_at: '2026-01-04T00:00:00Z', data: { title: 'Own event', date: '2027-03-06' } }
  ];
  const click = dataset => listeners.get('click')({ target: { closest: () => ({ dataset }) } });
  try {
    await import('../src/app.js?demo-notifications');
    for (let i = 0; i < 50 && !app.innerHTML.includes('notification-dot'); i++) await new Promise(resolve => setTimeout(resolve, 1));
    await click({ action: 'notice-list' });
    assert.match(editor.innerHTML, /새 댓글/); assert.match(editor.innerHTML, /새 일정/); assert.doesNotMatch(editor.innerHTML, /Own event/);
    await click({ action: 'notice-open', id: 'event' });
    assert.match(app.innerHTML, /2027년/); assert.match(app.innerHTML, /3월/);
    assert.deepEqual(JSON.parse(values.get('geonjukong-demo-notification-reads')), [{ user_id: 'demo-me', record_id: 'event' }]);
    await click({ action: 'notice-list' }); await click({ action: 'notice-open', id: 'comment' });
    assert.match(editor.innerHTML, /Comment/); assert.equal(JSON.parse(values.get('geonjukong-demo-notification-reads')).length, 2);
    assert.doesNotMatch(app.innerHTML, /notification-dot/);
  } finally { globalThis.setInterval = previousInterval; }
});
