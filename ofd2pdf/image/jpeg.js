// JPEG 只读尺寸（DCTDecode 直嵌，不解码像素）。
/* ------------------------- 图像 ------------------------- */
// 解析 JPEG 尺寸（扫描 SOF 标记）
export function parseJpegDims(bytes) {
  let pos = 2;
  while (pos + 9 < bytes.length) {
    if (bytes[pos] !== 0xFF) { pos++; continue; }
    const marker = bytes[pos + 1];
    pos += 2;
    if (marker === 0xDA) break;
    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) continue;
    const segLen = (bytes[pos] << 8) | bytes[pos + 1];
    // 段长非法（0/越界）：文件损坏，终止扫描避免死循环
    if (segLen < 2 || pos + segLen > bytes.length) break;
    if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
      return {
        h: (bytes[pos + 3] << 8) | bytes[pos + 4],
        w: (bytes[pos + 5] << 8) | bytes[pos + 6]
      };
    }
    pos += segLen;
  }
  throw new Error('无法解析 JPEG 尺寸');
}
