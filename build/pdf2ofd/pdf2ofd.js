/*!
 * pdf2ofd.js v1.0.0 — PDF → OFD 转换器（Node 环境，beta）
 * 由 pdf2ofd/ 的 ESM 模块打包为 CommonJS；CLI 与 module.exports 均可用。
 * 仅供 Node：pdf.js 通过动态 import 从 pdfjs-dist 加载（peerDependency）。
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// pdf2ofd/index.js
var index_exports = {};
__export(index_exports, {
  PT_TO_MM: () => PT_TO_MM,
  ZipWriter: () => ZipWriter,
  convert: () => convert,
  encodePng: () => encodePng
});
module.exports = __toCommonJS(index_exports);
var import_node_fs2 = __toESM(require("node:fs"));
var import_node_url = require("node:url");

// pdf2ofd/ofd/zip.js
var import_node_zlib = __toESM(require("node:zlib"));
var CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ c >>> 8;
  return ~c >>> 0;
}
function toBytes(s) {
  return Buffer.from(s, "utf8");
}
var ZipWriter = class {
  constructor() {
    this.entries = [];
  }
  add(name, data) {
    if (typeof data === "string") data = toBytes(data);
    else if (typeof Buffer !== "undefined" && !(data instanceof Buffer) && !(data instanceof Uint8Array))
      data = Buffer.from(data);
    this.entries.push({ name: toBytes(name), data });
  }
  // 组装 ZIP 字节流。
  build() {
    const chunks = [];
    const central = [];
    let offset = 0;
    for (const e of this.entries) {
      const comp = import_node_zlib.default.deflateRawSync(e.data, { level: 9 });
      const crc = crc32(e.data);
      const nameLen = e.name.length;
      const local = Buffer.alloc(30);
      local.writeUInt32LE(67324752, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(2048, 6);
      local.writeUInt16LE(8, 8);
      local.writeUInt16LE(0, 10);
      local.writeUInt16LE(0, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(comp.length, 18);
      local.writeUInt32LE(e.data.length, 22);
      local.writeUInt16LE(nameLen, 26);
      local.writeUInt16LE(0, 28);
      chunks.push(local, e.name, comp);
      const cd = Buffer.alloc(46);
      cd.writeUInt32LE(33639248, 0);
      cd.writeUInt16LE(20, 4);
      cd.writeUInt16LE(20, 6);
      cd.writeUInt16LE(2048, 8);
      cd.writeUInt16LE(8, 10);
      cd.writeUInt16LE(0, 12);
      cd.writeUInt16LE(0, 14);
      cd.writeUInt32LE(crc, 16);
      cd.writeUInt32LE(comp.length, 20);
      cd.writeUInt32LE(e.data.length, 24);
      cd.writeUInt16LE(nameLen, 28);
      cd.writeUInt16LE(0, 30);
      cd.writeUInt16LE(0, 32);
      cd.writeUInt16LE(0, 34);
      cd.writeUInt16LE(0, 36);
      cd.writeUInt32LE(0, 38);
      cd.writeUInt32LE(offset, 42);
      central.push(cd, e.name);
      offset += local.length + nameLen + comp.length;
    }
    const cdStart = offset;
    let cdSize = 0;
    for (const c of central) cdSize += c.length;
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(101010256, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(this.entries.length, 8);
    eocd.writeUInt16LE(this.entries.length, 10);
    eocd.writeUInt32LE(cdSize, 12);
    eocd.writeUInt32LE(cdStart, 16);
    eocd.writeUInt16LE(0, 20);
    return Buffer.concat([...chunks, ...central, eocd]);
  }
};

// pdf2ofd/font/sfnt.js
function parseCompiledFont(buffer) {
  if (!buffer || !buffer.byteLength) return null;
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  try {
    let off = 92;
    view.getUint32(off);
    off += 4;
    const out = {};
    const strs = ["fallbackName", "loadedName", "mimetype", "name"];
    for (const s of strs) {
      const len = view.getUint32(off);
      off += 4;
      out[s] = new TextDecoder().decode(bytes.slice(off, off + len));
      off += len;
    }
    out.ascent = view.getFloat64(3);
    out.descent = view.getFloat64(19);
    let l = view.getUint32(off);
    off += 4 + l;
    l = view.getUint32(off);
    off += 4 + l;
    const dl = view.getUint32(off);
    off += 4;
    out.data = bytes.slice(off, off + dl);
    return out;
  } catch (e) {
    return null;
  }
}
function rebuildSfnt(sfntVer, dirs) {
  const sorted = dirs.slice().sort((a, b) => a.tag < b.tag ? -1 : 1);
  const num = sorted.length;
  let sr = 1, es = 0;
  while (sr * 2 <= num) {
    sr *= 2;
    es++;
  }
  const header = Buffer.alloc(12);
  header.writeUInt32BE(sfntVer, 0);
  header.writeUInt16BE(num, 4);
  header.writeUInt16BE(sr * 16, 6);
  header.writeUInt16BE(es, 8);
  header.writeUInt16BE((num - sr) * 16, 10);
  let cursor = 12 + num * 16;
  const entries = [];
  for (const d of sorted) {
    const len = d.data.length;
    entries.push({ tag: d.tag, data: d.data, chk: crc32(d.data), off: cursor, len });
    cursor += len + (4 - len % 4) % 4;
  }
  const out = Buffer.alloc(cursor);
  header.copy(out, 0);
  entries.forEach((e, i) => {
    const o = 12 + i * 16;
    Buffer.from(e.tag, "latin1").copy(out, o);
    out.writeUInt32BE(e.chk, o + 4);
    out.writeUInt32BE(e.off, o + 8);
    out.writeUInt32BE(e.len, o + 12);
  });
  entries.forEach((e) => e.data.copy(out, e.off));
  const hi = entries.findIndex((e) => e.tag === "head");
  if (hi >= 0) {
    out.writeUInt32BE(0, entries[hi].off + 8);
    const adj = 2981146554 - crc32(out) >>> 0;
    out.writeUInt32BE(adj, entries[hi].off + 8);
  }
  return out;
}

// pdf2ofd/font/cmap.js
function buildFontCmap(buf) {
  const map = /* @__PURE__ */ new Map();
  try {
    if (!buf || buf.length < 12) return map;
    const numTables = buf.readUInt16BE(4);
    let cm = null;
    for (let i = 0; i < numTables; i++) {
      const o = 12 + i * 16;
      if (buf.slice(o, o + 4).toString("latin1") !== "cmap") continue;
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
      const fmt2 = cm.readUInt16BE(off);
      if (fmt2 === 4 && (fmt4 < 0 || plat === 3 && enc === 1)) fmt4 = off;
      else if (fmt2 === 12 && fmt12 < 0) fmt12 = off;
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
        const hi = Math.min(end, start + 65535);
        for (let c = start; c <= hi; c++) map.set(c, gid + (c - start));
      }
    }
  } catch (e) {
    return map;
  }
  return map;
}
function ensureMacCmap(buf) {
  try {
    const sfntVer = buf.readUInt32BE(0);
    const numTables = buf.readUInt16BE(4);
    const dirs = [];
    let cmapOff = -1;
    for (let i = 0; i < numTables; i++) {
      const o = 12 + i * 16;
      const tag = buf.slice(o, o + 4).toString("latin1");
      const off = buf.readUInt32BE(o + 8);
      const len = buf.readUInt32BE(o + 12);
      dirs.push({ tag, data: buf.slice(off, off + len) });
      if (tag === "cmap") cmapOff = off;
    }
    if (cmapOff < 0) return buf;
    const cmap = dirs.find((d) => d.tag === "cmap").data;
    const n = cmap.readUInt16BE(2);
    let winAbs = -1, macAbs = -1;
    for (let i = 0; i < n; i++) {
      const r = 4 + i * 8;
      const p = cmap.readUInt16BE(r), e = cmap.readUInt16BE(r + 2), off = cmap.readUInt32BE(r + 4);
      if (p === 3 && e === 1) winAbs = off;
      if (p === 1 && e === 0) macAbs = off;
    }
    if (macAbs >= 0) return buf;
    if (winAbs < 0 || cmap.readUInt16BE(winAbs) !== 4) return buf;
    const map = readFmt4(cmap, winAbs);
    if (!map.size) return buf;
    const macSub = buildFmt4(map);
    if (!macSub) return buf;
    const winSub = cmap.slice(winAbs);
    const newCmap = buildCmap(winSub, macSub);
    const cmapDir = dirs.find((d) => d.tag === "cmap");
    cmapDir.data = newCmap;
    return rebuildSfnt(sfntVer, dirs);
  } catch (e) {
    return buf;
  }
}
function readFmt4(buf, off) {
  const map = /* @__PURE__ */ new Map();
  const segX2 = buf.readUInt16BE(off + 6), sc = segX2 / 2, base = off + 14;
  const end = [], start = [], delta = [], range = [];
  for (let i = 0; i < sc; i++) end.push(buf.readUInt16BE(base + i * 2));
  for (let i = 0; i < sc; i++) start.push(buf.readUInt16BE(base + segX2 + 2 + i * 2));
  for (let i = 0; i < sc; i++) delta.push(buf.readInt16BE(base + segX2 * 2 + 2 + i * 2));
  const rangeBase = base + segX2 * 3 + 2;
  for (let i = 0; i < sc; i++) range.push(buf.readUInt16BE(rangeBase + i * 2));
  for (let s = 0; s < sc; s++) {
    if (start[s] === 65535) continue;
    for (let c = start[s]; c <= end[s]; c++) {
      let gid;
      if (range[s] === 0) gid = c + delta[s] & 65535;
      else {
        const gi = rangeBase + s * 2 + range[s] + (c - start[s]) * 2;
        if (gi + 1 < buf.length) {
          gid = buf.readUInt16BE(gi);
          if (gid !== 0) gid = gid + delta[s] & 65535;
        } else gid = 0;
      }
      if (gid) map.set(c, gid);
    }
  }
  return map;
}
function buildFmt4(map) {
  const codes = [...map.keys()].filter((c) => c <= 65535 && c !== 65535).sort((a, b) => a - b);
  if (!codes.length) return null;
  const segs = [];
  let s = codes[0], p = codes[0];
  for (let i = 1; i < codes.length; i++) {
    if (codes[i] === p + 1) p = codes[i];
    else {
      segs.push([s, p]);
      s = codes[i];
      p = codes[i];
    }
  }
  segs.push([s, p]);
  segs.push([65535, 65535]);
  const sc = segs.length, segX2 = sc * 2;
  const end = [], start = [], delta = [], gidArr = [];
  for (let i = 0; i < sc; i++) {
    const [a, b] = segs[i];
    end.push(b);
    start.push(a);
    if (a === 65535) {
      delta.push(1);
      gidArr.push(null);
      continue;
    }
    const delta0 = (map.get(a) || 0) - a & 65535;
    let uniform = true;
    for (let c = a; c <= b; c++) if ((map.get(c) || 0) !== (c + delta0 & 65535)) {
      uniform = false;
      break;
    }
    if (uniform) {
      delta.push(delta0);
      gidArr.push(null);
    } else {
      delta.push(0);
      const arr = [];
      for (let c = a; c <= b; c++) arr.push(map.get(c) || 0);
      gidArr.push(arr);
    }
  }
  const gidTotal = gidArr.reduce((n, r) => n + (r ? r.length : 0), 0);
  const size = 16 + segX2 * 4 + gidTotal * 2;
  const sub = Buffer.alloc(size);
  sub.writeUInt16BE(4, 0);
  sub.writeUInt16BE(size, 2);
  sub.writeUInt16BE(segX2, 6);
  sub.writeUInt16BE(1, 8);
  let o = 14;
  end.forEach((v) => {
    sub.writeUInt16BE(v, o);
    o += 2;
  });
  o += 2;
  start.forEach((v) => {
    sub.writeUInt16BE(v, o);
    o += 2;
  });
  delta.forEach((v) => {
    sub.writeUInt16BE(v & 65535, o);
    o += 2;
  });
  const rangeOffsetPos = o;
  const gidStart = rangeOffsetPos + sc * 2;
  let cursor = gidStart;
  for (let i = 0; i < sc; i++) {
    if (gidArr[i]) {
      gidArr[i].forEach((g) => {
        sub.writeUInt16BE(g, cursor);
        cursor += 2;
      });
    }
  }
  for (let i = 0; i < sc; i++) {
    let gs = gidStart;
    for (let t = 0; t < i; t++) if (gidArr[t]) gs += gidArr[t].length * 2;
    const iro = gidArr[i] ? gs - (rangeOffsetPos + i * 2) : 0;
    sub.writeUInt16BE(iro, rangeOffsetPos + i * 2);
  }
  return sub;
}
function buildCmap(winSub, macSub) {
  const recs = [{ p: 1, e: 0, sub: macSub }, { p: 3, e: 1, sub: winSub }];
  const header = 4 + recs.length * 8;
  let total = header;
  for (const r of recs) {
    r.off = total;
    total += r.sub.length + (4 - r.sub.length % 4) % 4;
  }
  const out = Buffer.alloc(total);
  out.writeUInt16BE(0, 0);
  out.writeUInt16BE(recs.length, 2);
  recs.forEach((r, i) => {
    const o = 4 + i * 8;
    out.writeUInt16BE(r.p, o);
    out.writeUInt16BE(r.e, o + 2);
    out.writeUInt32BE(r.off, o + 4);
  });
  recs.forEach((r) => r.sub.copy(out, r.off));
  return out;
}

