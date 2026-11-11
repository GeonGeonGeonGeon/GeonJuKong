import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey } from '../src/core.js';

test('shared polling refreshes settings, reads, calendar and comments without losing a draft', async () => {
  const realInterval = globalThis.setInterval, realNow = Date.now;
  let tick, clock = realNow(), calendarCalls = 0;
  globalThis.setInterval = fn => { tick = fn; return 0; };
  Date.now = () => clock;
  const values = new Map([['geonjukong-auth', JSON.stringify({ user: { id: 'one', email: 'one@example.com' }, access_token: 'session', expires_at: clock + 3600000 })]]);
  const listeners = new Map();
  const app = { innerHTML: '' }, toast = { textContent: '', classList: { add() {}, remove() {} } };
  const count = { textContent: '0' };
  const comments = { innerHTML: '', contains: element => element === commentButton, previousElementSibling: { querySelector: () => count } };
  const editor = { open: false, scrollTop: 142, innerHTML: '', showModal() { this.open = true; }, close() { this.open = false; }, addEventListener() {}, querySelector: selector => selector === '.comments' ? comments : null, classList: { add() {}, remove() {} }, style: { setProperty() {}, removeProperty() {} } };
  const commentButton = { matches: () => false };
  const draft = { value: 'draft text', selectionStart: 2, selectionEnd: 4, matches: () => true, focus() { document.activeElement = this; }, addEventListener() {}, removeEventListener() {} };
  const error = { textContent: '' }, commentForm = { querySelector: () => error, scrollIntoView() {} };
  globalThis.window = { APP_CONFIG: { supabaseUrl: 'https://example.test', supabaseAnonKey: 'public' }, addEventListener() {}, removeEventListener() {}, scrollTo() {}, requestAnimationFrame() { return 1; }, cancelAnimationFrame() {} };
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  globalThis.document = { hidden: false, activeElement: { matches: () => false }, querySelector: selector => ({ '#app': app, '#toast': toast, '#editor': editor, '#comment-text': draft, '#comment-form': editor.open && editor.innerHTML.includes('id="comment-form"') ? commentForm : null })[selector] || null, querySelectorAll: () => [], addEventListener: (type, fn) => listeners.set(type, fn) };
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  globalThis.sessionStorage = globalThis.localStorage;
  globalThis.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: '#calendar' };
  globalThis.history = { replaceState() {} };
  const { repository } = await import('../src/backend.js');
  const { google } = await import('../src/google.js');
  const post = { id: 'post', kind: 'post', author_id: 'two', created_at: '2026-01-01T00:00:00Z', data: { title: 'shared', date: '2026-01-01', text: 'text' } };
  let rows = [post], read = false, startDate = '2020-01-01';
  Object.assign(repository, { members: async () => [{ email: 'one@example.com' }, { email: 'two@example.com' }], list: async () => rows, profiles: async () => [], bucketItems: async () => [], readAt: async () => [], notificationReads: async () => read ? [{ record_id: 'post' }] : [], coupleSettings: async () => ({ startDate }) });
  google.prepare = async () => {};
  google.restore = async () => {};
  const event = title => [{ id: 'event', data: { title, date: dateKey(), time: '' } }];
  google.events = async () => { calendarCalls++; return event(calendarCalls === 1 ? 'old event' : 'new event'); };
  try {
    await import('../src/app.js?polling-test');
    for (let i = 0; i < 30 && !app.innerHTML.includes('notification-dot'); i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.match(app.innerHTML, /notification-dot/);
    assert.equal(calendarCalls, 1);
    read = true; startDate = '2021-01-01'; clock += 61000;
    await tick();
    assert.doesNotMatch(app.innerHTML, /notification-dot/);
    assert.equal(calendarCalls, 2);
    assert.match(app.innerHTML, /new event/);
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'open-post', id: 'post' } }) } });
    assert.equal(editor.open, true);
    editor.scrollTop = 142;
    document.activeElement = draft;
    rows = [post, { id: 'comment', kind: 'comment', author_id: 'two', created_at: '2026-01-01T00:00:01Z', data: { postId: 'post', text: 'new comment' } }];
    await tick();
    assert.match(comments.innerHTML, /new comment/);
    assert.equal(count.textContent, '1');
    assert.equal(editor.scrollTop, 142);
    assert.equal(document.activeElement, draft);
    assert.equal(draft.value, 'draft text');
    assert.deepEqual([draft.selectionStart, draft.selectionEnd], [2, 4]);
    document.activeElement = commentButton;
    rows = [...rows, { id: 'comment2', kind: 'comment', author_id: 'two', created_at: '2026-01-01T00:00:02Z', data: { postId: 'post', text: 'second comment' } }];
    await tick();
    assert.doesNotMatch(comments.innerHTML, /second comment/);
    document.activeElement = draft;
    await tick();
    assert.match(comments.innerHTML, /second comment/);
    assert.equal(count.textContent, '2');
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'open-comments', id: 'post' } }) } });
    assert.match(editor.innerHTML, /comments-post-title/);
    assert.doesNotMatch(editor.innerHTML, /post-text/);
    editor.scrollTop = 93;
    rows = [...rows, { id: 'comment3', kind: 'comment', author_id: 'two', created_at: '2026-01-01T00:00:03Z', data: { postId: 'post', text: 'popup update' } }];
    await tick();
    assert.match(comments.innerHTML, /popup update/);
    assert.equal(count.textContent, '3');
    assert.equal(editor.scrollTop, 93);
    assert.equal(document.activeElement, draft);
    assert.equal(draft.value, 'draft text');
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'reply', id: 'comment' } }) } });
    assert.match(editor.innerHTML, /class="comment-form reply-form"/);
    const inlineReply = editor.innerHTML;
    comments.innerHTML = inlineReply;
    document.activeElement = { matches: () => false };
    rows = [...rows, { id: 'comment4', kind: 'comment', author_id: 'two', created_at: '2026-01-01T00:00:04Z', data: { postId: 'post', text: 'arrived while replying' } }];
    await tick();
    assert.equal(comments.innerHTML, inlineReply);
    assert.equal(draft.value, 'draft text');
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'cancel-reply' } }) } });
    assert.match(editor.innerHTML, /arrived while replying/);
    assert.doesNotMatch(editor.innerHTML, /reply-form/);
    document.activeElement = draft;
    let releaseCalendar, rejectSave;
    google.events = async () => new Promise(resolve => { releaseCalendar = resolve; });
    clock += 61000;
    const refresh = tick();
    for (let i=0; i<20 && !releaseCalendar; i++) await new Promise(resolve => setTimeout(resolve, 1));
    assert.ok(releaseCalendar);
    repository.save = async () => new Promise((_resolve, reject) => { rejectSave = reject; });
    const sendButton = { textContent: 'send', isConnected: true };
    const sendingForm = { id: 'comment-form', dataset: { post: 'post' }, elements: { text: draft }, querySelector: selector => selector === '[type="submit"]' ? sendButton : error };
    const saving = listeners.get('submit')({ target: sendingForm, preventDefault() {} });
    assert.ok(rejectSave);
    releaseCalendar(event('stale while saving'));
    await refresh;
    rejectSave(new Error('test cancelled'));
    await saving;
    await listeners.get('click')({ target: { closest: () => ({ dataset: { view: 'calendar' } }) } });
    assert.match(app.innerHTML, /new event/);
    assert.doesNotMatch(app.innerHTML, /stale while saving/);
    google.events = async () => event('new event');
    rows = [];
    await tick();
    assert.match(error.textContent, /삭제/);
    assert.equal(draft.value, 'draft text');
    assert.equal(document.activeElement, draft);
    const { auth } = await import('../src/backend.js');
    const { local } = await import('../src/storage.js');
    auth.logout = async () => ({ remote: false });
    let unsubscribed = false;
    navigator.serviceWorker = { getRegistration: async () => ({ pushManager: { getSubscription: async () => ({ endpoint: 'https://push.example/token', unsubscribe: async () => { unsubscribed = true; return true; } }) } }) };
    repository.unsubscribe = async () => { throw new Error('offline'); };
    local.list = async () => [];
    values.set('geonjukong-seeded', '1');
    editor.open = false;
    document.activeElement = { matches: () => false };
    const releases = [];
    repository.list = () => new Promise(resolve => { releases.push(resolve); });
    const inFlight = tick();
    const manualRefresh = listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'refresh' } }) } });
    for (let i=0; i<20 && releases.length < 2; i++) await new Promise(resolve => setTimeout(resolve, 1));
    assert.equal(releases.length, 2);
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'logout' } }) } });
    assert.equal(unsubscribed, true);
    assert.match(toast.textContent, /이 기기에서는 로그아웃했지만/);
    for (const release of releases) release([post]);
    await Promise.all([inFlight, manualRefresh]);
    await listeners.get('click')({ target: { closest: () => ({ dataset: { view: 'memories' } }) } });
    assert.doesNotMatch(app.innerHTML, /shared/);
  } finally { globalThis.setInterval = realInterval; Date.now = realNow; }
});

