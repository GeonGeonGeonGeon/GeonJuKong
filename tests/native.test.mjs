import test from 'node:test';
import assert from 'node:assert/strict';
import { androidCallbackManifest,iosCallbackPlist } from '../scripts/native-projects.mjs';
import { isAuthCallback,NATIVE_CALLBACK } from '../src/platform.js';
import { png } from '../scripts/icons.mjs';

test('네이티브 로그인 콜백은 지정한 scheme·host·path만 허용한다',()=>{
  assert.equal(isAuthCallback(`${NATIVE_CALLBACK}?code=test`),true);
  assert.equal(NATIVE_CALLBACK,'com.geonjukong.couple://auth/callback');
  for(const url of ['https://auth/callback?code=test','com.danduri.couple://auth/callback?code=test','com.geonjukong.couple://evil/callback','com.geonjukong.couple://auth/elsewhere','com.geonjukong.couple://attacker@auth/callback','invalid'])assert.equal(isAuthCallback(url),false);
});
test('Android와 iOS 콜백 등록은 반복 적용해도 중복되지 않는다',()=>{
  const manifest='<manifest><application><activity android:name=".MainActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.MAIN" /></intent-filter></activity></application></manifest>';
  const patched=androidCallbackManifest(manifest);assert.match(patched,/android:host="auth" android:path="\/callback"/);assert.equal(androidCallbackManifest(patched),patched);assert.throws(()=>androidCallbackManifest('<manifest/>'),/MainActivity/);
  const plist='<plist><dict><key>CFBundleDisplayName</key><string>단둘이</string></dict></plist>';
  const patchedPlist=iosCallbackPlist(plist);assert.match(patchedPlist,/CFBundleURLSchemes/);assert.equal(iosCallbackPlist(patchedPlist),patchedPlist);
  assert.throws(()=>iosCallbackPlist('<plist><dict><key>CFBundleURLTypes</key><array/></dict></plist>'),/충돌/);
});
test('설치형 앱 아이콘은 요구한 크기의 PNG로 생성된다',()=>{
  const icon=png(1024,true);assert.equal(icon.subarray(1,4).toString(),'PNG');assert.equal(icon.readUInt32BE(16),1024);assert.equal(icon.readUInt32BE(20),1024);
});
test('네이티브 OAuth는 시스템 브라우저와 PKCE 복귀를 사용하고 Google 토큰을 영구 저장하지 않는다',async()=>{
  const values=new Map();let opened,closed=0;
  globalThis.window={APP_CONFIG:{supabaseUrl:'https://test.supabase.co',supabaseAnonKey:'public'},GEONJUKONG_NATIVE:{active:true,open:async url=>{opened=url;},closeBrowser:async()=>{closed++;}}};
  globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  globalThis.sessionStorage={getItem(){throw new Error('Native OAuth must survive process recreation');},setItem(){throw new Error('Native verifier must persist');}};
  globalThis.location={href:'https://localhost/',origin:'https://localhost',pathname:'/',assign(){throw new Error('Do not authenticate inside WebView');}};
  globalThis.history={replaceState(){}};
  const {auth}=await import('../src/backend.js');const originalFetch=globalThis.fetch;
  try{
    await auth.login();const url=new URL(opened);assert.equal(url.searchParams.get('redirect_to'),NATIVE_CALLBACK);assert.equal(url.searchParams.get('code_challenge_method'),'s256');assert.match(url.searchParams.get('scopes'),/calendar.events/);assert.match(url.searchParams.get('scopes'),/drive.file/);assert.equal(values.get('geonjukong-pkce').length,64);
    globalThis.fetch=async(_url,options)=>{assert.equal(JSON.parse(options.body).code_verifier,values.get('geonjukong-pkce'));return Response.json({user:{id:'user',email:'person@example.com'},access_token:'app-token',refresh_token:'app-refresh',expires_in:3600,provider_token:'google-access',provider_refresh_token:'google-refresh'});};
    await auth.callback(`${NATIVE_CALLBACK}?code=authorization-code`);assert.equal(closed,1);assert.equal(values.has('geonjukong-pkce'),false);assert.equal(auth.user.id,'user');
    const persisted=JSON.parse(values.get('geonjukong-auth'));assert.equal(persisted.provider_token,undefined);assert.equal(persisted.provider_refresh_token,undefined);assert.equal(auth.takeProviderToken(),'google-access');assert.equal(auth.takeProviderToken(),undefined);
    await assert.rejects(auth.callback('com.geonjukong.couple://other/callback?code=wrong'),/허용되지 않은/);
  }finally{globalThis.fetch=originalFetch;}
});
