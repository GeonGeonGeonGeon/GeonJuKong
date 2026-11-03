import test from 'node:test';
import assert from 'node:assert/strict';
import { lockPage, unlockPage, installDialogDismissal } from '../src/dialog-behavior.js';
import { installGalleryDrag } from '../src/gallery.js';

test('a modal locks the background and restores the exact scroll position and inline styles', () => {
  const classes = new Set(), scrolls = [];
  globalThis.document = { body: { style: { position: 'relative', top: '2px', width: '95%' } }, documentElement: { classList: { add: v => classes.add(v), remove: v => classes.delete(v) } } };
  globalThis.window = { scrollY: 347, scrollTo: value => scrolls.push(value) };
  lockPage(); lockPage();
  assert.equal(document.body.style.position, 'fixed');
  assert.equal(document.body.style.top, '-347px');
  assert.ok(classes.has('modal-open'));
  unlockPage(); unlockPage();
  assert.deepEqual(document.body.style, { position: 'relative', top: '2px', width: '95%' });
  assert.deepEqual(scrolls, [{ top: 347, behavior: 'instant' }]);
});

test('only a gesture starting and ending on the backdrop dismisses; Escape uses the same back action', () => {
  const handlers = new Map(); let backs = 0;
  const editor = { open: true, addEventListener: (type, handler) => handlers.set(type, handler), getBoundingClientRect: () => ({ left: 20, right: 300, top: 50, bottom: 500 }) };
  installDialogDismissal(editor, () => { backs++; });
  const event = (x, y, target = editor) => ({ target, clientX: x, clientY: y, preventDefault() {} });
  handlers.get('pointerdown')(event(10, 20)); handlers.get('click')(event(10, 20));
  assert.equal(backs, 1);
  handlers.get('pointerdown')(event(30, 60)); handlers.get('click')(event(10, 20));
  handlers.get('pointerdown')(event(10, 20)); handlers.get('click')(event(30, 60));
  handlers.get('pointerdown')(event(30, 60, {})); handlers.get('click')(event(30, 60, {}));
  assert.equal(backs, 1);
  handlers.get('cancel')({ preventDefault() {} });
  assert.equal(backs, 2);
});

test('mouse dragging advances one horizontal slide without vertical movement or opening the post', () => {
  const handlers = new Map();
  installGalleryDrag({ addEventListener: (type, handler) => handlers.set(type, handler) });
  const track = { clientWidth: 300, scrollWidth: 900, scrollLeft: 0, scrollTop: 72, style: { scrollSnapType: 'x mandatory' }, scrollTo(value) { this.scrollLeft = value.left; } };
  const target = { closest: selector => selector === '.attachments, .memory-slides' ? track : null };
  let prevented = 0, stopped = 0;
  const event = x => ({ pointerType: 'mouse', button: 0, target, clientX: x, preventDefault() { prevented++; }, stopImmediatePropagation() { stopped++; } });
  handlers.get('pointerdown')(event(200)); handlers.get('pointermove')(event(196));
  assert.equal(track.scrollLeft, 0);
  handlers.get('pointermove')(event(-90)); handlers.get('pointerup')();
  handlers.get('click')(event(-90));
  assert.equal(track.scrollLeft, 300); assert.equal(track.scrollTop, 72);
  assert.equal(track.style.scrollSnapType, 'x mandatory');
  assert.equal(prevented, 2); assert.equal(stopped, 1);
  handlers.get('pointerdown')({ ...event(200), pointerType: 'touch' });
  handlers.get('pointermove')({ ...event(-90), pointerType: 'touch' });
  assert.equal(track.scrollLeft, 300);
});