// pdf2ofd/core/pdfjs.js
var import_node_path = __toESM(require("node:path"));
function pdfjsResUrl(dir) {
  let base;
  try {
    base = import_node_path.default.dirname(require.resolve("pdfjs-dist/package.json"));
  } catch (e) {
    base = import_node_path.default.join(__dirname, "..", "node_modules", "pdfjs-dist");
  }
  return import_node_path.default.join(base, dir).replace(/\\/g, "/") + "/";
}
function pdfjsEntry() {
  try {
    return require.resolve("pdfjs-dist/legacy/build/pdf.mjs");
  } catch (e) {
    return import_node_path.default.join(__dirname, "..", "node_modules", "pdfjs-dist", "legacy", "build", "pdf.mjs");
  }
}
var cmapsUrl = () => pdfjsResUrl("cmaps");
var stdFontsUrl = () => pdfjsResUrl("standard_fonts");

// pdf2ofd/ofd/png.js
var import_node_zlib2 = __toESM(require("node:zlib"));
function encodePng(width, height, rgba) {
  const rowBytes = width * 4;
  const raw = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (rowBytes + 1);
    raw[o] = 0;
    raw.set(rgba.subarray(y * rowBytes, (y + 1) * rowBytes), o + 1);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, "ascii");
    const crcBuf = Buffer.concat([t, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcBuf), 0);
    return Buffer.concat([len, t, data, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = import_node_zlib2.default.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// pdf2ofd/res/color.js
function capJoinName(v, kind) {
  if (kind === "Cap") return ["", "Butt", "Round", "Square"][v] || "Butt";
  return ["", "Miter", "Round", "Bevel"][v] || "Miter";
}
function extractColorStops(p) {
  if (!Array.isArray(p)) return null;
  const stops = p.find(
    (x) => Array.isArray(x) && x.length && Array.isArray(x[0]) && typeof x[0][1] === "string"
  );
  return stops && stops.length ? stops : null;
}
function avgRgba(rgba) {
  if (!rgba || !rgba.length) return null;
  let r = 0, g = 0, b = 0, w = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (!a) continue;
    r += rgba[i] * a;
    g += rgba[i + 1] * a;
    b += rgba[i + 2] * a;
    w += a;
  }
  if (!w) return null;
  return { r: r / w / 255, g: g / w / 255, b: b / w / 255 };
}
function hexToRgb(hex) {
  const h = String(hex || "#000000").replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255 };
}
function rgbVal(c) {
  const p = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `${p(c.r)} ${p(c.g)} ${p(c.b)}`;
}

