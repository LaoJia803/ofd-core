// SVG → PDF 内容流：图元遍历、着色（含渐变）、裁剪、文本与图像。
import { MM_TO_PT } from "../core/constants.js";
import { parseCssColor } from "../core/color.js";
import { addImage } from "../image/xobject.js";
import { parseSvgXml } from "../svg/parse.js";
import { ellipseToCubics, pathToPdf } from "../svg/path.js";
import { parseClipRef, parseRotate, parseTransform } from "../svg/transform.js";
import { fmtNum, numList } from "../core/util.js";
import { encodeChar, ensureFont, isType1Safe, resolveFont } from "./font.js";
import { buildShadingDict, gradientAlpha, gradientColorAt, parseGradient } from "./shading.js";

/* ------------------------- 状态与资源 ------------------------- */
// 提取元素的 mix-blend-mode（OFD 注释常用 Darken，保持文字在深色高亮下可见）
function blendOf(el) {
  const m = /mix-blend-mode\s*:\s*([a-zA-Z]+)/.exec(el.attrs.style || '');
  const b = m ? m[1].toLowerCase() : '';
  return b && b !== 'normal' ? b : null;
}
// 透明/混合模式需要 ExtGState（按 alpha+blend 组合去重）
function ensureGState(alpha, blend, ctx) {
  if ((alpha == null || alpha >= 1) && !blend) return null;
  const a = alpha == null ? 1 : Math.max(0, Math.min(1, alpha));
  const key = a + '|' + (blend || '');
  let g = ctx.alphaReg.get(key);
  if (!g) {
    g = { name: 'GS' + ctx.alphaReg.size, a, blend };
    ctx.alphaReg.set(key, g);
  }
  ctx.alphas.add(g.name);
  return g.name;
}
// 渐变着色：按“定义内容”注册到 /Shading 资源（全篇去重）。
// 不能只按 id 去重：ofd.js 每页的渐变 id 都从 ofd-grad-1 重新编号，同 id 不同色会串页。
function ensureShading(id, ctx) {
  const g = ctx.gradientDefs.get(id);
  if (!g) return null;
  const dict = buildShadingDict(g);
  let e = ctx.shadingReg.get(dict);
  if (!e) {
    e = { name: 'Sh' + ctx.shadingReg.size, dict };
    ctx.shadingReg.set(dict, e);
  }
  ctx.shadings.add(e.name);
  return e.name;
}
// fill / stroke 取值：纯色优先，url(#id) 走渐变
function paintSource(raw, ctx) {
  if (!raw || raw === 'none') return null;
  const c = parseCssColor(raw);
  if (c) return { color: c };
  const id = parseClipRef(raw);
  if (!id) return null;
  const g = ctx.gradientDefs.get(id);
  if (!g) return null;
  const name = ensureShading(id, ctx);
  return name ? { gradient: g, shading: name } : null;
}
const alphaOf = c => (c && c.a != null && c.a < 1 ? c.a : null);
function colorOp(c, isStroke) {
  return fmtNum(c.r / 255) + ' ' + fmtNum(c.g / 255) + ' ' + fmtNum(c.b / 255) + (isStroke ? ' RG' : ' rg');
}
// 描边样式：线宽与虚线
function strokeStyle(el, parts) {
  const w = parseFloat(el.attrs['stroke-width']);
  if (isFinite(w)) parts.push(fmtNum(w) + ' w');
  const da = numList(el.attrs['stroke-dasharray']);
  if (da.length) parts.push('[' + da.map(fmtNum).join(' ') + '] 0 d');
}
// 给已构造的路径上色。pathOps 可能被重复使用；渐变用 sh（着色坐标即当前用户空间）
function paintShape(el, ctx, parts, pathOps, evenodd) {
  const fill = paintSource(el.attrs.fill, ctx);
  const stroke = paintSource(el.attrs.stroke, ctx);
  if (!fill && !stroke) return;
  const blend = blendOf(el);
  parts.push('q');
  if (fill && fill.color && stroke && stroke.color) {
    // 纯色填充 + 纯色描边：路径构造一次，用 B 一次画完
    const fa = alphaOf(fill.color), sa = alphaOf(stroke.color);
    const gs = ensureGState(fa == null ? sa : (sa == null ? fa : Math.min(fa, sa)), blend, ctx);
    if (gs) parts.push('/' + gs + ' gs');
    strokeStyle(el, parts);
    parts.push(pathOps);
    parts.push(colorOp(fill.color, false), colorOp(stroke.color, true));
    parts.push(evenodd ? 'B*' : 'B');
  } else {
    if (fill) {
      const gs = ensureGState(fill.color ? alphaOf(fill.color) : gradientAlpha(fill.gradient), blend, ctx);
      parts.push('q');
      if (gs) parts.push('/' + gs + ' gs');
      parts.push(pathOps);
      if (fill.shading) {
        // sh 只作用于当前裁剪区：先用路径裁出形状，再上色
        parts.push(evenodd ? 'W* n' : 'W n');
        parts.push('/' + fill.shading + ' sh');
      } else {
        parts.push(colorOp(fill.color, false));
        parts.push(evenodd ? 'f*' : 'f');
      }
      parts.push('Q');
    }
    if (stroke) {
      // 渐变描边退化为中值纯色（PDF 没有"渐变描边"这种原语）
      const col = stroke.color || gradientColorAt(stroke.gradient, 0.5);
      const gs = ensureGState(stroke.color ? alphaOf(stroke.color) : gradientAlpha(stroke.gradient), blend, ctx);
      parts.push('q');
      if (gs) parts.push('/' + gs + ' gs');
      strokeStyle(el, parts);
      parts.push(pathOps);
      parts.push(colorOp(col, true));
      parts.push('S');
      parts.push('Q');
    }
  }
  parts.push('Q');
}

