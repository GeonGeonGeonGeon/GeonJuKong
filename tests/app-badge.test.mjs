import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { native } from '../src/platform.js';
import { iosAppBadgeProject, iosMediaPickerProject } from '../scripts/native-projects.mjs';

test('앱 배지는 네이티브 브리지 또는 지원되는 웹 배지 API를 사용한다', async () => {
  const previousWindow = globalThis.window, previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const calls = [];
  try {
    globalThis.window = { GEONJUKONG_NATIVE: { active: true, setBadge: async value => calls.push(['native', value]) } };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
      setAppBadge: async (...args) => calls.push(['web', ...args]), clearAppBadge: async () => calls.push(['clear'])
    } });
    await native.setBadge(true); await native.setBadge(false);
    window.GEONJUKONG_NATIVE.active = false;
    await native.setBadge(true); await native.setBadge(false);
    assert.deepEqual(calls, [['native', true], ['native', false], ['web'], ['clear']]);
    delete navigator.setAppBadge; delete navigator.clearAppBadge;
    await native.setBadge(true); await native.setBadge(false);
    window.GEONJUKONG_NATIVE = { active: true };
    await native.setBadge(true);
  } finally {
    globalThis.window = previousWindow;
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator;
  }
});

test('iOS 프로젝트를 재설정해도 사진 선택기와 앱 배지가 각각 한 번 등록된다', async () => {
  const pickerSource = await readFile(new URL('../scripts/ios-media-picker.swift', import.meta.url), 'utf8');
  const badgeSource = await readFile(new URL('../scripts/ios-app-badge.swift', import.meta.url), 'utf8');
  const archive = fileURLToPath(new URL('../node_modules/@capacitor/cli/assets/ios-pods-template.tar.gz', import.meta.url));
  const extract = name => execFileSync('tar', ['-xOf', archive, name], { encoding: 'utf8', windowsHide: true });
  const delegate = extract('App/App/AppDelegate.swift');
  const storyboard = extract('App/App/Base.lproj/Main.storyboard');
  const first = iosMediaPickerProject(delegate, storyboard, pickerSource);
  const firstDelegate = iosAppBadgeProject(first.delegate, badgeSource);
  assert.ok(firstDelegate.startsWith(delegate.trimEnd()));
  const second = iosMediaPickerProject(firstDelegate, first.storyboard, pickerSource);
  assert.equal(iosAppBadgeProject(second.delegate, badgeSource), firstDelegate);
  assert.equal(second.storyboard, first.storyboard);
  assert.equal(firstDelegate.match(/registerPluginInstance\(AppBadgePlugin\(\)\)/g).length, 1);
  assert.equal(firstDelegate.match(/registerPluginInstance\(OrderedMediaPickerPlugin\(\)\)/g).length, 1);
  assert.equal(firstDelegate.match(/public class AppBadgePlugin/g).length, 1);
  assert.throws(() => iosAppBadgeProject(delegate, badgeSource), /ViewController/);
});

