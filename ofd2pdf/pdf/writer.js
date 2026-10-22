// PDF 对象组装：对象编号、页面树、资源字典、xref 与 trailer。
import { MM_TO_PT } from "../core/constants.js";
import { fmtNum } from "../core/util.js";
import { buildInfo, pdfTextString } from "./docstring.js";

// pages: [{ w, h, content, images: string[], alphas: string[] }]
// imageReg: Map dataUrl → { name, w, h, data, filter }; alphaReg: Map a → { name, a }
export function assemblePdf(pages, imageReg, alphaReg, opts) {
  opts = opts || {};
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
  const fontObj = obj++;
  const cidObj = obj++;
  const fdObj = obj++;
  const gsObjs = {}, imgObjs = {}, smaskObjs = {};
  for (const a of alphaReg.keys()) gsObjs[alphaReg.get(a).name] = obj++;
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
    let ext = '';
    if (p.alphas && p.alphas.length) {
      ext = ' /ExtGState << ' + p.alphas.map(n => '/' + n + ' ' + gsObjs[n] + ' 0 R').join(' ') + ' >>';
    }
    let xo = '';
    if (p.images && p.images.length) {
      xo = ' /XObject << ' + p.images.map(n => '/' + n + ' ' + imgObjs[n] + ' 0 R').join(' ') + ' >>';
    }
    const resources = '<< /Font << /F1 ' + fontObj + ' 0 R >>' + ext + xo + ' >>';
    emit(pageObjs[i] + ' 0 obj\n<< /Type /Page /Parent ' + pagesObj + ' 0 R /MediaBox ' + media +
      ' /Resources ' + resources + ' /Contents ' + contentObjs[i] + ' 0 R >>\nendobj\n');
    const contentBytes = enc.encode(p.content);
    emit(contentObjs[i] + ' 0 obj\n<< /Length ' + contentBytes.length + ' >>\nstream\n');
    pushBytes(contentBytes);
    pushBytes(streamEnd());
  }
  // 字体（Type0 + UniGB-UCS2-H，STSong-Light，依赖阅读器内置中文字体）
  emit(fontObj + ' 0 obj\n<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light ' +
    '/Encoding /UniGB-UCS2-H /DescendantFonts [' + cidObj + ' 0 R] >>\nendobj\n');
  emit(cidObj + ' 0 obj\n<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light ' +
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /FontDescriptor ' + fdObj + ' 0 R >>\nendobj\n');
  emit(fdObj + ' 0 obj\n<< /Type /FontDescriptor /FontName /STSong-Light /Flags 4 ' +
    '/FontBBox [-241 -260 1120 932] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 762 /StemV 80 >>\nendobj\n');
  // ExtGState（透明度 + 混合模式）
  for (const a of alphaReg.keys()) {
    const g = alphaReg.get(a);
    const dict = '/Type /ExtGState' +
      (g.a < 1 ? ' /ca ' + g.a + ' /CA ' + g.a + ' /AIS false' : '') +
      (g.blend ? ' /BM /' + g.blend.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('') : '');
    emit(gsObjs[g.name] + ' 0 obj\n<< ' + dict + ' >>\nendobj\n');
  }
  // 图像 XObject（带透明通道时附加 SMask 灰度图）
  for (const key of imageReg.keys()) {
    const im = imageReg.get(key);
    let dict = '<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h +
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /' + im.filter + ' /Length ' + im.data.length;
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
