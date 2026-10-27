import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { png } from './icons.mjs';

export function androidCallbackManifest(xml) {
  if(xml.includes('android:scheme="com.geonjukong.couple"'))return xml;
  const filter=`\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="com.geonjukong.couple" android:host="auth" android:path="/callback" />\n            </intent-filter>\n`;
  const activity=/(<activity\b[^>]*android:name="(?:\.MainActivity|com\.geonjukong\.couple\.MainActivity)"[^>]*>)([\s\S]*?)(<\/activity>)/;
  if(!activity.test(xml))throw new Error('MainActivity를 찾을 수 없습니다. AndroidManifest.xml을 확인해 주세요.');
  return xml.replace(activity,(_,open,body,close)=>`${open}${body}${filter}${close}`);
}
export function iosCallbackPlist(xml) {
  if(xml.includes('<string>com.geonjukong.couple</string>'))return xml;
  if(xml.includes('<key>CFBundleURLTypes</key>'))throw new Error('기존 iOS URL scheme이 있습니다. 충돌을 검토하고 앱 콜백 scheme을 직접 병합해 주세요.');
  const entry=`\n\t<key>CFBundleURLTypes</key>\n\t<array><dict><key>CFBundleURLName</key><string>com.geonjukong.couple</string><key>CFBundleURLSchemes</key><array><string>com.geonjukong.couple</string></array></dict></array>\n`;
  if(!/<\/dict>\s*<\/plist>/.test(xml))throw new Error('iOS Info.plist 형식이 올바르지 않습니다.');
  return xml.replace(/<\/dict>\s*<\/plist>/,`${entry}</dict>\n</plist>`);
}
export async function configureNativeProject(root, platform) {
  if(platform==='android'){
    const manifest=new URL('android/app/src/main/AndroidManifest.xml',root);
    await writeFile(manifest,androidCallbackManifest(await readFile(manifest,'utf8')));
    const res=new URL('android/app/src/main/res/',root);
    for(const[density,size]of[['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]){
      const dir=new URL(`mipmap-${density}/`,res);await mkdir(dir,{recursive:true});
      for(const name of ['ic_launcher.png','ic_launcher_round.png'])await writeFile(new URL(name,dir),png(size));
    }
    await mkdir(new URL('drawable/',res),{recursive:true});await mkdir(new URL('values/',res),{recursive:true});await mkdir(new URL('mipmap-anydpi-v26/',res),{recursive:true});
    await writeFile(new URL('drawable/geonjukong_foreground.xml',res),'<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#f6d9bd" android:pathData="M54,75 C47,69 28,56 28,43 C28,27 47,24 54,38 C61,24 80,27 80,43 C80,56 61,69 54,75 Z" /></vector>');
    await writeFile(new URL('values/geonjukong_colors.xml',res),'<resources><color name="geonjukong_background">#365749</color></resources>');
    for(const name of ['ic_launcher.xml','ic_launcher_round.xml'])await writeFile(new URL(`mipmap-anydpi-v26/${name}`,res),'<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/geonjukong_background"/><foreground android:drawable="@drawable/geonjukong_foreground"/></adaptive-icon>');
  }else{
    const plist=new URL('ios/App/App/Info.plist',root);await writeFile(plist,iosCallbackPlist(await readFile(plist,'utf8')));
    const privacy=new URL('ios/App/PrivacyInfo.xcprivacy',root);
    try { await access(privacy); } catch { await writeFile(privacy,'<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>NSPrivacyAccessedAPITypes</key><array><dict><key>NSPrivacyAccessedAPIType</key><string>NSPrivacyAccessedAPICategoryFileTimestamp</string><key>NSPrivacyAccessedAPITypeReasons</key><array><string>C617.1</string></array></dict></array></dict></plist>'); }
    const dir=new URL('ios/App/App/Assets.xcassets/AppIcon.appiconset/',root);await access(dir);
    await writeFile(new URL('AppIcon-512@2x.png',dir),png(1024,true));
    await writeFile(new URL('Contents.json',dir),JSON.stringify({images:[{filename:'AppIcon-512@2x.png',idiom:'universal',platform:'ios',size:'1024x1024'}],info:{author:'xcode',version:1}},null,2));
  }
}
