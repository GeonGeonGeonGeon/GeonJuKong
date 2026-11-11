import test from 'node:test';
import assert from 'node:assert/strict';

test('home photo library keeps used photos and sorts selections only when opening', async () => {
  const values = new Map([['geonjukong-auth', JSON.stringify({ user: { id: 'u1', email: 'one@example.com' }, access_token: 'session', expires_at: Date.now() + 3600000 })]]);
  const listeners = new Map(), app = { innerHTML: '' }, list = { scrollTop: 0 }, toast = { textContent: '', classList: { add() {}, remove() {} } };
  const editor = { innerHTML: '', open: false, showModal() { this.open = true; }, close() { this.open = false; }, addEventListener() {} };
  let editorHtml = '';
  Object.defineProperty(editor, 'innerHTML', { get: () => editorHtml, set(value) { editorHtml = value; list.scrollTop = 0; this.scrollTop = 0; } });
  globalThis.window = { APP_CONFIG: { supabaseUrl: 'https://example.test', supabaseAnonKey: 'public' }, addEventListener() {}, scrollTo() {} };
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  globalThis.document = { hidden: false, activeElement: { matches: () => false }, querySelector: s => ({ '#app': app, '#editor': editor, '#toast': toast, '.home-photo-options': list })[s] || null, querySelectorAll: () => [], addEventListener: (type, fn) => listeners.set(type, fn) };
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  globalThis.sessionStorage = localStorage; globalThis.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: '#home' }; globalThis.history = { replaceState() {} };
  const interval = globalThis.setInterval, random = Math.random; globalThis.setInterval = () => 0; Math.random = () => 0.9;
  const { repository } = await import('../src/backend.js'); const { google } = await import('../src/google.js');
  const oldRepository = Object.getOwnPropertyDescriptors(repository), oldGoogle = Object.getOwnPropertyDescriptors(google);
  const file = id => ({ id, name: `${id}.jpg`, type: 'image/jpeg', source: 'drive' });
  const rows = ['a', 'b', 'unused'].map(id => ({ id, kind: 'post', author_id: 'u1', created_at: '2026-01-01T00:00:00Z', data: { title: id, date: '2026-01-01', files: [file(id)] } }));
  let saved, failSave = false, failUpload = false, legacyValidation = true;
  const uploads = [], revoked = [], oldRevoke = URL.revokeObjectURL;
  URL.revokeObjectURL = url => revoked.push(url);
  Object.assign(repository, { members: async () => [{ email: 'one@example.com' }, { email: 'two@example.com' }], list: async () => rows, readAt: async () => [], notificationReads: async () => [], coupleSettings: async () => ({ startDate: '2020-01-01', homePhoto: [{ file: file('a') }] }), bucketItems: async () => [], profiles: async () => [], updateHomePhoto: async selection => {
    // The pre-gallery SQL requires a recordId and fileId on every photo.
    if (legacyValidation && selection.some(item => !item.recordId || !item.fileId)) throw new Error('올바른 사진을 선택해 주세요.');
    if (failSave) throw new Error('Settings save failed');
    saved = structuredClone(selection); return { startDate: '2020-01-01', homePhoto: selection };
  } });
  Object.defineProperty(google, 'connected', { configurable: true, get: () => true });
  Object.assign(google, { prepare: async () => {}, events: async () => [], upcomingEvents: async () => [], image: async () => new Blob(['image'], { type: 'image/jpeg' }), upload: async (file, progress) => {
    if (failUpload) throw new Error('Upload failed');
    uploads.push(file.name); progress(100);
    return { id: `gallery-${file.name}`, name: file.name, type: file.type, source: 'drive' };
  } });
  const click = (dataset, button = {}) => listeners.get('click')({ target: { closest: () => Object.assign(button, { dataset }) } });
  const change = files => listeners.get('change')({ target: { id: 'home-photo-files', files } });
  const options = () => [...editor.innerHTML.matchAll(/data-key="([^"]+)" aria-pressed="(true|false)" aria-label="([^"]+)"/g)].map(([, key, pressed, label]) => ({ key, pressed, label }));
  const hero = () => app.innerHTML.match(/<section class="museum-photo"[\s\S]*?<\/section>/)[0];
  const quietClick = async dataset => {
    const oldError = console.error; console.error = () => {};
    try { await click(dataset); } finally { console.error = oldError; }
  };
  try {
    await import('../src/app.js?home-photos');
    for (let i = 0; i < 50 && !app.innerHTML.includes('a.jpg'); i++) await new Promise(resolve => setTimeout(resolve, 0));
    await click({ action: 'choose-home-photo' });
    assert.match(editor.innerHTML, /id="home-photo-files" type="file" accept="image\/\*" multiple/);
    assert.match(hero(), /data-action="choose-home-photo">홈 사진 선택<\/button>/);
    assert.match(editor.innerHTML, /갤러리에서 추가<input/);
    assert.deepEqual(options().map(item => item.label), ['a.jpg 선택 해제']);
    assert.doesNotMatch(editor.innerHTML, /b.jpg|unused.jpg/);
    await click({ action: 'set-home-photo' });
    assert.equal(editor.open, false);
    assert.deepEqual(saved, [{ recordId: 'a', fileId: 'a', file: file('a'), selected: true }]);
    legacyValidation = false; saved = undefined;
    await click({ action: 'choose-home-photo' });
    assert.doesNotMatch(hero(), /open-post|open-comments/);
    const previousError = console.error; console.error = () => {};
    try {
      change([new File(['image'], 'image.jpg', { type: 'image/jpeg' }), new File(['video'], 'video.mp4', { type: 'video/mp4' })]);
    } finally { console.error = previousError; }
    assert.equal(options().length, 1);
    assert.equal(toast.textContent, '홈 사진에는 사진만 추가할 수 있어요.');
    change([new File(['new'], 'new.jpg', { type: 'image/jpeg', lastModified: 1 })]);
    change([]);
    change([new File(['new'], 'new.jpg', { type: 'image/jpeg', lastModified: 1 })]);
    assert.equal(options().length, 2);
    const legacyKey = options()[0].key;
    list.scrollTop = 240; editor.scrollTop = 90;
    await click({ action: 'toggle-home-photo', key: legacyKey });
    assert.deepEqual(options().map(item => item.label), ['a.jpg 선택', 'new.jpg 선택 해제']);
    assert.equal(list.scrollTop, 240); assert.equal(editor.scrollTop, 90);
    await click({ action: 'toggle-home-photo', key: legacyKey });
    await click({ action: 'show-home-post-photos' });
    assert.deepEqual(options().map(item => item.label), ['a.jpg 선택 해제', 'unused.jpg 선택', 'b.jpg 선택', 'new.jpg 선택 해제']);
    const postKey = options().find(item => item.label === 'b.jpg 선택').key;
    await click({ action: 'toggle-home-photo', key: postKey });
    assert.deepEqual(options().map(item => item.label), ['a.jpg 선택 해제', 'unused.jpg 선택', 'b.jpg 선택 해제', 'new.jpg 선택 해제']);
    await click({ action: 'show-home-post-photos' });
    assert.deepEqual(options().map(item => item.label), ['a.jpg 선택 해제', 'b.jpg 선택 해제', 'new.jpg 선택 해제']);
    failUpload = true;
    await quietClick({ action: 'set-home-photo' });
    assert.equal(editor.open, true); assert.equal(uploads.length, 0); assert.equal(saved, undefined);
    failUpload = false; failSave = true;
    await quietClick({ action: 'set-home-photo' });
    assert.equal(editor.open, true); assert.deepEqual(uploads, ['new.jpg']); assert.equal(saved, undefined);
    failSave = false;
    await click({ action: 'set-home-photo' });
    assert.deepEqual(uploads, ['new.jpg']);
    assert.deepEqual(saved, [{ recordId: 'a', fileId: 'a', file: file('a'), selected: true }, { recordId: 'b', fileId: 'b', file: file('b'), selected: true }, { file: { id: 'gallery-new.jpg', name: 'new.jpg', type: 'image/jpeg', source: 'drive' }, selected: true }]);
    assert.equal(editor.open, false); assert.equal(revoked.length, 1);
    assert.match(hero(), /gallery-new.jpg/); assert.doesNotMatch(hero(), /open-post|open-comments/);
    assert.match(app.innerHTML, /3 \/ 3/);
    await click({ action: 'home-photo-next' });
    assert.match(app.innerHTML, /1 \/ 3/);
    rows.splice(0, 2);
    await click({ action: 'choose-home-photo' });
    assert.deepEqual(options().map(item => item.label), ['a.jpg 선택 해제', 'b.jpg 선택 해제', 'new.jpg 선택 해제']);
    await click({ action: 'clear-home-photos' });
    assert.ok(options().every(item => item.pressed === 'false'));
    await click({ action: 'set-home-photo' });
    assert.equal(saved.length, 3); assert.ok(saved.every(item => item.selected === false));
    assert.match(hero(), /museum-photo-empty/);
    assert.doesNotMatch(hero(), /data-file|data-drive-file|open-post/);
    await click({ action: 'choose-home-photo' });
    assert.deepEqual(options().map(item => item.label), ['a.jpg 선택', 'b.jpg 선택', 'new.jpg 선택']);
    const galleryKey = options()[2].key;
    await click({ action: 'toggle-home-photo', key: galleryKey });
    assert.deepEqual(options().map(item => item.label), ['a.jpg 선택', 'b.jpg 선택', 'new.jpg 선택 해제']);
    await click({ action: 'set-home-photo' });
    await click({ action: 'choose-home-photo' });
    assert.deepEqual(options().map(item => item.label), ['new.jpg 선택 해제', 'a.jpg 선택', 'b.jpg 선택']);
    change([new File(['cancel'], 'cancel.jpg', { type: 'image/jpeg' })]);
    await click({ action: 'close' });
    assert.equal(revoked.length, 2); assert.deepEqual(saved.filter(item => item.selected).map(item => item.file.id), ['gallery-new.jpg']);
    assert.deepEqual(uploads, ['new.jpg']);
  } finally {
    Object.defineProperties(repository, oldRepository); Object.defineProperties(google, oldGoogle);
    globalThis.setInterval = interval; Math.random = random; URL.revokeObjectURL = oldRevoke;
  }
});

