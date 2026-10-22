// 内嵌字体的 cmap 处理与 Mac(1/0) 子表补齐。
import { rebuildSfnt } from "./sfnt.js";

export function buildFontCmap(buf) {
  const map = new Map();
  try {
    if (!buf || buf.length < 12) return map;
    const numTables = buf.readUInt16BE(4);
    let cm = null;
    for (let i = 0; i < numTables; i++) {
      const o = 12 + i * 16;
      if (buf.slice(o, o + 4).toString('latin1') !== 'cmap') continue;
      const off = buf.readUInt32BE(o + 8);
      const len = buf.readUInt32BE(o + 12);
      cm = buf.slice(off, off + len);
      break;
    }
    if (!cm || cm.length < 4) return map;
    const n = cm.readUInt16BE(2);
    let fmt4 = -1;
    let fmt12 = -1;
    for (let i = 0; i < n; i++) {
      const r = 4 + i * 8;
      const plat = cm.readUInt16BE(r);
      const enc = cm.readUInt16BE(r + 2);
      const off = cm.readUInt32BE(r + 4);
      if (off + 2 > cm.length) continue;
      const fmt = cm.readUInt16BE(off);
      if (fmt === 4 && (fmt4 < 0 || (plat === 3 && enc === 1))) fmt4 = off;
      else if (fmt === 12 && fmt12 < 0) fmt12 = off;
    }
    if (fmt4 >= 0) return readFmt4(cm, fmt4);
    if (fmt12 >= 0) {
      const nGroups = cm.readUInt32BE(fmt12 + 12);
      for (let g = 0; g < nGroups; g++) {
        const o = fmt12 + 16 + g * 12;
        if (o + 12 > cm.length) break;
        const start = cm.readUInt32BE(o);
        const end = cm.readUInt32BE(o + 4);
        const gid = cm.readUInt32BE(o + 8);
        const hi = Math.min(end, start + 0xffff);
        for (let c = start; c <= hi; c++) map.set(c, gid + (c - start));
      }
    }
  } catch (e) {
    return map;
  }
  return map;
}