test('미확인 알림·읽음 저장·작성 중 동기화에 따라 배지를 갱신한다', async () => {
  const values = new Map([['geonjukong-auth', JSON.stringify({ user: { id: 'one', email: 'one@example.com' }, access_token: 'session', expires_at: Date.now() + 3600000 })]]);
  const listeners = new Map(), badges = [];
  const app = { innerHTML: '' }, editor = { innerHTML: '', open: false, scrollTop: 0, addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; } };
  const toast = { textContent: '', classList: { add() {}, remove() {} } };
  globalThis.window = { APP_CONFIG: { supabaseUrl: 'https://example.test', supabaseAnonKey: 'public' }, addEventListener() {}, scrollTo() {} };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { setAppBadge: async () => badges.push(true), clearAppBadge: async () => badges.push(false) } });
  globalThis.document = { hidden: false, activeElement: { matches: () => false }, querySelector: s => ({ '#app': app, '#editor': editor, '#toast': toast })[s] || null, querySelectorAll: () => [], addEventListener: (type, fn) => listeners.set(type, fn) };
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  globalThis.sessionStorage = localStorage;
  globalThis.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: '#home' };
  globalThis.history = { replaceState() {} };
  const realInterval = globalThis.setInterval;
  let tick, failRead = true, failList = false;
  globalThis.setInterval = fn => { tick = fn; return 0; };
  const { repository } = await import('../src/backend.js');
  const { google } = await import('../src/google.js');
  const post = { id: 'post', kind: 'post', author_id: 'two', created_at: '2026-01-01T00:00:00Z', data: { title: 'Shared', date: '2026-01-01', text: '', space: 'board' } };
  let rows = [post], reads = [];
  Object.assign(repository, {
    members: async () => [{ email: 'one@example.com' }, { email: 'two@example.com' }],
    list: async () => { if (failList) throw new Error('offline'); return [...rows]; },
    notificationReads: async () => reads.map(record_id => ({ record_id })), coupleSettings: async () => ({}), profiles: async () => [], bucketItems: async () => [],
    markNotificationsRead: async (_user, ids) => { if (failRead) throw new Error('read failed'); reads.push(...ids); }
  });
  google.prepare = async () => {}; google.restore = async () => {}; google.events = async () => [];
  const click = dataset => listeners.get('click')({ target: { closest: () => ({ dataset }) } });
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  try {
    await import('../src/app.js?app-badge-test');
    for (let i = 0; i < 50 && !badges.includes(true); i++) await settle();
    assert.equal(badges.at(-1), true);
    navigator.setAppBadge = async () => { throw new Error('badge permission denied'); };
    await click({ action: 'refresh' }); await settle();
    assert.match(app.innerHTML, /notification-dot/);
    navigator.setAppBadge = async () => badges.push(true);
    await click({ action: 'notice-list' }); await settle();
    assert.equal(badges.at(-1), true);
    await click({ action: 'notice-read-all' }); await settle();
    assert.equal(badges.at(-1), true); assert.match(toast.textContent, /read failed/);
    failRead = false;
    await click({ action: 'notice-read-all' }); await settle();
    assert.equal(badges.at(-1), false);
    const previousHTML = app.innerHTML;
    rows.push({ ...post, id: 'new-post' });
    document.activeElement = { matches: () => true };
    await tick(); await settle();
    assert.equal(editor.open, true); assert.equal(app.innerHTML, previousHTML);
    assert.equal(badges.at(-1), true);
    failList = true;
    await tick(); await settle();
    assert.equal(badges.at(-1), true);
    failList = false; reads.push('new-post');
    await tick(); await settle();
    assert.equal(badges.at(-1), false);
    rows.push({ ...post, id: 'own-post', author_id: 'one' });
    await tick(); await settle();
    assert.equal(badges.at(-1), false);
    let releaseBadge;
    navigator.setAppBadge = async () => { await new Promise(resolve => { releaseBadge = resolve; }); badges.push(true); };
    rows.push({ ...post, id: 'delayed-post' });
    await tick(); await settle();
    assert.equal(typeof releaseBadge, 'function');
    reads.push('delayed-post');
    await tick(); await settle();
    releaseBadge(); await settle();
    assert.equal(badges.at(-1), false);
    navigator.setAppBadge = async () => badges.push(true);
    rows.push({ ...post, id: 'before-logout' });
    await tick(); await settle();
    assert.equal(badges.at(-1), true);
    const { auth } = await import('../src/backend.js');
    const { local } = await import('../src/storage.js');
    auth.logout = async () => ({ remote: true });
    local.list = async () => [{ ...post, id: 'sample', author_id: 'demo-partner' }];
    values.set('geonjukong-seeded', '1');
    editor.close(); document.activeElement = { matches: () => false };
    await click({ action: 'logout' }); await settle();
    assert.equal(badges.at(-1), false);
    assert.match(app.innerHTML, /notification-dot/);
  } finally { globalThis.setInterval = realInterval; }
});
