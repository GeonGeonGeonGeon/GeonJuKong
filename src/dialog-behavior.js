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