test('startup keeps navigation usable through delayed and failed sections, and ignores previous sessions', async t => {
  for (const scenario of ['auth-failed', 'unauthorized', 'delayed', 'failed', 'records-failed', 'setup-empty', 'setup-failed', 'switch-account', 'same-account', 'late-logout']) await t.test(scenario, async () => {
    const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
    const gates = Object.fromEntries(['auth', 'members', 'records', 'notifications', 'couple', 'bucket', 'profiles', 'calendar', 'upcoming', 'demo'].map(key => [key, deferred()]));
    const calls = new Map(), listeners = new Map(), values = new Map([['geonjukong-seeded', '1']]);
    const app = { innerHTML: '' }, toast = { textContent: '', classList: { add() {}, remove() {} } };
    const editor = { innerHTML: '', open: false, showModal() { this.open = true; }, close() { this.open = false; }, addEventListener() {} };
    let user = { id: 'old-user', email: 'one@example.com' }, secondSession = false, authStarted = false, handleLink, handleBack, poll;
    globalThis.window = { APP_CONFIG: { supabaseUrl: 'https://example.test', supabaseAnonKey: 'public' }, addEventListener() {}, scrollTo() {} };
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
    globalThis.document = { hidden: false, activeElement: { matches: () => false }, querySelector: s => ({ '#app': app, '#editor': editor, '#toast': toast })[s] || null, querySelectorAll: () => [], addEventListener: (type, fn) => listeners.set(type, fn) };
    globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
    globalThis.sessionStorage = localStorage; globalThis.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: '#home' }; globalThis.history = { replaceState() {} };
    const { auth, repository } = await import('../src/backend.js'), { google } = await import('../src/google.js'), { native } = await import('../src/platform.js'), { local } = await import('../src/storage.js');
    const originals = [auth, repository, google, native, local].map(value => Object.getOwnPropertyDescriptors(value));
    const oldInterval = globalThis.setInterval, oldError = console.error;
    globalThis.setInterval = fn => { poll = fn; return 0; }; console.error = () => {};
    Object.defineProperty(auth, 'user', { configurable: true, get: () => user });
    Object.assign(auth, { callback: async () => { authStarted = true; await gates.auth.promise; }, takeProviderToken: () => null, logout: async () => { user = null; return { remote: true }; } });
    const request = (key, next) => { calls.set(key, (calls.get(key) || 0) + 1); return secondSession ? Promise.resolve(next) : gates[key].promise; };
    Object.assign(repository, {
      members: () => request('members', [{}, {}]), list: () => request('records', []), notificationReads: () => request('notifications', []),
      coupleSettings: () => request('couple', { startDate: '2022-02-02' }), bucketItems: () => request('bucket', []),
      profiles: () => request('profiles', [{ user_id: user.id, email: user.email, data: { name: 'CURRENT PROFILE' } }])
    });
    Object.defineProperty(google, 'connected', { configurable: true, get: () => true });
    Object.assign(google, { prepare: async () => {}, events: () => request('calendar', []), upcomingEvents: () => request('upcoming', []), disconnect() {} });
    Object.assign(native, { listen: async fn => { handleLink = fn; }, onBack: async fn => { handleBack = fn; } });
    local.list = async () => { if (scenario === 'late-logout') { calls.set('demo', true); return gates.demo.promise; } return []; };
    const tick = () => new Promise(resolve => setTimeout(resolve, 0));
    const until = async predicate => { for (let i = 0; i < 80 && !predicate(); i++) await tick(); assert.ok(predicate()); };
    const click = dataset => listeners.get('click')({ target: { closest: () => ({ dataset }) } });
    try {
      await import(`../src/app.js?startup-sections-${scenario}`);
      await until(() => authStarted);
      await handleBack(); await click({ view: 'settings' });
      assert.doesNotMatch(app.innerHTML, /class="sidebar"/); assert.equal(calls.size, 0);
      if (scenario === 'auth-failed') {
        gates.auth.reject(new Error('auth denied')); await until(() => app.innerHTML.includes('access-error'));
        assert.equal(calls.size, 0); assert.doesNotMatch(app.innerHTML, /class="sidebar"/); return;
      }
      gates.auth.resolve(); await until(() => calls.has('members'));
      assert.doesNotMatch(app.innerHTML, /class="sidebar"/); assert.equal(calls.has('records'), false);
      if (scenario === 'unauthorized') {
        gates.members.resolve([{}]); await until(() => app.innerHTML.includes('access-error'));
        assert.equal(calls.has('records'), false); assert.doesNotMatch(app.innerHTML, /class="sidebar"/); return;
      }
      gates.members.resolve([{}, {}]);
      await until(() => app.innerHTML.includes('class="sidebar"'));
      assert.match(app.innerHTML, /data-loading="upcoming"/); assert.equal(editor.open, false);
      await poll(); assert.equal(calls.get('records'), 1);
      for (const [view, key] of [['calendar', 'calendar'], ['memories', 'records'], ['bucket', 'bucket'], ['settings', 'profiles']]) {
        await click({ view }); assert.match(app.innerHTML, new RegExp(`data-loading="${key}"`));
      }
      assert.doesNotMatch(app.innerHTML, /access-error/);
      if (scenario === 'records-failed') {
        gates.records.reject(new Error('records offline')); gates.notifications.reject(new Error('reads offline'));
        gates.couple.resolve({ startDate: '2020-01-01' });
        for (const key of ['bucket', 'profiles', 'calendar', 'upcoming']) gates[key].resolve([]);
        await click({ view: 'memories' }); await until(() => app.innerHTML.includes('records offline'));
        assert.match(app.innerHTML, /reads offline/); assert.doesNotMatch(app.innerHTML, /첫 일기를 써/);
        secondSession = true; await poll();
        assert.doesNotMatch(app.innerHTML, /records offline|reads offline/); assert.match(app.innerHTML, /첫 일기를 써/);
        return;
      }
      if (scenario.endsWith('account') || scenario === 'late-logout') {
        const loggingOut = click({ action: 'logout' });
        if (scenario === 'late-logout') await until(() => calls.has('demo'));
        else { await loggingOut; assert.match(app.innerHTML, /체험 기록/); }
        user = { id: scenario === 'same-account' ? 'old-user' : 'new-user', email: 'one@example.com' };
        secondSession = true;
        await handleLink('com.geonjukong.couple://auth/callback?code=mock');
        await until(() => app.innerHTML.includes('CURRENT PROFILE'));
        const before = app.innerHTML;
        if (scenario === 'late-logout') { gates.demo.resolve([]); await loggingOut; assert.equal(app.innerHTML, before); }
        gates.records.resolve([{ id: 'old-post', kind: 'post', author_id: 'old-user', data: { title: 'OLD PRIVATE RECORD', date: dateKey(), files: [] } }]);
        gates.notifications.resolve([{ record_id: 'old-post' }]);
        gates.couple.resolve({});
        gates.bucket.resolve([{ id: 'old-bucket', title: 'OLD PRIVATE BUCKET' }]);
        gates.profiles.resolve([{ user_id: 'old-user', data: { name: 'OLD PRIVATE PROFILE' } }]);
        const oldEvent = [{ id: 'old-event', data: { title: 'OLD PRIVATE EVENT', date: dateKey() } }];
        gates.calendar.resolve(oldEvent); gates.upcoming.resolve(oldEvent);
        for (let i = 0; i < 5; i++) await tick();
        assert.equal(app.innerHTML, before); assert.equal(editor.open, false);
        for (const view of ['home', 'memories', 'bucket', 'calendar', 'settings']) {
          await click({ view }); assert.doesNotMatch(app.innerHTML, /OLD PRIVATE/);
        }
        assert.match(app.innerHTML, /2022-02-02/);
        return;
      }
      gates.records.resolve([]); gates.notifications.resolve([]);
      await click({ view: 'home' });
      await until(() => app.innerHTML.includes('첫 번째 추억'));
      assert.match(app.innerHTML, /data-loading="upcoming"/); assert.equal(editor.open, false);
      if (scenario === 'setup-failed') gates.couple.reject(new Error('settings offline'));
      else gates.couple.resolve(scenario === 'setup-empty' ? {} : { startDate: '2020-01-01' });
      if (scenario === 'setup-empty') {
        await until(() => editor.open); assert.match(editor.innerHTML, /couple-setup-form/);
        await click({ action: 'close' });
      } else {
        await until(() => scenario === 'setup-failed' ? app.innerHTML.includes('settings offline') : app.innerHTML.includes('Together for'));
        assert.equal(editor.open, false);
      }
      if (scenario === 'delayed') {
        await click({ action: 'profile-open', id: 'old-user' }); assert.match(editor.innerHTML, /data-loading="profiles"/);
        assert.doesNotMatch(editor.innerHTML, /아직 자기소개/);
      }
      for (const key of ['profiles', 'bucket', 'calendar', 'upcoming']) {
        if (scenario === 'failed') gates[key].reject(new Error(`${key} offline`));
        else gates[key].resolve([]);
      }
      if (scenario === 'delayed') {
        await until(() => editor.innerHTML.includes('아직 자기소개'));
        await click({ action: 'close' });
      }
      await click({ view: 'settings' });
      await until(() => !app.innerHTML.includes('data-loading="profiles"'));
      if (scenario === 'failed') {
        assert.match(app.innerHTML, /profiles offline/);
        await click({ action: 'profile-open', id: 'old-user' }); assert.match(editor.innerHTML, /profiles offline/);
        await click({ action: 'close' });
        await click({ view: 'bucket' }); assert.match(app.innerHTML, /bucket offline/); assert.doesNotMatch(app.innerHTML, /첫 목표 추가/);
        await click({ view: 'calendar' }); assert.match(app.innerHTML, /calendar offline/); assert.doesNotMatch(app.innerHTML, /아직 약속이 없는 날/);
        await click({ view: 'home' }); assert.match(app.innerHTML, /upcoming offline/); assert.doesNotMatch(app.innerHTML, /아직 정해진 약속/);
      } else {
        await click({ view: 'bucket' }); assert.match(app.innerHTML, /첫 목표 추가/);
        await click({ view: 'calendar' }); assert.match(app.innerHTML, /아직 약속이 없는 날/);
        await click({ view: 'home' }); assert.match(app.innerHTML, scenario === 'delayed' ? /home-event/ : /아직 정해진 약속/);
      }
      assert.doesNotMatch(app.innerHTML, /access-error/); assert.equal(editor.open, false);
    } finally {
      [auth, repository, google, native, local].forEach((value, i) => Object.defineProperties(value, originals[i]));
      globalThis.setInterval = oldInterval; console.error = oldError;
    }
  });
});
