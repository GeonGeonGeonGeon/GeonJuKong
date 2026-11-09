import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { basename, dirname } from 'node:path';
import { pickOrderedMedia } from '../src/native-media.js';
import { iosMediaPickerProject } from '../scripts/native-projects.mjs';

test('ordered picker reads originals in selection order and releases temporary files', async () => {
  const previousFetch = globalThis.fetch, reads = [], releases = [];
  const files = [{ path: 'file:///second.jpg', name: 'second.jpg', type: 'image/jpeg', lastModified: 123 },
    { path: 'file:///first.mov', name: 'first.mov', type: 'video/quicktime', lastModified: 456 }];
  const picker = { pick: async () => ({ selectionId: 'selection', files }), release: async value => releases.push(value) };
  globalThis.fetch = async path => { reads.push(path); return new Response(path); };
  try {
    const selected = await pickOrderedMedia(picker, path => `converted:${path}`);
    assert.deepEqual(selected.map(file => [file.name, file.type, file.lastModified]), files.map(file => [file.name, file.type, file.lastModified]));
    assert.deepEqual(reads, files.map(file => `converted:${file.path}`));
    assert.equal(await selected[0].text(), 'converted:file:///second.jpg');
    assert.equal(await selected[1].text(), 'converted:file:///first.mov');
    assert.deepEqual(releases, [{ selectionId: 'selection' }]);
  } finally { globalThis.fetch = previousFetch; }
});

test('cancellation adds no files and read failures release the entire selection', async () => {
  const previousFetch = globalThis.fetch;
  let released = 0;
  try {
    const cancelled = { pick: async () => ({ files: [] }), release: async () => { throw new Error('Nothing to release'); } };
    assert.deepEqual(await pickOrderedMedia(cancelled, value => value), []);
    const picker = { pick: async () => ({ selectionId: 'selection', files: [{ path: 'photo', name: 'photo.jpg', type: 'image/jpeg' }] }),
      release: async () => { released++; } };
    globalThis.fetch = async () => new Response('', { status: 404 });
    await assert.rejects(pickOrderedMedia(picker, value => value), /다시 선택/);
    assert.equal(released, 1);
    globalThis.fetch = async () => { throw new Error('Read interrupted'); };
    await assert.rejects(pickOrderedMedia(picker, value => value), /Read interrupted/);
    assert.equal(released, 2);
  } finally { globalThis.fetch = previousFetch; }
});

test('iOS project generation wires the ordered picker into the actual Capacitor template idempotently', async () => {
  const archive = fileURLToPath(new URL('../node_modules/@capacitor/cli/assets/ios-pods-template.tar.gz', import.meta.url));
  const extract = name => execFileSync('tar', ['-xOf', basename(archive), name], { cwd: dirname(archive), encoding: 'utf8', windowsHide: true });
  const delegate = extract('App/App/AppDelegate.swift');
  const storyboard = extract('App/App/Base.lproj/Main.storyboard');
  const source = await readFile(new URL('../scripts/ios-media-picker.swift', import.meta.url), 'utf8');
  const patched = iosMediaPickerProject(delegate, storyboard, source);
  assert.ok(patched.delegate.startsWith(delegate.trimEnd()));
  assert.match(patched.delegate, /registerPluginInstance\(OrderedMediaPickerPlugin\(\)\)/);
  assert.match(patched.delegate, /configuration.selection = \.ordered/);
  assert.match(patched.delegate, /configuration.filter = \.any\(of: \[\.images, \.videos\]\)/);
  assert.match(patched.storyboard, /customClass="OrderedMediaViewController" customModule="App"/);
  assert.deepEqual(iosMediaPickerProject(patched.delegate, patched.storyboard, source), patched);
  const updated = iosMediaPickerProject(patched.delegate, patched.storyboard, `${source}\n// Updated template`);
  assert.equal(updated.delegate.split('class OrderedMediaPickerPlugin').length, 2);
  assert.match(updated.delegate, /Updated template/);
  assert.throws(() => iosMediaPickerProject(delegate, '<storyboard/>', source), /ViewController/);
});

test('board file input uses the native picker and keeps selections intact on cancel or error', async () => {
  const values = new Map(), rows = new Map(), listeners = new Map();
  const app = { innerHTML: '' }, draft = { innerHTML: '' }, toast = { textContent: '', classList: { add() {}, remove() {} } };
  const editor = { innerHTML: '', open: false, showModal() { this.open = true; }, close() { this.open = false; }, addEventListener() {} };
  const files = [new File(['second'], 'second.jpg', { type: 'image/jpeg' }), new File(['first'], 'first.jpg', { type: 'image/jpeg' })];
  let picks = 0, cancelled = false, fail = false, prevented = 0;
  globalThis.window = { APP_CONFIG: {}, addEventListener() {}, scrollTo() {}, GEONJUKONG_NATIVE: { active: true,
    listen: async () => undefined, pickMedia: async () => { picks++; if (fail) throw new Error('Read failed'); return cancelled ? [] : files; } } };
  globalThis.document = { querySelector: selector => ({ '#app': app, '#editor': editor, '#toast': toast, '#media-draft': draft })[selector] || null,
    querySelectorAll: () => [], addEventListener: (type, handler) => listeners.set(type, handler), activeElement: { matches: () => false } };
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  globalThis.sessionStorage = globalThis.localStorage;
  globalThis.location = { href: 'http://localhost:4173/', origin: 'http://localhost:4173', pathname: '/', hash: '' };
  globalThis.history = { replaceState() {} };
  const previousInterval = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  const { local } = await import('../src/storage.js');
  local.list = async () => [...rows.values()]; local.put = async row => rows.set(row.id, row); local.remove = async id => rows.delete(id);
  try {
    await import('../src/app.js');
    for (let i = 0; i < 40 && !app.innerHTML.includes('museum-masthead'); i++) await new Promise(resolve => setTimeout(resolve, 5));
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'new', kind: 'post' } }) } });
    const clickInput = () => listeners.get('click')({ target: { type: 'file', name: 'files' }, preventDefault() { prevented++; } });
    await clickInput();
    assert.equal(picks, 1); assert.equal(prevented, 1);
    assert.ok(draft.innerHTML.indexOf('second.jpg') < draft.innerHTML.indexOf('first.jpg'));
    assert.match(draft.innerHTML, /class="media-order"[^>]*>1<\/span>/);
    assert.match(draft.innerHTML, /class="media-order"[^>]*>2<\/span>/);
    const selected = draft.innerHTML;
    cancelled = true; await clickInput(); assert.equal(draft.innerHTML, selected);
    fail = true;
    const previousError = console.error; console.error = () => {};
    try { await clickInput(); } finally { console.error = previousError; }
    assert.equal(draft.innerHTML, selected); assert.equal(toast.textContent, 'Read failed');
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'close' } }) } });
    assert.equal(editor.open, false);
  } finally { globalThis.setInterval = previousInterval; }
});
