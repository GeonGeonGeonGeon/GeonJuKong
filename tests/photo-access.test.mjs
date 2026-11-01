import test from 'node:test';
import assert from 'node:assert/strict';

test('Drive 접근 거부 후 사진을 선택하면 원본을 다시 불러온다', async () => {
  const values = new Map([['geonjukong-auth', JSON.stringify({ user: { id: 'u1', email: 'one@example.com' }, access_token: 'session', expires_at: Date.now() + 3600000 })]]);
  const listeners = new Map(), app = { innerHTML: '' }, toast = { textContent: '', classList: { add() {}, remove() {} } };
  const editor = { innerHTML: '', open: false, scrollTop: 0, showModal() { this.open = true; }, close() { this.open = false; }, addEventListener() {} };
  const cover = { hidden: false }, status = { textContent: '' }, accessButton = { hidden: true };
  const img = { dataset: { driveFile: 'photo' }, isConnected: true, hidden: true, src: '' };
  img.parentElement = { querySelector: selector => ({ '.file-cover': cover, '[data-preview-status]': status, '[data-photo-access]': accessButton })[selector] };
  let images = [], allowed = false, picks = 0, requests = 0, cancel = true;
  const originalInterval = globalThis.setInterval, originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  globalThis.setInterval = () => 0; URL.createObjectURL = () => 'blob:allowed'; URL.revokeObjectURL = () => {};
  globalThis.window = { APP_CONFIG: { supabaseUrl: 'https://example.test', supabaseAnonKey: 'public' }, addEventListener() {}, scrollTo() {} };
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  globalThis.document = { hidden: false, activeElement: { matches: () => false }, querySelector: s => ({ '#app': app, '#editor': editor, '#toast': toast })[s] || null, querySelectorAll: s => s === 'img[data-drive-file]' ? images : [], addEventListener: (type, fn) => listeners.set(type, fn) };
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  globalThis.sessionStorage = localStorage; globalThis.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: '#home' }; globalThis.history = { replaceState() {} };
  const { repository } = await import('../src/backend.js'); const { google } = await import('../src/google.js');
  const repositoryProperties = Object.getOwnPropertyDescriptors(repository), googleProperties = Object.getOwnPropertyDescriptors(google);
  const row = { id: 'post', kind: 'post', author_id: 'u2', created_at: '2026-01-01T00:00:00Z', data: { title: 'Photo', date: '2026-01-01', files: [{ id: 'photo', name: 'photo.jpg', type: 'image/jpeg', source: 'drive' }] } };
  Object.assign(repository, { members: async () => [{ email: 'one@example.com' }, { email: 'two@example.com' }], list: async () => [row], readAt: async () => [], notificationReads: async () => [], coupleSettings: async () => ({ startDate: '2020-01-01' }) });
  Object.defineProperty(google, 'connected', { configurable: true, get: () => true });
  Object.assign(google, { prepare: async () => {}, events: async () => [], upcomingEvents: async () => [], image: async () => { requests++; if (!allowed) throw Object.assign(new Error('denied'), { status: 403 }); return new Blob(['photo'], { type: 'image/jpeg' }); }, pickPhoto: async id => { assert.equal(id, 'photo'); assert.equal(editor.open, false); picks++; if (cancel) throw new Error('선택 취소'); allowed = true; } });
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  const click = dataset => listeners.get('click')({ target: { closest: () => ({ dataset }) } });
  try {
    await import('../src/app.js?photo-access');
    for (let i = 0; i < 50 && !app.innerHTML; i++) await tick();
    images = [img]; await click({ action: 'open-post', id: 'post' }); await tick();
    assert.match(editor.innerHTML, /data-action="photo-access"/);
    assert.match(status.textContent, /접근이 거부/); assert.equal(accessButton.hidden, false);
    await click({ action: 'photo-access', id: 'photo' });
    assert.equal(editor.open, true); assert.match(toast.textContent, /선택 취소/); assert.equal(requests, 1);
    cancel = false; await click({ action: 'photo-access', id: 'photo' }); await tick();
    assert.equal(editor.open, true); assert.equal(picks, 2); assert.equal(requests, 2); assert.equal(img.src, 'blob:allowed');
    img.onload(); assert.equal(cover.hidden, true); assert.equal(accessButton.hidden, true);
  } finally { Object.defineProperties(repository, repositoryProperties); Object.defineProperties(google, googleProperties); globalThis.setInterval = originalInterval; URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; }
});