test('demo home photo library persists deselected photos across a fresh app load', async () => {
  const values = new Map([['geonjukong-seeded', '1']]), files = new Map(), listeners = new Map();
  const app = { innerHTML: '' }, toast = { classList: { add() {}, remove() {} } };
  const editor = { innerHTML: '', open: false, showModal() { this.open = true; }, close() { this.open = false; }, addEventListener() {} };
  globalThis.window = { APP_CONFIG: {}, addEventListener() {}, scrollTo() {} };
  globalThis.document = { hidden: false, activeElement: { matches: () => false }, querySelector: selector => ({ '#app': app, '#editor': editor, '#toast': toast })[selector] || null, querySelectorAll: () => [], addEventListener: (type, fn) => listeners.set(type, fn) };
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  globalThis.sessionStorage = localStorage;
  globalThis.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: '#home' };
  globalThis.history = { replaceState() {} };
  const { auth } = await import('../src/backend.js'), { google } = await import('../src/google.js'), { local } = await import('../src/storage.js');
  const oldAuth = Object.getOwnPropertyDescriptors(auth), oldGoogle = Object.getOwnPropertyDescriptors(google), oldLocal = Object.getOwnPropertyDescriptors(local), oldInterval = globalThis.setInterval;
  Object.defineProperty(auth, 'user', { configurable: true, get: () => null });
  Object.assign(google, { prepare: async () => {}, upload: async () => { throw new Error('Demo must not upload to Drive'); } });
  Object.assign(local, { list: async () => [], putFile: async (id, blob) => files.set(id, { blob }), file: async id => files.get(id) });
  globalThis.setInterval = () => 0;
  const click = action => listeners.get('click')({ target: { closest: () => ({ dataset: { action } }) } });
  const waitHome = async () => { for (let i = 0; i < 50 && !app.innerHTML.includes('museum-photo'); i++) await new Promise(resolve => setTimeout(resolve, 0)); assert.match(app.innerHTML, /museum-photo/); };
  try {
    await import('../src/app.js?demo-home-library'); await waitHome();
    await click('choose-home-photo');
    listeners.get('change')({ target: { id: 'home-photo-files', files: [new File(['demo'], 'demo.jpg', { type: 'image/jpeg' })] } });
    await click('set-home-photo');
    const saved = JSON.parse(values.get('geonjukong-demo-couple')).homePhoto;
    assert.equal(saved.length, 1); assert.equal(saved[0].selected, true); assert.equal(saved[0].file.source, 'local');
    assert.equal(files.get(saved[0].file.id).blob.name, 'demo.jpg');
    await click('choose-home-photo'); await click('clear-home-photos'); await click('set-home-photo');
    assert.equal(JSON.parse(values.get('geonjukong-demo-couple')).homePhoto[0].selected, false);
    app.innerHTML = '';
    await import('../src/app.js?demo-home-library-reload'); await waitHome();
    assert.match(app.innerHTML, /museum-photo-empty/);
    await click('choose-home-photo');
    assert.match(editor.innerHTML, /aria-pressed="false" aria-label="demo.jpg 선택"/);
    assert.equal(files.size, 1);
    await click('close');
  } finally {
    Object.defineProperties(auth, oldAuth); Object.defineProperties(google, oldGoogle); Object.defineProperties(local, oldLocal); globalThis.setInterval = oldInterval;
  }
});

