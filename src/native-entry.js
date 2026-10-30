// scripts/native.mjs에서만 번들링하는 설치형 앱 진입점입니다.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

window.GEONJUKONG_NATIVE = {
  active: Capacitor.isNativePlatform(),
  onBack: handler => Capacitor.getPlatform() === 'android' ? App.addListener('backButton', handler) : undefined,
  exit: () => App.exitApp(),
  open: url => Browser.open({ url }),
  closeBrowser: () => Browser.close(),
  async saveFile(blob, name) {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.')); reader.readAsDataURL(blob);
    });
    const filename = name.replace(/[\\/\u0000-\u001f]/g, '_').slice(-160) || 'original';
    const path = `exports/${Date.now()}-${filename}`;
    const saved = await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache, recursive: true });
    await Share.share({ title: filename, url: saved.uri, dialogTitle: '원본 파일 저장 또는 공유' });
  },
  async listen(handler) {
    await App.addListener('appUrlOpen', ({ url }) => handler(url));
    const launch = await App.getLaunchUrl();
    return launch?.url;
  }
};
await import('./app.js');
