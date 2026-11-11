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
  const form = input.form || null;
  const comment = input.closest?.('.comment') || null;
  let frame = null, showComment = false;
  const updateViewport = () => {
    editor.style.setProperty('--reply-viewport-top', `${viewport?.offsetTop || 0}px`);
    editor.style.setProperty('--reply-viewport-height', `${viewport?.height || window.innerHeight}px`);
  };
  const keepVisible = () => {
    frame = null;
    const withComment = showComment; showComment = false;
    if (!editor.open || document.activeElement !== input) return;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
    const bounds = editor.getBoundingClientRect();
    const rect = input.getBoundingClientRect();
    const top = Math.max(viewportTop, bounds.top + editor.clientTop) + 12;
    const bottom = Math.min(viewportBottom, bounds.top + editor.clientTop + editor.clientHeight) - 12;
    if (bottom <= top) return;
    // Keep the whole reply form (input and its buttons) visible, plus the comment being
    // answered when it fits; if space is short, prefer the form and then the input alone.
    const end = Math.max(rect.bottom, form?.getBoundingClientRect().bottom ?? rect.bottom);
    const start = withComment && comment ? Math.min(rect.top, comment.getBoundingClientRect().top) : rect.top;
    let delta = 0;
    if (end - start <= bottom - top) delta = start < top ? start - top : end > bottom ? end - bottom : 0;
    else if (end - rect.top <= bottom - top) delta = rect.top < top || end > bottom ? end - bottom : 0;
    else if (rect.top < top || rect.height > bottom - top) delta = rect.top - top;
    else if (rect.bottom > bottom) delta = rect.bottom - bottom;
    // Scroll only the dialog; scrolling ancestors can also move the locked page on iOS.
    if (delta) editor.scrollTop += delta;
  };
  const schedule = (event) => {
    updateViewport();
    // Typing only keeps the form in view, so it does not undo the user's own scrolling.
    if (event?.type !== 'input') showComment = true;
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
  let startedOutside = false, backdropTouch = false;
  const outside = event => {
    if (event.target !== editor) return false;
    const point = event.touches?.[0] || event;
    const rect = editor.getBoundingClientRect();
    return point.clientX < rect.left || point.clientX > rect.right || point.clientY < rect.top || point.clientY > rect.bottom;
  };
  editor.addEventListener('touchstart', event => { backdropTouch = outside(event); });
  // The backdrop is outside the fixed body; cancel its pan explicitly on iOS.
  editor.addEventListener('touchmove', event => { if (backdropTouch) event.preventDefault(); }, { passive: false });
  editor.addEventListener('touchend', () => { backdropTouch = false; });
  editor.addEventListener('touchcancel', () => { backdropTouch = false; });
  editor.addEventListener('pointerdown', event => { startedOutside = outside(event); });
  editor.addEventListener('click', event => {
    if (startedOutside && outside(event)) { event.preventDefault(); back(); }
    startedOutside = false;
  });
  editor.addEventListener('cancel', event => { event.preventDefault(); back(); });
  editor.addEventListener('close', () => { if (!editor.open) unlockPage(); });
}
