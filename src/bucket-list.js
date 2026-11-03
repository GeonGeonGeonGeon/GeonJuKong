import { dateKey, escapeHtml as e } from './core.js';

export function validateBucketItem(data) {
  const title = String(data.title || '').trim();
  const notes = String(data.notes || '').trim();
  const completed_on = data.completed_on || null;
  if (!title || title.length > 120) throw new Error('목표를 1~120자로 입력해 주세요.');
  if (notes.length > 2000) throw new Error('메모는 2,000자 이내로 적어 주세요.');
  if (completed_on && (!/^\d{4}-\d{2}-\d{2}$/.test(completed_on) || dateKey(new Date(`${completed_on}T12:00:00`)) !== completed_on)) throw new Error('올바른 달성 날짜를 선택해 주세요.');
  return { title, notes, completed_on };
}

export function createBucketList({ state, repository, local, dialog, closeDialog, render, toast }) {
  let saving = false, loadSequence = 0;
  const items = () => state.bucketItems || [];
  const find = id => items().find(row => row.id === id);
  const version = row => row?.updated_at || row?.created_at || '';
  const conflict = '다른 기기에서 목표가 변경되었어요. 목록을 새로 불러온 뒤 다시 시도해 주세요.';

  async function load() {
    const mode = state.mode, user = state.user, sequence = ++loadSequence;
    const rows = mode === 'demo' ? (await local.list()).filter(row => row.kind === 'bucket').map(row => ({ ...row, ...row.data })) : await repository.bucketItems();
    if (state.mode === mode && state.user === user && sequence === loadSequence) state.bucketItems = rows;
    return rows;
  }

  async function refreshAfterChange(mode, user, message) {
    if (state.mode !== mode || state.user !== user) return;
    render();
    toast(message);
    try {
      await load();
      if (state.mode === mode && state.user === user) render();
    } catch {
      if (state.mode === mode && state.user === user) toast('변경은 저장했어요. 최신 목록을 불러오지 못했으니 잠시 후 새로고침해 주세요.');
    }
  }

  function view() {
    const rows = [...items()].sort((a, b) => Boolean(a.completed_on) - Boolean(b.completed_on) || String(b.created_at).localeCompare(String(a.created_at)) || a.id.localeCompare(b.id));
    const completed = rows.filter(row => row.completed_on).length;
    return `<div class="page-heading"><div><p class="eyebrow">OUR BUCKET LIST</p><h1>버킷리스트</h1><p class="subtitle">함께 이루고 싶은 목표를 하나씩 채워 가요.</p></div><button type="button" class="primary" data-action="bucket-new">+ 목표 추가</button></div><section class="card bucket-list" aria-label="우리의 버킷리스트"><div class="bucket-progress"><strong>달성 ${completed} / ${rows.length}</strong><span>체크하면 달성 날짜가 기록돼요.</span></div>${rows.length ? `<ul class="bucket-items">${rows.map(row => `<li class="bucket-item ${row.completed_on ? 'completed' : ''}"><button type="button" class="bucket-check" role="checkbox" aria-checked="${Boolean(row.completed_on)}" aria-label="${e(row.title)} ${row.completed_on ? '달성 취소' : '달성하기'}" data-action="bucket-toggle" data-id="${e(row.id)}">${row.completed_on ? '✓' : ''}</button><div class="bucket-copy"><strong>${e(row.title)}</strong>${row.notes ? `<p>${e(row.notes)}</p>` : ''}${row.completed_on ? `<button type="button" class="text-button bucket-date" data-action="bucket-edit" data-id="${e(row.id)}">✓ ${e(row.completed_on)} 달성 · 날짜 수정</button>` : '<span class="bucket-pending">함께 도전 중</span>'}</div><div class="bucket-tools"><button type="button" class="text-button" data-action="bucket-edit" data-id="${e(row.id)}" aria-label="${e(row.title)} 수정">수정</button><button type="button" class="text-button danger" data-action="bucket-delete" data-id="${e(row.id)}" aria-label="${e(row.title)} 삭제">삭제</button></div></li>`).join('')}</ul>` : '<div class="empty"><h3>함께 이루고 싶은 일이 있나요?</h3><p>여행, 작은 습관, 꼭 해 보고 싶은 일을 목표로 남겨 주세요.</p><button type="button" class="secondary" data-action="bucket-new">첫 목표 추가</button></div>'}</section>`;
  }

  function openEditor(row) {
    dialog(row ? '목표 수정' : '새 목표', `<form id="bucket-form" data-id="${e(row?.id || '')}" data-version="${e(version(row))}"><label>목표<input name="title" value="${e(row?.title || '')}" maxlength="120" placeholder="함께 이루고 싶은 일" required></label><label>메모<textarea name="notes" rows="3" maxlength="2000" placeholder="어떻게 이루고 싶은지 적어 주세요.">${e(row?.notes || '')}</textarea></label><label class="bucket-completed-field"><input type="checkbox" name="completed" ${row?.completed_on ? 'checked' : ''}> 달성했어요</label><label>달성 날짜<input type="date" name="completedOn" value="${e(row?.completed_on || dateKey())}" required></label><p class="setting-hint">달성했어요에 체크하면 선택한 날짜가 기록돼요. 체크를 해제하면 달성을 취소해요.</p><p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="secondary" data-action="close">취소</button><button type="submit" class="primary">저장</button></div></form>`);
  }

  async function save(data, row, expectedVersion = version(row)) {
    data = validateBucketItem(data);
    if (state.mode === 'live') return repository.saveBucketItem(state.user, data, row?.id, expectedVersion || undefined);
    const timestamp = new Date(Math.max(Date.now(), row ? Date.parse(version(row)) + 1 : 0)).toISOString();
    const record = { id: row?.id || crypto.randomUUID(), kind: 'bucket', author_id: row?.author_id || state.user, data, created_at: row?.created_at || timestamp, updated_at: timestamp };
    if (row) {
      if (!await local.putIfVersion(record, expectedVersion)) throw new Error(conflict);
    } else await local.put(record);
    return { ...record, ...data };
  }

  async function action(action, button) {
    if (!action?.startsWith('bucket-')) return false;
    if (saving) return true;
    if (action === 'bucket-new') { openEditor(); return true; }
    const row = find(button.dataset.id);
    if (!row) throw new Error('목표를 찾을 수 없어요. 목록을 새로 불러와 주세요.');
    if (action === 'bucket-edit') { openEditor(row); return true; }
    if (action === 'bucket-delete') {
      dialog('목표 삭제', `<p class="bucket-delete-message">${e(row.title)} 목표를 삭제할까요?</p><div class="modal-actions"><button type="button" class="secondary" data-action="close">취소</button><button type="button" class="primary" data-action="bucket-confirm-delete" data-id="${e(row.id)}" data-version="${e(version(row))}">삭제</button></div>`);
      return true;
    }
    if (!['bucket-toggle', 'bucket-confirm-delete'].includes(action)) return false;
    const mode = state.mode, user = state.user;
    saving = true;
    button.disabled = true;
    try {
      if (action === 'bucket-toggle') {
        const saved = await save({ title: row.title, notes: row.notes, completed_on: row.completed_on ? null : dateKey() }, row);
        if (state.mode !== mode || state.user !== user) return true;
        loadSequence++;
        state.bucketItems = [...items().filter(item => item.id !== row.id), saved];
      }
      else {
        if (mode === 'live') await repository.removeBucketItem(row.id, button.dataset.version || version(row));
        else {
          const current = (await local.list()).find(item => item.id === row.id && item.kind === 'bucket');
          if (!current || version(current) !== button.dataset.version) throw new Error(conflict);
          await local.remove(row.id);
        }
        if (state.mode !== mode || state.user !== user) return true;
        loadSequence++;
        state.bucketItems = items().filter(item => item.id !== row.id);
        if (button.isConnected !== false) closeDialog();
      }
      await refreshAfterChange(mode, user, action === 'bucket-confirm-delete' ? '목표를 삭제했어요.' : row.completed_on ? '달성을 취소했어요.' : '목표를 달성했어요!');
      return true;
    } finally { saving = false; button.disabled = false; }
  }

  async function submit(form) {
    if (form.id !== 'bucket-form') return false;
    if (saving) return true;
    const mode = state.mode, user = state.user;
    saving = true;
    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const values = new FormData(form);
      const row = form.dataset.id ? find(form.dataset.id) : undefined;
      if (form.dataset.id && !row) throw new Error('목표를 찾을 수 없어요. 목록을 새로 불러와 주세요.');
      const completed_on = values.has('completed') ? values.get('completedOn') : null;
      if (values.has('completed') && !completed_on) throw new Error('달성 날짜를 선택해 주세요.');
      const saved = await save({ title: values.get('title'), notes: values.get('notes'), completed_on }, row, form.dataset.version);
      if (state.mode !== mode || state.user !== user) return true;
      loadSequence++;
      state.bucketItems = [...items().filter(item => item.id !== saved.id), saved];
      if (form.isConnected !== false) closeDialog();
      await refreshAfterChange(mode, user, '목표를 저장했어요.');
      return true;
    } finally { saving = false; if (submitButton) submitButton.disabled = false; }
  }

  return { render: view, load, action, submit };
}
