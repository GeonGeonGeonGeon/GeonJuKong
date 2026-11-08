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
export function focusReplyInput(editor, input, form) {
  const viewport = window.visualViewport;
  const updateViewport = () => {
    editor.style.setProperty('--reply-viewport-top', `${viewport?.offsetTop || 0}px`);
    editor.style.setProperty('--reply-viewport-height', `${viewport?.height || window.innerHeight}px`);
  };
  const keepVisible = () => {
    updateViewport();
    if (editor.open && document.activeElement === input) form.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  };
  editor.classList.add('reply-composing');
  updateViewport();
  // Focus during the reply tap so mobile browsers can open the keyboard.
  input.focus({ preventScroll: true });
  form.scrollIntoView({ block: 'center', behavior: 'instant' });
  input.addEventListener('focus', keepVisible);
  viewport?.addEventListener('resize', keepVisible);
  viewport?.addEventListener('scroll', keepVisible);
  window.addEventListener('resize', keepVisible);
  return () => {
    input.removeEventListener('focus', keepVisible);
    viewport?.removeEventListener('resize', keepVisible);
    viewport?.removeEventListener('scroll', keepVisible);
    window.removeEventListener('resize', keepVisible);
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