// ===========================================================================
// 主转换流程
// ===========================================================================
// pdf.js 的资源目录：一律转成正斜杠并以 '/' 结尾。
// 两个坑：
//   1) path.sep 在 Windows 上是 '\'，直接拼会被 pdf.js 判为「缺少结尾斜杠」而抛错；
//   2) 用 file:// URL 也不行 —— pdf.js 内部对该 URL 发 fetch()，Node 下读不了本地文件，
//      报「Unable to load CMap data at: file:///...」。
//   正确做法：普通本地路径 + 全部反斜杠换成正斜杠 + 结尾加 '/'。
//
// 打包成 npm 包后本文件位于 <pkg>/lib/，不再有 ../node_modules 这一层，
// 因此统一走 require.resolve('pdfjs-dist/...') 定位 ——
// 无论源码树、打包产物还是用户的 node_modules，解析规则一致。
export function ensureMacCmap(buf) {
  try {
    const sfntVer = buf.readUInt32BE(0);
    const numTables = buf.readUInt16BE(4);
    const dirs = [];
    let cmapOff = -1;
    for (let i = 0; i < numTables; i++) {
      const o = 12 + i * 16;
      const tag = buf.slice(o, o + 4).toString('latin1');
      const off = buf.readUInt32BE(o + 8);
      const len = buf.readUInt32BE(o + 12);
      dirs.push({ tag, data: buf.slice(off, off + len) });
      if (tag === 'cmap') cmapOff = off;
    }
    if (cmapOff < 0) return buf;
    const cmap = dirs.find((d) => d.tag === 'cmap').data;
    const n = cmap.readUInt16BE(2);
    let winAbs = -1, macAbs = -1;
    for (let i = 0; i < n; i++) {
      const r = 4 + i * 8;
      const p = cmap.readUInt16BE(r), e = cmap.readUInt16BE(r + 2), off = cmap.readUInt32BE(r + 4);
      if (p === 3 && e === 1) winAbs = off;
      if (p === 1 && e === 0) macAbs = off;
    }
    if (macAbs >= 0) return buf; // 已有 Mac 子表
    if (winAbs < 0 || cmap.readUInt16BE(winAbs) !== 4) return buf; // 只处理 format-4 Win 表
    const map = readFmt4(cmap, winAbs);
    if (!map.size) return buf;
    const macSub = buildFmt4(map);
    if (!macSub) return buf;
    const winSub = cmap.slice(winAbs);
    const newCmap = buildCmap(winSub, macSub);
    const cmapDir = dirs.find((d) => d.tag === 'cmap');
    cmapDir.data = newCmap;
    return rebuildSfnt(sfntVer, dirs);
  } catch (e) {
    return buf;
  }
}
export function readFmt4(buf, off) {
  const map = new Map();
  const segX2 = buf.readUInt16BE(off + 6), sc = segX2 / 2, base = off + 14;
  const end = [], start = [], delta = [], range = [];
  for (let i = 0; i < sc; i++) end.push(buf.readUInt16BE(base + i * 2));
  for (let i = 0; i < sc; i++) start.push(buf.readUInt16BE(base + segX2 + 2 + i * 2));
  for (let i = 0; i < sc; i++) delta.push(buf.readInt16BE(base + segX2 * 2 + 2 + i * 2));
  const rangeBase = base + segX2 * 3 + 2;
  for (let i = 0; i < sc; i++) range.push(buf.readUInt16BE(rangeBase + i * 2));
  for (let s = 0; s < sc; s++) {
    if (start[s] === 0xFFFF) continue;
    for (let c = start[s]; c <= end[s]; c++) {
      let gid;
      if (range[s] === 0) gid = (c + delta[s]) & 0xFFFF;
      else {
        const gi = rangeBase + s * 2 + range[s] + (c - start[s]) * 2;
        if (gi + 1 < buf.length) { gid = buf.readUInt16BE(gi); if (gid !== 0) gid = (gid + delta[s]) & 0xFFFF; }
        else gid = 0;
      }
      if (gid) map.set(c, gid);
    }
  }
  return map;
}
export function buildFmt4(map) {
  const codes = [...map.keys()].filter((c) => c <= 0xFFFF && c !== 0xFFFF).sort((a, b) => a - b);
  if (!codes.length) return null;
  const segs = [];
  let s = codes[0], p = codes[0];
  for (let i = 1; i < codes.length; i++) {
    if (codes[i] === p + 1) p = codes[i];
    else { segs.push([s, p]); s = codes[i]; p = codes[i]; }
  }
  segs.push([s, p]); segs.push([0xFFFF, 0xFFFF]);
  const sc = segs.length, segX2 = sc * 2;
  const end = [], start = [], delta = [], gidArr = [];
  for (let i = 0; i < sc; i++) {
    const [a, b] = segs[i]; end.push(b); start.push(a);
    if (a === 0xFFFF) { delta.push(1); gidArr.push(null); continue; }
    const delta0 = ((map.get(a) || 0) - a) & 0xFFFF;
    let uniform = true;
    for (let c = a; c <= b; c++) if ((map.get(c) || 0) !== ((c + delta0) & 0xFFFF)) { uniform = false; break; }
    if (uniform) { delta.push(delta0); gidArr.push(null); }
    else {
      delta.push(0);
      const arr = []; for (let c = a; c <= b; c++) arr.push(map.get(c) || 0);
      gidArr.push(arr);
    }
  }
  const gidTotal = gidArr.reduce((n, r) => n + (r ? r.length : 0), 0);
  const size = 16 + segX2 * 4 + gidTotal * 2;
  const sub = Buffer.alloc(size);
  sub.writeUInt16BE(4, 0); sub.writeUInt16BE(size, 2); sub.writeUInt16BE(segX2, 6); sub.writeUInt16BE(1, 8);
  let o = 14;
  end.forEach((v) => { sub.writeUInt16BE(v, o); o += 2; });
  o += 2; // reservedPad
  start.forEach((v) => { sub.writeUInt16BE(v, o); o += 2; });
  delta.forEach((v) => { sub.writeUInt16BE(v & 0xFFFF, o); o += 2; });
  const rangeOffsetPos = o;
  const gidStart = rangeOffsetPos + sc * 2;
  let cursor = gidStart;
  for (let i = 0; i < sc; i++) {
    if (gidArr[i]) { gidArr[i].forEach((g) => { sub.writeUInt16BE(g, cursor); cursor += 2; }); }
  }
  for (let i = 0; i < sc; i++) {
    let gs = gidStart;
    for (let t = 0; t < i; t++) if (gidArr[t]) gs += gidArr[t].length * 2;
    const iro = gidArr[i] ? gs - (rangeOffsetPos + i * 2) : 0;
    sub.writeUInt16BE(iro, rangeOffsetPos + i * 2);
  }
  return sub;
}
export function buildCmap(winSub, macSub) {
  const recs = [{ p: 1, e: 0, sub: macSub }, { p: 3, e: 1, sub: winSub }];
  const header = 4 + recs.length * 8;
  let total = header;
  for (const r of recs) { r.off = total; total += r.sub.length + ((4 - (r.sub.length % 4)) % 4); }
  const out = Buffer.alloc(total);
  out.writeUInt16BE(0, 0); out.writeUInt16BE(recs.length, 2);
  recs.forEach((r, i) => { const o = 4 + i * 8; out.writeUInt16BE(r.p, o); out.writeUInt16BE(r.e, o + 2); out.writeUInt32BE(r.off, o + 4); });
  recs.forEach((r) => r.sub.copy(out, r.off));
  return out;
}
