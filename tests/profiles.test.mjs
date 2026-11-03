import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createProfiles, validateProfile, createProfilePhoto } from '../src/profiles.js';

function fixture(mode = 'demo') {
  const state = { mode, user: mode === 'demo' ? 'demo-me' : 'uuid-me', members: [{ email: 'me@example.com', display_name: '건주' }, { email: 'partner@example.com', display_name: '콩' }], profiles: [] };
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const ui = { title: '', html: '', renders: 0, closed: 0, toast: '' };
  const repository = {};
  const profiles = createProfiles({ state, repository, dialog(title, html) { ui.title = title; ui.html = html; }, closeDialog() { ui.closed++; }, render() { ui.renders++; }, toast(message) { ui.toast = message; }, currentEmail: () => 'me@example.com' });
  const error = { textContent: '' }, button = { disabled: false };
  const form = { id: 'profile-form', isConnected: true, elements: { name: { value: '' }, status: { value: '' }, bio: { value: '' } }, querySelector: selector => selector === '.form-error' ? error : button };
  return { state, values, ui, repository, profiles, form, error, button };
}

test('profile validation bounds text and accepts only small raster data URLs', () => {
  assert.deepEqual(validateProfile({ name: ' 건주 ', bio: ' 소개 ', status: ' 오늘 ' }), { name: '건주', bio: '소개', status: '오늘', photo: '' });
  assert.throws(() => validateProfile({ name: 'x'.repeat(31) }), /30자/);
  assert.throws(() => validateProfile({ status: 'x'.repeat(101) }), /100자/);
  assert.throws(() => validateProfile({ bio: 'x'.repeat(1001) }), /1,000자/);
  assert.throws(() => validateProfile({ photo: 'data:image/svg+xml;base64,PHN2Zz4=' }), /다시 선택/);
  assert.throws(() => validateProfile({ photo: 'https://example.com/photo.png' }), /다시 선택/);
  assert.throws(() => validateProfile({ photo: `data:image/png;base64,${'a'.repeat(180000)}` }), /다시 선택/);
});

test('demo profiles save per person and escape profile text', async () => {
  const { state, profiles, ui, form, values } = fixture();
  await profiles.action('profile-edit', {});
  assert.match(ui.html, /name="name"/);
  form.elements.name.value = '<b>별명</b>';
  form.elements.bio.value = '<script>hello</script>';
  form.elements.status.value = '<img src=x onerror=alert(1)>';
  assert.equal(await profiles.submit(form), true);
  assert.equal(ui.closed, 1);
  assert.equal(ui.renders, 1);
  assert.match(values.get('geonjukong-demo-profiles'), /<script>/);
  assert.equal(profiles.nameOf('demo-me'), '<b>별명</b>');
  profiles.open('demo-me');
  assert.match(ui.html, /&lt;b&gt;별명&lt;\/b&gt;/);
  assert.match(ui.html, /&lt;script&gt;hello&lt;\/script&gt;/);
  assert.doesNotMatch(ui.html, /<script>/);
  assert.match(ui.html, /data-action="profile-edit"/);
  state.user = 'demo-partner';
  profiles.open('demo-me');
  assert.doesNotMatch(ui.html, /data-action="profile-edit"/);
  assert.match(profiles.avatar('demo-me', true), /data-action="profile-open"/);
  await profiles.load();
  assert.equal(state.profiles[0].user_id, 'demo-me');
  assert.equal(await profiles.submit({ id: 'record-form' }), false);
  assert.equal(await profiles.action('new', {}), false);
  assert.equal(await profiles.change({ target: { id: 'files' } }), false);
});

test('profile names resolve UUID authors and the other member through email', async () => {
  const { state, profiles, repository, ui } = fixture('live');
  assert.equal(profiles.nameOf('uuid-me'), '건주');
  assert.equal(profiles.nameOf('other'), '콩');
  repository.profiles = async () => [{ user_id: 'uuid-partner', email: 'partner@example.com', data: { status: '여행 중', photo: 'data:image/png;base64,YQ==' } }];
  await profiles.load();
  assert.equal(profiles.nameOf('uuid-partner'), '콩');
  state.profiles[0].data.name = '새 이름';
  assert.equal(profiles.nameOf('uuid-partner'), '새 이름');
  assert.match(profiles.avatar('other'), /data-id="uuid-partner"/);
  assert.match(profiles.avatar('other'), /<img src="data:image\/png;base64,YQ=="/);
  profiles.open('other');
  assert.equal(ui.title, '새 이름의 프로필');
  assert.match(ui.html, /여행 중/);
  assert.doesNotMatch(ui.html, /profile-edit/);
});

