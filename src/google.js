import { dateKey, googleEvent, nextDay, safeFileType } from './core.js';
import { native } from './platform.js';
const config = window.APP_CONFIG;
let token = '', expires = 0;
let tokenProvider, refreshPending;
let generation = 0;
let connectionController = new AbortController();
function checkAborted(signal) {
  if (signal?.aborted) throw signal.reason || Object.assign(new Error('요청이 취소되었습니다.'), { name: 'AbortError' });
}
async function limitedRequest(run, { signal, timeout = 15000 } = {}) {
  const controller = new AbortController();
  const signals = [signal, connectionController.signal].filter(Boolean);
  let timer, stop;
  const cancelled = new Promise((_, reject) => {
    stop = reason => { controller.abort(reason); reject(reason); };
    timer = setTimeout(() => stop(Object.assign(new Error('Google 응답 시간이 초과됐어요. 다시 시도해 주세요.'), { name: 'TimeoutError', code: 'timeout', retryable: true })), timeout);
  });
  const abort = () => stop(Object.assign(new Error('Google 연결이 종료되었거나 요청이 취소되었습니다.'), { name: 'AbortError', code: 'cancelled' }));
  for (const source of signals) source.addEventListener('abort', abort, { once: true });
  try {
    if (signals.some(source => source.aborted)) abort();
    return await Promise.race([Promise.resolve().then(() => { checkAborted(controller.signal); return run(controller.signal); }), cancelled]);
  } finally {
    clearTimeout(timer);
    for (const source of signals) source.removeEventListener('abort', abort);
  }
}
const uploads = new Map();
const scripts = new Map();
function script(src) {
  if (!scripts.has(src)) scripts.set(src, new Promise((resolve, reject) => { const el = document.createElement('script'); el.src = src; el.onload = resolve; el.onerror = () => { scripts.delete(src); reject(new Error('Google 연결 스크립트를 불러오지 못했습니다.')); }; document.head.append(el); }));
  return scripts.get(src);
}
async function access(force = false, signal) {
  checkAborted(signal);
  if (!force && token && expires > Date.now()) return token;
  if (!tokenProvider) throw new Error('설정에서 Google을 연결해 주세요.');
  if (!refreshPending) {
    const current = generation;
    const provider = tokenProvider;
    const pending = limitedRequest(signal => provider(force, { signal })).then(result => {
      if (current !== generation) throw new Error('Google 연결이 종료되었습니다.');
      if (!result.access_token || !(Number(result.expires_in) > 0)) throw new Error('Google을 다시 연결해 주세요.');
      token = result.access_token; expires = Date.now() + Math.max(0, Number(result.expires_in) - 30) * 1000;
      return token;
    }).finally(() => { if (refreshPending === pending) refreshPending = undefined; });
    refreshPending = pending;
  }
  // 개별 호출의 취소는 다른 호출이 공유하는 토큰 갱신을 중단하지 않습니다.
  const pending = refreshPending;
  return limitedRequest(() => pending, { signal });
}
async function authorizedFetch(url, options = {}) {
  const current = generation;
  const check = () => { checkAborted(options.signal); if (current !== generation) throw new Error('Google 연결이 종료되었습니다.'); };
  const value = await access(false, options.signal);
  check();
  let response = await fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${value}` } });
  check();
  if (response.status === 401) {
    const stale = token === value;
    let attempted = value;
    if (stale) { token = ''; expires = 0; }
    if (tokenProvider) {
      const refreshed = await access(stale, options.signal);
      check();
      attempted = refreshed;
      response = await fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${refreshed}` } });
      check();
    }
    if (response.status === 401 && token === attempted) { token = ''; expires = 0; }
  }
  return response;
}
async function api(url, options = {}) {
  return limitedRequest(async signal => {
    const response = await authorizedFetch(url, { ...options, signal });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error?.message || `Google 요청 실패 (${response.status})`); }
    return response.status === 204 ? null : response.json();
  }, options);
}
const eventPath = () => { if (!config.calendarId) throw new Error('config.js에 공유 캘린더 ID를 입력해 주세요.'); return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`; };
export const google = {
  setTokenProvider(provider) { tokenProvider = provider; },
  async birthday() {
    let person;
    try { person = await api('https://people.googleapis.com/v1/people/me?personFields=birthdays&sources=READ_SOURCE_TYPE_PROFILE'); }
    catch (error) { throw new Error(`Google 생일을 가져오지 못했어요. 설정에서 Google을 다시 연결하고 생일 권한을 허용해 주세요. (${error.message})`); }
    const entries = person.birthdays || [];
    const date = (entries.find(item => item.metadata?.primary && item.date) || entries.find(item => item.date))?.date;
    if (!date?.year || !date.month || !date.day) throw new Error('Google 계정에서 연도까지 포함된 생일을 찾지 못했어요. Google 계정의 생일을 확인해 주세요.');
    const value = `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
    const parsed = new Date(`${value}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Google 계정의 생일이 올바르지 않아요.');
    return value;
  },
  async restore({ signal } = {}) { await access(false, signal); return true; },
  get connected() { return Boolean(token && (expires > Date.now() || tokenProvider)); },
  async prepare() { if (!native.active && config.googleClientId) await script('https://accounts.google.com/gsi/client'); },
  async acceptNativeToken(value, email) {
    const current = generation;
    const { response, identity } = await limitedRequest(async signal => {
      const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { signal, headers: { Authorization: `Bearer ${value}` } });
      return { response, identity: await response.json() };
    });
    if (current !== generation) throw new Error('Google 연결이 종료되었습니다.');
    if(!response.ok || !identity.email_verified || identity.email?.toLowerCase() !== email.toLowerCase()) throw new Error('Google 계정 확인에 실패했습니다. 다시 연결해 주세요.');
    token = value; expires = Date.now() + 50 * 60 * 1000;
  },
  async connect(email) {
    if (!config.googleClientId) throw new Error('config.js에 Google OAuth 클라이언트 ID를 입력해 주세요.');
    if (!window.google?.accounts) throw new Error('Google 연결을 준비 중입니다. 잠시 후 다시 눌러 주세요.');
    const current = generation;
    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({ client_id: config.googleClientId, scope: 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly', hint: email,
        callback: async result => {
          if (result.error) return reject(new Error('Google 접근 동의를 완료하지 못했습니다.'));
          if (!window.google.accounts.oauth2.hasGrantedAllScopes(result, 'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.readonly')) return reject(new Error('캘린더와 Drive 접근에 모두 동의해 주세요.'));
          try {
            if (current !== generation) throw new Error('Google 연결이 종료되었습니다.');
            const { response, identity } = await limitedRequest(async signal => {
              const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { signal, headers: { Authorization: `Bearer ${result.access_token}` } });
              return { response, identity: await response.json() };
            });
            if (current !== generation) throw new Error('Google 연결이 종료되었습니다.');
            if (!response.ok || identity.email?.toLowerCase() !== email.toLowerCase() || !identity.email_verified) throw new Error('앱에 로그인한 것과 같은 Google 계정을 선택해 주세요.');
            token = result.access_token; expires = Date.now() + (Number(result.expires_in) - 30) * 1000; resolve();
          } catch (error) { reject(error); }
        }, error_callback: () => reject(new Error('Google 연결 창이 닫혔습니다. 다시 시도해 주세요.')) });
      client.requestAccessToken({ prompt: 'select_account' });
    });
  },
  disconnect() { generation++; connectionController.abort(); connectionController = new AbortController(); refreshPending = undefined; token = ''; expires = 0; uploads.clear(); },
  async events(year, month, options = {}) {
    const min = new Date(year, month, -7); const max = new Date(year, month + 1, 14);
    const params = new URLSearchParams({ timeMin: min.toISOString(), timeMax: max.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
    const all = []; let next;
    do { if (next) params.set('pageToken', next); const result = await api(`${eventPath()}?${params}`, options); all.push(...(result.items || []).map(googleEvent).filter(Boolean)); next = result.nextPageToken; } while (next);
    return all;
  },
  async upcomingEvents(today = dateKey(), options = {}) {
    const min = new Date(`${today}T00:00:00`);
    const params = new URLSearchParams({ timeMin: min.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
    const all = []; let next;
    do {
      if (next) params.set('pageToken', next);
      const result = await api(`${eventPath()}?${params}`, options);
      all.push(...(result.items || []).map(googleEvent).filter(row => row && row.data.date >= today));
      next = result.nextPageToken;
    } while (next && all.length < 3);
    return all.slice(0, 3);
  },
  async event(id) {
    return googleEvent(await api(`${eventPath()}/${encodeURIComponent(id)}`));
  },
  async saveEvent(data, id) {
    let start, end;
    if (data.time) {
      const begin = new Date(`${data.date}T${data.time}:00`);
      const finish = data.endDate && data.endTime ? new Date(`${data.endDate}T${data.endTime}:00`) : new Date(begin.getTime() + 3600000);
      if (finish <= begin) throw new Error('종료 시간은 시작 시간보다 뒤여야 합니다.');
      start = { dateTime: begin.toISOString() }; end = { dateTime: finish.toISOString() };
    } else { start = { date: data.date }; end = { date: data.endDate ? nextDay(data.endDate) : nextDay(data.date) }; if (end.date <= data.date) throw new Error('종료 날짜를 확인해 주세요.'); }
    return api(`${eventPath()}${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary: data.title, description: data.text || '', start, end, extendedProperties: { shared: { geonjukongTarget: data.target || 'shared' } } }) });
  },
  async deleteEvent(id) { await api(`${eventPath()}/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async pickFolder() {
    await access(); if (!config.googleApiKey || !config.googleProjectNumber) throw new Error('Google Picker용 API 키와 프로젝트 번호를 config.js에 입력해 주세요.');
    await script('https://apis.google.com/js/api.js');
    await new Promise((resolve, reject) => window.gapi.load('picker', { callback: resolve, onerror: () => reject(new Error('폴더 선택기를 불러오지 못했습니다.')) }));
    return new Promise((resolve, reject) => {
      const pickerApi = window.google.picker;
      const view = new pickerApi.DocsView(pickerApi.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true);
      new pickerApi.PickerBuilder().addView(view).setOAuthToken(token).setDeveloperKey(config.googleApiKey).setAppId(config.googleProjectNumber).setOrigin(location.origin).setCallback(result => {
        if (result.action === pickerApi.Action.PICKED) resolve(result.docs[0]);
        if (result.action === pickerApi.Action.CANCEL) reject(new Error('폴더 선택을 취소했습니다.'));
      }).build().setVisible(true);
    });
  },
  async pickPhoto(id) {
    await access();
    if (!config.googleApiKey || !config.googleProjectNumber) throw new Error('사진 선택을 위해 Google Picker API 키와 프로젝트 번호를 설정해 주세요.');
    await script('https://apis.google.com/js/api.js');
    await new Promise((resolve, reject) => window.gapi.load('picker', { callback: resolve, onerror: () => reject(new Error('사진 선택기를 불러오지 못했어요.')) }));
    return new Promise((resolve, reject) => {
      const pickerApi = window.google.picker;
      const view = new pickerApi.DocsView(pickerApi.ViewId.DOCS).setFileIds(id);
      new pickerApi.PickerBuilder().addView(view).setOAuthToken(token).setDeveloperKey(config.googleApiKey).setAppId(config.googleProjectNumber).setOrigin(location.origin).setTitle('미리 볼 사진을 선택해 주세요').setCallback(result => {
        if (result.action === pickerApi.Action.PICKED) {
          if (result.docs?.some(file => file.id === id)) resolve();
          else reject(new Error('해당 사진을 선택해 주세요.'));
        }
        if (result.action === pickerApi.Action.CANCEL) reject(new Error('사진 선택을 취소했어요.'));
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
    const response = await authorizedFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, { signal });
    if (!response.ok) {
      const error = new Error('Drive 사진을 불러오지 못했어요. Google 연결과 파일 권한을 확인해 주세요.');
      error.status = response.status;
      if (response.status === 403) {
        const details = await response.json().catch(() => ({}));
        if (details.error?.errors?.some(item => ['rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded'].includes(item.reason))) error.code = 'rate_limit';
      }
      throw error;
    }
    const blob = await response.blob();
    if (!/^image\/(jpeg|png|webp|gif|heic|heif|avif)$/i.test(blob.type) || !blob.size) { const error = new Error('미리볼 수 있는 사진이 아니에요. 원본 열기를 이용해 주세요.'); error.code = 'invalid_image'; throw error; }
    return blob;
  },
  async video(id, signal) {
    const response = await authorizedFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, { signal });
    if (!response.ok) {
      const error = new Error('영상을 불러오지 못했어요. Google 연결과 Drive 공유 권한을 확인해 주세요.');
      error.status = response.status; throw error;
    }
    const blob = await response.blob();
    if (!/^video\/(mp4|quicktime|webm|3gpp|x-m4v)$/i.test(blob.type) || !blob.size) throw new Error('재생할 수 있는 영상이 아니에요. 원본 열기를 이용해 주세요.');
    return blob;
  },
  async upload(file, progress) {
    const signal = connectionController.signal;
    safeFileType(file); await access(false, signal);
    if (!config.driveFolderId) throw new Error('공유 Drive 폴더를 먼저 설정해 주세요.');
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    let upload = uploads.get(key);
    if (!upload) {
      const url = await limitedRequest(async signal => {
        const response = await authorizedFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink', { signal, method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Upload-Content-Type': file.type, 'X-Upload-Content-Length': String(file.size) }, body: JSON.stringify({ name: file.name, parents: [config.driveFolderId] }) });
        if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error?.message || 'Drive 업로드를 시작하지 못했습니다.'); }
        const url = response.headers.get('Location'); if (!url) throw new Error('업로드 세션을 받지 못했습니다.');
        return url;
      }, { signal });
      upload = { url, offset: 0 }; uploads.set(key, upload);
    } else {
      const { status, result } = await limitedRequest(async signal => {
        const status = await authorizedFetch(upload.url, { signal, method: 'PUT', headers: { 'Content-Range': `bytes */${file.size}` } });
        return { status, result: status.ok ? await status.json() : null };
      }, { signal });
      if (status.ok) { uploads.delete(key); return { ...result, source: 'drive', type: file.type, size: file.size }; }
      if (status.status !== 308) { uploads.delete(key); throw new Error('업로드 세션이 만료되었습니다. 다시 저장해 주세요.'); }
      upload.offset = Number(status.headers.get('Range')?.split('-')[1] ?? -1) + 1;
    }
    while (upload.offset < file.size) {
      const end = Math.min(upload.offset + 4 * 1024 * 1024, file.size);
      // 대용량 전송은 조회보다 오래 기다리되 응답과 본문 수신 모두 유한하게 제한합니다.
      const { response, result } = await limitedRequest(async signal => {
        const response = await authorizedFetch(upload.url, { signal, method: 'PUT', headers: { 'Content-Type': file.type, 'Content-Range': `bytes ${upload.offset}-${end - 1}/${file.size}` }, body: file.slice(upload.offset, end) });
        if (!response.ok && response.status !== 308) throw new Error('업로드가 중단되었습니다. 화면을 유지한 채 다시 저장하면 이어서 전송합니다.');
        return { response, result: response.ok ? await response.json() : null };
      }, { signal, timeout: 120000 });
      if (response.status === 308) {
        const offset = Number(response.headers.get('Range')?.split('-')[1] ?? -1) + 1;
        if (!Number.isInteger(offset) || offset <= upload.offset || offset > end) throw new Error('업로드가 진행되지 않았어요. 네트워크를 확인한 뒤 다시 저장해 주세요.');
        upload.offset = offset; progress(Math.round(upload.offset / file.size * 100)); continue;
      }
      uploads.delete(key); progress(100); return { ...result, source: 'drive', type: file.type, size: file.size };
    }
    throw new Error('업로드 완료를 확인하지 못했습니다. 다시 저장해 주세요.');
  },
  async openFile(id) {
    // 상대방의 파일에 drive.file 승인이 없어도 Drive 뷰어에서 공유 권한으로 열 수 있습니다.
    const url = `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
    if(native.active)await native.open(url);else window.open(url, '_blank', 'noopener,noreferrer');
  }
};
