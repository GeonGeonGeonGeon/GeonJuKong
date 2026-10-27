import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const files=['config.js','sw.js'];
for(const dir of ['src','scripts'])for(const file of await readdir(new URL(`../${dir}/`,import.meta.url)))if(/\.(mjs|js)$/.test(file))files.push(`${dir}/${file}`);
for(const file of files){const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:await readFile(new URL(`../${file}`,import.meta.url),'utf8'),encoding:'utf8'});if(result.status!==0){console.error(`${file}\n${result.stderr}`);process.exit(1);}}
for(const file of ['package.json','manifest.webmanifest','capacitor.config.json'])JSON.parse(await readFile(new URL(`../${file}`,import.meta.url),'utf8'));
console.log('JavaScript 구문 및 JSON 검사 통과');
