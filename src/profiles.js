import { escapeHtml as e } from './core.js';

const DEMO_KEY = 'geonjukong-demo-profiles';
const MAX_PHOTO_LENGTH = 180000;
const demoNames = { 'demo-me': '나', 'demo-partner': '짝꿍' };

export function validateProfile(data) {
  const profile = { name: String(data.name || '').trim(), bio: String(data.bio || '').trim(), status: String(data.status || '').trim(), photo: String(data.photo || '') };
  if (profile.name.length > 30) throw new Error('이름은 30자까지 입력해 주세요.');
  if (profile.bio.length > 1000) throw new Error('자기소개는 1,000자까지 입력해 주세요.');
  if (profile.status.length > 100) throw new Error('상태메시지는 100자까지 입력해 주세요.');
  if (profile.photo && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(profile.photo) || profile.photo.length > MAX_PHOTO_LENGTH)) throw new Error('프로필 사진을 다시 선택해 주세요.');
  return profile;
}

export async function createProfilePhoto(file) {
  if (!/^image\/(jpeg|png|webp|gif|heic|heif|avif)$/i.test(file.type || '')) throw new Error('프로필 사진은 이미지 파일을 선택해 주세요.');
  if (!file.size || file.size > 15 * 1024 * 1024) throw new Error('프로필 사진은 15MB 이하의 파일을 선택해 주세요.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('사진을 읽을 수 없어요. JPEG 또는 PNG 사진으로 다시 선택해 주세요.'));
      image.src = url;
    });
    const edge = Math.min(image.naturalWidth, image.naturalHeight);
    if (!edge) throw new Error('사진의 크기를 확인할 수 없어요. 다른 사진을 선택해 주세요.');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(384, edge);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이 기기에서 사진을 처리할 수 없어요.');
    context.drawImage(image, (image.naturalWidth - edge) / 2, (image.naturalHeight - edge) / 2, edge, edge, 0, 0, canvas.width, canvas.height);
    let photo = canvas.toDataURL('image/webp', 0.82);
    if (photo.length > MAX_PHOTO_LENGTH) photo = canvas.toDataURL('image/jpeg', 0.65);
    validateProfile({ photo });
    return photo;
  } finally { URL.revokeObjectURL(url); }
}

