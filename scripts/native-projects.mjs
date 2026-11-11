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
    await mkdir(new URL('drawable-nodpi/',res),{recursive:true});
    await writeFile(new URL('drawable-nodpi/geonjukong_icon_art.png',res),png(432,true));
    await writeFile(new URL('drawable/geonjukong_foreground.xml',res),'<bitmap xmlns:android="http://schemas.android.com/apk/res/android" android:src="@drawable/geonjukong_icon_art" android:gravity="fill" />');
    await writeFile(new URL('values/geonjukong_colors.xml',res),'<resources><color name="geonjukong_background">#f4eddb</color></resources>');
    for(const name of ['ic_launcher.xml','ic_launcher_round.xml'])await writeFile(new URL(`mipmap-anydpi-v26/${name}`,res),'<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/geonjukong_background"/><foreground android:drawable="@drawable/geonjukong_foreground"/></adaptive-icon>');
  }else{
    const delegate = new URL('ios/App/App/AppDelegate.swift', root);
    const storyboard = new URL('ios/App/App/Base.lproj/Main.storyboard', root);
    const picker = iosMediaPickerProject(await readFile(delegate, 'utf8'), await readFile(storyboard, 'utf8'), await readFile(new URL('./ios-media-picker.swift', import.meta.url), 'utf8'));
    await writeFile(delegate, iosAppBadgeProject(picker.delegate, await readFile(new URL('./ios-app-badge.swift', import.meta.url), 'utf8')));
    await writeFile(storyboard, picker.storyboard);
    const plist=new URL('ios/App/App/Info.plist',root);await writeFile(plist,iosCallbackPlist(await readFile(plist,'utf8')));
    const privacy=new URL('ios/App/PrivacyInfo.xcprivacy',root);
    let privacySource = '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>NSPrivacyAccessedAPITypes</key><array><dict><key>NSPrivacyAccessedAPIType</key><string>NSPrivacyAccessedAPICategoryFileTimestamp</string><key>NSPrivacyAccessedAPITypeReasons</key><array><string>C617.1</string></array></dict></array></dict></plist>';
    try { privacySource = await readFile(privacy, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await writeFile(privacy, iosMediaPickerPrivacy(privacySource));
    const project = new URL('ios/App/App.xcodeproj/project.pbxproj', root);
    await writeFile(project, iosMediaPickerPrivacyProject(await readFile(project, 'utf8')));
    const dir=new URL('ios/App/App/Assets.xcassets/AppIcon.appiconset/',root);await access(dir);
    await writeFile(new URL('AppIcon-512@2x.png',dir),png(1024));
    await writeFile(new URL('Contents.json',dir),JSON.stringify({images:[{filename:'AppIcon-512@2x.png',idiom:'universal',platform:'ios',size:'1024x1024'}],info:{author:'xcode',version:1}},null,2));
  }
}

export function iosMediaPickerPrivacy(xml) {
  if (xml.includes('<string>NSPrivacyAccessedAPICategoryUserDefaults</string>')) return xml;
  const entry = '<dict><key>NSPrivacyAccessedAPIType</key><string>NSPrivacyAccessedAPICategoryUserDefaults</string><key>NSPrivacyAccessedAPITypeReasons</key><array><string>CA92.1</string></array></dict>';
  const list = /(<key>NSPrivacyAccessedAPITypes<\/key>\s*)<array\s*(\/>|>)/;
  if (list.test(xml)) return xml.replace(list, (_, key, end) => `${key}<array>${entry}${end === '/>' ? '</array>' : ''}`);
  if (xml.includes('<key>NSPrivacyAccessedAPITypes</key>') || !/<\/dict>\s*<\/plist>/.test(xml)) throw new Error('iOS 개인정보 API 선언 형식을 확인해 주세요.');
  return xml.replace(/<\/dict>\s*<\/plist>/, `<key>NSPrivacyAccessedAPITypes</key><array>${entry}</array></dict></plist>`);
}

export function iosMediaPickerPrivacyProject(project) {
  if (project.includes('PrivacyInfo.xcprivacy in Resources')) return project;
  const resources = /(isa = PBXResourcesBuildPhase;[\s\S]*?files = \()/;
  if (!project.includes('/* End PBXBuildFile section */') || !project.includes('/* End PBXFileReference section */') || !resources.test(project)) throw new Error('iOS 개인정보 선언을 포함할 Resources 단계를 찾지 못했어요.');
  const file = 'A9370BC3C2E84F02A7B4D931', build = 'A9370BC3C2E84F02A7B4D932';
  return project
    .replace('/* End PBXBuildFile section */', `\t\t${build} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${file} /* PrivacyInfo.xcprivacy */; };\n/* End PBXBuildFile section */`)
    .replace('/* End PBXFileReference section */', `\t\t${file} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = SOURCE_ROOT; };\n/* End PBXFileReference section */`)
    .replace(resources, `$1\n\t\t\t\t${build} /* PrivacyInfo.xcprivacy in Resources */,`);
}

export function iosMediaPickerProject(delegate, storyboard, source) {
  const original = /customClass="CAPBridgeViewController" customModule="Capacitor"/;
  const custom = 'customClass="OrderedMediaViewController" customModule="App" customModuleProvider="target"';
  if (!original.test(storyboard) && !storyboard.includes(custom)) throw new Error('iOS Main.storyboard에서 사진 선택기를 연결할 ViewController를 찾지 못했어요.');
  const clean = delegate.replace(/\r?\n\/\/ BEGIN ORDERED MEDIA PICKER\r?\n[\s\S]*?\/\/ END ORDERED MEDIA PICKER\r?\n?/, '').trimEnd();
  return {
    delegate: `${clean}\n\n// BEGIN ORDERED MEDIA PICKER\n${source.trimEnd()}\n// END ORDERED MEDIA PICKER\n`,
    storyboard: storyboard.replace(original, custom)
  };
}

export function iosAppBadgeProject(delegate, source) {
  const registration = 'bridge?.registerPluginInstance(AppBadgePlugin())';
  let clean = delegate.replace(/\r?\n\/\/ BEGIN APP BADGE\r?\n[\s\S]*?\/\/ END APP BADGE\r?\n?/, '').trimEnd();
  if (!clean.includes(registration)) {
    const hook = /override func capacitorDidLoad\(\) \{/;
    if (!hook.test(clean)) throw new Error('iOS 앱 배지를 등록할 ViewController를 찾지 못했어요.');
    clean = clean.replace(hook, match => `${match}\n        ${registration}`);
  }
  return `${clean}\n\n// BEGIN APP BADGE\n${source.trimEnd()}\n// END APP BADGE\n`;
}
