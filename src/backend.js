import { local } from './storage.js';
import { validateRecord } from './core.js';
import { native, isAuthCallback, NATIVE_CALLBACK } from './platform.js';
const config = window.APP_CONFIG;
const SESSION_KEY = 'geonjukong-auth';
export const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
let session;
try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { session = null; }
let refreshPending;
let providerToken;
function setSession(value) { session = value; if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value)); else localStorage.removeItem(SESSION_KEY); }
async function authRequest(path, body) {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/${path}`, { method: 'POST', headers: { apikey: config.supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json(); if (!response.ok) throw new Error(data.msg || data.error_description || '로그인에 실패했습니다.');
  if (data.provider_token) providerToken = data.provider_token;
  const { provider_token, provider_refresh_token, ...appSession } = data;
  setSession({ ...appSession, expires_at: Date.now() + data.expires_in * 1000 }); return data;
}
async function accessToken() {
  if (!session) throw new Error('로그인이 필요합니다.');
  if (session.expires_at < Date.now() + 60000) {
    if (!refreshPending) refreshPending = authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token }).catch(error => { setSession(null); throw error; }).finally(() => { refreshPending = null; });
    await refreshPending;
  }
  return session.access_token;
}
export const auth = {
  get user() { return session?.user || null; },
  takeProviderToken() { const value = providerToken; providerToken = undefined; return value; },
  async callback(callbackUrl) {
    if (callbackUrl && !isAuthCallback(callbackUrl)) throw new Error('허용되지 않은 앱 로그인 주소입니다.');
    const url = new URL(callbackUrl || location.href); const error = url.searchParams.get('error_description');
    if (error) { history.replaceState(null, '', location.pathname); throw new Error(error); }
    const code = url.searchParams.get('code'); if (!code) return;
    const storage = native.active ? localStorage : sessionStorage;
    const verifier = storage.getItem('geonjukong-pkce');
    history.replaceState(null, '', location.pathname);
    if (!verifier) throw new Error('로그인을 시작한 브라우저에서 다시 시도해 주세요.');
    await authRequest('token?grant_type=pkce', { auth_code: code, code_verifier: verifier });
    storage.removeItem('geonjukong-pkce');
    await native.closeBrowser();
  },
  async login() {
    if (!configured) throw new Error('먼저 config.js에 Supabase 공개 설정을 입력해 주세요.');
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const verifier = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    (native.active ? localStorage : sessionStorage).setItem('geonjukong-pkce', verifier);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const url = new URL(`${config.supabaseUrl}/auth/v1/authorize`);
    url.search = new URLSearchParams({ provider: 'google', redirect_to: native.active ? NATIVE_CALLBACK : `${location.origin}${location.pathname}`, code_challenge: challenge, code_challenge_method: 's256' });
    if (native.active) {
      url.searchParams.set('scopes', 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file');
      url.searchParams.set('prompt', 'consent');
      await native.open(url.toString());
    } else location.assign(url);
  },
  async logout() {
    providerToken = undefined;
    if (session) { try { await fetch(`${config.supabaseUrl}/auth/v1/logout`, { method: 'POST', headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${await accessToken()}` } }); } finally { setSession(null); } }
  }
};
async function rest(path, options = {}) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, { ...options, headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...options.headers } });
  if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message || '공유 서버에 연결하지 못했습니다.'); }
  return response.status === 204 ? null : response.json();
}
export const repository = {
  async members() { return rest('members?select=slot,email,display_name'); },
  async list() {
    // 페이지를 끝까지 읽어 오래된 기록을 조용히 누락하지 않습니다.
    const all = []; let offset = 0;
    while (true) { const page = await rest(`records?select=*&order=created_at.asc,id.asc&limit=500&offset=${offset}`); all.push(...page); if (page.length < 500) return all; offset += 500; }
  },
  async save(mode, userId, kind, data, existingId) {
    validateRecord(kind, data);
    if (mode === 'demo') {
      const old = existingId ? (await local.list()).find(r => r.id === existingId) : null;
      if (existingId && (!old || old.author_id !== userId && kind !== 'event')) throw new Error('작성자만 수정할 수 있습니다.');
      const row = { id: existingId || crypto.randomUUID(), kind, author_id: old?.author_id || userId, data, created_at: old?.created_at || new Date().toISOString() };
      await local.put(row); return row;
    }
    const row = { kind, data, author_id: userId, parent_id: kind === 'comment' ? data.postId : null };
    const rows = await rest(existingId ? `records?id=eq.${encodeURIComponent(existingId)}` : 'records', { method: existingId ? 'PATCH' : 'POST', body: JSON.stringify(row) });
    if (!rows?.length) throw new Error('작성자만 수정할 수 있습니다.'); return rows[0];
  },
  async remove(mode, userId, row) {
    if (row.author_id !== userId && row.kind !== 'event') throw new Error('작성자만 삭제할 수 있습니다.');
    if (mode === 'demo') { await local.remove(row.id); for (const r of await local.list()) if (r.kind === 'comment' && r.data.postId === row.id) await local.remove(r.id); }
    else { const rows = await rest(`records?id=eq.${encodeURIComponent(row.id)}`, { method: 'DELETE' }); if (!rows?.length) throw new Error('삭제할 수 없는 기록입니다.'); }
  },
  async readAt() { return rest('message_reads?select=*'); },
  async markRead(userId) { return rest('message_reads?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ user_id: userId, last_read_at: new Date().toISOString() }) }); },
  async subscribe(userId, subscription) { return rest('push_subscriptions?on_conflict=endpoint', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ user_id: userId, endpoint: subscription.endpoint, subscription }) }); },
  async unsubscribe(endpoint) { return rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE' }); },
  async notify(recordId) {
    if (!config.vapidPublicKey) return;
    const response = await fetch(`${config.supabaseUrl}/functions/v1/notify`, {method:'POST',headers:{apikey:config.supabaseAnonKey,Authorization:`Bearer ${await accessToken()}`,'Content-Type':'application/json'},body:JSON.stringify({recordId})});
    if (!response.ok) throw new Error('알림 서버에서 전송을 완료하지 못했습니다.');
  }
};