// pdf2ofd/core/util.js
var PT_TO_MM = 25.4 / 72;
function matMul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5]
  ];
}
function imageToRgba(img) {
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

// pdf2ofd/res/prefetch.js
async function prefetchGradients(page, tc, OPS) {
  const ids = /* @__PURE__ */ new Set();
  for (let i = 0; i < tc.fnArray.length; i++) {
    if (tc.fnArray[i] === OPS.shadingFill) ids.add(tc.argsArray[i][0]);
  }
  const map = /* @__PURE__ */ new Map();
  for (const id of ids) {
    try {
      const p = await page.objs.get(id);
      const stops = extractColorStops(p);
      if (stops) {
        map.set(id, {
          stops,
          // type: 'axial' | 'radial'
          type: Array.isArray(p) && typeof p[1] === "string" ? p[1] : "axial",
          p0: Array.isArray(p) && Array.isArray(p[4]) ? p[4] : null,
          p1: Array.isArray(p) && Array.isArray(p[5]) ? p[5] : null
        });
      }
    } catch (e) {
    }
  }
  return map;
}
function patternImageId(args, OPS) {
  if (!Array.isArray(args) || args[0] !== "TilingPattern") return null;
  const content = args[2];
  if (!content || !content.fnArray) return null;
  for (let i = 0; i < content.fnArray.length; i++) {
    if (content.fnArray[i] === OPS.paintImageXObject) {
      const a = content.argsArray[i];
      const id = a && a[0];
      if (typeof id === "string") return id;
    }
  }
  return null;
}
async function prefetchPatternColors(page, tc, OPS) {
  const ids = /* @__PURE__ */ new Set();
  for (let i = 0; i < tc.fnArray.length; i++) {
    const f = tc.fnArray[i];
    if (f === OPS.setFillColorN || f === OPS.setStrokeColorN) {
      const id = patternImageId(tc.argsArray[i], OPS);
      if (id) ids.add(id);
    }
  }
  const map = /* @__PURE__ */ new Map();
  for (const id of ids) {
    try {
      const img = await page.objs.get(id);
      const rgba = img && imageToRgba(img);
      const c = avgRgba(rgba);
      if (c) map.set(id, c);
    } catch (e) {
    }
  }
  return map;
}
async function waitImages(page, tc, OPS, imageStore) {
  const ids = [];
  for (let i = 0; i < tc.fnArray.length; i++) {
    if (tc.fnArray[i] === OPS.paintImageXObject) ids.push(tc.argsArray[i][0]);
  }
  if (!ids.length) return;
  const deadline = Date.now() + 8e3;
  for (const id of ids) {
    while (!page.objs.has(id)) {
      if (Date.now() > deadline) break;
      await new Promise((r) => setTimeout(r, 20));
    }
  }
}

// pdf2ofd/ops/state.js
function createState(pageWpt, pageHpt) {
  const scale = PT_TO_MM;
  const Hmm = pageHpt * scale;
  const PageWmm = pageWpt * scale;
  return {
    scale,
    Hmm,
    PageWmm,
    PAGE_BOX: [0, 0, PageWmm, Hmm],
    // 裁剪区 Path 用整页作 Boundary，坐标即绝对 mm
    gs: {
      ctm: [1, 0, 0, 1, 0, 0],
      fillColor: { r: 0, g: 0, b: 0 },
      strokeColor: { r: 0, g: 0, b: 0 },
      lineWidth: 1,
      lineCap: 0,
      lineJoin: 0,
      // 虚线状态：PDF 的 setDash(args=[dashArray, dashPhase])。OFD 用 PathObject 的
      // DashPattern 属性（对齐数科产物：`<ofd:PathObject ... DashPattern="4 4">`），
      // 不是子元素 —— 写成子元素引擎会忽略，虚线椭圆就退化成实线。
      dashArray: null,
      dashPhase: 0,
      // Tl 属于图形状态（q/Q 会保存与恢复），tm/tlm/font 不属于。
      leading: 0
    },
    ts: {
      tm: [1, 0, 0, 1, 0, 0],
      tlm: [1, 0, 0, 1, 0, 0],
      fontName: null,
      fontSize: 0
    },
    sink: {
      out: [],
      // 各级裁剪区的轴对齐包围盒，用于剔除裁剪区外的图元
      clipBoxes: [],
      // endPath 定义的路径（绝对 mm 坐标），供 clip / shadingFill 取用
      pendingPath: null,
      // pdf.js 的 clip/clipEO 只是「置位」pendingClip，真正建立裁剪区是在**下一个**
      // constructPath 被 consumePath() 消费时（pdf.mjs 19189-19208）。
      // 因此这里也延迟一位：clip 只置位，随后那条 constructPath 才拿来当裁剪区。
      // 旧实现相反 —— clip 到达时立刻消费 pendingPath，那是**上一条**已用掉的陈旧路径，
      // 于是裁剪区整体错位，把图例色块之类的小图元误剔
      // （第 10/13 页图表标签前的颜色标识就是这样消失的：色块实际在 clip 区外侧 ~1mm，
      //  错位的 clip 区把它判成不可见）。
      pendingClipMode: 0
      // 1 = clip，2 = eoClip
    },
    stack: [],
    gradDbg: 0
  };
}
function saveState(st) {
  st.stack.push({ gs: { ...st.gs }, clipBoxes: st.sink.clipBoxes });
  st.gs.ctm = st.gs.ctm.slice();
  st.sink.clipBoxes = st.sink.clipBoxes.slice();
}
function restoreState(st) {
  const s = st.stack.pop();
  if (s) {
    Object.assign(st.gs, s.gs);
    st.sink.clipBoxes = s.clipBoxes;
  }
}
function emit(st, xml) {
  if (xml) st.sink.out.push(xml);
}

// pdf2ofd/ofd/xml.js
var import_node_crypto = __toESM(require("node:crypto"));
function fmt(n, digits) {
  if (!isFinite(n)) return "0";
  const d = digits === void 0 ? 4 : digits;
  let s = n.toFixed(d);
  if (d > 0) s = s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  if (s === "-0" || s === "") s = "0";
  return s;
}
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function randomId() {
  return import_node_crypto.default.randomBytes(16).toString("hex");
}
function nowOfd() {
  const d = /* @__PURE__ */ new Date();
  const p = (n) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const off = -d.getTimezoneOffset();
  const ao = Math.abs(off);
  const tz = `${off >= 0 ? "+" : "-"}${p(Math.floor(ao / 60))}:${p(ao % 60)}`;
  return { date, stamp: `${date}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${tz}` };
}

// pdf2ofd/ops/geom.js
function px(st, x, y) {
  return [x * st.scale, st.Hmm - y * st.scale];
}
function splitCtm(st, m) {
  return {
    L: [m[0] * st.scale, -m[1] * st.scale, m[2] * st.scale, -m[3] * st.scale],
    T: [m[4] * st.scale, st.Hmm - m[5] * st.scale]
  };
}
var CTM_TINY = 0.05;
function ctmScaleOf(L) {
  return Math.sqrt(Math.abs(L[0] * L[3] - L[1] * L[2])) || 1;
}
function absorbScale(m, L) {
  const k = ctmScaleOf(L);
  if (k >= CTM_TINY) return [m, 1];
  return [
    [m[0] / k, m[1] / k, m[2] / k, m[3] / k, m[4], m[5]],
    k
  ];
}
function geom(st, m, pts) {
  const { L, T } = splitCtm(st, m);
  let dminX = Infinity, dmaxX = -Infinity, dminY = Infinity, dmaxY = -Infinity;
  for (const p of pts) {
    const X = m[0] * p[0] + m[2] * p[1] + m[4];
    const Y = m[1] * p[0] + m[3] * p[1] + m[5];
    if (X < dminX) dminX = X;
    if (X > dmaxX) dmaxX = X;
    if (Y < dminY) dminY = Y;
    if (Y > dmaxY) dmaxY = Y;
  }
  const [bx, by] = px(st, dminX, dmaxY);
  const box = [bx, by, (dmaxX - dminX) * st.scale, (dmaxY - dminY) * st.scale];
  let dx = 0, dy = 0;
  const det = L[0] * L[3] - L[1] * L[2];
  if (Math.abs(det) > 1e-9) {
    const rx = T[0] - bx, ry = T[1] - by;
    dx = (L[3] * rx - L[2] * ry) / det;
    dy = (L[0] * ry - L[1] * rx) / det;
  }
  return { L, box, dx, dy };
}
function boxAttr(box) {
  return `${fmt(box[0])} ${fmt(box[1])} ${fmt(box[2])} ${fmt(box[3])}`;
}
function ctmAttr(L) {
  return `${fmt(L[0])} ${fmt(L[1])} ${fmt(L[2])} ${fmt(L[3])} 0 0`;
}

// pdf2ofd/ops/clip.js
function clipXml() {
  return "";
}
var CLIP_EPS = 0.6;
function visible(st, box, mode) {
  const useClip = mode === "clip";
  const { PageWmm, Hmm } = st;
  let r = [-CLIP_EPS, -CLIP_EPS, PageWmm + CLIP_EPS * 2, Hmm + CLIP_EPS * 2];
  for (const c of useClip ? st.sink.clipBoxes : []) {
    if (c[2] <= 0.01 || c[3] <= 0.01) continue;
    const x02 = Math.max(r[0], c[0] - CLIP_EPS);
    const y02 = Math.max(r[1], c[1] - CLIP_EPS);
    const x12 = Math.min(r[0] + r[2], c[0] + c[2] + CLIP_EPS);
    const y12 = Math.min(r[1] + r[3], c[1] + c[3] + CLIP_EPS);
    if (x12 - x02 <= 0.01 || y12 - y02 <= 0.01) return false;
    r = [x02, y02, x12 - x02, y12 - y02];
  }
  const MIN_HIT = 1;
  const bx0 = box[0];
  const by0 = box[1];
  const bx1 = box[0] + Math.max(box[2], MIN_HIT);
  const by1 = box[1] + Math.max(box[3], MIN_HIT);
  const x0 = Math.max(r[0], bx0);
  const y0 = Math.max(r[1], by0);
  const x1 = Math.min(r[0] + r[2], bx1);
  const y1 = Math.min(r[1] + r[3], by1);
  return x1 - x0 > 0.01 && y1 - y0 > 0.01;
}
function clipRegion(st) {
  const cb = st.sink.clipBoxes;
  for (let i = cb.length - 1; i >= 0; i--) {
    const c = cb[i];
    if (c[2] > 0.01 && c[3] > 0.01) return c.slice();
  }
  return null;
}
var CLAMP_RATIO = 1.8;
function isOversizedRect(st, d, box) {
  if (!d || !/^M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ C$/.test(d)) return false;
  const r = clipRegion(st);
  if (!r) return false;
  if (box[0] >= r[0] - 0.5 && box[1] >= r[1] - 0.5 && box[0] + box[2] <= r[0] + r[2] + 0.5 && box[1] + box[3] <= r[1] + r[3] + 0.5) return false;
  return box[2] >= r[2] * CLAMP_RATIO && box[3] >= r[3] * CLAMP_RATIO;
}

// pdf2ofd/ops/text.js
function advanceLine(st, x, y) {
  const ts = st.ts;
  ts.tlm = matMul(ts.tlm, [1, 0, 0, 1, x, y]);
  ts.tm = ts.tlm.slice();
}
function ensureFont(ctx, loadedName) {
  if (!loadedName) return 0;
  if (ctx.fontResMap.has(loadedName)) return ctx.fontResMap.get(loadedName);
  const id = 100 + ctx.fontResMap.size;
  ctx.fontResMap.set(loadedName, id);
  return id;
}
function emitText(st, ctx, glyphArr) {
  if (!glyphArr || !glyphArr.length) return "";
  const { scale, Hmm, gs, ts } = st;
  const { fonts, fontCmap, nextId } = ctx;
  const { ctm } = gs;
  const { tm, fontName, fontSize } = ts;
  const M = matMul(ctm, tm);
  const tmScale = Math.hypot(tm[0], tm[1]) || 1;
  const sizeTs = (fontSize || 1) * tmScale;
  const tmUnit = tmScale > 1e-6 ? [tm[0] / tmScale, tm[1] / tmScale, tm[2] / tmScale, tm[3] / tmScale, tm[4], tm[5]] : tm;
  const Mdev = matMul(ctm, tmUnit);
  let text = "";
  const adv = [];
  const codeList = [];
  for (const g of glyphArr) {
    if (typeof g === "number") {
      if (adv.length) adv[adv.length - 1] -= g / 1e3 * sizeTs;
      continue;
    }
    const u = g.unicode || "";
    if (!u) continue;
    const firstCp = u.codePointAt(0);
    const code = g.fontChar ? g.fontChar.codePointAt(0) : firstCp;
    text += String.fromCodePoint(firstCp);
    codeList.push(code);
    adv.push(g.width / 1e3 * sizeTs);
  }
  if (!text) return "";
  const fid = ensureFont(ctx, fontName);
  const f = fonts.get(fontName);
  const bold = f && f.bold ? ' Bold="true"' : "";
  const italic = f && f.italic ? ' Italic="true"' : "";
  const cmap = fontCmap && fontCmap.get(fontName);
  let cg = "";
  if (cmap && cmap.size && codeList.length === text.length) {
    const gids = [];
    for (const code of codeList) {
      const gid = cmap.get(code);
      gids.push(gid ? gid : 1);
    }
    cg = `<ofd:CGTransform CodePosition="0" CodeCount="${gids.length}" GlyphCount="${gids.length}"><ofd:Glyphs>${gids.join(" ")}</ofd:Glyphs></ofd:CGTransform>`;
  }
  const emAsc = f && isFinite(f.ascent) ? f.ascent : 0.88;
  const emDesc = f && isFinite(f.descent) ? f.descent : -0.22;
  let total = 0;
  for (const a of adv) total += Math.max(0, a);
  const totalW = Math.max(total, 0.01);
  const asc = emAsc * sizeTs;
  const desc = emDesc * sizeTs;
  const L = [Mdev[0] * scale, Mdev[1] * scale, Mdev[2] * scale, Mdev[3] * scale];
  const T = [Mdev[4] * scale, Hmm - Mdev[5] * scale];
  let dminX = Infinity, dmaxX = -Infinity, dminY = Infinity, dmaxY = -Infinity;
  for (const p of [[0, 0], [totalW, 0], [0, asc], [totalW, asc], [0, desc], [totalW, desc]]) {
    const X = Mdev[0] * p[0] + Mdev[2] * p[1] + Mdev[4];
    const Y = Mdev[1] * p[0] + Mdev[3] * p[1] + Mdev[5];
    if (X < dminX) dminX = X;
    if (X > dmaxX) dmaxX = X;
    if (Y < dminY) dminY = Y;
    if (Y > dmaxY) dmaxY = Y;
  }
  const [bx, by] = px(st, dminX, dmaxY);
  const box = [bx, by, (dmaxX - dminX) * scale, (dmaxY - dminY) * scale];
  let ox = 0, oy = 0;
  const det = L[0] * L[3] - L[1] * L[2];
  if (Math.abs(det) > 1e-9) {
    const rx = T[0] - bx, ry = T[1] - by;
    ox = (L[3] * rx - L[2] * ry) / det;
    oy = (L[0] * ry - L[1] * rx) / det;
  }
  if (!visible(st, box, "page")) return "";
  const dx = adv.slice(0, -1).map((a) => fmt(a)).join(" ");
  return `<ofd:TextObject ID="${nextId()}" CTM="${ctmAttr(L)}" Boundary="${boxAttr(box)}" Font="${fid}" Size="${fmt(sizeTs)}"${bold}${italic}><ofd:FillColor Value="${rgbVal(gs.fillColor)}"/>${clipXml()}${cg}<ofd:TextCode X="${fmt(ox)}" Y="${fmt(oy)}"${dx ? ` DeltaX="${dx}"` : ""}>${esc(text)}</ofd:TextCode></ofd:TextObject>`;
}

// pdf2ofd/ops/path.js
function emitPath(st, ctx, rev, args) {
  const paintOp = rev[args[0]] || args[0];
  const buf = args[1] && args[1][0];
  if (!buf || !buf.length) return "";
  const { gs, sink } = st;
  const { ctm, lineWidth, lineCap, lineJoin, dashArray, fillColor, strokeColor } = gs;
  const { nextId } = ctx;
  const cmds = [];
  let k = 0;
  while (k < buf.length) {
    const op = buf[k++];
    if (op === 0) cmds.push({ op: "M", pts: [[buf[k++], buf[k++]]] });
    else if (op === 1) cmds.push({ op: "L", pts: [[buf[k++], buf[k++]]] });
    else if (op === 2)
      cmds.push({
        op: "B",
        pts: [
          [buf[k++], buf[k++]],
          [buf[k++], buf[k++]],
          [buf[k++], buf[k++]]
        ]
      });
    else if (op === 3) {
      const rx = buf[k++], ry = buf[k++], rw = buf[k++], rh = buf[k++];
      cmds.push({ op: "M", pts: [[rx, ry]] });
      cmds.push({ op: "L", pts: [[rx + rw, ry]] });
      cmds.push({ op: "L", pts: [[rx + rw, ry + rh]] });
      cmds.push({ op: "L", pts: [[rx, ry + rh]] });
      cmds.push({ op: "C", pts: [] });
    } else if (op === 4) cmds.push({ op: "C", pts: [] });
    else break;
  }
  if (!cmds.length) return "";
  const all = [];
  for (const c of cmds) for (const p of c.pts) all.push(p);
  if (!all.length) return "";
  const [effCtm, kScale] = absorbScale(ctm, splitCtm(st, ctm).L);
  const g = geom(st, effCtm, kScale === 1 ? all : all.map((p) => [p[0] * kScale, p[1] * kScale]));
  function serialize(conv) {
    let s2 = "";
    for (const c of cmds) {
      if (c.op === "C") {
        s2 += "C ";
        continue;
      }
      s2 += c.op;
      for (const p of c.pts) {
        const q = conv(p[0], p[1]);
        s2 += ` ${fmt(q[0])} ${fmt(q[1])}`;
      }
      s2 += " ";
    }
    return s2.trim();
  }
  const d = serialize((x, y) => [x * kScale + g.dx, y * kScale + g.dy]);
  if (!d) return "";
  if (paintOp === "endPath") {
    if (sink.pendingClipMode) {
      sink.clipBoxes.push(g.box);
      sink.pendingClipMode = 0;
    }
    const abs = serialize((x, y) => {
      const dm = matMul(effCtm, [1, 0, 0, 1, x * kScale, y * kScale]);
      return px(st, dm[4], dm[5]);
    });
    sink.pendingPath = { d: abs, bounds: g.box };
    return "";
  }
  const fill = paintOp.includes("fill") || paintOp === "fill" || paintOp === "eoFill" || paintOp.includes("Fill");
  const stroke = paintOp.includes("stroke") || paintOp === "stroke";
  const evenOdd = paintOp.includes("eoFill") || paintOp === "eoFill" || paintOp === "eoFillStroke" || paintOp === "closeEOFillStroke";
  if (!visible(st, g.box, stroke ? "page" : "clip")) return "";
  if (fill && !stroke && isOversizedRect(st, d, g.box)) return "";
  const dOut = d;
  const boxOut = g.box;
  let s = `<ofd:PathObject ID="${nextId()}" CTM="${ctmAttr(g.L)}" Boundary="${boxAttr(boxOut)}"`;
  s += ` Fill="${fill}" Stroke="${stroke}"`;
  if (evenOdd) s += ' Rule="Even-Odd"';
  const lw = Math.max(Math.abs(lineWidth) * kScale, 0.02);
  s += ` LineWidth="${fmt(lw)}"`;
  if (lineCap) s += ` Cap="${capJoinName(lineCap, "Cap")}"`;
  if (lineJoin) s += ` Join="${capJoinName(lineJoin, "Join")}"`;
  if (dashArray && dashArray.length && (dashArray.some((v) => v > 0) || dashArray.length % 2 === 0))
    s += ` DashPattern="${dashArray.map((v) => fmt(Math.abs(v) * kScale)).join(" ")}"`;
  s += ">";
  if (fill) s += `<ofd:FillColor Value="${rgbVal(fillColor)}"/>`;
  if (stroke) s += `<ofd:StrokeColor Value="${rgbVal(strokeColor)}"/>`;
  s += clipXml();
  s += `<ofd:AbbreviatedData>${dOut}</ofd:AbbreviatedData>`;
  s += "</ofd:PathObject>";
  return s;
}

// pdf2ofd/ops/image.js
function emitImage(st, ctx, page, objId) {
  const { scale, gs, sink } = st;
  const { ctm } = gs;
  const { imageStore, nextId } = ctx;
  let img = null;
  try {
    img = page.objs.get(objId);
  } catch (e) {
    return "";
  }
  if (!img || !img.width) return "";
  let store = imageStore.get(objId);
  if (!store) {
    const rgba = imageToRgba(img);
    if (!rgba) return "";
    const png = encodePng(img.width, img.height, rgba);
    store = { png, w: img.width, h: img.height, ofdId: nextId() };
    imageStore.set(objId, store);
  }
  const L = [ctm[0] * scale, ctm[1] * scale, ctm[2] * scale, ctm[3] * scale];
  const g = geom(st, ctm, [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1]
  ]);
  if (!visible(st, g.box, "page")) return "";
  return `<ofd:ImageObject ID="${nextId()}" CTM="${ctmAttr(L)}" Boundary="${boxAttr(g.box)}" ResourceID="${store.ofdId}"/>`;
}

