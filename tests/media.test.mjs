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

test('a stalled image decoder falls back to the original and closes a late bitmap', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finish, closed = 0, outcome = 'pending';
  const previous = globalThis.createImageBitmap;
  globalThis.createImageBitmap = () => new Promise(resolve => { finish = resolve; });
  t.after(() => { globalThis.createImageBitmap = previous; });
  const pending = createThumbnail(new File(['original'], 'photo.jpg', { type: 'image/jpeg' })).then(value => { outcome = value; });
  await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(8000); await new Promise(resolve => setImmediate(resolve));
  assert.equal(outcome, null); await pending;
  finish({ width: 640, height: 480, close() { closed++; } });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(closed, 1);
});

test('a stalled canvas encoder falls back to the original and releases the bitmap', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previousBitmap = globalThis.createImageBitmap, previousDocument = globalThis.document;
  let closed = 0, outcome = 'pending';
  globalThis.createImageBitmap = async () => ({ width: 640, height: 480, close() { closed++; } });
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toBlob() {} }) };
  t.after(() => { globalThis.createImageBitmap = previousBitmap; globalThis.document = previousDocument; });
  const pending = createThumbnail(new File(['original'], 'photo.jpg', { type: 'image/jpeg' })).then(value => { outcome = value; });
  await new Promise(resolve => setImmediate(resolve)); t.mock.timers.tick(8000);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(outcome, null); assert.equal(closed, 1); await pending;
});

test('video previews capture a bounded frame without changing the original and release the decoder URL', async () => {
  const oldDocument = globalThis.document, oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  let canvas, decoder, released = 0, disposed = 0;
  URL.createObjectURL = () => 'blob:video-preview';
  URL.revokeObjectURL = url => { assert.equal(url, 'blob:video-preview'); released++; };
  globalThis.document = { createElement(tag) {
    if (tag === 'video') {
      decoder = { duration: 12, videoWidth: 1920, videoHeight: 1080, load() { disposed++; }, removeAttribute() {}, set src(value) { assert.equal(value, 'blob:video-preview'); queueMicrotask(() => this.onloadeddata()); }, set currentTime(value) { assert.equal(value, 0.1); queueMicrotask(() => this.onseeked()); } };
      return decoder;
    }
    canvas = { getContext: () => ({ drawImage(source) { assert.equal(source, decoder); } }), toBlob: callback => callback(new Blob(['frame'], { type: 'image/webp' })) };
    return canvas;
  } };
  try {
    const original = new File(['x'.repeat(1000)], 'clip.mov', { type: 'video/quicktime' });
    const result = await createThumbnail(original);
    assert.equal(result.type, 'image/webp'); assert.equal(result.name, 'clip.preview.webp');
    assert.equal(canvas.width, 640); assert.equal(canvas.height, 360);
    assert.equal(original.size, 1000); assert.equal(released, 1); assert.equal(disposed, 1);
    assert.equal(decoder.onloadeddata, null);
    globalThis.document.createElement = () => ({ load() {}, removeAttribute() {}, set src(value) { queueMicrotask(() => this.onerror()); } });
    assert.equal(await createThumbnail(original), null);
    assert.equal(released, 2);
  } finally { globalThis.document = oldDocument; URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke; }
});
