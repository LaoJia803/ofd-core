// JPEG 只读尺寸与通道数（DCTDecode 直嵌，不解码像素）。
/* ------------------------- 图像 ------------------------- */
// 解析 JPEG 尺寸与通道数（扫描 SOF 标记；4 通道可能是 CMYK/YCCK，需要区分）
export function parseJpegDims(bytes) {
  let pos = 2;
  let adobe = false;
  while (pos + 9 < bytes.length) {
    if (bytes[pos] !== 0xFF) { pos++; continue; }
    const marker = bytes[pos + 1];
    pos += 2;
    if (marker === 0xDA) break;
    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) continue;
    const segLen = (bytes[pos] << 8) | bytes[pos + 1];
    // 段长非法（0/越界）：文件损坏，终止扫描避免死循环
    if (segLen < 2 || pos + segLen > bytes.length) break;
    // APP14 "Adobe"：写入的 CMYK/YCCK 数据是反相的，需要 Decode 反相才能正片显示
    if (marker === 0xEE && segLen >= 7 &&
        bytes[pos + 2] === 0x41 && bytes[pos + 3] === 0x64 && bytes[pos + 4] === 0x6F &&
        bytes[pos + 5] === 0x62 && bytes[pos + 6] === 0x65) {
      adobe = true;
    }
    if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
      return {
        h: (bytes[pos + 3] << 8) | bytes[pos + 4],
        w: (bytes[pos + 5] << 8) | bytes[pos + 6],
        comps: bytes[pos + 7] || 3,
        adobe
      };
    }
    pos += segLen;
  }
  throw new Error('无法解析 JPEG 尺寸');
}