// pdf2ofd/ops/shading.js
function emitShading(st, ctx, args) {
  const { PageWmm, Hmm, gs, sink } = st;
  const { ctm } = gs;
  const { gradShades, nextId } = ctx;
  const pendingPath = sink.pendingPath;
  if (!pendingPath) return;
  const grad = gradShades.get(args[0]);
  if (process.env.P2OFD_DEBUG && st.gradDbg++ < 3)
    console.error("[dbg] size", gradShades.size, "id", args[0], "hit", !!grad, "hasPendingPath", !!pendingPath);
  if (grad) {
    const pos = grad.stops.map(([t]) => t);
    const lo = Math.min(...pos);
    const hi = Math.max(...pos);
    const span = hi - lo || 1;
    const a0 = matMul(ctm, [1, 0, 0, 1, grad.p0[0], grad.p0[1]]);
    const a1 = matMul(ctm, [1, 0, 0, 1, grad.p1[0], grad.p1[1]]);
    let p0 = px(st, a0[4], a0[5]);
    let p1 = px(st, a1[4], a1[5]);
    if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 1e-6) {
      const bb = pendingPath.bounds || [0, 0, PageWmm, Hmm];
      p0 = [bb[0], bb[1]];
      p1 = [bb[0] + bb[2], bb[1] + bb[3]];
    }
    const segs = grad.stops.map(
      ([t, hex]) => `<ofd:Segment Position="${fmt((t - lo) / span, 6)}"><ofd:Color Value="${rgbVal(hexToRgb(hex))}"/></ofd:Segment>`
    ).join("");
    emit(
      st,
      `<ofd:PathObject ID="${nextId()}" Boundary="${boxAttr(st.PAGE_BOX)}" Fill="true" Stroke="false"><ofd:FillColor><ofd:AxialShd Extend="3" StartPoint="${fmt(p0[0], 4)} ${fmt(p0[1], 4)}" EndPoint="${fmt(p1[0], 4)} ${fmt(p1[1], 4)}">${segs}</ofd:AxialShd></ofd:FillColor>${clipXml()}<ofd:AbbreviatedData>${pendingPath.d}</ofd:AbbreviatedData></ofd:PathObject>`
    );
  } else {
    const col = { r: 0.5, g: 0.5, b: 0.5 };
    emit(
      st,
      `<ofd:PathObject ID="${nextId()}" Boundary="${boxAttr(st.PAGE_BOX)}" Fill="true" Stroke="false"><ofd:FillColor Value="${rgbVal(col)}"/>${clipXml()}<ofd:AbbreviatedData>${pendingPath.d}</ofd:AbbreviatedData></ofd:PathObject>`
    );
  }
  sink.pendingPath = null;
}

