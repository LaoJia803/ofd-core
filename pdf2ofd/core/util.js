// 常量与基础工具。
export const PT_TO_MM = 25.4 / 72; // 1pt = 0.3527778mm

export function matMul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

// 把 pdf.js 解码后的图像统一转成 RGBA：
//   kind 1 = 灰度 2 = RGB 3 = RGBA（旧实现只认 3，RGB/灰度图会被整块丢弃）
export function imageToRgba(img) {
  if (!img || !img.width || !img.height) return null;
  const n = img.width * img.height;
  const src = img.data;
  if (!src) return null;
  if (img.kind === 3) {
    if (src.length < n * 4) return null;
    return new Uint8Array(src.buffer, src.byteOffset, n * 4);
  }
  if (img.kind === 2) {
    if (src.length < n * 3) return null;
    const out = Buffer.alloc(n * 4);
    for (let i = 0, o = 0; i < n; i++) {
      out[o++] = src[i * 3];
      out[o++] = src[i * 3 + 1];
      out[o++] = src[i * 3 + 2];
      out[o++] = 255;
    }
    return out;
  }
  if (img.kind === 1) {
    // pdf.js 的 ImageKind.GRAYSCALE_1BPP 是**位打包**数据：每行 ceil(w/8) 字节、
    // 每字节 8 像素、高位在前，1=白 0=黑（DeviceGray 默认 Decode）。旧实现按
    // 8bit/像素处理并校验 src.length >= w*h，打包数据必然不满足 → 扫描件整块丢弃。
    // 仍保留 8bit 分支：个别路径可能已把 1bpp 展开成每像素 1 字节。
    if (src.length >= n) {
      const out = Buffer.alloc(n * 4);
      for (let i = 0, o = 0; i < n; i++) {
        const v = src[i];
        out[o++] = v;
        out[o++] = v;
        out[o++] = v;
        out[o++] = 255;
      }
      return out;
    }
    const stride = (img.width + 7) >> 3;
    if (src.length < stride * img.height) return null;
    const out = Buffer.alloc(n * 4);
    let o = 0;
    for (let y = 0; y < img.height; y++) {
      const row = y * stride;
      for (let x = 0; x < img.width; x++) {
        const v = (src[row + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0;
        out[o++] = v;
        out[o++] = v;
        out[o++] = v;
        out[o++] = 255;
      }
    }
    return out;
  }
  return null;
}
