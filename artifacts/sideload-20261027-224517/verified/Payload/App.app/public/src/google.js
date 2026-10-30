import { dateKey, googleEvent, nextDay, safeFileType } from './core.js';
import { native } from './platform.js';
const config = window.APP_CONFIG;
let token = '', expires = 0;
const uploads = new Map();
const scripts = new Map();
function script(src) {
  if (!scripts.has(src)) scripts.set(src, new Promise((resolve, reject) => { const el = document.createElement('script'); el.src = src; el.onload = resolve; el.onerror = () => { scripts.delete(src); reject(new Error('Google 연결 스크립트를 불러오지 못했습니다.')); }; document.head.append(el); }));
  return scripts.get(src);
}
function access() { if (!token || expires < Date.now()) throw new Error('설정에서 Google을 연결해 주세요. 연결이 만료되면 다시 동의해야 합니다.'); return token; }
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${access()}`, ...options.headers } });
  if (!response.ok) { const data = await response.json().catch(() => ({})); if (response.status === 401) { token = ''; expires = 0; } throw new Error(data.error?.message || `Google 요청 실패 (${response.status})`); }
  return response.status === 204 ? null : response.json();
}
const eventPath = () => { if (!config.calendarId) throw new Error('config.js에 공유 캘린더 ID를 입력해 주세요.'); return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`; };
export const google = {
  get connected() { return Boolean(token && expires > Date.now()); },
  async prepare() { if (!native.active && config.googleClientId) await script('https://accounts.google.com/gsi/client'); },
  async acceptNativeToken(value, email) {
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {headers:{Authorization:`Bearer ${value}`}});
    const identity = await response.json();
    if(!response.ok || !identity.email_verified || identity.email?.toLowerCase() !== email.toLowerCase()) throw new Error('Google 계정 확인에 실패했습니다. 다시 연결해 주세요.');
    token = value; expires = Date.now() + 50 * 60 * 1000;
  },
  async connect(email) {
    if (!config.googleClientId) throw new Error('config.js에 Google OAuth 클라이언트 ID를 입력해 주세요.');
    if (!window.google?.accounts) throw new Error('Google 연결을 준비 중입니다. 잠시 후 다시 눌러 주세요.');
    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({ client_id: config.googleClientId, scope: 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file', hint: email,
        callback: async result => {
          if (result.error) return reject(new Error('Google 접근 동의를 완료하지 못했습니다.'));
          if (!window.google.accounts.oauth2.hasGrantedAllScopes(result, 'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/drive.file')) return reject(new Error('캘린더와 Drive 접근에 모두 동의해 주세요.'));
          try {
            const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {headers:{Authorization:`Bearer ${result.access_token}`}});
            const identity = await response.json();
            if (!response.ok || identity.email?.toLowerCase() !== email.toLowerCase() || !identity.email_verified) throw new Error('앱에 로그인한 것과 같은 Google 계정을 선택해 주세요.');
            token = result.access_token; expires = Date.now() + (Number(result.expires_in) - 30) * 1000; resolve();
          } catch (error) { reject(error); }
        }, error_callback: () => reject(new Error('Google 연결 창이 닫혔습니다. 다시 시도해 주세요.')) });
      client.requestAccessToken({ prompt: 'select_account' });
    });
  },
  disconnect() { token = ''; expires = 0; uploads.clear(); },
  async events(year, month) {
    const min = new Date(year, month, -7); const max = new Date(year, month + 1, 14);
    const params = new URLSearchParams({ timeMin: min.toISOString(), timeMax: max.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
    const all = []; let next;
    do { if (next) params.set('pageToken', next); const result = await api(`${eventPath()}?${params}`); all.push(...(result.items || []).map(googleEvent).filter(Boolean)); next = result.nextPageToken; } while (next);
    return all;
  },
  async saveEvent(data, id) {
    let start, end;
    if (data.time) {
      const begin = new Date(`${data.date}T${data.time}:00`);
      const finish = data.endDate && data.endTime ? new Date(`${data.endDate}T${data.endTime}:00`) : new Date(begin.getTime() + 3600000);
      if (finish <= begin) throw new Error('종료 시간은 시작 시간보다 뒤여야 합니다.');
      start = { dateTime: begin.toISOString() }; end = { dateTime: finish.toISOString() };
    } else { start = { date: data.date }; end = { date: data.endDate ? nextDay(data.endDate) : nextDay(data.date) }; if (end.date <= data.date) throw new Error('종료 날짜를 확인해 주세요.'); }
    return api(`${eventPath()}${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary: data.title, description: data.text || '', start, end }) });
  },
  async deleteEvent(id) { await api(`${eventPath()}/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async pickFolder() {
    access(); if (!config.googleApiKey || !config.googleProjectNumber) throw new Error('Google Picker용 API 키와 프로젝트 번호를 config.js에 입력해 주세요.');
    await script('https://apis.google.com/js/api.js');
    await new Promise((resolve, reject) => window.gapi.load('picker', { callback: resolve, onerror: () => reject(new Error('폴더 선택기를 불러오지 못했습니다.')) }));
    return new Promise((resolve, reject) => {
      const pickerApi = window.google.picker;
      const view = new pickerApi.DocsView(pickerApi.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true);
      new pickerApi.PickerBuilder().addView(view).setOAuthToken(access()).setDeveloperKey(config.googleApiKey).setAppId(config.googleProjectNumber).setOrigin(location.origin).setCallback(result => {
        if (result.action === pickerApi.Action.PICKED) resolve(result.docs[0]);
        if (result.action === pickerApi.Action.CANCEL) reject(new Error('폴더 선택을 취소했습니다.'));
      }).build().setVisible(true);
    });
  },
  async checkFolder() {
    if (!config.driveFolderId) throw new Error('config.js에 공유 Drive 폴더 ID를 입력해 주세요.');
    const folder = await api(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(config.driveFolderId)}?fields=id,name,mimeType,capabilities(canAddChildren)`);
    if (folder.mimeType !== 'application/vnd.google-apps.folder' || !folder.capabilities?.canAddChildren) throw new Error('선택한 공유 폴더에 업로드 권한이 없습니다.');
    return folder;
  },
  async image(id, signal) {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, { headers: { Authorization: `Bearer ${access()}` }, signal });
    if (!response.ok) {
      if (response.status === 401) { token = ''; expires = 0; }
      throw new Error('Drive 사진을 불러오지 못했어요. Google 연결과 파일 권한을 확인해 주세요.');
    }
    const blob = await response.blob();
    if (!/^image\/(jpeg|png|webp|gif|heic|heif|avif)$/i.test(blob.type) || !blob.size) throw new Error('미리볼 수 있는 사진이 아니에요. 원본 열기를 이용해 주세요.');
    return blob;
  },
  async upload(file, progress) {
    safeFileType(file); access();
    if (!config.driveFolderId) throw new Error('공유 Drive 폴더를 먼저 설정해 주세요.');
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    let upload = uploads.get(key);
    if (!upload) {
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink', { method: 'POST', headers: { Authorization: `Bearer ${access()}`, 'Content-Type': 'application/json', 'X-Upload-Content-Type': file.type, 'X-Upload-Content-Length': String(file.size) }, body: JSON.stringify({ name: file.name, parents: [config.driveFolderId] }) });
      if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error?.message || 'Drive 업로드를 시작하지 못했습니다.'); }
      const url = response.headers.get('Location'); if (!url) throw new Error('업로드 세션을 받지 못했습니다.');
      upload = { url, offset: 0 }; uploads.set(key, upload);
    } else {
      const status = await fetch(upload.url, { method: 'PUT', headers: { Authorization: `Bearer ${access()}`, 'Content-Range': `bytes */${file.size}` } });
      if (status.ok) { uploads.delete(key); const result = await status.json(); return { ...result, source: 'drive', type: file.type, size: file.size }; }
      if (status.status !== 308) { uploads.delete(key); throw new Error('업로드 세션이 만료되었습니다. 다시 저장해 주세요.'); }
      upload.offset = Number(status.headers.get('Range')?.split('-')[1] ?? -1) + 1;
    }
    while (upload.offset < file.size) {
      const end = Math.min(upload.offset + 4 * 1024 * 1024, file.size);
      const response = await fetch(upload.url, { method: 'PUT', headers: { Authorization: `Bearer ${access()}`, 'Content-Type': file.type, 'Content-Range': `bytes ${upload.offset}-${end - 1}/${file.size}` }, body: file.slice(upload.offset, end) });
      if (response.status === 308) { upload.offset = Number(response.headers.get('Range')?.split('-')[1] ?? end - 1) + 1; progress(Math.round(upload.offset / file.size * 100)); continue; }
      if (!response.ok) throw new Error('업로드가 중단되었습니다. 화면을 유지한 채 다시 저장하면 이어서 전송합니다.');
      const result = await response.json(); uploads.delete(key); progress(100); return { ...result, source: 'drive', type: file.type, size: file.size };
    }
    throw new Error('업로드 완료를 확인하지 못했습니다. 다시 저장해 주세요.');
  },
  async openFile(id) {
    // 상대방의 파일에 drive.file 승인이 없어도 Drive 뷰어에서 공유 권한으로 열 수 있습니다.
    const url = `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
    if(native.active)await native.open(url);else window.open(url, '_blank', 'noopener,noreferrer');
  }
};
