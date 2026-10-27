import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('정적 서버는 앱과 PWA 자산을 제공하고 프로젝트 내부 문서는 노출하지 않는다',async()=>{
  const child=spawn(process.execPath,['--preserve-symlinks','--preserve-symlinks-main','scripts/serve.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,PORT:'4174'},stdio:['ignore','pipe','pipe']});
  try{
    await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(new Error(`서버 종료 ${code}`)));});
    for(const file of ['/','/styles.css','/src/app.js','/src/core.js','/src/backend.js','/src/google.js','/src/storage.js','/config.js','/sw.js','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/icons/maskable-512.png','/icons/apple-touch-icon.png'])assert.equal((await fetch(`http://localhost:4174${file}`)).status,200,file);
    const response=await fetch('http://localhost:4174/src/app.js');assert.match(response.headers.get('content-type'),/javascript/);
    for(const file of ['/package.json','/README.md','/supabase/schema.sql','/.git/config','/src/%2e%2e%5cREADME.md'])assert.equal((await fetch(`http://localhost:4174${file}`)).status,404,file);
    assert.equal((await fetch('http://localhost:4174/',{method:'POST'})).status,405);
  }finally{child.kill();}
});
