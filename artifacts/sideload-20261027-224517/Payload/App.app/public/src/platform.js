export const NATIVE_CALLBACK = 'com.geonjukong.couple://auth/callback';
export function isAuthCallback(value) {
  try { const url = new URL(value); return url.protocol === 'com.geonjukong.couple:' && url.hostname === 'auth' && url.pathname === '/callback' && !url.username && !url.password; } catch { return false; }
}
export const native = {
  get active() { return Boolean(window.GEONJUKONG_NATIVE?.active); },
  async open(url) { if (!this.active) throw new Error('설치형 앱에서만 사용할 수 있습니다.'); await window.GEONJUKONG_NATIVE.open(url); },
  async closeBrowser() { if (this.active) await window.GEONJUKONG_NATIVE.closeBrowser(); },
  async saveFile(blob, name) { if (!this.active) throw new Error('설치형 앱에서만 사용할 수 있습니다.'); await window.GEONJUKONG_NATIVE.saveFile(blob, name); },
  async listen(handler) { return this.active ? window.GEONJUKONG_NATIVE.listen(handler) : undefined; }
};