test('startup renders before photo downloads and decoding, and only requests visible photos', async t => {
  for (const scenario of ['drive', 'fallback', 'denied', 'pending', 'local', 'local-fallback', 'empty']) await t.test(scenario, async () => {
    const values = new Map(), listeners = new Map(), requests = [], signals = [], releases = new Map();
    const editor = { innerHTML: '', open: false, addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; } };
    const toast = { classList: { add() {}, remove() {} } };
    let html = '', images = [], observer, created = 0, decodeCalls = 0;
    const app = { get innerHTML() { return html; }, set innerHTML(value) {
      images.forEach(img => { img.isConnected = false; }); images = []; html = value;
      for (const match of value.matchAll(/<div class="photo-preview"><div class="file-cover"[^>]*>[\s\S]*?<\/div><img ([^>]+)>/g)) {
        const attrs = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
        const dataset = {};
        for (const [key, value] of Object.entries(attrs)) if (key.startsWith('data-')) dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
        const cover = { hidden: false }, status = { textContent: '' };
        const img = { dataset, isConnected: true, hidden: !attrs.src, src: attrs.src || '', tagName: 'IMG', cover, status };
        img.parentElement = { querySelector: s => s === 'img' ? img : s === '.file-cover' ? cover : s === '[data-preview-status]' ? status : null };
        images.push(img);
      }
    } };
    globalThis.window = { APP_CONFIG: { supabaseUrl: 'https://example.test', supabaseAnonKey: 'public' }, addEventListener() {}, scrollTo() {} };
    globalThis.document = { hidden: false, activeElement: { matches: () => false }, querySelector: s => ({ '#app': app, '#editor': editor, '#toast': toast })[s] || null, querySelectorAll: s => s === 'img[data-drive-file]' ? images.filter(img => img.dataset.driveFile) : s === 'img[data-file], video[data-file]' ? images.filter(img => img.dataset.file) : [], addEventListener: (type, fn) => listeners.set(type, fn) };
    globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
    globalThis.sessionStorage = localStorage;
    globalThis.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: '#home' };
    globalThis.history = { replaceState() {} };
    const { auth, repository } = await import('../src/backend.js'), { google } = await import('../src/google.js'), { local } = await import('../src/storage.js');
    const oldAuth = Object.getOwnPropertyDescriptors(auth), oldRepository = Object.getOwnPropertyDescriptors(repository), oldGoogle = Object.getOwnPropertyDescriptors(google), oldFile = local.file;
    const oldImage = globalThis.Image, oldObserver = globalThis.IntersectionObserver, oldInterval = globalThis.setInterval, oldRandom = Math.random;
    const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
    globalThis.setInterval = () => 0; Math.random = () => 0;
    globalThis.Image = class { decode() { decodeCalls++; return new Promise(() => {}); } };
    globalThis.IntersectionObserver = class {
      constructor(callback) { this.callback = callback; this.targets = new Set(); observer = this; }
      observe(target) { this.targets.add(target); } unobserve(target) { this.targets.delete(target); } disconnect() { this.targets.clear(); }
      show(id) { this.callback([...this.targets].filter(target => { const img = target.querySelector('img'); return (img.dataset.driveFile || img.dataset.file) === id; }).map(target => ({ target, isIntersecting: true }))); }
    };
    URL.createObjectURL = () => `blob:visible-${++created}`; URL.revokeObjectURL = () => {};
    const file = id => ({ id, name: `${id}.jpg`, type: 'image/jpeg', source: scenario.startsWith('local') ? 'local' : 'drive' });
    const a = file('a'), b = file('b'), recent = file('recent');
    if (scenario.endsWith('fallback')) a.thumbnail = { ...file('preview'), type: 'image/webp' };
    const rows = [{ id: 'recent-post', kind: 'post', author_id: 'u1', created_at: '2026-02-01T00:00:00Z', data: { date: '2026-02-01', title: 'recent memory', files: [recent, file('offscreen')] } }];
    Object.defineProperty(auth, 'user', { configurable: true, get: () => ({ id: 'u1', email: 'one@example.com' }) });
    Object.assign(auth, { callback: async () => {}, takeProviderToken: () => null });
    Object.assign(repository, { members: async () => [{}, {}], list: async () => rows, notificationReads: async () => [], coupleSettings: async () => ({ startDate: '2020-01-01', homePhoto: scenario === 'empty' ? [] : [{ file: a }, { file: b }] }), bucketItems: async () => [], profiles: async () => [] });
    Object.defineProperty(google, 'connected', { configurable: true, get: () => true });
    Object.assign(google, { prepare: async () => {}, events: async () => [], upcomingEvents: async () => [], image: async (id, signal) => {
      requests.push(id); signals.push(signal);
      if (scenario === 'denied' || id === 'preview') throw Object.assign(new Error('denied'), { status: 403 });
      return new Promise(resolve => releases.set(id, () => resolve(new Blob([id], { type: 'image/jpeg' }))));
    } });
    local.file = async id => { requests.push(id); return id === 'preview' ? undefined : { blob: new Blob([id], { type: 'image/jpeg' }) }; };
    const tick = () => new Promise(resolve => setTimeout(resolve, 0));
    const until = async predicate => { for (let i = 0; i < 80 && !predicate(); i++) await tick(); assert.ok(predicate()); };
    const click = dataset => listeners.get('click')({ target: { closest: () => ({ dataset }) } });
    const currentHero = () => images.find(img => img.dataset.priority === 'high');
    try {
      await import(`../src/app.js?visible-startup-${scenario}`);
      await until(() => app.innerHTML.includes('recent memory'));
      assert.match(app.innerHTML, /data-view="calendar"/);
      assert.equal(decodeCalls, 0);
      assert.ok(!requests.includes('b') && !requests.includes('recent') && !requests.includes('offscreen'));
      if (scenario === 'empty') {
        assert.match(app.innerHTML, /museum-photo-empty/); assert.equal(requests.length, 0);
      } else {
        await until(() => requests.includes('a'));
        assert.deepEqual([...new Set(requests)], scenario.endsWith('fallback') ? ['preview', 'a'] : ['a']);
        if (scenario === 'denied') await until(() => currentHero().status.textContent.includes('거부'));
        else if (!scenario.startsWith('local')) {
          assert.equal(currentHero().src, '');
          if (scenario !== 'pending') { releases.get('a')(); await until(() => Boolean(currentHero().src)); }
        }
        if (scenario.startsWith('local') || !['pending', 'denied'].includes(scenario)) {
          await until(() => Boolean(currentHero().src));
          const img = currentHero();
          assert.equal(img.hidden, true); // Browser image completion is also independent of navigation.
          img.onload(); assert.equal(img.hidden, false); assert.equal(img.cover.hidden, true);
        }
        await click({ action: 'home-photo-next' });
        await until(() => requests.includes('b'));
        if (scenario === 'pending') assert.equal(signals[0].aborted, true);
        assert.ok(!requests.includes('offscreen'));
      }
      observer.show('recent'); await until(() => requests.includes('recent'));
      assert.ok(!requests.includes('offscreen'));
      await click({ view: 'calendar' }); assert.match(app.innerHTML, /OUR SHARED DAYS/);
      await click({ view: 'settings' }); assert.match(app.innerHTML, /MAKE OURSELVES AT HOME/);
      for (const release of releases.values()) release();
      await tick();
      assert.doesNotMatch(app.innerHTML, /access-error/);
    } finally {
      Object.defineProperties(auth, oldAuth); Object.defineProperties(repository, oldRepository); Object.defineProperties(google, oldGoogle); local.file = oldFile;
      globalThis.Image = oldImage; globalThis.IntersectionObserver = oldObserver; globalThis.setInterval = oldInterval; Math.random = oldRandom;
      URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
    }
  });
});
