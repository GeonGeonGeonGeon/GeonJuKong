import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey } from '../src/core.js';

test('캘린더 동기화 실패는 공유 공간을 유지하며 재시도로 복구한다', async () => {
  const values = new Map([['geonjukong-auth', JSON.stringify({ user: { id: 'user-1', email: 'one@example.com' }, access_token: 'session', expires_at: Date.now() + 3600000 })]]);
  const listeners = new Map();
  const app = { innerHTML: '' }, toast = { textContent: '', classList: { add() {}, remove() {} } };
  const editor = { open: false, addEventListener() {} };
  globalThis.window = { APP_CONFIG: { supabaseUrl: 'https://example.test', supabaseAnonKey: 'public' }, addEventListener() {}, scrollTo() {} };
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  globalThis.document = { querySelector: selector => ({ '#app': app, '#editor': editor, '#toast': toast })[selector] || null, querySelectorAll: () => [], addEventListener: (type, fn) => listeners.set(type, fn), activeElement: { matches: () => false } };
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  globalThis.sessionStorage = globalThis.localStorage;
  globalThis.location = { href: 'http://localhost:4173/', origin: 'http://localhost:4173', pathname: '/', hash: '#calendar' };
  globalThis.history = { replaceState() {} };
  const originalInterval = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  const { repository } = await import('../src/backend.js');
  const { google } = await import('../src/google.js');
  Object.assign(repository, { members: async () => [{ email: 'one@example.com' }, { email: 'two@example.com' }], list: async () => [], readAt: async () => [], notificationReads: async () => [], coupleSettings: async () => ({ startDate: '2020-01-01' }) });
  google.prepare = async () => {};
  Object.defineProperty(google, 'connected', { configurable: true, get: () => true });
  let attempts = 0;
  google.restore = async () => {};
  google.events = async () => { if (++attempts === 1) throw new Error('일시적인 네트워크 오류'); return []; };
  const future = new Date(); future.setDate(future.getDate() + 90);
  google.upcomingEvents = async () => [{ id: 'future', kind: 'event', data: { title: 'separate upcoming event', date: dateKey(future), time: '' } }];
  try {
    await import('../src/app.js?calendar-sync');
    for (let i = 0; i < 20 && !app.innerHTML.includes('일시적인 네트워크 오류'); i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.match(app.innerHTML, /일시적인 네트워크 오류/);
    assert.match(app.innerHTML, /data-action="calendar-retry"/);
    assert.doesNotMatch(app.innerHTML, /access-error/);
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'calendar-retry' } }) } });
    assert.equal(attempts, 2);
    assert.doesNotMatch(app.innerHTML, /일시적인 네트워크 오류/);
    assert.match(toast.textContent, /동기화했어요/);
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'month', offset: '1' } }) } });
    await listeners.get('click')({ target: { closest: () => ({ dataset: { view: 'home' } }) } });
    assert.match(app.innerHTML, /separate upcoming event/);
  } finally { globalThis.setInterval = originalInterval; }
});
