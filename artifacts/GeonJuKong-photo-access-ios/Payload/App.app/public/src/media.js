export const previewFile = file => file?.thumbnail || file;

// Originals remain untouched; an unsupported decoder simply keeps the original preview.
export async function createThumbnail(file) {
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

// Session-only measurements contain sizes/timings, never account or file identifiers.
const measurements = { downloads: 0, bytes: 0, milliseconds: 0, cacheHits: 0 };
export function recordPreviewDownload(bytes, milliseconds) {
  measurements.downloads++;
  measurements.bytes += bytes;
  measurements.milliseconds += milliseconds;
}
export function recordPreviewCacheHit() { measurements.cacheHits++; }
export function previewMeasurements() { return { ...measurements }; }
