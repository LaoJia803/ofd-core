// 最小 PNG 编码器：RGBA → PNG（图像嵌入 OFD 用）。
import zlib from "node:zlib";
import { crc32 } from "./zip.js";

// 最小 PNG 编码器（RGBA → PNG）
// ---------------------------------------------------------------------------
export function encodePng(width, height, rgba) {
  // 用 Uint8Array.set 逐行拷贝，不走 Buffer.from(arrayBuffer, off, len)，
  // 免得依赖那个三参数重载的边界行为。
  const rowBytes = width * 4;
  const raw = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (rowBytes + 1);
    raw[o] = 0; // filter none
    raw.set(rgba.subarray(y * rowBytes, (y + 1) * rowBytes), o + 1);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.concat([t, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcBuf), 0);
    return Buffer.concat([len, t, data, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------
// 仿射矩阵工具（6 元素 [a,b,c,d,e,f]，与 PDF 一致：x'=a*x+c*y+e, y'=b*x+d*y+f）
// ---------------------------------------------------------------------------
