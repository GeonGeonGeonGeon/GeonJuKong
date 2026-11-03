import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createBucketList, validateBucketItem } from '../src/bucket-list.js';
import { dateKey } from '../src/core.js';

globalThis.crypto ||= webcrypto;

function fixture(mode = 'demo') {
  const records = new Map();
  const state = { mode, user: 'demo-me', bucketItems: [] };
  const ui = { title: '', html: '', closed: 0, rendered: 0, messages: [] };
  const local = {
    list: async () => [...records.values()],
    put: async row => records.set(row.id, structuredClone(row)),
    putIfVersion: async (row, version) => {
      if ((records.get(row.id)?.updated_at || records.get(row.id)?.created_at) !== version) return false;
      records.set(row.id, structuredClone(row)); return true;
    },
    remove: async id => records.delete(id)
  };
  const repository = {};
  const bucket = createBucketList({ state, repository, local,
    dialog: (title, html) => Object.assign(ui, { title, html }), closeDialog: () => ui.closed++, render: () => ui.rendered++, toast: text => ui.messages.push(text) });
  return { state, records, ui, repository, bucket };
}

async function submit(bucket, values, dataset = {}) {
  const original = globalThis.FormData;
  const button = { disabled: false };
  globalThis.FormData = class {
    get(key) { return values[key] ?? null; }
    has(key) { return Object.hasOwn(values, key); }
  };
  try { return await bucket.submit({ id: 'bucket-form', dataset, querySelector: () => button }); }
  finally { globalThis.FormData = original; assert.equal(button.disabled, false); }
}

test('bucket item validation trims text and rejects invalid completion dates', () => {
  assert.deepEqual(validateBucketItem({ title: '  제주도 여행  ', notes: ' 같이 가자 ' }), { title: '제주도 여행', notes: '같이 가자', completed_on: null });
  for (const title of ['', ' ', 'x'.repeat(121)]) assert.throws(() => validateBucketItem({ title }));
  assert.throws(() => validateBucketItem({ title: '여행', notes: 'x'.repeat(2001) }));
  for (const completed_on of ['2026-02-29', '2026-13-01', 'not-a-date']) assert.throws(() => validateBucketItem({ title: '여행', completed_on }));
  assert.equal(validateBucketItem({ title: '여행', completed_on: '2028-02-29' }).completed_on, '2028-02-29');
});

test('demo goals persist separately from posts and can be completed, dated, and reopened', async () => {
  const { bucket, state, records, ui } = fixture();
  records.set('post', { id: 'post', kind: 'post', data: { title: '기존 게시글' } });
  await bucket.load();
  assert.match(bucket.render(), /달성 0 \/ 0/);
  await submit(bucket, { title: '함께 여행', notes: '부산으로' });
  assert.equal(state.bucketItems.length, 1);
  const id = state.bucketItems[0].id;
  assert.equal(records.get(id).kind, 'bucket');
  assert.equal(records.get('post').data.title, '기존 게시글');
  await bucket.action('bucket-toggle', { dataset: { id } });
  assert.equal(state.bucketItems[0].completed_on, dateKey());
  assert.match(bucket.render(), /aria-checked="true"/);
  assert.match(bucket.render(), /달성 1 \/ 1/);
  const version = state.bucketItems[0].updated_at;
  await submit(bucket, { title: '함께 여행', notes: '부산으로', completed: 'on', completedOn: '2026-10-01' }, { id, version });
  assert.equal(state.bucketItems[0].completed_on, '2026-10-01');
  assert.match(bucket.render(), /2026-10-01 달성/);
  await bucket.action('bucket-toggle', { dataset: { id } });
  assert.equal(state.bucketItems[0].completed_on, null);
  assert.match(bucket.render(), /aria-checked="false"/);
  assert.equal(ui.closed, 2);
});

test('a partner can edit shared goals while stale edits are rejected', async () => {
  const { bucket, state, records, ui } = fixture();
  await submit(bucket, { title: '기존 목표' });
  const row = state.bucketItems[0], previousVersion = row.updated_at;
  state.user = 'demo-partner';
  await submit(bucket, { title: '함께 수정한 목표', completed: 'on', completedOn: '2026-10-03' }, { id: row.id, version: previousVersion });
  assert.equal(state.bucketItems[0].title, '함께 수정한 목표');
  assert.equal(state.bucketItems[0].author_id, 'demo-me');
  const closed = ui.closed;
  await assert.rejects(submit(bucket, { title: '충돌한 수정' }, { id: row.id, version: previousVersion }), /다른 기기/);
  assert.equal(records.get(row.id).data.title, '함께 수정한 목표');
  assert.equal(ui.closed, closed);
});

