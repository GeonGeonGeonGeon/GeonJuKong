import test from 'node:test';
import assert from 'node:assert/strict';
import { lockPage, unlockPage, installDialogDismissal, focusReplyInput } from '../src/dialog-behavior.js';
import { installGalleryDrag } from '../src/gallery.js';

function replyFixture(withViewport = true) {
  const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 });
  const frames = new Map(); let frameId = 0;
  globalThis.window = Object.assign(new EventTarget(), { innerHeight: 800, ...(withViewport ? { visualViewport: viewport } : {}), requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; }, cancelAnimationFrame(id) { frames.delete(id); } });
  globalThis.document = {};
  const classes = new Set(), styles = new Map(), scrolls = [], focuses = [];
  let scrollTop = 125;
  const height = () => withViewport ? viewport.height : window.innerHeight;
  const editor = { open: true, clientTop: 1, get clientHeight() { return Math.min(600, height() - 34); }, get scrollTop() { return scrollTop; }, set scrollTop(value) { scrollTop = Math.max(0, value); scrolls.push(scrollTop); }, getBoundingClientRect() { const top = (withViewport ? viewport.offsetTop : 0) + (height() - this.clientHeight - 2) / 2; return { top, bottom: top + this.clientHeight + 2 }; }, classList: { add: v => classes.add(v), remove: v => classes.delete(v) }, style: { setProperty: (k, v) => styles.set(k, v), removeProperty: k => styles.delete(k) } };
  const input = Object.assign(new EventTarget(), { contentTop: 1000, height: 60, value: 'A long reply', selectionStart: 8, selectionEnd: 8, focus(options) { focuses.push(options); document.activeElement = input; }, getBoundingClientRect() { const top = editor.getBoundingClientRect().top + editor.clientTop + this.contentTop - editor.scrollTop; return { top, bottom: top + this.height, height: this.height }; } });
  const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); };
  const assertVisible = () => { const rect = input.getBoundingClientRect(), bounds = editor.getBoundingClientRect(); assert.ok(rect.top >= Math.max(withViewport ? viewport.offsetTop : 0, bounds.top + editor.clientTop) + 12); assert.ok(rect.bottom <= Math.min((withViewport ? viewport.offsetTop : 0) + height(), bounds.top + editor.clientTop + editor.clientHeight) - 12); };
  const dispose = focusReplyInput(editor, input);
  return { viewport, editor, input, classes, styles, scrolls, focuses, frames, flush, assertVisible, dispose };
}

test('reply input stays visible as the mobile keyboard resizes and pans the viewport', () => {
  const { viewport, input, classes, styles, scrolls, focuses, frames, flush, assertVisible, dispose } = replyFixture();
  assert.deepEqual(focuses, [{ preventScroll: true }]);
  assert.equal(scrolls.length, 0);
  flush(); assertVisible();
  assert.ok(classes.has('reply-composing'));
  viewport.height = 360;
  viewport.dispatchEvent(new Event('resize'));
  assert.equal(styles.get('--reply-viewport-height'), '360px');
  flush(); assertVisible();
  viewport.offsetTop = 80;
  viewport.dispatchEvent(new Event('scroll'));
  assert.equal(styles.get('--reply-viewport-top'), '80px');
  flush(); assertVisible();
  document.activeElement = null;
  const count = scrolls.length;
  viewport.height = 800;
  viewport.dispatchEvent(new Event('resize'));
  flush();
  assert.equal(styles.get('--reply-viewport-height'), '800px');
  assert.equal(scrolls.length, count);
  document.activeElement = input;
  input.dispatchEvent(new Event('focus'));
  flush(); assertVisible();
  assert.equal(scrolls.length, count);
  input.dispatchEvent(new Event('input'));
  assert.equal(frames.size, 1);
  dispose();
  assert.equal(frames.size, 0);
  assert.equal(classes.size, 0);
  assert.equal(styles.size, 0);
  viewport.dispatchEvent(new Event('resize'));
  viewport.dispatchEvent(new Event('scroll'));
  window.dispatchEvent(new Event('resize'));
  input.dispatchEvent(new Event('focus'));
  input.dispatchEvent(new Event('input'));
  flush();
  assert.equal(styles.size, 0);
  assert.equal(scrolls.length, count);
  assert.equal(frames.size, 0);
});

test('reply scrolling uses window resize when VisualViewport is unavailable', () => {
  const { editor, styles, scrolls, flush, assertVisible, dispose } = replyFixture(false);
  flush(); assertVisible();
  window.innerHeight = 350;
  window.dispatchEvent(new Event('resize'));
  assert.equal(styles.get('--reply-viewport-height'), '350px');
  assert.equal(styles.get('--reply-viewport-top'), '0px');
  flush(); assertVisible();
  assert.equal(scrolls.length, 2);
  editor.open = false;
  window.dispatchEvent(new Event('resize'));
  flush();
  assert.equal(scrolls.length, 2);
  dispose();
});

test('typing and repeated viewport events preserve a visible reply and its caret', () => {
  const { viewport, input, editor, scrolls, frames, flush, assertVisible, dispose } = replyFixture();
  flush();
  const savedScroll = editor.scrollTop, count = scrolls.length;
  input.value = 'A longer reply\nwith multiple lines';
  input.dispatchEvent(new Event('input'));
  viewport.dispatchEvent(new Event('resize'));
  viewport.dispatchEvent(new Event('scroll'));
  assert.equal(frames.size, 1);
  flush(); assertVisible();
  assert.equal(editor.scrollTop, savedScroll);
  assert.equal(scrolls.length, count);
  assert.equal(input.selectionStart, 8);
  assert.equal(input.selectionEnd, 8);
  assert.equal(input.value, 'A longer reply\nwith multiple lines');
  dispose();
});

test('a reply above the visible area is restored without moving the background page', () => {
  const { viewport, input, editor, flush, assertVisible, dispose } = replyFixture();
  flush();
  viewport.height = 220;
  window.dispatchEvent(new Event('resize'));
  flush(); assertVisible();
  editor.scrollTop += 120;
  input.dispatchEvent(new Event('focus'));
  flush(); assertVisible();
  input.dispatchEvent(new Event('input'));
  document.activeElement = null;
  const savedScroll = editor.scrollTop;
  flush();
  assert.equal(editor.scrollTop, savedScroll);
  dispose();
});

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
