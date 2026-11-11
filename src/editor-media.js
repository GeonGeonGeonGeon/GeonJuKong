import { escapeHtml as e, safeFileType } from './core.js';
import { previewFile } from './media.js';

const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', avif: 'image/avif', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', '3gp': 'video/3gpp', m4v: 'video/x-m4v' };

export function selectedMediaFile(file) {
  const type = file.type === 'image/jpg' ? 'image/jpeg' : file.type || types[file.name.split('.').pop().toLowerCase()];
  const selected = type && type !== file.type ? new File([file], file.name, { type, lastModified: file.lastModified }) : file;
  if (file.pickerUri) { selected.pickerUri = file.pickerUri; selected.pickerDevice = file.pickerDevice; }
  safeFileType(selected);
  return selected;
}

function existingPreview(original) {
  if (original.type.startsWith('video/')) return `<div class="video-preview"><video controls playsinline preload="metadata" ${original.source === 'local' ? 'data-file' : 'data-drive-video'}="${e(original.id)}" aria-label="${e(original.name)}"></video>${original.source === 'drive' ? `<button type="button" class="secondary video-load" data-action="video-load" data-id="${e(original.id)}">영상 불러와 재생</button>` : ''}<span class="video-status" role="status"></span></div>`;
  const file = previewFile(original);
  if (file.source === 'local') return `<img data-file="${e(file.id)}" alt="${e(original.name)}">`;
  return `<div class="photo-preview"><div class="file-cover"><span data-preview-status>사진을 불러오는 중…</span><small>${e(original.name)}</small></div><img data-drive-file="${e(file.id)}"${file.id !== original.id ? ` data-drive-original="${e(original.id)}"` : ''} alt="${e(original.name)}" hidden></div>`;
}

export function createMediaDraft(existingFiles = []) {
  let items = existingFiles.map(metadata => ({ key: `saved:${metadata.source}:${metadata.id}`, metadata }));
  const inRange = index => Number.isInteger(index) && index >= 0 && index < items.length;
  return {
    entries() { return items.map(item => ({ ...item })); },
    restore(entries) {
      for (const item of items) if (item.url) URL.revokeObjectURL(item.url);
      items = entries.map(item => item.file ? { ...item, url: URL.createObjectURL(item.file) } : { ...item });
    },
    addFiles(files) {
      // Validate the whole selection before changing the draft.
      const selected = Array.from(files, selectedMediaFile);
      let added = 0;
      for (const file of selected) {
        const key = file.pickerUri ? `selected:picker:${file.pickerDevice}:${file.pickerUri}` : `selected:${file.name}:${file.size}:${file.lastModified}:${file.type}`;
        if (items.some(item => item.key === key)) continue;
        items.push({ key, file, url: URL.createObjectURL(file) });
        added++;
      }
      return added;
    },
    applyPickerSelection({ files, selectedUris, preselectedUris = [], pickerDevice }) {
      if (!selectedUris) return this.addFiles(files);
      const selected = new Map(Array.from(files, selectedMediaFile).map(file => [file.pickerUri, file]));
      const uriOf = item => { const file = item.file || item.metadata; return file.pickerDevice === pickerDevice ? file.pickerUri : undefined; };
      const previous = new Map(items.filter(item => uriOf(item)).map(item => [uriOf(item), item]));
      for (const uri of selectedUris) {
        if (!previous.has(uri) && !selected.has(uri)) throw new Error('선택한 사진을 찾지 못했어요. 다시 선택해 주세요.');
      }
      const managed = new Set([...preselectedUris, ...selectedUris]);
      // Keep imported attachments and originals this device could not preselect.
      const first = items.findIndex(item => managed.has(uriOf(item)));
      const insertion = first < 0 ? items.length : first;
      const retained = items.filter(item => !managed.has(uriOf(item)));
      const chosen = selectedUris.map(uri => {
        if (previous.has(uri)) return previous.get(uri);
        const file = selected.get(uri);
        return { key: `selected:picker:${pickerDevice}:${uri}`, file, url: URL.createObjectURL(file) };
      });
      const kept = new Set([...retained, ...chosen]);
      for (const item of items) if (!kept.has(item) && item.url) URL.revokeObjectURL(item.url);
      retained.splice(insertion, 0, ...chosen);
      items = retained;
    },
    remove(index) {
      if (!inRange(index)) return false;
      const [item] = items.splice(index, 1);
      if (item.url) URL.revokeObjectURL(item.url);
      return true;
    },
    move(index, delta) {
      if (!inRange(index) || ![-1, 1].includes(delta) || !inRange(index + delta)) return false;
      [items[index], items[index + delta]] = [items[index + delta], items[index]];
      return true;
    },
    render() {
      if (!items.length) return '<p class="setting-hint">사진이나 동영상을 선택하면 순서대로 표시돼요.</p>';
      return `<ol class="media-draft-list">${items.map((item, index) => {
        const file = item.file || item.metadata;
        const preview = item.file ? file.type.startsWith('video/') ? `<video src="${e(item.url)}" controls playsinline preload="metadata" aria-label="${e(file.name)}"></video>` : `<img src="${e(item.url)}" alt="${e(file.name)}">` : existingPreview(file);
        return `<li class="media-draft-item"><span class="media-order" aria-label="${index + 1}번째 첨부">${index + 1}</span><div class="media-draft-preview">${preview}</div><span class="media-draft-name" title="${e(file.name)}">${e(file.name)}</span><div class="media-draft-tools"><button type="button" class="text-button" data-action="media-earlier" data-index="${index}" aria-label="${index + 1}번째 첨부 앞으로 이동"${index === 0 ? ' disabled' : ''}>앞으로</button><button type="button" class="text-button" data-action="media-later" data-index="${index}" aria-label="${index + 1}번째 첨부 뒤로 이동"${index === items.length - 1 ? ' disabled' : ''}>뒤로</button><button type="button" class="text-button danger" data-action="media-remove" data-index="${index}" aria-label="${index + 1}번째 첨부 삭제">삭제</button></div></li>`;
      }).join('')}</ol><p class="setting-hint">번호 순서로 올라가요. 앞으로·뒤로 버튼으로 순서를 바꾸거나 삭제 후 다시 추가할 수 있어요.</p>`;
    },
    dispose() {
      for (const item of items) if (item.url) URL.revokeObjectURL(item.url);
      items = [];
    }
  };
}
