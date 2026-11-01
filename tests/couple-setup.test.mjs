import test from 'node:test';
import assert from 'node:assert/strict';

test('첫 연결에서 날짜를 등록하고 기존 공유 설정을 보호한다', async () => {
  const values = new Map([['geonjukong-auth', JSON.stringify({ user: { id: 'u1' }, access_token: 'session', expires_at: Date.now() + 3600000 })]]);
  const listeners = new Map();
  const app = { innerHTML: '' }, toast = { textContent: '', classList: { add() {}, remove() {} } };
  const editor = { innerHTML: '', open: false, addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; } };
  globalThis.window = { APP_CONFIG: { supabaseUrl: 'https://example.test', supabaseAnonKey: 'public' }, addEventListener() {}, scrollTo() {} };
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  globalThis.document = { activeElement: { matches: () => false }, querySelector: s => ({ '#app': app, '#editor': editor, '#toast': toast })[s] || null, querySelectorAll: () => [], addEventListener: (type, fn) => listeners.set(type, fn) };
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  globalThis.sessionStorage = localStorage;
  globalThis.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: '' };
  globalThis.history = { replaceState() {} };
  const oldInterval = globalThis.setInterval, oldFormData = globalThis.FormData;
  globalThis.setInterval = () => 0;
  globalThis.FormData = class { constructor(form) { this.entries = Object.entries(form.values); } [Symbol.iterator]() { return this.entries[Symbol.iterator](); } };
  const { repository } = await import('../src/backend.js');
  const { google } = await import('../src/google.js');
  let shared = {}, writes = 0, fail = false;
  Object.assign(repository, {
    members: async () => [{ email: 'one@example.com' }, { email: 'two@example.com' }], list: async () => [], readAt: async () => [], notificationReads: async () => [], coupleSettings: async () => shared,
    createCoupleSettings: async data => { writes++; if (fail) throw new Error('저장 실패'); if (Object.keys(shared).length) return []; shared = data; return [{ data }]; },
    updateCoupleDate: async (field, date) => { assert.equal(field, 'birthday'); shared = { ...shared, birthdays: [{ id: '0', name: '하나', date }, shared.birthdays[1]] }; return shared; }
  });
  google.prepare = async () => {};
  google.birthday = async () => '2001-04-30';
  const tick = () => new Promise(resolve => setTimeout(resolve, 1));
  const start = async suffix => { app.innerHTML = ''; editor.open = false; await import(`../src/app.js?${suffix}`); for (let i = 0; i < 50 && !app.innerHTML; i++) await tick(); };
  const error = { textContent: '' }, button = { textContent: '저장', isConnected: true };
  const form = { id: 'couple-setup-form', values: { startDate: '2020-02-29' }, querySelector: s => s === '[type="submit"]' ? button : error };
  const submit = () => listeners.get('submit')({ target: form, preventDefault() {} });
  try {
    await start('setup-empty');
    assert.equal(editor.open, true); assert.match(editor.innerHTML, /couple-setup-form/); assert.match(editor.innerHTML, /나중에 설정/);
    assert.match(editor.innerHTML, /type="date"/); assert.doesNotMatch(editor.innerHTML, /birthday0Year/);
    form.values.startDate = ''; await submit(); assert.match(error.textContent, /올바른 날짜/); assert.equal(writes, 0);
    form.values.startDate = '2021-02-29'; await submit(); assert.match(error.textContent, /올바른 날짜/); assert.equal(writes, 0);
    form.values.startDate = '2020-02-29'; fail = true; await submit(); assert.match(error.textContent, /저장 실패/); assert.equal(editor.open, true);
    fail = false; await submit(); assert.equal(error.textContent, ''); assert.equal(editor.open, false);
    assert.equal(shared.startDate, '2020-02-29'); assert.deepEqual(shared.birthdays, []);
    shared.birthdays = [{}, { id: '1', name: '둘', date: '2002-05-01' }];
    const syncButton = { dataset: { action: 'sync-birthday' } };
    await listeners.get('click')({ target: { closest: () => syncButton } });
    assert.deepEqual(shared.birthdays.map(b => b.date), ['2001-04-30', '2002-05-01']);
    assert.match(toast.textContent, /생일을 가져왔어요/);
    await start('setup-existing'); assert.equal(editor.open, false);
    shared = {}; await start('setup-race'); assert.equal(editor.open, true);
    const other = { startDate: '2019-01-01', birthdays: [] }; shared = other; await submit();
    assert.equal(shared, other); assert.equal(editor.open, true); assert.match(error.textContent, /이미 공유 설정/);
  } finally { globalThis.setInterval = oldInterval; globalThis.FormData = oldFormData; }
});