test('failed saves keep the editor open and stale loads do not cross accounts', async () => {
  const { state, profiles, repository, ui, form, error, button } = fixture('live');
  repository.saveProfile = async () => { throw new Error('네트워크 오류'); };
  await profiles.action('profile-edit', {});
  await profiles.submit(form);
  assert.equal(error.textContent, '네트워크 오류');
  assert.equal(ui.closed, 0);
  assert.equal(button.disabled, false);
  let resolve;
  repository.profiles = () => new Promise(done => { resolve = done; });
  const pending = profiles.load();
  state.mode = 'demo'; state.user = 'demo-me';
  resolve([{ user_id: 'uuid-me', data: { bio: 'private' } }]);
  await pending;
  assert.deepEqual(state.profiles, []);
});

test('avatars fall back to a usable name when member names are missing', () => {
  const { state, profiles } = fixture('live');
  state.members = [{ email: 'me@example.com' }, { email: 'partner@example.com', display_name: '' }];
  state.profiles = [{ user_id: 'uuid-partner', email: 'partner@example.com', data: {} }];
  assert.equal(profiles.nameOf('uuid-me'), '나');
  assert.equal(profiles.nameOf('uuid-partner'), '짝꿍');
  assert.match(profiles.avatar('uuid-me'), /나 프로필 보기/);
  assert.match(profiles.avatar('uuid-partner'), /짝꿍 프로필 보기/);
});

test('a late refresh cannot overwrite a profile saved while it was pending', async () => {
  const { state, profiles, repository, form } = fixture('live');
  let release;
  repository.profiles = () => new Promise(resolve => { release = resolve; });
  const refresh = profiles.load();
  repository.saveProfile = async (user_id, data) => ({ user_id, data });
  await profiles.action('profile-edit', {});
  form.elements.status.value = 'saved status';
  await profiles.submit(form);
  release([{ user_id: state.user, data: { status: 'old status' } }]);
  await refresh;
  assert.equal(state.profiles[0].data.status, 'saved status');
});

test('photo conversion center crops to a small image and releases object URLs', async () => {
  const originalImage = globalThis.Image, originalDocument = globalThis.document;
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  let drawn, released, canvas;
  URL.createObjectURL = () => 'blob:profile'; URL.revokeObjectURL = url => { released = url; };
  globalThis.Image = class { naturalWidth = 800; naturalHeight = 600; set src(value) { this.onload(); } };
  globalThis.document = { createElement() { canvas = { getContext: () => ({ drawImage(...args) { drawn = args; } }), toDataURL: () => 'data:image/webp;base64,YQ==' }; return canvas; } };
  try {
    assert.equal(await createProfilePhoto({ type: 'image/jpeg', size: 100 }), 'data:image/webp;base64,YQ==');
    assert.equal(canvas.width, 384); assert.equal(canvas.height, 384);
    assert.deepEqual(drawn.slice(1), [100, 0, 600, 600, 0, 0, 384, 384]);
    assert.equal(released, 'blob:profile');
    await assert.rejects(createProfilePhoto({ type: 'video/mp4', size: 100 }), /이미지/);
    await assert.rejects(createProfilePhoto({ type: 'image/jpeg', size: 16 * 1024 * 1024 }), /15MB/);
    released = null;
    globalThis.Image = class { set src(value) { this.onerror(); } };
    await assert.rejects(createProfilePhoto({ type: 'image/heic', size: 100 }), /JPEG 또는 PNG/);
    assert.equal(released, 'blob:profile');
  } finally { globalThis.Image = originalImage; globalThis.document = originalDocument; URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; }
});

test('profile SQL restricts writes to each owner and derives email from JWT', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261103_profiles.sql', import.meta.url), 'utf8');
  assert.match(sql, /user_id uuid primary key references auth\.users/);
  assert.match(sql, /new\.email = lower\(auth\.jwt\(\)->>'email'\)/);
  assert.match(sql, /for select to authenticated\s+using \(public\.is_member\(\) and exists/);
  assert.equal((sql.match(/user_id = auth\.uid\(\)/g) || []).length, 3);
  assert.match(sql, /length\(data->>'photo'\) <= 180000/);
  const nameSql = await readFile(new URL('../supabase/migrations/20261104_profile_name.sql', import.meta.url), 'utf8');
  assert.match(nameSql, /length\(data->>'name'\) <= 30/);
});
