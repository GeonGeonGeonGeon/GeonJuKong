import test from 'node:test';
import assert from 'node:assert/strict';
import { createThumbnail, previewFile, previewMeasurements, recordPreviewDownload, recordPreviewCacheHit } from '../src/media.js';

test('thumbnail keeps originals and bounds dimensions, with safe decoder/size fallback', async () => {
  const oldBitmap = globalThis.createImageBitmap, oldDocument = globalThis.document;
  let closed = 0, canvas, outputSize = 100;
  globalThis.createImageBitmap = async () => ({ width: 4000, height: 3000, close() { closed++; } });
  globalThis.document = { createElement() { canvas = { getContext: () => ({ drawImage() {} }), toBlob: callback => callback(new Blob(['a'.repeat(outputSize)], { type: 'image/webp' })) }; return canvas; } };
  try {
    const original = new File(['a'.repeat(10000)], 'photo.jpg', { type: 'image/jpeg' });
    const thumbnail = await createThumbnail(original);
    assert.equal(canvas.width, 640); assert.equal(canvas.height, 480);
    assert.equal(thumbnail.size, 100); assert.equal(original.size, 10000);
    assert.equal(thumbnail.type, 'image/webp'); assert.equal(closed, 1);
    outputSize = 12000;
    assert.equal(await createThumbnail(original), null);
    globalThis.createImageBitmap = async () => { throw new Error('unsupported'); };
    assert.equal(await createThumbnail(original), null);
    assert.equal(await createThumbnail(new File(['x'], 'video.mp4', { type: 'video/mp4' })), null);
    const file = { id: 'original', thumbnail: { id: 'preview' } };
    assert.equal(previewFile(file).id, 'preview'); assert.equal(previewFile({ id: 'legacy' }).id, 'legacy');
  } finally { globalThis.createImageBitmap = oldBitmap; globalThis.document = oldDocument; }
});

test('preview counters distinguish downloaded bytes and cache hits', () => {
  const before = previewMeasurements();
  recordPreviewDownload(2048, 50); recordPreviewCacheHit();
  const after = previewMeasurements();
  assert.equal(after.bytes - before.bytes, 2048);
  assert.equal(after.downloads - before.downloads, 1);
  assert.equal(after.cacheHits - before.cacheHits, 1);
  assert.equal(after.milliseconds - before.milliseconds, 50);
});
