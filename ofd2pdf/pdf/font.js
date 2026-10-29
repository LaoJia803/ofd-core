// SVG 文本样式 → PDF 字体。
// 拉丁字符优先用标准 14 字体（无需内嵌、几乎所有阅读器都内置），
// 中文用 Adobe-GB1 的标准 CID 字体（同样不内嵌，靠阅读器内置中文字体）。
// 说明：不内嵌字体是有意为之（体积小、无子集化风险），代价是字形由阅读器决定；
// 想要像素级还原必须从 OFD 包里取出字体文件做 FontFile2 子集化。
import { utf16beHex } from "./docstring.js";
import { unescapeXml } from "../core/util.js";

/* ------------------------- 字体映射 ------------------------- */
// 字体族归类：决定走哪套字形
function familyKind(fam) {
  const s = String(fam || '').toLowerCase();
  if (/wingdings|webdings|dingbat|symbol|cmsy|cmex/.test(s)) return 'symbol';
  if (/courier|monospace|consolas|menlo|cmtt|mono\b/.test(s)) return 'mono';
  if (/楷|kai/.test(s)) return 'kai';
  if (/仿宋|fangsong/.test(s)) return 'fangsong';
  if (/黑|hei|yahei|雅黑|sans|arial|helvetica|verdana|calibri|segoe|tahoma|cmss/.test(s)) return 'sans';
  // 宋体/衬线/Times/Computer Modern 等（含 OFD 内嵌的 NimbusRomNo9L、CMR 系列）
  return 'serif';
}
// 标准 14 字体的四个变体：regular / bold / italic / boldItalic
const TYPE1 = {
  mono: ['Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique'],
  sans: ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique'],
  serif: ['Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic']
};
// 中文标准 CID 字体（Adobe-GB1）。除黑体有真粗体，其余用合成粗体。
const CJK = {
  serif: { regular: 'STSong-Light' },
  sans: { regular: 'STHeiti-Light', bold: 'STHeiti-Regular' },
  kai: { regular: 'STKaiti' },
  fangsong: { regular: 'STFangsong-Light' },
  symbol: { regular: 'STSong-Light' },
  mono: { regular: 'STSong-Light' }
};
// 解析文本样式。cidOnly=true 时强制用 CID 字体（文本含非 ASCII 时的回退）
export function resolveFont(attrs, cidOnly) {
  attrs = attrs || {};
  const kind = familyKind(unescapeXml(attrs['font-family'] || ''));
  const weight = String(attrs['font-weight'] || 'normal').toLowerCase();
  const style = String(attrs['font-style'] || 'normal').toLowerCase();
  const bold = weight === 'bold' || weight === 'bolder' || (parseInt(weight, 10) || 0) >= 600;
  const italic = style === 'italic' || style === 'oblique';
  if (!cidOnly && TYPE1[kind]) {
    const names = TYPE1[kind];
    return {
      kind: 'type1',
      base: names[(bold ? 1 : 0) + (italic ? 2 : 0)],
      bold, italic, syntheticBold: false
    };
  }
  const fam = CJK[kind] || CJK.serif;
  let base = fam.regular;
  let syntheticBold = false;
  if (bold) {
    if (fam.bold) base = fam.bold;
    else syntheticBold = true;
  }
  return { kind: 'cid', base, bold, italic, syntheticBold };
}
// 注册字体（按字体对象去重），返回资源名（F1、F2…）
export function ensureFont(font, ctx) {
  const key = font.kind + '|' + font.base;
  let e = ctx.fontReg.get(key);
  if (!e) {
    e = { name: 'F' + (ctx.fontReg.size + 1), kind: font.kind, base: font.base };
    ctx.fontReg.set(key, e);
  }
  ctx.fonts.add(e.name);
  return e.name;
}
// 单字符编码：CID 字体用 UTF-16BE 十六进制，标准 Type1 用单字节码
export function encodeChar(font, ch) {
  if (font.kind === 'type1') {
    return ch.codePointAt(0).toString(16).padStart(2, '0');
  }
  return utf16beHex(ch);
}
// 文本能否用标准 Type1 字体（仅 ASCII 可见字符）
export function isType1Safe(text) {
  for (const ch of String(text)) {
    const c = ch.codePointAt(0);
    if (c < 0x20 || c > 0x7e) return false;
  }
  return true;
}
