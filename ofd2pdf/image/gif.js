// Node 路径：GIF 解码（色表、GCE 透明、LZW、隔行，取首帧）。
import { MAX_IMAGE_PIXELS, checkImageSize } from "./xobject.js";

// GIF（87a/89a）→ RGBA。支持全局/局部色表、GCE 透明、LZW、隔行；多帧时取第一帧
export function decodeGif(bytes) {
  if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46) throw new Error('无效 GIF 头');
  const w = bytes[6] | (bytes[7] << 8);
  const h = bytes[8] | (bytes[9] << 8);
  if (!w || !h || w > 65536 || h > 65536) throw new Error('无效 GIF 尺寸');
  const packed = bytes[10];
  let pos = 13;
  const globalPal = [];
  if (packed & 0x80) {
    const n = 2 << (packed & 7);
    for (let i = 0; i < n; i++) {
      globalPal.push([bytes[pos], bytes[pos + 1], bytes[pos + 2]]);
      pos += 3;
    }
  }
  let transparent = -1;
  // 数据是一串"长度+内容"的小块，读到 0 收尾
  const chunks = () => {
    const out = [];
    for (;;) {
      const n = bytes[pos++];
      if (n === 0) break;
      out.push(bytes.subarray(pos, pos + n));
      pos += n;
    }
    return out;
  };
  while (pos + 1 < bytes.length) {
    const tag = bytes[pos++];
    if (tag === 0x3B) break; // 结束符
    if (tag === 0x21) { // 扩展
      const label = bytes[pos++];
      if (label === 0xF9) { // 图形控制扩展：块大小 | flags | 延迟(2) | 透明索引 | 终止符
        pos++; // 块大小（固定 4）
        const flags = bytes[pos++];
        pos += 2; // 延迟时间 2 字节
        if (flags & 1) transparent = bytes[pos];
        pos += 2; // 透明索引 1 字节 + 终止符 1 字节
      } else {
        chunks(); // 注释/文本/应用扩展：跳过
      }
    } else if (tag === 0x2C) { // 图像描述符（主循环已消费 0x2C，此处直接读 left/top/w/h/packed 共 9 字节）
      const left = bytes[pos] | (bytes[pos + 1] << 8);
      const top = bytes[pos + 2] | (bytes[pos + 3] << 8);
      const imgW = bytes[pos + 4] | (bytes[pos + 5] << 8);
      const imgH = bytes[pos + 6] | (bytes[pos + 7] << 8);
      const ipacked = bytes[pos + 8];
      pos += 9;
      let pal = globalPal;
      if (ipacked & 0x80) { // 帧自带局部色表
        const n = 2 << (ipacked & 7);
        pal = [];
        for (let i = 0; i < n; i++) {
          pal.push([bytes[pos], bytes[pos + 1], bytes[pos + 2]]);
          pos += 3;
        }
      }
      const pix = gifLzwDecode(bytes[pos++], chunks(), imgW * imgH);
      // 隔行：像素按 4 个通道跳行存（行距 8/8/4/2），先算出行序再统一填充
      let rows = null;
      if (ipacked & 0x40) {
        rows = [];
        for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]])
          for (let y = start; y < imgH; y += step) rows.push(y);
      }
      checkImageSize(w, h);
      const rgba = new Uint8Array(w * h * 4);
      let hasAlpha = false;
      let di = 0;
      const fillRow = (yy) => {
        for (let x = 0; x < imgW && di < pix.length; x++) {
          const c = pal[pix[di]];
          const o = ((top + yy) * w + left + x) * 4;
          const a = pix[di] === transparent ? 0 : 255;
          rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = a;
          if (a < 255) hasAlpha = true;
          di++;
        }
      };
      if (rows) for (const yy of rows) fillRow(yy);
      else for (let yy = 0; yy < imgH; yy++) fillRow(yy);
      return { rgba, w, h, hasAlpha };
    }
  }
  throw new Error('GIF 无图像数据');
}
// GIF LZW 解压：LSB 优先、码宽随字典增长（minBits+1 ~ 12）
function gifLzwDecode(minBits, chunks, need) {
  if (!(need > 0) || need > MAX_IMAGE_PIXELS * 4) throw new Error('LZW 输出尺寸异常：' + need);
  const clear = 1 << minBits;
  const end = clear + 1;
  let codeSize = minBits + 1;
  // 字典：code → [prefixCode, byte]（0..clear-1 为单字节根项；prefix 用 -1 表示根）
  const dict = new Int32Array(4096 * 2);
  for (let i = 0; i < clear; i++) { dict[i * 2] = -1; dict[i * 2 + 1] = i; }
  let next = clear + 2;
  const out = new Uint8Array(need);
  let oi = 0;
  let bitBuf = 0, bitCnt = 0, bi = 0;
  let total = 0;
  for (const b of chunks) total += b.length;
  const flat = new Uint8Array(total);
  let fo = 0;
  for (const b of chunks) { flat.set(b, fo); fo += b.length; }
  const readCode = () => {
    while (bitCnt < codeSize) {
      if (bi >= flat.length) return -1;
      bitBuf |= flat[bi++] << bitCnt;
      bitCnt += 8;
    }
    const code = bitBuf & ((1 << codeSize) - 1);
    bitBuf >>= codeSize;
    bitCnt -= codeSize;
    return code;
  };
  let prev = -1;
  const stack = new Uint16Array(4096);
  for (;;) {
    const code = readCode();
    if (code < 0) break;
    if (code === clear) {
      codeSize = minBits + 1;
      next = clear + 2;
      prev = -1;
      continue;
    }
    if (code === end) break;
    let emit;
    let kwk = false;
    if (code < next) {
      emit = code;
    } else if (code === next && prev >= 0) {
      // KWK 特例：码尚未入字典，内容 = prev 链 + prev 首字节
      emit = prev;
      kwk = true;
    } else {
      break;
    }
    let sp = 0;
    let c = emit;
    // 沿前缀链回溯收集字节（根项 prefix=-1 终止；根项 0 也是有效字节）
    while (c >= 0) { stack[sp++] = dict[c * 2 + 1]; c = dict[c * 2]; }
    const first = stack[sp - 1];
    if (kwk) stack[sp++] = first;
    while (sp > 0 && oi < need) out[oi++] = stack[--sp];
    if (prev >= 0 && next < 4096) {
      dict[next * 2] = prev;
      dict[next * 2 + 1] = first;
      next++;
      if (next === (1 << codeSize) && codeSize < 12) codeSize++;
    }
    prev = code;
    if (oi >= need) break;
  }
  return out;
}
