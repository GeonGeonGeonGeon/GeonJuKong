import test from 'node:test';
import assert from 'node:assert/strict';
import { createDriveVideoPlayer } from '../src/drive-video.js';

const playerElements = () => {
  const button = { disabled: false, hidden: false }, status = { textContent: '' };
  const video = { dataset: { driveVideo: 'clip' }, isConnected: true, play: async () => {}, parentElement: { querySelector: selector => selector === '.video-load' ? button : status } };
  return { video, button, status };
};

test('Drive playback shares an in-flight download, reuses the URL and releases it when no longer visible', async () => {
  let requests = 0, plays = 0;
  const player = createDriveVideoPlayer({ video: async () => { requests++; return new Blob(['video'], { type: 'video/mp4' }); } });
  const { video, button, status } = playerElements();
  video.play = async () => { plays++; };
  const revoke = URL.revokeObjectURL, revoked = [];
  URL.revokeObjectURL = url => { revoked.push(url); revoke(url); };
  try {
    await Promise.all([player.load(video, true), player.load(video)]);
    const url = video.src;
    await player.load(video);
    assert.equal(requests, 1); assert.equal(plays, 1);
    assert.equal(video.src, url); assert.equal(button.hidden, true); assert.equal(status.textContent, '');
    player.prune([video]); assert.equal(revoked.length, 0);
    player.prune([]); assert.deepEqual(revoked, [url]);
  } finally { player.clear(); URL.revokeObjectURL = revoke; }
});

test('failed videos remain retryable; disconnect cancels pending downloads without attaching a stale URL', async () => {
  let fail = true, signal, release;
  const player = createDriveVideoPlayer({ video: async (_id, abortSignal) => {
    signal = abortSignal;
    if (fail) throw new Error('permission denied');
    return new Promise(resolve => { release = resolve; });
  } });
  const { video, button, status } = playerElements();
  await player.load(video);
  assert.match(status.textContent, /permission denied/); assert.equal(button.disabled, false); assert.equal(button.hidden, false);
  fail = false;
  const pending = player.load(video);
  player.clear();
  assert.equal(signal.aborted, true);
  release(new Blob(['video'], { type: 'video/mp4' }));
  await pending;
  assert.equal(video.src, undefined);
});

test('Drive video fetching authenticates requests and rejects non-video responses', async () => {
  globalThis.window = { APP_CONFIG: {} };
  const { google } = await import('../src/google.js');
  google.setTokenProvider(async () => ({ access_token: 'test-token', expires_in: 3600 }));
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.match(url, /files\/clip%2Fid\?alt=media$/);
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      return new Response(new Blob(['video'], { type: 'video/mp4' }));
    };
    const blob = await google.video('clip/id'); assert.equal(blob.type, 'video/mp4');
    globalThis.fetch = async () => new Response(new Blob(['html'], { type: 'text/html' }));
    await assert.rejects(google.video('clip/id'), /원본 열기/);
    globalThis.fetch = async () => new Response('{}', { status: 403 });
    await assert.rejects(google.video('clip/id'), error => error.status === 403);
  } finally { google.disconnect(); globalThis.fetch = originalFetch; }
});
