export function installGalleryDrag(root = document) {
  let drag = null, suppressClick = false;
  root.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('video, .attachment-navigation, .memory-arrow, [data-action="open-file"]')) return;
    const track = event.target.closest('.attachments, .memory-slides');
    if (!track || track.scrollWidth <= track.clientWidth) return;
    drag = { track, x: event.clientX, left: track.scrollLeft, moved: false, snap: track.style.scrollSnapType };
    suppressClick = false;
  });
  root.addEventListener('pointermove', event => {
    if (!drag) return;
    const distance = event.clientX - drag.x;
    if (!drag.moved && Math.abs(distance) < 6) return;
    drag.moved = true;
    drag.track.style.scrollSnapType = 'none';
    drag.track.scrollLeft = drag.left - distance;
    event.preventDefault();
  }, { passive: false });
  const finish = () => {
    if (!drag) return;
    const { track, moved, snap } = drag;
    track.style.scrollSnapType = snap;
    if (moved) {
      suppressClick = true;
      track.scrollTo({ left: Math.round(track.scrollLeft / track.clientWidth) * track.clientWidth, behavior: 'smooth' });
      setTimeout(() => { suppressClick = false; }, 0);
    }
    drag = null;
  };
  root.addEventListener('pointerup', finish);
  root.addEventListener('pointercancel', finish);
  root.addEventListener('dragstart', event => { if (event.target.closest('.attachments, .memory-slides')) event.preventDefault(); });
  root.addEventListener('click', event => {
    if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
}
