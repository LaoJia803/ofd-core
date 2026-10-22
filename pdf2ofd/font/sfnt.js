// pdf.js 编译后字体对象的解析与 sfnt 头校验和修正。
import { crc32 } from "../ofd/zip.js";

export function parseCompiledFont(buffer) {
  if (!buffer || !buffer.byteLength) return null;
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  try {
    let off = 92; // OFFSET_STRINGS
    view.getUint32(off);
    off += 4;
    const out = {};
    const strs = ['fallbackName', 'loadedName', 'mimetype', 'name'];
    for (const s of strs) {
      const len = view.getUint32(off);
      off += 4;
      out[s] = new TextDecoder().decode(bytes.slice(off, off + len));
      off += len;
    }
    // 数值（ascent/defaultWidth/descent）在头部 3..27
    out.ascent = view.getFloat64(3);
    out.descent = view.getFloat64(19);
    // systemFontInfo
    let l = view.getUint32(off);
    off += 4 + l;
    // cssFontInfo
    l = view.getUint32(off);
    off += 4 + l;
    // data
    const dl = view.getUint32(off);
    off += 4;
    out.data = bytes.slice(off, off + dl);
    return out;
  } catch (e) {
    return null;
  }
}

// 等待操作符列表里引用的图像对象解码完成
export function rebuildSfnt(sfntVer, dirs) {
  const sorted = dirs.slice().sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const num = sorted.length;
  let sr = 1, es = 0; while (sr * 2 <= num) { sr *= 2; es++; }
  const header = Buffer.alloc(12);
  header.writeUInt32BE(sfntVer, 0); header.writeUInt16BE(num, 4); header.writeUInt16BE(sr * 16, 6); header.writeUInt16BE(es, 8); header.writeUInt16BE((num - sr) * 16, 10);
  let cursor = 12 + num * 16; const entries = [];
  for (const d of sorted) { const len = d.data.length; entries.push({ tag: d.tag, data: d.data, chk: crc32(d.data), off: cursor, len }); cursor += len + ((4 - (len % 4)) % 4); }
  const out = Buffer.alloc(cursor); header.copy(out, 0);
  entries.forEach((e, i) => { const o = 12 + i * 16; Buffer.from(e.tag, 'latin1').copy(out, o); out.writeUInt32BE(e.chk, o + 4); out.writeUInt32BE(e.off, o + 8); out.writeUInt32BE(e.len, o + 12); });
  entries.forEach((e) => e.data.copy(out, e.off));
  const hi = entries.findIndex((e) => e.tag === 'head');
  if (hi >= 0) { out.writeUInt32BE(0, entries[hi].off + 8); const adj = (0xb1b0afba - crc32(out)) >>> 0; out.writeUInt32BE(adj, entries[hi].off + 8); }
  return out;
}
