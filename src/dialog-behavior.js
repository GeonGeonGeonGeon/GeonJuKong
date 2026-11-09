let lockedAt = null;
export function lockPage() {
  if (lockedAt !== null || !document.body?.style) return;
  lockedAt = { y: window.scrollY || 0, position: document.body.style.position, top: document.body.style.top, width: document.body.style.width };
  document.body.style.position = 'fixed';
  document.body.style.top = `-${lockedAt.y}px`;
  document.body.style.width = '100%';
  document.documentElement?.classList.add('modal-open');
}
export function unlockPage() {
  if (lockedAt === null) return;
  const saved = lockedAt; lockedAt = null;
  Object.assign(document.body.style, { position: saved.position, top: saved.top, width: saved.width });
  document.documentElement?.classList.remove('modal-open');
  window.scrollTo({ top: saved.y, behavior: 'instant' });
}
export function focusReplyInput(editor, input) {
  const viewport = window.visualViewport;
  let frame = null;
  const updateViewport = () => {
    editor.style.setProperty('--reply-viewport-top', `${viewport?.offsetTop || 0}px`);
    editor.style.setProperty('--reply-viewport-height', `${viewport?.height || window.innerHeight}px`);
  };
  const keepVisible = () => {
    frame = null;
    if (!editor.open || document.activeElement !== input) return;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
    const bounds = editor.getBoundingClientRect();
    const rect = input.getBoundingClientRect();
    const top = Math.max(viewportTop, bounds.top + editor.clientTop) + 12;
    const bottom = Math.min(viewportBottom, bounds.top + editor.clientTop + editor.clientHeight) - 12;
    if (bottom <= top) return;
    // Scroll only the dialog; scrolling ancestors can also move the locked page on iOS.
    if (rect.top < top || rect.height > bottom - top) editor.scrollTop += rect.top - top;
    else if (rect.bottom > bottom) editor.scrollTop += rect.bottom - bottom;
  };
  const schedule = () => {
    updateViewport();
    // Measure after the viewport styles have changed the dialog's layout.
    if (frame === null) frame = window.requestAnimationFrame(keepVisible);
  };
  editor.classList.add('reply-composing');
  updateViewport();
  // Focus during the reply tap so mobile browsers can open the keyboard.
  input.focus({ preventScroll: true });
  schedule();
  input.addEventListener('focus', schedule);
  input.addEventListener('input', schedule);
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  return () => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    input.removeEventListener('focus', schedule);
    input.removeEventListener('input', schedule);
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    editor.classList.remove('reply-composing');
    editor.style.removeProperty('--reply-viewport-top');
    editor.style.removeProperty('--reply-viewport-height');
  };
}
export function installDialogDismissal(editor, back) {
  let startedOutside = false;
  const outside = event => {
    if (event.target !== editor) return false;
    const rect = editor.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  editor.addEventListener('pointerdown', event => { startedOutside = outside(event); });
  editor.addEventListener('click', event => {
    if (startedOutside && outside(event)) { event.preventDefault(); back(); }
    startedOutside = false;
  });
  editor.addEventListener('cancel', event => { event.preventDefault(); back(); });
  editor.addEventListener('close', () => { if (!editor.open) unlockPage(); });
}
