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

test('startup downloads and decodes all home photos before rendering, with bounded failure recovery', async t => {
  for (const scenario of ['ready', 'fallback', 'denied', 'timeout', 'local', 'local-fallback', 'automatic']) await t.test(scenario, async () => {
    const values = new Map([['geonjukong-auth', JSON.stringify({ user: { id: 'u1', email: 'one@example.com' }, access_token: 'session', expires_at: Date.now() + 3600000 })]]);
    const listeners = new Map(), intervals = [], app = { innerHTML: '<div class="boot">Starting</div>' };
    const editor = { open: false, addEventListener() {} }, toast = { classList: { add() {}, remove() {} } };
    globalThis.window = { APP_CONFIG: { supabaseUrl: 'https://example.test', supabaseAnonKey: 'public' }, addEventListener() {}, scrollTo() {} };
    globalThis.document = { hidden: false, activeElement: { matches: () => false }, querySelector: s => ({ '#app': app, '#editor': editor, '#toast': toast })[s] || null, querySelectorAll: () => [], addEventListener: (type, fn) => listeners.set(type, fn) };
    globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
    globalThis.sessionStorage = localStorage;
    globalThis.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: '#home' };
    globalThis.history = { replaceState() {} };
    const { repository } = await import('../src/backend.js'), { google } = await import('../src/google.js'), { local } = await import('../src/storage.js');
    const oldRepository = Object.getOwnPropertyDescriptors(repository), oldGoogle = Object.getOwnPropertyDescriptors(google), oldFile = local.file;
    const oldImage = globalThis.Image, oldInterval = globalThis.setInterval, oldTimeout = globalThis.setTimeout;
    const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
    const requests = [], decoders = [], signals = [], releases = new Map();
    let expire, created = 0;
    globalThis.setInterval = callback => { intervals.push(callback); return 0; };
    globalThis.setTimeout = (callback, delay, ...args) => delay === 8000 ? (expire = callback, 0) : oldTimeout(callback, delay, ...args);
    globalThis.Image = class { decode() { return new Promise(resolve => decoders.push({ url: this.src, resolve })); } };
    URL.createObjectURL = () => `blob:startup-${++created}`;
    URL.revokeObjectURL = () => {};
    const file = id => ({ id, name: `${id}.jpg`, type: 'image/jpeg', source: scenario.startsWith('local') ? 'local' : 'drive' });
    const a = file('a'), b = file('b'), recent = file('recent');
    if (scenario.endsWith('fallback')) a.thumbnail = { ...file('preview'), type: 'image/webp' };
    const rows = [
      { id: 'recent', kind: 'post', author_id: 'u1', created_at: '2026-02-01T00:00:00Z', data: { date: '2026-02-01', files: [recent] } },
      { id: 'selected', kind: 'post', author_id: 'u1', created_at: '2026-01-01T00:00:00Z', data: { date: '2026-01-01', files: [a, b] } },
      { id: 'unrelated', kind: 'post', author_id: 'u1', created_at: '2025-01-01T00:00:00Z', data: { date: '2025-01-01', files: [file('unrelated')] } }
    ];
    Object.assign(repository, { members: async () => [{ email: 'one@example.com' }, { email: 'two@example.com' }], list: async () => rows, notificationReads: async () => [], coupleSettings: async () => ({ startDate: '2020-01-01', homePhoto: scenario === 'automatic' ? null : ['a', 'b'].map(fileId => ({ recordId: 'selected', fileId })) }), bucketList: async () => [], profiles: async () => [] });
    Object.defineProperty(google, 'connected', { configurable: true, get: () => true });
    Object.assign(google, { prepare: async () => {}, events: async () => [], upcomingEvents: async () => [], image: async (id, signal) => {
      requests.push(id); signals.push(signal);
      if (scenario === 'denied' || id === 'preview') throw Object.assign(new Error('denied'), { status: 403 });
      return new Promise(resolve => releases.set(id, () => resolve(new Blob([id], { type: 'image/jpeg' }))));
    } });
    local.file = async id => { requests.push(id); return id === 'preview' ? undefined : { blob: new Blob([id], { type: 'image/jpeg' }) }; };
    const tick = () => new Promise(resolve => oldTimeout(resolve, 0));
    const until = async predicate => { for (let i = 0; i < 80 && !predicate(); i++) await tick(); assert.ok(predicate()); };
    try {
      await import(`../src/app.js?startup-${scenario}`);
      const expected = scenario === 'automatic' ? ['recent'] : scenario.endsWith('fallback') ? ['a', 'b', 'preview', 'recent'] : ['a', 'b', 'recent'];
      await until(() => requests.length >= expected.length);
      assert.deepEqual([...new Set(requests)].sort(), expected);
      if (scenario === 'denied') {
        await until(() => app.innerHTML.includes('museum-photo'));
        assert.doesNotMatch(app.innerHTML, /access-error/);
        return;
      }
      assert.match(app.innerHTML, /class="boot"/);
      await intervals[0]();
      assert.match(app.innerHTML, /class="boot"/);
      if (scenario === 'timeout') {
        expire();
        await until(() => app.innerHTML.includes('museum-photo'));
        assert.ok(signals.every(signal => signal.aborted));
        for (const release of releases.values()) release();
        await tick();
        assert.equal(created, 0);
        return;
      }
      for (const release of releases.values()) release();
      const imageCount = scenario === 'automatic' ? 1 : 3;
      await until(() => decoders.length === imageCount);
      assert.match(app.innerHTML, /class="boot"/);
      for (const decoder of decoders.slice(0, -1)) decoder.resolve();
      await tick();
      assert.match(app.innerHTML, /class="boot"/);
      decoders.at(-1).resolve();
      await until(() => app.innerHTML.includes('museum-photo'));
      assert.match(app.innerHTML, /src="blob:startup-/);
      assert.doesNotMatch(app.innerHTML, /decoding="async" hidden/);
      if (scenario.endsWith('fallback')) assert.doesNotMatch(app.innerHTML, /data-(?:drive-file|file)="preview"/);
      const before = requests.length;
      await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'home-photo-next' } }) } });
      assert.equal(requests.length, before);
      assert.match(app.innerHTML, /src="blob:startup-/);
    } finally {
      Object.defineProperties(repository, oldRepository); Object.defineProperties(google, oldGoogle); local.file = oldFile;
      globalThis.Image = oldImage; globalThis.setInterval = oldInterval; globalThis.setTimeout = oldTimeout;
      URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
    }
  });
});
