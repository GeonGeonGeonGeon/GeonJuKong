// 의존성 없이 PWA용 원본 PNG 아이콘을 생성합니다.
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const crc32 = buffer => { let crc = 0xffffffff; for(const byte of buffer){crc ^= byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0; };
function chunk(type,data){const label=Buffer.from(type);const length=Buffer.alloc(4);length.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([label,data])));return Buffer.concat([length,label,data,crc]);}
export function png(size,maskable=false){
  const raw=Buffer.alloc(size*(size*4+1));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const position=y*(size*4+1)+1+x*4;const px=(x-size/2)/(size*.245),py=-(y-size*.47)/(size*.245);
    const heart=(px*px+py*py-1)**3-px*px*py**3<=0;
    const radius=size*.24;const dx=Math.max(radius-x,0,x-(size-radius));const dy=Math.max(radius-y,0,y-(size-radius));const rounded=maskable||dx*dx+dy*dy<=radius*radius;
    raw.set(heart?[246,217,189,255]:[54,87,73,rounded?255:0],position);
  }
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  await mkdir(new URL('../icons/',import.meta.url),{recursive:true});
  for(const[name,size,maskable]of[['icon-192.png',192,false],['icon-512.png',512,false],['maskable-512.png',512,true],['apple-touch-icon.png',180,false]])await writeFile(new URL(`../icons/${name}`,import.meta.url),png(size,maskable));
  console.log('PWA 아이콘 4개 생성 완료');
}
