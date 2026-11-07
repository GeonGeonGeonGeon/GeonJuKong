import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, googleEvent, validateRecord } from '../src/core.js';

test('일정 대상은 프로필 이름으로 선택하고 저장·수정·계정 전환 후에도 유지한다', async () => {
  const values = new Map([['geonjukong-seeded', '1'], ['geonjukong-demo-profiles', JSON.stringify([
    { user_id: 'demo-me', data: { name: '건우' } },
    { user_id: 'demo-partner', data: { name: '주희 <♡>' } }
  ])]]);
  const rows = new Map(), listeners = new Map();
  const app = { innerHTML: '' }, toast = { textContent: '', classList: { add() {}, remove() {} } };
  const editor = { innerHTML: '', open: false, showModal() { this.open = true; }, close() { this.open = false; }, addEventListener() {} };
  globalThis.window = { APP_CONFIG: {}, addEventListener() {}, scrollTo() {} };
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  globalThis.document = { querySelector: selector => ({ '#app': app, '#editor': editor, '#toast': toast })[selector] || null, querySelectorAll: () => [], addEventListener: (type, fn) => listeners.set(type, fn), activeElement: { matches: () => false } };
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  globalThis.sessionStorage = globalThis.localStorage;
  globalThis.location = { href: 'http://localhost:4173/', origin: 'http://localhost:4173', pathname: '/', hash: '#calendar' };
  globalThis.history = { replaceState() {} };
  const originalInterval = globalThis.setInterval, originalFormData = globalThis.FormData;
  globalThis.setInterval = () => 0;
  globalThis.FormData = class { constructor(form) { this.values = Object.entries(form.values); } [Symbol.iterator]() { return this.values[Symbol.iterator](); } };
  const { local } = await import('../src/storage.js');
  local.list = async () => [...rows.values()];
  local.put = async row => rows.set(row.id, row);
  const click = dataset => listeners.get('click')({ target: { closest: () => ({ dataset }) } });
  const submit = async (target, id = '') => {
    const error = { textContent: '' }, button = { textContent: '저장', isConnected: true };
    await listeners.get('submit')({ preventDefault() {}, target: { id: 'record-form', dataset: { kind: 'event', id }, values: { title: '병원 예약', date: dateKey(), target }, querySelector: selector => selector === '[type="submit"]' ? button : error } });
    assert.equal(error.textContent, '');
  };
  try {
    rows.set('legacy', { id: 'legacy', kind: 'event', author_id: 'demo-me', data: { title: '기존 일정', date: dateKey() } });
    await import('../src/app.js?calendar-targets');
    for (let i = 0; i < 30 && !app.innerHTML.includes('calendar-grid'); i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.match(app.innerHTML, /event-tone-shared/);
    assert.match(app.innerHTML, /건우 일정/);
    assert.match(app.innerHTML, /주희 &lt;♡&gt; 일정/);
    await click({ action: 'new', kind: 'event' });
    assert.match(editor.innerHTML, /name="target" value="shared" checked/);
    assert.match(editor.innerHTML, /name="target" value="member-1"/);
    assert.match(editor.innerHTML, /name="target" value="member-2"/);
    await submit('member-2');
    const saved = [...rows.values()].find(row => row.data.target === 'member-2');
    assert.ok(saved);
    assert.match(app.innerHTML, /event-marker event-tone-female/);
    await click({ action: 'edit-event', id: saved.id });
    assert.match(editor.innerHTML, /name="target" value="member-2" checked/);
    await submit('member-1', saved.id);
    assert.equal(rows.get(saved.id).data.target, 'member-1');
    assert.match(app.innerHTML, /event-marker event-tone-male/);
    await listeners.get('change')({ target: { id: 'demo-person', value: 'demo-partner' } });
    await click({ action: 'edit-event', id: saved.id });
    assert.match(editor.innerHTML, /name="target" value="member-1" checked/);
    await submit('shared', saved.id);
    assert.equal(rows.get(saved.id).data.target, 'shared');
    await click({ action: 'edit-event', id: 'legacy' });
    assert.match(editor.innerHTML, /name="target" value="shared" checked/);
    values.set('geonjukong-demo-profiles', JSON.stringify([{ user_id: 'demo-me', data: { name: '새 이름' } }]));
    await click({ action: 'refresh' });
    assert.match(app.innerHTML, /새 이름 일정/);
    assert.throws(() => validateRecord('event', { title: '잘못된 대상', date: dateKey(), target: 'invalid' }), /일정 대상/);
  } finally { globalThis.setInterval = originalInterval; globalThis.FormData = originalFormData; }
});

test('Google 일정 대상은 공유 속성으로 왕복하며 기존 일정은 공용으로 읽는다', async () => {
  globalThis.window = { APP_CONFIG: { calendarId: 'shared-calendar' } };
  const { google } = await import('../src/google.js?calendar-targets');
  google.setTokenProvider(async () => ({ access_token: 'test-token', expires_in: 3600 }));
  const originalFetch = globalThis.fetch;
  const start = { date: '2026-11-07' }, end = { date: '2026-11-08' };
  try {
    for (const target of ['shared', 'member-1', 'member-2']) {
      globalThis.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        assert.equal(body.extendedProperties.shared.geonjukongTarget, target);
        assert.equal(options.method, target === 'shared' ? 'POST' : 'PATCH');
        return Response.json({ id: 'event', ...body });
      };
      const result = await google.saveEvent({ title: '약속', date: start.date, target }, target === 'shared' ? undefined : 'event');
      assert.equal(googleEvent(result).data.target, target);
    }
    assert.equal(googleEvent({ start, end }).data.target, 'shared');
    assert.equal(googleEvent({ start, end, extendedProperties: { shared: { geonjukongTarget: 'unknown' } } }).data.target, 'shared');
  } finally { google.disconnect(); globalThis.fetch = originalFetch; }
});
