import { mkdir, copyFile, readdir, stat } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
async function copy(source,target){await mkdir(target,{recursive:true});for(const entry of await readdir(source)){const src=new URL(entry,source);const dst=new URL(entry,target);if((await stat(src)).isDirectory())await copy(new URL(`${entry}/`,source),new URL(`${entry}/`,target));else await copyFile(src,dst);}}
await mkdir(new URL('dist/',root),{recursive:true});
for(const file of ['index.html','styles.css','config.js','sw.js','manifest.webmanifest','_headers'])await copyFile(new URL(file,root),new URL(`dist/${file}`,root));
for(const dir of ['src','icons'])await copy(new URL(`${dir}/`,root),new URL(`dist/${dir}/`,root));
console.log('dist/에 정적 배포 파일 생성 완료. config.js에는 공개 키만 포함하세요.');