// pdf2ofd/ops/walk.js
function walkOperators(tc, OPS, page, ctx) {
  const st = createState(ctx.pageWpt, ctx.pageHpt);
  const { gs, ts, sink } = st;
  const rev = walkOperators._rev || (walkOperators._rev = (() => {
    const r = {};
    for (const k of Object.keys(OPS)) r[OPS[k]] = k;
    return r;
  })());
  function enterForm(args) {
    saveState(st);
    const m = args[0] || [1, 0, 0, 1, 0, 0];
    gs.ctm = matMul(gs.ctm, m);
    const fb = args[1];
    if (fb && fb.length >= 4 && fb[2] > fb[0] + 1 && fb[3] > fb[1] + 1) {
      const cs = [];
      for (const c of [[fb[0], fb[1]], [fb[2], fb[1]], [fb[2], fb[3]], [fb[0], fb[3]]]) {
        const dm = matMul(gs.ctm, [1, 0, 0, 1, c[0], c[1]]);
        cs.push([dm[4] * st.scale, st.Hmm - dm[5] * st.scale]);
      }
      const xs = cs.map((p) => p[0]), ys = cs.map((p) => p[1]);
      const bx = Math.min(...xs), by = Math.min(...ys);
      sink.clipBoxes.push([bx, by, Math.max(...xs) - bx, Math.max(...ys) - by]);
    }
  }
  for (let i = 0; i < tc.fnArray.length; i++) {
    const name = rev[tc.fnArray[i]];
    const args = tc.argsArray[i];
    switch (name) {
      case "save":
        saveState(st);
        break;
      case "restore":
        restoreState(st);
        break;
      case "transform":
        gs.ctm = matMul(gs.ctm, args);
        break;
      case "setFillRGBColor":
        gs.fillColor = hexToRgb(args[0]);
        break;
      case "setStrokeRGBColor":
        gs.strokeColor = hexToRgb(args[0]);
        break;
      case "setFillGray":
        gs.fillColor = { r: args[0], g: args[0], b: args[0] };
        break;
      case "setStrokeGray":
        gs.strokeColor = { r: args[0], g: args[0], b: args[0] };
        break;
      case "setFillColorN":
      case "setStrokeColorN": {
        const id = patternImageId(args, OPS);
        const c = id && ctx.patternColors && ctx.patternColors.get(id);
        if (c) {
          if (name === "setFillColorN") gs.fillColor = c;
          else gs.strokeColor = c;
        }
        break;
      }
      case "setLineWidth":
        gs.lineWidth = args[0];
        break;
      case "setLineCap":
        gs.lineCap = args[0];
        break;
      case "setLineJoin":
        gs.lineJoin = args[0];
        break;
      case "setDash":
        gs.dashArray = args[0] && args[0].length ? Array.from(args[0]) : null;
        gs.dashPhase = args[1] || 0;
        break;
      // ---- 文本 ----
      case "beginText":
        ts.tm = ts.tlm = [1, 0, 0, 1, 0, 0];
        break;
      case "endText":
        break;
      case "setFont":
        ts.fontName = args[0];
        ts.fontSize = args[1];
        break;
      case "setLeading":
        gs.leading = args[0];
        break;
      case "moveText":
        advanceLine(st, args[0], args[1]);
        break;
      case "setLeadingMoveText":
        gs.leading = -args[1];
        advanceLine(st, args[0], args[1]);
        break;
      case "nextLine":
        advanceLine(st, 0, -gs.leading);
        break;
      case "setTextMatrix": {
        let m = args;
        if (m && m.length === 1 && m[0] && typeof m[0].length === "number" && m[0].length >= 6)
          m = Array.from(m[0]);
        if (!m || m.length < 6) m = [1, 0, 0, 1, 0, 0];
        ts.tm = ts.tlm = m;
        break;
      }
      case "showText":
      case "showSpacedText":
        emit(st, emitText(st, ctx, args[0]));
        break;
      case "nextLineShowText":
        ts.tlm = matMul([1, 0, 0, 1, 0, -gs.leading], ts.tlm);
        ts.tm = ts.tlm.slice();
        emit(st, emitText(st, ctx, args[0]));
        break;
      case "nextLineSetSpacingShowText":
        ts.tlm = matMul([1, 0, 0, 1, 0, -gs.leading], ts.tlm);
        ts.tm = ts.tlm.slice();
        emit(st, emitText(st, ctx, args[2]));
        break;
      // ---- 矢量 ----
      case "constructPath":
        emit(st, emitPath(st, ctx, rev, args));
        break;
      case "clip":
        sink.pendingClipMode = 1;
        break;
      case "eoClip":
        sink.pendingClipMode = 2;
        break;
      case "shadingFill":
        emitShading(st, ctx, args);
        break;
      // ---- 图像 ----
      case "paintImageXObject":
        emit(st, emitImage(st, ctx, page, args[0]));
        break;
      // ---- Form XObject ----
      case "paintFormXObjectBegin": {
        enterForm(args);
        break;
      }
      case "paintFormXObjectEnd":
        restoreState(st);
        break;
    }
  }
  return sink.out.join("");
}