export function createProfiles({ state, repository, dialog, closeDialog, render, toast, currentEmail = () => '' }) {
  let draftPhoto = '', selection = 0, loadSequence = 0, processing = false, saving = false;
  const rows = () => state.profiles || [];
  function demoProfiles() {
    try {
      const saved = JSON.parse(localStorage.getItem(DEMO_KEY) || '[]');
      return Array.isArray(saved) ? saved.filter(row => row && typeof row.user_id === 'string' && row.data && typeof row.data === 'object') : [];
    } catch { return []; }
  }
  function resolveId(id) {
    if (id !== 'other') return id;
    if (state.mode === 'demo') return state.user === 'demo-me' ? 'demo-partner' : 'demo-me';
    return rows().find(row => row.user_id !== state.user)?.user_id || 'other';
  }
  function profileOf(id) { return rows().find(row => row.user_id === resolveId(id)); }
  function nameOf(id) {
    id = resolveId(id);
    const row = profileOf(id);
    if (row?.data?.name) return row.data.name;
    if (state.mode === 'demo') return demoNames[id] || '짝꿍';
    const email = row?.email || (id === state.user ? currentEmail() : '');
    const member = state.members.find(item => item.email === email);
    if (member) return member.display_name || (id === state.user ? '나' : '짝꿍');
    if (id === 'other') return state.members.find(item => item.email !== currentEmail())?.display_name || '짝꿍';
    return id === state.user ? '나' : '짝꿍';
  }
  function avatar(id, small = false) {
    id = resolveId(id);
    const row = profileOf(id), name = nameOf(id), photo = row?.data?.photo;
    return `<span class="avatar profile-avatar ${id === state.user ? 'me' : 'partner'} ${small ? 'small' : ''}" role="button" tabindex="0" data-action="profile-open" data-id="${e(id)}" aria-label="${e(name)} 프로필 보기">${photo ? `<img src="${e(photo)}" alt="">` : e(name.slice(0, 1))}</span>`;
  }
  function open(id) {
    id = resolveId(id);
    const data = profileOf(id)?.data || {}, name = nameOf(id);
    dialog(`${e(name)}의 프로필`, `<section class="profile-detail"><div class="profile-photo">${data.photo ? `<img src="${e(data.photo)}" alt="${e(name)} 프로필 사진">` : `<span aria-hidden="true">${e(name.slice(0, 1))}</span>`}</div><h3>${e(name)}</h3><p class="profile-status">${e(data.status || '아직 상태메시지가 없어요.')}</p><div class="profile-bio"><h4>자기소개</h4><p>${e(data.bio || '아직 자기소개가 없어요.')}</p></div>${id === state.user ? '<button type="button" class="secondary" data-action="profile-edit">내 프로필 수정</button>' : ''}</section>`);
  }
  function edit() {
    const data = profileOf(state.user)?.data || {};
    selection++; processing = false;
    draftPhoto = data.photo || '';
    dialog('내 프로필 수정', `<form id="profile-form"><div class="profile-edit-photo" id="profile-photo-preview">${draftPhoto ? `<img src="${e(draftPhoto)}" alt="선택한 프로필 사진">` : '<span>사진 없음</span>'}</div><label class="file-input">프로필 사진 선택<input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif"></label><button type="button" class="text-button" data-action="profile-remove-photo">프로필 사진 지우기</button><label>이름<input name="name" maxlength="30" value="${e(data.name || '')}" placeholder="상대에게 보일 이름"></label><label>상태메시지<input name="status" maxlength="100" value="${e(data.status || '')}" placeholder="요즘 나의 한마디"></label><label>자기소개<textarea name="bio" rows="5" maxlength="1000" placeholder="나를 소개해 주세요">${e(data.bio || '')}</textarea></label><p class="setting-hint">이름과 프로필은 우리 두 사람에게 보여요.</p><p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="secondary" data-action="close">취소</button><button type="submit" class="primary">프로필 저장</button></div></form>`);
  }
  async function load() {
    const mode = state.mode, user = state.user, sequence = ++loadSequence;
    const profiles = mode === 'live' ? await repository.profiles() : demoProfiles();
    if (state.mode === mode && state.user === user && sequence === loadSequence) state.profiles = profiles;
    return profiles;
  }
  async function action(action, button) {
    if (action === 'profile-open') { open(button.dataset.id); return true; }
    if (action === 'profile-edit') { edit(); return true; }
    if (action === 'profile-remove-photo') {
      selection++; processing = false; draftPhoto = '';
      const form = document.querySelector('#profile-form');
      if (form) {
        form.querySelector('#profile-photo-preview').innerHTML = '<span>사진 없음</span>';
        form.querySelector('#profile-photo').value = '';
        form.querySelector('.form-error').textContent = '';
        form.querySelector('[type="submit"]').disabled = false;
      }
      return true;
    }
    return false;
  }
  async function change(event) {
    if (event.target.id !== 'profile-photo') return false;
    const input = event.target, form = input.form, file = input.files?.[0];
    if (!file) return true;
    const version = ++selection, user = state.user;
    const error = form.querySelector('.form-error'), submit = form.querySelector('[type="submit"]');
    error.textContent = ''; submit.disabled = true; processing = true;
    try {
      const photo = await createProfilePhoto(file);
      if (version !== selection || user !== state.user || !form.isConnected) return true;
      draftPhoto = photo;
      form.querySelector('#profile-photo-preview').innerHTML = `<img src="${e(photo)}" alt="선택한 프로필 사진">`;
    } catch (failure) { if (version === selection && form.isConnected) error.textContent = failure.message; }
    finally { if (version === selection) { processing = false; if (form.isConnected) submit.disabled = false; } }
    return true;
  }
  async function submit(form) {
    if (form.id !== 'profile-form') return false;
    if (processing || saving) return true;
    const error = form.querySelector('.form-error'), button = form.querySelector('[type="submit"]');
    error.textContent = ''; button.disabled = true; saving = true;
    const mode = state.mode, user = state.user;
    try {
      const data = validateProfile({ name: form.elements.name.value, status: form.elements.status.value, bio: form.elements.bio.value, photo: draftPhoto });
      let row;
      if (mode === 'live') {
        const saved = await repository.saveProfile(user, data);
        row = Array.isArray(saved) ? saved[0] : saved;
        if (!row) throw new Error('프로필을 저장하지 못했어요. 다시 시도해 주세요.');
      } else {
        row = { user_id: user, data, updated_at: new Date().toISOString() };
        const saved = demoProfiles().filter(item => item.user_id !== user);
        localStorage.setItem(DEMO_KEY, JSON.stringify([...saved, row]));
      }
      if (mode === state.mode && user === state.user) {
        loadSequence++;
        state.profiles = [...rows().filter(item => item.user_id !== user), row];
        if (form.isConnected) closeDialog();
        render(); toast('프로필을 저장했어요.');
      }
    } catch (failure) { if (form.isConnected) error.textContent = failure.message; }
    finally { saving = false; if (form.isConnected) button.disabled = false; }
    return true;
  }
  return { load, avatar, nameOf, open, action, change, submit };
}
