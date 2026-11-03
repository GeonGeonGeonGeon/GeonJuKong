import test from 'node:test';
import assert from 'node:assert/strict';

test('home photo selection saves multiple photos and navigates from a random starting photo', async () => {
  const values = new Map([['geonjukong-auth', JSON.stringify({ user: { id: 'u1', email: 'one@example.com' }, access_token: 'session', expires_at: Date.now() + 3600000 })]]);
  const listeners = new Map(), app = { innerHTML: '' }, toast = { textContent: '', classList: { add() {}, remove() {} } };
  const editor = { innerHTML: '', open: false, showModal() { this.open = true; }, close() { this.open = false; }, addEventListener() {} };
  globalThis.window = { APP_CONFIG: { supabaseUrl: 'https://example.test', supabaseAnonKey: 'public' }, addEventListener() {}, scrollTo() {} };
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  globalThis.document = { hidden: false, activeElement: { matches: () => false }, querySelector: s => ({ '#app': app, '#editor': editor, '#toast': toast })[s] || null, querySelectorAll: () => [], addEventListener: (type, fn) => listeners.set(type, fn) };
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  globalThis.sessionStorage = localStorage; globalThis.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: '#home' }; globalThis.history = { replaceState() {} };
  const interval = globalThis.setInterval, random = Math.random; globalThis.setInterval = () => 0; Math.random = () => 0.9;
  const { repository } = await import('../src/backend.js'); const { google } = await import('../src/google.js');
  const oldRepository = Object.getOwnPropertyDescriptors(repository), oldGoogle = Object.getOwnPropertyDescriptors(google);
  const file = id => ({ id, name: `${id}.jpg`, type: 'image/jpeg', source: 'local' });
  const rows = ['a', 'b'].map(id => ({ id, kind: 'post', author_id: 'u1', created_at: '2026-01-01T00:00:00Z', data: { title: id, date: '2026-01-01', files: [file(id)] } }));
  let saved;
  Object.assign(repository, { members: async () => [{ email: 'one@example.com' }, { email: 'two@example.com' }], list: async () => rows, readAt: async () => [], notificationReads: async () => [], coupleSettings: async () => ({ startDate: '2020-01-01', homePhoto: { recordId: 'a', fileId: 'a' } }), updateHomePhoto: async selection => { saved = selection; return { startDate: '2020-01-01', homePhoto: selection }; } });
  Object.defineProperty(google, 'connected', { configurable: true, get: () => true });
  Object.assign(google, { prepare: async () => {}, events: async () => [], upcomingEvents: async () => [] });
  const click = (dataset, button = {}) => listeners.get('click')({ target: { closest: () => Object.assign(button, { dataset }) } });
  try {
    await import('../src/app.js?home-photos');
    for (let i = 0; i < 50 && !app.innerHTML.includes('a.jpg'); i++) await new Promise(resolve => setTimeout(resolve, 0));
    await click({ action: 'choose-home-photo' });
    assert.match(editor.innerHTML, /data-id="a" data-file-id="a" aria-pressed="true"/);
    await click({ action: 'toggle-home-photo', id: 'b', fileId: 'b' }, { setAttribute() {} });
    await click({ action: 'set-home-photo' });
    assert.deepEqual(saved, [{ recordId: 'a', fileId: 'a' }, { recordId: 'b', fileId: 'b' }]);
    assert.match(app.innerHTML, /2 \/ 2/);
    await click({ action: 'home-photo-next' });
    assert.match(app.innerHTML, /1 \/ 2/);
  } finally {
    Object.defineProperties(repository, oldRepository); Object.defineProperties(google, oldGoogle);
    globalThis.setInterval = interval; Math.random = random;
  }
});
