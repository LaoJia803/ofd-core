// Node 路径：PNG 解码（8/16 位、灰/真彩/调色板/RGBA、tRNS）。
import { checkImageSize } from "./xobject.js";

// Node：PNG 解码为 RGB（支持 8/16 位、灰/真彩/调色板/RGBA），返回 { rgb, w, h }
export function decodePng(bytes, zlib) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) throw new Error('非 PNG 图像');
  const readU32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  let pos = 8, w = 0, h = 0, bitDepth = 8, colorType = 2, interlace = 0;
  let palette = null, trns = null;
  const idat = [];
  while (pos + 8 <= bytes.length) {
    const len = readU32(bytes, pos);
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    const data = bytes.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === 'IHDR') {
      w = readU32(data, 0); h = readU32(data, 4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'tRNS') {
      trns = data;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }
  if (interlace !== 0) throw new Error('PNG 隔行扫描不支持');
  if (bitDepth !== 8 && bitDepth !== 16) throw new Error('PNG 位深 ' + bitDepth + ' 不支持');
  if ([0, 2, 3, 4, 6].indexOf(colorType) < 0) throw new Error('PNG 颜色类型 ' + colorType + ' 不支持');
  checkImageSize(w, h);
  let all = new Uint8Array(idat.reduce((s, d) => s + d.length, 0));
  let off = 0;
  for (const d of idat) { all.set(d, off); off += d.length; }
  all = new Uint8Array(zlib.inflateSync(Buffer.from(all)));
  const ch = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : 4;
  const depthBytes = bitDepth === 16 ? 2 : 1;
  const bpp = ch * depthBytes;
  const rowBytes = w * ch * depthBytes;
  const recon = new Uint8Array(h * rowBytes);
  let prev = new Uint8Array(rowBytes);
  let src = 0;
  for (let y = 0; y < h; y++) {
    const f = all[src++];
    const row = recon.subarray(y * rowBytes, (y + 1) * rowBytes);
    for (let x = 0; x < rowBytes; x++) {
      const left = x >= bpp ? row[x - bpp] : 0;
      const up = prev[x];
      const ul = x >= bpp ? prev[x - bpp] : 0;
      let v = all[src++];
      if (f === 1) v += left;
      else if (f === 2) v += up;
      else if (f === 3) v += (left + up) >> 1;
      else if (f === 4) {
        const p = left + up - ul;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - ul);
        v += (pa <= pb && pa <= pc) ? left : (pb <= pc ? up : ul);
      }
      row[x] = v & 0xff;
    }
    prev = row;
  }
  // 展平为 RGBA（4 字节/像素），无透明像素时 hasAlpha=false（无需 SMask）
  const rgba = new Uint8Array(w * h * 4);
  let hasAlpha = false;
  // tRNS 透明色：灰/真彩单值匹配（8 位样本 = 16 位值/257；16 位样本取高字节）
  const u16 = o => (trns[o] << 8) | trns[o + 1];
  const grayKey = trns ? (bitDepth === 16 ? u16(0) >> 8 : Math.round(u16(0) / 257)) : -1;
  const rgbKey = trns && colorType === 2 ? [u16(0), u16(2), u16(4)].map(v => bitDepth === 16 ? v >> 8 : Math.round(v / 257)) : null;
  let o = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const base = y * rowBytes + x * bpp;
      let r, g, b, a = 255;
      if (colorType === 3) {
        const idx = recon[base];
        r = palette ? palette[idx * 3] : idx;
        g = palette ? palette[idx * 3 + 1] : idx;
        b = palette ? palette[idx * 3 + 2] : idx;
        if (trns) a = trns[idx] !== undefined ? trns[idx] : 255;
      } else if (colorType === 0) {
        r = g = b = recon[base];
        if (trns && recon[base] === grayKey) a = 0;
      } else if (colorType === 2) {
        r = recon[base]; g = recon[base + depthBytes]; b = recon[base + 2 * depthBytes];
        if (rgbKey && r === rgbKey[0] && g === rgbKey[1] && b === rgbKey[2]) a = 0;
      } else if (colorType === 4) {
        r = g = b = recon[base];
        a = recon[base + depthBytes];
      } else {
        r = recon[base]; g = recon[base + depthBytes]; b = recon[base + 2 * depthBytes];
        a = recon[base + 3 * depthBytes];
      }
      rgba[o++] = r; rgba[o++] = g; rgba[o++] = b; rgba[o++] = a;
      if (a < 255) hasAlpha = true;
    }
  }
  return { rgba, w, h, hasAlpha };
}