/* ------------------------- 裁剪路径 ------------------------- */
// 把 clipPath 的子图元登记为可复用的裁剪形状（rect / path / ellipse）
function registerClip(el, ctx) {
  const id = el.attrs.id;
  if (!id) return;
  const shapes = [];
  for (const c of el.children) {
    const rule = c.attrs['clip-rule'] || c.attrs['fill-rule'] || '';
    const tm = c.attrs.transform ? parseTransform(c.attrs.transform) : null;
    if (c.tag === 'rect') {
      shapes.push({
        kind: 'rect',
        x: parseFloat(c.attrs.x) || 0, y: parseFloat(c.attrs.y) || 0,
        w: parseFloat(c.attrs.width) || 0, h: parseFloat(c.attrs.height) || 0,
        tm, rule
      });
    } else if (c.tag === 'path') {
      if (c.attrs.d) shapes.push({ kind: 'path', d: c.attrs.d, tm, rule });
    } else if (c.tag === 'ellipse' || c.tag === 'circle') {
      const cx = parseFloat(c.attrs.cx) || 0, cy = parseFloat(c.attrs.cy) || 0;
      const rx = c.tag === 'circle' ? (parseFloat(c.attrs.r) || 0) : (parseFloat(c.attrs.rx) || 0);
      const ry = c.tag === 'circle' ? (parseFloat(c.attrs.r) || 0) : (parseFloat(c.attrs.ry) || 0);
      if (rx && ry) shapes.push({ kind: 'ellipse', cx, cy, rx, ry, tm, rule });
    }
  }
  ctx.clips.set(id, shapes);
}
function collectClips(root, ctx) {
  (function walk(el) {
    for (const c of el.children) {
      // parseSvgXml 已把标签名转小写：clipPath → clippath
      if (c.tag === 'clippath') registerClip(c, ctx);
      walk(c);
    }
  })(root);
}
// 椭圆路径（供裁剪使用）
function ellipsePath(cx, cy, rx, ry) {
  const out = [fmtNum(cx + rx) + ' ' + fmtNum(cy) + ' m'];
  for (const s of ellipseToCubics(cx, cy, rx, ry)) {
    out.push(fmtNum(s.c1[0]) + ' ' + fmtNum(s.c1[1]) + ' ' + fmtNum(s.c2[0]) + ' ' + fmtNum(s.c2[1]) +
      ' ' + fmtNum(s.p[0]) + ' ' + fmtNum(s.p[1]) + ' c');
  }
  out.push('h');
  return out.join('\n');
}
// 带矩阵的矩形 → 四个角点构成的路径
function rectPath(s) {
  const x = s.x, y = s.y, w = s.w, h = s.h;
  if (!w || !h) return null;
  if (!s.tm) return fmtNum(x) + ' ' + fmtNum(y) + ' ' + fmtNum(w) + ' ' + fmtNum(h) + ' re';
  const m = s.tm;
  const pt = (px, py) => [fmtNum(m[0] * px + m[2] * py + m[4]), fmtNum(m[1] * px + m[3] * py + m[5])];
  const p = [pt(x, y), pt(x + w, y), pt(x + w, y + h), pt(x, y + h)];
  return p[0].join(' ') + ' m\n' + p.slice(1).map(q => q.join(' ') + ' l').join('\n') + '\nh';
}
// 输出裁剪路径并把裁剪区压入图形状态（调用方负责外层 q/Q）
function emitClip(id, ctx, parts) {
  const shapes = ctx.clips.get(id);
  if (!shapes || !shapes.length) return false;
  let evenodd = false, n = 0;
  for (const s of shapes) {
    if (s.rule === 'evenodd') evenodd = true;
    let ops = null;
    if (s.kind === 'rect') ops = rectPath(s);
    else if (s.kind === 'path') ops = pathToPdf(s.d, s.tm);
    else if (s.kind === 'ellipse') ops = ellipsePath(s.cx, s.cy, s.rx, s.ry);
    if (ops) { parts.push(ops); n++; }
  }
  if (!n) return false;
  parts.push(evenodd ? 'W* n' : 'W n');
  return true;
}

