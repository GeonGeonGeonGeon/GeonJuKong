import { deflateSync, inflateSync } from 'node:zlib';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const source = readFileSync(new URL('../icons/source.png', import.meta.url));
const width = source.readUInt32BE(16), height = source.readUInt32BE(20);
if (source[24] !== 8 || source[25] !== 2 || source[28] !== 0) throw new Error('Expected an 8-bit RGB PNG icon');
const parts = [];
for (let pos = 8; pos < source.length;) {
  const length = source.readUInt32BE(pos), type = source.toString('ascii', pos + 4, pos + 8);
  if (type === 'IDAT') parts.push(source.subarray(pos + 8, pos + 8 + length));
  pos += 12 + length;
}
const raw = inflateSync(Buffer.concat(parts)), stride = width * 3, pixels = Buffer.alloc(stride * height);
for (let y = 0; y < height; y++) {
  const filter = raw[y * (stride + 1)];
  for (let x = 0; x < stride; x++) {
    const i = y * stride + x, a = x >= 3 ? pixels[i - 3] : 0, b = y ? pixels[i - stride] : 0, c = y && x >= 3 ? pixels[i - stride - 3] : 0;
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    const predictor = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : filter === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : NaN;
    if (Number.isNaN(predictor)) throw new Error('Unsupported PNG filter');
    pixels[i] = (raw[y * (stride + 1) + 1 + x] + predictor) & 255;
  }
}
const crc32 = buffer => { let crc = 0xffffffff; for (const byte of buffer) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; };
function chunk(type, data) { const label = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4); length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([label, data]))); return Buffer.concat([length, label, data, crc]); }
export function png(size, maskable = false) {
  const output = Buffer.alloc(size * (size * 3 + 1));
  const scale = maskable ? 0.66 : 1, offset = (1 - scale) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = ((x + 0.5) / size - offset) / scale, sy = ((y + 0.5) / size - offset) / scale;
    const dest = y * (size * 3 + 1) + 1 + x * 3;
    if (sx < 0 || sx >= 1 || sy < 0 || sy >= 1) { output.set([244, 237, 219], dest); continue; }
    const ix = Math.min(width - 1, Math.floor(sx * width)), iy = Math.min(height - 1, Math.floor(sy * height)), src = (iy * width + ix) * 3;
    // The supplied artwork has black outside its rounded corners; fill those corners with paper color.
    if (pixels[src] < 20 && pixels[src + 1] < 20 && pixels[src + 2] < 20) output.set([244, 237, 219], dest);
    else pixels.copy(output, dest, src, src + 3);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(output)), chunk('IEND', Buffer.alloc(0))]);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(new URL('../icons/', import.meta.url), { recursive: true });
  for (const [name, size, maskable] of [['icon-192.png',192,false],['icon-512.png',512,false],['maskable-512.png',512,true],['apple-touch-icon.png',180,false]]) writeFileSync(new URL(`../icons/${name}`, import.meta.url), png(size, maskable));
}
