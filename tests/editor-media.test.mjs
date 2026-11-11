import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaDraft, selectedMediaFile } from '../src/editor-media.js';

test('media draft preserves existing attachments while adding, ordering and removing new selections', () => {
  const existing = [{ id: 'one', source: 'local', type: 'image/jpeg', name: 'saved.jpg' }, { id: 'two', source: 'drive', type: 'video/mp4', name: 'saved.mp4' }];
  const draft = createMediaDraft(existing);
  try {
    const photo = new File(['photo'], '<new>.jpg', { type: 'image/jpeg', lastModified: 2 });
    const video = new File(['video'], 'new.mp4', { type: 'video/mp4', lastModified: 3 });
    assert.equal(draft.addFiles([photo, video]), 2);
    assert.equal(draft.addFiles([photo]), 0);
    assert.equal(draft.entries().length, 4);
    assert.ok(draft.move(3, -1));
    assert.deepEqual(draft.entries().map(item => (item.file || item.metadata).name), ['saved.jpg', 'saved.mp4', 'new.mp4', '<new>.jpg']);
    assert.ok(draft.remove(0));
    assert.equal(existing.length, 2);
    const html = draft.render();
    assert.match(html, /data-drive-video="two"/);
    assert.match(html, /<video src="blob:/);
    assert.match(html, /&lt;new&gt;\.jpg/);
    assert.doesNotMatch(html, /<new>/);
    assert.match(html, /aria-label="3번째 첨부"/);
    assert.equal(draft.move(0, -1), false);
    assert.equal(draft.move(2, 1), false);
    assert.equal(draft.move(0, 2), false);
    assert.equal(draft.remove(NaN), false);
    const copy = draft.entries(); copy[0].key = 'changed'; copy.pop();
    assert.notEqual(draft.entries()[0].key, 'changed');
    assert.equal(draft.entries().length, 3);
  } finally { draft.dispose(); }
  assert.equal(draft.entries().length, 0);
});

test('removed and disposed selected media release object URLs without touching saved files', () => {
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  const revoked = []; let count = 0;
  URL.createObjectURL = () => `blob:test-${++count}`;
  URL.revokeObjectURL = url => revoked.push(url);
  try {
    const draft = createMediaDraft([{ id: 'saved', type: 'image/png', source: 'local', name: 'saved.png' }]);
    draft.addFiles([new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.mp4', { type: 'video/mp4' })]);
    draft.remove(0); assert.deepEqual(revoked, []);
    draft.remove(0); assert.deepEqual(revoked, ['blob:test-1']);
    draft.dispose(); draft.dispose(); assert.deepEqual(revoked, ['blob:test-1', 'blob:test-2']);
  } finally { URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; }
});

test('invalid batches keep the draft unchanged and blank mobile MIME types use known file extensions', async () => {
  const draft = createMediaDraft();
  const original = new File(['movie'], 'camera.MOV', { lastModified: 17 });
  const normalized = selectedMediaFile(original);
  assert.equal(normalized.type, 'video/quicktime');
  assert.equal(normalized.lastModified, 17);
  assert.equal(await normalized.text(), await original.text());
  assert.throws(() => draft.addFiles([normalized, new File(['no'], 'secret.txt', { type: 'text/plain' })]));
  assert.equal(draft.entries().length, 0);
  assert.throws(() => selectedMediaFile(new File([], 'empty.png', { type: 'image/png' })));
  assert.throws(() => selectedMediaFile(new File(['?'], 'unknown')));
});

test('existing image preview uses its thumbnail while saved video remains playable', () => {
  const draft = createMediaDraft([{ id: 'original', source: 'drive', type: 'image/jpeg', name: 'photo.jpg', thumbnail: { id: 'thumb', type: 'image/webp', source: 'drive' } }, { id: 'movie', source: 'local', type: 'video/mp4', name: 'video.mp4' }]);
  assert.match(draft.render(), /data-drive-file="thumb" data-drive-original="original"/);
  assert.match(draft.render(), /<video controls playsinline preload="metadata" data-file="movie"/);
});

test('picker reuses existing attachments in selection order, removes unchecked photos and retains unavailable originals', () => {
  const savedUri = 'content://media/picker/saved', pendingUri = 'content://media/picker/pending', newUri = 'content://media/picker/new';
  const saved = { id: 'saved', name: 'saved.jpg', source: 'drive', type: 'image/jpeg', pickerUri: savedUri, pickerDevice: 'this-device' };
  const unavailable = { id: 'unavailable', name: 'unavailable.jpg', source: 'drive', type: 'image/jpeg', pickerUri: savedUri, pickerDevice: 'other-device' };
  const draft = createMediaDraft([unavailable, saved]);
  const pending = Object.assign(new File(['pending'], 'pending.jpg', { type: 'image/jpeg' }), { pickerUri: pendingUri, pickerDevice: 'this-device' });
  const next = Object.assign(new File(['next'], 'next.jpg'), { pickerUri: newUri, pickerDevice: 'this-device' });
  try {
    draft.addFiles([pending]);
    const pendingEntry = draft.entries()[2];
    draft.applyPickerSelection({ files: [next], selectedUris: [pendingUri, newUri, savedUri], preselectedUris: [savedUri, pendingUri], pickerDevice: 'this-device' });
    assert.deepEqual(draft.entries().map(item => (item.file || item.metadata).name), ['unavailable.jpg', 'pending.jpg', 'next.jpg', 'saved.jpg']);
    assert.equal(draft.entries()[1].file, pendingEntry.file);
    assert.equal(draft.entries()[1].url, pendingEntry.url);
    assert.equal(draft.entries()[2].file.pickerUri, newUri);
    assert.equal(draft.entries()[2].file.pickerDevice, 'this-device');
    assert.equal(draft.entries()[2].file.type, 'image/jpeg');
    assert.equal(draft.entries()[3].metadata, saved);
    draft.applyPickerSelection({ files: [], selectedUris: [newUri, savedUri], preselectedUris: [pendingUri, newUri, savedUri], pickerDevice: 'this-device' });
    assert.deepEqual(draft.entries().map(item => (item.file || item.metadata).name), ['unavailable.jpg', 'next.jpg', 'saved.jpg']);
    const cards = [...draft.render().matchAll(/<li class="media-draft-item">[\s\S]*?<span class="media-order"[^>]*>(\d+)<\/span>[\s\S]*?<span class="media-draft-name"[^>]*>([^<]+)<\/span>/g)];
    assert.deepEqual(cards.map(match => [Number(match[1]), match[2]]), [[1, 'unavailable.jpg'], [2, 'next.jpg'], [3, 'saved.jpg']]);
    assert.throws(() => draft.applyPickerSelection({ files: [], selectedUris: ['missing'], preselectedUris: [newUri, savedUri], pickerDevice: 'this-device' }), /다시 선택/);
    assert.equal(draft.entries().length, 3);
    draft.applyPickerSelection({ files: [], selectedUris: [], preselectedUris: [newUri, savedUri], pickerDevice: 'this-device' });
    assert.deepEqual(draft.entries().map(item => item.metadata), [unavailable]);
    draft.applyPickerSelection({ files: [pending], selectedUris: [pendingUri], preselectedUris: [], pickerDevice: 'this-device' });
    assert.equal(draft.entries()[1].file, pending);
  } finally { draft.dispose(); }
});
