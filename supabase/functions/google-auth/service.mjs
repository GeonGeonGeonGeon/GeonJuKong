const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const base64 = value => btoa(String.fromCharCode(...new Uint8Array(value)));
async function key(secret) {
  const raw = bytes(secret);
  if (raw.length !== 32) throw new Error('Invalid encryption key');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function seal(value, secret, userId) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(userId) }, await key(secret), new TextEncoder().encode(value));
  return `${base64(iv)}.${base64(ciphertext)}`;
}
export async function unseal(value, secret, userId) {
  const [iv, ciphertext] = value.split('.');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv), additionalData: new TextEncoder().encode(userId) }, await key(secret), bytes(ciphertext));
  return new TextDecoder().decode(plain);
}
export async function refreshGoogle(refreshToken, clientId, clientSecret, request = fetch) {
  const response = await request('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }) });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error === 'invalid_grant' ? 'Google 권한이 만료되거나 취소되었습니다. 다시 연결해 주세요.' : 'Google 연결을 갱신하지 못했습니다. 잠시 후 다시 시도해 주세요.'); error.invalidGrant = data.error === 'invalid_grant'; throw error; }
  if (!data.access_token || !(Number(data.expires_in) > 0)) throw new Error('Invalid Google response');
  return data;
}
export async function verifyGoogle(token, email, request = fetch) {
  const response = await request('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token}` } });
  const identity = await response.json();
  if (!response.ok || identity.email_verified !== true || identity.email?.toLowerCase() !== email.toLowerCase()) throw new Error('Google 계정이 로그인 계정과 일치하지 않습니다.');
}
