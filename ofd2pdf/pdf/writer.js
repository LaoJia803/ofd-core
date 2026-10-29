// PDF 对象组装：对象编号、页面树、资源字典、xref 与 trailer。
import { MM_TO_PT } from "../core/constants.js";
import { fmtNum } from "../core/util.js";
import { buildInfo, pdfTextString } from "./docstring.js";

// pages: [{ w, h, content, images, alphas, shadings, fonts }]
// regs: { imageReg, alphaReg, shadingReg, fontReg }
//   imageReg: Map dataUrl → { name, w, h, data, filter, colorSpace?, smask? }
//   alphaReg: Map key → { name, a, blend }
//   shadingReg: Map id → { name, dict }
//   fontReg: Map key → { name, kind: 'cid'|'type1', base }
// 为兼容旧调用（pages, imageReg, alphaReg, opts）保留一种参数形态。
export function assemblePdf(pages, a, b, c) {
  let regs, opts;
  if (a && (a.imageReg || a.fontReg || a.shadingReg || a.alphaReg)) {
    regs = a;
    opts = b || {};
  } else {
    regs = { imageReg: a, alphaReg: b };
    opts = c || {};
  }
  const imageReg = regs.imageReg || new Map();
  const alphaReg = regs.alphaReg || new Map();
  const shadingReg = regs.shadingReg || new Map();
  const fontReg = regs.fontReg || new Map();

  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let byteOff = 0;
  let obj = 1;
  const catalogObj = obj++;
  const pagesObj = obj++;
  const infoObj = obj++;
  const pageObjs = [], contentObjs = [];
  for (let i = 0; i < pages.length; i++) { pageObjs.push(obj++); contentObjs.push(obj++); }
  // 字体：CID 字体需要 3 个对象（Type0 / CIDFont / FontDescriptor），标准 14 字体只要 1 个
  const fontObjs = {};
  for (const f of fontReg.values()) {
    const objs = { kind: f.kind, base: f.base };
    if (f.kind === 'cid') { objs.type0 = obj++; objs.cid = obj++; objs.fd = obj++; }
    else objs.type1 = obj++;
    fontObjs[f.name] = objs;
  }
  const gsObjs = {}, shadingObjs = {}, imgObjs = {}, smaskObjs = {};
  for (const a of alphaReg.keys()) gsObjs[alphaReg.get(a).name] = obj++;
  for (const s of shadingReg.values()) shadingObjs[s.name] = obj++;
  for (const key of imageReg.keys()) {
    const im = imageReg.get(key);
    imgObjs[im.name] = obj++;
    if (im.smask) smaskObjs[im.name] = obj++;
  }
  const size = obj;
  const pushBytes = b => { chunks.push(b); byteOff += b.length; };
  const emit = s => { offsets.push(byteOff); pushBytes(typeof s === 'string' ? enc.encode(s) : s); };
  const streamEnd = () => enc.encode('\nendstream\nendobj\n');
  // 头
  pushBytes(enc.encode('%PDF-1.4\n%'));
  pushBytes(new Uint8Array([0xE2, 0xE3, 0xCF, 0xD3]));
  pushBytes(enc.encode('\n'));
  // 1 Catalog
  emit('1 0 obj\n<< /Type /Catalog /Pages ' + pagesObj + ' 0 R >>\nendobj\n');
  // 2 Pages
  const kids = pageObjs.map(n => n + ' 0 R').join(' ');
  emit(pagesObj + ' 0 obj\n<< /Type /Pages /Kids [' + kids + '] /Count ' + pages.length + ' >>\nendobj\n');
  // 3 Info
  emit(infoObj + ' 0 obj\n' + buildInfo(opts) + '\nendobj\n');
  // 页面
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const media = '[0 0 ' + fmtNum(p.w * MM_TO_PT) + ' ' + fmtNum(p.h * MM_TO_PT) + ']';
    let fontRes = '';
    if (p.fonts && p.fonts.length) {
      fontRes = ' /Font << ' + p.fonts.map(n => {
        const o = fontObjs[n];
        return '/' + n + ' ' + (o.kind === 'cid' ? o.type0 : o.type1) + ' 0 R';
      }).join(' ') + ' >>';
    }
    let gsRes = '';
    if (p.alphas && p.alphas.length) {
      gsRes = ' /ExtGState << ' + p.alphas.map(n => '/' + n + ' ' + gsObjs[n] + ' 0 R').join(' ') + ' >>';
    }
    let patRes = '';
    if (p.shadings && p.shadings.length) {
      patRes = ' /Shading << ' + p.shadings.map(n => '/' + n + ' ' + shadingObjs[n] + ' 0 R').join(' ') + ' >>';
    }
    let xoRes = '';
    if (p.images && p.images.length) {
      xoRes = ' /XObject << ' + p.images.map(n => '/' + n + ' ' + imgObjs[n] + ' 0 R').join(' ') + ' >>';
    }
    const resources = '<< /ProcSet [/PDF /Text /ImageB /ImageC /ImageI]' +
      fontRes + gsRes + patRes + xoRes + ' >>';
    emit(pageObjs[i] + ' 0 obj\n<< /Type /Page /Parent ' + pagesObj + ' 0 R /MediaBox ' + media +
      ' /Resources ' + resources + ' /Contents ' + contentObjs[i] + ' 0 R >>\nendobj\n');
    const contentBytes = enc.encode(p.content);
    emit(contentObjs[i] + ' 0 obj\n<< /Length ' + contentBytes.length + ' >>\nstream\n');
    pushBytes(contentBytes);
    pushBytes(streamEnd());
  }
  // 字体：标准 14 字体走 Type1；中文走 Type0 + UniGB-UCS2-H 的 CID 字体（依赖阅读器内置字体）
  for (const name of Object.keys(fontObjs)) {
    const f = fontObjs[name];
    if (f.kind === 'cid') {
      emit(f.type0 + ' 0 obj\n<< /Type /Font /Subtype /Type0 /BaseFont /' + f.base +
        ' /Encoding /UniGB-UCS2-H /DescendantFonts [' + f.cid + ' 0 R] >>\nendobj\n');
      emit(f.cid + ' 0 obj\n<< /Type /Font /Subtype /CIDFontType0 /BaseFont /' + f.base +
        ' /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /FontDescriptor ' +
        f.fd + ' 0 R >>\nendobj\n');
      emit(f.fd + ' 0 obj\n<< /Type /FontDescriptor /FontName /' + f.base + ' /Flags 4 ' +
        '/FontBBox [-241 -260 1120 932] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 762 /StemV 80 >>\nendobj\n');
    } else {
      emit(f.type1 + ' 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /' + f.base +
        ' /Encoding /WinAnsiEncoding >>\nendobj\n');
    }
  }
  // ExtGState（透明度 + 混合模式）
  for (const a of alphaReg.keys()) {
    const g = alphaReg.get(a);
    const dict = '/Type /ExtGState' +
      (g.a < 1 ? ' /ca ' + g.a + ' /CA ' + g.a + ' /AIS false' : '') +
      (g.blend ? ' /BM /' + g.blend.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('') : '');
    emit(gsObjs[g.name] + ' 0 obj\n<< ' + dict + ' >>\nendobj\n');
  }
  // 渐变着色字典（供内容流的 sh 算子引用）
  for (const s of shadingReg.values()) {
    emit(shadingObjs[s.name] + ' 0 obj\n' + s.dict + '\nendobj\n');
  }
  // 图像 XObject（带透明通道时附加 SMask 灰度图）
  for (const key of imageReg.keys()) {
    const im = imageReg.get(key);
    const cs = im.colorSpace || 'DeviceRGB';
    let dict = '<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h +
      ' /ColorSpace /' + cs + ' /BitsPerComponent 8 /Filter /' + im.filter + ' /Length ' + im.data.length;
    // CMYK JPEG 的 Decode 反相（按需，由解码层决定）
    if (im.decode) dict += ' /Decode [' + im.decode.join(' ') + ']';
    if (im.smask) dict += ' /SMask ' + smaskObjs[im.name] + ' 0 R';
    dict += ' >>';
    emit(imgObjs[im.name] + ' 0 obj\n' + dict + '\nstream\n');
    pushBytes(im.data);
    pushBytes(streamEnd());
    if (im.smask) {
      const s = im.smask;
      emit(smaskObjs[im.name] + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + im.w +
        ' /Height ' + im.h + ' /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /' + s.filter +
        ' /Length ' + s.data.length + ' >>\nstream\n');
      pushBytes(s.data);
      pushBytes(streamEnd());
    }
  }
  // xref / trailer（byteOff 即当前总字节数，直接复用免重新累加）
  const xrefPos = byteOff;
  const xref = ['xref', '0 ' + size, '0000000000 65535 f ']
    .concat(offsets.map(o => String(o).padStart(10, '0') + ' 00000 n '))
    .join('\n');
  const trailer = 'trailer\n<< /Size ' + size + ' /Root ' + catalogObj + ' 0 R /Info ' + infoObj + ' 0 R >>\n' +
    'startxref\n' + xrefPos + '\n%%EOF';
  const xrefBytes = enc.encode(xref + '\n' + trailer + '\n');
  chunks.push(xrefBytes);
  const total = xrefPos + xrefBytes.length;
  const out = new Uint8Array(total);
  let off2 = 0;
  for (const c of chunks) { out.set(c, off2); off2 += c.length; }
  return out;
}
