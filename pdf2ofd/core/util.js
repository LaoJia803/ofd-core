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
    if (src.length < n) return null;
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
  return null;
}