// pdf2ofd/ofd/package.js
var import_node_fs = __toESM(require("node:fs"));

// pdf2ofd/font/naming.js
function fontNameOf(f) {
  if (!f) return "";
  const raw = f.name || f.loadedName || f.fallbackName || "Font";
  return String(raw).replace(/^[A-Z]{6}\+/, "");
}
function fontProps(n) {
  let s = "";
  if (/bold|black|heavy|semibold|demibold|medi$/i.test(n)) s += ' Bold="true"';
  if (/italic|oblique|slant/i.test(n)) s += ' Italic="true"';
  if (/mono|courier|cmtt|fixed/i.test(n)) s += ' FixedWidth="true"';
  return s;
}

// pdf2ofd/ofd/package.js
function collectFonts(fontResMap, fonts) {
  const fontEntries = [];
  const fontFiles = [];
  for (const [loadedName, fid] of fontResMap) {
    const f = fonts.get(loadedName);
    const base = fontNameOf(f) || loadedName || "Unknown";
    if (!f || !f.data || !f.data.length) {
      fontEntries.push(
        `<ofd:Font ID="${fid}" FontName="${esc(base)}"${fontProps(base)}/>`
      );
      continue;
    }
    const ext = f.mimetype === "font/opentype" || /\.(otf|otto)$/i.test(base) ? "otf" : "ttf";
    fontEntries.push(
      `<ofd:Font ID="${fid}" FontName="${esc(base)}"${fontProps(base)}><ofd:FontFile>font_${fid}_${fid}.${ext}</ofd:FontFile></ofd:Font>`
    );
    fontFiles.push({ name: `Doc_0/Res/font_${fid}_${fid}.${ext}`, data: ensureMacCmap(Buffer.from(f.data)) });
  }
  return { fontEntries, fontFiles };
}
function collectImages(imageStore) {
  const mmEntries = [];
  const resFiles = [];
  for (const [objId, img] of imageStore) {
    if (!img.ofdId) continue;
    mmEntries.push(
      `<ofd:MultiMedia ID="${img.ofdId}" Type="Image" Format="PNG"><ofd:MediaFile>image_${img.ofdId}.png</ofd:MediaFile></ofd:MultiMedia>`
    );
    resFiles.push({ name: `Doc_0/Res/image_${img.ofdId}.png`, data: img.png });
  }
  return { mmEntries, resFiles };
}
function buildPackage(outPath, opts) {
  const { pageContents, pageWpt, pageHpt, maxUnitId, fontResMap, fonts, imageStore, compositeUnits } = opts;
  const Wmm = pageWpt * PT_TO_MM;
  const Hmm = pageHpt * PT_TO_MM;
  const { fontEntries, fontFiles } = collectFonts(fontResMap, fonts);
  const { mmEntries, resFiles } = collectImages(imageStore);
  const { date: today, stamp: nowStamp } = nowOfd();
  const zip = new ZipWriter();
  zip.add(
    "OFD.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<ofd:OFD xmlns:ofd="http://www.ofdspec.org/2016" Version="1.1" DocType="OFD"><ofd:DocBody><ofd:DocInfo><ofd:DocID>${randomId()}</ofd:DocID><ofd:CreationDate>${today}</ofd:CreationDate><ofd:ModDate>${nowStamp}</ofd:ModDate><ofd:Creator>ofd-core</ofd:Creator><ofd:CreatorVersion>1.0.0</ofd:CreatorVersion></ofd:DocInfo><ofd:DocRoot>Doc_0/Document.xml</ofd:DocRoot></ofd:DocBody></ofd:OFD>`
  );
  const pagesXml = [];
  for (let p = 1; p <= pageContents.length; p++) {
    pagesXml.push(
      `<ofd:Page ID="${p}" BaseLoc="Pages/Page_${p - 1}/Content.xml"/>`
    );
  }
  zip.add(
    "Doc_0/Document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<ofd:Document xmlns:ofd="http://www.ofdspec.org/2016"><ofd:CommonData><ofd:MaxUnitID>${maxUnitId + 10}</ofd:MaxUnitID><ofd:PageArea><ofd:PhysicalBox>0 0 ${fmt(Wmm)} ${fmt(Hmm)}</ofd:PhysicalBox></ofd:PageArea><ofd:PublicRes>PublicRes.xml</ofd:PublicRes><ofd:DocumentRes>DocumentRes.xml</ofd:DocumentRes></ofd:CommonData><ofd:Pages>${pagesXml.join("")}</ofd:Pages></ofd:Document>`
  );
  zip.add(
    "Doc_0/PublicRes.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<ofd:Res xmlns:ofd="http://www.ofdspec.org/2016" BaseLoc="Res"><ofd:Fonts>${fontEntries.join("")}</ofd:Fonts></ofd:Res>`
  );
  zip.add(
    "Doc_0/DocumentRes.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<ofd:Res xmlns:ofd="http://www.ofdspec.org/2016" BaseLoc="Res"><ofd:MultiMedias>${mmEntries.join("")}</ofd:MultiMedias>${compositeUnits.length ? `<ofd:CompositeGraphicUnits>${compositeUnits.join("")}</ofd:CompositeGraphicUnits>` : ""}</ofd:Res>`
  );
  for (const ff of fontFiles) zip.add(ff.name, ff.data);
  for (const rf of resFiles) zip.add(rf.name, rf.data);
  for (let i = 0; i < pageContents.length; i++) {
    zip.add(
      `Doc_0/Pages/Page_${i}/Content.xml`,
      `<?xml version="1.0" encoding="UTF-8"?>
<ofd:Page xmlns:ofd="http://www.ofdspec.org/2016"><ofd:Area><ofd:PhysicalBox>0 0 ${fmt(Wmm)} ${fmt(Hmm)}</ofd:PhysicalBox></ofd:Area><ofd:Content><ofd:Layer ID="1">${pageContents[i]}</ofd:Layer></ofd:Content></ofd:Page>`
    );
  }
  const outBytes = zip.build();
  import_node_fs.default.writeFileSync(outPath, outBytes);
  return outBytes;
}