test('goal deletion requires its confirmation action and preserves unrelated records', async () => {
  const { bucket, state, records, ui } = fixture();
  await submit(bucket, { title: '<img src=x onerror=alert(1)>' });
  const row = state.bucketItems[0];
  assert.doesNotMatch(bucket.render(), /<img src=x/);
  await bucket.action('bucket-delete', { dataset: { id: row.id } });
  assert.equal(records.size, 1);
  assert.match(ui.html, /bucket-confirm-delete/);
  assert.match(ui.html, /&lt;img/);
  await bucket.action('bucket-confirm-delete', { dataset: { id: row.id, version: row.updated_at } });
  assert.equal(records.size, 0);
  assert.equal(state.bucketItems.length, 0);
});

test('live writes use guarded repository methods and errors preserve the editor', async () => {
  const { bucket, state, repository, ui } = fixture('live');
  const row = { id: 'goal', author_id: 'partner', title: '여행', notes: '', completed_on: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
  repository.bucketItems = async () => [row];
  await bucket.load();
  let call;
  repository.saveBucketItem = async (...args) => { call = args; return { ...row, ...args[1], updated_at: '2026-01-02T00:00:00Z' }; };
  await bucket.action('bucket-toggle', { dataset: { id: row.id } });
  assert.deepEqual(call, [state.user, { title: '여행', notes: '', completed_on: dateKey() }, row.id, row.updated_at]);
  repository.saveBucketItem = async () => { throw new Error('서버 연결 실패'); };
  const closed = ui.closed;
  await assert.rejects(submit(bucket, { title: '수정' }, { id: row.id, version: row.updated_at }), /서버 연결 실패/);
  assert.equal(ui.closed, closed);
  repository.removeBucketItem = async (...args) => { call = args; };
  await bucket.action('bucket-confirm-delete', { dataset: { id: row.id, version: row.updated_at } });
  assert.deepEqual(call, [row.id, row.updated_at]);
  assert.equal(await bucket.action('open-post', {}), false);
  assert.equal(await bucket.submit({ id: 'record-form' }), false);
});

test('pending loads cannot overwrite bucket items after a mode or account switch', async () => {
  for (const change of [state => { state.mode = 'demo'; }, state => { state.user = 'another-user'; }]) {
    const { bucket, state, repository } = fixture('live');
    let finish;
    repository.bucketItems = () => new Promise(resolve => { finish = resolve; });
    const pending = bucket.load();
    change(state);
    state.bucketItems = [{ id: 'new-context' }];
    finish([{ id: 'old-context' }]);
    await pending;
    assert.deepEqual(state.bucketItems, [{ id: 'new-context' }]);
  }
});

test('an older list request cannot replace a newer response', async () => {
  const { bucket, state, repository } = fixture('live');
  const pending = [];
  repository.bucketItems = () => new Promise(resolve => pending.push(resolve));
  const first = bucket.load(), second = bucket.load();
  pending[1]([{ id: 'latest' }]);
  await second;
  pending[0]([{ id: 'stale' }]);
  await first;
  assert.deepEqual(state.bucketItems, [{ id: 'latest' }]);
});

test('successful writes close the form and retain the saved row when refresh fails', async () => {
  const { bucket, state, repository, ui } = fixture('live');
  let writes = 0;
  repository.saveBucketItem = async (user, data, id) => {
    writes++;
    return { id: id || 'new-goal', author_id: user, ...data, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' };
  };
  repository.bucketItems = async () => { throw new Error('temporary list failure'); };
  await submit(bucket, { title: '저장된 목표' });
  assert.equal(writes, 1);
  assert.equal(ui.closed, 1);
  assert.equal(state.bucketItems[0].title, '저장된 목표');
  assert.match(ui.messages.at(-1), /변경은 저장/);
  await bucket.action('bucket-toggle', { dataset: { id: 'new-goal' } });
  assert.equal(state.bucketItems[0].completed_on, dateKey());
  assert.match(bucket.render(), /aria-checked="true"/);
  repository.removeBucketItem = async () => {};
  await bucket.action('bucket-confirm-delete', { dataset: { id: 'new-goal', version: state.bucketItems[0].updated_at } });
  assert.deepEqual(state.bucketItems, []);
  assert.equal(ui.closed, 2);
});

test('a write finishing after an account switch does not alter the new screen', async () => {
  const { bucket, state, repository, ui } = fixture('live');
  let finish;
  repository.saveBucketItem = () => new Promise(resolve => { finish = resolve; });
  const pending = submit(bucket, { title: '이전 계정 목표' });
  state.user = 'new-user';
  state.bucketItems = [{ id: 'new-context' }];
  finish({ id: 'old-context', title: '이전 계정 목표' });
  await pending;
  assert.deepEqual(state.bucketItems, [{ id: 'new-context' }]);
  assert.equal(ui.closed, 0);
  assert.equal(ui.rendered, 0);
});
