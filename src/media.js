export const previewFile = file => file?.thumbnail || file;

// Originals remain untouched; an unsupported decoder simply keeps the original preview.
export async function createThumbnail(file) {
  if (/^video\//i.test(file.type)) return videoThumbnail(file);
  if (!/^image\/(jpeg|png|webp|gif|avif)$/i.test(file.type)) return null;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.72));
    if (!blob || blob.size >= file.size) return null;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.preview.${blob.type === 'image/webp' ? 'webp' : 'png'}`, { type: blob.type, lastModified: file.lastModified });
  } catch { return null; }
  finally { bitmap?.close(); }
}

async function videoThumbnail(file) {
  let video, url, timer;
  try {
    video = document.createElement('video');
    if (typeof video.load !== 'function') return null;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    url = URL.createObjectURL(file);
    const frame = new Promise(resolve => {
      let seeking = false;
      video.onerror = () => resolve(null);
      video.onloadeddata = () => {
        video.onloadeddata = null;
        if (Number.isFinite(video.duration) && video.duration > 0.2) {
          seeking = true;
          video.currentTime = Math.min(0.1, video.duration / 2);
        } else resolve(video);
      };
      video.onseeked = () => { if (seeking) resolve(video); };
      timer = setTimeout(() => resolve(null), 8000);
      video.src = url;
    });
    if (!await frame || !video.videoWidth || !video.videoHeight) return null;
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.72));
    if (!blob || blob.size >= file.size) return null;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.preview.${blob.type === 'image/webp' ? 'webp' : 'png'}`, { type: blob.type, lastModified: file.lastModified });
  } catch { return null; }
  finally {
    clearTimeout(timer);
    if (video) {
      video.onloadeddata = video.onseeked = video.onerror = null;
      video.removeAttribute?.('src');
      video.load?.();
    }
    if (url) URL.revokeObjectURL(url);
  }
}

// Session-only measurements contain sizes/timings, never account or file identifiers.
const measurements = { downloads: 0, bytes: 0, milliseconds: 0, cacheHits: 0 };
export function recordPreviewDownload(bytes, milliseconds) {
  measurements.downloads++;
  measurements.bytes += bytes;
  measurements.milliseconds += milliseconds;
}
export function recordPreviewCacheHit() { measurements.cacheHits++; }
export function previewMeasurements() { return { ...measurements }; }