/* ------------------------- 图元 ------------------------- */
function renderRect(el, ctx, parts) {
  const x = parseFloat(el.attrs.x) || 0;
  const y = parseFloat(el.attrs.y) || 0;
  const w = parseFloat(el.attrs.width) || 0;
  const h = parseFloat(el.attrs.height) || 0;
  if (!w || !h) return;
  // 整页白底（纸本身是白的）且无描边：跳过；非整页的白矩形必须保留，否则会漏出被遮挡的内容
  const fillColor = el.attrs.fill ? parseCssColor(el.attrs.fill) : null;
  if (fillColor && fillColor.r === 255 && fillColor.g === 255 && fillColor.b === 255 && !el.attrs.stroke &&
      x <= 0.01 && y <= 0.01 && x + w >= (ctx.pageW || 0) - 0.01 && y + h >= (ctx.pageH || 0) - 0.01) return;
  const tm = el.attrs.transform ? parseTransform(el.attrs.transform) : null;
  parts.push('q');
  if (tm) parts.push(tm.map(fmtNum).join(' ') + ' cm');
  paintShape(el, ctx, parts, fmtNum(x) + ' ' + fmtNum(y) + ' ' + fmtNum(w) + ' ' + fmtNum(h) + ' re', false);
  parts.push('Q');
}
function renderPath(el, ctx, parts) {
  if (!el.attrs.d) return;
  // 自身 transform 走 cm 而不是烘焙进坐标：渐变/裁剪的用户空间要跟着一起变
  const tm = el.attrs.transform ? parseTransform(el.attrs.transform) : null;
  const path = pathToPdf(el.attrs.d, null);
  if (!path) return;
  parts.push('q');
  if (tm) parts.push(tm.map(fmtNum).join(' ') + ' cm');
  // 填充规则：evenodd → f* / B*（默认 NonZero 不变）
  paintShape(el, ctx, parts, path, el.attrs['fill-rule'] === 'evenodd');
  parts.push('Q');
}
function renderEllipse(el, ctx, parts) {
  const cx = parseFloat(el.attrs.cx) || 0;
  const cy = parseFloat(el.attrs.cy) || 0;
  let rx, ry;
  if (el.tag === 'circle') { rx = ry = parseFloat(el.attrs.r) || 0; }
  else { rx = parseFloat(el.attrs.rx) || 0; ry = parseFloat(el.attrs.ry) || 0; }
  if (!rx || !ry) return;
  const tm = el.attrs.transform ? parseTransform(el.attrs.transform) : null;
  parts.push('q');
  if (tm) parts.push(tm.map(fmtNum).join(' ') + ' cm');
  paintShape(el, ctx, parts, ellipsePath(cx, cy, rx, ry), false);
  parts.push('Q');
}

