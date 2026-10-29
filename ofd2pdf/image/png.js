// Node 路径：PNG 解码（8/16 位、灰/真彩/调色板/RGBA、tRNS、Adam7 隔行）。
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
  if (interlace !== 0 && interlace !== 1) throw new Error('PNG 隔行方式 ' + interlace + ' 不支持');
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
  // 逐行反滤波：按行解出该子图（pass）的原始字节，返回数据与下一个读取位置
  const readScanlines = (src, pw, ph, passRowBytes) => {
    const buf = new Uint8Array(ph * passRowBytes);
    let prev = new Uint8Array(passRowBytes);
    for (let y = 0; y < ph; y++) {
      const f = all[src++];
      const row = buf.subarray(y * passRowBytes, (y + 1) * passRowBytes);
      for (let x = 0; x < passRowBytes; x++) {
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
    return { buf, next: src };
  };
  if (interlace === 0) {
    const r = readScanlines(0, w, h, rowBytes);
    recon.set(r.buf);
  } else {
    // Adam7：7 个子图按 (x0,y0,dx,dy) 拆分，逐个子图反滤波后回填到完整图
    const PASSES = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
    let src = 0;
    for (const ps of PASSES) {
      const x0 = ps[0], y0 = ps[1], dx = ps[2], dy = ps[3];
      const pw = Math.ceil((w - x0) / dx), ph = Math.ceil((h - y0) / dy);
      if (pw <= 0 || ph <= 0) continue; // 该子图没有像素
      const passRowBytes = pw * bpp;
      const r = readScanlines(src, pw, ph, passRowBytes);
      src = r.next;
      for (let py = 0; py < ph; py++) {
        const rowOff = (y0 + py * dy) * rowBytes;
        const pOff = py * passRowBytes;
        for (let px = 0; px < pw; px++) {
          const o = rowOff + (x0 + px * dx) * bpp;
          const po = pOff + px * bpp;
          for (let k = 0; k < bpp; k++) recon[o + k] = r.buf[po + k];
        }
      }
    }
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
