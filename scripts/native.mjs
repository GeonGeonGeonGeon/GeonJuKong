import { access,readFile,writeFile,copyFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { configureNativeProject } from './native-projects.mjs';
const root=new URL('../',import.meta.url);
const args=process.argv.slice(2);
async function exists(file){try{await access(file);return true;}catch{return false;}}
async function run(file,parameters){
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--preserve-symlinks','--preserve-symlinks-main',file,...parameters],{cwd:fileURLToPath(root),stdio:'inherit'});
    child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`${file} 종료 코드 ${code}`)));
  });
}
try{
  const target=args[0]==='apk'?'android':args[0];if(!['android','ios','bundle'].includes(target))throw new Error('사용법: npm run native:android, npm run native:apk 또는 npm run native:ios');
  if(target==='ios'&&process.platform!=='darwin')throw new Error('iOS 프로젝트 생성·빌드는 macOS와 Xcode가 필요합니다. 이 소스를 Mac으로 옮겨 npm install 후 npm run native:ios를 실행하세요.');
  const cli=new URL('node_modules/@capacitor/cli/bin/capacitor',root);
  if(!await exists(cli)||!await exists(new URL('node_modules/esbuild/package.json',root)))throw new Error('네이티브 의존성이 없습니다. 네트워크가 허용된 환경에서 npm install --cache .npm-cache 를 실행하세요.');
  await run(fileURLToPath(new URL('scripts/build.mjs',root)),[]);
  const {build}=await import('esbuild');
  await build({entryPoints:[fileURLToPath(new URL('src/native-entry.js',root))],outfile:fileURLToPath(new URL('dist/src/native-entry.js',root)),bundle:true,format:'esm',platform:'browser',target:'es2022',charset:'utf8'});
  const index=new URL('dist/index.html',root);
  const html=(await readFile(index,'utf8')).replace('src="./src/app.js"','src="./src/native-entry.js"').replace('viewport-fit=cover','viewport-fit=cover, interactive-widget=resizes-content');
  await writeFile(index,html);
  if(target==='bundle'){console.log('네이티브 웹 자산 번들 생성 완료');process.exit(0);}
  if(!await exists(new URL(`${target}/`,root)))await run(fileURLToPath(cli),['add',target]);
  await configureNativeProject(root,target);
  await run(fileURLToPath(cli),['sync',target]);
  if(args[0]==='apk'){
    await new Promise((resolve,reject)=>{
      const windows=process.platform==='win32';
      const child=spawn(windows?'cmd.exe':'./gradlew',windows?['/d','/c','gradlew.bat','assembleDebug']:['assembleDebug'],{cwd:fileURLToPath(new URL('android/',root)),stdio:'inherit'});
      child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`APK 빌드 실패 (${code}). Android SDK와 Android Studio의 JDK 설정을 확인하세요.`)));
    });
    await copyFile(new URL('android/app/build/outputs/apk/debug/app-debug.apk',root),new URL('android/app/build/outputs/apk/debug/건주콩.apk',root));
    console.log('테스트 설치 APK: android/app/build/outputs/apk/debug/건주콩.apk');
  }
  console.log(target==='android'?'Android 프로젝트 준비 완료. Android Studio에서 android/를 열어 APK를 빌드하세요.':'iOS 프로젝트 준비 완료. Xcode에서 ios/App/App.xcworkspace를 열고 서명 후 실행하세요.');
}catch(error){console.error(error.message);process.exitCode=1;}
