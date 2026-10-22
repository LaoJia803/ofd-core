// Node 路径：BMP 解码（1/4/8/24/32 位、BI_RGB 与 RLE8/RLE4）。
import { checkImageSize } from "./xobject.js";

// BMP（含二值 BMP）→ RGBA。支持 1/4/8/24/32 位、BI_RGB 与 RLE8/RLE4 压缩
export function decodeBmp(bytes) {
  if (bytes.length < 26 || bytes[0] !== 0x42 || bytes[1] !== 0x4D) throw new Error('无效 BMP 头');
  const hdrSize = (bytes[14] | (bytes[15] << 8) | (bytes[16] << 16) | (bytes[17] << 24)) >>> 0;
  let w, h, bpp, comp = 0, palSize = 0, palOff;
  if (hdrSize === 12) { // BITMAPCOREHEADER（OS/2 1.x）
    w = bytes[18] | (bytes[19] << 8);
    h = bytes[20] | (bytes[21] << 8);
    bpp = bytes[24] | (bytes[25] << 8);
    palOff = 26;
  } else {
    w = (bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24)) | 0;
    h = (bytes[22] | (bytes[23] << 8) | (bytes[24] << 16) | (bytes[25] << 24)) | 0;
    bpp = bytes[28] | (bytes[29] << 8);
    comp = (bytes[30] | (bytes[31] << 8) | (bytes[32] << 16) | (bytes[33] << 24)) >>> 0;
    palSize = (bytes[46] | (bytes[47] << 8) | (bytes[48] << 16) | (bytes[49] << 24)) >>> 0;
    palOff = 14 + hdrSize;
  }
  if (!w || !h || w > 65536 || h > 65536) throw new Error('无效 BMP 尺寸');
  const topDown = h < 0;
  h = Math.abs(h);
  if (comp > 3) throw new Error('BMP 压缩 ' + comp + ' 不支持');
  checkImageSize(w, h);
  const palette = [];
  if (bpp <= 8) {
    const n = Math.min(palSize || (1 << bpp), (bytes.length - palOff) >> 2);
    for (let i = 0; i < n; i++) {
      palette.push([bytes[palOff + 4 * i + 2], bytes[palOff + 4 * i + 1], bytes[palOff + 4 * i], 255]);
    }
    while (palette.length < (1 << bpp)) palette.push([0, 0, 0, 255]);
  }
  const rgba = new Uint8Array(w * h * 4);
  let hasAlpha = false;
  if ((comp === 1 || comp === 2) && (bpp === 8 || bpp === 4)) {
    // RLE8 / RLE4：先解出每像素索引，再映射调色板
    const idx = new Uint8Array(w * h);
    let pos = (bytes[10] | (bytes[11] << 8) | (bytes[12] << 16) | (bytes[13] << 24)) >>> 0;
    let x = 0, y = 0;
    const put = (v) => { if (x < w && y < h) idx[y * w + x] = v; x++; };
    const nibble = comp === 2;
    while (y < h && pos + 1 < bytes.length) {
      const a = bytes[pos], b = bytes[pos + 1];
      pos += 2;
      if (a === 0) {
        if (b === 0) { x = 0; y++; }
        else if (b === 1) break;
        else if (b === 2) {
          x += bytes[pos]; y += bytes[pos + 1];
          if (x > w) x = w;
          if (y > h) y = h;
          pos += 2;
        } else { // 绝对模式
          let len = b;
          if (nibble) {
            for (let i = 0; i < len; i++) {
              const v = i % 2 === 0 ? bytes[pos] >> 4 : bytes[pos] & 0x0F;
              if (i % 2 === 1) pos++;
              put(v);
            }
            pos += (len + 1) >> 1; // 半字节绝对块按字节对齐
          } else {
            for (let i = 0; i < len; i++) put(bytes[pos + i]);
            pos += len + (len & 1);
          }
        }
      } else {
        const v = bytes[pos];
        pos++;
        if (nibble) { const hi = v >> 4, lo = v & 0x0F; for (let i = 0; i < a; i++) put(hi); for (let i = 0; i < a; i++) put(lo); }
        else { for (let i = 0; i < a; i++) put(v); }
      }
    }
    const row = (yy) => topDown ? yy : h - 1 - yy;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const c = palette[idx[yy * w + xx]];
        const o = (row(yy) * w + xx) * 4;
        rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = c[3];
      }
    }
    return { rgba, w, h, hasAlpha };
  }
  // BI_RGB：逐行解码（每行 4 字节对齐）
  const rowBytes = Math.ceil((w * bpp) / 32) * 4;
  let pos = (bytes[10] | (bytes[11] << 8) | (bytes[12] << 16) | (bytes[13] << 24)) >>> 0;
  if (pos + rowBytes * h > bytes.length) throw new Error('BMP 数据不完整');
  const pick = (x, y, ch) => {
    const yy = topDown ? y : h - 1 - y;
    const base = pos + yy * rowBytes + (x * bpp >> 3);
    const bit = bpp === 1 ? 7 - (x & 7) : bpp === 4 ? (x & 1 ? 0 : 4) : 0;
    return bpp <= 8 ? (bytes[base] >> bit) & ((1 << Math.min(bpp, 8)) - 1) : bytes[base + ch];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (bpp >= 24) { // BGR(A) 存储
        rgba[o] = pick(x, y, 2); rgba[o + 1] = pick(x, y, 1); rgba[o + 2] = pick(x, y, 0);
        rgba[o + 3] = bpp === 32 ? pick(x, y, 3) : 255;
        if (rgba[o + 3] < 255) hasAlpha = true;
      } else {
        const c = palette[pick(x, y, 0)];
        rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = c[3];
      }
    }
  }
  return { rgba, w, h, hasAlpha };
}
