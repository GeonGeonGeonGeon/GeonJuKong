import { local } from './storage.js';

const prefix = 'geonjukong-post-draft-v1:';
const pendingFiles = new Map();
const completed = new Set();
const draftKey = ({ mode, user, target = '' }) => prefix + JSON.stringify([mode, user, target]);

export function readPostDraft(scope, storage = localStorage) {
  const key = draftKey(scope);
  if (completed.has(key)) return null;
  const value = JSON.parse(storage.getItem(key) || 'null');
  return value && !value.completed ? value : null;
}

export function createPostDraft(scope, { storage = localStorage, files = local, onStatus = () => {} } = {}) {
  const key = draftKey(scope);
  const selected = new Map();
  let last = readPostDraft(scope, storage), stopped = false, textSaved = true;
  const writing = new Set(), failures = new Set();
  const status = () => {
    const ids = (last?.attachments || []).map(item => item.fileId);
    const message = !textSaved ? '기기 초안을 저장하지 못했어요. 입력은 이 창에 남아 있어요. 닫기 전에 내용을 복사해 주세요.'
      : ids.some(id => failures.has(id)) ? '텍스트 초안은 기기에 저장됐지만 신규 첨부를 저장하지 못했어요. 첨부를 다시 선택해야 할 수 있어요.'
        : ids.some(id => writing.has(id)) ? '텍스트 초안은 기기에 저장됐어요. 신규 첨부 저장 중에는 페이지 종료 시 파일이 복원되지 않을 수 있어요.'
          : '이 기기에 초안을 저장했어요. 같은 계정과 모드에서 이어 쓸 수 있어요.';
    onStatus(message);
    return message;
  };
  const removeFiles = ids => Promise.all(ids.map(async id => {
    try { await pendingFiles.get(id); } catch { /* A failed write can still leave a file to clean up. */ }
    await files.removeFile(id);
    pendingFiles.delete(id);
  }));
  return {
    get saved() { return last; },
    capture(fields, entries, version = '', uploads = new Map()) {
      if (stopped) return;
      const previous = last;
      const attachments = entries.map(entry => {
        if (entry.metadata || uploads.has(entry.key)) return { key: entry.key, metadata: entry.metadata || uploads.get(entry.key) };
        let item = selected.get(entry.key);
        if (!item) {
          const file = entry.file;
          item = { key: entry.key, fileId: `post-draft:${crypto.randomUUID()}`, name: file.name, type: file.type, lastModified: file.lastModified };
          if (file.pickerUri) { item.pickerUri = file.pickerUri; item.pickerDevice = file.pickerDevice; }
          selected.set(entry.key, item);
        }
        if (!pendingFiles.has(item.fileId)) {
          writing.add(item.fileId);
          const job = files.putFile(item.fileId, entry.file);
          pendingFiles.set(item.fileId, job);
          job.then(() => {}, () => { failures.add(item.fileId); selected.delete(entry.key); }).finally(() => { writing.delete(item.fileId); if (!stopped) status(); });
        }
        return item;
      });
      const value = { fields, attachments, version, updatedAt: new Date().toISOString() };
      try {
        storage.setItem(key, JSON.stringify(value));
        completed.delete(key); last = value; textSaved = true;
        const retained = new Set(attachments.map(item => item.fileId));
        const unused = (previous?.attachments || []).filter(item => item.fileId && !retained.has(item.fileId)).map(item => item.fileId);
        for (const [entryKey, item] of selected) if (!retained.has(item.fileId)) selected.delete(entryKey);
        void removeFiles(unused).catch(() => {});
      } catch { textSaved = false; }
      return status();
    },
    async restore() {
      const value = last;
      const entries = [], missing = [];
      for (const item of value?.attachments || []) {
        if (item.metadata) { entries.push(item); continue; }
        try {
          await pendingFiles.get(item.fileId);
          const stored = await files.file(item.fileId);
          if (!stored?.blob) throw new Error('Missing draft file');
          const file = new File([stored.blob], item.name, { type: item.type, lastModified: item.lastModified });
          if (item.pickerUri) { file.pickerUri = item.pickerUri; file.pickerDevice = item.pickerDevice; }
          entries.push({ key: item.key, file }); selected.set(item.key, item);
        } catch { missing.push(item.name); }
      }
      return { ...value, entries, missing };
    },
    async discard(saved = false) {
      stopped = true;
      const ids = new Set([...(last?.attachments || []).map(item => item.fileId), ...[...selected.values()].map(item => item.fileId)].filter(Boolean));
      try { storage.removeItem(key); }
      catch {
        if (!saved) { stopped = false; throw new Error('초안을 삭제하지 못했어요. 기기 저장 공간 설정을 확인해 주세요.'); }
        try { storage.setItem(key, JSON.stringify({ completed: true })); }
        catch { completed.add(key); throw new Error('일기는 저장됐지만 기기 초안 정리에 실패했어요. 페이지를 다시 열면 예전 초안이 보일 수 있으니 삭제해 주세요.'); }
      }
      completed.delete(key); last = null;
      try { await removeFiles([...ids]); }
      catch { throw new Error(saved ? '일기는 저장됐고 초안 안내도 정리됐지만 기기의 임시 첨부 정리에 실패했어요.' : '초안은 삭제됐지만 기기의 임시 첨부 정리에 실패했어요.'); }
    },
    status
  };
}
