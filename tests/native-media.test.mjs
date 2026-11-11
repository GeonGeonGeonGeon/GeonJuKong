import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { basename, dirname } from 'node:path';
import { pickOrderedMedia } from '../src/native-media.js';
import { createMediaDraft } from '../src/editor-media.js';
import { iosMediaPickerProject, iosMediaPickerPrivacy, iosMediaPickerPrivacyProject } from '../scripts/native-projects.mjs';

test('ordered picker reads originals in selection order and releases temporary files', async () => {
  const previousFetch = globalThis.fetch, reads = [], releases = [];
  const files = [{ path: 'file:///second.jpg', name: 'second.jpg', type: 'image/jpeg', lastModified: 123 },
    { path: 'file:///first.mov', name: 'first.mov', type: 'video/quicktime', lastModified: 456 }];
  const picker = { pick: async () => ({ selectionId: 'selection', files }), release: async value => releases.push(value) };
  globalThis.fetch = async path => { reads.push(path); return new Response(path); };
  try {
    const { files: selected } = await pickOrderedMedia(picker, path => `converted:${path}`);
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
    assert.equal(await pickOrderedMedia(cancelled, value => value), null);
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
  assert.match(patched.delegate, /PHPickerConfiguration\(photoLibrary: PHPhotoLibrary.shared\(\)\)/);
  assert.match(patched.delegate, /configuration.preselectedAssetIdentifiers = self.preselectedIdentifiers/);
  assert.match(patched.delegate, /configuration.filter = \.any\(of: \[\.images, \.videos\]\)/);
  assert.match(patched.storyboard, /customClass="OrderedMediaViewController" customModule="App"/);
  const project = iosMediaPickerPrivacyProject(extract('App/App.xcodeproj/project.pbxproj'));
  assert.match(project, /isa = PBXResourcesBuildPhase;[\s\S]*?files = \(\s*A9370BC3C2E84F02A7B4D932 \/\* PrivacyInfo.xcprivacy in Resources \*\//);
  assert.match(project, /A9370BC3C2E84F02A7B4D932 \/\* PrivacyInfo.xcprivacy in Resources \*\/ = \{isa = PBXBuildFile; fileRef = A9370BC3C2E84F02A7B4D931/);
  assert.match(project, /path = PrivacyInfo.xcprivacy; sourceTree = SOURCE_ROOT/);
  assert.equal(iosMediaPickerPrivacyProject(project), project);
  assert.throws(() => iosMediaPickerPrivacyProject('{}'), /Resources/);
  assert.deepEqual(iosMediaPickerProject(patched.delegate, patched.storyboard, source), patched);
  const updated = iosMediaPickerProject(patched.delegate, patched.storyboard, `${source}\n// Updated template`);
  assert.equal(updated.delegate.split('class OrderedMediaPickerPlugin').length, 2);
  assert.match(updated.delegate, /Updated template/);
  assert.throws(() => iosMediaPickerProject(delegate, '<storyboard/>', source), /ViewController/);
});

test('iOS picker privacy declaration preserves existing API reasons and adds app-only preferences once', () => {
  const timestamp = '<dict><key>NSPrivacyAccessedAPIType</key><string>NSPrivacyAccessedAPICategoryFileTimestamp</string><key>NSPrivacyAccessedAPITypeReasons</key><array><string>C617.1</string></array></dict>';
  const custom = '<key>NSPrivacyTracking</key><false/>';
  for (const list of [`<key>NSPrivacyAccessedAPITypes</key><array>${timestamp}</array>`, '<key>NSPrivacyAccessedAPITypes</key><array/>', '']) {
    const original = `<plist><dict>${custom}${list}</dict></plist>`;
    const configured = iosMediaPickerPrivacy(original);
    assert.ok(configured.includes(custom));
    if (list.includes(timestamp)) assert.ok(configured.includes(timestamp));
    assert.match(configured, /NSPrivacyAccessedAPICategoryUserDefaults/);
    assert.match(configured, /CA92\.1/);
    assert.equal(iosMediaPickerPrivacy(configured), configured);
  }
  assert.throws(() => iosMediaPickerPrivacy('<plist/>'), /형식/);
});

test('Android selection passes saved and new photo URIs in draft order and reads only new originals', async () => {
  const previousFetch = globalThis.fetch, reads = [], releases = [];
  const savedUri = 'content://media/picker/saved', pendingUri = 'content://media/picker/pending', newUri = 'content://media/picker/new';
  const pending = Object.assign(new File(['pending'], 'pending.jpg', { type: 'image/jpeg' }), { pickerUri: pendingUri, pickerDevice: 'this-device' });
  const entries = [{ metadata: { id: 'saved', pickerUri: savedUri, pickerDevice: 'this-device' } }, { file: pending }, { metadata: { id: 'imported' } }];
  const picker = {
    pick: async options => {
      assert.deepEqual(options, { selectedAssets: [{ uri: savedUri, device: 'this-device' }, { uri: pendingUri, device: 'this-device' }] });
      return { selectionId: 'android-selection', selectedUris: [pendingUri, newUri, savedUri], preselectedUris: [savedUri, pendingUri], pickerDevice: 'this-device',
        files: [{ path: 'file:///new.jpg', name: 'new.jpg', type: 'image/jpeg', lastModified: 12, pickerUri: newUri, pickerDevice: 'this-device' }] };
    },
    release: async value => releases.push(value)
  };
  globalThis.fetch = async path => { reads.push(path); return new Response('new'); };
  try {
    const selection = await pickOrderedMedia(picker, path => `converted:${path}`, entries);
    assert.deepEqual(selection.selectedUris, [pendingUri, newUri, savedUri]);
    assert.deepEqual(selection.preselectedUris, [savedUri, pendingUri]);
    assert.deepEqual(reads, ['converted:file:///new.jpg']);
    assert.equal(selection.files[0].pickerUri, newUri);
    assert.equal(selection.files[0].pickerDevice, 'this-device');
    assert.equal(await selection.files[0].text(), 'new');
    assert.deepEqual(releases, [{ selectionId: 'android-selection' }]);
    picker.pick = async () => ({ files: [], selectedUris: [], preselectedUris: [savedUri], selectionId: 'empty-selection' });
    assert.deepEqual(await pickOrderedMedia(picker, value => value, entries), { files: [], selectedUris: [], preselectedUris: [savedUri], pickerDevice: undefined });
    assert.deepEqual(releases.at(-1), { selectionId: 'empty-selection' });
    picker.pick = async () => ({ files: [], selectionId: 'empty-document-selection' });
    assert.deepEqual((await pickOrderedMedia(picker, value => value, entries)).files, []);
    assert.deepEqual(releases.at(-1), { selectionId: 'empty-document-selection' });
    picker.pick = async () => ({ files: [], cancelled: true });
    assert.equal(await pickOrderedMedia(picker, value => value, entries), null);
    assert.equal(releases.length, 3);
  } finally { globalThis.fetch = previousFetch; }
});

test('iOS preselection preserves originals on cancel and supports reordering and deselecting all without file providers', async () => {
  const previousFetch = globalThis.fetch, reads = [], requests = [], releases = [];
  const device = 'ios:this-device', first = 'first/L0/001', second = 'second/L0/001', third = 'third/L0/001';
  const imported = { id: 'imported', source: 'drive', name: 'imported.jpg', type: 'image/jpeg' };
  const saved = { id: 'saved', source: 'drive', name: 'saved.jpg', type: 'image/jpeg', pickerUri: first, pickerDevice: device };
  const pending = Object.assign(new File(['pending'], 'pending.jpg', { type: 'image/jpeg' }), { pickerUri: second, pickerDevice: device });
  const draft = createMediaDraft([saved, imported]);
  draft.addFiles([pending]);
  const original = draft.entries();
  const responses = [
    { cancelled: true, files: [] },
    { selectionId: 'ios-new', selectedUris: [second, third, first], preselectedUris: [first, second], pickerDevice: device,
      files: [{ path: 'file:///third.jpg', name: 'third.jpg', type: 'image/jpeg', pickerUri: third, pickerDevice: device }] },
    { selectionId: 'ios-reorder', selectedUris: [first, third, second], preselectedUris: [second, third, first], pickerDevice: device, files: [] },
    { selectionId: 'ios-clear', selectedUris: [], preselectedUris: [first, third, second], pickerDevice: device, files: [] },
    { cancelled: true, files: [] }
  ];
  const picker = { pick: async options => { requests.push(options.selectedAssets); return responses.shift(); }, release: async value => releases.push(value.selectionId) };
  globalThis.fetch = async path => { reads.push(path); return new Response('third'); };
  const choose = async () => {
    const selection = await pickOrderedMedia(picker, value => value, draft.entries());
    if (selection) draft.applyPickerSelection(selection);
    return selection;
  };
  try {
    assert.equal(await choose(), null);
    assert.deepEqual(draft.entries(), original);
    assert.deepEqual(reads, []);
    await choose();
    assert.deepEqual(requests[1], [{ uri: first, device }, { uri: second, device }]);
    assert.deepEqual(draft.entries().map(item => (item.file || item.metadata).name), ['pending.jpg', 'third.jpg', 'saved.jpg', 'imported.jpg']);
    assert.equal(draft.entries()[0].file, pending);
    assert.equal(draft.entries()[0].url, original[2].url);
    assert.equal(draft.entries()[2].metadata, saved);
    assert.equal(draft.entries()[1].file.pickerUri, third);
    assert.equal(draft.entries()[1].file.pickerDevice, device);
    await choose();
    assert.deepEqual(requests[2].map(item => item.uri), [second, third, first]);
    assert.deepEqual(draft.entries().map(item => (item.file || item.metadata).name), ['saved.jpg', 'third.jpg', 'pending.jpg', 'imported.jpg']);
    assert.equal(draft.entries()[0].metadata, saved);
    assert.deepEqual(reads, ['file:///third.jpg']);
    await choose();
    assert.deepEqual(draft.entries().map(item => item.metadata), [imported]);
    assert.equal(await choose(), null);
    assert.deepEqual(requests[4], []);
    assert.deepEqual(releases, ['ios-new', 'ios-reorder', 'ios-clear']);
  } finally { draft.dispose(); globalThis.fetch = previousFetch; }
});

test('board file input uses the native picker and keeps selections intact on cancel or error', async () => {
  const values = new Map(), rows = new Map(), listeners = new Map();
  const app = { innerHTML: '' }, draft = { innerHTML: '' }, toast = { textContent: '', classList: { add() {}, remove() {} } };
  const editor = { innerHTML: '', open: false, showModal() { this.open = true; }, close() { this.open = false; }, addEventListener() {} };
  const files = [new File(['second'], 'second.jpg', { type: 'image/jpeg' }), new File(['first'], 'first.jpg', { type: 'image/jpeg' })];
  let picks = 0, cancelled = false, fail = false, prevented = 0;
  globalThis.window = { APP_CONFIG: {}, addEventListener() {}, scrollTo() {}, GEONJUKONG_NATIVE: { active: true,
    listen: async () => undefined, pickMedia: async entries => { picks++; assert.equal(entries.length, picks === 1 ? 0 : 2); if (fail) throw new Error('Read failed'); return cancelled ? null : { files }; } } };
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