// pdf2ofd/index.js
var QUIET = false;
async function convert(pdfPath, ofdPath, options) {
  const onProgress = options && options.onProgress || null;
  const quiet = options && options.quiet != null ? options.quiet : QUIET;
  const pdfjs = await import((0, import_node_url.pathToFileURL)(pdfjsEntry()).href);
  const OPS = pdfjs.OPS;
  const data = new Uint8Array(import_node_fs2.default.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({
    data,
    disableFontFace: false,
    // 关键：保留字体字节
    isEvalSupported: false,
    // 中文/日文等 CID 字体会报「Ensure that the `cMapUrl` API parameter is provided.」，
    // 字体加载随之失败 → 字体表为空 → 整页文字被丢弃（实测中日文混排样本：文字 0、字体 0）。
    // 注意：pdf.js 要求以「正斜杠」结尾，Windows 的 path.sep 是反斜杠，必须手工拼 '/'。
    cMapUrl: cmapsUrl(),
    cMapPacked: true,
    standardFontDataUrl: stdFontsUrl(),
    // 非嵌入的标准字体（Helvetica 等 14 种）需要度量信息做宽度计算
    useSystemFonts: true,
    fontExtraProperties: true
  }).promise;
  const fonts = /* @__PURE__ */ new Map();
  const fontCmap = /* @__PURE__ */ new Map();
  const comObj = doc._transport.messageHandler.comObj;
  comObj.addEventListener(
    "message",
    (e) => {
      const m = e.data;
      if (m && m.action === "commonobj" && m.data && m.data[1] === "Font") {
        const [id, , payload] = m.data;
        const info = parseCompiledFont(payload.buffer);
        fonts.set(id, {
          name: info && info.name,
          loadedName: info && info.loadedName,
          fallbackName: info && info.fallbackName,
          mimetype: info && info.mimetype,
          data: info && info.data,
          ascent: info && info.ascent,
          descent: info && info.descent
        });
        if (info && info.data && info.data.length) {
          const raw = Buffer.from(info.data);
          fontCmap.set(id, buildFontCmap(raw));
        }
      }
    },
    true
  );
  const pageContents = [];
  const imageStore = /* @__PURE__ */ new Map();
  const fontResMap = /* @__PURE__ */ new Map();
  const compositeUnits = [];
  let maxUnitId = 1e3;
  let pageWpt = 612, pageHpt = 792;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    pageWpt = vp.width;
    pageHpt = vp.height;
    const tc = await page.getOperatorList();
    await waitImages(page, tc, OPS, imageStore);
    const gradShades = await prefetchGradients(page, tc, OPS);
    const patternColors = await prefetchPatternColors(page, tc, OPS);
    const body = walkOperators(tc, OPS, page, {
      pageWpt,
      pageHpt,
      fonts,
      fontResMap,
      imageStore,
      compositeUnits,
      fontCmap,
      gradShades,
      patternColors,
      nextId: () => ++maxUnitId
    });
    pageContents.push(body);
    if (onProgress) onProgress(p, doc.numPages);
    if (!quiet) console.error(`  已处理 ${p}/${doc.numPages} 页`);
  }
  const outBytes = buildPackage(ofdPath, {
    pageContents,
    pageWpt,
    pageHpt,
    maxUnitId,
    fontResMap,
    fonts,
    imageStore,
    compositeUnits
  });
  const stats = { pages: doc.numPages, fonts: fonts.size, images: imageStore.size, bytes: outBytes.length };
  if (!quiet)
    console.error(`完成：${ofdPath}（${stats.pages} 页，${stats.fonts} 字体，${stats.images} 图像，${stats.bytes} 字节）`);
  return stats;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PT_TO_MM,
  ZipWriter,
  convert,
  encodePng
});

// Node CLI 入口
if (require.main === module) {
  const [, , inp, outp] = process.argv;
  if (!inp) {
    console.error("用法: node build/pdf2ofd/pdf2ofd.js input.pdf [output.ofd]");
    process.exit(1);
  }
  module.exports.convert(inp, outp || inp.replace(/\.pdf$/i, ".ofd")).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
