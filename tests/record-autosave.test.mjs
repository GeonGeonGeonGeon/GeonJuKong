import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordAutosave } from '../src/record-autosave.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
test('autosave debounces edits and serializes changes made during a save', async () => {
  const writes = [], statuses = [];
  let value = 'first', finish;
  const queue = createRecordAutosave({ delay: 10, status: state => statuses.push(state), save: async () => {
    writes.push(value);
    if (writes.length === 1) await new Promise(resolve => { finish = resolve; });
  } });
  try {
    queue.schedule(); value = 'second'; queue.schedule();
    for (let i = 0; i < 100 && !finish; i++) await tick();
    assert.deepEqual(writes, ['second']); assert.equal(queue.saving, true);
    value = 'third'; queue.schedule(); value = 'latest'; queue.schedule();
    const closing = queue.flush(); finish();
    assert.equal(await closing, true);
    assert.deepEqual(writes, ['second', 'latest']); assert.equal(queue.dirty, false);
    assert.equal(statuses.at(-1), 'saved');
  } finally { queue.stop(); }
});

test('failed saves stay dirty for explicit retry and stopping cancels pending saves', async () => {
  let failing = true, writes = 0;
  const statuses = [];
  const queue = createRecordAutosave({ status: (state, error) => statuses.push([state, error?.message]), save: async () => {
    writes++; if (failing) throw new Error('offline');
  } });
  queue.schedule(); assert.equal(await queue.flush(), false);
  assert.equal(queue.dirty, true); assert.deepEqual(statuses.at(-1), ['error', 'offline']);
  failing = false; assert.equal(await queue.flush(), true); assert.equal(writes, 2);
  queue.schedule(); queue.stop(); assert.equal(await queue.flush(), false); assert.equal(writes, 2);
});