/* ------------------------- 文本 ------------------------- */
// tspan 内容：保留首尾空格（ofd.js 的坐标列表按字符对齐，trim 会导致整段错位）
function tspanText(ts) {
  const raw = ts.rawText != null ? ts.rawText : ts.text;
  if (!raw) return '';
  // 手写 SVG 的 tspan 可能带换行缩进（svgToPdf 公共接口），此时按原逻辑 trim
  return /[\r\n]/.test(raw) ? raw.trim() : raw;
}
// 文字矩阵：SVG（mm，Y 向下）→ PDF 文字空间；含 tspan 旋转与合成斜体
function glyphMatrix(m, x, y, font, rot) {
  let tm;
  if (rot) {
    const c = Math.cos(rot.ang), s = Math.sin(rot.ang);
    const s0 = m[0];
    tm = [s0 * c, s0 * s, s, -c, s0 * rot.cx, rot.cy];
  } else {
    tm = [m[0], m[1], -m[2], -m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  }
  // 合成斜体：在文字空间内做 x 方向剪切（标准 Type1 斜体自带倾斜，不再叠加）
  if (font.italic && font.kind === 'cid' && !rot) {
    const t = Math.tan(12 * Math.PI / 180);
    tm = [tm[0], tm[1], tm[0] * t + tm[2], tm[1] * t + tm[3], tm[4], tm[5]];
  }
  return tm;
}
// 单字符输出；合成粗体沿线方向微移再画一遍
function pushGlyph(parts, font, ch, tm, size) {
  const hex = encodeChar(font, ch);
  parts.push(tm.map(fmtNum).join(' ') + ' Tm');
  parts.push('<' + hex + '> Tj');
  if (font.syntheticBold) {
    const dx = tm[0] * size * 0.025, dy = tm[1] * size * 0.025;
    parts.push([tm[0], tm[1], tm[2], tm[3], tm[4] + dx, tm[5] + dy].map(fmtNum).join(' ') + ' Tm');
    parts.push('<' + hex + '> Tj');
  }
}
function renderText(el, ctx, parts) {
  const fillAttr = el.attrs.fill;
  if (fillAttr === 'none') return;
  // 文字拿不到渐变（sh 不能填字），退化为渐变中值纯色
  const fillSrc = paintSource(fillAttr, ctx);
  const fill = fillSrc ? (fillSrc.color || gradientColorAt(fillSrc.gradient, 0.5)) : { r: 0, g: 0, b: 0 };
  const fillAlpha = fillSrc ? (fillSrc.color ? alphaOf(fillSrc.color) : gradientAlpha(fillSrc.gradient)) : null;
  // 文本元素的变换矩阵：无 CTM 时是恒等或 scale(hScale 1)；
  // 有 CTM 时为 translate(bx by) matrix(...) 的合并矩阵（此时 tspan 坐标为局部坐标）
  const m = parseTransform(el.attrs.transform || '');
  const fontSize = parseFloat(el.attrs['font-size']) || 3;
  // 收集文本片段：优先 tspan 子元素，若无则取直接文本
  const textRuns = [];
  const hasTspan = el.children.some(c => c.tag === 'tspan');
  if (hasTspan) {
    for (const ts of el.children) {
      if (ts.tag !== 'tspan') continue;
      const body = tspanText(ts);
      if (body) textRuns.push({ text: body, x: ts.attrs.x, y: ts.attrs.y, transform: ts.attrs.transform });
    }
  } else if (el.text) {
    textRuns.push({ text: el.text, x: el.attrs.x, y: el.attrs.y, transform: null });
  }
  if (!textRuns.length) return;
  // 字体：纯 ASCII 用标准 14 字体，含中文/符号的片段回退到 CID 中文字体
  let font = resolveFont(el.attrs);
  if (font.kind === 'type1') {
    for (const r of textRuns) {
      if (!isType1Safe(r.text)) { font = resolveFont(el.attrs, true); break; }
    }
  }
  const fname = ensureFont(font, ctx);
  const gs = ensureGState(fillAlpha, blendOf(el), ctx);
  if (gs) { parts.push('q'); parts.push('/' + gs + ' gs'); }
  parts.push('BT');
  parts.push('/' + fname + ' ' + fmtNum(fontSize) + ' Tf');
  parts.push(fmtNum(fill.r / 255) + ' ' + fmtNum(fill.g / 255) + ' ' + fmtNum(fill.b / 255) + ' rg');
  for (let ti = 0; ti < textRuns.length; ti++) {
    const ts = textRuns[ti];
    const chars = Array.from(ts.text);
    if (!chars.length) continue;
    const xs = numList(ts.x);
    const ys = numList(ts.y);
    const rot = parseRotate(ts.transform);
    // 直接文本（非 tspan）无逐字符坐标时，一次 Tj 输出全部字符
    const isDirect = !hasTspan && ti === 0;
    if (isDirect) {
      const x0 = xs[0] || 0;
      const y0 = ys[0] || 0;
      const tm = glyphMatrix(m, x0, y0, font, rot);
      parts.push(tm.map(fmtNum).join(' ') + ' Tm');
      parts.push('<' + chars.map(c => encodeChar(font, c)).join('') + '> Tj');
    } else {
      for (let i = 0; i < chars.length; i++) {
        const x = i < xs.length ? xs[i] : (xs.length ? xs[xs.length - 1] : 0);
        const y = i < ys.length ? ys[i] : (ys.length ? ys[ys.length - 1] : 0);
        pushGlyph(parts, font, chars[i], glyphMatrix(m, x, y, font, rot), fontSize);
      }
    }
  }
  parts.push('ET');
  if (gs) parts.push('Q');
}

/* ------------------------- 图像与分组 ------------------------- */
async function renderImage(el, ctx, parts) {
  const x = parseFloat(el.attrs.x) || 0;
  const y = parseFloat(el.attrs.y) || 0;
  const w = parseFloat(el.attrs.width) || 0;
  const h = parseFloat(el.attrs.height) || 0;
  if (!w || !h) return;
  const href = el.attrs.href || el.attrs['xlink:href'];
  if (!href) return;
  const name = await addImage(href, ctx);
  if (!name) return;
  const op = parseFloat(el.attrs.opacity);
  const gs = ensureGState(op && op < 1 ? op : null, blendOf(el), ctx);
  parts.push('q');
  if (gs) parts.push('/' + gs + ' gs');
  const clipId = parseClipRef(el.attrs['clip-path']);
  if (clipId) emitClip(clipId, ctx, parts);
  // 图像单位坐标 → 边界矩形。SVG y 为图像上边，PDF 图像数据自底向上，
  // 用负高并平移使图像不翻转：w 0 0 -h x (y+h) cm
  parts.push(fmtNum(w) + ' 0 0 ' + fmtNum(-h) + ' ' + fmtNum(x) + ' ' + fmtNum(y + h) + ' cm');
  parts.push('/' + name + ' Do');
  parts.push('Q');
}
async function renderGroup(el, ctx, parts) {
  const m = parseTransform(el.attrs.transform || '');
  const op = parseFloat(el.attrs.opacity);
  const gs = ensureGState(op && op < 1 ? op : null, blendOf(el), ctx);
  const hasM = m[0] !== 1 || m[1] !== 0 || m[2] !== 0 || m[3] !== 1 || m[4] !== 0 || m[5] !== 0;
  const clipId = parseClipRef(el.attrs['clip-path']);
  parts.push('q');
  if (hasM) parts.push(m.map(fmtNum).join(' ') + ' cm');
  // 裁剪区在元素自身的用户空间内（随 transform 一起移动）
  if (clipId) emitClip(clipId, ctx, parts);
  if (gs) parts.push('/' + gs + ' gs');
  for (const child of el.children) await renderElement(child, ctx, parts);
  parts.push('Q');
}
function renderShape(el, ctx, parts) {
  switch (el.tag) {
    case 'rect': renderRect(el, ctx, parts); break;
    case 'path': renderPath(el, ctx, parts); break;
    case 'ellipse':
    case 'circle': renderEllipse(el, ctx, parts); break;
    case 'text': renderText(el, ctx, parts); break;
    default: break; // clippath / defs / gradient 等仅登记不绘制
  }
}
async function renderElement(el, ctx, parts) {
  if (el.tag === 'g') { await renderGroup(el, ctx, parts); return; }
  if (el.tag === 'image') { await renderImage(el, ctx, parts); return; }
  // 其余图元若带 clip-path：在裁剪区生效时包一层 q/Q
  const clipId = parseClipRef(el.attrs['clip-path']);
  if (clipId && ctx.clips && ctx.clips.has(clipId)) {
    const probe = [];
    if (emitClip(clipId, ctx, probe)) {
      parts.push('q', ...probe);
      renderShape(el, ctx, parts);
      parts.push('Q');
      return;
    }
  }
  renderShape(el, ctx, parts);
}

/* ------------------------- 入口 ------------------------- */
// 收集 <defs> 里的渐变定义
function collectGradients(root, ctx) {
  (function walk(el) {
    if (el.tag === 'lineargradient' || el.tag === 'radialgradient') {
      const id = el.attrs.id;
      if (id && !ctx.gradientDefs.has(id)) {
        const g = parseGradient(el);
        if (g) ctx.gradientDefs.set(id, g);
      }
      return;
    }
    for (const c of el.children) walk(c);
  })(root);
}
// SVG 字符串（mm 坐标、Y 向下）→ 单页 PDF 内容流
export async function svgToContentStream(svgStr, pageWmm, pageHmm, ctx) {
  ctx = ctx || {};
  // 兼容只传部分字段的调用方（旧版 svgToContentStream 的 ctx 只有 5 个字段）
  ctx.images = ctx.images || new Set();
  ctx.alphas = ctx.alphas || new Set();
  ctx.clips = ctx.clips || new Map();
  ctx.shadings = ctx.shadings || new Set();
  ctx.fonts = ctx.fonts || new Set();
  ctx.imageReg = ctx.imageReg || new Map();
  ctx.alphaReg = ctx.alphaReg || new Map();
  ctx.shadingReg = ctx.shadingReg || new Map();
  ctx.fontReg = ctx.fontReg || new Map();
  ctx.gradientDefs = ctx.gradientDefs || new Map();
  ctx.pageW = pageWmm;
  ctx.pageH = pageHmm;
  const root = parseSvgXml(svgStr);
  collectClips(root, ctx);
  collectGradients(root, ctx);
  const parts = [];
  const pageHpt = pageHmm * MM_TO_PT;
  // 全局变换：mm → pt（2.8346 倍）并翻转 Y（PDF 原点在左下）
  parts.push('q');
  parts.push(fmtNum(MM_TO_PT) + ' 0 0 ' + fmtNum(-MM_TO_PT) + ' 0 ' + fmtNum(pageHpt) + ' cm');
  for (const child of root.children) await renderElement(child, ctx, parts);
  parts.push('Q');
  return parts.join('\n');
}
